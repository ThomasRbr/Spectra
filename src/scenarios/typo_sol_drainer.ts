import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Drainer sur Solana : un faux site d'airdrop fait signer aux victimes une
// transaction qui transfère leurs SOL et leurs USDC (SPL) vers l'adresse du
// drainer. Chaque vol est aussitôt partagé entre l'affilié qui a mené la
// campagne et l'opérateur du kit (« drainer-as-a-service »), qui perçoit des
// commissions de plusieurs drainers. L'affilié convertit et dépose sur un
// exchange.

const PROJECTS = [
  { name: 'Solstice Pass', claim: 'Claim $SOLST' },
  { name: 'Phare Genesis', claim: 'Mint Phare Genesis' },
  { name: 'Mistral Drop', claim: 'Claim $MSTRL' },
  { name: 'Lumen Odyssey', claim: 'Free mint Odyssey' },
] as const
const KITS = ['NoxDrain', 'VelvetSweep', 'Phantasm', 'Sablier'] as const

const sol = (v: number) => roundAsset('SOL', v)
const usdc = (v: number) => roundAsset('USDC', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

interface Drain {
  victim: string
  tx: Tx
  sol: number
  usdc: number
  split: Tx
}

export const solDrainer: ScenarioTemplate = {
  id: 'sol-drainer',
  title: 'Drainer Solana : le faux airdrop',
  tagline: 'Une signature sur un faux site, des SOL et des USDC aspirés, un partage affilié / opérateur.',
  description:
    'Des victimes connectent leur portefeuille Solana à un faux site d\'airdrop et signent une transaction qui vide leurs SOL et leurs USDC. Identifiez l\'adresse du drainer, la part de l\'affilié et l\'adresse de l\'opérateur du kit, mesurez le préjudice total et suivez l\'encaissement jusqu\'à l\'exchange.',
  difficulty: 2,
  chains: ['sol'],
  skills: ['evm', 'tokens', 'dex', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 20,
  lessons: ['drainers-approvals', 'solana', 'stablecoins', 'gel-stablecoins', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const g = victimP.g
    const project = r.pick(PROJECTS)
    const kitName = r.pick(KITS)
    const affPct = r.pick([75, 80, 85])
    const promo = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const destKey = r.pick(['kraken', 'okx', 'binance', 'coinbase', 'bitstamp'] as const)
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'sol')))
      return x
    }
    const dest = ex(destKey)
    const ramps = (['coinbase', 'kraken', 'binance', 'okx'] as const).filter((k) => k !== destKey).map(ex)
    const raydium = w.entity('raydium')
    const rayPool = w.addr('sol', { entity: raydium, label: 'Raydium: Pool SOL/USDC', contract: { name: 'Raydium SOL/USDC Pool', type: 'pool' } })

    const affE = w.customEntity({ name: 'Affilié de la campagne (inconnu)', category: 'suspect' })
    const kitE = w.customEntity({ name: `Opérateur du kit « ${kitName} » (inconnu)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimP.name, category: 'victim' })
    const drainer = w.addr('sol', { entity: affE })
    const affiliate = w.addr('sol', { entity: affE })
    const operator = w.addr('sol', { entity: kitE })

    const raySwap = (trader: string, assetIn: AssetId, amountIn: number, assetOut: AssetId, time: number) => {
      const amountOut = roundAsset(assetOut, (usd(assetIn, amountIn) * 0.9975 * r.float(0.994, 0.999)) / usd(assetOut, 1))
      const tx = w.multi({ time, signer: trader, method: `swapBaseIn (${assetIn} → ${assetOut})`, tags: ['swap'], legs: [{ from: trader, to: rayPool, value: amountIn, asset: assetIn }, { from: rayPool, to: trader, value: amountOut, asset: assetOut }] })
      return { tx, amountOut }
    }

    /** Vol puis partage immédiat entre l'affilié et l'opérateur. */
    const drainOne = (from: string, to: string, aff: string, op: string, pct: number, t: number, vSol: number, vUsdc: number): { tx: Tx; split: Tx } => {
      const legs: { from: string; to: string; value: number; asset: AssetId }[] = [{ from, to, value: vSol, asset: 'SOL' }]
      if (vUsdc > 0) legs.push({ from, to, value: vUsdc, asset: 'USDC' })
      const tx = w.multi({ time: t, signer: from, legs, method: 'Transfer + TransferChecked (signature « Claim »)', tags: ['drain'] })
      const sLegs: { from: string; to: string; value: number; asset: AssetId }[] = []
      const aSol = sol((vSol * pct) / 100)
      sLegs.push({ from: to, to: aff, value: aSol, asset: 'SOL' }, { from: to, to: op, value: sol(vSol - aSol), asset: 'SOL' })
      if (vUsdc > 0) {
        const aU = usdc((vUsdc * pct) / 100)
        sLegs.push({ from: to, to: aff, value: aU, asset: 'USDC' }, { from: to, to: op, value: usdc(vUsdc - aU), asset: 'USDC' })
      }
      const split = w.multi({ time: t + r.int(4, 40), signer: to, legs: sLegs, method: 'distribute (fee split)' })
      return { tx, split }
    }

    // ── Victimes de la campagne ──────────────────────────────────────────────
    const t0 = w.at(0)
    const drains: Drain[] = []
    const victim = w.addr('sol', { entity: victimE })
    const nOthers = r.int(6, 9)
    const victims = [victim, ...Array.from({ length: nOthers }, () => w.addr('sol'))]
    const fundTxs: Tx[] = []
    victims.forEach((v, i) => {
      const t = i === 0 ? t0 : t0 + Math.round(r.float(-30, 60) * HOUR)
      const vSol = sol(r.float(i === 0 ? 8 : 0.8, i === 0 ? 30 : 40))
      const vUsdc = i === 0 || r.chance(0.7) ? usdc(Math.round(r.float(150, 9000))) : 0
      const ramp = r.pick(ramps)
      fundTxs.push(ramp.withdraw(v, sol(vSol + 0.002 + r.float(0, 0.01)), t - Math.round(r.float(2, 60) * DAY), 'SOL'))
      if (vUsdc > 0) fundTxs.push(ramp.withdraw(v, vUsdc, t - Math.round(r.float(1, 40) * DAY), 'USDC'))
      const { tx, split } = drainOne(v, drainer, affiliate, operator, affPct, t, vSol, vUsdc)
      drains.push({ victim: v, tx, sol: vSol, usdc: vUsdc, split })
    })
    const vd = drains[0]
    const stolenSol = sol(drains.reduce((s, d) => s + d.sol, 0))
    const stolenUsdc = usdc(drains.reduce((s, d) => s + d.usdc, 0))
    const stolenUsd = Math.round((usd('SOL', stolenSol) + stolenUsdc) * 100) / 100

    // ── Autres drainers du même kit : l'opérateur perçoit leurs commissions ──
    const otherDrainers = Array.from({ length: r.int(2, 3) }, () => {
      const oe = w.customEntity({ name: 'Autre affilié (inconnu)', category: 'suspect' })
      const d = w.addr('sol', { entity: oe })
      const a = w.addr('sol', { entity: oe })
      const pct = r.pick([70, 75, 80, 85])
      for (let i = 0; i < r.int(2, 4); i++) {
        const v = w.addr('sol')
        const t = t0 + Math.round(r.float(-6, 8) * DAY)
        const vSol = sol(r.float(0.5, 25))
        const vUsdc = r.chance(0.5) ? usdc(Math.round(r.float(80, 5000))) : 0
        w.fundAccount(v, sol(vSol + 0.01), 'SOL', t - Math.round(r.float(2, 30) * DAY))
        if (vUsdc > 0) w.fundAccount(v, vUsdc, 'USDC', t - Math.round(r.float(1, 20) * DAY))
        drainOne(v, d, a, operator, pct, t, vSol, vUsdc)
      }
      return d
    })

    // ── Encaissement de l'affilié ────────────────────────────────────────────
    const lastSplit = Math.max(...drains.map((d) => d.split.time))
    const tSw = lastSplit + Math.round(r.float(2, 8) * HOUR)
    const affSol = w.balanceOf(affiliate, 'SOL')
    const swapIn = sol(affSol - r.float(0.05, 0.2))
    const sw = raySwap(affiliate, 'SOL', swapIn, 'USDC', tSw)
    const affUsdc = usdc(w.balanceOf(affiliate, 'USDC'))
    const dep = dest.newDeposit()
    const u1 = usdc(Math.round(affUsdc * r.float(0.4, 0.6)))
    const u2 = usdc(Math.floor(affUsdc - u1))
    const d1 = dest.receive(affiliate, u1, tSw + Math.round(r.float(1, 5) * HOUR), { asset: 'USDC', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const d2 = dest.receive(affiliate, u2, d1.tx.time + Math.round(r.float(4, 16) * HOUR), { asset: 'USDC', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const deposited = usdc(u1 + u2)

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const trader = w.addr('sol')
      const t = t0 + Math.round(r.float(-3, 5) * DAY)
      if (r.chance(0.5)) raySwap(trader, 'SOL', sol(r.float(1, 200)), 'USDC', t)
      else raySwap(trader, 'USDC', usdc(r.float(100, 30000)), 'SOL', t)
    }
    dest.noise(14, t0 - 2 * DAY, d2.tx.time + 3 * DAY, 'USDC')
    dest.noise(6, t0 - 2 * DAY, d2.tx.time + 3 * DAY, 'SOL')
    for (const k of ramps) k.noise(4, t0 - 5 * DAY, t0 + 3 * DAY, 'SOL')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const opFromCampaign = usd('SOL', stolenSol * (1 - affPct / 100)) + stolenUsdc * (1 - affPct / 100)
    const opHeld = w.balanceOf(operator, 'USDC')
    const destName = dest.entity.name
    const vLoss = usd('SOL', vd.sol) + vd.usdc
    const domain = `${project.name.toLowerCase().replace(/[^a-z]/g, '')}-claim.example`

    return {
      world: w,
      title: `Faux airdrop « ${project.name} » — ${city}`,
      briefing:
        `${victimP.name}, demeurant à ${city}, dépose plainte : en voulant récupérer un airdrop annoncé pour le projet « ${project.name} », ${g('il', 'elle')} a connecté son portefeuille Solana à un site et validé une transaction présentée comme « ${project.claim} ». Quelques secondes plus tard, ses SOL et ses USDC avaient disparu.\n\n` +
        `Le site est un « drainer » : la transaction signée ne réclamait aucun airdrop, elle transférait le contenu du portefeuille. Ces kits sont loués à des « affiliés » qui mènent les campagnes de phishing ; l'opérateur du kit prélève une commission sur chaque vol.\n\n` +
        `Objectifs : identifier l'adresse du drainer, comprendre le partage des fonds et repérer l'opérateur du kit, mesurer le préjudice total de la campagne et suivre l'encaissement.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: t0 + DAY, author: victimP.name,
          body:
            `« J'ai vu passer sur X un message du compte @${promo} : "${project.name} : airdrop ouvert pendant 24 h, vérifiez votre éligibilité". J'ai cliqué, connecté mon portefeuille et accepté la transaction. Je n'ai pas lu le détail, l'écran indiquait juste "${project.claim}".\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `La transaction qui a tout vidé : ${vd.tx.hash}\n\n` +
            `J'ai perdu ${amt(vd.sol, 'SOL')} et ${amt(vd.usdc, 'USDC')}, soit environ ${usd0(vLoss)}. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture du site frauduleux (archivée par la victime)', date: t0 - 2 * HOUR,
          body:
            `https://${domain}\n` +
            `${project.name.toUpperCase()} — SEASON 1 AIRDROP\n` +
            `✅ Your wallet is eligible: 2 450 tokens\n` +
            `[ Connect wallet ]  [ ${project.claim} ]\n` +
            `Fenêtre du portefeuille : « Confirmer la transaction » — aperçu de la simulation : « Impossible de simuler cette transaction »`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note de veille : drainers en location', date: t0 + 2 * DAY, author: 'Cellule cyber',
          body:
            `Le kit « ${kitName} » est proposé sur des forums et canaux Telegram russophones et anglophones : l'opérateur fournit le faux site et le code de la transaction piégée, l'affilié apporte le trafic (faux comptes, publicités, messages privés).\n` +
            `Chaque vol est partagé automatiquement par une transaction de répartition : l'affilié touche la plus grosse part, l'opérateur sa commission, dont le taux varie selon les affiliés.\n` +
            `Un même opérateur perçoit ainsi les commissions de nombreuses campagnes, sur une ou quelques adresses.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : drainers sur Solana', date: t0 + 2 * DAY, author: 'Cellule d\'appui',
          body:
            `• Sur Solana, une seule transaction peut contenir plusieurs instructions : transfert de SOL, transfert de jetons SPL (USDC), voire changement du propriétaire d'un compte de jetons. Signée par la victime, elle est exécutée immédiatement et ne peut pas être annulée.\n` +
            `• Les portefeuilles affichent une simulation des effets avant signature. Un avertissement « impossible de simuler » ou une liste de transferts inattendus doit faire refuser.\n` +
            `• Le signataire de la transaction de vol est la victime elle-même : c'est le destinataire des fonds qui désigne le drainer.\n` +
            `• Les USDC sont émis par Circle, qui peut geler une adresse sur demande des autorités.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 15,
          prompt: 'Quelle est l\'adresse du drainer, qui reçoit les fonds des victimes ?',
          answer: [drainer],
          hint: 'Ouvrez la transaction citée par la victime : elle en est la signataire, mais le destinataire des transferts est le drainer.',
          explanation: `${A(w, drainer)} reçoit les SOL et les USDC de ${victims.length} portefeuilles, chacun vidé par une transaction signée par la victime elle-même.`,
        },
        {
          id: 'o2', type: 'number', points: 15, unit: '%', tolerance: 1,
          prompt: 'Quelle part de chaque vol (en %) revient à l\'affilié ?',
          answer: affPct,
          hint: 'Chaque vol est suivi, quelques secondes plus tard, d\'une transaction de répartition vers deux adresses : rapportez la plus grosse part au total.',
          explanation: `Chaque transaction de répartition envoie ${affPct} % des SOL et des USDC volés à ${A(w, affiliate)} et ${100 - affPct} % à ${A(w, operator)}. Par exemple, pour ${victimP.name} : ${amt(vd.split.transfers[0].value, 'SOL')} contre ${amt(vd.split.transfers[1].value, 'SOL')}.`,
        },
        {
          id: 'o3', type: 'address', points: 15,
          prompt: 'Quelle adresse appartient à l\'opérateur du kit ?',
          answer: [operator],
          hint: 'Des deux bénéficiaires de la répartition, l\'un reçoit aussi des commissions d\'autres drainers.',
          explanation: `${A(w, operator)} reçoit la petite part de chaque vol de la campagne (≈ ${usd0(opFromCampaign)}), mais aussi celle de ${otherDrainers.length} autres adresses de drainer, sans lien avec cette campagne : c'est la signature de l'opérateur du kit, rémunéré par tous ses affiliés. L'autre bénéficiaire ne reçoit que de ce drainer : c'est l'affilié.`,
        },
        {
          id: 'o4', type: 'amount', points: 15, unit: 'USD', tolerance: 0.02,
          prompt: 'Quel est le préjudice total de la campagne (en dollars), toutes victimes confondues ?',
          answer: stolenUsd,
          hint: 'L\'adresse du drainer ne reçoit rien d\'autre que les fonds volés : son total reçu, SOL et USDC confondus, répond à la question.',
          explanation: `${victims.length} victimes : ${amt(stolenSol, 'SOL')} et ${amt(stolenUsdc, 'USDC')}, soit ${usd0(stolenUsd)} au cours de l'exercice (1 SOL = 158 $). ${g('Seul', 'Seule')} ${victimP.name} a porté plainte à ce stade : les autres victimes sont identifiables par leurs adresses, et parfois par l'exchange qui les avait alimentées.`,
        },
        {
          id: 'o5', type: 'entity', points: 15,
          prompt: 'Sur quel exchange l\'affilié a-t-il encaissé sa part ?',
          answer: [destKey],
          hint: 'Suivez l\'adresse de l\'affilié : conversion des SOL en USDC sur Raydium, puis dépôts.',
          explanation: `L'affilié échange ${amt(swapIn, 'SOL')} contre ${amt(sw.amountOut, 'USDC')} sur Raydium, puis dépose ${amt(deposited, 'USDC')} en deux fois sur ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o6', type: 'address', points: 10,
          prompt: 'Quelle adresse de dépôt faut-il viser dans la réquisition à cet exchange ?',
          answer: [dep],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDC de l\'affilié avant d\'être balayée.',
          explanation: `Les deux dépôts arrivent sur ${A(w, dep)}, balayée ensuite vers le hot wallet de ${destName} : cette adresse est rattachée à un compte client unique. Les USDC encore détenus par l'opérateur (${amt(usdc(opHeld), 'USDC')}) peuvent faire l'objet d'une demande de gel auprès de Circle.`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Quel conseil de prévention aurait évité ce vol ?',
          ...choice(r,
            'Lire la simulation avant de signer, refuser toute transaction non simulable et utiliser un portefeuille dédié presque vide',
            [
              'Changer le mot de passe de l\'extension du portefeuille après coup, ce qui annule les transactions signées sur le faux site',
              'Activer la double authentification de son compte d\'exchange, qui protège aussi les portefeuilles auto-hébergés liés',
              'Attendre la confirmation du bloc avant de fermer le site, délai pendant lequel un validateur peut annuler la transaction',
            ]),
          explanation: `Sur une blockchain, une transaction signée et confirmée est définitive : aucun mot de passe, aucun validateur ne peut l'annuler, et la sécurité d'un compte d'exchange ne couvre pas un portefeuille auto-hébergé. La prévention passe par la lecture de l'aperçu de simulation (ici « impossible de simuler »), la méfiance envers les airdrops annoncés par des comptes non officiels et un portefeuille dédié, presque vide, pour interagir avec des sites inconnus. Le domaine ${domain} et le compte @${promo} peuvent être signalés (PHAROS, plateforme du réseau social) pour limiter les nouvelles victimes.`,
        },
      ],
      truth: {
        path: [vd.tx.id, vd.split.id, ...fundTxs.filter((t) => t.transfers.some((x) => x.to === victim)).map((t) => t.id), ...drains.slice(1).flatMap((d) => [d.tx.id, d.split.id]), sw.tx.id, d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : [])],
        addresses: [drainer, affiliate, operator, dep],
        debrief:
          `1. Le compte @${promo} relaie un faux airdrop « ${project.name} » pointant vers ${domain}, un site motorisé par le kit « ${kitName} ».\n` +
          `2. ${victims.length} victimes, dont ${victimP.name}, signent la transaction « ${project.claim} » : ${amt(stolenSol, 'SOL')} et ${amt(stolenUsdc, 'USDC')} (${usd0(stolenUsd)}) partent vers le drainer ${A(w, drainer)}.\n` +
          `3. Chaque vol est réparti dans la foulée : ${affPct} % pour l'affilié ${A(w, affiliate)}, ${100 - affPct} % pour l'opérateur ${A(w, operator)}, qui perçoit aussi les commissions de ${otherDrainers.length} autres drainers.\n` +
          `4. L'affilié convertit ses SOL en USDC sur Raydium et dépose ${amt(deposited, 'USDC')} sur ${destName} (${A(w, dep)}).\n\n` +
          `À retenir : dans un vol par drainer, la victime signe elle-même la transaction ; c'est le destinataire qui désigne le drainer. La transaction de répartition révèle l'économie du kit : la part de l'affilié et l'adresse de l'opérateur, reconnaissable aux commissions qu'il reçoit de plusieurs campagnes. Deux leviers rapides : la réquisition à ${destName} sur l'adresse de dépôt de l'affilié, et la demande de gel des USDC détenus par l'opérateur.`,
      },
      hints: [
        'Ouvrez la transaction citée par la victime : regardez à qui vont les transferts, pas qui a signé.',
        'Sur l\'adresse du drainer, chaque entrée est suivie d\'une sortie vers deux adresses : comparez les montants.',
        'Ouvrez les deux bénéficiaires de la répartition et regardez d\'où viennent leurs entrées.',
        'L\'affilié convertit puis dépose : l\'adresse de dépôt est celle qui reçoit avant le balayage vers le hot wallet.',
      ],
    }
  },
}
