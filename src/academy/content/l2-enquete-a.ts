// Niveau 2 — typologies d'escroqueries et OSINT.
import type { Lesson } from '../model'

export const L2_ENQUETE_A: Lesson[] = [
  // ════════════════════════════════════════════════════════════════════════
  // TYPOLOGIES
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'typologies',
    title: "Typologies d'escroqueries aux crypto-actifs",
    level: 2,
    track: 'typologies',
    minutes: 35,
    summary:
      "Les grands schémas rencontrés en plainte : escroquerie sentimentale à l'investissement, faux conseillers et usurpations, escroqueries au recouvrement, chantage et sextorsion, drainers, hameçonnage et SIM swap, rug pulls et Ponzi, violences physiques visant les détenteurs. Pour chacun : le mode opératoire, la signature on-chain, les premiers actes et les qualifications à envisager.",
    objectives: [
      'Reconnaître les principales typologies d\'escroqueries aux crypto-actifs à partir du récit d\'une victime.',
      'Associer à chaque typologie sa signature on-chain habituelle et l\'actif le plus fréquent.',
      'Identifier les premiers actes prioritaires (preuves à recueillir, gel, réquisitions).',
      'Rapprocher des plaintes à partir d\'éléments communs (adresse de collecte, domaine, opérateur).',
      'Envisager les qualifications pénales pertinentes, sous réserve de vérification.',
    ],
    prerequisites: ['premiers-reflexes', 'stablecoins', 'tron-usdt', 'exchanges'],
    blocks: [
      {
        type: 'text',
        md: `Connaître les typologies, ce n'est pas faire de la sociologie de la fraude : c'est **gagner des heures** dès le recueil de la plainte. Reconnaître une escroquerie sentimentale à l'investissement, c'est savoir qu'il faut demander à la victime le nom de son exchange (pour requérir ses retraits), qu'on cherchera une **adresse de collecte** en USDT-TRC20 alimentée par d'autres victimes, et que le réseau recontactera probablement la victime avec une offre de « récupération ».

Chaque typologie a un **mode opératoire**, une **signature on-chain** et des **réflexes** propres. Le tableau ci-dessous sert de carte ; la suite de la leçon détaille chaque schéma.`,
      },
      {
        type: 'table',
        headers: ['Typologie', 'Vecteur de contact', 'Actif fréquent', 'Signature on-chain', 'Premier réflexe'],
        rows: [
          ['Escroquerie sentimentale à l\'investissement', 'Rencontre, réseau social, faux « mauvais numéro »', 'USDT-TRC20', 'Adresse de collecte multi-victimes, consolidation, OTC', 'Requérir l\'exchange de la victime'],
          ['Faux conseiller / faux support', 'Appel, SMS, faux site de support', 'BTC, USDT', 'Transfert vers un « portefeuille sécurisé » puis dispersion rapide', 'Gel immédiat si stablecoins'],
          ['Escroquerie au recouvrement', 'Recontact de victimes déjà escroquées', 'Tous', 'Souvent les mêmes adresses que la première escroquerie', 'Rapprocher avec la plainte initiale'],
          ['Chantage / sextorsion', 'Courriel de masse, messagerie', 'BTC', 'Adresse de paiement unique ou partagée par campagne', 'Compter les payeurs, rapprocher les plaintes'],
          ['Drainer', 'Faux airdrop, faux mint, comptes piratés', 'Jetons EVM, NFT', 'Approbation puis aspiration ; partage opérateur / client', 'Identifier l\'opérateur du kit'],
          ['SIM swap / hameçonnage', 'Opérateur téléphonique, faux site d\'exchange', 'Tous', 'Retrait depuis le compte de la victime vers l\'attaquant', 'Opérateur + exchange (connexions)'],
          ['Rug pull / Ponzi', 'Promotion de projet, réseaux sociaux', 'Jetons, BNB, ETH', 'Retrait de liquidité ou mint massif par le déployeur', 'Analyser le déployeur et le contrat'],
        ],
        caption: 'Une même affaire combine souvent plusieurs typologies (par exemple escroquerie sentimentale puis recouvrement).',
      },
      { type: 'heading', text: 'L\'escroquerie sentimentale à l\'investissement' },
      {
        type: 'steps',
        items: [
          { title: 'Contact', md: 'Application de rencontre, réseau social, ou faux « mauvais numéro » sur une messagerie. Le profil est soigné et rassurant.' },
          { title: 'Mise en confiance', md: 'Des semaines d\'échanges quotidiens, sans aucune demande d\'argent. Le contact évoque ses succès en investissement.' },
          { title: 'Fausse plateforme', md: 'Présentation d\'une plateforme (AuroraTrade dans les exercices) : site ou application crédible, graphiques, gains fictifs affichés, petit retrait autorisé au début pour rassurer.' },
          { title: 'Versements croissants', md: 'La victime achète des crypto-actifs sur un exchange régulé (Coinhouse) et les **retire** vers l\'adresse fournie par la plateforme, croyant alimenter son compte.' },
          { title: 'Blocage', md: 'Au moment de retirer : « frais », « taxes », « caution anti-blanchiment »… puis disparition du contact — ou recontact par un faux service de récupération.' },
        ],
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'virements SEPA' },
          { id: 'cv', label: 'Coinhouse', kind: 'exchange', sub: 'achat USDT, retrait' },
          { id: 'col', label: 'TXr4…m9Qd', kind: 'suspect', sub: 'adresse de collecte « AuroraTrade »' },
          { id: 'others', label: '37 autres victimes', kind: 'victim' },
          { id: 'cons', label: 'TFq8…2kLp', kind: 'wallet', sub: 'consolidation' },
          { id: 'otc', label: 'SatsDesk OTC', kind: 'service', sub: 'USDT ↔ espèces' },
          { id: 'kz', label: 'OKX', kind: 'deposit', sub: 'adresse de dépôt' },
        ],
        edges: [
          { from: 'v', to: 'cv', label: '64 000 €' },
          { from: 'cv', to: 'col', label: '69 120 USDT (9 retraits)' },
          { from: 'others', to: 'col', label: '1,2 M USDT' },
          { from: 'col', to: 'cons', label: 'balayages quotidiens' },
          { from: 'cons', to: 'otc', label: '780 000 USDT' },
          { from: 'cons', to: 'kz', label: '410 000 USDT' },
        ],
        caption: 'Signature typique : retraits de la victime depuis un exchange régulé vers une adresse de collecte TRON partagée, puis consolidation et sortie vers OTC et exchanges.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : l\'exchange de la victime',
        md: `La victime a souvent perdu ou mal noté les adresses et les montants. Son **propre exchange** (Coinhouse ici) détient l'historique exact : adresses de retrait, txid, montants, horodatages. Une réquisition à ce service, dès le dépôt de plainte, fournit le point de départ fiable de la trace. Ces escroqueries sont souvent opérées à une échelle industrielle, depuis des centres d'Asie du Sud-Est où travaillent parfois des personnes elles-mêmes victimes de traite.`,
      },
      { type: 'heading', text: 'Faux conseillers, usurpations et recouvrement' },
      {
        type: 'text',
        md: `- **Faux conseiller bancaire** : un appel (numéro usurpé) signale une « fraude en cours » sur le compte ; pour « protéger » l'épargne, la victime est guidée pour acheter des crypto-actifs et les envoyer vers un « coffre sécurisé ».
- **Faux support** : l'escroc se présente comme le service client d'un exchange ou d'un fabricant de portefeuille matériel. Il obtient la **phrase de récupération**, fait installer une fausse application ou un logiciel de prise en main à distance.
- **Usurpation d'autorité** : faux policiers, faux gendarmes, faux magistrats exigeant un paiement en crypto-actifs, parfois via des distributeurs automatiques.
- **Escroquerie au recouvrement** : les victimes d'une première escroquerie sont recontactées par de prétendus avocats, cabinets d'enquête, « hackers éthiques », voire faux services de police ou d'organisations internationales, qui promettent de **récupérer les fonds** contre des frais. C'est une seconde escroquerie, souvent opérée par le même réseau, qui dispose de la liste des victimes.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Message à transmettre à chaque victime',
        md: `Les forces de l'ordre ne demandent **jamais** de paiement pour restituer des fonds, et aucun « hacker » ne peut récupérer des crypto-actifs contre rémunération. Dites-le explicitement lors de la plainte, et invitez la victime à vous signaler tout recontact : il apporte souvent de nouveaux identifiants (numéros, adresses, domaines).`,
      },
      {
        type: 'check',
        q: 'Une victime d\'escroquerie au faux placement est contactée par un « cabinet d\'avocats » qui promet de récupérer ses fonds contre 2 000 € de frais d\'ouverture de dossier. De quoi s\'agit-il le plus probablement ?',
        options: [
          'D\'une démarche légitime qu\'il faut encourager',
          'D\'une escroquerie au recouvrement, souvent opérée par le même réseau',
          'D\'une mesure de gel ordonnée par un juge',
          'D\'une procédure de restitution par l\'AMF',
        ],
        answer: 1,
        explain: 'Les escroqueries au recouvrement ciblent les victimes connues des réseaux. Les identifiants utilisés (numéro, domaine, adresse de paiement) sont à exploiter et à rapprocher de la première plainte.',
      },
      { type: 'heading', text: 'Chantage et sextorsion' },
      {
        type: 'text',
        md: `- **Courriels de chantage en masse** : « je vous ai filmé via votre webcam », un ancien mot de passe issu d'une fuite cité pour crédibiliser, paiement exigé en BTC sous 48 heures. Les adresses sont parfois **uniques par courriel**, parfois **partagées** par toute une campagne.
- **Sextorsion ciblée** : après un échange intime en ligne (souvent avec un faux profil), menace de diffusion contre paiement (cartes cadeaux, crypto-actifs). Les mineurs sont des cibles fréquentes : la dimension de protection prime.
- **Menaces diverses** : fausses alertes à la bombe, chantage aux données volées, avec paiement en crypto-actifs.

L'adresse figurant dans le message permet de **compter les payeurs**, de mesurer la campagne, d'identifier la sortie vers un service et de **rapprocher les plaintes**. Une adresse sans aucun paiement entrant permet aussi de rassurer la victime.`,
      },
      {
        type: 'case',
        title: 'Cas — la campagne du 9 avril',
        md: `Entre le 9 et le 14 avril 2026, onze plaintes sont déposées pour un même courriel de chantage. Quatre adresses Bitcoin différentes y figurent. L'analyse montre que ces quatre adresses sont co-dépensées le 16 avril dans une même transaction (CIOH) : une seule campagne, un seul portefeuille.

Les quatre adresses ont reçu **63 paiements** (et non onze) pour un total de 2,91 BTC, de montants proches de l'équivalent de 1 200 €. Les fonds consolidés partent ensuite en trois pelures vers Binance et ChangeNOW. Une seule procédure regroupe les plaintes, et 52 victimes non plaignantes peuvent être recherchées via les exchanges d'où proviennent leurs paiements.`,
      },
      { type: 'heading', text: 'Drainers, hameçonnage, SIM swap et empoisonnement d\'adresse' },
      {
        type: 'text',
        md: `- **Drainers** : faux sites (faux airdrop, faux mint de NFT, faux portail de réclamation) diffusés par des comptes piratés ou des publicités. La victime connecte son portefeuille et signe une **approbation** ou un **permit** : les fonds sont aspirés en quelques secondes et partagés automatiquement entre l'**opérateur du kit** (souvent 20 à 30 %) et son client. Les adresses de l'opérateur reçoivent leur part de milliers de victimes : c'est le pivot.
- **Hameçonnage d'identifiants** : faux sites d'exchange pour voler identifiants et codes de double authentification, puis retrait vers l'adresse de l'attaquant.
- **SIM swap** : l'attaquant obtient le transfert du numéro de la victime sur une nouvelle carte SIM (usurpation ou complicité chez l'opérateur), réinitialise ses accès (messagerie, exchange) et vide les comptes. Les données de l'**opérateur** (date, canal et point de vente du changement) et de l'**exchange** (IP, appareils, adresse de retrait) sont centrales.
- **Empoisonnement d'adresse** (*address poisoning*) : l'attaquant envoie des transferts de montant nul ou infime depuis une adresse qui ressemble à celle d'un correspondant habituel, pour que la victime la copie par erreur dans son historique (traité au niveau 3).`,
      },
      { type: 'heading', text: 'Rug pulls, Ponzi et faux projets' },
      {
        type: 'text',
        md: `- **Rug pull** : le créateur d'un jeton fournit de la liquidité sur un DEX, organise la promotion, puis **retire la liquidité** ou frappe massivement de nouveaux jetons et les vend, laissant les acheteurs avec des jetons sans valeur.
- **Honeypot** : jeton dont le contrat empêche les acheteurs de revendre.
- **Ponzi et faux rendements** : faux projets de minage, de « staking » ou de robots de trading à rendement garanti, qui paient les premiers investisseurs avec les dépôts des suivants, souvent avec un système de parrainage.

Signature on-chain : le **déployeur** du contrat (et l'adresse qui lui a fourni le gaz), la transaction de **retrait de liquidité**, puis les transferts vers des exchanges. Le code du contrat (fonctions de mint réservées, taxes modifiables, liste noire) documente souvent l'intention frauduleuse. La liste noire publiée par l'AMF des sites proposant sans autorisation des services sur crypto-actifs est un premier réflexe de vérification.`,
      },
      { type: 'heading', text: 'Quand la fraude devient violence' },
      {
        type: 'callout',
        kind: 'field',
        title: 'Enlèvements et séquestrations',
        md: `Plusieurs enlèvements et séquestrations visant des détenteurs de crypto-actifs ou leurs proches ont été médiatisés en France, notamment en 2025, avec des demandes de rançon en crypto-actifs. Pour l'enquêteur crypto, deux enjeux immédiats : **suivre la rançon en temps réel** (adresse fournie par les ravisseurs, exchanges et émetteurs à alerter pour un gel) et **identifier les sources** qui ont permis de cibler la victime (exposition publique de son patrimoine, fuites de données de clients). Ces affaires relèvent de dispositifs spécialisés : la place de l'analyste est en appui de la direction d'enquête.`,
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'La plupart des typologies commencent ou finissent chez un exchange : visualisez le parcours dépôt → balayage → hot wallet pour savoir quelle adresse demander à la victime et quelle adresse requérir.',
      },
      {
        type: 'check',
        q: 'Une victime a signé, sur un faux site d\'airdrop, une transaction qui a vidé ses jetons. 25 % des fonds partent vers une adresse qui reçoit aussi des parts de centaines d\'autres victimes. De quelle typologie s\'agit-il, et quel est le pivot ?',
        options: [
          'Un rug pull ; le pivot est le pool de liquidité',
          'Un drainer vendu comme service ; le pivot est l\'adresse de l\'opérateur du kit',
          'Un SIM swap ; le pivot est l\'opérateur téléphonique',
          'Un CoinJoin ; le pivot est le coordinateur',
        ],
        answer: 1,
        explain: 'Le partage automatique d\'une part fixe vers une adresse commune à de nombreuses victimes est la signature d\'un drainer « as a service ». L\'opérateur du kit relie toutes les affaires.',
      },
      { type: 'heading', text: 'Réflexes communs et qualifications' },
      {
        type: 'steps',
        items: [
          { title: 'Recueillir des preuves complètes', md: 'txid, adresses, captures des échanges et du site, URL, identifiants des comptes de messagerie, numéros, relevés bancaires et relevés de l\'exchange de la victime.' },
          { title: 'Geler vite', md: 'Stablecoins encore identifiables : demande à l\'émetteur. Fonds arrivés sur un exchange : réquisition avec demande de blocage du compte.' },
          { title: 'Rapprocher', md: 'Adresse de collecte, domaine, gabarit de site, opérateur de drainer, tag XRP : vérifiez les autres procédures et les plateformes de plainte et de signalement en ligne (THESEE pour certaines escroqueries sur internet, PHAROS pour les contenus illicites).' },
          { title: 'Protéger la victime', md: 'Prévenir le risque de recouvrement frauduleux, de nouvelle sollicitation, et orienter vers l\'aide aux victimes.' },
          { title: 'Qualifier', md: 'Retenir les qualifications adaptées et vérifier les circonstances aggravantes, qui conditionnent certains actes d\'enquête.' },
        ],
      },
      {
        type: 'table',
        headers: ['Qualification', 'Texte (code pénal)', 'Typologies concernées'],
        rows: [
          ['Escroquerie', 'Art. 313-1 ; bande organisée : art. 313-2', 'Faux placement, faux conseiller, recouvrement, Ponzi, rug pull'],
          ['Extorsion / chantage', 'Art. 312-1 / art. 312-10', 'Sextorsion, chantage, enlèvement avec rançon'],
          ['Accès frauduleux à un STAD', 'Art. 323-1 et suivants', 'Hameçonnage, SIM swap, piratage de comptes'],
          ['Blanchiment', 'Art. 324-1 ; présomption d\'origine illicite : art. 324-1-1', 'Toutes, au stade de la dispersion et de la conversion'],
          ['Association de malfaiteurs', 'Art. 450-1', 'Réseaux organisés'],
        ],
        caption: 'Liste indicative et non exhaustive.',
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Vérifier les textes',
        md: `Les qualifications, les peines et les circonstances aggravantes doivent être vérifiées dans la version des textes **en vigueur au moment des faits**. La bande organisée et le quantum de peine encouru modifient les actes possibles (par exemple les conditions d'accès à certaines données de connexion, ou le recours à des techniques spéciales d'enquête).`,
      },
    ],
    keyPoints: [
      'Escroquerie sentimentale à l\'investissement : confiance, fausse plateforme, retraits bloqués par de faux frais ; USDT-TRC20 et adresses de collecte multi-victimes.',
      'Faux conseillers, faux supports et usurpations d\'autorité : transfert « sécurisé », phrase de récupération demandée, paiements en crypto-actifs.',
      'Les escroqueries au recouvrement ciblent les victimes déjà escroquées, souvent par le même réseau.',
      'Chantage : l\'adresse de paiement permet de compter les payeurs et de rapprocher les plaintes.',
      'Drainers : approbations signées, partage opérateur / client ; SIM swap : opérateur téléphonique + exchange.',
      'Rug pull : retrait de liquidité ou mint massif par le déployeur ; le code du contrat documente l\'intention.',
      'Réflexes : preuves complètes, gel rapide, rapprochement, protection de la victime, qualification vérifiée.',
    ],
    quiz: [
      {
        q: 'Une victime d\'escroquerie à l\'investissement ne retrouve plus les adresses utilisées. Quelle est la source la plus fiable ?',
        options: [
          'La fausse plateforme',
          'Les réseaux sociaux du contact',
          'Un cabinet de recouvrement',
          'L\'exchange régulé où elle a acheté et retiré ses crypto-actifs, par réquisition',
        ],
        answer: 3,
        explain: 'L\'exchange de la victime détient l\'historique exact des retraits (adresses, montants, txid).',
      },
      {
        q: 'Quelle répartition des fonds volés est typique d\'un drainer vendu « as a service » ?',
        options: [
          '100 % au client',
          'Une part (souvent 20 à 30 %) à l\'opérateur du kit et le reste au client',
          '50 % brûlés',
          'Tout vers un exchange',
        ],
        answer: 1,
        explain: 'Le partage automatique entre opérateur et client est une signature des drainers vendus comme service.',
      },
      {
        kind: 'multi',
        q: 'Dans un SIM swap suivi du vidage d\'un compte d\'exchange, quelles données sont centrales ? (plusieurs réponses)',
        options: [
          'La date, le canal et le point de vente du changement de SIM chez l\'opérateur',
          'Les adresses IP et appareils de connexion au compte d\'exchange',
          'L\'adresse de retrait utilisée par l\'attaquant',
          'Le destination tag XRP de la victime',
        ],
        answer: [0, 1, 2],
        explain: 'Le changement de SIM, les connexions au compte et l\'adresse de retrait permettent de remonter vers l\'attaquant. Le tag XRP n\'a pas de rapport avec ce schéma.',
      },
      {
        kind: 'truefalse',
        q: 'Il est utile de rappeler à chaque victime que les forces de l\'ordre ne demandent jamais de paiement pour restituer des fonds.',
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: 'Les victimes sont fréquemment recontactées par de faux services de récupération, parfois se présentant comme des services de police.',
      },
      {
        q: 'Onze plaintes pour un même courriel de chantage citent quatre adresses BTC différentes, co-dépensées ensuite dans une même transaction. Que peut-on en déduire ?',
        options: [
          'Quatre campagnes indépendantes',
          'Une même campagne et un même portefeuille, dont on peut compter tous les payeurs',
          'Rien, les adresses sont différentes',
          'Que les victimes se connaissent',
        ],
        answer: 1,
        explain: 'La co-dépense relie les adresses (CIOH). On peut alors mesurer toute la campagne, au-delà des seuls plaignants.',
      },
      {
        q: 'Quelle transaction caractérise un rug pull sur un DEX ?',
        options: [
          'Un CoinJoin',
          'Un gel par l\'émetteur',
          'Le retrait de la liquidité (ou un mint massif suivi de ventes) par le créateur',
          'Une transaction coinbase',
        ],
        answer: 2,
        explain: 'Le créateur retire la liquidité ou dilue le jeton, laissant les acheteurs sans contrepartie.',
      },
      {
        kind: 'truefalse',
        q: 'Une même affaire ne peut relever que d\'une seule typologie.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Les typologies se combinent souvent : escroquerie sentimentale puis recouvrement, hameçonnage puis drainer, etc.',
      },
    ],
    flashcards: [
      { front: 'Signature on-chain du faux placement sentimental', back: 'Retraits de la victime depuis un exchange régulé vers une adresse de collecte (souvent USDT-TRC20) partagée par de nombreuses victimes.' },
      { front: 'Premier acte dans une escroquerie au faux placement', back: 'Requérir l\'exchange de la victime pour obtenir ses retraits exacts (adresses, txid, montants).' },
      { front: 'Escroquerie au recouvrement', back: 'Recontact des victimes par de faux avocats, hackers ou policiers promettant la récupération contre des frais.' },
      { front: 'Pivot d\'un drainer « as a service »', back: 'L\'adresse de l\'opérateur du kit, qui reçoit une part (20 à 30 %) des vols de nombreux clients.' },
      { front: 'Chantage par courriel : intérêt de l\'adresse', back: 'Compter les payeurs, mesurer la campagne, suivre la sortie, rapprocher les plaintes.' },
      { front: 'SIM swap : deux sources clés', back: 'L\'opérateur téléphonique (changement de SIM) et l\'exchange (connexions, appareils, retraits).' },
      { front: 'Honeypot', back: 'Jeton dont le contrat empêche les acheteurs de revendre.' },
      { front: 'Rug pull : signature', back: 'Retrait de liquidité ou mint massif par le déployeur, puis transferts vers des exchanges.' },
      { front: 'Qualification de base des escroqueries', back: 'Escroquerie (art. 313-1 CP), bande organisée (313-2), blanchiment (324-1) — à vérifier selon les faits.' },
      { front: 'Liste noire de l\'AMF', back: 'Liste des sites proposant sans autorisation des services financiers ou sur crypto-actifs : premier réflexe de vérification.' },
    ],
    practice: ['pig-butchering-tron', 'first-trace', 'sextortion-cluster', 'dex-swap', 'address-poisoning'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // OSINT
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'osint',
    title: 'OSINT : relier une adresse à une personne',
    level: 2,
    track: 'enquete',
    minutes: 30,
    summary:
      "Les sources ouvertes relient adresses et infrastructures à des identités : moteurs, forums, noms de domaine blockchain, profils NFT, messages on-chain, infrastructure des sites frauduleux. Méthode de pivot, cadre légal (sources ouvertes, enquête sous pseudonyme, données issues de fuites), constatation en procédure et rigueur d'attribution.",
    objectives: [
      'Pivoter d\'une adresse vers des identifiants (pseudonymes, domaines, comptes) et inversement.',
      'Analyser l\'infrastructure d\'un site frauduleux pour relier des affaires.',
      'Distinguer la consultation de sources ouvertes de l\'interaction sous pseudonyme, et en connaître le cadre.',
      'Constater correctement une source en ligne en procédure (URL, horodatage, empreinte).',
      'Graduer la fiabilité d\'une attribution OSINT et la corroborer.',
    ],
    prerequisites: ['attribution-sources', 'premiers-reflexes'],
    blocks: [
      {
        type: 'text',
        md: `L'analyse on-chain dit **où vont les fonds** ; elle dit rarement **qui** les contrôle. Entre les deux, il y a les réquisitions aux prestataires… et les **sources ouvertes** (OSINT, *open source intelligence*) : tout ce qu'une adresse, un pseudonyme ou un site a laissé comme traces publiques.

Une adresse peut avoir été publiée volontairement (page de dons, profil de développeur), par négligence (capture d'écran sur un forum), ou par nécessité (adresse de paiement d'un site frauduleux). Chaque publication est un **pivot** potentiel.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'addr', label: '0x3f9a…c21d', kind: 'suspect', sub: 'reçoit 25 % des vols (drainer)' },
          { id: 'ens', label: 'shadowmint.eth', kind: 'service', sub: 'enregistrement inverse' },
          { id: 'tw', label: '@shadowmint_dev', kind: 'unknown', sub: 'champ texte ENS' },
          { id: 'git', label: 'Dépôt de code public', kind: 'unknown', sub: 'même pseudonyme' },
          { id: 'mail', label: 'Adresse e-mail', kind: 'unknown', sub: 'dans un commit' },
          { id: 'id', label: 'Identification', kind: 'suspect', sub: 'à corroborer par réquisition' },
        ],
        edges: [
          { from: 'addr', to: 'ens', label: 'reverse record' },
          { from: 'ens', to: 'tw', label: 'text record' },
          { from: 'tw', to: 'git', label: 'pseudonyme réutilisé' },
          { from: 'git', to: 'mail', label: 'métadonnées' },
          { from: 'mail', to: 'id', dashed: true, label: 'réquisition fournisseur' },
        ],
        caption: 'Une chaîne de pivots : chaque maillon est un indice ; seule la réquisition finale transforme l\'hypothèse en identification.',
      },
      { type: 'heading', text: 'Pivots à partir d\'une adresse' },
      {
        type: 'table',
        headers: ['Pivot', 'Où chercher', 'Ce qu\'on peut obtenir', 'Fiabilité'],
        rows: [
          ['Recherche plein texte', 'Moteurs de recherche (adresse entre guillemets), archives du web', 'Pages de dons, forums, profils, signalements', 'Variable'],
          ['Noms de domaine blockchain', 'ENS (.eth) et services équivalents', 'Nom choisi, champs texte (réseau social, site, e-mail)', 'Moyenne : le titulaire choisit ce qu\'il publie'],
          ['Profils NFT et réseaux décentralisés', 'Places de marché NFT, réseaux sociaux on-chain', 'Pseudonyme, avatar, liens vers d\'autres comptes', 'Moyenne'],
          ['Messages on-chain', 'Input data (EVM), OP_RETURN (Bitcoin), memos (Stellar, EOS, TON)', 'Revendications, références, insultes, contacts', 'Variable'],
          ['Dépôts de code', 'Plateformes de code publiques', 'Adresses dans le code, pseudonymes, métadonnées de commits', 'Moyenne'],
          ['Bases de signalements', 'Bases communautaires d\'adresses frauduleuses', 'Rapprochement avec d\'autres victimes et campagnes', 'Faible à moyenne'],
        ],
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Une chaîne de caractères trouvée sur un forum ou dans un code source : est-ce une adresse, de quelle chaîne, de quel type ? Entraînez-vous avant de lancer vos recherches.',
      },
      {
        type: 'check',
        q: 'Que peut révéler l\'enregistrement inverse d\'un nom ENS associé à une adresse ?',
        options: [
          'La clé privée de l\'adresse',
          'Le nom choisi par le titulaire, et parfois des liens vers ses comptes via les champs texte',
          'Son solde bancaire',
          'Son adresse IP',
        ],
        answer: 1,
        explain: 'L\'enregistrement inverse associe l\'adresse à un nom lisible ; les champs texte peuvent pointer vers des réseaux sociaux, un site ou un e-mail.',
      },
      { type: 'heading', text: 'De l\'identité vers les adresses' },
      {
        type: 'text',
        md: `Le pivot fonctionne aussi dans l'autre sens. À partir d'un **pseudonyme**, d'un **e-mail**, d'un **numéro** ou d'un **nom de domaine** connus par la procédure (plainte, téléphone exploité, réponse de réquisition), on recherche :

- les adresses publiées par ce pseudonyme (forums, profils, dépôts de code, annonces) ;
- les noms ENS ou équivalents enregistrés avec ce pseudonyme ;
- les autres sites hébergés sur la même infrastructure, qui affichent peut-être d'autres adresses de dépôt ;
- les anciennes versions d'un profil ou d'un site dans les **archives du web**, avant que l'auteur ne les nettoie.

Pensez aux **réutilisations** : un même pseudonyme, une même photo de profil, une même formule de signature ou un même identifiant de messagerie sur plusieurs plateformes.`,
      },
      { type: 'heading', text: 'Analyser l\'infrastructure d\'un site frauduleux' },
      {
        type: 'steps',
        items: [
          { title: 'Nom de domaine', md: 'Date d\'enregistrement, bureau d\'enregistrement, serveurs DNS, historique. Depuis le RGPD, les données du titulaire sont souvent masquées : le bureau d\'enregistrement peut être requis.' },
          { title: 'Hébergement', md: 'Adresse IP, fournisseur, autres domaines hébergés sur la même IP, historique DNS.' },
          { title: 'Certificats TLS', md: 'Les journaux publics de transparence des certificats révèlent les sous-domaines et des domaines « miroirs » créés par le même opérateur.' },
          { title: 'Code source', md: 'Adresses de portefeuille codées en dur, identifiants d\'outils d\'audience ou clés d\'API réutilisés, commentaires, noms de fichiers, empreinte du favicon.' },
          { title: 'Gabarits', md: 'De nombreux sites frauduleux sont clonés à partir d\'un même modèle : textes, images, structure identiques relient des affaires.' },
          { title: 'Canaux de contact', md: 'Comptes de messagerie, robots, numéros, e-mails : chacun est une cible de réquisition (plateforme, opérateur, fournisseur).' },
        ],
      },
      {
        type: 'case',
        title: 'Cas — trois sites, un opérateur',
        md: `Trois plaintes visent trois fausses plateformes : \`aurora-trade.example\`, \`auroratrade-pro.example\` et \`atx-invest.example\`. Les noms diffèrent, mais l'analyse du code source montre :

- le **même identifiant** d'outil de mesure d'audience sur les trois sites ;
- la même adresse TRON de « dépôt par défaut », \`TXr4…m9Qd\`, codée en dur dans un script ;
- des certificats émis le même jour, et deux des domaines hébergés sur la même IP.

Ces éléments sont des **indices concordants** d'un même opérateur. Ils justifient la jonction des procédures et une réquisition groupée à l'hébergeur. L'adresse codée en dur, déjà identifiée comme adresse de collecte, fait le lien avec l'analyse on-chain.`,
      },
      { type: 'heading', text: 'Le cadre légal' },
      {
        type: 'callout',
        kind: 'law',
        title: 'Ce que l\'enquêteur peut faire, et comment',
        md: `- La **consultation de sources librement accessibles** est possible dans le cadre de l'enquête ; les constatations se consignent en procès-verbal.
- **Interagir** avec des suspects sous une identité d'emprunt (s'inscrire sur la fausse plateforme, converser avec l'« opérateur », acheter un service) relève de l'**enquête sous pseudonyme** (article 230-46 du code de procédure pénale) : agents spécialement habilités, infractions punies d'emprisonnement commises par voie de communications électroniques, autorisation du magistrat pour certains actes (comme l'acquisition de contenus ou de services), et interdiction, à peine de nullité, de toute incitation à commettre l'infraction.
- Les **bases de données issues de fuites** posent des questions de licéité et de loyauté de la preuve : n'y recourez que dans un cadre validé par votre hiérarchie et le magistrat.
- Les traitements de données personnelles à des fins pénales relèvent de la directive (UE) 2016/680 et de sa transposition dans la loi Informatique et libertés : collectez ce qui est nécessaire et proportionné, dans les outils autorisés.

Vérifiez les conditions en vigueur et faites valider la démarche par le parquet ou le juge d'instruction.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Consultation passive',
          md: `- Lire un forum, un profil public, un site.
- Interroger un explorateur, une archive du web, les journaux de certificats.
- Analyser le code source d'une page publique.
- **Cadre** : actes d'enquête ordinaires, constatés en PV.`,
        },
        right: {
          title: 'Interaction',
          md: `- Créer un compte sur la fausse plateforme, converser, payer.
- Rejoindre un groupe fermé en se présentant sous une fausse identité.
- Acheter un kit de drainer pour l'analyser.
- **Cadre** : enquête sous pseudonyme (art. 230-46 CPP), agents habilités, autorisations requises.`,
        },
      },
      {
        type: 'check',
        q: 'Vous souhaitez vous inscrire sur la fausse plateforme et converser avec l\'« opérateur » sous une identité fictive. Quel est le cadre ?',
        options: [
          'Aucun cadre particulier : c\'est une source ouverte',
          'Une simple réquisition à l\'hébergeur',
          'L\'enquête sous pseudonyme (art. 230-46 CPP), avec ses conditions d\'habilitation et d\'autorisation',
          'Un signalement PHAROS',
        ],
        answer: 2,
        explain: 'Dès qu\'il y a interaction sous identité d\'emprunt, on sort de la simple consultation : le cadre de l\'enquête sous pseudonyme s\'applique.',
      },
      { type: 'heading', text: 'Constater et conserver' },
      {
        type: 'steps',
        items: [
          { title: 'Noter le contexte', md: 'URL complète, date et heure (avec fuseau), poste et connexion utilisés, outil de capture.' },
          { title: 'Capturer', md: 'Capture intégrale de la page (pas seulement la zone visible), et sauvegarde du code source si utile.' },
          { title: 'Calculer l\'empreinte', md: 'Empreinte SHA-256 de chaque fichier collecté, consignée au PV : elle permettra de prouver qu\'il n\'a pas été modifié.' },
          { title: 'Archiver', md: 'Les pages peuvent disparaître : une copie datée (et, si possible, une archive par un service tiers) préserve la preuve.' },
          { title: 'Rédiger', md: 'Décrire factuellement ce qui est vu, sans interprétation, puis — séparément — l\'analyse et le niveau de confiance.' },
        ],
      },
      { type: 'heading', text: 'Rigueur d\'attribution' },
      {
        type: 'table',
        headers: ['Situation', 'Valeur', 'Ce qui manque'],
        rows: [
          ['Une adresse publiée sur un profil social', 'Indice', 'Le profil peut être usurpé ou l\'adresse recopiée'],
          ['Même pseudonyme sur deux plateformes', 'Indice faible', 'Homonymie possible ; vérifier d\'autres éléments communs'],
          ['Même pseudonyme + même photo + même adresse e-mail', 'Indice fort', 'Corroboration par un prestataire'],
          ['OSINT concordant + réponse de réquisition', 'Élément probant', '—'],
          ['Signalement communautaire isolé', 'Piste', 'Source, méthode et date inconnues'],
        ],
        caption: 'Une attribution OSINT isolée n\'est jamais une identification.',
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Fausses pistes délibérées',
        md: `Les auteurs savent que les enquêteurs lisent les sources ouvertes. Ils peuvent publier une adresse sous le nom d'un tiers, usurper un pseudonyme connu, envoyer des fonds depuis l'adresse d'un tiers ou écrire un memo accusant quelqu'un d'autre. Plus une piste est « facile », plus elle mérite d'être corroborée.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Et votre propre trace ?',
        md: `Visiter le site d'un suspect, suivre son compte ou cliquer sur un lien qu'il a diffusé peut laisser une trace visible de lui (journaux du serveur, compteurs de vues, liens de suivi). Travaillez depuis un environnement dédié : c'est l'objet de la leçon OPSEC.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'OSINT', def: 'Renseignement d\'origine sources ouvertes : informations librement accessibles au public.' },
          { term: 'Pivot', def: 'Identifiant (adresse, pseudonyme, domaine, e-mail) qui permet de passer d\'une source à une autre.' },
          { term: 'Enregistrement inverse (ENS)', def: 'Association d\'une adresse à un nom lisible choisi par son titulaire.' },
          { term: 'Transparence des certificats', def: 'Journaux publics de tous les certificats TLS émis, qui révèlent domaines et sous-domaines.' },
          { term: 'Enquête sous pseudonyme', def: 'Cadre légal (art. 230-46 CPP) permettant à des agents habilités d\'interagir en ligne sous une identité d\'emprunt.' },
          { term: 'Empreinte (hash) d\'un fichier', def: 'Valeur SHA-256 calculée sur un fichier collecté, qui en garantit l\'intégrité.' },
        ],
      },
    ],
    keyPoints: [
      'Pivots depuis une adresse : moteurs, archives, noms ENS (enregistrement inverse, champs texte), profils NFT, messages on-chain, dépôts de code.',
      'Le pivot fonctionne aussi de l\'identité vers les adresses (pseudonymes, e-mails, domaines réutilisés).',
      'L\'infrastructure d\'un site frauduleux (domaine, IP, certificats, code source, gabarits, contacts) relie les affaires.',
      'Consultation de sources ouvertes : acte d\'enquête ordinaire ; interaction sous identité d\'emprunt : enquête sous pseudonyme (art. 230-46 CPP).',
      'Constater en PV : URL, horodatage avec fuseau, capture intégrale, empreinte SHA-256.',
      'L\'OSINT produit des indices : sourcer, dater, corroborer ; se méfier des fausses pistes.',
    ],
    quiz: [
      {
        q: 'Que peut révéler l\'enregistrement inverse d\'un nom ENS ?',
        options: ['La clé privée', 'Son solde bancaire', 'Son IP', 'Le nom choisi par le titulaire de l\'adresse et parfois des liens vers ses comptes'],
        answer: 3,
        explain: 'L\'enregistrement inverse associe l\'adresse à un nom lisible ; les champs texte peuvent pointer vers des réseaux sociaux.',
      },
      {
        q: 'Le même identifiant d\'outil d\'audience apparaît dans le code de trois sites frauduleux. Qu\'en déduire ?',
        options: [
          'Rien',
          'Un indice de lien entre les sites (même opérateur ou même kit), à corroborer',
          'Une preuve d\'identité de l\'opérateur',
          'Que les sites sont légitimes',
        ],
        answer: 1,
        explain: 'Les identifiants réutilisés relient souvent des infrastructures, mais doivent être corroborés.',
      },
      {
        kind: 'truefalse',
        q: 'Une adresse BTC publiée sur le profil social d\'une personne suffit à l\'identifier comme titulaire de l\'adresse.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Une publication peut être usurpée, recopiée ou trompeuse ; c\'est un indice à corroborer.',
      },
      {
        q: 'Vous souhaitez vous inscrire sur la fausse plateforme et converser avec l\'« opérateur ». Quel cadre ?',
        options: [
          'L\'enquête sous pseudonyme (art. 230-46 CPP), avec ses conditions',
          'Aucun cadre particulier',
          'Une simple réquisition',
          'Un signalement PHAROS',
        ],
        answer: 0,
        explain: 'L\'interaction sous identité d\'emprunt est encadrée et nécessite une habilitation.',
      },
      {
        kind: 'multi',
        q: 'Que faut-il consigner lors de la constatation d\'une page web en procédure ? (plusieurs réponses)',
        options: [
          'L\'URL complète',
          'La date et l\'heure avec le fuseau horaire',
          'Une capture intégrale de la page',
          'L\'empreinte SHA-256 des fichiers collectés',
          'Votre avis sur la culpabilité du titulaire du site',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Le PV décrit factuellement la source et garantit l\'intégrité des fichiers. L\'analyse se rédige séparément, et jamais sous forme d\'avis sur la culpabilité.',
      },
      {
        q: 'Pourquoi consulter les journaux de transparence des certificats TLS ?',
        options: [
          'Pour obtenir l\'identité du titulaire du domaine',
          'Pour découvrir les sous-domaines et domaines miroirs liés à un site',
          'Pour déchiffrer le trafic du site',
          'Pour geler le domaine',
        ],
        answer: 1,
        explain: 'Tous les certificats émis sont journalisés publiquement : on y retrouve des domaines et sous-domaines créés par le même opérateur.',
      },
      {
        kind: 'truefalse',
        q: 'Visiter le site d\'un suspect depuis le poste et la connexion du service est sans conséquence, car la consultation est passive.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Même passive, une visite laisse des traces dans les journaux du serveur, voire des compteurs ou des liens de suivi. Un environnement dédié s\'impose.',
      },
    ],
    flashcards: [
      { front: 'OSINT', back: 'Renseignement d\'origine sources ouvertes : tout ce qui est librement accessible au public.' },
      { front: 'Trois pivots on-chain vers une identité', back: 'Nom ENS (enregistrement inverse et champs texte), profil NFT, message on-chain (input data, OP_RETURN, memo).' },
      { front: 'Pivots d\'infrastructure d\'un site frauduleux', back: 'Domaine, hébergement, certificats TLS, code source (adresses, identifiants réutilisés), gabarits, canaux de contact.' },
      { front: 'Cadre de l\'interaction sous identité d\'emprunt', back: 'Enquête sous pseudonyme, art. 230-46 CPP : agents habilités, autorisations pour certains actes, pas d\'incitation.' },
      { front: 'Bases issues de fuites', back: 'Questions de licéité et de loyauté de la preuve : uniquement dans un cadre validé.' },
      { front: 'Constater une page web', back: 'URL, date et heure avec fuseau, capture intégrale, empreinte SHA-256, description factuelle.' },
      { front: 'Valeur d\'une attribution OSINT isolée', back: 'Un indice, jamais une identification : sourcer, dater, corroborer.' },
      { front: 'WHOIS depuis le RGPD', back: 'Données du titulaire souvent masquées : requérir le bureau d\'enregistrement.' },
      { front: 'Texte applicable aux traitements de données à des fins pénales', back: 'Directive (UE) 2016/680, transposée dans la loi Informatique et libertés.' },
    ],
    practice: ['sextortion-cluster', 'pig-butchering-tron', 'darknet-vendor', 'dex-swap'],
  },
]
