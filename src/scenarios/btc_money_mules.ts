import { World, type Tx } from '../engine/world'
import { exchange, swapper, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { fromUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import { dusting, personalSpending, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor, type FakePerson } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

/** Heure de bureau (≈ 9 h – 17 h à Paris) le jour de `t` : plaintes, réponses et notes ne sont pas datées de la nuit. */
const office = (t: number) => Math.floor(t / 86400) * 86400 + 8 * 3600 + (t % (7 * 3600))
/** Arrondi par défaut à 8 décimales : la sortie ne dépasse jamais les entrées. */
const f8 = (v: number) => Math.floor(v * 1e8) / 1e8
/** Cours de conversion figé (les virements des victimes sont en euros). */
const EUR_USD = 1.08
const eur = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const heure = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
/** Durée lisible : « 47 min », « 2 h 05 ». */
const duree = (sec: number) => {
  const m = Math.round(sec / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
/** « A », « A et B », « A, B et C ». */
const liste = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}` : xs[0] ?? '')

type Plat = 'coinhouse' | 'bitstamp'
type Coin = 'btc' | 'ltc'
const ASSET: Record<Coin, AssetId> = { btc: 'BTC', ltc: 'LTC' }

interface Wire {
  t: number
  victim: FakePerson
  eur: number
  label: string
}
interface Withdrawal {
  tx: Tx
  addr: string
  value: number
}
interface Mule {
  p: FakePerson
  age: number
  city: string
  study: string
  plat: Plat
  coin: Coin
  role: 'net' | 'hidden' | 'decoy' | 'gambler'
  renewed: boolean
  addrs: string[]
  wires: Wire[]
  wd: Withdrawal[]
  commission: number
  opened: number
  /** Portefeuille personnel de la mule (sa propre épargne, sans lien avec le réseau). */
  own?: string
  ownWd: Withdrawal[]
}

const STUDIES = ['en licence de droit', 'en BTS commerce', 'en BUT GEA', 'en licence STAPS', 'en école de commerce', 'en BUT informatique', 'en licence de psychologie', 'en BTS NDRC', 'en licence d\'économie']
const EUR_AMOUNTS = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7500]

export const btcMoneyMules: ScenarioTemplate = {
  id: 'money-mules',
  title: 'Le réseau de mules',
  tagline: 'Des étudiants, des virements, des adresses de collecte… des vies ordinaires à écarter, et un seul portefeuille derrière.',
  description:
    'Les victimes d\'un faux placement ont viré leur épargne sur des comptes de particuliers. Ces « mules », recrutées sur les réseaux sociaux, achètent du bitcoin ou du litecoin et l\'envoient au coordinateur, tout en gardant leur propre vie (épargne, achats, jeux en ligne). Triez les retraits, rattachez les adresses de collecte au même portefeuille, écartez les fausses pistes, démêlez l\'éclatement en quatre parts égales et suivez la peel chain jusqu\'au cash-out (OTC, P2P).',
  difficulty: 3,
  chains: ['btc', 'ltc'],
  skills: ['cioh', 'exchange_id', 'requisition', 'typologies', 'peel'],
  estMinutes: 75,
  lessons: ['blanchiment-pro', 'clustering', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const year = new Date(w.t0 * 1000).getUTCFullYear()
    const scamName = r.pick(['Atlas Patrimoine', 'Hélios Capital', 'Orvia Invest', 'Nordwell Gestion', 'Valmont Épargne'])
    const bank = r.pick(['Kélia', 'Novabanq', 'Fluxeo'])
    const tgGroup = r.pick(['Job Facile FR', 'Missions Étudiants', 'Revenus Express', 'Side Money FR'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const kits: Record<Plat, Record<Coin, ExchangeKit>> = {
      coinhouse: { btc: exchange(w, 'coinhouse', 'btc'), ltc: exchange(w, 'coinhouse', 'ltc') },
      bitstamp: { btc: exchange(w, 'bitstamp', 'btc'), ltc: exchange(w, 'bitstamp', 'ltc') },
    }
    const platName = (p: Plat) => kits[p].btc.entity.name
    const exKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const exKit = exchange(w, exKey, 'btc')
    const exName = exKit.entity.name
    const casino = exchange(w, 'orbit', 'btc')
    const swp = swapper(w, 'changenow')
    const hodl = w.entity('hodlhodl')
    const otc = w.entity('satsdesk')
    const otcAddr = w.addr('btc', { entity: otc, label: 'SatsDesk OTC — Adresse de règlement', tags: ['liquid'], kind: 'p2wpkh' })
    const coord = w.customEntity({ name: `Coordinateur « ${handle} »`, category: 'suspect', description: 'Recruteur et coordinateur du réseau de mules (identité inconnue).' })
    const escrow = () => w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })

    const usedNames = new Set<string>()
    const newPerson = (): FakePerson => {
      let p = fakePerson(r)
      while (usedNames.has(p.name)) p = fakePerson(r)
      usedNames.add(p.name)
      return p
    }

    // ── Victimes et mules ────────────────────────────────────────────────────
    const nV = r.int(5, 8)
    const victims = Array.from({ length: nV }, () => newPerson())
    const LABELS = ['Placement', 'Investissement', `Souscription ${scamName}`, 'Versement contrat', 'Apport capital']
    const newWires = (k: number, from: number, to: number): Wire[] =>
      Array.from({ length: k }, () => ({ t: w.at(-r.float(from, to) * 24), victim: r.pick(victims), eur: r.pick(EUR_AMOUNTS), label: r.pick(LABELS) })).sort((a, b) => a.t - b.t)

    const nNet = r.int(5, 8)
    const nLtc = r.int(1, 2)
    const nIdentBtc = nNet - 1 - nLtc
    const mkMule = (role: Mule['role'], coin: Coin, plat: Plat, renewed = false): Mule => {
      const p = newPerson()
      const study = role === 'decoy'
        ? `${p.g('alternant', 'alternante')} ${r.pick(['en comptabilité', 'en logistique', 'dans une agence immobilière'])}`
        : role === 'gambler'
          ? `${p.g('employé', 'employée')} ${r.pick(['dans la restauration rapide', 'en grande surface', 'dans un entrepôt logistique'])}`
          : `${p.g('étudiant', 'étudiante')} ${r.pick(STUDIES)}`
      return { p, age: role === 'decoy' || role === 'gambler' ? r.int(22, 29) : r.int(19, 23), city: fakeCity(r), study, plat, coin, role, renewed, addrs: [], wires: [], wd: [], commission: r.pick([0.08, 0.1, 0.12]), opened: 0, ownWd: [] }
    }
    const plats: Plat[] = r.shuffle<Plat>(['coinhouse', 'bitstamp', ...Array.from({ length: nIdentBtc + nLtc - 2 }, () => r.pick(['coinhouse', 'bitstamp'] as const))])
    const ident: Mule[] = []
    for (let i = 0; i < nIdentBtc; i++) ident.push(mkMule('net', 'btc', plats[i], i === 0))
    for (let i = 0; i < nLtc; i++) ident.push(mkMule('net', 'ltc', plats[nIdentBtc + i]))
    const hidden = mkMule('hidden', 'btc', r.pick(['coinhouse', 'bitstamp'] as const))
    const decoy = mkMule('decoy', 'btc', r.pick(['coinhouse', 'bitstamp'] as const))
    const gambler = mkMule('gambler', 'btc', r.pick(['coinhouse', 'bitstamp'] as const))
    const renewedMule = ident[0]
    const ltcMules = ident.filter((m) => m.coin === 'ltc')
    const network = [...ident, hidden]

    // Adresses de collecte : une par recrue (deux pour la mule dont l'adresse a été renouvelée)
    for (const m of network) {
      for (let i = 0; i < (m.renewed ? 2 : 1); i++) m.addrs.push(w.addr(m.coin, { entity: coord, kind: 'p2wpkh' }))
      if (m === hidden) {
        // Deux vagues de virements nettement séparées
        m.wires = [...newWires(1, 22, 32), ...newWires(r.int(1, 2), 9, 16)].sort((a, b) => a.t - b.t)
      } else m.wires = newWires(m.renewed ? r.int(3, 4) : r.int(2, 4), 9, 32)
      m.opened = m.wires[0].t - r.int(3, 20) * DAY
    }
    // Vie propre de certaines mules : un portefeuille personnel, alimenté par de petits achats
    const btcIdent = ident.filter((m) => m.coin === 'btc')
    const withOwn = [renewedMule, ...r.pickN(btcIdent.filter((m) => m !== renewedMule), Math.min(btcIdent.length - 1, r.int(1, 2)))]
    for (const m of withOwn) m.own = w.addr('btc', { entity: w.customEntity({ name: m.p.name, category: 'individual' }), kind: r.pick(['p2wpkh', 'p2tr'] as const) })

    // Fausse piste n°1 : une titulaire qui épargne en bitcoin depuis des mois
    const decoyE = w.customEntity({ name: decoy.p.name, category: 'individual' })
    decoy.addrs.push(w.addr('btc', { entity: decoyE, kind: r.pick(['p2wpkh', 'p2tr', 'p2sh'] as const) }))
    decoy.wires = [{ t: w.at(-r.float(12, 28) * 24), victim: r.pick(victims), eur: r.pick([600, 800, 1200, 1500]), label: r.pick(['Remboursement prêt', 'Remboursement', 'Part loyer']) }]
    const nDca = r.int(7, 11)
    const dcaEur = r.pick([50, 100, 150])
    decoy.opened = w.at(-(nDca + 1) * 30 * 24)
    // Fausse piste n°2 : un joueur qui a vendu un objet à une victime et joue tout au casino
    const casinoDep = casino.newDeposit()
    gambler.addrs.push(casinoDep)
    const saleLabel = r.pick(['Vente console', 'Achat iPhone', 'Vente vélo électrique', 'Achat billets concert'])
    gambler.wires = [{ t: w.at(-r.float(14, 26) * 24), victim: r.pick(victims), eur: r.pick([350, 450, 600, 850]), label: saleLabel }]
    const nBets = r.int(4, 6)
    gambler.opened = w.at(-r.float(150, 300) * 24)

    const coinFor = (e: number, coin: Coin) => roundAsset(ASSET[coin], fromUsd(ASSET[coin], e * EUR_USD * 0.985))

    // ── Achats et retraits (ordre chronologique) ─────────────────────────────
    type Ev = { t: number; mule: Mule; addr: string; value: number; own?: boolean }
    const evs: Ev[] = []
    for (const m of network) {
      const half = Math.ceil(m.wires.length / 2)
      m.wires.forEach((wi, i) => evs.push({ t: Math.round(wi.t + r.float(3, 26) * HOUR), mule: m, addr: m.renewed && i >= half ? m.addrs[1] : m.addrs[0], value: coinFor(wi.eur * (1 - m.commission), m.coin) }))
    }
    for (const m of withOwn) {
      for (let k = 0; k < r.int(1, 3); k++) evs.push({ t: Math.round(m.opened + r.float(1, 40) * DAY), mule: m, addr: m.own!, value: coinFor(r.pick([40, 60, 80, 100, 150]), 'btc'), own: true })
    }
    for (let i = 0; i < nDca; i++) evs.push({ t: Math.round(decoy.opened + (i + 1) * 30 * DAY + r.float(-1, 1) * DAY), mule: decoy, addr: decoy.addrs[0], value: coinFor(dcaEur, 'btc') })
    evs.push({ t: Math.round(decoy.wires[0].t + r.float(20, 60) * HOUR), mule: decoy, addr: decoy.addrs[0], value: coinFor(decoy.wires[0].eur, 'btc') })
    // Le joueur dépose depuis longtemps : sa première mise précède de loin les premiers virements des victimes
    for (let i = 0; i < nBets; i++) evs.push({ t: Math.round(w.at(-(i === 0 ? r.float(45, 70) : r.float(5, 70)) * 24)), mule: gambler, addr: casinoDep, value: coinFor(r.pick([100, 150, 200, 300, 400]), 'btc') })
    evs.push({ t: Math.round(gambler.wires[0].t + r.float(4, 30) * HOUR), mule: gambler, addr: casinoDep, value: coinFor(gambler.wires[0].eur, 'btc') })
    evs.sort((a, b) => a.t - b.t)
    for (const e of evs) {
      const tx = kits[e.mule.plat][e.mule.coin].withdraw(e.addr, e.value, e.t)
      ;(e.own ? e.mule.ownWd : e.mule.wd).push({ tx, addr: e.addr, value: e.value })
    }
    // Le casino balaie le dépôt du joueur
    casino.sweep([casinoDep], Math.max(...gambler.wd.map((x) => x.tx.time)) + Math.round(r.float(2, 12) * HOUR))

    const consolidate = (from: string[], t: number, to: string, coin: Coin): Tx => {
      const nIn = from.reduce((s, a) => s + w.utxosOf(a, t).length, 0)
      const total = from.reduce((s, a) => s + w.unspentValue(a, t), 0)
      const fee = w.estimateFee(coin, nIn, 1)
      return w.utxoTx({ time: t, from: r.shuffle([...from]), to: [{ address: to, value: f8(total - fee) }], fee, change: null, spendAll: true, method: 'consolidation', tags: ['consolidation'] })
    }

    // ── Regroupement n°1 (BTC) : une adresse « pont » est dépensée avant et après ──
    const btcNet = network.filter((m) => m.coin === 'btc')
    const btcCollect = btcNet.flatMap((m) => m.addrs)
    const ltcCollect = ltcMules.flatMap((m) => m.addrs)
    const pairs: { m: Mule; j: number }[] = []
    for (const m of btcNet) {
      if (m.renewed) continue
      for (let j = 0; j < m.wd.length - 1; j++) if (m.wd[j + 1].tx.time - m.wd[j].tx.time > 6 * HOUR) pairs.push({ m, j })
    }
    const bp = r.pick(pairs)
    const bridgeAddr = bp.m.addrs[0]
    const T1 = Math.round(bp.m.wd[bp.j].tx.time + (bp.m.wd[bp.j + 1].tx.time - bp.m.wd[bp.j].tx.time) * r.float(0.3, 0.7))
    const cons = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
    // La consolidation n'est pas neuve : elle a servi pour une vague antérieure (autres victimes)
    // (entrées puis sorties écrites à la main : un règlement OTC et des ventes P2P, chaque séquestre servant une fois et étant libéré)
    const consPrev = priorHistory(w, cons, { start: T1 - 75 * DAY, end: T1 - 25 * DAY, nIn: r.int(5, 6), nOut: 0, maxUsd: 4500 })
    const nPrevOut = r.int(3, 4)
    const prevStart = consPrev.txs[0].time + DAY
    const prevTimes = Array.from({ length: nPrevOut }, () => Math.round(r.float(prevStart, T1 - 22 * DAY))).sort((a, b) => a - b)
    const prevKinds = r.shuffle<'otc' | 'p2p'>(['otc', ...Array.from({ length: nPrevOut - 1 }, () => 'p2p' as const)])
    prevTimes.forEach((tp, i) => {
      const avail = w.unspentValue(cons, tp)
      const v = prevKinds[i] === 'otc' ? Math.floor(avail * r.float(0.3, 0.45) * 100) / 100 : Math.floor(avail * r.float(0.1, 0.22) * 1e4) / 1e4
      if (v < 0.001 || avail < v + 0.0003) return
      const to = prevKinds[i] === 'otc' ? otcAddr : escrow()
      consPrev.txs.push(w.utxoTx({ time: tp, from: [cons], to: [{ address: to, value: v }], change: cons, autoFund: false }))
      if (prevKinds[i] === 'p2p') forwardAll(w, to, w.addr('btc'), Math.round(tp + r.float(1, 10) * HOUR), undefined, ['escrow-release'])
    })
    const c1 = consolidate(btcCollect.filter((a) => w.utxosOf(a, T1).length > 0), T1, cons, 'btc')

    // ── Volet Litecoin : regroupement puis swap ChangeNOW LTC → BTC ─────────
    const ltcCons = w.addr('ltc', { entity: coord, kind: 'p2wpkh' })
    const lastLtc = Math.max(...ltcMules.flatMap((m) => m.wd.map((x) => x.tx.time)))
    const tLtcC = Math.round(lastLtc + r.float(6, 20) * HOUR)
    priorHistory(w, ltcCons, { start: tLtcC - 60 * DAY, end: tLtcC - 20 * DAY, nIn: r.int(4, 5), nOut: r.int(3, 4), maxUsd: 1500 })
    const ltcC = consolidate(ltcCollect, tLtcC, ltcCons, 'ltc')
    const swapT = Math.round(ltcC.time + r.float(1, 5) * HOUR)
    const swapValue = f8(w.unspentValue(ltcCons, swapT) - 0.0002)
    const btcHot = swp.hot('btc')
    const expectUsd = usd('LTC', swapValue) * 0.985
    const swapDecoy = (t: number) => {
      const sign = r.chance(0.5) ? 1 : -1
      const factor = r.chance(0.5) ? 1 + sign * r.float(0.07, 0.35) : r.float(0.05, 3)
      const fct = Math.abs(factor - 1) < 0.07 ? 1.4 : factor
      w.utxoTx({ time: t, from: [btcHot], to: [{ address: w.addr('btc'), value: roundAsset('BTC', fromUsd('BTC', expectUsd * fct)) }], change: btcHot, tags: ['payout'] })
    }
    for (let i = 0; i < r.int(3, 5); i++) swapDecoy(swapT - r.int(5, 120) * 60)
    const order = swp.order({ from: ltcCons, value: swapValue, time: swapT, toChain: 'btc', recipient: cons, change: null, decoys: 0, delayMin: [8, 40] })
    for (let i = 0; i < r.int(4, 7); i++) swapDecoy(swapT + r.int(45, 200) * 60)
    // Paiement jumeau : un autre client de ChangeNOW reçoit presque le même montant, à quelques minutes près
    const twinPayAddr = w.addr('btc')
    const twinPay = w.utxoTx({ time: order.payoutTx.time + r.int(4, 30) * 60, from: [btcHot], to: [{ address: twinPayAddr, value: roundAsset('BTC', order.payoutValue * (1 + r.pick([-1, 1]) * r.float(0.002, 0.009))) }], change: btcHot, tags: ['payout'] })

    // ── Regroupement n°2 : l'adresse de consolidation se réutilise en entrée ─
    const lastBtc = Math.max(...btcNet.flatMap((m) => m.wd.map((x) => x.tx.time)))
    const T2 = Math.round(Math.max(lastBtc, order.payoutTx.time, T1) + r.float(8, 30) * HOUR)
    const c2 = consolidate([cons, ...btcCollect.filter((a) => w.utxosOf(a, T2).length > 0)], T2, cons, 'btc')
    const aggregate = w.unspentValue(cons)

    // ── Éclatement en quatre parts quasi égales, puis quatre transferts jumeaux ──
    const tF = Math.round(c2.time + r.float(8, 20) * HOUR)
    const feeF = w.estimateFee('btc', 1, 4)
    const base = (aggregate - feeF) / 4
    const N = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
    const Hd = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
    const Hs = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
    const Hc = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
    const heads = r.shuffle([N, Hd, Hs, Hc])
    const parts = heads.map(() => f8(base * (1 + r.float(-0.003, 0.003))))
    parts[3] = f8(aggregate - feeF - parts[0] - parts[1] - parts[2])
    const fan = w.utxoTx({ time: tF, from: [cons], to: heads.map((a, i) => ({ address: a, value: parts[i] })), fee: feeF, change: null, spendAll: true, tags: ['split'] })
    const tFw = tF + Math.round(r.float(1, 3) * HOUR)
    const next = new Map<string, string>()
    const fwd = new Map<string, Tx>()
    for (const h of heads) {
      const nx = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
      next.set(h, nx)
      fwd.set(h, forwardAll(w, h, nx, tFw + r.int(-25, 25) * 60))
    }
    const N2 = next.get(N)!
    const Xd = next.get(Hd)!
    const Xs = next.get(Hs)!
    const Xc = next.get(Hc)!
    // Branches sans issue : Xd dort, Xs se ré-éclate, Xc part au casino
    const xsT = fwd.get(Hs)!.time + Math.round(r.float(6, 30) * HOUR)
    const xsSubs = Array.from({ length: 3 }, () => w.addr('btc', { entity: coord, kind: 'p2wpkh' }))
    const xsFee = w.estimateFee('btc', 1, 3)
    const xsVal = w.unspentValue(Xs, xsT)
    const xsSplit = w.utxoTx({ time: xsT, from: [Xs], to: xsSubs.map((a, i) => ({ address: a, value: i < 2 ? f8((xsVal - xsFee) / 3) : f8(xsVal - xsFee - 2 * f8((xsVal - xsFee) / 3)) })), fee: xsFee, change: null, spendAll: true })
    const coordCasinoDep = casino.newDeposit()
    const xcTx = forwardAll(w, Xc, coordCasinoDep, fwd.get(Hc)!.time + Math.round(r.float(3, 20) * HOUR))
    casino.sweep([coordCasinoDep], xcTx.time + Math.round(r.float(1, 6) * HOUR))

    // ── Peel chain : OTC, séquestres P2P, portefeuille personnel et une erreur ──
    type PT = 'otc' | 'p2p' | 'ex' | 'own'
    const plan: PT[] = r.shuffle<PT>([
      ...Array.from({ length: r.int(2, 3) }, () => 'otc' as PT),
      ...Array.from({ length: r.int(2, 3) }, () => 'p2p' as PT),
    ])
    plan.splice(r.int(1, plan.length - 1), 0, 'own')
    plan.splice(r.int(2, plan.length), 0, 'ex')
    plan.push('p2p') // dernière pelure : une vente P2P
    const FR: Record<PT, [number, number]> = { otc: [0.16, 0.26], p2p: [0.04, 0.08], ex: [0.025, 0.045], own: [0.03, 0.06] }
    const P = w.addr('btc', { entity: coord, kind: 'p2tr' }) // portefeuille personnel du coordinateur
    const peels: { tx: Tx; type: PT; to: string; value: number }[] = []
    const hops: string[] = [N2]
    const releases: Tx[] = []
    let exSweep: Tx | undefined
    let cur = N2
    let t = Math.round(fwd.get(N)!.time + r.float(4, 20) * HOUR)
    for (const pt of plan) {
      const bal = w.unspentValue(cur, t)
      const raw = bal * r.float(FR[pt][0], FR[pt][1])
      const value = pt === 'otc' ? Math.floor(raw * 100) / 100 : pt === 'p2p' ? Math.floor(raw * 1e4) / 1e4 : r8(raw)
      let to: string
      if (pt === 'otc') to = otcAddr
      else if (pt === 'p2p') to = escrow()
      else if (pt === 'ex') to = exKit.newDeposit()
      else to = P
      const nx = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
      const tx = w.utxoTx({ time: t, from: [cur], to: [{ address: to, value }], change: nx, spendAll: true, tags: ['peel'] })
      peels.push({ tx, type: pt, to, value })
      if (pt === 'p2p') releases.push(forwardAll(w, to, w.addr('btc'), Math.round(t + r.float(1, 10) * HOUR), undefined, ['escrow-release']))
      if (pt === 'ex') exSweep = exKit.sweep([to], Math.round(t + r.float(0.5, 3) * HOUR))[0]
      cur = nx
      hops.push(nx)
      t = Math.round(t + r.float(4, 30) * HOUR)
    }
    const remainder = cur
    const remainderValue = w.unspentValue(remainder)
    const tBank = office(Math.round(Math.max(...evs.map((e) => e.t)) + r.float(2, 4) * DAY))

    // ── Habillage (après le flux) ────────────────────────────────────────────
    // Portefeuille personnel du coordinateur : vie antérieure, puis dépenses avec la pelure reçue
    const ownPeel = peels.find((p) => p.type === 'own')!
    priorHistory(w, P, { start: w.at(-150 * 24), end: w.at(-30 * 24), nIn: r.int(4, 5), nOut: 3, maxUsd: 900 })
    // Ses dépenses trahissent le métier : hébergement du faux site, numéros virtuels des « conseillers », cartes cadeaux
    const hostE = w.customEntity({ name: `${r.pick(['Hostinova', 'NimbusHost', 'Serveo Cloud'])}`, category: 'merchant', known: true, description: 'Hébergeur web payable en bitcoin (fictif) ; conserve l\'adresse électronique du compte, les noms de domaine hébergés et les IP de connexion.' })
    const simE = w.customEntity({ name: `${r.pick(['NumeroFlash', 'VirtuaSIM'])}`, category: 'merchant', known: true, description: 'Vente de numéros de téléphone virtuels et d\'eSIM payables en crypto (fictif) ; conserve l\'adresse électronique de commande et les numéros attribués.' })
    const giftE = w.customEntity({ name: `${r.pick(['Kadolib', 'BonCadeau Express'])}`, category: 'merchant', known: true, description: 'Revendeur en ligne de cartes cadeaux payables en bitcoin (fictif) ; le code est livré par courriel.' })
    const pSpend = personalSpending(w, P, { start: ownPeel.tx.time + 6 * HOUR, end: ownPeel.tx.time + 18 * DAY, n: r.int(3, 4), merchants: [hostE, simE, giftE], maxUsd: Math.min(600, usd('BTC', ownPeel.value) * 0.3) })
    // Vie des mules : petits achats courants depuis leur portefeuille personnel
    const keysE = w.customEntity({ name: 'PixelKeys', category: 'merchant', known: true, description: 'Boutique en ligne de clés de jeux vidéo payables en bitcoin (fictif).' })
    const topupE = w.customEntity({ name: 'RechargeZen', category: 'merchant', known: true, description: 'Recharges de forfaits mobiles prépayés payables en bitcoin (fictif).' })
    for (const m of withOwn) {
      const first = Math.min(...m.ownWd.map((x) => x.tx.time))
      personalSpending(w, m.own!, { start: first + DAY, end: first + 30 * DAY, n: r.int(2, 3), merchants: [keysE, topupE], maxUsd: 60 })
    }
    dusting(w, cons, { time: c2.time + 12 * HOUR, n: 2, spreadH: 10 })
    // Poussière d'adresses de collecte et de sauts (robots qui sondent les adresses actives) : jamais dépensée
    for (const m of network) for (const a of m.addrs) dusting(w, a, { time: m.wd.find((x) => x.addr === a)!.tx.time + 20 * HOUR, n: 1, spreadH: 18 })
    for (const h of r.pickN(hops.slice(0, -1), Math.min(3, hops.length - 1))) dusting(w, h, { time: (w.txsOf(h)[0]?.time ?? t) + 30 * HOUR, n: 1, spreadH: 12 })
    dusting(w, remainder, { time: t + 2 * DAY, n: 2, spreadH: 24 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    const span0 = w.at(-40 * 24)
    const span1 = w.at(12 * 24)
    kits.coinhouse.btc.noise(14, span0, span1)
    kits.bitstamp.btc.noise(10, span0, span1)
    kits.coinhouse.ltc.noise(5, span0, span1)
    kits.bitstamp.ltc.noise(4, span0, span1)
    exKit.noise(10, c2.time - 3 * DAY, t + 6 * DAY)
    casino.noise(6, span0, span1)
    for (let i = 0; i < r.int(4, 6); i++) {
      // Autres clients de SatsDesk
      const u = w.addr('btc')
      const ti = Math.round(r.float(c2.time - 6 * DAY, t + 4 * DAY))
      w.fund(u, roundCoin(w, 0.3, 2.5, 0.01), ti - r.int(2, 48) * HOUR)
      w.utxoTx({ time: ti, from: [u], to: [{ address: otcAddr, value: Math.floor(w.unspentValue(u, ti) * r.float(0.6, 0.9) * 100) / 100 }] })
    }
    for (let i = 0; i < r.int(4, 6); i++) {
      // Autres transactions P2P sur Hodl Hodl
      const u = w.addr('btc')
      const ti = Math.round(r.float(c2.time - 6 * DAY, t + 4 * DAY))
      w.fund(u, roundCoin(w, 0.01, 0.2, 0.001), ti - r.int(2, 72) * HOUR)
      const esc = escrow()
      w.utxoTx({ time: ti, from: [u], to: [{ address: esc, value: Math.floor(w.unspentValue(u, ti) * r.float(0.4, 0.9) * 1e4) / 1e4 }] })
      forwardAll(w, esc, w.addr('btc'), Math.round(ti + r.float(1, 12) * HOUR), undefined, ['escrow-release'])
    }

    // ── Chiffres ─────────────────────────────────────────────────────────────
    const netWd = network.flatMap((m) => m.wd.map((x) => ({ ...x, coin: m.coin })))
    const btcTotal = r8(netWd.filter((x) => x.coin === 'btc').reduce((s, x) => s + x.value, 0))
    const ltcTotal = r8(netWd.filter((x) => x.coin === 'ltc').reduce((s, x) => s + x.value, 0))
    const totalUsd = Math.round(usd('BTC', btcTotal) + usd('LTC', ltcTotal))
    const wiresTotal = network.reduce((s, m) => s + m.wires.reduce((a, x) => a + x.eur, 0), 0)
    const otcPeels = peels.filter((p) => p.type === 'otc')
    const p2pPeels = peels.filter((p) => p.type === 'p2p')
    const otcTotal = r8(otcPeels.reduce((s, p) => s + p.value, 0))
    const p2pTotal = r8(p2pPeels.reduce((s, p) => s + p.value, 0))
    const exPeel = peels.find((p) => p.type === 'ex')!
    const exDeposit = exPeel.to
    const exIdx = peels.indexOf(exPeel) + 1
    const ownIdx = peels.indexOf(ownPeel) + 1
    const nAddrBtc = btcCollect.length
    const renewT = renewedMule.wd.find((x) => x.addr === renewedMule.addrs[1])!.tx.time
    const hiddenPlat = platName(hidden.plat)
    const victimsUsed = new Set(network.flatMap((m) => m.wires.map((x) => x.victim.name)))
    // Mule non signalée : retraits reçus et regroupement(s) où son adresse est co-dépensée
    const hiddenAddr = hidden.addrs[0]
    const hiddenTotal = r8(hidden.wd.reduce((s, x) => s + x.value, 0))
    const hiddenIn = [c1, c2].filter((c) => c.inputs.some((i) => i.address === hiddenAddr)).map((c) => (c === c1 ? 'n°1' : 'n°2'))
    const swapDelayMin = Math.round((order.payoutTx.time - order.depositTx.time) / 60)
    const lastHopAddr = hops[hops.length - 1]
    const ownTotal = r8(withOwn.reduce((s, m) => s + m.ownWd.reduce((a, x) => a + x.value, 0), 0))
    const consPrevIn = consPrev.txs.filter((x) => x.outputs.some((o) => o.address === cons) && !x.inputs.some((i) => i.address === cons)).length
    const ownNames = withOwn.length > 1 ? `${withOwn.slice(0, -1).map((m) => m.p.name).join(', ')} et ${withOwn[withOwn.length - 1].p.name}` : withOwn[0].p.name
    const consPrevOuts = consPrev.txs.filter((x) => x.inputs.some((i) => i.address === cons))
    const consPrevOut = consPrevOuts.length
    const hitOtc = consPrevOuts.some((x) => x.outputs.some((o) => o.address === otcAddr))
    const hitP2p = consPrevOuts.some((x) => x.outputs.some((o) => w.get(o.address).entityId === hodl.id))
    const consPrevDest = hitOtc && hitP2p ? 'vers SatsDesk et des séquestres Hodl Hodl' : hitOtc ? 'vers SatsDesk' : 'vers des séquestres Hodl Hodl'
    const twinRows = heads.map((h) => ({ h, tx: fwd.get(h)! })).sort((a, b) => a.tx.time - b.tx.time)
    const sleeping = r8(w.unspentValue(Xd) + xsSubs.reduce((s, a) => s + w.unspentValue(a), 0))
    // Premier regroupement et paiement ChangeNOW : dans l'ordre réel
    const consEvents = [
      { t: c1.time, txt: `le premier regroupement (${c1.inputs.length} entrées)` },
      { t: order.payoutTx.time, txt: 'le paiement ChangeNOW issu des LTC' },
    ].sort((a, b) => a.t - b.t)
    // Éclatement : délais réels entre la répartition et les quatre transferts
    const fwdDelays = twinRows.map((x) => x.tx.time - fan.time)
    const fwdDay0 = fmtDate(twinRows[0].tx.time, false)
    const fwdDay1 = fmtDate(twinRows[twinRows.length - 1].tx.time, false)
    const fwdWhen = fwdDay0 === fwdDay1 ? `Le ${fwdDay0}` : `Entre le ${fwdDay0} et le ${fwdDay1}`
    // Commerçants réellement payés par le portefeuille personnel du coordinateur
    const pShops = [...new Set(pSpend.addresses.map((a) => w.get(a).entityId).filter((x): x is string => !!x))].map((id) => w.entities.get(id)!)
    const pToPeople = pSpend.addresses.filter((a) => !w.get(a).entityId).length
    const shopKind = (e: typeof hostE) => (e === hostE ? 'hébergeur web' : e === simE ? 'numéros virtuels' : 'cartes cadeaux')
    const pShopText = pShops.length
      ? `il paie ensuite ${liste(pShops.map((e) => `${e.name} (${shopKind(e)})`))}${pToPeople ? `, ainsi ${pToPeople > 1 ? 'que des particuliers' : "qu'un particulier"}` : ''}`
      : `il ne paie ensuite que ${pToPeople > 1 ? 'des particuliers' : 'un particulier'}`
    const pLead = pShops.find((e) => e === hostE) ?? pShops.find((e) => e === simE) ?? pShops[0]
    const pLeadText = pLead
      ? `Piste secondaire : ${pLead.name} conserve l'adresse électronique du compte client${pLead === hostE ? ' et les domaines hébergés (le faux site « ' + scamName + ' » ?)' : pLead === simE ? ' et les numéros attribués (ceux des faux « conseillers » ?)' : ''}.`
      : 'Piste secondaire limitée : les bénéficiaires sont des particuliers non identifiés.'
    const fateOf = (h: string) => (h === N ? 'peel chain vers le cash-out' : h === Hd ? 'ne bouge plus' : h === Hs ? 'se ré-éclate en trois' : 'déposée chez OrbitCasino')

    // ── Pièces ───────────────────────────────────────────────────────────────
    const reported = [...ident, decoy, gambler]
    const wireLines = reported
      .flatMap((m) => m.wires.map((x) => ({ m, x })))
      .sort((a, b) => a.x.t - b.x.t)
      .map(({ m, x }) => `• ${fmtDate(x.t, false)} — ${x.victim.name} → ${m.p.name} — ${eur(x.eur)} — libellé « ${x.label} »`)
      .join('\n')

    const muleBlock = (m: Mule, i: number): string => {
      const head =
        `${i}. ${m.p.name} — ${m.p.g('né', 'née')} en ${year - m.age}, ${m.study}, ${m.p.g('domicilié', 'domiciliée')} à ${m.city}.\n` +
        `   Compte ouvert le ${fmtDate(m.opened, false)} ; KYC vérifié (pièce d'identité, selfie, IBAN ${bank}).\n`
      if (m.role === 'decoy') {
        const vals = m.wd.map((x) => x.value)
        return (
          head +
          `   Achats programmés mensuels de ${eur(dcaEur)} depuis l'ouverture, plus un achat ponctuel de ${eur(m.wires[0].eur)}.\n` +
          `   Retraits BTC (liste exhaustive, résumée) : ${m.wd.length} retraits, tous vers ${A(w, m.addrs[0])}, du ${fmtDate(m.wd[0].tx.time, false)} au ${fmtDate(m.wd[m.wd.length - 1].tx.time, false)} (de ${amt(Math.min(...vals), 'BTC')} à ${amt(Math.max(...vals), 'BTC')}).`
        )
      }
      const all = [...m.wd, ...m.ownWd].sort((a, b) => a.tx.time - b.tx.time)
      const lines = all.map((x) => `   – ${fmtDate(x.tx.time)} — ${amt(x.value, ASSET[m.coin])} → ${A(w, x.addr)}`).join('\n')
      if (m.role === 'gambler') {
        return (
          head +
          `   Alimentation : virements de salaire mensuels depuis le compte ${bank}, et un virement de tiers de ${eur(m.wires[0].eur)}.\n` +
          `   Retraits BTC (liste exhaustive) :\n${lines}`
        )
      }
      return (
        head +
        `   Alimentation : ${m.wires.length} virements SEPA de tiers reçus sur le compte ${bank} (${eur(m.wires.reduce((s, x) => s + x.eur, 0))} au total), chacun suivi, quelques heures à un jour plus tard, d'un achat de ${ASSET[m.coin]} pour environ ${100 - Math.round(m.commission * 100)} % du montant reçu${m.own ? ', et quelques petits achats réguliers financés par son salaire' : ''}.\n` +
        `   Retraits ${ASSET[m.coin]} (liste exhaustive) :\n${lines}`
      )
    }
    const platResponse = (p: Plat): string =>
      reported.filter((m) => m.plat === p).map((m, i) => muleBlock(m, i + 1)).join('\n\n')

    const pctMule = Math.round(renewedMule.commission * 100)
    const g = renewedMule.p.g
    const decoyName = decoy.p.name
    const gamblerName = gambler.p.name
    const others = r.shuffle(ident.filter((m) => m.coin === 'btc'))
    const wrongPairs = [
      `${decoyName} et ${others[0].p.name}`,
      `${gamblerName} et ${(ltcMules[0] ?? others[1]).p.name}`,
      `${others[others.length > 1 ? 1 : 0].p.name} et ${(ltcMules[0] ?? others[0]).p.name}`,
    ]

    return {
      world: w,
      title: `Opération Comptes de passage — ${city}`,
      briefing:
        `Le parquet ${de(city)} a ouvert une enquête pour escroquerie en bande organisée et blanchiment après les plaintes de ${victimsUsed.size} épargnants, victimes d'une fausse plateforme de placement, « ${scamName} ». Leurs « conseillers » leur ont fait virer les fonds sur des comptes de particuliers, présentés comme des « gestionnaires partenaires ».\n\n` +
        `La néobanque ${bank} (fictive) a signalé plusieurs comptes ayant reçu des virements de ces victimes. Les réquisitions à Coinhouse et Bitstamp sont revenues avec l'identité des titulaires et la liste exhaustive de leurs retraits, y compris ceux qui n'ont rien à voir avec l'affaire. Une des mules a été entendue.\n\n` +
        `Objectifs : déterminer quels titulaires relèvent du réseau (et, s'il en manque, auprès de quelle plateforme les identifier), chiffrer la collecte sans y mêler la vie privée des mules, rattacher le volet Litecoin, suivre l'agrégat à travers son éclatement jusqu'au cash-out, mesurer ce qui reste et trouver le point de contact qui permettra d'identifier le coordinateur.`,
      evidence: [
        {
          id: 'banque', type: 'rapport', title: `Signalement de la néobanque ${bank} (extrait)`, date: tBank, author: `Service LCB-FT — ${bank}`,
          body:
            `Comptes de particuliers ayant reçu, en quelques semaines, des virements entrants de tiers, suivis de virements sortants vers des plateformes de crypto-actifs (Coinhouse SAS, Bitstamp Europe).\n\n` +
            `Virements entrants relevés :\n${wireLines}\n\n` +
            `Plusieurs donneurs d'ordre ont depuis déposé plainte pour escroquerie au faux placement « ${scamName} ». Les comptes bénéficiaires ont été clôturés. Ce signalement ne couvre que les clients de ${bank} et repose sur l'identité des donneurs d'ordre : il ne préjuge pas de la nature de chaque virement.`,
        },
        {
          id: 'coinhouse', type: 'rapport', title: 'Réponse de Coinhouse à réquisition', date: office(tBank + r.int(5, 9) * DAY), author: 'Service conformité de Coinhouse',
          body:
            `Réponse à la réquisition judiciaire visant les titulaires désignés par le signalement ${bank}. Coinhouse confirme la détention des comptes suivants.\n\n` +
            `${platResponse('coinhouse')}\n\n` +
            `Les fonds retirés ne sont plus sous la garde de Coinhouse. Aucune autre adresse de retrait n'est associée à ces comptes.`,
        },
        {
          id: 'bitstamp', type: 'rapport', title: 'Réponse de Bitstamp (coopération volontaire)', date: office(tBank + r.int(10, 16) * DAY), author: 'Service conformité de Bitstamp',
          body:
            `Réponse transmise au titre de la coopération volontaire (données de base). Les relevés complets et pièces KYC seront communiqués sur décision d'enquête européenne.\n\n` +
            `${platResponse('bitstamp')}`,
        },
        {
          id: 'annonce', type: 'capture', title: 'Annonce de recrutement (Snapchat puis Telegram)', date: renewedMule.opened - r.int(2, 10) * DAY, author: handle,
          body:
            `[Story Snapchat — compte « ${handle} »]\n` +
            `« T'es étudiant·e et t'as besoin de thunes ? 300 à 800 € par semaine depuis ton tel. Pas d'investissement, juste un compte bancaire et 15 min par jour. Écris-moi en privé. »\n\n` +
            `[Canal Telegram « ${tgGroup} » — message épinglé]\n` +
            `« Le job : tu reçois des virements de nos clients investisseurs, tu achètes de la crypto sur ton appli (Coinhouse ou Bitstamp), tu envoies sur l'adresse que je te donne. Tu gardes ta commission. Chacun a SON adresse, ne la partage pas. Paiement en BTC ou LTC, je vous dis lequel. Jamais de message à la banque. »`,
        },
        {
          id: 'audition', type: 'pv', title: `Audition ${de(renewedMule.p.name)}`, date: office(tBank + r.int(7, 12) * DAY), author: 'OPJ, brigade financière',
          body:
            `« Je suis ${renewedMule.study}. J'ai vu une story Snapchat du compte « ${handle} » qui proposait de l'argent facile. Il m'a ${g('ajouté', 'ajoutée')} sur un groupe Telegram et m'a expliqué que des clients allaient me faire des virements, que je devais acheter du bitcoin sur ${platName(renewedMule.plat)} et l'envoyer sur l'adresse qu'il me donnait. Je gardais ${pctMule} %.\n\n` +
            `La première adresse, c'était ${A(w, renewedMule.addrs[0])}. Vers le ${fmtDate(renewT, false)}, il m'en a donné une nouvelle : ${A(w, renewedMule.addrs[1])}. Il disait que chaque recrue avait sa propre adresse, « pour que la compta soit propre ». Certains dans le groupe envoyaient en litecoin, il disait que ça coûtait moins de frais.\n\n` +
            `À côté, j'achète un peu de bitcoin pour moi avec mon job étudiant, que je garde sur mon propre portefeuille ; ça n'a rien à voir avec lui. Je ne connais pas son vrai nom. Je pensais que c'était de la gestion pour des investisseurs, même si les libellés « placement » m'ont ${g('intrigué', 'intriguée')}. Quand ${bank} a bloqué mon compte, il m'a ${g('bloqué', 'bloquée')} sur Telegram. »`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o2', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de consolidation du coordinateur ?',
          answer: [cons],
          hint: 'Suivez la dépense d\'une adresse de retrait listée par Coinhouse ou Bitstamp : elle part, avec d\'autres, vers une même adresse.',
          explanation: `${A(w, cons)} reçoit ${consEvents[0].txt}, puis ${consEvents[1].txt}, et se réutilise enfin elle-même en entrée du second regroupement (${c2.inputs.length} entrées). L'adresse ${A(w, bridgeAddr).slice(0, 14)}…, dépensée dans les deux regroupements, soude le cluster : les ${nAddrBtc} adresses de collecte BTC et la consolidation appartiennent au même portefeuille. Elle n'est pas neuve : ${consPrevIn} entrée${consPrevIn > 1 ? 's' : ''} et ${consPrevOut} sortie${consPrevOut > 1 ? 's' : ''} (${consPrevDest}), des semaines plus tôt, trahissent une vague antérieure (d'autres victimes probables, à signaler au parquet).`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Une adresse de collecte BTC du cluster n\'est citée dans aucune réponse de plateforme. Laquelle ?',
          answer: [hiddenAddr],
          hint: 'Listez les entrées des deux regroupements (ou le panneau cluster de la consolidation) et rayez une à une les adresses qui figurent dans les réponses de Coinhouse et de Bitstamp.',
          explanation:
            `${A(w, hiddenAddr)} est dépensée en entrée commune avec les autres adresses de collecte (regroupement ${hiddenIn.join(' et ')}) : selon l'heuristique des entrées communes, elle est contrôlée par le même portefeuille que la consolidation. Elle a reçu ${hidden.wd.length} retraits du hot wallet ${hiddenPlat}, pour ${amt(hiddenTotal, 'BTC')}, en deux vagues (${hidden.wd.map((x) => fmtDate(x.tx.time, false)).join(', ')}). ` +
            `Or les deux réponses listent de façon exhaustive les retraits des comptes requis : cette adresse est donc celle d'une recrue que le signalement ${bank} ne couvre pas. Elle devient la donnée centrale d'une nouvelle réquisition, l'adresse de retrait suffisant à désigner le compte client.`,
        },
        {
          id: 'o1', type: 'number', points: 12, tolerance: 0, unit: 'mules',
          prompt: 'Combien de mules distinctes (identifiées ou non) alimentent les adresses de collecte du coordinateur, toutes chaînes confondues ?',
          answer: nNet,
          hint: 'Comptez des comptes, pas des adresses. Écartez les titulaires dont aucun retrait n\'atteint le cluster, cherchez dans le cluster une adresse alimentée par un exchange qui ne figure dans aucune réponse, et n\'oubliez pas le volet Litecoin.',
          explanation:
            `${nNet} mules. ${nIdentBtc} mules BTC identifiées (dont ${renewedMule.p.name}, qui a utilisé deux adresses : on compte un compte, pas deux) et ${nLtc} en LTC (${ltcMules.map((m) => m.p.name).join(', ')}), dont les adresses sont regroupées sur Litecoin puis converties via ChangeNOW vers l'adresse de consolidation BTC. ` +
            `S'y ajoute ${A(w, hidden.addrs[0]).slice(0, 14)}… : co-dépensée avec les autres adresses de collecte, alimentée par ${hidden.wd.length} retraits ${hiddenPlat}, elle n'apparaît dans aucune réponse alors que celles-ci listent tous les retraits des comptes requis. C'est vraisemblablement le compte d'une mule non signalée par ${bank} (cliente d'une autre banque), à identifier par réquisition à ${hiddenPlat}. ${decoyName} et ${gamblerName} n'en font pas partie.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'À quelle plateforme adresser la réquisition qui permettra d\'identifier la mule absente du signalement ?',
          answer: [hidden.plat],
          hint: 'Remontez les entrées de l\'adresse de collecte que personne ne vous a signalée : d\'où viennent ses fonds ?',
          explanation: `Les ${hidden.wd.length} versements reçus par ${A(w, hiddenAddr).slice(0, 14)}… sont des retraits du hot wallet de ${hiddenPlat}. La plateforme peut retrouver, à partir de l'adresse de retrait et des hash, le compte client concerné : identité et pièces KYC, IBAN d'alimentation (qui désignera la banque de la mule, puis les virements des victimes), adresses IP. ${procedureFor(kits[hidden.plat].btc.entity)}`,
        },
        {
          id: 'o4', type: 'choice', points: 10,
          prompt: 'Parmi les titulaires signalés par la banque, lesquels ne sont rattachés au réseau par aucun élément on-chain ?',
          ...choice(r, `${decoyName} et ${gamblerName}`, wrongPairs),
          explanation:
            `${decoyName} a bien reçu un virement d'une victime (« ${decoy.wires[0].label} », ${eur(decoy.wires[0].eur)}), mais ses ${decoy.wd.length} retraits partent tous vers ${A(w, decoy.addrs[0]).slice(0, 14)}…, alimentée par des achats mensuels depuis le ${fmtDate(decoy.opened, false)}, bien avant les faits, et jamais dépensée : aucune entrée commune avec le cluster. ` +
            `${gamblerName} a reçu ${eur(gambler.wires[0].eur)} d'une victime avec le libellé « ${saleLabel} » (une vente entre particuliers, à vérifier), et tous ses retraits vont sur une adresse de dépôt étiquetée OrbitCasino, alimentée bien avant les faits : ${gambler.p.g('il', 'elle')} joue, ${gambler.p.g('il', 'elle')} ne reverse rien au coordinateur. ` +
            `Les deux virements peuvent avoir une cause étrangère à l'escroquerie : à vérifier en audition, sans mettre en cause ces titulaires sur la seule base du signalement. Les mules LTC, elles, sont rattachées via le regroupement Litecoin et le swap.`,
        },
        {
          id: 'o3', type: 'amount', points: 12, unit: 'USD', tolerance: 0.05,
          prompt: 'Quel montant total (en USD) les mules du réseau ont-elles versé au coordinateur, BTC et LTC confondus ?',
          answer: totalUsd,
          hint: 'Additionnez les retraits reçus par chaque adresse de collecte (BTC et LTC), avant les regroupements. Les retraits des mules vers leur propre portefeuille ne vont pas au coordinateur.',
          explanation: `${amt(btcTotal, 'BTC')} sur les adresses BTC (≈ ${usdFmt(usd('BTC', btcTotal))}) et ${amt(ltcTotal, 'LTC')} sur les adresses LTC (≈ ${usdFmt(usd('LTC', ltcTotal))}), soit ≈ ${usdFmt(totalUsd)}. Les victimes ont viré ${eur(wiresTotal)} à ces mules : la différence correspond surtout aux commissions conservées (8 à 12 %) et aux frais d'achat. Ne pas compter les regroupements ni le paiement ChangeNOW, qui recyclent des fonds déjà comptés, ni les ${amt(ownTotal, 'BTC')} retirés par ${ownNames} vers ${withOwn.length > 1 ? 'leurs portefeuilles personnels' : 'son portefeuille personnel'} (adresses jamais co-dépensées avec le cluster, utilisées pour de petits achats).`,
        },
        {
          id: 'o10', type: 'tx', points: 10,
          prompt: 'Par quelle transaction le produit de la conversion des litecoins arrive-t-il sur l\'adresse de consolidation BTC ?',
          answer: [order.payoutTx.id],
          hint: 'L\'adresse de regroupement Litecoin dépose chez ChangeNOW. Corrélateur : émetteur ChangeNOW, chaîne Bitcoin, à partir de l\'heure du dépôt, fenêtre d\'environ une heure, tolérance de quelques %. Deux candidats ont un montant compatible : un seul paie une adresse déjà rattachée au cluster.',
          explanation:
            `Le ${fmtDate(order.depositTx.time)}, ${A(w, ltcCons).slice(0, 14)}… dépose ${amt(swapValue, 'LTC')} sur une adresse de dépôt ChangeNOW${swapValue > ltcC.outputs[0].value + 0.001 ? ` (le regroupement de ${amt(ltcC.outputs[0].value, 'LTC')}, plus un reliquat d'une vague antérieure resté sur l'adresse)` : ''}. ${swapDelayMin} minutes plus tard, le hot wallet BTC de ChangeNOW verse ${amt(order.payoutValue, 'BTC')} à ${A(w, cons).slice(0, 14)}… : transaction ${order.payoutTx.hash.slice(0, 16)}…. ` +
            `Piège : le ${fmtDate(twinPay.time)}, ChangeNOW paie aussi ${amt(twinPay.outputs.find((o) => o.address === twinPayAddr)!.value, 'BTC')} à ${A(w, twinPayAddr).slice(0, 14)}…, un montant presque identique, mais vers une adresse neuve sans aucun lien avec le cluster. Les autres paiements de la fenêtre ont des montants incompatibles. Le destinataire, déjà rattaché au cluster, fait la différence : il relie le volet Litecoin aux fonds BTC.`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `Après le second regroupement, la consolidation éclate l'agrégat en quatre parts quasi égales. ${fwdWhen}, quatre transferts d'environ ${amt(r8(base), 'BTC')} vident chacune de ces parts. Lequel mène au cash-out ?`,
          answer: [fwd.get(N)!.id],
          hint: 'Les montants et les horaires ne départagent pas : suivez chaque destinataire jusqu\'à sa première dépense, et regardez où elle va.',
          explanation:
            `${twinRows.map((x) => `${heure(x.tx.time)} → ${A(w, next.get(x.h)!).slice(0, 12)}… (${amt(x.tx.outputs[0].value, 'BTC')}, ${fateOf(x.h)})`).join(' ; ')}. ` +
            `Seul ${A(w, N2).slice(0, 12)}… entame une peel chain : pelures successives vers SatsDesk, des séquestres Hodl Hodl et une adresse de dépôt ${exName}. Les trois autres branches sont sans issue : l'une dort, l'une se ré-éclate en trois adresses qui ne bougent plus, la dernière est jouée sur OrbitCasino (sans KYC). Les branches dormantes détiennent encore ${amt(sleeping, 'BTC')} : à placer sous surveillance.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelle valeur probante accorder au rapprochement entre le dépôt LTC chez ChangeNOW et le paiement BTC reçu par la consolidation ?',
          hint: 'Demandez-vous ce que la blockchain montre réellement entre les deux chaînes, et ce qui relève d\'un rapprochement.',
          ...choice(r,
            'Un lien probable (montant, délai, destinataire déjà rattaché), à confirmer par une réquisition à ChangeNOW sur la commande',
            [
              'Une preuve certaine : un échangeur instantané relie mécaniquement chaque dépôt à son paiement sur la blockchain',
              'Aucune : le passage par un échangeur instantané rompt définitivement la traçabilité des fonds',
              'La preuve que ChangeNOW est complice du coordinateur, puisqu\'il a exécuté la conversion',
            ]),
          explanation: `Aucune donnée on-chain ne relie le dépôt Litecoin au paiement Bitcoin : ce sont deux transactions sur deux chaînes, rapprochées par corrélation (contre-valeur cohérente, délai de ${swapDelayMin} minutes, et surtout un destinataire déjà rattaché au cluster, quand un paiement jumeau va ailleurs). C'est un faisceau solide mais probabiliste ; le rapport le présente comme tel et une réquisition à ChangeNOW (identifiant de commande, adresse de dépôt, adresse de paiement, données de connexion) le confirme. Un échangeur qui exécute une commande n'en devient pas complice. ${procedureFor(swp.entity)}`,
        },
        {
          id: 'o5', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.03,
          prompt: 'Quel montant (en BTC) la peel chain a-t-elle envoyé au courtier OTC ?',
          answer: otcTotal,
          hint: 'Suivez la peel chain et additionnez les pelures vers l\'adresse SatsDesk (pas les dépôts des autres clients du courtier, ni les sorties antérieures de la consolidation).',
          explanation: `${otcPeels.length} pelures pour ${amt(otcTotal, 'BTC')} vers SatsDesk OTC, contre ${p2pPeels.length} ventes P2P pour ${amt(p2pTotal, 'BTC')} via des séquestres multisig Hodl Hodl (une adresse de séquestre par transaction, libérée ensuite à l'acheteur). L'OTC absorbe les gros volumes, le P2P fractionne en petites ventes contre espèces ou virements.${hitOtc ? ' L\'envoi de la consolidation vers SatsDesk des semaines plus tôt relève de la vague antérieure : il ne fait pas partie de la peel chain.' : ''} Aucun des deux n'offre de piste rapide : ${procedureFor(otc)} ${procedureFor(hodl)}`,
        },
        {
          id: 'o6', type: 'address', points: 12,
          prompt: 'Une pelure part vers une plateforme qui applique un KYC : c\'est l\'erreur du coordinateur. Quelle est l\'adresse de dépôt ?',
          answer: [exDeposit],
          hint: 'Parmi les petites sorties de la peel chain, une seule est étiquetée comme adresse de dépôt d\'un exchange, puis balayée vers son hot wallet.',
          explanation: `Saut n°${exIdx} : ${amt(exPeel.value, 'BTC')} vers ${A(w, exDeposit)}, adresse de dépôt ${exName} balayée ensuite vers son hot wallet. Une adresse de dépôt est propre à un compte client : la plateforme peut désigner son titulaire, ses pièces KYC, ses IP de connexion et son IBAN. Contrairement aux mules, ce dépôt vient directement du portefeuille du coordinateur. Au saut n°${ownIdx}, une autre pelure (${amt(ownPeel.value, 'BTC')}) part vers ${A(w, P).slice(0, 14)}…, un portefeuille personnel (adresse Taproot, historique ancien) ; ${pShopText}. ${pLeadText} ${procedureFor(exKit.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel solde (en BTC) reste, non dépensé, sur la dernière adresse de la peel chain ?',
          answer: remainderValue,
          hint: 'Suivez la grosse sortie (le rendu) de saut en saut jusqu\'à l\'adresse qui n\'a plus de dépense : son solde est le reliquat.',
          explanation: `Après ${peels.length} sauts, le rendu s'arrête sur ${A(w, lastHopAddr)}, qui conserve ${amt(remainderValue, 'BTC')} (≈ ${usdFmt(usd('BTC', remainderValue))}), soit ${Math.round((remainderValue / aggregate) * 100)} % de l'agrégat consolidé (les deux micro-envois reçus ensuite sont de la poussière, sans valeur). S'y ajoutent les ${amt(sleeping, 'BTC')} des branches dormantes de l'éclatement. Ces fonds sont en autodétention : aucun prestataire ne peut les geler. Les adresses sont à placer sous surveillance (alerte sur toute dépense) afin d'agir vers la plateforme destinataire dès le prochain mouvement ; une saisie supposerait l'accès aux clés du coordinateur, une fois identifié.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Comment qualifier la situation pénale des mules dans le rapport ?',
          ...choice(r,
            'Elles sont susceptibles d\'être poursuivies pour blanchiment ; leur connaissance de l\'origine des fonds s\'apprécie au cas par cas',
            [
              'Simples témoins : elles n\'ont ni conçu ni organisé l\'escroquerie',
              'Coauteures de l\'escroquerie au même titre que le coordinateur, du seul fait des virements reçus',
              'Victimes du recruteur : avoir été recrutées sur les réseaux sociaux exclut toute responsabilité',
            ]),
          explanation: 'Prêter son compte pour recevoir et reconvertir des fonds d\'origine frauduleuse peut constituer un blanchiment (art. 324-1 du code pénal, avec la présomption de l\'art. 324-1-1 lorsque les conditions de l\'opération n\'ont d\'autre justification que de dissimuler l\'origine des fonds) ou un recel. L\'élément intentionnel reste à établir pour chacune (audition, messages, commission perçue, signaux d\'alerte ignorés). Les mules sont souvent elles-mêmes manipulées : le rapport décrit des faits et des flux, il ne qualifie pas leur intention. Leurs achats personnels, sans lien avec le réseau, n\'ont pas à figurer dans le préjudice.',
        },
      ],
      truth: {
        path: [
          ...netWd.map((x) => x.tx.id), c1.id, ltcC.id, order.depositTx.id, order.payoutTx.id, c2.id, fan.id, fwd.get(N)!.id,
          ...peels.map((p) => p.tx.id), ...(exSweep ? [exSweep.id] : []),
        ],
        addresses: [...new Set([...btcCollect, ...ltcCollect, ltcCons, cons, N, ...hops, exDeposit, otcAddr, P])],
        debrief:
          `1. Les victimes du faux placement « ${scamName} » virent ${eur(wiresTotal)} à ${nNet} mules. Chacune garde 8 à 12 %, achète du BTC ou du LTC sur Coinhouse ou Bitstamp et retire vers l'adresse que lui a attribuée « ${handle} ». Certaines gardent par ailleurs une petite épargne personnelle (${amt(ownTotal, 'BTC')} retirés vers leurs propres portefeuilles), sans lien avec le réseau.\n` +
          `2. Collecte : ${amt(btcTotal, 'BTC')} sur ${nAddrBtc} adresses BTC et ${amt(ltcTotal, 'LTC')} sur ${ltcCollect.length} adresse${ltcCollect.length > 1 ? 's' : ''} LTC, soit ≈ ${usdFmt(totalUsd)}.\n` +
          `3. Regroupement n°1 le ${fmtDate(c1.time, false)} vers ${A(w, cons)} (déjà utilisée pour une vague antérieure), regroupement n°2 le ${fmtDate(c2.time, false)} qui réutilise la consolidation en entrée. ${A(w, bridgeAddr).slice(0, 14)}…, dépensée dans les deux, soude le cluster.\n` +
          `4. Volet Litecoin : regroupement sur ${A(w, ltcCons).slice(0, 14)}…, swap ChangeNOW de ${amt(swapValue, 'LTC')} contre ${amt(order.payoutValue, 'BTC')} versés directement sur la consolidation BTC (un paiement jumeau de ChangeNOW va à un autre client).\n` +
          `5. Le cluster contient l'adresse d'une mule absente du signalement (${hidden.p.name}, cliente ${hiddenPlat}, ${hidden.wd.length} retraits) : nouvelle réquisition à ${hiddenPlat}. Fausses pistes : ${decoyName} épargne pour son compte, ${gamblerName} a vendu un objet à une victime et joue au casino.\n` +
          `6. L'agrégat (${amt(aggregate, 'BTC')}) est éclaté en quatre parts quasi égales, chacune transférée entre ${duree(Math.min(...fwdDelays))} et ${duree(Math.max(...fwdDelays))} plus tard : une seule entame la peel chain, les trois autres dorment, se ré-éclatent ou partent au casino.\n` +
          `7. La peel chain fait ${peels.length} sauts : ${amt(otcTotal, 'BTC')} vers SatsDesk OTC (${otcPeels.length} pelures), ${amt(p2pTotal, 'BTC')} en ${p2pPeels.length} ventes P2P Hodl Hodl, ${amt(ownPeel.value, 'BTC')} vers le portefeuille personnel du coordinateur et ${amt(exPeel.value, 'BTC')} déposés chez ${exName} (saut n°${exIdx}). Reliquat : ${amt(remainderValue, 'BTC')} sur ${A(w, remainder).slice(0, 14)}…, plus ${amt(sleeping, 'BTC')} dans les branches dormantes.\n\n` +
          `Leçon : dans un réseau de mules, chaque mule est un point d'entrée régulé (banque, plateforme à KYC), mais elle ne mène qu'au coordinateur via ses adresses de retrait ; ses autres retraits relèvent de sa vie privée et doivent être triés. Le clustering (CIOH) relie les adresses de collecte et révèle les mules manquantes ; il faut compter des comptes, pas des adresses, et écarter les titulaires dont rien ne rattache les fonds au cluster. Face à un éclatement en parts égales, seul le devenir de chaque part distingue la vraie piste. Le cash-out professionnel (OTC, P2P) est peu coopératif : c'est l'unique dépôt du coordinateur sur une plateforme à KYC qui offre la meilleure piste d'identification.`,
      },
      hints: [
        'Ajoutez au graphe les adresses de retrait listées par Coinhouse et Bitstamp, puis suivez leur dépense : plusieurs se retrouvent en entrée des mêmes transactions, d\'autres jamais.',
        'Ouvrez le panneau cluster de l\'adresse de consolidation : il liste toutes les adresses de collecte BTC, y compris une que personne ne vous a signalée. Les mules LTC passent par ChangeNOW : utilisez la corrélation sur la chaîne BTC.',
        'Après le second regroupement, la consolidation se divise en quatre parts égales : suivez chacune jusqu\'à sa première dépense.',
        'Sur la peel chain, suivez la grosse sortie à chaque saut : les pelures partent vers SatsDesk, des séquestres Hodl Hodl, un portefeuille personnel et, une seule fois, une adresse de dépôt d\'exchange.',
        'Au bout de la peel chain, une adresse ne dépense plus rien : son solde est le reliquat encore détenu par le coordinateur.',
      ],
    }
  },
}
