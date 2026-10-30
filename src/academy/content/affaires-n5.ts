// Affaires décryptées — niveau 5 : le piratage de Bybit (février 2025).
// Affaire RÉELLE : seuls les faits établis par des sources publiques
// (FBI, déclarations des entreprises concernées, rapports d'investigation
// publiés, presse de référence) sont rapportés. Les estimations d'analystes
// sont présentées comme telles. Les illustrations sont signalées.
import type { Lesson } from '../model'

export const LESSONS_AFFAIRES_N5: Lesson[] = [
  {
    id: 'affaire-bybit',
    title: 'Affaire décryptée : le piratage de Bybit et le blanchiment à grande échelle',
    level: 5,
    track: 'affaires',
    minutes: 40,
    summary: `Le 21 février 2025, environ 401 000 ETH (près de 1,5 milliard de dollars) sont dérobés dans un portefeuille froid de l'exchange Bybit : le plus important vol de crypto-actifs jamais recensé. Cinq jours plus tard, le FBI l'attribue à la Corée du Nord (« TraderTraitor »). Compromission de l'interface Safe{Wallet}, dispersion éclair, conversion massive vers le bitcoin par THORChain, échangeurs non coopératifs, gels par l'industrie : anatomie d'un blanchiment industriel et des réponses qui ont, en partie, fonctionné.`,
    objectives: [
      `Décrire le vecteur d'attaque tel que publiquement documenté (compromission de l'interface Safe{Wallet}) et ses implications.`,
      `Reconstituer les phases du blanchiment : dispersion, swaps, passage inter-chaînes, échangeurs, conversion finale.`,
      `Évaluer ce qui a permis de geler ou de suivre une partie des fonds, et ce qui a échoué.`,
      `Transposer les enseignements de vitesse et de coordination public-privé à une enquête française.`,
    ],
    prerequisites: ['acteurs-etatiques', 'bridges', 'blanchiment-pro', 'echangeurs-instantanes', 'smart-contracts-lecture', 'gel-stablecoins'],
    practice: ['exchange-hack', 'chain-hopping', 'defi-exploit'],
    blocks: [
      {
        type: 'text',
        md: `Le **21 février 2025**, l'exchange **Bybit** constate qu'un de ses portefeuilles froids Ethereum, un portefeuille multisignature **Safe**, a été vidé. Environ **401 000 ETH**, soit près de **1,5 milliard de dollars**, ont été transférés vers une adresse contrôlée par les attaquants. C'est le plus important vol de crypto-actifs jamais recensé.

Le **26 février 2025**, le FBI publie un avis public (PSA) : la **Corée du Nord** est responsable du vol, une activité que le Bureau désigne sous le nom de **« TraderTraitor »**. Le FBI publie **51 adresses Ethereum** détenant ou ayant détenu des fonds volés et demande aux exchanges, bridges, opérateurs de nœuds, services DeFi et sociétés d'analyse de **bloquer** les transactions qui en proviennent.

Cette affaire n'est pas (encore) un dossier judiciaire : à la date des sources consultées, aucune inculpation spécifique n'est publique. C'est un cas d'école de **réponse opérationnelle** : vitesse, attribution, partage d'informations et gels.`,
      },
      { type: 'heading', text: 'Le vecteur d’attaque' },
      {
        type: 'text',
        md: `D'après les déclarations de Safe et les rapports d'investigation publiés (Sygnia, Verichains), l'attaque n'a pas cassé la cryptographie du portefeuille : elle a **trompé les signataires**.

- Le poste d'un **développeur de Safe{Wallet}** a été compromis, ce qui a permis de proposer une transaction malveillante déguisée.
- Selon Sygnia, des fichiers JavaScript de l'interface Safe{Wallet}, hébergés sur un espace de stockage en ligne (AWS S3), ont été modifiés le **19 février 2025**. Le code malveillant ne s'activait que pour des cibles précises, dont le portefeuille de Bybit.
- Les signataires de Bybit ont approuvé ce qui leur apparaissait comme une opération ordinaire. Selon les analyses techniques publiées, la transaction signée **remplaçait en réalité la logique du portefeuille** par un contrat contrôlé par les attaquants, qui ont alors pu en retirer les fonds.
- Peu après le vol, des versions « propres » des fichiers ont été remises en ligne. Verichains a retrouvé le code malveillant dans le **cache du navigateur** de trois machines de signataires.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Une preuve dans le cache du navigateur',
        md: `Le code malveillant avait été retiré du serveur peu après le vol. Sa trace a été retrouvée **sur les postes des signataires**, dans les fichiers de cache de Chrome. Pour un enquêteur, c'est un rappel fort : lors d'un vol par compromission d'interface, les **postes des signataires** doivent être préservés et analysés avant toute réinstallation.`,
      },
      { type: 'heading', text: 'Chronologie' },
      {
        type: 'steps',
        items: [
          { title: 'Début février 2025 — la préparation', md: `Selon Sygnia, les premières activités malveillantes sur l'infrastructure liée à Safe{Wallet} remontent au 4 février.` },
          { title: '19 février — le piège', md: `Les fichiers JavaScript de l'interface sont modifiés, avec un déclenchement ciblé.` },
          { title: '21 février — le vol', md: `Environ 401 000 ETH quittent le portefeuille froid de Bybit. L'exchange communique rapidement, maintient les retraits de ses clients et lance un programme de récompense.` },
          { title: 'Sous 72 heures — les réserves', md: `Bybit annonce avoir rétabli la couverture 1:1 des actifs de ses clients, grâce à des prêts, des dépôts d'investisseurs et des achats.` },
          { title: '26 février — l’attribution', md: `Avis public du FBI : Corée du Nord (TraderTraitor), liste de 51 adresses, appel au blocage.` },
          { title: 'Fin février - début mars — le blanchiment', md: `Les fonds sont dispersés, convertis et en grande partie transférés vers le bitcoin. Selon des analystes cités par la presse, l'essentiel des ETH volés a été converti en une dizaine de jours.` },
          { title: 'Avril 2025 — les suites', md: `L'échangeur eXch, mis en cause pour son rôle dans le blanchiment, annonce sa fermeture le 17 avril ; le 30 avril, le BKA et le parquet de Francfort saisissent son infrastructure et environ 34 millions d'euros de crypto-actifs.` },
        ],
      },
      { type: 'heading', text: 'La mécanique du blanchiment' },
      {
        type: 'flow',
        caption: `Schéma simplifié, établi d'après l'avis du FBI (26 février 2025), les déclarations de Bybit et les analyses publiques. Les proportions sont des estimations d'analystes, variables selon les sources.`,
        nodes: [
          { id: 'cw', label: 'Portefeuille froid Bybit', kind: 'victim', sub: 'multisig Safe' },
          { id: 'atk', label: 'Adresse des attaquants', kind: 'suspect', sub: '≈ 401 000 ETH' },
          { id: 'disp', label: 'Dispersion', kind: 'wallet', sub: 'dizaines puis milliers d’adresses' },
          { id: 'swap', label: 'Swaps de jetons', kind: 'dex', sub: 'jetons de staking → ETH' },
          { id: 'thor', label: 'THORChain', kind: 'bridge', sub: 'ETH → BTC, voie principale' },
          { id: 'exch', label: 'eXch', kind: 'exchange', sub: 'non coopératif' },
          { id: 'agg', label: 'Agrégateurs DEX', kind: 'dex', sub: 'interfaces Web3' },
          { id: 'btc', label: 'Adresses BTC', kind: 'wallet', sub: 'dispersion' },
          { id: 'otc', label: 'Conversion finale', kind: 'unknown', sub: 'fiat attendu par le FBI' },
        ],
        edges: [
          { from: 'cw', to: 'atk', label: '21 février' },
          { from: 'atk', to: 'disp' },
          { from: 'disp', to: 'swap' },
          { from: 'disp', to: 'thor', label: 'majorité' },
          { from: 'disp', to: 'exch' },
          { from: 'disp', to: 'agg' },
          { from: 'thor', to: 'btc' },
          { from: 'exch', to: 'btc', dashed: true },
          { from: 'btc', to: 'otc', dashed: true },
        ],
      },
      {
        type: 'table',
        caption: 'Les phases du blanchiment et ce qu’elles signifient pour l’enquêteur',
        headers: ['Phase', 'Ce qui a été observé publiquement', 'Point d’accroche ou limite'],
        rows: [
          ['Dispersion', 'Fonds répartis sur des milliers d’adresses et plusieurs blockchains (FBI)', 'Volume d’adresses énorme : seuls des outils automatisés et un partage d’alertes suivent le rythme'],
          ['Swaps de jetons', 'Conversion des jetons dérivés (staking) en ETH ; le protocole mETH a récupéré environ 15 000 cmETH', 'Les jetons dont l’émetteur peut intervenir offrent une fenêtre de récupération'],
          ['Passage inter-chaînes', 'THORChain, protocole décentralisé, principale voie vers le bitcoin selon les analystes', 'Pas d’opérateur pour geler, mais des transactions entrantes et sortantes corrélables'],
          ['Échangeurs', 'eXch a traité une part importante des fonds, sans coopérer selon Bybit', 'Trace opaque, jusqu’au démantèlement du service'],
          ['Agrégateurs', 'Une interface Web3 d’agrégation a été citée parmi les routes utilisées', 'Les interfaces centralisées peuvent filtrer les adresses signalées'],
          ['Conversion finale', 'Le FBI s’attend à une conversion en monnaie fiduciaire', 'Phase hors chaîne : courtiers OTC, comptes de mules, coopération internationale'],
        ],
      },
      {
        type: 'widget',
        id: 'bridge-flow',
        caption: `Illustration simplifiée : un passage inter-chaînes laisse un événement au départ et une transaction à l'arrivée. Sur THORChain, le mémo de la transaction entrante indique l'actif demandé et l'adresse de destination : c'est le fil qui relie les deux chaînes.`,
      },
      {
        type: 'check',
        q: `Pourquoi THORChain a-t-il été une voie privilégiée pour convertir les ETH volés en bitcoins ?`,
        options: [
          `Parce qu'il rend les transactions invisibles`,
          `Parce qu'il s'agit d'un protocole décentralisé sans opérateur central capable de geler les fonds, qui permet des échanges natifs ETH → BTC`,
          `Parce qu'il appartient à Bybit`,
          `Parce qu'il convertit automatiquement en Monero`,
        ],
        answer: 1,
        explain: `Les échanges sur THORChain restent visibles et corrélables, mais aucun opérateur central ne peut geler les fonds comme le ferait un exchange. C'est ce qui a suscité un vif débat public au sein de sa communauté.`,
      },
      { type: 'heading', text: 'Ce qui a fonctionné, ce qui a échoué' },
      {
        type: 'table',
        caption: 'Bilan de la réponse, d’après les déclarations publiques',
        headers: ['Levier', 'Résultat', 'Limite'],
        rows: [
          ['Attribution rapide', 'Avis du FBI en cinq jours, avec liste d’adresses', 'Une attribution étatique n’entraîne pas d’arrestation'],
          ['Partage d’adresses', 'Appel public au blocage adressé à tout l’écosystème', 'Ne lie que les acteurs qui veulent ou doivent l’appliquer'],
          ['Programme de récompense', 'Jusqu’à 10 % des fonds récupérés ; plateforme de suivi recensant les acteurs coopératifs et non coopératifs', 'Efficace pour mobiliser, sans effet sur les services opaques'],
          ['Gels par l’industrie', 'Selon Bybit, une petite part des fonds a été gelée (environ 3,8 % dans un point d’étape d’avril 2025)', 'Fraction faible du total'],
          ['Traçabilité', 'Bybit estimait début mars qu’environ 77 % des fonds restaient traçables ; environ 68,6 % en avril', 'Une part croissante devient opaque, notamment via eXch'],
          ['Démantèlement d’un échangeur', 'Saisie de l’infrastructure d’eXch et d’environ 34 M€ par le BKA', 'Intervient après le passage de l’essentiel des fonds'],
        ],
      },
      {
        type: 'case',
        title: 'Le moment pivot : la course contre la montre des premières heures',
        md: `Un blanchiment de cette ampleur est une **opération industrielle** : les attaquants disposaient manifestement d'une procédure prête à l'emploi. Les premières heures ont été consacrées à la **dispersion** des fonds et à la conversion des jetons qui pouvaient être gelés, avant que les adresses ne soient largement signalées.

La réponse a reposé sur trois accélérateurs :

1. **La transparence de la victime.** Bybit a communiqué immédiatement, publié les adresses et lancé une plateforme de suivi avec récompense, transformant analystes indépendants et entreprises en capteurs.
2. **L'attribution publique.** L'avis du FBI, avec 51 adresses, a donné une base claire aux services de conformité pour bloquer.
3. **Les acteurs capables d'agir.** Émetteurs de jetons, exchanges, certaines interfaces : chaque gel, même modeste, a été obtenu par un acteur **centralisé** disposant d'un levier technique.

La leçon est double. Côté enquête : la fenêtre utile se compte en **heures**, pas en jours. Côté prévention : un portefeuille multisignature ne protège pas si les signataires ne peuvent pas **vérifier ce qu'ils signent** indépendamment de l'interface.`,
      },
      {
        type: 'check',
        q: `Quel type d'acteur a permis, dans cette affaire, les gels et récupérations de fonds ?`,
        options: [
          `Les protocoles entièrement décentralisés, par vote de leurs utilisateurs`,
          `Les mineurs de Bitcoin`,
          `Les attaquants eux-mêmes, en échange de la récompense`,
          `Des acteurs centralisés disposant d'un levier technique : émetteurs de jetons, exchanges, interfaces`,
        ],
        answer: 3,
        explain: `Les récupérations (par exemple les cmETH récupérés par le protocole mETH) et les gels ont été le fait d'acteurs capables d'intervenir techniquement sur les jetons ou les comptes.`,
      },
      { type: 'heading', text: 'Les erreurs et points d’accroche' },
      {
        type: 'compare',
        left: {
          title: 'Ce que les attaquants ont bien fait',
          md: `- Attaque de la **chaîne d'approvisionnement** (interface Safe{Wallet}) plutôt que de Bybit directement.
- Code malveillant **ciblé** et **effacé** juste après le vol.
- Dispersion et conversion **immédiates**, avant la diffusion des listes d'adresses.
- Usage de services **sans opérateur** ou **non coopératifs**.`,
        },
        right: {
          title: 'Ce qui leur a échappé',
          md: `- Des traces du code malveillant dans le **cache** des postes des signataires.
- Des jetons dont l'émetteur pouvait **intervenir** (récupération de cmETH).
- Une blockchain publique : chaque mouvement reste **visible et corrélable**, y compris à travers THORChain.
- La fermeture puis la **saisie** d'eXch, avec ses données.`,
        },
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Un précédent : la conversion par des courtiers OTC',
        md: `Le blanchiment nord-coréen ne s'arrête pas à la chaîne. En mars 2020, le Trésor américain avait sanctionné deux ressortissants chinois accusés d'avoir blanchi, notamment par des opérations de gré à gré (OTC), des crypto-actifs volés par le groupe Lazarus lors du piratage d'un exchange en 2018. C'est cette phase finale, hors chaîne, que vise l'avertissement du FBI sur la conversion en monnaie fiduciaire.`,
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Agir dans l’heure', md: `Dès le signalement d'un vol, relevez txid, adresses et montants, et diffusez la liste des adresses aux prestataires et aux émetteurs de jetons concernés. Chaque heure perdue multiplie les adresses à suivre.` },
          { title: 'Préserver les postes des signataires', md: `Saisie ou copie forensique des machines utilisées pour signer, avant toute remise en état : cache du navigateur, journaux, extensions.` },
          { title: 'Cibler les acteurs centralisés', md: `Émetteurs de stablecoins et de jetons de staking, exchanges, interfaces d'agrégation : ce sont eux qui peuvent geler. Préparez des demandes motivées, avec adresses et preuves de provenance.` },
          { title: 'Suivre à travers les passerelles', md: `Pour les échanges inter-chaînes, exploitez les mémos et événements des protocoles pour relier la transaction de départ et celle d'arrivée.` },
          { title: 'Coordonner', md: `Un vol de cette ampleur impose la coordination internationale : Europol, partenaires étrangers, échanges avec les équipes de sécurité de la victime et les sociétés d'analyse. Un seul point d'entrée, une seule liste d'adresses à jour.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- FBI, avis public I-022625-PSA du 26 février 2025, « North Korea Responsible for $1.5 Billion Bybit Hack » (page consultée : ic3.gov/PSA/2025/PSA250226).
- Safe, déclaration publique du 26 février 2025 sur la compromission d'un poste de développeur Safe{Wallet}.
- Rapports d'investigation publiés par Sygnia et Verichains à la demande de Bybit (février 2025), tels que rapportés par la presse (The Block, BleepingComputer).
- Bybit et son dirigeant, déclarations publiques (février-avril 2025) : rétablissement des réserves, programme de récompense, points d'étape sur la traçabilité.
- Analyses publiques (Arkham, Lookonchain, Nansen, Coin Metrics) relayées par la presse spécialisée sur le volume volé et les routes de blanchiment.
- Police criminelle fédérale allemande (BKA) et parquet de Francfort (ZIT), annonce du 9 mai 2025 sur la saisie de l'infrastructure d'eXch, telle que rapportée par la presse.
- Trésor américain (OFAC), désignation de mars 2020 visant deux ressortissants chinois pour le blanchiment de fonds volés par Lazarus.`,
      },
    ],
    keyPoints: [
      `21 février 2025 : environ 401 000 ETH (près de 1,5 Md$) dérobés dans un portefeuille froid multisignature de Bybit.`,
      `26 février 2025 : le FBI attribue le vol à la Corée du Nord (« TraderTraitor ») et publie 51 adresses à bloquer.`,
      `Le vecteur : une interface Safe{Wallet} compromise qui a fait signer une transaction déguisée ; des traces retrouvées dans le cache des postes des signataires.`,
      `Le blanchiment : dispersion immédiate, swaps de jetons, conversion massive vers le BTC par THORChain, échangeurs non coopératifs comme eXch.`,
      `Les gels et récupérations ont été obtenus par des acteurs centralisés ; ils ne représentent qu'une faible part du total.`,
      `La fenêtre utile se compte en heures : vitesse, liste d'adresses partagée et coordination public-privé sont décisives.`,
    ],
    quiz: [
      {
        q: `À quel acteur le FBI a-t-il attribué le piratage de Bybit ?`,
        options: [`Un groupe de rançongiciel russe`, `Un employé de Bybit`, `La Corée du Nord, sous le nom « TraderTraitor »`, `Un pirate isolé non identifié`],
        answer: 2,
        explain: `L'avis public du FBI du 26 février 2025 attribue le vol à la Corée du Nord et désigne cette activité sous le nom « TraderTraitor ».`,
      },
      {
        kind: 'truefalse',
        q: `Selon les sources publiques, les attaquants ont cassé la cryptographie du portefeuille multisignature de Bybit.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `La cryptographie n'a pas été cassée : les signataires ont été trompés par une interface Safe{Wallet} compromise, qui leur a fait approuver une transaction déguisée.`,
      },
      {
        kind: 'multi',
        q: `Que contenait l'avis public du FBI du 26 février 2025 ? (plusieurs réponses)`,
        options: [
          `L'annonce de l'arrestation des auteurs`,
          `L'attribution du vol à la Corée du Nord`,
          `Une liste de 51 adresses Ethereum liées aux fonds volés`,
          `Un appel aux exchanges, bridges et autres acteurs à bloquer les transactions issues de ces adresses`,
        ],
        answer: [1, 2, 3],
        explain: `L'avis attribue, liste et demande le blocage. Aucune arrestation n'a été annoncée.`,
      },
      {
        q: `Où les enquêteurs de Verichains ont-ils retrouvé le code malveillant, alors qu'il avait été retiré du serveur ?`,
        options: [
          `Dans le cache du navigateur de machines de signataires`,
          `Dans la blockchain Ethereum`,
          `Dans les serveurs de THORChain`,
          `Dans un e-mail de revendication`,
        ],
        answer: 0,
        explain: `Le code malveillant a été retrouvé dans les fichiers de cache de Chrome de trois machines de signataires : d'où l'importance de préserver ces postes.`,
      },
      {
        kind: 'truefalse',
        q: `Un protocole inter-chaînes décentralisé comme THORChain rend les transactions invisibles et impossibles à corréler.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Les transactions restent publiques et corrélables, notamment par le mémo des transactions entrantes. Ce qui manque, c'est un opérateur central capable de geler les fonds.`,
      },
      {
        q: `Quelle a été la principale voie de conversion des ETH volés vers le bitcoin, selon les analystes ?`,
        options: [`Un exchange régulé européen`, `Le Lightning Network`, `Un ETF bitcoin`, `THORChain`],
        answer: 3,
        explain: `Les analyses publiques désignent THORChain comme la voie principale de conversion vers le BTC, devant l'échangeur eXch et des agrégateurs DEX.`,
      },
      {
        kind: 'multi',
        q: `Quels réflexes un enquêteur français doit-il adopter face à un vol massif d'un prestataire ? (plusieurs réponses)`,
        options: [
          `Diffuser sans délai la liste des adresses aux prestataires et émetteurs de jetons`,
          `Attendre l'attribution officielle avant toute démarche`,
          `Préserver les postes des signataires avant toute réinstallation`,
          `Préparer des demandes de gel motivées aux acteurs centralisés`,
        ],
        answer: [0, 2, 3],
        explain: `Attendre l'attribution ferait perdre la fenêtre utile, qui se compte en heures. Les trois autres réflexes s'appliquent immédiatement.`,
      },
      {
        q: `Qu'est-il advenu de l'échangeur eXch, mis en cause dans le blanchiment ?`,
        options: [
          `Il a restitué l'intégralité des fonds à Bybit`,
          `Il a annoncé sa fermeture en avril 2025, puis son infrastructure a été saisie par les autorités allemandes`,
          `Il a été racheté par Bybit`,
          `Il n'a jamais été mis en cause`,
        ],
        answer: 1,
        explain: `eXch a annoncé sa fermeture le 17 avril 2025 ; le 30 avril, le BKA et le parquet de Francfort ont saisi son infrastructure et environ 34 M€ de crypto-actifs.`,
      },
    ],
    flashcards: [
      { front: 'Piratage de Bybit', back: `21 février 2025 : environ 401 000 ETH (près de 1,5 Md$) volés dans un portefeuille froid multisignature.` },
      { front: 'TraderTraitor', back: `Nom donné par le FBI à l'activité nord-coréenne responsable du vol (avis du 26 février 2025).` },
      { front: 'Avis du FBI', back: `Attribution, 51 adresses Ethereum, appel au blocage adressé à tout l'écosystème.` },
      { front: 'Vecteur d’attaque', back: `Poste d'un développeur Safe{Wallet} compromis, JavaScript de l'interface modifié, transaction déguisée signée.` },
      { front: 'Preuve forensique clé', back: `Code malveillant retrouvé dans le cache Chrome de machines de signataires.` },
      { front: 'Rôle de THORChain', back: `Principale voie de conversion ETH → BTC selon les analystes ; pas d'opérateur central pour geler.` },
      { front: 'Mémo THORChain', back: `Le mémo de la transaction entrante indique l'actif demandé et l'adresse de destination.` },
      { front: 'eXch', back: `Échangeur non coopératif ; fermeture le 17 avril 2025, infrastructure saisie le 30 avril par le BKA.` },
      { front: 'Récompense Bybit', back: `Jusqu'à 10 % des fonds récupérés ; suivi public des acteurs coopératifs.` },
      { front: 'Réserves Bybit', back: `Couverture 1:1 rétablie en 72 heures (prêts, dépôts, achats).` },
      { front: 'Leçon principale', back: `La fenêtre utile se compte en heures : vitesse, liste partagée, acteurs centralisés capables de geler.` },
    ],
  },
]
