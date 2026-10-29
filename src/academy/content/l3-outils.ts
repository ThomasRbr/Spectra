// Niveau 3 — Traçage assisté par outil, et cadre réglementaire des prestataires.
// Les références juridiques doivent toujours être vérifiées dans les textes en vigueur.
import type { Lesson } from '../model'

export const L3_OUTILS: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // CADRE RÉGLEMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'cadre-reglementaire',
    title: 'Le cadre réglementaire : MiCA, TFR, GAFI, sanctions',
    level: 3,
    track: 'enquete',
    minutes: 30,
    summary: `Ce que les textes imposent aux prestataires de services sur crypto-actifs, et ce que l'enquêteur peut en tirer : le règlement MiCA et l'agrément des prestataires, la « Travel Rule » du règlement TFR, les recommandations du GAFI, les régimes de sanctions et de gel des avoirs.`,
    objectives: [
      `Situer MiCA, le règlement TFR, les recommandations du GAFI et les régimes de sanctions, et savoir qui chacun vise.`,
      `Savoir quelles données un prestataire régulé doit détenir, et donc lesquelles demander par réquisition.`,
      `Exploiter la Travel Rule : informations sur le donneur d'ordre et le bénéficiaire, vérification des adresses auto-hébergées.`,
      `Distinguer exposition à une entité sanctionnée, infraction pénale et mesure de gel.`,
    ],
    prerequisites: ['requisitions', 'exchanges', 'stablecoins'],
    practice: ['tron-sanctions-garantex', 'pig-butchering-tron'],
    blocks: [
      {
        type: 'text',
        md: `Un exchange qui coopère ne le fait pas par bonne volonté : il y est tenu par des textes, qui définissent aussi **ce qu'il doit savoir de ses clients et de leurs transferts**. Connaître ces obligations, c'est savoir quoi demander, à qui, et quoi faire quand un prestataire répond qu'il « n'a pas l'information ».

Quatre ensembles se superposent : le règlement européen **MiCA** (statut des prestataires et des stablecoins), le règlement **TFR** (informations qui accompagnent chaque transfert), les **recommandations du GAFI** (le standard mondial) et les **régimes de sanctions** (qui ne peut pas être servi, quels avoirs sont gelés).`,
      },
      { type: 'heading', text: 'MiCA : un statut unique pour les prestataires' },
      {
        type: 'text',
        md: `Le règlement (UE) 2023/1114, dit **MiCA**, s'applique aux émetteurs de stablecoins depuis le 30 juin 2024 et aux **prestataires de services sur crypto-actifs** (PSCA, ou *CASP* en anglais) depuis le 30 décembre 2024. Le prestataire obtient un **agrément** de l'autorité nationale (en France, l'AMF, après avis de l'ACPR), valable dans toute l'Union par passeport.

En France, MiCA remplace le régime des **PSAN** issu de la loi PACTE (2019). Les PSAN enregistrés ont pu continuer pendant une période transitoire, au plus tard jusqu'au 1er juillet 2026. Pour l'enquêteur :

- le **registre** des prestataires agréés (AMF, et registre de l'ESMA) dit si un service est régulé, dans quel pays, et donc à quelle autorité et par quelle voie s'adresser ;
- un prestataire agréé est soumis aux obligations anti-blanchiment : identification du client (KYC), conservation des données, déclaration de soupçon ;
- les stablecoins de monnaie électronique (EMT) doivent être émis par un établissement agréé. Faute d'autorisation, plusieurs grandes plateformes ont retiré l'USDT de leur offre aux clients de l'Espace économique européen en 2025 : un dépôt d'USDT d'un client européen sur une plateforme européenne est donc un indice à vérifier.`,
      },
      { type: 'heading', text: 'Le règlement TFR et la « Travel Rule »' },
      {
        type: 'text',
        md: `Le règlement (UE) 2023/1113, dit **TFR**, applicable depuis le 30 décembre 2024, étend aux crypto-actifs la règle des virements bancaires : chaque transfert entre prestataires doit être **accompagné des informations sur le donneur d'ordre et le bénéficiaire** (nom, adresse de portefeuille, numéro de compte, et pour le donneur d'ordre une adresse, un identifiant ou une date de naissance). Contrairement au standard du GAFI, **il n'y a pas de seuil** entre prestataires européens.

Pour un transfert **vers ou depuis une adresse auto-hébergée**, le prestataire collecte ces informations auprès de son client et, **au-delà de 1 000 €**, doit vérifier que l'adresse appartient bien à ce client ou est contrôlée par lui (message signé, micro-transfert de test, preuve visuelle…).`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Ce que cela change pour une réquisition',
        md: `- Demandez au prestataire les **données Travel Rule** reçues ou transmises avec le transfert : elles désignent le donneur d'ordre chez l'autre prestataire, même hors de votre juridiction.
- Pour un retrait vers une adresse auto-hébergée de plus de 1 000 €, demandez la **preuve de contrôle** conservée : elle rattache l'adresse au client, ce qu'aucune heuristique ne fait aussi bien.
- Une réponse « pas d'information » sur un transfert postérieur à fin 2024 entre prestataires européens est en soi une constatation à consigner.`,
      },
      { type: 'heading', text: 'Le GAFI : le standard mondial' },
      {
        type: 'text',
        md: `Le **GAFI** (Groupe d'action financière, *FATF*) fixe les standards que les États transposent. Sa **recommandation 15** soumet les prestataires d'actifs virtuels (*VASP*) à l'agrément ou à l'enregistrement et aux obligations de vigilance ; la **recommandation 16**, la Travel Rule, leur est appliquée depuis 2019, avec un seuil indicatif de 1 000 dollars ou euros. Le GAFI publie chaque année un état de sa mise en œuvre : beaucoup de pays ne l'appliquent encore que partiellement.

Pour l'enquêteur, l'évaluation d'un pays par le GAFI (et sa présence sur la liste des juridictions sous surveillance renforcée) donne une idée réaliste de ce que l'on peut attendre d'un prestataire qui y est établi, et de la voie à emprunter : coopération directe, entraide pénale ou rien.`,
      },
      { type: 'heading', text: 'Sanctions et gel des avoirs' },
      {
        type: 'table',
        caption: 'Les principaux régimes (à vérifier dans les textes et listes en vigueur)',
        headers: ['Régime', 'Ce qu’il prévoit', 'Exemples crypto', 'Pour l’enquête'],
        rows: [
          ['OFAC (États-Unis), liste SDN', 'Interdiction de toute transaction avec les personnes listées ; adresses de portefeuille publiées depuis 2018', 'Garantex (2022) ; Tornado Cash (2022, retiré de la liste en 2025)', 'Les adresses listées alimentent les outils d’attribution et d’exposition'],
          ['Union européenne', 'Gel des avoirs des personnes listées ; restrictions sectorielles, dont l’interdiction de fournir des services crypto aux résidents russes', 'Plateformes et intermédiaires liés au contournement des sanctions', 'Obligation de gel pour les prestataires européens'],
          ['France (code monétaire et financier)', 'Gel administratif des avoirs décidé par le ministre, registre national des gels tenu par la DG Trésor', 'Financement du terrorisme, contournement de sanctions', 'Mesure distincte de la saisie pénale, à articuler avec elle'],
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Exposition n’est pas infraction',
        md: `Avoir reçu des fonds d'une entité sanctionnée est un **risque de conformité** pour un prestataire, pas une preuve d'infraction pour le client. Une adresse peut aussi être « exposée » malgré elle (poussière envoyée à des milliers d'adresses après une désignation). L'exposition oriente l'enquête ; la qualification pénale demande d'autres éléments.

Le retrait de Tornado Cash de la liste de l'OFAC en 2025 l'illustre : il ne change rien aux faits commis avec ses fonds, ni à l'analyse des flux qui y passent.`,
      },
      { type: 'heading', text: 'Et en France, concrètement' },
      {
        type: 'steps',
        items: [
          { title: 'Vérifier le statut', md: 'Registre AMF (et liste noire des sites non autorisés), registre de l’ESMA : le service est-il agréé, où, depuis quand ?' },
          { title: 'Choisir la voie', md: 'Prestataire établi en France ou dans l’UE : réquisition directe. Hors UE : coopération volontaire selon sa politique, ou entraide pénale.' },
          { title: 'Demander ce que le texte impose de détenir', md: 'KYC, journaux de connexion, historique, données Travel Rule, preuve de contrôle des adresses auto-hébergées.' },
          { title: 'Penser TRACFIN', md: 'Les prestataires déclarent leurs soupçons à TRACFIN, qui peut aussi s’opposer temporairement à une opération : une déclaration existe peut-être déjà.' },
          { title: 'Garder la fiscalité en tête', md: 'La directive DAC8 (UE 2023/2226) impose aux prestataires, depuis le 1er janvier 2026, de déclarer à l’administration fiscale les opérations de leurs clients : une autre source de données, par d’autres voies.' },
        ],
      },
      {
        type: 'check',
        q: `Un client d'un prestataire français retire 4 000 € d'USDC vers une adresse auto-hébergée en mars 2026. Que le prestataire doit-il normalement détenir ?`,
        options: [
          `Rien de particulier : les adresses auto-hébergées échappent au règlement TFR`,
          `Les informations sur le client et le bénéficiaire, et une vérification que l'adresse est contrôlée par son client`,
          `Seulement le hash de la transaction`,
          `Une autorisation préalable de l'AMF pour chaque retrait`,
        ],
        answer: 1,
        explain: `Au-delà de 1 000 €, le règlement TFR impose au prestataire de vérifier que l'adresse auto-hébergée appartient à son client ou est contrôlée par lui. C'est une pièce précieuse : elle rattache l'adresse à une personne identifiée.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Des textes qui bougent',
        md: `Dates, seuils et listes évoluent vite (actes délégués de MiCA, mises à jour des listes de sanctions, évaluations du GAFI). Citez toujours la version consultée et sa date dans vos actes, et vérifiez le statut d'un prestataire au jour de la réquisition.`,
      },
    ],
    keyPoints: [
      `MiCA (règlement 2023/1114) : agrément des prestataires depuis le 30 décembre 2024, passeport européen ; en France, fin du régime PSAN au plus tard le 1er juillet 2026.`,
      `TFR (règlement 2023/1113) : informations donneur d'ordre / bénéficiaire avec chaque transfert, sans seuil entre prestataires ; vérification du contrôle des adresses auto-hébergées au-delà de 1 000 €.`,
      `GAFI : recommandations 15 (prestataires) et 16 (Travel Rule) ; l'évaluation d'un pays dit ce qu'on peut attendre de ses prestataires.`,
      `Sanctions : OFAC, UE, gel administratif français ; l'exposition à une entité sanctionnée est un risque de conformité, pas une preuve d'infraction.`,
      `Réquisition : demander ce que le texte impose de détenir, dont les données Travel Rule et la preuve de contrôle.`,
    ],
    quiz: [
      {
        q: `Depuis quand les prestataires de services sur crypto-actifs relèvent-ils de l'agrément MiCA ?`,
        options: [`30 juin 2024`, `1er janvier 2026`, `30 décembre 2024`, `Dès la publication du règlement en 2023`],
        answer: 2,
        explain: `Les titres sur les stablecoins s'appliquent depuis le 30 juin 2024 ; le reste du règlement, dont l'agrément des prestataires, depuis le 30 décembre 2024, avec des périodes transitoires nationales.`,
      },
      {
        q: `Quelle différence le règlement TFR fait-il avec le standard du GAFI pour les transferts entre prestataires ?`,
        options: [
          `Il n'impose la Travel Rule qu'au-delà de 10 000 €`,
          `Il ne prévoit aucun seuil : tout transfert est accompagné des informations`,
          `Il ne vise que les stablecoins`,
          `Il ne s'applique qu'aux prestataires hors UE`,
        ],
        answer: 1,
        explain: `Le GAFI admet un seuil de 1 000 dollars ou euros ; le TFR européen n'en prévoit pas entre prestataires. Le seuil de 1 000 € sert en revanche à la vérification des adresses auto-hébergées.`,
      },
      {
        kind: 'multi',
        q: `Que peut-on demander à un prestataire agréé en Europe, au titre de ses obligations ? (plusieurs réponses)`,
        options: [`Les données d'identification du client`, `Les informations Travel Rule reçues avec un dépôt`, `La clé privée de l'adresse du suspect chez un autre service`, `La preuve de contrôle d'une adresse auto-hébergée`],
        answer: [0, 1, 3],
        explain: `KYC, données Travel Rule et preuve de contrôle font partie de ce que le prestataire doit détenir. Il n'a évidemment aucun accès aux clés d'un portefeuille qui n'est pas chez lui.`,
      },
      {
        q: `Une adresse a reçu 0,001 ETH d'une adresse listée par l'OFAC. Que peut-on en conclure ?`,
        options: [
          `Son titulaire a commis une infraction de contournement de sanctions`,
          `Rien de pénal en soi : c'est une exposition, qui peut même être subie`,
          `Que l'adresse appartient à l'entité sanctionnée`,
          `Que le prestataire doit la clôturer sans délai`,
        ],
        answer: 1,
        explain: `L'exposition oriente l'analyse et pèse sur la conformité des prestataires, mais n'établit ni la propriété ni une infraction : des « poussières » sont parfois envoyées à des milliers d'adresses.`,
      },
      {
        q: `Quelle est, en France, l'autorité qui agrée un prestataire au titre de MiCA ?`,
        options: [`La Banque de France seule`, `TRACFIN`, `La DG Trésor`, `L'AMF, après avis de l'ACPR`],
        answer: 3,
        explain: `L'AMF délivre l'agrément, après avis de l'ACPR. TRACFIN reçoit les déclarations de soupçon ; la DG Trésor tient le registre national des gels.`,
      },
    ],
    flashcards: [
      { front: 'MiCA', back: `Règlement (UE) 2023/1114 : stablecoins depuis le 30/06/2024, agrément des prestataires depuis le 30/12/2024, passeport européen.` },
      { front: 'TFR', back: `Règlement (UE) 2023/1113 : la Travel Rule appliquée aux crypto-actifs, sans seuil entre prestataires, depuis le 30/12/2024.` },
      { front: 'Adresse auto-hébergée et TFR', back: `Au-delà de 1 000 €, le prestataire vérifie que l'adresse appartient à son client ou est contrôlée par lui.` },
      { front: 'Recommandations 15 et 16 du GAFI', back: `15 : obligations des prestataires d'actifs virtuels. 16 : Travel Rule (seuil indicatif 1 000 $ ou €).` },
      { front: 'Liste SDN de l’OFAC', back: `Personnes sanctionnées par les États-Unis, avec leurs adresses de portefeuille depuis 2018.` },
      { front: 'Exposition à une entité sanctionnée', back: `Risque de conformité et piste d'enquête, pas une preuve d'infraction.` },
      { front: 'DAC8', back: `Directive (UE) 2023/2226 : déclaration fiscale des opérations des clients par les prestataires, depuis le 1er janvier 2026.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRAÇAGE ASSISTÉ PAR OUTIL
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'tracage-outille',
    title: 'Traçage assisté : utiliser et contester un outil d\'analyse',
    level: 3,
    track: 'methodo',
    minutes: 30,
    summary: `Les outils professionnels suivent des millions de dollars en quelques secondes. Leur résultat reste un calcul sous hypothèses : base d'attribution, heuristiques, méthode de répartition. Comment lire un traçage automatique, le vérifier, le présenter, et répondre quand il est contesté.`,
    objectives: [
      `Décomposer le résultat d'un traçage automatique en constatations et en hypothèses.`,
      `Vérifier un traçage : source, méthode, conservation des montants, sauts décisifs.`,
      `Présenter un résultat d'outil dans un rapport de façon reproductible.`,
      `Anticiper les points que la défense peut contester.`,
    ],
    prerequisites: ['suivre-flux', 'exposition-risque', 'change-heuristics', 'chain-hopping'],
    practice: ['exchange-hack', 'chain-hopping', 'peel-chain'],
    blocks: [
      {
        type: 'text',
        md: `Un outil de traçage enchaîne en quelques secondes ce qu'un analyste ferait en une journée : il suit chaque sortie, applique les heuristiques de rendu et de clustering, convertit les swaps, franchit les bridges et s'arrête sur les services qu'il connaît. Le résultat, un diagramme et un tableau de destinations, a l'air d'une **constatation**. C'est en réalité un **calcul**, exact seulement si chacune de ses hypothèses l'est.

Le bon usage tient en une phrase : l'outil propose, l'analyste vérifie ce qui fonde la conclusion, et le rapport dit ce qui a été vérifié.`,
      },
      { type: 'heading', text: 'Ce que calcule un outil de traçage' },
      {
        type: 'table',
        headers: ['Brique', 'Ce que fait l’outil', 'Hypothèse', 'Ce qui peut la contredire'],
        rows: [
          ['Attribution', 'Nomme les adresses connues (exchanges, services)', 'La base d’étiquettes est juste et à jour', 'Étiquette erronée, ancienne, ou déduite d’un cluster contaminé'],
          ['Clustering', 'Regroupe les adresses dépensées ensemble', 'Entrées communes = même propriétaire', 'CoinJoin non détecté, PayJoin, service qui mutualise'],
          ['Rendu', 'Choisit la sortie qui continue', 'Les indices de rendu désignent la bonne sortie', 'Portefeuille qui déjoue les heuristiques, paiement à soi-même'],
          ['Méthode', 'Répartit les fonds mélangés', 'FIFO, LIFO, prorata ou poison', 'Une autre méthode donne une autre conclusion'],
          ['Conversions', 'Suit swaps et bridges à valeur égale', 'Les jambes d’un swap appartiennent au même utilisateur', 'Agrégateur, routeur partagé, bridge à liquidité commune'],
          ['Arrêt', 'Stoppe sur un service identifié', 'L’argent est « arrivé » chez ce service', 'Service de passage (échangeur instantané, mixeur)'],
        ],
        caption: 'Chaque destination affichée dépend de toutes les briques en amont.',
      },
      {
        type: 'compare',
        left: {
          title: 'Constaté (vérifiable par tous)',
          md: `- Hash, bloc, horodatage d'une transaction
- Montants, actifs, adresses d'entrée et de sortie
- Événements d'un contrat (Transfer, nonce d'un bridge)
- Solde d'une adresse à une date`,
        },
        right: {
          title: 'Inféré par l’outil (à justifier)',
          md: `- Quelle sortie est le rendu
- Quelles adresses forment un cluster
- À qui appartient une adresse
- La part des fonds de la victime sur chaque adresse
- Le paiement d'un échangeur qui correspond à un dépôt`,
        },
      },
      { type: 'heading', text: 'Vérifier un résultat avant de s’en servir' },
      {
        type: 'steps',
        items: [
          { title: 'La source', md: 'Bonne transaction, bonne adresse, bon actif : un traçage parti du mauvais versement est entièrement faux, et parfaitement cohérent.' },
          { title: 'La méthode et les paramètres', md: 'Méthode de répartition, profondeur, seuil de suivi, arrêt sur les services, date de situation. Ils figurent dans le rapport.' },
          { title: 'La conservation', md: 'Destinations + fonds encore détenus + non suivi (frais, seuil, profondeur) doivent redonner la source. Un écart signale une erreur ou une limite de l’outil.' },
          { title: 'Les sauts décisifs', md: 'Vérifiez à la main les premiers sauts, chaque rendu incertain, chaque rapprochement probabiliste (échangeur, démixage) : ce sont eux qui portent la conclusion.' },
          { title: 'La robustesse', md: 'Comparez les méthodes. Si la destination principale change d’une méthode à l’autre, la conclusion doit être nuancée.' },
          { title: 'La corroboration', md: 'Une réponse de réquisition, une preuve de contrôle, un élément d’enquête : un résultat d’outil corroboré n’est plus une simple hypothèse.' },
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Trois lectures abusives',
        md: `- « Les fonds sont arrivés chez X » ne veut pas dire « le titulaire est identifié » : il faut la réquisition, et un échangeur instantané n'est qu'un point de passage.
- « Encore détenu sur une adresse non attribuée » ne veut pas dire « appartient au suspect » : c'est une piste de gel à étayer.
- Un total « poison » ne chiffre jamais un préjudice : il délimite un périmètre.`,
      },
      {
        type: 'case',
        title: 'Cas pratique — une conclusion qui dépend de la méthode',
        md: `Une adresse intermédiaire reçoit 20 000 USDT d'un tiers, puis 30 000 USDT de la victime, puis envoie 25 000 USDT chez un exchange A et le reste chez un exchange B.

En **FIFO**, les 25 000 USDT envoyés chez A sont d'abord les fonds du tiers (20 000), puis 5 000 de la victime : A ne reçoit que 5 000 USDT de la victime, B en reçoit 25 000. En **LIFO**, c'est l'inverse : A reçoit 25 000 USDT de la victime, B 5 000. Au **prorata**, chaque exchange reçoit 60 % de ce qu'il a reçu : 15 000 chez A, 15 000 chez B.

Le rapport ne choisit pas en silence : il annonce la méthode retenue et la justifie, montre la comparaison et en tire la conséquence pratique. Ici, il faut réquisitionner **les deux** exchanges, et ne chiffrer le préjudice de chacun qu'en précisant la méthode.`,
      },
      { type: 'heading', text: 'Présenter un résultat d’outil' },
      {
        type: 'table',
        headers: ['À indiquer', 'Pourquoi'],
        rows: [
          ['Outil, version, date d’extraction', 'Les bases d’attribution évoluent : le même traçage peut changer d’un mois à l’autre'],
          ['Source exacte (hash, adresse, actif, montant)', 'Permet à quiconque de refaire le calcul'],
          ['Méthode et paramètres', 'Le résultat en dépend directement'],
          ['Date de situation', 'Ce qui est « encore détenu » n’est vrai qu’à cette date'],
          ['Rapprochements probabilistes et leur force', 'Corrélation d’échangeur, démixage : nombre de candidats, écarts, délais'],
          ['Vérifications manuelles faites', 'Distingue ce qui a été contrôlé de ce qui est repris tel quel'],
        ],
      },
      { type: 'heading', text: 'Face à la contestation' },
      {
        type: 'text',
        md: `La défense ne conteste pas la blockchain, qui est publique : elle conteste les **inférences**. Les arguments classiques : la base d'attribution est propriétaire et invérifiable, le taux d'erreur des heuristiques n'est pas connu, la méthode a été choisie pour maximiser le résultat, un saut repose sur un rapprochement probabiliste. Aux États-Unis, dans l'affaire du mixeur Bitcoin Fog jugée en 2024, la défense a ainsi contesté la fiabilité de l'outil d'analyse utilisé ; la preuve a été admise, mais le débat a porté exactement sur ces points.

La meilleure réponse est préparée dans le rapport lui-même : des constatations reproductibles par n'importe quel explorateur, des inférences présentées comme telles avec leurs indices, une méthode annoncée et comparée, et des conclusions corroborées par des éléments indépendants de l'outil (réponses des prestataires, saisies, auditions). Dans une procédure française, le principe du **contradictoire** s'applique aussi à l'analyse : elle doit pouvoir être discutée, et refaite.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Dans l’espace d’enquête SPECTRA',
        md: `L'outil « Traçage des fonds » affiche les trois résultats (destinations, encore détenu, non suivi) dont la somme redonne la source, propose *Comparer les méthodes*, et reporte automatiquement la source, la méthode, les paramètres et le diagramme de flux dans le rapport. Entraînez-vous à refaire à la main un saut décisif : sélectionnez la transaction et lisez l'analyse de rendu, l'empreinte du portefeuille et les rapprochements proposés.`,
      },
      {
        type: 'check',
        q: `Le traçage automatique conclut que 80 % des fonds de la victime sont arrivés chez un échangeur instantané. Quelle suite est la plus juste ?`,
        options: [
          `Clore l'analyse : le service est identifié`,
          `Réquisitionner l'échangeur, et rapprocher le dépôt des paiements sortants pour poursuivre le traçage`,
          `Conclure que l'échangeur est complice`,
          `Recommencer le traçage en méthode poison pour obtenir 100 %`,
        ],
        answer: 1,
        explain: `Un échangeur instantané est un point de passage : les fonds en ressortent, souvent sur une autre chaîne. On le réquisitionne (commande, adresse de paiement) et on rapproche le dépôt de ses paiements par le montant et le délai.`,
      },
    ],
    keyPoints: [
      `Un traçage automatique est un calcul sous hypothèses : attribution, clustering, rendu, méthode, conversions, arrêt.`,
      `Séparer ce qui est constaté (transactions, montants, événements) de ce qui est inféré (rendu, cluster, propriétaire, part marquée).`,
      `Vérifier la source, la méthode, la conservation des montants et les sauts décisifs, puis comparer les méthodes.`,
      `Dans le rapport : outil et version, source exacte, méthode, paramètres, date de situation, rapprochements et vérifications.`,
      `La contestation porte sur les inférences : la réponse est la reproductibilité et la corroboration indépendante de l'outil.`,
    ],
    quiz: [
      {
        q: `Dans le résultat d'un traçage, laquelle de ces informations est une constatation, vérifiable sur n'importe quel explorateur ?`,
        options: [
          `L'adresse X appartient au suspect`,
          `La sortie 1 est le rendu`,
          `La transaction T a envoyé 2,5 BTC vers l'adresse Y au bloc 851 204`,
          `42 % des fonds de la victime sont chez l'exchange A`,
        ],
        answer: 2,
        explain: `Montant, adresse et bloc se lisent sur la chaîne. Propriétaire, rendu et part marquée sont des inférences : elles dépendent d'heuristiques et d'une méthode.`,
      },
      {
        q: `Destinations 70 000 $, encore détenu 20 000 $, non suivi 2 000 $, pour une source de 100 000 $. Que faut-il en penser ?`,
        options: [
          `Le résultat est normal : il reste toujours une part inexpliquée`,
          `Il manque 8 000 $ : la conservation n'est pas respectée, il faut chercher pourquoi avant d'utiliser le résultat`,
          `La méthode poison réglera l'écart`,
          `L'écart correspond forcément aux frais`,
        ],
        answer: 1,
        explain: `Destinations, fonds encore détenus et non suivi (frais compris) doivent redonner la source. Un écart signale une erreur de paramétrage, un saut non suivi ou une limite de l'outil.`,
      },
      {
        q: `Pourquoi indiquer la version de l'outil et la date d'extraction dans le rapport ?`,
        options: [
          `Par simple formalisme`,
          `Pour la facturation de la licence`,
          `Parce que seule la dernière version a valeur probante`,
          `Parce que les bases d'attribution évoluent : le même traçage peut donner un autre résultat plus tard`,
        ],
        answer: 3,
        explain: `Une étiquette ajoutée ou corrigée change les destinations. Sans version ni date, l'analyse n'est pas reproductible.`,
      },
      {
        kind: 'multi',
        q: `Quels sauts faut-il vérifier à la main en priorité ? (plusieurs réponses)`,
        options: [`Les premiers sauts depuis la source`, `Les sauts dont le rendu est incertain`, `Les rapprochements probabilistes (échangeur, démixage)`, `Les transactions sans aucun enjeu après l'arrivée chez un exchange`],
        answer: [0, 1, 2],
        explain: `Ce sont les sauts qui portent la conclusion : une erreur au départ ou sur un rapprochement fragile fausse tout l'aval.`,
      },
      {
        q: `La défense soutient que l'analyse repose sur un logiciel propriétaire invérifiable. Quelle est la meilleure réponse ?`,
        options: [
          `Des constatations reproductibles, des inférences présentées comme telles et des conclusions corroborées par d'autres éléments`,
          `Le logiciel est utilisé par de nombreux services, il est donc fiable`,
          `Refuser de communiquer la méthode`,
          `Remplacer l'analyse par une méthode poison, plus simple`,
        ],
        answer: 0,
        explain: `La notoriété d'un outil ne prouve rien. Ce qui convainc, c'est une analyse que l'on peut refaire et dont les points décisifs sont corroborés indépendamment de l'outil.`,
      },
    ],
    flashcards: [
      { front: 'Traçage automatique', back: `Un calcul sous hypothèses (attribution, clustering, rendu, méthode, conversions, arrêt), pas une constatation.` },
      { front: 'Conservation des montants', back: `Destinations + encore détenu + non suivi = source. Un écart doit être expliqué.` },
      { front: 'Sauts décisifs', back: `Premiers sauts, rendus incertains, rapprochements probabilistes : à vérifier à la main.` },
      { front: 'Robustesse d’une conclusion', back: `Comparer FIFO, LIFO, prorata, poison : si la destination change, nuancer et le dire.` },
      { front: 'Mentions d’un résultat d’outil', back: `Outil, version, date d'extraction, source exacte, méthode, paramètres, date de situation, vérifications.` },
      { front: 'Ce que conteste la défense', back: `Les inférences : base d'attribution, taux d'erreur des heuristiques, choix de méthode, rapprochements.` },
    ],
  },
]
