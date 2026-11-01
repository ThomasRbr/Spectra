import { World, type Tx } from '../engine/world'
import { exchange, swapper, roundCoin, roundUsdAmount, HOUR, DAY } from '../engine/patterns'
import { EUR_USD, fromUsd, roundAsset, usd } from '../engine/chains'
import type { Entity } from '../engine/entities'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const DUST = 0.00000546
const eurToBtc = (eur: number) => roundAsset('BTC', fromUsd('BTC', eur * EUR_USD))
const toEur = (v: number) => Math.round(usd('BTC', v) / EUR_USD)
const eur = (v: number) => `${toEur(v).toLocaleString('fr-FR')} €`
/** Même jour, heure de service (8 h–18 h, heure de Paris) : pour les pièces de procédure. */
const office = (ts: number) => Math.floor(ts / 86400) * 86400 + 7 * 3600 + (Math.abs(Math.round(ts)) % (9 * 3600))
const parisHour = (ts: number) => Number(new Date(ts * 1000).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Paris' }))
/** Repousse un horodatage aux heures d'ouverture d'un bureau de tabac (9 h – 19 h, heure de Paris). */
const daytime = (ts: number) => {
  let t = ts
  while (parisHour(t) < 9 || parisHour(t) >= 19) t += 1800
  return t
}

/** Envoi sans financement automatique : le portefeuille doit couvrir le montant (sinon erreur de génération). */
function pay(w: World, from: string, to: string, value: number, time: number, change: string | null | undefined, opts: { tags?: string[]; method?: string } = {}): Tx {
  const need = value + w.estimateFee('btc', 3, 2)
  if (w.unspentValue(from, time) < need) throw new Error(`darknet-vendor : ${from} ne couvre pas ${value} à ${time}`)
  return w.utxoTx({ time, from: [from], to: [{ address: to, value }], change, autoFund: false, ...opts })
}

/** Dépense la totalité des UTXO de `from` (à l'instant `time`) vers une seule sortie, frais = total − montant. */
function sendAll(w: World, from: string[], to: string, time: number, opts: { tags?: string[]; method?: string } = {}): Tx {
  const total = from.reduce((s, a) => s + w.unspentValue(a, time), 0)
  const nIn = from.reduce((s, a) => s + w.utxosOf(a, time).length, 0)
  const value = r8(total - w.estimateFee('btc', Math.max(1, nIn), 1))
  if (value <= DUST) throw new Error(`darknet-vendor : rien à dépenser sur ${from.join(',')}`)
  return w.utxoTx({ time, from, to: [{ address: to, value }], fee: total - value, change: null, spendAll: true, autoFund: false, ...opts })
}

export const btcDarknetVendor: ScenarioTemplate = {
  id: 'darknet-vendor',
  title: 'Le vendeur d\'Abysse',
  tagline: 'Séquestre darknet, fournisseur, P2P, swap vers Litecoin, KYC… et des billets retirés au bureau de tabac.',
  description:
    'Un vendeur de stupéfiants opère sur Abysse Market. À partir d\'un achat sous pseudonyme et de son profil public sur un forum, reconstituez son portefeuille, séparez les libérations de séquestre des ventes hors marché, repérez son fournisseur, suivez ses sorties en cascade (P2P, échangeur instantané vers Litecoin, exchange régulé) jusqu\'aux ventes contre espèces dans des distributeurs de crypto-actifs, en écartant les branches sans issue et les tranches jumelles.',
  difficulty: 4,
  chains: ['btc', 'ltc'],
  skills: ['osint', 'cioh', 'change', 'crosschain', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 100,
  lessons: ['clustering', 'darknet', 'osint', 'chain-hopping', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const handle = fakeHandle(r)
    const city = fakeCity(r)
    const client = fakePerson(r)

    const obs = w.customEntity({
      name: 'Abysse Market', category: 'darknet', known: true, risk: 'severe', country: 'Inconnu',
      description: 'Marché du darknet francophone (fictif) : stupéfiants, faux documents. Portefeuille de séquestre centralisé, commission prélevée à chaque libération. Ne répond à aucune réquisition.',
    })
    const escrow = w.addr('btc', { entity: obs, label: 'Abysse Market — Séquestre', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const vendor = w.customEntity({ name: `Vendeur « ${handle} »`, category: 'suspect' })
    const police = w.customEntity({ name: 'Portefeuille d\'enquête (achat sous pseudonyme)', category: 'individual' })
    const cv = exchange(w, 'coinhouse', 'btc')
    const ls = w.entity('hodlhodl')
    // Hodl Hodl : un séquestre multisignature propre à chaque transaction
    const hodlEscrow = () => w.addr('btc', { entity: ls, label: 'Hodl Hodl — Séquestre multisig (transaction)', kind: 'p2wsh' })
    const lsEscrow = hodlEscrow()
    const swp = swapper(w, 'changenow')
    const cg = w.entity('cryptoguichet')
    const cgHot = w.addr('btc', { entity: cg, label: 'CryptoGuichet — Portefeuille chaud', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const orbit = w.customEntity({ name: 'CasinoNoctis', category: 'gambling', known: true, risk: 'medium', description: 'Casino en ligne crypto (fictif), dépôts sur adresse propre à chaque joueur, sans vérification d\'identité sous un seuil de retrait.' })
    const giftzy = w.customEntity({ name: 'Giftzy', category: 'merchant', known: true, risk: 'medium', description: 'Revendeur de cartes cadeaux contre crypto-actifs (fictif) ; codes livrés par courriel.' })
    const sousVide = w.customEntity({
      name: 'SousVidePro', category: 'merchant', known: true, country: 'Pays-Bas',
      description: 'Boutique en ligne (fictive) de machines et de sachets de mise sous vide, paiement en bitcoin accepté. Coopération volontaire sur demande (adresse de livraison, courriel).',
    })
    const MARKET_FEE = 0.04
    const vAddr = () => w.addr('btc', { entity: vendor, kind: 'p2wpkh' })
    const shopAddr = (e: Entity, what = 'Paiement') => w.addr('btc', { entity: e, label: `${e.name} — ${what}` })
    /** Heures d'ouverture des bureaux de tabac ; un horodatage repoussé au matin est étalé dans la journée. */
    const open = (ts: number) => { const d = daytime(ts); return d === ts ? ts : d + r.int(0, 5 * 3600) }

    // ── Achat sous pseudonyme ────────────────────────────────────────────────
    const policeAddr = w.addr('btc', { entity: police, kind: 'p2wpkh' })
    const buyValue = roundUsdAmount(w, 'BTC', 250, 600)
    cv.withdraw(policeAddr, r8(buyValue + r.float(0.0005, 0.002)), w.at(-27 * 24))
    const obsDeposit = w.addr('btc', { entity: obs, label: 'Abysse Market — Adresse de dépôt', tags: ['deposit'] })
    const buyTx = w.utxoTx({ time: w.at(-25 * 24 + r.float(-6, 6)), from: [policeAddr], to: [{ address: obsDeposit, value: buyValue }] })
    const buySweepT = buyTx.time + r.int(1200, 4 * 3600)

    // ── Libérations de séquestre (vendeur + autres vendeurs), en ordre chronologique ──
    const nRel = r.int(14, 19)
    type Ev = { t: number; kind: 'sweep' | 'vendor' | 'other'; v: number; uc?: boolean }
    const events: Ev[] = [{ t: buySweepT, kind: 'sweep', v: 0 }]
    events.push({ t: buySweepT + r.float(2, 5) * DAY, kind: 'vendor', v: r8(buyValue * (1 - MARKET_FEE)), uc: true })
    for (let i = 1; i < nRel; i++) events.push({ t: w.at(-r.float(5, 70) * 24), kind: 'vendor', v: roundAsset('BTC', fromUsd('BTC', r.float(450, 3800))) })
    for (let i = 0; i < r.int(16, 26); i++) events.push({ t: w.at(-r.float(2, 75) * 24), kind: 'other', v: roundAsset('BTC', fromUsd('BTC', r.float(100, 5000))) })
    events.sort((a, b) => a.t - b.t)
    const releases: { tx: Tx; addr: string; value: number }[] = []
    let ucRelease!: { tx: Tx; addr: string; value: number }
    for (const ev of events) {
      if (ev.kind === 'sweep') {
        forwardAll(w, obsDeposit, escrow, ev.t, undefined, ['sweep'])
        continue
      }
      const to = ev.kind === 'vendor' ? vAddr() : w.addr('btc')
      const tx = w.utxoTx({ time: Math.round(ev.t), from: [escrow], to: [{ address: to, value: ev.v }], change: escrow, tags: ['escrow-release'], method: 'Libération de séquestre' })
      if (ev.kind === 'vendor') {
        const rel = { tx, addr: to, value: ev.v }
        releases.push(rel)
        if (ev.uc) ucRelease = rel
      }
    }

    // ── Calendrier des regroupements ─────────────────────────────────────────
    // La toute première adresse de libération devient l'adresse principale :
    // chaque regroupement la réutilise en entrée, ce qui soude le cluster.
    const sorted = [...releases].sort((a, b) => a.tx.time - b.tx.time)
    const main = sorted[0].addr
    const cut1 = Math.floor(nRel / 3)
    const cut2 = Math.floor((2 * nRel) / 3)
    const groups = [sorted.slice(1, cut1), sorted.slice(cut1, cut2), sorted.slice(cut2)]
    const consT: number[] = []
    groups.forEach((g, gi) => consT.push(Math.round(Math.max(...g.map((x) => x.tx.time), consT[gi - 1] ?? 0) + r.float(6, 48) * HOUR)))

    // ── Adresse « tips » du forum : vieux pourboires et ventes hors marché ──
    const tips = vAddr()
    for (let i = 0; i < r.int(3, 4); i++) w.fund(tips, roundCoin(w, 0.0004, 0.004, 0.00001), w.at(-r.float(80, 220) * 24), { senders: 1 })
    const clientAddr = w.addr('btc', { kind: 'p2wpkh' })
    const nDirect = r.int(5, 8)
    const clientIdx = r.int(1, nDirect - 2)
    const directTimes = Array.from({ length: nDirect }, () => Math.round(r.float(w.at(-60 * 24), consT[1] - 3 * HOUR))).sort((a, b) => a - b)
    const directs = directTimes.map((t, i) => {
      const value = roundAsset('BTC', fromUsd('BTC', r.float(90, 650)))
      const tx = i === clientIdx ? w.fund(tips, value, t, { from: [clientAddr] }) : w.fund(tips, value, t, { senders: 1 })
      return { tx, value, time: t }
    })
    const clientPay = directs[clientIdx]
    // Ventes hors marché arrivées après le deuxième regroupement : elles dorment sur l'adresse.
    const lateDirects = Array.from({ length: r.int(2, 3) }, () => Math.round(r.float(consT[1] + 6 * HOUR, consT[1] + 20 * DAY))).sort((a, b) => a - b)
      .map((t) => w.fund(tips, roundAsset('BTC', fromUsd('BTC', r.float(90, 500))), t, { senders: 1 }))

    // ── Vie de l'adresse principale : regroupements, fournisseur, salaire, matériel ──
    const sup = w.addr('btc', { kind: 'p2wpkh' })
    const perso = vAddr()
    type MEv = { t: number; kind: 'cons' | 'sup' | 'perso' | 'pack'; gi?: number; eur?: number }
    const span = (a: number, b: number, lo: number, hi: number) => Math.round(a + r.float(lo, hi) * (b - a))
    const mev: MEv[] = consT.map((t, gi) => ({ t, kind: 'cons' as const, gi }))
    mev.push({ t: span(consT[0], consT[1], 0.25, 0.7), kind: 'sup', eur: r.pick([1500, 2000, 2500]) })
    mev.push({ t: span(consT[1], consT[2], 0.2, 0.55), kind: 'sup', eur: r.pick([2000, 2500, 3000]) })
    mev.push({ t: span(consT[0], consT[1], 0.75, 0.92), kind: 'perso', eur: r.int(3, 8) * 100 })
    mev.push({ t: span(consT[1], consT[2], 0.62, 0.9), kind: 'pack', eur: r.int(8, 22) * 10 })
    mev.push({ t: consT[2] + Math.round(r.float(3, 20) * HOUR), kind: 'perso', eur: r.int(4, 9) * 100 })
    if (r.chance(0.6)) mev.push({ t: consT[2] + Math.round(r.float(22, 40) * HOUR), kind: 'sup', eur: r.pick([1500, 2000]) })
    mev.sort((a, b) => a.t - b.t)
    const consTxs: Tx[] = []
    const supTxs: Tx[] = []
    const persoIn: Tx[] = []
    let packTx: Tx | undefined
    for (const ev of mev) {
      if (ev.kind === 'cons') {
        const gi = ev.gi!
        const from = [main, ...groups[gi].map((x) => x.addr), ...(gi === 1 ? [tips] : [])]
        consTxs.push(sendAll(w, r.shuffle(from), main, ev.t, { method: 'consolidation' }))
        continue
      }
      const bal = w.unspentValue(main, ev.t)
      let value = eurToBtc(ev.eur!)
      if (value > bal * 0.45) value = eurToBtc(Math.max(100, Math.floor((toEur(bal) * 0.4) / 100) * 100))
      if (ev.kind === 'sup') supTxs.push(pay(w, main, sup, value, ev.t, main))
      else if (ev.kind === 'perso') persoIn.push(pay(w, main, perso, value, ev.t, main))
      else packTx = pay(w, main, shopAddr(sousVide, 'Paiement commande'), value, ev.t, main)
    }
    const lastMainT = Math.max(...mev.map((e) => e.t))

    // ── Sorties en cascade ───────────────────────────────────────────────────
    // 1. Hodl Hodl (vente P2P contre espèces / virement)
    const v2 = vAddr()
    const tLs = Math.round(lastMainT + r.float(1, 3) * DAY)
    const lsValue = r8(Math.floor(w.unspentValue(main, tLs) * r.float(0.15, 0.25) * 1000) / 1000)
    const lsTx = w.utxoTx({ time: tLs, from: [main], to: [{ address: lsEscrow, value: lsValue }], change: v2, spendAll: true, autoFund: false })
    // 2. ChangeNOW BTC → LTC
    const v3 = vAddr()
    const ltcAddr = w.addr('ltc', { entity: vendor, kind: 'p2wpkh' })
    const swapT = Math.round(lsTx.time + r.float(1, 3) * DAY)
    const swapValue = r8(Math.floor(w.unspentValue(v2, swapT) * r.float(0.2, 0.32) * 10000) / 10000)
    // Leurres maîtrisés : autres clients payés en LTC, montants éloignés d'au moins 5 %
    // (créés avant et après la commande pour respecter l'ordre chronologique).
    const ltcHot = swp.hot('ltc')
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

    // Réserve pour la sortie en espèces : trois tranches de 2 ou 3 tickets de DAB (900 à 990 € chacun)
    // et trois petites branches. Les dépôts chez Coinhouse se font sur le reste.
    const ticketEur = Array.from({ length: 3 }, () => r.int(90, 99) * 10)
    const ticketBtc = ticketEur.map(eurToBtc)
    const trancheOf = (n: number) => r8(ticketBtc.slice(0, n).reduce((s, v) => s + v, 0) + n * 0.00007 + 0.00005)
    const branchBtc = Array.from({ length: 3 }, () => roundAsset('BTC', fromUsd('BTC', r.float(140, 520))))
    const reserveOf = (n: number) => 3 * trancheOf(n) * 1.006 + branchBtc.reduce((s, v) => s + v, 0) + 0.0012
    const tCv1 = Math.round(order.depositTx.time + r.float(2, 5) * DAY)
    const v3Bal = w.unspentValue(v3, tCv1)
    let nT = 3
    while (nT > 1 && reserveOf(nT) > v3Bal * 0.62) nT--
    const reserve = reserveOf(nT)
    // 3. Coinhouse — l'erreur de KYC
    const v4 = vAddr()
    const cvValue = r8(Math.floor((v3Bal - reserve) * r.float(0.45, 0.6) * 1000) / 1000)
    const cvRes = cv.receive(v3, cvValue, tCv1, { change: v4 })
    // 4. Second dépôt Coinhouse quelques jours plus tard, sur la MÊME adresse de dépôt
    //    (adresse attribuée durablement au compte client) : il faut l'additionner au premier.
    const v5 = vAddr()
    const tCv2 = Math.round((cvRes.sweep?.time ?? cvRes.tx.time) + r.float(3, 8) * DAY)
    const v4Bal = w.unspentValue(v4, tCv2)
    const cv2Value = r8(Math.floor((v4Bal - reserve) * r.float(0.55, 0.75) * 1000) / 1000)
    const cvRes2 = cv.receive(v4, cv2Value, tCv2, { change: v5, depositAddr: cvRes.deposit })
    const cvTotal = r8(cvValue + cv2Value)
    const swapDelayMin = Math.round((order.payoutTx.time - order.depositTx.time) / 60)

    // 5. Branches sans issue détachées du rendu v5 (dort / dépensée / ré-éclatée)
    const fates = r.shuffle(['dort', 'dépensée', 'éclatée'] as const)
    let tb = Math.round(Math.max(cvRes2.tx.time, cvRes2.sweep?.time ?? 0) + r.float(1, 2.5) * DAY)
    const branches = fates.map((fate, i) => {
      tb += Math.round(r.float(8, 70) * 60)
      const addr = vAddr()
      const tx = pay(w, v5, addr, branchBtc[i], tb, v5)
      return { addr, tx, fate, value: branchBtc[i], follow: [] as Tx[] }
    })
    for (const b of branches) {
      let t = b.tx.time + Math.round(r.float(6, 30) * HOUR)
      if (b.fate === 'dépensée') {
        const shops = r.shuffle([giftzy, orbit, w.entity('mullvad')])
        for (let k = 0; k < r.int(2, 3); k++) {
          const v = r8(Math.floor(w.unspentValue(b.addr, t) * r.float(0.3, 0.45) * 1e6) / 1e6)
          if (v < 0.00005) break
          b.follow.push(pay(w, b.addr, shopAddr(shops[k]), v, t, b.addr))
          t += Math.round(r.float(10, 60) * HOUR)
        }
      } else if (b.fate === 'éclatée') {
        const n = r.int(2, 3)
        for (let k = 0; k < n; k++) {
          b.follow.push(pay(w, b.addr, w.addr('btc'), r8(b.value / (n + 1)), t, b.addr))
          t += r.int(600, 2400)
        }
      }
    }
    const sleeper = branches.find((b) => b.fate === 'dort')!

    // 6. Trois tranches jumelles (même montant à ±0,4 %, en moins de 30 min) : une seule part au DAB
    const tranche = trancheOf(nT)
    const tTr = Math.round(tb + r.float(14, 40) * HOUR)
    const roles = r.shuffle(['E', 'T1', 'T2'] as const)
    const offs = [0, r.int(4, 12) * 60, r.int(15, 27) * 60]
    const tr = roles.map((role, i) => {
      const addr = vAddr()
      const value = role === 'E' ? tranche : r8(tranche * (1 + r.float(-0.004, 0.004)))
      return { role, addr, value, tx: pay(w, v5, addr, value, tTr + offs[i], v5) }
    })
    const E = tr.find((x) => x.role === 'E')!
    const T1 = tr.find((x) => x.role === 'T1')!
    const T2 = tr.find((x) => x.role === 'T2')!
    const trSpanMin = Math.round((tr[2].tx.time - tr[0].tx.time) / 60)

    // 7. Ventes contre espèces : nT tickets CryptoGuichet depuis E, dans des bureaux de tabac différents
    const ticketAddr = () => w.addr('btc', { entity: cg, label: 'CryptoGuichet — Adresse de ticket (vente)', tags: ['deposit'] })
    const tickets: { tx: Tx; addr: string; value: number; eur: number }[] = []
    let tk = open(E.tx.time + Math.round(r.float(3, 20) * HOUR) + r.int(0, 3600))
    for (let k = 0; k < nT; k++) {
      const addr = ticketAddr()
      tickets.push({ tx: pay(w, E.addr, addr, ticketBtc[k], tk, E.addr), addr, value: ticketBtc[k], eur: ticketEur[k] })
      tk = open(tk + Math.round(r.chance(0.5) ? r.float(16, 28) * HOUR : r.float(0.7, 3) * HOUR))
    }
    const atmTotal = r8(tickets.reduce((s, x) => s + x.value, 0))
    const atmEur = tickets.reduce((s, x) => s + x.eur, 0)
    const lastTicket = tickets[tickets.length - 1]
    // Autres clients des DAB : mêmes montants ronds en euros, à quelques minutes des tickets du vendeur
    const allTickets: { addr: string; time: number }[] = tickets.map((x) => ({ addr: x.addr, time: x.tx.time }))
    const otherTicket = (time: number, value: number) => {
      const src = w.addr('btc', { kind: r.pick(['p2wpkh', 'p2wpkh', 'p2sh', 'p2pkh'] as const) })
      w.fund(src, r8(value * r.float(1.05, 1.6)), time - r.int(HOUR, 4 * DAY), { senders: 1 })
      const addr = ticketAddr()
      w.utxoTx({ time, from: [src], to: [{ address: addr, value }] })
      allTickets.push({ addr, time })
    }
    tickets.forEach((x, k) => {
      const n = x === lastTicket ? 2 : r.int(1, 2)
      for (let i = 0; i < n; i++) otherTicket(x.tx.time + r.int(5, 50) * 60 * (r.chance(0.5) ? 1 : -1), roundAsset('BTC', ticketBtc[k] * (1 + r.float(-0.006, 0.006))))
    })
    for (let i = 0; i < r.int(4, 7); i++) otherTicket(open(Math.round(r.float(tTr - DAY, tk + DAY))),eurToBtc(r.int(10, 99) * 10))
    // Regroupement des adresses de tickets vers le portefeuille chaud de l'exploitant
    allTickets.sort((a, b) => a.time - b.time)
    for (let i = 0; i < allTickets.length;) {
      const start = allTickets[i].time
      const batch: string[] = []
      let last = start
      while (i < allTickets.length && allTickets[i].time - start < 5 * HOUR) { batch.push(allTickets[i].addr); last = allTickets[i].time; i++ }
      sendAll(w, batch, cgHot, last + Math.round(r.float(1, 4) * HOUR), { tags: ['sweep'], method: 'consolidation' })
    }
    // Achats au DAB (le portefeuille chaud paie les acheteurs)
    for (let i = 0; i < r.int(4, 6); i++) {
      w.utxoTx({ time: Math.round(r.float(tTr - 2 * DAY, tk + 2 * DAY)), from: [cgHot], to: [{ address: w.addr('btc'), value: eurToBtc(r.int(5, 100) * 10) }], change: cgHot, tags: ['withdrawal'] })
    }

    // Sort des tranches leurres : T1 revient sur v5, T2 part au casino
    const t1Back = sendAll(w, [T1.addr], v5, Math.round(tTr + r.float(2, 4) * DAY))
    const orbitDep = shopAddr(orbit, 'Adresse de dépôt')
    const t2Casino = sendAll(w, [T2.addr], orbitDep, Math.round(tTr + r.float(1, 3) * DAY))

    // ── Habillage : poussière, portefeuille personnel, fournisseur, P2P ─────
    const dust = (addr: string, a: number, b: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = Math.round(r.float(a, b))
        const src = w.addr('btc')
        w.fund(src, 0.0002, t - r.int(HOUR, 5 * DAY), { senders: 1 })
        w.utxoTx({ time: t, from: [src], to: [{ address: addr, value: DUST }], tags: ['dust'] })
      }
    }
    dust(main, sorted[0].tx.time + DAY, tLs - HOUR, r.int(2, 3))
    dust(tips, w.at(-40 * 24), tTr, 3)
    dust(v5, cvRes2.tx.time + HOUR, tTr + 6 * DAY, 2)
    dust(E.addr, lastTicket.tx.time + HOUR, lastTicket.tx.time + 8 * DAY, 1)

    // Portefeuille personnel : vieilles entrées, salaire tiré de l'adresse principale, dépenses
    for (let i = 0; i < 3; i++) w.fund(perso, roundCoin(w, 0.002, 0.009, 0.0001), w.at(-r.float(100, 200) * 24), { senders: 1 })
    const persoShops = [w.entity('mullvad'), giftzy, orbit]
    const persoPays: Tx[] = []
    const persoT = Array.from({ length: r.int(7, 9) }, () => Math.round(r.float(w.at(-95 * 24), tTr + 15 * DAY))).sort((a, b) => a - b)
    for (const t of persoT) {
      const v = roundAsset('BTC', fromUsd('BTC', r.float(15, 180)))
      if (w.unspentValue(perso, t) < v + 0.0002) continue
      const dst = r.chance(0.75) ? shopAddr(r.pick(persoShops)) : w.addr('btc')
      persoPays.push(pay(w, perso, dst, v, t, perso))
    }

    // Fournisseur : adresse réutilisée qui encaisse aussi d'autres vendeurs, regroupée de temps en temps
    const supIn = Array.from({ length: r.int(6, 9) }, () => Math.round(r.float(w.at(-80 * 24), tTr))).sort((a, b) => a - b)
    for (const t of supIn) w.fund(sup, eurToBtc(r.int(3, 16) * 500), t, { senders: 1 })
    const supCold = w.addr('btc', { kind: 'p2wpkh' })
    for (const t of [span(consT[1], consT[2], 0.6, 0.95), Math.round(tTr + r.float(1, 6) * DAY)]) {
      if (w.unspentValue(sup, t) > 0.001) sendAll(w, [sup], supCold, t)
    }
    const supOthers = w.txsOf(sup).filter((x) => x.outputs.some((o) => o.address === sup) && !x.inputs.some((i) => i.address === main)).length

    // Autres séquestres Hodl Hodl du même montant rond dans l'heure (annonces de vente concurrentes)
    for (let i = 0; i < r.int(2, 3); i++) {
      const u = w.addr('btc')
      const t = tLs + r.int(-50, 50) * 60
      w.fund(u, r8(lsValue * r.float(1.1, 2)), t - r.int(2 * HOUR, 6 * DAY), { senders: 1 })
      w.utxoTx({ time: t, from: [u], to: [{ address: hodlEscrow(), value: lsValue }] })
    }

    // ── Bruit ────────────────────────────────────────────────────────────────
    cv.noise(14, w.at(-30 * 24), w.at(20 * 24))
    for (let i = 0; i < 8; i++) {
      const u = w.addr('btc')
      w.fund(u, roundCoin(w, 0.01, 0.4, 0.001), w.at(-r.float(10, 40) * 24))
      w.utxoTx({ time: w.at(-r.float(0, 9) * 24), from: [u], to: [{ address: hodlEscrow(), value: r8(w.unspentValue(u) * r.float(0.4, 0.9)) }] })
    }

    // ── Réponses (calculées sur le monde final) ─────────────────────────────
    const totalReleased = r8(releases.reduce((s, x) => s + x.value, 0))
    const exposureUsd = usd('BTC', totalReleased)
    const supTotal = r8(supTxs.reduce((s, t) => s + t.outputs.filter((o) => o.address === sup).reduce((a, o) => a + o.value, 0), 0))
    const persoTotal = r8(persoIn.reduce((s, t) => s + t.outputs.filter((o) => o.address === perso).reduce((a, o) => a + o.value, 0), 0))
    const v5Final = r8(w.unspentValue(v5))
    const eResidual = r8(w.unspentValue(E.addr))
    const sig = Array.from({ length: 4 }, () => Array.from({ length: 64 }, () => B64[r.int(0, 63)]).join('')).join('\n')
    const fp = Array.from({ length: 10 }, () => r.int(0, 0xffff).toString(16).toUpperCase().padStart(4, '0')).join(' ')
    const fmtShort = (ts: number) => fmtDate(ts, false)
    const hm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    // Annonces de rupture / réassort calées sur les paiements au fournisseur (sans chevauchement entre deux cycles)
    const restock: { out: number; back: number; tx: Tx }[] = []
    for (const t of supTxs) {
      const prev = restock[restock.length - 1]
      const out = Math.max(t.time - Math.round(r.float(2, 4) * DAY), prev ? prev.back + Math.round(r.float(3, 10) * HOUR) : 0)
      if (out > t.time - 4 * HOUR) continue
      restock.push({ out, back: t.time + Math.round(r.float(20, 40) * HOUR), tx: t })
    }
    const roleLabel = (x: (typeof tr)[number]) => (x.role === 'E' ? 'finance les tickets de DAB' : x.role === 'T1' ? `revient sur ${A(w, v5)} le ${fmtShort(t1Back.time)}` : `part en dépôt chez ${orbit.name} le ${fmtShort(t2Casino.time)}`)
    const fateText = (b: (typeof branches)[number]) => (b.fate === 'dort' ? 'jamais dépensée' : b.fate === 'dépensée' ? `dépensée en ${b.follow.length} paiements, ${payees(b.follow, b.addr)}` : `ré-éclatée en ${b.follow.length} petits envois vers des adresses neuves`)
    /** Destinataires d'une liste de paiements : « à Giftzy, à Mullvad VPN et à des particuliers ». */
    const payees = (txs: Tx[], self: string) => {
      const names = [...new Set(txs.flatMap((x) => x.outputs.filter((o) => o.address !== self).map((o) => `à ${w.ownerOf(o.address)?.name ?? 'des particuliers'}`)))]
      return names.join(', ').replace(/, ([^,]+)$/, ' et $1')
    }
    const persoList = payees(persoPays, perso)
    // Entrées du 2e regroupement payées par le séquestre (adresse principale comprise)
    const cons2Rel = consTxs[1].inputs.filter((i) => i.address !== tips && releases.some((x) => x.addr === i.address)).length
    const lastCons = consTxs[consTxs.length - 1].time
    const supAfter = supTxs.filter((t) => t.time > lastCons).length
    const backH = restock.map((x) => Math.round((x.back - x.tx.time) / HOUR))
    const msg = (ts: number, who: string, text: string) => `[${fmtDate(ts)}] ${who} : ${text}`

    return {
      world: w,
      title: `Opération Obsidienne — ${city}`,
      briefing:
        `Dans le cadre d'une information judiciaire ouverte à ${city}, la section de recherches enquête sur « ${handle} », vendeur de cocaïne et de MDMA actif sur Abysse Market et livrant par voie postale dans toute la France.\n\n` +
        `Sur Abysse, l'acheteur paie sur une adresse de dépôt de la plateforme ; les fonds restent sur un portefeuille de séquestre (escrow) jusqu'à la confirmation de réception, puis sont libérés au vendeur, moins la commission du marché. Un achat sous pseudonyme a été réalisé ; le vendeur entretient un profil public sur un forum spécialisé et vend aussi « hors marché » à des clients de confiance. Le téléphone de l'un d'eux, ${client.name}, ${client.g('interpellé', 'interpellée')} lors d'un contrôle routier, a été exploité.\n\n` +
        `Objectifs : reconstituer le portefeuille du vendeur, chiffrer les libérations de séquestre (et elles seules), identifier son fournisseur, suivre ses sorties jusqu'à la remise d'espèces en écartant les branches et les tranches qui ne mènent nulle part, et hiérarchiser les réquisitions.`,
      evidence: [
        {
          id: 'forum', type: 'forum', title: `Forum « Le Sous-Sol » — profil vendeur ${handle}`, date: w.at(-40 * 24), author: handle,
          body:
            `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\n` +
            `${handle} — vendeur vérifié Abysse depuis ${r.int(8, 30)} mois.\n` +
            `Expédition France / Belgique sous 24 h, emballage sous vide, double enveloppe.\n` +
            `Litiges : uniquement via le séquestre d'Abysse.\n` +
            `Pour les pourboires ou les commandes hors marché (clients de confiance) :\n` +
            `BTC : ${A(w, tips)}\n\n` +
            `-----BEGIN PGP SIGNATURE-----\n${sig}\n-----END PGP SIGNATURE-----\n\n` +
            `Empreinte de clé : ${fp}`,
        },
        {
          id: 'stock', type: 'forum', title: `Forum « Le Sous-Sol » — fil « [${handle}] Disponibilités »`, date: restock[restock.length - 1].back, author: handle,
          body:
            restock.map((x, i) =>
              `[${fmtDate(x.out)}] ${handle} : ${['RUPTURE sur la blanche, réassort en cours. Les commandes passées restent honorées.', 'Plus de MD ni de blanche pour quelques jours, le grossiste traîne. Désolé les amis.', 'Petite pause, stock bas. On revient vite.'][i % 3]}\n` +
              `[${fmtDate(x.back)}] ${handle} : ${['DE RETOUR. Stock complet, qualité identique, expéditions reprises.', 'Réassort reçu, tout est de nouveau dispo. Merci pour la patience.', 'C\'est reparti, tout est en ligne.'][i % 3]}`,
            ).join('\n\n') +
            `\n\n(Extrait capturé par la cellule cyber ; horodatage du forum en heure de Paris.)`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'achat sous pseudonyme', date: office(Math.max(buyTx.time + 6 * DAY, ucRelease.tx.time + 12 * HOUR)), author: 'Enquêteur sous pseudonyme',
          body:
            `Commande passée auprès ${de(handle)} sur Abysse Market : 5 g de cocaïne.\n` +
            `Paiement de ${amt(buyValue, 'BTC')} sur l'adresse de dépôt fournie par la plateforme : ${A(w, obsDeposit)}\n` +
            `Transaction : ${buyTx.hash} — ${fmtDate(buyTx.time)}\n` +
            `Colis reçu, réception confirmée sur la plateforme le ${fmtDate(ucRelease.tx.time - r.int(1, 5) * HOUR)} (libération du séquestre au vendeur).\n` +
            `Commission affichée par le marché : ${Math.round(MARKET_FEE * 100)} %.`,
        },
        {
          id: 'client', type: 'extraction', title: `Extraction du téléphone ${de(client.name)} — messagerie chiffrée (extrait)`, date: tTr + 9 * DAY, author: 'Cellule d\'appui numérique',
          body:
            `Conversation avec le contact « ${handle} » (application de messagerie chiffrée, messages éphémères désactivés).\n\n` +
            msg(clientPay.time - Math.round(r.float(3, 20) * HOUR), client.name, 'Salut, toujours possible en direct ? 3 g comme la dernière fois.') + '\n' +
            msg(clientPay.time - Math.round(r.float(1, 2.5) * HOUR), handle, `Oui. Pas par le marché, envoie ${amt(clientPay.value, 'BTC')} sur l'adresse du profil, je poste demain.`) + '\n' +
            msg(clientPay.time + Math.round(r.float(0.2, 1) * HOUR), client.name, `C'est parti, tx ${clientPay.tx.hash.slice(0, 10)}…`) + '\n' +
            msg(tTr - Math.round(r.float(1, 3) * DAY), client.name, 'Tu fais comment pour sortir l\'argent toi ? Moi ma banque pose des questions.') + '\n' +
            msg(tTr - Math.round(r.float(0.3, 0.9) * DAY), handle, 'Liquide. Les distributeurs dans les tabacs, jamais plus de 1 000 balles par ticket, sinon ils te demandent la carte d\'identité et un selfie. Et jamais deux fois le même tabac dans la journée.') + '\n\n' +
            `Aucun nom, aucune adresse postale dans la conversation. Paiement « en direct » retrouvé : ${clientPay.tx.hash}.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste — pistes', date: office(w.at(2 * 24)), author: 'Cellule d\'appui',
          body:
            `• Le séquestre d'Abysse est un portefeuille centralisé : il paie tous les vendeurs. On ne remonte pas « de l'achat au vendeur » par la chaîne : il faut un point d'entrée côté vendeur.\n` +
            `• Un vendeur qui publie une adresse sous sa clé PGP s'en attribue la propriété. Tout ce qui arrive sur cette adresse n'est pas pour autant un revenu du marché : distinguer séquestre, ventes directes, pourboires et poussière.\n` +
            `• Un vendeur paie son fournisseur : cherchez une adresse réutilisée, payée en montants ronds, qui encaisse aussi d'autres portefeuilles, et rapprochez les dates des annonces de réassort.\n` +
            `• Les échangeurs instantanés ne gardent pas de compte client, mais un dépôt BTC et un paiement sur l'autre chaîne se répondent en montant et en temps.\n` +
            `• Les DAB crypto qui rachètent des bitcoins affichent une adresse propre à chaque ticket ; l'exploitant regroupe ensuite les tickets de plusieurs clients.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Qu\'est-ce qui permet de rattacher l\'adresse « tips » du forum aux revenus tirés d\'Abysse ?',
          ...choice(r,
            'Elle est co-dépensée avec des adresses de libération de séquestre (entrées communes)',
            [
              'Elle a reçu directement des fonds du portefeuille de séquestre d\'Abysse',
              'Elle utilise le même type d\'adresse (SegWit natif) que le séquestre du marché',
              'La signature PGP prouve à elle seule que ses fonds proviennent d\'Abysse',
            ]),
          hint: 'Ajoutez l\'adresse du profil au graphe et ouvrez la transaction qui la dépense : avec quelles autres entrées est-elle signée ?',
          explanation: `La signature PGP rattache l'adresse au pseudonyme ; l'heuristique des entrées communes rattache cette adresse aux adresses de libération : elle est dépensée dans le deuxième regroupement (${consTxs[1].hash.slice(0, 12)}…) aux côtés de ${cons2Rel} adresses payées par le séquestre (dont l'adresse principale elle-même). L'adresse « tips » elle-même n'a jamais rien reçu du séquestre : ses entrées sont de vieux pourboires, des ventes directes et de la poussière. Le type d'adresse n'est pas un indice.`,
        },
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse principale où le vendeur regroupe ses revenus ?',
          answer: [main],
          hint: 'Partez de l\'adresse « tips » du profil PGP et regardez comment elle est dépensée, puis ce que devient la sortie unique de ce regroupement.',
          explanation: `${A(w, main)} a reçu la première libération de séquestre, puis ${consTxs.length} transactions de regroupement à sortie unique où elle se réutilise elle-même en entrée : elles rassemblent toutes les adresses recevant les libérations. Entre les regroupements${supAfter ? ' et après le dernier' : ''}, c'est aussi elle qui paie le fournisseur (${supTxs.length} fois), ${packTx ? 'le matériel de conditionnement (SousVidePro), ' : ''}et le portefeuille personnel du vendeur : une adresse « caisse » réutilisée, à l'opposé des adresses de passage.`,
        },
        {
          id: 'o7', type: 'tx', points: 8,
          prompt: 'Quelle libération de séquestre correspond à l\'achat sous pseudonyme ?',
          answer: [ucRelease.tx.id],
          hint: 'Le PV donne le montant payé et la commission du marché : calculez la somme attendue côté vendeur, puis cherchez-la parmi les libérations reçues par le cluster, peu après la confirmation de réception.',
          explanation: `${ucRelease.tx.hash.slice(0, 16)}… verse ${amt(ucRelease.value, 'BTC')} depuis le séquestre d'Abysse vers ${A(w, ucRelease.addr)}, le ${fmtDate(ucRelease.tx.time)} : c'est exactement le paiement de l'achat (${amt(buyValue, 'BTC')}) diminué de la commission de ${Math.round(MARKET_FEE * 100)} %, juste après la confirmation de réception. Le séquestre étant mutualisé, le lien ne se lit pas « de l'achat au vendeur » ; il se démontre par la concordance du montant et de la date. C'est la pièce maîtresse qui rattache le cluster aux ventes de stupéfiants constatées.`,
        },
        {
          id: 'o2', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.03,
          prompt: 'Montant total (en BTC) des libérations de séquestre d\'Abysse reçues par le portefeuille du vendeur ?',
          answer: totalReleased,
          hint: 'Utilisez le cluster de l\'adresse principale et ne comptez que ce qui vient directement du séquestre d\'Abysse : l\'adresse « tips » reçoit d\'autres fonds.',
          explanation: `${nRel} libérations pour ${amt(totalReleased, 'BTC')} (environ ${Math.round(exposureUsd).toLocaleString('fr-FR')} $). Ne s'y ajoutent pas : les ${nDirect + lateDirects.length} ventes hors marché payées directement sur l'adresse « tips » (dont celle ${de(client.name)}, ${amt(clientPay.value, 'BTC')}), ses vieux pourboires ni les poussières de 546 sats : ces fonds ne passent pas par le séquestre et relèvent d'un autre chiffrage (ventes directes). La libération de ${amt(ucRelease.value, 'BTC')} correspond exactement à l'achat sous pseudonyme moins ${Math.round(MARKET_FEE * 100)} % : elle valide le rattachement du cluster au vendeur.`,
        },
        {
          id: 'o13', type: 'address', points: 12,
          prompt: 'L\'adresse principale paie plusieurs destinataires entre ses regroupements et après le dernier. Quelle adresse appartient vraisemblablement au fournisseur (grossiste) du vendeur ?',
          answer: [sup],
          hint: 'Comparez les destinataires des petites sorties de l\'adresse principale : qui reçoit des montants ronds en euros, qui encaisse aussi d\'autres portefeuilles, et quand, par rapport aux annonces de rupture et de réassort du forum ?',
          explanation: `${A(w, sup)} reçoit ${supTxs.length} paiements de l'adresse principale (${supTxs.map((t) => `${eur(t.outputs.find((o) => o.address === sup)!.value)} le ${fmtShort(t.time)}`).join(', ')} ; ${amt(supTotal, 'BTC')} au total). ${restock.length > 1 ? `Les paiements du ${restock.map((x) => fmtShort(x.tx.time)).join(', du ').replace(/, du ([^,]*)$/, ' et du $1')} tombent chacun` : `Le paiement du ${fmtShort(restock[0].tx.time)} tombe`} entre une annonce de rupture et l'annonce de réassort du fil « Disponibilités », ${Math.min(...backH)}${Math.max(...backH) !== Math.min(...backH) ? ` à ${Math.max(...backH)}` : ''} h avant le « de retour ». Cette adresse encaisse aussi ${supOthers} versements ronds d'autres portefeuilles sans lien (d'autres revendeurs) et n'est jamais co-dépensée avec le vendeur : c'est un tiers, payé pour une marchandise. Les autres destinataires ne collent pas : ${A(w, perso)}, alimentée par l'adresse principale (${amt(persoTotal, 'BTC')}) et par quelques vieux apports, ne sert qu'à des dépenses de consommation (paiements ${persoList}) : c'est le portefeuille personnel du vendeur ; ${packTx ? 'SousVidePro est un commerçant attribué (sachets sous vide, cohérents avec l\'« emballage sous vide » du profil) ; ' : ''}le séquestre Hodl Hodl est une vente P2P. Présomption à étayer (réquisitions, surveillance), mais elle ouvre une piste vers l'amont du trafic.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Après le dernier regroupement, quel montant (en BTC) le vendeur envoie-t-il vers le séquestre multisignature de la plateforme de pair à pair ?',
          answer: lsValue,
          hint: 'Ouvrez la dépense de l\'adresse principale qui la vide : une sortie va vers un séquestre attribué, l\'autre revient au vendeur.',
          explanation: `${lsTx.hash.slice(0, 16)}… envoie ${amt(lsValue, 'BTC')} (montant arrondi au millième, typique d'une annonce de vente) vers le séquestre multisignature de Hodl Hodl, le rendu (${amt(r8(lsTx.outputs.find((o) => o.address === v2)!.value), 'BTC')}) repartant sur l'adresse neuve ${A(w, v2)}. Dans la même heure, d'autres utilisateurs financent d'autres séquestres Hodl Hodl (un par transaction) avec exactement le même montant rond : le montant seul ne suffit pas, c'est la transaction issue de l'adresse principale qui compte. La plateforme ne détient pas les fonds mais connaît les deux parties (pseudonymes, IP, moyens de paiement). ${procedureFor(ls)}`,
        },
        {
          id: 'o4', type: 'address', points: 10,
          prompt: 'Le vendeur a converti une partie de ses BTC en Litecoin via un échangeur instantané. Quelle adresse LTC a reçu le paiement ?',
          answer: [ltcAddr],
          hint: 'Suivez le rendu du versement P2P. Puis outil de corrélation : chaîne LTC, émetteur ChangeNOW, à partir de l\'heure du dépôt BTC, montant en USD du dépôt (moins 1 à 2 % de commission).',
          explanation: `Dépôt de ${amt(swapValue, 'BTC')} chez ChangeNOW depuis ${A(w, v2)}, puis ${amt(order.payoutValue, 'LTC')} payés ${swapDelayMin} minutes plus tard depuis le hot wallet LTC de ChangeNOW vers ${A(w, ltcAddr)}. Les autres paiements de ChangeNOW dans la fenêtre s'écartent de plus de 5 % en valeur. C'est une présomption forte (montant et délai concordants), pas une preuve : seule la réponse de l'échangeur (commande associée au hash du dépôt) l'établit, à obtenir avant toute mesure sur l'adresse LTC. ${procedureFor(swp.entity)}`,
        },
        {
          id: 'o3', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme régulée le vendeur a-t-il commis une erreur de KYC ?',
          answer: ['coinhouse'],
          hint: 'Suivez le rendu de la commande passée chez l\'échangeur instantané : la sortie suivante part vers une adresse de dépôt, balayée vers le portefeuille chaud d\'une plateforme attribuée.',
          explanation: `${amt(cvValue, 'BTC')} sont déposés depuis ${A(w, v3)} sur une adresse de dépôt Coinhouse, plateforme française agréée qui applique un KYC renforcé : le compte est rattaché à une identité vérifiée. ${procedureFor(cv.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Montant total (en BTC) déposé par le vendeur sur cette plateforme régulée, tous dépôts confondus ?',
          answer: cvTotal,
          hint: 'Une plateforme attribue souvent une adresse de dépôt durable à chaque client : ouvrez l\'historique complet de l\'adresse de dépôt, puis suivez aussi le rendu du premier dépôt.',
          explanation: `Deux dépôts sur la même adresse de dépôt ${A(w, cvRes.deposit)} : ${amt(cvValue, 'BTC')} le ${fmtShort(cvRes.tx.time)} puis ${amt(cv2Value, 'BTC')} le ${fmtShort(cvRes2.tx.time)}, depuis le rendu du premier (${A(w, v4)}). Total : ${amt(cvTotal, 'BTC')}. La réutilisation de l'adresse de dépôt confirme qu'il s'agit du même compte client ; c'est le montant à viser dans la demande de gel (sous réserve de ce qui a déjà été retiré en euros). Le rendu du second dépôt part sur ${A(w, v5)}, d'où partira la sortie en espèces.`,
        },
        {
          id: 'o14', type: 'address', points: 10,
          prompt: 'Après le second dépôt chez la plateforme régulée, le vendeur détache trois petites branches de son rendu. Laquelle n\'a jamais été dépensée (fonds encore saisissables) ?',
          answer: [sleeper.addr],
          hint: 'Listez les sorties de l\'adresse de rendu du second dépôt dans les jours qui suivent : de petits montants vers des adresses neuves. Dépliez chacune.',
          explanation: `Trois branches partent de ${A(w, v5)} en quelques heures : ${branches.map((b) => `${amt(b.value, 'BTC')} vers ${A(w, b.addr)} (${fateText(b)})`).join(' ; ')}. Seule ${A(w, sleeper.addr)} détient encore ses ${amt(sleeper.value, 'BTC')} : elle est à surveiller et à saisir le moment venu (la clé est sur les supports du vendeur). Les trois tranches d'environ ${amt(tranche, 'BTC')} qui suivent sont d'une autre nature (objectif suivant) et ont toutes été dépensées.`,
        },
        {
          id: 'o15', type: 'tx', points: 12,
          prompt: `Le ${fmtShort(tr[0].tx.time)}, en ${trSpanMin} minutes, la même adresse émet trois transactions d'environ ${amt(tranche, 'BTC')} vers trois adresses neuves. Laquelle est la continuation vers la sortie en espèces ?`,
          answer: [E.tx.id],
          hint: 'Même montant, même heure, même portefeuille : l\'horodatage ne départage rien. Dépliez chaque destination et regardez ce qu\'elle devient dans les jours qui suivent ; rapprochez la conversation avec le client de confiance.',
          explanation: `Les trois tranches : ${tr.map((x) => `${x.tx.hash.slice(0, 10)}… à ${hm(x.tx.time)} (${amt(x.value, 'BTC')} vers ${A(w, x.addr)}, qui ${roleLabel(x)})`).join(' ; ')}. Seule ${A(w, E.addr)} paie ensuite ${nT > 1 ? `${nT} adresses de tickets CryptoGuichet (de ${Math.min(...tickets.map((x) => x.eur))} à ${Math.max(...tickets.map((x) => x.eur))} € chacun)` : `une adresse de ticket CryptoGuichet (${tickets[0].eur} €)`}, comme le vendeur l'explique à ${client.name}. Les deux jumelles sont des leurres : l'une revient intégralement au vendeur (aucune sortie en espèces), l'autre part au casino. Découper en tranches égales sous le seuil d'identité du distributeur est une signature de structuration.`,
        },
        {
          id: 'o16', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC le vendeur a-t-il vendus au total contre des espèces dans les distributeurs (DAB crypto) ?',
          answer: atmTotal,
          hint: 'Ne partez pas du portefeuille chaud de l\'exploitant (il regroupe les tickets de tous les clients) : additionnez les paiements de la bonne tranche vers les adresses de tickets.',
          explanation: `${nT} ticket${nT > 1 ? 's' : ''} depuis ${A(w, E.addr)} : ${tickets.map((x) => `${amt(x.value, 'BTC')} (≈ ${x.eur} €) le ${fmtDate(x.tx.time)}`).join(', ')}, soit ${amt(atmTotal, 'BTC')} (≈ ${atmEur.toLocaleString('fr-FR')} € remis en espèces). D'autres clients vendent des montants presque identiques à quelques minutes d'intervalle, et leurs tickets sont regroupés avec ceux du vendeur vers le portefeuille chaud : ils ne comptent pas, car ils ne viennent pas de sa tranche. ${eResidual > 0 ? `Il reste ${amt(eResidual, 'BTC')} (monnaie et poussière) sur l'adresse. ` : ''}${nT > 1 ? 'Chaque ticket est sous le seuil de 1 000 € par opération, mais le cumul glissant sur 30 jours le dépasse dès le deuxième : soit l\'exploitant a recueilli une pièce d\'identité, soit le vendeur a utilisé plusieurs numéros de téléphone. La réquisition le dira.' : 'Le ticket reste sous le seuil de 1 000 € : seul le numéro de téléphone vérifié par SMS a été recueilli, à obtenir par réquisition.'}`,
        },
        {
          id: 'o6', type: 'choice', points: 10,
          prompt: 'Quelle démarche engager en priorité, compte tenu des délais de conservation ?',
          ...choice(r,
            'Requérir sans délai CryptoGuichet (tickets, numéro de téléphone, vidéosurveillance conservée environ 30 jours), en parallèle de Coinhouse (identité, IP, gel)',
            [
              'Demander à CryptoGuichet de geler les bitcoins reçus sur les adresses de tickets',
              'Requérir d\'abord Abysse Market pour obtenir l\'identité déclarée du vendeur',
              'Attendre la réponse de Coinhouse avant de solliciter l\'exploitant des DAB, pour ne pas multiplier les actes',
            ]),
          hint: 'Lisez la fiche de l\'exploitant des distributeurs : qu\'est-ce qui disparaît vite, et que peut-il (ou non) bloquer ?',
          explanation: `${procedureFor(cg)} Ses images de vidéosurveillance ne sont conservées qu'environ 30 jours : c'est l'acte le plus urgent. Il ne peut rien geler, les bitcoins des tickets ayant été regroupés et les espèces remises. ${procedureFor(cv.entity)} KYC renforcé et gel possible : c'est la seconde cible, à mener en parallèle. ${procedureFor(swp.entity)} ${procedureFor(ls)} Un marché darknet ne répond pas aux réquisitions.`,
        },
      ],
      truth: {
        path: [
          buyTx.id, ...releases.map((x) => x.tx.id), ...consTxs.map((t) => t.id), lsTx.id, order.depositTx.id, order.payoutTx.id,
          cvRes.tx.id, ...(cvRes.sweep ? [cvRes.sweep.id] : []), cvRes2.tx.id, ...(cvRes2.sweep ? [cvRes2.sweep.id] : []),
          E.tx.id, ...tickets.map((x) => x.tx.id),
        ],
        addresses: [tips, main, ...releases.map((x) => x.addr), sup, perso, v2, v3, v4, v5, ltcAddr, cvRes.deposit, order.deposit, E.addr, ...tickets.map((x) => x.addr), sleeper.addr],
        debrief:
          `1. OSINT : le profil PGP ${de(handle)} publie l'adresse ${A(w, tips)}. Elle reçoit de vieux pourboires, ${nDirect + lateDirects.length} ventes hors marché (dont celle ${de(client.name)}, confirmée par l'extraction de son téléphone) et de la poussière, mais rien du séquestre.\n` +
          `2. Cette adresse est dépensée lors du 2ᵉ regroupement vers ${A(w, main)} (adresse de la première libération, réutilisée), avec des adresses recevant des libérations du séquestre d'Abysse : même portefeuille.\n` +
          `3. Trois regroupements soudent le cluster : ${nRel} libérations, ${amt(totalReleased, 'BTC')} au total. La libération de ${amt(ucRelease.value, 'BTC')} du ${fmtShort(ucRelease.tx.time)} (${ucRelease.tx.hash.slice(0, 12)}…) correspond à l'achat sous pseudonyme (−${Math.round(MARKET_FEE * 100)} %).\n` +
          `4. Entre les regroupements${supAfter ? ' et après le dernier' : ''}, l'adresse principale paie le fournisseur ${A(w, sup)} (${amt(supTotal, 'BTC')} en ${supTxs.length} versements ronds, calés sur les annonces de rupture et de réassort ; adresse qui encaisse aussi d'autres revendeurs), ${packTx ? 'des sachets sous vide chez SousVidePro, ' : ''}et le portefeuille personnel ${A(w, perso)} (${amt(persoTotal, 'BTC')}, qui sert aux dépenses courantes : paiements ${persoList}). Les poussières reçues ne sont jamais dépensées.\n` +
          `5. Sorties en cascade, chacune financée par le rendu de la précédente : ${amt(lsValue, 'BTC')} vers le séquestre Hodl Hodl (au milieu d'autres séquestres financés du même montant dans l'heure), ${amt(swapValue, 'BTC')} échangés chez ChangeNOW contre ${amt(order.payoutValue, 'LTC')} reçus ${swapDelayMin} min plus tard sur ${A(w, ltcAddr)}, puis deux dépôts Coinhouse sur la même adresse de dépôt (${amt(cvTotal, 'BTC')}).\n` +
          `6. Fausses pistes au bout de la chaîne : trois branches détachées de ${A(w, v5)} (${branches.map((b) => fateText(b)).join(' ; ')}), puis trois tranches jumelles d'environ ${amt(tranche, 'BTC')} en ${trSpanMin} minutes : l'une revient au vendeur, l'autre finit au casino, une seule (${A(w, E.addr)}) paie ${nT} ticket${nT > 1 ? 's' : ''} de DAB CryptoGuichet, ${amt(atmTotal, 'BTC')} (≈ ${atmEur.toLocaleString('fr-FR')} €) remis en espèces dans des bureaux de tabac. Il reste ${amt(v5Final, 'BTC')} sur ${A(w, v5)} et ${amt(sleeper.value, 'BTC')} sur la branche dormante.\n\n` +
          `Leçon : face à un marché darknet, le point d'entrée est presque toujours côté vendeur (OSINT, adresse publiée, achat sous pseudonyme, téléphone d'un client). Le clustering transforme une adresse en portefeuille complet, mais il faut trier : séquestre ou vente directe, fournisseur ou portefeuille personnel, branche morte ou continuation. Les montants identiques à la même heure ne départagent rien ; c'est le devenir de chaque destination qui tranche. La sortie finale n'est pas ici un exchange mais des espèces : la piste se poursuit par les tickets, le numéro de téléphone et la vidéosurveillance de l'exploitant de DAB, à requérir sans délai, en parallèle de Coinhouse. Le rapprochement avec l'échangeur instantané reste une présomption jusqu'à sa réponse.`,
      },
      hints: [
        'L\'adresse BTC du profil PGP est votre point d\'entrée : ajoutez-la au graphe et cherchez la transaction qui la dépense.',
        'Ouvrez le panneau cluster de l\'adresse de regroupement : il liste les adresses de libération. Ne comptez que ce qui vient du séquestre.',
        'Les petites sorties de l\'adresse principale ne vont pas toutes au même type de destinataire : comparez leur historique et les dates du fil « Disponibilités ».',
        'Après les regroupements, suivez le rendu de chaque transaction : P2P, échangeur instantané (corrélation sur LTC), puis exchange régulé.',
        'Au bout de la chaîne, des montants identiques partent à la même heure : dépliez chaque destination sur plusieurs jours avant de conclure.',
      ],
    }
  },
}
