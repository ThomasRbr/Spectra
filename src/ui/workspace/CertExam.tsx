import { useEffect, useMemo, useRef, useState } from 'react'
import { attribution } from '../../engine/analysis'
import { shortAddr } from '../../engine/addressgen'
import { TRACE_METHODS, type TraceMethod } from '../../engine/tracing'
import { certById, type CertReport, type Confidence } from '../../lib/certs'
import { useGame, FLAG_META } from '../../store/game'
import { useProfile } from '../../store/profile'
import { useUi } from '../../store/ui'
import { expireAttempt, submitVolet } from '../../store/certRun'
import { Icon, Modal } from '../common'

function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Bandeau de l'examen dans la barre supérieure : volet en cours et temps restant. */
export function CertBanner() {
  const run = useGame((s) => s.cert)
  const attempt = useProfile((s) => (run ? s.certAttempts.find((a) => a.id === run.attemptId) : undefined))
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)
  useEffect(() => {
    if (!run) return
    fired.current = false
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [run?.attemptId, run?.index])
  useEffect(() => {
    if (attempt && attempt.status === 'running' && now > attempt.deadline && !fired.current) {
      fired.current = true
      expireAttempt()
    }
  }, [now, attempt])
  if (!run || !attempt) return null
  const cert = certById(run.certId)
  const left = attempt.deadline - now
  const warn = left < 15 * 60000
  return (
    <div className={`mr-2 flex items-center gap-2 rounded-lg border px-2.5 py-1 text-meta ${warn ? 'border-rose-400/50 bg-rose-400/10 text-rose-100' : 'border-amber-400/40 bg-amber-400/[0.07] text-amber-100'}`} title={cert?.title}>
      <Icon name="Award" size={13} />
      <span className="whitespace-nowrap">Volet {run.index + 1}/{attempt.volets.length}</span>
      <span className={`whitespace-nowrap font-mono ${warn ? 'text-rose-200' : 'text-white'}`}>{fmtLeft(left)}</span>
    </div>
  )
}

const CONF: { v: Confidence; label: string }[] = [
  { v: 'forte', label: 'Forte' },
  { v: 'moyenne', label: 'Moyenne' },
  { v: 'faible', label: 'Faible' },
]

/** Rapport structuré demandé à la remise de chaque volet. */
export function CertReportModal() {
  const open = useUi((s) => s.certReport)
  const inst = useGame((s) => s.inst)
  const run = useGame((s) => s.cert)
  const flags = useGame((s) => s.flags)
  const addrPos = useGame((s) => s.addrPos)
  const trace = useGame((s) => s.trace)
  const [method, setMethod] = useState<TraceMethod | 'none'>('none')
  const [justification, setJustification] = useState('')
  const [findings, setFindings] = useState('')
  const [inferences, setInferences] = useState('')
  const [conf, setConf] = useState<Record<string, Confidence | ''>>({})
  const [reqs, setReqs] = useState<{ entityId: string; addresses: string[] }[]>([{ entityId: '', addresses: [] }])
  const [held, setHeld] = useState<string[]>([])
  const [noHeld, setNoHeld] = useState(false)

  useEffect(() => {
    if (!open) return
    if (trace && method === 'none') setMethod(trace.opts.method)
  }, [open])
  // Nouveau volet : formulaire vierge
  useEffect(() => {
    setMethod('none')
    setJustification('')
    setFindings('')
    setInferences('')
    setConf({})
    setReqs([{ entityId: '', addresses: [] }])
    setHeld([])
    setNoHeld(false)
  }, [run?.attemptId, run?.index])

  const w = inst?.world
  const graphAddrs = useMemo(() => Object.keys(addrPos), [addrPos])
  const flagged = Object.keys(flags)
  const entities = useMemo(() => {
    if (!w) return []
    const m = new Map<string, string>()
    for (const a of graphAddrs) {
      const e = attribution(w, a).entity
      if (e && e.compliance) m.set(e.id, e.name)
    }
    for (const e of trace?.result.endpoints ?? []) if (e.entity.compliance) m.set(e.entity.id, e.entity.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [w, graphAddrs, trace])
  const heldCandidates = useMemo(() => [...new Set([...(trace?.result.stillHeld.map((n) => n.id) ?? []), ...flagged])], [trace, flagged.join()])
  if (!w || !run) return null
  const label = (id: string) => {
    const at = attribution(w, id)
    return `${at.label ?? shortAddr(w.get(id).addr, 7)}${flags[id] ? ` · ${FLAG_META[flags[id]].label}` : ''}`
  }
  const close = () => useUi.getState().set({ certReport: false })
  const report: CertReport = {
    method, justification, findings, inferences,
    attributions: Object.entries(conf).filter(([, c]) => c).map(([address, c]) => ({ address, confidence: c as Confidence })),
    requisitions: reqs.filter((r) => r.entityId),
    held, noHeld,
  }
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const cert = certById(run.certId)

  return (
    <Modal open={open} onClose={close} title={`Rapport du volet ${run.index + 1} — ${cert?.title ?? ''}`} icon="FileCheck" width="max-w-3xl">
      <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-3 text-meta leading-relaxed text-amber-50">
        Les réponses aux objectifs comptent pour les éléments trouvés ; ce rapport est noté à part selon une grille (méthode, source du traçage, constatations et déductions, confiance, réquisitions, fonds encore détenus). Une fois remis, le volet est clos : la correction n'est montrée qu'à la fin de l'examen.
      </div>

      <Section n={1} title="Méthode d'attribution retenue">
        <div className="grid grid-cols-2 gap-1 md:grid-cols-5">
          {(['none', ...Object.keys(TRACE_METHODS)] as (TraceMethod | 'none')[]).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={`rounded-lg border px-2 py-1.5 text-meta ${method === m ? 'border-accent bg-accent/10 text-white' : 'border-ink-700 text-ink-300 hover:border-ink-500'}`}>
              {m === 'none' ? 'Aucune' : TRACE_METHODS[m].short}
            </button>
          ))}
        </div>
        <textarea className="input mt-2 min-h-[60px] text-meta" placeholder="Pourquoi cette méthode ? Que change une autre méthode ?" value={justification} onChange={(e) => setJustification(e.target.value)} />
      </Section>

      <Section n={2} title="Constatations (vérifiables sur la chaîne)">
        <textarea className="input min-h-[70px] font-mono text-meta" placeholder="Transactions, montants, adresses, dates : citez les hash et adresses." value={findings} onChange={(e) => setFindings(e.target.value)} />
      </Section>

      <Section n={3} title="Déductions (heuristiques, rapprochements)">
        <textarea className="input min-h-[60px] text-meta" placeholder="Rendu, cluster, attribution, corrélation : ce qui est déduit et sur quels indices." value={inferences} onChange={(e) => setInferences(e.target.value)} />
      </Section>

      <Section n={4} title="Attributions et niveau de confiance">
        {flagged.length === 0 ? (
          <div className="text-meta text-ink-400">Marquez d'abord les adresses clés dans le graphe (suspect, victime, service…) : elles apparaîtront ici.</div>
        ) : (
          <div className="space-y-1">
            {flagged.map((a) => (
              <div key={a} className="flex items-center gap-2 rounded-lg border border-ink-700/60 px-2 py-1">
                <span className="min-w-0 flex-1 truncate font-mono text-micro text-ink-100">{label(a)}</span>
                {CONF.map((c) => (
                  <button key={c.v} onClick={() => setConf({ ...conf, [a]: conf[a] === c.v ? '' : c.v })} className={`rounded px-1.5 py-0.5 text-micro ${conf[a] === c.v ? 'bg-accent/20 text-accent' : 'text-ink-400 hover:text-white'}`}>{c.label}</button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n={5} title="Réquisitions">
        {reqs.map((r, i) => {
          const candidates = [...new Set([...flagged, ...graphAddrs.filter((a) => r.entityId && attribution(w, a).entity?.id === r.entityId), ...(trace?.result.endpoints.find((e) => e.entity.id === r.entityId)?.addresses ?? [])])]
          return (
            <div key={i} className="mb-2 rounded-lg border border-ink-700/60 p-2">
              <select className="input !py-1 text-meta" value={r.entityId} onChange={(e) => setReqs(reqs.map((x, k) => (k === i ? { entityId: e.target.value, addresses: [] } : x)))}>
                <option value="">Service à réquisitionner…</option>
                {entities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              {r.entityId && (
                <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                  <div className="text-micro text-ink-400">Adresses à citer (adresse de dépôt du client de préférence) :</div>
                  {candidates.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-micro text-ink-200">
                      <input type="checkbox" className="accent-accent" checked={r.addresses.includes(a)} onChange={() => setReqs(reqs.map((x, k) => (k === i ? { ...x, addresses: toggle(x.addresses, a) } : x)))} />
                      <span className="truncate font-mono">{label(a)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {reqs.length < 3 && <button className="btn-ghost !px-2 !py-1 text-micro" onClick={() => setReqs([...reqs, { entityId: '', addresses: [] }])}><Icon name="Plus" size={12} /> Ajouter une réquisition</button>}
        {!entities.length && <div className="text-micro text-ink-400">Aucun service coopérant sur le graphe : ajoutez-y les services atteints par les fonds.</div>}
      </Section>

      <Section n={6} title="Fonds encore détenus (pistes de gel)">
        <div className="space-y-0.5">
          {heldCandidates.map((a) => (
            <label key={a} className="flex items-center gap-2 text-micro text-ink-200">
              <input type="checkbox" className="accent-accent" disabled={noHeld} checked={held.includes(a)} onChange={() => setHeld(toggle(held, a))} />
              <span className="truncate font-mono">{label(a)}</span>
            </label>
          ))}
        </div>
        {!heldCandidates.length && <div className="text-micro text-ink-400">Lancez un traçage ou marquez les adresses concernées pour les signaler.</div>}
        <label className="mt-1.5 flex items-center gap-2 text-meta text-ink-200">
          <input type="checkbox" className="accent-accent" checked={noHeld} onChange={(e) => {
            setNoHeld(e.target.checked)
            if (e.target.checked) setHeld([])
          }} />
          Aucun fonds significatif n'est encore détenu
        </label>
      </Section>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={close}>Continuer l'enquête</button>
        <button className="btn-primary" onClick={() => {
          close()
          submitVolet(report)
        }}><Icon name="Send" size={14} /> Remettre le volet</button>
      </div>
    </Modal>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="label mb-1.5"><span className="mr-1 font-mono text-accent">{n}.</span>{title}</div>
      {children}
    </div>
  )
}

