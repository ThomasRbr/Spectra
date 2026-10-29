import { World, type Tx } from '../engine/world'
import { exchange, swapper, roundCoin, roundUsdAmount, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export const btcDarknetVendor: ScenarioTemplate = {
  id: 'darknet-vendor',
  title: 'Le vendeur d\'Hydra',
  tagline: 'Séquestre darknet, profil PGP, P2P, swap vers Litecoin… et une erreur de KYC.',
  description:
    'Un vendeur de stupéfiants opère sur Hydra Market. À partir d\'un achat sous pseudonyme et de son profil public sur un forum, reconstituez son portefeuille, chiffrez ses revenus de séquestre, suivez ses sorties (P2P, échangeur instantané vers Litecoin, exchange régulé) et bâtissez la stratégie de réquisition.',
  difficulty: 4,
  chains: ['btc', 'ltc'],
  skills: ['osint', 'cioh', 'crosschain', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 45,
  lessons: ['clustering', 'darknet', 'osint', 'chain-hopping', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const handle = fakeHandle(r)
    const city = fakeCity(r)

    const obs = w.entity('hydra')
    const escrow = w.addr('btc', { entity: obs, label: 'Hydra Market — Séquestre', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const vendor = w.customEntity({ name: `Vendeur « ${handle} »`, category: 'suspect' })
    const police = w.customEntity({ name: 'Portefeuille d\'enquête (achat sous pseudonyme)', category: 'individual' })
    const cv = exchange(w, 'coinhouse', 'btc')
    const ls = w.entity('hodlhodl')
    const lsEscrow = w.addr('btc', { entity: ls, label: 'Hodl Hodl — Séquestre multisig', tags: ['liquid'] })
    const swp = swapper(w, 'changenow')
    const MARKET_FEE = 0.04

    // ── Achat sous pseudonyme ────────────────────────────────────────────────
    const policeAddr = w.addr('btc', { entity: police, kind: 'p2wpkh' })
    const buyValue = roundUsdAmount(w, 'BTC', 250, 600)
    cv.withdraw(policeAddr, r8(buyValue + r.float(0.0005, 0.002)), w.at(-27 * 24))
    const obsDeposit = w.addr('btc', { entity: obs, label: 'Hydra Market — Adresse de dépôt', tags: ['deposit'] })
    const buyTx = w.utxoTx({ time: w.at(-25 * 24 + r.float(-6, 6)), from: [policeAddr], to: [{ address: obsDeposit, value: buyValue }] })
    const buySweepT = buyTx.time + r.int(1200, 4 * 3600)

    // ── Libérations de séquestre (vendeur + autres vendeurs), en ordre chronologique ──
    const nRel = r.int(10, 16)
    type Ev = { t: number; kind: 'sweep' | 'vendor' | 'other'; v: number; uc?: boolean }
    const events: Ev[] = [{ t: buySweepT, kind: 'sweep', v: 0 }]
    events.push({ t: buySweepT + r.float(2, 5) * DAY, kind: 'vendor', v: r8(buyValue * (1 - MARKET_FEE)), uc: true })
    for (let i = 1; i < nRel; i++) events.push({ t: w.at(-r.float(5, 70) * 24), kind: 'vendor', v: roundAsset('BTC', fromUsd('BTC', r.float(150, 3200))) })
    for (let i = 0; i < r.int(16, 26); i++) events.push({ t: w.at(-r.float(2, 75) * 24), kind: 'other', v: roundAsset('BTC', fromUsd('BTC', r.float(100, 5000))) })
    events.sort((a, b) => a.t - b.t)
    const releases: { tx: Tx; addr: string; value: number }[] = []
    let ucRelease!: { tx: Tx; addr: string; value: number }
    for (const ev of events) {
      if (ev.kind === 'sweep') {
        forwardAll(w, obsDeposit, escrow, ev.t, undefined, ['sweep'])
        continue
      }
      const to = ev.kind === 'vendor' ? w.addr('btc', { entity: vendor, kind: 'p2wpkh' }) : w.addr('btc')
      const tx = w.utxoTx({ time: Math.round(ev.t), from: [escrow], to: [{ address: to, value: ev.v }], change: escrow, tags: ['escrow-release'], method: 'Libération de séquestre' })
      if (ev.kind === 'vendor') {
        const rel = { tx, addr: to, value: ev.v }
        releases.push(rel)
        if (ev.uc) ucRelease = rel
      }
    }

    // ── Adresse « tips » publiée sur le forum ────────────────────────────────
    const tips = w.addr('btc', { entity: vendor, kind: 'p2wpkh' })
    for (let i = 0; i < r.int(3, 5); i++) w.fund(tips, roundCoin(w, 0.0004, 0.004, 0.00001), w.at(-r.float(80, 220) * 24))

    // ── Regroupements successifs vers l'adresse principale ──────────────────
    // La toute première adresse de libération devient l'adresse principale :
    // chaque regroupement la réutilise en entrée, ce qui soude le cluster.
    const sorted = [...releases].sort((a, b) => a.tx.time - b.tx.time)
    const main = sorted[0].addr
    const cut1 = Math.floor(nRel / 3)
    const cut2 = Math.floor((2 * nRel) / 3)
    const groups = [sorted.slice(1, cut1), sorted.slice(cut1, cut2), sorted.slice(cut2)]
    const consTxs: Tx[] = []
    groups.forEach((g, gi) => {
      const from = [main, ...g.map((x) => x.addr), ...(gi === 1 ? [tips] : [])]
      const t = Math.max(...g.map((x) => x.tx.time), consTxs[consTxs.length - 1]?.time ?? 0) + r.float(6, 48) * HOUR
      const total = from.reduce((s, a) => s + w.unspentValue(a), 0)
      const nIn = from.reduce((s, a) => s + w.utxosOf(a).length, 0)
      const fee = w.estimateFee('btc', nIn, 1)
      consTxs.push(w.utxoTx({ time: t, from: r.shuffle(from), to: [{ address: main, value: r8(total - fee) }], fee, change: null, spendAll: true, method: 'consolidation' }))
    })
    const lastCons = consTxs[consTxs.length - 1]

    // ── Sorties ──────────────────────────────────────────────────────────────
    // 1. Hodl Hodl (vente P2P contre espèces / virement)
    const v2 = w.addr('btc', { entity: vendor, kind: 'p2wpkh' })
    const lsValue = r8(Math.floor(w.unspentValue(main) * r.float(0.15, 0.25) * 1000) / 1000)
    const lsTx = w.utxoTx({ time: lastCons.time + r.float(1, 3) * DAY, from: [main], to: [{ address: lsEscrow, value: lsValue }], change: v2, spendAll: true })
    // 2. ChangeNOW BTC → LTC
    const v3 = w.addr('btc', { entity: vendor, kind: 'p2wpkh' })
    const ltcAddr = w.addr('ltc', { entity: vendor, kind: 'p2wpkh' })
    const swapValue = r8(Math.floor(w.unspentValue(v2) * r.float(0.3, 0.42) * 10000) / 10000)
    // Leurres maîtrisés : autres clients payés en LTC, montants éloignés d'au moins 5 %
    // (créés avant et après la commande pour respecter l'ordre chronologique).
    const ltcHot = swp.hot('ltc')
    const swapT = Math.round(lsTx.time + r.float(1, 3) * DAY)
    const expectUsd = usd('BTC', swapValue) * 0.985
    const decoy = (t: number) => {
      const sign = r.chance(0.5) ? 1 : -1
      const factor = r.chance(0.5) ? 1 + sign * r.float(0.06, 0.3) : r.float(0.05, 3)
      const f = Math.abs(factor - 1) < 0.06 ? 1.3 : factor
      w.utxoTx({ time: t, from: [ltcHot], to: [{ address: w.addr('ltc'), value: roundAsset('LTC', fromUsd('LTC', expectUsd * f)) }], change: ltcHot, tags: ['payout'] })
    }
    for (let i = 0; i < r.int(3, 5); i++) decoy(swapT - r.int(5, 90) * 60)
    const order = swp.order({ from: v2, value: swapValue, time: swapT, toChain: 'ltc', recipient: ltcAddr, change: v3, decoys: 0, delayMin: [8, 40], feePct: r.float(0.006, 0.02) })
    for (let i = 0; i < r.int(4, 7); i++) decoy(swapT + r.int(42, 180) * 60)
    // 3. Coinhouse — l'erreur de KYC
    const v4 = w.addr('btc', { entity: vendor, kind: 'p2wpkh' })
    const cvValue = r8(Math.floor(w.unspentValue(v3) * r.float(0.4, 0.6) * 1000) / 1000)
    const cvRes = cv.receive(v3, cvValue, order.depositTx.time + r.float(2, 5) * DAY, { change: v4 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    cv.noise(14, w.at(-30 * 24), w.at(20 * 24))
    for (let i = 0; i < 8; i++) {
      const u = w.addr('btc')
      w.fund(u, roundCoin(w, 0.01, 0.4, 0.001), w.at(-r.float(10, 40) * 24))
      w.utxoTx({ time: w.at(-r.float(0, 9) * 24), from: [u], to: [{ address: lsEscrow, value: r8(w.unspentValue(u) * r.float(0.4, 0.9)) }] })
    }

    const totalReleased = r8(releases.reduce((s, x) => s + x.value, 0))
    const exposureUsd = usd('BTC', totalReleased)
    const sig = Array.from({ length: 4 }, () => Array.from({ length: 64 }, () => B64[r.int(0, 63)]).join('')).join('\n')
    const fp = Array.from({ length: 10 }, () => r.int(0, 0xffff).toString(16).toUpperCase().padStart(4, '0')).join(' ')

    return {
      world: w,
      title: `Opération Obsidienne — ${city}`,
      briefing:
        `Dans le cadre d'une information judiciaire ouverte à ${city}, la section de recherches enquête sur « ${handle} », vendeur de cocaïne et de MDMA actif sur Hydra Market et livrant par voie postale dans toute la France.\n\n` +
        `Sur Hydra, l'acheteur paie sur une adresse de dépôt de la plateforme ; les fonds restent sur un portefeuille de séquestre (escrow) jusqu'à la confirmation de réception, puis sont libérés au vendeur, moins la commission du marché. Un achat sous pseudonyme a été réalisé, et le vendeur entretient un profil public sur un forum spécialisé.\n\n` +
        `Objectifs : reconstituer le portefeuille du vendeur, chiffrer les libérations de séquestre reçues, suivre ses sorties (y compris vers une autre blockchain) et déterminer la meilleure stratégie de réquisition.`,
      evidence: [
        {
          id: 'forum', type: 'forum', title: `Forum « Le Sous-Sol » — profil vendeur ${handle}`, date: w.at(-40 * 24), author: handle,
          body:
            `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\n` +
            `${handle} — vendeur vérifié Hydra depuis ${r.int(8, 30)} mois.\n` +
            `Expédition France / Belgique sous 24 h, emballage sous vide, double enveloppe.\n` +
            `Litiges : uniquement via le séquestre Hydra.\n` +
            `Pour les pourboires ou les commandes hors marché (clients de confiance) :\n` +
            `BTC : ${A(w, tips)}\n\n` +
            `-----BEGIN PGP SIGNATURE-----\n${sig}\n-----END PGP SIGNATURE-----\n\n` +
            `Empreinte de clé : ${fp}`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'achat sous pseudonyme', date: buyTx.time + 6 * DAY, author: 'Enquêteur sous pseudonyme',
          body:
            `Commande passée auprès de ${handle} sur Hydra Market : 5 g de cocaïne.\n` +
            `Paiement de ${amt(buyValue, 'BTC')} sur l'adresse de dépôt fournie par la plateforme : ${A(w, obsDeposit)}\n` +
            `Transaction : ${buyTx.hash} — ${fmtDate(buyTx.time)}\n` +
            `Colis reçu, réception confirmée sur la plateforme le ${fmtDate(ucRelease.tx.time - r.int(1, 5) * HOUR)} (libération du séquestre au vendeur).\n` +
            `Commission affichée par le marché : ${Math.round(MARKET_FEE * 100)} %.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste — pistes', date: w.at(2 * 24), author: 'Cellule d\'appui',
          body:
            `• Le séquestre d'Hydra est un portefeuille centralisé : il paie tous les vendeurs. On ne remonte pas « de l'achat au vendeur » par la chaîne : il faut un point d'entrée côté vendeur.\n` +
            `• Un vendeur qui publie une adresse sous sa clé PGP s'en attribue la propriété.\n` +
            `• Les échangeurs instantanés ne gardent pas de compte client, mais un dépôt BTC et un paiement sur l'autre chaîne se répondent en montant et en temps.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 15,
          prompt: 'Quelle est l\'adresse principale où le vendeur regroupe ses revenus ?',
          answer: [main],
          hint: 'Partez de l\'adresse « tips » du profil PGP et regardez comment elle est dépensée.',
          explanation: `${A(w, main)} a reçu la première libération de séquestre, puis ${consTxs.length} transactions de regroupement successives où elle se réutilise elle-même en entrée : elles rassemblent toutes les adresses recevant les libérations.`,
        },
        {
          id: 'o2', type: 'amount', points: 20, unit: 'BTC', tolerance: 0.03,
          prompt: 'Montant total (en BTC) des libérations de séquestre Hydra reçues par le portefeuille du vendeur ?',
          answer: totalReleased,
          hint: 'Utilisez le cluster de l\'adresse principale : additionnez ce que chaque adresse a reçu directement du séquestre Hydra.',
          explanation: `${nRel} libérations pour ${amt(totalReleased, 'BTC')} (environ ${Math.round(exposureUsd).toLocaleString('fr-FR')} $). Celle de ${amt(ucRelease.value, 'BTC')} correspond exactement à l'achat sous pseudonyme moins ${Math.round(MARKET_FEE * 100)} % : elle valide le rattachement du cluster au vendeur.`,
        },
        {
          id: 'o3', type: 'entity', points: 15,
          prompt: 'Sur quelle plateforme régulée le vendeur a-t-il commis une erreur de KYC ?',
          answer: ['coinhouse'],
          explanation: `${amt(cvValue, 'BTC')} sont déposés sur une adresse de dépôt Coinhouse, plateforme française agréée qui applique un KYC renforcé : le compte est rattaché à une identité vérifiée.`,
        },
        {
          id: 'o4', type: 'address', points: 20,
          prompt: 'Le vendeur a converti une partie de ses BTC en Litecoin via un échangeur instantané. Quelle adresse LTC a reçu le paiement ?',
          answer: [ltcAddr],
          hint: 'Outil de corrélation : chaîne LTC, émetteur ChangeNOW, à partir de l\'heure du dépôt BTC, montant en USD du dépôt (moins 1 à 2 % de commission).',
          explanation: `Dépôt de ${amt(swapValue, 'BTC')} chez ChangeNOW, puis ${amt(order.payoutValue, 'LTC')} payés quelques minutes plus tard depuis le hot wallet LTC de ChangeNOW vers ${A(w, ltcAddr)}. Les autres paiements de ChangeNOW dans la fenêtre s'écartent de plus de 5 % en valeur. Une réquisition à ChangeNOW, avec le hash du dépôt, permettra de confirmer.`,
        },
        {
          id: 'o5', type: 'choice', points: 15,
          prompt: 'Qu\'est-ce qui permet de rattacher l\'adresse « tips » du forum aux revenus Hydra ?',
          ...choice(r,
            'Elle est co-dépensée avec des adresses de libération de séquestre (entrées communes)',
            [
              'Elle a reçu directement des fonds du portefeuille de séquestre Hydra',
              'Elle utilise le même type d\'adresse (SegWit natif) que le séquestre du marché',
              'La signature PGP prouve à elle seule que ses fonds proviennent d\'Hydra',
            ]),
          explanation: 'La signature PGP rattache l\'adresse au pseudonyme ; l\'heuristique des entrées communes rattache cette adresse aux adresses de libération. La combinaison OSINT + on-chain relie le profil public aux revenus du marché. Le type d\'adresse n\'est pas un indice.',
        },
        {
          id: 'o6', type: 'choice', points: 15,
          prompt: 'Quelle stratégie de réquisition privilégier ?',
          ...choice(r,
            'Requérir d\'abord la plateforme régulée de sortie (KYC, IP, gel), puis swap et P2P',
            [
              'Requérir le marché darknet lui-même pour obtenir l\'identité déclarée du vendeur',
              'Requérir uniquement la plateforme P2P, qui détient le séquestre multisignature',
              'Attendre un nouveau dépôt du vendeur avant toute démarche, pour éviter de l\'alerter',
            ]),
          explanation: `${procedureFor(cv.entity)} KYC renforcé, délais courts, gel possible : c'est la cible prioritaire. ${procedureFor(swp.entity)} ${procedureFor(w.entity('hodlhodl'))} Ces deux services peuvent fournir IP, adresse de destination et contreparties : utiles pour corroborer. Un marché darknet ne répond pas aux réquisitions.`,
        },
      ],
      truth: {
        path: [buyTx.id, ...releases.map((x) => x.tx.id), ...consTxs.map((t) => t.id), lsTx.id, order.depositTx.id, order.payoutTx.id, cvRes.tx.id, ...(cvRes.sweep ? [cvRes.sweep.id] : [])],
        addresses: [tips, main, ...releases.map((x) => x.addr), v2, v3, v4, ltcAddr, cvRes.deposit, order.deposit],
        debrief:
          `1. OSINT : le profil PGP de ${handle} publie l'adresse ${A(w, tips)}.\n` +
          `2. Cette adresse est dépensée lors du 2ᵉ regroupement vers ${A(w, main)} (adresse de la première libération, réutilisée), avec des adresses recevant des libérations du séquestre Hydra : même portefeuille.\n` +
          `3. Trois regroupements successifs (chacun réutilisant l'adresse principale en entrée) soudent le cluster : ${nRel} libérations, ${amt(totalReleased, 'BTC')} au total. La libération de ${amt(ucRelease.value, 'BTC')} du ${fmtDate(ucRelease.tx.time, false)} correspond à l'achat sous pseudonyme (−${Math.round(MARKET_FEE * 100)} %).\n` +
          `4. Sorties : ${amt(lsValue, 'BTC')} vers le séquestre Hodl Hodl (vente P2P), puis ${amt(swapValue, 'BTC')} échangés chez ChangeNOW contre ${amt(order.payoutValue, 'LTC')} reçus sur ${A(w, ltcAddr)}, puis ${amt(cvValue, 'BTC')} déposés chez Coinhouse. Le reliquat reste sur ${A(w, v4)}.\n\n` +
          `Leçon : face à un marché darknet, le point d'entrée est presque toujours côté vendeur (OSINT, adresse publiée, achat sous pseudonyme). Le clustering transforme une adresse en portefeuille complet, et c'est la sortie vers un prestataire régulé — ici français — qui permet l'identification.`,
      },
      hints: [
        'L\'adresse BTC du profil PGP est votre point d\'entrée : ajoutez-la au graphe.',
        'Ouvrez le panneau cluster de l\'adresse de regroupement : il liste les adresses de libération.',
        'Après les regroupements, suivez la grosse sortie de chaque transaction : trois services se succèdent.',
        'Pour la partie Litecoin, utilisez la corrélation avec ChangeNOW comme émetteur, sur la chaîne LTC.',
      ],
    }
  },
}
