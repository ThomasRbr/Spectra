// Présentation du graphe d'enquête : groupes repliables, annotations, nœuds
// épinglés, mode de mise en page et options d'affichage. Séparé de l'état de
// l'enquête (store/game.ts) : rien ici ne change les constatations, seulement
// la façon de les montrer. Sauvegardé par affaire et par graphe.
import { create } from 'zustand'
import type { Pos } from '../lib/graph'

export type LayoutMode = 'layers' | 'time' | 'lanes'
export type LabelMode = 'auto' | 'all' | 'minimal'
export type SizeMode = 'none' | 'volume' | 'balance'
export type Tool = 'select' | 'note' | 'box'

export interface GraphGroup {
  id: string
  label: string
  /** Origine du regroupement (pour l'icône et l'explication). */
  kind: 'cluster' | 'stake' | 'entity' | 'manual'
  /** Adresses (ids) membres. */
  members: string[]
  collapsed: boolean
  color?: string
}

export interface Annotation {
  id: string
  kind: 'note' | 'box'
  /** Position du coin haut gauche, en coordonnées du graphe. */
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
}

export interface ViewGraph {
  groups: GraphGroup[]
  annotations: Annotation[]
  pinned: Record<string, true>
  /** Position des groupes repliés et des agrégats (coordonnées du graphe). */
  groupPos: Record<string, Pos>
  /** Groupes automatiques (services, agrégats de contreparties) que l'enquêteur a dépliés. */
  expanded: Record<string, true>
}

export interface Lane {
  label: string
  color: string
  y0: number
  y1: number
}

export interface GraphOptions {
  mode: LayoutMode
  labels: LabelMode
  sizeBy: SizeMode
  /** Un swap s'affiche comme une seule arête de conversion (pools et routeurs masqués). */
  collapseSwaps: boolean
  /** Les contreparties sans intérêt d'une même adresse sont réunies en « +N ». */
  aggregate: boolean
  /** Les adresses d'un même service (3 ou plus) sont réunies en un seul nœud. */
  autoGroupServices: boolean
  badges: boolean
  minimap: boolean
}

const DEFAULT_OPTS: GraphOptions = { mode: 'layers', labels: 'auto', sizeBy: 'none', collapseSwaps: true, aggregate: true, autoGroupServices: false, badges: true, minimap: true }

const emptyView = (): ViewGraph => ({ groups: [], annotations: [], pinned: {}, groupPos: {}, expanded: {} })

interface GraphStore {
  caseKey: string | null
  viewId: string
  byView: Record<string, ViewGraph>
  opts: GraphOptions
  tool: Tool
  /** Mode focus : voisinage à `hops` sauts d'un nœud, le reste estompé. */
  focus: { key: string; hops: number } | null
  search: string
  /** Couloirs par chaîne calculés par la dernière mise en page « couloirs ». */
  lanes: Lane[]
  /** Échelle de temps de la mise en page chronologique (pour l'axe). */
  timeAxis: { t0: number; t1: number; x0: number; x1: number } | null

  view(): ViewGraph
  bind(caseKey: string | null, viewId: string): void
  setOpt<K extends keyof GraphOptions>(k: K, v: GraphOptions[K]): void
  setTool(t: Tool): void
  setFocus(f: { key: string; hops: number } | null): void
  setSearch(q: string): void
  setLayoutMeta(lanes: Lane[], timeAxis: GraphStore['timeAxis']): void

  addGroup(g: Omit<GraphGroup, 'id'>): string
  updateGroup(id: string, patch: Partial<GraphGroup>): void
  removeGroup(id: string): void
  setGroupPos(p: Record<string, Pos>): void
  toggleExpanded(key: string, on?: boolean): void
  togglePin(key: string): void

  addAnnotation(a: Omit<Annotation, 'id'>): string
  updateAnnotation(id: string, patch: Partial<Annotation>): void
  removeAnnotation(id: string): void
}

const storeKey = (caseKey: string) => `spectra-graph:${caseKey}`

function load(caseKey: string): { byView: Record<string, ViewGraph>; opts: GraphOptions } {
  try {
    const raw = localStorage.getItem(storeKey(caseKey))
    if (raw) {
      const d = JSON.parse(raw) as { byView?: Record<string, ViewGraph>; opts?: Partial<GraphOptions> }
      return { byView: d.byView ?? {}, opts: { ...DEFAULT_OPTS, ...(d.opts ?? {}) } }
    }
  } catch {
    /* stockage indisponible ou illisible : on repart de zéro */
  }
  return { byView: {}, opts: { ...DEFAULT_OPTS, ...loadPrefs() } }
}

/** Préférences d'affichage communes à toutes les affaires (dernier réglage choisi). */
function loadPrefs(): Partial<GraphOptions> {
  try {
    return JSON.parse(localStorage.getItem('spectra-graph-prefs') ?? '{}') as Partial<GraphOptions>
  } catch {
    return {}
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(s: GraphStore) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (s.caseKey) localStorage.setItem(storeKey(s.caseKey), JSON.stringify({ byView: s.byView, opts: s.opts }))
      localStorage.setItem('spectra-graph-prefs', JSON.stringify(s.opts))
    } catch {
      /* quota ou stockage indisponible : la présentation n'est simplement pas conservée */
    }
  }, 400)
}

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

export const useGraph = create<GraphStore>()((set, get) => {
  const patchView = (fn: (v: ViewGraph) => ViewGraph) => {
    const s = get()
    const cur = s.byView[s.viewId] ?? emptyView()
    set({ byView: { ...s.byView, [s.viewId]: fn(cur) } })
    persist(get())
  }
  return {
    caseKey: null,
    viewId: 'v1',
    byView: {},
    opts: { ...DEFAULT_OPTS, ...(typeof localStorage !== 'undefined' ? loadPrefs() : {}) },
    tool: 'select',
    focus: null,
    search: '',
    lanes: [],
    timeAxis: null,

    view() {
      const s = get()
      return s.byView[s.viewId] ?? emptyView()
    },
    bind(caseKey, viewId) {
      const s = get()
      if (caseKey === s.caseKey) {
        if (viewId !== s.viewId) set({ viewId, focus: null })
        return
      }
      if (!caseKey) {
        set({ caseKey: null, viewId, byView: {}, focus: null, search: '', lanes: [], timeAxis: null })
        return
      }
      const d = load(caseKey)
      set({ caseKey, viewId, byView: d.byView, opts: d.opts, focus: null, search: '', lanes: [], timeAxis: null, tool: 'select' })
    },
    setOpt(k, v) {
      set({ opts: { ...get().opts, [k]: v } })
      persist(get())
    },
    setTool: (tool) => set({ tool }),
    setFocus: (focus) => set({ focus }),
    setSearch: (search) => set({ search }),
    setLayoutMeta: (lanes, timeAxis) => set({ lanes, timeAxis }),

    addGroup(g) {
      const id = uid('g')
      patchView((v) => ({ ...v, groups: [...v.groups.map((x) => ({ ...x, members: x.members.filter((m) => !g.members.includes(m)) })).filter((x) => x.members.length > 1), { ...g, id }] }))
      return id
    },
    updateGroup(id, patch) {
      patchView((v) => ({ ...v, groups: v.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
    },
    removeGroup(id) {
      patchView((v) => ({ ...v, groups: v.groups.filter((g) => g.id !== id) }))
    },
    setGroupPos(p) {
      patchView((v) => ({ ...v, groupPos: { ...v.groupPos, ...p } }))
    },
    toggleExpanded(key, on) {
      patchView((v) => {
        const expanded = { ...v.expanded }
        const next = on ?? !expanded[key]
        if (next) expanded[key] = true
        else delete expanded[key]
        return { ...v, expanded }
      })
    },
    togglePin(key) {
      patchView((v) => {
        const pinned = { ...v.pinned }
        if (pinned[key]) delete pinned[key]
        else pinned[key] = true
        return { ...v, pinned }
      })
    },

    addAnnotation(a) {
      const id = uid('n')
      patchView((v) => ({ ...v, annotations: [...v.annotations, { ...a, id }] }))
      return id
    },
    updateAnnotation(id, patch) {
      patchView((v) => ({ ...v, annotations: v.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
    },
    removeAnnotation(id) {
      patchView((v) => ({ ...v, annotations: v.annotations.filter((a) => a.id !== id) }))
    },
  }
})

export const ANNOTATION_COLORS = ['#facc15', '#7ea6ff', '#3fc7a4', '#fb7185', '#c084fc', '#f3f5f7']
