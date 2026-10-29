// Niveau 4 — Hacks DeFi et coopération internationale.
import type { Lesson } from '../model'

const defiExploits: Lesson = {
  id: 'defi-exploits',
  title: 'Hacks DeFi : flash loans, oracles, MEV',
  level: 4,
  track: 'typologies',
  minutes: 35,
  summary:
    'Anatomie d\'un piratage DeFi : préparation, transaction d\'attaque, extraction, blanchiment. Flash loans, manipulation d\'oracle, réentrance, défauts de contrôle d\'accès et compromission de clés ; MEV et attaques sandwich ; le schéma de blanchiment type après un hack et les réflexes des premières heures.',
  objectives: [
    'Décrire les phases d\'un exploit DeFi et repérer les signaux de préparation on-chain.',
    'Expliquer le rôle d\'un flash loan et le mécanisme d\'une manipulation d\'oracle ou d\'une réentrance.',
    'Distinguer exploit de contrat, compromission de clés et MEV (sandwich), et leurs enjeux de qualification.',
    'Anticiper le schéma de blanchiment post-hack et organiser la réponse des premières 24 heures.',
  ],
  prerequisites: ['dex-defi', 'smart-contracts-lecture', 'bridges', 'privacy-pools'],
  practice: ['defi-exploit', 'rugpull-bsc'],
  blocks: [
    {
      type: 'text',
      md: `À 04:17 UTC, le protocole de prêt **Lendora** perd 9 400 ETH. Il n'y a eu ni intrusion sur un serveur, ni mot de passe volé : une seule transaction, publique, parfaitement valide aux yeux de la blockchain, a vidé ses réserves. L'attaquant a emprunté plusieurs dizaines de millions de dollars sans garantie, faussé un prix, emprunté contre un collatéral surévalué, puis tout remboursé — en 13 secondes.

Comprendre la mécanique d'un exploit n'est pas réservé aux auditeurs de code : c'est indispensable pour identifier les adresses de l'attaquant, dater la préparation, anticiper le blanchiment et qualifier les faits.`,
    },
    { type: 'heading', text: 'Les quatre phases d\'un exploit' },
    {
      type: 'steps',
      items: [
        { title: '1. Préparation', md: `L'attaquant finance une adresse neuve pour le gaz — souvent par un **retrait de pool de confidentialité** ou un échangeur sans KYC —, déploie un **contrat d'attaque**, parfois teste sur un réseau de test ou avec de petits montants. Ces transactions précèdent l'attaque de quelques minutes à quelques jours.` },
        { title: '2. Exécution', md: `Une transaction (ou une courte série) appelle le contrat d'attaque : emprunt flash, manipulation, extraction, remboursement. Tout est atomique : si une étape échoue, rien n'a lieu.` },
        { title: '3. Consolidation', md: `Les gains (souvent des jetons variés) sont rassemblés et rapidement convertis en actifs non gelables (ETH, DAI) pour échapper aux gels des émetteurs de stablecoins.` },
        { title: '4. Blanchiment', md: `Fractionnement, pools de confidentialité, bridges, conversion en BTC, échangeurs, OTC — ou négociation d'une restitution contre une « prime ».` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : la préparation est la phase la plus bavarde',
      md: `La transaction d'attaque est sophistiquée ; la préparation, elle, est souvent bâclée. Remontez le **financement du gaz** du contrat d'attaque et de son déployeur : retrait de pool (démixable par timing et montant), échangeur instantané (réquisitionnable avec le hash), voire exchange régulé. Regardez aussi les **tests** : un même déployeur qui a essayé l'attaque sur un fork ou sur une autre chaîne laisse des traces datées.`,
    },
    { type: 'heading', text: 'Flash loans : la puissance de feu' },
    {
      type: 'text',
      md: `Un **flash loan** est un prêt **sans garantie**, à condition d'être remboursé (avec une petite commission) **dans la même transaction**. Si le remboursement n'a pas lieu, la transaction entière est annulée, comme si rien ne s'était passé : le prêteur ne prend aucun risque.

Le flash loan n'est pas une vulnérabilité : il est utilisé légitimement pour des arbitrages ou des refinancements. Mais il donne à n'importe qui, pour quelques secondes, une puissance financière de plusieurs dizaines ou centaines de millions de dollars — de quoi déplacer un prix, voter avec une majorité de jetons de gouvernance ou saturer un mécanisme mal conçu.

Dans la transaction, il se repère par un emprunt et un remboursement du même actif auprès du même protocole, encadrant toutes les autres opérations.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Flash loan', def: 'Prêt sans garantie remboursé dans la même transaction, sinon annulé.' },
        { term: 'Oracle', def: 'Source de prix utilisée par un contrat (prix d\'un pool AMM, agrégateur de prix hors chaîne, moyenne temporelle).' },
        { term: 'TWAP', def: 'Prix moyen pondéré dans le temps, plus difficile à manipuler qu\'un prix instantané.' },
        { term: 'Réentrance', def: 'Rappel d\'une fonction avant que l\'appel précédent n\'ait mis à jour l\'état, permettant de retirer plusieurs fois.' },
        { term: 'Contrôle d\'accès', def: 'Restriction des fonctions sensibles à certaines adresses ; son absence permet à n\'importe qui de les appeler.' },
        { term: 'MEV', def: 'Valeur extractible par l\'ordonnancement des transactions dans un bloc (arbitrage, liquidation, sandwich).' },
        { term: 'Attaque sandwich', def: 'Achat juste avant et vente juste après la transaction d\'une victime, pour capter son glissement de prix.' },
        { term: 'Searcher / builder', def: 'Acteurs qui repèrent les opportunités MEV / qui assemblent les blocs proposés aux validateurs.' },
      ],
    },
    { type: 'heading', text: 'La manipulation d\'oracle' },
    {
      type: 'text',
      md: `Un protocole de prêt doit connaître la valeur du collatéral déposé. S'il la lit dans le **prix instantané** d'un pool AMM peu liquide, un attaquant peut :

1. emprunter massivement par flash loan ;
2. acheter le jeton de collatéral dans ce pool, ce qui fait **monter son prix** (glissement) ;
3. déposer ce jeton comme collatéral, désormais **surévalué**, et emprunter contre lui les actifs de valeur du protocole ;
4. revendre le jeton (le prix retombe), rembourser le flash loan ;
5. conserver les actifs empruntés, laissant au protocole un collatéral sans valeur.`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 'fl', label: 'Prêteur flash', kind: 'contract', sub: '30 000 ETH empruntés' },
        { id: 'atk', label: 'Contrat d\'attaque', kind: 'suspect', sub: '0x5e1c…' },
        { id: 'pool', label: 'Pool Uniswap LND/ETH', kind: 'dex', sub: 'prix ×7' },
        { id: 'lend', label: 'Lendora', kind: 'contract', sub: 'oracle = prix du pool' },
        { id: 'eoa', label: 'EOA de l\'attaquant', kind: 'suspect', sub: '0x91ab…' },
      ],
      edges: [
        { from: 'fl', to: 'atk', label: 'flash loan' },
        { from: 'atk', to: 'pool', label: 'achat massif de LND' },
        { from: 'atk', to: 'lend', label: 'dépôt LND surévalué' },
        { from: 'lend', to: 'atk', label: 'emprunt 9 400 ETH' },
        { from: 'atk', to: 'fl', label: 'remboursement + commission' },
        { from: 'atk', to: 'eoa', label: 'profit' },
      ],
      caption: 'Tout se déroule dans une seule transaction. Les logs Transfer et Swap permettent de reconstituer chaque étape et son montant.',
    },
    { type: 'widget', id: 'amm-swap', caption: 'Achetez une grande quantité dans un pool peu liquide : observez le glissement de prix qu\'exploite une manipulation d\'oracle.' },
    {
      type: 'check',
      q: 'Pourquoi le flash loan ne fait-il prendre aucun risque au prêteur ?',
      options: [
        'Parce que l\'emprunteur dépose une garantie',
        'Parce que si le prêt n\'est pas remboursé dans la même transaction, toute la transaction est annulée',
        'Parce que le prêteur peut geler l\'emprunteur',
        'Parce que les montants sont faibles',
      ],
      answer: 1,
      explain: 'L\'atomicité de la transaction garantit le remboursement : sans lui, rien de ce qui a été fait n\'est enregistré.',
    },
    { type: 'heading', text: 'Réentrance, contrôle d\'accès, clés compromises' },
    {
      type: 'text',
      md: `- **Réentrance** : un contrat envoie des fonds (appel externe) **avant** de mettre à jour le solde de l'utilisateur. Le contrat d'attaque, qui reçoit les fonds, rappelle aussitôt la fonction de retrait : le solde n'ayant pas encore été décrémenté, le retrait se répète. L'exemple historique est **The DAO** en 2016, dont l'exploitation a conduit à la scission entre Ethereum et Ethereum Classic.
- **Contrôle d'accès** : une fonction d'administration (\`mint\`, \`setOwner\`, \`upgradeTo\`) laissée appelable par tous, ou une initialisation jamais faite.
- **Erreurs de logique et d'arrondi** : calculs de parts, de taux ou de conversion exploitables à grande échelle.
- **Compromission de clés et d'infrastructure** : vol des clés de validateurs d'un bridge, compromission de l'interface de signature d'un multisig, d'un front-end ou d'un fournisseur. Ces attaques **hors chaîne** pèsent très lourd en valeur : le piratage du bridge Ronin en 2022 et celui de l'exchange Bybit en 2025, attribués publiquement par le FBI à des acteurs nord-coréens, en relèvent.`,
    },
    {
      type: 'table',
      headers: ['Type', 'Ce que l\'on voit on-chain', 'Indice typique'],
      rows: [
        ['Manipulation d\'oracle', 'Flash loan, swaps massifs, dépôt de collatéral, emprunts, swaps inverses', 'Variation de prix extrême à l\'intérieur d\'une transaction'],
        ['Réentrance', 'Appels répétés à la même fonction dans une transaction', 'Traces imbriquées, retraits multiples pour un seul dépôt'],
        ['Contrôle d\'accès', 'Appel d\'une fonction d\'administration par une adresse inconnue', 'Changement de propriétaire, mint massif, mise à niveau'],
        ['Clés compromises', 'Transactions valides signées par les clés légitimes', 'Destinations inhabituelles, horaires anormaux, vidage complet'],
        ['Front-end compromis', 'Victimes multiples signant des approvals vers un même contrat', 'Approvals vers une adresse étrangère au protocole'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une transaction signée par la bonne clé n\'est pas une transaction légitime',
      md: `Dans une compromission de clés, rien ne distingue techniquement l'attaque d'une opération normale : la signature est valide. L'analyse porte alors sur le **contexte** (destinations, horaires, enchaînement) et sur les investigations hors chaîne (postes de travail, journaux, hameçonnage des signataires). Ne concluez pas trop vite à un « exploit de smart contract ».`,
    },
    { type: 'heading', text: 'MEV et attaques sandwich' },
    {
      type: 'compare',
      left: {
        title: 'Attaque sandwich',
        md: `1. Un bot repère dans la mempool un gros achat avec une tolérance de glissement large.
2. Il achète juste **avant** (même bloc, position précédente).
3. La victime achète à un prix dégradé.
4. Le bot revend juste **après**.

On-chain : trois transactions consécutives dans le bloc, la première et la dernière émises par le même bot ou contrat.`,
      },
      right: {
        title: 'Exploit de protocole',
        md: `Le protocole lui-même perd ses réserves, au profit d'un attaquant qui détourne sa logique.

On-chain : une transaction d'attaque complexe, un contrat d'attaque déployé peu avant, des pertes concentrées sur le protocole.

La victime est le protocole et ses déposants, pas un utilisateur isolé.`,
      },
    },
    {
      type: 'text',
      md: `La qualification pénale du MEV est **débattue** : l'arbitrage et la liquidation sont des activités admises, l'attaque sandwich exploite une tolérance de glissement consentie par l'utilisateur, et seuls certains comportements (manipulation délibérée d'infrastructure, tromperie) ont donné lieu à des poursuites à l'étranger. Pour une plainte isolée de « sandwich », documentez les trois transactions et le préjudice, et laissez l'appréciation au magistrat.`,
    },
    {
      type: 'check',
      q: 'Dans un bloc, on observe : achat de 40 ETH de jeton X par 0xBot, achat de 120 ETH de X par la victime, vente de X par 0xBot. De quoi s\'agit-il probablement ?',
      options: [
        'D\'une manipulation d\'oracle',
        'D\'une attaque sandwich (MEV)',
        'D\'une réentrance',
        'D\'un flash loan',
      ],
      answer: 1,
      explain: 'Achat avant, transaction de la victime au milieu, vente après, par le même acteur : signature caractéristique d\'un sandwich.',
    },
    { type: 'heading', text: 'Après le hack : le schéma de blanchiment type' },
    {
      type: 'flow',
      nodes: [
        { id: 'p', label: 'Protocole exploité', kind: 'contract' },
        { id: 'a', label: 'Adresse de l\'attaquant', kind: 'suspect' },
        { id: 'dex', label: 'DEX', kind: 'dex', sub: 'jetons → ETH/DAI' },
        { id: 'split', label: 'Dizaines d\'adresses', kind: 'wallet', sub: 'fractionnement' },
        { id: 'pool', label: 'Tornado Cash', kind: 'mixer' },
        { id: 'br', label: 'ArcBridge / swaps inter-chaînes', kind: 'bridge', sub: 'vers BTC, Tron…' },
        { id: 'otc', label: 'SatsDesk OTC / échangeurs', kind: 'exchange', sub: 'sortie fiat' },
      ],
      edges: [
        { from: 'p', to: 'a', label: 'gains' },
        { from: 'a', to: 'dex', label: 'heures' },
        { from: 'dex', to: 'split' },
        { from: 'split', to: 'pool', label: 'jours' },
        { from: 'split', to: 'br' },
        { from: 'pool', to: 'br', dashed: true },
        { from: 'br', to: 'otc', label: 'semaines, mois' },
      ],
      caption: 'Schéma récurrent dans les rapports publics : conversion rapide en actifs non gelables, fractionnement, mélange, changement de chaîne, sortie lente.',
    },
    {
      type: 'steps',
      items: [
        { title: 'Heure 0 à 2 : identifier et étiqueter', md: `Contrat d'attaque, déployeur, adresses de réception. Partager ces adresses avec les plateformes et les équipes de sécurité de l'écosystème.` },
        { title: 'Heure 0 à 6 : geler ce qui peut l\'être', md: `Stablecoins centralisés encore détenus (demande urgente à l'émetteur), fonds arrivant sur des exchanges (portails forces de l'ordre). C'est la fenêtre où la conversion vers l'ETH n'est pas terminée.` },
        { title: 'Jour 1 : préserver', md: `Transactions brutes, traces, état du contrat, messages on-chain, communications du protocole ; demandes de préservation auprès des hébergeurs du front-end et des fournisseurs RPC.` },
        { title: 'Jours suivants : surveiller', md: `Alertes sur toutes les adresses : chaque mouvement vers un service régulé est une opportunité de gel et de réquisition.` },
        { title: 'En parallèle : la négociation', md: `Les protocoles proposent souvent une « prime » contre restitution, parfois par message dans l'input data d'une transaction. Ces échanges sont des pièces de procédure : capturez-les.` },
      ],
    },
    {
      type: 'case',
      title: 'Cas — L\'exploit Lendora',
      md: `**J−2, 22:40 UTC** : \`0x91ab…e3\` reçoit 1 ETH d'un retrait Tornado Cash (pool 1 ETH) sans relayeur — l'adresse avait reçu 0,05 ETH d'un échangeur instantané une heure plus tôt pour payer le gaz.

**J−1, 03:02 UTC** : \`0x91ab…e3\` déploie le contrat \`0x5e1c…\`.

**J, 04:17 UTC** : transaction d'attaque : flash loan de 30 000 ETH, achat massif de jetons LND sur Uniswap (prix multiplié par 7), dépôt de LND chez Lendora, emprunt de 9 400 ETH, revente, remboursement. Profit transféré à \`0x91ab…e3\`.

**J, 04:30 à 05:10 UTC** : les 2,1 M USDC également empruntés sont échangés contre de l'ETH sur un DEX — sauf 380 000 USDC restés sur une adresse intermédiaire, que l'émetteur gèle à 06:20 UTC sur demande.

**J+1** : 32,4 ETH partent vers Tornado Cash (voir la leçon sur les pools), le reste est fractionné sur 40 adresses.

Pistes : l'échangeur instantané qui a financé le gaz (hash connu), le démixage du dépôt Cyclone, les points de sortie à surveiller. Le gel partiel n'a été possible que parce que la demande est partie dans les deux heures.`,
    },
    {
      type: 'check',
      q: 'Pourquoi les attaquants convertissent-ils rapidement les stablecoins volés en ETH ou en DAI ?',
      options: [
        'Pour réduire les frais',
        'Parce que les émetteurs de stablecoins centralisés peuvent geler les adresses, contrairement à l\'ETH',
        'Parce que l\'ETH est anonyme',
        'Par obligation légale',
      ],
      answer: 1,
      explain: 'USDT et USDC ont une fonction de gel au niveau du contrat. L\'ETH natif n\'en a pas : d\'où la course entre la conversion et la demande de gel.',
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Qualifier un exploit',
      md: `La défense invoque parfois l'argument du « code fait loi » : le contrat aurait permis l'opération, donc elle serait licite. En droit français, la qualification se discute au cas par cas avec le magistrat ; plusieurs fondements sont envisageables selon les faits (atteintes aux systèmes de traitement automatisé de données prévues aux articles 323-1 et suivants du code pénal, escroquerie par manœuvres frauduleuses, etc.). Vérifiez l'état de la jurisprudence, encore peu fournie, et documentez précisément ce qui relève d'une **tromperie** ou d'un **contournement** du fonctionnement prévu (manipulation de prix, usurpation de fonction d'administration, clés volées).`,
    },
  ],
  keyPoints: [
    'Un exploit se déroule en quatre phases : préparation, exécution, consolidation, blanchiment ; la préparation est la plus exploitable.',
    'Le flash loan est un amplificateur atomique, pas une vulnérabilité en soi.',
    'Manipulation d\'oracle : prix instantané d\'un pool peu liquide faussé pour surévaluer un collatéral.',
    'Réentrance : appel externe avant mise à jour de l\'état ; contrôle d\'accès : fonction sensible appelable par tous.',
    'Les compromissions de clés et d\'infrastructure pèsent très lourd en valeur : signature valide ne veut pas dire opération légitime.',
    'Après un hack : conversion rapide en actifs non gelables, fractionnement, mélange, bridges, sortie lente — geler dans les premières heures.',
    'La qualification pénale (y compris du MEV) se discute au cas par cas avec le magistrat.',
  ],
  quiz: [
    {
      q: 'Qu\'est-ce qui caractérise un flash loan ?',
      options: [
        'Un prêt garanti par un NFT',
        'Un prêt sans garantie, remboursé dans la même transaction, faute de quoi tout est annulé',
        'Un prêt accordé par un exchange centralisé',
        'Un prêt à taux nul sur un an',
      ],
      answer: 1,
      explain: 'L\'atomicité de la transaction protège le prêteur : le flash loan donne une puissance financière temporaire considérable.',
    },
    {
      q: 'Quels éléments signalent une manipulation d\'oracle dans une transaction ?',
      kind: 'multi',
      options: [
        'Un flash loan encadrant les opérations',
        'Des swaps massifs faisant varier fortement un prix à l\'intérieur de la transaction',
        'Un emprunt contre un collatéral dont le prix vient d\'être gonflé',
        'Trois transactions consécutives d\'un bot autour d\'une victime',
      ],
      answer: [0, 1, 2],
      explain: 'Le dernier élément décrit une attaque sandwich, phénomène MEV distinct.',
    },
    {
      q: 'Une réentrance exploite :',
      options: [
        'Un prix d\'oracle manipulé',
        'Un appel externe effectué avant la mise à jour de l\'état du contrat',
        'Une clé privée volée',
        'Un bridge mal configuré',
      ],
      answer: 1,
      explain: 'Le contrat d\'attaque rappelle la fonction vulnérable avant que le solde n\'ait été mis à jour, et retire plusieurs fois.',
    },
    {
      q: 'Une transaction signée avec les clés légitimes d\'un multisig ne peut pas faire partie d\'un piratage.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Les compromissions de clés ou d\'interfaces de signature produisent des transactions techniquement valides ; plusieurs des plus gros piratages publics en relèvent.',
    },
    {
      q: 'Quelle est la priorité absolue dans les deux premières heures suivant un exploit ?',
      options: [
        'Rédiger le rapport final',
        'Identifier les adresses de l\'attaquant et demander le gel des actifs gelables (stablecoins, fonds arrivant sur des exchanges)',
        'Attendre la fin du blanchiment pour tout tracer d\'un coup',
        'Contacter les médias',
      ],
      answer: 1,
      explain: 'La conversion vers des actifs non gelables est rapide : seuls les gels demandés très tôt aboutissent.',
    },
    {
      q: 'Quelles pistes la phase de préparation d\'un exploit offre-t-elle typiquement ?',
      kind: 'multi',
      options: [
        'Le financement du gaz du déployeur (pool, échangeur, exchange)',
        'Le déploiement du contrat d\'attaque, daté',
        'Des tests sur un fork ou une autre chaîne',
        'La clé privée de l\'attaquant publiée dans le contrat',
      ],
      answer: [0, 1, 2],
      explain: 'Aucune clé privée n\'est jamais publiée on-chain. Financement, déploiement et tests sont en revanche des traces datées et exploitables.',
    },
    {
      q: 'Dans une attaque sandwich, d\'où vient le profit de l\'attaquant ?',
      options: [
        'Des réserves du protocole',
        'Du glissement de prix subi par la victime, entre l\'achat précédant et la vente suivant sa transaction',
        'D\'un flash loan non remboursé',
        'D\'une commission de l\'exchange',
      ],
      answer: 1,
      explain: 'Le bot capte l\'écart de prix créé par la transaction de la victime, dans la limite de la tolérance de glissement qu\'elle a acceptée.',
    },
  ],
  flashcards: [
    { front: 'Flash loan', back: 'Prêt sans garantie remboursé dans la même transaction, sinon annulé : amplificateur, pas vulnérabilité.' },
    { front: 'Manipulation d\'oracle', back: 'Fausser un prix instantané d\'AMM pour surévaluer un collatéral et emprunter contre lui.' },
    { front: 'TWAP', back: 'Prix moyen sur une période, plus résistant à la manipulation qu\'un prix instantané.' },
    { front: 'Réentrance', back: 'Rappel d\'une fonction avant mise à jour de l\'état : retraits multiples. Exemple historique : The DAO (2016).' },
    { front: 'Attaque sandwich', back: 'Achat avant / transaction victime / vente après, dans le même bloc, par le même acteur.' },
    { front: 'Phases d\'un exploit', back: 'Préparation → exécution → consolidation → blanchiment.' },
    { front: 'Pourquoi convertir en ETH/DAI ?', back: 'Échapper au gel des stablecoins centralisés.' },
    { front: 'Fenêtre de gel post-hack', back: 'Les premières heures, avant la fin des conversions.' },
    { front: 'Compromission de clés', back: 'Transactions valides signées par les vraies clés : analyser le contexte et le hors-chaîne.' },
    { front: 'Message on-chain', back: 'Texte dans l\'input data (négociation de prime) : pièce à capturer.' },
  ],
}

const cooperation: Lesson = {
  id: 'cooperation-internationale',
  title: 'Coopération internationale et entraide',
  level: 4,
  track: 'enquete',
  minutes: 35,
  summary:
    'Les fonds traversent les frontières en secondes, les demandes d\'entraide en mois. Cartographie des canaux (réquisition directe, coopération volontaire, DEE, entraide pénale, Europol, Eurojust, réseau 24/7, CRF), distinction renseignement / preuve, délais réels, gel transfrontalier et rédaction d\'une demande efficace.',
  objectives: [
    'Choisir le bon canal selon le lieu d\'établissement du prestataire et la nature de la donnée recherchée.',
    'Distinguer les canaux de renseignement policier des voies judiciaires produisant une preuve.',
    'Bâtir une stratégie réaliste : préserver et geler d\'abord, formaliser ensuite, en parallèle.',
    'Rédiger une demande internationale précise, compréhensible et exécutable.',
  ],
  prerequisites: ['requisitions', 'gel-saisie', 'exchanges'],
  practice: ['pig-butchering-tron', 'chain-hopping'],
  blocks: [
    {
      type: 'text',
      md: `Votre traçage est terminé : les fonds d'une escroquerie ont abouti chez un exchange établi au Luxembourg, un autre aux Seychelles, un courtier OTC à Hong Kong, et une partie dort en USDT sur Tron. Le suspect vit probablement à l'étranger. **Le travail technique est fait ; le travail de coopération commence.**

C'est souvent ici que les affaires se gagnent ou se perdent : un gel demandé trop tard, une demande imprécise renvoyée par l'autorité étrangère, une information policière inutilisable devant le tribunal faute d'avoir été régularisée. Cette leçon vous donne la carte et la boussole. Les textes et circuits évoluent : vérifiez toujours la version en vigueur et les instructions de votre parquet.`,
    },
    { type: 'heading', text: 'La carte des canaux' },
    {
      type: 'table',
      headers: ['Canal', 'Quand l\'utiliser', 'Ce qu\'il produit', 'Délai indicatif'],
      rows: [
        ['Réquisition directe', 'Prestataire établi en France (cadre de l\'enquête : réquisitions du CPP)', 'Preuve directement versée en procédure', 'Jours à semaines'],
        ['Coopération volontaire', 'Prestataire étranger disposant d\'un portail forces de l\'ordre', 'Données de base, gel volontaire ; valeur probante à apprécier, régularisation parfois nécessaire', 'Jours à semaines'],
        ['Décision d\'enquête européenne (DEE)', 'Preuve à recueillir dans un autre État membre (hors Irlande et Danemark)', 'Preuve recueillie par l\'autorité d\'exécution', 'Directive : 30 jours pour la reconnaissance, 90 jours pour l\'exécution'],
        ['Entraide pénale internationale', 'États hors UE (conventions bilatérales ou multilatérales)', 'Preuve, actes d\'enquête, gel', 'Plusieurs mois, parfois plus d\'un an'],
        ['Europol (SIENA, EC3)', 'Échange d\'informations entre services, analyse, coordination', 'Renseignement, appui opérationnel', 'Heures à jours'],
        ['Eurojust', 'Coordination judiciaire, équipes communes d\'enquête, blocages d\'exécution', 'Coordination, facilitation, ECE', 'Variable'],
        ['Réseau 24/7 (Convention de Budapest)', 'Préservation rapide de données informatiques', 'Conservation en attente de la demande formelle', 'Heures à jours'],
        ['CRF (TRACFIN ↔ homologues, Groupe Egmont)', 'Renseignement financier', 'Renseignement, non directement utilisable comme preuve', 'Variable'],
      ],
      caption: 'Les délais sont indicatifs : ils dépendent de l\'État, de l\'urgence motivée et de la qualité de la demande.',
    },
    {
      type: 'terms',
      items: [
        { term: 'DEE', def: 'Décision d\'enquête européenne (directive 2014/41/UE) : instrument de reconnaissance mutuelle pour obtenir une preuve dans un autre État membre.' },
        { term: 'Entraide (MLAT)', def: 'Demande d\'assistance pénale fondée sur un traité, transmise d\'autorité judiciaire à autorité judiciaire ou via les autorités centrales.' },
        { term: 'ECE', def: 'Équipe commune d\'enquête (JIT) : enquêteurs et magistrats de plusieurs États travaillant ensemble, avec partage direct des éléments.' },
        { term: 'EC3', def: 'Centre européen de lutte contre la cybercriminalité d\'Europol : analyse, expertise crypto, coordination.' },
        { term: 'SIENA', def: 'Application sécurisée d\'échange d\'informations d\'Europol entre services répressifs.' },
        { term: 'Réseau 24/7', def: 'Points de contact permanents prévus par la Convention de Budapest pour la préservation rapide de données.' },
        { term: 'Magistrat de liaison / ASI', def: 'Magistrats et attachés de sécurité intérieure en poste à l\'étranger, facilitateurs précieux des demandes.' },
      ],
    },
    { type: 'heading', text: 'Renseignement ou preuve : ne pas confondre' },
    {
      type: 'compare',
      left: {
        title: 'Canaux de renseignement',
        md: `Europol, Interpol, CRF, contacts informels, attachés.

- Rapides, souples.
- Permettent d'**orienter** : savoir qu'un compte existe, qu'un suspect est connu, qu'un gel volontaire est possible.
- Leur contenu n'est pas, en principe, destiné à être versé tel quel comme preuve ; il peut être soumis à des restrictions d'usage.`,
      },
      right: {
        title: 'Voies judiciaires',
        md: `Réquisition, DEE, entraide, ECE.

- Plus lentes, formalisées.
- Produisent des éléments **versables en procédure** et discutables contradictoirement.
- Supposent une demande précise, motivée, conforme aux exigences de l'État requis.`,
      },
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Régulariser',
      md: `Une donnée obtenue par un canal de renseignement ou par coopération volontaire doit souvent être **régularisée** par la voie judiciaire avant d'être utilisée comme preuve, et les restrictions d'usage posées par le service émetteur doivent être respectées. Mentionnez toujours en procédure **comment** une information a été obtenue. En cas de doute sur la valeur d'une réponse volontaire d'un prestataire étranger, interrogez le magistrat en charge.`,
    },
    { type: 'heading', text: 'Le temps : la contrainte qui structure tout' },
    {
      type: 'text',
      md: `Un exchange peut transférer des fonds en quelques secondes ; une demande d'entraide hors UE peut mettre des mois à être exécutée. La stratégie efficace consiste donc à **découpler** :

1. **ce qui est urgent et réversible** — préservation des données, gel volontaire ou conservatoire — via les canaux rapides ;
2. **ce qui est probatoire** — relevés, identité, journaux de connexion, saisie définitive — via les voies formelles, lancées **en parallèle** et non après.

Beaucoup de plateformes acceptent de bloquer temporairement un compte sur demande motivée d'une autorité, mais **lèvent le blocage** si aucun acte formel ne suit dans un délai qu'elles fixent elles-mêmes. Notez ce délai dès la première réponse et pilotez l'agenda en conséquence.`,
    },
    {
      type: 'steps',
      items: [
        { title: '1. Identifier le prestataire et sa juridiction', md: `Siège, entité contractante, agrément (registres des autorités, registre européen des prestataires agréés sous MiCA), portail forces de l'ordre, politique de coopération. Les fiches de conformité de SPECTRA donnent la voie usuelle.` },
        { title: '2. Désigner la bonne cible', md: `Adresse de dépôt (et non hot wallet), hash, horodatage UTC, montant : sans cela, le prestataire ne retrouvera pas le client.` },
        { title: '3. Préserver et geler', md: `Demande de préservation et de gel volontaire immédiatement ; pour un stablecoin, demande de gel à l'émetteur. Interdiction d'informer le client demandée explicitement.` },
        { title: '4. Lancer la voie formelle', md: `Réquisition, DEE ou entraide selon le cas, préparée avec le magistrat ; appui des magistrats de liaison, d'Eurojust ou d'Europol si nécessaire.` },
        { title: '5. Suivre', md: `Échéancier des délais (gel temporaire, délais d'exécution), relances, compléments. Une demande non suivie est une demande perdue.` },
      ],
    },
    { type: 'widget', id: 'exchange-flow', caption: 'Avant toute demande : dépôt client, balayage, hot wallet. Seule l\'adresse de dépôt désigne un client.' },
    {
      type: 'check',
      q: 'Un exchange étranger accepte de bloquer temporairement un compte et précise qu\'il lèvera le blocage sans acte formel sous 30 jours. Que faites-vous ?',
      options: [
        'J\'attends la fin de mon traçage pour lancer la demande formelle',
        'Je lance immédiatement, avec le magistrat, la voie formelle adaptée et je suis l\'échéance de près',
        'Je considère le compte comme saisi',
        'Je demande au client de ne pas retirer les fonds',
      ],
      answer: 1,
      explain: 'Le blocage volontaire n\'est qu\'un sursis. La voie formelle doit être engagée sans attendre, avec un suivi strict du délai annoncé.',
    },
    { type: 'heading', text: 'Geler par-delà les frontières' },
    {
      type: 'flow',
      nodes: [
        { id: 'enq', label: 'Enquêteur', kind: 'service', sub: 'identifie les fonds' },
        { id: 'tet', label: 'Tether', kind: 'service', sub: 'gel au niveau du contrat' },
        { id: 'kai', label: 'OKX', kind: 'exchange', sub: 'Seychelles, portail LE' },
        { id: 'nor', label: 'Bitstamp', kind: 'exchange', sub: 'Luxembourg (UE)' },
        { id: 'mag', label: 'Magistrat', kind: 'service', sub: 'décision de gel / saisie' },
        { id: 'hel', label: 'SwissBorg', kind: 'exchange', sub: 'Suisse (hors UE)' },
      ],
      edges: [
        { from: 'enq', to: 'tet', label: 'demande urgente' },
        { from: 'enq', to: 'kai', label: 'gel volontaire' },
        { from: 'enq', to: 'mag', label: 'rapport' },
        { from: 'mag', to: 'nor', label: 'DEE / certificat de gel UE' },
        { from: 'mag', to: 'hel', label: 'entraide' },
      ],
      caption: 'Plusieurs voies en parallèle : volontaire et rapide pour bloquer, formelle pour fonder la saisie.',
    },
    {
      type: 'text',
      md: `- **Émetteurs de stablecoins** : gel au niveau du contrat, souvent très rapide sur demande motivée d'une autorité. À demander dès l'identification de fonds en USDT ou USDC.
- **Dans l'Union européenne** : le règlement (UE) 2018/1805 organise la reconnaissance mutuelle des décisions de gel et de confiscation, au moyen de certificats standardisés transmis à l'État d'exécution.
- **Hors UE** : entraide pénale fondée sur les conventions applicables ; certains États exigent une décision judiciaire nationale, d'autres une double incrimination clairement établie.
- **Gestion des avoirs** : en France, l'AGRASC intervient dans la gestion des biens saisis, y compris des crypto-actifs ; anticipez avec elle les modalités de transfert et de conservation.`,
    },
    {
      type: 'case',
      title: 'Cas — Opération Aurora, quatre juridictions',
      md: `Escroquerie sentimentale et faux trading : 312 000 USDT-TRC20 tracés au 3 mars.

- **J0, 16:00** : 41 000 USDT dorment sur une adresse intermédiaire Tron → demande de gel à l'émetteur via son portail. **Gel effectif J+1, 09:30.**
- **J0, 17:30** : 118 000 USDT déposés chez OKX (Seychelles) → demande de gel volontaire et de préservation via le portail forces de l'ordre. Réponse J+3 : compte bloqué 60 jours, identité communiquée à titre de renseignement.
- **J+2** : 96 000 USDT chez Bitstamp (Luxembourg) → la plateforme bloque à titre conservatoire et indique qu'une DEE est nécessaire pour les relevés complets. DEE émise J+9 par le magistrat, exécutée J+52.
- **J+4** : 57 000 USDT chez SwissBorg (Suisse) → demande d'entraide préparée avec le magistrat, appui du magistrat de liaison. Exécution partielle à J+140.

Bilan : 41 000 USDT gelés en 18 heures grâce à l'émetteur, 214 000 USDT bloqués dans les délais grâce au parallélisme des voies. Les montants non gelés sont ceux qui avaient déjà quitté les adresses identifiées avant J0.`,
    },
    {
      type: 'check',
      q: 'Vous devez obtenir des relevés bancaires et de connexion d\'un exchange établi en Estonie. Quel est l\'instrument judiciaire de principe ?',
      options: [
        'Une demande d\'entraide hors UE',
        'Une décision d\'enquête européenne (DEE)',
        'Une notice Interpol',
        'Un message SIENA, versé tel quel comme preuve',
      ],
      answer: 1,
      explain: 'Entre États membres participants, la DEE est l\'instrument de recueil de preuve. SIENA sert à l\'échange d\'informations entre services, pas à produire une preuve en tant que telle.',
    },
    { type: 'heading', text: 'Europol, Eurojust et équipes communes' },
    {
      type: 'text',
      md: `- **Europol / EC3** : croisement d'informations entre États (une même adresse peut figurer dans des dossiers étrangers), analyse, expertise crypto, coordination d'opérations. Plusieurs démantèlements publics de services de mixage ou d'exchanges non conformes ont été coordonnés avec son appui, par exemple celui du mixeur ChipMixer en 2023.
- **Eurojust** : coordination entre parquets et juges de plusieurs États, résolution des blocages d'exécution, réunions de coordination et appui aux **équipes communes d'enquête**.
- **ECE** : quand plusieurs États enquêtent sur les mêmes faits ou les mêmes auteurs, l'ECE permet d'échanger directement les éléments recueillis, sans passer par une demande d'entraide pour chaque acte. Un outil puissant pour les réseaux de blanchiment transnationaux.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Nouvelles voies à surveiller',
      md: `- Le règlement européen sur la **preuve électronique** (règlement (UE) 2023/1543), applicable depuis août 2026, permet d'adresser des injonctions européennes de production et de conservation directement à certains fournisseurs de services. Son champ (types de prestataires, catégories de données) et ses modalités pratiques sont à vérifier avant usage.
- Le **deuxième protocole additionnel** à la Convention de Budapest (2022) prévoit des formes de coopération directe avec les fournisseurs : vérifiez son entrée en vigueur et sa ratification par les États concernés.
- Depuis fin 2024, la **règle de voyage** (règlement (UE) 2023/1113) impose aux prestataires européens de transmettre et conserver les informations sur l'émetteur et le bénéficiaire des transferts : des données précieuses à demander.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : rédiger une demande qui sera exécutée',
      md: `- Langue : celle exigée par l'État requis ou acceptée par le prestataire (souvent l'anglais pour les portails).
- Identifiants exacts : adresses complètes, hash, horodatages **UTC**, montants et actifs, chaîne concernée.
- Exposé des faits **court et compréhensible** par un non-spécialiste ; une phrase d'explication de la blockchain suffit.
- Qualification et textes applicables, peine encourue, éléments de double incrimination.
- Données demandées précisément (KYC, IP de connexion, appareils, historiques, adresses de retrait) et période.
- Urgence motivée, demande de non-divulgation au client, coordonnées de l'enquêteur.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le risque d\'alerte du suspect',
      md: `Certains prestataires informent leurs clients des demandes reçues, sauf instruction contraire ou interdiction légale dans leur pays. Demandez explicitement la **confidentialité**, renseignez-vous sur la politique du prestataire et, en cas de doute, coordonnez le calendrier des demandes avec les autres actes de l'enquête (interpellations, perquisitions).`,
    },
    {
      type: 'check',
      q: 'Quels éléments sont indispensables dans une demande de gel adressée à un exchange étranger ?',
      options: [
        'Seulement le nom du suspect',
        'L\'adresse de dépôt, les hash, horodatages UTC, montants, la qualification et la demande de confidentialité',
        'L\'adresse du hot wallet de l\'exchange',
        'Une copie intégrale du dossier de procédure',
      ],
      answer: 1,
      explain: 'Le prestataire retrouve un client par son adresse de dépôt et les transactions ; le hot wallet est commun à tous les clients. La confidentialité doit être demandée explicitement.',
    },
  ],
  keyPoints: [
    'Le canal dépend du lieu d\'établissement du prestataire : réquisition directe, coopération volontaire, DEE, entraide.',
    'Renseignement (Europol, CRF, informel) oriente ; seules les voies judiciaires produisent une preuve versable, à régulariser si besoin.',
    'Découpler : préserver et geler vite par les canaux rapides, formaliser en parallèle.',
    'Les gels volontaires sont temporaires : noter et suivre le délai annoncé par la plateforme.',
    'UE : DEE pour la preuve, règlement 2018/1805 pour le gel et la confiscation ; hors UE : entraide.',
    'Émetteurs de stablecoins : gel très rapide, à demander dès l\'identification.',
    'Une demande exécutable : identifiants exacts en UTC, faits clairs, qualification, données ciblées, confidentialité.',
  ],
  quiz: [
    {
      q: 'Quel instrument permet d\'obtenir une preuve auprès d\'un prestataire établi dans un autre État membre participant de l\'UE ?',
      options: ['Une notice rouge Interpol', 'Une décision d\'enquête européenne', 'Un message SIENA', 'Une déclaration de soupçon'],
      answer: 1,
      explain: 'La DEE (directive 2014/41/UE) est l\'instrument de recueil de preuve entre États membres participants.',
    },
    {
      q: 'Une information transmise par Europol peut toujours être versée telle quelle comme preuve en procédure.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Les canaux de renseignement orientent l\'enquête ; leur contenu peut être soumis à des restrictions d\'usage et doit souvent être régularisé par une voie judiciaire.',
    },
    {
      q: 'Quels canaux sont adaptés à une action urgente et réversible (préservation, blocage) ?',
      kind: 'multi',
      options: [
        'Portail forces de l\'ordre du prestataire (coopération volontaire)',
        'Réseau 24/7 pour la préservation rapide de données',
        'Demande de gel à l\'émetteur d\'un stablecoin',
        'Demande d\'entraide hors UE exécutée en plusieurs mois',
      ],
      answer: [0, 1, 2],
      explain: 'L\'entraide formelle est indispensable pour la preuve et la saisie, mais trop lente pour bloquer des fonds en mouvement.',
    },
    {
      q: 'Quels délais la directive DEE fixe-t-elle en principe à l\'État d\'exécution ?',
      options: [
        '24 heures pour tout exécuter',
        '30 jours pour décider de la reconnaissance, 90 jours pour exécuter',
        '1 an',
        'Aucun délai',
      ],
      answer: 1,
      explain: 'Ce sont des délais de principe, qui peuvent être raccourcis pour motif d\'urgence et sont parfois dépassés en pratique.',
    },
    {
      q: 'Qu\'apporte une équipe commune d\'enquête (ECE) ?',
      options: [
        'Un mandat d\'arrêt automatique',
        'Le partage direct des éléments recueillis entre les États membres de l\'équipe, sans demande d\'entraide pour chaque acte',
        'L\'accès aux clés privées des suspects',
        'Le gel automatique de tous les comptes',
      ],
      answer: 1,
      explain: 'L\'ECE fluidifie l\'échange entre enquêteurs et magistrats de plusieurs États sur une même affaire, avec l\'appui possible d\'Eurojust.',
    },
    {
      q: 'Quelles données utiles un prestataire européen doit-il désormais conserver au titre de la règle de voyage ?',
      kind: 'multi',
      options: [
        'Les informations sur l\'émetteur d\'un transfert',
        'Les informations sur le bénéficiaire d\'un transfert',
        'La clé privée de ses clients',
        'Le mot de passe des comptes clients en clair',
      ],
      answer: [0, 1],
      explain: 'Le règlement (UE) 2023/1113 porte sur les informations accompagnant les transferts (émetteur, bénéficiaire). Aucun prestataire ne doit détenir de mots de passe en clair, et les clés privées ne font pas partie de ces obligations.',
    },
  ],
  flashcards: [
    { front: 'DEE', back: 'Décision d\'enquête européenne (directive 2014/41/UE) : preuve dans un autre État membre (hors Irlande, Danemark).' },
    { front: 'Délais DEE', back: '30 jours pour la reconnaissance, 90 jours pour l\'exécution (principe).' },
    { front: 'Entraide pénale (MLAT)', back: 'Voie formelle hors UE, fondée sur les conventions ; souvent plusieurs mois.' },
    { front: 'Europol EC3', back: 'Centre cyber d\'Europol : croisement d\'informations, expertise crypto, coordination.' },
    { front: 'Eurojust', back: 'Coordination judiciaire européenne, appui aux équipes communes d\'enquête.' },
    { front: 'ECE', back: 'Équipe commune d\'enquête : partage direct des éléments entre États.' },
    { front: 'Réseau 24/7', back: 'Points de contact Budapest pour la préservation rapide de données.' },
    { front: 'Règlement (UE) 2018/1805', back: 'Reconnaissance mutuelle des décisions de gel et de confiscation dans l\'UE.' },
    { front: 'Renseignement vs preuve', back: 'Le renseignement oriente ; la voie judiciaire prouve. Régulariser et tracer l\'origine.' },
    { front: 'Gel volontaire', back: 'Temporaire : noter le délai fixé par la plateforme et lancer la voie formelle sans attendre.' },
    { front: 'Règle de voyage', back: 'Règlement (UE) 2023/1113 : informations émetteur/bénéficiaire des transferts de crypto-actifs.' },
  ],
}

export const L4_DEFI_COOP: Lesson[] = [defiExploits, cooperation]
