// Niveau 5 — Smart contracts & DeFi : blanchiment par la DeFi, méthodes
// combinées et limites du traçage. Acteurs réels (Aave, Uniswap, Curve,
// Circle, Tether, Tornado Cash, fournisseurs RPC) décrits factuellement ;
// la plateforme victime, les suspects, l'OTC et tous les montants sont FICTIFS.
import type { Lesson } from '../model'

export const LESSON_BLANCHIMENT_DEFI: Lesson = {
  id: 'blanchiment-defi',
  title: 'Blanchiment par la DeFi : méthodes combinées et limites du traçage',
  level: 5,
  track: 'contrats',
  minutes: 55,
  summary: `Synthèse experte : comment les blanchisseurs enchaînent swaps hors des jetons gelables, enveloppes, garanties et emprunts, parts de pool cédées, bridges et pools de confidentialité, et comment l'analyste reconstitue l'ensemble. Signaux d'alerte, ordre d'analyse, choix et justification de la méthode de traçage, ce que l'on peut réellement obtenir par réquisition (interfaces, RPC, agrégateurs, émetteurs), leviers de gel, cas pratique fictif entièrement chiffré et grille de rapport.`,
  objectives: [
    `Reconnaître les enchaînements typiques de blanchiment par la DeFi et ce que chaque brique « casse » dans une analyse naïve.`,
    `Conduire l'analyse dans un ordre qui préserve d'abord les chances de gel, puis reconstitue le graphe économique (conversions, positions, liens indirects).`,
    `Choisir une méthode de traçage, la justifier juridiquement et en présenter la robustesse.`,
    `Évaluer ce qu'une réquisition peut apporter selon la cible (interface, RPC, agrégateur, émetteur, dépositaire, exchange) et ses limites.`,
    `Rédiger un rapport qui sépare flux directs, conversions, liens indirects et rapprochements probabilistes.`,
  ],
  prerequisites: ['pret-garantie', 'pools-liquidite', 'privacy-pools', 'bridges'],
  practice: ['lending-garantie', 'lp-blanchiment', 'bridge-validateurs'],
  blocks: [
    {
      type: 'text',
      md: `Le 6 mai 2026 à 03:14 UTC, la clé d'un portefeuille chaud de **Velin Exchange**, plateforme fictive, est compromise : **2 400 000 USDT** et **600 ETH** sortent, soit 4 200 000 $ au cours de 3 000 $ l'ETH. Quand l'équipe de sécurité de Velin alerte les enquêteurs, à 04:50, les USDT ont déjà été échangés. Trente jours plus tard, l'analyste a devant lui près de neuf cents transactions sur trois chaînes, un protocole de prêt, deux pools de liquidité, un pool de confidentialité, un bridge, deux exchanges et un desk OTC.

Aucune de ces briques n'est nouvelle : chacune a fait l'objet d'une leçon. Ce qui fait la difficulté du blanchiment par la DeFi, c'est leur **combinaison**, la **vitesse** des premières heures et la tentation, face au volume, de s'en remettre à un résultat d'outil sans en connaître les hypothèses. Cette leçon donne une méthode d'ensemble ; le cas Velin est résolu pas à pas plus bas.`,
    },
    { type: 'heading', text: 'Pourquoi la DeFi attire les blanchisseurs, et pourquoi elle les trahit' },
    {
      type: 'compare',
      left: {
        title: 'Ce qui attire',
        md: `- **Aucune vérification d'identité** pour utiliser les contrats.
- **Liquidité profonde** : des millions convertis en une transaction.
- **Composabilité** : swap, enveloppe, dépôt et emprunt enchaînés en un seul appel.
- **Conversions qui coupent les flux apparents** : réserves communes, jetons de reçu, garanties.
- **Pas d'opérateur** à requérir, ni de bouton de gel sur la plupart des contrats.`,
      },
      right: {
        title: 'Ce qui trahit',
        md: `- **Tout est public et définitif** : appels décodables, événements, positions.
- Les conversions laissent des **événements explicites** (Supply, Borrow, Mint, Burn) qui relient les adresses.
- Les **jetons de reçu** et les positions désignent un titulaire.
- Il faut du **gaz** : chaque adresse neuve a été financée par quelqu'un.
- Tôt ou tard, il faut une **sortie** : exchange, OTC, échangeur, émetteur de stablecoin.`,
      },
    },
    { type: 'heading', text: 'La boîte à outils, et ce que chaque outil casse' },
    {
      type: 'table',
      caption: 'Briques de blanchiment et réponses de l’analyste',
      headers: ['Technique', 'Objectif du blanchisseur', 'Ce que voit une analyse naïve', 'Comment reconstituer'],
      rows: [
        ['Swap hors des jetons gelables (USDT, USDC → ETH, DAI)', 'Échapper au gel de l’émetteur', 'Des USDT « envoyés à un pool »', 'Conversion à valeur égale ; agir dans les minutes qui suivent le vol'],
        ['Agrégateur, routeur', 'Multiplier les pools et les jambes en un seul appel', 'Des dizaines de transferts illisibles', 'Entrée initiale, sortie finale, bénéficiaire désigné dans l’appel'],
        ['Enveloppe (WETH, WBTC)', 'Changer d’actif, préparer un dépôt', 'Des ETH « partis chez WETH »', 'Conversion 1:1 ; Deposit / Withdrawal'],
        ['Garantie et emprunt', 'Obtenir des liquidités « neuves » sans historique', 'Fonds « immobilisés dans Aave » ; emprunt d’apparence propre', 'Même compte (Supply / Borrow), aTokens détenus, lien indirect de garantie'],
        ['Parts LP cédées', 'Faire encaisser par une adresse « propre »', 'Un jeton de pool sans prix, puis des fonds « venus du pool »', 'Transfer LP, Burn (champ to), valeur égale'],
        ['Bridge', 'Changer de chaîne, souvent vers un actif non gelable', 'Des fonds « verrouillés dans un contrat »', 'Événement de départ, nonce, exécution à l’arrivée'],
        ['Pool de confidentialité', 'Rompre le lien déposant / retrait', 'Fonds « dans Tornado »', 'Démixage probabiliste : montants, délais, gaz, erreurs d’usage'],
        ['Échangeur instantané', 'Changer d’actif et de chaîne sans compte', 'Fonds « arrivés chez un service »', 'Rapprochement montant / délai, puis réquisition'],
      ],
    },
    { type: 'heading', text: 'Les enchaînements typiques' },
    {
      type: 'steps',
      items: [
        { title: 'Le hack de protocole ou de plateforme', md: `Jetons volés → swaps en ETH dans les minutes (avant tout gel) → fractionnement → pool de confidentialité et bridges → conversion en BTC → OTC ou échangeurs. Vitesse maximale, peu de DeFi « sophistiquée » : l'enjeu est de geler pendant les premières heures (voir la leçon sur les hacks DeFi).` },
        { title: 'L’escroquerie en stablecoins', md: `USDT reçus des victimes → échange immédiat en ETH ou DAI → dépôt en garantie → emprunt d'USDC « neufs » → exchange. Le blanchisseur récupère un stablecoin, mais sans historique apparent.` },
        { title: 'Le blanchiment lent', md: `Apport à un pool de liquidité → cession des parts à des adresses neuves → retraits échelonnés, parfois sur un seul actif (Curve) → bridge vers une autre chaîne. Peu de transactions, des délais longs, des montants qui ne se ressemblent plus.` },
        { title: 'La combinaison', md: `Les trois à la fois, sur des branches parallèles, comme dans le cas Velin : chaque branche exige sa propre lecture, et le rapport doit les réunir sans additionner ce qui ne s'additionne pas.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Les signaux d’alerte : un faisceau, jamais un indice isolé',
      md: `- Échange d'un stablecoin gelable **dans les minutes** qui suivent sa réception.
- Dépôt en garantie suivi d'un **emprunt quasi immédiat**, proche de la LTV maximale, par une adresse sans activité DeFi antérieure.
- Adresses **neuves** dont le gaz provient d'un retrait de pool de confidentialité ou d'un échangeur instantané.
- Transferts de **jetons de reçu** ou de **parts LP** vers des adresses neuves.
- Retraits et emprunts dont le **destinataire** (to, onBehalfOf, recipient) diffère du signataire.
- **Garantie abandonnée** ou liquidation subie sans réaction : le blanchisseur a déjà obtenu ce qu'il voulait.
- Allers-retours entre chaînes **sans logique économique** (frais élevés, retour au même actif).

Chacun de ces comportements existe chez des utilisateurs légitimes. C'est leur **accumulation**, sur des fonds dont l'origine illicite est établie, qui fait le signal.`,
    },
    { type: 'heading', text: 'L’ordre d’analyse' },
    {
      type: 'steps',
      items: [
        { title: '1. Figer la source', md: `Hash, adresses, actifs, montants, horodatage UTC, cours retenu et sa source. Une erreur ici fausse tout le reste, de manière parfaitement cohérente.` },
        { title: '2. Inventorier ce qui est gelable, maintenant', md: `USDC et USDT encore détenus (demande à l'émetteur), fonds arrivés ou en route vers un exchange (alerte et demande de gel), WBTC sur le point d'être racheté. Diffuser les adresses aux plateformes. Cette étape passe avant toute analyse fine.` },
        { title: '3. Décoder et classer chaque transaction', md: `Appel, événements, transactions internes. Classer : **transfert**, **conversion** (swap, enveloppe, dépôt, ajout ou retrait de liquidité), **lien indirect** (emprunt garanti), **sortie de chaîne** (bridge, échangeur), **rupture probabiliste** (pool de confidentialité).` },
        { title: '4. Reconstituer le graphe économique', md: `Positions ouvertes (aTokens, dettes, parts LP), cessions de jetons de reçu, dénouements (remboursement, retrait, liquidation). Le graphe des flux ne suffit pas : il faut celui des **créances**.` },
        { title: '5. Choisir la méthode et calculer', md: `Annoncer la méthode, l'option de suivi des garanties, la profondeur, le seuil ; comparer les méthodes sur les branches décisives.` },
        { title: '6. Corroborer et requérir', md: `Réquisitions aux sorties, financement du gaz, recoupements entre branches (mêmes services, mêmes horaires, mêmes erreurs).` },
        { title: '7. Rédiger', md: `Séparer constatations, inférences, liens indirects et rapprochements probabilistes ; dire les limites.` },
      ],
    },
    { type: 'heading', text: 'Choisir la méthode de traçage, et la justifier' },
    {
      type: 'table',
      caption: 'Méthodes de répartition : usage et justification',
      headers: ['Méthode', 'Quand la retenir', 'Justification à écrire', 'Risque de contestation'],
      rows: [
        ['Contamination totale (poison)', 'Délimiter le périmètre maximal, fonder une alerte ou un gel conservatoire', 'Recherche exhaustive de toutes les destinations possibles', 'Ne chiffre jamais un préjudice ; surestime massivement'],
        ['Prorata (haircut)', 'Adresses et positions qui mélangent fonds marqués et autres fonds (pools, garanties mixtes)', 'Neutre, sans hypothèse sur l’ordre des fonds ; reproductible', 'Dilution : chaque mélange réduit la part marquée'],
        ['FIFO', 'Adresses à forte rotation, raisonnement comptable', 'Convention comptable usuelle ; le droit anglais applique une règle d’imputation comparable aux comptes courants (Clayton’s Case)', 'Défavorable si l’adresse détenait déjà des fonds propres'],
        ['LIFO', 'Fonds qui transitent très vite sur une adresse de passage', 'Suit au plus près un transit rapide ; à motiver par la chronologie', 'Moins courante, doit être argumentée'],
        ['Suivi des garanties (option)', 'Emprunts adossés à des jetons de reçu marqués', 'Lien économique démontré par les événements et la position', 'Lien indirect : à présenter à part, jamais additionné'],
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Ce que dit le droit, et ce qu’il ne dit pas',
      md: `Le droit français n'impose **aucune méthode de traçage** : c'est un choix technique que l'analyste ou l'expert doit motiver, et qui se discute contradictoirement. Trois textes structurent l'usage du résultat :

- le blanchiment (article 324-1 du Code pénal) vise notamment le concours apporté à une opération de **placement, de dissimulation ou de conversion** : swaps, dépôts en garantie et cessions de parts en sont la description matérielle ;
- l'article 324-1-1 du Code pénal présume l'origine illicite des biens lorsque les conditions de l'opération **ne peuvent avoir d'autre justification que de dissimuler** cette origine : une chaîne d'opérations coûteuses et sans logique économique est un élément à documenter précisément ;
- la confiscation peut porter sur le produit **direct ou indirect** et s'exécuter **en valeur** (article 131-21 du Code pénal), ce qui rend utiles les liens indirects correctement établis (à apprécier par le magistrat).

En pratique : chiffrer le préjudice avec une méthode prudente (prorata ou FIFO), délimiter le périmètre en poison, montrer la comparaison, et ne jamais choisir la méthode qui « donne le meilleur résultat » sans le dire.`,
    },
    {
      type: 'widget',
      id: 'risk-exposure',
      caption: `Exposition directe ou indirecte : une adresse qui reçoit des USDC empruntés n'est exposée directement qu'au protocole de prêt. C'est ce que voit le filtrage d'une plateforme, d'où l'importance de lui signaler le lien de garantie.`,
    },
    { type: 'heading', text: 'Ce que l’on peut obtenir par réquisition' },
    {
      type: 'table',
      caption: 'Cibles de réquisition dans une affaire DeFi (contenu et durée de conservation à vérifier au cas par cas)',
      headers: ['Cible', 'Données possibles', 'Limites'],
      rows: [
        ['Contrats et protocoles (pools, Aave, Uniswap)', 'Aucune : tout est déjà on-chain', 'Pas d’opérateur des contrats ; les développeurs ne détiennent ni fonds ni données d’usage'],
        ['Sociétés exploitant une interface web', 'Selon leur politique : adresse connectée, horodatage, adresse IP, résultats de filtrage (screening)', 'Souvent hors UE ; conservation courte ; l’utilisateur peut passer par une autre interface ou appeler le contrat directement'],
        ['Fournisseurs RPC (par exemple celui configuré par défaut dans un portefeuille)', 'Selon leur politique : adresse IP et adresse émettrice lors de l’envoi d’une transaction', 'Inopérant si l’utilisateur a son propre nœud, un RPC privé ou un VPN ; données parfois non conservées'],
        ['Agrégateurs (API)', 'Clé API de l’intégrateur, journaux de requêtes', 'Désigne souvent un portefeuille ou une application intermédiaire, pas l’utilisateur final'],
        ['Émetteurs de stablecoins (Circle, Tether)', 'Gel d’adresses ; informations sur leurs clients directs (création et rachat)', 'Ne connaissent pas les détenteurs on-chain ordinaires'],
        ['Dépositaire et marchands WBTC', 'Identité des marchands et de leurs clients lors des créations et rachats', 'Aucune information sur les WBTC qui circulent entre portefeuilles'],
        ['Opérateurs de bridges et relais', 'Selon l’architecture : journaux, identité de l’utilisateur si un compte existe, pause du bridge', 'Bridges décentralisés : rien de plus que les événements'],
        ['Exchanges, échangeurs instantanés, OTC', 'Identité, documents, IP, appareils, historique, autres adresses, comptes liés', 'C’est là que se trouvent l’essentiel des données d’identification'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une connexion n’est pas un contrôle des clés',
      md: `Une réponse « telle adresse s'est connectée à notre interface depuis telle IP » prouve une **connexion**, pas la signature des transactions ni la détention des clés. Ces données sont précieuses pour orienter (recoupement avec une ligne, un abonnement, un appareil saisi) ; elles doivent être corroborées avant de fonder une imputation.`,
    },
    { type: 'heading', text: 'Les gels : émetteurs, plateformes, protocoles' },
    {
      type: 'text',
      md: `- **Émetteurs de stablecoins** : USDC et USDT encore détenus sont gelables par adresse, sur chaque chaîne où l'émetteur contrôle le contrat. C'est la raison pour laquelle les blanchisseurs en sortent dans les minutes qui suivent un vol.
- **Plateformes** : un exchange ou un échangeur qui reçoit des fonds signalés peut bloquer le compte ou la transaction ; l'alerte doit précéder l'arrivée des fonds.
- **Protocoles** : une gouvernance peut geler ou suspendre une **réserve** ou un **marché**, presque jamais une adresse ; certaines interfaces refusent les adresses signalées, sans effet sur les appels directs aux contrats.
- **Sanctions** : l'inscription de Tornado Cash sur la liste de l'OFAC, en août 2022, a conduit Circle à geler environ 75 000 USDC détenus par les adresses désignées. Ces sanctions ont été levées en mars 2025, après une décision d'une cour d'appel fédérale américaine (5e circuit, novembre 2024) jugeant que des contrats immuables ne constituent pas des « biens » au sens du régime de sanctions (à vérifier pour la portée exacte). La leçon pour l'enquêteur : le cadre évolue, vérifiez-le à la date des faits.`,
    },
    {
      type: 'flow',
      caption: `Affaire Velin (fictive) : trois branches parallèles à partir de l'adresse du pirate. En pointillé, le lien indirect de garantie et les rapprochements probabilistes.`,
      nodes: [
        { id: 'velin', label: 'Velin Exchange', kind: 'victim', sub: 'portefeuille chaud' },
        { id: 'h0', label: 'Pirate H0', kind: 'suspect', sub: '1 398 ETH après swap' },
        { id: 'aave', label: 'Aave v3', kind: 'contract', sub: 'A1 : 500 ETH en garantie' },
        { id: 'a2', label: 'A2', kind: 'wallet', sub: '900 000 USDC empruntés' },
        { id: 'cex', label: 'Exchanges K et N', kind: 'exchange', sub: 'dépôts USDC puis ETH' },
        { id: 'lp', label: 'Pool DAI/WETH', kind: 'dex', sub: 'L1 : parts cédées à B1' },
        { id: 'otc', label: 'Marlin OTC', kind: 'service', sub: '471 964 DAI' },
        { id: 'br', label: 'Bridge', kind: 'bridge', sub: '143,02 ETH vers BTC' },
        { id: 'tc', label: 'Pool de confidentialité', kind: 'mixer', sub: 'P1 : 5 × 100 ETH' },
      ],
      edges: [
        { from: 'velin', to: 'h0', label: '2,4 M USDT + 600 ETH' },
        { from: 'h0', to: 'aave', label: '500 ETH' },
        { from: 'aave', to: 'a2', label: 'emprunt (lien indirect)', dashed: true },
        { from: 'a2', to: 'cex', label: '780 000 USDC' },
        { from: 'aave', to: 'cex', label: 'J+30 : 500,6 ETH via A3' },
        { from: 'h0', to: 'lp', label: '301 ETH (dont 151 en DAI)' },
        { from: 'lp', to: 'otc', label: 'B1 : DAI retirés' },
        { from: 'lp', to: 'br', label: 'B1 : ETH retirés' },
        { from: 'h0', to: 'tc', label: '500 ETH' },
        { from: 'tc', to: 'br', label: '2 retraits rapprochés', dashed: true },
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — l’affaire Velin, chiffrée',
      md: `**J0, 03:14 UTC.** Sortie de 2 400 000 USDT et 600 ETH vers H0. Cours retenu pour toute la journée : 3 000 $ l'ETH (source à citer).

**03:31.** Swap agrégé de 2 400 000 USDT en **798 ETH** (perte de conversion : 6 000 $). La demande de gel adressée à Tether à 04:50 arrive trop tard : H0 ne détient plus d'USDT. H0 répartit ses 1 398 ETH : 500 vers A1, 301 vers L1, 597 vers P1.

**Branche « garantie ».** 05:02 : A1 dépose 500 ETH sur Aave (500 aEthWETH). 05:09 : A1 emprunte **900 000 USDC** (LTV 60 %) et les envoie à A2. A2 dépose 450 000 USDC chez l'exchange K et 330 000 chez l'exchange N. À 10:00, 120 000 USDC sont encore sur A2 : demande de gel à Circle à 10:30, **inscription d'A2 sur la liste noire à 14:20**. À J+30, R1 rembourse 903 700 USDC (\`repayer = R1\`) ; R1 a été financé la veille par un retrait de l'exchange N, depuis un **second compte** ouvert au nom d'un prête-nom. A1 retire alors 500,6 WETH (\`to = A3\`), désenveloppés puis déposés chez K : alertée depuis J0, la plateforme **gèle les 500,6 ETH**.

**Branche « liquidité ».** 06:15 : L1 échange 151 ETH contre 450 000 DAI (perte : 3 000 $), puis apporte 150 ETH et 450 000 DAI au pool DAI/WETH. J+2 : les parts sont cédées à B1, dont le gaz provient d'un échangeur instantané. J+9 (ETH à 3 300 $) : B1 retire **143,02 ETH et 471 964 DAI** (943 930 $). Les DAI partent chez **Marlin OTC** (desk attribué, hors UE) ; les ETH passent par un bridge à validateurs et ressortent en BTC.

**Branche « confidentialité ».** P1 dépose 500 ETH (cinq dépôts de 100 ETH) dans un pool de confidentialité et conserve **97 ETH**. Entre J+3 et J+21, cinq retraits de 100 ETH vers des adresses neuves ; deux d'entre eux (200 ETH) sont rapprochés avec une **confiance moyenne** : délais, montants, et gaz fourni par le même échangeur instantané que B1. Ces deux adresses alimentent le même bridge que B1.`,
    },
    {
      type: 'table',
      caption: `Affaire Velin — tableau de synthèse (méthode prorata, suivi des garanties activé ; valeurs au cours de J0 sauf mention)`,
      headers: ['Destination ou situation', 'Nature du lien', 'Montant', 'Valeur', 'Suite'],
      rows: [
        ['Exchange K (dépôt d’A3, J+30)', 'Flux direct : garantie retirée', '500,6 ETH', '1 500 000 $ (+ 0,6 ETH d’intérêts)', 'Gelé ; réquisition du compte'],
        ['Pool DAI/WETH → B1', 'Flux direct : conversion, parts cédées', '143,02 ETH + 471 964 DAI', '900 000 $ apportés ; 943 930 $ au retrait (J+9)', 'Réquisitions : Marlin OTC, échangeur (gaz de B1), suivi du bridge'],
        ['Pool de confidentialité', 'Flux direct jusqu’au dépôt', '500 ETH', '1 500 000 $', 'Sorties non attribuées ; 200 ETH rapprochés (confiance moyenne)'],
        ['P1', 'Encore détenu', '97 ETH', '291 000 $', 'Surveillance ; saisie seulement avec les clés'],
        ['Frais et pertes de conversion', 'Non suivi', '—', '9 000 $', '—'],
        ['**Total des flux directs**', '', '', '**4 200 000 $**', 'Égal à la source'],
        ['USDC empruntés (A2 → K, N, gel Circle)', '**Lien indirect de garantie**', '900 000 USDC', 'Non additionné', 'K : 450 000 ; N : 330 000 ; gelés : 120 000'],
      ],
    },
    {
      type: 'check',
      q: `Dans le tableau Velin, pourquoi les 900 000 USDC empruntés ne figurent-ils pas dans le total des flux directs ?`,
      options: [
        `Parce qu'ils ont été remboursés à J+30`,
        `Parce qu'ils sont adossés à la garantie de 500 ETH, déjà comptée : les additionner reviendrait à compter deux fois la même valeur, compensée par une dette`,
        `Parce que l'USDC n'est pas un crypto-actif`,
        `Parce que Circle en a gelé une partie`,
      ],
      answer: 1,
      explain: `La garantie (flux direct, 1 500 000 $) et l'emprunt (lien indirect, 900 000 USDC) coexistent, compensés par la dette d'A1. Le lien indirect est présenté à part : il fonde des réquisitions et des gels, pas une addition au préjudice.`,
    },
    { type: 'heading', text: 'Grille de rapport' },
    {
      type: 'table',
      caption: 'Structure d’un rapport d’analyse pour une affaire de blanchiment par la DeFi',
      headers: ['Rubrique', 'Contenu attendu', 'Exemple (affaire Velin)'],
      rows: [
        ['Source et périmètre', 'Transactions d’origine, actifs, montants, cours et source du cours, date de situation', '2 400 000 USDT + 600 ETH, J0 03:14 UTC, 3 000 $/ETH'],
        ['Méthode et paramètres', 'Méthode de répartition, suivi des garanties, profondeur, seuil, comparaison des méthodes', 'Prorata ; garanties suivies ; comparaison FIFO sans effet sur les destinations'],
        ['Conversions', 'Pour chacune : contrat, appel décodé, événements, taux, pertes', 'Swap agrégé USDT → ETH ; dépôt Aave ; apport et retrait de liquidité'],
        ['Liens indirects', 'Garantie → emprunt, cessions de jetons de reçu ou de parts : fondement, clé de répartition', 'Emprunt de 900 000 USDC garanti à 100 % par des aTokens marqués'],
        ['Destinations et fonds détenus', 'Services atteints, adresses de dépôt, montants ; fonds encore détenus', 'K, N, Marlin OTC ; 97 ETH sur P1'],
        ['Non suivi', 'Frais, seuil, profondeur, sorties non attribuées', '9 000 $ de pertes ; 300 ETH de retraits non rapprochés'],
        ['Rapprochements probabilistes', 'Méthode, nombre de candidats, écarts, niveau de confiance', '2 retraits rapprochés, confiance moyenne'],
        ['Actions conservatoires et réquisitions', 'Gels obtenus, demandes en cours, cibles et voies', 'Gel Circle (120 000 USDC) ; gel K (500,6 ETH) ; réquisitions N, échangeur, OTC'],
        ['Limites et hypothèses', 'Ce qui est inféré, ce qui peut être contesté, ce qui reste ouvert', 'Clé de répartition de la garantie ; démixage ; attribution de Marlin OTC'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Dans l’espace d’enquête SPECTRA',
      md: `Travaillez branche par branche : pour chaque transaction décisive, l'inspecteur donne l'**appel décodé**, les **journaux d'événements** et les **transactions internes** ; l'outil **« Traçage des fonds »** convertit à valeur égale à travers pools, routeurs, agrégateurs, enveloppes et pools de prêt, et liste à part les **liens de garantie**. Utilisez *Comparer les méthodes* sur les branches où un mélange existe, et vérifiez la règle de conservation **sur les seuls flux directs** : les liens indirects la dépassent par construction.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Les limites à écrire noir sur blanc',
      md: `- La part marquée d'un emprunt repose sur une **clé de répartition** conventionnelle.
- Un retrait de pool de liquidité ne rend pas « les mêmes fonds » : il rend une **valeur** à une date.
- Un rapprochement de pool de confidentialité est **probabiliste** : nombre de candidats, écarts, confiance.
- Une attribution (OTC, échangeur) a une **source** et une **date**.
- Les données d'interface ou de RPC prouvent une **connexion**, pas un contrôle des clés.

Un rapport qui énonce ses limites résiste mieux à la contradiction qu'un rapport qui les tait.`,
    },
  ],
  keyPoints: [
    `Le blanchiment par la DeFi combine des briques connues (swap hors des jetons gelables, enveloppe, garantie et emprunt, parts LP cédées, bridge, pool de confidentialité) : chacune casse une lecture naïve, aucune ne rend la trace invisible.`,
    `L'ordre d'analyse commence par ce qui est gelable maintenant (stablecoins, exchanges), puis reconstitue le graphe des créances (positions, jetons de reçu, dettes), pas seulement celui des flux.`,
    `La méthode de traçage n'est imposée par aucun texte : elle se choisit, se justifie et se compare ; poison délimite, prorata ou FIFO chiffrent.`,
    `Les liens indirects (garantie → emprunt) se présentent à part : ils fondent gels et réquisitions, jamais une addition au préjudice.`,
    `Les réquisitions utiles visent surtout les sorties (exchanges, OTC, échangeurs) ; interfaces, RPC et agrégateurs fournissent des données limitées, qui prouvent une connexion, pas un contrôle des clés.`,
    `Les émetteurs gèlent des adresses, les plateformes des comptes, les protocoles au mieux des réserves entières : agir avant les conversions.`,
    `Un rapport solide sépare constatations, conversions, liens indirects et rapprochements probabilistes, et énonce ses limites.`,
  ],
  quiz: [
    {
      q: `Un pirate reçoit 3 millions d'USDT volés. Quelle est la toute première action de l'analyste ?`,
      options: [
        `Reconstituer l'intégralité du graphe avant toute démarche`,
        `Vérifier si les USDT sont encore détenus et, le cas échéant, adresser immédiatement une demande de gel à Tether, puis alerter les plateformes`,
        `Requérir Uniswap`,
        `Choisir la méthode de traçage`,
      ],
      answer: 1,
      explain: `Les blanchisseurs sortent des jetons gelables dans les minutes qui suivent le vol. L'inventaire de ce qui est gelable passe avant l'analyse fine.`,
    },
    {
      kind: 'multi',
      q: `Quelles opérations constituent des conversions à tracer à valeur égale ? (plusieurs réponses)`,
      options: [
        `Un swap USDT → ETH via un agrégateur`,
        `Un dépôt de WETH dans Aave contre des aTokens`,
        `Un emprunt d'USDC garanti par des aTokens marqués`,
        `Un retrait de liquidité qui détruit des parts LP`,
      ],
      answer: [0, 1, 3],
      explain: `Swap, dépôt contre jeton de reçu et retrait de liquidité sont des conversions. L'emprunt n'est pas une conversion des fonds marqués : c'est un lien indirect, économique, à présenter à part.`,
    },
    {
      q: `Quelle méthode retenir pour chiffrer le préjudice transitant par une adresse qui mêle fonds de la victime et fonds d'autres origines ?`,
      options: [
        `Contamination totale (poison), pour ne rien manquer`,
        `Une méthode prudente et reproductible (prorata, ou FIFO motivé), annoncée et comparée aux autres`,
        `La méthode qui donne le montant le plus élevé`,
        `Aucune : le préjudice ne peut pas être chiffré`,
      ],
      answer: 1,
      explain: `Poison délimite un périmètre, il ne chiffre jamais un préjudice. La méthode retenue doit être motivée et comparée : un choix opportuniste, non annoncé, offrirait une prise évidente à la contestation.`,
    },
    {
      kind: 'truefalse',
      q: `Le droit français impose la méthode FIFO pour le traçage des crypto-actifs en matière pénale.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Aucun texte n'impose de méthode. Le choix est technique, doit être motivé et peut être discuté contradictoirement. Le droit anglais connaît une règle d'imputation comparable au FIFO pour les comptes courants (Clayton's Case), qui n'a pas de valeur en droit français.`,
    },
    {
      q: `Une société qui exploite l'interface web d'un DEX répond à une réquisition : l'adresse suspecte s'est connectée depuis telle IP. Que vaut cette information ?`,
      options: [
        `Elle prouve que le titulaire de l'IP a signé les transactions`,
        `Elle établit une connexion à l'interface, utile pour orienter l'enquête, mais doit être corroborée avant toute imputation`,
        `Elle est sans valeur`,
        `Elle permet de geler les fonds`,
      ],
      answer: 1,
      explain: `Une connexion n'est pas un contrôle des clés : l'utilisateur peut aussi passer par une autre interface ou appeler directement le contrat. L'information oriente ; elle se recoupe (ligne, abonnement, appareil saisi).`,
    },
    {
      kind: 'multi',
      q: `Quels acteurs peuvent geler des fonds par adresse ou par compte ? (plusieurs réponses)`,
      options: [
        `Circle, pour l'USDC détenu par une adresse`,
        `Un exchange, pour le compte crédité`,
        `La gouvernance d'Aave, pour la position d'une adresse précise`,
        `Tether, pour l'USDT détenu par une adresse`,
      ],
      answer: [0, 1, 3],
      explain: `Les émetteurs gèlent des adresses, les plateformes des comptes. Une gouvernance de protocole peut geler ou suspendre une réserve entière, pas la position d'une adresse.`,
    },
    {
      q: `Dans l'affaire Velin, quel élément a permis de relier le remboursement du prêt à un compte identifiable ?`,
      options: [
        `Le champ to de l'événement Withdraw`,
        `Le champ repayer de l'événement Repay, désignant R1, financé la veille par un retrait de l'exchange N`,
        `Le prix de l'ETH à J+30`,
        `Le nombre de retraits du pool de confidentialité`,
      ],
      answer: 1,
      explain: `Le payeur du remboursement (R1) a été financé par un retrait d'exchange : la réquisition vise un compte qui a financé le dénouement de l'opération. Le champ to, lui, a désigné A3, bénéficiaire de la garantie restituée.`,
    },
    {
      kind: 'truefalse',
      q: `Dans le tableau de synthèse, la somme des flux directs doit redonner la source, mais pas la somme des flux directs et des liens indirects.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `La règle de conservation s'applique aux flux directs (destinations + détenu + non suivi = source). Les liens indirects de garantie la dépassent par construction, puisque garantie et emprunt coexistent.`,
    },
    {
      q: `Deux retraits d'un pool de confidentialité sont rapprochés du déposant par les délais, les montants et un financement de gaz commun. Comment les présenter ?`,
      options: [
        `Comme des flux directs établis`,
        `Comme des rapprochements probabilistes, avec la méthode, le nombre de candidats, les écarts et un niveau de confiance`,
        `Ne pas les mentionner`,
        `Comme une preuve d'identité du déposant`,
      ],
      answer: 1,
      explain: `Un pool de confidentialité rompt le lien on-chain : tout rapprochement est une inférence statistique, à présenter comme telle et à corroborer.`,
    },
    {
      kind: 'multi',
      q: `Quels comportements, combinés sur des fonds d'origine illicite établie, constituent des signaux d'alerte de blanchiment par la DeFi ? (plusieurs réponses)`,
      options: [
        `Échange d'un stablecoin gelable dans les minutes qui suivent sa réception`,
        `Emprunt proche de la LTV maximale juste après un dépôt, par une adresse sans activité DeFi antérieure`,
        `Transfert de parts LP vers une adresse neuve financée par un échangeur instantané`,
        `Utilisation d'un DEX, en soi`,
      ],
      answer: [0, 1, 2],
      explain: `Utiliser un DEX n'a rien de suspect en soi. Les trois autres comportements, pris isolément, existent chez des utilisateurs légitimes ; leur accumulation sur des fonds illicites fait le signal.`,
    },
  ],
  flashcards: [
    { front: 'Première urgence d’une affaire DeFi', back: `Inventorier ce qui est gelable maintenant (USDC, USDT, fonds vers un exchange) et alerter émetteurs et plateformes.` },
    { front: 'Classer une transaction', back: `Transfert, conversion, lien indirect, sortie de chaîne, rupture probabiliste.` },
    { front: 'Graphe des créances', back: `Positions (aTokens, dettes, parts LP), cessions de jetons de reçu, dénouements : à reconstituer en plus du graphe des flux.` },
    { front: 'Poison', back: `Délimite le périmètre maximal (alerte, gel conservatoire) ; ne chiffre jamais un préjudice.` },
    { front: 'Méthode de traçage en droit français', back: `Aucune n'est imposée : choix technique motivé, comparé et soumis au contradictoire.` },
    { front: 'Article 324-1-1 du Code pénal', back: `Présomption d'origine illicite quand l'opération n'a d'autre justification que de dissimuler cette origine.` },
    { front: 'Article 131-21 du Code pénal', back: `Confiscation du produit direct ou indirect, et confiscation en valeur.` },
    { front: 'Réquisition d’une interface ou d’un RPC', back: `Données limitées (adresse connectée, IP) selon la politique du prestataire ; une connexion, pas un contrôle des clés.` },
    { front: 'Qui gèle quoi', back: `Émetteurs : adresses ; plateformes : comptes ; protocoles : au mieux une réserve entière.` },
    { front: 'Règle de conservation', back: `S'applique aux flux directs ; les liens indirects de garantie la dépassent par construction.` },
    { front: 'Rapprochement probabiliste', back: `Méthode, candidats, écarts, niveau de confiance ; à corroborer.` },
    { front: 'Grille de rapport DeFi', back: `Source, méthode, conversions, liens indirects, destinations, non suivi, rapprochements, actions, limites.` },
  ],
}
