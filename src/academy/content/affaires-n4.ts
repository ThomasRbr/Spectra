// Affaires décryptées — niveau 4 : Bitfinex, ChipMixer, Garantex.
// Affaires RÉELLES : seuls les faits établis par des sources publiques
// (communiqués officiels, documents judiciaires, presse de référence) sont
// rapportés. Les personnes non condamnées sont présumées innocentes.
// Les illustrations chiffrées sont signalées comme fictives.
import type { Lesson } from '../model'

export const LESSONS_AFFAIRES_N4: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // BITFINEX
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-bitfinex',
    title: 'Affaire décryptée : le piratage de Bitfinex et son blanchiment',
    level: 4,
    track: 'affaires',
    minutes: 35,
    summary: `En 2016, près de 120 000 BTC sont dérobés à l'exchange Bitfinex. En février 2022, les autorités américaines arrêtent un couple new-yorkais et saisissent environ 94 000 BTC, grâce à des clés privées retrouvées dans un compte en ligne. Les documents judiciaires décrivent un catalogue de techniques de blanchiment : identités fictives, comptes de marchés du darknet, mixeurs, chain hopping, peel chains. Analyse d'un dossier où les techniques ont échoué face au temps et à la persévérance.`,
    objectives: [
      `Retracer l'affaire Bitfinex, du piratage de 2016 aux condamnations de 2024 et à la restitution.`,
      `Décrire les techniques de blanchiment listées par le DOJ et leurs points faibles respectifs.`,
      `Expliquer le rôle décisif de l'accès aux données en ligne d'un suspect dans la saisie.`,
      `Transposer les enseignements : fonds non blanchis, forks, convergence vers des comptes identifiés.`,
    ],
    prerequisites: ['peel-chains', 'chain-hopping', 'mixeurs', 'gel-saisie', 'forensique-supports'],
    practice: ['chain-hopping', 'centralized-mixer', 'peel-chain'],
    blocks: [
      {
        type: 'text',
        md: `En **août 2016**, un pirate s'introduit dans le réseau de l'exchange **Bitfinex** et autorise frauduleusement plus de **2 000 transactions**, qui transfèrent **119 754 BTC** vers un portefeuille qu'il contrôle. À l'époque, ces bitcoins valent environ **71 millions de dollars**.

Le **8 février 2022**, **Ilya Lichtenstein** et **Heather Morgan** sont arrêtés à Manhattan pour association de blanchiment et association de fraude au préjudice des États-Unis. Le DOJ annonce la saisie d'environ **94 000 BTC**, alors valorisés à environ **3,6 milliards de dollars** : la plus importante saisie financière de son histoire à cette date.

En **août 2023**, les deux prévenus plaident coupable. Lichtenstein reconnaît être l'auteur du piratage. En **novembre 2024**, il est condamné à **cinq ans** d'emprisonnement, et Heather Morgan à **dix-huit mois**.`,
      },
      { type: 'heading', text: 'Chronologie' },
      {
        type: 'steps',
        items: [
          { title: 'Août 2016 — le piratage', md: `Plus de 2 000 transactions frauduleuses vident 119 754 BTC de Bitfinex vers un portefeuille du pirate. Selon les documents judiciaires, celui-ci supprime ensuite identifiants d'accès et journaux qui auraient pu l'identifier.` },
          { title: '2016-2022 — le blanchiment partiel', md: `Selon le DOJ, environ 25 000 BTC seulement sortent du portefeuille, par un circuit complexe qui aboutit en partie à des comptes financiers contrôlés par le couple. Le reste ne bouge pas.` },
          { title: 'Février 2022 — l’arrestation et la saisie', md: `Les enquêteurs accèdent à des fichiers stockés dans un compte en ligne de Lichtenstein, qui contiennent la liste des adresses du portefeuille et les clés privées correspondantes. Environ 94 000 BTC sont saisis.` },
          { title: '3 août 2023 — les plaidoyers', md: `Lichtenstein plaide coupable d'association de blanchiment ; Morgan, d'association de blanchiment et d'association de fraude au préjudice des États-Unis. Le gouvernement indique avoir saisi depuis 2022 environ 475 millions de dollars supplémentaires liés au piratage.` },
          { title: 'Novembre 2024 — les peines', md: `Le 14 novembre, Lichtenstein est condamné à 60 mois d'emprisonnement et trois ans de liberté surveillée ; le 18 novembre, Morgan est condamnée à 18 mois.` },
          { title: '2025 — la restitution', md: `En janvier 2025, le gouvernement demande la restitution en nature à Bitfinex d'environ 94 643 BTC et des actifs issus des forks (BCH, BSV, BTG). Le tribunal a ensuite ordonné cette restitution, selon la presse spécialisée.` },
        ],
      },
      { type: 'heading', text: 'Le circuit de blanchiment décrit par le DOJ' },
      {
        type: 'flow',
        caption: `Schéma simplifié, établi d'après les communiqués du DOJ et de l'IRS-CI (2022-2024). Les techniques sont représentées par étapes ; l'ordre réel des opérations variait.`,
        nodes: [
          { id: 'bfx', label: 'Bitfinex', kind: 'victim', sub: 'août 2016' },
          { id: 'w', label: 'Portefeuille du pirate', kind: 'suspect', sub: '119 754 BTC' },
          { id: 'dorm', label: 'Fonds restés en place', kind: 'wallet', sub: '≈ 94 000 BTC' },
          { id: 'peel', label: 'Peel chains', kind: 'tx', sub: '≈ 25 000 BTC sortis' },
          { id: 'dnm', label: 'Comptes darknet et exchanges', kind: 'deposit', sub: 'identités fictives' },
          { id: 'mix', label: 'Mixeurs', kind: 'mixer', sub: 'Bitcoin Fog, Helix, ChipMixer' },
          { id: 'hop', label: 'Chain hopping', kind: 'dex', sub: 'dont cryptos anonymes' },
          { id: 'acc', label: 'Comptes du couple', kind: 'exchange', sub: 'comptes d’entreprise, or' },
        ],
        edges: [
          { from: 'bfx', to: 'w', label: '> 2 000 tx' },
          { from: 'w', to: 'dorm' },
          { from: 'w', to: 'peel' },
          { from: 'peel', to: 'dnm', label: 'dépôt puis retrait' },
          { from: 'dnm', to: 'mix', dashed: true },
          { from: 'dnm', to: 'hop', dashed: true },
          { from: 'mix', to: 'acc', dashed: true },
          { from: 'hop', to: 'acc', label: 'convergence' },
        ],
      },
      {
        type: 'table',
        caption: 'Les techniques listées dans les communiqués officiels, et leur point faible',
        headers: ['Technique', 'But recherché', 'Point faible'],
        rows: [
          ['Identités fictives pour ouvrir des comptes', 'Dissocier les comptes des vraies personnes', 'Les comptes finaux, eux, étaient liés au couple'],
          ['Programmes automatisant les transactions', 'Multiplier les opérations en peu de temps', 'Un volume anormal crée une signature reconnaissable'],
          ['Dépôts puis retraits sur des marchés du darknet et des exchanges', 'Casser la continuité de la trace', 'Les services gardent des journaux, exploitables s’ils sont saisis ou requis'],
          ['Chain hopping, y compris vers des cryptos à confidentialité renforcée', 'Changer de blockchain pour perdre le suiveur', 'Les points de conversion sont des services identifiables'],
          ['Mixeurs (Bitcoin Fog, Helix, ChipMixer)', 'Mélanger les fonds avec ceux d’autres clients', 'Ces trois services ont depuis été démantelés'],
          ['Comptes d’entreprise aux États-Unis', 'Donner une apparence légitime aux flux bancaires', 'Ancre l’argent dans le système bancaire réglementé'],
          ['Achat de pièces d’or, enterrées', 'Sortir de l’écosystème numérique', 'Reste un bien physique saisissable'],
        ],
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Des pelures aux comptes de passage',
        md: `Selon l'exposé des faits rapporté par la presse, une partie des fonds a été écoulée en **peel chains** et transférée vers des comptes ouverts sur des marchés du darknet, dont AlphaBay. Ces marchés servaient de **comptes de passage** : on dépose, on attend, on retire vers une nouvelle adresse. Pour l'observateur extérieur, la trace semble s'arrêter dans le portefeuille mutualisé du marché. Pour l'enquêteur qui obtient plus tard les données de ce marché, la correspondance dépôt / retrait redevient lisible.`,
      },
      {
        type: 'check',
        q: `Quelle proportion des bitcoins volés était encore sur le portefeuille du pirate au moment de la saisie de 2022 ?`,
        options: [
          `Moins de 5 %`,
          `Environ un quart`,
          `Environ les trois quarts (environ 94 000 BTC sur 119 754)`,
          `La totalité`,
        ],
        answer: 2,
        explain: `Selon le DOJ, environ 25 000 BTC seulement avaient été sortis par le circuit de blanchiment ; environ 94 000 BTC restaient sur le portefeuille et ont été saisis.`,
      },
      { type: 'heading', text: 'Le moment pivot' },
      {
        type: 'case',
        title: 'Les clés privées dans un compte en ligne',
        md: `Six ans de blanchiment prudent ont été rattrapés par un **fichier**. Selon le DOJ, les enquêteurs ont accédé, sur autorisation judiciaire, à des fichiers stockés dans un **compte en ligne** contrôlé par Ilya Lichtenstein. Ces fichiers contenaient la **liste de toutes les adresses** du portefeuille recevant les fonds volés, avec les **clés privées** correspondantes.

Trois enseignements :

1. **Le traçage oriente, la perquisition conclut.** L'analyse blockchain avait relié une partie des flux à des comptes du couple ; c'est l'accès aux données stockées qui a permis d'appréhender les fonds.
2. **Les clés vivent hors de la chaîne.** Fichiers, notes, gestionnaires de mots de passe, sauvegardes en ligne : la forensique des supports et des comptes en ligne est aussi décisive que l'analyse on-chain.
3. **Les fonds non blanchis sont saisissables d'un bloc.** Parce que l'essentiel n'avait jamais bougé, une seule série de transactions a suffi à placer environ 94 000 BTC sous main de justice.`,
      },
      {
        type: 'widget',
        id: 'timing-correlation',
        caption: `Illustration simplifiée : corréler montant et délai entre l'entrée et la sortie d'un service de conversion permet de proposer un lien lors d'un chain hopping. Une telle corrélation reste une inférence, à présenter avec ses limites.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Limites : l’inférence n’est pas la preuve',
        md: `Les communiqués officiels mentionnent une conversion vers des cryptos à confidentialité renforcée. Des commentateurs ont relevé que le lien entre certaines entrées et sorties d'une conversion vers Monero reposait sur une **inférence** (correspondance de montants et de délais) plutôt que sur un traçage direct, impossible sur cette chaîne. Dans un rapport, distinguez toujours ce qui est **observé** (transaction, adresse) de ce qui est **déduit** (corrélation), et indiquez le degré de confiance.`,
      },
      { type: 'heading', text: 'Les erreurs des auteurs' },
      {
        type: 'table',
        caption: 'Ce qui a fait échouer le blanchiment',
        headers: ['Erreur', 'Conséquence'],
        rows: [
          ['Clés privées conservées dans un compte en ligne', 'Accès des enquêteurs et saisie d’environ 94 000 BTC'],
          ['Convergence finale vers des comptes au nom du couple', 'Rattachement des flux à des personnes identifiées'],
          ['Masse de fonds laissée en place pendant six ans', 'Une cible unique et surveillée, saisissable d’un bloc'],
          ['Passage par des services ensuite démantelés (mixeurs, marché du darknet)', 'Des journaux potentiellement exploitables a posteriori'],
          ['Patrimoine physique (pièces d’or)', 'Biens tangibles, saisissables'],
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Ce que le blanchiment promettait',
          md: `- Identités fictives : des comptes sans visage.
- Darknet et mixeurs : une trace qui s'arrête.
- Chain hopping : un suiveur perdu au changement de chaîne.
- Patience : laisser passer le temps.`,
        },
        right: {
          title: 'Ce qui s’est passé',
          md: `- Les comptes **finaux** étaient liés au couple.
- Les services traversés ont été **démantelés** et leurs données saisies.
- Les points de conversion sont des **prestataires** identifiables.
- Le temps a joué **contre** eux : la blockchain n'oublie rien et la valeur saisie a été multipliée.`,
        },
      },
      {
        type: 'check',
        q: `Lors de la saisie de bitcoins volés en 2016, pourquoi faut-il aussi s'intéresser au BCH, au BSV et au BTG ?`,
        options: [
          `Parce que ce sont des jetons émis par Bitfinex`,
          `Parce que les forks postérieurs ont dupliqué les soldes : les mêmes clés contrôlent aussi les actifs issus de ces forks`,
          `Parce que la loi impose de convertir les bitcoins saisis dans ces trois actifs`,
          `Parce que ces actifs sont des stablecoins adossés au bitcoin`,
        ],
        answer: 1,
        explain: `Un UTXO antérieur à un fork existe aussi sur la chaîne issue du fork. La demande de restitution de janvier 2025 visait d'ailleurs, outre les BTC, les actifs BCH, BSV et BTG.`,
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Chercher les clés hors de la chaîne', md: `Perquisitions, saisies de supports, réquisitions aux hébergeurs de stockage en ligne : un fichier, une capture ou une phrase de récupération notée suffisent à rendre des fonds saisissables.` },
          { title: 'Identifier les fonds jamais blanchis', md: `Dans un vol important, mesurez la part restée en place : c'est souvent la plus grosse et la plus facile à saisir.` },
          { title: 'Suivre jusqu’à la convergence', md: `Les circuits complexes finissent par converger vers des comptes utilisables par les auteurs (exchanges, banques). C'est là que se fait le rattachement à une identité.` },
          { title: 'Penser aux forks et aux actifs dérivés', md: `Lors d'une saisie de bitcoins anciens, vérifiez les soldes sur les chaînes issues des forks et mentionnez-les dans la décision de saisie.` },
          { title: 'Associer la victime à la restitution', md: `La restitution en nature à la victime suppose une traçabilité irréprochable de la chaîne de possession des avoirs saisis, de la saisie jusqu'à la décision.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Département de la Justice des États-Unis, communiqué du 8 février 2022 sur l'arrestation d'Ilya Lichtenstein et Heather Morgan et la saisie d'environ 94 000 BTC.
- IRS Criminal Investigation, communiqué du 3 août 2023 sur les plaidoyers de culpabilité (page consultée : irs.gov/node/125136).
- IRS Criminal Investigation, communiqué du 14 novembre 2024 sur la condamnation d'Ilya Lichtenstein (page consultée sur irs.gov).
- Presse (The Record, TRM Labs, The Block) sur la condamnation de Heather Morgan le 18 novembre 2024 et sur la demande de restitution de janvier 2025.
- Presse spécialisée rapportant l'exposé des faits (peel chains, comptes AlphaBay) et les débats sur l'inférence relative à Monero (2022-2023).`,
      },
    ],
    keyPoints: [
      `Août 2016 : 119 754 BTC dérobés à Bitfinex par plus de 2 000 transactions frauduleuses.`,
      `Février 2022 : arrestation d'I. Lichtenstein et H. Morgan, saisie d'environ 94 000 BTC grâce à des clés trouvées dans un compte en ligne.`,
      `Techniques listées par le DOJ : identités fictives, automatisation, comptes de darknet et d'exchanges, chain hopping, mixeurs, comptes d'entreprise, or.`,
      `Août 2023 : plaidoyers de culpabilité ; novembre 2024 : cinq ans pour Lichtenstein, dix-huit mois pour Morgan.`,
      `L'essentiel des fonds n'avait jamais été blanchi : il a été saisi d'un bloc, puis restitué en nature à Bitfinex.`,
      `Distinguer observation et inférence, surtout lors d'un passage par une crypto à confidentialité renforcée.`,
    ],
    quiz: [
      {
        q: `Combien de bitcoins ont été dérobés à Bitfinex en 2016 ?`,
        options: ['69 370 BTC', '50 676 BTC', '401 000 BTC', '119 754 BTC'],
        answer: 3,
        explain: `Plus de 2 000 transactions frauduleuses ont transféré 119 754 BTC vers un portefeuille contrôlé par le pirate.`,
      },
      {
        kind: 'multi',
        q: `Quelles techniques de blanchiment figurent dans les communiqués officiels de l'affaire ? (plusieurs réponses)`,
        options: [
          `Identités fictives pour ouvrir des comptes en ligne`,
          `Chain hopping, y compris vers des cryptos à confidentialité renforcée`,
          `Émission d'un faux stablecoin`,
          `Passage par des mixeurs dont ChipMixer`,
        ],
        answer: [0, 1, 3],
        explain: `Identités fictives, chain hopping et mixeurs (Bitcoin Fog, Helix, ChipMixer) sont cités. Aucune émission de stablecoin n'est mentionnée.`,
      },
      {
        q: `Qu'est-ce qui a permis la saisie d'environ 94 000 BTC en 2022 ?`,
        options: [
          `L'accès, sur autorisation judiciaire, à des fichiers d'un compte en ligne contenant les clés privées du portefeuille`,
          `Un accord amiable avec le pirate`,
          `Un gel décidé par les mineurs`,
          `La coopération d'un mixeur`,
        ],
        answer: 0,
        explain: `Selon le DOJ, les fichiers stockés dans un compte en ligne de Lichtenstein contenaient la liste des adresses du portefeuille et leurs clés privées.`,
      },
      {
        kind: 'truefalse',
        q: `Ilya Lichtenstein a reconnu, lors de son plaidoyer de culpabilité, être l'auteur du piratage de 2016.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `Selon les documents judiciaires, il a reconnu avoir utilisé des outils de piratage avancés pour pénétrer le réseau de Bitfinex, puis avoir supprimé identifiants et journaux.`,
      },
      {
        q: `Quelles peines ont été prononcées en novembre 2024 ?`,
        options: [
          `Dix ans pour Lichtenstein, cinq ans pour Morgan`,
          `Un an et un jour pour chacun`,
          `Cinq ans pour Lichtenstein, dix-huit mois pour Morgan`,
          `Réclusion à perpétuité pour Lichtenstein`,
        ],
        answer: 2,
        explain: `Lichtenstein a été condamné le 14 novembre 2024 à 60 mois d'emprisonnement, Morgan le 18 novembre 2024 à 18 mois.`,
      },
      {
        kind: 'truefalse',
        q: `Une correspondance de montants et de délais entre l'entrée et la sortie d'une conversion vers Monero constitue un traçage direct, équivalent à une transaction observée.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `C'est une inférence statistique. Elle peut être convaincante mais doit être présentée comme telle, avec son degré de confiance, distinctement des faits observés.`,
      },
      {
        kind: 'multi',
        q: `Quelles leçons un enquêteur français peut-il tirer de ce dossier ? (plusieurs réponses)`,
        options: [
          `Renoncer dès qu'un mixeur apparaît dans le circuit`,
          `Rechercher les clés et phrases de récupération dans les supports et comptes en ligne`,
          `Mesurer la part des fonds jamais blanchis, souvent saisissable d'un bloc`,
          `Vérifier les actifs issus des forks lors d'une saisie de bitcoins anciens`,
        ],
        answer: [1, 2, 3],
        explain: `Un mixeur complique la trace sans la rendre définitivement opaque : les services peuvent être démantelés et leurs données saisies, comme ce fut le cas des trois mixeurs cités.`,
      },
      {
        q: `Que demandait le gouvernement américain en janvier 2025 concernant les fonds saisis ?`,
        options: [
          `Leur vente aux enchères au profit du Trésor`,
          `Leur restitution en nature à Bitfinex (environ 94 643 BTC et actifs issus des forks)`,
          `Leur destruction`,
          `Leur conversion en dollars avant restitution`,
        ],
        answer: 1,
        explain: `La demande portait sur une restitution en nature à Bitfinex, que le tribunal a ensuite ordonnée selon la presse.`,
      },
    ],
    flashcards: [
      { front: 'Piratage Bitfinex', back: `Août 2016 : plus de 2 000 transactions frauduleuses, 119 754 BTC (environ 71 M$ à l'époque).` },
      { front: 'Saisie de février 2022', back: `Environ 94 000 BTC (environ 3,6 Md$), plus importante saisie financière du DOJ à cette date.` },
      { front: 'Clé du dossier', back: `Fichiers d'un compte en ligne contenant les adresses du portefeuille et leurs clés privées.` },
      { front: 'Part blanchie', back: `Environ 25 000 BTC sortis du portefeuille ; le reste n'avait jamais bougé.` },
      { front: 'Mixeurs cités par le DOJ', back: `Bitcoin Fog, Helix et ChipMixer, tous démantelés depuis.` },
      { front: 'Compte de passage', back: `Compte sur un marché du darknet ou un exchange où l'on dépose puis retire pour casser la trace.` },
      { front: 'Plaidoyers (3 août 2023)', back: `Lichtenstein : association de blanchiment. Morgan : association de blanchiment et de fraude au préjudice des États-Unis.` },
      { front: 'Peines (novembre 2024)', back: `Lichtenstein : 5 ans ; Morgan : 18 mois.` },
      { front: 'Forks et saisie', back: `Les BTC antérieurs à un fork existent aussi sur la chaîne issue du fork (BCH, BSV, BTG).` },
      { front: 'Observation contre inférence', back: `Une corrélation de montants et de délais reste une déduction, à signaler comme telle.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHIPMIXER
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-chipmixer',
    title: 'Affaire décryptée : le démantèlement de ChipMixer',
    level: 4,
    track: 'affaires',
    minutes: 30,
    summary: `Le 15 mars 2023, les autorités allemandes et américaines, avec l'appui d'Europol, mettent hors ligne ChipMixer, l'un des mixeurs de bitcoins les plus utilisés par les cybercriminels. Quatre serveurs, environ 1 909 BTC et 7 To de données sont saisis ; le DOJ inculpe un ressortissant vietnamien présenté comme son opérateur. Comment fonctionnait un mixeur à « chips », pourquoi un mixeur centralisé est vulnérable, et ce que ses données saisies changent pour les enquêtes.`,
    objectives: [
      `Expliquer le fonctionnement d'un mixeur centralisé à « chips » et ce qui le distingue d'un CoinJoin.`,
      `Retracer l'opération du 15 mars 2023 et les accusations portées contre l'opérateur présumé.`,
      `Identifier les pistes d'analyse et les limites face aux sorties d'un mixeur custodial.`,
      `Savoir mobiliser la coopération européenne pour exploiter les données d'un service démantelé.`,
    ],
    prerequisites: ['mixeurs', 'clustering', 'coinjoin', 'cooperation-internationale'],
    practice: ['centralized-mixer', 'coinjoin-demix'],
    blocks: [
      {
        type: 'text',
        md: `**ChipMixer** était un service de mélange de bitcoins non enregistré, lancé à la mi-**2017** et accessible sur le web comme sur le darknet. Sa promesse : rompre le lien entre les bitcoins déposés et ceux retirés.

Le **15 mars 2023**, les autorités **allemandes** (police criminelle fédérale BKA et parquet spécialisé de Francfort) et **américaines**, avec l'appui d'**Europol** et la participation de la Belgique, de la Pologne et de la Suisse, mettent le service hors ligne. Sont saisis : **quatre serveurs**, environ **1 909,4 BTC** (environ **44,2 millions d'euros**) et **7 To** de données.

Selon Europol, ChipMixer pourrait avoir servi à blanchir environ **152 000 BTC** (environ 2,73 milliards d'euros selon les estimations communiquées), notamment au profit de groupes de rançongiciels, de trafiquants de stupéfiants et d'armes, et d'auteurs de fraudes à la carte bancaire.`,
      },
      { type: 'heading', text: 'Comment fonctionnait un mixeur à « chips »' },
      {
        type: 'text',
        md: `Selon Europol et le DOJ, les bitcoins déposés étaient convertis en **« chips »**, de petits jetons de **valeur équivalente**, qui étaient ensuite mélangés avec ceux des autres clients.

D'après les descriptions publiques du service lui-même (et non les documents judiciaires), les chips correspondaient à des **adresses préalimentées** de valeurs standardisées. Au retrait, l'utilisateur pouvait recevoir la **clé privée** de chaque chip, c'est-à-dire d'une adresse déjà approvisionnée par d'autres fonds que les siens. Le lien direct entre dépôt et retrait disparaissait donc de la blockchain : seul le service connaissait la correspondance.

Point essentiel : c'est un mixeur **custodial**. Pendant le mélange, les fonds appartiennent de fait au service, qui détient les clés, tient les comptes et conserve un **historique**.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Mixeur custodial (type ChipMixer)',
          md: `- Le service **détient** les fonds et les clés pendant le mélange.
- Le lien dépôt / retrait existe dans **sa base de données**.
- Un opérateur, des serveurs, des noms de domaine : des cibles juridiques.
- Une saisie peut appréhender **les fonds en caisse** et **l'historique**.`,
        },
        right: {
          title: 'CoinJoin (non custodial)',
          md: `- Chaque participant garde ses clés ; la transaction est construite collectivement.
- Le mélange est **visible** on-chain (sorties de montants égaux).
- Pas de base de correspondance centralisée à saisir.
- L'analyse repose sur les erreurs post-mixage et les heuristiques.`,
        },
      },
      { type: 'heading', text: 'Chronologie et accusations' },
      {
        type: 'steps',
        items: [
          { title: 'Mi-2017 — lancement', md: `ChipMixer est mis en service et se fait connaître dans les milieux cybercriminels.` },
          { title: '15 mars 2023 — l’opération', md: `Saisie des quatre serveurs, d'environ 1 909,4 BTC et de 7 To de données ; le site affiche une bannière de saisie. Les noms de domaine sont saisis.` },
          { title: '15 mars 2023 — l’inculpation', md: `Le DOJ annonce l'inculpation, à Philadelphie, de **Minh Quốc Nguyễn**, ressortissant vietnamien résidant à Hanoï, pour blanchiment, exploitation d'une activité de transmission de fonds sans licence et usurpation d'identité. Il est accusé d'avoir enregistré les noms de domaine, payé l'hébergement et fait la promotion du service. À l'annonce, il n'était pas détenu. Il est présumé innocent.` },
        ],
      },
      {
        type: 'table',
        caption: 'Les flux attribués à ChipMixer par le DOJ (allégations de la plainte)',
        headers: ['Catégorie', 'Montant ou description selon le DOJ'],
        rows: [
          ['Volume total traité', 'Plus de 3 milliards de dollars en crypto-actifs depuis 2017'],
          ['Fonds désignés comme volés', 'Environ 700 millions de dollars'],
          ['Rançongiciels', 'Environ 17 millions de dollars, liés à environ 37 souches'],
          ['Marchés du darknet', 'Plus de 200 millions de dollars'],
          ['Boutiques de fraude', 'Environ 35 millions de dollars'],
          ['Renseignement militaire russe (GRU)', 'Achat d’infrastructures pour le logiciel malveillant Drovorub'],
          ['Obligations réglementaires', 'Clients aux États-Unis, aucun enregistrement auprès du FinCEN, aucune collecte d’identité'],
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Un fil qui relie les dossiers',
        md: `Les communiqués officiels de l'affaire **Bitfinex** (août 2023) citent ChipMixer parmi les mixeurs utilisés par Ilya Lichtenstein et Heather Morgan pour blanchir une partie des fonds volés, aux côtés de Bitcoin Fog et Helix. Un même service de blanchiment apparaît ainsi dans des dossiers très différents : rançongiciels, darknet, piratages d'exchanges. Europol cite notamment, parmi les utilisateurs, les groupes de rançongiciels Zeppelin, SunCrypt, Mamba, Dharma et LockBit.`,
      },
      {
        type: 'flow',
        caption: `Schéma simplifié du fonctionnement d'un mixeur à chips (illustration générique, sans montants réels).`,
        nodes: [
          { id: 'u', label: 'Utilisateur', kind: 'suspect', sub: 'fonds illicites' },
          { id: 'dep', label: 'Adresse de dépôt', kind: 'deposit', sub: 'fournie par le service' },
          { id: 'cm', label: 'Mixeur custodial', kind: 'mixer', sub: 'comptes internes' },
          { id: 'pool', label: 'Réserve de chips', kind: 'wallet', sub: 'adresses préalimentées' },
          { id: 'ch', label: 'Chips retirées', kind: 'wallet', sub: 'clés remises à l’utilisateur' },
          { id: 'out', label: 'Adresse finale', kind: 'unknown', sub: 'exchange, autre service' },
          { id: 'db', label: 'Base de données', kind: 'service', sub: 'correspondances' },
        ],
        edges: [
          { from: 'u', to: 'dep' },
          { from: 'dep', to: 'cm', label: 'crédit interne' },
          { from: 'pool', to: 'ch', label: 'attribution' },
          { from: 'cm', to: 'ch', label: 'lien hors chaîne', dashed: true },
          { from: 'ch', to: 'out', label: 'regroupement ?' },
          { from: 'cm', to: 'db', dashed: true },
        ],
      },
      {
        type: 'check',
        q: `Pourquoi la saisie des serveurs d'un mixeur custodial est-elle particulièrement précieuse pour les enquêteurs ?`,
        options: [
          `Parce qu'elle permet d'annuler les mélanges passés`,
          `Parce que le service conservait la correspondance entre dépôts et retraits, absente de la blockchain`,
          `Parce que les serveurs contiennent les clés privées de tous les exchanges`,
          `Parce qu'elle oblige les utilisateurs à se dénoncer`,
        ],
        answer: 1,
        explain: `Dans un mixeur custodial, le lien entre dépôt et retrait n'existe que dans les systèmes du service. Les données saisies peuvent permettre de reconstituer ces correspondances pour des enquêtes en cours.`,
      },
      { type: 'heading', text: 'Pistes d’analyse et limites' },
      {
        type: 'table',
        caption: 'Pistes générales face aux sorties d’un mixeur à chips (méthodes d’analyse, non issues du dossier)',
        headers: ['Piste', 'Principe', 'Limite'],
        rows: [
          ['Regroupement de chips', 'Des chips dépensées ensemble dans une même transaction sont rattachées à un même utilisateur (entrées communes)', 'Le service pouvait aussi regrouper ; à confirmer par d’autres indices'],
          ['Valeurs standardisées', 'Des montants ronds et répétitifs signalent des chips', 'D’autres services utilisent des montants ronds'],
          ['Délais', 'Rapprocher la date d’un dépôt et celle de retraits aux montants cohérents', 'Inférence fragile si le volume du service est élevé'],
          ['Destination', 'Les chips aboutissent souvent chez un exchange : réquisition possible', 'Exchanges peu coopératifs ou non régulés'],
          ['Données saisies', 'Correspondances internes du service', 'Accès par la coopération avec les autorités détentrices'],
        ],
      },
      {
        type: 'widget',
        id: 'cioh-cluster',
        caption: `Illustration simplifiée : lorsqu'un utilisateur dépense plusieurs chips dans une même transaction, l'heuristique des entrées communes les rattache à un seul portefeuille, et donc les unes aux autres.`,
      },
      {
        type: 'case',
        title: 'Le moment pivot : saisir la caisse et la mémoire',
        md: `Un mixeur custodial a deux points faibles structurels, que l'opération du 15 mars 2023 a visés simultanément :

1. **La caisse.** Pour remettre instantanément des chips, le service doit détenir une **réserve** de bitcoins. En saisissant les serveurs, les enquêteurs ont appréhendé environ 1 909 BTC, transférés en 55 transactions selon les comptes rendus de l'opération.
2. **La mémoire.** Pour fonctionner, le service doit savoir qui a déposé quoi et qui a le droit de retirer quoi. Les 7 To de données saisies portent cette mémoire.

À cela s'ajoute la cible juridique classique : un **opérateur présumé**, des noms de domaine, un hébergement payé. Là où un CoinJoin ne laisse aucune base centrale à saisir, le mixeur custodial concentre en un point les fonds, les données et les responsabilités.`,
      },
      { type: 'heading', text: 'Faiblesses exploitées' },
      {
        type: 'table',
        caption: 'Faiblesses du service et erreurs fréquentes de ses utilisateurs',
        headers: ['Faiblesse', 'Conséquence'],
        rows: [
          ['Infrastructure à portée des autorités allemandes', 'Saisie des serveurs, des données et des fonds'],
          ['Réserve de fonds détenue par le service', 'Environ 1 909 BTC saisis'],
          ['Clientèle américaine sans enregistrement ni contrôle d’identité (selon le DOJ)', 'Base juridique des poursuites aux États-Unis'],
          ['Promotion publique du service', 'Éléments d’attribution à l’opérateur présumé'],
          ['Utilisateurs regroupant leurs chips ou les envoyant vers un compte vérifié', 'Liens on-chain et points de réquisition'],
        ],
      },
      {
        type: 'check',
        q: `Une victime française a été escroquée en 2022 ; vos traces montrent un passage des fonds par ChipMixer. Quelle démarche est la plus pertinente ?`,
        options: [
          `Documenter les dépôts identifiés vers ChipMixer et solliciter, via Europol ou une demande d'entraide, l'exploitation des données saisies`,
          `Clore la trace : un mixeur rend tout suivi impossible`,
          `Contacter l'opérateur présumé pour obtenir les correspondances`,
          `Demander à la victime de payer un service de « récupération »`,
        ],
        answer: 0,
        explain: `Les données saisies sont détenues par les autorités allemandes et américaines. La voie normale passe par Europol et l'entraide pénale, sur la base des dépôts précisément identifiés (adresses, txid, dates, montants).`,
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Ne pas s’arrêter au mixeur', md: `Documentez précisément chaque dépôt vers le service : c'est la clé qui permettra plus tard de retrouver les correspondances dans des données saisies.` },
          { title: 'Vérifier si le service a été démantelé', md: `De nombreux mixeurs ont été démantelés (ChipMixer, Bitcoin Fog, Helix…). Renseignez-vous auprès des structures spécialisées et d'Europol avant de conclure à une impasse.` },
          { title: 'Chercher les erreurs post-mixage', md: `Regroupement de chips, réutilisation d'adresses, envoi direct vers un compte vérifié : les erreurs des utilisateurs recréent des liens.` },
          { title: 'Qualifier juridiquement', md: `Exploiter un service de mélange au profit de fonds illicites peut relever du blanchiment (article 324-1 du code pénal) ; fournir des services sur actifs numériques sans enregistrement ou agrément est en outre réprimé par le code monétaire et financier.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Europol, communiqué du 15 mars 2023 sur le démantèlement de ChipMixer, tel que repris par eucrim (article du 7 avril 2023, page consultée : eucrim.eu/news/chipmixer-taken-down) et par la presse.
- Département de la Justice des États-Unis (bureau du procureur du district est de Pennsylvanie), communiqué du 15 mars 2023 sur l'inculpation de Minh Quốc Nguyễn, tel que rapporté par la presse (The Record, OCCRP, TechCrunch).
- IRS Criminal Investigation, communiqué du 3 août 2023 dans l'affaire Bitfinex citant ChipMixer (page consultée : irs.gov/node/125136).
- Descriptions publiques du fonctionnement du service (presse spécialisée, publications antérieures au démantèlement), utilisées uniquement pour le mécanisme des chips.`,
      },
    ],
    keyPoints: [
      `ChipMixer : mixeur de bitcoins non enregistré, actif de 2017 à mars 2023.`,
      `15 mars 2023 : Allemagne et États-Unis, appui d'Europol ; saisie de 4 serveurs, environ 1 909 BTC (environ 44 M€) et 7 To de données.`,
      `Le DOJ accuse Minh Quốc Nguyễn d'avoir exploité le service (blanchiment, transmission de fonds sans licence, usurpation d'identité) ; il est présumé innocent.`,
      `Les dépôts étaient convertis en « chips » de valeur équivalente, mélangées entre clients : le lien dépôt / retrait n'existait que dans les données du service.`,
      `Un mixeur custodial concentre fonds, données et responsabilités : sa saisie appréhende la caisse et la mémoire.`,
      `ChipMixer apparaît aussi dans l'affaire Bitfinex : documenter chaque dépôt vers un mixeur reste utile.`,
    ],
    quiz: [
      {
        q: `Qu'ont saisi les autorités lors du démantèlement de ChipMixer le 15 mars 2023 ?`,
        options: [
          `Quatre serveurs, environ 1 909 BTC et 7 To de données`,
          `Uniquement le nom de domaine`,
          `152 000 BTC`,
          `Les clés privées de tous les utilisateurs depuis 2017`,
        ],
        answer: 0,
        explain: `Europol a annoncé la saisie de quatre serveurs, d'environ 1 909,4 BTC (environ 44,2 M€) et de 7 To de données. Les 152 000 BTC correspondent au volume estimé blanchi, pas au montant saisi.`,
      },
      {
        kind: 'truefalse',
        q: `Minh Quốc Nguyễn a été condamné pour l'exploitation de ChipMixer.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Il a été inculpé ; à l'annonce, il n'était pas détenu. Aucune condamnation n'est établie par les sources consultées : il est présumé innocent.`,
      },
      {
        q: `Qu'est-ce qu'une « chip » dans le fonctionnement de ChipMixer ?`,
        options: [
          `Un composant matériel du serveur`,
          `Un stablecoin émis par le service`,
          `Un petit jeton de valeur équivalente, issu de la conversion des dépôts et mélangé avec ceux des autres clients`,
          `Une transaction CoinJoin`,
        ],
        answer: 2,
        explain: `Selon Europol et le DOJ, les dépôts étaient convertis en chips de valeur équivalente, puis mélangés entre clients.`,
      },
      {
        kind: 'multi',
        q: `Quelles différences distinguent un mixeur custodial d'un CoinJoin ? (plusieurs réponses)`,
        options: [
          `Le mixeur custodial détient les fonds pendant le mélange`,
          `Le CoinJoin nécessite de confier ses clés à un opérateur`,
          `Le mixeur custodial conserve une base de correspondances qui peut être saisie`,
          `Le CoinJoin laisse une transaction collective visible on-chain`,
        ],
        answer: [0, 2, 3],
        explain: `Dans un CoinJoin, chaque participant garde ses clés : c'est précisément ce qui le distingue d'un mixeur custodial.`,
      },
      {
        kind: 'truefalse',
        q: `Les communiqués officiels de l'affaire Bitfinex citent ChipMixer parmi les mixeurs utilisés pour blanchir une partie des fonds volés.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `Le communiqué de l'IRS-CI d'août 2023 cite Bitcoin Fog, Helix et ChipMixer.`,
      },
      {
        q: `Un utilisateur dépense trois chips dans une même transaction vers un exchange. Quel enseignement en tirer ?`,
        options: [
          `Aucun : les chips sont intraçables`,
          `Les trois chips appartiennent forcément à trois personnes différentes`,
          `La transaction est un CoinJoin`,
          `Par l'heuristique des entrées communes, les trois chips peuvent être rattachées à un même utilisateur, et l'exchange de destination peut être requis`,
        ],
        answer: 3,
        explain: `Regrouper des chips est une erreur post-mixage classique : elle recrée un lien entre elles et pointe vers un service où une réquisition est possible. L'indice reste à confirmer par d'autres éléments.`,
      },
      {
        kind: 'multi',
        q: `Selon le DOJ, quels types d'utilisateurs ont eu recours à ChipMixer ? (plusieurs réponses)`,
        options: [
          `La banque centrale européenne`,
          `Des groupes de rançongiciels`,
          `Des vendeurs de marchés du darknet`,
          `Le renseignement militaire russe (GRU)`,
        ],
        answer: [1, 2, 3],
        explain: `Le DOJ cite notamment des fonds liés à des rançongiciels, à des marchés du darknet et au GRU (achat d'infrastructures pour le logiciel malveillant Drovorub).`,
      },
    ],
    flashcards: [
      { front: 'ChipMixer', back: `Mixeur de bitcoins non enregistré (2017-2023), démantelé le 15 mars 2023.` },
      { front: 'Saisie ChipMixer', back: `4 serveurs, environ 1 909,4 BTC (environ 44,2 M€), 7 To de données.` },
      { front: 'Volume estimé (Europol)', back: `Environ 152 000 BTC blanchis (environ 2,73 Md€ selon les estimations communiquées).` },
      { front: 'Chips', back: `Jetons de valeur équivalente issus des dépôts, mélangés entre clients.` },
      { front: 'Minh Quốc Nguyễn', back: `Ressortissant vietnamien inculpé à Philadelphie comme opérateur présumé ; présumé innocent.` },
      { front: 'Mixeur custodial', back: `Détient fonds et clés pendant le mélange ; conserve la correspondance dépôt / retrait.` },
      { front: 'Partenaires de l’opération', back: `BKA et parquet de Francfort, autorités américaines, Europol ; Belgique, Pologne, Suisse.` },
      { front: 'ChipMixer et Bitfinex', back: `Cité parmi les mixeurs utilisés pour blanchir une partie des fonds du piratage de 2016.` },
      { front: 'Regroupement de chips', back: `Erreur post-mixage : relie les chips entre elles par les entrées communes.` },
      { front: 'Réflexe face à un mixeur démantelé', back: `Documenter les dépôts, puis solliciter l'exploitation des données saisies via Europol ou l'entraide.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GARANTEX
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-garantex',
    title: 'Affaire décryptée : Garantex, sanctions et démantèlement',
    level: 4,
    track: 'affaires',
    minutes: 35,
    summary: `Garantex, exchange opérant largement depuis la Russie, est sanctionné par le Trésor américain en avril 2022. Il continue pourtant de fonctionner pendant près de trois ans, jusqu'à l'opération internationale de mars 2025 : saisie des domaines, gel de fonds, inculpation de deux responsables présumés. Un successeur, Grinex, est sanctionné en août 2025. Ce que le dossier enseigne sur les exchanges non coopératifs et sur les leviers qui restent à l'enquêteur.`,
    objectives: [
      `Retracer l'histoire de Garantex : désignation de 2022, opération de mars 2025, sanctions d'août 2025.`,
      `Expliquer comment un exchange sanctionné continue d'opérer et comment il tente de masquer ses flux.`,
      `Identifier les leviers face à un exchange non coopératif : émetteurs de stablecoins, infrastructures, contreparties, sanctions.`,
      `Transposer ces leviers dans une enquête française impliquant un service sanctionné.`,
    ],
    prerequisites: ['exchanges', 'cadre-reglementaire', 'gel-stablecoins', 'tron-usdt', 'cooperation-internationale'],
    practice: ['tron-sanctions-garantex', 'ransomware-raas'],
    blocks: [
      {
        type: 'text',
        md: `**Garantex** était une plateforme d'échange de crypto-actifs lancée en **2019**, exploitée par une société enregistrée en Estonie (Garantex Europe OÜ) mais opérant largement depuis la **Russie**. Elle permettait notamment d'échanger des roubles contre des crypto-actifs, y compris en espèces dans des bureaux à Moscou et Saint-Pétersbourg, selon la presse.

Le **5 avril 2022**, le jour même du démantèlement d'Hydra, le Trésor américain (OFAC) la **sanctionne** : selon le Trésor, plus de **100 millions de dollars** de transactions de Garantex étaient associés à des acteurs illicites et à des marchés du darknet, dont près de **6 millions** liés au groupe de rançongiciel Conti.

Garantex continue pourtant d'opérer. En **mars 2025**, une opération internationale saisit ses noms de domaine et deux responsables présumés sont inculpés aux États-Unis. Selon l'acte d'accusation, la plateforme aurait traité au moins **96 milliards de dollars** de transactions depuis avril 2019.`,
      },
      { type: 'heading', text: 'Chronologie' },
      {
        type: 'table',
        caption: 'Garantex, de la sanction au successeur',
        headers: ['Date', 'Événement', 'Source'],
        rows: [
          ['2019', 'Lancement de la plateforme', 'DOJ, OFAC'],
          ['5 avril 2022', 'Désignation par l’OFAC, le même jour qu’Hydra', 'Trésor américain'],
          ['Début 2023', 'Selon l’acte d’accusation, refonte des opérations pour contourner les sanctions', 'DOJ, mars 2025'],
          ['6 mars 2025', 'Saisie de garantex.org, garantex.io et garantex.academy ; Garantex suspend ses services', 'Secret Service, DOJ, presse'],
          ['7 mars 2025', 'Inculpation d’Aleksej Besciokov et d’Aleksandr Mira Serda (district est de Virginie) ; plus de 26 M$ gelés', 'DOJ'],
          ['Mars 2025', 'Arrestation d’Aleksej Besciokov en Inde, dans le cadre d’une procédure d’extradition', 'Bureau central d’enquête indien (CBI), presse'],
          ['14 août 2025', 'Nouvelle désignation de Garantex et désignation de son successeur Grinex, de dirigeants et de sociétés liées', 'Trésor américain'],
        ],
      },
      { type: 'heading', text: 'Continuer malgré les sanctions' },
      {
        type: 'text',
        md: `Une sanction américaine n'éteint pas un service implanté dans un pays qui ne l'applique pas. Elle le prive en revanche de contreparties : les exchanges conformes filtrent les adresses désignées et refusent les fonds qui en proviennent.

Selon l'acte d'accusation de mars 2025, les responsables de Garantex auraient, à partir de début 2023, **réorganisé** les opérations pour contourner les sanctions et amener des entreprises américaines à traiter avec la plateforme **à leur insu**. Parmi les procédés décrits : la **rotation quotidienne** des portefeuilles opérationnels vers de nouvelles adresses, ce qui rendait inopérantes les listes statiques d'adresses utilisées par les services de conformité.`,
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: `Illustration simplifiée : dépôts clients, balayage vers un hot wallet, puis cold wallet. Si l'exchange change de hot wallet chaque jour, une liste d'adresses figée devient vite obsolète ; il faut raisonner en cluster et en comportement.`,
      },
      {
        type: 'check',
        q: `Pourquoi la rotation quotidienne des portefeuilles opérationnels gênait-elle les exchanges conformes ?`,
        options: [
          `Parce qu'elle rendait les transactions invisibles sur la blockchain`,
          `Parce qu'elle convertissait automatiquement les fonds en Monero`,
          `Parce que leurs listes d'adresses désignées devenaient obsolètes : les nouvelles adresses n'y figuraient pas`,
          `Parce qu'elle annulait les sanctions`,
        ],
        answer: 2,
        explain: `Les transactions restent visibles. Mais un filtrage par liste d'adresses ne détecte que les adresses connues ; il faut un clustering à jour pour rattacher les nouvelles adresses à Garantex.`,
      },
      { type: 'heading', text: 'L’opération de mars 2025' },
      {
        type: 'steps',
        items: [
          { title: 'Les domaines', md: `Le Secret Service américain, avec des partenaires européens, exécute un mandat de saisie visant garantex.org, garantex.io et garantex.academy. Les sites affichent une bannière de saisie.` },
          { title: 'Les serveurs', md: `Selon le DOJ, les services allemands et finlandais saisissent des serveurs hébergeant les opérations de Garantex.` },
          { title: 'Les fonds', md: `Plus de 26 millions de dollars sont gelés. La presse rapporte que l'émetteur Tether a bloqué des portefeuilles USDT de Garantex, pour un montant de cet ordre ; la plateforme annonce le 6 mars suspendre tous ses services, y compris les retraits.` },
          { title: 'Les personnes', md: `L'acte d'accusation vise **Aleksej Besciokov**, présenté comme l'administrateur technique principal, et **Aleksandr Mira Serda**, présenté comme cofondateur et directeur commercial, pour association de blanchiment ; M. Besciokov est en outre poursuivi pour violation des sanctions et exploitation d'une activité de transmission de fonds sans licence. Arrêté en Inde quelques jours plus tard, il fait l'objet d'une procédure d'extradition. Les deux hommes sont présumés innocents ; à la date des informations consultées, aucune décision sur le fond n'est connue.` },
        ],
      },
      {
        type: 'flow',
        caption: `Schéma simplifié des flux autour de Garantex, établi d'après les communiqués de l'OFAC (2022, 2025) et du DOJ (2025). Pas de montants : illustration de la structure.`,
        nodes: [
          { id: 'rub', label: 'Clients en roubles', kind: 'victim', sub: 'espèces, banques russes' },
          { id: 'crim', label: 'Acteurs illicites', kind: 'suspect', sub: 'rançongiciels, darknet' },
          { id: 'gx', label: 'Garantex', kind: 'exchange', sub: 'comptes internes' },
          { id: 'hot', label: 'Hot wallets USDT', kind: 'hot', sub: 'rotation quotidienne' },
          { id: 'cp', label: 'Plateformes étrangères', kind: 'exchange', sub: 'contreparties à leur insu' },
          { id: 'teth', label: 'Émetteur USDT', kind: 'service', sub: 'blocage des adresses' },
          { id: 'gr', label: 'Grinex', kind: 'exchange', sub: 'successeur désigné' },
          { id: 'a7', label: 'Jeton A7A5', kind: 'contract', sub: 'adossé au rouble' },
        ],
        edges: [
          { from: 'rub', to: 'gx' },
          { from: 'crim', to: 'gx', label: 'dépôts' },
          { from: 'gx', to: 'hot' },
          { from: 'hot', to: 'cp', label: 'flux masqués' },
          { from: 'teth', to: 'hot', label: 'gel (mars 2025)', dashed: true },
          { from: 'gx', to: 'gr', label: 'migration', dashed: true },
          { from: 'gr', to: 'a7', label: 'restitution aux clients' },
        ],
      },
      { type: 'heading', text: 'Le successeur : Grinex et le jeton A7A5' },
      {
        type: 'text',
        md: `Le **14 août 2025**, l'OFAC désigne à nouveau Garantex Europe OÜ et désigne **Grinex**, présentée comme une plateforme créée par des employés de Garantex pour soutenir ses efforts de contournement des sanctions. Selon des responsables américains, l'inculpation de mars 2025 avait conduit Garantex à transférer clientèle et fonds vers Grinex.

Le Trésor indique aussi que Grinex a utilisé le **jeton A7A5**, adossé au rouble et émis par une société kirghize, pour permettre aux clients ayant perdu leurs fonds lors de l'opération de mars 2025 de retrouver l'accès à leurs comptes. La même décision vise trois dirigeants de Garantex et six sociétés liées, en Russie et au Kirghizistan. L'Union européenne a également inscrit Garantex sur sa liste de sanctions.`,
      },
      {
        type: 'case',
        title: 'Le moment pivot : le levier de l’émetteur de stablecoin',
        md: `Pendant trois ans, Garantex a résisté à une sanction américaine parce qu'il opérait hors de portée directe des autorités américaines. L'opération de mars 2025 a combiné des leviers que l'exchange ne contrôlait pas :

1. **L'émetteur du stablecoin.** Une grande partie des flux de ce type de plateforme transite en USDT, notamment sur Tron. L'émetteur peut **bloquer** des adresses : les fonds deviennent inutilisables, même sans saisie des clés.
2. **L'infrastructure.** Des serveurs hébergés dans des pays coopératifs (Allemagne, Finlande) et des noms de domaine saisissables.
3. **Les personnes.** Un responsable présumé arrêté lors d'un déplacement dans un pays disposant d'une procédure d'extradition.
4. **Les contreparties.** Les exchanges conformes, une fois les nouvelles adresses rattachées au cluster, coupent les flux.

Limite majeure : la réapparition rapide d'un **successeur**. Les sanctions d'août 2025 montrent que la réponse doit suivre les **personnes** et les **flux**, pas seulement une marque.`,
      },
      {
        type: 'check',
        q: `Face à un exchange qui ne répond à aucune réquisition, quel levier est le plus susceptible d'immobiliser rapidement des USDT qu'il détient ?`,
        options: [
          `Une réquisition adressée à l'exchange lui-même, en russe`,
          `Une demande de blocage adressée à l'émetteur du stablecoin, documentée par l'analyse des adresses`,
          `Une demande aux validateurs de Tron d'annuler les transactions`,
          `Une plainte auprès du registre des noms de domaine`,
        ],
        answer: 1,
        explain: `L'émetteur d'un stablecoin centralisé peut bloquer des adresses sur sa liste noire. C'est le levier qui a joué en mars 2025, indépendamment de la coopération de l'exchange.`,
      },
      { type: 'heading', text: 'Erreurs et faiblesses du dispositif' },
      {
        type: 'table',
        caption: 'Ce qui a exposé Garantex (accusations et constats publics)',
        headers: ['Faiblesse', 'Conséquence'],
        rows: [
          ['Dépendance à un stablecoin émis par une société centralisée', 'Blocage des portefeuilles USDT et suspension des services'],
          ['Serveurs hébergés en Allemagne et en Finlande', 'Saisie de l’infrastructure'],
          ['Noms de domaine saisissables', 'Mise hors ligne des sites'],
          ['Déplacement d’un responsable présumé dans un pays coopératif', 'Arrestation en Inde et procédure d’extradition'],
          ['Successeur créé par les mêmes personnes', 'Désignation rapide de Grinex et des dirigeants'],
          ['Flux massifs vers des plateformes étrangères', 'Rattachement progressif des nouvelles adresses par les outils de clustering'],
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Exchange coopératif',
          md: `- Répond aux réquisitions : identité, journaux de connexion, adresses de dépôt.
- Gèle sur demande des comptes identifiés.
- Applique les sanctions et filtre les adresses à risque.
- Le levier principal est la **réquisition**.`,
        },
        right: {
          title: 'Exchange non coopératif',
          md: `- Ignore les réquisitions ; implanté hors de portée.
- Les leviers sont **indirects** : émetteurs de stablecoins, hébergeurs, registres de domaines, contreparties conformes.
- Les **sanctions** coupent les contreparties légales.
- Les **personnes** restent la cible ultime, au gré de leurs déplacements.`,
        },
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Vérifier le statut de sanction', md: `Consultez les listes de l'Union européenne, le registre national des gels et la liste de l'OFAC. Une contrepartie désignée change la portée juridique des faits et peut ouvrir des qualifications liées au contournement des mesures restrictives.` },
          { title: 'Mobiliser l’émetteur du stablecoin', md: `Si des USDT ou USDC transitent par le service, adressez une demande de blocage motivée et documentée à l'émetteur, en parallèle de la procédure.` },
          { title: 'Raisonner en cluster, pas en liste', md: `Face à la rotation d'adresses, appuyez-vous sur le comportement (balayages, montants, horaires) et sur des outils à jour, en citant la date et la source de l'attribution.` },
          { title: 'Suivre les personnes et les successeurs', md: `Une nouvelle marque créée par les mêmes équipes reste rattachable : signalez-la aux structures spécialisées et dans vos échanges de coopération.` },
          { title: 'Signaler aux prestataires français', md: `Un prestataire de services sur actifs numériques établi en France doit appliquer les mesures de gel : l'informer d'une exposition à un service sanctionné peut conduire à un gel immédiat des fonds concernés.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Trésor américain (OFAC), communiqué du 5 avril 2022 désignant Hydra et Garantex.
- Département de la Justice des États-Unis, communiqué du 7 mars 2025 « Garantex Cryptocurrency Exchange Disrupted in International Operation » et acte d'accusation (district est de Virginie).
- Secret Service des États-Unis, communiqué de mars 2025 sur la saisie des sites de Garantex.
- Bureau central d'enquête indien (CBI), déclaration du 12 mars 2025 sur l'arrestation d'Aleksej Besciokov, telle que rapportée par la presse (TechCrunch, The Block).
- Trésor américain (OFAC), communiqué du 14 août 2025 sur la nouvelle désignation de Garantex et la désignation de Grinex.
- Presse (Cointelegraph, The Record, OCCRP) sur le blocage des USDT et les sanctions européennes.`,
      },
    ],
    keyPoints: [
      `Garantex : exchange lancé en 2019, opérant largement depuis la Russie, sanctionné par l'OFAC le 5 avril 2022.`,
      `Selon l'acte d'accusation, au moins 96 Md$ de transactions depuis 2019 et une rotation quotidienne des portefeuilles pour contourner les sanctions.`,
      `Mars 2025 : saisie des domaines et de serveurs, plus de 26 M$ gelés, inculpation de deux responsables présumés (présumés innocents).`,
      `Août 2025 : l'OFAC désigne le successeur Grinex, des dirigeants et des sociétés liées ; le jeton A7A5 a servi à restituer l'accès aux clients.`,
      `Face à un exchange non coopératif, les leviers sont indirects : émetteurs de stablecoins, infrastructures, contreparties, personnes.`,
      `Raisonner en cluster et en comportement, et suivre les successeurs créés par les mêmes équipes.`,
    ],
    quiz: [
      {
        q: `Quand Garantex a-t-il été désigné pour la première fois par l'OFAC ?`,
        options: [`Mars 2025`, `Août 2025`, `Janvier 2019`, `5 avril 2022`],
        answer: 3,
        explain: `Garantex a été désigné le 5 avril 2022, le même jour qu'Hydra.`,
      },
      {
        kind: 'truefalse',
        q: `Selon le DOJ, Garantex aurait traité au moins 96 milliards de dollars de transactions depuis avril 2019.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `C'est le chiffre avancé par le DOJ et l'acte d'accusation de mars 2025. Il s'agit d'une allégation, les prévenus étant présumés innocents.`,
      },
      {
        kind: 'multi',
        q: `Quelles mesures ont été prises lors de l'opération de mars 2025 ? (plusieurs réponses)`,
        options: [
          `La saisie de trois noms de domaine de Garantex`,
          `La saisie de serveurs par des services allemands et finlandais`,
          `L'annulation par Tron de toutes les transactions de Garantex depuis 2019`,
          `Le gel de plus de 26 millions de dollars`,
        ],
        answer: [0, 1, 3],
        explain: `Domaines, serveurs et gel de fonds ont été annoncés. Aucune blockchain n'annule des transactions confirmées.`,
      },
      {
        q: `Qu'est-ce que Grinex selon le Trésor américain ?`,
        options: [
          `Un mixeur de bitcoins`,
          `Un émetteur de stablecoin américain`,
          `Une plateforme créée par des employés de Garantex pour soutenir le contournement des sanctions`,
          `Une unité d'enquête européenne`,
        ],
        answer: 2,
        explain: `L'OFAC a désigné Grinex le 14 août 2025 comme successeur de Garantex.`,
      },
      {
        kind: 'truefalse',
        q: `Aleksej Besciokov et Aleksandr Mira Serda ont été reconnus coupables par un tribunal américain.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Ils ont été inculpés ; M. Besciokov a été arrêté en Inde dans le cadre d'une procédure d'extradition. Aucune décision sur le fond n'est établie par les sources consultées : ils sont présumés innocents.`,
      },
      {
        q: `Pourquoi l'émetteur d'un stablecoin est-il un levier décisif face à un exchange non coopératif ?`,
        options: [
          `Parce qu'il peut bloquer les adresses concernées, rendant les jetons inutilisables sans l'accord de l'exchange`,
          `Parce qu'il détient les clés privées de tous les utilisateurs`,
          `Parce qu'il peut fermer la blockchain Tron`,
          `Parce qu'il est l'actionnaire de l'exchange`,
        ],
        answer: 0,
        explain: `Un stablecoin centralisé comporte une fonction de liste noire. Le blocage ne nécessite ni les clés ni la coopération de l'exchange.`,
      },
      {
        kind: 'multi',
        q: `Quels réflexes adopter dans une enquête française impliquant un service sanctionné ? (plusieurs réponses)`,
        options: [
          `Ouvrir un compte sur le service sanctionné pour y déposer des fonds de test`,
          `Vérifier les listes de sanctions européennes, nationales et américaines`,
          `Raisonner en cluster et en comportement plutôt qu'en liste d'adresses figée`,
          `Adresser une demande de blocage documentée à l'émetteur du stablecoin`,
        ],
        answer: [1, 2, 3],
        explain: `Déposer des fonds sur un service sanctionné serait juridiquement risqué et inutile. Les trois autres réflexes sont au cœur de la méthode.`,
      },
    ],
    flashcards: [
      { front: 'Garantex', back: `Exchange lancé en 2019 (Garantex Europe OÜ, Estonie), opérant largement depuis la Russie.` },
      { front: 'Sanction de 2022', back: `OFAC, 5 avril 2022, le même jour qu'Hydra ; plus de 100 M$ de transactions liées à des acteurs illicites.` },
      { front: '96 milliards', back: `Volume minimal de transactions depuis avril 2019 selon le DOJ (allégation).` },
      { front: 'Rotation des portefeuilles', back: `Selon l'acte d'accusation, changement quotidien d'adresses pour échapper au filtrage des exchanges conformes.` },
      { front: 'Mars 2025', back: `Saisie de garantex.org, .io et .academy, saisie de serveurs, plus de 26 M$ gelés, deux inculpations.` },
      { front: 'Aleksej Besciokov', back: `Présenté comme administrateur technique ; arrêté en Inde en mars 2025 ; présumé innocent.` },
      { front: 'Aleksandr Mira Serda', back: `Présenté comme cofondateur et directeur commercial ; inculpé ; présumé innocent.` },
      { front: 'Grinex', back: `Successeur de Garantex désigné par l'OFAC le 14 août 2025.` },
      { front: 'A7A5', back: `Jeton adossé au rouble, utilisé selon le Trésor pour restituer l'accès aux clients de Garantex.` },
      { front: 'Exchange non coopératif', back: `Leviers indirects : émetteur de stablecoin, hébergeurs, domaines, contreparties conformes, personnes.` },
    ],
  },
]
