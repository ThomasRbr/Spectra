import { create } from 'zustand'
import { CHAINS, usd } from '../engine/chains'
import { attribution } from '../engine/analysis'
import { TRACE_METHODS, findPath, traceFunds, type TraceOptions, type TraceResult, type TraceSource } from '../engine/tracing'
import { shortAddr } from '../engine/addressgen'
import type { World } from '../engine/world'
import { scenarioById } from '../scenarios'
import type { ScenarioInstance, ScenarioTemplate } from '../scenarios/types'
import { type Answer, type CaseScore, scoreCase } from '../lib/scoring'
import { type Pos, aKey, computeEdges, extraLinks, freeSpot, idOf, isAKey, layeredLayout, tKey } from '../lib/graph'
import { DIFFICULTY } from '../scenarios/types'
import { useProfile } from './profile'
import { useUi } from './ui'

export type Flag = 'suspect' | 'victim' | 'interest' | 'service' | 'dead-end'

export const FLAG_META: Record<Flag, { label: string; color: string }> = {
  suspect: { label: 'Suspect', color: '#f472b6' },
  victim: { label: 'Victime', color: '#4ade80' },
  interest: { label: 'Intérêt', color: '#facc15' },
  service: { label: 'Service / plateforme', color: '#22d3ee' },
  'dead-end': { label: 'Impasse', color: '#64748b' },
}

export type Selection =
  | { kind: 'address'; id: string }
  | { kind: 'tx'; id: string }
  | { kind: 'edge'; source: string; target: string; txIds: string[] }
  | null

export type Mode = 'standard' | 'examen'
export type Coverage = 'full' | 'partial'

/** Lien posé par l'enquêteur entre deux adresses (ex. corrélation d'un swap). */
export interface ManualLink {
  id: string
  source: string
  target: string
  kind: 'correlation'
  label: string
  txId?: string
}

/** Traçage des fonds en cours, affiché en surimpression sur le graphe. */
export interface ActiveTrace {
  source: TraceSource
  opts: TraceOptions
  result: TraceResult
}

/** Chemin trouvé entre deux adresses, surligné sur le graphe. */
export interface PathHighlight {
  from: string
  to: string
  txIds: string[]
}

/** Mode temps réel : horloge simulée, les transactions postérieures restent invisibles. */
export interface LiveClock {
  now: number
  start: number
  /** Dernier fait connu de l'affaire : au-delà, plus rien ne bouge. */
  end: number
}

/** Mouvement constaté sur une adresse surveillée quand l'horloge avance. */
export interface WatchAlert {
  id: string
  time: number
  address: string
  txId: string
  dir: 'in' | 'out'
  usd: number
}

/** Graphe nommé d'un dossier (plusieurs pistes peuvent être menées en parallèle). */
export interface GraphView {
  id: string
  name: string
  addrPos: Record<string, Pos>
  txPos: Record<string, Pos>
  revealed: Record<string, true>
  links: ManualLink[]
}

/** Constatations exportables d'un dossier, pour les partager entre enquêteurs. */
export interface CaseExport {
  format: 'spectra-case'
  version: 1
  templateId: string
  seed: number
  coverage: Coverage
  exportedAt: string
  flags: Record<string, Flag>
  notes: Record<string, string>
  links: ManualLink[]
  watch: string[]
  views: GraphView[]
  addresses: Record<string, string>
}

export interface LogEntry {
  t: number
  text: string
  kind: 'graph' | 'flag' | 'answer' | 'hint' | 'tool' | 'system'
}

interface GameState {
  template: ScenarioTemplate | null
  inst: ScenarioInstance | null
  seed: number
  mode: Mode
  coverage: Coverage
  startedAt: number
  finishedAt?: number
  addrPos: Record<string, Pos>
  txPos: Record<string, Pos>
  revealed: Record<string, true>
  selection: Selection
  multi: string[]
  flags: Record<string, Flag>
  notes: Record<string, string>
  answers: Record<string, Answer>
  hintsUsed: number
  objHints: string[]
  log: LogEntry[]
  links: ManualLink[]
  trace: ActiveTrace | null
  pathHighlight: PathHighlight | null
  live: LiveClock | null
  watch: string[]
  alerts: WatchAlert[]
  /** Graphes inactifs du dossier ; le graphe actif est dans addrPos/txPos/revealed/links. */
  views: GraphView[]
  viewId: string
  viewName: string
  minUsd: number
  showTruth: boolean
  score?: CaseScore
  xpGained?: number
  focus: { key: string; n: number } | null
  layoutTick: number
  /** Pile d'annulation des opérations sur le graphe. */
  history: GraphSnapshot[]
  xpNote?: string

  start(templateId: string, seed: number, opts?: { mode?: Mode; coverage?: Coverage; live?: boolean }): void
  resume(saved: SavedCase): boolean
  quit(): void
  addAddress(id: string, near?: string, side?: 1 | -1): void
  expand(id: string, dir: 'in' | 'out'): number
  revealTx(txId: string, withCounterparts?: boolean): void
  removeNode(key: string): void
  removeNodes(keys: string[]): void
  undo(): void
  setPositions(p: Record<string, Pos>): void
  select(s: Selection): void
  setMulti(ids: string[]): void
  focusOn(key: string): void
  flag(id: string, f: Flag | null): void
  setNote(id: string, text: string): void
  answer(objId: string, v: Answer): void
  useHint(): string | undefined
  useObjHint(objId: string): void
  submit(): void
  toggleTruth(): void
  relayout(): void
  clearGraph(): void
  setMinUsd(v: number): void
  addLog(text: string, kind?: LogEntry['kind']): void
  addLink(l: Omit<ManualLink, 'id'>): void
  removeLink(id: string): void
  runTrace(source: TraceSource, opts: TraceOptions): TraceResult | null
  clearTrace(): void
  revealTrace(): void
  runPath(from: string, to: string): boolean
  /** Révèle un ensemble de transactions en une seule étape d'annulation. */
  revealSet(txIds: string[], undoLabel: string, logText: string): void
  /** Avance l'horloge du mode temps réel (jamais en arrière). */
  advanceClock(to: number): void
  toggleWatch(id: string): void
  newView(copy: boolean): void
  switchView(id: string): void
  renameView(id: string, name: string): void
  deleteView(id: string): void
  exportCase(): CaseExport | null
  importCase(data: CaseExport): string
}

interface GraphSnapshot {
  addrPos: Record<string, Pos>
  txPos: Record<string, Pos>
  revealed: Record<string, true>
  links: ManualLink[]
  label: string
}

export interface SavedCase {
  templateId: string
  seed: number
  mode: Mode
  coverage: Coverage
  startedAt: number
  addrPos: Record<string, Pos>
  txPos: Record<string, Pos>
  revealed: Record<string, true>
  flags: Record<string, Flag>
  notes: Record<string, string>
  answers: Record<string, Answer>
  hintsUsed: number
  objHints: string[]
  log: LogEntry[]
  links?: ManualLink[]
  trace?: { source: TraceSource; opts: TraceOptions }
  live?: LiveClock
  watch?: string[]
  alerts?: WatchAlert[]
  views?: GraphView[]
  viewId?: string
  viewName?: string
  /** Temps d'analyse actif (ms) au moment de la sauvegarde. */
  elapsed?: number
}

const SAVE_KEY = 'spectra-active-case'

export function loadSavedCase(): SavedCase | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as SavedCase) : null
  } catch {
    return null
  }
}

function writeSave(s: SavedCase | null) {
  if (!s) clearTimeout(saveTimer)
  try {
    if (s) localStorage.setItem(SAVE_KEY, JSON.stringify(s))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    /* stockage indisponible : on continue sans sauvegarde */
  }
}

const MAX_TX_PER_EXPAND = 60
const MAX_COUNTERPARTS = 14

/** Masque une partie des attributions d'adresses de dépôt (mode « couverture partielle »). */
function applyCoverage(w: World) {
  for (const a of w.addresses.values()) {
    if (!a.tags.includes('deposit')) continue
    if (w.rng.chance(0.6)) w.hiddenAttribution.add(a.id)
  }
}

/**
 * Fenêtre du mode temps réel : l'horloge démarre 30 minutes après le premier
 * mouvement des fonds qui touche une adresse du dossier, et s'arrête au
 * dernier fait de l'affaire.
 */
function liveWindow(inst: ScenarioInstance): LiveClock {
  const w = inst.world
  const end = Math.max(...[...w.txs.values()].map((t) => t.time))
  const seeds = new Set(inst.seeds)
  const truth = inst.truth.path.map((id) => w.txs.get(id)).filter((t): t is NonNullable<typeof t> => !!t).sort((a, b) => a.time - b.time)
  const touches = (t: (typeof truth)[number]) =>
    t.inputs.some((i) => seeds.has(i.address)) || t.outputs.some((o) => seeds.has(o.address)) || t.transfers.some((x) => seeds.has(x.from) || seeds.has(x.to))
  const first = truth.find(touches) ?? truth[0]
  const start = Math.min(end, first ? first.time + 1800 : end)
  return { now: start, start, end }
}

function label(w: World, id: string): string {
  const at = attribution(w, id)
  return at.label ?? shortAddr(w.get(id).addr)
}

export const useGame = create<GameState>()((set, get) => ({
  template: null,
  inst: null,
  seed: 0,
  mode: 'standard',
  coverage: 'full',
  startedAt: 0,
  addrPos: {},
  txPos: {},
  revealed: {},
  selection: null,
  multi: [],
  flags: {},
  notes: {},
  answers: {},
  hintsUsed: 0,
  objHints: [],
  log: [],
  links: [],
  trace: null,
  pathHighlight: null,
  live: null,
  watch: [],
  alerts: [],
  views: [],
  viewId: 'v1',
  viewName: 'Graphe principal',
  minUsd: 0,
  showTruth: false,
  focus: null,
  layoutTick: 0,
  history: [],

  start(templateId, seed, opts = {}) {
    const template = scenarioById(templateId)
    if (!template) return
    const inst = template.generate(seed)
    const coverage = opts.coverage ?? 'full'
    if (coverage === 'partial') applyCoverage(inst.world)
    const live = opts.live ? liveWindow(inst) : null
    if (live) inst.world.setHorizon(live.now)
    const addrPos: Record<string, Pos> = {}
    inst.seeds.forEach((s, i) => (addrPos[s] = { x: 0, y: i * 110 - ((inst.seeds.length - 1) * 110) / 2 }))
    set({
      template, inst, seed, mode: opts.mode ?? 'standard', coverage, startedAt: Date.now(), finishedAt: undefined,
      addrPos, txPos: {}, revealed: {}, selection: inst.seeds[0] ? { kind: 'address', id: inst.seeds[0] } : null,
      multi: [], flags: {}, notes: {}, answers: {}, hintsUsed: 0, objHints: [], score: undefined, xpGained: undefined,
      log: [{ t: Date.now(), text: `Ouverture du dossier « ${inst.title} » (graine ${seed})${live ? ` en temps réel, horloge au ${fmtClock(live.now)}` : ''}`, kind: 'system' }],
      showTruth: false, focus: null, layoutTick: 0, minUsd: 0, links: [], history: [], xpNote: undefined,
      trace: null, pathHighlight: null, live, watch: [], alerts: [], views: [], viewId: 'v1', viewName: 'Graphe principal',
    })
  },

  resume(saved) {
    const template = scenarioById(saved.templateId)
    if (!template) return false
    const inst = template.generate(saved.seed)
    if (saved.coverage === 'partial') applyCoverage(inst.world)
    // On ne garde que ce qui existe encore (sécurité si le générateur a évolué)
    const addrPos = Object.fromEntries(Object.entries(saved.addrPos).filter(([k]) => inst.world.addresses.has(k)))
    const txPos = Object.fromEntries(Object.entries(saved.txPos).filter(([k]) => inst.world.txs.has(k)))
    const revealed = Object.fromEntries(Object.entries(saved.revealed).filter(([k]) => inst.world.txs.has(k))) as Record<string, true>
    const w = inst.world
    const live = saved.live ?? null
    if (live) w.setHorizon(live.now)
    const flags = Object.fromEntries(Object.entries(saved.flags).filter(([k]) => w.addresses.has(k))) as Record<string, Flag>
    const notes = Object.fromEntries(Object.entries(saved.notes).filter(([k]) => w.addresses.has(k) || w.txs.has(k)))
    const answers: Record<string, Answer> = {}
    for (const o of inst.objectives) {
      const v = saved.answers[o.id]
      if (v === undefined) continue
      if (o.type === 'address' && !w.addresses.has(String(v))) continue
      if (o.type === 'tx' && !w.txs.has(String(v))) continue
      if (o.type === 'entity' && !w.entities.has(String(v))) continue
      answers[o.id] = o.type === 'addresses' && Array.isArray(v) ? v.filter((a) => w.addresses.has(a)) : v
    }
    // Le chronomètre reprend là où il s'était arrêté (le temps hors application ne compte pas)
    const startedAt = Date.now() - (saved.elapsed ?? 0)
    const st = saved.trace
    const trace = st && w.txs.has(st.source.txId) && w.addresses.has(st.source.address)
      ? { ...st, result: traceFunds(w, st.source, st.opts) }
      : null
    set({
      template, inst, seed: saved.seed, mode: saved.mode, coverage: saved.coverage, startedAt, history: [], xpNote: undefined,
      finishedAt: undefined, addrPos, txPos, revealed, flags, notes, answers,
      hintsUsed: saved.hintsUsed, objHints: saved.objHints, log: saved.log, selection: null, multi: [], score: undefined,
      links: (saved.links ?? []).filter((l) => inst.world.addresses.has(l.source) && inst.world.addresses.has(l.target)),
      showTruth: false, focus: null, layoutTick: 0, trace, pathHighlight: null,
      live, watch: (saved.watch ?? []).filter((a) => w.addresses.has(a)), alerts: (saved.alerts ?? []).filter((a) => w.txs.has(a.txId)),
      views: (saved.views ?? []).map((v) => cleanView(w, v)), viewId: saved.viewId ?? 'v1', viewName: saved.viewName ?? 'Graphe principal',
    })
    return true
  },

  quit() {
    writeSave(null)
    set({ template: null, inst: null, selection: null, score: undefined })
  },

  addAddress(id, near, side = 1) {
    const s = get()
    if (!s.inst || s.addrPos[id]) {
      if (s.addrPos[id]) get().focusOn(aKey(id))
      return
    }
    const occupied = [...Object.values(s.addrPos), ...Object.values(s.txPos)]
    let base: Pos = { x: 0, y: 0 }
    if (near) {
      const p = isAKey(near) ? s.addrPos[idOf(near)] : s.txPos[idOf(near)]
      if (p) base = { x: p.x + side * 230, y: p.y }
    } else if (occupied.length) {
      const maxX = Math.max(...occupied.map((p) => p.x))
      base = { x: maxX + 230, y: 0 }
    }
    const pos = freeSpot(base, occupied)
    set({ addrPos: { ...s.addrPos, [id]: pos } })
    get().addLog(`Ajout de ${label(s.inst.world, id)} au graphe`, 'graph')
    get().focusOn(aKey(id))
  },

  expand(id, dir) {
    const s = get()
    if (!s.inst) return 0
    snapshot(dir === 'out' ? 'dépliage des sorties' : 'dépliage des entrées')
    const w = s.inst.world
    const anchor = s.addrPos[id]
    if (!anchor) return 0
    const side = dir === 'out' ? 1 : -1
    let txs = w.txsOf(id).filter((tx) => (dir === 'out' ? w.flowOut(tx, id) : w.flowIn(tx, id)).length > 0)
    const valueOf = (txId: string) => {
      const tx = w.tx(txId)
      return (dir === 'out' ? w.flowOut(tx, id) : w.flowIn(tx, id)).reduce((a, f) => a + usd(f.asset, f.value), 0)
    }
    const total = txs.length
    txs = txs.filter((tx) => valueOf(tx.id) >= s.minUsd)
    const filtered = total - txs.length
    let truncated = 0
    if (txs.length > MAX_TX_PER_EXPAND) {
      truncated = txs.length - MAX_TX_PER_EXPAND
      txs = [...txs].sort((a, b) => valueOf(b.id) - valueOf(a.id)).slice(0, MAX_TX_PER_EXPAND).sort((a, b) => a.time - b.time)
    }
    const addrPos = { ...s.addrPos }
    const txPos = { ...s.txPos }
    const revealed = { ...s.revealed }
    const occupied = () => [...Object.values(addrPos), ...Object.values(txPos)]
    let added = 0
    let yCursor = anchor.y - ((Math.min(txs.length, 8) - 1) * 80) / 2
    for (const tx of txs) {
      revealed[tx.id] = true
      if (tx.model === 'utxo') {
        let tp = txPos[tx.id]
        if (!tp) {
          tp = freeSpot({ x: anchor.x + side * 150, y: yCursor }, occupied(), 56)
          txPos[tx.id] = tp
          yCursor = tp.y + 80
        }
        const others = (dir === 'out' ? tx.outputs : tx.inputs).filter((io) => io.address !== id)
        const top = [...others].sort((a, b) => b.value - a.value).slice(0, MAX_COUNTERPARTS)
        let oy = tp.y - ((top.length - 1) * 74) / 2
        for (const io of top) {
          if (addrPos[io.address]) continue
          const p = freeSpot({ x: tp.x + side * 170, y: oy }, occupied())
          addrPos[io.address] = p
          oy = p.y + 74
          added++
        }
      } else {
        const legs = tx.transfers.filter((t) => (dir === 'out' ? t.from === id : t.to === id))
        for (const leg of legs.slice(0, MAX_COUNTERPARTS)) {
          const other = dir === 'out' ? leg.to : leg.from
          if (addrPos[other] || other === id) continue
          const p = freeSpot({ x: anchor.x + side * 240, y: yCursor }, occupied())
          addrPos[other] = p
          yCursor = p.y + 80
          added++
        }
      }
    }
    set({ addrPos, txPos, revealed })
    const parts = [`${dir === 'out' ? 'Sorties' : 'Entrées'} de ${label(w, id)} : ${txs.length} transaction(s), ${added} nouvelle(s) adresse(s)`]
    if (filtered) parts.push(`${filtered} masquée(s) par le filtre de montant`)
    if (truncated) parts.push(`${truncated} plus petite(s) non affichée(s)`)
    get().addLog(parts.join(' · '), 'graph')
    if (!total) useUi.getState().notify(dir === 'out' ? 'Aucune sortie : les fonds sont toujours sur cette adresse.' : 'Aucune entrée connue pour cette adresse.')
    else if (!txs.length) useUi.getState().notify(`${filtered} transaction(s) masquée(s) par le filtre de montant minimal.`)
    else if (!added) useUi.getState().notify('Toutes les contreparties sont déjà sur le graphe.')
    else if (truncated) useUi.getState().notify(`${truncated} petite(s) transaction(s) non affichée(s) (limite de ${MAX_TX_PER_EXPAND}).`)
    return txs.length
  },

  revealTx(txId, withCounterparts = true) {
    const s = get()
    if (!s.inst) return
    const w = s.inst.world
    const tx = w.tx(txId)
    if (!w.visible(tx)) {
      useUi.getState().notify(`Transaction pas encore confirmée à l'heure de l'horloge (${fmtClock(w.horizon)}).`)
      return
    }
    snapshot('ajout de transaction')
    const addrPos = { ...s.addrPos }
    const txPos = { ...s.txPos }
    const revealed = { ...s.revealed, [txId]: true as const }
    const occupied = () => [...Object.values(addrPos), ...Object.values(txPos)]
    const involved = tx.model === 'utxo' ? [...tx.inputs.map((i) => i.address), ...tx.outputs.map((o) => o.address)] : tx.transfers.flatMap((t) => [t.from, t.to])
    const known = involved.map((a) => addrPos[a]).filter(Boolean)
    const center: Pos = known.length ? { x: known.reduce((s2, p) => s2 + p.x, 0) / known.length, y: known.reduce((s2, p) => s2 + p.y, 0) / known.length } : { x: Math.max(0, ...occupied().map((p) => p.x)) + 230, y: 0 }
    if (tx.model === 'utxo' && !txPos[txId]) {
      const inX = tx.inputs.map((i) => addrPos[i.address]?.x).filter((x): x is number => x !== undefined)
      txPos[txId] = freeSpot({ x: inX.length ? Math.max(...inX) + 150 : center.x, y: center.y }, occupied(), 56)
    }
    if (withCounterparts) {
      const tp = txPos[txId] ?? center
      if (tx.model === 'utxo') {
        tx.inputs.slice(0, MAX_COUNTERPARTS).forEach((i, k) => {
          if (!addrPos[i.address]) addrPos[i.address] = freeSpot({ x: tp.x - 170, y: tp.y + k * 74 }, occupied())
        })
        tx.outputs.slice(0, MAX_COUNTERPARTS).forEach((o, k) => {
          if (!addrPos[o.address]) addrPos[o.address] = freeSpot({ x: tp.x + 170, y: tp.y + k * 74 }, occupied())
        })
      } else {
        tx.transfers.forEach((t, k) => {
          if (!addrPos[t.from]) addrPos[t.from] = freeSpot({ x: tp.x - 120, y: tp.y + k * 80 }, occupied())
          if (!addrPos[t.to]) addrPos[t.to] = freeSpot({ x: tp.x + 240, y: tp.y + k * 80 }, occupied())
        })
      }
    }
    set({ addrPos, txPos, revealed })
    get().addLog(`Transaction ${shortAddr(tx.hash, 8)} (${CHAINS[tx.chain].short}) ajoutée au graphe`, 'graph')
    get().focusOn(tx.model === 'utxo' ? tKey(txId) : aKey(involved[involved.length - 1]))
  },

  removeNode(key) {
    get().removeNodes([key])
  },

  removeNodes(keys) {
    const s = get()
    if (!s.inst || !keys.length) return
    snapshot(keys.length > 1 ? `retrait de ${keys.length} nœuds` : 'retrait d\'un nœud')
    const w = s.inst.world
    const addrPos = { ...s.addrPos }
    const txPos = { ...s.txPos }
    const revealed = { ...s.revealed }
    for (const key of keys) {
      if (isAKey(key)) delete addrPos[idOf(key)]
      else {
        delete txPos[idOf(key)]
        delete revealed[idOf(key)]
      }
    }
    // Transactions devenues orphelines (plus aucune extrémité visible) : on les retire aussi
    for (const txId of Object.keys(revealed)) {
      const tx = w.txs.get(txId)
      if (!tx) continue
      const ends = tx.model === 'utxo' ? [...tx.inputs.map((i) => i.address), ...tx.outputs.map((o) => o.address)] : tx.transfers.flatMap((t) => [t.from, t.to])
      const visible = ends.filter((a) => addrPos[a]).length
      if (visible === 0 || (tx.model === 'account' && !tx.transfers.some((t) => addrPos[t.from] && addrPos[t.to]))) {
        delete revealed[txId]
        delete txPos[txId]
      }
    }
    const sel = s.selection
    const selGone = (sel?.kind === 'address' && !addrPos[sel.id]) || (sel?.kind === 'tx' && !revealed[sel.id] && txPos[sel.id] === undefined && s.txPos[sel.id] !== undefined)
    set({ addrPos, txPos, revealed, selection: selGone ? null : sel, multi: s.multi.filter((m) => addrPos[m]) })
  },

  undo() {
    const s = get()
    const last = s.history[s.history.length - 1]
    if (!last) {
      useUi.getState().notify('Rien à annuler.')
      return
    }
    set({ addrPos: last.addrPos, txPos: last.txPos, revealed: last.revealed, links: last.links, history: s.history.slice(0, -1), multi: [] })
    get().addLog(`Annulation : ${last.label}`, 'graph')
    useUi.getState().notify(`Annulé : ${last.label}`)
  },

  setPositions(p) {
    const s = get()
    const addrPos = { ...s.addrPos }
    const txPos = { ...s.txPos }
    for (const [k, v] of Object.entries(p)) {
      if (isAKey(k)) {
        if (addrPos[idOf(k)]) addrPos[idOf(k)] = v
      } else if (txPos[idOf(k)]) txPos[idOf(k)] = v
    }
    set({ addrPos, txPos })
  },

  select: (selection) => set({ selection }),
  setMulti: (multi) => set({ multi }),
  focusOn: (key) => set((s) => ({ focus: { key, n: (s.focus?.n ?? 0) + 1 } })),

  flag(id, f) {
    const s = get()
    const flags = { ...s.flags }
    if (f) flags[id] = f
    else delete flags[id]
    set({ flags })
    if (s.inst) get().addLog(f ? `${label(s.inst.world, id)} marquée « ${FLAG_META[f].label} »` : `Marquage retiré de ${label(s.inst.world, id)}`, 'flag')
  },

  setNote: (id, text) => set((s) => ({ notes: { ...s.notes, [id]: text } })),

  answer(objId, v) {
    set((s) => ({ answers: { ...s.answers, [objId]: v } }))
  },

  useHint() {
    const s = get()
    if (!s.inst || s.mode === 'examen') return undefined
    const h = s.inst.hints[s.hintsUsed]
    if (!h) return undefined
    set({ hintsUsed: s.hintsUsed + 1 })
    get().addLog(`Indice n°${s.hintsUsed + 1} consulté`, 'hint')
    return h
  },

  useObjHint(objId) {
    const s = get()
    if (s.mode === 'examen' || s.objHints.includes(objId)) return
    set({ objHints: [...s.objHints, objId] })
    get().addLog(`Indice d'objectif consulté (${objId})`, 'hint')
  },

  submit() {
    const s = get()
    if (!s.inst || !s.template) return
    const score = scoreCase(s.inst.objectives, s.answers, s.hintsUsed, s.objHints)
    const finishedAt = Date.now()
    const base = DIFFICULTY[s.template.difficulty].xp
    const potential = Math.round(base * score.pct * (s.mode === 'examen' ? 1.5 : 1) * (s.coverage === 'partial' ? 1.25 : 1))
    // Rejouer la même graine ne rapporte que l'amélioration par rapport au meilleur essai
    const prevBest = useProfile.getState().cases.filter((c) => c.templateId === s.template!.id && c.seed === s.seed).reduce((m, c) => Math.max(m, c.xpPotential ?? c.xp), 0)
    const xp = Math.max(0, potential - prevBest)
    const xpNote = prevBest ? (xp ? `Amélioration de votre meilleur essai sur cette graine (+${xp} XP)` : 'Graine déjà résolue avec un meilleur score : pas d\'XP supplémentaire') : undefined
    useProfile.getState().addCase({
      xpPotential: potential,
      templateId: s.template.id, seed: s.seed, score: score.total, max: score.max, grade: score.grade, date: finishedAt,
      durationSec: Math.round((finishedAt - s.startedAt) / 1000), difficulty: s.template.difficulty, skills: s.template.skills, xp, mode: s.mode,
    })
    writeSave(null)
    set({ score, finishedAt, xpGained: xp, xpNote })
    get().addLog(`Rapport remis : ${score.total}/${score.max} (${score.grade})`, 'system')
  },

  toggleTruth() {
    const s = get()
    if (!s.inst) return
    if (!s.showTruth) {
      snapshot('révélation du flux réel')
      const before = get().history.length
      for (const txId of s.inst.truth.path) if (!get().revealed[txId]) get().revealTx(txId, true)
      // Une seule étape d'annulation pour toute la révélation
      set((st) => ({ history: st.history.slice(0, before), showTruth: true, layoutTick: st.layoutTick + 1 }))
    } else set({ showTruth: false })
  },

  relayout() {
    const s = get()
    if (!s.inst) return
    snapshot('réorganisation')
    const w = s.inst.world
    const nodes = [...Object.keys(s.addrPos).map(aKey), ...Object.keys(s.txPos).map(tKey)]
    const edges = [...computeEdges(w, s.addrPos, s.txPos, s.revealed), ...extraLinks(w, s.addrPos, s.revealed, s.links)]
    const firstTime = (k: string) => {
      if (!isAKey(k)) return w.txs.get(idOf(k))?.time ?? 0
      return w.txsOf(idOf(k))[0]?.time ?? 0
    }
    const pos = layeredLayout(nodes, edges, firstTime)
    get().setPositions(pos)
    set({ layoutTick: s.layoutTick + 1 })
  },

  clearGraph() {
    const s = get()
    if (!s.inst) return
    snapshot('réinitialisation du graphe')
    const addrPos: Record<string, Pos> = {}
    s.inst.seeds.forEach((id, i) => (addrPos[id] = { x: 0, y: i * 110 }))
    set({ addrPos, txPos: {}, revealed: {}, selection: null, multi: [] })
    get().addLog('Graphe réinitialisé', 'graph')
  },

  setMinUsd: (minUsd) => set({ minUsd }),

  addLink(l) {
    const s = get()
    if (s.links.some((x) => x.source === l.source && x.target === l.target)) return
    snapshot('lien de corrélation')
    set({ links: [...s.links, { ...l, id: `L${Date.now().toString(36)}${s.links.length}` }] })
    if (s.inst) get().addLog(`Lien de corrélation posé : ${label(s.inst.world, l.source)} → ${label(s.inst.world, l.target)}`, 'tool')
  },

  removeLink(id) {
    snapshot('suppression d\'un lien')
    set((s) => ({ links: s.links.filter((l) => l.id !== id) }))
  },

  runTrace(source, opts) {
    const s = get()
    if (!s.inst) return null
    const w = s.inst.world
    const result = traceFunds(w, source, opts)
    set({ trace: { source, opts, result } })
    const ends = result.endpoints.slice(0, 3).map((e) => e.entity.name).join(', ')
    get().addLog(
      `Traçage ${TRACE_METHODS[opts.method].short} depuis ${label(w, source.address)} : ${fmtUsd0(result.sourceUsd)} suivis` +
        (ends ? `, destinations ${ends}` : '') +
        (result.stillHeld.length ? `, ${result.stillHeld.length} adresse(s) détiennent encore des fonds` : ''),
      'tool',
    )
    return result
  },

  clearTrace() {
    set({ trace: null, pathHighlight: null })
  },

  revealTrace() {
    const t = get().trace
    if (!t) return
    revealMany(t.result.path, 'flux tracé', 'Flux tracé affiché dans le graphe')
  },

  runPath(from, to) {
    const s = get()
    if (!s.inst) return false
    const w = s.inst.world
    const p = findPath(w, from, to, 10)
    if (!p) {
      useUi.getState().notify(`Aucun chemin de ${label(w, from)} vers ${label(w, to)} (10 sauts au plus, dans l'ordre chronologique).`)
      get().addLog(`Recherche de chemin ${label(w, from)} → ${label(w, to)} : aucun résultat`, 'tool')
      return false
    }
    set({ pathHighlight: { from, to, txIds: p.txIds } })
    revealMany(p.txIds, 'chemin', `Chemin trouvé ${label(w, from)} → ${label(w, to)} : ${p.addresses.length - 1} saut(s)`)
    return true
  },

  advanceClock(to) {
    const s = get()
    if (!s.inst || !s.live) return
    const w = s.inst.world
    const from = s.live.now
    const now = Math.min(s.live.end, Math.max(from, Math.round(to)))
    if (now === from) return
    w.setHorizon(now)
    const alerts: WatchAlert[] = []
    for (const id of s.watch) {
      for (const tx of w.txsOf(id)) {
        if (tx.time <= from || tx.time > now) continue
        const out = w.flowOut(tx, id).reduce((a, f) => a + usd(f.asset, f.value), 0)
        const inn = w.flowIn(tx, id).reduce((a, f) => a + usd(f.asset, f.value), 0)
        alerts.push({ id: `${tx.id}|${id}`, time: tx.time, address: id, txId: tx.id, dir: out > inn ? 'out' : 'in', usd: Math.abs(out - inn) || Math.max(out, inn) })
      }
    }
    alerts.sort((a, b) => a.time - b.time)
    const trace = s.trace ? { ...s.trace, result: traceFunds(w, s.trace.source, s.trace.opts) } : null
    set({ live: { ...s.live, now }, alerts: [...s.alerts, ...alerts].slice(-300), trace })
    get().addLog(`Horloge avancée au ${fmtClock(now)}${alerts.length ? ` : ${alerts.length} mouvement(s) sur les adresses surveillées` : ''}`, 'tool')
    if (alerts.length) {
      const a = alerts[alerts.length - 1]
      useUi.getState().notify(`⚠ ${label(w, a.address)} ${a.dir === 'out' ? 'envoie' : 'reçoit'} ${fmtUsd0(a.usd)}${alerts.length > 1 ? ` (+ ${alerts.length - 1} autre(s) mouvement(s))` : ''}`)
    } else if (now === s.live.end) useUi.getState().notify('Fin des faits connus : plus aucune transaction après cette date.')
  },

  toggleWatch(id) {
    const s = get()
    if (!s.inst) return
    const on = !s.watch.includes(id)
    set({ watch: on ? [...s.watch, id] : s.watch.filter((x) => x !== id) })
    get().addLog(`${on ? 'Surveillance activée' : 'Surveillance levée'} : ${label(s.inst.world, id)}`, 'tool')
  },

  newView(copy) {
    const s = get()
    if (!s.inst) return
    const id = `v${Date.now().toString(36)}`
    const name = copy ? `${s.viewName} (copie)` : `Piste ${s.views.length + 2}`
    const seeds: Record<string, Pos> = {}
    s.inst.seeds.forEach((a, i) => (seeds[a] = { x: 0, y: i * 110 }))
    set({
      views: [...s.views, currentView(s)],
      viewId: id, viewName: name, history: [], selection: null, multi: [],
      ...(copy ? {} : { addrPos: seeds, txPos: {}, revealed: {}, links: [] }),
    })
    get().addLog(`Nouveau graphe « ${name} »${copy ? ' (copie)' : ''}`, 'graph')
  },

  switchView(id) {
    const s = get()
    const target = s.views.find((v) => v.id === id)
    if (!target || id === s.viewId) return
    set({
      views: [...s.views.filter((v) => v.id !== id), currentView(s)],
      viewId: target.id, viewName: target.name, addrPos: target.addrPos, txPos: target.txPos, revealed: target.revealed, links: target.links,
      history: [], selection: null, multi: [], layoutTick: s.layoutTick + 1,
    })
  },

  renameView(id, name) {
    const n = name.trim().slice(0, 40)
    if (!n) return
    if (id === get().viewId) set({ viewName: n })
    else set((s) => ({ views: s.views.map((v) => (v.id === id ? { ...v, name: n } : v)) }))
  },

  deleteView(id) {
    const s = get()
    if (id !== s.viewId) {
      set({ views: s.views.filter((v) => v.id !== id) })
      return
    }
    const next = s.views[0]
    if (!next) return
    set({
      views: s.views.slice(1), viewId: next.id, viewName: next.name, addrPos: next.addrPos, txPos: next.txPos, revealed: next.revealed, links: next.links,
      history: [], selection: null, multi: [], layoutTick: s.layoutTick + 1,
    })
    get().addLog(`Graphe « ${s.viewName} » supprimé`, 'graph')
  },

  exportCase() {
    const s = get()
    if (!s.inst || !s.template) return null
    const w = s.inst.world
    const ids = new Set([...Object.keys(s.flags), ...Object.keys(s.notes).filter((k) => w.addresses.has(k)), ...s.watch])
    return {
      format: 'spectra-case', version: 1, templateId: s.template.id, seed: s.seed, coverage: s.coverage, exportedAt: new Date().toISOString(),
      flags: s.flags, notes: s.notes, links: s.links, watch: s.watch, views: [currentView(s), ...s.views],
      addresses: Object.fromEntries([...ids].map((id) => [id, w.get(id).addr])),
    }
  },

  importCase(data) {
    const s = get()
    if (!s.inst || !s.template) return 'Aucun dossier ouvert.'
    if (data?.format !== 'spectra-case') return 'Fichier non reconnu : ce n\'est pas un export de dossier SPECTRA.'
    if (data.templateId !== s.template.id || data.seed !== s.seed) return `Cet export concerne une autre affaire (${data.templateId}, graine ${data.seed}).`
    const w = s.inst.world
    const flags = { ...s.flags }
    for (const [k, v] of Object.entries(data.flags ?? {})) if (w.addresses.has(k) && v in FLAG_META) flags[k] = v
    const notes = { ...s.notes }
    for (const [k, v] of Object.entries(data.notes ?? {})) {
      if (!(w.addresses.has(k) || w.txs.has(k)) || typeof v !== 'string') continue
      notes[k] = notes[k] && notes[k] !== v ? `${notes[k]}\n— Import —\n${v}` : v
    }
    const links = [...s.links]
    for (const l of data.links ?? []) if (w.addresses.has(l.source) && w.addresses.has(l.target) && !links.some((x) => x.source === l.source && x.target === l.target)) links.push(l)
    const watch = [...new Set([...s.watch, ...(data.watch ?? []).filter((a) => w.addresses.has(a))])]
    const imported = (data.views ?? []).map((v, i) => ({ ...cleanView(w, v), id: `v${Date.now().toString(36)}${i}`, name: `${v.name} (importé)` }))
    set({ flags, notes, links, watch, views: [...s.views, ...imported] })
    const n = Object.keys(data.flags ?? {}).length
    get().addLog(`Import de constatations : ${n} marquage(s), ${Object.keys(data.notes ?? {}).length} note(s), ${imported.length} graphe(s)`, 'tool')
    return ''
  },

  revealSet(txIds, undoLabel, logText) {
    if (get().inst) revealMany(txIds, undoLabel, logText)
  },

  addLog(text, kind = 'system') {
    set((s) => ({ log: [...s.log, { t: Date.now(), text, kind }].slice(-400) }))
  },
}))

function snapshot(label: string) {
  const s = useGame.getState()
  const snap: GraphSnapshot = { addrPos: s.addrPos, txPos: s.txPos, revealed: s.revealed, links: s.links, label }
  useGame.setState({ history: [...s.history, snap].slice(-60) })
}

function currentView(s: GameState): GraphView {
  return { id: s.viewId, name: s.viewName, addrPos: s.addrPos, txPos: s.txPos, revealed: s.revealed, links: s.links }
}

/** Ne garde d'un graphe sauvegardé ou importé que ce qui existe (et est déjà visible). */
function cleanView(w: World, v: GraphView): GraphView {
  return {
    id: String(v.id), name: String(v.name ?? 'Graphe').slice(0, 40),
    addrPos: Object.fromEntries(Object.entries(v.addrPos ?? {}).filter(([k]) => w.addresses.has(k))),
    txPos: Object.fromEntries(Object.entries(v.txPos ?? {}).filter(([k]) => w.txs.has(k) && w.visible(w.tx(k)))),
    revealed: Object.fromEntries(Object.entries(v.revealed ?? {}).filter(([k]) => w.txs.has(k) && w.visible(w.tx(k)))) as Record<string, true>,
    links: (v.links ?? []).filter((l) => w.addresses.has(l.source) && w.addresses.has(l.target)),
  }
}

const MAX_REVEAL = 220

/** Révèle plusieurs transactions en une seule étape d'annulation et une seule ligne de journal. */
function revealMany(txIds: string[], undoLabel: string, logText: string) {
  const g = useGame.getState()
  const todo = txIds.filter((id) => !g.revealed[id])
  if (todo.length > MAX_REVEAL) useUi.getState().notify(`Flux très étendu : seules les ${MAX_REVEAL} premières transactions sont affichées.`)
  snapshot(undoLabel)
  const before = useGame.getState().history.length
  const logBefore = useGame.getState().log.length
  for (const id of todo.slice(0, MAX_REVEAL)) useGame.getState().revealTx(id, true)
  useGame.getState().relayout()
  useGame.setState((st) => ({ history: st.history.slice(0, before), log: st.log.slice(0, logBefore) }))
  useGame.getState().addLog(logText, 'graph')
}

const fmtUsd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const fmtClock = (t: number) => new Date(t * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function currentSave(s: GameState): SavedCase | null {
  if (!s.inst || !s.template || s.score) return null
  return {
    templateId: s.template.id, seed: s.seed, mode: s.mode, coverage: s.coverage, startedAt: s.startedAt,
    addrPos: s.addrPos, txPos: s.txPos, revealed: s.revealed, flags: s.flags, notes: s.notes, answers: s.answers,
    hintsUsed: s.hintsUsed, objHints: s.objHints, log: s.log, links: s.links, elapsed: Date.now() - s.startedAt,
    trace: s.trace ? { source: s.trace.source, opts: s.trace.opts } : undefined,
    live: s.live ?? undefined, watch: s.watch, alerts: s.alerts, views: s.views, viewId: s.viewId, viewName: s.viewName,
  }
}

// Sauvegarde automatique de l'enquête en cours (reprise après rechargement).
let saveTimer: ReturnType<typeof setTimeout> | undefined
useGame.subscribe((s) => {
  clearTimeout(saveTimer)
  if (!s.inst || !s.template || s.score) return
  saveTimer = setTimeout(() => {
    const data = currentSave(useGame.getState())
    if (data) writeSave(data)
  }, 600)
})

// Sauvegarde immédiate quand on quitte ou recharge la page
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const data = currentSave(useGame.getState())
    if (data) writeSave(data)
  })
}
