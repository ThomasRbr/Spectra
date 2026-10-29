// Aides partagées par les scénarios : identités fictives, dates, montants.
import type { Rng } from '../engine/rng'
import { CHAINS, fmtAsset, type AssetId } from '../engine/chains'
import type { Tx, World } from '../engine/world'
import type { Entity } from '../engine/entities'

const FIRST_F = ['Claire', 'Sophie', 'Nathalie', 'Isabelle', 'Camille', 'Sandrine', 'Léa', 'Martine', 'Valérie', 'Chantal', 'Émilie', 'Aurélie', 'Inès', 'Mélanie']
const FIRST_M = ['Julien', 'Marc', 'Thierry', 'Pascal', 'Hugo', 'Didier', 'Bruno', 'Antoine', 'Yannick', 'Kevin', 'Patrick', 'Gérard', 'Rachid', 'Olivier']
const FIRST = [...FIRST_F, ...FIRST_M]
const LAST = ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Roux', 'Fournier', 'Morel', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Perrin', 'Robin', 'Masson', 'Henry', 'Gauthier', 'Lemoine', 'Benali', 'Nguyen', 'Da Silva', 'Lambert']
const CITIES = ['Rennes', 'Lyon', 'Toulouse', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Montpellier', 'Dijon', 'Angers', 'Grenoble', 'Clermont-Ferrand', 'Tours', 'Brest', 'Metz', 'Reims', 'Caen', 'Annecy']
const HANDLES = ['crypt0_lord', 'darkpeel', 'satoshi_fr', 'm0neyman', 'shadowfox', 'v3nom', 'n1ghtcr4wl', 'kr4ken_xx', 'ghost_btc', 'b1tbandit', 'rapt0r', 'zer0trace', 'icewall', 'goldfinch', 'blackmamba77']

export function fakeName(r: Rng): string {
  return `${r.pick(FIRST)} ${r.pick(LAST).toUpperCase()}`
}

export interface FakePerson {
  name: string
  female: boolean
  /** Accord en genre : `g('convaincu', 'convaincue')`. */
  g: (masc: string, fem: string) => string
}

/** Identité fictive avec genre connu (pour accorder les textes). */
export function fakePerson(r: Rng, gender?: 'f' | 'm'): FakePerson {
  const female = gender ? gender === 'f' : r.chance(0.5)
  const name = `${r.pick(female ? FIRST_F : FIRST_M)} ${r.pick(LAST).toUpperCase()}`
  return { name, female, g: (masc, fem) => (female ? fem : masc) }
}

/**
 * Options d'un QCM mélangées (évite que la bonne réponse soit toujours au même
 * rang). À appeler après la génération du monde : consomme l'aléa.
 */
export function choice(r: Rng, correct: string, wrong: string[]): { options: string[]; answer: number } {
  const options = r.shuffle([correct, ...wrong])
  return { options, answer: options.indexOf(correct) }
}

/** Voie procédurale pour obtenir les données d'un prestataire (texte prudent, calculé depuis la fiche conformité). */
export function procedureFor(e: Entity): string {
  const c = e.compliance
  const where = e.country && !['Inconnu', '—'].includes(e.country) ? ` (siège : ${e.country})` : ''
  switch (c?.cooperation) {
    case 'direct':
      return `${e.name}${where} est établi en France : réquisition judiciaire directe (art. 60-1, 77-1-1 ou 99-3 du CPP selon le cadre d'enquête).`
    case 'voluntary':
      return `${e.name}${where} n'est pas établi en France mais répond en pratique aux réquisitions des forces de l'ordre (${c.portal ?? c.contact}) ; cette coopération reste volontaire, et une demande d'entraide pénale peut être nécessaire si la plateforme refuse ou pour un usage contraignant.`
    case 'eio':
      return `${e.name}${where} est établi dans un autre État membre de l'UE : décision d'enquête européenne (DEE), éventuellement précédée d'une demande de préservation et d'une coopération volontaire sur les données de base.`
    case 'mlat':
      return `${e.name}${where} relève d'un État tiers : demande d'entraide pénale internationale, aux délais longs (plusieurs mois).`
    case 'none':
      return `${e.name}${where} ne coopère pas : l'exposition est à documenter et à signaler (TRACFIN, partenaires), sans attendre de réponse.`
    default:
      return `${e.name} : voie de coopération à déterminer.`
  }
}

export function fakeCity(r: Rng): string {
  return r.pick(CITIES)
}

export function fakeHandle(r: Rng): string {
  return `${r.pick(HANDLES)}${r.chance(0.5) ? r.int(1, 99) : ''}`
}

export function fakePhone(r: Rng): string {
  return `+33 6 ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)}`
}

export function fmtDate(ts: number, withTime = true): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString('fr-FR', withTime ? { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' } : { dateStyle: 'long', timeZone: 'Europe/Paris' })
}

/** Adresse lisible d'un id (`btc:bc1q…` → `bc1q…`). */
export function A(w: World, id: string): string {
  return w.get(id).addr
}

export function amt(v: number, asset: AssetId): string {
  return fmtAsset(v, asset)
}

/** Transfère tout le solde d'une adresse vers une autre (sans rendu). */
export function forwardAll(w: World, from: string, to: string, time: number, asset?: AssetId, tags?: string[]): Tx {
  const a = w.get(from)
  if (CHAINS[a.chain].model === 'utxo') {
    const total = w.unspentValue(from, time)
    const fee = w.estimateFee(a.chain, Math.max(1, w.utxosOf(from, time).length), 1)
    return w.utxoTx({ time, from: [from], to: [{ address: to, value: total - fee }], fee, change: null, spendAll: true, tags })
  }
  const as = asset ?? CHAINS[a.chain].native
  return w.transfer({ time, from, to, value: w.balanceOf(from, as), asset: as, tags })
}

/** Valeur reçue par `to` dans la transaction (actif natif ou jeton). */
export function receivedIn(w: World, tx: Tx, to: string): number {
  return w.flowIn(tx, to).reduce((s, f) => s + f.value, 0)
}
