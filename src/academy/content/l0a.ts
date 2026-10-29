import type { Lesson } from '../model'

// Niveau 0 — Débutant absolu (1/2) : monnaie numérique, cryptographie,
// blockchain, clés et portefeuilles.
// Les entités citées sont réelles (Coinhouse, Binance, Bitstamp, OKX…), sauf Huobex,
// SatsDesk OTC, AuroraTrade, OrbitCasino, CardHub, Lendora et ArcBridge (fictifs). Les flux sont simulés.

export const LESSONS_L0A: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════
  // argent-numerique
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'argent-numerique',
    title: 'La monnaie numérique, en partant de zéro',
    level: 0,
    track: 'bases',
    minutes: 14,
    summary:
      "Ce qu'est l'argent quand il n'est plus qu'une écriture dans un registre, pourquoi Bitcoin a inventé un registre public que personne ne contrôle seul, et pourquoi cela intéresse autant les escrocs… que les enquêteurs.",
    objectives: [
      "Vous saurez expliquer avec des mots simples ce qu'est une crypto-monnaie et en quoi elle diffère de l'argent sur un compte bancaire.",
      'Vous saurez ce que signifie réellement « posséder des bitcoins ».',
      'Vous saurez distinguer crypto-monnaie, jeton et stablecoin.',
      "Vous saurez pourquoi la blockchain est une source de preuve exceptionnelle pour l'enquêteur.",
    ],
    practice: ['first-trace'],
    blocks: [
      {
        type: 'text',
        md: `Avant de parler de bitcoins, partons d'une observation simple : **l'argent de votre compte bancaire est déjà numérique**. Il n'existe pas sous forme de billets rangés dans un coffre à votre nom. C'est une **ligne dans un registre** tenu par votre banque : « M. Martin : 2 340,18 € ».

Quand vous payez par carte ou faites un virement, aucun objet ne se déplace. La banque modifie simplement deux lignes de son registre : elle retire un montant chez vous et l'ajoute chez quelqu'un d'autre.

Toute la question des crypto-monnaies tient dans une interrogation : **qui tient le registre, et pourquoi lui faire confiance ?**`,
      },
      { type: 'heading', text: "L'argent, c'est un registre" },
      {
        type: 'text',
        md: `Un **registre** (on dit aussi « grand livre ») est une liste de comptes et de mouvements. Le registre d'une banque est **privé** : seule la banque peut le lire et y écrire. Vous lui faites confiance parce qu'elle est contrôlée par des autorités (en France, l'ACPR, rattachée à la Banque de France) et parce que la loi l'oblige à tenir des comptes exacts.

Ce système fonctionne très bien, mais il repose entièrement sur un **tiers de confiance** : la banque. Elle peut refuser un virement, bloquer un compte, et elle connaît l'identité de chacun de ses clients.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Monnaie bancaire',
          md: `- Registre **privé**, tenu par la banque
- Un seul teneur de registre, contrôlé par l'État
- Identité du client connue (KYC)
- Virement annulable ou bloquable dans certains cas
- Heures ouvrées, délais entre banques`,
        },
        right: {
          title: 'Crypto-monnaie (ex. Bitcoin)',
          md: `- Registre **public**, copié sur des milliers d'ordinateurs
- Personne ne le contrôle seul
- Aucune identité dans le registre, seulement des **adresses**
- Transaction confirmée **irréversible**
- Fonctionne 24 h/24, partout dans le monde, en quelques minutes`,
        },
      },
      { type: 'heading', text: 'Le problème de la double dépense' },
      {
        type: 'text',
        md: `Pourquoi ne pas simplement créer une « pièce numérique » sous forme de fichier ? Parce qu'un fichier se **copie** à l'infini. Si une pièce numérique est un fichier, rien n'empêche de l'envoyer à Paul, puis d'envoyer la même copie à Jacques. C'est le **problème de la double dépense**.

Les banques le résolvent en étant le registre unique qui fait foi. En 2008, une personne ou un groupe se présentant sous le pseudonyme **Satoshi Nakamoto** a publié une autre solution, Bitcoin :

1. le registre est **public** et **copié** chez tous les participants ;
2. les nouvelles écritures sont regroupées par paquets (les **blocs**) et ajoutées selon une règle commune que tout le monde vérifie (le **consensus**) ;
3. chaque bloc est scellé au précédent, si bien que réécrire le passé devient pratiquement impossible.

Ce registre partagé, c'est la **blockchain** (chaîne de blocs). La leçon « Blockchain, adresses et transactions » détaille son fonctionnement.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : le cahier du village',
        md: `Imaginez un village où les échanges ne se font pas avec des billets, mais en écrivant dans un **cahier** posé sur la place publique : « Paul donne 3 pièces à Jacques ». Chaque habitant en garde une **copie identique** et vérifie chaque nouvelle ligne : Paul avait-il bien 3 pièces ? Est-ce vraiment Paul qui l'a écrit ?

Si un tricheur modifie sa copie, elle ne correspond plus à celle des autres : il est démasqué. Personne n'est « le chef du cahier », et pourtant tout le monde peut avoir confiance dans son contenu. Bitcoin, c'est ce cahier, à l'échelle de la planète, tenu par des ordinateurs.`,
      },
      {
        type: 'widget',
        id: 'chain-tamper',
        caption: "Essayez de modifier une ancienne écriture : tous les blocs suivants deviennent invalides. C'est ce qui rend le registre si difficile à falsifier.",
      },
      { type: 'heading', text: 'De Bitcoin à des milliers de crypto-actifs' },
      {
        type: 'table',
        headers: ['Date', 'Événement', 'Pourquoi c\'est utile à l\'enquêteur'],
        rows: [
          ['Oct. 2008', 'Publication du livre blanc de Bitcoin', 'Le principe du registre public naît'],
          ['3 janv. 2009', 'Premier bloc de Bitcoin (bloc « genesis »)', 'Tout l\'historique Bitcoin est consultable depuis cette date'],
          ['Mai 2010', 'Premier achat connu : deux pizzas contre 10 000 BTC', 'Illustre la volatilité : la valorisation doit toujours être datée'],
          ['2014-2015', 'Lancement de l\'USDT (premier grand stablecoin) puis d\'Ethereum', 'Apparition des jetons et des « smart contracts »'],
          ['2019', 'L\'USDT arrive sur la blockchain Tron', 'Tron devient la chaîne majeure des escroqueries en stablecoins'],
          ['2022', 'Effondrement du stablecoin algorithmique UST, faillite de grands acteurs', 'Les risques de contrepartie deviennent visibles du grand public'],
          ['2023-2024', 'Adoption puis entrée en application du règlement européen MiCA', 'Cadre européen unifié pour les prestataires (PSCA)'],
        ],
        caption: 'Quelques repères historiques (dates arrondies au mois quand elles sont discutées).',
      },
      {
        type: 'terms',
        items: [
          { term: 'Crypto-actif', def: 'Terme juridique général (règlement MiCA) désignant une représentation numérique de valeur ou de droit, enregistrée sur une blockchain ou une technologie similaire.' },
          { term: 'Crypto-monnaie', def: 'Actif « natif » d\'une blockchain, qui sert à payer ses frais : le bitcoin (BTC) sur Bitcoin, l\'ether (ETH) sur Ethereum, le TRX sur Tron.' },
          { term: 'Jeton (token)', def: 'Actif créé « par-dessus » une blockchain existante par un programme (smart contract). Exemple : l\'USDT circule sur Ethereum, Tron et d\'autres chaînes.' },
          { term: 'Stablecoin', def: 'Jeton conçu pour garder une valeur stable, le plus souvent 1 dollar américain (USDT, USDC). Émis par une société qui peut, dans la plupart des cas, geler des adresses.' },
          { term: 'Monnaie fiat', def: 'Monnaie officielle émise par un État ou une banque centrale (euro, dollar). Le terme sert à la distinguer des crypto-actifs.' },
          { term: 'Exchange', def: 'Plateforme d\'échange où l\'on achète et vend des crypto-actifs contre des euros ou d\'autres actifs. En France, elle doit être autorisée (PSAN hier, PSCA sous MiCA).' },
        ],
      },
      {
        type: 'check',
        q: 'Qui tient le registre de Bitcoin ?',
        options: [
          'La Banque de France',
          'La société qui a créé Bitcoin',
          'Des milliers d\'ordinateurs indépendants qui en gardent chacun une copie et appliquent les mêmes règles',
          'Les exchanges, chacun pour ses clients',
        ],
        answer: 2,
        explain: "Bitcoin n'a ni société, ni banque centrale. Le registre est répliqué chez tous les participants (les « nœuds »), qui vérifient chaque bloc selon des règles communes. Les exchanges, eux, tiennent en plus leur propre comptabilité interne, privée.",
      },
      { type: 'heading', text: 'Ce que « posséder des bitcoins » veut dire' },
      {
        type: 'text',
        md: `On ne possède pas un fichier « bitcoin ». Le registre indique qu'un certain montant est rattaché à une **adresse** (une suite de caractères comme \`bc1qx7m2…8sdkfm\`). Posséder ces bitcoins, c'est détenir le **secret** qui permet d'écrire dans le registre « je transfère ce montant à telle autre adresse ». Ce secret s'appelle la **clé privée**.

Deux situations très différentes coexistent :

- **Je garde moi-même ma clé** dans une application ou un petit appareil : personne d'autre ne peut bouger mes fonds, mais si je perds la clé, tout est perdu, et si on me la vole, tout est volé.
- **Je confie mes fonds à une plateforme** (un exchange comme Coinhouse) : comme à la banque, je vois un solde dans mon espace client, mais c'est la plateforme qui détient les clés.

Cette distinction est capitale pour l'enquête : une plateforme connaît ses clients et répond aux réquisitions ; une clé conservée par un particulier ne « répond » à personne.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'Compte bancaire' },
          { id: 'cv', label: 'Coinhouse', kind: 'exchange', sub: 'Exchange régulé (France)' },
          { id: 'w', label: 'Adresse « sécurisée »', kind: 'suspect', sub: 'bc1qx7m2…8sdkfm' },
          { id: 'b', label: 'Binance', kind: 'exchange', sub: 'Dépôt d\'un client' },
        ],
        edges: [
          { from: 'v', to: 'cv', label: 'Virement SEPA 15 000 €' },
          { from: 'cv', to: 'w', label: 'Retrait 0,35 BTC' },
          { from: 'w', to: 'b', label: '0,349 BTC (2 h plus tard)' },
        ],
        caption: "Le parcours le plus fréquent : l'argent entre dans le monde crypto par un exchange régulé et en ressort par un autre. Les deux extrémités sont identifiables par réquisition.",
      },
      { type: 'heading', text: 'Pourquoi les criminels s\'y intéressent… et pourquoi c\'est une chance' },
      {
        type: 'compare',
        left: {
          title: 'Ce qui attire les criminels',
          md: `- Transferts **rapides** et **internationaux**, sans banque
- Aucune identité dans le registre
- **Irréversibilité** : la victime ne peut pas « annuler »
- Facilité à créer des milliers d'adresses
- Services offshore peu regardants`,
        },
        right: {
          title: 'Ce qui aide l\'enquêteur',
          md: `- Le registre est **public** : on le lit sans réquisition
- Il est **horodaté** et **permanent** : rien ne s'efface
- Les fonds finissent presque toujours par passer par un **service** qui connaît ses clients
- Certains jetons (USDT, USDC) sont **gelables** par leur émetteur
- Les erreurs des auteurs restent inscrites pour toujours`,
        },
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : le mythe de l\'anonymat',
        md: `« Le bitcoin, c'est anonyme » : c'est faux. Bitcoin est **pseudonyme**. Les adresses ne portent pas de nom, mais chaque mouvement est visible pour toujours. Dès qu'une adresse est reliée à une personne (par une réquisition, une perquisition, une publication sur un forum), tout son historique devient lisible, y compris des années après.

Beaucoup d'auteurs l'ignorent. Beaucoup de victimes aussi : elles pensent souvent qu'« il n'y a rien à faire ». Votre premier rôle est de recueillir les bonnes informations pour prouver le contraire.`,
      },
      {
        type: 'case',
        title: 'Cas : le faux conseiller bancaire',
        md: `**Les faits.** Mme D., 68 ans, reçoit l'appel d'un « conseiller fraude » de sa banque. Il lui explique que son épargne est menacée et qu'il faut la « mettre à l'abri en bitcoins ». Guidée par téléphone, elle ouvre un compte chez **Coinhouse**, y vire 15 000 €, achète 0,35 BTC et les envoie à une adresse dictée par l'escroc.

**Ce que l'enquêteur obtient.**

- Le relevé bancaire : le virement vers Coinhouse (point d'entrée).
- Une réquisition à Coinhouse : le compte de Mme D., l'achat, et surtout le **retrait** de 0,35 BTC avec son **identifiant de transaction** et l'adresse de destination.
- Sur la blockchain, sans aucune réquisition : l'adresse de destination renvoie 0,349 BTC deux heures plus tard vers une adresse de dépôt **Binance**.
- Une réquisition à Binance (via son portail dédié aux forces de l'ordre) : l'identité du titulaire du compte, ses connexions, ses retraits.

En quelques actes, on passe d'une victime à un compte identifié. C'est l'objet de toute l'Académie.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Cadre juridique (à vérifier dans les textes en vigueur)',
        md: `En droit français, les crypto-actifs relèvent du **Code monétaire et financier** et, depuis l'entrée en application du règlement européen **MiCA** (règlement (UE) 2023/1114), d'un régime européen harmonisé. Les plateformes qui proposent des services en France doivent être **agréées** comme prestataires de services sur crypto-actifs (**PSCA**), auprès de l'**AMF** en France ; l'ancien statut national de **PSAN** (loi PACTE de 2019) a fait l'objet d'une période transitoire.

Les infractions poursuivies restent celles du droit commun : escroquerie, abus de confiance, extorsion, blanchiment, etc. Le crypto-actif n'est qu'un **moyen** ; ce qui change, c'est la manière de suivre l'argent.`,
      },
      {
        type: 'check',
        q: 'Une victime a envoyé des bitcoins à un escroc il y a trois jours. Peut-elle faire annuler la transaction auprès de « Bitcoin » ?',
        options: [
          'Oui, en écrivant au support de Bitcoin',
          'Non : une transaction confirmée est irréversible, et Bitcoin n\'a pas de support. Seuls les fonds encore détenus par un service ou gelables peuvent être bloqués',
          'Oui, si elle fournit une plainte',
          'Oui, sa banque peut demander un remboursement à la blockchain',
        ],
        answer: 1,
        explain: "Personne ne peut annuler une écriture confirmée dans le registre. L'enquête vise donc à suivre les fonds jusqu'à un endroit où ils peuvent être bloqués : un compte chez un exchange, ou des stablecoins gelables par leur émetteur.",
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Le bon réflexe dès maintenant',
        md: `Quand une victime parle de « crypto », demandez toujours : **quelle plateforme** a-t-elle utilisée pour acheter, **quel actif** (bitcoin, USDT…), **sur quel réseau** (Bitcoin, Ethereum, Tron…), et a-t-elle gardé des **captures** de l'application avec l'adresse de destination ou l'identifiant de transaction. Ces quatre éléments conditionnent toute la suite.`,
      },
    ],
    keyPoints: [
      "L'argent bancaire est déjà une écriture dans un registre privé tenu par la banque.",
      "Une blockchain est un registre public, copié chez des milliers de participants, que personne ne contrôle seul.",
      'Posséder des crypto-actifs, c\'est détenir la clé privée qui permet de les dépenser — ou les confier à une plateforme qui la détient.',
      'Une transaction confirmée est irréversible : on ne peut que suivre les fonds jusqu\'à un point de blocage.',
      'Bitcoin est pseudonyme, pas anonyme : tout l\'historique reste public et permanent.',
      'Les fonds passent presque toujours par des services régulés, où l\'identification se fait par réquisition.',
    ],
    quiz: [
      {
        q: 'Qu\'est-ce que le « problème de la double dépense » que Bitcoin a résolu ?',
        options: [
          'Le fait de payer deux fois des frais bancaires',
          'Le risque qu\'une même unité numérique, copiable comme un fichier, soit dépensée deux fois',
          'L\'obligation de déclarer deux fois ses gains',
          'Le doublement des prix en cas d\'inflation',
        ],
        answer: 1,
        explain: 'Un fichier se copie. Sans registre de référence, rien n\'empêche de dépenser deux fois la même pièce numérique. Bitcoin résout le problème par un registre public partagé et un consensus.',
      },
      {
        kind: 'truefalse',
        q: 'Bitcoin est anonyme : il est impossible de relier une adresse à une personne.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Bitcoin est pseudonyme. Les adresses ne portent pas de nom, mais tout l\'historique est public ; une réquisition à un exchange, une saisie ou une source ouverte peut relier une adresse à une personne.',
      },
      {
        kind: 'multi',
        q: 'Quelles propriétés de la blockchain sont des atouts pour l\'enquêteur ? (plusieurs réponses)',
        options: [
          'Elle est publique et consultable sans réquisition',
          'Elle est horodatée et permanente',
          'Elle indique le nom du titulaire de chaque adresse',
          'Les fonds finissent souvent chez des services qui connaissent leurs clients',
        ],
        answer: [0, 1, 3],
        explain: 'Publicité, horodatage, permanence et passage par des services régulés sont les grands leviers. En revanche, la blockchain ne contient aucune identité.',
      },
      {
        q: 'Quelle est la différence entre une crypto-monnaie et un jeton ?',
        options: [
          'Il n\'y en a aucune',
          'La crypto-monnaie est l\'actif natif d\'une blockchain (BTC, ETH, TRX) ; le jeton est créé par un programme qui fonctionne sur une blockchain existante (USDT…)',
          'Le jeton est toujours plus cher',
          'Le jeton n\'existe que sur Bitcoin',
        ],
        answer: 1,
        explain: 'L\'actif natif paie les frais de sa chaîne. Un jeton est géré par un smart contract : l\'USDT, par exemple, existe sur Ethereum, Tron et d\'autres chaînes.',
      },
      {
        q: 'Une victime a acheté ses bitcoins sur Coinhouse puis les a envoyés à l\'escroc. Que peut fournir Coinhouse sur réquisition ?',
        options: [
          'L\'identité de l\'escroc',
          'Le compte de la victime, l\'achat, et le retrait avec l\'identifiant de transaction et l\'adresse de destination',
          'L\'annulation de la transaction',
          'Rien, la blockchain est anonyme',
        ],
        answer: 1,
        explain: 'Coinhouse connaît sa cliente (la victime) et le retrait qu\'elle a effectué. Il ne connaît pas l\'escroc, sauf si celui-ci est aussi son client. Le retrait fournit le point d\'ancrage sur la blockchain.',
      },
      {
        q: 'Un stablecoin comme l\'USDT est…',
        options: [
          'Une monnaie émise par la Banque centrale européenne',
          'Un jeton conçu pour valoir environ 1 dollar, émis par une société qui peut geler des adresses',
          'L\'actif natif de Bitcoin',
          'Un compte bancaire en dollars',
        ],
        answer: 1,
        explain: 'Les stablecoins sont émis par des sociétés privées. Leur caractère centralisé est un levier : l\'émetteur peut bloquer des fonds sur demande des autorités.',
      },
      {
        kind: 'truefalse',
        q: 'Une plateforme d\'échange qui propose ses services en France doit être autorisée par une autorité (statut PSAN hier, agrément PSCA sous MiCA).',
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: 'C\'est l\'un des fondements de l\'enquête : ces prestataires ont des obligations d\'identification de leurs clients et répondent aux réquisitions. Vérifiez toujours le statut actuel sur les listes publiées par l\'AMF.',
      },
    ],
    flashcards: [
      { front: 'Qu\'est-ce qu\'un registre (grand livre) ?', back: 'Une liste de comptes et de mouvements. Celui d\'une banque est privé ; celui de Bitcoin est public et partagé.' },
      { front: 'Double dépense', back: 'Risque de dépenser deux fois une même unité numérique copiable. Résolu par Bitcoin grâce à un registre public et un consensus.' },
      { front: 'Satoshi Nakamoto', back: 'Pseudonyme de l\'auteur (ou des auteurs) du livre blanc de Bitcoin (2008). Identité inconnue.' },
      { front: 'Pseudonyme vs anonyme', back: 'Pseudonyme : pas de nom, mais un identifiant stable (l\'adresse) dont tout l\'historique est public. Anonyme : aucun lien possible.' },
      { front: 'Clé privée', back: 'Le secret qui permet de dépenser les fonds d\'une adresse. Qui détient la clé contrôle les fonds.' },
      { front: 'Custodial', back: 'Les fonds sont confiés à une plateforme qui détient les clés et connaît le client (comme une banque).' },
      { front: 'Crypto-monnaie native', back: 'Actif propre à une blockchain, qui paie ses frais : BTC, ETH, TRX…' },
      { front: 'Jeton (token)', back: 'Actif créé par un smart contract sur une blockchain existante (USDT, USDC…).' },
      { front: 'Irréversibilité', back: 'Une transaction confirmée ne peut pas être annulée. On ne peut que suivre les fonds jusqu\'à un point de blocage.' },
      { front: 'MiCA', back: 'Règlement européen (UE) 2023/1114 sur les marchés de crypto-actifs : agrément des PSCA, règles sur les stablecoins.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // crypto-sans-maths
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'crypto-sans-maths',
    title: 'La cryptographie expliquée sans mathématiques',
    level: 0,
    track: 'bases',
    minutes: 16,
    summary:
      "Les trois outils cryptographiques qui font fonctionner une blockchain — l'empreinte (hash), la paire de clés et la signature — expliqués par des analogies, sans une seule équation. Et ce que la cryptographie ne fait pas : cacher les transactions.",
    objectives: [
      'Vous saurez expliquer ce qu\'est une empreinte (hash) et ses quatre propriétés.',
      'Vous saurez distinguer clé privée, clé publique et adresse.',
      'Vous saurez ce que prouve — et ne prouve pas — une signature numérique.',
      'Vous saurez pourquoi « crypto » ne veut pas dire « secret » : les transactions sont lisibles par tous.',
    ],
    prerequisites: ['argent-numerique'],
    blocks: [
      {
        type: 'text',
        md: `Le mot « crypto » vient de **cryptographie**, la science des codes secrets. On pourrait croire que les transactions sont chiffrées. C'est faux : sur Bitcoin, Ethereum ou Tron, **tout est lisible en clair**. La cryptographie sert à autre chose : garantir que personne ne peut **falsifier** le registre ni **dépenser l'argent d'autrui**.

Trois outils suffisent à comprendre l'essentiel :

1. l'**empreinte** (ou *hash*), qui scelle les données ;
2. la **paire de clés** (privée et publique), qui définit qui possède quoi ;
3. la **signature numérique**, qui prouve qu'un ordre de paiement vient bien du détenteur de la clé.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Lire de l\'hexadécimal',
        md: `Vous verrez partout des suites comme \`4a62e245…\`. C'est de l'**hexadécimal** : une façon d'écrire les nombres avec 16 symboles, \`0\` à \`9\` puis \`a\` à \`f\`. Chaque caractère représente 4 bits (4 « 0 ou 1 »). Une empreinte SHA-256 fait 256 bits, soit **64 caractères hexadécimaux**. Le préfixe \`0x\`, fréquent sur Ethereum, signale simplement « ceci est de l'hexadécimal ».`,
      },
      { type: 'heading', text: 'Outil n°1 : l\'empreinte (hash)' },
      {
        type: 'text',
        md: `Une **fonction de hachage** prend n'importe quelle donnée (un mot, un contrat de 300 pages, une vidéo) et produit une **empreinte** de taille fixe. C'est l'équivalent numérique d'une **empreinte digitale** : courte, propre à chaque document, et impossible à « retourner » pour reconstituer le document.

Ses quatre propriétés :

- **Déterministe** : la même donnée donne toujours la même empreinte, sur n'importe quel ordinateur.
- **Effet avalanche** : changer une seule lettre, une virgule, produit une empreinte **totalement différente**.
- **Sens unique** : connaître l'empreinte ne permet pas de retrouver la donnée.
- **Sans collision pratique** : il est impossible en pratique de trouver deux données différentes ayant la même empreinte.

Bitcoin utilise la fonction **SHA-256** ; Ethereum utilise **Keccak-256**. Le principe est le même.`,
      },
      {
        type: 'table',
        headers: ['Texte haché (SHA-256)', 'Empreinte obtenue'],
        rows: [
          ['Gendarmerie', '`fcd125164027c5ec…ff6bf2a9`'],
          ['gendarmerie', '`4a62e2458074e596…6a0352c3`'],
          ['Gendarmerie.', '`fbf459a46e30c4b1…ed82c0e3`'],
        ],
        caption: 'Une majuscule ou un point suffisent à changer complètement l\'empreinte (valeurs réelles, tronquées pour l\'affichage).',
      },
      {
        type: 'widget',
        id: 'hash-playground',
        caption: 'Tapez un texte, puis modifiez une seule lettre : observez l\'effet avalanche sur l\'empreinte SHA-256.',
      },
      {
        type: 'table',
        headers: ['Usage de l\'empreinte', 'Ce que cela donne en pratique'],
        rows: [
          ['Identifier une transaction', 'L\'identifiant de transaction (txid, « hash ») est l\'empreinte de son contenu : 64 caractères hexadécimaux'],
          ['Chaîner les blocs', 'Chaque bloc contient l\'empreinte du bloc précédent : modifier le passé casse la chaîne'],
          ['Fabriquer des adresses', 'Une adresse est (le plus souvent) une empreinte raccourcie de la clé publique'],
          ['Preuve de travail', 'Les mineurs cherchent une empreinte de bloc commençant par de nombreux zéros (leçon suivante)'],
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : vous utilisez déjà des empreintes',
        md: `En criminalistique numérique, on calcule l'empreinte (SHA-256, par exemple) d'un disque copié ou d'un fichier saisi pour prouver qu'il n'a pas été modifié depuis la saisie. C'est exactement le même outil. Le réflexe est utile ici aussi : calculez et consignez l'empreinte des exports (PDF, CSV) de vos consultations d'explorateurs pour en garantir l'intégrité.`,
      },
      {
        type: 'check',
        q: 'On modifie une seule lettre d\'un texte. Que devient son empreinte SHA-256 ?',
        options: [
          'Elle change d\'un seul caractère',
          'Elle ne change pas',
          'Elle change entièrement, de façon imprévisible',
          'Elle devient plus longue',
        ],
        answer: 2,
        explain: 'C\'est l\'effet avalanche. La taille reste fixe (64 caractères hexadécimaux), mais le contenu n\'a plus rien à voir. C\'est ce qui permet de détecter la moindre falsification.',
      },
      { type: 'heading', text: 'Outil n°2 : la paire de clés' },
      {
        type: 'text',
        md: `Chaque utilisateur possède au moins une **paire de clés**, liées mathématiquement :

- la **clé privée** : un très grand nombre tiré au hasard, **secret**. C'est elle qui permet de dépenser.
- la **clé publique** : calculée à partir de la clé privée. On peut la montrer à tout le monde.

Le calcul ne fonctionne que dans un sens : de la clé privée, on obtient facilement la clé publique ; de la clé publique, il est **impossible en pratique** de retrouver la clé privée. Bitcoin, Ethereum et Tron utilisent pour cela la même courbe mathématique, nommée **secp256k1** (inutile d'en savoir plus).

Enfin, l'**adresse** est une version raccourcie et encodée de la clé publique (souvent son empreinte). C'est elle que l'on communique pour recevoir des fonds, comme un RIB.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Clé privée',
          md: `- Secrète, ne doit **jamais** être communiquée
- Permet de **signer**, donc de dépenser
- Si elle est perdue : fonds perdus
- Si elle est volée : fonds volés
- Analogie : la **clé du coffre**, ou le tampon personnel`,
        },
        right: {
          title: 'Clé publique / adresse',
          md: `- Publique, on la donne pour être payé
- Permet de **vérifier** une signature et de recevoir
- Ne permet **pas** de dépenser
- Apparaît dans le registre
- Analogie : le **numéro de coffre** inscrit sur la porte`,
        },
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : le coffre à fente',
        md: `Imaginez un mur de coffres-forts dans un hall public. Chaque coffre porte un **numéro** (l'adresse) et une **fente** : tout le monde peut y glisser de l'argent. Mais seul le détenteur de la **clé** (la clé privée) peut l'ouvrir et en retirer le contenu. Les murs du coffre sont en verre : chacun voit combien il contient et tout ce qui y entre et en sort. Personne, en revanche, ne sait à qui appartient la clé.`,
      },
      {
        type: 'widget',
        id: 'keys-derivation',
        caption: 'Suivez le chemin à sens unique : clé privée → clé publique → adresse.',
      },
      { type: 'heading', text: 'Outil n°3 : la signature numérique' },
      {
        type: 'text',
        md: `Pour dépenser, il faut prouver au réseau qu'on détient la clé privée… **sans la révéler**. C'est le rôle de la **signature numérique**. Le portefeuille calcule, à partir de la clé privée et du message (« envoyer 0,1 BTC de telle adresse vers telle autre »), une signature propre à **ce** message. N'importe qui peut ensuite vérifier, avec la clé publique, que la signature est valide.

Une signature est liée au contenu exact : si quelqu'un modifie le montant ou le destinataire, la signature ne correspond plus et le réseau rejette la transaction.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'k', label: 'Portefeuille', kind: 'wallet', sub: 'Détient la clé privée' },
          { id: 't', label: 'Transaction signée', kind: 'tx', sub: '0,1 BTC → bc1q…' },
          { id: 'n', label: 'Nœuds du réseau', kind: 'service', sub: 'Vérifient avec la clé publique' },
          { id: 'b', label: 'Bloc', kind: 'tx', sub: 'Inscription au registre' },
        ],
        edges: [
          { from: 'k', to: 't', label: 'signe' },
          { from: 't', to: 'n', label: 'diffusée' },
          { from: 'n', to: 'b', label: 'valide → incluse' },
        ],
        caption: 'La clé privée ne quitte jamais le portefeuille : seule la signature circule.',
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Ce que prouve une signature… et ce qu\'elle ne prouve pas',
        md: `Une signature valide prouve que l'ordre a été émis **avec la clé privée**. Elle ne prouve pas **qui** a utilisé la clé. Si un escroc a obtenu la phrase de récupération d'une victime, ses transactions sont parfaitement valides aux yeux du réseau : la blockchain ne distingue pas le propriétaire du voleur.

Pour imputer une transaction à une personne, il faut d'autres éléments : saisie de l'appareil ou de la phrase de récupération, réponse d'un prestataire, exploitation de téléphone, recoupements.`,
      },
      {
        type: 'case',
        title: 'Cas : « Ce n\'est pas moi qui ai signé »',
        md: `En garde à vue, M. L. reconnaît que l'adresse \`TXk9…f3Lq\` est la sienne, mais affirme qu'un tiers lui a « volé ses clés » et a effectué les transferts litigieux de 42 000 USDT.

Ce que la cryptographie établit : les transferts ont été signés avec la clé de cette adresse. Ce qu'elle n'établit pas : la personne derrière le clavier.

Ce qui fera la différence : la **phrase de récupération** retrouvée dans les notes de son téléphone, les **connexions** à l'application de portefeuille au moment des transferts, la cohérence entre les horaires des transactions et son activité (messages, géolocalisation), et l'absence de plainte ou de signalement de vol de sa part.`,
      },
      { type: 'heading', text: 'Ce que la cryptographie ne fait PAS' },
      {
        type: 'table',
        headers: ['Idée reçue', 'Réalité'],
        rows: [
          ['« Les transactions sont chiffrées »', 'Non : montants, adresses et dates sont publics et lisibles par tous'],
          ['« On peut retrouver la clé privée à partir de l\'adresse »', 'Non : le calcul est à sens unique'],
          ['« Une signature identifie une personne »', 'Non : elle prouve seulement l\'usage de la clé'],
          ['« Toutes les cryptos se valent »', 'Non : quelques-unes (Monero, Zcash en mode protégé) masquent volontairement montants et adresses — niveau 4'],
          ['« Un hash peut être déchiffré »', 'Non : une empreinte n\'est pas un chiffrement, il n\'y a rien à déchiffrer'],
        ],
      },
      {
        type: 'check',
        q: 'Un collègue affirme qu\'il faut « déchiffrer » la blockchain pour voir les montants d\'une transaction Bitcoin. Qu\'en pensez-vous ?',
        options: [
          'Il a raison, il faut la clé privée',
          'Il a tort : les montants et adresses sont lisibles en clair sur n\'importe quel explorateur',
          'Il a raison, seule la police a l\'outil de déchiffrement',
          'Il a raison pour les transactions de plus de 1 BTC',
        ],
        answer: 1,
        explain: 'Sur Bitcoin, Ethereum ou Tron, rien n\'est chiffré : la cryptographie protège l\'intégrité et la propriété, pas la confidentialité. Un simple explorateur de blocs suffit pour lire une transaction.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Hash (empreinte)', def: 'Résultat de taille fixe d\'une fonction de hachage. Identifie une donnée sans la révéler et détecte toute modification.' },
          { term: 'SHA-256', def: 'Fonction de hachage utilisée par Bitcoin (256 bits, 64 caractères hexadécimaux).' },
          { term: 'Keccak-256', def: 'Fonction de hachage utilisée par Ethereum et les chaînes compatibles.' },
          { term: 'Clé privée', def: 'Nombre secret de 256 bits qui permet de signer, donc de dépenser.' },
          { term: 'Clé publique', def: 'Valeur dérivée de la clé privée, qui permet de vérifier les signatures.' },
          { term: 'Signature numérique', def: 'Preuve, attachée à un message précis, que son auteur détient la clé privée.' },
          { term: 'secp256k1', def: 'Nom de la courbe elliptique utilisée par Bitcoin, Ethereum et Tron pour les clés.' },
          { term: 'Hexadécimal', def: 'Écriture des nombres en base 16 (0-9, a-f). Préfixe 0x sur Ethereum.' },
        ],
      },
    ],
    keyPoints: [
      'Rien n\'est chiffré sur les blockchains publiques : la cryptographie garantit l\'intégrité et la propriété, pas le secret.',
      'Une empreinte (hash) est déterministe, à sens unique, et change entièrement à la moindre modification.',
      'Le txid d\'une transaction et le chaînage des blocs reposent sur les empreintes.',
      'Clé privée → clé publique → adresse : un chemin à sens unique.',
      'La signature prouve l\'usage de la clé privée, pas l\'identité de la personne.',
      'Hacher et consigner les exports de vos constatations en garantit l\'intégrité.',
    ],
    quiz: [
      {
        q: 'Quelle propriété d\'une fonction de hachage permet de détecter la falsification d\'un bloc ancien ?',
        options: ['Le sens unique', 'L\'effet avalanche : la moindre modification change entièrement l\'empreinte', 'La longueur variable', 'Le chiffrement'],
        answer: 1,
        explain: 'Modifier une transaction change l\'empreinte du bloc, qui ne correspond plus à celle enregistrée dans le bloc suivant : la falsification saute aux yeux.',
      },
      {
        q: 'Combien de caractères hexadécimaux compte une empreinte SHA-256 ?',
        options: ['32', '40', '64', '256'],
        answer: 2,
        explain: '256 bits / 4 bits par caractère hexadécimal = 64 caractères. C\'est la longueur d\'un txid Bitcoin.',
      },
      {
        kind: 'truefalse',
        q: 'Connaissant l\'adresse d\'un suspect, un expert peut recalculer sa clé privée avec un ordinateur puissant.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Le passage clé privée → clé publique → adresse est à sens unique. L\'accès aux fonds passe par la découverte de la clé ou de la phrase de récupération (perquisition, exploitation de supports), pas par le calcul.',
      },
      {
        kind: 'multi',
        q: 'Qu\'établit une signature valide sur une transaction ? (plusieurs réponses)',
        options: [
          'Que l\'ordre a été émis avec la clé privée correspondant à l\'adresse',
          'Que le contenu (montant, destinataire) n\'a pas été modifié après signature',
          'L\'identité civile de l\'émetteur',
          'Que l\'émetteur était consentant',
        ],
        answer: [0, 1],
        explain: 'La signature prouve l\'usage de la clé et l\'intégrité du message. Elle ne dit rien de l\'identité ni du consentement : une clé volée produit des signatures valides.',
      },
      {
        q: 'À quoi sert la clé publique ?',
        options: [
          'À dépenser les fonds',
          'À vérifier les signatures et à dériver l\'adresse de réception',
          'À chiffrer les montants',
          'À récupérer un portefeuille perdu',
        ],
        answer: 1,
        explain: 'La clé publique permet à tous de vérifier les signatures ; l\'adresse en est dérivée. Elle ne donne aucun pouvoir de dépense.',
      },
      {
        q: 'Quelle fonction de hachage est utilisée par Ethereum ?',
        options: ['SHA-256', 'MD5', 'Keccak-256', 'RIPEMD-160 seule'],
        answer: 2,
        explain: 'Ethereum utilise Keccak-256 (proche de SHA-3). Bitcoin utilise SHA-256 (et RIPEMD-160 pour raccourcir certaines adresses).',
      },
      {
        q: 'Pourquoi calculer l\'empreinte SHA-256 d\'un export PDF de vos constatations sur un explorateur ?',
        options: [
          'Pour le chiffrer',
          'Pour pouvoir démontrer plus tard que le fichier n\'a pas été modifié',
          'Pour l\'envoyer sur la blockchain',
          'Ce n\'est d\'aucune utilité',
        ],
        answer: 1,
        explain: 'Comme pour un scellé numérique, l\'empreinte consignée en procédure permet de vérifier l\'intégrité du fichier à tout moment.',
      },
    ],
    flashcards: [
      { front: 'Hash (empreinte)', back: 'Résumé de taille fixe d\'une donnée : déterministe, à sens unique, effet avalanche, sans collision pratique.' },
      { front: 'Effet avalanche', back: 'Changer un seul caractère de l\'entrée change complètement l\'empreinte.' },
      { front: 'Longueur d\'un txid Bitcoin', back: '64 caractères hexadécimaux (256 bits).' },
      { front: 'Clé privée', back: 'Secret qui permet de signer donc de dépenser. Perdue = fonds perdus ; volée = fonds volés.' },
      { front: 'Clé publique', back: 'Dérivée de la clé privée ; permet de vérifier les signatures. L\'adresse en découle.' },
      { front: 'Signature numérique', back: 'Preuve liée à un message précis que l\'émetteur détient la clé privée. Ne prouve pas l\'identité.' },
      { front: 'Fonction de hachage de Bitcoin / d\'Ethereum', back: 'SHA-256 pour Bitcoin ; Keccak-256 pour Ethereum.' },
      { front: 'La blockchain est-elle chiffrée ?', back: 'Non (sauf cryptos de confidentialité) : montants, adresses et dates sont publics.' },
      { front: 'Préfixe 0x', back: 'Indique une valeur hexadécimale (adresses et hash sur Ethereum).' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // bases-blockchain
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'bases-blockchain',
    title: 'Blockchain, adresses et transactions',
    level: 0,
    track: 'bases',
    minutes: 20,
    summary:
      "Ce qu'est réellement une blockchain du point de vue de l'enquêteur : un registre public, horodaté et quasi immuable, fait de blocs chaînés, dans lequel on lit des transactions entre adresses pseudonymes. Consensus, mempool, confirmations, attribution.",
    objectives: [
      'Vous saurez expliquer comment des blocs chaînés rendent le registre quasi infalsifiable.',
      'Vous saurez distinguer preuve de travail et preuve d\'enjeu, et connaître le rythme des principales chaînes.',
      'Vous saurez lire les champs essentiels d\'une transaction et dire ce que signifie « confirmée ».',
      'Vous saurez hiérarchiser les sources d\'attribution d\'une adresse.',
    ],
    prerequisites: ['argent-numerique', 'crypto-sans-maths'],
    practice: ['first-trace'],
    blocks: [
      {
        type: 'text',
        md: `Une **blockchain** est un registre partagé par des milliers d'ordinateurs appelés **nœuds**. Les transactions y sont regroupées dans des **blocs**, ajoutés les uns après les autres. Chaque bloc contient l'**empreinte** (hash) du bloc précédent : c'est la « chaîne ».

Pour l'enquêteur, trois propriétés comptent avant tout : le registre est **public**, **horodaté** et **quasi immuable**. Cette leçon explique d'où viennent ces propriétés et quelles en sont les limites.`,
      },
      { type: 'heading', text: 'Des blocs chaînés' },
      {
        type: 'text',
        md: `Pensez à un registre papier aux pages numérotées, où chaque nouvelle page commence par recopier le **sceau** de la page précédente. Le sceau d'une page est l'empreinte de tout son contenu, y compris le sceau recopié de la page d'avant.

Si quelqu'un modifie une ligne de la page 100, le sceau de la page 100 change ; il ne correspond plus à celui recopié en page 101, dont le sceau change à son tour, et ainsi de suite jusqu'à la dernière page. Pour falsifier une seule ligne ancienne, il faudrait **refaire toutes les pages suivantes**, plus vite que le reste du réseau n'en ajoute de nouvelles. Sur les grands réseaux, c'est économiquement irréaliste.

Chaque bloc porte un numéro d'ordre : sa **hauteur** (*block height*). Le premier bloc a la hauteur 0.`,
      },
      {
        type: 'widget',
        id: 'chain-tamper',
        caption: 'Modifiez une transaction dans un bloc ancien : observez la rupture de la chaîne, puis le travail nécessaire pour la « réparer ».',
      },
      { type: 'heading', text: 'Qui écrit les blocs ? Le consensus' },
      {
        type: 'text',
        md: `Puisque personne ne dirige le registre, il faut une règle pour décider **qui ajoute le prochain bloc**. C'est le **mécanisme de consensus**. Deux grandes familles existent :`,
      },
      {
        type: 'compare',
        left: {
          title: 'Preuve de travail (Bitcoin)',
          md: `- Les **mineurs** font tourner des machines spécialisées pour trouver une empreinte de bloc respectant une cible de difficulté
- Le gagnant ajoute le bloc et reçoit la **récompense** (bitcoins nouvellement créés + frais)
- Un bloc toutes les **10 minutes** en moyenne
- Coût énergétique élevé, qui protège le registre`,
        },
        right: {
          title: 'Preuve d\'enjeu (Ethereum depuis 2022, Tron…)',
          md: `- Les **validateurs** immobilisent des fonds en garantie (*stake*)
- Ils sont désignés pour proposer et valider les blocs ; une fraude leur fait perdre leur mise
- Ethereum : un créneau de bloc toutes les **12 secondes**
- Tron : 27 « super représentants » élus, un bloc toutes les **3 secondes**`,
        },
      },
      {
        type: 'table',
        headers: ['Chaîne', 'Consensus', 'Rythme des blocs', 'Actif natif'],
        rows: [
          ['Bitcoin', 'Preuve de travail', '≈ 10 min', 'BTC'],
          ['Litecoin', 'Preuve de travail', '≈ 2 min 30', 'LTC'],
          ['Ethereum', 'Preuve d\'enjeu', '12 s', 'ETH'],
          ['Tron', 'Preuve d\'enjeu déléguée', '3 s', 'TRX'],
          ['Solana', 'Preuve d\'enjeu (+ « preuve d\'historique »)', '< 1 s', 'SOL'],
        ],
        caption: 'Ordres de grandeur. Le rythme influence la précision de l\'horodatage et la vitesse à laquelle les fonds peuvent être dispersés.',
      },
      { type: 'heading', text: 'Transactions et adresses' },
      {
        type: 'text',
        md: `Une **transaction** est un message signé qui dit, en substance : « je transfère tel montant de mon adresse vers telle adresse ». Une **adresse** est un identifiant public dérivé d'une clé publique (ou d'un script) : c'est un **pseudonyme**. Une même personne peut en contrôler des centaines.

Sur un explorateur de blocs (site qui permet de consulter le registre), une fiche de transaction contient en général les champs suivants :`,
      },
      {
        type: 'table',
        headers: ['Champ', 'Exemple', 'Intérêt pour l\'enquête'],
        rows: [
          ['Identifiant (txid / hash)', '`4e1f…a9c2` (64 hexa)', 'Référence unique de l\'opération, à citer dans toute réquisition'],
          ['Bloc (hauteur)', '868 412', 'Référence non ambiguë dans le temps'],
          ['Horodatage', '14/10/2024 08:41:07 UTC', 'Date de l\'opération, toujours en UTC'],
          ['Émetteur(s) / entrées', '`bc1qx7m2…8sdkfm`', 'D\'où viennent les fonds'],
          ['Destinataire(s) / sorties', '`bc1q4ld0…r7c2wq`', 'Où vont les fonds : le saut suivant'],
          ['Montant(s)', '0,34912 BTC', 'À valoriser en euros à la date de l\'opération'],
          ['Frais', '0,00002 BTC', 'Payés au réseau ; renseignent sur le logiciel utilisé'],
          ['Événements (chaînes à contrats)', 'Transfer USDT', 'Mouvements de jetons, invisibles dans le champ « montant »'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Notez toujours la hauteur de bloc',
        md: `La date affichée dépend du fuseau horaire choisi par l'explorateur ou par votre navigateur. La **hauteur de bloc**, elle, est une référence non ambiguë, identique sur tous les outils. Dans vos procès-verbaux : txid, hauteur de bloc, date et heure **UTC**.`,
      },
      { type: 'heading', text: 'Mempool et confirmations' },
      {
        type: 'text',
        md: `Une transaction signée n'est pas immédiatement inscrite. Elle est d'abord diffusée aux nœuds et attend dans le **mempool** (salle d'attente de chaque nœud). Les producteurs de blocs y choisissent les transactions, en général celles qui paient les frais les plus élevés.

Quand la transaction entre dans un bloc, elle a **1 confirmation** ; au bloc suivant, 2 ; etc. Plus le nombre de confirmations est élevé, plus il est improbable qu'elle disparaisse (lors d'une **réorganisation**, rare remplacement des derniers blocs). Les exchanges attendent un nombre de confirmations fixé par chaque plateforme avant de créditer un dépôt.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'w', label: 'Portefeuille', kind: 'wallet', sub: 'Signe la transaction' },
          { id: 'm', label: 'Mempool', kind: 'service', sub: 'En attente (non confirmée)' },
          { id: 'b1', label: 'Bloc 868 412', kind: 'tx', sub: '1 confirmation' },
          { id: 'b6', label: 'Bloc 868 417', kind: 'tx', sub: '6 confirmations' },
          { id: 'x', label: 'Exchange', kind: 'exchange', sub: 'Crédite le dépôt' },
        ],
        edges: [
          { from: 'w', to: 'm', label: 'diffusion' },
          { from: 'm', to: 'b1', label: 'inclusion' },
          { from: 'b1', to: 'b6', label: '≈ 50 min sur Bitcoin' },
          { from: 'b6', to: 'x', label: 'seuil atteint' },
        ],
        caption: 'Cycle de vie d\'une transaction Bitcoin, de la signature au crédit chez un exchange.',
      },
      {
        type: 'check',
        q: 'Une victime montre une capture d\'une transaction « en attente » dans le mempool, jamais confirmée. Les fonds ont-ils été transférés ?',
        options: [
          'Oui, la transaction est signée',
          'Non : tant qu\'elle n\'est pas incluse dans un bloc, elle ne fait pas partie du registre et peut être remplacée ou abandonnée',
          'Oui, après 24 heures',
          'Cela dépend de l\'exchange',
        ],
        answer: 1,
        explain: 'Seules les transactions incluses dans un bloc font partie du registre. Une transaction non confirmée peut expirer ou être remplacée (par exemple pour annuler un paiement).',
      },
      { type: 'heading', text: 'Public, horodaté, quasi immuable : les limites à connaître' },
      {
        type: 'table',
        headers: ['Propriété', 'Ce qu\'elle apporte', 'Limite'],
        rows: [
          ['Publicité', 'Historique complet de toute adresse, sans réquisition', 'Aucune identité ; certaines chaînes masquent les données (Monero)'],
          ['Horodatage', 'Datation précise des flux', 'Sur Bitcoin, l\'heure du bloc est fixée par le mineur, avec une tolérance d\'environ deux heures'],
          ['Immuabilité', 'Preuve pérenne, impossible à effacer', 'Les derniers blocs peuvent être réorganisés : attendre des confirmations'],
          ['Exhaustivité', 'Tous les mouvements on-chain sont visibles', 'Les mouvements internes aux exchanges sont hors chaîne, donc invisibles'],
        ],
      },
      { type: 'heading', text: 'Pseudonymat et attribution' },
      {
        type: 'text',
        md: `Une adresse n'est pas une identité. Le travail d'analyse consiste à **relier des adresses entre elles** (on parle de *clustering*), puis à relier ces groupes à des entités du monde réel : c'est l'**attribution**.

Les sources d'attribution, de la plus solide à la plus fragile :

1. **Réponse à réquisition** d'un prestataire régulé (« cette adresse est une adresse de dépôt attribuée au client X ») ;
2. **Saisie** de matériel démontrant le contrôle (portefeuille, phrase de récupération, fichiers) ;
3. **Bases d'attribution** des outils d'analyse (dépôts tests, partenariats, sources ouvertes) ;
4. **OSINT** : adresse publiée sur un forum, un profil, une page de dons ;
5. **Heuristiques** comportementales (leçons de niveau 2).`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Formuler une attribution en procédure',
        md: `Ne présentez jamais une étiquette issue d'un outil ou d'un explorateur comme un fait établi. Écrivez par exemple : « l'outil X attribue cette adresse à la plateforme Binance (attribution non vérifiée à ce stade ; réquisition en cours) ». La réponse du prestataire, elle, constitue une pièce de procédure.`,
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Premier contact avec les formats d\'adresses : le préfixe trahit souvent la blockchain.',
      },
      {
        type: 'case',
        title: 'Cas : deux plaintes, une même adresse',
        md: `Une brigade de Bretagne et une brigade d'Occitanie enregistrent à trois semaines d'intervalle deux plaintes pour escroquerie au faux placement. Les victimes ne se connaissent pas. En relevant l'adresse de destination indiquée par chacune, l'analyste constate qu'il s'agit **de la même adresse** \`bc1q9tz…h3kx0m\`.

L'explorateur montre que cette adresse a reçu des fonds de **14 adresses différentes** en deux mois, puis tout renvoyé vers un même exchange. Le registre public a permis, sans aucun acte coercitif, de **rapprocher les procédures** et d'estimer le nombre potentiel de victimes. C'est souvent le premier apport concret de l'analyse blockchain.`,
      },
      {
        type: 'check',
        q: 'Quelle source d\'attribution est la plus solide juridiquement ?',
        options: [
          'Une étiquette affichée par un explorateur public',
          'Une adresse publiée sur un forum',
          'La réponse d\'un prestataire régulé à une réquisition',
          'Une heuristique comportementale',
        ],
        answer: 2,
        explain: 'La réponse d\'un prestataire à une réquisition est une pièce de procédure. Étiquettes, OSINT et heuristiques sont des indices à corroborer.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Nœud', def: 'Ordinateur qui conserve une copie du registre et vérifie les transactions et les blocs.' },
          { term: 'Bloc', def: 'Paquet de transactions scellé par une empreinte et rattaché au bloc précédent.' },
          { term: 'Hauteur de bloc', def: 'Numéro d\'ordre d\'un bloc dans la chaîne ; référence non ambiguë.' },
          { term: 'Mempool', def: 'File d\'attente des transactions non encore incluses dans un bloc.' },
          { term: 'Confirmation', def: 'Nombre de blocs qui ont inclus puis recouvert une transaction (1 à l\'inclusion).' },
          { term: 'Réorganisation', def: 'Remplacement des derniers blocs par une branche concurrente plus longue ; rare et limité à quelques blocs.' },
          { term: 'Attribution', def: 'Rattachement d\'une adresse ou d\'un groupe d\'adresses à une entité réelle.' },
        ],
      },
    ],
    keyPoints: [
      'Chaque bloc contient l\'empreinte du précédent : falsifier le passé obligerait à tout recalculer.',
      'Preuve de travail (Bitcoin, ≈ 10 min) et preuve d\'enjeu (Ethereum 12 s, Tron 3 s) désignent qui écrit les blocs.',
      'Une transaction n\'existe au registre qu\'une fois incluse dans un bloc ; les confirmations s\'accumulent ensuite.',
      'Raisonner en UTC, noter txid et hauteur de bloc, croiser deux explorateurs.',
      'Une adresse est un pseudonyme ; une personne en contrôle souvent beaucoup.',
      'La réponse d\'un prestataire régulé est la source d\'attribution la plus solide ; les étiquettes d\'outils sont des indices.',
    ],
    quiz: [
      {
        q: 'Pourquoi est-il pratiquement impossible de falsifier une transaction ancienne sur Bitcoin ?',
        options: [
          'Parce que les blocs sont chiffrés',
          'Parce que chaque bloc contient l\'empreinte du précédent : il faudrait recalculer tous les blocs suivants plus vite que le reste du réseau',
          'Parce qu\'une autorité centrale contrôle le registre',
          'Parce que les transactions anciennes sont supprimées',
        ],
        answer: 1,
        explain: 'Le chaînage par empreintes et la preuve de travail rendent la réécriture du passé économiquement irréaliste.',
      },
      {
        q: 'Une transaction a 1 confirmation. Que cela signifie-t-il ?',
        options: [
          'Elle est dans le mempool',
          'Elle vient d\'être incluse dans un bloc, et aucun bloc ne l\'a encore recouverte',
          'Un exchange l\'a validée',
          'Elle a été vérifiée par un enquêteur',
        ],
        answer: 1,
        explain: 'Une confirmation = inclusion dans un bloc. Chaque bloc suivant ajoute une confirmation.',
      },
      {
        kind: 'multi',
        q: 'Quels éléments faut-il consigner pour référencer sans ambiguïté une transaction en procédure ? (plusieurs réponses)',
        options: [
          'L\'identifiant de transaction (txid)',
          'La hauteur de bloc',
          'La date et l\'heure en UTC',
          'La couleur de l\'interface de l\'explorateur',
        ],
        answer: [0, 1, 2],
        explain: 'Txid, hauteur de bloc et horodatage UTC permettent à quiconque de retrouver et vérifier l\'opération.',
      },
      {
        q: 'Quel est le rythme moyen de production des blocs sur Bitcoin ?',
        options: ['3 secondes', '12 secondes', '10 minutes', '1 heure'],
        answer: 2,
        explain: 'Bitcoin vise un bloc toutes les 10 minutes en moyenne ; la difficulté s\'ajuste tous les 2 016 blocs pour maintenir ce rythme.',
      },
      {
        kind: 'truefalse',
        q: 'Sur Bitcoin, l\'horodatage d\'un bloc est fixé par le mineur et peut s\'écarter de l\'heure réelle d\'environ deux heures.',
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: 'Les règles de Bitcoin tolèrent un écart (notamment jusqu\'à environ deux heures en avance). Pour une chronologie fine, croisez avec d\'autres éléments et privilégiez la hauteur de bloc comme référence.',
      },
      {
        q: 'Un explorateur affiche l\'étiquette « Binance Deposit » sur une adresse. Comment le rédiger en procédure ?',
        options: [
          '« L\'adresse appartient à Binance »',
          '« Selon l\'explorateur X, l\'adresse serait une adresse de dépôt Binance (attribution non vérifiée ; réquisition en cours) »',
          'Ne pas le mentionner',
          '« L\'adresse appartient au suspect »',
        ],
        answer: 1,
        explain: 'Une étiquette est un indice. On cite sa source et on la fait confirmer par réquisition.',
      },
      {
        q: 'Quel mouvement est invisible sur la blockchain ?',
        options: [
          'Un retrait d\'un exchange vers une adresse personnelle',
          'Un transfert entre deux clients d\'un même exchange, effectué dans sa comptabilité interne',
          'Un dépôt sur un exchange',
          'Un transfert entre deux adresses personnelles',
        ],
        answer: 1,
        explain: 'Les opérations internes aux plateformes sont hors chaîne : seule la plateforme peut les décrire, sur réquisition.',
      },
    ],
    flashcards: [
      { front: 'Hauteur de bloc', back: 'Numéro d\'ordre du bloc dans la chaîne. Référence non ambiguë, indépendante du fuseau horaire.' },
      { front: 'Mempool', back: 'Salle d\'attente des transactions diffusées mais pas encore incluses dans un bloc.' },
      { front: 'Confirmation', back: '1 à l\'inclusion dans un bloc, +1 à chaque bloc suivant.' },
      { front: 'Preuve de travail', back: 'Consensus par calcul (mineurs). Bitcoin, ≈ 10 min par bloc.' },
      { front: 'Preuve d\'enjeu', back: 'Consensus par mise en garantie (validateurs). Ethereum (12 s), Tron (3 s).' },
      { front: 'Trois propriétés utiles de la blockchain', back: 'Publique, horodatée, quasi immuable.' },
      { front: 'Clustering', back: 'Regroupement d\'adresses supposées contrôlées par une même entité.' },
      { front: 'Attribution', back: 'Rattachement d\'une adresse à une entité réelle. Source la plus solide : réponse à réquisition.' },
      { front: 'Réorganisation (reorg)', back: 'Remplacement des derniers blocs par une branche concurrente. Raison d\'attendre des confirmations.' },
      { front: 'Horodatage Bitcoin', back: 'Fixé par le mineur, tolérance d\'environ deux heures. Toujours raisonner en UTC.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // cles-portefeuilles
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'cles-portefeuilles',
    title: 'Clés, phrase de récupération et portefeuilles',
    level: 0,
    track: 'bases',
    minutes: 20,
    summary:
      "Un portefeuille ne contient pas de cryptos : il garde des clés. Phrase de récupération (seed), portefeuilles hiérarchiques, chemins de dérivation, portefeuilles custodial ou auto-hébergés, et ce que tout cela implique en perquisition et en analyse.",
    objectives: [
      'Vous saurez expliquer pourquoi une phrase de récupération donne le contrôle total des fonds, sur plusieurs blockchains.',
      'Vous saurez distinguer les grandes familles de portefeuilles et ce que chacune permet d\'obtenir en enquête.',
      'Vous saurez repérer les supports de clés lors d\'une perquisition et adopter la bonne conduite.',
      'Vous saurez pourquoi le solde d\'une adresse n\'est pas le patrimoine d\'une personne.',
    ],
    prerequisites: ['crypto-sans-maths', 'bases-blockchain'],
    practice: ['first-trace', 'eth-first'],
    blocks: [
      {
        type: 'text',
        md: `On parle de « portefeuille » (*wallet*), mais l'image est trompeuse : un portefeuille crypto **ne contient pas d'argent**. Les fonds restent inscrits dans la blockchain, rattachés à des adresses. Le portefeuille garde les **clés privées** qui permettent de les dépenser, et sert d'interface pour consulter les soldes et signer les transactions.

Conséquence fondamentale pour l'enquêteur : **qui détient la clé contrôle les fonds**, où qu'il se trouve dans le monde, avec ou sans l'appareil d'origine.`,
      },
      { type: 'heading', text: 'De la clé privée à l\'adresse' },
      {
        type: 'steps',
        items: [
          { title: 'Tirer une clé privée', md: 'Le portefeuille tire au hasard un nombre de 256 bits. Le nombre de possibilités est si grand qu\'il est impossible de « tomber » par hasard sur la clé de quelqu\'un d\'autre.' },
          { title: 'Calculer la clé publique', md: 'Une opération mathématique à sens unique (courbe secp256k1) donne la clé publique.' },
          { title: 'Dériver l\'adresse', md: 'La clé publique est hachée puis encodée selon le format de la chaîne : `bc1q…` sur Bitcoin, `0x…` sur Ethereum, `T…` sur Tron.' },
          { title: 'Recevoir et dépenser', md: 'On communique l\'adresse pour recevoir ; on signe avec la clé privée pour dépenser.' },
        ],
      },
      {
        type: 'widget',
        id: 'keys-derivation',
        caption: 'Générez une clé, observez la clé publique et l\'adresse obtenues, et vérifiez que le chemin ne se remonte pas.',
      },
      { type: 'heading', text: 'La phrase de récupération (seed)' },
      {
        type: 'text',
        md: `Gérer une clé différente pour chaque adresse serait ingérable. Les portefeuilles modernes sont donc **hiérarchiques déterministes** (HD) : tout part d'une **graine** unique, présentée à l'utilisateur sous forme d'une **phrase de récupération** de **12 ou 24 mots** anglais tirés d'une liste standard de 2 048 mots (norme BIP39). Exemple de forme : « *ribbon parade orbit …* ».

À partir de cette phrase, le portefeuille calcule, de façon toujours identique, un nombre illimité de clés et d'adresses, sur **plusieurs blockchains**. Réinstaller l'application sur un autre téléphone et saisir les mots suffit à tout retrouver.

Certains utilisateurs ajoutent une **passphrase** facultative (parfois appelée « 25e mot ») : les mêmes 24 mots avec une passphrase différente donnent un portefeuille **totalement différent**.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Une seule phrase, toutes les chaînes',
        md: `Une même phrase de récupération peut contrôler simultanément des bitcoins, des ethers, des USDT sur Tron et sur Ethereum, etc. Découvrir la seed d'un suspect, c'est potentiellement accéder à **l'ensemble** de ses avoirs auto-hébergés, y compris sur des adresses que l'enquête ne connaissait pas encore. Inversement, une victime qui a communiqué sa seed à un « support technique » a tout perdu, sur toutes les chaînes.`,
      },
      {
        type: 'table',
        headers: ['Chemin de dérivation (exemple)', 'Usage', 'Format d\'adresse obtenu'],
        rows: [
          ['m/44\'/0\'/0\'/0/0', 'Bitcoin historique (BIP44)', '1…'],
          ['m/49\'/0\'/0\'/0/0', 'Bitcoin SegWit encapsulé (BIP49)', '3…'],
          ['m/84\'/0\'/0\'/0/0', 'Bitcoin SegWit natif (BIP84)', 'bc1q…'],
          ['m/86\'/0\'/0\'/0/0', 'Bitcoin Taproot (BIP86)', 'bc1p…'],
          ['m/44\'/60\'/0\'/0/0', 'Ethereum et chaînes EVM', '0x…'],
          ['m/44\'/195\'/0\'/0/0', 'Tron', 'T…'],
        ],
        caption: 'Le « chemin » indique au portefeuille quelle branche de l\'arbre de clés calculer. Un expert peut ainsi retrouver toutes les adresses d\'une seed saisie.',
      },
      {
        type: 'check',
        q: 'Un suspect a supprimé son application de portefeuille et jeté son téléphone. Ses fonds auto-hébergés sont-ils perdus pour lui ?',
        options: [
          'Oui, les fonds étaient dans le téléphone',
          'Non : s\'il a conservé sa phrase de récupération, il peut tout restaurer sur un autre appareil',
          'Oui, sauf s\'il appelle le support de Bitcoin',
          'Non, les fonds reviennent automatiquement à l\'exchange',
        ],
        answer: 1,
        explain: 'Les fonds sont sur la blockchain ; la seed permet de recalculer toutes les clés. C\'est pourquoi la recherche de la seed (papier, photo, note, plaque métal) est prioritaire en perquisition.',
      },
      {
        type: 'flow',
        nodes: [
          { id: 's', label: 'Phrase de récupération', kind: 'wallet', sub: '24 mots (une seule graine)' },
          { id: 'b', label: 'bc1q…', kind: 'wallet', sub: 'Bitcoin (m/84\'/0\'…)' },
          { id: 'e', label: '0x…', kind: 'wallet', sub: 'Ethereum et chaînes EVM (m/44\'/60\'…)' },
          { id: 't', label: 'T…', kind: 'wallet', sub: 'Tron (m/44\'/195\'…)' },
          { id: 'r', label: 'Adresses de rendu', kind: 'wallet', sub: 'Une nouvelle à chaque paiement Bitcoin' },
        ],
        edges: [
          { from: 's', to: 'b', label: 'dérivation' },
          { from: 's', to: 'e', label: 'dérivation' },
          { from: 's', to: 't', label: 'dérivation' },
          { from: 'b', to: 'r', label: 'autres branches', dashed: true },
        ],
        caption: 'Une seule seed, des adresses sur plusieurs chaînes : celui qui détient les mots contrôle l\'ensemble.',
      },
      { type: 'heading', text: 'Les familles de portefeuilles' },
      {
        type: 'compare',
        left: {
          title: 'Custodial (hébergé par un tiers)',
          md: `- Un **exchange** ou un prestataire détient les clés
- L'utilisateur a un identifiant et un mot de passe, pas de seed
- Le prestataire connaît son client (**KYC**)
- Gel et réquisition possibles
- Les mouvements internes sont **invisibles** on-chain`,
        },
        right: {
          title: 'Non-custodial (auto-hébergé)',
          md: `- L'utilisateur détient la **seed**
- Application mobile, extension de navigateur, appareil dédié
- Aucun intermédiaire ne connaît l'utilisateur
- Pas de gel possible, sauf jetons gelables (USDT, USDC)
- Tous les mouvements sont **visibles** on-chain`,
        },
      },
      {
        type: 'table',
        headers: ['Type', 'Description', 'Ce que l\'enquêteur peut chercher'],
        rows: [
          ['Compte d\'exchange', 'Solde tenu par la plateforme (Coinhouse, Binance…)', 'Réquisition : identité, KYC, IP, historique, gel'],
          ['Application mobile', 'Portefeuille logiciel sur smartphone', 'Exploitation du téléphone : application, sauvegardes, captures'],
          ['Extension de navigateur', 'Portefeuille intégré au navigateur, très utilisé sur Ethereum', 'Exploitation de l\'ordinateur : profil de navigateur, fichiers de coffre chiffrés'],
          ['Portefeuille matériel', 'Petit appareil (format clé USB) qui garde la clé hors ligne', 'Saisie de l\'appareil ; code PIN ; seed souvent notée à part'],
          ['Papier / plaque métal', 'Seed écrite ou gravée', 'Fouille : coffre, livres, dos de cadres, boîtes'],
          ['Multisignature', 'Plusieurs clés nécessaires (ex. 2 sur 3)', 'Identifier tous les détenteurs de clés'],
        ],
      },
      { type: 'heading', text: 'En perquisition' },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : où se cachent les clés',
        md: `- Feuilles ou carnets portant **12 ou 24 mots anglais** numérotés, parfois mélangés à d'autres notes
- **Plaques métalliques** gravées ou à lettres poinçonnées (conçues pour résister au feu)
- **Portefeuilles matériels** : petits boîtiers USB ou à écran, parfois avec une carte de récupération vierge… ou remplie
- **Captures d'écran** de la seed dans la galerie photo, notes du téléphone, gestionnaire de mots de passe, messagerie envoyée « à soi-même »
- Fichiers de portefeuille sur ordinateur, extensions de navigateur, clés USB, sauvegardes cloud
- QR codes imprimés (une clé privée peut être encodée en QR code)`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Ne pas saisir la seed sur un appareil non maîtrisé', md: 'Ne tapez jamais la phrase dans une application ou un site pour « vérifier le solde » : vous exposeriez la clé et la preuve.' },
          { title: 'Constater et sécuriser', md: 'Photographiez et décrivez le support en procès-verbal, placez-le sous scellé. Traitez-le comme un objet de très grande valeur.' },
          { title: 'Aviser le magistrat', md: 'La seed donne accès aux fonds : les complices peuvent les vider à distance à tout moment. L\'urgence est réelle.' },
          { title: 'Transférer selon la procédure', md: 'Sur instruction du magistrat et avec les moyens prévus par votre service (portefeuille de saisie dédié, assistance des unités spécialisées), les fonds sont transférés vers une adresse sous contrôle de l\'État. Chaque étape est documentée (txid, horodatage).' },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Saisie des crypto-actifs',
        md: `La saisie des crypto-actifs relève du régime des **saisies pénales** et associe le magistrat, les enquêteurs spécialisés et, le cas échéant, l'**AGRASC** (agence de gestion et de recouvrement des avoirs saisis et confisqués). Les modalités pratiques (portefeuille de destination, conversion éventuelle) évoluent : référez-vous aux instructions en vigueur et à la leçon « Gel et saisie des crypto-actifs » (niveau 3).`,
      },
      {
        type: 'case',
        title: 'Cas : le carnet de recettes',
        md: `Lors d'une perquisition chez un suspect de blanchiment, rien de « crypto » n'apparaît à première vue. Un enquêteur remarque, au dos d'un carnet de recettes, 24 mots anglais numérotés de 1 à 24.

Le spécialiste, avec l'accord du magistrat et sur un poste dédié, dérive les adresses selon les chemins standards : la seed contrôle une adresse Bitcoin \`bc1q…\` contenant 1,8 BTC et une adresse Tron \`T…\` contenant 61 000 USDT. Les fonds sont transférés vers les portefeuilles de saisie dans l'heure, avant que les complices, alertés par l'interpellation, ne puissent les déplacer. Une demande de gel des USDT est adressée en parallèle à l'émetteur, par sécurité.`,
      },
      { type: 'heading', text: 'Ce que cela change pour l\'analyse' },
      {
        type: 'text',
        md: `- **Une personne = beaucoup d'adresses.** Un portefeuille HD crée souvent une nouvelle adresse à chaque réception (et une adresse de « rendu » à chaque paiement sur Bitcoin). Le solde d'une adresse n'est donc **pas** le patrimoine d'une personne.
- **Une adresse peut avoir plusieurs vies.** La même seed, et souvent la même adresse \`0x…\`, sert sur plusieurs chaînes EVM.
- **Une clé ne dit pas qui l'utilise.** Une seed partagée, volée ou détenue par plusieurs complices complique l'imputation.
- **L'auto-hébergement n'est pas un mur.** Les fonds finissent souvent par transiter vers un exchange pour être convertis en euros : c'est là que l'identification devient possible.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Escroqueries visant la seed',
        md: `Faux supports techniques, faux sites de portefeuille, faux « services de récupération » : de nombreuses escroqueries consistent simplement à obtenir la phrase de récupération de la victime. Un vrai prestataire ne la demande **jamais**. Lors d'une plainte, demandez si la victime a saisi ses mots quelque part : la date de cette saisie est souvent la date réelle de la compromission.`,
      },
      {
        type: 'check',
        q: 'Une adresse Bitcoin d\'un suspect affiche un solde de 0. Peut-on conclure qu\'il ne détient plus de bitcoins ?',
        options: [
          'Oui, le solde est public',
          'Non : son portefeuille peut contenir des dizaines d\'autres adresses, dont des adresses de rendu',
          'Oui, s\'il n\'a qu\'une seed',
          'Non, car les soldes Bitcoin sont toujours faux',
        ],
        answer: 1,
        explain: 'Un portefeuille HD gère de nombreuses adresses. Il faut regrouper les adresses (clustering, saisie de la seed) avant de parler de patrimoine.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Portefeuille (wallet)', def: 'Logiciel ou appareil qui conserve des clés et signe des transactions. Ne contient pas les fonds.' },
          { term: 'Seed / phrase de récupération', def: '12 ou 24 mots (BIP39) dont dérivent toutes les clés d\'un portefeuille HD.' },
          { term: 'Portefeuille HD', def: 'Hiérarchique déterministe : toutes les clés sont recalculables à partir d\'une graine unique.' },
          { term: 'Passphrase', def: 'Mot de passe facultatif ajouté à la seed ; change complètement le portefeuille obtenu.' },
          { term: 'Chemin de dérivation', def: 'Indique quelle branche de l\'arbre de clés calculer (ex. m/84\'/0\'/0\'/0/0).' },
          { term: 'Custodial', def: 'Un tiers détient les clés pour le compte de l\'utilisateur.' },
          { term: 'Portefeuille matériel', def: 'Appareil dédié qui garde la clé privée hors ligne et signe les transactions.' },
          { term: 'Multisignature', def: 'Dispositif exigeant plusieurs signatures (ex. 2 sur 3) pour dépenser.' },
        ],
      },
    ],
    keyPoints: [
      'Un portefeuille garde des clés, pas des fonds : qui détient la clé contrôle les fonds.',
      'Une phrase de récupération de 12 ou 24 mots régénère toutes les clés, sur plusieurs blockchains.',
      'Custodial : un prestataire identifiable détient les clés ; non-custodial : l\'utilisateur seul.',
      'En perquisition, la seed est un objet de très grande valeur : ne jamais la saisir sur un appareil non maîtrisé, aviser le magistrat.',
      'Le solde d\'une adresse n\'est pas le patrimoine d\'une personne.',
      'Un vrai prestataire ne demande jamais la seed : c\'est le cœur de nombreuses escroqueries.',
    ],
    quiz: [
      {
        q: 'Que permet une phrase de récupération de 24 mots ?',
        options: [
          'Uniquement de consulter le solde d\'une adresse',
          'De régénérer toutes les clés privées du portefeuille, donc de dépenser les fonds',
          'D\'identifier le titulaire auprès d\'un exchange',
          'De bloquer les transactions entrantes',
        ],
        answer: 1,
        explain: 'La seed permet de dériver toutes les clés du portefeuille HD : elle donne un contrôle total des fonds.',
      },
      {
        kind: 'truefalse',
        q: 'Les mêmes 24 mots, avec ou sans passphrase, donnent accès aux mêmes adresses.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La passphrase modifie la graine : avec une passphrase différente, on obtient un portefeuille entièrement différent. Un portefeuille « vide » peut en cacher un autre.',
      },
      {
        q: 'Une adresse commence par « T » et une autre par « bc1q ». Peuvent-elles dériver de la même seed ?',
        options: [
          'Non, une seed ne sert qu\'à une seule blockchain',
          'Oui : une seed peut produire des adresses sur plusieurs chaînes, selon des chemins de dérivation différents',
          'Seulement si la seed fait 12 mots',
          'Seulement sur un exchange',
        ],
        answer: 1,
        explain: 'Le chemin de dérivation (m/84\'/0\'… pour Bitcoin, m/44\'/195\'… pour Tron) indique au portefeuille quelle branche calculer.',
      },
      {
        kind: 'multi',
        q: 'Lors d\'une perquisition, quels objets peuvent donner accès à des crypto-actifs ? (plusieurs réponses)',
        options: [
          'Une feuille portant 24 mots anglais numérotés',
          'Une plaque métallique gravée de mots',
          'Une capture d\'écran dans la galerie du téléphone',
          'Un portefeuille matériel au format clé USB',
          'La facture d\'achat d\'un portefeuille matériel',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Les quatre premiers supports peuvent contenir ou protéger une clé ou une seed. La facture ne donne aucun accès, mais c\'est un indice précieux : elle signale qu\'un appareil (et sa seed) existe et doit être recherché.',
      },
      {
        q: 'Vous découvrez une seed en perquisition. Quelle est la mauvaise pratique ?',
        options: [
          'La décrire et la placer sous scellé',
          'Aviser le magistrat rapidement',
          'La saisir dans une application grand public sur votre téléphone personnel pour voir le solde',
          'Faire appel aux enquêteurs spécialisés pour le transfert vers un portefeuille de saisie',
        ],
        answer: 2,
        explain: 'Saisir la seed sur un appareil non maîtrisé expose la clé, altère la preuve et peut compromettre les fonds.',
      },
      {
        q: 'Quelle différence majeure entre un compte d\'exchange et un portefeuille auto-hébergé, pour l\'enquêteur ?',
        options: [
          'Aucune',
          'L\'exchange connaît son client et peut répondre à une réquisition ou geler le compte ; le portefeuille auto-hébergé n\'a pas d\'intermédiaire',
          'Le portefeuille auto-hébergé est toujours anonyme et intraçable',
          'L\'exchange ne garde aucune donnée',
        ],
        answer: 1,
        explain: 'Le custodial offre un interlocuteur. L\'auto-hébergé reste traçable on-chain, mais l\'identification passe par d\'autres voies.',
      },
      {
        q: 'Une victime déclare avoir « vérifié son portefeuille » sur un site reçu par message, en saisissant ses 12 mots. Ses fonds ont disparu le lendemain. Que retenir ?',
        options: [
          'C\'est un bug de la blockchain',
          'La saisie de la seed sur le faux site est très probablement la compromission ; sa date et l\'URL du site sont des éléments clés',
          'L\'exchange a gelé ses fonds',
          'Il faut attendre que les fonds reviennent',
        ],
        answer: 1,
        explain: 'Le site a capturé la seed ; l\'escroc a ensuite signé des transactions parfaitement valides. L\'URL, la date et le message reçu orientent l\'enquête.',
      },
    ],
    flashcards: [
      { front: 'Que contient un portefeuille crypto ?', back: 'Des clés (et l\'interface pour signer). Les fonds restent sur la blockchain.' },
      { front: 'BIP39', back: 'Norme des phrases de récupération : 12 ou 24 mots parmi une liste de 2 048 mots anglais.' },
      { front: 'Portefeuille HD', back: 'Hiérarchique déterministe : toutes les clés dérivent d\'une seule graine (BIP32).' },
      { front: 'Passphrase (« 25e mot »)', back: 'Mot de passe facultatif ajouté à la seed : il ouvre un portefeuille différent.' },
      { front: 'Chemin BIP84', back: 'm/84\'/0\'/0\'/0/0 → adresses Bitcoin SegWit natif bc1q.' },
      { front: 'Chemin Tron', back: 'm/44\'/195\'/0\'/0/0 → adresses T….' },
      { front: 'Custodial vs non-custodial', back: 'Custodial : le prestataire détient les clés (KYC, gel). Non-custodial : l\'utilisateur détient la seed.' },
      { front: 'Priorité en perquisition', back: 'Rechercher seed, appareils et captures ; ne jamais saisir la seed sur un appareil non maîtrisé ; aviser le magistrat.' },
      { front: 'Solde d\'adresse', back: 'N\'est pas le patrimoine : un portefeuille gère de nombreuses adresses.' },
      { front: 'Un prestataire peut-il demander votre seed ?', back: 'Jamais. Toute demande de seed est une escroquerie.' },
    ],
  },
]
