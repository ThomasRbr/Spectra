// Catalogue d'entités. La plupart sont des acteurs RÉELS (exchanges, mixeurs,
// DEX…) décrits à partir de faits publics ; les flux qui les traversent
// restent simulés. Les délais et modalités de coopération sont indicatifs.
// Restent fictifs les rôles qui imputeraient à un acteur réel un comportement
// non établi (exchange offshore peu coopératif, protocole piraté, casino…) et
// le bridge, qui sert de modèle générique.

export type EntityCategory =
  | 'exchange' | 'instant_exchanger' | 'mixer' | 'coinjoin' | 'privacy_pool'
  | 'bridge' | 'dex' | 'defi' | 'darknet' | 'ransomware' | 'scam'
  | 'sanctioned' | 'gambling' | 'p2p' | 'merchant' | 'mining' | 'hack'
  | 'otc' | 'wallet_service' | 'token_issuer' | 'atm' | 'nft_marketplace'
  | 'victim' | 'suspect' | 'individual'

export type RiskLevel = 'low' | 'medium' | 'high' | 'severe'
export type Cooperation = 'direct' | 'voluntary' | 'eio' | 'mlat' | 'none'

export interface Compliance {
  contact: string
  portal?: string
  cooperation: Cooperation
  responseDays: [number, number]
  canFreeze: boolean
  kyc: 'renforcé' | 'standard' | 'faible' | 'aucun'
  regulator?: string
  notes?: string
}

export interface Entity {
  id: string
  name: string
  category: EntityCategory
  risk: RiskLevel
  country?: string
  /** Présent dans la base d'attribution de l'outil (visible par l'enquêteur). */
  known: boolean
  description: string
  compliance?: Compliance
}

export interface CategoryMeta {
  label: string
  color: string
  icon: string
  risk: RiskLevel
}

export const CATEGORY: Record<EntityCategory, CategoryMeta> = {
  exchange: { label: 'Exchange centralisé', color: '#22d3ee', icon: 'Landmark', risk: 'low' },
  instant_exchanger: { label: 'Échangeur instantané', color: '#38bdf8', icon: 'Repeat', risk: 'high' },
  mixer: { label: 'Mixeur', color: '#f43f5e', icon: 'Blend', risk: 'severe' },
  coinjoin: { label: 'Coordinateur CoinJoin', color: '#fb7185', icon: 'Shuffle', risk: 'high' },
  privacy_pool: { label: 'Pool de confidentialité', color: '#e11d48', icon: 'EyeOff', risk: 'severe' },
  bridge: { label: 'Bridge inter-chaînes', color: '#a78bfa', icon: 'Waypoints', risk: 'medium' },
  dex: { label: 'Exchange décentralisé', color: '#818cf8', icon: 'ArrowLeftRight', risk: 'low' },
  defi: { label: 'Protocole DeFi', color: '#6366f1', icon: 'Boxes', risk: 'low' },
  darknet: { label: 'Marché darknet', color: '#dc2626', icon: 'Skull', risk: 'severe' },
  ransomware: { label: 'Rançongiciel', color: '#b91c1c', icon: 'Lock', risk: 'severe' },
  scam: { label: 'Escroquerie', color: '#f97316', icon: 'TriangleAlert', risk: 'severe' },
  sanctioned: { label: 'Entité sanctionnée', color: '#991b1b', icon: 'Ban', risk: 'severe' },
  gambling: { label: 'Jeux d\'argent', color: '#eab308', icon: 'Dices', risk: 'medium' },
  p2p: { label: 'Plateforme P2P', color: '#14b8a6', icon: 'Users', risk: 'medium' },
  merchant: { label: 'Commerçant', color: '#10b981', icon: 'ShoppingBag', risk: 'low' },
  mining: { label: 'Pool de minage', color: '#84cc16', icon: 'Pickaxe', risk: 'low' },
  hack: { label: 'Piratage', color: '#ef4444', icon: 'Bug', risk: 'severe' },
  otc: { label: 'Courtier OTC', color: '#0ea5e9', icon: 'Briefcase', risk: 'medium' },
  wallet_service: { label: 'Service de portefeuille', color: '#64748b', icon: 'Wallet', risk: 'low' },
  token_issuer: { label: 'Émetteur de stablecoin', color: '#26a17b', icon: 'BadgeDollarSign', risk: 'low' },
  atm: { label: 'DAB crypto (distributeur)', color: '#f59e0b', icon: 'Banknote', risk: 'medium' },
  nft_marketplace: { label: 'Place de marché NFT', color: '#c084fc', icon: 'Image', risk: 'low' },
  victim: { label: 'Victime', color: '#4ade80', icon: 'HeartHandshake', risk: 'low' },
  suspect: { label: 'Suspect', color: '#f472b6', icon: 'UserX', risk: 'high' },
  individual: { label: 'Particulier', color: '#94a3b8', icon: 'User', risk: 'low' },
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; score: number }> = {
  low: { label: 'Faible', color: '#34d399', score: 10 },
  medium: { label: 'Moyen', color: '#facc15', score: 45 },
  high: { label: 'Élevé', color: '#fb923c', score: 75 },
  severe: { label: 'Sévère', color: '#f43f5e', score: 95 },
}

export const COOPERATION_LABEL: Record<Cooperation, string> = {
  direct: 'Réquisition directe (prestataire établi en France)',
  voluntary: 'Coopération volontaire (portail forces de l\'ordre)',
  eio: 'Décision d\'enquête européenne (DEE)',
  mlat: 'Demande d\'entraide pénale internationale',
  none: 'Aucune coopération connue',
}

type Template = Omit<Entity, 'id' | 'known'> & { known?: boolean }

export const ENTITY_CATALOG: Record<string, Template> = {
  // ── Exchanges ────────────────────────────────────────────────────────────
  coinhouse: {
    name: 'Coinhouse', category: 'exchange', risk: 'low', country: 'France',
    description: 'Plateforme française, première à avoir été enregistrée PSAN auprès de l\'AMF (2020). KYC complet.',
    compliance: { contact: 'Service conformité de Coinhouse (réquisition judiciaire)', cooperation: 'direct', responseDays: [3, 10], canFreeze: true, kyc: 'renforcé', regulator: 'AMF / ACPR' },
  },
  binance: {
    name: 'Binance', category: 'exchange', risk: 'low', country: 'International',
    description: 'Premier exchange mondial en volume, réparti entre de nombreuses entités locales. Dispose d\'un portail dédié aux demandes des forces de l\'ordre.',
    compliance: { contact: 'Portail des demandes des forces de l\'ordre de Binance', portal: 'Portail LE Binance', cooperation: 'voluntary', responseDays: [5, 15], canFreeze: true, kyc: 'standard', notes: 'Les réquisitions françaises passent par le portail ; gel possible sur demande motivée.' },
  },
  coinbase: {
    name: 'Coinbase', category: 'exchange', risk: 'low', country: 'États-Unis',
    description: 'Exchange américain coté en bourse. Ses clients européens relèvent d\'une entité agréée MiCA au Luxembourg.',
    compliance: { contact: 'Portail des demandes des forces de l\'ordre de Coinbase', portal: 'Portail LE Coinbase', cooperation: 'voluntary', responseDays: [5, 20], canFreeze: true, kyc: 'standard', notes: 'Demandes déposées sur le portail ; les relevés complets d\'un client européen peuvent nécessiter une DEE.' },
  },
  kraken: {
    name: 'Kraken', category: 'exchange', risk: 'low', country: 'États-Unis',
    description: 'Exchange américain fondé en 2011. Ses clients européens relèvent d\'une entité agréée MiCA en Irlande.',
    compliance: { contact: 'Service des demandes des forces de l\'ordre de Kraken', cooperation: 'voluntary', responseDays: [7, 25], canFreeze: true, kyc: 'standard' },
  },
  bitstamp: {
    name: 'Bitstamp', category: 'exchange', risk: 'low', country: 'Luxembourg',
    description: 'Exchange historique (fondé en 2011), agréé dans l\'Union européenne.',
    compliance: { contact: 'Service conformité de Bitstamp', cooperation: 'eio', responseDays: [15, 45], canFreeze: true, kyc: 'standard', regulator: 'CSSF (Luxembourg)', notes: 'Coopère volontairement sur les données de base ; DEE recommandée pour les relevés complets.' },
  },
  swissborg: {
    name: 'SwissBorg', category: 'exchange', risk: 'low', country: 'Suisse',
    description: 'Application d\'investissement en crypto-actifs basée à Lausanne.',
    compliance: { contact: 'Service juridique de SwissBorg', cooperation: 'mlat', responseDays: [60, 180], canFreeze: true, kyc: 'renforcé', regulator: 'Surveillance LBA (Suisse)', notes: 'Entraide pénale avec la Suisse nécessaire.' },
  },
  okx: {
    name: 'OKX', category: 'exchange', risk: 'low', country: 'Seychelles',
    description: 'Exchange mondial à fort volume, très utilisé pour l\'USDT sur Tron.',
    compliance: { contact: 'Portail des demandes des forces de l\'ordre d\'OKX', portal: 'Portail LE OKX', cooperation: 'voluntary', responseDays: [10, 30], canFreeze: true, kyc: 'standard' },
  },
  // Fictif : profil d'exchange offshore peu coopératif.
  huobex: {
    name: 'Huobex', category: 'exchange', risk: 'medium', country: 'Seychelles',
    description: 'Exchange offshore (fictif), KYC allégé sous un certain seuil de retrait.',
    compliance: { contact: 'support@huobex.example', cooperation: 'voluntary', responseDays: [20, 90], canFreeze: false, kyc: 'faible', notes: 'Réponses irrégulières, données KYC parfois incomplètes.' },
  },
  garantex: {
    name: 'Garantex', category: 'sanctioned', risk: 'severe', country: 'Russie',
    description: 'Exchange russe sanctionné par l\'OFAC (avril 2022), plaque tournante du blanchiment. Domaines saisis en mars 2025 ; activité reprise sous le nom Grinex.',
    compliance: { contact: '—', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun', notes: 'Aucune coopération. Exposition = signal fort à signaler (TRACFIN, partenaires).' },
  },

  // ── Échangeurs instantanés / OTC / P2P ───────────────────────────────────
  changenow: {
    name: 'ChangeNOW', category: 'instant_exchanger', risk: 'high',
    description: 'Échangeur instantané sans compte : on dépose un actif, on reçoit un autre actif sur la chaîne de son choix.',
    compliance: { contact: 'Service conformité de ChangeNOW', cooperation: 'voluntary', responseDays: [7, 30], canFreeze: false, kyc: 'aucun', notes: 'Peut communiquer les données d\'une commande (adresse de destination, données techniques) si on fournit le hash de dépôt.' },
  },
  exch: {
    name: 'eXch', category: 'instant_exchanger', risk: 'high',
    description: 'Échangeur instantané sans KYC, acceptant notamment le XMR. Fermé en avril 2025 ; infrastructure saisie par les autorités allemandes.',
    compliance: { contact: '—', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun' },
  },
  // Fictif : courtier OTC.
  satsdesk: {
    name: 'SatsDesk OTC', category: 'otc', risk: 'medium', country: 'Hong Kong',
    description: 'Courtier de gré à gré (fictif), gros volumes USDT ↔ espèces.',
    compliance: { contact: 'kyc@satsdesk.example', cooperation: 'mlat', responseDays: [60, 180], canFreeze: false, kyc: 'faible' },
  },
  hodlhodl: {
    name: 'Hodl Hodl', category: 'p2p', risk: 'medium',
    description: 'Place de marché P2P non-custodial, sans KYC, avec séquestre (escrow) multisignature.',
    compliance: { contact: 'Support de Hodl Hodl', cooperation: 'voluntary', responseDays: [15, 60], canFreeze: false, kyc: 'aucun', notes: 'Ne détient pas les fonds : données limitées aux annonces et aux échanges entre utilisateurs.' },
  },

  // ── Confidentialité ──────────────────────────────────────────────────────
  sinbad: {
    name: 'Sinbad', category: 'mixer', risk: 'severe',
    description: 'Mixeur centralisé (custodial), successeur de Blender.io : mélange les fonds avec ceux d\'autres utilisateurs et restitue après un délai, moins une commission. Sanctionné par l\'OFAC et saisi en novembre 2023.',
  },
  tornado: {
    name: 'Tornado Cash', category: 'privacy_pool', risk: 'severe',
    description: 'Pool de confidentialité non-custodial sur Ethereum (dénominations fixes 0,1 / 1 / 10 / 100 ETH, preuves à divulgation nulle). Sanctionné par l\'OFAC d\'août 2022 à mars 2025.',
  },
  wasabi: {
    name: 'zkSNACKs', category: 'coinjoin', risk: 'high',
    description: 'Coordinateur CoinJoin de Wasabi Wallet, opéré par zkSNACKs jusqu\'en juin 2024 : transactions collaboratives à sorties de montant égal, frais de coordination prélevés dans la transaction.',
  },

  // ── DeFi / bridges ───────────────────────────────────────────────────────
  uniswap: { name: 'Uniswap', category: 'dex', risk: 'low', description: 'DEX à teneur de marché automatisé (AMM) sur Ethereum.' },
  pancakeswap: { name: 'PancakeSwap', category: 'dex', risk: 'low', description: 'DEX AMM sur BNB Smart Chain.' },
  sunswap: { name: 'SunSwap', category: 'dex', risk: 'low', description: 'DEX AMM sur Tron.' },
  raydium: { name: 'Raydium', category: 'dex', risk: 'low', description: 'DEX AMM sur Solana, où sont lancés la plupart des nouveaux jetons.' },
  // Fictif : bridge générique qui sert à enseigner la mécanique commune aux
  // bridges de liquidité (aucun bridge réel ne couvre toutes ces chaînes).
  arcbridge: {
    name: 'ArcBridge', category: 'bridge', risk: 'medium',
    description: 'Bridge de liquidité inter-chaînes (fictif) : l\'actif déposé sur la chaîne source est restitué sur la chaîne de destination, au besoin converti dans l\'actif natif de celle-ci (ETH → BNB par exemple), à partir des réserves du bridge. Les événements publient la chaîne cible, le destinataire et un nonce qui relie les deux transactions.',
  },
  // Fictif : protocole victime d'un piratage dans les scénarios.
  lendora: { name: 'Lendora', category: 'defi', risk: 'low', description: 'Protocole de prêt décentralisé (fictif).' },

  // ── Illicite ─────────────────────────────────────────────────────────────
  hydra: { name: 'Hydra Market', category: 'darknet', risk: 'severe', description: 'Marché du darknet russophone (stupéfiants, faux documents, blanchiment), saisi en avril 2022 par les autorités allemandes. Portefeuilles de séquestre centralisés.' },
  lockbit: { name: 'LockBit', category: 'ransomware', risk: 'severe', description: 'Groupe de rançongiciel en mode RaaS (affiliés + opérateurs), perturbé en février 2024 par l\'opération Cronos.' },
  aurora: { name: 'AuroraTrade (faux)', category: 'scam', risk: 'severe', description: 'Fausse plateforme d\'investissement (fictive) utilisée dans des escroqueries sentimentales.' },

  // ── Divers ───────────────────────────────────────────────────────────────
  orbit: { name: 'OrbitCasino', category: 'gambling', risk: 'medium', description: 'Casino en ligne crypto (fictif), KYC absent.' },
  mullvad: { name: 'Mullvad VPN', category: 'merchant', risk: 'low', description: 'Fournisseur VPN acceptant le bitcoin et le monero.' },
  cardhub: { name: 'CardHub', category: 'merchant', risk: 'medium', description: 'Vente de cartes cadeaux contre crypto (fictif).' },
  foundry: { name: 'Foundry USA', category: 'mining', risk: 'low', description: 'Pool de minage Bitcoin.' },
  tether: {
    name: 'Tether', category: 'token_issuer', risk: 'low',
    description: 'Émetteur du stablecoin USDT. Capable de geler (blacklister) une adresse sur demande des autorités.',
    compliance: { contact: 'Portail des forces de l\'ordre de Tether', cooperation: 'voluntary', responseDays: [1, 7], canFreeze: true, kyc: 'aucun', notes: 'Le gel d\'USDT sur une adresse est rapide et très efficace : à demander dès l\'identification.' },
  },

  // ── Espèces, Lightning, TON, NFT, L2 ─────────────────────────────────────
  // Fictif : exploitant de DAB crypto en France.
  cryptoguichet: {
    name: 'CryptoGuichet', category: 'atm', risk: 'medium', country: 'France',
    description: 'Exploitant (fictif) d\'un réseau de distributeurs automatiques de crypto-actifs (DAB crypto) installés chez des buralistes et dans des centres commerciaux : achat de bitcoin ou d\'USDT contre espèces, et vente contre espèces sur certains appareils. Les achats partent d\'un portefeuille chaud unique de l\'exploitant ; chaque vente génère une adresse de réception propre au ticket.',
    compliance: {
      contact: 'Service conformité de CryptoGuichet (réquisition judiciaire)', cooperation: 'direct', responseDays: [2, 8], canFreeze: false, kyc: 'standard', regulator: 'AMF (enregistrement PSAN)',
      notes: 'Seuils internes de l\'exploitant (fictifs) : numéro de téléphone vérifié par SMS dès la première opération ; pièce d\'identité et selfie au-delà de 1 000 € par opération ou en cumul glissant sur 30 jours ; plafond de 5 000 € par jour. Données disponibles sur réquisition : numéro de téléphone, identité le cas échéant, ticket (montant en espèces, cours appliqué, adresse de destination), identifiant et emplacement de l\'appareil, vidéosurveillance de l\'appareil (conservation courte, environ 30 jours : à demander sans délai).',
    },
  },
  // Fictif : portefeuille Lightning custodial.
  voltpocket: {
    name: 'VoltPocket', category: 'wallet_service', risk: 'medium', country: 'Lituanie',
    description: 'Portefeuille Lightning custodial (fictif) : l\'utilisateur dépose des bitcoins on-chain sur une adresse fournie par le service, puis paie et reçoit des factures Lightning. Les paiements Lightning entre clients ou vers d\'autres nœuds n\'apparaissent pas sur la blockchain : seuls les dépôts et les retraits on-chain sont visibles. Le service, lui, enregistre chaque paiement (montant, date, facture, compte).',
    compliance: { contact: 'Service conformité de VoltPocket', cooperation: 'eio', responseDays: [15, 45], canFreeze: true, kyc: 'faible', regulator: 'Enregistrement local (Lituanie)', notes: 'KYC allégé sous un plafond de solde. Sur DEE : identifiants du compte, adresses IP, historique des paiements Lightning (factures, hash de paiement), dépôts et retraits on-chain.' },
  },
  // Fictif : fournisseur de liquidité Lightning.
  lumen_lsp: {
    name: 'Lumen LSP', category: 'wallet_service', risk: 'low', country: 'Allemagne',
    description: 'Fournisseur de services Lightning (LSP, fictif) : ouvre et maintient des canaux avec les portefeuilles mobiles non custodiaux de ses clients. Il voit les canaux qu\'il partage et les paiements qu\'il route, mais ne détient pas les fonds de ses clients.',
    compliance: { contact: 'Service juridique de Lumen LSP', cooperation: 'eio', responseDays: [20, 60], canFreeze: false, kyc: 'aucun', regulator: 'BaFin (déclaration)', notes: 'Pas de compte client : données limitées aux canaux (financement, dates d\'ouverture et de fermeture, identifiant de nœud du client) et éventuellement aux adresses IP de connexion.' },
  },
  // Fictif : portefeuille TON custodial intégré à une messagerie.
  tonpocket: {
    name: 'TonPocket', category: 'wallet_service', risk: 'medium', country: 'Émirats arabes unis',
    description: 'Portefeuille custodial (fictif) intégré à la messagerie Telegram sous forme de mini-application : TON et USDT (jetton) achetés, envoyés et reçus depuis une conversation. Les dépôts arrivent sur une adresse partagée du service et le client est identifié par le commentaire (memo) de la transaction ; les transferts entre utilisateurs du service restent internes (invisibles on-chain).',
    compliance: { contact: 'Service conformité de TonPocket', cooperation: 'voluntary', responseDays: [10, 40], canFreeze: true, kyc: 'faible', notes: 'Identifiant et pseudonyme Telegram du compte, numéro de téléphone associé, historique interne. KYC complet seulement au-delà d\'un plafond.' },
  },
  // Fictif : place de marché NFT.
  mosaique: {
    name: 'Mosaïque Market', category: 'nft_marketplace', risk: 'low', country: 'France',
    description: 'Place de marché NFT (fictive) sur Ethereum et Base : l\'acheteur paie le contrat de la place de marché, qui reverse le prix au vendeur moins une commission et des redevances au créateur. Des ventes croisées entre portefeuilles d\'une même personne (wash trading) peuvent servir à justifier l\'origine de fonds.',
    compliance: { contact: 'Service conformité de Mosaïque Market', cooperation: 'direct', responseDays: [5, 15], canFreeze: false, kyc: 'faible', regulator: 'AMF (enregistrement PSAN)', notes: 'Compte facultatif : données souvent limitées à l\'adresse e-mail, aux adresses IP et aux portefeuilles connectés.' },
  },
  // Fictif : plateforme de lancement de jetons.
  moonpad: {
    name: 'MoonPad', category: 'defi', risk: 'medium',
    description: 'Plateforme de lancement de jetons (fictive) : n\'importe qui crée un jeton en quelques clics, vendu sur une courbe de prix automatique jusqu\'à son introduction sur un DEX. Très utilisée pour les memecoins, et donc pour les « rug pulls » où le créateur revend tout d\'un coup.',
  },
  // Fictif : modèle de fausse plateforme de rendement (Ponzi).
  yieldnova: {
    name: 'YieldNova (faux)', category: 'scam', risk: 'severe', known: false,
    description: 'Fausse plateforme de rendement (fictive) promettant 1 à 3 % par jour sur des dépôts en USDT : les « intérêts » des premiers investisseurs sont payés avec les dépôts des suivants (schéma de Ponzi), jusqu\'à la fermeture du site et la disparition des fonds.',
  },
  // Bridges canoniques officiels des rollups (infrastructure réelle, neutre).
  arbitrum_bridge: {
    name: 'Arbitrum Bridge', category: 'bridge', risk: 'low',
    description: 'Bridge canonique officiel d\'Arbitrum One (rollup optimiste d\'Ethereum). Dépôt Ethereum → Arbitrum : crédité sur le L2 en une dizaine de minutes. Retrait Arbitrum → Ethereum : initié sur le L2, exécutable sur Ethereum seulement après la période de contestation d\'environ 7 jours. Même adresse 0x de part et d\'autre si l\'utilisateur ne choisit pas un autre destinataire.',
  },
  base_bridge: {
    name: 'Base Bridge', category: 'bridge', risk: 'low',
    description: 'Bridge canonique officiel de Base (rollup optimiste d\'Ethereum, OP Stack). Dépôt Ethereum → Base : crédité sur le L2 en quelques minutes. Retrait Base → Ethereum : initié sur Base, prouvé puis finalisé sur Ethereum après la période de contestation d\'environ 7 jours. Même adresse 0x de part et d\'autre si l\'utilisateur ne choisit pas un autre destinataire.',
  },
}
