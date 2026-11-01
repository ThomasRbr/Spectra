import { World, type Tx } from '../engine/world'
import { bridge, coinjoin, dex, exchange, privacyPool, swapper, HOUR, DAY, type BridgeKit } from '../engine/patterns'
import { fromUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'
import { dusting, personalSpending, priorHistory } from '../engine/realism'

const MIN = 60
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const r2 = (v: number) => Math.round(v * 100) / 100
const floor2 = (v: number) => Math.floor(v * 100) / 100
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const btc8 = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} BTC`
const musd = (v: number) => `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M$`

/** Dénominations standard d'un CoinJoin de type Wasabi 2 (puissances de 2 en satoshis). */
const DENOMS = [5.36870912, 10.73741824, 21.47483648]
/** Marge laissée dans chaque UTXO découpée avant mixage (frais de coordination + réseau). */
const PREMIX_EXTRA = 0.0003

const EXCHANGES = [
  { name: 'Valmera Exchange', country: 'Lituanie', reg: 'Banque de Lituanie (MiCA)' },
  { name: 'Nordvik Exchange', country: 'Estonie', reg: 'Autorité de surveillance financière estonienne (MiCA)' },
  { name: 'Kestria Markets', country: 'Irlande', reg: 'Banque centrale d\'Irlande (MiCA)' },
  { name: 'Brivane', country: 'Pays-Bas', reg: 'AFM (Pays-Bas, MiCA)' },
]

/**
 * Date de l'affaire : de mi-janvier à fin avril 2024, pour que toute la chaîne
 * (jusqu'aux CoinJoin, une dizaine de jours après le vol) précède l'arrêt du
 * coordinateur zkSNACKs le 1er juin 2024. Calculée depuis la graine (déterministe).
 */
function caseStart(seed: number): number {
  const s = Math.abs(Math.trunc(seed))
  return 1704067200 + (12 + (s % 108)) * 86400 + (7 + (s % 11)) * 3600 + (s % 3000)
}

/**
 * Bridge ETH → BTC. `BridgeKit.send` émet la jambe d'arrivée par `transfer`
 * (modèle à comptes) : sur Bitcoin, il faut une vraie transaction UTXO payée
 * depuis la réserve du bridge. Les événements (nonce, destinataire) relient
 * les deux transactions comme pour les autres chaînes.
 */
function bridgeToBtc(w: World, br: BridgeKit, nonce: { n: number }, o: { from: string; value: number; time: number; recipient: string }): { outTx: Tx; inTx: Tx; received: number } {
  const r = w.rng
  const reserve = br.contract('btc')
  const outTx = w.transfer({ time: o.time, from: o.from, to: br.contract('eth'), value: o.value, asset: 'ETH', method: 'bridgeOut', tags: ['bridge'] })
  const received = r8(fromUsd('BTC', usd('ETH', o.value) * (1 - r.float(0.001, 0.004))))
  const inTx = w.utxoTx({ time: o.time + r.int(4, 25) * MIN, from: [reserve], to: [{ address: o.recipient, value: received }], change: reserve, tags: ['bridge'], method: 'bridgeIn' })
  const n = ++nonce.n
  outTx.bridge = { direction: 'out', otherChain: 'btc', otherTx: inTx.id, nonce: n, recipient: o.recipient }
  inTx.bridge = { direction: 'in', otherChain: 'eth', otherTx: outTx.id, nonce: n, recipient: o.recipient }
  return { outTx, inTx, received }
}

interface Route {
  l1: string
  l2: string
  btc: string
  via: 'arcbridge' | 'exch'
  hop: Tx
  out: Tx
  arr: Tx
  sent: number
  received: number
}

export const ethExchangeHack: ScenarioTemplate = {
  id: 'exchange-hack',
  title: 'Piratage d\'exchange : la méthode des groupes étatiques',
  tagline: 'Un hot wallet vidé en quelques minutes, des dizaines d\'adresses, un bridge, un CoinJoin et un OTC.',
  description:
    'Le portefeuille chaud d\'un exchange européen est vidé de son ETH et de quatre jetons. Le pirate convertit en priorité les stablecoins gelables, disperse le butin sur des dizaines d\'adresses, passe sur Bitcoin par un bridge, consolide, mixe dans des CoinJoin puis vend à un courtier OTC. Reconstituez la chaîne de blanchiment de bout en bout, et rédigez l\'attribution avec la prudence qu\'elle exige.',
  difficulty: 4,
  chains: ['eth', 'btc'],
  skills: ['evm', 'tokens', 'dex', 'bridge', 'crosschain', 'coinjoin', 'typologies'],
  estMinutes: 85,
  lessons: ['acteurs-etatiques', 'blanchiment-pro', 'bridges', 'chain-hopping', 'dex-defi'],
  generate(seed) {
    const w = new World(seed, caseStart(seed))
    const r = w.rng
    const T = w.at(0)

    // ── Acteurs ─────────────────────────────────────────────────────────────
    const VX = r.pick(EXCHANGES)
    const vex = w.customEntity({
      name: VX.name, category: 'exchange', risk: 'low', known: true, country: VX.country,
      description: `Plateforme d'échange européenne (fictive), enregistrée en ${VX.country}, qui compte de nombreux clients français.`,
      compliance: { contact: `Service conformité de ${VX.name}`, cooperation: 'eio', responseDays: [10, 30], canFreeze: true, kyc: 'renforcé', regulator: VX.reg },
    })
    const hk = w.customEntity({ name: `Pirate de ${VX.name} (non identifié)`, category: 'hack' })
    const uni = dex(w, 'uniswap', 'eth')
    const br = bridge(w, 'arcbridge')
    const xch = swapper(w, 'exch')
    const pp = privacyPool(w, 'tornado', 'eth')
    const sat = exchange(w, 'satsdesk', 'btc')
    const krKey = r.pick(['kraken', 'binance', 'okx'] as const)
    const kr = exchange(w, krKey, 'btc')
    const tether = w.entity('tether')
    const partner = r.pick(['Veridis Analytics', 'Chainward Intelligence', 'Halcyon Forensics'])
    const rssi = fakePerson(r)
    const g = rssi.g
    const nonce = { n: r.int(300000, 800000) }

    const hot = w.addr('eth', { entity: vex, label: `${VX.name} — Hot Wallet (multisig)`, contract: { name: `${VX.name} Hot Wallet`, type: 'multisig' } })
    const cold = w.addr('eth', { entity: vex, label: `${VX.name} — Cold Wallet`, contract: { name: `${VX.name} Cold Wallet`, type: 'multisig' } })
    const comms = w.addr('eth', { entity: vex, label: `${VX.name} — Adresse officielle` })

    // ── Montants dérobés (solde du hot wallet au moment des faits) ──────────
    const stolen: Record<'ETH' | 'USDT' | 'USDC' | 'DAI' | 'WBTC', number> = {
      ETH: roundAsset('ETH', r.float(2400, 5200)),
      USDT: roundAsset('USDT', r.float(2.6e6, 6.5e6)),
      USDC: roundAsset('USDC', r.float(1.5e6, 4e6)),
      DAI: roundAsset('DAI', r.float(4e5, 1.5e6)),
      WBTC: roundAsset('WBTC', r.float(18, 55)),
    }
    const ASSETS_ORDER = ['ETH', 'USDT', 'USDC', 'DAI', 'WBTC'] as const
    const usdOf = Object.fromEntries(ASSETS_ORDER.map((a) => [a, usd(a, stolen[a])])) as Record<(typeof ASSETS_ORDER)[number], number>
    const stolenUsd = ASSETS_ORDER.reduce((s, a) => s + usdOf[a], 0)

    // ── Activité normale de l'exchange avant les faits ──────────────────────
    for (let i = 0; i < r.int(4, 6); i++) {
      const as = r.pick(ASSETS_ORDER)
      const v = as === 'ETH' ? roundAsset('ETH', r.float(300, 1500)) : as === 'WBTC' ? roundAsset('WBTC', r.float(5, 20)) : roundAsset(as, r.float(2e5, 1.5e6))
      w.transfer({ time: T - Math.round(r.float(1, 9) * DAY), from: cold, to: hot, value: v, asset: as, method: 'execTransaction' })
    }
    for (let i = 0; i < r.int(14, 20); i++) {
      const as: AssetId = r.pick(['ETH', 'ETH', 'USDT', 'USDT', 'USDC', 'DAI', 'WBTC'] as const)
      const v = as === 'ETH' ? roundAsset('ETH', r.float(0.2, 40)) : as === 'WBTC' ? roundAsset('WBTC', r.float(0.01, 1.5)) : roundAsset(as, r.float(200, 60000))
      const t = T - Math.round(r.float(0.05, 8) * DAY)
      if (r.chance(0.55)) {
        w.transfer({ time: t, from: hot, to: w.addr('eth'), value: v, asset: as, method: 'withdraw' })
      } else {
        const dep = w.addr('eth', { entity: vex, label: `${VX.name} — Adresse de dépôt`, tags: ['deposit'] })
        w.fundAccount(dep, v, as, t - r.int(10, 240) * MIN)
        w.transfer({ time: t, from: dep, to: hot, value: v, asset: as, method: 'sweep', tags: ['sweep'] })
      }
    }

    // ── Préparation : gas de l'adresse du pirate issu de Tornado Cash ───────
    const H0 = w.addr('eth', { entity: hk })
    const gasTx = pp.withdraw(H0, 1, T - Math.round(r.float(1, 3) * DAY), true)

    // ── Le vol : cinq transactions en quelques minutes ───────────────────────
    let t = T
    const drains = ASSETS_ORDER.map((as) => {
      const tx = w.multi({ time: t, signer: H0, legs: [{ from: hot, to: H0, value: stolen[as], asset: as }], method: 'execTransaction', tags: ['hack'] })
      t += r.int(40, 240)
      return tx
    })

    // ── Conversions sur Uniswap : l'USDT d'abord (gelable), puis l'USDC ─────
    t += r.int(4, 9) * MIN
    // Le gel interviendra alors qu'il reste 8 à 22 % de l'USDT à écouler
    const usdtTarget = stolen.USDT * r.float(0.78, 0.92)
    const usdtSwaps: { tx: Tx; amountOut: number }[] = []
    let usdtSwapped = 0
    while (usdtTarget - usdtSwapped >= 100000) {
      const c = Math.min(Math.round(r.float(450000, 950000) / 50000) * 50000, Math.round((usdtTarget - usdtSwapped) / 10000) * 10000)
      usdtSwaps.push(uni.swap({ trader: H0, assetIn: 'USDT', amountIn: c, assetOut: 'ETH', time: t }))
      usdtSwapped += c
      t += r.int(2, 6) * MIN
    }
    const frozen = roundAsset('USDT', stolen.USDT - usdtSwapped)
    const freezeT = usdtSwaps[usdtSwaps.length - 1].tx.time + r.int(2, 5) * MIN

    t = freezeT + r.int(4, 12) * MIN
    const usdcSwaps: { tx: Tx; amountOut: number }[] = []
    let usdcLeft = stolen.USDC
    while (usdcLeft > 0) {
      let c = Math.min(usdcLeft, Math.round(r.float(450000, 950000) / 50000) * 50000)
      if (usdcLeft - c < 150000) c = usdcLeft
      usdcSwaps.push(uni.swap({ trader: H0, assetIn: 'USDC', amountIn: roundAsset('USDC', c), assetOut: 'ETH', time: t }))
      usdcLeft = roundAsset('USDC', usdcLeft - c)
      t += r.int(2, 6) * MIN
    }

    // DAI et WBTC : pas de gel par adresse à craindre, convertis plus tard
    t = Math.max(t + 20 * MIN, T + Math.round(r.float(1.5, 2.5) * HOUR))
    const dai1 = roundAsset('DAI', stolen.DAI * r.float(0.45, 0.6))
    const daiSwaps = [
      uni.swap({ trader: H0, assetIn: 'DAI', amountIn: dai1, assetOut: 'ETH', time: t }),
      uni.swap({ trader: H0, assetIn: 'DAI', amountIn: roundAsset('DAI', stolen.DAI - dai1), assetOut: 'ETH', time: t + r.int(3, 9) * MIN }),
    ]
    t += Math.round(r.float(0.6, 1.6) * HOUR)
    const wbtcSwap = uni.swap({ trader: H0, assetIn: 'WBTC', amountIn: stolen.WBTC, assetOut: 'ETH', time: t })
    const allSwaps = [...usdtSwaps, ...usdcSwaps, ...daiSwaps, wbtcSwap]
    const ethFromSwaps = allSwaps.reduce((s, x) => s + x.amountOut, 0)

    // Messages entrants (bruit) : offre de l'exchange, curieux et provocateurs
    const bounty = w.transfer({
      time: T + Math.round(r.float(4, 8) * HOUR), from: comms, to: H0, value: 0.0001, asset: 'ETH', method: 'transfer + message',
      memo: `${VX.name} security team: return the funds to our cold wallet and keep 10% as a bounty. Law enforcement has been notified.`,
    })
    const taunts = ['gm', 'nice job lol', 'send some to me pls', 'Return the funds. Everyone is watching this address.', 'which bridge next?']
    for (let i = 0; i < r.int(3, 5); i++) {
      w.transfer({ time: T + Math.round(r.float(1, 30) * HOUR), from: w.addr('eth'), to: H0, value: roundAsset('ETH', r.float(0.0001, 0.005)), asset: 'ETH', method: 'transfer + message', memo: r.pick(taunts) })
    }

    // ── Dispersion de premier niveau : montants proches ──────────────────────
    const N1 = r.int(16, 24)
    const L1 = w.addrs('eth', N1, { entity: hk })
    const dispTotal = w.balanceOf(H0, 'ETH') - r.float(0.8, 2.5)
    const weights = L1.map(() => r.float(0.97, 1.03))
    const wsum = weights.reduce((s, x) => s + x, 0)
    const parts = weights.map((x) => floor2((dispTotal * x) / wsum))
    const splitIdx = r.int(0, N1 - 1)
    const recvAt = new Map<string, number>()
    const dispTxs: Tx[] = []
    let td = t + Math.round(r.float(0.5, 2) * HOUR)
    const firstPart = floor2(parts[splitIdx] * r.float(0.55, 0.7))
    L1.forEach((a, i) => {
      const v = i === splitIdx ? firstPart : parts[i]
      dispTxs.push(w.transfer({ time: td, from: H0, to: a, value: v, asset: 'ETH' }))
      recvAt.set(a, td)
      td += r.int(1, 5) * MIN
    })
    const topUpT = td + r.int(6, 25) * MIN
    const topUp = w.transfer({ time: topUpT, from: H0, to: L1[splitIdx], value: r2(parts[splitIdx] - firstPart), asset: 'ETH' })
    dispTxs.push(topUp)
    recvAt.set(L1[splitIdx], topUpT)
    const perAvg = parts.reduce((s, x) => s + x, 0) / N1

    // ── Couche 2 puis passage sur Bitcoin (ArcBridge, ou eXch pour deux routes) ─
    const order = r.shuffle([...Array(N1).keys()])
    const exchIdx = new Set(order.slice(0, 2))
    const k = order[2] // route signalée par le partenaire d'analyse (ArcBridge)
    const reserve = br.contract('btc')
    w.sweepInto(reserve, r8(fromUsd('BTC', stolenUsd) * r.float(1.4, 1.9)), T - Math.round(r.float(3, 6) * DAY))
    const routes: Route[] = L1.map((l1, i) => {
      const l2 = w.addr('eth', { entity: hk })
      const v1 = r2(w.balanceOf(l1, 'ETH') - r.float(0.004, 0.02))
      const hop = w.transfer({ time: recvAt.get(l1)! + Math.round(r.float(2, 30) * HOUR), from: l1, to: l2, value: v1, asset: 'ETH' })
      const v2 = r2(v1 - r.float(0.004, 0.02))
      const btcAddr = w.addr('btc', { entity: hk, kind: 'p2wpkh' })
      const tb = hop.time + Math.round(r.float(1, 18) * HOUR)
      if (exchIdx.has(i)) {
        const ord = xch.order({ from: l2, value: v2, asset: 'ETH', time: tb, toChain: 'btc', recipient: btcAddr, delayMin: [10, 45], decoys: r.int(2, 4) })
        return { l1, l2, btc: btcAddr, via: 'exch', hop, out: ord.depositTx, arr: ord.payoutTx, sent: v2, received: ord.payoutValue }
      }
      const b = bridgeToBtc(w, br, nonce, { from: l2, value: v2, time: tb, recipient: btcAddr })
      return { l1, l2, btc: btcAddr, via: 'arcbridge', hop, out: b.outTx, arr: b.inTx, sent: v2, received: b.received }
    })
    const rk = routes[k]
    const nArc = routes.filter((x) => x.via === 'arcbridge').length
    const firstOut = Math.min(...routes.map((x) => x.out.time))
    const lastOut = Math.max(...routes.map((x) => x.out.time))
    const lastArr = Math.max(...routes.map((x) => x.arr.time))

    // ── Consolidation sur Bitcoin (entrées communes) ─────────────────────────
    const C = w.addr('btc', { entity: hk, kind: 'p2wpkh' })
    const consT = lastArr + Math.round(r.float(10, 40) * HOUR)
    const arrivals = routes.map((x) => x.btc)
    const consIn = arrivals.reduce((s, a) => s + w.unspentValue(a, consT), 0)
    const consFee = w.estimateFee('btc', N1, 1)
    const B = r8(consIn - consFee)
    const consTx = w.utxoTx({ time: consT, from: r.shuffle([...arrivals]), to: [{ address: C, value: B }], fee: consFee, change: null, spendAll: true, method: 'consolidation' })

    // ── Découpage avant mixage puis CoinJoin ──────────────────────────────────────
    const D = DENOMS.find((d) => Math.floor((B * 0.8) / (d + PREMIX_EXTRA)) <= 24) ?? DENOMS[DENOMS.length - 1]
    const m = Math.max(4, Math.floor((B * 0.8) / (D + PREMIX_EXTRA)))
    const premix = w.addrs('btc', m, { entity: hk, kind: 'p2wpkh' })
    const toxic = w.addr('btc', { entity: hk, kind: 'p2wpkh' })
    const splitTx = w.utxoTx({
      time: consT + Math.round(r.float(3, 20) * HOUR), from: [C],
      to: premix.map((p) => ({ address: p, value: r8(D + PREMIX_EXTRA) })),
      change: toxic, fee: w.estimateFee('btc', 1, m + 1), spendAll: true, method: 'découpage avant mixage',
    })
    const toxicValue = splitTx.outputs.find((o) => o.address === toxic)!.value
    const nRounds = Math.ceil(m / 8)
    const groups: string[][] = Array.from({ length: nRounds }, () => [])
    premix.forEach((p, i) => groups[i % nRounds].push(p))
    let tc = splitTx.time + r.float(1, 6) * HOUR
    const cjs: Tx[] = []
    const mixed: string[] = []
    for (const grp of groups) {
      const extra = r.int(5, 9)
      const res = coinjoin(w, { chain: 'btc', time: Math.round(tc), denom: D, participants: grp.map((p) => ({ from: p, changeTo: null })), extra, coordinatorFee: r8(0.00002 * (grp.length + extra)) })
      cjs.push(res.tx)
      mixed.push(...res.mixed)
      tc += r.float(1.5, 8) * HOUR
    }
    const lastCj = cjs[cjs.length - 1]

    // Les autres participants dépensent leurs sorties (fausses pistes vers un exchange)
    let nOthersToKr = 0
    for (const cj of cjs) {
      for (const o of cj.outputs) {
        if (mixed.includes(o.address) || w.get(o.address).entityId === 'wasabi' || o.value.toFixed(8) !== D.toFixed(8)) continue
        if (r.chance(0.45)) {
          kr.receive(o.address, r8(D * r.float(0.3, 0.95)), cj.time + Math.round(r.float(2, 72) * HOUR))
          nOthersToKr++
        }
      }
    }

    // ── Post-mix : regroupements vers SatsDesk OTC ───────────────────────────
    const shuffled = r.shuffle([...mixed])
    const half = Math.ceil(shuffled.length / 2)
    const batchA = r.shuffle([toxic, ...shuffled.slice(0, half)])
    const batchB = shuffled.slice(half)
    const dA = sat.newDeposit()
    const dB = sat.newDeposit()
    const tA = lastCj.time + Math.round(r.float(12, 48) * HOUR)
    const inA = batchA.reduce((s, a) => s + w.unspentValue(a, tA), 0)
    const feeA = w.estimateFee('btc', batchA.length, 1)
    const pmA = w.utxoTx({ time: tA, from: batchA, to: [{ address: dA, value: r8(inA - feeA) }], fee: feeA, change: null, spendAll: true })
    const tB = tA + Math.round(r.float(3, 30) * HOUR)
    const inB = batchB.reduce((s, a) => s + w.unspentValue(a, tB), 0)
    const feeB = w.estimateFee('btc', batchB.length, 1)
    const pmB = w.utxoTx({ time: tB, from: batchB, to: [{ address: dB, value: r8(inB - feeB) }], fee: feeB, change: null, spendAll: true })
    const swA = sat.sweep([dA], tA + Math.round(r.float(1, 6) * HOUR))[0]
    const swB = sat.sweep([dB], tB + Math.round(r.float(1, 6) * HOUR))[0]
    const toOtc = r8(pmA.outputs[0].value + pmB.outputs[0].value)

    // ── Bruit ────────────────────────────────────────────────────────────────
    uni.noise(40, T - 2 * DAY, T + 3 * DAY, [['ETH', 'USDT'], ['ETH', 'USDC'], ['ETH', 'DAI'], ['ETH', 'WBTC']])
    pp.noise(1, r.int(15, 25), T - 10 * DAY, T + 5 * DAY)
    // Autres utilisateurs d'ArcBridge vers Bitcoin, parfois de montant proche
    const bridgeUser = (v: number, time: number) => {
      const u = w.addr('eth')
      w.fundAccount(u, roundAsset('ETH', v * r.float(1.01, 1.2)), 'ETH', time - Math.round(r.float(0.2, 3) * DAY))
      return bridgeToBtc(w, br, nonce, { from: u, value: v, time, recipient: w.addr('btc') })
    }
    for (let i = 0; i < r.int(6, 10); i++) {
      const v = r.chance(0.5) ? r2(perAvg * r.float(0.93, 1.07)) : r2(r.float(2, 250))
      bridgeUser(v, Math.round(r.float(firstOut - DAY, lastOut + DAY)))
    }
    // Leurre cité sur le forum : même ordre de grandeur, même fenêtre que la route signalée
    const decoyT = rk.out.time + (r.chance(0.5) ? 1 : -1) * Math.round(r.float(0.4, 2) * HOUR)
    const decoy = bridgeUser(r2(rk.sent * r.float(0.97, 1.03)), decoyT)
    for (let i = 0; i < r.int(4, 7); i++) {
      const u = w.addr('eth')
      const v = r2(r.float(1, 120))
      const tb = Math.round(r.float(T - 2 * DAY, lastOut + DAY))
      w.fundAccount(u, roundAsset('ETH', v * 1.05), 'ETH', tb - Math.round(r.float(0.2, 2) * DAY))
      br.send({ from: u, value: v, time: tb, toChain: 'bsc', recipient: w.addr('bsc') })
    }
    sat.noise(12, consT - 2 * DAY, tB + 5 * DAY)
    kr.noise(10, consT - 2 * DAY, tB + 5 * DAY)

    // ── Portefeuilles opérateurs réutilisés par le groupe (habillage) ────────
    // Deux adresses à la vie propre (historique, dépenses, poussière) ont servi
    // à acheminer le gas vers l'adresse d'attaque, en plus du retrait Tornado.
    const OP = w.addr('eth', { entity: hk })
    const OP2 = w.addr('eth', { entity: hk })
    const opGas1 = pp.withdraw(OP, 1, T - Math.round(r.float(2, 4) * DAY), true)
    const opGas2 = pp.withdraw(OP2, 1, T - Math.round(r.float(1, 2) * DAY), true)
    const opRelay1 = w.transfer({ time: T - Math.round(r.float(0.3, 1.5) * DAY), from: OP, to: H0, value: roundAsset('ETH', r.float(0.5, 0.9)), asset: 'ETH' })
    const opRelay2 = w.transfer({ time: T + Math.round(r.float(0.3, 1) * HOUR), from: OP2, to: H0, value: roundAsset('ETH', r.float(0.4, 0.8)), asset: 'ETH' })
    priorHistory(w, OP, { start: T - Math.round(r.float(120, 200) * DAY), end: T - 20 * DAY, nIn: 5, nOut: 4, maxUsd: 4000, asset: 'ETH' })
    // Prestataires techniques payés par les opérateurs (infrastructure d'attaque) : pistes de réquisition
    const opShops = [
      w.customEntity({ name: 'Quorra Hosting (serveurs dédiés)', category: 'merchant', known: true, description: 'Hébergeur de serveurs dédiés (fictif) acceptant l\'ETH, sans vérification d\'identité : conserve l\'e-mail du client, les adresses IP et les serveurs loués.' }),
      w.customEntity({ name: 'Ombrix VPN', category: 'merchant', known: true, description: 'Service de VPN (fictif) payable en crypto-actifs : conserve les dates d\'abonnement et l\'identifiant de compte.' }),
      w.customEntity({ name: 'Numerio (numéros virtuels)', category: 'merchant', known: true, description: 'Revendeur (fictif) de numéros de téléphone virtuels payables en crypto-actifs, utilisés pour créer des comptes de messagerie.' }),
    ]
    personalSpending(w, OP, { start: T - 60 * DAY, end: T - 10 * DAY, n: 3, merchants: opShops.slice(0, 2), asset: 'ETH' })
    dusting(w, OP, { time: T - 30 * DAY, n: 3, spreadH: 200 })
    priorHistory(w, OP2, { start: T - Math.round(r.float(90, 160) * DAY), end: T - 15 * DAY, nIn: 5, nOut: 4, maxUsd: 3000, asset: 'ETH' })
    personalSpending(w, OP2, { start: T - 50 * DAY, end: T - 8 * DAY, n: 3, merchants: opShops.slice(1), asset: 'ETH' })
    dusting(w, OP2, { time: T - 20 * DAY, n: 3, spreadH: 160 })

    // ── Textes ───────────────────────────────────────────────────────────────
    const listed = r.shuffle(L1.filter((_, i) => i !== k)).slice(0, 5)
    const handle = fakeHandle(r)
    const forumT = Math.max(decoyT, rk.out.time) + Math.round(r.float(3, 12) * HOUR)
    const alertT = rk.arr.time + Math.round(r.float(6, 30) * HOUR)
    const hours = (x: number) => Math.round((x - T) / HOUR)
    const nCj = cjs.length

    return {
      world: w,
      title: `Piratage de ${VX.name}`,
      briefing:
        `Le ${fmtDate(T)}, le portefeuille chaud multisignature de ${VX.name}, plateforme d'échange enregistrée en ${VX.country} et très utilisée par des clients français, a été vidé en quelques minutes : ETH, USDT, USDC, DAI et WBTC. La filiale française a déposé plainte ; le parquet de Paris (section cybercriminalité) vous confie l'analyse des flux.\n\n` +
        `Le scénario rappelle des affaires publiquement documentées : compromission ciblée des signataires, dispersion immédiate sur des dizaines d'adresses, conversion des jetons gelables, passage sur Bitcoin, CoinJoin, puis revente à des courtiers de gré à gré (OTC). Plusieurs acteurs privés évoquent déjà, à voix haute, un groupe étatique.\n\n` +
        `Objectifs : chiffrer le préjudice, décrire la dispersion, expliquer l'ordre des conversions, suivre une route jusqu'à Bitcoin, trouver la consolidation et le service de sortie, puis formuler l'attribution dans des termes juridiquement tenables.`,
      evidence: [
        {
          id: 'communique', type: 'rapport', title: `Communiqué d'incident de ${VX.name} (mise à jour)`, date: T + Math.round(r.float(26, 34) * HOUR), author: `${VX.name} — Direction`,
          body:
            `Le ${fmtDate(T)}, notre hot wallet multisignature (${A(w, hot)}) a été vidé à la suite d'une compromission de notre processus de signature. Nos cold wallets ne sont pas touchés ; les avoirs des clients sont garantis par nos fonds propres.\n\n` +
            `Transactions de vol (extrait) :\n- ${drains[0].hash}\n- ${drains[1].hash}\n\n` +
            `Adresse principale de l'attaquant : ${A(w, H0)}\n` +
            `Autres adresses identifiées à ce stade (liste non exhaustive, mise à jour en continu) :\n${listed.map((a) => `- ${A(w, a)}`).join('\n')}\n\n` +
            `Première estimation du préjudice : plus de ${Math.floor(stolenUsd / 1e6) - 1} millions de dollars, à confirmer. Nous appelons les plateformes à bloquer tout dépôt lié à ces adresses.`,
        },
        {
          id: 'tether', type: 'email', title: 'Notification de gel transmise par l\'émetteur de l\'USDT', date: freezeT + Math.round(r.float(1, 3) * HOUR), author: 'Tether — conformité (via le portail des forces de l\'ordre)',
          body:
            `Suite au signalement de ${VX.name} et à la demande des autorités, l'adresse ${A(w, H0)} a été inscrite sur la liste noire du contrat USDT (Ethereum) le ${fmtDate(freezeT)}.\n\n` +
            `Solde gelé sur cette adresse : ${amt(frozen, 'USDT')}. Ces jetons ne peuvent plus être transférés. Toute demande de restitution devra s'appuyer sur une décision judiciaire.`,
        },
        {
          id: 'pv', type: 'pv', title: `PV d'audition du responsable sécurité de ${VX.name} (extrait)`, date: T + Math.round(r.float(2, 4) * DAY), author: rssi.name,
          body:
            `${rssi.name}, RSSI de ${VX.name}, ${g('entendu', 'entendue')} en qualité de ${g('représentant', 'représentante')} de la plateforme :\n` +
            `« Nos signataires ont approuvé ce que l'interface présentait comme un réapprovisionnement de routine. En réalité, les transactions signées envoyaient tout le solde du hot wallet vers ${A(w, H0)}. ` +
            `Deux semaines plus tôt, un de nos développeurs avait reçu une offre d'emploi très attractive, avec un « test technique » à exécuter sur son poste. Nous pensons que c'est le point d'entrée. ` +
            `Les cinq actifs sont partis entre le ${fmtDate(drains[0].time)} et le ${fmtDate(drains[drains.length - 1].time)}. Nous avons contacté l'émetteur de l'USDT dans l'heure. »`,
        },
        {
          id: 'alerte', type: 'rapport', title: `Alerte de ${partner} (partenaire d'analyse)`, date: alertT, author: partner,
          body:
            `Suivi de l'adresse ${A(w, rk.l1)}, alimentée par l'adresse principale de l'attaquant de ${VX.name} : les fonds transitent par une adresse intermédiaire avant d'être envoyés vers ArcBridge, à destination de Bitcoin.\n\n` +
            `Typologie observée : dispersion en montants proches sur de nombreuses adresses, conversion prioritaire des stablecoins gelables, chain hopping vers Bitcoin, mixage CoinJoin attendu, puis revente OTC.\n\n` +
            `Évaluation : mode opératoire cohérent avec celui publiquement attribué à des groupes liés à un État (Corée du Nord). Confiance modérée, fondée en partie sur des éléments d'infrastructure non publics. Cette évaluation ne constitue pas une preuve.`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil d\'un « détective on-chain » sur un réseau social', date: forumT, author: `@${handle}`,
          body:
            `Le pirate de ${VX.name} vient de bridger vers Bitcoin, je le tiens : tx ${decoy.outTx.hash}, même montant que ce qui sort de ses adresses, même heure.\n` +
            `Et franchement c'est la Corée du Nord, aucun doute, même méthode qu'à chaque fois. Les autorités n'ont plus qu'à l'écrire noir sur blanc.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'amount', points: 10, unit: 'USD', tolerance: 0.02,
          prompt: `Quel est le montant total dérobé sur le hot wallet de ${VX.name}, tous actifs confondus (en USD, au cours affiché par l'outil) ?`,
          answer: stolenUsd,
          hint: 'Ouvrez les transactions de vol listées dans le communiqué, puis les autres sorties du hot wallet vers l\'adresse principale à la même heure : il y a un actif par transaction.',
          explanation: `Cinq transactions signées « execTransaction » vident le hot wallet vers ${A(w, H0)} : ${amt(stolen.ETH, 'ETH')} (${usdFmt(usdOf.ETH)}), ${amt(stolen.USDT, 'USDT')}, ${amt(stolen.USDC, 'USDC')}, ${amt(stolen.DAI, 'DAI')} et ${amt(stolen.WBTC, 'WBTC')} (${usdFmt(usdOf.WBTC)}), soit ${usdFmt(stolenUsd)}. Les ${amt(frozen, 'USDT')} gelés par Tether font partie du préjudice : ils sont bloqués, pas restitués. La « première estimation » du communiqué n'est qu'un ordre de grandeur.`,
        },
        {
          id: 'o2', type: 'number', points: 10,
          prompt: 'Combien d\'adresses distinctes reçoivent de l\'ETH directement de l\'adresse principale du pirate lors de la dispersion (premier niveau) ?',
          answer: N1,
          hint: 'Ne comptez que les virements d\'ETH sortant de l\'adresse principale (pas les jambes des swaps Uniswap), et comptez des adresses, pas des transactions.',
          explanation: `${N1} adresses reçoivent chacune environ ${amt(r2(perAvg), 'ETH')}, en ${N1 + 1} virements espacés de quelques minutes : ${A(w, L1[splitIdx])} reçoit sa part en deux fois (complément de ${amt(topUp.transfers[0].value, 'ETH')}). Ces montants proches, envoyés en rafale vers des adresses neuves, sont la signature d'une dispersion automatisée : elle multiplie les pistes à suivre et dilue les alertes des plateformes.`,
        },
        {
          id: 'o3', type: 'choice', points: 10,
          prompt: 'Quel jeton le pirate convertit-il en premier, et pourquoi ?',
          ...choice(r,
            'L\'USDT, car son émetteur peut geler les jetons détenus par une adresse : il faut s\'en défaire avant le blocage',
            [
              'Le DAI, car c\'est le stablecoin que son émetteur peut geler le plus vite',
              'Le WBTC, car sa valeur unitaire élevée rend sa conversion plus rentable',
              'L\'USDC, car c\'est le jeton dont les frais de swap sont les plus faibles',
            ]),
          hint: 'Classez les swaps de l\'adresse principale par horodatage, et rapprochez-les de la notification de gel.',
          explanation: `Le premier swap (${usdtSwaps[0].tx.hash.slice(0, 14)}…, ${fmtDate(usdtSwaps[0].tx.time)}) cède de l'USDT : ${usdtSwaps.length} tranches pour ${amt(usdtSwapped, 'USDT')}, découpées pour limiter le glissement de prix. Tether gèle l'adresse le ${fmtDate(freezeT)} : ${amt(frozen, 'USDT')} restent bloqués. Le pirate passe aussitôt à l'USDC (${usdcSwaps.length} tranches ; Circle peut aussi geler), puis, ${hours(daiSwaps[0].tx.time)} h après le vol, au DAI (aucune fonction de gel) et au WBTC (pas de liste noire par adresse). L'ordre des conversions suit le risque de gel : c'est pourquoi la demande de gel aux émetteurs doit partir dans l'heure. ${procedureFor(tether)}`,
        },
        {
          id: 'o4', type: 'tx', points: 12,
          prompt: `Le partenaire signale l'adresse ${A(w, rk.l1)}. Quelle transaction fait passer ses fonds sur Bitcoin ?`,
          answer: [rk.out.id, rk.arr.id],
          hint: 'Suivez l\'ETH sur deux sauts. Dans l\'événement du bridge, le nonce et le destinataire relient la transaction de départ à celle d\'arrivée : ne vous fiez pas au seul montant.',
          explanation: `${A(w, rk.l1)} transfère ${amt(rk.hop.transfers[0].value, 'ETH')} à ${A(w, rk.l2)} (${rk.hop.hash.slice(0, 14)}…), qui envoie ${amt(rk.sent, 'ETH')} dans ArcBridge (${rk.out.hash.slice(0, 14)}…, nonce ${rk.out.bridge?.nonce}). La transaction d'arrivée ${rk.arr.hash.slice(0, 14)}… verse ${amt(rk.received, 'BTC')} à ${A(w, rk.btc)}. La transaction citée sur le forum (${decoy.outTx.hash.slice(0, 14)}…) a un montant voisin dans la même fenêtre, mais elle part d'une adresse sans lien avec le pirate et son événement désigne un autre destinataire : corréler par le montant seul mène à l'erreur.`,
        },
        {
          id: 'o5', type: 'address', points: 12,
          prompt: 'Sur Bitcoin, sur quelle adresse le pirate regroupe-t-il les fonds arrivés des différentes routes ?',
          answer: [C],
          hint: 'Dépliez les dépenses de l\'adresse d\'arrivée : la transaction qui suit a de très nombreuses entrées.',
          explanation: `La transaction ${consTx.hash.slice(0, 14)}… dépense ensemble ${N1} adresses d'arrivée (${nArc} arrivées ArcBridge et 2 paiements de l'échangeur eXch, sans lien on-chain avec Ethereum) vers ${A(w, C)} : ${amt(B, 'BTC')}. Par l'heuristique des entrées communes, toutes ces adresses appartiennent au même portefeuille : la consolidation « recolle » les ${N1} routes, y compris celles passées par eXch, que la corrélation montant/temps seule n'aurait pas établies avec certitude.`,
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 0, unit: 'UTXO',
          prompt: 'Avant le mixage, en combien d\'UTXO de montant identique la consolidation est-elle découpée ?',
          answer: m,
          hint: 'Ouvrez la dépense de l\'adresse de consolidation : comptez les sorties de même montant, en laissant de côté la sortie différente.',
          explanation: `${splitTx.hash.slice(0, 14)}… crée ${m} sorties de ${btc8(r8(D + PREMIX_EXTRA))} : la dénomination standard ${btc8(D)} plus une marge pour les frais de coordination et de réseau. Le coordinateur Wasabi accepte des entrées de tout montant ; en découpant d'avance la consolidation, le pirate s'assure que chaque UTXO ressortira en exactement une sortie de la dénomination standard et peut les répartir sur plusieurs tours. Ce découpage annonce aussi combien de sorties mixées il faudra retrouver de l'autre côté (${m}), et sur combien de tours elles se répartissent (${nCj}).`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Quelle adresse reçoit le rendu de ce découpage, qui n\'entrera jamais dans un CoinJoin ?',
          answer: [toxic],
          hint: 'Dans la transaction de découpage, une seule sortie n\'a pas le montant standard : c\'est le reliquat de la consolidation.',
          explanation: `${A(w, toxic)} reçoit ${amt(toxicValue, 'BTC')}, le reste de la consolidation qui ne remplit pas une dénomination entière. Ce rendu « toxique » n'est pas mixé : il reste directement rattaché au pirate par la chaîne consolidation → découpage. Le pirate le dépense plus tard avec des sorties mixées, ce qui annule pour elles le bénéfice du CoinJoin.`,
        },
        {
          id: 'o6', type: 'entity', points: 12,
          prompt: 'Quel service reçoit les fonds à la sortie du CoinJoin ?',
          answer: ['satsdesk'],
          hint: 'Le découpage avant mixage laisse un rendu qui n\'entre pas dans le CoinJoin. Où ce rendu est-il dépensé, et avec quoi ?',
          explanation: `${A(w, C)} découpe ${amt(r8(m * (D + PREMIX_EXTRA)), 'BTC')} en ${m} UTXO de ${btc8(r8(D + PREMIX_EXTRA))} et garde un rendu de ${amt(toxicValue, 'BTC')} (${A(w, toxic)}), qui n'est pas mixé. ${nCj > 1 ? `${nCj} CoinJoin coordonnés par zkSNACKs produisent` : 'Un CoinJoin coordonné par zkSNACKs produit'} des sorties de ${btc8(D)}, dénomination standard (2^${Math.round(Math.log2(D * 1e8))} satoshis). Erreur d'hygiène : ${half} sorties mixées sont dépensées avec ce rendu vers une adresse de dépôt de SatsDesk OTC, ce qui les rattache au pirate par entrées communes ; les ${batchB.length} autres partent vers une seconde adresse de dépôt SatsDesk (lien de présomption seulement : même dénomination, mêmes tours, même courtier, ${Math.round((tB - tA) / HOUR)} h d'écart). Au total ${amt(toOtc, 'BTC')}.${nOthersToKr ? ` Des sorties d'autres participants partent vers ${kr.entity.name} : fausse piste, rien ne les relie au pirate.` : ''} ${procedureFor(sat.entity)}`,
        },
        {
          id: 'o10', type: 'addresses', points: 10,
          prompt: 'Sélectionnez les adresses de dépôt du service de sortie qui reçoivent les fonds post-mix du pirate.',
          answer: [dA, dB],
          hint: 'Partez de la dépense du rendu non mixé, puis cherchez, peu après, une seconde dépense regroupant uniquement des sorties mixées des mêmes tours vers le même service.',
          explanation: `${A(w, dA)} reçoit ${amt(pmA.outputs[0].value, 'BTC')} : le rendu non mixé et ${half} sorties mixées y sont dépensés ensemble (lien par entrées communes). ${A(w, dB)}, autre adresse de dépôt du même courtier, reçoit ${amt(pmB.outputs[0].value, 'BTC')} ${Math.round((tB - tA) / HOUR)} h plus tard, depuis les ${batchB.length} autres sorties mixées (lien de présomption). Les deux adresses de dépôt sont à viser dans la même demande au courtier, qui pourra dire si elles relèvent du même compte client.`,
        },
        {
          id: 'o11', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (en BTC) parvient au service de sortie ?',
          answer: toOtc,
          hint: 'Additionnez les deux versements vers les adresses de dépôt du courtier.',
          explanation: `${amt(pmA.outputs[0].value, 'BTC')} + ${amt(pmB.outputs[0].value, 'BTC')} = ${amt(toOtc, 'BTC')}, soit environ ${usdFmt(usd('BTC', toOtc))} pour un préjudice de ${usdFmt(stolenUsd)} : l'écart correspond surtout à l'USDT gelé, aux frais (swaps, bridge, CoinJoin) et aux reliquats restés sur les adresses intermédiaires. C'est le montant à indiquer au courtier pour la demande de blocage et de documentation des contreparties.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Les sorties mixées envoyées vers la seconde adresse de dépôt du courtier ne sont pas dépensées avec le rendu non mixé. Comment présenter leur rattachement au pirate ?',
          ...choice(r,
            'Comme une présomption (même dénomination, mêmes tours, même courtier, délai court), distincte du lien établi par entrées communes',
            [
              'Comme un lien certain : toute sortie de CoinJoin dépensée vers le même courtier appartient au même acteur',
              'Comme sans intérêt : seules les sorties dépensées avec le rendu peuvent figurer dans le rapport',
              'Comme un lien certain, puisque l\'heuristique des entrées communes s\'applique au CoinJoin lui-même',
            ]),
          hint: 'Quelle heuristique relie la première adresse de dépôt au pirate ? S\'applique-t-elle à la seconde ?',
          explanation: `Les sorties dépensées avec le rendu toxique sont rattachées par entrées communes : lien fort. Les autres ne partagent aucune transaction avec un élément déjà attribué : leur rattachement repose sur un faisceau (dénomination, tours, destination, délai), suffisant pour orienter une réquisition mais à exposer comme une présomption. L'heuristique des entrées communes ne s'applique jamais à la transaction de CoinJoin elle-même, qui réunit par construction des participants différents. La réponse du courtier (même compte client ou non) tranchera.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Comment rédiger l\'attribution dans votre rapport au parquet ?',
          ...choice(r,
            'Les flux sont compatibles avec le mode opératoire publiquement documenté de groupes liés à un État ; l\'attribution relève d\'autres sources et reste à établir',
            [
              'Le piratage est l\'œuvre d\'un groupe étatique nord-coréen, comme le prouvent l\'usage d\'un bridge et de CoinJoin',
              'L\'alerte du partenaire suffit : son évaluation peut être reprise telle quelle comme une constatation',
              'Aucune mention n\'est possible : toute comparaison avec un mode opératoire connu est interdite',
            ]),
          hint: 'Relisez l\'alerte du partenaire : sur quoi repose son évaluation, avec quel niveau de confiance ? Et que prouve, à lui seul, un graphe de transactions ?',
          explanation: `L'analyse on-chain établit des flux, pas une identité. Dispersion, conversion prioritaire des jetons gelables, bridge, CoinJoin et OTC sont des techniques partagées par de nombreux acteurs : ensemble, elles rendent l'hypothèse étatique plausible, sans la prouver. L'évaluation de ${partner} repose sur des éléments non publics, à « confiance modérée » : on la cite comme une source, avec sa réserve. Le rapport décrit le mode opératoire, signale la compatibilité, et laisse l'attribution aux éléments que l'enquête pourra verser au dossier (infrastructure, renseignement, coopération internationale).`,
        },
      ],
      truth: {
        path: [
          gasTx.id, opGas1.id, opRelay1.id, opGas2.id, opRelay2.id, ...drains.map((x) => x.id), ...allSwaps.map((x) => x.tx.id), bounty.id, ...dispTxs.map((x) => x.id),
          ...routes.flatMap((x) => [x.hop.id, x.out.id, x.arr.id]), consTx.id, splitTx.id, ...cjs.map((x) => x.id), pmA.id, pmB.id, swA.id, swB.id,
        ],
        addresses: [H0, OP, OP2, ...L1, ...routes.map((x) => x.l2), ...arrivals, C, toxic, ...premix, ...mixed, dA, dB],
        debrief:
          `1. Préparation : l'adresse ${A(w, H0)} reçoit son gas depuis Tornado Cash (${fmtDate(gasTx.time, false)}) et de deux portefeuilles « opérateurs » réutilisés (${A(w, OP).slice(0, 12)}…, ${A(w, OP2).slice(0, 12)}…, à l'historique et aux dépenses propres). Le point d'entrée probable est un faux recrutement visant un développeur, puis la manipulation de l'interface de signature.\n` +
          `2. Vol : cinq transactions vident le hot wallet de ${VX.name} : ${amt(stolen.ETH, 'ETH')}, ${amt(stolen.USDT, 'USDT')}, ${amt(stolen.USDC, 'USDC')}, ${amt(stolen.DAI, 'DAI')} et ${amt(stolen.WBTC, 'WBTC')}, soit ${usdFmt(stolenUsd)} (${musd(stolenUsd)}).\n` +
          `3. Conversions sur Uniswap : l'USDT d'abord (${amt(usdtSwapped, 'USDT')} en ${usdtSwaps.length} tranches), jusqu'au gel de Tether qui bloque ${amt(frozen, 'USDT')} ; puis l'USDC, et seulement ensuite le DAI et le WBTC. Total obtenu : ${amt(roundAsset('ETH', ethFromSwaps), 'ETH')}.\n` +
          `4. Dispersion : ${N1} adresses de premier niveau reçoivent ~${amt(r2(perAvg), 'ETH')} chacune, puis transfèrent la quasi-totalité de leur solde vers une deuxième couche d'adresses neuves.\n` +
          `5. Passage sur Bitcoin : ${nArc} routes par ArcBridge (événements à nonce) et 2 par eXch (sans lien on-chain). Toutes les arrivées sont regroupées par ${consTx.hash.slice(0, 14)}… sur ${A(w, C)} (${amt(B, 'BTC')}).\n` +
          `6. Mixage : découpage en ${m} UTXO de ${btc8(D)} + marge, rendu de ${amt(toxicValue, 'BTC')} sur ${A(w, toxic)}, ${nCj > 1 ? `${nCj} tours` : 'un tour'} de CoinJoin (zkSNACKs).\n` +
          `7. Sortie : le rendu est dépensé avec ${half} sorties mixées vers une adresse de dépôt de SatsDesk OTC (${A(w, dA)}), les ${batchB.length} autres suivent vers une seconde adresse de dépôt du même courtier (${A(w, dB)}) : ${amt(toOtc, 'BTC')} au total.\n\n` +
          `À retenir : face à un acteur organisé, la vitesse compte (gel des émetteurs dans l'heure, alertes aux plateformes), et la piste se reconstruit aux points de convergence : consolidation après un bridge, erreurs post-mix, courtier de sortie. Le courtier OTC (Hong Kong, coopération par entraide) est le maillon où l'argent redevient « propre » : c'est là que se jouent le renseignement et la coopération internationale. Enfin, l'attribution à un État ne se déduit pas d'un graphe : on écrit « compatible avec », on cite ses sources et leur niveau de confiance.`,
      },
      hints: [
        'Partez de l\'adresse principale du communiqué : ses entrées racontent le vol, ses sorties les swaps puis la dispersion.',
        'Pour le passage sur Bitcoin, ouvrez l\'événement du bridge sur la transaction de départ : chaîne cible, destinataire et nonce désignent la transaction d\'arrivée.',
        'Sur Bitcoin, cherchez où convergent les arrivées, puis le rendu du découpage avant mixage : c\'est lui qui trahit la sortie du CoinJoin.',
        'Toutes les sorties mixées ne sont pas dépensées avec le rendu : cherchez une seconde dépense de sorties des mêmes tours, vers le même service, dans les heures qui suivent.',
      ],
    }
  },
}
