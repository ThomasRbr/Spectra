import { World, type Tx } from '../engine/world'
import { dex, exchange, swapper, HOUR, DAY, type SwapperKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import { dusting } from '../engine/realism'
import { lookalike } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const RELATIONS = [
  { rel: 'père', f: false },
  { rel: 'mère', f: true },
  { rel: 'frère', f: false },
  { rel: 'sœur', f: true },
  { rel: 'compagne', f: true },
  { rel: 'compagnon', f: false },
] as const

/** [masculin, féminin] */
const ACTIVITIES: [string, string][] = [
  ['cofondateur d\'une société de conservation de crypto-actifs', 'cofondatrice d\'une société de conservation de crypto-actifs'],
  ['fondateur d\'une start-up de services blockchain', 'fondatrice d\'une start-up de services blockchain'],
  ['dirigeant d\'une société de minage', 'dirigeante d\'une société de minage'],
  ['fondateur d\'un média spécialisé dans les crypto-actifs', 'fondatrice d\'un média spécialisé dans les crypto-actifs'],
]

/** Montant entier « au cent près » (USDT à 2 décimales). */
const r2 = (v: number) => Math.round(v * 100) / 100

/** Solde d'un compte à l'instant `t` (les soldes du moteur ne sont pas temporels). */
function balAt(w: World, id: string, asset: 'USDT' | 'TRX', t: number): number {
  let b = 0
  for (const tx of w.txsOf(id)) {
    if (tx.time > t) continue
    for (const x of tx.transfers) {
      if (x.asset !== asset) continue
      if (x.to === id) b += x.value
      if (x.from === id) b -= x.value
    }
  }
  return b
}

/** Poussière répartie dans la fenêtre [a, b] : rien avant que l'adresse soit active, rien après « maintenant ». */
function dustWindow(w: World, id: string, a: number, b: number, n: number): void {
  dusting(w, id, { time: Math.round((a + b) / 2), n, spreadH: Math.max(0.1, (b - a) / 2 / HOUR), min: a, max: b })
}

/** Horodatage court d'un message (« 26/11 10:39 », heure de Paris). */
const stamp = (t: number) => new Date(t * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

/** « 1 adresse », « 2 adresses ». */
const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/**
 * Sortie de peel chain envoyée à un échangeur instantané (BTC → USDT-TRC20).
 * Équivalent de `SwapperKit.order` mais la transaction de dépôt garde un rendu
 * explicite (la peel chain continue) et le rapatriement du dépôt passe des
 * frais explicites (sinon `utxoTx` peut auto-financer l'adresse de dépôt).
 */
function btcPeelToSwapper(
  w: World,
  sw: SwapperKit,
  o: { from: string; value: number; time: number; change: string; recipient: string; feePct: number; decoys: number },
): { deposit: string; depositTx: Tx; sweepTx: Tx; payoutTx: Tx; payoutValue: number } {
  const r = w.rng
  const deposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
  const depositTx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }], change: o.change, spendAll: true, tags: ['peel'] })
  const fee = w.estimateFee('btc', 1, 1)
  const sweepTx = w.utxoTx({ time: o.time + r.int(300, 1500), from: [deposit], to: [{ address: sw.hot('btc'), value: w.unspentValue(deposit) - fee }], fee, change: null, spendAll: true, tags: ['sweep'] })
  const payT = o.time + r.int(12, 40) * 60
  const payoutValue = roundAsset('USDT', usd('BTC', o.value) * (1 - o.feePct))
  const pay = (to: string, value: number, time: number) => w.transfer({ time, from: sw.hot('tron'), to, value, asset: 'USDT', method: 'payout' })
  const payoutTx = pay(o.recipient, payoutValue, payT)
  // Autres clients de l'échangeur payés en USDT-TRC20 dans la même fenêtre.
  for (let i = 0; i < o.decoys; i++) {
    const close = r.chance(0.35)
    const v = close ? payoutValue * r.float(0.85, 1.15) : r.float(60, payoutValue * 2.5 + 300)
    pay(w.addr('tron'), roundAsset('USDT', v), payT + r.int(-2 * 3600, Math.round(1.5 * 3600)))
  }
  return { deposit, depositTx, sweepTx, payoutTx, payoutValue }
}

export const tronKidnappingRansom: ScenarioTemplate = {
  id: 'tron-kidnapping-ransom',
  title: 'Enlèvement : la rançon en USDT',
  tagline: 'Une rançon fractionnée en quelques minutes : trouver les USDT encore gelables avant qu\'ils ne disparaissent.',
  description:
    'Un proche d\'un entrepreneur du secteur crypto a été séquestré. La famille a payé, sous le contrôle des enquêteurs, une rançon en USDT-TRC20 et en bitcoins. La victime est libérée, mais les fonds se dispersent : identifiez l\'adresse qui détient encore des USDT, le montant à faire geler par l\'émetteur, les plateformes de dépôt et le lien entre les volets Bitcoin et Tron, sans vous laisser égarer par les virements jumeaux et les adresses leurres.',
  difficulty: 3,
  chains: ['tron', 'btc'],
  skills: ['tron', 'tokens', 'gel', 'requisition', 'crosschain', 'typologies'],
  estMinutes: 75,
  lessons: ['tron-usdt', 'gel-saisie', 'stablecoins', 'requisitions', 'suivre-flux'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const entP = fakePerson(r)
    const entName = entP.name
    const ge = entP.g
    const deEnt = de(entName)
    const activity = ge(...r.pick(ACTIVITIES))
    const relation = r.pick(RELATIONS)
    const hf = relation.f
    const gh = (m: string, f: string) => (hf ? f : m)
    const theRel = `${hf ? 'la' : 'le'} ${relation.rel}`
    const TheRel = `${hf ? 'La' : 'Le'} ${relation.rel}`
    const handle = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const tether = w.entity('tether')
    const usdtContract = w.addr('tron', { entity: tether, label: 'Tether: USDT (TRC-20)', contract: { name: 'Tether USD (TRC-20)', type: 'token' } })
    const cvT = exchange(w, 'coinhouse', 'tron')
    const kA = r.pick(['okx', 'binance'] as const)
    const kB = kA === 'okx' ? 'binance' : 'okx'
    const exA = exchange(w, kA, 'tron')
    const exB = exchange(w, kB, 'tron')
    const btcKey = r.pick(['kraken', 'bitstamp', 'binance', 'okx'] as const)
    const exBtc = exchange(w, btcKey, 'btc')
    const sun = dex(w, 'sunswap', 'tron')
    const cn = swapper(w, 'changenow')

    const famE = w.customEntity({ name: `${entName} (famille de la victime)`, category: 'victim' })
    const gang = w.customEntity({ name: 'Ravisseurs (non identifiés)', category: 'suspect' })
    const accompliceE = w.customEntity({ name: 'Bénéficiaire non identifié', category: 'individual' })

    // ── Montants ─────────────────────────────────────────────────────────────
    const ransomUsdt = r.int(18, 45) * 10000
    const ransomBtc = r.pick([0.5, 1, 1.5, 2, 2.5, 3])
    const famTest = r.pick([20, 50, 100])
    const gangTest = r.pick([10, 15, 20])

    // ── Chronologie ──────────────────────────────────────────────────────────
    const tMain = w.at(0)
    const tKid = tMain - Math.round(r.float(40, 60) * HOUR)
    const tDemand = tKid + Math.round(r.float(5, 10) * HOUR)
    const tProof = tMain - Math.round(r.float(5, 8) * HOUR)
    const tFamTest = tMain - Math.round(r.float(1.2, 2.5) * HOUR)

    // ── Portefeuilles de la famille ──────────────────────────────────────────
    const VT = w.addr('tron', { entity: famE })
    const FB = w.addr('btc', { entity: famE, kind: 'p2wpkh' })
    cvT.withdraw(VT, r.int(300, 900), tMain - r.int(60, 300) * DAY, 'TRX')
    for (let i = 0; i < r.int(2, 4); i++) cvT.withdraw(VT, r2(r.float(800, 9000)), tMain - r.int(20, 250) * DAY, 'USDT')
    // Fonds mobilisés en urgence sur Coinhouse
    cvT.withdraw(VT, ransomUsdt + famTest + r.int(50, 900), tMain - Math.round(r.float(14, 26) * HOUR), 'USDT')
    w.fund(FB, roundAsset('BTC', ransomBtc + r.float(0.15, 1.2)), tMain - r.int(40, 400) * DAY)

    // ── Préparation des ravisseurs (jours précédents) ────────────────────────
    const P = w.addr('tron', { entity: gang })
    const C = w.addr('tron', { entity: gang })
    const S1 = w.addr('tron', { entity: gang })
    const S2 = w.addr('tron', { entity: gang })
    const S3 = w.addr('tron', { entity: gang })
    const S4 = w.addr('tron', { entity: gang })
    const S4b = w.addr('tron', { entity: gang })
    const R = w.addr('tron', { entity: gang })
    const D1 = w.addr('tron', { entity: gang }) // leurre, jumeau de S3
    const D2 = w.addr('tron', { entity: gang }) // leurre, jumeau de S2
    const spare = Array.from({ length: r.int(1, 2) }, () => w.addr('tron', { entity: gang })) // préparées, jamais utilisées
    const B0 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const tPrep = tKid - Math.round(r.float(5, 9) * DAY)
    const wTrx = exB.withdraw(P, r.int(25, 45) * 100, tPrep, 'TRX')
    const wUsdt = exB.withdraw(P, gangTest, tPrep + r.int(20, 120) * 60, 'USDT')
    const gasTxs: Tx[] = []
    let tg = tPrep + Math.round(r.float(3, 20) * HOUR)
    for (const a of r.shuffle([C, S1, S2, S3, S4, S4b, R, D1, D2, ...spare])) {
      gasTxs.push(w.transfer({ time: tg, from: P, to: a, value: r.int(10, 30) * 10, asset: 'TRX' }))
      tg += r.int(2, 25) * 60
    }
    // Transfert « test » des ravisseurs vers leur adresse de collecte
    const gangTestTx = w.transfer({ time: tg + r.int(1, 6) * HOUR, from: P, to: C, value: gangTest, asset: 'USDT' })

    // ── Négociation : preuve de contrôle et test de la famille ───────────────
    const proofTx = w.transfer({ time: tProof, from: C, to: VT, value: 1, asset: 'USDT' })
    const famTestTx = w.transfer({ time: tFamTest, from: VT, to: C, value: famTest, asset: 'USDT' })
    const mainTx = w.transfer({ time: tMain, from: VT, to: C, value: ransomUsdt, asset: 'USDT' })
    const tBtc = tMain + r.int(10, 25) * 60
    const btcTx = w.utxoTx({ time: tBtc, from: [FB], to: [{ address: B0, value: ransomBtc }] })

    // Bruit : un robot d'address poisoning vise le payeur juste après le gros transfert
    const poison = w.addr('tron', { addr: lookalike(r, 'tron', A(w, C), 5, 5) })
    const poisonTx = w.transfer({ time: tMain + r.int(3, 15) * 60, from: poison, to: VT, value: r.pick([0.01, 0.05, 0.1]), asset: 'USDT' })

    // ── Fractionnement de la collecte (quelques minutes) ─────────────────────
    // Six destinations : quatre branches réelles et deux leurres dont le
    // montant imite, à une ou deux centaines d'USDT près, celui d'une branche réelle.
    const total = w.balanceOf(C, 'USDT')
    const s1 = Math.round((total * r.float(0.22, 0.28)) / 100) * 100
    const s2 = Math.round((total * r.float(0.1, 0.13)) / 100) * 100
    const s3 = Math.round((total * r.float(0.12, 0.15)) / 100) * 100
    const d1 = s3 + r.pick([-1, 1]) * r.int(1, 2) * 100
    const d2 = s2 + r.pick([-1, 1]) * 100
    const s4 = r2(total - s1 - s2 - s3 - d1 - d2)
    const dests = [S1, S2, S3, S4, D1, D2]
    const vals = [s1, s2, s3, s4, d1, d2]
    // Les jumeaux partent juste avant ou juste après leur modèle
    const seq = r.shuffle([0, 1, 2, 3])
    const order: number[] = []
    for (const k of seq) {
      if (k === 2) order.push(...r.shuffle([2, 4]))
      else if (k === 1) order.push(...r.shuffle([1, 5]))
      else order.push(k)
    }
    const splitTx: Tx[] = []
    let ts = tMain + r.int(4, 9) * 60
    for (const k of order) {
      splitTx[k] = w.transfer({ time: ts, from: C, to: dests[k], value: vals[k], asset: 'USDT' })
      ts += r.int(1, 3) * 60 + r.int(0, 50)
    }
    const decoyTx = { d1: splitTx[4], d2: splitTx[5] }
    splitTx.length = 4
    const splitEnd = Math.max(...splitTx.map((t) => t.time), decoyTx.d1.time, decoyTx.d2.time)

    // Leurres : D1 convertit en TRX et dort ; D2 convertit en TRX puis ré-éclate
    const d1Swap = sun.swap({ trader: D1, assetIn: 'USDT', amountIn: d1, assetOut: 'TRX', time: splitEnd + r.int(30, 70) * 60 })
    const d2Swap = sun.swap({ trader: D2, assetIn: 'USDT', amountIn: d2, assetOut: 'TRX', time: splitEnd + r.int(75, 120) * 60 })
    const d2Subs = Array.from({ length: r.int(2, 3) }, () => w.addr('tron', { entity: gang }))

    // S2 : conversion USDT → TRX sur SunSwap (sortie du périmètre de gel), puis dépôt partiel
    const swapRes = sun.swap({ trader: S2, assetIn: 'USDT', amountIn: s2, assetOut: 'TRX', time: splitEnd + r.int(25, 55) * 60 })
    const trxOut = swapRes.amountOut
    const trxDeposited = Math.round(trxOut * r.float(0.86, 0.93))
    const trxKept = roundAsset('TRX', trxOut - trxDeposited)
    const D_b = exB.newDeposit()
    const s2Dep = exB.receive(S2, trxDeposited, swapRes.tx.time + r.int(30, 80) * 60, { asset: 'TRX', depositAddr: D_b, sweepDelayH: r.float(0.2, 0.7) })

    // S3 : dépôt direct chez l'exchange A
    const s3Dep = exA.receive(S3, s3, splitEnd + r.int(25, 70) * 60, { asset: 'USDT', sweepDelayH: r.float(0.2, 0.7) })
    const D_a = s3Dep.deposit

    // S4 : un saut supplémentaire, puis dépôt sur le même compte de l'exchange B
    const s4Hop = forwardAll(w, S4, S4b, splitEnd + r.int(40, 80) * 60, 'USDT')
    const s4Dep = exB.receive(S4b, s4, s4Hop.time + r.int(50, 90) * 60, { asset: 'USDT', depositAddr: D_b, sweepDelayH: r.float(0.2, 0.7) })

    // S1 : immobile (cible du gel)

    // ── Volet BTC : courte peel chain ────────────────────────────────────────
    const B1 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const B2 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const cnValue = roundAsset('BTC', Math.round(ransomBtc * r.float(0.25, 0.38) * 1e4) / 1e4)
    const peel1 = btcPeelToSwapper(w, cn, { from: B0, value: cnValue, time: tBtc + Math.round(r.float(0.8, 1.4) * HOUR), change: B1, recipient: R, feePct: r.float(0.006, 0.015), decoys: r.int(5, 8) })
    const U = w.addr('btc', { entity: accompliceE, kind: r.pick(['p2wpkh', 'p2sh'] as const) })
    const uValue = roundAsset('BTC', Math.round(w.unspentValue(B1) * r.float(0.08, 0.16) * 1e4) / 1e4)
    const peel2 = w.utxoTx({ time: peel1.depositTx.time + Math.round(r.float(0.6, 1.2) * HOUR), from: [B1], to: [{ address: U, value: uValue }], change: B2, spendAll: true, tags: ['peel'] })
    const depBtc = exBtc.newDeposit()
    const peel3 = forwardAll(w, B2, depBtc, peel2.time + Math.round(r.float(0.5, 1) * HOUR))
    const btcDeposited = peel3.outputs[0].value
    const btcSweep = exBtc.sweep([depBtc], peel3.time + Math.round(r.float(0.3, 0.8) * HOUR))[0]

    // R : produit de la conversion ChangeNOW, en partie renvoyé sur le compte de
    // l'exchange A, le reste regroupé plus tard sur la réserve S1
    const rDepV = r2(Math.round(peel1.payoutValue * r.float(0.6, 0.75) / 10) * 10)
    const rDep = exA.receive(R, rDepV, peel1.payoutTx.time + r.int(15, 45) * 60, { asset: 'USDT', depositAddr: D_a, sweepDelayH: r.float(0.2, 0.7) })
    const lastOther = Math.max(s2Dep.tx.time, s3Dep.tx.time, s4Dep.tx.time, rDep.tx.time, peel3.time, btcSweep.time, ...[s2Dep, s3Dep, s4Dep, rDep].map((d) => d.sweep?.time ?? 0))
    const rToS1 = w.transfer({ time: lastOther + r.int(10, 35) * 60, from: R, to: S1, value: r2(peel1.payoutValue - rDepV), asset: 'USDT' })

    // ── Instant T ────────────────────────────────────────────────────────────
    const tNow = rToS1.time + r.int(15, 40) * 60
    const hNow = Math.max(1, Math.round((tNow - tMain) / HOUR))
    // Libération avant le point de situation, quelle que soit la durée du tirage
    const tRelease = Math.min(tMain + Math.round(r.float(1.8, 3) * HOUR), tNow - r.int(25, 50) * 60)

    // Leurre D2 : ré-éclatement de ses TRX, terminé avant « maintenant »
    let td2 = d2Swap.tx.time + r.int(20, 60) * 60
    const d2SubTxs = d2Subs.map((a, i) => {
      const t = Math.max(d2Swap.tx.time + (i + 1) * 120, Math.min(td2, tNow - (d2Subs.length - i) * 6 * 60))
      td2 += r.int(3, 12) * 60
      return w.transfer({ time: t, from: D2, to: a, value: roundAsset('TRX', (d2Swap.amountOut / (d2Subs.length + 0.4)) * r.float(0.9, 1)), asset: 'TRX' })
    })

    // ── Habillage (après le flux : rien de tout cela n'est dépensé par les ravisseurs) ──
    // Deuxième robot d'empoisonnement visant le payeur, sollicitations parasites
    const poison2 = w.addr('tron', { addr: lookalike(r, 'tron', A(w, C), 4, 4) })
    const poison2Tx = w.transfer({ time: Math.min(tMain + r.int(40, 160) * 60, tNow - 15 * 60), from: poison2, to: VT, value: r.pick([0.01, 0.02, 0.05]), asset: 'USDT' })
    // Poussière : la collecte est visible on-chain depuis la préparation, la réserve et
    // l'adresse BTC seulement après avoir servi ; rien n'arrive après « maintenant ».
    dustWindow(w, C, gangTestTx.time + 6 * HOUR, tNow - 10 * 60, r.int(2, 3))
    dustWindow(w, S1, splitTx[0].time + 20 * 60, tNow - 10 * 60, r.int(2, 3))
    dustWindow(w, B0, peel1.depositTx.time + 10 * 60, tNow - 10 * 60, 2)
    // Location d'énergie Tron par l'adresse de préparation (réduit les frais des transferts d'USDT)
    const energyE = w.customEntity({ name: 'Service de location d\'énergie Tron (non identifié)', category: 'individual' })
    const energy = w.addr('tron', { entity: energyE })
    for (let i = 0; i < r.int(3, 4); i++) w.transfer({ time: tPrep + Math.round(r.float(1, 40) * HOUR), from: P, to: energy, value: r.int(3, 9) * 10, asset: 'TRX', method: 'rentEnergy' })

    // ── Bruit ────────────────────────────────────────────────────────────────
    exA.noise(16, tMain - 3 * DAY, tMain - 8 * HOUR, 'USDT')
    exB.noise(14, tMain - 3 * DAY, tMain - 8 * HOUR, 'USDT')
    exB.noise(6, tMain - 3 * DAY, tMain - 8 * HOUR, 'TRX')
    cvT.noise(8, tMain - 20 * DAY, tMain - 8 * HOUR, 'USDT')
    exBtc.noise(8, tMain - 5 * DAY, tMain - 10 * HOUR)
    for (let i = 0; i < r.int(6, 10); i++) exA.withdraw(w.addr('tron'), r2(r.float(80, 20000)), tMain + r.int(0, Math.max(1, hNow - 1) * 60) * 60, 'USDT')
    for (let i = 0; i < r.int(5, 9); i++) exB.withdraw(w.addr('tron'), r2(r.float(80, 20000)), tMain + r.int(0, Math.max(1, hNow - 1) * 60) * 60, 'USDT')
    sun.noise(r.int(18, 26), tMain - DAY, tMain + 3 * HOUR, [['TRX', 'USDT']])

    // ── Valeurs pour les textes ──────────────────────────────────────────────
    const frozen = r2(balAt(w, S1, 'USDT', tNow))
    const splitMin = Math.round((splitEnd - tMain) / 60)
    const totalUsdtOut = r2(s3 + s4 + rDepV)
    const fromRansom = r2(s1)
    const fromBtc = r2(rToS1.transfers[0].value)
    const dustOnS1 = r2(frozen - fromRansom - fromBtc)
    const twinRows = [{ to: S3, tx: splitTx[2] }, { to: D1, tx: decoyTx.d1 }].sort((a, b) => a.tx.time - b.tx.time)
    const d1Trx = d1Swap.amountOut
    const d2Trx = d2Swap.amountOut
    // Soldes TRX à l'instant présent : reliquats de swap et TRX de frais avancés par P
    const trxAt = (a: string) => r2(balAt(w, a, 'TRX', tNow))
    // Ordre réel des deux dépôts sur l'adresse de l'exchange B
    const dbRows = [
      { t: s2Dep.tx.time, txt: `${amt(trxDeposited, 'TRX')} (après swap SunSwap)` },
      { t: s4Dep.tx.time, txt: `${amt(s4, 'USDT')} (après un saut)` },
    ].sort((a, b) => a.t - b.t)
    const dbOrder = `${dbRows[0].txt} puis ${dbRows[1].txt}`
    // Les échanges Telegram, horodatés (la pièce est datée du dernier message)
    const tgNego = tProof - r.int(20, 50) * 60
    const tgProofMsg = tProof + r.int(1, 4) * 60
    const tgTestMsg = tFamTest - r.int(30, 90) * 60
    const nSplit = 6
    const nameA = exA.entity.name
    const nameB = exB.entity.name
    const nameBtc = exBtc.entity.name
    const demandText = `${amt(ransomUsdt, 'USDT')} et ${amt(ransomBtc, 'BTC')}`
    // Premier dépôt sur un exchange après le paiement principal (minutes)
    const firstDepT = Math.min(s2Dep.tx.time, s3Dep.tx.time, s4Dep.tx.time)
    const firstDepMin = Math.round((firstDepT - tMain) / 60)

    return {
      world: w,
      title: `Enlèvement — ${city}`,
      briefing:
        `Le ${fmtDate(tKid, false)}, ${theRel} ${deEnt} (${city}), ${activity}, a été ${gh('enlevé', 'enlevée')} devant son domicile. Quelques heures plus tard, ${entName} a reçu sur Telegram une demande de rançon de ${demandText}, assortie de la consigne habituelle : ne pas prévenir la police. ${ge('Il', 'Elle')} a pourtant alerté les enquêteurs sans attendre.\n\n` +
        `Le paiement a été effectué sous le contrôle des enquêteurs et de la cellule de négociation, depuis les portefeuilles personnels ${deEnt}. ${TheRel} de ${ge('l\'entrepreneur', 'l\'entrepreneuse')} a été ${gh('libéré', 'libérée')} le ${fmtDate(tRelease)}, sans blessure grave. Les auteurs sont en fuite.\n\n` +
        `Nous sommes le ${fmtDate(tNow)} (H+${hNow} après le paiement principal). Le magistrat de permanence attend votre analyse pour signer les demandes urgentes : quelles adresses tiennent encore des fonds gelables, auprès de qui agir, et dans quel ordre. Sur Tron, chaque minute compte : un USDT peut être converti ou déposé sur un exchange en quelques secondes.`,
      evidence: [
        {
          id: 'telegram', type: 'telegram', title: 'Messages des ravisseurs (Telegram, extraits)', date: tgTestMsg, author: `@${handle}`,
          body:
            `[${stamp(tDemand)}] @${handle} : On a ${hf ? 'ta' : 'ton'} ${relation.rel}. ${gh('Il', 'Elle')} va bien tant que tu fais ce qu'on dit. Pas de police.\n` +
            `[${stamp(tDemand + 60)}] @${handle} : ${amt(ransomUsdt, 'USDT')} réseau TRC20 sur ${A(w, C)}\n` +
            `[${stamp(tDemand + 120)}] @${handle} : + ${amt(ransomBtc, 'BTC')} sur ${A(w, B0)}\n` +
            `[${stamp(tgNego)}] Négociateur (au nom de la famille) : Prouvez que vous contrôlez cette adresse Tron.\n` +
            `[${stamp(tgProofMsg)}] @${handle} : On vient de t'envoyer 1 USDT depuis l'adresse. Regarde ton portefeuille.\n` +
            `[${stamp(tgTestMsg)}] @${handle} : Envoie d'abord un petit montant pour tester, ensuite tout. Après le paiement, on ${gh('le', 'la')} relâche.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV de remise de la rançon (extrait)', date: tBtc + 2 * HOUR, author: 'Cellule de négociation — section de recherches',
          body:
            `Paiements effectués par ${entName} depuis ses portefeuilles personnels, en présence des enquêteurs :\n` +
            `- Portefeuille Tron de la famille : ${A(w, VT)}\n` +
            `- Portefeuille Bitcoin de la famille : ${A(w, FB)}\n\n` +
            `1. ${fmtDate(tProof)} — réception de 1 USDT envoyé par les ravisseurs (preuve de contrôle demandée par le négociateur).\n` +
            `2. ${fmtDate(tFamTest)} — paiement test de ${amt(famTest, 'USDT')}, confirmé par les ravisseurs.\n` +
            `3. ${fmtDate(tMain)} — paiement principal de ${amt(ransomUsdt, 'USDT')} : ${mainTx.hash}\n` +
            `4. ${fmtDate(tBtc)} — paiement de ${amt(ransomBtc, 'BTC')} : ${btcTx.hash}`,
        },
        {
          id: 'situation', type: 'rapport', title: `Point de situation à H+${hNow}`, date: tNow, author: 'Directeur d\'enquête',
          body:
            `${TheRel} ${deEnt} a été ${gh('retrouvé', 'retrouvée')} le ${fmtDate(tRelease)} et ${gh('pris', 'prise')} en charge par les secours. La priorité passe désormais à l'identification des auteurs et à la préservation du produit de l'infraction.\n\n` +
            `Demandes attendues du groupe crypto, dans l'heure :\n` +
            `- l'adresse (ou les adresses) qui détiennent encore des USDT, et le montant exact à faire geler ;\n` +
            `- les plateformes où des fonds ont été déposés (gel du compte et réquisition d'identification) ;\n` +
            `- le devenir des bitcoins.\n\n` +
            `Attention : le portefeuille de la famille a reçu, juste après le paiement, des micro-transferts d'adresses inconnues. Vérifiez avant de conclure.`,
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche réflexe — rançon payée en stablecoins', date: tMain - 30 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- L'USDT TRC-20 est un jeton émis par une société : son émetteur peut placer une adresse sur liste noire, ce qui bloque tous les USDT qu'elle détient. Le TRX, actif natif de Tron, n'est gelable par personne.\n` +
            `- Une adresse vidée ne peut plus être gelée utilement : seul compte le solde au moment de la demande.\n` +
            `- Sur Tron, un exchange attribue en général une adresse de dépôt par client, commune au TRX et aux jetons TRC-20 : deux flux vers la même adresse de dépôt aboutissent sur le même compte.\n` +
            `- Les échangeurs instantanés ne laissent pas de lien on-chain entre le dépôt et le paiement : corrélez montant et horaire.`,
        },
      ],
      seeds: [VT, FB],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: 'Quelle adresse Tron a collecté la rançon avant son fractionnement ?',
          answer: [C],
          hint: 'Ouvrez le paiement principal mentionné dans le PV et comparez son destinataire, caractère par caractère, avec l\'adresse donnée sur Telegram.',
          explanation: `${A(w, C)} reçoit le test des ravisseurs (${amt(gangTest, 'USDT')}), renvoie 1 USDT de preuve à la famille, puis reçoit ${amt(famTest, 'USDT')} de test et ${amt(ransomUsdt, 'USDT')}. ${splitMin} minutes après le paiement principal, elle a déjà réparti ${amt(total, 'USDT')} sur ${nSplit} adresses. Attention : deux autres adresses au début et à la fin identiques apparaissent dans l'historique du payeur ; seule celle-ci a reçu les paiements.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Dans les heures qui suivent le paiement principal, le portefeuille de la famille reçoit des micro-transferts d\'adresses presque identiques à la collecte. Comment les interpréter ?',
          ...choice(r,
            'Des robots d\'address poisoning sans lien avec les ravisseurs : les écarter et alerter la famille de ne jamais copier une adresse depuis l\'historique',
            [
              'D\'autres adresses des ravisseurs, à faire geler au même titre que la collecte',
              'La preuve de contrôle demandée par le négociateur, renvoyée depuis une autre adresse',
              'Un remboursement partiel de la rançon, à déduire du préjudice',
            ]),
          hint: 'Comparez les deux adresses caractère par caractère, puis regardez qui a financé l\'émetteur du micro-transfert et à qui d\'autre il en envoie.',
          explanation: `${A(w, poison)} partage les 5 premiers et 5 derniers caractères de la collecte ${A(w, C)}, ${A(w, poison2)} les 4 premiers et 4 derniers ; aucune n'a de lien de financement avec les ravisseurs (pas de TRX reçu de ${A(w, P)}) et n'apparaît pas dans les messages. Des micro-transferts (${amt(poisonTx.transfers[0].value, 'USDT')}, ${amt(poison2Tx.transfers[0].value, 'USDT')}) peu après un gros paiement sont la signature de robots d'address poisoning qui espèrent que leur adresse sera recopiée par erreur lors d'un prochain envoi. À documenter et à écarter, sans les confondre avec la preuve de contrôle (1 USDT envoyé par la collecte elle-même, avant le paiement).`,
        },
        {
          id: 'o2', type: 'address', points: 10,
          prompt: `À H+${hNow}, quelle adresse détient encore des USDT issus de la rançon ?`,
          answer: [S1],
          hint: 'Ouvrez chacune des six adresses alimentées par la collecte et regardez leur solde actuel, actif par actif (USDT ≠ TRX). Plus rapide : tracez les USDT reçus par l\'adresse de collecte (touche R) et lisez « Fonds encore détenus ».',
          explanation: `Des six adresses servies par la collecte, ${A(w, S1)} est la seule à n'avoir rien envoyé : elle détient ${amt(frozen, 'USDT')}. ${A(w, S3)} et ${A(w, S4)} n'ont plus aucun USDT (fonds déposés chez ${nameA}, et chez ${nameB} après un saut) : il ne leur reste que les TRX de frais avancés par les ravisseurs (${amt(trxAt(S3), 'TRX')} et ${amt(trxAt(S4), 'TRX')}). ${A(w, S2)} a converti ses USDT et détient encore ${amt(trxAt(S2), 'TRX')} (reliquat du swap de ${amt(trxKept, 'TRX')} et TRX de frais), et les deux leurres ont tout converti sur SunSwap (${A(w, D1).slice(0, 10)}… garde ${amt(trxAt(D1), 'TRX')}, ${A(w, D2).slice(0, 10)}… a ré-éclaté l'essentiel de ses ${amt(d2Trx, 'TRX')} sur ${d2Subs.length} adresses et en garde ${amt(trxAt(D2), 'TRX')}) : ce sont des TRX, sur lesquels l'émetteur de l'USDT n'a aucune prise. Dans le traçage, « Fonds encore détenus » ne laisse apparaître en USDT que ${A(w, S1).slice(0, 10)}….`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT faut-il demander à geler sur cette adresse ?',
          answer: frozen,
          hint: 'Le gel porte sur le solde présent au moment de la demande, pas sur le montant de la rançon ni sur la seule part que le traçage attribue à la collecte : ouvrez l\'adresse et lisez son solde USDT.',
          explanation: `${amt(frozen, 'USDT')}, solde exact de ${A(w, S1)} au moment de la demande : ${amt(fromRansom, 'USDT')} reçus de la collecte, ${amt(fromBtc, 'USDT')} renvoyés par ${A(w, R).slice(0, 10)}… (produit de la conversion des bitcoins) peu avant H+${hNow}${dustOnS1 > 0 ? `, et ${amt(dustOnS1, 'USDT')} de micro-transferts parasites` : ''}. Le montant à geler n'est donc ni la rançon USDT ni la seule tranche reçue de la collecte : c'est le solde présent. La demande doit citer l'adresse complète et ce montant. Le reste n'est plus sur une adresse auto-hébergée (exchanges) ou n'est plus en USDT (TRX).`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `Deux virements d'environ ${amt(s3, 'USDT')} quittent la collecte à quelques minutes d'intervalle. Lequel alimente une adresse qui dépose sur un exchange ?`,
          answer: [splitTx[2].id],
          hint: 'Les deux montants ne diffèrent que d\'une ou deux centaines d\'USDT : suivez chacun des deux destinataires jusqu\'à sa première sortie.',
          explanation: `${twinRows.map((x) => `${fmtDate(x.tx.time)} → ${A(w, x.to).slice(0, 10)}… (${amt(x.tx.transfers[0].value, 'USDT')})`).join(' ; ')}. ${A(w, S3).slice(0, 10)}… dépose la totalité de ses ${amt(s3, 'USDT')} sur une adresse de dépôt ${nameA} ${Math.round((s3Dep.tx.time - splitTx[2].time) / 60)} minutes plus tard : c'est la branche à requérir. Son jumeau ${A(w, D1).slice(0, 10)}… convertit tout en TRX sur SunSwap et n'en bouge plus : branche sans issue, hors de portée de Tether comme de tout exchange. Même schéma pour le virement d'environ ${amt(s2, 'USDT')} : ${A(w, S2).slice(0, 10)}… swappe puis dépose chez ${nameB}, son jumeau ${A(w, D2).slice(0, 10)}… swappe puis ré-éclate ses TRX sur ${d2Subs.length} adresses qui dorment. Les montants voisins ne prouvent rien ; seul le devenir de chaque destinataire tranche.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'À qui adresser en urgence la demande de gel de ces USDT ?',
          answer: ['tether'],
          hint: 'Qui, techniquement, peut bloquer un jeton TRC-20 sur une adresse que personne d\'autre ne contrôle ?',
          explanation: `Tether, émetteur de l'USDT (contrat ${A(w, usdtContract)}), peut inscrire l'adresse sur sa liste noire : les USDT y deviennent intransférables. ${procedureFor(tether)} Le gel n'est qu'une mesure conservatoire : la saisie pénale suit (ordonnance du JLD ou du juge d'instruction), puis la réémission des USDT vers un portefeuille de l'État. Ni SunSwap (protocole automatisé) ni ${nameA} ou ${nameB} n'ont de pouvoir sur une adresse auto-hébergée.`,
        },
        {
          id: 'o11', type: 'number', points: 8, tolerance: 2, unit: 'minutes',
          prompt: 'Combien de minutes après le paiement principal le premier dépôt sur un exchange intervient-il ?',
          answer: firstDepMin,
          hint: 'Parmi les branches Tron, repérez le premier transfert vers une adresse étiquetée « Adresse de dépôt » et comparez son horodatage à celui du paiement principal.',
          explanation: `Paiement principal le ${fmtDate(tMain)}, premier dépôt sur une adresse d'exchange le ${fmtDate(firstDepT)} : ${firstDepMin} minutes. Ce délai mesure la fenêtre dont disposaient les enquêteurs pour un gel par l'émetteur avant que les fonds ne rejoignent un compte d'exchange. Il justifie, dans les prochaines affaires, de préparer la demande de gel avant même le paiement surveillé.`,
        },
        {
          id: 'o5', type: 'addresses', points: 12,
          prompt: 'Sélectionnez toutes les adresses de dépôt d\'exchange (Tron et Bitcoin) qui ont reçu une partie de la rançon.',
          answer: [D_a, D_b, depBtc],
          hint: 'Suivez chaque branche jusqu\'à une adresse étiquetée « Adresse de dépôt ». Certaines branches convergent vers la même adresse.',
          explanation:
            `Trois adresses de dépôt, donc trois comptes clients :\n` +
            `- ${nameA} ${A(w, D_a)} : ${amt(s3, 'USDT')} (branche directe) puis ${amt(rDepV, 'USDT')} venus de la conversion des BTC ;\n` +
            `- ${nameB} ${A(w, D_b)} : ${dbOrder} ;\n` +
            `- ${nameBtc} ${A(w, depBtc)} : ${amt(btcDeposited, 'BTC')} en fin de peel chain.\n` +
            `Sur Tron, l'adresse de dépôt est propre à un client : deux branches qui y aboutissent désignent le même compte. ${procedureFor(exA.entity)}`,
        },
        {
          id: 'o6', type: 'address', points: 10,
          prompt: 'Une partie des bitcoins est revenue sur Tron. Quelle adresse Tron a reçu le produit de cette conversion ?',
          answer: [R],
          hint: `La première sortie de la peel chain part chez ChangeNOW. Corrélation : émetteur ChangeNOW, chaîne Tron, à partir de l'heure du dépôt, fenêtre d'environ 1 h, quelques % de tolérance sur ≈ ${Math.round(usd('BTC', cnValue)).toLocaleString('fr-FR')} $.`,
          explanation: `${A(w, B0)} envoie ${amt(cnValue, 'BTC')} (≈ ${Math.round(usd('BTC', cnValue)).toLocaleString('fr-FR')} $) à une adresse de dépôt ChangeNOW ; ${Math.round((peel1.payoutTx.time - peel1.depositTx.time) / 60)} minutes plus tard, ChangeNOW verse ${amt(peel1.payoutValue, 'USDT')} à ${A(w, R)}. Deux éléments confirment la corrélation : cette adresse a reçu ses TRX de frais du même financeur que la collecte (${A(w, P)}), et elle dépose ensuite ${amt(rDepV, 'USDT')} sur la même adresse ${nameA} que la branche ${A(w, S3)}. Les deux volets de la rançon aboutissent donc au même compte. Le solde (${amt(fromBtc, 'USDT')}) part en dernier, le ${fmtDate(rToS1.time)}, vers la réserve ${A(w, S1)} : il s'ajoute au montant à geler.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Dans la peel chain Bitcoin, une sortie part vers une adresse sans étiquette, ni exchange ni échangeur. Laquelle ?',
          answer: [U],
          hint: 'Suivez le rendu de la première étape (après ChangeNOW) : la transaction suivante a deux sorties, dont une petite vers une adresse inconnue.',
          explanation: `La deuxième étape de la peel chain envoie ${amt(uValue, 'BTC')} vers ${A(w, U)}, le reste filant vers ${A(w, B2)} puis ${nameBtc}. Cette adresse non attribuée peut correspondre à un complice, un prestataire (logistique, location de véhicule) ou un portefeuille personnel : elle est à surveiller (alerte sur mouvement) et à rapprocher des autres éléments de l'enquête, sans conclure à ce stade sur son titulaire.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Quelle adresse a financé en TRX (frais de réseau) la collecte et les adresses de fractionnement ?',
          answer: [P],
          hint: 'Ouvrez les premiers flux entrants de l\'adresse de collecte ou d\'une adresse de fractionnement : de petits montants de TRX, tous venus de la même adresse, quelques jours avant l\'enlèvement.',
          explanation: `${A(w, P)} envoie entre 100 et 300 TRX à la collecte, aux quatre adresses de fractionnement, au saut ${A(w, S4b)}, à ${A(w, R)}, aux deux leurres et à ${pl(spare.length, 'adresse qui ne servira', 'adresses qui ne serviront')} jamais, dans les jours qui précèdent l'enlèvement, puis ${amt(gangTest, 'USDT')} de test à la collecte. Il loue aussi de l'« énergie » Tron à un prestataire pour réduire ses frais. Sur Tron, chaque adresse a besoin de TRX pour payer ses frais : le financeur commun de « gas » relie toutes ces adresses à un même opérateur et date la préparation.`,
        },
        {
          id: 'o9', type: 'entity', points: 9,
          prompt: 'Quelle plateforme a alimenté cette adresse de préparation ?',
          answer: [kB],
          hint: 'Regardez les deux premiers flux entrants de l\'adresse de préparation (TRX puis USDT).',
          explanation: `Le ${fmtDate(wTrx.time)}, ${A(w, P)} reçoit ${amt(wTrx.transfers[0].value, 'TRX')} puis ${amt(gangTest, 'USDT')} du portefeuille chaud ${nameB} : ce sont des retraits depuis un compte client, effectués avant les faits, souvent avec moins de précautions que la sortie. La réquisition à ${nameB} doit donc viser, en plus de l'adresse de dépôt, ces deux retraits (titulaire, IP, appareil). ${procedureFor(exB.entity)}`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Dans quel ordre engager les actes ?',
          ...choice(r,
            'Gel Tether sur l\'adresse qui détient les USDT, puis gel des comptes chez les exchanges, puis réquisitions d\'identification',
            [
              'Réquisitions d\'identification aux exchanges d\'abord, gel Tether une fois les titulaires connus',
              'Demander à SunSwap de bloquer les TRX issus du swap, puis requérir Tether pour le reste',
              'Requérir ChangeNOW pour l\'identité KYC du client, préalable indispensable à tout gel',
            ]),
          hint: 'Classez les actes selon la vitesse à laquelle les fonds peuvent encore bouger.',
          explanation: `Les fonds encore auto-hébergés peuvent partir en quelques secondes : le gel Tether de ${A(w, S1)} (${amt(frozen, 'USDT')}) passe en premier. Viennent ensuite les demandes de gel conservatoire des comptes ${nameA}, ${nameB} et ${nameBtc}, dont les soldes peuvent encore être retirés, puis les réquisitions d'identification (KYC, IP de connexion, historique) et la demande de données de commande à ChangeNOW (hash du dépôt BTC). ${procedureFor(exB.entity)} SunSwap est un contrat automatisé sans opérateur capable de bloquer, et ChangeNOW n'impose pas de KYC systématique : attendre une identité de sa part avant de geler serait perdre la course.`,
        },
      ],
      truth: {
        path: [
          wTrx.id, wUsdt.id, ...gasTxs.map((t) => t.id), gangTestTx.id, proofTx.id, famTestTx.id, mainTx.id,
          ...splitTx.map((t) => t.id), swapRes.tx.id, s2Dep.tx.id, ...(s2Dep.sweep ? [s2Dep.sweep.id] : []),
          s3Dep.tx.id, ...(s3Dep.sweep ? [s3Dep.sweep.id] : []), s4Hop.id, s4Dep.tx.id, ...(s4Dep.sweep ? [s4Dep.sweep.id] : []),
          btcTx.id, peel1.depositTx.id, peel1.sweepTx.id, peel1.payoutTx.id, rDep.tx.id, ...(rDep.sweep ? [rDep.sweep.id] : []),
          peel2.id, peel3.id, btcSweep.id, rToS1.id,
        ],
        addresses: [C, S1, S2, S3, S4, S4b, R, P, B0, B1, B2, D_a, D_b, depBtc, peel1.deposit],
        debrief:
          `1. Préparation : ${A(w, P)}, alimentée par un retrait ${nameB} (${amt(wTrx.transfers[0].value, 'TRX')} puis ${amt(gangTest, 'USDT')}), finance en TRX la collecte et toutes les adresses de fractionnement, puis envoie ${amt(gangTest, 'USDT')} de test à la collecte ${A(w, C)}.\n` +
          `2. Négociation : la collecte renvoie 1 USDT à la famille (preuve de contrôle), puis reçoit ${amt(famTest, 'USDT')} de test et ${amt(ransomUsdt, 'USDT')} le ${fmtDate(tMain)}.\n` +
          `3. En ${splitMin} minutes, ${amt(total, 'USDT')} sont répartis sur six adresses : ${amt(s1, 'USDT')} vers ${A(w, S1)} (réserve, jamais dépensée), ${amt(s2, 'USDT')} vers ${A(w, S2)}, ${amt(s3, 'USDT')} vers ${A(w, S3)}, ${amt(s4, 'USDT')} vers ${A(w, S4)}, et deux leurres dont le montant imite S3 et S2 : ${amt(d1, 'USDT')} vers ${A(w, D1)} (converti en ${amt(d1Trx, 'TRX')}, immobile) et ${amt(d2, 'USDT')} vers ${A(w, D2)} (converti en TRX puis ré-éclaté sur ${d2Subs.length} adresses). ${spare.length > 1 ? `${spare.length} autres adresses, préparées et financées en TRX par la même source, n'ont jamais servi` : `Une autre adresse, préparée et financée en TRX par la même source, n'a jamais servi`}.\n` +
          `4. ${A(w, S2)} convertit ses USDT en ${amt(trxOut, 'TRX')} sur SunSwap et en dépose ${amt(trxDeposited, 'TRX')} chez ${nameB} ; ${A(w, S4)} fait un saut puis dépose ${amt(s4, 'USDT')} sur la même adresse ${nameB} ; ${A(w, S3)} dépose ${amt(s3, 'USDT')} chez ${nameA}.\n` +
          `5. Volet BTC : ${A(w, B0)} envoie ${amt(cnValue, 'BTC')} à ChangeNOW (payés ${amt(peel1.payoutValue, 'USDT')} sur ${A(w, R)}, dont ${amt(rDepV, 'USDT')} déposés chez ${nameA} et ${amt(fromBtc, 'USDT')} regroupés en dernier sur la réserve ${A(w, S1)}), ${amt(uValue, 'BTC')} à une adresse non identifiée, et le reliquat de ${amt(btcDeposited, 'BTC')} chez ${nameBtc}.\n` +
          `6. À H+${hNow}, seuls ${amt(frozen, 'USDT')} restent gelables par Tether, sur ${A(w, S1)} (tranche de la collecte et retour de la conversion BTC). Total déposé en USDT sur les exchanges : ${amt(totalUsdtOut, 'USDT')}.\n\n` +
          `À retenir : dans une affaire de rançon, le traçage se fait contre la montre. On cherche d'abord le solde encore détenu en USDT (gelable par l'émetteur), on distingue l'actif natif (TRX, non gelable) et on bascule ensuite vers les comptes d'exchange (gel puis identification). Face aux montants jumeaux, seul le devenir de chaque destinataire distingue la branche utile du leurre. Les transferts « test » et le financement en TRX (gas) relient toutes les adresses des auteurs, et le retrait ${nameB} qui a alimenté ${A(w, P)} est une piste d'identification à part entière.`,
      },
      hints: [
        'Partez du paiement principal (PV) : la collecte se vide en quelques minutes vers six adresses. Ouvrez chacune et lisez le solde restant, actif par actif ; deux montants se ressemblent par paires.',
        'Un USDT converti en TRX sur SunSwap échappe au gel de l\'émetteur ; un USDT déposé sur un exchange relève du gel du compte, pas de Tether.',
        'Côté Bitcoin, la première sortie de la peel chain va chez ChangeNOW : corrélez sur Tron (USDT) à partir de l\'heure et de la valeur du dépôt, puis vérifiez qui finance les frais de l\'adresse trouvée.',
        'Remontez aussi en amont : les petits envois de TRX reçus par les adresses des ravisseurs ont tous la même origine, elle-même alimentée par un exchange.',
      ],
    }
  },
}
