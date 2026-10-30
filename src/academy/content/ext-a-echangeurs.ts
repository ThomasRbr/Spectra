// Niveau 3 — Inter-chaînes : échangeurs instantanés sans compte (cycle de vie
// d'une commande, données détenues, réquisition, corrélation et taux d'erreur).
// Règle : aucun comportement fautif n'est attribué à une société réelle ; les
// exemples d'échangeurs non coopératifs sont fictifs.
import type { Lesson } from '../model'

export const LESSON_ECHANGEURS_INSTANTANES: Lesson = {
  id: 'echangeurs-instantanes',
  title: 'Échangeurs instantanés : fonctionnement, traces et réquisition',
  level: 3,
  track: 'interchaines',
  minutes: 40,
  summary: `Un échangeur instantané casse le lien on-chain entre ce qui entre et ce qui sort, mais sa base de données, elle, relie tout : commande, adresse de dépôt, adresse de paiement, adresse de remboursement, IP, navigateur, partenaire apporteur. Cycle de vie d'une commande, données à réquisitionner (et commandes liées), corrélation montant/temps avec une estimation honnête de son taux d'erreur, déclencheurs de KYC, écart entre slogans « sans KYC » et obligations anti-blanchiment, services non coopératifs ou sanctionnés.`,
  objectives: [
    `Décrire le cycle de vie d'une commande : devis, adresse de dépôt dédiée, contrôles, échange, paiement depuis le hot wallet, balayage, remboursement.`,
    `Lister précisément les données qu'un échangeur peut fournir et rédiger une demande qui obtient aussi les commandes liées.`,
    `Conduire une corrélation montant/temps et estimer son risque de faux positif à partir du nombre de paiements dans la fenêtre.`,
    `Comprendre les déclencheurs de vérification d'identité et la réalité réglementaire derrière les promesses « sans KYC ».`,
    `Adapter la stratégie au profil du service : coopératif, lent, non coopératif ou sanctionné.`,
  ],
  prerequisites: ['chain-hopping', 'requisitions', 'exchanges', 'cadre-reglementaire'],
  practice: ['chain-hopping', 'monero-wall'],
  blocks: [
    {
      type: 'text',
      md: `« Échangez vos BTC contre de l'ETH en cinq minutes, sans inscription. » Les échangeurs instantanés (*instant exchangers*, *swap services*) sont devenus un passage obligé des schémas de blanchiment : ils permettent de changer d'actif **et** de chaîne en une seule opération, sans compte, avec un lien on-chain rompu entre le dépôt et le paiement.

La leçon « Chain hopping » vous a appris à reconnaître le saut et à tenter une corrélation. Celle-ci va plus loin : comprendre **comment le service fonctionne de l'intérieur**, ce que sa base de données contient, comment l'obtenir, et comment mesurer honnêtement la fiabilité d'une corrélation quand le service ne répond pas.`,
    },
    { type: 'heading', text: 'Le cycle de vie d’une commande' },
    {
      type: 'steps',
      items: [
        { title: '1. Devis', md: `L'utilisateur choisit la paire (BTC → ETH), le montant, le type de taux (**fixe**, garanti pendant une courte durée, ou **flottant**, calculé à la réception), et saisit l'**adresse de réception**, éventuellement un memo ou tag, une **adresse de remboursement** et un courriel, tous deux souvent facultatifs.` },
        { title: '2. Création de la commande', md: `Le service attribue un **identifiant de commande** et une **adresse de dépôt dédiée** à cette commande (ou une adresse partagée assortie d'un memo sur les chaînes qui l'imposent). La page de suivi de la commande a souvent une URL contenant cet identifiant.` },
        { title: '3. Dépôt', md: `L'utilisateur envoie les fonds. Le service attend un nombre de confirmations qui dépend de la chaîne et du montant.` },
        { title: '4. Contrôles', md: `Beaucoup de services passent l'origine du dépôt au crible d'un outil d'analyse. Un dépôt jugé à risque (fonds volés, mixeur, adresse sanctionnée, signalement) peut être **mis en attente** : la commande est suspendue et une vérification d'identité est demandée.` },
        { title: '5. Échange', md: `Sur sa propre liquidité ou en se couvrant auprès de partenaires (exchanges, DEX, teneurs de marché). Pour l'utilisateur, c'est invisible.` },
        { title: '6. Paiement', md: `Depuis le **hot wallet** du service sur la chaîne de destination, vers l'adresse de réception : montant = dépôt × taux − commission − frais de réseau. Certains services regroupent plusieurs paiements dans une même transaction.` },
        { title: '7. Balayage', md: `L'adresse de dépôt est vidée plus tard vers les portefeuilles centraux du service, souvent avec d'autres adresses de dépôt (ce qui permet de les attribuer par entrées communes).` },
        { title: '8. Échec ou remboursement', md: `Montant hors limites, délai dépassé, commande bloquée : les fonds repartent, moins des frais, vers l'**adresse de remboursement**, qui appartient en général à l'utilisateur lui-même.` },
      ],
    },
    {
      type: 'flow',
      caption: `Le lien entre l'entrée et la sortie n'existe pas sur la chaîne : il n'existe que dans la base de données du service, sous la forme d'une ligne de commande.`,
      nodes: [
        { id: 'u', label: 'Portefeuille du suspect', kind: 'suspect', sub: 'bc1q…m3wz' },
        { id: 'd', label: 'Adresse de dépôt', kind: 'deposit', sub: 'dédiée à la commande 7f3a…' },
        { id: 'hb', label: 'Portefeuille central BTC', kind: 'hot', sub: 'balayage groupé' },
        { id: 'db', label: 'Base de données', kind: 'service', sub: 'commande, IP, adresses' },
        { id: 'he', label: 'Hot wallet ETH', kind: 'hot', sub: '≈ 180 paiements / heure' },
        { id: 'dest', label: 'Adresse de réception', kind: 'wallet', sub: '0x2d9a…e410' },
        { id: 'ref', label: 'Adresse de remboursement', kind: 'wallet', sub: 'saisie par l’utilisateur' },
      ],
      edges: [
        { from: 'u', to: 'd', label: '0,8215 BTC · 14:02 UTC' },
        { from: 'd', to: 'hb', label: 'balayage 14:21 UTC' },
        { from: 'd', to: 'db', label: 'txid de dépôt', dashed: true },
        { from: 'db', to: 'he', label: 'ordre de paiement', dashed: true },
        { from: 'he', to: 'dest', label: '19,61 ETH · 14:17 UTC' },
        { from: 'db', to: 'ref', label: 'enregistrée, non utilisée', dashed: true },
      ],
    },
    {
      type: 'text',
      md: `Sur la chaîne, vous voyez deux mondes séparés : des dépôts qui arrivent sur des adresses éphémères puis sont balayés, et des paiements qui sortent d'un hot wallet très actif. Aucune transaction ne les relie. Mais **pour fonctionner**, le service doit savoir à qui payer quoi : chaque commande est une ligne qui associe le txid de dépôt à l'adresse de paiement. Cette ligne est l'objet de votre réquisition.`,
    },
    { type: 'heading', text: 'Ce que sait l’échangeur' },
    {
      type: 'table',
      caption: 'Données typiques d’une commande (variables selon les services) et leur intérêt',
      headers: ['Donnée', 'Intérêt pour l’enquête', 'Fiabilité'],
      rows: [
        ['Identifiant de commande, horodatages (création, dépôt, paiement)', 'Chronologie exacte, recoupement avec l’historique de navigation du suspect', 'Élevée'],
        ['Paire, montants, taux, commission', 'Valide ou invalide une corrélation', 'Élevée'],
        ['Adresse et txid de dépôt', 'Point d’entrée connu de l’enquêteur', 'Élevée'],
        ['Adresse et txid de paiement, memo ou tag', 'La suite du flux, sans incertitude', 'Élevée'],
        ['Adresse de remboursement', 'Souvent un portefeuille personnel du suspect, parfois un compte d’exchange', 'Élevée (saisie par l’utilisateur)'],
        ['Adresse IP, user agent, langue, référent', 'Identification technique, géolocalisation, appareil', 'Moyenne (VPN, Tor fréquents)'],
        ['Courriel facultatif, compte éventuel', 'Identification, autres commandes', 'Variable'],
        ['Identifiant du partenaire apporteur', 'Application ou site par lequel la commande est arrivée (portefeuille intégrant un module d’échange, site affilié)', 'Élevée'],
        ['Documents de vérification d’identité', 'Si une vérification a été déclenchée', 'Élevée'],
        ['Commandes liées (même IP, mêmes adresses, même courriel)', 'La « constellation » du suspect : volumes, période, autres flux', 'Élevée'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Demandez toujours les commandes liées',
      md: `Une réquisition qui ne vise que **la** commande connue obtient une ligne. Demandez aussi, sur une période définie, **toutes les commandes** partageant l'adresse IP, l'adresse de réception, l'adresse de remboursement, le courriel ou l'empreinte de navigateur. Il est fréquent qu'un suspect ait utilisé le même service des dizaines de fois : chaque commande liée est un nouveau flux, parfois une nouvelle victime.`,
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Le module d’échange intégré',
      md: `De nombreuses applications de portefeuille proposent un bouton « Échanger » qui s'appuie en réalité sur un ou plusieurs **fournisseurs tiers**. Pour la chaîne, la commande est passée chez ce fournisseur : c'est lui qui détient la ligne de commande, l'application ne conservant parfois qu'un identifiant. Identifiez le fournisseur par l'attribution de l'adresse de dépôt ou du hot wallet payeur, et par les artefacts de l'application sur les supports saisis.`,
    },
    { type: 'heading', text: 'Réquisitionner un échangeur' },
    {
      type: 'steps',
      items: [
        { title: 'Identifier le service', md: `Attribution de l'adresse de dépôt (balayée vers un cluster connu) ou du hot wallet payeur ; artefacts sur les supports (courriels de confirmation, historique de navigation, application).` },
        { title: 'Déterminer la voie', md: `Prestataire établi en France : réquisition (articles 60-1, 77-1-1 ou 99-3 du CPP selon le cadre). Établi dans l'Union : coopération volontaire, à défaut décision d'enquête européenne. Hors Union : coopération volontaire via le contact conformité, à défaut entraide pénale. Vérifier le statut réglementaire du service à la date de l'acte.` },
        { title: 'Fournir la clé d’entrée', md: `Le **txid de dépôt** et l'adresse de dépôt complète, la chaîne, le montant et l'horodatage UTC. Sans txid, le service cherche une aiguille ; avec, il retrouve la commande en secondes.` },
        { title: 'Demander large et précis', md: `Détails de la commande, adresses et txid de paiement et de remboursement, données techniques (IP, user agent, horodatages de connexion), courriel, partenaire apporteur, documents de vérification, commandes liées sur une période, **conservation** des données.` },
        { title: 'Signaler l’urgence', md: `Si la commande est encore en attente (confirmations, contrôle), un signalement immédiat peut parfois empêcher le paiement : le préciser. Les services ne gèlent généralement pas d'avoirs (ils n'en conservent pas), mais peuvent bloquer une commande en cours.` },
        { title: 'Exploiter la réponse', md: `Vérifier on-chain chaque txid communiqué ; tracer l'adresse de remboursement (souvent la plus révélatrice) ; recouper l'IP et les horodatages avec la téléphonie et les supports ; verser la réponse en procédure comme pièce.` },
      ],
    },
    {
      type: 'check',
      q: `Quel élément permet à un échangeur de retrouver le plus rapidement et sans ambiguïté la commande visée ?`,
      options: [
        `L'adresse de son hot wallet`,
        `Le nom présumé du suspect`,
        `Le txid de la transaction de dépôt, avec l'adresse de dépôt et l'horodatage`,
        `Le montant approximatif en euros`,
      ],
      answer: 2,
      explain: `L'adresse de dépôt est dédiée à la commande et le txid est unique : ils désignent une ligne précise de la base. Le hot wallet, lui, sert des milliers de clients.`,
    },
    { type: 'heading', text: 'La corrélation montant/temps et son taux d’erreur' },
    {
      type: 'text',
      md: `Quand la réponse tarde ou ne viendra jamais, la corrélation reste l'outil de travail. Rappel de la méthode : calculer le **montant attendu** (dépôt × cours de référence, moins une commission et des frais de réseau, soit une **fourchette**) ; définir une **fenêtre** de temps (de la confirmation du dépôt à quelques dizaines de minutes après) ; lister **toutes** les sorties du hot wallet de destination dans cette fenêtre ; compter les **candidats** compatibles.

La question que l'on oublie : **combien de candidats trouverait-on par pur hasard ?** Si le hot wallet effectue 240 paiements dans la fenêtre, et qu'en temps normal 0,5 % des paiements tombent dans une fourchette de cette largeur, on s'attend à **1,2 coïncidence** aléatoire. Un candidat unique est alors à peine plus probable qu'une coïncidence. Si le service n'effectue que 30 paiements dans la fenêtre et que la fourchette est étroite (0,1 %), on attend 0,03 coïncidence : le même candidat unique devient un indice fort.`,
    },
    {
      type: 'table',
      caption: 'Sources d’erreur de la corrélation et parades',
      headers: ['Facteur', 'Effet', 'Parade'],
      rows: [
        ['Hot wallet très actif', 'Faux positifs (un autre client reçoit un montant voisin)', 'Calculer le nombre de coïncidences attendues ; resserrer la fourchette avec le cours exact de la minute'],
        ['Taux flottant, forte volatilité', 'Fourchette élargie, plus de candidats', 'Utiliser le cours au moment de la confirmation ; tester plusieurs hypothèses de commission'],
        ['Commande mise en attente (contrôle, KYC)', 'Paiement des heures ou des jours plus tard : faux négatif', 'Élargir la fenêtre en cas d’absence de candidat ; ne pas conclure trop tôt'],
        ['Plusieurs hot wallets ou paiements groupés', 'Le bon paiement n’est pas dans la liste examinée', 'Identifier tous les payeurs du service sur la chaîne ; lire chaque sortie des transactions groupées'],
        ['Fractionnement par l’utilisateur', 'Plusieurs petites commandes au lieu d’une', 'Chercher des combinaisons dont la somme correspond, avec prudence (risque combinatoire)'],
        ['Montants ronds fréquents', 'Beaucoup de paiements identiques (1,00 ETH, 500 USDT)', 'Ne jamais s’appuyer sur un montant rond seul'],
      ],
    },
    {
      type: 'widget',
      id: 'timing-correlation',
      caption: `Faites varier la fenêtre et la tolérance : observez comment le nombre de candidats explose quand la fourchette s'élargit, et ce qu'un candidat unique vaut réellement.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Renforcer une corrélation',
      md: `Une corrélation isolée reste une **hypothèse**. Elle se renforce par : le **comportement aval** du candidat (adresse neuve, dépense rapide, schéma cohérent avec le reste du dossier) ; une **seconde corrélation** indépendante sur un autre saut (deux coïncidences successives sont beaucoup moins probables qu'une) ; un **artefact** sur les supports (identifiant de commande dans l'historique de navigation ou un courriel) ; et, idéalement, la **confirmation** par le service. Dans le rapport : nombre de candidats, coïncidences attendues, niveau de confiance, et lien en pointillé sur le graphe.`,
    },
    {
      type: 'check',
      q: `Dans une fenêtre de 50 minutes, le hot wallet ETH d'un échangeur a effectué 240 paiements. Environ 0,5 % des paiements tombent habituellement dans votre fourchette de montant. Vous trouvez un candidat unique. Que concluez-vous ?`,
      options: [
        `Le lien est établi avec certitude, puisqu'il n'y a qu'un candidat`,
        `Le lien est impossible`,
        `Il faut conclure que le suspect a utilisé Monero`,
        `Le lien est faible : on attend environ 1,2 coïncidence par hasard, il faut des éléments de renfort ou la confirmation du service`,
      ],
      answer: 3,
      explain: `240 × 0,005 = 1,2 coïncidence attendue. Un candidat unique n'est donc pas discriminant : il faut resserrer la fourchette, chercher des renforts ou obtenir la réponse du service.`,
    },
    { type: 'heading', text: '« Sans KYC » : slogans et réalité' },
    {
      type: 'compare',
      left: {
        title: 'Ce que promet la page d’accueil',
        md: `- « Aucune inscription, aucune pièce d'identité. »
- « Vos échanges restent privés. »
- « Nous ne conservons pas vos données. »`,
      },
      right: {
        title: 'Ce que disent souvent les conditions et la pratique',
        md: `- Le service se réserve le droit de **suspendre** une commande signalée et de demander une vérification d'identité.
- Les dépôts sont passés au crible d'outils d'analyse ; les adresses sanctionnées sont refusées.
- Des journaux techniques (IP, horodatages) sont conservés ; une politique de coopération avec les autorités est publiée.`,
      },
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Cadre réglementaire (à vérifier dans les textes en vigueur)',
      md: `L'échange de crypto-actifs contre d'autres crypto-actifs est un **service sur crypto-actifs** au sens du règlement MiCA : le proposer à des clients de l'Union suppose un agrément de **PSCA** (délivré par l'AMF en France), avec les obligations anti-blanchiment, la règle de voyage (règlement (UE) 2023/1113) et la coopération avec les autorités qui l'accompagnent. Un service non agréé qui démarche des clients français peut figurer sur les **listes noires de l'AMF**. Certains échangeurs ont fait l'objet de **sanctions** (États-Unis, Union européenne) ou de saisies : une exposition à ces services est un signal fort, à mentionner au rapport et, le cas échéant, à porter à la connaissance de TRACFIN par les canaux appropriés.`,
    },
    {
      type: 'table',
      caption: 'Adapter la stratégie au profil du service',
      headers: ['Profil', 'Exemple', 'Ce qu’on peut obtenir', 'Stratégie'],
      rows: [
        ['Coopératif, contact conformité identifié', 'ChangeNOW (peut communiquer les données d’une commande si on lui fournit le hash de dépôt)', 'Ligne de commande, données techniques, commandes liées', 'Réquisition ou demande de coopération rapide, avec txid'],
        ['Lent ou exigeant un instrument formel', 'Service établi dans un autre État membre', 'Données complètes après DEE', 'Demande de conservation immédiate, corrélation en attendant'],
        ['Fermé ou saisi', 'eXch (fermé en avril 2025, infrastructure saisie par les autorités allemandes)', 'Éventuellement des données via les autorités ayant saisi', 'Entraide, contact avec les autorités saisissantes, Europol'],
        ['Non coopératif, opaque', 'KestrelSwap (fictif) : accessible via Tor, accepte le XMR, aucune réponse', 'Rien directement', 'Corrélation, attribution des payeurs, artefacts côté suspect'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — l’adresse de remboursement',
      md: `Escroquerie au faux support technique. Le 3 février 2026 à 10:41 UTC, 0,5320 BTC de la victime sont déposés sur une adresse attribuée à un échangeur coopératif. Corrélation : 4 candidats dans la fenêtre (USDT-TRC20 entre 33 900 et 34 600). Faute de discrimination, une demande de coopération est adressée le jour même avec le txid de dépôt.

Réponse au bout de neuf jours :

- commande \`a91c…44e0\`, paire BTC → USDT-TRC20, paiement de 34 212 USDT à **TVj8…2Lqe** à 10:58 UTC (l'un des 4 candidats, qui n'était pas le mieux classé) ;
- adresse de remboursement : **bc1q…f0ud**, qui figure dans le cluster d'un portefeuille ayant reçu en 2025 trois retraits d'un exchange régulé français ;
- IP d'un fournisseur VPN, user agent d'un navigateur mobile en langue française ;
- **17 commandes liées** (même adresse de remboursement) entre novembre 2025 et février 2026, pour 6,9 BTC au total.

La réquisition à l'exchange français sur les retraits vers bc1q…f0ud identifie le titulaire. Les 17 commandes liées ouvrent autant de flux à tracer et permettent de rapprocher la procédure de quatre plaintes enregistrées dans d'autres départements.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — le service qui ne répond pas',
      md: `Les fonds d'un rançongiciel passent par KestrelSwap (fictif), qui ne répond à aucune sollicitation, en BTC → XMR. Côté chaîne, la piste s'arrête. L'enquête repart du côté du suspect : lors de la perquisition, l'historique du navigateur Tor n'est pas exploitable, mais un courriel de confirmation de commande, reçu sur une adresse jetable consultée depuis le téléphone, contient l'identifiant de commande et le montant exact. La commande n'est plus une corrélation : c'est une **constatation** rattachée au support du suspect.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Taux fixe / flottant', def: `Fixe : garanti pour une courte durée si le dépôt arrive à temps. Flottant : calculé à la réception, donc plus incertain pour une corrélation.` },
        { term: 'Adresse de dépôt dédiée', def: `Adresse générée pour une seule commande : elle désigne la commande sans ambiguïté.` },
        { term: 'Adresse de remboursement', def: `Adresse saisie par l'utilisateur pour récupérer ses fonds en cas d'échec ; souvent un portefeuille personnel.` },
        { term: 'Partenaire apporteur', def: `Application ou site qui a transmis la commande au service (module d'échange intégré, affilié) ; identifiant présent dans la commande.` },
        { term: 'Coïncidences attendues', def: `Nombre de paiements dans la fenêtre × probabilité qu'un paiement quelconque tombe dans la fourchette. Mesure le risque de faux positif.` },
        { term: 'Commande mise en attente', def: `Commande suspendue après un contrôle de risque, souvent avec demande de vérification d'identité : paiement retardé ou remboursement.` },
      ],
    },
    {
      type: 'check',
      q: `Pourquoi l'adresse de remboursement est-elle souvent la donnée la plus révélatrice d'une réponse d'échangeur ?`,
      options: [
        `Parce qu'elle est saisie par l'utilisateur pour récupérer ses propres fonds, et désigne donc fréquemment un portefeuille ou un compte qu'il contrôle`,
        `Parce qu'elle appartient au service`,
        `Parce qu'elle est toujours vide`,
        `Parce qu'elle contient l'adresse IP`,
      ],
      answer: 0,
      explain: `L'utilisateur y indique où il veut récupérer ses fonds en cas d'échec : il choisit naturellement une adresse à lui, souvent déjà liée à son historique.`,
    },
  ],
  keyPoints: [
    `Une commande = un devis, une adresse de dépôt dédiée, des contrôles, un échange, un paiement depuis le hot wallet, un balayage ; aucun lien on-chain entre entrée et sortie.`,
    `Le lien existe dans la base du service : identifiant, txid de dépôt et de paiement, adresses de réception et de remboursement, IP, user agent, partenaire, KYC éventuel.`,
    `Fournir le txid de dépôt ; demander aussi les commandes liées (IP, adresses, courriel) et la conservation des données.`,
    `Corrélation : fourchette, fenêtre, liste exhaustive, comptage ; estimer les coïncidences attendues (paiements dans la fenêtre × probabilité de tomber dans la fourchette).`,
    `Faux négatifs fréquents : commandes mises en attente, paiements groupés, plusieurs hot wallets, fractionnement.`,
    `« Sans KYC » n'exclut ni contrôles, ni suspensions, ni journaux ; l'échange crypto-crypto est un service MiCA soumis à agrément PSCA.`,
    `Service non coopératif : corrélation renforcée, attribution des payeurs, et surtout artefacts côté suspect (courriels, historique, identifiants de commande).`,
  ],
  quiz: [
    {
      kind: 'multi',
      q: `Quelles données un échangeur instantané détient-il typiquement sur une commande ? (plusieurs réponses)`,
      options: [
        `L'adresse et le txid de paiement`,
        `La clé privée du portefeuille de l'utilisateur`,
        `L'adresse de remboursement saisie par l'utilisateur`,
        `L'adresse IP et le user agent de création de la commande`,
      ],
      answer: [0, 2, 3],
      explain: `Le service ne connaît jamais la clé privée de l'utilisateur. Il connaît en revanche tout ce qui lui a été saisi ou transmis pour exécuter la commande.`,
    },
    {
      q: `Pourquoi aucune transaction ne relie-t-elle le dépôt d'un client au paiement qu'il reçoit ?`,
      options: [
        `Parce que le service utilise un CoinJoin`,
        `Parce que la blockchain efface les transactions des échangeurs`,
        `Parce que le dépôt est toujours en Monero`,
        `Parce que le paiement part du hot wallet du service sur la chaîne de destination, alimenté par d'autres fonds : le lien n'existe que dans sa base de données`,
      ],
      answer: 3,
      explain: `Entrée et sortie sont deux opérations distinctes sur deux chaînes, reliées seulement par la ligne de commande.`,
    },
    {
      q: `Un hot wallet effectue 30 paiements dans la fenêtre ; 0,1 % des paiements tombent dans votre fourchette. Combien de coïncidences aléatoires attendez-vous ?`,
      options: ['3', '0,3', '0,03', '30'],
      answer: 2,
      explain: `30 × 0,001 = 0,03. Un candidat unique est alors un indice fort, à présenter avec son niveau de confiance et à faire confirmer.`,
    },
    {
      kind: 'truefalse',
      q: `L'absence de candidat dans la fenêtre habituelle prouve que les fonds n'ont pas été échangés par ce service.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Une commande mise en attente pour contrôle, un paiement groupé ou un autre hot wallet produisent des faux négatifs. Il faut élargir la fenêtre et vérifier tous les payeurs.`,
    },
    {
      kind: 'multi',
      q: `Comment renforcer une corrélation montant/temps avant de la présenter ? (plusieurs réponses)`,
      options: [
        `Analyser le comportement aval du candidat`,
        `Obtenir une seconde corrélation indépendante sur un autre saut`,
        `Retrouver l'identifiant de commande dans les supports du suspect`,
        `Arrondir les montants pour obtenir plus de candidats`,
      ],
      answer: [0, 1, 2],
      explain: `Comportement aval, corrélations successives et artefacts renforcent l'hypothèse. Élargir artificiellement la fourchette augmente au contraire le risque de faux positif.`,
    },
    {
      q: `Un service proposant l'échange de crypto-actifs contre d'autres crypto-actifs à des clients français :`,
      options: [
        `Relève des services sur crypto-actifs de MiCA et doit, en principe, être agréé comme PSCA, avec les obligations anti-blanchiment correspondantes`,
        `N'a aucune obligation, puisqu'il ne touche pas de monnaie légale`,
        `Doit seulement déclarer son activité à la CNIL`,
        `Est automatiquement sanctionné par l'OFAC`,
      ],
      answer: 0,
      explain: `L'échange crypto-crypto fait partie des services sur crypto-actifs ; le statut exact du service se vérifie sur les listes de l'AMF et le registre de l'ESMA.`,
    },
    {
      kind: 'truefalse',
      q: `Dans une demande à un échangeur, il est utile de demander toutes les commandes partageant la même adresse de remboursement ou la même IP sur une période.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Les commandes liées révèlent l'ampleur de l'activité, d'autres flux et parfois d'autres victimes.`,
    },
  ],
  flashcards: [
    { front: 'Cycle d’une commande', back: `Devis → adresse de dépôt dédiée → confirmations et contrôles → échange → paiement depuis le hot wallet → balayage (ou remboursement).` },
    { front: 'Clé d’entrée d’une réquisition d’échangeur', back: `Txid de dépôt + adresse de dépôt + horodatage UTC + montant + chaîne.` },
    { front: 'Adresse de remboursement', back: `Saisie par l'utilisateur : souvent son propre portefeuille ou compte. À tracer en priorité.` },
    { front: 'Commandes liées', back: `Même IP, mêmes adresses, même courriel : à demander systématiquement sur une période.` },
    { front: 'Coïncidences attendues', back: `Paiements dans la fenêtre × probabilité de tomber dans la fourchette. Proche de 1 = candidat unique peu probant.` },
    { front: 'Faux négatifs de corrélation', back: `Commande mise en attente, paiements groupés, autres hot wallets, fractionnement.` },
    { front: 'Module d’échange intégré', back: `Bouton « Échanger » d'une application : la commande est chez un fournisseur tiers, à identifier.` },
    { front: '« Sans KYC »', back: `N'exclut pas : contrôle des dépôts, suspension, demande de vérification, journaux techniques.` },
    { front: 'MiCA et échangeurs', back: `Échange crypto-crypto = service sur crypto-actifs : agrément PSCA (AMF en France) pour servir l'UE.` },
    { front: 'Service non coopératif', back: `Corrélation renforcée + attribution des payeurs + artefacts côté suspect (courriels, historique, identifiants).` },
  ],
}
