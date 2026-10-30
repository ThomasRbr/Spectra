// Niveau 2 — Modèle à comptes : TON et l'écosystème Telegram.
// Acteurs réels (Telegram, TON, portefeuilles, explorateurs) décrits factuellement ;
// toutes les escroqueries, bots et plateformes cités sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_TON: Lesson = {
  id: 'ton-telegram',
  title: 'TON et l’écosystème Telegram',
  level: 2,
  track: 'comptes',
  minutes: 35,
  summary: `The Open Network (TON) est devenu la blockchain « native » de Telegram : portefeuille intégré à la messagerie, mini-applications, noms d'utilisateur à collectionner. C'est aussi l'infrastructure de nombreuses escroqueries diffusées par bots et canaux. Modèle à comptes asynchrone, trois écritures d'une même adresse, commentaires (memos) de dépôt, jettons (USDT sur TON), portefeuilles custodial ou auto-hébergés, stratégie d'enquête et pièges.`,
  objectives: [
    `Reconnaître une adresse TON sous ses trois écritures (brute 0:…, bounceable EQ…, non-bounceable UQ…) et savoir qu'elles désignent le même compte.`,
    `Lire un transfert TON : message, commentaire (memo), transfert de jetton et notification au destinataire.`,
    `Distinguer un portefeuille custodial intégré à Telegram d'un portefeuille auto-hébergé, et en tirer les bonnes réquisitions.`,
    `Identifier les schémas d'escroquerie propres à Telegram (bots, mini-applications, faux airdrops, P2P intégré) et leurs traces on-chain.`,
    `Préserver la preuve Telegram et éviter les pièges classiques (memo oublié, confusion EQ/UQ, versions de portefeuille).`,
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'xrp-memos', 'exchanges'],
  practice: ['xrp-destination-tag', 'pig-butchering-tron'],
  blocks: [
    {
      type: 'text',
      md: `Un retraité de Vannes a rejoint, via un lien reçu sur un groupe, le bot Telegram **@GramYieldBot** qui promettait « 2 % par jour en staking TON ». Il a acheté des Toncoin dans le portefeuille intégré à sa messagerie, les a « déposés » dans le bot, puis a vu son solde fictif grimper pendant trois semaines. Le jour où il a demandé un retrait, le bot a réclamé des « frais de déblocage », puis a disparu.

Sa plainte contient trois choses : des captures d'écran de conversations, une adresse qui commence par \`UQ\`, et un « commentaire » à huit chiffres que le bot lui avait demandé de saisir. Pour exploiter ces éléments, il faut comprendre comment fonctionne **TON**, et pourquoi il est si présent dans les escroqueries diffusées sur Telegram.`,
    },
    { type: 'heading', text: 'TON en bref : d’où vient ce réseau ?' },
    {
      type: 'text',
      md: `**TON** signifie aujourd'hui *The Open Network*. Le projet a été conçu par l'équipe de Telegram sous le nom de *Telegram Open Network* ; en 2020, Telegram l'a abandonné à la suite d'une procédure engagée par la SEC américaine. Le réseau a été repris par une communauté de développeurs et est soutenu par la **TON Foundation**.

Repères utiles pour l'enquêteur :

- l'actif natif est le **Toncoin** (symbole TON), divisible en **nanotons** : 1 TON = 10^9 nanotons ;
- Telegram a progressivement réintégré TON dans son écosystème : portefeuille accessible depuis la messagerie, place de marché **Fragment** (noms d'utilisateur et numéros anonymes payés en TON), et, depuis 2025, TON comme blockchain retenue pour les mini-applications ;
- les **noms d'utilisateur** et **numéros anonymes** achetés sur Fragment sont des NFT sur TON : leur détenteur est une adresse, ce qui en fait un **pivot OSINT** précieux.

Conséquence pratique : une victime peut acheter, envoyer et perdre des crypto-actifs **sans jamais quitter Telegram**.`,
    },
    { type: 'heading', text: 'Un modèle à comptes… où chaque compte est un contrat' },
    {
      type: 'text',
      md: `Comme Ethereum, TON utilise un **modèle à comptes** : chaque adresse a un solde, pas des UTXO. Mais deux différences changent la lecture d'un explorateur :

- **chaque portefeuille est un smart contract**. Il n'y a pas de « compte simple » comme un EOA Ethereum : l'adresse d'un portefeuille dépend du **code** du contrat (sa version) et de la **clé publique** ;
- les transactions sont **asynchrones** : l'utilisateur envoie un *message externe* à son propre portefeuille, qui émet un *message interne* vers le destinataire. Une opération visible comme « un transfert » dans l'application peut donc correspondre à **plusieurs transactions** liées sur l'explorateur (une par contrat touché).`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Contrat de portefeuille', def: `Smart contract qui détient les fonds et vérifie la signature de son propriétaire. Plusieurs versions coexistent (v3R2, v4R2, W5…) : même clé, adresses différentes.` },
        { term: 'Workchain', def: `Sous-chaîne de TON. Les comptes ordinaires sont sur la basechain (workchain 0) ; la masterchain (workchain −1) sert à la coordination du réseau.` },
        { term: 'Message externe / interne', def: `Le message externe vient de l'extérieur (l'utilisateur signe) ; les messages internes circulent entre contrats et transportent les fonds.` },
        { term: 'Compte non initialisé', def: `Adresse qui a reçu des fonds mais dont le contrat n'est pas encore déployé ; il l'est lors de la première transaction sortante.` },
        { term: 'Bounce (rebond)', def: `Si un message « rebondissable » échoue chez le destinataire (par exemple un compte non initialisé), les fonds reviennent à l'expéditeur, moins les frais.` },
        { term: 'Commentaire', def: `Texte joint à un transfert (corps du message commençant par un code d'opération nul). Équivalent fonctionnel du memo ou du destination tag.` },
        { term: 'Jetton', def: `Jeton fongible sur TON (standard TEP-74). Un contrat maître (jetton master) et un contrat « jetton wallet » par détenteur.` },
        { term: 'Nanoton', def: `Plus petite unité : 1 TON = 1 000 000 000 nanotons.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une phrase de récupération, plusieurs adresses',
      md: `Comme l'adresse dépend de la **version du contrat de portefeuille**, une même phrase de récupération donne une adresse différente en v3R2, v4R2 ou W5. Lors d'une saisie ou de l'exploitation d'un téléphone, **dérivez toutes les versions** et interrogez chacune : un suspect peut avoir migré de version et laissé des fonds sur l'ancienne adresse.`,
    },
    { type: 'heading', text: 'Les adresses : un même compte, trois écritures' },
    {
      type: 'text',
      md: `Une adresse TON est, au fond, un couple **workchain : identifiant de compte** (256 bits). Elle s'écrit de deux façons :

- la **forme brute** (*raw*) : \`0:\` suivi de 64 caractères hexadécimaux ;
- la **forme conviviale** (*user-friendly*) : 48 caractères en base64 « url-safe », qui encodent en plus des **drapeaux** (bounceable ou non, réseau principal ou testnet) et une **somme de contrôle**.

Le premier caractère de la forme conviviale trahit les drapeaux. Changer le drapeau modifie donc le **début** et la **somme de contrôle à la fin**, mais **le compte est le même**.

Pourquoi deux formes ? Un envoi en forme **bounceable** vers un portefeuille jamais initialisé **échoue et rebondit** : les fonds reviennent à l'expéditeur, moins les frais. Pour éviter ces échecs, les portefeuilles d'utilisateurs s'affichent désormais en **UQ…**, tandis que les contrats et services restent souvent en **EQ…**. En analyse, vérifiez le **statut** de chaque message : une victime peut croire avoir payé alors que les fonds lui sont revenus, ou l'inverse.`,
    },
    {
      type: 'table',
      caption: `Les écritures d'une adresse TON (même compte dans les trois premières lignes)`,
      headers: ['Forme', 'Exemple', 'Signification', 'Usage courant'],
      rows: [
        ['Brute', '`0:7df20233c87e…fafacd8a51`', 'Workchain 0 + identifiant hexadécimal', 'APIs, bases d’attribution, normalisation'],
        ['Bounceable (EQ…)', '`EQB98gIzyH4Z0WT4UqO3tA4hK5frHwcKXTIolpp6-s2KUZLS`', 'Réseau principal, rebond demandé en cas d’échec', 'Smart contracts, adresses de service'],
        ['Non-bounceable (UQ…)', '`UQB98gIzyH4Z0WT4UqO3tA4hK5frHwcKXTIolpp6-s2KUc8X`', 'Réseau principal, pas de rebond', 'Portefeuilles d’utilisateurs (affichage par défaut de la plupart des applications depuis 2024)'],
        ['Testnet (kQ… / 0Q…)', '`kQ…` ou `0Q…`', 'Réseau de test', 'Ne doit pas apparaître dans une affaire réelle : vérifier'],
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'Écrite par la victime (UQ)',
        md: `\`UQB98gIzyH4Z0WT4UqO3tA4hK5frHwcKXTIolpp6-s2KUc8X\`

Premier caractère **U**, fin **…KUc8X**.`,
      },
      right: {
        title: 'Affichée par un explorateur (EQ)',
        md: `\`EQB98gIzyH4Z0WT4UqO3tA4hK5frHwcKXTIolpp6-s2KUZLS\`

Premier caractère **E**, fin **…KUZLS**. Le milieu est identique : **même compte**.`,
      },
    },
    {
      type: 'check',
      q: `La victime a payé \`UQBpLXVL…ie1YfcIN\` ; l'outil d'analyse affiche une étiquette sur \`EQBpLXVL…ie1YfZ_I\`. Le milieu des deux chaînes est identique. Que concluez-vous ?`,
      options: [
        `Ce sont deux écritures du même compte (non-bounceable et bounceable) : l'étiquette s'applique`,
        `Ce sont deux adresses sosies : un address poisoning est probable`,
        `L'une est sur le testnet, l'autre sur le réseau principal`,
        `Impossible de conclure sans réquisition`,
      ],
      answer: 0,
      explain: `Sur TON, passer de UQ à EQ ne change que le drapeau (premier caractère) et la somme de contrôle (derniers caractères). Convertissez les deux en forme brute 0:… pour le constater formellement et le consigner.`,
    },
    { type: 'heading', text: 'Portefeuille dans Telegram ou portefeuille auto-hébergé ?' },
    {
      type: 'compare',
      left: {
        title: 'Portefeuille custodial intégré',
        md: `L'application portefeuille accessible depuis Telegram propose un **compte custodial** : l'opérateur détient les clés, l'utilisateur voit un solde.

- Ouverture liée au **compte Telegram** (donc à un numéro de téléphone), vérification d'identité selon les seuils et fonctionnalités.
- Dépôts et retraits on-chain passent par des **adresses de l'opérateur**.
- Les transferts **entre deux utilisateurs** du même service peuvent ne laisser **aucune trace on-chain** : ils ne figurent que dans le registre interne.
- Une place de marché **P2P intégrée** permet d'acheter des crypto-actifs contre virement.

**Pour l'enquête** : l'opérateur est un prestataire à réquisitionner (identité, numéro, historique interne, IP).`,
      },
      right: {
        title: 'Portefeuille auto-hébergé',
        md: `Applications indépendantes (par exemple Tonkeeper) ou espace auto-hébergé proposé dans la même application que le compte custodial : l'utilisateur détient sa **phrase de récupération**.

- Adresse propre, visible et analysable sur l'explorateur.
- Aucune donnée d'identité chez l'éditeur de l'application, en principe.
- Connexion aux mini-applications par **TON Connect** : l'application demande à l'utilisateur de signer des transactions.

**Pour l'enquête** : pas de réquisition « magique » ; il faut remonter les flux jusqu'à un service identifiant (exchange, P2P, custodial) ou exploiter le support (téléphone).`,
      },
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : quelle application, quel espace ?',
      md: `Lors de l'audition, faites préciser **l'application exacte** (et l'espace utilisé dans l'application), puis faites montrer l'écran « Recevoir » : une adresse personnelle stable oriente vers l'auto-hébergé ; un solde sans adresse propre, ou une adresse de dépôt avec commentaire, oriente vers le custodial. Photographiez les écrans d'historique : dans un service custodial, ils sont parfois la **seule trace** d'un transfert interne.`,
    },
    { type: 'heading', text: 'Commentaires : le memo de TON' },
    {
      type: 'text',
      md: `Un transfert TON peut porter un **commentaire** texte : techniquement, le corps du message commence par un code d'opération de 32 bits à zéro, suivi du texte. Les explorateurs l'affichent en clair. Certains portefeuilles proposent aussi des **commentaires chiffrés**, illisibles sans la clé du destinataire.

De nombreux exchanges et services custodial utilisent une **adresse de dépôt partagée** par tous leurs clients : c'est le **commentaire** (souvent appelé *memo* ou *tag* dans l'interface) qui indique à quel client créditer le dépôt. C'est exactement la logique du **destination tag XRP** :

- l'adresse seule désigne le **service**, pas le client ;
- le couple **adresse + commentaire** (et le hash de la transaction) désigne le **client** ;
- un dépôt sans commentaire arrive chez le service mais n'est crédité à personne automatiquement.

Les escrocs exploitent aussi le commentaire : un bot qui demande à la victime de saisir « son code » s'en sert pour savoir **quel compte fictif créditer**, ce qui révèle souvent un système de gestion industrialisé.`,
    },
    {
      type: 'flow',
      caption: `Affaire @GramYieldBot : le collecteur dépose chez un exchange via l'adresse partagée ; seul le commentaire désigne le client.`,
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: 'UQB98g…KUc8X' },
        { id: 'bot', label: 'Adresse du bot', kind: 'suspect', sub: 'UQAKYi…QPM44' },
        { id: 'col', label: 'Collecteur', kind: 'wallet', sub: 'UQBpLX…YfcIN' },
        { id: 'dep', label: 'Adresse partagée', kind: 'deposit', sub: 'exchange · EQD5qY…fDKaE' },
        { id: 'hot', label: 'Hot wallet', kind: 'hot', sub: 'exchange' },
        { id: 'cli', label: 'Compte client', kind: 'exchange', sub: 'identifié par le commentaire' },
      ],
      edges: [
        { from: 'v', to: 'bot', label: '4 200 TON · commentaire « 30418866 »' },
        { from: 'bot', to: 'col', label: 'balayage quotidien' },
        { from: 'col', to: 'dep', label: '18 600 TON · commentaire « 8841207733 »' },
        { from: 'dep', to: 'hot', label: 'gestion interne' },
        { from: 'dep', to: 'cli', label: 'crédit (registre interne)', dashed: true },
      ],
    },
    { type: 'widget', id: 'exchange-flow', caption: `Rappel du circuit d'un exchange. Sur TON, l'étape « adresse de dépôt » est souvent une adresse partagée : le commentaire remplace l'adresse individuelle.` },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Piège n° 1 : le commentaire oublié',
      md: `Dans une réquisition à un exchange, l'adresse partagée seule ne sert à rien : elle reçoit des milliers de dépôts par jour. Transmettez **le hash de la transaction, la date et l'heure UTC, le montant, l'adresse de destination et le commentaire exact** (caractère par caractère, zéros initiaux compris). Si le commentaire est absent (dépôt orphelin), le hash permet malgré tout au service de retrouver l'opération et, souvent, la réclamation déposée par l'expéditeur pour se faire créditer.`,
    },
    { type: 'heading', text: 'Jettons : l’USDT sur TON' },
    {
      type: 'text',
      md: `L'USDT est émis sur TON depuis 2024 sous forme de **jetton**. La mécanique diffère de l'ERC-20, où un seul contrat tient tous les soldes :

1. le **contrat maître** (*jetton master*) définit le jeton (nom, symbole, décimales, émetteur) ;
2. chaque détenteur possède son propre **jetton wallet**, un petit contrat dont l'adresse est dérivée de celle de son propriétaire ;
3. pour envoyer, le propriétaire écrit à **son** jetton wallet, qui transfère au jetton wallet du destinataire, lequel **notifie** le propriétaire destinataire ; un commentaire peut voyager dans cette notification (*forward payload*).

Conséquences : sur l'explorateur, il y a **plusieurs adresses** dans un seul transfert de jetton (portefeuilles des deux parties et leurs jetton wallets). Raisonnez toujours sur les **propriétaires**, que les explorateurs affichent, et vérifiez que le jetton provient bien du **contrat maître publié par l'émetteur** : un faux « USDT » au même symbole est trivial à créer.`,
    },
    {
      type: 'table',
      caption: `Lire une ligne de transfert sur TON`,
      headers: ['Élément', 'Ce qu’il faut relever', 'Piège'],
      rows: [
        ['Actif', 'TON natif ou jetton (contrat maître)', 'Symbole « USDT » d’un faux jetton'],
        ['Montant', 'TON : 9 décimales ; USDT sur TON : 6 décimales', 'Valeur brute en nanotons lue comme des TON'],
        ['Expéditeur / destinataire', 'Propriétaires, en forme brute', 'Confondre propriétaire et jetton wallet'],
        ['Commentaire', 'Texte exact, ou mention « chiffré »', 'Oublier le commentaire dans la réquisition'],
        ['Statut', 'Succès, échec, rebond (bounce)', 'Compter comme reçu un transfert qui a rebondi'],
        ['Chaîne de transactions', 'Message initial et messages internes liés', 'Croire à plusieurs paiements distincts'],
      ],
    },
    { type: 'heading', text: 'Pourquoi TON est au cœur des escroqueries sur Telegram' },
    {
      type: 'table',
      caption: `Tout se déroule dans la messagerie, avec une apparence de légitimité : recrutement, paiement, achat de crypto-actifs, et même anonymisation du compte (numéro anonyme acheté sur Fragment). Schémas fréquents (noms fictifs) et traces exploitables.`,
      headers: ['Schéma', 'Mode opératoire', 'Trace on-chain', 'Preuve Telegram à figer'],
      rows: [
        ['Bot d’« investissement »', '@GramYieldBot : faux staking, solde fictif, frais de déblocage', 'Dépôts vers l’adresse du bot, balayages vers un collecteur', 'Nom d’utilisateur du bot, conversation, commentaire attribué'],
        ['Mini-application de faux airdrop', 'TonHarvest : « réclamez vos jetons », connexion TON Connect, signature d’un transfert', 'Transfert de tous les TON et jettons vers un drainer, souvent en un seul message', 'Lien t.me de la mini-app, URL chargée, captures de la demande de signature'],
        ['Faux minage dans le cloud', '« Louez une puissance de calcul » payée en TON, parrainage rémunéré', 'Petits paiements de retour aux premiers entrants (Ponzi)', 'Canal, grille de parrainage, liens d’invitation'],
        ['Canal de signaux / pump', 'Achat coordonné d’un jetton promu', 'Achats sur DEX TON, ventes des initiés', 'Messages horodatés, administrateurs du canal'],
        ['Vendeur P2P frauduleux', 'Paiement par virement, crypto jamais livrée ou virement frauduleux', 'Selon le service : registre interne', 'Annonce, pseudonyme, IBAN fourni'],
        ['Faux bot de vérification', 'Page imitant une vérification « humaine » qui fait exécuter un code ou saisir un code de connexion', 'Vol ultérieur du portefeuille', 'Bot, canal porteur, code exécuté'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — le bot @GramYieldBot',
      md: `Plainte du 14 mars. La victime a acheté **4 200 TON** dans le compte custodial de son application Telegram, les a retirés le 19 février à 16:02 UTC vers \`UQAKYiJl0lX3bkgbaHWLbWwK8NfpxOSHc3_hz7WKsl_QPM44\` avec le commentaire **30418866** fourni par le bot.

Analyse :

- l'adresse du bot (forme brute \`0:0a622265…b25fd03c\`) a reçu **1 312 dépôts** du 2 février au 3 mars, chacun avec un commentaire numérique à 8 chiffres : un code par « client » ;
- chaque soir vers 22:00 UTC, elle balaie son solde vers le collecteur \`UQBpLXVLSHm6ZKkoXd3RRvnJdRX-BuqjpEgFt8qBie1YfcIN\` ;
- le collecteur a déposé **18 600 TON** le 21 février et **31 250 TON** le 1er mars sur l'adresse partagée d'un exchange, avec **le même commentaire 8841207733** les deux fois : un seul et même client ;
- le collecteur détient aussi le NFT d'un **numéro anonyme** acheté sur Fragment le 30 janvier : le compte Telegram de l'administrateur du bot a vraisemblablement été ouvert avec ce numéro.

Actes : réquisition à l'exchange (hashes, horaires, commentaire 8841207733) ; réquisition à l'opérateur du portefeuille custodial pour l'opération de retrait de la victime ; recherche des autres plaintes en France par le nom du bot ; constatation de la propriété du NFT de numéro anonyme sur l'explorateur.`,
    },
    {
      type: 'check',
      q: `Dans ce cas, pourquoi les 1 312 commentaires à 8 chiffres reçus par l'adresse du bot sont-ils précieux ?`,
      options: [
        `Ils contiennent les clés privées des victimes`,
        `Chacun correspond à un compte fictif de victime : ils permettent de dénombrer et d'identifier les victimes potentielles`,
        `Ils prouvent que le bot est hébergé par un exchange`,
        `Ils n'ont aucune valeur : seuls les montants comptent`,
      ],
      answer: 1,
      explain: `Le commentaire sert au bot à créditer le bon compte fictif. La liste des dépôts (adresse expéditrice, montant, commentaire) est une base de recensement des victimes, à rapprocher des plaintes et des réquisitions aux services d'origine.`,
    },
    { type: 'heading', text: 'Stratégie d’enquête' },
    {
      type: 'steps',
      items: [
        { title: 'Figer la preuve Telegram', md: `Nom d'utilisateur **et identifiant numérique** des comptes, bots et canaux (le nom d'utilisateur peut changer, l'identifiant non), liens \`t.me/…\`, liens de messages, captures horodatées, export de la conversation depuis l'application de bureau si la victime y a accès. Consignez tout par procès-verbal de constatation.` },
        { title: 'Normaliser les adresses', md: `Relevez chaque adresse en forme conviviale **et** brute \`0:…\`, avec la version de portefeuille si elle est connue, dans vos tableaux, réquisitions et rapports. Une recherche textuelle sur \`EQ…\` ne trouvera pas \`UQ…\` : sans normalisation, vous croirez à deux acteurs distincts ou raterez un recoupement. Distinguez propriétaires et jetton wallets.` },
        { title: 'Reconstituer les flux', md: `Sur un explorateur public (par exemple **Tonviewer** ou **Tonscan**, qui affichent commentaires, jettons, NFT et messages internes) : dépôts de la victime, commentaires, balayages, collecteurs, conversions en USDT ou passage par un DEX de TON, sorties vers des services. Vérifiez les statuts (échec, rebond).` },
        { title: 'Identifier les services', md: `Adresses partagées d'exchanges (commentaire indispensable), opérateur du portefeuille custodial, places de marché P2P. Les sources d'attribution indiquent souvent l'exchange derrière une adresse partagée.` },
        { title: 'Requérir', md: `Exchange : identité, KYC, IP, autres dépôts et retraits du client désigné par le commentaire. Opérateur custodial : titulaire, numéro de téléphone associé, registre interne (y compris transferts internes invisibles on-chain). Fragment / NFT : propriétaire on-chain d'un nom d'utilisateur ou d'un numéro anonyme, pivot vers d'autres flux ; même logique pour un domaine \`.ton\` pointant vers l'adresse ou une adresse publiée dans un canal.` },
        { title: 'Rechercher les autres victimes', md: `Dépôts entrants de l'adresse du bot, commentaires, plaintes portant sur le même bot ou la même mini-application, signalements.` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Telegram et les demandes des autorités',
      md: `Telegram a modifié sa politique de confidentialité à l'automne 2024 et y indique pouvoir communiquer, sur demande judiciaire valable, l'adresse IP et le numéro de téléphone d'utilisateurs visés par une enquête pénale. Le **canal de transmission** et l'**étendue** des données effectivement communiquées doivent être vérifiés au moment de la demande (portail ou point de contact en vigueur, entraide éventuelle selon l'entité concernée). L'opérateur du portefeuille custodial est une entité **distincte** de Telegram : identifiez-la par ses conditions d'utilisation et adressez-lui une réquisition séparée.`,
    },
  ],
  keyPoints: [
    `TON est un modèle à comptes asynchrone : chaque portefeuille est un smart contract, un transfert peut produire plusieurs transactions liées.`,
    `Une adresse TON a plusieurs écritures (brute 0:…, EQ… bounceable, UQ… non-bounceable) pour un même compte : normaliser en forme brute.`,
    `Une même phrase de récupération donne des adresses différentes selon la version du contrat de portefeuille : dériver toutes les versions.`,
    `Adresse partagée + commentaire = le client d'un exchange ; une réquisition sans commentaire ni hash est inexploitable.`,
    `Jettons (dont l'USDT) : contrat maître + jetton wallet par détenteur ; raisonner sur les propriétaires et vérifier le contrat maître.`,
    `Portefeuille custodial intégré : prestataire à réquisitionner, transferts internes parfois invisibles on-chain.`,
    `Figer la preuve Telegram (identifiants numériques, liens, captures, export) et exploiter les pivots Fragment et domaines .ton.`,
  ],
  quiz: [
    {
      q: `Quelle forme d'adresse TON est la plus sûre pour recouper des données entre outils et bases d'attribution ?`,
      options: [
        `La forme bounceable EQ…`,
        `La forme non-bounceable UQ…`,
        `La forme brute 0:… (workchain + identifiant hexadécimal)`,
        `Le nom d'utilisateur Telegram`,
      ],
      answer: 2,
      explain: `La forme brute ne dépend pas des drapeaux : EQ… et UQ… d'un même compte s'y ramènent à la même valeur.`,
    },
    {
      kind: 'truefalse',
      q: `\`EQB98gIz…s2KUZLS\` et \`UQB98gIz…s2KUc8X\` désignent deux comptes différents, puisque leurs derniers caractères diffèrent.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Seuls le drapeau (premier caractère) et la somme de contrôle (fin) changent entre les formes bounceable et non-bounceable : c'est le même compte.`,
    },
    {
      kind: 'multi',
      q: `Que faut-il transmettre à un exchange pour identifier le client destinataire d'un dépôt TON sur une adresse partagée ? (plusieurs réponses)`,
      options: [
        `Le hash de la transaction`,
        `Le commentaire exact joint au transfert`,
        `La date, l'heure UTC et le montant`,
        `La phrase de récupération de la victime`,
      ],
      answer: [0, 1, 2],
      explain: `Adresse partagée + commentaire + hash, date et montant permettent au service de retrouver le crédit. La phrase de récupération de la victime n'a pas à être demandée ni transmise.`,
    },
    {
      q: `Un suspect a utilisé la même phrase de récupération pendant deux ans. Pourquoi ne pas se limiter à l'adresse affichée par son application actuelle ?`,
      options: [
        `Parce que TON change d'adresse à chaque transaction`,
        `Parce que la masterchain conserve une copie des fonds`,
        `Parce que les jettons sont stockés sur le testnet`,
        `Parce que l'adresse dépend de la version du contrat de portefeuille : d'anciennes versions peuvent détenir des fonds`,
      ],
      answer: 3,
      explain: `v3R2, v4R2, W5… : même clé, adresses différentes. Il faut dériver et interroger chaque version.`,
    },
    {
      kind: 'multi',
      q: `Quelles affirmations sur les jettons TON sont exactes ? (plusieurs réponses)`,
      options: [
        `Chaque détenteur a son propre contrat « jetton wallet »`,
        `Le symbole « USDT » suffit à authentifier le jeton`,
        `Un transfert de jetton peut transporter un commentaire dans la notification au destinataire`,
        `Il faut vérifier le contrat maître publié par l'émetteur`,
      ],
      answer: [0, 2, 3],
      explain: `Le symbole se copie librement : seul le contrat maître authentifie le jeton. Les autres affirmations décrivent la mécanique TEP-74.`,
    },
    {
      q: `Pourquoi les portefeuilles d'utilisateurs s'affichent-ils désormais en UQ… (non-bounceable) ?`,
      options: [
        `Pour éviter qu'un envoi vers un portefeuille non initialisé échoue et rebondisse`,
        `Pour masquer l'identité du titulaire`,
        `Parce que les adresses EQ… sont réservées au testnet`,
        `Pour rendre les fonds gelables par l'émetteur`,
      ],
      answer: 0,
      explain: `Un message bounceable vers un compte non déployé échoue et revient à l'expéditeur. La forme UQ… évite ce rebond pour les portefeuilles d'utilisateurs.`,
    },
    {
      kind: 'truefalse',
      q: `Un transfert entre deux utilisateurs du même portefeuille custodial intégré à Telegram peut ne laisser aucune transaction visible sur l'explorateur TON.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Entre deux clients d'un même service custodial, l'opérateur peut se contenter de débiter l'un et de créditer l'autre dans son registre interne. Seule une réquisition à l'opérateur fera apparaître l'opération et le bénéficiaire.`,
    },
    {
      q: `Quel élément Telegram faut-il impérativement relever, car il ne change pas quand l'utilisateur modifie son pseudonyme ?`,
      options: [
        `Le nom affiché`,
        `La photo de profil`,
        `L'identifiant numérique du compte`,
        `La langue de l'interface`,
      ],
      answer: 2,
      explain: `Le nom d'utilisateur (@…) et le nom affiché se changent à volonté ; l'identifiant numérique est stable et c'est lui qu'il faut viser dans les demandes.`,
    },
  ],
  flashcards: [
    { front: 'TON', back: `The Open Network : blockchain à modèle de comptes asynchrone, actif natif Toncoin, intégrée à l'écosystème Telegram.` },
    { front: '1 TON =', back: `10^9 nanotons (9 décimales).` },
    { front: 'Adresse EQ…', back: `Forme conviviale bounceable, réseau principal (smart contracts, services).` },
    { front: 'Adresse UQ…', back: `Forme conviviale non-bounceable, réseau principal (portefeuilles d'utilisateurs).` },
    { front: 'Adresse 0:…', back: `Forme brute : workchain 0 + identifiant hexadécimal de 64 caractères. À utiliser pour normaliser.` },
    { front: 'EQ… et UQ… d’un même compte', back: `Premier caractère et derniers caractères (somme de contrôle) différents, milieu identique.` },
    { front: 'Commentaire TON', back: `Texte joint au transfert ; sur une adresse partagée d'exchange, il désigne le client (comme un destination tag).` },
    { front: 'Jetton', back: `Jeton TON (TEP-74) : contrat maître + un jetton wallet par détenteur.` },
    { front: 'Versions de portefeuille', back: `v3R2, v4R2, W5… : même phrase de récupération, adresses différentes. Les dériver toutes.` },
    { front: 'Bounce', back: `Rebond d'un message échoué : les fonds reviennent à l'expéditeur, moins les frais.` },
    { front: 'Transfert interne custodial', back: `Peut n'exister que dans le registre de l'opérateur : réquisition indispensable.` },
    { front: 'Pivots Fragment', back: `Noms d'utilisateur et numéros anonymes Telegram sont des NFT sur TON : leur détenteur est une adresse.` },
  ],
}
