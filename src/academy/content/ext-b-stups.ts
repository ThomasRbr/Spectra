// Niveau 2 — Typologies : stupéfiants et paiements en crypto-actifs.
// Vendeurs, canaux, plateformes et adresses : FICTIFS. Hydra (réel) est cité
// uniquement pour des faits publics (saisie de 2022).
import type { Lesson } from '../model'

export const LESSON_STUPS: Lesson = {
  id: 'stupefiants-crypto',
  title: 'Stupéfiants : du point de deal au paiement en crypto',
  level: 2,
  track: 'typologies',
  minutes: 35,
  summary: `Le trafic de stupéfiants s'est « ubérisé » : menus sur Telegram, livraison à domicile, et, à certains maillons, paiements en bitcoin, en USDT ou en monero. Où apparaissent les crypto-actifs dans la chaîne du trafic, comment reconnaître un portefeuille de vendeur, quelles voies de sortie vers l'argent liquide, lien avec les marchés du darknet, achat sous pseudonyme tracé on-chain, OSINT sur les canaux et saisie des portefeuilles.`,
  objectives: [
    `Situer les crypto-actifs dans la chaîne du trafic de stupéfiants, du détaillant à l'importateur.`,
    `Reconnaître la signature on-chain d'un portefeuille de vendeur (nombreux petits paiements, balayages réguliers, consolidation).`,
    `Identifier les voies de sortie vers les espèces (P2P, OTC, collecteurs, DAB, cartes) et les actes associés.`,
    `Exploiter un achat sous pseudonyme ou une saisie de téléphone pour ancrer le traçage, dans le cadre légal adapté.`,
    `Préparer la saisie des portefeuilles d'un trafiquant sans perdre les fonds.`,
  ],
  prerequisites: ['typologies', 'clustering', 'tron-usdt', 'osint'],
  practice: ['darknet-vendor', 'money-mules', 'monero-wall'],
  blocks: [
    {
      type: 'text',
      md: `L'écoute d'un livreur de « drive » à Nantes révèle une phrase inattendue : « pour les gros clients, c'est en BTC, l'adresse est sur le menu ». Le canal Telegram du réseau publie chaque matin une carte des produits, des tarifs, des horaires de livraison… et une adresse bitcoin pour les commandes « premium ».

L'espèce reste reine dans le trafic de stupéfiants. Mais les crypto-actifs s'insèrent à des **maillons précis** : la vente en ligne, la vente sur le darknet, et surtout le **règlement des grossistes** et la **remontée de l'argent** vers les têtes de réseau. Chaque paiement on-chain est une trace permanente, qui peut documenter des mois de chiffre d'affaires.`,
    },
    { type: 'heading', text: 'Du point de deal au « menu » Telegram' },
    {
      type: 'text',
      md: `Le modèle du point de deal fixe coexiste désormais avec un modèle **commercial et logistique** :

- des **canaux** et comptes (Telegram, Snapchat, Signal, Instagram) publient des « menus » avec photos, prix dégressifs, promotions et avis clients ;
- la commande se passe par messagerie, la **livraison** est assurée par des livreurs recrutés à la tâche (« drive ») ;
- les paiements se font majoritairement en **espèces** à la livraison, parfois par virement instantané, coupons prépayés ou crypto-actifs ;
- les comptes sont fréquemment supprimés et recréés : la **continuité** se retrouve dans les numéros, les visuels, les formules… et les adresses de paiement.`,
    },
    {
      type: 'table',
      caption: `Où apparaissent les crypto-actifs dans la chaîne du trafic`,
      headers: ['Maillon', 'Paiement dominant', 'Place des crypto-actifs', 'Trace exploitable'],
      rows: [
        ['Détail de rue / point de deal', 'Espèces', 'Marginale', 'Faible on-chain ; forte en téléphonie'],
        ['Vente en ligne locale (menus, livraison)', 'Espèces, virement, parfois BTC ou USDT', 'Clients « premium », commandes à distance', 'Adresse publiée sur le menu, souvent réutilisée'],
        ['Vente sur le darknet', 'BTC, de plus en plus XMR', 'Quasi exclusive', 'Séquestre du marché, retraits du vendeur'],
        ['Semi-grossiste / grossiste', 'Espèces, USDT', 'Règlements de lots', 'Gros transferts USDT-TRC20 réguliers'],
        ['Importation, têtes de réseau', 'Compensation espèces ↔ USDT, OTC', 'Remontée des profits à l’étranger', 'Flux vers OTC et exchanges offshore'],
      ],
    },
    { type: 'heading', text: 'Quelles cryptos, pour quoi faire ?' },
    {
      type: 'table',
      caption: `Les actifs utilisés et ce qu'ils permettent à l'enquêteur`,
      headers: ['Actif', 'Usage typique', 'Traçabilité', 'Levier'],
      rows: [
        ['Bitcoin (BTC)', 'Vente en ligne, darknet historique', 'Bonne : UTXO, clustering', 'Exchanges, P2P, saisie de supports'],
        ['USDT-TRC20', 'Grossistes, compensation, remontée des fonds', 'Bonne : modèle à comptes', 'Gel par l’émetteur, exchanges, OTC'],
        ['Monero (XMR)', 'Darknet, vendeurs prudents', 'Très faible on-chain', 'Points de conversion, supports saisis'],
        ['Litecoin, autres', 'Ponctuel (frais bas)', 'Bonne', 'Exchanges'],
      ],
    },
    { type: 'heading', text: 'Le portefeuille de vendeur : une signature reconnaissable' },
    {
      type: 'text',
      md: `Un vendeur de détail en ligne reçoit beaucoup de **petits paiements** de clients différents et doit régulièrement les **regrouper** pour les écouler. Sur la chaîne, cela dessine une silhouette caractéristique :

- **nombreux paiements entrants** de faible montant (souvent l'équivalent de 20 à 300 €), avec des montants ronds **en euros** une fois convertis au cours du jour (50 €, 100 €, 250 €), pas en BTC ;
- des **expéditeurs variés**, souvent des retraits d'exchanges grand public ou d'applications de paiement (le client achète du BTC juste pour payer) ;
- une **adresse réutilisée** quand elle figure sur un menu, ou un renouvellement d'adresse par commande si le vendeur utilise un portefeuille HD ;
- des **balayages réguliers** (tous les 2 à 5 jours) qui consolident ces UTXO en une transaction à nombreuses entrées : l'heuristique des entrées communes regroupe alors toutes les adresses du vendeur ;
- une **sortie** vers un même point de conversion : plateforme P2P, OTC, exchange, ou adresse d'un fournisseur.

Les horaires des paiements (soirées, week-ends) et leur corrélation avec les livraisons constatées par ailleurs renforcent l'attribution.`,
    },
    {
      type: 'flow',
      caption: `Silhouette d'un portefeuille de vendeur : collecte, consolidation, sortie.`,
      nodes: [
        { id: 'c1', label: 'Clients', kind: 'victim', sub: 'retraits d’exchanges' },
        { id: 'a1', label: 'Adresse du menu', kind: 'suspect', sub: 'bc1q7nd…k3w' },
        { id: 'a2', label: 'Adresses de commande', kind: 'suspect', sub: 'portefeuille HD' },
        { id: 'cons', label: 'Consolidation', kind: 'wallet', sub: 'tous les 3 à 5 jours' },
        { id: 'p2p', label: 'Vendeur P2P', kind: 'service', sub: 'BTC → virement' },
        { id: 'sup', label: 'Fournisseur', kind: 'unknown', sub: 'USDT-TRC20' },
      ],
      edges: [
        { from: 'c1', to: 'a1', label: '1 140 paiements · 20 à 300 €' },
        { from: 'c1', to: 'a2', label: 'commandes à distance' },
        { from: 'a1', to: 'cons', label: 'balayage multi-entrées' },
        { from: 'a2', to: 'cons', label: 'balayage multi-entrées' },
        { from: 'cons', to: 'p2p', label: 'revente en euros' },
        { from: 'cons', to: 'sup', label: 'conversion puis règlement du lot', dashed: true },
      ],
    },
    { type: 'widget', id: 'cioh-cluster', caption: `Les balayages de consolidation dépensent ensemble les petites adresses de collecte : l'heuristique des entrées communes reconstitue le portefeuille du vendeur.` },
    {
      type: 'check',
      q: `Une adresse a reçu 870 paiements de 0,0006 à 0,005 BTC en six mois, depuis plus de 600 expéditeurs différents, puis est dépensée tous les quatre jours avec d'autres adresses vers un même destinataire. Quelle hypothèse est la plus cohérente ?`,
      options: [
        `Une adresse de dépôt d'exchange`,
        `Le portefeuille d'un vendeur de détail qui consolide ses encaissements`,
        `Une adresse de minage`,
        `Une adresse de CoinJoin`,
      ],
      answer: 1,
      explain: `Multitude de petits paiements de payeurs distincts, consolidations régulières multi-entrées, destination unique : c'est la silhouette d'un encaissement commercial de détail. Une adresse de dépôt d'exchange serait balayée vers un hot wallet identifié, sans regroupement avec d'autres adresses du même titulaire.`,
    },
    { type: 'heading', text: 'Les voies de sortie vers les espèces' },
    {
      type: 'table',
      caption: `Cash-out : canaux, signatures et actes`,
      headers: ['Canal', 'Fonctionnement', 'Signature', 'Acte prioritaire'],
      rows: [
        ['Plateforme P2P', 'Vente de BTC/USDT à des particuliers contre virement ou espèces', 'Dépôts vers un séquestre, comptes bancaires multiples côté acheteurs', 'Réquisition à la plateforme (annonces, contreparties), puis aux banques'],
        ['OTC / courtier', 'Gros volumes USDT ↔ espèces, parfois remis en main propre', 'Montants ronds élevés vers une adresse de courtier', 'Identification du courtier, entraide si étranger'],
        ['Collecteurs d’espèces (compensation)', 'Les espèces restent en France, l’équivalent en USDT est crédité ailleurs', 'USDT-TRC20 réguliers sans lien bancaire', 'Surveillance physique + traçage des USDT, gel'],
        ['DAB crypto', 'Vente de crypto contre billets au distributeur', 'Dépôts vers l’adresse de l’exploitant', 'Réquisition à l’exploitant (vidéo, identité selon seuils)'],
        ['Carte de paiement crypto', 'Dépense en euros adossée à un compte crypto', 'Dépôt vers un prestataire émetteur', 'Réquisition au prestataire et à l’émetteur de la carte'],
        ['Exchange', 'Vente puis virement bancaire', 'Dépôt vers une adresse attribuée', 'Réquisition (KYC, IBAN de retrait)'],
        ['Achats directs', 'Véhicules, montres, location, immobilier à l’étranger', 'Paiement vers un commerçant ou un intermédiaire', 'Saisie des biens, réquisition au commerçant'],
      ],
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'La compensation : l’argent ne traverse pas la frontière',
      md: `Typologie largement décrite par les services européens : un réseau de **collecteurs** récupère les espèces du trafic en France ; en contrepartie, un « banquier » crédite l'équivalent en **USDT** à l'organisation, ou à son fournisseur à l'étranger, à partir de sa propre trésorerie. Les espèces collectées sont ensuite revendues à des clients qui ont besoin de liquide en France. Aucun billet ne passe la frontière, aucune banque n'est sollicitée : seuls les **transferts d'USDT** et les **rendez-vous physiques** trahissent le système. Le gel des USDT par l'émetteur est ici un levier majeur.`,
    },
    { type: 'heading', text: 'Le lien avec les marchés du darknet' },
    {
      type: 'text',
      md: `Sur un marché du darknet, l'acheteur crédite son **compte sur le marché** (adresse de dépôt fournie par le marché), commande, et le paiement est conservé en **séquestre** (*escrow*) jusqu'à la confirmation de réception ; le vendeur retire ensuite ses gains vers ses propres adresses. Certains marchés proposent un séquestre **multisignature** (acheteur, vendeur, marché).

Points clés pour l'enquête :

- les adresses de dépôt sont **gérées par le marché**, pas par le vendeur : on suit surtout les **retraits du vendeur** ;
- de nombreux marchés imposent ou privilégient désormais le **monero** : la piste on-chain s'arrête souvent aux points de conversion XMR ↔ BTC/USDT ;
- un vendeur darknet français a presque toujours une **activité locale** associée (envois postaux, points de retrait), qui offre des leviers classiques ;
- la saisie d'un marché par les autorités (par exemple **Hydra Market**, saisi en avril 2022 par les autorités allemandes) fournit parfois des données exploitables par entraide.`,
    },
    { type: 'heading', text: 'Stratégie d’enquête' },
    {
      type: 'steps',
      items: [
        { title: 'Ancrer une adresse', md: `Adresse publiée sur un menu (capture horodatée), adresse fournie lors d'un **achat sous pseudonyme**, adresse ou phrase de récupération découverte sur un téléphone saisi, retrait d'exchange d'un client interpellé : chaque point d'ancrage relie la chaîne au réseau.` },
        { title: 'Reconstituer le portefeuille du vendeur', md: `Clustering par entrées communes lors des consolidations, rendu, réutilisation d'adresses. Mesurez le nombre de paiements, la période d'activité, le montant total encaissé.` },
        { title: 'Estimer le chiffre d’affaires', md: `Convertissez chaque paiement en euros **au cours du jour** et totalisez par mois. Croisez avec les tarifs du menu : 1 140 paiements à un panier moyen de 90 € documentent environ 100 000 € de ventes en ligne, hors espèces.` },
        { title: 'Suivre les sorties', md: `P2P, OTC, exchanges, fournisseur. Les flux vers un fournisseur en USDT peuvent remonter le réseau d'un ou deux niveaux.` },
        { title: 'OSINT sur les canaux', md: `Archivage des menus, du nombre d'abonnés, des messages épinglés, des visuels réutilisés, des numéros de contact, des changements de nom ; recoupement avec les autres canaux du même réseau.` },
        { title: 'Requérir et geler', md: `Exchanges et plateformes P2P (identité, IBAN, IP), exploitants de DAB, émetteur de l'USDT pour un gel, opérateurs de messagerie selon leurs procédures.` },
        { title: 'Préparer la saisie', md: `Liste des adresses et services à saisir au moment de l'interpellation, portefeuille de destination prêt, rôles répartis (voir ci-dessous).` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Achat sous pseudonyme : un cadre strict',
      md: `L'**enquête sous pseudonyme** (article 230-46 du code de procédure pénale) permet à des enquêteurs **spécialement habilités**, pour les crimes et délits punis d'emprisonnement commis par un moyen de communication électronique, de participer sous pseudonyme aux échanges, d'être en contact avec les auteurs présumés, d'extraire et de conserver des données et, **avec l'autorisation du procureur de la République ou du juge d'instruction**, d'acquérir des contenus, produits, substances ou services, y compris illicites. À peine de nullité, ces actes **ne peuvent constituer une incitation** à commettre l'infraction.

Le code prévoit en outre, pour le trafic de stupéfiants, un régime propre d'acquisition de produits et de surveillance de l'acheminement (article 706-32 du code de procédure pénale). Vérifiez la rédaction en vigueur, l'habilitation des agents, l'autorisation préalable et la traçabilité de chaque échange (procès-verbaux, captures, conservation des fonds utilisés).`,
    },
    {
      type: 'compare',
      left: {
        title: 'Ce que prouve un achat tracé on-chain',
        md: `- L'adresse fournie par le vendeur **reçoit** le paiement de l'enquêteur, à une heure précise : ancrage incontestable.
- Le paiement est **suivi** dans les consolidations : il rattache tout le cluster au vendeur.
- Les autres paiements entrants dessinent la **clientèle** et le volume d'activité.`,
      },
      right: {
        title: 'Ce qu’il ne prouve pas seul',
        md: `- **Qui** contrôle les clés : il faut une identification (réquisition, téléphonie, surveillance, saisie).
- Que **tous** les paiements entrants sont des ventes de stupéfiants : à étayer par d'autres éléments.
- La **qualité** du produit : l'analyse de la substance reste indispensable.`,
      },
    },
    {
      type: 'case',
      title: 'Cas pratique — le menu de « @Plug_Atlantique »',
      md: `Un canal Telegram de 2 300 abonnés publie un menu avec l'adresse \`bc1q7ndx4j0m2s9ty6hq8lrz3cwg5pfa0vke2u5k3w\` pour les « commandes à distance ». Le 12 septembre à 21:47, un enquêteur habilité, autorisé par le parquet, règle une commande de 150 € : **0,00231 BTC**, transaction confirmée à 21:58.

Analyse :

- l'adresse du menu a reçu **1 140 paiements** du 3 février au 30 septembre, de 0,0003 à 0,0046 BTC ; 78 % arrivent entre 18:00 et 01:00 ;
- tous les 3 à 5 jours, une transaction de consolidation dépense l'adresse du menu avec **9 à 40 autres adresses** : le cluster compte 312 adresses et **6,84 BTC** encaissés au total (environ 410 000 € au cours de chaque jour), dont 1,6 BTC environ sur la seule adresse du menu ;
- les consolidations alimentent deux sorties : un vendeur sur une **plateforme P2P** (4,1 BTC revendus contre virements) et un échange vers **38 500 USDT-TRC20** envoyés à une adresse Tron qui reçoit aussi des fonds de deux autres clusters de vendeurs : un **fournisseur commun** probable ;
- sur le téléphone du livreur interpellé, l'application de portefeuille contient une adresse du même cluster.

Actes : réquisition à la plateforme P2P (identité du vendeur, contreparties, IBAN), demande de gel des USDT restant sur l'adresse du fournisseur présumé, réquisitions aux exchanges d'où proviennent les paiements des clients les plus réguliers, rapprochement avec les deux autres réseaux.`,
    },
    {
      type: 'check',
      q: `Un enquêteur veut acheter, sous un pseudonyme, une commande à un vendeur sur Telegram pour obtenir son adresse de paiement. Qu'est-ce qui est indispensable ?`,
      options: [
        `Rien : la consultation d'un canal public suffit à tout justifier`,
        `L'accord écrit de Telegram`,
        `Une décision d'enquête européenne`,
        `Une habilitation spécifique et l'autorisation du magistrat pour l'acquisition, sans provoquer l'infraction`,
      ],
      answer: 3,
      explain: `Lire un canal public est une simple consultation de sources ouvertes ; interagir et acheter relève de l'enquête sous pseudonyme (agents habilités, autorisation du procureur ou du juge d'instruction pour l'acquisition, interdiction de l'incitation).`,
    },
    { type: 'heading', text: 'Saisir les portefeuilles du trafiquant' },
    {
      type: 'steps',
      items: [
        { title: 'Avant l’interpellation', md: `Inventaire des adresses, applications et services connus ; portefeuille de destination contrôlé par l'État prêt selon les instructions du magistrat ; enquêteur formé désigné ; matériel d'isolement des téléphones.` },
        { title: 'À la perquisition', md: `Rechercher **phrases de récupération** (papier, plaque métal, notes, photos), portefeuilles matériels, applications sur téléphones et ordinateurs, extensions de navigateur, accès aux comptes d'exchanges et de P2P. Isoler immédiatement les téléphones du réseau.` },
        { title: 'Transférer vite', md: `Les fonds sur un portefeuille auto-hébergé peuvent être déplacés à distance par un complice qui détient la même phrase. Le transfert vers le portefeuille de saisie, sur instruction du magistrat, doit intervenir sans délai et être consigné (hash, montant, adresses).` },
        { title: 'Geler ce qui est chez des tiers', md: `Réquisitions de gel aux exchanges et plateformes, demande de gel des USDT à l'émetteur.` },
        { title: 'Documenter', md: `Procès-verbal détaillé : support, méthode, adresses dérivées, soldes, transactions de transfert, témoins. Le régime des saisies spéciales (articles 706-141 et suivants du CPP) et l'intervention éventuelle de l'AGRASC encadrent la suite.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le monero et les complices',
      md: `Un portefeuille monero n'est pas analysable sur la chaîne : seule la **phrase de récupération** ou le fichier de portefeuille, avec son mot de passe, permet de connaître et de saisir le solde. Et une phrase de récupération retrouvée chez un suspect est souvent **connue d'un complice** : tant que les fonds ne sont pas transférés, ils peuvent disparaître pendant la garde à vue.`,
    },
    {
      type: 'table',
      caption: `Qualifications usuelles (code pénal) — à adapter aux faits et à vérifier`,
      headers: ['Faits', 'Qualification', 'Remarque'],
      rows: [
        ['Transport, détention, offre, cession, acquisition, emploi illicites', 'Trafic de stupéfiants (art. 222-37)', 'Socle de la plupart des dossiers de vente en ligne'],
        ['Cession ou offre à une personne pour sa consommation', 'Art. 222-39', 'Vente au détail'],
        ['Blanchiment du produit du trafic', 'Art. 222-38', 'Conversion en crypto, compensation, OTC'],
        ['Impossibilité de justifier ses ressources en lien avec des trafiquants', 'Art. 222-39-1', 'Train de vie sans revenus déclarés'],
        ['Blanchiment général', 'Art. 324-1 et présomption de l’art. 324-1-1', 'Prestataires, collecteurs, OTC'],
        ['Organisation et bande organisée', 'Art. 222-34 et circonstances aggravantes', 'Procédure applicable à la criminalité organisée'],
      ],
    },
    {
      type: 'terms',
      items: [
        { term: 'Menu', def: `Carte des produits, prix et modalités publiée par un réseau sur une messagerie ; peut contenir une adresse de paiement.` },
        { term: 'Drive', def: `Livraison de stupéfiants à domicile par des livreurs recrutés à la tâche.` },
        { term: 'Consolidation', def: `Transaction qui regroupe de nombreux petits UTXO en une seule sortie ; révèle le cluster du vendeur.` },
        { term: 'Séquestre (escrow)', def: `Conservation du paiement par le marché ou par un multisig jusqu'à la confirmation de réception.` },
        { term: 'Compensation', def: `Échange d'espèces collectées en France contre des USDT crédités ailleurs, sans mouvement physique ni bancaire transfrontalier.` },
        { term: 'Enquête sous pseudonyme', def: `Cadre (art. 230-46 CPP) permettant à des agents habilités d'interagir et, avec autorisation, d'acquérir.` },
      ],
    },
  ],
  keyPoints: [
    `L'espèce domine, mais les crypto-actifs s'insèrent à des maillons précis : vente en ligne, darknet, règlement des grossistes, remontée des profits.`,
    `Portefeuille de vendeur : nombreux petits paiements de payeurs distincts, montants ronds en euros, consolidations régulières multi-entrées.`,
    `L'USDT-TRC20 domine les règlements de gros et la compensation ; le gel par l'émetteur est un levier majeur.`,
    `Le monero coupe la piste on-chain : viser les points de conversion et les supports saisis.`,
    `Un achat sous pseudonyme tracé on-chain ancre le cluster, dans le cadre de l'article 230-46 CPP (habilitation, autorisation, pas d'incitation).`,
    `Saisie : phrases de récupération et supports, transfert sans délai vers le portefeuille de saisie, gel chez les tiers, procès-verbal détaillé.`,
  ],
  quiz: [
    {
      q: `Pourquoi les montants reçus par un vendeur de détail paraissent-ils « irréguliers » en BTC ?`,
      options: [
        `Parce que les prix sont fixés en euros et convertis au cours du moment`,
        `Parce que le vendeur utilise un mixeur`,
        `Parce que Bitcoin arrondit les montants`,
        `Parce que les clients paient toujours en plusieurs fois`,
      ],
      answer: 0,
      explain: `Les menus affichent des prix en euros ; chaque paiement en BTC correspond à un montant rond en euros au cours du jour. Reconvertir au cours du jour fait réapparaître les prix du menu.`,
    },
    {
      kind: 'multi',
      q: `Quels indices caractérisent le portefeuille d'un vendeur de détail en ligne ? (plusieurs réponses)`,
      options: [
        `De nombreux paiements entrants de faible montant, depuis des payeurs différents`,
        `Des transactions de consolidation régulières à nombreuses entrées`,
        `Des sorties de montants égaux, mélangées à celles d'autres utilisateurs`,
        `Une activité concentrée sur les soirées et week-ends`,
      ],
      answer: [0, 1, 3],
      explain: `Des sorties de montants égaux mélangées évoquent un CoinJoin, pas un encaissement commercial.`,
    },
    {
      kind: 'truefalse',
      q: `Sur un marché du darknet, les adresses de dépôt des acheteurs appartiennent généralement au vendeur, ce qui permet de l'identifier directement.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Les adresses de dépôt sont gérées par le marché (séquestre). On suit surtout les retraits du vendeur vers ses propres adresses.`,
    },
    {
      q: `Dans un système de compensation, quel élément technique est le levier le plus rapide pour bloquer les fonds ?`,
      options: [
        `La saisie des espèces chez le collecteur uniquement`,
        `Une réquisition à la banque du collecteur`,
        `Une demande de suppression du canal Telegram`,
        `Une demande de gel des USDT auprès de l'émetteur`,
      ],
      answer: 3,
      explain: `La compensation repose sur des transferts d'USDT ; tant qu'ils sont sur une adresse identifiée, l'émetteur peut les geler.`,
    },
    {
      kind: 'multi',
      q: `Lors d'une enquête sous pseudonyme visant à acheter auprès d'un vendeur en ligne, quelles conditions faut-il respecter ? (plusieurs réponses)`,
      options: [
        `Agir par des enquêteurs spécialement habilités`,
        `Obtenir l'autorisation du procureur ou du juge d'instruction pour l'acquisition`,
        `Proposer au vendeur un prix élevé pour l'inciter à vendre`,
        `Tracer et consigner chaque échange`,
      ],
      answer: [0, 1, 3],
      explain: `L'incitation à commettre l'infraction est proscrite à peine de nullité.`,
    },
    {
      q: `Une phrase de récupération est découverte lors d'une perquisition. Quel est le risque principal si l'on attend la fin de la garde à vue pour agir ?`,
      options: [
        `La phrase expire au bout de 24 heures`,
        `Le réseau Bitcoin bloque les portefeuilles saisis`,
        `Un complice qui connaît la même phrase peut vider le portefeuille à distance`,
        `Aucun : les fonds sont figés tant que le suspect est retenu`,
      ],
      answer: 2,
      explain: `La phrase de récupération donne le contrôle à quiconque la connaît. Le transfert vers le portefeuille de saisie, sur instruction du magistrat, doit être immédiat.`,
    },
    {
      q: `Quelle qualification vise spécifiquement le blanchiment du produit du trafic de stupéfiants ?`,
      options: [
        `Article 313-1 du code pénal`,
        `Article 222-38 du code pénal`,
        `Article 230-46 du code de procédure pénale`,
        `Article 222-39 du code pénal`,
      ],
      answer: 1,
      explain: `L'article 222-38 réprime le blanchiment lié au trafic de stupéfiants ; 222-39 vise la cession pour consommation personnelle, 313-1 l'escroquerie, 230-46 CPP l'enquête sous pseudonyme.`,
    },
  ],
  flashcards: [
    { front: 'Silhouette d’un vendeur', back: `Nombreux petits paiements de payeurs distincts, montants ronds en euros, consolidations régulières multi-entrées.` },
    { front: 'Adresse sur un menu', back: `Souvent réutilisée : permet de compter les paiements et d'ancrer le cluster.` },
    { front: 'USDT-TRC20 dans le trafic', back: `Règlements de grossistes, compensation, remontée des profits ; gelable par l'émetteur.` },
    { front: 'Monero dans le trafic', back: `Darknet et vendeurs prudents ; piste on-chain coupée, viser conversions et supports.` },
    { front: 'Compensation', back: `Espèces collectées en France ↔ USDT crédités ailleurs, sans mouvement transfrontalier visible.` },
    { front: 'Séquestre darknet', back: `Le marché conserve le paiement jusqu'à confirmation ; suivre les retraits du vendeur.` },
    { front: 'Art. 230-46 CPP', back: `Enquête sous pseudonyme : agents habilités, acquisition sur autorisation du magistrat, pas d'incitation.` },
    { front: 'Art. 706-32 CPP', back: `Régime propre au trafic de stupéfiants : acquisition de produits et surveillance de l'acheminement.` },
    { front: 'Art. 222-38 C. pén.', back: `Blanchiment du produit du trafic de stupéfiants.` },
    { front: 'Estimer le chiffre d’affaires', back: `Convertir chaque paiement au cours du jour, totaliser par mois, croiser avec les tarifs du menu.` },
    { front: 'Saisie d’une phrase de récupération', back: `Transfert immédiat vers le portefeuille de saisie : un complice peut connaître la même phrase.` },
  ],
}
