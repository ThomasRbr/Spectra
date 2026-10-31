// Niveau 2 — Smart contracts : transactions internes et journaux d'événements.
// Acteurs réels (Etherscan, Circle, WETH) décrits factuellement ; la plateforme,
// les victimes et les adresses des cas sont FICTIVES.
import type { Lesson } from '../model'

export const LESSON_INTERNES: Lesson = {
  id: 'transactions-internes',
  title: 'Transactions internes et journaux d\'événements',
  level: 2,
  track: 'contrats',
  minutes: 35,
  summary: `Une transaction EVM peut déplacer de la valeur de trois façons qui ne s'affichent pas au même endroit : la valeur envoyée par le signataire, les transactions internes (ETH déplacé par un contrat) et les événements Transfer des jetons. Pourquoi un bénéficiaire « ne voit pas » la transaction sur l'explorateur, comment lire les créations et destructions de jetons depuis l'adresse nulle, ce que laisse une transaction échouée, comment Spectra reconstitue chaque jambe, et les pièges qui faussent un montant ou font perdre une piste.`,
  objectives: [
    `Distinguer, pour une transaction EVM, la valeur de la transaction, les transactions internes et les transferts de jetons signalés par des événements.`,
    `Expliquer pourquoi le bénéficiaire d'une transaction interne n'apparaît pas dans la liste « normale » des transactions de son adresse, et où le retrouver.`,
    `Lire un événement Transfer (contrat émetteur, topics, data) et reconnaître une création (mint) ou une destruction (burn) de jetons.`,
    `Identifier une transaction échouée et en tirer les bonnes conclusions : frais payés, aucun transfert, aucun événement.`,
    `Reconstituer toutes les jambes d'une transaction avec les panneaux de l'inspecteur de Spectra, sans compter deux fois ni oublier une jambe.`,
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'dex-defi'],
  practice: ['splitter-internes', 'depot-contrat'],
  blocks: [
    {
      type: 'text',
      md: `Une infirmière de Nantes a versé **18 ETH** à la plateforme « NovaYield », qui promettait un rendement garanti sur un « coffre automatisé ». L'adresse de paiement, \`0x4f2c…a913\`, est un **contrat**. L'enquêtrice saisie du dossier ouvre l'adresse sur un explorateur : une seule transaction entrante, celle de la victime, et un solde nul. Les 18 ETH semblent s'être volatilisés.

Ils ne se sont pas volatilisés. Dans **la même transaction**, le contrat a immédiatement reversé **12,6 ETH** à une première adresse et **5,4 ETH** à une seconde. Ces deux mouvements ne figurent pas dans la liste des transactions des bénéficiaires, n'émettent aucun événement et n'apparaissent que dans un onglet que beaucoup d'enquêteurs n'ouvrent jamais : celui des **transactions internes**.

Sur une chaîne EVM, une transaction n'est pas un simple virement d'un compte vers un autre : c'est l'**exécution d'un programme**, qui peut déplacer de la valeur à plusieurs reprises et de plusieurs manières. Savoir où chaque mouvement est consigné est la condition d'un traçage complet.`,
    },
    { type: 'heading', text: 'Trois façons de déplacer de la valeur dans une transaction' },
    {
      type: 'terms',
      items: [
        { term: 'Valeur de la transaction', def: `Montant d'actif natif (ETH, BNB, MATIC…) que le signataire joint à sa transaction, champ \`value\`. C'est la seule jambe signée directement par un compte externe (EOA).` },
        { term: 'Transaction interne', def: `Mouvement d'actif natif effectué par un **contrat** pendant l'exécution (appel CALL avec une valeur). Il n'est pas signé, ne possède pas de hash propre et n'émet aucun événement par défaut.` },
        { term: 'Transfert de jeton', def: `Modification des soldes tenus dans le stockage d'un contrat de jeton (ERC-20, ERC-721…). Il est signalé par l'événement \`Transfer\`, émis par le contrat du jeton.` },
        { term: 'Journal d\'événements (log)', def: `Enregistrement émis par un contrat et conservé dans le reçu de la transaction : adresse émettrice, topics (signature et paramètres indexés), champ data.` },
        { term: 'Trace', def: `Reconstitution complète de l'exécution (appels entre contrats, valeurs, échecs), obtenue en rejouant la transaction sur un nœud doté des fonctions de traçage.` },
        { term: 'Adresse nulle', def: `\`0x0000000000000000000000000000000000000000\`. Origine conventionnelle des jetons créés (mint) et destination des jetons détruits (burn). Personne n'en détient la clé.` },
        { term: 'Revert', def: `Échec de l'exécution : tous les effets sont annulés, la transaction reste dans le bloc et les frais du gas consommé sont payés.` },
      ],
    },
    {
      type: 'table',
      caption: `Où lire chaque jambe : sur un explorateur de type Etherscan, et dans l'inspecteur de Spectra.`,
      headers: ['Jambe', 'Qui la déclenche', 'Événement émis ?', 'Explorateur (Etherscan)', 'Inspecteur Spectra'],
      rows: [
        ['Valeur de la transaction', 'Le signataire (EOA)', 'Non', 'Champ « Value » ; liste « Transactions » de l\'expéditeur et du destinataire direct', 'Jambe « Valeur de la transaction » ; montant affiché dans « Appel de contrat » (« envoyés avec l\'appel »)'],
        ['Transaction interne', 'Un contrat, pendant l\'exécution', 'Non (sauf événement prévu par le code)', 'Onglet « Internal Txns » de la transaction et des adresses concernées', 'Panneau « Transactions internes » ; jambe « Transaction interne »'],
        ['Transfert de jeton', 'Le contrat du jeton', 'Oui : `Transfer`', 'Section « ERC-20 Tokens Transferred » ; onglet « Token Transfers » des adresses', 'Panneau « Journaux d\'événements » ; jambe « Transfert de jeton (événement) »'],
        ['Création (mint)', 'Le contrat du jeton', 'Oui : `Transfer` depuis l\'adresse nulle (ou événement propre, ex. `Deposit` du WETH)', 'Transfert « From Null Address »', 'Jambe « Création de jetons (mint) »'],
        ['Destruction (burn)', 'Le contrat du jeton', 'Oui : `Transfer` vers l\'adresse nulle (ou `Withdrawal` du WETH)', 'Transfert « To Null Address »', 'Jambe « Destruction de jetons (burn) »'],
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'Valeur de la transaction',
        md: `- Signée par un EOA : l'expéditeur est **responsable** de l'envoi.
- Une seule par transaction (champ \`value\`), éventuellement nulle.
- Visible dans la liste « normale » des deux parties directes (\`from\` et \`to\`).
- Si \`to\` est un contrat, l'ETH entre dans ce contrat : ce n'est pas encore une destination finale.`,
      },
      right: {
        title: 'Transaction interne',
        md: `- Décidée par le **code** d'un contrat, déclenchée par la transaction d'un tiers.
- Plusieurs possibles, à plusieurs profondeurs d'appel.
- Invisible dans la liste « normale » du bénéficiaire : onglet dédié uniquement.
- Reconstituée par le traçage : un fournisseur peut l'omettre ou la présenter différemment d'un autre.`,
      },
    },
    {
      type: 'flow',
      caption: `Affaire NovaYield : une seule transaction signée par la victime, trois jambes. Les deux reversements sont des transactions internes.`,
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: '0x91d3…07be' },
        { id: 'c', label: 'Contrat de partage', kind: 'contract', sub: '0x4f2c…a913' },
        { id: 'a', label: 'Bénéficiaire A', kind: 'suspect', sub: '0x6b70…c2d4 · 70 %' },
        { id: 'b', label: 'Bénéficiaire B', kind: 'suspect', sub: '0xe03a…19f5 · 30 %' },
      ],
      edges: [
        { from: 'v', to: 'c', label: '18 ETH · valeur de la transaction' },
        { from: 'c', to: 'a', label: '12,6 ETH · interne', dashed: true },
        { from: 'c', to: 'b', label: '5,4 ETH · interne', dashed: true },
      ],
    },
    {
      type: 'check',
      q: `Dans l'affaire NovaYield, l'enquêtrice ouvre l'adresse 0x6b70…c2d4 sur l'explorateur. Son onglet « Transactions » ne mentionne pas le paiement de la victime. Que faut-il en conclure ?`,
      options: [
        `Que 0x6b70…c2d4 n'a rien reçu de la victime`,
        `Que les 12,6 ETH lui sont parvenus par une transaction interne, visible dans l'onglet des transactions internes`,
        `Que la transaction a échoué`,
        `Que 0x6b70…c2d4 est une adresse de dépôt d'exchange`,
      ],
      answer: 1,
      explain: `La liste « Transactions » n'affiche que les transactions dont l'adresse est l'expéditeur ou le destinataire direct. Les 12,6 ETH ont été versés par le contrat pendant l'exécution : c'est une transaction interne, consignée dans l'onglet dédié de la transaction et de l'adresse bénéficiaire.`,
    },
    { type: 'heading', text: 'Pourquoi le bénéficiaire « ne voit pas » la transaction' },
    {
      type: 'text',
      md: `Une transaction Ethereum ne comporte qu'**un** expéditeur (\`from\`, le signataire) et **un** destinataire direct (\`to\`, souvent un contrat). Les explorateurs indexent la liste « Transactions » d'une adresse sur ces deux champs. Tout ce qui se passe **à l'intérieur** de l'exécution relève d'autres index :

- les **transactions internes** sont extraites des traces : elles apparaissent dans l'onglet « Internal Txns » (Etherscan) de la transaction et des adresses concernées ;
- les **transferts de jetons** sont extraits des événements \`Transfer\` : ils apparaissent dans l'onglet « Token Transfers (ERC-20) » ou « NFT Transfers » ;
- le champ \`to\` d'un transfert de jeton est le **contrat du jeton**, jamais le bénéficiaire : pour un \`transfer\` d'USDC, la transaction est adressée au contrat USDC et le bénéficiaire ne figure que dans les arguments et dans l'événement.

Conséquence pratique : une adresse qui ne reçoit **que** des transactions internes ou des jetons peut afficher une liste « Transactions » **vide** alors qu'elle a reçu des millions. Inversement, une adresse qui n'a jamais signé de transaction (nonce à 0) peut détenir des fonds considérables.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ouvrir systématiquement les trois onglets',
      md: `Pour chaque adresse examinée, consultez **Transactions**, **Internal Txns** et **Token Transfers** avant de conclure qu'une adresse « n'a rien reçu » ou « n'a rien envoyé ». Une adresse d'apparence vide dans le premier onglet est un signal d'alerte, pas une conclusion. La même règle vaut pour les exports : un export CSV de l'onglet « Transactions » seul est **incomplet**.`,
    },
    { type: 'heading', text: 'Les événements Transfer : la seule trace des jetons' },
    {
      type: 'text',
      md: `Un jeton ERC-20 n'est pas « envoyé » d'une adresse à l'autre comme l'ETH : son contrat tient un **registre des soldes** dans son stockage et le modifie. Le standard impose au contrat d'émettre, à chaque mouvement, l'événement \`Transfer(address indexed from, address indexed to, uint256 value)\`. C'est cet événement que les explorateurs et les outils d'analyse lisent pour reconstituer les flux de jetons.

La leçon « Lire un smart contract » détaille le décodage des topics ; retenez ici la structure, que vous retrouverez dans le panneau **Journaux d'événements** de l'inspecteur, en vue décodée ou brute :`,
    },
    {
      type: 'table',
      caption: `Un log Transfer brut : versement de 12 400 USDC sur Ethereum (adresses fictives sauf le contrat USDC).`,
      headers: ['Champ', 'Valeur', 'Lecture'],
      rows: [
        ['Émetteur (address)', '`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`', 'Contrat USDC de Circle : c\'est lui qui « parle »'],
        ['topic0', '`0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`', 'keccak256(« Transfer(address,address,uint256) »)'],
        ['topic1', '`0x000000000000000000000000` + `6b70…c2d4`', 'from : adresse paddée à 32 octets'],
        ['topic2', '`0x000000000000000000000000` + `5a18…e6f0`', 'to : adresse paddée à 32 octets'],
        ['data', '`0x…00000002e318fc00`', 'value = 0x2E318FC00 = 12 400 000 000 unités → 12 400 USDC (6 décimales)'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Le contrat émetteur fait foi',
      md: `N'importe quel contrat peut émettre un événement nommé \`Transfer\` avec n'importe quelles adresses : c'est le ressort des faux jetons et de l'empoisonnement d'adresse. Avant de compter un transfert, vérifiez que l'**émetteur** du log est bien le contrat officiel du jeton. Dans l'inspecteur, l'adresse affichée sous « émis par » porte l'étiquette du contrat lorsqu'il est connu.`,
    },
    { type: 'heading', text: 'Mint et burn : l\'adresse nulle' },
    {
      type: 'text',
      md: `Par convention, un contrat qui **crée** des jetons émet un \`Transfer\` dont l'expéditeur est l'**adresse nulle** ; un contrat qui en **détruit** émet un \`Transfer\` vers l'adresse nulle. Personne ne détient la clé de cette adresse : elle n'est ni une source ni une destination de fonds au sens de l'enquête, mais le signe d'une **émission** ou d'une **destruction**.

Situations courantes :

- **émission de stablecoin** : l'émetteur crée des jetons au profit d'un client institutionnel (par exemple un \`Transfer\` USDC depuis l'adresse nulle) ;
- **jetons de reçu** : un protocole de prêt crée des aTokens au profit d'un déposant, un DEX crée des parts de pool (jetons LP) au profit d'un fournisseur de liquidité ; ils sont détruits au retrait ;
- **enveloppe WETH** : le contrat WETH historique émet un événement \`Deposit\` (création) ou \`Withdrawal\` (destruction) plutôt qu'un \`Transfer\` depuis l'adresse nulle ; au retrait, l'ETH revient à l'utilisateur par **transaction interne**. Spectra présente ces jambes comme « Création de jetons (mint) » et « Destruction de jetons (burn) » ;
- **bridges** : jetons détruits sur la chaîne de départ et recréés sur la chaîne d'arrivée, ou verrouillés puis émis.

Attention : certains projets « brûlent » des jetons en les envoyant à une adresse ordinaire réputée inutilisable, comme \`0x000000000000000000000000000000000000dEaD\`. Techniquement, c'est un transfert, pas une destruction : les jetons restent comptés dans l'offre totale.`,
    },
    {
      type: 'check',
      q: `Une transaction de dépôt sur un protocole de prêt montre deux jambes : 25 ETH de l'utilisateur vers le pool, et 25 aWETH de l'adresse nulle vers l'utilisateur. Comment lire la seconde jambe ?`,
      options: [
        `L'adresse nulle a payé l'utilisateur : c'est une source à identifier`,
        `Des jetons de reçu ont été créés (mint) au profit de l'utilisateur : ils représentent sa créance sur le pool`,
        `C'est une transaction interne d'ETH`,
        `C'est une erreur d'affichage de l'explorateur`,
      ],
      answer: 1,
      explain: `Un Transfer depuis l'adresse nulle signale une création de jetons. Ici, les aWETH matérialisent la garantie déposée : ils seront détruits au retrait. L'adresse nulle n'est jamais une contrepartie.`,
    },
    { type: 'heading', text: 'La transaction échouée' },
    {
      type: 'text',
      md: `Une transaction peut figurer dans un bloc **et** échouer. Si l'exécution rencontre une condition non remplie (solde insuffisant, délai dépassé, glissement de prix trop fort, fonction réservée), le contrat **annule** (*revert*) : toutes les modifications d'état sont effacées.

Ce qui reste :

- la transaction, son hash, son bloc, son **nonce** (consommé : le compte ne pourra pas le réutiliser) ;
- les **frais** du gas consommé jusqu'à l'échec, payés par le signataire au producteur du bloc ;
- éventuellement un **message d'erreur** (*revert reason*), par exemple « Insufficient balance » ou « Transaction too old ».

Ce qui disparaît : **toute** jambe de valeur, interne ou de jeton, et **tous** les événements. Une transaction échouée ne déplace aucun fonds.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Transaction réussie',
        md: `- Statut : succès.
- Valeur, transactions internes et événements exécutés.
- Frais payés.
- À intégrer au flux.`,
      },
      right: {
        title: 'Transaction échouée (reverted)',
        md: `- Statut : échec, éventuellement avec message.
- **Aucune** jambe exécutée, **aucun** événement : l'inspecteur affiche « Journaux d'événements (0) ».
- Frais payés malgré tout, nonce consommé.
- À exclure du flux, mais à **mentionner** : elle révèle une intention, un horaire, une activité.`,
      },
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : « j\'ai payé deux fois »',
      md: `Une victime affirme avoir versé deux fois 4 000 USDT à un faux conseiller. L'explorateur montre bien deux transactions vers le contrat USDT, mais la première porte le statut **Fail** : son portefeuille avait proposé des frais trop bas ou un montant supérieur au solde. Le préjudice est de **4 000 USDT** et de deux frais de transaction, pas de 8 000 USDT. Relevez le statut de **chaque** transaction avant de chiffrer un préjudice ; à l'inverse, une tentative échouée d'un suspect (par exemple un retrait refusé par un contrat gelé) est un élément d'enquête à consigner.`,
    },
    {
      type: 'text',
      md: `Nuance avancée : un contrat peut aussi encapsuler un appel interne qui échoue **sans** faire échouer la transaction entière (mécanisme d'appel protégé). L'explorateur affiche alors une transaction réussie contenant une transaction interne marquée en erreur : cette jambe-là n'a pas eu lieu. Lisez le statut ligne par ligne dans l'onglet des transactions internes.`,
    },
    { type: 'heading', text: 'Comment Spectra reconstitue une transaction' },
    {
      type: 'steps',
      items: [
        { title: '1. Statut', md: `En tête de l'inspecteur, un bandeau « Échec (reverted) » signale une transaction échouée : rien d'autre ne compte dans le flux. Notez le **nonce** et le **gas** affichés juste en dessous : le nonce indique combien de transactions le compte avait déjà signées.` },
        { title: '2. Appel de contrat', md: `Fonction appelée, sélecteur, arguments décodés et montant natif « envoyé avec l'appel ». Un envoi d'ETH à un compte, ou à un contrat qui l'accepte sans fonction, n'a pas de données d'entrée (\`0x\`).` },
        { title: '3. Transactions internes', md: `Chaque ligne donne le contrat payeur, la profondeur d'appel (↳ CALL), le montant et le bénéficiaire. C'est ici que se trouvent les reversements d'un contrat de partage, l'ETH rendu par un routeur ou par l'enveloppe WETH, l'ETH reversé par un contrat de dépôt.` },
        { title: '4. Journaux d\'événements', md: `Chaque log, numéroté dans l'ordre d'émission, avec son contrat émetteur et ses paramètres (indexés ou non). Le bouton « brut » affiche les topics et le champ data tels qu'un nœud les renvoie.` },
        { title: '5. Nature de chaque jambe', md: `La liste des transferts qualifie chaque jambe : valeur de la transaction, transaction interne, transfert de jeton (événement), création (mint) ou destruction (burn). Le traceur ne suit que des jambes réelles et traite routeurs, pools et adresse nulle comme des points de passage, pas comme des destinations.` },
      ],
    },
    { type: 'widget', id: 'amm-swap', caption: `Un swap illustre les trois natures de jambes : jetons entrant et sortant du pool (événements), ETH éventuellement rendu par le routeur (transaction interne).` },
    { type: 'heading', text: 'Les pièges qui faussent un traçage' },
    {
      type: 'table',
      headers: ['Piège', 'Conséquence', 'Parade'],
      rows: [
        ['Oublier l\'onglet des transactions internes', 'Piste perdue : les bénéficiaires d\'un contrat restent invisibles', 'Ouvrir Transactions, Internal Txns et Token Transfers pour chaque adresse'],
        ['Compter deux fois une jambe routeur → pool', 'Montant gonflé : utilisateur → routeur puis routeur → pool sont les mêmes fonds', 'Raisonner sur l\'entrée initiale et la sortie finale ; le routeur ne garde rien'],
        ['Prendre le champ `to` pour le bénéficiaire', 'Le contrat du jeton ou le routeur désigné comme destinataire', 'Lire les arguments et les événements Transfer'],
        ['Intégrer une transaction échouée', 'Préjudice ou flux surévalué', 'Vérifier le statut de chaque transaction'],
        ['Compter un événement d\'un faux jeton', 'Fonds fictifs dans le flux', 'Contrôler l\'adresse du contrat émetteur'],
        ['Lire la valeur brute sans décimales', 'Erreur d\'un facteur 10⁶ à 10¹⁸', 'Appliquer les décimales on-chain du contrat (USDC : 6 ; WETH : 18)'],
        ['Traiter l\'adresse nulle comme une contrepartie', 'Fausse source ou fausse destination', 'Lire un mint ou un burn, et chercher la jambe correspondante (dépôt, retrait)'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — le coffre NovaYield',
      md: `Plainte du 3 février. La victime \`0x91d3…07be\` a envoyé **18 ETH** le 12 janvier à 09:41 UTC vers \`0x4f2c…a913\`, présenté comme le « coffre » de NovaYield.

Lecture de la transaction dans l'inspecteur :

- **Appel de contrat** : fonction absente de la base de signatures, sélecteur \`0xe4fc6b6d\` (qui correspond à \`distribute()\` dans les bases publiques), « + 18 ETH envoyés avec l'appel » ; contrat déployé le 28 décembre ;
- **Transactions internes (2)** : \`0x4f2c…a913\` → \`0x6b70…c2d4\` : **12,6 ETH** ; \`0x4f2c…a913\` → \`0xe03a…19f5\` : **5,4 ETH** ;
- **Journaux d'événements (0)** : le contrat n'émet rien ;
- statut : succès ; le contrat garde 0 ETH.

L'historique du contrat montre **214 paiements entrants** en un mois, tous répartis 70/30 entre les deux mêmes adresses. \`0x6b70…c2d4\` échange ensuite ses ETH contre de l'USDC sur un DEX ; 12 400 USDC partent vers une adresse qui reverse tout, en moins d'une heure, vers le hot wallet d'un exchange. \`0xe03a…19f5\` finance en gas le déployeur du contrat.

Actes : constater les transactions internes (export de l'onglet dédié et trace brute) ; dénombrer les 214 victimes potentielles à partir des paiements entrants ; requérir l'exchange sur l'adresse de dépôt de \`0x6b70…c2d4\` ; analyser le déployeur et son financement.`,
    },
    {
      type: 'check',
      q: `Dans ce cas, quel montant total la victime a-t-elle versé aux bénéficiaires, et par combien de transactions signées par elle ?`,
      options: [
        `36 ETH en trois transactions (18 + 12,6 + 5,4)`,
        `18 ETH en une seule transaction, répartie par le contrat en deux transactions internes`,
        `12,6 ETH en une transaction : les 5,4 ETH restants sont des frais`,
        `Rien : la transaction n'a émis aucun événement, elle a donc échoué`,
      ],
      answer: 1,
      explain: `La victime a signé une seule transaction de 18 ETH. Les 12,6 et 5,4 ETH sont la répartition de ces mêmes 18 ETH par le contrat : les additionner à la valeur reviendrait à compter deux fois. L'absence d'événement est normale pour de l'ETH déplacé par un contrat ; le statut, lui, indique un succès.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Conserver la preuve des transactions internes',
      md: `Les transactions internes n'existent pas comme objets autonomes sur la chaîne : elles sont **reconstituées** par traçage, et deux fournisseurs peuvent les présenter différemment. Pour une jambe interne déterminante, conservez, outre la transaction et le reçu bruts, la **trace** obtenue d'un nœud (méthodes \`debug_traceTransaction\` ou \`trace_transaction\` selon le client), en indiquant le nœud ou le service utilisé, la date et l'empreinte du fichier. Dans le rapport, qualifiez explicitement la jambe : « transaction interne : versement de 12,6 ETH par le contrat 0x4f2c…a913 au cours de la transaction 0x… ».`,
    },
  ],
  keyPoints: [
    `Une transaction EVM peut déplacer de la valeur de trois façons : valeur signée par l'EOA, transactions internes (ETH déplacé par un contrat), transferts de jetons signalés par l'événement Transfer.`,
    `Les transactions internes n'émettent aucun événement par défaut et n'apparaissent pas dans la liste « Transactions » du bénéficiaire : onglet dédié et traces uniquement.`,
    `Pour un transfert de jeton, le champ to de la transaction est le contrat du jeton : le bénéficiaire est dans les arguments et dans l'événement Transfer, dont il faut vérifier le contrat émetteur.`,
    `Un Transfer depuis ou vers l'adresse nulle signale une création (mint) ou une destruction (burn) : l'adresse nulle n'est jamais une contrepartie.`,
    `Une transaction échouée consomme son nonce et ses frais mais n'exécute aucune jambe et n'émet aucun événement : à exclure du flux, à mentionner dans l'analyse.`,
    `Ne pas compter deux fois une même valeur (routeur → pool, répartition d'un contrat) : raisonner sur l'entrée initiale et les sorties finales.`,
    `Conserver la trace brute d'une transaction interne déterminante, avec sa provenance et son empreinte.`,
  ],
  quiz: [
    {
      q: `Un contrat reçoit 10 ETH et en reverse aussitôt 10 à une adresse B, dans la même transaction. Où apparaît ce reversement sur un explorateur de type Etherscan ?`,
      options: [
        `Dans la liste « Transactions » de B`,
        `Dans l'onglet « Internal Txns » de la transaction et de B`,
        `Dans l'onglet « Token Transfers » de B`,
        `Nulle part : seuls les jetons laissent une trace`,
      ],
      answer: 1,
      explain: `Le reversement est décidé par le code du contrat : c'est une transaction interne, reconstituée par traçage et affichée dans l'onglet dédié. La liste « Transactions » de B ne contient que les transactions dont B est l'expéditeur ou le destinataire direct.`,
    },
    {
      kind: 'truefalse',
      q: `Un contrat qui envoie de l'ETH à une adresse émet automatiquement un événement Transfer.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `L'événement Transfer est propre aux jetons et émis par leur contrat. Un envoi d'ETH par un contrat n'émet aucun événement, sauf si le développeur en a prévu un (comme ForwarderDeposited dans certains contrats de dépôt). Il se lit dans les transactions internes.`,
    },
    {
      q: `Une victime envoie 3 000 USDC à un escroc. Que contient le champ « To » de sa transaction ?`,
      options: [
        `L'adresse de l'escroc`,
        `L'adresse du contrat USDC`,
        `L'adresse nulle`,
        `L'adresse du hot wallet de Circle`,
      ],
      answer: 1,
      explain: `Un transfert de jeton est un appel à la fonction transfer du contrat du jeton : la transaction est adressée au contrat. L'escroc figure dans l'argument to de l'appel et dans le topic2 de l'événement Transfer.`,
    },
    {
      kind: 'multi',
      q: `Quelles affirmations sur une transaction échouée (reverted) sont exactes ? (plusieurs réponses)`,
      options: [
        `Elle figure dans un bloc et possède un hash`,
        `Les frais du gas consommé sont payés par le signataire`,
        `Les transferts de jetons qu'elle annonçait ont eu lieu, mais sans événement`,
        `Son nonce est consommé`,
        `Elle n'émet aucun événement`,
      ],
      answer: [0, 1, 3, 4],
      explain: `Le revert annule tous les effets : aucun transfert, aucun événement. Mais la transaction est incluse, ses frais sont dus et le nonce du compte avance.`,
    },
    {
      q: `Un log Transfer a pour topic1 l'adresse 0x0000000000000000000000000000000000000000 et pour topic2 l'adresse d'un utilisateur. Que s'est-il passé ?`,
      options: [
        `L'utilisateur a reçu des fonds d'un portefeuille inconnu`,
        `Le contrat du jeton a créé (mint) des jetons au profit de l'utilisateur`,
        `L'utilisateur a détruit ses jetons`,
        `La transaction a échoué`,
      ],
      answer: 1,
      explain: `Le topic1 porte l'expéditeur (from). Un expéditeur nul signale par convention une création de jetons. Il faut alors chercher la contrepartie économique : dépôt dans un protocole, émission par un émetteur, arrivée d'un bridge…`,
    },
    {
      q: `Un utilisateur appelle un routeur de DEX : 5 000 USDT partent de son adresse vers le routeur, puis 5 000 USDT du routeur vers le pool, et le pool verse 1,8 WETH à l'utilisateur. Quel montant d'USDT a-t-il réellement cédé ?`,
      options: [`10 000 USDT`, `5 000 USDT`, `2 500 USDT`, `Impossible à dire`],
      answer: 1,
      explain: `Les deux jambes USDT portent les mêmes fonds : le routeur ne fait que les acheminer vers le pool. Les additionner double le montant. Raisonnez sur l'entrée initiale (5 000 USDT) et la sortie finale (1,8 WETH).`,
    },
    {
      kind: 'truefalse',
      q: `Une adresse dont la liste « Transactions » est vide et dont le nonce vaut 0 ne peut détenir aucun fonds.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Le nonce compte les transactions signées, la liste « Transactions » celles où l'adresse est partie directe. Une adresse peut recevoir des jetons (événements) et de l'ETH par transactions internes sans jamais apparaître dans cette liste ni signer quoi que ce soit.`,
    },
    {
      q: `Pourquoi l'enveloppe WETH historique est-elle un cas particulier pour la lecture des mints et burns ?`,
      options: [
        `Parce qu'elle n'émet aucun événement`,
        `Parce qu'elle signale les créations et destructions par les événements Deposit et Withdrawal, l'ETH étant rendu par transaction interne au retrait`,
        `Parce qu'elle détruit les jetons en les envoyant à 0x…dEaD`,
        `Parce qu'elle ne fonctionne que sur BSC`,
      ],
      answer: 1,
      explain: `Le contrat WETH émet Deposit à l'enveloppement et Withdrawal au désenveloppement, puis renvoie l'ETH par un appel avec valeur : une transaction interne. Spectra présente ces jambes comme mint et burn.`,
    },
    {
      kind: 'multi',
      q: `Pour démontrer dans une procédure qu'un contrat a reversé 12,6 ETH à un suspect par transaction interne, que conservez-vous ? (plusieurs réponses)`,
      options: [
        `La transaction et le reçu bruts`,
        `La trace de la transaction obtenue d'un nœud, avec le nom du nœud ou du service`,
        `L'empreinte et la date d'extraction des fichiers`,
        `Uniquement une capture de la liste « Transactions » du suspect`,
      ],
      answer: [0, 1, 2],
      explain: `La transaction interne est une reconstitution : la trace brute, sa provenance et son empreinte permettent à tout expert de rejouer la vérification. La liste « Transactions » du suspect ne montre justement pas ce versement.`,
    },
  ],
  flashcards: [
    { front: 'Valeur de la transaction', back: `ETH (ou actif natif) joint par le signataire, champ value. Une seule par transaction.` },
    { front: 'Transaction interne', back: `ETH déplacé par un contrat pendant l'exécution. Pas de signature, pas de hash propre, pas d'événement par défaut.` },
    { front: 'Où voir une transaction interne ?', back: `Onglet « Internal Txns » de l'explorateur ; panneau « Transactions internes » de l'inspecteur. Jamais dans la liste « Transactions » du bénéficiaire.` },
    { front: 'Transfert de jeton', back: `Modification du registre du contrat, signalée par l'événement Transfer émis par le contrat du jeton.` },
    { front: 'topic0 de Transfer(address,address,uint256)', back: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` },
    { front: 'Champ to d\'un transfert ERC-20', back: `Le contrat du jeton. Le bénéficiaire est dans les arguments et dans le topic2 de l'événement.` },
    { front: 'Transfer depuis l\'adresse nulle', back: `Création de jetons (mint) : émission, jetons de reçu, arrivée de bridge.` },
    { front: 'Transfer vers l\'adresse nulle', back: `Destruction de jetons (burn). À ne pas confondre avec un envoi à 0x…dEaD, qui reste un transfert.` },
    { front: 'Transaction échouée', back: `Frais payés, nonce consommé, aucune jambe exécutée, aucun événement. À exclure du flux, à mentionner.` },
    { front: 'Piège routeur → pool', back: `Utilisateur → routeur puis routeur → pool : mêmes fonds. Ne pas additionner.` },
    { front: 'Trace', back: `Reconstitution de l'exécution par un nœud (debug_traceTransaction, trace_transaction) : source des transactions internes.` },
  ],
}
