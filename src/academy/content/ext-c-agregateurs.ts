// Niveau 3 — Smart contracts : agrégateurs et routeurs de DEX.
// Sélecteurs et topics vérifiés avec src/engine/keccak.ts.
// Acteurs réels (Uniswap, 1inch, 0x, ParaSwap, CoW Swap) décrits factuellement,
// sans imputation ; la fraude, les suspects et les adresses des cas sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_AGREGATEURS: Lesson = {
  id: 'agregateurs-routeurs',
  title: 'Agrégateurs et routeurs : un appel, plusieurs swaps',
  level: 3,
  track: 'contrats',
  minutes: 35,
  summary: `Un seul appel à un routeur ou à un agrégateur peut enchaîner plusieurs swaps sur plusieurs pools, découper un ordre entre plusieurs DEX et verser le produit à une adresse qui n'est pas le signataire. Différence entre routeur Uniswap V2 et agrégateur (1inch et autres), lecture des jambes et des événements Swap pool par pool, bénéficiaire final, MEV en bref, conversion « à valeur égale » par le traceur, et les pièges classiques : prendre un pool pour une destination, attribuer les jetons au routeur, compter deux fois.`,
  objectives: [
    `Distinguer routeur de DEX, pool de liquidité et agrégateur, et décrire le chemin des fonds dans chacun des cas.`,
    `Lire les jambes d'un swap multi-sauts ou découpé : entrée initiale, jetons intermédiaires en transit, sortie finale.`,
    `Interpréter un événement Swap de pool (montants entrés et sortis, ordre token0 / token1, destinataire).`,
    `Identifier le bénéficiaire final d'un swap, y compris lorsqu'il diffère du signataire, et le confirmer par le dernier transfert.`,
    `Expliquer comment le traceur de Spectra convertit la part marquée à valeur égale, et éviter les erreurs qui faussent un montant ou une attribution.`,
  ],
  prerequisites: ['dex-defi', 'transactions-internes'],
  practice: ['approve-drain', 'lending-garantie'],
  blocks: [
    {
      type: 'text',
      md: `Les fonds d'une fausse plateforme de trading, 120 000 USDT, sont regroupés sur \`0x8c4f…27e1\`. Le 18 mai à 03:12 UTC, cette adresse signe **une seule transaction** vers le routeur d'un agrégateur. L'explorateur affiche **cinq** transferts de jetons, deux événements \`Swap\`, trois contrats intermédiaires… et une adresse finale, \`0x2b9e…f40c\`, qui reçoit **1,3710 WBTC**.

Un premier analyste a noté dans son tableau « 120 000 USDT envoyés au routeur 1inch » et clos la piste : « fonds partis vers un service DeFi ». Un second a additionné tous les transferts de la transaction et obtenu plus de 240 000 USDT de « volume ». Les deux ont tort. Le premier a pris de l'infrastructure pour une destination ; le second a compté plusieurs fois les mêmes fonds.

Ce que montre réellement la transaction : le suspect a converti ses USDT en WBTC, en deux sauts, et a fait verser le produit à une **autre adresse**. La trace continue — en WBTC, sur \`0x2b9e…f40c\`.`,
    },
    { type: 'heading', text: 'Routeur, pool, agrégateur : qui fait quoi' },
    {
      type: 'terms',
      items: [
        { term: 'Pool de liquidité (paire)', def: `Contrat qui détient deux actifs et applique la formule de l'AMM. C'est lui qui échange réellement, émet l'événement Swap et verse la sortie.` },
        { term: 'Routeur de DEX', def: `Contrat d'entrée d'un DEX (par exemple le routeur Uniswap V2, \`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D\`) : calcule le chemin, achemine les jetons vers les pools de ce DEX et vérifie le minimum de sortie.` },
        { term: 'Agrégateur', def: `Service qui compare de nombreux DEX et pools pour trouver le meilleur prix, puis exécute la route par son propre contrat (1inch, 0x, ParaSwap…) ; certains, comme CoW Swap, font exécuter les ordres par des « solveurs ».` },
        { term: 'Multi-sauts (multi-hop)', def: `Route qui traverse plusieurs pools successifs : USDT → WETH → WBTC. Les actifs intermédiaires n'appartiennent à personne d'autre que l'utilisateur pendant l'exécution.` },
        { term: 'Découpage (split)', def: `Répartition d'un même ordre entre plusieurs pools ou DEX (par exemple 60 % et 40 %) pour limiter le glissement de prix.` },
        { term: 'Bénéficiaire (to, recipient)', def: `Adresse qui reçoit la sortie du swap, désignée par un argument ou, à défaut, le signataire.` },
        { term: 'Jambe en transit', def: `Transfert vers ou depuis un routeur ou un pool à l'intérieur du swap : il achemine les fonds, il ne constitue ni une source ni une destination.` },
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'Routeur Uniswap V2',
        md: `- Un seul DEX : la route ne traverse que ses propres paires.
- Les jetons d'entrée vont **directement** de l'utilisateur à la première paire (\`transferFrom\` exécuté par le routeur).
- Chaque paire verse sa sortie **directement** à la paire suivante, la dernière au bénéficiaire \`to\`.
- Si la sortie est de l'ETH, la dernière paire verse du WETH au routeur, qui le désenveloppe et paie \`to\` par **transaction interne**.
- Arguments lisibles : \`amountIn\`, \`amountOutMin\`, \`path\`, \`to\`, \`deadline\`.`,
      },
      right: {
        title: 'Agrégateur (1inch et autres)',
        md: `- Plusieurs DEX et types de pools dans une même route, découpages possibles.
- Selon l'implémentation, les jetons intermédiaires **transitent** par le contrat de l'agrégateur (ou un contrat exécutant) entre deux pools, ou passent de pool à pool.
- Le contrat de l'agrégateur termine la transaction **sans rien garder** (hors éventuelle commission).
- Fonctions et signatures propres à chaque version du routeur : \`unoswap\`, \`swap\`, etc.
- Le bénéficiaire figure dans un argument (\`to\`, \`recipient\`, \`dstReceiver\`) ou est implicitement le signataire.`,
      },
    },
    {
      type: 'table',
      caption: `Fonctions de swap courantes (sélecteurs vérifiés). Les signatures des agrégateurs changent d'une version de routeur à l'autre : vérifiez le contrat appelé.`,
      headers: ['Sélecteur', 'Fonction', 'Contrat', 'Où lire le bénéficiaire'],
      rows: [
        ['`0x38ed1739`', '`swapExactTokensForTokens(uint256,uint256,address[],address,uint256)`', 'Routeur Uniswap V2', '`to`'],
        ['`0x18cbafe5`', '`swapExactTokensForETH(uint256,uint256,address[],address,uint256)`', 'Routeur Uniswap V2', '`to` (ETH par transaction interne)'],
        ['`0x414bf389`', '`exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))`', 'SwapRouter Uniswap V3', '`recipient`, 4e champ de la structure'],
        ['`0x3593564c`', '`execute(bytes,bytes[],uint256)`', 'Universal Router Uniswap', 'Dans les commandes encodées (`inputs`)'],
        ['`0x0502b1c5`', '`unoswap(address,uint256,uint256,uint256[])`', 'Routeur d\'agrégation 1inch (v5), forme affichée par Spectra', 'Signataire, sauf autre destination prévue ; confirmer par le dernier Transfer'],
        ['`0x12aa3caf`', '`swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)`', 'Routeur d\'agrégation 1inch (v5)', '`dstReceiver`, 4e champ de la structure de description'],
      ],
    },
    { type: 'heading', text: 'Lire les jambes d\'un swap agrégé' },
    {
      type: 'text',
      md: `Dans l'inspecteur de Spectra, la transaction du cas d'ouverture appelle \`unoswap\` sur le routeur 1inch : arguments \`srcToken\` (contrat USDT), \`amount\` (120 000 USDT), \`minReturn\` (minimum de WBTC accepté) et \`pools\` (la liste des deux pools traversés). Le panneau **Journaux d'événements** déroule ensuite, dans l'ordre :`,
    },
    {
      type: 'table',
      caption: `Les jambes du swap USDT → WETH → WBTC (prix hypothétiques : ETH à 2 680 $, BTC à 87 000 $, commission de 0,3 % par pool).`,
      headers: ['#', 'De', 'Vers', 'Montant', 'Nature'],
      rows: [
        ['1', 'Suspect `0x8c4f…27e1`', 'Routeur 1inch', '120 000 USDT', '**Entrée initiale** : ce que le suspect cède'],
        ['2', 'Routeur 1inch', 'Pool USDT/WETH', '120 000 USDT', 'En transit : mêmes fonds que la jambe 1'],
        ['3', 'Pool USDT/WETH', 'Routeur 1inch', '44,64 WETH', 'Intermédiaire, détenu transitoirement par le routeur'],
        ['4', 'Routeur 1inch', 'Pool WETH/WBTC', '44,64 WETH', 'En transit : mêmes fonds que la jambe 3'],
        ['5', 'Pool WETH/WBTC', '`0x2b9e…f40c`', '1,3710 WBTC', '**Sortie finale** : ce que reçoit le bénéficiaire'],
      ],
    },
    {
      type: 'text',
      md: `Le calcul se vérifie : 120 000 × 0,997 / 2 680 ≈ 44,64 WETH, puis 44,64 × 2 680 × 0,997 / 87 000 ≈ 1,3710 WBTC. À la fin de la transaction, le routeur détient exactement ce qu'il détenait au début : il **n'a rien gardé**. Les pools ont échangé un actif contre un autre à leur prix : ils ne sont **pas** des destinations.

**La règle** : dans un swap, seules comptent l'**entrée initiale** (ce que le signataire a cédé) et la ou les **sorties finales** vers une adresse qui n'est ni un routeur, ni un pool. Tout le reste est de l'acheminement.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Ordre découpé : additionner les sorties, pas les jambes',
      md: `Si l'agrégateur découpe l'ordre — par exemple 72 000 USDT via un pool Uniswap et 48 000 USDT via un pool d'un autre DEX —, vous verrez deux branches parallèles qui se rejoignent. La sortie finale est la **somme** des sorties versées au bénéficiaire. Additionner aussi les jambes d'acheminement de chaque branche reviendrait à compter deux ou trois fois les mêmes fonds.`,
    },
    {
      type: 'check',
      q: `Dans le tableau ci-dessus, quel montant le suspect a-t-il réellement converti, et en quoi ?`,
      options: [
        `240 000 USDT (jambes 1 et 2) en 89,28 WETH (jambes 3 et 4)`,
        `120 000 USDT en 1,3710 WBTC, versés à 0x2b9e…f40c`,
        `120 000 USDT en 44,64 WETH, conservés par le routeur`,
        `Rien : les fonds sont restés dans les pools`,
      ],
      answer: 1,
      explain: `Les jambes 2 et 4 acheminent les mêmes fonds que les jambes 1 et 3 ; le WETH n'est qu'un intermédiaire. L'entrée initiale est de 120 000 USDT, la sortie finale de 1,3710 WBTC au profit de 0x2b9e…f40c.`,
    },
    { type: 'heading', text: 'L\'événement Swap, pool par pool' },
    {
      type: 'text',
      md: `Chaque pool traversé émet un événement \`Swap\`. Pour une paire Uniswap V2 et ses nombreuses copies : \`Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)\`, topic0 \`0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822\`.

- \`sender\` : le contrat qui a appelé le pool (routeur ou agrégateur), pas l'utilisateur ;
- \`to\` : l'adresse qui reçoit la sortie de **ce** pool — le pool suivant, le routeur, ou le bénéficiaire final ;
- \`amount0…\` / \`amount1…\` : montants relatifs aux deux jetons du pool. Dans Uniswap V2, **token0 est le jeton dont l'adresse est la plus petite**. Pour la paire USDT/WETH d'Ethereum, WETH (\`0xC02a…\`) précède USDT (\`0xdAC1…\`) : WETH est token0. Le swap du cas se lit donc \`amount1In\` = 120 000 USDT (en unités de base) et \`amount0Out\` = 44,64 WETH.

Les pools Uniswap V3 émettent un événement différent, \`Swap(address,address,int256,int256,uint160,uint128,int24)\` (topic0 \`0xc42079f9…ca67\`), avec des montants **signés** : positif pour ce qui entre dans le pool, négatif pour ce qui en sort.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Simplification de Spectra',
      md: `Dans l'inspecteur de Spectra, l'événement Swap place toujours l'actif entrant dans \`amount0In\` et l'actif sortant dans \`amount1Out\`, quel que soit l'ordre des jetons du pool. Sur une chaîne réelle, vérifiez \`token0()\` et \`token1()\` du pool avant d'interpréter les montants, et confirmez toujours par les événements Transfer.`,
    },
    { type: 'heading', text: 'Le bénéficiaire final n\'est pas forcément le signataire' },
    {
      type: 'text',
      md: `Un routeur ou un agrégateur verse le produit du swap à l'adresse que l'appel lui désigne. Rien n'oblige cette adresse à être celle du signataire. Les blanchisseurs l'utilisent pour **couper le lien visuel** : l'adresse qui cède les fonds et celle qui reçoit le produit ne se sont jamais envoyé directement la moindre transaction.

Méthode :

1. lisez l'argument de destination dans le panneau **Appel de contrat** (\`to\`, \`recipient\`, \`dstReceiver\`, ou un champ de structure) ;
2. confirmez avec le **dernier Transfer** de la transaction, ou avec la **transaction interne** finale si la sortie est de l'ETH ;
3. poursuivez la trace sur ce bénéficiaire, dans l'actif de sortie.

Le dernier transfert fait foi en toute circonstance : même si la fonction ne comporte aucun argument de destination, c'est lui qui montre où la valeur a abouti.`,
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'MEV en une phrase',
      md: `Des robots de MEV peuvent encadrer un swap par un achat juste avant et une vente juste après (attaque « sandwich ») pour capter le glissement de prix de la victime : leurs adresses apparaissent dans le même bloc et dans les mêmes pools que le suspect sans être ses complices, et le montant obtenu par le suspect en est simplement diminué.`,
    },
    { type: 'heading', text: 'Comment le traceur de Spectra convertit' },
    {
      type: 'steps',
      items: [
        { title: 'Reconnaître le swap', md: `Des fonds entrent dans un routeur, un agrégateur ou un pool et en ressortent dans la **même transaction**. Ces contrats sont classés comme points de passage : ils ne sont jamais retenus comme destination ni comme service à requérir.` },
        { title: 'Mesurer la part marquée de l\'entrée', md: `Selon la méthode choisie (prorata, FIFO, LIFO, poison), le traceur détermine quelle part de l'actif cédé est d'origine illicite.` },
        { title: 'Convertir à valeur égale', md: `Cette part est reportée, à **valeur égale**, sur l'actif de sortie versé au bénéficiaire : 120 000 USDT entièrement marqués deviennent 1,3710 WBTC marqués ; 60 % de part marquée en entrée donnent 60 % de la sortie.` },
        { title: 'Comptabiliser les pertes', md: `La commission des pools et le glissement de prix réduisent la valeur obtenue : l'écart est imputé au swap, pas à une sortie de fonds vers un tiers.` },
        { title: 'Poursuivre', md: `La trace continue sur le bénéficiaire final, dans l'actif de sortie, avec le compteur de sauts incrémenté.` },
      ],
    },
    { type: 'widget', id: 'amm-swap', caption: `Un swap sur un pool : prix, glissement et jambes de la transaction. Un agrégateur enchaîne plusieurs de ces opérations dans le même appel.` },
    { type: 'heading', text: 'Les pièges' },
    {
      type: 'table',
      headers: ['Piège', 'Conséquence', 'Bonne lecture'],
      rows: [
        ['Prendre un pool pour une destination', 'Piste close à tort sur un « contrat DeFi »', 'Le pool a échangé ; suivre sa sortie jusqu\'au bénéficiaire'],
        ['Attribuer les jetons au routeur ou à l\'agrégateur', 'Réquisition inutile à un éditeur qui ne détient rien', 'Le routeur ne garde rien : chercher le dernier Transfer'],
        ['Additionner toutes les jambes', 'Montant multiplié par le nombre de sauts', 'Entrée initiale et sortie(s) finale(s) uniquement'],
        ['Supposer que le signataire reçoit le produit', 'Piste perdue sur une adresse tierce', 'Lire to / recipient, confirmer par le dernier transfert'],
        ['Oublier la transaction interne finale', 'Sortie en ETH introuvable', 'Ouvrir le panneau « Transactions internes »'],
        ['Lire amount0 / amount1 sans connaître token0', 'Actifs inversés dans le procès-verbal', 'Vérifier l\'ordre des jetons du pool ; confirmer par les Transfer'],
        ['Soupçonner les robots MEV du même bloc', 'Faux complices', 'Les traiter comme des contreparties de marché, sauf indice contraire'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — la conversion en WBTC',
      md: `Transaction du 18 mai, 03:12 UTC, signée par \`0x8c4f…27e1\` (nonce 41), adressée au routeur d'agrégation 1inch.

- **Appel de contrat** : \`unoswap\`, \`srcToken\` = contrat USDT, \`amount\` = 120 000 000 000 (120 000 USDT, 6 décimales), \`pools\` = [pool USDT/WETH, pool WETH/WBTC].
- **Journaux d'événements** : 5 Transfer (tableau ci-dessus) et 2 Swap ; le second Swap a pour \`to\` l'adresse \`0x2b9e…f40c\`.
- **Transactions internes** : aucune (la sortie est un jeton, pas de l'ETH).

Analyse : entrée de 120 000 USDT, sortie de 1,3710 WBTC vers \`0x2b9e…f40c\`, qui n'a jamais reçu de transaction directe du suspect. Cette adresse dépose 1,37 WBTC trois heures plus tard sur un contrat de dépôt d'exchange, ce qui ouvre une réquisition. Le routeur 1inch et les deux pools sont mentionnés dans le rapport comme **infrastructure de conversion**, sans réquisition.

Erreur évitée : le premier analyste avait noté « fonds partis vers 1inch » ; la lecture des jambes montre que rien n'est resté chez 1inch et que la piste continue sur \`0x2b9e…f40c\`.`,
    },
    {
      type: 'check',
      q: `Le second événement Swap du cas désigne 0x2b9e…f40c comme to, et le dernier Transfer verse 1,3710 WBTC à cette même adresse. Que faites-vous ?`,
      options: [
        `Requérir 1inch, qui a exécuté le swap`,
        `Requérir l'exploitant du pool WETH/WBTC`,
        `Poursuivre la trace sur 0x2b9e…f40c, en WBTC`,
        `Clore la piste : les fonds ont été convertis`,
      ],
      answer: 2,
      explain: `Le bénéficiaire final est confirmé par deux sources concordantes (Swap et Transfer). Routeur et pool sont des contrats autonomes qui ne détiennent rien : la trace se poursuit sur le bénéficiaire, dans l'actif de sortie.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Routeurs, agrégateurs et réquisitions',
      md: `Les contrats de routeurs, de pools et d'agrégateurs sont des programmes autonomes : aucun opérateur n'y détient les fonds des utilisateurs, et ils ne peuvent pas être « gelés » par une réquisition. Les sociétés qui éditent les interfaces web de ces services peuvent conserver des journaux techniques limités ; une demande est envisageable, le cas échéant par la voie de l'entraide, mais elle ne remplace jamais le suivi on-chain jusqu'au bénéficiaire et au prochain service identifiant. Dans le rapport, décrivez le swap comme une **conversion** (actif, montant, taux implicite, bénéficiaire), pas comme un transfert vers un tiers.`,
    },
  ],
  keyPoints: [
    `Le pool échange, le routeur achemine, l'agrégateur compose une route sur plusieurs DEX ; aucun ne garde les fonds de l'utilisateur.`,
    `Dans un swap, seules comptent l'entrée initiale et la ou les sorties finales ; les jambes vers et depuis routeurs et pools sont de l'acheminement à ne pas additionner.`,
    `Chaque pool émet un Swap : sender = contrat appelant, to = destinataire de la sortie de ce pool ; dans Uniswap V2, token0 est le jeton d'adresse la plus petite.`,
    `Le bénéficiaire final peut différer du signataire : lire to / recipient / dstReceiver et confirmer par le dernier Transfer ou la transaction interne finale.`,
    `Le traceur reporte la part marquée de l'entrée, à valeur égale, sur l'actif de sortie et poursuit sur le bénéficiaire.`,
    `Routeurs et pools sont de l'infrastructure : ni destination, ni service à requérir ; les robots MEV du même bloc ne sont pas des complices.`,
  ],
  quiz: [
    {
      q: `Dans un swap Uniswap V2 multi-sauts USDT → WETH → WBTC passant par le routeur, où va le WETH sorti de la première paire ?`,
      options: [
        `Au signataire, qui le renvoie ensuite`,
        `Directement à la seconde paire, sur instruction du routeur`,
        `À l'adresse nulle`,
        `Au hot wallet d'Uniswap`,
      ],
      answer: 1,
      explain: `Le routeur Uniswap V2 fait verser la sortie de chaque paire directement à la paire suivante, et celle de la dernière paire au bénéficiaire to. Les agrégateurs, eux, font parfois transiter les intermédiaires par leur propre contrat.`,
    },
    {
      kind: 'truefalse',
      q: `À la fin d'un swap agrégé réussi, le contrat de l'agrégateur détient les jetons intermédiaires qui ont transité par lui.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Les intermédiaires ne font que transiter : le contrat termine la transaction sans rien conserver (hors éventuelle commission explicite). Lui attribuer les jetons est une erreur classique.`,
    },
    {
      q: `Une transaction de swap comporte 5 transferts de jetons : 120 000 USDT, 120 000 USDT, 44,64 WETH, 44,64 WETH, 1,3710 WBTC. Quel est le montant cédé par le signataire ?`,
      options: [`240 000 USDT`, `120 000 USDT`, `120 000 USDT et 44,64 WETH`, `1,3710 WBTC`],
      answer: 1,
      explain: `La deuxième jambe USDT et les deux jambes WETH sont de l'acheminement. Le signataire a cédé 120 000 USDT et le bénéficiaire a reçu 1,3710 WBTC.`,
    },
    {
      kind: 'multi',
      q: `Où pouvez-vous lire ou confirmer le bénéficiaire final d'un swap ? (plusieurs réponses)`,
      options: [
        `Dans l'argument to, recipient ou dstReceiver de l'appel`,
        `Dans le dernier événement Transfer de la transaction`,
        `Dans la transaction interne finale si la sortie est de l'ETH`,
        `Dans le champ sender de l'événement Swap`,
      ],
      answer: [0, 1, 2],
      explain: `Le sender d'un Swap est le contrat qui a appelé le pool (routeur ou agrégateur), pas le bénéficiaire. L'argument de destination et le dernier transfert, interne ou de jeton, désignent le bénéficiaire.`,
    },
    {
      q: `Dans la paire Uniswap V2 USDT/WETH d'Ethereum, quel jeton est token0 ?`,
      options: [
        `USDT, car il est cité en premier dans le nom de la paire`,
        `WETH, car son adresse (0xC02a…) est inférieure à celle de l'USDT (0xdAC1…)`,
        `Celui qui a la plus forte capitalisation`,
        `Celui qui a été déposé en premier dans le pool`,
      ],
      answer: 1,
      explain: `Uniswap V2 trie les deux jetons par adresse : token0 est celui dont l'adresse est la plus petite. Le nom d'affichage de la paire n'en dit rien.`,
    },
    {
      kind: 'truefalse',
      q: `Une adresse de robot MEV qui achète juste avant et revend juste après le swap du suspect, dans le même pool, doit être considérée comme complice.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `L'attaque sandwich exploite le glissement de prix de n'importe quel swap visible. Le robot est une contrepartie de marché opportuniste ; sauf indice contraire, il n'a aucun lien avec le suspect.`,
    },
    {
      q: `Le suspect swappe 50 000 USDC dont 40 % sont marqués, et reçoit 18,5 ETH. Avec une conversion à valeur égale, quelle part de la sortie le traceur marque-t-il ?`,
      options: [`18,5 ETH`, `7,4 ETH`, `11,1 ETH`, `Aucune : le swap rompt le traçage`],
      answer: 1,
      explain: `La part marquée de l'entrée est reportée sur la sortie : 40 % de 18,5 ETH = 7,4 ETH. Le swap ne rompt pas le traçage, il change l'actif.`,
    },
    {
      q: `Pourquoi l'analyste qui a noté « 120 000 USDT envoyés au routeur 1inch, fonds partis vers un service DeFi » a-t-il commis une erreur ?`,
      options: [
        `Parce que 1inch n'existe pas sur Ethereum`,
        `Parce que le routeur n'est qu'un point de passage : le produit du swap a été versé à une adresse tierce sur laquelle la trace continue`,
        `Parce que les USDT ne peuvent pas être échangés`,
        `Parce qu'il aurait dû requérir les pools`,
      ],
      answer: 1,
      explain: `Un routeur d'agrégation n'est ni une destination ni un dépositaire. Il faut suivre les jambes jusqu'à la sortie finale et poursuivre sur le bénéficiaire.`,
    },
    {
      kind: 'multi',
      q: `Quelles erreurs faussent le montant ou l'attribution lors de la lecture d'un swap ? (plusieurs réponses)`,
      options: [
        `Additionner les jambes routeur → pool et utilisateur → routeur`,
        `Attribuer les jetons intermédiaires au routeur`,
        `Prendre un pool pour la destination des fonds`,
        `Confirmer le bénéficiaire par le dernier Transfer`,
      ],
      answer: [0, 1, 2],
      explain: `Les trois premières erreurs comptent deux fois, attribuent à tort ou closent la piste. Confirmer par le dernier transfert est au contraire la bonne pratique.`,
    },
  ],
  flashcards: [
    { front: 'Pool de liquidité', back: `Contrat qui échange réellement, émet Swap et verse la sortie. Jamais une destination.` },
    { front: 'Routeur de DEX', back: `Contrat d'entrée d'un DEX : calcule le chemin, achemine vers les paires, vérifie le minimum. Ne garde rien.` },
    { front: 'Agrégateur', back: `Compose une route sur plusieurs DEX (multi-sauts, découpage) via son contrat : 1inch, 0x, ParaSwap…` },
    { front: 'Règle de lecture d\'un swap', back: `Entrée initiale + sortie(s) finale(s). Les jambes vers et depuis routeurs et pools sont de l'acheminement.` },
    { front: 'Swap (Uniswap V2) — topic0', back: `0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822` },
    { front: 'sender / to d\'un Swap', back: `sender = contrat appelant (routeur) ; to = destinataire de la sortie de ce pool.` },
    { front: 'token0 (Uniswap V2)', back: `Le jeton d'adresse la plus petite. USDT/WETH : WETH est token0.` },
    { front: 'Bénéficiaire final', back: `Argument to / recipient / dstReceiver, confirmé par le dernier Transfer ou la transaction interne finale.` },
    { front: 'Conversion à valeur égale', back: `La part marquée de l'entrée est reportée sur l'actif de sortie ; la trace continue sur le bénéficiaire.` },
    { front: 'Attaque sandwich', back: `Achat avant / vente après le swap d'autrui pour capter son glissement : le robot n'est pas complice.` },
    { front: 'swapExactTokensForTokens', back: `0x38ed1739 — routeur Uniswap V2 ; bénéficiaire dans to.` },
  ],
}
