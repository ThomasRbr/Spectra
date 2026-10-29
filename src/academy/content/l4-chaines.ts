// Niveau 4 — Chaînes et couches avancées : Lightning, rollups, Solana,
// lecture des smart contracts.
import type { Lesson } from '../model'

const lightning: Lesson = {
  id: 'lightning',
  title: 'Le Lightning Network',
  level: 4,
  track: 'bitcoin',
  minutes: 35,
  summary:
    'Lightning fait circuler des bitcoins hors chaîne dans des canaux de paiement. Ce qui reste visible sur Bitcoin (ouvertures, fermetures coopératives ou forcées, swaps), ce que révèle une facture BOLT11, ce que voient les nœuds intermédiaires, et pourquoi les portefeuilles custodiaux et les LSP sont souvent les meilleures cibles de réquisition. Précautions de saisie propres à un nœud Lightning.',
  objectives: [
    'Expliquer le fonctionnement d\'un canal Lightning, d\'un paiement routé et d\'une facture BOLT11.',
    'Reconnaître sur la chaîne Bitcoin une ouverture, une fermeture coopérative, une fermeture forcée et un swap.',
    'Décoder une facture pour en extraire le nœud destinataire, le payment hash, le montant et l\'horodatage.',
    'Identifier la bonne cible de réquisition (portefeuille custodial, LSP, exchange) et les données à demander.',
    'Saisir un nœud ou un portefeuille Lightning sans provoquer de perte de fonds.',
  ],
  prerequisites: ['utxo', 'frais-mempool', 'exchanges'],
  practice: ['change-anatomy'],
  blocks: [
    {
      type: 'text',
      md: `Une victime a payé 4,2 millions de satoshis à un faux vendeur en scannant un QR code commençant par \`lnbc\`. Elle n'a aucun hash de transaction Bitcoin à vous donner : **le paiement n'est jamais passé sur la blockchain**.

Le Lightning Network est un réseau de **canaux de paiement** construit au-dessus de Bitcoin. Les paiements y sont rapides, peu coûteux… et invisibles pour un explorateur de blocs. L'enquêteur doit donc changer d'outils : décoder la facture, raisonner sur les nœuds, et viser les services qui tiennent des comptes.`,
    },
    { type: 'heading', text: 'Principe : des canaux, des HTLC, une facture' },
    {
      type: 'text',
      md: `1. **Ouverture** : deux nœuds bloquent des bitcoins dans une sortie multisignature 2-sur-2 par une transaction **on-chain** (la *funding transaction*). C'est le capital du canal.
2. **Paiements** : les deux parties échangent hors chaîne des transactions signées mais non diffusées (*commitment transactions*) qui mettent à jour la répartition du solde. Des milliers de paiements peuvent avoir lieu sans rien écrire sur Bitcoin.
3. **Routage** : pour payer quelqu'un avec qui l'on n'a pas de canal, le paiement emprunte une chaîne de canaux. Chaque saut est verrouillé par un **HTLC** : les fonds ne sont débloqués que contre la révélation d'un secret, la *preimage*, dont l'empreinte (le **payment hash**) figure dans la facture.
4. **Routage en oignon** : chaque nœud intermédiaire ne connaît que le nœud précédent et le suivant, pas l'émetteur ni le destinataire final.
5. **Fermeture** : le solde final est réglé par une transaction **on-chain**, coopérative ou forcée.

Les montants Lightning s'expriment souvent en **millisatoshis** (msat) : 1 sat = 1 000 msat.`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 'v', label: 'Portefeuille victime', kind: 'victim', sub: 'nœud mobile' },
        { id: 'lsp', label: 'LSP', kind: 'service', sub: 'nœud de routage' },
        { id: 'hub', label: 'Nœud de routage', kind: 'service', sub: 'voit montant et hash' },
        { id: 'bn', label: 'Nœud Binova', kind: 'exchange', sub: 'émetteur de la facture' },
        { id: 'acc', label: 'Compte client', kind: 'suspect', sub: 'crédité 4,2 M sats' },
      ],
      edges: [
        { from: 'v', to: 'lsp', label: 'HTLC' },
        { from: 'lsp', to: 'hub', label: 'HTLC (hors chaîne)', dashed: true },
        { from: 'hub', to: 'bn', label: 'HTLC (hors chaîne)', dashed: true },
        { from: 'bn', to: 'acc', label: 'écriture interne' },
      ],
      caption: 'Un paiement routé : rien n\'apparaît sur Bitcoin. Le destinataire final est un compte chez un service qui a émis la facture.',
    },
    {
      type: 'terms',
      items: [
        { term: 'Funding transaction', def: 'Transaction on-chain qui ouvre un canal en créant une sortie 2-sur-2 (P2WSH, ou P2TR pour les canaux Taproot).' },
        { term: 'Commitment transaction', def: 'Transaction hors chaîne, signée, représentant l\'état courant du canal. Sa diffusion provoque une fermeture forcée.' },
        { term: 'HTLC', def: 'Contrat verrouillé par empreinte et par délai : paiement contre preimage, remboursement après expiration.' },
        { term: 'Payment hash / preimage', def: 'Empreinte figurant dans la facture / secret révélé au paiement. Détenir la preimage prouve que le paiement a abouti.' },
        { term: 'Facture BOLT11', def: 'Demande de paiement encodée (préfixe lnbc sur le réseau principal) : montant, payment hash, nœud destinataire, description, expiration.' },
        { term: 'Clé publique de nœud', def: 'Identifiant d\'un nœud (33 octets, 66 caractères hexadécimaux commençant par 02 ou 03).' },
        { term: 'short_channel_id', def: 'Identifiant d\'un canal public : hauteur de bloc × index de transaction × index de sortie de la funding transaction.' },
        { term: 'LSP', def: 'Lightning Service Provider : ouvre des canaux vers les portefeuilles mobiles et leur fournit de la liquidité.' },
        { term: 'Submarine swap', def: 'Échange atomique entre bitcoins on-chain et bitcoins Lightning, via un service de swap.' },
      ],
    },
    { type: 'heading', text: 'Ce que la chaîne Bitcoin montre' },
    {
      type: 'table',
      headers: ['Événement', 'Signature on-chain', 'Ce que l\'enquêteur en tire'],
      rows: [
        ['Ouverture de canal', 'Sortie P2WSH (ou P2TR) d\'un montant souvent rond ; script 2-sur-2 révélé seulement à la dépense', 'Capital engagé, financement (d\'où viennent les fonds), lien avec un nœud si le canal est annoncé'],
        ['Fermeture coopérative', 'Dépense de la sortie 2-sur-2 avec deux signatures, une ou deux sorties simples vers chaque partie', 'Solde final de chaque partie : piste vers les adresses de destination'],
        ['Fermeture forcée', 'Commitment transaction : nLockTime à octet de poids fort 0x20 et nSequence à octet de poids fort 0x80 ; sorties à délai (CSV), éventuelles sorties HTLC et ancres', 'Litige ou nœud hors ligne ; les fonds de celui qui a fermé n\'arrivent qu\'après le délai'],
        ['Transaction de pénalité', 'Dépense immédiate de toutes les sorties d\'une commitment révoquée', 'Tentative de diffusion d\'un ancien état (fraude ou mauvaise restauration de sauvegarde)'],
        ['Submarine swap', 'Sortie HTLC on-chain liée à un service de swap', 'Pont entre Lightning et on-chain, corrélable en montant et en temps'],
      ],
      caption: 'Les canaux Taproot simples ressemblent à des dépenses à clé unique : les signatures distinctives s\'estompent avec le temps.',
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : les canaux publics sont annoncés',
      md: `Un canal **public** est annoncé sur le réseau de *gossip* avec son \`short_channel_id\`, qui désigne précisément la sortie de la funding transaction. Les explorateurs Lightning (pages « Lightning » de mempool.space, Amboss, 1ML…) relient ainsi une **clé publique de nœud** à des **UTXO** on-chain, à un alias et parfois à une adresse IP ou à une adresse Tor.

Attention : l'alias et la couleur d'un nœud sont **auto-déclarés**. Un nœud nommé « Binova » n'appartient pas forcément à Binova : vérifiez par d'autres sources (site officiel, documentation, réponse du service). Les canaux **privés** (non annoncés), très fréquents sur mobile, n'apparaissent pas dans le gossip.`,
    },
    { type: 'widget', id: 'fee-mempool', caption: 'Une fermeture forcée en période de mempool chargée : pourquoi les ancres et le CPFP existent, et pourquoi le délai compte.' },
    {
      type: 'check',
      q: 'Une victime a payé une facture Lightning. Que pouvez-vous chercher sur un explorateur Bitcoin pour retrouver ce paiement ?',
      options: [
        'Le hash de transaction du paiement',
        'Rien : un paiement Lightning routé ne crée pas de transaction on-chain ; il faut partir de la facture',
        'La sortie OP_RETURN contenant la facture',
        'La transaction de pénalité',
      ],
      answer: 1,
      explain: 'Seules les ouvertures, fermetures et swaps passent par la chaîne. Le paiement lui-même se documente par la facture, le payment hash et la preimage.',
    },
    { type: 'heading', text: 'Décoder la facture : la pièce maîtresse' },
    {
      type: 'table',
      headers: ['Champ BOLT11', 'Exemple', 'Valeur pour l\'enquête'],
      rows: [
        ['Préfixe et montant', '`lnbc42m…` (42 m = 0,042 BTC = 4,2 M sats)', 'Montant demandé, réseau principal'],
        ['Horodatage', '2026-03-18 09:41:07 UTC', 'Moment de création de la facture par le destinataire'],
        ['Payment hash', '`5f2c…a91e` (32 octets)', 'Clé de recherche pour le service émetteur'],
        ['Clé publique du destinataire', '`03a1…7c4d`', 'Nœud qui a émis la facture : souvent un service identifiable'],
        ['Description', '« Commande #A-2291 »', 'Contexte, référence de commande'],
        ['Expiration', '3 600 s', 'Fenêtre de validité'],
        ['Route hints', 'short_channel_id d\'un canal privé', 'Révèle le nœud d\'entrée (LSP) et un canal non annoncé'],
      ],
      caption: 'Les décodeurs de factures (intégrés aux explorateurs Lightning ou en ligne de commande) produisent ces champs. Préférez un outil hors ligne : la facture contient des données d\'enquête.',
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ce que la facture ne dit pas toujours',
      md: `Les évolutions du protocole réduisent ce que révèle une demande de paiement : **chemins aveuglés** (*blinded paths*), **offres BOLT12** (préfixe \`lno\`), nœuds de portefeuilles mobiles derrière un LSP. Le nœud « destinataire » visible peut n'être que le **point d'entrée** d'un chemin masqué. Décrivez précisément ce que vous avez décodé, sans extrapoler.`,
    },
    {
      type: 'case',
      title: 'Cas — La facture du faux vendeur',
      md: `La victime transmet une capture de la facture payée le 18 mars à 09:43 UTC. Décodage hors ligne : montant 4 200 000 sats, payment hash \`5f2c…a91e\`, clé publique de destinataire \`03a1…7c4d\`, description « Commande #A-2291 ».

La clé \`03a1…7c4d\` est un nœud public disposant de plus de 300 canaux, que la documentation officielle de Binova désigne comme son nœud de dépôt Lightning. La facture a donc vraisemblablement été générée depuis **un compte client Binova** (fonction « déposer via Lightning »).

La victime fournit aussi la **preimage** affichée par son portefeuille : son empreinte SHA-256 correspond au payment hash, ce qui **prouve** que le paiement a abouti.

Réquisition à Binova : payment hash, montant, date et heure de création de la facture et de paiement → identité du titulaire du compte, IP de connexion lors de la génération de la facture, historique des retraits ultérieurs (on-chain : adresses et hash).`,
    },
    {
      type: 'check',
      q: 'Que prouve la preimage d\'un paiement Lightning, dont l\'empreinte correspond au payment hash de la facture ?',
      options: [
        'L\'identité du destinataire',
        'Que le paiement a abouti : la preimage n\'est révélée qu\'à la réception des fonds',
        'L\'adresse Bitcoin du destinataire',
        'Rien de plus que la facture',
      ],
      answer: 1,
      explain: 'Le destinataire ne révèle la preimage qu\'en réclamant le paiement. Sa possession par l\'émetteur constitue une preuve de paiement.',
    },
    { type: 'heading', text: 'Custodial ou non : là où se trouvent les données' },
    {
      type: 'compare',
      left: {
        title: 'Portefeuille custodial',
        md: `Le service détient les fonds et exploite le nœud ; l'utilisateur n'a qu'un **compte**.

- Le service connaît chaque paiement émis ou reçu, son montant et son horodatage.
- Souvent du KYC (exchanges), ou au moins e-mail, IP, identifiant d'appareil.
- **Cible de réquisition prioritaire** : payment hash, facture, date.`,
      },
      right: {
        title: 'Portefeuille non-custodial',
        md: `L'utilisateur détient ses clés et son propre nœud (local ou sur serveur).

- Le LSP qui a ouvert ses canaux connaît sa clé de nœud, les canaux, souvent l'IP et parfois des données de compte.
- Les nœuds intermédiaires voient montant et payment hash, mais pas les extrémités.
- L'appareil saisi reste la meilleure source : historique complet des paiements.`,
      },
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Rédiger la réquisition Lightning',
      md: `Une réquisition utile mentionne : le **payment hash** (identifiant universel du paiement), la **facture** complète si disponible, le montant en sats, la date et l'heure UTC, la clé publique du nœud concerné et, le cas échéant, la preimage. Demandez le titulaire du compte, les données de connexion, et les **mouvements on-chain** du compte (adresses de dépôt et de retrait, hash), qui relient Lightning au reste de votre traçage.

La voie (réquisition directe, coopération volontaire, DEE, entraide) dépend du lieu d'établissement du prestataire : voir la leçon sur la coopération internationale.`,
    },
    { type: 'heading', text: 'Entrer et sortir de Lightning' },
    {
      type: 'text',
      md: `Les fonds finissent toujours par toucher la chaîne :

- **Exchanges** : dépôt via Lightning, retrait on-chain (ou l'inverse). Le service fait la jonction et la trace dans ses registres.
- **Services de swap** : le *submarine swap* échange des sats Lightning contre une sortie on-chain (et inversement). La transaction on-chain du service, son montant (moins les frais) et son horaire se corrèlent avec le paiement.
- **Fermeture de canal** : les soldes reviennent sur des adresses on-chain, qui peuvent rejoindre un cluster connu.
- **Ouverture financée** depuis un exchange : la funding transaction dévoile l'origine du capital du nœud.

Une corrélation montant/temps entre un paiement Lightning documenté et une sortie de swap est un **indice**, à présenter comme tel et à corroborer par réquisition.`,
    },
    {
      type: 'steps',
      items: [
        { title: 'Recueillir', md: `Facture complète, capture du paiement, preimage, horodatage, portefeuille utilisé par la victime.` },
        { title: 'Décoder', md: `Montant, payment hash, nœud destinataire, route hints, description, expiration.` },
        { title: 'Identifier le nœud', md: `Explorateurs Lightning, documentation des services, canaux et funding transactions. Garder à l'esprit que les alias sont déclaratifs.` },
        { title: 'Réquisitionner', md: `Le service émetteur de la facture (custodial, exchange), sinon le LSP du nœud destinataire.` },
        { title: 'Rejoindre la chaîne', md: `Retraits on-chain, fermetures de canaux, swaps : reprendre le traçage UTXO classique à partir de ces points.` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Saisir un nœud Lightning sans perdre les fonds',
      md: `Les fonds d'un canal ne sont **pas** tous récupérables avec la seule seed :

- la seed (24 mots au format **aezeed** pour LND, incompatible avec BIP39 ; BIP39 ou fichier \`hsm_secret\` pour d'autres implémentations ; 12 mots pour certains portefeuilles mobiles) restaure les fonds on-chain ;
- la **sauvegarde statique des canaux** (\`channel.backup\` pour LND) permet de demander aux pairs une fermeture forcée et de récupérer les soldes ;
- **ne jamais** relancer un nœud à partir d'une copie ancienne de sa base de canaux : diffuser un état révoqué déclenche une **transaction de pénalité** qui donne tout le solde au pair.

Avant toute manipulation : fixez l'état (captures, export de la liste des canaux et soldes), conservez le nœud en l'état si possible, et faites intervenir un spécialiste. Une fermeture forcée impose ensuite un délai (souvent de l'ordre de quelques jours) avant que les fonds soient transférables vers l'adresse de saisie.`,
    },
  ],
  keyPoints: [
    'Les paiements Lightning routés ne créent aucune transaction on-chain : seules les ouvertures, fermetures et swaps sont visibles.',
    'La facture BOLT11 est la pièce maîtresse : montant, payment hash, nœud destinataire, horodatage, route hints.',
    'La preimage dont l\'empreinte égale le payment hash prouve que le paiement a abouti.',
    'Les alias de nœuds sont auto-déclarés : toute attribution doit être corroborée.',
    'Custodiaux, exchanges et LSP sont les meilleures cibles de réquisition (payment hash + date + montant).',
    'Les fermetures forcées ont une signature reconnaissable (nLockTime 0x20…, nSequence 0x80…) et des délais.',
    'Saisie : seed + sauvegarde des canaux ; ne jamais restaurer un ancien état sous peine de pénalité.',
  ],
  quiz: [
    {
      q: 'Quelles opérations Lightning laissent une trace sur la blockchain Bitcoin ?',
      kind: 'multi',
      options: ['L\'ouverture d\'un canal', 'Un paiement routé par trois nœuds', 'La fermeture forcée d\'un canal', 'Un submarine swap'],
      answer: [0, 2, 3],
      explain: 'Les paiements routés restent hors chaîne. Ouvertures, fermetures (coopératives ou forcées) et swaps s\'inscrivent on-chain.',
    },
    {
      q: 'Dans une facture BOLT11, quel champ sert d\'identifiant universel du paiement pour une réquisition ?',
      options: ['La description', 'Le payment hash', 'L\'expiration', 'Le préfixe lnbc'],
      answer: 1,
      explain: 'Le payment hash identifie le paiement chez l\'émetteur de la facture et chez tous les nœuds qui l\'ont routé.',
    },
    {
      q: 'Un nœud public porte l\'alias « Coinvault-Pay ». On peut en conclure qu\'il appartient à Coinvault.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Les alias sont choisis librement par l\'opérateur du nœud. L\'attribution doit être corroborée (documentation officielle, réponse du service, recoupements).',
    },
    {
      q: 'Que voit un nœud intermédiaire qui route un paiement ?',
      options: [
        'L\'émetteur et le destinataire finaux',
        'Le montant transitant, le payment hash, le nœud précédent et le nœud suivant',
        'La preimage avant le paiement',
        'Rien du tout',
      ],
      answer: 1,
      explain: 'Le routage en oignon ne révèle à chaque saut que ses voisins immédiats ; montant et payment hash du HTLC lui sont en revanche connus.',
    },
    {
      q: 'Lors de la saisie d\'un nœud LND, quels éléments faut-il préserver pour récupérer les fonds des canaux ?',
      kind: 'multi',
      options: [
        'La seed aezeed de 24 mots',
        'La sauvegarde statique des canaux (channel.backup)',
        'Une ancienne copie de la base de canaux, à relancer pour fermer les canaux',
        'L\'état documenté des canaux et des soldes au moment de la saisie',
      ],
      answer: [0, 1, 3],
      explain: 'Relancer un nœud à partir d\'un ancien état peut provoquer la diffusion d\'une commitment révoquée et une pénalité qui donne tout le solde au pair.',
    },
    {
      q: 'Une transaction dépense une sortie 2-sur-2, avec un nLockTime commençant par 0x20 et des sorties à délai CSV. De quoi s\'agit-il probablement ?',
      options: ['D\'une ouverture de canal', 'D\'une fermeture coopérative', 'D\'une fermeture forcée (commitment transaction)', 'D\'un CoinJoin'],
      answer: 2,
      explain: 'Les commitment transactions encodent un numéro d\'état masqué dans nLockTime (octet de poids fort 0x20) et nSequence (0x80) ; les sorties du fermeur sont soumises à un délai.',
    },
    {
      q: 'La victime a payé depuis un portefeuille non-custodial ; la facture désigne un nœud de portefeuille mobile derrière un LSP. Quelle cible de réquisition privilégier ?',
      options: [
        'Le nœud intermédiaire le plus gros du réseau',
        'Le LSP dont le canal figure dans les route hints de la facture',
        'Les développeurs du protocole Lightning',
        'Aucune, Lightning est anonyme',
      ],
      answer: 1,
      explain: 'Le LSP connaît le nœud mobile qu\'il dessert (clé de nœud, canaux, souvent IP ou compte) : c\'est la meilleure porte d\'entrée vers le destinataire.',
    },
  ],
  flashcards: [
    { front: 'Funding transaction', back: 'Ouverture de canal : sortie 2-sur-2 on-chain (P2WSH ou P2TR).' },
    { front: 'HTLC', back: 'Verrou par empreinte et par délai : paiement contre preimage, remboursement à expiration.' },
    { front: 'Payment hash', back: 'Empreinte de la preimage, dans la facture : identifiant universel du paiement.' },
    { front: 'Preimage', back: 'Secret révélé à l\'encaissement ; sa possession prouve que le paiement a abouti.' },
    { front: 'Préfixe lnbc', back: 'Facture BOLT11 sur le réseau principal Bitcoin ; lno = offre BOLT12.' },
    { front: 'short_channel_id', back: 'Bloc × index de transaction × index de sortie de la funding transaction d\'un canal public.' },
    { front: 'Signature d\'une fermeture forcée', back: 'nLockTime à octet de poids fort 0x20, nSequence 0x80, sorties à délai CSV.' },
    { front: 'LSP', back: 'Fournisseur de liquidité pour portefeuilles mobiles : connaît les nœuds qu\'il dessert.' },
    { front: 'Cible de réquisition Lightning', back: 'Service émetteur de la facture (custodial, exchange) ou LSP, avec payment hash, montant, date.' },
    { front: 'Danger à la saisie', back: 'Relancer un ancien état de canal = transaction de pénalité, perte totale du solde.' },
  ],
}

const layer2: Lesson = {
  id: 'layer2-rollups',
  title: 'Layer 2 et rollups',
  level: 4,
  track: 'comptes',
  minutes: 30,
  summary:
    'Arbitrum, Optimism, Base, zkSync, Starknet… Les rollups exécutent les transactions hors d\'Ethereum et y publient leurs données. Rollups optimistes et ZK, séquenceurs, ponts canoniques (dépôts, retraits, délai de contestation), explorateurs par L2, même adresse sur plusieurs chaînes EVM et pièges associés, gel des stablecoins natifs ou pontés.',
  objectives: [
    'Distinguer rollup optimiste, rollup ZK et sidechain, et leurs conséquences pour l\'enquête.',
    'Suivre un dépôt L1 → L2 et un retrait L2 → L1 via le pont canonique, ainsi qu\'une sortie rapide par un bridge tiers.',
    'Vérifier systématiquement une adresse EVM sur toutes les chaînes pertinentes et en connaître les limites.',
    'Identifier les points de gel et de réquisition propres aux L2 (émetteurs, bridges, exchanges).',
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'bridges'],
  practice: ['chain-hopping'],
  blocks: [
    {
      type: 'text',
      md: `Les fonds volés quittent Ethereum par un contrat de pont… et réapparaissent quelques minutes plus tard sur **Arbitrum**, à la même adresse. Puis ils sont échangés sur un DEX, renvoyés sur **Base**, et enfin vers BNB Chain par un bridge tiers. Si vous ne consultez que l'explorateur d'Ethereum, vous avez perdu la trace dès le premier saut.

Les **Layer 2** (L2) concentrent aujourd'hui une large part de l'activité EVM. Ils sont techniquement plus simples à suivre que les bridges entre chaînes indépendantes, à condition d'en comprendre la mécanique.`,
    },
    { type: 'heading', text: 'Rollups : exécuter ailleurs, publier sur Ethereum' },
    {
      type: 'compare',
      left: {
        title: 'Rollup optimiste (Arbitrum, OP Mainnet, Base…)',
        md: `- Les lots de transactions sont publiés sur Ethereum et présumés valides.
- Une **période de contestation** (de l'ordre de 7 jours sur les ponts canoniques) permet de prouver une fraude.
- Conséquence : un retrait par le pont canonique vers L1 prend **environ une semaine**.`,
      },
      right: {
        title: 'Rollup ZK (zkSync Era, Starknet, Linea, Scroll…)',
        md: `- Chaque lot est accompagné d'une **preuve de validité** vérifiée sur Ethereum.
- Pas de période de contestation : retraits finalisés en heures plutôt qu'en jours (selon la fréquence des preuves).
- Starknet n'est **pas** compatible EVM : format d'adresse et modèle de comptes différents.`,
      },
    },
    {
      type: 'terms',
      items: [
        { term: 'Rollup', def: 'Chaîne qui exécute les transactions hors d\'Ethereum et publie sur Ethereum de quoi reconstituer et vérifier son état.' },
        { term: 'Séquenceur', def: 'Opérateur (souvent unique) qui ordonne les transactions du L2 et les publie par lots sur L1.' },
        { term: 'Pont canonique', def: 'Pont officiel du rollup : contrats sur L1 et L2 qui verrouillent ou libèrent les fonds en s\'appuyant sur la sécurité du rollup.' },
        { term: 'Période de contestation', def: 'Délai pendant lequel un retrait optimiste peut être contesté par une preuve de fraude.' },
        { term: 'Blobs (EIP-4844)', def: 'Espace de données bon marché sur Ethereum, utilisé depuis 2024 par les rollups pour publier leurs lots.' },
        { term: 'Sidechain', def: 'Chaîne indépendante avec ses propres validateurs, reliée par un pont (sécurité distincte d\'Ethereum).' },
        { term: 'Bridge tiers / de liquidité', def: 'Service qui avance les fonds sur la chaîne d\'arrivée à partir de ses réserves, pour éviter les délais du pont canonique.' },
      ],
    },
    {
      type: 'table',
      headers: ['Réseau', 'Type', 'Actif de gaz', 'Explorateur courant', 'Point d\'attention'],
      rows: [
        ['Arbitrum One', 'Rollup optimiste', 'ETH', 'Arbiscan', 'Blocs très rapprochés : raisonner en horodatages UTC'],
        ['OP Mainnet', 'Rollup optimiste (OP Stack)', 'ETH', 'Explorateur Optimism (famille Etherscan)', 'Nombreuses chaînes partageant la même pile logicielle'],
        ['Base', 'Rollup optimiste (OP Stack)', 'ETH', 'Basescan', 'Forte activité grand public et memecoins'],
        ['zkSync Era', 'Rollup ZK', 'ETH', 'Explorateur zkSync', 'Comptes abstraits natifs : certaines adresses sont des contrats'],
        ['Starknet', 'Rollup ZK (non EVM)', 'ETH / STRK', 'Voyager, Starkscan', 'Adresses de 64 caractères hex, comptes tous contractuels'],
        ['Polygon PoS', 'Sidechain (validateurs propres)', 'POL', 'Polygonscan', 'Pas un rollup : sécurité et pont distincts'],
      ],
      caption: 'Paysage indicatif, en évolution rapide : vérifiez le type et l\'explorateur de référence au moment de l\'analyse.',
    },
    { type: 'heading', text: 'Suivre un dépôt et un retrait' },
    {
      type: 'steps',
      items: [
        { title: 'Dépôt L1 → L2', md: `L'utilisateur appelle une fonction de dépôt du contrat de pont sur Ethereum (ETH ou jeton ERC-20). Le séquenceur crédite le **même destinataire** (par défaut la même adresse) sur le L2, généralement en quelques minutes. L'explorateur du L2 affiche la transaction L2 et la référence de la transaction L1 d'origine.` },
        { title: 'Activité sur le L2', md: `Swaps, transferts, dépôts sur d'autres protocoles : même lecture que sur Ethereum (transactions, logs, transactions internes), sur l'explorateur du L2.` },
        { title: 'Retrait L2 → L1 (canonique)', md: `Initiation sur le L2, puis — pour un rollup optimiste — preuve et attente de la période de contestation, et enfin **finalisation** par une transaction sur L1, qui peut être émise par l'utilisateur ou un tiers. Les fonds sont souvent dormants pendant cette semaine : fenêtre utile pour anticiper une réquisition au point d'arrivée.` },
        { title: 'Sortie rapide (bridge tiers)', md: `Pour éviter l'attente, l'utilisateur passe par un bridge de liquidité (ArcBridge dans les exercices) : dépôt sur le L2, versement par les réserves du bridge sur la chaîne d'arrivée. On relie les deux bouts par l'événement du bridge (destinataire, chaîne cible, identifiant/nonce), le montant et le temps.` },
      ],
    },
    {
      type: 'flow',
      nodes: [
        { id: 'h', label: '0x7d2c…', kind: 'suspect', sub: 'Ethereum' },
        { id: 'br', label: 'Pont canonique', kind: 'bridge', sub: 'contrat L1' },
        { id: 'arb', label: '0x7d2c…', kind: 'wallet', sub: 'Arbitrum' },
        { id: 'dex', label: 'OmniSwap', kind: 'dex', sub: 'ETH → USDC' },
        { id: 'arc', label: 'ArcBridge', kind: 'bridge', sub: 'Arbitrum → BNB Chain' },
        { id: 'bsc', label: '0x19fe…', kind: 'wallet', sub: 'BNB Chain' },
        { id: 'bin', label: 'Binova', kind: 'exchange', sub: 'adresse de dépôt' },
      ],
      edges: [
        { from: 'h', to: 'br', label: 'dépôt 85 ETH' },
        { from: 'br', to: 'arb', label: 'crédit L2 (même adresse)' },
        { from: 'arb', to: 'dex', label: 'swap' },
        { from: 'dex', to: 'arc', label: '201 300 USDC' },
        { from: 'arc', to: 'bsc', label: 'nonce 48 211' },
        { from: 'bsc', to: 'bin', label: 'dépôt' },
      ],
      caption: 'Chaque saut se lit sur l\'explorateur de sa propre chaîne ; le pont canonique et le bridge tiers fournissent les liens déterministes.',
    },
    { type: 'widget', id: 'bridge-flow', caption: 'Rejouez un passage par bridge : événement de départ, identifiant, transaction d\'arrivée sur l\'autre chaîne.' },
    {
      type: 'check',
      q: 'Un suspect initie le 2 mai un retrait de 85 ETH d\'Arbitrum vers Ethereum par le pont canonique. Quand les fonds seront-ils au plus tôt disponibles sur L1 ?',
      options: [
        'Immédiatement',
        'Après la période de contestation, de l\'ordre d\'une semaine, puis une transaction de finalisation',
        'Jamais : les retraits canoniques sont impossibles',
        'Après 10 blocs Ethereum',
      ],
      answer: 1,
      explain: 'Sur un rollup optimiste, le retrait canonique attend la fin de la période de contestation avant d\'être finalisé sur L1. Ce délai est une opportunité d\'anticipation pour l\'enquêteur.',
    },
    { type: 'heading', text: 'Une adresse, plusieurs chaînes' },
    {
      type: 'text',
      md: `Une adresse EVM est dérivée de la clé publique : **la même clé privée contrôle la même adresse sur toutes les chaînes EVM** (Ethereum, Arbitrum, Base, BNB Chain, Polygon, Avalanche C-Chain…). Conséquences pratiques :

- vérifiez **systématiquement** chaque adresse d'intérêt sur toutes les chaînes EVM courantes : des fonds « disparus » dorment souvent sur un L2 que personne n'a consulté ;
- l'historique de nonce d'une adresse est **propre à chaque chaîne** ;
- un même portefeuille (MetaMask, Rabby…) affiche la même adresse sur toutes les chaînes : la victime peut avoir été volée sur une chaîne qu'elle n'utilisait pas.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le piège des contrats : même adresse, autre propriétaire',
      md: `Ce qui vaut pour un compte externe (EOA) ne vaut **pas** pour un contrat. Un portefeuille contractuel multisignature déployé à une adresse sur Ethereum peut ne pas exister à la même adresse sur un L2, ou y avoir été déployé **par quelqu'un d'autre**. En 2022, un teneur de marché a ainsi perdu des jetons envoyés sur un L2 à l'adresse de son multisig, qui n'y était pas encore déployé : un tiers a pu prendre le contrôle de cette adresse.

Avant d'affirmer qu'une adresse contractuelle appartient au même acteur sur deux chaînes, vérifiez le **déployeur** et la configuration (propriétaires, seuil) sur chacune.`,
    },
    {
      type: 'check',
      q: 'L\'EOA 0x7d2c… du suspect est identifiée sur Ethereum. Que vérifier en priorité ?',
      options: [
        'Rien : une adresse n\'existe que sur une chaîne',
        'Son activité sur les autres chaînes EVM (L2, BNB Chain, Polygon…), car la même clé y contrôle la même adresse',
        'Son équivalent sur Bitcoin',
        'Son adresse Starknet, identique',
      ],
      answer: 1,
      explain: 'La même clé privée contrôle la même adresse sur toutes les chaînes EVM. Starknet, non EVM, utilise un format et une dérivation différents.',
    },
    { type: 'heading', text: 'Séquenceurs, explorateurs et horodatage' },
    {
      type: 'text',
      md: `Le séquenceur d'un L2 est aujourd'hui généralement exploité par **une seule entité** (souvent la société à l'origine du réseau). Il ordonne les transactions mais ne détient pas de données d'identité sur les utilisateurs : les données utiles se trouvent plutôt chez les **fournisseurs d'accès RPC**, les **portefeuilles** et les **services** utilisés.

Côté lecture :

- chaque L2 a ses propres numéros de bloc, souvent très rapides (une fraction de seconde) : raisonnez toujours en **horodatage UTC**, jamais en numéros de bloc entre chaînes ;
- les explorateurs de L2 affichent des onglets propres (transactions L1 → L2, lots publiés, état des retraits) : ils documentent le passage entre couches ;
- les frais d'un L2 combinent l'exécution sur le L2 et une part du coût de publication sur L1.`,
    },
    {
      type: 'case',
      title: 'Cas — Le détour par Arbitrum',
      md: `Le 11 avril à 03:14 UTC, l'adresse \`0x7d2c…41\` (fonds issus d'un piratage de compte) dépose **85 ETH** dans le pont canonique d'Arbitrum. À 03:26 UTC, l'adresse est créditée de 85 ETH sur Arbitrum.

À 03:41 UTC, elle échange 85 ETH contre **201 300 USDC** sur OmniSwap (Arbitrum). À 04:02 UTC, elle dépose les USDC dans ArcBridge vers BNB Chain ; l'événement publie le destinataire \`0x19fe…a0\` et le nonce 48 211. À 04:06 UTC, ArcBridge verse **201 080 USDT** à \`0x19fe…a0\` sur BNB Chain (référence au nonce 48 211). Le 12 avril, \`0x19fe…a0\` dépose 200 950 USDT sur une adresse de dépôt Binova.

Points à documenter : chaque hash sur sa chaîne, l'explorateur utilisé, la référence L1 du dépôt, le nonce du bridge. Les liens sont **déterministes** (pont canonique, événement du bridge) : aucune heuristique n'est nécessaire, ce qui renforce considérablement la conclusion.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : geler sur un L2',
      md: `Les stablecoins **natifs** d'un L2 (émis directement par leur émetteur sur ce réseau) peuvent généralement être gelés par l'émetteur, comme sur Ethereum. Les versions **pontées** (souvent suffixées, par exemple \`USDC.e\`) sont des jetons du contrat de pont : leur gel dépend de ce contrat et de son administrateur, pas forcément de l'émetteur d'origine.

Avant de solliciter un gel, identifiez le **contrat exact du jeton** sur la chaîne concernée et son administrateur.`,
    },
    {
      type: 'steps',
      items: [
        { title: 'Inventorier les chaînes', md: `Pour chaque adresse : Ethereum, principaux L2, sidechains et chaînes EVM courantes.` },
        { title: 'Repérer les ponts', md: `Contrats de pont canonique, bridges tiers, événements de dépôt et de retrait ; noter les identifiants de liaison.` },
        { title: 'Lire chaque saut sur son explorateur', md: `Hash, horodatage UTC, montant, actif (natif, natif émis, ponté).` },
        { title: 'Surveiller les retraits en attente', md: `Un retrait optimiste en cours de contestation annonce l'arrivée de fonds sur L1 : préparer la suite.` },
        { title: 'Viser les points de gel', md: `Émetteurs de stablecoins, exchanges de destination, éventuellement opérateurs de bridges centralisés.` },
      ],
    },
  ],
  keyPoints: [
    'Les rollups exécutent hors d\'Ethereum et y publient leurs données ; les sidechains ont leur propre sécurité.',
    'Retrait optimiste par le pont canonique : environ une semaine de contestation, puis finalisation sur L1.',
    'Dépôts et retraits canoniques, comme les événements de bridges tiers, fournissent des liens déterministes.',
    'Même clé privée = même adresse EOA sur toutes les chaînes EVM : vérifier chaque chaîne.',
    'Pour les contrats (multisig), même adresse ne signifie pas même propriétaire : vérifier le déployeur.',
    'Raisonner en horodatages UTC, chaque L2 ayant ses propres numéros de bloc.',
    'Stablecoin natif ou ponté : le gel dépend de l\'administrateur du contrat du jeton sur la chaîne concernée.',
  ],
  quiz: [
    {
      q: 'Quelle est la principale différence opérationnelle entre un retrait canonique depuis un rollup optimiste et depuis un rollup ZK ?',
      options: [
        'Les retraits ZK sont impossibles',
        'Le rollup optimiste impose une période de contestation (de l\'ordre d\'une semaine) ; le rollup ZK finalise après vérification d\'une preuve de validité',
        'Le rollup optimiste est anonyme',
        'Aucune',
      ],
      answer: 1,
      explain: 'L\'optimiste présume la validité et laisse un délai de contestation ; le ZK prouve la validité de chaque lot.',
    },
    {
      q: 'Lesquels de ces réseaux sont compatibles EVM, de sorte qu\'une même clé y contrôle la même adresse qu\'un EOA Ethereum ?',
      kind: 'multi',
      options: ['Arbitrum One', 'Base', 'Starknet', 'BNB Smart Chain'],
      answer: [0, 1, 3],
      explain: 'Starknet n\'est pas compatible EVM : ses comptes sont des contrats avec un format d\'adresse différent.',
    },
    {
      q: 'Un multisig contractuel a la même adresse sur Ethereum et sur un L2. On peut affirmer qu\'il est contrôlé par les mêmes personnes sur les deux chaînes.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Une adresse contractuelle peut avoir été déployée par un tiers sur l\'autre chaîne, ou avec une configuration différente. Il faut vérifier déployeur et propriétaires sur chaque chaîne.',
    },
    {
      q: 'Pourquoi raisonner en horodatages UTC plutôt qu\'en numéros de bloc lorsqu\'on suit des fonds entre Ethereum et un L2 ?',
      options: [
        'Parce que les numéros de bloc sont secrets',
        'Parce que chaque chaîne a sa propre numérotation et sa propre cadence de blocs',
        'Parce que les L2 n\'ont pas de blocs',
        'Par simple convention',
      ],
      answer: 1,
      explain: 'Les numéros de bloc ne sont comparables qu\'au sein d\'une même chaîne. L\'horodatage UTC est la seule référence commune.',
    },
    {
      q: 'Quels éléments permettent de relier de façon déterministe un départ et une arrivée via un bridge tiers ?',
      kind: 'multi',
      options: [
        'L\'événement de dépôt publiant destinataire, chaîne cible et identifiant/nonce',
        'La transaction d\'arrivée référençant le même identifiant',
        'Le fait que les montants soient proches',
        'Le type de portefeuille utilisé par la victime',
      ],
      answer: [0, 1],
      explain: 'L\'identifiant publié par le bridge relie les deux transactions de façon déterministe. La proximité des montants n\'est qu\'un indice.',
    },
    {
      q: 'Les fonds sont sous forme d\'USDC.e (version pontée) sur un L2. Qui peut a priori les geler ?',
      options: [
        'Toujours l\'émetteur d\'origine de l\'USDC',
        'Cela dépend du contrat du jeton ponté et de son administrateur, qu\'il faut identifier',
        'Le séquenceur du L2, sur simple demande',
        'Personne, jamais',
      ],
      answer: 1,
      explain: 'Un jeton ponté est émis par le contrat du pont ; les capacités de gel dépendent de ce contrat. Il faut vérifier sur l\'explorateur.',
    },
  ],
  flashcards: [
    { front: 'Rollup', back: 'Exécute les transactions hors d\'Ethereum et publie de quoi reconstituer et vérifier l\'état sur L1.' },
    { front: 'Rollup optimiste', back: 'Lots présumés valides, contestables pendant ~7 jours : retrait canonique lent.' },
    { front: 'Rollup ZK', back: 'Preuve de validité par lot : pas de période de contestation.' },
    { front: 'Séquenceur', back: 'Opérateur (souvent unique) qui ordonne les transactions du L2 et publie les lots sur L1.' },
    { front: 'Pont canonique', back: 'Pont officiel du rollup ; dépôt L1 → L2 en minutes, retrait optimiste en ~1 semaine.' },
    { front: 'Sidechain', back: 'Chaîne à validateurs propres reliée par un pont, ex. Polygon PoS : pas un rollup.' },
    { front: 'Même adresse EVM multi-chaînes', back: 'Vraie pour un EOA (même clé) ; pas garantie pour un contrat (déployeur à vérifier).' },
    { front: 'Starknet', back: 'Rollup ZK non EVM : comptes contractuels, adresses de 64 caractères hex.' },
    { front: 'USDC.e', back: 'Version pontée d\'un stablecoin : gel dépendant du contrat du pont.' },
    { front: 'Retrait optimiste en attente', back: 'Fenêtre d\'environ une semaine pour préparer réquisition ou gel au point d\'arrivée.' },
  ],
}

const solana: Lesson = {
  id: 'solana',
  title: 'Solana et ses spécificités',
  level: 4,
  track: 'comptes',
  minutes: 35,
  summary:
    'Solana n\'est ni Bitcoin ni Ethereum : tout y est compte, les programmes sont séparés de leurs données, et les jetons vivent dans des comptes de jetons distincts du portefeuille. Comptes, programmes, SPL Token, ATA, signatures, fee payer, lecture d\'une transaction, autorités de gel, heuristiques de rattachement propres à Solana et explorateurs.',
  objectives: [
    'Décrire le modèle de comptes de Solana : propriétaire, lamports, données, programmes.',
    'Distinguer portefeuille, compte de jetons et ATA, et identifier le vrai propriétaire d\'un solde de jetons.',
    'Lire une transaction Solana : signature, fee payer, instructions, instructions internes, variations de soldes.',
    'Exploiter les heuristiques propres à Solana (fee payer, financement du loyer, fermeture de comptes) et cibler correctement une demande de gel.',
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'dex-defi'],
  practice: ['dex-swap', 'eth-first'],
  blocks: [
    {
      type: 'text',
      md: `Une victime d'escroquerie au faux investissement a envoyé **48 000 USDC sur Solana**. Vous collez l'adresse du destinataire dans un explorateur… et le solde USDC est vide, alors que la transaction est confirmée. Les fonds ne sont pourtant pas perdus : ils sont dans un **compte de jetons** dont ce portefeuille est propriétaire.

Solana repose sur un modèle de comptes original, très différent d'Ethereum. Le maîtriser évite des erreurs grossières — notamment dans les demandes de gel.`,
    },
    { type: 'heading', text: 'Tout est compte' },
    {
      type: 'text',
      md: `Sur Solana, chaque entité est un **compte** identifié par une adresse de 32 octets encodée en **base58** (32 à 44 caractères, par exemple \`7xKX…pQ3m\`). Chaque compte possède :

- un solde en **lamports** (1 SOL = 1 000 000 000 lamports) ;
- un **propriétaire** (*owner*) : le **programme** autorisé à modifier ses données ;
- des **données** (vides pour un simple portefeuille) ;
- un indicateur **exécutable** (vrai pour les programmes).

Les **programmes** (l'équivalent des smart contracts) sont **sans état** : ils stockent leurs données dans d'autres comptes qu'ils possèdent. Un portefeuille ordinaire est un compte possédé par le **System Program**. Pour exister durablement, un compte doit détenir un minimum de lamports (exemption de *rent*), récupérable à sa fermeture.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Lamport', def: 'Plus petite unité de SOL : 10⁻⁹ SOL.' },
        { term: 'Programme', def: 'Code exécutable déployé sur Solana, sans état ; ses données vivent dans des comptes qu\'il possède.' },
        { term: 'System Program', def: 'Programme natif qui crée les comptes et transfère les SOL ; propriétaire des portefeuilles ordinaires.' },
        { term: 'Mint', def: 'Compte qui définit un jeton SPL : offre, décimales, autorité d\'émission, autorité de gel.' },
        { term: 'Compte de jetons', def: 'Compte qui détient le solde d\'un jeton donné pour un propriétaire donné.' },
        { term: 'ATA', def: 'Associated Token Account : compte de jetons dont l\'adresse est dérivée de manière déterministe du portefeuille et du mint.' },
        { term: 'PDA', def: 'Program Derived Address : adresse contrôlée par un programme, sans clé privée.' },
        { term: 'Signature', def: 'Identifiant d\'une transaction (64 octets en base58, environ 87–88 caractères).' },
        { term: 'Fee payer', def: 'Premier signataire, qui paie les frais de la transaction ; pas nécessairement le propriétaire des fonds déplacés.' },
        { term: 'Slot', def: 'Intervalle de production d\'un bloc, de l\'ordre de 400 ms.' },
      ],
    },
    { type: 'heading', text: 'Les jetons SPL et les ATA' },
    {
      type: 'flow',
      nodes: [
        { id: 'w', label: 'Portefeuille 7xKX…pQ3m', kind: 'suspect', sub: 'possédé par System Program' },
        { id: 'ata', label: 'ATA USDC 9fRt…2kLa', kind: 'wallet', sub: 'owner = 7xKX…pQ3m' },
        { id: 'mint', label: 'Mint USDC', kind: 'contract', sub: 'autorité de gel : émetteur' },
        { id: 'tp', label: 'Programme SPL Token', kind: 'contract', sub: 'propriétaire de l\'ATA' },
        { id: 'v', label: 'ATA USDC de la victime', kind: 'victim', sub: '−48 000 USDC' },
      ],
      edges: [
        { from: 'v', to: 'ata', label: 'transfert 48 000 USDC' },
        { from: 'ata', to: 'w', label: 'champ owner', dashed: true },
        { from: 'ata', to: 'mint', label: 'jeton de', dashed: true },
        { from: 'tp', to: 'ata', label: 'contrôle les données', dashed: true },
      ],
      caption: 'Les jetons ne sont pas « dans » le portefeuille : ils sont dans un compte de jetons dont le portefeuille est propriétaire.',
    },
    {
      type: 'text',
      md: `Points clés :

- un transfert de jetons se fait **de compte de jetons à compte de jetons** ; les explorateurs « résolvent » ensuite le propriétaire pour afficher un portefeuille ;
- l'**ATA** est dérivé du triplet portefeuille + programme de jetons + mint : pour un portefeuille et un jeton donnés, son adresse est **unique et prévisible** ;
- un portefeuille peut aussi posséder des comptes de jetons **non associés** (adresses quelconques) : toujours lire le champ \`owner\` ;
- deux programmes de jetons coexistent : **SPL Token** historique et **Token-2022**, qui ajoute des extensions (frais de transfert, délégué permanent, *transfer hooks*, transferts confidentiels…) dont certaines modifient profondément la lecture d'un jeton.`,
    },
    {
      type: 'table',
      headers: ['Notion', 'Ethereum', 'Solana'],
      rows: [
        ['Adresse', '0x + 40 caractères hex', 'Base58, 32 à 44 caractères'],
        ['Identifiant de transaction', 'Hash 0x + 64 hex', 'Signature base58 ~88 caractères'],
        ['Solde de jeton', 'Dans le stockage du contrat du jeton, indexé par adresse', 'Dans un compte de jetons séparé, dont le portefeuille est owner'],
        ['Frais', 'Gaz payé par l\'émetteur (from)', 'Frais de base + priorité, payés par le fee payer (premier signataire)'],
        ['Anti-rejeu', 'Nonce séquentiel par compte', 'Blockhash récent (ou compte de nonce durable)'],
        ['Explorateurs', 'Etherscan et équivalents', 'Solscan, Solana Explorer, SolanaFM'],
      ],
    },
    {
      type: 'check',
      q: 'L\'explorateur indique un solde USDC nul pour un portefeuille qui vient pourtant de recevoir 48 000 USDC. L\'explication la plus probable ?',
      options: [
        'La transaction a échoué',
        'Le solde est porté par un compte de jetons (ATA ou autre) dont ce portefeuille est owner, et la vue consultée n\'affiche que les SOL',
        'Les USDC ont été brûlés',
        'Solana ne gère pas les stablecoins',
      ],
      answer: 1,
      explain: 'Les soldes de jetons sont portés par des comptes de jetons. Il faut consulter l\'onglet des jetons du portefeuille ou le compte de jetons lui-même.',
    },
    { type: 'heading', text: 'Lire une transaction Solana' },
    {
      type: 'steps',
      items: [
        { title: 'Signature et statut', md: `Identifiant, slot, horodatage, succès ou échec. Une transaction échouée a quand même payé des frais.` },
        { title: 'Signataires et fee payer', md: `Le premier signataire paie les frais. Il peut s'agir d'un service (relais, application) distinct du propriétaire des fonds.` },
        { title: 'Instructions', md: `Liste des appels de programmes : \`transfer\` du System Program (SOL), \`transferChecked\` du programme de jetons (SPL), création d'ATA, appels à un agrégateur de swaps…` },
        { title: 'Instructions internes', md: `Appels effectués par les programmes eux-mêmes (*CPI*) : les legs d'un swap y apparaissent, comme les transactions internes sur Ethereum.` },
        { title: 'Variations de soldes', md: `Soldes SOL et jetons avant/après pour chaque compte impliqué : la façon la plus sûre d'établir qui a reçu quoi.` },
        { title: 'Logs de programmes', md: `Messages émis pendant l'exécution, utiles pour confirmer le chemin d'un swap ou une erreur.` },
      ],
    },
    { type: 'widget', id: 'amm-swap', caption: 'Un swap sur un AMM : sur Solana, un agrégateur peut chaîner plusieurs pools dans une seule transaction, visibles dans les instructions internes.' },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ce que la vue brute peut cacher',
      md: `- Les transactions **versionnées** utilisent des tables de recherche d'adresses : certains comptes n'apparaissent qu'une fois la table résolue. Utilisez un explorateur qui les résout.
- Un swap via agrégateur peut toucher une dizaine de pools : ne lisez pas les comptes de pools comme des contreparties humaines.
- Les jetons **Token-2022** avec délégué permanent peuvent être déplacés sans la signature du détenteur ; avec l'extension de transferts confidentiels, les **montants** peuvent être masqués.`,
    },
    { type: 'heading', text: 'Rattacher des comptes : heuristiques propres à Solana' },
    {
      type: 'table',
      headers: ['Heuristique', 'Ce que l\'on observe', 'Force et limites'],
      rows: [
        ['Fee payer commun', 'Le même compte paie les frais de transactions de portefeuilles différents', 'Forte si fee payer privé ; nulle s\'il s\'agit d\'un service de relais ou d\'une application grand public'],
        ['Financement du loyer', 'Le compte qui paie la création d\'un ATA ou d\'un compte de jetons pour un tiers', 'Bonne : révèle qui « prépare » les comptes de réception (souvent l\'opérateur d\'un réseau)'],
        ['Destination de fermeture', 'À la fermeture d\'un compte de jetons, les lamports du loyer sont rendus à un compte désigné', 'Bonne : la destination est choisie par le contrôleur du compte fermé'],
        ['Financement initial en SOL', 'Qui a envoyé les premiers SOL nécessaires aux frais', 'Classique ; faible si la source est un exchange'],
        ['Co-signature', 'Plusieurs signataires sur une même transaction', 'Forte, hors services partagés'],
        ['Timing et montants', 'Séquences régulières, montants identiques, horaires', 'Faible seule, utile en convergence'],
      ],
    },
    {
      type: 'case',
      title: 'Cas — 48 000 USDC et un payeur de loyer',
      md: `Le 7 septembre à 10:12 UTC, la victime envoie 48 000 USDC au portefeuille \`7xKX…pQ3m\` (ATA \`9fRt…2kLa\`). Cet ATA a été **créé la veille** dans une transaction dont le fee payer et le payeur du loyer est \`HbV2…u8Pz\`.

\`HbV2…u8Pz\` a créé et financé, en quinze jours, **23 ATA USDC** pour 23 portefeuilles différents ; 11 d'entre eux ont reçu des fonds de victimes déjà signalées sur des plateformes de signalement.

À 10:31 UTC, \`7xKX…pQ3m\` échange les USDC contre **312,4 SOL** via un agrégateur (6 pools dans les instructions internes), puis ferme l'ATA : les lamports du loyer reviennent à \`HbV2…u8Pz\`. À 11:05 UTC, les SOL partent vers une adresse de dépôt attribuée à Binova.

Analyse : le payeur du loyer et la destination de fermeture désignent le **même opérateur** derrière plusieurs portefeuilles de réception. Lien de confiance **élevée** entre ces portefeuilles, à exposer avec la liste des transactions de création et de fermeture.`,
    },
    {
      type: 'check',
      q: 'Dans le cas précédent, pourquoi la destination de fermeture de l\'ATA est-elle un indice intéressant ?',
      options: [
        'Parce qu\'elle est choisie par celui qui contrôle le compte fermé, qui récupère ainsi le loyer',
        'Parce qu\'elle est toujours un exchange',
        'Parce qu\'elle est imposée par le programme de jetons',
        'Ce n\'est pas un indice',
      ],
      answer: 0,
      explain: 'La destination des lamports libérés est désignée par l\'autorité de fermeture : elle révèle un compte lié au contrôleur.',
    },
    { type: 'heading', text: 'Autorités et gel' },
    {
      type: 'text',
      md: `Chaque mint définit une **autorité d'émission** (*mint authority*) et, éventuellement, une **autorité de gel** (*freeze authority*), visibles sur l'explorateur.

- Les grands stablecoins sur Solana disposent d'une autorité de gel détenue par leur émetteur : le gel se fait **au niveau du compte de jetons**.
- Pour un jeton « memecoin », une autorité d'émission non révoquée permet de créer des jetons à volonté ; une autorité de gel non révoquée permet de bloquer les détenteurs : deux signaux classiques de rug pull.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Demander un gel sur Solana',
      md: `Indiquez à l'émetteur **à la fois** l'adresse du portefeuille propriétaire **et** l'adresse du ou des comptes de jetons concernés (ATA et éventuels comptes non associés), le mint du jeton, les signatures des transactions d'arrivée et le solde constaté avec son horodatage. Une demande qui ne vise que le portefeuille peut être mal exécutée ou contournée par un compte de jetons secondaire.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Outils et preuve',
      md: `Solscan, Solana Explorer et SolanaFM présentent différemment les mêmes données : en cas de doute, comparez. Pour une pièce de procédure, exportez la transaction brute via un nœud RPC (méthode \`getTransaction\`, liste des signatures d'une adresse via \`getSignaturesForAddress\`), conservez le JSON horodaté et son empreinte, et indiquez le point d'accès utilisé.`,
    },
  ],
  keyPoints: [
    'Tout est compte : lamports, owner (programme), données ; les programmes sont sans état.',
    'Les soldes de jetons sont portés par des comptes de jetons distincts ; l\'ATA est dérivé du portefeuille et du mint.',
    'Toujours lire le champ owner d\'un compte de jetons pour identifier le vrai détenteur.',
    'Le fee payer (premier signataire) n\'est pas forcément le propriétaire des fonds.',
    'Heuristiques propres : payeur du loyer, destination de fermeture, fee payer privé, financement initial.',
    'Gel : viser le mint, le portefeuille et les comptes de jetons ; vérifier l\'autorité de gel.',
    'Token-2022 : extensions (délégué permanent, transferts confidentiels) à repérer avant de conclure.',
  ],
  quiz: [
    {
      q: 'Sur Solana, où est stocké le solde USDC d\'un portefeuille ?',
      options: [
        'Dans le compte du portefeuille lui-même',
        'Dans le stockage du programme USDC',
        'Dans un compte de jetons (souvent l\'ATA) dont le portefeuille est owner',
        'Dans le mint USDC',
      ],
      answer: 2,
      explain: 'Chaque solde de jeton est porté par un compte de jetons distinct, associé à un mint et à un propriétaire.',
    },
    {
      q: 'Combien de lamports compte 1 SOL ?',
      options: ['10⁶', '10⁸', '10⁹', '10¹⁸'],
      answer: 2,
      explain: '1 SOL = 1 000 000 000 lamports (10⁻⁹ SOL par lamport). 10¹⁸ correspond au wei d\'Ethereum, 10⁸ au satoshi.',
    },
    {
      q: 'Le fee payer d\'une transaction Solana est nécessairement le propriétaire des jetons transférés.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Le premier signataire paie les frais ; ce peut être une application ou un relais distinct du propriétaire des fonds.',
    },
    {
      q: 'Quels éléments sont de bons indices de rattachement de plusieurs portefeuilles à un même opérateur sur Solana ?',
      kind: 'multi',
      options: [
        'Un même compte privé paie la création de leurs ATA',
        'Les lamports de fermeture de leurs comptes de jetons reviennent au même compte',
        'Ils ont tous interagi avec le programme SPL Token',
        'Un même fee payer privé signe leurs transactions',
      ],
      answer: [0, 1, 3],
      explain: 'Tous les détenteurs de jetons interagissent avec le programme SPL Token : ce n\'est pas discriminant. Les trois autres éléments révèlent un contrôleur commun.',
    },
    {
      q: 'Que faut-il indiquer dans une demande de gel d\'USDC sur Solana ?',
      kind: 'multi',
      options: [
        'L\'adresse du portefeuille propriétaire',
        'L\'adresse du ou des comptes de jetons concernés',
        'Le mint et les signatures des transactions d\'arrivée',
        'La clé privée de la victime',
      ],
      answer: [0, 1, 2],
      explain: 'Le gel s\'applique au compte de jetons : il faut le désigner précisément, avec le portefeuille, le mint et les transactions. La clé privée de la victime n\'a évidemment rien à faire dans une demande.',
    },
    {
      q: 'Où apparaissent les différents legs d\'un swap réalisé via un agrégateur dans une transaction Solana ?',
      options: [
        'Dans le champ memo',
        'Dans les instructions internes (appels entre programmes) et les variations de soldes',
        'Dans une transaction séparée par pool',
        'Ils n\'apparaissent pas',
      ],
      answer: 1,
      explain: 'L\'agrégateur appelle les programmes des pools : ces appels internes et les variations de soldes avant/après montrent le chemin.',
    },
  ],
  flashcards: [
    { front: 'Compte Solana', back: 'Adresse base58 + lamports + owner (programme) + données + indicateur exécutable.' },
    { front: 'Lamport', back: '10⁻⁹ SOL.' },
    { front: 'ATA', back: 'Compte de jetons dérivé du portefeuille, du programme de jetons et du mint : adresse unique et prévisible.' },
    { front: 'Champ owner d\'un compte de jetons', back: 'Désigne le portefeuille propriétaire du solde : à lire systématiquement.' },
    { front: 'Fee payer', back: 'Premier signataire, paie les frais ; pas forcément le propriétaire des fonds.' },
    { front: 'Signature Solana', back: 'Identifiant de transaction, 64 octets en base58 (~88 caractères).' },
    { front: 'Payeur du loyer', back: 'Compte qui finance la création d\'un compte de jetons pour un tiers : indice d\'opérateur commun.' },
    { front: 'Autorité de gel', back: 'Définie au niveau du mint ; permet de geler des comptes de jetons.' },
    { front: 'Token-2022', back: 'Programme de jetons à extensions : frais de transfert, délégué permanent, transferts confidentiels…' },
    { front: 'Explorateurs Solana', back: 'Solscan, Solana Explorer, SolanaFM ; export brut via RPC getTransaction.' },
  ],
}

const smartContracts: Lesson = {
  id: 'smart-contracts-lecture',
  title: 'Lire un smart contract : input data, logs, événements',
  level: 4,
  track: 'comptes',
  minutes: 35,
  summary:
    'Décoder ce qu\'une transaction a réellement demandé et produit : sélecteurs de fonction, encodage ABI des paramètres, événements et topics, transactions internes (traces), proxies et implémentations, code vérifié, déployeur. Application à un drainer et méthode de conservation des preuves brutes.',
  objectives: [
    'Décoder l\'input data d\'une transaction : sélecteur de fonction et paramètres encodés ABI.',
    'Lire les logs d\'un reçu : topic0, paramètres indexés, champ data, et reconnaître Transfer et Approval.',
    'Expliquer pourquoi les mouvements d\'ETH natif par contrat n\'apparaissent que dans les traces.',
    'Identifier un proxy, son implémentation et le déployeur d\'un contrat, et en tirer des pistes d\'attribution.',
    'Conserver les données brutes de façon reproductible pour la procédure.',
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'drainers-approvals'],
  practice: ['dex-swap', 'defi-exploit', 'rugpull-bsc'],
  blocks: [
    {
      type: 'text',
      md: `La victime affirme avoir « juste cliqué sur Claim ». L'explorateur indique une transaction de valeur nulle vers le contrat d'un stablecoin, sans aucun transfert. Trois minutes plus tard, tous ses jetons sont partis. Pour comprendre — et l'écrire dans un procès-verbal —, il faut savoir lire ce que la transaction contenait **réellement**.

Un smart contract ne se lit pas comme un relevé bancaire. Mais avec quatre notions — **input data**, **logs**, **traces**, **proxies** — vous pouvez reconstituer presque n'importe quelle interaction.`,
    },
    { type: 'heading', text: 'L\'input data : ce que la transaction demande' },
    {
      type: 'text',
      md: `Une transaction vers un contrat transporte un champ **input data** :

- les **4 premiers octets** forment le **sélecteur de fonction** : les 4 premiers octets du hash Keccak-256 de la signature canonique de la fonction, par exemple \`transfer(address,uint256)\` ;
- la suite contient les **paramètres encodés ABI** : des mots de **32 octets** (64 caractères hexadécimaux), une adresse étant complétée à gauche par des zéros, un entier écrit en hexadécimal.

Si le code source est **vérifié** sur l'explorateur, celui-ci décode automatiquement. Sinon, des bases publiques de signatures (de type « 4byte ») proposent la fonction correspondant à un sélecteur — avec prudence, car plusieurs signatures peuvent partager le même sélecteur.`,
    },
    {
      type: 'table',
      headers: ['Sélecteur', 'Fonction', 'Ce que cela signifie pour l\'enquête'],
      rows: [
        ['`0xa9059cbb`', '`transfer(address,uint256)`', 'Le titulaire envoie lui-même des jetons'],
        ['`0x23b872dd`', '`transferFrom(address,address,uint256)`', 'Un tiers déplace des jetons en vertu d\'une autorisation'],
        ['`0x095ea7b3`', '`approve(address,uint256)`', 'Le titulaire autorise un tiers (souvent pour un montant illimité)'],
        ['`0x39509351`', '`increaseAllowance(address,uint256)`', 'Augmente une autorisation existante'],
        ['`0xa22cb465`', '`setApprovalForAll(address,bool)`', 'Autorise un tiers sur toute une collection NFT (ERC-721/1155)'],
        ['`0xd505accf`', '`permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`', 'Autorisation par signature hors chaîne (EIP-2612), soumise par n\'importe qui'],
      ],
      caption: 'Ces sélecteurs sont fixes : ils se reconnaissent à l\'œil nu, même sur un contrat non vérifié.',
    },
    {
      type: 'steps',
      items: [
        { title: 'Isoler le sélecteur', md: `Input : \`0xa9059cbb\` suivi de 128 caractères hex. Sélecteur \`0xa9059cbb\` → \`transfer(address,uint256)\`.` },
        { title: 'Lire le premier mot (adresse)', md: `\`000000000000000000000000\` + \`4b2e…c91f\` (40 caractères) → destinataire \`0x4b2e…c91f\`.` },
        { title: 'Lire le second mot (montant)', md: `\`…000000009502f900\` → 0x9502F900 = 2 500 000 000 en décimal.` },
        { title: 'Appliquer les décimales du jeton', md: `Le contrat appelé est l'USDT, à 6 décimales : 2 500 000 000 / 10⁶ = **2 500 USDT**.` },
        { title: 'Confronter aux logs', md: `L'événement \`Transfer\` émis doit confirmer l'émetteur, le destinataire et le montant. Si l'appel a échoué (*revert*), aucun transfert n'a eu lieu, même si l'input l'annonçait.` },
      ],
    },
    {
      type: 'check',
      q: 'Une transaction de la victime vers le contrat d\'un jeton commence par 0x095ea7b3. Qu\'a-t-elle fait ?',
      options: [
        'Elle a transféré des jetons',
        'Elle a accordé une autorisation de dépense (approve) à l\'adresse figurant dans le premier paramètre',
        'Elle a reçu des jetons',
        'Elle a brûlé des jetons',
      ],
      answer: 1,
      explain: '0x095ea7b3 est le sélecteur d\'approve(address,uint256) : le premier paramètre est le bénéficiaire de l\'autorisation, le second le montant (souvent la valeur maximale).',
    },
    { type: 'heading', text: 'Les logs : ce que la transaction a produit' },
    {
      type: 'text',
      md: `Pendant l'exécution, les contrats émettent des **événements**, enregistrés dans le **reçu** de la transaction sous forme de **logs**. Chaque log contient :

- l'**adresse** du contrat émetteur (pour un jeton, le contrat du jeton) ;
- jusqu'à **4 topics** de 32 octets : \`topic0\` est le hash Keccak-256 de la signature de l'événement, les suivants portent les paramètres déclarés \`indexed\` ;
- un champ **data** contenant les paramètres non indexés, encodés ABI.

L'événement ERC-20 \`Transfer(address indexed from, address indexed to, uint256 value)\` a pour \`topic0\` \`0xddf252ad…b3ef\` : \`topic1\` = émetteur, \`topic2\` = destinataire, \`data\` = montant. Les transferts ERC-721 partagent le même \`topic0\`, mais l'identifiant du NFT y est indexé (4 topics au lieu de 3) : c'est ainsi qu'on distingue un transfert de NFT d'un transfert de jetons fongibles.`,
    },
    {
      type: 'table',
      headers: ['Champ du log', 'Valeur (exemple)', 'Lecture'],
      rows: [
        ['address', '`0xdac1…1ec7`', 'Contrat USDT : c\'est lui qui émet l\'événement'],
        ['topic0', '`0xddf252ad…b3ef`', 'Signature de Transfer(address,address,uint256)'],
        ['topic1', '`0x000…a17f…09be`', 'from = adresse de la victime'],
        ['topic2', '`0x000…4b2e…c91f`', 'to = adresse du destinataire'],
        ['data', '`0x…9502f900`', 'value = 2 500 000 000 → 2 500 USDT'],
      ],
      caption: 'Le topic0 de Approval(address,address,uint256) est 0x8c5be1e5…b925 : il signale chaque autorisation accordée.',
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Un événement n\'est qu\'une déclaration du contrat',
      md: `N'importe quel contrat peut émettre un événement \`Transfer\` : c'est d'ailleurs ce qu'exploitent les escroqueries à l'empoisonnement d'adresse et les faux jetons qui imitent un vrai (même nom, même symbole). Vérifiez toujours **l'adresse du contrat émetteur** : un « USDT » émis par un contrat qui n'est pas celui de l'émetteur officiel n'a aucune valeur.`,
    },
    { type: 'heading', text: 'Les traces : l\'ETH qui ne laisse pas de log' },
    {
      type: 'compare',
      left: {
        title: 'Logs (événements)',
        md: `- Émis volontairement par le code du contrat.
- Couvrent les transferts de jetons (ERC-20, ERC-721…) et les actions métier (swap, dépôt, retrait).
- Lisibles dans le reçu : présents sur tout nœud.`,
      },
      right: {
        title: 'Traces (transactions internes)',
        md: `- Reconstituées en rejouant l'exécution : appels entre contrats et **transferts d'ETH natif** par des contrats.
- Un contrat qui envoie de l'ETH n'émet **aucun** événement par défaut : seul l'onglet « transactions internes » le montre.
- Nécessitent un nœud ou un service d'archivage avec traçage.`,
      },
    },
    { type: 'widget', id: 'amm-swap', caption: 'Un swap produit plusieurs legs : transferts de jetons dans les logs, éventuel ETH natif dans les traces. Repérez chacun.' },
    {
      type: 'check',
      q: 'Un contrat de drainer a reversé 3,2 ETH à son opérateur. Où le voit-on ?',
      options: [
        'Dans les logs Transfer de la transaction',
        'Dans les transactions internes (traces) de la transaction',
        'Dans l\'input data',
        'On ne peut pas le voir',
      ],
      answer: 1,
      explain: 'Les transferts d\'ETH natif effectués par un contrat ne génèrent pas d\'événement par défaut : ils n\'apparaissent que dans les traces.',
    },
    { type: 'heading', text: 'Proxies, code vérifié et déployeur' },
    {
      type: 'text',
      md: `Beaucoup de contrats sont des **proxies** : l'adresse appelée ne contient qu'un mécanisme de délégation (\`delegatecall\`) vers un **contrat d'implémentation** qui porte la logique. Le standard le plus courant (EIP-1967) range l'adresse de l'implémentation dans un emplacement de stockage normalisé ; les explorateurs proposent alors une vue « lire / écrire en tant que proxy ».

Conséquences pour l'enquête :

- la logique d'un contrat peut **changer** : un administrateur peut mettre à niveau l'implémentation. Vérifiez quelle implémentation était active **à la date des faits** (événements de mise à niveau, historique) ;
- une clé d'administration capable de mettre à niveau ou de vider un contrat est un point de contrôle centralisé — et une piste vers une personne ;
- le **déployeur** (*contract creator*) d'un contrat est un EOA : son financement, ses autres déploiements et ses retraits sont des pistes d'attribution de premier ordre.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Code vérifié : utile, pas suffisant',
      md: `Un code source « vérifié » prouve seulement que le code publié compile vers le bytecode déployé. Il ne dit rien des intentions : un drainer peut être vérifié et porter des noms de fonctions trompeurs (\`Claim\`, \`SecurityUpdate\`). À l'inverse, un contrat non vérifié se lit par ses sélecteurs, ses événements et son comportement observé ; les décompilateurs aident, mais leur sortie est une **reconstruction** à présenter comme telle.`,
    },
    {
      type: 'case',
      title: 'Cas — Le bouton « Claim »',
      md: `Le 21 janvier à 18:04 UTC, la victime \`0xa17f…09be\`, sur un faux site d'« airdrop », clique sur « Claim » et valide la transaction proposée par son portefeuille. Sur l'explorateur : transaction de la victime vers le **contrat USDC**, valeur nulle, input commençant par \`0x095ea7b3\` — un \`approve\`. Premier paramètre : \`0x6c3d…e2a0\` (contrat non vérifié, déployé deux jours plus tôt) ; second paramètre : la valeur entière maximale (\`0xffff…ffff\`). Log émis : **Approval** (\`owner\` = victime, \`spender\` = \`0x6c3d…e2a0\`).

À 18:07 UTC, une transaction émise par \`0x88b1…4f10\` appelle une fonction de \`0x6c3d…e2a0\`, qui exécute un \`transferFrom\` sur le contrat USDC : log **Transfer** de 41 870 USDC de la victime vers le contrat, puis deux logs Transfer : **33 496 USDC** (80 %) vers \`0x88b1…4f10\` et **8 374 USDC** (20 %) vers \`0x2f9a…77c3\`.

Le déployeur de \`0x6c3d…e2a0\` est \`0x88b1…4f10\`, financé par un retrait d'exchange. Le partage 80/20 est caractéristique d'un « drainer-as-a-service » : opérateur du kit d'un côté, affilié de l'autre. Le libellé « Claim » n'existait que sur le site : la chaîne, elle, enregistre une autorisation illimitée signée par la victime.`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 'v', label: 'Victime 0xa17f…', kind: 'victim' },
        { id: 'c', label: 'Contrat 0x6c3d…', kind: 'contract', sub: 'non vérifié' },
        { id: 'op', label: '0x88b1…', kind: 'suspect', sub: 'déployeur, 80 %' },
        { id: 'af', label: '0x2f9a…', kind: 'suspect', sub: '20 %' },
        { id: 'ex', label: 'Exchange', kind: 'exchange', sub: 'financement du déployeur' },
      ],
      edges: [
        { from: 'v', to: 'c', label: 'Approval illimitée' },
        { from: 'c', to: 'op', label: '33 496 USDC' },
        { from: 'c', to: 'af', label: '8 374 USDC' },
        { from: 'ex', to: 'op', label: 'retrait (ETH pour le gaz)' },
      ],
      caption: 'Les logs Approval et Transfer racontent toute l\'histoire ; le déployeur et son financement ouvrent la piste d\'identification.',
    },
    {
      type: 'terms',
      items: [
        { term: 'ABI', def: 'Interface binaire d\'un contrat : décrit fonctions, paramètres et événements, et leur encodage.' },
        { term: 'Sélecteur', def: '4 premiers octets du Keccak-256 de la signature d\'une fonction.' },
        { term: 'Topic0', def: 'Keccak-256 de la signature d\'un événement : identifie le type d\'événement.' },
        { term: 'Paramètre indexé', def: 'Paramètre d\'événement placé dans un topic, donc filtrable ; les autres vont dans data.' },
        { term: 'Trace', def: 'Reconstitution de l\'exécution : appels internes et transferts d\'ETH par des contrats.' },
        { term: 'delegatecall', def: 'Appel qui exécute le code d\'un autre contrat dans le contexte (stockage, solde) de l\'appelant : base des proxies.' },
        { term: 'Revert', def: 'Échec de l\'exécution : tous les effets sont annulés, mais les frais sont payés.' },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Conserver la preuve brute',
      md: `Une capture d'écran d'explorateur est une illustration, pas une source primaire. Pour chaque transaction déterminante, conservez la **transaction** et le **reçu** bruts obtenus d'un nœud (méthodes RPC \`eth_getTransactionByHash\` et \`eth_getTransactionReceipt\`), et si nécessaire la trace. Notez la date, le nœud ou le fournisseur utilisé, calculez l'empreinte des fichiers. N'importe quel expert pourra rejouer la vérification sur un autre nœud : c'est la reproductibilité qui rend la lecture opposable.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : la routine de lecture',
      md: `1. Vue générale : from, to, valeur, statut, frais.
2. Input data : sélecteur, paramètres décodés.
3. Logs : chaque événement, avec le contrat émetteur.
4. Transactions internes : ETH natif déplacé par des contrats.
5. Contrat appelé : vérifié ? proxy ? déployeur ? date de déploiement ?
6. Synthèse : qui a autorisé quoi, qui a déplacé quoi, vers qui.`,
    },
  ],
  keyPoints: [
    'L\'input data = sélecteur de 4 octets + paramètres ABI en mots de 32 octets.',
    'Sélecteurs à connaître : transfer 0xa9059cbb, transferFrom 0x23b872dd, approve 0x095ea7b3, setApprovalForAll 0xa22cb465.',
    'Les logs (topic0 = signature, topics indexés, data) disent ce que la transaction a produit ; vérifier le contrat émetteur.',
    'L\'ETH natif déplacé par un contrat n\'apparaît que dans les traces (transactions internes).',
    'Proxy : la logique est dans l\'implémentation, qui peut changer ; vérifier celle active à la date des faits.',
    'Le déployeur d\'un contrat est une piste d\'attribution de premier ordre.',
    'Conserver transaction, reçu et trace bruts, horodatés et hachés, pour une lecture reproductible.',
  ],
  quiz: [
    {
      q: 'Comment est calculé le sélecteur d\'une fonction ?',
      options: [
        'Ce sont les 4 premiers octets du Keccak-256 de sa signature canonique',
        'C\'est un numéro attribué par l\'explorateur',
        'C\'est le hash SHA-256 du code du contrat',
        'C\'est l\'adresse du contrat tronquée',
      ],
      answer: 0,
      explain: 'Par exemple, les 4 premiers octets du Keccak-256 de transfer(address,uint256) donnent 0xa9059cbb.',
    },
    {
      q: 'Dans un log Transfer ERC-20, où trouve-t-on le montant transféré ?',
      options: ['Dans topic0', 'Dans topic1', 'Dans le champ data', 'Dans l\'input data'],
      answer: 2,
      explain: 'from et to sont indexés (topic1, topic2) ; value n\'est pas indexé et figure dans data.',
    },
    {
      q: 'Quelles informations sont présentes dans un log d\'événement ?',
      kind: 'multi',
      options: [
        'L\'adresse du contrat qui l\'a émis',
        'Les topics (signature de l\'événement et paramètres indexés)',
        'La clé privée de l\'émetteur',
        'Le champ data avec les paramètres non indexés',
      ],
      answer: [0, 1, 3],
      explain: 'Un log comporte l\'adresse émettrice, jusqu\'à 4 topics et un champ data. Aucune clé privée ne figure jamais sur la chaîne.',
    },
    {
      q: 'Un contrat qui envoie 5 ETH à une adresse au cours d\'une transaction peut ne laisser aucun événement dans les logs : l\'envoi ne se lit alors que dans les traces.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: 'Vrai. Les transferts d\'ETH natif par contrat n\'émettent pas d\'événement par défaut (sauf si le code du contrat en émet un volontairement) ; ils se lisent dans les traces (transactions internes).',
    },
    {
      q: 'Un faux « USDT » apparaît dans l\'historique d\'une victime avec un événement Transfer. Quel contrôle est décisif ?',
      options: [
        'Vérifier le symbole du jeton',
        'Vérifier l\'adresse du contrat émetteur de l\'événement par rapport au contrat officiel',
        'Vérifier le nombre de décimales',
        'Vérifier l\'heure du bloc',
      ],
      answer: 1,
      explain: 'Nom et symbole sont librement choisis par un contrat imitateur ; seule l\'adresse du contrat fait foi.',
    },
    {
      q: 'Pourquoi faut-il vérifier l\'implémentation active d\'un proxy à la date des faits ?',
      options: [
        'Parce que l\'adresse du proxy change à chaque bloc',
        'Parce qu\'un administrateur peut mettre à niveau l\'implémentation et donc changer la logique du contrat',
        'Parce que les proxies ne sont jamais vérifiés',
        'Ce n\'est pas nécessaire',
      ],
      answer: 1,
      explain: 'Le comportement d\'un proxy dépend de l\'implémentation vers laquelle il délègue, qui peut être remplacée.',
    },
    {
      q: 'Quelles pièces conserver pour qu\'une lecture de transaction soit reproductible ?',
      kind: 'multi',
      options: [
        'La transaction brute et le reçu obtenus d\'un nœud',
        'La date, le nœud ou fournisseur utilisé et l\'empreinte des fichiers',
        'Uniquement une capture d\'écran de l\'explorateur',
        'La trace d\'exécution si des transactions internes sont en jeu',
      ],
      answer: [0, 1, 3],
      explain: 'La capture illustre mais ne permet pas de rejouer la vérification. Les données brutes, leur provenance et leur empreinte le permettent.',
    },
  ],
  flashcards: [
    { front: 'Sélecteur de fonction', back: '4 premiers octets du Keccak-256 de la signature, en tête de l\'input data.' },
    { front: '0xa9059cbb', back: 'transfer(address,uint256)' },
    { front: '0x23b872dd', back: 'transferFrom(address,address,uint256) : un tiers déplace des jetons autorisés.' },
    { front: '0x095ea7b3', back: 'approve(address,uint256) : autorisation de dépense.' },
    { front: 'Encodage ABI', back: 'Mots de 32 octets ; adresses complétées à gauche par des zéros ; entiers en hexadécimal.' },
    { front: 'Topic0', back: 'Keccak-256 de la signature de l\'événement. Transfer = 0xddf252ad…' },
    { front: 'Transfer ERC-721 vs ERC-20', back: 'Même topic0, mais 4 topics pour l\'ERC-721 (tokenId indexé) contre 3.' },
    { front: 'Transactions internes', back: 'Traces d\'exécution : seules à montrer l\'ETH natif envoyé par un contrat.' },
    { front: 'Proxy EIP-1967', back: 'Délègue par delegatecall à une implémentation, dont l\'adresse est dans un emplacement de stockage normalisé.' },
    { front: 'Déployeur', back: 'EOA ayant créé le contrat : financement et autres déploiements = pistes d\'attribution.' },
    { front: 'Preuve brute', back: 'eth_getTransactionByHash + eth_getTransactionReceipt, horodatés, hachés, nœud indiqué.' },
  ],
}

export const L4_CHAINES: Lesson[] = [lightning, layer2, solana, smartContracts]
