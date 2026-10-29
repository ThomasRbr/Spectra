import { useEffect, useMemo, useState } from 'react'
import { DRILLS, EXAMS, LEVELS, LESSONS, PATHS, examById, lessonById, pathById, type DrillItem, type Question } from '../../academy'
import { Rng, randomSeed } from '../../engine/rng'
import { useProfile, type CardGrade, type Certificate } from '../../store/profile'
import { useUi } from '../../store/ui'
import { dueCards, pathProgress, type CardRef } from '../../lib/academy'
import { Empty, Icon, ProgressBar, fmtDuration } from '../common'
import { QuestionCard, isCorrect } from './Quiz'
import { DrillQuestion, checkDrill } from './Practice'
import { PracticalCerts, printPractical } from './Practical'

// ── Révisions (répétition espacée) ─────────────────────────────────────────

export function CardsReview({ lessonId }: { lessonId?: string }) {
  const profile = useProfile()
  const [queue, setQueue] = useState<CardRef[]>(() => dueCards(useProfile.getState(), { lessonId }))
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const lesson = lessonId ? lessonById(lessonId) : undefined
  const totalKnown = Object.keys(profile.cards).length
  const mastered = Object.values(profile.cards).filter((c) => c.box >= 4).length

  useEffect(() => {
    useProfile.getState().touchDay()
  }, [])

  const grade = (g: CardGrade) => {
    const c = queue[0]
    if (!c) return
    useProfile.getState().reviewCard(c.key, g)
    setFlipped(false)
    setDone((d) => d + 1)
    // « À revoir » : la fiche revient en fin de séance
    setQueue((q) => (g === 'again' ? [...q.slice(1), c] : q.slice(1)))
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!queue.length) return
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade((['again', 'hard', 'good', 'easy'] as CardGrade[])[Number(e.key) - 1])
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const card = queue[0]
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button className="btn-ghost -ml-2 mb-3 !px-2 text-[12px]" onClick={() => (lesson ? useUi.getState().openLesson(lesson.id) : useUi.getState().openAcademy({ kind: 'home' }))}>
        <Icon name="ChevronLeft" size={14} /> {lesson ? lesson.title : 'Académie'}
      </button>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="label text-amber-300">Révisions</div>
          <h1 className="mt-1 text-[26px] font-bold text-white">{lesson ? `Fiches — ${lesson.title}` : 'Fiches du jour'}</h1>
          <p className="text-[12.5px] text-ink-400">Répétition espacée : plus une fiche est maîtrisée, plus elle revient tard. Espace pour retourner, 1-4 pour noter.</p>
        </div>
        <div className="ml-auto flex gap-2 text-center">
          <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-1.5"><div className="text-[9.5px] uppercase text-ink-400">Restantes</div><div className="font-mono text-[15px] text-white">{queue.length}</div></div>
          <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-1.5"><div className="text-[9.5px] uppercase text-ink-400">Revues</div><div className="font-mono text-[15px] text-white">{done}</div></div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-1.5"><div className="text-[9.5px] uppercase text-ink-400">Maîtrisées</div><div className="font-mono text-[15px] text-emerald-300">{mastered}/{totalKnown}</div></div>
        </div>
      </div>

      {!card ? (
        <div className="mt-10">
          <Empty icon="PartyPopper" title={done ? 'Séance terminée, bravo !' : 'Aucune fiche à réviser'} sub={done ? 'Les fiches reviendront au bon moment selon votre niveau de maîtrise.' : 'Lisez des leçons pour débloquer leurs fiches, ou revenez plus tard.'} />
        </div>
      ) : (
        <>
          <div className="mt-6 text-[12px] text-ink-400">{card.lessonTitle}</div>
          <button onClick={() => setFlipped((f) => !f)} className="mt-1.5 h-72 w-full [perspective:1200px]">
            <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-ink-600 bg-gradient-to-br from-ink-850 to-ink-900 p-8 text-center shadow-panel [backface-visibility:hidden]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Question</div>
                <div className="mt-3 text-[20px] font-semibold leading-snug text-white">{card.card.front}</div>
                <div className="mt-6 text-[11.5px] text-ink-500">Cliquer ou Espace pour voir la réponse</div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-400/[0.08] to-ink-900 p-8 text-center shadow-panel [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Réponse</div>
                <div className="mt-3 text-[16px] leading-relaxed text-ink-100">{card.card.back}</div>
              </div>
            </div>
          </button>
          <div className={`mt-4 grid grid-cols-4 gap-2 transition ${flipped ? 'opacity-100' : 'pointer-events-none opacity-30'}`}>
            {([['again', 'À revoir', '#f43f5e', '1'], ['hard', 'Difficile', '#fb923c', '2'], ['good', 'Bien', '#22d3ee', '3'], ['easy', 'Facile', '#34d399', '4']] as const).map(([g, label, color, k]) => (
              <button key={g} onClick={() => grade(g)} className="rounded-xl border py-2.5 text-[13px] font-semibold transition hover:brightness-125" style={{ borderColor: `${color}66`, color, background: `${color}10` }}>
                {label} <span className="kbd ml-1">{k}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Examens ────────────────────────────────────────────────────────────────

export function ExamsList() {
  const exams = useProfile((s) => s.exams)
  const groups = [
    { title: 'Examens de niveau', items: EXAMS.filter((e) => e.id.startsWith('exam-n')) },
    { title: 'Certifications thématiques', items: EXAMS.filter((e) => !e.id.startsWith('exam-n')) },
  ]
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="label text-accent">Évaluation</div>
      <h1 className="mt-1 text-3xl font-bold text-white">Examens</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-300">Questions tirées au hasard dans les quiz des leçons et des exercices générés, chronométrées, sans correction avant la fin. Réussir un examen de niveau valide ce niveau.</p>
      {groups.map((g) => (
        <section key={g.title} className="mt-7">
          <h2 className="mb-3 text-[15px] font-semibold text-white">{g.title}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.items.map((e) => {
              const r = exams[e.id]
              const lv = LEVELS[e.level]
              return (
                <button key={e.id} onClick={() => useUi.getState().openAcademy({ kind: 'exam', id: e.id })} className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 text-left transition hover:border-accent/50">
                  <div className="flex items-center gap-2">
                    <span className="chip border" style={{ color: lv.color, borderColor: `${lv.color}55` }}>{lv.short}</span>
                    {r?.passedAt ? <span className="chip bg-emerald-400/10 text-emerald-300"><Icon name="BadgeCheck" size={11} /> Réussi</span> : r ? <span className="chip bg-ink-800 text-ink-300">{r.attempts} tentative(s)</span> : null}
                    <span className="ml-auto font-mono text-[12px] text-ink-300">{r ? `${r.best} %` : ''}</span>
                  </div>
                  <div className="mt-2 text-[15px] font-semibold text-white">{e.title}</div>
                  <div className="mt-1 line-clamp-2 text-[12.5px] text-ink-300">{e.description}</div>
                  <div className="mt-3 flex gap-3 text-[11.5px] text-ink-400">
                    <span><Icon name="ListChecks" size={11} className="mr-1 inline" />{e.questions} questions</span>
                    <span><Icon name="Timer" size={11} className="mr-1 inline" />{e.minutes} min</span>
                    <span><Icon name="Target" size={11} className="mr-1 inline" />{e.passPct} % requis</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

type ExamItem = { kind: 'q'; q: Question; from: string } | { kind: 'd'; d: DrillItem; from: string }

function buildExam(id: string, seed: number): ExamItem[] {
  const e = examById(id)!
  const rng = new Rng(seed)
  const pool: ExamItem[] = []
  for (const lid of e.lessons) {
    const l = lessonById(lid)
    if (l) for (const q of l.quiz) pool.push({ kind: 'q', q, from: l.title })
  }
  const nDrill = Math.min(Math.round(e.questions * 0.25), e.drills.length ? e.questions : 0)
  const drills: ExamItem[] = []
  const defs = DRILLS.filter((d) => e.drills.includes(d.id))
  for (let i = 0; i < nDrill && defs.length; i++) {
    const d = defs[i % defs.length]
    drills.push({ kind: 'd', d: d.generate(rng.int(1, 2 ** 30)), from: d.title })
  }
  const qs = rng.pickN(pool, e.questions - drills.length)
  return rng.shuffle([...qs, ...drills])
}

export function ExamRunner({ id, pathId }: { id: string; pathId?: string }) {
  const e = examById(id)
  const [seed, setSeed] = useState<number | null>(null)
  const items = useMemo(() => (seed !== null && e ? buildExam(id, seed) : []), [seed, id, e])
  const [answers, setAnswers] = useState<Record<number, number[] | string | number>>({})
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<{ ok: number; pct: number; passed: boolean } | null>(null)
  const [cur, setCur] = useState(0)
  const rec = useProfile((s) => s.exams[id])
  const path = pathId ? pathById(pathId) : undefined

  useEffect(() => {
    if (seed === null || result) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [seed, result])

  const submit = () => {
    if (!e) return
    const ok = items.reduce((s, it, i) => s + (it.kind === 'q' ? (isCorrect(it.q, answers[i] as number[]) ? 1 : 0) : checkDrill(it.d, answers[i] as string | number) ? 1 : 0), 0)
    const pct = Math.round((ok / Math.max(1, items.length)) * 100)
    const passed = pct >= e.passPct
    setResult({ ok, pct, passed })
    useProfile.getState().recordExam(id, pct, passed, 80 + e.level * 40)
    if (passed) {
      useProfile.getState().addCertificate({ id: e.id, kind: 'exam', title: e.title, score: pct })
      // Parcours terminé ? On décerne son certificat.
      for (const p of PATHS) {
        if (pathProgress(useProfile.getState(), p).complete) useProfile.getState().addCertificate({ id: p.id, kind: 'path', title: p.certificate })
      }
    }
    document.querySelector('#exam-top')?.scrollIntoView()
  }

  const remaining = e ? Math.max(0, e.minutes * 60 - Math.round((now - startedAt) / 1000)) : 0
  useEffect(() => {
    if (seed !== null && !result && remaining === 0 && startedAt) submit()
  })

  if (!e) return <Empty icon="FileQuestion" title="Examen introuvable" />

  if (seed === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button className="btn-ghost -ml-2 mb-3 !px-2 text-[12px]" onClick={() => useUi.getState().openAcademy(path ? { kind: 'path', id: path.id } : { kind: 'exams' })}><Icon name="ChevronLeft" size={14} /> {path ? path.title : 'Examens'}</button>
        <div className="rounded-3xl border border-ink-700 hero-gradient p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><Icon name="FileCheck2" size={30} /></span>
          <h1 className="mt-4 text-[26px] font-bold text-white">{e.title}</h1>
          <p className="mt-2 text-[14px] text-ink-300">{e.description}</p>
          <div className="mt-5 flex justify-center gap-6 text-[13px] text-ink-200">
            <span><b className="text-white">{e.questions}</b> questions</span>
            <span><b className="text-white">{e.minutes}</b> minutes</span>
            <span><b className="text-white">{e.passPct} %</b> pour réussir</span>
          </div>
          {rec && <div className="mt-3 text-[12px] text-ink-400">Meilleur score : {rec.best} % · {rec.attempts} tentative(s){rec.passedAt ? ' · réussi' : ''}</div>}
          <button className="btn-primary mt-6 !px-6 !py-2.5 text-[14px]" onClick={() => {
            setSeed(randomSeed())
            setStartedAt(Date.now())
            setNow(Date.now())
            setAnswers({})
            setResult(null)
            setCur(0)
          }}>
            <Icon name="Play" size={16} /> Commencer l'examen
          </button>
          <div className="mt-3 text-[11.5px] text-ink-500">Chaque tentative tire de nouvelles questions.</div>
        </div>
      </div>
    )
  }

  const answered = items.filter((_, i) => answers[i] !== undefined && answers[i] !== '' && !(Array.isArray(answers[i]) && !(answers[i] as number[]).length)).length
  return (
    <div className="mx-auto max-w-3xl px-6 py-8" id="exam-top">
      <div className="sticky top-0 z-10 -mx-2 mb-4 flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900/95 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-white">{e.title}</div>
          <ProgressBar value={answered / items.length} className="mt-1" />
        </div>
        <span className="font-mono text-[12px] text-ink-300">{answered}/{items.length}</span>
        {!result && <span className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[13px] ${remaining < 60 ? 'border-rose-400/50 text-rose-300' : 'border-ink-600 text-ink-100'}`}><Icon name="Timer" size={13} /> {fmtDuration(remaining)}</span>}
        {!result && <button className="btn-primary !py-1.5" onClick={() => confirm(answered < items.length ? `${items.length - answered} question(s) sans réponse. Rendre la copie ?` : 'Rendre la copie ?') && submit()}>Rendre</button>}
      </div>

      {result && (
        <div className={`mb-6 rounded-3xl border p-6 text-center ${result.passed ? 'border-emerald-400/40 bg-emerald-400/[0.06]' : 'border-rose-400/40 bg-rose-400/[0.06]'}`}>
          <Icon name={result.passed ? 'BadgeCheck' : 'CircleX'} size={40} className={`mx-auto ${result.passed ? 'text-emerald-400' : 'text-rose-400'}`} />
          <div className="mt-2 text-[34px] font-black text-white">{result.pct} %</div>
          <div className="text-[14px] text-ink-200">{result.ok}/{items.length} bonnes réponses · seuil {e.passPct} %</div>
          <div className={`mt-2 text-[15px] font-semibold ${result.passed ? 'text-emerald-300' : 'text-rose-300'}`}>{result.passed ? 'Examen réussi : certificat ajouté à votre dossier.' : 'Examen non validé : revoyez les corrections ci-dessous puis retentez.'}</div>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-outline" onClick={() => setSeed(null)}><Icon name="RotateCcw" size={14} /> Nouvelle tentative</button>
            {result.passed && <button className="btn-primary" onClick={() => useUi.getState().openAcademy({ kind: 'certs' })}><Icon name="Award" size={14} /> Mes certificats</button>}
            {path && <button className="btn-outline" onClick={() => useUi.getState().openAcademy({ kind: 'path', id: path.id })}>Retour au parcours</button>}
          </div>
        </div>
      )}

      {!result && (
        <div className="mb-3 flex flex-wrap gap-1">
          {items.map((_, i) => {
            const a = answers[i]
            const has = a !== undefined && a !== '' && !(Array.isArray(a) && !a.length)
            return <button key={i} onClick={() => setCur(i)} className={`h-7 w-7 rounded-md font-mono text-[11px] transition ${cur === i ? 'bg-accent text-ink-950' : has ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-ink-400 hover:text-white'}`}>{i + 1}</button>
          })}
        </div>
      )}

      <div className="space-y-4">
        {items.map((it, i) => {
          if (!result && i !== cur) return null
          return (
            <div key={i}>
              <div className="mb-1 text-[11px] text-ink-500">Question {i + 1} · {it.from}</div>
              {it.kind === 'q' ? (
                <QuestionCard q={it.q} index={i} value={answers[i] as number[] | undefined} reveal={!!result} onChange={(v) => setAnswers((a) => ({ ...a, [i]: v }))} />
              ) : (
                <div className={`rounded-2xl border bg-ink-900/60 p-4 ${result ? (checkDrill(it.d, answers[i] as string | number) ? 'border-emerald-400/40' : 'border-rose-400/40') : 'border-ink-700/70'}`}>
                  <DrillQuestion item={it.d} value={answers[i] as string | number | undefined} reveal={!!result} onChange={(v) => setAnswers((a) => ({ ...a, [i]: v }))} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!result && (
        <div className="mt-4 flex justify-between">
          <button className="btn-ghost" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}><Icon name="ChevronLeft" size={15} /> Précédente</button>
          {cur < items.length - 1 ? <button className="btn-outline" onClick={() => setCur((c) => c + 1)}>Suivante <Icon name="ChevronRight" size={15} /></button> : <button className="btn-primary" onClick={() => confirm('Rendre la copie ?') && submit()}>Rendre la copie</button>}
        </div>
      )}
    </div>
  )
}

// ── Certificats ────────────────────────────────────────────────────────────

export function Certificates() {
  const p = useProfile()
  const certs = [...p.certificates].sort((a, b) => b.date - a.date)
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="label text-accent">Reconnaissance</div>
      <h1 className="mt-1 text-3xl font-bold text-white">Certificats</h1>
      <p className="mt-1 text-[13.5px] text-ink-300">Les certifications pratiques valident la capacité à mener une enquête. Les examens à questions et les parcours délivrent des insignes de compétence, exigés pour s'y présenter. Tous les certificats sont imprimables (ou enregistrables en PDF).</p>
      <div className="mt-6"><PracticalCerts /></div>
      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-white">Certificats obtenus</h2>
      {!certs.length ? (
        <div><Empty icon="Award" title="Aucun certificat pour l'instant" sub="Réussissez un examen, terminez un parcours ou passez une certification pratique." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <div key={`${c.kind}-${c.id}`} className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.08] via-ink-900 to-ink-900 p-5">
              <Icon name="Award" size={80} className="absolute -right-4 -top-4 text-amber-400/10" />
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-amber-300">{c.kind === 'practical' ? 'Certification pratique' : c.kind === 'path' ? 'Parcours terminé' : 'Insigne de compétence'}</div>
              <div className="mt-1 text-[17px] font-bold text-white">{c.title}</div>
              <div className="mt-1 text-[12.5px] text-ink-300">Délivré le {new Date(c.date).toLocaleDateString('fr-FR')}{c.score !== undefined ? ` · ${c.score} %` : ''}{c.expires ? ` · valide jusqu'au ${new Date(c.expires).toLocaleDateString('fr-FR')}` : ''}</div>
              {c.code && <div className="mt-0.5 font-mono text-[11.5px] text-ink-200">{c.code}</div>}
              <button className="btn-outline mt-4 !py-1 text-[12px]" onClick={() => (c.kind === 'practical' ? printPractical(c, p.name, p.unit) : printCertificate(c, p.name, p.unit))}><Icon name="Printer" size={13} /> Imprimer</button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-10">
        <h2 className="mb-3 text-[15px] font-semibold text-white">Parcours et certificats associés</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {PATHS.map((path) => {
            const pr = pathProgress(p, path)
            return (
              <div key={path.id} className="flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-900/50 p-3">
                <Icon name={path.icon} size={18} color={path.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white">{path.certificate}</div>
                  <ProgressBar value={pr.pct} className="mt-1" color={path.color} />
                </div>
                <span className="font-mono text-[11.5px] text-ink-400">{pr.done}/{pr.total}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function printCertificate(c: Certificate, name: string, unit: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Certificat — ${esc(c.title)}</title>
<style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#f4f1ea}
.c{box-sizing:border-box;width:297mm;height:210mm;padding:18mm;display:flex}
.f{flex:1;border:3px double #0e7490;padding:14mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:white}
.k{letter-spacing:.35em;text-transform:uppercase;color:#0e7490;font:600 13px Inter,Arial,sans-serif}
h1{font-size:42px;margin:10mm 0 4mm;color:#111}.n{font-size:30px;margin:6mm 0;font-style:italic}.t{font-size:22px;font-weight:bold;color:#0e7490}
.m{margin-top:12mm;font:13px Inter,Arial,sans-serif;color:#555}.p{position:fixed;top:10px;right:10px;padding:8px 14px;background:#0e7490;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{.p{display:none}}</style></head>
<body><button class="p" onclick="window.print()">Imprimer / PDF</button><div class="c"><div class="f">
<div class="k">SPECTRA · Académie du traçage de crypto-actifs</div><h1>Certificat de réussite</h1><div>Décerné à</div><div class="n">${esc(name)}</div><div>${esc(unit)}</div>
<div style="margin-top:8mm">pour avoir ${c.kind === 'path' ? 'achevé le parcours' : 'réussi l\'examen'}</div><div class="t">${esc(c.title)}</div>
<div class="m">Délivré le ${new Date(c.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}${c.score !== undefined ? ` · score ${c.score} %` : ''}<br>Certificat d'entraînement interne — sans valeur de diplôme</div></div></div></body></html>`
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `certificat-${c.id}.html`
    a.click()
  }
}

export { LESSONS }
