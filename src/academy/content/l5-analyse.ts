// Niveau 5 — Analyse comportementale, démixage statistique, acteurs étatiques.
import type { Lesson } from '../model'

const comportementale: Lesson = {
  id: 'analyse-comportementale',
  title: 'Empreintes de portefeuilles et analyse comportementale',
  level: 5,
  track: 'methodo',
  minutes: 40,
  summary:
    'Chaque logiciel de portefeuille fait des choix d\'implémentation qui se lisent dans les transactions : types de scripts, version, nLockTime, nSequence et RBF, ordre des sorties, taux de frais, signatures low-R. Chaque utilisateur a ses habitudes : horaires, montants, réutilisation. Combiner ces signaux, mesurer leur rareté, et en tirer des conclusions de compatibilité — jamais d\'identité.',
  objectives: [
    'Relever les marqueurs d\'implémentation d\'une transaction Bitcoin et en déduire une famille de portefeuille probable.',
    'Utiliser l\'empreinte pour affiner la détection du rendu et la délimitation d\'un cluster.',
    'Exploiter les signaux comportementaux (horaires, montants, rythme) sur Bitcoin et sur les chaînes EVM.',
    'Évaluer la rareté d\'un signal par rapport à une population de référence et formuler une conclusion de compatibilité.',
  ],
  prerequisites: ['change-heuristics', 'clustering', 'frais-mempool', 'rapport'],
  practice: ['change-anatomy', 'sextortion-cluster', 'peel-chain'],
  blocks: [
    {
      type: 'text',
      md: `Deux clusters, deux affaires : une campagne de sextorsion et un réseau de revente de données. Aucune transaction ne les relie directement. Pourtant, en les regardant de près, vous remarquez que leurs transactions partagent une même façon de fixer les frais, le même ordre des sorties, les mêmes réglages techniques, et une activité qui s'arrête chaque nuit entre 1 h et 8 h, heure de Paris. Même opérateur ? Peut-être. Même logiciel ? Probablement.

L'**analyse comportementale** consiste à lire ce que les transactions disent **de la façon dont elles ont été fabriquées**. C'est un outil d'expert : puissant pour orienter, redoutable s'il est sur-interprété.`,
    },
    { type: 'heading', text: 'Deux niveaux d\'empreinte' },
    {
      type: 'compare',
      left: {
        title: 'L\'empreinte logicielle',
        md: `Les choix techniques du **portefeuille** : types de scripts, version de transaction, nLockTime, nSequence, ordre des sorties, algorithme de frais, forme des signatures.

Elle répond à la question : **quel logiciel** (ou quelle famille de logiciels) a construit cette transaction ?

Elle est partagée par tous les utilisateurs de ce logiciel.`,
      },
      right: {
        title: 'L\'empreinte comportementale',
        md: `Les habitudes de l'**utilisateur** : horaires, jours d'activité, montants préférés, réutilisation d'adresses, délais entre réception et dépense, destinations récurrentes.

Elle répond à la question : **cette activité est-elle compatible** avec celle d'un même opérateur ?

Elle est plus discriminante, mais plus fragile et plus facile à imiter.`,
      },
    },
    { type: 'heading', text: 'Les marqueurs d\'une transaction Bitcoin' },
    {
      type: 'table',
      headers: ['Marqueur', 'Valeurs possibles', 'Ce qu\'il suggère'],
      rows: [
        ['Types de scripts', 'P2PKH (1…), P2SH-P2WPKH (3…), P2WPKH (bc1q…), P2TR (bc1p…)', 'Génération et réglages du portefeuille ; un rendu du même type que les entrées est la norme'],
        ['Version', '1 ou 2', 'Les portefeuilles récents utilisent majoritairement la version 2'],
        ['nLockTime', '0, hauteur du bloc courant, hauteur légèrement inférieure', 'Hauteur courante = protection « anti fee-sniping » (Bitcoin Core, Electrum, Sparrow…) ; 0 chez de nombreux autres'],
        ['nSequence', '0xffffffff, 0xfffffffe, 0xfffffffd', '0xfffffffd signale l\'option RBF (BIP125) ; 0xfffffffe active nLockTime sans signal RBF'],
        ['Ordre des sorties', 'Lexicographique (BIP69), rendu toujours en dernier, aléatoire', 'BIP69 et « rendu en dernier » sont des choix de certains logiciels ; l\'aléatoire en est un autre'],
        ['Taux de frais', 'Entier en sat/vB, décimal, montant de frais rond', 'Algorithme d\'estimation et réglages manuels de l\'utilisateur'],
        ['Signatures', 'Toujours 71 octets (low-R) ou longueurs variables', 'Bitcoin Core « affine » ses signatures pour qu\'elles soient courtes ; d\'autres non'],
        ['Sélection des UTXO', 'Transactions sans rendu, consolidation systématique, dépense du plus ancien', 'Algorithme de sélection des pièces (par exemple Branch and Bound)'],
      ],
      caption: 'Aucun marqueur n\'est probant isolément ; leur combinaison, et surtout sa stabilité dans le temps, forme l\'empreinte.',
    },
    {
      type: 'terms',
      items: [
        { term: 'Anti fee-sniping', def: 'Fixer nLockTime à la hauteur courante pour décourager la réécriture de blocs récents ; marqueur de plusieurs portefeuilles.' },
        { term: 'RBF (BIP125)', def: 'Signal (nSequence < 0xfffffffe) indiquant qu\'une transaction peut être remplacée par une version payant plus de frais.' },
        { term: 'BIP69', def: 'Tri lexicographique déterministe des entrées et des sorties, adopté par certains portefeuilles.' },
        { term: 'Low-R', def: 'Signatures ECDSA « affinées » pour tenir sur 71 octets, pratique caractéristique de Bitcoin Core.' },
        { term: 'Population de référence', def: 'Ensemble des transactions comparables (même période, mêmes types) servant à mesurer la rareté d\'un signal.' },
        { term: 'Rapport de vraisemblance', def: 'Probabilité des observations si l\'hypothèse est vraie, divisée par leur probabilité si elle est fausse.' },
      ],
    },
    { type: 'widget', id: 'change-detective', caption: 'Activez les heuristiques de rendu une à une : l\'empreinte (type de script, montant rond, nouveauté de l\'adresse) déplace la probabilité.' },
    { type: 'heading', text: 'L\'empreinte au service du rendu et du cluster' },
    {
      type: 'text',
      md: `L'empreinte logicielle est stable d'une transaction à l'autre pour un même portefeuille. On peut donc s'en servir pour **départager deux sorties** :

- une transaction T est construite avec la version 2, nLockTime = hauteur, RBF signalé, signatures low-R ;
- ses deux sorties sont dépensées plus tard : la sortie A dans une transaction présentant **exactement la même empreinte**, la sortie B dans une transaction version 1, nLockTime à 0, sans RBF ;
- A est vraisemblablement le **rendu** (revenu dans le même portefeuille), B le **paiement** (dépensé par un autre logiciel).

De la même façon, une transaction censée appartenir à un cluster mais dont l'empreinte détonne mérite d'être réexaminée : erreur de clustering, changement de logiciel, ou co-dépense avec un tiers.`,
    },
    {
      type: 'check',
      q: 'Les deux sorties d\'une transaction sont dépensées plus tard. L\'une dans une transaction à l\'empreinte identique à celle de la transaction d\'origine, l\'autre dans une transaction à l\'empreinte très différente. Quelle conclusion prudente ?',
      options: [
        'La première sortie est certainement le rendu',
        'La première sortie est plus probablement le rendu ; l\'indice s\'ajoute aux autres heuristiques sans les remplacer',
        'Les deux sorties appartiennent au même portefeuille',
        'L\'empreinte ne dit rien du rendu',
      ],
      answer: 1,
      explain: 'La continuité d\'empreinte est un indice fort mais pas une preuve : deux utilisateurs du même logiciel produisent la même empreinte. Elle se combine aux heuristiques classiques.',
    },
    { type: 'heading', text: 'Les chaînes EVM ont aussi leurs empreintes' },
    {
      type: 'table',
      headers: ['Signal', 'Observation', 'Intérêt'],
      rows: [
        ['Paramètres de gaz', 'Pourboire (priority fee) et plafond identiques et atypiques', 'Réglage d\'un portefeuille, d\'un script ou d\'un bot'],
        ['Rythme du nonce', 'Rafales de transactions à intervalles fixes, numérotation sans trou', 'Automatisation (script) versus usage manuel'],
        ['Contrats utilisés', 'Routeur de swap intégré à un portefeuille, agrégateur favori, bridge favori', 'Habitudes et logiciel employé'],
        ['Approvals', 'Montant illimité systématique ou montant exact', 'Réglage de sécurité de l\'utilisateur'],
        ['Financement', 'Toujours alimenté par des retraits d\'un même exchange, de montants similaires', 'Lien vers un compte client unique'],
        ['Noms et étiquettes', 'Noms de domaine blockchain, NFT de profil, déploiements signés', 'Identité revendiquée (à vérifier)'],
      ],
    },
    { type: 'heading', text: 'Le temps, révélateur d\'habitudes' },
    {
      type: 'text',
      md: `Tracez l'histogramme des transactions d'un cluster par **heure UTC** et par **jour de la semaine** :

- un creux régulier de six à huit heures suggère une plage de sommeil, donc un **fuseau horaire probable** ;
- une activité concentrée en semaine aux heures de bureau évoque une activité « professionnelle » ;
- une activité continue 24 h/24 à intervalles réguliers évoque un **automate** ;
- des interruptions coïncidant avec des fêtes locales peuvent orienter vers une région.

Ces inférences sont **faibles** : un opérateur peut voyager, travailler la nuit, programmer ses envois ou déléguer. Elles servent à orienter l'OSINT et à tester la compatibilité avec un suspect, pas à localiser quelqu'un.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'L\'horodatage du bloc n\'est pas l\'heure de l\'action',
      md: `L'horodatage d'un bloc Bitcoin est fixé par le mineur, avec une tolérance de plusieurs dizaines de minutes, et une transaction peut attendre longtemps dans la mempool avant d'être minée. Pour une analyse horaire fine, préférez les heures de **première diffusion** quand vous en disposez (nœud enregistrant la mempool, données de service), et raisonnez sur des distributions, pas sur des transactions isolées.`,
    },
    { type: 'heading', text: 'Les montants parlent aussi' },
    {
      type: 'text',
      md: `- **Montants ronds en monnaie fiduciaire** : 0,00791 BTC n'a rien de rond… sauf s'il valait exactement 500 € au cours du moment. Convertir les montants au cours de l'heure fait apparaître des habitudes de prix (rançons, ventes, salaires de mules).
- **Montants récurrents** : versements identiques chaque semaine (rémunération), séries de paiements de même valeur (abonnements, ventes à prix fixe).
- **Fractionnement sous des seuils** : montants systématiquement juste en dessous des seuils de vérification d'un service.
- **Signatures de peel chain** : décroissance régulière, paiements de tailles similaires à chaque saut.`,
    },
    {
      type: 'case',
      title: 'Cas — Deux clusters, une empreinte ?',
      md: `Le cluster A (sextorsion, 214 transactions) et le cluster B (revente de données, 97 transactions) ne partagent aucune transaction. Comparaison sur la même période de six mois :

- tous deux : version 2, nLockTime = hauteur courante, RBF signalé, signatures low-R, P2WPKH exclusivement ;
- tous deux : taux de frais entiers, arrondis au sat/vB, et position du rendu aléatoire ;
- tous deux : aucune activité entre 00:00 et 06:30 UTC sur 180 jours ;
- divergence : le cluster B réutilise 4 adresses de réception, le cluster A jamais.

Population de référence : sur un échantillon de transactions P2WPKH de la même période, la combinaison « v2 + anti fee-sniping + RBF + low-R » est **très répandue** (elle correspond aux réglages par défaut d'un logiciel majeur). Elle n'est donc **pas discriminante**. Le creux horaire est compatible avec un fuseau européen, comme celui de dizaines de millions de personnes.

Conclusion rédigée : « Les deux clusters présentent une empreinte technique compatible avec l'usage d'un même logiciel, largement répandu. Cette compatibilité **ne permet pas** de conclure à un opérateur commun. » Piste à creuser : les quatre adresses réutilisées du cluster B, et une éventuelle destination commune.`,
    },
    {
      type: 'table',
      headers: ['Signal', 'Cluster A', 'Cluster B', 'Rareté dans la population'],
      rows: [
        ['v2 + nLockTime = hauteur + RBF + low-R', 'Oui', 'Oui', 'Très commun'],
        ['Frais entiers en sat/vB', 'Oui', 'Oui', 'Commun'],
        ['Creux 00:00–06:30 UTC', 'Oui', 'Oui', 'Commun (fuseaux européens)'],
        ['Réutilisation d\'adresses', 'Non', 'Oui (4)', 'Divergence'],
      ],
      caption: 'La rareté, pas la ressemblance, fait la valeur d\'un signal.',
    },
    {
      type: 'steps',
      items: [
        { title: 'Établir la référence', md: `Quelle est la fréquence de chaque signal dans des transactions comparables, à la même période ? Les réglages par défaut des logiciels majeurs sont partagés par des millions d'utilisateurs.` },
        { title: 'Relever les signaux', md: `Pour chaque entité, sur une période suffisante : marqueurs techniques, horaires, montants, destinations.` },
        { title: 'Mesurer la rareté', md: `Un signal présent dans 60 % des transactions n'apporte presque rien ; une combinaison rare et stable apporte beaucoup.` },
        { title: 'Vérifier la stabilité', md: `Une empreinte change avec les mises à jour de logiciel : comparez des périodes cohérentes.` },
        { title: 'Chercher le contraire', md: `Divergences, signaux incompatibles : une seule incompatibilité solide peut ruiner une hypothèse.` },
        { title: 'Conclure en compatibilité', md: `« Compatible avec », « n'exclut pas », « soutient faiblement / modérément / fortement l'hypothèse d'un opérateur commun » — jamais « est le même individu ».` },
      ],
    },
    {
      type: 'check',
      q: 'Deux clusters partagent les réglages par défaut d\'un portefeuille très répandu. Quelle est la valeur de cette ressemblance ?',
      options: [
        'Elle prouve un opérateur commun',
        'Elle est faible, car ces réglages sont partagés par une large population',
        'Elle est nulle dans tous les cas',
        'Elle prouve l\'usage d\'un même appareil',
      ],
      answer: 1,
      explain: 'La force d\'un signal dépend de sa rareté dans la population de référence. Un réglage par défaut massivement partagé ne discrimine presque rien.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Penser en rapport de vraisemblance',
      md: `Posez-vous deux questions : « Quelle est la probabilité d'observer ces signaux **si** les deux clusters appartiennent au même opérateur ? » et « Quelle est cette probabilité **s'ils** appartiennent à des opérateurs différents ? ». Si les deux probabilités sont proches, les signaux ne départagent rien, même s'ils « se ressemblent ». C'est la logique de l'évaluation en sciences forensiques, reprise dans la leçon sur l'expertise judiciaire.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : l\'appareil confirme ou infirme',
      md: `L'empreinte devient une preuve solide lorsqu'elle est **confrontée à un appareil saisi** : le logiciel trouvé chez le suspect, sa version et ses réglages (RBF activé, unité de frais, type d'adresse par défaut) correspondent-ils à l'empreinte observée sur toute la période ? Relevez la configuration avant toute manipulation et faites-la figurer au procès-verbal.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Loyauté et prudence',
      md: `Une empreinte de portefeuille est un **indice de compatibilité**. Présentée comme une identification, elle exposerait la procédure à une contestation légitime et des tiers innocents à des soupçons. Mentionnez la population de référence utilisée, les signaux retenus et écartés, et les divergences constatées, y compris celles qui affaiblissent l'hypothèse de l'accusation.`,
    },
  ],
  keyPoints: [
    'Empreinte logicielle (quel logiciel) et empreinte comportementale (quelles habitudes) sont deux niveaux distincts.',
    'Marqueurs Bitcoin : types de scripts, version, nLockTime, nSequence/RBF, ordre des sorties, frais, signatures low-R, sélection des UTXO.',
    'La continuité d\'empreinte aide à identifier le rendu et à contrôler un cluster.',
    'Horaires, montants convertis en monnaie fiduciaire et rythmes révèlent des habitudes, à interpréter avec prudence.',
    'La rareté dans une population de référence, pas la ressemblance, fait la valeur d\'un signal.',
    'Conclure en termes de compatibilité et de force de soutien, jamais d\'identité.',
    'L\'appareil saisi (logiciel, version, réglages) permet de confirmer ou d\'infirmer l\'empreinte.',
  ],
  quiz: [
    {
      q: 'Que signale une valeur nSequence de 0xfffffffd sur les entrées d\'une transaction Bitcoin ?',
      options: [
        'Une transaction CoinJoin',
        'L\'option de remplacement par des frais plus élevés (RBF, BIP125)',
        'Une transaction Lightning',
        'Une erreur du logiciel',
      ],
      answer: 1,
      explain: 'Une valeur inférieure à 0xfffffffe signale le RBF ; 0xfffffffd est la valeur couramment utilisée par les portefeuilles qui l\'activent.',
    },
    {
      q: 'Quels marqueurs relèvent de l\'empreinte logicielle d\'une transaction Bitcoin ?',
      kind: 'multi',
      options: ['nLockTime fixé à la hauteur du bloc courant', 'Ordre lexicographique des sorties (BIP69)', 'Plage horaire d\'activité de l\'utilisateur', 'Signatures systématiquement de 71 octets (low-R)'],
      answer: [0, 1, 3],
      explain: 'La plage horaire est une habitude de l\'utilisateur (empreinte comportementale), pas un choix d\'implémentation.',
    },
    {
      q: 'Un creux d\'activité régulier de 23:00 à 06:00 UTC permet de localiser l\'opérateur au Royaume-Uni.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. C\'est au mieux un indice de fuseau horaire probable, compatible avec de nombreux pays et avec des habitudes de travail atypiques. Il oriente, il ne localise pas.',
    },
    {
      q: 'Pourquoi faut-il établir une population de référence avant de comparer deux empreintes ?',
      options: [
        'Pour respecter une obligation légale',
        'Pour mesurer la rareté de chaque signal : un signal très répandu ne discrimine pas',
        'Pour obtenir les identités des utilisateurs',
        'Ce n\'est pas nécessaire',
      ],
      answer: 1,
      explain: 'Deux entités qui partagent un réglage par défaut massivement répandu ne se distinguent pas du reste de la population.',
    },
    {
      q: 'Une sortie de 0,00791 BTC paraît quelconque. Que vérifier ?',
      options: [
        'Rien, le montant n\'est pas rond',
        'Sa contre-valeur en euros ou en dollars au cours de l\'heure : elle peut correspondre à un montant rond en monnaie fiduciaire',
        'Si elle est un CoinJoin',
        'Son nombre de décimales uniquement',
      ],
      answer: 1,
      explain: 'Les paiements sont souvent fixés en monnaie fiduciaire. Convertis au cours du moment, ils révèlent des prix récurrents.',
    },
    {
      q: 'Quels signaux EVM peuvent suggérer une automatisation (script ou bot) ?',
      kind: 'multi',
      options: [
        'Transactions à intervalles parfaitement réguliers, 24 h/24',
        'Paramètres de gaz identiques et atypiques sur des centaines de transactions',
        'Une unique transaction de financement depuis un exchange',
        'Rafales de nonces consécutifs en quelques secondes',
      ],
      answer: [0, 1, 3],
      explain: 'Un financement unique depuis un exchange est banal et ne renseigne pas sur l\'automatisation.',
    },
    {
      q: 'Quelle formulation convient pour une conclusion fondée sur l\'empreinte ?',
      options: [
        '« Le suspect est l\'auteur des deux séries de transactions »',
        '« Les éléments relevés sont compatibles avec l\'usage d\'un même logiciel et soutiennent faiblement l\'hypothèse d\'un opérateur commun »',
        '« L\'empreinte prouve l\'identité de l\'opérateur »',
        '« Les deux clusters sont identiques »',
      ],
      answer: 1,
      explain: 'L\'empreinte se présente en termes de compatibilité et de force de soutien à une hypothèse, avec ses limites.',
    },
  ],
  flashcards: [
    { front: 'Empreinte logicielle', back: 'Choix techniques du portefeuille lisibles dans la transaction : identifie une famille de logiciels, pas une personne.' },
    { front: 'nLockTime = hauteur courante', back: 'Anti fee-sniping : marqueur de plusieurs portefeuilles (Bitcoin Core, Electrum, Sparrow…).' },
    { front: 'nSequence 0xfffffffd', back: 'Signal RBF (BIP125).' },
    { front: 'BIP69', back: 'Tri lexicographique des entrées/sorties, utilisé par certains logiciels.' },
    { front: 'Low-R', back: 'Signatures affinées à 71 octets, caractéristiques de Bitcoin Core.' },
    { front: 'Continuité d\'empreinte', back: 'La sortie dépensée avec la même empreinte que la transaction d\'origine est plus probablement le rendu.' },
    { front: 'Population de référence', back: 'Transactions comparables servant à mesurer la rareté d\'un signal.' },
    { front: 'Rapport de vraisemblance', back: 'P(observations | même opérateur) / P(observations | opérateurs différents).' },
    { front: 'Analyse horaire', back: 'Histogramme UTC : creux de sommeil → fuseau probable ; activité continue → automate. Indice faible.' },
    { front: 'Montant fiat rond', back: 'Convertir au cours de l\'heure : un montant crypto quelconque peut valoir 500 € pile.' },
    { front: 'Formulation', back: '« Compatible avec », « soutient faiblement/modérément/fortement » — jamais « est ».' },
  ],
}

const demixage: Lesson = {
  id: 'demixage-avance',
  title: 'Démixage : méthodes statistiques et limites',
  level: 5,
  track: 'confidentialite',
  minutes: 40,
  summary:
    'Démixer, c\'est raisonner sous incertitude. Construire l\'ensemble des candidats, pondérer par le timing et les montants, combiner des indices indépendants, calculer des probabilités de lien et l\'entropie d\'une transaction, estimer les taux d\'erreur, éviter le piège des taux de base, et exprimer la force d\'un résultat sans jamais le présenter comme une certitude.',
  objectives: [
    'Modéliser un démixage comme un problème d\'inférence : ensemble de candidats, a priori, mise à jour par les indices.',
    'Calculer des probabilités de lien simples sur une transaction et comprendre la notion d\'entropie.',
    'Évaluer la fiabilité d\'une méthode : faux positifs, précision, taux de base, dépendance entre indices.',
    'Exprimer un résultat de démixage avec une force de soutien explicite et des hypothèses concurrentes.',
  ],
  prerequisites: ['coinjoin', 'privacy-pools', 'analyse-comportementale'],
  practice: ['coinjoin-demix', 'defi-exploit', 'centralized-mixer'],
  blocks: [
    {
      type: 'text',
      md: `Au niveau 4, vous avez appris les heuristiques de démixage : timing, combinaisons, consolidations, erreurs post-mix. Au niveau expert, la question change : **combien vaut** le lien que vous proposez ? Avec quelle probabilité d'erreur ? Sur quelles hypothèses repose-t-il ? Que répondrez-vous à l'expert de la défense qui soutiendra que dix autres déposants auraient pu produire le même retrait ?

Le démixage n'est pas une technique de traçage parmi d'autres : c'est un **raisonnement statistique**, qui doit être conduit et présenté comme tel.`,
    },
    { type: 'heading', text: 'Poser le problème' },
    {
      type: 'text',
      md: `Pour un retrait donné (pool, mixeur, sortie de CoinJoin), il existe un **ensemble de candidats** : les dépôts ou entrées qui auraient pu le financer. Le démixage consiste à répartir une probabilité sur ces candidats.

1. **Contraintes dures** : même pool, même dénomination, dépôt antérieur au retrait, compatibilité des montants. Elles éliminent des candidats avec certitude.
2. **A priori** : sans autre information, chaque candidat restant a la même probabilité, 1/N.
3. **Mise à jour** : chaque indice (délai, combinaison, paramètres de gaz, destination) rend certains candidats plus ou moins vraisemblables.
4. **Résultat** : une distribution de probabilité, pas un nom. Le candidat le plus probable peut rester très incertain.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Ensemble de candidats', def: 'Dépôts ou entrées pouvant avoir financé une sortie donnée, après application des contraintes dures.' },
        { term: 'A priori', def: 'Probabilité attribuée à chaque candidat avant de prendre en compte les indices (souvent uniforme).' },
        { term: 'Rapport de vraisemblance (RV)', def: 'Facteur par lequel un indice multiplie la cote d\'une hypothèse par rapport à une autre.' },
        { term: 'Faux positif', def: 'Lien proposé à tort entre un dépôt et un retrait sans rapport.' },
        { term: 'Précision', def: 'Proportion de liens proposés qui sont exacts.' },
        { term: 'Rappel', def: 'Proportion de liens réels que la méthode retrouve.' },
        { term: 'Taux de base', def: 'Fréquence réelle du phénomène recherché dans la population examinée.' },
        { term: 'Entropie d\'une transaction', def: 'Mesure (en bits) du nombre d\'interprétations possibles reliant entrées et sorties.' },
        { term: 'Vérité terrain', def: 'Cas où le lien réel est connu (aveux, saisie, réponse de plateforme), servant à valider une méthode.' },
      ],
    },
    { type: 'heading', text: 'Pondérer les candidats : un exemple chiffré' },
    {
      type: 'table',
      headers: ['Dépôt candidat (pool 10 ETH)', 'Délai avant le retrait', 'Indices', 'Poids relatif'],
      rows: [
        ['D1 — 0x91ab…', '3 h 50', 'Combinaison identique, paramètres de gaz identiques', '40'],
        ['D2 — 0x2c04…', '6 h 10', 'Aucun', '1'],
        ['D3 — 0x77e1…', '9 h 25', 'Aucun', '1'],
        ['D4 — 0xb3f9…', '2 jours', 'Même relayeur (partagé par 70 % des retraits)', '1,1'],
        ['D5 à D7', '3 à 8 jours', 'Aucun', '1 chacun'],
      ],
      caption: 'Probabilité de D1 ≈ 40 / (40 + 1 + 1 + 1,1 + 3) = 40 / 46,1 ≈ 0,87. Les poids sont des choix d\'analyste : ils doivent être justifiés et soumis à la discussion.',
    },
    {
      type: 'text',
      md: `Ce calcul, même simplifié, apporte trois choses :

- il rend **explicite** ce que l'intuition fait implicitement ;
- il montre que le résultat dépend de **choix** (le poids de 40 attribué à la combinaison identique) qu'il faut justifier — idéalement par des données de validation ;
- il fait apparaître la **probabilité résiduelle** (ici environ 13 %) que le lien soit faux, qu'il faudra mentionner.

Un analyste qui ne peut pas expliquer d'où viennent ses poids ne peut pas défendre sa conclusion.`,
    },
    { type: 'widget', id: 'privacy-pool', caption: 'Faites varier le nombre de dépôts intermédiaires et le délai : observez comment l\'ensemble de candidats plausibles grossit ou fond.' },
    {
      type: 'check',
      q: 'Dans l\'exemple ci-dessus, que signifie une probabilité de 0,87 pour D1 ?',
      options: [
        'Que D1 est certainement à l\'origine du retrait',
        'Que, sous les hypothèses de pondération retenues, D1 est le candidat le plus probable, avec une probabilité résiduelle d\'erreur d\'environ 13 %',
        'Que 87 % des fonds de D1 se retrouvent dans le retrait',
        'Que la méthode a un taux d\'erreur de 87 %',
      ],
      answer: 1,
      explain: 'La probabilité porte sur l\'hypothèse « D1 a financé ce retrait », conditionnellement aux poids choisis. Elle ne vaut que ce que valent ces poids.',
    },
    { type: 'heading', text: 'Le timing comme distribution' },
    {
      type: 'text',
      md: `Le délai entre dépôt et retrait n'est pas un indice binaire (« court = suspect ») : c'est une **distribution**. Les utilisateurs prudents attendent des jours ou des semaines ; les utilisateurs pressés retirent en quelques heures. La valeur d'un délai court dépend de **l'activité du pool** pendant ce délai :

- 4 heures dans un pool qui reçoit 2 dépôts par jour : très peu de candidats concurrents ;
- 4 heures dans un pool qui en reçoit 200 : beaucoup de candidats, l'indice s'effondre.

On raisonne donc en nombre de dépôts concurrents sur la fenêtre, pas en durée brute.`,
    },
    { type: 'widget', id: 'timing-correlation', caption: 'Élargissez la fenêtre et la tolérance : le nombre de candidats croît, la force de chacun décroît.' },
    { type: 'heading', text: 'Combinaisons de montants : mesurer la rareté' },
    {
      type: 'text',
      md: `Lorsqu'un dépôt est réparti en plusieurs dénominations (par exemple 3 × 10 + 2 × 1 + 4 × 0,1 ETH) et que des retraits reproduisent la même répartition, la question décisive est : **combien d'autres combinaisons de dépôts présents sur la fenêtre permettraient de produire les mêmes retraits ?**

C'est un problème de type « somme de sous-ensembles » : on énumère les ensembles de dépôts concurrents compatibles avec les retraits observés. Si une seule combinaison existe, l'indice est fort ; si des centaines existent, il est faible. Énumérez, comptez, et reportez ce nombre dans le rapport : c'est un argument objectif, reproductible et compréhensible.`,
    },
    { type: 'heading', text: 'CoinJoin à montants variables : probabilités de lien et entropie' },
    {
      type: 'text',
      md: `Pour une transaction à entrées et sorties de montants différents, on peut énumérer toutes les **interprétations** compatibles : les façons de répartir les entrées entre participants de sorte que chacun reçoive en sorties ce qu'il a apporté (frais déduits). Deux grandeurs en découlent :

- la **probabilité de lien** entre une entrée et une sortie : la proportion d'interprétations dans lesquelles cette entrée finance cette sortie ;
- l'**entropie** de la transaction : le logarithme en base 2 du nombre d'interprétations. Plus elle est élevée, plus la transaction est ambiguë.

Des outils publics de calcul d'entropie appliquent cette méthode. Elle suppose un modèle (frais négligés ou répartis, participants honnêtes), qu'il faut mentionner.`,
    },
    {
      type: 'case',
      title: 'Cas — Une petite transaction ambiguë',
      md: `Entrées : E1 = 0,5 BTC, E2 = 0,5 BTC. Sorties : S1 = 0,5 BTC, S2 = 0,25 BTC, S3 = 0,25 BTC (frais négligés).

Interprétations à deux participants :

1. E1 → S1 ; E2 → S2 + S3
2. E1 → S2 + S3 ; E2 → S1

S'y ajoute l'interprétation à un seul participant (E1 + E2 → S1 + S2 + S3), qui est celle de la CIOH.

En se limitant aux deux interprétations à deux participants : probabilité de lien E1 → S1 = 1/2, E1 → S2 = 1/2, E1 → S3 = 1/2. Rien ne permet de rattacher S1 à E1 plutôt qu'à E2. En revanche, S2 et S3 appartiennent **toujours au même participant** : c'est un lien certain sous ce modèle, utile pour la suite du traçage.`,
    },
    {
      type: 'check',
      q: 'Dans le cas ci-dessus, quel lien est établi sous le modèle à deux participants ?',
      options: [
        'E1 finance S1',
        'S2 et S3 appartiennent au même participant',
        'E2 finance S3 seule',
        'Aucun lien n\'est établi',
      ],
      answer: 1,
      explain: 'Dans toutes les interprétations à deux participants, S2 et S3 vont ensemble. Le rattachement à E1 ou E2 reste, lui, à 50/50.',
    },
    { type: 'heading', text: 'Évaluer une méthode : le piège du taux de base' },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Un taux de faux positifs de 1 % peut produire 85 % d\'erreurs',
      md: `Une heuristique de démixage a un taux de faux positifs de 1 % et retrouve 90 % des liens réels. On l'applique à 10 000 paires dépôt-retrait candidates, parmi lesquelles seules 20 sont de vrais liens.

- Vrais positifs : 20 × 90 % = **18**.
- Faux positifs : 9 980 × 1 % ≈ **100**.
- Précision : 18 / (18 + 100) ≈ **15 %**.

Sur dix liens proposés par cette méthode « fiable à 99 % », plus de huit sont faux. C'est l'**erreur du taux de base** : appliquée à une large population où le phénomène est rare, une méthode peu sujette à l'erreur produit surtout des erreurs. D'où l'importance de restreindre l'ensemble de candidats **avant** d'appliquer une heuristique, et de combiner des indices indépendants.`,
    },
    {
      type: 'check',
      q: 'Pourquoi une heuristique « fiable à 99 % » peut-elle produire une majorité de faux liens ?',
      options: [
        'Parce que les explorateurs sont imprécis',
        'Parce qu\'appliquée à un très grand nombre de paires où les vrais liens sont rares, même 1 % de faux positifs dépasse largement le nombre de vrais liens',
        'Parce que les mixeurs modifient les montants',
        'Ce n\'est pas possible',
      ],
      answer: 1,
      explain: 'C\'est l\'erreur du taux de base : la précision dépend de la rareté du phénomène dans la population examinée, pas seulement du taux d\'erreur de la méthode.',
    },
    {
      type: 'text',
      md: `Autres exigences d'évaluation :

- **Indépendance des indices** : « même relayeur » et « même horaire » peuvent découler d'un même réglage ou d'une même habitude. Multiplier leurs poids comme s'ils étaient indépendants gonfle artificiellement la confiance.
- **Validation** : une méthode se valide sur des cas où la vérité est connue (aveux, données saisies, réponses de plateformes, utilisateurs ayant déposé et retiré avec la même adresse). Sans validation, les poids sont des opinions.
- **Outils commerciaux** : demandez quelles heuristiques ont produit un « démixage » automatique et quels taux d'erreur ont été mesurés. Une sortie d'outil n'est pas une méthode.`,
    },
    { type: 'heading', text: 'Exprimer le résultat' },
    {
      type: 'steps',
      items: [
        { title: 'Formuler deux hypothèses', md: `H1 : « les retraits proviennent des dépôts de l'adresse X ». H2 : « les retraits proviennent d'autres déposants du pool ». La conclusion porte sur la force avec laquelle les observations soutiennent H1 plutôt que H2.` },
        { title: 'Exposer les contraintes et l\'ensemble de candidats', md: `Pool, fenêtre, nombre de dépôts concurrents, combinaisons alternatives dénombrées.` },
        { title: 'Lister les indices et leur dépendance', md: `Chaque indice, sa mesure, la raison de son poids, les indices regroupés car dépendants.` },
        { title: 'Donner une force de soutien', md: `Échelle verbale (faible, modéré, fort, très fort soutien), en cohérence avec les recommandations des sciences forensiques sur l'expression de la force de la preuve. Jamais « certain ».` },
        { title: 'Indiquer ce qui changerait la conclusion', md: `Un élément qui, s'il était découvert, renforcerait ou ruinerait l'hypothèse : c'est la marque d'une analyse honnête.` },
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'Formulation à proscrire',
        md: `« Le démixage réalisé établit que les fonds retirés le 4 mars appartiennent au suspect. »

Aucune méthode, aucune incertitude, aucune alternative : la première contre-expertise venue la fera tomber, et avec elle la crédibilité du reste du rapport.`,
      },
      right: {
        title: 'Formulation défendable',
        md: `« Compte tenu de la combinaison de dénominations, unique parmi les 214 combinaisons de dépôts possibles sur la fenêtre, du délai de 3 h 50 pendant lequel 7 dépôts concurrents seulement sont intervenus, et de la consolidation ultérieure de la totalité des retraits, les observations apportent un **soutien fort** à l'hypothèse selon laquelle ces retraits proviennent des dépôts de l'adresse 0x91ab…, plutôt que d'autres déposants. »`,
      },
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Un démixage ne fonde pas seul une condamnation',
      md: `En droit français, la preuve est libre mais doit être **contradictoirement discutée** : un démixage, même solide, est un élément parmi d'autres, soumis à l'appréciation du juge. Cherchez systématiquement une **corroboration indépendante** (réponse d'un exchange, données saisies, OSINT) et mentionnez tous les éléments recueillis, y compris ceux qui affaiblissent l'hypothèse.`,
    },
  ],
  keyPoints: [
    'Démixer = répartir une probabilité sur un ensemble de candidats, après contraintes dures, a priori et mise à jour par les indices.',
    'Les poids attribués aux indices doivent être justifiés, idéalement par des données de validation.',
    'Le timing se mesure en nombre de dépôts concurrents sur la fenêtre, pas en durée brute.',
    'Combinaisons de montants : dénombrer les combinaisons alternatives est un argument objectif et reproductible.',
    'Probabilités de lien et entropie quantifient l\'ambiguïté d\'une transaction à montants variables.',
    'Erreur du taux de base : un faible taux de faux positifs peut donner une précision catastrophique sur une grande population.',
    'Conclure par une force de soutien entre hypothèses concurrentes, jamais par une certitude ; corroborer.',
  ],
  quiz: [
    {
      q: 'Quelle est la première étape d\'un démixage rigoureux ?',
      options: [
        'Choisir le candidat le plus suspect',
        'Construire l\'ensemble des candidats en appliquant les contraintes dures (pool, antériorité, montants)',
        'Appliquer l\'outil commercial',
        'Rédiger la conclusion',
      ],
      answer: 1,
      explain: 'Les contraintes dures éliminent des candidats avec certitude ; c\'est sur l\'ensemble restant que portent les probabilités.',
    },
    {
      q: 'Une heuristique a 2 % de faux positifs. On l\'applique à 5 000 paires candidates contenant 10 vrais liens, tous détectés. Combien de faux liens environ ?',
      options: ['2', '10', 'Environ 100', 'Environ 1 000'],
      answer: 2,
      explain: '4 990 × 2 % ≈ 100 faux positifs, pour 10 vrais : précision d\'environ 9 %. C\'est l\'erreur du taux de base.',
    },
    {
      q: 'Quelles pratiques rendent un démixage plus défendable ?',
      kind: 'multi',
      options: [
        'Dénombrer les combinaisons alternatives de dépôts compatibles',
        'Justifier les poids des indices par des cas de validation',
        'Multiplier les poids d\'indices dépendants comme s\'ils étaient indépendants',
        'Indiquer ce qui changerait la conclusion',
      ],
      answer: [0, 1, 3],
      explain: 'Traiter des indices dépendants comme indépendants surestime la confiance : c\'est une faute méthodologique.',
    },
    {
      q: 'La force d\'un délai court entre un dépôt et un retrait dépend du nombre de dépôts concurrents intervenus pendant ce délai.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: 'Vrai. Sa force dépend du nombre de dépôts concurrents pendant ces 4 heures : quasi nul dans un pool très actif, fort dans un pool peu actif.',
    },
    {
      q: 'Que mesure l\'entropie d\'une transaction de type CoinJoin à montants variables ?',
      options: [
        'Le montant des frais',
        'Le nombre d\'interprétations possibles reliant entrées et sorties (en bits)',
        'La vitesse de confirmation',
        'Le nombre d\'adresses réutilisées',
      ],
      answer: 1,
      explain: 'L\'entropie est le logarithme en base 2 du nombre d\'interprétations compatibles : plus elle est élevée, plus la transaction est ambiguë.',
    },
    {
      q: 'Quelles formulations sont acceptables dans un rapport de démixage ?',
      kind: 'multi',
      options: [
        '« Les observations apportent un soutien fort à l\'hypothèse H1 plutôt qu\'à H2 »',
        '« Les fonds appartiennent certainement au suspect »',
        '« Le candidat D1 est le plus probable, sous les hypothèses de pondération exposées, avec une probabilité résiduelle d\'erreur non négligeable »',
        '« Le démixage est infaillible »',
      ],
      answer: [0, 2],
      explain: 'Un démixage s\'exprime en force de soutien et en probabilités conditionnelles, jamais en certitude.',
    },
    {
      q: 'Un outil commercial affiche « démixé » sur un retrait. Que faire avant de reprendre ce résultat ?',
      options: [
        'Le reprendre tel quel : l\'outil est reconnu',
        'Demander quelles heuristiques ont été appliquées, avec quels taux d\'erreur, et vérifier soi-même les indices',
        'L\'ignorer complètement',
        'Le présenter comme une preuve certaine',
      ],
      answer: 1,
      explain: 'Une sortie d\'outil n\'est pas une méthode : il faut pouvoir l\'expliquer, la vérifier et la soumettre au contradictoire.',
    },
  ],
  flashcards: [
    { front: 'Ensemble de candidats', back: 'Dépôts pouvant avoir financé une sortie, après contraintes dures.' },
    { front: 'A priori uniforme', back: 'Chaque candidat restant a la probabilité 1/N avant les indices.' },
    { front: 'Rapport de vraisemblance', back: 'Facteur par lequel un indice modifie la cote d\'une hypothèse face à une autre.' },
    { front: 'Erreur du taux de base', back: 'Sur une grande population où le phénomène est rare, même peu de faux positifs dominent les vrais.' },
    { front: 'Précision', back: 'Part des liens proposés qui sont exacts.' },
    { front: 'Indices dépendants', back: 'Issus d\'une même cause (réglage, habitude) : ne pas multiplier leurs poids.' },
    { front: 'Entropie d\'une transaction', back: 'log₂ du nombre d\'interprétations entrées → sorties compatibles.' },
    { front: 'Probabilité de lien', back: 'Proportion des interprétations où une entrée finance une sortie.' },
    { front: 'Timing', back: 'Se mesure en dépôts concurrents sur la fenêtre, pas en durée brute.' },
    { front: 'Conclusion type', back: 'Force de soutien à H1 plutôt qu\'à H2, contraintes et candidats exposés, ce qui changerait la conclusion.' },
  ],
}

const etatiques: Lesson = {
  id: 'acteurs-etatiques',
  title: 'Acteurs étatiques et groupes APT',
  level: 5,
  track: 'typologies',
  minutes: 35,
  summary:
    'Les plus gros vols de crypto-actifs de l\'histoire ont été publiquement attribués à des acteurs liés à un État. Ce que disent les sources publiques sur leurs méthodes d\'accès initial et de blanchiment (conversion rapide, fractionnement massif, mixeurs, bridges, BTC, OTC, dormance), les niveaux d\'attribution, le rôle des sanctions, et ce que peut faire concrètement un enquêteur confronté à ce type d\'affaire.',
  objectives: [
    'Situer, à partir de sources publiques, les principaux schémas de vols attribués à des acteurs étatiques.',
    'Reconnaître les techniques de blanchiment récurrentes décrites dans les rapports publics.',
    'Distinguer chevauchement technique, similarité de méthodes et attribution officielle.',
    'Conduire les actes utiles (préservation, alertes, gel, signalement, coopération) dans une affaire à dimension étatique.',
  ],
  prerequisites: ['defi-exploits', 'cooperation-internationale', 'coinjoin', 'bridges'],
  practice: ['defi-exploit', 'chain-hopping'],
  blocks: [
    {
      type: 'text',
      md: `Une start-up française de services crypto vous appelle : son portefeuille chaud a été vidé dans la nuit. Quelques heures plus tard, les fonds sont déjà éclatés sur des centaines d'adresses, convertis en ETH, et commencent à franchir des bridges vers Bitcoin. Le rythme, la discipline et les outils ressemblent trait pour trait à ce que décrivent les rapports publics sur certains groupes liés à un État.

Ce type d'affaire dépasse le cadre d'une enquête ordinaire. Mais l'enquêteur de terrain y a un rôle décisif : les **premières heures** et la **qualité de la documentation** conditionnent tout ce qui suivra, y compris au niveau international.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Périmètre de cette leçon',
      md: `Cette leçon s'appuie exclusivement sur des **sources publiques** : avis du FBI et du Trésor américain, désignations de sanctions, rapports du panel d'experts des Nations unies sur la Corée du Nord (dont le mandat a pris fin en 2024), publications de sociétés d'analyse et de cybersécurité. L'attribution d'une attaque à un État relève de services spécialisés : votre rôle est de tracer, préserver, coopérer et faire remonter l'information par la voie hiérarchique vers les services compétents.`,
    },
    { type: 'heading', text: 'Ce que disent les sources publiques' },
    {
      type: 'table',
      headers: ['Événement (public)', 'Date', 'Ampleur publiée', 'Attribution publique'],
      rows: [
        ['Piratage du bridge Ronin', 'Mars 2022', 'Plus de 600 M USD', 'FBI : groupe lié à la Corée du Nord (Lazarus)'],
        ['Piratage du bridge Horizon (Harmony)', 'Juin 2022', 'Environ 100 M USD', 'FBI : groupe lié à la Corée du Nord'],
        ['Piratage de l\'exchange Bybit', 'Février 2025', 'Environ 1,5 Md USD', 'FBI : acteurs nord-coréens (« TraderTraitor »)'],
      ],
      caption: 'Ordres de grandeur publiés au moment des faits ; les montants en dollars varient selon le cours retenu. Les noms de groupes diffèrent selon les sources (Lazarus, APT38, TraderTraitor, BlueNoroff…).',
    },
    {
      type: 'text',
      md: `Selon les rapports publics, ces vols financent en partie les programmes d'un État sous sanctions internationales. Ils ont plusieurs points communs : cible à forte valeur (bridge, exchange, entreprise crypto), accès obtenu **hors chaîne** par l'humain ou la chaîne logistique, puis blanchiment industriel, rapide et méthodique.`,
    },
    { type: 'heading', text: 'L\'accès initial : rarement un « bug »' },
    {
      type: 'steps',
      items: [
        { title: 'Ingénierie sociale ciblée', md: `Fausses offres d'emploi, faux recruteurs, faux tests techniques envoyés à des développeurs ou à des employés disposant d'accès sensibles.` },
        { title: 'Logiciels piégés', md: `Applications de trading ou de portefeuille trojanisées, paquets de code malveillants publiés sur des dépôts publics.` },
        { title: 'Compromission de la chaîne de signature', md: `Prise de contrôle des postes ou des interfaces utilisées pour signer les transactions d'un multisig : les signataires approuvent une transaction différente de celle qu'ils croient signer.` },
        { title: 'Faux travailleurs informatiques', md: `Des rapports publics décrivent des informaticiens se faisant embaucher à distance sous de fausses identités, ce qui leur ouvre des accès internes.` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Sur le terrain : l\'enquête commence chez la victime',
      md: `Quand la victime est une entreprise : préservez les postes des personnes disposant d'accès de signature, les échanges avec d'éventuels « recruteurs », les journaux de l'infrastructure de signature, les fichiers reçus. Selon le statut de la victime, la réponse à incident peut impliquer l'ANSSI ou des prestataires spécialisés : coordonnez-vous pour que les investigations techniques ne détruisent pas d'éléments de preuve.`,
    },
    { type: 'heading', text: 'Le blanchiment industriel' },
    {
      type: 'flow',
      nodes: [
        { id: 'v', label: 'Portefeuille chaud victime', kind: 'victim' },
        { id: 'a', label: 'Adresses de réception', kind: 'suspect', sub: 'quelques adresses' },
        { id: 'dex', label: 'DEX', kind: 'dex', sub: 'jetons → ETH' },
        { id: 'frag', label: 'Centaines d\'adresses', kind: 'wallet', sub: 'fractionnement' },
        { id: 'br', label: 'Bridges / swaps inter-chaînes', kind: 'bridge', sub: 'ETH → BTC' },
        { id: 'cj', label: 'Mixeurs / CoinJoin', kind: 'mixer' },
        { id: 'peel', label: 'Peel chains', kind: 'wallet', sub: 'mois, années' },
        { id: 'otc', label: 'OTC / comptes d\'exchange', kind: 'exchange', sub: 'USDT, fiat' },
      ],
      edges: [
        { from: 'v', to: 'a', label: 'vol' },
        { from: 'a', to: 'dex', label: 'minutes' },
        { from: 'dex', to: 'frag', label: 'heures' },
        { from: 'frag', to: 'br', label: 'jours' },
        { from: 'br', to: 'cj' },
        { from: 'cj', to: 'peel', dashed: true },
        { from: 'peel', to: 'otc', label: 'sortie lente' },
      ],
      caption: 'Schéma synthétique tiré des rapports publics. L\'ordre et les outils varient selon les affaires et évoluent avec les sanctions et démantèlements.',
    },
    {
      type: 'table',
      headers: ['Phase', 'Technique décrite publiquement', 'Opportunité pour l\'enquêteur'],
      rows: [
        ['Conversion', 'Échange immédiat des jetons gelables (stablecoins, jetons de protocoles) contre de l\'ETH', 'Gel par les émetteurs dans les premières heures'],
        ['Fractionnement', 'Dispersion sur des centaines d\'adresses à montants proches', 'Les adresses partagent un financeur et un rythme : clustering comportemental'],
        ['Mélange', 'Mixeurs (dont certains sanctionnés puis démantelés), pools de confidentialité, CoinJoin', 'Démixage, surveillance des sorties'],
        ['Changement de chaîne', 'Bridges et protocoles de swap inter-chaînes vers Bitcoin ou Tron', 'Liens déterministes par les événements des bridges'],
        ['Dormance', 'Fonds immobilisés des mois ou des années', 'Alertes de long terme sur toutes les adresses'],
        ['Sortie', 'Courtiers OTC, comptes d\'exchange ouverts avec de fausses identités, USDT-TRC20', 'Réquisitions, gel, coopération internationale'],
      ],
    },
    { type: 'widget', id: 'peel-chain', caption: 'Une peel chain de sortie : petits prélèvements réguliers vers des services, sur une longue durée.' },
    {
      type: 'check',
      q: 'Pourquoi les auteurs de ces vols convertissent-ils d\'abord les stablecoins et jetons de protocoles en ETH ?',
      options: [
        'Pour profiter d\'un meilleur cours',
        'Parce que ces actifs peuvent être gelés par leur émetteur ou leur protocole, contrairement à l\'ETH natif',
        'Parce que l\'ETH est anonyme',
        'Par habitude, sans raison particulière',
      ],
      answer: 1,
      explain: 'Les actifs à fonction de gel sont un risque pour l\'attaquant ; l\'ETH natif n\'en a pas. D\'où l\'importance des demandes de gel immédiates.',
    },
    {
      type: 'case',
      title: 'Cas — La nuit de la start-up',
      md: `**02:41 UTC** : le portefeuille chaud de la société (multisig 2-sur-3) signe une transaction transférant 9,8 M USDT et 2 100 ETH vers \`0x4af0…\`. Deux signataires ont approuvé ce qu'ils croyaient être un réapprovisionnement de routine. L'un d'eux avait passé, trois semaines plus tôt, un « test technique » pour une offre d'emploi.

**02:44 à 03:20 UTC** : 9,8 M USDT échangés contre de l'ETH sur trois DEX — sauf 1,2 M USDT bloqués par l'émetteur à 03:05 UTC, sur demande de la société relayée par un enquêteur via le portail de l'émetteur.

**03:20 à 09:00 UTC** : environ 5 900 ETH répartis sur 214 adresses (montants de 25 à 30 ETH), toutes financées en gaz par la même adresse.

**J+1 à J+3** : passage par ArcBridge vers Bitcoin ; regroupement, puis entrée dans des CoinJoin ; premières peel chains vers des services à faible KYC et vers SatsDesk OTC.

Actes : préservation chez la victime (postes des signataires, échanges avec le faux recruteur), liste horodatée des 214 adresses, alertes et diffusion aux plateformes, réquisitions et demandes de gel à chaque arrivée sur un service, remontée vers les services spécialisés et Europol. Le gel de 1,2 M USDT n'a été obtenu que parce que la demande est partie 24 minutes après le vol.`,
    },
    { type: 'heading', text: 'Attribuer : trois niveaux à ne pas confondre' },
    {
      type: 'table',
      headers: ['Niveau', 'Exemple', 'Ce qu\'on peut écrire'],
      rows: [
        ['Chevauchement technique', 'Des fonds transitent par des adresses désignées publiquement (sanctions, avis officiels)', '« Les fonds ont transité par l\'adresse X, désignée le [date] par [autorité] comme liée à [groupe]. »'],
        ['Similarité de méthodes', 'Mêmes étapes, mêmes outils, même rythme que dans des rapports publics', '« Le schéma observé présente des similitudes avec ceux décrits dans [sources]. » Indice faible seul.'],
        ['Attribution officielle', 'Déclaration d\'une autorité compétente', 'Citer la source et la date ; ne pas reprendre une attribution sans référence.'],
      ],
      caption: 'Des groupes criminels imitent les méthodes d\'autres ; des opérations sous faux drapeau existent. La similarité de méthodes ne suffit jamais à attribuer.',
    },
    {
      type: 'check',
      q: 'Votre analyse montre un schéma de blanchiment très semblable à celui décrit dans un rapport public sur un groupe étatique. Que pouvez-vous écrire ?',
      options: [
        '« L\'attaque a été commise par ce groupe étatique »',
        '« Le schéma présente des similitudes avec celui décrit dans [source, date] » — sans attribution',
        'Rien du tout',
        '« Le groupe est certainement impliqué car les montants sont proches »',
      ],
      answer: 1,
      explain: 'La similarité de méthodes est un indice faible ; l\'attribution relève d\'autorités compétentes et doit être sourcée.',
    },
    { type: 'heading', text: 'Les sanctions, outil et contrainte' },
    {
      type: 'text',
      md: `- Le Trésor américain (OFAC) publie des listes de personnes et d'entités sanctionnées, qui comportent parfois des **adresses de crypto-actifs**. L'Union européenne adopte ses propres mesures restrictives. En France, la direction générale du Trésor est l'autorité compétente en matière de gel des avoirs au titre des sanctions.
- Des services de mixage utilisés par ces groupes ont été sanctionnés, puis pour certains démantelés : leur exposition dans un flux est un **signal fort**.
- Les plateformes régulées filtrent ces adresses : une exposition directe déclenche souvent un blocage spontané, et une réponse rapide à une réquisition.
- Les autorités américaines ont publiquement engagé des procédures de confiscation civile visant des fonds liés à ces vols : la coopération internationale permet parfois de coordonner les saisies.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Faire remonter et coordonner',
      md: `Une affaire présentant des indices d'implication d'un acteur étatique soulève des enjeux qui dépassent l'enquête judiciaire (sécurité nationale, sanctions, diplomatie). Informez votre hiérarchie et le magistrat sans délai, et suivez les circuits définis pour la saisine des services spécialisés. Ne communiquez pas sur l'attribution en dehors de ces circuits.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'APT', def: 'Advanced Persistent Threat : groupe disposant de moyens importants, souvent lié à un État, menant des opérations ciblées et durables.' },
        { term: 'Liste SDN', def: 'Liste des personnes et entités sanctionnées par l\'OFAC, comportant parfois des adresses de crypto-actifs.' },
        { term: 'Faux drapeau', def: 'Opération conçue pour être attribuée à un autre acteur.' },
        { term: 'Dormance', def: 'Immobilisation prolongée de fonds volés, en attendant que l\'attention retombe.' },
        { term: 'Chevauchement technique', def: 'Lien objectif entre une affaire et des éléments déjà attribués (adresses, infrastructure).' },
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'La patience est une arme',
      md: `Les fonds de ces vols peuvent rester dormants très longtemps. Placez des **alertes de long terme** sur toutes les adresses identifiées, y compris les centaines d'adresses de fractionnement : le jour où un fragment touche un service régulé, une fenêtre de gel s'ouvre, parfois des années après les faits.`,
    },
  ],
  keyPoints: [
    'Plusieurs des plus gros vols publics ont été attribués par le FBI à des acteurs liés à la Corée du Nord (Ronin, Harmony, Bybit).',
    'L\'accès initial est le plus souvent hors chaîne : ingénierie sociale, logiciels piégés, compromission de la chaîne de signature.',
    'Blanchiment type : conversion en ETH, fractionnement massif, bridges vers BTC, mélange, peel chains, dormance, sortie OTC.',
    'Les premières heures permettent seules de geler les actifs gelables.',
    'Chevauchement technique, similarité de méthodes et attribution officielle sont trois niveaux distincts ; la similarité seule n\'attribue pas.',
    'Les listes de sanctions (OFAC, UE) incluent parfois des adresses ; en France, la DG Trésor est compétente pour le gel au titre des sanctions.',
    'Faire remonter l\'affaire par les circuits prévus, et maintenir des alertes de long terme.',
  ],
  quiz: [
    {
      q: 'Selon les sources publiques, quel est le vecteur d\'accès initial le plus caractéristique des grands vols attribués à des acteurs étatiques ?',
      options: [
        'Une faille cryptographique de Bitcoin',
        'L\'ingénierie sociale et la compromission hors chaîne (faux recrutements, logiciels piégés, chaîne de signature)',
        'Le minage malveillant',
        'L\'achat de clés privées sur le darknet uniquement',
      ],
      answer: 1,
      explain: 'Les rapports publics décrivent surtout des accès obtenus par l\'humain et la chaîne logistique, pas des failles cryptographiques.',
    },
    {
      q: 'Quelles étapes figurent couramment dans les schémas de blanchiment décrits publiquement ?',
      kind: 'multi',
      options: [
        'Conversion rapide des actifs gelables en ETH',
        'Fractionnement sur des centaines d\'adresses',
        'Dépôt immédiat de la totalité sur un exchange régulé européen au nom de l\'auteur',
        'Passage par des bridges vers Bitcoin puis par des mixeurs ou CoinJoin',
      ],
      answer: [0, 1, 3],
      explain: 'Un dépôt direct et nominatif sur un exchange régulé serait l\'inverse de la discipline observée.',
    },
    {
      q: 'Une forte similarité de méthodes avec un rapport public suffit à attribuer une attaque à un groupe étatique.',
      kind: 'truefalse',
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: 'Faux. Les méthodes s\'imitent et les faux drapeaux existent. L\'attribution relève d\'autorités compétentes et doit être sourcée.',
    },
    {
      q: 'Des fonds de l\'affaire transitent par une adresse figurant sur une liste de sanctions publiée. Comment le rédiger ?',
      options: [
        '« L\'auteur est le groupe X »',
        '« Les fonds ont transité par l\'adresse A, désignée le [date] par [autorité] comme liée à [entité] »',
        'Ne pas le mentionner',
        '« L\'auteur est probablement sanctionné »',
      ],
      answer: 1,
      explain: 'On rapporte le fait (transit) et la source (désignation datée), sans extrapoler sur l\'identité des auteurs.',
    },
    {
      q: 'En France, quelle autorité est compétente pour le gel des avoirs au titre des sanctions ?',
      options: ['TRACFIN', 'La direction générale du Trésor', 'L\'AMF', 'La CNIL'],
      answer: 1,
      explain: 'La DG Trésor met en œuvre les mesures de gel des avoirs. TRACFIN est la cellule de renseignement financier, l\'AMF le régulateur des marchés.',
    },
    {
      q: 'Quels actes sont prioritaires dans les heures suivant un vol présentant ces caractéristiques ?',
      kind: 'multi',
      options: [
        'Demandes de gel des actifs gelables encore détenus',
        'Préservation des postes et échanges des personnes ayant des accès de signature',
        'Publication d\'un communiqué attribuant l\'attaque',
        'Liste horodatée des adresses et alertes de surveillance',
      ],
      answer: [0, 1, 3],
      explain: 'L\'attribution publique ne relève pas de l\'enquêteur et peut nuire aux investigations.',
    },
  ],
  flashcards: [
    { front: 'APT', back: 'Groupe à moyens importants, souvent lié à un État, menant des opérations ciblées et durables.' },
    { front: 'Vols publics attribués par le FBI à la Corée du Nord', back: 'Ronin (2022), Harmony Horizon (2022), Bybit (2025), entre autres.' },
    { front: 'Accès initial typique', back: 'Faux recrutements, logiciels piégés, compromission de l\'interface de signature.' },
    { front: 'Première étape du blanchiment', back: 'Convertir les actifs gelables en ETH : d\'où l\'urgence des demandes de gel.' },
    { front: 'Fractionnement', back: 'Centaines d\'adresses à montants proches, souvent un financeur de gaz commun.' },
    { front: 'Dormance', back: 'Fonds immobilisés longtemps : alertes de long terme indispensables.' },
    { front: 'Trois niveaux d\'attribution', back: 'Chevauchement technique / similarité de méthodes / attribution officielle.' },
    { front: 'Faux drapeau', back: 'Opération conçue pour être attribuée à un autre acteur.' },
    { front: 'Liste SDN', back: 'Liste OFAC des personnes et entités sanctionnées, parfois avec adresses crypto.' },
    { front: 'Gel au titre des sanctions en France', back: 'Direction générale du Trésor.' },
  ],
}

export const L5_ANALYSE: Lesson[] = [comportementale, demixage, etatiques]
