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
  | 'otc' | 'wallet_service' | 'token_issuer'
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
}
