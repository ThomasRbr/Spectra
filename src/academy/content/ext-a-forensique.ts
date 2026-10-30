// Niveau 3 — Enquête : forensique des supports (téléphones, ordinateurs,
// extensions, portefeuilles matériels) appliquée aux crypto-actifs.
// Les références juridiques doivent toujours être vérifiées dans les textes en vigueur.
import type { Lesson } from '../model'

export const LESSON_FORENSIQUE_SUPPORTS: Lesson = {
  id: 'forensique-supports',
  title: 'Forensique des supports : téléphones, ordinateurs, extensions',
  level: 3,
  track: 'enquete',
  minutes: 40,
  summary: `La blockchain ne dit pas qui détient une clé ; les supports du suspect, si. Où se cachent les preuves crypto (applications mobiles, extensions comme MetaMask ou Phantom, logiciels Electrum, Sparrow, Exodus, applications compagnons de portefeuilles matériels, double authentification, gestionnaires de mots de passe, photos de seed, presse-papiers, messageries), ce qu'une extraction peut livrer, comment saisir sans perdre les données ni les fonds, et comment travailler avec les spécialistes dans un cadre procédural solide.`,
  objectives: [
    `Cartographier les emplacements où un suspect conserve adresses, historiques, xpub, seeds et coffres chiffrés, sur mobile comme sur ordinateur.`,
    `Savoir ce qu'une extraction peut et ne peut pas livrer, et formuler une demande d'exploitation ciblée aux spécialistes.`,
    `Conduire la phase de saisie sans perte : isolement radio, appareils allumés, portefeuilles matériels, course contre l'effacement et contre les complices.`,
    `Préserver la chaîne de preuve : copies, empreintes, scellés, traçabilité des accès.`,
    `Transformer les artefacts trouvés en actes d'enquête : dérivations, réquisitions, gels, saisies.`,
  ],
  prerequisites: ['portefeuilles-hd', 'opsec-enqueteur', 'requisitions', 'gel-saisie'],
  practice: ['ledger-phishing', 'darknet-vendor'],
  blocks: [
    {
      type: 'text',
      md: `Un suspect peut utiliser des adresses neuves, des échangeurs, des ponts entre chaînes : sur la blockchain, il reste un pseudonyme. Mais pour dépenser, il lui faut des **clés**, et pour s'en servir, des **outils** : une application, une extension, un logiciel, un carnet. Chacun laisse des traces sur ses supports.

L'exploitation des supports est souvent l'acte qui fait basculer une enquête crypto : elle transforme des inférences (« ce cluster appartient probablement au suspect ») en constatations (« l'extension MetaMask de son ordinateur contrôle cette adresse »), elle révèle les plateformes utilisées, et elle peut donner accès aux fonds eux-mêmes. À condition de **ne rien perdre** au moment de la saisie, et de **ne rien abîmer** ensuite.`,
    },
    { type: 'heading', text: 'Cartographie : où vivent les preuves crypto' },
    {
      type: 'table',
      caption: 'Les principaux gisements et ce qu’ils contiennent',
      headers: ['Support', 'Ce qu’on peut y trouver', 'Forme', 'Point d’attention'],
      rows: [
        ['Portefeuille mobile (Trust Wallet, MetaMask, Exodus, Phantom, TronLink…)', 'Adresses, soldes en cache, historique, réseaux ajoutés, seed chiffrée', 'Base de données de l’application, trousseau du système', 'Extraction complète du système de fichiers nécessaire, souvent appareil déverrouillé'],
        ['Extension de navigateur (MetaMask, Phantom, Rabby…)', 'Adresses, comptes importés, sites connectés, coffre (vault) chiffré contenant la seed', 'Stockage local de l’extension dans le profil du navigateur', 'Le coffre ne s’ouvre qu’avec le mot de passe de l’extension'],
        ['Logiciel de bureau (Electrum, Sparrow, Exodus, Bitcoin Core)', 'xpub, descripteurs, étiquettes, UTXO, historique, seed ou clés chiffrées', 'Fichiers de portefeuille dans le dossier de l’application', 'Selon les options, tout le fichier ou seulement les secrets sont chiffrés'],
        ['Application compagnon d’un portefeuille matériel (Ledger Live, Trezor Suite…)', 'Liste des comptes, xpub, historique, étiquettes', 'Cache local de l’application', 'Aucune clé privée : celles-ci restent dans l’appareil'],
        ['Portefeuille matériel', 'Les clés privées (inaccessibles sans PIN), modèle, éventuel portefeuille caché', 'Puce sécurisée', 'Effacement après quelques PIN erronés (trois sur certains modèles)'],
        ['Applications d’exchanges', 'Identifiant de compte, courriel, historique, adresses de dépôt, jetons de session', 'Données d’application, notifications', 'Révèle les prestataires à réquisitionner'],
        ['Double authentification (TOTP)', 'La liste des comptes protégés : exchanges, messageries, courriels', 'Application d’authentification, sauvegarde cloud éventuelle', 'Une entrée = un compte à identifier'],
        ['Gestionnaires de mots de passe, notes, photos', 'Seeds, phrases de passe, mots de passe de coffres, captures d’écran', 'Coffre chiffré, notes, galerie, cloud', 'OCR des images, recherche de mots BIP39'],
        ['Messageries (Telegram, WhatsApp, Signal…)', 'Adresses échangées, négociations OTC, preuves de paiement, bots de portefeuille', 'Bases de messages, médias', 'Contexte et contreparties ; groupes « cash contre USDT »'],
        ['Navigateur et courriels', 'Recherches d’adresses sur explorateurs, sites d’échangeurs, confirmations de dépôt et de retrait, KYC', 'Historique, cache, boîte aux lettres', 'Les courriels d’exchanges sont une mine de références'],
      ],
    },
    {
      type: 'text',
      md: `**Sur mobile**, les applications de portefeuille stockent leurs données dans un espace protégé, et les secrets dans le trousseau du système. Une extraction « logique » simple (sauvegarde) en livre peu ; une extraction **complète du système de fichiers**, réalisée par les spécialistes avec les outils du marché, livre bases de données, préférences, caches et parfois les secrets eux-mêmes. Le résultat dépend du modèle, de la version du système et surtout de **l'état de l'appareil** au moment de la saisie.

**Sur ordinateur**, la richesse est souvent plus grande : profils de navigateur avec leurs extensions, dossiers d'applications (\`%APPDATA%\` sous Windows, dossiers cachés sous Linux et macOS), fichiers \`wallet.dat\`, exports CSV de transactions pour la fiscalité, captures d'écran, documents.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'L’état de l’appareil vaut de l’or',
      md: `Un téléphone **allumé et déjà déverrouillé une fois depuis son démarrage** (état dit « AFU », *after first unlock*) garde une grande partie de ses données déchiffrées en mémoire ; éteint ou redémarré (« BFU », *before first unlock*), il redevient une boîte presque close. Donc : **ne pas éteindre**, isoler du réseau (sac de Faraday, mode avion si l'appareil est déjà déverrouillé), maintenir l'alimentation, remettre l'appareil **rapidement** aux spécialistes. Les versions récentes des systèmes mobiles redémarrent automatiquement un appareil resté verrouillé plusieurs jours : le délai joue contre vous.`,
    },
    { type: 'heading', text: 'Extensions et logiciels de bureau : ce qui est en clair, ce qui est chiffré' },
    {
      type: 'table',
      caption: 'Emplacements typiques (à confirmer selon le système et la version ; les spécialistes disposent des références à jour)',
      headers: ['Logiciel', 'Emplacement typique', 'Souvent lisible sans mot de passe', 'Protégé par le mot de passe'],
      rows: [
        ['MetaMask (extension Chromium)', 'Profil du navigateur, `Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn`', 'Adresses des comptes, réseaux ajoutés, éléments d’historique et de préférences', 'Le coffre (vault) contenant la seed et les clés importées'],
        ['Phantom (extension)', 'Stockage local de l’extension dans le profil', 'Adresses Solana et EVM, préférences', 'Le coffre contenant la seed'],
        ['Electrum', '`%APPDATA%\\Electrum\\wallets` (Windows), `~/.electrum/wallets` (Linux)', 'Si le fichier n’est pas chiffré : xpub, adresses, étiquettes, historique', 'Seed et clés privées ; ou tout le fichier si l’option de chiffrement complet est active'],
        ['Sparrow', 'Dossier `wallets` de l’application', 'Rarement : les portefeuilles protégés sont chiffrés', 'Descripteurs, étiquettes, UTXO, historique'],
        ['Exodus', '`%APPDATA%\\Exodus\\exodus.wallet` (Windows)', 'Peu de choses', 'Seed (fichier chiffré) et données des actifs'],
        ['Bitcoin Core', 'Sous-dossier `wallets` du répertoire de données', 'Descripteurs ou clés publiques, transactions', 'Clés privées si le portefeuille est chiffré'],
        ['Ledger Live / Trezor Suite', 'Dossier de l’application', 'Comptes suivis, xpub, historique, étiquettes (selon réglages)', 'Aucune clé privée stockée sur l’ordinateur'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Un coffre chiffré n’est pas une impasse',
      md: `Même sans mot de passe, la partie lisible d'une extension ou d'un fichier de portefeuille donne souvent les **adresses** : c'est déjà la preuve que ce poste les utilisait, et le point d'entrée d'un traçage. Pour le coffre lui-même, les spécialistes peuvent tenter une attaque par dictionnaire nourrie des mots de passe trouvés ailleurs (navigateur, gestionnaire, notes, autres supports) : la **réutilisation** de mots de passe est la règle chez beaucoup de suspects. Pensez à transmettre tous les mots de passe découverts dans le dossier.`,
    },
    {
      type: 'widget',
      id: 'address-anatomy',
      caption: `Dans une extraction, des milliers de chaînes de caractères : reconnaître au premier coup d'œil une adresse Bitcoin, Ethereum ou Tron permet de trier les artefacts.`,
    },
    { type: 'heading', text: 'Chercher les traces : motifs et indices' },
    {
      type: 'table',
      caption: 'Motifs de recherche utiles dans une extraction (expressions régulières indicatives, à adapter à l’outil)',
      headers: ['Élément', 'Motif indicatif', 'Remarque'],
      rows: [
        ['Adresse Bitcoin SegWit / Taproot', '`bc1[02-9ac-hj-np-z]{38,59}`', 'Jeu de caractères bech32 (ni 1, b, i, o après le préfixe)'],
        ['Adresse Bitcoin historique / P2SH', '`[13][a-km-zA-HJ-NP-Z1-9]{25,34}`', 'Nombreux faux positifs : vérifier la somme de contrôle'],
        ['Adresse EVM', '`0x[a-fA-F0-9]{40}`', 'Borner le motif : 64 caractères hexadécimaux = hash de transaction, pas une adresse'],
        ['Adresse Tron', '`T[1-9A-HJ-NP-Za-km-z]{33}`', 'Très présente dans les échanges « cash contre USDT »'],
        ['Clé publique étendue', '`[xyzXYZ]pub[1-9A-HJ-NP-Za-km-z]{107}`', '111 caractères au total ; tpub/upub/vpub pour le testnet'],
        ['Clé privée étendue', '`[xyz]prv[1-9A-HJ-NP-Za-km-z]{107}`', 'Secret : donne le contrôle des fonds du compte'],
        ['Clé privée WIF', '`[5KL][1-9A-HJ-NP-Za-km-z]{50,51}`', 'Secret : contrôle d’une adresse'],
        ['Phrase de récupération', 'Suites de 12 à 24 mots de la liste BIP39', 'Outils de recherche dédiés ; OCR sur photos et captures'],
      ],
    },
    {
      type: 'text',
      md: `Au-delà des motifs, certains artefacts ont une valeur particulière :

- **L'application de double authentification** : chaque entrée (« Binance : j.d…@… », « Kraken », « Huobex ») désigne un compte, donc un prestataire à réquisitionner. C'est souvent la carte la plus complète des plateformes utilisées.
- **L'historique de navigation** : lorsqu'un suspect consulte une adresse sur un explorateur, **l'adresse figure dans l'URL**. Des consultations répétées de la même adresse, ou d'une transaction précise juste après un fait, sont un indice fort de contrôle.
- **Les courriels** : confirmations de dépôt et de retrait, alertes de connexion, demandes de vérification d'identité, reçus d'échangeurs avec numéro de commande.
- **Le presse-papiers** : historiques de presse-papiers du système ou du clavier mobile, qui peuvent conserver des adresses copiées (et révéler un empoisonnement d'adresse côté victime).
- **Les photos** : seed recopiée ou photographiée, QR codes d'adresses, écrans de portefeuille montrant soldes et adresses, reçus de distributeurs crypto.
- **Les sauvegardes cloud** : trousseau, notes, photos et sauvegardes d'applications synchronisés chez un fournisseur ; elles peuvent survivre à la destruction de l'appareil.`,
    },
    {
      type: 'check',
      q: `Quel artefact donne généralement la liste la plus complète des plateformes utilisées par un suspect ?`,
      options: [
        `Le fond d'écran du téléphone`,
        `Les entrées de son application de double authentification`,
        `La liste des réseaux Wi-Fi connus`,
        `Le nombre de photos de la galerie`,
      ],
      answer: 1,
      explain: `Chaque compte sensible (exchange, courriel, messagerie) est en général protégé par un code TOTP : la liste des entrées est une carte des comptes à réquisitionner.`,
    },
    { type: 'heading', text: 'La saisie : une course contre l’effacement et contre les complices' },
    {
      type: 'flow',
      caption: `Au moment de l'interpellation, deux menaces simultanées : l'effacement à distance de l'appareil et la vidange des fonds par quiconque détient une copie de la seed.`,
      nodes: [
        { id: 'tel', label: 'Téléphone saisi', kind: 'wallet', sub: 'allumé, état AFU' },
        { id: 'cloud', label: 'Service de localisation', kind: 'service', sub: 'effacement à distance' },
        { id: 'far', label: 'Sac de Faraday', kind: 'tx', sub: 'isolement radio' },
        { id: 'comp', label: 'Complice', kind: 'suspect', sub: 'copie de la seed' },
        { id: 'addr', label: 'Adresses du suspect', kind: 'wallet', sub: '1,6 BTC + 22 000 USDT' },
        { id: 'sw', label: 'Échangeur instantané', kind: 'service', sub: 'sortie rapide' },
        { id: 'veil', label: 'Surveillance on-chain', kind: 'service', sub: 'alertes en temps réel' },
        { id: 'gel', label: 'Émetteur / exchange', kind: 'exchange', sub: 'gel demandé' },
      ],
      edges: [
        { from: 'cloud', to: 'tel', label: 'ordre d’effacement', dashed: true },
        { from: 'far', to: 'tel', label: 'bloque les ordres' },
        { from: 'comp', to: 'addr', label: 'restaure la seed' },
        { from: 'addr', to: 'sw', label: 'vidange possible en minutes', dashed: true },
        { from: 'veil', to: 'addr', label: 'détecte le mouvement' },
        { from: 'veil', to: 'gel', label: 'demande immédiate' },
      ],
    },
    {
      type: 'steps',
      items: [
        { title: 'Avant l’intervention', md: `Lister les adresses connues et les mettre sous surveillance ; préparer les demandes de gel (émetteurs de stablecoins, exchanges identifiés) ; prévoir sacs de Faraday, batteries externes, câbles, et un spécialiste présent ou joignable ; arrêter avec le magistrat la conduite à tenir si des fonds sont accessibles.` },
        { title: 'Figer la scène', md: `Photographier les écrans **tels qu'ils sont** avant toute manipulation : un portefeuille ouvert, une extension déverrouillée, un solde affiché sont des constatations précieuses. Ne pas fermer d'application, ne pas verrouiller.` },
        { title: 'Isoler sans éteindre', md: `Téléphones en sac de Faraday et sous alimentation ; ordinateurs allumés laissés allumés en attendant le spécialiste (une acquisition de la mémoire vive peut capturer des clés et des mots de passe), débranchés du réseau si la décision est prise.` },
        { title: 'Portefeuilles matériels', md: `Ne **jamais** tenter de code PIN au hasard : quelques erreurs suffisent à effacer l'appareil. Saisir l'appareil, son câble, son étui, et chercher la seed de secours à proximité (carnet, plaque, coffre).` },
        { title: 'Supports papier et métal', md: `Seeds, plaques gravées, QR codes, codes PIN griffonnés : photographier en place, placer sous scellé, consigner l'emplacement exact. Ces éléments peuvent appartenir à plusieurs portefeuilles.` },
        { title: 'Réagir aux mouvements', md: `Si la surveillance signale un mouvement pendant l'opération, c'est qu'une autre personne détient les clés : demande de gel immédiate au prochain point de contrôle (émetteur, exchange) et information du magistrat.` },
        { title: 'Ne rien connecter', md: `Aucun appareil saisi ne doit être reconnecté à Internet pour « voir » : synchronisation, effacement, alerte au suspect, modification des données. La consultation des soldes se fait à partir des adresses, via les outils du service.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le réflexe qui détruit la preuve',
      md: `Ouvrir l'application de portefeuille du téléphone saisi « pour voir le solde » : l'application se synchronise, modifie ses bases, peut déclencher une notification chez un complice, et votre manipulation devient une altération de la preuve que la défense exploitera. Le solde se lit **sur la blockchain**, à partir des adresses relevées.`,
    },
    { type: 'heading', text: 'Cadre légal et chaîne de preuve' },
    {
      type: 'callout',
      kind: 'law',
      title: 'Repères (à vérifier dans les textes en vigueur)',
      md: `- **Perquisitions et saisies** : selon le cadre, articles 56 et suivants (flagrance), 76 (préliminaire, avec assentiment ou autorisation du juge des libertés et de la détention dans les cas prévus), 92 et suivants (instruction) du CPP. Les données peuvent être saisies par la saisie du support ou par copie, dans les formes prévues.
- **Données accessibles à distance** : l'article 57-1 du CPP encadre l'accès, au cours d'une perquisition, à des données stockées dans un autre système mais accessibles depuis le système initial (cloud, messagerie en ligne) : vérifier les conditions, notamment si les données sont stockées à l'étranger.
- **Examens techniques** : réquisitions à personne qualifiée (articles 60 et 77-1) ou expertise ; la mise au clair de données chiffrées relève notamment des articles 230-1 et suivants.
- **Codes et conventions de déchiffrement** : le refus de les remettre est réprimé par l'article 434-15-2 du code pénal, dans les conditions dégagées par la jurisprudence (Cass. ass. plén., 7 novembre 2022, pour le code d'un téléphone) ; son application à un code de portefeuille se discute avec le parquet.

Les modalités évoluent : faites valider la stratégie par le magistrat et appuyez-vous sur les spécialistes de votre chaîne.`,
    },
    {
      type: 'table',
      caption: 'Chaîne de preuve d’un support numérique',
      headers: ['Étape', 'Exigence', 'Trace à produire'],
      rows: [
        ['Découverte', 'Photographie en place, description, état (allumé, verrouillé, AFU/BFU)', 'Procès-verbal de perquisition, photos'],
        ['Saisie', 'Scellé identifiant le support (marque, modèle, numéro de série, IMEI)', 'Scellé numéroté, inventaire'],
        ['Acquisition', 'Copie par les spécialistes, bloqueur d’écriture pour les disques, outils et versions consignés', 'Rapport d’acquisition, empreintes (SHA-256) de l’image'],
        ['Exploitation', 'Sur la copie, jamais sur l’original ; requêtes et filtres documentés', 'Rapport d’exploitation, liste des artefacts et de leur chemin'],
        ['Usage d’un secret', 'Seed ou clé utilisée seulement selon le protocole de saisie, sur instruction', 'Procès-verbal de saisie des actifs, txid'],
        ['Restitution ou conservation', 'Réintégration sous scellé, accès tracés', 'Mentions de bris et de reconstitution de scellés'],
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'L’enquêteur crypto',
        md: `- Dit **quoi chercher** : adresses du dossier, plateformes suspectées, logiciels probables, mots-clés (pseudonymes, noms de bots, d'OTC).
- Interprète les artefacts : type d'adresse, chemin de dérivation, xpub, cohérence avec le graphe.
- Transforme en actes : traçage, réquisitions, gels, saisie des actifs.`,
      },
      right: {
        title: 'Le spécialiste forensique',
        md: `- Réalise les **acquisitions** (mobile, disque, mémoire vive) avec des outils maîtrisés et documentés.
- Tente l'ouverture des coffres chiffrés, extrait les bases d'applications.
- Garantit l'intégrité (empreintes, copies) et rédige le rapport technique.`,
      },
    },
    {
      type: 'text',
      md: `La qualité de l'exploitation dépend directement de la **demande** que vous formulez. « Exploiter le téléphone » produit un rapport de 4 000 pages ; « rechercher toute adresse Tron et Ethereum, toute xpub, toute phrase de récupération, les applications de portefeuille et d'exchange installées, les entrées de double authentification, et les conversations Telegram contenant les mots *USDT*, *cash*, *OTC* ou l'adresse \`TQ7f…9mXa\` » produit une réponse exploitable.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — de l’extraction aux réquisitions',
      md: `Escroquerie aux faux placements, 41 victimes. Interpellation du suspect principal le 9 avril 2026 à 6 h 05. Son iPhone, déverrouillé à l'arrivée des enquêteurs, est placé en sac de Faraday sous batterie externe et remis au spécialiste dans l'heure ; son ordinateur portable allumé fait l'objet d'une acquisition de la mémoire vive sur place.

Résultats de l'exploitation, dix jours plus tard :

- extension MetaMask : 3 comptes, dont **0x5c9e…a07d**, déjà identifié comme collecteur de 17 victimes ; le coffre est ouvert grâce à un mot de passe retrouvé dans le gestionnaire du navigateur ;
- application d'authentification : entrées « Binance », « OKX », « Huobex » et une messagerie chiffrée ;
- Telegram : 63 messages avec un contact présenté comme « SatsDesk », négociant des remises d'espèces contre USDT-TRC20, avec 11 adresses Tron ;
- galerie : une photo de 24 mots, retrouvée par OCR, qui restaure un portefeuille Tron contenant **38 400 USDT**.

Suites : saisie des USDT selon le protocole (après approvisionnement en TRX documenté), réquisitions à Binance et OKX, demande de coopération à Huobex, traçage des 11 adresses Tron. Le rapport rattache désormais le collecteur au suspect par une **constatation** et non plus par une inférence.`,
    },
    {
      type: 'check',
      q: `À l'interpellation, le téléphone du suspect est allumé et déverrouillé. Quelle est la bonne conduite ?`,
      options: [
        `L'éteindre immédiatement pour éviter un effacement`,
        `Ouvrir l'application de portefeuille pour relever le solde`,
        `Le laisser allumé, photographier l'écran, l'isoler du réseau sous alimentation et le remettre rapidement aux spécialistes`,
        `Le connecter au Wi-Fi du service pour lancer une sauvegarde`,
      ],
      answer: 2,
      explain: `Éteindre ferait perdre l'état AFU ; ouvrir l'application ou reconnecter l'appareil altère les données et peut alerter. On fige, on isole, on alimente, on transmet.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Les indices matériels à ne pas négliger',
      md: `Factures ou emballages de portefeuilles matériels (qui indiquent un appareil peut-être caché ailleurs), cartes de récupération vierges ou remplies, plaques métalliques, poinçons à lettres, coffres-forts, clés USB étiquetées, reçus de distributeurs crypto, courriers d'exchanges, cahiers de comptes « en USDT ». Un emballage de portefeuille matériel sans l'appareil correspondant doit déclencher une recherche ciblée.`,
    },
    {
      type: 'check',
      q: `Le fichier Electrum d'un ordinateur saisi n'est pas chiffré, mais la seed qu'il contient l'est. Que pouvez-vous exploiter sans mot de passe ?`,
      options: [
        `Rien du tout`,
        `La xpub, les adresses, les étiquettes et l'historique, qui permettent un traçage complet du portefeuille`,
        `Uniquement la date d'installation du logiciel`,
        `Les clés privées, qui ne sont jamais chiffrées`,
      ],
      answer: 1,
      explain: `Lorsque seul le secret est chiffré, la partie publique (xpub, adresses, étiquettes, transactions) reste lisible : elle suffit à établir le périmètre du portefeuille et à tracer.`,
    },
  ],
  keyPoints: [
    `Les supports livrent ce que la chaîne tait : quelles adresses un poste contrôle, quelles plateformes sont utilisées, et parfois les secrets.`,
    `Gisements : portefeuilles mobiles, extensions (coffres chiffrés), logiciels de bureau (xpub, étiquettes), applications compagnons, double authentification, gestionnaires, photos, messageries, navigateur, courriels, cloud.`,
    `Un coffre chiffré laisse souvent les adresses lisibles ; la réutilisation de mots de passe ouvre beaucoup de coffres.`,
    `À la saisie : photographier en place, ne pas éteindre, isoler sous alimentation, ne jamais tenter de PIN, ne rien reconnecter, surveiller les adresses.`,
    `Un mouvement pendant l'opération signale un complice détenant la seed : gel immédiat au prochain point de contrôle.`,
    `Chaîne de preuve : scellés, acquisition par les spécialistes, empreintes, exploitation sur copie, usage d'un secret seulement selon le protocole de saisie.`,
    `Une demande d'exploitation ciblée (adresses, motifs, logiciels, mots-clés) vaut mieux qu'une extraction exhaustive non orientée.`,
  ],
  quiz: [
    {
      q: `Pourquoi ne faut-il pas éteindre un téléphone saisi allumé et déjà déverrouillé depuis son démarrage ?`,
      options: [
        `Parce qu'il pourrait surchauffer`,
        `Parce qu'il passerait d'un état où beaucoup de données sont déchiffrées (AFU) à un état presque fermé (BFU)`,
        `Parce que la loi interdit d'éteindre un appareil saisi`,
        `Parce que la blockchain détecterait l'extinction`,
      ],
      answer: 1,
      explain: `L'état AFU conserve des clés de chiffrement en mémoire ; un redémarrage les efface et réduit fortement ce qu'une extraction peut obtenir.`,
    },
    {
      kind: 'multi',
      q: `Que peut-on souvent lire dans une extension MetaMask sans connaître son mot de passe ? (plusieurs réponses)`,
      options: [
        `Les adresses des comptes`,
        `Les réseaux ajoutés et des éléments de préférences`,
        `La phrase de récupération en clair`,
        `Des éléments d'historique ou de sites connectés`,
      ],
      answer: [0, 1, 3],
      explain: `La seed et les clés importées sont dans le coffre chiffré par le mot de passe ; les métadonnées comme les adresses et les réseaux sont souvent lisibles.`,
    },
    {
      kind: 'truefalse',
      q: `L'application compagnon d'un portefeuille matériel installée sur l'ordinateur contient les clés privées du suspect.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Les clés restent dans l'appareil. L'application conserve en revanche la liste des comptes, les xpub et l'historique, très utiles pour le traçage.`,
    },
    {
      q: `Pendant la perquisition, la surveillance signale qu'une adresse du suspect vient d'envoyer 22 000 USDT. Que cela signifie-t-il, et que faire ?`,
      options: [
        `Un bug de l'explorateur : l'ignorer`,
        `Le suspect a programmé un envoi : attendre la fin de la perquisition`,
        `Les fonds sont perdus : ne rien faire`,
        `Une autre personne détient les clés : demander immédiatement un gel au prochain point de contrôle et informer le magistrat`,
      ],
      answer: 3,
      explain: `Si les supports du suspect sont sous contrôle, un mouvement révèle une copie des clés ailleurs. Le gel (émetteur, exchange) est l'action utile immédiate.`,
    },
    {
      kind: 'multi',
      q: `Quels gestes sont proscrits au moment de la saisie ? (plusieurs réponses)`,
      options: [
        `Tenter des codes PIN sur un portefeuille matériel`,
        `Reconnecter le téléphone saisi à Internet pour synchroniser le portefeuille`,
        `Photographier l'écran d'un portefeuille ouvert avant toute manipulation`,
        `Ouvrir l'application de portefeuille pour consulter le solde`,
      ],
      answer: [0, 1, 3],
      explain: `Photographier l'état initial est recommandé. Les trois autres gestes risquent l'effacement, l'altération des données ou l'alerte d'un complice.`,
    },
    {
      q: `Dans l'historique de navigation du suspect, vous trouvez 14 consultations sur un explorateur d'une adresse collectrice du dossier. Quelle est la valeur de cet élément ?`,
      options: [
        `Aucune : n'importe qui peut consulter un explorateur`,
        `Une preuve suffisante de propriété à elle seule`,
        `Un indice fort d'intérêt et de contrôle, à combiner avec d'autres éléments`,
        `Une preuve que l'adresse appartient à l'explorateur`,
      ],
      answer: 2,
      explain: `L'adresse figure dans l'URL consultée ; la répétition et la chronologie en font un indice sérieux, qui se combine avec les artefacts de portefeuille ou les réquisitions.`,
    },
    {
      kind: 'truefalse',
      q: `L'exploitation d'un support saisi doit se faire sur une copie dont l'empreinte a été calculée, et non sur l'original.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `La copie empreintée garantit l'intégrité et permet à un tiers de vérifier que l'original n'a pas été modifié.`,
    },
  ],
  flashcards: [
    { front: 'AFU / BFU', back: `Après / avant le premier déverrouillage depuis le démarrage. AFU = beaucoup de données accessibles : ne pas éteindre.` },
    { front: 'Coffre (vault) MetaMask', back: `Seed et clés importées chiffrées par le mot de passe ; adresses et réseaux souvent lisibles à côté.` },
    { front: 'Application compagnon (Ledger Live, Trezor Suite)', back: `Pas de clés privées, mais comptes, xpub et historique en cache.` },
    { front: 'Double authentification', back: `Liste des entrées = carte des comptes et des prestataires à réquisitionner.` },
    { front: 'Historique de navigation', back: `L'adresse consultée sur un explorateur figure dans l'URL : indice d'intérêt et de contrôle.` },
    { front: 'Portefeuille matériel saisi', back: `Jamais de PIN au hasard (effacement) ; chercher la seed de secours à proximité.` },
    { front: 'Sac de Faraday', back: `Isole l'appareil du réseau : bloque effacement à distance et synchronisation, sous alimentation.` },
    { front: 'Mouvement pendant la perquisition', back: `Quelqu'un d'autre détient les clés : gel immédiat au prochain point de contrôle.` },
    { front: 'Accès aux données distantes', back: `Art. 57-1 CPP (à vérifier) : données accessibles depuis le système perquisitionné, conditions à respecter.` },
    { front: 'Motif adresse EVM', back: `0x + 40 hexadécimaux ; 0x + 64 hexadécimaux = hash de transaction.` },
    { front: 'Demande d’exploitation ciblée', back: `Adresses du dossier, motifs (xpub, seeds), logiciels, plateformes, mots-clés de conversation.` },
  ],
}
