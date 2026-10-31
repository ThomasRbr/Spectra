// Niveau 3 — Smart contracts : contrats de dépôt (forwarders) et CREATE2.
// Exemples CREATE2 : vecteurs de test de l'EIP-1014, vérifiés avec src/engine/keccak.ts.
// Acteurs réels (BitGo, Etherscan, Circle) décrits factuellement ; l'exchange
// « Norvex », les suspects et les adresses des cas sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_CREATE2: Lesson = {
  id: 'contrats-depot-create2',
  title: 'Contrats de dépôt et CREATE2 : quand l\'adresse de dépôt est un contrat',
  level: 3,
  track: 'contrats',
  minutes: 40,
  summary: `De nombreuses plateformes attribuent à leurs clients des adresses de dépôt qui sont des contrats « forwarders », déployés par une fabrique grâce à CREATE2 : leur adresse est calculable d'avance et reçoit des fonds avant même d'exister. L'ETH y est reversé automatiquement par transaction interne, les jetons sont reversés plus tard par un portefeuille opérationnel. Comment lire ces trois transactions, adapter l'heuristique d'adresse de dépôt, désigner la bonne adresse dans une réquisition et éviter les confusions entre client, fabrique, portefeuille opérationnel et hot wallet.`,
  objectives: [
    `Expliquer pourquoi une plateforme utilise des contrats de dépôt plutôt que des adresses à clé privée, et reconnaître ce modèle sur un explorateur.`,
    `Énoncer la formule d'adresse CREATE2 et en déduire qu'une adresse de dépôt peut recevoir des fonds avant le déploiement de son contrat.`,
    `Distinguer le reversement automatique de l'ETH (transaction interne, événement ForwarderDeposited) du reversement des jetons par flushTokens ou par la fabrique.`,
    `Adapter l'heuristique d'adresse de dépôt à un contrat : signaux à rechercher, adresses à ne pas confondre avec le client.`,
    `Rédiger une réquisition qui vise l'adresse du contrat de dépôt, avec les éléments permettant à la plateforme d'identifier le client.`,
  ],
  prerequisites: ['exchanges', 'transactions-internes', 'requisitions'],
  practice: ['depot-contrat', 'approve-drain'],
  blocks: [
    {
      type: 'text',
      md: `Le 2 avril à 21:40 UTC, le portefeuille d'un escroc au faux placement, \`0x7d21…c8a0\`, envoie **7 300 USDC** à l'adresse \`0xc5e8…41b7\`. L'enquêteur ouvre cette adresse : à cette date, aucun code, aucune transaction sortante, un solde de 7 300 USDC. Une heure et demie plus tard, les USDC partent vers le hot wallet de l'exchange « Norvex »… dans une transaction qui n'a **pas** été signée par \`0xc5e8…41b7\`, mais par une autre adresse de Norvex, adressée à un troisième contrat. Et depuis cette transaction, \`0xc5e8…41b7\` **est devenue un contrat**.

Persuadé que le suspect a « envoyé au hot wallet », l'enquêteur adresse sa réquisition à Norvex en citant le hot wallet. Réponse de la plateforme : cette adresse regroupe les fonds de plusieurs centaines de milliers de clients ; impossible d'identifier qui que ce soit sans l'adresse de dépôt.

L'adresse de dépôt existait pourtant dès le premier jour : c'était \`0xc5e8…41b7\`, un **contrat de dépôt** dont l'adresse avait été calculée d'avance par **CREATE2**.`,
    },
    { type: 'heading', text: 'Pourquoi des contrats comme adresses de dépôt ?' },
    {
      type: 'compare',
      left: {
        title: 'Adresse de dépôt à clé privée (EOA)',
        md: `- Une clé privée par client, à générer et à protéger.
- Pour balayer des **jetons**, l'adresse doit payer le gas : la plateforme lui envoie d'abord un peu d'ETH (alimentation en gas), puis signe le balayage avec la clé de l'adresse.
- Le balayage est une transaction **signée par l'adresse de dépôt** : nonce qui augmente, modèle « réception puis balayage » très lisible.`,
      },
      right: {
        title: 'Contrat de dépôt (forwarder)',
        md: `- Aucune clé privée par client : le contrat ne sait que **reverser** vers une adresse « parente » fixée à l'avance.
- L'**ETH** reçu est reversé automatiquement, dans la même transaction.
- Les **jetons** sont reversés à la demande par un **portefeuille opérationnel** de la plateforme, qui paie le gas pour le compte du contrat.
- Le contrat ne signe jamais rien : le « balayage » est un appel de contrat signé par un autre compte.`,
      },
    },
    {
      type: 'text',
      md: `Le dépositaire **BitGo** publie en source ouverte des contrats de portefeuille multisignature qui comprennent un **Forwarder** et une **fabrique** (*ForwarderFactory*) ; de nombreuses plateformes et dépositaires emploient ce modèle ou un modèle voisin. Les fabriques déploient souvent des **clones minimaux** (EIP-1167) : de petits contrats identiques qui délèguent leur logique à une implémentation unique, ce qui rend le déploiement peu coûteux et donne à tous les contrats de dépôt d'une plateforme le **même code**.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Forwarder (contrat de dépôt)', def: `Contrat attribué à un client, qui reverse ce qu'il reçoit vers l'adresse parente de la plateforme. Il identifie le client, comme une adresse de dépôt classique.` },
        { term: 'Adresse parente', def: `Destination fixée dans le contrat de dépôt : en général le hot wallet (ou un portefeuille multisignature) de la plateforme.` },
        { term: 'Fabrique (factory)', def: `Contrat de la plateforme qui déploie les contrats de dépôt, souvent par CREATE2. Infrastructure : elle n'identifie aucun client.` },
        { term: 'Portefeuille opérationnel', def: `Compte de la plateforme qui signe les déploiements et les reversements de jetons et en paie le gas. Il identifie la plateforme, pas le client.` },
        { term: 'CREATE2', def: `Instruction EVM (EIP-1014) qui déploie un contrat à une adresse déterminée par la fabrique, un sel et le code d'initialisation, indépendamment du nonce.` },
        { term: 'Sel (salt)', def: `Valeur de 32 octets choisie par la plateforme, souvent dérivée d'un identifiant interne du client : changer le sel change l'adresse.` },
        { term: 'Code d\'initialisation (init code)', def: `Code exécuté au déploiement, qui produit le code définitif du contrat. Son hash entre dans le calcul CREATE2.` },
        { term: 'flushTokens', def: `Fonction du forwarder (\`flushTokens(address)\`, sélecteur \`0x3ef13367\`) qui reverse vers l'adresse parente tout le solde d'un jeton donné.` },
      ],
    },
    { type: 'heading', text: 'CREATE et CREATE2 : une adresse connue avant le contrat' },
    {
      type: 'text',
      md: `Un contrat déployé de façon classique (**CREATE**) reçoit une adresse qui dépend du déployeur et de son **nonce** : \`keccak256(rlp([déployeur, nonce]))\`, dont on garde les 20 derniers octets. Impossible de la connaître sans savoir dans quel ordre les déploiements auront lieu.

**CREATE2**, disponible sur Ethereum depuis la mise à jour Constantinople (2019), calcule l'adresse ainsi :

\`adresse = keccak256(0xff ‖ adresse de la fabrique ‖ sel ‖ keccak256(code d'initialisation))[12:]\`

On concatène un octet \`0xff\`, les 20 octets de la fabrique, les 32 octets du sel et les 32 octets du hash du code, on hache le tout et on garde les **20 derniers octets** (on retire les 12 premiers). Aucun élément ne dépend du moment du déploiement : la plateforme peut **calculer l'adresse de dépôt d'un client dès l'ouverture de son compte**, la lui afficher, et ne déployer le contrat que plus tard — voire jamais, si le client ne dépose rien.`,
    },
    {
      type: 'table',
      caption: `Vecteurs de test officiels de l'EIP-1014 (code d'initialisation 0x00), recalculés avec Keccak-256.`,
      headers: ['Fabrique', 'Sel', 'Adresse CREATE2 obtenue'],
      rows: [
        ['`0x0000000000000000000000000000000000000000`', '`0x00…00` (32 octets nuls)', '`0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38`'],
        ['`0xdeadbeef00000000000000000000000000000000`', '`0x000000000000000000000000feed000000000000000000000000000000000000`', '`0xD04116cDd17beBE565EB2422F2497E06cC1C9833`'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une adresse sans code n\'est pas forcément un compte ordinaire',
      md: `Avant son déploiement, une adresse CREATE2 ressemble à n'importe quelle adresse : pas de code, aucune transaction signée, un solde qui grossit. Ne concluez pas trop vite à un « portefeuille personnel » : vérifiez si un contrat y a été **déployé plus tard**, et par qui. Les jetons reçus avant le déploiement ne sont pas perdus : leur solde est inscrit dans le registre du contrat du jeton et sera reversé après le déploiement. Dans l'inspecteur de Spectra, la transaction de déploiement affiche l'encadré « Contrat(s) déployé(s) par cette transaction ».`,
    },
    {
      type: 'check',
      q: `Pourquoi une plateforme peut-elle afficher à son client une adresse de dépôt avant d'avoir déployé le moindre contrat ?`,
      options: [
        `Parce que l'adresse est tirée au hasard puis réservée auprès du réseau`,
        `Parce que l'adresse CREATE2 ne dépend que de la fabrique, du sel et du hash du code d'initialisation, tous connus d'avance`,
        `Parce que le client signe lui-même le déploiement`,
        `Parce que l'adresse est celle du hot wallet, suffixée par l'identifiant du client`,
      ],
      answer: 1,
      explain: `La formule CREATE2 n'utilise ni nonce ni horodatage : la plateforme calcule l'adresse à partir de sa fabrique, d'un sel propre au client et du code du contrat. Les fonds peuvent y arriver avant le déploiement.`,
    },
    { type: 'heading', text: 'ETH et jetons : deux reversements différents' },
    {
      type: 'table',
      headers: ['', 'Dépôt d\'ETH', 'Dépôt de jetons (ERC-20)'],
      rows: [
        ['Ce qui se passe', 'Le contrat déployé reçoit l\'ETH et le reverse aussitôt à l\'adresse parente (fonction de réception)', 'Le contrat du jeton crédite le contrat de dépôt sans le prévenir : ERC-20 ne déclenche aucun code chez le destinataire'],
        ['Quand', 'Dans la **même transaction** que le dépôt', 'Plus tard, quand la plateforme déclenche le reversement (minutes ou heures)'],
        ['Signataire du reversement', 'Le déposant (c\'est sa transaction)', 'Le **portefeuille opérationnel** de la plateforme'],
        ['Appel de contrat', 'Aucune donnée d\'entrée (`0x`) : simple envoi d\'ETH au contrat', '`flushTokens(address)` sur le contrat de dépôt ; au premier reversement, dans Spectra, `createForwarder(address,bytes32)` (`0xfb90b320`) sur la fabrique, qui déploie le contrat'],
        ['Où lire le reversement', 'Panneau « Transactions internes » : contrat de dépôt → hot wallet', 'Panneau « Journaux d\'événements » : Transfer du contrat de dépôt vers le hot wallet'],
        ['Événement', '`ForwarderDeposited(from, value, data)` émis par le contrat de dépôt', '`Transfer` émis par le contrat du jeton'],
      ],
    },
    {
      type: 'text',
      md: `Dans les contrats publiés par BitGo, l'événement de dépôt d'ETH est \`ForwarderDeposited(address from, uint256 value, bytes data)\` : aucun paramètre n'est indexé, le journal ne compte donc qu'un **topic0** (\`0x69b31548dea9b3b707b4dff357d326e3e9348b24e7a6080a218a6edeeec48f9b\`) et tout le reste est dans le champ **data**. Le paramètre \`from\` y désigne le **déposant** : c'est une confirmation précieuse, émise par le contrat lui-même, de qui a crédité ce compte client.

Les implémentations varient d'une plateforme et d'une version à l'autre : certaines fabriques déploient puis reversent en un seul appel, d'autres séparent les deux ; si de l'ETH arrive avant le déploiement, il attend sur l'adresse et le contrat le reverse à son initialisation. Le principe reste le même : **le contrat de dépôt ne signe jamais**, il est actionné.`,
    },
    {
      type: 'flow',
      caption: `Affaire Norvex : le contrat de dépôt identifie le client ; la fabrique, le portefeuille opérationnel et le hot wallet n'identifient que la plateforme.`,
      nodes: [
        { id: 's', label: 'Suspect', kind: 'suspect', sub: '0x7d21…c8a0' },
        { id: 'd', label: 'Contrat de dépôt', kind: 'deposit', sub: '0xc5e8…41b7 · client' },
        { id: 'op', label: 'Portefeuille opérationnel', kind: 'service', sub: 'Norvex · 0x0b9f…5e12' },
        { id: 'f', label: 'Fabrique CREATE2', kind: 'contract', sub: 'Norvex · 0x2a6c…d0f3' },
        { id: 'h', label: 'Hot wallet', kind: 'hot', sub: 'Norvex · 0xf41a…9b27' },
      ],
      edges: [
        { from: 's', to: 'd', label: '7 300 USDC (2 avr.) · 6,2 ETH (5 avr.)' },
        { from: 'op', to: 'f', label: 'createForwarder : déploiement + reversement', dashed: true },
        { from: 'd', to: 'h', label: '7 300 USDC (Transfer) · 6,2 ETH (interne)' },
      ],
    },
    { type: 'heading', text: 'Lire les transactions dans l\'inspecteur' },
    {
      type: 'steps',
      items: [
        { title: 'Le dépôt de jetons', md: `Transaction signée par le suspect, adressée au **contrat USDC** : \`transfer(address,uint256)\`, argument \`to\` = \`0xc5e8…41b7\`, \`value\` = 7 300 000 000 (\`0x1B31D2900\`), soit 7 300 USDC. Journal : Transfer suspect → contrat de dépôt. Rien d'autre ne se passe.` },
        { title: 'Le premier reversement', md: `Transaction signée par le **portefeuille opérationnel** \`0x0b9f…5e12\`, adressée à la **fabrique** : \`createForwarder(address,bytes32)\`, arguments \`parent\` = hot wallet et \`salt\`. Encadré « Contrat(s) déployé(s) par cette transaction » : \`0xc5e8…41b7\`. Journal : Transfer de 7 300 USDC du contrat de dépôt vers le hot wallet.` },
        { title: 'Le dépôt d\'ETH', md: `Transaction signée par le suspect vers \`0xc5e8…41b7\`, données d'entrée \`0x\`, « + 6,2 ETH ». Panneau **Transactions internes** : \`0xc5e8…41b7\` → hot wallet, 6,2 ETH. Journal : **ForwarderDeposited** émis par le contrat de dépôt, \`from\` = suspect.` },
        { title: 'Les reversements suivants', md: `Pour les jetons reçus ensuite : transaction du portefeuille opérationnel adressée cette fois au **contrat de dépôt** lui-même, \`flushTokens(address)\` avec l'adresse du contrat du jeton en argument. Journal : Transfer contrat de dépôt → hot wallet.` },
      ],
    },
    {
      type: 'check',
      q: `Une transaction reverse 2 000 USDC de 0xc5e8…41b7 vers le hot wallet. Elle est signée par 0x0b9f…5e12 et appelle flushTokens. Qui est 0x0b9f…5e12 ?`,
      options: [
        `Le client titulaire de l'adresse de dépôt`,
        `Un complice du suspect qui a pris le contrôle du contrat`,
        `Le portefeuille opérationnel de la plateforme, qui déclenche les reversements et paie le gas`,
        `L'émetteur de l'USDC`,
      ],
      answer: 2,
      explain: `Le contrat de dépôt ne signe jamais : la plateforme actionne le reversement depuis un portefeuille opérationnel, qui fait la même chose pour des milliers de contrats de dépôt. Il identifie la plateforme, pas le client.`,
    },
    { type: 'heading', text: 'L\'heuristique d\'adresse de dépôt, adaptée' },
    {
      type: 'text',
      md: `Sur une chaîne à comptes, une adresse de dépôt se reconnaît à son comportement : elle **reçoit** de plusieurs expéditeurs et **reverse presque tout**, vite, vers **un même collecteur**, comme de nombreuses autres adresses. L'outil d'analyse de Spectra exclut d'ordinaire les contrats de cette heuristique (un routeur ou un pool reverse aussi tout ce qu'il reçoit), **sauf** les contrats de dépôt. Il retient :

- au moins **90 %** des sorties vers le même collecteur, qui n'est pas un contrat ;
- un solde **vidé** à chaque fois (moins de 5 % conservé) ;
- un **délai médian** de reversement court (12 heures au plus) ;
- au moins **deux autres adresses** au comportement identique vers ce collecteur ;
- un collecteur **attribué** à une plateforme connue, et le caractère de **contrat de dépôt** de l'adresse, qui renforcent le score.

Deux adaptations de lecture s'imposent. D'abord, les sorties d'un contrat de dépôt ne sont **jamais signées par lui** : elles apparaissent comme transactions internes (ETH) ou comme événements Transfer (jetons) dans des transactions d'autrui. Ensuite, le modèle offre des **signaux supplémentaires** : même fabrique, même code de contrat, même portefeuille opérationnel qui actionne des milliers de contrats semblables. Ces éléments rattachent l'adresse à la plateforme ; ils ne disent rien du client, que seule la plateforme connaît.`,
    },
    { type: 'widget', id: 'exchange-flow', caption: `Le circuit d'un exchange : dépôt client, balayage, hot wallet, cold wallet. Avec un forwarder, l'étape « balayage » est un reversement actionné par la plateforme.` },
    {
      type: 'table',
      caption: `Qui est qui dans le modèle forwarder ?`,
      headers: ['Adresse', 'Nature', 'Ce qu\'elle identifie', 'À viser dans une réquisition ?'],
      rows: [
        ['Contrat de dépôt (forwarder)', 'Contrat déployé par CREATE2', 'Un **client** de la plateforme', '**Oui** : c\'est la clé d\'identification'],
        ['Fabrique', 'Contrat d\'infrastructure', 'La plateforme', 'Non (sauf pour établir l\'attribution à la plateforme)'],
        ['Portefeuille opérationnel', 'Compte de la plateforme (EOA)', 'La plateforme', 'Non'],
        ['Hot wallet (adresse parente)', 'Compte ou multisignature de la plateforme', 'La plateforme', 'Non : il mêle les fonds de tous les clients'],
        ['Expéditeur du dépôt', 'Compte du suspect ou d\'un intermédiaire', 'L\'auteur du versement', 'Selon l\'enquête (autre plateforme, OSINT…)'],
      ],
    },
    { type: 'heading', text: 'La réquisition' },
    {
      type: 'steps',
      items: [
        { title: 'Identifier la plateforme', md: `Par l'attribution du hot wallet, de la fabrique ou du portefeuille opérationnel. Une même fabrique ayant déployé des milliers de contrats au code identique, reversant tous vers le même hot wallet, est une démonstration solide.` },
        { title: 'Viser l\'adresse du contrat de dépôt', md: `C'est elle que la plateforme a attribuée au client et qu'elle relie à un compte. Ne citez **ni** le hot wallet, **ni** la fabrique, **ni** le portefeuille opérationnel comme adresse à identifier.` },
        { title: 'Préciser la chaîne', md: `Avec CREATE2, une même fabrique déployée à la même adresse sur plusieurs chaînes EVM peut produire la **même** adresse de dépôt sur chacune. Indiquez le réseau (Ethereum, Arbitrum, Base…) et, au besoin, son identifiant de chaîne.` },
        { title: 'Fournir les dépôts', md: `Pour chaque dépôt : hash de la transaction, date et heure UTC, actif et contrat du jeton, montant, adresse expéditrice. Ajoutez les hashes des reversements si vous les citez.` },
        { title: 'Demander', md: `Identité et éléments KYC du titulaire du compte rattaché au contrat de dépôt ; journaux de connexion (IP, appareils) ; autres adresses de dépôt attribuées au même client, sur toutes les chaînes ; historique des dépôts, retraits (avec adresses de destination) et conversions internes ; soldes et possibilité de gel.` },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Formulation recommandée',
      md: `« … identifier le titulaire du compte client auquel est attribuée l'adresse de dépôt **0xc5e8…41b7** (contrat de dépôt déployé par votre fabrique 0x2a6c…d0f3), réseau **Ethereum**, ayant reçu le 2 avril à 21:40 UTC **7 300 USDC** (transaction 0x…) et le 5 avril à 08:12 UTC **6,2 ETH** (transaction 0x…), en provenance de l'adresse 0x7d21…c8a0. » Joignez en annexe les transactions et la démonstration de l'attribution, et précisez que les reversements vers 0xf41a…9b27 relèvent de la gestion interne de la plateforme.`,
    },
    { type: 'heading', text: 'Les pièges' },
    {
      type: 'table',
      headers: ['Piège', 'Pourquoi c\'est faux', 'Bonne lecture'],
      rows: [
        ['« Le suspect a envoyé au hot wallet »', 'Le suspect a envoyé au contrat de dépôt ; le reversement est une opération interne de la plateforme', 'Le dépôt s\'arrête au contrat de dépôt : c\'est l\'adresse du client'],
        ['Prendre le portefeuille opérationnel pour le client', 'Il signe les reversements de tous les contrats de dépôt', 'Il identifie la plateforme ; le client est derrière le contrat de dépôt'],
        ['Requérir sur la fabrique', 'Elle déploie les contrats de tous les clients', 'Elle sert seulement à attribuer le modèle à la plateforme'],
        ['Conclure à un portefeuille personnel faute de code', 'Une adresse CREATE2 n\'a pas de code avant déploiement', 'Rechercher un déploiement ultérieur et la fabrique qui l\'a effectué'],
        ['Chercher le reversement d\'ETH dans les transactions du contrat', 'Il ne signe rien : le reversement est une transaction interne dans la transaction du déposant', 'Ouvrir le panneau « Transactions internes » de la transaction de dépôt'],
        ['Ignorer l\'événement ForwarderDeposited', 'Il confirme, émis par le contrat lui-même, l\'expéditeur et le montant du dépôt', 'Le citer à l\'appui du rattachement du dépôt'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — l\'affaire Norvex',
      md: `Chronologie établie à partir de l'inspecteur :

- **2 avril, 21:40 UTC** — \`0x7d21…c8a0\` → \`0xc5e8…41b7\` : **7 300 USDC** (\`transfer\` sur le contrat USDC). L'adresse destinataire n'a alors aucun code.
- **2 avril, 23:05 UTC** — \`0x0b9f…5e12\` appelle la fabrique \`0x2a6c…d0f3\` : \`createForwarder\`, parent = \`0xf41a…9b27\`. Contrat déployé : \`0xc5e8…41b7\`. Journal : Transfer de 7 300 USDC vers \`0xf41a…9b27\`.
- **5 avril, 08:12 UTC** — \`0x7d21…c8a0\` → \`0xc5e8…41b7\` : **6,2 ETH**, données d'entrée \`0x\`. Transaction interne : \`0xc5e8…41b7\` → \`0xf41a…9b27\`, 6,2 ETH. Journal : ForwarderDeposited (\`from\` = \`0x7d21…c8a0\`).
- **9 avril, 17:26 UTC** — \`0x0b9f…5e12\` appelle \`flushTokens\` sur \`0xc5e8…41b7\` : 2 000 USDC reçus la veille d'une autre victime sont reversés.

Le même portefeuille opérationnel a actionné **3 812** contrats de dépôt au code identique, tous déployés par \`0x2a6c…d0f3\` et reversant vers \`0xf41a…9b27\`, attribué à Norvex par plusieurs sources concordantes.

Rectification : la réquisition initiale, qui visait le hot wallet, est remplacée par une réquisition visant **l'adresse de dépôt 0xc5e8…41b7** sur Ethereum, avec les hashes des trois dépôts. Norvex identifie un compte ouvert sous une identité d'emprunt, mais fournit les adresses IP de connexion et deux adresses de retrait, qui relancent l'enquête.`,
    },
    {
      type: 'check',
      q: `Dans l'affaire Norvex, quelle adresse figure comme adresse à identifier dans la réquisition rectifiée ?`,
      options: [
        `0xf41a…9b27, le hot wallet, puisque c'est là que les fonds ont abouti`,
        `0x0b9f…5e12, qui a signé les reversements`,
        `0x2a6c…d0f3, la fabrique qui a déployé le contrat`,
        `0xc5e8…41b7, le contrat de dépôt attribué au client`,
      ],
      answer: 3,
      explain: `Seul le contrat de dépôt est propre au client. Hot wallet, fabrique et portefeuille opérationnel sont communs à tous les clients de la plateforme : ils servent à l'attribution, pas à l'identification.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : reconnaître un forwarder en trente secondes',
      md: `1. L'adresse est (ou devient) un **contrat**, souvent étiqueté « Forwarder » ou au code identique à des milliers d'autres.
2. Ses **sorties** sont des transactions internes ou des Transfer dans des transactions signées par **une autre adresse**.
3. Tout part vers **une seule** destination, rapidement, et le solde revient à zéro.
4. La transaction de **création** du contrat a été signée par une adresse qui en crée beaucoup d'autres, via une **fabrique**.
5. Conclusion : adresse de dépôt d'une plateforme ; réquisition sur **cette** adresse.`,
    },
  ],
  keyPoints: [
    `Beaucoup de plateformes attribuent comme adresse de dépôt un contrat forwarder, déployé par une fabrique : il reverse tout vers l'adresse parente (hot wallet).`,
    `CREATE2 : adresse = keccak256(0xff ‖ fabrique ‖ sel ‖ keccak256(code d'initialisation))[12:] ; elle est connue d'avance et peut recevoir des fonds avant le déploiement.`,
    `ETH : reversé dans la même transaction (transaction interne, événement ForwarderDeposited) ; jetons : reversés plus tard par flushTokens ou par la fabrique, sur ordre d'un portefeuille opérationnel.`,
    `Le contrat de dépôt ne signe jamais : ses sorties apparaissent dans des transactions d'autrui (internes ou événements Transfer).`,
    `Fabrique, portefeuille opérationnel et hot wallet identifient la plateforme ; seul le contrat de dépôt identifie le client.`,
    `La réquisition vise l'adresse du contrat de dépôt, sur une chaîne précisée, avec les hashes, dates, montants et actifs des dépôts.`,
  ],
  quiz: [
    {
      q: `Quels éléments entrent dans le calcul d'une adresse CREATE2 ?`,
      options: [
        `L'adresse du déployeur et son nonce`,
        `L'octet 0xff, l'adresse de la fabrique, le sel et le hash du code d'initialisation`,
        `L'adresse du client et la date d'ouverture de son compte`,
        `Le numéro du bloc de déploiement`,
      ],
      answer: 1,
      explain: `CREATE2 hache 0xff ‖ fabrique ‖ sel ‖ keccak256(init code) et garde les 20 derniers octets. Le nonce, propre à CREATE, n'intervient pas.`,
    },
    {
      kind: 'truefalse',
      q: `Des USDC envoyés à une adresse CREATE2 avant le déploiement de son contrat sont définitivement perdus.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Le solde est inscrit dans le registre du contrat USDC. Une fois le contrat de dépôt déployé à cette adresse, il peut les reverser : c'est précisément le fonctionnement des forwarders.`,
    },
    {
      q: `Un client dépose 3 ETH sur son contrat de dépôt déjà déployé. Où l'enquêteur voit-il le reversement vers le hot wallet ?`,
      options: [
        `Dans une transaction signée par le contrat de dépôt quelques heures plus tard`,
        `Dans le panneau « Transactions internes » de la transaction de dépôt elle-même`,
        `Dans un événement Transfer émis par le contrat WETH`,
        `Nulle part : il faut une réquisition`,
      ],
      answer: 1,
      explain: `Le contrat reverse l'ETH à sa réception, dans la même transaction : c'est une transaction interne, accompagnée de l'événement ForwarderDeposited.`,
    },
    {
      q: `Pourquoi les jetons ERC-20 ne sont-ils pas reversés automatiquement à leur arrivée sur un forwarder ?`,
      options: [
        `Parce que les jetons sont trop chers à transférer`,
        `Parce qu'un transfert ERC-20 modifie le registre du contrat du jeton sans exécuter de code chez le destinataire : le forwarder n'est pas prévenu`,
        `Parce que la loi impose un délai de conservation`,
        `Parce que les forwarders ne peuvent pas détenir de jetons`,
      ],
      answer: 1,
      explain: `Le standard ERC-20 n'appelle aucune fonction du destinataire. La plateforme doit donc déclencher le reversement (flushTokens ou appel à la fabrique) depuis un portefeuille opérationnel.`,
    },
    {
      kind: 'multi',
      q: `Quelles adresses identifient la plateforme et non le client ? (plusieurs réponses)`,
      options: [
        `La fabrique de contrats de dépôt`,
        `Le portefeuille opérationnel qui signe flushTokens`,
        `Le hot wallet, adresse parente des forwarders`,
        `Le contrat de dépôt attribué au client`,
      ],
      answer: [0, 1, 2],
      explain: `Fabrique, portefeuille opérationnel et hot wallet sont communs à tous les clients. Seul le contrat de dépôt est propre à un client.`,
    },
    {
      q: `Dans un journal ForwarderDeposited émis par un contrat de dépôt, que désigne le paramètre from ?`,
      options: [
        `Le hot wallet de la plateforme`,
        `Le déposant, c'est-à-dire l'adresse qui a envoyé l'ETH`,
        `La fabrique`,
        `L'adresse nulle`,
      ],
      answer: 1,
      explain: `L'événement est émis par le contrat de dépôt à la réception de l'ETH : from est l'expéditeur, value le montant. C'est une confirmation du dépôt par le contrat lui-même.`,
    },
    {
      kind: 'truefalse',
      q: `Une même adresse de dépôt CREATE2 peut exister sur plusieurs chaînes EVM : la réquisition doit préciser le réseau.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Si la fabrique est déployée à la même adresse sur plusieurs chaînes, avec le même sel et le même code, l'adresse calculée est identique. Préciser la chaîne évite toute ambiguïté.`,
    },
    {
      q: `Une adresse a reçu des jetons de nombreux expéditeurs, n'a jamais signé de transaction, et ses soldes partent vers le hot wallet d'un exchange dans des transactions signées par une même adresse de l'exchange. Quelle hypothèse privilégier ?`,
      options: [
        `Un portefeuille personnel abandonné`,
        `Un contrat de dépôt (forwarder) de l'exchange, actionné par son portefeuille opérationnel`,
        `Un pool de liquidité`,
        `Un mixeur`,
      ],
      answer: 1,
      explain: `Réception de multiples expéditeurs, reversement intégral vers un hot wallet, transactions signées par un tiers de la plateforme : c'est le schéma forwarder. Vérifiez le déploiement par une fabrique et le comportement des adresses sœurs.`,
    },
    {
      kind: 'multi',
      q: `Que faut-il faire figurer dans une réquisition visant un contrat de dépôt ? (plusieurs réponses)`,
      options: [
        `L'adresse du contrat de dépôt et la chaîne`,
        `Les hashes, dates et heures UTC, actifs et montants des dépôts`,
        `L'adresse du hot wallet comme adresse à identifier`,
        `La demande des autres adresses de dépôt du même client et des retraits`,
      ],
      answer: [0, 1, 3],
      explain: `Le hot wallet peut être mentionné pour l'attribution, mais pas comme adresse à identifier : il ne désigne aucun client.`,
    },
  ],
  flashcards: [
    { front: 'Forwarder', back: `Contrat de dépôt attribué à un client : reverse ce qu'il reçoit vers l'adresse parente (hot wallet) de la plateforme.` },
    { front: 'Formule CREATE2', back: `keccak256(0xff ‖ fabrique ‖ sel ‖ keccak256(init code))[12:] — adresse connue avant déploiement.` },
    { front: 'CREATE (classique)', back: `Adresse = keccak256(rlp([déployeur, nonce]))[12:] : dépend de l'ordre des déploiements.` },
    { front: 'Dépôt d\'ETH sur un forwarder', back: `Reversé dans la même transaction : transaction interne + événement ForwarderDeposited.` },
    { front: 'Dépôt de jetons sur un forwarder', back: `Reste sur le contrat jusqu'à flushTokens (0x3ef13367) ou au premier reversement via la fabrique.` },
    { front: 'Portefeuille opérationnel', back: `Signe les reversements et paie le gas pour tous les contrats de dépôt : identifie la plateforme, pas le client.` },
    { front: 'Fabrique (factory)', back: `Déploie les contrats de dépôt (souvent clones EIP-1167 via CREATE2). Infrastructure de la plateforme.` },
    { front: 'Adresse à requérir', back: `Le contrat de dépôt, sur une chaîne précisée — jamais le hot wallet, la fabrique ou le portefeuille opérationnel.` },
    { front: 'Adresse sans code', back: `Peut être une adresse CREATE2 pas encore déployée : vérifier un déploiement ultérieur.` },
    { front: 'ForwarderDeposited', back: `Événement sans paramètre indexé (topic0 seul) ; data : from (déposant), value, data.` },
  ],
}
