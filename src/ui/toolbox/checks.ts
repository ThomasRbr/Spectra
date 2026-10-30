// État des checklists des fiches réflexes, conservé localement (navigateur).
import { useCallback, useState } from 'react'

const KEY = 'spectra-toolbox-checks'

export type ChecksMap = Record<string, string[]>

export function loadChecks(): ChecksMap {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: ChecksMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
    }
    return out
  } catch {
    return {}
  }
}

function saveChecks(m: ChecksMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* stockage indisponible : l'état reste en mémoire */
  }
}

/** Items cochés d'une fiche, avec bascule et remise à zéro. */
export function useFicheChecks(ficheId: string) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(loadChecks()[ficheId] ?? []))
  const persist = useCallback(
    (next: Set<string>) => {
      const all = loadChecks()
      if (next.size) all[ficheId] = [...next]
      else delete all[ficheId]
      saveChecks(all)
    },
    [ficheId],
  )
  const toggle = useCallback(
    (key: string) => {
      setChecked((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        persist(next)
        return next
      })
    },
    [persist],
  )
  const reset = useCallback(() => {
    setChecked(new Set())
    persist(new Set())
  }, [persist])
  return { checked, toggle, reset }
}
