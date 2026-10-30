import type { GlossaryEntry } from './types'

// Glossaire de l'Académie SPECTRA — trié par ordre alphabétique.

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Activation de compte',
    def: 'Sur Tron, le XRP Ledger, Stellar ou EOS, un compte doit être créé ou activé par un premier envoi (ou par un compte existant). L\'adresse activatrice, visible on-chain, est un pivot d\'enquête comparable au « first funder » sur Ethereum.',
  },
  {
    term: 'Address poisoning',
    def: 'Empoisonnement d\'historique : l\'attaquant insère dans l\'historique de la victime une adresse sosie (mêmes premiers et derniers caractères qu\'un correspondant habituel) via un transfert nul, un faux jeton ou de la poussière, en espérant un copier-coller erroné.',
  },
  {
    term: 'Adresse',
    def: 'Identifiant public dérivé d\'une clé publique ou d\'un script, vers lequel on envoie des fonds. C\'est un pseudonyme : une même personne peut en contrôler des centaines.',
  },
  {
    term: 'Adresse bounceable',
    def: 'Format d\'adresse TON (commençant souvent par EQ) indiquant qu\'un transfert vers un contrat inexistant doit être renvoyé à l\'expéditeur ; le format non bounceable (UQ) est recommandé pour les portefeuilles. Les deux formats, et la forme brute « 0:… », désignent le même compte.',
  },
  {
    term: 'Adresse de dépôt',
    def: 'Adresse attribuée par un exchange à un client pour qu\'il y dépose des fonds, ensuite balayés vers le hot wallet. Elle identifie un client, contrairement au hot wallet qui n\'identifie que l\'exchange.',
  },
  {
    term: 'Adresse furtive (stealth address)',
    def: 'Mécanisme (notamment de Monero) par lequel chaque paiement crée une clé de sortie à usage unique que seul le destinataire peut reconnaître. L\'adresse publique du destinataire n\'apparaît jamais sur la chaîne.',
  },
  {
    term: 'AGRASC',
    def: 'Agence de gestion et de recouvrement des avoirs saisis et confisqués. Elle assiste les juridictions, gère les biens saisis qui lui sont confiés et peut, sur décision d\'un magistrat, les vendre avant jugement.',
  },
  {
    term: 'AMM',
    def: 'Automated Market Maker (teneur de marché automatisé) : DEX dont les prix découlent d\'une formule appliquée aux réserves d\'un pool de liquidité (par exemple x × y = k), sans carnet d\'ordres.',
  },
  {
    term: 'Approval',
    def: 'Autorisation ERC-20 (fonction approve) permettant à une adresse tierce de dépenser les jetons du détenteur via transferFrom. Les autorisations illimitées non révoquées sont exploitées par les drainers.',
  },
  {
    term: 'Atomic swap',
    def: 'Échange direct entre deux actifs de chaînes différentes (par exemple BTC contre XMR) sans intermédiaire de confiance, garanti par des contrats à verrou temporel. Il ne laisse pas de service à requérir.',
  },
  {
    term: 'Attribution',
    def: 'Rattachement d\'une adresse ou d\'un cluster à une entité du monde réel (exchange, mixeur, personne). Sa fiabilité dépend de la source : réponse à réquisition, saisie, base d\'un outil, OSINT ou heuristique.',
  },
  {
    term: 'BIP69',
    def: 'Proposition d\'amélioration de Bitcoin prévoyant un tri lexicographique des entrées et des sorties d\'une transaction. Peu de portefeuilles l\'appliquent : sa présence ou son absence constitue un élément d\'empreinte.',
  },
  {
    term: 'Bridge',
    def: 'Pont inter-chaînes permettant de transférer de la valeur d\'une blockchain à une autre (lock-and-mint, burn-and-mint, réseau de liquidité). Les événements de dépôt et de livraison partagent un identifiant qui permet le suivi.',
  },
  {
    term: 'Bridge canonique',
    def: 'Pont officiel d\'un rollup ou d\'une seconde couche, géré par ses propres contrats, par opposition aux bridges tiers. Sur un rollup optimiste, ses retraits vers la chaîne principale subissent la période de contestation.',
  },
  {
    term: 'Canal Lightning',
    def: 'Sortie on-chain contrôlée conjointement (en général multisignature 2-sur-2) par deux nœuds du Lightning Network, au sein de laquelle les paiements s\'échangent hors chaîne. Seules l\'ouverture et la fermeture sont visibles sur Bitcoin.',
  },
  {
    term: 'Chain hopping',
    def: 'Technique de blanchiment consistant à faire passer les fonds par plusieurs chaînes et actifs successifs (bridges, DEX, échangeurs, cryptos anonymes) pour rompre la continuité de l\'analyse.',
  },
  {
    term: 'Change (rendu)',
    def: 'Sortie d\'une transaction UTXO par laquelle le payeur se renvoie la différence entre la valeur des pièces dépensées et le montant payé. Son identification repose sur des heuristiques (adresse neuve, type de script, montant non rond…).',
  },
  {
    term: 'Chemin de dérivation',
    def: 'Suite d\'indices (par exemple m/84\'/0\'/0\'/0/5) indiquant comment une adresse est dérivée de la seed dans un portefeuille HD. Les standards BIP44, 49, 84 et 86 fixent les chemins usuels ; un chemin non standard peut masquer des fonds lors d\'une restauration.',
  },
  {
    term: 'CIOH',
    def: 'Common-Input-Ownership Heuristic : les entrées d\'une même transaction sont présumées contrôlées par la même entité. Base du clustering Bitcoin, elle est mise en défaut par le CoinJoin et le PayJoin.',
  },
  {
    term: 'Clé de vue (view key)',
    def: 'Clé Monero permettant de voir les paiements reçus par un portefeuille, sans pouvoir dépenser. Obtenue lors d\'une saisie, elle révèle les entrées de fonds.',
  },
  {
    term: 'Clé privée',
    def: 'Secret numérique permettant de signer les transactions, donc de dépenser les fonds d\'une adresse. Quiconque la détient contrôle les fonds : elle ne doit jamais être recopiée en clair dans une procédure.',
  },
  {
    term: 'Cluster',
    def: 'Ensemble d\'adresses regroupées par un outil comme appartenant probablement à une même entité (CIOH, rendus). C\'est une hypothèse algorithmique : une seule fausse fusion peut réunir des entités sans rapport.',
  },
  {
    term: 'Coinbase (transaction)',
    def: 'Première transaction d\'un bloc, sans entrée réelle, qui crée la récompense du mineur. Ne pas confondre avec l\'exchange du même nom.',
  },
  {
    term: 'CoinJoin',
    def: 'Transaction Bitcoin collaborative et non-custodiale dans laquelle plusieurs utilisateurs reçoivent des sorties de montant identique, organisée par un coordinateur. Elle casse la CIOH.',
  },
  {
    term: 'Cold wallet',
    def: 'Portefeuille « froid », conservé hors ligne, souvent en multisignature, qui détient les réserves d\'un exchange. Peu de transactions, gros montants ronds.',
  },
  {
    term: 'Commentaire TON',
    def: 'Texte libre joint à un transfert sur TON. Les exchanges l\'utilisent comme memo pour identifier le client destinataire d\'un dépôt : il doit figurer dans toute réquisition.',
  },
  {
    term: 'Confirmation',
    def: 'Nombre de blocs ajoutés depuis l\'inclusion d\'une transaction (1 au bloc d\'inclusion). Plus il est élevé, plus la transaction est définitive.',
  },
  {
    term: 'Consolidation',
    def: 'Transaction regroupant de nombreuses UTXO en une ou deux sorties. Typique du balayage des adresses de dépôt d\'un exchange ; chez un utilisateur, elle relie ses adresses par la CIOH.',
  },
  {
    term: 'Custodial / non-custodial',
    def: 'Un service custodial détient les clés pour le compte de ses clients (exchange, mixeur centralisé) et peut être requis ; un portefeuille ou protocole non-custodial laisse les clés à l\'utilisateur.',
  },
  {
    term: 'DAB crypto',
    def: 'Distributeur automatique permettant d\'acheter ou de vendre des crypto-actifs contre des espèces. Son opérateur, soumis aux obligations des prestataires, détient journaux de transactions, données KYC éventuelles et images de vidéosurveillance, à préserver rapidement.',
  },
  {
    term: 'DAC8',
    def: 'Directive européenne de coopération administrative en matière fiscale étendue aux crypto-actifs : les prestataires doivent déclarer à l\'administration fiscale les opérations de leurs clients, ces informations étant échangées entre États membres.',
  },
  {
    term: 'DEE',
    def: 'Décision d\'enquête européenne (directive 2014/41/UE) : décision émise ou validée par une autorité judiciaire pour faire exécuter une mesure d\'enquête dans un autre État membre de l\'UE.',
  },
  {
    term: 'Demande de conservation',
    def: 'Demande adressée en urgence à un prestataire pour qu\'il préserve des données (journaux, images, KYC) avant leur effacement, dans l\'attente d\'une réquisition ou d\'une demande d\'entraide formelle.',
  },
  {
    term: 'Destination tag / memo',
    def: 'Identifiant joint à un paiement (XRP, Stellar, EOS, Cosmos, TON…) pour désigner le compte client derrière une adresse partagée d\'exchange. Indispensable dans une réquisition.',
  },
  {
    term: 'DEX',
    def: 'Exchange décentralisé : ensemble de contrats permettant d\'échanger des jetons sans intermédiaire custodial ni KYC. Un swap DEX est lisible on-chain et ne coupe pas la trace.',
  },
  {
    term: 'Drainer',
    def: 'Kit d\'hameçonnage, souvent vendu « as a service », qui pousse la victime à signer une approbation ou un permit puis vide ses jetons. Les gains sont partagés entre l\'opérateur du kit et son client.',
  },
  {
    term: 'Dust (poussière)',
    def: 'Montant infime envoyé à une adresse, parfois pour pister son propriétaire (s\'il consolide la poussière avec d\'autres pièces) ou pour empoisonner son historique.',
  },
  {
    term: 'Échangeur instantané',
    def: 'Service sans compte qui convertit un actif en un autre (souvent d\'une chaîne à une autre) et verse le résultat depuis son propre portefeuille. Aucun lien on-chain, mais le service connaît la commande.',
  },
  {
    term: 'Empreinte de portefeuille',
    def: 'Ensemble des caractéristiques techniques laissées par un logiciel de portefeuille dans ses transactions (type d\'adresse, nLockTime, RBF, ordre des entrées et sorties, version, politique de frais). Elle permet de suivre un même utilisateur ou de distinguer le paiement du rendu.',
  },
  {
    term: 'Énergie et bande passante (Tron)',
    def: 'Ressources consommées par les transactions Tron : la bande passante selon la taille, l\'énergie pour l\'exécution des contrats (transferts d\'USDT). Elles s\'obtiennent par staking, délégation ou en brûlant des TRX.',
  },
  {
    term: 'Entraide pénale internationale',
    def: 'Coopération entre autorités judiciaires d\'États différents pour exécuter des actes d\'enquête à l\'étranger (réquisitions, saisies, auditions). Dans l\'UE, la décision d\'enquête européenne en simplifie la mise en œuvre.',
  },
  {
    term: 'EOA',
    def: 'Externally Owned Account : compte EVM contrôlé par une clé privée, seul capable d\'initier une transaction, par opposition aux comptes de contrat.',
  },
  {
    term: 'ERC-20',
    def: 'Standard de jeton fongible sur Ethereum et les chaînes EVM (transfer, approve, transferFrom, événement Transfer). USDT et USDC en sont des exemples.',
  },
  {
    term: 'ERC-721',
    def: 'Standard Ethereum des jetons non fongibles (NFT) : chaque jeton possède un identifiant unique. L\'ERC-1155 permet de gérer jetons fongibles et non fongibles dans un même contrat.',
  },
  {
    term: 'Événement (log)',
    def: 'Message émis par un contrat lors de son exécution (Transfer, Approval, Swap, Deposit…). Les transferts de jetons et les opérations de bridges se lisent dans les événements.',
  },
  {
    term: 'Explorateur de blocs',
    def: 'Site ou outil qui affiche les blocs, les transactions et les adresses d\'une blockchain. Sa consultation est passive mais journalisée par l\'exploitant : l\'utiliser depuis un environnement conforme aux règles d\'OPSEC.',
  },
  {
    term: 'Exposition (exposure)',
    def: 'Mesure par un outil de la part des fonds d\'une adresse provenant (ou à destination) de catégories d\'entités (exchange, mixeur, darknet…), directement ou à plusieurs sauts. Indicateur de risque, pas preuve de lien.',
  },
  {
    term: 'Faux récupérateur',
    def: 'Escroquerie secondaire visant les victimes d\'une première fraude : de prétendus cabinets, avocats, « hackers éthiques » ou agents publics promettent de récupérer les fonds contre le paiement de frais.',
  },
  {
    term: 'FIFO',
    def: 'First In, First Out : méthode de traçage des montants selon laquelle les fonds sortent d\'une adresse dans l\'ordre où ils y sont entrés.',
  },
  {
    term: 'First funder',
    def: 'Adresse ayant envoyé le premier financement (monnaie native pour le gaz) à une adresse EVM. Pivot majeur : c\'est souvent l\'auteur lui-même, un exchange ou un service.',
  },
  {
    term: 'Force close',
    def: 'Fermeture unilatérale d\'un canal Lightning par l\'une des parties, qui publie le dernier état du canal sur la chaîne. Les fonds de la partie qui ferme restent bloqués pendant un délai ; la transaction laisse une trace caractéristique on-chain.',
  },
  {
    term: 'Fractionnement (smurfing)',
    def: 'Découpage de fonds en nombreuses petites opérations, souvent via plusieurs comptes ou mules, pour rester sous les seuils de vigilance et brouiller la piste.',
  },
  {
    term: 'GAFI',
    def: 'Groupe d\'action financière (FATF) : organisme intergouvernemental qui fixe les normes internationales de lutte contre le blanchiment et le financement du terrorisme, notamment pour les prestataires d\'actifs virtuels et la Travel Rule.',
  },
  {
    term: 'Gap limit',
    def: 'Nombre d\'adresses consécutives inutilisées (souvent 20) au-delà duquel un portefeuille HD cesse de rechercher des fonds lors d\'une restauration. Des fonds reçus plus loin dans la séquence peuvent passer inaperçus si on ne l\'augmente pas.',
  },
  {
    term: 'Gas',
    def: 'Unité de coût de calcul sur les chaînes EVM, payée dans la monnaie native (ETH, BNB, POL…). Pour déplacer des jetons, une adresse doit disposer de monnaie native.',
  },
  {
    term: 'Gel en temps réel',
    def: 'Blocage obtenu pendant que les fonds circulent encore : inscription d\'une adresse sur liste noire par l\'émetteur d\'un stablecoin ou blocage d\'un compte par un exchange avant le retrait. Il suppose une détection rapide et un canal de contact établi avec l\'émetteur ou la plateforme.',
  },
  {
    term: 'Haircut',
    def: 'Méthode de traçage proportionnelle : chaque sortie d\'une adresse emporte la proportion de fonds illicites présente dans cette adresse.',
  },
  {
    term: 'Hash de transaction (TxID)',
    def: 'Identifiant unique d\'une transaction, calculé à partir de son contenu. Il permet de la retrouver sur un explorateur et doit figurer, copié sans ressaisie, dans les réquisitions et les procès-verbaux.',
  },
  {
    term: 'Honeypot (jeton)',
    def: 'Jeton piégé dont le contrat permet l\'achat mais bloque ou taxe lourdement la revente pour tout autre que le créateur. Les victimes voient leur solde sans pouvoir le vendre.',
  },
  {
    term: 'Hot wallet',
    def: 'Portefeuille en ligne d\'un exchange qui centralise les dépôts balayés et sert les retraits. Il identifie l\'exchange, jamais un client : requérir avec le txid concerné.',
  },
  {
    term: 'HTLC',
    def: 'Hashed Timelock Contract : contrat conditionnel qui verrouille un paiement jusqu\'à la révélation d\'un secret ou l\'expiration d\'un délai. Il permet le routage des paiements Lightning et les échanges atomiques entre chaînes.',
  },
  {
    term: 'Jetton',
    def: 'Standard de jeton de la blockchain TON. Chaque détenteur dispose d\'un contrat « jetton wallet » distinct de son adresse principale, ce qui impose de bien distinguer les deux lors de l\'analyse.',
  },
  {
    term: 'Jeu d\'anonymat',
    def: 'Nombre de candidats indiscernables pour une sortie de CoinJoin ou un retrait de pool de confidentialité. Le jeu effectif peut être bien plus petit que le jeu théorique (timing, comportements).',
  },
  {
    term: 'KYC',
    def: 'Know Your Customer : obligations d\'identification et de vérification des clients imposées aux prestataires régulés. Les données KYC sont au cœur des réquisitions.',
  },
  {
    term: 'Launchpad',
    def: 'Plateforme de lancement de jetons permettant de créer et de mettre en vente un jeton en quelques minutes. Elle facilite les lancements frauduleux (rug pulls, pump and dump) et conserve l\'historique des créateurs.',
  },
  {
    term: 'LCB-FT',
    def: 'Lutte contre le blanchiment de capitaux et le financement du terrorisme. Les prestataires de cryptoactifs y sont assujettis (vigilance, déclarations de soupçon à TRACFIN).',
  },
  {
    term: 'LIFO',
    def: 'Last In, First Out : méthode de traçage selon laquelle les fonds sortant d\'une adresse sont réputés être les derniers entrés. Elle produit des résultats différents de FIFO ou du prorata ; la méthode retenue doit toujours être annoncée.',
  },
  {
    term: 'Lightning Network',
    def: 'Réseau de paiement de seconde couche de Bitcoin fonctionnant par canaux bilatéraux. Seules l\'ouverture et la fermeture des canaux apparaissent on-chain ; les paiements internes ne sont pas visibles.',
  },
  {
    term: 'Liste noire (blacklist)',
    def: 'Liste d\'adresses dont l\'émetteur d\'un stablecoin centralisé a bloqué les jetons : les fonds qui y figurent ne peuvent plus être transférés. Elle peut aussi désigner les listes d\'adresses à risque des exchanges et des outils d\'analyse.',
  },
  {
    term: 'LSP',
    def: 'Lightning Service Provider : prestataire qui ouvre des canaux et fournit de la liquidité aux utilisateurs de portefeuilles Lightning. Souvent centralisé, il peut détenir des informations sur ses clients et constituer une cible de réquisition.',
  },
  {
    term: 'Mempool',
    def: 'File d\'attente des transactions diffusées mais pas encore incluses dans un bloc. Une transaction non confirmée peut être remplacée ou abandonnée.',
  },
  {
    term: 'MiCA',
    def: 'Règlement (UE) 2023/1114 sur les marchés de crypto-actifs, applicable aux prestataires depuis le 30 décembre 2024. Il impose un agrément de PSCA, passeportable dans l\'Union.',
  },
  {
    term: 'Mint / burn',
    def: 'Création (mint) ou destruction (burn) de jetons. Pour un ERC-20, représentées par un événement Transfer depuis ou vers l\'adresse nulle.',
  },
  {
    term: 'Mixeur (mixer)',
    def: 'Service custodial qui reçoit des fonds et en restitue d\'autres, après un délai et moins une commission. Aucun lien on-chain entre dépôt et sortie.',
  },
  {
    term: 'MLM',
    def: 'Multi-level marketing (vente pyramidale) : système rémunérant le recrutement de nouveaux membres. Associé à une fausse plateforme de rendement crypto, il accélère la propagation d\'une escroquerie de type Ponzi.',
  },
  {
    term: 'Mule',
    def: 'Personne qui prête son identité, son compte bancaire ou son compte d\'exchange pour faire transiter des fonds d\'origine criminelle, contre rémunération ou par manipulation. Les comptes KYC identifiés appartiennent souvent à des mules plutôt qu\'aux organisateurs.',
  },
  {
    term: 'Multisig',
    def: 'Adresse ou portefeuille exigeant plusieurs signatures parmi un ensemble de clés (par exemple 2-sur-3). Utilisé par les exchanges, les séquestres de places de marché et les portefeuilles d\'entreprise.',
  },
  {
    term: 'MWEB',
    def: 'MimbleWimble Extension Blocks : extension optionnelle de Litecoin masquant montants et adresses des fonds qui y entrent. Les passages vers et depuis la partie transparente restent visibles.',
  },
  {
    term: 'Niveau de confiance',
    def: 'Qualification de la solidité d\'une conclusion d\'analyse : certain (établi par la blockchain ou par une réponse officielle), probable (heuristique robuste, corrélation unique), possible (hypothèse à corroborer). Il doit accompagner chaque attribution dans un rapport.',
  },
  {
    term: 'nLockTime',
    def: 'Champ d\'une transaction Bitcoin fixant la hauteur de bloc (ou la date) avant laquelle elle ne peut pas être confirmée. Certains portefeuilles y inscrivent la hauteur courante (protection contre le « fee sniping ») : sa valeur fait partie de leur empreinte.',
  },
  {
    term: 'Nonce',
    def: 'Compteur des transactions émises par un compte EVM (0 pour la première). Il indique l\'activité sortante et sert à calculer l\'adresse des contrats déployés par ce compte.',
  },
  {
    term: 'OFAC',
    def: 'Office of Foreign Assets Control, service du Trésor américain qui publie des listes de sanctions incluant des adresses de cryptoactifs. À ne pas confondre avec l\'Office anti-cybercriminalité français, qui porte le même sigle.',
  },
  {
    term: 'OSINT',
    def: 'Open Source Intelligence : renseignement d\'origine sources ouvertes (moteurs, forums, réseaux sociaux, noms ENS, infrastructure web). Il fournit des indices à corroborer.',
  },
  {
    term: 'OTC',
    def: 'Over The Counter : courtier de gré à gré réalisant des échanges de gros volumes (souvent USDT contre espèces ou virements), parfois avec un KYC faible. Point de sortie fréquent du blanchiment.',
  },
  {
    term: 'P2P (pair à pair)',
    def: 'Échange de crypto-actifs directement entre particuliers, sur une place de marché P2P d\'exchange (avec séquestre) ou de gré à gré (espèces, virement). Canal fréquent d\'entrée et de sortie de fonds illicites, parfois via des mules.',
  },
  {
    term: 'P2PKH',
    def: 'Pay-to-Public-Key-Hash : type de script Bitcoin historique, adresses commençant par « 1 ».',
  },
  {
    term: 'P2SH',
    def: 'Pay-to-Script-Hash : adresses Bitcoin commençant par « 3 », utilisées pour les multisignatures historiques et le SegWit encapsulé. Le script n\'est révélé qu\'à la dépense.',
  },
  {
    term: 'P2TR',
    def: 'Pay-to-Taproot : type de script Bitcoin (adresses « bc1p ») permettant de dissimuler des conditions de dépense complexes derrière une signature simple.',
  },
  {
    term: 'P2WPKH',
    def: 'Pay-to-Witness-Public-Key-Hash : SegWit natif à clé unique, adresses « bc1q » de 42 caractères. Format le plus courant aujourd\'hui.',
  },
  {
    term: 'P2WSH',
    def: 'Pay-to-Witness-Script-Hash : SegWit natif à script, adresses « bc1q » de 62 caractères, utilisé pour les multisignatures modernes et les canaux Lightning.',
  },
  {
    term: 'Passphrase BIP39',
    def: 'Mot de passe facultatif ajouté à la phrase de récupération (« 25e mot ») : chaque passphrase ouvre un portefeuille entièrement différent. Elle peut servir de portefeuille caché ou de leurre ; sans elle, la seed saisie ne donne pas accès aux fonds protégés.',
  },
  {
    term: 'PayJoin',
    def: 'Paiement Bitcoin dans lequel le destinataire ajoute une de ses entrées (BIP78). Il ressemble à une transaction ordinaire mais fausse la CIOH et l\'heuristique de l\'entrée superflue.',
  },
  {
    term: 'Peel chain',
    def: 'Chaîne de transactions où une grosse UTXO est « épluchée » par petites sorties successives vers des services, le reste partant à chaque fois vers une nouvelle adresse de l\'auteur.',
  },
  {
    term: 'Période de contestation',
    def: 'Délai (de l\'ordre d\'une semaine sur les principaux rollups optimistes) pendant lequel une preuve de fraude peut être soumise avant qu\'un retrait par le bridge canonique soit finalisé. C\'est une fenêtre d\'action pour l\'enquêteur à l\'arrivée.',
  },
  {
    term: 'Permit',
    def: 'Autorisation de dépense donnée par simple signature hors chaîne (EIP-2612, Permit2), ensuite soumise par un tiers. Très exploitée par les drainers car elle ne coûte rien à la victime.',
  },
  {
    term: 'PHAROS',
    def: 'Plateforme française de signalement des contenus et comportements illicites sur internet, rattachée à l\'Office anti-cybercriminalité.',
  },
  {
    term: 'Pig butchering',
    def: 'Escroquerie mêlant relation de confiance (souvent sentimentale) et faux investissement : la victime est amenée à déposer des fonds croissants sur une fausse plateforme qui affiche des gains fictifs, puis exige des « frais » pour les retirer.',
  },
  {
    term: 'Poison',
    def: 'Méthode de traçage maximaliste : toute sortie d\'une adresse ayant reçu des fonds illicites est considérée comme entièrement illicite.',
  },
  {
    term: 'Ponzi',
    def: 'Escroquerie dans laquelle les « rendements » versés aux premiers investisseurs proviennent des dépôts des suivants, sans activité réelle. Le schéma s\'effondre quand les entrées ralentissent ; on-chain, il se traduit par une redistribution des nouveaux dépôts.',
  },
  {
    term: 'Pool de confidentialité',
    def: 'Contrat non-custodial (type Tornado) recevant des dépôts à montant fixe et permettant des retraits vers n\'importe quelle adresse grâce à une preuve à divulgation nulle. Le démixage repose sur les erreurs des utilisateurs.',
  },
  {
    term: 'Portefeuille de saisie',
    def: 'Portefeuille créé et contrôlé par le service d\'enquête, selon sa doctrine, pour recevoir des crypto-actifs saisis. Il garantit que les fonds échappent au suspect et à ses complices dans l\'attente de leur remise à l\'AGRASC ou d\'une décision judiciaire.',
  },
  {
    term: 'Portefeuille matériel',
    def: 'Appareil dédié (hardware wallet) qui conserve les clés privées hors ligne et signe les transactions sans les exposer. Lors d\'une saisie, l\'appareil seul ne suffit pas : la seed et la passphrase éventuelle permettent de restaurer les fonds ailleurs.',
  },
  {
    term: 'Prorata',
    def: 'Méthode de traçage proportionnelle (synonyme de haircut) : chaque sortie emporte la même proportion de fonds illicites que celle présente dans l\'adresse au moment de la dépense. Plus nuancée que le poison, elle dilue la part illicite à chaque mélange.',
  },
  {
    term: 'PSAN',
    def: 'Prestataire de services sur actifs numériques : régime français issu de la loi PACTE, avec enregistrement auprès de l\'AMF. Remplacé par le régime MiCA (PSCA) à l\'issue de la période transitoire.',
  },
  {
    term: 'PSCA',
    def: 'Prestataire de services sur crypto-actifs agréé au titre de MiCA (CASP en anglais), par l\'AMF en France, et pouvant exercer dans toute l\'UE par passeport.',
  },
  {
    term: 'Pump and dump',
    def: 'Manipulation consistant à faire monter artificiellement le cours d\'un actif peu liquide (promotion, rumeurs, achats coordonnés) puis à revendre au plus haut aux investisseurs attirés.',
  },
  {
    term: 'RaaS',
    def: 'Ransomware-as-a-Service : modèle où des opérateurs fournissent le rançongiciel et l\'infrastructure à des affiliés qui mènent les attaques, la rançon étant partagée entre eux.',
  },
  {
    term: 'RBF',
    def: 'Replace-By-Fee : signal permettant de remplacer une transaction Bitcoin non confirmée par une version payant plus de frais. Fait partie de l\'empreinte d\'un portefeuille.',
  },
  {
    term: 'Relayeur (relayer)',
    def: 'Tiers qui soumet une transaction pour le compte d\'un utilisateur (retrait de pool de confidentialité) ou qui avance des fonds sur la chaîne de destination (bridge à liquidité). Il n\'est pas lié au suspect.',
  },
  {
    term: 'Réquisition judiciaire',
    def: 'Acte par lequel un OPJ, un procureur ou un juge demande à une personne ou un organisme la remise d\'informations (articles 60-1, 77-1-1 et 99-3 du code de procédure pénale selon le cadre d\'enquête). Pour un exchange, elle vise identité, connexions, flux et blocage des avoirs.',
  },
  {
    term: 'RingCT',
    def: 'Ring Confidential Transactions : mécanisme de Monero masquant les montants par des engagements cryptographiques, avec des preuves qu\'ils sont valides.',
  },
  {
    term: 'Rollup optimiste',
    def: 'Solution de seconde couche qui exécute les transactions hors de la chaîne principale et y publie ses données, en les présumant valides sauf preuve de fraude soumise pendant une période de contestation (Arbitrum, Optimism, Base…).',
  },
  {
    term: 'Rollup ZK',
    def: 'Solution de seconde couche dont les lots de transactions sont validés sur la chaîne principale par une preuve cryptographique de validité (zk-SNARK ou zk-STARK). Les retraits n\'attendent pas de période de contestation.',
  },
  {
    term: 'Routeur (router)',
    def: 'Contrat d\'entrée d\'un DEX qui orchestre un swap à travers un ou plusieurs pools. C\'est de l\'infrastructure, jamais une contrepartie à identifier.',
  },
  {
    term: 'Rug pull',
    def: 'Escroquerie où le créateur d\'un jeton retire la liquidité ou émet massivement de nouveaux jetons après avoir attiré des acheteurs, laissant un jeton sans valeur.',
  },
  {
    term: 'Saisie pénale spéciale',
    def: 'Saisie de biens, dont les crypto-actifs, en vue de garantir l\'exécution d\'une éventuelle peine de confiscation, régie par les articles 706-141 et suivants du code de procédure pénale. Les avoirs saisis peuvent être confiés à l\'AGRASC.',
  },
  {
    term: 'Satoshi',
    def: 'Plus petite unité du bitcoin : 1 BTC = 100 000 000 satoshis (sats).',
  },
  {
    term: 'SDN',
    def: 'Specially Designated Nationals and Blocked Persons List : liste de sanctions de l\'OFAC, qui peut mentionner des adresses de crypto-actifs associées aux personnes ou entités désignées.',
  },
  {
    term: 'Seed (phrase de récupération)',
    def: 'Suite de 12 ou 24 mots (25 sur Monero) permettant de régénérer toutes les clés d\'un portefeuille HD. Une phrase de passe optionnelle (« 25e mot ») peut ouvrir des portefeuilles supplémentaires. Qui détient la seed contrôle les fonds.',
  },
  {
    term: 'Séquenceur',
    def: 'Opérateur qui ordonne et regroupe les transactions d\'un rollup avant leur publication sur la chaîne principale. Souvent unique et centralisé, il conditionne la vitesse et parfois la censure des transactions.',
  },
  {
    term: 'setApprovalForAll',
    def: 'Fonction des standards ERC-721 et ERC-1155 qui autorise un opérateur à transférer tous les NFT d\'une collection détenus par l\'utilisateur. Sa signature sur un site de phishing permet le vol de l\'ensemble de la collection.',
  },
  {
    term: 'Signature de cercle (ring signature)',
    def: 'Signature Monero produite au sein d\'un groupe de sorties (la vraie et 15 leurres) : un observateur ne peut pas savoir laquelle est réellement dépensée.',
  },
  {
    term: 'Slippage',
    def: 'Écart toléré entre le prix attendu et le prix d\'exécution d\'un swap sur un DEX, lié notamment à l\'impact de l\'ordre sur le pool.',
  },
  {
    term: 'Smart contract',
    def: 'Programme déployé sur une blockchain (compte de contrat) qui s\'exécute lorsqu\'on l\'appelle : jeton, DEX, bridge, multisignature, pool de confidentialité. Il n\'a pas de clé privée.',
  },
  {
    term: 'Sniping',
    def: 'Achat d\'un jeton dans les tout premiers blocs suivant l\'ajout de liquidité, souvent par des robots. Lorsque les « snipers » sont liés au créateur, c\'est un indice de lancement frauduleux et de détention dissimulée.',
  },
  {
    term: 'Stablecoin',
    def: 'Jeton indexé sur une monnaie (USDT, USDC sur le dollar). Les stablecoins centralisés sont gelables par leur émetteur, levier majeur pour l\'enquêteur.',
  },
  {
    term: 'Sweep (balayage)',
    def: 'Transfert des fonds des adresses de dépôt d\'un service vers son hot wallet (consolidation sur Bitcoin, gas top-up puis transfert sur EVM et Tron). Signature typique d\'un exchange.',
  },
  {
    term: 'Taint',
    def: 'Part de fonds d\'origine illicite attribuée à une adresse ou une transaction selon une méthode de traçage (poison, haircut, FIFO). La valeur dépend entièrement de la méthode choisie.',
  },
  {
    term: 'TFR',
    def: 'Transfer of Funds Regulation : règlement (UE) 2023/1113 sur les informations accompagnant les transferts de fonds et de crypto-actifs, qui met en œuvre la Travel Rule dans l\'Union.',
  },
  {
    term: 'TON',
    def: 'The Open Network : blockchain à comptes intégrée à l\'écosystème Telegram (portefeuille intégré, mini-applications). Chaque compte est un contrat ; l\'USDT y circule sous forme de jetton.',
  },
  {
    term: 'Toxic change',
    def: 'Rendu non mixé d\'un CoinJoin (par exemple le rendu de la Tx0 Whirlpool), resté directement lié aux entrées du participant. Le dépenser avec des sorties mixées annule le mélange.',
  },
  {
    term: 'TRACFIN',
    def: 'Cellule de renseignement financier française. Elle reçoit les déclarations de soupçon des assujettis (dont les prestataires de cryptoactifs) et peut transmettre des informations à l\'autorité judiciaire.',
  },
  {
    term: 'Travel Rule',
    def: 'Règle de voyage (règlement (UE) 2023/1113, applicable depuis le 30 décembre 2024) : les PSCA transmettent et conservent les informations sur l\'émetteur et le bénéficiaire des transferts de cryptoactifs.',
  },
  {
    term: 'TRC-20',
    def: 'Standard de jeton de Tron, équivalent de l\'ERC-20. L\'USDT-TRC20 est l\'actif dominant des escroqueries et du blanchiment en stablecoins.',
  },
  {
    term: 'UTXO',
    def: 'Unspent Transaction Output : « pièce » non dépensée du modèle Bitcoin, consommée en totalité lors de sa dépense, la différence revenant sur une sortie de rendu.',
  },
  {
    term: 'VASP',
    def: 'Virtual Asset Service Provider : terme du GAFI désignant les prestataires de services sur actifs virtuels (exchanges, conservateurs…), équivalent général des PSAN/PSCA.',
  },
  {
    term: 'Wash trading',
    def: 'Transactions fictives entre adresses ou comptes contrôlés par la même personne pour gonfler artificiellement le volume ou le prix d\'un actif (jeton, NFT). Il sert aussi à blanchir en simulant des ventes.',
  },
  {
    term: 'Watch-only',
    def: 'Portefeuille en lecture seule, construit à partir d\'adresses ou d\'une clé publique étendue : il affiche soldes et historique sans pouvoir signer. Utile à l\'enquêteur pour surveiller ou reconstituer un portefeuille sans risque de déplacer les fonds.',
  },
  {
    term: 'Wrapped token',
    def: 'Jeton enveloppé représentant un actif d\'une autre chaîne ou un actif natif (WBTC, WETH). Il est émis contre verrouillage de l\'actif d\'origine, par un contrat ou un custodian.',
  },
  {
    term: 'Wrench attack',
    def: 'Attaque « à la clé à molette » : contrainte physique (violences, séquestration, enlèvement) exercée sur un détenteur de crypto-actifs ou ses proches pour obtenir un transfert ou une phrase de récupération.',
  },
  {
    term: 'xpub',
    def: 'Clé publique étendue d\'un portefeuille HD permettant de dériver toutes ses adresses de réception sans pouvoir dépenser. Saisie, elle révèle l\'ensemble des adresses et l\'historique du portefeuille.',
  },
  {
    term: 'ypub / zpub',
    def: 'Variantes de la clé publique étendue (xpub) signalant le type d\'adresses dérivées : ypub pour les adresses SegWit imbriquées (P2SH-P2WPKH, BIP49), zpub pour le SegWit natif (P2WPKH, BIP84). Comme une xpub, elles révèlent toutes les adresses du compte sans permettre de dépenser.',
  },
  {
    term: 'zk-SNARK',
    def: 'Preuve à divulgation nulle de connaissance, succincte : elle prouve qu\'une affirmation est vraie sans révéler l\'information sous-jacente. Utilisée par les pools de confidentialité et Zcash.',
  },
]
