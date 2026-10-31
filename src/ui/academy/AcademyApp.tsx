import { useEffect } from 'react'
import { PATHS } from '../../academy'
import { useProfile } from '../../store/profile'
import { useUi, type AcademyView } from '../../store/ui'
import { dueCards, pathProgress } from '../../lib/academy'
import { Icon } from '../common'
import { AcademyHome, Library, PathView, PathsList } from './Home'
import { LessonReader } from './LessonReader'
import { DrillRunner, PracticeHub } from './Practice'
import { CardsReview, Certificates, ExamRunner, ExamsList } from './Assess'
import { CertResult } from './Practical'

const TABS: { kind: AcademyView['kind']; label: string; icon: string; match: AcademyView['kind'][] }[] = [
  { kind: 'home', label: 'Accueil', icon: 'House', match: ['home'] },
  { kind: 'paths', label: 'Parcours', icon: 'Route', match: ['paths', 'path'] },
  { kind: 'library', label: 'Bibliothèque', icon: 'Library', match: ['library', 'lesson'] },
  { kind: 'practice', label: 'Entraînement', icon: 'Dumbbell', match: ['practice', 'drill'] },
  { kind: 'cards', label: 'Révisions', icon: 'Layers', match: ['cards'] },
  { kind: 'exams', label: 'Examens', icon: 'FileCheck2', match: ['exams', 'exam'] },
  { kind: 'certs', label: 'Certificats', icon: 'Award', match: ['certs', 'certResult'] },
]

export function AcademyApp() {
  const view = useUi((s) => s.academy)
  const profile = useProfile()
  const due = dueCards(profile).length

  // Certificat de parcours dès que toutes ses étapes sont validées
  useEffect(() => {
    for (const path of PATHS) {
      if (pathProgress(profile, path).complete && !profile.certificates.some((c) => c.kind === 'path' && c.id === path.id)) {
        if (useProfile.getState().addCertificate({ id: path.id, kind: 'path', title: path.certificate })) useUi.getState().notify(`Parcours terminé : certificat « ${path.certificate} » obtenu !`)
      }
    }
  }, [profile])

  const key = view.kind === 'lesson' ? `l-${view.id}` : view.kind === 'drill' ? `d-${view.id}` : view.kind === 'exam' ? `e-${view.id}` : view.kind === 'path' ? `p-${view.id}` : view.kind === 'cards' ? `c-${view.lessonId ?? ''}` : view.kind
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-ink-700/70 bg-ink-900/80 px-4">
        <span className="mr-3 flex items-center gap-2 whitespace-nowrap text-dense font-bold tracking-wide text-white"><Icon name="GraduationCap" size={16} className="text-accent" /> Académie</span>
        {TABS.map((t) => {
          const active = t.match.includes(view.kind)
          return (
            <button key={t.kind} onClick={() => useUi.getState().openAcademy({ kind: t.kind } as AcademyView)} className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-dense font-medium transition ${active ? 'bg-accent/10 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}>
              <Icon name={t.icon} size={14} className={active ? 'text-accent' : ''} />
              {t.label}
              {t.kind === 'cards' && due > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-micro font-bold text-ink-950">{due}</span>}
            </button>
          )
        })}
      </div>
      <div key={key} className={`min-h-0 flex-1 ${view.kind === 'lesson' ? '' : 'overflow-y-auto'} animate-fadein`}>
        {view.kind === 'home' && <AcademyHome />}
        {view.kind === 'paths' && <PathsList />}
        {view.kind === 'path' && <PathView id={view.id} />}
        {view.kind === 'library' && <Library />}
        {view.kind === 'lesson' && <LessonReader id={view.id} pathId={view.pathId} />}
        {view.kind === 'practice' && <PracticeHub />}
        {view.kind === 'drill' && <DrillRunner id={view.id} pathId={view.pathId} />}
        {view.kind === 'cards' && <CardsReview lessonId={view.lessonId} />}
        {view.kind === 'exams' && <ExamsList />}
        {view.kind === 'exam' && <ExamRunner id={view.id} pathId={view.pathId} />}
        {view.kind === 'certs' && <Certificates />}
        {view.kind === 'certResult' && <CertResult id={view.id} />}
      </div>
    </div>
  )
}
