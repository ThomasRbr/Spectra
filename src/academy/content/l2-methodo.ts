// Niveau 2 — filière Méthodologie : attribution, exposition et risque.
import type { Lesson } from '../model'

export const L2_METHODO: Lesson[] = [
  // ════════════════════════════════════════════════════════════════════════
  // ATTRIBUTION
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'attribution-sources',
    title: "Attribution : d'où viennent les étiquettes ?",
    level: 2,
    track: 'methodo',
    minutes: 26,
    summary:
      "Une adresse n'a pas de nom : l'étiquette « Coinvault » ou « Nebula Mixer » qu'affiche un outil est une affirmation, issue d'une source, à une date, par une méthode. Panorama des sources d'attribution (dépôts tests, publications, sanctions, saisies, OSINT, heuristiques), de leur fiabilité, de leur propagation, et de la manière de les citer dans une procédure.",
    objectives: [
      'Distinguer les faits observés sur la chaîne des attributions inférées.',
      'Citer les grandes familles de sources d\'attribution et leur fiabilité relative.',
      'Expliquer le dépôt test et la propagation d\'une étiquette à un cluster ou à des adresses de dépôt.',
      'Évaluer une étiquette (source, date, méthode, corroboration) et lui attribuer un niveau de confiance.',
      'Rédiger une attribution de façon traçable dans un procès-verbal ou un rapport.',
    ],
    prerequisites: ['exchanges', 'clustering'],
    blocks: [
      {
        type: 'text',
        md: `La blockchain enregistre des adresses, des montants et des horodatages. **Nulle part** elle n'indique qu'une adresse appartient à Coinvault, à un mixeur ou à un suspect. Toutes les étiquettes que vous voyez dans SPECTRA ou dans un outil commercial ont été **ajoutées** par quelqu'un, à partir d'une source, à une date, selon une méthode.

Pour l'enquêteur, la conséquence est simple : une étiquette est un **renseignement**, pas un fait. Elle oriente les réquisitions — et c'est souvent la réponse de la réquisition qui transformera l'attribution en élément de preuve.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Observé (fait vérifiable)',
          md: `- L'adresse \`bc1q…u7d4\` a reçu 0,62 BTC le 12/05/2026 à 02:14 UTC.
- Elle a été co-dépensée avec 182 autres adresses dans la tx \`9be0…\`.
- Tout le monde peut le vérifier dans n'importe quel explorateur.`,
        },
        right: {
          title: 'Inféré (attribution)',
          md: `- « \`bc1q…u7d4\` est une adresse de dépôt Coinvault. »
- Dépend d'une source (dépôt test, réponse de Coinvault, cluster).
- Peut être fausse, périmée ou propagée à tort : elle se **cite** et se **corrobore**.`,
        },
      },
      { type: 'heading', text: 'Les grandes familles de sources' },
      {
        type: 'table',
        headers: ['Source', 'Exemple', 'Fiabilité', 'Limites'],
        rows: [
          ['Réponse de réquisition', 'Coinvault confirme que l\'adresse est un dépôt du client n° 88213', 'Très élevée', 'Ponctuelle ; couverte par le secret de l\'enquête'],
          ['Dépôt test / retrait test', 'L\'analyste crée un compte et dépose : il obtient une adresse de dépôt et voit où elle est balayée', 'Élevée', 'Ne couvre que le service testé, à une date donnée'],
          ['Publication par l\'entité', 'Adresses de réserves publiées par un exchange, adresse de dons d\'une association', 'Élevée', 'L\'entité peut changer d\'adresses'],
          ['Listes de sanctions', 'Adresses figurant sur la liste SDN de l\'OFAC', 'Élevée (sur l\'identité visée)', 'Ne couvrent qu\'une partie des adresses de l\'entité'],
          ['Saisies et procédures', 'Portefeuille saisi, décision de justice, acte d\'accusation publié', 'Élevée', 'Disponibilité et réutilisation encadrées'],
          ['Heuristiques et clustering', 'Adresse co-dépensée avec un dépôt attribué', 'Variable', 'Hérite des erreurs de clustering'],
          ['OSINT', 'Adresse publiée sur un forum, une note de rançon, un site frauduleux', 'Variable', 'Usurpation, recopie, erreurs'],
          ['Signalements communautaires', 'Bases d\'adresses signalées par des victimes', 'Faible à moyenne', 'Non vérifiés, parfois malveillants'],
        ],
        caption: 'Un fournisseur d\'analyse combine ces sources ; il est rare qu\'il indique laquelle fonde une étiquette donnée — demandez-le.',
      },
      {
        type: 'text',
        md: `Le **dépôt test** est la technique reine pour les services centralisés. L'analyste (ou le fournisseur d'outil) ouvre un compte, demande une adresse de dépôt, y envoie un petit montant, puis observe la suite : l'adresse est **balayée** vers une adresse de consolidation, elle-même reliée au hot wallet. Sur Bitcoin, la CIOH rattache alors au même cluster toutes les adresses de dépôt consolidées avec elle ; sur Ethereum ou Tron, l'adresse de destination du balayage (le hot wallet) permet de reconnaître toutes les autres adresses de dépôt qui y reversent.

Le **retrait test** fonctionne en miroir : en retirant depuis le service, on apprend quelles adresses il utilise pour payer ses clients.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'an', label: 'Portefeuille de l\'analyste', kind: 'wallet', sub: 'dépôt test 0,002 BTC' },
          { id: 'dep', label: 'bc1q…k8vn', kind: 'deposit', sub: 'adresse de dépôt fournie' },
          { id: 'others', label: '182 autres dépôts', kind: 'deposit', sub: 'clients inconnus' },
          { id: 'sweep', label: 'tx de balayage', kind: 'tx', sub: '183 entrées' },
          { id: 'hot', label: 'Hot wallet', kind: 'hot', sub: 'désormais étiqueté « Binova »' },
        ],
        edges: [
          { from: 'an', to: 'dep', label: '0,002 BTC' },
          { from: 'dep', to: 'sweep' },
          { from: 'others', to: 'sweep' },
          { from: 'sweep', to: 'hot', label: 'consolidation' },
        ],
        caption: 'Un dépôt test de quelques euros suffit à étiqueter toute la chaîne de consolidation et les 182 autres adresses de dépôt.',
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'Suivez un dépôt client jusqu\'au cold wallet : repérez l\'étape où l\'attribution devient possible, et celle où l\'adresse cesse d\'identifier un client précis.',
      },
      {
        type: 'check',
        q: 'Pourquoi un dépôt test sur Binova permet-il d\'étiqueter des adresses de dépôt d\'autres clients que l\'analyste ?',
        options: [
          'Parce que Binova publie la liste de ses clients',
          'Parce que l\'adresse de dépôt de l\'analyste est consolidée avec celles des autres clients, ce qui les relie (CIOH sur Bitcoin, hot wallet commun sur les chaînes à comptes)',
          'Parce que toutes les adresses d\'un exchange commencent par le même préfixe',
          'Parce que l\'analyste reçoit une copie des dépôts des autres clients',
        ],
        answer: 1,
        explain: 'La consolidation des dépôts est la clé : elle relie l\'adresse testée aux autres adresses balayées dans les mêmes transactions ou vers le même hot wallet.',
      },
      { type: 'heading', text: 'Propagation : de l\'adresse au cluster' },
      {
        type: 'text',
        md: `Une étiquette posée sur une adresse se **propage** :

- sur les chaînes UTXO, à tout le **cluster** (CIOH). Dans SPECTRA, l'attribution est alors marquée comme telle : « Binova (cluster) » signifie que l'adresse n'a pas d'étiquette propre mais qu'une autre adresse de son cluster en a une ;
- sur les chaînes à comptes, aux **adresses de dépôt** qui reversent au hot wallet étiqueté (heuristique de l'adresse de dépôt), ou aux contrats déployés par une adresse connue ;
- dans les outils commerciaux, parfois au **rendu** détecté, ce qui ajoute le risque d'erreur de la détection de rendu.

Plus une étiquette a voyagé, plus il faut remonter à son point d'origine avant de s'en servir comme pivot.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Étiquettes périmées et propagées à tort',
        md: `Une adresse attribuée en 2021 à un échangeur peut avoir été abandonnée, revendue avec le service, ou réutilisée. Une fausse fusion de cluster propage une étiquette à des milliers d'adresses étrangères. Et deux outils peuvent donner deux noms différents à la même adresse. Vérifiez toujours **la date** de l'attribution et **l'activité** de l'adresse à la date des faits.`,
      },
      { type: 'heading', text: 'Évaluer une étiquette' },
      {
        type: 'steps',
        items: [
          { title: 'Quelle source ?', md: 'Réquisition, dépôt test, publication, sanction, OSINT, heuristique ? Si l\'outil ne l\'indique pas, demandez-la au fournisseur.' },
          { title: 'Quelle date ?', md: 'L\'attribution est-elle antérieure ou postérieure aux faits ? L\'adresse était-elle active à la date qui vous intéresse ?' },
          { title: 'Quelle méthode de propagation ?', md: 'Étiquette directe, ou héritée d\'un cluster ? Dans ce dernier cas, produisez le chemin de co-dépense.' },
          { title: 'Quelle corroboration ?', md: 'Un second élément indépendant : comportement (consolidations massives typiques d\'un exchange), autre outil, OSINT, réponse d\'un prestataire.' },
          { title: 'Quelle confiance ?', md: 'Attribuez un niveau (voir tableau ci-dessous) et écrivez-le.' },
        ],
      },
      {
        type: 'table',
        headers: ['Niveau', 'Critère', 'Usage possible'],
        rows: [
          ['Confirmée', 'Réponse du prestataire, données saisies, décision de justice', 'Élément de preuve, citable comme tel'],
          ['Forte', 'Dépôt test récent ou publication officielle, corroborée par le comportement', 'Fonde une réquisition'],
          ['Probable', 'Héritée d\'un cluster par un chemin de co-dépense court et contrôlé', 'Fonde une réquisition, en précisant le raisonnement'],
          ['Indicative', 'OSINT isolé, signalement communautaire, étiquette d\'outil sans source', 'Piste à vérifier, jamais seule dans un acte'],
        ],
        caption: 'Grille indicative : adaptez-la aux usages de votre service, mais utilisez-en une, toujours la même.',
      },
      {
        type: 'case',
        title: 'Cas — deux outils, deux noms',
        md: `Dans une escroquerie au faux placement, l'adresse Tron \`TQx7…9bLm\` reçoit 48 000 USDT de trois victimes. L'outil A l'étiquette « Kaizen Exchange — dépôt », l'outil B « Huobex ».

L'analyste examine le comportement : l'adresse reverse chaque dépôt, en moins d'une heure, vers \`TJk2…hW4e\`, qui reçoit aussi les reversements de 41 000 autres adresses. Une recherche dans SPECTRA montre que \`TJk2…hW4e\` est attribuée à Kaizen par dépôt test daté de janvier 2026 ; l'étiquette « Huobex » de l'outil B provient d'un signalement communautaire de 2023, sans méthode indiquée.

Décision : réquisition adressée à **Kaizen**, en exposant le raisonnement (reversement vers le hot wallet attribué par dépôt test). Kaizen confirme deux semaines plus tard : l'attribution passe de « forte » à « confirmée ».`,
      },
      {
        type: 'check',
        q: 'Une adresse est étiquetée « Ocelot Swap » dans un outil, sans indication de source. Quel usage en faire ?',
        options: [
          'L\'écrire comme un fait établi dans le procès-verbal',
          'L\'ignorer totalement',
          'La traiter comme une piste : rechercher la source et une corroboration avant de fonder un acte dessus',
          'Requérir l\'outil pour qu\'il identifie le client',
        ],
        answer: 2,
        explain: 'Une étiquette sans source est indicative. Elle oriente l\'analyse, mais doit être sourcée ou corroborée avant de fonder une réquisition — et ce n\'est jamais l\'éditeur de l\'outil qui détient les données clients.',
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Listes de sanctions',
        md: `L'OFAC (Trésor américain) inscrit des adresses de crypto-actifs sur sa liste SDN depuis 2018 ; les listes de l'Union européenne visent surtout des personnes et entités, plus rarement des adresses. Une exposition à une entité sanctionnée (Grantis dans les exercices) est un **signal fort** : elle peut justifier un signalement (TRACFIN, partenaires) et rend la coopération de l'entité illusoire. Vérifiez toujours l'inscription sur la liste officielle à la date considérée, et non la seule étiquette de l'outil.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : citer une attribution',
        md: `Formulation type : « L'adresse \`TJk2…hW4e\` est attribuée à Kaizen Exchange (hot wallet) par l'outil SPECTRA, source : dépôt test du 14/01/2026 ; attribution corroborée par le reversement de plus de 41 000 adresses de dépôt. Niveau de confiance : fort. » Le lecteur — magistrat, avocat, expert — sait ainsi exactement ce qui est affirmé et sur quoi.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Attribution', def: 'Association d\'une adresse ou d\'un cluster à une entité réelle, fondée sur une source datée.' },
          { term: 'Dépôt test', def: 'Dépôt d\'un petit montant sur un service pour obtenir et observer une de ses adresses de dépôt.' },
          { term: 'Attribution directe', def: 'Étiquette posée sur l\'adresse elle-même (source propre).' },
          { term: 'Attribution par cluster', def: 'Étiquette héritée d\'une autre adresse du même cluster.' },
          { term: 'Heuristique de l\'adresse de dépôt', def: 'Sur les chaînes à comptes : les adresses qui reversent systématiquement au même hot wallet sont des dépôts de ce service.' },
          { term: 'Liste SDN', def: 'Liste des personnes et entités sanctionnées par l\'OFAC, qui peut inclure des adresses de crypto-actifs.' },
        ],
      },
    ],
    keyPoints: [
      'Aucune étiquette n\'est inscrite sur la blockchain : toute attribution est une affirmation issue d\'une source, à une date.',
      'Sources principales : réquisitions, dépôts et retraits tests, publications, listes de sanctions, saisies, heuristiques, OSINT, signalements.',
      'Le dépôt test étiquette toute la chaîne de consolidation d\'un service.',
      'Une étiquette se propage (cluster, adresses de dépôt, rendu) : remonter à son origine avant de l\'utiliser comme pivot.',
      'Évaluer chaque étiquette : source, date, méthode, corroboration, niveau de confiance.',
      'Citer l\'attribution avec sa source et son niveau de confiance ; la réponse du prestataire la confirme.',
    ],
    quiz: [
      {
        q: 'Quelle source d\'attribution est la plus fiable ?',
        options: [
          'Un signalement sur une base communautaire',
          'La réponse du prestataire à une réquisition',
          'Une étiquette d\'outil sans source',
          'Une adresse trouvée sur un forum',
        ],
        answer: 1,
        explain: 'La réponse du prestataire, qui détient les données de ses clients, confirme l\'attribution et constitue un élément de procédure.',
      },
      {
        kind: 'truefalse',
        q: 'Une adresse peut porter dans la blockchain un champ qui indique officiellement le nom de l\'exchange auquel elle appartient.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La blockchain ne contient aucune étiquette d\'identité. Les noms affichés par les outils sont ajoutés à partir de sources externes.',
      },
      {
        kind: 'multi',
        q: 'Quelles questions faut-il se poser avant d\'utiliser une étiquette comme fondement d\'une réquisition ? (plusieurs réponses)',
        options: [
          'Quelle est la source de l\'étiquette ?',
          'L\'attribution est-elle datée et l\'adresse active à la date des faits ?',
          'L\'étiquette est-elle directe ou héritée d\'un cluster ?',
          'L\'adresse commence-t-elle par une lettre ou un chiffre ?',
          'Existe-t-il une corroboration indépendante ?',
        ],
        answer: [0, 1, 2, 4],
        explain: 'Source, date, mode de propagation et corroboration déterminent la confiance. Le préfixe indique le type d\'adresse, pas son propriétaire.',
      },
      {
        q: 'Que signifie l\'affichage « Coinvault (cluster) » dans SPECTRA ?',
        options: [
          'L\'adresse a été confirmée par Coinvault',
          'L\'adresse est un cold wallet',
          'L\'adresse n\'a pas d\'étiquette propre : elle hérite de celle d\'une autre adresse de son cluster',
          'Coinvault a publié cette adresse',
        ],
        answer: 2,
        explain: 'L\'attribution par cluster est signalée pour rappeler qu\'elle dépend du clustering, donc d\'un chemin de co-dépense à vérifier.',
      },
      {
        q: 'Sur Ethereum, comment un dépôt test permet-il de reconnaître d\'autres adresses de dépôt du même exchange ?',
        options: [
          'Par la CIOH',
          'Par le préfixe des adresses',
          'Par le nonce des transactions',
          'Parce que toutes les adresses de dépôt reversent leurs fonds vers le même hot wallet',
        ],
        answer: 3,
        explain: 'La CIOH n\'existe pas sur Ethereum ; c\'est le reversement systématique vers un même hot wallet qui trahit les adresses de dépôt.',
      },
      {
        q: 'Deux outils donnent deux attributions différentes à la même adresse. Bonne démarche ?',
        options: [
          'Retenir l\'outil le plus cher',
          'Remonter aux sources et au comportement de l\'adresse, puis retenir l\'attribution la mieux fondée en expliquant pourquoi',
          'Requérir les deux services sans distinction et sans explication',
          'Abandonner la piste',
        ],
        answer: 1,
        explain: 'La contradiction impose de comparer les sources (date, méthode) et le comportement on-chain. La décision et son motif sont consignés.',
      },
      {
        kind: 'truefalse',
        q: 'Une attribution datée de 2021 reste nécessairement valable pour des faits de 2026.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Une adresse peut être abandonnée, réutilisée ou changer de main avec le service. Il faut vérifier son activité à la date des faits.',
      },
    ],
    flashcards: [
      { front: 'Une étiquette d\'outil est-elle un fait ?', back: 'Non : c\'est une affirmation issue d\'une source, à une date. C\'est un renseignement à sourcer et corroborer.' },
      { front: 'Dépôt test', back: 'Déposer un petit montant sur un service pour obtenir une adresse de dépôt et observer sa consolidation vers le hot wallet.' },
      { front: 'Retrait test', back: 'Retirer depuis un service pour apprendre quelles adresses il utilise pour payer ses clients.' },
      { front: 'Source d\'attribution la plus fiable', back: 'La réponse du prestataire à une réquisition (attribution confirmée).' },
      { front: 'Heuristique de l\'adresse de dépôt (chaînes à comptes)', back: 'Les adresses qui reversent systématiquement vers le même hot wallet sont des adresses de dépôt de ce service.' },
      { front: 'Cinq questions pour évaluer une étiquette', back: 'Source ? Date ? Directe ou propagée ? Corroboration ? Niveau de confiance ?' },
      { front: 'Liste SDN de l\'OFAC', back: 'Liste américaine de personnes et entités sanctionnées, qui inclut des adresses de crypto-actifs depuis 2018.' },
      { front: 'Pourquoi dater une attribution ?', back: 'Une adresse peut être abandonnée, réutilisée ou changer de main : l\'attribution doit être valable à la date des faits.' },
      { front: 'Formulation type d\'une attribution', back: '« Attribuée à X par l\'outil Y, source : dépôt test du JJ/MM/AAAA, corroborée par… Confiance : forte. »' },
    ],
    practice: ['first-trace', 'sextortion-cluster', 'eth-first'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // EXPOSITION ET RISQUE
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'exposition-risque',
    title: 'Exposition, taint et score de risque',
    level: 2,
    track: 'methodo',
    minutes: 28,
    summary:
      "Les outils d'analyse et les services de conformité résument une adresse par son « exposition » et un score de risque. D'où viennent ces chiffres ? Exposition directe et indirecte, méthodes de taint (poison, haircut, FIFO), calcul de SPECTRA pas à pas, et ce qu'un score permet — ou ne permet pas — d'affirmer.",
    objectives: [
      'Définir l\'exposition directe et indirecte, entrante et sortante.',
      'Comparer les principales méthodes de taint et leurs effets sur un même exemple.',
      'Reproduire le calcul d\'exposition et de score de risque de SPECTRA.',
      'Interpréter un score sans le surinterpréter, notamment face au dusting.',
      'Utiliser l\'exposition pour prioriser les pistes et argumenter un signalement ou un gel.',
    ],
    prerequisites: ['attribution-sources', 'suivre-flux'],
    blocks: [
      {
        type: 'text',
        md: `Lorsqu'un exchange reçoit un dépôt, son service de conformité se demande : **d'où viennent ces fonds ?** Lorsqu'un enquêteur découvre une adresse inconnue, il se demande : **avec quoi cette adresse a-t-elle été en contact ?** Les deux questions ont la même réponse technique : l'**exposition**, c'est-à-dire la part des flux d'une adresse qui provient de (ou part vers) des catégories d'entités — exchanges, mixeurs, marchés du darknet, entités sanctionnées…

De l'exposition, les outils déduisent un **score de risque**. C'est un résumé commode, mais c'est un modèle : il faut savoir comment il est construit pour s'en servir correctement.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Exposition directe', def: 'Flux échangés sans intermédiaire avec une entité attribuée (1 saut).' },
          { term: 'Exposition indirecte', def: 'Flux reçus ou envoyés via des adresses intermédiaires non attribuées (2 sauts et plus).' },
          { term: 'Exposition entrante / sortante', def: 'Origine des fonds reçus (sources) / destination des fonds envoyés (bénéficiaires).' },
          { term: 'Taint', def: 'Proportion des fonds d\'une adresse considérée comme issue d\'une source donnée, selon une règle de calcul.' },
          { term: 'Score de risque', def: 'Note synthétique (0 à 100 dans SPECTRA) dérivée de l\'attribution et de l\'exposition.' },
        ],
      },
      {
        type: 'flow',
        nodes: [
          { id: 'mx', label: 'Nebula Mixer', kind: 'mixer', sub: 'sévère' },
          { id: 'cv', label: 'Coinvault', kind: 'exchange', sub: 'faible' },
          { id: 'y', label: 'Adresse Y', kind: 'unknown', sub: 'non attribuée' },
          { id: 'dn', label: 'Obsidian Market', kind: 'service', sub: 'darknet — sévère' },
          { id: 'cv2', label: 'Binova', kind: 'exchange', sub: 'faible' },
          { id: 'x', label: 'Adresse étudiée X', kind: 'suspect', sub: 'reçoit 100 000 $' },
        ],
        edges: [
          { from: 'mx', to: 'x', label: '20 000 $ (direct)' },
          { from: 'cv', to: 'x', label: '30 000 $ (direct)' },
          { from: 'y', to: 'x', label: '50 000 $' },
          { from: 'dn', to: 'y', label: '60 % des fonds de Y' },
          { from: 'cv2', to: 'y', label: '40 % des fonds de Y' },
        ],
        caption: 'Exposition entrante de X : directe (mixeur 20 %, exchange 30 %) et indirecte via Y (darknet 30 %, exchange 20 %).',
      },
      { type: 'heading', text: 'Méthodes de calcul du taint' },
      {
        type: 'text',
        md: `Quand une adresse reçoit des fonds d'origines différentes puis en envoie une partie, quelle part de la sortie est « issue » de chaque source ? Il n'y a pas de réponse physique — les unités sont fongibles — mais plusieurs **conventions**. Exemple : une adresse reçoit d'abord **1 BTC illicite**, puis **3 BTC propres**, puis envoie **1 BTC**.`,
      },
      {
        type: 'table',
        headers: ['Méthode', 'Principe', 'Part illicite du 1 BTC envoyé', 'Usage'],
        rows: [
          ['Poison', 'Tout contact contamine la totalité', '100 %', 'Très conservateur ; « contamine » rapidement tout l\'écosystème'],
          ['Haircut (prorata)', 'Chaque sortie emporte la proportion de chaque source', '25 % (0,25 BTC)', 'Méthode des outils de conformité et de SPECTRA'],
          ['FIFO', 'Premier entré, premier sorti', '100 % (le BTC illicite est entré en premier)', 'Proche de certaines règles de traçabilité comptable'],
          ['LIFO', 'Dernier entré, premier sorti', '0 %', 'Rarement utilisé, favorable à l\'auteur'],
          ['TIHO (taint in, highest out)', 'La part illicite part avec les plus grosses sorties', 'Dépend des montants', 'Utile pour maximiser la récupération'],
        ],
        caption: 'Sur Bitcoin, on peut souvent suivre les UTXO exactement ; ces conventions s\'imposent surtout dans le modèle à comptes et pour les adresses à flux mélangés.',
      },
      {
        type: 'check',
        q: 'Une adresse Ethereum reçoit 10 ETH d\'un piratage puis 30 ETH d\'un exchange, et envoie ensuite 20 ETH. Avec la méthode haircut, combien d\'ETH « issus du piratage » ces 20 ETH contiennent-ils ?',
        options: ['20 ETH', '10 ETH', '5 ETH', '0 ETH'],
        answer: 2,
        explain: 'Le piratage représente 10 / 40 = 25 % des fonds. Au prorata, les 20 ETH envoyés en emportent 25 %, soit 5 ETH. En FIFO, ce serait 10 ETH ; en poison, 20 ETH.',
      },
      { type: 'heading', text: 'Comment SPECTRA calcule l\'exposition' },
      {
        type: 'text',
        md: `Pour une adresse et une direction (entrante ou sortante), SPECTRA :

1. liste les **contreparties** et la valeur échangée en dollars (sur Bitcoin, au prorata des entrées de chaque transaction) ;
2. classe en **exposition directe** les contreparties attribuées à une entité (autre qu'un particulier) ;
3. pour chaque contrepartie **non attribuée**, remonte (ou descend) d'un saut supplémentaire, en répartissant le montant **au prorata** des flux de cette contrepartie : c'est l'**exposition indirecte** ;
4. s'arrête à **3 sauts**, et dès qu'une entité attribuée est atteinte (on ne « traverse » pas un exchange).

Le résultat est un profil du type : « exposition entrante directe : 30 % exchange, 20 % mixeur ; indirecte : 30 % darknet, 20 % exchange ».`,
      },
      {
        type: 'widget',
        id: 'risk-exposure',
        caption: 'Modifiez les montants et les catégories des contreparties : observez la répartition au prorata entre exposition directe et indirecte.',
      },
      { type: 'heading', text: 'Du profil d\'exposition au score' },
      {
        type: 'table',
        headers: ['Niveau de risque', 'Exemples de catégories', 'Poids dans l\'exposition', 'Score si l\'adresse elle-même est attribuée'],
        rows: [
          ['Faible', 'Exchange, DEX, commerçant, pool de minage', '0', '10'],
          ['Moyen', 'Bridge, jeux d\'argent, P2P, OTC', '0,25', '45'],
          ['Élevé', 'Échangeur instantané sans KYC, coordinateur CoinJoin', '0,6', '75'],
          ['Sévère', 'Mixeur, pool de confidentialité, darknet, rançongiciel, escroquerie, sanctionné, piratage', '1', '95'],
        ],
      },
      {
        type: 'text',
        md: `Le score de SPECTRA (0 à 100) est le **maximum** de trois valeurs :

- le score de l'entité à laquelle l'adresse est elle-même attribuée (95 pour un mixeur, 10 pour un exchange) ;
- le score d'exposition **entrante** ;
- le score d'exposition **sortante**.

Chaque score d'exposition vaut **100 × (somme des montants × poids de leur catégorie) / montant total exposé**, l'exposition **indirecte** étant atténuée d'un facteur **0,6**. Les seuils : **85 et plus = sévère**, 60 = élevé, 30 = moyen, en dessous = faible. Les raisons affichées citent la catégorie à risque élevé ou sévère la plus importante dans chaque direction.`,
      },
      {
        type: 'case',
        title: 'Calcul pas à pas — l\'adresse X du schéma',
        md: `Exposition entrante de X (100 000 $) :

- directe : Coinvault 30 000 $ × 0 = 0 ; Nebula Mixer 20 000 $ × 1 = 20 000 ;
- indirecte (via Y) : Obsidian Market 30 000 $ × 1 × 0,6 = 18 000 ; Binova 20 000 $ × 0 = 0.

Somme pondérée : 38 000. Rapport : 38 000 / 100 000 = 0,38, soit un **score entrant de 38**.

X n'est pas attribuée, et ses fonds sortants partent intégralement vers Coinvault (score sortant 0). Score final : max(0, 38, 0) = **38 → risque moyen**, avec pour raison « Exposition entrante : Mixeur ».

Remarquez que sans l'atténuation de l'indirect, le score aurait été de 50. Et que si les 20 000 $ du mixeur étaient passés par une adresse intermédiaire, ils n'auraient compté que pour 12 000.`,
      },
      {
        type: 'check',
        q: 'Une adresse non attribuée a une exposition sortante 100 % directe vers Grantis (entité sanctionnée). Quel score SPECTRA affiche-t-il ?',
        options: ['38', '60', '95', '100'],
        answer: 3,
        explain: 'Exposition directe à une catégorie sévère (poids 1) pour 100 % du montant : 100 × 1 = 100, niveau sévère. Le score de 95 correspond à une adresse elle-même attribuée à une entité sévère.',
      },
      { type: 'heading', text: 'Interpréter sans surinterpréter' },
      {
        type: 'compare',
        left: {
          title: 'Ce que le score permet',
          md: `- **Prioriser** les pistes : sur 40 contreparties, commencer par celles exposées à un rançongiciel.
- **Repérer** une adresse de collecte ou de blanchiment parmi des adresses ordinaires.
- **Argumenter** un signalement, une demande de vigilance ou de gel auprès d'un prestataire.
- **Comprendre** pourquoi un exchange a bloqué un compte (son outil voit la même chose).`,
        },
        right: {
          title: 'Ce qu\'il ne permet pas',
          md: `- Prouver la **connaissance** ou l'intention du titulaire.
- Établir qu'une personne est **complice** : un exchange a mécaniquement une exposition à tout.
- Comparer deux outils : poids, profondeur et attributions diffèrent.
- Se passer de la **trace** : l'exposition résume, la trace démontre.`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Le dusting de contamination',
        md: `N'importe qui peut envoyer des fonds à n'importe quelle adresse. Après les sanctions américaines visant un pool de confidentialité en août 2022, des inconnus ont envoyé de petits montants issus de ce pool à des adresses de personnalités publiques, rendant leur exposition « sanctionnée ». Une exposition **entrante** faible et non sollicitée, sans dépense ultérieure de ces fonds, n'a pas la même valeur qu'une exposition **sortante** voulue.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Dans un rapport, ne donnez jamais un score seul. Écrivez : « Selon SPECTRA (calcul au prorata, 3 sauts), 38 % de la valeur pondérée reçue par X provient de catégories à risque, dont 20 000 $ directement de Nebula Mixer et environ 30 000 $ indirectement d'Obsidian Market via l'adresse Y. » Puis démontrez par la trace les flux qui comptent pour l'infraction poursuivie.`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Calculer dans les deux sens', md: 'L\'exposition entrante raconte l\'origine des fonds, la sortante leur destination. Les deux sont utiles et peuvent différer radicalement.' },
          { title: 'Lire la décomposition', md: 'Quelle part est directe, laquelle est indirecte, à combien de sauts ? Une exposition sévère à 3 sauts pèse beaucoup moins qu\'au premier.' },
          { title: 'Vérifier les attributions qui pèsent', md: 'Si 80 % du score vient d\'une seule étiquette, évaluez cette étiquette (source, date).' },
          { title: 'Écarter le bruit', md: 'Dusting, petits montants non sollicités, contreparties de type exchange : ne les laissez pas porter la conclusion.' },
          { title: 'Revenir à la trace', md: 'L\'exposition oriente ; la démonstration repose sur les transactions précises qui relient les faits aux fonds.' },
        ],
      },
    ],
    keyPoints: [
      'L\'exposition mesure la part des flux d\'une adresse issue de (ou destinée à) des catégories d\'entités, en direct ou via des intermédiaires.',
      'Les méthodes de taint (poison, haircut, FIFO, LIFO, TIHO) sont des conventions qui donnent des résultats très différents.',
      'SPECTRA calcule au prorata, jusqu\'à 3 sauts, en s\'arrêtant aux entités attribuées.',
      'Score SPECTRA = max(score de l\'entité attribuée, exposition entrante, exposition sortante) ; poids par niveau de risque, indirect × 0,6 ; seuils 30 / 60 / 85.',
      'Un score priorise et argumente ; il ne prouve ni l\'intention ni la complicité.',
      'Le dusting peut contaminer artificiellement une exposition entrante.',
    ],
    quiz: [
      {
        q: 'Qu\'est-ce que l\'exposition indirecte ?',
        options: [
          'Les flux échangés directement avec une entité attribuée',
          'Les flux reçus ou envoyés via une ou plusieurs adresses intermédiaires non attribuées',
          'Les frais de transaction',
          'Les fonds gelés par un émetteur',
        ],
        answer: 1,
        explain: 'L\'exposition indirecte mesure le contact avec une entité à travers des intermédiaires (2 sauts et plus).',
      },
      {
        q: 'Une adresse reçoit 1 BTC illicite puis 3 BTC propres, et envoie 1 BTC. Quelle part illicite selon la méthode haircut ?',
        options: ['100 %', '0 %', '25 %', '75 %'],
        answer: 2,
        explain: 'Au prorata : 1 / 4 = 25 % des fonds sont illicites, donc 0,25 BTC du bitcoin envoyé.',
      },
      {
        kind: 'multi',
        q: 'Dans SPECTRA, quels éléments entrent dans le calcul du score de risque ? (plusieurs réponses)',
        options: [
          'Le niveau de risque de l\'entité à laquelle l\'adresse est attribuée',
          'L\'exposition entrante, directe et indirecte',
          'L\'exposition sortante, directe et indirecte',
          'L\'ancienneté de l\'adresse',
          'Le type de script de l\'adresse',
        ],
        answer: [0, 1, 2],
        explain: 'Le score est le maximum entre le score de l\'entité attribuée et les scores d\'exposition entrante et sortante. Ni l\'ancienneté ni le type de script n\'interviennent.',
      },
      {
        q: 'Pourquoi SPECTRA applique-t-il un facteur 0,6 à l\'exposition indirecte ?',
        options: [
          'Pour compenser les frais',
          'Parce qu\'un contact via des intermédiaires est moins significatif qu\'un contact direct',
          'Parce que la loi l\'impose',
          'Pour convertir les BTC en dollars',
        ],
        answer: 1,
        explain: 'Plus la distance est grande, plus le lien est ténu et plus l\'attribution des fonds à la source est conventionnelle : l\'indirect est atténué.',
      },
      {
        kind: 'truefalse',
        q: 'Un score de risque élevé suffit à établir que le titulaire de l\'adresse savait que les fonds étaient d\'origine illicite.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Le score résume des flux ; il ne dit rien de la connaissance ou de l\'intention, qui relèvent d\'autres éléments de l\'enquête.',
      },
      {
        q: 'Une célébrité reçoit sans l\'avoir demandé 0,1 ETH issu d\'un pool sanctionné et n\'y touche pas. Comment interpréter son exposition ?',
        options: [
          'Elle est complice du pool',
          'Son adresse doit être gelée',
          'C\'est probablement un dusting de contamination : une exposition entrante non sollicitée et non dépensée a peu de valeur',
          'Son score de risque est nécessairement nul',
        ],
        answer: 2,
        explain: 'N\'importe qui peut envoyer des fonds à n\'importe quelle adresse. Ce cas s\'est produit après les sanctions de 2022 contre un pool de confidentialité.',
      },
      {
        q: 'À quel niveau de risque correspond un score SPECTRA de 64 ?',
        options: ['Faible', 'Moyen', 'Élevé', 'Sévère'],
        answer: 2,
        explain: 'Seuils SPECTRA : 85 et plus = sévère, 60 à 84 = élevé, 30 à 59 = moyen, moins de 30 = faible.',
      },
      {
        kind: 'truefalse',
        q: 'Deux outils d\'analyse différents donnent toujours le même score de risque à une même adresse.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Poids, profondeur d\'analyse, méthode de taint et base d\'attribution diffèrent d\'un outil à l\'autre ; les scores ne sont pas comparables tels quels.',
      },
    ],
    flashcards: [
      { front: 'Exposition directe', back: 'Flux échangés sans intermédiaire avec une entité attribuée.' },
      { front: 'Exposition indirecte', back: 'Flux échangés via des adresses intermédiaires non attribuées (2 sauts et plus).' },
      { front: 'Méthode haircut', back: 'Chaque sortie emporte la proportion de chaque source (prorata). Méthode de SPECTRA.' },
      { front: 'Méthode poison', back: 'Tout contact avec une source illicite contamine 100 % des fonds : très conservatrice.' },
      { front: 'FIFO appliqué au taint', back: 'Les premières unités entrées sont réputées sortir les premières.' },
      { front: 'Profondeur d\'exposition dans SPECTRA', back: '3 sauts maximum ; arrêt dès qu\'une entité attribuée est atteinte.' },
      { front: 'Formule du score SPECTRA', back: 'max(score de l\'entité attribuée ; 100 × somme(montant × poids) / total, indirect × 0,6) dans chaque direction.' },
      { front: 'Poids par niveau de risque (SPECTRA)', back: 'Faible 0 · moyen 0,25 · élevé 0,6 · sévère 1.' },
      { front: 'Seuils de niveau (SPECTRA)', back: '≥ 85 sévère · ≥ 60 élevé · ≥ 30 moyen · sinon faible.' },
      { front: 'Dusting de contamination', back: 'Envoi non sollicité de fonds « toxiques » à une adresse pour fausser son exposition entrante.' },
    ],
    practice: ['centralized-mixer', 'ransomware-raas', 'darknet-vendor'],
  },
]
