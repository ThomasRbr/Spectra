// Niveau 3 — Procédure : gel et saisie des crypto-actifs, rapport d'analyse blockchain.
// Les références juridiques doivent toujours être vérifiées dans les textes en vigueur.
import type { Lesson } from '../model'

export const L3_PROCEDURE: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // GEL ET SAISIE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'gel-saisie',
    title: 'Gel et saisie des crypto-actifs',
    level: 3,
    track: 'enquete',
    minutes: 35,
    summary: `Distinguer gel par un prestataire, gel par un émetteur de stablecoin, saisie pénale et confiscation. Cadre des saisies spéciales et rôle de l'AGRASC, saisie d'avoirs chez un prestataire, conduite technique d'une saisie sur un portefeuille auto-hébergé (portefeuille de saisie institutionnel, double contrôle, transaction test, gaz), perquisition et chaîne de preuve.`,
    objectives: [
      `Distinguer gel (prestataire, émetteur), opposition, saisie pénale et confiscation, et enchaîner ces mesures sans perte de temps.`,
      `Situer le cadre des saisies spéciales (articles 706-141 et suivants du CPP) et le rôle de l'AGRASC.`,
      `Conduire techniquement une saisie sur un portefeuille auto-hébergé, en sécurité et de façon documentée.`,
      `Savoir quoi chercher en perquisition et comment préserver les supports.`,
      `Garantir la traçabilité des fonds saisis jusqu'à la décision de justice.`,
    ],
    prerequisites: ['requisitions', 'exchanges', 'stablecoins', 'cles-portefeuilles', 'opsec-enqueteur'],
    practice: ['pig-butchering-tron', 'address-poisoning'],
    blocks: [
      {
        type: 'text',
        md: `Identifier les fonds ne suffit pas : dans une affaire crypto, la course contre la montre se joue entre votre demande et le prochain mouvement du suspect. Un transfert prend quelques secondes ; une procédure mal enchaînée peut prendre des jours.

Cette leçon vous donne la **chaîne complète** : bloquer vite (gel), sécuriser juridiquement (saisie), conserver proprement (portefeuille institutionnel, AGRASC) et prouver chaque étape (traçabilité, scellés). Les textes et les pratiques évoluent : chaque opération se prépare **avec le magistrat** et avec l'appui des structures spécialisées.`,
      },
      { type: 'heading', text: 'Gel, saisie, confiscation : ne pas confondre' },
      {
        type: 'table',
        caption: 'Les mesures et leur portée (à vérifier dans les textes en vigueur)',
        headers: ['Mesure', 'Qui la prend', 'Nature', 'Rapidité', 'Ce qu’il faut faire ensuite'],
        rows: [
          ['Gel par un prestataire', 'L’exchange, à la demande des enquêteurs', 'Mesure du prestataire (conditions générales, obligations anti-blanchiment)', 'Heures à jours', 'La relayer par une saisie pénale : elle peut être levée'],
          ['Gel par un émetteur de stablecoin', 'L’émetteur (liste noire du contrat)', 'Mesure de l’émetteur, efficace même en auto-hébergement', 'Heures', 'Saisie judiciaire, puis éventuelle réémission vers une adresse de l’autorité'],
          ['Opposition de TRACFIN', 'La cellule de renseignement financier', 'Report temporaire d’une opération signalée (code monétaire et financier)', 'Immédiate, durée limitée', 'Relais judiciaire dans le délai légal'],
          ['Saisie pénale', 'Magistrat (ou OPJ selon le régime)', 'Place le bien sous main de justice', 'Selon la procédure', 'Conservation, gestion par l’AGRASC le cas échéant'],
          ['Confiscation', 'Juridiction de jugement', 'Peine : transfert de propriété à l’État', 'Au jugement', 'Exécution, droits des victimes'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Le bon réflexe',
        md: `Obtenir un **gel immédiat** pour empêcher la dissipation, puis le **convertir rapidement** en saisie pénale avec le parquet ou le juge d'instruction. Préparez la requête de saisie **en même temps** que la demande de gel : les deux partent le même jour.`,
      },
      { type: 'heading', text: 'Le gel par un émetteur de stablecoin' },
      {
        type: 'text',
        md: `Les principaux stablecoins centralisés (USDT, USDC) disposent dans leur contrat de fonctions de **liste noire** (par exemple \`addBlackList\` pour l'USDT sur Ethereum) : une adresse inscrite ne peut plus transférer ses jetons. C'est l'outil le plus rapide et le plus efficace de l'enquêteur, car il fonctionne **même sur un portefeuille auto-hébergé**, sans exchange.

Ce qu'il faut savoir :

- la demande passe par le **portail forces de l'ordre** de l'émetteur, avec les adresses complètes, la chaîne (Ethereum, Tron…), les montants, le contexte et une demande motivée ;
- le gel ne porte que sur **ce jeton** : les TRX, ETH ou autres jetons de l'adresse restent libres ;
- il reste une **mesure de l'émetteur** : il faut la prolonger par une décision judiciaire ;
- sur demande judiciaire, l'émetteur peut **détruire** les jetons gelés et en **réémettre** l'équivalent vers une adresse désignée par l'autorité. Les modalités se définissent avec le magistrat et l'émetteur.`,
      },
      {
        type: 'flow',
        caption: `Du gel à la récupération : les jetons gelés sont détruits puis réémis vers une adresse contrôlée par l'autorité, sur décision judiciaire.`,
        nodes: [
          { id: 's', label: 'Collecteur du suspect', kind: 'suspect', sub: '74 300 USDT-TRC20' },
          { id: 'iss', label: 'Tether', kind: 'service', sub: 'liste noire' },
          { id: 'mag', label: 'Décision judiciaire', kind: 'tx', sub: 'saisie' },
          { id: 'st', label: 'Portefeuille de l’autorité', kind: 'wallet', sub: 'adresse institutionnelle' },
        ],
        edges: [
          { from: 'iss', to: 's', label: 'gel (adresse inscrite)' },
          { from: 'mag', to: 'iss', label: 'demande de destruction / réémission' },
          { from: 'iss', to: 'st', label: '74 300 USDT réémis' },
        ],
      },
      {
        type: 'check',
        q: `Une adresse Tron du suspect détient 74 300 USDT et 2 100 TRX. L'émetteur de l'USDT gèle l'adresse. Qu'en est-il des TRX ?`,
        options: [
          `Ils sont gelés aussi`,
          `Ils restent librement transférables : le gel ne porte que sur le jeton de l'émetteur`,
          `Ils sont automatiquement transférés à l'État`,
          `Ils sont détruits`,
        ],
        answer: 1,
        explain: `L'émetteur ne contrôle que son propre jeton. Les autres actifs de l'adresse nécessitent une autre mesure (saisie technique si la clé est accessible, gel au prochain service).`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: "S'entraîner à la course au gel : le mode temps réel",
        md: "Au lancement d'une mission, choisissez le déroulement **Temps réel**. L'horloge démarre juste après le premier mouvement des fonds, et les transactions postérieures restent invisibles : historique, traçage, clusters, corrélation. Placez les adresses qui détiennent encore des fonds sous **surveillance** (bouton *Surveiller* de l'inspecteur), puis avancez l'horloge depuis la barre supérieure. Chaque mouvement d'une adresse surveillée déclenche une alerte, listée dans l'onglet *Veille* du dossier. Les fonds « encore détenus » du traçage sont alors ceux que l'on peut encore faire geler.",
      },
      { type: 'heading', text: 'Le cadre juridique de la saisie' },
      {
        type: 'text',
        md: `Les crypto-actifs sont des biens **meubles incorporels** (le code monétaire et financier définit les « actifs numériques », et le règlement européen MiCA encadre les prestataires). Ils sont saisissables, et confiscables dans les conditions de l'article 131-21 du code pénal. Plusieurs voies existent selon la situation :

- **Saisie lors d'une perquisition** : supports (portefeuilles matériels, phrases de récupération), puis transfert des fonds vers un portefeuille contrôlé par l'autorité, dans le respect des règles de la perquisition et des instructions du magistrat.
- **Saisies spéciales** (articles **706-141 et suivants** du CPP), destinées à garantir l'exécution d'une éventuelle peine de confiscation. Pour un bien ou un droit **incorporel**, l'article 706-153 prévoit une autorisation par ordonnance motivée du **juge des libertés et de la détention** sur requête du procureur au cours de l'enquête, ou une décision du **juge d'instruction** au cours de l'information. C'est typiquement la voie pour des avoirs détenus chez un prestataire (créance du client sur l'exchange).
- **Saisie en valeur** et saisie de patrimoine, selon les infractions et les conditions prévues par les textes.

L'**AGRASC** (Agence de gestion et de recouvrement des avoirs saisis et confisqués, créée en 2010) assiste les juridictions, gère les biens saisis qui lui sont confiés et peut, sur décision d'un magistrat, procéder à leur **vente avant jugement** lorsque leur conservation n'est plus nécessaire et qu'ils risquent de se déprécier (articles 41-5 et 99-2 du CPP, à vérifier dans leur rédaction en vigueur). Pour des actifs aussi volatils que les crypto-actifs, c'est un argument central. Les sommes issues de la vente sont consignées et suivent le sort de la procédure.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Vérifier avant d’agir',
        md: `Les fondements exacts, les autorités compétentes, les formes (ordonnance, requête, notification, délais et voies de recours) et le régime applicable aux avoirs détenus chez un prestataire étranger doivent être vérifiés dans les textes en vigueur (Légifrance) et définis **avec le magistrat** avant l'opération. Les pratiques (portefeuilles de l'État, transfert à l'AGRASC, ventes) évoluent : suivez les instructions et notes de votre chaîne et des structures spécialisées. Les groupes interministériels de recherches (GIR) et les référents avoirs criminels peuvent appuyer l'identification patrimoniale.`,
      },
      { type: 'heading', text: 'Saisir des avoirs chez un prestataire' },
      {
        type: 'steps',
        items: [
          { title: 'Identifier le compte', md: `Adresse de dépôt attribuée à l'exchange, dépôt horodaté (txid). C'est l'adresse de **dépôt** qui désigne le client, pas le hot wallet.` },
          { title: 'Demander le gel', md: `Demande motivée au prestataire (portail ou contact conformité), avec txid, adresse de dépôt, montants, et l'annonce d'une saisie à venir.` },
          { title: 'Réquisition', md: `Identité du titulaire, soldes par actif, historique, connexions. Les soldes conditionnent l'étendue de la saisie.` },
          { title: 'Requête de saisie', md: `Avec le parquet (ou le juge d'instruction) : requête puis ordonnance selon le régime applicable, visant les avoirs inscrits au compte.` },
          { title: 'Notification et exécution', md: `Notification au prestataire, qui transfère les actifs vers l'adresse institutionnelle désignée, ou les conserve bloqués selon les modalités fixées.` },
          { title: 'Constater et documenter', md: `Vérification on-chain de chaque transfert reçu (txid, montant, heure UTC), procès-verbal, information de l'AGRASC selon les instructions.` },
          { title: 'Prestataire étranger', md: `Selon le pays : coopération volontaire, décision d'enquête européenne ou demande d'entraide. Le gel volontaire achète du temps ; ne le laissez pas expirer.` },
        ],
      },
      { type: 'widget', id: 'exchange-flow', caption: `Dépôt client, balayage, hot wallet, cold wallet : c'est l'adresse de dépôt qui désigne le compte à geler et à saisir.` },
      { type: 'heading', text: 'Saisir sur un portefeuille auto-hébergé' },
      {
        type: 'steps',
        items: [
          { title: 'Préparer en amont', md: `Liste des chaînes et actifs attendus, adresses institutionnelles de réception vérifiées, gaz disponible (ETH, TRX, BNB…), matériel dédié, rôles répartis, magistrat informé.` },
          { title: 'Sécuriser l’accès', md: `Prendre le contrôle des supports (portefeuille matériel, téléphone, papier) dès l'interpellation. Des complices peuvent détenir une copie de la seed : chaque minute compte.` },
          { title: 'Inventorier', md: `Restaurer ou consulter le portefeuille sur un matériel dédié : toutes les chaînes, tous les comptes et chemins de dérivation, et l'existence éventuelle d'une **phrase de passe** supplémentaire.` },
          { title: 'Double contrôle', md: `Deux enquêteurs au minimum. L'adresse de destination est lue et comparée **en entier** par les deux, à partir de la source officielle.` },
          { title: 'Transaction test', md: `Envoi d'un faible montant, vérification sur un explorateur que l'adresse institutionnelle l'a bien reçu.` },
          { title: 'Transfert du solde', md: `Actif par actif, chaîne par chaîne. Pour les jetons, approvisionner d'abord l'adresse en gaz depuis un portefeuille de service, et le documenter.` },
          { title: 'Constater', md: `Heure UTC, adresses complètes, txid, montants, frais, cours de référence, identité des enquêteurs, matériel utilisé. Vidéo si possible.` },
          { title: 'Placer sous scellés', md: `Supports saisis et éléments secrets du portefeuille de saisie, selon la procédure prévue. Jamais de photo avec un téléphone personnel.` },
        ],
      },
      {
        type: 'table',
        caption: 'Check-list matérielle d’une saisie',
        headers: ['Élément', 'Pourquoi', 'Vérifié'],
        rows: [
          ['Portefeuille de saisie institutionnel (matériel neuf ou dédié, idéalement multisignature)', 'Contrôle par l’autorité, jamais par une personne', '☐'],
          ['Adresses de réception par chaîne, issues d’une source officielle', 'Éviter toute erreur ou substitution', '☐'],
          ['Gaz disponible sur un portefeuille de service (ETH, TRX, BNB…)', 'Pouvoir déplacer des jetons', '☐'],
          ['Ordinateur dédié, hors ligne si possible', 'Ne pas exposer la seed saisie', '☐'],
          ['Sacs de Faraday', 'Isoler les téléphones (effacement à distance)', '☐'],
          ['Caméra et trame de procès-verbal', 'Documenter chaque étape', '☐'],
          ['Contacts : magistrat, structures spécialisées, émetteurs, exchanges', 'Décisions et gels immédiats', '☐'],
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Interdits absolus',
        md: `Jamais de portefeuille personnel, jamais de compte d'exchange personnel, jamais de portefeuille « de fortune » installé sur un téléphone de service non dédié. Un fonds saisi qui transite par un moyen personnel, même quelques minutes, compromet la procédure et expose l'enquêteur.`,
      },
      {
        type: 'case',
        title: 'Cas pratique — interpellation et saisie',
        md: `Lors d'une perquisition, les enquêteurs découvrent un portefeuille matériel et, dans un carnet, une phrase de 24 mots. Le suspect communique le code PIN. Sur un ordinateur dédié, l'inventaire montre :

- Bitcoin : 0,412 BTC ;
- Ethereum : 0,08 ETH et 21 500 USDC ;
- Tron : 18 000 USDT-TRC20 et **aucun TRX**.

Une mention « + » griffonnée sous la seed fait soupçonner une **phrase de passe** : avec le mot inscrit au dos du carnet, un second portefeuille apparaît, avec 1,93 BTC.

Déroulé : transaction test puis transfert des BTC vers l'adresse institutionnelle ; transfert de l'USDC (gaz suffisant) ; approvisionnement de l'adresse Tron en TRX depuis le portefeuille de service (documenté) avant le transfert de l'USDT. En parallèle, demande de gel à l'émetteur de l'USDT sur l'adresse Tron, au cas où un complice tenterait de la vider avant la fin de l'opération. Durée totale : 1 h 40, intégralement filmée.`,
      },
      { type: 'heading', text: 'En perquisition : quoi chercher' },
      {
        type: 'table',
        caption: 'Supports et indices',
        headers: ['Catégorie', 'Exemples', 'Précaution'],
        rows: [
          ['Portefeuilles matériels', 'Clés de type USB, cartes, appareils dissimulés', 'Ne pas tenter de code au hasard (effacement après plusieurs erreurs)'],
          ['Phrases de récupération', 'Papier, plaques métalliques, carnets, photos dans la galerie, notes, gestionnaires de mots de passe', 'Photographier sous scellés, jamais avec un appareil personnel'],
          ['Applications', 'Portefeuilles mobiles, extensions de navigateur, applications d’exchanges et de double authentification', 'Isoler les téléphones (mode avion, sac de Faraday)'],
          ['Fichiers', '`wallet.dat` (Bitcoin Core), fichiers `.keys` (Monero), notes de dépôt de pools', 'Copie forensique par les spécialistes'],
          ['Documents', 'Factures de matériel, relevés bancaires mentionnant des achats, contrats d’hébergement de minage', 'Utiles pour l’enquête patrimoniale'],
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Codes et clés',
        md: `Le refus de remettre une convention secrète de déchiffrement est réprimé par l'article 434-15-2 du code pénal, et la Cour de cassation (assemblée plénière, 7 novembre 2022) a jugé que le code de déverrouillage d'un téléphone peut constituer une telle convention, sous conditions. L'application de ces règles à un code de portefeuille ou à une phrase de récupération doit être appréciée avec le parquet : la jurisprudence évolue.`,
      },
      { type: 'heading', text: 'Chaîne de preuve et restitution' },
      {
        type: 'text',
        md: `- **Traçabilité** : chaque mouvement des fonds saisis (du portefeuille du mis en cause vers le portefeuille de saisie, puis vers l'AGRASC ou un portefeuille de l'État) est un txid documenté. Le registre public permet d'en apporter la preuve à tout moment, à quiconque.
- **Scellés** : supports matériels, seeds et documents placés sous scellés avec description précise ; tout accès ultérieur est tracé.
- **Valorisation** : montants en unités natives **et** contre-valeur en euros à la date de la saisie, avec la source du cours.
- **Victimes** : restitution ou indemnisation passent par les décisions judiciaires. Tenez un tableau reliant fonds saisis et préjudices identifiés : il servira au magistrat.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Préparez la saisie **avant** l'interpellation : un tableau par chaîne (actifs attendus, adresses institutionnelles, gaz nécessaire), les demandes de gel pré-rédigées pour les émetteurs et exchanges identifiés, et un binôme désigné. Le jour J, il ne reste qu'à exécuter et documenter.`,
      },
      {
        type: 'check',
        q: `Pourquoi effectuer une transaction test avant le transfert complet ?`,
        options: [
          `Pour payer moins de frais`,
          `Parce que c'est techniquement obligatoire sur Bitcoin`,
          `Pour vérifier que l'adresse de destination est correcte et contrôlée avant d'engager la totalité des fonds`,
          `Pour prévenir le suspect`,
        ],
        answer: 2,
        explain: `Une erreur d'adresse est irréversible. Le test, vérifié sur un explorateur, limite le risque à un montant négligeable.`,
      },
    ],
    keyPoints: [
      `Gel (prestataire ou émetteur) = mesure rapide mais précaire ; saisie pénale = mesure judiciaire ; confiscation = peine.`,
      `Le gel par l'émetteur d'un stablecoin fonctionne même en auto-hébergement, mais ne porte que sur son jeton.`,
      `Saisies spéciales (art. 706-141 et s. CPP), notamment pour les biens incorporels comme les avoirs chez un prestataire : à vérifier et préparer avec le magistrat.`,
      `L'AGRASC gère les avoirs saisis et peut, sur décision d'un magistrat, les vendre avant jugement (actifs volatils).`,
      `Jamais de portefeuille personnel : portefeuille de saisie institutionnel, double contrôle, transaction test.`,
      `Prévoir le gaz pour les jetons ; inventorier toutes les chaînes, comptes, chemins et phrases de passe.`,
      `Documenter chaque étape (UTC, adresses complètes, txid, montants, cours) et placer les secrets sous scellés.`,
    ],
    quiz: [
      {
        q: `Un exchange a bloqué le compte du suspect à votre demande. Est-ce suffisant ?`,
        options: [
          `Oui, le blocage est définitif`,
          `Oui, si le montant est faible`,
          `Non : il faut demander à TRACFIN de confisquer`,
          `Non : c'est une mesure précaire qu'il faut relayer par une saisie pénale avec le magistrat`,
        ],
        answer: 3,
        explain: `Le gel volontaire peut être levé ; la saisie pénale place les avoirs sous main de justice.`,
      },
      {
        q: `Vous devez transférer 18 000 USDT-TRC20 d'un portefeuille saisi qui ne contient aucun TRX. Que faire ?`,
        options: [
          `Payer les frais avec votre portefeuille personnel`,
          `Approvisionner l'adresse en TRX depuis un portefeuille de service, en le documentant`,
          `Abandonner la saisie`,
          `Transférer les USDT sans frais`,
        ],
        answer: 1,
        explain: `Un transfert TRC-20 consomme des ressources payées en TRX ; l'approvisionnement se fait par un moyen institutionnel et se documente.`,
      },
      {
        kind: 'multi',
        q: `Après restauration d'une seed saisie, aucun fonds n'apparaît sur Bitcoin. Que vérifier ? (plusieurs réponses)`,
        options: [
          `Les autres chaînes (Ethereum, Tron, BNB Chain…)`,
          `Les autres comptes et chemins de dérivation`,
          `L'existence d'une phrase de passe supplémentaire`,
          `Le destination tag de la seed`,
        ],
        answer: [0, 1, 2],
        explain: `Une seed peut contrôler des fonds sur de nombreuses chaînes, plusieurs comptes, et des portefeuilles cachés derrière une phrase de passe. Une seed n'a pas de destination tag.`,
      },
      {
        q: `Quel est le rôle de l'AGRASC ?`,
        options: [
          `Délivrer les agréments des prestataires de services sur crypto-actifs`,
          `Recevoir les déclarations de soupçon`,
          `Gérer les avoirs saisis et confisqués et, sur décision d'un magistrat, les vendre avant jugement`,
          `Geler les stablecoins à la demande des enquêteurs`,
        ],
        answer: 2,
        explain: `L'AGRASC assiste les juridictions dans la gestion et la valorisation des avoirs saisis et confisqués.`,
      },
      {
        kind: 'truefalse',
        q: `Le gel d'une adresse par l'émetteur de l'USDT bloque également les TRX et les autres jetons présents sur cette adresse.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `L'émetteur ne contrôle que son propre jeton. Les autres actifs restent mobiles.`,
      },
      {
        kind: 'multi',
        q: `Quels principes s'appliquent à la conduite technique d'une saisie ? (plusieurs réponses)`,
        options: [
          `Double contrôle de l'adresse de destination, lue en entier`,
          `Transaction test vérifiée sur un explorateur`,
          `Utilisation d'un portefeuille de saisie institutionnel`,
          `Transfert provisoire vers le compte d'exchange d'un enquêteur pour aller plus vite`,
        ],
        answer: [0, 1, 2],
        explain: `Double contrôle, test et portefeuille institutionnel sont la règle. Un moyen personnel est proscrit en toutes circonstances.`,
      },
      {
        q: `Pour des avoirs détenus chez un prestataire (créance du client sur l'exchange), quelle voie est typiquement envisagée ?`,
        options: [
          `Une saisie spéciale de bien ou droit incorporel, autorisée selon le cadre par le JLD sur requête du procureur, ou par le juge d'instruction`,
          `Une simple demande de gel, sans suite judiciaire`,
          `Un transfert spontané demandé par l'enquêteur seul, sans décision`,
          `Une confiscation immédiate par l'OPJ`,
        ],
        answer: 0,
        explain: `Les saisies spéciales (art. 706-141 et s. CPP, notamment 706-153 pour les biens incorporels) sont la voie habituelle ; le régime précis se vérifie avec le magistrat.`,
      },
      {
        q: `Pourquoi la vente avant jugement est-elle particulièrement pertinente pour des crypto-actifs saisis ?`,
        options: [
          `Parce que ces actifs sont volatils et risquent de se déprécier pendant la procédure`,
          `Parce qu'elle est automatique`,
          `Parce qu'elle permet à l'enquêteur de conserver le produit`,
          `Parce qu'elle annule la procédure`,
        ],
        answer: 0,
        explain: `La valeur d'un crypto-actif peut s'effondrer en quelques semaines ; la vente, décidée par un magistrat, préserve la valeur, consignée et soumise au sort de la procédure.`,
      },
    ],
    flashcards: [
      { front: 'Gel par un prestataire', back: `Blocage du compte par l'exchange à la demande des enquêteurs : rapide mais précaire.` },
      { front: 'Gel par un émetteur de stablecoin', back: `Liste noire du contrat : efficace même en auto-hébergement, limité à son jeton.` },
      { front: 'Saisie pénale vs confiscation', back: `Saisie : bien placé sous main de justice. Confiscation : peine prononcée au jugement.` },
      { front: 'Saisies spéciales', back: `Art. 706-141 et s. CPP ; biens incorporels : art. 706-153 (JLD sur requête du procureur, ou juge d'instruction).` },
      { front: 'AGRASC', back: `Gère les avoirs saisis et confisqués ; vente avant jugement sur décision d'un magistrat.` },
      { front: 'Adresse à geler chez un exchange', back: `L'adresse de dépôt du client (pas le hot wallet) et le txid du dépôt.` },
      { front: 'Transaction test', back: `Petit envoi vérifié sur un explorateur avant le transfert du solde.` },
      { front: 'Jetons sans gaz', back: `Approvisionner l'adresse (ETH, TRX…) depuis un portefeuille de service, et le documenter.` },
      { front: 'Seed restaurée : que vérifier ?', back: `Toutes les chaînes, tous les comptes et chemins, et une éventuelle phrase de passe.` },
      { front: 'Codes et clés en garde à vue', back: `Art. 434-15-2 CP et Cass. AP 7 nov. 2022 (téléphone) : application aux portefeuilles à apprécier avec le parquet.` },
      { front: 'Valorisation d’une saisie', back: `Unités natives + contre-valeur en euros à la date de saisie, avec la source du cours.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RAPPORT
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'rapport',
    title: 'Rédiger un rapport d’analyse blockchain',
    level: 3,
    track: 'enquete',
    minutes: 30,
    summary: `Le rapport est la forme sous laquelle votre analyse devient une pièce de procédure. Structure, distinction entre constatations, inférences et attributions, échelle de confiance, méthodes de montant tracé (poison, haircut, FIFO), graphes honnêtes et reproductibilité.`,
    objectives: [
      `Structurer un rapport d'analyse blockchain lisible par un magistrat et vérifiable par la défense.`,
      `Distinguer constatations, inférences et attributions, et exprimer un niveau de confiance cohérent.`,
      `Choisir, annoncer et justifier une méthode de montant tracé (poison, haircut, FIFO).`,
      `Produire des graphes qui démontrent sans tromper.`,
      `Garantir la reproductibilité de l'analyse (identifiants, versions, cours, exports et empreintes).`,
    ],
    prerequisites: ['suivre-flux', 'attribution-sources', 'exposition-risque', 'requisitions', 'chain-hopping'],
    practice: ['chain-hopping', 'centralized-mixer', 'ransomware-raas'],
    blocks: [
      {
        type: 'text',
        md: `Vous avez passé trois jours sur un traçage : quatre chaînes, un échangeur, un bridge, deux exchanges. Le magistrat, lui, lira votre rapport en vingt minutes. L'avocat de la défense le lira pendant des heures, en cherchant chaque affirmation non démontrée.

Un bon rapport d'analyse blockchain répond à trois exigences : **être compris** (synthèse claire, graphes lisibles), **être vérifiable** (chaque fait renvoie à un identifiant public) et **être honnête sur ses limites** (ce qui est constaté, ce qui est déduit, avec quel degré de confiance).`,
      },
      { type: 'heading', text: 'À quoi sert le rapport' },
      {
        type: 'text',
        md: `En matière pénale, la preuve est libre (article 427 du CPP) et soumise au **contradictoire** : chaque élément pourra être discuté. Un procès-verbal vaut par les constatations que son auteur a faites personnellement dans l'exercice de ses fonctions (article 429 du CPP). D'où une règle simple : ce que vous avez **constaté** sur la blockchain doit être clairement séparé de ce que vous en **déduisez** et de ce qu'un **outil** ou un tiers affirme.

La blockchain est un atout considérable : n'importe qui, y compris la défense ou un expert, peut vérifier vos constatations à partir des txid. Votre rapport doit rendre cette vérification **facile**.`,
      },
      { type: 'heading', text: 'Structure recommandée' },
      {
        type: 'steps',
        items: [
          { title: '1. Synthèse (une page)', md: `Ce qui est établi, ce qui est probable, les pistes ouvertes, les mesures proposées (réquisitions, gels, saisies).` },
          { title: '2. Contexte et saisine', md: `Faits, cadre procédural, question posée à l'analyse.` },
          { title: '3. Sources et outils', md: `Explorateurs, outils d'analyse (nom et **version**), bases d'attribution, dates de consultation, sources des cours.` },
          { title: '4. Méthodologie', md: `Heuristiques employées (rendu, entrées communes, corrélation montant/temps…), règles de décision, échelle de confiance, méthode de montant tracé.` },
          { title: '5. Constatations', md: `Chronologie détaillée et tableau des flux : date UTC, txid, chaîne, de → vers, montant natif, contre-valeur, attribution, confiance.` },
          { title: '6. Analyse', md: `Interprétation, hypothèses alternatives envisagées et écartées, avec leurs motifs.` },
          { title: '7. Conclusions et pistes', md: `Réponses à la question posée, actes proposés.` },
          { title: '8. Annexes', md: `Graphes, liste exhaustive des adresses et txid, captures, exports et leurs empreintes.` },
        ],
      },
      { type: 'heading', text: 'Constatations, inférences, attributions' },
      {
        type: 'table',
        caption: 'Trois natures d’énoncés, trois façons de les écrire',
        headers: ['Nature', 'Définition', 'Exemple de formulation'],
        rows: [
          ['Constatation', 'Fait vérifiable sur la blockchain ou dans une pièce', '« Le 14/02 à 09:12:47 UTC, l’adresse A a transféré 4 800 USDT à l’adresse B (txid …). »'],
          ['Inférence', 'Conclusion tirée d’heuristiques, avec ses limites', '« L’adresse C est probablement le rendu de la transaction T (adresse neuve, même type de script, entrée superflue). Confiance : élevée. »'],
          ['Attribution', 'Rattachement à une entité, avec sa source et sa date', '« Selon l’outil X (consulté le 03/03), B est une adresse de dépôt de Binance ; confirmé par la réponse de Binance du 12/03. »'],
        ],
      },
      {
        type: 'table',
        caption: 'Exemple d’échelle de confiance, à définir en tête de rapport et à appliquer partout',
        headers: ['Niveau', 'Critère', 'Exemple'],
        rows: [
          ['Établi', 'Constaté on-chain ou confirmé par une pièce de procédure', 'Transfert lu sur la chaîne ; titulaire confirmé par réquisition'],
          ['Élevé', 'Plusieurs heuristiques concordantes, aucune contraire', 'Corrélation : 1 candidat sur 214, adresse neuve, usage cohérent'],
          ['Moyen', 'Indices concordants mais limités, alternatives plausibles', 'Rendu probable, une heuristique contraire'],
          ['Faible', 'Hypothèse de travail', 'Corrélation avec 6 candidats'],
        ],
      },
      {
        type: 'check',
        q: `« L'adresse C est probablement le rendu (adresse neuve, même type de script). » De quelle nature relève cette phrase ?`,
        options: ['Constatation', 'Attribution confirmée', 'Inférence', 'Conclusion juridique'],
        answer: 2,
        explain: `C'est une conclusion tirée d'heuristiques : une inférence, à assortir de son niveau de confiance.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Formulations à bannir',
        md: `- « Les fonds appartiennent à… », « il est certain que… » pour une inférence.
- « Selon l'outil » sans nom, version ni date de consultation.
- « Les fonds sont passés sur BNB Chain » sans txid ni identifiant de bridge.
- « Le suspect a blanchi » : la qualification juridique appartient au magistrat ; décrivez les faits.`,
      },
      {
        type: 'compare',
        left: {
          title: 'À éviter',
          md: `« Les fonds de la victime ont été blanchis par le suspect via un mixeur puis récupérés sur son compte Binance. »`,
        },
        right: {
          title: 'À préférer',
          md: `« Le 12/03 à 08:41 UTC, 3,2 BTC ont été déposés sur une adresse attribuée par l'outil X (v. 4.2, consulté le 20/03) au mixeur Nebula (txid …) — **établi**. Trois versements issus de ce mixeur, totalisant 3,13 BTC, ont été regroupés le 14/03 vers un dépôt Binance (txid …) — **inférence, confiance élevée**. Le titulaire de ce compte est M. X selon la réponse de Binance du 28/03 — **établi**. »`,
        },
      },
      { type: 'heading', text: 'Montants tracés : annoncer sa méthode' },
      {
        type: 'text',
        md: `Lorsque des fonds se mêlent (une adresse reçoit des fonds de la victime **et** d'autres sources), le montant « tracé » jusqu'à une sortie dépend de la méthode, qu'il faut annoncer :

- **Poison** : toute sortie d'une adresse « contaminée » est considérée comme entièrement issue des fonds illicites. Maximaliste, utile pour signaler, inadaptée pour chiffrer un préjudice.
- **Haircut** (proportionnelle) : chaque sortie emporte la proportion de fonds illicites présente dans l'adresse. C'est la logique de l'exposition au prorata calculée par les outils.
- **FIFO** (premier entré, premier sorti) : les fonds sortent dans l'ordre où ils sont entrés, comme dans une file d'attente.

Exemple : une adresse reçoit 10 000 USDT de la victime, puis 30 000 USDT d'autres sources, et envoie 20 000 USDT vers un exchange.`,
      },
      {
        type: 'table',
        caption: 'Une même situation, trois résultats',
        headers: ['Méthode', 'Montant tracé vers l’exchange', 'Usage typique'],
        rows: [
          ['Poison', '20 000 USDT', 'Signalement, alerte de conformité'],
          ['Haircut', '5 000 USDT (25 % de 20 000)', 'Exposition, répartition entre plusieurs victimes'],
          ['FIFO', '10 000 USDT (les fonds de la victime sortent en premier)', 'Chronologie des flux, préjudice récupérable'],
        ],
      },
      { type: 'widget', id: 'risk-exposure', caption: `Le calcul au prorata (haircut) appliqué saut par saut : comparez-le mentalement aux méthodes poison et FIFO.` },
      {
        type: 'check',
        q: `Une adresse reçoit 6 000 USDT de la victime puis 18 000 USDT d'autres sources, et envoie 12 000 USDT. Montant tracé selon la méthode haircut ?`,
        options: ['12 000 USDT', '6 000 USDT', '3 000 USDT', '0 USDT'],
        answer: 2,
        explain: `Part illicite : 6 000 / 24 000 = 25 %. 25 % de 12 000 = 3 000 USDT. En FIFO, on aurait 6 000 ; en poison, 12 000.`,
      },
      { type: 'heading', text: 'Des graphes qui démontrent' },
      {
        type: 'flow',
        caption: `Graphe de synthèse : sens de lecture chronologique, montants et dates sur les flèches, lien inféré en pointillé, sauts intermédiaires regroupés.`,
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: '3 virements' },
          { id: 'c', label: 'Collecteur', kind: 'suspect', sub: 'bc1q…8fz' },
          { id: 'p', label: '14 sauts de peel chain', kind: 'unknown', sub: 'détail en annexe 3' },
          { id: 'oc', label: 'ChangeNOW', kind: 'exchange', sub: 'échangeur' },
          { id: 'e', label: '0x2d9a…', kind: 'wallet', sub: 'Ethereum' },
          { id: 'k', label: 'Dépôt OKX', kind: 'deposit', sub: 'titulaire identifié' },
        ],
        edges: [
          { from: 'v', to: 'c', label: '04–11/05 · 1,94 BTC' },
          { from: 'c', to: 'p', label: '12/05 · 1,90 BTC' },
          { from: 'p', to: 'oc', label: '12/05 · 0,8215 BTC' },
          { from: 'oc', to: 'e', label: 'corrélation 1/214', dashed: true },
          { from: 'e', to: 'k', label: '13/05 · 52 640 USDT' },
        ],
      },
      {
        type: 'text',
        md: `- **Un graphe par message** : le flux principal en pièce centrale, le graphe exhaustif en annexe.
- **Lisibilité** : lecture de gauche à droite, chronologique ; montants et dates sur les flèches ; sauts intermédiaires regroupés et signalés.
- **Légende** : couleur par type d'entité ; distinction visuelle entre attribution **confirmée** et attribution **d'outil**, entre lien **constaté** (trait plein) et lien **inféré** (pointillé).
- **Honnêteté graphique** : pas d'épaisseurs de flèche trompeuses, pas d'entité omise qui changerait l'interprétation (par exemple d'autres sources de fonds importantes).
- Chaque nœud et chaque flèche renvoie à des identifiants listés en annexe.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: "Dans l'espace d'enquête : graphes et constatations",
        md: "La barre au-dessus du graphe permet de mener **plusieurs pistes** dans des graphes séparés (nouveau graphe vide, ou copie du graphe actif ; double-clic pour renommer). Le menu *Constatations* exporte le dossier en JSON (marquages, notes, liens, graphes), à réimporter par un collègue sur la même affaire, et les adresses en CSV pour un tableur. Le rapport reprend le **diagramme de flux** du traçage, et précise, en temps réel, la date de situation et les adresses surveillées.",
      },
      { type: 'heading', text: 'Reproductibilité et chaîne de preuve' },
      {
        type: 'table',
        caption: 'Check-list de reproductibilité',
        headers: ['Élément', 'Exigence'],
        rows: [
          ['Identifiants', 'Adresses et txid complets (jamais abrégés en annexe), hauteurs de bloc'],
          ['Temps', 'Horodatages en UTC, fuseau mentionné si conversion'],
          ['Outils', 'Nom, version, paramètres (méthode de traçage, profondeur), date de consultation'],
          ['Attributions', 'Source, date, confirmation éventuelle par réquisition'],
          ['Valorisation', 'Source du cours, granularité (minute, heure, clôture), plateforme de référence'],
          ['Exports', 'CSV, captures, fichiers de graphe versés à la procédure avec leur empreinte SHA-256'],
          ['Raisonnements', 'Écrits en clair, pas seulement « selon l’outil »'],
          ['Relecture', 'Par un second analyste pour les dossiers importants'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Empreintes des exports',
        md: `Calculez l'empreinte SHA-256 de chaque export au moment où vous le produisez (par exemple avec \`certutil -hashfile export.csv SHA256\` sous Windows ou \`sha256sum export.csv\` sous Linux) et reportez-la dans le procès-verbal. Toute modification ultérieure du fichier sera détectable.`,
      },
      {
        type: 'case',
        title: 'Extrait de rapport — un saut inter-chaînes',
        md: `**Constatation 7** (établi). Le 12/05 à 14:02:31 UTC (bloc Bitcoin 846 112), l'adresse bc1q…8fz a transféré 0,8215 BTC à l'adresse bc1q…d4k (txid 7c1e…), balayée le même jour à 14:21 UTC vers une adresse attribuée par l'outil X (v. 4.2, consulté le 15/05) au hot wallet de l'échangeur ChangeNOW.

**Inférence 3** (confiance élevée). Parmi les 214 sorties du hot wallet ETH de ChangeNOW entre 14:09 et 15:00 UTC, une seule (19,61 ETH à 14:17 UTC vers 0x2d9a…e410, txid 0x8b02…) est compatible avec le montant attendu (19,40 à 19,70 ETH, cours de référence Y à 14:00 UTC, commission de 0,5 à 2 %). L'adresse 0x2d9a…e410, sans historique antérieur, a déposé 40 minutes plus tard la totalité dans ArcBridge. Hypothèse alternative examinée : versement à un autre client de ChangeNOW de même montant ; écartée faute de second candidat. Confirmation demandée à ChangeNOW le 15/05 (réponse en attente).`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Le test du collègue',
        md: `Remettez le rapport et ses annexes à un collègue qui n'a pas suivi l'affaire. S'il ne retrouve pas les mêmes flux à partir des txid, ou s'il ne sait pas dire, pour chaque phrase, si c'est une constatation, une inférence ou une attribution, le rapport n'est pas terminé.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Rapport, expertise et contradictoire',
        md: `Votre rapport pourra être discuté par la défense, voire soumis à une expertise judiciaire. Mentionnez les **limites connues** de chaque heuristique (CoinJoin non détecté qui fausse les entrées communes, corrélation à plusieurs candidats, attribution ancienne) : un rapport qui expose lui-même ses limites résiste bien mieux au contradictoire qu'un rapport qui les tait.`,
      },
      {
        type: 'check',
        q: `Comment représenter sur un graphe un lien déduit d'une corrélation d'échangeur non confirmée ?`,
        options: [
          `En trait plein, comme les autres`,
          `Distinctement (par exemple en pointillé), avec le niveau de confiance et le nombre de candidats`,
          `Ne pas le représenter du tout`,
          `Avec une flèche plus épaisse pour attirer l'attention`,
        ],
        answer: 1,
        explain: `La légende doit distinguer liens constatés et inférés pour ne pas tromper le lecteur ; le niveau de confiance accompagne le lien.`,
      },
    ],
    keyPoints: [
      `Structure : synthèse, contexte, sources et outils, méthodologie, constatations, analyse, conclusions, annexes.`,
      `Séparer constatations, inférences et attributions (source et date), chacune avec sa formulation.`,
      `Définir une échelle de confiance en tête de rapport et l'appliquer partout ; bannir les formulations absolues pour les inférences.`,
      `Annoncer et justifier la méthode de montant tracé (poison, haircut, FIFO) : les résultats diffèrent fortement.`,
      `Graphes : flux principal, légende, constaté en trait plein et inféré en pointillé, renvoi aux identifiants.`,
      `Reproductibilité : txid, hauteurs, UTC, versions d'outils, source des cours, exports avec empreinte SHA-256.`,
      `Exposer soi-même les limites de chaque heuristique renforce le rapport face au contradictoire.`,
    ],
    quiz: [
      {
        q: `Une adresse reçoit 10 000 USDT de la victime, puis 30 000 d'autres sources, et envoie 20 000 USDT. Combien sont tracés selon la méthode FIFO ?`,
        options: ['5 000', '10 000', '15 000', '20 000'],
        answer: 1,
        explain: `Les 10 000 USDT de la victime, entrés en premier, sortent en premier ; les 10 000 suivants proviennent d'autres sources.`,
      },
      {
        q: `Même situation : combien selon la méthode poison ?`,
        options: ['5 000', '10 000', '15 000', '20 000'],
        answer: 3,
        explain: `En poison, toute sortie d'une adresse contaminée est considérée comme entièrement illicite : 20 000 USDT.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments sont indispensables à la reproductibilité d'un rapport ? (plusieurs réponses)`,
        options: [
          `Les txid et adresses complets, avec les hauteurs de bloc`,
          `Le nom et la version des outils, avec la date de consultation`,
          `Les exports versés avec leur empreinte SHA-256`,
          `La couleur de fond des graphes`,
        ],
        answer: [0, 1, 2],
        explain: `Identifiants, outils versionnés et exports empreintés permettent à un tiers de refaire l'analyse.`,
      },
      {
        q: `« Selon l'outil X (consulté le 03/03), B est une adresse de dépôt de Binance. » De quelle nature relève cette phrase ?`,
        options: ['Constatation on-chain', 'Inférence par heuristique', 'Attribution (avec sa source)', 'Conclusion juridique'],
        answer: 2,
        explain: `C'est le rattachement d'une adresse à une entité, fondé sur une source tierce : une attribution, à confirmer idéalement par réquisition.`,
      },
      {
        kind: 'truefalse',
        q: `Dans un rapport, il est préférable de ne pas mentionner les limites des heuristiques utilisées, pour ne pas affaiblir la démonstration.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Exposer les limites (et les hypothèses alternatives écartées) rend le rapport plus solide face au contradictoire ; les taire l'expose à être discrédité.`,
      },
      {
        kind: 'multi',
        q: `Quelles formulations faut-il éviter dans un rapport d'analyse ? (plusieurs réponses)`,
        options: [
          `« Il est certain que les fonds appartiennent au suspect » pour une corrélation`,
          `« Selon l'outil » sans nom, version ni date`,
          `« Le suspect a commis un blanchiment aggravé »`,
          `« Le 14/02 à 09:12:47 UTC, l'adresse A a transféré 4 800 USDT à l'adresse B (txid …) »`,
        ],
        answer: [0, 1, 2],
        explain: `Les trois premières sont respectivement une certitude abusive, une source invérifiable et une qualification juridique. La dernière est une constatation correctement rédigée.`,
      },
      {
        q: `Pourquoi séparer nettement constatations et inférences dans un procès-verbal ou un rapport ?`,
        options: [
          `Pour allonger le document`,
          `Parce que les inférences sont interdites`,
          `Parce que les outils l'exigent`,
          `Parce que la valeur probante repose sur ce que l'auteur a personnellement constaté, et que chaque inférence sera discutée contradictoirement`,
        ],
        answer: 3,
        explain: `Le lecteur doit savoir ce qui est vérifiable directement et ce qui relève d'un raisonnement, avec son degré de confiance.`,
      },
    ],
    flashcards: [
      { front: 'Structure d’un rapport', back: `Synthèse, contexte, sources et outils, méthodologie, constatations, analyse, conclusions, annexes.` },
      { front: 'Constatation', back: `Fait vérifiable sur la chaîne ou dans une pièce (txid, heure UTC, montant).` },
      { front: 'Inférence', back: `Conclusion tirée d'heuristiques, avec ses limites et un niveau de confiance.` },
      { front: 'Attribution', back: `Rattachement d'une adresse à une entité, avec source et date ; confirmée par réquisition si possible.` },
      { front: 'Échelle de confiance', back: `Établi / élevé / moyen / faible : définie en tête de rapport, appliquée partout.` },
      { front: 'Méthode poison', back: `Toute sortie d'une adresse contaminée est réputée entièrement illicite (maximaliste).` },
      { front: 'Méthode haircut', back: `Chaque sortie emporte la proportion de fonds illicites de l'adresse (prorata).` },
      { front: 'Méthode FIFO', back: `Les fonds sortent dans l'ordre où ils sont entrés.` },
      { front: 'Lien inféré sur un graphe', back: `En pointillé, avec niveau de confiance (et nombre de candidats pour une corrélation).` },
      { front: 'Empreinte d’un export', back: `SHA-256 calculé à la production, reporté au PV : toute modification devient détectable.` },
      { front: 'Le test du collègue', back: `Un tiers doit retrouver les mêmes flux à partir des txid et classer chaque phrase.` },
    ],
  },
]
