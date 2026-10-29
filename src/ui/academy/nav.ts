import type { PathStep } from '../../academy'
import { randomSeed } from '../../engine/rng'
import { useUi } from '../../store/ui'
import { launchCase } from '../pages/Missions'

/** Ouvre l'écran correspondant à une étape de parcours. */
export function goToStep(step: PathStep, pathId?: string) {
  const ui = useUi.getState()
  switch (step.kind) {
    case 'lesson':
      ui.openLesson(step.id, pathId)
      break
    case 'drill':
      ui.openAcademy({ kind: 'drill', id: step.id, pathId })
      break
    case 'exam':
      ui.openAcademy({ kind: 'exam', id: step.id, pathId })
      break
    case 'mission':
      launchCase(step.id, randomSeed())
      break
  }
}
