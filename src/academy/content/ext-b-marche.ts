// Niveau 3 — Typologies : pump and dump et manipulation de marché.
// Jetons, canaux, promoteurs et adresses : FICTIFS. Les plateformes réelles
// (launchpads, DEX) sont décrites de manière neutre, sans imputation.
import type { Lesson } from '../model'

export const LESSON_MARCHE: Lesson = {
  id: 'manipulation-marche',
  title: 'Pump and dump et manipulation de marché',
  level: 3,
  track: 'typologies',
  minutes: 35,
  summary: `Un jeton créé en trente secondes, acheté dans le même bloc par vingt portefeuilles « indépendants », promu par des canaux et des influenceurs, puis vendu en quelques minutes sur ceux qui ont cru à la fusée. Typologies de manipulation (pump and dump, bundles, sniping, volume factice, spoofing), lecture on-chain des premiers acheteurs et des financements communs, calcul des profits, limites de la chaîne face aux carnets d'ordres centralisés, cadre juridique (MiCA, abus de marché) et recours des victimes.`,
  objectives: [
    `Décrire les phases d'un pump and dump et les rôles (développeur, initiés, promoteurs, snipers, victimes).`,
    `Reconnaître sur la chaîne les achats groupés (bundles), le financement commun des premiers acheteurs et la chronologie promotion → vente.`,
    `Calculer les profits d'un groupe de portefeuilles et les pertes des acheteurs.`,
    `Distinguer ce que la chaîne montre (DEX) de ce qu'elle ne montre pas (spoofing, wash trading sur exchange centralisé).`,
    `Situer prudemment le cadre juridique (abus de marché sous MiCA, escroquerie, influence commerciale) et orienter les victimes.`,
  ],
  prerequisites: ['dex-defi', 'rug-pulls', 'osint', 'tokens-erc20'],
  practice: ['sol-memecoin-rug', 'rugpull-bsc'],
  blocks: [
    {
      type: 'text',
      md: `Mardi, 14:03 UTC : le jeton **$FROGKING** est créé sur un launchpad Solana. À 14:30, un canal Telegram de 48 000 abonnés publie « appel du jour : la prochaine fusée ». À 14:35, trois comptes influents sur X relaient. Le prix est multiplié par 40 en une demi-heure. À 15:20, tout est fini : le cours a perdu 92 %, et près de 4 000 portefeuilles ont acheté au mauvais moment.

Ce n'est pas un rug pull au sens strict : la liquidité n'a pas été retirée. Ce sont les **premiers acheteurs**, en réalité un seul groupe, qui ont vendu sur la demande qu'ils avaient eux-mêmes provoquée. C'est un **pump and dump**, et sur un DEX, presque tout se lit sur la chaîne.`,
    },
    { type: 'heading', text: 'Les familles de manipulation' },
    {
      type: 'table',
      caption: `Typologies et visibilité on-chain`,
      headers: ['Typologie', 'Principe', 'Où', 'Visibilité on-chain'],
      rows: [
        ['Pump and dump', 'Accumuler discrètement, promouvoir, vendre sur la hausse provoquée', 'DEX surtout, parfois exchanges', 'Forte sur DEX'],
        ['Achats groupés (bundles)', 'Le créateur achète une grande part de l’offre via de nombreux portefeuilles dès la création', 'DEX, launchpads', 'Forte'],
        ['Sniping', 'Robots achetant dans les premières secondes, parfois opérés par l’équipe', 'DEX, launchpads', 'Forte (premiers blocs)'],
        ['Volume factice (wash trading)', 'Achats et ventes entre portefeuilles liés pour simuler l’activité', 'DEX et exchanges', 'Forte sur DEX, nulle sur exchange'],
        ['Spoofing / layering', 'Ordres importants placés puis annulés pour influencer le prix', 'Exchanges centralisés', 'Nulle : carnet d’ordres hors chaîne'],
        ['Opération d’initié', 'Acheter avant une annonce (cotation, partenariat) connue en avance', 'Exchanges, DEX', 'Partielle : achats datés avant l’annonce'],
        ['Diffusion d’informations fausses', 'Faux partenariat, faux audit, fausse cotation annoncée', 'Réseaux sociaux', 'Indirecte : corrélation avec les achats et ventes'],
      ],
    },
    { type: 'heading', text: 'Anatomie d’un pump and dump on-chain' },
    {
      type: 'steps',
      items: [
        { title: 'Préparation', md: `Le groupe prépare des dizaines de portefeuilles, approvisionnés depuis une même source (souvent un retrait d'exchange fractionné). Il recrute ou rémunère des promoteurs, parfois en leur donnant des jetons avant le lancement.` },
        { title: 'Création et accumulation', md: `Le jeton est créé ; dans le même bloc ou les suivants, les portefeuilles du groupe achètent une part importante de l'offre à prix plancher, en montants variés pour paraître indépendants.` },
        { title: 'Promotion', md: `Canaux Telegram d'« appels », influenceurs, faux enthousiasme sur X, captures de gains. Messages horodatés : ils serviront à établir la chronologie.` },
        { title: 'Hausse', md: `Les acheteurs attirés font monter le prix sur la courbe ou le pool. Le volume factice entre portefeuilles du groupe entretient l'illusion.` },
        { title: 'Vente (dump)', md: `Les portefeuilles du groupe vendent, souvent en quelques minutes et en tranches, dans la liquidité apportée par les victimes.` },
        { title: 'Dispersion', md: `Le produit (SOL, ETH, USDC) remonte vers quelques adresses, puis vers des exchanges, des bridges ou le prochain lancement.` },
      ],
    },
    {
      type: 'flow',
      caption: `$FROGKING : une même source finance les « premiers acheteurs » ; la vente coïncide avec le pic de la promotion.`,
      nodes: [
        { id: 'cex', label: 'Exchange', kind: 'exchange', sub: 'retrait 60 SOL' },
        { id: 'fund', label: 'Financeur', kind: 'suspect', sub: '8Hq2…xR4n' },
        { id: 'dev', label: 'Créateur du jeton', kind: 'suspect', sub: '5vNd…Kp7a' },
        { id: 'bw', label: '22 portefeuilles', kind: 'wallet', sub: 'bundle du bloc de création' },
        { id: 'pool', label: 'Courbe / pool', kind: 'dex', sub: 'launchpad puis DEX' },
        { id: 'kol', label: 'Promoteurs', kind: 'unknown', sub: 'canal + 3 comptes X' },
        { id: 'vic', label: '3 904 acheteurs', kind: 'victim' },
        { id: 'agg', label: 'Agrégation', kind: 'wallet', sub: '9tLm…Wq3c' },
      ],
      edges: [
        { from: 'cex', to: 'fund', label: '60 SOL' },
        { from: 'fund', to: 'dev', label: '3 SOL' },
        { from: 'fund', to: 'bw', label: '22 × 2,1 à 2,6 SOL' },
        { from: 'dev', to: 'kol', label: 'jetons avant l’appel', dashed: true },
        { from: 'bw', to: 'pool', label: 'achats : 41 % de l’offre' },
        { from: 'vic', to: 'pool', label: 'achats après 14:30' },
        { from: 'pool', to: 'agg', label: 'ventes : 1 846 SOL' },
      ],
    },
    { type: 'widget', id: 'amm-swap', caption: `Effet de prix : une vente massive dans un pool peu profond fait chuter le cours. Faites varier la taille de l'ordre pour mesurer l'impact du dump.` },
    { type: 'heading', text: 'Launchpads, courbes de liaison, snipers et bundles' },
    {
      type: 'text',
      md: `Les **launchpads** de memecoins (le plus connu sur Solana a popularisé ce format en 2024) permettent de créer un jeton en quelques clics. Le prix est d'abord fixé par une **courbe de liaison** (*bonding curve*) : chaque achat fait monter le prix selon une formule. Quand la capitalisation atteint un seuil, le jeton « gradue » et sa liquidité **migre vers un pool de DEX**.

Ce format a deux conséquences pour l'enquête : l'**offre initiale** est entièrement disponible à l'achat dès la création (pas de pré-vente), et les premiers acheteurs paient le prix le plus bas. Qui achète dans les tout premiers instants capte l'essentiel du gain potentiel.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Courbe de liaison', def: `Formule qui fixe le prix en fonction de la quantité déjà achetée ; le contrat vend et rachète lui-même.` },
        { term: 'Graduation (migration)', def: `Passage de la courbe à un pool de DEX lorsque la capitalisation atteint un seuil.` },
        { term: 'Bundle', def: `Groupe de transactions exécutées ensemble et dans l'ordre (sur Solana, par des services de type Jito) : création du jeton et achats de nombreux portefeuilles dans le même bloc.` },
        { term: 'Sniper', def: `Robot qui achète un jeton dès sa création ou sa mise en liquidité, dans les premiers blocs.` },
        { term: 'Portefeuille du développeur', def: `Adresse qui a créé le jeton ; ses premiers achats et ses transferts sont à examiner en priorité.` },
        { term: 'KOL', def: `« Key opinion leader » : influenceur crypto qui publie des « appels », parfois rémunéré en jetons ou en SOL.` },
        { term: 'Répartition des détenteurs', def: `Part de l'offre détenue par les principaux portefeuilles ; une concentration cachée par la dispersion entre portefeuilles liés est typique.` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Lire les premiers blocs sur Solana',
      md: `Sur Solana, un bloc (*slot*) dure environ 0,4 seconde. Relevez le **slot de création** du jeton, puis listez les acheteurs du même slot et des slots suivants. Des achats dans le **même slot que la création**, juste après elle, signent presque toujours un bundle préparé par le créateur : un robot extérieur ne connaît l'existence du jeton qu'une fois la création publiée. Vérifiez ensuite le **financement** de ces portefeuilles dans les heures précédentes.`,
    },
    {
      type: 'check',
      q: `Vingt-deux portefeuilles achètent un jeton dans le même slot que sa création, et tous ont reçu entre 2,1 et 2,6 SOL d'une même adresse 40 minutes plus tôt. Quelle conclusion est la plus solide ?`,
      options: [
        `Ce sont des snipers indépendants, plus rapides que les autres`,
        `C'est une distribution gratuite (airdrop)`,
        `C'est un bundle du créateur ou d'un groupe lié, qui dissimule une accumulation derrière de nombreux portefeuilles`,
        `C'est une migration vers un DEX`,
      ],
      answer: 2,
      explain: `Le même slot que la création et un financement commun récent relient ces portefeuilles à une seule entité. La dispersion sert à masquer la concentration de l'offre.`,
    },
    { type: 'heading', text: 'Le volume factice' },
    {
      type: 'text',
      md: `Le volume est l'indicateur que regardent les agrégateurs et les acheteurs. Pour le gonfler, le groupe fait tourner les mêmes fonds entre ses portefeuilles : achat par A, vente par A, achat par B, etc., souvent par robot, à intervalles réguliers et pour des montants proches.

Sur un **DEX**, ce volume se démontre comme un wash trading de NFT : financement commun, solde net proche de zéro pour chaque portefeuille hors frais, régularité mécanique des ordres. Sur un **exchange centralisé**, les échanges entre comptes d'un même client ne laissent **aucune trace on-chain** : seules les données de l'exchange (comptes, ordres, IP, clés d'API) permettent de le démontrer.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Ce que la chaîne montre (DEX)',
        md: `- Chaque achat et vente, avec portefeuille, montant, prix et horodatage.
- Le financement de chaque portefeuille et la destination des profits.
- Les liens entre créateur, premiers acheteurs et promoteurs payés on-chain.
- Le calcul exact des gains et des pertes.`,
      },
      right: {
        title: 'Ce qu’elle ne montre pas (exchange centralisé)',
        md: `- Les **ordres** placés puis annulés (spoofing, layering) : le carnet d'ordres est hors chaîne.
- Les échanges entre deux comptes du même client.
- L'identité derrière les comptes et leurs connexions.

Seule une **réquisition** à l'exchange (historique d'ordres, annulations, comptes liés, IP, clés d'API) permet de les établir.`,
      },
    },
    { type: 'heading', text: 'Prouver la manipulation on-chain' },
    {
      type: 'steps',
      items: [
        { title: 'Fixer l’objet', md: `Adresse du jeton (mint sur Solana, contrat sur EVM), créateur, slot ou bloc de création, pool et date de graduation éventuelle.` },
        { title: 'Lister les premiers acheteurs', md: `Acheteurs des premiers slots ou blocs, part de l'offre acquise, prix moyen. Distinguez snipers connus (robots actifs sur des centaines de jetons) et portefeuilles créés pour l'occasion.` },
        { title: 'Remonter les financements', md: `Origine des fonds de chaque premier acheteur : même financeur, même retrait d'exchange fractionné, transferts de la part du créateur.` },
        { title: 'Établir la chronologie', md: `Superposez les achats, les messages de promotion (horodatage des canaux et des publications) et les ventes. Une vente du groupe dans les minutes qui suivent le pic de promotion est un indice fort de coordination.` },
        { title: 'Relier les promoteurs', md: `Transferts de jetons ou de SOL du créateur ou du financeur vers des adresses publiées par les promoteurs (dans leur biographie, leurs messages, leurs domaines).` },
        { title: 'Calculer les profits et les pertes', md: `Pour chaque portefeuille du groupe : actif reçu des ventes − actif dépensé à l'achat − frais. Pour les victimes : pertes nettes au moment de la plainte, avec la méthode de valorisation.` },
        { title: 'Suivre le produit', md: `Agrégation, puis exchanges, bridges ou nouveaux lancements : c'est là que se jouent identification et saisie.` },
      ],
    },
    {
      type: 'table',
      caption: `Profits du groupe sur $FROGKING (extrait, en SOL)`,
      headers: ['Portefeuille', 'Achat', 'Ventes', 'Frais', 'Résultat net'],
      rows: [
        ['Créateur 5vNd…Kp7a', '1,5', '96,2', '0,4', '+94,3'],
        ['Bundle n° 1 (2Fk8…eT1s)', '2,4', '88,1', '0,3', '+85,4'],
        ['Bundle n° 2 (Cw3R…9mJd)', '2,2', '81,7', '0,3', '+79,2'],
        ['… 19 autres portefeuilles du bundle', '42,9', '1 580,0', '6,1', '+1 531,0'],
        ['Total du groupe (23 portefeuilles)', '49,0', '1 846,0', '7,1', '+1 789,9'],
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — $FROGKING',
      md: `Plainte collective de 37 acheteurs. Éléments établis :

- **13:22 UTC** : un retrait de 60 SOL d'un exchange arrive sur \`8Hq2tVb6pYc1LwRk9sNe3fGm7dJz4QuA5hXo2CiKxR4n\` (le financeur).
- **13:24 à 13:31** : le financeur envoie 3 SOL au futur créateur et 2,1 à 2,6 SOL à 22 portefeuilles neufs.
- **13:55** : le créateur transfère des jetons d'un précédent lancement à trois adresses figurant dans la biographie de trois influenceurs.
- **14:03:11** : création de $FROGKING ; dans le même slot, les 22 portefeuilles achètent **41 % de l'offre** pour 47,5 SOL au total.
- **14:30** : appel du canal « Alpha Moon Calls » ; **14:31 à 14:40** : publications des trois influenceurs.
- **15:02 à 15:20** : les 22 portefeuilles et le créateur vendent tout pour **1 846 SOL**, regroupés sur \`9tLmEa3vQ8Rz1KdYp5cNw7Hj2BsXf6Ug4oTiWq3c\`.
- **16:05** : 1 700 SOL partent vers une adresse de dépôt du même exchange que le retrait initial.

Lecture : un seul groupe a acheté au prix plancher par un bundle, la promotion a été préparée (paiement des promoteurs 8 minutes avant la création), la vente a suivi le pic de promotion. Actes : réquisition à l'exchange (titulaire du retrait initial et du dépôt final, IP, autres comptes liés), identification des administrateurs du canal et des titulaires des comptes promoteurs, constatations horodatées des publications, chiffrage des pertes des plaignants.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Corrélation n’est pas coordination',
      md: `Des robots de sniping indépendants achètent tous les nouveaux jetons ; des traders opportunistes vendent tous au premier pic. Un achat précoce ou une vente rapide ne suffit pas. La démonstration repose sur un **faisceau** : financement commun, même slot que la création, liens avec les promoteurs, synchronisme de la vente, destination commune des profits. Présentez aussi ce qui **ne** relie pas certains portefeuilles : c'est la meilleure garantie contre la contestation.`,
    },
    { type: 'heading', text: 'Cadre juridique : avancer avec prudence' },
    {
      type: 'callout',
      kind: 'law',
      title: 'Abus de marché sous MiCA et autres qualifications',
      md: `Le règlement **MiCA** (règlement (UE) 2023/1114) consacre un titre à la prévention et à l'interdiction des **abus de marché** relatifs aux crypto-actifs (articles 86 à 92 : informations privilégiées, opérations d'initiés, divulgation illicite, **manipulation de marché**), applicable depuis le 30 décembre 2024. Son champ vise les crypto-actifs **admis à la négociation**, ou dont l'admission a été demandée, sur une plateforme de négociation exploitée par un prestataire agréé : un memecoin échangé uniquement sur un DEX peut donc **sortir de ce champ**. En France, l'AMF est l'autorité compétente ; le régime des sanctions (administratives, et le cas échéant pénales) est à vérifier dans les textes d'adaptation en vigueur.

Selon les faits, d'autres qualifications peuvent être examinées avec le parquet : **escroquerie** (art. 313-1 du code pénal) et escroquerie en bande organisée lorsque des manœuvres (fausses annonces, volume factice, promoteurs rémunérés dissimulés) ont déterminé les achats ; **blanchiment** du produit ; manquements aux règles encadrant l'**influence commerciale** (loi du 9 juin 2023, qui restreint la promotion des crypto-actifs par les influenceurs). Vérifiez systématiquement les textes à la date des faits.`,
    },
    {
      type: 'check',
      q: `Un memecoin n'a jamais été coté sur une plateforme de négociation agréée ; il ne s'échange que sur un DEX. Que peut-on dire des dispositions de MiCA sur les abus de marché ?`,
      options: [
        `Leur application est douteuse, car leur champ vise les actifs admis (ou en demande d'admission) sur une plateforme exploitée par un prestataire agréé ; d'autres qualifications sont à examiner`,
        `Elles s'appliquent toujours, à tout crypto-actif`,
        `Elles ne s'appliqueront qu'en 2030`,
        `Elles imposent au DEX de rembourser les victimes`,
      ],
      answer: 0,
      explain: `Le champ des articles 86 à 92 est lié à l'admission à la négociation sur une plateforme agréée. Hors de ce champ, l'escroquerie et le blanchiment restent les pistes principales, à apprécier selon les manœuvres établies.`,
    },
    {
      type: 'text',
      md: `**Les victimes** doivent être orientées sans fausse promesse :

- déposer plainte en fournissant les hashes de leurs achats et ventes, les captures des messages de promotion qui les ont décidées, et l'adresse de leur portefeuille ;
- se constituer partie civile pour faire valoir leur préjudice si des auteurs sont identifiés et des avoirs saisis ;
- signaler les canaux et promoteurs à l'AMF et aux plateformes concernées ;
- se méfier des « services de récupération » qui les contacteront.

Leur préjudice se calcule comme une **position nette** : sommes dépensées à l'achat moins sommes récupérées en vendant, à valoriser selon une méthode explicite (cours à la date de chaque opération).`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Figer la promotion avant qu’elle disparaisse',
      md: `Les canaux d'appels suppriment souvent leurs messages après le dump, et les influenceurs effacent leurs publications. Constatez au plus tôt : captures horodatées, liens directs vers les messages, identifiants numériques des canaux et comptes, archives. Pour la chronologie, l'horodatage des messages doit être rapproché de l'heure **UTC** des blocs.`,
    },
  ],
  keyPoints: [
    `Pump and dump : accumulation discrète par portefeuilles liés, promotion coordonnée, vente sur la demande provoquée, dispersion.`,
    `Sur les launchpads, des achats dans le même slot que la création et un financement commun signent un bundle du créateur.`,
    `La preuve repose sur un faisceau : financement commun, chronologie achats → promotion → ventes, paiements aux promoteurs, destination commune des profits.`,
    `Profits = ventes − achats − frais par portefeuille du groupe ; préjudice des victimes = position nette valorisée.`,
    `Spoofing et wash trading sur exchange centralisé sont invisibles on-chain : réquisition des ordres, comptes, IP et clés d'API.`,
    `MiCA (art. 86 à 92) vise les actifs admis sur une plateforme agréée ; hors champ, examiner escroquerie et blanchiment, et l'encadrement de l'influence commerciale.`,
  ],
  quiz: [
    {
      q: `Quel est l'ordre typique des phases d'un pump and dump ?`,
      options: [
        `Promotion, accumulation, vente, création`,
        `Vente, accumulation, promotion, hausse`,
        `Hausse, création, accumulation, promotion`,
        `Accumulation, promotion, hausse, vente`,
      ],
      answer: 3,
      explain: `Le groupe achète d'abord à bas prix, provoque la demande par la promotion, puis vend sur la hausse.`,
    },
    {
      kind: 'multi',
      q: `Quels éléments renforcent l'hypothèse d'une coordination entre le créateur d'un jeton et ses premiers acheteurs ? (plusieurs réponses)`,
      options: [
        `Des achats dans le même slot que la création`,
        `Un financement des acheteurs par une même adresse peu avant`,
        `Des ventes synchronisées juste après le pic de promotion`,
        `Le fait que le jeton porte le nom d'un animal`,
      ],
      answer: [0, 1, 2],
      explain: `Le nom du jeton n'a aucune valeur probante ; les trois autres éléments forment un faisceau.`,
    },
    {
      kind: 'truefalse',
      q: `Un spoofing (ordres placés puis annulés) sur un exchange centralisé peut être démontré par la seule analyse de la blockchain.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Le carnet d'ordres d'un exchange centralisé est hors chaîne. Il faut requérir l'exchange (ordres, annulations, comptes, IP, clés d'API).`,
    },
    {
      q: `Un portefeuille du groupe a acheté pour 2,4 SOL, vendu pour 88,1 SOL et payé 0,3 SOL de frais. Quel est son résultat net ?`,
      options: [`+88,1 SOL`, `+85,7 SOL`, `+85,4 SOL`, `+90,8 SOL`],
      answer: 2,
      explain: `88,1 − 2,4 − 0,3 = 85,4 SOL.`,
    },
    {
      q: `Pourquoi des achats dans le même slot que la création d'un jeton désignent-ils plutôt le créateur que des robots extérieurs ?`,
      options: [
        `Parce qu'un robot extérieur n'apprend l'existence du jeton qu'après la publication de sa création, alors que le créateur peut grouper création et achats dans un bundle`,
        `Parce que les robots ne fonctionnent pas sur Solana`,
        `Parce que le launchpad interdit les achats extérieurs pendant une heure`,
        `Parce que la courbe de liaison réserve le premier slot au créateur`,
      ],
      answer: 0,
      explain: `Le bundle exécute ensemble et dans l'ordre création et achats préparés. Un sniper extérieur réagit à la création, donc au mieux dans les slots suivants.`,
    },
    {
      kind: 'multi',
      q: `Que faut-il constater rapidement pour établir la chronologie d'une promotion ? (plusieurs réponses)`,
      options: [
        `Les messages du canal d'appels, avec leur horodatage et leur lien direct`,
        `Les publications des influenceurs, avant leur suppression`,
        `Les identifiants numériques des canaux et comptes`,
        `Le cours du bitcoin le même jour`,
      ],
      answer: [0, 1, 2],
      explain: `Ces éléments, rapprochés de l'heure UTC des blocs, établissent la coordination. Le cours du bitcoin est sans rapport.`,
    },
    {
      kind: 'truefalse',
      q: `Les dispositions de MiCA sur les abus de marché visent les crypto-actifs admis à la négociation (ou en demande d'admission) sur une plateforme exploitée par un prestataire agréé.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `C'est le critère de champ du titre consacré aux abus de marché ; un jeton échangé uniquement sur un DEX peut y échapper, d'où l'intérêt d'examiner d'autres qualifications.`,
    },
    {
      q: `Quel indicateur révèle un volume factice sur un DEX ?`,
      options: [
        `Un grand nombre de détenteurs`,
        `Des achats et ventes réguliers entre portefeuilles financés par la même source, au solde net proche de zéro`,
        `Une graduation rapide vers un pool`,
        `Un prix stable`,
      ],
      answer: 1,
      explain: `Le volume factice fait circuler les mêmes fonds entre portefeuilles liés : régularité mécanique, financement commun, solde net nul hors frais.`,
    },
  ],
  flashcards: [
    { front: 'Pump and dump', back: `Accumuler, promouvoir, vendre sur la hausse provoquée.` },
    { front: 'Bundle', back: `Transactions exécutées ensemble et dans l'ordre : création + achats de portefeuilles liés dans le même bloc.` },
    { front: 'Sniper', back: `Robot qui achète un jeton dans les premiers blocs après sa création.` },
    { front: 'Courbe de liaison', back: `Prix fixé par formule selon la quantité achetée, avant migration vers un DEX.` },
    { front: 'Graduation', back: `Migration de la liquidité d'un launchpad vers un pool de DEX à un seuil de capitalisation.` },
    { front: 'Spoofing', back: `Ordres placés puis annulés pour tromper le marché ; invisible on-chain.` },
    { front: 'Preuve de coordination', back: `Financement commun, même slot que la création, paiement des promoteurs, ventes synchronisées, profits regroupés.` },
    { front: 'Profit d’un portefeuille', back: `Ventes − achats − frais.` },
    { front: 'MiCA, abus de marché', back: `Articles 86 à 92, applicables depuis le 30 décembre 2024 ; champ lié à l'admission sur une plateforme agréée.` },
    { front: 'Influence commerciale', back: `Loi du 9 juin 2023 : restreint la promotion des crypto-actifs par les influenceurs.` },
    { front: 'Données à requérir à un exchange', back: `Historique d'ordres et annulations, comptes liés, IP, clés d'API.` },
  ],
}
