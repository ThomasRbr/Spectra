import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, HOUR, DAY } from '../engine/patterns'
import { detectCoinjoin } from '../engine/analysis'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import { dusting } from '../engine/realism'
import type { Entity } from '../engine/entities'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const PREMIX_EXTRA = 0.0002
const DUST = 0.00000546
const COMPANIES = ['une mutuelle régionale', 'un réseau d\'agences immobilières', 'une plateforme de location de vacances', 'un club de sport en ligne', 'une enseigne de prêt-à-porter']
/** Même jour, heure de service (8 h–18 h, heure de Paris) : pour les pièces de procédure. */
const office = (ts: number) => Math.floor(ts / DAY) * DAY + 7 * HOUR + (Math.abs(Math.round(ts)) % (9 * HOUR))
const hm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const btcCoinjoinRemix: ScenarioTemplate = {
  id: 'coinjoin-remix',
  title: 'Remix et regroupements',
  tagline: 'Plusieurs tours de CoinJoin, des remix, des regroupements jumeaux… et une seule dépense post-mix qui signe le vendeur.',
  description:
    'Le vendeur d\'une base de données volée fait passer ses gains dans plusieurs tours successifs de CoinJoin (style WabiSabi), en remixant une partie de ses pièces. Il commet ensuite l\'erreur classique : regrouper des sorties de tours différents avec un reliquat non mixé, vers son portefeuille de tous les jours. Mais d\'autres participants regroupent le même montant à la même heure, son portefeuille éclate les fonds en tranches jumelles et en branches sans issue, et ses adresses portent un long historique, de la poussière et des dépenses personnelles. Triez chaque étape jusqu\'à la plateforme de sortie, sans imputer au suspect ce qui ne lui appartient pas… ni surestimer la valeur d\'une empreinte de portefeuille.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['coinjoin', 'cioh', 'change', 'exchange_id', 'requisition'],
  estMinutes: 100,
  lessons: ['coinjoin', 'demixage-avance', 'analyse-comportementale', 'clustering', 'change-heuristics'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const company = r.pick(COMPANIES)

    // Coordinateur fictif (le catalogue décrit zkSNACKs, arrêté en juin 2024)
    const afterZk = w.t0 > 1719792000 // affaire postérieure au 1er juillet 2024
    w.entity('wasabi', {
      name: 'Coordinateur Aube (WabiSabi)',
      description: `Coordinateur CoinJoin (fictif) utilisant le protocole WabiSabi de Wasabi Wallet${afterZk ? ', comme les coordinateurs indépendants qui ont pris le relais de celui de zkSNACKs, arrêté en juin 2024' : ', indépendant de celui de zkSNACKs'} : transactions collaboratives à nombreux participants et sorties de montants standardisés, frais de coordination prélevés dans la transaction. Le coordinateur ne détient pas les fonds.`,
    })
    // Commerces fictifs propres au dossier (vie courante du vendeur)
    const sim = w.customEntity({ name: 'VirtuSIM', category: 'merchant', known: true, risk: 'medium', description: "Location de numéros de téléphone virtuels pour recevoir des SMS de vérification (fictif), payable en crypto-actifs ; conserve l'adresse électronique du compte et l'historique des numéros loués." })
    const giftorama = w.customEntity({ name: 'Giftorama', category: 'merchant', known: true, risk: 'medium', description: 'Vente de cartes cadeaux contre crypto-actifs (fictif) ; livraison des codes par courriel.' })
    const royalspin = w.customEntity({ name: 'RoyalSpin', category: 'gambling', known: true, risk: 'medium', description: "Casino en ligne crypto (fictif), sans vérification d'identité sous un certain seuil de retrait." })
    const exKey = r.pick(['kraken', 'bitstamp', 'binance', 'okx', 'coinbase'] as const)
    const ex = exchange(w, exKey, 'btc')
    // Plateforme régulée d'où un acheteur paie directement (piste « recel »)
    const buyerKey = r.pick((['coinhouse', 'swissborg', 'bitstamp'] as const).filter((x) => x !== exKey))
    const buyerEx = exchange(w, buyerKey, 'btc')
    const hodl = w.entity('hodlhodl')
    const hodlEscrow = () => w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig (transaction)', kind: 'p2wsh' })
    const forumName = r.pick(['BreachZone', 'LeakMarket', 'DataBazar', 'NullDump'])
    const forumE = w.customEntity({ name: `Forum « ${forumName} »`, category: 'darknet', known: true, description: 'Forum cybercriminel (fictif) de revente de bases de données ; facture la mise en avant des annonces en bitcoins.', country: 'Inconnu' })
    const forumFeeAddr = w.addr('btc', { entity: forumE, label: `${forumE.name} — Paiement des options d'annonce`, kind: 'p2wpkh', tags: ['liquid'] })
    const suspect = w.customEntity({ name: `@${handle} (vendeur, non identifié)`, category: 'suspect' })
    const mine = () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const fpKey = (id: string) => {
      const p = w.walletProfile(id)
      return `${p.version}|${p.locktime}|${p.rbf}`
    }
    // Vide des adresses vers une seule sortie ; les frais absorbent l'arrondi (jamais de déficit)
    const sendAll = (from: string[], to: string, time: number, value?: number) => {
      const total = from.reduce((s, a) => s + w.unspentValue(a, time), 0)
      const n = from.reduce((s, a) => s + w.utxosOf(a, time).length, 0)
      const v = value ?? r8(total - w.estimateFee('btc', Math.max(1, n), 1))
      return w.utxoTx({ time, from, to: [{ address: to, value: v }], fee: total - v, change: null, spendAll: true })
    }
    // Dépenses personnelles créées dans l'ordre chronologique, sur les seuls fonds
    // présents (personalSpending tire ses dates dans le désordre et peut alors
    // réalimenter l'adresse par une entrée parasite).
    const spendSorted = (addr: string, start: number, end: number, n: number, merchants: (string | Entity)[], maxUsd: number): Tx[] => {
      const times = Array.from({ length: n }, () => Math.round(r.float(start, end))).sort((a, b) => a - b)
      const out: Tx[] = []
      for (const tt of times) {
        const m0 = r.pick(merchants)
        const shop = r.chance(0.8) ? (typeof m0 === 'string' ? w.entity(m0) : m0) : undefined
        const v = roundAsset('BTC', fromUsd('BTC', r.float(15, Math.max(20, maxUsd))))
        if (w.unspentValue(addr, tt) < v + 0.0002) continue
        out.push(w.utxoTx({ time: tt, from: [addr], to: [{ address: w.addr('btc', { entity: shop, label: shop ? `${shop.name} — Paiement` : undefined }), value: v }], change: addr }))
      }
      return out
    }
    /** Destinataires (commerces nommés, sinon « des particuliers ») d'une liste de paiements. */
    const payees = (txs: Tx[], self: string) => {
      const names = [...new Set(txs.flatMap((x) => x.outputs.filter((o) => o.address !== self).map((o) => `à ${w.ownerOf(o.address)?.name ?? 'des particuliers'}`)))]
      return names.length ? names.join(', ').replace(/, ([^,]+)$/, ' et $1') : 'aucun paiement'
    }
    const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

    // ════════════════════════════════════════════════════════════════════════
    // 1. FLUX RÉEL (construit d'abord : l'habillage vient ensuite)
    // ════════════════════════════════════════════════════════════════════════

    // ── Ventes de la base de données : paiements des acheteurs ───────────────
    const denom = r.pick([0.01, 0.02, 0.05] as const)
    const m = r.int(4, 5)
    const R = mine()
    const suspectKey = fpKey(R)
    const nB = r.int(5, 8)
    const target = m * (denom + PREMIX_EXTRA) * r.float(1.25, 1.6)
    const parts = r.split(target, nB, 0.5)
    const sales: Tx[] = []
    let t = w.at(0)
    const kycIdx = r.int(0, nB - 1)
    for (const [i, v] of parts.entries()) {
      const value = roundAsset('BTC', Math.max(0.0015, v))
      // L'un des acheteurs paie par un retrait direct depuis son compte sur une plateforme régulée
      sales.push(i === kycIdx ? buyerEx.withdraw(R, value, t) : w.fund(R, value, t))
      t += Math.round(r.float(6, 40) * HOUR)
    }
    const saleValue = (x: Tx) => x.outputs.find((o) => o.address === R)!.value
    const totalSales = r8(sales.reduce((s, x) => s + saleValue(x), 0))
    const avgPrice = r8(totalSales / nB)

    // ── Préparation : option du forum, puis découpage en pièces + reliquat ───
    const forumFee = roundAsset('BTC', fromUsd('BTC', r.pick([49, 79, 99, 149])))
    const feeTx = w.utxoTx({ time: t + Math.round(r.float(0.5, 3) * HOUR), from: [R], to: [{ address: forumFeeAddr, value: forumFee }], change: R })
    const tPre = feeTx.time + Math.round(r.float(4, 30) * HOUR)
    const premix = Array.from({ length: m }, () => mine())
    const L = mine()
    const preTx = w.utxoTx({ time: tPre, from: [R], to: premix.map((a) => ({ address: a, value: r8(denom + PREMIX_EXTRA) })), change: L, spendAll: true })
    const leftoverValue = preTx.outputs.find((o) => o.address === L)!.value

    // ── Tours de CoinJoin, avec remix partiel ────────────────────────────────
    const nRounds = r.pick([2, 3, 3] as const)
    const cjs: Tx[] = []
    const behind: string[] = [] // sorties mixées non remixées
    let coins = premix
    let finals: string[] = []
    let tc = tPre + Math.round(r.float(1, 6) * HOUR)
    for (let k = 0; k < nRounds; k++) {
      const extra = r.int(9, 14)
      const res = coinjoin(w, { chain: 'btc', time: tc, denom, participants: coins.map((c) => ({ from: c, changeTo: null })), extra, coordinatorFee: r8(0.00001 * extra) })
      cjs.push(res.tx)
      const mixed = r.shuffle([...res.mixed])
      if (k === nRounds - 1) finals = mixed
      else {
        const keep = Math.max(2, mixed.length - r.int(1, 2))
        coins = mixed.slice(0, keep)
        behind.push(...mixed.slice(keep))
      }
      tc = res.tx.time + Math.round(r.float(3, 30) * HOUR)
    }
    const lastCj = cjs[cjs.length - 1]
    const unspentFinal = finals.length >= 3 ? finals[0] : undefined
    const finalsUsed = unspentFinal ? finals.slice(1) : finals
    const merged = [...behind, ...finalsUsed]
    const suspectMixed = new Set(cjs.flatMap((cj) => cj.outputs.map((o) => o.address)).filter((a) => w.get(a).entityId === suspect.id))

    // ── L'erreur : regroupement de sorties de tours différents + reliquat ────
    // vers V, le portefeuille « de tous les jours » du vendeur (adresse réutilisée)
    const V = mine()
    const inputs = r.shuffle([...merged, L])
    const tCons = lastCj.time + Math.round(r.float(10, 60) * HOUR)
    const consTx = sendAll(inputs, V, tCons)
    const consOut = consTx.outputs[0].value

    // ── Éclatement depuis V : trois branches et trois tranches jumelles ──────
    // Toutes les dépenses de V sont créées dans l'ordre chronologique : chacune
    // part du rendu de la précédente.
    const tSplit = tCons + Math.round(r.float(5, 20) * HOUR)
    const X = Math.max(0.002, Math.floor(consOut * r.float(0.17, 0.21) * 1000) / 1000)
    const H = mine() // adresse intermédiaire habituelle vers la plateforme
    const T1 = mine() // tranche mise de côté (dort)
    const T2 = mine() // tranche vendue en P2P
    const B1 = mine() // branche dépensée (casino, cartes cadeaux)
    const B2 = mine() // branche ré-éclatée en petites adresses
    const B3 = mine() // branche qui revient sur V
    const tTr = tSplit + Math.round(r.float(50, 110) * 60)
    type Spend = { key: string; to: string; value: number; time: number }
    const spends: Spend[] = [
      { key: 'B1', to: B1, value: r8(Math.floor(consOut * r.float(0.05, 0.09) * 1e5) / 1e5), time: tSplit + r.int(0, 12) * 60 },
      { key: 'B2', to: B2, value: r8(Math.floor(consOut * r.float(0.06, 0.1) * 1e5) / 1e5), time: tSplit + r.int(15, 35) * 60 },
      { key: 'B3', to: B3, value: r8(Math.floor(consOut * r.float(0.04, 0.08) * 1e5) / 1e5), time: tSplit + r.int(38, 48) * 60 },
      { key: 'H', to: H, value: X, time: tTr },
      { key: 'T1', to: T1, value: r8(X * (1 + r.float(-0.003, 0.003))), time: tTr + r.pick([-1, 1]) * r.int(4, 22) * 60 },
      { key: 'T2', to: T2, value: r8(X * (1 + r.float(-0.003, 0.003))), time: tTr + r.pick([-1, 1]) * r.int(4, 22) * 60 },
    ]
    // Horodatages distincts (au moins deux minutes d'écart) pour lever toute ambiguïté
    spends.sort((a, b) => a.time - b.time)
    for (let i = 1; i < spends.length; i++) if (spends[i].time - spends[i - 1].time < 120) spends[i].time = spends[i - 1].time + 120 + r.int(0, 180)
    const vTx: Record<string, Tx> = {}
    for (const s of spends) vTx[s.key] = w.utxoTx({ time: s.time, from: [V], to: [{ address: s.to, value: s.value }], change: V })
    const trTx = vTx.H
    const tw2 = vTx.T2

    // ── H → adresse de dépôt de la plateforme (durable, déjà utilisée) ───────
    const D = ex.newDeposit()
    const tDep = trTx.time + Math.round(r.float(4, 18) * HOUR)
    const depTx = sendAll([H], D, tDep)
    const depValue = depTx.outputs[0].value
    const sweep = ex.sweep([D], tDep + Math.round(r.float(0.5, 5) * HOUR))[0]

    // ════════════════════════════════════════════════════════════════════════
    // 2. FAUSSES PISTES
    // ════════════════════════════════════════════════════════════════════════

    const isDenom = (v: number) => Math.abs(v - denom) < 1e-9
    const strangersOf = (cj: Tx) => cj.outputs.filter((o) => isDenom(o.value) && !suspectMixed.has(o.address) && !w.spender(cj.id, o.n)).map((o) => o.address)
    const lastStrangers = r.shuffle(strangersOf(lastCj))
    const changeOf = (cj: Tx, mixedAddr: string) => cj.outputs.find((o) => !isDenom(o.value) && o.address !== mixedAddr && w.get(o.address).wallet === w.get(mixedAddr).wallet && !w.spender(cj.id, o.n))

    // a) Faux positif : deux sorties de participants différents regroupées, logiciel de même empreinte que le suspect
    const fpPair = lastStrangers.splice(0, 2)
    let kk = 0
    while (fpKey(fpPair[0]) !== suspectKey) w.get(fpPair[0]).wallet = `fp-${fpPair[0]}-${++kk}`
    const fpTx = sendAll(fpPair, w.addr('btc'), lastCj.time + Math.round(r.float(3, 40) * HOUR))

    // b) Regroupements jumeaux : deux autres participants du dernier tour regroupent, à
    //    quelques minutes du vendeur, leur sortie mixée, leur propre rendu du tour et
    //    une pièce extérieure, pour le même montant (±0,3 %), vers une adresse neuve.
    const twinCons: { tx: Tx; mixed: string; change: string; ext: string; to: string }[] = []
    for (const a of [...lastStrangers]) {
      if (twinCons.length >= 2) break
      const ch = changeOf(lastCj, a)
      if (!ch) continue
      const fee = w.estimateFee('btc', 3, 1)
      const out = r8(consOut * (1 + r.float(-0.003, 0.003)))
      const extVal = r8(out + fee - denom - ch.value)
      if (extVal < 0.0005) continue
      lastStrangers.splice(lastStrangers.indexOf(a), 1)
      let wid = `twin-${a}`
      let n = 0
      w.get(a).wallet = wid
      while (fpKey(a) === suspectKey) w.get(a).wallet = wid = `twin-${a}-${++n}`
      w.get(ch.address).wallet = wid
      const ext = w.addr('btc', { kind: 'p2wpkh', wallet: wid })
      const tt = tCons + r.pick([-1, 1]) * r.int(6, 40) * 60
      w.fund(ext, extVal, tt - Math.round(r.float(2, 30) * DAY))
      const to = w.addr('btc', { kind: 'p2wpkh', wallet: wid })
      const tx = sendAll(r.shuffle([a, ch.address, ext]), to, tt, out)
      twinCons.push({ tx, mixed: a, change: ch.address, ext, to })
    }
    if (twinCons.length < 2) throw new Error('coinjoin-remix : regroupements jumeaux insuffisants')

    // c) Dépenses post-mix ordinaires des autres participants
    for (const cj of cjs) {
      const pool = cj === lastCj ? lastStrangers : strangersOf(cj)
      for (const a of pool) {
        if (!r.chance(0.55)) continue
        w.utxoTx({ time: cj.time + Math.round(r.float(2, 90) * HOUR), from: [a], to: [{ address: w.addr('btc'), value: r8(denom * r.float(0.3, 0.8)) }] })
      }
    }

    // d) Devenir des branches et des tranches jumelles
    const later = (h0: number, h1: number) => Math.round(r.float(h0, h1) * HOUR)
    // B1 : dépensée en jeux et cartes cadeaux
    const b1Pays = spendSorted(B1, vTx.B1.time + later(6, 30), vTx.B1.time + 5 * DAY, 3, [royalspin, giftorama], Math.min(250, usd('BTC', spends.find((s) => s.key === 'B1')!.value) * 0.28))
    // B2 : ré-éclatée en petites adresses qui dorment
    const b2Val = spends.find((s) => s.key === 'B2')!.value
    const tB2 = vTx.B2.time + later(10, 30)
    for (let k = 0; k < 3; k++) {
      w.utxoTx({ time: tB2 + k * 1500, from: [B2], to: [{ address: w.addr('btc', { kind: 'p2wpkh' }), value: r8(Math.floor((b2Val / 4) * 1e5) / 1e5) }], change: B2 })
    }
    // B3 : revient sur V quelques jours plus tard
    const tB3 = vTx.B3.time + later(60, 130)
    sendAll([B3], V, tB3)
    // T1 : jamais dépensée (épargne). T2 : vendue sur Hodl Hodl.
    const t2Esc = hodlEscrow()
    const tT2 = tw2.time + later(30, 70)
    const t2Sale = sendAll([T2], t2Esc, tT2)

    // ════════════════════════════════════════════════════════════════════════
    // 3. HABILLAGE DES PORTEFEUILLES DU VENDEUR (après le flux)
    // ════════════════════════════════════════════════════════════════════════
    const tAnn = w.at(-r.float(3, 10) * 24) // mise en ligne de l'annonce

    // R (adresse de l'annonce) : achats P2P antérieurs, dépenses antérieures,
    // acheteurs tardifs, dépenses personnelles, poussière
    const nP2p = r.int(2, 3)
    const p2pIn: Tx[] = []
    for (let k = 0; k < nP2p; k++) {
      const te = w.at(-r.float(40, 160) * 24)
      const esc = hodlEscrow()
      const v = roundAsset('BTC', fromUsd('BTC', r.pick([150, 200, 250, 300, 400])))
      w.fund(esc, r8(v + 0.00003), te - Math.round(r.float(1, 6) * HOUR))
      p2pIn.push(sendAll([esc], R, te, v))
    }
    const rPays = spendSorted(R, Math.min(...p2pIn.map((x) => x.time)) + DAY, tAnn - DAY, 2, ['mullvad', sim], 90)
    const nLate = r.int(1, 2)
    const lateSales: Tx[] = []
    let tl = tPre + later(12, 40)
    for (let k = 0; k < nLate; k++) {
      lateSales.push(w.fund(R, roundAsset('BTC', avgPrice * r.float(0.8, 1.2)), tl))
      tl += later(10, 36)
    }
    rPays.push(...spendSorted(R, tl + HOUR, tl + 6 * DAY, 2, ['mullvad', sim, giftorama], 120))
    dusting(w, R, { time: tCons, n: 2, spreadH: 60 })

    // V (portefeuille de tous les jours) : entrées antérieures, vie courante,
    // anciens passages par H vers la même adresse de dépôt, dépenses après les faits
    const nPrior = 3
    const tPriorBase = w.at(-r.float(170, 200) * 24)
    const vFunds: Tx[] = []
    for (let k = 0; k < nPrior; k++) {
      const tf = tPriorBase + k * 45 * DAY + later(-120, 120)
      const vIn = roundAsset('BTC', fromUsd('BTC', r.float(900, 2600)))
      vFunds.push(w.fund(V, vIn, tf))
      // Passage habituel : V → H → adresse de dépôt de la plateforme
      const tv = tf + later(24, 120)
      const hv = r8(Math.floor(vIn * r.float(0.5, 0.75) * 1e4) / 1e4)
      w.utxoTx({ time: tv, from: [V], to: [{ address: H, value: hv }], change: V })
      const td = tv + later(3, 20)
      sendAll([H], D, td)
      ex.sweep([D], td + later(0.5, 6))
    }
    spendSorted(V, vFunds[0].time + DAY, tCons - 2 * DAY, 3, [royalspin, giftorama, sim], 160)
    spendSorted(V, tB3 + HOUR, tB3 + 8 * DAY, 2, [royalspin, giftorama], 200)
    dusting(w, V, { time: tCons + 2 * DAY, n: 1, spreadH: 24 })
    dusting(w, H, { time: tDep + DAY, n: 1, spreadH: 20 })

    ex.noise(16, w.at(-160 * 24), tDep + 6 * DAY)

    // ════════════════════════════════════════════════════════════════════════
    // 4. RÉPONSES (calculées sur le monde final)
    // ════════════════════════════════════════════════════════════════════════
    const fromRound = (a: string) => cjs.findIndex((cj) => cj.outputs.some((o) => o.address === a)) + 1
    const roundsInCons = [...new Set(merged.map(fromRound))].sort()
    const eq = detectCoinjoin(cjs[0]).equalCount ?? 0
    const tPost = Math.round(r.float(tDep + 3 * DAY, tDep + 12 * DAY))
    const nBuyers = nB + nLate
    const p2pD = [...new Set(p2pIn.map((x) => x.time).sort((a, b) => a - b).map((x) => fmtDate(x, false)))]
    const p2pSpan = p2pD.length === 1 ? `le ${p2pD[0]}` : `entre le ${p2pD[0]} et le ${p2pD[p2pD.length - 1]}`
    // Contrôle de cohérence : entrées de R par catégorie
    const rTxs = w.txsOf(R)
    const rIn = rTxs.filter((x) => x.outputs.some((o) => o.address === R) && !x.inputs.some((i) => i.address === R))
    const rDustCount = rIn.filter((x) => x.outputs.find((o) => o.address === R)!.value <= DUST + 1e-12).length
    const rSelfChange = rTxs.filter((x) => x.inputs.some((i) => i.address === R) && x.outputs.some((o) => o.address === R)).length
    if (rIn.length !== nBuyers + nP2p + rDustCount) throw new Error(`coinjoin-remix : entrées de l'adresse de l'annonce incohérentes (${rIn.length})`)
    const depCount = w.txsOf(D).filter((x) => x.outputs.some((o) => o.address === D)).length
    const descr: Record<string, string> = {
      B1: `dépensée en ${pl(b1Pays.length, 'paiement', 'paiements')} dans les jours suivants, ${payees(b1Pays, B1)}`,
      B2: 'ré-éclatée en trois petites adresses qui dorment',
      B3: `revient intégralement sur ${A(w, V)} quelques jours plus tard`,
      T1: 'jamais dépensée (épargne mise de côté)',
      T2: `vidée vers un séquestre Hodl Hodl (vente de pair à pair) le ${fmtDate(t2Sale.time)}`,
      H: `relayée ${Math.round((tDep - trTx.time) / HOUR)} h plus tard vers l'adresse de dépôt ${ex.entity.name}`,
    }
    const vList = spends.map((s) => `${hm(s.time)} : ${btc(s.value)} vers ${A(w, s.to)}, ${descr[s.key]}`).join(' ; ')

    return {
      world: w,
      title: `Base de données volée et CoinJoin — ${city}`,
      briefing:
        `Les données personnelles de plusieurs centaines de milliers de clients d'${company} (${city}) sont mises en vente sur un forum cybercriminel par @${handle}. Les acheteurs paient en bitcoins sur une adresse indiquée dans l'annonce, que le vendeur utilise depuis longtemps.\n\n` +
        `Le vendeur a ensuite fait passer ses gains par un coordinateur CoinJoin de type WabiSabi, en plusieurs tours, et en remixant une partie des pièces obtenues. À première vue, la piste s'arrête là.\n\n` +
        `Retrouvez les CoinJoin traversés, la dépense post-mix qui trahit le vendeur, les sorties mixées qu'elle lui rattache, puis suivez les fonds jusqu'à la plateforme de sortie. À chaque étape, plusieurs candidats se ressemblent : d'autres participants regroupent le même montant à la même heure, le portefeuille du vendeur éclate les fonds en tranches identiques et en branches sans issue, et ses adresses ont une vie propre (achats antérieurs, dépenses personnelles, poussière). Écartez chaque leurre par un raisonnement que vous pourrez écrire au rapport.`,
      evidence: [
        {
          id: 'forum', type: 'forum', title: 'Annonce sur le forum (capture)', date: tAnn, author: `@${handle}`,
          body:
            `[VENTE] Base clients ${company.replace(/^une? /, '')} — FR — ${r.int(180, 650)} k lignes (nom, adresse, téléphone, IBAN partiel)\n` +
            `Échantillon de 1 000 lignes en lien. Prix : ${btc(avgPrice)} environ par acheteur, réduction pour revendeurs.\n` +
            `Paiement BTC uniquement : ${A(w, R)}\n` +
            `Livraison du fichier après une confirmation.\n` +
            `[Annonce mise en avant — option payante du forum ${forumName}]`,
        },
        {
          id: 'chat', type: 'forum', title: `Messagerie du forum — échange entre @${handle} et un acheteur (capture remise par l'acheteur)`, date: tPre - Math.round(r.float(2, 20) * HOUR), author: `@${handle}`,
          body:
            `— t'as pas peur que ton adresse soit grillée ? elle traîne partout\n` +
            `— elle sert juste à encaisser. après ça part au mixeur, plusieurs tours, et je découpe en tranches égales avant de toucher à quoi que ce soit. personne ne sait quelle tranche va où\n` +
            `— et le reste ?\n` +
            `— le reste je le claque. casino, cartes cadeaux, comme d'hab`,
        },
        {
          id: 'pv', type: 'pv', title: 'Procès-verbal de constatations (extrait)', date: office(tPost), author: 'Section de recherches — groupe cyber',
          body:
            `Constatons que l'adresse de paiement de l'annonce présente un historique antérieur à la mise en ligne de l'annonce (${fmtDate(tAnn, false)}), puis reçoit de nombreux paiements à partir du ${fmtDate(sales[0].time, false)}.\n` +
            `Constatons que l'essentiel de ces fonds a été dépensé le ${fmtDate(preTx.time)} par la transaction ${preTx.hash}, qui crée plusieurs sorties de montant identique.\n` +
            `Constatons que plusieurs adresses examinées ont reçu des montants de 546 satoshis d'expéditeurs inconnus.`,
        },
        {
          id: 'note', type: 'note', title: 'Note technique — CoinJoin WabiSabi, analyse post-mix et leurres', date: office(tPost - 40 * DAY), author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Un tour de CoinJoin réunit de nombreux participants ; les sorties de montant standard sont indiscernables. L'heuristique des entrées communes ne s'applique pas à la transaction de CoinJoin elle-même.\n` +
            `- Une pièce peut être « remixée » : réinscrite dans un tour suivant. Chaque tour ajoute de l'incertitude.\n` +
            `- Après le mix, dépenser ensemble plusieurs sorties mixées, ou une sortie mixée avec des fonds non mixés, recrée un lien de propriété. Plusieurs participants peuvent commettre cette erreur dans le même tour : c'est l'entrée non mixée (et son origine) qui dit à qui appartient chaque regroupement.\n` +
            `- Poussière (546 sats) : envoyée à des adresses connues pour inciter leur propriétaire à la dépenser avec d'autres pièces. Elle ne dit rien de l'affaire tant qu'elle n'est pas dépensée.\n` +
            `- Des montants identiques au même moment ne prouvent pas une continuité : seul le comportement des adresses (réutilisation, destination) départage des tranches jumelles.\n` +
            `- L'inspecteur d'une transaction CoinJoin propose une analyse post-mix ; l'empreinte d'une transaction (version, nLockTime, RBF) renseigne sur la famille de logiciel utilisée.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o14', type: 'number', points: 10, tolerance: 0, unit: 'paiements',
          prompt: 'Combien de paiements d\'acheteurs l\'adresse de l\'annonce a-t-elle reçus au total, y compris après la transaction de préparation ?',
          answer: nBuyers,
          hint: 'Passez en revue toutes les entrées de l\'adresse et écartez ce qui n\'est pas un acheteur : fonds antérieurs à l\'annonce venant d\'un service attribué, montants de 546 sats, rendus que l\'adresse se renvoie à elle-même.',
          explanation: `${nBuyers} paiements d'acheteurs : ${nB} avant la préparation (${btc(totalSales)}, dont un retrait direct depuis ${buyerEx.entity.name}) et ${nLate} après (${lateSales.map((x) => `${btc(saleValue(x))} le ${fmtDate(x.time, false)}`).join(', ')}), de montants voisins du prix affiché. Ne comptent pas : ${nP2p} versements de séquestres Hodl Hodl antérieurs à l'annonce (achats de bitcoins de pair à pair par le vendeur lui-même, ${p2pSpan}), ${rDustCount ? `${pl(rDustCount, 'dépôt', 'dépôts')} de poussière de 546 sats d'expéditeurs inconnus, et ` : ''}${pl(rSelfChange, 'rendu', 'rendus')} que l'adresse se renvoie lors de ses propres dépenses (option du forum, puis paiements ${payees(rPays, R)}). Chaque paiement d'acheteur est un receleur potentiel à identifier.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Avant de préparer ses pièces, le vendeur a payé une option au forum depuis l\'adresse de l\'annonce. Quel montant (en BTC) ?',
          answer: forumFee,
          hint: 'L\'adresse de l\'annonce paie plusieurs services (VPN, cartes cadeaux…). Une seule de ses dépenses a une sortie attribuée au forum, juste avant la transaction citée au procès-verbal.',
          explanation: `${feeTx.hash.slice(0, 16)}… verse ${btc(forumFee)} (≈ ${Math.round(usd('BTC', forumFee))} $, prix d'une mise en avant) à l'adresse de paiement des options du ${forumE.name}, le ${fmtDate(feeTx.time)} ; le rendu revient sur l'adresse de l'annonce, réutilisée. Les autres petites dépenses de l'adresse sont des paiements ${payees(rPays, R)} (vie courante du vendeur, avant et après les ventes). Ce paiement relie on-chain l'adresse de l'annonce au compte vendeur du forum : un élément à verser au dossier si le forum est un jour saisi (ses bases associent paiements et comptes).`,
        },
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: 'Identifiez une transaction CoinJoin dans laquelle des fonds du vendeur ont été mélangés.',
          answer: cjs.map((x) => x.id),
          hint: 'Suivez les sorties de montant identique créées par la transaction mentionnée au procès-verbal de constatations.',
          explanation: `Le premier tour compte ${cjs[0].inputs.length} entrées et ${eq} sorties de ${btc(denom)} : les pièces du vendeur y deviennent indiscernables de celles des autres participants. ${nRounds > 1 ? `Toute transaction parmi les ${nRounds} tours est acceptée.` : ''}`,
        },
        {
          id: 'o2', type: 'number', points: 8, tolerance: 0, unit: 'tours',
          prompt: 'Combien de tours de CoinJoin distincts ont mélangé des fonds du vendeur ?',
          answer: nRounds,
          hint: 'Dans l\'analyse post-mix d\'un CoinJoin, les sorties « remixées » mènent au tour suivant. Suivez-les jusqu\'au dernier.',
          explanation: `${nRounds} tours : ${cjs.map((cj, i) => `n° ${i + 1} le ${fmtDate(cj.time)}`).join(', ')}. À chaque tour, une partie des pièces est remixée, le reste attend : c'est ce qui rend la dépense finale si révélatrice, puisqu'elle réunit des pièces de tours différents.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Quelle adresse reçoit le reliquat de la transaction de préparation, qui n\'entre dans aucun CoinJoin ?',
          answer: [L],
          hint: 'Dans la transaction citée au procès-verbal, toutes les sorties ont le même montant sauf une.',
          explanation: `${A(w, L)} reçoit ${btc(leftoverValue)} : ce que la préparation dépense (paiements des acheteurs reçus jusque-là et rendu de l'option du forum), moins les ${m} pièces de ${btc(r8(denom + PREMIX_EXTRA))} et les frais. Ce reliquat ne participe à aucun tour : il reste directement relié à l'adresse de l'annonce, donc au vendeur. C'est le fil à surveiller : s'il est un jour dépensé avec des sorties mixées, il les « signe ».`,
        },
        {
          id: 'o3', type: 'tx', points: 14,
          prompt: `En moins d'une heure et demie, trois transactions regroupent des sorties mixées du dernier tour et versent chacune environ ${btc(consOut)} vers une seule adresse. Laquelle est la dépense post-mix du vendeur ?`,
          answer: [consTx.id],
          hint: 'Les montants et les horaires ne départagent pas. Regardez les entrées qui ne sont pas des sorties mixées : d\'où viennent-elles ?',
          explanation: `${consTx.hash.slice(0, 16)}… (${hm(consTx.time)}) dépense ensemble le reliquat non mixé ${A(w, L)} (${btc(leftoverValue)}, issu de la préparation, donc des paiements des acheteurs) et ${merged.length} sorties mixées venant des tours ${roundsInCons.slice(0, -1).join(', ')}${roundsInCons.length > 1 ? ' et ' : ''}${roundsInCons[roundsInCons.length - 1]} : par entrées communes, toutes appartiennent au propriétaire du reliquat. Les deux autres (${[...twinCons].sort((a, b) => a.tx.time - b.tx.time).map((x) => `${x.tx.hash.slice(0, 12)}… à ${hm(x.tx.time)}`).join(', ')}) regroupent chacune une seule sortie mixée, le rendu du même participant dans ce tour et une pièce extérieure jamais passée par l'adresse de l'annonce : l'analyse post-mix les rattache à d'autres participants. Même montant à 0,3 % près, même heure, mais aucun lien de propriété avec le vendeur.`,
        },
        {
          id: 'o4', type: 'addresses', points: 12,
          prompt: 'Sélectionnez les sorties mixées (issues d\'un CoinJoin) que cette dépense rattache au vendeur.',
          answer: merged,
          hint: 'Parmi les entrées de la dépense fautive, une seule n\'est pas une sortie de CoinJoin : écartez-la.',
          explanation: `${merged.length} sorties mixées : ${merged.map((a) => `${A(w, a)} (tour ${fromRound(a)})`).join(', ')}. Le reliquat ${A(w, L)} n'est pas une sortie mixée : il est rattaché au vendeur dès l'origine.${unspentFinal ? ` Une autre sortie du dernier tour (${A(w, unspentFinal)}) n'a pas encore été dépensée : rien ne permet aujourd'hui de la rattacher, mais elle mérite une surveillance.` : ''}`,
        },
        {
          id: 'o13', type: 'tx', points: 14,
          prompt: `Le regroupement fautif verse les fonds sur ${A(w, V)}, qui effectue ensuite six versements en moins de trois heures, dont trois d'environ ${btc(X)}. Lequel est la continuation vers la plateforme régulée de sortie ?`,
          answer: [trTx.id],
          hint: 'Ouvrez chacune des six adresses destinataires et regardez ce qu\'elles deviennent, mais aussi ce qu\'elles avaient fait AVANT : une seule a déjà servi.',
          explanation: `Les six versements de ${A(w, V)} : ${vList}. Les trois branches de montants divers sont sans issue (dépensée, ré-éclatée, retour) ; parmi les trois tranches quasi identiques (le « découpage en tranches égales » annoncé dans la messagerie), une dort, une est vendue de pair à pair, et seule ${trTx.hash.slice(0, 12)}… (vers ${A(w, H)}) mène à la plateforme. ${A(w, H)} n'est d'ailleurs pas une adresse neuve : elle a déjà relayé ${nPrior} versements de ${A(w, V)} vers la même adresse de dépôt ${ex.entity.name}, des mois avant les faits. Montant et heure ne départagent pas les tranches ; leur comportement, avant et après, oui.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Vers quelle plateforme régulée les fonds de cette tranche sont-ils envoyés ?',
          answer: [exKey],
          hint: 'Suivez la tranche retenue : après les faits, l\'adresse intermédiaire n\'a qu\'une dépense, vers une adresse balayée ensuite vers un portefeuille chaud attribué.',
          explanation: `${A(w, H)} verse ${btc(depValue)} sur l'adresse de dépôt ${A(w, D)} ${de(ex.entity.name)}, balayée ensuite vers son portefeuille chaud. Réquisition sur cette adresse de dépôt, en joignant la démonstration (paiements des acheteurs → préparation → reliquat → regroupement fautif → portefeuille personnel → tranche → dépôt). La tranche vendue sur Hodl Hodl est une piste secondaire (contrepartie de l'échange, moyens de paiement convenus). ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant (en BTC) la tranche verse-t-elle sur l\'adresse de dépôt de cette plateforme ?',
          answer: depValue,
          hint: 'La dépense de l\'adresse intermédiaire n\'a qu\'une sortie : lisez sa valeur. Attention aux versements antérieurs reçus par la même adresse de dépôt.',
          explanation: `${btc(depValue)} le ${fmtDate(depTx.time)} : la tranche de ${btc(X)} moins les frais de réseau. L'adresse de dépôt ${A(w, D)} a reçu ${depCount} versements au total, dont ${nPrior} antérieurs aux faits venant de la même adresse intermédiaire : le compte client est ancien et le même. Indiquez dans la réquisition le hash de ce dépôt et l'adresse de dépôt, en demandant aussi l'historique complet du compte ; le montant lié aux faits est celui-ci, pas le cumul.`,
        },
        {
          id: 'o12', type: 'entity', points: 10,
          prompt: 'L\'un des acheteurs de la base a payé par un retrait direct depuis une plateforme régulée. Laquelle ?',
          answer: [buyerKey],
          hint: 'Examinez l\'émetteur de chaque paiement reçu par l\'adresse de l\'annonce après sa mise en ligne : l\'un d\'eux part du portefeuille chaud d\'un service attribué (ce n\'est pas un séquestre de pair à pair).',
          explanation: `Le paiement du ${fmtDate(sales[kycIdx].time)} (${btc(saleValue(sales[kycIdx]))}) part du portefeuille chaud de ${buyerEx.entity.name}, avec un rendu vers ce même portefeuille : c'est un retrait de client. Les versements de séquestres Hodl Hodl, eux, sont antérieurs à l'annonce et correspondent à des achats du vendeur. La plateforme peut identifier le titulaire du compte qui a ordonné ce retrait vers l'adresse de l'annonce, c'est-à-dire un acheteur de données volées (volet recel). ${procedureFor(buyerEx.entity)}`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Un autre regroupement, de deux sorties mixées du dernier tour et sans aucune entrée non mixée, figure dans les mêmes CoinJoin. Lequel ne doit pas être imputé au vendeur ?',
          answer: [fpTx.id],
          hint: 'L\'analyse post-mix signale les regroupements « sans lien avec un participant ». Cherchez celui de deux entrées de la dénomination, pour environ deux fois la dénomination.',
          explanation: `${fpTx.hash.slice(0, 16)}… regroupe deux sorties de ${btc(denom)} du dernier tour, mais aucune de ses entrées n'est reliée au vendeur (ni reliquat, ni rendu, ni adresse d'entrée). Elle prouve seulement qu'un même acteur détient ces deux sorties, sans dire lequel. Son empreinte de logiciel est pourtant identique à celle du vendeur : c'est un piège.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Le regroupement fautif et ce regroupement de deux sorties présentent la même empreinte de logiciel que la transaction de préparation du vendeur. Quelle valeur accorder à cette empreinte ?',
          ...choice(r,
            'Un indice de même famille de logiciel, partagée par beaucoup : il corrobore un lien établi autrement',
            [
              'Une preuve d\'identité : deux transactions de même empreinte ont nécessairement le même auteur',
              'Aucune valeur : ces champs sont tirés au hasard à chaque transaction et ne disent rien',
              'Une preuve suffisante dès lors que les deux transactions ont lieu le même jour',
            ]),
          hint: 'Comparez les deux regroupements : lequel repose sur un lien de propriété avec un élément déjà attribué au vendeur ?',
          explanation: `Version, nLockTime, signalement RBF et ordre des sorties sont fixés par le logiciel : ils désignent une famille de portefeuilles, utilisée par de nombreuses personnes. Ici, le rattachement de la dépense fautive repose sur un lien de propriété (le reliquat non mixé) ; l'empreinte identique le corrobore. Pour l'autre regroupement, la même empreinte ne prouve rien : sans lien de propriété, l'imputer au vendeur serait une erreur.`,
        },
      ],
      truth: {
        path: [...sales.map((x) => x.id), feeTx.id, preTx.id, ...cjs.map((x) => x.id), consTx.id, trTx.id, depTx.id, sweep.id],
        addresses: [R, L, ...premix, ...merged, V, H, D, forumFeeAddr],
        debrief:
          `1. L'adresse de l'annonce ${A(w, R)} n'est pas neuve : le vendeur l'avait alimentée par ${nP2p} achats de pair à pair (séquestres Hodl Hodl)${rPays.some((x) => x.time < tAnn) ? ` et s'en servait pour ses dépenses courantes (paiements ${payees(rPays.filter((x) => x.time < tAnn), R)})` : ''}. ${nBuyers} acheteurs y paient : ${nB} avant la préparation (${btc(totalSales)}), dont un par retrait direct depuis ${buyerEx.entity.name} (acheteur identifiable, volet recel), et ${nLate} après. Le vendeur règle ${btc(forumFee)} d'option d'annonce au ${forumE.name}, rendu sur la même adresse.${rDustCount ? ' De la poussière de 546 sats y est déposée, jamais dépensée.' : ''}\n` +
          `2. Préparation (${fmtDate(preTx.time)}) : ${m} pièces de ${btc(r8(denom + PREMIX_EXTRA))} (dénomination + frais) et un reliquat de ${btc(leftoverValue)} sur ${A(w, L)}.\n` +
          `3. ${nRounds} tours de CoinJoin : à chaque tour, une partie des sorties est remixée dans le suivant, le reste attend.\n` +
          `4. Erreur : le ${fmtDate(consTx.time)}, ${merged.length} sorties mixées de tours différents sont dépensées avec le reliquat non mixé vers ${A(w, V)}, son portefeuille de tous les jours (${btc(consOut)}). À quelques minutes d'intervalle, deux autres participants regroupent le même montant, chacun avec son propre rendu du tour et une pièce extérieure : leurres de montant et d'heure, sans lien de propriété avec le vendeur.\n` +
          `5. ${A(w, V)} éclate les fonds : trois branches sans issue (dépensée en paiements ${payees(b1Pays, B1)}, ré-éclatée, revenue sur ${A(w, V)}) et trois tranches d'environ ${btc(X)} : l'une dort sur ${A(w, T1)}, l'autre est vendue sur Hodl Hodl, la troisième passe par ${A(w, H)} — adresse qui relayait déjà ses versements vers la même adresse de dépôt — et arrive chez ${ex.entity.name} (${btc(depValue)}).\n` +
          `6. Piège : un autre participant regroupe deux sorties du dernier tour avec un logiciel de même empreinte ; rien ne le relie au vendeur.\n\n` +
          `À retenir : les remix augmentent l'ensemble d'anonymat, mais une seule dépense post-mix maladroite suffit à relier toutes les pièces qu'elle réunit, quel que soit le nombre de tours. Quand plusieurs regroupements se ressemblent (montant, heure), c'est l'entrée non mixée et son origine qui tranchent ; quand des tranches jumelles partent ensemble, c'est le comportement des adresses avant et après. L'empreinte de logiciel et les horaires ne sont que des indices de corroboration, à présenter comme tels.`,
      },
      hints: [
        'Partez de l\'adresse de l\'annonce : triez ses entrées (acheteurs, achats P2P antérieurs, poussière, rendus) puis repérez la transaction de préparation, qui crée plusieurs sorties identiques et une sortie différente.',
        'Les CoinJoin sont détectés automatiquement. Dans l\'inspecteur, l\'analyse post-mix montre les sorties remixées et les dépenses rattachées.',
        'La sortie différente de la préparation (le reliquat) n\'est jamais mixée : suivez sa dépense, et méfiez-vous des regroupements du même montant au même moment.',
        'Le portefeuille qui reçoit le regroupement fautif découpe les fonds : pour chaque destinataire, regardez son historique complet, pas seulement sa dépense suivante.',
        'Un regroupement de sorties mixées sans lien avec un participant ne désigne personne, même avec une empreinte de logiciel identique.',
      ],
    }
  },
}
