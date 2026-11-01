import { World } from '../engine/world'
import { dex, exchange, DAY, HOUR } from '../engine/patterns'
import { failedTx, splitPayment, weth } from '../engine/defi'
import { roundAsset } from '../engine/chains'
import { decoyBranches, dusting, personalSpending, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

const MIN = 60

export const evmSplitterInternes: ScenarioTemplate = {
  id: 'splitter-internes',
  title: 'La rançon partagée',
  tagline: 'Une rançon payée à un contrat non vérifié, redistribuée en transactions internes à trois complices, puis noyée parmi des jumeaux.',
  description:
    'Un cabinet victime d\'un vol de données a payé une rançon en ETH à l\'adresse indiquée par les maîtres chanteurs. Cette adresse est un contrat non vérifié qui redistribue chaque paiement, dans la même transaction, entre trois complices selon des parts fixes. Lisez les transactions internes, le statut d\'une transaction échouée et la création du contrat, puis suivez la part du meneur à travers l\'enveloppe WETH, un swap, des transferts jumeaux et des branches sans issue, jusqu\'à un exchange.',
  difficulty: 3,
  chains: ['eth'],
  skills: ['evm', 'defi', 'tokens', 'dex', 'ransomware', 'exchange_id', 'requisition'],
  estMinutes: 55,
  lessons: ['transactions-internes', 'calldata-selecteurs', 'jetons-enveloppes'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const boss = fakePerson(r)
    const city = fakeCity(r)
    const firm = `Cabinet ${r.pick(['Arnaud & Associés', 'Lemaire Conseil', 'Vasseur Expertise', 'Hautecour Audit', 'Delorme Avocats'])}`
    const gang = r.pick(['Nocturne', 'Basalte', 'Kraal', 'Silence Team', 'Obsidienne'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const uni = dex(w, 'uniswap', 'eth')
    const wk = weth(w, 'eth')
    const ch = exchange(w, 'coinhouse', 'eth')
    const exKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const ex = exchange(w, exKey, 'eth')
    const ex2Key = r.pick((['huobex', 'bitstamp', 'coinbase'] as const))
    const ex2 = exchange(w, ex2Key, 'eth')

    const gangE = w.customEntity({ name: `Groupe d'extorsion « ${gang} » (inconnu)`, category: 'suspect' })
    const C1 = w.addr('eth', { entity: gangE }) // meneur, déployeur du contrat
    const C2 = w.addr('eth', { entity: gangE })
    const C3 = w.addr('eth', { entity: gangE })
    const splitter = w.addr('eth', { entity: gangE, contract: { name: 'Contrat non vérifié', type: 'splitter', verified: false } })
    const victimE = w.customEntity({ name: firm, category: 'victim' })
    const P = w.addr('eth', { entity: victimE })

    const shareSet = r.pick([[0.5, 0.3, 0.2], [0.6, 0.25, 0.15], [0.45, 0.35, 0.2], [0.55, 0.3, 0.15]])
    const shares = [{ to: C1, pct: shareSet[0] }, { to: C2, pct: shareSet[1] }, { to: C3, pct: shareSet[2] }]
    const leadPct = Math.round(shareSet[0] * 100)

    // ── Préparation : gas et déploiement du contrat ──────────────────────────
    w.fundAccount(C1, roundAsset('ETH', r.float(0.2, 0.6)), 'ETH', w.at(-r.float(40, 60) * 24))
    w.fundAccount(C3, roundAsset('ETH', r.float(0.02, 0.06)), 'ETH', w.at(-r.float(20, 35) * 24))
    const deploy = w.multi({ time: w.at(-r.float(28, 36) * 24), signer: C1, legs: [], method: 'Contract Creation', creates: [splitter] })

    // ── Rançons antérieures d'autres victimes ────────────────────────────────
    const earlier = Array.from({ length: r.int(1, 2) }, () => {
      const v = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
      const val = roundAsset('ETH', Math.round(r.float(3, 15) * 2) / 2)
      const t = w.at(-r.float(6, 24) * 24)
      w.fundAccount(v, roundAsset('ETH', val + r.float(0.01, 0.1)), 'ETH', t - r.int(2, 48) * HOUR)
      const tx = splitPayment(w, { from: v, splitter, value: val, time: t, shares })
      tx.tags.push('plain-value')
      return tx
    })

    // ── Tentative prématurée d'un complice ───────────────────────────────────
    const ransom = roundAsset('ETH', Math.round(r.float(4, 14) * 2) / 2)
    const tNote = w.at(-r.float(50, 70))
    const tPay = w.at(0)
    const fail = failedTx(w, {
      signer: C3, to: splitter, time: tPay - r.int(2, 18) * HOUR - r.int(0, 59) * MIN, method: 'release', reason: 'Splitter: nothing to release',
      call: { to: splitter, sig: 'release()', args: [] },
    })

    // ── Paiement de la victime ───────────────────────────────────────────────
    ch.withdraw(P, roundAsset('ETH', ransom + r.float(0.02, 0.08)), tPay - r.int(3, 20) * HOUR)
    const pay = splitPayment(w, { from: P, splitter, value: ransom, time: tPay, shares })
    pay.tags.push('plain-value')
    const partOf = (id: string) => pay.transfers.find((t) => t.to === id)!.value
    const c1Part = partOf(C1)
    const c2Part = partOf(C2)
    const c3Part = partOf(C3)

    // ── Le meneur enveloppe en WETH, vend contre USDC, dépose sur un exchange ─
    const wrapAmt = roundAsset('ETH', w.balanceOf(C1, 'ETH') * r.float(0.75, 0.9))
    const wrapTx = wk.wrap(C1, wrapAmt, tPay + r.float(3, 9) * HOUR)
    const sell = uni.swap({ trader: C1, assetIn: 'WETH', amountIn: wrapAmt, assetOut: 'USDC', time: tPay + r.float(10, 18) * HOUR })
    // Les USDC passent par un relais neuf, entre deux transferts jumeaux du même montant
    const U = w.addr('eth', { entity: gangE })
    const tRelay = Math.round(sell.tx.time + r.float(1, 4) * HOUR)
    const relayTx = w.transfer({ time: tRelay, from: C1, to: U, value: sell.amountOut, asset: 'USDC' })
    const twins = [0, 1].map(() => {
      const v = roundAsset('USDC', sell.amountOut * (1 + r.float(0.0008, 0.004) * r.pick([1, -1])))
      const t = tRelay + r.int(-25, 25) * MIN
      w.fundAccount(C1, v, 'USDC', t - r.int(10, 50) * MIN)
      return w.transfer({ time: t, from: C1, to: w.addr('eth'), value: v, asset: 'USDC' })
    })
    const dep = ex.receive(U, sell.amountOut, tRelay + Math.round(r.float(6, 20) * HOUR), { asset: 'USDC' })

    // ── Les autres complices ─────────────────────────────────────────────────
    const c2Out = roundAsset('ETH', w.balanceOf(C2, 'ETH') * r.float(0.9, 0.98))
    const dep2 = ex2.receive(C2, c2Out, tPay + r.float(5, 30) * HOUR)

    // ── Habillage : vies propres des complices ───────────────────────────────
    const host = w.customEntity({ name: 'Hébergeur « bulletproof » (fictif)', category: 'merchant', known: true, description: 'Hébergeur offshore (fictif) payable en crypto, utilisé pour des sites de fuite de données.' })
    const vpn = w.customEntity({ name: r.pick(['HushLink VPN', 'Tunnelo VPN', 'NoTrace VPN']), category: 'merchant', known: true, description: 'Fournisseur VPN payable en crypto (fictif).' })
    const giftShop = w.customEntity({ name: r.pick(['GiftNova', 'Kadoo Cards', 'VoucherBay']), category: 'merchant', known: true, description: 'Revendeur de cartes cadeaux payables en crypto (fictif). Conserve l\'e-mail de livraison des codes.' })
    const casino = w.customEntity({ name: r.pick(['RoyalHash Casino', 'BetNebula', 'Lucky Satoshi Club']), category: 'gambling', known: true, description: 'Casino en ligne crypto (fictif), vérification d\'identité au-delà d\'un seuil de retrait.' })
    priorHistory(w, C1, { start: w.at(-120 * 24), end: w.at(-62 * 24), nIn: 3, nOut: 2, maxUsd: 1800 })
    // Le meneur paie l'hébergement du blog de fuite (écrit à la main : toujours présent)
    for (const t of [w.at(-r.float(24, 30) * 24), w.at(-r.float(2, 8) * 24)]) w.transfer({ time: t, from: C1, to: w.addr('eth', { entity: host, label: `${host.name} — Paiement` }), value: roundAsset('ETH', r.float(0.01, 0.06)), asset: 'ETH' })
    personalSpending(w, C1, { start: w.at(-30 * 24), end: w.at(6 * 24), n: 2, merchants: [vpn, giftShop], maxUsd: 220 })
    const branches = decoyBranches(w, C1, { time: Math.round(tPay + r.float(26, 40) * HOUR), share: 0.7, branches: 3, returnTo: C1 })
    dusting(w, C1, { time: tRelay + 3 * HOUR, n: 2, spreadH: 4, token: 'USDC' })
    priorHistory(w, C2, { start: w.at(-90 * 24), end: w.at(-35 * 24), nIn: 3, nOut: 2, maxUsd: 1200 })
    personalSpending(w, C2, { start: tPay + 2 * DAY, end: tPay + 6 * DAY, n: 2, merchants: [giftShop, vpn], maxUsd: 120 })
    // Le troisième complice joue une partie de sa part au casino (écrit à la main), plus quelques dépenses
    const bets = Array.from({ length: r.int(2, 3) }, (_, k) => w.transfer({ time: tPay + Math.round(r.float(8 + k * 30, 30 + k * 30) * HOUR), from: C3, to: w.addr('eth', { entity: casino, label: `${casino.name} — Dépôt joueur` }), value: roundAsset('ETH', c3Part * r.float(0.05, 0.12)), asset: 'ETH' }))
    personalSpending(w, C3, { start: tPay + 6 * HOUR, end: tPay + 5 * DAY, n: 2, merchants: [giftShop], maxUsd: 300 })
    dusting(w, C3, { time: tPay + 10 * HOUR, n: 2, spreadH: 8 })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    uni.noise(32, w.at(-4 * 24), w.at(5 * 24), [['ETH', 'USDC'], ['WETH', 'USDC'], ['ETH', 'USDT']])
    for (let i = 0; i < 14; i++) {
      const u = w.addr('eth')
      const v = roundAsset('ETH', r.float(0.2, 25))
      const t = w.at(r.float(-4 * 24, 5 * 24))
      w.fundAccount(u, roundAsset('ETH', v * 1.02), 'ETH', t - r.int(1, 10) * DAY)
      if (r.chance(0.6)) wk.wrap(u, v, t)
      else {
        wk.wrap(u, v, t - r.int(2, 48) * HOUR)
        wk.unwrap(u, v, t)
      }
    }
    ex.noise(16, w.at(-3 * 24), w.at(5 * 24), 'USDC')
    ex2.noise(12, w.at(-3 * 24), w.at(5 * 24), 'ETH')
    ch.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')

    const nPayments = earlier.length + 1
    const branchFate = (b: (typeof branches)[number]) => ({
      dort: 'n\'a plus bougé',
      dépensée: `dépensée en ${b.follow.length} petits paiements`,
      retour: 'revenue sur l\'adresse du meneur',
      éclatée: `ré-éclatée en ${b.follow.length} sous-adresses qui dorment`,
    })[b.fate]
    const nEarlier = earlier.length
    const c2Pct = Math.round((c2Out / [...earlier, pay].reduce((s, t) => s + t.transfers.find((x) => x.to === C2)!.value, 0)) * 100)
    const earlierTxt = nEarlier === 1 ? 'une autre victime paie' : `${nEarlier} autres victimes paient`
    const noteToPayH = Math.round((tPay - tNote) / HOUR)
    const failBeforeH = Math.round((tPay - fail.time) / HOUR)
    const c3Left = roundAsset('ETH', w.balanceOf(C3, 'ETH'))
    const betTotal = roundAsset('ETH', bets.reduce((s, b) => s + b.transfers[0].value, 0))
    const d = (ts: number) => fmtDate(ts)

    return {
      world: w,
      title: `Extorsion « ${gang} » — ${firm}`,
      briefing:
        `Le ${firm}, à ${city}, a constaté l'exfiltration de dossiers clients. Le groupe « ${gang} » a menacé de les publier sauf paiement d'une rançon en ETH. ${noteToPayH} heures après la demande, ${boss.name}, ${boss.g('gérant', 'gérante')}, a payé ${amt(ransom, 'ETH')} à l'adresse indiquée, puis a déposé plainte.\n\n` +
        `L'adresse fournie par le groupe n'est pas un portefeuille ordinaire : c'est un contrat non vérifié. Dans la transaction même du paiement, il redistribue l'ETH entre plusieurs bénéficiaires, en transactions internes. Ces mouvements n'émettent aucun événement et n'apparaissent pas dans la liste « normale » des transactions des bénéficiaires sur un explorateur : seul le détail de la transaction les montre.\n\n` +
        `Objectifs : identifier les bénéficiaires et leurs parts, exploiter la création du contrat et une transaction échouée pour rattacher les complices, puis suivre la part du meneur, enveloppée en WETH et vendue, jusqu'à l'exchange à requérir.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte du représentant légal (extrait)', date: w.at(2 * 24), author: boss.name,
          body:
            `« Nous avons acheté l'ETH sur Coinhouse et l'avons envoyé à l'adresse imposée, depuis le portefeuille du cabinet ${A(w, P)}.\n` +
            `Transaction de paiement : ${pay.hash}\n` +
            `Le groupe a confirmé réception dans l'heure et affirme avoir supprimé les données. Nous n'avons aucune garantie. »`,
        },
        {
          id: 'rancon', type: 'rancon', title: 'Message d\'extorsion reçu par le cabinet', date: tNote, author: `« ${gang} »`,
          body:
            `Your network was compromised. We have 214 GB of your clients files.\n` +
            `Pay ${amt(ransom, 'ETH')} within 72 hours or everything goes public on our blog.\n` +
            `Send ETH ONLY to this address: ${A(w, splitter)}\n` +
            `Do not contact police. Do not try to negotiate the amount.`,
        },
        {
          id: 'incident', type: 'rapport', title: 'Rapport du prestataire de réponse à incident (extrait)', date: w.at(3 * 24), author: 'Prestataire de réponse à incident',
          body:
            `Accès initial par un compte VPN dépourvu d'authentification forte. Exfiltration vers un service de stockage en ligne la nuit précédant la demande.\n\n` +
            `Le groupe « ${gang} » est connu depuis quelques semaines. Nous avons relevé au moins un autre paiement vers la même adresse de rançon. L'adresse est un contrat dont le code n'est pas publié : impossible d'en lire les fonctions directement.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : contrats non vérifiés', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• Un contrat non vérifié n'expose que des sélecteurs de fonction (4 octets) : leur nom ne peut être deviné que par une base de signatures publique, sans garantie.\n` +
            `• Le comportement d'un contrat se déduit de ses transactions : transactions internes, contrats créés, appels échoués.\n` +
            `• Une transaction échouée est minée et payée par son signataire : elle ne déplace aucun fonds, mais elle prouve qu'il a interagi avec le contrat.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 10,
          prompt: 'Quelles adresses reçoivent une part de la rançon payée par le cabinet ?',
          answer: [C1, C2, C3],
          hint: 'Ouvrez la transaction de paiement et lisez la rubrique « Transactions internes » : le contrat y renvoie l\'ETH.',
          explanation: `La transaction ${pay.hash.slice(0, 18)}… envoie ${amt(ransom, 'ETH')} au contrat, qui les redistribue aussitôt en trois CALL internes : ${amt(c1Part, 'ETH')} à ${A(w, C1).slice(0, 12)}…, ${amt(c2Part, 'ETH')} à ${A(w, C2).slice(0, 12)}… et ${amt(c3Part, 'ETH')} à ${A(w, C3).slice(0, 12)}…. Aucun de ces bénéficiaires n'est visible si l'on se contente de la liste des transferts « normaux » du contrat.`,
        },
        {
          id: 'o2', type: 'number', points: 8, unit: '%', tolerance: 0.02,
          prompt: 'Quelle part de chaque paiement (en %) le principal bénéficiaire reçoit-il ?',
          answer: leadPct,
          hint: 'Divisez la plus grosse transaction interne par la valeur envoyée au contrat. Vérifiez sur un autre paiement reçu par le contrat.',
          explanation: `${amt(c1Part, 'ETH')} sur ${amt(ransom, 'ETH')}, soit ${leadPct} %. Tous les paiements reçus par le contrat (${nPayments} : celui du cabinet et ${nEarlier === 1 ? 'celui d\'une autre victime' : `ceux de ${nEarlier} autres victimes`}) suivent exactement la même clé de répartition (${shareSet.map((p) => Math.round(p * 100)).join(' / ')}) : les parts sont inscrites dans le code. Cette répartition fixe trahit l'organisation du groupe et la place de chacun.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: `Combien d'ETH l'adresse ${A(w, C2).slice(0, 10)}… a-t-elle reçus sur la rançon du cabinet ?`,
          answer: c2Part,
          hint: 'C\'est l\'une des transactions internes du paiement du cabinet (pas d\'un paiement antérieur).',
          explanation: `${A(w, C2).slice(0, 12)}… reçoit ${amt(c2Part, 'ETH')} (${Math.round(shareSet[1] * 100)} %). Elle envoie ensuite ${amt(c2Out, 'ETH')} (${c2Pct} % de ce que le contrat lui a versé, ${nEarlier === 1 ? 'rançon précédente' : 'rançons précédentes'} comprise${nEarlier === 1 ? '' : 's'}) vers une adresse de dépôt ${ex2.entity.name} : une seconde réquisition est possible. ${procedureFor(ex2.entity)}`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Sur un explorateur, la page de ces bénéficiaires ne montre pas le paiement du cabinet dans la liste de leurs transactions. Pourquoi ?',
          hint: 'Qui envoie l\'ETH aux bénéficiaires : un compte qui signe une transaction, ou un contrat pendant l\'exécution ?',
          ...choice(r,
            'L\'ETH leur est versé par le contrat en transactions internes : elles figurent dans un onglet distinct, sans événement',
            [
              'Le paiement a échoué : les bénéficiaires n\'ont rien reçu',
              'Les bénéficiaires ont masqué leurs transactions grâce au contrat non vérifié',
              'Les transactions internes ne sont visibles qu\'après le reversement vers un exchange',
            ]),
          explanation: `Seul un compte externe signe une transaction. L'ETH envoyé par un contrat pendant l'exécution (CALL avec valeur) est une transaction interne : elle n'a pas de hash propre, n'émet pas d'événement Transfer (ce n'est pas un jeton) et n'apparaît que dans l'onglet « Internal Txns » de l'explorateur. Un enquêteur qui ne lit que la liste principale conclurait que la rançon dort sur le contrat.`,
        },
        {
          id: 'o5', type: 'tx', points: 10,
          prompt: 'Une transaction adressée au contrat de rançon a échoué. Laquelle ?',
          answer: [fail.id],
          hint: 'Parcourez la liste des transactions du contrat autour du paiement du cabinet : l\'une porte le statut « Échec (reverted) ».',
          explanation: `La transaction ${fail.hash.slice(0, 18)}… (${d(fail.time)}) appelle une fonction inconnue de la base de signatures (sélecteur seul, contrat non vérifié) et échoue avec le motif « Splitter: nothing to release ». Le gas est payé, aucun ETH ne bouge, aucun événement n'est émis.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Qui a signé cette transaction échouée ?',
          answer: [C3],
          hint: 'Le signataire figure en tête du détail de la transaction. Comparez-le aux bénéficiaires de la rançon.',
          explanation: `Le signataire est ${A(w, C3)}, l'un des trois bénéficiaires (${Math.round(shareSet[2] * 100)} %). Une transaction échouée lui est imputable au même titre qu'une transaction réussie : il a signé avec sa clé et payé les frais.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Que révèle cette transaction échouée ?',
          hint: 'Comparez sa date à celle du paiement du cabinet, et lisez le motif d\'échec.',
          ...choice(r,
            'Un complice a tenté de retirer avant que la rançon ne soit payée : il connaissait le contrat et en attendait une part',
            [
              'Le cabinet a d\'abord tenté de payer, sans succès, depuis une autre adresse',
              'La rançon a été remboursée au cabinet après un litige avec le groupe',
              'Un tiers sans lien avec le groupe a tenté d\'exploiter une faille du contrat',
            ]),
          explanation: `L'échec survient le ${d(fail.time)}, avant le paiement du ${d(pay.time)} : le contrat ne détenait alors rien à « libérer ». Le signataire, futur bénéficiaire d'une part, guettait l'arrivée de la rançon. Cette tentative ne déplace aucun fonds mais établit sa connaissance du dispositif : un élément utile pour caractériser sa participation (extorsion en bande organisée, art. 312-6 du Code pénal), au-delà de la simple réception de fonds.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Quel compte a déployé le contrat de rançon ?',
          answer: [C1],
          hint: 'La fiche d\'un contrat indique la transaction qui l\'a créé ; ouvrez-la et regardez son signataire.',
          explanation: `Le contrat a été créé le ${d(deploy.time)} par une transaction signée par ${A(w, C1)}, plusieurs semaines avant les faits. C'est aussi le principal bénéficiaire (${leadPct} %) : le déployeur qui s'attribue la plus grosse part est vraisemblablement le meneur, ou l'opérateur technique du groupe.`,
        },
        {
          id: 'o9', type: 'amount', points: 9, unit: 'WETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le meneur enveloppe-t-il en WETH après le paiement ?',
          answer: wrapAmt,
          hint: 'Parmi ses transactions, cherchez l\'appel deposit() sur le contrat WETH : l\'ETH part vers le contrat et autant de WETH sont créés (événement Deposit).',
          explanation: `Le ${d(wrapTx.time)}, ${A(w, C1).slice(0, 12)}… appelle deposit() sur le contrat WETH avec ${amt(wrapAmt, 'ETH')} : le contrat crée autant de WETH à son profit (création depuis l'adresse nulle, événement Deposit). Envelopper n'est pas blanchir : 1 WETH vaut 1 ETH, au même titulaire, et le lien se lit dans la transaction. Le WETH est un jeton ERC-20, ce qui permet de l'échanger sur des pools jeton/jeton.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'USDC', tolerance: 0.01,
          prompt: 'Combien d\'USDC le meneur obtient-il en vendant ses WETH ?',
          answer: sell.amountOut,
          hint: 'Après l\'enveloppe, un swap jeton contre jeton sur Uniswap : le pool WETH/USDC renvoie des USDC au meneur.',
          explanation: `Le swap ${sell.tx.hash.slice(0, 18)}… cède ${amt(wrapAmt, 'WETH')} au pool USDC/WETH d'Uniswap, qui verse ${amt(sell.amountOut, 'USDC')} au meneur. Le WETH n'a été qu'un intermédiaire : la valeur se suit sans rupture de la rançon jusqu'aux USDC.`,
        },
        {
          id: 'o13', type: 'tx', points: 11,
          prompt: `Après la vente, le meneur envoie trois montants d'environ ${amt(Math.round(sell.amountOut), 'USDC')} à quelques minutes d'intervalle. Quelle transaction est la continuation du produit de la rançon ?`,
          answer: [relayTx.id],
          hint: 'Comparez chaque montant au centime près avec le produit du swap, regardez les entrées qui précèdent chaque envoi, puis suivez les destinataires.',
          explanation: `La transaction ${relayTx.hash.slice(0, 18)}… transfère exactement ${amt(sell.amountOut, 'USDC')}, le produit du swap au centime près, vers ${A(w, U)}, qui les dépose ${Math.round((dep.tx.time - relayTx.time) / HOUR)} h plus tard sur ${ex.entity.name}. Les deux jumeaux (${twins.map((t) => amt(t.transfers[0].value, 'USDC')).join(' et ')}) ne correspondent pas au produit du swap : chacun est précédé, peu avant, d'un apport exactement du même montant venu d'une adresse tierce, et leurs destinataires ne font plus rien. Les ETH restants du meneur sont par ailleurs éclatés en ${branches.length} branches (${branches.map((b) => `${amt(b.value, 'ETH')} : ${branchFate(b)}`).join(' ; ')}) qui n'atteignent aucun service de sortie.`,
        },
        {
          id: 'o11', type: 'entity', points: 9,
          prompt: 'Sur quel exchange les USDC du meneur sont-ils finalement déposés ?',
          answer: [exKey],
          hint: 'Suivez le relais qui reçoit le produit du swap : sa sortie part vers une adresse balayée vers un hot wallet étiqueté.',
          explanation: `Le relais ${A(w, U).slice(0, 12)}… envoie les ${amt(sell.amountOut, 'USDC')} vers une adresse de dépôt de ${ex.entity.name}, balayée ensuite vers le hot wallet. ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o12', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt citer dans la réquisition visant le meneur ?',
          answer: [dep.deposit],
          hint: 'Ce n\'est pas le hot wallet ni le relais : c\'est l\'adresse qui reçoit les USDC du relais avant le balayage.',
          explanation: `${A(w, dep.deposit)} reçoit les USDC le ${d(dep.tx.time)}. Avec le hash ${dep.tx.hash.slice(0, 14)}… et la chaîne complète (rançon → transaction interne → WETH → swap → relais → dépôt), elle permet à ${ex.entity.name} d'identifier le compte crédité et, le cas échéant, d'en geler le solde. Une demande parallèle à Circle n'aurait plus d'objet : les USDC ont quitté les adresses du groupe pour la trésorerie de la plateforme.`,
        },
      ],
      truth: {
        path: [deploy.id, ...earlier.map((t) => t.id), fail.id, pay.id, wrapTx.id, sell.tx.id, relayTx.id, dep2.tx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : [])],
        addresses: [splitter, C1, C2, C3, U, dep.deposit],
        debrief:
          `1. ${A(w, C1)} déploie le contrat de rançon ${A(w, splitter)} (non vérifié) plusieurs semaines avant les faits.\n` +
          `2. Avant le cabinet, ${earlierTxt} déjà ce contrat ; à chaque paiement, il reverse ${shareSet.map((p) => Math.round(p * 100)).join(' / ')} % à trois adresses, en transactions internes.\n` +
          `3. ${failBeforeH} h avant le paiement du cabinet, ${A(w, C3).slice(0, 12)}… tente d'appeler une fonction de retrait : la transaction échoue (« nothing to release »).\n` +
          `4. Le cabinet paie ${amt(ransom, 'ETH')} : ${amt(c1Part, 'ETH')} au meneur, ${amt(c2Part, 'ETH')} et ${amt(c3Part, 'ETH')} aux deux complices.\n` +
          `5. Le meneur enveloppe ${amt(wrapAmt, 'ETH')} en WETH et les vend contre ${amt(sell.amountOut, 'USDC')} sur Uniswap. Il transfère ce montant exact à un relais neuf, ${A(w, U)}, à quelques minutes de deux transferts jumeaux de montant voisin financés par des apports extérieurs arrivés juste avant ; le relais dépose les USDC sur ${ex.entity.name}. Les ETH qui lui restent partent en ${branches.length} branches sans issue.\n` +
          `6. Le deuxième complice dépose ${amt(c2Out, 'ETH')} sur ${ex2.entity.name} ; le troisième en joue une partie sur ${casino.name} (${bets.length} dépôts, ${amt(betTotal, 'ETH')} au total) et garde ${amt(c3Left, 'ETH')} sur son adresse.\n\n` +
          `Habillage à écarter : vie antérieure des adresses (virements reçus, petites dépenses), paiements du meneur à un hébergeur « bulletproof » (piste secondaire : le blog de fuite y est sans doute hébergé), petites dépenses des complices, micro-envois d'adresses sosies (empoisonnement d'adresse).\n\n` +
          `À retenir : un contrat qui reçoit de l'ETH peut le redistribuer en transactions internes, invisibles dans la liste principale des bénéficiaires et dépourvues d'événements : il faut ouvrir le détail de la transaction. Un contrat non vérifié se lit par son comportement (internes, création, échecs). Une transaction échouée ne déplace rien mais engage son signataire. Enfin, l'enveloppe WETH n'interrompt pas le traçage.`,
      },
      hints: [
        'Le paiement du cabinet est dans la plainte : ouvrez son détail, rubrique « Transactions internes ».',
        'Pour les parts, comparez les montants internes à la valeur envoyée, sur plusieurs paiements reçus par le contrat.',
        'La liste des transactions du contrat contient une transaction au statut « Échec » : regardez sa date et son signataire.',
        'La fiche du contrat indique sa transaction de création.',
        'Le meneur appelle deposit() sur le contrat WETH avant de vendre : suivez le jeton obtenu.',
        'Après la vente, trois envois d\'USDC de montant voisin partent du meneur : un seul correspond au centime près au produit du swap, et les autres sont précédés d\'un apport extérieur.',
      ],
    }
  },
}
