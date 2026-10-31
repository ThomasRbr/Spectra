// Niveau 4 — Smart contracts & DeFi : prêts avec garantie et rupture apparente
// du traçage. Acteurs réels (Aave, Sky/MakerDAO, Circle, Tether) décrits
// factuellement ; victimes, suspects, plateformes et montants sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_PRET_GARANTIE: Lesson = {
  id: 'pret-garantie',
  title: 'Prêts DeFi : garantie, emprunt et rupture apparente du traçage',
  level: 4,
  track: 'contrats',
  minutes: 45,
  summary: `Déposer des fonds volés en garantie, emprunter des stablecoins « neufs » et les envoyer vers un exchange : aucun flux ne relie plus la victime à l'argent qui sort. Mécanique d'un prêt surcollatéralisé (LTV, seuil de liquidation, facteur de santé), schéma de blanchiment, raison pour laquelle un traçage strict par les flux perd la piste, indices qui permettent de la retrouver (même compte, jetons de reçu et de dette, événements Supply / Borrow), dépassement de 100 % de la source, gel et saisie, remboursement et retrait différés, présentation du lien de garantie dans un rapport.`,
  objectives: [
    `Expliquer le fonctionnement d'un prêt surcollatéralisé : garantie, jetons de reçu et de dette, LTV, seuil de liquidation, facteur de santé, liquidation.`,
    `Reconnaître le schéma « dépôt de fonds volés en garantie, emprunt, sortie » et ses variantes (délégation de crédit, liquidation volontaire, remboursement différé).`,
    `Comprendre pourquoi un traçage par les flux s'arrête dans la réserve du protocole, et retrouver le lien par les événements et les positions.`,
    `Interpréter un traçage qui suit les garanties, y compris lorsque le total marqué dépasse 100 % de la source.`,
    `Présenter le lien de garantie comme un lien indirect, justifié et distinct des flux, et identifier les leviers de gel et de saisie.`,
  ],
  prerequisites: ['jetons-enveloppes', 'tracage-outille'],
  practice: ['lending-garantie'],
  blocks: [
    {
      type: 'text',
      md: `Une PME clermontoise (fictive) de négoce de matériel agricole conserve une partie de sa trésorerie en ETH. Le 9 février 2026, la clé de son portefeuille est compromise : **180 ETH** partent vers \`0x6a1d…e03b\`. Cours du jour retenu : 2 500 $ l'ETH, soit **450 000 $**.

Vingt minutes plus tard, le suspect dépose les 180 ETH sur **Aave v3** et reçoit 180 aEthWETH. Six minutes après, il **emprunte 250 000 USDC**, qu'il fait passer par deux adresses avant de les déposer sur deux exchanges. Les ETH, eux, ne bougent plus.

L'analyste lance un traçage classique et obtient une conclusion déroutante : « 100 % des fonds sont dans le pool Aave ; aucun flux sortant ». Les 250 000 USDC déposés chez les exchanges, eux, proviennent « du pool Aave », c'est-à-dire de l'épargne de milliers de prêteurs en USDC. **Aucun flux** ne relie la victime à cet argent. Et pourtant, sans les ETH volés, il n'existerait pas. Cette leçon explique comment le démontrer.`,
    },
    { type: 'heading', text: 'Le prêt surcollatéralisé, en cinq notions' },
    {
      type: 'text',
      md: `Les protocoles de prêt comme **Aave** fonctionnent sans vérification d'identité ni appréciation de solvabilité : l'emprunteur dépose une **garantie** d'une valeur supérieure à ce qu'il emprunte. Si la garantie perd de sa valeur, des tiers peuvent la **liquider** pour rembourser la dette. Les usages légitimes sont courants : obtenir des liquidités sans vendre ses actifs, prendre un effet de levier, gérer une trésorerie.

Les paramètres de risque (LTV maximale, seuil de liquidation, prime de liquidation) sont fixés **actif par actif** par la gouvernance du protocole et modifiés régulièrement : relevez ceux qui s'appliquaient **à la date des faits**. Sur Aave v3 Ethereum, l'ETH a une LTV maximale de l'ordre de 80 % (à vérifier au moment des faits).`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Garantie (collatéral)', def: `Actif déposé (supply) qui garantit l'emprunt. Le déposant reçoit des aTokens (jetons de reçu) et continue de percevoir des intérêts.` },
        { term: 'Jeton de dette', def: `Jeton non transférable (variableDebt…) créé au profit de l'emprunteur lors de l'emprunt : il mesure la dette, intérêts compris.` },
        { term: 'LTV maximale (loan-to-value)', def: `Rapport maximal entre la valeur empruntée et la valeur de la garantie au moment de l'emprunt (par exemple 80 %).` },
        { term: 'Seuil de liquidation', def: `Rapport au-delà duquel la position devient liquidable ; légèrement supérieur à la LTV maximale.` },
        { term: 'Facteur de santé (health factor)', def: `Somme des garanties pondérées par leur seuil de liquidation, divisée par la dette. En dessous de 1, la position peut être liquidée.` },
        { term: 'Liquidation', def: `Un tiers (souvent un robot) rembourse une partie de la dette et reçoit en échange de la garantie, avec une prime. Événement LiquidationCall.` },
        { term: 'Délégation de crédit', def: `Le titulaire d'une garantie autorise une autre adresse à emprunter en son nom (approveDelegation) : l'emprunteur reçoit les fonds, la dette est inscrite au compte du délégant (onBehalfOf).` },
      ],
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Le calcul sur le cas d’ouverture',
      md: `Garantie : 180 ETH × 2 500 $ = **450 000 $**. Emprunt : **250 000 USDC**.

- LTV de la position : 250 000 / 450 000 = **55,6 %**, sous le maximum autorisé.
- Avec un seuil de liquidation supposé de 83 % : facteur de santé = (450 000 × 0,83) / 250 000 = **1,49**.
- Prix de liquidation de l'ETH : 250 000 / (180 × 0,83) = **1 673 $** environ.

Le suspect a donc transformé 450 000 $ d'ETH traçables et non gelables en 250 000 $ d'USDC sans historique apparent, tout en gardant un droit sur ses 180 ETH tant que le cours reste au-dessus de 1 673 $.`,
    },
    { type: 'heading', text: 'Le schéma de blanchiment' },
    {
      type: 'steps',
      items: [
        { title: '1. Réception et préparation', md: `Les fonds volés arrivent sur une adresse contrôlée. S'ils sont en USDT ou en USDC, ils sont souvent d'abord échangés contre de l'ETH ou un actif non gelable (voir la leçon sur les DEX).` },
        { title: '2. Dépôt en garantie', md: `Appel \`supply\` (ou \`depositETH\` via une passerelle qui enveloppe l'ETH en WETH) : l'actif part vers le protocole, des aTokens sont créés au profit du déposant. Événement \`Supply\`.` },
        { title: '3. Emprunt', md: `Appel \`borrow\` : des stablecoins sortent de la réserve vers l'emprunteur ; un jeton de dette est créé. Événement \`Borrow\`. Les fonds reçus n'ont, en apparence, aucun lien avec la victime.` },
        { title: '4. Sortie', md: `Les stablecoins empruntés sont fractionnés, échangés, pontés, ou déposés directement chez un exchange ou un OTC. Le filtrage automatique de la plateforme ne voit qu'une provenance « protocole de prêt ».` },
        { title: '5. Dénouement', md: `Trois issues : **abandon** de la garantie (la dette n'est jamais remboursée), **liquidation** (subie ou recherchée), ou **remboursement puis retrait** de la garantie, souvent des semaines plus tard et vers une autre adresse.` },
      ],
    },
    {
      type: 'flow',
      caption: `Le schéma : aucun flux ne relie la garantie (en haut) à l'emprunt (en bas). Le lien, en pointillé, est économique et se lit dans les événements du même compte.`,
      nodes: [
        { id: 'v', label: 'PME (victime)', kind: 'victim', sub: '180 ETH' },
        { id: 's', label: 'Suspect', kind: 'suspect', sub: '0x6a1d…e03b' },
        { id: 'pool', label: 'Aave v3 : Pool', kind: 'contract', sub: 'réserves communes' },
        { id: 'r1', label: 'Relais', kind: 'wallet', sub: '0x2f8c…71aa' },
        { id: 'ex1', label: 'Dépôt exchange A', kind: 'deposit', sub: '140 000 USDC' },
        { id: 'ex2', label: 'Dépôt exchange B', kind: 'deposit', sub: '110 000 USDC' },
      ],
      edges: [
        { from: 'v', to: 's', label: '180 ETH (vol)' },
        { from: 's', to: 'pool', label: 'supply 180 ETH → 180 aWETH' },
        { from: 'pool', to: 's', label: 'borrow 250 000 USDC', dashed: true },
        { from: 's', to: 'r1', label: '250 000 USDC' },
        { from: 'r1', to: 'ex1', label: '140 000 USDC' },
        { from: 'r1', to: 'ex2', label: '110 000 USDC' },
      ],
    },
    {
      type: 'text',
      md: `**Variantes à connaître :**

- **Délégation de crédit** : la garantie est déposée par l'adresse A, mais c'est l'adresse B, autorisée par A, qui emprunte et reçoit les fonds. L'événement \`Borrow\` porte alors \`user = B\` et \`onBehalfOf = A\` : le lien entre les deux adresses est écrit dans l'événement.
- **Liquidation recherchée** : le suspect emprunte au maximum et laisse le cours évoluer. Si la position est liquidée, un robot liquidateur rembourse la dette et **reçoit la garantie volée avec une prime**. Économiquement, le suspect a vendu les ETH volés à un tiers de bonne foi, au comptant, à prix réduit, et garde les USDC.
- **Protocoles qui créent la monnaie empruntée** : dans un coffre de l'écosystème **Sky** (ex-MakerDAO), le DAI emprunté n'est pas prélevé sur l'épargne de prêteurs, il est **créé** (Transfer depuis l'adresse nulle) contre la garantie. Le raisonnement est le même ; la monnaie obtenue est littéralement neuve.`,
    },
    {
      type: 'check',
      q: `La position du suspect est liquidée : un robot rembourse 120 000 USDC de dette et reçoit 50,4 ETH de garantie. Comment qualifier, dans l'analyse, la situation du robot liquidateur ?`,
      options: [
        `Complice : il a reçu des ETH volés`,
        `Tiers qui a acquis, par un mécanisme public et automatique, une partie de la garantie marquée contre remboursement de la dette ; à mentionner comme destination des ETH, sans présumer de sa mauvaise foi`,
        `Sans intérêt : la liquidation efface la trace`,
        `Victime au même titre que la PME`,
      ],
      answer: 1,
      explain: `La liquidation transfère réellement de la garantie marquée vers le liquidateur, qui a payé une contrepartie (le remboursement de la dette). C'est une destination des fonds à consigner, typiquement sans intention frauduleuse. Côté suspect, la dette disparaît alors qu'il conserve les USDC empruntés.`,
    },
    { type: 'heading', text: 'Pourquoi le traçage par les flux perd la piste' },
    {
      type: 'compare',
      left: {
        title: 'Lecture par les flux',
        md: `- Les 180 ETH entrent dans le protocole : en réalité, ils rejoignent une **réserve d'ETH** commune à tous les déposants.
- Les 250 000 USDC sortent de la **réserve d'USDC**, alimentée par d'autres utilisateurs. Aucun ETH de la victime n'y est jamais entré.
- Même en contamination totale (poison), il n'y a **aucun chemin** entre les deux réserves : ce ne sont pas les mêmes fonds.
- Conclusion mécanique : « fonds immobilisés dans Aave », et l'argent qui part chez les exchanges paraît propre.`,
      },
      right: {
        title: 'Lecture économique',
        md: `- Le suspect détient une **créance** de 180 aWETH : la garantie lui appartient toujours.
- Il a obtenu 250 000 USDC **grâce à** cette garantie et **seulement grâce à elle** : sans dépôt, l'emprunt était impossible.
- Les deux opérations sont signées par le **même compte**, à quelques minutes d'intervalle, et inscrites sur la **même position**.
- Conclusion : les USDC sont le **produit d'une opération de conversion** adossée aux fonds volés. Le lien est indirect, mais démontrable.`,
      },
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Ce que voit le filtrage d’un exchange',
      md: `Un outil de conformité qui calcule l'exposition **par les flux** attribue les USDC reçus à leur source directe : un protocole de prêt réputé, catégorie de risque faible. La garantie volée, à un saut « économique » et non à un saut de flux, n'apparaît pas. C'est précisément l'intérêt du schéma pour le blanchisseur, et la raison pour laquelle l'enquêteur doit **signaler lui-même** le lien à la plateforme.`,
    },
    { type: 'heading', text: 'Retrouver le lien : des indices concordants' },
    {
      type: 'table',
      caption: 'Les indices qui rattachent un emprunt à une garantie',
      headers: ['Indice', 'Où le lire', 'Ce qu’il établit', 'Limite'],
      rows: [
        ['Même compte', 'Événements `Supply` (onBehalfOf) et `Borrow` (onBehalfOf) émis par le pool', 'La garantie et la dette sont inscrites sur la même position', 'Une position peut contenir des garanties d’origines diverses'],
        ['Jetons de reçu détenus au moment de l’emprunt', 'Solde d’aTokens de l’emprunteur juste avant la transaction `borrow`', 'Quelle garantie, et quelle part marquée, adossait l’emprunt', 'Les aTokens ont pu être reçus d’une autre adresse : remonter leur origine'],
        ['Jeton de dette créé', 'Transfer depuis l’adresse nulle du jeton variableDebt… vers l’emprunteur', 'L’existence et le montant de la dette', 'Non transférable : ne désigne que le débiteur'],
        ['Chronologie', 'Horodatages des transactions `supply` et `borrow`', 'Enchaînement délibéré, souvent en quelques minutes', 'Indice, pas preuve à lui seul'],
        ['Montants', 'Montant emprunté rapporté à la valeur de la garantie', 'Emprunt compatible avec la LTV ; emprunt au maximum = recherche de liquidité', 'Dépend du cours retenu et de sa source'],
        ['Délégation', '`approveDelegation` sur le jeton de dette ; `Borrow` avec user ≠ onBehalfOf', 'Lien explicite entre le titulaire de la garantie et l’emprunteur', 'Rare, mais décisif quand il existe'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Dans l’espace d’enquête SPECTRA',
      md: `Dans l'inspecteur, la carte **Appel de contrat** décode \`borrow(address,uint256,uint256,uint16,address)\` : actif emprunté, montant, mode de taux, et adresse \`onBehalfOf\`. Les **Journaux d'événements** montrent \`Supply\`, \`Borrow\`, \`Repay\` et \`Withdraw\` émis par le pool. L'outil **« Traçage des fonds »** suit les garanties : un emprunt signé par une adresse qui détient des aTokens marqués **hérite de la part marquée de la garantie**, et il est listé à part comme **lien indirect** (garantie → emprunt). Dans le simulateur, les actifs déposés et empruntés transitent par le pool ; sur Aave v3 réel, ils sont détenus par le contrat de chaque aToken, ce qui change l'adresse affichée comme expéditeur sur un explorateur.`,
    },
    {
      type: 'text',
      md: `**Comment la part marquée de l'emprunt est calculée.** Spectra rapporte les aTokens marqués de l'emprunteur à l'ensemble de ses aTokens au moment de l'emprunt (sauf en contamination totale, où la fraction vaut 1). Cette fraction s'applique au montant emprunté :

- le suspect ne détient que les 180 aWETH issus du vol : fraction 180 / 180 = 1, les **250 000 USDC** empruntés sont marqués en totalité ;
- s'il détenait aussi 60 aWETH déposés auparavant avec des fonds d'origine indéterminée : fraction 180 / 240 = 0,75, soit **187 500 USDC** marqués.

C'est une **clé de répartition**, pas un flux : elle repose sur l'hypothèse que chaque unité de garantie a contribué à l'emprunt à proportion de sa valeur. Elle doit être annoncée comme telle.`,
    },
    {
      type: 'check',
      q: `Le suspect détient 100 aWETH marqués et 300 aWETH d'origine sans lien avec l'affaire, puis emprunte 400 000 USDC. Quelle part de l'emprunt le traçage par garantie marque-t-il (méthode prorata) ?`,
      options: ['400 000 USDC', '100 000 USDC', '25 000 USDC', 'Aucune : il faut un flux direct'],
      answer: 1,
      explain: `Fraction marquée de la garantie : 100 / 400 = 25 %. Appliquée à l'emprunt : 25 % × 400 000 = 100 000 USDC. En contamination totale, l'emprunt entier serait marqué, ce qui ne sert qu'à délimiter un périmètre.`,
    },
    { type: 'heading', text: 'Plus de 100 % de la source : ce n’est pas une erreur' },
    {
      type: 'text',
      md: `La leçon sur le traçage outillé pose une règle de contrôle : destinations + fonds encore détenus + non suivi doivent redonner la source. Le lien de garantie fait exception. Dans le cas d'ouverture, le traçage affiche :

- **450 000 $** de garantie marquée, toujours détenue sous forme de 180 aWETH ;
- **250 000 $** d'USDC marqués par le lien de garantie, arrivés chez deux exchanges.

Total : **700 000 $** pour une source de 450 000 $. Les deux valeurs **coexistent réellement** : la créance sur la garantie et l'argent emprunté. Ce qui équilibre le bilan, c'est la **dette** de 250 000 USDC inscrite au compte du suspect. Sa richesse nette tirée du vol reste de 450 000 $ : 200 000 $ de garantie nette de dette, plus 250 000 $ en USDC.`,
    },
    {
      type: 'table',
      caption: 'Présenter séparément flux et liens indirects',
      headers: ['Rubrique', 'Montant', 'Nature', 'Usage'],
      rows: [
        ['Garantie marquée (180 aWETH)', '450 000 $', 'Flux direct converti (ETH → aWETH)', 'Chiffrage, cible de saisie si les clés sont accessibles'],
        ['USDC empruntés, exchanges A et B', '250 000 $', 'Lien indirect (garantie → emprunt)', 'Réquisitions, demandes de gel ; jamais additionné au préjudice'],
        ['Dette du suspect', '250 000 USDC', 'Passif inscrit sur la position', 'Explique pourquoi le total dépasse la source'],
      ],
    },
    { type: 'heading', text: 'Restitution, gel et saisie' },
    {
      type: 'text',
      md: `- **La garantie** reste en théorie saisissable : les aWETH sont à l'adresse du suspect. Mais **aucun opérateur ne gèle** une adresse sur Aave ; la gouvernance peut geler ou suspendre une réserve entière, pas une position. Le suspect peut à tout moment **transférer** ses aTokens (tant que la position reste suffisamment garantie) ou rembourser et **retirer** la garantie. Sans accès aux clés, la garantie n'est qu'une cible à surveiller.
- **Les fonds empruntés** sont souvent le meilleur levier : de l'**USDC** ou de l'**USDT** encore détenus peuvent être gelés par l'émetteur, et des dépôts chez un exchange par la plateforme. D'où la préférence de certains blanchisseurs pour l'emprunt de **DAI**, non gelable, ou pour un échange immédiat.
- **La saisie avec les clés** : rembourser la dette puis retirer la garantie, ou transférer les aTokens, selon les instructions du magistrat et de l'AGRASC ; documenter le facteur de santé au moment de la saisie (une position proche de 1 peut être liquidée avant l'exécution).`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Qualifier sans trancher à la place du juge',
      md: `Déposer des fonds volés en garantie pour en tirer des liquidités est, matériellement, une opération de **conversion**, au sens du délit de blanchiment (article 324-1 du Code pénal). La confiscation peut porter sur le produit **direct ou indirect** de l'infraction et, à défaut, s'exécuter **en valeur** (article 131-21 du Code pénal). Savoir si les USDC empruntés constituent un produit indirect relève de l'appréciation du magistrat (à apprécier au cas par cas) : le rôle de l'analyste est de décrire le lien économique avec précision, ses fondements et ses limites.`,
    },
    { type: 'heading', text: 'Remboursement et retrait de la garantie, plus tard' },
    {
      type: 'text',
      md: `Un blanchisseur patient rembourse l'emprunt après quelques semaines, puis retire sa garantie, souvent vers une **autre adresse**. Deux événements méritent une lecture attentive :

- \`Repay(reserve, user, repayer, amount, useATokens)\` : le champ \`repayer\` désigne **qui a payé**. S'il diffère de l'emprunteur, c'est une nouvelle adresse à rattacher ; d'où venaient les fonds du remboursement ? Un retrait d'exchange ici est une **piste d'identification** de premier ordre.
- \`Withdraw(reserve, user, to, amount)\` : le champ \`to\` désigne le **bénéficiaire** de la garantie restituée. La trace des fonds de la victime reprend là, **par un flux direct** : les aTokens marqués sont détruits et l'actif sous-jacent est versé à \`to\`.`,
    },
    {
      type: 'case',
      title: 'Cas — le remboursement qui trahit',
      md: `Le 12 mars 2026, trente et un jours après l'emprunt, \`0x9c44…05d7\` appelle \`repay\` pour **251 870 USDC** (capital plus intérêts) au bénéfice de la position \`0x6a1d…e03b\` : l'événement \`Repay\` porte \`user = 0x6a1d…e03b\` et \`repayer = 0x9c44…05d7\`. Une heure plus tard, \`0x6a1d…e03b\` retire ses 180,4 WETH de garantie (intérêts compris) avec \`to = 0x3e90…b2f1\`, puis \`0x3e90…b2f1\` les désenveloppe.

Lecture : la garantie marquée revient par un **flux direct** sur \`0x3e90…b2f1\`, qui devient la cible prioritaire. Les 251 870 USDC du remboursement ont été retirés d'un exchange vers \`0x9c44…05d7\` la veille : la réquisition à cet exchange vise un compte qui a **financé le dénouement** de l'opération, ce qui le relie directement au suspect. Le remboursement n'efface rien : il **ajoute** des adresses et une piste.`,
    },
    { type: 'heading', text: 'Présenter le lien de garantie dans un rapport' },
    {
      type: 'steps',
      items: [
        { title: 'Le nommer', md: `« Lien indirect de garantie », jamais « flux » ni « transfert ». Une rubrique distincte du tableau des destinations.` },
        { title: 'Le fonder', md: `Hash des transactions \`supply\` et \`borrow\`, événements et adresse \`onBehalfOf\`, solde d'aTokens au moment de l'emprunt, chronologie, paramètres de risque à la date.` },
        { title: 'Le chiffrer avec sa clé', md: `Fraction marquée de la garantie appliquée au montant emprunté ; préciser la méthode, le cours retenu et sa source.` },
        { title: 'Expliquer le dépassement', md: `Indiquer que la garantie et l'emprunt coexistent, compensés par une dette : les montants ne s'additionnent pas.` },
        { title: 'Décrire le dénouement', md: `Abandon, liquidation (liquidateur et montants), ou remboursement (payeur, origine des fonds) et retrait (bénéficiaire).` },
        { title: 'Dire les limites', md: `Clé de répartition conventionnelle, autres garanties sur la position, paramètres de gouvernance susceptibles d'avoir changé.` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Formulation type',
      md: `« Le 9 février 2026 à 10:41 UTC, l'adresse \`0x6a1d…e03b\` a emprunté 250 000 USDC sur Aave v3 (tx \`0x…\`, événement \`Borrow\`, onBehalfOf = \`0x6a1d…e03b\`). Cet emprunt était garanti exclusivement par 180 aEthWETH, obtenus six minutes plus tôt par le dépôt des 180 ETH détournés (tx \`0x…\`, événement \`Supply\`). Il n'existe pas de flux direct entre les fonds de la victime et les USDC empruntés, qui proviennent de la réserve d'USDC du protocole ; le lien est **économique** : l'emprunt n'a été possible que grâce à cette garantie. Les montants de la garantie et de l'emprunt ne s'additionnent pas. »`,
    },
  ],
  keyPoints: [
    `Un prêt surcollatéralisé permet de tirer des liquidités « neuves » d'une garantie sans la vendre : c'est un outil de conversion pour des fonds volés.`,
    `Les fonds empruntés sortent d'une autre réserve que celle de la garantie : aucun flux, même en contamination totale, ne relie la victime à l'emprunt.`,
    `Le lien se démontre par le même compte (Supply / Borrow, onBehalfOf), les aTokens détenus au moment de l'emprunt, le jeton de dette, la chronologie et les montants.`,
    `Le traçage par garantie marque l'emprunt à proportion des aTokens marqués ; ce lien indirect peut faire dépasser 100 % de la source, car garantie et emprunt coexistent, compensés par une dette.`,
    `Aucun opérateur ne gèle une position sur Aave ; les leviers sont les stablecoins empruntés (émetteurs), les exchanges de sortie et la saisie des clés.`,
    `Remboursement et retrait différés ouvrent des pistes : le champ repayer (qui a payé) et le champ to (qui récupère la garantie).`,
    `Au rapport, le lien de garantie est nommé, fondé, chiffré avec sa clé, présenté à part et jamais additionné au préjudice.`,
  ],
  quiz: [
    {
      q: `Pourquoi un traçage par les flux, même en contamination totale, ne relie-t-il pas les ETH volés déposés en garantie aux USDC empruntés ?`,
      options: [
        `Parce que le protocole chiffre les transactions`,
        `Parce que les USDC sortent de la réserve d'USDC du protocole, où aucun fonds de la victime n'est jamais entré`,
        `Parce que les aTokens détruisent la trace`,
        `Parce que les explorateurs n'affichent pas les emprunts`,
      ],
      answer: 1,
      explain: `Les réserves sont distinctes par actif. Les ETH rejoignent la réserve d'ETH ; les USDC empruntés proviennent de l'épargne des prêteurs d'USDC. Le lien est économique (garantie → emprunt), pas un flux.`,
    },
    {
      q: `Garantie : 200 ETH à 3 000 $. Emprunt : 300 000 USDC. Seuil de liquidation : 82,5 %. Quel est le facteur de santé ?`,
      options: ['0,50', '1,00', '1,65', '2,00'],
      answer: 2,
      explain: `(200 × 3 000 × 0,825) / 300 000 = 495 000 / 300 000 = 1,65. La position deviendrait liquidable si le cours de l'ETH tombait sous 300 000 / (200 × 0,825) ≈ 1 818 $.`,
    },
    {
      kind: 'multi',
      q: `Quels éléments rattachent un emprunt à une garantie déposée ? (plusieurs réponses)`,
      options: [
        `Des événements Supply et Borrow inscrits au même compte (onBehalfOf)`,
        `Le solde d'aTokens de l'emprunteur juste avant l'emprunt`,
        `La création d'un jeton de dette au profit de l'emprunteur`,
        `Le fait que les USDC empruntés et les ETH déposés aient la même valeur en dollars`,
      ],
      answer: [0, 1, 2],
      explain: `Le même compte, la garantie détenue au moment de l'emprunt et le jeton de dette fondent le lien. L'égalité des valeurs n'est pas un critère : un emprunt est toujours inférieur à la garantie (surcollatéralisation).`,
    },
    {
      kind: 'truefalse',
      q: `Un traçage qui affiche 700 000 $ marqués pour une source de 450 000 $ révèle nécessairement une erreur de l'outil.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Avec le suivi des garanties, la garantie marquée (toujours détenue) et l'emprunt marqué coexistent ; une dette les compense. Le dépassement est normal, à condition de présenter le lien comme indirect et de ne jamais additionner les deux montants.`,
    },
    {
      q: `L'événement Borrow porte user = 0xB et onBehalfOf = 0xA. Que faut-il en conclure ?`,
      options: [
        `0xA a emprunté et reçu les fonds`,
        `0xB a reçu les fonds en empruntant sur la garantie de 0xA, grâce à une délégation de crédit : les deux adresses sont liées`,
        `L'événement est corrompu`,
        `0xB est le liquidateur de 0xA`,
      ],
      answer: 1,
      explain: `Avec la délégation de crédit, le délégataire (user) reçoit les fonds et la dette est inscrite au compte du délégant (onBehalfOf). L'événement relie explicitement l'adresse de la garantie et celle de l'emprunteur.`,
    },
    {
      q: `Une position garantie par des ETH volés est liquidée. Que devient la garantie liquidée ?`,
      options: [
        `Elle est détruite par le protocole`,
        `Elle revient automatiquement à la victime`,
        `Elle est remise au liquidateur, avec une prime, en échange du remboursement d'une partie de la dette : c'est une destination des fonds marqués`,
        `Elle reste bloquée indéfiniment dans le protocole`,
      ],
      answer: 2,
      explain: `Le liquidateur rembourse la dette et reçoit de la garantie avec une prime (événement LiquidationCall). Le suspect garde les fonds empruntés : la liquidation équivaut à une vente à prix réduit de la garantie volée.`,
    },
    {
      kind: 'multi',
      q: `Quels leviers de gel ou de saisie sont réalistes dans le cas d'ouverture ? (plusieurs réponses)`,
      options: [
        `Demander à Circle de geler les USDC encore détenus sur une adresse identifiée`,
        `Demander aux exchanges A et B de bloquer les comptes crédités`,
        `Demander à Aave de geler la position du suspect`,
        `Saisir la position si les clés du suspect sont accessibles`,
      ],
      answer: [0, 1, 3],
      explain: `Aave n'a pas d'opérateur qui gèle une adresse : la gouvernance n'agit que sur des réserves entières. Les stablecoins empruntés (émetteur), les plateformes de sortie et la saisie des clés sont les vrais leviers.`,
    },
    {
      q: `Dans l'événement Repay, le champ repayer diffère de l'emprunteur. Quel intérêt pour l'enquête ?`,
      options: [
        `Aucun : seul compte le montant remboursé`,
        `Il désigne l'adresse qui a payé la dette : l'origine de ses fonds est une piste, notamment s'ils proviennent d'un exchange`,
        `Il désigne la victime`,
        `Il prouve que la garantie a été liquidée`,
      ],
      answer: 1,
      explain: `Le payeur a financé le dénouement de l'opération : c'est une adresse liée au suspect, et l'origine de ses fonds peut mener à un compte identifié.`,
    },
    {
      kind: 'truefalse',
      q: `Après le remboursement de l'emprunt, la garantie retirée vers une autre adresse reste reliée aux fonds de la victime par un flux direct.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Le retrait détruit les aTokens marqués et verse l'actif sous-jacent au bénéficiaire désigné (champ to de l'événement Withdraw). C'est une conversion à valeur égale : la trace directe reprend sur cette adresse.`,
    },
    {
      q: `Comment présenter, dans le rapport, les USDC obtenus par l'emprunt ?`,
      options: [
        `Comme un transfert des fonds de la victime vers les exchanges`,
        `Dans une rubrique distincte : lien indirect de garantie, fondé sur les événements et la position, chiffré avec sa clé de répartition, non additionné au préjudice`,
        `Ne pas les mentionner, faute de flux`,
        `Comme des fonds propres du suspect`,
      ],
      answer: 1,
      explain: `Le lien est réel mais indirect. Le présenter comme un flux exposerait le rapport à la contestation ; l'omettre priverait l'enquête de ses meilleurs leviers (gel des stablecoins, réquisition des exchanges).`,
    },
  ],
  flashcards: [
    { front: 'Prêt surcollatéralisé', back: `Emprunt garanti par un dépôt d'une valeur supérieure ; sans vérification d'identité ni de solvabilité.` },
    { front: 'LTV', back: `Loan-to-value : valeur empruntée / valeur de la garantie. Plafond fixé par la gouvernance, actif par actif.` },
    { front: 'Facteur de santé', back: `Σ(garanties × seuil de liquidation) / dette. Sous 1, la position est liquidable.` },
    { front: 'Liquidation', back: `Un tiers rembourse une partie de la dette et reçoit de la garantie avec une prime (événement LiquidationCall).` },
    { front: 'Événement Borrow (Aave v3)', back: `Borrow(reserve, user, onBehalfOf, amount, interestRateMode, borrowRate, referralCode).` },
    { front: 'Délégation de crédit', back: `Borrow avec user ≠ onBehalfOf : l'emprunteur utilise la garantie d'une autre adresse, qui l'a autorisé.` },
    { front: 'Jeton de dette', back: `variableDebt… : créé à l'emprunt, non transférable, détruit au remboursement ou à la liquidation.` },
    { front: 'Lien indirect de garantie', back: `Emprunt marqué à proportion des aTokens marqués détenus par l'emprunteur ; relation économique, pas un flux.` },
    { front: 'Dépassement de 100 %', back: `Garantie marquée et emprunt marqué coexistent, compensés par la dette : ne jamais additionner.` },
    { front: 'Repay : champ repayer', back: `Adresse qui a payé la dette ; l'origine de ses fonds est une piste.` },
    { front: 'Withdraw : champ to', back: `Bénéficiaire de la garantie restituée ; la trace directe reprend sur lui.` },
    { front: 'Gel sur Aave', back: `Pas de gel d'adresse ; la gouvernance peut geler une réserve entière. Viser les stablecoins empruntés et les plateformes.` },
  ],
}
