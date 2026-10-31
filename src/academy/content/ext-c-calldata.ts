// Niveau 3 — Smart contracts : décoder un appel de contrat (sélecteurs, ABI,
// données d'entrée). Sélecteurs et topics vérifiés avec src/engine/keccak.ts.
// Acteurs réels (Uniswap, Circle, Tether, Etherscan, Aave) décrits factuellement ;
// le faux portail, les victimes et les adresses des cas sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_CALLDATA: Lesson = {
  id: 'calldata-selecteurs',
  title: 'Décoder un appel de contrat : sélecteurs, ABI et données d\'entrée',
  level: 3,
  track: 'contrats',
  minutes: 40,
  summary: `Les données d'entrée d'une transaction disent exactement ce que le signataire a demandé au contrat. Calcul du sélecteur à partir de la signature canonique, encodage ABI par mots de 32 octets (adresses, montants en unités de base, décimales propres à chaque chaîne, types dynamiques et offsets), bases de signatures publiques et leurs limites (collisions, noms trompeurs, contrats non vérifiés), autorisations approve, permit et transferFrom, et lecture des arguments qui désignent le vrai bénéficiaire.`,
  objectives: [
    `Calculer et reconnaître un sélecteur de fonction, et expliquer pourquoi la signature doit être écrite sous sa forme canonique.`,
    `Décoder des données d'entrée mot par mot, y compris un tableau dynamique (offset, longueur, éléments), en appliquant les décimales on-chain du jeton et de la chaîne.`,
    `Utiliser une base de signatures publique avec discernement : collisions, homonymes, noms choisis par un attaquant, contrats non vérifiés.`,
    `Distinguer approve, permit (EIP-2612) et transferFrom : qui signe, qui paie le gas, ce qui apparaît dans l'historique de la victime.`,
    `Trouver le vrai bénéficiaire d'une opération dans ses arguments (to, recipient, onBehalfOf) plutôt que dans le signataire ou le contrat appelé.`,
  ],
  prerequisites: ['transactions-internes', 'drainers-approvals'],
  practice: ['approve-drain', 'splitter-internes'],
  blocks: [
    {
      type: 'text',
      md: `Un artisan de Clermont-Ferrand reçoit un courriel l'invitant à « migrer » ses USDC vers une nouvelle version du contrat avant une date butoir. Le site ressemble à une interface de DEX ; il connecte son portefeuille et « signe pour vérifier la propriété ». Aucune transaction n'est envoyée, aucun frais n'est demandé. Quarante-trois minutes plus tard, **41 870 USDC** quittent son adresse.

Dans son historique, il ne trouve **aucune transaction signée par lui**. Celle qui a vidé son compte a été envoyée par une adresse inconnue, vers le contrat USDC. Pour comprendre ce qui s'est passé — et pour trouver où sont partis les fonds —, il faut lire les **données d'entrée** des transactions de l'attaquant : la fonction appelée, et surtout ses **arguments**.

La leçon « Lire un smart contract » a posé les bases (sélecteur, mots de 32 octets, logs). Celle-ci va plus loin : forme canonique, types dynamiques, pièges des bases de signatures et lecture des autorisations.`,
    },
    { type: 'heading', text: 'Du nom de fonction au sélecteur' },
    {
      type: 'text',
      md: `Le **sélecteur** est formé des **4 premiers octets** du hash Keccak-256 de la **signature canonique** de la fonction. La signature canonique obéit à des règles strictes :

- le nom de la fonction, sensible à la casse, suivi des **types** des paramètres entre parenthèses ;
- **aucun espace** et **aucun nom de paramètre** : \`transfer(address,uint256)\`, pas \`transfer(address to, uint256 amount)\` ;
- les alias sont développés : \`uint\` s'écrit \`uint256\`, \`int\` s'écrit \`int256\` ;
- les structures (tuples) s'écrivent entre parenthèses imbriquées : \`exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))\`.

Un seul caractère de différence produit un sélecteur sans aucun rapport. C'est ce qui rend les sélecteurs reconnaissables à l'œil nu… et ce qui oblige à la rigueur quand on les calcule soi-même.`,
    },
    {
      type: 'table',
      caption: `Une signature, un sélecteur : la moindre variation change tout (valeurs calculées avec Keccak-256).`,
      headers: ['Signature', 'Sélecteur', 'Remarque'],
      rows: [
        ['`transfer(address,uint256)`', '`0xa9059cbb`', 'Forme canonique : c\'est celle que les contrats reconnaissent'],
        ['`transfer(address,uint)`', '`0x6cb927d8`', 'Alias non développé : sélecteur faux, aucun contrat ERC-20 ne répond'],
        ['`claim()`', '`0x4e71d92d`', 'Nom courant des fonctions de réclamation'],
        ['`Claim()`', '`0x3158952e`', 'Majuscule : autre sélecteur, autre fonction'],
        ['`SecurityUpdate()`', '`0x5fba79f5`', 'Nom fréquemment choisi par des contrats de drainer'],
      ],
    },
    {
      type: 'table',
      caption: `Sélecteurs utiles en enquête, au-delà de transfer, approve et transferFrom (standards et contrats de référence : EIP-2612, Uniswap, WETH, Aave, BitGo ; valeurs vérifiées).`,
      headers: ['Sélecteur', 'Fonction', 'À surveiller'],
      rows: [
        ['`0xd505accf`', '`permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`', 'Autorisation EIP-2612 publiée par un tiers'],
        ['`0x7ff36ab5`', '`swapExactETHForTokens(uint256,address[],address,uint256)`', 'Argument `to` : bénéficiaire des jetons'],
        ['`0x18cbafe5`', '`swapExactTokensForETH(uint256,uint256,address[],address,uint256)`', 'ETH versé à `to` par transaction interne'],
        ['`0x38ed1739`', '`swapExactTokensForTokens(uint256,uint256,address[],address,uint256)`', 'Chemin `path` et bénéficiaire `to`'],
        ['`0xd0e30db0` / `0x2e1a7d4d`', '`deposit()` / `withdraw(uint256)`', 'Enveloppement et désenveloppement WETH'],
        ['`0x617ba037`', '`supply(address,uint256,address,uint16)`', 'Garantie créditée à `onBehalfOf`'],
        ['`0xa415bcad`', '`borrow(address,uint256,uint256,uint16,address)`', 'Fonds empruntés versés au signataire, dette portée par `onBehalfOf`'],
        ['`0x3ef13367`', '`flushTokens(address)`', 'Reversement d\'un contrat de dépôt (forwarder)'],
        ['`0xac9650d8`', '`multicall(bytes[])`', 'Plusieurs appels emballés : décoder chaque élément'],
      ],
    },
    { type: 'heading', text: 'L\'encodage ABI : des mots de 32 octets' },
    {
      type: 'text',
      md: `Après le sélecteur, les arguments sont encodés selon l'**ABI** (*Application Binary Interface*) du contrat, en **mots de 32 octets** (64 caractères hexadécimaux). Dans l'inspecteur de Spectra, le bouton « Données d'entrée brutes » du panneau **Appel de contrat** les affiche numérotés \`[0]\`, \`[1]\`… sous le sélecteur.

Règles pour les types **statiques** :

- **address** : 20 octets complétés à gauche par 12 octets nuls (24 zéros hexadécimaux) ;
- **uint256** : entier en hexadécimal, gros-boutiste, complété à gauche par des zéros. Un montant est toujours exprimé en **unités de base** : il faut diviser par 10 puissance les **décimales on-chain** du jeton ;
- **bool** : 0 ou 1 sur 32 octets ;
- **bytes32** : complété à **droite**.

Règle pour les types **dynamiques** (\`address[]\`, \`bytes\`, \`string\`) : la tête ne contient pas la valeur mais un **offset**, c'est-à-dire la position, en octets depuis le début des arguments, où commence la partie dynamique. À cet endroit, on lit d'abord la **longueur**, puis les éléments.`,
    },
    {
      type: 'compare',
      left: {
        title: '2 500 USDT sur Ethereum',
        md: `Le contrat USDT d'Ethereum utilise **6 décimales**.

2 500 × 10⁶ = 2 500 000 000 = \`0x9502F900\`

Mot encodé : \`0000…00009502f900\``,
      },
      right: {
        title: '2 500 USDT sur BNB Smart Chain',
        md: `Le contrat USDT de BSC utilise **18 décimales**.

2 500 × 10¹⁸ = 2 500 000 000 000 000 000 000 = \`0x878678326EAC900000\`

Lire ce mot avec 6 décimales donnerait 2 500 milliards d'USDT.`,
      },
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Les décimales dépendent du contrat, pas du symbole',
      md: `Un même « USDT » a 6 décimales sur Ethereum et sur Tron, mais 18 sur BNB Smart Chain. Lisez toujours la valeur \`decimals()\` du **contrat effectivement appelé**, sur la **chaîne** concernée, avant de convertir un montant brut. Dans l'inspecteur, chaque argument de montant est affiché avec sa valeur brute, sa conversion et le nombre de décimales appliqué.`,
    },
    { type: 'widget', id: 'unit-converter', caption: `Convertir unités de base et montants lisibles : wei, gwei, ETH et décimales des jetons.` },
    {
      type: 'text',
      md: `**Exemple complet avec un type dynamique.** Un utilisateur échange 1,5 ETH contre au moins 3 980 USDT sur le routeur Uniswap V2. Les données d'entrée font 228 octets : le sélecteur \`0x7ff36ab5\`, puis sept mots. Notez que les **1,5 ETH n'y figurent pas** : l'ETH envoyé est porté par le champ \`value\` de la transaction, pas par les arguments.`,
    },
    {
      type: 'table',
      caption: `swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) — bénéficiaire fictif, contrats WETH et USDT réels.`,
      headers: ['Mot', 'Contenu (32 octets)', 'Lecture'],
      rows: [
        ['[0]', '`00…00ed39fb00`', 'amountOutMin = 0xED39FB00 = 3 980 000 000 → 3 980 USDT (6 décimales)'],
        ['[1]', '`00…0000000080`', 'Offset de `path` : 0x80 = 128 octets, soit après les 4 mots de tête'],
        ['[2]', '`000000000000000000000000` `5c1e7b2a90d4f36e8b0a1c7d9e2f4a6b8c0d1e3f`', 'to = 0x5c1e…1e3f : bénéficiaire des USDT'],
        ['[3]', '`00…006955b900`', 'deadline = 1 767 225 600 = 1er janvier 2026, 00:00:00 UTC'],
        ['[4]', '`00…0000000002`', 'Longueur de `path` : 2 éléments (début de la partie dynamique, octet 128)'],
        ['[5]', '`000000000000000000000000` `c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`', 'path[0] = WETH : l\'ETH est enveloppé avant le swap'],
        ['[6]', '`000000000000000000000000` `dac17f958d2ee523a2206206994597c13d831ec7`', 'path[1] = USDT : jeton reçu'],
      ],
    },
    {
      type: 'check',
      q: `Dans l'exemple ci-dessus, le mot [1] vaut 0x80. Que signifie-t-il ?`,
      options: [
        `Que l'utilisateur a envoyé 128 ETH`,
        `Que le tableau path commence 128 octets après le début des arguments, où l'on lit sa longueur puis ses éléments`,
        `Que le swap a été exécuté au bloc 128`,
        `Que la transaction a échoué avec le code 0x80`,
      ],
      answer: 1,
      explain: `Pour un type dynamique, la tête contient un offset. 0x80 = 128 = 4 mots de tête × 32 octets : la partie dynamique commence juste après, par la longueur (2), puis WETH et USDT.`,
    },
    { type: 'heading', text: 'Fonction inconnue : bases de signatures, collisions, noms trompeurs' },
    {
      type: 'text',
      md: `Quand le code source d'un contrat est **vérifié**, l'explorateur dispose de son ABI et décode tout. Sinon, il ne connaît que le sélecteur et le rapproche de **bases de signatures publiques** (de type 4byte), alimentées par quiconque soumet une signature. Trois limites :

- **les collisions** : 4 octets ne laissent qu'environ 4,3 milliards de valeurs. Des signatures différentes partagent donc parfois un sélecteur : \`burn(uint256)\` et \`collate_propagate_storage(bytes16)\` donnent toutes deux \`0x42966c68\`. Une collision peut même être **fabriquée** par force brute : lors du piratage de Poly Network en 2021, l'attaquant a fait appeler une fonction privilégiée, \`putCurEpochConPubKeyBytes(bytes)\`, en forgeant un nom de fonction de même sélecteur, \`0x41973cd9\` ;
- **les noms choisis par l'auteur** : un drainer peut nommer sa fonction \`Claim()\`, \`SecurityUpdate()\` ou \`Multicall()\`. Le nom n'engage à rien : seul le **comportement observé** (transferts, événements) fait foi ;
- **l'absence de résultat** : un contrat non vérifié peut utiliser des sélecteurs que personne n'a référencés. Spectra l'affiche alors comme « fonction inconnue (0x…) » et n'en décode pas les arguments, comme un explorateur réel.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Décrire ce qui est établi, et pas plus',
      md: `Dans un rapport, distinguez trois niveaux : « fonction \`approve(address,uint256)\` d'un contrat **vérifié** » (établi) ; « sélecteur \`0x3158952e\`, que les bases publiques associent à \`Claim()\` » (probable, à confirmer par le comportement) ; « sélecteur \`0x…\` non référencé ; la transaction a produit les transferts suivants » (comportement seul). Ne présentez jamais un nom tiré d'une base publique comme une certitude.`,
    },
    { type: 'heading', text: 'Approve, permit, transferFrom : qui signe quoi' },
    {
      type: 'table',
      headers: ['Opération', 'Qui signe la transaction', 'Qui paie le gas', 'Trace dans l\'historique de la victime', 'Arguments clés'],
      rows: [
        ['`approve(spender, value)` · `0x095ea7b3`', 'La victime', 'La victime', 'Une transaction vers le contrat du jeton, valeur 0, événement Approval', '`spender` : bénéficiaire de l\'autorisation ; `value` souvent 2²⁵⁶−1'],
        ['`permit(owner, spender, value, deadline, v, r, s)` · `0xd505accf`', 'N\'importe qui (souvent l\'attaquant) ; la victime n\'a signé qu\'un message hors chaîne', 'Celui qui publie', 'Aucune transaction signée par elle : seulement un événement Approval où elle est `owner`', '`owner` = victime, `spender` = bénéficiaire, `v, r, s` = signature'],
        ['`transferFrom(from, to, value)` · `0x23b872dd`', 'Le bénéficiaire de l\'autorisation (ou son contrat)', 'Celui qui signe', 'Un transfert sortant (événement Transfer) dans une transaction qu\'elle n\'a pas signée', '`from` = victime, `to` = destination réelle'],
      ],
    },
    {
      type: 'text',
      md: `Trois points de lecture :

- **l'autorisation illimitée** : la valeur maximale d'un uint256, 2²⁵⁶−1, s'écrit en 64 caractères \`f\` (\`0xffff…ffff\`), soit 115 792 089 237 316 195 423 570 985 008 687 907 853 269 984 665 640 564 039 457 584 007 913 129 639 935. Les explorateurs l'affichent souvent comme « illimitée », et l'inspecteur de Spectra comme « 2²⁵⁶−1 (valeur maximale : autorisation illimitée) » ;
- **le permit (EIP-2612)** : la victime signe un message structuré (EIP-712) contenant \`owner\`, \`spender\`, \`value\`, un nonce propre au jeton et une échéance. Son **nonce de compte ne bouge pas** : seul le compteur de permit du contrat du jeton avance. L'USDC d'Ethereum accepte ce mécanisme ; l'USDT d'Ethereum ne le propose pas ; le DAI utilise une variante non standard, \`permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)\` (\`0x8fcbaf0c\`). Le contrat Permit2 d'Uniswap étend les autorisations par signature à tout jeton ERC-20 une fois celui-ci autorisé au profit de Permit2 ; les kits de drainers savent aussi exploiter les signatures Permit2 ;
- **le transferFrom** : le titulaire n'apparaît **que** dans l'argument \`from\` et dans l'événement Transfer. Le signataire, lui, est l'attaquant ou un relais qu'il paie.`,
    },
    {
      type: 'flow',
      caption: `Affaire du faux portail de migration : la victime ne signe qu'un message ; l'attaquant publie l'autorisation, puis déplace et échange les fonds au profit d'une troisième adresse.`,
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: '0x3a9d…71c2' },
        { id: 'sig', label: 'Signature hors chaîne', kind: 'unknown', sub: 'message EIP-712' },
        { id: 'att', label: 'Attaquant', kind: 'suspect', sub: '0x9e44…b03d · signe et paie' },
        { id: 'usdc', label: 'Contrat USDC', kind: 'contract', sub: 'permit · transferFrom' },
        { id: 'r', label: 'Routeur Uniswap V2', kind: 'dex' },
        { id: 'dst', label: 'Bénéficiaire final', kind: 'suspect', sub: '0x61d0…e9a4' },
      ],
      edges: [
        { from: 'v', to: 'sig', label: '14:12 UTC · « vérifier la propriété »' },
        { from: 'sig', to: 'att', label: 'transmise par le site' },
        { from: 'att', to: 'usdc', label: '14:55 · permit, 14:56 · transferFrom' },
        { from: 'usdc', to: 'att', label: '41 870 USDC (événement Transfer)' },
        { from: 'att', to: 'r', label: '15:03 · swapExactTokensForETH' },
        { from: 'r', to: 'dst', label: 'ETH · transaction interne, to = 0x61d0…' },
      ],
    },
    { type: 'heading', text: 'Lire les arguments pour trouver le vrai bénéficiaire' },
    {
      type: 'text',
      md: `Le **signataire** d'une transaction est celui qui l'a autorisée et a payé le gas ; le **contrat appelé** est un intermédiaire. Le bénéficiaire, lui, est très souvent désigné par un **argument**. Lisez-le systématiquement dans le panneau **Appel de contrat**, puis confirmez-le par les transferts (événements ou transactions internes).`,
    },
    {
      type: 'table',
      headers: ['Fonction', 'Argument', 'Ce qu\'il désigne'],
      rows: [
        ['`transfer` / `transferFrom`', '`to`', 'Destinataire des jetons ; dans transferFrom, `from` est le titulaire débité'],
        ['`swapExact…` (routeur Uniswap V2)', '`to`', 'Bénéficiaire du produit du swap, qui peut différer du signataire'],
        ['`supply` (Aave)', '`onBehalfOf`', 'Adresse créditée de la garantie (aTokens), pas forcément le déposant'],
        ['`borrow` (Aave)', '`onBehalfOf`', 'Adresse qui porte la dette ; les fonds empruntés vont au signataire'],
        ['`withdraw` (Aave), `removeLiquidity…`', '`to`', 'Adresse qui reçoit les actifs retirés'],
        ['Retrait de pool de confidentialité', '`recipient`, `relayer`', 'Bénéficiaire du retrait ; relayeur qui a payé le gas et prélève sa commission'],
        ['Bridge (`bridgeOut…`)', '`recipient`, identifiant de chaîne', 'Bénéficiaire sur la chaîne d\'arrivée'],
        ['`execTransaction` (Safe), `multicall`', '`to`, `data` / `data[]`', 'Appel emballé : décoder les données internes, qui commencent par leur propre sélecteur'],
      ],
    },
    {
      type: 'check',
      q: `Une transaction signée par 0xAAAA appelle swapExactTokensForETH sur un routeur, avec to = 0xBBBB. Où se poursuit la trace de l'ETH obtenu ?`,
      options: [
        `Sur 0xAAAA, puisqu'il a signé`,
        `Sur le routeur, puisqu'il a été appelé`,
        `Sur 0xBBBB, qui reçoit l'ETH par transaction interne du routeur`,
        `Sur le contrat WETH`,
      ],
      answer: 2,
      explain: `Le routeur désenveloppe le WETH et verse l'ETH à l'adresse désignée par to, par une transaction interne. 0xAAAA a cédé les jetons ; 0xBBBB reçoit le produit.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — le faux portail de migration',
      md: `Victime \`0x3a9d…71c2\`. Le 9 mars à 14:12 UTC, elle signe sur le faux portail un message présenté comme une « vérification de propriété ».

Transactions relevées, toutes signées par \`0x9e44…b03d\` (adresse financée la veille par un retrait d'échangeur instantané) :

1. **14:55 UTC** — appel au contrat USDC, sélecteur \`0xd505accf\` : \`permit\`. Arguments : \`owner\` = \`0x3a9d…71c2\`, \`spender\` = \`0x9e44…b03d\`, \`value\` = 2²⁵⁶−1, \`deadline\` = 30 jours plus tard, puis \`v\`, \`r\`, \`s\`. Journal : **Approval** (owner = victime). Nonce de la victime : inchangé.
2. **14:56 UTC** — appel au contrat USDC, sélecteur \`0x23b872dd\` : \`transferFrom\`. Arguments : \`from\` = victime, \`to\` = \`0x9e44…b03d\`, \`value\` = 41 870 000 000 (\`0x9BFA57F80\`), soit **41 870 USDC** à 6 décimales. Journal : **Transfer** victime → \`0x9e44…b03d\`.
3. **15:03 UTC** — après une autorisation (\`approve\`) accordée au routeur à 14:58, appel au routeur Uniswap V2, sélecteur \`0x18cbafe5\` : \`swapExactTokensForETH\`, \`path\` = [USDC, WETH], \`to\` = **\`0x61d0…e9a4\`**. Journaux : Transfer USDC vers le pool, Transfer WETH du pool vers le routeur, Sync et Swap émis par le pool, Withdrawal WETH ; **transaction interne** : routeur → \`0x61d0…e9a4\`.

Conclusions : la victime n'a signé aucune transaction ; l'attaquant a publié l'autorisation et déplacé les fonds ; le produit du swap n'est pas resté chez l'attaquant mais a été versé à \`0x61d0…e9a4\`, où la trace se poursuit. Un traçage qui se serait arrêté au signataire du swap aurait perdu la piste.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : la routine de décodage',
      md: `1. **Statut** : réussie ou échouée.
2. **Contrat appelé** : vérifié ? Jeton officiel, routeur, contrat inconnu ?
3. **Sélecteur** et fonction ; si la fonction est inconnue, ne pas se fier au nom suggéré.
4. **Arguments** : relever chaque adresse (\`to\`, \`recipient\`, \`onBehalfOf\`, \`spender\`, \`owner\`) et chaque montant, convertis avec les décimales du contrat et de la chaîne.
5. **Valeur** native envoyée avec l'appel (hors arguments).
6. **Confirmation** par les événements et les transactions internes : les arguments disent ce qui était demandé, les jambes ce qui a eu lieu.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Rendre le décodage opposable',
      md: `Joignez les données d'entrée brutes et indiquez la **source de l'ABI** : code vérifié sur l'explorateur (avec l'adresse du contrat), interface standard (ERC-20, EIP-2612), ou base de signatures publique (avec mention du risque de collision). Le décodage est alors **reproductible** : n'importe quel expert peut recalculer le sélecteur à partir de la signature et relire les mots de 32 octets. Une capture d'écran de la vue décodée d'un explorateur ne suffit pas.`,
    },
  ],
  keyPoints: [
    `Sélecteur = 4 premiers octets du Keccak-256 de la signature canonique (sans espace, sans nom de paramètre, uint256 et non uint) ; un caractère de différence change tout.`,
    `Arguments ABI : mots de 32 octets ; adresse paddée à gauche ; montants en unités de base ; types dynamiques par offset, puis longueur et éléments.`,
    `Les décimales dépendent du contrat et de la chaîne : USDT à 6 décimales sur Ethereum, 18 sur BSC. L'ETH envoyé est dans le champ value, pas dans les arguments.`,
    `Les bases de signatures publiques sont indicatives : collisions possibles (même fabriquées), noms choisis par l'auteur, fonctions non référencées.`,
    `approve est signé par la victime ; permit est publié par un tiers à partir d'une signature hors chaîne ; transferFrom est signé par le bénéficiaire de l'autorisation.`,
    `Le bénéficiaire réel se lit dans les arguments (to, recipient, onBehalfOf) puis se confirme par les jambes : ni le signataire ni le contrat appelé ne suffisent.`,
  ],
  quiz: [
    {
      q: `Pourquoi le sélecteur de transfer(address,uint) (0x6cb927d8) diffère-t-il de celui de transfer(address,uint256) (0xa9059cbb) ?`,
      options: [
        `Parce que les deux fonctions n'existent pas sur la même chaîne`,
        `Parce que le hash porte sur le texte exact de la signature : l'alias uint doit être écrit uint256 dans la forme canonique`,
        `Parce que le sélecteur dépend de l'adresse du contrat`,
        `Parce que l'un est un événement et l'autre une fonction`,
      ],
      answer: 1,
      explain: `Le sélecteur est le hash d'une chaîne de caractères. La forme canonique développe les alias ; transfer(address,uint) n'est pas la signature que reconnaît un contrat ERC-20.`,
    },
    {
      q: `Le mot d'un argument uint256 vaut 0x…9502f900 dans un appel au contrat USDT d'Ethereum. Quel montant est-ce ?`,
      options: [`2 500 000 000 USDT`, `2 500 USDT`, `0,0000025 USDT`, `25 000 USDT`],
      answer: 1,
      explain: `0x9502F900 = 2 500 000 000 unités de base. L'USDT d'Ethereum a 6 décimales : 2 500 000 000 / 10⁶ = 2 500 USDT.`,
    },
    {
      kind: 'truefalse',
      q: `Le même montant de 2 500 USDT est encodé par le même mot de 32 octets sur Ethereum et sur BNB Smart Chain.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `L'USDT de BSC utilise 18 décimales : 2 500 USDT y valent 2 500 × 10¹⁸ unités (0x878678326EAC900000), contre 2 500 × 10⁶ sur Ethereum.`,
    },
    {
      q: `Dans les données d'entrée de swapExactETHForTokens, où se trouve le montant d'ETH échangé ?`,
      options: [
        `Dans le premier mot, amountOutMin`,
        `Dans le tableau path`,
        `Dans le champ value de la transaction, pas dans les arguments`,
        `Dans le mot deadline`,
      ],
      answer: 2,
      explain: `L'ETH accompagne l'appel via le champ value. amountOutMin est le minimum de jetons accepté en sortie ; path liste les contrats traversés.`,
    },
    {
      kind: 'multi',
      q: `Une base de signatures publique associe le sélecteur d'une transaction de drainer à « SecurityUpdate() ». Quelles affirmations sont exactes ? (plusieurs réponses)`,
      options: [
        `Le nom a pu être choisi par l'auteur du contrat pour rassurer la victime`,
        `Une autre signature peut partager le même sélecteur`,
        `Le nom prouve que le contrat effectue une mise à jour de sécurité`,
        `Le comportement observé (transferts, événements) doit fonder la conclusion`,
      ],
      answer: [0, 1, 3],
      explain: `Le nom d'une fonction est libre et n'engage à rien ; 4 octets laissent place aux collisions, y compris fabriquées. Seules les jambes réellement produites établissent ce que fait le contrat.`,
    },
    {
      q: `La victime n'a signé aucune transaction, mais un événement Approval la désigne comme owner, dans une transaction envoyée par une autre adresse au contrat USDC. Quelle fonction a vraisemblablement été appelée ?`,
      options: [`approve`, `permit`, `transfer`, `withdraw`],
      answer: 1,
      explain: `Avec approve, la victime aurait signé la transaction. Avec permit (EIP-2612), elle signe seulement un message hors chaîne que n'importe qui peut publier : l'événement Approval la désigne comme owner sans qu'elle ait payé de gas.`,
    },
    {
      kind: 'truefalse',
      q: `Après un permit EIP-2612, le nonce du compte de la victime a augmenté d'une unité.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `La victime n'a envoyé aucune transaction : son nonce de compte ne bouge pas. Seul le nonce de permit tenu par le contrat du jeton pour cette adresse avance.`,
    },
    {
      q: `Une transaction appelle borrow sur Aave avec onBehalfOf = 0xC, signée par 0xD. Qui reçoit les fonds empruntés ?`,
      options: [
        `0xC, qui porte la dette`,
        `0xD, le signataire ; 0xC porte la dette (délégation de crédit)`,
        `Le contrat du pool`,
        `L'adresse nulle`,
      ],
      answer: 1,
      explain: `Dans Aave, les fonds empruntés sont versés à l'appelant ; onBehalfOf désigne l'adresse dont la garantie supporte la dette, ce qui suppose une délégation de crédit si elle diffère du signataire. Lire les arguments évite de confondre débiteur et bénéficiaire.`,
    },
    {
      q: `Quelle est la représentation hexadécimale de l'autorisation « illimitée » 2²⁵⁶−1 dans un argument uint256 ?`,
      options: [
        `0x0000…0001`,
        `0x8000…0000`,
        `0xffff…ffff (64 caractères f)`,
        `0x7fff…ffff`,
      ],
      answer: 2,
      explain: `2²⁵⁶−1 est la plus grande valeur d'un uint256 : les 256 bits valent 1, soit 64 chiffres hexadécimaux f.`,
    },
    {
      kind: 'multi',
      q: `Pour rendre opposable le décodage d'un appel de contrat, que joignez-vous au rapport ? (plusieurs réponses)`,
      options: [
        `Les données d'entrée brutes`,
        `La source de l'ABI utilisée (code vérifié, interface standard ou base publique)`,
        `La mention du risque de collision si la signature provient d'une base publique`,
        `Uniquement la capture de la vue décodée de l'explorateur`,
      ],
      answer: [0, 1, 2],
      explain: `Avec les données brutes et la source de l'ABI, n'importe quel expert peut recalculer le sélecteur et relire les mots. La vue décodée d'un explorateur n'est qu'une illustration.`,
    },
  ],
  flashcards: [
    { front: 'Sélecteur de fonction', back: `4 premiers octets du Keccak-256 de la signature canonique, ex. transfer(address,uint256) → 0xa9059cbb.` },
    { front: 'Signature canonique', back: `Nom + types entre parenthèses, sans espace ni nom de paramètre, alias développés (uint → uint256), tuples entre parenthèses.` },
    { front: 'Mot ABI', back: `32 octets (64 caractères hex). Adresse paddée à gauche, uint256 gros-boutiste, bytes32 paddé à droite.` },
    { front: 'Type dynamique (address[], bytes)', back: `La tête contient un offset en octets ; à cet offset : la longueur, puis les éléments.` },
    { front: 'USDT : décimales', back: `6 sur Ethereum et Tron, 18 sur BNB Smart Chain. Toujours lire decimals() du contrat appelé.` },
    { front: 'permit (EIP-2612)', back: `0xd505accf. Signature hors chaîne du titulaire, publiée par un tiers qui paie le gas ; nonce de compte de la victime inchangé.` },
    { front: 'transferFrom', back: `0x23b872dd. Signé par le bénéficiaire de l'autorisation ; la victime n'apparaît que dans from et dans l'événement Transfer.` },
    { front: '2²⁵⁶−1', back: `Valeur maximale d'un uint256 (64 f) : autorisation illimitée.` },
    { front: 'Collision de sélecteurs', back: `Deux signatures, même sélecteur : burn(uint256) et collate_propagate_storage(bytes16) → 0x42966c68.` },
    { front: 'Fonction inconnue', back: `Contrat non vérifié, sélecteur non référencé : juger sur les jambes produites, pas sur un nom supposé.` },
    { front: 'Vrai bénéficiaire', back: `Argument to, recipient ou onBehalfOf, confirmé par les événements et transactions internes.` },
  ],
}
