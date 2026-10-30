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

  useEffect(() => {
    setTipOpen(null)
  }, [current])

  return (
    <div className="overflow-hidden rounded-xl border border-accent/40 bg-gradient-to-br from-accent/[0.08] to-transparent">
      <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setCollapsed((c) => !c)}>
        <Icon name="Compass" size={15} className="text-accent" />
        <span className="text-[12.5px] font-semibold text-white">Mission guidée</span>
        <span className="font-mono text-[10.5px] text-ink-300">{done}/{steps.length}</span>
        <div className="ml-2 h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} className="text-ink-400" />
      </button>
      {!collapsed && (
        <div className="space-y-1.5 px-3 pb-3">
          {allDone && (
            <div className="flex gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-2.5 text-[12px] text-emerald-50">
              <Icon name="PartyPopper" size={15} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>Toutes les étapes sont faites. Vérifiez vos réponses puis remettez le rapport pour lire le débriefing.</span>
            </div>
          )}
          {steps.map((s, i) => {
            const isDone = flags[i]
            const isCur = i === current
            if (!isCur && !isDone && i > current + 1 && current !== -1) {
              // Étapes lointaines : titre seul
              return (
                <div key={i} className="flex items-center gap-2 px-1 text-[11px] text-ink-500">
                  <span className="grid h-4 w-4 place-items-center rounded-full border border-ink-600 font-mono text-[9px]">{i + 1}</span>
                  {s.title}
                </div>
              )
            }
            if (isDone && !isCur) {
              return (
                <div key={i} className="flex items-center gap-2 px-1 text-[11px] text-ink-400">
                  <Icon name="CircleCheck" size={14} className="shrink-0 text-emerald-400" />
                  <span className="line-through">{s.title}</span>
                </div>
              )
            }
            const target = focusTarget(s.check)
            return (
              <div key={i} className={`rounded-lg border p-2.5 ${isCur ? 'border-accent/50 bg-ink-900/80 shadow-glow' : 'border-ink-700 bg-ink-900/40 opacity-70'}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] ${isCur ? 'bg-accent text-ink-950' : 'border border-ink-500 text-ink-300'}`}>{i + 1}</span>
                  <span className="text-[12.5px] font-semibold text-white">{s.title}</span>
                </div>
                <RichText text={s.text} className="mt-1.5 !text-[12px] [&_p:last-child]:mb-0 [&_p]:mb-1.5" />
                {isCur && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.check.kind === 'manual' && (
                      <button className="btn-primary !px-2.5 !py-1 text-[11.5px]" onClick={() => useGame.getState().markGuide(`step:${i}`)}>
                        <Icon name="Check" size={12} /> J'ai compris
                      </button>
                    )}
                    {target && (target.startsWith('a:') ? !!g.addrPos[target.slice(2)] : !!g.txPos[target.slice(2)]) && (
                      <button className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => useGame.getState().focusOn(target)}>
                        <Icon name="Crosshair" size={12} /> Montrer sur le graphe
                      </button>
                    )}
                    {s.tip && (
                      <button className="btn-ghost !px-2 !py-1 text-[11px] text-yellow-200" onClick={() => setTipOpen(tipOpen === i ? null : i)}>
                        <Icon name="Lightbulb" size={12} /> {tipOpen === i ? 'Masquer l\'aide' : 'Je bloque'}
                      </button>
                    )}
                    {s.check.kind !== 'manual' && <span className="ml-auto text-[10px] text-ink-500">validation automatique</span>}
                  </div>
                )}
                {isCur && tipOpen === i && s.tip && (
                  <div className="mt-2 flex gap-1.5 rounded-md border border-yellow-400/30 bg-yellow-400/5 p-2 text-[11.5px] leading-relaxed text-yellow-50 animate-fadein">
                    <Icon name="Lightbulb" size={12} className="mt-0.5 shrink-0 text-yellow-300" />
                    <RichText text={s.tip} className="!text-[11.5px] [&_p:last-child]:mb-0" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
