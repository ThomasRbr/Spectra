// Niveau 2 — Bitcoin : portefeuilles HD (BIP32/39/44/49/84/86), seed, xpub,
// chemins de dérivation et exploitation en enquête.
import type { Lesson } from '../model'

export const LESSON_PORTEFEUILLES_HD: Lesson = {
  id: 'portefeuilles-hd',
  title: 'Portefeuilles HD : seed, xpub et chemins de dérivation',
  level: 2,
  track: 'bitcoin',
  minutes: 40,
  summary: `Un portefeuille moderne n'est pas une clé : c'est un arbre de clés issu d'une seule graine. Phrase de récupération (BIP39), dérivation hiérarchique (BIP32), chemins standard (BIP44/49/84/86), clés publiques étendues xpub/ypub/zpub, branche de rendu, gap limit, phrase de passe, comptes EVM, et ce que l'enquêteur peut tirer d'une seed ou d'une xpub trouvée en perquisition ou dans une extraction, sans commettre l'erreur qui ruine la procédure.`,
  objectives: [
    `Expliquer la chaîne phrase de récupération → graine → clé maîtresse → comptes → adresses, et ce que chaque niveau permet (voir, dépenser).`,
    `Lire un chemin de dérivation (m/84'/0'/0'/1/7) et en déduire le type d'adresse, le compte et la branche (réception ou rendu).`,
    `Savoir ce qu'une xpub révèle (toutes les adresses, soldes et historique d'un compte) et ce qu'elle ne permet pas (dépenser).`,
    `Inventorier les fonds d'une seed ou d'une xpub saisie sans rien oublier : schémas de dérivation, comptes, chaînes, phrase de passe, gap limit.`,
    `Manipuler ces secrets dans un cadre procédural sûr : jamais de portefeuille personnel, outils dédiés, scellés, traçabilité.`,
  ],
  prerequisites: ['cles-portefeuilles', 'utxo', 'change-heuristics', 'clustering'],
  practice: ['ledger-phishing', 'change-anatomy'],
  blocks: [
    {
      type: 'text',
      md: `En perquisition, vous trouvez une feuille pliée dans un livre : vingt-quatre mots anglais numérotés. Dans l'extraction d'un téléphone, une capture d'écran montre une longue chaîne commençant par \`zpub6r\`. Dans les deux cas, vous tenez peut-être **l'intégralité du patrimoine crypto** d'un suspect, ou au contraire un leurre vide.

Pour le savoir, il faut comprendre comment fonctionne un **portefeuille HD** (*hierarchical deterministic*, hiérarchique déterministe). Depuis le milieu des années 2010, la quasi-totalité des portefeuilles (Ledger, Trezor, Sparrow, Electrum, MetaMask, Trust Wallet, Exodus…) dérivent **toutes leurs clés d'une seule graine**. Une seed, c'est donc potentiellement des centaines d'adresses sur plusieurs blockchains ; une xpub, c'est la liste complète des adresses d'un compte.`,
    },
    { type: 'heading', text: 'De la phrase de récupération aux adresses' },
    {
      type: 'flow',
      caption: `Chaque niveau se calcule à partir du précédent, jamais l'inverse. La xpub d'un compte permet de recalculer toutes ses adresses, mais aucune clé privée.`,
      nodes: [
        { id: 'mn', label: 'Phrase de récupération', kind: 'wallet', sub: '12 ou 24 mots (BIP39)' },
        { id: 'pp', label: 'Phrase de passe', kind: 'unknown', sub: 'facultative (« 25e mot »)' },
        { id: 'seed', label: 'Graine de 512 bits', kind: 'tx', sub: 'PBKDF2-HMAC-SHA512' },
        { id: 'm', label: 'Clé maîtresse m', kind: 'tx', sub: 'xprv + empreinte maîtresse' },
        { id: 'acc', label: 'Compte m/84\'/0\'/0\'', kind: 'service', sub: 'zprv (secret) / zpub (public)' },
        { id: 'rcv', label: 'Branche 0 : réception', kind: 'wallet', sub: 'bc1q… /0/0, /0/1, /0/2…' },
        { id: 'chg', label: 'Branche 1 : rendu', kind: 'wallet', sub: 'bc1q… /1/0, /1/1…' },
      ],
      edges: [
        { from: 'mn', to: 'seed', label: 'dérivation (2 048 itérations)' },
        { from: 'pp', to: 'seed', label: 'sel', dashed: true },
        { from: 'seed', to: 'm', label: 'HMAC-SHA512' },
        { from: 'm', to: 'acc', label: 'dérivation durcie' },
        { from: 'acc', to: 'rcv', label: 'dérivation normale' },
        { from: 'acc', to: 'chg', label: 'dérivation normale' },
      ],
    },
    {
      type: 'text',
      md: `**BIP39** (la phrase de récupération). Le portefeuille tire un nombre aléatoire (128 bits pour 12 mots, 256 bits pour 24 mots), y ajoute une petite somme de contrôle, puis découpe le tout en tranches de 11 bits, chacune correspondant à un mot d'une liste normalisée de **2 048 mots**. Conséquences pratiques :

- le **dernier mot** contient la somme de contrôle : une phrase recopiée avec une erreur est généralement rejetée par le logiciel ;
- dans la liste anglaise, les **quatre premières lettres** suffisent à identifier un mot (\`aban\` pour \`abandon\`, \`abil\` pour \`ability\`) : les plaques métalliques n'en gravent souvent que quatre ;
- des listes existent en plusieurs langues, dont le **français** : la même entropie écrite en mots français donne une **autre graine**. Il faut restaurer dans la langue d'origine.

La phrase est ensuite transformée en **graine** de 512 bits par une fonction de dérivation lente (PBKDF2, 2 048 itérations), avec comme sel le mot \`mnemonic\` suivi de l'éventuelle **phrase de passe**.

**BIP32** (la dérivation hiérarchique). De la graine sort une **clé maîtresse** et un « code de chaîne ». Toute clé « étendue » (clé + code de chaîne) peut engendrer des milliards d'enfants numérotés, qui peuvent eux-mêmes avoir des enfants : c'est l'arbre.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Toutes les phrases de 12 ou 24 mots ne sont pas du BIP39',
      md: `**Electrum** utilise son propre format de phrase (mêmes mots anglais, mais dérivation et numéro de version différents) : restaurée comme une phrase BIP39, elle donne un portefeuille **vide**. **Monero** utilise 25 mots (format propre), certains portefeuilles d'autres écosystèmes ont leurs propres schémas. Avant de conclure « seed vide », identifiez le logiciel d'origine (application installée, notice, autocollant, étui).`,
    },
    { type: 'heading', text: 'Lire un chemin de dérivation' },
    {
      type: 'text',
      md: `**BIP44** a fixé une structure à cinq niveaux, reprise ensuite par les autres standards :

\`m / objectif' / type de monnaie' / compte' / branche / index\`

- **objectif** (*purpose*) : le standard, donc le **type d'adresse** (44, 49, 84, 86) ;
- **type de monnaie** (*coin type*, registre SLIP-44) : \`0'\` Bitcoin, \`1'\` testnet, \`60'\` Ethereum et chaînes EVM, \`195'\` Tron, \`501'\` Solana… ;
- **compte** : \`0'\`, \`1'\`, \`2'\`… permet de séparer des usages (épargne, quotidien, activité) ;
- **branche** : \`0\` = adresses de **réception** (externes), \`1\` = adresses de **rendu** (internes) ;
- **index** : numéro de l'adresse, de 0 à l'infini.

L'apostrophe (ou la lettre \`h\`) signale une dérivation **durcie** : sans la clé privée du parent, impossible de calculer l'enfant. C'est pourquoi les trois premiers niveaux sont durcis : la xpub d'un compte ne permet pas de deviner les autres comptes.`,
    },
    {
      type: 'table',
      caption: 'Les chemins Bitcoin standard et leurs clés publiques étendues (convention SLIP-132)',
      headers: ['Standard', 'Chemin du compte', 'Type d’adresse', 'Préfixe d’adresse', 'Clé étendue publique / privée'],
      rows: [
        ['BIP44', "m/44'/0'/0'", 'P2PKH (historique)', '1…', 'xpub / xprv'],
        ['BIP49', "m/49'/0'/0'", 'P2SH-P2WPKH (SegWit imbriqué)', '3…', 'ypub / yprv'],
        ['BIP84', "m/84'/0'/0'", 'P2WPKH (SegWit natif)', 'bc1q… (42 caractères)', 'zpub / zprv'],
        ['BIP86', "m/86'/0'/0'", 'P2TR (Taproot, clé unique)', 'bc1p… (62 caractères)', 'xpub (pas de préfixe dédié répandu ; descripteur tr())'],
        ['Multisig (convention BIP48)', "m/48'/0'/0'/2'", 'P2WSH multisignature', 'bc1q… (62 caractères)', 'Zpub / xpub de chaque cosignataire'],
      ],
    },
    {
      type: 'check',
      q: `Une adresse a été dérivée au chemin m/84'/0'/0'/1/7. Que pouvez-vous en dire ?`,
      options: [
        `Adresse de réception P2PKH du compte 1`,
        `Adresse Taproot de réception, la 7e du compte 0`,
        `Adresse SegWit native (bc1q) de rendu, la huitième de la branche de rendu du premier compte`,
        `Adresse Ethereum du compte 7`,
      ],
      answer: 2,
      explain: `84' = SegWit natif (bc1q), 0' = Bitcoin, 0' = premier compte, 1 = branche de rendu, 7 = huitième index (on compte à partir de 0).`,
    },
    {
      type: 'widget',
      id: 'keys-derivation',
      caption: `Rappel du dernier maillon : clé privée → clé publique → adresse. Un portefeuille HD répète ce calcul pour chaque index de chaque branche, à partir d'une seule graine.`,
    },
    { type: 'heading', text: 'Seed, clé privée, xpub : qui peut faire quoi ?' },
    {
      type: 'table',
      caption: 'Le niveau de secret détermine ce que l’on peut faire, et la façon de le traiter en procédure',
      headers: ['Élément trouvé', 'Exemple', 'Voir les fonds', 'Dépenser', 'Portée'],
      rows: [
        ['Phrase de récupération (+ phrase de passe)', '24 mots sur papier ou plaque', 'Oui', 'Oui', 'Tout le portefeuille : toutes chaînes, tous comptes'],
        ['Clé privée étendue', 'xprv / zprv…', 'Oui', 'Oui', 'Le sous-arbre concerné (un compte en général)'],
        ['Clé privée simple', 'WIF (5…, K…, L…) ou 64 caractères hexadécimaux', 'Une adresse', 'Une adresse', 'Une seule adresse'],
        ['Clé publique étendue', 'xpub / ypub / zpub, descripteur', 'Oui, tout le compte', 'Non', 'Toutes les adresses du compte, réception et rendu'],
        ['Adresse', 'bc1q…', 'Elle seule', 'Non', 'Une adresse (le reste du portefeuille reste à découvrir par heuristiques)'],
      ],
    },
    {
      type: 'text',
      md: `Une **xpub de compte** (niveau \`m/84'/0'/0'\`) permet de recalculer **toutes** les adresses des branches \`/0/*\` et \`/1/*\`. Branchée sur un explorateur ou un nœud, elle donne instantanément :

- la liste exhaustive des adresses utilisées, **y compris les adresses de rendu** que les heuristiques n'auraient peut-être pas trouvées ;
- le **solde** exact du compte et chaque UTXO ;
- l'**historique** complet : dates, montants, contreparties.

C'est un renseignement d'une qualité qu'aucune heuristique n'égale : là où le clustering **infère** qu'une adresse appartient au portefeuille, la xpub le **démontre** mathématiquement. En revanche, elle ne permet **pas** de déplacer un seul satoshi.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'xpub, ypub, zpub : le préfixe n’est qu’un indice',
      md: `Les trois formats contiennent exactement la **même clé** : seuls les octets de version changent, et l'on convertit l'un en l'autre sans perte. Le préfixe indique le type d'adresse **attendu**, mais certains logiciels (notamment des applications compagnons de portefeuilles matériels) affichent une « xpub » même pour un compte SegWit natif. Les **descripteurs** modernes lèvent l'ambiguïté : \`wpkh([7c3a91f2/84h/0h/0h]xpub6C…/0/*)\` indique la fonction (\`wpkh\` = bc1q), l'**empreinte maîtresse** (\`7c3a91f2\`) et le chemin. Dans un descripteur, la clé est toujours écrite au format xpub : c'est la fonction qui fixe le type d'adresse.`,
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Une faiblesse peu connue',
      md: `Une xpub ne permet pas de dépenser… sauf si elle est combinée à **une seule clé privée enfant** non durcie du même compte. Les deux réunies permettent de recalculer la clé privée du compte entier. Pour l'enquêteur, cela signifie qu'une clé privée isolée (WIF exportée pour une adresse) **plus** la xpub trouvée ailleurs peuvent valoir une seed : à signaler aux spécialistes, sans manipulation improvisée.`,
    },
    { type: 'heading', text: 'Rendu, gap limit et phrase de passe' },
    {
      type: 'terms',
      items: [
        { term: 'Branche de rendu', def: `Branche /1 de chaque compte. Le portefeuille y prend une adresse neuve pour chaque monnaie rendue : c'est ce qui rend les adresses de rendu « invisibles » aux simples recherches d'adresse, mais pas à la xpub.` },
        { term: 'Gap limit', def: `Nombre d'adresses consécutives inutilisées après lequel le logiciel arrête de chercher (20 selon BIP44). Des fonds reçus au-delà de ce trou sont ignorés par une restauration standard.` },
        { term: 'Phrase de passe (BIP39)', def: `Mot ou phrase libre ajouté à la seed. Chaque phrase de passe produit un portefeuille entièrement différent et valide : aucun message d'erreur ne signale une phrase de passe fausse ou manquante.` },
        { term: 'Empreinte maîtresse', def: `Quatre octets (8 caractères hexadécimaux) identifiant la clé maîtresse. Elle change avec la phrase de passe : la comparer à une empreinte relevée ailleurs confirme qu'on a la bonne combinaison.` },
        { term: 'Portefeuille en lecture seule (watch-only)', def: `Portefeuille chargé avec une xpub ou un descripteur : il affiche soldes et historique et prépare des transactions, mais ne peut pas signer.` },
        { term: 'Descripteur', def: `Notation standard (BIP380 et suivants) qui décrit sans ambiguïté un ensemble d'adresses : fonction de script, empreinte, chemin, clé étendue.` },
      ],
    },
    {
      type: 'text',
      md: `**Le gap limit en pratique.** Un particulier dépasse rarement le trou de 20 adresses. Mais un vendeur qui génère une adresse par commande (boutique en ligne, vendeur de stupéfiants sur messagerie, collecte de « dons ») peut en distribuer des centaines dont beaucoup ne seront jamais payées. Une restauration avec le gap limit par défaut s'arrête alors au premier trou de 20 et **sous-estime** le patrimoine. Les logiciels sérieux permettent de l'augmenter (200, 1 000…) : faites-le systématiquement pour un inventaire judiciaire.

**La phrase de passe.** C'est le piège le plus fréquent. Le suspect montre volontiers une seed « officielle » qui ouvre un portefeuille avec quelques centaines d'euros, tandis que l'essentiel dort derrière une phrase de passe. Les portefeuilles matériels proposent ce mécanisme sous les noms de « portefeuille caché » ou de phrase de passe associée à un second code PIN. Indices à rechercher : mot isolé sous la seed, mention « + », « 25 », « pp », mot de passe atypique dans un gestionnaire, réglage « passphrase » activé dans l'application compagnon.`,
    },
    {
      type: 'check',
      q: `Vous restaurez une seed saisie : le portefeuille s'ouvre sans erreur mais affiche un solde nul. Le suspect avait reçu 2 BTC selon la chaîne. Quelle est la conclusion correcte ?`,
      options: [
        `La seed est fausse, sinon le logiciel aurait affiché une erreur`,
        `Les fonds ont nécessairement été dépensés`,
        `Rien n'est conclu : il faut vérifier le schéma de dérivation, les autres comptes, le gap limit et l'existence d'une phrase de passe`,
        `La blockchain a été réorganisée`,
      ],
      answer: 2,
      explain: `Une seed BIP39 valide ouvre toujours « un » portefeuille, vide ou non. Une phrase de passe manquante, un mauvais chemin (BIP44 au lieu de BIP84) ou un gap limit trop court produisent exactement ce symptôme.`,
    },
    { type: 'heading', text: 'Une seed, plusieurs blockchains' },
    {
      type: 'text',
      md: `La même phrase de récupération dérive des clés pour **toutes** les chaînes, grâce au niveau « type de monnaie ». Mais chaque écosystème a ses habitudes, et chaque logiciel les siennes :

- **Ethereum et chaînes EVM** : \`m/44'/60'/0'/0/n\` chez la plupart des portefeuilles logiciels (le « compte 2 » de l'interface est l'index \`n = 1\`) ; certaines applications compagnons font varier le **compte** (\`m/44'/60'/n'/0/0\`) ; d'anciens outils utilisaient \`m/44'/60'/0'/n\`. Une même adresse \`0x…\` est valable sur Ethereum, BNB Chain, Polygon, Arbitrum, Base… : il faut interroger **chaque réseau**.
- **Tron** : \`m/44'/195'/0'/0/n\`.
- **Solana** : chemins entièrement durcis (\`m/44'/501'/0'/0'\` et variantes selon les portefeuilles).
- En modèle à comptes, il n'y a ni branche de rendu ni changement d'adresse à chaque paiement : on utilise généralement **une adresse par compte**, et l'on énumère quelques index ou comptes.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Inventaire exhaustif : la grille minimale',
      md: `Pour chaque seed (et chaque phrase de passe connue) : Bitcoin BIP44, BIP49, BIP84 et BIP86, comptes 0 à 4 au minimum, gap limit relevé ; EVM sur les trois variantes de chemin, index 0 à 9, sur chaque réseau EVM pertinent ; Tron ; Solana ; puis les chaînes suggérées par le dossier (applications installées, historique de navigation, discussions). Consignez chaque combinaison testée, **y compris les résultats négatifs** : ils prouvent l'exhaustivité de votre recherche.`,
    },
    { type: 'heading', text: 'Exploiter une xpub ou une seed en enquête' },
    {
      type: 'steps',
      items: [
        { title: 'Reconnaître', md: `Une xpub/ypub/zpub fait 111 caractères et commence par son préfixe ; un descripteur contient \`wpkh(\`, \`sh(wpkh(\`, \`tr(\` ou \`wsh(multi(\`. Où les trouver : paramètres d'export d'un logiciel (Sparrow, Electrum), fichiers de portefeuille, application compagnon d'un portefeuille matériel, captures d'écran, échanges avec un comptable ou un service de suivi fiscal.` },
        { title: 'Préserver', md: `Constater l'élément en place (photo ou capture sous scellé, procès-verbal), recopier la chaîne **en entier**, calculer l'empreinte du fichier source. Une seed est un secret de valeur : elle est placée sous scellé, son accès est tracé.` },
        { title: 'Dériver hors ligne', md: `Sur un poste dédié, idéalement déconnecté, avec un outil vérifié : dériver les adresses de chaque schéma plausible (réception et rendu), avec un gap limit élevé. La dérivation est un calcul : elle ne touche pas aux fonds.` },
        { title: 'Interroger sans fuiter', md: `Les soldes et historiques s'obtiennent par l'outil d'analyse institutionnel ou un nœud contrôlé par le service. Charger la xpub dans un logiciel relié à un serveur public révèle à son opérateur **toutes** les adresses du suspect, et peut alerter.` },
        { title: 'Recouper', md: `Comparer les adresses dérivées au graphe : adresses déjà vues dans le dossier, dépôts vers des exchanges (nouvelles réquisitions), rendus jamais détectés, autres victimes.` },
        { title: 'Décider des mesures', md: `Avec le magistrat : gel chez les prestataires identifiés, saisie technique si la seed donne le contrôle (voir la leçon « Gel et saisie »), surveillance des adresses si l'on ne peut pas encore agir.` },
        { title: 'Documenter', md: `Combinaisons testées, outil et version, hauteur de bloc ou date de situation, adresses et soldes, empreinte maîtresse obtenue. Votre démarche doit être reproductible par un expert.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ce qu’il ne faut jamais faire',
      md: `- **Importer une seed saisie dans un portefeuille personnel** ou une application grand public sur un téléphone de service : les fonds se retrouvent sous un contrôle non institutionnel, l'application transmet adresses et identifiants à ses serveurs, et la défense pourra soutenir que n'importe qui a pu déplacer les fonds.
- Taper une seed dans un site web, même « de restauration » : c'est le mode opératoire même du vol de seed.
- Déplacer des fonds sans décision et sans le protocole de saisie (double contrôle, transaction test, portefeuille institutionnel).
- Photographier une seed avec un téléphone personnel, l'envoyer par messagerie ou courriel.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Cadre juridique : prudence',
      md: `La découverte d'une seed s'inscrit dans le cadre de la perquisition ou de l'exploitation des supports en cours (flagrance, préliminaire, commission rogatoire), et sa mise sous scellé suit les règles ordinaires. L'utilisation de la seed pour **transférer** des fonds constitue une saisie, à conduire sur instruction du magistrat et selon le régime applicable (saisie en perquisition, saisies spéciales des articles 706-141 et suivants du CPP, rôle de l'AGRASC). Les modalités se vérifient dans les textes en vigueur et auprès du parquet ; en cas de doute, on **consulte sans déplacer**, et l'on sécurise par la surveillance et le gel.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — la capture d’écran oubliée',
      md: `Affaire de vente de stupéfiants par messagerie. Le vendeur communique à chaque client une adresse Bitcoin différente : le clustering n'en relie que 9, faute de dépense commune. L'extraction de son téléphone (février 2026) livre une capture d'écran de l'écran « Export » d'un logiciel de bureau, montrant :

\`wpkh([a41f09c3/84h/0h/0h]xpub6CUGRUo…7NnYk/0/*)\`

Sur le poste dédié du service, l'enquêtrice dérive 1 000 adresses de réception et 1 000 de rendu. Résultat : **317 adresses utilisées** (contre 9 connues), 1 482 réceptions entre mars 2024 et janvier 2026 pour un total de **6,214 BTC**, un solde résiduel de 0,388 BTC sur 4 UTXO, et 22 envois vers des adresses de dépôt attribuées à deux exchanges. Le premier trou de 20 adresses apparaît à l'index 141 : avec le gap limit par défaut, 176 adresses et 3,9 BTC seraient passés inaperçus.

Suites : réquisitions aux deux exchanges, mise sous surveillance des 4 UTXO, et, à l'interpellation, recherche ciblée de la seed correspondante (l'empreinte maîtresse \`a41f09c3\` servira à confirmer qu'il s'agit du bon portefeuille).`,
    },
    {
      type: 'case',
      title: 'Cas pratique — la seed « vide »',
      md: `En perquisition, une plaque métallique porte 24 débuts de mots de 4 lettres. Restaurée sur le poste dédié selon BIP84, elle ouvre un portefeuille vide. Grille d'inventaire appliquée :

- BIP44 compte 0 : **vide** ; BIP49 compte 0 : 0,0124 BTC (ancien usage, 2021) ; BIP86 : vide ;
- EVM \`m/44'/60'/0'/0/0\` : 0x7b2e…c41a, 310 USDC sur Arbitrum ;
- Tron : vide.

Dans le gestionnaire de mots de passe de l'ordinateur, une entrée intitulée « L » contient un mot sans rapport avec un site. Testé comme phrase de passe, il produit l'empreinte maîtresse \`5e0d77b1\` — la même que celle relevée dans le fichier de configuration de l'application compagnon — et un portefeuille BIP84 contenant **4,71 BTC**. La saisie est conduite le jour même selon le protocole, l'ensemble des combinaisons testées figurant au procès-verbal.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Erreur fréquente',
        md: `- Restaurer avec un seul schéma (celui par défaut du logiciel) et conclure.
- Garder le gap limit à 20.
- Ignorer la phrase de passe parce que « le logiciel n'a rien signalé ».
- Interroger un seul réseau EVM.
- Charger la xpub sur un service public pour « gagner du temps ».`,
      },
      right: {
        title: 'Bonne pratique',
        md: `- Tester BIP44/49/84/86, plusieurs comptes, plusieurs chemins EVM.
- Relever le gap limit (200 ou plus) pour un inventaire.
- Chercher activement des indices de phrase de passe et comparer les empreintes maîtresses.
- Énumérer chaque réseau compatible avec l'adresse.
- Interroger via l'outil institutionnel ou un nœud contrôlé ; documenter chaque combinaison.`,
      },
    },
    {
      type: 'check',
      q: `Pourquoi la xpub d'un compte ne permet-elle pas de découvrir les adresses du compte voisin (m/84'/0'/1') ?`,
      options: [
        `Parce que les comptes sont dérivés en mode durci : il faut la clé privée du parent pour les calculer`,
        `Parce que chaque compte a sa propre phrase de récupération`,
        `Parce que la xpub expire au bout de 20 adresses`,
        `Parce que les comptes sont sur des blockchains différentes`,
      ],
      answer: 0,
      explain: `Les niveaux objectif, monnaie et compte sont durcis (apostrophe) : depuis une xpub de compte, on ne peut descendre que dans les branches non durcies de ce compte.`,
    },
  ],
  keyPoints: [
    `Une seed BIP39 (12/24 mots, + phrase de passe éventuelle) engendre une graine dont tout l'arbre de clés BIP32 découle, sur toutes les blockchains.`,
    `Chemin m / objectif' / monnaie' / compte' / branche / index : 44 = 1…, 49 = 3…, 84 = bc1q…, 86 = bc1p… ; branche 0 = réception, 1 = rendu.`,
    `Une xpub de compte révèle toutes les adresses (réception et rendu), soldes et historique, sans permettre de dépenser ; xpub/ypub/zpub contiennent la même clé.`,
    `Une seed valide ouvre toujours un portefeuille : un solde nul impose de vérifier schémas, comptes, gap limit et phrase de passe.`,
    `EVM : une adresse pour tous les réseaux compatibles, plusieurs conventions de chemin selon les logiciels.`,
    `Jamais de portefeuille personnel ni de service public : poste dédié, dérivation hors ligne, interrogation par l'outil institutionnel ou un nœud contrôlé.`,
    `Documenter toutes les combinaisons testées (y compris négatives) et l'empreinte maîtresse ; tout transfert relève du protocole de saisie, sur instruction du magistrat.`,
  ],
  quiz: [
    {
      q: `Que permet une zpub de compte trouvée dans l'extraction d'un téléphone ?`,
      options: [
        `Dépenser les fonds du compte`,
        `Lister toutes les adresses SegWit natives du compte, réception et rendu, avec soldes et historique, sans pouvoir dépenser`,
        `Accéder à tous les comptes et à toutes les blockchains de la seed`,
        `Connaître la phrase de passe`,
      ],
      answer: 1,
      explain: `Une clé publique étendue permet de dériver les clés publiques, donc les adresses, des branches non durcies du compte. Elle ne contient aucune clé privée et ne remonte pas vers les autres comptes.`,
    },
    {
      kind: 'multi',
      q: `Une seed saisie restaurée selon BIP84 affiche un solde nul, alors que le dossier montre des fonds. Quelles causes faut-il examiner ? (plusieurs réponses)`,
      options: [
        `Une phrase de passe BIP39 non renseignée`,
        `Un autre schéma de dérivation (BIP44, BIP49, BIP86) ou un autre compte`,
        `Un gap limit trop court`,
        `Le fait que les seeds expirent après deux ans`,
        `Une phrase au format Electrum restaurée comme du BIP39`,
      ],
      answer: [0, 1, 2, 4],
      explain: `Toutes ces causes produisent un portefeuille valide mais vide, sauf la quatrième : une seed n'expire jamais.`,
    },
    {
      q: `Quel type d'adresse correspond au chemin m/49'/0'/0'/0/3 ?`,
      options: [
        `Une adresse bc1p (Taproot)`,
        `Une adresse 1… (P2PKH)`,
        `Une adresse Ethereum`,
        `Une adresse 3… (SegWit imbriqué P2SH-P2WPKH), de réception`,
      ],
      answer: 3,
      explain: `L'objectif 49' désigne le SegWit imbriqué dans P2SH (adresses 3…) ; la branche 0 est la branche de réception.`,
    },
    {
      kind: 'truefalse',
      q: `Si la phrase de passe saisie est fausse, le portefeuille affiche un message d'erreur.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Toute phrase de passe produit une graine valide et donc un portefeuille (souvent vide). Seule la comparaison de l'empreinte maîtresse ou la présence des fonds attendus confirme la bonne combinaison.`,
    },
    {
      q: `Un vendeur a généré une adresse par commande, dont beaucoup jamais payées. Quel réglage est décisif pour inventorier sa xpub ?`,
      options: [
        `Le gap limit, à relever bien au-delà de 20`,
        `Le taux de frais`,
        `Le nombre de confirmations`,
        `La langue de l'interface du logiciel`,
      ],
      answer: 0,
      explain: `Avec un gap limit de 20, la recherche s'arrête au premier trou de 20 adresses inutilisées et ignore tout ce qui suit.`,
    },
    {
      kind: 'multi',
      q: `Parmi ces pratiques, lesquelles sont proscrites face à une seed découverte en perquisition ? (plusieurs réponses)`,
      options: [
        `L'importer dans le portefeuille mobile personnel d'un enquêteur pour vérifier le solde`,
        `La saisir sur un site web de restauration`,
        `La placer sous scellé et tracer chaque accès`,
        `La photographier avec un téléphone personnel et l'envoyer au collègue analyste`,
      ],
      answer: [0, 1, 3],
      explain: `Le scellé et la traçabilité sont la règle. Les trois autres pratiques font sortir le secret du cadre institutionnel, exposent les fonds et fragilisent la procédure.`,
    },
    {
      kind: 'truefalse',
      q: `Une même adresse Ethereum dérivée d'une seed peut détenir des fonds sur BNB Chain, Polygon ou Arbitrum : il faut interroger chaque réseau.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Les chaînes EVM partagent le même format d'adresse et la même dérivation ; les soldes, eux, sont propres à chaque réseau.`,
    },
    {
      q: `Pourquoi charger la xpub d'un suspect dans un logiciel connecté à un serveur public est-il une erreur d'OPSEC ?`,
      options: [
        `Parce que cela déplace les fonds`,
        `Parce que la xpub cesse alors de fonctionner`,
        `Parce que l'opérateur du serveur voit l'ensemble des adresses interrogées, ce qui peut fuiter ou alerter`,
        `Parce que c'est techniquement impossible`,
      ],
      answer: 2,
      explain: `Le logiciel interroge le serveur pour chaque adresse dérivée : son opérateur apprend tout le portefeuille, et l'activité de l'enquêteur.`,
    },
  ],
  flashcards: [
    { front: 'BIP39', back: `Phrase de récupération : 12 mots = 128 bits, 24 mots = 256 bits, liste de 2 048 mots, dernier mot = somme de contrôle.` },
    { front: 'BIP32', back: `Dérivation hiérarchique déterministe : clé maîtresse et clés enfants, normales ou durcies (').` },
    { front: 'Structure BIP44', back: `m / objectif' / monnaie' / compte' / branche / index.` },
    { front: 'Objectifs 44 / 49 / 84 / 86', back: `1… (P2PKH) / 3… (P2SH-P2WPKH) / bc1q… (P2WPKH) / bc1p… (P2TR).` },
    { front: 'Branche 0 et branche 1', back: `0 = adresses de réception, 1 = adresses de rendu.` },
    { front: 'xpub / ypub / zpub', back: `Même clé publique étendue, préfixe différent selon le type d'adresse attendu. Voir sans dépenser.` },
    { front: 'Gap limit', back: `Nombre d'adresses inutilisées consécutives (20 par défaut) après lequel la recherche s'arrête. À relever en inventaire.` },
    { front: 'Phrase de passe (25e mot)', back: `Produit un portefeuille différent et valide, sans message d'erreur. Indice : empreinte maîtresse.` },
    { front: 'Empreinte maîtresse', back: `8 caractères hexadécimaux identifiant la clé maîtresse ; change avec la phrase de passe.` },
    { front: 'Chemins EVM', back: `m/44'/60'/0'/0/n (courant), m/44'/60'/n'/0/0, m/44'/60'/0'/n (ancien). Une adresse pour tous les réseaux EVM.` },
    { front: 'Coin types SLIP-44', back: `0' Bitcoin, 60' Ethereum/EVM, 195' Tron, 501' Solana.` },
    { front: 'Seed saisie : règle d’or', back: `Jamais de portefeuille personnel ni de site web : poste dédié, scellé, outil institutionnel, transfert seulement selon le protocole de saisie.` },
  ],
}
