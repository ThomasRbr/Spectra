// Niveau 3 — Cardano : le modèle eUTXO (jetons natifs, datums, scripts
// Plutus), les adresses CIP-19, la clé de staking comme heuristique de
// regroupement sans transaction et ses limites, les ordres de DEX lus dans les
// datums, les frais linéaires et les explorateurs.
import type { Lesson } from '../model'

export const LESSON_CARDANO_EUTXO: Lesson = {
  id: 'cardano-eutxo',
  title: 'Cardano et le modèle eUTXO : clés de staking et datums',
  level: 3,
  track: 'bitcoin',
  minutes: 40,
  summary: `Cardano reprend le modèle UTXO de Bitcoin et l'étend : chaque sortie peut porter des jetons natifs, une donnée (datum) lue par un script Plutus, voire un script de référence. Ses adresses de base ont une particularité précieuse pour l'enquêteur : elles se terminent par la clé de staking du portefeuille, commune à toutes ses adresses. Regrouper des adresses devient possible sans aucune transaction, à condition d'en connaître les limites (changement de compte, adresses enterprise d'exchanges, adresses « Frankenstein »). Les datums, eux, révèlent souvent à qui reviennent des fonds déposés dans un contrat, par exemple l'auteur d'un ordre sur un DEX.`,
  objectives: [
    `Décrire le modèle eUTXO : sorties porteuses d'ADA, de jetons natifs, de datums ; scripts natifs et validateurs Plutus ; redeemer.`,
    `Reconnaître les types d'adresses CIP-19 (addr1q, addr1z, addr1v, addr1w, stake1u, stake17, adresses Byron) et ce que chacune révèle.`,
    `Regrouper des adresses par leur partie staking, en lisant la fin de l'adresse ou l'adresse de récompense, sans attendre une dépense commune.`,
    `Énoncer les limites de cette heuristique : changement de clé de staking, comptes multiples, exchanges, délégation à un pool, adresses Frankenstein.`,
    `Lire le datum d'un ordre de DEX (type Minswap) pour identifier le propriétaire et le bénéficiaire, malgré l'exécution par un batcher.`,
    `Calculer des frais Cardano (formule linéaire) et exploiter les explorateurs (Cardanoscan, Cexplorer) et les « handles ».`,
  ],
  prerequisites: ['utxo', 'clustering'],
  practice: ['cardano-staking'],
  blocks: [
    {
      type: 'text',
      md: `Un retraité a versé 48 000 ADA à une prétendue « pool de staking garantie à 18 % par an ». L'escroc ne lui a donné qu'une adresse, \`addr1q8…k2v4x\`, et a coupé tout contact. Sur Bitcoin, l'analyste commencerait par attendre une dépense, puis chercherait des entrées communes pour élargir le cluster.

Sur Cardano, il regarde d'abord **la fin de l'adresse**. Les adresses de base encodent deux identifiants : celui qui contrôle la dépense, et celui qui contrôle le **staking**. Ce second identifiant est le même pour toutes les adresses d'un compte de portefeuille. En une requête dans un explorateur, l'adresse de l'escroc se révèle « sœur » de **14 autres adresses**, dont l'une a passé un ordre sur un DEX et une autre a reçu des fonds d'une adresse de retrait d'un exchange. Aucune de ces adresses n'avait jamais dépensé avec celle de la victime.`,
    },
    { type: 'heading', text: 'Le modèle eUTXO : des UTXO qui portent plus que de la valeur' },
    {
      type: 'compare',
      left: {
        title: 'UTXO Bitcoin',
        md: `- Une sortie = un montant en satoshis + un script de verrouillage.
- Scripts volontairement limités (signatures, multisig, délais).
- Aucun état : les « jetons » (Ordinals, Runes) sont des conventions lues par des indexeurs.
- Frais au taux du marché (sat/vB), selon la congestion.`,
      },
      right: {
        title: 'eUTXO Cardano',
        md: `- Une sortie = une adresse + une **valeur multi-actifs** (lovelaces + jetons natifs) + un **datum** facultatif (+ un script de référence facultatif).
- Les adresses de **script** sont gardées par des scripts natifs ou des **validateurs Plutus** qui lisent le datum, le **redeemer** fourni à la dépense et le contexte de la transaction.
- Les jetons sont **natifs** au registre : aucun contrat de jeton à interroger.
- Frais **linéaires** fixés par les paramètres du protocole.`,
      },
    },
    {
      type: 'terms',
      items: [
        { term: 'Lovelace', def: `Plus petite unité : 1 ADA = 1 000 000 lovelaces.` },
        { term: 'Jeton natif', def: `Actif identifié par un policy ID (hash de 28 octets du script de frappe) et un nom d'actif. Il circule dans les sorties comme l'ADA, sans contrat de jeton.` },
        { term: 'Min-ADA', def: `Chaque sortie doit contenir un minimum d'ADA, croissant avec sa taille (jetons, datum) : environ 1 ADA pour une sortie simple. D'où les petites quantités d'ADA qui accompagnent les jetons.` },
        { term: 'Datum', def: `Donnée attachée à une sortie envoyée à une adresse de script : propriétaire, adresse de retour, paramètres d'un ordre. Il peut être stocké en entier (« inline », depuis la mise à jour Vasil de septembre 2022) ou sous forme de hash.` },
        { term: 'Redeemer', def: `Argument fourni lors de la dépense d'une sortie de script (par exemple « exécuter » ou « annuler »).` },
        { term: 'Validateur Plutus', def: `Programme qui décide si une sortie de script peut être dépensée, au vu du datum, du redeemer et de la transaction. Disponible depuis la mise à jour Alonzo (septembre 2021).` },
        { term: 'Script natif', def: `Script simple (signatures requises, multisig, bornes de temps), utilisé notamment pour les politiques de frappe.` },
        { term: 'Collatéral', def: `ADA engagés par une transaction qui exécute un script Plutus, perdus seulement si le script échoue à la validation.` },
      ],
    },
    { type: 'heading', text: 'Les adresses Cardano (CIP-19)' },
    {
      type: 'text',
      md: `Une adresse Shelley est une suite d'octets encodée en **bech32** : un **octet d'en-tête** (type d'adresse et réseau), puis un ou deux **identifiants** (« credentials ») de 28 octets, chacun étant le hash d'une clé ou d'un script.

- l'identifiant de **paiement** décide qui peut dépenser ;
- l'identifiant de **staking** décide qui délègue cette valeur à une pool et qui touche les récompenses.

Le premier caractère après \`addr1\` dépend de l'en-tête, donc du type : c'est ce qui donne les préfixes ci-dessous. La **somme de contrôle** occupe les **6 derniers caractères**.`,
    },
    {
      type: 'table',
      caption: 'Types d’adresses du réseau principal (CIP-19). Les longueurs sont celles des adresses bech32 complètes.',
      headers: ['Préfixe', 'Type', 'Paiement', 'Staking', 'Usage typique'],
      rows: [
        ['addr1q…', 'Base (type 0)', 'Clé', 'Clé', 'Portefeuilles de particuliers (103 caractères)'],
        ['addr1z…', 'Base (type 1)', 'Script', 'Clé', 'Contrats dont la valeur reste déléguée par l’utilisateur (ordres de DEX, coffres)'],
        ['addr1y… / addr1x…', 'Base (types 2 et 3)', 'Clé / script', 'Script', 'Plus rares (staking géré par script)'],
        ['addr1v…', 'Enterprise (type 6)', 'Clé', 'Aucun', 'Portefeuilles chauds d’exchanges, services (58 caractères)'],
        ['addr1w…', 'Enterprise script (type 7)', 'Script', 'Aucun', 'Contrats sans délégation'],
        ['stake1u…', 'Récompense (type 14)', '—', 'Clé', 'Identifiant de la clé de staking (59 caractères)'],
        ['stake17…', 'Récompense (type 15)', '—', 'Script', 'Staking contrôlé par un script'],
        ['Ae2… / DdzFF…', 'Byron (héritées)', 'Clé', 'Aucun', 'Portefeuilles d’avant 2020 (Yoroi/Icarus, Daedalus)'],
      ],
    },
    {
      type: 'widget',
      id: 'address-anatomy',
      caption: `Reconnaître une adresse Cardano parmi d'autres chaînes : addr1 (paiement) et stake1 (récompense) sont propres à Cardano ; la lettre suivante indique le type.`,
    },
    { type: 'heading', text: 'La clé de staking : regrouper sans transaction' },
    {
      type: 'text',
      md: `Les portefeuilles Cardano (Daedalus, Yoroi, Eternl, Lace…) dérivent leurs clés selon **CIP-1852** : \`m/1852'/1815'/compte'/rôle/index\`. Le rôle 0 donne les adresses de **réception**, le rôle 1 les adresses de **rendu**, et le rôle 2 la **clé de staking**, presque toujours unique (index 0) pour tout le compte.

Conséquence : **toutes les adresses de base d'un compte**, réception comme rendu, partagent le **même identifiant de staking**, encodé dans leur seconde moitié. Visuellement, deux adresses sœurs ont un long segment final identique, juste avant les 6 caractères de somme de contrôle (qui, eux, diffèrent). Plus rigoureusement, l'explorateur ou l'outil calcule l'**adresse de récompense** \`stake1u…\` de chaque adresse : même \`stake1u\`, même compte.

C'est une heuristique **plus forte que les entrées communes** à deux titres : elle ne demande **aucune transaction** (une adresse qui n'a jamais dépensé est déjà rattachée), et elle relie aussi les adresses de **rendu**, ce qui rend la détection du rendu presque triviale : dans une transaction, la sortie dont la partie staking est celle des entrées revient à l'expéditeur.`,
    },
    {
      type: 'flow',
      caption: `Une clé de staking, toutes les adresses de base du compte. Les sorties vers une adresse de script peuvent elles aussi conserver la partie staking de l'utilisateur (addr1z…).`,
      nodes: [
        { id: 'sk', label: 'Clé de staking', kind: 'wallet', sub: 'stake1u…a8m2' },
        { id: 'r0', label: 'Réception /0/0', kind: 'wallet', sub: 'addr1q…a8m2…' },
        { id: 'r1', label: 'Réception /0/1', kind: 'wallet', sub: 'addr1q…a8m2…' },
        { id: 'c0', label: 'Rendu /1/0', kind: 'wallet', sub: 'addr1q…a8m2…' },
        { id: 'ord', label: 'Ordre de DEX', kind: 'contract', sub: 'addr1z… (script + staking)' },
        { id: 'pool', label: 'Pool de staking', kind: 'service', sub: 'délégation (ne détient rien)' },
      ],
      edges: [
        { from: 'sk', to: 'r0' },
        { from: 'sk', to: 'r1' },
        { from: 'sk', to: 'c0' },
        { from: 'sk', to: 'ord', dashed: true, label: 'partie staking' },
        { from: 'sk', to: 'pool', dashed: true, label: 'certificat de délégation' },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Dans Spectra : clé de staking et adresses sœurs',
      md: `Sélectionnez une adresse \`addr1q…\` : l'inspecteur affiche un encadré « Clé de staking » avec l'adresse \`stake1u…\`, le segment de fin d'adresse qui l'encode, et la liste des **autres adresses connues qui la partagent** (« même portefeuille »). L'analyse de clusters de Spectra regroupe automatiquement ces adresses : vérifiez dans l'onglet de cluster que le regroupement vient bien de la clé de staking, et non d'une dépense commune.`,
    },
    {
      type: 'check',
      q: `Deux adresses addr1q… n'ont jamais apparu dans une même transaction, mais leur adresse de récompense est la même stake1u…. Que pouvez-vous en conclure ?`,
      options: [
        `Rien, faute de dépense commune`,
        `Elles appartiennent très probablement au même compte de portefeuille, la partie staking étant dérivée de la même clé ; conclusion à confirmer au regard des limites connues`,
        `Elles appartiennent à la même pool de staking, donc à des personnes différentes`,
        `Ce sont des adresses d'exchange`,
      ],
      answer: 1,
      explain: `Le partage de la clé de staking est un lien structurel fort, visible sans transaction. Il reste une inférence : un tiers peut fabriquer une adresse combinant sa clé de paiement et la clé de staking d'un autre (adresse Frankenstein), et certains services partagent une clé de staking entre clients.`,
    },
    {
      type: 'table',
      caption: 'Entrées communes et clé de staking : deux heuristiques complémentaires',
      headers: ['Critère', 'Entrées communes (CIOH)', 'Clé de staking partagée'],
      rows: [
        ['Condition', 'Une dépense commune', 'Aucune : lecture de l’adresse'],
        ['Couvre les adresses jamais dépensées', 'Non', 'Oui'],
        ['Couvre les adresses de rendu', 'Seulement si elles redépensent ensemble', 'Oui, dès leur création'],
        ['Faux positifs typiques', 'CoinJoin, PayJoin, transactions multipartites', 'Adresses Frankenstein, clés de staking de services'],
        ['Faux négatifs typiques', 'Portefeuilles qui ne consolident jamais', 'Comptes multiples, changement de clé de staking, adresses enterprise'],
      ],
    },
    { type: 'heading', text: 'Les limites de l’heuristique' },
    {
      type: 'steps',
      items: [
        { title: 'Plusieurs comptes, plusieurs clés', md: `Chaque compte (\`compte'\` dans le chemin) a sa propre clé de staking. Un même individu peut donc avoir plusieurs groupes d'adresses sans lien structurel ; il faut alors revenir aux entrées communes, aux flux et à l'OSINT.` },
        { title: 'Changement de clé de staking', md: `Un utilisateur peut créer un nouveau portefeuille, ou désenregistrer sa clé de staking (le dépôt de 2 ADA lui est rendu) et en utiliser une autre. Le lien s'arrête là ; la transaction qui transfère les fonds de l'ancien groupe vers le nouveau, elle, reste visible.` },
        { title: 'Adresses enterprise', md: `Les adresses \`addr1v…\` n'ont pas de partie staking : rien à regrouper. Beaucoup d'exchanges y logent leurs portefeuilles chauds ; un mode « adresse unique » de certains portefeuilles réduit aussi la diversité des adresses.` },
        { title: 'Clés de staking de services', md: `Un exchange ou un service peut générer des adresses de dépôt qui portent **sa** clé de staking : le groupe obtenu est alors celui du **service**, pas d'un client. Un groupe de milliers d'adresses aux flux massifs doit faire penser à un service et non à un individu.` },
        { title: 'Délégation à une pool', md: `Déléguer à une pool ne déplace aucun fonds : la pool ne détient rien, et des milliers de délégants partagent la même pool. Jamais de regroupement par la pool. L'opérateur d'une pool reste toutefois un acteur identifiable (site, relais, métadonnées), utile quand l'escroquerie porte précisément sur une « pool ».` },
        { title: 'Adresses Frankenstein', md: `Rien n'empêche quelqu'un de construire une adresse avec **sa** clé de paiement et **la clé de staking d'un autre** : les fonds délèguent alors au profit de ce dernier, sans qu'il contrôle la dépense. C'est rare mais possible, et c'est la limite principale à exposer devant un tribunal : la clé de staking prouve un rattachement **structurel**, pas la maîtrise des fonds.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Formuler prudemment',
      md: `Dans un rapport : « les adresses A à O partagent l'identifiant de staking stake1u…a8m2, ce qui, selon la dérivation standard des portefeuilles Cardano (CIP-1852), indique qu'elles relèvent d'un même compte de portefeuille ; ce rattachement est corroboré par [flux, dépenses communes, retrait d'exchange] ». Une corroboration par les flux protège contre l'objection Frankenstein.`,
    },
    { type: 'heading', text: 'Datums : qui a passé l’ordre ?' },
    {
      type: 'text',
      md: `Sur un DEX à carnet d'ordres en eUTXO, du type **Minswap**, un utilisateur ne « parle » pas directement à la pool. Il dépose ses fonds sur une **adresse de script d'ordre**, accompagnés d'un **datum** qui décrit l'ordre. Des **batchers** (exécutants) ramassent ensuite plusieurs ordres et les exécutent ensemble contre la pool, dans une transaction qu'ils signent eux-mêmes. Vu de loin, les fonds de l'utilisateur semblent partir chez un tiers, puis revenir d'une transaction signée par un inconnu. Le datum dit tout.`,
    },
    {
      type: 'steps',
      items: [
        { title: '1. Dépôt de l’ordre', md: `L'utilisateur envoie, par exemple, 30 000 ADA vers l'adresse de script d'ordre (souvent en \`addr1z…\`, qui conserve sa partie staking). La sortie porte un datum : adresse du **propriétaire** (seule autorisée à annuler), adresse de **réception**, actif demandé, **minimum à recevoir**, frais du batcher et dépôt en ADA restitué.` },
        { title: '2. Exécution par un batcher', md: `Une transaction du batcher dépense plusieurs sorties d'ordre (redeemer « appliquer ») et la sortie de la pool, puis crée une sortie par ordre vers l'adresse de réception lue dans chaque datum. Ses entrées mêlent les fonds de plusieurs utilisateurs : **pas de clustering par entrées communes** ici.` },
        { title: '3. Réception', md: `Les jetons achetés arrivent à l'adresse de réception du datum, accompagnés du reste et du dépôt d'ADA. Si l'ordre est annulé, le propriétaire récupère sa sortie par une transaction qu'il signe.` },
      ],
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Lecture décodée d’un datum d’ordre (illustration simplifiée)',
      md: `\`{ "propriétaire": "addr1q8…k2v4x", "réception": "addr1q9…f7r1a", "étape": "échange exact en entrée", "actif demandé": "<policy ID>.SNEK", "minimum à recevoir": "41 870 000", "frais du batcher": "2 ADA", "dépôt": "2 ADA" }\`

Sur la chaîne, le datum est une donnée Plutus encodée en CBOR (constructeurs et champs) ; les explorateurs le décodent plus ou moins lisiblement. Ici, il révèle que l'adresse de l'escroc a passé l'ordre et que les jetons sont livrés à **une autre adresse**, \`addr1q9…f7r1a\` : nouvelle piste, dont on vérifiera immédiatement la partie staking. Les montants des frais et dépôts varient selon le DEX et sa version (à vérifier pour chaque protocole).`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Dans Spectra : la carte des datums',
      md: `Quand une transaction envoie des fonds à une adresse de script, l'inspecteur affiche le datum de la sortie, en clair. Les adresses de script sont étiquetées comme contrats « de séquestre ou d'ordre ». Réflexe : chercher dans le datum toute adresse (propriétaire, retour, bénéficiaire) et l'ajouter au graphe.`,
    },
    {
      type: 'check',
      q: `Les jetons d'un swap arrivent à une adresse depuis une transaction signée par un batcher inconnu. Comment relier ce swap à son auteur ?`,
      options: [
        `C'est impossible : le batcher a cassé la trace`,
        `En considérant que le batcher et le destinataire forment un même cluster`,
        `En remontant à la sortie d'ordre dépensée par le batcher et en lisant son datum, qui indique le propriétaire de l'ordre et l'adresse de réception`,
        `En demandant à la pool de staking`,
      ],
      answer: 2,
      explain: `Le batcher n'est qu'un exécutant. La sortie d'ordre qu'il consomme porte un datum décrivant le propriétaire et le bénéficiaire : c'est le lien entre le dépôt et la livraison.`,
    },
    { type: 'heading', text: 'Frais, explorateurs et identifiants lisibles' },
    {
      type: 'text',
      md: `**Frais linéaires.** Les frais minimaux suivent la formule \`a × taille + b\`, avec les paramètres actuels \`a = 44\` lovelaces par octet et \`b = 155 381\` lovelaces. Une transaction simple de 300 octets coûte donc 44 × 300 + 155 381 = **168 581 lovelaces, soit environ 0,17 ADA**. Une transaction qui exécute un script Plutus paie en plus ses **unités d'exécution** (mémoire et calcul). Il n'y a pas d'enchère sur les frais comme sur Bitcoin : le montant des frais renseigne peu sur l'urgence ou le logiciel, mais un écart avec la formule signale un script ou des métadonnées.

**Explorateurs.** Cardanoscan et Cexplorer affichent, pour une adresse, son adresse de récompense, toutes les adresses qui la partagent, la pool déléguée, l'historique des récompenses, les jetons et les datums. **Métadonnées** de transaction (champ libre, par exemple un message ou une référence de commande) et **handles** (\`$nom\`, des jetons natifs qui associent un nom lisible à une adresse) sont des sources d'OSINT à exploiter et à consigner.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — la « pool garantie à 18 % »',
      md: `Méthode suivie par l'analyste sur l'adresse \`addr1q8…k2v4x\` :

1. **Adresse de récompense** : \`stake1u…a8m2\`. L'explorateur liste 15 adresses de base partageant cette clé (l'adresse de la victime incluse), solde cumulé de 212 400 ADA, délégation à une pool sans lien apparent avec l'escroquerie.
2. **Corroboration par les flux** : 9 des 15 adresses ont dépensé ensemble au moins une fois avec une autre adresse sœur, et les rendus reviennent systématiquement sur des adresses de la même clé. Le regroupement n'est pas une construction Frankenstein.
3. **Datum d'ordre** : une adresse sœur a déposé 30 000 ADA sur le script d'ordre d'un DEX ; le datum désigne une adresse de réception \`addr1q9…f7r1a\` dont la clé de staking est **différente** : second compte du même auteur, ou complice. Les jetons y sont livrés puis revendus.
4. **Sortie vers un exchange** : 61 000 ADA partent d'une adresse sœur vers une adresse \`addr1v…\` qui, d'après les étiquettes de l'outil, sert d'adresse de dépôt à un exchange régulé.

Suites : réquisition à l'exchange (titulaire du compte, journaux de connexion, autres adresses de retrait), analyse de la clé de staking du second groupe, et vérification du handle \`$…\` détenu par l'une des adresses sœurs.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Erreur fréquente',
        md: `- Attendre une dépense commune avant de regrouper.
- Regrouper toutes les adresses déléguées à la même pool.
- Prendre le groupe d'une clé de staking de service pour un individu.
- Considérer la transaction d'un batcher comme une dépense commune.
- Ignorer les datums et les métadonnées.`,
      },
      right: {
        title: 'Bonne pratique',
        md: `- Lire l'adresse de récompense de chaque adresse dès le départ.
- Ne jamais regrouper par pool ; regrouper par stake1u.
- Qualifier la taille et le comportement du groupe (individu ou service).
- Lire le datum de chaque sortie d'ordre consommée.
- Corroborer le regroupement par les flux et consigner les limites.`,
      },
    },
  ],
  keyPoints: [
    `eUTXO : une sortie porte des ADA, des jetons natifs (policy ID + nom), un datum facultatif ; les adresses de script sont gardées par des scripts natifs ou des validateurs Plutus.`,
    `CIP-19 : addr1q (base clé/clé), addr1z (base script/clé), addr1v (enterprise, sans staking), addr1w (script enterprise), stake1u (récompense), adresses Byron Ae2… et DdzFF….`,
    `Toutes les adresses de base d'un compte (réception et rendu) partagent la clé de staking encodée dans leur seconde moitié : regroupement sans transaction, rendu presque trivial.`,
    `Limites : comptes multiples, changement de clé de staking, adresses enterprise, clés de staking de services, délégation à une pool (jamais un critère), adresses Frankenstein.`,
    `Le datum d'un ordre de DEX (type Minswap) révèle propriétaire et bénéficiaire ; la transaction du batcher est multipartite.`,
    `Frais minimaux = 44 × taille + 155 381 lovelaces (environ 0,17 ADA pour 300 octets), plus les unités d'exécution Plutus.`,
    `Cardanoscan, Cexplorer, métadonnées et handles ($nom) complètent l'analyse ; corroborer tout regroupement par les flux.`,
  ],
  quiz: [
    {
      q: `Que contient une sortie dans le modèle eUTXO de Cardano, en plus de l'adresse ?`,
      options: [
        `Uniquement un montant en ADA`,
        `Une valeur multi-actifs (lovelaces et jetons natifs), un datum facultatif et, éventuellement, un script de référence`,
        `Le solde complet du compte du destinataire`,
        `Le code source du contrat de jeton`,
      ],
      answer: 1,
      explain: `L'extension du modèle UTXO tient précisément à ces éléments : les jetons natifs circulent dans les sorties, et les données destinées aux scripts sont portées par les datums.`,
    },
    {
      q: `Quelle adresse ne permet aucun regroupement par clé de staking ?`,
      options: [`addr1q…`, `addr1z…`, `addr1v…`, `addr1y…`],
      answer: 2,
      explain: `addr1v… est une adresse enterprise : elle n'a pas de partie staking. Les autres adresses de base portent un identifiant de staking (clé ou script).`,
    },
    {
      kind: 'truefalse',
      q: `Deux adresses de base qui partagent la même adresse de récompense stake1u… peuvent être rattachées au même compte de portefeuille même si elles n'ont jamais apparu dans une même transaction.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `C'est l'intérêt majeur de cette heuristique : le lien est structurel, lisible dans l'adresse. Il reste à le corroborer et à en exposer les limites.`,
    },
    {
      q: `Dans une transaction Cardano ordinaire d'un portefeuille standard, comment repérer le rendu ?`,
      options: [
        `C'est toujours la plus petite sortie`,
        `C'est la sortie dont la partie staking est la même que celle des adresses d'entrée`,
        `C'est la sortie vers une adresse enterprise`,
        `Le rendu n'existe pas sur Cardano`,
      ],
      answer: 1,
      explain: `Les adresses de rendu (rôle 1 de CIP-1852) portent la clé de staking du compte : la sortie qui la partage avec les entrées revient à l'expéditeur.`,
    },
    {
      kind: 'multi',
      q: `Lesquelles de ces situations limitent ou faussent le regroupement par clé de staking ? (plusieurs réponses)`,
      options: [
        `Un utilisateur qui répartit ses fonds sur plusieurs comptes de portefeuille`,
        `Un exchange qui génère des adresses de dépôt portant sa propre clé de staking`,
        `Une adresse Frankenstein combinant la clé de paiement d'une personne et la clé de staking d'une autre`,
        `Le fait que deux adresses partagent la même clé de staking`,
      ],
      answer: [0, 1, 2],
      explain: `Comptes multiples (faux négatif), clé de staking de service (groupe qui n'est pas un individu) et adresse Frankenstein (faux positif) sont les limites classiques. Le partage de la clé est le critère lui-même.`,
    },
    {
      kind: 'truefalse',
      q: `Les adresses déléguées à la même pool de staking appartiennent au même propriétaire.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Des milliers de délégants indépendants choisissent la même pool, qui ne détient aucun de leurs fonds. La délégation n'est jamais un critère de regroupement.`,
    },
    {
      q: `Sur un DEX en eUTXO de type Minswap, quelle donnée relie un dépôt d'ordre à la livraison des jetons ?`,
      options: [
        `L'adresse du batcher`,
        `Le datum de la sortie d'ordre, qui indique le propriétaire et l'adresse de réception`,
        `Le nom de la pool de staking`,
        `Les frais de la transaction`,
      ],
      answer: 1,
      explain: `Le batcher exécute l'ordre en lisant le datum ; les jetons sont livrés à l'adresse de réception qui y figure, et seul le propriétaire indiqué peut annuler.`,
    },
    {
      q: `Combien coûte, au minimum, une transaction simple de 400 octets, avec a = 44 et b = 155 381 lovelaces ?`,
      options: [`0,0176 ADA`, `0,155 ADA`, `0,172981 ADA`, `1,7 ADA`],
      answer: 2,
      explain: `44 × 400 + 155 381 = 17 600 + 155 381 = 172 981 lovelaces, soit 0,172981 ADA.`,
    },
    {
      kind: 'multi',
      q: `Quelles sources complètent utilement l'analyse d'une adresse Cardano ? (plusieurs réponses)`,
      options: [
        `L'adresse de récompense et la liste des adresses qui la partagent dans un explorateur`,
        `Les datums des sorties envoyées à des adresses de script`,
        `Les métadonnées de transaction et les handles ($nom)`,
        `Le taux de frais en sat/vB`,
      ],
      answer: [0, 1, 2],
      explain: `Les trois premières sources sont propres à Cardano et souvent décisives. Le taux en sat/vB est une notion Bitcoin ; les frais Cardano suivent une formule linéaire.`,
    },
  ],
  flashcards: [
    { front: 'eUTXO', back: `UTXO étendu : sortie = adresse + valeur multi-actifs (lovelaces + jetons natifs) + datum facultatif (+ script de référence).` },
    { front: 'Datum / redeemer', back: `Datum : donnée attachée à la sortie de script (propriétaire, paramètres). Redeemer : argument fourni à la dépense (exécuter, annuler).` },
    { front: 'addr1q / addr1z', back: `Adresses de base : paiement par clé (q) ou par script (z), staking par clé. Portent la partie staking.` },
    { front: 'addr1v / addr1w', back: `Adresses enterprise, sans staking : clé (v, portefeuilles chauds d'exchanges) ou script (w).` },
    { front: 'stake1u', back: `Adresse de récompense : identifiant de la clé de staking, commune à toutes les adresses de base d'un compte.` },
    { front: 'CIP-1852', back: `m/1852'/1815'/compte'/rôle/index — rôle 0 réception, 1 rendu, 2 clé de staking.` },
    { front: 'Regroupement par staking', back: `Même stake1u = même compte (inférence forte), sans transaction ; relie aussi les rendus.` },
    { front: 'Adresse Frankenstein', back: `Clé de paiement d'une personne + clé de staking d'une autre : limite principale de l'heuristique. Corroborer par les flux.` },
    { front: 'Pool de staking', back: `Délégation sans transfert de fonds : jamais un critère de regroupement.` },
    { front: 'Ordre de DEX en eUTXO', back: `Dépôt sur une adresse de script + datum (propriétaire, réception, minimum) ; exécution groupée par un batcher (multipartite).` },
    { front: 'Frais Cardano', back: `44 × taille (octets) + 155 381 lovelaces, plus les unités d'exécution Plutus. Environ 0,17 ADA pour 300 octets.` },
  ],
}
