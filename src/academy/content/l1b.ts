import type { Lesson } from '../model'

// Niveau 1 — Initié (2/2) : stablecoins, Tron et l'USDT-TRC20, exchanges,
// méthode de suivi des flux.
// Les entités citées (Coinvault, Binova, Nordex, Kaizen, Huobex, HelioSwap,
// SatsDesk OTC, AuroraTrade…) sont FICTIVES.

export const LESSONS_L1B: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════
  // stablecoins
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'stablecoins',
    title: 'Les stablecoins et leurs émetteurs',
    level: 1,
    track: 'stablecoins',
    minutes: 20,
    summary:
      "Les stablecoins sont devenus l'actif dominant des escroqueries et du blanchiment. Comment ils maintiennent leur valeur, qui les émet et les détruit, pourquoi les principaux sont gelables, ce que change le règlement MiCA, et comment solliciter un gel utile.",
    objectives: [
      'Vous saurez distinguer les grandes familles de stablecoins et leurs risques.',
      'Vous saurez expliquer le cycle d\'émission et de destruction (mint/burn) par l\'émetteur.',
      'Vous saurez pourquoi l\'USDT et l\'USDC sont gelables et comment préparer une demande de gel.',
      'Vous saurez situer les stablecoins dans le cadre MiCA (jetons de monnaie électronique, jetons se référant à des actifs).',
    ],
    prerequisites: ['tokens-erc20', 'ecosysteme-acteurs'],
    practice: ['pig-butchering-tron', 'eth-first'],
    blocks: [
      {
        type: 'text',
        md: `Un **stablecoin** est un jeton conçu pour garder une valeur stable, le plus souvent **1 dollar américain**. Pour un escroc, c'est l'idéal : la rapidité et le caractère international des crypto-actifs, sans la volatilité du bitcoin. Pour une victime, c'est rassurant : « 10 000 USDT, c'est 10 000 dollars ».

Résultat : dans les escroqueries à l'investissement, les fraudes sentimentales ou le blanchiment professionnel, les stablecoins — et surtout l'**USDT** — sont aujourd'hui omniprésents. Ils ont une particularité décisive pour l'enquêteur : la plupart sont **centralisés** et donc **gelables**.`,
      },
      { type: 'heading', text: 'Trois façons de rester stable' },
      {
        type: 'table',
        headers: ['Famille', 'Principe', 'Exemples', 'Gelable ?', 'Risque principal'],
        rows: [
          ['Adossés à des réserves en monnaie fiat', 'Chaque jeton est censé être couvert par des réserves (liquidités, bons du Trésor) détenues par l\'émetteur', 'USDT, USDC, EURC', 'Oui, par l\'émetteur', 'Qualité et transparence des réserves'],
          ['Adossés à des crypto-actifs', 'Des crypto-actifs sont bloqués en garantie dans des contrats, au-delà de la valeur émise', 'DAI', 'Pas de fonction de gel par un émetteur', 'Chute brutale de la garantie'],
          ['Algorithmiques', 'Un mécanisme de marché censé maintenir la parité, sans réserves équivalentes', 'UST (effondré en 2022)', 'Variable', 'Spirale de perte de confiance'],
        ],
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : les jetons de casino',
        md: `Au casino, vous échangez 100 € contre 100 € de jetons à la caisse ; en fin de soirée, vous rendez les jetons et récupérez vos euros. Le jeton n'a de valeur que parce que la caisse s'engage à le reprendre. Un stablecoin adossé fonctionne de la même façon, l'émetteur jouant le rôle de la caisse : il **crée** des jetons quand on lui remet des dollars, et les **détruit** quand on les lui rend. Et comme la caisse, il peut refuser de reprendre des jetons suspects.`,
      },
      { type: 'heading', text: 'Le cycle de vie : émission, circulation, destruction' },
      {
        type: 'flow',
        nodes: [
          { id: 'c', label: 'Grand client', kind: 'exchange', sub: 'Exchange, courtier OTC' },
          { id: 'e', label: 'Émetteur', kind: 'service', sub: 'Reçoit des dollars' },
          { id: 't', label: 'Trésorerie de l\'émetteur', kind: 'contract', sub: 'Mint de 50 M USDT' },
          { id: 'x', label: 'Exchange', kind: 'hot', sub: 'Hot wallet' },
          { id: 'u', label: 'Utilisateurs', kind: 'wallet', sub: 'Circulation' },
          { id: 'b', label: 'Burn', kind: 'contract', sub: 'Rachat contre dollars' },
        ],
        edges: [
          { from: 'c', to: 'e', label: 'virement 50 M $' },
          { from: 'e', to: 't', label: 'mint' },
          { from: 't', to: 'x', label: '50 M USDT' },
          { from: 'x', to: 'u', label: 'retraits' },
          { from: 'u', to: 'b', label: 'rachat', dashed: true },
        ],
        caption: 'L\'émetteur ne connaît que ses clients directs (gros acteurs). Il ne connaît pas les détenteurs finaux, mais il contrôle le contrat.',
      },
      {
        type: 'text',
        md: `Sur la blockchain, l'émission apparaît comme un événement \`Transfer\` **depuis l'adresse nulle** (ou une opération d'émission) vers une adresse de trésorerie de l'émetteur, la destruction comme un transfert vers l'adresse nulle. Les particuliers n'ont, en pratique, jamais de relation directe avec l'émetteur : ils achètent leurs stablecoins sur un exchange.

Un même stablecoin existe souvent sur **plusieurs chaînes** (Ethereum, Tron, BNB Smart Chain, Solana…). Chaque version est un **contrat distinct**, avec ses décimales propres. « Des USDT » ne suffit jamais : il faut la chaîne et le contrat.`,
      },
      {
        type: 'table',
        headers: ['Stablecoin', 'Chaîne', 'Contrat officiel', 'Décimales'],
        rows: [
          ['USDT', 'Ethereum', '`0xdAC17F958D2ee523a2206206994597C13D831ec7`', '6'],
          ['USDT', 'Tron', '`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`', '6'],
          ['USDC', 'Ethereum', '`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`', '6'],
          ['USDT', 'BNB Smart Chain', 'À vérifier sur le site de l\'émetteur', '18'],
        ],
        caption: 'Vérifiez toujours les adresses sur les sites officiels des émetteurs : les contrats d\'imitation sont nombreux.',
      },
      {
        type: 'widget',
        id: 'unit-converter',
        caption: 'Convertissez les montants bruts des stablecoins en tenant compte de leurs décimales selon la chaîne.',
      },
      {
        type: 'check',
        q: 'Une victime a acheté ses USDT chez Coinvault. L\'émetteur de l\'USDT connaît-il son identité ?',
        options: [
          'Oui, l\'émetteur identifie tous les détenteurs',
          'Non : l\'émetteur ne connaît que ses clients directs ; c\'est Coinvault qui connaît la victime',
          'Oui, grâce à la travel rule',
          'Oui, s\'il a gelé l\'adresse',
        ],
        answer: 1,
        explain: 'Les détenteurs finaux achètent sur des exchanges. L\'émetteur contrôle le contrat (gel) mais n\'a pas de données d\'identification sur eux.',
      },
      { type: 'heading', text: 'La fonction de gel' },
      {
        type: 'text',
        md: `Les contrats de l'USDT et de l'USDC comportent une **liste noire** : l'émetteur peut y inscrire une adresse, qui ne peut alors plus **envoyer** ses jetons. L'effet est immédiat et s'applique **même à un portefeuille auto-hébergé**. L'émetteur de l'USDT peut ensuite, dans certaines conditions, détruire les jetons gelés et en réémettre l'équivalent vers une adresse désignée dans le cadre d'une procédure.

Sur la blockchain, un gel se voit : appel d'une fonction de mise en liste noire sur le contrat, événement correspondant, et transactions de l'adresse gelée qui échouent ensuite.`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Localiser un solde', md: 'Identifiez une adresse contrôlée par les auteurs qui détient **encore** des stablecoins (pas une adresse de dépôt d\'exchange).' },
          { title: 'Vérifier le jeton', md: 'Contrat officiel, chaîne, solde exact, horodatage UTC de la constatation (capture, export).' },
          { title: 'Établir le lien avec l\'infraction', md: 'Chemin des fonds depuis la transaction de la victime : txid de chaque saut.' },
          { title: 'Saisir l\'émetteur', md: 'Par le canal dédié aux forces de l\'ordre de l\'émetteur, avec le cadre procédural et l\'accord du magistrat selon les instructions en vigueur.' },
          { title: 'Surveiller', md: 'Tant que le gel n\'est pas effectif, les fonds peuvent bouger : surveillez l\'adresse et actualisez la demande si besoin.' },
          { title: 'Préparer la suite judiciaire', md: 'Le gel est conservatoire ; saisie et restitution supposent une décision et une procédure adaptées (niveau 3).' },
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Ne pas geler une adresse de dépôt d\'exchange',
        md: `Si les stablecoins ont déjà atteint une **adresse de dépôt** d'un exchange, ils vont être balayés vers le hot wallet, où ils se mêlent aux fonds d'autres clients. Un gel à ce niveau est inadapté : adressez-vous à l'**exchange**, qui peut geler le **compte client** et l'identifier.`,
      },
      {
        type: 'case',
        title: 'Cas : un gel en 36 heures',
        md: `**Lundi 09:10 UTC.** Plainte pour escroquerie au faux placement : 64 000 USDT envoyés sur Ethereum en trois versements.

**Lundi 11:30.** Trace : les fonds ont été regroupés sur \`0x9e4a…07fb\` avec ceux d'autres victimes ; l'adresse détient **187 450 USDT** (contrat officiel vérifié). Aucun mouvement sortant depuis 48 heures.

**Lundi 14:00.** Avec l'accord du magistrat, demande de gel transmise à l'émetteur par son canal dédié : adresse, contrat, solde, chemin des fonds (txid), cadre procédural.

**Mardi 21:40.** Une transaction de la mise en liste noire apparaît sur le contrat. Dix minutes plus tard, une tentative de transfert depuis \`0x9e4a…07fb\` **échoue** : les auteurs ont réagi trop tard.

**Suite.** Les 187 450 USDT sont immobilisés en attendant la décision judiciaire ; les autres victimes sont recherchées à partir des adresses émettrices.`,
      },
      {
        type: 'check',
        q: 'Les USDT de l\'affaire sont sur une adresse auto-hébergée des auteurs. Le gel par l\'émetteur est-il possible ?',
        options: [
          'Non, seul un exchange peut geler',
          'Oui : la liste noire du contrat s\'applique à n\'importe quelle adresse, même auto-hébergée',
          'Non, il faut d\'abord connaître l\'identité du détenteur',
          'Oui, mais seulement sur Bitcoin',
        ],
        answer: 1,
        explain: 'C\'est la force du gel des stablecoins centralisés : il agit au niveau du contrat du jeton, sans intermédiaire.',
      },
      { type: 'heading', text: 'Stablecoins et MiCA' },
      {
        type: 'callout',
        kind: 'law',
        title: 'Le cadre européen (à vérifier dans les textes en vigueur)',
        md: `Le règlement **MiCA** (règlement (UE) 2023/1114) distingue notamment :

- les **jetons de monnaie électronique** (*EMT*), qui se réfèrent à une seule monnaie officielle (un stablecoin en dollars ou en euros) : leur émetteur doit être un établissement de crédit ou un établissement de monnaie électronique agréé ;
- les **jetons se référant à un ou des actifs** (*ART*), adossés à un panier d'actifs.

Les règles relatives aux stablecoins s'appliquent depuis le 30 juin 2024. Certains stablecoins répandus n'ont pas été autorisés au titre de MiCA, ce qui a conduit des prestataires européens à en restreindre l'offre à leurs clients de l'Union ; ces jetons restent néanmoins massivement utilisés hors UE et en auto-hébergement. Vérifiez la situation à la date des faits.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Atouts pour l\'enquête',
          md: `- **Gel** possible, même en auto-hébergement
- Valeur stable : préjudice facile à chiffrer
- Émetteurs dotés de canaux dédiés aux forces de l'ordre
- Traçage par les événements Transfer, très lisibles`,
        },
        right: {
          title: 'Limites',
          md: `- Le gel n'agit que tant que les fonds sont **encore** en stablecoin sur l'adresse
- Conversion rapide possible (DEX, échangeur, bridge)
- Faux jetons homonymes à écarter
- Volumes énormes : risque de confondre flux légitimes et illicites`,
        },
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : stabilité relative',
        md: `« Stable » ne veut pas dire « garanti ». Un stablecoin peut **perdre sa parité** : l'UST s'est effondré en 2022, et même l'USDC est passé nettement sous 1 dollar pendant quelques jours en mars 2023, après la faillite d'une banque qui détenait une partie de ses réserves. Pour valoriser un préjudice, utilisez le cours réel à la date des faits, pas « 1 dollar » par principe.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Stablecoin', def: 'Jeton conçu pour garder une valeur stable, souvent 1 dollar.' },
          { term: 'Parité (peg)', def: 'Valeur de référence visée (1 USDT ≈ 1 $). Une perte de parité est un depeg.' },
          { term: 'Mint / burn (émetteur)', def: 'Création de jetons contre dépôt de fiat / destruction lors du rachat.' },
          { term: 'Liste noire (blacklist)', def: 'Liste d\'adresses dont le contrat bloque les transferts : mécanisme du gel.' },
          { term: 'EMT', def: 'Jeton de monnaie électronique (MiCA) : stablecoin référencé sur une seule monnaie officielle.' },
          { term: 'ART', def: 'Jeton se référant à un ou des actifs (MiCA) : stablecoin adossé à un panier.' },
        ],
      },
    ],
    keyPoints: [
      'Les stablecoins (surtout l\'USDT) dominent les escroqueries et le blanchiment.',
      'Adossés à des réserves, à des crypto-actifs, ou algorithmiques : risques et gelabilité différents.',
      'L\'émetteur crée (mint) et détruit (burn) les jetons ; il ne connaît pas les détenteurs finaux.',
      'USDT et USDC sont gelables par leur émetteur, même sur une adresse auto-hébergée.',
      'Demander le gel tôt, avec contrat, chaîne, solde, horodatage et chemin des fonds ; pas sur une adresse de dépôt d\'exchange.',
      'MiCA distingue EMT et ART ; vérifier le statut d\'un stablecoin à la date des faits.',
    ],
    quiz: [
      {
        q: 'Pourquoi demander rapidement le gel d\'USDT identifiés sur une adresse du suspect ?',
        options: [
          'Parce que l\'émetteur ne peut geler qu\'après un an',
          'Parce que le gel est efficace même sur un portefeuille auto-hébergé, mais seulement tant que les fonds sont encore en USDT sur cette adresse',
          'Parce que c\'est gratuit',
          'Ce n\'est pas utile',
        ],
        answer: 1,
        explain: 'Une fois convertis ou transférés ailleurs, les fonds échappent au gel : la rapidité est décisive.',
      },
      {
        q: 'Comment apparaît sur la blockchain la création de nouveaux USDT par l\'émetteur ?',
        options: [
          'Comme un transfert depuis l\'adresse nulle (ou une opération d\'émission) vers une adresse de trésorerie',
          'Comme un transfert depuis un exchange',
          'Elle n\'apparaît pas',
          'Comme un bloc spécial',
        ],
        answer: 0,
        explain: 'L\'émission (mint) se traduit par un événement Transfer depuis l\'adresse nulle ou une opération dédiée, au profit de la trésorerie de l\'émetteur.',
      },
      {
        kind: 'truefalse',
        q: 'Le DAI, stablecoin adossé à des crypto-actifs, peut être gelé par un émetteur sur simple demande comme l\'USDT.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Le DAI n\'a pas d\'émetteur centralisé doté d\'une liste noire. Le levier du gel concerne les stablecoins centralisés (USDT, USDC…).',
      },
      {
        kind: 'multi',
        q: 'Que doit contenir une demande de gel adressée à un émetteur de stablecoin ? (plusieurs réponses)',
        options: [
          'L\'adresse et la chaîne concernées',
          'Le contrat du jeton (officiel) et le solde constaté avec son horodatage',
          'Le chemin des fonds depuis la victime (txid)',
          'Le cadre procédural',
          'L\'identité civile du détenteur de l\'adresse, sans laquelle le gel est impossible',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Une demande précise et motivée est traitée plus vite et évite les erreurs (faux jeton, mauvaise chaîne). L\'identité du détenteur n\'est pas requise : le gel porte sur l\'adresse, et c\'est justement souvent ce qu\'on ignore encore.',
      },
      {
        q: 'Les USDT ont été déposés sur une adresse de dépôt d\'un exchange. Que faire ?',
        options: [
          'Demander le gel de l\'adresse à l\'émetteur',
          'S\'adresser à l\'exchange pour geler et identifier le compte client',
          'Attendre le balayage',
          'Rien',
        ],
        answer: 1,
        explain: 'L\'adresse de dépôt sera balayée vers le hot wallet ; l\'exchange peut geler le compte du client et fournir son identité.',
      },
      {
        q: 'Sous MiCA, comment qualifie-t-on un stablecoin référencé sur une seule monnaie officielle (par exemple l\'euro) ?',
        options: ['Un jeton utilitaire', 'Un jeton de monnaie électronique (EMT)', 'Un jeton se référant à des actifs (ART)', 'Un NFT'],
        answer: 1,
        explain: 'L\'EMT se réfère à une seule monnaie officielle ; l\'ART à un panier d\'actifs.',
      },
      {
        q: 'Une victime a envoyé 10 000 USDT le jour où le stablecoin cotait 0,97 $. Comment valoriser le préjudice ?',
        options: [
          '10 000 $, un stablecoin vaut toujours 1 $',
          'Sur la base du cours réel à la date des faits, en citant la source, puis conversion en euros au taux du jour',
          '10 000 €',
          'Impossible à valoriser',
        ],
        answer: 1,
        explain: 'La parité n\'est pas garantie ; on valorise au cours réel, daté et sourcé.',
      },
    ],
    flashcards: [
      { front: 'Stablecoin adossé à du fiat', back: 'Couvert par des réserves détenues par l\'émetteur (USDT, USDC, EURC). Gelable.' },
      { front: 'Stablecoin algorithmique', back: 'Parité maintenue par un mécanisme de marché, sans réserves équivalentes. Ex. : UST, effondré en 2022.' },
      { front: 'Mint par l\'émetteur', back: 'Transfer depuis l\'adresse nulle vers la trésorerie, contre dépôt de dollars.' },
      { front: 'Liste noire', back: 'Mécanisme de gel : l\'adresse inscrite ne peut plus envoyer ses jetons.' },
      { front: 'Le gel marche-t-il sur un portefeuille auto-hébergé ?', back: 'Oui, pour les stablecoins centralisés (au niveau du contrat).' },
      { front: 'Où ne pas demander de gel à l\'émetteur ?', back: 'Sur une adresse de dépôt d\'exchange : s\'adresser à l\'exchange.' },
      { front: 'EMT (MiCA)', back: 'Jeton de monnaie électronique : stablecoin sur une seule monnaie officielle.' },
      { front: 'ART (MiCA)', back: 'Jeton se référant à un ou des actifs (panier).' },
      { front: 'Application de MiCA aux stablecoins', back: 'Depuis le 30 juin 2024.' },
      { front: 'Depeg', back: 'Perte de parité. Valoriser au cours réel de la date des faits.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // tron-usdt
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'tron-usdt',
    title: 'Tron et l\'USDT-TRC20',
    level: 1,
    track: 'stablecoins',
    minutes: 25,
    summary:
      "Tron est la chaîne de prédilection des escroqueries et du blanchiment en stablecoins. Adresses, ressources (énergie, bande passante), activation des comptes, permissions détournées, schémas de traçage de l'USDT-TRC20 et leviers de gel.",
    objectives: [
      'Vous saurez reconnaître une adresse Tron et vérifier l\'authenticité de l\'USDT-TRC20.',
      'Vous saurez expliquer le système de ressources (énergie, bande passante) et en tirer des liens entre adresses.',
      'Vous saurez exploiter l\'activation des comptes et repérer les détournements de permissions.',
      'Vous saurez dérouler le traçage type d\'une escroquerie en USDT-TRC20 jusqu\'aux points de gel et de réquisition.',
    ],
    prerequisites: ['comptes-evm', 'tokens-erc20', 'stablecoins'],
    practice: ['pig-butchering-tron', 'address-poisoning'],
    blocks: [
      {
        type: 'text',
        md: `Une part considérable de l'USDT mondial circule sur **Tron** sous forme de jeton **TRC-20**. Les raisons : transferts rapides (blocs de 3 secondes), coûts faibles et prévisibles, large acceptation par les exchanges, les courtiers OTC et les réseaux de change informels.

C'est donc l'actif et la chaîne que l'on retrouve dans :

- les **escroqueries à l'investissement et sentimentales** (la victime achète de l'USDT puis l'envoie sur la « plateforme ») ;
- les **réseaux de blanchiment professionnels** et les conversions USDT ↔ espèces ;
- les **paiements entre criminels**, de préférence aux virements bancaires.`,
      },
      { type: 'heading', text: 'Repères techniques' },
      {
        type: 'table',
        headers: ['Élément', 'Valeur', 'Remarque'],
        rows: [
          ['Format d\'adresse', 'Base58, commence par **T**, 34 caractères', 'Forme hexadécimale interne préfixée par 41'],
          ['Actif natif', 'TRX ; 1 TRX = 1 000 000 sun', 'Sert aux frais et au staking'],
          ['Consensus', 'Preuve d\'enjeu déléguée, 27 « super représentants »', 'Un bloc toutes les 3 secondes'],
          ['Irréversibilité', 'Bloc « solidifié » après 19 blocs (≈ 1 min)', 'Seuil au-delà duquel le bloc ne peut plus être remplacé'],
          ['Machine virtuelle', 'Dérivée de l\'EVM', 'Contrats, événements Transfer et approvals comme sur Ethereum'],
          ['Contrat USDT officiel', '`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`', '6 décimales'],
          ['Explorateur', 'Tronscan', 'Onglet des transferts TRC-20'],
        ],
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Distinguez une adresse Tron (T…) d\'une adresse EVM (0x…) ou Bitcoin, et repérez les formats trompeurs.',
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'TRC-10 et TRC-20',
        md: `Tron connaît deux types de jetons : les **TRC-10**, gérés nativement par la chaîne (sans contrat), et les **TRC-20**, gérés par des contrats comme sur Ethereum. L'USDT est un **TRC-20**. Méfiance envers les jetons TRC-10 ou TRC-20 nommés « USDT » qui ne proviennent pas du contrat officiel : ils sont légion et servent au spam et à l'address poisoning.`,
      },
      { type: 'heading', text: 'Ressources : bande passante et énergie' },
      {
        type: 'text',
        md: `Sur Tron, les frais se paient en **ressources** plutôt qu'en gaz :

- **Bande passante** (*bandwidth*) : consommée selon la taille de la transaction. Chaque compte activé dispose d'une petite allocation gratuite quotidienne, suffisante pour quelques transferts de TRX.
- **Énergie** (*energy*) : consommée par l'exécution de contrats, donc par **chaque transfert d'USDT**. Un transfert d'USDT consomme de l'ordre de **65 000** unités d'énergie, environ le **double** si le destinataire ne détient pas encore d'USDT.

Pour obtenir de l'énergie, on peut **immobiliser (staker) des TRX**, se la faire **déléguer** par un autre compte (il existe des marchés de location d'énergie) ou, à défaut, **brûler des TRX** au moment de la transaction (quelques TRX à une dizaine de TRX par transfert d'USDT selon les paramètres du réseau, qui évoluent).`,
      },
      {
        type: 'compare',
        left: {
          title: 'Énergie déléguée par un service de location',
          md: `- Le délégant traite des milliers de comptes
- Lien faible avec l'auteur
- Le service peut toutefois détenir des données de paiement (adresse qui a payé la location)`,
        },
        right: {
          title: 'Énergie déléguée par une adresse du réseau',
          md: `- Le délégant n'alimente que quelques adresses
- **Lien fort** : même opérateur probable
- Permet de cartographier l'infrastructure (collecte, consolidation, fractionnement)`,
        },
      },
      {
        type: 'check',
        q: 'Une adresse Tron transfère des USDT alors qu\'elle ne détient aucun TRX. Comment paie-t-elle l\'énergie ?',
        options: [
          'C\'est impossible',
          'Par une délégation d\'énergie d\'un autre compte (location ou adresse liée)',
          'Avec des USDT, automatiquement',
          'Grâce au memo',
        ],
        answer: 1,
        explain: 'L\'énergie peut être déléguée par un autre compte ; la transaction de délégation désigne le délégant, qui devient un pivot.',
      },
      { type: 'heading', text: 'Activation des comptes' },
      {
        type: 'text',
        md: `Une adresse Tron doit être **activée** pour être pleinement utilisable, ce qui se fait généralement en lui envoyant une petite somme de TRX (une partie, de l'ordre de 1 TRX, est consommée par la création du compte). L'**adresse activatrice** est un pivot comparable au *first funder* sur Ethereum : souvent l'auteur lui-même, un exchange (retrait de TRX) ou un service.

Tronscan affiche l'adresse qui a activé un compte : relevez-la systématiquement pour chaque adresse de la trace.`,
      },
      { type: 'heading', text: 'Permissions détournées' },
      {
        type: 'text',
        md: `Tron offre un système de **permissions** : un compte peut confier ses droits (*owner*, *active*) à d'autres adresses, avec des seuils de signature. Deux modes opératoires en découlent :

- **Prise de contrôle** : après avoir obtenu la clé d'une victime, l'attaquant modifie les permissions pour s'attribuer le compte ; la victime conserve une clé devenue **inutile**, et les fonds reçus ensuite sur ce compte sont à la merci de l'attaquant.
- **Piège à seed** : l'escroc publie « par erreur » (dans un groupe, un commentaire) la seed d'un portefeuille contenant des USDT, dont les permissions ne permettent pas de les retirer ; le curieux y envoie des TRX pour payer les frais… qui sont aussitôt aspirés.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : « mon portefeuille ne me permet plus d\'envoyer »',
        md: `Sur une plainte de ce type, consultez l'**historique des modifications de permissions** du compte (opérations de mise à jour des permissions sur Tronscan). La date de modification situe la compromission ; l'adresse désignée comme nouveau détenteur des droits est celle de l'attaquant. Vérifiez aussi si la victime continue de recevoir des fonds sur ce compte (salaire, ventes) : ils sont immédiatement exposés.`,
      },
      { type: 'heading', text: 'Tracer l\'USDT-TRC20' },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'Achat chez Coinvault' },
          { id: 'c', label: 'Adresse de collecte', kind: 'suspect', sub: 'Fournie par AuroraTrade' },
          { id: 'k', label: 'Consolidation', kind: 'suspect', sub: 'Dizaines de victimes' },
          { id: 'i1', label: 'Intermédiaire A', kind: 'wallet', sub: 'Énergie déléguée par k' },
          { id: 'i2', label: 'Intermédiaire B', kind: 'wallet' },
          { id: 'kz', label: 'Kaizen Exchange', kind: 'deposit', sub: 'Adresse de dépôt' },
          { id: 'otc', label: 'SatsDesk OTC', kind: 'service' },
          { id: 'dex', label: 'HelioSwap', kind: 'dex', sub: 'USDT → TRX' },
        ],
        edges: [
          { from: 'v', to: 'c', label: '12 000 USDT' },
          { from: 'c', to: 'k', label: '11 998 USDT' },
          { from: 'k', to: 'i1', label: '40 000 USDT' },
          { from: 'k', to: 'i2', label: '35 000 USDT' },
          { from: 'i1', to: 'kz', label: '39 990 USDT' },
          { from: 'i2', to: 'otc', label: '20 000 USDT' },
          { from: 'i2', to: 'dex', label: '15 000 USDT', dashed: true },
        ],
        caption: 'Schéma fréquent d\'une escroquerie à l\'investissement : collecte, consolidation, fractionnement, sorties vers exchanges, OTC ou DEX.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Vérifier les versements de la victime', md: 'Onglet des transferts TRC-20 de l\'adresse de collecte : hash, montants, horodatage UTC, contrat officiel.' },
          { title: 'Explorer l\'adresse de collecte', md: 'Combien d\'expéditeurs ? Des dizaines évoquent d\'autres victimes : rapprochement de plaintes possible.' },
          { title: 'Suivre vers la consolidation', md: 'L\'adresse qui agrège les collectes détient souvent un solde important : **candidate au gel**.' },
          { title: 'Relever activations et délégations', md: 'Qui a activé chaque adresse ? Qui lui délègue de l\'énergie ? Les liens dessinent l\'infrastructure.' },
          { title: 'Identifier les sorties', md: 'Dépôts d\'exchanges (réquisition), courtiers OTC (entraide), DEX et bridges (poursuivre la trace on-chain).' },
        ],
      },
      {
        type: 'check',
        q: 'Une adresse de collecte a reçu des USDT de 47 adresses différentes en un mois. Quel est le principal intérêt immédiat ?',
        options: [
          'Aucun',
          'Rapprocher des plaintes et rechercher d\'autres victimes potentielles',
          'Demander le gel des 47 adresses expéditrices',
          'Conclure que c\'est un exchange',
        ],
        answer: 1,
        explain: 'Les expéditeurs sont souvent d\'autres victimes. Ils permettent de mesurer l\'ampleur du réseau et de joindre des procédures.',
      },
      {
        type: 'case',
        title: 'Cas : Opération Aurora',
        md: `Mme L. a versé **38 000 USDT** en cinq fois à \`TJx2…Q9wa\`, adresse affichée par la fausse plateforme **AuroraTrade**.

- \`TJx2…Q9wa\` a été **activée** par \`TNs8…4kPz\`, qui a aussi activé **onze** autres adresses de collecte, toutes alimentées en énergie par le même compte.
- Les collectes convergent vers \`TBw1…mD7c\` (consolidation), qui détient **312 000 USDT** au moment de l'analyse.
- La consolidation fractionne vers des intermédiaires (lots de 20 000 à 50 000 USDT), qui déposent chez **Kaizen Exchange** et envoient à **SatsDesk OTC**.

Actions : demande de gel de \`TBw1…mD7c\` à l'émetteur de l'USDT ; demande de gel et réquisition à Kaizen Exchange avec les hash de dépôt ; signalement des onze adresses de collecte pour rapprochement. Le compte activateur \`TNs8…4kPz\` a lui-même été activé par un **retrait d'un exchange** : nouvelle réquisition, qui pourrait désigner un opérateur du réseau.`,
      },
      { type: 'heading', text: 'Le levier du gel' },
      {
        type: 'text',
        md: `L'USDT étant **gelable par son émetteur**, Tron offre paradoxalement une opportunité : dès qu'un solde d'USDT est localisé sur une adresse contrôlée par les auteurs, une demande de gel peut l'immobiliser. L'émetteur de l'USDT, l'écosystème Tron et des sociétés d'analyse ont en outre annoncé en 2024 une unité commune de lutte contre la criminalité financière, destinée à accélérer ces gels.

Bonnes pratiques :

- **vitesse** : surveillez les adresses de consolidation et demandez le gel **avant** le fractionnement ;
- **précision** : adresse, contrat officiel, solde et horodatage de la constatation, cadre procédural ;
- **coordination** : si les fonds sont sur un dépôt d'exchange, adressez-vous à l'exchange ;
- **suite judiciaire** : le gel n'est qu'une mesure conservatoire (leçon « Gel et saisie », niveau 3).`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Faux USDT et address poisoning',
        md: `Les faux USDT pullulent sur Tron, tout comme les transferts « à 0 » et les adresses sosies qui imitent les premiers et derniers caractères d'un correspondant habituel de la victime. Vérifiez toujours le **contrat** du jeton et l'**adresse complète** (pas seulement le début et la fin). La mission « Address poisoning sur Tron » met ce piège en pratique.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'TRC-20', def: 'Standard de jeton par contrat sur Tron (équivalent d\'ERC-20).' },
          { term: 'TRC-10', def: 'Jeton natif de Tron, sans contrat.' },
          { term: 'Énergie', def: 'Ressource consommée par l\'exécution de contrats (ex. transfert d\'USDT).' },
          { term: 'Bande passante', def: 'Ressource consommée selon la taille de la transaction ; petite allocation gratuite quotidienne.' },
          { term: 'Délégation d\'énergie', def: 'Mise à disposition d\'énergie par un compte au profit d\'un autre ; visible on-chain.' },
          { term: 'Activation', def: 'Création effective d\'un compte Tron par un premier envoi ; l\'activateur est un pivot.' },
          { term: 'Permissions owner / active', def: 'Droits de contrôle d\'un compte Tron, attribuables à d\'autres adresses avec seuils.' },
        ],
      },
    ],
    keyPoints: [
      'L\'USDT-TRC20 domine les escroqueries et le blanchiment en stablecoins.',
      'Adresses Tron : base58, commencent par T, 34 caractères ; contrat USDT officiel TR7NHq…Lj6t (6 décimales).',
      'Un transfert d\'USDT consomme de l\'énergie : staking, délégation ou TRX brûlés.',
      'Activations et délégations d\'énergie révèlent des liens entre adresses.',
      'Les permissions de compte sont détournées (prise de contrôle, piège à seed).',
      'Schéma type : collecte → consolidation → fractionnement → exchanges, OTC, DEX.',
      'L\'USDT est gelable : agir vite sur les adresses de consolidation.',
    ],
    quiz: [
      {
        q: 'Quel est l\'intérêt de l\'adresse qui a activé un compte Tron ?',
        options: [
          'Aucun',
          'Elle est souvent liée au contrôleur du compte (lui-même, un exchange, un service) : c\'est un pivot',
          'Elle détient la clé privée du compte',
          'Elle est toujours un exchange',
        ],
        answer: 1,
        explain: 'Comme le first funder sur Ethereum, l\'activateur relie souvent l\'adresse à son opérateur ou à un service identifiable.',
      },
      {
        q: 'Une victime dit avoir trouvé la seed d\'un portefeuille contenant 40 000 USDT, y avoir envoyé 100 TRX « pour les frais », et tout perdu. De quel schéma s\'agit-il ?',
        options: [
          'Un bug de Tron',
          'Un piège à seed : permissions modifiées empêchant le retrait des USDT, TRX aspirés par l\'escroc',
          'Un CoinJoin',
          'Un gel par l\'émetteur',
        ],
        answer: 1,
        explain: 'Le portefeuille est verrouillé par des permissions : seuls les TRX envoyés par la victime sont récupérables… par l\'escroc.',
      },
      {
        q: 'Les USDT de l\'affaire sont sur une adresse de dépôt d\'un exchange. À qui s\'adresser en priorité ?',
        options: [
          'À l\'émetteur de l\'USDT pour geler l\'adresse',
          'À l\'exchange, pour identifier et geler le compte client',
          'Aux super représentants de Tron',
          'À personne',
        ],
        answer: 1,
        explain: 'Une adresse de dépôt appartient à l\'exchange et est balayée ; c\'est le compte client qui doit être identifié et gelé.',
      },
      {
        kind: 'truefalse',
        q: 'Sur Tron, l\'USDT est un jeton TRC-10 géré nativement par la chaîne.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'L\'USDT est un TRC-20, géré par le contrat TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t.',
      },
      {
        kind: 'multi',
        q: 'Quels éléments peuvent relier entre elles des adresses Tron d\'un même réseau ? (plusieurs réponses)',
        options: [
          'Un même compte activateur',
          'Une même source de délégation d\'énergie (hors service de location)',
          'Des flux de consolidation vers une même adresse',
          'Le fait qu\'elles commencent toutes par T',
        ],
        answer: [0, 1, 2],
        explain: 'Activation, délégation et flux sont des liens on-chain. Le préfixe T est commun à toutes les adresses Tron.',
      },
      {
        q: 'Combien de temps faut-il environ pour qu\'un bloc Tron soit considéré comme irréversible (solidifié) ?',
        options: ['3 secondes', 'Environ 1 minute (19 blocs)', '10 minutes', '1 heure'],
        answer: 1,
        explain: '19 blocs de 3 secondes : un peu moins d\'une minute.',
      },
      {
        q: 'Un transfert d\'USDT sur Tron est envoyé à une adresse qui n\'a jamais détenu d\'USDT. Quelle conséquence sur les ressources ?',
        options: [
          'Aucune',
          'Il consomme environ deux fois plus d\'énergie qu\'un transfert vers une adresse détenant déjà de l\'USDT',
          'Il est gratuit',
          'Il échoue systématiquement',
        ],
        answer: 1,
        explain: 'Créer une nouvelle ligne dans le registre du contrat coûte plus cher : environ le double d\'énergie.',
      },
    ],
    flashcards: [
      { front: 'Format d\'adresse Tron', back: 'Base58, commence par T, 34 caractères (hex interne préfixé 41).' },
      { front: 'Contrat USDT sur Tron', back: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (6 décimales).' },
      { front: 'Rythme des blocs Tron', back: '3 secondes ; solidifié après 19 blocs.' },
      { front: 'Énergie', back: 'Ressource consommée par les contrats : ≈ 65 000 par transfert d\'USDT (≈ double vers une adresse sans USDT).' },
      { front: 'Trois façons d\'obtenir de l\'énergie', back: 'Staker des TRX, se la faire déléguer, brûler des TRX.' },
      { front: 'Activateur', back: 'Adresse qui a créé le compte par un premier envoi de TRX : pivot d\'enquête.' },
      { front: 'Piège à seed', back: 'Seed publiée d\'un portefeuille aux permissions verrouillées ; les TRX envoyés pour « payer les frais » sont aspirés.' },
      { front: 'Prise de contrôle par permissions', back: 'L\'attaquant s\'attribue les droits owner/active ; la clé de la victime devient inutile.' },
      { front: 'Schéma type d\'escroquerie USDT-TRC20', back: 'Collecte → consolidation → fractionnement → exchanges / OTC / DEX.' },
      { front: 'Cible de gel prioritaire', back: 'L\'adresse de consolidation, avant fractionnement.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // exchanges
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'exchanges',
    title: 'Exchanges : dépôts, hot wallets et cold wallets',
    level: 1,
    track: 'bases',
    minutes: 25,
    summary:
      "Comment fonctionne un exchange centralisé vu de la blockchain : adresses de dépôt, balayage, hot wallet, cold wallet, retraits groupés, adresses partagées avec memo. Savoir distinguer ces adresses et savoir quoi demander est indispensable pour rédiger une réquisition utile.",
    objectives: [
      'Vous saurez décrire l\'architecture on-chain d\'un exchange custodial.',
      'Vous saurez reconnaître une adresse de dépôt, un hot wallet et un cold wallet à leur comportement.',
      'Vous saurez pourquoi la trace « traverse » mal un exchange et comment requérir sur un dépôt ou un retrait.',
      'Vous saurez quelles données demander à un exchange et quels pièges éviter (services imbriqués, adresses partagées).',
    ],
    prerequisites: ['ecosysteme-acteurs', 'utxo', 'comptes-evm'],
    practice: ['first-trace', 'eth-first', 'xrp-destination-tag'],
    blocks: [
      {
        type: 'text',
        md: `Presque toutes les traces passent, à un moment, par un **exchange centralisé**. C'est le lieu où les euros deviennent des crypto-actifs, et inversement ; c'est aussi le lieu où l'identité du client est connue. Encore faut-il désigner la **bonne adresse** et la **bonne opération** dans la réquisition.

Un exchange (Coinvault, Binova, Nordex dans les exercices) détient les clés pour le compte de ses clients et tient une **comptabilité interne**. Les achats, ventes et transferts entre clients d'un même exchange se font **hors chaîne** : ils sont invisibles sur la blockchain.`,
      },
      { type: 'heading', text: 'L\'architecture d\'un exchange custodial' },
      {
        type: 'table',
        headers: ['Famille d\'adresses', 'Rôle', 'Désigne un client ?', 'Signature on-chain'],
        rows: [
          ['Adresses de dépôt', 'Recevoir les fonds d\'un client précis', '**Oui** (en général une ou plusieurs par client et par chaîne)', 'Quelques contreparties externes, vidage rapide vers le hot wallet'],
          ['Hot wallet', 'Centraliser les fonds en ligne, servir les retraits', 'Non', 'Volumes énormes, milliers de contreparties, retraits groupés'],
          ['Cold wallet', 'Réserves hors ligne', 'Non', 'Peu de mouvements, gros montants ronds, souvent multisignature'],
          ['Adresse partagée + memo/tag', 'Dépôt unique pour tous les clients sur certaines chaînes', 'Non : c\'est le **memo / destination tag** qui désigne le client', 'XRP, Stellar, EOS, Cosmos, TON…'],
        ],
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'Suivez un dépôt client : arrivée sur l\'adresse de dépôt, balayage vers le hot wallet, réserve en cold wallet, puis retrait groupé vers un autre client.',
      },
      { type: 'heading', text: 'Le balayage (sweep) des dépôts' },
      {
        type: 'text',
        md: `Les fonds reçus sur les adresses de dépôt sont périodiquement **balayés** vers le hot wallet :

- **Bitcoin** : consolidations de dizaines à centaines d'entrées (adresses de dépôt de clients différents) vers une ou deux sorties. C'est ce regroupement qui permet aux outils de reconnaître toutes ces adresses comme appartenant à l'exchange (niveau 2).
- **EVM (Ethereum, BNB Smart Chain…)** : une adresse de dépôt qui reçoit des jetons n'a pas d'ETH pour payer le gaz. L'exchange lui envoie d'abord un peu d'ETH (**gas top-up**), puis transfère les jetons vers le hot wallet. Certains exchanges utilisent à la place des **contrats de dépôt** (*forwarders*) qui renvoient automatiquement les fonds.
- **Tron** : même logique, avec envoi de TRX ou délégation d'énergie avant le transfert des USDT.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Fonds de la victime', kind: 'suspect', sub: 'Adresse de l\'auteur' },
          { id: 'd', label: '0xd41c…88a0', kind: 'deposit', sub: 'Adresse de dépôt Binova' },
          { id: 'g', label: 'Binova : gas', kind: 'service', sub: 'Gas top-up' },
          { id: 'h', label: 'Binova : hot wallet 14', kind: 'hot' },
          { id: 'c', label: 'Binova : cold wallet', kind: 'exchange', sub: 'Réserve' },
        ],
        edges: [
          { from: 'v', to: 'd', label: '4 800 USDT' },
          { from: 'g', to: 'd', label: '0,002 ETH' },
          { from: 'd', to: 'h', label: '4 800 USDT (balayage)' },
          { from: 'h', to: 'c', label: '2 000 000 USDT', dashed: true },
        ],
        caption: 'Gas top-up puis balayage vers le hot wallet : la signature d\'une adresse de dépôt, donc d\'un client identifiable.',
      },
      {
        type: 'check',
        q: 'Une adresse reçoit 3 200 USDT de l\'auteur, puis un petit montant d\'ETH d\'une adresse « Coinvault : gas », puis transfère les USDT vers le hot wallet Coinvault. Qu\'est-ce que cette adresse ?',
        options: ['Le hot wallet de Coinvault', 'Une adresse de dépôt d\'un client Coinvault', 'Le cold wallet', 'Un portefeuille personnel de l\'auteur'],
        answer: 1,
        explain: 'Gas top-up puis balayage vers le hot wallet : signature d\'une adresse de dépôt attribuée à un client, identifiable par réquisition.',
      },
      { type: 'heading', text: 'Retraits : la trace traverse mal un exchange' },
      {
        type: 'text',
        md: `Les retraits sont servis depuis le hot wallet, souvent par **lots** (une transaction, des dizaines de bénéficiaires). Les fonds étant **fongibles** dans le hot wallet, il n'existe **aucun lien on-chain** entre le dépôt d'un client et ses retraits ultérieurs.

- On ne peut pas suivre des fonds « à travers » un exchange en regardant la blockchain : l'exchange est une **boîte noire**. Seule sa réponse (historique du compte) permet de savoir où sont repartis les fonds.
- À l'inverse, si des fonds de l'affaire **sortent** d'un hot wallet (retrait), le bénéficiaire du retrait est un client de l'exchange : on requiert avec le **hash du retrait** et l'adresse de destination pour identifier le compte émetteur.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Requérir sur un dépôt',
          md: `- Désigner l'**adresse de dépôt** et le **hash** de la transaction entrante
- Demander : titulaire du compte, KYC, historique, devenir des fonds (retraits, conversions), connexions
- Demander le **gel** du compte si des fonds y sont encore`,
        },
        right: {
          title: 'Requérir sur un retrait',
          md: `- Désigner le **hash du retrait**, l'**adresse de destination** et le montant exact (une transaction groupée sert de nombreux clients)
- Demander : compte à l'origine du retrait, KYC, origine des fonds, connexions
- Inutile de désigner l'adresse du hot wallet seule`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'L\'erreur classique : requérir sur un hot wallet',
        md: `Adresser une réquisition « concernant l'adresse X » alors que X est un hot wallet conduit à une réponse décevante : « cette adresse appartient à notre plateforme ». Le hot wallet ne désigne aucun client. Désignez **l'opération** (hash) et, pour un dépôt, **l'adresse de dépôt**.`,
      },
      { type: 'heading', text: 'Grille d\'identification' },
      {
        type: 'table',
        headers: ['Indice', 'Adresse de dépôt', 'Hot wallet', 'Cold wallet'],
        rows: [
          ['Nombre de contreparties', 'Faible', 'Très élevé', 'Très faible'],
          ['Durée de détention', 'Courte (minutes à jours)', 'Flux continu', 'Longue'],
          ['Gas top-up (EVM/Tron)', 'Oui, depuis une adresse de l\'exchange', 'Non (il finance les autres)', 'Non'],
          ['Montants', 'Ceux des clients', 'Tous montants, retraits groupés', 'Gros montants ronds'],
          ['Destination des sorties', 'Toujours le hot wallet', 'Clients, cold wallet', 'Hot wallet'],
          ['Réquisition utile', 'Identité du titulaire + historique', 'Sur la base d\'un hash précis', 'Sans intérêt pour l\'identification'],
        ],
      },
      { type: 'heading', text: 'Adresses partagées et memos' },
      {
        type: 'text',
        md: `Sur certaines chaînes (XRP Ledger, Stellar, EOS, Cosmos, TON…), l'exchange utilise **une seule adresse de dépôt** pour tous ses clients. Le client est identifié par un **destination tag** (XRP) ou un **memo** (autres chaînes), nombre ou texte joint à la transaction.

Conséquences : l'adresse seule ne désigne personne ; il faut transmettre **le tag ou le memo** avec le hash. Une victime qui a oublié le tag a « perdu » ses fonds dans le compte de l'exchange, qui peut généralement les retrouver sur demande. La leçon « XRP, Stellar, EOS : memos et destination tags » (niveau 2) approfondit.`,
      },
      { type: 'heading', text: 'Que demander à un exchange ?' },
      {
        type: 'steps',
        items: [
          { title: 'Identifier précisément l\'objet', md: 'Chaîne, actif, adresse(s), hash, montant exact, horodatage UTC, sens du flux, memo/tag le cas échéant.' },
          { title: 'Identité et KYC', md: 'Identité déclarée, pièces justificatives, selfie/vidéo de vérification, coordonnées (courriel, téléphone), adresse postale.' },
          { title: 'Moyens de paiement', md: 'Comptes bancaires (IBAN) et cartes associés : pivot vers les réquisitions bancaires.' },
          { title: 'Historique du compte', md: 'Dépôts et retraits crypto (avec hash et adresses), dépôts et retraits en euros, conversions, transferts internes.' },
          { title: 'Données techniques', md: 'Journaux de connexion (IP, horodatage, appareil, agent utilisateur), adresses de retrait enregistrées, échanges avec le support.' },
          { title: 'Mesures conservatoires', md: 'Gel du compte et conservation des données, en précisant le cadre.' },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Voies et précautions (à vérifier dans les textes en vigueur)',
        md: `- Prestataire établi en France : réquisition sur le fondement des **articles 60-1, 77-1-1 ou 99-3 du CPP** selon le cadre d'enquête.
- Prestataire d'un autre État membre : coopération volontaire possible pour les données de base ; **décision d'enquête européenne** pour les éléments complets.
- Prestataire hors UE : portail volontaire quand il existe ; sinon **entraide pénale internationale**.
- Les prestataires conservent en principe leurs données d'identification et d'opérations pendant cinq ans au titre de la LCB-FT.
- Ne demandez pas à un prestataire s'il a effectué une **déclaration de soupçon** : elle est couverte par une obligation de confidentialité ; la voie passe par TRACFIN.`,
      },
      {
        type: 'case',
        title: 'Cas : du dépôt Binova au compte bancaire',
        md: `Les 4 800 USDT d'une victime arrivent sur \`0xd41c…88a0\`, qui reçoit ensuite un gas top-up puis balaie vers le hot wallet 14 de **Binova**.

Réquisition via le portail de Binova, désignant : Ethereum, USDT (contrat officiel), adresse de dépôt \`0xd41c…88a0\`, hash du dépôt \`0x5a7e…c3d1\`, 4 800 USDT, 12/02 à 16:47 UTC.

Réponse (onze jours plus tard) : compte ouvert au nom de M. K., pièce d'identité étrangère, connexions depuis des IP françaises et un VPN ; les USDT ont été convertis en euros et retirés vers un **IBAN** ouvert dans un établissement de paiement en ligne. Nouvelle réquisition bancaire, et la piste quitte la blockchain pour rejoindre une enquête financière classique.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : services imbriqués',
        md: `Un échangeur sans KYC ou un courtier OTC peut détenir un compte chez un grand exchange : les fonds de ses propres clients y transitent. La réponse de l'exchange désignera alors **le service**, pas l'utilisateur final. Indices : volumes très supérieurs à ceux d'un particulier, dépôts provenant de centaines de contreparties, activité continue. Il faut ensuite remonter vers ce service.`,
      },
      {
        type: 'check',
        q: 'Les fonds de l\'affaire proviennent d\'un retrait groupé d\'un hot wallet (une transaction, 85 bénéficiaires). Que mettre dans la réquisition ?',
        options: [
          'L\'adresse du hot wallet uniquement',
          'Le hash du retrait, l\'adresse de destination concernée, le montant et l\'horodatage',
          'Le nom de la victime uniquement',
          'Rien, ce n\'est pas exploitable',
        ],
        answer: 1,
        explain: 'Le hash et la sortie concernée permettent à l\'exchange de retrouver le client à l\'origine de ce retrait précis parmi les 85.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Adresse de dépôt', def: 'Adresse attribuée à un client pour déposer ; identifie ce client.' },
          { term: 'Hot wallet', def: 'Portefeuille en ligne de l\'exchange, qui centralise et sert les retraits.' },
          { term: 'Cold wallet', def: 'Réserve hors ligne, rarement mouvementée.' },
          { term: 'Balayage (sweep)', def: 'Transfert des fonds des adresses de dépôt vers le hot wallet.' },
          { term: 'Gas top-up', def: 'Envoi de monnaie native à une adresse de dépôt pour payer le transfert de jetons.' },
          { term: 'Retrait groupé (batch)', def: 'Une transaction qui sert de nombreux retraits de clients.' },
          { term: 'Destination tag / memo', def: 'Identifiant joint à une transaction pour désigner le client sur une adresse partagée.' },
        ],
      },
    ],
    keyPoints: [
      'Une adresse de dépôt identifie un client ; un hot wallet identifie seulement l\'exchange.',
      'Les dépôts sont balayés vers le hot wallet (consolidations BTC, gas top-up sur EVM/Tron).',
      'Aucun lien on-chain entre dépôts et retraits d\'un client : l\'exchange est une boîte noire.',
      'Pour un retrait, requérir avec le hash et l\'adresse de destination ; pour un dépôt, avec l\'adresse de dépôt et le hash.',
      'Sur les chaînes à adresse partagée, le memo ou destination tag désigne le client.',
      'Demander KYC, IBAN, historique, connexions, gel ; ne pas interroger sur une déclaration de soupçon.',
      'Méfiance envers les services imbriqués : le « client » peut être un autre service.',
    ],
    quiz: [
      {
        q: 'Peut-on suivre on-chain des fonds déposés chez un exchange jusqu\'à leur retrait ?',
        options: [
          'Oui, en suivant le hot wallet',
          'Non : les fonds sont fongibles dans l\'exchange ; il faut l\'historique du compte par réquisition',
          'Oui, grâce au memo',
          'Oui, en comptant les confirmations',
        ],
        answer: 1,
        explain: 'Le hot wallet mélange les fonds de tous les clients ; seule la comptabilité interne de l\'exchange relie dépôts et retraits.',
      },
      {
        q: 'Quelle caractéristique évoque un cold wallet ?',
        options: [
          'Des milliers de contreparties par jour',
          'Peu de transactions, gros montants ronds, souvent multisignature',
          'Des gas top-up réguliers',
          'Des dépôts de victimes',
        ],
        answer: 1,
        explain: 'Le cold wallet sert de réserve : il bouge rarement, par gros montants, vers ou depuis le hot wallet.',
      },
      {
        kind: 'truefalse',
        q: 'Un transfert entre deux clients d\'un même exchange apparaît sur la blockchain.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Il est enregistré dans la comptabilité interne de l\'exchange, hors chaîne. Seul l\'exchange peut le décrire.',
      },
      {
        kind: 'multi',
        q: 'Quelles données est-il pertinent de demander à un exchange sur le titulaire d\'une adresse de dépôt ? (plusieurs réponses)',
        options: [
          'Identité et pièces KYC',
          'IBAN et cartes associés',
          'Journaux de connexion (IP, horodatage, appareil)',
          'L\'existence d\'une éventuelle déclaration de soupçon',
        ],
        answer: [0, 1, 2],
        explain: 'Identité, moyens de paiement et connexions sont exploitables. La déclaration de soupçon est confidentielle : elle ne se demande pas au prestataire.',
      },
      {
        q: 'Une victime a envoyé des XRP à l\'adresse de dépôt d\'un exchange. Quelle information est indispensable, en plus de l\'adresse et du hash, pour identifier le client destinataire ?',
        options: ['Le nonce', 'Le destination tag', 'Le taux de frais', 'La hauteur de bloc uniquement'],
        answer: 1,
        explain: 'Sur XRP, l\'adresse de dépôt est souvent partagée entre tous les clients ; le destination tag désigne le compte.',
      },
      {
        q: 'Une adresse reçoit des dépôts de 600 contreparties différentes par mois, convertit et retire en continu. La réponse de l\'exchange désigne une société de « change rapide ». De quoi s\'agit-il probablement ?',
        options: ['D\'un cold wallet', 'D\'un service imbriqué', 'D\'un mineur', 'D\'une erreur de l\'exchange'],
        answer: 1,
        explain: 'Le titulaire est un service qui opère via son compte chez l\'exchange. Il faut remonter vers ce service pour atteindre l\'utilisateur final.',
      },
      {
        q: 'Sur Ethereum, pourquoi une adresse de dépôt reçoit-elle un petit montant d\'ETH de l\'exchange avant le balayage ?',
        options: [
          'Pour récompenser le client',
          'Pour payer le gaz nécessaire au transfert des jetons vers le hot wallet',
          'Pour tester l\'adresse',
          'Pour la geler',
        ],
        answer: 1,
        explain: 'Une adresse qui ne détient que des jetons ne peut pas payer le gaz : l\'exchange l\'alimente (gas top-up).',
      },
    ],
    flashcards: [
      { front: 'Adresse de dépôt', back: 'Propre à un client : identifiable par réquisition.' },
      { front: 'Hot wallet', back: 'Appartient à l\'exchange ; ne désigne aucun client.' },
      { front: 'Cold wallet', back: 'Réserve hors ligne : peu de mouvements, gros montants ronds.' },
      { front: 'Gas top-up', back: 'ETH/TRX envoyé par l\'exchange à une adresse de dépôt avant de balayer ses jetons.' },
      { front: 'Forwarder', back: 'Contrat de dépôt qui renvoie automatiquement les fonds au hot wallet.' },
      { front: 'Requérir sur un retrait', back: 'Hash du retrait + adresse de destination + montant + horodatage.' },
      { front: 'Pourquoi la trace traverse mal un exchange', back: 'Fongibilité dans le hot wallet : aucun lien on-chain entre dépôt et retrait.' },
      { front: 'Destination tag', back: 'Identifiant du client sur une adresse de dépôt partagée (XRP).' },
      { front: 'Données à demander', back: 'KYC, IBAN/cartes, historique avec hash, connexions (IP, appareil), gel.' },
      { front: 'Déclaration de soupçon', back: 'Confidentielle : ne pas la demander au prestataire.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // suivre-flux
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'suivre-flux',
    title: 'Suivre un flux de A à Z : la méthode',
    level: 1,
    track: 'methodo',
    minutes: 28,
    summary:
      "La méthode complète pour suivre des fonds, de la transaction de la victime jusqu'au service qui permet d'identifier ou de bloquer : cadrer la question, ancrer, suivre saut par saut, choisir les branches, reconnaître les motifs, savoir s'arrêter, documenter et restituer.",
    objectives: [
      'Vous saurez cadrer une analyse de flux selon l\'objectif poursuivi (identifier, geler, rapprocher, chiffrer).',
      'Vous saurez dérouler un traçage saut par saut et tenir un journal de traçage reproductible.',
      'Vous saurez choisir les branches à suivre et reconnaître les motifs courants (passe-plat, fractionnement, consolidation).',
      'Vous saurez quand arrêter une branche et comment restituer le résultat.',
    ],
    prerequisites: ['premiers-reflexes', 'utxo', 'comptes-evm', 'exchanges'],
    practice: ['first-trace', 'pig-butchering-tron', 'eth-first', 'peel-chain'],
    blocks: [
      {
        type: 'text',
        md: `Suivre un flux, ce n'est pas cliquer d'adresse en adresse jusqu'à épuisement. C'est une démarche **orientée par une question**, **documentée** à chaque étape, et qui sait **s'arrêter** au bon endroit. Un bon traçage est celui qu'un collègue, un magistrat ou un expert peut **refaire** à l'identique à partir de vos notes.

Cette leçon assemble tout ce qui précède en une méthode applicable à Bitcoin comme à Ethereum ou Tron.`,
      },
      { type: 'heading', text: 'La méthode en sept étapes' },
      {
        type: 'steps',
        items: [
          { title: '1. Cadrer', md: 'Quelle est la question ? Identifier un bénéficiaire, localiser des fonds pour un gel, rapprocher des victimes, chiffrer un préjudice. La réponse détermine jusqu\'où aller.' },
          { title: '2. Ancrer', md: 'Partir des transactions vérifiées de la victime : hash, montants, horodatage UTC, adresse de destination.' },
          { title: '3. Suivre saut par saut', md: 'Pour chaque adresse : que devient le montant suivi ? Quelle transaction le fait sortir, vers où ?' },
          { title: '4. Qualifier chaque adresse', md: 'Adresse personnelle, intermédiaire de passage, consolidation, service (exchange, DEX, bridge, mixeur) ?' },
          { title: '5. Choisir les branches', md: 'Quand le flux se divise, prioriser selon l\'objectif et noter la convention retenue.' },
          { title: '6. Savoir s\'arrêter', md: 'Service identifiable, fonds au repos, obstacle technique, dilution : chaque branche se termine par un constat explicite.' },
          { title: '7. Documenter et restituer', md: 'Journal de traçage, schéma, pièces (exports, empreintes), synthèse distinguant faits et hypothèses.' },
        ],
      },
      { type: 'heading', text: 'Cadrer : la question change tout' },
      {
        type: 'table',
        headers: ['Objectif', 'Ce qu\'on cherche', 'Où l\'on s\'arrête'],
        rows: [
          ['Identifier un auteur', 'Un service qui connaît son client (dépôt d\'exchange)', 'Au premier dépôt identifiable : réquisition'],
          ['Geler des fonds', 'Des fonds encore immobiles sur une adresse ou un compte', 'Au solde le plus important encore gelable'],
          ['Rapprocher des affaires', 'Les adresses de collecte et de consolidation communes', 'Quand les flux entrants des autres victimes sont relevés'],
          ['Chiffrer un préjudice ou un réseau', 'L\'ensemble des flux entrants sur les adresses de l\'auteur', 'Quand le périmètre des adresses est stabilisé'],
        ],
      },
      { type: 'heading', text: 'Suivre et qualifier' },
      {
        type: 'text',
        md: `À chaque saut, posez trois questions :

1. **Quel montant suit-on ?** Sur Bitcoin, identifiez le paiement et le rendu ; sur Ethereum ou Tron, suivez le jeton concerné et notez les frais.
2. **Combien de temps les fonds sont-ils restés ?** Un passage de quelques minutes évoque une adresse **passe-plat** ; un séjour de plusieurs jours, une adresse de stockage ou une attente (gel possible).
3. **Qui est derrière la destination ?** Étiquette d'outil, comportement (nombre de contreparties, gas top-up, balayage), forme de la transaction.

Tolérez de petits écarts de montant : frais de réseau, frais de service, taxes de jetons. Un montant qui « réapparaît » à quelques unités près, peu après, est un indice de continuité ; ce n'est pas une preuve à lui seul.`,
      },
      {
        type: 'table',
        headers: ['Motif', 'Ce que l\'on voit', 'Interprétation fréquente'],
        rows: [
          ['Passe-plat', 'Reçu puis renvoyé presque intégralement en quelques minutes', 'Intermédiaire jetable pour allonger la trace'],
          ['Fractionnement', 'Un montant divisé en plusieurs sorties', 'Dispersion vers plusieurs comptes ou services, contournement de seuils'],
          ['Consolidation', 'Plusieurs entrées regroupées vers une adresse', 'Agrégation de victimes ou de collectes'],
          ['Peel chain', 'Une suite de transactions qui « pèlent » chacune un petit montant', 'Paiements successifs ou dépôts fractionnés (niveau 2)'],
          ['Aller-retour', 'Fonds qui reviennent vers une adresse déjà vue', 'Brouillage, ou adresses d\'un même portefeuille'],
          ['Changement d\'actif', 'Swap sur un DEX, dépôt à un échangeur', 'Continuer la trace sur le nouvel actif (niveau 2-3)'],
        ],
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'Rappel : à l\'entrée d\'un exchange, la trace on-chain s\'arrête et la réquisition prend le relais.',
      },
      {
        type: 'check',
        q: 'Une adresse reçoit 5 000 USDT à 10:02 UTC et renvoie 4 999 USDT à 10:09 UTC vers une autre adresse, sans autre activité. Comment la qualifier ?',
        options: [
          'Un exchange',
          'Une adresse passe-plat (intermédiaire de passage)',
          'Un cold wallet',
          'Une adresse de consolidation',
        ],
        answer: 1,
        explain: 'Réception et réémission quasi intégrales en quelques minutes, sans autre activité : intermédiaire destiné à allonger la trace.',
      },
      { type: 'heading', text: 'Choisir les branches' },
      {
        type: 'text',
        md: `Dès que les fonds de la victime se mêlent à d'autres fonds (consolidation) puis se divisent, il devient impossible de dire **quels** satoshis ou **quels** USDT sont « ceux de la victime ». Il faut alors une **convention**, explicitée dans vos écrits :

- **suivre la branche la plus importante** ou celle qui mène le plus vite à un service ;
- **suivre chronologiquement** (« premier entré, premier sorti ») ;
- **répartir au prorata** des montants (approche dite proportionnelle).

Le choix dépend de l'objectif : pour **identifier**, on privilégie la branche qui mène à un dépôt d'exchange ; pour **geler**, celle qui aboutit au solde immobile le plus important. Les conventions de calcul d'exposition sont détaillées au niveau 2 (« Exposition, taint et score de risque »).`,
      },
      {
        type: 'widget',
        id: 'risk-exposure',
        caption: 'Visualisez comment la part « issue de la victime » se répartit lorsque les fonds se mélangent puis se divisent.',
      },
      { type: 'heading', text: 'Savoir s\'arrêter' },
      {
        type: 'table',
        headers: ['Fin de branche', 'Constat à écrire', 'Suite'],
        rows: [
          ['Dépôt chez un exchange identifié', '« Fonds déposés sur une adresse de dépôt attribuée à Binova (hash…) »', 'Réquisition, gel du compte'],
          ['Fonds au repos sur une adresse de l\'auteur', '« Solde de X USDT constaté le … à … UTC »', 'Demande de gel, surveillance, saisie'],
          ['Mixeur, pool de confidentialité', '« Fonds entrés dans le service Y (hash…) »', 'Analyse spécialisée (niveaux 3-4)'],
          ['Bridge ou échangeur', '« Fonds transférés vers la chaîne Z via W »', 'Poursuivre sur la chaîne d\'arrivée'],
          ['Dilution dans de gros volumes', '« Fonds mêlés à un flux de N fois leur montant ; poursuite non significative »', 'Arrêt motivé'],
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Ne pas « suivre » au-delà du raisonnable',
        md: `Au-delà de quelques mélanges successifs, la part attribuable à la victime devient infime et toute conclusion devient fragile. Une branche qui aboutit au hot wallet d'un grand exchange ou à un service de paiement brassant des millions doit être **arrêtée** et **motivée**, pas poursuivie par réflexe. Mieux vaut trois branches solides qu'un graphe de deux cents adresses incompréhensible.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'Coinvault' },
          { id: 'a', label: 'bc1qx7m2…8sdkfm', kind: 'suspect', sub: 'Collecte' },
          { id: 'b', label: 'bc1q4ld0…r7c2wq', kind: 'wallet', sub: 'Passe-plat' },
          { id: 'c', label: 'Rendu', kind: 'wallet', sub: 'bc1qm9…2fq7xs' },
          { id: 'd', label: 'Dépôt Nordex', kind: 'deposit' },
          { id: 'e', label: 'Ocelot Swap', kind: 'service', sub: 'BTC → USDT (Tron)' },
          { id: 'f', label: 'TBw1…mD7c', kind: 'suspect', sub: 'Solde au repos' },
        ],
        edges: [
          { from: 'v', to: 'a', label: '0,35 BTC' },
          { from: 'a', to: 'b', label: '0,3499 BTC' },
          { from: 'b', to: 'd', label: '0,20 BTC' },
          { from: 'b', to: 'c', label: '0,14988 BTC (rendu)' },
          { from: 'c', to: 'e', label: '0,1498 BTC' },
          { from: 'e', to: 'f', label: '8 950 USDT' },
        ],
        caption: 'Deux fins de branche exploitables : un dépôt Nordex (réquisition) et un solde d\'USDT au repos sur Tron (gel).',
      },
      { type: 'heading', text: 'Le journal de traçage' },
      {
        type: 'table',
        headers: ['Saut', 'Date (UTC)', 'Hash', 'De → Vers', 'Montant', 'Nature de la destination', 'Justification'],
        rows: [
          ['0', '14/10 08:41', '`4e1f…a9c2`', 'Coinvault → bc1qx7m2…', '0,35 BTC', 'Collecte (auteur)', 'Retrait de la victime (réponse Coinvault)'],
          ['1', '14/10 10:12', '`7b0c…e15f`', 'bc1qx7m2… → bc1q4ld0…', '0,3499 BTC', 'Passe-plat', 'Transfert intégral, 1 entrée → 1 sortie'],
          ['2', '14/10 13:55', '`c92a…04d8`', 'bc1q4ld0… → dépôt Nordex', '0,20 BTC', 'Dépôt d\'exchange (outil, non vérifié)', 'Montant rond, type différent ; balayage observé'],
          ['2b', '14/10 13:55', '`c92a…04d8`', 'bc1q4ld0… → bc1qm9…', '0,14988 BTC', 'Rendu probable', 'Même type que l\'entrée, adresse neuve'],
          ['3', '15/10 07:20', '`e4f1…9a3b`', 'bc1qm9… → Ocelot Swap', '0,1498 BTC', 'Échangeur instantané', 'Étiquette outil + adresse de dépôt du service'],
        ],
        caption: 'Chaque ligne doit pouvoir être vérifiée par un tiers. La colonne « justification » distingue fait, indice et hypothèse.',
      },
      {
        type: 'case',
        title: 'Cas : faux conseiller bancaire, de bout en bout',
        md: `**Cadrage.** Objectif double : identifier le bénéficiaire et geler ce qui peut l'être.

**Ancrage.** Réponse de Coinvault : retrait de 0,35 BTC du compte de la victime, hash \`4e1f…a9c2\`, vers \`bc1qx7m2…8sdkfm\`.

**Suivi.** Saut 1 : passe-plat. Saut 2 : division en 0,20 BTC (paiement probable vers une adresse que l'outil attribue à **Nordex**, confirmée par l'observation d'un balayage vers un hot wallet du service) et 0,14988 BTC (rendu probable). Saut 3 : le rendu part chez **Ocelot Swap**, échangé contre 8 950 USDT envoyés sur Tron à \`TBw1…mD7c\`, où ils sont encore au repos.

**Fins de branche.** (1) Dépôt Nordex : demande de données et de gel au prestataire européen, DEE si nécessaire. (2) Solde Tron : demande de gel à l'émetteur de l'USDT. (3) Ocelot Swap : demande de l'adresse IP et des données de la commande à partir du hash de dépôt.

**Restitution.** Schéma à trois branches, journal de traçage, exports hachés, synthèse distinguant ce qui est établi (flux on-chain, réponse de Coinvault) de ce qui est probable (rendu, attribution Nordex en attente de confirmation).`,
      },
      {
        type: 'check',
        q: 'Les fonds suivis aboutissent au hot wallet d\'un grand exchange qui reçoit des milliers de dépôts par jour, sans passer par une adresse de dépôt identifiable. Que faire ?',
        options: [
          'Continuer à suivre toutes les sorties du hot wallet',
          'Arrêter la branche, consigner le constat, et requérir l\'exchange sur la base du hash précis de l\'opération',
          'Conclure que les fonds sont perdus',
          'Demander le gel du hot wallet à l\'émetteur',
        ],
        answer: 1,
        explain: 'Le hot wallet mélange les fonds de tous les clients : poursuivre on-chain n\'a plus de sens. La réquisition sur l\'opération précise prend le relais.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : la restitution',
        md: `Votre lecteur (magistrat, avocat, juridiction) n'est pas analyste. Fournissez :

- un **schéma** simple, une branche par couleur, avec les montants ;
- le **journal de traçage** en annexe ;
- une **synthèse** en langage clair : où sont partis les fonds, ce qui est établi, ce qui est probable, ce qui reste à faire ;
- les **pièces** (exports, empreintes, réponses des prestataires).

La leçon « Rédiger un rapport d'analyse blockchain » (niveau 3) développe la forme.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Passe-plat', def: 'Adresse intermédiaire qui reçoit et réémet presque immédiatement l\'intégralité des fonds.' },
          { term: 'Fractionnement', def: 'Division d\'un montant en plusieurs sorties.' },
          { term: 'Consolidation', def: 'Regroupement de plusieurs entrées sur une même adresse.' },
          { term: 'Fin de branche', def: 'Point où l\'on cesse de suivre une branche, avec un constat motivé.' },
          { term: 'Convention de traçage', def: 'Règle explicite pour attribuer des fonds mélangés (branche principale, chronologie, prorata).' },
          { term: 'Dilution', def: 'Mélange des fonds suivis dans des volumes sans commune mesure, qui rend la poursuite non significative.' },
        ],
      },
    ],
    keyPoints: [
      'Un traçage part d\'une question (identifier, geler, rapprocher, chiffrer) qui fixe jusqu\'où aller.',
      'Ancrer sur les transactions vérifiées de la victime, puis suivre saut par saut en qualifiant chaque adresse.',
      'Reconnaître les motifs : passe-plat, fractionnement, consolidation, peel chain, changement d\'actif.',
      'Quand les fonds se mélangent, expliciter la convention de suivi retenue.',
      'Chaque branche se termine par un constat motivé : service, fonds au repos, obstacle, dilution.',
      'Tenir un journal de traçage reproductible et distinguer faits, indices et hypothèses.',
    ],
    quiz: [
      {
        q: 'Quelle est la première étape d\'une analyse de flux ?',
        options: [
          'Cliquer sur toutes les adresses liées',
          'Cadrer la question à laquelle l\'analyse doit répondre',
          'Demander le gel de toutes les adresses',
          'Rédiger le rapport',
        ],
        answer: 1,
        explain: 'L\'objectif (identifier, geler, rapprocher, chiffrer) détermine les branches à suivre et le point d\'arrêt.',
      },
      {
        kind: 'multi',
        q: 'Quelles situations constituent une fin de branche légitime ? (plusieurs réponses)',
        options: [
          'Dépôt sur une adresse de dépôt d\'exchange identifiée',
          'Fonds au repos sur une adresse de l\'auteur',
          'Entrée dans un mixeur',
          'Une adresse qui renvoie les fonds dix minutes plus tard',
        ],
        answer: [0, 1, 2],
        explain: 'Une adresse qui renvoie les fonds est un passe-plat : la trace continue. Les trois autres situations appellent une action (réquisition, gel, analyse spécialisée).',
      },
      {
        kind: 'truefalse',
        q: 'Après une consolidation où les fonds de la victime se mêlent à ceux de vingt autres victimes, on peut dire avec certitude quels USDT sortants sont « ceux de la victime ».',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Les fonds sont fongibles : il faut une convention (branche principale, chronologie, prorata), explicitée dans les écrits.',
      },
      {
        q: 'Pour un objectif de gel, quelle branche suivre en priorité ?',
        options: [
          'La plus ancienne',
          'Celle qui aboutit au solde immobile le plus important encore gelable',
          'Celle qui passe par le plus d\'adresses',
          'Celle qui va vers un mixeur',
        ],
        answer: 1,
        explain: 'Le gel vise des fonds encore présents : on cherche le solde au repos le plus important.',
      },
      {
        q: 'Que doit contenir chaque ligne d\'un journal de traçage ?',
        options: [
          'Seulement les adresses',
          'Date UTC, hash, adresses source et destination, montant, nature de la destination et justification',
          'Le cours du bitcoin',
          'L\'avis personnel de l\'analyste',
        ],
        answer: 1,
        explain: 'Ces éléments rendent chaque saut vérifiable et distinguent ce qui est établi de ce qui est supposé.',
      },
      {
        q: 'Un montant de 0,3499 BTC apparaît sur une nouvelle adresse sept minutes après la sortie de 0,35 BTC de l\'adresse précédente. Comment interpréter l\'écart ?',
        options: [
          'C\'est la preuve d\'un vol de 0,0001 BTC',
          'C\'est très probablement les frais de réseau ; c\'est un indice de continuité, pas une preuve à lui seul',
          'Ce sont deux flux sans rapport',
          'C\'est une erreur de l\'explorateur',
        ],
        answer: 1,
        explain: 'Les frais expliquent les petits écarts. La continuité est établie par la transaction elle-même ; montant et délai ne sont que des indices s\'il n\'y a pas de lien direct.',
      },
      {
        q: 'Les fonds sont transférés via un bridge vers une autre blockchain. Que faire ?',
        options: [
          'Arrêter définitivement l\'analyse',
          'Constater le transfert et poursuivre la trace sur la chaîne d\'arrivée en exploitant les événements du bridge',
          'Demander au bridge l\'identité de l\'utilisateur',
          'Considérer que les fonds sont détruits',
        ],
        answer: 1,
        explain: 'Un bridge déplace la valeur d\'une chaîne à l\'autre ; ses événements permettent de relier départ et arrivée (niveau 3).',
      },
    ],
    flashcards: [
      { front: 'Les 7 étapes du suivi de flux', back: 'Cadrer, ancrer, suivre, qualifier, choisir les branches, s\'arrêter, documenter/restituer.' },
      { front: 'Passe-plat', back: 'Adresse qui reçoit et renvoie presque tout en quelques minutes.' },
      { front: 'Convention de traçage', back: 'Règle explicite pour les fonds mélangés : branche principale, chronologie (FIFO), prorata.' },
      { front: 'Objectif « identifier »', back: 'Suivre jusqu\'au premier dépôt d\'exchange identifiable.' },
      { front: 'Objectif « geler »', back: 'Chercher le solde au repos le plus important encore gelable.' },
      { front: 'Fin de branche', back: 'Service identifié, fonds au repos, obstacle technique ou dilution — toujours motivée.' },
      { front: 'Journal de traçage', back: 'Date UTC, hash, de → vers, montant, nature, justification.' },
      { front: 'Petit écart de montant entre deux sauts', back: 'Frais (réseau, service, taxe) : indice de continuité, pas preuve.' },
      { front: 'Hot wallet d\'un grand exchange', back: 'Arrêter la trace on-chain ; requérir sur le hash précis.' },
      { front: 'Restitution', back: 'Schéma simple, journal en annexe, synthèse claire, pièces hachées.' },
    ],
  },
]
