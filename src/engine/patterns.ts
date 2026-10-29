// Briques réutilisables pour composer des affaires : exchanges, échangeurs
// instantanés, mixeurs, CoinJoin, DEX, bridges, pools de confidentialité,
// peel chains et bruit de fond.
import { CHAINS, type AssetId, type ChainId, fromUsd, roundAsset, usd } from './chains'
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
}

export function exchange(w: World, key: string, chain: ChainId): ExchangeKit {
  const entity = w.entity(key)
  const hot = w.addr(chain, { entity, label: `${entity.name} — Hot Wallet`, tags: ['liquid', 'hot'], kind: chain === 'btc' ? 'p2wpkh' : undefined })
  const native = nativeOf(chain)
  // XRP : adresse partagée + destination tag
  const shared = chain === 'xrp'

  const kit: ExchangeKit = {
    entity,
    chain,
    hot,
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
  const coord = w.entity('whirl')
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
    const m = p.mixedTo ?? w.addr(o.chain, { kind: 'p2wpkh', entity: w.get(p.from).entityId })
    outputs.push({ address: m, value: o.denom })
    const rest = v - o.denom - mf - share
    let ch: string | undefined
    if (rest > 0.00001 && p.changeTo !== null) {
      ch = p.changeTo ?? w.addr(o.chain, { kind: w.get(p.from).kind, entity: w.get(p.from).entityId })
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
    const next = w.addr(src.chain, { entity: src.entityId, kind: o.nextKind === 'mixed' ? undefined : src.kind })
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
