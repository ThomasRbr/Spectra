import type { Lesson } from '../model'

// Niveau 1 — Initié (1/2) : UTXO, frais et mempool, modèle à comptes,
// jetons ERC-20.
// Les entités citées (Coinvault, Binova, Nordex, OmniSwap…) sont FICTIVES.

export const LESSONS_L1A: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════
  // utxo
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'utxo',
    title: 'Le modèle UTXO et les types de scripts',
    level: 1,
    track: 'bitcoin',
    minutes: 25,
    summary:
      "Comment Bitcoin (et Litecoin, Bitcoin Cash, Dogecoin…) représente la valeur : des « pièces » non dépensées consommées en entier, une sortie de rendu, des frais implicites. Reconnaître les types d'adresses, lire la forme d'une transaction et éviter les erreurs classiques d'interprétation.",
    objectives: [
      'Vous saurez expliquer ce qu\'est une UTXO et pourquoi une transaction Bitcoin produit presque toujours un rendu.',
      'Vous saurez calculer les frais d\'une transaction à partir de ses entrées et sorties.',
      'Vous saurez reconnaître les types de scripts (P2PKH, P2SH, P2WPKH, P2WSH, P2TR) à partir de l\'adresse.',
      'Vous saurez interpréter la forme d\'une transaction (paiement, consolidation, paiement groupé, coinbase).',
      'Vous saurez éviter les erreurs fréquentes de lecture d\'une transaction UTXO.',
    ],
    prerequisites: ['bases-blockchain', 'unites-ordres', 'explorateur-blocs'],
    practice: ['first-trace', 'change-anatomy'],
    blocks: [
      {
        type: 'text',
        md: `Bitcoin ne tient **pas de soldes**. Il n'existe nulle part une ligne « adresse X : 1,2 BTC ». Le registre contient des **sorties de transaction non dépensées**, en anglais *Unspent Transaction Outputs* : les **UTXO**. Le « solde » qu'affiche un explorateur n'est que la somme des UTXO rattachées à une adresse.

Comprendre ce modèle est indispensable pour lire correctement une transaction Bitcoin, et pour ne pas se tromper sur ce qui a réellement été payé.`,
      },
      { type: 'heading', text: 'Des pièces, pas des comptes' },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : le porte-monnaie de billets',
        md: `Vous avez dans votre porte-monnaie un billet de 50 € et un billet de 20 €. Pour payer 35 €, vous ne pouvez pas « découper » le billet de 50 : vous le donnez **en entier** et le commerçant vous **rend** 15 €. Une UTXO est un billet de montant quelconque : on la dépense toujours en totalité, et on se rend la monnaie à soi-même.`,
      },
      {
        type: 'text',
        md: `Une transaction Bitcoin :

1. **consomme** une ou plusieurs UTXO existantes, appelées **entrées** (*inputs*). Chacune est désignée par la transaction qui l'a créée et son rang : \`txid:index\` ;
2. **crée** de nouvelles UTXO, les **sorties** (*outputs*), chacune verrouillée par un script (le plus souvent : « seul le détenteur de la clé de telle adresse peut la dépenser ») ;
3. paie des **frais implicites** : il n'y a pas de champ « frais ». **Frais = somme des entrées − somme des sorties.**

Si l'on veut payer moins que la valeur des pièces utilisées, on se renvoie la différence sur une **adresse de rendu** (*change*), contrôlée par le même portefeuille et souvent toute neuve.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'i1', label: 'UTXO 0,50 BTC', kind: 'wallet', sub: 'bc1q…a4k (entrée 1)' },
          { id: 'i2', label: 'UTXO 0,30 BTC', kind: 'wallet', sub: 'bc1q…7mz (entrée 2)' },
          { id: 'tx', label: 'Transaction', kind: 'tx', sub: '2 entrées → 2 sorties' },
          { id: 'o1', label: 'Destinataire', kind: 'unknown', sub: '0,25 BTC' },
          { id: 'o2', label: 'Rendu', kind: 'wallet', sub: '0,54997 BTC (nouvelle adresse)' },
          { id: 'f', label: 'Frais', kind: 'service', sub: '0,00003 BTC au mineur' },
        ],
        edges: [
          { from: 'i1', to: 'tx', label: '0,50' },
          { from: 'i2', to: 'tx', label: '0,30' },
          { from: 'tx', to: 'o1', label: '0,25' },
          { from: 'tx', to: 'o2', label: '0,54997' },
          { from: 'tx', to: 'f', label: '3 000 sats', dashed: true },
        ],
        caption: 'Paiement de 0,25 BTC avec deux pièces totalisant 0,80 BTC : 0,80 − 0,25 − 0,54997 = 0,00003 BTC de frais.',
      },
      {
        type: 'widget',
        id: 'utxo-builder',
        caption: 'Choisissez les UTXO à dépenser pour un paiement donné : le simulateur calcule le rendu et les frais.',
      },
      {
        type: 'check',
        q: 'Entrées : 1,2 BTC au total. Sorties : 0,5 BTC et 0,6995 BTC. Quels sont les frais ?',
        options: ['0,0005 BTC', '0,005 BTC', '0,7 BTC', 'Impossible à calculer sans champ « frais »'],
        answer: 0,
        explain: '1,2 − 0,5 − 0,6995 = 0,0005 BTC, soit 50 000 sats. Les frais sont toujours implicites sur Bitcoin.',
      },
      { type: 'heading', text: 'Les types de scripts et leurs adresses' },
      {
        type: 'text',
        md: `Chaque sortie est verrouillée par un **script**, et le format de l'adresse révèle le type de ce script. Au fil des évolutions de Bitcoin (notamment **SegWit** en 2017 et **Taproot** en 2021), plusieurs formats se sont succédé ; tous coexistent encore.`,
      },
      {
        type: 'table',
        headers: ['Type', 'Préfixe', 'Longueur', 'Usage typique', 'Remarque d\'enquête'],
        rows: [
          ['P2PKH (Pay-to-Public-Key-Hash)', '1', '26 à 34', 'Format historique, vieux portefeuilles', 'Frais plus élevés ; utilisateurs anciens ou logiciels datés'],
          ['P2SH (Pay-to-Script-Hash)', '3', '34', 'Multisignatures historiques, SegWit encapsulé', 'Le script réel n\'est révélé qu\'à la dépense'],
          ['P2WPKH (SegWit natif, clé unique)', 'bc1q', '42', 'Le plus courant chez les particuliers et de nombreux exchanges', '—'],
          ['P2WSH (SegWit natif, script)', 'bc1q', '62', 'Multisignatures modernes, canaux Lightning', 'La dépense révèle le script (ex. 2-sur-3)'],
          ['P2TR (Taproot)', 'bc1p', '62', 'Portefeuilles récents', 'Une multisignature peut ressembler à une clé simple'],
        ],
        caption: 'On rencontre aussi des sorties P2PK (clé publique nue, années 2009-2010) et OP_RETURN (donnée arbitraire, montant nul : ce n\'est pas un destinataire).',
      },
      {
        type: 'widget',
        id: 'address-anatomy',
        caption: 'Reconnaissez le type de script à partir du préfixe et de la longueur de l\'adresse.',
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Testnet et autres chaînes UTXO',
        md: `- Sur les réseaux de test de Bitcoin (testnet, signet), les adresses commencent par \`tb1\`, \`m\`, \`n\` ou \`2\` : ces bitcoins n'ont **aucune valeur**. Une telle adresse dans une plainte signale une confusion ou une arnaque grossière.
- Litecoin (\`L\`, \`M\`, \`ltc1\`), Dogecoin (\`D\`), Bitcoin Cash (\`q\` ou \`bitcoincash:q…\`) reposent sur le même modèle UTXO : la méthode de cette leçon s'y applique.`,
      },
      { type: 'heading', text: 'Pourquoi le type de script aide l\'enquêteur' },
      {
        type: 'text',
        md: `Un portefeuille logiciel utilise en général **un seul type d'adresse** pour toutes ses adresses, rendu compris. D'où une heuristique très utile : **le rendu a généralement le même type de script que les entrées**.

Exemple : entrées en \`bc1q\` (42 caractères) ; sorties vers une adresse \`3…\` et une adresse \`bc1q…\`. L'adresse \`bc1q\` est probablement le rendu, l'adresse \`3…\` le paiement.

Autres apports :

- **Multisignature** : quand une sortie P2SH ou P2WSH est dépensée, le script est publié. Un 2-sur-3 évoque un séquestre de place de marché ou de plateforme P2P, ou la garde d'un exchange.
- **Empreinte de service** : certains exchanges utilisent un type précis pour leurs adresses de dépôt et un autre pour leur hot wallet.
- **Lightning** : l'ouverture d'un canal crée typiquement une sortie P2WSH 2-sur-2 (ou P2TR pour les canaux récents).`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Une heuristique, pas une preuve',
        md: `Les portefeuilles modernes migrent vers Taproot, et certains choisissent volontairement pour le rendu le même type que celui du paiement afin de brouiller cette lecture. Le type de script n'est qu'un indice parmi d'autres ; la leçon « Détecter l'adresse de rendu » (niveau 2) présente les autres heuristiques et leur combinaison.`,
      },
      { type: 'heading', text: 'La forme d\'une transaction' },
      {
        type: 'table',
        headers: ['Forme', 'Interprétation la plus fréquente', 'Exemple'],
        rows: [
          ['1-2 entrées → 2 sorties', 'Paiement simple avec rendu', 'Un particulier paie un vendeur'],
          ['N entrées → 1 sortie', 'Consolidation ou balayage (sweep)', 'Un exchange rapatrie ses adresses de dépôt vers son hot wallet'],
          ['1 entrée → N sorties (dizaines, centaines)', 'Paiement groupé (batching)', 'Retraits d\'exchange, paiements d\'un pool de minage'],
          ['N entrées → N sorties de montants égaux', 'CoinJoin (transaction collaborative de confidentialité)', 'Coordinateur Whirl Coordinator (niveau 4)'],
          ['Aucune entrée réelle', 'Transaction coinbase : création monétaire', 'Première transaction de chaque bloc, au profit d\'un mineur ou d\'un pool'],
          ['1 entrée → 1 sortie', 'Transfert intégral (« vider » une adresse)', 'Passage d\'une adresse intermédiaire à la suivante'],
        ],
      },
      {
        type: 'check',
        q: 'Une transaction comporte 140 entrées et une seule sortie. De quoi s\'agit-il le plus probablement ?',
        options: ['Un CoinJoin', 'Une consolidation / un balayage', 'Un paiement groupé', 'Une transaction coinbase'],
        answer: 1,
        explain: 'N entrées vers 1 sortie : regroupement d\'UTXO, typique du balayage des adresses de dépôt d\'un exchange vers son hot wallet, ou d\'un utilisateur qui consolide son portefeuille.',
      },
      { type: 'heading', text: 'Lire une transaction Bitcoin pas à pas' },
      {
        type: 'steps',
        items: [
          { title: 'Repérer la forme', md: 'Nombre d\'entrées et de sorties : paiement, consolidation, paiement groupé, CoinJoin ?' },
          { title: 'Calculer les frais', md: 'Somme des entrées − somme des sorties. Les explorateurs l\'affichent, mais refaites le calcul.' },
          { title: 'Identifier les types de scripts', md: 'Type des entrées, type de chaque sortie. Notez les sorties OP_RETURN (non monétaires).' },
          { title: 'Proposer paiement et rendu', md: 'Quelle sortie est le paiement, laquelle le rendu ? Notez l\'heuristique utilisée et son degré de confiance.' },
          { title: 'Vérifier le devenir des sorties', md: 'Une sortie déjà dépensée affiche la transaction suivante : c\'est le saut d\'après.' },
        ],
      },
      {
        type: 'case',
        title: 'Cas : le faux vendeur automobile',
        md: `M. B. paie un acompte de **0,12 BTC** pour un véhicule repéré sur un site d'annonces. Le vendeur disparaît. L'adresse de paiement \`bc1qk3…w8t0ze\` (P2WPKH) reçoit l'acompte, puis la transaction suivante est observée :

- **Entrées** : 0,12 BTC (l'acompte) + 0,0841 BTC (une autre UTXO de la même adresse ou d'une adresse du même portefeuille) ;
- **Sorties** : 0,19 BTC vers \`3Fq7…uK2d\` (P2SH) et 0,01397 BTC vers \`bc1qm9…2fq7xs\` (P2WPKH, adresse neuve) ;
- **Frais** : 0,2041 − 0,19 − 0,01397 = **0,00013 BTC** (13 000 sats).

Lecture : la sortie de 0,19 BTC, montant rond et de type différent des entrées, est probablement le **paiement** ; la sortie de 0,01397 BTC, de même type que les entrées et vers une adresse jamais vue, est probablement le **rendu**. L'analyse ultérieure montre que \`3Fq7…uK2d\` est une adresse de dépôt **Nordex** : réquisition (via la voie adaptée à un prestataire d'un autre État membre) avec le txid et la sortie concernée.`,
      },
      { type: 'heading', text: 'Erreurs fréquentes' },
      {
        type: 'table',
        headers: ['Erreur', 'Pourquoi c\'est faux', 'Bonne pratique'],
        rows: [
          ['Lire « 0,80 BTC envoyés » parce que l\'adresse a dépensé 0,80 BTC', 'Seuls 0,25 BTC ont quitté le portefeuille ; le reste est revenu en rendu', 'Identifier explicitement paiement et rendu'],
          ['Prendre la plus grosse sortie pour le paiement', 'Un achat de 2 BTC avec une pièce de 2,1 BTC produit un rendu minuscule', 'Combiner plusieurs heuristiques'],
          ['Attribuer toutes les entrées à une seule personne sans vérification', 'Un CoinJoin ou un PayJoin réunit plusieurs participants', 'Vérifier la forme de la transaction'],
          ['Raisonner sur le solde d\'une adresse', 'Le portefeuille contient d\'autres adresses', 'Regrouper les adresses avant de parler de patrimoine'],
          ['Oublier les frais dans les rapprochements', 'Quelques milliers de sats d\'écart sont normaux', 'Tolérer l\'écart correspondant aux frais'],
        ],
      },
      {
        type: 'check',
        q: 'Entrées en bc1q (42 caractères). Sorties : une adresse « 3… » et une adresse « bc1q… » (42 caractères) jamais utilisée. Quelle est probablement l\'adresse de rendu ?',
        options: ['L\'adresse 3…', 'L\'adresse bc1q…', 'Les deux', 'Aucune, il n\'y a pas de rendu sur Bitcoin'],
        answer: 1,
        explain: 'Heuristique de correspondance du type de script, renforcée par le fait que l\'adresse est neuve. Ce n\'est qu\'une probabilité à étayer.',
      },
      {
        type: 'terms',
        items: [
          { term: 'UTXO', def: 'Unspent Transaction Output : sortie non dépensée, « pièce » de montant quelconque.' },
          { term: 'Entrée (input)', def: 'Référence à une UTXO existante (txid:index) consommée par la transaction.' },
          { term: 'Sortie (output)', def: 'Nouvelle UTXO créée, verrouillée par un script.' },
          { term: 'Rendu (change)', def: 'Sortie qui renvoie la différence au portefeuille émetteur.' },
          { term: 'SegWit', def: 'Évolution de Bitcoin (2017) qui a introduit les adresses bc1q et réduit les frais.' },
          { term: 'Taproot', def: 'Évolution de Bitcoin (2021) qui a introduit les adresses bc1p.' },
          { term: 'OP_RETURN', def: 'Sortie non dépensable, de montant nul, portant une donnée arbitraire.' },
          { term: 'Coinbase', def: 'Première transaction d\'un bloc, qui crée la récompense du mineur.' },
        ],
      },
    ],
    keyPoints: [
      'Une UTXO se dépense en entier ; la différence revient sur une adresse de rendu.',
      'Frais = somme des entrées − somme des sorties (aucun champ « frais »).',
      'Préfixes : 1 = P2PKH, 3 = P2SH, bc1q (42) = P2WPKH, bc1q (62) = P2WSH, bc1p = P2TR.',
      'Le rendu a souvent le même type de script que les entrées : indice, pas preuve.',
      'La forme de la transaction (N→1, 1→N, montants égaux, coinbase) révèle souvent sa nature.',
      'Le montant « dépensé » par une adresse n\'est pas le montant payé : identifier paiement et rendu.',
      'Le solde d\'une adresse n\'est pas le patrimoine d\'une personne.',
    ],
    quiz: [
      {
        q: 'Une adresse commence par « bc1p ». De quel type s\'agit-il ?',
        options: ['P2PKH', 'P2SH', 'P2WPKH', 'P2TR (Taproot)'],
        answer: 3,
        explain: 'bc1p désigne une sortie Taproot (SegWit version 1).',
      },
      {
        q: 'Entrées : 0,4 BTC et 0,15 BTC. Sorties : 0,3 BTC et 0,2498 BTC. Quels sont les frais en satoshis ?',
        options: ['2 000 sats', '20 000 sats', '200 000 sats', '2 sats'],
        answer: 1,
        explain: '0,55 − 0,3 − 0,2498 = 0,0002 BTC = 20 000 sats.',
      },
      {
        kind: 'truefalse',
        q: 'Une adresse qui dépense une UTXO de 1 BTC pour payer 0,1 BTC a « envoyé 1 BTC » à son destinataire.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'L\'UTXO est consommée en entier, mais environ 0,9 BTC reviennent en rendu au portefeuille émetteur. Seul 0,1 BTC a été payé.',
      },
      {
        q: 'Que révèle la dépense d\'une sortie P2WSH ?',
        options: ['L\'identité du titulaire', 'Le script complet, par exemple une multisignature 2-sur-3', 'L\'adresse IP', 'Rien de plus qu\'une P2WPKH'],
        answer: 1,
        explain: 'Le script caché derrière un hash (P2SH/P2WSH) est publié lors de la dépense, ce qui révèle une éventuelle structure multisignature.',
      },
      {
        kind: 'multi',
        q: 'Quelles blockchains reposent sur le modèle UTXO ? (plusieurs réponses)',
        options: ['Bitcoin', 'Litecoin', 'Ethereum', 'Dogecoin'],
        answer: [0, 1, 3],
        explain: 'Bitcoin et ses dérivés (Litecoin, Dogecoin, Bitcoin Cash) utilisent les UTXO. Ethereum utilise le modèle à comptes.',
      },
      {
        q: 'Une transaction a une seule entrée et 180 sorties de montants variés. Interprétation la plus probable ?',
        options: ['Un CoinJoin', 'Une consolidation', 'Un paiement groupé, par exemple des retraits d\'exchange', 'Une coinbase'],
        answer: 2,
        explain: '1 → N : paiement groupé (batching). Les montants variés excluent le CoinJoin, qui produit des sorties égales.',
      },
      {
        q: 'Une sortie OP_RETURN de 0 BTC figure dans une transaction. Comment la traiter ?',
        options: [
          'C\'est le destinataire principal',
          'C\'est une donnée inscrite dans la blockchain, non dépensable : ce n\'est pas un destinataire',
          'C\'est le rendu',
          'C\'est une erreur de l\'explorateur',
        ],
        answer: 1,
        explain: 'OP_RETURN sert à inscrire une donnée (protocoles, horodatage…). Elle n\'a pas de valeur monétaire.',
      },
      {
        q: 'Une adresse commençant par « tb1 » est fournie par une victime comme adresse de paiement. Qu\'en déduire ?',
        options: [
          'C\'est une adresse Taproot',
          'C\'est une adresse de réseau de test : ces bitcoins n\'ont aucune valeur, signe d\'une confusion ou d\'une arnaque',
          'C\'est une adresse Tron',
          'C\'est une adresse d\'exchange',
        ],
        answer: 1,
        explain: 'tb1 est le préfixe des adresses SegWit du testnet/signet.',
      },
    ],
    flashcards: [
      { front: 'UTXO', back: 'Unspent Transaction Output : pièce non dépensée, consommée en entier.' },
      { front: 'Calcul des frais (UTXO)', back: 'Somme des entrées − somme des sorties.' },
      { front: 'Préfixe 1', back: 'P2PKH (format historique).' },
      { front: 'Préfixe 3', back: 'P2SH (multisig historique, SegWit encapsulé).' },
      { front: 'bc1q, 42 caractères', back: 'P2WPKH (SegWit natif, clé unique).' },
      { front: 'bc1q, 62 caractères', back: 'P2WSH (SegWit natif, script : multisig, Lightning).' },
      { front: 'bc1p', back: 'P2TR (Taproot).' },
      { front: 'N entrées → 1 sortie', back: 'Consolidation / balayage (sweep).' },
      { front: '1 entrée → N sorties', back: 'Paiement groupé (batching).' },
      { front: 'Heuristique du type de script', back: 'Le rendu a souvent le même type que les entrées.' },
      { front: 'Transaction coinbase', back: 'Première transaction d\'un bloc ; crée la récompense du mineur, sans entrée réelle.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // frais-mempool
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'frais-mempool',
    title: 'Frais, mempool et confirmations',
    level: 1,
    track: 'bitcoin',
    minutes: 20,
    summary:
      "Pourquoi une transaction Bitcoin paie des frais, comment ils se calculent (taille en vbytes × taux en sat/vB), ce qui se passe dans le mempool, comment une transaction peut être accélérée ou remplacée (RBF, CPFP), et ce que les frais et les champs techniques révèlent sur le logiciel de l'auteur.",
    objectives: [
      'Vous saurez calculer et interpréter un taux de frais en sat/vB.',
      'Vous saurez expliquer le fonctionnement du mempool et la notion de priorité.',
      'Vous saurez reconnaître un remplacement (RBF) ou une accélération (CPFP) et leurs implications.',
      'Vous saurez exploiter frais et champs techniques comme empreinte comportementale.',
    ],
    prerequisites: ['utxo'],
    practice: ['change-anatomy', 'first-trace'],
    blocks: [
      {
        type: 'text',
        md: `Un bloc Bitcoin a une **capacité limitée**. Quand beaucoup d'utilisateurs veulent transacter en même temps, ils sont en concurrence pour y entrer, et les mineurs choisissent les transactions qui paient le mieux **par unité de place occupée**. Les frais ne dépendent donc **pas du montant envoyé** : envoyer 0,001 BTC ou 100 BTC peut coûter exactement la même chose.

Pour l'enquêteur, les frais sont une source d'information sous-estimée : ils renseignent sur l'urgence de l'auteur, son logiciel, et parfois relient des transactions entre elles.`,
      },
      { type: 'heading', text: 'Taille et taux de frais' },
      {
        type: 'text',
        md: `La place occupée par une transaction se mesure en **octets virtuels** (*vbytes*, vB). Depuis SegWit, une partie des données (les signatures) « pèse » moins lourd : c'est pourquoi on parle d'octets *virtuels* (techniquement, vsize = poids / 4). Un bloc peut contenir environ **1 million de vB**.

Le **taux de frais** s'exprime en **satoshis par vbyte** (sat/vB) :

**frais (sats) = taille (vB) × taux (sat/vB)**

Exemple : une transaction de 141 vB à 12 sat/vB paie 1 692 sats.`,
      },
      {
        type: 'table',
        headers: ['Élément', 'Taille approximative', 'Remarque'],
        rows: [
          ['Entrée P2PKH (1…)', '≈ 148 vB', 'Format historique, le plus lourd'],
          ['Entrée P2WPKH (bc1q)', '≈ 68 vB', 'Signature allégée par SegWit'],
          ['Entrée P2TR (bc1p)', '≈ 58 vB', 'Taproot, dépense par clé'],
          ['Sortie P2WPKH', '≈ 31 vB', '—'],
          ['Sortie P2TR', '≈ 43 vB', '—'],
          ['Transaction 1 entrée → 2 sorties (bc1q)', '≈ 141 vB', 'Paiement simple typique'],
          ['Consolidation 100 entrées → 1 sortie (bc1q)', '≈ 6 840 vB', 'Coûteuse : les exchanges consolident quand les frais sont bas'],
        ],
        caption: 'Ordres de grandeur. Ce sont les entrées qui pèsent : plus on dépense de pièces, plus la transaction coûte.',
      },
      {
        type: 'widget',
        id: 'fee-mempool',
        caption: 'Faites varier taille et taux de frais : observez la position de la transaction dans la file d\'attente et le délai probable de confirmation.',
      },
      {
        type: 'check',
        q: 'Une transaction de 250 vB paie 5 000 sats de frais. Quel est son taux ?',
        options: ['2 sat/vB', '20 sat/vB', '200 sat/vB', '0,05 sat/vB'],
        answer: 1,
        explain: '5 000 / 250 = 20 sat/vB.',
      },
      { type: 'heading', text: 'Le mempool : une salle d\'attente aux enchères' },
      {
        type: 'text',
        md: `Chaque nœud tient son propre **mempool** : la liste des transactions valides reçues mais pas encore incluses dans un bloc. Il n'existe donc pas « un » mempool officiel, même si les contenus sont très proches d'un nœud à l'autre.

Les mineurs construisent leurs blocs en prenant en priorité les taux les plus élevés. Quand la demande est forte, le taux minimal pour entrer dans le prochain bloc monte (parfois à plusieurs dizaines ou centaines de sat/vB lors des pics) ; quand elle est faible, il redescend à quelques sat/vB, voire moins.

Une transaction qui paie trop peu peut rester bloquée des heures, des jours, puis être **oubliée** par les nœuds (par défaut, le logiciel de référence purge les transactions de plus de deux semaines ou lorsque son mempool est plein).`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'w', label: 'Portefeuille', kind: 'wallet', sub: 'Choisit le taux' },
          { id: 'm', label: 'Mempool', kind: 'service', sub: 'Tri par sat/vB' },
          { id: 'b', label: 'Prochain bloc', kind: 'tx', sub: '≈ 1 M vB' },
          { id: 'x', label: 'Expirée / purgée', kind: 'unknown', sub: 'Taux trop bas' },
        ],
        edges: [
          { from: 'w', to: 'm', label: 'diffusion' },
          { from: 'm', to: 'b', label: 'taux élevé' },
          { from: 'm', to: 'x', label: 'taux trop faible', dashed: true },
        ],
        caption: 'Le taux de frais détermine l\'ordre de passage.',
      },
      { type: 'heading', text: 'Accélérer ou remplacer : RBF et CPFP' },
      {
        type: 'compare',
        left: {
          title: 'RBF (Replace-By-Fee)',
          md: `- L'émetteur **rediffuse** une nouvelle version de sa transaction, qui dépense **les mêmes entrées** avec des frais plus élevés
- Les nœuds remplacent l'ancienne version
- Permet d'**accélérer**… ou de **modifier les destinataires**, voire de se renvoyer les fonds
- Le logiciel de référence accepte désormais les remplacements par défaut (« full RBF »)`,
        },
        right: {
          title: 'CPFP (Child-Pays-For-Parent)',
          md: `- Le **destinataire** (ou l'émetteur via son rendu) dépense une sortie de la transaction bloquée dans une **nouvelle** transaction très rémunératrice
- Les mineurs incluent les deux ensemble pour toucher les frais de l'« enfant »
- Laisse une trace : une transaction « enfant » confirmée dans le même bloc que son « parent », avec un taux élevé`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Le piège de la transaction non confirmée',
        md: `Une transaction vue dans le mempool **n'est pas un paiement acquis**. Grâce au RBF, l'émetteur peut la remplacer par une version qui renvoie les fonds vers sa propre adresse. Des escrocs l'exploitent auprès de vendeurs particuliers (« regardez, le paiement est parti ! ») pour repartir avec la marchandise avant la première confirmation.`,
      },
      {
        type: 'case',
        title: 'Cas : le paiement qui disparaît',
        md: `M. G. vend une montre 4 200 € à un acheteur qui insiste pour payer en bitcoins. Sur place, l'acheteur montre l'écran : la transaction de **0,0712 BTC** vers l'adresse de M. G. est « en attente ». Il repart avec la montre. Le lendemain, M. G. ne voit plus rien.

L'analyse sur un explorateur qui conserve l'historique des remplacements montre que :

- la transaction initiale payait **1 sat/vB** (volontairement trop peu pour être confirmée rapidement) ;
- **38 minutes** plus tard, une transaction dépensant **la même entrée** à **45 sat/vB** a été diffusée : unique sortie vers une adresse \`bc1q…\` contrôlée par l'acheteur ;
- c'est cette seconde version qui a été confirmée.

Les deux versions ont la même entrée : le lien entre l'adresse de paiement « promise » et l'adresse de l'acheteur est établi. Elle devient le point de départ de la trace.`,
      },
      {
        type: 'check',
        q: 'Deux transactions dépensent exactement la même entrée ; une seule est confirmée. Que s\'est-il passé ?',
        options: [
          'Une double dépense réussie sur deux blocs',
          'Un remplacement (RBF) : la version aux frais plus élevés a été retenue, l\'autre n\'a jamais existé dans le registre',
          'Un CoinJoin',
          'Une erreur de l\'explorateur',
        ],
        answer: 1,
        explain: 'Une même UTXO ne peut être dépensée qu\'une fois dans le registre. La version non confirmée a été évincée du mempool.',
      },
      { type: 'heading', text: 'Confirmations : combien attendre ?' },
      {
        type: 'table',
        headers: ['Nombre de confirmations', 'Délai indicatif (Bitcoin)', 'Usage'],
        rows: [
          ['0 (mempool)', '—', 'Aucune garantie : remplaçable'],
          ['1', '≈ 10 min', 'Inscrite ; une réorganisation reste possible mais rare'],
          ['3', '≈ 30 min', 'Seuil fréquent pour de petits montants'],
          ['6', '≈ 1 h', 'Seuil conventionnel de sécurité'],
          ['100', '≈ 17 h', 'Délai avant de pouvoir dépenser une récompense de minage (coinbase)'],
        ],
        caption: 'Chaque exchange fixe son propre seuil de crédit des dépôts, variable selon la chaîne et le montant.',
      },
      { type: 'heading', text: 'Les frais comme empreinte' },
      {
        type: 'text',
        md: `Chaque logiciel de portefeuille a ses habitudes, qui laissent des traces dans la transaction :

- **Taux de frais** : entier ou décimal, arrondi, calé sur l'estimation du moment ou fixé manuellement. Un auteur qui paie systématiquement 1,01 sat/vB ou exactement 50 sat/vB laisse une signature.
- **Signal RBF** (valeur du champ \`nSequence\` des entrées) : certains logiciels l'activent toujours, d'autres jamais.
- **nLockTime** : certains logiciels le fixent à la hauteur du bloc courant (protection dite « anti fee sniping »), d'autres à 0.
- **Ordre des entrées et sorties**, **version** de la transaction, types de scripts.

Ces éléments ne prouvent rien isolément, mais leur **constance** sur une série de transactions renforce l'hypothèse qu'elles émanent d'un même portefeuille. C'est la base de l'analyse comportementale (niveau 5).`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : ce que disent les frais',
        md: `- **Frais très élevés** en période calme : urgence (fuite après une escroquerie, crainte d'un gel) ou maladresse.
- **Frais très bas** et consolidations massives : comportement d'un service (exchange) qui optimise ses coûts.
- **Heure de diffusion vs heure du bloc** : un explorateur qui garde l'historique du mempool indique quand la transaction a été vue pour la première fois. L'écart avec l'heure du bloc renseigne sur le moment réel de l'action de l'auteur.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'vbyte (vB)', def: 'Octet virtuel : unité de taille des transactions depuis SegWit (poids / 4).' },
          { term: 'sat/vB', def: 'Taux de frais : satoshis payés par vbyte occupé.' },
          { term: 'Mempool', def: 'File d\'attente propre à chaque nœud, triée par taux de frais.' },
          { term: 'RBF', def: 'Replace-By-Fee : remplacement d\'une transaction non confirmée par une version mieux rémunérée.' },
          { term: 'CPFP', def: 'Child-Pays-For-Parent : une transaction enfant très rémunératrice entraîne la confirmation de son parent.' },
          { term: 'nLockTime', def: 'Champ fixant le moment à partir duquel une transaction peut être incluse ; sa valeur est une empreinte de logiciel.' },
        ],
      },
    ],
    keyPoints: [
      'Les frais Bitcoin dépendent de la taille (vB) et du taux (sat/vB), pas du montant envoyé.',
      'Ce sont surtout les entrées qui pèsent : une consolidation de nombreuses pièces coûte cher.',
      'Chaque nœud a son mempool ; les mineurs prennent les taux les plus élevés.',
      'Une transaction non confirmée peut être remplacée (RBF) : ce n\'est pas un paiement acquis.',
      'CPFP : une transaction enfant rémunératrice accélère son parent.',
      'Taux de frais, signal RBF, nLockTime : une empreinte du logiciel de l\'auteur.',
    ],
    quiz: [
      {
        q: 'De quoi dépendent principalement les frais d\'une transaction Bitcoin ?',
        options: [
          'Du montant envoyé',
          'De la taille de la transaction en vbytes et du taux de frais choisi',
          'De la distance entre les utilisateurs',
          'Du nombre de confirmations demandées',
        ],
        answer: 1,
        explain: 'frais = taille (vB) × taux (sat/vB). Le montant n\'intervient pas.',
      },
      {
        q: 'Une transaction de 141 vB paie un taux de 30 sat/vB. Quels sont ses frais ?',
        options: ['171 sats', '423 sats', '4 230 sats', '42 300 sats'],
        answer: 2,
        explain: '141 × 30 = 4 230 sats.',
      },
      {
        kind: 'truefalse',
        q: 'Une transaction visible dans le mempool est définitivement acquise pour le destinataire.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Tant qu\'elle n\'est pas confirmée, elle peut être remplacée (RBF) ou expirer.',
      },
      {
        q: 'Qu\'est-ce que le CPFP ?',
        options: [
          'Une taxe sur les transactions',
          'Une technique où une transaction enfant à frais élevés pousse les mineurs à inclure son parent bloqué',
          'Un type d\'adresse',
          'Le remplacement d\'une transaction par l\'émetteur',
        ],
        answer: 1,
        explain: 'Child-Pays-For-Parent : les mineurs évaluent le couple parent + enfant et incluent les deux.',
      },
      {
        kind: 'multi',
        q: 'Quels éléments techniques d\'une transaction peuvent constituer une empreinte du logiciel utilisé ? (plusieurs réponses)',
        options: ['Le taux de frais habituel', 'Le signal RBF (nSequence)', 'La valeur du nLockTime', 'La couleur de l\'adresse sur l\'explorateur'],
        answer: [0, 1, 2],
        explain: 'Ces paramètres dépendent des choix du logiciel ; leur constance sur plusieurs transactions est un indice de portefeuille commun.',
      },
      {
        q: 'Pourquoi un exchange consolide-t-il souvent ses adresses de dépôt quand les frais sont bas ?',
        options: [
          'Pour cacher ses fonds',
          'Parce qu\'une consolidation de nombreuses entrées est volumineuse, donc coûteuse : il attend un taux faible',
          'Parce que la loi l\'impose',
          'Parce que les mineurs l\'exigent',
        ],
        answer: 1,
        explain: 'Chaque entrée ajoute des dizaines de vB : une consolidation de 100 entrées représente plusieurs milliers de vB.',
      },
      {
        q: 'Combien de confirmations faut-il avant de pouvoir dépenser une récompense de minage (coinbase) ?',
        options: ['1', '6', '100', '2 016'],
        answer: 2,
        explain: 'Les sorties coinbase ne sont dépensables qu\'après 100 confirmations (maturité).',
      },
    ],
    flashcards: [
      { front: 'Formule des frais Bitcoin', back: 'Taille (vB) × taux (sat/vB).' },
      { front: 'vbyte', back: 'Octet virtuel = poids / 4 (depuis SegWit).' },
      { front: 'Taille d\'un paiement 1→2 en bc1q', back: '≈ 141 vB.' },
      { front: 'Taille d\'une entrée P2WPKH', back: '≈ 68 vB (contre ≈ 148 vB pour P2PKH).' },
      { front: 'Mempool', back: 'File d\'attente propre à chaque nœud, triée par taux de frais.' },
      { front: 'RBF', back: 'Replace-By-Fee : nouvelle version d\'une transaction non confirmée, mêmes entrées, frais plus élevés.' },
      { front: 'CPFP', back: 'Child-Pays-For-Parent : l\'enfant rémunérateur entraîne la confirmation du parent.' },
      { front: 'Seuil conventionnel de sécurité', back: '6 confirmations (≈ 1 h sur Bitcoin).' },
      { front: 'Maturité coinbase', back: '100 confirmations.' },
      { front: 'Frais très élevés en période calme', back: 'Indice d\'urgence (fuite) ou de maladresse.' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // comptes-evm
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'comptes-evm',
    title: 'Le modèle à comptes : Ethereum et chaînes EVM',
    level: 1,
    track: 'comptes',
    minutes: 25,
    summary:
      "Ethereum et les chaînes compatibles (BNB Smart Chain, Polygon, Arbitrum, Base…) tiennent des soldes par compte. Comptes externes et contrats, nonce, gaz, transactions internes et événements, financement initial d'une adresse : ce que l'enquêteur doit savoir lire.",
    objectives: [
      'Vous saurez expliquer la différence entre le modèle UTXO et le modèle à comptes, et ses conséquences pour l\'analyse.',
      'Vous saurez distinguer un compte externe (EOA) d\'un contrat.',
      'Vous saurez exploiter le nonce, le gaz et le financement initial d\'une adresse.',
      'Vous saurez lire une transaction EVM à ses trois niveaux : transaction, transactions internes, événements.',
      'Vous saurez pourquoi il faut toujours vérifier une adresse 0x sur plusieurs chaînes.',
    ],
    prerequisites: ['utxo', 'explorateur-blocs'],
    practice: ['eth-first'],
    blocks: [
      {
        type: 'text',
        md: `Contrairement à Bitcoin, Ethereum maintient un **état** : chaque adresse possède un **solde**, comme un compte bancaire. Une transaction débite l'émetteur et crédite le destinataire. Il n'y a **ni pièces, ni rendu**.

L'**EVM** (*Ethereum Virtual Machine*) est la machine virtuelle qui exécute les programmes d'Ethereum. De nombreuses autres chaînes l'ont reprise à l'identique : on parle de **chaînes EVM**. Tout ce qui est expliqué ici s'y applique, et Tron en est très proche.`,
      },
      {
        type: 'widget',
        id: 'account-vs-utxo',
        caption: 'Le même paiement vu en modèle UTXO puis en modèle à comptes : pièces et rendu d\'un côté, débit et crédit de l\'autre.',
      },
      {
        type: 'compare',
        left: {
          title: 'Ce qui disparaît par rapport à Bitcoin',
          md: `- Le **rendu** : pas de sortie à identifier
- Le regroupement par **entrées communes** : une transaction n'a qu'un émetteur
- Les frais implicites : ils sont explicites (gaz)`,
        },
        right: {
          title: 'Ce qui apparaît',
          md: `- Les **contrats** : des comptes programmés (jetons, DEX, bridges…)
- Le **nonce** : compteur des transactions émises
- Les **événements** et les **transactions internes**
- La question du **financement en gaz** de chaque adresse`,
        },
      },
      { type: 'heading', text: 'Deux types de comptes' },
      {
        type: 'table',
        headers: ['', 'EOA (Externally Owned Account)', 'Contrat (smart contract)'],
        rows: [
          ['Contrôle', 'Une clé privée', 'Son code ; aucune clé privée'],
          ['Peut initier une transaction', 'Oui', 'Non : il agit seulement quand on l\'appelle'],
          ['Exemples', 'Portefeuille d\'un particulier, adresse de dépôt d\'exchange, adresse d\'un escroc', 'Jeton USDT, DEX OmniSwap, bridge ArcBridge, multisignature, pool Cyclone Cash'],
          ['Repérage sur un explorateur', 'Pas d\'onglet « Contract »', 'Onglet « Contract », code éventuellement vérifié, déployeur indiqué'],
          ['Intérêt d\'enquête', 'Qui détient la clé ?', 'Qui l\'a déployé ? Que fait son code ? Qui l\'appelle ?'],
        ],
      },
      {
        type: 'text',
        md: `Les adresses ont la forme \`0x\` + **40 caractères hexadécimaux** (20 octets, issus de l'empreinte Keccak-256 de la clé publique pour un EOA). La casse mixte (norme EIP-55) n'est qu'une **somme de contrôle** contre les fautes de frappe : \`0xAbC…\` et \`0xabc…\` désignent la même adresse.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'La même adresse existe sur toutes les chaînes EVM',
        md: `Une clé privée contrôle l'adresse \`0x51f2…\` sur Ethereum, mais aussi sur BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche C-Chain… Vérifiez **systématiquement** l'activité d'une adresse suspecte sur les autres chaînes EVM : c'est souvent là que se trouve la suite de la trace. Une adresse « vide » sur Ethereum peut détenir des fonds ailleurs.`,
      },
      {
        type: 'table',
        headers: ['Chaîne EVM', 'Identifiant de chaîne', 'Jeton de gaz', 'Explorateur courant'],
        rows: [
          ['Ethereum', '1', 'ETH', 'Etherscan'],
          ['BNB Smart Chain', '56', 'BNB', 'BscScan'],
          ['Polygon PoS', '137', 'POL', 'PolygonScan'],
          ['Arbitrum One', '42161', 'ETH', 'Arbiscan'],
          ['Optimism', '10', 'ETH', 'Explorateur Optimism'],
          ['Base', '8453', 'ETH', 'BaseScan'],
          ['Avalanche C-Chain', '43114', 'AVAX', 'Snowtrace'],
        ],
        caption: 'L\'identifiant de chaîne (chain ID) figure dans chaque transaction signée : il précise sur quelle chaîne elle a été émise.',
      },
      {
        type: 'check',
        q: 'Une adresse 0x… n\'a aucune activité sur Ethereum. Que faire ?',
        options: [
          'Conclure qu\'elle est inutilisée',
          'Vérifier son activité sur les autres chaînes EVM (BNB Smart Chain, Polygon, Arbitrum, Base…)',
          'La considérer comme une adresse Bitcoin',
          'Demander à la fondation Ethereum',
        ],
        answer: 1,
        explain: 'La même clé contrôle la même adresse sur toutes les chaînes EVM ; l\'activité peut se trouver ailleurs.',
      },
      { type: 'heading', text: 'Le nonce' },
      {
        type: 'text',
        md: `Chaque EOA possède un **nonce** : le nombre de transactions qu'il a **émises**. La première porte le nonce 0, la suivante 1, etc., **sans trou possible**.

- Le nonce indique l'**activité sortante** d'une adresse : 3 évoque une adresse jetable ; 250 000 un service ou un robot.
- Deux transactions concurrentes portant le **même nonce** traduisent un **remplacement** (accélération ou annulation) : une seule sera confirmée.
- L'adresse d'un contrat déployé de façon classique se calcule à partir de l'adresse du **déployeur** et de son nonce : on relie ainsi un faux jeton ou un contrat de drainer à l'EOA qui l'a créé, souvent celui de l'auteur.`,
      },
      { type: 'heading', text: 'Le gaz et la question du financement' },
      {
        type: 'text',
        md: `Toute opération consomme du **gaz**, payé dans la monnaie native de la chaîne (ETH sur Ethereum, BNB sur BNB Smart Chain…). Un simple envoi d'ETH consomme **21 000** unités de gaz ; un transfert de jeton, plusieurs dizaines de milliers ; une interaction complexe (swap, bridge), bien plus.

Depuis la mise à jour EIP-1559 (2021), le prix par unité de gaz se compose d'un **frais de base** (fixé par le réseau et **brûlé**) et d'un **pourboire** au validateur. Exemple : 21 000 × (8 + 1 gwei) = 189 000 gwei = **0,000189 ETH**.

Conséquence capitale : **pour déplacer des USDT, il faut de l'ETH**. Une adresse qui reçoit des jetons volés doit être **approvisionnée en gaz**. Par qui ?`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim' },
          { id: 'a', label: '0x7a3f…c41e', kind: 'suspect', sub: 'Reçoit 18 000 USDT, 0 ETH' },
          { id: 'f', label: '0x2b90…e7d4', kind: 'wallet', sub: 'Envoie 0,004 ETH' },
          { id: 'x', label: 'Binova', kind: 'exchange', sub: 'Retrait d\'ETH vers 0x2b90…' },
          { id: 'n', label: 'Adresse suivante', kind: 'unknown' },
        ],
        edges: [
          { from: 'v', to: 'a', label: '18 000 USDT' },
          { from: 'x', to: 'f', label: '0,05 ETH (retrait)' },
          { from: 'f', to: 'a', label: '0,004 ETH (gaz)' },
          { from: 'a', to: 'n', label: '18 000 USDT' },
        ],
        caption: 'Qui a financé le gaz ? Ici, une adresse elle-même alimentée par un retrait Binova : une piste d\'identification par réquisition.',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : le « first funder »',
        md: `La question « **qui a envoyé le premier ETH à cette adresse ?** » est l'un des pivots les plus productifs de l'analyse EVM :

- l'auteur lui-même depuis une autre de ses adresses → **lien fort** entre les deux ;
- un **exchange** (retrait d'ETH) → identification possible par réquisition, avec le hash du retrait ;
- un échangeur instantané, un service de « gas station », un pont → piste à creuser.

Le comportement de gaz (pourboire fixé manuellement, limite de gaz inhabituelle) forme aussi une empreinte qui peut relier des adresses d'un même opérateur.`,
      },
      { type: 'heading', text: 'Lire une transaction EVM à trois niveaux' },
      {
        type: 'steps',
        items: [
          { title: 'La transaction', md: '`from` (un EOA), `to` (EOA ou contrat), `value` (ETH natif transféré), données d\'appel (*input data* : quelle fonction du contrat est appelée), statut (succès/échec), frais.' },
          { title: 'Les transactions internes', md: 'Mouvements d\'ETH effectués **par un contrat** pendant l\'exécution (un pool de confidentialité qui verse l\'ETH au destinataire, un bridge qui libère des fonds). Ce ne sont pas des transactions distinctes : elles apparaissent dans un onglet dédié (*Internal Txns*).' },
          { title: 'Les événements (logs)', md: 'Messages émis par les contrats. Les **transferts de jetons** (événement `Transfer`) figurent ici, pas dans `value`. Une transaction peut en contenir des dizaines.' },
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Piège : value = 0',
        md: `Une transaction de \`value\` = 0 vers le contrat USDT n'est pas « vide » : c'est un transfert de jetons dont le montant et le destinataire réel figurent dans les données d'appel et dans l'événement \`Transfer\`. La leçon « Jetons ERC-20 » détaille cette lecture.`,
      },
      {
        type: 'text',
        md: `**Portefeuilles intelligents.** Une multisignature (type Safe) est un contrat : les fonds partent du contrat lorsque les signataires ont approuvé. Avec l'**abstraction de compte** (ERC-4337), l'opération de l'utilisateur est soumise par un intermédiaire appelé **bundler** : le \`from\` visible de la transaction est le bundler, pas l'utilisateur, dont l'opération figure dans les événements (\`UserOperationEvent\`). Depuis la mise à jour Pectra (2025, EIP-7702), un EOA peut aussi **déléguer** son fonctionnement à un code de contrat, mécanisme que certains drainers détournent.`,
      },
      {
        type: 'case',
        title: 'Cas : le faux service de récupération',
        md: `Mme P., déjà victime d'une escroquerie, paie **2,1 ETH** de « frais de dossier » à un prétendu cabinet de récupération, vers \`0x7a3f…c41e\`.

- **Page de l'adresse** : nonce = 4 (adresse peu utilisée), première activité dix jours avant les faits.
- **First funder** : 0,01 ETH reçus depuis \`0x2b90…e7d4\`, elle-même alimentée par un **retrait Binova**.
- **Sorties** : 2,099 ETH envoyés vers \`0xd41c…88a0\` deux heures plus tard ; cette adresse reçoit ensuite 0,0011 ETH de « gas top-up » depuis une adresse étiquetée hot wallet Binova, puis transfère tout vers ce hot wallet : signature d'une **adresse de dépôt Binova**.
- **Autres chaînes** : \`0x7a3f…c41e\` est aussi active sur BNB Smart Chain, où elle a reçu des BNB de trois autres victimes.

Deux réquisitions à Binova (le retrait vers le first funder ; le compte titulaire de l'adresse de dépôt) et un rapprochement de procédures.`,
      },
      {
        type: 'check',
        q: 'Une adresse a un nonce de 2. Qu\'en déduire ?',
        options: ['Elle a reçu 2 transactions', 'Elle a émis 2 transactions', 'Elle détient 2 ETH', 'C\'est un contrat'],
        answer: 1,
        explain: 'Le nonce compte les transactions émises par l\'EOA (nonces 0 et 1 utilisés : deux transactions).',
      },
      {
        type: 'table',
        headers: ['Erreur fréquente', 'Correction'],
        rows: [
          ['Chercher un « rendu » sur Ethereum', 'Il n\'existe pas : le solde restant reste sur l\'adresse'],
          ['Ignorer les autres chaînes EVM', 'Vérifier la même adresse sur toutes les chaînes'],
          ['Lire uniquement le champ value', 'Consulter les transferts de jetons et les transactions internes'],
          ['Prendre un contrat pour une contrepartie humaine', 'Suivre les événements jusqu\'au destinataire réel'],
          ['Confondre le from d\'une opération ERC-4337 avec l\'auteur', 'Le from est le bundler ; lire l\'événement UserOperationEvent'],
        ],
      },
      {
        type: 'terms',
        items: [
          { term: 'EVM', def: 'Ethereum Virtual Machine : machine virtuelle qui exécute les contrats ; reprise par de nombreuses chaînes.' },
          { term: 'EOA', def: 'Compte externe contrôlé par une clé privée ; seul type de compte qui initie des transactions.' },
          { term: 'Nonce', def: 'Compteur des transactions émises par un EOA, sans trou.' },
          { term: 'Gaz', def: 'Unité de calcul consommée par une opération, payée en monnaie native.' },
          { term: 'Transaction interne', def: 'Mouvement d\'ETH effectué par un contrat au cours d\'une transaction.' },
          { term: 'Événement (log)', def: 'Message émis par un contrat ; contient notamment les transferts de jetons.' },
          { term: 'First funder', def: 'Adresse qui a fourni le premier apport en monnaie native (gaz) à une adresse.' },
          { term: 'Bundler', def: 'Intermédiaire qui soumet les opérations des comptes abstraits (ERC-4337).' },
        ],
      },
    ],
    keyPoints: [
      'Modèle à comptes : soldes par adresse, ni rendu ni entrées multiples.',
      'EOA (clé privée) vs contrat (code) ; seul un EOA initie une transaction.',
      'La même adresse 0x existe sur toutes les chaînes EVM : toujours vérifier les autres chaînes.',
      'Le nonce compte les transactions émises et relie un contrat à son déployeur.',
      'Le financement du gaz (first funder) est un pivot majeur.',
      'Jetons dans les événements, ETH versé par un contrat dans les transactions internes.',
    ],
    quiz: [
      {
        q: 'Pourquoi le financement en gaz d\'une adresse est-il un pivot important ?',
        options: [
          'Parce que le gaz est gratuit',
          'Parce que pour déplacer des jetons il faut de la monnaie native : la source de ce financement relie souvent l\'adresse à son contrôleur ou à un exchange',
          'Parce que le gaz révèle l\'adresse IP',
          'Ce n\'est pas un pivot',
        ],
        answer: 1,
        explain: 'L\'ETH (ou BNB, POL…) nécessaire au gaz doit venir de quelque part : l\'auteur, un exchange ou un service.',
      },
      {
        q: 'Où voit-on l\'ETH versé par un contrat (par exemple un retrait de pool de confidentialité) à un destinataire ?',
        options: ['Dans le champ value de la transaction', 'Dans les transactions internes', 'Dans le nonce', 'Nulle part'],
        answer: 1,
        explain: 'Les mouvements d\'ETH initiés par un contrat sont des transactions internes, visibles dans l\'onglet dédié.',
      },
      {
        kind: 'truefalse',
        q: '« 0xAB12… » et « 0xab12… » (mêmes caractères, casse différente) désignent deux adresses différentes.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La casse mixte (EIP-55) n\'est qu\'une somme de contrôle : c\'est la même adresse.',
      },
      {
        kind: 'multi',
        q: 'Quelles affirmations sur les contrats sont exactes ? (plusieurs réponses)',
        options: [
          'Un contrat n\'a pas de clé privée',
          'Un contrat ne peut pas initier lui-même une transaction',
          'L\'adresse d\'un contrat déployé classiquement dépend du déployeur et de son nonce',
          'Un contrat est toujours contrôlé par un exchange',
        ],
        answer: [0, 1, 2],
        explain: 'Les contrats agissent quand on les appelle ; leur déployeur est une cible d\'enquête. Ils n\'ont aucun lien obligatoire avec un exchange.',
      },
      {
        q: 'Combien d\'unités de gaz consomme un simple envoi d\'ETH entre deux EOA ?',
        options: ['1', '21 000', '65 000', '1 000 000'],
        answer: 1,
        explain: '21 000 unités de gaz : valeur fixe, utile pour reconnaître un transfert natif simple.',
      },
      {
        q: 'Une transaction ERC-4337 affiche un « from » qui envoie des milliers de transactions par jour pour des utilisateurs différents. De quoi s\'agit-il ?',
        options: ['De l\'auteur', 'D\'un bundler, qui soumet les opérations d\'autres comptes', 'D\'un exchange', 'D\'un mineur'],
        answer: 1,
        explain: 'Le bundler n\'est qu\'un intermédiaire technique ; l\'utilisateur réel figure dans l\'événement UserOperationEvent.',
      },
      {
        q: 'Avec EIP-1559, que devient le frais de base payé pour le gaz ?',
        options: ['Il est versé au validateur', 'Il est brûlé (détruit)', 'Il est remboursé', 'Il est versé à la fondation Ethereum'],
        answer: 1,
        explain: 'Le frais de base est brûlé ; seul le pourboire (priority fee) revient au validateur.',
      },
    ],
    flashcards: [
      { front: 'Modèle à comptes', back: 'Soldes par adresse ; débit/crédit ; pas de rendu.' },
      { front: 'EOA', back: 'Externally Owned Account : compte contrôlé par une clé privée, seul à initier des transactions.' },
      { front: 'Format d\'une adresse EVM', back: '0x + 40 caractères hexadécimaux ; casse = somme de contrôle (EIP-55).' },
      { front: 'Nonce', back: 'Nombre de transactions émises par un EOA (0, 1, 2… sans trou).' },
      { front: 'Gaz d\'un envoi d\'ETH simple', back: '21 000 unités.' },
      { front: 'EIP-1559', back: 'Frais de base brûlé + pourboire au validateur.' },
      { front: 'First funder', back: 'Qui a envoyé le premier ETH (gaz) à une adresse : pivot majeur.' },
      { front: 'Transactions internes', back: 'Mouvements d\'ETH effectués par un contrat pendant une transaction.' },
      { front: 'Événements (logs)', back: 'Messages des contrats ; contiennent les transferts de jetons.' },
      { front: 'Adresse 0x inactive sur Ethereum', back: 'Vérifier BNB Smart Chain, Polygon, Arbitrum, Base, etc.' },
      { front: 'Chain ID 56', back: 'BNB Smart Chain (1 = Ethereum, 137 = Polygon).' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // tokens-erc20
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'tokens-erc20',
    title: 'Jetons ERC-20, approvals et événements',
    level: 1,
    track: 'comptes',
    minutes: 25,
    summary:
      "Comment fonctionnent les jetons (USDT, USDC…) sur les chaînes EVM et Tron : un contrat qui tient un registre, des événements Transfer, mint et burn, des autorisations (approve, permit) détournées par les drainers, des faux jetons qui émettent de faux événements.",
    objectives: [
      'Vous saurez expliquer pourquoi un jeton ne « voyage » pas : seul le registre de son contrat change.',
      'Vous saurez lire un transfert de jeton : champ to, données d\'appel, événement Transfer, décimales.',
      'Vous saurez reconnaître un mint, un burn, une autorisation et un transferFrom.',
      'Vous saurez vérifier qu\'un jeton est authentique à partir de l\'adresse de son contrat.',
    ],
    prerequisites: ['comptes-evm', 'unites-ordres'],
    practice: ['eth-first', 'dex-swap'],
    blocks: [
      {
        type: 'text',
        md: `Un jeton ERC-20 (standard d'Ethereum ; on dit **TRC-20** sur Tron et **BEP-20** sur BNB Smart Chain, mais c'est le même modèle) est un **contrat** qui tient une table « adresse → solde ». Les jetons ne se déplacent pas réellement : quand Alice envoie 100 USDT à Bob, le contrat USDT diminue la ligne d'Alice et augmente celle de Bob.

C'est pourquoi un même portefeuille peut afficher un solde de 0 ETH et 50 000 USDT : ce sont deux registres différents.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Analogie : le registre du club',
        md: `Imaginez un club qui tient un cahier des « points » de ses membres. Les points n'existent que dans ce cahier. Pour transférer des points, on demande au secrétaire (le contrat) de modifier deux lignes, et il affiche une annonce au tableau (l'**événement**). L'adresse du club est essentielle : un autre club peut appeler ses points « USDT » lui aussi.`,
      },
      { type: 'heading', text: 'Les fonctions d\'un jeton' },
      {
        type: 'table',
        headers: ['Fonction', 'Sélecteur', 'Rôle', 'Ce que l\'enquêteur en retient'],
        rows: [
          ['transfer(to, montant)', '`0xa9059cbb`', 'Le détenteur envoie ses jetons', 'Envoi direct : la victime ou l\'auteur a signé'],
          ['approve(spender, montant)', '`0x095ea7b3`', 'Autorise un tiers à dépenser', 'Prélude possible à un vol par drainer'],
          ['transferFrom(from, to, montant)', '`0x23b872dd`', 'Le tiers autorisé déplace les jetons', 'La transaction est émise par le tiers, pas par le détenteur'],
          ['balanceOf, allowance, decimals', '—', 'Lectures (sans transaction)', 'decimals : indispensable pour convertir'],
        ],
        caption: 'Le sélecteur (4 premiers octets des données d\'appel) identifie la fonction appelée.',
      },
      {
        type: 'text',
        md: `Chaque mouvement émet un **événement** \`Transfer(from, to, value)\`, identifié par une signature fixe (« topic 0 ») commençant par \`0xddf252ad…\`. C'est cet événement que les explorateurs affichent dans l'onglet des transferts de jetons et que les outils d'analyse suivent. Une autorisation émet de même un événement \`Approval\`.

Deux cas particuliers, par convention :

- **mint** (création de jetons) : \`Transfer\` **depuis** l'adresse nulle \`0x0000…0000\` ;
- **burn** (destruction) : \`Transfer\` **vers** l'adresse nulle (ou fonction dédiée).`,
      },
      { type: 'heading', text: 'Lire un transfert de jeton' },
      {
        type: 'steps',
        items: [
          { title: 'Le champ to de la transaction', md: 'C\'est l\'adresse du **contrat du jeton**, pas le bénéficiaire. `value` vaut 0 (aucun ETH n\'est envoyé).' },
          { title: 'Les données d\'appel', md: 'Elles commencent par le sélecteur `0xa9059cbb` (transfer), suivi de l\'adresse bénéficiaire et du montant brut, en hexadécimal.' },
          { title: 'L\'événement Transfer', md: 'Il confirme expéditeur, bénéficiaire et montant brut. C\'est la référence.' },
          { title: 'Les décimales', md: 'Montant réel = montant brut / 10^decimals. USDT et USDC : 6 décimales sur Ethereum et Tron ; la plupart des jetons : 18.' },
          { title: 'L\'authenticité du contrat', md: 'Vérifiez que le contrat émetteur de l\'événement est bien celui du jeton officiel.' },
        ],
      },
      {
        type: 'widget',
        id: 'unit-converter',
        caption: 'Appliquez les décimales d\'un jeton à un montant brut lu dans un événement.',
      },
      {
        type: 'check',
        q: 'Dans un transfert USDT standard, que contient le champ « to » de la transaction ?',
        options: ['L\'adresse du bénéficiaire', 'L\'adresse du contrat USDT', 'L\'adresse nulle', 'Le hot wallet de l\'émetteur'],
        answer: 1,
        explain: 'On appelle le contrat du jeton ; le bénéficiaire figure dans les données d\'appel et dans l\'événement Transfer.',
      },
      {
        type: 'text',
        md: `Une transaction peut contenir **plusieurs** événements \`Transfer\` : un swap sur un DEX (jeton A part vers le pool, jeton B revient), une distribution groupée, des frais de protocole. Lisez-les **tous, dans l'ordre** : ils racontent le cheminement réel de la valeur à l'intérieur de la transaction.`,
      },
      { type: 'heading', text: 'Approvals, permit et drainers' },
      {
        type: 'text',
        md: `L'autorisation (\`approve\`) est indispensable à la finance décentralisée : pour qu'un DEX prenne vos jetons, vous l'autorisez d'abord à le faire. Beaucoup d'interfaces demandent une **autorisation illimitée** (le montant maximal, 2^256 − 1). Tant qu'elle n'est pas révoquée, l'adresse autorisée peut vider le solde de ce jeton **à tout moment**.

Il existe aussi des autorisations par **signature hors chaîne** : \`permit\` (EIP-2612) ou Permit2. La victime signe un simple message, gratuit, qui n'apparaît pas immédiatement sur la blockchain ; l'attaquant le soumet ensuite lui-même.`,
      },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'Connecte son portefeuille' },
          { id: 'site', label: 'Faux site d\'airdrop', kind: 'service', sub: 'Demande une signature' },
          { id: 'c', label: 'Contrat USDC', kind: 'contract', sub: 'Enregistre l\'autorisation' },
          { id: 'a', label: 'Drainer', kind: 'suspect', sub: 'Appelle transferFrom' },
          { id: 'op', label: 'Opérateur du kit', kind: 'suspect', sub: '≈ 20 %' },
          { id: 'cl', label: 'Client de la campagne', kind: 'suspect', sub: '≈ 80 %' },
        ],
        edges: [
          { from: 'v', to: 'site', label: 'signe approve / permit' },
          { from: 'site', to: 'c', label: 'Approval', dashed: true },
          { from: 'a', to: 'c', label: 'transferFrom' },
          { from: 'c', to: 'op', label: '2 400 USDC' },
          { from: 'c', to: 'cl', label: '9 600 USDC' },
        ],
        caption: 'Schéma type d\'un drainer : la victime n\'émet aucun transfert ; l\'attaquant utilise l\'autorisation obtenue. Le partage immédiat trahit un modèle « as a service ».',
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : « je n\'ai rien envoyé ! »',
        md: `Une victime affirme de bonne foi n'avoir jamais envoyé ses jetons. Sur l'explorateur, la sortie apparaît bien depuis son adresse, mais la transaction a été **émise par une autre adresse** (le \`from\` n'est pas la victime) via \`transferFrom\`. Remontez alors à l'**autorisation** : événement \`Approval\` ou appel \`permit\`, sa date, et le site sur lequel la victime a connecté son portefeuille. Retenez deux dates : celle de la signature et celle du vol, parfois distantes de plusieurs jours. La leçon « Phishing, drainers et approvals » (niveau 3) approfondit.`,
      },
      {
        type: 'check',
        q: 'Une victime affirme n\'avoir jamais envoyé ses USDC, et pourtant ils ont quitté son adresse via transferFrom. Explication la plus probable ?',
        options: [
          'Un bug de la blockchain',
          'Elle a signé auparavant une autorisation (approve ou permit) au profit de l\'attaquant',
          'Une erreur de l\'explorateur',
          'Un remplacement RBF',
        ],
        answer: 1,
        explain: 'transferFrom suppose une autorisation préalable : c\'est le mode opératoire des drainers.',
      },
      { type: 'heading', text: 'Faux jetons et événements trompeurs' },
      {
        type: 'text',
        md: `N'importe qui peut déployer un contrat nommé « USDT » ou « Tether USD », avec le même logo. **Seule l'adresse du contrat fait foi.** Adresses officielles à vérifier sur les sites des émetteurs :

- USDT sur Ethereum : \`0xdAC17F958D2ee523a2206206994597C13D831ec7\`
- USDC sur Ethereum : \`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\`
- USDT sur Tron : \`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\`

Un contrat malveillant peut émettre des événements \`Transfer\` **arbitraires**, y compris « depuis » une adresse qui n'a jamais rien envoyé. C'est la base de l'**address poisoning** et du spam de jetons. Un événement n'est fiable que s'il émane du contrat légitime.`,
      },
      {
        type: 'table',
        headers: ['Piège', 'Symptôme', 'Vérification'],
        rows: [
          ['Faux jeton homonyme', '« USDT » reçu sans valeur réelle', 'Adresse du contrat'],
          ['Faux événement', 'Transfert apparent depuis une adresse connue de la victime', 'Contrat émetteur de l\'événement ; transaction réelle émise par qui ?'],
          ['Jeton à taxe de transfert', 'Montant reçu inférieur au montant envoyé', 'Plusieurs événements Transfer dans la transaction'],
          ['Honeypot', 'Jeton impossible à revendre', 'Code du contrat, historique des ventes'],
          ['Spam d\'hameçonnage', 'Jeton reçu dont le nom contient une URL', 'Ne jamais visiter l\'URL ; signaler'],
        ],
      },
      {
        type: 'case',
        title: 'Cas : 1 000 000 « USDT » tombés du ciel',
        md: `Un commerçant signale avoir reçu **1 000 000 USDT** sur son adresse Ethereum, puis un message lui demandant de « restituer l'erreur » en renvoyant 50 000 USDC.

Vérification : l'événement \`Transfer\` a été émis par le contrat \`0x4f1e…b09c\`, déployé trois jours plus tôt par une adresse au nonce de 2, et non par \`0xdAC17F…1ec7\`. Le jeton n'a aucune valeur ni marché. C'est une tentative d'escroquerie : rien n'a été reçu de réel. Le déployeur du faux contrat et l'adresse de restitution demandée deviennent les cibles de l'analyse.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Et les NFT ?',
        md: `Les **NFT** (jetons non fongibles, standards ERC-721 et ERC-1155) reposent sur le même principe : un contrat qui tient un registre, des événements \`Transfer\`. Différence : chaque jeton est unique et porte un identifiant. Ils apparaissent dans des affaires d'escroquerie, de blanchiment par transactions fictives (*wash trading*) et de vol par drainer.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'ERC-20 / TRC-20 / BEP-20', def: 'Standard de jeton fongible sur Ethereum / Tron / BNB Smart Chain.' },
          { term: 'Événement Transfer', def: 'Log émis à chaque mouvement de jeton : from, to, montant brut.' },
          { term: 'Mint / burn', def: 'Création (depuis l\'adresse nulle) / destruction (vers l\'adresse nulle) de jetons.' },
          { term: 'Approve / allowance', def: 'Autorisation donnée à un tiers / montant qu\'il peut encore dépenser.' },
          { term: 'transferFrom', def: 'Transfert effectué par le tiers autorisé, au départ de l\'adresse du détenteur.' },
          { term: 'Permit / Permit2', def: 'Autorisation par signature hors chaîne, soumise ensuite par le bénéficiaire.' },
          { term: 'Sélecteur', def: '4 premiers octets des données d\'appel : identifie la fonction appelée.' },
        ],
      },
    ],
    keyPoints: [
      'Un jeton est un registre tenu par un contrat ; chaque mouvement émet un événement Transfer.',
      'Dans un transfert, le champ to de la transaction est le contrat du jeton, pas le bénéficiaire.',
      'Mint = Transfer depuis l\'adresse nulle ; burn = vers l\'adresse nulle.',
      'Montant réel = brut / 10^decimals (USDT et USDC : 6 sur Ethereum et Tron).',
      'Les drainers exploitent approve, permit et Permit2 : la victime n\'émet pas le transfert, l\'attaquant appelle transferFrom.',
      'Seule l\'adresse du contrat identifie un jeton ; les faux jetons peuvent émettre de faux événements.',
    ],
    quiz: [
      {
        q: 'Un événement Transfer montre 1 000 000 « USDT » reçus. Que vérifier en premier ?',
        options: [
          'Le prix de l\'USDT',
          'L\'adresse du contrat émetteur de l\'événement (jeton officiel ou faux)',
          'Le nonce du destinataire',
          'Le prix du gaz',
        ],
        answer: 1,
        explain: 'N\'importe qui peut créer un jeton nommé USDT et émettre de faux événements ; seule l\'adresse du contrat fait foi.',
      },
      {
        q: 'Que signifie un événement Transfer dont le « from » est l\'adresse 0x000…000 ?',
        options: ['Un vol', 'Une création (mint) de jetons', 'Une destruction (burn)', 'Un gel'],
        answer: 1,
        explain: 'Le mint est conventionnellement représenté par un transfert depuis l\'adresse nulle.',
      },
      {
        q: 'Les données d\'appel d\'une transaction vers le contrat USDT commencent par 0x095ea7b3. Quelle fonction est appelée ?',
        options: ['transfer', 'approve', 'transferFrom', 'balanceOf'],
        answer: 1,
        explain: '0x095ea7b3 est le sélecteur d\'approve : la transaction accorde une autorisation, elle ne déplace pas de jetons.',
      },
      {
        kind: 'truefalse',
        q: 'Une signature permit (EIP-2612) apparaît immédiatement sur la blockchain au moment où la victime la signe.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'C\'est une signature hors chaîne : elle n\'apparaît que lorsque le bénéficiaire la soumet, souvent dans la même transaction que le vol.',
      },
      {
        kind: 'multi',
        q: 'Dans un vol par drainer via transferFrom, que voit-on sur la blockchain ? (plusieurs réponses)',
        options: [
          'Une autorisation antérieure (Approval ou permit) au profit de l\'attaquant',
          'Une transaction dont le from est l\'attaquant (ou son contrat), pas la victime',
          'Un événement Transfer depuis l\'adresse de la victime',
          'Une transaction de transfert signée par la victime',
        ],
        answer: [0, 1, 2],
        explain: 'La victime n\'a signé que l\'autorisation ; le transfert est émis par l\'attaquant, mais l\'événement montre bien les jetons quittant l\'adresse de la victime.',
      },
      {
        q: 'Un transfert d\'un jeton à 18 décimales indique un montant brut de 2500000000000000000. Quel est le montant réel ?',
        options: ['2 500 000 000 000 000 000', '2,5', '2 500', '0,0025'],
        answer: 1,
        explain: '2,5 × 10^18 / 10^18 = 2,5 jetons.',
      },
      {
        q: 'Une victime envoie 1 000 jetons et le destinataire n\'en reçoit que 950 ; la transaction contient deux événements Transfer. Explication probable ?',
        options: [
          'Une erreur de l\'explorateur',
          'Un jeton à taxe de transfert : 50 jetons sont partis vers une autre adresse (frais du contrat)',
          'Un rendu',
          'Un gel partiel',
        ],
        answer: 1,
        explain: 'Le second événement révèle la ponction. Toujours lire tous les événements d\'une transaction.',
      },
    ],
    flashcards: [
      { front: 'Un jeton ERC-20, c\'est…', back: 'Un contrat qui tient un registre adresse → solde.' },
      { front: 'Topic 0 de l\'événement Transfer', back: '0xddf252ad… (signature de Transfer(address,address,uint256)).' },
      { front: 'Sélecteur de transfer', back: '0xa9059cbb.' },
      { front: 'Sélecteur d\'approve', back: '0x095ea7b3.' },
      { front: 'Sélecteur de transferFrom', back: '0x23b872dd.' },
      { front: 'Mint', back: 'Transfer depuis l\'adresse nulle.' },
      { front: 'Burn', back: 'Transfer vers l\'adresse nulle.' },
      { front: 'Contrat USDT sur Ethereum', back: '0xdAC17F958D2ee523a2206206994597C13D831ec7.' },
      { front: 'Contrat USDT sur Tron', back: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t.' },
      { front: 'Permit', back: 'Autorisation par signature hors chaîne (EIP-2612), soumise plus tard par le bénéficiaire.' },
      { front: 'Victime « qui n\'a rien envoyé »', back: 'Chercher un transferFrom et l\'autorisation antérieure (Approval / permit).' },
    ],
  },
]
