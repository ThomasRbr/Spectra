import { useEffect, useMemo, useRef, useState } from 'react'
import { LESSONS, TRACKS } from '../academy'
import { GLOSSARY } from '../academy/glossary'
import { FICHES, MODELES } from '../academy/toolbox'
import { CHAINS } from '../engine/chains'
import { SCENARIOS } from '../scenarios'
import { DIFFICULTY } from '../scenarios/types'
import { useUi, type Page } from '../store/ui'
import { Icon } from './common'

// Recherche globale (Ctrl K) : pages, missions, leçons, termes du glossaire,
// fiches réflexes et modèles. Remplace la page Glossaire comme point d'entrée.

interface Hit {
  id: string
  group: string
  icon: string
  title: string
  sub?: string
  hay: string
  run(): void
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function page(id: Page) {
  if (id === 'academy') useUi.getState().set({ lessonId: null, academy: { kind: 'home' } })
  useUi.getState().setPage(id)
}

function buildIndex(): Hit[] {
  const hits: Hit[] = []
  const pages: [Page, string, string][] = [
    ['dashboard', 'Bureau', 'House'],
    ['missions', 'Missions', 'Crosshair'],
    ['sandbox', 'Bac à sable', 'FlaskConical'],
    ['academy', 'Académie', 'GraduationCap'],
    ['toolbox', 'Terrain : fiches et modèles', 'BriefcaseBusiness'],
    ['glossary', 'Glossaire', 'BookA'],
    ['profile', 'Profil et réglages', 'UserRound'],
  ]
  for (const [id, title, icon] of pages) hits.push({ id: `p-${id}`, group: 'Aller à', icon, title, hay: norm(title), run: () => page(id) })
  for (const s of SCENARIOS)
    hits.push({
      id: `m-${s.id}`, group: 'Missions', icon: 'Crosshair', title: s.title,
      sub: `${DIFFICULTY[s.difficulty].label} · ${s.chains.map((c) => CHAINS[c].short).join(', ')}`,
      hay: norm(`${s.title} ${s.tagline}`),
      run: () => {
        useUi.getState().set({ intent: { kind: 'mission', id: s.id } })
        page('missions')
      },
    })
  for (const l of LESSONS)
    hits.push({ id: `l-${l.id}`, group: 'Leçons', icon: 'BookOpenText', title: l.title, sub: `Niveau ${l.level} · ${TRACKS[l.track]?.label ?? l.track} · ${l.minutes} min`, hay: norm(`${l.title} ${l.summary}`), run: () => useUi.getState().openLesson(l.id) })
  for (const g of GLOSSARY)
    hits.push({
      id: `g-${g.term}`, group: 'Glossaire', icon: 'BookA', title: g.term, sub: g.def, hay: norm(`${g.term} ${g.def}`),
      run: () => {
        useUi.getState().set({ intent: { kind: 'glossary', term: g.term } })
        page('glossary')
      },
    })
  for (const f of FICHES)
    hits.push({
      id: `f-${f.id}`, group: 'Fiches réflexes', icon: f.icon, title: f.title, sub: f.summary, hay: norm(`${f.title} ${f.summary}`),
      run: () => {
        useUi.getState().set({ intent: { kind: 'fiche', id: f.id } })
        page('toolbox')
      },
    })
  for (const m of MODELES)
    hits.push({
      id: `d-${m.id}`, group: 'Modèles de documents', icon: m.icon, title: m.title, sub: m.description, hay: norm(`${m.title} ${m.description}`),
      run: () => {
        useUi.getState().set({ intent: { kind: 'modele', id: m.id } })
        page('toolbox')
      },
    })
  return hits
}

function score(h: Hit, words: string[]): number {
  const t = norm(h.title)
  let s = 0
  for (const w of words) {
    if (!h.hay.includes(w)) return -1
    s += t.startsWith(w) ? 6 : t.includes(w) ? 3 : 1
  }
  return s
}

export function GlobalSearch() {
  const open = useUi((s) => s.searchOpen)
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  const index = useMemo(buildIndex, [])
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    if (!words.length) return index.filter((h) => h.group === 'Aller à')
    const scored = index.map((h) => ({ h, s: score(h, words) })).filter((x) => x.s >= 0)
    scored.sort((a, b) => b.s - a.s)
    // Huit résultats au plus par groupe, groupes dans l'ordre du meilleur score.
    const per = new Map<string, Hit[]>()
    for (const { h } of scored) {
      const arr = per.get(h.group) ?? []
      if (arr.length < 8) arr.push(h)
      per.set(h.group, arr)
    }
    return [...per.values()].flat()
  }, [q, index])

  useEffect(() => {
    if (open) {
      setQ('')
      setCur(0)
    }
  }, [open])
  useEffect(() => setCur(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cur])

  if (!open) return null
  const close = () => useUi.getState().set({ searchOpen: false })
  const run = (h: Hit) => {
    close()
    h.run()
  }

  return (
    <div data-modal className="theme-ink fixed inset-0 z-[60] flex items-start justify-center bg-black/55 px-4 pt-[12vh] animate-fadein" onMouseDown={close}>
      <div role="dialog" aria-label="Recherche globale" className="w-full max-w-[640px] overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ink-700 px-4">
          <Icon name="Search" size={17} className="text-ink-300" />
          <input
            autoFocus
            aria-label="Rechercher"
            className="h-14 flex-1 bg-transparent text-title text-white outline-none placeholder:text-ink-400 focus-visible:outline-none"
            placeholder="Mission, leçon, terme, fiche réflexe…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              else if (e.key === 'ArrowDown') (e.preventDefault(), setCur((c) => Math.min(results.length - 1, c + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setCur((c) => Math.max(0, c - 1)))
              else if (e.key === 'Enter' && results[cur]) run(results[cur])
            }}
          />
          <span className="kbd">Échap</span>
        </div>
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto p-2">
          {!results.length && <div className="px-3 py-10 text-center text-dense text-ink-300">Aucun résultat pour « {q} ».</div>}
          {results.map((h, i) => (
            <div key={h.id}>
              {(i === 0 || results[i - 1].group !== h.group) && <div className="px-3 pb-1 pt-3 text-meta font-semibold text-ink-400">{h.group}</div>}
              <button
                data-i={i}
                onMouseMove={() => setCur(i)}
                onClick={() => run(h)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === cur ? 'bg-ink-700' : ''}`}
              >
                <Icon name={h.icon} size={16} className={i === cur ? 'text-white' : 'text-ink-300'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-white">{h.title}</span>
                  {h.sub && <span className="block truncate text-meta text-ink-400">{h.sub}</span>}
                </span>
                {i === cur && <Icon name="CornerDownLeft" size={14} className="text-ink-400" />}
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-4 border-t border-ink-700 px-4 py-2 text-meta text-ink-400">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> naviguer</span>
          <span><span className="kbd">Entrée</span> ouvrir</span>
        </div>
      </div>
    </div>
  )
}
