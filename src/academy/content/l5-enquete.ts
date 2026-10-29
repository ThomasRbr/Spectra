// Niveau 5 — Blanchiment professionnel, expertise judiciaire, saisie avancée.
import type { Lesson } from '../model'

const blanchiment: Lesson = {
  id: 'blanchiment-pro',
  title: 'Blanchiment professionnel : OTC, mules, cash-out',
  level: 5,
  track: 'typologies',
  minutes: 40,
  summary:
    'Derrière de nombreuses escroqueries, rançongiciels et trafics se trouvent des blanchisseurs professionnels qui vendent leurs services à plusieurs réseaux. Courtiers OTC complaisants, mules, plateformes P2P et triangulation, cartes cadeaux, services imbriqués (nested), réseaux de remise d\'espèces : comment les reconnaître on-chain et hors chaîne, et pourquoi viser le nœud de blanchiment.',
  objectives: [
    'Situer les techniques crypto dans les trois phases du blanchiment (placement, empilement, intégration).',
    'Reconnaître on-chain et hors chaîne l\'activité d\'un courtier OTC complaisant, d\'un réseau de mules et d\'un service imbriqué.',
    'Expliquer la fraude par triangulation sur les plateformes P2P et l\'usage des cartes cadeaux.',
    'Construire une stratégie d\'enquête ciblant le blanchisseur professionnel et mobiliser les qualifications adaptées.',
  ],
  prerequisites: ['typologies', 'exposition-risque', 'tron-usdt', 'cooperation-internationale'],
  practice: ['pig-butchering-tron', 'darknet-vendor', 'ransomware-raas'],
  blocks: [
    {
      type: 'text',
      md: `Trois affaires sans lien apparent : une escroquerie au faux conseiller bancaire à Lyon, un rançongiciel visant une PME bretonne, un vendeur de stupéfiants sur Hydra Market. Au bout de chaque traçage, la même adresse de dépôt USDT-TRC20, chez le même courtier OTC.

C'est la signature du **blanchiment professionnel** : un prestataire spécialisé, souvent sans lien avec l'infraction d'origine, qui transforme des fonds illicites en argent utilisable — contre commission — pour de multiples réseaux. Le GAFI a consacré un rapport à ce phénomène en 2018. Pour l'enquêteur, c'est un **point de convergence** : y remonter, c'est toucher plusieurs affaires à la fois.`,
    },
    { type: 'heading', text: 'Les trois phases, version crypto' },
    {
      type: 'table',
      headers: ['Phase', 'Objectif', 'Techniques crypto courantes'],
      rows: [
        ['Placement', 'Introduire les fonds dans le système', 'Espèces → crypto via OTC ou P2P, distributeurs, comptes de mules ; virements de victimes vers des comptes d\'exchange de mules'],
        ['Empilement', 'Brouiller la trace', 'Chain hopping, échangeurs sans KYC, mixeurs, fractionnement, conversion en USDT-TRC20, services imbriqués'],
        ['Intégration', 'Réinjecter dans l\'économie légale', 'Cartes de paiement crypto, achats de biens de luxe, immobilier via intermédiaires, sociétés écrans, faux revenus de « trading »'],
      ],
      caption: 'Dans les escroqueries en ligne, le schéma est souvent inversé : les fonds des victimes arrivent en monnaie fiduciaire ou en crypto, et doivent ressortir en espèces ou en virements « propres ».',
    },
    {
      type: 'terms',
      items: [
        { term: 'Blanchiment professionnel', def: 'Activité de blanchiment exercée comme un service, pour le compte de tiers, contre rémunération.' },
        { term: 'Courtier OTC', def: 'Intermédiaire de gré à gré pour de gros volumes ; légitime en principe, complaisant lorsqu\'il ignore volontairement l\'origine des fonds.' },
        { term: 'Mule', def: 'Personne qui prête son identité ou ses comptes pour faire transiter des fonds, consciemment ou non.' },
        { term: 'Service imbriqué (nested)', def: 'Service non régulé opérant au travers de comptes ouverts chez un exchange régulé.' },
        { term: 'Triangulation', def: 'Fraude où la victime paie, sans le savoir, la crypto achetée par l\'escroc à un vendeur P2P de bonne foi.' },
        { term: 'Compensation', def: 'Système où des valeurs se compensent entre pays sans transfert réel, à la manière d\'une hawala.' },
        { term: 'Structuration', def: 'Fractionnement des opérations sous les seuils de vigilance.' },
      ],
    },
    { type: 'heading', text: 'Le courtier OTC complaisant' },
    {
      type: 'text',
      md: `Un courtier OTC achète et vend de gros volumes hors des carnets d'ordres. La plupart sont légitimes ; certains se spécialisent dans une clientèle qui ne pose pas de questions : conversion USDT ↔ espèces, livraison par coursier, compensation entre pays.

**Signes on-chain** (SatsDesk OTC dans les exercices) :

- volumes très élevés en **USDT-TRC20**, montants ronds (50 000, 100 000 USDT) ;
- grand nombre de contreparties hétérogènes, dont certaines exposées à des escroqueries, rançongiciels ou marchés darknet ;
- adresses de collecte qui reversent régulièrement vers des **comptes d'exchange** (le courtier opère souvent lui-même via des comptes chez de grands exchanges) ;
- rythme d'activité calé sur des horaires de bureau d'un fuseau précis.

**Signes hors chaîne** : annonces sur messageries chiffrées, « bureaux » de change physique, coursiers, taux de commission supérieurs au marché en échange de l'absence de vérification.`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 's1', label: 'Escroquerie (Lyon)', kind: 'suspect' },
        { id: 's2', label: 'Rançongiciel LockBit', kind: 'suspect' },
        { id: 's3', label: 'Vendeur Obsidian', kind: 'suspect' },
        { id: 'otc', label: 'SatsDesk OTC', kind: 'service', sub: 'collecte USDT-TRC20' },
        { id: 'ex', label: 'Comptes chez OKX', kind: 'exchange', sub: 'au nom de sociétés' },
        { id: 'cash', label: 'Remise d\'espèces', kind: 'unknown', sub: 'coursiers, compensation' },
      ],
      edges: [
        { from: 's1', to: 'otc', label: 'USDT' },
        { from: 's2', to: 'otc', label: 'USDT' },
        { from: 's3', to: 'otc', label: 'USDT' },
        { from: 'otc', to: 'ex', label: 'rebalancement' },
        { from: 'otc', to: 'cash', label: 'hors chaîne', dashed: true },
      ],
      caption: 'Le nœud de blanchiment relie des affaires distinctes : une réquisition qui l\'atteint éclaire tout le réseau.',
    },
    { type: 'heading', text: 'Les mules' },
    {
      type: 'text',
      md: `Les réseaux de mules sont le placement de masse des escroqueries en ligne. Recrutées par de fausses offres d'emploi, sur les réseaux sociaux ou par des proches, les mules ouvrent à leur nom des comptes bancaires et des comptes chez des exchanges régulés (Coinhouse, Bitstamp…), reçoivent les virements des victimes, achètent de la crypto et l'envoient à une adresse fournie par leur « recruteur ».

Indicateurs pour l'exchange et pour l'enquêteur :

- comptes récents, profils jeunes ou vulnérables, revenus déclarés faibles ;
- virements entrants de tiers multiples, aussitôt convertis et retirés ;
- **mêmes adresses de retrait** pour des dizaines de comptes de clients différents ;
- connexions depuis les mêmes adresses IP ou appareils pour plusieurs comptes.

La même adresse de retrait commune à 37 comptes de clients d'un exchange est un **pivot majeur** : une réquisition à l'exchange sur cette adresse fait apparaître tout le réseau de mules.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : auditionner une mule',
      md: `La mule est souvent le seul maillon identifié. Son téléphone contient fréquemment la messagerie avec le recruteur, les instructions (adresses, montants, horaires), les captures envoyées comme « preuves » d'exécution et l'application de l'exchange. Distinguez les profils : victime d'une fausse offre d'emploi, complice rémunéré, recruteur de mules lui-même. La qualification et l'approche d'audition en dépendent.`,
    },
    { type: 'heading', text: 'P2P, triangulation et cartes cadeaux' },
    {
      type: 'steps',
      items: [
        { title: 'Le vendeur P2P', md: `Sur Hodl Hodl, un vendeur de bonne foi propose des USDT contre virement bancaire, avec séquestre.` },
        { title: 'L\'escroc commande', md: `L'escroc ouvre une commande d'achat et transmet au vendeur… les coordonnées de paiement que **la victime** va utiliser.` },
        { title: 'La victime paie', md: `La victime, persuadée d'acheter un bien ou d'investir, vire la somme sur le compte du vendeur P2P.` },
        { title: 'Le séquestre libère', md: `Le vendeur constate le virement et libère les USDT vers l'adresse de l'escroc.` },
        { title: 'Le retour de bâton', md: `La victime porte plainte : c'est le vendeur, de bonne foi, qui apparaît comme destinataire des fonds. L'escroc, lui, a reçu de la crypto « propre ».` },
      ],
    },
    {
      type: 'text',
      md: `Les **cartes cadeaux** jouent un rôle voisin : achetées avec des fonds illicites ou exigées des victimes, elles sont revendues contre crypto sur des plateformes spécialisées (CardHub dans les exercices) ou des places de marché. Les codes de cartes, leurs dates d'achat et de consommation sont des données que l'enseigne émettrice peut fournir sur réquisition.

Les **distributeurs de crypto-actifs** et les **cartes de paiement crypto** relèvent du même raisonnement : chaque point de contact entre crypto et monnaie fiduciaire est tenu par un prestataire qui conserve des traces.`,
    },
    {
      type: 'check',
      q: 'Une victime a viré 6 000 € à un particulier qui affirme avoir simplement vendu des USDT sur une plateforme P2P. Quelle hypothèse examiner en priorité ?',
      options: [
        'Le vendeur est forcément l\'escroc',
        'Une fraude par triangulation : l\'escroc a acheté les USDT au vendeur en faisant payer la victime',
        'La victime a fait une erreur de virement',
        'Le séquestre de la plateforme a été piraté',
      ],
      answer: 1,
      explain: 'La triangulation fait apparaître un vendeur P2P de bonne foi comme destinataire. Son historique de commande sur la plateforme désigne l\'adresse de l\'acheteur réel.',
    },
    { type: 'heading', text: 'Les services imbriqués (nested)' },
    {
      type: 'text',
      md: `Un service non régulé (échangeur, OTC, plateforme de jeux) peut opérer **au travers de comptes** qu'il détient chez un grand exchange régulé. On-chain, ses flux semblent aller **vers l'exchange** : l'analyse d'exposition conclut à tort à un « dépôt sur un exchange régulé, risque faible ».

Indices : une adresse de dépôt d'exchange qui reçoit des volumes énormes de contreparties très diverses et risquées, un compte client qui se comporte comme une plateforme. La réquisition à l'exchange révèle que le titulaire est une **société** dont l'activité n'a rien d'un usage personnel. C'est alors cette société — et ses propres clients — qu'il faut viser, souvent dans une autre juridiction.`,
    },
    { type: 'widget', id: 'risk-exposure', caption: 'Calculez l\'exposition d\'une adresse : une « exposition exchange » peut masquer un service imbriqué à haut risque.' },
    {
      type: 'check',
      q: 'Une adresse de dépôt chez un exchange régulé reçoit 40 M USDT de 3 000 contreparties, dont des adresses liées à des escroqueries. Hypothèse la plus pertinente ?',
      options: [
        'Un client particulier très actif',
        'Un service imbriqué opérant via un compte chez l\'exchange',
        'Le hot wallet de l\'exchange',
        'Une erreur d\'attribution sans importance',
      ],
      answer: 1,
      explain: 'Un tel profil de contreparties sur une seule adresse de dépôt est celui d\'une plateforme, pas d\'un particulier. La réquisition à l\'exchange identifiera le titulaire.',
    },
    { type: 'heading', text: 'Reconnaître le blanchiment professionnel' },
    {
      type: 'table',
      headers: ['Indicateur on-chain', 'Indicateur hors chaîne'],
      rows: [
        ['Convergence de flux issus d\'infractions différentes vers une même adresse', 'Annonces de change « sans KYC » sur messageries'],
        ['Volumes ronds et réguliers en USDT-TRC20', 'Coursiers, remises d\'espèces, bureaux de change informels'],
        ['Même adresse de retrait pour de nombreux comptes clients', 'Comptes ouverts par des personnes vulnérables ou recrutées'],
        ['Adresse de dépôt d\'exchange au profil de plateforme', 'Sociétés écrans sans activité réelle titulaires de comptes'],
        ['Rebalancements réguliers entre adresses de collecte et exchanges', 'Commissions supérieures au marché contre absence de questions'],
      ],
    },
    {
      type: 'case',
      title: 'Cas — Le réseau des 37 comptes',
      md: `Entre janvier et avril, 64 plaintes pour escroquerie au faux conseiller bancaire. Les virements des victimes (de 2 000 à 38 000 €) aboutissent sur **37 comptes bancaires** de particuliers, qui achètent aussitôt des USDT chez Coinhouse et Bitstamp.

Les 37 comptes d'exchange retirent vers seulement **3 adresses TRON**. Ces adresses consolident vers \`TJr4…Qa8\`, qui verse chaque semaine 100 000 à 250 000 USDT vers une adresse de dépôt attribuée à SatsDesk OTC — au total **2,84 M USDT** en quatre mois. La même adresse SatsDesk reçoit aussi des fonds exposés à un rançongiciel.

Actes : réquisition à Coinhouse (réponse directe) sur les 3 adresses de retrait → 21 comptes identifiés, IP communes à 9 d'entre eux ; DEE vers le Luxembourg pour Bitstamp ; demande d'entraide vers Hong Kong pour SatsDesk ; gel par l'émetteur de 412 000 USDT encore présents sur \`TJr4…Qa8\` ; auditions de mules révélant un recruteur unique sur une messagerie. Le dossier change de nature : d'une série d'escroqueries, il devient une affaire de **blanchiment en bande organisée** visant le recruteur et le courtier.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Qualifications à envisager',
      md: `Le blanchiment (articles 324-1 et suivants du code pénal) peut être poursuivi indépendamment de l'infraction d'origine. Le code pénal prévoit en outre une **présomption d'origine illicite** des biens lorsque les conditions matérielles, juridiques ou financières d'une opération ne peuvent avoir d'autre justification que de dissimuler cette origine (article 324-1-1) : vérifiez-en les conditions exactes. Selon les faits : association de malfaiteurs, non-justification de ressources, et **exercice d'une activité de services sur actifs numériques sans enregistrement ou agrément**, réprimé par le code monétaire et financier. Vérifiez les textes en vigueur, qui ont évolué avec l'entrée en application de MiCA.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ne pas criminaliser l\'usage ordinaire',
      md: `Les plateformes P2P, l'OTC, l'USDT-TRC20 et les cartes cadeaux sont massivement utilisés à des fins légitimes, notamment dans des pays où l'accès au système bancaire est difficile. Un vendeur P2P peut être une victime de triangulation, une mule une victime d'escroquerie à l'emploi. Les indicateurs fondent des **hypothèses** à vérifier, pas des conclusions.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Viser le nœud',
      md: `Remonter jusqu'au blanchisseur professionnel est plus long que d'interpeller des mules, mais beaucoup plus rentable : un courtier ou un recruteur démantelé, ce sont des dizaines d'affaires éclairées et des avoirs saisissables concentrés. Rapprochez vos dossiers avec ceux d'autres services (fichiers, Europol) : la convergence d'adresses entre affaires est souvent le premier signe d'un blanchisseur commun.`,
    },
  ],
  keyPoints: [
    'Le blanchisseur professionnel sert plusieurs réseaux : c\'est un point de convergence entre affaires.',
    'Placement, empilement, intégration : chaque phase a ses techniques crypto et ses prestataires.',
    'OTC complaisant : gros volumes USDT ronds, contreparties risquées hétérogènes, rebalancements vers des exchanges.',
    'Mules : une même adresse de retrait pour de nombreux comptes clients révèle le réseau.',
    'Triangulation P2P : le vendeur de bonne foi apparaît comme destinataire ; l\'acheteur réel est l\'escroc.',
    'Service imbriqué : une « exposition exchange » peut masquer une plateforme à haut risque.',
    'Qualifications : blanchiment (et présomption d\'origine illicite), exercice illégal de services sur actifs numériques, association de malfaiteurs.',
  ],
  quiz: [
    {
      q: 'Qu\'est-ce qui caractérise le blanchiment professionnel ?',
      options: [
        'Il est commis par l\'auteur de l\'infraction d\'origine',
        'Il est exercé comme un service, pour le compte de multiples réseaux, contre rémunération',
        'Il n\'utilise que des espèces',
        'Il est toujours légal',
      ],
      answer: 1,
      explain: 'Le blanchisseur professionnel est un prestataire spécialisé, souvent sans lien avec l\'infraction d\'origine.',
    },
    {
      q: 'Quels indicateurs on-chain évoquent un courtier OTC complaisant ?',
      kind: 'multi',
      options: [
        'Volumes élevés et ronds en USDT-TRC20',
        'Contreparties hétérogènes, dont certaines exposées à des activités illicites',
        'Une seule transaction par an',
        'Rebalancements réguliers vers des comptes d\'exchange',
      ],
      answer: [0, 1, 3],
      explain: 'Un courtier se caractérise par une activité intense et régulière, pas par une transaction isolée.',
    },
    {
      q: 'Dans une fraude par triangulation, qui apparaît comme destinataire du virement de la victime ?',
      options: ['L\'escroc', 'Un vendeur P2P de bonne foi', 'La plateforme P2P', 'La banque de la victime'],
      answer: 1,
      explain: 'L\'escroc fait payer par la victime la crypto qu\'il achète à un vendeur P2P ; c\'est ce vendeur qui reçoit le virement.',
    },
    {
      q: 'Dans une analyse d\'exposition, un service imbriqué peut apparaître comme un simple dépôt sur un exchange régulé, à faible risque.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: 'Vrai. Un service imbriqué peut opérer au travers d\'un compte chez l\'exchange : la réquisition révèle alors une société servant de plateforme.',
    },
    {
      q: 'Trente comptes clients d\'un exchange retirent vers les trois mêmes adresses. Quelle est la meilleure action ?',
      options: [
        'Interpeller le titulaire du premier compte',
        'Réquisitionner l\'exchange à partir de ces adresses de retrait pour identifier tous les comptes concernés et leurs données de connexion',
        'Classer : ce sont des clients différents',
        'Demander à l\'exchange de fermer les comptes sans autre acte',
      ],
      answer: 1,
      explain: 'L\'adresse de retrait commune est le pivot qui fait apparaître tout le réseau de mules, avec les IP et appareils partagés.',
    },
    {
      q: 'Quelles qualifications peuvent être envisagées contre un réseau de blanchiment professionnel ?',
      kind: 'multi',
      options: [
        'Blanchiment, y compris avec la présomption d\'origine illicite dans ses conditions légales',
        'Exercice d\'activités de services sur actifs numériques sans enregistrement ou agrément',
        'Association de malfaiteurs',
        'Contravention au code de la route',
      ],
      answer: [0, 1, 2],
      explain: 'Les trois premières qualifications sont fréquemment mobilisées ; leurs conditions doivent être vérifiées dans les textes en vigueur.',
    },
  ],
  flashcards: [
    { front: 'Blanchiment professionnel', back: 'Service de blanchiment pour le compte de tiers, contre rémunération (rapport GAFI 2018).' },
    { front: 'Placement / empilement / intégration', back: 'Introduire, brouiller, réinjecter dans l\'économie légale.' },
    { front: 'OTC complaisant', back: 'Gros volumes USDT ronds, contreparties risquées, remises d\'espèces, peu ou pas de KYC.' },
    { front: 'Pivot des réseaux de mules', back: 'Même adresse de retrait pour de nombreux comptes clients d\'un exchange.' },
    { front: 'Triangulation P2P', back: 'La victime paie la crypto que l\'escroc achète à un vendeur P2P de bonne foi.' },
    { front: 'Service imbriqué', back: 'Plateforme non régulée opérant via des comptes chez un exchange régulé.' },
    { front: 'Cartes cadeaux', back: 'Revendues contre crypto ; l\'enseigne émettrice conserve codes, achats et consommations.' },
    { front: 'Article 324-1-1 du code pénal', back: 'Présomption d\'origine illicite dans certaines conditions (à vérifier).' },
    { front: 'Indicateur hors chaîne', back: 'Annonces « sans KYC », coursiers, sociétés écrans, recrutement de personnes vulnérables.' },
    { front: 'Stratégie', back: 'Viser le nœud de blanchiment : il éclaire de nombreuses affaires.' },
  ],
}

const expertise: Lesson = {
  id: 'expertise-judiciaire',
  title: 'L\'expertise judiciaire : fiabilité et contradictoire',
  level: 5,
  track: 'enquete',
  minutes: 40,
  summary:
    'Une analyse blockchain n\'a de valeur judiciaire que si elle résiste au contradictoire. Cadres procéduraux, hiérarchie des assertions (fait, inférence, attribution), fiabilité et modes d\'échec des heuristiques, transparence des outils, reproductibilité, rédaction de conclusions, biais cognitifs et préparation à l\'audience.',
  objectives: [
    'Situer une analyse blockchain dans son cadre procédural (réquisition à personne qualifiée, expertise) et les droits des parties.',
    'Classer chaque assertion d\'un rapport selon son niveau : fait vérifiable, inférence, attribution, hypothèse.',
    'Exposer la fiabilité et les modes d\'échec des heuristiques et des outils utilisés.',
    'Rédiger des conclusions reproductibles et défendre son analyse face à une contre-expertise.',
  ],
  prerequisites: ['rapport', 'demixage-avance', 'analyse-comportementale', 'attribution-sources'],
  practice: ['coinjoin-demix', 'sextortion-cluster'],
  blocks: [
    {
      type: 'text',
      md: `Audience correctionnelle. L'avocat de la défense se lève : « Votre rapport affirme que ces 47 adresses appartiennent à mon client. Sur quelle base ? Une heuristique que vous ne pouvez pas valider, appliquée par un logiciel dont vous ne connaissez pas le code, à partir d'étiquettes fournies par une société privée étrangère. Quel est votre taux d'erreur ? »

Si vous ne pouvez pas répondre précisément, l'analyse la plus juste du monde perd sa force. L'expertise judiciaire n'est pas seulement une affaire de compétence technique : c'est une discipline de **transparence**, de **mesure** et de **loyauté**.`,
    },
    { type: 'heading', text: 'Le cadre procédural' },
    {
      type: 'table',
      headers: ['Cadre', 'Fondement (à vérifier dans la version en vigueur)', 'Caractéristiques'],
      rows: [
        ['Réquisition à personne qualifiée', 'Code de procédure pénale, cadres de l\'enquête de flagrance et préliminaire', 'Examens techniques en cours d\'enquête, par un enquêteur spécialisé ou un tiers qualifié'],
        ['Expertise ordonnée par une juridiction', 'Articles 156 et suivants du code de procédure pénale', 'Mission définie, expert inscrit ou ayant prêté serment, rapport déposé, observations et demandes des parties'],
        ['Rapport d\'analyse de l\'enquêteur', 'Procès-verbaux de l\'enquête', 'Valeur de renseignement ou de constatation selon sa rédaction ; soumis à la discussion'],
        ['Expertise privée produite par une partie', 'Pièce versée aux débats', 'Discutée contradictoirement, sans le statut de l\'expertise judiciaire'],
      ],
      caption: 'Les parties peuvent, dans les conditions prévues par le code de procédure pénale, demander des compléments d\'expertise ou une contre-expertise.',
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Liberté de la preuve, exigence du contradictoire',
      md: `En matière pénale, sauf disposition contraire, les infractions peuvent être établies par tout mode de preuve et le juge décide d'après son intime conviction ; il ne peut fonder sa décision que sur des preuves apportées au cours des débats et contradictoirement discutées (article 427 du code de procédure pénale). Une analyse blockchain n'est donc ni exclue ni sacralisée : elle vaut ce que vaut sa capacité à être **comprise, vérifiée et discutée**.`,
    },
    { type: 'heading', text: 'Hiérarchiser les assertions' },
    {
      type: 'table',
      headers: ['Niveau', 'Exemple', 'Fiabilité', 'Formulation'],
      rows: [
        ['Fait on-chain', '« La transaction 4f2a… du 12/02 transfère 0,95 BTC de l\'adresse A à l\'adresse B »', 'Vérifiable par quiconque sur un nœud', 'Affirmatif'],
        ['Inférence déterministe', '« Le bridge a versé les fonds sur BNB Chain (même nonce) »', 'Très élevée, dépend de la lecture du contrat', 'Affirmatif, méthode citée'],
        ['Inférence heuristique', '« A et C appartiennent probablement au même portefeuille (CIOH) »', 'Élevée mais faillible', 'Probabiliste, limites citées'],
        ['Attribution', '« L\'adresse D est une adresse de dépôt Binance »', 'Selon la source : réponse officielle > étiquette d\'outil > OSINT', 'Source citée et datée'],
        ['Hypothèse', '« Les retraits du pool proviennent des dépôts de A »', 'Variable, souvent modérée', 'Force de soutien, alternatives'],
      ],
      caption: 'Un rapport solide signale explicitement le niveau de chaque affirmation. Le mélange des niveaux est la première cible d\'une contre-expertise.',
    },
    {
      type: 'check',
      q: 'Dans quel niveau classer : « L\'outil d\'analyse étiquette l\'adresse X comme appartenant à Huobex » ?',
      options: [
        'Fait on-chain',
        'Attribution, dont la source (étiquette d\'un outil commercial) doit être citée et, si possible, corroborée',
        'Inférence déterministe',
        'Certitude',
      ],
      answer: 1,
      explain: 'L\'appartenance d\'une adresse à un service n\'est pas inscrite sur la chaîne : c\'est une attribution, dont la fiabilité dépend de sa source.',
    },
    { type: 'heading', text: 'Fiabilité et modes d\'échec des heuristiques' },
    {
      type: 'table',
      headers: ['Heuristique', 'Fondement', 'Modes d\'échec connus', 'Comment se prémunir'],
      rows: [
        ['CIOH', 'Il faut les clés de toutes les entrées pour signer', 'CoinJoin, PayJoin, services multi-utilisateurs, transactions collaboratives', 'Détecter et isoler ces transactions ; contrôler les sauts de taille de cluster'],
        ['Détection du rendu', 'Comportements usuels des portefeuilles', 'Montants ronds trompeurs, portefeuilles atypiques, transactions de services', 'Combiner les indices, donner une probabilité, vérifier par la dépense ultérieure'],
        ['Attribution par étiquettes', 'Dépôts tests, données publiques, sources des éditeurs', 'Étiquettes obsolètes, erronées, généralisées à tort à un cluster', 'Citer la source, dater, corroborer par réquisition'],
        ['Corrélation montant/temps', 'Proximité statistique', 'Coïncidences, fenêtres trop larges, services de masse', 'Dénombrer les candidats, justifier la fenêtre'],
        ['Démixage', 'Erreurs comportementales des utilisateurs', 'Faux positifs, indices dépendants, taux de base', 'Ensemble de candidats, poids justifiés, force de soutien'],
      ],
    },
    {
      type: 'text',
      md: `Des travaux académiques ont mesuré la fiabilité de certaines heuristiques sur des jeux de données où la vérité est connue ; ils montrent qu'elles sont **utiles mais faillibles**, et que leurs performances varient selon les périodes et les types d'utilisateurs. Vous n'avez pas besoin de citer un taux d'erreur universel — il n'en existe pas — mais vous devez pouvoir expliquer **pourquoi** l'heuristique fonctionne, **quand** elle échoue, et **ce que vous avez fait** pour détecter ces échecs dans votre dossier.`,
    },
    { type: 'widget', id: 'change-detective', caption: 'Activez et désactivez les heuristiques : constatez combien la conclusion sur le rendu dépend des indices retenus — c\'est ce que vous devrez exposer.' },
    { type: 'heading', text: 'La transparence des outils' },
    {
      type: 'text',
      md: `Les logiciels commerciaux d'analyse sont des **boîtes partiellement noires** : algorithmes de clustering propriétaires, bases d'étiquettes dont la provenance n'est pas toujours documentée. Aux États-Unis, la fiabilité d'un tel logiciel a été contestée lors du procès de l'opérateur présumé d'un ancien mixeur Bitcoin ; le tribunal a admis la preuve, mais le débat a montré l'importance de pouvoir expliquer la méthode.

Règles pratiques :

- distinguez dans le rapport ce que **l'outil affiche** de ce que **vous avez vérifié** ;
- vérifiez chaque transaction déterminante sur une source indépendante (nœud, explorateur public) ;
- citez l'outil, sa version, la date de consultation et les paramètres (profondeur, seuils) ;
- ne reprenez pas une étiquette d'outil comme une attribution certaine : corroborez par une réquisition ou une autre source.`,
    },
    {
      type: 'steps',
      items: [
        { title: 'Tracer les sources', md: `Pour chaque donnée : nœud ou explorateur, outil et version, date et heure de consultation.` },
        { title: 'Conserver le brut', md: `Transactions et reçus bruts, exports de graphes, réponses des plateformes ; empreinte (hash) de chaque fichier.` },
        { title: 'Documenter les choix', md: `Heuristiques appliquées et écartées, seuils, fenêtres temporelles, corrections manuelles de clusters.` },
        { title: 'Rendre rejouable', md: `Un tiers doit pouvoir refaire l'analyse avec les mêmes données et aboutir aux mêmes faits ; les inférences doivent être discutables sur la base des mêmes éléments.` },
        { title: 'Faire relire', md: `Une vérification par un collègue n'ayant pas participé à l'analyse, sans lui donner la conclusion attendue.` },
      ],
    },
    { type: 'heading', text: 'Rédiger les conclusions' },
    {
      type: 'compare',
      left: {
        title: 'Conclusion vulnérable',
        md: `« Le suspect contrôle les 47 adresses du cluster et a reçu l'intégralité des fonds des victimes, qu'il a blanchis via un CoinJoin avant de les déposer sur son compte Huobex. »

Pas de niveau d'assertion, pas de source, pas de limite, une attribution (« son compte ») non étayée, un passage par CoinJoin présenté comme transparent.`,
      },
      right: {
        title: 'Conclusion défendable',
        md: `« Les 47 adresses ont été regroupées par l'heuristique des entrées communes ; aucune des transactions de regroupement ne présente les caractéristiques d'un CoinJoin (annexe 3). 31 % des fonds des victimes ont transité par ces adresses (annexe 4). Après un CoinJoin, une consolidation incluant le rendu de la Tx0 initiale rattache avec une confiance élevée 0,94 BTC à une adresse de dépôt que Huobex, sur réquisition du [date], a attribuée au compte de M. X. »`,
      },
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Structure recommandée',
      md: `1. Mission et question posée.
2. Éléments reçus et sources consultées.
3. Méthode : outils (versions), heuristiques, paramètres.
4. Constatations (faits on-chain), avec annexes vérifiables.
5. Analyse : inférences, avec niveau de confiance et alternatives.
6. Limites et éléments contraires.
7. Conclusions répondant **strictement** à la question posée.`,
    },
    {
      type: 'case',
      title: 'Cas — La contre-expertise',
      md: `Le rapport rattache au prévenu un cluster de 47 adresses. La contre-expertise de la défense soutient que le cluster est contaminé par un CoinJoin et qu'il inclut des adresses de tiers.

Réexamen : les 46 transactions de regroupement sont listées. 45 sont des transactions à 1–3 entrées sans sorties égales. Une, la n° 38, compte **2 entrées et 2 sorties**, dont la structure est compatible avec un **PayJoin** : elle seule relie les 9 adresses du sous-groupe B au reste du cluster.

Réponse rédigée : le grief de contamination par CoinJoin n'est pas fondé (annexe listant les 46 transactions). En revanche, le rattachement du sous-groupe B repose sur une seule transaction dont l'interprétation n'est pas univoque : il est **requalifié** de « confiance élevée » en « confiance modérée », ce qui ramène la part des fonds rattachés avec une confiance élevée de 31 % à 24 %.

Effet à l'audience : la concession précise et chiffrée renforce la crédibilité du reste du rapport. Une position rigide sur le sous-groupe B aurait jeté le doute sur l'ensemble.`,
    },
    {
      type: 'check',
      q: 'Une contre-expertise met en évidence une faiblesse réelle sur une partie de votre analyse. Quelle attitude adopter ?',
      options: [
        'Maintenir intégralement la conclusion initiale pour ne pas affaiblir l\'accusation',
        'Reconnaître la faiblesse, requalifier précisément la partie concernée et montrer ce qui reste solide',
        'Retirer l\'ensemble du rapport',
        'Contester la compétence du contre-expert',
      ],
      answer: 1,
      explain: 'L\'expert sert la manifestation de la vérité : une concession mesurée et chiffrée protège la crédibilité de tout ce qui n\'est pas affecté.',
    },
    { type: 'heading', text: 'Biais et loyauté' },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le biais de confirmation, ennemi de l\'analyste',
      md: `Quand on sait qui est le suspect, on tend à retenir les indices qui l'accusent et à minimiser ceux qui le disculpent. Parades :

- formuler **au moins une hypothèse alternative** crédible et la tester sérieusement ;
- documenter les **résultats négatifs** (pistes explorées sans succès, indices contraires) ;
- faire vérifier les points clés par un collègue qui ne connaît pas la conclusion attendue ;
- se méfier des corrélations « parfaites » obtenues après avoir élargi les fenêtres jusqu'à trouver quelque chose.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : préparer l\'audience',
      md: `- Une **synthèse d'une page** : question, réponse, trois éléments clés, limites.
- Un **schéma** fidèle au rapport (mêmes montants, mêmes pointillés pour les liens probabilistes).
- Un **glossaire** simple : adresse, transaction, CIOH, CoinJoin, attribution.
- La liste des transactions déterminantes avec leurs hash, consultables en direct si nécessaire.
- Des analogies maîtrisées, sans en abuser, et la capacité à dire « je ne sais pas » ou « cela dépasse ce que les données permettent d'affirmer ».`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Contre-expertise', def: 'Nouvelle expertise demandée par une partie ou ordonnée pour vérifier les conclusions d\'une première.' },
        { term: 'Intime conviction', def: 'Principe selon lequel le juge apprécie librement la valeur des preuves contradictoirement débattues.' },
        { term: 'Reproductibilité', def: 'Capacité d\'un tiers à refaire l\'analyse à partir des mêmes données et à retrouver les mêmes faits.' },
        { term: 'Biais de confirmation', def: 'Tendance à privilégier les éléments qui confirment l\'hypothèse de départ.' },
        { term: 'Hypothèses concurrentes', def: 'Explications alternatives des observations, à confronter explicitement.' },
      ],
    },
    {
      type: 'check',
      q: 'Quels éléments rendent une analyse blockchain reproductible ?',
      options: [
        'Une capture d\'écran du graphe final',
        'Les données brutes hachées, les sources et versions d\'outils, les paramètres et heuristiques documentés',
        'La notoriété de l\'outil commercial utilisé',
        'Le grade de l\'enquêteur',
      ],
      answer: 1,
      explain: 'La reproductibilité repose sur la traçabilité des données et des choix méthodologiques, pas sur l\'autorité de l\'outil ou de l\'auteur.',
    },
  ],
  keyPoints: [
    'Une analyse blockchain vaut ce que vaut sa capacité à être comprise, vérifiée et contradictoirement discutée.',
    'Hiérarchiser chaque assertion : fait on-chain, inférence déterministe, inférence heuristique, attribution, hypothèse.',
    'Connaître les modes d\'échec de chaque heuristique et montrer ce qui a été fait pour les détecter.',
    'Distinguer ce que l\'outil affiche de ce qui a été vérifié ; citer outil, version, date, paramètres.',
    'Reproductibilité : données brutes hachées, sources, choix documentés, relecture indépendante.',
    'Face à une contre-expertise : concéder précisément ce qui doit l\'être, requalifier, défendre le reste.',
    'Combattre le biais de confirmation : hypothèses alternatives, résultats négatifs documentés.',
  ],
  quiz: [
    {
      q: 'Selon l\'article 427 du code de procédure pénale, sur quelles preuves le juge peut-il fonder sa décision ?',
      options: [
        'Uniquement sur des expertises judiciaires',
        'Sur des preuves apportées au cours des débats et contradictoirement discutées',
        'Uniquement sur des aveux',
        'Sur toute information, même non débattue',
      ],
      answer: 1,
      explain: 'La preuve est libre, mais elle doit avoir été soumise au débat contradictoire.',
    },
    {
      q: 'Classez : « Le bridge a versé les fonds sur l\'autre chaîne, l\'événement de départ et la transaction d\'arrivée portant le même nonce. »',
      options: ['Hypothèse', 'Inférence déterministe', 'Attribution', 'Inférence heuristique'],
      answer: 1,
      explain: 'Le lien repose sur la logique du contrat et un identifiant commun : c\'est une inférence déterministe, à présenter avec sa méthode.',
    },
    {
      q: 'Quels sont des modes d\'échec connus de la CIOH ?',
      kind: 'multi',
      options: ['Les CoinJoin', 'Les PayJoin', 'Les transactions à une seule entrée', 'Les transactions collaboratives multi-utilisateurs'],
      answer: [0, 1, 3],
      explain: 'Une transaction à une seule entrée ne regroupe rien : la CIOH ne s\'y applique pas, donc ne peut pas y échouer.',
    },
    {
      q: 'Une étiquette fournie par un outil commercial peut être présentée comme une attribution certaine sans autre vérification.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Il faut citer la source et la date, et corroborer autant que possible (réquisition, source officielle).',
    },
    {
      q: 'Quelles pratiques réduisent le biais de confirmation ?',
      kind: 'multi',
      options: [
        'Tester sérieusement une hypothèse alternative',
        'Documenter les pistes négatives et les indices contraires',
        'Élargir les fenêtres de corrélation jusqu\'à obtenir un résultat',
        'Faire relire par un collègue ignorant la conclusion attendue',
      ],
      answer: [0, 1, 3],
      explain: 'Élargir les fenêtres jusqu\'à trouver une corrélation est au contraire une manifestation du biais.',
    },
    {
      q: 'Que doit contenir la partie « méthode » d\'un rapport d\'analyse blockchain ?',
      options: [
        'Uniquement le nom de l\'outil',
        'Outils et versions, sources, heuristiques appliquées et écartées, paramètres et corrections manuelles',
        'Les conclusions',
        'Le curriculum de l\'enquêteur seulement',
      ],
      answer: 1,
      explain: 'La méthode doit permettre à un tiers de comprendre et rejouer l\'analyse.',
    },
    {
      q: 'Pourquoi une concession précise face à une contre-expertise peut-elle renforcer un rapport ?',
      options: [
        'Parce qu\'elle désarme toujours la défense',
        'Parce qu\'elle démontre la rigueur et la loyauté de l\'expert, ce qui protège la crédibilité des parties non affectées',
        'Parce qu\'elle oblige le juge à suivre le rapport',
        'Elle ne le renforce jamais',
      ],
      answer: 1,
      explain: 'Une position rigide sur un point faible fait douter de l\'ensemble ; une requalification chiffrée montre que le reste a été examiné avec la même exigence.',
    },
  ],
  flashcards: [
    { front: 'Article 427 CPP', back: 'Liberté de la preuve, intime conviction, preuves contradictoirement discutées.' },
    { front: 'Expertise judiciaire', back: 'Ordonnée par une juridiction (art. 156 et s. CPP) ; parties pouvant demander compléments ou contre-expertise.' },
    { front: 'Niveaux d\'assertion', back: 'Fait on-chain > inférence déterministe > inférence heuristique > attribution > hypothèse.' },
    { front: 'Modes d\'échec de la CIOH', back: 'CoinJoin, PayJoin, transactions collaboratives multi-utilisateurs.' },
    { front: 'Outil vs vérification', back: 'Distinguer ce que l\'outil affiche de ce que l\'analyste a vérifié sur une source indépendante.' },
    { front: 'Reproductibilité', back: 'Données brutes hachées, sources datées, versions d\'outils, paramètres, choix documentés.' },
    { front: 'Structure des conclusions', back: 'Mission, éléments, méthode, constatations, analyse, limites, conclusions strictement sur la question.' },
    { front: 'Biais de confirmation', back: 'Parade : hypothèse alternative, résultats négatifs, relecture « en aveugle ».' },
    { front: 'Concession mesurée', back: 'Requalifier précisément et chiffrer l\'impact : protège la crédibilité du reste.' },
    { front: 'Préparer l\'audience', back: 'Synthèse d\'une page, schéma fidèle, glossaire, hash des transactions clés.' },
  ],
}

const saisie: Lesson = {
  id: 'saisie-avancee',
  title: 'Perquisition et saisie avancées',
  level: 5,
  track: 'enquete',
  minutes: 40,
  summary:
    'Saisir un appareil n\'est pas saisir des fonds. Préparation de l\'opération, recherche des seeds et des secrets sur place, portefeuilles matériels et passphrases, systèmes allumés, multisig, comptes d\'exchange, transfert vers un portefeuille de saisie sous double contrôle, frais de réseau, documentation et conservation. Points de droit à vérifier dans les textes en vigueur.',
  objectives: [
    'Préparer une perquisition à dimension crypto : renseignement préalable, équipe, matériel, portefeuilles de saisie, cadre juridique.',
    'Repérer et préserver seeds, passphrases, fichiers de portefeuille et sessions ouvertes.',
    'Traiter les cas particuliers : portefeuille matériel, passphrase, multisig, nœud Lightning, comptes d\'exchange, jetons gelables.',
    'Transférer les fonds vers un portefeuille de saisie sous double contrôle et documenter chaque étape.',
  ],
  prerequisites: ['gel-saisie', 'cles-portefeuilles', 'opsec-enqueteur', 'cooperation-internationale'],
  practice: ['darknet-vendor', 'ransomware-raas'],
  blocks: [
    {
      type: 'text',
      md: `6 h 02. La porte s'ouvre. Sur le bureau : un portefeuille matériel, un carnet, un ordinateur portable dont l'écran est encore allumé. Dans la cuisine, une plaque d'acier gravée de mots dans un tiroir à couverts. Les décisions des dix prochaines minutes détermineront si les 1,8 BTC et les 14 000 USDT du suspect seront saisis… ou s'ils auront disparu avant midi, déplacés par un complice qui détient une copie de la seed.

Car c'est la règle fondamentale de cette leçon : **saisir l'appareil ne saisit pas les fonds**. Les fonds sont sur la blockchain ; quiconque détient la seed peut les déplacer, de n'importe où.`,
    },
    { type: 'heading', text: 'Préparer : l\'opération se gagne avant l\'aube' },
    {
      type: 'steps',
      items: [
        { title: 'Renseignement préalable', md: `Chaînes et actifs identifiés par l'analyse, services utilisés (exchanges, portefeuilles, échangeurs), soldes estimés, adresses à surveiller en temps réel pendant l'opération.` },
        { title: 'Cadre juridique', md: `Périmètre de la perquisition, possibilité de saisir des actifs numériques et de les transférer, instructions du magistrat sur le transfert immédiat, interlocuteur joignable pendant l'opération.` },
        { title: 'Équipe', md: `Un spécialiste crypto présent ou joignable ; deux personnes au moins pour toute manipulation de fonds (double contrôle) ; un rédacteur dédié aux constatations.` },
        { title: 'Matériel', md: `Portefeuilles de saisie préparés à l'avance pour chaque chaîne attendue, ordinateur dédié hors ligne, sacs de blindage, appareils photo, câbles, batteries, supports stériles.` },
        { title: 'Coordination', md: `Demandes de gel prêtes à partir (exchanges, émetteurs de stablecoins) au moment de l'intervention, pour éviter les retraits de dernière minute par un complice.` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Points de droit à vérifier',
      md: `Le code de procédure pénale encadre la perquisition, l'accès aux données informatiques (y compris, sous conditions, aux données accessibles depuis un système présent sur les lieux) et les **saisies spéciales** de biens incorporels (articles 706-141 et suivants). Les crypto-actifs saisis peuvent être confiés à l'AGRASC, qui en assure la gestion et peut, dans les cas prévus par la loi, procéder à leur aliénation avant jugement. Ces régimes ont évolué récemment : vérifiez la version en vigueur des textes et les instructions de votre parquet et de l'AGRASC avant l'opération.`,
    },
    { type: 'heading', text: 'Où chercher les secrets' },
    {
      type: 'table',
      headers: ['Support', 'Ce que l\'on cherche', 'Précautions'],
      rows: [
        ['Papier, carnets, cartes', 'Listes de 12, 18, 24 ou 25 mots, numérotées ou non ; passphrases ; codes PIN', 'Photographier en place avant de toucher ; un mot isolé peut être une passphrase'],
        ['Plaques métalliques', 'Seeds gravées ou poinçonnées (sauvegardes résistantes au feu)', 'Souvent cachées : tiroirs, coffres, faux plafonds, chez des proches'],
        ['Téléphones', 'Photos ou captures de seeds, applications de portefeuille, gestionnaires de mots de passe, messageries', 'Mode avion, isolement, extraction par spécialiste'],
        ['Ordinateurs', 'Fichiers de portefeuille (wallet.dat, fichiers Electrum, fichiers .keys Monero), extensions de navigateur, documents « notes »', 'Ne pas éteindre un système allumé sans décision ; capture de la mémoire par spécialiste'],
        ['Cloud et messageries', 'Notes synchronisées, courriels de confirmation d\'exchanges, sauvegardes chiffrées', 'Cadre juridique de l\'accès à distance à vérifier'],
        ['Partages Shamir (SLIP-39)', 'Plusieurs listes de 20 ou 33 mots, dont un seuil permet la reconstitution', 'Rechercher les autres parts : domicile, proches, coffres'],
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Reconnaître une seed',
      md: `Une seed BIP39 est une suite de mots issus d'une liste normalisée de 2 048 mots, en anglais le plus souvent, mais il existe une liste officielle en français. Elle compte 12, 15, 18, 21 ou 24 mots. Monero utilise 25 mots (ou 16 au format Polyseed), LND 24 mots au format aezeed. Tout ensemble de mots sans lien apparent, numérotés ou rangés en grille, doit être traité comme une seed potentielle : **photographié en place, placé sous scellé, jamais saisi dans un appareil connecté**.`,
    },
    { type: 'widget', id: 'keys-derivation', caption: 'Seed → clé privée → clé publique → adresses : celui qui détient la seed détient tout, sur toutes les chaînes dérivées.' },
    {
      type: 'check',
      q: 'Le suspect a été interpellé et son portefeuille matériel est sous scellé. Les fonds sont-ils en sécurité ?',
      options: [
        'Oui, l\'appareil contient les fonds',
        'Non : quiconque détient une copie de la seed peut déplacer les fonds depuis n\'importe où ; il faut les transférer vers un portefeuille de saisie',
        'Oui, si l\'appareil est éteint',
        'Oui, car le PIN est inconnu',
      ],
      answer: 1,
      explain: 'Les fonds sont sur la blockchain, pas dans l\'appareil. Une copie de la seed chez un complice suffit à les vider.',
    },
    { type: 'heading', text: 'Portefeuilles matériels et passphrases' },
    {
      type: 'text',
      md: `- Un portefeuille matériel est protégé par un **code PIN** ; selon les modèles, il s'efface après un petit nombre de tentatives erronées (parfois 3). **Ne jamais essayer de PIN au hasard.** Le PIN se trouve parfois noté à proximité, ou s'obtient lors de l'audition.
- La seed permet de restaurer l'accès sur un autre appareil, sans le PIN.
- Une **passphrase** (le « 25e mot ») crée des portefeuilles **cachés** distincts du portefeuille standard ouvert par le seul PIN ou la seule seed. Un portefeuille standard presque vide peut être un **leurre** : cherchez une passphrase, souvent notée séparément.
- Notez le modèle, le numéro de série et l'état (allumé, verrouillé) avant toute manipulation.`,
    },
    {
      type: 'check',
      q: 'Vous restaurez une seed saisie : le portefeuille obtenu contient 0,003 BTC alors que l\'analyse attribue 1,8 BTC au suspect. Hypothèse prioritaire ?',
      options: [
        'L\'analyse est fausse',
        'L\'existence d\'une passphrase ouvrant un portefeuille caché, ou d\'un chemin de dérivation non standard',
        'Les fonds ont été brûlés',
        'Le portefeuille matériel est défectueux',
      ],
      answer: 1,
      explain: 'La passphrase crée des portefeuilles distincts ; un chemin de dérivation ou un type d\'adresse non standard peut aussi masquer des fonds. Cherchez une passphrase et vérifiez les dérivations.',
    },
    { type: 'heading', text: 'Systèmes allumés : la fenêtre d\'or' },
    {
      type: 'text',
      md: `Un ordinateur allumé avec un portefeuille ouvert, une extension de navigateur déverrouillée ou une session d'exchange active est une opportunité qui ne se représentera pas :

- **filmer et photographier** l'écran avant toute action ;
- relever les soldes, les adresses, les historiques, les clés publiques étendues (xpub) qui permettent de dériver toutes les adresses ;
- sur instruction du magistrat et dans le cadre légal, procéder au **transfert immédiat** des fonds vers le portefeuille de saisie ;
- ne pas éteindre sans décision : un portefeuille chiffré redevient inaccessible sans le mot de passe ; la mémoire vive peut contenir des secrets récupérables par un spécialiste.`,
    },
    { type: 'heading', text: 'Cas particuliers' },
    {
      type: 'table',
      headers: ['Situation', 'Ce qu\'il faut', 'Point d\'attention'],
      rows: [
        ['Multisig Bitcoin m-sur-n', 'm clés + la configuration du portefeuille (descripteur ou clés publiques de tous les cosignataires)', 'Sans la configuration, même m seeds peuvent ne pas suffire ; certaines clés peuvent être chez des tiers'],
        ['Multisig contractuel EVM', 'Propriétaires et seuil, lisibles sur la chaîne ; clés de m propriétaires', 'Vérifier la configuration à la date de l\'opération'],
        ['Nœud Lightning', 'Seed + sauvegarde des canaux ; état documenté', 'Ne jamais relancer un ancien état (pénalité) ; fermeture forcée = délai'],
        ['Jetons ERC-20 / TRC-20', 'L\'actif natif pour payer les frais (ETH, TRX)', 'Le portefeuille de saisie doit être approvisionné ; à défaut, demander un gel à l\'émetteur'],
        ['Stablecoins centralisés', 'Demande de gel à l\'émetteur, en parallèle', 'Souvent plus sûr et plus rapide qu\'un transfert'],
        ['Comptes d\'exchange', 'Réquisition de gel et de transfert au prestataire', 'Ne pas se connecter au compte hors d\'un cadre juridique validé'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ce qu\'il ne faut jamais faire',
      md: `- Taper une seed dans un ordinateur connecté, un téléphone personnel ou un logiciel non maîtrisé.
- Envoyer des fonds saisis vers une adresse de saisie sans l'avoir vérifiée **sur l'écran d'un appareil de confiance**.
- Transférer la totalité sans transaction de test, quand les circonstances le permettent.
- Manipuler seul : toute opération sur des fonds se fait à deux, et se consigne en temps réel.
- Utiliser un portefeuille de saisie dont la seed a été générée ou stockée sans procédure formalisée.`,
    },
    { type: 'heading', text: 'Le transfert vers le portefeuille de saisie' },
    {
      type: 'steps',
      items: [
        { title: 'Préparer', md: `Portefeuille de saisie dédié à l'affaire, généré selon la procédure du service ou de l'AGRASC ; adresse de réception vérifiée sur l'appareil par deux personnes.` },
        { title: 'Restaurer sur un support maîtrisé', md: `Seed saisie restaurée sur un appareil stérile et hors ligne ou sur un portefeuille matériel neuf ; vérification des soldes et des adresses attendues.` },
        { title: 'Tester', md: `Petite transaction de test vers l'adresse de saisie ; confirmation observée sur un explorateur.` },
        { title: 'Transférer', md: `Transfert du solde, actif par actif, chaîne par chaîne ; frais adaptés pour une confirmation rapide.` },
        { title: 'Consigner', md: `Pour chaque transaction : hash, montant, frais, adresses, horodatage, opérateurs présents. Captures de l'explorateur et export brut.` },
        { title: 'Vérifier l\'exhaustivité', md: `Autres chaînes dérivées de la même seed, autres comptes, jetons et NFT, fonds en attente (retraits optimistes, fermetures de canaux).` },
      ],
    },
    {
      type: 'case',
      title: 'Cas — La plaque dans le tiroir',
      md: `**06:02** : entrée. **06:09** : portefeuille matériel et carnet sur le bureau ; ordinateur allumé, logiciel de portefeuille ouvert affichant 1,82 BTC, extension TronLink déverrouillée affichant 14 000 USDT. Film de l'écran, relevé des adresses et de la xpub.

**06:14** : appel au magistrat, qui autorise le transfert immédiat. **06:16** : demande de gel envoyée à l'émetteur de l'USDT pour l'adresse TRON, en parallèle.

**06:21** : transaction de test de 0,001 BTC vers le portefeuille de saisie (adresse vérifiée par deux enquêteurs sur l'écran du portefeuille matériel de saisie). **06:38** : confirmation. **06:40** : transfert du solde, 1,8187 BTC, frais 0,0002 BTC. Pour l'USDT : le compte TRON dispose de trop peu de TRX pour les frais ; l'émetteur confirme le gel à **07:55**.

**07:30** : une plaque d'acier gravée de 24 mots est découverte dans la cuisine, et le carnet porte la mention « + soleil ». Restauration ultérieure, sous double contrôle, avec la passphrase « soleil » : un **portefeuille caché** contenant 0,64 BTC, transféré à son tour.

**Trois semaines plus tard**, l'audition d'un complice révèle qu'il détenait une copie de la seed et a tenté de vider le portefeuille vers 11 h le jour même : les fonds n'y étaient plus. Sans le transfert immédiat, ils auraient disparu.`,
    },
    {
      type: 'check',
      q: 'Pourquoi le transfert des USDT-TRC20 a-t-il été remplacé par une demande de gel dans le cas ci-dessus ?',
      options: [
        'Parce que l\'USDT ne peut jamais être saisi',
        'Parce que le compte n\'avait pas assez de TRX pour payer les frais du transfert, et que l\'émetteur peut geler rapidement',
        'Parce que le magistrat l\'avait interdit',
        'Parce que Tron n\'a pas d\'explorateur',
      ],
      answer: 1,
      explain: 'Un transfert de jeton exige l\'actif natif pour les frais. Le gel par l\'émetteur est une alternative rapide et sûre pour les stablecoins centralisés.',
    },
    { type: 'heading', text: 'Documenter et conserver' },
    {
      type: 'text',
      md: `- **Procès-verbal détaillé** : description de chaque appareil (modèle, numéro de série, état), emplacement, photographies, personnes ayant manipulé, heure de chaque action.
- **Scellés** : les seeds et passphrases sont des scellés hautement sensibles. Même après transfert, une seed reste dangereuse (fonds arrivant plus tard sur une adresse dérivée, chaînes non vérifiées) : conservation sécurisée, accès tracé.
- **Chaîne de possession** : chaque accès ultérieur à un scellé contenant un secret est consigné.
- **Surveillance post-saisie** : alertes sur toutes les adresses dérivées, pour détecter des arrivées de fonds ou des tentatives d'accès.
- **Remise à l'AGRASC** selon les modalités convenues, avec l'historique complet des transactions de saisie.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Portefeuille de saisie', def: 'Portefeuille dédié, généré et conservé selon une procédure formalisée, recevant les fonds saisis.' },
        { term: 'Double contrôle', def: 'Toute opération sur des fonds est réalisée et vérifiée par au moins deux personnes, et consignée.' },
        { term: 'Passphrase', def: 'Mot ou phrase supplémentaire créant des portefeuilles cachés distincts à partir de la même seed.' },
        { term: 'xpub', def: 'Clé publique étendue permettant de dériver et surveiller toutes les adresses d\'un compte, sans pouvoir dépenser.' },
        { term: 'SLIP-39', def: 'Partage de seed en plusieurs parts (méthode de Shamir) dont un seuil permet la reconstitution.' },
        { term: 'Descripteur', def: 'Description normalisée d\'un portefeuille (scripts, clés, chemins), indispensable pour un multisig.' },
      ],
    },
  ],
  keyPoints: [
    'Saisir l\'appareil ne saisit pas les fonds : quiconque détient la seed peut les déplacer.',
    'Préparer : renseignement préalable, cadre juridique et instructions du magistrat, équipe en double contrôle, portefeuilles de saisie prêts.',
    'Chercher seeds, passphrases et parts Shamir partout ; photographier en place ; ne jamais saisir une seed sur un appareil connecté.',
    'Portefeuille matériel : ne jamais deviner le PIN ; un portefeuille presque vide peut cacher une passphrase.',
    'Système allumé : filmer, relever soldes, adresses et xpub, transférer sur instruction, ne pas éteindre sans décision.',
    'Jetons : prévoir l\'actif natif pour les frais, ou demander le gel à l\'émetteur.',
    'Transaction de test, adresse vérifiée sur appareil de confiance, consignation de chaque hash, surveillance post-saisie.',
  ],
  quiz: [
    {
      q: 'Quelle est la règle fondamentale de la saisie de crypto-actifs ?',
      options: [
        'Saisir l\'appareil suffit à saisir les fonds',
        'Les fonds ne sont saisis qu\'une fois transférés vers un portefeuille contrôlé par l\'autorité (ou gelés par un tiers)',
        'Il faut toujours vendre immédiatement les actifs',
        'La seed doit être détruite après la perquisition',
      ],
      answer: 1,
      explain: 'Les fonds restent sur la blockchain ; tant qu\'ils sont sur une adresse dont la seed peut exister ailleurs, ils peuvent être déplacés.',
    },
    {
      q: 'Quels éléments faut-il rechercher lors de la perquisition ?',
      kind: 'multi',
      options: [
        'Listes de mots (12 à 25) et plaques métalliques',
        'Passphrases notées séparément',
        'Parts de seed Shamir (SLIP-39)',
        'Le PIN, à deviner sur l\'appareil en cas d\'absence',
      ],
      answer: [0, 1, 2],
      explain: 'Deviner un PIN risque d\'effacer l\'appareil après quelques tentatives ; il ne faut jamais le faire.',
    },
    {
      q: 'Un portefeuille restauré à partir de la seed est presque vide alors que l\'analyse attribue des fonds importants. On peut conclure que l\'analyse est erronée.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Une passphrase peut ouvrir un portefeuille caché distinct, et des chemins de dérivation ou types d\'adresses non standard peuvent masquer des fonds.',
    },
    {
      q: 'Que faut-il pour dépenser depuis un multisig Bitcoin 2-sur-3 ?',
      options: [
        'Une seule seed',
        'Deux clés et la configuration du portefeuille (descripteur ou clés publiques des trois cosignataires)',
        'Les trois seeds obligatoirement',
        'Le mot de passe de l\'exchange',
      ],
      answer: 1,
      explain: 'Le seuil fixe le nombre de signatures ; la configuration complète est nécessaire pour reconstruire les scripts et les adresses.',
    },
    {
      q: 'Quelles précautions accompagnent un transfert vers le portefeuille de saisie ?',
      kind: 'multi',
      options: [
        'Vérifier l\'adresse de réception sur l\'écran d\'un appareil de confiance, à deux',
        'Effectuer une transaction de test quand c\'est possible',
        'Restaurer la seed sur le téléphone personnel d\'un enquêteur pour aller plus vite',
        'Consigner hash, montants, frais, horodatages et opérateurs',
      ],
      answer: [0, 1, 3],
      explain: 'Un appareil personnel ou connecté non maîtrisé expose la seed et les fonds : c\'est à proscrire.',
    },
    {
      q: 'Un compte TRON contient 14 000 USDT mais quasiment pas de TRX. Quelle option privilégier ?',
      options: [
        'Abandonner la saisie',
        'Demander le gel à l\'émetteur de l\'USDT, ou approvisionner le compte en TRX selon une procédure validée',
        'Envoyer les USDT sans frais',
        'Attendre que le suspect approvisionne le compte',
      ],
      answer: 1,
      explain: 'Les transferts de jetons TRC-20 consomment des ressources payées en TRX. Le gel par l\'émetteur est une alternative rapide pour un stablecoin centralisé.',
    },
    {
      q: 'Pourquoi une seed placée sous scellé reste-t-elle sensible après le transfert des fonds ?',
      options: [
        'Elle ne l\'est plus',
        'Parce que des fonds peuvent arriver plus tard sur des adresses dérivées, ou exister sur des chaînes non vérifiées',
        'Parce qu\'elle permet d\'identifier le suspect',
        'Parce qu\'elle expire',
      ],
      answer: 1,
      explain: 'La seed contrôle toutes les adresses dérivées, présentes et futures, sur toutes les chaînes compatibles : sa conservation doit rester sécurisée et tracée.',
    },
  ],
  flashcards: [
    { front: 'Règle d\'or de la saisie', back: 'Saisir l\'appareil ne saisit pas les fonds : transférer ou faire geler.' },
    { front: 'Seed BIP39', back: '12 à 24 mots d\'une liste normalisée de 2 048 mots (listes officielles en plusieurs langues, dont le français).' },
    { front: 'Passphrase', back: '« 25e mot » ouvrant un portefeuille caché distinct ; un portefeuille standard presque vide peut être un leurre.' },
    { front: 'PIN de portefeuille matériel', back: 'Ne jamais deviner : effacement après quelques tentatives selon les modèles.' },
    { front: 'Système allumé', back: 'Filmer, relever soldes, adresses, xpub ; transférer sur instruction ; ne pas éteindre sans décision.' },
    { front: 'Multisig m-sur-n', back: 'm clés + configuration complète (descripteur / clés publiques des cosignataires).' },
    { front: 'Jetons et frais', back: 'Un transfert ERC-20/TRC-20 exige l\'actif natif (ETH, TRX) ; sinon gel par l\'émetteur.' },
    { front: 'Double contrôle', back: 'Toute manipulation de fonds à deux, vérifiée et consignée en temps réel.' },
    { front: 'Transaction de test', back: 'Petit montant vers l\'adresse de saisie, confirmation observée avant le transfert du solde.' },
    { front: 'SLIP-39', back: 'Seed partagée en parts (Shamir) : chercher les autres parts.' },
    { front: 'Saisies spéciales', back: 'Articles 706-141 et suivants du CPP (version en vigueur à vérifier) ; gestion par l\'AGRASC.' },
  ],
}

export const L5_ENQUETE: Lesson[] = [blanchiment, expertise, saisie]
