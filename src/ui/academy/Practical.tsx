import { useMemo, useState } from 'react'
import { shortAddr } from '../../engine/addressgen'
import { CERT_DIFFICULTY, PRACTICAL_CERTS, certById, verificationCode, type PracticalCert } from '../../lib/certs'
import { evaluate } from '../../lib/scoring'
import { scenarioById } from '../../scenarios'
import type { Objective, ScenarioInstance } from '../../scenarios/types'
import { certStatus, closeAttempt, resumeCertification, startCertification } from '../../store/certRun'
import { useProfile, type Certificate, type VoletResult } from '../../store/profile'
import { useUi } from '../../store/ui'
import { Empty, Icon, Modal } from '../common'

const fmtDur = (min: number) => (min >= 60 ? `${min / 60} h` : `${min} min`)
const fmtDate = (t: number) => new Date(t).toLocaleDateString('fr-FR')

// ── Liste des certifications pratiques ───────────────────────────────────

export function PracticalCerts() {
  useProfile((s) => s.certAttempts.length + s.certificates.length + Object.keys(s.exams).length)
  const [confirm, setConfirm] = useState<PracticalCert | null>(null)
  return (
    <div>
      <div className="label text-amber-300">Certifications pratiques</div>
      <h2 className="mt-1 text-2xl font-bold text-white">Prouver qu'on sait mener une enquête</h2>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-300">
        Un examen sur des affaires inconnues, tirées au sort, sans indices et en temps limité. Pour réussir, il faut retrouver les éléments demandés (adresses, transactions, montants, services) et remettre un rapport structuré pour chaque volet, noté selon une grille. Trois tentatives, sept jours d'attente après un échec, validité de deux ans.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {PRACTICAL_CERTS.map((c) => <CertCard key={c.id} cert={c} onStart={() => setConfirm(c)} />)}
      </div>
      <StartModal cert={confirm} onClose={() => setConfirm(null)} />
      <VerifyBox />
    </div>
  )
}

function CertCard({ cert, onStart }: { cert: PracticalCert; onStart: () => void }) {
  const st = certStatus(cert)
  const d = CERT_DIFFICULTY[cert.difficulty]
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${cert.soon ? 'border-ink-700/60 opacity-70' : 'border-ink-700/80 bg-ink-900/60'}`} style={st.held ? { borderColor: `${d.color}80` } : undefined}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl font-mono text-[13px] font-bold" style={{ background: `${d.color}1c`, color: d.color }}>{cert.tier}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-white">{cert.title}</div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="chip !py-0" style={{ background: `${d.color}1c`, color: d.color }}>{d.label}</span>
            <span className="font-mono text-ink-400">{cert.code}</span>
            {cert.soon && <span className="chip !py-0 bg-ink-700 text-ink-300">Bientôt</span>}
            {st.held && <span className="chip !py-0 bg-emerald-500/15 text-emerald-300">Obtenue · valide jusqu'au {fmtDate(st.held.expires!)}</span>}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-200">{cert.description}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10.5px] text-ink-400">
        <div className="rounded-lg bg-ink-950/60 p-1.5"><div className="font-mono text-[13px] text-white">{cert.volets.length || '—'}</div>volets</div>
        <div className="rounded-lg bg-ink-950/60 p-1.5"><div className="font-mono text-[13px] text-white">{fmtDur(cert.durationMin)}</div>{cert.coverage === 'partial' ? 'attribution partielle' : 'attribution complète'}</div>
        <div className="rounded-lg bg-ink-950/60 p-1.5"><div className="font-mono text-[13px] text-white">{cert.passFlagsPct} % · {cert.passReportPct} %</div>éléments · rapport</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">{cert.skills.map((s) => <span key={s} className="chip border border-ink-600 bg-ink-800 !py-0 text-[10.5px] text-ink-200">{s}</span>)}</div>
      {!cert.soon && (
        <>
          <div className="mt-3 space-y-0.5">
            {st.prereqs.map((p) => (
              <div key={p.label} className={`flex items-center gap-1.5 text-[11.5px] ${p.ok ? 'text-emerald-300' : 'text-ink-400'}`}>
                <Icon name={p.ok ? 'CircleCheck' : 'Circle'} size={12} /> {p.label}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {st.running ? (
              <button className="btn-primary !py-1.5 text-[12.5px]" onClick={() => resumeCertification(st.running!.id)}><Icon name="Play" size={14} /> Reprendre l'examen</button>
            ) : (
              <button className="btn-primary !py-1.5 text-[12.5px]" disabled={st.blockers.length > 0} onClick={onStart}><Icon name="Play" size={14} /> Commencer l'examen</button>
            )}
            {st.last && st.last.status !== 'running' && (
              <button className="btn-ghost !py-1.5 text-[12px]" onClick={() => useUi.getState().openAcademy({ kind: 'certResult', id: st.last!.id })}><Icon name="ClipboardList" size={13} /> Dernier résultat</button>
            )}
            <span className="ml-auto text-[11px] text-ink-400">{st.left}/{cert.attempts} tentative(s)</span>
          </div>
          {!st.running && st.blockers.length > 0 && <div className="mt-1.5 text-[11px] text-amber-200">{st.blockers.join(' · ')}</div>}
        </>
      )}
    </div>
  )
}

function StartModal({ cert, onClose }: { cert: PracticalCert | null; onClose: () => void }) {
  const [ok, setOk] = useState(false)
  if (!cert) return null
  return (
    <Modal open={!!cert} onClose={onClose} title={`Commencer : ${cert.title}`} icon="Award" width="max-w-xl">
      <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-200">
        <li className="flex gap-2"><Icon name="Timer" size={14} className="mt-0.5 shrink-0 text-amber-300" /> {fmtDur(cert.durationMin)} pour {cert.volets.length} volets. Le chronomètre tourne dès maintenant, même si vous quittez l'espace d'enquête.</li>
        <li className="flex gap-2"><Icon name="Dices" size={14} className="mt-0.5 shrink-0 text-amber-300" /> Chaque volet est une affaire tirée au sort, avec une graine secrète. Mode examen : aucun indice{cert.coverage === 'partial' ? ', attribution partielle (60 % des adresses de dépôt non étiquetées)' : ''}.</li>
        <li className="flex gap-2"><Icon name="FileCheck" size={14} className="mt-0.5 shrink-0 text-amber-300" /> À chaque volet : répondre aux objectifs, puis remplir le rapport structuré. Un volet remis est clos.</li>
        <li className="flex gap-2"><Icon name="Target" size={14} className="mt-0.5 shrink-0 text-amber-300" /> Réussite : au moins {cert.passFlagsPct} % des points des objectifs et {cert.passReportPct} % au rapport, sur l'ensemble des volets.</li>
        <li className="flex gap-2"><Icon name="RotateCcw" size={14} className="mt-0.5 shrink-0 text-amber-300" /> {cert.attempts} tentatives, {cert.cooldownDays} jours d'attente après un échec. Correction détaillée à la fin de l'examen.</li>
      </ul>
      <label className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-100">
        <input type="checkbox" className="accent-cyan-400" checked={ok} onChange={(e) => setOk(e.target.checked)} /> J'ai compris les règles et je dispose du temps nécessaire.
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={!ok} onClick={() => {
          onClose()
          setOk(false)
          startCertification(cert.id)
        }}><Icon name="Play" size={14} /> Démarrer</button>
      </div>
    </Modal>
  )
}

// ── Résultat d'une tentative ─────────────────────────────────────────────

export function CertResult({ id }: { id: string }) {
  const attempt = useProfile((s) => s.certAttempts.find((a) => a.id === id))
  const certificate = useProfile((s) => s.certificates.find((c) => c.kind === 'practical' && c.id === attempt?.certId && c.date >= (attempt?.finishedAt ?? 0) - 5000))
  const p = useProfile()
  if (!attempt) return <div className="p-8"><Empty icon="Award" title="Tentative introuvable" /></div>
  const cert = certById(attempt.certId)!
  if (attempt.status === 'running') {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8">
        <Empty icon="Timer" title="Examen en cours" sub="La correction sera disponible une fois l'examen terminé." />
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => resumeCertification(attempt.id)}><Icon name="Play" size={14} /> Reprendre</button>
          <button className="btn-ghost" onClick={() => confirm('Clore l\'examen maintenant ? Les volets non remis comptent pour zéro.') && closeAttempt(attempt.id)}>Clore maintenant</button>
        </div>
      </div>
    )
  }
  const passed = attempt.status === 'passed'
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <button className="btn-ghost mb-3 !px-2 text-[12px]" onClick={() => useUi.getState().openAcademy({ kind: 'certs' })}><Icon name="ChevronLeft" size={14} /> Certificats</button>
      <div className={`rounded-2xl border p-5 ${passed ? 'border-emerald-400/40 bg-emerald-400/[0.05]' : 'border-rose-400/40 bg-rose-400/[0.05]'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name={passed ? 'BadgeCheck' : 'CircleX'} size={34} className={passed ? 'text-emerald-300' : 'text-rose-300'} />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{cert.code} · {CERT_DIFFICULTY[cert.difficulty].label}</div>
            <div className="text-[20px] font-bold text-white">{cert.title} : {passed ? 'réussie' : 'non obtenue'}</div>
            <div className="text-[12.5px] text-ink-300">Tentative du {new Date(attempt.startedAt).toLocaleString('fr-FR')} · {attempt.results.length}/{attempt.volets.length} volet(s) remis</div>
          </div>
          <Gauge label="Éléments trouvés" value={attempt.flagsPct ?? 0} min={cert.passFlagsPct} />
          <Gauge label="Rapport" value={attempt.reportPct ?? 0} min={cert.passReportPct} />
        </div>
        {passed && certificate && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-emerald-400/20 pt-3 text-[12.5px] text-ink-200">
            <span>Code de vérification : <span className="font-mono text-white">{certificate.code}</span> · valide jusqu'au {fmtDate(certificate.expires!)}</span>
            <button className="btn-primary ml-auto !py-1.5 text-[12.5px]" onClick={() => printPractical(certificate, p.name, p.unit)}><Icon name="Printer" size={14} /> Imprimer le certificat</button>
          </div>
        )}
        {!passed && <div className="mt-3 text-[12.5px] text-ink-300">{certStatus(cert).left > 0 ? `Nouvelle tentative possible après ${cert.cooldownDays} jours, sur de nouvelles affaires. Revoyez ci-dessous ce qui a manqué.` : 'Toutes les tentatives ont été utilisées.'}</div>}
      </div>

      {attempt.volets.map((v, i) => <VoletReview key={i} index={i} v={v} r={attempt.results[i]} />)}
    </div>
  )
}

function Gauge({ label, value, min }: { label: string; value: number; min: number }) {
  const ok = value >= min
  return (
    <div className="w-36 rounded-xl border border-ink-700/60 bg-ink-950/50 p-2.5">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`font-mono text-[20px] font-bold ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{value} %</div>
      <div className="h-1 overflow-hidden rounded-full bg-ink-700"><div className={`h-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, value)}%` }} /></div>
      <div className="mt-0.5 text-[10px] text-ink-400">seuil {min} %</div>
    </div>
  )
}

function answerText(inst: ScenarioInstance, o: Objective, a: unknown): string {
  if (a === undefined || a === '' || (Array.isArray(a) && !a.length)) return '—'
  const w = inst.world
  const one = (v: string) => (w.addresses.has(v) ? shortAddr(w.get(v).addr, 8) : w.txs.has(v) ? shortAddr(w.tx(v).hash, 8) : w.entities.get(v)?.name ?? v)
  if (o.type === 'choice') return o.options[Number(a)] ?? String(a)
  if (Array.isArray(a)) return a.map((x) => one(String(x))).join(', ')
  if (o.type === 'amount' || o.type === 'number') return Number(a).toLocaleString('fr-FR', { maximumFractionDigits: 8 })
  return one(String(a))
}

function expected(inst: ScenarioInstance, o: Objective): string {
  if (o.type === 'choice') return o.options[o.answer]
  if (o.type === 'amount') return `${o.answer.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} ${o.unit}`
  if (o.type === 'number') return `${o.answer.toLocaleString('fr-FR')}${o.unit ? ` ${o.unit}` : ''}`
  return answerText(inst, o, o.type === 'addresses' ? o.answer : o.answer[0])
}

function VoletReview({ index, v, r }: { index: number; v: { templateId: string; seed: number }; r?: VoletResult }) {
  const [open, setOpen] = useState(index === 0)
  const inst = useMemo(() => scenarioById(v.templateId)?.generate(v.seed), [v.templateId, v.seed])
  if (!inst) return null
  const max = inst.objectives.reduce((s, o) => s + o.points, 0)
  return (
    <div className="mt-4 rounded-2xl border border-ink-700/70 bg-ink-900/50">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen((x) => !x)}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 font-mono text-[13px] text-white">{index + 1}</span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-white">{inst.title}</div>
          <div className="text-[11.5px] text-ink-400">{scenarioById(v.templateId)?.title} · graine {v.seed}{r?.timedOut ? ' · remis à l\'expiration du temps' : ''}</div>
        </div>
        <span className="font-mono text-[12px] text-ink-200">{r ? `${r.earned}/${r.max}` : `0/${max}`} · rapport {r ? `${r.grade.pct} %` : '—'}</span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={15} className="text-ink-400" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink-700/60 p-4">
          {!r && <div className="text-[12px] text-rose-200">Volet non remis : il compte pour zéro.</div>}
          <div className="space-y-2">
            {inst.objectives.map((o, k) => {
              const res = evaluate(o, r?.answers[o.id] as never)
              const color = res.status === 'correct' ? 'text-emerald-300' : res.status === 'partial' ? 'text-amber-300' : 'text-rose-300'
              return (
                <div key={o.id} className="rounded-xl border border-ink-700/60 p-3 text-[12.5px]">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-ink-400">{k + 1}.</span>
                    <div className="flex-1 text-ink-100">{o.prompt}</div>
                    <span className={`font-mono ${color}`}>{res.earned}/{o.points}</span>
                  </div>
                  <div className="mt-1.5 grid gap-1 pl-5 text-[11.5px] md:grid-cols-2">
                    <div><span className="text-ink-400">Votre réponse : </span><span className={`font-mono ${color}`}>{answerText(inst, o, r?.answers[o.id])}</span></div>
                    <div><span className="text-ink-400">Attendu : </span><span className="font-mono text-ink-100">{expected(inst, o)}</span></div>
                  </div>
                  <div className="mt-1.5 pl-5 text-[11.5px] leading-relaxed text-ink-300">{o.explanation}</div>
                </div>
              )
            })}
          </div>
          {r && (
            <div className="rounded-xl border border-ink-700/60 p-3">
              <div className="label mb-2">Grille du rapport · {r.grade.pct} %</div>
              <div className="space-y-1">
                {r.grade.items.map((it) => (
                  <div key={it.label} className="flex items-start gap-2 text-[12px]">
                    <span className={`w-12 shrink-0 font-mono ${it.earned === it.max ? 'text-emerald-300' : it.earned ? 'text-amber-300' : 'text-rose-300'}`}>{it.earned}/{it.max}</span>
                    <div><div className="text-ink-100">{it.label}</div><div className="text-[11px] text-ink-400">{it.detail}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <details className="rounded-xl border border-ink-700/60 p-3 text-[12px] text-ink-300">
            <summary className="cursor-pointer text-ink-100">Ce qui s'est réellement passé</summary>
            <div className="mt-2 whitespace-pre-line leading-relaxed">{inst.truth.debrief}</div>
          </details>
        </div>
      )}
    </div>
  )
}

// ── Certificat et vérification ───────────────────────────────────────────

export function printPractical(c: Certificate, name: string, unit: string) {
  const cert = certById(c.id)
  const d = cert ? CERT_DIFFICULTY[cert.difficulty] : undefined
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Certification — ${esc(c.title)}</title>
<style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#f4f1ea}
.c{box-sizing:border-box;width:297mm;height:210mm;padding:16mm;display:flex}
.f{flex:1;border:3px double #0e7490;padding:12mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:white;position:relative}
.k{letter-spacing:.35em;text-transform:uppercase;color:#0e7490;font:600 13px Inter,Arial,sans-serif}
h1{font-size:40px;margin:8mm 0 3mm;color:#111}.n{font-size:30px;margin:5mm 0;font-style:italic}.t{font-size:24px;font-weight:bold;color:#0e7490}
.lv{display:inline-block;margin-top:4mm;padding:2mm 5mm;border-radius:20px;font:600 12px Inter,Arial,sans-serif;color:#fff;background:${d?.color ?? '#0e7490'}}
.m{margin-top:9mm;font:12.5px Inter,Arial,sans-serif;color:#444;line-height:1.7}.code{font-family:Consolas,monospace;font-size:15px;color:#111;letter-spacing:.08em}
.p{position:fixed;top:10px;right:10px;padding:8px 14px;background:#0e7490;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{.p{display:none}}</style></head>
<body><button class="p" onclick="window.print()">Imprimer / PDF</button><div class="c"><div class="f">
<div class="k">SPECTRA · Certification pratique</div><h1>Certificat</h1><div>Décerné à</div><div class="n">${esc(name)}</div><div>${esc(unit)}</div>
<div style="margin-top:7mm">pour avoir réussi l'examen pratique</div><div class="t">${esc(c.title)}</div>
<div class="lv">Niveau ${cert?.tier ?? ''} · ${d?.label ?? ''}</div>
<div class="m">Délivré le ${new Date(c.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })} · score ${c.score} % · valide jusqu'au ${c.expires ? new Date(c.expires).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '—'}<br>
Code de vérification : <span class="code">${esc(c.code ?? '')}</span><br>
Certificat d'entraînement interne à SPECTRA, sans valeur de diplôme.</div></div></div></body></html>`
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `certification-${c.id}.html`
    a.click()
  }
}

function VerifyBox() {
  const [name, setName] = useState('')
  const [certId, setCertId] = useState(PRACTICAL_CERTS[0].id)
  const [score, setScore] = useState('')
  const [date, setDate] = useState('')
  const [code, setCode] = useState('')
  const [res, setRes] = useState<boolean | null>(null)
  const check = () => {
    const t = new Date(`${date}T12:00:00`).getTime()
    if (!name.trim() || !Number.isFinite(t) || !score) return setRes(false)
    setRes(verificationCode(name, certId, Number(score), t).toUpperCase() === code.trim().toUpperCase())
  }
  return (
    <div className="mt-6 rounded-2xl border border-ink-700/70 bg-ink-900/50 p-4">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white"><Icon name="ShieldCheck" size={16} className="text-accent" /> Vérifier un certificat</div>
      <p className="mt-1 text-[12px] text-ink-400">Recalcule le code à partir des mentions du certificat : un nom, un score ou une date modifiés ne donnent plus le même code.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <input className="input" placeholder="Nom sur le certificat" value={name} onChange={(e) => { setName(e.target.value); setRes(null) }} />
        <select className="input" value={certId} onChange={(e) => { setCertId(e.target.value); setRes(null) }}>
          {PRACTICAL_CERTS.filter((c) => !c.soon).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input className="input font-mono" placeholder="Score (%)" value={score} onChange={(e) => { setScore(e.target.value.replace(/[^0-9]/g, '')); setRes(null) }} />
        <input className="input font-mono" type="date" value={date} onChange={(e) => { setDate(e.target.value); setRes(null) }} />
        <input className="input font-mono" placeholder="SPX-…" value={code} onChange={(e) => { setCode(e.target.value); setRes(null) }} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-outline !py-1.5 text-[12.5px]" onClick={check}>Vérifier</button>
        {res === true && <span className="text-[12.5px] text-emerald-300"><Icon name="BadgeCheck" size={14} className="mr-1 inline" /> Code valide : les mentions correspondent.</span>}
        {res === false && <span className="text-[12.5px] text-rose-300"><Icon name="CircleX" size={14} className="mr-1 inline" /> Code invalide pour ces mentions.</span>}
      </div>
    </div>
  )
}
