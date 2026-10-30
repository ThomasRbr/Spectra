// Vérifie que chaque étape de parcours, chaque examen et chaque mission
// « à pratiquer » pointe vers un contenu existant.
// Usage : npx tsx scripts/check-paths.ts
import { PATHS, EXAMS, LESSONS, DRILLS, CURRICULUM } from '../src/academy/index'
import { ALL_SCENARIOS } from '../src/scenarios/index'

const lessonIds = new Set(LESSONS.map((l) => l.id))
const drillIds = new Set(DRILLS.map((d) => d.id))
const missionIds = new Set(ALL_SCENARIOS.map((s) => s.id))
const examIds = new Set(EXAMS.map((e) => e.id))
const problems: string[] = []
for (const p of PATHS) {
  for (const st of p.steps) {
    const ok = st.kind === 'lesson' ? lessonIds.has(st.id) : st.kind === 'drill' ? drillIds.has(st.id) : st.kind === 'mission' ? missionIds.has(st.id) : examIds.has(st.id)
    if (!ok) problems.push(`parcours ${p.id} : ${st.kind} inconnu ${st.id}`)
  }
}
for (const e of EXAMS) {
  for (const id of e.lessons) if (!lessonIds.has(id)) problems.push(`examen ${e.id} : leçon inconnue ${id}`)
  for (const id of e.drills) if (!drillIds.has(id)) problems.push(`examen ${e.id} : exercice inconnu ${id}`)
  const pool = e.lessons.reduce((s, id) => s + (LESSONS.find((l) => l.id === id)?.quiz.length ?? 0), 0)
  if (pool < e.questions) problems.push(`examen ${e.id} : banque trop petite (${pool} < ${e.questions})`)
}
for (const l of LESSONS) for (const m of l.practice ?? []) if (!missionIds.has(m)) problems.push(`leçon ${l.id} : mission inconnue ${m}`)
const unused = ALL_SCENARIOS.filter((s) => !s.certOnly && !PATHS.some((p) => p.steps.some((st) => st.kind === 'mission' && st.id === s.id))).map((s) => s.id)
const notInPath = CURRICULUM.filter((c) => !PATHS.some((p) => p.steps.some((st) => st.kind === 'lesson' && st.id === c.id))).map((c) => c.id)
console.log(`Parcours : ${PATHS.length} · examens : ${EXAMS.length} · missions jouables : ${ALL_SCENARIOS.filter((s) => !s.certOnly).length} · leçons : ${LESSONS.length} · exercices : ${DRILLS.length}`)
if (unused.length) console.log(`Missions absentes des parcours : ${unused.join(', ')}`)
if (notInPath.length) console.log(`Leçons absentes des parcours : ${notInPath.join(', ')}`)
for (const p of problems) console.log(' - ' + p)
process.exit(problems.length ? 1 : 0)
