import { World, type Tx } from '../engine/world'
import { exchange, swapper, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { fromUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor, type FakePerson } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
/** Arrondi par défaut à 8 décimales : la sortie ne dépasse jamais les entrées. */
const f8 = (v: number) => Math.floor(v * 1e8) / 1e8
/** Cours de conversion figé (les virements des victimes sont en euros). */
const EUR_USD = 1.08
const eur = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

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
  role: 'net' | 'hidden' | 'decoy'
  renewed: boolean
  addrs: string[]
  wires: Wire[]
  wd: Withdrawal[]
  commission: number
  opened: number
}

const STUDIES = ['en licence de droit', 'en BTS commerce', 'en BUT GEA', 'en licence STAPS', 'en école de commerce', 'en BUT informatique', 'en licence de psychologie', 'en BTS NDRC', 'en licence d\'économie']
const EUR_AMOUNTS = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7500]

export const btcMoneyMules: ScenarioTemplate = {
  id: 'money-mules',
  title: 'Le réseau de mules',
  tagline: 'Des étudiants, des virements, des adresses de collecte… et un seul portefeuille derrière.',
  description:
    'Les victimes d\'un faux placement ont viré leur épargne sur des comptes de particuliers. Ces « mules », recrutées sur les réseaux sociaux, achètent du bitcoin ou du litecoin et l\'envoient au coordinateur. Rattachez les adresses de collecte au même portefeuille, chiffrez la collecte, écartez la fausse piste, suivez la peel chain jusqu\'au cash-out (P2P, OTC) et repérez l\'erreur qui permet d\'identifier le coordinateur.',
  difficulty: 3,
  chains: ['btc', 'ltc'],
  skills: ['cioh', 'exchange_id', 'requisition', 'typologies', 'peel'],
  estMinutes: 35,
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
    const swp = swapper(w, 'changenow')
    const hodl = w.entity('hodlhodl')
    const otc = w.entity('satsdesk')
    const otcAddr = w.addr('btc', { entity: otc, label: 'SatsDesk OTC — Adresse de règlement', tags: ['liquid'], kind: 'p2wpkh' })
    const coord = w.customEntity({ name: `Coordinateur « ${handle} »`, category: 'suspect', description: 'Recruteur et coordinateur du réseau de mules (identité inconnue).' })

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
        : `${p.g('étudiant', 'étudiante')} ${r.pick(STUDIES)}`
      return { p, age: role === 'decoy' ? r.int(22, 27) : r.int(19, 23), city: fakeCity(r), study, plat, coin, role, renewed, addrs: [], wires: [], wd: [], commission: r.pick([0.08, 0.1, 0.12]), opened: 0 }
    }
    const plats: Plat[] = r.shuffle<Plat>(['coinhouse', 'bitstamp', ...Array.from({ length: nIdentBtc + nLtc - 2 }, () => r.pick(['coinhouse', 'bitstamp'] as const))])
    const ident: Mule[] = []
    for (let i = 0; i < nIdentBtc; i++) ident.push(mkMule('net', 'btc', plats[i], i === 0))
    for (let i = 0; i < nLtc; i++) ident.push(mkMule('net', 'ltc', plats[nIdentBtc + i]))
    const hidden = mkMule('hidden', 'btc', r.pick(['coinhouse', 'bitstamp'] as const))
    const decoy = mkMule('decoy', 'btc', r.pick(['coinhouse', 'bitstamp'] as const))
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

    // Fausse piste : une titulaire qui épargne en bitcoin depuis des mois
    const decoyE = w.customEntity({ name: decoy.p.name, category: 'individual' })
    decoy.addrs.push(w.addr('btc', { entity: decoyE, kind: r.pick(['p2wpkh', 'p2tr', 'p2sh'] as const) }))
    decoy.wires = [{ t: w.at(-r.float(12, 28) * 24), victim: r.pick(victims), eur: r.pick([600, 800, 1200, 1500]), label: r.pick(['Remboursement prêt', 'Remboursement', 'Part loyer']) }]
    const nDca = r.int(7, 11)
    const dcaEur = r.pick([50, 100, 150])
    decoy.opened = w.at(-(nDca + 1) * 30 * 24)

    const coinFor = (e: number, coin: Coin) => roundAsset(ASSET[coin], fromUsd(ASSET[coin], e * EUR_USD * 0.985))

    // ── Achats et retraits (ordre chronologique) ─────────────────────────────
    type Ev = { t: number; mule: Mule; addr: string; value: number }
    const evs: Ev[] = []
    for (const m of network) {
      const half = Math.ceil(m.wires.length / 2)
      m.wires.forEach((wi, i) => evs.push({ t: Math.round(wi.t + r.float(3, 26) * HOUR), mule: m, addr: m.renewed && i >= half ? m.addrs[1] : m.addrs[0], value: coinFor(wi.eur * (1 - m.commission), m.coin) }))
    }
    for (let i = 0; i < nDca; i++) evs.push({ t: Math.round(decoy.opened + (i + 1) * 30 * DAY + r.float(-1, 1) * DAY), mule: decoy, addr: decoy.addrs[0], value: coinFor(dcaEur, 'btc') })
    evs.push({ t: Math.round(decoy.wires[0].t + r.float(20, 60) * HOUR), mule: decoy, addr: decoy.addrs[0], value: coinFor(decoy.wires[0].eur, 'btc') })
    evs.sort((a, b) => a.t - b.t)
    for (const e of evs) {
      const tx = kits[e.mule.plat][e.mule.coin].withdraw(e.addr, e.value, e.t)
      e.mule.wd.push({ tx, addr: e.addr, value: e.value })
    }

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
    const c1 = consolidate(btcCollect.filter((a) => w.utxosOf(a, T1).length > 0), T1, cons, 'btc')

    // ── Volet Litecoin : regroupement puis swap ChangeNOW LTC → BTC ─────────
    const ltcCons = w.addr('ltc', { entity: coord, kind: 'p2wpkh' })
    const lastLtc = Math.max(...ltcMules.flatMap((m) => m.wd.map((x) => x.tx.time)))
    const ltcC = consolidate(ltcCollect, Math.round(lastLtc + r.float(6, 20) * HOUR), ltcCons, 'ltc')
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

    // ── Regroupement n°2 : l'adresse de consolidation se réutilise en entrée ─
    const lastBtc = Math.max(...btcNet.flatMap((m) => m.wd.map((x) => x.tx.time)))
    const T2 = Math.round(Math.max(lastBtc, order.payoutTx.time, T1) + r.float(8, 30) * HOUR)
    const c2 = consolidate([cons, ...btcCollect.filter((a) => w.utxosOf(a, T2).length > 0)], T2, cons, 'btc')
    const aggregate = w.unspentValue(cons)

    // ── Peel chain : OTC, séquestres P2P et une erreur ───────────────────────
    type PT = 'otc' | 'p2p' | 'ex' | 'unk'
    const plan: PT[] = r.shuffle<PT>([
      ...Array.from({ length: r.int(2, 3) }, () => 'otc' as PT),
      ...Array.from({ length: r.int(3, 5) }, () => 'p2p' as PT),
      ...(r.chance(0.6) ? (['unk'] as PT[]) : []),
    ])
    plan.splice(r.int(2, plan.length - 1), 0, 'ex')
    const FR: Record<PT, [number, number]> = { otc: [0.16, 0.26], p2p: [0.04, 0.08], ex: [0.025, 0.045], unk: [0.03, 0.06] }
    const peels: { tx: Tx; type: PT; to: string; value: number }[] = []
    const hops: string[] = [cons]
    const releases: Tx[] = []
    let exSweep: Tx | undefined
    let cur = cons
    let t = Math.round(c2.time + r.float(20, 60) * HOUR)
    for (const pt of plan) {
      const bal = w.unspentValue(cur, t)
      const raw = bal * r.float(FR[pt][0], FR[pt][1])
      const value = pt === 'otc' ? Math.floor(raw * 100) / 100 : pt === 'p2p' ? Math.floor(raw * 1e4) / 1e4 : r8(raw)
      let to: string
      if (pt === 'otc') to = otcAddr
      else if (pt === 'p2p') to = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
      else if (pt === 'ex') to = exKit.newDeposit()
      else to = w.addr('btc')
      const next = w.addr('btc', { entity: coord, kind: 'p2wpkh' })
      const tx = w.utxoTx({ time: t, from: [cur], to: [{ address: to, value }], change: next, spendAll: true, tags: ['peel'] })
      peels.push({ tx, type: pt, to, value })
      if (pt === 'p2p') releases.push(forwardAll(w, to, w.addr('btc'), Math.round(t + r.float(1, 10) * HOUR), undefined, ['escrow-release']))
      if (pt === 'ex') exSweep = exKit.sweep([to], Math.round(t + r.float(0.5, 6) * HOUR))[0]
      cur = next
      hops.push(next)
      t = Math.round(t + r.float(4, 30) * HOUR)
    }
    const remainder = cur
    const remainderValue = w.unspentValue(remainder)
    const tBank = Math.round(Math.max(...evs.map((e) => e.t)) + r.float(2, 4) * DAY)

    // ── Bruit ────────────────────────────────────────────────────────────────
    const span0 = w.at(-40 * 24)
    const span1 = w.at(12 * 24)
    kits.coinhouse.btc.noise(14, span0, span1)
    kits.bitstamp.btc.noise(10, span0, span1)
    kits.coinhouse.ltc.noise(5, span0, span1)
    kits.bitstamp.ltc.noise(4, span0, span1)
    exKit.noise(10, c2.time - 3 * DAY, t + 6 * DAY)
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
      const esc = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
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
    const nAddrBtc = btcCollect.length
    const renewT = renewedMule.wd.find((x) => x.addr === renewedMule.addrs[1])!.tx.time
    const hiddenPlat = platName(hidden.plat)
    const victimsUsed = new Set(network.flatMap((m) => m.wires.map((x) => x.victim.name)))

    // ── Pièces ───────────────────────────────────────────────────────────────
    const reported = [...ident, decoy]
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
      const lines = m.wd.map((x) => `   – ${fmtDate(x.tx.time)} — ${amt(x.value, ASSET[m.coin])} → ${A(w, x.addr)}`).join('\n')
      return (
        head +
        `   Alimentation : ${m.wires.length} virements SEPA depuis le compte ${bank}, ${eur(m.wires.reduce((s, x) => s + x.eur * (1 - m.commission), 0))} au total, chaque fois suivis d'un achat de ${ASSET[m.coin]} dans l'heure.\n` +
        `   Retraits ${ASSET[m.coin]} (liste exhaustive) :\n${lines}`
      )
    }
    const platResponse = (p: Plat): string =>
      reported.filter((m) => m.plat === p).map((m, i) => muleBlock(m, i + 1)).join('\n\n')

    const pctMule = Math.round(renewedMule.commission * 100)
    const g = renewedMule.p.g
    const decoyName = decoy.p.name
    const decoyOpts = r.pickN(ident.filter((m) => m.coin === 'btc'), 2).concat(ltcMules.slice(0, 1))
    while (decoyOpts.length < 3) decoyOpts.push(r.pick(ident.filter((m) => !decoyOpts.includes(m))))

    return {
      world: w,
      title: `Opération Comptes de passage — ${city}`,
      briefing:
        `Le parquet de ${city} a ouvert une enquête pour escroquerie en bande organisée et blanchiment après les plaintes de ${victimsUsed.size} épargnants, victimes d'une fausse plateforme de placement, « ${scamName} ». Leurs « conseillers » leur ont fait virer les fonds sur des comptes de particuliers, présentés comme des « gestionnaires partenaires ».\n\n` +
        `La néobanque ${bank} (fictive) a signalé plusieurs de ces comptes : des jeunes recrutés sur les réseaux sociaux, qui reversaient l'argent en crypto-actifs via Coinhouse ou Bitstamp. Les réquisitions sont revenues avec l'identité des titulaires et la liste de leurs retraits. Une des mules a été entendue.\n\n` +
        `Objectifs : déterminer quelles mules relèvent du même réseau (et s'il en manque), chiffrer la collecte, suivre l'agrégat jusqu'au cash-out et trouver le point de contact qui permettra d'identifier le coordinateur.`,
      evidence: [
        {
          id: 'banque', type: 'rapport', title: `Signalement de la néobanque ${bank} (extrait)`, date: tBank, author: `Service LCB-FT — ${bank}`,
          body:
            `Comptes de particuliers ayant reçu, en quelques semaines, des virements entrants inhabituels de tiers, immédiatement suivis de virements sortants vers des plateformes de crypto-actifs (Coinhouse SAS, Bitstamp Europe).\n\n` +
            `Virements entrants relevés :\n${wireLines}\n\n` +
            `Plusieurs donneurs d'ordre ont depuis déposé plainte pour escroquerie au faux placement « ${scamName} ». Les comptes bénéficiaires ont été clôturés. Ce signalement ne couvre que les clients de ${bank}.`,
        },
        {
          id: 'coinhouse', type: 'rapport', title: 'Réponse de Coinhouse à réquisition', date: tBank + r.int(5, 9) * DAY, author: 'Service conformité de Coinhouse',
          body:
            `Réponse à la réquisition judiciaire visant les titulaires désignés par le signalement ${bank}. Coinhouse confirme la détention des comptes suivants.\n\n` +
            `${platResponse('coinhouse')}\n\n` +
            `Les fonds retirés ne sont plus sous la garde de Coinhouse. Aucune autre adresse de retrait n'est associée à ces comptes.`,
        },
        {
          id: 'bitstamp', type: 'rapport', title: 'Réponse de Bitstamp (coopération volontaire)', date: tBank + r.int(10, 16) * DAY, author: 'Service conformité de Bitstamp',
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
          id: 'audition', type: 'pv', title: `Audition de ${renewedMule.p.name}`, date: tBank + r.int(7, 12) * DAY, author: 'OPJ, brigade financière',
          body:
            `« Je suis ${renewedMule.study}. J'ai vu une story Snapchat du compte « ${handle} » qui proposait de l'argent facile. Il m'a ${g('ajouté', 'ajoutée')} sur un groupe Telegram et m'a expliqué que des clients allaient me faire des virements, que je devais acheter du bitcoin sur ${platName(renewedMule.plat)} et l'envoyer sur l'adresse qu'il me donnait. Je gardais ${pctMule} %.\n\n` +
            `La première adresse, c'était ${A(w, renewedMule.addrs[0])}. Vers le ${fmtDate(renewT, false)}, il m'en a donné une nouvelle : ${A(w, renewedMule.addrs[1])}. Il disait que chaque recrue avait sa propre adresse, « pour que la compta soit propre ». Certains dans le groupe envoyaient en litecoin, il disait que ça coûtait moins de frais.\n\n` +
            `Je ne connais pas son vrai nom. Je pensais que c'était de la gestion pour des investisseurs, même si les libellés « placement » m'ont ${g('intrigué', 'intriguée')}. Quand ${bank} a bloqué mon compte, il m'a ${g('bloqué', 'bloquée')} sur Telegram. »`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'number', points: 15, tolerance: 0, unit: 'mules',
          prompt: 'Combien de mules distinctes (identifiées ou non) alimentent les adresses de collecte du coordinateur, toutes chaînes confondues ?',
          answer: nNet,
          hint: 'Comptez des comptes, pas des adresses. Cherchez dans le cluster une adresse alimentée par un exchange qui ne figure dans aucune réponse, et n\'oubliez pas le volet Litecoin.',
          explanation:
            `${nNet} mules. ${nIdentBtc} mules BTC identifiées (dont ${renewedMule.p.name}, qui a utilisé deux adresses : on compte un compte, pas deux) et ${nLtc} en LTC (${ltcMules.map((m) => m.p.name).join(', ')}), dont les adresses sont regroupées sur Litecoin puis converties via ChangeNOW vers l'adresse de consolidation BTC. ` +
            `S'y ajoute ${A(w, hidden.addrs[0]).slice(0, 14)}… : co-dépensée avec les autres adresses de collecte, alimentée par ${hidden.wd.length} retraits ${hiddenPlat}, elle n'apparaît dans aucune réponse alors que celles-ci listent tous les retraits des comptes requis. C'est vraisemblablement le compte d'une mule non signalée par ${bank} (cliente d'une autre banque), à identifier par réquisition à ${hiddenPlat}. ${decoyName} n'en fait pas partie.`,
        },
        {
          id: 'o2', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de consolidation du coordinateur ?',
          answer: [cons],
          hint: 'Suivez la dépense d\'une adresse de retrait listée par Coinhouse ou Bitstamp : elle part, avec d\'autres, vers une même adresse.',
          explanation: `${A(w, cons)} reçoit le premier regroupement (${c1.inputs.length} entrées), le paiement ChangeNOW issu des LTC, puis se réutilise elle-même en entrée du second regroupement (${c2.inputs.length} entrées). L'adresse ${A(w, bridgeAddr).slice(0, 14)}…, dépensée dans les deux regroupements, soude le cluster : les ${nAddrBtc} adresses de collecte BTC et la consolidation appartiennent au même portefeuille.`,
        },
        {
          id: 'o3', type: 'amount', points: 15, unit: 'USD', tolerance: 0.05,
          prompt: 'Quel montant total (en USD) les mules du réseau ont-elles versé au coordinateur, BTC et LTC confondus ?',
          answer: totalUsd,
          hint: 'Additionnez les retraits reçus par chaque adresse de collecte (BTC et LTC), avant les regroupements, et convertissez en dollars.',
          explanation: `${amt(btcTotal, 'BTC')} sur les adresses BTC (≈ ${usdFmt(usd('BTC', btcTotal))}) et ${amt(ltcTotal, 'LTC')} sur les adresses LTC (≈ ${usdFmt(usd('LTC', ltcTotal))}), soit ≈ ${usdFmt(totalUsd)}. Les victimes ont viré ${eur(wiresTotal)} à ces mules : la différence correspond surtout aux commissions conservées (8 à 12 %) et aux frais d'achat. Ne pas compter les regroupements ni le paiement ChangeNOW, qui recyclent des fonds déjà comptés.`,
        },
        {
          id: 'o4', type: 'choice', points: 15,
          prompt: 'Parmi les titulaires signalés par la banque, lequel n\'est rattaché au réseau par aucun élément on-chain ?',
          ...choice(r, decoyName, decoyOpts.map((m) => m.p.name)),
          explanation: `${decoyName} a bien reçu un virement d'une victime (« ${decoy.wires[0].label} », ${eur(decoy.wires[0].eur)}), mais ses ${decoy.wd.length} retraits partent tous vers ${A(w, decoy.addrs[0]).slice(0, 14)}…, alimentée par des achats mensuels depuis ${fmtDate(decoy.opened, false)}, bien avant les faits, et jamais dépensée : aucune entrée commune avec le cluster, aucun flux vers le coordinateur. Le virement peut avoir une cause étrangère à l'escroquerie (lien avec la victime) : à vérifier en audition, sans ${decoy.p.g('le', 'la')} mettre en cause sur la seule base du signalement. Les mules LTC, elles, sont bien rattachées via le regroupement Litecoin et le swap.`,
        },
        {
          id: 'o5', type: 'amount', points: 15, unit: 'BTC', tolerance: 0.03,
          prompt: 'Quel montant (en BTC) la peel chain a-t-elle envoyé au courtier OTC ?',
          answer: otcTotal,
          hint: 'Suivez la peel chain depuis l\'adresse de consolidation et additionnez les pelures vers l\'adresse SatsDesk (pas les dépôts des autres clients du courtier).',
          explanation: `${otcPeels.length} pelures pour ${amt(otcTotal, 'BTC')} vers SatsDesk OTC, contre ${p2pPeels.length} ventes P2P pour ${amt(p2pTotal, 'BTC')} via des séquestres multisig Hodl Hodl (une adresse de séquestre par transaction, libérée ensuite à l'acheteur). L'OTC absorbe les gros volumes, le P2P fractionne en petites ventes contre espèces ou virements. Aucun des deux n'offre de piste rapide : ${procedureFor(otc)} ${procedureFor(hodl)}`,
        },
        {
          id: 'o6', type: 'address', points: 15,
          prompt: 'Une pelure part vers une plateforme qui applique un KYC : c\'est l\'erreur du coordinateur. Quelle est l\'adresse de dépôt ?',
          answer: [exDeposit],
          hint: 'Parmi les petites sorties de la peel chain, une seule est étiquetée comme adresse de dépôt d\'un exchange, puis balayée vers son hot wallet.',
          explanation: `Saut n°${exIdx} : ${amt(exPeel.value, 'BTC')} vers ${A(w, exDeposit)}, adresse de dépôt ${exName} balayée ensuite vers son hot wallet. Une adresse de dépôt est propre à un compte client : la plateforme peut désigner son titulaire, ses pièces KYC, ses IP de connexion et son IBAN. Contrairement aux mules, ce dépôt vient directement du portefeuille du coordinateur. ${procedureFor(exKit.entity)}`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Comment qualifier la situation pénale des mules dans le rapport ?',
          ...choice(r,
            'Elles sont susceptibles d\'être poursuivies pour blanchiment ; leur connaissance de l\'origine des fonds s\'apprécie au cas par cas',
            [
              'Simples témoins : elles n\'ont ni conçu ni organisé l\'escroquerie',
              'Coauteures de l\'escroquerie au même titre que le coordinateur, du seul fait des virements reçus',
              'Victimes du recruteur : avoir été recrutées sur les réseaux sociaux exclut toute responsabilité',
            ]),
          explanation: 'Prêter son compte pour recevoir et reconvertir des fonds d\'origine frauduleuse peut constituer un blanchiment (art. 324-1 du code pénal, avec la présomption de l\'art. 324-1-1 lorsque les conditions de l\'opération n\'ont d\'autre justification que de dissimuler l\'origine des fonds) ou un recel. L\'élément intentionnel reste à établir pour chacune (audition, messages, commission perçue, signaux d\'alerte ignorés). Les mules sont souvent elles-mêmes manipulées : le rapport décrit des faits et des flux, il ne qualifie pas leur intention.',
        },
      ],
      truth: {
        path: [
          ...netWd.map((x) => x.tx.id), c1.id, ltcC.id, order.depositTx.id, order.payoutTx.id, c2.id,
          ...peels.map((p) => p.tx.id), ...(exSweep ? [exSweep.id] : []),
        ],
        addresses: [...new Set([...btcCollect, ...ltcCollect, ltcCons, ...hops, exDeposit, otcAddr])],
        debrief:
          `1. Les victimes de « ${scamName} » virent ${eur(wiresTotal)} à ${nNet} mules. Chacune garde 8 à 12 %, achète du BTC ou du LTC sur Coinhouse ou Bitstamp et retire vers l'adresse que lui a attribuée « ${handle} ».\n` +
          `2. Collecte : ${amt(btcTotal, 'BTC')} sur ${nAddrBtc} adresses BTC et ${amt(ltcTotal, 'LTC')} sur ${ltcCollect.length} adresse(s) LTC, soit ≈ ${usdFmt(totalUsd)}.\n` +
          `3. Regroupement n°1 le ${fmtDate(c1.time, false)} vers ${A(w, cons)}, regroupement n°2 le ${fmtDate(c2.time, false)} qui réutilise la consolidation en entrée. ${A(w, bridgeAddr).slice(0, 14)}…, dépensée dans les deux, soude le cluster.\n` +
          `4. Volet Litecoin : regroupement sur ${A(w, ltcCons).slice(0, 14)}…, swap ChangeNOW de ${amt(swapValue, 'LTC')} contre ${amt(order.payoutValue, 'BTC')} versés directement sur la consolidation BTC.\n` +
          `5. Le cluster contient l'adresse d'une mule absente du signalement (${hidden.p.name}, cliente ${hiddenPlat}, ${hidden.wd.length} retraits) : nouvelle réquisition à ${hiddenPlat}. ${decoyName}, fausse piste, épargne pour son compte sur une adresse sans lien.\n` +
          `6. L'agrégat (${amt(aggregate, 'BTC')}) est pelé en ${peels.length} sauts : ${amt(otcTotal, 'BTC')} vers SatsDesk OTC (${otcPeels.length} pelures), ${amt(p2pTotal, 'BTC')} en ${p2pPeels.length} ventes P2P Hodl Hodl, et ${amt(exPeel.value, 'BTC')} déposés chez ${exName} (saut n°${exIdx}). Reliquat : ${amt(remainderValue, 'BTC')} sur ${A(w, remainder).slice(0, 14)}….\n\n` +
          `Leçon : dans un réseau de mules, chaque mule est un point d'entrée régulé (banque, plateforme à KYC), mais elle ne mène qu'au coordinateur via ses adresses de retrait. Le clustering (CIOH) relie ces adresses entre elles et révèle les mules manquantes ; il faut compter des comptes, pas des adresses, et écarter les titulaires dont rien ne rattache les fonds au cluster. Le cash-out professionnel (OTC, P2P) est peu coopératif : c'est l'unique dépôt du coordinateur sur une plateforme à KYC qui offre la meilleure piste d'identification.`,
      },
      hints: [
        'Ajoutez au graphe les adresses de retrait listées par Coinhouse et Bitstamp, puis suivez leur dépense : plusieurs se retrouvent en entrée des mêmes transactions.',
        'Ouvrez le panneau cluster de l\'adresse de consolidation : il liste toutes les adresses de collecte BTC, y compris une que personne ne vous a signalée. Les mules LTC passent par ChangeNOW : utilisez la corrélation sur la chaîne BTC.',
        'Après la consolidation, suivez la grosse sortie à chaque saut : les pelures partent vers SatsDesk, des séquestres Hodl Hodl et, une seule fois, une adresse de dépôt d\'exchange.',
      ],
    }
  },
}
