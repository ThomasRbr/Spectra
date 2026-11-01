import { World } from '../engine/world'
import { dex, exchange, swapper, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset } from '../engine/chains'
import { decoyBranches, dusting, personalSpending, type Branch } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakeName, fakePerson, fmtDate, procedureFor } from './util'

/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))
/** Même jour que `ts`, à `h` heures pile (heure de Paris). */
const atHour = (ts: number, h: number) => ts - (ts % HOUR) + (h - parisHour(ts)) * HOUR

const FATE: Record<Branch['fate'], string> = {
  dort: 'n\'a plus bougé',
  'dépensée': 'a servi à de petits paiements',
  retour: 'n\'a plus bougé',
  'éclatée': 'a été ré-éclatée en petites sommes',
}

export const accDexSwap: ScenarioTemplate = {
  id: 'dex-swap',
  title: 'Drainer et swaps sur DEX',
  tagline: 'Des ETH volés par un drainer, convertis en stablecoins sur Uniswap : suivez les jambes du swap, et l\'affilié jusqu\'à son hébergeur.',
  description:
    'Un collectionneur de NFT a signé une transaction « Claim » sur un faux site d\'airdrop. Ses ETH ont été aspirés par un contrat drainer, puis convertis en stablecoins sur un DEX avant d\'être envoyés sur un exchange. Apprenez à lire un swap (routeur, pool, jetons reçus), mesurez l\'activité de l\'affilié et du fournisseur du kit, triez les sorties de l\'affilié (branches, poussière, dépenses), suivez chaque jeton jusqu\'à sa destination et retrouvez comment l\'affilié a lancé sa campagne.',
  difficulty: 2,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'dex', 'defi', 'exchange_id', 'requisition'],
  estMinutes: 50,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'typologies', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const omni = dex(w, 'uniswap', 'eth')
    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'okx', 'huobex', 'bitstamp'] as const)
    const dest = exchange(w, destKey, 'eth')
    const sw = swapper(w, 'changenow')
    const hostE = w.customEntity({
      name: 'NordHost', category: 'merchant', known: true, country: 'Islande',
      description: 'Hébergeur web et registraire de noms de domaine offshore (fictif) acceptant les paiements en ETH. Conserve les comptes clients, adresses électroniques, journaux de connexion et factures.',
      compliance: { contact: 'abuse@nordhost.example', cooperation: 'mlat', responseDays: [45, 120], canFreeze: false, kyc: 'faible' },
    })
    const hostAddr = w.addr('eth', { entity: hostE, label: 'NordHost — Paiements' })

    const kitE = w.customEntity({ name: 'Kit de drainage « PhantomClaim »', category: 'scam', description: 'Drainer-as-a-service : le fournisseur prélève une commission sur chaque vol.' })
    const operatorE = w.customEntity({ name: 'Affilié du drainer (inconnu)', category: 'suspect' })
    const drainer = w.addr('eth', { entity: kitE, contract: { name: 'Contrat non vérifié', type: 'exploit' } })
    const kitFee = w.addr('eth', { entity: kitE })
    const operator = w.addr('eth', { entity: operatorE })
    const cold = w.addr('eth', { entity: operatorE })

    // ── Lancement de la campagne par l'affilié ───────────────────────────────
    // Premiers ETH (gaz) obtenus par une commande ChangeNOW, origine hors chaîne
    const seedTx = w.transfer({ time: w.at(-r.float(14, 21) * 24), from: sw.hot('eth'), to: operator, value: roundAsset('ETH', fromUsd('ETH', r.float(380, 700))), asset: 'ETH', method: 'payout' })
    // Nom de domaine puis serveur du faux site, payés chez un hébergeur offshore
    const hostTxs = [
      w.transfer({ time: seedTx.time + Math.round(r.float(3, 30) * HOUR), from: operator, to: hostAddr, value: roundAsset('ETH', fromUsd('ETH', r.float(12, 25))), asset: 'ETH' }),
      w.transfer({ time: seedTx.time + Math.round(r.float(2, 4) * DAY), from: operator, to: hostAddr, value: roundAsset('ETH', fromUsd('ETH', r.float(60, 140))), asset: 'ETH' }),
    ]
    // Autres clients de l'hébergeur : des particuliers qui paient une partie de leur solde
    for (let i = 0; i < r.int(6, 10); i++) {
      const client = w.addr('eth')
      const tC = w.at(r.float(-40, 10) * 24)
      w.fundAccount(client, roundAsset('ETH', fromUsd('ETH', r.float(400, 5000))), 'ETH', tC - r.int(2, 90) * DAY)
      w.transfer({ time: tC, from: client, to: hostAddr, value: roundAsset('ETH', fromUsd('ETH', r.float(10, 300))), asset: 'ETH' })
      w.transfer({ time: tC + r.int(1, 20) * DAY, from: client, to: w.addr('eth'), value: roundAsset('ETH', fromUsd('ETH', r.float(50, 350))), asset: 'ETH' })
    }
    // Autres clients de ChangeNOW autour de la commande
    for (let i = 0; i < r.int(4, 7); i++) w.transfer({ time: seedTx.time + r.int(-6, 6) * HOUR, from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', fromUsd('ETH', r.float(100, 3000))), asset: 'ETH', method: 'payout' })

    // Victime : portefeuille actif depuis longtemps
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const target = roundAsset('ETH', r.float(4, 16))
    cv.withdraw(victim, roundAsset('ETH', target * r.float(0.6, 0.7)), w.at(-r.int(120, 300) * 24))
    cv.withdraw(victim, roundAsset('ETH', target * r.float(0.45, 0.6)), w.at(-r.int(20, 90) * 24))
    omni.swap({ trader: victim, assetIn: 'ETH', amountIn: roundAsset('ETH', r.float(0.05, 0.2)), assetOut: 'USDC', time: w.at(-r.int(5, 15) * 24) })

    // Le drain : la victime signe « Claim » ; le contrat répartit 80 % / 20 %
    const share = r.pick([0.8, 0.8, 0.75, 0.85])
    const drainTx = (from: string, value: number, time: number) => {
      const op = roundAsset('ETH', value * share)
      return w.multi({
        time, signer: from, method: 'Claim',
        legs: [
          { from, to: drainer, value, asset: 'ETH' },
          { from: drainer, to: operator, value: op, asset: 'ETH' },
          { from: drainer, to: kitFee, value: roundAsset('ETH', value - op), asset: 'ETH' },
        ],
      })
    }
    const stolen = Math.floor((w.balanceOf(victim, 'ETH') - 0.004) * 1e6) / 1e6
    const tDrain = drainTx(victim, stolen, w.at(0))
    const leftAfter = roundAsset('ETH', w.balanceOf(victim, 'ETH'))

    // Autres victimes du même affilié
    const others: string[] = []
    const otherVictims: { addr: string; value: number; tx: string; time: number }[] = []
    const v2Name = fakeName(r)
    for (let i = 0; i < r.int(1, 3); i++) {
      const v = w.addr('eth', { entity: w.customEntity({ name: i === 0 ? v2Name : 'Victime non identifiée', category: 'victim' }) })
      const val = roundAsset('ETH', r.float(0.4, 3))
      w.fundAccount(v, roundAsset('ETH', val + r.float(0.01, 0.1)), 'ETH', w.at(-r.int(10, 60) * 24))
      const t = drainTx(v, val, w.at(r.float(-30, 20)))
      others.push(t.id)
      otherVictims.push({ addr: v, value: val, tx: t.hash, time: t.time })
    }
    // Le fournisseur du kit encaisse aussi des commissions d'autres affiliés
    // (deux affiliés concurrents, chacun avec son adresse de réception)
    const rivals = [w.addr('eth'), w.addr('eth')]
    for (let i = 0; i < r.int(5, 8); i++) {
      const v = w.addr('eth')
      const val = roundAsset('ETH', r.float(0.2, 5))
      w.fundAccount(v, roundAsset('ETH', val * 1.02), 'ETH', w.at(-r.int(5, 40) * 24))
      w.multi({
        time: w.at(r.float(-96, 72)), signer: v, method: 'Claim',
        legs: [
          { from: v, to: drainer, value: val, asset: 'ETH' },
          { from: drainer, to: r.pick(rivals), value: roundAsset('ETH', val * share), asset: 'ETH' },
          { from: drainer, to: kitFee, value: roundAsset('ETH', val * (1 - share)), asset: 'ETH' },
        ],
      })
    }
    // Le fournisseur vide périodiquement ses commissions vers un autre portefeuille
    // (montant calculé sur ce qui est effectivement arrivé avant chaque retrait)
    const kitVault = w.addr('eth', { entity: kitE })
    let kitOut = 0
    for (const t of [w.at(r.float(-30, -6)), w.at(r.float(80, 110))]) {
      const inBefore = w.txsOf(kitFee).filter((x) => x.time < t).reduce((a, x) => a + w.flowIn(x, kitFee).reduce((b, f) => b + f.value, 0), 0)
      const v = roundAsset('ETH', (inBefore - kitOut) * r.float(0.5, 0.8))
      if (v <= 0) continue
      w.transfer({ time: t, from: kitFee, to: kitVault, value: v, asset: 'ETH', autoFund: false })
      kitOut += v
    }

    // Swaps de l'affilié : ETH → USDC (deux fois) et ETH → DAI
    const opEth = w.balanceOf(operator, 'ETH')
    const sw1 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.35, 0.45)), assetOut: 'USDC', time: w.at(r.float(22, 26)) })
    const sw2 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.15, 0.25)), assetOut: 'DAI', time: w.at(r.float(27, 30)) })
    const sw3 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.12, 0.2)), assetOut: 'USDC', time: w.at(r.float(31, 34)) })
    const usdcTotal = roundAsset('USDC', sw1.amountOut + sw3.amountOut)

    // DAI → portefeuille froid ; une partie de l'ETH éclatée en branches ; USDC → exchange
    const daiTx = w.transfer({ time: w.at(r.float(34, 36)), from: operator, to: cold, value: w.balanceOf(operator, 'DAI'), asset: 'DAI' })
    const branches = decoyBranches(w, operator, { time: w.at(r.float(36, 39)), share: r.float(0.35, 0.5), branches: 3, asset: 'ETH' })
    const dep = dest.receive(operator, w.balanceOf(operator, 'USDC'), w.at(r.float(41, 48)), { asset: 'USDC' })
    // Poussière d'empoisonnement (sosies de l'adresse) et dépenses courantes après la campagne
    const dust = dusting(w, operator, { time: w.at(30), n: r.int(2, 3), spreadH: 20 })
    const giftE = w.customEntity({ name: 'GiftChain', category: 'merchant', known: true, country: 'Malte', description: "Revendeur en ligne (fictif) de cartes cadeaux et de recharges de jeux vidéo payables en crypto-actifs. Conserve l'adresse e-mail de livraison des codes." })
    const casinoE = w.customEntity({ name: 'Spin Royale', category: 'gambling', known: true, country: 'Curaçao', description: "Casino en ligne (fictif) acceptant l'ETH, KYC déclenché au-delà d'un seuil de retrait." })
    const spend = personalSpending(w, operator, { start: w.at(4 * 24), end: w.at(9 * 24), n: r.int(2, 3), merchants: [giftE, casinoE], maxUsd: 250, asset: 'ETH' })
    const ethKept = roundAsset('ETH', w.balanceOf(operator, 'ETH'))

    // Bruit de fond
    omni.noise(40, w.at(-2 * 24), w.at(4 * 24), [['ETH', 'USDC'], ['ETH', 'DAI'], ['ETH', 'USDT']])
    dest.noise(14, w.at(-2 * 24), w.at(5 * 24), 'USDC')
    dest.noise(8, w.at(-2 * 24), w.at(5 * 24), 'ETH')
    cv.noise(6, w.at(-3 * 24), w.at(3 * 24), 'ETH')

    const handle = fakeHandle(r)
    const kitCut = roundAsset('ETH', stolen - roundAsset('ETH', stolen * share))
    const nAffVictims = others.length + 1
    const daiOut = daiTx.transfers[0].value
    const v2 = otherVictims[0]
    let city2 = fakeCity(r)
    if (city2 === city) city2 = fakeCity(r)
    // Bénéficiaires réels des petites dépenses (commerçant tiré au hasard ou particulier)
    const spendNames = [...new Set(spend.addresses.map((a) => w.ownerOf(a)?.name ?? 'des particuliers'))]
    const dustH = dust.txs.map((t) => Math.round((t.time - tDrain.time) / HOUR))
    const branchTotal = roundAsset('ETH', branches.reduce((x, b) => x + b.value, 0))
    const hostTotal = roundAsset('ETH', hostTxs.reduce((x, t) => x + t.transfers[0].value, 0))
    const domain = r.pick(['holders-airdrop', 'claim-holders', 'airdrop-season2', 'holders-rewards'])

    return {
      world: w,
      title: `Drainer « Claim » — ${city}`,
      briefing:
        `${victimName} (${city}), ${g('collectionneur', 'collectionneuse')} de NFT, a cliqué sur un lien annonçant un « airdrop » réservé aux détenteurs d'une collection. Le site lui a demandé de connecter son portefeuille puis de signer une transaction « Claim ». Quelques secondes plus tard, il ne lui restait que ${amt(leftAfter, 'ETH')}.\n\n` +
        `Les drainers sont des kits vendus « clé en main » : un contrat malveillant aspire les fonds et les répartit entre l'affilié qui a mené la campagne et le fournisseur du kit. Les fonds volés passent souvent par un DEX pour être convertis en stablecoins.\n\n` +
        `Objectifs : identifier l'adresse de l'affilié et celle du fournisseur du kit, mesurer l'ampleur de la campagne de l'affilié, reconstituer ses swaps (actifs et montants obtenus), suivre chaque jeton jusqu'à sa destination, et remonter la préparation de la campagne (financement de départ, hébergement du faux site).`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: atHour(w.at(2 * 24), 10) + 30 * 60, author: victimName,
          body:
            `« J'ai signé une seule transaction, qui s'appelait "Claim". Mon portefeuille affichait "+ 1 200 jetons", je n'ai pas fait attention au montant d'ETH.\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Transaction signée : ${tDrain.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture du faux site d\'airdrop', date: w.at(-0.1),
          body: `hxxps://${domain}[.]example/claim\n🎁 Holders Airdrop — Season 2\nVotre portefeuille est éligible !\n[ Connect Wallet ]  →  [ Claim ]\nRéseau : Ethereum · Frais estimés : 0,002 ETH`,
        },
        {
          id: 'forum', type: 'forum', title: 'Signalement communautaire (forum sécurité Web3)', author: handle, date: w.at(30),
          body:
            `Alerte : drainer actif derrière les faux sites « Holders Airdrop ». Le contrat ${A(w, drainer)} reçoit l'ETH des victimes et le redistribue immédiatement, environ ${Math.round(share * 100)} % / ${Math.round((1 - share) * 100)} %. Ne signez rien.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT sur le faux site', date: atHour(w.at(2 * 24), 16), author: 'Section cyber',
          body:
            `Domaine ${domain}[.]example enregistré le ${fmtDate(hostTxs[0].time, false)} chez NordHost (registraire et hébergeur offshore, paiements en crypto-actifs acceptés). Le site est hébergé sur un serveur du même prestataire, mis en ligne le ${fmtDate(hostTxs[1].time, false)}.\n` +
            `Le code de la page charge le script du kit « PhantomClaim » ; l'adresse du contrat appelé est celle signalée sur les forums. Demande de suspension adressée au prestataire, sans réponse à ce jour.`,
        },
        {
          id: 'rapprochement', type: 'email', title: 'Message d\'un commissariat (plainte similaire)', date: atHour(w.at(3 * 24), 9) + 45 * 60, author: `Commissariat ${de(city2)}`,
          body:
            `Bonjour,\n` +
            `Nous avons reçu la plainte ${de(v2Name)}, victime d'un faux airdrop après avoir signé une transaction « Claim ». Son adresse ${A(w, v2.addr)} a perdu ${amt(v2.value, 'ETH')} le ${fmtDate(v2.time, false)} (transaction ${v2.tx}).\n` +
            `Le mode opératoire semble identique au vôtre. Pouvez-vous nous dire si les fonds aboutissent au même endroit ?\n` +
            `Cordialement`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : stablecoins et gel', date: atHour(w.at(3 * 24), 14), author: 'Cellule d\'appui',
          body:
            `• USDC et USDT sont émis par des sociétés qui peuvent bloquer une adresse sur demande motivée des autorités.\n` +
            `• Le DAI est un stablecoin décentralisé, adossé à des garanties déposées dans des contrats : aucun émetteur ne peut geler une adresse.\n` +
            `• Une fois des jetons déposés sur un exchange, c'est la plateforme qu'on requiert (identité, gel du compte), sur l'adresse de dépôt.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse (EOA) de l\'affilié a reçu la part principale de l\'ETH volé ?',
          answer: [operator],
          hint: 'Ouvrez la transaction « Claim » : elle contient plusieurs transferts internes (jambes). Le contrat redistribue l\'ETH reçu.',
          explanation: `La transaction signée par la victime envoie ${amt(stolen, 'ETH')} au contrat, qui reverse ${Math.round(share * 100)} % à ${A(w, operator)} (l'affilié) et le reste à ${A(w, kitFee)} (commission du fournisseur du kit).`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Que représente la seconde sortie du contrat drainer (la plus petite) ?',
          hint: 'Regardez qui d\'autre envoie des fonds à cette adresse : reçoit-elle une part d\'autres transactions « Claim » ?',
          ...choice(r,
            'La commission du fournisseur du kit (drainer-as-a-service)',
            [
              'Les frais de gas remboursés à la victime par le contrat',
              'Un remboursement automatique prévu par le smart contract',
              'Le dépôt de garantie exigé par Uniswap avant un swap',
            ]),
          explanation: `L'adresse ${A(w, kitFee)} reçoit une commission de chaque vol, y compris d'autres affiliés : c'est une cible prioritaire, car elle relie toutes les campagnes du même kit.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Quelle adresse encaisse la commission du fournisseur du kit de drainage ?',
          answer: [kitFee],
          hint: 'Dans la transaction « Claim » du plaignant, le contrat drainer reverse l\'ETH à deux adresses : prenez celle qui reçoit la plus petite part.',
          explanation: `${A(w, kitFee)} reçoit ${Math.round((1 - share) * 100)} % de chaque vol passé par le contrat, y compris ceux d'autres affiliés (on la retrouve dans d'autres transactions « Claim » dont l'affilié n'est pas bénéficiaire). C'est le portefeuille du fournisseur du drainer-as-a-service : il relie toutes les campagnes du kit et peut être signalé aux plateformes pour bloquer ses dépôts futurs.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le fournisseur du kit a-t-il prélevés sur le vol subi par le plaignant ?',
          answer: kitCut,
          hint: 'C\'est la plus petite des deux jambes sortantes du contrat, dans la transaction signée par le plaignant (pas dans celles des autres victimes).',
          explanation: `Sur ${amt(stolen, 'ETH')} volés, le contrat reverse ${amt(roundAsset('ETH', stolen * share), 'ETH')} à l'affilié et ${amt(kitCut, 'ETH')} au fournisseur. Les deux bénéficiaires sont coauteurs du vol : le préjudice du plaignant se répartit entre eux, ce qu'il faut documenter pour chaque victime.`,
        },
        {
          id: 'o8', type: 'number', points: 9, unit: 'victimes',
          prompt: 'Combien de victimes au total (plaignant compris) ont été drainées au profit de cette même adresse d\'affilié ?',
          answer: nAffVictims,
          hint: 'Comptez les transactions « Claim » dans lesquelles l\'adresse de l\'affilié reçoit une part du contrat drainer. Les autres « Claim » du contrat profitent à d\'autres affiliés.',
          explanation: `L'adresse ${A(w, operator)} reçoit sa part de ${nAffVictims} transactions « Claim », donc de ${nAffVictims} victimes, dont ${v2Name} (plainte déposée à ${city2}). Le contrat drainer, lui, sert aussi à d'autres affiliés, qui touchent leur part sur d'autres adresses : seules les victimes dont la part aboutit chez l'affilié relèvent de cette procédure, les autres justifient un signalement.`,
        },
        {
          id: 'o2', type: 'choice', points: 8,
          prompt: 'En quels actifs l\'affilié a-t-il converti une partie de ses ETH sur Uniswap ?',
          hint: 'Dépliez les flux entrants de l\'affilié : quels jetons lui renvoient les pools Uniswap ?',
          ...choice(r, 'USDC et DAI', ['USDC uniquement', 'USDC et USDT', 'USDC et WBTC']),
          explanation: `Trois swaps : deux ETH → USDC et un ETH → DAI. Dans chaque swap, l'ETH part vers le routeur, qui le transmet au pool ; le pool renvoie le jeton à l'affilié. Attention aux ${dust.txs.length} petits transferts d'USDT reçus entre ${Math.min(...dustH)} et ${Math.max(...dustH)} heures après le vol : ils viennent d'adresses qui imitent celle de l'affilié (mêmes premiers et derniers caractères), pas d'un pool Uniswap. Ce sont des tentatives d'address poisoning visant l'affilié lui-même, sans rapport avec ses conversions.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDC l\'affilié a-t-il obtenu par ses swaps ?',
          answer: usdcTotal,
          hint: 'Il y a deux swaps vers l\'USDC : additionnez les jetons renvoyés par le pool ETH/USDC.',
          explanation: `${amt(sw1.amountOut, 'USDC')} + ${amt(sw3.amountOut, 'USDC')} = ${amt(usdcTotal, 'USDC')}.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme les USDC ont-ils été envoyés ?',
          hint: 'Suivez les sorties d\'USDC de l\'affilié : l\'adresse destinataire est ensuite balayée vers un hot wallet étiqueté.',
          answer: [destKey],
          explanation: `Les ${amt(usdcTotal, 'USDC')} sont déposés sur une adresse de dépôt ${dest.entity.name} puis balayés vers son hot wallet. Les DAI partent vers un autre portefeuille de l'affilié ; ${amt(branchTotal, 'ETH')} sont éclatés vers ${branches.length} adresses neuves (${branches.map((b) => `${A(w, b.address).slice(0, 10)}… ${FATE[b.fate]}`).join(' ; ')}), aucune ne rejoignant une plateforme d'échange ; ${amt(ethKept, 'ETH')} restent sur son adresse. Seule la sortie d'USDC mène à un exchange. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition adressée à cette plateforme ?',
          answer: [dep.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDC de l\'affilié, avant d\'être balayée.',
          explanation: `L'affilié envoie ${amt(usdcTotal, 'USDC')} sur ${A(w, dep.deposit)} le ${fmtDate(dep.tx.time)}, adresse de dépôt propre à un client de ${dest.entity.name}, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte.`,
        },
        {
          id: 'o10', type: 'address', points: 10,
          prompt: 'Vers quelle adresse l\'affilié a-t-il envoyé les jetons obtenus par son swap qui n\'est pas parti vers l\'exchange ?',
          answer: [cold],
          hint: 'Suivez séparément chaque jeton reçu des pools : l\'un d\'eux ne va pas vers une adresse de dépôt, mais vers une adresse sans étiquette.',
          explanation: `Les ${amt(daiOut, 'DAI')} obtenus par le swap ETH → DAI partent vers ${A(w, cold)}, adresse sans étiquette qui ne fait rien d'autre : un portefeuille de stockage de l'affilié. Il faut la placer sous surveillance : si ces DAI rejoignent une plateforme, une réquisition rapide devient possible.`,
        },
        {
          id: 'o12', type: 'entity', points: 9,
          prompt: 'D\'où proviennent les tout premiers ETH de l\'affilié, reçus avant la campagne ?',
          answer: ['changenow'],
          hint: 'Remontez l\'historique de l\'adresse de l\'affilié jusqu\'à son premier flux entrant, deux à trois semaines avant le vol.',
          explanation: `Le ${fmtDate(seedTx.time, false)}, l'adresse de l'affilié reçoit ${amt(seedTx.transfers[0].value, 'ETH')} du portefeuille de paiement de ChangeNOW : c'est le versement d'une commande d'échange (la crypto d'origine a été déposée chez ChangeNOW, éventuellement sur une autre chaîne). Ces ETH paient le gaz et l'hébergement de la campagne. La réquisition à ChangeNOW, avec le hash du versement (${seedTx.hash.slice(0, 18)}…), peut livrer la commande (actif et adresse de dépôt d'origine, adresse IP, horodatage). Les autres versements ChangeNOW des heures voisines vont à d'autres clients : seul celui qui aboutit sur l'adresse de l'affilié compte. ${procedureFor(sw.entity)}`,
        },
        {
          id: 'o13', type: 'entity', points: 9,
          prompt: 'Quel prestataire, payé par l\'affilié avant la campagne, héberge vraisemblablement le faux site ?',
          answer: [hostE.id],
          hint: 'Parmi les premières sorties d\'ETH de l\'affilié, deux paiements partent vers une adresse étiquetée, bien avant le vol. Rapprochez-les de la note OSINT.',
          explanation: `L'affilié paie ${amt(hostTxs[0].transfers[0].value, 'ETH')} puis ${amt(hostTxs[1].transfers[0].value, 'ETH')} (${amt(hostTotal, 'ETH')}) à NordHost, aux dates d'enregistrement du domaine et de mise en ligne du serveur relevées par l'OSINT. Le prestataire détient le compte client (adresse électronique, connexions, factures) : c'est une piste d'identification indépendante des fonds volés. Les petits paiements ultérieurs (${spendNames.join(', ')}) relèvent des dépenses courantes et sont des pistes secondaires. ${procedureFor(hostE)}`,
        },
        {
          id: 'o11', type: 'choice', points: 9,
          prompt: 'Peut-on demander le gel des stablecoins conservés par l\'affilié hors de l\'exchange ?',
          hint: 'Quel est le stablecoin conservé, et existe-t-il une société émettrice capable de bloquer une adresse ?',
          ...choice(r,
            'Non : ce stablecoin est décentralisé, sans émetteur capable de geler ; il faut surveiller l\'adresse et agir si les fonds rejoignent une plateforme',
            [
              'Oui : tout stablecoin adossé au dollar peut être gelé par son émetteur sur demande motivée',
              'Oui : Uniswap peut bloquer les jetons issus de ses pools, puisqu\'il a réalisé le swap',
              'Non : des jetons ERC-20 ne peuvent jamais être bloqués, quel que soit l\'émetteur',
            ]),
          explanation: `Les jetons conservés hors de l'exchange sont des DAI : aucun émetteur centralisé ne peut les bloquer, contrairement à l'USDC ou à l'USDT dont les contrats prévoient une liste noire. Uniswap est un protocole sans opérateur qui puisse intervenir. La parade est la surveillance de ${A(w, cold).slice(0, 12)}… et la réquisition de la plateforme où les fonds aboutiront. Le choix du DAI pour la part « stockée » n'est sans doute pas un hasard.`,
        },
      ],
      truth: {
        path: [tDrain.id, ...others, sw1.tx.id, sw2.tx.id, sw3.tx.id, daiTx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), seedTx.id],
        addresses: [drainer, operator, kitFee, cold, dep.deposit],
        debrief:
          `0. Deux à trois semaines avant, l'affilié reçoit ${amt(seedTx.transfers[0].value, 'ETH')} d'une commande ChangeNOW et paie ${amt(hostTotal, 'ETH')} à NordHost pour le domaine ${domain}[.]example et son serveur.\n` +
          `1. La victime signe « Claim » : ${amt(stolen, 'ETH')} partent vers le contrat drainer ${A(w, drainer)}, qui reverse dans la même transaction ${Math.round(share * 100)} % à l'affilié ${A(w, operator)} et le reste au fournisseur du kit.\n` +
          `2. L'affilié, qui a aussi drainé ${others.length > 1 ? `${others.length} autres victimes` : 'une autre victime'} (dont ${v2Name}), effectue trois swaps sur Uniswap : ETH → ${amt(sw1.amountOut, 'USDC')}, ETH → ${amt(sw2.amountOut, 'DAI')}, ETH → ${amt(sw3.amountOut, 'USDC')}.\n` +
          `3. Il dépose ${amt(usdcTotal, 'USDC')} sur l'adresse de dépôt ${A(w, dep.deposit)} (${dest.entity.name}), envoie les ${amt(daiOut, 'DAI')} vers ${A(w, cold)}, éclate ${amt(branchTotal, 'ETH')} vers ${branches.length} adresses neuves sans issue et garde ${amt(ethKept, 'ETH')}. Les petits USDT reçus ensuite sont de la poussière d'empoisonnement, pas des swaps.\n` +
          `4. Le fournisseur du kit encaisse ${amt(kitCut, 'ETH')} sur le vol du plaignant, et des commissions sur les vols d'autres affiliés, sur ${A(w, kitFee)}.\n\n` +
          `À retenir : un swap DEX n'est pas une rupture de traçage. Le routeur et le pool sont des contrats publics ; la transaction montre l'actif entrant et l'actif sortant, au profit du même trader. Les stablecoins obtenus (USDC, DAI) se suivent comme n'importe quel jeton, et l'USDC est gelable par son émetteur.`,
      },
      hints: [
        'Commencez par la transaction signée par la victime (dans la plainte) et ouvrez son détail : plusieurs transferts y figurent.',
        'Un swap ETH → jeton se lit en trois jambes : trader → routeur (ETH), routeur → pool (ETH), pool → trader (jeton).',
        'Dépliez les flux entrants de l\'affilié pour voir les jetons renvoyés par les pools Uniswap.',
        'Les jetons obtenus ne prennent pas tous le même chemin : suivez chaque jeton séparément.',
        'Pour mesurer l\'activité de l\'affilié, comptez les « Claim » dont il est bénéficiaire, pas toutes les transactions du contrat.',
        'Remontez aussi le passé de l\'affilié : son premier ETH et ses premiers paiements disent comment la campagne a été montée.',
      ],
    }
  },
}
