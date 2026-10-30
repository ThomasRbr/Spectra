// Boîte à outils terrain : fiches réflexes et modèles de documents.
import { CURRICULUM } from '../model'
import { BLANK, docToHtml, type Doc, type DocBlock } from './doc'
import { FICHES } from './fiches'
import { MODELES } from './modeles'
import type { Fiche, FieldValues, Modele } from './types'
import { TOOLBOX_CATEGORIES } from './types'

export * from './types'
export { FICHES } from './fiches'
export { MODELES } from './modeles'
export { NOTICE } from './doc'

export function ficheById(id: string): Fiche | undefined {
  return FICHES.find((f) => f.id === id)
}

export function modeleById(id: string): Modele | undefined {
  return MODELES.find((m) => m.id === id)
}

/** Titre d'une leçon du curriculum (les identifiants inconnus sont ignorés). */
export function lessonTitle(id: string): string | undefined {
  return CURRICULUM.find((c) => c.id === id)?.title
}

/** Clé stable d'un item de checklist : « section.item ». */
export function itemKey(section: number, item: number): string {
  return `${section}.${item}`
}

export function ficheItemCount(f: Fiche): number {
  return f.sections.reduce((s, sec) => s + sec.items.length, 0)
}

/** Texte indexé pour la recherche. */
export function ficheHaystack(f: Fiche): string {
  return [f.title, f.summary, f.when, TOOLBOX_CATEGORIES[f.category].label, ...f.sections.flatMap((s) => [s.title, ...s.items.flatMap((i) => [i.text, i.detail ?? ''])]), ...f.pitfalls].join(' ').toLowerCase()
}

export function modeleHaystack(m: Modele): string {
  return [m.title, m.description, TOOLBOX_CATEGORIES[m.category].label, ...m.fields.map((f) => f.label)].join(' ').toLowerCase()
}

/** Valeurs initiales d'un modèle, à partir du profil de l'enquêteur. */
export function initialValues(m: Modele, profile: { name: string; unit: string }): FieldValues {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // Le nom par défaut du profil n'est pas un nom d'enquêteur : on laisse la ligne vide.
  const officer = profile.name && profile.name !== 'Enquêteur' ? profile.name : ''
  const out: FieldValues = {}
  for (const f of m.fields) {
    const def = f.default
    if (!def) out[f.key] = ''
    else if ('value' in def) out[f.key] = def.value
    else out[f.key] = def.from === 'officer' ? officer : def.from === 'unit' ? profile.unit : today
  }
  return out
}

/** Fiche réflexe imprimable : cases à cocher vierges, items critiques signalés. */
export function ficheHtml(f: Fiche): string {
  const blocks: DocBlock[] = [
    { k: 'title', text: f.title, sub: `Fiche réflexe — ${TOOLBOX_CATEGORIES[f.category].label}` },
    { k: 'meta', rows: [['Procédure n°', BLANK], ['Enquêteur', BLANK], ['Date', BLANK]] },
    { k: 'p', text: f.summary },
    { k: 'note', text: `Quand l'utiliser : ${f.when}` },
  ]
  for (const s of f.sections) {
    blocks.push({ k: 'h', text: s.title })
    blocks.push({ k: 'checks', items: s.items.map((i) => `${i.critique ? '**[CRITIQUE]** ' : ''}${i.critique ? `**${i.text}**` : i.text}${i.detail ? ` — ${i.detail}` : ''}`) })
  }
  blocks.push({ k: 'h', text: 'Pièges à éviter' }, { k: 'list', items: f.pitfalls })
  const lessons = f.lessons.map(lessonTitle).filter((x): x is string => !!x)
  if (lessons.length) blocks.push({ k: 'h', text: 'Pour aller plus loin (Académie SPECTRA)' }, { k: 'list', items: lessons })
  blocks.push({ k: 'h', text: 'Notes' }, { k: 'lines', n: 5 })
  const doc: Doc = { title: f.title, blocks }
  return docToHtml(doc, { printButton: true })
}
