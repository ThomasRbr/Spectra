// Logos officiels des chaînes et des entités réelles du catalogue, embarqués
// dans le build (aucun appel réseau). Sources : @web3icons/core (MIT) en
// variante « background » (logo sur fond de marque, carré plein) et
// simple-icons (CC0) pour Mullvad. Les marques restent la propriété de leurs
// détenteurs. Une entité sans logo embarqué reçoit une marque à initiales
// dans la couleur de sa catégorie (entityMark).
import { siMullvad } from 'simple-icons'
import oneinch from '@web3icons/core/svgs/exchanges/background/1inch.svg.js'
import aave from '@web3icons/core/svgs/tokens/background/AAVE.svg.js'
import mkr from '@web3icons/core/svgs/tokens/background/MKR.svg.js'
import usdc from '@web3icons/core/svgs/tokens/background/USDC.svg.js'
import binance from '@web3icons/core/svgs/exchanges/background/binance.svg.js'
import bitstamp from '@web3icons/core/svgs/exchanges/background/bitstamp.svg.js'
import coinbase from '@web3icons/core/svgs/exchanges/background/coinbase.svg.js'
import kraken from '@web3icons/core/svgs/exchanges/background/kraken.svg.js'
import okx from '@web3icons/core/svgs/exchanges/background/okx.svg.js'
import swissborg from '@web3icons/core/svgs/exchanges/background/swissborg.svg.js'
import uniswap from '@web3icons/core/svgs/exchanges/background/uniswap.svg.js'
import pancakeswap from '@web3icons/core/svgs/exchanges/background/pancake-swap.svg.js'
import ray from '@web3icons/core/svgs/tokens/background/RAY.svg.js'
import sun from '@web3icons/core/svgs/tokens/background/SUN.svg.js'
import torn from '@web3icons/core/svgs/tokens/background/TORN.svg.js'
import usdt from '@web3icons/core/svgs/tokens/background/USDT.svg.js'
import xmr from '@web3icons/core/svgs/tokens/background/XMR.svg.js'
import bitcoin from '@web3icons/core/svgs/networks/background/bitcoin.svg.js'
import litecoin from '@web3icons/core/svgs/networks/background/litecoin.svg.js'
import ethereum from '@web3icons/core/svgs/networks/background/ethereum.svg.js'
import bsc from '@web3icons/core/svgs/networks/background/binance-smart-chain.svg.js'
import tron from '@web3icons/core/svgs/networks/background/tron.svg.js'
import xrp from '@web3icons/core/svgs/networks/background/xrp.svg.js'
import solana from '@web3icons/core/svgs/networks/background/solana.svg.js'
import ton from '@web3icons/core/svgs/networks/background/ton.svg.js'
import arbitrum from '@web3icons/core/svgs/networks/background/arbitrum-one.svg.js'
import base from '@web3icons/core/svgs/networks/background/base.svg.js'
import cardano from '@web3icons/core/svgs/networks/background/cardano.svg.js'
import type { ChainId } from '../engine/chains'

const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** Glyphe simple-icons (24×24) posé sur un carré de la couleur de la marque. */
function onBrand(icon: { path: string; hex: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#${icon.hex}"/><path transform="translate(5 5) scale(0.5833)" fill="#fff" d="${icon.path}"/></svg>`
}

const ENTITY_LOGOS: Record<string, string> = {
  binance: uri(binance),
  bitstamp: uri(bitstamp),
  coinbase: uri(coinbase),
  kraken: uri(kraken),
  okx: uri(okx),
  swissborg: uri(swissborg),
  uniswap: uri(uniswap),
  pancakeswap: uri(pancakeswap),
  sunswap: uri(sun),
  raydium: uri(ray),
  tornado: uri(torn),
  tether: uri(usdt),
  mullvad: uri(onBrand(siMullvad)),
  arbitrum_bridge: uri(arbitrum),
  base_bridge: uri(base),
  aave: uri(aave),
  oneinch: uri(oneinch),
  // Circle et MakerDAO (Sky) sont identifiés par le logo de leur actif phare.
  circle: uri(usdc),
  makerdao: uri(mkr),
}

export const CHAIN_LOGOS: Record<ChainId, string> = {
  btc: uri(bitcoin),
  ltc: uri(litecoin),
  eth: uri(ethereum),
  bsc: uri(bsc),
  tron: uri(tron),
  xrp: uri(xrp),
  sol: uri(solana),
  xmr: uri(xmr),
  ton: uri(ton),
  arb: uri(arbitrum),
  base: uri(base),
  ada: uri(cardano),
}

/** Logo de l'entité du catalogue, si elle en a un. */
export function entityLogo(id: string | undefined): string | undefined {
  return id ? ENTITY_LOGOS[id] : undefined
}

/** Deux lettres pour la marque : « Hydra Market » → HM, « LockBit » → LB, « Coinhouse » → Co. */
export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').split(/[\s—–-]+/).filter(Boolean)
  const w = words[0] ?? '?'
  const inner = w.slice(1).match(/[A-Z]/)
  if (inner) return w[0].toUpperCase() + inner[0]
  if (words.length >= 2) return (w[0] + words[1][0]).toUpperCase()
  return w[0].toUpperCase() + (w[1] ?? '')
}

/** Marques dont la casse fait partie du nom. */
const MARK_TEXT: Record<string, string> = { exch: 'eX', wasabi: 'zk' }

const marks = new Map<string, string>()

/**
 * Logo de l'entité, ou à défaut une marque à initiales sur la couleur de sa
 * catégorie : chaque service reste reconnaissable d'un coup d'œil.
 */
export function entityMark(entity: { id: string; name: string }, color: string): string {
  const logo = ENTITY_LOGOS[entity.id]
  if (logo) return logo
  const key = `${entity.id}|${color}`
  let m = marks.get(key)
  if (!m) {
    const n = parseInt(color.slice(1), 16)
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
    const ink = lum > 0.6 ? '#0e1013' : '#ffffff'
    const t = (MARK_TEXT[entity.id] ?? initials(entity.name)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    m = uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${color}"/><text x="16" y="16.5" text-anchor="middle" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="${t.length > 1 ? 13 : 15}" font-weight="700" letter-spacing="-0.3" fill="${ink}">${t}</text></svg>`)
    marks.set(key, m)
  }
  return m
}
