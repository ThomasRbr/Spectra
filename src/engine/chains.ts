export type ChainId = 'btc' | 'ltc' | 'eth' | 'bsc' | 'tron' | 'xrp' | 'sol' | 'xmr' | 'ton' | 'arb' | 'base'
export type ChainModel = 'utxo' | 'account' | 'opaque'
export type AssetId =
  | 'BTC' | 'LTC' | 'ETH' | 'BNB' | 'TRX' | 'XRP' | 'SOL' | 'XMR' | 'TON'
  | 'USDT' | 'USDC' | 'DAI' | 'WBTC'

export interface ChainMeta {
  id: ChainId
  name: string
  short: string
  native: AssetId
  model: ChainModel
  color: string
  /** Temps de bloc moyen en secondes. */
  blockTime: number
  baseHeight: number
  explorer: string
  tokens: AssetId[]
  tokenStandard?: string
}

export const CHAINS: Record<ChainId, ChainMeta> = {
  btc: { id: 'btc', name: 'Bitcoin', short: 'BTC', native: 'BTC', model: 'utxo', color: '#f7931a', blockTime: 600, baseHeight: 840000, explorer: 'mempool', tokens: [] },
  ltc: { id: 'ltc', name: 'Litecoin', short: 'LTC', native: 'LTC', model: 'utxo', color: '#a6b3c6', blockTime: 150, baseHeight: 2650000, explorer: 'blockchair', tokens: [] },
  eth: { id: 'eth', name: 'Ethereum', short: 'ETH', native: 'ETH', model: 'account', color: '#8c9eff', blockTime: 12, baseHeight: 19500000, explorer: 'etherscan', tokens: ['USDT', 'USDC', 'DAI', 'WBTC'], tokenStandard: 'ERC-20' },
  bsc: { id: 'bsc', name: 'BNB Smart Chain', short: 'BSC', native: 'BNB', model: 'account', color: '#f3ba2f', blockTime: 3, baseHeight: 37000000, explorer: 'bscscan', tokens: ['USDT', 'USDC'], tokenStandard: 'BEP-20' },
  tron: { id: 'tron', name: 'Tron', short: 'TRX', native: 'TRX', model: 'account', color: '#ff3b3b', blockTime: 3, baseHeight: 60000000, explorer: 'tronscan', tokens: ['USDT', 'USDC'], tokenStandard: 'TRC-20' },
  xrp: { id: 'xrp', name: 'XRP Ledger', short: 'XRP', native: 'XRP', model: 'account', color: '#23c4f8', blockTime: 4, baseHeight: 87000000, explorer: 'xrpscan', tokens: [] },
  sol: { id: 'sol', name: 'Solana', short: 'SOL', native: 'SOL', model: 'account', color: '#14f195', blockTime: 0.4, baseHeight: 260000000, explorer: 'solscan', tokens: ['USDT', 'USDC'], tokenStandard: 'SPL' },
  xmr: { id: 'xmr', name: 'Monero', short: 'XMR', native: 'XMR', model: 'opaque', color: '#ff6600', blockTime: 120, baseHeight: 3150000, explorer: 'xmrchain', tokens: [] },
  // TON : hauteur = numéro de bloc de la masterchain ; jetons au standard Jetton (TEP-74).
  ton: { id: 'ton', name: 'TON', short: 'TON', native: 'TON', model: 'account', color: '#0098ea', blockTime: 5, baseHeight: 36000000, explorer: 'tonviewer', tokens: ['USDT'], tokenStandard: 'Jetton' },
  // Rollups optimistes d'Ethereum : mêmes adresses 0x, gas payé en ETH.
  arb: { id: 'arb', name: 'Arbitrum One', short: 'ARB', native: 'ETH', model: 'account', color: '#28a0f0', blockTime: 0.25, baseHeight: 170000000, explorer: 'arbiscan', tokens: ['USDT', 'USDC'], tokenStandard: 'ERC-20' },
  base: { id: 'base', name: 'Base', short: 'BASE', native: 'ETH', model: 'account', color: '#0052ff', blockTime: 2, baseHeight: 9000000, explorer: 'basescan', tokens: ['USDC', 'USDT'], tokenStandard: 'ERC-20' },
}

/** Chaînes compatibles EVM : une même clé privée donne la même adresse 0x sur chacune. */
export const EVM_CHAINS: readonly ChainId[] = ['eth', 'bsc', 'arb', 'base']

export function isEvm(chain: ChainId): boolean {
  return EVM_CHAINS.includes(chain)
}

/** Taux de change figé EUR → USD (espèces des DAB crypto, préjudices en euros). */
export const EUR_USD = 1.08

export interface AssetMeta {
  id: AssetId
  name: string
  usd: number
  color: string
  decimals: number
  stable?: boolean
}

// Cours fictifs mais réalistes, figés pour garder les exercices déterministes.
export const ASSETS: Record<AssetId, AssetMeta> = {
  BTC: { id: 'BTC', name: 'Bitcoin', usd: 67250, color: '#f7931a', decimals: 8 },
  LTC: { id: 'LTC', name: 'Litecoin', usd: 84.6, color: '#a6b3c6', decimals: 8 },
  ETH: { id: 'ETH', name: 'Ether', usd: 3185, color: '#8c9eff', decimals: 6 },
  BNB: { id: 'BNB', name: 'BNB', usd: 583, color: '#f3ba2f', decimals: 6 },
  TRX: { id: 'TRX', name: 'Tronix', usd: 0.162, color: '#ff3b3b', decimals: 2 },
  XRP: { id: 'XRP', name: 'XRP', usd: 0.58, color: '#23c4f8', decimals: 2 },
  SOL: { id: 'SOL', name: 'Solana', usd: 158, color: '#14f195', decimals: 4 },
  XMR: { id: 'XMR', name: 'Monero', usd: 162, color: '#ff6600', decimals: 6 },
  TON: { id: 'TON', name: 'Toncoin', usd: 5.4, color: '#0098ea', decimals: 4 },
  USDT: { id: 'USDT', name: 'Tether USD', usd: 1, color: '#26a17b', decimals: 2, stable: true },
  USDC: { id: 'USDC', name: 'USD Coin', usd: 1, color: '#2775ca', decimals: 2, stable: true },
  DAI: { id: 'DAI', name: 'Dai', usd: 1, color: '#f5ac37', decimals: 2, stable: true },
  WBTC: { id: 'WBTC', name: 'Wrapped BTC', usd: 67250, color: '#e0883a', decimals: 8 },
}

export function usd(asset: AssetId, value: number): number {
  return ASSETS[asset].usd * value
}

export function fromUsd(asset: AssetId, amountUsd: number): number {
  return amountUsd / ASSETS[asset].usd
}

/** Arrondit une quantité à la précision de l'actif. */
export function roundAsset(asset: AssetId, value: number): number {
  const f = Math.pow(10, ASSETS[asset].decimals)
  return Math.round(value * f) / f
}

export function fmtAsset(value: number, asset: AssetId, maxDecimals?: number): string {
  const d = maxDecimals ?? Math.min(ASSETS[asset].decimals, Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 8)
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 })} ${asset}`
}

export function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M$`
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k$`
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`
}
