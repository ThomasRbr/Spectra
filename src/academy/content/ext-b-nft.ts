// Niveau 3 — Typologies : NFT, wash trading, vols et blanchiment.
// Collections, places de marché nommées, portefeuilles et adresses : FICTIFS.
// Les protocoles et standards réels (ERC-721, ERC-1155, EIP-2981…) sont décrits
// de manière neutre.
import type { Lesson } from '../model'

export const LESSON_NFT: Lesson = {
  id: 'nft-fraudes',
  title: 'NFT : wash trading, vols et blanchiment',
  level: 3,
  track: 'typologies',
  minutes: 35,
  summary: `Un NFT n'est qu'une ligne dans un contrat : un identifiant et un propriétaire. Mais son prix est libre, subjectif et fixé entre parties qui peuvent être la même personne. D'où trois usages criminels : gonfler des volumes et des prix (wash trading), justifier des fonds sales par une « vente d'art numérique », et voler des collections par phishing. Standards, règlement d'une vente, signatures de wash trading, blanchiment, drainers, faux mints, méthode d'analyse et réquisitions aux places de marché.`,
  objectives: [
    `Lire un NFT on-chain : contrat, tokenId, événements de transfert, mint, approbations (setApprovalForAll).`,
    `Décomposer une vente sur une place de marché : ordre signé hors chaîne, règlement, répartition du paiement, redevances.`,
    `Démontrer un wash trading : financement commun, allers-retours de fonds, chronologie, prix aberrants.`,
    `Reconnaître un blanchiment par achat surévalué et un vol de NFT par signature malveillante.`,
    `Formuler des réquisitions utiles à une place de marché et situer les qualifications possibles.`,
  ],
  prerequisites: ['tokens-erc20', 'drainers-approvals', 'dex-defi', 'attribution-sources'],
  practice: ['dex-swap', 'eth-first'],
  blocks: [
    {
      type: 'text',
      md: `En trois semaines, la collection **Lumen Owls** passe d'un prix plancher de 0,08 ETH à 2,4 ETH. Son volume de ventes la place dans les classements des places de marché, des comptes influents s'enthousiasment, des acheteurs affluent. Un mois plus tard, le prix s'effondre.

L'analyse montre que **71 % du volume** a été échangé entre 26 portefeuilles financés par la même adresse, et qu'une seule « vente » à 85 ETH a servi à faire entrer, sous l'apparence d'une plus-value artistique, des fonds issus d'un piratage. Le NFT est un objet parfait pour cela : **unique, sans prix de référence, transférable en une transaction**.`,
    },
    { type: 'heading', text: 'Ce qu’est (vraiment) un NFT' },
    {
      type: 'terms',
      items: [
        { term: 'ERC-721', def: `Standard de jeton non fongible sur Ethereum et chaînes EVM : chaque jeton a un tokenId unique et un seul propriétaire (ownerOf).` },
        { term: 'ERC-1155', def: `Standard multi-jetons : un même contrat gère des jetons identifiés par un id, chacun pouvant exister en plusieurs exemplaires (quantités).` },
        { term: 'Collection', def: `En pratique, un contrat de NFT ; son adresse identifie la collection, bien plus sûrement que son nom.` },
        { term: 'tokenId', def: `Numéro du jeton dans le contrat. Le couple (contrat, tokenId) identifie un NFT de façon unique.` },
        { term: 'tokenURI / métadonnées', def: `Lien vers la description et l'image, souvent stockées hors chaîne (IPFS, serveur) ; l'image n'est presque jamais sur la blockchain.` },
        { term: 'Mint', def: `Création d'un NFT : événement Transfer depuis l'adresse nulle (0x000…000) vers le premier propriétaire.` },
        { term: 'setApprovalForAll', def: `Autorisation donnée à un opérateur de transférer tous les NFT d'une collection appartenant au signataire.` },
        { term: 'Redevances (royalties)', def: `Pourcentage du prix reversé au créateur à chaque revente. La norme EIP-2981 les signale ; leur paiement dépend de la place de marché.` },
        { term: 'Prix plancher (floor)', def: `Prix de la mise en vente la moins chère d'une collection ; indicateur de marché facile à manipuler.` },
      ],
    },
    {
      type: 'table',
      caption: `Événements à lire selon le standard`,
      headers: ['Standard', 'Événement de transfert', 'Mint', 'Autorisation'],
      rows: [
        ['ERC-721', '`Transfer(from, to, tokenId)`', '`from` = adresse nulle', '`Approval` (un jeton), `ApprovalForAll` (toute la collection)'],
        ['ERC-1155', '`TransferSingle` / `TransferBatch` (id, quantité)', '`from` = adresse nulle', '`ApprovalForAll`'],
        ['ERC-20 (paiement)', '`Transfer(from, to, value)` (WETH, USDC…)', '—', '`Approval(owner, spender, value)`'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le nom et l’image ne prouvent rien',
      md: `N'importe qui peut déployer un contrat nommé comme une collection célèbre, avec les mêmes images. Identifiez toujours une collection par l'**adresse de son contrat** et un NFT par le couple **(contrat, tokenId)**. Les métadonnées hors chaîne peuvent être modifiées ou disparaître : archivez-les à la date de vos constatations.`,
    },
    { type: 'heading', text: 'Comment se règle une vente sur une place de marché' },
    {
      type: 'steps',
      items: [
        { title: 'Approbation', md: `La première fois qu'il vend dans une collection, le vendeur signe un \`setApprovalForAll\` au profit du contrat de la place de marché (ou de son intermédiaire technique). C'est une transaction on-chain.` },
        { title: 'Mise en vente', md: `Le vendeur signe **hors chaîne** un ordre : tel NFT, tel prix, telle durée. L'ordre est stocké par la place de marché ; rien n'apparaît sur la chaîne.` },
        { title: 'Achat', md: `L'acheteur soumet l'ordre au contrat de règlement (par exemple le protocole Seaport, utilisé notamment par OpenSea) en payant le prix.` },
        { title: 'Règlement atomique', md: `Dans la même transaction : le NFT passe du vendeur à l'acheteur, le paiement est réparti entre vendeur, frais de la place de marché et redevances éventuelles.` },
        { title: 'Offres', md: `À l'inverse, un acheteur peut signer une **offre** en WETH (ETH « enveloppé » en ERC-20) ; le vendeur l'accepte, le WETH est prélevé en vertu d'une approbation.` },
      ],
    },
    {
      type: 'flow',
      caption: `Une vente vue dans une seule transaction de règlement.`,
      nodes: [
        { id: 'b', label: 'Acheteur', kind: 'wallet', sub: '0x5c1e…a9F2' },
        { id: 'mk', label: 'Contrat de règlement', kind: 'contract', sub: 'place de marché' },
        { id: 's', label: 'Vendeur', kind: 'wallet', sub: '0xB07d…11c4' },
        { id: 'fee', label: 'Frais de la plateforme', kind: 'service' },
        { id: 'roy', label: 'Créateur', kind: 'wallet', sub: 'redevances' },
      ],
      edges: [
        { from: 'b', to: 'mk', label: '2,40 ETH' },
        { from: 'mk', to: 's', label: '2,27 ETH' },
        { from: 'mk', to: 'fee', label: '0,06 ETH' },
        { from: 'mk', to: 'roy', label: '0,07 ETH' },
        { from: 's', to: 'b', label: 'Lumen Owls #4417', dashed: true },
      ],
    },
    { type: 'heading', text: 'Wash trading : se vendre à soi-même' },
    {
      type: 'text',
      md: `Le **wash trading** consiste à acheter et vendre un actif **avec soi-même** (ou avec des complices) pour créer une illusion d'activité. Sur les NFT, les motivations sont multiples :

- **gonfler le volume** d'une collection pour la faire apparaître dans les classements et attirer de vrais acheteurs ;
- **établir un prix** de référence élevé pour un NFT ou faire monter le plancher, avant de vendre à des tiers ;
- **capter des récompenses** distribuées par certaines places de marché en fonction du volume échangé ;
- **justifier des fonds** : une « vente » à prix élevé donne une apparence légale à un paiement (voir le blanchiment, plus bas).

Contrairement à un exchange centralisé, tout est visible : le NFT, le paiement, et surtout **l'origine des fonds** de chaque portefeuille.`,
    },
    {
      type: 'table',
      caption: `Indicateurs de wash trading et leur force probante`,
      headers: ['Indicateur', 'Comment le mesurer', 'Force'],
      rows: [
        ['Financement commun', 'Acheteur et vendeur approvisionnés en ETH par la même adresse ou le même retrait d’exchange', 'Forte'],
        ['Aller-retour des fonds', 'Le vendeur renvoie le produit de la vente à l’acheteur (ou à l’adresse source)', 'Forte'],
        ['Allers-retours du NFT', 'Le même tokenId circule A → B → A en peu de temps', 'Forte'],
        ['Prix aberrant', 'Vente très au-dessus du plancher, sans offre comparable', 'Moyenne'],
        ['Chronologie serrée', 'Financement, mise en vente et achat en quelques minutes', 'Moyenne à forte'],
        ['Portefeuilles sans autre activité', 'Créés pour l’occasion, inactifs ensuite', 'Moyenne'],
        ['Volume concentré', 'Une poignée d’adresses représente l’essentiel des ventes', 'Moyenne'],
      ],
    },
    {
      type: 'flow',
      caption: `Boucle de wash trading : la même mise circule, le volume affiché s'accumule.`,
      nodes: [
        { id: 'src', label: 'Source commune', kind: 'suspect', sub: '0x9aD4…77e0' },
        { id: 'a', label: 'Portefeuille A', kind: 'wallet', sub: '0x5c1e…a9F2' },
        { id: 'b', label: 'Portefeuille B', kind: 'wallet', sub: '0xB07d…11c4' },
        { id: 'mk', label: 'Place de marché', kind: 'contract' },
      ],
      edges: [
        { from: 'src', to: 'a', label: '3,0 ETH' },
        { from: 'src', to: 'b', label: '0,05 ETH (frais)' },
        { from: 'a', to: 'mk', label: 'achète #4417 à B · 2,4 ETH' },
        { from: 'mk', to: 'b', label: '2,27 ETH' },
        { from: 'b', to: 'a', label: 'renvoie 2,27 ETH', dashed: true },
        { from: 'b', to: 'src', label: 'solde final', dashed: true },
      ],
    },
    { type: 'widget', id: 'timing-correlation', caption: `Montant et délai : la même corrélation relie le produit d'une vente au financement de l'achat suivant dans une boucle de wash trading.` },
    {
      type: 'callout',
      kind: 'example',
      title: 'Un cas public spectaculaire',
      md: `En octobre 2021, un NFT de la collection CryptoPunks a été « vendu » pour environ **124 000 ETH** (plus de 500 millions de dollars à l'époque). L'analyse publique de la transaction a montré que l'acheteur et le vendeur étaient la même personne, qui avait emprunté les fonds par un **prêt flash** et les avait remboursés dans la même transaction. Le NFT a été remis en vente juste après, à un prix bien supérieur à ce qu'il valait réellement. Leçon : un prix record ne prouve aucune valeur.`,
    },
    {
      type: 'check',
      q: `Le portefeuille A achète un NFT 4 ETH au portefeuille B. Douze minutes plus tard, B transfère 3,9 ETH à A. Les deux ont été financés la veille par le même retrait d'un exchange. Que concluez-vous ?`,
      options: [
        `Une vente ordinaire suivie d'un remboursement commercial`,
        `Un drainer a vidé B`,
        `Un wash trading très probable : financement commun et retour des fonds`,
        `Une erreur d'affichage de la place de marché`,
      ],
      answer: 2,
      explain: `Le financement commun relie les deux portefeuilles à une même source ; le retour quasi intégral du prix montre que la « vente » n'a pas transféré de valeur. À consolider avec la réquisition à l'exchange (même client ?).`,
    },
    { type: 'heading', text: 'Blanchir par le NFT' },
    {
      type: 'text',
      md: `Le schéma de base est simple : le blanchisseur contrôle **les deux côtés** de la vente.

1. Avec un portefeuille « propre » (identifié, par exemple chez un exchange), il crée ou achète un NFT à bas prix.
2. Avec des fonds **sales**, depuis un autre portefeuille, il achète ce NFT à un prix élevé.
3. Le portefeuille propre encaisse une « plus-value artistique » et la présente à son exchange ou à sa banque comme un revenu de vente.

La difficulté pour l'enquêteur n'est pas de voir la vente, mais de démontrer qu'**acheteur et vendeur ne font qu'un**, et que le prix n'a aucune justification économique.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Vente réelle',
        md: `- Acheteur et vendeur aux historiques indépendants.
- Prix cohérent avec le plancher et les ventes comparables.
- Le vendeur dépense ou conserve le produit librement.
- L'acheteur a d'autres achats, une activité de collectionneur.`,
      },
      right: {
        title: 'Vente de blanchiment',
        md: `- L'acheteur est financé par des fonds illicites (piratage, escroquerie), souvent après un passage par un mixeur ou un bridge.
- Prix sans rapport avec le marché (85 ETH pour un NFT à 0,1 ETH).
- Le vendeur transfère rapidement le produit vers un exchange.
- Indices de contrôle commun : mêmes horaires, même gaz, mêmes services.`,
      },
    },
    {
      type: 'case',
      title: 'Cas pratique — la chouette à 85 ETH',
      md: `Le 14 mars à 02:11 UTC, \`0x3fE8…c2A0\` achète **Lumen Owls #812** pour **85 ETH** à \`0x71Bb…9d04\`. Le plancher de la collection est alors de 0,11 ETH ; aucune autre vente n'a dépassé 2,4 ETH.

- \`0x3fE8…c2A0\` a été créé la veille et approvisionné par 90 ETH issus de retraits d'un pool de confidentialité, eux-mêmes postérieurs au piratage d'un protocole fictif (Lendora) attribué à un groupe identifié.
- \`0x71Bb…9d04\` avait acquis le NFT au mint, pour 0,05 ETH, en janvier ; son gaz provenait d'un retrait de l'exchange Huobex (fictif).
- Les deux portefeuilles ont signé leurs transactions dans la même minute la veille au soir, avec le même paramétrage de frais.
- Le 15 mars, \`0x71Bb…9d04\` dépose 84,6 ETH sur son adresse de dépôt Huobex, en déclarant à la conformité une « vente d'œuvre numérique ».

Actes : réquisition à Huobex (titulaire, justificatifs fournis, connexions), réquisition à la place de marché (comptes et IP associés aux deux adresses, mise en vente et acceptation), demande de gel. La qualification de **blanchiment** est à examiner, avec la présomption d'origine illicite lorsque les conditions de l'opération n'ont pas d'autre justification que la dissimulation.`,
    },
    { type: 'heading', text: 'Vols de NFT : phishing et drainers' },
    {
      type: 'table',
      caption: `Techniques de vol et trace on-chain`,
      headers: ['Technique', 'Ce que la victime signe', 'Trace on-chain', 'Point d’attention'],
      rows: [
        ['Approbation malveillante', '`setApprovalForAll` au profit de l’attaquant', 'Événement `ApprovalForAll` puis transferts par l’opérateur', 'L’autorisation reste active tant qu’elle n’est pas révoquée'],
        ['Faux ordre de vente', 'Un ordre de vente hors chaîne à prix nul ou dérisoire', 'Vente « régulière » sur le contrat de règlement, acheteur = attaquant', 'Aucune transaction d’approbation nouvelle si la collection était déjà approuvée'],
        ['Transfert direct', 'Une transaction de transfert présentée comme un « claim »', 'Transfer depuis la victime, signé par elle', 'Le site imitait un mint ou un airdrop'],
        ['Phrase de récupération volée', 'Rien : l’attaquant a la clé', 'Vidage complet, NFT et jetons', 'Rechercher l’origine de la fuite'],
      ],
    },
    {
      type: 'text',
      md: `Après le vol, les NFT sont souvent **revendus en urgence** au plancher ou acceptés contre la meilleure offre en WETH, pour convertir avant un éventuel signalement de la place de marché. Le produit part ensuite comme n'importe quel butin : swap, bridge, mixeur ou exchange. Les places de marché peuvent signaler un NFT volé et en bloquer la revente **sur leur interface**, sans pouvoir le bloquer sur la chaîne.`,
    },
    {
      type: 'check',
      q: `Une victime affirme n'avoir signé aucune transaction ; ses trois NFT ont pourtant été « vendus » 0,0001 ETH chacun sur le contrat de règlement d'une place de marché. Quelle hypothèse privilégier ?`,
      options: [
        `Elle a signé hors chaîne un faux ordre de vente, exécuté ensuite par l'attaquant grâce à une approbation déjà existante`,
        `Un bug du contrat de la collection`,
        `Le validateur du bloc a modifié le prix`,
        `Ses NFT ont été mintés une seconde fois`,
      ],
      answer: 0,
      explain: `Un ordre de vente est une signature hors chaîne : la victime ne voit pas de transaction, mais l'approbation donnée lors d'une vente antérieure suffit à l'exécution. Le bénéficiaire est l'acheteur, c'est-à-dire l'attaquant.`,
    },
    { type: 'heading', text: 'Faux mints et rug pulls de collections' },
    {
      type: 'text',
      md: `Deux variantes dominent :

- le **faux mint** : un site imite une collection attendue et invite à « minter » ; la transaction signée est un transfert de fonds ou une approbation au profit de l'escroc ;
- le **rug pull de collection** : l'équipe vend une feuille de route ambitieuse (jeu, métavers, avantages), encaisse les mints, puis abandonne le projet. Les fonds du mint sont retirés du contrat par une fonction réservée au propriétaire (\`withdraw\`), puis dispersés.

Indices : propriétaire du contrat (déployeur) et bénéficiaire du \`withdraw\`, part des NFT mintée par l'équipe elle-même, wash trading avant la fin du mint pour attirer, suppression des comptes sociaux juste après le retrait.`,
    },
    { type: 'heading', text: 'Méthode d’analyse' },
    {
      type: 'steps',
      items: [
        { title: 'Identifier l’objet', md: `Adresse du contrat, standard, tokenIds concernés, déployeur et propriétaire du contrat. Archivez métadonnées et pages de la collection.` },
        { title: 'Extraire les ventes', md: `Toutes les transactions de règlement de la collection : date, tokenId, vendeur, acheteur, prix, actif de paiement, place de marché. Les données exportées par les places de marché et les explorateurs facilitent l'extraction.` },
        { title: 'Remonter les financements', md: `Pour chaque acheteur et vendeur, origine des fonds (premier approvisionnement, retraits d'exchanges, mixeur). Regroupez les portefeuilles par source commune.` },
        { title: 'Tester le contrôle commun', md: `Retours de fonds, allers-retours de NFT, synchronisme des transactions, paramètres de frais identiques, mêmes services en sortie.` },
        { title: 'Mesurer', md: `Part du volume entre portefeuilles liés, prix aberrants par rapport au plancher, gains nets réalisés auprès d'acheteurs tiers.` },
        { title: 'Requérir', md: `Places de marché, exchanges d'approvisionnement et de sortie, hébergeurs des métadonnées et du site si pertinent.` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Réquisitions et qualifications',
      md: `Une place de marché de NFT ne pratique souvent **aucun KYC**, mais elle détient des données précieuses : comptes associés à une adresse (courriel éventuel, nom d'utilisateur), **adresses IP** et journaux de connexion, ordres signés (mises en vente, offres) y compris non exécutés, signalements. Beaucoup sont établies hors de France : coopération volontaire ou entraide selon le cas, à vérifier.

Qualifications à examiner selon les faits : **blanchiment** (art. 324-1 du code pénal) et présomption d'origine illicite (art. 324-1-1), **escroquerie** (art. 313-1) pour les faux mints et les ventes à des tiers trompés par un volume factice, infractions d'**atteinte aux systèmes de traitement automatisé de données** lorsque le vol repose sur une intrusion. Le règlement MiCA **exclut en principe** les crypto-actifs uniques et non fongibles ; des NFT émis en grande série ou fractionnés peuvent toutefois y entrer : la qualification de l'actif est à examiner au cas par cas.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : la victime d’un vol de NFT',
      md: `Faites établir la liste des NFT (contrat + tokenId), l'URL du site visité, les captures de la fenêtre de signature, l'application de portefeuille. Conseillez la **révocation** des approbations restantes et, si la phrase de récupération est en cause, la migration vers un nouveau portefeuille. Faites signaler les NFT volés aux places de marché : cela peut bloquer la revente sur leur interface et révéler le compte qui tente de vendre.`,
    },
  ],
  keyPoints: [
    `Un NFT = (adresse du contrat, tokenId) ; le nom et l'image ne prouvent rien, les métadonnées sont souvent hors chaîne.`,
    `Une vente combine une approbation on-chain, un ordre signé hors chaîne et un règlement atomique répartissant le prix.`,
    `Wash trading : financement commun, retour des fonds, allers-retours du NFT, chronologie serrée, prix aberrants.`,
    `Blanchiment : le même acteur contrôle acheteur (fonds sales) et vendeur (portefeuille propre) ; prix sans justification économique.`,
    `Vols : setApprovalForAll malveillant, faux ordre de vente signé hors chaîne, transfert déguisé, clé volée.`,
    `Places de marché : peu de KYC mais IP, comptes, ordres et signalements ; MiCA exclut en principe les NFT réellement uniques.`,
  ],
  quiz: [
    {
      q: `Qu'est-ce qui identifie de façon certaine un NFT ?`,
      options: [
        `Son nom et son image`,
        `Le couple adresse du contrat + tokenId`,
        `Son prix plancher`,
        `L'URL de sa page sur une place de marché`,
      ],
      answer: 1,
      explain: `Nom et image se copient ; le couple (contrat, tokenId) est unique sur la chaîne.`,
    },
    {
      kind: 'multi',
      q: `Quels indices suggèrent un wash trading entre deux portefeuilles ? (plusieurs réponses)`,
      options: [
        `Ils ont été financés par la même adresse source`,
        `Le vendeur renvoie à l'acheteur l'essentiel du prix peu après la vente`,
        `Le NFT revient au vendeur initial quelques heures plus tard`,
        `L'acheteur a payé des redevances au créateur`,
      ],
      answer: [0, 1, 2],
      explain: `Le paiement de redevances est un effet normal de la vente, pas un indice de contrôle commun.`,
    },
    {
      kind: 'truefalse',
      q: `La mise en vente d'un NFT sur une place de marché apparaît toujours comme une transaction sur la chaîne.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `La mise en vente est un ordre signé hors chaîne, stocké par la place de marché. Seuls l'approbation initiale et le règlement apparaissent on-chain.`,
    },
    {
      q: `Un NFT dont le plancher est à 0,1 ETH est acheté 85 ETH par un portefeuille financé par des fonds piratés ; le vendeur dépose aussitôt le produit chez un exchange. Quelle typologie ?`,
      options: [
        `Rug pull`,
        `Address poisoning`,
        `Blanchiment par vente surévaluée à soi-même`,
        `Spoofing`,
      ],
      answer: 2,
      explain: `Le prix sans justification économique et l'origine des fonds de l'acheteur caractérisent un blanchiment, à consolider par la preuve du contrôle commun.`,
    },
    {
      q: `Quelle fonction donne à un opérateur le droit de transférer tous les NFT d'une collection appartenant au signataire ?`,
      options: [`approve`, `transferFrom`, `setApprovalForAll`, `tokenURI`],
      answer: 2,
      explain: `setApprovalForAll accorde un droit global sur la collection ; c'est la cible favorite des drainers de NFT.`,
    },
    {
      kind: 'multi',
      q: `Que peut-on utilement demander à une place de marché de NFT par réquisition ? (plusieurs réponses)`,
      options: [
        `Les adresses IP et journaux de connexion liés à une adresse`,
        `Les ordres signés (mises en vente, offres), y compris non exécutés`,
        `La clé privée de l'utilisateur`,
        `Les comptes et courriels éventuellement associés`,
      ],
      answer: [0, 1, 3],
      explain: `Une place de marché non custodial ne détient pas les clés privées de ses utilisateurs.`,
    },
    {
      kind: 'truefalse',
      q: `Le règlement MiCA exclut en principe de son champ les crypto-actifs uniques et non fongibles, mais des NFT émis en grande série ou fractionnés peuvent y entrer.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `L'exclusion vise les actifs réellement uniques ; la qualification se fait au cas par cas, selon la fongibilité effective.`,
    },
  ],
  flashcards: [
    { front: 'ERC-721', back: `NFT à tokenId unique et propriétaire unique (ownerOf).` },
    { front: 'ERC-1155', back: `Multi-jetons : ids avec quantités, événements TransferSingle / TransferBatch.` },
    { front: 'Mint (on-chain)', back: `Transfer depuis l'adresse nulle vers le premier propriétaire.` },
    { front: 'setApprovalForAll', back: `Droit global d'un opérateur sur toute une collection du signataire.` },
    { front: 'Ordre de vente', back: `Signature hors chaîne stockée par la place de marché ; exécutée par l'acheteur.` },
    { front: 'Redevances (EIP-2981)', back: `Pourcentage signalé au créateur ; paiement selon la place de marché.` },
    { front: 'Wash trading', back: `S'acheter et se vendre à soi-même pour simuler volume ou prix.` },
    { front: 'Preuve de wash trading', back: `Financement commun, retour des fonds, allers-retours du NFT, synchronisme.` },
    { front: 'Blanchiment par NFT', back: `Fonds sales → achat surévalué d'un NFT détenu par un portefeuille propre du même acteur.` },
    { front: 'Faux ordre de vente', back: `Vol par signature hors chaîne d'une vente à prix dérisoire au profit de l'attaquant.` },
    { front: 'Données d’une place de marché', back: `Comptes, IP, ordres signés, signalements ; rarement de KYC.` },
  ],
}
