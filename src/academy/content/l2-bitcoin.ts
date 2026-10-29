// Niveau 2 — filière Bitcoin : rendu, clustering, peel chains.
import type { Lesson } from '../model'

export const L2_BITCOIN: Lesson[] = [
  // ════════════════════════════════════════════════════════════════════════
  // DÉTECTER L'ADRESSE DE RENDU
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'change-heuristics',
    title: "Détecter l'adresse de rendu",
    level: 2,
    track: 'bitcoin',
    minutes: 30,
    summary:
      "Décider quelle sortie est le paiement et laquelle revient au payeur est le geste le plus fréquent — et le plus risqué — de l'analyse Bitcoin. Les heuristiques une par une, leur fiabilité, leurs faux positifs, la façon dont SPECTRA les pondère, et la manière de documenter une décision qui résistera au contradictoire.",
    objectives: [
      'Expliquer pourquoi une transaction Bitcoin produit presque toujours une sortie de rendu, et pourquoi rien ne la signale explicitement.',
      'Appliquer les principales heuristiques de rendu (adresse neuve, montant rond, type de script, entrée superflue, comportement ultérieur) et en connaître les faux positifs.',
      'Lire le score et les raisons pondérées affichés par SPECTRA, sans les confondre avec une certitude.',
      'Reconnaître les transactions où les heuristiques ne s\'appliquent pas (paiements groupés, envoi à soi-même, PayJoin, CoinJoin).',
      'Rédiger la justification d\'un choix de rendu avec un niveau de confiance explicite.',
    ],
    prerequisites: ['utxo', 'frais-mempool', 'suivre-flux'],
    blocks: [
      {
        type: 'text',
        md: `Suivre des fonds sur Bitcoin, c'est décider à chaque transaction **quelle sortie reste sous le contrôle de l'auteur**. Une erreur unique fait bifurquer la trace vers un tiers — un commerçant, une autre victime, un exchange — et peut, trois ou quatre sauts plus loin, aboutir à une réquisition visant un innocent.

Or aucune transaction ne contient de champ « ceci est le rendu ». On raisonne donc avec des **heuristiques** : des règles empiriques, issues du comportement habituel des logiciels de portefeuille, qui ont chacune un taux d'erreur. La règle d'or de cette leçon : **plusieurs heuristiques concordantes, aucune contradictoire, et une confiance notée par écrit**.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Une erreur se propage',
        md: `Une fausse décision de rendu ne coûte pas « un saut » : tout ce qui suit est construit dessus. Si vous suivez le paiement en croyant suivre le rendu, vous suivez désormais les fonds **d'une autre personne**. Plus la trace est longue, plus la vérification des premiers sauts est importante.`,
      },
      { type: 'heading', text: 'Rappel : d\'où vient le rendu' },
      {
        type: 'text',
        md: `Une UTXO se dépense **en entier**, comme un billet. Pour payer 0,05 BTC avec une pièce de 0,08 BTC, le portefeuille crée deux sorties : 0,05 BTC vers le destinataire, et environ 0,03 BTC (moins les frais) vers une adresse qu'il contrôle lui-même. Cette seconde sortie est le **rendu** (*change*).

Les portefeuilles modernes (HD, BIP32/44/84/86) génèrent une **nouvelle adresse de rendu** à chaque transaction, sur une branche dédiée de leur arbre de clés. C'est la source de la plupart des heuristiques : le rendu « ressemble » au portefeuille qui l'a produit, et pas au destinataire.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'in1', label: 'bc1q…4k7m', kind: 'suspect', sub: '0,41820000 BTC' },
          { id: 'in2', label: 'bc1q…p0zd', kind: 'suspect', sub: '0,30000000 BTC' },
          { id: 'tx', label: 'tx a3f1…c09e', kind: 'tx', sub: 'bloc 861 204' },
          { id: 'pay', label: '3J98t1…WNLy', kind: 'deposit', sub: '47 réceptions passées' },
          { id: 'chg', label: 'bc1q…h2xw', kind: 'wallet', sub: 'jamais vue' },
        ],
        edges: [
          { from: 'in1', to: 'tx', label: '0,4182' },
          { from: 'in2', to: 'tx', label: '0,30' },
          { from: 'tx', to: 'pay', label: '0,65 BTC (paiement ?)' },
          { from: 'tx', to: 'chg', label: '0,06805410 BTC (rendu ?)' },
        ],
        caption: 'Une transaction à deux entrées et deux sorties : laquelle des deux sorties revient au payeur ? Frais : 0,0001459 BTC.',
      },
      { type: 'heading', text: 'Les heuristiques, une par une' },
      {
        type: 'table',
        headers: ['Heuristique', 'Idée', 'Fiabilité', 'Faux positifs typiques'],
        rows: [
          ['Réutilisation de l\'adresse d\'entrée', 'Le rendu revient sur une adresse qui figure en entrée', 'Très élevée', 'Quasi aucun ; pratique de vieux portefeuilles et de certains services'],
          ['Adresse neuve', 'Le rendu part vers une adresse jamais vue ; le paiement vers une adresse déjà active', 'Moyenne', 'Paiement vers une adresse de dépôt neuve (exchanges : une adresse par client)'],
          ['Montant rond', 'Le paiement est rond (0,05 BTC ou 500 €) ; le rendu absorbe les décimales', 'Moyenne', 'Paiement fixé en euros (non rond en BTC), rendu rond par hasard'],
          ['Même type de script', 'Le rendu a le type des entrées (bc1q… si les entrées sont bc1q…)', 'Moyenne à élevée', 'Paiement vers un utilisateur du même logiciel ; portefeuilles qui alignent volontairement les types'],
          ['Entrée superflue', 'Une sortie plus petite que la plus petite entrée est le rendu', 'Moyenne', 'Sélection de pièces atypique, consolidation volontaire, PayJoin'],
          ['Empreinte du portefeuille', 'Version, nLockTime, RBF, ordre des sorties, taux de frais : le rendu est redépensé « avec la même main »', 'Élevée si plusieurs marqueurs', 'Deux acteurs utilisant le même logiciel'],
          ['Comportement ultérieur', 'Le rendu est redépensé avec les autres pièces du payeur ; le paiement est balayé par un service', 'Élevée', 'Délais longs, fonds dormants'],
        ],
        caption: 'Aucune heuristique n\'est suffisante seule : c\'est leur concordance qui fonde la décision.',
      },
      {
        type: 'text',
        md: `**L'entrée superflue** mérite qu'on s'y arrête, car elle est souvent mal comprise. Un portefeuille cherche à payer avec le moins d'entrées possible (chaque entrée coûte des frais). Imaginons des entrées de 0,50 et 0,20 BTC, et des sorties de 0,64 et 0,0598 BTC :

- si le paiement était **0,0598 BTC**, l'entrée de 0,50 suffisait à elle seule : ajouter celle de 0,20 n'avait aucun sens ;
- si le paiement est **0,64 BTC**, aucune entrée seule ne suffit : les deux sont nécessaires, et 0,0598 est le reste.

Conclusion : la sortie **inférieure à la plus petite entrée** est probablement le rendu. L'heuristique ne s'applique qu'aux transactions à plusieurs entrées et tombe en défaut quand le portefeuille consolide volontairement ses pièces.`,
      },
      {
        type: 'check',
        q: 'Entrées : 0,12 BTC et 0,09 BTC. Sorties : 0,20000000 BTC et 0,00987650 BTC. Que suggère l\'heuristique de l\'entrée superflue ?',
        options: [
          'Le rendu est 0,20 BTC',
          'Le rendu est 0,0098765 BTC',
          'L\'heuristique ne s\'applique pas à cette transaction',
          'Il n\'y a pas de rendu',
        ],
        answer: 1,
        explain: '0,0098765 est inférieur à la plus petite entrée (0,09). Pour payer 0,0098765, l\'entrée de 0,12 suffisait : l\'ajout de 0,09 n\'aurait servi à rien. En revanche, payer 0,20 exige les deux entrées. 0,20 (montant rond, de surcroît) est donc le paiement.',
      },
      { type: 'heading', text: 'Empreinte du portefeuille et comportement ultérieur' },
      {
        type: 'text',
        md: `Chaque logiciel de portefeuille laisse une **empreinte** dans les transactions qu'il construit : version de transaction, valeur du \`nLockTime\` (beaucoup de portefeuilles y placent la hauteur du bloc courant, protection dite *anti fee-sniping*), signalement RBF ou non, ordre des entrées et sorties (aléatoire, ou tri lexicographique BIP69), arrondi du taux de frais, types d'adresses utilisés.

Le raisonnement est le suivant : la sortie qui est **redépensée plus tard avec la même empreinte** que la transaction étudiée est probablement le rendu (même logiciel, donc même acteur) ; celle qui est redépensée avec une empreinte différente appartient probablement à quelqu'un d'autre.

Le **comportement ultérieur** est souvent l'indice le plus parlant :

- une sortie **balayée** quelques heures plus tard dans une consolidation de 150 entrées vers une seule adresse est typiquement une adresse de dépôt d'exchange — c'était donc le paiement ;
- une sortie **dépensée avec d'autres adresses du même cluster** que les entrées est le rendu (c'est aussi ce qui fait grossir les clusters, voir la leçon suivante) ;
- une sortie qui **reproduit le même schéma** que la transaction précédente (petite sortie + grosse sortie, même délai) prolonge une peel chain.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Dans l\'espace d\'enquête : la carte « Empreinte du portefeuille »',
        md: `L'inspecteur d'une transaction Bitcoin affiche sa version, son \`nLockTime\`, le signalement RBF, l'ordre des sorties, le taux de frais et les familles de logiciels compatibles. Il la compare aussi à la transaction qui a financé l'entrée. L'analyse de rendu intègre la comparaison avec la transaction qui **redépense** chaque sortie (« même empreinte » ou « autre logiciel »). L'onglet *Cluster* d'une adresse résume l'empreinte de toutes ses dépenses : plusieurs empreintes pour une même adresse trahissent un changement de logiciel ou de main.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Tester la rondeur en euros',
        md: `Beaucoup de paiements sont fixés en monnaie fiduciaire. Une sortie de \`0,00812345 BTC\` n'a rien de rond… mais au cours du jour (61 560 €/BTC dans cet exemple) elle vaut **500,08 €**. Convertissez toujours les deux sorties à la date de la transaction avant de conclure : la sortie qui « tombe » sur un montant rond en euros, en dollars ou en USDT est probablement le paiement.`,
      },
      { type: 'heading', text: 'Comment SPECTRA pondère les indices' },
      {
        type: 'text',
        md: `Dans le panneau d'analyse d'une transaction, SPECTRA calcule pour chaque sortie un **score** égal à la somme de raisons pondérées, puis convertit les scores en **probabilité relative** de chaque sortie d'être le rendu. Les poids reflètent la fiabilité relative des indices : un retour sur une adresse d'entrée pèse lourd, un simple montant non rond pèse peu, et une adresse attribuée à un exchange fait fortement baisser le score (un exchange est rarement le rendu d'un particulier).`,
      },
      {
        type: 'table',
        headers: ['Raison affichée par SPECTRA', 'Poids', 'Lecture'],
        rows: [
          ['Retourne vers une adresse d\'entrée (réutilisation)', '+6', 'Quasi décisif'],
          ['Dépensée plus tard avec des adresses du même cluster', '+2,5', 'Indice fort, a posteriori'],
          ['Même type d\'adresse que les entrées', '+1,6', '+0,5 seulement si les entrées sont de types mélangés'],
          ['Montant non rond (les autres sorties sont rondes)', '+1,6', 'Le rendu absorbe les décimales'],
          ['Adresse neuve (première apparition)', '+0,6', 'Indice faible : les adresses de dépôt sont aussi neuves'],
          ['Inférieure à la plus petite entrée', '+0,5', 'Entrée superflue sinon'],
          ['Type d\'adresse différent des entrées', '−1,2', 'Plutôt un tiers'],
          ['Montant rond (typique d\'un paiement)', '−1,4', 'Rond = 4 décimales ou moins'],
          ['Adresse déjà utilisée auparavant', '−1,5', 'Plutôt une adresse de destinataire'],
          ['Adresse attribuée à un exchange', '−3', 'Un dépôt chez un service, pas un rendu'],
        ],
        caption: 'Les pondérations du moteur pédagogique de SPECTRA. Les outils commerciaux utilisent des modèles différents, souvent non publiés.',
      },
      {
        type: 'callout',
        kind: 'warn',
        title: '« 92 % » n\'est pas une preuve',
        md: `La probabilité affichée est **relative** (elle compare les sorties entre elles) et dépend entièrement des poids choisis. Une sortie à 92 % peut être un paiement si un indice décisif manque à l'outil (par exemple une réponse de réquisition). SPECTRA n'applique d'ailleurs **aucune** analyse de rendu aux transactions détectées comme CoinJoin : la notion de rendu unique n'y a pas de sens.`,
      },
      {
        type: 'widget',
        id: 'change-detective',
        caption: 'Activez et désactivez les heuristiques une à une : observez comment la sortie désignée et la confiance évoluent, et repérez les cas où deux indices se contredisent.',
      },
      {
        type: 'case',
        title: 'Exemple guidé — transaction a3f1…c09e',
        md: `Reprenons la transaction du schéma (bloc 861 204, 14 mars 2026, 09:42 UTC).

- Entrées : 0,41820000 BTC et 0,30000000 BTC, deux adresses \`bc1q…\` de 42 caractères (P2WPKH).
- Sortie 0 : 0,65000000 BTC vers \`3J98t1…WNLy\` (P2SH), adresse qui a déjà reçu 47 paiements.
- Sortie 1 : 0,06805410 BTC vers \`bc1q…h2xw\` (P2WPKH), jamais vue auparavant.
- Frais : 0,71820000 − 0,71805410 = 0,00014590 BTC.

Analyse :

1. **Adresse neuve** : la sortie 1 est neuve, la sortie 0 très utilisée → rendu = sortie 1.
2. **Montant rond** : 0,65 BTC est rond → paiement = sortie 0.
3. **Type de script** : sortie 1 du même type que les entrées, sortie 0 différente → rendu = sortie 1.
4. **Entrée superflue** : 0,068 < 0,30 → rendu = sortie 1.
5. **Comportement ultérieur** : la sortie 0 est balayée 2 h 10 plus tard dans une consolidation de 183 entrées → c'est une adresse de dépôt de service.

Cinq indices concordants, aucun contraire : **confiance élevée**. Les 0,65 BTC sont partis vers un service à identifier (attribution, puis réquisition), et la trace du suspect se poursuit sur \`bc1q…h2xw\`.`,
      },
      { type: 'heading', text: 'Quand les heuristiques mentent' },
      {
        type: 'compare',
        left: {
          title: 'Transactions où les heuristiques fonctionnent',
          md: `- Paiement ordinaire d'un particulier : 1 à 3 entrées, 2 sorties.
- Portefeuille grand public, adresses de même type.
- Paiement rond en BTC ou en euros.
- Sorties suivies d'une dépense ultérieure lisible.`,
        },
        right: {
          title: 'Transactions où elles trompent',
          md: `- **Paiements groupés** d'exchange : 1 entrée, 150 sorties, un seul rendu.
- **Envoi à soi-même** (vers un portefeuille matériel) : les deux sorties sont au même acteur.
- **PayJoin** : le destinataire ajoute une entrée, l'entrée superflue est faussée.
- **Portefeuilles de confidentialité** : ordre aléatoire, type aligné, absence de rendu.
- **Ouverture de canal Lightning**, **CoinJoin**, « send max » sans rendu.`,
        },
      },
      {
        type: 'check',
        q: 'Deux heuristiques désignent la sortie A comme rendu, une troisième (fiable) désigne la sortie B. Quelle conduite adopter ?',
        options: [
          'Suivre A, puisque la majorité des heuristiques la désignent',
          'Suivre la sortie la plus grosse',
          'Suivre les deux branches en signalant l\'incertitude, ou arrêter la trace à ce point et le documenter',
          'Retenir la proposition de l\'outil sans autre vérification',
        ],
        answer: 2,
        explain: 'Une contradiction abaisse la confiance : on ne « vote » pas entre heuristiques. On poursuit les deux hypothèses en parallèle (en le disant) ou on s\'arrête, jusqu\'à ce qu\'un élément extérieur (comportement ultérieur, réquisition) tranche.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Isoler les sauts pivots', md: 'Repérez les transactions qui portent la démonstration : celles qui relient la victime à l\'adresse de dépôt que vous allez réquisitionner. Ce sont elles qu\'il faut vérifier à la main.' },
          { title: 'Relever les faits bruts', md: 'txid, hauteur de bloc, heure UTC, entrées et sorties (adresse, type, montant), frais, et contre-valeur en euros à la date.' },
          { title: 'Appliquer les heuristiques', md: 'Notez pour chaque sortie les indices pour et contre. N\'oubliez pas le comportement ultérieur : regardez ce que devient chaque sortie.' },
          { title: 'Conclure avec une confiance', md: 'Faible, moyenne ou élevée. En cas de contradiction, suivez les deux branches ou arrêtez-vous, et écrivez-le.' },
          { title: 'Tracer l\'outil', md: 'Indiquez l\'outil et sa version, et si sa proposition a été confirmée ou corrigée manuellement.' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : la bonne formulation',
        md: `Évitez « les fonds ont ensuite été transférés vers… ». Écrivez plutôt : « La sortie 1 (0,06805410 BTC, \`bc1q…h2xw\`) est retenue comme rendu avec une confiance élevée, par concordance de cinq indices (adresse neuve, type de script identique aux entrées, montant non rond, entrée superflue, balayage de l'autre sortie par un service). » Une phrase de ce type résiste bien mieux à la contre-expertise.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Rendu (change)', def: 'Sortie d\'une transaction qui renvoie au payeur la différence entre ses entrées et le paiement, frais déduits.' },
          { term: 'Heuristique', def: 'Règle empirique, fondée sur le comportement habituel des logiciels, qui a un taux d\'erreur non nul.' },
          { term: 'Entrée superflue', def: 'Indice selon lequel une sortie inférieure à la plus petite entrée est le rendu, sinon une entrée aurait été inutile.' },
          { term: 'Empreinte de portefeuille', def: 'Ensemble de marqueurs techniques (version, nLockTime, RBF, ordre des sorties, frais) propres à un logiciel.' },
          { term: 'Paiement groupé (batch)', def: 'Transaction d\'un service qui paie de nombreux bénéficiaires à la fois ; un seul rendu parmi des dizaines de sorties.' },
          { term: 'PayJoin', def: 'Paiement où le destinataire ajoute une de ses entrées ; fausse l\'entrée superflue et la propriété commune des entrées.' },
        ],
      },
    ],
    keyPoints: [
      'Aucun champ de la transaction n\'indique le rendu : la décision repose sur des heuristiques faillibles.',
      'Heuristiques clés : réutilisation de l\'adresse d\'entrée, adresse neuve, montant rond (en BTC et en euros), même type de script, entrée superflue, empreinte du portefeuille, comportement ultérieur.',
      'Une sortie inférieure à la plus petite entrée est probablement le rendu.',
      'Le score de SPECTRA additionne des raisons pondérées et donne une probabilité relative, pas une preuve ; il ne s\'applique pas aux CoinJoin.',
      'Paiements groupés, envois à soi-même, PayJoin et portefeuilles de confidentialité faussent les heuristiques.',
      'Exiger la concordance, traiter la contradiction comme une incertitude, et noter un niveau de confiance par écrit.',
    ],
    quiz: [
      {
        q: 'Entrées : 0,5 BTC et 0,2 BTC. Sorties : 0,64 BTC et 0,0598 BTC. Selon l\'heuristique de l\'entrée superflue, quelle sortie est le rendu ?',
        options: ['0,64 BTC', '0,0598 BTC', 'Les deux', 'Impossible à dire'],
        answer: 1,
        explain: '0,0598 < 0,2 (plus petite entrée). Si 0,0598 avait été le paiement, l\'entrée de 0,5 aurait suffi : l\'ajout de 0,2 n\'aurait servi à rien. Le paiement est donc 0,64 BTC.',
      },
      {
        q: 'Quelle situation rend l\'heuristique « montant rond » peu fiable si on raisonne seulement en BTC ?',
        options: [
          'Un paiement de 0,1 BTC',
          'Une transaction à deux sorties',
          'Un paiement dont le montant a été fixé en euros puis converti au cours du jour',
          'Un paiement vers une adresse bc1q',
        ],
        answer: 2,
        explain: 'Un montant fixé en euros donne un nombre de BTC non rond. Il faut alors tester la rondeur en monnaie fiduciaire au cours de la date de la transaction.',
      },
      {
        kind: 'multi',
        q: 'Parmi ces indices, lesquels plaident pour qu\'une sortie soit le RENDU ? (plusieurs réponses)',
        options: [
          'Elle est dépensée plus tard avec d\'autres adresses du même cluster que les entrées',
          'Elle a le même type de script que toutes les entrées',
          'Elle est balayée trois heures plus tard dans une consolidation de 180 entrées',
          'Elle est attribuée à un exchange',
          'Elle revient sur l\'une des adresses d\'entrée',
        ],
        answer: [0, 1, 4],
        explain: 'Co-dépense avec le cluster du payeur, même type de script et retour sur une adresse d\'entrée désignent le rendu. Le balayage massif et l\'attribution à un exchange désignent au contraire une adresse de dépôt de service, donc un paiement.',
      },
      {
        kind: 'truefalse',
        q: 'Dans SPECTRA, une probabilité de rendu de 90 % signifie que l\'outil a établi avec certitude l\'identité du rendu.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La probabilité est relative entre les sorties et dépend des poids attribués aux raisons. Elle oriente l\'analyse ; la décision et la confiance restent celles de l\'enquêteur.',
      },
      {
        q: 'Pourquoi une transaction de retrait groupé d\'exchange est-elle difficile à analyser avec les heuristiques de rendu ?',
        options: [
          'Parce qu\'elle n\'a pas de frais',
          'Parce qu\'elle est chiffrée',
          'Parce qu\'elle n\'a qu\'une sortie',
          'Parce que ses nombreuses sorties sont des clients différents et qu\'une seule est le rendu de l\'exchange',
        ],
        answer: 3,
        explain: 'Un batch contient des dizaines de bénéficiaires distincts : seule une réquisition à l\'exchange permet d\'identifier le client derrière une sortie donnée.',
      },
      {
        q: 'Deux heuristiques désignent des rendus différents. Que faire ?',
        options: [
          'Suivre les deux branches en le signalant, ou arrêter la trace et le documenter',
          'Choisir la sortie la plus grosse',
          'Suivre la proposition de l\'outil commercial',
          'Ignorer la transaction',
        ],
        answer: 0,
        explain: 'En cas de contradiction, la confiance est faible : on documente l\'incertitude et on n\'en tire pas de conclusion ferme.',
      },
      {
        kind: 'truefalse',
        q: 'Une sortie vers une adresse neuve est forcément le rendu, puisque les portefeuilles HD génèrent une nouvelle adresse de rendu à chaque fois.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Les exchanges attribuent aussi une adresse de dépôt neuve à leurs clients : un paiement peut donc partir vers une adresse neuve. C\'est un indice faible, à combiner avec d\'autres.',
      },
    ],
    flashcards: [
      { front: 'Pourquoi existe-t-il presque toujours une sortie de rendu ?', back: 'Parce qu\'une UTXO se dépense en entier : la différence entre les entrées et le paiement (frais déduits) revient au payeur sur une sortie dédiée.' },
      { front: 'Heuristique de l\'entrée superflue', back: 'Une sortie inférieure à la plus petite entrée est probablement le rendu : sinon, une des entrées aurait été inutile.' },
      { front: 'Pourquoi tester la rondeur en euros ?', back: 'Un paiement fixé en monnaie fiduciaire n\'est pas rond en BTC mais l\'est en euros au cours du jour.' },
      { front: 'Indice de rendu le plus fort ?', back: 'Le retour sur une adresse d\'entrée (réutilisation) : quasi décisif. Ensuite, la co-dépense ultérieure avec le cluster du payeur.' },
      { front: 'Que signifie une sortie balayée dans une consolidation de 150 entrées ?', back: 'C\'est probablement une adresse de dépôt d\'un service (exchange) : cette sortie était le paiement.' },
      { front: 'Empreinte de portefeuille : exemples de marqueurs', back: 'Version de transaction, nLockTime (anti fee-sniping), signal RBF, ordre des sorties (BIP69 ou aléatoire), arrondi des frais, types d\'adresses.' },
      { front: 'Trois cas où les heuristiques de rendu trompent', back: 'Paiements groupés d\'exchange, envois à soi-même, PayJoin (aussi : portefeuilles de confidentialité, CoinJoin, send max).' },
      { front: 'Que fait SPECTRA d\'un CoinJoin dans l\'analyse de rendu ?', back: 'Rien : aucune analyse de rendu n\'est proposée pour une transaction détectée comme CoinJoin.' },
      { front: 'Règle d\'or de la décision de rendu', back: 'Plusieurs heuristiques concordantes, aucune contradictoire, et un niveau de confiance noté par écrit.' },
    ],
    practice: ['change-anatomy', 'first-trace', 'peel-chain'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // CLUSTERING
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'clustering',
    title: "Clustering : l'heuristique des entrées communes",
    level: 2,
    track: 'bitcoin',
    minutes: 28,
    summary:
      "Regrouper les adresses contrôlées par une même entité grâce à la CIOH (common-input-ownership heuristic) : principe, transitivité, construction des clusters dans SPECTRA et dans les outils commerciaux, ce qui casse l'heuristique (CoinJoin, PayJoin, multisignatures), et comment justifier un rapprochement par un chemin de co-dépense.",
    objectives: [
      'Énoncer la CIOH et expliquer pourquoi la signature des entrées la fonde.',
      'Comprendre la transitivité du clustering et l\'effet d\'une seule attribution sur tout un cluster.',
      'Identifier les situations qui cassent la CIOH et leurs signatures.',
      'Repérer les signes d\'une fausse fusion de clusters.',
      'Produire le chemin de co-dépense qui justifie un rapprochement entre deux adresses.',
    ],
    prerequisites: ['utxo', 'change-heuristics'],
    blocks: [
      {
        type: 'text',
        md: `Pour dépenser une UTXO, il faut produire une signature avec la clé privée correspondante. Une transaction qui consomme **plusieurs entrées** a donc, en principe, été construite par quelqu'un qui détenait **toutes les clés** concernées. D'où l'heuristique de **propriété commune des entrées** (CIOH, *common-input-ownership heuristic*) :

**Toutes les adresses utilisées comme entrées d'une même transaction sont présumées contrôlées par la même entité.**

C'est l'heuristique la plus puissante de l'analyse Bitcoin. Les travaux académiques du début des années 2010 l'ont utilisée pour cartographier les grands services de l'époque, et tous les outils d'analyse du marché reposent encore sur elle.`,
      },
      {
        type: 'quote',
        md: 'Certains liens restent inévitables avec les transactions à entrées multiples, qui révèlent nécessairement que leurs entrées appartenaient au même propriétaire.',
        source: 'Livre blanc de Bitcoin (2008), section « Privacy » — traduction libre',
      },
      { type: 'heading', text: 'La transitivité : de quelques adresses à des millions' },
      {
        type: 'text',
        md: `La CIOH s'applique **de proche en proche**. Si A et B sont co-dépensées dans une transaction, puis B et C dans une autre, puis C et D dans une troisième, alors A, B, C et D forment un même **cluster**, même si A et D n'ont jamais figuré ensemble dans une transaction.

Les exchanges consolident régulièrement leurs adresses de dépôt dans des transactions de 100 à 500 entrées : toutes ces adresses rejoignent le même cluster. Il suffit ensuite qu'**une seule** soit attribuée (par un dépôt test, une réponse à réquisition, une publication) pour que tout le cluster porte le nom du service.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'a', label: 'Adresse A', kind: 'wallet', sub: 'dépôt client 1' },
          { id: 'b', label: 'Adresse B', kind: 'wallet', sub: 'dépôt client 2' },
          { id: 'c', label: 'Adresse C', kind: 'wallet', sub: 'dépôt client 3' },
          { id: 'd', label: 'Adresse D', kind: 'deposit', sub: 'dépôt test : « Coinhouse »' },
          { id: 't1', label: 'tx 1 (A + B)', kind: 'tx' },
          { id: 't2', label: 'tx 2 (B + C)', kind: 'tx' },
          { id: 't3', label: 'tx 3 (C + D)', kind: 'tx' },
          { id: 'hot', label: 'Hot wallet', kind: 'hot', sub: 'cluster C-4A1F2 = Coinhouse' },
        ],
        edges: [
          { from: 'a', to: 't1' },
          { from: 'b', to: 't1' },
          { from: 'b', to: 't2', dashed: true, label: 'via le rendu' },
          { from: 'c', to: 't2' },
          { from: 'c', to: 't3', dashed: true, label: 'via le rendu' },
          { from: 'd', to: 't3' },
          { from: 't3', to: 'hot', label: 'consolidation' },
        ],
        caption: 'Trois co-dépenses suffisent à relier A et D. L\'étiquette obtenue sur D (dépôt test) se propage à tout le cluster.',
      },
      {
        type: 'widget',
        id: 'cioh-cluster',
        caption: 'Reliez des adresses par leurs entrées communes, observez le cluster grossir, puis introduisez un CoinJoin : voyez comment une seule fausse fusion contamine tout le regroupement.',
      },
      { type: 'heading', text: 'Comment SPECTRA construit ses clusters' },
      {
        type: 'text',
        md: `Le moteur de SPECTRA applique la CIOH **stricte** sur les chaînes UTXO : chaque transaction à au moins deux entrées fusionne les adresses de ses entrées (structure dite *union-find*). Le résultat est un identifiant de cluster de la forme \`C-4A1F2\`, affiché sur chaque adresse.

Deux garde-fous :

- les transactions détectées comme **CoinJoin** sont **exclues** du clustering. Le critère utilisé : au moins 4 entrées issues d'au moins 4 adresses distinctes, au moins 4 sorties, dont au moins 4 de **montant strictement identique** ;
- l'**attribution par cluster** est signalée comme telle : une adresse sans étiquette propre mais membre d'un cluster attribué apparaît par exemple comme « Coinhouse (cluster) », et non « Coinhouse ».

Les outils commerciaux vont plus loin : ils ajoutent souvent au cluster du payeur l'**adresse de rendu** détectée (clustering par rendu, plus risqué car il hérite des erreurs de détection), et appliquent des filtres propriétaires pour éviter les fusions abusives.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Et sur Ethereum ou Tron ?',
        md: `La CIOH n'existe **pas** dans le modèle à comptes : une transaction n'a qu'un seul émetteur. Le regroupement d'adresses y repose sur d'autres indices — adresses de dépôt d'exchange qui reversent toutes au même hot wallet, financement en gaz par une même adresse, création de contrats, noms ENS, comportements. C'est pourquoi SPECTRA ne propage pas d'attribution par cluster sur les chaînes à comptes.`,
      },
      { type: 'heading', text: 'Ce qui casse la CIOH' },
      {
        type: 'table',
        headers: ['Situation', 'Ce qui se passe', 'Signature visible', 'Détectable ?'],
        rows: [
          ['CoinJoin', 'Plusieurs utilisateurs signent ensemble une même transaction', 'Nombreuses sorties de montant identique, coordinateur connu (zkSNACKs…)', 'Oui, le plus souvent'],
          ['PayJoin (BIP78)', 'Le destinataire ajoute discrètement une de ses entrées au paiement', 'Aucune : ressemble à un paiement 2 entrées / 2 sorties', 'Pas avec certitude'],
          ['Multisignature partagée', 'Une adresse 2-sur-3 est co-contrôlée (séquestre, garde partagée)', 'Script multisig (P2SH / P2WSH)', 'Partiellement'],
          ['Clé importée', 'Un utilisateur balaie une clé reçue d\'un tiers (carte cadeau, portefeuille papier)', 'Rien de particulier', 'Non'],
          ['Transactions collaboratives', 'Canaux Lightning à double financement, protocoles d\'échange', 'Scripts particuliers', 'Parfois'],
        ],
        caption: 'Un CoinJoin non détecté est la première cause de clusters faux.',
      },
      {
        type: 'check',
        q: 'Une transaction a 6 entrées venant de 6 adresses différentes et 7 sorties, dont 6 de 0,01000000 BTC exactement. Faut-il fusionner les 6 adresses d\'entrée dans un même cluster ?',
        options: [
          'Oui : la CIOH s\'applique à toute transaction à plusieurs entrées',
          'Non : la structure est celle d\'un CoinJoin, les entrées appartiennent probablement à des personnes différentes',
          'Oui, mais seulement les deux plus grosses entrées',
          'Non, car la CIOH ne s\'applique qu\'aux transactions à deux entrées',
        ],
        answer: 1,
        explain: 'Six sorties de montant identique et six adresses d\'entrée distinctes : c\'est la signature d\'un CoinJoin. Appliquer la CIOH fusionnerait six utilisateurs sans rapport. SPECTRA exclut ces transactions du clustering.',
      },
      { type: 'heading', text: 'Lire un cluster' },
      {
        type: 'table',
        headers: ['Indicateur', 'Ce qu\'il révèle'],
        rows: [
          ['Taille (nombre d\'adresses)', 'Quelques adresses : un particulier. Des centaines de milliers : un service.'],
          ['Volume reçu / envoyé', 'Ordre de grandeur de l\'activité ; incohérence si un « particulier » brasse des milliers de BTC.'],
          ['Nombre de contreparties', 'Un service a des milliers de contreparties, un portefeuille personnel quelques dizaines.'],
          ['Première et dernière activité', 'Période d\'existence ; un cluster actif bien après les faits peut encore être gelé.'],
          ['Origine de l\'étiquette', 'Source, date, méthode et niveau de confiance de l\'attribution (voir leçon Attribution).'],
          ['Historique de croissance', 'Une croissance brutale après une transaction précise trahit souvent une fausse fusion.'],
        ],
      },
      {
        type: 'case',
        title: 'Cas — le « particulier » de 312 000 adresses',
        md: `Dans une affaire de sextorsion, l'adresse de paiement \`bc1q…8rtz\` apparaît dans un cluster d'un outil commercial qui porte à la fois l'étiquette d'un exchange et celle d'un particulier déjà connu de la procédure. Le cluster compte **312 000 adresses** ; la veille, il n'en comptait que 41.

L'analyste remonte l'historique et trouve la transaction responsable : 9 entrées, 10 sorties dont 8 de 0,05 BTC exactement. C'est un CoinJoin que l'outil n'a pas détecté : il a fusionné le portefeuille du suspect avec celui d'un utilisateur qui déposait ensuite sur un exchange.

Conclusion du rapport : **le rapprochement suspect / exchange est écarté**. Seules les 41 adresses reliées par des co-dépenses « ordinaires » sont retenues comme portefeuille du suspect.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Quand la CIOH sert l\'enquête malgré l\'auteur',
        md: `L'**attaque par poussière** (*dusting*) consiste à envoyer quelques centaines de satoshis à de nombreuses adresses. Si le destinataire consolide plus tard cette poussière avec ses autres pièces, il relie **lui-même** ses adresses entre elles. De même, un suspect prudent qui finit par regrouper ses fonds avant un dépôt sur exchange « signe » son cluster au moment de la consolidation.`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Énoncer le rapprochement', md: '« L\'adresse X est contrôlée par la même entité que l\'adresse Y. »' },
          { title: 'Produire le chemin de co-dépense', md: 'Listez les transactions qui relient X à Y : tx1 (X + K), tx2 (K + L), tx3 (L + Y). Chaque maillon doit être une co-dépense vérifiable dans un explorateur.' },
          { title: 'Contrôler chaque maillon', md: 'Aucun maillon ne doit être un CoinJoin (sorties égales), une transaction atypique (multisig, nombre d\'entrées inhabituel) ou un PayJoin plausible.' },
          { title: 'Raccourcir si possible', md: 'Un chemin court (une ou deux co-dépenses) est plus robuste qu\'un chemin de quinze maillons.' },
          { title: 'Graduer la confiance', md: 'Chemin court et ordinaire : confiance élevée. Chemin long ou passant par une transaction douteuse : confiance faible, à corroborer.' },
        ],
      },
      {
        type: 'check',
        q: 'Un outil indique que l\'adresse d\'un suspect appartient au cluster d\'un exchange. Que devez-vous faire avant d\'adresser une réquisition fondée sur ce rapprochement ?',
        options: [
          'Rien : le cluster de l\'outil fait foi',
          'Demander au suspect de confirmer',
          'Identifier les transactions de co-dépense qui relient concrètement l\'adresse à l\'adresse attribuée, et vérifier qu\'aucune n\'est un CoinJoin',
          'Attendre que le cluster grossisse',
        ],
        answer: 2,
        explain: 'Le cluster d\'un outil est une hypothèse algorithmique. Avant un acte, il faut pouvoir produire et contrôler le chemin de co-dépense.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Dans un rapport, distinguez toujours trois niveaux : **l'adresse observée** (fait), **le cluster** (inférence algorithmique, avec l'outil et la règle utilisée) et **l'attribution** du cluster (étiquette, avec sa source). Écrire « l'adresse X appartient à Coinhouse » mélange les trois ; écrire « l'adresse X est reliée par deux co-dépenses (tx … et tx …) à l'adresse Y, attribuée à Coinhouse par dépôt test du 3 février 2026 » les sépare.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'CIOH', def: 'Common-input-ownership heuristic : les entrées d\'une même transaction sont présumées contrôlées par la même entité.' },
          { term: 'Cluster', def: 'Ensemble d\'adresses regroupées par application transitive d\'heuristiques (CIOH, rendu).' },
          { term: 'Chemin de co-dépense', def: 'Suite de transactions qui relie, maillon par maillon, deux adresses d\'un même cluster.' },
          { term: 'Fausse fusion', def: 'Réunion à tort de deux entités distinctes dans un cluster, le plus souvent à cause d\'un CoinJoin non détecté.' },
          { term: 'Dusting', def: 'Envoi de très petits montants à de nombreuses adresses, dans l\'espoir qu\'ils soient co-dépensés avec d\'autres pièces.' },
          { term: 'Attribution par cluster', def: 'Étiquette héritée d\'une autre adresse du cluster, et non obtenue directement sur l\'adresse.' },
        ],
      },
    ],
    keyPoints: [
      'CIOH : les entrées d\'une même transaction sont présumées contrôlées par la même entité, car il faut toutes les clés pour signer.',
      'Appliquée de proche en proche, elle construit des clusters ; une seule attribution étiquette tout le cluster.',
      'SPECTRA applique la CIOH stricte sur les chaînes UTXO, exclut les CoinJoin et signale les attributions « (cluster) ».',
      'CoinJoin, PayJoin, multisignatures partagées et transactions collaboratives cassent la CIOH.',
      'Une fausse fusion se propage : surveiller les clusters qui grossissent brutalement ou portent des étiquettes contradictoires.',
      'Tout rapprochement doit pouvoir être justifié par un chemin de co-dépense vérifié.',
      'La CIOH n\'existe pas dans le modèle à comptes (Ethereum, Tron).',
    ],
    quiz: [
      {
        q: 'Que postule la CIOH ?',
        options: [
          'Les sorties d\'une transaction appartiennent au même acteur',
          'Deux adresses de même type appartiennent au même acteur',
          'Les entrées d\'une transaction appartiennent au même acteur',
          'Les adresses ayant reçu des fonds le même jour appartiennent au même acteur',
        ],
        answer: 2,
        explain: 'Signer plusieurs entrées suppose de détenir toutes les clés : on présume un contrôle commun des entrées.',
      },
      {
        q: 'Pourquoi le PayJoin est-il particulièrement gênant pour l\'analyste ?',
        options: [
          'Il ressemble à un paiement ordinaire alors que le destinataire a ajouté une entrée, ce qui fausse la CIOH',
          'Il chiffre les montants',
          'Il n\'est possible que sur Monero',
          'Il supprime les frais',
        ],
        answer: 0,
        explain: 'Contrairement au CoinJoin, le PayJoin n\'a pas de signature visuelle (pas de sorties égales) : il trompe la CIOH sans être repéré.',
      },
      {
        q: 'Un cluster attribué à un particulier contient soudain 300 000 adresses et une étiquette « exchange ». Hypothèse la plus probable ?',
        options: [
          'Le particulier a créé un exchange',
          'C\'est normal pour un particulier actif',
          'L\'exchange a été piraté par le particulier',
          'Une fausse fusion (CoinJoin non détecté, par exemple) a réuni deux entités',
        ],
        answer: 3,
        explain: 'Une croissance brutale et des étiquettes contradictoires signalent une erreur de clustering propagée par transitivité.',
      },
      {
        kind: 'multi',
        q: 'Quelles situations peuvent faire échouer la CIOH ? (plusieurs réponses)',
        options: [
          'Un CoinJoin',
          'Un PayJoin',
          'Une consolidation d\'adresses de dépôt par un exchange',
          'Une dépense depuis une adresse multisignature de séquestre partagée',
          'Un paiement ordinaire avec une seule entrée',
        ],
        answer: [0, 1, 3],
        explain: 'CoinJoin, PayJoin et multisignature partagée réunissent des signataires différents. La consolidation d\'un exchange est au contraire le cas d\'école où la CIOH fonctionne ; une transaction à une seule entrée ne crée aucun lien.',
      },
      {
        q: 'Comment une attaque par poussière peut-elle relier des adresses ?',
        options: [
          'En volant les clés privées',
          'En bloquant les adresses visées',
          'Si le destinataire consolide la poussière avec ses autres pièces, la CIOH relie ces adresses',
          'Elle ne peut pas relier d\'adresses',
        ],
        answer: 2,
        explain: 'La co-dépense de la poussière avec d\'autres UTXO relie les adresses du destinataire entre elles.',
      },
      {
        kind: 'truefalse',
        q: 'Dans SPECTRA, une adresse Ethereum peut hériter de l\'étiquette d\'une autre adresse par la CIOH.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La CIOH suppose des transactions à plusieurs entrées, ce qui n\'existe pas dans le modèle à comptes. SPECTRA ne propage l\'attribution par cluster que sur les chaînes UTXO.',
      },
      {
        q: 'Quel critère SPECTRA utilise-t-il pour exclure une transaction du clustering ?',
        options: [
          'Plus de deux sorties',
          'Une structure de CoinJoin : au moins 4 entrées d\'adresses distinctes et au moins 4 sorties de montant identique',
          'Des frais supérieurs à la moyenne',
          'Une adresse de type Taproot',
        ],
        answer: 1,
        explain: 'Les transactions détectées comme CoinJoin sont exclues, car leurs entrées appartiennent à des participants différents.',
      },
    ],
    flashcards: [
      { front: 'CIOH', back: 'Heuristique de propriété commune des entrées : toutes les entrées d\'une transaction sont présumées contrôlées par la même entité.' },
      { front: 'Pourquoi la CIOH est-elle plausible ?', back: 'Parce que chaque entrée exige une signature avec sa clé privée : construire la transaction suppose de détenir toutes les clés.' },
      { front: 'Transitivité du clustering', back: 'Si A et B sont co-dépensées, puis B et C, alors A, B et C forment un même cluster.' },
      { front: 'Première cause de clusters faux', back: 'Un CoinJoin non détecté, qui fusionne des participants sans rapport.' },
      { front: 'Pourquoi le PayJoin est-il indétectable ?', back: 'Il ressemble à un paiement ordinaire 2 entrées / 2 sorties, sans sorties égales.' },
      { front: 'Signes d\'une fausse fusion', back: 'Croissance brutale du cluster après une transaction précise, étiquettes contradictoires, comportement incohérent.' },
      { front: 'Chemin de co-dépense', back: 'Liste des transactions reliant maillon par maillon deux adresses ; il justifie tout rapprochement.' },
      { front: 'Critère CoinJoin de SPECTRA', back: '≥ 4 entrées d\'adresses distinctes, ≥ 4 sorties, dont ≥ 4 de montant identique : exclue du clustering et de l\'analyse de rendu.' },
      { front: '« Coinhouse (cluster) » dans SPECTRA', back: 'L\'adresse n\'a pas d\'étiquette propre : elle hérite de celle d\'une autre adresse de son cluster.' },
      { front: 'CIOH et modèle à comptes', back: 'Elle ne s\'applique pas : une transaction Ethereum ou Tron n\'a qu\'un seul émetteur.' },
    ],
    practice: ['sextortion-cluster', 'change-anatomy', 'darknet-vendor'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // PEEL CHAINS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'peel-chains',
    title: 'Les peel chains',
    level: 2,
    track: 'bitcoin',
    minutes: 24,
    summary:
      "Le schéma de fractionnement le plus classique sur Bitcoin : une grosse somme « épluchée » par petites portions successives, chacune partant vers un service. Reconnaître la structure, la suivre saut par saut, tabuler les pelures pour cibler les réquisitions, et ne pas la confondre avec les retraits d'un hot wallet.",
    objectives: [
      'Décrire la structure d\'une peel chain et l\'objectif poursuivi par l\'auteur.',
      'Reconnaître ses indices : 1 entrée → 2 sorties répétées, petite et grosse sortie, régularité temporelle.',
      'Suivre la chaîne et construire un tableau des pelures exploitable.',
      'Prioriser les réquisitions par service et par ancienneté.',
      'Distinguer une peel chain d\'auteur des retraits successifs d\'un exchange.',
    ],
    prerequisites: ['change-heuristics', 'clustering'],
    blocks: [
      {
        type: 'text',
        md: `Une **peel chain** (chaîne d'épluchage, ou de pelage) part d'une UTXO importante — une rançon, le produit d'un piratage, la caisse d'un vendeur du darknet. À chaque saut :

- une **petite sortie**, la « pelure », part vers une destination : adresse de dépôt d'exchange, échangeur instantané, mixeur, portefeuille intermédiaire ;
- une **grosse sortie**, le reste, part vers une **nouvelle adresse** contrôlée par l'auteur, qui devient l'entrée du saut suivant.

La grosse sortie est donc le **rendu** de chaque transaction : suivre une peel chain, c'est appliquer la leçon sur le rendu des dizaines de fois de suite.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'r', label: 'Rançon LockBit', kind: 'suspect', sub: '12,4 BTC' },
          { id: 'h1', label: 'Saut 1', kind: 'tx', sub: '02:14 UTC' },
          { id: 'h2', label: 'Saut 2', kind: 'tx', sub: '02:36 UTC' },
          { id: 'h3', label: 'Saut 3', kind: 'tx', sub: '02:58 UTC' },
          { id: 'next', label: 'Suite de la chaîne', kind: 'wallet', sub: '10,3894 BTC' },
          { id: 'cv', label: 'Coinhouse', kind: 'deposit', sub: 'adresse de dépôt' },
          { id: 'oc', label: 'ChangeNOW', kind: 'service', sub: 'échangeur instantané' },
          { id: 'bn', label: 'Binance', kind: 'deposit', sub: 'adresse de dépôt' },
        ],
        edges: [
          { from: 'r', to: 'h1', label: '12,4' },
          { from: 'h1', to: 'cv', label: 'pelure 0,62' },
          { from: 'h1', to: 'h2', label: 'reste 11,7798' },
          { from: 'h2', to: 'oc', label: 'pelure 0,48' },
          { from: 'h2', to: 'h3', label: 'reste 11,2996' },
          { from: 'h3', to: 'bn', label: 'pelure 0,91' },
          { from: 'h3', to: 'next', label: 'reste 10,3894' },
        ],
        caption: 'Chaque saut détache une pelure vers un service et transmet le reste à une adresse neuve (frais : 0,0002 BTC par saut).',
      },
      { type: 'heading', text: 'Reconnaître le schéma' },
      {
        type: 'table',
        headers: ['Indice', 'Ce qu\'on observe', 'Valeur'],
        rows: [
          ['Structure répétée', 'Transactions 1 entrée → 2 sorties (parfois 3) qui s\'enchaînent', 'Forte'],
          ['Asymétrie', 'Une sortie beaucoup plus petite que l\'autre (5 à 10 % du total)', 'Forte'],
          ['Reste vers adresse neuve', 'La grosse sortie va vers une adresse jamais vue, de même type de script', 'Moyenne'],
          ['Dépense rapide', 'Le reste est redépensé dans les minutes qui suivent', 'Moyenne'],
          ['Régularité temporelle', 'Un saut par bloc, ou toutes les 15 à 30 minutes : script automatisé', 'Forte'],
          ['Fourchette de pelures', 'Montants des pelures dans une plage stable (0,3 à 0,9 BTC par exemple)', 'Moyenne'],
          ['Frais constants', 'Même taux ou même montant de frais à chaque saut : même logiciel', 'Moyenne'],
        ],
      },
      {
        type: 'widget',
        id: 'peel-chain',
        caption: 'Déroulez la chaîne saut par saut : identifiez à chaque étape la pelure et le reste, et regardez le solde décroître jusqu\'à la fin de la chaîne.',
      },
      { type: 'heading', text: 'Pourquoi les auteurs épluchent' },
      {
        type: 'text',
        md: `Fractionner n'est pas anodin pour l'auteur : chaque saut coûte des frais et laisse une trace. Il le fait pourtant parce que :

- déposer 12 BTC d'un coup sur un exchange déclencherait immédiatement les contrôles anti-blanchiment ; des dépôts de 0,5 BTC répartis sur plusieurs services et plusieurs comptes passent plus facilement sous les **seuils de vigilance** ;
- il multiplie les **comptes d'encaissement** (souvent ouverts au nom de mules ou avec des identités achetées), ce qui dilue le risque de gel ;
- il **décourage** l'analyste : une chaîne de 80 sauts représente 80 décisions de rendu et autant de destinations.

C'est aussi sa faiblesse : chaque pelure arrivée chez un service régulé est un **point d'identification potentiel**.`,
      },
      {
        type: 'check',
        q: 'Dans une peel chain, quelle sortie faut-il suivre pour rester sur les fonds de l\'auteur ?',
        options: [
          'La plus petite sortie',
          'La sortie qui va vers un exchange',
          'La grosse sortie vers une adresse neuve, qui alimente le saut suivant',
          'Les deux, toujours, avec le même poids',
        ],
        answer: 2,
        explain: 'La grosse sortie est le reste (le rendu) qui finance le saut suivant. Les petites sorties sont les pelures : on les relève et on les attribue, mais la chaîne continue par le reste.',
      },
      { type: 'heading', text: 'Suivre et exploiter la chaîne' },
      {
        type: 'steps',
        items: [
          { title: 'Valider le départ', md: 'Vérifiez que la chaîne démarre bien dans le portefeuille de l\'auteur (rançon, adresse de collecte) et non dans un cluster de service.' },
          { title: 'Suivre le reste', md: 'Avancez de saut en saut par la grosse sortie. Le suivi automatique de l\'outil fait gagner du temps : vérifiez manuellement les premiers sauts et chaque saut atypique.' },
          { title: 'Tabuler chaque pelure', md: 'N° de saut, txid, heure UTC, montant BTC, contre-valeur en euros, adresse de destination, attribution, source de l\'attribution, confiance.' },
          { title: 'Regrouper par service', md: '7 pelures chez Coinhouse, 4 chez Binance, 3 chez ChangeNOW… Le regroupement oriente les réquisitions.' },
          { title: 'Prioriser', md: 'Services coopératifs et capables de geler d\'abord ; montants élevés ; pelures les plus anciennes (risque de purge des données techniques).' },
          { title: 'Repérer la fin', md: 'Reste résiduel faible, consolidation, passage par un mixeur ou un CoinJoin : notez où et pourquoi la chaîne s\'arrête.' },
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Dans l\'espace d\'enquête : le détecteur de peel chain',
        md: `Clic droit sur l'adresse de départ ▸ *Suivre la peel chain* (ou onglet *Traçage* de l'inspecteur). L'outil avance par la plus grosse sortie tant que le motif se répète et produit directement le tableau des pelures : date, montant, destination, attribution, reste, et probabilité que la sortie suivie soit bien le rendu. Les sauts dont le rendu est incertain sont signalés en orange : ce sont ceux à vérifier à la main. Il indique aussi pourquoi la chaîne s'arrête et regroupe les pelures par service pour préparer les réquisitions.`,
      },
      {
        type: 'table',
        headers: ['Saut', 'Heure UTC', 'Pelure (BTC)', 'Valeur (€)', 'Destination', 'Attribution', 'Confiance'],
        rows: [
          ['1', '12/05/2026 02:14', '0,62', '38 170', 'bc1q…u7d4', 'Coinhouse (cluster)', 'Élevée'],
          ['2', '12/05/2026 02:36', '0,48', '29 550', 'bc1q…9mfe', 'ChangeNOW', 'Élevée'],
          ['3', '12/05/2026 02:58', '0,91', '56 020', '3Fz1…kQ2p', 'Binance (cluster)', 'Moyenne'],
          ['4', '12/05/2026 03:19', '0,55', '33 860', 'bc1q…x0aa', 'Inconnue — balayée vers un hot wallet', 'À attribuer'],
        ],
        caption: 'Extrait d\'un tableau des pelures (cours retenu : 61 560 €/BTC). C\'est ce tableau, et non le graphe, qui sert de base aux réquisitions.',
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Une réquisition, toutes les pelures',
        md: `Un même compte client reçoit souvent plusieurs pelures. Adressez au service **une seule réquisition** listant toutes les adresses de dépôt et tous les txid qui le concernent : la réponse sera plus complète (le service voit que les dépôts sont liés), et la répétition renforce la démonstration.`,
      },
      { type: 'heading', text: 'Pièges et variantes' },
      {
        type: 'compare',
        left: {
          title: 'Peel chain d\'un auteur',
          md: `- Démarre sur un portefeuille de faible taille (rançon, collecte).
- Pelures vers des **services d'encaissement** (dépôts d'exchange, échangeurs).
- Rythme souvent automatisé, nocturne.
- Le reste appartient à l'auteur.`,
        },
        right: {
          title: 'Retraits d\'un hot wallet d\'exchange',
          md: `- Démarre dans un **cluster de service** attribué (des centaines de milliers d'adresses).
- Pelures vers des **portefeuilles de clients** variés.
- Rythme dicté par les demandes de retrait.
- Le reste appartient à l'exchange ; chaque pelure est un client différent.`,
        },
      },
      {
        type: 'text',
        md: `Autres variantes à connaître :

- **Chaînes ramifiées** : à un saut, le reste est scindé en deux grosses sorties ; il faut alors suivre deux chaînes parallèles.
- **Changement délibéré de type de script** pour brouiller l'heuristique de type (le reste passe de \`bc1q…\` à \`bc1p…\`).
- **Pelures vers des portefeuilles intermédiaires** qui consolident plus tard : ce sont parfois des adresses de collecte de l'auteur ou de mules.
- **Fin de chaîne ambiguë** : quand le reste devient comparable aux pelures, l'asymétrie disparaît ; revenez aux autres heuristiques (adresse neuve, comportement ultérieur).`,
      },
      {
        type: 'case',
        title: 'Cas — la rançon de 12,4 BTC',
        md: `Le 12 mai 2026 à 01:47 UTC, une PME de Haute-Savoie paie une rançon de **12,4 BTC** au groupe LockBit. Vingt-sept minutes plus tard, la chaîne démarre : **41 sauts** en 15 heures, à intervalles de 20 à 23 minutes, pelures comprises entre 0,41 et 0,95 BTC.

Le tableau des pelures montre : 14 dépôts attribués à Coinhouse (8,96 BTC cumulés), 9 chez Binance, 6 chez ChangeNOW, 12 vers des adresses inconnues dont 7 sont balayées ensuite vers un même hot wallet non attribué. Le reste final, 0,37 BTC, entre dans un CoinJoin via zkSNACKs.

Décisions : réquisition unique à Coinhouse (service français, 14 txid, demande de gel), demande via le portail de Binance (9 txid), demande à ChangeNOW avec les hash de dépôt pour obtenir les adresses de destination des échanges ; analyse du hot wallet inconnu (dépôt test envisagé) ; arrêt documenté de la trace au CoinJoin.`,
      },
      {
        type: 'check',
        q: 'Une chaîne de 50 sauts démarre dans un cluster de 900 000 adresses attribué à un grand exchange. Interprétation la plus prudente ?',
        options: [
          'L\'exchange blanchit des fonds',
          'Ce sont probablement des retraits successifs du hot wallet : chaque pelure est un client différent',
          'Le suspect a piraté l\'exchange',
          'C\'est un CoinJoin',
        ],
        answer: 1,
        explain: 'Les hot wallets d\'exchange produisent ce schéma lors des retraits successifs. Seule la pelure liée à l\'affaire intéresse l\'enquête, et c\'est l\'exchange qui pourra dire quel client l\'a demandée.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : le temps joue contre vous',
        md: `Les pelures arrivées chez un exchange sont souvent converties et retirées en quelques heures. Lancez les demandes de gel sur les pelures **les plus récentes** dès qu'elles sont identifiées, et les demandes d'identification sur les **plus anciennes** sans attendre la fin de l'analyse : les données de connexion et certains journaux techniques ne sont conservés que pendant une durée limitée.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Peel chain', def: 'Suite de transactions où une grosse UTXO est fractionnée en petites sorties successives, le reste passant chaque fois à une adresse neuve.' },
          { term: 'Pelure', def: 'Petite sortie détachée à chaque saut, envoyée vers une destination (service, intermédiaire).' },
          { term: 'Reste', def: 'Grosse sortie de chaque saut, qui alimente le saut suivant ; c\'est le rendu de l\'auteur.' },
          { term: 'Tableau des pelures', def: 'Relevé saut par saut (txid, heure, montant, destination, attribution, confiance) qui fonde les réquisitions.' },
          { term: 'Chaîne ramifiée', def: 'Peel chain dont le reste est scindé à un saut, créant plusieurs chaînes parallèles.' },
        ],
      },
    ],
    keyPoints: [
      'Peel chain : une grosse UTXO épluchée en petites sorties successives, le reste allant à une nouvelle adresse de l\'auteur.',
      'Indices : 1 → 2 répétés, petite et grosse sortie, régularité temporelle, même type de script, pelures dans une fourchette stable, frais constants.',
      'On suit le reste ; on tabule chaque pelure (txid, heure UTC, montant, euros, destination, attribution, confiance).',
      'Regrouper les pelures par service pour cibler et prioriser les réquisitions ; une réquisition peut couvrir toutes les pelures d\'un service.',
      'Les retraits d\'un hot wallet d\'exchange imitent une peel chain : vérifier qui contrôle le départ de la chaîne.',
      'Agir vite : gel sur les pelures récentes, identification sur les plus anciennes.',
    ],
    quiz: [
      {
        q: 'Dans une peel chain, quelle sortie faut-il suivre pour rester sur les fonds de l\'auteur ?',
        options: ['La plus petite', 'Celle qui va vers un exchange', 'N\'importe laquelle', 'La grosse sortie vers une adresse neuve'],
        answer: 3,
        explain: 'La grosse sortie est le reste (rendu) qui alimente le saut suivant ; les petites sorties sont les pelures envoyées vers des destinations.',
      },
      {
        q: 'Quel indice suggère le plus nettement une peel chain automatisée ?',
        options: ['Des intervalles très réguliers entre les sauts', 'Des entrées multiples à chaque saut', 'Un seul saut', 'Des montants de sortie identiques'],
        answer: 0,
        explain: 'Un script envoie les sauts à intervalle régulier (un par bloc, toutes les 20 minutes…), ce qui trahit l\'automatisation.',
      },
      {
        q: 'Pourquoi prioriser les demandes d\'identification sur les pelures les plus anciennes ?',
        options: [
          'Parce que les montants y sont toujours plus élevés',
          'Parce que certaines données techniques (connexions, journaux) peuvent être purgées après un délai de conservation',
          'Parce que la loi l\'impose',
          'Ce n\'est pas pertinent',
        ],
        answer: 1,
        explain: 'Les durées de conservation des données techniques sont limitées : plus on attend, plus le risque de perte augmente.',
      },
      {
        kind: 'multi',
        q: 'Quelles informations doivent figurer dans le tableau des pelures ? (plusieurs réponses)',
        options: [
          'Le txid et l\'heure UTC de chaque saut',
          'Le montant en BTC et sa contre-valeur en euros à la date',
          'L\'adresse de destination et son attribution avec sa source',
          'Le niveau de confiance de l\'attribution',
          'La couleur du nœud dans le graphe',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Le tableau doit permettre de rédiger les réquisitions et de justifier chaque attribution. La présentation graphique est accessoire.',
      },
      {
        q: 'Une chaîne de 50 sauts démarre dans un cluster attribué à un grand exchange. Interprétation la plus prudente ?',
        options: [
          'L\'exchange blanchit des fonds',
          'Le suspect a piraté l\'exchange',
          'Ce sont probablement des retraits de clients du hot wallet : chaque pelure est un client différent',
          'C\'est un CoinJoin',
        ],
        answer: 2,
        explain: 'Les hot wallets d\'exchange produisent ce schéma lors des retraits successifs. Seule la pelure liée à l\'affaire intéresse l\'enquête, via réquisition.',
      },
      {
        kind: 'truefalse',
        q: 'Quand plusieurs pelures arrivent chez le même exchange, il vaut mieux adresser une réquisition séparée par pelure, sans les relier.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Une réquisition unique listant toutes les adresses de dépôt et tous les txid permet au service de relier les dépôts et donne une réponse plus complète.',
      },
      {
        q: 'Pourquoi l\'auteur fractionne-t-il ses fonds en pelures plutôt que de tout déposer en une fois ?',
        options: [
          'Pour réduire les frais',
          'Pour rester sous les seuils de vigilance et multiplier les comptes d\'encaissement',
          'Parce que Bitcoin limite le montant par transaction',
          'Pour accélérer les confirmations',
        ],
        answer: 1,
        explain: 'Le fractionnement dilue le risque de détection et de gel ; il coûte pourtant des frais et laisse autant de points d\'identification.',
      },
    ],
    flashcards: [
      { front: 'Peel chain', back: 'Une grosse UTXO fractionnée en petites sorties successives (pelures), le reste allant chaque fois vers une adresse neuve de l\'auteur.' },
      { front: 'Quelle sortie suivre dans une peel chain ?', back: 'La grosse sortie (le reste), qui est le rendu de l\'auteur et alimente le saut suivant.' },
      { front: 'Indice d\'automatisation', back: 'Des intervalles très réguliers entre les sauts (un par bloc, toutes les 20 minutes).' },
      { front: 'Contenu du tableau des pelures', back: 'N° de saut, txid, heure UTC, BTC, euros, destination, attribution, source, confiance.' },
      { front: 'Faux ami de la peel chain', back: 'Les retraits successifs d\'un hot wallet d\'exchange : chaque pelure y est un client différent.' },
      { front: 'Comment prioriser les réquisitions ?', back: 'Services coopératifs et capables de geler, montants élevés, pelures anciennes (données techniques à durée de conservation limitée).' },
      { front: 'Pourquoi l\'auteur épluche-t-il ?', back: 'Passer sous les seuils de vigilance, multiplier les comptes d\'encaissement, décourager l\'analyste.' },
      { front: 'Chaîne ramifiée', back: 'À un saut, le reste est scindé en deux grosses sorties : deux chaînes parallèles à suivre.' },
    ],
    practice: ['peel-chain', 'ransomware-raas', 'darknet-vendor'],
  },
]
