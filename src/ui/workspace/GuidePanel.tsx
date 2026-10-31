import { useEffect, useState } from 'react'
import type { GuideCheck, GuideStep } from '../../scenarios/types'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { evaluate } from '../../lib/scoring'
import { aKey, tKey } from '../../lib/graph'
import { Icon, RichText } from '../common'

type GameState = ReturnType<typeof useGame.getState>

/** Une étape est-elle validée par l'état actuel de l'enquête ? */
function checkDone(c: GuideCheck, g: GameState, index: number): boolean {
  switch (c.kind) {
    case 'onGraph':
      return !!g.addrPos[c.address]
    case 'txRevealed':
      return !!g.revealed[c.tx]
    case 'selected':
      return !!g.guideMarks[`sel:${c.id}`]
    case 'flagged':
      return c.flag ? g.flags[c.address] === c.flag : !!g.flags[c.address]
    case 'answered': {
      const v = g.answers[c.objective]
      return v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)
    }
    case 'correct': {
      const o = g.inst?.objectives.find((x) => x.id === c.objective)
      return !!o && evaluate(o, g.answers[c.objective]).status === 'correct'
    }
    case 'tool':
      return !!g.guideMarks[`tool:${c.tool}`]
    case 'manual':
      return !!g.guideMarks[`step:${index}`]
  }
}

/** Repère les outils ouverts pour valider les étapes « tool ». */
function useToolMarks() {
  useEffect(() => {
    const mark = (k: string) => useGame.getState().markGuide(`tool:${k}`)
    const scan = (u: ReturnType<typeof useUi.getState>) => {
      if (u.correlator.open) mark('correlator')
      if (u.paletteOpen) mark('search')
      if (u.reportOpen) mark('report')
      if (u.requisition.open) mark('requisition')
    }
    scan(useUi.getState())
    return useUi.subscribe(scan)
  }, [])
  // La frise compte dès qu'une période est filtrée
  useEffect(
    () =>
      useUi.subscribe((u) => {
        if (u.timeRange) useGame.getState().markGuide('tool:timeline')
      }),
    [],
  )
}

/** Cible à mettre en évidence sur le graphe pour l'étape en cours. */
function focusTarget(c: GuideCheck): string | null {
  if (c.kind === 'onGraph' || c.kind === 'flagged') return aKey(c.address)
  if (c.kind === 'txRevealed') return tKey(c.tx)
  return null
}

export function GuidePanel({ steps }: { steps: GuideStep[] }) {
  useToolMarks()
  const g = useGame()
  const [tipOpen, setTipOpen] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const flags = steps.map((s, i) => checkDone(s.check, g, i))
  // Étape courante : la première non validée (les étapes suivantes restent visibles mais grisées)
  const current = flags.findIndex((f) => !f)
  const done = flags.filter(Boolean).length
  const allDone = current === -1

  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    setTipOpen(null)
  }, [current])

  const step = current >= 0 ? steps[current] : null
  const target = step ? focusTarget(step.check) : null
  const targetOnGraph = !!target && (target.startsWith('a:') ? !!g.addrPos[target.slice(2)] : !!g.txPos[target.slice(2)])

  return (
    <section aria-label="Mission guidée" className="w-[340px] overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-pop">
      <button className="block w-full px-4 pb-3 pt-3 text-left" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        <div className="flex items-center gap-2 text-meta">
          <Icon name="Compass" size={14} className="text-accent" />
          <span className="font-semibold text-ink-200">Mission guidée</span>
          <span className="ml-auto font-mono text-ink-400">{Math.min(done + 1, steps.length)} / {steps.length}</span>
          <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} className="text-ink-400" />
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        {collapsed && step && <div className="mt-2 truncate text-dense font-medium text-white">{step.title}</div>}
      </button>
      {!collapsed && (
        <div className="max-h-[min(60vh,560px)] overflow-y-auto px-4 pb-4">
          {allDone && (
            <div className="flex gap-2 rounded-lg bg-emerald-400/10 p-3 text-dense leading-relaxed text-emerald-200">
              <Icon name="PartyPopper" size={16} className="mt-0.5 shrink-0" />
              <span>Toutes les étapes sont faites. Vérifiez vos réponses puis remettez le rapport pour lire le débriefing.</span>
            </div>
          )}
          {step && (
            <div key={current} className="animate-fadein">
              <h3 className="text-title font-semibold leading-snug text-white">{step.title}</h3>
              <RichText text={step.text} className="mt-1.5 !text-dense [&_p:last-child]:mb-0 [&_p]:mb-2 [&_p]:text-ink-200" />
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {step.check.kind === 'manual' && (
                  <button className="btn-primary !px-3 !py-1.5" onClick={() => useGame.getState().markGuide(`step:${current}`)}>
                    <Icon name="Check" size={14} /> J'ai compris
                  </button>
                )}
                {targetOnGraph && (
                  <button className="btn-outline !px-2.5 !py-1.5" onClick={() => useGame.getState().focusOn(target!)}>
                    <Icon name="Crosshair" size={13} /> Montrer
                  </button>
                )}
                {step.tip && (
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => setTipOpen(tipOpen === current ? null : current)} aria-expanded={tipOpen === current}>
                    <Icon name="LifeBuoy" size={13} /> {tipOpen === current ? 'Masquer l\x27aide' : 'Je bloque'}
                  </button>
                )}
                {step.check.kind !== 'manual' && <span className="ml-auto text-micro text-ink-400">se valide tout seul</span>}
              </div>
              {tipOpen === current && step.tip && (
                <div className="mt-3 flex gap-2 rounded-lg bg-amber-400/10 p-3 animate-fadein">
                  <Icon name="Lightbulb" size={14} className="mt-0.5 shrink-0 text-amber-300" />
                  <RichText text={step.tip} className="!text-dense [&_p:last-child]:mb-0 [&_p]:text-ink-100" />
                </div>
              )}
            </div>
          )}
          <button className="mt-4 flex w-full items-center gap-1.5 border-t border-ink-700 pt-3 text-meta text-ink-300 hover:text-white" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            <Icon name={showAll ? 'ChevronUp' : 'ChevronDown'} size={13} /> {showAll ? 'Masquer les étapes' : 'Toutes les étapes'}
          </button>
          {showAll && (
            <ol className="mt-2 space-y-1">
              {steps.map((s, i) => (
                <li key={i} className={`flex items-center gap-2 text-meta ${i === current ? 'font-medium text-white' : flags[i] ? 'text-ink-400' : 'text-ink-300'}`}>
                  {flags[i] ? (
                    <Icon name="CircleCheck" size={14} className="shrink-0 text-emerald-400" />
                  ) : (
                    <span className={`grid h-[14px] w-[14px] shrink-0 place-items-center rounded-full font-mono text-[9px] ${i === current ? 'bg-accent text-accent-ink' : 'border border-ink-500'}`}>{i + 1}</span>
                  )}
                  <span className={flags[i] && i !== current ? 'line-through' : ''}>{s.title}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
