// Niveau 4 — Confidentialité : CoinJoin, pools de confidentialité, Monero.
import type { Lesson } from '../model'

const coinjoin: Lesson = {
  id: 'coinjoin',
  title: 'CoinJoin : reconnaître et analyser',
  level: 4,
  track: 'confidentialite',
  minutes: 35,
  summary:
    'Le CoinJoin réunit plusieurs utilisateurs dans une même transaction Bitcoin à sorties égales. Reconnaître les grandes familles (Whirlpool, Wasabi, JoinMarket), comprendre pourquoi la CIOH s\'effondre, repérer le PayJoin, puis exploiter les erreurs post-mix (rendu toxique, consolidations, destination commune, timing) pour reprendre la trace avec un niveau de confiance assumé.',
  objectives: [
    'Reconnaître une transaction CoinJoin et identifier sa famille (Tx0 et mix Whirlpool, Wasabi, JoinMarket).',
    'Expliquer pourquoi un CoinJoin et un PayJoin invalident l\'heuristique des entrées communes, et corriger un cluster contaminé.',
    'Identifier le rendu toxique et les erreurs post-mix qui permettent de rattacher des sorties à un participant.',
    'Conduire une analyse de CoinJoin méthodique et la rédiger en termes probabilistes défendables.',
  ],
  prerequisites: ['clustering', 'change-heuristics', 'mixeurs'],
  practice: ['coinjoin-demix'],
  blocks: [
    {
      type: 'text',
      md: `Vous suivez des bitcoins issus d'une extorsion. Saut après saut, la piste est nette… puis les fonds entrent dans une transaction de **247 entrées et 291 sorties**, dont des dizaines au montant strictement identique. Votre outil affiche « CoinJoin ». Faut-il s'arrêter là ?

Non. Le CoinJoin est un **obstacle sérieux mais pas un mur** : la cryptographie n'y est pour rien, la confidentialité repose entièrement sur la discipline de l'utilisateur **avant** et **après** le mélange. Et les utilisateurs pressés de dépenser leurs fonds font des erreurs. Cette leçon vous apprend à les voir, à les mesurer, et à ne pas en dire plus que ce qu'elles prouvent.`,
    },
    { type: 'heading', text: 'Principe : une transaction, plusieurs propriétaires' },
    {
      type: 'text',
      md: `Une transaction Bitcoin peut contenir des entrées signées par des personnes **différentes** : chaque signature ne couvre que l'entrée de son propriétaire, mais engage la transaction entière. Le CoinJoin exploite cette propriété :

1. plusieurs participants s'inscrivent auprès d'un **coordinateur** (zkSNACKs dans les exercices) ;
2. chacun annonce ses entrées et une adresse de sortie **neuve** ;
3. le coordinateur assemble une transaction où chaque participant reçoit une sortie d'un **montant identique** (la *dénomination*) ;
4. chacun vérifie que sa sortie est bien présente, puis signe ses propres entrées ;
5. la transaction est diffusée : vue de l'extérieur, chaque sortie égale peut appartenir à n'importe lequel des participants.

Différence fondamentale avec un mixeur centralisé : le CoinJoin est **non-custodial**. Le coordinateur ne détient jamais les fonds et ne peut pas les voler ; il n'existe donc **aucun registre de comptes** à réquisitionner chez lui, et selon les protocoles il ne connaît même pas le lien entrée → sortie (inscription des sorties sous une autre identité réseau, jetons aveugles ou accréditations anonymes).`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 'a', label: 'Participant A', kind: 'wallet', sub: '0,0731 BTC' },
        { id: 'b', label: 'Participant B', kind: 'wallet', sub: '0,0502 BTC' },
        { id: 'c', label: 'Participant C', kind: 'suspect', sub: '0,0502 BTC' },
        { id: 'coord', label: 'zkSNACKs', kind: 'service', sub: 'assemble, ne détient rien' },
        { id: 'tx', label: 'Transaction CoinJoin', kind: 'tx', sub: 'entrées de A, B, C…' },
        { id: 'o1', label: 'bc1q…7k2', kind: 'unknown', sub: '0,05 BTC' },
        { id: 'o2', label: 'bc1q…m9d', kind: 'unknown', sub: '0,05 BTC' },
        { id: 'o3', label: 'bc1q…x4p', kind: 'unknown', sub: '0,05 BTC' },
      ],
      edges: [
        { from: 'a', to: 'tx', label: 'signe son entrée' },
        { from: 'b', to: 'tx', label: 'signe son entrée' },
        { from: 'c', to: 'tx', label: 'signe son entrée' },
        { from: 'coord', to: 'tx', label: 'coordonne', dashed: true },
        { from: 'tx', to: 'o1', label: '1 chance sur 3', dashed: true },
        { from: 'tx', to: 'o2', label: '1 chance sur 3', dashed: true },
        { from: 'tx', to: 'o3', label: '1 chance sur 3', dashed: true },
      ],
      caption: 'Chaque sortie égale peut appartenir à n\'importe quel participant : les liens entrée → sortie ne sont plus que probabilistes.',
    },
    {
      type: 'terms',
      items: [
        { term: 'Coordinateur', def: 'Serveur qui organise les rondes de CoinJoin. Ne détient pas les fonds ; perçoit parfois des frais de coordination.' },
        { term: 'Dénomination', def: 'Montant standard des sorties égales (ex. 0,01 / 0,05 BTC chez Whirlpool ; ensemble de valeurs prédéfinies chez Wasabi 2).' },
        { term: 'Jeu d\'anonymat (anonset)', def: 'Nombre de sorties indiscernables parmi lesquelles se cache une sortie donnée. Il se cumule, imparfaitement, au fil des remix.' },
        { term: 'Tx0', def: 'Transaction préparatoire de Whirlpool : découpe l\'UTXO de l\'utilisateur en sorties « prémix », paie les frais de coordinateur et isole le rendu.' },
        { term: 'Prémix / postmix', def: 'Sorties prêtes à entrer dans un mix / sorties issues d\'au moins un mix.' },
        { term: 'Rendu toxique', def: 'Reliquat non mélangé (rendu de la Tx0, sorties non standard) qui reste directement rattaché aux entrées du participant.' },
        { term: 'Remix', def: 'Nouveau passage d\'une sortie postmix dans un mix, souvent gratuit, pour augmenter l\'anonset.' },
        { term: 'PayJoin (BIP78)', def: 'Paiement où le destinataire ajoute une de ses entrées : la transaction ressemble à un paiement ordinaire mais viole la CIOH.' },
      ],
    },
    { type: 'heading', text: 'Les grandes familles de CoinJoin' },
    {
      type: 'table',
      headers: ['Famille', 'Structure typique', 'Dénominations', 'Signature visuelle'],
      rows: [
        ['Whirlpool (Samourai, Sparrow)', 'Tx0 puis mix de 5 entrées / 5 sorties', 'Pools fixes : 0,001 / 0,01 / 0,05 / 0,5 BTC selon les époques', 'Mix 5×5 strictement égaux, sans rendu ; Tx0 avec sortie de frais et rendu'],
        ['Wasabi 1.x', 'Grande transaction, une dénomination de base et ses niveaux', 'Base proche de 0,1 BTC', 'Dizaines de sorties ~0,1 BTC, sorties de rendu non standard'],
        ['Wasabi 2.x (WabiSabi)', 'Très grandes transactions (souvent 100 à 400 entrées)', 'Ensemble prédéfini de valeurs (suites de puissances de 2 et de 3, valeurs de type 1-2-5…)', 'Nombreux groupes de sorties égales à des montants différents, presque pas de rendu'],
        ['JoinMarket', 'Un « taker » paie des « makers » pour rejoindre sa transaction', 'Montant choisi par le taker (souvent non rond)', '4 à 10 sorties égales + une sortie de rendu par participant'],
        ['PayJoin', 'Paiement à deux participants', 'Aucune', 'Indiscernable d\'un paiement ordinaire à 2 sorties'],
      ],
      caption: 'Les paramètres évoluent selon les versions : vérifiez toujours la structure réelle de la transaction plutôt que de vous fier à une grille.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Contexte : l\'écosystème bouge',
      md: `En 2024, les développeurs du portefeuille Samourai ont été interpellés aux États-Unis et le coordinateur Whirlpool a cessé de fonctionner ; la même année, l'opérateur du coordinateur historique de Wasabi a arrêté son service. Le protocole Wasabi reste toutefois utilisable avec d'autres coordinateurs, et JoinMarket n'a pas de coordinateur central.

Conséquence pour l'enquêteur : vous rencontrerez à la fois des CoinJoin **historiques** (fonds anciens) et des CoinJoin **récents** via des coordinateurs plus petits, dont l'anonset effectif est souvent bien plus faible. Datez toujours la transaction et documentez le protocole présumé.`,
    },
    { type: 'heading', text: 'Reconnaître un CoinJoin' },
    {
      type: 'steps',
      items: [
        { title: 'Compter les sorties égales', md: `Au moins quatre sorties au montant **strictement** identique (au satoshi près) issues d'entrées venant d'adresses distinctes : c'est le critère de base de SPECTRA (\`detectCoinjoin\` exige ≥ 4 sorties égales et ≥ 4 adresses d'entrée distinctes).` },
        { title: 'Rapprocher des dénominations connues', md: `0,05 BTC pile en 5×5 évoque Whirlpool ; une mosaïque de groupes égaux à des valeurs différentes évoque Wasabi 2 ; un montant égal non rond avec autant de sorties de rendu que de participants évoque JoinMarket.` },
        { title: 'Vérifier l\'homogénéité des scripts', md: `Les CoinJoin modernes utilisent quasi exclusivement des sorties **SegWit natives** (\`bc1q…\`) ou **Taproot** (\`bc1p…\`). Un mélange de types est inhabituel.` },
        { title: 'Remonter d\'un cran', md: `Les entrées d'un mix Whirlpool sont soit des sorties de **Tx0** (prémix), soit des sorties d'un **mix précédent** (remix). Identifier la Tx0 donne accès au rendu toxique.` },
        { title: 'Documenter', md: `Hash, horodatage, nombre d'entrées, nombre de sorties égales, dénomination, protocole présumé et raisons de cette présomption.` },
      ],
    },
    { type: 'widget', id: 'coinjoin-visualizer', caption: 'Manipulez un CoinJoin : sorties égales, rendu toxique, puis une erreur post-mix qui recrée le lien.' },
    {
      type: 'check',
      q: 'Une transaction compte 3 entrées et 2 sorties de 0,05 BTC exactement. Est-ce un CoinJoin ?',
      options: [
        'Oui, deux sorties égales suffisent',
        'Pas nécessairement : ce peut être un paiement avec un rendu fortuitement égal, ou un PayJoin ; les critères usuels ne sont pas réunis',
        'Non, un CoinJoin a toujours au moins 100 entrées',
        'Oui, car 0,05 BTC est une dénomination Whirlpool',
      ],
      answer: 1,
      explain: 'Deux sorties égales ne font pas un CoinJoin. Les critères de détection exigent plusieurs sorties égales et des entrées d\'origines distinctes ; à l\'inverse, un CoinJoin n\'a pas besoin de centaines d\'entrées (un mix Whirlpool en a 5).',
    },
    { type: 'heading', text: 'Whirlpool en détail : Tx0, prémix, mix, remix' },
    {
      type: 'flow',
      nodes: [
        { id: 'in', label: 'UTXO de l\'utilisateur', kind: 'suspect', sub: '1,0000 BTC' },
        { id: 'tx0', label: 'Tx0', kind: 'tx', sub: 'découpage' },
        { id: 'pre', label: '19 sorties prémix', kind: 'wallet', sub: '19 × 0,05015 BTC' },
        { id: 'fee', label: 'Frais zkSNACKs', kind: 'service', sub: '0,0025 BTC' },
        { id: 'tox', label: 'Rendu toxique', kind: 'wallet', sub: '0,04435 BTC' },
        { id: 'mix', label: 'Mix 5 × 5', kind: 'mixer', sub: 'avec 4 autres participants' },
        { id: 'post', label: 'Sorties postmix', kind: 'unknown', sub: '0,05 BTC chacune' },
      ],
      edges: [
        { from: 'in', to: 'tx0' },
        { from: 'tx0', to: 'pre', label: 'certain' },
        { from: 'tx0', to: 'fee', label: 'certain' },
        { from: 'tx0', to: 'tox', label: 'certain (non mélangé)' },
        { from: 'pre', to: 'mix', label: 'une prémix par mix' },
        { from: 'mix', to: 'post', label: 'anonset 5 par mix', dashed: true },
      ],
      caption: 'La Tx0 est une transaction ordinaire : tout ce qui en sort est rattaché à l\'utilisateur avec certitude. L\'incertitude ne commence qu\'au mix.',
    },
    {
      type: 'text',
      md: `Points essentiels de la mécanique Whirlpool :

- la **Tx0** n'est pas un CoinJoin : une seule personne la signe. Ses sorties prémix, la sortie de frais et le **rendu toxique** appartiennent toutes à l'utilisateur ;
- chaque sortie prémix vaut la dénomination **plus une petite provision** pour les frais de minage du mix ; la sortie postmix vaut exactement la dénomination ;
- un mix réunit des **nouveaux entrants** (qui paient les frais de minage) et des **remixeurs** (qui ne paient rien) : c'est ce qui permet des remix gratuits et fait croître l'anonset au fil du temps ;
- le mix n'a **aucune sortie de rendu** : 5 entrées, 5 sorties égales.

Les sorties postmix restent dans un compte dédié du portefeuille. L'utilisateur les dépense ensuite, et c'est là que tout se joue.`,
    },
    {
      type: 'case',
      title: 'Cas — La Tx0 du 12 février',
      md: `Le 12 février à 21:47 UTC, l'adresse \`bc1q8f3…w0d\`, alimentée par une rançon de 1,0 BTC, dépense son UTXO unique dans une transaction à 22 sorties :

- 19 sorties de **0,05015 BTC** vers 19 adresses neuves ;
- 1 sortie de **0,0025 BTC** vers une adresse étiquetée « zkSNACKs — frais » ;
- 1 sortie de **0,04435 BTC** vers une adresse neuve (montant atypique) ;
- frais de minage : 0,0003 BTC.

Contrôle arithmétique : 19 × 0,05015 = 0,95285 ; 0,95285 + 0,0025 + 0,04435 + 0,0003 = **1,0000 BTC**. La structure est celle d'une Tx0 vers le pool 0,05. La sortie de 0,04435 BTC est le **rendu toxique** : elle est rattachée au déposant avec la même certitude que n'importe quel rendu identifié, et doit être surveillée en priorité.`,
    },
    { type: 'heading', text: 'Les erreurs qui font tomber le mix' },
    {
      type: 'table',
      headers: ['Erreur de l\'utilisateur', 'Ce que l\'on observe', 'Effet sur l\'analyse'],
      rows: [
        ['Dépenser le rendu toxique avec des postmix', 'Une transaction a pour entrées le rendu de la Tx0 et des sorties postmix', 'Lien très fort : la CIOH réunit le reliquat certain et les postmix'],
        ['Consolider des postmix', 'N sorties postmix de même dénomination réunies en une seule transaction', 'Les postmix sont reliées entre elles ; si N × dénomination ≈ montant initial, le lien avec le déposant devient fort'],
        ['Destination commune', 'Plusieurs postmix envoyées séparément à la même adresse ou au même dépôt d\'exchange', 'Même effet que la consolidation, sans CIOH : lien par le destinataire'],
        ['Dépense immédiate', 'Sorties dépensées quelques minutes après le mix, quand les autres restent dormantes', 'Réduit l\'anonset effectif, renforce les autres indices'],
        ['Mélange avec un UTXO ancien', 'Une postmix dépensée avec une UTXO identifiée de l\'utilisateur', 'Lien direct par CIOH'],
        ['Montant de sortie révélateur', 'Paiement dont le montant total égale le dépôt initial moins les frais', 'Indice d\'appariement, faible seul'],
      ],
      caption: 'Ce sont les mêmes erreurs qui font tomber les pools de confidentialité Ethereum : le mélange ne protège que celui qui le prolonge par une discipline stricte.',
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Cluster contaminé : l\'erreur la plus grave',
      md: `Les entrées d'un CoinJoin appartiennent à **des personnes différentes**. Un outil qui appliquerait la CIOH à travers un CoinJoin fusionnerait les portefeuilles de dizaines d'inconnus dans le cluster de votre suspect — et toute réquisition fondée sur ce cluster viserait des innocents.

Réflexe systématique : quand un cluster grossit brutalement, recherchez la transaction qui l'a fait grossir. Si c'est un CoinJoin (ou un PayJoin suspecté), **scindez** le cluster et notez la correction dans votre rapport.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: "Dans l'espace d'enquête : l'analyse post-mix",
      md: "L'inspecteur d'un CoinJoin affiche une carte **Analyse post-mix**. Elle rapproche chaque apport de son rendu par le calcul (apport − dénomination − frais), retrouve le rendu toxique des Tx0, y compris en amont d'un remix, et liste les dépenses des sorties mixées. Une dépense qui réunit une sortie mixée et une adresse liée à un participant est signalée comme **rattachée**. Un regroupement de sorties mixées sans lien avec un participant est signalé comme faux positif possible : il prouve un propriétaire commun, pas son identité.",
    },
    { type: 'heading', text: 'PayJoin : quand la CIOH ment sans le dire' },
    {
      type: 'compare',
      left: {
        title: 'Paiement ordinaire',
        md: `Entrées : 0,30 + 0,25 BTC, toutes du **payeur**.

Sorties : 0,40 BTC au marchand, 0,1498 BTC de rendu.

La CIOH relie correctement les deux entrées au payeur ; le rendu est identifiable par les heuristiques classiques.`,
      },
      right: {
        title: 'PayJoin (BIP78)',
        md: `Entrées : 0,30 BTC du **payeur** + 0,25 BTC du **marchand**.

Sorties : 0,65 BTC au marchand (0,40 + ses 0,25), 0,1498 BTC de rendu au payeur.

La CIOH relie à tort le marchand au payeur, et le « paiement » apparent (0,65) ne correspond pas au montant réellement payé.`,
      },
    },
    {
      type: 'text',
      md: `Le PayJoin ne se signale par **rien** de visible : c'est précisément son intérêt. Il reste marginal en volume, mais il rappelle une vérité méthodologique : la CIOH est une **présomption**, jamais une preuve. Indices qui doivent faire douter : un cluster qui « absorbe » soudain un commerçant ou un service, une sortie de paiement supérieure à la plus grosse entrée du payeur supposé, un portefeuille connu pour supporter PayJoin (BTCPay Server, certains portefeuilles mobiles).`,
    },
    { type: 'heading', text: 'Méthode d\'analyse pas à pas' },
    {
      type: 'steps',
      items: [
        { title: '1. Point d\'entrée', md: `Identifier la transaction qui fait entrer les fonds de l'affaire : Tx0 (Whirlpool), entrée d'une grande transaction (Wasabi), participation JoinMarket. Noter montant, date, protocole.` },
        { title: '2. Inventaire certain', md: `Lister ce qui est rattaché **sans incertitude** : sorties prémix, rendu toxique, frais. Placer une surveillance sur chacune.` },
        { title: '3. Sorties attendues', md: `Estimer combien de sorties postmix le participant détient : montant ÷ dénomination, déduction faite des frais. Ici : 19.` },
        { title: '4. Dépenses post-mix', md: `Examiner les transactions qui dépensent des sorties de la même dénomination, après les mix concernés : consolidations, destinations communes, présence du rendu toxique, fenêtre temporelle.` },
        { title: '5. Quantifier', md: `Anonset de chaque mix, nombre de postmix consolidées, écart entre la somme consolidée et le montant initial, nombre de transactions candidates concurrentes sur la période.` },
        { title: '6. Rédiger', md: `Décrire les indices, leur indépendance, les explications alternatives et le niveau de confiance retenu. Jamais « les fonds sont » : « les éléments convergent vers ».` },
      ],
    },
    {
      type: 'case',
      title: 'Cas — Dix-huit sorties et un rendu',
      md: `Suite du cas de la Tx0 du 12 février. Le 15 février à 08:12 UTC, une transaction dépense **19 entrées** : 18 sorties postmix de 0,05 BTC exactement (issues de 31 mix Whirlpool différents, entre le 12 et le 15 février) et la sortie de **0,04435 BTC** — le rendu toxique de la Tx0. Une sortie unique de 0,94395 BTC part vers une adresse de dépôt attribuée à Huobex.

Analyse :

- la présence du rendu toxique parmi les entrées rattache cette transaction au déposant avec la même force que la CIOH ordinaire ;
- les 18 postmix sont, par la même CIOH, détenues par la même personne que le rendu ;
- 18 × 0,05 = 0,90 BTC, cohérent avec les 19 prémix attendues (une encore non dépensée) ;
- aucun autre élément ne contredit.

Conclusion rédigée : « La consolidation, au sein d'une même transaction, de 18 sorties postmix de 0,05 BTC et du rendu de la Tx0 du 12 février permet de rattacher **avec une confiance élevée** les 0,94395 BTC déposés chez Huobex au participant ayant initié cette Tx0. » La réquisition à Huobex devient prioritaire, avec le hash et l'adresse de dépôt.`,
    },
    { type: 'widget', id: 'cioh-cluster', caption: 'Observez comment une transaction CoinJoin ferait fusionner, à tort, des clusters sans rapport — puis isolez-la.' },
    {
      type: 'check',
      q: 'Dans le cas ci-dessus, quel élément donne le plus de force au rattachement ?',
      options: [
        'Le fait que les 18 sorties soient de 0,05 BTC',
        'La présence du rendu toxique de la Tx0 parmi les entrées de la consolidation',
        'Le dépôt chez Huobex',
        'Le nombre de mix traversés',
      ],
      answer: 1,
      explain: 'Le rendu toxique est rattaché au déposant avec certitude. Sa dépense conjointe avec les postmix transfère ce lien certain à toute la transaction, via la CIOH. Le montant égal seul ne rattache à personne.',
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : le portefeuille parle plus que la chaîne',
      md: `Lors d'une perquisition, un portefeuille de CoinJoin (Sparrow, Wasabi, anciennes installations Samourai) contient ce que la chaîne ne dira jamais : la **liste exacte des UTXO** du suspect, ses comptes « prémix / postmix », ses **étiquettes**, l'historique des rondes. Une clé publique étendue (xpub/zpub) exportée permet de dériver toutes les adresses du portefeuille et de lever l'incertitude a posteriori.

Saisissez et fixez ces éléments (captures, export horodaté, hash des fichiers) : ils transforment des liens probabilistes en liens établis.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Rédaction et loyauté de la preuve',
      md: `L'usage d'un CoinJoin n'est pas en soi une infraction, et des personnes parfaitement honnêtes l'utilisent pour protéger leur vie privée. Dans un rapport, évitez de présenter le recours au CoinJoin comme une preuve de culpabilité : décrivez-le comme un **élément de contexte** (volonté de rompre la traçabilité) dont l'appréciation revient au magistrat.

Les liens établis à travers un CoinJoin sont **probabilistes** : exposez la méthode, les indices, les hypothèses alternatives et le niveau de confiance, de façon qu'un tiers puisse refaire l'analyse.`,
    },
  ],
  keyPoints: [
    'CoinJoin : transaction collaborative non-custodiale à sorties égales ; le coordinateur ne détient ni fonds ni comptes.',
    'Un CoinJoin, et plus discrètement un PayJoin, invalident la CIOH : scinder tout cluster qui les traverse.',
    'Whirlpool : la Tx0 est une transaction ordinaire ; ses prémix et son rendu toxique sont rattachés avec certitude.',
    'Le rendu toxique, les consolidations post-mix, la destination commune et le timing permettent de reprendre la trace.',
    'Quantifier : anonset, nombre de postmix consolidées, écart avec le montant initial, candidats concurrents.',
    'Les conclusions sont probabilistes : niveau de confiance explicite, hypothèses alternatives, méthode reproductible.',
    'Le portefeuille saisi (UTXO, étiquettes, xpub) peut lever l\'incertitude que la chaîne laisse.',
  ],
  quiz: [
    {
      q: 'Quelle caractéristique distingue fondamentalement le CoinJoin d\'un mixeur centralisé ?',
      options: [
        'Le CoinJoin ne fonctionne qu\'avec Monero',
        'Le CoinJoin est custodial : le coordinateur conserve les fonds pendant le mélange',
        'Le CoinJoin est non-custodial : chaque participant signe ses propres entrées et le coordinateur ne détient jamais les fonds',
        'Le CoinJoin supprime les adresses de la blockchain',
      ],
      answer: 2,
      explain: 'Les participants co-signent une transaction commune ; le coordinateur assemble mais ne détient rien. Il n\'y a donc pas de comptes clients à réquisitionner comme chez un mixeur custodial.',
    },
    {
      q: 'Dans une Tx0 Whirlpool, quelles sorties sont rattachées à l\'utilisateur avec certitude ?',
      kind: 'multi',
      options: ['Les sorties prémix', 'Le rendu toxique', 'Les sorties postmix du mix suivant', 'La sortie de frais du coordinateur (payée par l\'utilisateur)'],
      answer: [0, 1, 3],
      explain: 'La Tx0 est signée par une seule personne : toutes ses sorties procèdent de l\'utilisateur (la sortie de frais est payée par lui, mais reçue par le coordinateur). Les postmix, elles, sont indiscernables parmi celles des autres participants du mix.',
    },
    {
      q: 'Un utilisateur consolide 20 sorties postmix de 0,01 BTC vers une seule adresse. Quel est l\'effet ?',
      options: [
        'La CIOH relie ces sorties entre elles, et leur somme (0,2 BTC) peut être rapprochée de son dépôt initial',
        'Aucun : les sorties postmix sont définitivement anonymes',
        'Les fonds sont automatiquement remixés',
        'Les fonds sont gelés par le coordinateur',
      ],
      answer: 0,
      explain: 'La consolidation annule une grande partie du bénéfice du mélange : elle relie les sorties entre elles et la somme peut correspondre à un dépôt identifié.',
    },
    {
      q: 'Un mix Whirlpool a 5 sorties de 0,05 BTC. Avant toute analyse comportementale, quel est l\'anonset de chacune pour ce seul mix ?',
      options: ['1', '5', '50', 'Il est infini'],
      answer: 1,
      explain: 'Chaque sortie peut appartenir à l\'un des 5 participants. Les remix et les comportements post-mix peuvent ensuite l\'augmenter ou le réduire.',
    },
    {
      q: 'Un PayJoin (BIP78) peut faire entrer à tort le destinataire d\'un paiement dans le cluster du payeur.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: 'Vrai. Le destinataire apporte une entrée, que la CIOH rattache à tort au payeur. Le PayJoin ressemble à un paiement ordinaire à deux sorties ; son intérêt est justement d\'être indiscernable, tout en faisant mentir la CIOH puisque le destinataire apporte une entrée.',
    },
    {
      q: 'Votre outil a fusionné le cluster du suspect avec 140 adresses inconnues lors d\'une transaction de 180 entrées et 210 sorties, dont 90 de 0,1 BTC. Que faites-vous ?',
      options: [
        'Je réquisitionne les exchanges liés aux 140 adresses',
        'Je conserve le cluster : la CIOH est fiable',
        'Je scinde le cluster au niveau de cette transaction, que je qualifie de CoinJoin probable, et je documente la correction',
        'J\'abandonne la piste',
      ],
      answer: 2,
      explain: 'La CIOH ne s\'applique pas à un CoinJoin. Réquisitionner sur la base d\'un cluster contaminé viserait des tiers sans lien avec l\'affaire.',
    },
    {
      q: 'Quels indices renforcent le rattachement de sorties postmix à un participant ?',
      kind: 'multi',
      options: [
        'Dépense conjointe avec le rendu toxique de sa Tx0',
        'Envoi de plusieurs postmix vers le même dépôt d\'exchange',
        'Utilisation d\'adresses SegWit natives',
        'Somme des postmix consolidées cohérente avec le montant initial',
      ],
      answer: [0, 1, 3],
      explain: 'Le type d\'adresse est commun à presque tous les participants d\'un CoinJoin moderne : il ne discrimine rien. Les trois autres éléments sont des erreurs post-mix classiques.',
    },
  ],
  flashcards: [
    { front: 'CoinJoin', back: 'Transaction Bitcoin collaborative, non-custodiale, où plusieurs participants reçoivent des sorties de montant identique.' },
    { front: 'Tx0', back: 'Transaction préparatoire Whirlpool : prémix + frais de coordinateur + rendu toxique. Signée par une seule personne : tout y est rattaché.' },
    { front: 'Rendu toxique', back: 'Reliquat non mélangé, directement lié aux entrées du participant. Sa dépense avec des postmix annule le mélange.' },
    { front: 'Anonset', back: 'Nombre de sorties indiscernables parmi lesquelles une sortie se cache. Réduit par le timing et les erreurs post-mix.' },
    { front: 'Structure d\'un mix Whirlpool', back: '5 entrées, 5 sorties égales, aucun rendu. Les nouveaux entrants paient le minage, les remixeurs rien.' },
    { front: 'Wasabi 2 (WabiSabi)', back: 'Très grandes transactions, plusieurs groupes de sorties égales à des dénominations prédéfinies, très peu de rendu.' },
    { front: 'JoinMarket', back: 'Modèle maker/taker sans coordinateur central : un montant égal non rond et une sortie de rendu par participant.' },
    { front: 'PayJoin', back: 'Paiement où le destinataire apporte une entrée. Indiscernable, il fait mentir la CIOH et masque le vrai montant payé.' },
    { front: 'Première vérification quand un cluster explose', back: 'Chercher la transaction qui l\'a fait grossir : si c\'est un CoinJoin, scinder le cluster.' },
    { front: 'Formule de conclusion type', back: '« Les éléments X, Y, Z permettent de rattacher avec une confiance [élevée/modérée] … » — jamais une certitude.' },
  ],
}

const privacyPools: Lesson = {
  id: 'privacy-pools',
  title: 'Pools de confidentialité (type Tornado)',
  level: 4,
  track: 'confidentialite',
  minutes: 35,
  summary:
    'Les pools non-custodiaux à preuves à divulgation nulle rompent tout lien cryptographique entre dépôt et retrait. Fonctionnement (dénominations, commitments, notes, relayeurs), lecture des événements on-chain, heuristiques de démixage et leurs faux positifs, variantes récentes, et valeur probatoire d\'une note saisie.',
  objectives: [
    'Expliquer le fonctionnement d\'un pool de type Tornado : dépôt, commitment, note, preuve zk, nullifier, relayeur.',
    'Lire un dépôt et un retrait on-chain : événements, transaction interne, relayeur, commission.',
    'Appliquer les heuristiques de démixage et estimer le jeu d\'anonymat effectif d\'un retrait.',
    'Identifier les faux positifs et formuler un résultat de démixage sans l\'ériger en certitude.',
  ],
  prerequisites: ['comptes-evm', 'tokens-erc20', 'mixeurs', 'coinjoin'],
  practice: ['defi-exploit'],
  blocks: [
    {
      type: 'text',
      md: `Après un piratage, l'attaquant envoie 1 200 ETH dans un contrat. Quelques jours plus tard, des dizaines d'adresses neuves reçoivent des montants ronds de ce même contrat. Entre les deux : **aucun lien technique**, par construction. Le pool de confidentialité est l'outil d'anonymisation le plus robuste de l'écosystème EVM — et pourtant, une part significative de ses utilisateurs se trahit.

Cette leçon décrit la mécanique d'un pool de type Tornado (**Tornado Cash** dans les exercices), ce qu'elle laisse sur la chaîne, et la manière rigoureuse de démixer.`,
    },
    { type: 'heading', text: 'La mécanique : déposer un secret, retirer une preuve' },
    {
      type: 'steps',
      items: [
        { title: 'Dépôt', md: `Le logiciel de l'utilisateur tire deux nombres aléatoires, un **secret** et un **nullifier**, et calcule leur empreinte : le **commitment**. Il envoie au contrat le montant **fixe** du pool (0,1 / 1 / 10 / 100 ETH : un contrat par dénomination) accompagné du commitment, qui est ajouté comme feuille d'un **arbre de Merkle**. L'utilisateur conserve une **note** contenant secret et nullifier.` },
        { title: 'Attente', md: `D'autres utilisateurs déposent. Plus il y a de dépôts dans l'arbre, plus le futur retrait se noie dans la masse.` },
        { title: 'Retrait', md: `Depuis n'importe quelle adresse, l'utilisateur produit une **preuve à divulgation nulle** (zk-SNARK) : « je connais le secret de l'une des feuilles de l'arbre », sans dire laquelle. Il publie le **hash du nullifier**, que le contrat enregistre pour interdire un second retrait de la même note.` },
        { title: 'Relayeur', md: `Une adresse de retrait neuve n'a pas d'ETH pour le gaz. Un **relayeur** soumet la transaction à sa place et prélève une **commission** sur le montant retiré. Le \`from\` de la transaction est alors le relayeur ; le bénéficiaire est payé par **transaction interne**.` },
      ],
    },
    {
      type: 'flow',
      nodes: [
        { id: 'h', label: 'Adresse du hacker', kind: 'suspect', sub: '0x91ab…' },
        { id: 'pool', label: 'Tornado Cash 10 ETH', kind: 'mixer', sub: 'arbre de commitments' },
        { id: 'rel', label: 'Relayeur', kind: 'service', sub: 'paie le gaz, commission' },
        { id: 'w1', label: 'Adresse neuve', kind: 'unknown', sub: '0x3c7e…' },
        { id: 'w2', label: 'Adresse neuve', kind: 'unknown', sub: '0xa012…' },
      ],
      edges: [
        { from: 'h', to: 'pool', label: 'dépôt 10 ETH + commitment' },
        { from: 'rel', to: 'pool', label: 'soumet la preuve' },
        { from: 'pool', to: 'w1', label: '9,97 ETH (interne)', dashed: true },
        { from: 'pool', to: 'w2', label: '9,97 ETH (interne)', dashed: true },
      ],
      caption: 'Aucun lien cryptographique entre le dépôt et les retraits : tout rattachement repose sur le comportement.',
    },
    {
      type: 'terms',
      items: [
        { term: 'Commitment', def: 'Empreinte (hash) du secret et du nullifier, publiée au dépôt. Ne révèle rien du secret.' },
        { term: 'Note', def: 'Chaîne de caractères contenant secret et nullifier, conservée par l\'utilisateur. Elle permet de retirer : c\'est l\'équivalent d\'une clé privée.' },
        { term: 'Nullifier hash', def: 'Publié au retrait pour empêcher la double dépense d\'une note, sans révéler à quel dépôt elle correspond.' },
        { term: 'zk-SNARK', def: 'Preuve à divulgation nulle de connaissance : prouve qu\'on connaît un secret valide sans le révéler.' },
        { term: 'Relayeur', def: 'Tiers qui soumet la transaction de retrait et paie le gaz, contre une commission prélevée sur le montant.' },
        { term: 'Jeu d\'anonymat effectif', def: 'Nombre de dépôts du même pool qui peuvent plausiblement financer un retrait donné, compte tenu du timing et des comportements.' },
        { term: 'Ensemble d\'association', def: 'Dans les « Privacy Pools » récents : sous-ensemble de dépôts jugés licites auquel l\'utilisateur prouve appartenir.' },
      ],
    },
    { type: 'heading', text: 'Ce que l\'on voit sur la chaîne' },
    {
      type: 'table',
      headers: ['Élément', 'Dépôt', 'Retrait'],
      rows: [
        ['Émetteur (from)', 'L\'utilisateur', 'Le relayeur, ou l\'utilisateur s\'il paie lui-même le gaz'],
        ['Valeur de la transaction', 'Égale à la dénomination', 'Nulle (les fonds sortent du contrat)'],
        ['Événement', '`Deposit` : commitment, index de feuille, horodatage', '`Withdrawal` : bénéficiaire, nullifier hash, relayeur, commission'],
        ['Mouvement de fonds', 'Transfert direct vers le contrat', 'Transaction(s) interne(s) vers le bénéficiaire et le relayeur'],
        ['Fonction appelée', '`deposit(...)`', '`withdraw(...)` avec la preuve en paramètre'],
      ],
      caption: 'Sur l\'explorateur, le retrait se lit dans l\'onglet des transactions internes et dans les logs : la transaction principale ne montre que le relayeur appelant le contrat.',
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : ne pas confondre relayeur et suspect',
      md: `Le relayeur apparaît comme \`from\` de milliers de retraits pour le compte de milliers d'utilisateurs. Ce n'est **pas** le bénéficiaire, et le rattacher à votre affaire serait une erreur grossière. Le bénéficiaire se lit dans l'événement \`Withdrawal\` et dans les transactions internes.

À l'inverse, un retrait **sans relayeur** est intéressant : l'adresse de retrait détenait déjà de l'ETH pour payer le gaz. Qui l'a financée ?`,
    },
    { type: 'widget', id: 'privacy-pool', caption: 'Simulez des dépôts et des retraits : observez comment le timing et les montants rétrécissent le jeu d\'anonymat effectif.' },
    {
      type: 'check',
      q: 'Dans un retrait via relayeur, où lit-on l\'adresse qui a réellement reçu les fonds ?',
      options: [
        'Dans le champ from de la transaction',
        'Dans l\'événement Withdrawal et les transactions internes',
        'Dans l\'événement Deposit',
        'Elle n\'apparaît nulle part',
      ],
      answer: 1,
      explain: 'Le from est le relayeur. Le bénéficiaire figure dans les paramètres de l\'événement Withdrawal et reçoit les fonds par transaction interne.',
    },
    { type: 'heading', text: 'Les heuristiques de démixage' },
    {
      type: 'table',
      headers: ['Heuristique', 'Principe', 'Force', 'Faux positifs typiques'],
      rows: [
        ['Même adresse', 'Dépôt et retrait par la même adresse', 'Très forte', 'Quasi nuls'],
        ['Lien direct', 'Adresses de dépôt et de retrait en relation avant/après (transfert, financeur commun)', 'Forte', 'Financeur commun = exchange ou service partagé par des milliers d\'utilisateurs'],
        ['Financement du gaz', 'Retrait sans relayeur : l\'adresse de retrait a été alimentée par le déposant', 'Forte si source directe', 'Alimentation par un exchange (anodin)'],
        ['Paramètres de gaz singuliers', 'Prix ou plafonds de gaz atypiques identiques au dépôt et au retrait', 'Moyenne', 'Valeurs par défaut d\'un portefeuille répandu'],
        ['Timing', 'Retrait peu après le dépôt, avec très peu de dépôts intermédiaires', 'Moyenne à forte', 'Pools très actifs ; coïncidences sur les grosses dénominations'],
        ['Combinaison de dénominations', 'Dépôts et retraits reproduisant une combinaison rare (3 × 10 + 2 × 1 + 4 × 0,1)', 'Forte si combinaison rare', 'Combinaisons banales (1 × 1 ETH)'],
        ['Consolidation', 'Plusieurs adresses de retrait convergent vers une même adresse ou un même compte', 'Forte', 'Convergence vers un service (DEX, exchange) commun à tous'],
        ['Habitudes', 'Même relayeur, mêmes horaires, mêmes destinations après retrait', 'Faible seule', 'Relayeurs et horaires très partagés'],
      ],
    },
    {
      type: 'text',
      md: `Chaque heuristique isolée est **faible ou contestable** ; c'est leur **convergence** qui crée la conviction. Les travaux académiques publiés sur les pools Ethereum ont montré qu'une proportion non négligeable de dépôts et de retraits pouvait être appariée ainsi, surtout dans les pools peu actifs et pendant les périodes creuses.

Le paramètre clé est le **jeu d'anonymat effectif**. L'arbre peut contenir des dizaines de milliers de dépôts, mais si un retrait de 100 ETH survient 40 minutes après un dépôt de 100 ETH et que le pool n'a reçu que deux dépôts dans les dix jours précédents, le nombre de candidats **plausibles** est minuscule.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Les faux positifs existent, et ils coûtent cher',
      md: `Deux utilisateurs sans rapport peuvent déposer et retirer à des heures proches, passer par le même relayeur et finir sur le même exchange. Avant d'attribuer un retrait :

- vérifiez que la « destination commune » n'est pas un service de masse (routeur de DEX, hot wallet d'exchange, bridge) ;
- comptez les dépôts concurrents réellement possibles sur la fenêtre ;
- cherchez un élément **contraire** (activité de l'adresse de retrait incompatible avec le profil du déposant, fuseau horaire différent) ;
- n'additionnez pas des indices dépendants : « même relayeur » et « même horaire » proviennent souvent d'un même réglage par défaut.`,
    },
    {
      type: 'case',
      title: 'Cas guidé — L\'exploit Lendora',
      md: `Le 4 mars, entre 02:10 et 02:31 UTC, l'adresse \`0x91ab…e3\` (alimentée par l'exploit du protocole Lendora) dépose dans Tornado Cash : **3 × 10 ETH, 2 × 1 ETH, 4 × 0,1 ETH**, soit 32,4 ETH.

Le même jour, entre 06:02 et 06:40 UTC, **neuf retraits** via le même relayeur vers neuf adresses neuves : 3 × 10, 2 × 1 et 4 × 0,1 ETH, commissions déduites. Entre 02:31 et 06:40, le pool 10 ETH n'a reçu que **7 dépôts** et le pool 0,1 ETH **11 dépôts**.

Le 5 mars, les neuf adresses envoient leurs fonds vers \`0xe44f…07\`, qui dépose **32,05 ETH** chez Binance.

Raisonnement :

1. combinaison identique et peu commune (3 dénominations, 9 opérations) ;
2. délai de quatre heures, anonset effectif faible dans chaque pool ;
3. consolidation finale dont le total correspond au dépôt diminué des commissions ;
4. aucune autre combinaison de dépôts sur la fenêtre ne permet d'atteindre 32,4 ETH avec la même répartition.

Conclusion : **confiance élevée** que ces retraits proviennent des dépôts de \`0x91ab…e3\`. La réquisition à Binance (adresse de dépôt, hash) devient prioritaire, et la demande de gel urgente.`,
    },
    {
      type: 'flow',
      nodes: [
        { id: 'ex', label: 'Exploit Lendora', kind: 'contract' },
        { id: 'h', label: '0x91ab…e3', kind: 'suspect', sub: '32,4 ETH' },
        { id: 'pool', label: 'Tornado Cash', kind: 'mixer', sub: '9 dépôts' },
        { id: 'r', label: '9 adresses de retrait', kind: 'unknown', sub: '≈ 32,1 ETH' },
        { id: 'c', label: '0xe44f…07', kind: 'wallet', sub: 'consolidation' },
        { id: 'b', label: 'Binance', kind: 'exchange', sub: 'dépôt 32,05 ETH' },
      ],
      edges: [
        { from: 'ex', to: 'h', label: 'fonds volés' },
        { from: 'h', to: 'pool', label: '02:10–02:31' },
        { from: 'pool', to: 'r', label: 'combinaison + timing', dashed: true },
        { from: 'r', to: 'c', label: '5 mars' },
        { from: 'c', to: 'b', label: 'dépôt' },
      ],
      caption: 'Le seul lien probabiliste (pointillés) est encadré par des liens certains : c\'est sur lui que porte toute la discussion.',
    },
    {
      type: 'check',
      q: 'Les neuf adresses de retrait du cas avaient toutes, au contraire, envoyé leurs fonds vers le routeur d\'un DEX très utilisé. La consolidation reste-t-elle un indice fort ?',
      options: [
        'Oui, la destination est commune',
        'Non : un routeur de DEX reçoit des fonds de milliers d\'utilisateurs, la destination commune n\'est alors pas discriminante',
        'Oui, si les montants sont ronds',
        'Non, car les DEX sont illégaux',
      ],
      answer: 1,
      explain: 'Une destination n\'est discriminante que si elle est propre à un utilisateur (adresse personnelle, adresse de dépôt d\'exchange). Un routeur de DEX, un bridge ou un hot wallet sont partagés par tous.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: "Dans l'espace d'enquête : le démixage d'un pool",
      md: "Clic droit sur l'adresse qui a déposé ▸ *Démixer ses dépôts dans un pool*, ou bouton dans l'inspecteur d'un dépôt. L'outil liste ses dépôts, l'**ensemble d'anonymat** (dépôts de tiers aux mêmes dénominations sur la période) et les groupes de retraits. Un groupe est **rattaché** quand les retraits convergent vers un collecteur qui reçoit aussi le reliquat non mixé du déposant. Il est **écarté** si un retrait précède le premier dépôt, ou s'il compte plus de retraits que le suspect n'a fait de dépôts à cette dénomination. La fenêtre d'examen est réglable.",
    },
    { type: 'heading', text: 'Les variantes récentes' },
    {
      type: 'compare',
      left: {
        title: 'Pool à dénominations fixes (type Tornado)',
        md: `- Montants fixes, un contrat par dénomination.
- Anonymat = nombre de dépôts du pool.
- Aucune distinction entre fonds licites et illicites.
- Démixage par timing, combinaisons, consolidations.`,
      },
      right: {
        title: 'Soldes protégés et ensembles d\'association',
        md: `- Montants libres à l'intérieur d'un système protégé (transferts et swaps privés de type Railgun).
- « Privacy Pools » : l'utilisateur prouve que son dépôt appartient à un ensemble jugé licite, ce qui permet d'exclure des dépôts issus de hacks.
- Les entrées et sorties du système restent visibles : mêmes angles d'attaque aux frontières.`,
      },
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Statut juridique : vérifier à la date des actes',
      md: `Le service Tornado Cash a été sanctionné par le Trésor américain (OFAC) en 2022, puis retiré de la liste en 2025 à la suite d'une décision de justice américaine ; des développeurs ont été poursuivis aux Pays-Bas et aux États-Unis. Les listes de sanctions (OFAC, Union européenne) évoluent : vérifiez le statut exact de chaque service et de chaque adresse **à la date des faits et à la date de vos actes**, et citez la source consultée.

L'utilisation d'un pool n'est pas en soi une infraction en droit français ; c'est un élément de contexte qui peut contribuer, avec d'autres, à caractériser une intention de dissimulation.`,
    },
    { type: 'heading', text: 'Présenter un démixage' },
    {
      type: 'steps',
      items: [
        { title: 'Exposer la rupture', md: `« Le [date], 32,4 ETH ont été déposés dans le pool Tornado Cash depuis l'adresse… Aucun lien cryptographique ne relie les dépôts aux retraits. »` },
        { title: 'Lister les heuristiques', md: `Chaque indice, avec sa mesure : délai, nombre de dépôts concurrents, rareté de la combinaison, destination finale.` },
        { title: 'Discuter les alternatives', md: `Combien d'autres déposants auraient pu produire ces retraits ? Quels éléments contraires ont été recherchés ?` },
        { title: 'Conclure avec un niveau', md: `« Confiance élevée / modérée / faible », jamais « certain ». Distinguer ce qui est établi (dépôts, retraits, consolidation) de ce qui est inféré (l'appariement).` },
        { title: 'Chercher la corroboration', md: `Réponse de l'exchange (identité commune entre le titulaire et d'autres éléments du dossier), appareils saisis, OSINT : un élément indépendant vaut mieux qu'une heuristique de plus.` },
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'La note : preuve et clé',
      md: `Une **note** de dépôt retrouvée sur un support saisi (chaîne commençant typiquement par le nom du protocole, l'actif, le montant et l'identifiant du réseau, puis une longue valeur hexadécimale, par exemple \`tornado-eth-10-1-0x…\`) établit le lien entre un dépôt et son retrait — et, si la note n'a pas encore été utilisée, **permet de retirer les fonds**.

Traitez-la comme une clé privée : fixation, scellé, aucune manipulation hors d'un cadre procédural décidé avec le magistrat.`,
    },
  ],
  keyPoints: [
    'Dépôt à montant fixe avec commitment, retrait vers n\'importe quelle adresse avec une preuve zk : aucun lien cryptographique.',
    'Le relayeur paie le gaz et apparaît en from : le bénéficiaire se lit dans l\'événement Withdrawal et les transactions internes.',
    'Heuristiques : même adresse, lien direct, financement du gaz, paramètres de gaz, timing, combinaisons, consolidation, habitudes.',
    'Le jeu d\'anonymat effectif, pas la taille de l\'arbre, mesure la protection réelle d\'un retrait.',
    'Les faux positifs viennent des services de masse et des indices dépendants : les écarter explicitement.',
    'Une note saisie vaut preuve et accès aux fonds : la traiter comme une clé privée.',
    'Le statut de sanction des services évolue : le vérifier et le dater.',
  ],
  quiz: [
    {
      q: 'Dans un retrait via relayeur, qui apparaît comme from de la transaction ?',
      options: ['L\'adresse de dépôt', 'Le contrat du pool', 'Le bénéficiaire', 'Le relayeur'],
      answer: 3,
      explain: 'Le relayeur soumet la transaction et paie le gaz ; le bénéficiaire reçoit par transaction interne.',
    },
    {
      q: 'Une adresse dépose 2 × 10 + 3 × 1 + 1 × 0,1 ETH ; deux heures plus tard, des retraits reproduisent exactement cette combinaison, puis convergent vers une adresse personnelle. Quelles heuristiques jouent ?',
      kind: 'multi',
      options: ['Combinaison de dénominations', 'Timing', 'CIOH', 'Consolidation'],
      answer: [0, 1, 3],
      explain: 'La CIOH est une heuristique UTXO sans objet ici. Combinaison rare, délai court et consolidation finale convergent vers un lien probable.',
    },
    {
      q: 'Pourquoi un retrait sans relayeur peut-il être révélateur ?',
      options: [
        'Parce qu\'il révèle la note',
        'Parce que l\'adresse de retrait devait déjà détenir de l\'ETH pour le gaz : son financeur est une piste',
        'Parce qu\'il est gratuit',
        'Parce que le contrat publie alors l\'adresse de dépôt',
      ],
      answer: 1,
      explain: 'Le financement préalable de l\'adresse de retrait peut provenir de l\'adresse de dépôt, d\'une adresse liée ou d\'un exchange identifiable.',
    },
    {
      q: 'Le pool 100 ETH contient 8 000 dépôts dans son arbre. Un retrait de 100 ETH a donc toujours un anonymat de 8 000.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Seuls les dépôts antérieurs, non encore retirés et plausibles compte tenu du timing et des comportements comptent : le jeu d\'anonymat effectif peut se réduire à quelques unités.',
    },
    {
      q: 'Quels éléments sont des sources classiques de faux positifs en démixage ?',
      kind: 'multi',
      options: [
        'Une destination commune qui est un hot wallet d\'exchange',
        'Un même relayeur utilisé par des milliers d\'utilisateurs',
        'Le dépôt et le retrait effectués par la même adresse',
        'Des paramètres de gaz correspondant aux valeurs par défaut d\'un portefeuille répandu',
      ],
      answer: [0, 1, 3],
      explain: 'Le dépôt et le retrait par la même adresse est au contraire l\'indice le plus fort. Les trois autres éléments sont partagés par de nombreux utilisateurs.',
    },
    {
      q: 'Une note de dépôt non utilisée est retrouvée dans un téléphone saisi. Quelle est sa portée ?',
      options: [
        'Aucune, elle est chiffrée',
        'Elle donne l\'identité du relayeur',
        'Elle prouve le lien dépôt/retrait et permet de retirer les fonds encore dans le pool',
        'Elle permet de geler le contrat du pool',
      ],
      answer: 2,
      explain: 'La note contient le secret et le nullifier du dépôt : preuve du lien et moyen d\'accès aux fonds. Elle se traite comme une clé privée.',
    },
    {
      q: 'Où trouve-t-on, sur un explorateur, le montant effectivement versé au bénéficiaire d\'un retrait ?',
      options: [
        'Dans le champ value de la transaction principale',
        'Dans l\'onglet des transactions internes (et les paramètres de l\'événement Withdrawal)',
        'Dans l\'événement Deposit',
        'Dans le nonce du relayeur',
      ],
      answer: 1,
      explain: 'La transaction principale a une valeur nulle : les fonds sortent du contrat par des transferts internes vers le bénéficiaire et le relayeur.',
    },
  ],
  flashcards: [
    { front: 'Commitment', back: 'Hash du secret et du nullifier publié au dépôt, ajouté à l\'arbre de Merkle du pool.' },
    { front: 'Nullifier hash', back: 'Publié au retrait pour empêcher un second retrait de la même note, sans révéler le dépôt correspondant.' },
    { front: 'Relayeur', back: 'Soumet le retrait, paie le gaz, prélève une commission. Il est le from, pas le bénéficiaire.' },
    { front: 'Jeu d\'anonymat effectif', back: 'Dépôts plausibles pouvant financer un retrait, compte tenu du timing et des comportements.' },
    { front: 'Heuristique de combinaison', back: 'Dépôts et retraits reproduisant la même répartition rare de dénominations dans un délai court.' },
    { front: 'Retrait sans relayeur', back: 'L\'adresse de retrait avait de l\'ETH pour le gaz : remonter son financement.' },
    { front: 'Faux positif classique', back: 'Destination commune qui est un service de masse (DEX, bridge, hot wallet d\'exchange).' },
    { front: 'Note de dépôt', back: 'Secret permettant de retirer : preuve du lien et accès aux fonds. À traiter comme une clé privée.' },
    { front: 'Privacy Pools (ensembles d\'association)', back: 'Variante où l\'utilisateur prouve appartenir à un sous-ensemble de dépôts jugés licites.' },
    { front: 'Lire un retrait', back: 'Événement Withdrawal (bénéficiaire, relayeur, commission) + transactions internes.' },
  ],
}

const monero: Lesson = {
  id: 'monero',
  title: 'Monero et cryptos à confidentialité renforcée',
  level: 4,
  track: 'confidentialite',
  minutes: 35,
  summary:
    'Ce que Monero masque (émetteur, destinataire, montant) et comment ; ce qui reste visible ; pourquoi le traçage on-chain n\'est pas fiable ; et tous les angles d\'enquête qui demeurent : points d\'entrée et de sortie transparents, corrélation montant/temps, clés de vue et preuves de paiement, preuves sur les appareils. Zcash (transparent vs protégé), Litecoin MWEB et Dash en complément.',
  objectives: [
    'Expliquer les trois mécanismes de Monero (signatures de cercle, adresses furtives, RingCT) et ce qu\'ils cachent.',
    'Distinguer ce qui reste visible sur la chaîne Monero et évaluer de façon critique toute prétention de « traçage ».',
    'Construire une stratégie d\'enquête par les frontières : échangeurs, exchanges, corrélation montant/temps, preuves hors chaîne.',
    'Exploiter clés de vue, clés de transaction, fichiers de portefeuille et seeds découverts lors d\'une perquisition.',
    'Différencier adresses transparentes et protégées sur Zcash et repérer les transitions observables.',
  ],
  prerequisites: ['chain-hopping', 'mixeurs', 'osint'],
  practice: ['monero-wall'],
  blocks: [
    {
      type: 'text',
      md: `Les fonds d'un faux support technique ont été convertis en XMR via un échangeur instantané. Sur l'explorateur Monero, vous voyez des transactions… mais ni adresse, ni montant. Vous venez de heurter **le mur Monero**.

Bonne nouvelle : un mur a des bords. L'expérience des services d'enquête montre que les affaires impliquant Monero se résolvent rarement **dans** la chaîne Monero, mais très souvent **autour** : là où les fonds entrent, là où ils sortent, et sur les appareils de ceux qui les manipulent.`,
    },
    { type: 'heading', text: 'Trois mécanismes, actifs par défaut' },
    {
      type: 'table',
      headers: ['Mécanisme', 'Ce qu\'il cache', 'Comment'],
      rows: [
        ['Signatures de cercle', 'L\'émetteur (quelle sortie est dépensée)', 'Chaque entrée est signée au sein d\'un cercle de 16 sorties : la vraie et 15 leurres tirés de la chaîne. Une image de clé unique interdit la double dépense.'],
        ['Adresses furtives', 'Le destinataire', 'L\'adresse publique n\'apparaît jamais : chaque paiement crée une clé de sortie à usage unique que seul le destinataire sait reconnaître.'],
        ['RingCT', 'Les montants', 'Montants remplacés par des engagements cryptographiques, avec des preuves (Bulletproofs+) qu\'ils sont positifs et équilibrés.'],
        ['Dandelion++ (réseau)', 'L\'IP du nœud d\'origine', 'La transaction suit d\'abord un chemin aléatoire avant d\'être diffusée largement.'],
      ],
      caption: 'Contrairement à Zcash ou Litecoin, la confidentialité de Monero n\'est pas optionnelle : toutes les transactions en bénéficient.',
    },
    {
      type: 'terms',
      items: [
        { term: 'Image de clé (key image)', def: 'Valeur unique dérivée de la sortie dépensée, publiée pour interdire la double dépense sans révéler la sortie.' },
        { term: 'Leurre (decoy)', def: 'Sortie d\'un autre utilisateur incluse dans un cercle pour masquer la vraie sortie dépensée.' },
        { term: 'Sous-adresse', def: 'Adresse dérivée (commençant par 8 sur le réseau principal) permettant de recevoir sur plusieurs adresses sans les relier publiquement.' },
        { term: 'Clé de vue (view key)', def: 'Permet de détecter les paiements reçus par un portefeuille, sans pouvoir dépenser.' },
        { term: 'Clé de dépense (spend key)', def: 'Permet de dépenser. Avec la clé de vue, elle constitue le contrôle total du portefeuille.' },
        { term: 'Clé de transaction (tx key)', def: 'Secret propre à un paiement émis : permet à l\'émetteur de prouver qu\'il a payé tel montant à telle adresse.' },
        { term: 'FCMP++', def: 'Évolution annoncée remplaçant les cercles de 16 par des preuves d\'appartenance à l\'ensemble des sorties de la chaîne.' },
      ],
    },
    { type: 'heading', text: 'Ce que l\'on voit… et ce que l\'on ne voit pas' },
    {
      type: 'compare',
      left: {
        title: 'Visible',
        md: `- Les blocs (un toutes les ~2 minutes) et les hash de transaction.
- L'horodatage du bloc.
- Le nombre d'entrées et de sorties (au moins 2 sorties par transaction).
- Les frais.
- Les membres de chaque cercle (vrais et leurres mêlés) et les images de clé.`,
      },
      right: {
        title: 'Invisible',
        md: `- Les adresses d'émission et de réception.
- Les montants.
- La sortie réellement dépensée dans chaque cercle.
- L'adresse IP d'origine (sous réserve de Dandelion++ et de la configuration du nœud).`,
      },
    },
    {
      type: 'text',
      md: `En pratique, **le traçage on-chain des transactions Monero modernes n'est pas réalisable de façon fiable**. La recherche a documenté des faiblesses historiques :

- avant 2017, des transactions sans leurres (« zéro mixin ») permettaient, par élimination en cascade, de déduire la vraie sortie d'autres cercles ;
- avant RingCT (2017), les montants étaient visibles ;
- la manière de tirer les leurres a présenté des biais statistiques (la vraie sortie étant souvent la plus récente), progressivement corrigés ;
- des scénarios où un acteur contrôle de nombreuses sorties (par exemple un exchange) peuvent réduire l'anonymat effectif de certains cercles.

Ces faiblesses ont un intérêt opérationnel aujourd'hui très limité, surtout pour des fonds récents.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Méfiance face aux promesses de « traçage Monero »',
      md: `Certains outils commerciaux proposent des heuristiques probabilistes sur Monero. Elles peuvent **orienter** des vérifications (par exemple désigner une transaction de sortie candidate à confirmer par une réquisition), jamais **fonder seules** une conclusion. Si un rapport tiers affirme avoir « tracé » des XMR, demandez la méthode, le taux d'erreur connu et les éléments indépendants qui corroborent.`,
    },
    { type: 'heading', text: 'Attaquer par les frontières' },
    {
      type: 'flow',
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: 'virement 18 400 €' },
        { id: 'cv', label: 'Coinhouse', kind: 'exchange', sub: 'achat BTC (KYC victime)' },
        { id: 's', label: 'Adresse du suspect', kind: 'suspect', sub: '0,285 BTC' },
        { id: 'oc', label: 'ChangeNOW', kind: 'service', sub: 'BTC → XMR' },
        { id: 'x', label: 'Chaîne Monero', kind: 'unknown', sub: 'opaque' },
        { id: 'fx', label: 'eXch', kind: 'service', sub: 'XMR → USDT-TRC20' },
        { id: 'k', label: 'OKX', kind: 'exchange', sub: 'dépôt 17 210 USDT' },
      ],
      edges: [
        { from: 'v', to: 'cv' },
        { from: 'cv', to: 's', label: 'retrait BTC' },
        { from: 's', to: 'oc', label: 'dépôt traçable' },
        { from: 'oc', to: 'x', label: 'XMR envoyés' },
        { from: 'x', to: 'fx', label: '?', dashed: true },
        { from: 'fx', to: 'k', label: 'traçable' },
      ],
      caption: 'Tout ce qui est en trait plein se trace et se réquisitionne. Le seul trou est au milieu : on le contourne par la corrélation et les réquisitions.',
    },
    {
      type: 'steps',
      items: [
        { title: 'Documenter l\'entrée', md: `Hash du dépôt transparent (BTC, ETH, USDT) chez l'échangeur, montant, horodatage. C'est ce hash qui permet à l'échangeur de retrouver la commande : adresse XMR de destination, IP, éventuel e-mail.` },
        { title: 'Chercher la sortie', md: `Sur les chaînes transparentes, rechercher des retraits d'échangeurs connus dans une fenêtre temporelle compatible, pour un montant cohérent (frais et variation de cours déduits).` },
        { title: 'Corréler montant et temps', md: `Plus le montant est singulier et la fenêtre étroite, plus la corrélation est forte. Le délai minimal est contraint : une sortie Monero reçue n'est dépensable qu'après 10 blocs (environ 20 minutes).` },
        { title: 'Réquisitionner les deux bouts', md: `Échangeur d'entrée (commande liée au hash) et échangeur de sortie (adresse de dépôt XMR de la commande, IP). Deux commandes passées depuis la même IP ou le même agent utilisateur relient les deux frontières.` },
        { title: 'Exchanges régulés', md: `Beaucoup d'exchanges européens ont retiré le XMR ; ceux qui le traitent encore disposent du KYC et de l'historique des dépôts et retraits XMR de leurs clients.` },
      ],
    },
    { type: 'widget', id: 'timing-correlation', caption: 'Ajustez la tolérance de montant et la fenêtre temporelle : observez comment le nombre de candidats de sortie évolue.' },
    {
      type: 'case',
      title: 'Cas — Le faux support technique',
      md: `Le 9 juin à 14:02 UTC, l'adresse du suspect dépose **0,285 BTC** chez ChangeNOW (environ 17 650 USD au cours du moment). À 15:31 UTC, eXch envoie **17 210 USDT-TRC20** vers l'adresse de dépôt \`TQx7…9Lm\` chez OKX.

Dans une fenêtre de 4 heures et une tolérance de 3 %, la recherche ne fait ressortir que **2 retraits d'eXch** : l'un de 17 210 USDT, l'autre de 17 590 USDT vers une adresse active depuis 2021 sur des montants réguliers (profil d'un commerçant).

Écart pour le premier candidat : (17 650 − 17 210) / 17 650 ≈ 2,5 %, compatible avec les commissions cumulées de deux échangeurs. Délai : 89 minutes, compatible avec les 10 blocs de verrouillage et un traitement manuel.

Rédaction : corrélation **modérée** fondée sur le montant et le timing ; réquisitions simultanées à ChangeNOW (commande liée au hash du dépôt BTC) et à OKX (titulaire du dépôt). La réponse de ChangeNOW (adresse XMR de destination, IP) et celle d'OKX (KYC, IP de connexion) peuvent transformer cette corrélation en lien établi.`,
    },
    {
      type: 'check',
      q: 'Les fonds ont été convertis BTC → XMR puis XMR → USDT. Où concentrer l\'effort ?',
      options: [
        'Sur l\'analyse statistique des cercles Monero',
        'Sur les parties transparentes, la corrélation montant/temps et les réquisitions aux deux échangeurs',
        'Sur les leurres des cercles',
        'Nulle part : la piste est perdue',
      ],
      answer: 1,
      explain: 'Les frontières transparentes et les services d\'échange restent les vrais points d\'appui ; l\'analyse on-chain de Monero n\'est pas fiable.',
    },
    { type: 'heading', text: 'Clés, preuves et appareils' },
    {
      type: 'table',
      headers: ['Élément', 'Ce qu\'il permet', 'Qui peut le fournir'],
      rows: [
        ['Clé de vue privée + adresse', 'Voir tous les paiements reçus par le portefeuille', 'Appareil saisi, témoin coopérant, portefeuille « lecture seule »'],
        ['Clé de transaction (tx key)', 'Prouver qu\'un montant a été envoyé à une adresse donnée', 'L\'émetteur : victime d\'extorsion ayant payé en XMR'],
        ['Preuve de paiement / de réserve', 'Prouver un paiement ou la détention d\'un solde, signée par le portefeuille', 'Le titulaire du portefeuille'],
        ['Images de clé exportées', 'Avec la clé de vue, reconstituer aussi les dépenses dans un portefeuille en lecture seule', 'Le titulaire (export depuis le portefeuille complet)'],
        ['Seed (25 mots, ou 16 mots au format Polyseed)', 'Contrôle total : restaurer le portefeuille et dépenser', 'Appareil, papier, gestionnaire de mots de passe'],
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : ce qu\'il faut chercher',
      md: `- Fichiers de portefeuille : couple \`nom\` / \`nom.keys\` du portefeuille officiel, profils de Feather, Cake Wallet, Monerujo…
- Seed de **25 mots** (portefeuille officiel) ou de **16 mots** (format Polyseed de portefeuilles récents) : ne pas écarter une phrase dont la longueur ne correspond pas aux 12/24 mots habituels de Bitcoin.
- Adresses commençant par **4** (standard) ou **8** (sous-adresse), longues de 95 caractères.
- Historique des échangeurs (captures de commandes, e-mails de confirmation, identifiants de commande) : ils font le pont avec les frontières.
- Un nœud Monero local (dossier de la blockchain) indique un utilisateur averti.`,
    },
    {
      type: 'check',
      q: 'Une victime de rançongiciel a payé 12 XMR. Comment documenter son paiement de façon vérifiable ?',
      options: [
        'C\'est impossible avec Monero',
        'Avec la clé de vue de l\'attaquant',
        'Avec la clé de transaction (tx key), le hash et l\'adresse destinataire, vérifiables par un tiers',
        'Avec l\'image de clé de la transaction',
      ],
      answer: 2,
      explain: 'La clé de transaction permet à l\'émetteur de prouver qu\'il a envoyé tel montant à telle adresse ; n\'importe qui peut vérifier la preuve avec un portefeuille ou un explorateur adapté.',
    },
    { type: 'heading', text: 'Zcash, Litecoin MWEB, Dash' },
    {
      type: 'compare',
      left: {
        title: 'Zcash transparent (t-addresses)',
        md: `Adresses \`t1…\` / \`t3…\`, modèle UTXO **identique à Bitcoin** : CIOH, rendu, peel chains s'appliquent.

Une part importante de l'activité Zcash, notamment chez les exchanges, reste transparente.`,
      },
      right: {
        title: 'Zcash protégé (shielded)',
        md: `Pools protégés successifs (Sprout, Sapling \`zs…\`, Orchard), adresses unifiées \`u1…\` : émetteur, destinataire et montant masqués.

Les **transitions** transparent → protégé et protégé → transparent sont visibles avec leur montant : un aller-retour rapide d'un montant singulier se corrèle.`,
      },
    },
    {
      type: 'text',
      md: `- **Zcash** dispose aussi de **clés de visualisation** qu'un titulaire peut communiquer, et les montants entrant et sortant des pools protégés sont publics : la corrélation « entré à 14 h avec 312,47 ZEC, sorti à 15 h avec 312,46 ZEC » reste un indice exploitable.
- **Litecoin MWEB** : extension optionnelle (*MimbleWimble Extension Blocks*) masquant montants et adresses à l'intérieur ; les passages vers et depuis la partie transparente (*peg-in* / *peg-out*) restent visibles.
- **Dash** : mécanisme de mélange de type CoinJoin, à dénominations, analysable avec les méthodes vues pour Bitcoin.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Cadre réglementaire',
      md: `Les exchanges régulés en Europe ont largement retiré les crypto-actifs à confidentialité renforcée, sous la pression des obligations de lutte contre le blanchiment. Le règlement européen relatif à la lutte contre le blanchiment adopté en 2024 (AMLR) prévoit en outre, à terme, d'interdire aux prestataires la tenue de comptes en crypto-actifs à anonymat renforcé : vérifiez la date d'application et la portée exacte du texte avant de vous y référer dans un acte.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Rédiger la rupture',
      md: `Documentez la rupture sans dramatiser ni sur-interpréter : « Le 9 juin à 14:02 UTC, les fonds ont été convertis en Monero (XMR) via le service ChangeNOW. Les caractéristiques de cette cryptomonnaie (signatures de cercle, adresses furtives, montants masqués) ne permettent pas de suivre les fonds de façon fiable sur sa blockchain. Les investigations se sont poursuivies sur les points de sortie transparents… »`,
    },
  ],
  keyPoints: [
    'Monero masque l\'émetteur (cercles de 16), le destinataire (adresses furtives) et les montants (RingCT), pour toutes les transactions.',
    'Le traçage on-chain des transactions Monero modernes n\'est pas fiable : toute prétention contraire doit être questionnée.',
    'Les affaires se résolvent aux frontières : dépôts et retraits transparents, échangeurs, exchanges KYC, corrélation montant/temps.',
    'Clé de vue = paiements reçus ; clé de transaction = preuve d\'un paiement émis ; seed = contrôle total.',
    'Seeds Monero de 25 mots ou de 16 mots (Polyseed) ; adresses en 4… ou 8… de 95 caractères.',
    'Zcash : adresses transparentes traçables comme Bitcoin ; transitions vers et depuis les pools protégés observables.',
  ],
  quiz: [
    {
      q: 'Quel mécanisme Monero masque l\'adresse du destinataire ?',
      options: ['Les signatures de cercle', 'RingCT', 'Les adresses furtives (clés de sortie à usage unique)', 'Dandelion++'],
      answer: 2,
      explain: 'Chaque paiement crée une clé de sortie unique : l\'adresse publique du destinataire n\'apparaît jamais sur la chaîne.',
    },
    {
      q: 'Que permet une clé de vue Monero ?',
      options: [
        'Voir les paiements reçus par le portefeuille, sans pouvoir dépenser',
        'Dépenser les fonds',
        'Identifier tous les émetteurs du réseau',
        'Geler le portefeuille',
      ],
      answer: 0,
      explain: 'La clé de vue donne une visibilité sur les entrées de fonds. Pour voir aussi les dépenses, il faut en plus les images de clé exportées.',
    },
    {
      q: 'Quels éléments restent visibles sur la chaîne Monero ?',
      kind: 'multi',
      options: ['Les frais de transaction', 'Les montants envoyés', 'Les images de clé', 'Le nombre d\'entrées et de sorties'],
      answer: [0, 2, 3],
      explain: 'Les montants sont masqués par RingCT. Frais, images de clé, membres des cercles et structure de la transaction restent publics.',
    },
    {
      q: 'Combien de mots compte une seed Monero standard du portefeuille officiel ?',
      options: ['12', '18', '24', '25'],
      answer: 3,
      explain: 'Le portefeuille officiel utilise 25 mots (le dernier sert de somme de contrôle). Certains portefeuilles récents utilisent le format Polyseed de 16 mots.',
    },
    {
      q: 'Un rapport privé affirme avoir « tracé avec certitude » des XMR à travers 6 transactions Monero récentes. Cette affirmation peut être reprise telle quelle dans un procès-verbal.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Les heuristiques sur Monero sont au mieux probabilistes. Il faut exiger la méthode et les taux d\'erreur, et rechercher une corroboration indépendante (réquisitions, appareils).',
    },
    {
      q: 'Les fonds passent de BTC à XMR via un échangeur instantané. Quelle information faut-il fournir à l\'échangeur pour qu\'il retrouve la commande ?',
      options: [
        'L\'adresse XMR de destination',
        'Le hash de la transaction de dépôt BTC (et l\'adresse de dépôt)',
        'L\'image de clé',
        'La clé de vue de l\'échangeur',
      ],
      answer: 1,
      explain: 'L\'enquêteur ne connaît que la partie transparente : le hash du dépôt permet à l\'échangeur de retrouver la commande, l\'adresse XMR de destination et l\'IP.',
    },
    {
      q: 'Sur Zcash, quelles opérations offrent une prise à l\'analyse ?',
      kind: 'multi',
      options: [
        'Les transactions entre adresses transparentes t1…',
        'Les transferts entièrement internes au pool Orchard',
        'Les entrées et sorties du pool protégé, dont le montant est visible',
        'Les clés de visualisation communiquées par un titulaire',
      ],
      answer: [0, 2, 3],
      explain: 'Les transferts internes aux pools protégés masquent émetteur, destinataire et montant. Les adresses transparentes, les transitions et les clés de visualisation restent exploitables.',
    },
  ],
  flashcards: [
    { front: 'Signature de cercle', back: 'Chaque entrée signée parmi 16 sorties (1 vraie + 15 leurres) : l\'émetteur est masqué.' },
    { front: 'Adresse furtive', back: 'Clé de sortie à usage unique par paiement : l\'adresse publique du destinataire n\'apparaît jamais.' },
    { front: 'RingCT', back: 'Masquage des montants par engagements cryptographiques et preuves de plage (Bulletproofs+).' },
    { front: 'Image de clé', back: 'Valeur unique publiée à chaque dépense pour empêcher la double dépense sans révéler la sortie.' },
    { front: 'Clé de vue', back: 'Voir les paiements reçus. Avec les images de clé exportées : reconstituer aussi les dépenses.' },
    { front: 'Clé de transaction (tx key)', back: 'Permet à l\'émetteur de prouver qu\'il a payé un montant à une adresse.' },
    { front: 'Seed Monero', back: '25 mots (portefeuille officiel) ou 16 mots (Polyseed). Contrôle total des fonds.' },
    { front: 'Délai minimal de redépense XMR', back: '10 blocs (~20 minutes) : borne inférieure utile pour la corrélation temporelle.' },
    { front: 'Stratégie face à Monero', back: 'Documenter la rupture, attaquer les frontières transparentes, réquisitionner les échangeurs, chercher les preuves sur les appareils.' },
    { front: 'Zcash : t-address vs z-address', back: 't1/t3 = transparent, traçable comme Bitcoin ; zs/u1 = protégé. Les transitions entre les deux sont visibles.' },
    { front: 'Litecoin MWEB', back: 'Extension optionnelle confidentielle ; peg-in et peg-out visibles côté transparent.' },
  ],
}

export const L4_CONFIDENTIALITE: Lesson[] = [coinjoin, privacyPools, monero]
