import { Rng } from './rng'
import { CHAINS, type AssetId, type ChainId, usd } from './chains'
import { type AddrKind, defaultKind, genAddress, genTxHash } from './addressgen'
import { ENTITY_CATALOG, type Entity, type EntityCategory, type RiskLevel, CATEGORY } from './entities'

export interface ContractInfo {
  name: string
  type: 'router' | 'pool' | 'bridge' | 'mixer' | 'token' | 'exploit' | 'escrow' | 'multisig' | 'vault' | 'lending'
}

export interface Address {
  id: string
  chain: ChainId
  addr: string
  kind: AddrKind
  entityId?: string
  /** Étiquette publique (visible si l'entité est connue de l'outil). */
  label?: string
  contract?: ContractInfo
  tags: string[]
  /** Portefeuille logiciel qui contrôle l'adresse (vérité terrain : détermine l'empreinte des transactions). */
  wallet: string
}

export interface TxIO {
  address: string
  value: number
  n: number
  /** Pour une entrée : sortie dépensée. Absent = historique hors périmètre. */
  prev?: { tx: string; n: number }
}

export interface Transfer {
  from: string
  to: string
  value: number
  asset: AssetId
  n: number
}

export interface BridgeInfo {
  direction: 'out' | 'in'
  otherChain: ChainId
  otherTx?: string
  nonce: number
  recipient?: string
}

/** Champs techniques d'une transaction UTXO, fixés par le logiciel de portefeuille. */
export interface TxFingerprint {
  version: 1 | 2
  locktime: number
  /** Signalement « replace-by-fee » (nSequence < 0xfffffffe). */
  rbf: boolean
}

export interface Tx {
  id: string
  hash: string
  chain: ChainId
  time: number
  block: number
  model: 'utxo' | 'account'
  inputs: TxIO[]
  outputs: TxIO[]
  transfers: Transfer[]
  fee: number
  feeAsset: AssetId
  signer?: string
  method?: string
  memo?: string
  tags: string[]
  bridge?: BridgeInfo
  fp?: TxFingerprint
}

interface Utxo {
  tx: string
  n: number
  address: string
  value: number
  /** Horodatage de création : une UTXO ne peut être dépensée qu'après. */
  time: number
  external?: boolean
}

export interface AddrOpts {
  entity?: string | Entity
  kind?: AddrKind
  label?: string
  contract?: ContractInfo
  tags?: string[]
  addr?: string
  /** Portefeuille logiciel (par défaut : celui de l'entité, sinon l'adresse elle-même). */
  wallet?: string
}

/** Familles de logiciels de portefeuille, reconnaissables aux champs techniques de leurs transactions. */
export interface WalletProfile {
  id: 'desktop' | 'sorted' | 'mobile' | 'legacy' | 'service' | 'coinjoin'
  label: string
  version: 1 | 2
  /** nLockTime à la hauteur courante (protection « anti-fee-sniping ») ou à 0. */
  locktime: 'height' | 'zero'
  rbf: boolean
  /** Entrées et sorties triées selon le BIP 69. */
  bip69: boolean
}

export const WALLET_PROFILES: WalletProfile[] = [
  { id: 'desktop', label: 'Portefeuille de bureau (anti-fee-sniping, RBF)', version: 2, locktime: 'height', rbf: true, bip69: false },
  { id: 'sorted', label: 'Portefeuille de bureau à sorties triées (BIP 69)', version: 2, locktime: 'height', rbf: true, bip69: true },
  { id: 'mobile', label: 'Portefeuille mobile (RBF, nLockTime à 0)', version: 2, locktime: 'zero', rbf: true, bip69: false },
  { id: 'legacy', label: 'Ancien logiciel (version 1, sans RBF)', version: 1, locktime: 'zero', rbf: false, bip69: false },
  { id: 'service', label: 'Plateforme de service (sans RBF, nLockTime à 0)', version: 2, locktime: 'zero', rbf: false, bip69: false },
  { id: 'coinjoin', label: 'Coordinateur CoinJoin', version: 1, locktime: 'zero', rbf: false, bip69: false },
]

const SERVICE_WALLETS = new Set<EntityCategory>(['exchange', 'instant_exchanger', 'otc', 'p2p', 'mixer', 'darknet', 'gambling', 'merchant', 'sanctioned', 'coinjoin'])

export interface UtxoTxOpts {
  time: number
  from?: string[]
  to: { address: string; value: number }[]
  /** Adresse de rendu. `undefined` = nouvelle adresse du même portefeuille, `null` = pas de rendu (ajouté aux frais). */
  change?: string | null
  fee?: number
  tags?: string[]
  method?: string
  spendAll?: boolean
  autoFund?: boolean
}

export interface TransferOpts {
  time: number
  from: string
  to: string
  value: number
  asset?: AssetId
  method?: string
  memo?: string
  tags?: string[]
  fee?: number
  autoFund?: boolean
}

export interface MultiOpts {
  time: number
  signer: string
  legs: { from: string; to: string; value: number; asset: AssetId }[]
  method?: string
  tags?: string[]
  memo?: string
  fee?: number
  chain?: ChainId
}

const EPOCH = 1704067200 // 2024-01-01T00:00:00Z
const DUST = 0.00000546

export class World {
  readonly rng: Rng
  readonly seed: number
  readonly t0: number
  readonly entities = new Map<string, Entity>()
  readonly addresses = new Map<string, Address>()
  readonly txs = new Map<string, Tx>()
  readonly byAddr = new Map<string, string[]>()
  /** clé `${txId}:${n}` → transaction qui dépense cette sortie */
  readonly spentBy = new Map<string, string>()
  /** Adresses dont l'attribution directe est masquée (mode « couverture partielle »). */
  readonly hiddenAttribution = new Set<string>()
  private unspent = new Map<string, Utxo[]>()
  private bal = new Map<string, number>()
  private used = new Set<string>()
  private customCount = 0

  constructor(seed: number, t0?: number) {
    this.seed = seed
    this.rng = new Rng(seed)
    // Affaires datées entre début 2024 et mi-2026.
    this.t0 = t0 ?? EPOCH + this.rng.int(10, 880) * 86400 + this.rng.int(6, 20) * 3600
  }

  // ── Entités ──────────────────────────────────────────────────────────────

  /** Entité du catalogue (idempotent). */
  entity(key: string, overrides: Partial<Entity> = {}): Entity {
    const existing = this.entities.get(key)
    if (existing) return existing
    const tpl = ENTITY_CATALOG[key]
    if (!tpl) throw new Error(`Entité inconnue: ${key}`)
    const e: Entity = { id: key, known: tpl.known ?? true, ...tpl, ...overrides }
    this.entities.set(key, e)
    return e
  }

  /** Entité ad hoc (victime, suspect, particulier, service inventé…). */
  customEntity(e: {
    name: string
    category: EntityCategory
    risk?: RiskLevel
    known?: boolean
    description?: string
    country?: string
    compliance?: Entity['compliance']
  }): Entity {
    const id = `ent${++this.customCount}_${e.category}`
    const full: Entity = {
      id,
      name: e.name,
      category: e.category,
      risk: e.risk ?? CATEGORY[e.category].risk,
      known: e.known ?? false,
      description: e.description ?? '',
      country: e.country,
      compliance: e.compliance,
    }
    this.entities.set(id, full)
    return full
  }

  // ── Adresses ─────────────────────────────────────────────────────────────

  addr(chain: ChainId, opts: AddrOpts = {}): string {
    let kind = opts.kind ?? defaultKind(this.rng, chain)
    if (opts.contract && CHAINS[chain].model === 'account') kind = 'contract'
    let s = opts.addr ?? genAddress(this.rng, chain, kind)
    while (this.used.has(`${chain}:${s}`)) s = genAddress(this.rng, chain, kind)
    const id = `${chain}:${s}`
    this.used.add(id)
    const entityId = typeof opts.entity === 'string' ? opts.entity : opts.entity?.id
    this.addresses.set(id, { id, chain, addr: s, kind, entityId, label: opts.label, contract: opts.contract, tags: opts.tags ?? [], wallet: opts.wallet ?? entityId ?? id })
    return id
  }

  /** Famille de logiciel du portefeuille qui contrôle une adresse (déterministe, sans tirage aléatoire). */
  walletProfile(id: string): WalletProfile {
    const a = this.get(id)
    const e = a.entityId ? this.entities.get(a.entityId) : undefined
    if (e && SERVICE_WALLETS.has(e.category)) return WALLET_PROFILES[4]
    let h = 2166136261
    for (let i = 0; i < a.wallet.length; i++) h = Math.imul(h ^ a.wallet.charCodeAt(i), 16777619) >>> 0
    return WALLET_PROFILES[h % 4]
  }

  /** Plusieurs adresses du même type (même portefeuille). */
  addrs(chain: ChainId, n: number, opts: AddrOpts = {}): string[] {
    const kind = opts.kind ?? defaultKind(this.rng, chain)
    return Array.from({ length: n }, () => this.addr(chain, { ...opts, kind }))
  }

  get(id: string): Address {
    const a = this.addresses.get(id)
    if (!a) throw new Error(`Adresse inconnue: ${id}`)
    return a
  }

  tag(id: string, ...tags: string[]): void {
    const a = this.get(id)
    for (const t of tags) if (!a.tags.includes(t)) a.tags.push(t)
  }

  setEntity(id: string, entity: string | Entity, label?: string): void {
    const a = this.get(id)
    a.entityId = typeof entity === 'string' ? entity : entity.id
    if (label) a.label = label
  }

  isLiquid(id: string): boolean {
    const a = this.get(id)
    return !!a.contract || a.tags.includes('liquid')
  }

  // ── Temps ────────────────────────────────────────────────────────────────

  /** Horodatage à `hours` heures après le début de l'affaire (+ gigue en secondes). */
  at(hours: number, jitterSec = 0): number {
    return Math.round(this.t0 + hours * 3600 + (jitterSec ? this.rng.float(-jitterSec, jitterSec) : 0))
  }

  blockOf(chain: ChainId, time: number): number {
    const c = CHAINS[chain]
    return c.baseHeight + Math.max(0, Math.floor((time - EPOCH) / c.blockTime))
  }

  // ── Bitcoin / Litecoin (UTXO) ────────────────────────────────────────────

  /** UTXO non dépensées d'une adresse (seulement celles existant à `at` si précisé). */
  utxosOf(id: string, at?: number): Utxo[] {
    const all = this.unspent.get(id) ?? []
    return at === undefined ? all : all.filter((u) => u.time <= at)
  }

  /** Valeur non dépensée détenue par une adresse UTXO (à l'instant `at` si précisé). */
  unspentValue(id: string, at?: number): number {
    return this.utxosOf(id, at).reduce((s, u) => s + u.value, 0)
  }

  /** Crédite une adresse UTXO depuis des adresses tierces (historique antérieur hors périmètre). */
  fund(id: string, value: number, time: number, opts: { from?: string[]; senders?: number; entity?: string } = {}): Tx {
    const a = this.get(id)
    const chain = a.chain
    const n = opts.senders ?? this.rng.weighted([[1, 0.6], [2, 0.3], [3, 0.1]] as const)
    const senders = opts.from ?? this.addrs(chain, n, { entity: opts.entity })
    const feeGuess = this.estimateFee(chain, senders.length, 2)
    const total = value + feeGuess + this.rng.float(0, value * 0.8)
    const parts = this.rng.split(total, senders.length)
    senders.forEach((s, i) => this.injectExternal(s, parts[i], time - this.rng.int(3600, 86400 * 20)))
    return this.utxoTx({ time, from: senders, to: [{ address: id, value }], fee: feeGuess, autoFund: false })
  }

  /** Ajoute une UTXO dont l'origine est hors périmètre (pas de transaction visible). */
  private injectExternal(id: string, value: number, time: number): void {
    const list = this.unspent.get(id) ?? []
    list.push({ tx: '', n: 0, address: id, value, time, external: true })
    this.unspent.set(id, list)
  }

  estimateFee(chain: ChainId, nIn: number, nOut: number): number {
    const vbytes = 11 + nIn * 68 + nOut * 31
    const rate = chain === 'btc' ? this.rng.int(4, 38) : this.rng.int(1, 6)
    const unit = chain === 'btc' ? 1e-8 : 1e-8 * 10
    return Math.round(vbytes * rate) * unit
  }

  utxoTx(o: UtxoTxOpts): Tx {
    const firstTo = o.to[0]?.address
    const firstFrom = o.from?.[0]
    const chain = this.get(firstFrom ?? firstTo).chain
    const outTotal = o.to.reduce((s, x) => s + x.value, 0)
    const from = o.from ?? []

    let pool = from.flatMap((f) => this.utxosOf(f, o.time))
    let selected: Utxo[] = []
    const nOutGuess = o.to.length + (o.change === null ? 0 : 1)
    let fee = o.fee ?? this.estimateFee(chain, Math.max(1, Math.min(pool.length, 3)), nOutGuess)

    const need = () => outTotal + fee
    if (o.spendAll) {
      selected = pool
    } else {
      pool = [...pool].sort((a, b) => b.value - a.value)
      let acc = 0
      for (const u of pool) {
        if (acc >= need()) break
        selected.push(u)
        acc += u.value
      }
    }
    let inTotal = selected.reduce((s, u) => s + u.value, 0)
    if (inTotal < need() - 1e-12 && from.length) {
      const deficit = need() - inTotal
      const target = from[0]
      if (this.isLiquid(target)) this.sweepInto(target, deficit * this.rng.float(1.1, 3), o.time - this.rng.int(1800, 86400 * 3))
      else if (o.autoFund !== false) this.fund(target, deficit * this.rng.float(1.02, 1.4), o.time - this.rng.int(3600, 86400 * 6))
      else this.injectExternal(target, deficit, o.time)
      return this.utxoTx(o)
    }
    if (o.fee === undefined) fee = Math.min(this.estimateFee(chain, Math.max(1, selected.length), nOutGuess), Math.max(0, inTotal - outTotal))

    const hash = genTxHash(this.rng, chain)
    const id = `${chain}:${hash}`
    const inputs: TxIO[] = selected.map((u, i) => ({ address: u.address, value: u.value, n: i, prev: u.external ? undefined : { tx: u.tx, n: u.n } }))
    for (const u of selected) {
      const list = this.unspent.get(u.address) ?? []
      this.unspent.set(u.address, list.filter((x) => x !== u))
      if (!u.external) this.spentBy.set(`${u.tx}:${u.n}`, id)
    }

    const outs = o.to.map((x) => ({ address: x.address, value: x.value }))
    const change = inTotal - outTotal - fee
    if (change > DUST && o.change !== null) {
      let changeAddr = o.change
      if (!changeAddr) {
        const src = this.get(from[0])
        changeAddr = this.addr(chain, { entity: src.entityId, kind: src.kind, wallet: src.wallet })
      }
      outs.push({ address: changeAddr, value: change })
    } else if (change > 0) {
      fee += change
    }
    this.rng.shuffle(outs)
    const prof = this.walletProfile(from[0] ?? firstTo)
    if (prof.bip69) outs.sort((a, b) => a.value - b.value || (this.get(a.address).addr < this.get(b.address).addr ? -1 : 1))

    const outputs: TxIO[] = outs.map((x, n) => ({ address: x.address, value: x.value, n }))
    for (const out of outputs) {
      const list = this.unspent.get(out.address) ?? []
      list.push({ tx: id, n: out.n, address: out.address, value: out.value, time: o.time })
      this.unspent.set(out.address, list)
    }

    const tx: Tx = {
      id, hash, chain, time: o.time, block: this.blockOf(chain, o.time), model: 'utxo',
      inputs, outputs, transfers: [], fee, feeAsset: CHAINS[chain].native, method: o.method, tags: o.tags ?? [],
    }
    tx.fp = fingerprintOf(prof, tx.block)
    this.register(tx)
    return tx
  }

  /**
   * Transaction UTXO entièrement contrôlée : dépense toutes les UTXO de
   * `spend` (ou les montants indiqués) et crée exactement `outputs` (sans
   * mélange de l'ordre si `keepOrder`). Utilisé pour les CoinJoin.
   */
  rawUtxoTx(o: {
    time: number
    spend: { address: string; value?: number }[]
    outputs: { address: string; value: number }[]
    tags?: string[]
    method?: string
    keepOrder?: boolean
  }): Tx {
    const chain = this.get(o.spend[0].address).chain
    const selected: Utxo[] = []
    for (const s of o.spend) {
      let list = this.utxosOf(s.address, o.time)
      const have = list.reduce((a, u) => a + u.value, 0)
      if (s.value !== undefined && have < s.value) {
        this.injectExternal(s.address, s.value - have, o.time)
        list = this.utxosOf(s.address, o.time)
      }
      if (s.value === undefined) {
        selected.push(...list)
      } else {
        let acc = 0
        for (const u of [...list].sort((a, b) => b.value - a.value)) {
          if (acc >= s.value) break
          selected.push(u)
          acc += u.value
        }
      }
    }
    const inTotal = selected.reduce((s, u) => s + u.value, 0)
    const outTotal = o.outputs.reduce((s, x) => s + x.value, 0)
    if (inTotal < outTotal) {
      this.injectExternal(o.spend[0].address, outTotal - inTotal + 0.00001, o.time)
      return this.rawUtxoTx(o)
    }
    const hash = genTxHash(this.rng, chain)
    const id = `${chain}:${hash}`
    const inputs: TxIO[] = selected.map((u, i) => ({ address: u.address, value: u.value, n: i, prev: u.external ? undefined : { tx: u.tx, n: u.n } }))
    for (const u of selected) {
      const list = this.unspent.get(u.address) ?? []
      this.unspent.set(u.address, list.filter((x) => x !== u))
      if (!u.external) this.spentBy.set(`${u.tx}:${u.n}`, id)
    }
    const outs = o.keepOrder ? [...o.outputs] : this.rng.shuffle([...o.outputs])
    const outputs: TxIO[] = outs.map((x, n) => ({ address: x.address, value: x.value, n }))
    for (const out of outputs) {
      const list = this.unspent.get(out.address) ?? []
      list.push({ tx: id, n: out.n, address: out.address, value: out.value, time: o.time })
      this.unspent.set(out.address, list)
    }
    const tx: Tx = {
      id, hash, chain, time: o.time, block: this.blockOf(chain, o.time), model: 'utxo',
      inputs, outputs, transfers: [], fee: inTotal - outTotal, feeAsset: CHAINS[chain].native,
      method: o.method, tags: o.tags ?? [],
    }
    tx.fp = fingerprintOf(o.tags?.includes('coinjoin') ? WALLET_PROFILES[5] : this.walletProfile(o.spend[0].address), tx.block)
    this.register(tx)
    return tx
  }

  /** Alimente un portefeuille chaud par regroupement d'adresses de dépôt (sweep). */
  sweepInto(target: string, value: number, time: number): Tx {
    const a = this.get(target)
    const n = this.rng.int(3, 7)
    const deposits = this.addrs(a.chain, n, { entity: a.entityId, tags: ['deposit'] })
    const parts = this.rng.split(value * 1.002, n, 1.4)
    deposits.forEach((d, i) => this.injectExternal(d, parts[i], time))
    return this.utxoTx({ time, from: deposits, to: [{ address: target, value }], change: null, tags: ['sweep'], autoFund: false })
  }

  // ── Comptes (EVM, Tron, XRP, Solana) ─────────────────────────────────────

  balanceOf(id: string, asset: AssetId): number {
    return this.bal.get(`${id}|${asset}`) ?? 0
  }

  private credit(id: string, asset: AssetId, v: number): void {
    const k = `${id}|${asset}`
    this.bal.set(k, (this.bal.get(k) ?? 0) + v)
  }

  /** Crédite un compte depuis une adresse tierce non identifiée. */
  fundAccount(id: string, value: number, asset: AssetId, time: number, from?: string): Tx {
    const a = this.get(id)
    const sender = from ?? this.addr(a.chain)
    this.credit(sender, asset, value)
    return this.transfer({ time, from: sender, to: id, value, asset, autoFund: false })
  }

  transfer(o: TransferOpts): Tx {
    const a = this.get(o.from)
    const asset = o.asset ?? CHAINS[a.chain].native
    return this.multi({
      time: o.time,
      signer: o.from,
      legs: [{ from: o.from, to: o.to, value: o.value, asset }],
      method: o.method ?? (asset === CHAINS[a.chain].native ? 'transfer' : 'transfer (token)'),
      tags: o.tags,
      memo: o.memo,
      fee: o.fee,
      chain: a.chain,
      autoFund: o.autoFund,
    } as MultiOpts & { autoFund?: boolean })
  }

  multi(o: MultiOpts & { autoFund?: boolean }): Tx {
    const chain = o.chain ?? this.get(o.signer).chain
    // Solde suffisant ? Sinon on crédite depuis l'extérieur (historique visible).
    for (const leg of o.legs) {
      if (this.isLiquid(leg.from)) continue
      const have = this.balanceOf(leg.from, leg.asset)
      if (have < leg.value - 1e-9) {
        if (o.autoFund === false) this.credit(leg.from, leg.asset, leg.value - have)
        else this.fundAccount(leg.from, (leg.value - have) * this.rng.float(1.0, 1.25), leg.asset, o.time - this.rng.int(3600, 86400 * 4))
      }
    }
    const hash = genTxHash(this.rng, chain)
    const id = `${chain}:${hash}`
    const transfers: Transfer[] = o.legs.map((l, n) => ({ ...l, n }))
    for (const t of transfers) {
      this.credit(t.from, t.asset, -t.value)
      this.credit(t.to, t.asset, t.value)
    }
    const native = CHAINS[chain].native
    const fee = o.fee ?? defaultAccountFee(this.rng, chain, transfers.length)
    const tx: Tx = {
      id, hash, chain, time: o.time, block: this.blockOf(chain, o.time), model: 'account',
      inputs: [], outputs: [], transfers, fee, feeAsset: native, signer: o.signer,
      method: o.method, memo: o.memo, tags: o.tags ?? [],
    }
    this.register(tx)
    return tx
  }

  // ── Index & requêtes ─────────────────────────────────────────────────────

  private register(tx: Tx): void {
    this.txs.set(tx.id, tx)
    const touched = new Set<string>()
    tx.inputs.forEach((x) => touched.add(x.address))
    tx.outputs.forEach((x) => touched.add(x.address))
    tx.transfers.forEach((t) => {
      touched.add(t.from)
      touched.add(t.to)
    })
    if (tx.signer) touched.add(tx.signer)
    for (const a of touched) {
      const l = this.byAddr.get(a) ?? []
      l.push(tx.id)
      this.byAddr.set(a, l)
    }
  }

  tx(id: string): Tx {
    const t = this.txs.get(id)
    if (!t) throw new Error(`Transaction inconnue: ${id}`)
    return t
  }

  txsOf(id: string): Tx[] {
    return (this.byAddr.get(id) ?? []).map((t) => this.txs.get(t)!).sort((a, b) => a.time - b.time)
  }

  /** Montants reçus/envoyés par une adresse dans une transaction. */
  flowIn(tx: Tx, id: string): { asset: AssetId; value: number }[] {
    if (tx.model === 'utxo') {
      const v = tx.outputs.filter((o) => o.address === id).reduce((s, o) => s + o.value, 0)
      return v ? [{ asset: CHAINS[tx.chain].native, value: v }] : []
    }
    return tx.transfers.filter((t) => t.to === id).map((t) => ({ asset: t.asset, value: t.value }))
  }

  flowOut(tx: Tx, id: string): { asset: AssetId; value: number }[] {
    if (tx.model === 'utxo') {
      const v = tx.inputs.filter((o) => o.address === id).reduce((s, o) => s + o.value, 0)
      return v ? [{ asset: CHAINS[tx.chain].native, value: v }] : []
    }
    return tx.transfers.filter((t) => t.from === id).map((t) => ({ asset: t.asset, value: t.value }))
  }

  summary(id: string) {
    const txs = this.txsOf(id)
    const received: Partial<Record<AssetId, number>> = {}
    const sent: Partial<Record<AssetId, number>> = {}
    let inUsd = 0
    let outUsd = 0
    let nIn = 0
    let nOut = 0
    for (const tx of txs) {
      const fi = this.flowIn(tx, id)
      const fo = this.flowOut(tx, id)
      if (fi.length) nIn++
      if (fo.length) nOut++
      for (const f of fi) {
        received[f.asset] = (received[f.asset] ?? 0) + f.value
        inUsd += usd(f.asset, f.value)
      }
      for (const f of fo) {
        sent[f.asset] = (sent[f.asset] ?? 0) + f.value
        outUsd += usd(f.asset, f.value)
      }
    }
    const balance: Partial<Record<AssetId, number>> = {}
    const assets = new Set([...Object.keys(received), ...Object.keys(sent)] as AssetId[])
    for (const a of assets) {
      const b = (received[a] ?? 0) - (sent[a] ?? 0)
      if (b > 1e-9) balance[a] = b
    }
    return {
      txCount: txs.length, nIn, nOut, received, sent, balance, inUsd, outUsd,
      first: txs[0]?.time, last: txs[txs.length - 1]?.time,
    }
  }

  txUsd(tx: Tx): number {
    if (tx.model === 'utxo') return usd(CHAINS[tx.chain].native, tx.outputs.reduce((s, o) => s + o.value, 0))
    return tx.transfers.reduce((s, t) => s + usd(t.asset, t.value), 0)
  }

  /** Entité réellement propriétaire (vérité terrain, ne pas exposer telle quelle). */
  ownerOf(id: string): Entity | undefined {
    const e = this.get(id).entityId
    return e ? this.entities.get(e) : undefined
  }
}

function fingerprintOf(p: WalletProfile, block: number): TxFingerprint {
  return { version: p.version, locktime: p.locktime === 'height' ? block - 1 : 0, rbf: p.rbf }
}

function defaultAccountFee(rng: Rng, chain: ChainId, legs: number): number {
  switch (chain) {
    case 'eth':
      return +(rng.float(0.0004, 0.004) * (legs > 1 ? 2.6 : 1)).toFixed(6)
    case 'bsc':
      return +(rng.float(0.0002, 0.0012) * (legs > 1 ? 2 : 1)).toFixed(6)
    case 'tron':
      return +rng.float(0, 27.5).toFixed(2)
    case 'xrp':
      return 0.000012
    case 'sol':
      return 0.000005
    default:
      return 0
  }
}
