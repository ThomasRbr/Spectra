// Briques DeFi et smart contracts pour composer des affaires : enveloppe WETH,
// prêt avec garantie (Aave), agrégateur multi-pools (1inch), parts de pool de
// liquidité, approvals piégées, contrats de répartition et transactions
// échouées. Chaque brique produit les mêmes transferts que la réalité (y
// compris mint/burn depuis l'adresse nulle et transactions internes), plus
// l'appel de fonction décodable (voir `evm.ts`).
import { CHAINS, type AssetId, type ChainId, fromUsd, roundAsset, usd } from './chains'
import type { Entity } from './entities'
import { MAX_UINT, nullAddress, tokenContract } from './evm'
import { keccak256 } from './keccak'
import type { DexKit } from './patterns'
import type { CallArg, Tx, World } from './world'

const nativeOf = (chain: ChainId): AssetId => CHAINS[chain].native
const wrapped = (w: World, chain: ChainId, a: AssetId) => tokenContract(w, chain, a === nativeOf(chain) ? 'WETH' : a)
const deadline = (t: number): CallArg => ({ uint: t + 1200 })

// ── WETH ────────────────────────────────────────────────────────────────────

export interface WethKit {
  contract: string
  wrap(from: string, value: number, time: number): Tx
  unwrap(from: string, value: number, time: number, to?: string): Tx
}

/** Enveloppe WETH : l'ETH part vers le contrat, le WETH est créé (Deposit) ; l'inverse pour withdraw. */
export function weth(w: World, chain: ChainId = 'eth'): WethKit {
  const contract = tokenContract(w, chain, 'WETH')
  const zero = nullAddress(w, chain)
  const native = nativeOf(chain)
  return {
    contract,
    wrap(from, value, time) {
      return w.multi({
        time, signer: from, method: 'deposit', tags: ['wrap'],
        legs: [{ from, to: contract, value, asset: native }, { from: zero, to: from, value, asset: 'WETH' }],
        call: { to: contract, sig: 'deposit()', args: [] },
      })
    },
    unwrap(from, value, time, to) {
      return w.multi({
        time, signer: from, method: 'withdraw', tags: ['unwrap'],
        legs: [{ from, to: zero, value, asset: 'WETH' }, { from: contract, to: to ?? from, value, asset: native }],
        call: { to: contract, sig: 'withdraw(uint256)', args: [{ amt: value, asset: 'WETH' }] },
      })
    },
  }
}

// ── Prêt avec garantie ──────────────────────────────────────────────────────

export interface LendingKit {
  entity: Entity
  pool: string
  /** Dépôt en garantie : l'actif entre dans le pool, des aTokens sont créés au profit du déposant. */
  supply(o: { from: string; value: number; asset?: AssetId; time: number }): Tx
  /** Emprunt contre la garantie : l'actif sort du pool (fonds « neufs »). */
  borrow(o: { from: string; value: number; asset: AssetId; time: number; to?: string }): Tx
  repay(o: { from: string; value: number; asset: AssetId; time: number; onBehalfOf?: string }): Tx
  /** Retrait de la garantie : les aTokens sont détruits, l'actif sort vers `to` (par défaut le déposant). */
  withdraw(o: { from: string; value: number; asset?: AssetId; time: number; to?: string }): Tx
  noise(n: number, from: number, to: number): void
}

const RECEIPT: Partial<Record<AssetId, AssetId>> = { ETH: 'aWETH', WETH: 'aWETH', USDC: 'aUSDC' }

/**
 * Protocole de prêt type Aave sur Ethereum (`key` = 'aave' par défaut).
 * Garantie en ETH (aWETH) ou USDC (aUSDC) ; emprunts en USDC, USDT, DAI ou WETH.
 */
export function lending(w: World, key = 'aave', chain: ChainId = 'eth'): LendingKit {
  const entity = w.entity(key)
  const real = key === 'aave' && chain === 'eth'
  const poolOpts = { entity, label: `${entity.name} : Pool (v3)`, contract: { name: `${entity.name} Pool`, type: 'lending' as const, verified: true } }
  const pool = real ? w.fixedAddr(chain, '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', poolOpts) : w.addr(chain, poolOpts)
  const zero = nullAddress(w, chain)
  const native = nativeOf(chain)
  const kit: LendingKit = {
    entity,
    pool,
    supply(o) {
      const asset = o.asset ?? native
      const receipt = RECEIPT[asset] ?? 'aWETH'
      const isEth = asset === native
      return w.multi({
        time: o.time, signer: o.from, method: isEth ? 'depositETH' : 'supply', tags: ['lending-supply', 'defi'],
        legs: [{ from: o.from, to: pool, value: o.value, asset }, { from: zero, to: o.from, value: o.value, asset: receipt }],
        call: isEth
          ? { to: pool, sig: 'depositETH(address,address,uint16)', args: [{ addr: pool }, { addr: o.from }, { uint: 0 }] }
          : { to: pool, sig: 'supply(address,uint256,address,uint16)', args: [{ addr: wrapped(w, chain, asset) }, { amt: o.value, asset }, { addr: o.from }, { uint: 0 }] },
      })
    },
    borrow(o) {
      return w.multi({
        time: o.time, signer: o.from, method: 'borrow', tags: ['lending-borrow', 'defi'],
        legs: [{ from: pool, to: o.to ?? o.from, value: o.value, asset: o.asset }],
        call: { to: pool, sig: 'borrow(address,uint256,uint256,uint16,address)', args: [{ addr: wrapped(w, chain, o.asset) }, { amt: o.value, asset: o.asset }, { uint: 2 }, { uint: 0 }, { addr: o.from }] },
      })
    },
    repay(o) {
      return w.multi({
        time: o.time, signer: o.from, method: 'repay', tags: ['lending-repay', 'defi'],
        legs: [{ from: o.from, to: pool, value: o.value, asset: o.asset }],
        call: { to: pool, sig: 'repay(address,uint256,uint256,address)', args: [{ addr: wrapped(w, chain, o.asset) }, { amt: o.value, asset: o.asset }, { uint: 2 }, { addr: o.onBehalfOf ?? o.from }] },
      })
    },
    withdraw(o) {
      const asset = o.asset ?? native
      const receipt = RECEIPT[asset] ?? 'aWETH'
      return w.multi({
        time: o.time, signer: o.from, method: 'withdraw', tags: ['lending-withdraw', 'defi'],
        legs: [{ from: o.from, to: zero, value: o.value, asset: receipt }, { from: pool, to: o.to ?? o.from, value: o.value, asset }],
        call: { to: pool, sig: 'withdraw(address,uint256,address)', args: [{ addr: wrapped(w, chain, asset) }, { amt: o.value, asset }, { addr: o.to ?? o.from }] },
      })
    },
    noise(n, from, to) {
      for (let i = 0; i < n; i++) {
        const t = Math.round(w.rng.float(from, to))
        const u = w.addr(chain)
        const eth = roundAsset(native, w.rng.float(0.5, 40))
        w.fundAccount(u, eth * 1.02, native, t - w.rng.int(3600, 86400 * 30))
        kit.supply({ from: u, value: eth, time: t })
        if (w.rng.chance(0.6)) kit.borrow({ from: u, value: roundAsset('USDC', usd(native, eth) * w.rng.float(0.2, 0.6)), asset: w.rng.pick(['USDC', 'USDT', 'DAI'] as const), time: t + w.rng.int(60, 86400) })
      }
    },
  }
  return kit
}

// ── Agrégateur de DEX ───────────────────────────────────────────────────────

export interface AggregatorKit {
  entity: Entity
  router: string
  /**
   * Swap en plusieurs étapes en un seul appel : l'actif part vers le routeur,
   * traverse les pools de `route` (actifs intermédiaires), et l'actif final est
   * versé à `recipient` (par défaut le signataire).
   */
  swap(o: { trader: string; route: AssetId[]; amountIn: number; time: number; recipient?: string }): { tx: Tx; amountOut: number; pools: string[] }
}

export function aggregator(w: World, key = 'oneinch', chain: ChainId = 'eth', dexKit?: DexKit): AggregatorKit {
  const entity = w.entity(key)
  const real = key === 'oneinch' && chain === 'eth'
  const opts = { entity, label: `${entity.name} : Aggregation Router`, contract: { name: `${entity.name} Aggregation Router`, type: 'aggregator' as const, verified: true } }
  const router = real ? w.fixedAddr(chain, '0x111111125421cA6dc452d289314280a0f8842A65', opts) : w.addr(chain, opts)
  const native = nativeOf(chain)
  return {
    entity,
    router,
    swap(o) {
      if (o.route.length < 2) throw new Error('aggregator.swap : au moins deux actifs')
      const pools: string[] = []
      const legs: { from: string; to: string; value: number; asset: AssetId }[] = [{ from: o.trader, to: router, value: o.amountIn, asset: o.route[0] }]
      let amount = o.amountIn
      let holder = router
      for (let i = 0; i < o.route.length - 1; i++) {
        const a = o.route[i]
        const b = o.route[i + 1]
        const p = dexKit ? dexKit.pool(a, b) : w.addr(chain, { label: `Pool ${a}/${b}`, contract: { name: `Pool ${a}/${b}`, type: 'pool', verified: true } })
        pools.push(p)
        const out = roundAsset(b, fromUsd(b, usd(a, amount) * (1 - 0.003) * w.rng.float(0.994, 0.999)))
        const last = i === o.route.length - 2
        legs.push({ from: holder, to: p, value: amount, asset: a })
        legs.push({ from: p, to: last ? (o.recipient ?? o.trader) : router, value: out, asset: b })
        holder = router
        amount = out
      }
      const tx = w.multi({
        time: o.time, signer: o.trader, method: 'unoswap', tags: ['swap', 'aggregator'], legs,
        call: { to: router, sig: 'unoswap(address,uint256,uint256,uint256[])', args: [{ addr: o.route[0] === native ? tokenContract(w, chain, 'WETH') : tokenContract(w, chain, o.route[0]) }, { amt: o.amountIn, asset: o.route[0] }, { amt: amount * 0.99, asset: o.route[o.route.length - 1] }, { list: pools.map((p) => ({ addr: p })) }] },
      })
      return { tx, amountOut: amount, pools }
    },
  }
}

// ── Pools de liquidité ──────────────────────────────────────────────────────

export interface LpPosition {
  tx: Tx
  pool: string
  lp: number
}

/**
 * Ajout de liquidité : `assetA` et `assetB` entrent dans le pool du DEX, des
 * parts (LP) sont créées au profit de `to` (par défaut le fournisseur).
 * La valeur USD des deux dépôts est égale (prix du pool).
 */
export function addLiquidity(w: World, d: DexKit, o: { from: string; assetA: AssetId; amountA: number; assetB: AssetId; time: number; to?: string }): LpPosition & { amountB: number } {
  const chain = w.get(o.from).chain
  const native = nativeOf(chain)
  const pool = d.pool(o.assetA, o.assetB)
  const amountB = roundAsset(o.assetB, fromUsd(o.assetB, usd(o.assetA, o.amountA)))
  const lp = roundAsset('LP', (usd(o.assetA, o.amountA) * 2) / usd('LP', 1))
  const zero = nullAddress(w, chain)
  const ethSide = o.assetA === native ? 'A' : o.assetB === native ? 'B' : null
  const token = ethSide === 'A' ? o.assetB : o.assetA
  const tokenAmt = ethSide === 'A' ? amountB : o.amountA
  const ethAmt = ethSide === 'A' ? o.amountA : amountB
  const tx = w.multi({
    time: o.time, signer: o.from, method: ethSide ? 'addLiquidityETH' : 'addLiquidity', tags: ['lp-add', 'defi'],
    legs: [
      { from: o.from, to: pool, value: o.amountA, asset: o.assetA },
      { from: o.from, to: pool, value: amountB, asset: o.assetB },
      { from: zero, to: o.to ?? o.from, value: lp, asset: 'LP' },
    ],
    call: ethSide
      ? { to: d.router, sig: 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)', args: [{ addr: tokenContract(w, chain, token) }, { amt: tokenAmt, asset: token }, { amt: tokenAmt * 0.995, asset: token }, { amt: ethAmt * 0.995, asset: native }, { addr: o.to ?? o.from }, deadline(o.time)] }
      : { to: d.router, sig: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)', args: [{ addr: tokenContract(w, chain, o.assetA) }, { addr: tokenContract(w, chain, o.assetB) }, { amt: o.amountA, asset: o.assetA }, { amt: amountB, asset: o.assetB }, { amt: o.amountA * 0.995, asset: o.assetA }, { amt: amountB * 0.995, asset: o.assetB }, { addr: o.to ?? o.from }, deadline(o.time)] },
  })
  return { tx, pool, lp, amountB }
}

/**
 * Retrait de liquidité : `lp` parts détruites par `from`, les deux actifs du
 * pool versés à `to`. Le prix a pu bouger : `drift` (ex. +0,04) déplace la
 * répartition entre les deux actifs, à valeur totale quasi constante.
 */
export function removeLiquidity(w: World, d: DexKit, o: { from: string; assetA: AssetId; assetB: AssetId; lp: number; time: number; to?: string; drift?: number }): { tx: Tx; amountA: number; amountB: number } {
  const chain = w.get(o.from).chain
  const native = nativeOf(chain)
  const pool = d.pool(o.assetA, o.assetB)
  const valueUsd = usd('LP', o.lp) * w.rng.float(0.996, 1.004)
  const drift = o.drift ?? w.rng.float(-0.06, 0.06)
  const amountA = roundAsset(o.assetA, fromUsd(o.assetA, (valueUsd / 2) * (1 + drift)))
  const amountB = roundAsset(o.assetB, fromUsd(o.assetB, (valueUsd / 2) * (1 - drift)))
  const zero = nullAddress(w, chain)
  const to = o.to ?? o.from
  const ethSide = o.assetA === native ? 'A' : o.assetB === native ? 'B' : null
  const token = ethSide === 'A' ? o.assetB : o.assetA
  const tx = w.multi({
    time: o.time, signer: o.from, method: ethSide ? 'removeLiquidityETH' : 'removeLiquidity', tags: ['lp-remove', 'defi'],
    legs: [
      { from: o.from, to: zero, value: o.lp, asset: 'LP' },
      { from: pool, to, value: amountA, asset: o.assetA },
      { from: pool, to, value: amountB, asset: o.assetB },
    ],
    call: ethSide
      ? { to: d.router, sig: 'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)', args: [{ addr: tokenContract(w, chain, token) }, { amt: o.lp, asset: 'LP' }, { uint: 0 }, { uint: 0 }, { addr: to }, deadline(o.time)] }
      : { to: d.router, sig: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)', args: [{ addr: tokenContract(w, chain, o.assetA) }, { addr: tokenContract(w, chain, o.assetB) }, { amt: o.lp, asset: 'LP' }, { uint: 0 }, { uint: 0 }, { addr: to }, deadline(o.time)] },
  })
  return { tx, amountA, amountB }
}

/** Liquidité de fond d'autres fournisseurs sur un pool (bruit). */
export function lpNoise(w: World, d: DexKit, pair: [AssetId, AssetId], n: number, from: number, to: number): void {
  const chain = w.get(d.router).chain
  for (let i = 0; i < n; i++) {
    const t = Math.round(w.rng.float(from, to))
    const u = w.addr(chain)
    const amountA = roundAsset(pair[0], fromUsd(pair[0], w.rng.float(800, 60000)))
    const pos = addLiquidity(w, d, { from: u, assetA: pair[0], amountA, assetB: pair[1], time: t })
    if (w.rng.chance(0.5)) removeLiquidity(w, d, { from: u, assetA: pair[0], assetB: pair[1], lp: pos.lp, time: t + w.rng.int(3600, 86400 * 20) })
  }
}

// ── Approvals ───────────────────────────────────────────────────────────────

/** `approve(spender, montant)` signé par le titulaire (montant omis : autorisation illimitée). */
export function approve(w: World, o: { owner: string; spender: string; asset: AssetId; time: number; value?: number }): Tx {
  const chain = w.get(o.owner).chain
  const token = tokenContract(w, chain, o.asset)
  return w.multi({
    time: o.time, signer: o.owner, method: 'approve', tags: ['approval'], legs: [],
    call: { to: token, sig: 'approve(address,uint256)', args: [{ addr: o.spender }, o.value === undefined ? { uint: MAX_UINT.toString() } : { amt: o.value, asset: o.asset }] },
  })
}

/**
 * Autorisation signée hors chaîne (EIP-2612) : c'est le bénéficiaire qui la
 * publie et paie le gas. Le titulaire n'apparaît pas comme signataire.
 */
export function permit(w: World, o: { owner: string; spender: string; asset: AssetId; time: number; submitter?: string; value?: number }): Tx {
  const chain = w.get(o.owner).chain
  const token = tokenContract(w, chain, o.asset)
  const h = keccak256(`permit:${o.owner}:${o.time}`)
  return w.multi({
    time: o.time, signer: o.submitter ?? o.spender, method: 'permit', tags: ['approval', 'permit'], legs: [],
    call: { to: token, sig: 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)', args: [{ addr: o.owner }, { addr: o.spender }, o.value === undefined ? { uint: MAX_UINT.toString() } : { amt: o.value, asset: o.asset }, { uint: o.time + 86400 * 30 }, { uint: 27 + (parseInt(h.slice(0, 2), 16) % 2) }, { bytes: '0x' + h }, { bytes: '0x' + keccak256(h) }] },
  })
}

/** `transferFrom` exécuté par le bénéficiaire d'une autorisation : le titulaire ne signe rien. */
export function transferFrom(w: World, o: { spender: string; owner: string; to: string; value: number; asset: AssetId; time: number }): Tx {
  const chain = w.get(o.owner).chain
  const token = tokenContract(w, chain, o.asset)
  return w.multi({
    time: o.time, signer: o.spender, method: 'transferFrom', tags: ['transferFrom'],
    legs: [{ from: o.owner, to: o.to, value: o.value, asset: o.asset }],
    call: { to: token, sig: 'transferFrom(address,address,uint256)', args: [{ addr: o.owner }, { addr: o.to }, { amt: o.value, asset: o.asset }] },
  })
}

// ── Contrat de répartition ──────────────────────────────────────────────────

/**
 * Envoi d'ETH à un contrat qui le redistribue immédiatement (transactions
 * internes) selon des parts fixes. Les bénéficiaires n'apparaissent PAS dans
 * la liste des transactions « normales » de leur adresse sur un explorateur :
 * seulement dans l'onglet des transactions internes.
 */
export function splitPayment(w: World, o: { from: string; splitter: string; value: number; time: number; shares: { to: string; pct: number }[]; method?: string }): Tx {
  const chain = w.get(o.from).chain
  const native = nativeOf(chain)
  const legs = [{ from: o.from, to: o.splitter, value: o.value, asset: native }]
  let rest = o.value
  o.shares.forEach((s, i) => {
    const v = i === o.shares.length - 1 ? roundAsset(native, rest) : roundAsset(native, o.value * s.pct)
    rest -= v
    legs.push({ from: o.splitter, to: s.to, value: v, asset: native })
  })
  return w.multi({ time: o.time, signer: o.from, method: o.method ?? 'distribute', tags: ['split'], legs })
}

// ── Transaction échouée ─────────────────────────────────────────────────────

/** Transaction qui échoue (revert) : visible sur la chaîne, frais payés, aucun transfert. */
export function failedTx(w: World, o: { signer: string; to: string; value?: number; asset?: AssetId; time: number; reason: string; method?: string; call?: Tx['call'] }): Tx {
  const chain = w.get(o.signer).chain
  return w.multi({
    time: o.time, signer: o.signer, method: o.method, reverted: o.reason, call: o.call,
    legs: [{ from: o.signer, to: o.to, value: o.value ?? 0, asset: o.asset ?? nativeOf(chain) }],
  })
}

// ── Contrats de dépôt (forwarders CREATE2) ──────────────────────────────────

export interface ForwarderKit {
  entity: Entity
  hot: string
  factory: string
  /** Portefeuille opérationnel de la plateforme qui déclenche les reversements. */
  operator: string
  /** Adresse de dépôt d'un nouveau client : contrat pas encore déployé (adresse CREATE2 calculée d'avance). */
  newDeposit(): string
  /**
   * Dépôt client. ETH : le contrat reverse aussitôt au hot wallet dans la même
   * transaction (transaction interne). Jetons : ils restent sur le contrat
   * jusqu'au reversement (`flush`) déclenché par la plateforme.
   */
  receive(from: string, value: number, time: number, opts?: { asset?: AssetId; depositAddr?: string; flushDelayH?: number }): { tx: Tx; deposit: string; flush?: Tx }
  flush(deposit: string, asset: AssetId, time: number): Tx
  withdraw(to: string, value: number, time: number, asset?: AssetId): Tx
  noise(n: number, from: number, to: number, asset?: AssetId): void
}

/**
 * Exchange dont les adresses de dépôt sont des contrats « forwarders »
 * déployés par CREATE2 (modèle répandu chez les plateformes et les
 * dépositaires). L'heuristique « réception puis balayage » s'applique, mais le
 * balayage est un appel de contrat signé par un portefeuille opérationnel.
 */
export function forwarderExchange(w: World, key: string, chain: ChainId = 'eth'): ForwarderKit {
  const entity = w.entity(key)
  const native = nativeOf(chain)
  const hot = w.addr(chain, { entity, label: `${entity.name} — Hot Wallet`, tags: ['liquid', 'hot'] })
  const factory = w.addr(chain, { entity, label: `${entity.name} — Fabrique de contrats de dépôt`, contract: { name: 'ForwarderFactory (CREATE2)', type: 'factory', verified: true } })
  const operator = w.addr(chain, { entity, label: `${entity.name} — Portefeuille opérationnel`, tags: ['liquid'] })
  const deployed = new Set<string>()
  const kit: ForwarderKit = {
    entity,
    hot,
    factory,
    operator,
    newDeposit() {
      return w.addr(chain, { entity, label: `${entity.name} — Contrat de dépôt`, contract: { name: 'Forwarder', type: 'forwarder', verified: true }, tags: ['deposit', 'forwarder'] })
    },
    receive(from, value, time, opts = {}) {
      const asset = opts.asset ?? native
      const deposit = opts.depositAddr ?? kit.newDeposit()
      if (asset === native) {
        const tx = w.multi({
          time, signer: from, method: 'transfer', tags: ['forwarder-auto'],
          legs: [{ from, to: deposit, value, asset }, { from: deposit, to: hot, value, asset }],
        })
        return { tx, deposit }
      }
      const tx = w.transfer({ time, from, to: deposit, value, asset })
      const flush = kit.flush(deposit, asset, time + (opts.flushDelayH ?? w.rng.float(0.5, 10)) * 3600)
      return { tx, deposit, flush }
    },
    flush(deposit, asset, time) {
      const v = w.balanceOf(deposit, asset)
      const first = !deployed.has(deposit)
      deployed.add(deposit)
      const salt = '0x' + keccak256(`salt:${w.get(deposit).addr}`)
      return w.multi({
        time, signer: operator, method: first ? 'createForwarder' : 'flushTokens', tags: ['sweep', 'forwarder-flush'],
        legs: [{ from: deposit, to: hot, value: v, asset }],
        creates: first ? [deposit] : undefined,
        call: first
          ? { to: factory, sig: 'createForwarder(address,bytes32)', args: [{ addr: hot }, { bytes: salt }] }
          : { to: deposit, sig: 'flushTokens(address)', args: [{ addr: tokenContract(w, chain, asset) }] },
      })
    },
    withdraw(to, value, time, asset = native) {
      return w.transfer({ time, from: hot, to, value, asset, method: 'withdraw' })
    },
    noise(n, from, to, asset = native) {
      for (let i = 0; i < n; i++) {
        const t = Math.round(w.rng.float(from, to))
        const a = w.addr(chain)
        const v = asset === native ? roundAsset(native, fromUsd(native, w.rng.float(80, 30000))) : roundAsset(asset, w.rng.float(80, 30000))
        if (w.rng.chance(0.5)) kit.withdraw(a, v, t, asset)
        else kit.receive(a, v, t, { asset })
      }
    },
  }
  return kit
}

// ── Coffre multisignature (Safe) ────────────────────────────────────────────

/** Exécution d'un transfert depuis un coffre Safe (contrat multisignature) par l'un de ses propriétaires. */
export function safeExec(w: World, o: { safe: string; executor: string; to: string; value: number; asset?: AssetId; time: number; signers: number }): Tx {
  const chain = w.get(o.safe).chain
  const native = nativeOf(chain)
  const asset = o.asset ?? native
  const isNative = asset === native
  const inner: CallArg = isNative ? { bytes: '0x' } : { bytes: '0xa9059cbb' + '0'.repeat(24) + w.get(o.to).addr.slice(2).toLowerCase() + BigInt(Math.round(o.value * 1e6)).toString(16).padStart(64, '0') }
  const sigs = '0x' + Array.from({ length: o.signers }, (_, i) => keccak256(`sig:${o.time}:${i}`) + keccak256(`sig2:${o.time}:${i}`) + '1b').join('')
  return w.multi({
    time: o.time, signer: o.executor, method: 'execTransaction', tags: ['multisig-exec'],
    legs: [{ from: o.safe, to: o.to, value: o.value, asset }],
    call: { to: o.safe, sig: 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)', args: [{ addr: isNative ? o.to : tokenContract(w, chain, asset) }, isNative ? { amt: o.value, asset } : { uint: 0 }, inner, { uint: 0 }, { uint: 0 }, { uint: 0 }, { uint: 0 }, { addr: nullAddress(w, chain) }, { addr: nullAddress(w, chain) }, { bytes: sigs }] },
  })
}
