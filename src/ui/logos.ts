// Logos officiels des chaînes et des entités réelles du catalogue, embarqués
// dans le build (aucun appel réseau). Sources : @web3icons/core (MIT) en
// variante « background » (logo sur fond de marque, carré plein) et
// simple-icons (CC0) pour Mullvad. Les marques restent la propriété de leurs
// détenteurs. Une entité sans logo garde l'icône de sa catégorie.
import { siMullvad } from 'simple-icons'
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
}

/** Logo de l'entité du catalogue, si elle en a un. */
export function entityLogo(id: string | undefined): string | undefined {
  return id ? ENTITY_LOGOS[id] : undefined
}
