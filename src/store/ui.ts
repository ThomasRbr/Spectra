import { create } from 'zustand'
import type { ChainId } from '../engine/chains'
import type { TraceSource } from '../engine/tracing'

export type Page = 'dashboard' | 'missions' | 'academy' | 'glossary' | 'profile' | 'workspace'

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
  leftTab: 'objectives' | 'evidence' | 'journal' | 'flags'
  correlator: { open: boolean; preset?: CorrelatorPreset }
  tracer: { open: boolean; preset?: TraceSource }
  requisition: { open: boolean; entityId?: string; addresses?: string[] }
  reportOpen: boolean
  briefingOpen: boolean
  paletteOpen: boolean
  hintOpen: boolean
  confirmSubmit: boolean
  toast: { text: string; n: number } | null
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
  requisition: { open: false },
  reportOpen: false,
  briefingOpen: false,
  paletteOpen: false,
  hintOpen: false,
  confirmSubmit: false,
  toast: null,
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
