import { useEffect, useMemo, useState } from 'react'
import { DRILLS, LEVELS, TRACKS, pathById, type DrillItem, type DrillVisual } from '../../academy'
import { CHAINS } from '../../engine/chains'
import { shortAddr } from '../../engine/addressgen'
import { randomSeed } from '../../engine/rng'
import { useProfile } from '../../store/profile'
import { useUi } from '../../store/ui'
import { ChainBadge, Empty, Icon, ProgressBar, RichText, fmtTime } from '../common'
import { FlowDiagram } from './Blocks'

// ── Visuels ────────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 8 })
}

export function DrillVisualView({ v }: { v: DrillVisual }) {
  if (v.type === 'address') {
    return <div className="break-all rounded-xl border border-ink-700 bg-ink-950/80 px-4 py-3 text-center font-mono text-[15px] tracking-wide text-cyan-100">{v.value}</div>
  }
  if (v.type === 'list') {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-3">
        {v.title && <div className="label mb-1.5">{v.title}</div>}
        <ul className="space-y-1">{v.items.map((it, i) => <li key={i} className="flex gap-2 text-[13px] text-ink-100"><span className="text-accent">•</span><span className="break-all">{it}</span></li>)}</ul>
      </div>
    )
  }
  if (v.type === 'flow') return <FlowDiagram nodes={v.nodes} edges={v.edges} />
  if (v.type === 'transfers') {
    return (
      <div className="overflow-hidden rounded-xl border border-ink-700">
        <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2"><ChainBadge chain={v.chain} /><span className="text-[11.5px] text-ink-400">{v.rows.length} transfert(s)</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-400">
              <tr><th className="px-3 py-1.5">De</th><th className="px-3 py-1.5">Vers</th><th className="px-3 py-1.5 text-right">Montant</th><th className="px-3 py-1.5">Tag / méthode</th>{v.rows.some((r) => r.time) && <th className="px-3 py-1.5">Date</th>}</tr>
            </thead>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={i} className="border-t border-ink-700/60">
                  <td className="px-3 py-1.5"><Party addr={r.from} label={r.fromLabel} /></td>
                  <td className="px-3 py-1.5"><Party addr={r.to} label={r.toLabel} /></td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-white">{fmtVal(r.value)} <span className="text-ink-400">{r.asset}</span></td>
                  <td className="px-3 py-1.5 font-mono text-[11.5px] text-cyan-200">{r.memo ?? r.method ?? '—'}</td>
                  {v.rows.some((x) => x.time) && <td className="whitespace-nowrap px-3 py-1.5 text-ink-400">{r.time ? fmtTime(r.time) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  // Transaction UTXO
  const tin = v.inputs.reduce((s, x) => s + x.value, 0)
  const tout = v.outputs.reduce((s, x) => s + x.value, 0)
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2">
        <ChainBadge chain={v.chain} />
        {v.hash && <span className="font-mono text-[11px] text-ink-300">{shortAddr(v.hash, 10)}</span>}
        {v.time && <span className="ml-auto text-[11px] text-ink-400">{fmtTime(v.time)}</span>}
      </div>
      <div className="grid gap-2 p-3 md:grid-cols-[1fr_auto_1fr]">
        <IoList title={`Entrées (${v.inputs.length})`} items={v.inputs} asset={v.asset} total={tin} />
        <div className="hidden items-center justify-center md:flex"><Icon name="ArrowRight" size={20} className="text-ink-500" /></div>
        <IoList title={`Sorties (${v.outputs.length})`} items={v.outputs} asset={v.asset} total={tout} numbered />
      </div>
      {v.fee !== undefined && <div className="border-t border-ink-700 px-3 py-1.5 text-right text-[11.5px] text-ink-400">Frais : <span className="font-mono text-ink-200">{fmtVal(v.fee)} {v.asset}</span></div>}
    </div>
  )
}

function Party({ addr, label }: { addr: string; label?: string }) {
  return (
    <div className="min-w-0">
      {label && <div className="truncate text-[11.5px] font-medium text-white">{label}</div>}
      <div className="truncate font-mono text-[11px] text-ink-300" title={addr}>{shortAddr(addr, 8)}</div>
    </div>
  )
}

function IoList({ title, items, asset, total, numbered }: { title: string; items: { address: string; value: number; label?: string }[]; asset: string; total: number; numbered?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-950/50">
      <div className="flex justify-between border-b border-ink-700/60 px-2.5 py-1.5 text-[10.5px] uppercase tracking-wider text-ink-400">
        <span>{title}</span>
        <span className="font-mono normal-case tracking-normal">{fmtVal(total)} {asset}</span>
      </div>
      {items.map((x, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-ink-700/40 px-2.5 py-1.5 last:border-0">
          {numbered && <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-ink-700 font-mono text-[10px] text-ink-200">{i + 1}</span>}
          <div className="min-w-0 flex-1">
            {x.label && <div className="truncate text-[11px] text-ink-200">{x.label}</div>}
            <div className="truncate font-mono text-[11.5px] text-cyan-100" title={x.address}>{x.address}</div>
          </div>
          <span className="shrink-0 font-mono text-[12px] text-white">{fmtVal(x.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Correction ─────────────────────────────────────────────────────────────

export function checkDrill(item: DrillItem, given: string | number | undefined): boolean {
  if (given === undefined || given === '') return false
  if (item.kind === 'choice') return Number(given) === item.answer
  if (item.kind === 'number') {
    const v = Number(String(given).replace(/\s/g, '').replace(',', '.'))
    const a = Number(item.answer)
    if (!Number.isFinite(v)) return false
    const tol = item.tolerance ?? 0.001
    return Math.abs(v - a) <= Math.max(Math.abs(a) * tol, 1e-12)
  }
  return String(given).trim().toLowerCase() === String(item.answer).trim().toLowerCase()
}

/** Question d'exercice (réutilisée par les examens). */
export function DrillQuestion({ item, value, onChange, reveal }: { item: DrillItem; value: string | number | undefined; onChange: (v: string | number) => void; reveal: boolean }) {
  const ok = reveal && checkDrill(item, value)
  return (
    <div className="space-y-3">
      <div className="whitespace-pre-line text-[15px] font-medium leading-snug text-white">{item.prompt}</div>
      {item.context && <div className="whitespace-pre-line text-[13px] leading-relaxed text-ink-300">{item.context}</div>}
      {item.visual && <DrillVisualView v={item.visual} />}
      {item.kind === 'choice' ? (
        <div className="grid gap-1.5">
          {item.options!.map((o, i) => {
            const chosen = Number(value) === i && value !== undefined
            const cls = reveal ? (i === item.answer ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-50' : chosen ? 'border-rose-400/60 bg-rose-400/10 text-rose-50' : 'border-ink-700 text-ink-300') : chosen ? 'border-accent/60 bg-accent/10 text-white' : 'border-ink-700 text-ink-100 hover:border-ink-500 hover:bg-ink-800/60'
            return (
              <button key={i} disabled={reveal} onClick={() => onChange(i)} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] transition ${cls}`}>
                <span className="mt-0.5 font-mono text-[11px] text-ink-400">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1 break-words">{o}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input className="input !py-2 font-mono" disabled={reveal} inputMode={item.kind === 'number' ? 'decimal' : 'text'} placeholder={item.kind === 'number' ? 'Votre réponse (virgule ou point)' : 'Votre réponse'} value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
          {item.unit && <span className="chip bg-ink-700 font-mono text-ink-200">{item.unit}</span>}
        </div>
      )}
      {reveal && (
        <div className={`flex gap-2 rounded-xl border p-3 text-[13px] leading-relaxed animate-fadein ${ok ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-50' : 'border-rose-400/30 bg-rose-400/5 text-ink-100'}`}>
          <Icon name={ok ? 'CircleCheck' : 'CircleX'} size={16} className={`mt-0.5 shrink-0 ${ok ? 'text-emerald-400' : 'text-rose-400'}`} />
          <div>
            {!ok && item.kind !== 'choice' && <div className="mb-1 font-mono text-white">Réponse attendue : {String(item.answer)}{item.unit ? ` ${item.unit}` : ''}</div>}
            <RichText text={item.explain} className="!text-[13px] [&_p:last-child]:mb-0 [&_p]:mb-2" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Catalogue et séance ────────────────────────────────────────────────────

export function PracticeHub() {
  const drills = useProfile((s) => s.drills)
  if (!DRILLS.length) return <Empty icon="Dumbbell" title="Exercices en préparation" sub="Les exercices générés seront disponibles très bientôt." />
  const byLevel = [0, 1, 2, 3, 4, 5].map((lv) => ({ lv, items: DRILLS.filter((d) => d.level === lv) })).filter((g) => g.items.length)
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="label text-accent">Entraînement</div>
      <h1 className="mt-1 text-3xl font-bold text-white">Exercices générés</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-300">Des questions courtes, générées à l'infini à partir du moteur de blockchain simulée. Idéal pour automatiser les réflexes : reconnaître une adresse, calculer des frais, repérer le rendu, choisir la bonne réquisition…</p>
      {byLevel.map((g) => (
        <section key={g.lv} className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: LEVELS[g.lv as 0].color }} />
            <h2 className="text-[15px] font-semibold text-white">{LEVELS[g.lv as 0].label}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((d) => {
              const r = drills[d.id]
              const acc = r && r.attempts ? r.correct / r.attempts : 0
              return (
                <button key={d.id} onClick={() => useUi.getState().openAcademy({ kind: 'drill', id: d.id })} className="group rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${TRACKS[d.track].color}18`, color: TRACKS[d.track].color }}><Icon name={d.icon} size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-white group-hover:text-accent">{d.title}</div>
                      <div className="text-[11px] text-ink-400">{TRACKS[d.track].label}</div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-300">{d.description}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-400">
                    <span>{r ? `${r.correct}/${r.attempts} justes` : 'Jamais tenté'}</span>
                    {r && <span>série max {r.bestStreak}</span>}
                    <span className="ml-auto font-mono" style={{ color: acc >= 0.8 ? '#34d399' : acc >= 0.5 ? '#facc15' : '#7a88a8' }}>{r ? `${Math.round(acc * 100)} %` : ''}</span>
                  </div>
                  {r && <ProgressBar value={acc} className="mt-1.5" color={acc >= 0.8 ? '#34d399' : '#22d3ee'} />}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function DrillRunner({ id, pathId }: { id: string; pathId?: string }) {
  const def = DRILLS.find((d) => d.id === id)
  const [seed, setSeed] = useState(() => randomSeed())
  const [value, setValue] = useState<string | number | undefined>(undefined)
  const [reveal, setReveal] = useState(false)
  const [session, setSession] = useState({ n: 0, ok: 0 })
  const rec = useProfile((s) => s.drills[id])
  const item = useMemo(() => (def ? def.generate(seed) : null), [def, seed])
  const path = pathId ? pathById(pathId) : undefined
  const target = path?.steps.find((s) => s.kind === 'drill' && s.id === id)
  const goal = target && target.kind === 'drill' ? target.target : undefined

  useEffect(() => {
    useProfile.getState().touchDay()
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && e.key !== 'Enter') return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (!reveal && value !== undefined && value !== '') validate()
        else if (reveal) nextItem()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (!def || !item) return <Empty icon="Dumbbell" title="Exercice introuvable" />
  const validate = () => {
    const ok = checkDrill(item, value)
    setReveal(true)
    setSession((s) => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }))
    const streak = useProfile.getState().recordDrill(id, ok)
    if (ok && streak > 0 && streak % 5 === 0) useUi.getState().notify(`Série de ${streak} bonnes réponses !`)
  }
  const nextItem = () => {
    setSeed(randomSeed())
    setValue(undefined)
    setReveal(false)
  }
  const ok = reveal && checkDrill(item, value)

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button className="btn-ghost -ml-2 mb-3 !px-2 text-[12px]" onClick={() => useUi.getState().openAcademy(path ? { kind: 'path', id: path.id } : { kind: 'practice' })}>
        <Icon name="ChevronLeft" size={14} /> {path ? path.title : 'Exercices'}
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${TRACKS[def.track].color}18`, color: TRACKS[def.track].color }}><Icon name={def.icon} size={21} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold text-white">{def.title}</h1>
          <div className="text-[12.5px] text-ink-400">{def.description}</div>
        </div>
        <div className="flex gap-2">
          <Pill label="Séance" value={`${session.ok}/${session.n}`} />
          <Pill label="Série" value={String(rec?.streak ?? 0)} accent />
          <Pill label="Total justes" value={String(rec?.correct ?? 0)} />
        </div>
      </div>
      {goal !== undefined && (
        <div className="mt-4 rounded-xl border border-ink-700/70 bg-ink-900/60 p-3">
          <div className="flex justify-between text-[12px] text-ink-300"><span>Objectif du parcours : {goal} bonnes réponses</span><span className="font-mono">{Math.min(goal, rec?.correct ?? 0)}/{goal}</span></div>
          <ProgressBar value={Math.min(1, (rec?.correct ?? 0) / goal)} className="mt-1.5" color={path?.color} />
          {(rec?.correct ?? 0) >= goal && path && (
            <button className="btn-primary mt-3 w-full" onClick={() => useUi.getState().openAcademy({ kind: 'path', id: path.id })}>Objectif atteint — retour au parcours <Icon name="ChevronRight" size={14} /></button>
          )}
        </div>
      )}
      <div key={seed} className="mt-5 rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 animate-fadein">
        <DrillQuestion item={item} value={value} onChange={setValue} reveal={reveal} />
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[11px] text-ink-500">Entrée pour {reveal ? 'continuer' : 'valider'}</span>
          {!reveal ? (
            <button className="btn-primary ml-auto" disabled={value === undefined || value === ''} onClick={validate}><Icon name="Check" size={15} /> Valider</button>
          ) : (
            <button className={`ml-auto ${ok ? 'btn-primary' : 'btn-outline'}`} onClick={nextItem}>Question suivante <Icon name="ChevronRight" size={15} /></button>
          )}
        </div>
      </div>
    </div>
  )
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-1.5 text-center ${accent ? 'border-amber-400/40 bg-amber-400/5' : 'border-ink-700 bg-ink-900'}`}>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`font-mono text-[15px] font-semibold ${accent ? 'text-amber-300' : 'text-white'}`}>{value}</div>
    </div>
  )
}

export { CHAINS }
