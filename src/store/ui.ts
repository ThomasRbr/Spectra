import { create } from 'zustand'
import type { ChainId } from '../engine/chains'
import type { TraceSource } from '../engine/tracing'

export type Page = 'dashboard' | 'missions' | 'sandbox' | 'academy' | 'toolbox' | 'glossary' | 'profile' | 'workspace'

export type AcademyView =
  | { kind: 'home' }
  | { kind: 'paths' }
  | { kind: 'path'; id: string }
  | { kind: 'library' }
  | { kind: 'lesson'; id: string; pathId?: string }
  | { kind: 'practice' }
  | { kind: 'drill'; id: string; pathId?: string }
  | { kind: 'cards'; lessonId?: string }
  | { kind: 'exams' }
  | { kind: 'exam'; id: string; pathId?: string }
  | { kind: 'certs' }
  | { kind: 'certResult'; id: string }

/** Ouverture ciblée depuis la recherche globale, consommée par la page visée. */
export type Intent = { kind: 'mission'; id: string } | { kind: 'glossary'; term: string } | { kind: 'fiche'; id: string } | { kind: 'modele'; id: string }

export type ReadingTheme = 'paper' | 'ink'

export interface CorrelatorPreset {
  time: number
  usd: number
  chains?: ChainId[]
  entityId?: string
  excludeTx?: string
}

interface UiState {
  page: Page
  lessonId: string | null
  academy: AcademyView
  timeRange: [number, number] | null
  timelineOpen: boolean
  leftOpen: boolean
  rightOpen: boolean
  shortcutsOpen: boolean
  leftTab: 'objectives' | 'evidence' | 'journal' | 'flags' | 'watch'
  correlator: { open: boolean; preset?: CorrelatorPreset }
  tracer: { open: boolean; preset?: TraceSource }
  peel: { open: boolean; address?: string }
  demix: { open: boolean; address?: string }
  requisition: { open: boolean; entityId?: string; addresses?: string[] }
  reportOpen: boolean
  certReport: boolean
  briefingOpen: boolean
  paletteOpen: boolean
  hintOpen: boolean
  confirmSubmit: boolean
  toast: { text: string; n: number } | null
  /** Recherche globale (Ctrl K hors enquête). */
  searchOpen: boolean
  intent: Intent | null
  /** Thème des pages de lecture : Académie, Terrain, Glossaire. */
  readingTheme: ReadingTheme
  setReadingTheme(t: ReadingTheme): void
  setPage(p: Page): void
  openLesson(id: string | null, pathId?: string): void
  openAcademy(v: AcademyView): void
  setTimeRange(r: [number, number] | null): void
  set(p: Partial<UiState>): void
  notify(text: string): void
}

function initialPage(): Page {
  try {
    return (sessionStorage.getItem('spectra-page') as Page) || 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function initialTheme(): ReadingTheme {
  try {
    return localStorage.getItem('spectra-reading-theme') === 'ink' ? 'ink' : 'paper'
  } catch {
    return 'paper'
  }
}

function savePage(page: Page) {
  try {
    sessionStorage.setItem('spectra-page', page)
  } catch {
    /* stockage indisponible */
  }
}

export const useUi = create<UiState>()((set) => ({
  page: initialPage(),
  lessonId: null,
  academy: { kind: 'home' },
  timeRange: null,
  timelineOpen: true,
  leftOpen: true,
  rightOpen: true,
  shortcutsOpen: false,
  leftTab: 'objectives',
  correlator: { open: false },
  tracer: { open: false },
  peel: { open: false },
  demix: { open: false },
  requisition: { open: false },
  reportOpen: false,
  certReport: false,
  briefingOpen: false,
  paletteOpen: false,
  hintOpen: false,
  confirmSubmit: false,
  toast: null,
  searchOpen: false,
  intent: null,
  readingTheme: initialTheme(),
  setReadingTheme: (readingTheme) => {
    try {
      localStorage.setItem('spectra-reading-theme', readingTheme)
    } catch {
      /* stockage indisponible */
    }
    set({ readingTheme })
  },
  setPage: (page) => {
    savePage(page)
    set({ page })
  },
  openLesson: (lessonId, pathId) => {
    savePage('academy')
    set({ lessonId, page: 'academy', academy: lessonId ? { kind: 'lesson', id: lessonId, pathId } : { kind: 'home' } })
  },
  openAcademy: (academy) => {
    savePage('academy')
    set({ page: 'academy', academy })
  },
  setTimeRange: (timeRange) => set({ timeRange }),
  set: (p) => {
    if (p.page) savePage(p.page)
    set(p)
  },
  notify: (text) => set((s) => ({ toast: { text, n: (s.toast?.n ?? 0) + 1 } })),
}))
