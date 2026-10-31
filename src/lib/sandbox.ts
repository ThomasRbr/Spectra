// Bac à sable : l'apprenant construit ses propres transactions et observe ce
// qu'en déduisent les heuristiques de l'outil (rendu, entrées communes,
// empreinte, poids). Défis vérifiés automatiquement. Atelier ABI (encodage et
// décodage d'appels de contrats).
import { World, WALLET_PROFILES, type Tx, type WalletProfile } from '../engine/world'
import { roundAsset, type AssetId } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { Entity } from '../engine/entities'
import { changeAnalysis, clusters, detectCoinjoin, fingerprintDiff, txFingerprint } from '../engine/analysis'
import { coinjoin, exchange, peelChain, type ExchangeKit } from '../engine/patterns'
import { followPeelChain } from '../engine/heuristics'
import { txSize } from '../engine/script'
import { keccak256, selectorOf } from '../engine/keccak'
import { FUNCTIONS, SELECTOR_DB, paramTypes } from '../engine/evm'

const H = 3600
export const ME = 'moi'

/** Estimation de la taille virtuelle d'une entrée / sortie selon le type d'adresse (vB). */
const IN_VB: Partial<Record<AddrKind, number>> = { p2pkh: 148, p2sh: 91, p2wpkh: 68, p2tr: 57.5, p2wsh: 104 }
const OUT_VB: Partial<Record<AddrKind, number>> = { p2pkh: 34, p2sh: 32, p2wpkh: 31, p2tr: 43, p2wsh: 43 }

export type Destination = 'tiers' | 'exchange' | 'moi'
export type ChangePolicy = 'same' | 'p2tr' | 'p2pkh' | 'reuse' | 'none'
export type OutputOrder = 'random' | 'change-last' | 'bip69'

export interface BuildOpts {
  inputs: string[]
  payments: { to: Destination; value: number; kind?: AddrKind }[]
  change: ChangePolicy
  software: WalletProfile['id']
  order: OutputOrder
  feeRate: number
  label?: string
}

export interface LabEntry {
  txId: string
  label: string
  /** Sortie de rendu réelle (vérité connue de l'apprenant). */
  changeN?: number
}

export class Lab {
  readonly w: World
  readonly me: Entity
  readonly ex: ExchangeKit
  t: number
  entries: LabEntry[] = []
  /** Sorties mixées et rendus toxiques issus de CoinJoin (adresses). */
  mixed = new Set<string>()
  toxic = new Set<string>()

  constructor(seed = 20260101) {
    this.w = new World(seed, 1767225600)
    this.me = this.w.customEntity({ name: 'Vous (portefeuille du bac à sable)', category: 'individual' })
    this.ex = exchange(this.w, 'kraken', 'btc')
    this.ex.noise(6, this.w.at(-48), this.w.at(-1))
    this.t = this.w.at(0)
    for (const [v, k] of [[0.42, 'p2wpkh'], [0.18, 'p2wpkh'], [0.075, 'p2pkh'], [0.3, 'p2tr']] as [number, AddrKind][]) this.receive(v, k)
  }

  private tick(h = 0.5) {
    // Le monde change après coup : on invalide les caches d'analyse (clusters, tri chronologique)
    this.w.epoch++
    this.t += Math.round(h * H)
    return this.t
  }

  newMine(kind: AddrKind): string {
    return this.w.addr('btc', { entity: this.me, kind, wallet: ME })
  }

  isMine(id: string): boolean {
    return this.w.get(id).wallet === ME
  }

  /** Réception d'un paiement d'un tiers sur une nouvelle adresse. */
  receive(value: number, kind: AddrKind): Tx {
    const a = this.newMine(kind)
    const tx = this.w.fund(a, value, this.tick())
    this.entries.push({ txId: tx.id, label: `Réception de ${value} BTC (${kind.toUpperCase()})` })
    return tx
  }

  /** Adresses du portefeuille qui détiennent des fonds. */
  holdings(): { address: string; value: number; kind: AddrKind; mixed: boolean; toxic: boolean }[] {
    return [...this.w.addresses.values()]
      .filter((a) => a.wallet === ME)
      .map((a) => ({ address: a.id, value: this.w.unspentValue(a.id), kind: a.kind, mixed: this.mixed.has(a.id), toxic: this.toxic.has(a.id) }))
      .filter((h) => h.value > 0)
  }

  estimateFee(o: Pick<BuildOpts, 'inputs' | 'payments' | 'change' | 'feeRate'>): number {
    const inKinds = o.inputs.map((a) => this.w.get(a).kind)
    const outKinds = o.payments.map((p) => p.kind ?? 'p2wpkh')
    if (o.change !== 'none') outKinds.push(this.changeKind(o.change, inKinds[0] ?? 'p2wpkh'))
    const vb = 10.5 + inKinds.reduce((s, k) => s + (IN_VB[k] ?? 68), 0) + outKinds.reduce((s, k) => s + (OUT_VB[k] ?? 31), 0)
    return Math.ceil(vb * o.feeRate) * 1e-8
  }

  private changeKind(p: ChangePolicy, inKind: AddrKind): AddrKind {
    return p === 'p2tr' ? 'p2tr' : p === 'p2pkh' ? 'p2pkh' : inKind
  }

  /** Construit et diffuse une transaction ; renvoie un message d'erreur ou la transaction. */
  build(o: BuildOpts): Tx | string {
    if (!o.inputs.length) return 'Choisissez au moins une entrée.'
    if (!o.payments.length || o.payments.some((p) => !(p.value > 0))) return 'Indiquez au moins un paiement d\'un montant positif.'
    const w = this.w
    const inTotal = o.inputs.reduce((s, a) => s + w.unspentValue(a), 0)
    const payTotal = o.payments.reduce((s, p) => s + p.value, 0)
    const fee = this.estimateFee(o)
    const change = roundAsset('BTC', inTotal - payTotal - fee)
    if (change < 0) return `Fonds insuffisants : ${inTotal.toFixed(8)} BTC en entrée pour ${payTotal.toFixed(8)} BTC de paiements et ${fee.toFixed(8)} BTC de frais.`
    const outputs: { address: string; value: number; isChange?: boolean }[] = o.payments.map((p) => ({
      address: p.to === 'exchange' ? this.ex.newDeposit() : p.to === 'moi' ? this.newMine(p.kind ?? 'p2wpkh') : w.addr('btc', { kind: p.kind ?? 'p2wpkh' }),
      value: roundAsset('BTC', p.value),
    }))
    if (o.change !== 'none' && change > 0.00000546) {
      const addr = o.change === 'reuse' ? o.inputs[0] : this.newMine(this.changeKind(o.change, w.get(o.inputs[0]).kind))
      outputs.push({ address: addr, value: change, isChange: true })
    }
    let ordered = outputs
    if (o.order === 'bip69') ordered = [...outputs].sort((a, b) => a.value - b.value || (w.get(a.address).addr < w.get(b.address).addr ? -1 : 1))
    else if (o.order === 'random') ordered = w.rng.shuffle([...outputs])
    const tx = w.rawUtxoTx({ time: this.tick(), spend: o.inputs.map((address) => ({ address })), outputs: ordered.map(({ address, value }) => ({ address, value })), keepOrder: true })
    const prof = WALLET_PROFILES.find((p) => p.id === o.software) ?? WALLET_PROFILES[0]
    tx.fp = { version: prof.version, locktime: prof.locktime === 'height' ? tx.block - 1 : 0, rbf: prof.rbf }
    const changeN = ordered.findIndex((x) => x.isChange)
    this.entries.push({ txId: tx.id, label: o.label ?? `Paiement de ${payTotal} BTC`, changeN: changeN >= 0 ? changeN : undefined })
    return tx
  }

  /** CoinJoin : l'adresse choisie apporte ses fonds, reçoit une sortie mixée et un rendu toxique. */
  coinjoin(from: string, denom: number): Tx | string {
    const v = this.w.unspentValue(from)
    if (v < denom + 0.0005) return `Il faut au moins ${denom + 0.0005} BTC sur l'adresse pour participer à un CoinJoin de ${denom} BTC.`
    const mixedTo = this.newMine('p2wpkh')
    const changeTo = this.newMine(this.w.get(from).kind)
    const res = coinjoin(this.w, { chain: 'btc', time: this.tick(), denom, participants: [{ from, mixedTo, changeTo }], extra: 6 })
    this.mixed.add(mixedTo)
    if (res.change[0]) this.toxic.add(res.change[0])
    this.entries.push({ txId: res.tx.id, label: `CoinJoin de ${denom} BTC` })
    return res.tx
  }

  /** Peel chain automatique depuis une adresse. */
  peel(from: string, steps: number): Tx[] | string {
    if (this.w.unspentValue(from) < 0.01) return 'Il faut au moins 0,01 BTC pour une peel chain.'
    const ps = peelChain(this.w, { start: from, steps, time: this.tick(), stepH: [0.5, 3], peelTarget: () => this.w.addr('btc') })
    for (const p of ps) this.entries.push({ txId: p.tx.id, label: `Peel chain : pelure de ${p.peelValue} BTC`, changeN: p.tx.outputs.findIndex((x) => x.address === p.next) })
    this.t = Math.max(this.t, ps[ps.length - 1]?.tx.time ?? this.t)
    this.w.epoch++
    return ps.map((p) => p.tx)
  }

  /** Mes adresses regroupées par l'heuristique des entrées communes (clusters de plus d'une adresse). */
  myClusters(): string[][] {
    const c = clusters(this.w)
    const groups = new Map<string, string[]>()
    for (const a of this.w.addresses.values()) {
      if (a.wallet !== ME) continue
      const r = c.of.get(a.id) ?? a.id
      groups.set(r, [...(groups.get(r) ?? []), a.id])
    }
    return [...groups.values()].filter((g) => g.length > 1).sort((x, y) => y.length - x.length)
  }
}

// ── Défis ───────────────────────────────────────────────────────────────────

export interface Challenge {
  id: string
  title: string
  goal: string
  hint: string
  check(lab: Lab): { done: boolean; detail: string }
}

const built = (lab: Lab) => lab.entries.map((e) => ({ e, tx: lab.w.tx(e.txId) })).filter((x) => x.tx.inputs.some((i) => lab.isMine(i.address)))

export const CHALLENGES: Challenge[] = [
  {
    id: 'cioh',
    title: 'Relier ses propres adresses',
    goal: 'Faites une transaction qui dépense au moins trois de vos adresses ensemble : l\'outil les regroupe dans un même cluster.',
    hint: 'Cochez trois entrées ou plus dans le constructeur : c\'est une consolidation.',
    check(lab) {
      const big = lab.myClusters()[0]
      return { done: (big?.length ?? 0) >= 3, detail: big ? `Plus grand cluster : ${big.length} de vos adresses` : 'Aucune de vos adresses n\'est encore regroupée.' }
    },
  },
  {
    id: 'rendu-trahi',
    title: 'Un rendu qui se trahit',
    goal: 'Construisez une transaction dont l\'outil identifie le vrai rendu avec plus de 80 % de probabilité, puis lisez les raisons.',
    hint: 'Paiement rond vers une adresse d\'un autre type, rendu non rond du même type que l\'entrée.',
    check(lab) {
      for (const { e, tx } of built(lab)) {
        if (e.changeN === undefined) continue
        const c = changeAnalysis(lab.w, tx).find((x) => x.n === e.changeN)
        if (c && c.prob > 0.8) return { done: true, detail: `${e.label} : rendu repéré à ${Math.round(c.prob * 100)} %` }
      }
      return { done: false, detail: 'Aucun rendu encore repéré à plus de 80 %.' }
    },
  },
  {
    id: 'rendu-cache',
    title: 'Cacher son rendu',
    goal: 'Payez au moins 0,05 BTC à un tiers avec une transaction dont le vrai rendu reçoit moins de 40 % de probabilité.',
    hint: 'Jouez sur le type d\'adresse du rendu, le caractère rond des montants et l\'ordre des sorties.',
    check(lab) {
      let best = 1
      for (const { e, tx } of built(lab)) {
        if (e.changeN === undefined || !tx.outputs.some((o, n) => n !== e.changeN && !lab.isMine(o.address) && o.value >= 0.05)) continue
        const c = changeAnalysis(lab.w, tx).find((x) => x.n === e.changeN)
        if (!c) continue
        best = Math.min(best, c.prob)
        if (c.prob < 0.4) return { done: true, detail: `${e.label} : rendu à ${Math.round(c.prob * 100)} % seulement` }
      }
      return { done: false, detail: best < 1 ? `Meilleur essai : ${Math.round(best * 100)} %` : 'Aucun paiement de 0,05 BTC ou plus avec rendu.' }
    },
  },
  {
    id: 'empreinte',
    title: 'Trahi par son logiciel',
    goal: 'Dépensez le rendu d\'une transaction avec un autre logiciel de portefeuille : l\'outil note que l\'empreinte change.',
    hint: 'Faites un paiement avec « Portefeuille de bureau », puis dépensez son rendu en choisissant « Ancien logiciel ».',
    check(lab) {
      for (const { e, tx } of built(lab)) {
        if (e.changeN === undefined) continue
        const s = lab.w.spender(tx.id, e.changeN)
        if (!s) continue
        const a = txFingerprint(lab.w, tx)
        const b = txFingerprint(lab.w, lab.w.tx(s))
        if (a && b && fingerprintDiff(a, b).length) return { done: true, detail: `Différences : ${fingerprintDiff(a, b).join(', ')}` }
      }
      return { done: false, detail: 'Aucun rendu encore dépensé par un logiciel différent.' }
    },
  },
  {
    id: 'peel',
    title: 'Une peel chain détectable',
    goal: 'Réalisez une peel chain d\'au moins 4 sauts et vérifiez que le suiveur automatique la retrouve en entier.',
    hint: 'Outil « Peel chain » du constructeur, 4 sauts ou plus.',
    check(lab) {
      for (const { tx } of built(lab)) {
        if (!tx.tags.includes('peel')) continue
        const r = followPeelChain(lab.w, tx.inputs[0].address)
        if (r.steps.length >= 4) return { done: true, detail: `Suiveur : ${r.steps.length} sauts détectés` }
      }
      return { done: false, detail: 'Aucune peel chain de 4 sauts détectée.' }
    },
  },
  {
    id: 'postmix',
    title: 'L\'erreur post-mix',
    goal: 'Participez à un CoinJoin, puis dépensez votre sortie mixée ET votre rendu toxique dans la même transaction : le lien réapparaît.',
    hint: 'Après le CoinJoin, cochez les deux adresses marquées « mixée » et « rendu toxique » comme entrées d\'un même paiement.',
    check(lab) {
      for (const { tx } of built(lab)) {
        if (detectCoinjoin(tx).is) continue
        const ins = tx.inputs.map((i) => i.address)
        if (ins.some((a) => lab.mixed.has(a)) && ins.some((a) => lab.toxic.has(a))) return { done: true, detail: 'Sortie mixée et rendu toxique regroupés : l\'anonymat du CoinJoin est perdu.' }
      }
      return { done: false, detail: 'Pas encore de dépense commune d\'une sortie mixée et d\'un rendu toxique.' }
    },
  },
  {
    id: 'segwit',
    title: 'La remise SegWit',
    goal: 'Faites un paiement depuis une adresse Legacy (1…) et un autre depuis une adresse SegWit ou Taproot, puis comparez leurs tailles virtuelles.',
    hint: 'Le panneau « Ce que voit l\'analyste » affiche la vsize de chaque transaction.',
    check(lab) {
      let legacy = 0
      let modern = 0
      for (const { tx } of built(lab)) {
        const s = txSize(lab.w, tx)
        if (!s || tx.inputs.length !== 1) continue
        const k = lab.w.get(tx.inputs[0].address).kind
        if (k === 'p2pkh') legacy = s.vsize
        else if (k === 'p2wpkh' || k === 'p2tr') modern = s.vsize
      }
      return { done: legacy > 0 && modern > 0 && modern < legacy, detail: legacy && modern ? `Legacy ${legacy} vB contre ${modern} vB` : 'Il faut un paiement à une seule entrée de chaque type.' }
    },
  },
]

// ── Atelier ABI ─────────────────────────────────────────────────────────────

export interface DecodedWord {
  index: number
  hex: string
  meaning: string
}

export interface Decoded {
  selector: string
  signature?: string
  words: DecodedWord[]
  params: { name: string; type: string; value: string }[]
  error?: string
}

/** Décode des données d'entrée : sélecteur reconnu, puis mots de 32 octets (types statiques et tableaux simples). */
export function decodeCalldata(input: string): Decoded {
  const hex = input.trim().replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase()
  if (!/^[0-9a-f]*$/.test(hex) || hex.length < 8) return { selector: '', words: [], params: [], error: 'Données invalides : il faut au moins 4 octets hexadécimaux (le sélecteur).' }
  const selector = '0x' + hex.slice(0, 8)
  const body = hex.slice(8)
  const words = (body.match(/.{1,64}/g) ?? []).map((h, i) => ({ index: i, hex: h, meaning: '' }))
  const signature = SELECTOR_DB[selector]
  if (!signature) return { selector, words, params: [], error: 'Sélecteur absent de la base de signatures : fonction d\'un contrat non vérifié, ou nom inconnu.' }
  const types = paramTypes(signature)
  const names = FUNCTIONS[signature]?.names ?? []
  const params: Decoded['params'] = []
  const word = (i: number) => words[i]?.hex ?? ''
  const asValue = (t: string, h: string) => (t === 'address' ? '0x' + h.slice(24) : t === 'bool' ? (BigInt('0x' + (h || '0')) ? 'true' : 'false') : t.startsWith('bytes') && !t.endsWith('[]') ? '0x' + h : BigInt('0x' + (h || '0')).toString())
  types.forEach((t, i) => {
    const h = word(i)
    if (words[i]) words[i].meaning = `${names[i] ?? `arg${i}`} (${t})${t.endsWith('[]') || t === 'bytes' ? ' : position des données (offset)' : ''}`
    if (t.endsWith('[]')) {
      const off = Number(BigInt('0x' + (h || '0'))) / 32
      const len = Number(BigInt('0x' + (word(off) || '0')))
      if (words[off]) words[off].meaning = `longueur de ${names[i] ?? `arg${i}`} : ${len}`
      const items: string[] = []
      for (let k = 0; k < Math.min(len, 16); k++) {
        const wi = off + 1 + k
        if (words[wi]) words[wi].meaning = `${names[i] ?? `arg${i}`}[${k}]`
        items.push(asValue(t.slice(0, -2), word(wi)))
      }
      params.push({ name: names[i] ?? `arg${i}`, type: t, value: `[${items.join(', ')}]` })
    } else if (t === 'bytes') {
      params.push({ name: names[i] ?? `arg${i}`, type: t, value: '(données de longueur variable)' })
    } else params.push({ name: names[i] ?? `arg${i}`, type: t, value: asValue(t, h) })
  })
  return { selector, signature, words, params }
}

/** Étapes du calcul d'un sélecteur, pour l'affichage pédagogique. */
export function selectorSteps(signature: string): { hash: string; selector: string } {
  return { hash: '0x' + keccak256(signature), selector: selectorOf(signature) }
}

export const ABI_DEMO_ASSETS: AssetId[] = ['USDT', 'USDC', 'DAI', 'WETH', 'ETH']
