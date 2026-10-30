// Boîte à outils terrain : modèle de données des fiches réflexes et des
// modèles de documents. Contenu pédagogique, à adapter aux trames du service.

export type ToolboxCategory = 'accueil' | 'urgence' | 'perquisition' | 'requisitions' | 'analyse' | 'redaction' | 'opsec'

export const TOOLBOX_CATEGORIES: Record<ToolboxCategory, { label: string; icon: string; color: string }> = {
  accueil: { label: 'Accueil victime', icon: 'HeartHandshake', color: '#34d399' },
  urgence: { label: 'Urgence', icon: 'Siren', color: '#f43f5e' },
  perquisition: { label: 'Perquisition & saisie', icon: 'PackageOpen', color: '#fb923c' },
  requisitions: { label: 'Réquisitions', icon: 'Send', color: '#22d3ee' },
  analyse: { label: 'Analyse', icon: 'Microscope', color: '#38bdf8' },
  redaction: { label: 'Rédaction', icon: 'FilePenLine', color: '#a78bfa' },
  opsec: { label: 'OPSEC', icon: 'EyeOff', color: '#facc15' },
}

export const TOOLBOX_CATEGORY_ORDER: ToolboxCategory[] = ['accueil', 'urgence', 'perquisition', 'requisitions', 'analyse', 'redaction', 'opsec']

// ── Fiches réflexes ────────────────────────────────────────────────────────

export interface ChecklistItem {
  text: string
  /** Précision affichée sous l'item (comment faire, pourquoi). */
  detail?: string
  /** Étape à ne surtout pas manquer (perte de preuve ou de fonds sinon). */
  critique?: boolean
}

export interface FicheSection {
  title: string
  items: ChecklistItem[]
}

export interface Fiche {
  id: string
  title: string
  category: ToolboxCategory
  icon: string
  summary: string
  /** Situations dans lesquelles sortir la fiche. */
  when: string
  sections: FicheSection[]
  pitfalls: string[]
  /** Identifiants de leçons du curriculum. */
  lessons: string[]
  /** Outils de SPECTRA ou réflexes d'outillage utiles. */
  tools?: string[]
  /** Identifiants de modèles de documents liés. */
  modeles?: string[]
}

// ── Modèles de documents ───────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'date' | 'select'

/** Valeurs par défaut calculées à l'ouverture du modèle. */
export type FieldDefault = { from: 'officer' | 'unit' | 'today' } | { value: string }

export interface ModeleField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  default?: FieldDefault
  /** Aide sous le champ (format attendu…). */
  help?: string
  /** Pour le type « select ». */
  options?: { value: string; label: string }[]
  /** Champ sur toute la largeur du formulaire. */
  wide?: boolean
}

export type FieldValues = Record<string, string>

export interface Modele {
  id: string
  title: string
  category: ToolboxCategory
  icon: string
  description: string
  fields: ModeleField[]
  /** Document HTML complet, A4, prêt à imprimer. */
  render(v: FieldValues): string
  /** Version texte brut, pour copier-coller dans un logiciel de rédaction. */
  text(v: FieldValues): string
  lessons?: string[]
}
