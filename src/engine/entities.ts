// Catalogue d'entités FICTIVES. Les noms sont inventés : ils imitent des
// typologies réelles (exchange régulé, échangeur sans KYC, mixeur…) sans
// désigner d'acteur existant.

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
  coinvault: {
    name: 'Coinvault', category: 'exchange', risk: 'low', country: 'France',
    description: 'Plateforme française enregistrée auprès de l\'AMF, agréée PSCA (MiCA). KYC complet.',
    compliance: { contact: 'requisitions@coinvault.example', cooperation: 'direct', responseDays: [3, 10], canFreeze: true, kyc: 'renforcé', regulator: 'AMF / ACPR' },
  },
  binova: {
    name: 'Binova', category: 'exchange', risk: 'low', country: 'Émirats arabes unis',
    description: 'Exchange mondial à très fort volume. Dispose d\'un portail dédié aux forces de l\'ordre.',
    compliance: { contact: 'le-portal.binova.example', portal: 'Portail LE Binova', cooperation: 'voluntary', responseDays: [5, 15], canFreeze: true, kyc: 'standard', notes: 'Répond aux réquisitions françaises via son portail ; gel possible sur demande motivée.' },
  },
  nordex: {
    name: 'Nordex', category: 'exchange', risk: 'low', country: 'Estonie',
    description: 'Exchange européen agréé PSCA dans un État membre de l\'UE.',
    compliance: { contact: 'compliance@nordex.example', cooperation: 'eio', responseDays: [15, 45], canFreeze: true, kyc: 'standard', regulator: 'FIU Estonie', notes: 'Coopère volontairement sur les données de base ; DEE recommandée pour les relevés complets.' },
  },
  helvetix: {
    name: 'Helvetix', category: 'exchange', risk: 'low', country: 'Suisse',
    description: 'Exchange suisse supervisé.',
    compliance: { contact: 'legal@helvetix.example', cooperation: 'mlat', responseDays: [60, 180], canFreeze: true, kyc: 'renforcé', regulator: 'FINMA', notes: 'Entraide pénale avec la Suisse nécessaire.' },
  },
  kaizen: {
    name: 'Kaizen Exchange', category: 'exchange', risk: 'low', country: 'Singapour',
    description: 'Exchange asiatique, forte liquidité sur les stablecoins TRON.',
    compliance: { contact: 'lawenforcement@kaizen.example', cooperation: 'voluntary', responseDays: [10, 30], canFreeze: true, kyc: 'standard' },
  },
  huobex: {
    name: 'Huobex', category: 'exchange', risk: 'medium', country: 'Seychelles',
    description: 'Exchange offshore, KYC allégé sous un certain seuil de retrait.',
    compliance: { contact: 'support@huobex.example', cooperation: 'voluntary', responseDays: [20, 90], canFreeze: false, kyc: 'faible', notes: 'Réponses irrégulières, données KYC parfois incomplètes.' },
  },
  grantis: {
    name: 'Grantis', category: 'sanctioned', risk: 'severe', country: 'Russie',
    description: 'Exchange sanctionné (OFAC / UE). Plaque tournante du blanchiment.',
    compliance: { contact: '—', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun', notes: 'Aucune coopération. Exposition = signal fort à signaler (TRACFIN, partenaires).' },
  },

  // ── Échangeurs instantanés / OTC / P2P ───────────────────────────────────
  ocelot: {
    name: 'Ocelot Swap', category: 'instant_exchanger', risk: 'high', country: 'Seychelles',
    description: 'Échangeur instantané sans compte : on dépose un actif, on reçoit un autre actif sur la chaîne de son choix.',
    compliance: { contact: 'abuse@ocelot.example', cooperation: 'voluntary', responseDays: [7, 30], canFreeze: false, kyc: 'aucun', notes: 'Peut fournir l\'adresse de destination et l\'IP de la commande si on fournit le hash de dépôt.' },
  },
  flashx: {
    name: 'FlashX', category: 'instant_exchanger', risk: 'high', country: 'Inconnu',
    description: 'Service de swap express, accepte BTC, ETH, XMR, TRX.',
    compliance: { contact: 'support@flashx.example', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun' },
  },
  satsdesk: {
    name: 'SatsDesk OTC', category: 'otc', risk: 'medium', country: 'Hong Kong',
    description: 'Courtier de gré à gré, gros volumes USDT ↔ espèces.',
    compliance: { contact: 'kyc@satsdesk.example', cooperation: 'mlat', responseDays: [60, 180], canFreeze: false, kyc: 'faible' },
  },
  localsats: {
    name: 'LocalSats', category: 'p2p', risk: 'medium', country: 'Inconnu',
    description: 'Place de marché P2P avec séquestre (escrow) multisignature.',
    compliance: { contact: 'legal@localsats.example', cooperation: 'voluntary', responseDays: [15, 60], canFreeze: false, kyc: 'faible' },
  },

  // ── Confidentialité ──────────────────────────────────────────────────────
  nebula: {
    name: 'Nebula Mixer', category: 'mixer', risk: 'severe', country: 'Inconnu',
    description: 'Mixeur centralisé (custodial) : mélange les fonds avec ceux d\'autres utilisateurs et restitue après un délai, moins une commission.',
  },
  cyclone: {
    name: 'Cyclone Cash', category: 'privacy_pool', risk: 'severe', country: '—',
    description: 'Pool de confidentialité non-custodial sur Ethereum (dénominations fixes 0,1 / 1 / 10 / 100 ETH, preuves à divulgation nulle). Sanctionné.',
  },
  whirl: {
    name: 'Whirl Coordinator', category: 'coinjoin', risk: 'high', country: '—',
    description: 'Coordinateur CoinJoin Bitcoin : transactions collaboratives à sorties de montant égal.',
  },

  // ── DeFi / bridges ───────────────────────────────────────────────────────
  omniswap: { name: 'OmniSwap', category: 'dex', risk: 'low', description: 'DEX à teneur de marché automatisé (AMM) sur Ethereum.' },
  syrupswap: { name: 'SyrupSwap', category: 'dex', risk: 'low', description: 'DEX AMM sur BNB Smart Chain.' },
  helioswap: { name: 'HelioSwap', category: 'dex', risk: 'low', description: 'DEX AMM sur Tron.' },
  arcbridge: {
    name: 'ArcBridge', category: 'bridge', risk: 'medium',
    description: 'Bridge de liquidité inter-chaînes : l\'actif déposé sur la chaîne source est restitué sur la chaîne de destination, au besoin converti dans l\'actif natif de celle-ci (ETH → BNB par exemple), à partir des réserves du bridge. Les événements publient la chaîne cible, le destinataire et un nonce qui relie les deux transactions.',
  },
  lendora: { name: 'Lendora', category: 'defi', risk: 'low', description: 'Protocole de prêt décentralisé.' },

  // ── Illicite ─────────────────────────────────────────────────────────────
  obsidian: { name: 'Obsidian Market', category: 'darknet', risk: 'severe', description: 'Marché du darknet (stupéfiants, faux documents). Portefeuilles de séquestre centralisés.' },
  lockfang: { name: 'LockFang', category: 'ransomware', risk: 'severe', description: 'Groupe de rançongiciel en mode RaaS (affiliés + opérateurs).' },
  aurora: { name: 'AuroraTrade (faux)', category: 'scam', risk: 'severe', description: 'Fausse plateforme d\'investissement utilisée dans des escroqueries sentimentales.' },

  // ── Divers ───────────────────────────────────────────────────────────────
  orbit: { name: 'OrbitCasino', category: 'gambling', risk: 'medium', description: 'Casino en ligne crypto, KYC absent.' },
  shieldvpn: { name: 'ShieldVPN', category: 'merchant', risk: 'low', description: 'Fournisseur VPN acceptant les cryptos.' },
  cardhub: { name: 'CardHub', category: 'merchant', risk: 'medium', description: 'Vente de cartes cadeaux contre crypto.' },
  deeppool: { name: 'DeepPool', category: 'mining', risk: 'low', description: 'Pool de minage Bitcoin.' },
  tether: {
    name: 'Émetteur USDT', category: 'token_issuer', risk: 'low',
    description: 'Émetteur du stablecoin USDT. Capable de geler (blacklister) une adresse sur demande des autorités.',
    compliance: { contact: 'Portail forces de l\'ordre de l\'émetteur', cooperation: 'voluntary', responseDays: [1, 7], canFreeze: true, kyc: 'aucun', notes: 'Le gel d\'USDT sur une adresse est rapide et très efficace : à demander dès l\'identification.' },
  },
}
