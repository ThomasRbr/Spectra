// Lecture « explorateur » d'une transaction EVM : fonction appelée et données
// d'entrée encodées (ABI), journaux d'événements (logs), transactions
// internes, gas et nonce. Les données sont dérivées des transferts du monde :
// ce que l'enquêteur lirait sur Etherscan pour la même transaction.
import { CHAINS, type AssetId, type ChainId, isEvm } from './chains'
import { keccak256, selectorOf, topicOf } from './keccak'
import type { CallArg, EvmCall, Transfer, Tx, World } from './world'

// ── Contrats de référence ───────────────────────────────────────────────────

/** Adresses réelles des contrats de jetons les plus courants (les autres sont dérivées). */
const KNOWN_TOKENS: Partial<Record<ChainId, Partial<Record<AssetId, string>>>> = {
  eth: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    aWETH: '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8',
    aUSDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
  },
  bsc: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  tron: {
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  },
}

const TOKEN_ISSUER: Partial<Record<AssetId, string>> = { USDT: 'tether', USDC: 'circle', DAI: 'makerdao', WETH: 'weth', aWETH: 'aave', aUSDC: 'aave' }

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Chaînes dont les transactions portent des appels ABI (EVM et Tron, dont la TVM reprend l'ABI). */
export function hasAbi(chain: ChainId): boolean {
  return isEvm(chain) || chain === 'tron'
}

/** Contrat d'un jeton sur une chaîne (enregistré à la demande, sans tirage aléatoire). */
export function tokenContract(w: World, chain: ChainId, asset: AssetId): string {
  const known = KNOWN_TOKENS[chain]?.[asset]
  const addr = known ?? (chain === 'tron' ? 'T' + keccak256(`${chain}:${asset}`).slice(0, 33) : '0x' + keccak256(`token:${chain}:${asset}`).slice(0, 40))
  const name = asset === 'WETH' ? 'Wrapped Ether (WETH)' : `${asset} : contrat du jeton`
  const issuer = TOKEN_ISSUER[asset]
  if (issuer && !w.entities.has(issuer)) w.entity(issuer)
  return w.fixedAddr(chain, addr, { label: name, entity: issuer, contract: { name, type: asset === 'WETH' ? 'wrapper' : 'token', verified: true } })
}

/** Adresse nulle : origine des jetons créés (mint) et destination des jetons détruits (burn). */
export function nullAddress(w: World, chain: ChainId): string {
  return w.fixedAddr(chain, NULL_ADDRESS, { label: 'Adresse nulle (création / destruction de jetons)', tags: ['null'] })
}

export function isNull(w: World, id: string): boolean {
  return w.get(id).tags.includes('null')
}

/** Décimales on-chain d'un actif (≠ précision d'affichage) : 1 USDT = 10^6 unités sur Ethereum, 10^18 sur BSC. */
export function onchainDecimals(chain: ChainId, asset: AssetId): number {
  switch (asset) {
    case 'USDT':
    case 'USDC':
      return chain === 'bsc' ? 18 : 6
    case 'aUSDC':
      return 6
    case 'WBTC':
    case 'BTC':
    case 'LTC':
      return 8
    case 'TRX':
    case 'XRP':
    case 'ADA':
      return 6
    case 'SOL':
    case 'TON':
      return 9
    case 'XMR':
      return 12
    default:
      return 18
  }
}

/** Montant décimal → entier en unités de base (wei, unités de jeton), sans perte. */
export function toBaseUnits(value: number, decimals: number): bigint {
  const [int, frac = ''] = value.toFixed(Math.min(decimals, 12)).split('.')
  return BigInt(int + frac.padEnd(decimals, '0').slice(0, decimals))
}

export function fmtBaseUnits(v: bigint): string {
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// ── Fonctions connues (ABI) ─────────────────────────────────────────────────

export interface FnInfo {
  sig: string
  names: string[]
  /** Ce que fait la fonction, pour l'enquêteur. */
  help: string
}

const FN_LIST: FnInfo[] = [
  { sig: 'transfer(address,uint256)', names: ['to', 'value'], help: 'Transfert de jetons ERC-20 depuis le compte qui signe.' },
  { sig: 'approve(address,uint256)', names: ['spender', 'value'], help: 'Autorise `spender` à dépenser jusqu\'à `value` jetons du signataire, sans nouvelle signature. Une valeur maximale (2²⁵⁶−1) équivaut à une autorisation illimitée.' },
  { sig: 'transferFrom(address,address,uint256)', names: ['from', 'to', 'value'], help: 'Transfert exécuté par un tiers autorisé (approval) : le titulaire des jetons ne signe pas cette transaction.' },
  { sig: 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)', names: ['owner', 'spender', 'value', 'deadline', 'v', 'r', 's'], help: 'Autorisation signée hors chaîne (EIP-2612) puis publiée par n\'importe qui : le titulaire n\'a payé aucun gas et la signature ressemble à une simple connexion.' },
  { sig: 'setApprovalForAll(address,bool)', names: ['operator', 'approved'], help: 'Autorise `operator` à transférer TOUS les NFT de la collection détenus par le signataire.' },
  { sig: 'safeTransferFrom(address,address,uint256)', names: ['from', 'to', 'tokenId'], help: 'Transfert d\'un NFT (ERC-721).' },
  { sig: 'deposit()', names: [], help: 'WETH : enveloppe l\'ETH envoyé avec l\'appel en autant de WETH.' },
  { sig: 'withdraw(uint256)', names: ['wad'], help: 'WETH : détruit `wad` WETH et rend autant d\'ETH (transaction interne).' },
  { sig: 'swapExactETHForTokens(uint256,address[],address,uint256)', names: ['amountOutMin', 'path', 'to', 'deadline'], help: 'Routeur Uniswap V2 : échange l\'ETH envoyé contre des jetons, le long du chemin `path`, versés à `to`.' },
  { sig: 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)', names: ['amountIn', 'amountOutMin', 'path', 'to', 'deadline'], help: 'Routeur Uniswap V2 : échange des jetons contre de l\'ETH versé à `to` (transaction interne).' },
  { sig: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)', names: ['amountIn', 'amountOutMin', 'path', 'to', 'deadline'], help: 'Routeur Uniswap V2 : échange un jeton contre un autre le long de `path`.' },
  { sig: 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)', names: ['token', 'amountTokenDesired', 'amountTokenMin', 'amountETHMin', 'to', 'deadline'], help: 'Dépose de l\'ETH et un jeton dans un pool ; des parts de pool (jetons LP) sont créées au profit de `to`.' },
  { sig: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)', names: ['tokenA', 'tokenB', 'amountADesired', 'amountBDesired', 'amountAMin', 'amountBMin', 'to', 'deadline'], help: 'Dépose deux jetons dans un pool ; des parts de pool (jetons LP) sont créées au profit de `to`.' },
  { sig: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)', names: ['tokenA', 'tokenB', 'liquidity', 'amountAMin', 'amountBMin', 'to', 'deadline'], help: 'Détruit `liquidity` parts de pool et verse les deux actifs correspondants à `to` — qui peut être une autre adresse que celle qui avait déposé.' },
  { sig: 'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)', names: ['token', 'liquidity', 'amountTokenMin', 'amountETHMin', 'to', 'deadline'], help: 'Détruit des parts de pool et verse le jeton et l\'ETH correspondants à `to`.' },
  { sig: 'supply(address,uint256,address,uint16)', names: ['asset', 'amount', 'onBehalfOf', 'referralCode'], help: 'Aave : dépose `amount` en garantie ; des aTokens sont créés au profit de `onBehalfOf`.' },
  { sig: 'depositETH(address,address,uint16)', names: ['pool', 'onBehalfOf', 'referralCode'], help: 'Passerelle WETH d\'Aave : enveloppe l\'ETH envoyé et le dépose en garantie pour `onBehalfOf`.' },
  { sig: 'borrow(address,uint256,uint256,uint16,address)', names: ['asset', 'amount', 'interestRateMode', 'referralCode', 'onBehalfOf'], help: 'Aave : emprunte `amount` de l\'actif contre la garantie déposée. Les fonds empruntés sont « neufs » : ils sortent du pool, pas des dépôts du signataire.' },
  { sig: 'repay(address,uint256,uint256,address)', names: ['asset', 'amount', 'interestRateMode', 'onBehalfOf'], help: 'Aave : rembourse une dette ; n\'importe qui peut rembourser pour `onBehalfOf`.' },
  { sig: 'withdraw(address,uint256,address)', names: ['asset', 'amount', 'to'], help: 'Aave : détruit des aTokens et retire la garantie vers `to`.' },
  { sig: 'unoswap(address,uint256,uint256,uint256[])', names: ['srcToken', 'amount', 'minReturn', 'pools'], help: 'Agrégateur 1inch : enchaîne les swaps sur la liste de pools `pools` en un seul appel.' },
  { sig: 'flushTokens(address)', names: ['tokenAddress'], help: 'Contrat de dépôt (forwarder) : reverse tous les jetons `tokenAddress` qu\'il détient vers le portefeuille principal de la plateforme.' },
  { sig: 'createForwarder(address,bytes32)', names: ['parent', 'salt'], help: 'Fabrique (CREATE2) : déploie le contrat de dépôt d\'un client à l\'adresse calculée d\'avance à partir de `salt`. L\'adresse pouvait recevoir des fonds avant même d\'exister.' },
  { sig: 'deposit(bytes32)', names: ['commitment'], help: 'Pool de confidentialité : dépôt d\'une dénomination fixe, identifié seulement par un engagement cryptographique.' },
  { sig: 'withdraw(address,bytes,bytes32,bytes32,address,address,uint256,uint256)', names: ['pool', 'proof', 'root', 'nullifierHash', 'recipient', 'relayer', 'fee', 'refund'], help: 'Pool de confidentialité : retrait prouvé par preuve à divulgation nulle, souvent soumis par un relayeur qui paie le gas.' },
  { sig: 'bridgeOut(uint256,address)', names: ['dstChainId', 'recipient'], help: 'Bridge : verrouille l\'actif envoyé et publie un événement que les relais exécutent sur la chaîne cible.' },
  { sig: 'bridgeOutToken(address,uint256,uint256,address)', names: ['token', 'amount', 'dstChainId', 'recipient'], help: 'Bridge : verrouille des jetons pour les restituer sur la chaîne cible.' },
  { sig: 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)', names: ['to', 'value', 'data', 'operation', 'safeTxGas', 'baseGas', 'gasPrice', 'gasToken', 'refundReceiver', 'signatures'], help: 'Coffre multisignature (Safe) : exécute une opération signée par le nombre requis de propriétaires (signatures concaténées dans `signatures`).' },
  { sig: 'multicall(bytes[])', names: ['data'], help: 'Enchaîne plusieurs appels au même contrat dans une seule transaction.' },
]

export const FUNCTIONS: Record<string, FnInfo> = Object.fromEntries(FN_LIST.map((f) => [f.sig, f]))

/** Base publique de signatures (type 4byte.directory) : sélecteur → signature. */
export const SELECTOR_DB: Record<string, string> = Object.fromEntries(FN_LIST.map((f) => [selectorOf(f.sig), f.sig]))

/** Nom de méthode du monde → signature (quand la transaction ne précise pas son appel). */
const METHOD_SIG: Record<string, string> = {
  swapExactETHForTokens: 'swapExactETHForTokens(uint256,address[],address,uint256)',
  swapExactTokensForETH: 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
  swapExactTokensForTokens: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  bridgeOut: 'bridgeOut(uint256,address)',
}

// ── Encodage ABI ────────────────────────────────────────────────────────────

const word = (hex: string) => hex.padStart(64, '0')

function addrHex(w: World, id: string): string {
  const a = w.addresses.get(id)
  const s = a?.addr ?? id
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s.slice(2).toLowerCase()
  // Tron et autres formats : forme hexadécimale dérivée (affichage pédagogique)
  return keccak256(s).slice(24)
}

function argUint(w: World, chain: ChainId, a: CallArg): bigint {
  if ('amt' in a) return toBaseUnits(a.amt, onchainDecimals(chain, a.asset))
  if ('uint' in a) return toBig(a.uint)
  if ('bool' in a) return a.bool ? 1n : 0n
  if ('addr' in a) return BigInt('0x' + addrHex(w, a.addr))
  return 0n
}

function encodeStatic(w: World, chain: ChainId, type: string, a: CallArg): string {
  if (type === 'address' && 'addr' in a) return word(addrHex(w, a.addr))
  if (type.startsWith('bytes') && 'bytes' in a) return a.bytes.replace(/^0x/, '').padEnd(64, '0').slice(0, 64)
  return word(argUint(w, chain, a).toString(16))
}

const isDynamic = (t: string) => t.endsWith('[]') || t === 'bytes' || t === 'string'

function encodeDynamic(w: World, chain: ChainId, type: string, a: CallArg): string {
  if (type === 'bytes') {
    const hex = 'bytes' in a ? a.bytes.replace(/^0x/, '') : ''
    return word((hex.length / 2).toString(16)) + (hex ? hex.padEnd(Math.ceil(hex.length / 64) * 64, '0') : '')
  }
  const inner = type.slice(0, -2)
  const items = 'list' in a ? a.list : []
  return word(items.length.toString(16)) + encodeTuple(w, chain, items.map(() => inner), items)
}

function encodeTuple(w: World, chain: ChainId, types: string[], args: CallArg[]): string {
  let head = ''
  let tail = ''
  const headLen = types.length * 32
  types.forEach((t, i) => {
    const a = args[i] ?? { uint: 0 }
    if (isDynamic(t)) {
      head += word((headLen + tail.length / 2).toString(16))
      tail += encodeDynamic(w, chain, t, a)
    } else head += encodeStatic(w, chain, t, a)
  })
  return head + tail
}

/** Types des paramètres d'une signature (sans tuples imbriqués). */
export function paramTypes(sig: string): string[] {
  const inner = sig.slice(sig.indexOf('(') + 1, sig.lastIndexOf(')'))
  return inner ? inner.split(',') : []
}

export function fnName(sig: string): string {
  return sig.slice(0, sig.indexOf('('))
}

/** Données d'entrée brutes : sélecteur (4 octets) puis arguments encodés par mots de 32 octets. */
export function calldata(w: World, chain: ChainId, call: EvmCall): string {
  return selectorOf(call.sig) + encodeTuple(w, chain, paramTypes(call.sig), call.args)
}

/** Valeur lisible d'un argument décodé. */
export function argDisplay(w: World, chain: ChainId, type: string, a: CallArg): { text: string; addr?: string } {
  if ('addr' in a) return { text: w.addresses.get(a.addr)?.addr ?? a.addr, addr: w.addresses.has(a.addr) ? a.addr : undefined }
  if ('amt' in a) {
    const raw = toBaseUnits(a.amt, onchainDecimals(chain, a.asset))
    return { text: `${fmtBaseUnits(raw)} (= ${a.amt.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} ${a.asset}, ${onchainDecimals(chain, a.asset)} décimales)` }
  }
  if ('uint' in a) {
    const v = toBig(a.uint)
    if (v === MAX_UINT) return { text: '2²⁵⁶−1 (valeur maximale : autorisation illimitée)' }
    return { text: fmtBaseUnits(v) }
  }
  if ('bool' in a) return { text: a.bool ? 'true' : 'false' }
  if ('bytes' in a) return { text: a.bytes.length > 70 ? `${a.bytes.slice(0, 66)}… (${(a.bytes.length - 2) / 2} octets)` : a.bytes }
  if ('list' in a) return { text: `[${a.list.map((x) => argDisplay(w, chain, type.slice(0, -2), x).text).join(', ')}]` }
  return { text: '' }
}

export const MAX_UINT = (1n << 256n) - 1n

/** Entier ABI depuis un nombre (arrondi : horodatages calculés en flottant) ou une chaîne décimale. */
function toBig(v: number | string): bigint {
  return typeof v === 'number' ? BigInt(Math.round(v)) : BigInt(v)
}

// ── Appel de la transaction ─────────────────────────────────────────────────

export interface CallView {
  call: EvmCall | null
  /** Fonction reconnue dans la base de signatures (contrat vérifié ou signature publique). */
  known: boolean
  selector: string
  /** Valeur native envoyée avec l'appel. */
  value: number
}

function legsFrom(tx: Tx, id: string): Transfer[] {
  return tx.transfers.filter((t) => t.from === id)
}

/** Fonction appelée par une transaction (explicite, ou reconstruite à partir des transferts). */
export function callOf(w: World, tx: Tx): CallView {
  const native = CHAINS[tx.chain].native
  const signer = tx.signer ?? tx.transfers[0]?.from
  const value = signer ? legsFrom(tx, signer).filter((t) => t.asset === native).slice(0, 1).reduce((s, t) => s + t.value, 0) : 0
  const mk = (call: EvmCall | null): CallView => ({ call, known: !call || !!FUNCTIONS[call.sig], selector: call ? selectorOf(call.sig) : '0x', value })
  if (tx.call) return mk(tx.call)
  if (!hasAbi(tx.chain) || !signer) return mk(null)
  // Envoi d'ETH à un contrat qui l'accepte sans fonction (receive/fallback) : pas de données d'entrée
  if (tx.tags.includes('forwarder-auto') || tx.tags.includes('plain-value')) return mk(null)
  const first = tx.transfers[0]
  const deadline = { uint: tx.time + 1200 }
  const sig = tx.method ? METHOD_SIG[tx.method] : undefined
  if (sig && tx.tags.includes('swap')) {
    const router = first?.to ?? signer
    const sent = tx.transfers.find((t) => t.from === signer)
    const got = [...tx.transfers].reverse().find((t) => t.to === signer)
    const pathOf = (a: AssetId) => ({ addr: tokenContract(w, tx.chain, a === native ? 'WETH' : a) })
    const path = { list: [pathOf(sent?.asset ?? native), pathOf(got?.asset ?? native)] }
    const minOut = { amt: (got?.value ?? 0) * 0.995, asset: got?.asset ?? native }
    const args: CallArg[] = tx.method === 'swapExactETHForTokens'
      ? [minOut, path, { addr: signer }, deadline]
      : [{ amt: sent?.value ?? 0, asset: sent?.asset ?? native }, minOut, path, { addr: signer }, deadline]
    return mk({ to: router, sig, args })
  }
  if (sig === 'bridgeOut(uint256,address)' && tx.bridge) {
    const dst: Record<string, number> = { eth: 1, bsc: 56, arb: 42161, base: 8453, tron: 728126428, sol: 0, btc: 0 }
    if (first && first.asset !== native) return mk({ to: first.to, sig: 'bridgeOutToken(address,uint256,uint256,address)', args: [{ addr: tokenContract(w, tx.chain, first.asset) }, { amt: first.value, asset: first.asset }, { uint: dst[tx.bridge.otherChain] ?? 0 }, { addr: tx.bridge.recipient ?? signer }] })
    return mk({ to: first?.to ?? signer, sig, args: [{ uint: dst[tx.bridge.otherChain] ?? 0 }, { addr: tx.bridge.recipient ?? signer }] })
  }
  if (tx.tags.includes('privacy-deposit') && first) {
    return mk({ to: first.to, sig: 'deposit(bytes32)', args: [{ bytes: '0x' + keccak256(`commit:${tx.hash}`) }] })
  }
  if (tx.tags.includes('privacy-withdraw') && first) {
    const fee = tx.transfers[1]
    return mk({
      to: first.from, sig: 'withdraw(address,bytes,bytes32,bytes32,address,address,uint256,uint256)',
      args: [{ addr: first.from }, { bytes: '0x' + keccak256(`proof:${tx.hash}`).repeat(8) }, { bytes: '0x' + keccak256(`root:${tx.hash}`) }, { bytes: '0x' + keccak256(`null:${tx.hash}`) }, { addr: first.to }, { addr: fee?.to ?? first.to }, { amt: fee?.value ?? 0, asset: native }, { uint: 0 }],
    })
  }
  // Transfert simple de jeton par son titulaire
  if (tx.transfers.length === 1 && first && first.asset !== native && first.from === signer) {
    return mk({ to: tokenContract(w, tx.chain, first.asset), sig: 'transfer(address,uint256)', args: [{ addr: first.to }, { amt: first.value, asset: first.asset }] })
  }
  // Envoi d'ETH vers un compte externe : pas de données d'entrée
  if (tx.transfers.length <= 1 && (!first || !w.get(first.to).contract)) return mk(null)
  // Fonction inconnue de la base (contrat non vérifié) : on n'en voit que le sélecteur
  const name = (tx.method ?? 'execute').replace(/[^A-Za-z0-9_]/g, '') || 'execute'
  return mk({ to: first?.to ?? signer, sig: `${name}()`, args: [] })
}

// ── Transferts : valeur, interne ou événement ───────────────────────────────

export type LegKind = 'value' | 'internal' | 'token' | 'mint' | 'burn'

export const LEG_KIND_LABEL: Record<LegKind, string> = {
  value: 'Valeur de la transaction',
  internal: 'Transaction interne',
  token: 'Transfert de jeton (événement)',
  mint: 'Création de jetons (mint)',
  burn: 'Destruction de jetons (burn)',
}

/** Nature d'une jambe : valeur envoyée par le signataire, transaction interne (contrat → adresse), ou événement de jeton. */
export function legKind(w: World, tx: Tx, t: Transfer): LegKind {
  const native = CHAINS[tx.chain].native
  if (t.asset !== native) {
    if (isNull(w, t.from)) return 'mint'
    if (isNull(w, t.to)) return 'burn'
    return 'token'
  }
  const signer = tx.signer ?? tx.transfers[0]?.from
  const firstNative = tx.transfers.find((x) => x.asset === native && x.from === signer)
  return firstNative === t ? 'value' : 'internal'
}

export interface InternalCall {
  from: string
  to: string
  value: number
  /** Profondeur dans la pile d'appels (1 = appelé directement par le contrat cible). */
  depth: number
  type: 'CALL'
}

/** Transactions internes : ETH déplacé par des contrats pendant l'exécution (absent des journaux d'événements). */
export function internalCalls(w: World, tx: Tx): InternalCall[] {
  if (tx.model !== 'account' || !hasAbi(tx.chain)) return []
  const target = callOf(w, tx).call?.to ?? tx.transfers[0]?.to
  return tx.transfers
    .filter((t) => legKind(w, tx, t) === 'internal')
    .map((t) => ({ from: t.from, to: t.to, value: t.value, depth: t.from === target ? 1 : 2, type: 'CALL' as const }))
}

// ── Journaux d'événements ───────────────────────────────────────────────────

export interface LogParam {
  name: string
  type: string
  indexed: boolean
  text: string
  addr?: string
}

export interface EvmLog {
  index: number
  /** Contrat qui émet l'événement. */
  emitter: string
  name: string
  sig: string
  topics: string[]
  data: string
  params: LogParam[]
}

interface EventDef {
  sig: string
  params: { name: string; type: string; indexed: boolean }[]
}

const ev = (sig: string, names: string, indexed: number[]): EventDef => {
  const types = paramTypes(sig)
  const ns = names.split(',')
  return { sig, params: types.map((t, i) => ({ name: ns[i], type: t, indexed: indexed.includes(i) })) }
}

export const EVENTS = {
  Transfer: ev('Transfer(address,address,uint256)', 'from,to,value', [0, 1]),
  Approval: ev('Approval(address,address,uint256)', 'owner,spender,value', [0, 1]),
  ApprovalForAll: ev('ApprovalForAll(address,address,bool)', 'owner,operator,approved', [0, 1]),
  Deposit: ev('Deposit(address,uint256)', 'dst,wad', [0]),
  Withdrawal: ev('Withdrawal(address,uint256)', 'src,wad', [0]),
  Swap: ev('Swap(address,uint256,uint256,uint256,uint256,address)', 'sender,amount0In,amount1In,amount0Out,amount1Out,to', [0, 5]),
  Mint: ev('Mint(address,uint256,uint256)', 'sender,amount0,amount1', [0]),
  Burn: ev('Burn(address,uint256,uint256,address)', 'sender,amount0,amount1,to', [0, 3]),
  Supply: ev('Supply(address,address,address,uint256,uint16)', 'reserve,user,onBehalfOf,amount,referralCode', [0, 2, 4]),
  Borrow: ev('Borrow(address,address,address,uint256,uint8,uint256,uint16)', 'reserve,user,onBehalfOf,amount,interestRateMode,borrowRate,referralCode', [0, 2, 6]),
  Repay: ev('Repay(address,address,address,uint256,bool)', 'reserve,user,repayer,amount,useATokens', [0, 1, 2]),
  LendWithdraw: ev('Withdraw(address,address,address,uint256)', 'reserve,user,to,amount', [0, 1, 2]),
  ForwarderDeposited: ev('ForwarderDeposited(address,uint256,bytes)', 'from,value,data', []),
  PoolDeposit: ev('Deposit(bytes32,uint32,uint256)', 'commitment,leafIndex,timestamp', [0]),
  PoolWithdrawal: ev('Withdrawal(address,bytes32,address,uint256)', 'to,nullifierHash,relayer,fee', [2]),
  BridgeOut: ev('BridgeOut(address,address,uint256,uint256,uint256)', 'sender,recipient,amount,dstChainId,nonce', [0, 1]),
  BridgeIn: ev('BridgeIn(address,uint256,uint256,uint256)', 'recipient,amount,srcChainId,nonce', [0]),
  ExecutionSuccess: ev('ExecutionSuccess(bytes32,uint256)', 'txHash,payment', []),
} satisfies Record<string, EventDef>

/** Nom affiché de l'événement (sans le suffixe de désambiguïsation interne). */
const EVENT_NAME: Partial<Record<keyof typeof EVENTS, string>> = { LendWithdraw: 'Withdraw', PoolDeposit: 'Deposit', PoolWithdrawal: 'Withdrawal' }

function buildLog(w: World, chain: ChainId, index: number, emitter: string, key: keyof typeof EVENTS, values: CallArg[]): EvmLog {
  const def = EVENTS[key]
  const topics = [topicOf(def.sig)]
  const dataTypes: string[] = []
  const dataArgs: CallArg[] = []
  const params: LogParam[] = def.params.map((p, i) => {
    const v = values[i] ?? { uint: 0 }
    if (p.indexed) topics.push('0x' + encodeStatic(w, chain, p.type, v))
    else {
      dataTypes.push(p.type)
      dataArgs.push(v)
    }
    const d = argDisplay(w, chain, p.type, v)
    return { name: p.name, type: p.type, indexed: p.indexed, text: d.text, addr: d.addr }
  })
  return { index, emitter, name: EVENT_NAME[key] ?? key, sig: def.sig, topics, data: '0x' + encodeTuple(w, chain, dataTypes, dataArgs), params }
}

const CHAIN_NUM: Partial<Record<ChainId, number>> = { eth: 1, bsc: 56, arb: 42161, base: 8453, tron: 728126428 }

/** Journaux d'événements de la transaction, dans l'ordre d'émission. */
export function txLogs(w: World, tx: Tx): EvmLog[] {
  if (tx.model !== 'account' || !hasAbi(tx.chain) || tx.status === 'reverted') return []
  const chain = tx.chain
  const native = CHAINS[chain].native
  const logs: EvmLog[] = []
  const push = (emitter: string, key: keyof typeof EVENTS, values: CallArg[]) => logs.push(buildLog(w, chain, logs.length, emitter, key, values))
  const isType = (id: string, ...types: string[]) => types.includes(w.get(id).contract?.type ?? '')
  const signer = tx.signer ?? tx.transfers[0]?.from ?? ''
  const pools = [...new Set(tx.transfers.flatMap((t) => [t.from, t.to]).filter((id) => isType(id, 'pool')))]
  const lending = tx.transfers.flatMap((t) => [t.from, t.to]).find((id) => isType(id, 'lending')) ?? tx.call?.to
  const call = callOf(w, tx).call

  if (call?.sig === 'approve(address,uint256)') push(call.to, 'Approval', [{ addr: signer }, call.args[0], call.args[1]])
  if (call?.sig === 'setApprovalForAll(address,bool)') push(call.to, 'ApprovalForAll', [{ addr: signer }, call.args[0], call.args[1]])
  if (call?.sig.startsWith('permit(')) push(call.to, 'Approval', [call.args[0], call.args[1], call.args[2]])

  for (const t of tx.transfers) {
    const kind = legKind(w, tx, t)
    if (kind === 'value' || kind === 'internal') {
      if (isType(t.to, 'forwarder')) push(t.to, 'ForwarderDeposited', [{ addr: t.from }, { amt: t.value, asset: native }, { bytes: '0x' }])
      continue
    }
    // WETH n'émet pas Transfer à l'enveloppe : Deposit / Withdrawal
    if (t.asset === 'WETH' && kind === 'mint') {
      push(tokenContract(w, chain, 'WETH'), 'Deposit', [{ addr: t.to }, { amt: t.value, asset: 'WETH' }])
      continue
    }
    if (t.asset === 'WETH' && kind === 'burn') {
      push(tokenContract(w, chain, 'WETH'), 'Withdrawal', [{ addr: t.from }, { amt: t.value, asset: 'WETH' }])
      continue
    }
    const emitter = t.asset === 'LP' ? (pools[0] ?? tokenContract(w, chain, 'LP')) : tokenContract(w, chain, t.asset)
    push(emitter, 'Transfer', [{ addr: t.from }, { addr: t.to }, { amt: t.value, asset: t.asset }])
  }

  if (tx.tags.includes('swap')) {
    for (const p of pools) {
      const inn = tx.transfers.filter((t) => t.to === p)
      const out = tx.transfers.filter((t) => t.from === p)
      const to = out[0]?.to ?? signer
      // Uniswap V2 : token0 est le jeton dont l'adresse de contrat est la plus petite
      const key = (a: AssetId) => w.get(tokenContract(w, chain, a === native ? 'WETH' : a)).addr.toLowerCase()
      const inFirst = !inn[0] || !out[0] || key(inn[0].asset) < key(out[0].asset)
      const amIn: CallArg = inn[0] ? { amt: inn[0].value, asset: inn[0].asset } : { uint: 0 }
      const amOut: CallArg = out[0] ? { amt: out[0].value, asset: out[0].asset } : { uint: 0 }
      push(p, 'Swap', inFirst
        ? [{ addr: call?.to ?? signer }, amIn, { uint: 0 }, { uint: 0 }, amOut, { addr: to }]
        : [{ addr: call?.to ?? signer }, { uint: 0 }, amIn, amOut, { uint: 0 }, { addr: to }])
    }
  }
  if (tx.tags.includes('lp-add') && pools[0]) {
    const inn = tx.transfers.filter((t) => t.to === pools[0])
    push(pools[0], 'Mint', [{ addr: call?.to ?? signer }, inn[0] ? { amt: inn[0].value, asset: inn[0].asset } : { uint: 0 }, inn[1] ? { amt: inn[1].value, asset: inn[1].asset } : { uint: 0 }])
  }
  if (tx.tags.includes('lp-remove') && pools[0]) {
    const out = tx.transfers.filter((t) => t.from === pools[0])
    push(pools[0], 'Burn', [{ addr: call?.to ?? signer }, out[0] ? { amt: out[0].value, asset: out[0].asset } : { uint: 0 }, out[1] ? { amt: out[1].value, asset: out[1].asset } : { uint: 0 }, { addr: out[0]?.to ?? signer }])
  }
  if (lending) {
    const reserveOf = (a: AssetId) => ({ addr: tokenContract(w, chain, a === native ? 'WETH' : a.startsWith('a') ? (a.slice(1) as AssetId) : a) })
    const into = tx.transfers.find((t) => t.to === lending)
    const outOf = tx.transfers.find((t) => t.from === lending)
    if (tx.tags.includes('lending-supply') && into) push(lending, 'Supply', [reserveOf(into.asset), { addr: signer }, { addr: signer }, { amt: into.value, asset: into.asset }, { uint: 0 }])
    if (tx.tags.includes('lending-borrow') && outOf) push(lending, 'Borrow', [reserveOf(outOf.asset), { addr: signer }, { addr: signer }, { amt: outOf.value, asset: outOf.asset }, { uint: 2 }, { uint: '41250000000000000000000000' }, { uint: 0 }])
    if (tx.tags.includes('lending-repay') && into) push(lending, 'Repay', [reserveOf(into.asset), { addr: signer }, { addr: signer }, { amt: into.value, asset: into.asset }, { bool: false }])
    if (tx.tags.includes('lending-withdraw') && outOf) push(lending, 'LendWithdraw', [reserveOf(outOf.asset), { addr: signer }, { addr: outOf.to }, { amt: outOf.value, asset: outOf.asset }])
  }
  if (tx.tags.includes('privacy-deposit') && tx.transfers[0]) push(tx.transfers[0].to, 'PoolDeposit', [{ bytes: '0x' + keccak256(`commit:${tx.hash}`) }, { uint: parseInt(tx.hash.slice(2, 7), 16) % 90000 }, { uint: tx.time }])
  if (tx.tags.includes('privacy-withdraw') && tx.transfers[0]) push(tx.transfers[0].from, 'PoolWithdrawal', [{ addr: tx.transfers[0].to }, { bytes: '0x' + keccak256(`null:${tx.hash}`) }, { addr: tx.transfers[1]?.to ?? tx.transfers[0].to }, { amt: tx.transfers[1]?.value ?? 0, asset: native }])
  if (tx.bridge && tx.tags.includes('bridge') && !tx.tags.some((t) => t.startsWith('l2-'))) {
    const leg = tx.bridge.direction === 'out' ? tx.transfers[0] : tx.transfers[0]
    if (leg && tx.bridge.direction === 'out') push(leg.to, 'BridgeOut', [{ addr: leg.from }, { addr: tx.bridge.recipient ?? leg.from }, { amt: leg.value, asset: leg.asset }, { uint: CHAIN_NUM[tx.bridge.otherChain] ?? 0 }, { uint: tx.bridge.nonce }])
    if (leg && tx.bridge.direction === 'in') push(leg.from, 'BridgeIn', [{ addr: leg.to }, { amt: leg.value, asset: leg.asset }, { uint: CHAIN_NUM[tx.bridge.otherChain] ?? 0 }, { uint: tx.bridge.nonce }])
  }
  if (call?.sig.startsWith('execTransaction(')) push(call.to, 'ExecutionSuccess', [{ bytes: '0x' + keccak256(`safe:${tx.hash}`) }, { uint: 0 }])
  return logs
}

// ── Gas et nonce ────────────────────────────────────────────────────────────

const GAS: Record<string, number> = {
  'transfer(address,uint256)': 51_200,
  'approve(address,uint256)': 46_300,
  'transferFrom(address,address,uint256)': 58_600,
  'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)': 74_000,
  'setApprovalForAll(address,bool)': 46_500,
  'deposit()': 45_000,
  'withdraw(uint256)': 35_100,
  'supply(address,uint256,address,uint16)': 196_000,
  'depositETH(address,address,uint16)': 231_000,
  'borrow(address,uint256,uint256,uint16,address)': 287_000,
  'repay(address,uint256,uint256,address)': 168_000,
  'withdraw(address,uint256,address)': 212_000,
  'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)': 182_000,
  'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)': 195_000,
  'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)': 158_000,
  'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)': 171_000,
  'unoswap(address,uint256,uint256,uint256[])': 236_000,
  'flushTokens(address)': 61_000,
  'createForwarder(address,bytes32)': 118_000,
}

export interface GasView {
  gasLimit: number
  gasUsed: number
  /** Prix du gas en gwei (ou unité équivalente). */
  priceGwei: number
}

export function gasOf(w: World, tx: Tx): GasView | null {
  if (tx.model !== 'account' || !isEvm(tx.chain)) return null
  const c = callOf(w, tx)
  const jitter = (parseInt(tx.hash.slice(-4), 16) % 4000) - 2000
  let used = !c.call ? 21_000 : (GAS[c.call.sig] ?? (c.call.sig.startsWith('swap') ? 118_000 + 52_000 * Math.max(0, tx.transfers.length - 3) : 92_000)) + jitter
  if (c.call?.sig === 'transfer(address,uint256)' || !c.call) used = !c.call ? 21_000 : 51_200 + (jitter % 600)
  const limit = Math.round(used * 1.3 / 1000) * 1000
  if (tx.status === 'reverted') used = Math.round(used * 0.42)
  const priceGwei = (tx.fee * 1e9) / used
  return { gasLimit: limit, gasUsed: used, priceGwei }
}

/** Nonce du compte signataire : nombre de transactions qu'il avait déjà signées. */
export function accountNonce(w: World, tx: Tx): number | null {
  if (tx.model !== 'account' || !tx.signer) return null
  let n = 0
  for (const t of w.txsOf(tx.signer)) {
    if (t.id === tx.id) break
    if (t.signer === tx.signer) n++
  }
  return n
}

/** Explication en une phrase de ce que fait la transaction, à partir de l'appel décodé. */
export function describeCall(w: World, tx: Tx): string {
  const c = callOf(w, tx)
  if (tx.status === 'reverted') return `Transaction échouée${tx.revertReason ? ` (« ${tx.revertReason} »)` : ''} : le signataire a payé le gas mais aucun transfert n'a eu lieu.`
  if (!c.call) return tx.transfers.length ? 'Envoi de l\'actif natif vers un compte : aucune donnée d\'entrée (0x).' : 'Aucune donnée d\'entrée.'
  if (!c.known) return `Fonction absente de la base de signatures (contrat non vérifié) : seul le sélecteur ${c.selector} est connu. Le nom affiché par certains explorateurs provient de bases publiques et peut être trompeur.`
  return FUNCTIONS[c.call.sig].help.replace(/`/g, '')
}
