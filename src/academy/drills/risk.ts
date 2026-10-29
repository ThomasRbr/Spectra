// Exercices de qualification des contreparties : niveau de risque,
// catégorie d'un service, et voie de réquisition adaptée.
import { Rng } from '../../engine/rng'
import { CATEGORY, ENTITY_CATALOG, RISK_META, type Cooperation, type EntityCategory, type RiskLevel } from '../../engine/entities'
import type { DrillDef, DrillItem } from '../model'
import { mkChoice, rngFor } from './util'

// ── Catégorie / niveau de risque ────────────────────────────────────────────

const RISK_WHY: Partial<Record<EntityCategory, string>> = {
  exchange: 'Un exchange régulé applique le KYC et coopère avec les autorités : c\'est une contrepartie à faible risque… et souvent le meilleur point de réquisition de l\'enquête.',
  instant_exchanger: 'Un échangeur instantané sans KYC permet de changer d\'actif et de chaîne en quelques minutes sans identité : très prisé pour le chain hopping, d\'où un risque élevé.',
  mixer: 'Un mixeur a pour finalité de rompre la traçabilité des fonds ; il est massivement utilisé pour le blanchiment et plusieurs ont été démantelés ou sanctionnés : risque sévère.',
  coinjoin: 'Le CoinJoin n\'est pas illégal en soi et chaque utilisateur garde ses clés, mais il vise à brouiller la traçabilité : risque élevé, à analyser au cas par cas.',
  privacy_pool: 'Pool de confidentialité visé par des sanctions : toute interaction est un signal majeur de dissimulation, risque sévère.',
  bridge: 'Un bridge est un outil légitime mais sert aussi à changer de chaîne pour compliquer le suivi : risque moyen.',
  dex: 'Un DEX est un protocole d\'échange légitime ; le swap reste traçable on-chain : risque faible en soi.',
  defi: 'Un protocole DeFi de prêt est une contrepartie légitime ; risque faible en soi.',
  darknet: 'Un marché du darknet vend des produits illicites : toute exposition est un indicateur de criminalité, risque sévère.',
  ransomware: 'Adresse d\'un groupe de rançongiciel : fonds directement issus d\'une extorsion, risque sévère.',
  scam: 'Une plateforme frauduleuse : fonds issus d\'escroqueries, risque sévère.',
  sanctioned: 'Une entité sanctionnée (OFAC / UE) : les assujettis ne peuvent pas traiter avec elle, et l\'exposition est un signal fort de blanchiment : risque sévère.',
  gambling: 'Un casino crypto sans KYC n\'est pas illicite par nature mais sert souvent à « laver » des fonds par des mises : risque moyen.',
  p2p: 'Une plateforme P2P à KYC faible permet de convertir en monnaie fiat avec peu de contrôles : risque moyen.',
  merchant: 'Un commerçant légitime : risque faible, sauf activité facilitant la conversion (cartes cadeaux), alors risque moyen.',
  mining: 'Un pool de minage distribue des fonds fraîchement créés : risque faible.',
  otc: 'Un courtier OTC à KYC faible peut convertir de gros volumes en espèces : risque moyen, point de vigilance pour le blanchiment professionnel.',
  token_issuer: 'L\'émetteur d\'un stablecoin est une contrepartie régulée, capable de geler des jetons : risque faible.',
}

const CLUES: Partial<Record<EntityCategory, string[]>> = {
  mixer: [
    'Reçoit des dépôts de très nombreux utilisateurs puis renvoie, après un délai aléatoire, des montants légèrement inférieurs (commission de 1 à 3 %) vers des adresses neuves, sans lien on-chain avec les dépôts.',
    'Service accessible via Tor qui promet de « casser le lien » entre vos bitcoins et vous ; il garde les fonds le temps du mélange et remet une « lettre de garantie » signée.',
  ],
  coinjoin: [
    'Transactions collaboratives à nombreuses entrées et à sorties de montant strictement identique, orchestrées par un coordinateur ; chaque participant garde le contrôle de ses clés.',
  ],
  privacy_pool: [
    'Smart contract sur Ethereum qui n\'accepte que des dépôts de 0,1 / 1 / 10 / 100 ETH ; les retraits partent vers d\'autres adresses grâce à une preuve à divulgation nulle de connaissance, souvent via un relayeur.',
  ],
  instant_exchanger: [
    'Service sans compte : l\'utilisateur envoie du BTC sur une adresse générée pour sa commande et reçoit quelques minutes plus tard du XMR ou de l\'USDT-TRC20 à l\'adresse de son choix, sans vérification d\'identité.',
  ],
  exchange: [
    'Plateforme qui tient des comptes clients après vérification d\'identité, attribue à chaque client des adresses de dépôt et balaie les fonds vers des hot et cold wallets ; elle est enregistrée auprès d\'un régulateur.',
  ],
  darknet: [
    'Site .onion vendant stupéfiants et faux papiers ; les acheteurs paient sur des adresses de séquestre contrôlées par le site, qui reverse aux vendeurs après livraison.',
  ],
  ransomware: [
    'Adresses communiquées dans des notes laissées sur des serveurs d\'entreprises chiffrés ; les fonds reçus sont rapidement partagés entre un « opérateur » (≈ 20 %) et des « affiliés » (≈ 80 %).',
  ],
  gambling: [
    'Site de paris et de casino en ligne acceptant les dépôts en crypto sans vérification d\'identité ; très nombreux petits dépôts et retraits.',
  ],
  bridge: [
    'Contrat qui reçoit des actifs sur une chaîne et émet un événement indiquant la chaîne cible, le destinataire et un nonce ; les fonds réapparaissent quelques minutes plus tard sur l\'autre chaîne.',
  ],
  dex: [
    'Smart contract de pools de liquidité : l\'utilisateur apporte un jeton et en reçoit un autre dans la même transaction, au prix fixé par une formule, sans compte ni KYC.',
  ],
  sanctioned: [
    'Plateforme d\'échange inscrite sur les listes de sanctions de l\'OFAC et de l\'Union européenne pour avoir blanchi des centaines de millions de dollars ; elle refuse toute coopération.',
  ],
  p2p: [
    'Place de marché qui met en relation acheteurs et vendeurs de bitcoins contre virement ou espèces, avec un séquestre multisignature pendant l\'échange.',
  ],
  otc: [
    'Courtier traitant de gros volumes USDT ↔ espèces de gré à gré, hors carnet d\'ordres, avec des vérifications d\'identité limitées.',
  ],
  mining: [
    'Adresses qui reçoivent les récompenses de blocs (transactions coinbase) puis redistribuent de petits montants réguliers à des milliers de participants.',
  ],
}

const DISC: Partial<Record<EntityCategory, string>> = {
  mixer: 'mixeur : service custodial qui garde les fonds et en restitue d\'autres',
  coinjoin: 'CoinJoin : transaction collaborative non custodiale à sorties égales',
  privacy_pool: 'pool de confidentialité : smart contract à dénominations fixes et preuves ZK',
  instant_exchanger: 'échangeur instantané : commande ponctuelle sans compte, changement d\'actif',
  exchange: 'exchange : comptes clients avec KYC, dépôts et balayages',
  darknet: 'marché darknet : vente de biens illicites avec séquestre',
  ransomware: 'rançongiciel : paiements de rançons puis partage opérateur/affiliés',
  scam: 'escroquerie : plateforme frauduleuse alimentée par des victimes',
  hack: 'piratage : fonds volés lors d\'une attaque',
  gambling: 'jeux d\'argent : dépôts et retraits de joueurs',
  bridge: 'bridge : transfert d\'une chaîne à une autre (événement + nonce)',
  dex: 'DEX : swap atomique contre un pool, sans changement de chaîne',
  sanctioned: 'entité sanctionnée : inscrite sur une liste de sanctions',
  p2p: 'plateforme P2P : échanges entre particuliers contre fiat',
  otc: 'courtier OTC : gros volumes de gré à gré',
  mining: 'pool de minage : récompenses de blocs redistribuées',
  merchant: 'commerçant : vend un bien ou un service',
}

const CONFUSE: Partial<Record<EntityCategory, EntityCategory[]>> = {
  mixer: ['coinjoin', 'privacy_pool', 'instant_exchanger', 'exchange'],
  coinjoin: ['mixer', 'privacy_pool', 'exchange', 'dex'],
  privacy_pool: ['mixer', 'coinjoin', 'dex', 'bridge'],
  instant_exchanger: ['exchange', 'dex', 'mixer', 'bridge'],
  exchange: ['instant_exchanger', 'otc', 'p2p', 'mixer'],
  darknet: ['scam', 'mixer', 'p2p', 'ransomware'],
  ransomware: ['scam', 'hack', 'darknet', 'mixer'],
  gambling: ['exchange', 'p2p', 'merchant', 'mixer'],
  bridge: ['dex', 'instant_exchanger', 'privacy_pool', 'mixer'],
  dex: ['bridge', 'instant_exchanger', 'exchange', 'mixer'],
  sanctioned: ['exchange', 'mixer', 'instant_exchanger', 'otc'],
  p2p: ['otc', 'exchange', 'darknet', 'instant_exchanger'],
  otc: ['p2p', 'exchange', 'instant_exchanger', 'mixer'],
  mining: ['exchange', 'gambling', 'merchant', 'mixer'],
}

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'severe']

export const riskCategory: DrillDef = {
  id: 'risk-category',
  title: 'Qualifier une contrepartie',
  description: 'Reconnaître la catégorie d\'un service à partir de son fonctionnement et lui attribuer le bon niveau de risque.',
  level: 2,
  track: 'methodo',
  icon: 'ShieldAlert',
  generate(seed) {
    const rng = rngFor(seed, 'risk-category')
    if (rng.chance(0.5)) {
      // Niveau de risque d'une entité du catalogue
      const keys = Object.keys(ENTITY_CATALOG)
      const key = rng.pick(keys)
      const e = ENTITY_CATALOG[key]
      const options = RISK_ORDER.map((r) => RISK_META[r].label)
      const answer = RISK_ORDER.indexOf(e.risk)
      const items = [
        `Nom : ${e.name}`,
        `Catégorie (base d'attribution) : ${CATEGORY[e.category].label}`,
        ...(e.country ? [`Pays : ${e.country}`] : []),
        ...(e.compliance ? [`KYC : ${e.compliance.kyc}`] : []),
        `Description : ${e.description}`,
      ]
      const deviates = e.risk !== CATEGORY[e.category].risk
      return {
        prompt: 'Quel niveau de risque attribuer à une exposition directe à cette contrepartie ?',
        context: rng.pick([
          'L\'adresse étudiée a envoyé des fonds directement à cette entité.',
          'Votre outil signale une exposition directe à l\'entité suivante.',
          'Les fonds de la victime aboutissent chez cette contrepartie.',
        ]),
        visual: { type: 'list', title: 'Fiche de la contrepartie', items },
        kind: 'choice',
        options,
        answer,
        explain:
          `${RISK_WHY[e.category] ?? ''}` +
          (deviates ? ` Ici, la fiche justifie un ajustement par rapport au niveau habituel de la catégorie (${RISK_META[CATEGORY[e.category].risk].label.toLowerCase()}) : au vu de sa description (pays, KYC, activité), ${e.name} est classé « ${RISK_META[e.risk].label} ».` : '') +
          `\n\nÉchelle : Faible (contrepartie régulée, activité licite), Moyen (activité licite mais détournable, contrôles faibles), Élevé (outil de dissimulation ou absence totale de KYC), Sévère (activité criminelle, sanction, blanchiment avéré). Le niveau de risque oriente l'analyse ; il ne prouve rien à lui seul.`,
      }
    }
    // Qualification à partir du comportement observé
    const cats = Object.keys(CLUES) as EntityCategory[]
    const cat = rng.pick(cats)
    const clue = rng.pick(CLUES[cat]!)
    const confusions = rng.shuffle([...(CONFUSE[cat] ?? [])])
    const labelOf = (c: EntityCategory) => CATEGORY[c].label
    const { options, answer } = mkChoice(rng, labelOf(cat), confusions.map(labelOf), rng.pick([4, 4, 5]))
    const shown = confusions.filter((c) => options.includes(labelOf(c)))
    return {
      prompt: 'Quelle catégorie de service correspond à ce comportement ?',
      context: 'Observation faite sur la blockchain et en sources ouvertes, pour un service encore non étiqueté par votre outil.',
      visual: { type: 'list', title: 'Comportement observé', items: [clue] },
      kind: 'choice',
      options,
      answer,
      explain:
        `Réponse : ${DISC[cat]}. ${RISK_WHY[cat] ?? ''} (Risque type : ${RISK_META[CATEGORY[cat].risk].label.toLowerCase()}.)\n\n` +
        `À distinguer de : ${shown.map((c) => DISC[c]).join(' ; ')}.`,
    }
  },
}

// ── Qui réquisitionner, par quelle voie ? ──────────────────────────────────

const DIRECT = 'Réquisition judiciaire directe (art. 60-1 / 77-1-1 CPP) adressée au prestataire en France'
const PORTAL = 'Réquisition transmise via son portail forces de l\'ordre (réponse volontaire, non contraignante)'
const DEE = 'Décision d\'enquête européenne (DEE) émise par le magistrat vers l\'État membre concerné'
const MLAT = 'Demande d\'entraide pénale internationale, par l\'intermédiaire du magistrat'
const NONE = 'Aucune voie exploitable : documenter l\'exposition, en rendre compte au magistrat et rechercher d\'autres points de sortie'

const COOP_ANSWER: Record<Cooperation, string> = { direct: DIRECT, voluntary: PORTAL, eio: DEE, mlat: MLAT, none: NONE }

const COOP_WHY: Record<Cooperation, string> = {
  direct:
    'Le prestataire est établi en France (PSAN enregistré / PSCA agréé) : il est directement soumis au Code de procédure pénale. L\'OPJ lui adresse une réquisition (art. 60-1 en flagrance, 77-1-1 en préliminaire avec l\'autorisation du procureur, 99-3 sur commission rogatoire). S\'abstenir d\'y répondre sans motif légitime est puni d\'une amende (art. 60-1 al. 2).',
  voluntary:
    'Le prestataire n\'est pas établi en France ni dans l\'UE, mais il a publié une politique de coopération et un portail dédié : la réquisition française lui est transmise par ce canal et il y répond volontairement. Rien ne l\'y oblige : si la réponse tarde ou est refusée, ou pour une mesure coercitive, il faudra passer par l\'entraide pénale internationale.',
  eio:
    'Le prestataire est établi dans un autre État membre de l\'UE et exige un titre reconnu chez lui : la décision d\'enquête européenne (directive 2014/41/UE), émise ou validée par un magistrat, est l\'outil adapté pour obtenir des éléments probants (relevés, KYC). Elle s\'applique entre États membres (hors Danemark et Irlande).',
  mlat:
    'Le prestataire est établi hors de l\'UE et ne répond qu\'aux demandes transmises par les autorités de son pays : il faut une demande d\'entraide pénale internationale (conventions bilatérales ou multilatérales), préparée avec le magistrat. Délais longs : à anticiper dès que la piste se confirme.',
  none:
    'Aucune coopération n\'est possible (entité sanctionnée ou opérateur sans point de contact). La réquisition serait vaine : on documente l\'exposition dans la procédure, on en rend compte au magistrat, on partage le renseignement via les canaux de coopération policière, et on cherche où les fonds ressortent vers des services coopératifs.',
}

const SYN_NAMES = ['Bitlune', 'Kryptalis', 'Monexa', 'Satoria', 'Blockara', 'Vaultis', 'Tokenor', 'Cryptéa', 'Ledgera', 'Coinmarée', 'Altivo', 'Nexaro']

interface Card {
  name: string
  category: string
  country: string
  status: string
  policy: string
  coop: Cooperation
}

function synthetic(rng: Rng): Card {
  const coop = rng.weighted([['direct', 2], ['voluntary', 2], ['eio', 2], ['mlat', 1.6], ['none', 1]] as const) as Cooperation
  const name = rng.pick(SYN_NAMES)
  const category = rng.pick(['Exchange centralisé', 'Exchange centralisé', 'Courtier en crypto-actifs', 'Service de conservation (custodial)'])
  const strict = 'Ne répond aux autorités étrangères que sur présentation d\'un titre judiciaire reconnu dans son pays.'
  switch (coop) {
    case 'direct':
      return { name, category, coop, country: `France (siège à ${rng.pick(['Paris', 'Lyon', 'Nantes', 'Montpellier', 'Lille'])})`, status: 'Enregistré PSAN auprès de l\'AMF, agréé PSCA (MiCA)', policy: 'Service conformité joignable par courriel dédié aux autorités.' }
    case 'voluntary':
      return { name, category, coop, country: rng.pick(['Seychelles', 'Émirats arabes unis', 'Singapour', 'Îles Vierges britanniques', 'Bahamas', 'Panama']), status: rng.pick(['Licence locale, non agréé dans l\'UE', 'Régulation locale légère']), policy: 'Dispose d\'un portail dédié aux forces de l\'ordre et répond aux demandes d\'autorités étrangères qui y sont déposées.' }
    case 'eio':
      return { name, category, coop, country: `${rng.pick(['Allemagne', 'Espagne', 'Italie', 'Lituanie', 'Malte', 'Pays-Bas', 'Luxembourg', 'Estonie', 'Autriche', 'Portugal'])} (Union européenne)`, status: 'Agréé PSCA (MiCA) par l\'autorité de son État membre', policy: strict }
    case 'mlat':
      return { name, category, coop, country: rng.pick(['Suisse', 'Royaume-Uni', 'Canada', 'Japon', 'Hong Kong', 'Brésil']), status: 'Supervisé par l\'autorité financière locale', policy: strict }
    case 'none':
      return rng.chance(0.5)
        ? { name, category: 'Exchange centralisé', coop, country: rng.pick(['Russie', 'Inconnu']), status: 'Inscrit sur les listes de sanctions OFAC et UE', policy: 'Aucun point de contact ; ignore les demandes des autorités occidentales.' }
        : { name, category: 'Échangeur instantané', coop, country: 'Inconnu (opère via Tor)', status: 'Aucune immatriculation connue', policy: 'Aucun contact publié, aucune politique de coopération.' }
  }
}

function fromCatalog(rng: Rng): Card {
  const key = rng.pick(['coinvault', 'binova', 'nordex', 'helvetix', 'kaizen', 'grantis', 'satsdesk', 'flashx'])
  const e = ENTITY_CATALOG[key]
  const c = e.compliance!
  const strict = 'Ne répond aux autorités étrangères que sur présentation d\'un titre judiciaire reconnu dans son pays.'
  const policy =
    c.cooperation === 'direct' ? 'Service conformité joignable par courriel dédié aux autorités.'
    : c.cooperation === 'voluntary' ? 'Dispose d\'un canal dédié aux forces de l\'ordre et répond aux demandes d\'autorités étrangères qui y sont déposées.'
    : c.cooperation === 'none' ? 'Aucune coopération avec les autorités.'
    : strict
  const country = c.cooperation === 'eio' ? `${e.country} (Union européenne)` : e.country ?? 'Inconnu'
  const status =
    c.cooperation === 'direct' ? 'Enregistré PSAN auprès de l\'AMF, agréé PSCA (MiCA)'
    : e.category === 'sanctioned' ? 'Inscrit sur les listes de sanctions OFAC et UE'
    : c.regulator ? `Supervisé par : ${c.regulator}`
    : 'Pas de régulateur identifié'
  return { name: e.name, category: CATEGORY[e.category].label, country, status, policy, coop: c.cooperation }
}

function channelItem(rng: Rng): DrillItem {
  const card = rng.chance(0.5) ? fromCatalog(rng) : synthetic(rng)
  const correct = COOP_ANSWER[card.coop]
  const { options, answer } = mkChoice(rng, correct, rng.shuffle([DIRECT, PORTAL, DEE, MLAT, NONE].filter((x) => x !== correct)), rng.pick([4, 5]))
  const wrong = (Object.keys(COOP_ANSWER) as Cooperation[]).filter((k) => k !== card.coop && options.includes(COOP_ANSWER[k]))
  const shortWhy: Record<Cooperation, string> = {
    direct: 'la réquisition directe suppose un prestataire établi en France',
    voluntary: 'le portail suppose une politique de coopération volontaire publiée',
    eio: 'la DEE ne vaut qu\'entre États membres de l\'UE',
    mlat: 'l\'entraide internationale vise les États hors UE (plus lente : inutile si une voie plus directe existe)',
    none: 'conclure à l\'absence de voie n\'est justifié que face à une entité sanctionnée ou sans point de contact',
  }
  return {
    prompt: 'Les fonds aboutissent sur une adresse de dépôt de ce prestataire. Quelle voie privilégier pour obtenir l\'identité du titulaire et les relevés du compte ?',
    context: 'Enquête menée en France. Vous disposez du hash de la transaction de dépôt, de la date et du montant.',
    visual: {
      type: 'list',
      title: 'Fiche du prestataire',
      items: [`Nom : ${card.name}`, `Activité : ${card.category}`, `Pays d'établissement : ${card.country}`, `Statut : ${card.status}`, `Politique envers les autorités : ${card.policy}`],
    },
    kind: 'choice',
    options,
    answer,
    explain: `${COOP_WHY[card.coop]}\n\nPourquoi pas les autres : ${wrong.map((k) => shortWhy[k]).join(' ; ')}.`,
  }
}

function dataItem(rng: Rng): DrillItem {
  const kind = rng.weighted([['kyc', 3], ['freeze', 2], ['swap', 1.5], ['issuer', 1.5]] as const)
  const KEY = 'La clé privée de l\'adresse de dépôt'
  if (kind === 'swap') {
    const correct = 'Le détail de l\'ordre lié au hash de dépôt : actif et adresse de destination, horodatage, adresse IP'
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(['La copie de la pièce d\'identité du client (KYC)', KEY, 'Le gel des fonds sur l\'adresse de dépôt']), 4)
    return {
      prompt: 'Que demander en priorité à ce service ?',
      context: 'Les fonds de la victime (BTC) ont été envoyés à cet échangeur ; une heure plus tard, des USDT-TRC20 sortent de son hot wallet vers une adresse inconnue.',
      visual: { type: 'list', title: 'Fiche du prestataire', items: ['Nom : Ocelot Swap', 'Activité : Échangeur instantané (sans compte)', 'Pays : Seychelles', 'KYC : aucun', 'Politique : répond aux demandes déposées par les autorités étrangères'] },
      kind: 'choice',
      options,
      answer,
      explain:
        'Un échangeur instantané sans compte ne détient pas d\'identité (pas de KYC) et ne garde pas les fonds : ils sont déjà convertis et repartis. Ce qu\'il possède, c\'est l\'ordre d\'échange : à partir du hash de dépôt, il peut indiquer l\'actif livré, l\'adresse de destination, l\'heure et l\'adresse IP du client — de quoi reprendre le traçage sur l\'autre chaîne.\n\n' +
        'Demander un KYC qui n\'existe pas fait perdre du temps ; un gel est sans objet (fonds déjà repartis) ; et aucun prestataire ne détient ni ne communique « la clé privée » d\'une adresse de dépôt — ce n\'est jamais l\'objet d\'une réquisition.',
    }
  }
  if (kind === 'issuer') {
    const correct = 'Le gel (blocage) en urgence de l\'adresse détenant les USDT, en transmettant la procédure'
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(['L\'identité (KYC) du détenteur de l\'adresse', 'Le renvoi immédiat des USDT sur le portefeuille de la victime', KEY.replace('de dépôt', 'du suspect')]), 4)
    return {
      prompt: 'Que demander en priorité à l\'émetteur du stablecoin ?',
      context: `${'L\'escroc détient encore'} ${rng.int(20, 400) * 1000} USDT-${rng.pick(['TRC20', 'ERC20'])} sur une adresse personnelle (non custodiale). Aucune sortie depuis ${rng.int(2, 30)} heures.`,
      visual: { type: 'list', title: 'Fiche du prestataire', items: ['Nom : Émetteur USDT', 'Activité : Émetteur de stablecoin', 'Capacité : peut bloquer une adresse dans le contrat du jeton', 'Politique : portail dédié aux forces de l\'ordre, délais courts'] },
      kind: 'choice',
      options,
      answer,
      explain:
        'L\'émetteur de l\'USDT ne connaît pas le détenteur d\'une adresse non custodiale (il n\'a pas de relation client avec lui) : lui demander un KYC est vain. En revanche, il peut bloquer l\'adresse dans le contrat du jeton, ce qui fige les USDT avant qu\'ils ne soient convertis ou déplacés. C\'est la priorité absolue tant que les fonds n\'ont pas bougé.\n\n' +
        'La restitution à la victime ne se décide pas par simple demande à l\'émetteur : elle relève d\'une décision judiciaire. Personne ne détient « la clé privée » d\'une adresse non custodiale, à part son propriétaire.',
    }
  }
  const ex = rng.pick(['Coinvault', 'Binova', 'Nordex', 'Kaizen Exchange'])
  if (kind === 'freeze') {
    const correct = 'Solliciter en urgence le blocage du compte, en même temps que l\'identification du titulaire'
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(['Attendre la réponse sur l\'identité avant toute demande de blocage', 'Demander à l\'exchange de renvoyer directement les fonds à la victime', 'Prévenir le titulaire du compte pour obtenir ses explications']), 4)
    return {
      prompt: `Les fonds sont encore crédités sur le compte client chez ${ex}. Quelle est la bonne démarche ?`,
      context: `Le dépôt a eu lieu il y a ${rng.int(2, 20)} heures ; aucun retrait n'est encore visible depuis le hot wallet vers une adresse liée au suspect.`,
      visual: { type: 'list', title: 'Situation', items: [`Exchange : ${ex}`, 'Capacité de gel : oui', 'Fonds : crédités sur le compte client', `Risque : retrait possible à tout moment`] },
      kind: 'choice',
      options,
      answer,
      explain:
        'Le temps joue contre l\'enquête : un retrait peut vider le compte en quelques minutes. On demande donc, dans la même démarche, le blocage conservatoire du compte et les éléments d\'identification ; la saisie proprement dite relève ensuite d\'une décision judiciaire (régime des saisies pénales), à préparer avec le magistrat.\n\n' +
        'Attendre l\'identité d\'abord laisse filer les fonds. L\'exchange ne restitue pas de lui-même à la victime : la restitution suit une décision judiciaire. Prévenir le titulaire compromettrait l\'enquête.',
    }
  }
  const correct = 'L\'identité (KYC) du titulaire du compte lié à l\'adresse de dépôt, ses IP de connexion et l\'historique de ses dépôts et retraits'
  const { options, answer } = mkChoice(rng, correct, rng.shuffle([KEY, 'La liste de tous les clients ayant alimenté le hot wallet ce jour-là', 'Le hash de la transaction de la victime', 'Le solde global du hot wallet de l\'exchange']), 4)
  return {
    prompt: `Quelles données demander en priorité à ${ex} ?`,
    context: `Les fonds de la victime ont été déposés sur une adresse de dépôt de ${ex}, puis balayés vers son hot wallet. Vous disposez du hash, de la date et du montant.`,
    visual: { type: 'list', title: 'Situation', items: [`Exchange : ${ex} (KYC appliqué)`, 'Adresse de dépôt identifiée', 'Fonds déjà balayés vers le hot wallet'] },
    kind: 'choice',
    options,
    answer,
    explain:
      'L\'adresse de dépôt rattache les fonds à un compte client précis. La réquisition vise ce compte : identité et justificatifs fournis à l\'ouverture (KYC), adresses IP et appareils de connexion, historique des opérations, et surtout les adresses vers lesquelles le client a retiré — elles permettent de poursuivre le traçage et d\'identifier d\'autres comptes.\n\n' +
      'Le hash de la transaction est déjà connu (c\'est vous qui le fournissez). Une liste de tous les clients ou le solde du hot wallet sont disproportionnés et inutiles. Aucun exchange ne communique de clé privée : ce n\'est pas une donnée exploitable par réquisition.',
  }
}

export const requisitionTarget: DrillDef = {
  id: 'requisition-target',
  title: 'Qui réquisitionner, par quelle voie ?',
  description: 'Choisir le bon canal (réquisition directe, portail, DEE, entraide internationale) et les données à demander en priorité.',
  level: 2,
  track: 'enquete',
  icon: 'Gavel',
  generate(seed) {
    const rng = rngFor(seed, 'requisition-target')
    return rng.chance(0.6) ? channelItem(rng) : dataItem(rng)
  },
}
