import { useMemo, useState, type ReactNode } from 'react'
import { attribution } from '../../engine/analysis'
import { CATEGORY } from '../../engine/entities'
import { shortAddr } from '../../engine/addressgen'
import type { World } from '../../engine/world'
import type { Evidence, Objective } from '../../scenarios/types'
import { useGame, FLAG_META, type Flag } from '../../store/game'
import { useUi } from '../../store/ui'
import { evaluate, OBJECTIVE_HINT_RATIO } from '../../lib/scoring'
import { Icon, Tabs, fmtTime } from '../common'
import { AddrLine } from './Inspector'
import { WatchPanel } from './Live'
import { isKnownHdKey, openHdTool } from './HdTool'

export function Dossier() {
  const tab = useUi((s) => s.leftTab)
  const inst = useGame((s) => s.inst)
  const answers = useGame((s) => s.answers)
  const flags = useGame((s) => s.flags)
  const watched = useGame((s) => s.watch.length)
  const live = useGame((s) => !!s.live)
  if (!inst) return null
  const answered = inst.objectives.filter((o) => answers[o.id] !== undefined && answers[o.id] !== '' && !(Array.isArray(answers[o.id]) && (answers[o.id] as string[]).length === 0)).length
  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pb-2">
        <Tabs
          size="xs"
          value={tab}
          onChange={(leftTab) => useUi.getState().set({ leftTab })}
          tabs={[
            { id: 'objectives', label: `Objectifs ${answered}/${inst.objectives.length}`, icon: 'Target' },
            { id: 'evidence', label: 'Pièces', icon: 'FolderOpen', count: inst.evidence.length },
            { id: 'flags', label: 'Marqués', icon: 'Flag', count: Object.keys(flags).length },
            ...(live || watched ? [{ id: 'watch' as const, label: 'Veille', icon: 'Eye', count: watched }] : []),
            { id: 'journal', label: 'Journal', icon: 'History' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === 'objectives' && <Objectives />}
        {tab === 'evidence' && <EvidenceList />}
        {tab === 'flags' && <FlagList />}
        {tab === 'watch' && <WatchPanel />}
        {tab === 'journal' && <Journal />}
      </div>
    </div>
  )
}

// ── Objectifs ────────────────────────────────────────────────────────────

function Objectives() {
  const inst = useGame((s) => s.inst)!
  const score = useGame((s) => s.score)
  const hintsUsed = useGame((s) => s.hintsUsed)
  const mode = useGame((s) => s.mode)
  const inCert = useGame((s) => !!s.cert)
  const difficulty = useGame((s) => s.template?.difficulty)
  return (
    <div className="space-y-2.5">
      {difficulty === 1 && !score && mode !== 'examen' && <FirstSteps />}
      {inst.objectives.map((o, i) => (
        <ObjectiveCard key={o.id} o={o} index={i} />
      ))}
      {!score && (
        <div className="space-y-2 pt-1">
          {mode !== 'examen' && (
            <button className="btn-outline w-full text-xs" disabled={hintsUsed >= inst.hints.length} onClick={() => useUi.getState().set({ hintOpen: true })}>
              <Icon name="Lightbulb" size={14} className="text-yellow-300" /> Indice général ({hintsUsed}/{inst.hints.length}) · −5 pts
            </button>
          )}
          <button className="btn-primary w-full" onClick={() => useUi.getState().set({ confirmSubmit: true })}>
            <Icon name="Send" size={15} /> {inCert ? 'Remettre le volet' : 'Remettre le rapport'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Check-list d'accompagnement des missions débutant, cochée automatiquement. */
function FirstSteps() {
  const [hidden, setHidden] = useState(false)
  const nAddr = useGame((s) => Object.keys(s.addrPos).length)
  const nTx = useGame((s) => Object.keys(s.revealed).length)
  const selTx = useGame((s) => s.selection?.kind === 'tx' || s.log.some((l) => l.text.startsWith('Transaction ')))
  const nFlags = useGame((s) => Object.keys(s.flags).length)
  const nAnswers = useGame((s) => Object.keys(s.answers).length)
  const seeds = useGame((s) => s.inst?.seeds.length ?? 0)
  const steps = [
    { done: nAddr > Math.max(1, seeds) || nTx > 0, text: 'Lire les pièces et cliquer une adresse surlignée (ou partir de l\'adresse épinglée)' },
    { done: nTx > 0, text: 'Déplier les sorties : double-clic sur le nœud, ou bouton « Sorties »' },
    { done: selTx, text: 'Ouvrir une transaction pour lire ses entrées, sorties et le rendu probable' },
    { done: nFlags > 0, text: 'Marquer une adresse (clic droit ▸ Marquer : suspect, victime…)' },
    { done: nAnswers > 0, text: 'Répondre à un objectif, puis remettre le rapport' },
  ]
  const doneCount = steps.filter((x) => x.done).length
  if (hidden || doneCount === steps.length) return null
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="GraduationCap" size={14} className="text-accent" />
        <span className="text-[12px] font-semibold text-white">Premiers pas</span>
        <span className="font-mono text-[10.5px] text-ink-400">{doneCount}/{steps.length}</span>
        <button className="ml-auto text-ink-400 hover:text-white" title="Masquer" onClick={() => setHidden(true)}>
          <Icon name="X" size={13} />
        </button>
      </div>
      <ul className="space-y-1">
        {steps.map((st, i) => (
          <li key={i} className={`flex gap-2 text-[11.5px] leading-snug ${st.done ? 'text-ink-400 line-through' : 'text-ink-100'}`}>
            <Icon name={st.done ? 'CircleCheck' : 'Circle'} size={13} className={`mt-px shrink-0 ${st.done ? 'text-emerald-400' : 'text-ink-500'}`} />
            {st.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ObjectiveCard({ o, index }: { o: Objective; index: number }) {
  const inst = useGame((s) => s.inst)!
  const value = useGame((s) => s.answers[o.id])
  const score = useGame((s) => s.score)
  const objHint = useGame((s) => s.objHints.includes(o.id))
  const mode = useGame((s) => s.mode)
  const w = inst.world
  const res = score ? evaluate(o, value) : null
  const statusColor = res ? (res.status === 'correct' ? '#34d399' : res.status === 'partial' ? '#facc15' : '#f43f5e') : undefined
  const set = (v: typeof value) => useGame.getState().answer(o.id, v)
  const locked = !!score

  return (
    <div className="rounded-xl border bg-ink-850/60 p-3 transition" style={{ borderColor: statusColor ? `${statusColor}66` : '#1f2b47' }}>
      <div className="flex items-start gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink-700 font-mono text-[10.5px] text-ink-200">{index + 1}</span>
        <div className="flex-1 text-[12.5px] leading-snug text-ink-100">{o.prompt}</div>
        <span className="chip shrink-0 bg-ink-700 font-mono text-ink-200">{res ? `${res.earned}/${o.points}` : `${o.points} pts`}</span>
      </div>
      <div className="mt-2.5">
        <AnswerInput o={o} value={value} set={set} locked={locked} w={w} />
      </div>
      {!locked && o.hint && mode !== 'examen' && (
        objHint ? (
          <div className="mt-2 flex gap-1.5 rounded-lg border border-yellow-400/25 bg-yellow-400/5 p-2 text-[11px] leading-relaxed text-yellow-100">
            <Icon name="Lightbulb" size={12} className="mt-0.5 shrink-0 text-yellow-300" /> {o.hint}
          </div>
        ) : (
          <button className="mt-2 flex items-center gap-1 text-[10.5px] text-ink-400 hover:text-yellow-300" onClick={() => useGame.getState().useObjHint(o.id)}>
            <Icon name="Lightbulb" size={11} /> Indice (−{Math.round(o.points * OBJECTIVE_HINT_RATIO)} pts)
          </button>
        )
      )}
      {res && (
        <div className="mt-2.5 rounded-lg border p-2.5 text-[11.5px] leading-relaxed" style={{ borderColor: `${statusColor}44`, background: `${statusColor}0d` }}>
          <div className="mb-1 flex items-center gap-1.5 font-semibold" style={{ color: statusColor }}>
            <Icon name={res.status === 'correct' ? 'CircleCheck' : res.status === 'partial' ? 'CircleDot' : 'CircleX'} size={13} />
            {res.status === 'correct' ? 'Correct' : res.status === 'partial' ? 'Partiellement correct' : res.status === 'empty' ? 'Sans réponse' : 'Incorrect'}
            {res.detail && <span className="font-normal text-ink-300">· {res.detail}</span>}
          </div>
          <ExpectedAnswer o={o} w={w} />
          <div className="mt-1 text-ink-200">{o.explanation}</div>
        </div>
      )}
    </div>
  )
}

function ExpectedAnswer({ o, w }: { o: Objective; w: World }) {
  let content: ReactNode = null
  if (o.type === 'address' || o.type === 'addresses') content = <div className="space-y-0.5">{o.answer.slice(0, 12).map((a) => <AddrLine key={a} w={w} id={a} compact />)}</div>
  else if (o.type === 'tx') content = o.answer.map((t) => <div key={t} className="font-mono text-[11px] text-ink-100">{shortAddr(w.tx(t).hash, 12)}</div>)
  else if (o.type === 'entity') content = o.answer.map((e) => w.entities.get(e)?.name).join(', ')
  else if (o.type === 'amount') content = <span className="font-mono">{o.answer.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} {o.unit}</span>
  else if (o.type === 'number') content = <span className="font-mono">{o.answer}{o.unit ? ` ${o.unit}` : ''}</span>
  else if (o.type === 'choice') content = o.options[o.answer]
  return (
    <div className="mb-1.5">
      <span className="text-ink-400">Réponse attendue : </span>
      <span className="text-ink-100">{content}</span>
    </div>
  )
}

function AnswerInput({ o, value, set, locked, w }: { o: Objective; value: unknown; set: (v: string | string[] | number | undefined) => void; locked: boolean; w: World }) {
  const selection = useGame((s) => s.selection)
  const multi = useGame((s) => s.multi)
  const flags = useGame((s) => s.flags)
  const addrPos = useGame((s) => s.addrPos)

  if (o.type === 'address' || o.type === 'tx') {
    const kind = o.type === 'address' ? 'address' : 'tx'
    const v = value as string | undefined
    // Sur le modèle à comptes, une arête ne portant qu'une transaction vaut sélection de cette transaction
    const picked = selection?.kind === kind ? selection.id : kind === 'tx' && selection?.kind === 'edge' && selection.txIds.length === 1 ? selection.txIds[0] : undefined
    const canUse = !!picked
    return (
      <div className="space-y-1.5">
        {v ? (
          <div className="flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/5">
            <div className="min-w-0 flex-1">{kind === 'address' ? <AddrLine w={w} id={v} compact /> : <div className="px-2 py-1.5 font-mono text-[11.5px] text-ink-100">{shortAddr(w.tx(v).hash, 12)}</div>}</div>
            {!locked && <button className="px-2 text-ink-400 hover:text-rose-400" onClick={() => set(undefined)}><Icon name="X" size={13} /></button>}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-ink-600 px-2 py-1.5 text-[11px] text-ink-400">{kind === 'address' ? 'Aucune adresse choisie' : 'Aucune transaction choisie'}</div>
        )}
        {!locked && (
          <button className="btn-outline w-full !py-1 text-[11.5px]" disabled={!canUse} onClick={() => picked && set(picked)}>
            <Icon name="MousePointerClick" size={13} /> Utiliser {kind === 'address' ? 'l\'adresse' : 'la transaction'} sélectionnée
          </button>
        )}
      </div>
    )
  }

  if (o.type === 'addresses') {
    const v = (value as string[] | undefined) ?? []
    const add = (ids: string[]) => set([...new Set([...v, ...ids])])
    const suspects = Object.entries(flags).filter(([, f]) => f === 'suspect').map(([id]) => id)
    const sel = multi.length ? multi : selection?.kind === 'address' ? [selection.id] : []
    return (
      <div className="space-y-1.5">
        {v.length ? (
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-accent/30 bg-accent/5 p-0.5">
            {v.map((id) => (
              <div key={id} className="flex items-center">
                <div className="min-w-0 flex-1"><AddrLine w={w} id={id} compact /></div>
                {!locked && <button className="px-2 text-ink-400 hover:text-rose-400" onClick={() => set(v.filter((x) => x !== id))}><Icon name="X" size={12} /></button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-ink-600 px-2 py-1.5 text-[11px] text-ink-400">Aucune adresse · astuce : Maj + glisser pour sélectionner plusieurs nœuds</div>
        )}
        {!locked && (
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn-outline !px-1.5 !py-1 text-[11px]" disabled={!sel.length} onClick={() => add(sel)}>
              <Icon name="Plus" size={12} /> Sélection ({sel.length})
            </button>
            <button className="btn-outline !px-1.5 !py-1 text-[11px]" disabled={!suspects.length} onClick={() => add(suspects)}>
              <Icon name="Flag" size={12} color={FLAG_META.suspect.color} /> Suspects ({suspects.length})
            </button>
          </div>
        )}
      </div>
    )
  }

  if (o.type === 'entity') {
    const v = value as string | undefined
    const discovered = new Set<string>()
    for (const id of Object.keys(addrPos)) {
      const at = attribution(w, id)
      if (at.entity) discovered.add(at.entity.id)
    }
    const known = [...w.entities.values()].filter((e) => e.known)
    const disc = known.filter((e) => discovered.has(e.id))
    const others = known.filter((e) => !discovered.has(e.id))
    return (
      <select className="input !py-1.5 text-[12px]" disabled={locked} value={v ?? ''} onChange={(e) => set(e.target.value || undefined)}>
        <option value="">— Choisir une entité —</option>
        {disc.length > 0 && (
          <optgroup label="Entités présentes sur votre graphe">
            {disc.map((e) => <option key={e.id} value={e.id}>{e.name} · {CATEGORY[e.category].label}</option>)}
          </optgroup>
        )}
        <optgroup label="Autres entités de la base">
          {others.map((e) => <option key={e.id} value={e.id}>{e.name} · {CATEGORY[e.category].label}</option>)}
        </optgroup>
      </select>
    )
  }

  if (o.type === 'amount' || o.type === 'number') {
    return <NumberAnswer value={value as number | undefined} set={set} locked={locked} unit={o.unit} placeholder={o.type === 'amount' ? 'Montant (ex. 0,0000466)' : 'Valeur'} />
  }

  // choice
  const v = value as number | undefined
  return (
    <div className="space-y-1">
      {o.options.map((opt, i) => {
        const chosen = v === i
        const correct = locked && i === o.answer
        return (
          <button
            key={i}
            disabled={locked}
            onClick={() => set(i)}
            className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] leading-snug transition ${
              correct ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100' : chosen ? 'border-accent/60 bg-accent/10 text-white' : 'border-ink-700 text-ink-200 hover:border-ink-500'
            }`}
          >
            <span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${chosen ? 'border-accent' : 'border-ink-500'}`}>
              {chosen && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </span>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/** Saisie numérique tolérante : virgule ou point, zéros intermédiaires conservés. */
function NumberAnswer({ value, set, locked, unit, placeholder }: { value: number | undefined; set: (v: number | undefined) => void; locked: boolean; unit?: string; placeholder: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','))
  const parsed = text.trim() === '' ? undefined : Number(text.replace(/\s/g, '').replace(',', '.'))
  const invalid = text.trim() !== '' && !Number.isFinite(parsed)
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className={`input !py-1.5 font-mono text-[12.5px] ${invalid ? '!border-rose-500/70' : ''}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={locked}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            const t = e.target.value
            setText(t)
            const n = t.trim() === '' ? undefined : Number(t.replace(/\s/g, '').replace(',', '.'))
            set(n === undefined || Number.isFinite(n) ? n : undefined)
          }}
        />
        {unit && <span className="chip bg-ink-700 font-mono text-ink-200">{unit}</span>}
      </div>
      {invalid && <div className="mt-1 text-[10.5px] text-rose-300">Nombre invalide</div>}
    </div>
  )
}

// ── Pièces du dossier ────────────────────────────────────────────────────

const EVIDENCE_META: Record<Evidence['type'], { icon: string; color: string; label: string }> = {
  plainte: { icon: 'FileText', color: '#22d3ee', label: 'Plainte' },
  pv: { icon: 'FilePenLine', color: '#22d3ee', label: 'Procès-verbal' },
  capture: { icon: 'Camera', color: '#a78bfa', label: 'Capture d\'écran' },
  telegram: { icon: 'Send', color: '#38bdf8', label: 'Messagerie' },
  sms: { icon: 'Smartphone', color: '#38bdf8', label: 'SMS' },
  forum: { icon: 'MessagesSquare', color: '#f97316', label: 'Forum' },
  email: { icon: 'Mail', color: '#f472b6', label: 'Courriel' },
  note: { icon: 'StickyNote', color: '#facc15', label: 'Note' },
  rancon: { icon: 'Lock', color: '#f43f5e', label: 'Note de rançon' },
  osint: { icon: 'Globe', color: '#34d399', label: 'Source ouverte' },
  rapport: { icon: 'ClipboardList', color: '#94a3b8', label: 'Rapport' },
  extraction: { icon: 'Smartphone', color: '#22d3ee', label: 'Extraction de support' },
  perquisition: { icon: 'Search', color: '#f59e0b', label: 'PV de perquisition' },
  releve: { icon: 'Receipt', color: '#a78bfa', label: 'Relevé / réponse à réquisition' },
}

export function useLinkIndex(w: World | undefined) {
  return useMemo(() => {
    const addr = new Map<string, string>()
    const tx = new Map<string, string>()
    if (!w) return { addr, tx }
    for (const a of w.addresses.values()) addr.set(a.addr, a.id)
    for (const t of w.txs.values()) tx.set(t.hash, t.id)
    return { addr, tx }
  }, [w])
}

export function LinkedText({ text, w }: { text: string; w: World }) {
  const idx = useLinkIndex(w)
  // Adresses TON (base64url, « UQ… » / « EQ… »), seeds de démonstration, puis jetons alphanumériques
  const parts = text.split(/((?:UQ|EQ)[A-Za-z0-9_-]{46}(?![A-Za-z0-9_-])|seed de démonstration [0-9A-F]{4}|[A-Za-z0-9]{24,})/g)
  return (
    <>
      {parts.map((p, i) => {
        if (/^[xyz]pub|^seed de démonstration/.test(p) && isKnownHdKey(w, p)) {
          return (
            <button
              key={i}
              className="mx-0.5 inline break-all rounded border border-amber-400/40 bg-amber-400/10 px-1 font-mono text-[11px] text-amber-200 hover:bg-amber-400/25"
              title="Ouvrir l'outil de dérivation HD"
              onClick={() => openHdTool(p)}
            >
              {p}
            </button>
          )
        }
        const aid = idx.addr.get(p)
        if (aid) {
          return (
            <button
              key={i}
              className="mx-0.5 inline break-all rounded border border-accent/40 bg-accent/10 px-1 font-mono text-[11px] text-cyan-200 hover:bg-accent/25"
              title="Ajouter au graphe"
              onClick={() => {
                const g = useGame.getState()
                g.addAddress(aid)
                g.select({ kind: 'address', id: aid })
              }}
            >
              {p}
            </button>
          )
        }
        const tid = idx.tx.get(p)
        if (tid) {
          return (
            <button
              key={i}
              className="mx-0.5 inline break-all rounded border border-violet-400/40 bg-violet-400/10 px-1 font-mono text-[11px] text-violet-200 hover:bg-violet-400/25"
              title="Ouvrir la transaction"
              onClick={() => {
                const g = useGame.getState()
                g.revealTx(tid, true)
                g.select({ kind: 'tx', id: tid })
              }}
            >
              {p}
            </button>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function EvidenceList() {
  const inst = useGame((s) => s.inst)!
  const [open, setOpen] = useState<string | null>(inst.evidence[0]?.id ?? null)
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5 text-[11px] text-ink-300">
        <Icon name="MousePointerClick" size={11} className="mr-1 inline text-accent" />
        Cliquez une adresse ou un hash surligné pour l'ajouter au graphe.
      </div>
      {inst.evidence.map((e) => {
        const m = EVIDENCE_META[e.type]
        const isOpen = open === e.id
        return (
          <div key={e.id} className="overflow-hidden rounded-xl border border-ink-700/70 bg-ink-850/60">
            <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-ink-800/60" onClick={() => setOpen(isOpen ? null : e.id)}>
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${m.color}18`, color: m.color }}>
                <Icon name={m.icon} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-white">{e.title}</div>
                <div className="text-[10.5px] text-ink-400">{m.label}{e.author ? ` · ${e.author}` : ''}{e.date ? ` · ${fmtTime(e.date)}` : ''}</div>
              </div>
              <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-ink-400" />
            </button>
            {isOpen && (
              <div className={`border-t border-ink-700/60 px-3.5 py-3 text-[12px] leading-relaxed text-ink-100 whitespace-pre-wrap ${e.type === 'telegram' || e.type === 'sms' ? 'font-sans' : ''} ${e.type === 'rancon' ? 'font-mono text-[11.5px] text-rose-100' : ''}`}>
                <LinkedText text={e.body} w={inst.world} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FlagList() {
  const inst = useGame((s) => s.inst)!
  const flags = useGame((s) => s.flags)
  const notes = useGame((s) => s.notes)
  const groups = (Object.keys(FLAG_META) as Flag[]).map((f) => ({ f, ids: Object.entries(flags).filter(([, x]) => x === f).map(([id]) => id) })).filter((g) => g.ids.length)
  if (!groups.length) return <div className="px-2 py-8 text-center text-[12px] text-ink-400">Aucune adresse marquée.<br />Clic droit sur un nœud ▸ Marquer.</div>
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.f}>
          <div className="label mb-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: FLAG_META[g.f].color }} /> {FLAG_META[g.f].label} ({g.ids.length})</div>
          <div className="space-y-0.5">
            {g.ids.map((id) => (
              <div key={id}>
                <AddrLine w={inst.world} id={id} />
                {notes[id] && <div className="ml-6 line-clamp-2 text-[10.5px] italic text-ink-400">{notes[id]}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const LOG_ICON: Record<string, string> = { graph: 'Share2', flag: 'Flag', answer: 'Check', hint: 'Lightbulb', tool: 'Wrench', system: 'Info' }

function Journal() {
  const log = useGame((s) => s.log)
  return (
    <div className="relative space-y-0 pl-3">
      <div className="absolute bottom-2 left-[17px] top-2 w-px bg-ink-700" />
      {[...log].reverse().map((l, i) => (
        <div key={i} className="relative flex gap-2.5 py-1.5">
          <span className="z-10 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-900 text-ink-300">
            <Icon name={LOG_ICON[l.kind] ?? 'Dot'} size={9} />
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] leading-snug text-ink-100">{l.text}</div>
            <div className="text-[10px] text-ink-500">{new Date(l.t).toLocaleTimeString('fr-FR')}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
