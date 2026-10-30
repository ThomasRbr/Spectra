// Modèle pédagogique de réquisition à un prestataire de services sur
// crypto-actifs. À adapter aux trames et aux textes en vigueur.
import { CHAINS } from '../engine/chains'
import { COOPERATION_LABEL, type Entity } from '../engine/entities'
import type { World } from '../engine/world'

export type Cadre = 'flagrance' | 'preliminaire' | 'instruction'

export const CADRE_LABEL: Record<Cadre, { label: string; articles: string }> = {
  flagrance: { label: 'Enquête de flagrance', articles: 'articles 60-1 et 60-2 du code de procédure pénale' },
  preliminaire: { label: 'Enquête préliminaire', articles: 'articles 77-1-1 et 77-1-2 du code de procédure pénale' },
  instruction: { label: 'Commission rogatoire', articles: 'articles 99-3, 99-4 et 151 et suivants du code de procédure pénale' },
}

export interface RequisitionInput {
  w: World
  entity: Entity
  addresses: string[]
  txIds: string[]
  cadre: Cadre
  officer: string
  unit: string
  procedure: string
  magistrate: string
  from: string
  to: string
  freeze: boolean
}

export function requisitionText(p: RequisitionInput): string {
  const c = CADRE_LABEL[p.cadre]
  const addrLines = p.addresses.map((id) => {
    const a = p.w.get(id)
    return `   - ${a.addr} (réseau ${CHAINS[a.chain].name}${a.chain === 'ton' && a.addr.startsWith('UQ') ? ', forme non-bounceable ; la même adresse s\'écrit aussi en « EQ… » bounceable ou en forme brute 0:…' : ''})`
  })
  const txLines = p.txIds.map((id) => {
    const t = p.w.tx(id)
    const d = new Date(t.time * 1000).toISOString().replace('T', ' ').slice(0, 19)
    return `   - ${t.hash} (${CHAINS[t.chain].name}, ${d} UTC${t.memo ? `, ${t.chain === 'xrp' ? 'destination tag' : t.chain === 'ton' ? 'commentaire (memo)' : 'destination tag / memo'} ${t.memo}` : ''})`
  })
  const authorisation =
    p.cadre === 'preliminaire'
      ? `\nVu l'autorisation de ${p.magistrate || 'M./Mme le procureur de la République près le tribunal judiciaire de …'}, en date du …,\n`
      : p.cadre === 'instruction'
        ? `\nVu la commission rogatoire délivrée par ${p.magistrate || 'M./Mme …, juge d\'instruction au tribunal judiciaire de …'}, en date du …,\n`
        : ''
  const foreign = p.entity.compliance && p.entity.compliance.cooperation !== 'direct'
  return [
    'RÉQUISITION JUDICIAIRE',
    `(${c.label} — ${c.articles})`,
    '',
    `Nous, ${p.officer || '[NOM Prénom, grade]'}, officier de police judiciaire en résidence à ${p.unit || '[unité]'},`,
    `agissant dans le cadre de la procédure n° ${p.procedure || '[numéro]'},`,
    authorisation,
    `REQUÉRONS : ${p.entity.name}${p.entity.country ? ` (${p.entity.country})` : ''}`,
    `Contact conformité : ${p.entity.compliance?.contact ?? '—'}`,
    '',
    `de bien vouloir nous communiquer, pour la période du ${p.from || '…'} au ${p.to || '…'}, les informations suivantes concernant :`,
    addrLines.length ? '  • la ou les adresses de dépôt :' : '',
    ...addrLines,
    txLines.length ? '  • la ou les transactions :' : '',
    ...txLines,
    '',
    '1. L\'identité complète du ou des titulaires du compte client associé et les pièces justificatives recueillies (KYC/KYB) ;',
    '2. Les coordonnées rattachées au compte : adresses électroniques, numéros de téléphone, adresse postale ;',
    '3. Les adresses IP de création du compte et de connexion, horodatées (UTC), avec ports sources si disponibles, ainsi que les identifiants d\'appareils et agents utilisateurs ;',
    '4. L\'historique des dépôts, retraits, conversions et transferts internes, avec les adresses et réseaux de retrait ;',
    '5. Les moyens de paiement associés (IBAN, cartes, prestataires de paiement) et les opérations fiat correspondantes ;',
    '6. Les comptes liés (mêmes données d\'identification, appareils, IP ou moyens de paiement) ;',
    '7. Le solde actuel du compte par actif.',
    '',
    p.freeze
      ? 'Compte tenu du caractère frauduleux présumé des fonds, nous sollicitons en outre le blocage conservatoire des avoirs détenus sur ce compte, dans l\'attente d\'une décision de l\'autorité judiciaire, et vous remercions de nous confirmer le montant bloqué.\n'
      : '',
    'Nous vous demandons de ne pas informer le titulaire du compte de la présente réquisition.',
    p.cadre !== 'instruction' && !foreign
      ? 'Nous vous rappelons que le fait de s\'abstenir de répondre dans les meilleurs délais à cette réquisition, sans motif légitime, est puni d\'une amende de 3 750 euros.'
      : '',
    '',
    'Les éléments sont à transmettre par voie sécurisée à l\'adresse : [adresse de messagerie du service].',
    '',
    `Fait à …, le ${new Date().toLocaleDateString('fr-FR')}`,
    'L\'officier de police judiciaire',
    '',
    foreign ? `NB : prestataire établi hors de France — voie recommandée : ${COOPERATION_LABEL[p.entity.compliance!.cooperation]}.` : '',
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
}
