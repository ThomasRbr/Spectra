// Outils communs aux exercices générés : mélange des options, formatage
// français des nombres, horodatages et prénoms fictifs.
import { Rng, hashSeed } from '../../engine/rng'

/**
 * Construit une question à choix : la bonne réponse est placée à une position
 * aléatoire parmi `n` options distinctes (les distracteurs en double ou égaux à
 * la bonne réponse sont écartés).
 */
export function mkChoice(rng: Rng, correct: string, distractors: string[], n = 4): { options: string[]; answer: number } {
  const seen = new Set<string>([correct])
  const pool: string[] = []
  for (const d of distractors) {
    if (!seen.has(d)) {
      seen.add(d)
      pool.push(d)
    }
  }
  const chosen = pool.slice(0, Math.max(2, n - 1))
  const options = rng.shuffle([correct, ...chosen])
  return { options, answer: options.indexOf(correct) }
}

/** Comme mkChoice, mais tire les distracteurs au hasard dans `pool`. */
export function mkChoiceRandom(rng: Rng, correct: string, pool: string[], n = 4): { options: string[]; answer: number } {
  return mkChoice(rng, correct, rng.shuffle(pool.filter((p) => p !== correct)), n)
}

/** Nombre au format français avec un nombre fixe de décimales. */
export function fr(v: number, decimals = 0): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Nombre au format français, décimales significatives seulement (max `max`). */
export function frMax(v: number, max = 8): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: max })
}

/** Montant en unité de base entière (sats…) affiché en unité principale à 8 décimales. */
export function coin(sats: number, unit = 'BTC'): string {
  return `${fr(sats / 1e8, 8)} ${unit}`
}

export const EPOCH = 1704067200 // 2024-01-01T00:00:00Z

/** Horodatage déterministe entre début 2024 et mi-2026, en journée (8 h–18 h UTC). */
export function dayTime(rng: Rng): number {
  return EPOCH + rng.int(10, 880) * 86400 + rng.int(8 * 3600, 18 * 3600)
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Date lisible (jour mois année), calculée en UTC pour rester déterministe. */
export function frDate(t: number): string {
  const d = new Date(t * 1000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export const FIRST_NAMES = ['Martine', 'Gérard', 'Sophie', 'Julien', 'Nadia', 'Patrick', 'Claire', 'Karim', 'Isabelle', 'Thierry', 'Camille', 'Hugo', 'Léa', 'Bernard', 'Inès', 'Antoine', 'Monique', 'Yannick', 'Chantal', 'Mehdi']
export const CITIES = ['Rennes', 'Limoges', 'Annecy', 'Nancy', 'Perpignan', 'Tours', 'Brest', 'Valence', 'Colmar', 'Pau', 'Angers', 'Chambéry', 'Niort', 'Arras']

/** Lettres A, B, C… */
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Liste française : « A, B et C ». */
export function frList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

/** Générateur propre à un exercice : la même graine donne des tirages différents d'un exercice à l'autre. */
export function rngFor(seed: number, id: string): Rng {
  return new Rng((Math.imul(seed >>> 0, 0x9e3779b1) ^ hashSeed(id)) >>> 0)
}

/** « de Tron », « d'Ethereum ». */
export function de(name: string): string {
  return /^[aeiouyéèêhAEIOUYÉH]/.test(name) ? `d'${name}` : `de ${name}`
}
