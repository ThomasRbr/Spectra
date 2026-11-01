import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { dusting } from '../engine/realism'
import { ASSETS, roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Drainer sur Solana : un faux site d'airdrop fait signer aux victimes une
// transaction qui transfère leurs SOL et leurs USDC (SPL) vers l'adresse du
// drainer. Chaque vol est aussitôt partagé entre l'affilié qui a mené la
// campagne et l'opérateur du kit (« drainer-as-a-service »), qui perçoit des
// commissions de plusieurs drainers. L'affilié, dont le portefeuille a une
// vie antérieure (retraits d'exchange, casino, achat de trafic), teste le kit
// sur un portefeuille à lui, puis convertit, met une réserve de côté et
// envoie l'essentiel vers un échangeur instantané contre du Monero.

const PROJECTS = [
  { name: 'Solstice Pass', claim: 'Claim $SOLST' },
  { name: 'Phare Genesis', claim: 'Mint Phare Genesis' },
  { name: 'Mistral Drop', claim: 'Claim $MSTRL' },
  { name: 'Lumen Odyssey', claim: 'Free mint Odyssey' },
] as const
const KITS = ['NoxDrain', 'VelvetSweep', 'Phantasm', 'Sablier'] as const
const PROMOS = ['TrafficLab', 'CryptoReach', 'MoonViews', 'AlphaPush'] as const
const CASINOS = ['SolaSpin', 'Lunaria Casino', 'JackSol', 'RoyalDegen'] as const
const SHOPS = ['GiftNova', 'Carte&Go', 'RechargePlus', 'Bonkado'] as const

const MIN = 60
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
  tagline: 'Une signature sur un faux site, des SOL et des USDC aspirés, un kit loué, et un affilié qui file vers le Monero.',
  description:
    'Des victimes connectent leur portefeuille Solana à un faux site d\'airdrop et signent une transaction qui vide leurs SOL et leurs USDC. Distinguez les victimes du portefeuille de test de l\'affilié, démontez le partage affilié / opérateur du kit, puis triez les sorties d\'un portefeuille qui a toute une vie (retraits d\'exchange, casino, achat de trafic, réserve, poussière) pour trouver la commande passée chez l\'échangeur instantané.',
  difficulty: 2,
  chains: ['sol'],
  skills: ['evm', 'tokens', 'dex', 'typologies', 'exchange_id', 'requisition', 'poisoning'],
  estMinutes: 50,
  lessons: ['drainers-approvals', 'solana', 'stablecoins', 'gel-stablecoins', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const g = victimP.g
    const project = r.pick(PROJECTS)
    const kitName = r.pick(KITS)
    const promoName = r.pick(PROMOS)
    const affPct = r.pick([75, 80, 85])
    const promo = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const affKey = r.pick(['kraken', 'okx', 'binance', 'coinbase'] as const)
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'sol')))
      return x
    }
    const affEx = ex(affKey)
    const ramps = (['coinbase', 'kraken', 'binance', 'okx'] as const).map(ex)
    const raydium = w.entity('raydium')
    const rayPool = w.addr('sol', { entity: raydium, label: 'Raydium: Pool SOL/USDC', contract: { name: 'Raydium SOL/USDC Pool', type: 'pool' } })
    // Casino et boutique de cartes cadeaux fictifs propres au dossier (choisis sans consommer l'aléa)
    const mix = Math.imul(w.seed, 2654435761) >>> 0
    const casinoName = CASINOS[(mix >>> 24) % CASINOS.length]
    const shopName = SHOPS[(mix >>> 16) % SHOPS.length]
    const orbit = w.customEntity({ name: casinoName, category: 'gambling', known: true, description: 'Casino en ligne crypto (fictif) acceptant SOL et USDC, sans vérification d\'identité sous un certain plafond.' })
    const orbitAddr = w.addr('sol', { entity: orbit, label: `${casinoName} — Adresse de dépôt` })
    const giftE = w.customEntity({ name: shopName, category: 'merchant', known: true, description: 'Vente de cartes cadeaux et de recharges contre crypto (fictif) ; conserve l\'e-mail de livraison de chaque commande.' })
    const cnE = w.entity('changenow')
    const cnHot = w.addr('sol', { entity: cnE, label: 'ChangeNOW — Hot Wallet SOL', tags: ['liquid', 'hot'] })
    const cnDeposit = () => w.addr('sol', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    /** Commande USDC → XMR : dépôt puis rapatriement vers le hot wallet ; le paiement en XMR n'est pas observable. */
    const xmrOrder = (from: string, value: number, time: number) => {
      const deposit = cnDeposit()
      const depositTx = w.transfer({ time, from, to: deposit, value, asset: 'USDC' })
      const sweepTx = w.transfer({ time: time + r.int(3, 25) * MIN, from: deposit, to: cnHot, value, asset: 'USDC', method: 'sweep', tags: ['sweep'] })
      return { deposit, depositTx, sweepTx }
    }

    const affE = w.customEntity({ name: 'Affilié de la campagne (inconnu)', category: 'suspect' })
    const kitE = w.customEntity({ name: `Opérateur du kit « ${kitName} » (inconnu)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimP.name, category: 'victim' })
    const drainer = w.addr('sol', { entity: affE })
    const affiliate = w.addr('sol', { entity: affE })
    const testWallet = w.addr('sol', { entity: affE })
    const cold = w.addr('sol', { entity: affE })
    const operator = w.addr('sol', { entity: kitE })
    const promoter = w.addr('sol')

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

    const t0 = w.at(0)

    // ── Vie antérieure du portefeuille de l'affilié ─────────────────────────
    // Retraits depuis son propre compte d'exchange, un peu de trading, un
    // paiement à un particulier, des dépôts au casino, l'achat de trafic.
    const hIn1 = affEx.withdraw(affiliate, sol(r.float(8, 14)), t0 - Math.round(r.float(70, 90) * DAY), 'SOL')
    const hSwap = raySwap(affiliate, 'SOL', sol(r.float(4, 6)), 'USDC', t0 - Math.round(r.float(52, 60) * DAY))
    w.transfer({ time: t0 - Math.round(r.float(40, 48) * DAY), from: affiliate, to: w.addr('sol'), value: sol(r.float(1, 2)), asset: 'SOL' })
    const hIn2 = affEx.withdraw(affiliate, sol(r.float(4, 8)), t0 - Math.round(r.float(20, 28) * DAY), 'SOL')
    const orbitTxs = [
      w.transfer({ time: t0 - Math.round(r.float(12, 16) * DAY), from: affiliate, to: orbitAddr, value: sol(r.float(1, 2.5)), asset: 'SOL' }),
    ]
    // Achat de trafic : le vendeur sert aussi d'autres clients
    const orderNo = r.int(1000, 9999)
    const promoDays = r.int(3, 7)
    for (let i = 0; i < r.int(3, 5); i++) {
      const c = w.addr('sol')
      const v = usdc(Math.round(r.float(15, 60)) * 10)
      const tc = t0 - Math.round(r.float(1, 40) * DAY)
      w.fundAccount(c, usdc(v + r.int(5, 80)), 'USDC', tc - Math.round(r.float(2, 72) * HOUR))
      w.transfer({ time: tc, from: c, to: promoter, value: v, asset: 'USDC', memo: `Commande #${r.int(1000, 9999)} — pack ${r.int(2, 7)} j` })
    }
    const promoV = usdc(Math.round(r.float(20, 45)) * 10)
    const promoTx = w.transfer({ time: t0 - Math.round(r.float(54, 70) * HOUR), from: affiliate, to: promoter, value: promoV, asset: 'USDC', memo: `Commande #${orderNo} — pack ${promoDays} j` })

    // Test du kit sur un portefeuille de l'affilié, avant la campagne
    const testFund = w.transfer({ time: t0 - Math.round(r.float(38, 44) * HOUR), from: affiliate, to: testWallet, value: sol(r.float(0.35, 0.6)), asset: 'SOL' })
    const testSol = sol(testFund.transfers[0].value - 0.002)
    const test = drainOne(testWallet, drainer, affiliate, operator, affPct, testFund.time + r.int(6, 25) * MIN, testSol, 0)

    // ── Victimes de la campagne ──────────────────────────────────────────────
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
    const firstDrain = Math.min(...drains.map((x) => x.tx.time))

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
    const solKeep = r.float(0.8, 1.4)
    const swapIn = sol(w.balanceOf(affiliate, 'SOL') - solKeep)
    const sw = raySwap(affiliate, 'SOL', swapIn, 'USDC', tSw)
    const affUsdc = usdc(w.balanceOf(affiliate, 'USDC'))
    // Réserve mise de côté sur une adresse neuve (montant rond, ne bouge plus)
    const coldV = usdc(Math.round((affUsdc * r.float(0.12, 0.2)) / 100) * 100)
    const coldTx = w.transfer({ time: tSw + Math.round(r.float(0.6, 2) * HOUR), from: affiliate, to: cold, value: coldV, asset: 'USDC' })
    // L'essentiel part chez l'échangeur instantané (USDC → XMR)
    const spendReserve = r.float(1300, 1700)
    const cnValue = usdc(Math.floor((affUsdc - coldV - spendReserve) / 10) * 10)
    const tCn = coldTx.time + Math.round(r.float(1.5, 5) * HOUR)
    const cn = xmrOrder(affiliate, cnValue, tCn)
    // Autres clients de l'échangeur, montants voisins, même fenêtre
    for (let i = 0; i < r.int(3, 4); i++) {
      const c = w.addr('sol')
      const v = usdc(cnValue * r.float(0.85, 1.15))
      const tc = tCn + Math.round(r.float(-3, 3) * HOUR)
      w.fundAccount(c, usdc(v * r.float(1.3, 3)), 'USDC', tc - Math.round(r.float(1, 30) * HOUR))
      xmrOrder(c, v, tc)
    }
    // Dépenses courantes après coup : cartes cadeaux, casino
    const cardhubAddr = w.addr('sol', { entity: giftE, label: `${shopName} — Paiement` })
    const spend = { txs: [cardhubAddr, orbitAddr, cardhubAddr].map((to, i) => w.transfer({ time: tCn + Math.round(r.float(6 + i * 30, 30 + i * 36) * HOUR), from: affiliate, to, value: usdc(Math.round(r.float(5, 38)) * 10), asset: 'USDC' })) }
    // Empoisonnement d'adresse : des sosies envoient des montants infimes
    const dust = dusting(w, affiliate, { time: tSw, n: r.int(2, 3), spreadH: 30 })
    const affUsdcLeft = usdc(w.balanceOf(affiliate, 'USDC'))

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (let i = 0; i < 22; i++) {
      const trader = w.addr('sol')
      const t = t0 + Math.round(r.float(-3, 5) * DAY)
      if (r.chance(0.5)) raySwap(trader, 'SOL', sol(r.float(1, 200)), 'USDC', t)
      else raySwap(trader, 'USDC', usdc(r.float(100, 30000)), 'SOL', t)
    }
    for (const k of ramps) k.noise(8, t0 - 5 * DAY, t0 + 3 * DAY, 'SOL')
    affEx.noise(5, t0 - 90 * DAY, t0 - 20 * DAY, 'SOL')
    for (let i = 0; i < r.int(5, 8); i++) {
      const c = w.addr('sol')
      const v = sol(r.float(0.5, 30))
      const tc = t0 + Math.round(r.float(-20, 6) * DAY)
      w.fundAccount(c, sol(v * r.float(1.4, 3)), 'SOL', tc - Math.round(r.float(1, 10) * DAY))
      w.transfer({ time: tc, from: c, to: orbitAddr, value: v, asset: 'SOL' })
      w.transfer({ time: tc + Math.round(r.float(1, 5) * DAY), from: c, to: w.addr('sol'), value: sol(v * r.float(0.1, 0.3)), asset: 'SOL' })
    }

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const opFromCampaign = usd('SOL', stolenSol * (1 - affPct / 100)) + stolenUsdc * (1 - affPct / 100)
    const opHeld = usdc(w.balanceOf(operator, 'USDC'))
    const opHeldSol = sol(w.balanceOf(operator, 'SOL'))
    const vLoss = usd('SOL', vd.sol) + vd.usdc
    const domain = `${project.name.toLowerCase().replace(/[^a-z]/g, '')}-claim.example`
    const solPrice = ASSETS.SOL.usd.toLocaleString('fr-FR')
    const affName = affEx.entity.name
    const splitUsdcAff = usdc(drains.reduce((s, d) => s + d.split.transfers.filter((x) => x.to === affiliate && x.asset === 'USDC').reduce((a, x) => a + x.value, 0), 0))
    const spendTxt = spend.txs.map((t) => `${amt(t.transfers[0].value, 'USDC')} le ${fmtDate(t.time, false)}`).join(', ')

    return {
      world: w,
      title: `Faux airdrop « ${project.name} » — ${city}`,
      briefing:
        `${victimP.name}, demeurant à ${city}, dépose plainte : en voulant récupérer un airdrop annoncé pour le projet « ${project.name} », ${g('il', 'elle')} a connecté son portefeuille Solana à un site et validé une transaction présentée comme « ${project.claim} ». Quelques secondes plus tard, ses SOL et ses USDC avaient disparu.\n\n` +
        `Le site est un « drainer » : la transaction signée ne réclamait aucun airdrop, elle transférait le contenu du portefeuille. Ces kits sont loués à des « affiliés » qui mènent les campagnes de phishing ; l'opérateur du kit prélève une commission sur chaque vol.\n\n` +
        `Objectifs : identifier l'adresse du drainer et les vraies victimes, comprendre le partage des fonds, repérer l'opérateur du kit et ce qu'il détient encore, puis trier les mouvements du portefeuille de l'affilié, qui a une vie antérieure aux faits, pour retrouver où est parti l'essentiel du butin et quel prestataire peut l'identifier.`,
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
          id: 'osint', type: 'osint', title: 'Note de veille : drainers en location et vente de trafic', date: t0 + 2 * DAY, author: 'Cellule cyber',
          body:
            `Le kit « ${kitName} » est proposé sur des forums et canaux Telegram : l'opérateur fournit le faux site et le code de la transaction piégée, l'affilié apporte le trafic (faux comptes, publicités, messages privés). Chaque vol est partagé automatiquement par une transaction de répartition : l'affilié touche la plus grosse part, l'opérateur sa commission, dont le taux varie selon les affiliés. Un même opérateur perçoit ainsi les commissions de nombreuses campagnes.\n\n` +
            `Les affiliés achètent souvent leur trafic à des revendeurs. Exemple relevé sur un canal : « ${promoName} — packs de visibilité crypto (comptes X vérifiés, réponses automatiques). Paiement USDC sur Solana uniquement, indiquez votre numéro de commande en mémo. »\n\n` +
            `Avant de lancer une campagne, les affiliés vérifient souvent que le kit fonctionne en le faisant signer à un portefeuille qu'ils alimentent eux-mêmes.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : drainers sur Solana', date: t0 + 2 * DAY, author: 'Cellule d\'appui',
          body:
            `• Sur Solana, une seule transaction peut contenir plusieurs instructions : transfert de SOL, transfert de jetons SPL (USDC), voire changement du propriétaire d'un compte de jetons. Signée par la victime, elle est exécutée immédiatement et ne peut pas être annulée.\n` +
            `• Le signataire de la transaction de vol est la victime elle-même : c'est le destinataire des fonds qui désigne le drainer.\n` +
            `• Les transferts peuvent porter un mémo public (instruction Memo).\n` +
            `• Les USDC sont émis par Circle, qui peut geler une adresse sur demande des autorités. Les SOL, actif natif, ne se gèlent pas.\n` +
            `• Un échangeur instantané paie la contrepartie sur la chaîne choisie par le client : si aucun paiement correspondant n'apparaît, la sortie s'est peut-être faite en Monero, invisible ; le hash du dépôt reste réquisitionnable.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: 'Quelle est l\'adresse du drainer, qui reçoit les fonds des victimes ?',
          answer: [drainer],
          hint: 'Ouvrez la transaction citée par la victime : elle en est la signataire, mais le destinataire des transferts est le drainer.',
          explanation: `${A(w, drainer)} reçoit les SOL et les USDC de ${victims.length + 1} portefeuilles, chacun vidé par une transaction signée par son titulaire. Chaque entrée est suivie, quelques secondes plus tard, d'une transaction de répartition : le drainer n'est qu'un réceptacle technique, il ne garde rien.`,
        },
        {
          id: 'o13', type: 'address', points: 10,
          prompt: 'L\'un des portefeuilles vidés par le drainer n\'appartient pas à une victime : l\'affilié l\'a alimenté lui-même pour tester le kit. Lequel ?',
          answer: [testWallet],
          hint: 'Regardez d\'où vient l\'argent de chaque portefeuille vidé, et lequel a été vidé en premier, avant toute victime.',
          explanation: `${A(w, testWallet)} reçoit ${amt(testFund.transfers[0].value, 'SOL')} de ${A(w, affiliate)} le ${fmtDate(testFund.time)}, et signe ${Math.round((test.tx.time - testFund.time) / MIN)} minutes plus tard la transaction piégée : ${amt(testSol, 'SOL')} partent vers le drainer, dont ${affPct} % reviennent aussitôt… à l'adresse qui l'avait alimenté. C'est le tout premier passage par le drainer, plus de ${Math.floor((firstDrain - test.tx.time) / HOUR)} heures avant la première victime, pour un montant dérisoire et sans USDC. Les vraies victimes, elles, ont été alimentées par des retraits d'exchange sans lien avec l'affilié. Ce test est précieux : il prouve que le bénéficiaire de la répartition maîtrise le kit avant la campagne.`,
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles de victimes (plaignant compris, hors test de l\'affilié) ont été vidés par le drainer ?',
          answer: victims.length,
          hint: 'Comptez les expéditeurs distincts des transactions entrantes du drainer, puis retirez le portefeuille de test.',
          explanation: `${victims.length} victimes, vidées entre le ${fmtDate(firstDrain, false)} et le ${fmtDate(Math.max(...drains.map((x) => x.tx.time)), false)} par une transaction « ${project.claim} » signée de leur main. Le portefeuille de test (${A(w, testWallet).slice(0, 10)}…) ne compte pas : alimenté par l'affilié, il n'a rien perdu que l'affilié n'ait récupéré. Toutes les victimes avaient été alimentées par un retrait d'exchange : leurs titulaires sont identifiables par réquisition, pour être informés et entendus.`,
        },
        {
          id: 'o4', type: 'amount', points: 9, unit: 'USD', tolerance: 0.02,
          prompt: 'Quel est le préjudice total de la campagne (en dollars), toutes victimes confondues ?',
          answer: stolenUsd,
          hint: 'Additionnez les SOL et les USDC reçus par le drainer, sans le passage du portefeuille de test.',
          explanation: `${victims.length} victimes : ${amt(stolenSol, 'SOL')} et ${amt(stolenUsdc, 'USDC')}, soit ${usd0(stolenUsd)} au cours de l'exercice (1 SOL = ${solPrice} $). Le test de l'affilié (${amt(testSol, 'SOL')}) n'est pas un préjudice. ${g('Seul', 'Seule')} ${victimP.name} a porté plainte à ce stade.`,
        },
        {
          id: 'o2', type: 'number', points: 8, unit: '%', tolerance: 1,
          prompt: 'Quelle part de chaque vol (en %) revient à l\'affilié ?',
          answer: affPct,
          hint: 'Chaque vol est suivi, quelques secondes plus tard, d\'une transaction de répartition vers deux adresses : rapportez la plus grosse part au total.',
          explanation: `Chaque transaction de répartition envoie ${affPct} % des SOL et des USDC volés à ${A(w, affiliate)} et ${100 - affPct} % à ${A(w, operator)}. Par exemple, pour ${victimP.name} : ${amt(vd.split.transfers[0].value, 'SOL')} contre ${amt(vd.split.transfers[1].value, 'SOL')}.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Quelle adresse reçoit la part de l\'affilié qui a mené la campagne ?',
          answer: [affiliate],
          hint: 'Des deux bénéficiaires de chaque répartition, l\'affilié reçoit la plus grosse part, et uniquement de ce drainer.',
          explanation: `${A(w, affiliate)} reçoit ${affPct} % de chaque vol, et c'est elle qui a alimenté le portefeuille de test. Contrairement au drainer, ce n'est pas une adresse jetable : elle existe depuis le ${fmtDate(hIn1.time, false)}, a été alimentée par des retraits ${affName}, a joué au casino et acheté du trafic. C'est le portefeuille de travail de l'affilié, celui qui mène à une identité.`,
        },
        {
          id: 'o3', type: 'address', points: 9,
          prompt: 'Quelle adresse appartient à l\'opérateur du kit ?',
          answer: [operator],
          hint: 'Des deux bénéficiaires de la répartition, l\'un reçoit aussi des commissions d\'autres drainers.',
          explanation: `${A(w, operator)} reçoit la petite part de chaque vol de la campagne (≈ ${usd0(opFromCampaign)}), mais aussi celle de ${otherDrainers.length} autres adresses de drainer, sans lien avec cette campagne : c'est la signature de l'opérateur du kit, rémunéré par tous ses affiliés. L'autre bénéficiaire ne reçoit de répartitions que de ce drainer : c'est l'affilié.`,
        },
        {
          id: 'o11', type: 'number', points: 7, tolerance: 0, unit: 'drainers',
          prompt: 'Combien d\'autres adresses de drainer, en plus de celle de la campagne, versent une commission à l\'opérateur ?',
          answer: otherDrainers.length,
          hint: 'Listez les transactions entrantes de l\'adresse de l\'opérateur et regroupez-les par expéditeur.',
          explanation: `${otherDrainers.length} autres adresses de drainer (${otherDrainers.map((x) => A(w, x).slice(0, 10) + '…').join(', ')}) versent elles aussi une commission à l'opérateur, avec leur propre taux. Chacune correspond à une autre campagne, donc à d'autres victimes, potentiellement déjà en plainte ailleurs : l'opérateur du kit est le dénominateur commun. Ces adresses sont à signaler et à rapprocher des procédures existantes.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant d\'USDC l\'opérateur du kit détient-il encore, susceptible d\'être gelé par l\'émetteur ?',
          answer: opHeld,
          hint: 'Ouvrez l\'adresse de l\'opérateur : elle reçoit des commissions et ne dépense rien. Son solde en USDC est le montant gelable.',
          explanation: `${A(w, operator)} détient ${amt(opHeld, 'USDC')} (et ${amt(opHeldSol, 'SOL')}), accumulés au fil des commissions de cette campagne et des autres drainers du kit. L'USDC est émis par Circle, qui peut geler une adresse sur demande des autorités ; les SOL ne peuvent pas l'être.`,
        },
        {
          id: 'o5', type: 'entity', points: 8,
          prompt: 'Vers quel service l\'affilié a-t-il envoyé l\'essentiel de ses USDC ?',
          answer: ['changenow'],
          hint: 'Après la conversion de ses SOL en USDC sur Raydium, triez les sorties d\'USDC de l\'affilié par montant.',
          explanation: `L'affilié échange ${amt(swapIn, 'SOL')} contre ${amt(sw.amountOut, 'USDC')} sur Raydium, qui s'ajoutent aux ${amt(splitUsdcAff, 'USDC')} reçus directement des répartitions, puis envoie ${amt(cnValue, 'USDC')} sur une adresse de dépôt ChangeNOW, aussitôt balayée vers le hot wallet de l'échangeur. Aucun paiement de ChangeNOW en contrepartie n'apparaît sur Solana : la commande a été réglée dans un autre actif, vraisemblablement en Monero, et le suivi on-chain s'arrête là. ${procedureFor(cnE)}`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction de l\'affilié faut-il citer dans la réquisition adressée à l\'échangeur ?',
          answer: [cn.depositTx.id],
          hint: 'Écartez la réserve mise de côté, les dépenses courantes et la poussière : seule une sortie arrive sur une adresse de dépôt attribuée à l\'échangeur.',
          explanation: `Le dépôt ${cn.depositTx.hash.slice(0, 16)}… (${amt(cnValue, 'USDC')}, ${fmtDate(cn.depositTx.time)}) est le seul vers une adresse de dépôt ChangeNOW : avec ce hash, l'échangeur retrouve la commande (adresse de destination, horodatages, IP). Les autres sorties ne sont pas la piste : ${amt(coldV, 'USDC')}, montant rond, partent vers ${A(w, cold).slice(0, 10)}…, adresse neuve qui ne bouge plus (réserve, à signaler à Circle pour gel) ; les petits paiements ${shopName} et ${casinoName} (${spendTxt}) sont des dépenses courantes ; les micro-transferts entrants viennent d'adresses sosies de l'affilié (empoisonnement d'adresse) et ne signifient rien. D'autres clients déposent chez ChangeNOW des montants voisins dans la même fenêtre, depuis des adresses sans lien avec l'affilié : seul l'expéditeur compte.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelle mesure conservatoire est la plus rapide sur les fonds encore détenus par les auteurs ?',
          ...choice(r,
            'Demander à Circle le gel des USDC de l\'opérateur et de la réserve de l\'affilié, en transmettant les adresses et les transactions qui fondent la demande',
            [
              'Demander à la fondation Solana de geler les SOL de l\'opérateur',
              'Demander à ChangeNOW d\'annuler la commande pour restituer les USDC aux victimes',
              'Demander à Circle de restituer directement les USDC aux victimes, sans décision judiciaire',
            ]),
          hint: 'Quel acteur peut techniquement bloquer un actif sur une adresse non custodiale ? Pour quel actif ?',
          explanation: `Un émetteur de stablecoin centralisé peut geler les jetons d'une adresse : ici ${amt(opHeld, 'USDC')} chez l'opérateur et ${amt(coldV, 'USDC')} sur la réserve ${A(w, cold).slice(0, 10)}… (plus ${amt(affUsdcLeft, 'USDC')} restés sur l'adresse de l'affilié). Aucun acteur ne gèle un actif natif comme le SOL, et une commande exécutée par un échangeur ne s'annule pas. Le gel préserve les fonds ; leur restitution relève ensuite de la procédure.`,
        },
        {
          id: 'o14', type: 'entity', points: 8,
          prompt: 'Avant la campagne, depuis quelle plateforme le portefeuille de l\'affilié a-t-il été alimenté ?',
          answer: [affKey],
          hint: 'Remontez au tout début de l\'historique de l\'adresse de l\'affilié : ses premières entrées de SOL viennent d\'un hot wallet attribué.',
          explanation: `Avant le test du kit, les seules entrées de SOL de ${A(w, affiliate)} sont deux retraits du hot wallet ${affName} (${amt(hIn1.transfers[0].value, 'SOL')} le ${fmtDate(hIn1.time, false)}, ${amt(hIn2.transfers[0].value, 'SOL')} le ${fmtDate(hIn2.time, false)}). L'affilié a donc alimenté son portefeuille de travail depuis un compte client : ${procedureFor(affEx.entity)} La réquisition vise le titulaire du compte qui a ordonné ces retraits vers cette adresse. C'est la piste d'identification la plus solide du dossier, bien plus que la commande Monero.`,
        },
      ],
      truth: {
        path: [...fundTxs.filter((t) => t.transfers.some((x) => x.to === victim)).map((t) => t.id), vd.tx.id, vd.split.id, ...drains.slice(1).flatMap((d) => [d.tx.id, d.split.id]), sw.tx.id, cn.depositTx.id, cn.sweepTx.id],
        addresses: [drainer, affiliate, operator, testWallet, cold, cn.deposit],
        debrief:
          `1. L'affilié utilise un portefeuille de travail ancien, alimenté par des retraits ${affName} (${fmtDate(hIn1.time, false)}, ${fmtDate(hIn2.time, false)}), qui a déjà joué sur ${casinoName} (${amt(orbitTxs[0].transfers[0].value, 'SOL')}) et échangé un peu de SOL sur Raydium (${amt(hSwap.amountOut, 'USDC')} obtenus).\n` +
          `2. Il achète du trafic au revendeur « ${promoName} » (${amt(promoV, 'USDC')}, mémo « Commande #${orderNo} »), puis le ${fmtDate(testFund.time, false)} teste le kit « ${kitName} » sur un portefeuille qu'il alimente lui-même (${A(w, testWallet)}).\n` +
          `3. Le compte @${promo} relaie le faux airdrop « ${project.name} » (${domain}). ${victims.length} victimes, dont ${victimP.name}, signent la transaction « ${project.claim} » : ${amt(stolenSol, 'SOL')} et ${amt(stolenUsdc, 'USDC')} (${usd0(stolenUsd)}) partent vers le drainer ${A(w, drainer)}.\n` +
          `4. Chaque vol est réparti dans la foulée : ${affPct} % pour l'affilié ${A(w, affiliate)}, ${100 - affPct} % pour l'opérateur ${A(w, operator)}, qui perçoit aussi les commissions de ${otherDrainers.length} autres drainers et conserve ${amt(opHeld, 'USDC')} et ${amt(opHeldSol, 'SOL')}.\n` +
          `5. L'affilié convertit ${amt(swapIn, 'SOL')} en ${amt(sw.amountOut, 'USDC')} sur Raydium, met ${amt(coldV, 'USDC')} de côté sur ${A(w, cold)}, puis envoie ${amt(cnValue, 'USDC')} chez ChangeNOW (dépôt ${cn.depositTx.hash.slice(0, 14)}…) : aucune contrepartie visible, sortie vraisemblable en Monero. Il garde de quoi payer des cartes cadeaux (${shopName}) et le casino ; des sosies de son adresse lui envoient de la poussière.\n\n` +
          `Fausses pistes : le portefeuille de test (alimenté par l'affilié, vidé plus de ${Math.floor((firstDrain - test.tx.time) / HOUR)} heures avant la première victime) n'est pas une victime ; la réserve, les dépenses ${shopName} et ${casinoName}, la poussière des sosies et les dépôts d'autres clients chez ChangeNOW à la même heure ne sont pas la sortie du butin.\n\n` +
          `À retenir : dans un vol par drainer, la victime signe elle-même ; c'est le destinataire qui désigne le drainer, et la répartition révèle l'économie du kit. L'adresse de l'affilié vit au-delà de la campagne : son passé (retraits ${affName}, casino, achat de trafic avec numéro de commande) offre de meilleures pistes d'identification que la sortie en Monero. Leviers : réquisition à ${affName} sur les retraits initiaux, réquisition à ChangeNOW avec le hash du dépôt, gel des USDC de l'opérateur et de la réserve par Circle. Prévention : lire la simulation avant de signer, refuser toute transaction « impossible à simuler », utiliser un portefeuille dédié presque vide.`,
      },
      hints: [
        'Ouvrez la transaction citée par la victime : regardez à qui vont les transferts, pas qui a signé.',
        'Sur l\'adresse du drainer, triez les entrées par date et regardez qui a alimenté chaque portefeuille vidé : le premier a une origine troublante.',
        'Ouvrez les deux bénéficiaires de la répartition et regardez d\'où viennent leurs entrées.',
        'L\'adresse de l\'affilié a un passé : remontez à ses premières entrées.',
        'Après la conversion sur Raydium, une seule sortie de l\'affilié arrive sur une adresse de dépôt attribuée.',
      ],
    }
  },
}
