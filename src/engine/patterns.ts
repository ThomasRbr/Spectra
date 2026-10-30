// Briques réutilisables pour composer des affaires : exchanges, échangeurs
// instantanés, mixeurs, CoinJoin, DEX, bridges, pools de confidentialité,
// peel chains et bruit de fond.
import { CHAINS, EUR_USD, type AssetId, type ChainId, fromUsd, isEvm, roundAsset, usd } from './chains'
import type { Entity } from './entities'
import type { Tx, World } from './world'
import type { AddrKind } from './addressgen'

const H = 3600

function nativeOf(chain: ChainId): AssetId {
  return CHAINS[chain].native
}

function isUtxo(chain: ChainId): boolean {
  return CHAINS[chain].model === 'utxo'
}

/** Montant « humain » arrondi en USD puis converti (pour paraître naturel). */
export function roundUsdAmount(w: World, asset: AssetId, minUsd: number, maxUsd: number): number {
  const step = maxUsd > 20000 ? 1000 : maxUsd > 2000 ? 100 : 10
  const v = Math.round(w.rng.float(minUsd, maxUsd) / step) * step
  return roundAsset(asset, fromUsd(asset, v))
}

/** Montant BTC « rond » (0.05, 0.25, 1.2…). */
export function roundCoin(w: World, min: number, max: number, step = 0.01): number {
  return Math.round(w.rng.float(min, max) / step) * step
}

// ── Particuliers ───────────────────────────────────────────────────────────

/** Adresse d'un particulier non identifié, éventuellement avec un historique. */
export function person(w: World, chain: ChainId, opts: { entity?: string | Entity; history?: number; time?: number; label?: string; kind?: AddrKind } = {}): string {
  const a = w.addr(chain, { entity: opts.entity, label: opts.label, kind: opts.kind })
  const n = opts.history ?? 0
  const t = opts.time ?? w.t0
  for (let i = 0; i < n; i++) {
    const when = t - w.rng.int(2, 400) * 86400
    if (isUtxo(chain)) w.fund(a, roundCoin(w, 0.002, 0.08, 0.0001), when)
    else w.fundAccount(a, fromUsd(nativeOf(chain), w.rng.float(30, 900)), nativeOf(chain), when)
  }
  return a
}

// ── Exchange centralisé ─────────────────────────────────────────────────────

export interface ExchangeKit {
  entity: Entity
  chain: ChainId
  hot: string
  /** Nouvelle adresse de dépôt client (unique par client sur BTC/ETH/Tron…). */
  newDeposit(): string
  /** Envoie des fonds vers une nouvelle adresse de dépôt puis balaie vers le hot wallet. */
  receive(from: string, value: number, time: number, opts?: { asset?: AssetId; memo?: string; change?: string | null; depositAddr?: string; sweepDelayH?: number }): { tx: Tx; deposit: string; sweep?: Tx }
  /** Balayage (sweep) des dépôts vers le hot wallet, mélangé avec d'autres clients. */
  sweep(deposits: string[], time: number, asset?: AssetId): Tx[]
  withdraw(to: string, value: number, time: number, asset?: AssetId, memo?: string): Tx
  /** Activité de fond : retraits et dépôts sans lien avec l'affaire. */
  noise(n: number, from: number, to: number, asset?: AssetId): void
  /** Dépôts sur une adresse partagée, client identifié par le tag / commentaire (XRP, TON). */
  shared: boolean
  /** Nouvel identifiant client (destination tag XRP, commentaire TON) pour un dépôt sur adresse partagée. */
  newMemo(): string
}

/**
 * Exchange centralisé sur une chaîne. Sur XRP et TON, les dépôts arrivent par
 * défaut sur l'adresse partagée du hot wallet, le client étant identifié par
 * le destination tag (XRP) ou le commentaire (TON) : passez `memo` à `receive`.
 * `opts.sharedDeposit` force l'un ou l'autre modèle sur TON.
 */
export function exchange(w: World, key: string, chain: ChainId, opts: { sharedDeposit?: boolean } = {}): ExchangeKit {
  const entity = w.entity(key)
  const hot = w.addr(chain, { entity, label: `${entity.name} — Hot Wallet`, tags: ['liquid', 'hot'], kind: chain === 'btc' ? 'p2wpkh' : undefined })
  const native = nativeOf(chain)
  // XRP (toujours) et TON (par défaut) : adresse partagée + destination tag / commentaire
  const shared = chain === 'xrp' || (chain === 'ton' && opts.sharedDeposit !== false)

  const kit: ExchangeKit = {
    entity,
    chain,
    hot,
    shared,
    newMemo() {
      return String(w.rng.int(100000, 99999999))
    },
    newDeposit() {
      if (shared) return hot
      return w.addr(chain, { entity, label: `${entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    },
    receive(from, value, time, opts = {}) {
      const asset = opts.asset ?? native
      const deposit = opts.depositAddr ?? kit.newDeposit()
      let tx: Tx
      if (isUtxo(chain)) tx = w.utxoTx({ time, from: [from], to: [{ address: deposit, value }], change: opts.change })
      else tx = w.transfer({ time, from, to: deposit, value, asset, memo: opts.memo })
      let sweep: Tx | undefined
      if (!shared) {
        const t = time + (opts.sweepDelayH ?? w.rng.float(0.3, 8)) * H
        sweep = kit.sweep([deposit], t, asset)[0]
      }
      return { tx, deposit, sweep }
    },
    sweep(deposits, time, asset = native) {
      if (isUtxo(chain)) {
        const others = Array.from({ length: w.rng.int(2, 6) }, () => {
          const d = kit.newDeposit()
          w.fund(d, roundCoin(w, 0.001, 0.4, 0.0001), time - w.rng.int(600, 20 * H))
          return d
        })
        const all = w.rng.shuffle([...deposits, ...others])
        const total = all.reduce((s, d) => s + w.unspentValue(d, time), 0)
        const fee = w.estimateFee(chain, all.length, 1)
        return [w.utxoTx({ time, from: all, to: [{ address: hot, value: total - fee }], fee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })]
      }
      return deposits.map((d) => {
        const v = w.balanceOf(d, asset)
        return w.transfer({ time: time + w.rng.int(0, 900), from: d, to: hot, value: v, asset, method: 'sweep', tags: ['sweep'] })
      })
    },
    withdraw(to, value, time, asset = native, memo) {
      if (isUtxo(chain)) return w.utxoTx({ time, from: [hot], to: [{ address: to, value }], change: hot, tags: ['withdrawal'] })
      return w.transfer({ time, from: hot, to, value, asset, memo, method: 'withdraw' })
    },
    noise(n, from, to, asset = native) {
      for (let i = 0; i < n; i++) {
        const t = Math.round(w.rng.float(from, to))
        const a = w.addr(chain)
        const v = asset === native ? fromUsd(native, w.rng.float(50, 25000)) : roundAsset(asset, w.rng.float(50, 25000))
        if (w.rng.chance(0.55)) kit.withdraw(a, roundAsset(asset, v), t, asset, shared ? String(w.rng.int(100000, 99999999)) : undefined)
        else if (shared) w.transfer({ time: t, from: a, to: hot, value: roundAsset(asset, v), asset, memo: String(w.rng.int(100000, 99999999)) })
        else kit.receive(a, roundAsset(asset, v), t, { asset })
      }
    },
  }
  return kit
}

// ── Échangeur instantané (swap inter-chaînes sans compte) ──────────────────

export interface SwapperKit {
  entity: Entity
  hot(chain: ChainId): string
  /** Commande : dépôt sur `from` puis paiement sur `toChain` vers `recipient`. */
  order(o: { from: string; value: number; asset?: AssetId; time: number; toChain: ChainId; toAsset?: AssetId; recipient: string; delayMin?: [number, number]; feePct?: number; decoys?: number; change?: string | null }): { deposit: string; depositTx: Tx; payoutTx: Tx; payoutValue: number }
}

export function swapper(w: World, key: string): SwapperKit {
  const entity = w.entity(key)
  const hots = new Map<ChainId, string>()
  const hot = (chain: ChainId) => {
    let h = hots.get(chain)
    if (!h) {
      h = w.addr(chain, { entity, label: `${entity.name} — Hot Wallet ${CHAINS[chain].short}`, tags: ['liquid', 'hot'] })
      hots.set(chain, h)
    }
    return h
  }
  const pay = (chain: ChainId, to: string, value: number, asset: AssetId, time: number) =>
    isUtxo(chain) ? w.utxoTx({ time, from: [hot(chain)], to: [{ address: to, value }], change: hot(chain), tags: ['payout'] }) : w.transfer({ time, from: hot(chain), to, value, asset, method: 'payout' })

  return {
    entity,
    hot,
    order(o) {
      const fromChain = w.get(o.from).chain
      const asset = o.asset ?? nativeOf(fromChain)
      const toAsset = o.toAsset ?? nativeOf(o.toChain)
      const deposit = w.addr(fromChain, { entity, label: `${entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      const depositTx = isUtxo(fromChain)
        ? w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }], change: o.change })
        : w.transfer({ time: o.time, from: o.from, to: deposit, value: o.value, asset })
      // Rapatriement du dépôt vers le hot wallet de l'échangeur
      const fwdT = o.time + w.rng.int(120, 1200)
      if (isUtxo(fromChain)) {
        const fee = w.estimateFee(fromChain, 1, 1)
        w.utxoTx({ time: fwdT, from: [deposit], to: [{ address: hot(fromChain), value: w.unspentValue(deposit, fwdT) - fee }], fee, change: null, spendAll: true, tags: ['sweep'] })
      }
      else w.transfer({ time: fwdT, from: deposit, to: hot(fromChain), value: o.value, asset, method: 'sweep' })

      const feePct = o.feePct ?? w.rng.float(0.006, 0.02)
      const [dmin, dmax] = o.delayMin ?? [6, 45]
      const payT = o.time + w.rng.int(dmin, dmax) * 60
      const payoutValue = roundAsset(toAsset, fromUsd(toAsset, usd(asset, o.value) * (1 - feePct)))
      const payoutTx = pay(o.toChain, o.recipient, payoutValue, toAsset, payT)
      // Leurres : d'autres clients payés dans la même fenêtre, parfois de montant proche.
      const nd = o.decoys ?? w.rng.int(4, 9)
      for (let i = 0; i < nd; i++) {
        const close = w.rng.chance(0.35)
        const v = close ? payoutValue * w.rng.float(0.88, 1.12) : fromUsd(toAsset, w.rng.float(40, usd(toAsset, payoutValue) * 3 + 200))
        pay(o.toChain, w.addr(o.toChain), roundAsset(toAsset, v), toAsset, payT + w.rng.int(-2 * H, 3 * H))
      }
      return { deposit, depositTx, payoutTx, payoutValue }
    },
  }
}

// ── Mixeur centralisé ───────────────────────────────────────────────────────

export interface MixerKit {
  entity: Entity
  pool: string[]
  mix(o: { from: string; value: number; time: number; recipients: string[]; delayH?: [number, number]; feePct?: number; decoys?: number; change?: string | null }): { deposit: string; depositTx: Tx; payouts: Tx[] }
}

export function mixer(w: World, key: string, chain: ChainId): MixerKit {
  const entity = w.entity(key)
  const pool = Array.from({ length: 4 }, (_, i) => w.addr(chain, { entity, label: `${entity.name} — Réserve ${i + 1}`, tags: ['liquid'] }))
  return {
    entity,
    pool,
    mix(o) {
      const deposit = w.addr(chain, { entity, label: `${entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      const depositTx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }], change: o.change })
      const sweepT = o.time + w.rng.int(600, 4 * H)
      const sweepFee = w.estimateFee(chain, 1, 1)
      w.utxoTx({ time: sweepT, from: [deposit], to: [{ address: w.rng.pick(pool), value: w.unspentValue(deposit, sweepT) - sweepFee }], fee: sweepFee, change: null, spendAll: true, tags: ['sweep'] })
      const fee = o.feePct ?? w.rng.float(0.01, 0.03)
      const net = o.value * (1 - fee)
      const parts = w.rng.split(net, o.recipients.length, 0.9)
      const [d0, d1] = o.delayH ?? [2, 36]
      const payouts = o.recipients.map((r, i) =>
        w.utxoTx({ time: o.time + w.rng.float(d0, d1) * H, from: [w.rng.pick(pool)], to: [{ address: r, value: roundAsset(nativeOf(chain), parts[i]) }], tags: ['mixer-payout'] }),
      )
      const nd = o.decoys ?? w.rng.int(8, 16)
      for (let i = 0; i < nd; i++) {
        const v = w.rng.chance(0.4) ? (net / o.recipients.length) * w.rng.float(0.7, 1.3) : w.rng.float(0.005, net)
        w.utxoTx({ time: o.time + w.rng.float(d0 - 2, d1 + 6) * H, from: [w.rng.pick(pool)], to: [{ address: w.addr(chain), value: roundAsset(nativeOf(chain), v) }], tags: ['mixer-payout'] })
      }
      return { deposit, depositTx, payouts }
    },
  }
}

// ── CoinJoin (sorties de montant égal) ──────────────────────────────────────

export interface CoinjoinResult {
  tx: Tx
  /** sortie mixée de chaque participant demandé (même ordre que `participants`) */
  mixed: string[]
  change: (string | undefined)[]
}

/**
 * CoinJoin type Whirlpool/Wasabi : chaque participant apporte une UTXO,
 * reçoit `denom` sur une adresse neuve et éventuellement un rendu (change toxique).
 */
export function coinjoin(w: World, o: { chain: ChainId; time: number; denom: number; participants: { from: string; value?: number; mixedTo?: string; changeTo?: string | null }[]; extra?: number; coordinatorFee?: number }): CoinjoinResult {
  const coord = w.entity('wasabi')
  const feeAddr = w.addr(o.chain, { entity: coord, label: `${coord.name} — Frais de coordination`, tags: ['liquid'] })
  const spend: { address: string; value?: number }[] = []
  const outputs: { address: string; value: number }[] = []
  const mixed: string[] = []
  const change: (string | undefined)[] = []
  const mf = 0.00004
  const all = [...o.participants]
  const nAll = all.length + (o.extra ?? 4)
  const coordFee = o.coordinatorFee ?? o.denom * 0.003 * nAll
  const share = coordFee / nAll
  for (let i = 0; i < (o.extra ?? 4); i++) {
    const a = w.addr(o.chain, { kind: 'p2wpkh' })
    w.fund(a, o.denom + w.rng.float(0.0001, o.denom * 0.6), o.time - w.rng.int(H, 72 * H))
    all.push({ from: a })
  }
  all.forEach((p, idx) => {
    const v = p.value ?? w.unspentValue(p.from, o.time)
    spend.push({ address: p.from, value: p.value })
    const m = p.mixedTo ?? w.addr(o.chain, { kind: 'p2wpkh', entity: w.get(p.from).entityId, wallet: w.get(p.from).wallet })
    outputs.push({ address: m, value: o.denom })
    const rest = v - o.denom - mf - share
    let ch: string | undefined
    if (rest > 0.00001 && p.changeTo !== null) {
      ch = p.changeTo ?? w.addr(o.chain, { kind: w.get(p.from).kind, entity: w.get(p.from).entityId, wallet: w.get(p.from).wallet })
      outputs.push({ address: ch, value: rest })
    }
    if (idx < o.participants.length) {
      mixed.push(m)
      change.push(ch)
    }
  })
  if (coordFee > 0) outputs.push({ address: feeAddr, value: coordFee })
  const tx = w.rawUtxoTx({ time: o.time, spend, outputs, tags: ['coinjoin'], method: 'CoinJoin' })
  return { tx, mixed, change }
}

// ── DEX (AMM) ───────────────────────────────────────────────────────────────

export interface DexKit {
  entity: Entity
  router: string
  pool(a: AssetId, b: AssetId): string
  swap(o: { trader: string; assetIn: AssetId; amountIn: number; assetOut: AssetId; time: number; recipient?: string }): { tx: Tx; amountOut: number }
  noise(n: number, from: number, to: number, pairs?: [AssetId, AssetId][]): void
}

export function dex(w: World, key: string, chain: ChainId): DexKit {
  const entity = w.entity(key)
  const router = w.addr(chain, { entity, label: `${entity.name}: Router`, contract: { name: `${entity.name} Router`, type: 'router' } })
  const pools = new Map<string, string>()
  const pool = (a: AssetId, b: AssetId) => {
    const k = [a, b].sort().join('/')
    let p = pools.get(k)
    if (!p) {
      p = w.addr(chain, { entity, label: `${entity.name}: Pool ${k}`, contract: { name: `${entity.name} ${k} Pool`, type: 'pool' } })
      pools.set(k, p)
    }
    return p
  }
  const kit: DexKit = {
    entity,
    router,
    pool,
    swap(o) {
      const p = pool(o.assetIn, o.assetOut)
      const amountOut = roundAsset(o.assetOut, fromUsd(o.assetOut, usd(o.assetIn, o.amountIn) * (1 - 0.003) * w.rng.float(0.992, 0.999)))
      const native = nativeOf(chain)
      const method = o.assetIn === native ? 'swapExactETHForTokens' : o.assetOut === native ? 'swapExactTokensForETH' : 'swapExactTokensForTokens'
      const legs = o.assetIn === native
        ? [{ from: o.trader, to: router, value: o.amountIn, asset: o.assetIn }, { from: router, to: p, value: o.amountIn, asset: o.assetIn }, { from: p, to: o.recipient ?? o.trader, value: amountOut, asset: o.assetOut }]
        : o.assetOut === native
          ? [{ from: o.trader, to: p, value: o.amountIn, asset: o.assetIn }, { from: p, to: router, value: amountOut, asset: o.assetOut }, { from: router, to: o.recipient ?? o.trader, value: amountOut, asset: o.assetOut }]
          : [{ from: o.trader, to: p, value: o.amountIn, asset: o.assetIn }, { from: p, to: o.recipient ?? o.trader, value: amountOut, asset: o.assetOut }]
      const tx = w.multi({ time: o.time, signer: o.trader, legs, method, tags: ['swap'] })
      return { tx, amountOut }
    },
    noise(n, from, to, pairs) {
      const native = nativeOf(chain)
      const ps = pairs ?? [[native, 'USDT'], [native, 'USDC']]
      for (let i = 0; i < n; i++) {
        const [a, b] = w.rng.pick(ps)
        const dir = w.rng.chance(0.5)
        const assetIn = dir ? a : b
        const trader = w.addr(chain)
        const amountIn = roundAsset(assetIn, fromUsd(assetIn, w.rng.float(100, 40000)))
        kit.swap({ trader, assetIn, amountIn, assetOut: dir ? b : a, time: Math.round(w.rng.float(from, to)) })
      }
    },
  }
  return kit
}

// ── Bridge inter-chaînes ────────────────────────────────────────────────────

export interface BridgeKit {
  entity: Entity
  contract(chain: ChainId): string
  send(o: { from: string; value: number; asset?: AssetId; time: number; toChain: ChainId; toAsset?: AssetId; recipient: string; delayMin?: [number, number] }): { outTx: Tx; inTx: Tx; received: number }
}

export function bridge(w: World, key: string): BridgeKit {
  const entity = w.entity(key)
  const contracts = new Map<ChainId, string>()
  let nonce = w.rng.int(10000, 90000)
  const contract = (chain: ChainId) => {
    let c = contracts.get(chain)
    if (!c) {
      c = w.addr(chain, { entity, label: `${entity.name}: ${CHAINS[chain].name}`, contract: { name: `${entity.name} ${CHAINS[chain].short} Gateway`, type: 'bridge' } })
      contracts.set(chain, c)
    }
    return c
  }
  return {
    entity,
    contract,
    send(o) {
      const fromChain = w.get(o.from).chain
      const asset = o.asset ?? nativeOf(fromChain)
      const toAsset = o.toAsset ?? (CHAINS[o.toChain].tokens.includes(asset) || nativeOf(o.toChain) === asset ? asset : nativeOf(o.toChain))
      const n = ++nonce
      const outTx = w.transfer({ time: o.time, from: o.from, to: contract(fromChain), value: o.value, asset, method: 'bridgeOut', tags: ['bridge'] })
      const [d0, d1] = o.delayMin ?? [2, 25]
      const received = roundAsset(toAsset, fromUsd(toAsset, usd(asset, o.value) * (1 - w.rng.float(0.0005, 0.004))))
      const inTx = w.transfer({ time: o.time + w.rng.int(d0, d1) * 60, from: contract(o.toChain), to: o.recipient, value: received, asset: toAsset, method: 'bridgeIn', tags: ['bridge'] })
      outTx.bridge = { direction: 'out', otherChain: o.toChain, otherTx: inTx.id, nonce: n, recipient: o.recipient }
      inTx.bridge = { direction: 'in', otherChain: fromChain, otherTx: outTx.id, nonce: n, recipient: o.recipient }
      return { outTx, inTx, received }
    },
  }
}

// ── Pool de confidentialité (dénominations fixes) ───────────────────────────

export interface PrivacyPoolKit {
  entity: Entity
  pool(denom: number): string
  relayer: string
  deposit(from: string, denom: number, time: number): Tx
  withdraw(to: string, denom: number, time: number, viaRelayer?: boolean): Tx
  noise(denom: number, n: number, from: number, to: number): void
}

export function privacyPool(w: World, key: string, chain: ChainId): PrivacyPoolKit {
  const entity = w.entity(key)
  const native = nativeOf(chain)
  const pools = new Map<number, string>()
  const relayer = w.addr(chain, { label: 'Relayer (non attribué)' })
  const pool = (d: number) => {
    let p = pools.get(d)
    if (!p) {
      p = w.addr(chain, { entity, label: `${entity.name}: ${d} ${native}`, contract: { name: `${entity.name} ${d} ${native}`, type: 'mixer' } })
      pools.set(d, p)
    }
    return p
  }
  const kit: PrivacyPoolKit = {
    entity,
    pool,
    relayer,
    deposit(from, denom, time) {
      return w.transfer({ time, from, to: pool(denom), value: denom, asset: native, method: 'deposit', tags: ['privacy-deposit'] })
    },
    withdraw(to, denom, time, viaRelayer = true) {
      const relFee = viaRelayer ? +(denom * w.rng.float(0.002, 0.005)).toFixed(5) : 0
      const legs = [{ from: pool(denom), to, value: denom - relFee, asset: native }]
      if (relFee) legs.push({ from: pool(denom), to: relayer, value: relFee, asset: native })
      return w.multi({ time, signer: viaRelayer ? relayer : to, legs, method: 'withdraw', tags: ['privacy-withdraw'] })
    },
    noise(denom, n, from, to) {
      for (let i = 0; i < n; i++) {
        const t = Math.round(w.rng.float(from, to))
        if (w.rng.chance(0.5)) kit.deposit(w.addr(chain), denom, t)
        else kit.withdraw(w.addr(chain), denom, t, w.rng.chance(0.8))
      }
    },
  }
  return kit
}

// ── Peel chain ──────────────────────────────────────────────────────────────

export interface PeelStep {
  tx: Tx
  hop: string
  next: string
  peelTo: string
  peelValue: number
}

/**
 * Peel chain : à chaque saut, une petite sortie part vers `peelTarget(i)`
 * et le reste file vers une nouvelle adresse du même type.
 */
export function peelChain(w: World, o: { start: string; steps: number; time: number; stepH?: [number, number]; peelFraction?: [number, number]; peelTarget: (i: number, value: number, t: number) => string; nextKind?: 'same' | 'mixed' }): PeelStep[] {
  const steps: PeelStep[] = []
  let cur = o.start
  let t = o.time
  const [f0, f1] = o.peelFraction ?? [0.03, 0.12]
  for (let i = 0; i < o.steps; i++) {
    const src = w.get(cur)
    const bal = w.unspentValue(cur)
    if (bal <= 0.0002) break
    const peelValue = roundAsset(nativeOf(src.chain), bal * w.rng.float(f0, f1))
    const peelTo = o.peelTarget(i, peelValue, t)
    const next = w.addr(src.chain, { entity: src.entityId, kind: o.nextKind === 'mixed' ? undefined : src.kind, wallet: src.wallet })
    const tx = w.utxoTx({ time: t, from: [cur], to: [{ address: peelTo, value: peelValue }], change: next, spendAll: true, tags: ['peel'] })
    steps.push({ tx, hop: cur, next, peelTo, peelValue })
    cur = next
    const [s0, s1] = o.stepH ?? [0.5, 10]
    t += Math.round(w.rng.float(s0, s1) * H)
  }
  return steps
}

// ── Bruit générique ─────────────────────────────────────────────────────────

/** Ajoute des paiements entrants anodins vers une adresse (ex. victime avant les faits). */
export function backgroundIn(w: World, addr: string, n: number, from: number, to: number, maxUsd = 2000): void {
  const a = w.get(addr)
  for (let i = 0; i < n; i++) {
    const t = Math.round(w.rng.float(from, to))
    if (isUtxo(a.chain)) w.fund(addr, roundAsset(nativeOf(a.chain), fromUsd(nativeOf(a.chain), w.rng.float(20, maxUsd))), t)
    else w.fundAccount(addr, roundAsset(nativeOf(a.chain), fromUsd(nativeOf(a.chain), w.rng.float(20, maxUsd))), nativeOf(a.chain), t)
  }
}

export const HOUR = H
export const DAY = 24 * H

// ── Lightning Network ───────────────────────────────────────────────────────
//
// Sur la blockchain, on ne voit que l'ouverture (financement d'une sortie
// P2WSH 2-de-2) et la fermeture d'un canal. Les paiements faits dans le canal
// restent hors chaîne.

const LN_ANCHOR = 0.0000033 // 330 sats
const lspNodes = new WeakMap<World, Map<string, string>>()

/** Adresse on-chain du nœud d'un LSP (une par entité et par monde). */
export function lspNode(w: World, peer: string | Entity, chain: ChainId = 'btc'): string {
  const e = typeof peer === 'string' ? (w.entities.get(peer) ?? w.entity(peer)) : peer
  let m = lspNodes.get(w)
  if (!m) lspNodes.set(w, (m = new Map()))
  const k = `${e.id}|${chain}`
  let a = m.get(k)
  if (!a) {
    a = w.addr(chain, { entity: e, label: `${e.name} — Nœud Lightning`, kind: 'p2wpkh', tags: ['liquid', 'hot'] })
    m.set(k, a)
  }
  return a
}

export interface LnForceClose {
  /** Transaction d'engagement (commitment) diffusée unilatéralement. */
  commitTx: Tx
  /** Sortie retardée (to_local, P2WSH à délai CSV) du diffuseur. */
  delayed: string
  /** Récupération de la sortie retardée après le délai (si demandée). */
  sweepTx?: Tx
  /** Adresse où le diffuseur récupère ses fonds. */
  sweptTo?: string
  /** Adresse qui reçoit immédiatement le solde de l'autre partie. */
  remoteTo: string
}

export interface LnChannel {
  chain: ChainId
  /** Transaction de financement (ouverture). */
  tx: Tx
  /** Adresse P2WSH 2-de-2 du canal. */
  funding: string
  capacity: number
  /** Adresse qui a financé le canal (portefeuille de l'utilisateur). */
  from: string
  peer: Entity
  /** Adresse on-chain du nœud du pair (LSP). */
  peerNode: string
  open: boolean
  closeTx?: Tx
  cooperativeClose(o: { time: number; toLocal: number; toRemote?: number; localAddr?: string; remoteAddr?: string; fee?: number }): Tx
  forceClose(o: { time: number; toLocal: number; toRemote?: number; by?: 'local' | 'remote'; csvBlocks?: number; sweep?: boolean; sweepTo?: string; anchors?: boolean }): LnForceClose
}

/**
 * Ouverture de canal Lightning : `from` finance une sortie P2WSH 2-de-2
 * partagée avec le nœud du pair (un LSP du catalogue, ex. 'lumen_lsp').
 *
 * ```ts
 * const ch = openChannel(w, { from: wallet, peer: 'lumen_lsp', capacity: 0.02, time: t })
 * ch.cooperativeClose({ time: t + 30 * DAY, toLocal: 0.004 })   // le reste au LSP
 * ```
 */
export function openChannel(w: World, o: { from: string; peer: string | Entity; capacity: number; time: number; change?: string | null }): LnChannel {
  const src = w.get(o.from)
  const chain = src.chain
  if (chain !== 'btc' && chain !== 'ltc') throw new Error('openChannel : Bitcoin ou Litecoin uniquement')
  const peer = typeof o.peer === 'string' ? w.entity(o.peer) : o.peer
  const peerNode = lspNode(w, peer, chain)
  const funding = w.addr(chain, { kind: 'p2wsh', wallet: `ln:${o.from}`, tags: ['ln-channel'] })
  const tx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: funding, value: o.capacity }], change: o.change, tags: ['ln-open'] })
  const ch: LnChannel = {
    chain, tx, funding, capacity: o.capacity, from: o.from, peer, peerNode, open: true,
    cooperativeClose: (c) => cooperativeClose(w, ch, c),
    forceClose: (c) => forceClose(w, ch, c),
  }
  return ch
}

function channelOwnAddr(w: World, ch: LnChannel): string {
  const src = w.get(ch.from)
  return w.addr(ch.chain, { kind: 'p2wpkh', entity: src.entityId, wallet: src.wallet })
}

function peerAddr(w: World, ch: LnChannel): string {
  return w.addr(ch.chain, { kind: 'p2wpkh', entity: ch.peer, wallet: ch.peer.id })
}

/** Fermeture coopérative : une transaction qui dépense la sortie du canal vers les deux parties. */
export function cooperativeClose(w: World, ch: LnChannel, o: { time: number; toLocal: number; toRemote?: number; localAddr?: string; remoteAddr?: string; fee?: number }): Tx {
  if (!ch.open) throw new Error('Canal déjà fermé')
  if (o.time <= ch.tx.time) throw new Error('La fermeture doit suivre l\'ouverture')
  const fee = o.fee ?? w.estimateFee(ch.chain, 1, 2)
  const toLocal = Math.min(o.toLocal, ch.capacity - fee)
  const toRemote = o.toRemote ?? ch.capacity - toLocal - fee
  const outputs: { address: string; value: number }[] = []
  if (toLocal > 0.00000546) outputs.push({ address: o.localAddr ?? channelOwnAddr(w, ch), value: toLocal })
  if (toRemote > 0.00000546) outputs.push({ address: o.remoteAddr ?? peerAddr(w, ch), value: toRemote })
  const tx = w.rawUtxoTx({ time: o.time, spend: [{ address: ch.funding }], outputs, tags: ['ln-close'] })
  tx.fp = { version: 2, locktime: 0, rbf: false }
  ch.open = false
  ch.closeTx = tx
  return tx
}

/**
 * Fermeture forcée (unilatérale) : la transaction d'engagement verse le solde
 * du diffuseur sur une sortie retardée (délai CSV, 144 blocs par défaut) et
 * celui de l'autre partie immédiatement ; deux sorties « ancres » de 330 sats.
 * `sweep` (par défaut vrai) ajoute la récupération après le délai.
 */
export function forceClose(w: World, ch: LnChannel, o: { time: number; toLocal: number; toRemote?: number; by?: 'local' | 'remote'; csvBlocks?: number; sweep?: boolean; sweepTo?: string; anchors?: boolean }): LnForceClose {
  if (!ch.open) throw new Error('Canal déjà fermé')
  if (o.time <= ch.tx.time) throw new Error('La fermeture doit suivre l\'ouverture')
  const anchors = o.anchors !== false
  const fee = w.estimateFee(ch.chain, 1, anchors ? 4 : 2)
  const toLocal = Math.min(o.toLocal, ch.capacity - fee - (anchors ? 2 * LN_ANCHOR : 0))
  const toRemote = o.toRemote ?? ch.capacity - toLocal - fee - (anchors ? 2 * LN_ANCHOR : 0)
  const byLocal = (o.by ?? 'local') === 'local'
  const mine = byLocal ? toLocal : toRemote
  const theirs = byLocal ? toRemote : toLocal
  const delayed = w.addr(ch.chain, { kind: 'p2wsh', wallet: `ln:${ch.funding}:delayed`, tags: ['ln-delayed'] })
  const remoteTo = byLocal ? peerAddr(w, ch) : channelOwnAddr(w, ch)
  const outputs: { address: string; value: number }[] = []
  if (mine > 0.00000546) outputs.push({ address: delayed, value: mine })
  if (theirs > 0.00000546) outputs.push({ address: remoteTo, value: theirs })
  if (anchors) for (let i = 0; i < 2; i++) outputs.push({ address: w.addr(ch.chain, { kind: 'p2wsh', wallet: `ln:${ch.funding}:anchor${i}`, tags: ['ln-anchor'] }), value: LN_ANCHOR })
  const commitTx = w.rawUtxoTx({ time: o.time, spend: [{ address: ch.funding }], outputs, tags: ['ln-force-close'] })
  // nLockTime « 0x20…… » et nSequence « 0x80…… » : numéro d'engagement masqué (BOLT 3).
  commitTx.fp = { version: 2, locktime: 0x20000000 + w.rng.int(0, 0xffffff), rbf: true }
  ch.open = false
  ch.closeTx = commitTx
  const res: LnForceClose = { commitTx, delayed, remoteTo }
  if (o.sweep !== false && mine > 0.00001) {
    const csv = o.csvBlocks ?? 144
    const t = o.time + csv * CHAINS[ch.chain].blockTime + w.rng.int(600, 6 * H)
    const sweptTo = o.sweepTo ?? (byLocal ? channelOwnAddr(w, ch) : peerAddr(w, ch))
    const fee2 = w.estimateFee(ch.chain, 1, 1)
    res.sweepTx = w.rawUtxoTx({ time: t, spend: [{ address: delayed }], outputs: [{ address: sweptTo, value: mine - fee2 }], tags: ['ln-sweep'] })
    res.sweepTx.fp = { version: 2, locktime: 0, rbf: true }
    res.sweptTo = sweptTo
  }
  return res
}

export interface LnRecord {
  time: number
  /** Compte client chez le service (identifiant interne). */
  account: string
  direction: 'send' | 'receive'
  sats: number
  /** Facture BOLT 11 (fictive). */
  invoice: string
  paymentHash: string
  counterparty?: string
  description?: string
}

/** Facture Lightning BOLT 11 fictive (forme seulement). */
export function fakeInvoice(w: World, sats: number, chain: ChainId = 'btc'): string {
  const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const amount = sats % 100 === 0 ? `${sats / 100}u` : `${sats * 10}n`
  let s = `ln${chain === 'ltc' ? 'ltc' : 'bc'}${amount}1p`
  for (let i = 0; i < 180; i++) s += BECH[w.rng.int(0, BECH.length - 1)]
  return s
}

export interface LnCustodialKit {
  entity: Entity
  /** Portefeuille chaud on-chain du service (reçoit les balayages, paie les retraits). */
  hot: string
  exchange: ExchangeKit
  /** Registre interne du service : paiements Lightning, invisibles on-chain (à obtenir par réquisition). */
  records: LnRecord[]
  /** Dépôt on-chain sur une adresse fournie par le service, balayée ensuite vers le hot wallet. */
  deposit(from: string, value: number, time: number, opts?: { change?: string | null; sweepDelayH?: number }): { tx: Tx; deposit: string; sweep?: Tx }
  /** Retrait on-chain payé par le service (tag « ln-custodial-payout »). */
  withdraw(to: string, value: number, time: number): Tx
  /** Paiement Lightning interne : aucune transaction, une ligne dans le registre du service. */
  pay(o: { time: number; account: string; sats: number; direction: 'send' | 'receive'; counterparty?: string; description?: string }): LnRecord
  noise(n: number, from: number, to: number): void
}

/**
 * Portefeuille Lightning custodial (ex. 'voltpocket') : seuls les dépôts et
 * retraits on-chain sont visibles ; les paiements Lightning ne laissent qu'une
 * trace dans le registre du service (`records`).
 */
export function lnCustodial(w: World, key = 'voltpocket', chain: ChainId = 'btc'): LnCustodialKit {
  const ex = exchange(w, key, chain)
  const kit: LnCustodialKit = {
    entity: ex.entity,
    hot: ex.hot,
    exchange: ex,
    records: [],
    deposit(from, value, time, opts = {}) {
      return ex.receive(from, value, time, { change: opts.change, sweepDelayH: opts.sweepDelayH })
    },
    withdraw(to, value, time) {
      const tx = w.utxoTx({ time, from: [ex.hot], to: [{ address: to, value }], change: ex.hot, tags: ['ln-custodial-payout'] })
      return tx
    },
    pay(o) {
      let ph = ''
      for (let i = 0; i < 64; i++) ph += '0123456789abcdef'[w.rng.int(0, 15)]
      const rec: LnRecord = { ...o, invoice: fakeInvoice(w, o.sats, chain), paymentHash: ph }
      kit.records.push(rec)
      kit.records.sort((a, b) => a.time - b.time)
      return rec
    },
    noise(n, from, to) {
      ex.noise(n, from, to)
    },
  }
  return kit
}

// ── Bridges canoniques des rollups (Arbitrum One, Base) ─────────────────────

export interface L2BridgeKit {
  entity: Entity
  l2: 'arb' | 'base'
  /** Contrat du bridge côté Ethereum (L1). */
  l1Gateway: string
  /** Contrat du bridge côté rollup (L2). */
  l2Gateway: string
  /** Dépôt L1 → L2 : crédité en quelques minutes ; destinataire par défaut = même adresse 0x sur le L2. */
  deposit(o: { from: string; value: number; asset?: AssetId; time: number; recipient?: string; delayMin?: [number, number] }): { l1Tx: Tx; l2Tx: Tx; recipient: string }
  /** Retrait L2 → L1 : initié sur le L2, finalisé sur Ethereum après la période de contestation (~7 jours). */
  withdraw(o: { from: string; value: number; asset?: AssetId; time: number; recipient?: string; challengeDays?: number; claimDelayH?: [number, number] }): { initTx: Tx; finalizeTx: Tx; recipient: string }
}

const l2Kits = new WeakMap<World, Map<string, L2BridgeKit>>()

/**
 * Bridge canonique officiel d'un rollup optimiste (entités 'arbitrum_bridge',
 * 'base_bridge'). Les deux transactions sont liées par `tx.bridge` (nonce),
 * comme pour `bridge()` : le traçage et le graphe suivent le passage.
 *
 * ```ts
 * const ab = l2Bridge(w, 'arb')
 * const { l2Tx, recipient } = ab.deposit({ from: ethAddr, value: 2, time: t })
 * const { finalizeTx } = ab.withdraw({ from: recipient, value: 1.5, time: t + 3 * DAY })
 * ```
 */
export function l2Bridge(w: World, l2: 'arb' | 'base'): L2BridgeKit {
  let m = l2Kits.get(w)
  if (!m) l2Kits.set(w, (m = new Map()))
  const cached = m.get(l2)
  if (cached) return cached
  const isArb = l2 === 'arb'
  const entity = w.entity(isArb ? 'arbitrum_bridge' : 'base_bridge')
  const l1Gateway = w.addr('eth', { entity, label: isArb ? 'Arbitrum Bridge : contrat L1 (Ethereum)' : 'Base Bridge : OptimismPortal (Ethereum)', contract: { name: isArb ? 'Arbitrum One Bridge (L1)' : 'Base OptimismPortal (L1)', type: 'bridge' } })
  const l2Gateway = w.addr(l2, { entity, label: isArb ? 'Arbitrum Bridge : passerelle L2' : 'Base Bridge : L2StandardBridge', contract: { name: isArb ? 'Arbitrum One Gateway (L2)' : 'Base L2StandardBridge', type: 'bridge' } })
  let nonce = w.rng.int(100000, 900000)
  const kit: L2BridgeKit = {
    entity,
    l2,
    l1Gateway,
    l2Gateway,
    deposit(o) {
      if (w.get(o.from).chain !== 'eth') throw new Error('l2Bridge.deposit : l\'émetteur doit être une adresse Ethereum (L1)')
      const asset = o.asset ?? 'ETH'
      const recipient = o.recipient ?? w.addrSameEoa(o.from, l2)
      const n = ++nonce
      const l1Tx = w.transfer({ time: o.time, from: o.from, to: l1Gateway, value: o.value, asset, method: asset === 'ETH' ? (isArb ? 'depositEth' : 'depositTransaction') : (isArb ? 'outboundTransfer' : 'depositERC20'), tags: ['bridge', 'l2-deposit'] })
      const [d0, d1] = o.delayMin ?? (isArb ? [8, 15] : [1, 4])
      const l2Tx = w.transfer({ time: o.time + w.rng.int(d0 * 60, d1 * 60), from: l2Gateway, to: recipient, value: o.value, asset, method: isArb ? 'finalizeInboundTransfer' : 'finalizeDeposit', tags: ['bridge', 'l2-deposit'] })
      l1Tx.bridge = { direction: 'out', otherChain: l2, otherTx: l2Tx.id, nonce: n, recipient }
      l2Tx.bridge = { direction: 'in', otherChain: 'eth', otherTx: l1Tx.id, nonce: n, recipient }
      return { l1Tx, l2Tx, recipient }
    },
    withdraw(o) {
      if (w.get(o.from).chain !== l2) throw new Error(`l2Bridge.withdraw : l'émetteur doit être une adresse ${CHAINS[l2].name}`)
      const asset = o.asset ?? 'ETH'
      const recipient = o.recipient ?? w.addrSameEoa(o.from, 'eth')
      const n = ++nonce
      const initTx = w.transfer({ time: o.time, from: o.from, to: l2Gateway, value: o.value, asset, method: isArb ? (asset === 'ETH' ? 'withdrawEth' : 'outboundTransfer') : 'withdraw', tags: ['bridge', 'l2-withdraw-init'] })
      const days = o.challengeDays ?? 7
      const [c0, c1] = o.claimDelayH ?? [1, 30]
      const tf = o.time + Math.round(days * DAY) + w.rng.int(Math.round(c0 * H), Math.round(c1 * H))
      const finalizeTx = w.multi({ time: tf, signer: recipient, chain: 'eth', legs: [{ from: l1Gateway, to: recipient, value: o.value, asset }], method: isArb ? 'executeTransaction' : 'finalizeWithdrawalTransaction', tags: ['bridge', 'l2-withdraw-finalize'] })
      initTx.bridge = { direction: 'out', otherChain: 'eth', otherTx: finalizeTx.id, nonce: n, recipient }
      finalizeTx.bridge = { direction: 'in', otherChain: l2, otherTx: initTx.id, nonce: n, recipient }
      return { initTx, finalizeTx, recipient }
    },
  }
  m.set(l2, kit)
  return kit
}

// ── DAB crypto (distributeur automatique) ───────────────────────────────────

export interface AtmKit {
  entity: Entity
  chain: ChainId
  /** Portefeuille chaud de l'exploitant (paie les achats au guichet). */
  hot: string
  /** Achat au guichet : le client insère des espèces, l'exploitant envoie la crypto à l'adresse du client. */
  cashIn(o: { cashEur: number; to: string; time: number; asset?: AssetId; feePct?: number }): { tx: Tx; value: number; feeEur: number }
  /** Vente au guichet : le client envoie la crypto à une adresse propre au ticket, puis retire des espèces. */
  cashOut(o: { from: string; value: number; time: number; asset?: AssetId; feePct?: number; change?: string | null; sweepDelayH?: number }): { tx: Tx; deposit: string; cashEur: number; sweep?: Tx }
  noise(n: number, from: number, to: number): void
}

/**
 * Exploitant de DAB crypto (ex. 'cryptoguichet'). Les seuils KYC figurent
 * dans la fiche conformité de l'entité.
 *
 * ```ts
 * const dab = atm(w, 'cryptoguichet', 'btc')
 * const { tx, value } = dab.cashIn({ cashEur: 900, to: suspectAddr, time: t })
 * ```
 */
export function atm(w: World, key = 'cryptoguichet', chain: ChainId = 'btc'): AtmKit {
  const entity = w.entity(key)
  const native = nativeOf(chain)
  const hot = w.addr(chain, { entity, label: `${entity.name} — Portefeuille des distributeurs`, tags: ['liquid', 'hot'], kind: chain === 'btc' ? 'p2wpkh' : undefined })
  const kit: AtmKit = {
    entity,
    chain,
    hot,
    cashIn(o) {
      const asset = o.asset ?? native
      const feePct = o.feePct ?? w.rng.float(0.08, 0.12)
      const value = roundAsset(asset, fromUsd(asset, o.cashEur * EUR_USD * (1 - feePct)))
      const tx = isUtxo(chain)
        ? w.utxoTx({ time: o.time, from: [hot], to: [{ address: o.to, value }], change: hot, tags: ['atm-cash-in'], method: 'Vente au guichet' })
        : w.transfer({ time: o.time, from: hot, to: o.to, value, asset, tags: ['atm-cash-in'], method: 'Vente au guichet' })
      return { tx, value, feeEur: Math.round(o.cashEur * feePct * 100) / 100 }
    },
    cashOut(o) {
      const asset = o.asset ?? native
      const feePct = o.feePct ?? w.rng.float(0.07, 0.1)
      const deposit = w.addr(chain, { entity, label: `${entity.name} — Adresse de ticket (vente)`, tags: ['deposit'] })
      const tx = isUtxo(chain)
        ? w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }], change: o.change, tags: ['atm-cash-out'], method: 'Rachat au guichet' })
        : w.transfer({ time: o.time, from: o.from, to: deposit, value: o.value, asset, tags: ['atm-cash-out'], method: 'Rachat au guichet' })
      const cashEur = Math.floor((usd(asset, o.value) * (1 - feePct)) / EUR_USD / 10) * 10
      let sweep: Tx | undefined
      if (o.sweepDelayH !== undefined || w.rng.chance(0.7)) {
        const t = o.time + (o.sweepDelayH ?? w.rng.float(1, 20)) * H
        if (isUtxo(chain)) {
          const fee = w.estimateFee(chain, 1, 1)
          sweep = w.utxoTx({ time: t, from: [deposit], to: [{ address: hot, value: w.unspentValue(deposit, t) - fee }], fee, change: null, spendAll: true, tags: ['sweep'] })
        } else sweep = w.transfer({ time: t, from: deposit, to: hot, value: o.value, asset, method: 'sweep', tags: ['sweep'] })
      }
      return { tx, deposit, cashEur, sweep }
    },
    noise(n, from, to) {
      for (let i = 0; i < n; i++) {
        const t = Math.round(w.rng.float(from, to))
        const cust = w.addr(chain)
        if (w.rng.chance(0.75)) kit.cashIn({ cashEur: Math.round(w.rng.float(2, 95)) * 10, to: cust, time: t })
        else {
          const v = roundAsset(native, fromUsd(native, w.rng.float(100, 1500)))
          if (isUtxo(chain)) w.fund(cust, v * 1.05, t - w.rng.int(2 * H, 20 * DAY))
          kit.cashOut({ from: cust, value: v, time: t })
        }
      }
    },
  }
  return kit
}

// ── TON : transferts avec commentaire ──────────────────────────────────────

/**
 * Transfert TON (natif) ou USDT (jetton) avec commentaire facultatif, visible
 * en clair sur l'explorateur (`tx.memo`).
 *
 * ```ts
 * tonTransfer(w, { from, to: ex.hot, value: 250, asset: 'USDT', comment: ex.newMemo(), time: t })
 * ```
 */
export function tonTransfer(w: World, o: { from: string; to: string; value: number; time: number; asset?: 'TON' | 'USDT'; comment?: string; tags?: string[] }): Tx {
  if (w.get(o.from).chain !== 'ton') throw new Error('tonTransfer : adresse TON attendue')
  const asset = o.asset ?? 'TON'
  return w.transfer({ time: o.time, from: o.from, to: o.to, value: o.value, asset, memo: o.comment, method: asset === 'TON' ? 'transfer' : 'jetton transfer', tags: o.tags })
}

/** Même compte EVM sur plusieurs chaînes (raccourci de `w.addrSameEoa`). */
export function sameEoaOn(w: World, id: string, chains: ChainId[]): string[] {
  return chains.filter(isEvm).map((c) => (c === w.get(id).chain ? id : w.addrSameEoa(id, c)))
}
