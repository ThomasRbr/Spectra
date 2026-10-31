// Niveau 4 — Smart contracts & DeFi : pools de liquidité, cession de parts LP
// et retrait vers une autre adresse. Acteurs réels (Uniswap, Curve, Circle)
// décrits factuellement ; victimes, suspects et montants sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_POOLS_LIQUIDITE: Lesson = {
  id: 'pools-liquidite',
  title: 'Pools de liquidité : déposer, céder ses parts, retirer ailleurs',
  level: 4,
  track: 'contrats',
  minutes: 45,
  summary: `Apporter deux actifs à un pool d'AMM, recevoir des parts LP, les transférer à une adresse « propre » qui retire la liquidité : aucun ETH ni stablecoin ne circule entre l'adresse d'origine et celle qui encaisse. Ajout de liquidité à valeur égale, parts transférables et paramètre de destinataire, perte impermanente et dérive de prix (les montants retirés ne sont ni ceux du dépôt, ni dans les mêmes proportions), lecture des événements Mint, Burn et Transfer, traçage à valeur égale et ses limites, variantes (Curve, positions Uniswap v3) et rug pull par retrait de liquidité.`,
  objectives: [
    `Décrire ce que contient un pool AMM et ce que représente une part LP (ERC-20 sur Uniswap v2, NFT de position sur Uniswap v3).`,
    `Lire un ajout et un retrait de liquidité : appel du routeur, transferts vers et depuis le pool, Transfer depuis et vers l'adresse nulle, événements Mint, Burn et Sync.`,
    `Repérer la cession de parts LP à une autre adresse et le retrait vers un destinataire différent du signataire.`,
    `Expliquer pourquoi les montants retirés diffèrent des montants déposés (perte impermanente, frais, dérive) et chiffrer correctement la valeur tracée.`,
    `Appliquer un traçage à valeur égale à travers un pool et en énoncer les limites dans un rapport.`,
  ],
  prerequisites: ['jetons-enveloppes', 'agregateurs-routeurs'],
  practice: ['lp-blanchiment'],
  blocks: [
    {
      type: 'text',
      md: `Un particulier lyonnais (fictif) est victime d'un détournement de sa carte SIM : **50 ETH** quittent son portefeuille pour \`0x58ad…c41e\` (adresse A). L'analyste suit A et découvre qu'elle a reçu, le même jour, **150 000 USDC** retirés d'un exchange. Puis :

- A apporte 50 ETH et 150 000 USDC au pool **USDC/WETH** d'un DEX de type Uniswap v2 et reçoit des **parts LP** ;
- deux jours plus tard, A transfère toutes ses parts à \`0x1f6b…9a02\` (adresse B), une adresse neuve dont le gaz a été payé par un échangeur instantané ;
- dix jours plus tard, B **retire la liquidité** et reçoit **47,13 ETH et 160 237 USDC**.

Sur un explorateur, B n'a jamais reçu un seul ETH ni un seul USDC de A : seulement un jeton « UNI-V2 » sans prix affiché. Et les montants retirés ne ressemblent pas aux montants déposés. Comment démontrer que B a encaissé les fonds de la victime, et pour quel montant ?`,
    },
    { type: 'heading', text: 'Ce que contient un pool, ce que vaut une part' },
    {
      type: 'terms',
      items: [
        { term: 'Pool (paire)', def: `Contrat qui détient deux réserves (par exemple USDC et WETH) et les échange selon une formule. Sur Uniswap v2, c'est aussi le contrat du jeton LP.` },
        { term: 'Produit constant', def: `Règle x × y = k des AMM de type Uniswap v2 : le prix d'un actif est le rapport des réserves ; chaque swap déplace ce rapport.` },
        { term: 'Part LP', def: `Jeton remis au fournisseur de liquidité, proportionnel à sa contribution. Il donne droit à la même proportion des deux réserves au moment du retrait.` },
        { term: 'Frais de swap', def: `Prélevés sur chaque échange et laissés dans les réserves (0,3 % sur Uniswap v2) : ils augmentent la valeur de chaque part.` },
        { term: 'Mint / Burn / Sync', def: `Événements du pool à l'ajout (Mint), au retrait (Burn) et à chaque mise à jour des réserves (Sync).` },
        { term: 'token0 / token1', def: `Ordre des deux actifs dans le pool, fixé par l'adresse de leur contrat (la plus petite est token0). Les champs amount0 et amount1 des événements suivent cet ordre.` },
        { term: 'Position concentrée (Uniswap v3)', def: `Liquidité apportée sur une fourchette de prix ; la position est un NFT (ERC-721), pas un jeton fongible.` },
        { term: 'Perte impermanente', def: `Écart entre la valeur d'une position LP et celle des mêmes actifs simplement conservés, dû à l'évolution du prix relatif.` },
      ],
    },
    {
      type: 'widget',
      id: 'amm-swap',
      caption: `Chaque swap modifie les réserves du pool, donc la composition de chaque part LP : c'est pourquoi un retrait ne rend jamais exactement les montants déposés.`,
    },
    { type: 'heading', text: 'Ajouter de la liquidité' },
    {
      type: 'text',
      md: `Un ajout de liquidité exige **les deux actifs, à valeur égale** au prix du pool : 50 ETH à 3 000 $ appellent 150 000 USDC. C'est pourquoi un blanchisseur qui ne détient qu'un actif volé doit soit en échanger la moitié, soit apporter des fonds d'une autre origine, comme dans le cas d'ouverture. Le nombre de parts créées est proportionnel à la contribution : sur Uniswap v2, l'apport rapporté aux réserves existantes, appliqué au nombre de parts en circulation.

L'utilisateur appelle généralement le **routeur** : \`addLiquidity(tokenA, tokenB, montants souhaités, montants minimaux, to, deadline)\`, ou \`addLiquidityETH\` s'il apporte de l'ETH natif, que le routeur **enveloppe** en WETH (événement \`Deposit\` du contrat WETH) avant de le verser au pool. Le paramètre \`to\` désigne **le bénéficiaire des parts** : elles peuvent être créées directement au profit d'une autre adresse que le signataire.`,
    },
    {
      type: 'table',
      caption: `Ajout de liquidité sur un pool de type Uniswap v2 : ce que montre la transaction`,
      headers: ['Élément', 'Émetteur', 'Contenu', 'Lecture'],
      rows: [
        ['Appel', 'Signataire → routeur', '`addLiquidity(USDC, WETH, …, to, deadline)`', 'Le champ `to` désigne le bénéficiaire des parts'],
        ['Transfer USDC', 'Contrat USDC', 'Signataire → pool : 150 000 USDC', 'Apport du premier actif'],
        ['Transfer WETH (ou Deposit puis Transfer)', 'Contrat WETH', 'Signataire (ou routeur) → pool : 50 WETH', 'Apport du second actif'],
        ['Transfer LP', 'Contrat du pool', '0x000…0 → `to` : parts créées', 'Création des parts (mint)'],
        ['Mint', 'Contrat du pool', 'sender = routeur, amount0, amount1', 'Montants apportés, dans l’ordre token0 / token1'],
        ['Sync', 'Contrat du pool', 'Nouvelles réserves', 'État du pool après l’ajout'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'amount0 n’est pas forcément le premier actif cité',
      md: `Dans le pool USDC/WETH d'Uniswap v2, **token0 est l'USDC** (adresse \`0xA0b8…\`, inférieure à celle du WETH \`0xC02a…\`). Dans un événement \`Mint\` ou \`Burn\`, amount0 est donc en USDC (6 décimales) et amount1 en WETH (18 décimales). Inverser les deux, c'est se tromper d'un facteur colossal sur les montants.`,
    },
    { type: 'heading', text: 'Les parts sont transférables : la cession à une adresse « propre »' },
    {
      type: 'text',
      md: `Une part LP est un actif comme un autre : elle se **transfère**, se dépose dans un contrat de rémunération (*farming*), se vend. Pour le blanchisseur, c'est une aubaine : l'adresse qui retire la liquidité n'a reçu de l'adresse d'origine qu'un jeton de pool, que beaucoup d'analyses superficielles ignorent, faute de prix affiché ou parce que seules les « valeurs » d'ETH et de stablecoins sont regardées.

Trois façons de faire encaisser la liquidité par une autre adresse :

- **cession des parts** : \`Transfer\` du jeton LP de A vers B, puis retrait par B ;
- **parts créées directement au profit d'un tiers** : \`addLiquidity(…, to = B, …)\` ;
- **retrait vers un tiers** : A retire lui-même mais avec \`removeLiquidity(…, to = C, …)\`, et les actifs sont versés à C.

Sur Uniswap v3, la position est un **NFT** : sa cession est un \`Transfer\` ERC-721 du numéro de position, et le destinataire des actifs retirés figure dans l'événement \`Collect\`.`,
    },
    {
      type: 'flow',
      caption: `Cas d'ouverture : B ne reçoit de A qu'un jeton de pool, puis encaisse les deux actifs. Les pointillés sont des créations et destructions de parts.`,
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: '50 ETH' },
        { id: 'cex', label: 'Exchange', kind: 'exchange', sub: 'retrait 150 000 USDC' },
        { id: 'a', label: 'Adresse A', kind: 'suspect', sub: '0x58ad…c41e' },
        { id: 'pool', label: 'Pool USDC/WETH', kind: 'dex', sub: 'type Uniswap v2' },
        { id: 'z', label: 'Adresse nulle', kind: 'unknown', sub: 'parts créées / détruites' },
        { id: 'b', label: 'Adresse B', kind: 'suspect', sub: '0x1f6b…9a02' },
      ],
      edges: [
        { from: 'v', to: 'a', label: '50 ETH (vol)' },
        { from: 'cex', to: 'a', label: '150 000 USDC' },
        { from: 'a', to: 'pool', label: '50 WETH + 150 000 USDC' },
        { from: 'z', to: 'a', label: 'parts LP créées (Mint)', dashed: true },
        { from: 'a', to: 'b', label: 'Transfer des parts LP' },
        { from: 'b', to: 'z', label: 'parts détruites (Burn)', dashed: true },
        { from: 'pool', to: 'b', label: '47,13 WETH + 160 237 USDC' },
      ],
    },
    {
      type: 'check',
      q: `Une adresse B n'a reçu de A qu'un transfert de jetons « UNI-V2 », puis a reçu 31 ETH et 98 000 USDC d'un pool. Où se trouve le lien avec A ?`,
      options: [
        `Il n'y en a pas : B a reçu ses fonds du pool, qui appartient à tous`,
        `Dans le transfert des parts LP : B a racheté auprès du pool la quote-part des réserves que représentaient les parts reçues de A`,
        `Dans le prix de l'ETH`,
        `Dans les frais de gaz payés par B`,
      ],
      answer: 1,
      explain: `La part LP est une créance sur les réserves. En la transférant, A a cédé à B le droit de retirer la liquidité ; le retrait (Burn) convertit les parts en actifs. Le lien est le Transfer du jeton LP.`,
    },
    { type: 'heading', text: 'Retirer : des montants qui ne sont plus ceux du dépôt' },
    {
      type: 'text',
      md: `Entre le dépôt et le retrait, les traders ont échangé dans le pool. Quand l'ETH monte, ils achètent de l'ETH au pool et y laissent des USDC : chaque part contient alors **moins d'ETH et plus d'USDC**. Le retrait rend donc :

- des **montants différents** de ceux du dépôt ;
- dans des **proportions différentes**, puisque la répartition reflète le nouveau prix ;
- pour une **valeur totale proche** de celle des actifs déposés, légèrement inférieure à ce qu'aurait donné leur simple conservation (**perte impermanente**), compensée en partie par les **frais** accumulés.

Pour un pool à produit constant, si le prix relatif est multiplié par r, la perte impermanente vaut 2√r / (1 + r) − 1, hors frais : environ **−0,6 %** pour r = 1,25, **−5,7 %** pour r = 2, **−20 %** pour r = 4. Elle est symétrique : une baisse de moitié (r = 0,5) produit la même perte qu'un doublement.`,
    },
    {
      type: 'table',
      caption: `Cas d'ouverture : l'ETH passe de 3 000 $ à 3 400 $ en douze jours (r ≈ 1,133). Montants pour une position de 50 ETH + 150 000 USDC.`,
      headers: ['Situation', 'ETH', 'USDC', 'Valeur au cours de 3 400 $'],
      rows: [
        ['Dépôt (cours 3 000 $)', '50', '150 000', '320 000 $ si conservés tels quels'],
        ['Retrait hors frais (produit constant)', '46,97', '159 687', '319 374 $ (perte impermanente −0,2 %)'],
        ['Retrait avec environ 1 100 $ de frais perçus', '47,13', '160 237', '320 476 $'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Dans le simulateur SPECTRA',
      md: `Dans les missions, la part LP a une **valeur figée** : le retrait restitue cette valeur à quelques dixièmes de pour cent près, mais la **répartition** entre les deux actifs est déplacée par une **dérive de prix** de quelques pour cent. Vous retrouverez donc des montants retirés différents des montants déposés, à valeur quasi égale : ne cherchez pas un retrait « 50 ETH + 150 000 USDC » ; cherchez la **destruction des parts** que vous suivez.`,
    },
    { type: 'heading', text: 'Lire Mint, Burn et Transfer' },
    {
      type: 'text',
      md: `Sur Uniswap v2, un retrait se déroule en deux temps dans la même transaction : le routeur fait transférer les parts du titulaire **vers le contrat du pool** (\`Transfer\` LP titulaire → pool), puis le pool les **détruit** (\`Transfer\` LP pool → 0x000…0), verse les deux actifs au destinataire et émet \`Burn\`. Le simulateur abrège ce trajet en une destruction directe depuis le titulaire. Lors du tout premier dépôt d'un pool, 1 000 unités de parts sont créées vers l'adresse nulle et y restent bloquées : ce n'est pas un acteur.`,
    },
    {
      type: 'table',
      caption: 'Les événements à relever pour suivre une position',
      headers: ['Événement', 'Émis par', 'Champs utiles', 'Ce qu’il établit'],
      rows: [
        ['`Transfer` (0x0 → X)', 'Pool (jeton LP)', 'Destinataire, nombre de parts', 'Création de parts au profit de X'],
        ['`Mint(sender, amount0, amount1)`', 'Pool', 'Montants apportés (ordre token0 / token1)', 'Composition et valeur de l’apport'],
        ['`Transfer` (X → Y)', 'Pool (jeton LP)', 'Cédant, cessionnaire, nombre de parts', 'Cession de la position : nouveau saut'],
        ['`Burn(sender, amount0, amount1, to)`', 'Pool', 'Montants retirés et **destinataire `to`**', 'Qui encaisse, et quoi'],
        ['`Sync(reserve0, reserve1)`', 'Pool', 'Réserves après l’opération', 'Prix du pool, donc valorisation'],
        ['`IncreaseLiquidity` / `DecreaseLiquidity` / `Collect`', 'Gestionnaire de positions Uniswap v3', 'Numéro de position, montants, destinataire (`Collect`)', 'Équivalents v3 ; la cession est un Transfer ERC-721'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Dans l’espace d’enquête SPECTRA',
      md: `Sur une transaction d'ajout ou de retrait, l'inspecteur décode l'appel du routeur (\`addLiquidity\`, \`addLiquidityETH\`, \`removeLiquidity\`, \`removeLiquidityETH\`) avec le paramètre \`to\`, et liste dans les **Journaux d'événements** le \`Mint\` ou le \`Burn\` du pool, dont le champ \`to\` désigne le destinataire. L'aide du contrat rappelle que le pool est aussi le contrat des parts LP. Pour suivre une cession, ouvrez l'historique de l'actif **LP** de l'adresse : le transfert de parts y figure comme n'importe quel transfert de jeton.`,
    },
    { type: 'heading', text: 'Tracer à valeur égale, et ses limites' },
    {
      type: 'text',
      md: `Le pool est un **contrat de conversion** : la valeur marquée qui y entre est convertie, à valeur égale, en parts LP au profit du bénéficiaire ; les parts suivent leurs transferts ; leur destruction est reconvertie, à valeur égale, dans les deux actifs retirés. C'est ce que fait l'outil **« Traçage des fonds »** de Spectra.

Dans le cas d'ouverture, l'apport mêle 150 000 $ marqués (les ETH de la victime) et 150 000 $ d'origine distincte (les USDC retirés de l'exchange) : la position est **marquée à 50 %**. Au prorata, le retrait de B emporte 50 % de chaque actif : **23,56 ETH et 80 118 USDC** marqués, soit environ 160 238 $ au cours du retrait, pour 150 000 $ marqués au dépôt. L'écart tient à la hausse de l'ETH et aux frais, pas à un apport de la victime.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Ce que l’on peut affirmer',
        md: `- A a apporté au pool les ETH de la victime (transaction, événement \`Mint\`).
- Les parts créées en contrepartie ont été cédées à B (Transfer LP).
- B a détruit ces parts et reçu les actifs correspondants (\`Burn\`, champ \`to\`).
- La valeur retirée correspond à la valeur apportée, aux variations de marché près.
- La position mêlait fonds de la victime et fonds d'une autre origine, dans une proportion mesurable.`,
      },
      right: {
        title: 'Ce que l’on ne peut pas affirmer',
        md: `- Que les ETH retirés par B sont « les mêmes » ETH que ceux de la victime : la réserve est commune.
- Que B a reçu « 50 ETH de la victime » : il a reçu 47,13 ETH et 160 237 USDC.
- Que la plus-value due au marché et aux frais est un préjudice de la victime.
- Que les autres fournisseurs de liquidité du pool ont un lien avec l'affaire.
- Sans autre élément, que A et B sont la même personne : la cession le suggère fortement, d'autres indices doivent le corroborer.`,
      },
    },
    {
      type: 'steps',
      items: [
        { title: 'Suivre la part, jamais la réserve', md: `La réserve mélange les fonds de tous les fournisseurs : on n'en « suit » rien. La trace passe par les parts LP, puis par leur destruction.` },
        { title: 'Fixer la date de valorisation', md: `Valeur à l'apport et valeur au retrait : indiquez les deux, le cours retenu et sa source (prix du pool via \`Sync\`, ou référence de marché).` },
        { title: 'Mesurer la part marquée de la position', md: `Si l'apport mêle fonds marqués et fonds d'autre origine, ou si l'adresse détient plusieurs positions, la méthode (prorata, FIFO, LIFO) s'applique aux parts.` },
        { title: 'Traiter les retraits partiels', md: `Plusieurs destructions successives, vers des destinataires différents : chacune emporte sa fraction des parts suivies, selon la méthode annoncée.` },
        { title: 'Séparer le gain de marché et les frais', md: `Présentez à part ce qui excède la valeur apportée : la qualification de ce surplus (produit indirect ou non) relève du magistrat.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Pools à plus de deux actifs et retrait sur un seul actif',
      md: `Sur certains pools de stablecoins, comme le **3pool de Curve** (DAI, USDC, USDT, part « 3Crv »), on peut apporter un seul actif et retirer dans **un autre** (\`remove_liquidity_one_coin\`). Apporter de l'USDT, gelable, et retirer du DAI, non gelable, revient à un échange, réalisé en deux transactions éventuellement éloignées dans le temps et signées par deux adresses différentes si les parts ont été cédées. Les événements \`AddLiquidity\` et \`RemoveLiquidityOne\` du pool permettent de le reconstituer.`,
    },
    { type: 'heading', text: 'Quand la liquidité est l’arme : le rug pull' },
    {
      type: 'text',
      md: `La même mécanique sert aussi à **voler** : le créateur d'un jeton fournit la liquidité initiale, détient les parts LP, laisse les investisseurs acheter, puis **retire toute la liquidité** (\`removeLiquidity\`), emportant l'actif de valeur apporté par les acheteurs. Ici, les victimes sont les acheteurs du jeton, et le retrait de liquidité est le **fait générateur** du préjudice. Indices : parts LP non verrouillées, détenues par le déployeur ou une adresse liée, retrait brutal juste après une vague d'achats. Les parts « verrouillées » dans un contrat de blocage, ou envoyées à une adresse de destruction, sont un gage relatif de sérieux. Typologie complète, lecture du contrat et chiffrage du préjudice : voir la leçon sur les rug pulls.`,
    },
    {
      type: 'case',
      title: 'Cas — conclure l’affaire lyonnaise',
      md: `**Constatations.** Le 2 mars 2026 à 16:12 UTC, A apporte 50 ETH (enveloppés en WETH par le routeur) et 150 000 USDC au pool USDC/WETH (\`addLiquidityETH\`, événements \`Deposit\` et \`Mint\`) et reçoit des parts LP représentant 0,9 % du pool. Le 4 mars à 08:40 UTC, A transfère la totalité de ses parts à B. Le 14 mars à 21:03 UTC, B appelle \`removeLiquidity\` avec \`to = B\` : \`Burn\` de 47,13 WETH et 160 237 USDC.

**Traçage (prorata, valeur égale).** Position marquée à 50 % ; B encaisse 23,56 ETH et 80 118 USDC marqués (environ 160 238 $ au cours du retrait, pour 150 000 $ marqués à l'apport).

**Suites.** 160 237 USDC sont encore sur B le 15 mars au matin : demande de gel à Circle, **inscription de B sur la liste noire** dans la journée. Le gaz de B a été payé par un échangeur instantané : réquisition avec le hash, le montant et l'horodatage. L'exchange d'où provenaient les 150 000 USDC de A identifie le titulaire du compte : une **mule** recrutée sur un réseau social, dont l'audition mène au donneur d'ordre. Les 47,13 ETH, envoyés par B vers un bridge, sont suivis sur l'autre chaîne.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : ce que le pool ne vous dira pas',
      md: `Un pool d'AMM n'a **ni opérateur, ni données d'identité, ni pouvoir de gel** : rien à requérir, rien à geler. Les leviers sont **aux extrémités** : l'origine des fonds apportés (ici, l'exchange de la mule), les actifs retirés s'ils sont gelables (USDC, USDT), le financement du gaz de l'adresse cessionnaire, et la destination finale. Relevez systématiquement le jeton LP dans l'historique des adresses suspectes : une cession de parts passée inaperçue, c'est une branche entière de l'affaire perdue.`,
    },
  ],
  keyPoints: [
    `Une part LP est une créance sur une quote-part des deux réserves d'un pool : ERC-20 sur Uniswap v2, NFT de position sur Uniswap v3.`,
    `L'ajout de liquidité exige deux actifs à valeur égale ; les parts peuvent être créées au profit d'un tiers (paramètre to).`,
    `Les parts sont transférables : la cession à une adresse « propre » puis le retrait fait encaisser les fonds par une adresse qui n'a reçu qu'un jeton de pool.`,
    `Les montants retirés diffèrent des montants déposés, et pas dans les mêmes proportions : perte impermanente, frais, dérive du prix.`,
    `Relever Mint, Burn (champ to), Transfer du jeton LP et Sync ; attention à l'ordre token0 / token1.`,
    `Tracer à valeur égale en suivant la part, jamais la réserve ; indiquer la date de valorisation et présenter à part le gain de marché.`,
    `Le pool n'a ni opérateur ni gel : les leviers sont l'origine des fonds apportés, les actifs gelables retirés, le gaz du cessionnaire et la destination finale.`,
  ],
  quiz: [
    {
      q: `Pour apporter 20 ETH à un pool ETH/USDC quand l'ETH vaut 3 000 $, que faut-il apporter en plus ?`,
      options: ['Rien, un seul actif suffit', '60 000 USDC', '30 000 USDC', '120 000 USDC'],
      answer: 1,
      explain: `Un pool à deux actifs de type Uniswap v2 exige un apport à valeur égale : 20 × 3 000 = 60 000 $, soit 60 000 USDC.`,
    },
    {
      kind: 'truefalse',
      q: `Une adresse qui retire de la liquidité doit nécessairement avoir apporté elle-même les actifs au pool.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Les parts LP sont transférables, et elles peuvent aussi être créées au profit d'un tiers (to) ; le retrait peut en outre être versé à un autre destinataire. Celui qui retire est le détenteur des parts au moment du retrait.`,
    },
    {
      q: `Dans un événement Burn d'un pool Uniswap v2, quel champ désigne l'adresse qui reçoit les actifs retirés ?`,
      options: ['sender', 'amount0', 'to', 'reserve1'],
      answer: 2,
      explain: `Burn(sender, amount0, amount1, to) : sender est en général le routeur ; to est le destinataire des deux actifs retirés.`,
    },
    {
      q: `Un fournisseur a déposé 10 ETH + 30 000 USDC à 3 000 $. Le prix de l'ETH double. Hors frais, que retire-t-il, en ordre de grandeur ?`,
      options: [
        `10 ETH + 30 000 USDC`,
        `Environ 7,07 ETH + 42 426 USDC`,
        `Environ 14,1 ETH + 21 213 USDC`,
        `20 ETH + 60 000 USDC`,
      ],
      answer: 1,
      explain: `Produit constant : k = 10 × 30 000 = 300 000 ; au prix de 6 000, x = √(300 000 / 6 000) ≈ 7,07 ETH et y = √(300 000 × 6 000) ≈ 42 426 USDC. Valeur ≈ 84 853 $, contre 90 000 $ en conservant : perte impermanente ≈ −5,7 %.`,
    },
    {
      kind: 'multi',
      q: `Pourquoi les montants retirés d'un pool diffèrent-ils des montants déposés ? (plusieurs réponses)`,
      options: [
        `Les swaps des traders modifient la composition des réserves quand le prix évolue`,
        `Les frais de swap s'accumulent dans les réserves`,
        `Le pool prélève une commission au profit de son opérateur sur chaque retrait`,
        `La perte impermanente réduit la valeur par rapport à la simple conservation`,
      ],
      answer: [0, 1, 3],
      explain: `Le pool n'a pas d'opérateur qui prélève sur les retraits. Les écarts viennent des arbitrages des traders (composition), des frais (valeur) et de la perte impermanente.`,
    },
    {
      q: `Une position LP a été constituée avec 100 000 $ de fonds marqués et 300 000 $ de fonds d'autre origine. Le retrait rend 2 % de valeur en plus. Au prorata, quelle valeur marquée l'outil reporte-t-il sur le retrait ?`,
      options: ['100 000 $', 'Environ 102 000 $ au cours du retrait', '408 000 $', '25 000 $'],
      answer: 1,
      explain: `La position est marquée à 25 %. Le retrait vaut 408 000 $ ; 25 % = 102 000 $. Le rapport doit indiquer les deux valeurs (100 000 $ à l'apport, 102 000 $ au retrait) et présenter à part l'écart dû au marché et aux frais.`,
    },
    {
      kind: 'truefalse',
      q: `Pour suivre des fonds apportés à un pool, il faut répartir la réserve du pool au prorata de tous les fournisseurs de liquidité.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `On suit la part LP et sa destruction, jamais la réserve, qui mélange les fonds de tous les fournisseurs sans lien avec l'affaire.`,
    },
    {
      q: `Dans le pool USDC/WETH d'Uniswap v2, un événement Mint indique amount0 = 150000000000 et amount1 = 50000000000000000000. Que représentent ces valeurs ?`,
      options: [
        `150 000 WETH et 50 USDC`,
        `150 000 USDC et 50 WETH`,
        `0,15 USDC et 50 WETH`,
        `150 000 000 000 USDC et 50 WETH`,
      ],
      answer: 1,
      explain: `token0 est l'USDC (adresse inférieure), à 6 décimales : 150 000 000 000 / 10^6 = 150 000. token1 est le WETH, à 18 décimales : 50.`,
    },
    {
      kind: 'multi',
      q: `Quels leviers sont réalistes quand des fonds marqués transitent par un pool de liquidité ? (plusieurs réponses)`,
      options: [
        `Requérir l'opérateur du pool pour connaître le fournisseur de liquidité`,
        `Demander le gel des USDC retirés encore détenus par le cessionnaire`,
        `Identifier qui a financé le gaz de l'adresse cessionnaire`,
        `Requérir l'exchange d'où provenaient les fonds apportés`,
      ],
      answer: [1, 2, 3],
      explain: `Un pool n'a ni opérateur ni données d'identité. Les leviers sont aux extrémités : actifs gelables retirés, financement du gaz, origine et destination des fonds.`,
    },
    {
      q: `Sur le 3pool de Curve, un suspect apporte 500 000 USDT et, un mois plus tard, une autre adresse à laquelle il a cédé ses parts retire 499 100 DAI. Comment qualifier l'opération dans l'analyse ?`,
      options: [
        `Deux opérations sans rapport`,
        `Une conversion USDT → DAI à valeur quasi égale, réalisée en deux temps à travers des parts LP cédées, qui fait sortir les fonds d'un actif gelable`,
        `Un prêt avec garantie`,
        `Une perte de 500 000 USDT`,
      ],
      answer: 1,
      explain: `Le retrait sur un seul actif (remove_liquidity_one_coin) permet d'entrer en USDT et de sortir en DAI. La cession des parts ajoute un saut : la trace passe par le Transfer du jeton 3Crv.`,
    },
  ],
  flashcards: [
    { front: 'Part LP', back: `Créance sur une quote-part des réserves d'un pool ; ERC-20 (Uniswap v2) ou NFT de position (Uniswap v3).` },
    { front: 'Ajout de liquidité', back: `Deux actifs à valeur égale au prix du pool ; parts créées depuis l'adresse nulle au profit de to.` },
    { front: 'Mint (pool v2)', back: `Mint(sender, amount0, amount1) : montants apportés, dans l'ordre token0 / token1.` },
    { front: 'Burn (pool v2)', back: `Burn(sender, amount0, amount1, to) : montants retirés et destinataire.` },
    { front: 'token0', back: `Actif dont l'adresse de contrat est la plus petite. Pool USDC/WETH : token0 = USDC.` },
    { front: 'Cession de parts LP', back: `Transfer du jeton LP : le cessionnaire pourra retirer la liquidité sans avoir rien apporté.` },
    { front: 'Perte impermanente', back: `2√r / (1 + r) − 1 pour un prix relatif multiplié par r : −0,6 % (r = 1,25), −5,7 % (r = 2), −20 % (r = 4).` },
    { front: 'Montants retirés', back: `Différents des montants déposés et dans d'autres proportions ; valeur proche, à date de valorisation précisée.` },
    { front: 'Règle de traçage d’un pool', back: `Suivre la part, jamais la réserve ; conversion à valeur égale à l'apport puis au retrait.` },
    { front: 'Uniswap v3', back: `Position NFT ; IncreaseLiquidity, DecreaseLiquidity, Collect (destinataire) ; cession = Transfer ERC-721.` },
    { front: 'Curve 3pool', back: `DAI / USDC / USDT ; retrait possible sur un seul actif : entrer en USDT, sortir en DAI.` },
    { front: 'Rug pull par retrait de liquidité', back: `Le détenteur des parts LP retire toute la liquidité après les achats des investisseurs.` },
  ],
}
