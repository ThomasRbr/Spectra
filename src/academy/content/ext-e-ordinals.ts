// Niveau 4 — Bitcoin : Ordinals, inscriptions, BRC-20 et Runes. Théorie
// ordinale, commit/reveal, transfert et vente par PSBT, runestones, impact sur
// les heuristiques de rendu et de clustering, vols d'inscriptions.
import type { Lesson } from '../model'

export const LESSON_ORDINALS_RUNES: Lesson = {
  id: 'ordinals-runes',
  title: 'Ordinals, inscriptions, BRC-20 et Runes',
  level: 4,
  track: 'bitcoin',
  minutes: 45,
  summary: `Depuis 2023, Bitcoin porte des « objets » : inscriptions ordinales (images, textes, JSON) attachées à un satoshi précis, jetons BRC-20 décrits en JSON, puis Runes, des soldes de jetons attachés aux UTXO par un message OP_RETURN. Ces usages créent des transactions qui trompent les heuristiques classiques : petites sorties qui ne sont pas des rendus, ventes à plusieurs signataires qui violent l'hypothèse des entrées communes, consolidations de « cardinals ». Ils créent aussi de nouveaux vols : PSBT piégées, inscriptions dépensées en frais. Cette leçon donne les clés pour lire, tracer et requérir.`,
  objectives: [
    `Expliquer la théorie ordinale : numérotation des satoshis et règle « premier entré, premier sorti » entre entrées, sorties et frais.`,
    `Décrire la création d'une inscription (commit puis reveal, enveloppe OP_FALSE OP_IF "ord" … OP_ENDIF, postage) et la retrouver dans le témoin.`,
    `Lire un transfert d'inscription et une vente par PSBT (sortie tampon, inscription en sortie 1, prix, commission, rendu de l'acheteur).`,
    `Distinguer BRC-20 (inscriptions JSON interprétées par des indexeurs) et Runes (runestone OP_RETURN OP_13, edicts, soldes attachés aux UTXO).`,
    `Corriger les heuristiques de rendu et de clustering face aux sorties porteuses et aux transactions multipartites.`,
    `Reconstituer un vol d'inscription et identifier les points de réquisition (places de marché, exchanges, indexeurs).`,
  ],
  prerequisites: ['bitcoin-moderne', 'change-heuristics', 'nft-fraudes'],
  practice: ['ordinals-vol'],
  blocks: [
    {
      type: 'text',
      md: `Une collectionneuse dépose plainte : son inscription « Lunar Glyphs #412 », achetée 0,031 BTC, a disparu de son portefeuille après qu'elle a « vérifié son éligibilité » à une frappe gratuite annoncée sur un serveur Discord. Son solde en bitcoins, lui, n'a presque pas bougé : il manque quelques milliers de satoshis.

Comment suivre un objet qui ne « pèse » que 10 000 sats ? En comprenant qu'une inscription n'est pas un jeton tenu par un contrat, mais une **donnée attachée à un satoshi précis**, qui suit ce satoshi de transaction en transaction selon une règle mécanique. Une fois cette règle maîtrisée, l'objet volé se trace comme n'importe quelle pièce, avec une précision au satoshi près, jusqu'à sa revente et au paiement que le voleur en tire.`,
    },
    { type: 'heading', text: 'La théorie ordinale : chaque satoshi a un numéro' },
    {
      type: 'text',
      md: `La **théorie ordinale** (Casey Rodarmor, logiciel \`ord\`, lancé publiquement en janvier 2023) est une **convention**, pas une règle du protocole : les nœuds Bitcoin l'ignorent. Elle numérote chaque satoshi dans l'ordre de son minage (le premier satoshi du bloc 0 porte le numéro 0) et définit comment ces numéros se transmettent :

- les satoshis des **entrées** sont mis bout à bout **dans l'ordre des entrées** ;
- ils sont distribués aux **sorties** **dans l'ordre des sorties**, chaque sortie prenant autant de satoshis que sa valeur ;
- ce qui reste après la dernière sortie part en **frais** et rejoint, dans le même ordre, la transaction coinbase du mineur.

C'est la règle du **premier entré, premier sorti** (FIFO). Un logiciel compatible (indexeur \`ord\`, explorateur spécialisé, portefeuille « ordinals-aware ») applique cette règle à toute la chaîne pour savoir où se trouve chaque satoshi, donc chaque inscription.`,
    },
    {
      type: 'table',
      caption: 'Transfert d’une inscription posée sur le premier satoshi (décalage 0) de l’entrée 0. Les décalages sont comptés dans la transaction.',
      headers: ['Élément', 'Valeur', 'Plage de satoshis (décalages)', 'Contient l’inscription ?'],
      rows: [
        ['Entrée 0 (UTXO porteuse)', '10 000 sats', '0 à 9 999', 'Oui, au décalage 0'],
        ['Entrée 1 (paiement des frais)', '50 000 sats', '10 000 à 59 999', 'Non'],
        ['Sortie 0 (destinataire)', '10 000 sats', '0 à 9 999', 'Oui'],
        ['Sortie 1 (rendu de l’expéditeur)', '48 500 sats', '10 000 à 58 499', 'Non'],
        ['Frais (vers le mineur)', '1 500 sats', '58 500 à 59 999', 'Non'],
      ],
    },
    {
      type: 'check',
      q: `Un portefeuille non compatible dépense une UTXO de 10 000 sats portant une inscription (entrée 0, décalage 0) avec une UTXO de 90 000 sats (entrée 1) pour payer 60 000 sats à un commerçant (sortie 0), rendu de 38 000 sats (sortie 1), 2 000 sats de frais. Où part l'inscription ?`,
      options: [
        `Dans le rendu (sortie 1)`,
        `Chez le commerçant (sortie 0), qui reçoit les satoshis 0 à 59 999`,
        `Chez le mineur, en frais`,
        `Elle est détruite`,
      ],
      answer: 1,
      explain: `Le satoshi au décalage 0 tombe dans la première sortie, qui couvre les décalages 0 à 59 999. Le commerçant reçoit l'inscription sans le savoir : c'est l'une des pertes les plus fréquentes chez les utilisateurs de portefeuilles non compatibles.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Inscription perdue en frais',
      md: `Si le satoshi inscrit se trouve après la dernière sortie, il part **en frais** et atterrit dans la coinbase du mineur du bloc. Exemple : entrée 0 de 40 000 sats, entrée 1 de 10 000 sats portant l'inscription (décalage 40 000), une seule sortie de 38 000 sats, 12 000 sats de frais : l'inscription appartient désormais au mineur. Pour l'enquêteur, c'est un « destinataire » inattendu, mais parfaitement identifiable (pool de minage).`,
    },
    { type: 'heading', text: 'Créer une inscription : commit, puis reveal' },
    {
      type: 'flow',
      caption: `Une inscription naît en deux transactions. Le commit engage le script sans le montrer ; le reveal le publie dans le témoin et dépose l'inscription sur le premier satoshi de la sortie 0.`,
      nodes: [
        { id: 'w', label: 'Portefeuille du créateur', kind: 'wallet', sub: 'UTXO « cardinals »' },
        { id: 'c', label: 'Transaction de commit', kind: 'tx', sub: 'vers une adresse P2TR' },
        { id: 'ca', label: 'Adresse de commit', kind: 'contract', sub: 'clé ajustée par le script' },
        { id: 'r', label: 'Transaction de reveal', kind: 'tx', sub: 'dépense Taproot par script' },
        { id: 'h', label: 'Détenteur', kind: 'wallet', sub: 'sortie 0 : 10 000 sats' },
        { id: 'ch', label: 'Rendu', kind: 'wallet', sub: 'retour au créateur' },
      ],
      edges: [
        { from: 'w', to: 'c' },
        { from: 'c', to: 'ca', label: 'postage + frais du reveal' },
        { from: 'c', to: 'ch', label: 'rendu', dashed: true },
        { from: 'ca', to: 'r', label: 'témoin : enveloppe' },
        { from: 'r', to: 'h', label: 'inscription' },
      ],
    },
    {
      type: 'text',
      md: `Le contenu est placé dans une **enveloppe** : un fragment de Tapscript qui ne s'exécute jamais, puisqu'il commence par une condition fausse.

\`<clé> OP_CHECKSIG OP_FALSE OP_IF "ord" 01 "image/png" 00 <données…> OP_ENDIF\`

- \`OP_FALSE OP_IF … OP_ENDIF\` : bloc jamais exécuté, qui sert uniquement à stocker des octets ;
- \`"ord"\` : marqueur du protocole ; le champ \`01\` annonce le **type de contenu** (MIME), le séparateur \`00\` annonce le **corps** ;
- le corps peut être découpé en morceaux de 520 octets au plus (limite d'un élément de pile) et atteindre des centaines de kilo-octets.

Comme ces données sont dans le **témoin**, elles bénéficient de la remise de poids : un contenu de 4 000 octets n'ajoute qu'environ 1 000 vB. Les règles de relais standard limitent une transaction à 400 000 WU ; des inscriptions plus lourdes ont été minées directement par des pools.

L'inscription reçoit un **identifiant** \`<txid du reveal>i0\` et un **numéro** d'ordre attribué par l'indexeur. Par défaut, le logiciel \`ord\` dépose l'inscription sur une sortie de **10 000 sats** : c'est le **postage**.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Dans Spectra',
      md: `La transaction de reveal affiche une carte « Révélation d'une inscription ordinale » : identifiant, numéro, type de contenu, taille, contenu lisible s'il s'agit de texte ou de JSON, et la sortie porteuse (« Portée par la sortie 0 (10 000 sats) »). La carte « Scripts et témoins » montre l'entrée 0 comme une « P2TR, dépense par script » : signature Schnorr, script révélé (l'enveloppe) et bloc de contrôle. La carte « Taille et poids » montre l'effet de la remise : l'essentiel des octets est dans le témoin.`,
    },
    { type: 'heading', text: 'Transférer et vendre une inscription' },
    {
      type: 'text',
      md: `**Transfert simple.** Un portefeuille compatible place l'UTXO porteuse en **première entrée** et crée une **sortie 0** de même valeur (10 000 sats) vers le destinataire. Une seconde entrée, prise dans les satoshis « ordinaires » (les **cardinals**), paie les frais ; son reste revient en rendu. Résultat typique : deux entrées, une sortie de 10 000 sats, une sortie de rendu.

**Vente par PSBT.** Les places de marché (par exemple Magic Eden, OKX ou UniSat) ne détiennent généralement pas les objets : la vente est une **transaction partiellement signée** (PSBT, BIP 174). Le vendeur signe à l'avance son entrée (l'UTXO porteuse) avec le type de signature \`SIGHASH_SINGLE | ANYONECANPAY\` : sa signature ne couvre que son entrée et **une** sortie, celle qui lui verse le prix. N'importe quel acheteur peut ensuite compléter la transaction avec ses propres entrées et sorties.`,
    },
    {
      type: 'table',
      caption: 'Structure d’une vente par PSBT telle que la modélise Spectra. La petite entrée « tampon » de l’acheteur absorbe les premiers satoshis : l’inscription tombe en sortie 1.',
      headers: ['Rang', 'Entrée', 'Sortie', 'À qui'],
      rows: [
        ['0', 'UTXO tampon de l’acheteur (600 sats)', 'Tampon (600 sats)', 'Acheteur'],
        ['1', 'UTXO porteuse du vendeur (10 000 sats)', 'Inscription (10 000 sats)', 'Acheteur (adresse de réception P2TR)'],
        ['2', 'Paiement de l’acheteur', 'Prix', 'Vendeur'],
        ['3', '—', 'Commission', 'Place de marché'],
        ['4', '—', 'Rendu', 'Acheteur'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une vente PSBT viole l’hypothèse des entrées communes',
      md: `Les entrées d'une vente appartiennent à **deux personnes différentes** (le vendeur et l'acheteur). Appliquer aveuglément l'heuristique des entrées communes fusionnerait le cluster du vendeur avec celui de l'acheteur, puis, de proche en proche, des milliers de collectionneurs. Une transaction qui porte une carte « Vente d'inscription (PSBT) » est **multipartite** : comme un CoinJoin ou un PayJoin, elle doit être exclue du clustering par entrées communes.`,
    },
    { type: 'heading', text: 'BRC-20 : des jetons écrits en JSON' },
    {
      type: 'text',
      md: `Le standard **BRC-20** (mars 2023) détourne les inscriptions pour créer des jetons fongibles. Chaque opération est une inscription de type \`text/plain\` contenant un JSON :

- déploiement : \`{"p":"brc-20","op":"deploy","tick":"ordi","max":"21000000","lim":"1000"}\` (offre maximale, limite par frappe) ;
- frappe : \`{"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}\` ;
- transfert, **en deux temps** : le détenteur inscrit \`{"p":"brc-20","op":"transfer","tick":"ordi","amt":"250"}\` sur sa propre adresse, puis **envoie cette inscription** au destinataire. C'est ce second envoi qui déplace le solde.

Bitcoin ne connaît **aucun** de ces soldes : ils sont calculés par des **indexeurs** hors chaîne qui rejouent toutes les inscriptions selon les règles du standard. Deux indexeurs mal synchronisés peuvent afficher des soldes différents. Dans une procédure, le solde BRC-20 d'une adresse est donc toujours « selon l'indexeur X, à la hauteur de bloc Y ».`,
    },
    { type: 'heading', text: 'Runes : des soldes attachés aux UTXO' },
    {
      type: 'text',
      md: `Le protocole **Runes**, conçu par l'auteur de la théorie ordinale et lancé au bloc **840 000** (halving du 20 avril 2024), abandonne les inscriptions au profit d'un message court dans une sortie **OP_RETURN** : le **runestone**, reconnaissable à son début \`OP_RETURN OP_13\` (\`6a 5d\` en hexadécimal), suivi d'entiers encodés en LEB128.

- **Gravure (etching)** : création d'une rune (nom en lettres majuscules avec séparateurs « • », divisibilité, symbole, préminage éventuel, conditions de frappe). La rune reçoit un identifiant \`bloc:index\`.
- **Frappe (mint)** : frappe ouverte, chacun paie ses frais et reçoit le montant prévu.
- **Edicts** : instructions de transfert « rune, montant, numéro de sortie ».
- **Pointeur** : sortie qui reçoit les runes non attribuées ; à défaut, la première sortie qui n'est pas un OP_RETURN.
- **Cénotaphe** : runestone mal formé ; les runes des entrées sont alors **brûlées**.

Contrairement au BRC-20, les soldes sont **attachés aux UTXO** : une sortie porte « 5 000 000 DOG•EXEMPLE » comme elle porte des satoshis. Les sorties porteuses sont en général de **546 sats**, la valeur plancher (seuil de poussière historique) que les portefeuilles emploient par défaut.`,
    },
    {
      type: 'compare',
      left: {
        title: 'BRC-20',
        md: `- Chaque opération = une inscription JSON (commit + reveal).
- Soldes tenus **par adresse**, calculés par des indexeurs.
- Transfert en deux transactions (inscrire, puis envoyer).
- Fort encombrement de la chaîne (une inscription par opération).`,
      },
      right: {
        title: 'Runes',
        md: `- Chaque opération = un runestone OP_RETURN OP_13 dans une transaction ordinaire.
- Soldes tenus **par UTXO**, comme des satoshis colorés.
- Transfert en une transaction (edicts).
- Reste lu par des indexeurs : un runestone invalide brûle les runes.`,
      },
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Dans Spectra : la carte « Sortie OP_RETURN »',
      md: `Une transaction de runes affiche une carte « Sortie OP_RETURN (données, 0 BTC) » avec l'hexadécimal du runestone (commençant par \`6a5d\`) et sa lecture (« Runestone : edict … → sortie n »), ainsi qu'une carte « Transfert de runes » ou « Frappe de runes » indiquant la rune, le montant et la sortie porteuse de 546 sats. Une sortie OP_RETURN n'est **jamais** un destinataire : ne la comptez pas comme une contrepartie.`,
    },
    {
      type: 'check',
      q: `Une transaction comporte une sortie OP_RETURN commençant par 6a5d, une sortie de 546 sats vers une adresse P2TR et une sortie de 3 214 870 sats. Quelle lecture est correcte ?`,
      options: [
        `La sortie de 546 sats est le rendu, puisque c'est la plus petite`,
        `C'est un transfert de runes : la sortie de 546 sats porte vraisemblablement les runes transférées, la grosse sortie est le rendu en bitcoins`,
        `L'OP_RETURN est le destinataire principal`,
        `C'est une inscription BRC-20`,
      ],
      answer: 1,
      explain: `6a5d = OP_RETURN OP_13 : un runestone. La sortie de poussière (546 sats) est la porteuse désignée par l'edict ; elle transporte un actif, ce n'est pas un rendu. Le décodage du runestone confirme le numéro de sortie visé.`,
    },
    { type: 'heading', text: 'Ce qui change pour les heuristiques' },
    {
      type: 'table',
      caption: 'Pièges courants et lecture corrigée',
      headers: ['Motif observé', 'Lecture naïve', 'Lecture corrigée'],
      rows: [
        ['Sortie de 10 000 sats vers une P2TR, en première position', 'Petit rendu ou poussière', 'Inscription transférée ou révélée : c’est l’envoi principal'],
        ['Sortie de 546 sats avec un OP_RETURN 6a5d', 'Rendu minuscule', 'Sortie porteuse de runes'],
        ['Sortie de 600 sats en sortie 0 d’une vente', 'Paiement à un tiers', 'Tampon de l’acheteur, qui revient à l’acheteur'],
        ['Entrées de deux portefeuilles différents (vente PSBT)', 'Même propriétaire (entrées communes)', 'Transaction multipartite : pas de clustering'],
        ['Prix rond versé au vendeur et commission à une adresse récurrente', 'Deux paiements quelconques', 'Paiement du vendeur et commission d’une place de marché identifiable'],
        ['Consolidation de dizaines de petites UTXO P2TR', 'Regroupement de rendus', 'Possible consolidation de « cardinals » ou d’UTXO porteuses : vérifier si des inscriptions ou des runes ont été déplacées'],
      ],
    },
    {
      type: 'widget',
      id: 'change-detective',
      caption: `Activez et désactivez les heuristiques de rendu : sur une transaction d'inscription ou de runes, l'heuristique de la « plus petite sortie » désigne à tort la sortie porteuse. Le détecteur de Spectra l'écarte explicitement (« Porte l'inscription… ce n'est pas un rendu »).`,
    },
    { type: 'heading', text: 'Vols d’inscriptions et de runes' },
    {
      type: 'table',
      caption: 'Modes opératoires observés et traces laissées',
      headers: ['Mode opératoire', 'Mécanisme', 'Trace on-chain'],
      rows: [
        ['PSBT piégée (« vérifier l’éligibilité », « réclamer un airdrop »)', 'La victime signe une transaction qui envoie ses UTXO porteuses (et souvent des cardinals) au voleur', 'Transaction signée par la victime, sorties vers une adresse neuve du voleur'],
        ['Fausse annonce signée à vil prix', 'Une annonce PSBT signée sur un faux site, à un prix dérisoire, est complétée par le voleur', 'Vente PSBT dont le prix est sans rapport avec la valeur de l’objet'],
        ['Phishing de la phrase de récupération', 'Le voleur restaure le portefeuille et vide tout', 'Balayage de toutes les UTXO, inscriptions comprises'],
        ['Portefeuille non compatible', 'L’UTXO porteuse sert à payer un tiers ou des frais', 'Inscription chez un commerçant, dans un rendu ou chez un mineur'],
        ['Envoi vers un exchange non compatible', 'L’inscription arrive sur une adresse de dépôt qui ne la gère pas', 'Inscription détenue par une adresse de dépôt, puis balayée avec les fonds'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — Lunar Glyphs #412',
      md: `Reprise de la plainte. L'analyste remonte l'historique de l'adresse P2TR de la victime :

1. **Transaction de vol** : deux entrées de la victime (l'UTXO porteuse de 10 000 sats en entrée 0, une UTXO de 6 000 sats en entrée 1), deux sorties vers la même adresse neuve \`bc1p…7kq\` (10 000 sats en sortie 0, qui reçoit l'inscription, et 4 300 sats en sortie 1), 1 700 sats de frais. La victime a signé cette PSBT en croyant « vérifier son éligibilité » : les quelques milliers de satoshis manquants sont l'UTXO de 6 000 sats, utilisée pour payer les frais du vol.
2. **Revente, 3 heures plus tard** : carte « Vente d'inscription (PSBT) », inscription en sortie 1 vers un acheteur de bonne foi, **prix de 0,0185 BTC** en sortie 2 vers une adresse du voleur, commission en sortie 3 vers l'adresse de commissions de la place de marché.
3. **Encaissement** : l'adresse de paiement du voleur est dépensée avec trois autres paiements de ventes du même jour (entrées communes valables : transaction ordinaire, non multipartite), puis le total part vers une **adresse de dépôt** attribuée à un exchange.

Points d'appui : la place de marché (journaux de connexion du portefeuille vendeur, adresses IP, annonces), l'exchange (titulaire du compte de dépôt), et l'acheteur de bonne foi, à informer avec prudence. Le cluster du voleur n'a **pas** été fusionné avec celui de l'acheteur malgré l'entrée commune de la vente.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Réquisitions : qui détient quoi ?',
      md: `- **Places de marché** : non custodiales pour la plupart, elles conservent néanmoins des journaux (adresses connectées, IP, horodatage des annonces et des achats, parfois un compte ou une adresse électronique). Elles peuvent aussi masquer une annonce d'objet volé.
- **Exchanges** : certains acceptent des dépôts de jetons BRC-20 ou de runes ; ils identifient le titulaire du compte de dépôt et peuvent geler les avoirs.
- **Indexeurs et explorateurs** : la preuve de détention d'une inscription ou d'un solde de runes repose sur un indexeur. Indiquez l'outil, sa version et la hauteur de bloc ; pour une expertise, un indexeur \`ord\` (logiciel libre) exécuté sur un nœud contrôlé permet une vérification indépendante.
- **Saisie** : une inscription se saisit en transférant **l'UTXO porteuse** avec un portefeuille compatible ; un portefeuille ordinaire risquerait de la dépenser en frais. Prévoyez l'outil avant l'intervention.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Erreur fréquente',
        md: `- Prendre la sortie de 10 000 ou de 546 sats pour un rendu.
- Fusionner vendeur et acheteur d'une vente PSBT.
- Évaluer un vol d'inscription au montant en satoshis de l'UTXO.
- Saisir avec un portefeuille non compatible.
- Citer un solde BRC-20 sans indexeur ni hauteur de bloc.`,
      },
      right: {
        title: 'Bonne pratique',
        md: `- Repérer la carte d'inscription ou de runes et la sortie porteuse.
- Exclure les transactions multipartites du clustering.
- Valoriser l'objet par son dernier prix de vente ou les offres de la collection.
- Transférer l'UTXO porteuse avec un outil compatible, en contrôle de coin.
- Dater et sourcer chaque lecture d'indexeur.`,
      },
    },
  ],
  keyPoints: [
    `La théorie ordinale numérote les satoshis et les transmet en « premier entré, premier sorti » : entrées dans l'ordre, sorties dans l'ordre, reste en frais vers la coinbase.`,
    `Une inscription naît en deux transactions (commit vers une P2TR, reveal par script) ; le contenu est dans le témoin, dans une enveloppe OP_FALSE OP_IF "ord" … OP_ENDIF ; postage par défaut de 10 000 sats.`,
    `Transfert : UTXO porteuse en première entrée, sortie 0 au destinataire. Vente PSBT : tampon de l'acheteur, inscription en sortie 1, prix au vendeur, commission, rendu.`,
    `BRC-20 = inscriptions JSON (deploy, mint, transfer en deux temps) dont les soldes n'existent que chez les indexeurs.`,
    `Runes = runestone OP_RETURN OP_13, edicts et soldes attachés aux UTXO, sorties porteuses de 546 sats ; un runestone invalide brûle les runes.`,
    `Les sorties porteuses ne sont pas des rendus, et les ventes PSBT sont multipartites : pas de clustering par entrées communes.`,
    `Vols typiques : PSBT piégée, annonce à vil prix, phishing de seed, portefeuille non compatible ; on requiert la place de marché et l'exchange d'encaissement.`,
  ],
  quiz: [
    {
      q: `Selon la théorie ordinale, que devient le satoshi situé au décalage 0 de la première entrée d'une transaction ?`,
      options: [
        `Il va toujours au mineur`,
        `Il va dans la première sortie, qui reçoit les premiers satoshis des entrées mises bout à bout`,
        `Il va dans la plus grosse sortie`,
        `Il est réparti au prorata entre les sorties`,
      ],
      answer: 1,
      explain: `Les satoshis sont transmis en « premier entré, premier sorti » : les premiers satoshis de la première entrée remplissent la première sortie.`,
    },
    {
      q: `Où se trouve le contenu d'une inscription ordinale ?`,
      options: [
        `Dans une sortie OP_RETURN de la transaction de commit`,
        `Dans le témoin de l'entrée de la transaction de reveal, à l'intérieur d'une enveloppe OP_FALSE OP_IF "ord" … OP_ENDIF`,
        `Sur un serveur de la place de marché`,
        `Dans le scriptSig d'une entrée P2PKH`,
      ],
      answer: 1,
      explain: `Le reveal dépense l'adresse de commit par la branche script de Taproot ; le script révélé contient l'enveloppe, jamais exécutée, qui stocke le type de contenu et les données.`,
    },
    {
      kind: 'truefalse',
      q: `Les nœuds Bitcoin vérifient la propriété des inscriptions et refusent une transaction qui en déplacerait une sans autorisation.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `La théorie ordinale est une convention appliquée par des indexeurs. Pour les nœuds, une UTXO porteuse est une UTXO comme une autre : un portefeuille non compatible peut la dépenser en frais ou la donner à un tiers.`,
    },
    {
      q: `Dans une vente par PSBT modélisée par Spectra, pourquoi l'inscription arrive-t-elle en sortie 1 ?`,
      options: [
        `Parce que la sortie 0 est réservée aux mineurs`,
        `Parce que l'entrée tampon de 600 sats de l'acheteur, placée en tête, remplit la sortie 0 de 600 sats ; les satoshis suivants, dont le satoshi inscrit, remplissent la sortie 1`,
        `Parce que la place de marché choisit la sortie au hasard`,
        `Parce que le vendeur signe avec SIGHASH_ALL`,
      ],
      answer: 1,
      explain: `C'est l'application directe de la règle FIFO : 600 sats d'entrée 0 vers 600 sats de sortie 0, puis l'UTXO porteuse de 10 000 sats vers la sortie 1 de 10 000 sats.`,
    },
    {
      kind: 'multi',
      q: `Quelles affirmations sur une vente d'inscription par PSBT sont exactes ? (plusieurs réponses)`,
      options: [
        `Ses entrées appartiennent au vendeur et à l'acheteur`,
        `Elle doit être exclue du clustering par entrées communes`,
        `Le vendeur signe avec SIGHASH_SINGLE | ANYONECANPAY, ce qui laisse l'acheteur compléter la transaction`,
        `La place de marché détient toujours l'inscription avant la vente`,
      ],
      answer: [0, 1, 2],
      explain: `La vente est multipartite. Le vendeur ne signe que son entrée et la sortie qui lui verse le prix. La plupart des places de marché d'Ordinals sont non custodiales : l'objet reste chez le vendeur jusqu'à la vente.`,
    },
    {
      q: `Comment s'effectue un transfert de jetons BRC-20 ?`,
      options: [
        `Par un runestone OP_RETURN OP_13`,
        `Par un appel à un contrat intelligent sur Bitcoin`,
        `En deux temps : inscrire un JSON « transfer » sur sa propre adresse, puis envoyer cette inscription au destinataire`,
        `Par une simple sortie de 546 sats sans données`,
      ],
      answer: 2,
      explain: `Le JSON « transfer » rend une quantité transférable ; c'est l'envoi de cette inscription qui déplace le solde, tel que le calculent les indexeurs.`,
    },
    {
      q: `Qu'est-ce qu'un cénotaphe dans le protocole Runes ?`,
      options: [
        `Une rune de collection rare`,
        `Un runestone mal formé : les runes des entrées sont brûlées`,
        `La sortie de 546 sats porteuse`,
        `Une inscription d'image`,
      ],
      answer: 1,
      explain: `Un runestone invalide est un cénotaphe ; par sécurité, le protocole brûle les runes des entrées plutôt que de les attribuer de façon ambiguë.`,
    },
    {
      kind: 'multi',
      q: `Lesquelles de ces sorties ne doivent pas être prises pour un rendu ? (plusieurs réponses)`,
      options: [
        `La sortie de 10 000 sats qui porte une inscription transférée`,
        `La sortie de 546 sats désignée par l'edict d'un runestone`,
        `La sortie de 600 sats « tampon » d'une vente PSBT, qui revient à l'acheteur sans être un rendu de paiement`,
        `La sortie P2WPKH de 0,4 BTC qui reprend le type des entrées dans une transaction ordinaire`,
      ],
      answer: [0, 1, 2],
      explain: `Les sorties porteuses transportent un actif et le tampon a un rôle technique. La dernière sortie, dans une transaction ordinaire, peut en revanche être un rendu selon les heuristiques classiques.`,
    },
    {
      q: `Un voleur a fait signer à la victime une PSBT qui envoie son inscription vers une adresse neuve. Quel est le point de réquisition le plus prometteur ?`,
      options: [
        `Les mineurs du bloc`,
        `L'auteur du logiciel ord`,
        `La place de marché où l'inscription est revendue (journaux du portefeuille vendeur) et l'exchange où le prix est encaissé`,
        `Le Bitcoin Core`,
      ],
      answer: 2,
      explain: `Le voleur cherche à convertir l'objet : la revente laisse des journaux chez la place de marché, et l'encaissement aboutit souvent à un dépôt identifiable chez un exchange.`,
    },
    {
      kind: 'truefalse',
      q: `Pour saisir une inscription, n'importe quel portefeuille Bitcoin convient puisqu'il suffit de transférer l'UTXO.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Un portefeuille non compatible peut utiliser l'UTXO porteuse pour payer des frais ou la mélanger à d'autres sorties, et perdre l'inscription. Il faut un outil compatible et un contrôle précis des entrées et sorties.`,
    },
  ],
  flashcards: [
    { front: 'Théorie ordinale', back: `Convention (non protocolaire) qui numérote les satoshis et les transmet en FIFO : entrées dans l'ordre → sorties dans l'ordre → reste en frais vers la coinbase.` },
    { front: 'Commit / reveal', back: `Commit : envoi vers une P2TR qui engage le script. Reveal : dépense par script qui publie l'enveloppe dans le témoin.` },
    { front: 'Enveloppe d’inscription', back: `OP_FALSE OP_IF "ord" 01 <type MIME> 00 <données> OP_ENDIF, dans un Tapscript.` },
    { front: 'Postage', back: `Valeur de la sortie porteuse d'une inscription : 10 000 sats par défaut avec ord.` },
    { front: 'Identifiant d’inscription', back: `<txid du reveal>i0 ; le numéro d'inscription est attribué par l'indexeur.` },
    { front: 'Cardinals', back: `Satoshis « ordinaires » sans inscription, utilisables pour les frais et les paiements.` },
    { front: 'Vente PSBT', back: `Vendeur : SIGHASH_SINGLE | ANYONECANPAY. Spectra : tampon 600 sats (sortie 0), inscription (sortie 1), prix, commission, rendu. Multipartite.` },
    { front: 'BRC-20', back: `Jetons décrits par des inscriptions JSON {"p":"brc-20","op":…}. Soldes calculés par les indexeurs. Transfert en deux temps.` },
    { front: 'Runestone', back: `Sortie OP_RETURN OP_13 (6a5d…) : gravure, frappe, edicts (rune, montant, sortie), pointeur.` },
    { front: 'Sortie de 546 sats', back: `Porteuse de runes (valeur plancher par défaut) : ce n'est pas un rendu.` },
    { front: 'Cénotaphe', back: `Runestone invalide : les runes des entrées sont brûlées.` },
    { front: 'Inscription perdue en frais', back: `Si le satoshi inscrit dépasse la dernière sortie, il part en frais et rejoint la coinbase du mineur.` },
  ],
}
