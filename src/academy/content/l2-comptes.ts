// Niveau 2 — filière Ethereum & modèle à comptes : DEX/DeFi, memos et tags.
import type { Lesson } from '../model'

export const L2_COMPTES: Lesson[] = [
  // ════════════════════════════════════════════════════════════════════════
  // DEX, AMM ET DEFI
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'dex-defi',
    title: 'DEX, AMM et DeFi : suivre les swaps',
    level: 2,
    track: 'comptes',
    minutes: 32,
    summary:
      "Les exchanges décentralisés ne coupent pas la trace : un swap est atomique, public et entièrement lisible dans les événements de la transaction. Pools et formule à produit constant, anatomie d'un swap, routeurs et agrégateurs, liquidité, prêts et coffres, et ce qu'on peut (ou non) geler et requérir dans la DeFi.",
    objectives: [
      'Expliquer le fonctionnement d\'un AMM à produit constant, l\'impact de prix et le slippage.',
      'Lire un swap dans les événements Transfer, Swap, Deposit et Withdrawal, dans l\'ordre.',
      'Identifier le bénéficiaire réel d\'un swap, même s\'il diffère de l\'émetteur.',
      'Suivre la valeur à travers la fourniture de liquidité, les prêts et les coffres.',
      'Savoir quoi demander, et à qui, quand les fonds passent par la DeFi.',
    ],
    prerequisites: ['comptes-evm', 'tokens-erc20', 'stablecoins'],
    blocks: [
      {
        type: 'text',
        md: `Face à un suspect qui convertit ses USDT en ETH sur un DEX, beaucoup d'enquêteurs débutants pensent que la trace est perdue « dans la DeFi ». C'est l'inverse : un **swap sur un DEX** est une seule transaction publique qui relie explicitement un montant d'entrée, venant d'une adresse, à un montant de sortie, versé à une adresse. La trace continue simplement **dans un autre actif**.

Ce qui est vrai, en revanche, c'est qu'un DEX n'a **ni opérateur détenant les fonds, ni KYC** : on suit plus facilement, mais on identifie et on gèle moins facilement.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Exchange centralisé (Coinvault, Binova)',
          md: `- Les fonds entrent dans une **comptabilité interne** : la trace on-chain s'interrompt au dépôt.
- Le client est **identifié** (KYC) : réquisition possible.
- Le service peut **geler** un compte.
- Le lien dépôt → retrait n'est connu que du service.`,
        },
        right: {
          title: 'Exchange décentralisé (OmniSwap, SyrupSwap)',
          md: `- Le swap est **on-chain** : entrée et sortie dans la même transaction.
- **Aucun KYC** : l'utilisateur n'est qu'une adresse.
- **Aucun gel** possible au niveau du protocole (seul l'émetteur d'un stablecoin peut geler son jeton).
- Le lien entrée → sortie est **public**.`,
        },
      },
      { type: 'heading', text: 'Le teneur de marché automatisé (AMM)' },
      {
        type: 'text',
        md: `Un DEX de type AMM n'a pas de carnet d'ordres. Il repose sur des **pools de liquidité** : un contrat détient deux jetons (par exemple WETH et USDT) déposés par des **fournisseurs de liquidité** (LP), qui reçoivent en échange des jetons LP représentant leur part.

Le prix découle d'une formule. Dans le modèle historique **à produit constant**, \`x × y = k\` : l'utilisateur qui apporte des USDT retire des WETH de sorte que le produit des réserves reste constant, aux frais près (souvent 0,3 %, versés aux LP). Plus l'ordre est gros par rapport au pool, plus le prix obtenu se dégrade : c'est l'**impact de prix**. L'écart maximal que l'utilisateur accepte entre le prix affiché et le prix d'exécution est sa tolérance de **slippage**.

Variantes : liquidité **concentrée** sur des plages de prix (plusieurs pools par niveau de frais), pools **stables** optimisés pour des actifs de même valeur (USDT/USDC). L'ETH natif n'étant pas un jeton ERC-20, il est **enveloppé** en WETH, ce qui produit des événements \`Deposit\` et \`Withdrawal\` sur le contrat WETH.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Le calcul sur un exemple',
        md: `Pool OmniSwap : **1 000 WETH** et **3 000 000 USDT**, soit un prix de 3 000 USDT/ETH ; \`k = 3 000 000 000\`.

Un suspect apporte **30 000 USDT**. Après les frais de 0,3 %, 29 910 USDT entrent dans le calcul. Nouvelles réserves USDT : 3 029 910. Réserve WETH qui conserve k : 3 000 000 000 / 3 029 910 ≈ 990,128. Il reçoit donc **≈ 9,872 WETH**.

Prix effectif : 30 000 / 9,872 ≈ **3 039 USDT/ETH**, soit environ 1,3 % de plus que le prix affiché (0,3 % de frais + 1 % d'impact de prix). Pour l'enquêteur : l'écart entre la valeur entrée et la valeur sortie d'un swap est **normal** et doit être expliqué, pas interprété comme une ponction.`,
      },
      {
        type: 'widget',
        id: 'amm-swap',
        caption: 'Faites varier la taille de l\'ordre et la profondeur du pool : observez l\'impact de prix, puis les « legs » (Transfer) que le swap produit dans la transaction.',
      },
      { type: 'heading', text: 'Anatomie d\'un swap' },
      {
        type: 'steps',
        items: [
          { title: 'Approbation préalable', md: 'L\'utilisateur a autorisé le routeur à dépenser son jeton d\'entrée (\`approve\`, ou une signature de type permit). C\'est souvent une transaction antérieure.' },
          { title: 'Appel du routeur', md: 'L\'utilisateur appelle le **routeur** (contrat d\'entrée du DEX) en précisant le jeton d\'entrée, le montant, le chemin, le montant minimal accepté et le **destinataire**.' },
          { title: 'Transfert vers le pool', md: 'Le routeur fait transférer les jetons d\'entrée de l\'utilisateur vers le pool : \`Transfer\` utilisateur → pool.' },
          { title: 'Événement Swap', md: 'Le pool met à jour ses réserves et émet un événement \`Swap\` (montants entrés et sortis, destinataire).' },
          { title: 'Versement de la sortie', md: 'Le pool transfère les jetons de sortie au destinataire, ou au routeur qui désenveloppe le WETH et verse de l\'ETH natif (transaction interne).' },
        ],
      },
      {
        type: 'flow',
        nodes: [
          { id: 'a', label: '0x7a3c…e41b', kind: 'suspect', sub: 'émetteur de la tx' },
          { id: 'r', label: 'Routeur OmniSwap', kind: 'contract' },
          { id: 'p', label: 'Pool USDT/WETH', kind: 'dex', sub: 'OmniSwap' },
          { id: 'w', label: 'Contrat WETH', kind: 'contract', sub: 'Withdrawal' },
          { id: 'b', label: '0x9e01…07ca', kind: 'wallet', sub: 'bénéficiaire réel' },
        ],
        edges: [
          { from: 'a', to: 'p', label: 'Transfer 25 000 USDT' },
          { from: 'p', to: 'r', label: 'Transfer 7,41 WETH' },
          { from: 'r', to: 'w', label: 'désenveloppage 7,41' },
          { from: 'r', to: 'b', label: 'tx interne 7,41 ETH' },
        ],
        caption: 'Une seule transaction : 25 000 USDT de 0x7a3c deviennent 7,41 ETH versés à 0x9e01, une autre adresse.',
      },
      {
        type: 'table',
        headers: ['Ordre', 'Événement / trace', 'De', 'Vers', 'Montant'],
        rows: [
          ['1', 'Transfer (USDT)', '0x7a3c…e41b', 'Pool USDT/WETH', '25 000 USDT'],
          ['2', 'Swap (pool)', '—', 'destinataire : routeur', 'entrée 25 000 USDT, sortie 7,41 WETH'],
          ['3', 'Transfer (WETH)', 'Pool USDT/WETH', 'Routeur', '7,41 WETH'],
          ['4', 'Withdrawal (WETH)', 'Routeur', '—', '7,41 WETH désenveloppés'],
          ['5', 'Transaction interne', 'Routeur', '0x9e01…07ca', '7,41 ETH'],
        ],
        caption: 'Lecture d\'un swap dans l\'onglet « Logs » et « Internal txns » d\'un explorateur. Seuls la première entrée et le dernier versement vers une adresse non contractuelle comptent pour la trace.',
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Le destinataire n\'est pas forcément l\'émetteur',
        md: `Le paramètre « destinataire » d'un swap peut désigner **n'importe quelle adresse**. Ne supposez jamais que la sortie revient au \`from\` de la transaction : suivez le dernier \`Transfer\` (ou la transaction interne) jusqu'à son bénéficiaire réel. Bonne formulation : « 0x7a3c a converti 25 000 USDT en 7,41 ETH via OmniSwap, versés à 0x9e01 » — et non « 0x7a3c a envoyé des fonds à OmniSwap ».`,
      },
      {
        type: 'check',
        q: 'Dans un swap, l\'émetteur de la transaction est 0xA. Le dernier événement verse 12 400 USDC à 0xB, adresse non contractuelle. Où se poursuit la trace ?',
        options: ['Sur 0xA', 'Sur 0xB', 'Sur le routeur', 'Sur le pool'],
        answer: 1,
        explain: 'Le bénéficiaire d\'un swap peut être une autre adresse que l\'émetteur. Routeur et pool sont de l\'infrastructure : la trace continue sur 0xB, en USDC.',
      },
      { type: 'heading', text: 'Routeurs, agrégateurs et chemins multiples' },
      {
        type: 'text',
        md: `- Un **chemin multi-sauts** traverse plusieurs pools dans la même transaction (USDT → WETH → jeton X) : plusieurs paires de \`Transfer\` s'enchaînent.
- Un **agrégateur** répartit l'ordre entre plusieurs DEX et pools pour obtenir un meilleur prix : la transaction peut contenir des dizaines d'événements. Seuls comptent **l'entrée initiale** et la ou les **sorties finales** vers une adresse non contractuelle.
- Routeurs, pools et agrégateurs sont des **contrats d'infrastructure** : ce ne sont jamais des contreparties à identifier ou à requérir. Il n'y a derrière eux ni opérateur détenant les fonds, ni données d'identité.
- Les **robots MEV** s'insèrent autour des swaps (arbitrage, attaque « sandwich ») : leurs adresses apparaissent dans les mêmes blocs que le suspect sans être ses complices.`,
      },
      { type: 'heading', text: 'Autres briques DeFi rencontrées en enquête' },
      {
        type: 'table',
        headers: ['Brique', 'Ce qui se passe', 'Ce qu\'il faut suivre'],
        rows: [
          ['Fourniture de liquidité', 'Le suspect dépose deux jetons dans un pool et reçoit des jetons LP ; les fonds « disparaissent » dans le pool', 'Les jetons LP, puis le retrait de liquidité (souvent vers une autre adresse)'],
          ['Prêt / emprunt (Lendora)', 'Dépôt d\'un collatéral (ETH volés) et emprunt d\'un autre actif (USDC d\'apparence propre)', 'La position : même adresse ou même contrat ; les fonds empruntés'],
          ['Coffres de rendement (vaults)', 'Dépôt contre des jetons de part', 'Les jetons de part, comme des jetons LP'],
          ['Enveloppement (WETH, WBTC)', 'Conversion 1:1 d\'un actif en jeton', 'Les événements Deposit / Withdrawal du contrat'],
          ['Prêts flash', 'Emprunt sans garantie remboursé dans la même transaction (piratages)', 'Le gain net de l\'attaquant, pas les montants bruts gonflés'],
        ],
      },
      {
        type: 'check',
        q: 'Un suspect dépose 80 ETH volés comme collatéral sur Lendora et emprunte 150 000 USDC, qu\'il envoie à une autre adresse. Que faut-il suivre ?',
        options: [
          'Uniquement les ETH, qui restent dans le protocole',
          'Les USDC empruntés et la position qui les relie au collatéral volé',
          'Rien : le protocole de prêt coupe la trace',
          'Le cours de l\'ETH',
        ],
        answer: 1,
        explain: 'L\'emprunt permet d\'obtenir des fonds d\'apparence propre adossés au collatéral marqué. La position (même adresse ou même contrat) relie les deux ; les USDC, gelables par leur émetteur, deviennent une cible.',
      },
      { type: 'heading', text: 'Geler et requérir quand les fonds passent par la DeFi' },
      {
        type: 'text',
        md: `- **Le protocole** : rien à requérir, rien à geler. Ni le routeur, ni le pool, ni les fournisseurs de liquidité ne détiennent d'information sur l'utilisateur.
- **L'émetteur du jeton** : si les fonds sont en USDT ou USDC, l'émetteur peut **bloquer l'adresse** qui les détient. Un swap vers un stablecoin gelable ouvre donc une fenêtre ; un swap vers de l'ETH natif ou un jeton décentralisé la ferme.
- **L'interface web** : la société ou l'hébergeur qui exploite le site du DEX peut, selon les cas, disposer de journaux (adresses IP, adresses connectées). Résultats incertains, souvent hors d'Europe.
- **La sortie** : tôt ou tard, la valeur rejoint un exchange centralisé ou un échangeur. C'est là que se trouvent l'identité et la possibilité de gel.`,
      },
      {
        type: 'case',
        title: 'Cas — le drainer et les trois swaps',
        md: `Le 3 juin 2026, une victime signe une approbation illimitée sur un faux site d'airdrop. À 18:02 UTC, 41 250 USDC sont aspirés vers \`0x5d1f…a9c0\`.

- 18:04 : swap sur OmniSwap, 41 250 USDC → 13,52 WETH, désenveloppés et versés à \`0x22be…41f7\`.
- 18:31 : \`0x22be\` envoie 13,5 ETH vers ArcBridge, à destination de BNB Smart Chain.
- 18:44 : sur BSC, le bénéficiaire reçoit l'équivalent en BNB, puis un swap sur SyrupSwap le convertit en 40 380 USDT versés à \`0x8c47…d3e2\`.

L'enquêteur note les montants et leur contre-valeur à chaque étape (perte d'environ 2 % en frais, impact de prix et commission du bridge), demande immédiatement le **gel des USDT** sur \`0x8c47\` à l'émetteur, puis suit cette adresse jusqu'à son dépôt chez Kaizen Exchange. Les swaps n'ont rien caché : ils ont seulement changé l'actif.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : valoriser chaque étape',
        md: `Pour chaque swap, consignez : txid, heure UTC, actif et montant **entrés**, actif et montant **sortis**, bénéficiaire, et contre-valeur en euros des deux côtés au moment du swap. Ce tableau évite qu'un écart de 1 à 3 % soit présenté par la défense comme une « rupture » de la trace, et il permet de chiffrer le préjudice à chaque étape.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'AMM', def: 'Teneur de marché automatisé : échange contre un pool de liquidité selon une formule de prix.' },
          { term: 'Pool de liquidité', def: 'Contrat détenant deux jetons (ou plus) contre lesquels les utilisateurs échangent.' },
          { term: 'Impact de prix', def: 'Dégradation du prix obtenue d\'autant plus forte que l\'ordre est gros par rapport au pool.' },
          { term: 'Slippage', def: 'Écart maximal toléré entre le prix attendu et le prix d\'exécution.' },
          { term: 'Routeur', def: 'Contrat d\'entrée d\'un DEX qui orchestre les transferts entre l\'utilisateur et les pools.' },
          { term: 'Agrégateur', def: 'Service qui répartit un ordre entre plusieurs DEX pour optimiser le prix.' },
          { term: 'WETH', def: 'Version ERC-20 de l\'ETH, obtenue par enveloppement 1:1 (événements Deposit / Withdrawal).' },
          { term: 'Jeton LP', def: 'Jeton représentant la part d\'un fournisseur de liquidité dans un pool.' },
        ],
      },
    ],
    keyPoints: [
      'Un AMM échange contre un pool selon une formule (ex. x × y = k) ; frais, impact de prix et slippage expliquent les écarts de valeur.',
      'Un swap est atomique et public : lire Transfer, Swap, Deposit / Withdrawal et transactions internes dans l\'ordre.',
      'Le bénéficiaire d\'un swap peut différer de l\'émetteur : suivre le dernier versement vers une adresse non contractuelle.',
      'Routeurs, pools, agrégateurs et robots MEV sont de l\'infrastructure, pas des contreparties.',
      'LP, prêts et coffres « cachent » la valeur : suivre jetons de part, positions et fonds empruntés.',
      'Ni gel ni KYC au niveau du protocole : viser l\'émetteur du stablecoin et la sortie vers un service centralisé.',
    ],
    quiz: [
      {
        q: 'Dans un swap, l\'émetteur de la transaction est 0xA. Le dernier Transfer verse les jetons de sortie à 0xB. Qui reçoit les fonds ?',
        options: ['0xA', 'Le routeur', '0xB', 'Le pool'],
        answer: 2,
        explain: 'Le paramètre destinataire d\'un swap peut désigner une autre adresse : c\'est 0xB qui reçoit les jetons.',
      },
      {
        q: 'Faut-il adresser une réquisition au routeur d\'un DEX ?',
        options: [
          'Non : c\'est un contrat d\'infrastructure sans opérateur détenant les fonds ni données d\'identité',
          'Oui, c\'est lui qui détient les fonds',
          'Oui, il conserve l\'IP des utilisateurs',
          'Oui, systématiquement',
        ],
        answer: 0,
        explain: 'Le routeur exécute du code ; il ne garde pas les fonds et ne connaît pas l\'identité des utilisateurs.',
      },
      {
        q: 'Pool de 1 000 WETH et 3 000 000 USDT (produit constant, sans frais pour simplifier). Combien de WETH obtient-on environ pour 30 000 USDT ?',
        options: ['10 WETH exactement', 'Environ 9,9 WETH', 'Environ 10,1 WETH', '30 WETH'],
        answer: 1,
        explain: 'k = 3 × 10⁹. Nouvelles réserves USDT : 3 030 000 ; WETH : 3 × 10⁹ / 3 030 000 ≈ 990,1. On reçoit ≈ 9,9 WETH : un peu moins que 10 à cause de l\'impact de prix.',
      },
      {
        kind: 'multi',
        q: 'Quels éléments peuvent expliquer qu\'un suspect reçoive en sortie de swap une contre-valeur inférieure de 2 % à ce qu\'il a apporté ? (plusieurs réponses)',
        options: [
          'Les frais du pool versés aux fournisseurs de liquidité',
          'L\'impact de prix lié à la taille de l\'ordre',
          'Les frais de gaz de la transaction',
          'Un prélèvement occulte du routeur au profit d\'un complice',
        ],
        answer: [0, 1, 2],
        explain: 'Frais du pool, impact de prix et gaz expliquent les écarts habituels. Un écart normal ne doit pas être interprété comme une ponction ou une rupture de trace.',
      },
      {
        q: 'Un suspect dépose des ETH volés comme collatéral dans un protocole de prêt et emprunte des USDC. Que faut-il suivre ?',
        options: [
          'Uniquement les ETH',
          'Rien, la trace est coupée',
          'Le prix de l\'ETH',
          'Les USDC empruntés et la position qui relie collatéral et emprunt',
        ],
        answer: 3,
        explain: 'L\'emprunt permet d\'obtenir des fonds d\'apparence propre adossés au collatéral marqué : la position relie les deux.',
      },
      {
        kind: 'truefalse',
        q: 'Un swap sur un DEX rend la trace des fonds impossible à suivre, comme un passage par un exchange centralisé.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'C\'est l\'inverse : le swap relie entrée et sortie dans une même transaction publique. C\'est l\'exchange centralisé, avec sa comptabilité interne, qui interrompt la trace on-chain.',
      },
      {
        q: 'Après un swap, le suspect détient des USDC. Quelle mesure rapide devient envisageable ?',
        options: [
          'Demander au pool OmniSwap d\'annuler le swap',
          'Demander à l\'émetteur des USDC de bloquer l\'adresse qui les détient',
          'Requérir le routeur',
          'Aucune',
        ],
        answer: 1,
        explain: 'Les émetteurs de stablecoins centralisés peuvent bloquer une adresse. Un swap vers un actif gelable ouvre une fenêtre d\'action.',
      },
    ],
    flashcards: [
      { front: 'Formule de l\'AMM à produit constant', back: 'x × y = k : le produit des réserves du pool reste constant (aux frais près).' },
      { front: 'Impact de prix', back: 'Dégradation du prix d\'autant plus forte que l\'ordre est gros par rapport à la liquidité du pool.' },
      { front: 'Slippage', back: 'Écart maximal toléré par l\'utilisateur entre prix attendu et prix d\'exécution.' },
      { front: 'Ordre de lecture d\'un swap', back: 'Transfer utilisateur → pool, Swap, Transfer pool → destinataire (ou routeur), Withdrawal WETH, transaction interne.' },
      { front: 'Piège n° 1 du swap', back: 'Le bénéficiaire peut être différent de l\'émetteur : suivre le dernier versement.' },
      { front: 'Routeur, pool, agrégateur : à requérir ?', back: 'Non : ce sont des contrats d\'infrastructure, sans opérateur détenant les fonds ni KYC.' },
      { front: 'Fourniture de liquidité : que suivre ?', back: 'Les jetons LP, puis le retrait de liquidité, souvent vers une autre adresse.' },
      { front: 'Prêt DeFi adossé à des fonds volés', back: 'Suivre la position (collatéral ↔ emprunt) et les fonds empruntés.' },
      { front: 'Que peut-on geler dans la DeFi ?', back: 'Pas le protocole ; mais l\'émetteur d\'un stablecoin centralisé peut bloquer l\'adresse qui détient ses jetons.' },
      { front: 'Prêt flash', back: 'Emprunt sans garantie remboursé dans la même transaction ; raisonner sur le gain net de l\'attaquant.' },
    ],
    practice: ['dex-swap', 'rugpull-bsc', 'defi-exploit'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // XRP, STELLAR, EOS : MEMOS ET TAGS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'xrp-memos',
    title: 'XRP, Stellar, EOS : memos et destination tags',
    level: 2,
    track: 'comptes',
    minutes: 22,
    summary:
      "Sur plusieurs chaînes, les exchanges utilisent une seule adresse pour tous leurs clients et les distinguent par un tag ou un memo. Sans ce champ, la réquisition échoue. Formats et particularités du XRP Ledger (destination tag, X-address, activation, paiements partiels), de Stellar, d'EOS, de TON et de Cosmos, et exploitation des tags pour rapprocher les victimes.",
    objectives: [
      'Expliquer pourquoi certains exchanges utilisent une adresse partagée et un identifiant client.',
      'Relever, pour chaque chaîne concernée, le bon champ (destination tag, memo, commentaire).',
      'Lire le montant réellement livré d\'un paiement XRP et repérer le compte activateur.',
      'Exploiter les tags et memos pour rapprocher ou distinguer des comptes clients.',
      'Rédiger une demande d\'identification complète et sans ambiguïté.',
    ],
    prerequisites: ['exchanges', 'comptes-evm'],
    blocks: [
      {
        type: 'text',
        md: `Sur Bitcoin, Ethereum ou Tron, un exchange attribue à chaque client sa propre **adresse de dépôt** : l'adresse suffit à désigner le compte. Sur d'autres chaînes, ouvrir un compte coûte une **réserve** bloquée ou des frais de création. Plutôt que de créer un compte par client, les exchanges utilisent alors **une seule adresse** pour tout le monde, et demandent au client d'ajouter à son dépôt un **identifiant** : destination tag, memo, commentaire.

C'est le couple **adresse + identifiant** qui désigne le compte client. Pour l'enquêteur, l'identifiant joue exactement le rôle de l'adresse de dépôt unique sur Bitcoin.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v1', label: 'Victime 1', kind: 'victim', sub: 'rPq3…7Ksd' },
          { id: 'v2', label: 'Victime 2', kind: 'victim', sub: 'rHb9…2xWv' },
          { id: 'v3', label: 'Victime 3', kind: 'victim', sub: 'rLs1…9QaZ' },
          { id: 'ex', label: 'rN7n…CvQe', kind: 'exchange', sub: 'adresse unique Huobex' },
          { id: 'c1', label: 'Compte client A', kind: 'suspect', sub: 'tag 104552' },
          { id: 'c2', label: 'Compte client B', kind: 'suspect', sub: 'tag 88017' },
        ],
        edges: [
          { from: 'v1', to: 'ex', label: '12 000 XRP · tag 104552' },
          { from: 'v2', to: 'ex', label: '8 500 XRP · tag 104552' },
          { from: 'v3', to: 'ex', label: '15 000 XRP · tag 88017' },
          { from: 'ex', to: 'c1', label: 'crédit interne', dashed: true },
          { from: 'ex', to: 'c2', label: 'crédit interne', dashed: true },
        ],
        caption: 'Même adresse, deux tags : deux comptes clients distincts. Les victimes 1 et 2 ont alimenté le même compte.',
      },
      { type: 'heading', text: 'Panorama des chaînes concernées' },
      {
        type: 'table',
        headers: ['Chaîne', 'Format d\'adresse', 'Identifiant client', 'Format de l\'identifiant', 'À retenir'],
        rows: [
          ['XRP Ledger', 'r… (25 à 35 caractères) ou X-address', 'Destination tag', 'Entier de 0 à 4 294 967 295 (32 bits)', 'Une X-address encode adresse + tag'],
          ['Stellar', 'G… (56 caractères)', 'Memo', 'Texte (28 octets max), ID numérique, hash ou retour', 'Les adresses « muxed » (M…) encodent un identifiant'],
          ['EOS / Antelope', 'Nom de compte (12 caractères, a-z et 1-5)', 'Memo', 'Texte libre dans l\'action de transfert', 'Le compte créateur est visible'],
          ['TON', 'Adresse de contrat portefeuille', 'Commentaire', 'Texte libre', 'Souvent utilisé par les exchanges'],
          ['Cosmos et chaînes IBC', 'cosmos1… (bech32, préfixe propre à chaque chaîne)', 'Memo', 'Texte libre', 'Le memo sert aussi aux transferts IBC'],
          ['Hedera', '0.0.123456', 'Memo', 'Texte libre', 'Format d\'identifiant de compte numérique'],
        ],
        caption: 'Vérifiez toujours, dans la page « Déposer » du service ou sa réponse, le nom exact du champ attendu.',
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Sans tag, pas d\'identification',
        md: `Une réquisition qui mentionne l'adresse partagée d'un exchange **sans le destination tag (ou le memo) et sans le hash** de la transaction ne permet pas au service d'identifier le client : des milliers de comptes partagent cette adresse. Relevez toujours, pour chaque paiement : **adresse, tag/memo, hash, montant livré, horodatage UTC**.`,
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Entraînez-vous à reconnaître une adresse XRP (r…), Stellar (G…), Cosmos (cosmos1…) ou une X-address à partir de son préfixe et de sa longueur.',
      },
      { type: 'heading', text: 'Le XRP Ledger en détail' },
      {
        type: 'text',
        md: `- **Adresses** : forme classique commençant par **r**, ou **X-address** (commençant par X sur le réseau principal) qui encode à la fois l'adresse et le tag. Décodez une X-address avant d'interroger un explorateur ou de requérir.
- **Réserve et activation** : un compte doit conserver un minimum d'XRP, fixé par vote des validateurs et abaissé plusieurs fois au fil des ans. Un compte n'existe qu'à partir d'un premier paiement suffisant : l'explorateur indique **par qui il a été activé**. Comme sur Tron, l'activateur est un pivot précieux (souvent un exchange, ou l'auteur lui-même).
- **Paiements partiels** : un paiement peut porter le drapeau *partial payment*. Le champ \`Amount\` affiche alors un montant théorique, tandis que le montant **réellement livré** figure dans les métadonnées (\`delivered_amount\`). Cette subtilité a servi à tromper des services : lisez **toujours** le montant livré.
- **Actifs émis et DEX intégré** : le ledger gère des jetons émis via des *trust lines* et un carnet d'ordres natif ; un paiement peut convertir des devises en chemin. Vérifiez quel actif a été livré.
- **Suppression de compte** : un compte peut être supprimé et son solde résiduel transféré vers un autre ; l'historique reste consultable.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Montant affiché, montant livré',
        md: `Transaction \`4E1D…B7A0\` : le champ \`Amount\` indique **25 000 XRP**, le drapeau \`tfPartialPayment\` est positionné, et les métadonnées indiquent \`delivered_amount\` = **0,000012 XRP**. Le destinataire n'a reçu que douze millionièmes d'XRP. Un service mal programmé qui lisait \`Amount\` aurait crédité 25 000 XRP — et une victime qui fait une capture d'écran du champ \`Amount\` se trompe de bonne foi.`,
      },
      {
        type: 'check',
        q: 'Sur le XRP Ledger, quel champ indique le montant réellement reçu par le destinataire ?',
        options: ['Amount', 'Fee', 'delivered_amount, dans les métadonnées de la transaction', 'DestinationTag'],
        answer: 2,
        explain: 'Avec un paiement partiel, Amount peut être très supérieur au montant réellement livré, indiqué par delivered_amount.',
      },
      { type: 'heading', text: 'Stellar, EOS, TON, Cosmos' },
      {
        type: 'text',
        md: `- **Stellar** : le memo peut être de type texte (28 octets maximum), identifiant numérique (\`MEMO_ID\`), hash ou retour. Un compte est créé par l'opération \`create_account\`, qui désigne le **financeur**. Les adresses de fédération de la forme \`nom*domaine.com\` sont résolues par le domaine en adresse et memo : le domaine est alors un pivot OSINT.
- **EOS** : les comptes sont des noms lisibles de 12 caractères, **créés par un compte existant** (le créateur est visible) ; le memo est un champ libre de l'action \`transfer\`.
- **TON** : le commentaire de transaction joue le rôle du memo pour les dépôts d'exchange.
- **Cosmos et chaînes IBC** : le memo identifie le client chez l'exchange ; il est aussi utilisé par certains protocoles de transfert entre chaînes. Chaque chaîne a son préfixe d'adresse (\`cosmos1\`, \`osmo1\`…), mais la clé sous-jacente peut être la même d'une chaîne à l'autre.`,
      },
      { type: 'heading', text: 'Exploiter les tags et les memos' },
      {
        type: 'table',
        headers: ['Observation', 'Interprétation'],
        rows: [
          ['Plusieurs victimes, même adresse, **même tag**', 'Un seul compte client destinataire : rapprochement des plaintes'],
          ['Plusieurs victimes, même adresse, **tags différents**', 'Autant de comptes clients (souvent des mules distinctes)'],
          ['Une adresse reçoit des milliers de paiements avec des tags variés', 'Quasi certainement un exchange ou un prestataire de paiement'],
          ['Memo texte explicite (référence de commande, pseudonyme, insulte, revendication)', 'Information OSINT gratuite, à constater et à corroborer'],
          ['Paiement sans tag vers une adresse partagée', 'Dépôt non crédité ; l\'exchange peut le retrouver par le hash'],
          ['Tag envoyé à un portefeuille personnel', 'Sans signification : seul un service interprète les tags'],
        ],
      },
      {
        type: 'case',
        title: 'Cas — trois plaintes, deux comptes',
        md: `Trois plaintes pour faux placement, déposées à Annecy, Chambéry et Grenoble entre le 2 et le 19 septembre 2026. Les trois victimes ont envoyé des XRP à la même adresse \`rN7n…CvQe\`, attribuée à Huobex :

- victime 1 : 12 000 XRP, tag 104552, le 28 août à 14:12 UTC ;
- victime 2 : 8 500 XRP, tag 104552, le 3 septembre à 09:47 UTC ;
- victime 3 : 15 000 XRP, tag 88017, le 11 septembre à 17:30 UTC.

Lecture : les victimes 1 et 2 ont alimenté **le même compte client** (tag 104552) ; la victime 3 un **autre compte** (tag 88017), probablement une autre mule du même réseau, puisque la fausse plateforme est identique. La réquisition à Huobex liste les deux tags, les trois hash, les montants livrés et les horodatages, et demande les comptes liés aux deux titulaires (même appareil, même IP, même IBAN).`,
      },
      {
        type: 'check',
        q: 'Trois victimes ont payé la même adresse d\'exchange XRP, avec trois tags différents. Conclusion ?',
        options: [
          'Un seul compte destinataire',
          'Le tag est sans importance',
          'Trois comptes clients distincts, à identifier chacun',
          'L\'exchange est complice',
        ],
        answer: 2,
        explain: 'Chaque tag correspond à un compte client chez le service ; il y a donc trois comptes à identifier (éventuellement trois mules).',
      },
      { type: 'heading', text: 'Ce qu\'un tag prouve, et ce qu\'il ne prouve pas' },
      {
        type: 'compare',
        left: {
          title: 'Le tag prouve',
          md: `- Quel **compte client** du service a été crédité (si le service l'a bien affecté).
- Que plusieurs paiements ont alimenté **le même compte**.
- Que l'adresse destinataire est un **service** (si elle reçoit de nombreux tags).`,
        },
        right: {
          title: 'Le tag ne prouve pas',
          md: `- **Qui a émis** le paiement : n'importe qui peut envoyer un paiement avec un tag donné.
- Que le titulaire du compte est **l'auteur** : il peut s'agir d'une mule.
- Quoi que ce soit s'il est envoyé à un **portefeuille personnel**.`,
        },
      },
      {
        type: 'steps',
        items: [
          { title: 'Décoder', md: 'Si la victime a utilisé une X-address ou une adresse muxed, décodez-la en adresse classique + identifiant.' },
          { title: 'Vérifier le montant livré', md: 'Lisez \`delivered_amount\` (XRP) et l\'actif effectivement livré, pas seulement le montant affiché.' },
          { title: 'Relever le quintuplet', md: 'Adresse, tag/memo, hash, montant livré, horodatage UTC — pour chaque paiement.' },
          { title: 'Regrouper par identifiant', md: 'Un tableau par adresse de service et par tag fait apparaître les comptes à identifier et les rapprochements entre plaintes.' },
          { title: 'Requérir', md: 'Une réquisition par service, listant tous les tags et hash, avec demande des comptes liés et, le cas échéant, du gel.' },
        ],
      },
      {
        type: 'terms',
        items: [
          { term: 'Destination tag', def: 'Entier de 32 bits ajouté à un paiement XRP pour désigner le compte client chez le destinataire.' },
          { term: 'X-address', def: 'Format d\'adresse XRP qui encode à la fois l\'adresse classique et le destination tag.' },
          { term: 'delivered_amount', def: 'Montant réellement livré d\'un paiement XRP, indiqué dans les métadonnées.' },
          { term: 'Paiement partiel', def: 'Paiement XRP dont le montant livré peut être inférieur au champ Amount.' },
          { term: 'Memo', def: 'Champ libre ou typé (Stellar, EOS, Cosmos…) utilisé notamment pour identifier un client.' },
          { term: 'Compte activateur', def: 'Compte dont le premier paiement a créé un compte XRP (financeur sur Stellar, créateur sur EOS).' },
        ],
      },
    ],
    keyPoints: [
      'Sur XRP, Stellar, EOS, TON, Cosmos : adresse partagée + tag/memo = compte client.',
      'Toujours relever adresse, tag/memo, hash, montant livré et horodatage UTC.',
      'XRP : lire delivered_amount (paiements partiels), décoder les X-address, noter le compte activateur.',
      'Même adresse + même tag chez plusieurs victimes = même compte ; tags différents = comptes différents.',
      'Un tag désigne le compte crédité, pas l\'émetteur ; il n\'est pas secret.',
      'Les memos texte contiennent parfois des informations OSINT précieuses.',
    ],
    quiz: [
      {
        q: 'Une victime a envoyé 12 000 XRP à l\'adresse d\'un exchange avec le destination tag 104552. Que doit contenir la demande d\'identification ?',
        options: [
          'L\'adresse de l\'exchange seule',
          'Le nom de la victime seulement',
          'L\'adresse, le destination tag, le hash, le montant livré et l\'horodatage',
          'Le tag seulement',
        ],
        answer: 2,
        explain: 'L\'adresse est partagée par tous les clients : le tag et le hash permettent d\'identifier le compte crédité.',
      },
      {
        q: 'Sur le XRP Ledger, quel champ indique le montant réellement reçu ?',
        options: ['delivered_amount (métadonnées)', 'Amount', 'Fee', 'DestinationTag'],
        answer: 0,
        explain: 'Avec un paiement partiel, Amount peut être supérieur au montant réellement livré, indiqué par delivered_amount.',
      },
      {
        kind: 'truefalse',
        q: 'Un paiement portant le tag attribué au compte du suspect prouve que le suspect a émis ce paiement.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Le tag désigne le compte crédité, pas l\'émetteur ; n\'importe qui peut envoyer un paiement avec ce tag.',
      },
      {
        kind: 'multi',
        q: 'Sur quelles chaînes un dépôt d\'exchange nécessite-t-il fréquemment un tag, un memo ou un commentaire ? (plusieurs réponses)',
        options: ['XRP Ledger', 'Stellar', 'Bitcoin', 'EOS', 'Cosmos'],
        answer: [0, 1, 3, 4],
        explain: 'XRP, Stellar, EOS et Cosmos utilisent couramment une adresse partagée avec identifiant. Sur Bitcoin, chaque client reçoit sa propre adresse de dépôt.',
      },
      {
        q: 'Qu\'est-ce qu\'une X-address ?',
        options: [
          'Une adresse XRP de contrat intelligent',
          'Un format qui encode à la fois l\'adresse XRP classique et le destination tag',
          'Une adresse réservée aux exchanges',
          'Une adresse Stellar',
        ],
        answer: 1,
        explain: 'La X-address réunit adresse et tag dans une seule chaîne ; il faut la décoder avant de requérir.',
      },
      {
        q: 'Pourquoi le compte activateur d\'une adresse XRP intéresse-t-il l\'enquêteur ?',
        options: [
          'Parce qu\'il détient la clé privée du compte activé',
          'Parce qu\'il a financé la création du compte : c\'est souvent un exchange ou l\'auteur lui-même',
          'Parce qu\'il fixe le destination tag',
          'Parce qu\'il peut geler le compte',
        ],
        answer: 1,
        explain: 'Le premier paiement crée le compte : son émetteur est un pivot, comme l\'activateur sur Tron.',
      },
      {
        kind: 'truefalse',
        q: 'Sur Stellar, un memo texte peut contenir une information utile à l\'enquête, comme une référence de plateforme frauduleuse.',
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: 'Les memos texte sont publics et parfois utilisés pour communiquer : c\'est de l\'OSINT à constater et corroborer.',
      },
    ],
    flashcards: [
      { front: 'Pourquoi une adresse partagée sur XRP ?', back: 'Ouvrir un compte coûte une réserve : l\'exchange utilise une seule adresse et distingue ses clients par un destination tag.' },
      { front: 'Destination tag : format', back: 'Entier de 32 bits, de 0 à 4 294 967 295.' },
      { front: 'Stellar : identifiant client', back: 'Le memo (texte de 28 octets max, ID numérique, hash ou retour).' },
      { front: 'Le quintuplet à relever', back: 'Adresse, tag/memo, hash, montant livré, horodatage UTC.' },
      { front: 'delivered_amount', back: 'Montant réellement livré d\'un paiement XRP (les paiements partiels peuvent afficher un Amount trompeur).' },
      { front: 'X-address', back: 'Format XRP qui encode adresse classique + destination tag ; à décoder avant de requérir.' },
      { front: 'Même adresse, même tag, plusieurs victimes', back: 'Un seul compte client destinataire : rapprochement des plaintes.' },
      { front: 'Un tag prouve-t-il l\'émetteur ?', back: 'Non : il désigne le compte crédité ; n\'importe qui peut l\'utiliser.' },
      { front: 'Pivot de création de compte', back: 'XRP : compte activateur ; Stellar : financeur (create_account) ; EOS : compte créateur.' },
    ],
    practice: ['xrp-destination-tag'],
  },
]
