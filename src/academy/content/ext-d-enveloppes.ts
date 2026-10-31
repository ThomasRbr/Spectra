// Niveau 3 — Smart contracts & DeFi : jetons enveloppés et jetons de reçu.
// Acteurs réels (WETH, WBTC/BitGo, Aave, Lido, Uniswap, Circle, Tether, Sky)
// décrits factuellement ; victimes, suspects et plateformes cités sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_JETONS_ENVELOPPES: Lesson = {
  id: 'jetons-enveloppes',
  title: 'Jetons enveloppés et jetons de reçu : WETH, WBTC, aTokens, parts LP',
  level: 3,
  track: 'contrats',
  minutes: 40,
  summary: `En DeFi, un actif change de forme sans changer de propriétaire : l'ETH devient du WETH, le WETH déposé devient de l'aWETH, deux jetons apportés à un pool deviennent une part LP. Ces jetons « représentent » autre chose : un actif enfermé dans un contrat, une créance sur un protocole, une quote-part d'une réserve. Enveloppes non custodiales et custodiales, jetons de reçu, création et destruction depuis l'adresse nulle, traitement de ces conversions par un traceur, et question décisive : qui peut geler quoi ?`,
  objectives: [
    `Distinguer une enveloppe non custodiale (WETH), une enveloppe custodiale (WBTC) et un jeton de reçu (aToken, stETH, part LP).`,
    `Lire un enveloppement et un désenveloppement WETH : appel, événements Deposit / Withdrawal, transaction interne de restitution.`,
    `Interpréter une création (mint) ou une destruction (burn) depuis ou vers l'adresse nulle sans y voir un acteur ni une perte.`,
    `Traiter ces opérations comme des conversions à valeur égale dans un traçage, sans compter deux fois la même valeur.`,
    `Déterminer, pour chaque jeton, qui peut geler ou fournir des informations : émetteur, dépositaire, marchands, ou personne.`,
  ],
  prerequisites: ['tokens-erc20', 'dex-defi', 'transactions-internes'],
  practice: ['lending-garantie', 'lp-blanchiment'],
  blocks: [
    {
      type: 'text',
      md: `Un cabinet d'architectes nantais (fictif) s'est fait vider son portefeuille de trésorerie après avoir signé une transaction sur un faux site de signature électronique : **62 ETH** partent vers \`0x4be7…19d2\`. L'analyste ouvre l'adresse du suspect sur un explorateur et prend des notes :

- « 14:06 UTC : le suspect envoie 62 ETH au contrat *WETH*. Les fonds sont-ils partis chez un service ? »
- « 14:06 UTC : le suspect reçoit 62 WETH… sans que personne ne les lui ait envoyés. »
- « 14:09 UTC : 62 WETH partent vers *Aave : Pool*. Puis **l'adresse nulle** \`0x0000…0000\` envoie 62 **aEthWETH** au suspect. Qui contrôle l'adresse nulle ? »

Aucune de ces trois questions n'a de sens : le suspect n'a rien cédé à personne. Il a **enveloppé** son ETH, puis l'a **déposé** contre un **jeton de reçu**. Les 62 ETH de la victime sont toujours à lui, sous une autre forme. Cette leçon apprend à reconnaître ces changements de forme et à les tracer.`,
    },
    { type: 'heading', text: `Trois familles de jetons qui « représentent » autre chose` },
    {
      type: 'terms',
      items: [
        { term: 'Jeton enveloppé (wrapped)', def: `Jeton ERC-20 qui représente, à raison de 1 pour 1, un actif d'une autre nature : l'ETH natif (WETH), le bitcoin (WBTC), ou un actif d'une autre chaîne (versions pontées).` },
        { term: 'Enveloppe non custodiale', def: `L'actif sous-jacent est détenu par un smart contract qui le restitue automatiquement à quiconque rend le jeton. Aucun tiers ne peut s'y opposer (WETH).` },
        { term: 'Enveloppe custodiale', def: `L'actif sous-jacent est conservé par un dépositaire (une société) qui crée et détruit les jetons. La restitution dépend de lui et de ses procédures (WBTC).` },
        { term: 'Jeton de reçu', def: `Jeton remis en échange d'un dépôt dans un protocole : il matérialise une créance sur ce protocole (aTokens d'Aave, stETH de Lido, parts de pool LP).` },
        { term: 'Jeton à rebasage', def: `Jeton dont le solde affiché augmente tout seul, sans transfert entrant, pour refléter des intérêts ou des récompenses (aTokens, stETH).` },
        { term: 'Mint / burn', def: `Création ou destruction de jetons. Pour un ERC-20, elles s'écrivent comme un Transfer depuis (création) ou vers (destruction) l'adresse nulle.` },
        { term: 'Adresse nulle', def: `\`0x0000000000000000000000000000000000000000\`. Personne n'en détient la clé : c'est une convention d'écriture, pas un acteur.` },
        { term: 'Sous-jacent', def: `L'actif réellement immobilisé derrière le jeton (ETH, BTC, USDC…). C'est lui qui fonde la valeur du jeton.` },
      ],
    },
    { type: 'heading', text: 'WETH : l’enveloppe la plus simple' },
    {
      type: 'text',
      md: `L'ETH est l'actif **natif** d'Ethereum : il ne suit pas la norme ERC-20, et sa circulation passe par le champ \`value\` des transactions, pas par des événements \`Transfer\`. Les DEX et protocoles, eux, manipulent des ERC-20. D'où le **WETH** (*Wrapped Ether*) : un contrat qui reçoit de l'ETH et crée la même quantité de jetons.

Le contrat de référence, dit **WETH9**, est déployé à l'adresse \`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\`. Il tient en deux fonctions :

- \`deposit()\` : l'utilisateur envoie de l'ETH avec l'appel ; son solde de WETH augmente du même montant. Le contrat émet l'événement \`Deposit(dst, wad)\` ;
- \`withdraw(uint256 wad)\` : l'utilisateur rend des WETH ; le contrat lui renvoie le même montant d'ETH, par une **transaction interne**, et émet \`Withdrawal(src, wad)\`.

Trois propriétés comptent pour l'enquêteur : le taux est **toujours 1:1**, le contrat n'a **ni propriétaire ni fonction de gel**, et il n'est **pas modifiable**. Personne ne peut bloquer un WETH, ni refuser de le rembourser.`,
    },
    {
      type: 'table',
      caption: 'Lire un enveloppement et un désenveloppement',
      headers: ['Opération', 'Appel décodé', 'Ce qui bouge', 'Journal d’événements'],
      rows: [
        ['Enveloppement', '`deposit()` avec 62 ETH en valeur', '62 ETH : suspect → contrat WETH (valeur de la transaction)', '`Deposit(dst = suspect, wad = 62)` ; pas de `Transfer` dans WETH9'],
        ['Désenveloppement', '`withdraw(62000000000000000000)`', '62 ETH : contrat WETH → suspect (transaction interne)', '`Withdrawal(src = suspect, wad = 62)`'],
        ['Désenveloppement par un routeur', '`swapExactTokensForETH(…)` sur le routeur', 'WETH : pool → routeur ; ETH : WETH → routeur → bénéficiaire (internes)', '`Swap` du pool, `Withdrawal(src = routeur)`'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'WETH9 n’émet pas de Transfer à la création',
      md: `Le contrat d'origine signale l'enveloppement par \`Deposit\`, pas par un \`Transfer\` depuis l'adresse nulle. Selon l'explorateur ou l'outil, le mouvement de WETH est donc **reconstitué** (affiché « depuis l'adresse nulle » ou « depuis le contrat ») ou **absent** de l'onglet des jetons. Un historique de jetons qui « commence » par une sortie de WETH n'est pas incohérent : cherchez le \`Deposit\` correspondant.`,
    },
    {
      type: 'check',
      q: `Un suspect appelle \`withdraw\` sur le contrat WETH pour 15 WETH. Où apparaissent les 15 ETH qu'il récupère ?`,
      options: [
        `Dans la valeur d'une transaction envoyée par le contrat WETH, visible dans l'onglet des transactions normales`,
        `Dans une transaction interne du contrat WETH vers le suspect, au sein de la même transaction`,
        `Dans un événement Transfer de l'ETH`,
        `Nulle part : les ETH sont crédités hors chaîne`,
      ],
      answer: 1,
      explain: `Le contrat ne signe pas de transaction : il exécute un envoi d'ETH pendant l'appel du suspect. C'est une transaction interne, visible dans la trace d'exécution (onglet « transactions internes »). L'ETH natif n'émet jamais d'événement Transfer.`,
    },
    { type: 'heading', text: 'Les enveloppes custodiales : WBTC et ses semblables' },
    {
      type: 'text',
      md: `Un bitcoin ne peut pas, techniquement, entrer dans un contrat Ethereum. Le **WBTC** (*Wrapped Bitcoin*, lancé début 2019, contrat \`0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599\`, **8 décimales** comme le bitcoin) résout le problème par la **garde** :

1. un **marchand** (établissement agréé par le dispositif WBTC, qui a fait l'objet de vérifications d'identité) envoie des BTC au **dépositaire** ;
2. le dépositaire, historiquement la société **BitGo**, conserve les BTC sur des adresses Bitcoin publiées et **crée** (mint) la même quantité de WBTC vers l'adresse Ethereum du marchand ;
3. pour le rachat, le marchand **détruit** (burn) ses WBTC et le dépositaire lui libère les BTC.

Les particuliers n'ont pas accès à la création : ils achètent du WBTC à un marchand, sur un exchange ou sur un DEX. En 2024, BitGo a annoncé une évolution de la garde vers une structure partagée avec une coentreprise associant **BiT Global** : vérifiez la structure de garde applicable à la date des faits (à vérifier).

D'autres enveloppes custodiales fonctionnent sur le même principe, par exemple **cbBTC** (Coinbase) ou **BTCB** (Binance, sur BNB Chain). Les jetons **pontés** (USDC.e, actifs « bridgés ») sont aussi des enveloppes, dont le sous-jacent est verrouillé sur une autre chaîne : voir la leçon sur les bridges.`,
    },
    {
      type: 'compare',
      left: {
        title: 'WETH (non custodial)',
        md: `- Sous-jacent : ETH détenu par un **contrat**.
- Création et rachat : **tout le monde**, à tout instant, sans intermédiaire.
- Aucune vérification d'identité, aucune donnée à requérir.
- Pas de gel possible : ni administrateur, ni pause.
- Pour l'enquête : une simple **conversion** à tracer à 1:1.`,
      },
      right: {
        title: 'WBTC (custodial)',
        md: `- Sous-jacent : BTC conservés par un **dépositaire**.
- Création et rachat : **marchands** uniquement, après vérification d'identité.
- Données possibles chez le dépositaire et chez les marchands (identité, adresses BTC de règlement).
- Le contrat peut être **mis en pause globalement** ; pas de liste noire par adresse connue (à vérifier).
- Pour l'enquête : une conversion **et** un pont vers Bitcoin, avec des acteurs identifiables.`,
      },
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : le rachat de WBTC est un point d’identification',
      md: `Si un suspect fait **détruire** des WBTC (Transfer vers l'adresse nulle signé par un marchand, ou vente de WBTC à un marchand qui les détruit), quelqu'un a dû recevoir des BTC en échange : le marchand connaît son client, le dépositaire connaît le marchand. Relevez le hash de destruction, l'horodatage et le montant, puis cherchez sur Bitcoin la libération correspondante depuis les adresses de garde. À l'inverse, des WBTC qui circulent de portefeuille en portefeuille restent hors de portée du dépositaire.`,
    },
    {
      type: 'widget',
      id: 'unit-converter',
      caption: `Décimales à ne pas confondre : WETH et aWETH 18, WBTC 8, USDC et aUSDC 6. Un montant brut lu dans un événement doit être divisé par 10 puissance le nombre de décimales du jeton.`,
    },
    { type: 'heading', text: 'Les jetons de reçu : la preuve d’un dépôt' },
    {
      type: 'text',
      md: `Quand un utilisateur dépose un actif dans un protocole, il reçoit un **jeton de reçu** qui matérialise sa créance. Le sous-jacent, lui, rejoint une réserve commune à tous les déposants.

**Les aTokens d'Aave.** Déposer 62 WETH dans Aave crée 62 **aEthWETH** au profit du déposant (dans Spectra, \`aWETH\`). Le solde de ce jeton **augmente seul** au fil du temps : c'est un jeton à rebasage, dont le solde affiché vaut la part détenue multipliée par un indice de rémunération. Trois mois plus tard, le suspect peut détenir 62,7 aEthWETH sans avoir rien reçu : la différence est l'**intérêt** versé par les emprunteurs. Au retrait, les aTokens sont **détruits** et le sous-jacent est restitué. Les aTokens sont **transférables** : envoyer de l'aWETH à une autre adresse, c'est lui céder la créance, **sans aucun mouvement de WETH**. Seule réserve : si ces aTokens garantissent un emprunt, le protocole refuse le transfert qui rendrait la position insuffisamment garantie. Les **jetons de dette** (variableDebt…), créés lors d'un emprunt, ne sont pas transférables.

**Le stETH de Lido.** Déposer de l'ETH chez Lido, qui le place en staking, donne du **stETH**, lui aussi à rebasage (le solde est ajusté après chaque rapport quotidien de l'oracle du protocole). Sa version non rebasable, le **wstETH**, est une enveloppe du stETH. Depuis 2023, le stETH peut être racheté contre de l'ETH par une file d'attente de retrait. Particularité utile en rapprochement : un transfert de stETH peut livrer **un ou deux wei de moins** que le montant demandé, à cause des arrondis de parts.

**Les parts de pool (LP).** Apporter deux actifs à un pool d'AMM donne des parts LP : jeton ERC-20 sur Uniswap v2, **NFT** de position sur Uniswap v3. Elles sont transférables et donnent droit à une quote-part des réserves : c'est l'objet de la leçon sur les pools de liquidité.`,
    },
    {
      type: 'table',
      caption: 'Panorama des jetons qui représentent un autre actif',
      headers: ['Jeton', 'Ce qu’il représente', 'Créé quand', 'Détruit quand', 'Solde qui augmente seul', 'Transférable'],
      rows: [
        ['WETH', 'ETH détenu par le contrat, 1:1', '`deposit()`', '`withdraw()`', 'Non', 'Oui'],
        ['WBTC', 'BTC conservés par le dépositaire, 1:1', 'Création par le dépositaire pour un marchand', 'Destruction par un marchand', 'Non', 'Oui'],
        ['aEthWETH, aEthUSDC (aTokens)', 'Créance sur la réserve Aave, intérêts compris', '`supply` / `depositETH`', '`withdraw`', 'Oui (intérêts)', 'Oui, sous réserve de la santé de la position'],
        ['variableDebt… (jeton de dette)', 'Dette d’un emprunteur', '`borrow`', '`repay`, liquidation', 'Oui (intérêts dus)', 'Non'],
        ['stETH / wstETH', 'ETH placé en staking via Lido', 'Dépôt d’ETH chez Lido / enveloppement du stETH', 'Retrait par la file / désenveloppement', 'stETH oui, wstETH non', 'Oui'],
        ['Part LP (UNI-V2…)', 'Quote-part des deux réserves d’un pool', '`addLiquidity`', '`removeLiquidity`', 'Non (la valeur évolue)', 'Oui'],
      ],
    },
    { type: 'heading', text: 'Créé depuis l’adresse nulle, détruit vers elle' },
    {
      type: 'text',
      md: `La norme ERC-20 n'a pas d'événement spécifique pour la création ou la destruction : par convention, une **création** s'écrit \`Transfer(from = 0x000…0, to = bénéficiaire, value)\` et une **destruction** \`Transfer(from = détenteur, to = 0x000…0, value)\`. L'adresse nulle n'a pas de propriétaire ; elle n'a rien « envoyé » et rien « reçu ». Elle indique seulement que la **masse totale du jeton** a augmenté ou diminué.

Deux confusions à éviter :

- **« l'adresse nulle a financé le suspect »** : non, le contrat du jeton a créé des unités en contrepartie d'un dépôt, qu'il faut chercher dans la même transaction ;
- **« les fonds ont été brûlés »** : la destruction d'un jeton de reçu **libère** le sous-jacent (même transaction). Ce n'est une perte définitive que si un actif est envoyé à une adresse sans clé **sans contrepartie**, par exemple à une adresse conventionnelle de destruction comme \`0x…dEaD\` pour un jeton ordinaire.`,
    },
    {
      type: 'flow',
      caption: `Le cas d'ouverture lu correctement : deux conversions, aucune cession. Les flèches en pointillé sont des créations de jetons, pas des paiements.`,
      nodes: [
        { id: 'v', label: 'Cabinet (victime)', kind: 'victim', sub: '0x91c0…a7e4' },
        { id: 's', label: 'Suspect', kind: 'suspect', sub: '0x4be7…19d2' },
        { id: 'weth', label: 'Contrat WETH', kind: 'contract', sub: 'enveloppe 1:1' },
        { id: 'pool', label: 'Aave : Pool', kind: 'contract', sub: 'réserve commune' },
        { id: 'z', label: 'Adresse nulle', kind: 'unknown', sub: 'création de jetons' },
      ],
      edges: [
        { from: 'v', to: 's', label: '62 ETH (vol)' },
        { from: 's', to: 'weth', label: '62 ETH · deposit()' },
        { from: 'z', to: 's', label: '62 WETH · événement Deposit', dashed: true },
        { from: 's', to: 'pool', label: '62 WETH · supply' },
        { from: 'z', to: 's', label: '62 aWETH créés · Supply', dashed: true },
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Dans l’espace d’enquête SPECTRA',
      md: `Sélectionnez la transaction dans le graphe : l'inspecteur affiche la carte **Appel de contrat** (\`deposit()\`, \`supply(address,uint256,address,uint16)\`, \`withdraw(uint256)\`…), les **Journaux d'événements** (\`Deposit\`, \`Withdrawal\`, \`Supply\`, \`Transfer\` depuis l'adresse nulle) et les **Transactions internes** (restitution d'ETH). L'aide de chaque contrat précise son rôle : *enveloppe*, *pool de prêt*, *pool de liquidité*. Avant de conclure qu'un actif « a quitté » le suspect, vérifiez qu'il ne revient pas, sous une autre forme, dans la même transaction.`,
    },
    { type: 'heading', text: 'Comment un traceur doit traiter ces conversions' },
    {
      type: 'text',
      md: `Le principe est simple : **une conversion n'est pas une sortie de fonds**. L'actif marqué entre dans un contrat de conversion et le même titulaire (ou le bénéficiaire désigné dans l'appel) reçoit en échange un autre actif, de même valeur. La part marquée **passe** à l'actif reçu ; la trace continue sur celui-ci.

Dans Spectra, l'outil **« Traçage des fonds »** applique cette règle aux contrats de type *pool*, *routeur*, *agrégateur*, *enveloppe* et *pool de prêt*, ainsi qu'aux créations et destructions depuis l'adresse nulle : la part marquée entrante est convertie, à valeur égale, dans l'actif sortant, quelle que soit la méthode de répartition (FIFO, LIFO, prorata, poison).`,
    },
    {
      type: 'steps',
      items: [
        { title: 'Reconnaître le contrat de conversion', md: `Enveloppe, pool de prêt, pool d'AMM, routeur, agrégateur : vérifiez le contrat (code vérifié, étiquette, aide de l'inspecteur). Un contrat de conversion n'est jamais une contrepartie à identifier.` },
        { title: 'Identifier le bénéficiaire de la contrepartie', md: `Le jeton créé ou l'actif restitué va-t-il au signataire ? Lisez les paramètres décodés : \`onBehalfOf\` (Aave), \`to\` (retrait, routeur), \`recipient\`. Un bénéficiaire différent est un **nouveau saut**.` },
        { title: 'Reporter la part marquée à valeur égale', md: `62 ETH marqués deviennent 62 WETH marqués, puis 62 aWETH marqués. Pour une conversion entre actifs de prix différents, valorisez au cours de la transaction et indiquez la source du cours.` },
        { title: 'Suivre le nouvel actif, y compris ses transferts', md: `Un transfert d'aWETH ou de parts LP déplace la valeur. C'est souvent le maillon que l'analyse oublie, parce qu'aucun ETH ni stablecoin ne bouge.` },
        { title: 'Reconvertir au rachat', md: `La destruction du jeton de reçu restitue le sous-jacent (intérêts compris pour un aToken) : la trace reprend sur l'actif restitué, chez le destinataire indiqué dans l'appel.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ne pas compter deux fois la même valeur',
      md: `Le sous-jacent déposé (dans la réserve du protocole) et le jeton de reçu (chez le déposant) sont **la même valeur vue de deux côtés**. Suivez le jeton de reçu, qui désigne le titulaire de la créance ; ne « suivez » jamais les fonds dans la réserve, qui mélange ceux de milliers de déposants. Les intérêts accumulés sur un aToken sont le produit du placement de fonds marqués : signalez-les séparément du montant d'origine.`,
    },
    {
      type: 'case',
      title: 'Cas — l’aWETH qui change de main',
      md: `Reprise du cas d'ouverture. Le 4 mars à 14:09 UTC, \`0x4be7…19d2\` détient 62 aWETH issus des fonds du cabinet. Le 21 mars, il transfère **62,18 aWETH** à \`0x7d03…c55e\`, une adresse neuve dont le gaz a été payé par un retrait d'échangeur instantané. Le 2 avril, \`0x7d03…c55e\` appelle \`withdraw\` : 62,31 aWETH sont détruits et 62,31 WETH lui sont restitués, puis désenveloppés en ETH.

Une lecture limitée à l'ETH et aux stablecoins conclut : « les fonds sont bloqués dans Aave ». Une lecture correcte établit : conversion (ETH → WETH → aWETH), **cession de la créance** par transfert d'aWETH (nouveau saut, nouvelle adresse), rachat et désenveloppement par le cessionnaire. Les 0,31 ETH d'écart sont des intérêts. La piste continue sur \`0x7d03…c55e\`, et le paiement de son gaz est un pivot d'identification.`,
    },
    { type: 'heading', text: 'Geler : qui a la main ?' },
    {
      type: 'text',
      md: `La question « peut-on geler ? » se pose **jeton par jeton**, et la réponse dépend de l'existence d'un acteur doté d'un pouvoir sur le contrat ou sur le sous-jacent.`,
    },
    {
      type: 'table',
      caption: 'Pouvoir de gel selon le jeton (à vérifier pour chaque version de contrat et chaque chaîne)',
      headers: ['Jeton', 'Qui a la main ?', 'Gel par adresse', 'Levier réaliste'],
      rows: [
        ['USDC', 'Circle (émetteur)', 'Oui : liste noire (`blacklist`)', 'Demande de gel à l’émetteur, très rapide si elle est bien documentée'],
        ['USDT', 'Tether (émetteur)', 'Oui : `addBlackList`, voire destruction des fonds bloqués', 'Idem ; actif sur de nombreuses chaînes'],
        ['DAI', 'Protocole décentralisé (écosystème Sky, ex-MakerDAO)', 'Non : pas de fonction de gel', 'Suivre jusqu’à une plateforme, ou saisie des clés'],
        ['WETH', 'Personne', 'Non : ni administrateur ni pause', 'Suivre jusqu’à une plateforme, ou saisie des clés'],
        ['WBTC', 'Dépositaire et marchands', 'Pas de liste noire par adresse connue ; pause globale possible (à vérifier)', 'Réquisition du dépositaire et des marchands lors d’un rachat contre BTC'],
        ['aTokens', 'Gouvernance Aave', 'Non : la gouvernance peut geler ou suspendre une **réserve entière**, pas une adresse', 'Surveillance, saisie des clés, ou gel de l’actif emprunté'],
        ['Parts LP', 'Personne (pool sans administrateur)', 'Non', 'Suivre jusqu’au retrait, puis l’actif retiré'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'De l’USDC déposé dans Aave n’est plus de l’USDC',
      md: `Un suspect qui dépose 400 000 USDC dans Aave détient désormais **400 000 aEthUSDC**, un jeton que Circle ne peut pas inscrire sur sa liste noire. Le sous-jacent est détenu par le contrat de l'aToken, commun à tous les déposants : aucun émetteur ne bloquera un contrat de protocole, ce qui gèlerait tous les clients. Seul le **retrait vers une adresse bloquée** échouera. Agir **avant** le dépôt, ou viser l'adresse vers laquelle l'USDC ressortira.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Saisir un jeton de reçu',
      md: `Un aToken, une part LP ou du WETH sont des crypto-actifs détenus à l'adresse du suspect : ils peuvent être saisis si l'on **contrôle les clés** (support saisi, phrase de récupération), dans le cadre des saisies spéciales et en lien avec l'AGRASC. Deux options sont à soumettre au magistrat : transférer le jeton de reçu tel quel vers une adresse de l'État, ou **racheter le sous-jacent** (retrait, désenveloppement) puis le transférer. La seconde évite de laisser des fonds dans un protocole tiers, mais modifie la nature de l'actif saisi : la décision et chaque transaction doivent être consignées.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Rédiger : nommer la conversion',
      md: `Écrivez la conversion, pas un transfert : « Le 4 mars 2026 à 14:06 UTC, l'adresse \`0x4be7…19d2\` a converti 62 ETH en 62 WETH (contrat WETH9, appel \`deposit()\`, événement \`Deposit\`, tx \`0x…\`). À 14:09 UTC, elle a déposé ces 62 WETH sur Aave v3 et reçu 62 aEthWETH (appel \`supply\`, événement \`Supply\`, création depuis l'adresse nulle). » Le lecteur doit comprendre que le titulaire n'a pas changé.`,
    },
  ],
  keyPoints: [
    `Un jeton enveloppé ou un jeton de reçu représente un autre actif : la conversion ne change pas le titulaire, la trace continue sur le nouvel actif.`,
    `WETH : enveloppe non custodiale 1:1 (deposit / withdraw, événements Deposit / Withdrawal, restitution d'ETH en transaction interne), sans administrateur ni gel.`,
    `WBTC : enveloppe custodiale ; dépositaire et marchands identifiés créent et rachètent les jetons, ce qui ouvre des réquisitions lors d'un rachat contre BTC.`,
    `aTokens et stETH sont des jetons de reçu à rebasage, transférables : un transfert d'aWETH cède la créance sans qu'aucun ETH ne bouge.`,
    `Un Transfer depuis ou vers l'adresse nulle est une création ou une destruction de jetons : ni acteur, ni perte, mais une contrepartie à chercher dans la même transaction.`,
    `Tracer à valeur égale en suivant le jeton de reçu, jamais la réserve commune, et sans compter deux fois la même valeur.`,
    `Gel : USDC et USDT oui (émetteurs), DAI, WETH, parts LP non ; aTokens : seule une réserve entière peut être gelée ; WBTC : le levier est le dépositaire.`,
  ],
  quiz: [
    {
      q: `Le suspect reçoit 62 aEthWETH dont l'expéditeur affiché est \`0x0000…0000\`. Que s'est-il passé ?`,
      options: [
        `Un complice détenteur de l'adresse nulle lui a versé des fonds`,
        `Le contrat de l'aToken a créé 62 jetons de reçu en contrepartie d'un dépôt de 62 WETH dans Aave`,
        `Les fonds de la victime ont été détruits`,
        `Il s'agit d'un airdrop non sollicité sans valeur`,
      ],
      answer: 1,
      explain: `L'adresse nulle n'a pas de propriétaire. Un Transfer depuis 0x0 est la convention ERC-20 pour une création de jetons ; la contrepartie (le dépôt de WETH, événement Supply) figure dans la même transaction.`,
    },
    {
      kind: 'truefalse',
      q: `Circle peut inscrire sur sa liste noire une adresse qui détient des aEthUSDC, ce qui bloque la position du suspect dans Aave.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `L'aEthUSDC est un jeton d'Aave, pas de Circle. Le sous-jacent USDC est détenu par le contrat de l'aToken, commun à tous les déposants. Circle ne peut bloquer que des adresses détenant de l'USDC : le retrait vers une adresse bloquée échouerait, mais la position elle-même n'est pas gelée.`,
    },
    {
      kind: 'multi',
      q: `Quelles affirmations sur le WETH (contrat WETH9) sont exactes ? (plusieurs réponses)`,
      options: [
        `1 WETH est toujours remboursable contre 1 ETH, sans intermédiaire`,
        `Le contrat émet Deposit et Withdrawal`,
        `Un administrateur peut geler les WETH d'une adresse sur réquisition`,
        `L'ETH restitué au désenveloppement apparaît comme une transaction interne`,
      ],
      answer: [0, 1, 3],
      explain: `WETH9 n'a ni propriétaire ni fonction de gel. Il convertit 1:1 dans les deux sens, signale les opérations par Deposit / Withdrawal et rend l'ETH par un appel interne.`,
    },
    {
      q: `Un suspect a vendu 12 WBTC à un marchand WBTC, qui les a ensuite détruits pour récupérer des BTC. Quelle démarche est la plus utile ?`,
      options: [
        `Demander au contrat WBTC de geler l'adresse du suspect`,
        `Considérer les fonds comme perdus, puisque les WBTC ont été détruits`,
        `Requérir le marchand (identité de son client, règlement) et, au besoin, le dépositaire ; rechercher la libération correspondante sur Bitcoin`,
        `Requérir Uniswap, où les WBTC sont échangés`,
      ],
      answer: 2,
      explain: `Le rachat custodial passe par des acteurs identifiés : le marchand connaît son client, le dépositaire connaît le marchand et libère des BTC depuis des adresses de garde, traçables sur Bitcoin.`,
    },
    {
      q: `Trois mois après un dépôt de 62 WETH, le suspect détient 62,7 aEthWETH sans avoir reçu aucun transfert. Comment l'interpréter ?`,
      options: [
        `Un tiers lui a envoyé 0,7 aEthWETH par une transaction interne`,
        `Le solde des aTokens augmente avec les intérêts versés par les emprunteurs : c'est un jeton à rebasage`,
        `Une erreur de l'explorateur`,
        `Le suspect a emprunté 0,7 WETH`,
      ],
      answer: 1,
      explain: `Le solde affiché d'un aToken vaut la part détenue multipliée par un indice de rémunération croissant. Les 0,7 représentent l'intérêt, produit du placement des fonds marqués, à signaler séparément du montant d'origine.`,
    },
    {
      kind: 'truefalse',
      q: `Un transfert d'aWETH d'une adresse A vers une adresse B déplace de la valeur, alors même qu'aucun ETH ni WETH ne bouge.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `L'aWETH est la créance sur la réserve : le céder, c'est céder le droit de retirer le sous-jacent. B pourra racheter les WETH à son profit. Ce transfert est un saut à part entière dans la trace.`,
    },
    {
      q: `Dans un traçage, 62 ETH marqués sont enveloppés, puis déposés dans Aave. Quelle présentation est correcte ?`,
      options: [
        `62 ETH marqués dans la réserve d'Aave et 62 aWETH marqués chez le suspect, soit 124 ETH de valeur marquée`,
        `62 ETH perdus dans Aave`,
        `62 aWETH marqués chez le suspect : la réserve et le jeton de reçu sont la même valeur vue de deux côtés`,
        `Une part de la réserve d'Aave au prorata des dépôts de tous les utilisateurs`,
      ],
      answer: 2,
      explain: `Ne comptez pas deux fois la même valeur et ne suivez pas la réserve commune. Le jeton de reçu désigne le titulaire de la créance : c'est lui qu'on suit.`,
    },
    {
      kind: 'multi',
      q: `Pour quels jetons un gel par adresse à la demande d'un émetteur ou d'un administrateur est-il possible ? (plusieurs réponses)`,
      options: ['USDC', 'USDT', 'DAI', 'WETH'],
      answer: [0, 1],
      explain: `Les contrats USDC (Circle) et USDT (Tether) disposent d'une liste noire. DAI et WETH n'ont aucune fonction de gel : il faut suivre les fonds jusqu'à une plateforme ou saisir les clés.`,
    },
    {
      q: `Pourquoi certains explorateurs n'affichent-ils pas de mouvement de WETH lors d'un enveloppement ?`,
      options: [
        `Parce que le WETH est un actif natif`,
        `Parce que le contrat WETH9 émet Deposit et non un Transfer depuis l'adresse nulle : le mouvement doit être reconstitué par l'outil`,
        `Parce que l'enveloppement a lieu hors chaîne`,
        `Parce que le WETH n'a pas de décimales`,
      ],
      answer: 1,
      explain: `L'historique de jetons repose sur les événements Transfer. WETH9 signale l'enveloppement par Deposit : selon l'outil, le mouvement est reconstitué ou absent.`,
    },
    {
      q: `Un événement brut indique un transfert de 250000000 unités de WBTC. Quel montant cela représente-t-il ?`,
      options: ['0,25 WBTC', '2,5 WBTC', '250 WBTC', '250 000 000 WBTC'],
      answer: 1,
      explain: `Le WBTC a 8 décimales, comme le bitcoin : 250 000 000 / 10^8 = 2,5 WBTC. L'erreur de décimales est une source classique de préjudice mal chiffré.`,
    },
  ],
  flashcards: [
    { front: 'Jeton enveloppé', back: `Jeton ERC-20 qui représente 1:1 un actif d'une autre nature (ETH natif, BTC, actif d'une autre chaîne).` },
    { front: 'WETH9', back: `Contrat 0xC02a…6Cc2 ; deposit() / withdraw(uint256) ; événements Deposit / Withdrawal ; aucun administrateur, aucun gel.` },
    { front: 'Désenveloppement WETH', back: `WETH détruits, ETH restitué par transaction interne du contrat WETH ; événement Withdrawal.` },
    { front: 'WBTC', back: `Enveloppe custodiale (8 décimales) : BTC conservés par un dépositaire, création et rachat réservés à des marchands identifiés.` },
    { front: 'Jeton de reçu', back: `Créance sur un protocole remise contre un dépôt : aTokens (Aave), stETH (Lido), parts LP.` },
    { front: 'aToken', back: `Créé au dépôt, détruit au retrait ; solde qui augmente avec les intérêts ; transférable si la position reste suffisamment garantie.` },
    { front: 'Jeton de dette (variableDebt…)', back: `Créé lors d'un emprunt sur Aave ; non transférable ; détruit au remboursement ou à la liquidation.` },
    { front: 'Transfer depuis 0x0', back: `Création de jetons (mint). La contrepartie est dans la même transaction.` },
    { front: 'Transfer vers 0x0', back: `Destruction de jetons (burn) ; pour un jeton de reçu, elle libère le sous-jacent.` },
    { front: 'Règle de traçage d’une conversion', back: `La part marquée passe à l'actif reçu, à valeur égale ; suivre le jeton de reçu, pas la réserve commune.` },
    { front: 'USDC déposé dans Aave', back: `Devient de l'aEthUSDC, que Circle ne peut pas geler ; seul un retrait vers une adresse bloquée échouerait.` },
    { front: 'stETH : écart d’un ou deux wei', back: `Arrondi de parts propre au stETH : un transfert peut livrer 1 à 2 wei de moins que demandé.` },
  ],
}
