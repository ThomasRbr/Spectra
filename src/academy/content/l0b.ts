import type { Lesson } from '../model'

// Niveau 0 — Débutant absolu (2/2) : unités, écosystème, explorateurs,
// premiers réflexes d'enquête.
// Les entités citées (Coinvault, Binova, Nordex, Kaizen, Huobex, Ocelot Swap…) sont FICTIVES.

export const LESSONS_L0B: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════
  // unites-ordres
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'unites-ordres',
    title: 'Unités, décimales et ordres de grandeur',
    level: 0,
    track: 'bases',
    minutes: 15,
    summary:
      "Satoshis, wei, gwei, sun, décimales des jetons : les blockchains stockent des nombres entiers dans des unités minuscules. Savoir convertir sans se tromper d'un facteur un million, valoriser en euros à la bonne date et connaître les ordres de grandeur qui alertent.",
    objectives: [
      'Vous saurez convertir les unités de base des principales chaînes (sats, wei, gwei, sun, drops).',
      'Vous saurez lire un montant brut de jeton en tenant compte de ses décimales.',
      'Vous saurez valoriser un flux en euros à la date de l\'opération, en citant votre source.',
      'Vous saurez repérer les pièges de notation (séparateurs décimaux, notation scientifique, hexadécimal).',
    ],
    prerequisites: ['bases-blockchain'],
    practice: ['first-trace', 'pig-butchering-tron'],
    blocks: [
      {
        type: 'text',
        md: `Les blockchains ne connaissent pas les virgules. Elles stockent tous les montants sous forme de **nombres entiers** exprimés dans une **unité de base** minuscule : le satoshi pour Bitcoin, le wei pour Ethereum, le sun pour Tron. Les explorateurs convertissent pour l'affichage… mais pas toujours, et pas toujours correctement.

Une erreur d'unité est vite arrivée, et elle est spectaculaire : on écrit « 2,5 milliards d'USDT » au lieu de 2 500 USDT. Dans un procès-verbal, ce type d'erreur décrédibilise toute l'analyse.`,
      },
      { type: 'heading', text: 'Les unités natives' },
      {
        type: 'table',
        headers: ['Chaîne', 'Unité courante', 'Unité de base', 'Facteur', 'Exemple'],
        rows: [
          ['Bitcoin', 'BTC', 'satoshi (sat)', '1 BTC = 100 000 000 sats (10^8)', '0,0025 BTC = 250 000 sats'],
          ['Litecoin', 'LTC', 'litoshi', '10^8', '1,5 LTC = 150 000 000 litoshis'],
          ['Ethereum (et EVM)', 'ETH', 'wei', '1 ETH = 10^18 wei', '0,05 ETH = 50 000 000 000 000 000 wei'],
          ['Ethereum (frais)', '—', 'gwei', '1 gwei = 10^9 wei = 0,000000001 ETH', 'Prix du gaz : 12 gwei'],
          ['Tron', 'TRX', 'sun', '1 TRX = 1 000 000 sun (10^6)', '25 TRX = 25 000 000 sun'],
          ['XRP Ledger', 'XRP', 'drop', '1 XRP = 1 000 000 drops (10^6)', '0,000012 XRP = 12 drops'],
          ['Solana', 'SOL', 'lamport', '1 SOL = 10^9 lamports', '0,000005 SOL = 5 000 lamports'],
          ['Monero', 'XMR', 'piconero', '1 XMR = 10^12 piconeros', '—'],
        ],
        caption: 'Mémorisez au moins Bitcoin (10^8), Ethereum (10^18) et Tron (10^6).',
      },
      {
        type: 'widget',
        id: 'unit-converter',
        caption: 'Entraînez-vous : convertissez sats ↔ BTC, wei ↔ gwei ↔ ETH, et appliquez les décimales d\'un jeton.',
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : les centimes',
        md: `Votre banque compte peut-être en centimes : 12,50 € sont stockés comme « 1250 ». Les blockchains font la même chose, avec des « centimes » beaucoup plus petits : un satoshi est un cent-millionième de bitcoin, un wei un milliardième de milliardième d'ether.`,
      },
      { type: 'heading', text: 'Les décimales des jetons' },
      {
        type: 'text',
        md: `Un jeton (USDT, USDC, etc.) n'utilise pas l'unité de la chaîne : chaque contrat de jeton définit son propre nombre de **décimales**. Le montant brut enregistré doit être divisé par 10 puissance ce nombre.

La plupart des jetons utilisent **18 décimales**, mais les grands stablecoins font exception sur Ethereum et Tron : **6 décimales**. Et le même jeton peut avoir des décimales différentes selon la chaîne : sur BNB Smart Chain, la version de l'USDT utilise **18 décimales**. On vérifie donc toujours la valeur \`decimals\` du contrat **sur la chaîne concernée**.`,
      },
      {
        type: 'table',
        headers: ['Jeton', 'Chaîne', 'Décimales', 'Montant brut', 'Montant réel'],
        rows: [
          ['USDT', 'Ethereum', '6', '2500000000', '2 500 USDT'],
          ['USDT', 'Tron', '6', '15000000', '15 USDT'],
          ['USDC', 'Ethereum', '6', '980000000', '980 USDC'],
          ['USDT', 'BNB Smart Chain', '18', '2500000000000000000000', '2 500 USDT'],
          ['DAI', 'Ethereum', '18', '1000000000000000000', '1 DAI'],
          ['WBTC', 'Ethereum', '8', '50000000', '0,5 WBTC'],
        ],
        caption: 'Mêmes montants réels, montants bruts très différents : seule la valeur decimals du contrat permet de conclure.',
      },
      {
        type: 'check',
        q: 'Un transfert d\'USDT sur Tron affiche une valeur brute de 4800000000. Quel est le montant réel ?',
        options: ['4 800 000 000 USDT', '4 800 USDT', '48 USDT', '4,8 USDT'],
        answer: 1,
        explain: 'L\'USDT sur Tron a 6 décimales : 4 800 000 000 / 1 000 000 = 4 800 USDT.',
      },
      {
        type: 'flow',
        nodes: [
          { id: 'raw', label: 'Valeur brute', kind: 'tx', sub: '4800000000 (événement Transfer)' },
          { id: 'dec', label: 'Contrat USDT (Tron)', kind: 'contract', sub: 'decimals = 6' },
          { id: 'usdt', label: '4 800 USDT', kind: 'wallet', sub: 'Montant réel' },
          { id: 'usd', label: '≈ 4 800 $', kind: 'service', sub: 'Cours de l\'USDT à la date' },
          { id: 'eur', label: '≈ 4 400 €', kind: 'victim', sub: 'Taux EUR/USD du jour (source citée)' },
        ],
        edges: [
          { from: 'raw', to: 'dec', label: 'lire decimals' },
          { from: 'dec', to: 'usdt', label: '÷ 10^6' },
          { from: 'usdt', to: 'usd', label: '× cours' },
          { from: 'usd', to: 'eur', label: '÷ EUR/USD' },
        ],
        caption: 'La chaîne de conversion complète, de la valeur stockée dans la blockchain à la valorisation en euros (taux illustratif).',
      },
      { type: 'heading', text: 'Pièges de notation' },
      {
        type: 'compare',
        left: {
          title: 'Notation française',
          md: `- Virgule décimale, espace pour les milliers
- \`1 234,56\` = mille deux cent trente-quatre virgule cinquante-six
- \`0,5 BTC\` = un demi-bitcoin`,
        },
        right: {
          title: 'Notation anglo-saxonne (explorateurs, outils)',
          md: `- Point décimal, virgule pour les milliers
- \`1,234.56\` = la même valeur
- \`1,000 USDT\` = mille USDT, **pas** un USDT`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Trois pièges fréquents',
        md: `- **Séparateurs inversés** : « 1.000 USDT » peut signifier mille (notation européenne avec point de milliers) ou un (notation anglaise). Ne recopiez jamais un montant sans lever l'ambiguïté.
- **Notation scientifique** : un outil peut afficher \`1e-8\` (= 0,00000001, soit 1 satoshi) ou \`2.5e+21\` (montant brut d'un jeton à 18 décimales).
- **Hexadécimal** : dans les données techniques d'une transaction Ethereum, les montants apparaissent en hexadécimal. \`0x2faf080\` vaut 50 000 000 en décimal, soit 50 USDT pour un jeton à 6 décimales.`,
      },
      { type: 'heading', text: 'Valoriser en euros' },
      {
        type: 'text',
        md: `Le cours des crypto-actifs varie fortement : 1 BTC valait quelques centimes de dollar en 2010 et plusieurs dizaines de milliers d'euros ces dernières années. Une valorisation n'a de sens que **datée** et **sourcée**.

Les stablecoins en dollars (USDT, USDC) valent environ **1 dollar**, pas 1 euro : il faut appliquer le taux de change EUR/USD du jour de l'opération. Un écart de 5 à 10 % est fréquent selon les périodes.`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Relever le montant exact', md: 'Montant on-chain en unité courante (après conversion), avec la date et l\'heure UTC de la transaction.' },
          { title: 'Choisir une source de cours', md: 'Agrégateur de cours public, historique de l\'exchange concerné, ou outil d\'analyse. Citez-la systématiquement.' },
          { title: 'Appliquer le cours de la date', md: 'Cours de clôture journalier, ou cours horaire si les montants sont importants et le marché agité.' },
          { title: 'Convertir en euros si besoin', md: 'Pour l\'USDT : montant × taux EUR/USD du jour (source BCE par exemple).' },
          { title: 'Rédiger', md: '« 0,35 BTC, soit environ 14 900 € au cours du 14/10/2024 (source : …) ». Ajoutez si utile la valeur actuelle, clairement distinguée.' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : préjudice et valeur actuelle',
        md: `La victime raisonne en euros versés ; l'analyse raisonne en crypto-actifs transférés. Les deux ne coïncident pas : frais d'achat chez l'exchange, frais de réseau, variations de cours. Indiquez dans vos écrits les **euros versés** par la victime (relevés bancaires), les **montants on-chain** et leur **valorisation datée**. Lors d'une saisie, la valeur des avoirs au jour de la saisie peut être très différente du préjudice.`,
      },
      { type: 'heading', text: 'Ordres de grandeur utiles' },
      {
        type: 'table',
        headers: ['Grandeur', 'Ordre de grandeur', 'Ce que cela suggère'],
        rows: [
          ['Poussière Bitcoin', 'Quelques centaines de sats (seuils de 294 à 546 sats selon le type d\'adresse)', 'Envoi sans valeur : test, marquage, spam'],
          ['Frais Bitcoin d\'une transaction simple', 'Quelques centaines à quelques dizaines de milliers de sats selon l\'encombrement', 'Frais anormalement élevés : urgence ou maladresse'],
          ['Gaz d\'un simple envoi d\'ETH', '21 000 unités de gaz', 'Valeur fixe : utile pour reconnaître un transfert natif'],
          ['Transfert d\'USDT sur Tron', 'Quelques TRX brûlés si aucune énergie disponible', 'Une adresse sans TRX a été alimentée en énergie par quelqu\'un'],
          ['Escroquerie individuelle', 'Quelques milliers à quelques centaines de milliers d\'euros', 'Volumes cohérents avec une ou plusieurs victimes'],
          ['Hot wallet d\'exchange', 'Milliers de transactions par jour, soldes à 7-9 chiffres', 'Adresse de service, pas d\'un individu'],
        ],
        caption: 'Ces repères varient avec le marché : ils servent à détecter l\'anormal, pas à conclure.',
      },
      {
        type: 'case',
        title: 'Cas : le PV aux 2,5 milliards',
        md: `Un premier rapport mentionne que l'adresse \`TQm4…8vRd\` a reçu « 2 500 000 000 USDT » de la victime. L'analyste a recopié la **valeur brute** affichée dans un export CSV technique. La victime, elle, déclare avoir envoyé 2 500 USDT.

Correction : USDT sur Tron = 6 décimales, donc 2 500 000 000 / 10^6 = **2 500 USDT**, soit environ 2 290 € au taux EUR/USD du jour de la transaction (source à citer). Le rapport rectifié précise la valeur brute, les décimales appliquées et la source du cours. Moralité : toujours **écrire le calcul**.`,
      },
      {
        type: 'check',
        q: 'Une transaction Bitcoin envoie 125 000 sats. Combien de BTC ?',
        options: ['0,125 BTC', '0,0125 BTC', '0,00125 BTC', '1,25 BTC'],
        answer: 2,
        explain: '125 000 / 100 000 000 = 0,00125 BTC.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Satoshi (sat)', def: 'Plus petite unité du bitcoin : 0,00000001 BTC.' },
          { term: 'Wei', def: 'Plus petite unité de l\'ether : 10^-18 ETH.' },
          { term: 'Gwei', def: '10^9 wei ; unité utilisée pour le prix du gaz sur Ethereum.' },
          { term: 'Sun', def: 'Plus petite unité du TRX : 0,000001 TRX.' },
          { term: 'Décimales', def: 'Nombre défini par chaque contrat de jeton : montant réel = montant brut / 10^décimales.' },
          { term: 'Montant brut', def: 'Entier réellement stocké dans la blockchain, avant application des décimales.' },
          { term: 'Poussière (dust)', def: 'Montant si faible qu\'il coûterait plus cher en frais à dépenser qu\'il ne vaut.' },
        ],
      },
    ],
    keyPoints: [
      'Les blockchains stockent des entiers en unités de base : 1 BTC = 10^8 sats, 1 ETH = 10^18 wei, 1 TRX = 10^6 sun.',
      'Montant réel d\'un jeton = montant brut / 10^décimales ; USDT et USDC ont 6 décimales sur Ethereum et Tron.',
      'Les décimales d\'un même jeton peuvent varier selon la chaîne (USDT : 18 sur BNB Smart Chain).',
      'Attention aux séparateurs décimaux, à la notation scientifique et à l\'hexadécimal.',
      'Toute valorisation est datée et sourcée ; l\'USDT vaut environ 1 dollar, pas 1 euro.',
      'Écrire le calcul dans le PV : valeur brute, décimales, cours, source.',
    ],
    quiz: [
      {
        q: 'Combien de satoshis dans 0,05 BTC ?',
        options: ['50 000', '500 000', '5 000 000', '50 000 000'],
        answer: 2,
        explain: '0,05 × 100 000 000 = 5 000 000 sats.',
      },
      {
        q: 'Un transfert d\'USDC sur Ethereum affiche un montant brut de 12500000. Quel est le montant réel ?',
        options: ['12 500 000 USDC', '12,5 USDC', '125 USDC', '0,0000000000125 USDC'],
        answer: 1,
        explain: 'USDC = 6 décimales sur Ethereum : 12 500 000 / 10^6 = 12,5 USDC.',
      },
      {
        kind: 'truefalse',
        q: 'L\'USDT a le même nombre de décimales sur toutes les blockchains.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: '6 décimales sur Ethereum et Tron, mais 18 sur BNB Smart Chain. Il faut lire la valeur decimals du contrat sur la chaîne concernée.',
      },
      {
        q: 'Le prix du gaz sur Ethereum est affiché à 15 gwei. Combien d\'ETH cela représente-t-il par unité de gaz ?',
        options: ['0,15 ETH', '0,000015 ETH', '0,000000015 ETH', '15 ETH'],
        answer: 2,
        explain: '1 gwei = 10^-9 ETH, donc 15 gwei = 0,000000015 ETH par unité de gaz.',
      },
      {
        kind: 'multi',
        q: 'Que doit contenir une valorisation en euros correctement rédigée ? (plusieurs réponses)',
        options: [
          'Le montant exact en crypto-actif',
          'La date de l\'opération et le cours appliqué',
          'La source du cours',
          'Uniquement la valeur au jour de la rédaction',
        ],
        answer: [0, 1, 2],
        explain: 'La valeur du jour de rédaction peut être ajoutée, mais clairement distinguée ; l\'essentiel est le cours à la date de l\'opération, sourcé.',
      },
      {
        q: 'Un explorateur affiche « 1,000.00 USDT ». Combien d\'USDT ?',
        options: ['1 USDT', '1 000 USDT', '100 000 USDT', 'Impossible à dire'],
        answer: 1,
        explain: 'En notation anglo-saxonne, la virgule sépare les milliers et le point les décimales : mille USDT.',
      },
      {
        q: 'Combien de sun dans 3,5 TRX ?',
        options: ['3 500', '350 000', '3 500 000', '35 000 000'],
        answer: 2,
        explain: '1 TRX = 1 000 000 sun ; 3,5 TRX = 3 500 000 sun.',
      },
    ],
    flashcards: [
      { front: '1 BTC = ? sats', back: '100 000 000 (10^8).' },
      { front: '1 ETH = ? wei', back: '10^18 wei.' },
      { front: 'Gwei', back: '10^9 wei = 0,000000001 ETH. Sert au prix du gaz.' },
      { front: '1 TRX = ? sun', back: '1 000 000 (10^6).' },
      { front: '1 XRP = ? drops', back: '1 000 000 (10^6).' },
      { front: 'Décimales de l\'USDT sur Ethereum et Tron', back: '6.' },
      { front: 'Décimales de l\'USDT sur BNB Smart Chain', back: '18.' },
      { front: 'Formule du montant réel d\'un jeton', back: 'Montant brut / 10^décimales.' },
      { front: 'USDT vaut 1 € ?', back: 'Non : environ 1 dollar. Appliquer le taux EUR/USD du jour.' },
      { front: '1e-8 BTC', back: '0,00000001 BTC = 1 satoshi.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // ecosysteme-acteurs
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'ecosysteme-acteurs',
    title: 'L\'écosystème : qui fait quoi ?',
    level: 0,
    track: 'bases',
    minutes: 18,
    summary:
      "Mineurs et validateurs, exchanges régulés et offshore, échangeurs instantanés, courtiers OTC, DEX, bridges, mixeurs, émetteurs de stablecoins, régulateurs : la carte des acteurs que l'on croise dans une trace, et ce que chacun peut apporter (ou refuser) à l'enquête.",
    objectives: [
      'Vous saurez situer les principaux types d\'acteurs de l\'écosystème crypto et leur rôle.',
      'Vous saurez distinguer services centralisés (avec un interlocuteur) et protocoles décentralisés (sans interlocuteur).',
      'Vous saurez identifier, pour chaque type d\'acteur, le levier d\'enquête possible.',
      'Vous saurez situer le cadre réglementaire : PSAN, PSCA, MiCA, AMF, TRACFIN.',
    ],
    prerequisites: ['argent-numerique', 'cles-portefeuilles'],
    practice: ['first-trace', 'pig-butchering-tron'],
    blocks: [
      {
        type: 'text',
        md: `Une trace crypto ressemble à un trajet en ville : les fonds passent par des **rues** (des adresses de particuliers) et des **bâtiments** (des services). Certains bâtiments ont un accueil, des caméras et un registre des visiteurs ; d'autres sont de simples passages couverts sans personne.

Savoir **qui** se trouve derrière une adresse — un particulier, un exchange régulé, un programme automatique — détermine ce que l'on peut demander, à qui, et par quelle voie.`,
      },
      { type: 'heading', text: 'Les acteurs techniques' },
      {
        type: 'terms',
        items: [
          { term: 'Mineurs (preuve de travail)', def: 'Produisent les blocs Bitcoin et reçoivent la récompense. Souvent regroupés en pools de minage (ex. fictif : DeepPool). Rarement impliqués dans une affaire, mais une transaction « coinbase » signale de l\'argent fraîchement créé.' },
          { term: 'Validateurs (preuve d\'enjeu)', def: 'Produisent les blocs sur Ethereum, Tron, etc. Ils n\'ont pas de pouvoir sur une transaction particulière une fois celle-ci confirmée.' },
          { term: 'Nœuds', def: 'Ordinateurs qui conservent et vérifient le registre. Les explorateurs et les outils d\'analyse s\'appuient sur leurs propres nœuds.' },
          { term: 'Développeurs', def: 'Écrivent les logiciels et les smart contracts. Le déployeur d\'un contrat frauduleux est une cible d\'enquête.' },
          { term: 'Émetteurs de jetons', def: 'Sociétés qui créent des jetons, notamment les stablecoins (USDT, USDC). Elles peuvent geler des adresses.' },
        ],
      },
      { type: 'heading', text: 'Les services : la carte d\'enquête' },
      {
        type: 'table',
        headers: ['Catégorie', 'Rôle', 'Exemple (fictif)', 'Identification client', 'Levier d\'enquête'],
        rows: [
          ['Exchange régulé', 'Achat/vente contre euros, garde des fonds', 'Coinvault (France)', 'KYC complet', 'Réquisition directe, gel du compte'],
          ['Exchange mondial', 'Idem, très gros volumes', 'Binova, Kaizen', 'KYC standard', 'Portail dédié aux forces de l\'ordre'],
          ['Exchange UE', 'Agréé dans un autre État membre', 'Nordex (Estonie)', 'KYC standard', 'Coopération volontaire, DEE'],
          ['Exchange offshore', 'KYC allégé, juridiction lointaine', 'Huobex (Seychelles)', 'Faible', 'Réponses aléatoires'],
          ['Échangeur instantané', 'Swap d\'un actif à l\'autre sans compte', 'Ocelot Swap', 'Aucun en général', 'Parfois l\'adresse de destination et l\'IP de la commande'],
          ['Courtier OTC', 'Gros volumes de gré à gré, crypto ↔ espèces', 'SatsDesk OTC', 'Variable', 'Entraide internationale'],
          ['Plateforme P2P', 'Mise en relation entre particuliers, séquestre', 'LocalSats', 'Faible', 'Données de l\'annonce et des échanges'],
          ['Exchange décentralisé (DEX)', 'Échange par smart contract', 'OmniSwap, HelioSwap', 'Aucune', 'Aucun interlocuteur : on suit les événements on-chain'],
          ['Bridge', 'Transfert d\'une chaîne à une autre', 'ArcBridge', 'Aucune en général', 'Lecture des événements de part et d\'autre'],
          ['Mixeur', 'Brouillage volontaire des flux', 'Nebula Mixer', 'Aucune', 'Saisies d\'infrastructure, coopération internationale'],
          ['Émetteur de stablecoin', 'Crée et détruit les jetons', 'Émetteur USDT', 'Ne connaît pas les détenteurs', 'Gel des jetons sur une adresse'],
          ['Commerçants, casinos', 'Acceptent les cryptos', 'ShieldVPN, OrbitCasino', 'Variable', 'Données client, IP, courriel'],
        ],
        caption: 'Les noms sont ceux des exercices de SPECTRA. Dans la réalité, vérifiez toujours le statut réglementaire actuel du prestataire.',
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'Visualisez comment un exchange gère les fonds de ses clients : adresses de dépôt, balayage, hot wallet, cold wallet.',
      },
      {
        type: 'compare',
        left: {
          title: 'Centralisé (CeFi)',
          md: `- Une **société** identifiable exploite le service
- Elle détient les fonds (custodial)
- Elle a des obligations de lutte anti-blanchiment (**LCB-FT**)
- Elle peut répondre, identifier, geler
- Exemples : exchanges, échangeurs, courtiers OTC`,
        },
        right: {
          title: 'Décentralisé (DeFi)',
          md: `- Un **programme** (smart contract) exécute les opérations
- Personne ne détient les fonds des utilisateurs
- Pas de KYC, pas de service conformité
- Aucune réquisition possible sur le contrat lui-même
- En revanche : **tout** est visible on-chain`,
        },
      },
      {
        type: 'check',
        q: 'Les fonds de la victime ont été échangés sur un DEX (exchange décentralisé). À qui adresser une réquisition pour connaître l\'auteur de l\'échange ?',
        options: [
          'À la société qui a développé le DEX, qui connaît ses utilisateurs',
          'À personne en particulier : le DEX est un programme sans KYC ; on suit les fonds on-chain jusqu\'à un service identifiable',
          'Au validateur qui a produit le bloc',
          'À l\'émetteur du jeton, qui connaît les utilisateurs du DEX',
        ],
        answer: 1,
        explain: 'Un DEX est un smart contract : il n\'a ni compte client ni KYC. La transaction d\'échange est publique ; on suit le jeton obtenu jusqu\'au prochain service centralisé.',
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim' },
          { id: 'cv', label: 'Coinvault', kind: 'exchange', sub: 'Achat USDT' },
          { id: 's', label: 'Adresse escroc', kind: 'suspect', sub: 'Auto-hébergée' },
          { id: 'dex', label: 'HelioSwap', kind: 'dex', sub: 'USDT → TRX' },
          { id: 'br', label: 'ArcBridge', kind: 'bridge', sub: 'Tron → autre chaîne' },
          { id: 'otc', label: 'SatsDesk OTC', kind: 'service', sub: 'Conversion en espèces' },
          { id: 'k', label: 'Kaizen Exchange', kind: 'exchange', sub: 'Dépôt' },
        ],
        edges: [
          { from: 'v', to: 'cv', label: '20 000 €' },
          { from: 'cv', to: 's', label: '21 400 USDT' },
          { from: 's', to: 'dex', label: '8 000 USDT', dashed: true },
          { from: 'dex', to: 'br', label: 'TRX', dashed: true },
          { from: 's', to: 'otc', label: '6 000 USDT' },
          { from: 's', to: 'k', label: '7 380 USDT' },
        ],
        caption: 'Une même affaire traverse souvent plusieurs catégories d\'acteurs. Les branches en pointillé passent par des protocoles sans interlocuteur.',
      },
      { type: 'heading', text: 'Régulation : PSAN, PSCA et MiCA' },
      {
        type: 'callout',
        kind: 'law',
        title: 'Le cadre (à vérifier dans les textes en vigueur)',
        md: `- **PSAN** (prestataire de services sur actifs numériques) : statut français créé par la loi PACTE (2019), avec enregistrement obligatoire auprès de l'AMF pour certains services (conservation, achat/vente contre monnaie ayant cours légal, échange…).
- **MiCA** (règlement (UE) 2023/1114) : régime européen harmonisé. Les prestataires doivent obtenir un agrément de **PSCA** (prestataire de services sur crypto-actifs, *CASP* en anglais) dans un État membre, qui leur permet d'exercer dans toute l'Union (« passeport »). Les anciens PSAN ont bénéficié d'une période transitoire.
- **Règlement « transfert de fonds »** (règlement (UE) 2023/1113) : impose aux PSCA de transmettre les informations sur l'émetteur et le bénéficiaire des transferts de crypto-actifs (*travel rule*).
- **LCB-FT** : les prestataires identifient leurs clients, conservent les données (en principe cinq ans) et déclarent leurs soupçons à **TRACFIN**.

Consultez les listes publiques de l'AMF pour connaître le statut d'un prestataire à une date donnée.`,
      },
      {
        type: 'table',
        headers: ['Autorité / organisme', 'Rôle utile à l\'enquêteur'],
        rows: [
          ['AMF', 'Agrément et liste des PSAN/PSCA ; listes noires de sites non autorisés'],
          ['ACPR', 'Supervision bancaire ; avis dans l\'agrément des prestataires ; émetteurs de monnaie électronique'],
          ['TRACFIN', 'Cellule de renseignement financier : reçoit les déclarations de soupçon des prestataires'],
          ['AGRASC', 'Gestion des avoirs saisis et confisqués, y compris crypto-actifs'],
          ['Europol (EC3), Eurojust', 'Coordination des enquêtes transfrontalières dans l\'UE'],
          ['Autorités de sanctions (UE, ONU, OFAC américain)', 'Listes d\'entités et d\'adresses sanctionnées'],
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Services imbriqués et entités sanctionnées',
        md: `Un échangeur sans KYC ou un courtier OTC peut détenir un compte chez un grand exchange : les fonds de ses propres clients transitent alors par ce compte. On parle de **service imbriqué** (*nested service*). La réquisition à l'exchange désignera le service, pas l'utilisateur final.

Certaines plateformes (comme **Grantis** dans les exercices) sont **sanctionnées** : aucune coopération n'est à attendre, mais l'exposition à ces entités est un signal fort à documenter et à signaler.`,
      },
      {
        type: 'case',
        title: 'Cas : qui réquisitionner ?',
        md: `Les 21 400 USDT d'une victime ont été répartis en trois branches :

- **7 380 USDT** déposés sur une adresse de dépôt **Kaizen Exchange** (Singapour) : réquisition via le portail de l'exchange, avec le hash de la transaction de dépôt ; demande de gel du compte.
- **6 000 USDT** envoyés à **SatsDesk OTC** (Hong Kong) : pas de réquisition directe possible ; entraide pénale internationale à envisager, plus longue.
- **8 000 USDT** échangés sur **HelioSwap** (DEX) contre des TRX puis passés par **ArcBridge** : aucun interlocuteur ; il faut lire les événements du bridge pour retrouver les fonds sur la chaîne d'arrivée.

Trois catégories d'acteurs, trois stratégies différentes. Et une priorité : tant que des USDT restent sur une adresse auto-hébergée, une demande de **gel à l'émetteur** est possible.`,
      },
      {
        type: 'check',
        q: 'Quel acteur peut geler des USDT détenus sur un portefeuille auto-hébergé ?',
        options: ['Le validateur Tron', 'L\'émetteur de l\'USDT', 'Le DEX', 'Personne'],
        answer: 1,
        explain: 'L\'émetteur d\'un stablecoin centralisé peut inscrire une adresse sur liste noire dans son contrat : les jetons y sont alors bloqués, même sans intermédiaire.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : le statut d\'un prestataire conditionne la voie',
        md: `Prestataire établi en France : réquisition directe. Prestataire dans un autre État de l'UE : coopération volontaire possible, décision d'enquête européenne (DEE) pour les éléments complets. Hors UE : portail volontaire quand il existe, sinon demande d'entraide pénale internationale. Le temps de réponse passe de quelques jours à plusieurs mois : anticipez.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'PSAN', def: 'Prestataire de services sur actifs numériques : statut français issu de la loi PACTE (2019).' },
          { term: 'PSCA (CASP)', def: 'Prestataire de services sur crypto-actifs agréé au titre de MiCA, avec passeport européen.' },
          { term: 'KYC', def: 'Know Your Customer : vérification de l\'identité du client.' },
          { term: 'LCB-FT', def: 'Lutte contre le blanchiment et le financement du terrorisme.' },
          { term: 'OTC', def: 'Over the counter : échange de gré à gré, souvent gros volumes, parfois contre espèces.' },
          { term: 'DEX', def: 'Exchange décentralisé : smart contract qui échange des jetons sans intermédiaire.' },
          { term: 'Service imbriqué', def: 'Service qui opère via un compte ouvert chez un autre prestataire.' },
        ],
      },
    ],
    keyPoints: [
      'Chaque type d\'acteur appelle un levier différent : réquisition, portail, entraide, ou simple lecture on-chain.',
      'Les services centralisés connaissent leurs clients ; les protocoles décentralisés n\'ont aucun interlocuteur.',
      'Les émetteurs de stablecoins peuvent geler des jetons, même sur un portefeuille auto-hébergé.',
      'MiCA impose un agrément PSCA ; l\'AMF publie les listes de prestataires autorisés.',
      'Les prestataires conservent les données clients et déclarent leurs soupçons à TRACFIN.',
      'Attention aux services imbriqués : le « client » d\'un exchange peut être un autre service.',
    ],
    quiz: [
      {
        q: 'Quel acteur n\'a, par nature, aucune donnée d\'identification sur ses utilisateurs ?',
        options: ['Un exchange régulé', 'Un exchange décentralisé (DEX)', 'Un courtier OTC', 'Une plateforme P2P'],
        answer: 1,
        explain: 'Un DEX est un smart contract : pas de compte, pas de KYC. Les autres acteurs, même peu regardants, détiennent au moins quelques données.',
      },
      {
        kind: 'multi',
        q: 'Quelles obligations pèsent sur un prestataire agréé en matière de LCB-FT ? (plusieurs réponses)',
        options: [
          'Identifier ses clients',
          'Conserver les données pendant une durée réglementaire',
          'Déclarer ses soupçons à TRACFIN',
          'Publier l\'identité de ses clients sur la blockchain',
        ],
        answer: [0, 1, 2],
        explain: 'Identification, conservation et déclaration de soupçon sont au cœur du dispositif. Rien n\'est publié sur la blockchain.',
      },
      {
        q: 'Que permet l\'agrément PSCA obtenu dans un État membre de l\'UE ?',
        options: [
          'Exercer uniquement dans cet État',
          'Exercer dans toute l\'Union grâce au passeport européen',
          'Ignorer les réquisitions étrangères',
          'Émettre des stablecoins sans autorisation',
        ],
        answer: 1,
        explain: 'MiCA instaure un passeport : un PSCA agréé dans un État membre peut fournir ses services dans les autres.',
      },
      {
        kind: 'truefalse',
        q: 'Un courtier OTC situé hors de l\'Union européenne répond toujours à une réquisition française directe.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Hors UE, la coopération dépend du prestataire (portail volontaire) ou passe par l\'entraide pénale internationale, souvent longue.',
      },
      {
        q: 'Qu\'est-ce qu\'un service imbriqué (nested service) ?',
        options: [
          'Un exchange qui possède plusieurs hot wallets',
          'Un service qui opère au moyen d\'un compte ouvert chez un autre prestataire',
          'Un smart contract qui appelle un autre contrat',
          'Un portefeuille matériel',
        ],
        answer: 1,
        explain: 'Les flux de ses clients transitent par son compte chez l\'exchange hôte : la réquisition révélera le service, pas l\'utilisateur final.',
      },
      {
        q: 'Quelle autorité publie la liste des prestataires sur crypto-actifs autorisés en France ?',
        options: ['TRACFIN', 'L\'AMF', 'L\'AGRASC', 'Europol'],
        answer: 1,
        explain: 'L\'AMF enregistre/agrée les prestataires et publie leur liste, ainsi que des listes noires de sites non autorisés.',
      },
      {
        q: 'Un échangeur instantané comme Ocelot Swap, sans KYC, peut-il tout de même être utile à l\'enquête ?',
        options: [
          'Non, jamais',
          'Oui : il peut parfois fournir l\'adresse de destination et l\'adresse IP associées à une commande, sur la base du hash de dépôt',
          'Oui, il fournit toujours l\'identité complète',
          'Non, car il est décentralisé',
        ],
        answer: 1,
        explain: 'Même sans KYC, un service centralisé enregistre des données techniques (commande, IP, adresse de retour) qui peuvent faire avancer la trace.',
      },
    ],
    flashcards: [
      { front: 'CeFi vs DeFi', back: 'CeFi : société identifiable, custodial, KYC. DeFi : smart contract, aucun interlocuteur, tout visible on-chain.' },
      { front: 'PSCA', back: 'Prestataire de services sur crypto-actifs agréé au titre de MiCA (passeport européen).' },
      { front: 'Loi PACTE (2019)', back: 'A créé le statut français de PSAN.' },
      { front: 'Travel rule', back: 'Obligation pour les prestataires de transmettre les informations émetteur/bénéficiaire des transferts (règlement (UE) 2023/1113).' },
      { front: 'TRACFIN', back: 'Cellule de renseignement financier française : reçoit les déclarations de soupçon.' },
      { front: 'Échangeur instantané', back: 'Swap sans compte : on dépose un actif, on reçoit un autre actif. KYC souvent absent.' },
      { front: 'Courtier OTC', back: 'Gré à gré, gros volumes, parfois contre espèces. Souvent hors UE.' },
      { front: 'Qui peut geler des USDT sur un portefeuille auto-hébergé ?', back: 'L\'émetteur de l\'USDT (liste noire dans le contrat).' },
      { front: 'Service imbriqué', back: 'Service opérant via un compte chez un autre prestataire.' },
      { front: 'Prestataire hors UE', back: 'Portail volontaire si disponible, sinon entraide pénale internationale.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // explorateur-blocs
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'explorateur-blocs',
    title: 'Lire un explorateur de blocs',
    level: 0,
    track: 'methodo',
    minutes: 20,
    summary:
      "L'explorateur de blocs est le premier outil de l'enquêteur : un moteur de recherche du registre. Choisir le bon explorateur, reconnaître ce que l'on cherche (adresse, hash, bloc), lire une page d'adresse et une page de transaction, se méfier des étiquettes et conserver la preuve.",
    objectives: [
      'Vous saurez choisir l\'explorateur adapté à une adresse ou à un hash donné.',
      'Vous saurez distinguer une adresse d\'un identifiant de transaction et d\'un numéro de bloc.',
      'Vous saurez lire les informations clés d\'une page d\'adresse et d\'une page de transaction (Bitcoin et Ethereum/Tron).',
      'Vous saurez conserver vos constatations de manière probante et discrète.',
    ],
    prerequisites: ['bases-blockchain', 'unites-ordres'],
    practice: ['first-trace', 'eth-first'],
    blocks: [
      {
        type: 'text',
        md: `Un **explorateur de blocs** est un site web qui lit la blockchain et la présente de façon compréhensible. On y tape une adresse, un identifiant de transaction ou un numéro de bloc, et il affiche les informations correspondantes. Aucune inscription n'est nécessaire, aucune réquisition non plus.

C'est l'outil de base : avant tout logiciel d'analyse spécialisé, savoir lire un explorateur permet de vérifier une plainte, de suivre quelques sauts, et de contrôler ce qu'affichent les outils.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'id', label: 'Identifiant reçu', kind: 'unknown', sub: 'Adresse, hash ou bloc' },
          { id: 'ch', label: 'Chaîne identifiée', kind: 'tx', sub: 'Préfixe, longueur, contexte' },
          { id: 'ex', label: 'Explorateur adapté', kind: 'service', sub: 'Tronscan, Etherscan, mempool.space…' },
          { id: 'lu', label: 'Lecture', kind: 'tx', sub: 'Montants, dates UTC, contreparties' },
          { id: 'pv', label: 'Constatation probante', kind: 'service', sub: 'Export, références, empreinte' },
        ],
        edges: [
          { from: 'id', to: 'ch', label: 'étape 1' },
          { from: 'ch', to: 'ex', label: 'étape 2' },
          { from: 'ex', to: 'lu', label: 'étapes 3-4' },
          { from: 'lu', to: 'pv', label: 'conserver' },
        ],
        caption: 'Le cheminement de toute consultation d\'explorateur, détaillé dans cette leçon.',
      },
      { type: 'heading', text: 'Étape 1 : identifier la blockchain' },
      {
        type: 'text',
        md: `Chaque explorateur ne connaît en général qu'**une** blockchain (ou une famille). Il faut donc d'abord déterminer la chaîne à partir du format de l'identifiant. Le préfixe et la longueur d'une adresse sont très parlants.`,
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Collez ou choisissez une adresse : le simulateur indique la chaîne probable et le type d\'adresse d\'après son préfixe et sa longueur.',
      },
      {
        type: 'table',
        headers: ['Identifiant', 'Format', 'Exemple (tronqué)', 'Chaîne'],
        rows: [
          ['Adresse Bitcoin', 'Commence par 1, 3 ou bc1 ; 26 à 62 caractères', '`bc1qx7m2…8sdkfm`', 'Bitcoin'],
          ['Adresse EVM', '0x + 40 caractères hexadécimaux', '`0x7a3f…c41e`', 'Ethereum, BNB Chain, Polygon, Arbitrum, Base…'],
          ['Adresse Tron', 'Commence par T ; 34 caractères', '`TQm4…8vRd`', 'Tron'],
          ['Adresse XRP', 'Commence par r ; 25 à 35 caractères', '`rN7n…Kp3Q`', 'XRP Ledger'],
          ['Adresse Solana', '32 à 44 caractères base58, sans préfixe fixe', '`7xKX…AsU`', 'Solana'],
          ['Txid Bitcoin', '64 caractères hexadécimaux, sans 0x', '`4e1f…a9c2`', 'Bitcoin'],
          ['Hash de transaction EVM', '0x + 64 caractères hexadécimaux', '`0x9c2d…71be`', 'Chaînes EVM'],
          ['Hash de transaction Tron', '64 caractères hexadécimaux, sans 0x', '`b31a…0f7d`', 'Tron'],
        ],
        caption: 'Attention : un txid Bitcoin et un hash Tron ont le même format. Le contexte (actif, application utilisée par la victime) tranche.',
      },
      {
        type: 'check',
        q: 'On vous transmet l\'identifiant « 0x » suivi de 64 caractères hexadécimaux. De quoi s\'agit-il ?',
        options: [
          'D\'une adresse Ethereum',
          'D\'un hash de transaction sur une chaîne EVM',
          'D\'une adresse Tron',
          'D\'une clé privée Bitcoin',
        ],
        answer: 1,
        explain: 'Une adresse EVM fait 0x + 40 caractères ; 0x + 64 caractères correspond à un hash (transaction ou bloc). Attention : une clé privée a aussi 64 caractères hexadécimaux ; si l\'on vous transmet une telle valeur hors contexte, demandez sa provenance.',
      },
      { type: 'heading', text: 'Étape 2 : choisir l\'explorateur' },
      {
        type: 'table',
        headers: ['Chaîne', 'Explorateurs publics courants', 'Remarque'],
        rows: [
          ['Bitcoin', 'mempool.space, blockstream.info', 'mempool.space montre aussi la file d\'attente et les frais'],
          ['Ethereum', 'Etherscan, Blockscout', 'Onglets « Token transfers » et « Internal transactions » essentiels'],
          ['BNB Smart Chain', 'BscScan', 'Même interface qu\'Etherscan'],
          ['Tron', 'Tronscan', 'Onglet des transferts de jetons TRC-20'],
          ['Solana', 'Solscan, Solana Explorer', 'Une transaction contient souvent de nombreuses instructions'],
          ['XRP Ledger', 'XRPScan, Bithomp', 'Afficher le destination tag'],
          ['Multi-chaînes', 'Blockchair', 'Pratique pour une première orientation'],
        ],
        caption: 'Croisez au moins deux sources pour toute donnée qui fondera un acte.',
      },
      { type: 'heading', text: 'Étape 3 : lire une page d\'adresse' },
      {
        type: 'steps',
        items: [
          { title: 'Solde et volumes', md: 'Solde actuel, total reçu, total envoyé. Rappel : une adresse n\'est qu\'une partie d\'un portefeuille.' },
          { title: 'Nombre de transactions', md: 'Quelques transactions : adresse jetable ou personnelle. Des milliers : probablement un service.' },
          { title: 'Première et dernière activité', md: 'Délimitent la période d\'utilisation. Une adresse créée la veille de l\'escroquerie et vidée le lendemain est typique d\'un intermédiaire.' },
          { title: 'Liste des transactions', md: 'Repérez la transaction de la victime (montant, date), puis les sorties qui suivent.' },
          { title: 'Onglets spécifiques (EVM/Tron)', md: 'Transactions natives, transferts de jetons, transactions internes : un solde de 0 ETH n\'exclut pas des milliers d\'USDT.' },
          { title: 'Étiquettes', md: 'Notez toute étiquette affichée (« Binova: Hot Wallet », « Phishing »…) et sa source, sans la tenir pour acquise.' },
        ],
      },
      { type: 'heading', text: 'Étape 4 : lire une page de transaction' },
      {
        type: 'compare',
        left: {
          title: 'Transaction Bitcoin (modèle UTXO)',
          md: `- Une liste d'**entrées** (à gauche) et de **sorties** (à droite)
- Les entrées consomment entièrement des fonds reçus auparavant
- Une sortie est souvent le **rendu** renvoyé à l'émetteur
- Les **frais** = total des entrées − total des sorties
- Pas de jetons (dans l'usage courant)`,
        },
        right: {
          title: 'Transaction Ethereum / Tron (modèle à comptes)',
          md: `- Un **from** (émetteur) et un **to** (destinataire ou contrat)
- Un champ **value** en monnaie native (ETH, TRX)
- Les transferts de **jetons** figurent dans les événements, pas dans value
- Les frais sont payés en gaz (ETH) ou en ressources (énergie, bande passante sur Tron)
- Statut : succès ou **échec** (une transaction échouée a quand même coûté des frais)`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Piège : la transaction « à 0 ETH »',
        md: `Sur Etherscan, une transaction peut afficher **value : 0 ETH** et pourtant déplacer 25 000 USDT. Dans ce cas, le champ **to** est l'adresse du **contrat USDT**, et le véritable destinataire apparaît dans la section des transferts de jetons (*ERC-20 Tokens Transferred*). Il en va de même sur Tronscan. Lisez toujours l'ensemble de la page.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Étiquettes et fuseaux horaires',
        md: `- Les **étiquettes** affichées par un explorateur proviennent de sources variées (l'opérateur de l'explorateur, des signalements d'utilisateurs, des partenaires). Elles peuvent être incomplètes, anciennes ou fausses : ce sont des **indices**.
- Certains explorateurs affichent l'heure dans le **fuseau de votre navigateur** ou en temps relatif (« il y a 3 jours »). Vérifiez le réglage et convertissez tout en **UTC** dans vos écrits.`,
      },
      {
        type: 'case',
        title: 'Cas : vérifier une plainte en dix minutes',
        md: `M. R. déclare avoir envoyé « 5 000 USDT sur Tron » le 3 mars à 14 h (heure de Paris) vers l'adresse \`TQm4…8vRd\` fournie par un faux conseiller. Il transmet une capture de son application.

1. Le format (T…, 34 caractères) confirme une adresse **Tron** : on ouvre Tronscan.
2. Dans l'onglet des transferts TRC-20 de l'adresse, on trouve un transfert entrant de **5 000 USDT** le 3 mars à **13:02 UTC**, soit 14 h 02 à Paris (heure d'hiver) : cohérent.
3. On vérifie que le jeton est l'USDT **officiel** (contrat \`TR7NHq…Lj6t\`) et non une imitation.
4. On relève le hash de la transaction, la hauteur de bloc et l'adresse émettrice (celle de M. R.).
5. On observe que \`TQm4…8vRd\` a renvoyé **4 998 USDT** vingt minutes plus tard vers une autre adresse : premier saut de la trace.
6. On exporte la page en PDF, on la confronte à un second explorateur, on consigne l'heure de consultation.`,
      },
      { type: 'heading', text: 'Conserver la preuve' },
      {
        type: 'steps',
        items: [
          { title: 'Exporter', md: 'Impression PDF horodatée des pages consultées, export CSV des listes de transactions quand l\'explorateur le permet.' },
          { title: 'Référencer', md: 'Notez l\'URL, l\'explorateur, la date et l\'heure de consultation, le txid et la hauteur de bloc.' },
          { title: 'Croiser', md: 'Vérifiez les données essentielles (montant, date, adresses) sur un second explorateur.' },
          { title: 'Garantir l\'intégrité', md: 'Calculez et consignez l\'empreinte (SHA-256) des fichiers exportés.' },
          { title: 'Rendre reproductible', md: 'Un collègue doit pouvoir refaire chaque constatation à partir de vos références.' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : discrétion',
        md: `Consulter un explorateur transmet votre adresse IP à son opérateur, et l'adresse recherchée apparaît dans ses journaux. Utilisez les moyens institutionnels prévus par votre service (poste dédié, connexion adaptée), ne vous connectez pas avec un compte personnel, et n'utilisez jamais les fonctions d'interaction (envoi, connexion d'un portefeuille). N'envoyez **jamais** de fonds, même minimes, à une adresse suspecte.`,
      },
      {
        type: 'widget',
        id: 'unit-converter',
        caption: 'Les explorateurs n\'appliquent pas toujours les décimales : vérifiez vos conversions avant de les reporter.',
      },
      {
        type: 'check',
        q: 'Une page Etherscan indique « value : 0 ETH » pour une transaction dont le « to » est le contrat USDC. Que faire ?',
        options: [
          'Conclure qu\'aucun fonds n\'a bougé',
          'Consulter la section des transferts de jetons pour lire le destinataire et le montant réels',
          'Considérer que la transaction a échoué',
          'Chercher le rendu',
        ],
        answer: 1,
        explain: 'Les transferts de jetons apparaissent dans les événements. Le champ value ne concerne que l\'ETH natif.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Explorateur de blocs', def: 'Site qui présente le contenu d\'une blockchain : adresses, transactions, blocs.' },
          { term: 'Txid / hash de transaction', def: 'Identifiant unique d\'une transaction (64 caractères hexadécimaux, préfixés de 0x sur EVM).' },
          { term: 'From / To', def: 'Émetteur et destinataire (ou contrat appelé) d\'une transaction en modèle à comptes.' },
          { term: 'Value', def: 'Montant en monnaie native transféré par une transaction EVM ou Tron.' },
          { term: 'Token transfers', def: 'Onglet listant les mouvements de jetons, issus des événements des contrats.' },
          { term: 'Étiquette (label)', def: 'Nom attribué à une adresse par l\'explorateur ou un outil. Indice, pas preuve.' },
        ],
      },
    ],
    keyPoints: [
      'Identifier la chaîne d\'après le format avant de choisir l\'explorateur.',
      'Adresse EVM = 0x + 40 hexa ; hash de transaction EVM = 0x + 64 hexa ; txid Bitcoin = 64 hexa sans 0x.',
      'Sur EVM et Tron, les jetons apparaissent dans les transferts de jetons, pas dans le champ value.',
      'Étiquettes = indices ; heures à convertir en UTC.',
      'Exporter, référencer, croiser deux explorateurs, hacher les exports.',
      'Ne jamais interagir avec une adresse suspecte ; consulter avec des moyens adaptés.',
    ],
    quiz: [
      {
        q: 'Quel explorateur utiliser pour l\'adresse « TQm4…8vRd » (34 caractères) ?',
        options: ['mempool.space', 'Etherscan', 'Tronscan', 'XRPScan'],
        answer: 2,
        explain: 'Une adresse commençant par T et longue de 34 caractères est une adresse Tron.',
      },
      {
        q: 'Une valeur de 64 caractères hexadécimaux sans préfixe vous est transmise dans une affaire Bitcoin. De quoi s\'agit-il le plus probablement ?',
        options: ['D\'une adresse Bitcoin', 'D\'un txid Bitcoin', 'D\'une adresse Ethereum', 'D\'un montant en satoshis'],
        answer: 1,
        explain: 'Le txid Bitcoin fait 64 caractères hexadécimaux. Les adresses Bitcoin commencent par 1, 3 ou bc1.',
      },
      {
        kind: 'multi',
        q: 'Sur une page d\'adresse Ethereum, quels onglets consulter pour ne rien rater ? (plusieurs réponses)',
        options: [
          'Les transactions (natives)',
          'Les transferts de jetons (ERC-20)',
          'Les transactions internes',
          'Uniquement le solde affiché en haut de page',
        ],
        answer: [0, 1, 2],
        explain: 'Le solde en ETH ne reflète ni les jetons ni les mouvements effectués par des contrats. Les trois onglets sont nécessaires.',
      },
      {
        kind: 'truefalse',
        q: 'Une étiquette « Hot Wallet » affichée par un explorateur suffit à établir en procédure que l\'adresse appartient à l\'exchange.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'C\'est un indice, à citer avec sa source et à confirmer (réquisition, recoupements).',
      },
      {
        q: 'Une victime situe sa transaction à 15 h 30, heure de Paris, en juillet. Quelle heure UTC s\'attend-on à lire ?',
        options: ['15:30 UTC', '14:30 UTC', '13:30 UTC', '17:30 UTC'],
        answer: 2,
        explain: 'En été, Paris est à UTC+2 : 15 h 30 à Paris = 13:30 UTC. En hiver (UTC+1), ce serait 14:30 UTC.',
      },
      {
        q: 'Quelle pratique garantit le mieux l\'intégrité de vos constatations sur un explorateur ?',
        options: [
          'Faire une capture d\'écran sans la dater',
          'Exporter en PDF, noter URL, date et heure, croiser avec un second explorateur et consigner l\'empreinte SHA-256 du fichier',
          'Recopier les montants à la main',
          'Envoyer une petite somme à l\'adresse pour vérifier qu\'elle existe',
        ],
        answer: 1,
        explain: 'Export, références, croisement et empreinte rendent la constatation vérifiable. Envoyer des fonds est proscrit.',
      },
      {
        q: 'Sur Etherscan, une transaction a le statut « Fail ». Que s\'est-il passé ?',
        options: [
          'Les fonds ont été transférés malgré tout',
          'L\'opération n\'a pas abouti (aucun transfert), mais l\'émetteur a quand même payé des frais de gaz',
          'La transaction est toujours dans le mempool',
          'L\'exchange a annulé le dépôt',
        ],
        answer: 1,
        explain: 'Une transaction échouée est incluse dans un bloc mais son effet est annulé ; seuls les frais sont prélevés. Ne la comptez pas comme un flux.',
      },
    ],
    flashcards: [
      { front: 'Explorateur Bitcoin courant', back: 'mempool.space (et blockstream.info).' },
      { front: 'Explorateur Tron', back: 'Tronscan.' },
      { front: 'Explorateur Ethereum', back: 'Etherscan (et Blockscout).' },
      { front: 'Adresse EVM', back: '0x + 40 caractères hexadécimaux.' },
      { front: 'Hash de transaction EVM', back: '0x + 64 caractères hexadécimaux.' },
      { front: 'Txid Bitcoin', back: '64 caractères hexadécimaux, sans préfixe.' },
      { front: 'Value = 0 ETH vers un contrat de jeton', back: 'Probablement un transfert de jetons : lire les « token transfers ».' },
      { front: 'Transaction « Fail »', back: 'Aucun transfert effectif, mais frais de gaz payés.' },
      { front: 'Quatre gestes de conservation', back: 'Exporter, référencer (URL, date, txid, bloc), croiser, hacher.' },
      { front: 'Paris en été / en hiver', back: 'UTC+2 en été, UTC+1 en hiver.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // premiers-reflexes
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'premiers-reflexes',
    title: 'L\'enquête crypto en dix réflexes',
    level: 0,
    track: 'enquete',
    minutes: 20,
    summary:
      "Dix réflexes pour bien démarrer toute affaire impliquant des crypto-actifs : recueillir les bons identifiants dès la plainte, identifier chaîne et actif, partir de la transaction de la victime, suivre l'argent jusqu'aux services, agir vite sur ce qui est gelable, réquisitionner avec précision, et tout documenter.",
    objectives: [
      'Vous saurez quelles informations recueillir dès l\'audition de la victime.',
      'Vous saurez dérouler les premières vérifications on-chain dans le bon ordre.',
      'Vous saurez identifier les urgences (gel, conservation) et les bons interlocuteurs.',
      'Vous saurez distinguer fait établi, indice et hypothèse dans vos écrits.',
    ],
    prerequisites: ['bases-blockchain', 'explorateur-blocs', 'ecosysteme-acteurs'],
    practice: ['first-trace', 'pig-butchering-tron', 'eth-first'],
    blocks: [
      {
        type: 'text',
        md: `Les affaires crypto se gagnent ou se perdent souvent dans les **premières heures** : une adresse mal recopiée, un réseau non demandé, un gel sollicité trop tard, et la trace se perd. Les dix réflexes qui suivent ne demandent aucun outil spécialisé. Ils structurent la suite de l'Académie : chacun renvoie à des leçons plus approfondies.`,
      },
      { type: 'heading', text: 'Les dix réflexes' },
      {
        type: 'steps',
        items: [
          { title: '1. Recueillir les identifiants exacts', md: 'Adresses, hash de transaction, captures de l\'application, nom de la plateforme d\'achat, actif, réseau, montants, dates et heures. Faites **copier-coller** ou exporter : jamais de recopie manuscrite d\'une adresse.' },
          { title: '2. Identifier la chaîne et l\'actif', md: 'Format de l\'adresse, réseau choisi dans l\'application (« TRC20 », « ERC20 »…), contrat du jeton. USDT sur Tron et USDT sur Ethereum sont deux traces distinctes.' },
          { title: '3. Vérifier sur deux explorateurs, en UTC', md: 'Confirmez que la transaction existe, qu\'elle est confirmée, et que montant et date correspondent aux déclarations.' },
          { title: '4. Partir de la transaction de la victime', md: 'C\'est le seul point d\'ancrage certain. Elle fixe l\'adresse de départ de l\'auteur et le montant à suivre.' },
          { title: '5. Suivre l\'argent, un saut à la fois', md: 'Pour chaque saut : txid, montant, date, adresse suivante, raison du choix. Tenez un journal de traçage.' },
          { title: '6. Repérer les services', md: 'Exchanges, échangeurs, émetteurs de stablecoins : ce sont les points où l\'identification et le blocage deviennent possibles.' },
          { title: '7. Agir vite sur ce qui est gelable', md: 'Stablecoins encore sur une adresse de l\'auteur : demande de gel à l\'émetteur. Fonds arrivés chez un exchange : demande de gel du compte.' },
          { title: '8. Réquisitionner avec précision', md: 'Chaîne, actif, adresse, txid, montant exact, horodatage UTC, sens du flux (dépôt/retrait), données demandées.' },
          { title: '9. Ne jamais interagir, rester discret', md: 'Aucun envoi de fonds, aucun contact avec l\'auteur via les outils de la victime sans cadre, consultation des explorateurs avec des moyens adaptés.' },
          { title: '10. Tout documenter', md: 'Exports, références, empreintes, méthode. Distinguez dans vos écrits ce qui est établi, ce qui est probable et ce qui est supposé.' },
        ],
      },
      { type: 'heading', text: 'Réflexe 1 en détail : la plainte' },
      {
        type: 'table',
        headers: ['À recueillir', 'Pourquoi'],
        rows: [
          ['Plateforme d\'achat (Coinvault…) et relevés bancaires', 'Point d\'entrée ; réquisition pour obtenir le retrait et son hash'],
          ['Adresse(s) de destination, copiée(s) ou en capture', 'Départ de la trace côté auteur'],
          ['Hash de chaque transaction', 'Référence unique ; évite toute confusion entre opérations'],
          ['Actif et réseau (ex. « USDT réseau TRC20 »)', 'Détermine la chaîne et l\'explorateur'],
          ['Dates et heures, avec le fuseau', 'Recoupement avec la blockchain'],
          ['Adresse du portefeuille de la victime', 'Permet de retrouver toutes ses opérations, y compris oubliées'],
          ['Sites, applications, contacts (numéros, pseudos, URL)', 'OSINT, rapprochement d\'affaires, réquisitions techniques'],
          ['Saisie éventuelle de la phrase de récupération', 'Date réelle de compromission en cas de vol'],
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : l\'audition',
        md: `Les victimes confondent souvent plateforme, actif et réseau (« j'ai envoyé sur Binance » peut signifier : depuis, vers, ou via une adresse fournie par l'escroc). Faites-vous **montrer** l'application, l'historique des retraits et le détail de chaque opération. Demandez si d'autres versements ont eu lieu, y compris des « frais de déblocage » : ils sont fréquents et allongent la trace.`,
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Réflexe 2 : identifiez la chaîne à partir de l\'adresse fournie par la victime.',
      },
      {
        type: 'check',
        q: 'Une victime dit avoir envoyé « des USDT » à l\'escroc, sans plus de précision. Quelle information est indispensable pour commencer ?',
        options: [
          'Le cours de l\'USDT ce jour-là',
          'Le réseau utilisé (Tron, Ethereum, BNB Chain…), l\'adresse de destination et si possible le hash',
          'Le nom de l\'émetteur de l\'USDT',
          'Le modèle de son téléphone',
        ],
        answer: 1,
        explain: 'L\'USDT existe sur plusieurs chaînes. Sans le réseau et l\'adresse, impossible de savoir quel explorateur consulter ni quoi suivre.',
      },
      { type: 'heading', text: 'De la plainte à l\'identification' },
      {
        type: 'flow',
        nodes: [
          { id: 'p', label: 'Plainte', kind: 'victim', sub: 'Identifiants recueillis' },
          { id: 't', label: 'Tx de la victime', kind: 'tx', sub: 'Point d\'ancrage' },
          { id: 's1', label: 'Adresse de collecte', kind: 'suspect', sub: 'Auteur' },
          { id: 's2', label: 'Adresse intermédiaire', kind: 'wallet' },
          { id: 'd', label: 'Dépôt Binova', kind: 'deposit', sub: 'Client identifiable' },
          { id: 'r', label: 'Réquisition', kind: 'service', sub: 'Identité, IP, historique' },
        ],
        edges: [
          { from: 'p', to: 't', label: 'vérification' },
          { from: 't', to: 's1', label: '5 000 USDT' },
          { from: 's1', to: 's2', label: '4 998 USDT' },
          { from: 's2', to: 'd', label: '4 998 USDT' },
          { from: 'd', to: 'r', label: 'txid + adresse', dashed: true },
        ],
        caption: 'Le schéma type : quelques sauts on-chain, puis un service qui connaît son client.',
      },
      { type: 'heading', text: 'Les urgences' },
      {
        type: 'table',
        headers: ['Situation', 'Délai d\'action', 'Interlocuteur'],
        rows: [
          ['USDT/USDC encore sur une adresse de l\'auteur', 'Heures', 'Émetteur du stablecoin (portail dédié aux forces de l\'ordre)'],
          ['Fonds déposés chez un exchange', 'Heures à jours', 'Exchange : gel du compte, puis réquisition'],
          ['Seed découverte en perquisition', 'Immédiat', 'Magistrat, enquêteurs spécialisés'],
          ['Données de connexion du compte de l\'auteur', 'Semaines à mois', 'Prestataire (conservation limitée dans le temps)'],
          ['Fonds passés par un mixeur ou un bridge', 'Analyse approfondie', 'Unités spécialisées (niveaux 3 et 4)'],
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Réquisitions : les bases (à vérifier dans les textes en vigueur)',
        md: `- **Enquête de flagrance** : réquisitions de l'officier de police judiciaire sur le fondement de l'**article 60-1 du CPP**.
- **Enquête préliminaire** : **article 77-1-1 du CPP**, avec l'autorisation du procureur de la République.
- **Information judiciaire** : **article 99-3 du CPP**, par le juge d'instruction ou l'OPJ commis rogatoirement.
- **Prestataire étranger** : coopération volontaire via un portail lorsqu'elle existe ; dans l'UE, décision d'enquête européenne ; hors UE, demande d'entraide pénale internationale.

La leçon « Réquisitions aux prestataires » (niveau 2) détaille le contenu et la rédaction.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Fait établi',
          md: `- « La transaction \`4e1f…a9c2\`, bloc 868 412, a transféré 0,349 BTC de l'adresse A vers l'adresse B le 14/10/2024 à 10:12 UTC. »
- « Binova indique, en réponse à réquisition, que l'adresse B est attribuée au compte de M. X. »`,
        },
        right: {
          title: 'Indice ou hypothèse',
          md: `- « L'outil X attribue l'adresse B à Binova (non vérifié). »
- « La sortie de 0,12 BTC est **probablement** le rendu (heuristique du type d'adresse). »
- « Les adresses A et C sont **vraisemblablement** contrôlées par la même personne. »`,
        },
      },
      {
        type: 'case',
        title: 'Cas : romance et faux trading',
        md: `**J0.** Mme T. dépose plainte : rencontrée sur un réseau social, une personne l'a convaincue d'investir sur « AuroraTrade ». Elle a envoyé en six semaines **38 500 USDT** sur Tron, en sept versements, à l'adresse indiquée dans l'interface de la plateforme. Le retrait de ses « gains » lui est refusé sans paiement de « taxes ».

**J0 + 2 h.** Identifiants recueillis : sept hash de transactions depuis son compte Coinvault, adresse de destination \`TJx2…Q9wa\`. Vérification sur Tronscan : les sept transferts existent, USDT officiel.

**J0 + 4 h.** Suivi : l'adresse de collecte a reçu des fonds de **31** expéditeurs différents (probables autres victimes) et renvoie tout vers une adresse de consolidation qui détient encore **212 000 USDT**. Demande de gel adressée à l'émetteur via son portail, avec l'accord du magistrat.

**J1.** Le reste des fonds de Mme T. est parti vers des dépôts **Kaizen Exchange** : demande de gel et réquisition via le portail de l'exchange avec les hash de dépôt.

**J3.** Gel confirmé par l'émetteur. Rapprochement avec d'autres plaintes grâce aux 31 expéditeurs.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Les victimes sont ciblées une seconde fois',
        md: `Après une escroquerie, les victimes reçoivent souvent des offres de « récupération de fonds » (faux avocats, faux enquêteurs, fausses sociétés d'analyse) qui exigent des frais. C'est une **seconde escroquerie**. Prévenez systématiquement la victime, et relevez ces contacts : ils sont parfois liés aux auteurs initiaux.`,
      },
      {
        type: 'check',
        q: 'Les USDT d\'une victime sont encore, en partie, sur une adresse de consolidation des auteurs. Quelle action prioriser ?',
        options: [
          'Attendre qu\'ils arrivent sur un exchange',
          'Solliciter rapidement, dans le cadre procédural, le gel auprès de l\'émetteur de l\'USDT',
          'Envoyer un message à l\'adresse',
          'Envoyer 1 USDT à l\'adresse pour la marquer',
        ],
        answer: 1,
        explain: 'L\'USDT est gelable par son émetteur, même sur une adresse auto-hébergée. Chaque heure compte : les fonds peuvent être convertis ou passés dans un bridge.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Point d\'ancrage', def: 'Transaction certaine (celle de la victime) d\'où part la trace.' },
          { term: 'Saut (hop)', def: 'Passage des fonds d\'une adresse à la suivante.' },
          { term: 'Adresse de collecte', def: 'Adresse qui reçoit les fonds de la ou des victimes.' },
          { term: 'Adresse de consolidation', def: 'Adresse qui regroupe les fonds de plusieurs adresses de collecte.' },
          { term: 'Journal de traçage', def: 'Tableau listant chaque saut : txid, montant, date, adresses, raisonnement.' },
          { term: 'Gel', def: 'Blocage conservatoire des fonds par un émetteur de jeton ou un prestataire.' },
        ],
      },
    ],
    keyPoints: [
      'Recueillir dès la plainte : adresses, hash, actif, réseau, plateforme, dates, captures — par copier-coller.',
      'Identifier chaîne et actif avant tout ; vérifier sur deux explorateurs, en UTC.',
      'Partir de la transaction de la victime et suivre l\'argent saut par saut, dans un journal de traçage.',
      'Les services (exchanges, émetteurs) sont les points d\'identification et de blocage.',
      'Le gel des stablecoins et des comptes d\'exchange est une urgence : heures, pas semaines.',
      'Réquisitions : 60-1, 77-1-1, 99-3 CPP selon le cadre ; entraide pour l\'étranger.',
      'Ne jamais interagir avec les adresses suspectes ; distinguer fait, indice et hypothèse.',
    ],
    quiz: [
      {
        q: 'Quel est le point de départ le plus fiable d\'une trace ?',
        options: [
          'L\'adresse citée par un forum',
          'La transaction de la victime, vérifiée sur la blockchain',
          'Le site de la fausse plateforme',
          'Le pseudonyme de l\'escroc',
        ],
        answer: 1,
        explain: 'La transaction de la victime est certaine et vérifiable : elle fixe l\'adresse de l\'auteur et le montant à suivre.',
      },
      {
        q: 'En enquête préliminaire, sur quel fondement un OPJ requiert-il un prestataire établi en France ?',
        options: ['Article 60-1 du CPP', 'Article 77-1-1 du CPP, avec l\'autorisation du procureur', 'Article 99-3 du CPP', 'Aucun, une simple demande suffit'],
        answer: 1,
        explain: 'L\'article 77-1-1 CPP régit les réquisitions en enquête préliminaire. L\'article 60-1 concerne la flagrance, l\'article 99-3 l\'information judiciaire.',
      },
      {
        kind: 'multi',
        q: 'Quelles informations doivent figurer dans une réquisition adressée à un exchange ? (plusieurs réponses)',
        options: [
          'La chaîne et l\'actif',
          'Le hash de la transaction et l\'adresse concernée',
          'Le montant exact et l\'horodatage UTC',
          'Le sens du flux (dépôt ou retrait)',
          'L\'appréciation de l\'enquêteur sur la culpabilité du titulaire',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Plus la demande est précise, plus la réponse est rapide et exploitable : chacun des quatre premiers éléments évite une confusion. L\'appréciation sur la culpabilité n\'a rien à faire dans une réquisition, qui doit rester factuelle et ne pas exposer inutilement l\'enquête.',
      },
      {
        kind: 'truefalse',
        q: 'Pour vérifier qu\'une adresse est active, il est acceptable d\'y envoyer une très petite somme.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Toute interaction altère la preuve et peut alerter l\'auteur. La blockchain se lit sans interagir.',
      },
      {
        q: 'Une victime a envoyé des USDT « en TRC20 ». Sur quelle blockchain faut-il chercher ?',
        options: ['Ethereum', 'Bitcoin', 'Tron', 'BNB Smart Chain'],
        answer: 2,
        explain: 'TRC20 désigne le standard de jetons de Tron. ERC20 désignerait Ethereum, BEP20 la BNB Smart Chain.',
      },
      {
        q: 'Laquelle de ces phrases est correctement rédigée pour un PV ?',
        options: [
          '« L\'adresse B appartient à M. X » (sur la base d\'un label d\'explorateur)',
          '« L\'outil X attribue l\'adresse B à Binova (attribution non vérifiée ; réquisition en cours) »',
          '« L\'adresse B est sûrement celle du chef du réseau »',
          '« L\'adresse B est anonyme »',
        ],
        answer: 1,
        explain: 'On cite la source de l\'attribution et son degré de certitude. Seule une réponse de prestataire ou une saisie établit le contrôle.',
      },
      {
        q: 'Une victime reçoit, après sa plainte, l\'offre d\'un « cabinet de récupération » qui promet de rendre ses fonds contre 2 000 € de frais. Que faire ?',
        options: [
          'L\'encourager, c\'est un service utile',
          'La mettre en garde : il s\'agit très probablement d\'une seconde escroquerie, et relever les coordonnées du contact',
          'Lui conseiller de payer en crypto',
          'Ignorer l\'information',
        ],
        answer: 1,
        explain: 'Les escroqueries au faux recouvrement sont très répandues et parfois liées aux auteurs initiaux.',
      },
    ],
    flashcards: [
      { front: 'Réflexe n°1', back: 'Recueillir les identifiants exacts (adresses, hash, actif, réseau, plateforme, dates) par copier-coller.' },
      { front: 'Point d\'ancrage', back: 'La transaction de la victime, vérifiée on-chain.' },
      { front: 'TRC20 / ERC20 / BEP20', back: 'Jetons sur Tron / Ethereum / BNB Smart Chain.' },
      { front: 'Art. 60-1 CPP', back: 'Réquisitions en enquête de flagrance.' },
      { front: 'Art. 77-1-1 CPP', back: 'Réquisitions en enquête préliminaire (autorisation du procureur).' },
      { front: 'Art. 99-3 CPP', back: 'Réquisitions en information judiciaire.' },
      { front: 'Urgence n°1 sur des USDT', back: 'Demande de gel à l\'émetteur tant que les fonds sont sur une adresse de l\'auteur.' },
      { front: 'Journal de traçage', back: 'Pour chaque saut : txid, montant, date UTC, adresses, raison du choix.' },
      { front: 'Fait / indice / hypothèse', back: 'Fait : on-chain ou réponse de prestataire. Indice : label, heuristique. Hypothèse : à étayer.' },
      { front: 'Faux services de récupération', back: 'Seconde escroquerie visant les victimes : prévenir et relever les contacts.' },
    ],
  },
]
