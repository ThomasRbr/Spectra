export interface LessonSection {
  heading: string
  /**
   * Markdown léger : paragraphes séparés par une ligne vide, listes « - »,
   * listes numérotées « 1. », **gras**, `code`, et encadrés commençant par
   * « > » (astuce), « !> » (attention) ou « ⚖> » (point juridique).
   */
  body: string
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface Lesson {
  id: string
  title: string
  group: 'Fondamentaux' | 'Bitcoin' | 'Ethereum & co' | 'Inter-chaînes' | 'Confidentialité' | 'Typologies' | 'Enquête'
  minutes: number
  summary: string
  sections: LessonSection[]
  keyPoints: string[]
  quiz: QuizQuestion[]
}

export interface GlossaryEntry {
  term: string
  def: string
}
