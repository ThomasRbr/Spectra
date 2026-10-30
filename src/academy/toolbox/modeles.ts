// Modèles de documents de la boîte à outils terrain.
// Modèles pédagogiques : à adapter aux trames du service et aux textes en
// vigueur. Les références juridiques restent volontairement générales.
import { CADRE_LABEL, type Cadre } from '../../lib/requisition'
import { docToHtml, docToText, fdate, fmulti, ftable, fv, type Doc, type DocBlock } from './doc'
import type { FieldValues, Modele, ModeleField } from './types'

// ── Champs communs ─────────────────────────────────────────────────────────

const officer: ModeleField = { key: 'officer', label: 'Rédacteur (grade, NOM Prénom)', type: 'text', placeholder: 'Adjudant DUPONT Jean', default: { from: 'officer' } }
const unit: ModeleField = { key: 'unit', label: 'Unité', type: 'text', placeholder: 'Section de recherches de …', default: { from: 'unit' } }
const procedure: ModeleField = { key: 'procedure', label: 'N° de procédure', type: 'text', placeholder: '01234/2026' }
const date: ModeleField = { key: 'date', label: 'Date du document', type: 'date', default: { from: 'today' } }
const lieu: ModeleField = { key: 'lieu', label: 'Fait à', type: 'text', placeholder: 'Ville' }
const cadre: ModeleField = {
  key: 'cadre',
  label: 'Cadre d\'enquête',
  type: 'select',
  default: { value: 'preliminaire' },
  options: (Object.keys(CADRE_LABEL) as Cadre[]).map((k) => ({ value: k, label: CADRE_LABEL[k].label })),
}
const magistrat: ModeleField = { key: 'magistrat', label: 'Magistrat (autorisation ou commission rogatoire)', type: 'text', placeholder: 'M./Mme …, procureur de la République près le tribunal judiciaire de …', wide: true }
const dateAut: ModeleField = { key: 'dateAut', label: 'Date de l\'autorisation / de la CR', type: 'date', help: 'Sans objet en flagrance.' }
const retour: ModeleField = { key: 'retour', label: 'Adresse de retour sécurisée', type: 'text', placeholder: 'adresse de messagerie du service' }

function cadreOf(v: FieldValues): Cadre {
  return (v.cadre as Cadre) in CADRE_LABEL ? (v.cadre as Cadre) : 'preliminaire'
}

/** En-tête commun aux réquisitions, aligné sur src/lib/requisition.ts. */
function requisitionHead(v: FieldValues, destinataire: string): DocBlock[] {
  const c = CADRE_LABEL[cadreOf(v)]
  const blocks: DocBlock[] = [
    { k: 'title', text: 'Réquisition judiciaire', sub: `(${c.label} — ${c.articles})` },
    { k: 'meta', rows: [['Procédure n°', fv(v, 'procedure')], ['Unité', fv(v, 'unit')]] },
    { k: 'p', text: `Nous, ${fv(v, 'officer')}, officier de police judiciaire en résidence à ${fv(v, 'unit')}, agissant dans le cadre de la procédure n° ${fv(v, 'procedure')},` },
  ]
  if (cadreOf(v) === 'preliminaire') blocks.push({ k: 'p', text: `Vu l'autorisation de ${fv(v, 'magistrat')}, en date du ${fdate(v, 'dateAut')},` })
  if (cadreOf(v) === 'instruction') blocks.push({ k: 'p', text: `Vu la commission rogatoire délivrée par ${fv(v, 'magistrat')}, en date du ${fdate(v, 'dateAut')},` })
  blocks.push({ k: 'p', text: `**REQUÉRONS : ${destinataire}**` })
  return blocks
}

/** Clôture commune : non-information, rappel de l'obligation, signature. */
function requisitionTail(v: FieldValues, foreign: boolean): DocBlock[] {
  const blocks: DocBlock[] = [{ k: 'p', text: 'Nous vous demandons de ne pas informer le titulaire ou l\'utilisateur concerné de la présente réquisition.' }]
  if (cadreOf(v) !== 'instruction' && !foreign)
    blocks.push({ k: 'p', text: 'Nous vous rappelons que le fait de s\'abstenir de répondre dans les meilleurs délais à cette réquisition, sans motif légitime, est puni d\'une amende de 3 750 euros.' })
  blocks.push(
    { k: 'p', text: `Les éléments sont à transmettre par voie sécurisée à l'adresse : ${fv(v, 'retour')}.` },
    { k: 'sign', right: [`Fait à ${fv(v, 'lieu')}, le ${fdate(v, 'date')}`, 'L\'officier de police judiciaire', '', fv(v, 'officer')] },
  )
  if (foreign)
    blocks.push({ k: 'note', text: 'Prestataire établi hors de France : vérifier la voie adaptée (demande directe acceptée par la plateforme, décision d\'enquête européenne ou demande d\'entraide pénale internationale) et les éventuelles exigences de traduction.' })
  return blocks
}

function make(m: Omit<Modele, 'render' | 'text'> & { build(v: FieldValues): Doc }): Modele {
  const { build, ...rest } = m
  return {
    ...rest,
    render: (v) => docToHtml(build(v), { printButton: true }),
    text: (v) => docToText(build(v)),
  }
}

// ── Modèles ────────────────────────────────────────────────────────────────

export const MODELES: Modele[] = [
  make({
    id: 'pv-constatations',
    title: 'PV de constatations blockchain',
    category: 'redaction',
    icon: 'FileSearch',
    description: 'Procès-verbal décrivant des consultations d\'explorateurs ou d\'outils d\'analyse : moyens, objet, constatations horodatées, captures annexées.',
    lessons: ['explorateur-blocs', 'rapport', 'opsec-enqueteur'],
    fields: [
      officer,
      { key: 'qualite', label: 'Qualité', type: 'text', default: { value: 'officier de police judiciaire' } },
      unit,
      procedure,
      cadre,
      { ...magistrat, help: 'Pour une commission rogatoire.' },
      date,
      { key: 'heure', label: 'Heure de début', type: 'text', placeholder: '14 h 30' },
      { key: 'heureFin', label: 'Heure de fin', type: 'text', placeholder: '16 h 05' },
      { key: 'outils', label: 'Moyens utilisés', type: 'textarea', wide: true, default: { value: 'Poste dédié aux recherches en sources ouvertes\nExplorateur de blocs public : …\nOutil d\'analyse : … (version …)' } },
      { key: 'objet', label: 'Objet des constatations', type: 'textarea', wide: true, placeholder: 'Adresse(s), transaction(s) ou compte(s) consultés, avec le réseau', help: 'Coller les adresses et hash, ne pas les retaper.' },
      { key: 'constatations', label: 'Constatations', type: 'textarea', wide: true, placeholder: 'Une constatation par ligne : date UTC, transaction, montant, contrepartie, solde…' },
      { key: 'annexes', label: 'Annexes', type: 'textarea', wide: true, placeholder: 'Capture n° 1 : page de l\'adresse … consultée le … à … UTC' },
    ],
    build: (v) => {
      const c = cadreOf(v)
      return {
        title: 'PV de constatations blockchain',
        blocks: [
          { k: 'title', text: 'Procès-verbal', sub: 'Constatations sur la blockchain' },
          { k: 'meta', rows: [['Procédure n°', fv(v, 'procedure')], ['Unité', fv(v, 'unit')], ['Cadre', CADRE_LABEL[c].label]] },
          { k: 'p', text: `Le ${fdate(v, 'date')}, à ${fv(v, 'heure')},` },
          { k: 'p', text: `Nous, ${fv(v, 'officer')}, ${fv(v, 'qualite')} en résidence à ${fv(v, 'unit')},` },
          { k: 'p', text: `Agissant en ${CADRE_LABEL[c].label.toLowerCase()}${c === 'instruction' ? `, en exécution de la commission rogatoire délivrée par ${fv(v, 'magistrat')}` : ''}, poursuivant l'enquête relative à la procédure visée en référence,` },
          { k: 'p', text: 'Procédons aux constatations suivantes, par simple consultation de données publiquement accessibles et sans aucune interaction (envoi de fonds, message, connexion d\'un portefeuille) avec les adresses consultées :' },
          { k: 'h', text: 'Moyens utilisés' },
          fmulti(v, 'outils', 3),
          { k: 'h', text: 'Objet des constatations' },
          fmulti(v, 'objet', 3),
          { k: 'h', text: 'Constatations' },
          fmulti(v, 'constatations', 10),
          { k: 'note', text: 'Les horodatages sont exprimés en temps universel coordonné (UTC). Les adresses et identifiants de transaction sont reproduits par copie numérique, sans ressaisie manuelle.' },
          { k: 'h', text: 'Conservation des constatations' },
          { k: 'p', text: 'Les pages consultées font l\'objet de captures d\'écran horodatées et d\'exports, annexés au présent procès-verbal :' },
          fmulti(v, 'annexes', 3),
          { k: 'p', text: `Constatations terminées à ${fv(v, 'heureFin')}.` },
          { k: 'sign', right: [`L'${(v.qualite ?? '').trim() || 'officier de police judiciaire'}`, '', fv(v, 'officer')] },
        ],
      }
    },
  }),

  make({
    id: 'gel-stablecoin',
    title: 'Demande de gel à un émetteur de stablecoin',
    category: 'urgence',
    icon: 'Snowflake',
    description: 'Demande urgente d\'inscription d\'adresses sur liste noire (USDT, USDC…) avec résumé en anglais, à doubler par les voies formelles exigées par l\'émetteur.',
    lessons: ['gel-stablecoins', 'stablecoins', 'tron-usdt'],
    fields: [
      { key: 'issuer', label: 'Émetteur destinataire', type: 'text', placeholder: 'Tether / Circle / autre émetteur' },
      { key: 'issuerContact', label: 'Canal de l\'émetteur', type: 'text', placeholder: 'Portail ou adresse dédiés aux autorités' },
      officer,
      unit,
      { key: 'contact', label: 'Joignabilité du requérant', type: 'text', placeholder: 'Téléphone, messagerie sécurisée' },
      procedure,
      magistrat,
      { key: 'actif', label: 'Actif', type: 'text', default: { value: 'USDT' } },
      { key: 'reseau', label: 'Réseau', type: 'text', placeholder: 'Tron (TRC-20), Ethereum (ERC-20)…' },
      { key: 'qualification', label: 'Infraction présumée', type: 'text', placeholder: 'escroquerie, extorsion, blanchiment…' },
      { key: 'prejudice', label: 'Préjudice estimé', type: 'text', placeholder: '45 000 USDT' },
      { key: 'faits', label: 'Exposé succinct des faits', type: 'textarea', wide: true, placeholder: 'Qui, quand, comment, chemin des fonds jusqu\'aux adresses visées' },
      { key: 'adresses', label: 'Adresses visées', type: 'textarea', wide: true, placeholder: 'TXyz… ; Tron ; 30 000 USDT', help: 'Une ligne par adresse : adresse ; réseau ; montant estimé.' },
      { key: 'hashes', label: 'Transactions de référence (hash)', type: 'textarea', wide: true, placeholder: 'Un hash par ligne, avec date UTC' },
      lieu,
      date,
    ],
    build: (v) => {
      const rows = ftable(v, 'adresses', 3)
      return {
        title: 'Demande de gel — stablecoin',
        blocks: [
          { k: 'title', text: 'Demande de gel conservatoire', sub: 'Urgent law enforcement freeze request' },
          {
            k: 'meta',
            rows: [
              ['Destinataire', fv(v, 'issuer')],
              ['Canal', fv(v, 'issuerContact')],
              ['Service requérant', fv(v, 'unit')],
              ['Procédure n°', fv(v, 'procedure')],
              ['Date', fdate(v, 'date')],
            ],
          },
          { k: 'h', text: 'Objet' },
          { k: 'p', text: `Gel immédiat (inscription sur liste noire) des ${fv(v, 'actif')} détenus aux adresses ci-dessous, sur le réseau ${fv(v, 'reseau')}, et conservation des données associées.` },
          { k: 'h', text: 'Exposé des faits' },
          fmulti(v, 'faits', 4),
          { k: 'p', text: `Infraction présumée : ${fv(v, 'qualification')}. Préjudice estimé : ${fv(v, 'prejudice')}.` },
          { k: 'h', text: 'Adresses visées' },
          { k: 'table', headers: ['Adresse', 'Réseau', 'Montant estimé'], rows, blankRows: rows.length ? 0 : 3, widths: [62, 18, 20] },
          { k: 'h', text: 'Transactions de référence' },
          fmulti(v, 'hashes', 3),
          { k: 'h', text: 'Demandes' },
          {
            k: 'list',
            ordered: true,
            items: [
              'Le gel immédiat, à titre conservatoire, des actifs détenus aux adresses visées, dans l\'attente d\'une décision de l\'autorité judiciaire ;',
              'La confirmation écrite du gel, avec le montant gelé par adresse et son horodatage ;',
              'La conservation de toutes les données relatives à ces adresses ;',
              'L\'indication des formalités complémentaires requises (réquisition, décision judiciaire, entraide) et du délai de maintien du gel dans l\'attente de ces formalités.',
            ],
          },
          { k: 'p', text: `Procédure suivie sous l'autorité de ${fv(v, 'magistrat')}. Nous vous remercions de ne pas informer les détenteurs des adresses visées.` },
          { k: 'h', text: 'Summary (English)' },
          {
            k: 'p',
            text: `Law enforcement request from ${fv(v, 'unit')} (France), criminal proceedings no. ${fv(v, 'procedure')}, under the authority of ${fv(v, 'magistrat')}. We kindly request the immediate freeze of the ${fv(v, 'actif')} held at the addresses listed above (${fv(v, 'reseau')} network), which are linked to the suspected offence described. Please confirm the frozen amounts in writing, preserve all related data and let us know which formal legal process your policy requires.`,
          },
          { k: 'sign', right: [`Fait à ${fv(v, 'lieu')}, le ${fdate(v, 'date')}`, fv(v, 'officer'), fv(v, 'unit'), fv(v, 'contact')] },
        ],
      }
    },
  }),

  make({
    id: 'requisition-psan',
    title: 'Réquisition à un PSAN / exchange',
    category: 'requisitions',
    icon: 'Building2',
    description: 'Identification du titulaire d\'une adresse de dépôt, connexions, flux, moyens de paiement et blocage conservatoire. Même trame que le générateur de l\'espace d\'enquête.',
    lessons: ['requisitions', 'exchanges', 'cooperation-internationale'],
    fields: [
      cadre,
      officer,
      unit,
      procedure,
      magistrat,
      dateAut,
      { key: 'prestataire', label: 'Prestataire requis', type: 'text', placeholder: 'Raison sociale (pays)' },
      { key: 'contact', label: 'Contact conformité', type: 'text', placeholder: 'Portail forces de l\'ordre / adresse dédiée' },
      {
        key: 'etab',
        label: 'Établissement du prestataire',
        type: 'select',
        default: { value: 'france' },
        options: [
          { value: 'france', label: 'En France' },
          { value: 'etranger', label: 'Hors de France' },
        ],
      },
      { key: 'from', label: 'Période : du', type: 'date' },
      { key: 'to', label: 'au', type: 'date' },
      { key: 'adresses', label: 'Adresses de dépôt', type: 'textarea', wide: true, placeholder: 'adresse (réseau)', help: 'Une ligne par adresse, avec le réseau et le memo / tag éventuel.' },
      { key: 'txs', label: 'Transactions', type: 'textarea', wide: true, placeholder: 'hash (réseau, date UTC)' },
      {
        key: 'gel',
        label: 'Blocage conservatoire',
        type: 'select',
        default: { value: 'oui' },
        options: [
          { value: 'oui', label: 'Demander le blocage' },
          { value: 'non', label: 'Identification seule' },
        ],
      },
      retour,
      lieu,
      date,
    ],
    build: (v) => {
      const foreign = v.etab === 'etranger'
      return {
        title: 'Réquisition PSAN',
        blocks: [
          ...requisitionHead(v, fv(v, 'prestataire')),
          { k: 'p', text: `Contact conformité : ${fv(v, 'contact')}` },
          { k: 'p', text: `de bien vouloir nous communiquer, pour la période du ${fdate(v, 'from')} au ${fdate(v, 'to')}, les informations suivantes concernant la ou les adresses de dépôt :` },
          fmulti(v, 'adresses', 2),
          { k: 'p', text: 'et la ou les transactions :' },
          fmulti(v, 'txs', 2),
          {
            k: 'list',
            ordered: true,
            items: [
              'L\'identité complète du ou des titulaires du compte client associé et les pièces justificatives recueillies (KYC/KYB) ;',
              'Les coordonnées rattachées au compte : adresses électroniques, numéros de téléphone, adresse postale ;',
              'Les adresses IP de création du compte et de connexion, horodatées (UTC), avec ports sources si disponibles, ainsi que les identifiants d\'appareils et agents utilisateurs ;',
              'L\'historique des dépôts, retraits, conversions et transferts internes, avec les adresses et réseaux de retrait ;',
              'Les moyens de paiement associés (IBAN, cartes, prestataires de paiement) et les opérations fiat correspondantes ;',
              'Les comptes liés (mêmes données d\'identification, appareils, IP ou moyens de paiement) ;',
              'Le solde actuel du compte par actif.',
            ],
          },
          ...(v.gel !== 'non'
            ? [{ k: 'p', text: 'Compte tenu du caractère frauduleux présumé des fonds, nous sollicitons en outre le blocage conservatoire des avoirs détenus sur ce compte, dans l\'attente d\'une décision de l\'autorité judiciaire, et vous remercions de nous confirmer le montant bloqué.' } as DocBlock]
            : []),
          ...requisitionTail(v, foreign),
        ],
      }
    },
  }),

  make({
    id: 'requisition-dab',
    title: 'Réquisition à un opérateur de DAB crypto',
    category: 'requisitions',
    icon: 'Banknote',
    description: 'Conservation des images, journal de transaction, données KYC et transactions liées d\'un distributeur de crypto-actifs.',
    lessons: ['dab-cash-p2p', 'requisitions'],
    fields: [
      cadre,
      officer,
      unit,
      procedure,
      magistrat,
      dateAut,
      { key: 'operateur', label: 'Opérateur requis', type: 'text', placeholder: 'Raison sociale' },
      { key: 'machine', label: 'Machine (adresse, identifiant)', type: 'text', placeholder: '12 rue …, 75000 Paris — borne n° …', wide: true },
      { key: 'dateTx', label: 'Date et heure de l\'opération', type: 'text', placeholder: '03/10/2026 vers 15 h 40 (heure de Paris)' },
      { key: 'montant', label: 'Montant en espèces', type: 'text', placeholder: '2 000 €' },
      { key: 'adresse', label: 'Adresse de destination', type: 'text', placeholder: 'bc1q… / T…', wide: true },
      { key: 'hash', label: 'Hash on-chain (si connu)', type: 'text', wide: true },
      { key: 'telephone', label: 'Numéro de téléphone utilisé (si connu)', type: 'text' },
      { key: 'video', label: 'Période d\'images à conserver', type: 'text', placeholder: 'le 03/10/2026 de 15 h 00 à 16 h 30' },
      retour,
      lieu,
      date,
    ],
    build: (v) => ({
      title: 'Réquisition DAB crypto',
      blocks: [
        ...requisitionHead(v, fv(v, 'operateur')),
        { k: 'p', text: 'de bien vouloir, concernant l\'opération suivante :' },
        {
          k: 'meta',
          rows: [
            ['Machine', fv(v, 'machine')],
            ['Date et heure', fv(v, 'dateTx')],
            ['Montant en espèces', fv(v, 'montant')],
            ['Adresse de destination', fv(v, 'adresse')],
            ['Transaction', fv(v, 'hash')],
            ['Téléphone', fv(v, 'telephone')],
          ],
        },
        {
          k: 'list',
          ordered: true,
          items: [
            `Conserver sans délai et nous remettre en copie les enregistrements de la caméra de la machine pour la période ${fv(v, 'video')} ;`,
            'Nous communiquer le journal complet de l\'opération : date et heure, identifiant de la machine, montant en espèces, actif, quantité, cours appliqué, frais, adresse de destination et identifiant de transaction on-chain ;',
            'Nous communiquer les données d\'identification recueillies : numéro de téléphone vérifié, pièce d\'identité, photographie, adresse électronique, selon vos procédures ;',
            'Nous communiquer toutes autres opérations associées au même numéro, à la même identité ou à la même adresse de destination, sur l\'ensemble de vos machines ;',
            'Nous communiquer les adresses IP et identifiants d\'appareils si un compte ou une application a été utilisé ;',
            'Nous indiquer votre statut réglementaire (enregistrement ou agrément) et l\'exploitant du lieu d\'implantation de la machine.',
          ],
        },
        { k: 'note', text: 'Penser à requérir séparément le commerce ou le lieu hôte pour la conservation de ses propres enregistrements vidéo.' },
        ...requisitionTail(v, false),
      ],
    }),
  }),

  make({
    id: 'inventaire-saisie',
    title: 'Inventaire de saisie de crypto-actifs',
    category: 'perquisition',
    icon: 'ClipboardList',
    description: 'Tableau des supports, adresses, montants, transferts et scellés, avec contrôles du double opérateur. Aucune seed en clair.',
    lessons: ['gel-saisie', 'saisie-avancee'],
    fields: [
      procedure,
      unit,
      date,
      { key: 'lieuPerq', label: 'Lieu de l\'opération', type: 'text', wide: true },
      { key: 'personne', label: 'Personne concernée', type: 'text' },
      { key: 'presents', label: 'Personnes présentes / témoins', type: 'text' },
      { ...officer, key: 'operateur', label: 'Opérateur (grade, NOM)' },
      { key: 'controleur', label: 'Contrôleur (grade, NOM)', type: 'text' },
      { key: 'supports', label: 'Supports et éléments d\'accès', type: 'textarea', wide: true, placeholder: 'S1 ; Ledger Nano X noir ; tiroir du bureau ; éteint ; carte de seed jointe (S2)', help: 'Une ligne par élément : scellé ; description ; lieu de découverte ; état ; observations.' },
      { key: 'actifs', label: 'Crypto-actifs identifiés', type: 'textarea', wide: true, placeholder: 'BTC (Bitcoin) ; bc1q… ; 0,4521 BTC ; S1 ; 3f2a… ; S1', help: 'Une ligne par actif : actif / réseau ; adresse ou compte ; montant ; source d\'accès ; hash du transfert ; scellé.' },
      { key: 'walletSaisie', label: 'Adresse(s) du portefeuille de saisie du service', type: 'textarea', wide: true },
      { key: 'observations', label: 'Observations', type: 'textarea', wide: true },
    ],
    build: (v) => {
      const supports = ftable(v, 'supports', 5)
      const actifs = ftable(v, 'actifs', 6)
      return {
        title: 'Inventaire de saisie de crypto-actifs',
        blocks: [
          { k: 'title', text: 'Inventaire de saisie de crypto-actifs', sub: 'Annexe au procès-verbal' },
          {
            k: 'meta',
            rows: [
              ['Procédure n°', fv(v, 'procedure')],
              ['Unité', fv(v, 'unit')],
              ['Date', fdate(v, 'date')],
              ['Lieu', fv(v, 'lieuPerq')],
              ['Personne concernée', fv(v, 'personne')],
              ['Présents / témoins', fv(v, 'presents')],
              ['Opérateur', fv(v, 'operateur')],
              ['Contrôleur', fv(v, 'controleur')],
            ],
          },
          { k: 'h', text: '1. Supports et éléments d\'accès' },
          { k: 'table', headers: ['Scellé n°', 'Description du support', 'Lieu de découverte', 'État constaté', 'Observations'], rows: supports, blankRows: supports.length ? 0 : 6, widths: [11, 30, 21, 16, 22] },
          { k: 'note', text: 'Ne jamais recopier une phrase de récupération, une clé privée, une passphrase ou un code en clair dans cet inventaire : référencer uniquement le scellé qui les contient.' },
          { k: 'h', text: '2. Crypto-actifs identifiés et transférés' },
          { k: 'table', headers: ['Actif / réseau', 'Adresse ou compte', 'Montant constaté', 'Source d\'accès', 'Transfert (hash)', 'Scellé'], rows: actifs, blankRows: actifs.length ? 0 : 6, widths: [13, 27, 14, 13, 23, 10] },
          { k: 'h', text: '3. Portefeuille de saisie du service' },
          fmulti(v, 'walletSaisie', 2),
          { k: 'h', text: '4. Contrôles' },
          {
            k: 'checks',
            items: [
              'Soldes constatés et capturés avant transfert',
              'Adresse de destination vérifiée par l\'opérateur et le contrôleur',
              'Transfert test effectué et reçu',
              'Transferts confirmés et capturés sur un explorateur (hash, bloc, heure UTC, frais)',
              'Absence de reliquat vérifiée (jetons secondaires, autres comptes ou chemins de dérivation)',
              'Éléments d\'accès placés sous scellé distinct',
              'Magistrat avisé des montants saisis par actif',
            ],
          },
          { k: 'h', text: '5. Observations' },
          fmulti(v, 'observations', 4),
          { k: 'sign', left: ['L\'opérateur', '', fv(v, 'operateur')], right: ['Le contrôleur', '', fv(v, 'controleur')] },
          { k: 'p', text: 'Signature de la personne concernée ou mention de son refus :' },
          { k: 'lines', n: 2 },
        ],
      }
    },
  }),

  make({
    id: 'questionnaire-victime',
    title: 'Questionnaire d\'audition de victime (escroquerie crypto)',
    category: 'accueil',
    icon: 'ClipboardCheck',
    description: 'Trame de questions pour l\'audition d\'une victime : contact, paiements, adresses et hash, accès donnés, situation actuelle, pièces à joindre.',
    lessons: ['premiers-reflexes', 'typologies'],
    fields: [
      { key: 'victime', label: 'Victime (NOM Prénom)', type: 'text' },
      officer,
      unit,
      procedure,
      date,
    ],
    build: (v) => ({
      title: 'Questionnaire victime',
      blocks: [
        { k: 'title', text: 'Audition de victime', sub: 'Trame de questions — escroquerie aux crypto-actifs' },
        {
          k: 'meta',
          rows: [
            ['Victime', fv(v, 'victime')],
            ['Procédure n°', fv(v, 'procedure')],
            ['Enquêteur', fv(v, 'officer')],
            ['Unité', fv(v, 'unit')],
            ['Date', fdate(v, 'date')],
          ],
        },
        { k: 'note', text: 'Relever adresses et identifiants de transaction par copie numérique (export, capture), jamais sous la dictée. Si des fonds sont partis depuis moins de quelques heures : interrompre et traiter l\'urgence (gel).' },
        { k: 'h', text: 'A. Le contact' },
        {
          k: 'qa',
          items: [
            { q: 'Comment le premier contact a-t-il eu lieu (date, canal, identité affichée, lien ou numéro) ?' },
            { q: 'Quelle offre ou quelle histoire vous a été présentée (placement, relation, assistance, gain) ?' },
            { q: 'Quels noms, pseudonymes, numéros, adresses e-mail ou identifiants vos interlocuteurs ont-ils utilisés ?' },
            { q: 'Sur quels sites ou applications vous a-t-on fait inscrire (nom exact, adresse du site, lien de téléchargement) ?' },
          ],
        },
        { k: 'h', text: 'B. Les paiements' },
        {
          k: 'qa',
          items: [
            { q: 'Pour chaque paiement : date, heure, montant en euros, actif, quantité, réseau.', n: 5 },
            { q: 'Comment avez-vous acheté les crypto-actifs (exchange, application, DAB, vendeur particulier, carte, virement) ? Nom de la plateforme et identifiant client ?' },
            { q: 'Vers quelles adresses avez-vous envoyé les fonds ? Comment vous ont-elles été transmises ? Un memo, tag ou commentaire était-il demandé ?' },
            { q: 'Disposez-vous des identifiants de transaction (hash, TxID) ou de l\'historique de votre portefeuille ?' },
            { q: 'Avez-vous fait des virements, remis des espèces ou acheté des coupons ? Au profit de quels bénéficiaires (IBAN) ?' },
            { q: 'Avez-vous reçu des « gains » ou effectué des retraits ? Montants, dates, adresses d\'origine ?' },
          ],
        },
        { k: 'h', text: 'C. Accès et appareils' },
        {
          k: 'qa',
          items: [
            { q: 'Avez-vous installé un logiciel de prise de contrôle à distance, ou communiqué un code, une phrase de récupération, une pièce d\'identité ?' },
            { q: 'Avez-vous connecté votre portefeuille à un site ou signé une autorisation (approval) ?' },
            { q: 'Quels appareils avez-vous utilisés ? Les conversations et applications sont-elles toujours disponibles ?' },
          ],
        },
        { k: 'h', text: 'D. Situation actuelle' },
        {
          k: 'qa',
          items: [
            { q: 'Êtes-vous toujours en contact avec ces personnes ? Vous demande-t-on encore de payer ?' },
            { q: 'Avez-vous été contacté(e) par une personne ou une société proposant de récupérer vos fonds ?' },
            { q: 'Avez-vous prévenu votre banque, la plateforme utilisée, déposé d\'autres plaintes ou signalements ?' },
            { q: 'Montant total du préjudice (en euros et en crypto-actifs) et conséquences pour vous.' },
          ],
        },
        { k: 'h', text: 'E. Pièces remises' },
        {
          k: 'checks',
          items: [
            'Relevés de l\'exchange / historique du portefeuille (export)',
            'Exports et captures des conversations, avec identifiants techniques des comptes',
            'Captures de la fausse plateforme (solde, dépôts, retraits)',
            'Relevés bancaires des paiements',
            'Reçus de DAB, tickets, coupons',
            'Contrats, « certificats » et documents reçus',
          ],
        },
      ],
    }),
  }),

  make({
    id: 'note-magistrat',
    title: 'Note de synthèse au magistrat',
    category: 'redaction',
    icon: 'Gavel',
    description: 'Synthèse des flux identifiés, des attributions et des avoirs, avec les limites de l\'analyse et les actes sollicités.',
    lessons: ['rapport', 'gel-saisie', 'expertise-judiciaire'],
    fields: [
      { key: 'destinataire', label: 'Destinataire', type: 'text', placeholder: 'M./Mme …, procureur de la République / juge d\'instruction', wide: true },
      officer,
      unit,
      procedure,
      date,
      { key: 'objet', label: 'Objet', type: 'text', placeholder: 'Analyse des flux en crypto-actifs — demandes d\'actes', wide: true },
      { key: 'faits', label: 'Rappel des faits', type: 'textarea', wide: true },
      { key: 'flux', label: 'Résumé des flux', type: 'textarea', wide: true, placeholder: 'Une étape par ligne : victime → adresse A → bridge → exchange X…' },
      { key: 'txs', label: 'Transactions principales', type: 'textarea', wide: true, placeholder: '12/09/2026 08:14 ; adresse victime ; TQ9… ; 12 000 USDT ; 9f3c…', help: 'Une ligne par transaction : date UTC ; de ; vers ; montant / actif ; hash.' },
      { key: 'attributions', label: 'Entités et attributions (avec niveau de confiance)', type: 'textarea', wide: true },
      { key: 'avoirs', label: 'Avoirs identifiés, gelés ou saisis', type: 'textarea', wide: true },
      { key: 'limites', label: 'Limites de l\'analyse', type: 'textarea', wide: true },
      { key: 'demandes', label: 'Actes sollicités', type: 'textarea', wide: true, placeholder: 'Autorisation de requérir l\'exchange X (art. 77-1-1 CPP)\nDemande d\'entraide vers …\nSaisie des avoirs bloqués' },
    ],
    build: (v) => {
      const txs = ftable(v, 'txs', 5)
      return {
        title: 'Note de synthèse',
        blocks: [
          { k: 'title', text: 'Note de synthèse', sub: `à l'attention de ${fv(v, 'destinataire')}` },
          {
            k: 'meta',
            rows: [
              ['Procédure n°', fv(v, 'procedure')],
              ['Unité', fv(v, 'unit')],
              ['Rédacteur', fv(v, 'officer')],
              ['Date', fdate(v, 'date')],
              ['Objet', fv(v, 'objet')],
            ],
          },
          { k: 'h', text: '1. Rappel des faits' },
          fmulti(v, 'faits', 4),
          { k: 'h', text: '2. Analyse des flux' },
          fmulti(v, 'flux', 5, true),
          { k: 'table', headers: ['Date (UTC)', 'De', 'Vers', 'Montant / actif', 'Hash'], rows: txs, blankRows: txs.length ? 0 : 4, widths: [15, 22, 22, 16, 25] },
          { k: 'h', text: '3. Entités et attributions' },
          fmulti(v, 'attributions', 3),
          { k: 'note', text: 'Niveaux de confiance : certain (établi par la blockchain ou une réponse officielle), probable (heuristique robuste ou corrélation unique), possible (hypothèse à corroborer).' },
          { k: 'h', text: '4. Avoirs identifiés, gelés ou saisis' },
          fmulti(v, 'avoirs', 3),
          { k: 'h', text: '5. Limites de l\'analyse' },
          fmulti(v, 'limites', 3),
          { k: 'h', text: '6. Actes sollicités' },
          fmulti(v, 'demandes', 4, true),
          { k: 'sign', right: [fv(v, 'officer'), fv(v, 'unit')] },
        ],
      }
    },
  }),
]

