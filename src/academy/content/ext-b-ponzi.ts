// Niveau 2 — Typologies : Ponzi, pyramides, MLM et fausses plateformes de rendement.
// Plateformes, organisateurs et adresses des exemples : FICTIFS.
// Affaires publiques citées à grands traits, sans détail non établi.
import type { Lesson } from '../model'

export const LESSON_PONZI: Lesson = {
  id: 'ponzi-mlm',
  title: 'Ponzi, MLM et fausses plateformes de rendement',
  level: 2,
  track: 'typologies',
  minutes: 35,
  summary: `« 1,5 % par jour, retirable à tout moment, bonus de parrainage sur trois niveaux » : les schémas de Ponzi et les pyramides ont trouvé dans les crypto-actifs un habillage idéal (staking, robot de trading, minage dans le cloud, contrat intelligent). Distinguer Ponzi, pyramide et MLM, lire un Ponzi sur la chaîne, quantifier victimes et profits des organisateurs, démonter le récit du « piratage » final et conduire l'enquête.`,
  objectives: [
    `Distinguer schéma de Ponzi, vente pyramidale et marketing de réseau (MLM) licite.`,
    `Reconnaître on-chain un Ponzi : collecteurs, « retraits » financés par les nouveaux dépôts, commissions de parrainage, extraction des organisateurs.`,
    `Quantifier les positions nettes (victimes perdantes, gagnants, organisateurs) et le préjudice global.`,
    `Vérifier ou réfuter le récit d'un piratage ou d'une faillite à la fin du schéma.`,
    `Organiser l'enquête : identification des victimes via les exchanges, réquisitions, qualifications à examiner.`,
  ],
  prerequisites: ['typologies', 'suivre-flux', 'exposition-risque', 'requisitions'],
  practice: ['pig-butchering-tron'],
  blocks: [
    {
      type: 'text',
      md: `En janvier, la plateforme **NovaYield** apparaît dans des groupes Telegram et des vidéos d'« investisseurs » souriants : un robot d'arbitrage piloté par intelligence artificielle rapporterait **1,5 % par jour** sur des dépôts en USDT, avec des bonus pour chaque filleul. Les premiers participants retirent sans difficulté et publient leurs gains. En septembre, les retraits sont « suspendus pour maintenance », puis la plateforme annonce avoir été **piratée**.

Il n'y a jamais eu de robot. Les retraits des premiers étaient payés par les dépôts des suivants : c'est un **schéma de Ponzi**. La bonne nouvelle pour l'enquêteur, c'est que chaque dépôt, chaque « retrait » et chaque commission a laissé une trace sur la chaîne.`,
    },
    { type: 'heading', text: 'Ponzi, pyramide, MLM : trois mécaniques à ne pas confondre' },
    {
      type: 'table',
      caption: `Comparaison des trois modèles`,
      headers: ['Critère', 'Schéma de Ponzi', 'Vente pyramidale', 'Marketing de réseau (MLM)'],
      rows: [
        ['Promesse', 'Rendement élevé et régulier sur un placement', 'Gains en recrutant de nouveaux membres', 'Revenus sur la vente de produits réels'],
        ['Source réelle des gains', 'Dépôts des nouveaux entrants', 'Droits d’entrée des recrues', 'Ventes à des clients finaux'],
        ['Recrutement', 'Pas indispensable (souvent encouragé)', 'Au cœur du modèle', 'Accessoire à la vente'],
        ['Rôle de l’organisateur', 'Gère la caisse commune, paie les « rendements »', 'Au sommet, perçoit sur toute la base', 'Distributeur de produits'],
        ['Légalité', 'Illicite (tromperie sur l’existence du placement)', 'Interdite', 'Licite si les gains proviennent réellement des ventes'],
        ['Fin', 'Effondrement quand les entrées ne couvrent plus les sorties', 'Saturation du recrutement', 'Durable si activité réelle'],
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'MLM licite',
        md: `Un vendeur indépendant perçoit une commission sur ses ventes de produits et une part des ventes de son réseau. Le produit existe, a une valeur propre et des **clients finaux** l'achètent hors du réseau.`,
      },
      right: {
        title: 'Pyramide « crypto »',
        md: `Le « produit » est un pack d'adhésion, une formation sans valeur ou un jeton sans usage. Les gains d'un membre proviennent des **droits d'entrée** de ses filleuls. Sans nouvelles recrues, tout s'arrête. La plupart des Ponzi crypto y ajoutent un étage pyramidal (bonus multiniveaux).`,
      },
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Le test du calcul',
      md: `1 % par jour composé, c'est environ **× 37,8 en un an** (1,01^365). 1,5 % par jour composé dépasse **× 200**. Aucun placement réel ne produit durablement un tel rendement ; un rendement **fixe**, **quotidien** et **sans perte** est en soi un signal d'alerte. Ce calcul simple est utile en audition, et dans le rapport pour caractériser l'invraisemblance de la promesse.`,
    },
    { type: 'heading', text: 'Les habits crypto du Ponzi' },
    {
      type: 'table',
      caption: `Habillages fréquents et ce qu'ils cachent`,
      headers: ['Habillage', 'Discours', 'Réalité habituelle', 'Indice on-chain'],
      rows: [
        ['Faux staking / épargne', '« Bloquez vos USDT, touchez 1 % par jour »', 'Caisse commune', 'Aucun contrat de staking réel, juste des adresses de collecte'],
        ['Robot de trading / arbitrage IA', '« L’algorithme exploite les écarts entre exchanges »', 'Aucune activité de trading', 'Pas de flux vers des exchanges compatibles avec un trading réel'],
        ['Minage dans le cloud', '« Louez une puissance de calcul »', 'Aucun matériel', 'Aucune récompense de minage entrante (coinbase, pool)'],
        ['Contrat intelligent « matrice »', '« Code vérifié, décentralisé, impossible à arrêter »', 'Pyramide automatisée par le contrat', 'Événements d’inscription avec parrain, paiements automatiques à la lignée'],
        ['Jeton maison', '« Le jeton va être listé, le prix monte »', 'Prix maintenu artificiellement', 'Liquidité minime, ventes des organisateurs'],
        ['Jeu ou NFT « play-to-earn »', '« Achetez un personnage, gagnez chaque jour »', 'Gains payés par les nouveaux achats', 'Revenus du jeu issus exclusivement des achats d’entrée'],
      ],
    },
    { type: 'heading', text: 'À quoi ressemble un Ponzi sur la chaîne' },
    {
      type: 'flow',
      caption: `Flux type : les « retraits » des anciens et les commissions sont payés par les dépôts des nouveaux ; les organisateurs prélèvent en continu.`,
      nodes: [
        { id: 'n', label: 'Nouveaux investisseurs', kind: 'victim', sub: 'dépôts USDT' },
        { id: 'col', label: 'Collecteurs', kind: 'suspect', sub: 'adresses de dépôt' },
        { id: 'tre', label: 'Trésorerie', kind: 'wallet', sub: 'TQn4…v8Ld' },
        { id: 'old', label: 'Anciens investisseurs', kind: 'victim', sub: '« retraits »' },
        { id: 'par', label: 'Parrains', kind: 'unknown', sub: 'commissions multiniveaux' },
        { id: 'org', label: 'Organisateurs', kind: 'suspect', sub: 'extraction' },
        { id: 'otc', label: 'OTC / exchange', kind: 'exchange', sub: 'conversion' },
      ],
      edges: [
        { from: 'n', to: 'col', label: 'dépôts' },
        { from: 'col', to: 'tre', label: 'balayages' },
        { from: 'tre', to: 'old', label: '« rendements » et retraits' },
        { from: 'tre', to: 'par', label: 'bonus de parrainage' },
        { from: 'tre', to: 'org', label: 'prélèvements réguliers' },
        { from: 'org', to: 'otc', label: 'cash-out' },
      ],
    },
    {
      type: 'text',
      md: `Les signatures à rechercher :

- **concentration** : des milliers d'adresses déposent vers un petit nombre de collecteurs, balayés vers une trésorerie ;
- **circularité** : les adresses qui reçoivent des « retraits » sont, pour l'essentiel, des adresses qui ont **d'abord déposé** ; elles reçoivent parfois plus qu'elles n'ont déposé, au début ;
- **absence d'activité économique** : aucun flux compatible avec l'activité annoncée (pas de dépôts vers des exchanges pour du trading, pas de récompenses de minage, pas de contrat de staking) ;
- **dépendance aux entrées** : jour après jour, le volume des sorties suit celui des entrées de la veille ; quand les dépôts ralentissent, les retraits sont restreints ;
- **paiements de commissions** : petits montants réguliers vers des adresses de parrains, proportionnels aux dépôts de leurs filleuls ;
- **extraction** : des sorties régulières, souvent rondes, vers des adresses qui n'ont jamais déposé, puis vers un OTC ou un exchange.`,
    },
    { type: 'widget', id: 'risk-exposure', caption: `Au prorata, la part des « retraits » d'un ancien investisseur financée par les dépôts des nouveaux entrants : dans un Ponzi pur, elle approche 100 %.` },
    {
      type: 'check',
      q: `Une plateforme se dit spécialisée dans l'arbitrage entre exchanges. Sur huit mois, ses adresses n'ont envoyé aucun fonds vers un exchange, mais des milliers de paiements vers des adresses qui avaient auparavant déposé chez elle. Que concluez-vous ?`,
      options: [
        `Les « rendements » sont vraisemblablement payés avec les dépôts : signature d'un Ponzi`,
        `L'arbitrage se fait hors chaîne : rien d'anormal`,
        `La plateforme est un exchange décentralisé`,
        `Il faut attendre la faillite pour se prononcer`,
      ],
      answer: 0,
      explain: `Un arbitrage entre exchanges suppose des mouvements vers ces exchanges. L'absence d'activité compatible avec le discours et la circularité dépôts → retraits caractérisent un Ponzi.`,
    },
    { type: 'heading', text: 'Quantifier : victimes, gagnants et organisateurs' },
    {
      type: 'steps',
      items: [
        { title: 'Délimiter le périmètre', md: `Identifiez toutes les adresses du schéma : collecteurs (adresses de dépôt communiquées aux victimes, captures du site), trésorerie, contrat éventuel. Un collecteur est confirmé quand il est balayé vers la même trésorerie.` },
        { title: 'Extraire tous les flux', md: `Pour chaque adresse du périmètre, listez entrées et sorties avec date, montant, contrepartie. Excluez les mouvements internes au schéma (collecteur → trésorerie).` },
        { title: 'Calculer la position nette par contrepartie', md: `Pour chaque adresse extérieure : total déposé − total reçu. Positif = perte ; négatif = gain net.` },
        { title: 'Classer', md: `Victimes perdantes, « gagnants » (premiers entrants, parrains actifs), organisateurs (reçoivent sans jamais avoir déposé, ou sont liés aux adresses d'administration), services (exchanges, à traiter à part).` },
        { title: 'Reconstituer la chronologie', md: `Courbes journalières des entrées et sorties, date de la première restriction de retrait, date d'arrêt. Elles démontrent la dépendance aux nouvelles entrées.` },
        { title: 'Chiffrer', md: `Total collecté, total redistribué, total extrait par les organisateurs, solde restant au jour de l'arrêt. Convertissez en euros à la date des faits et documentez la méthode.` },
      ],
    },
    {
      type: 'table',
      caption: `Positions nettes (extrait) — affaire NovaYield, en USDT`,
      headers: ['Contrepartie', 'Déposé', 'Reçu', 'Position nette', 'Classement'],
      rows: [
        ['TJx2…9pQe', '500', '2 140', '−1 640 (gain)', 'Premier entrant, parrain actif'],
        ['TBm7…aK31', '12 000', '3 960', '+8 040 (perte)', 'Victime'],
        ['TNe5…wD8f', '0', '186 400', '—', 'Commissions : chef de réseau'],
        ['TQr9…Lz2c', '0', '2 950 000', '—', 'Extraction : organisateur'],
        ['Hot wallet d’exchange', '1 420 000', '610 000', '+810 000', 'Service : clients à identifier'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Piège : l’exchange n’est pas un investisseur',
      md: `Beaucoup de victimes déposent **directement depuis leur compte d'exchange** : sur la chaîne, l'expéditeur est alors le **hot wallet de l'exchange**, partagé par des millions de clients. Ne le comptez jamais comme une seule victime. Isolez ces flux, puis requérez l'exchange avec la **liste des hashes de transaction** pour obtenir l'identité des clients à l'origine de chaque retrait. De même, les « retraits » versés vers des adresses de dépôt d'exchange désignent des clients identifiables.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — NovaYield, du lancement au « piratage »',
      md: `Périmètre : 6 adresses de collecte Tron communiquées sur le site (captures archivées), balayées chaque nuit vers la trésorerie \`TQn4hY7cW2pR8sKb5eVt1mXa9dGu3Lz6v8Ld\`.

- Du 8 janvier au 17 septembre : **4 812 adresses** ont déposé **23,4 millions d'USDT** (dont 1,42 million depuis des hot wallets d'exchanges).
- Redistribution : **9,1 millions** de « retraits » vers 3 977 adresses, toutes ayant d'abord déposé ; **2,2 millions** de commissions vers 214 adresses de parrains.
- Extraction : **8,7 millions** vers 3 adresses qui n'ont jamais déposé, dont \`TQr9…Lz2c\`, qui convertit vers un courtier OTC fictif (SatsDesk OTC) et un exchange offshore (Huobex).
- Le 3 septembre, les dépôts quotidiens chutent de 62 % ; le 5, des « frais de retrait » de 15 % apparaissent ; le 17, retraits suspendus. Il reste **3,4 millions** sur la trésorerie.
- Le 19 septembre, la plateforme annonce un **piratage**. Le même jour, les 3,4 millions partent en deux transactions vers \`TRw1…m7Yh\`, une adresse qui avait **reçu 40 TRX de \`TQr9…Lz2c\` le 2 février** pour financer ses frais.

Lecture : l'adresse du prétendu pirate a été approvisionnée par un organisateur sept mois plus tôt ; le « piratage » est un **retrait final des organisateurs**. Actes : gel des USDT restants auprès de l'émetteur, réquisitions aux exchanges (hashes des dépôts de victimes et des retraits), entraide pour l'OTC et l'exchange offshore, appel à victimes ciblé.`,
    },
    { type: 'heading', text: 'La sortie : arrêt brutal et récit du « piratage »' },
    {
      type: 'text',
      md: `La fin d'un Ponzi suit des étapes reconnaissables, qu'il faut dater précisément car elles éclairent l'intention des organisateurs :

1. **Ralentissement des entrées** : le recrutement s'essouffle, les sorties dépassent les entrées.
2. **Freinage des retraits** : nouveaux frais, montants minimums, délais, « vérification KYC » payante, blocage des fonds pendant une période.
3. **Fuite en avant** : nouvelle offre plus généreuse, migration vers un « jeton » maison, conversion forcée des soldes.
4. **Arrêt** : maintenance, piratage, attaque, gel par un « régulateur », départ d'un associé.
5. **Seconde vague** : de faux cabinets de récupération démarchent les victimes, parfois avec la liste des participants.

Le récit du **piratage** se vérifie sur la chaîne : d'où vient le gaz de l'adresse du « pirate » ? Avait-elle déjà interagi avec le schéma ou ses organisateurs ? Les fonds suivent-ils les mêmes routes de sortie que les prélèvements antérieurs ?`,
    },
    {
      type: 'check',
      q: `Une plateforme annonce un piratage. Quel constat on-chain affaiblit le plus fortement ce récit ?`,
      options: [
        `Les fonds ont été déplacés en une seule transaction`,
        `Le piratage a eu lieu un dimanche`,
        `La plateforme a publié un communiqué détaillé`,
        `L'adresse du « pirate » a été financée, des mois plus tôt, par une adresse d'organisateur`,
      ],
      answer: 3,
      explain: `Un lien de financement antérieur entre l'adresse du prétendu pirate et un organisateur rattache le « vol » aux organisateurs. À documenter avec la chronologie complète.`,
    },
    { type: 'heading', text: 'Affaires publiques : quelques repères' },
    {
      type: 'table',
      caption: `Repères à grands traits ; les montants varient selon les sources : citez toujours la source officielle`,
      headers: ['Affaire', 'Mécanique', 'Ce qu’il faut retenir'],
      rows: [
        ['Madoff (révélée en 2008)', 'Ponzi classique sur un faux fonds de gestion', 'Archétype du rendement régulier « trop beau » ; pertes en capital de plus de dix milliards de dollars'],
        ['OneCoin (à partir de 2014)', 'Prétendue cryptomonnaie vendue par packs via un réseau multiniveau', 'Pas de blockchain réelle ; sa fondatrice est en fuite depuis 2017, des dirigeants ont été condamnés aux États-Unis'],
        ['BitConnect (2016-2018)', 'Programme de « prêt » rémunéré par un prétendu robot de trading, parrainage', 'Effondrement en janvier 2018 après des injonctions de régulateurs américains ; poursuites pénales aux États-Unis'],
        ['PlusToken (2018-2019)', 'Application de portefeuille promettant des rendements', 'Arrestations et saisies massives annoncées par les autorités chinoises'],
        ['Forsage (2020-2022)', 'Pyramide automatisée par contrats intelligents', 'Poursuites de la SEC contre ses fondateurs en 2022 : le code « décentralisé » n’exonère pas ses promoteurs'],
      ],
    },
    { type: 'heading', text: 'Conduire l’enquête' },
    {
      type: 'steps',
      items: [
        { title: 'Figer les supports', md: `Site (archives, captures horodatées), conditions d'utilisation, vidéos promotionnelles, groupes et canaux, tableaux de bord des victimes (solde affiché, historique, identifiant de parrainage).` },
        { title: 'Cartographier les adresses', md: `Adresses de dépôt communiquées (souvent différentes par victime ou par période), trésorerie, contrat. Un contrat « matrice » publie souvent des **événements d'inscription** qui donnent tout l'arbre de parrainage.` },
        { title: 'Quantifier', md: `Positions nettes, chronologie, total extrait. Distinguez les simples victimes, les recruteurs rémunérés et les organisateurs.` },
        { title: 'Identifier les victimes', md: `Réquisitions aux exchanges avec les hashes des dépôts issus de leurs hot wallets et des retraits vers leurs adresses de dépôt ; rapprochement avec les plaintes ; appel à victimes si nécessaire.` },
        { title: 'Suivre l’extraction', md: `Des adresses d'organisateurs vers les OTC, exchanges, achats de biens. C'est là que se trouvent les avoirs saisissables et les identités.` },
        { title: 'Geler et saisir', md: `Gel des stablecoins restants auprès de l'émetteur, gel des comptes d'exchange des organisateurs, saisies.` },
        { title: 'Signaler', md: `L'AMF publie des listes noires de sites proposant sans autorisation des placements ou des services sur crypto-actifs ; un signalement et l'échange avec les autorités concernées peuvent faire apparaître d'autres plaintes.` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Qualifications à examiner (avec prudence)',
      md: `Selon les faits établis, plusieurs qualifications peuvent être envisagées, à vérifier et à articuler avec le parquet :

- **escroquerie** (art. 313-1 du code pénal), et **escroquerie en bande organisée** (art. 313-2) lorsque l'organisation est caractérisée ;
- **abus de confiance** (art. 314-1) lorsque des fonds remis pour un usage déterminé ont été détournés ;
- **pratiques commerciales trompeuses** et interdiction des systèmes de vente pyramidale, prévues par le **code de la consommation** ;
- infractions liées à la fourniture **sans autorisation** de services sur crypto-actifs ou de placements, prévues par le **code monétaire et financier** ;
- **blanchiment** (art. 324-1) pour le recyclage des fonds extraits, et **association de malfaiteurs** (art. 450-1).

La situation des **recruteurs** est délicate : beaucoup sont aussi des victimes ; leur connaissance du caractère frauduleux et leurs gains nets orientent l'appréciation.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : l’audition d’une victime de Ponzi',
      md: `Faites préciser : dates et montants de **chaque** dépôt et retrait, adresses utilisées (souvent un exchange), identifiant et nom du parrain, filleuls éventuels et commissions perçues, captures du tableau de bord. Une victime a souvent récupéré une partie de sa mise : seule la **position nette** mesure son préjudice. Prévenez-la des faux cabinets de récupération qui la solliciteront.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Schéma de Ponzi', def: `Montage qui paie de prétendus rendements avec les fonds des nouveaux entrants, sans activité réelle.` },
        { term: 'Vente pyramidale', def: `Système où les gains proviennent des droits d'entrée des recrues, interdit en droit français.` },
        { term: 'MLM (marketing de réseau)', def: `Vente de produits réels par un réseau de distributeurs rémunérés sur leurs ventes et celles de leur réseau ; licite si l'activité est réelle.` },
        { term: 'Position nette', def: `Total déposé moins total reçu par une contrepartie ; mesure perte ou gain.` },
        { term: 'Trésorerie', def: `Adresse centrale qui regroupe les dépôts balayés depuis les collecteurs et paie les sorties.` },
        { term: 'Arbre de parrainage', def: `Structure parrain → filleuls, parfois publiée en clair par les événements d'un contrat.` },
        { term: 'Extraction', def: `Prélèvements des organisateurs vers des adresses qui n'ont jamais déposé.` },
      ],
    },
  ],
  keyPoints: [
    `Ponzi : faux rendements payés avec les dépôts des nouveaux ; pyramide : gains tirés des recrues ; MLM : licite seulement si l'activité de vente est réelle.`,
    `Un rendement fixe, quotidien et élevé est invraisemblable : 1 % par jour composé ≈ × 37,8 par an.`,
    `On-chain : concentration vers des collecteurs, circularité dépôts → retraits, absence d'activité réelle, commissions, extraction par des adresses qui n'ont jamais déposé.`,
    `Quantifier par positions nettes et chronologie ; isoler les hot wallets d'exchanges et requérir avec les hashes.`,
    `Le « piratage » final se vérifie : financement de l'adresse du pirate, liens antérieurs avec les organisateurs, routes de sortie communes.`,
    `Qualifications à examiner avec le parquet : escroquerie (en bande organisée), abus de confiance, pratiques trompeuses, exercice sans autorisation, blanchiment.`,
  ],
  quiz: [
    {
      q: `Quelle est la différence essentielle entre un MLM licite et une vente pyramidale ?`,
      options: [
        `Le nombre de niveaux de parrainage`,
        `L'utilisation de crypto-actifs`,
        `La nationalité de l'organisateur`,
        `L'origine des gains : ventes réelles à des clients finaux, ou droits d'entrée des recrues`,
      ],
      answer: 3,
      explain: `Un MLM licite rémunère des ventes de produits réels ; une pyramide rémunère le recrutement lui-même.`,
    },
    {
      kind: 'multi',
      q: `Quels constats on-chain sont caractéristiques d'un Ponzi ? (plusieurs réponses)`,
      options: [
        `Les adresses qui reçoivent des « retraits » ont presque toutes déposé auparavant`,
        `Des sorties régulières vers des adresses qui n'ont jamais déposé`,
        `Des flux importants et réguliers vers des exchanges cohérents avec l'arbitrage annoncé`,
        `Des sorties quotidiennes qui suivent le volume des entrées`,
      ],
      answer: [0, 1, 3],
      explain: `Des flux cohérents avec l'activité annoncée plaideraient au contraire pour une activité réelle (à vérifier néanmoins).`,
    },
    {
      kind: 'truefalse',
      q: `Lorsqu'une victime a déposé depuis son compte d'exchange, l'expéditeur visible sur la chaîne est le hot wallet de l'exchange : il faut requérir l'exchange avec les hashes pour identifier le client.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Le hot wallet est partagé par de nombreux clients : le compter comme une seule victime fausserait le recensement. Les hashes permettent à l'exchange de retrouver chaque client à l'origine d'un retrait.`,
    },
    {
      q: `Une victime a déposé 12 000 USDT et reçu 3 960 USDT de « rendements ». Quel est son préjudice net ?`,
      options: [`12 000 USDT`, `15 960 USDT`, `8 040 USDT`, `3 960 USDT`],
      answer: 2,
      explain: `Position nette = 12 000 − 3 960 = 8 040 USDT. Les sommes perçues réduisent le préjudice.`,
    },
    {
      q: `Dans un Ponzi reposant sur un contrat intelligent « matrice », où trouver l'arbre de parrainage ?`,
      options: [
        `Uniquement chez l'hébergeur du site`,
        `Dans les événements d'inscription émis par le contrat (utilisateur, parrain)`,
        `Dans le code source de l'application mobile`,
        `Il n'existe pas sur la chaîne`,
      ],
      answer: 1,
      explain: `Ces contrats enregistrent chaque inscription et son parrain pour payer automatiquement la lignée ; les événements reconstituent tout l'arbre.`,
    },
    {
      kind: 'multi',
      q: `Quels signes annoncent souvent l'effondrement prochain d'une plateforme de rendement ? (plusieurs réponses)`,
      options: [
        `Apparition de frais de retrait ou de délais de blocage`,
        `Conversion forcée des soldes en jeton maison`,
        `Publication d'un audit indépendant des réserves vérifiable on-chain`,
        `Lancement d'une offre encore plus généreuse`,
      ],
      answer: [0, 1, 3],
      explain: `Freinage des retraits, fuite en avant et migration forcée précèdent typiquement l'arrêt. Une preuve de réserves vérifiable n'est pas un signe d'effondrement.`,
    },
    {
      q: `Approximativement, combien rapporte en un an un placement à 1 % par jour composé ?`,
      options: [`× 3,65`, `× 12`, `× 37,8`, `× 365`],
      answer: 2,
      explain: `1,01^365 ≈ 37,8. Un tel rendement durable est invraisemblable : c'est un argument fort pour caractériser la tromperie.`,
    },
  ],
  flashcards: [
    { front: 'Schéma de Ponzi', back: `Faux rendements payés avec les dépôts des nouveaux entrants ; aucune activité réelle.` },
    { front: 'Vente pyramidale', back: `Gains tirés des droits d'entrée des recrues ; interdite.` },
    { front: 'MLM licite', back: `Rémunération sur des ventes réelles de produits à des clients finaux.` },
    { front: '1 % par jour composé', back: `≈ × 37,8 en un an : rendement invraisemblable.` },
    { front: 'Circularité', back: `Les « retraits » vont à des adresses qui ont d'abord déposé.` },
    { front: 'Extraction', back: `Sorties vers des adresses d'organisateurs qui n'ont jamais déposé.` },
    { front: 'Position nette', back: `Déposé − reçu ; mesure le préjudice ou le gain de chaque participant.` },
    { front: 'Hot wallet comme expéditeur', back: `Plusieurs clients derrière : requérir l'exchange avec les hashes.` },
    { front: 'Vérifier un « piratage »', back: `Financement de l'adresse du pirate, liens antérieurs avec les organisateurs, routes de sortie communes.` },
    { front: 'Contrat « matrice »', back: `Pyramide automatisée : les événements d'inscription donnent l'arbre de parrainage.` },
    { front: 'Seconde vague', back: `Faux cabinets de récupération qui ciblent les victimes après l'effondrement.` },
  ],
}
