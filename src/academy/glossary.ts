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
    term: 'Bridge',
    def: 'Pont inter-chaînes permettant de transférer de la valeur d\'une blockchain à une autre (lock-and-mint, burn-and-mint, réseau de liquidité). Les événements de dépôt et de livraison partagent un identifiant qui permet le suivi.',
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
    term: 'CIOH',
    def: 'Common-Input-Ownership Heuristic : les entrées d\'une même transaction sont présumées contrôlées par la même entité. Base du clustering Bitcoin, elle est mise en défaut par le CoinJoin et le PayJoin.',
  },
  {
    term: 'Clé de vue (view key)',
    def: 'Clé Monero permettant de voir les paiements reçus par un portefeuille, sans pouvoir dépenser. Obtenue lors d\'une saisie, elle révèle les entrées de fonds.',
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
    term: 'DEE',
    def: 'Décision d\'enquête européenne (directive 2014/41/UE) : décision émise ou validée par une autorité judiciaire pour faire exécuter une mesure d\'enquête dans un autre État membre de l\'UE.',
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
    term: 'Énergie et bande passante (Tron)',
    def: 'Ressources consommées par les transactions Tron : la bande passante selon la taille, l\'énergie pour l\'exécution des contrats (transferts d\'USDT). Elles s\'obtiennent par staking, délégation ou en brûlant des TRX.',
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
    term: 'Événement (log)',
    def: 'Message émis par un contrat lors de son exécution (Transfer, Approval, Swap, Deposit…). Les transferts de jetons et les opérations de bridges se lisent dans les événements.',
  },
  {
    term: 'Exposition (exposure)',
    def: 'Mesure par un outil de la part des fonds d\'une adresse provenant (ou à destination) de catégories d\'entités (exchange, mixeur, darknet…), directement ou à plusieurs sauts. Indicateur de risque, pas preuve de lien.',
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
    term: 'Gas',
    def: 'Unité de coût de calcul sur les chaînes EVM, payée dans la monnaie native (ETH, BNB, POL…). Pour déplacer des jetons, une adresse doit disposer de monnaie native.',
  },
  {
    term: 'Haircut',
    def: 'Méthode de traçage proportionnelle : chaque sortie d\'une adresse emporte la proportion de fonds illicites présente dans cette adresse.',
  },
  {
    term: 'Hot wallet',
    def: 'Portefeuille en ligne d\'un exchange qui centralise les dépôts balayés et sert les retraits. Il identifie l\'exchange, jamais un client : requérir avec le txid concerné.',
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
    term: 'LCB-FT',
    def: 'Lutte contre le blanchiment de capitaux et le financement du terrorisme. Les prestataires de cryptoactifs y sont assujettis (vigilance, déclarations de soupçon à TRACFIN).',
  },
  {
    term: 'Lightning Network',
    def: 'Réseau de paiement de seconde couche de Bitcoin fonctionnant par canaux bilatéraux. Seules l\'ouverture et la fermeture des canaux apparaissent on-chain ; les paiements internes ne sont pas visibles.',
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
    term: 'Multisig',
    def: 'Adresse ou portefeuille exigeant plusieurs signatures parmi un ensemble de clés (par exemple 2-sur-3). Utilisé par les exchanges, les séquestres de places de marché et les portefeuilles d\'entreprise.',
  },
  {
    term: 'MWEB',
    def: 'MimbleWimble Extension Blocks : extension optionnelle de Litecoin masquant montants et adresses des fonds qui y entrent. Les passages vers et depuis la partie transparente restent visibles.',
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
    term: 'PayJoin',
    def: 'Paiement Bitcoin dans lequel le destinataire ajoute une de ses entrées (BIP78). Il ressemble à une transaction ordinaire mais fausse la CIOH et l\'heuristique de l\'entrée superflue.',
  },
  {
    term: 'Peel chain',
    def: 'Chaîne de transactions où une grosse UTXO est « épluchée » par petites sorties successives vers des services, le reste partant à chaque fois vers une nouvelle adresse de l\'auteur.',
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
    term: 'Poison',
    def: 'Méthode de traçage maximaliste : toute sortie d\'une adresse ayant reçu des fonds illicites est considérée comme entièrement illicite.',
  },
  {
    term: 'Pool de confidentialité',
    def: 'Contrat non-custodial (type Tornado) recevant des dépôts à montant fixe et permettant des retraits vers n\'importe quelle adresse grâce à une preuve à divulgation nulle. Le démixage repose sur les erreurs des utilisateurs.',
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
    term: 'RingCT',
    def: 'Ring Confidential Transactions : mécanisme de Monero masquant les montants par des engagements cryptographiques, avec des preuves qu\'ils sont valides.',
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
    term: 'Satoshi',
    def: 'Plus petite unité du bitcoin : 1 BTC = 100 000 000 satoshis (sats).',
  },
  {
    term: 'Seed (phrase de récupération)',
    def: 'Suite de 12 ou 24 mots (25 sur Monero) permettant de régénérer toutes les clés d\'un portefeuille HD. Une phrase de passe optionnelle (« 25e mot ») peut ouvrir des portefeuilles supplémentaires. Qui détient la seed contrôle les fonds.',
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
    term: 'Wrapped token',
    def: 'Jeton enveloppé représentant un actif d\'une autre chaîne ou un actif natif (WBTC, WETH). Il est émis contre verrouillage de l\'actif d\'origine, par un contrat ou un custodian.',
  },
  {
    term: 'xpub',
    def: 'Clé publique étendue d\'un portefeuille HD permettant de dériver toutes ses adresses de réception sans pouvoir dépenser. Saisie, elle révèle l\'ensemble des adresses et l\'historique du portefeuille.',
  },
  {
    term: 'zk-SNARK',
    def: 'Preuve à divulgation nulle de connaissance, succincte : elle prouve qu\'une affirmation est vraie sans révéler l\'information sous-jacente. Utilisée par les pools de confidentialité et Zcash.',
  },
]
