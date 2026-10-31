// Exercices « Smart contracts & DeFi » : nature des jambes d'une transaction
// EVM, lecture d'un journal Transfer brut, décodage des données d'entrée,
// contrats de dépôt (forwarders), swaps agrégés, jetons de reçu, prêts avec
// garantie et parts de pool de liquidité. Sélecteurs, topics, encodage ABI et
// décimales on-chain sont calculés par le moteur (keccak.ts, evm.ts).
import { genAddress, lookalike, shortAddr } from '../../engine/addressgen'
import type { AssetId, ChainId } from '../../engine/chains'
import { EVENTS, LEG_KIND_LABEL, NULL_ADDRESS, SELECTOR_DB, calldata, fmtBaseUnits, onchainDecimals, toBaseUnits, type LegKind } from '../../engine/evm'
import { selectorOf, topicOf } from '../../engine/keccak'
import type { Rng } from '../../engine/rng'
import type { CallArg, World } from '../../engine/world'
import type { DrillDef, DrillVisual } from '../model'
import { dayTime, frList, frMax, mkChoice, rngFor } from './util'

type Row = Extract<DrillVisual, { type: 'transfers' }>['rows'][number]

// ── Références ──────────────────────────────────────────────────────────────

const UNI_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const PANCAKE_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
const ONEINCH_V5 = '0x1111111254EEB25477B68fb85Ed929f73A960582'
const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const WETH_ADDR = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const NULL = NULL_ADDRESS
const NULL_LABEL = 'Adresse nulle (0x000…000)'

interface Tok {
  sym: string
  chain: ChainId
  name: string
  contract: string
  dec: number
}

const tok = (sym: string, chain: ChainId, name: string, contract: string): Tok => ({ sym, chain, name, contract, dec: onchainDecimals(chain, sym as AssetId) })

/** Contrats réels ; décimales on-chain fournies par le moteur (USDT/USDC : 6 sur Ethereum, 18 sur BSC). */
const TOKENS: Tok[] = [
  tok('USDT', 'eth', 'Tether USD', '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  tok('USDC', 'eth', 'USD Coin', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  tok('DAI', 'eth', 'Dai Stablecoin', '0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  tok('WBTC', 'eth', 'Wrapped BTC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
  tok('WETH', 'eth', 'Wrapped Ether', WETH_ADDR),
  tok('USDT', 'bsc', 'Binance-Peg BSC-USD', '0x55d398326f99059fF775485246999027B3197955'),
  tok('USDC', 'bsc', 'Binance-Peg USD Coin', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
  tok('BUSD', 'bsc', 'Binance-Peg BUSD Token', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'),
  tok('WBNB', 'bsc', 'Wrapped BNB', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'),
]

const CHAIN_NAME: Partial<Record<ChainId, string>> = { eth: 'Ethereum', bsc: 'BNB Smart Chain' }
const NATIVE: Partial<Record<ChainId, string>> = { eth: 'ETH', bsc: 'BNB' }
const STABLES = ['USDT', 'USDC', 'DAI', 'BUSD']
const isStable = (s: string) => STABLES.includes(s)
const tokenOf = (chain: ChainId, sym: string) => TOKENS.find((t) => t.chain === chain && t.sym === sym)!

/** Monde factice : `calldata` ne consulte le monde que pour résoudre des identifiants d'adresses. */
const STUB = { addresses: new Map() } as unknown as World

const evm = (rng: Rng) => genAddress(rng, 'eth', 'eoa')
const evmLow = (rng: Rng) => evm(rng).toLowerCase()
const sh = (a: string) => shortAddr(a, 8)
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const word = (hex: string) => hex.padStart(64, '0')
const addrTopic = (a: string) => '0x' + word(a.slice(2).toLowerCase())

/** Arrondi d'affichage d'un montant selon l'actif. */
function roundA(asset: string, v: number): number {
  if (isStable(asset)) return round(v, 2)
  if (asset === 'WBTC') return round(v, 6)
  if (asset === 'LP' || asset === 'UNI-V2') return round(v, 6)
  return round(v, 4)
}

function genAmount(rng: Rng, sym: string): number {
  if (isStable(sym)) return rng.chance(0.35) ? Math.round(rng.float(2, 2500)) * 100 : round(rng.float(25, 250000), 2)
  if (sym === 'WBTC') return round(rng.float(0.01, 6), 5)
  return round(rng.float(0.05, 150), 4)
}

/** Montant lu avec de mauvaises décimales (piège classique). */
function wrongDecAmount(raw: bigint, dec: number): string {
  const wrong = dec === 18 ? 6 : 18
  const v = Number(raw) / 10 ** wrong
  return frMax(v, 12)
}

/** Données d'entrée affichées comme dans la vue « Original » d'un explorateur. */
function inputItems(data: string): string[] {
  const body = data.slice(10)
  const items = [`MethodID : ${data.slice(0, 10)}`]
  for (let i = 0; i * 64 < body.length; i++) items.push(`[${i}] : ${body.slice(i * 64, i * 64 + 64)}`)
  return items
}

// ── 1. Nature d'une jambe ───────────────────────────────────────────────────

interface Leg extends Row {
  kind: LegKind
}

interface LegScenario {
  method: string
  signerLabel: string
  story: string
  legs: Leg[]
}

const KIND_RULE: Record<LegKind, string> = {
  value: 'La valeur de la transaction est l\'ETH natif que le signataire envoie lui-même, dans le champ « value » de sa transaction : il y en a au plus une par transaction, et elle part toujours du signataire vers l\'adresse appelée.',
  internal: 'Une transaction interne est un mouvement d\'ETH natif exécuté par un contrat pendant l\'exécution (appel CALL avec valeur). Elle n\'a pas de signature propre, n\'émet aucun événement standard et n\'apparaît que dans l\'onglet des transactions internes, reconstitué à partir de la trace d\'exécution.',
  token: 'Un transfert de jeton n\'est pas un mouvement d\'ETH : c\'est un événement Transfer émis par le contrat du jeton, qui met à jour son registre interne des soldes.',
  mint: 'Un événement Transfer dont l\'expéditeur est l\'adresse nulle (0x000…000) signale une création de jetons : personne ne détient cette adresse, c\'est le contrat qui crée les unités (dépôt dans une enveloppe, reçu de dépôt, parts de pool, émission).',
  burn: 'Un événement Transfer vers l\'adresse nulle signale une destruction de jetons : les unités sortent de l\'offre (retrait d\'une enveloppe, rachat d\'un reçu, retrait de liquidité).',
}

function whyNot(d: LegKind, leg: Leg, signerLabel: string): string {
  const native = leg.asset === 'ETH'
  const L = `**${LEG_KIND_LABEL[d]}** ?`
  switch (d) {
    case 'value':
      return native
        ? `- ${L} Non : la valeur part du signataire (${signerLabel}) ; ici l'ETH part de « ${leg.fromLabel} », un contrat qui le déplace pendant l'exécution.`
        : `- ${L} Non : la valeur d'une transaction est toujours de l'ETH natif, jamais un jeton comme ${leg.asset}.`
    case 'internal':
      return native
        ? `- ${L} Non : c'est le signataire lui-même qui envoie cet ETH avec sa transaction, pas un contrat en cours d'exécution.`
        : `- ${L} Non : une transaction interne déplace de l'ETH natif ; ${leg.asset} est un jeton, dont les mouvements sont des événements du contrat.`
    case 'token':
      return native
        ? `- ${L} Non : l'ETH est l'actif natif de la chaîne, il n'a pas de contrat et n'émet aucun événement Transfer.`
        : `- ${L} C'est bien un événement Transfer, mais ${leg.from === NULL ? 'son expéditeur' : 'son destinataire'} est l'adresse nulle : on parle alors de ${leg.from === NULL ? 'création (mint)' : 'destruction (burn)'}.`
    case 'mint':
      return `- ${L} Non : l'expéditeur n'est pas l'adresse nulle${native ? ', et l\'ETH natif n\'est jamais créé par un contrat' : ''}.`
    case 'burn':
      return `- ${L} Non : le destinataire n'est pas l'adresse nulle${native ? ', et l\'ETH natif n\'est jamais détruit par un contrat' : ''}.`
  }
}

function legScenario(rng: Rng): LegScenario {
  const P = rng.int(2400, 3900)
  const S = evm(rng)
  const SL = 'Suspect (signataire)'
  const stable = rng.pick(['USDC', 'USDT', 'DAI'])
  const e = round(rng.float(0.3, 18), 4)
  const x = round(e * P * rng.float(0.994, 0.998), 2)
  const pool = evm(rng)
  const poolL = `Pool Uniswap V2 ${stable}/WETH`
  const RL = 'Uniswap V2 : Router 2'
  const WL = 'Contrat WETH'
  const leg = (from: string, fromLabel: string, to: string, toLabel: string, value: number, asset: string, kind: LegKind): Leg => ({ from, fromLabel, to, toLabel, value, asset, kind })
  const kind = rng.pick(['swapIn', 'swapOut', 'forwarder', 'aaveDeposit', 'aaveWithdraw', 'addLiq', 'unwrap', 'splitter', 'removeLiq'] as const)
  let sc: LegScenario
  switch (kind) {
    case 'swapIn':
      sc = { method: 'swapExactETHForTokens', signerLabel: SL, story: `Swap d'ETH contre des ${stable} via le routeur Uniswap V2.`, legs: [
        leg(S, SL, UNI_V2_ROUTER, RL, e, 'ETH', 'value'),
        leg(UNI_V2_ROUTER, RL, WETH_ADDR, WL, e, 'ETH', 'internal'),
        leg(NULL, NULL_LABEL, UNI_V2_ROUTER, RL, e, 'WETH', 'mint'),
        leg(UNI_V2_ROUTER, RL, pool, poolL, e, 'WETH', 'token'),
        leg(pool, poolL, S, SL, x, stable, 'token'),
      ] }
      break
    case 'swapOut':
      sc = { method: 'swapExactTokensForETH', signerLabel: SL, story: `Swap de ${stable} contre de l'ETH via le routeur Uniswap V2.`, legs: [
        leg(S, SL, pool, poolL, x, stable, 'token'),
        leg(pool, poolL, UNI_V2_ROUTER, RL, e, 'WETH', 'token'),
        leg(UNI_V2_ROUTER, RL, NULL, NULL_LABEL, e, 'WETH', 'burn'),
        leg(WETH_ADDR, WL, UNI_V2_ROUTER, RL, e, 'ETH', 'internal'),
        leg(UNI_V2_ROUTER, RL, S, SL, e, 'ETH', 'internal'),
      ] }
      break
    case 'forwarder': {
      const ex = rng.pick(EXCHANGES)
      const dep = evm(rng)
      const hot = evm(rng)
      const CL = 'Client (signataire)'
      sc = { method: 'Transfer', signerLabel: CL, story: `Dépôt d'ETH d'un client sur son adresse de dépôt ${ex}, qui est un contrat.`, legs: [
        leg(S, CL, dep, 'Contrat de dépôt (Forwarder)', e, 'ETH', 'value'),
        leg(dep, 'Contrat de dépôt (Forwarder)', hot, `${ex} — Hot Wallet`, e, 'ETH', 'internal'),
      ] }
      break
    }
    case 'aaveDeposit': {
      const gw = evm(rng)
      const GL = 'Aave : WrappedTokenGateway'
      const AL = 'Aave V3 : réserve WETH (aEthWETH)'
      const aw = evm(rng)
      sc = { method: 'depositETH', signerLabel: SL, story: 'Dépôt d\'ETH en garantie sur Aave V3, via la passerelle WETH.', legs: [
        leg(S, SL, gw, GL, e, 'ETH', 'value'),
        leg(gw, GL, WETH_ADDR, WL, e, 'ETH', 'internal'),
        leg(NULL, NULL_LABEL, gw, GL, e, 'WETH', 'mint'),
        leg(gw, GL, aw, AL, e, 'WETH', 'token'),
        leg(NULL, NULL_LABEL, S, SL, e, 'aWETH', 'mint'),
      ] }
      break
    }
    case 'aaveWithdraw': {
      const au = evm(rng)
      const AL = 'Aave V3 : réserve USDC (aEthUSDC)'
      const u = round(rng.float(500, 90000), 2)
      sc = { method: 'withdraw', signerLabel: SL, story: 'Retrait d\'un dépôt d\'USDC sur Aave V3.', legs: [
        leg(S, SL, NULL, NULL_LABEL, u, 'aUSDC', 'burn'),
        leg(au, AL, S, SL, u, 'USDC', 'token'),
      ] }
      break
    }
    case 'addLiq': {
      const lp = round(Math.sqrt(x * e), 6)
      sc = { method: 'addLiquidityETH', signerLabel: SL, story: `Apport de liquidité ETH + ${stable} sur Uniswap V2.`, legs: [
        leg(S, SL, UNI_V2_ROUTER, RL, e, 'ETH', 'value'),
        leg(S, SL, pool, poolL, x, stable, 'token'),
        leg(UNI_V2_ROUTER, RL, WETH_ADDR, WL, e, 'ETH', 'internal'),
        leg(NULL, NULL_LABEL, UNI_V2_ROUTER, RL, e, 'WETH', 'mint'),
        leg(UNI_V2_ROUTER, RL, pool, poolL, e, 'WETH', 'token'),
        leg(NULL, NULL_LABEL, S, SL, lp, 'UNI-V2', 'mint'),
      ] }
      break
    }
    case 'unwrap':
      sc = { method: 'withdraw', signerLabel: SL, story: 'Retrait d\'ETH de l\'enveloppe WETH (unwrap).', legs: [
        leg(S, SL, NULL, NULL_LABEL, e, 'WETH', 'burn'),
        leg(WETH_ADDR, WL, S, SL, e, 'ETH', 'internal'),
      ] }
      break
    case 'splitter': {
      const spl = evm(rng)
      const SPL = 'Contrat de répartition (non vérifié)'
      const p = round(rng.float(0.3, 0.75), 2)
      const a = round(e * p, 4)
      sc = { method: 'distribute', signerLabel: SL, story: 'Envoi d\'ETH à un contrat qui le répartit entre deux bénéficiaires.', legs: [
        leg(S, SL, spl, SPL, e, 'ETH', 'value'),
        leg(spl, SPL, evm(rng), 'Bénéficiaire 1', a, 'ETH', 'internal'),
        leg(spl, SPL, evm(rng), 'Bénéficiaire 2', round(e - a, 4), 'ETH', 'internal'),
      ] }
      break
    }
    default: {
      const lp = round(Math.sqrt(x * e), 6)
      sc = { method: 'removeLiquidity', signerLabel: SL, story: `Retrait de liquidité d'un pool ${stable}/WETH.`, legs: [
        leg(S, SL, pool, poolL, lp, 'UNI-V2', 'token'),
        leg(pool, poolL, NULL, NULL_LABEL, lp, 'UNI-V2', 'burn'),
        leg(pool, poolL, S, SL, x, stable, 'token'),
        leg(pool, poolL, S, SL, e, 'WETH', 'token'),
      ] }
    }
  }
  for (const l of sc.legs) l.method = sc.method
  return sc
}

const legDesc = (l: Row) => `« ${l.fromLabel} → ${l.toLabel} : ${frMax(l.value, 8)} ${l.asset} »`

export const legKind: DrillDef = {
  id: 'leg-kind',
  title: 'Nature d\'une jambe EVM',
  description: 'Une transaction de contrat déplace des fonds de plusieurs façons : valeur envoyée par le signataire, transactions internes, événements de jetons, créations et destructions. Les distinguer pour ne rien manquer.',
  level: 2,
  track: 'contrats',
  icon: 'Split',
  generate(seed) {
    const rng = rngFor(seed, 'leg-kind')
    const sc = legScenario(rng)
    const kinds = [...new Set(sc.legs.map((l) => l.kind))]
    const k = rng.pick(kinds)
    const target = rng.pick(sc.legs.filter((l) => l.kind === k))
    const all: LegKind[] = ['value', 'internal', 'token', 'mint', 'burn']
    const decoys = rng.shuffle(all.filter((x) => x !== k)).slice(0, 3)
    const { options, answer } = mkChoice(rng, LEG_KIND_LABEL[k], decoys.map((d) => LEG_KIND_LABEL[d]), 4)
    const time = dayTime(rng)
    sc.legs.forEach((l) => (l.time = time))
    const rows: Row[] = sc.legs.map(({ kind: _k, ...r }) => r)
    return {
      prompt: `Quelle est la nature de la jambe ${legDesc(target)} ?`,
      context: `${sc.story} Transaction ${sc.method} signée par « ${sc.signerLabel} ». Le tableau regroupe tout ce que l'explorateur affiche pour cette transaction : valeur, transactions internes et transferts de jetons.`,
      visual: { type: 'transfers', chain: 'eth', rows },
      kind: 'choice',
      options,
      answer,
      explain: `${legDesc(target)} : **${LEG_KIND_LABEL[k]}**. ${KIND_RULE[k]}\n\n${decoys.map((d) => whyNot(d, target, sc.signerLabel)).join('\n')}\n\nEn pratique : une transaction de contrat se lit dans trois onglets (valeur, transactions internes, transferts de jetons). Les transactions internes n'émettant aucun événement, un outil qui ne lit que les journaux d'événements les manque : c'est souvent là que l'ETH « disparaît » d'un traçage.`,
    }
  },
}

const EXCHANGES = ['Nexbit', 'Coinvaria', 'Bitora', 'Kryptal', 'Valmex']

// ── 2. Lire un événement Transfer brut ──────────────────────────────────────

const MINT_ISSUER: Record<string, string> = {
  'eth:USDC': 'Circle, par l\'intermédiaire d\'un « minter » autorisé, contre des dollars reçus',
  'eth:DAI': 'le protocole Maker (Sky), qui crée des DAI contre une garantie déposée',
  'eth:WBTC': 'le dispositif de garde WBTC, contre des BTC remis au dépositaire par un marchand agréé',
  'bsc:USDT': 'Binance, émetteur de ce jeton « Binance-Peg » adossé à des USDT qu\'il conserve',
  'bsc:USDC': 'Binance, émetteur de ce jeton « Binance-Peg » adossé à des USDC qu\'il conserve',
}

export const eventRead: DrillDef = {
  id: 'event-read',
  title: 'Lire un événement Transfer brut',
  description: 'Topics, data et contrat émetteur : retrouver l\'expéditeur, le destinataire, le jeton et le montant d\'un journal d\'événement, décimales on-chain comprises.',
  level: 2,
  track: 'contrats',
  icon: 'ScrollText',
  generate(seed) {
    const rng = rngFor(seed, 'event-read')
    const variant = rng.weighted([['recipient', 2], ['sender', 1], ['amount', 3], ['token', 2], ['mint', 1.5]] as const)
    const T0 = topicOf(EVENTS.Transfer.sig)
    const pool = variant === 'mint' ? TOKENS.filter((t) => MINT_ISSUER[`${t.chain}:${t.sym}`]) : TOKENS
    const t = rng.pick(pool)
    const chainName = CHAIN_NAME[t.chain]!
    const amount = genAmount(rng, t.sym)
    const raw = toBaseUnits(amount, t.dec)
    const from = variant === 'mint' ? NULL : evmLow(rng)
    let to = evmLow(rng)
    // Variante « jeton » : parfois des jetons envoyés par erreur au contrat d'un autre jeton.
    const sameChain = TOKENS.filter((x) => x.chain === t.chain)
    const trap = variant === 'token' && rng.chance(0.35) ? rng.pick(sameChain.filter((x) => x !== t)) : undefined
    if (trap) to = trap.contract.toLowerCase()
    const topics = [T0, addrTopic(from), addrTopic(to)]
    const data = '0x' + word(raw.toString(16))
    const visual: DrillVisual = {
      type: 'list',
      title: `Journal d'événement n° ${rng.int(0, 14)} — ${chainName}`,
      items: [`address (contrat émetteur) : ${t.contract}`, `topics[0] : ${topics[0]}`, `topics[1] : ${topics[1]}`, `topics[2] : ${topics[2]}`, `data : ${data}`],
    }
    const A = frMax(amount, 8)
    const layout = `Pour Transfer(address indexed from, address indexed to, uint256 value), topics[0] est le Keccak-256 de la signature (\`${T0.slice(0, 10)}…\`) : il identifie le type d'événement, ce n'est pas une adresse. Les paramètres indexés suivent dans l'ordre : topics[1] = from, topics[2] = to, chaque adresse étant complétée à 32 octets par des zéros à gauche (on lit les 40 derniers caractères). Le montant, non indexé, est dans data. L'émetteur (address) est le contrat du jeton, qui tient le registre des soldes.`

    if (variant === 'recipient' || variant === 'sender') {
      const want = variant === 'recipient' ? to : from
      const other = variant === 'recipient' ? from : to
      const t0tail = '0x' + T0.slice(-40)
      const { options, answer } = mkChoice(rng, want, [other, t.contract.toLowerCase(), t0tail], 4)
      return {
        prompt: `Ce journal a été émis par une transaction du dossier. Quelle adresse a ${variant === 'recipient' ? 'reçu' : 'envoyé'} les jetons ?`,
        context: `Données brutes du journal, telles qu'affichées dans l'onglet « Logs » de l'explorateur (${chainName}).`,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${layout}\n\nIci ${variant === 'recipient' ? 'topics[2]' : 'topics[1]'} donne ${want} : c'est ${variant === 'recipient' ? 'le destinataire' : 'l\'expéditeur'}.\n\n- ${other} est ${variant === 'recipient' ? 'l\'expéditeur (topics[1])' : 'le destinataire (topics[2])'} : inverser les deux topics inverse le sens du flux.\n- ${t.contract.toLowerCase()} est le contrat ${t.sym} qui émet l'événement : il n'est partie au transfert que comme teneur de registre.\n- ${t0tail} n'est que la fin de topics[0], l'empreinte de la signature de l'événement : ce n'est pas une adresse.`,
      }
    }

    if (variant === 'amount') {
      const wrong = wrongDecAmount(raw, t.dec)
      return {
        prompt: `Quel montant de ${t.sym} ce journal transfère-t-il, en unités lisibles ?`,
        context: `Le contrat émetteur est celui du jeton ${t.name} (${t.sym}) sur ${chainName}. Convertissez data (hexadécimal) en décimal, puis appliquez les décimales on-chain du jeton.`,
        visual,
        kind: 'number',
        answer: amount,
        tolerance: 0.0005,
        unit: t.sym,
        explain: `data = ${data.replace(/^0x0+/, '0x')} en hexadécimal, soit ${fmtBaseUnits(raw)} unités de base. Le jeton ${t.sym} a **${t.dec} décimales** sur ${chainName} : on divise par 10^${t.dec}, ce qui donne **${A} ${t.sym}**.\n\nPiège classique : appliquer les décimales d'une autre chaîne ou d'un autre jeton. Avec ${t.dec === 18 ? 6 : 18} décimales, on lirait ${wrong} ${t.sym}. ${t.chain === 'bsc' && (t.sym === 'USDT' || t.sym === 'USDC') ? `Sur BNB Smart Chain, l'${t.sym} « Binance-Peg » a 18 décimales, contre 6 pour l'${t.sym} d'Ethereum.` : 'À retenir : USDT et USDC ont 6 décimales sur Ethereum et 18 sur BNB Smart Chain ; DAI et WETH 18 ; WBTC 8.'} Toujours vérifier la fonction decimals() du contrat émetteur.`,
      }
    }

    if (variant === 'token') {
      const repertoire = sameChain.map((x) => `${x.contract} → ${x.name} (${x.sym})`)
      const label = (x: Tok) => `${x.name} (${x.sym})`
      const native = `${t.chain === 'eth' ? 'Ether (ETH)' : 'BNB'} natif`
      const d = [...(trap ? [label(trap)] : []), native, ...rng.shuffle(sameChain.filter((x) => x !== t && x !== trap).map(label))]
      const { options, answer } = mkChoice(rng, label(t), d, 4)
      return {
        prompt: 'Quel actif ce journal transfère-t-il ?',
        context: `Répertoire des contrats de jetons connus sur ${chainName} :\n${rng.shuffle(repertoire).join('\n')}`,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Un journal ne contient pas le nom du jeton : c'est **l'adresse émettrice** (champ address) qui l'identifie. Ici ${t.contract} est le contrat ${t.name} : l'actif transféré est du **${t.sym}**, ${A} ${t.sym} une fois les ${t.dec} décimales appliquées.\n\n${trap ? `Le piège : le destinataire (topics[2]) est le contrat ${trap.sym}. Des jetons ${t.sym} ont été envoyés par erreur à l'adresse du contrat ${trap.sym} — un accident fréquent, et ces fonds y sont généralement bloqués. Le jeton transféré reste celui de l'émetteur.\n\n` : ''}L'actif natif (${NATIVE[t.chain]}) n'émet jamais d'événement Transfer : ses mouvements sont la valeur de la transaction ou des transactions internes. Les autres contrats du répertoire n'apparaissent pas comme émetteur. Attention aux jetons contrefaits qui reprennent le nom et le symbole d'un vrai : seule l'adresse du contrat fait foi.`,
      }
    }

    // mint
    const issuer = MINT_ISSUER[`${t.chain}:${t.sym}`]
    const correct = `Création (mint) de ${A} ${t.sym} au profit de ${sh(to)}`
    const wrong = wrongDecAmount(raw, t.dec)
    const d = [
      `Destruction (burn) de ${A} ${t.sym} prélevés sur ${sh(to)}`,
      `Création (mint) de ${wrong} ${t.sym} au profit de ${sh(to)}`,
      `Transfert de ${A} ${t.sym} envoyés par le portefeuille 0x0000…0000 de l'émetteur, à identifier`,
    ]
    const { options, answer } = mkChoice(rng, correct, d, 4)
    return {
      prompt: 'Que décrit ce journal ?',
      context: `Contrat émetteur : ${t.name} (${t.sym}) sur ${chainName}.`,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `topics[1] (from) ne contient que des zéros : l'expéditeur est l'**adresse nulle**. Un Transfer depuis l'adresse nulle est la convention ERC-20 pour une **création de jetons** : le contrat a émis ${A} ${t.sym} (data = ${fmtBaseUnits(raw)} unités de base, ${t.dec} décimales) au profit de ${to} (topics[2]). Ici, l'émission relève de ${issuer}.\n\n- Burn ? Non : une destruction est un Transfer **vers** l'adresse nulle (topics[2] à zéro).\n- ${wrong} ${t.sym} ? C'est le montant lu avec ${t.dec === 18 ? 6 : 18} décimales au lieu de ${t.dec}.\n- L'adresse nulle n'est le portefeuille de personne : il n'y a aucun titulaire à réquisitionner. L'interlocuteur pour une émission est l'émetteur du jeton.`,
    }
  },
}

// ── 3. Décoder les données d'entrée ─────────────────────────────────────────

const SIG_TRANSFER = 'transfer(address,uint256)'
const SIG_APPROVE = 'approve(address,uint256)'
const SIG_TF = 'transferFrom(address,address,uint256)'
const SIG_PERMIT = 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'
const SIG_SAFA = 'setApprovalForAll(address,bool)'
const SIG_BALANCE = 'balanceOf(address)'
const MAX_WORD = 'f'.repeat(64)

const SCAM_NAMES = [
  ['SecurityUpdate()', 'Security Update'],
  ['Claim()', 'Claim'],
  ['ClaimReward()', 'Claim Reward'],
  ['Connect()', 'Connect'],
  ['Verify()', 'Verify'],
] as const

export const selectorDecode: DrillDef = {
  id: 'selector-decode',
  title: 'Décoder un appel de contrat',
  description: 'Sélecteur de fonction, arguments encodés par mots de 32 octets, autorisations illimitées, destinataire d\'un swap, contrats non vérifiés : lire les données d\'entrée brutes d\'une transaction.',
  level: 3,
  track: 'contrats',
  icon: 'Binary',
  generate(seed) {
    const rng = rngFor(seed, 'selector-decode')
    const variant = rng.weighted([['identify', 3], ['spender', 2], ['allowance', 2.5], ['swapTo', 2.5], ['unverified', 1.5]] as const)
    const t = rng.pick(TOKENS.filter((x) => isStable(x.sym) && x.sym !== 'BUSD'))
    const chainName = CHAIN_NAME[t.chain]!
    const signer = evmLow(rng)
    const amount = genAmount(rng, t.sym)
    const raw = toBaseUnits(amount, t.dec)
    const A = frMax(amount, 8)
    const W = wrongDecAmount(raw, t.dec)
    const amt: CallArg = { uint: raw.toString() }
    const enc = (sig: string, args: CallArg[], to = t.contract) => calldata(STUB, t.chain, { to, sig, args })

    if (variant === 'identify') {
      const fn = rng.pick([SIG_TRANSFER, SIG_APPROVE, SIG_TF] as const)
      const a1 = evmLow(rng)
      const a2 = evmLow(rng)
      const data = fn === SIG_TF ? enc(fn, [{ addr: a1 }, { addr: a2 }, amt]) : enc(fn, [{ addr: a1 }, amt])
      const table = rng.shuffle([SIG_TRANSFER, SIG_APPROVE, SIG_TF, SIG_PERMIT, SIG_SAFA, SIG_BALANCE].map((s) => `${selectorOf(s)} → ${s}`))
      const txt = {
        transfer: (to: string, v: string) => `transfer : envoie ${v} ${t.sym} du signataire à ${sh(to)}`,
        approve: (sp: string, v: string) => `approve : autorise ${sh(sp)} à dépenser jusqu'à ${v} ${t.sym} du signataire`,
        tf: (f: string, to: string, v: string) => `transferFrom : fait passer ${v} ${t.sym} de ${sh(f)} à ${sh(to)}, en vertu d'une autorisation`,
      }
      let correct: string
      let d: string[]
      if (fn === SIG_TRANSFER) {
        correct = txt.transfer(a1, A)
        d = [txt.approve(a1, A), txt.transfer(a1, W), txt.tf(a1, signer, A)]
      } else if (fn === SIG_APPROVE) {
        correct = txt.approve(a1, A)
        d = [txt.transfer(a1, A), txt.approve(a1, W), txt.tf(signer, a1, A)]
      } else {
        correct = txt.tf(a1, a2, A)
        d = [txt.tf(a2, a1, A), txt.transfer(a2, A), txt.tf(a1, a2, W)]
      }
      const { options, answer } = mkChoice(rng, correct, d, 4)
      const words = fn === SIG_TF ? `[0] = from (${sh(a1)}), [1] = to (${sh(a2)}), [2] = value` : `[0] = ${fn === SIG_APPROVE ? 'spender' : 'to'} (${sh(a1)}), [1] = value`
      return {
        prompt: 'Que fait cet appel ?',
        context: `Transaction signée par ${signer}, adressée au contrat ${t.sym} sur ${chainName} (${t.contract}).\n\nExtrait d'une base publique de signatures :\n${table.join('\n')}`,
        visual: { type: 'list', title: 'Données d\'entrée (vue « Original »)', items: inputItems(data) },
        kind: 'choice',
        options,
        answer,
        explain: `Les 4 premiers octets des données d'entrée sont le **sélecteur** : les 4 premiers octets du Keccak-256 de la signature canonique. ${data.slice(0, 10)} correspond à **${fn}**.\n\nViennent ensuite les arguments, un mot de 32 octets chacun : ${words}. Les adresses sont complétées par des zéros à gauche ; la valeur ${fmtBaseUnits(raw)} (hexadécimal converti) se divise par 10^${t.dec} — ${t.sym} a ${t.dec} décimales sur ${chainName} — soit **${A} ${t.sym}**.\n\nLes leurres confondent soit la fonction (transfer, approve et transferFrom prennent des arguments très semblables : seul le sélecteur tranche), soit l'ordre des adresses, soit les décimales (${W} ${t.sym} avec ${t.dec === 18 ? 6 : 18} décimales). ${fn === SIG_APPROVE ? 'Un approve ne déplace aucun jeton : il crée un droit de dépense que le bénéficiaire exercera plus tard avec transferFrom.' : fn === SIG_TF ? 'Avec transferFrom, le signataire n\'est pas le titulaire des jetons : il exerce une autorisation donnée auparavant par from (approve ou permit).' : 'Avec transfer, les jetons partent du signataire lui-même.'}`,
      }
    }

    if (variant === 'spender' || variant === 'allowance') {
      const spender = evmLow(rng)
      const mode = variant === 'spender' ? (rng.chance(0.6) ? 'max' : 'finite') : rng.weighted([['max', 4.5], ['finite', 3.5], ['zero', 2]] as const)
      const valueArg: CallArg = mode === 'max' ? { uint: (2n ** 256n - 1n).toString() } : mode === 'zero' ? { uint: 0 } : amt
      const data = enc(SIG_APPROVE, [{ addr: spender }, valueArg])
      const visual: DrillVisual = { type: 'list', title: `Données d'entrée — appel ${SIG_APPROVE}`, items: inputItems(data) }
      const ctx = `Transaction signée par ${signer} (la victime), adressée au contrat ${t.sym} sur ${chainName} (${t.contract}). Sélecteur ${selectorOf(SIG_APPROVE)} = ${SIG_APPROVE}.`
      if (variant === 'spender') {
        const look = lookalike(rng, 'eth', spender, 6, 4).toLowerCase()
        const { options, answer } = mkChoice(rng, spender, [t.contract.toLowerCase(), signer, look], 4)
        return {
          prompt: 'Quelle adresse peut désormais dépenser les jetons de la victime ?',
          context: ctx,
          visual,
          kind: 'choice',
          options,
          answer,
          explain: `approve(address spender, uint256 value) : le premier mot après le sélecteur est **spender**, ici ${spender}. C'est l'adresse qui pourra appeler transferFrom pour prélever ${mode === 'max' ? 'sans limite' : `jusqu'à ${A} ${t.sym}`} sur le solde de la victime, sans nouvelle signature de sa part.${mode === 'max' ? ' Le second mot ne contient que des « f » : 2²⁵⁶−1, la valeur maximale, soit une autorisation illimitée.' : ''}\n\n- ${t.contract.toLowerCase()} est le contrat ${t.sym} appelé (champ « to » de la transaction) : il enregistre l'autorisation, il n'en bénéficie pas.\n- ${signer} est la victime, qui signe et accorde l'autorisation.\n- ${look} reprend le début et la fin du spender, mais son milieu diffère : c'est une autre adresse. Comparez toujours l'adresse entière.\n\nDans une affaire de drainer, le spender est le point de départ : suivez ses appels transferFrom et l'adresse qui reçoit les jetons.`,
        }
      }
      // allowance
      const other = genAmount(rng, t.sym)
      const otherRaw = toBaseUnits(other, t.dec)
      const shownAmount = mode === 'finite' ? A : frMax(other, 8)
      const shownWrong = mode === 'finite' ? W : wrongDecAmount(otherRaw, t.dec)
      const O_MAX = 'Illimité : 2²⁵⁶−1, la valeur maximale (mot rempli de « f »)'
      const O_ZERO = 'Aucun : valeur 0, l\'autorisation précédente est révoquée'
      const O_FIN = `${shownAmount} ${t.sym}`
      const O_WRONG = `${shownWrong} ${t.sym}`
      const correct = mode === 'max' ? O_MAX : mode === 'zero' ? O_ZERO : O_FIN
      const { options, answer } = mkChoice(rng, correct, [O_MAX, O_ZERO, O_FIN, O_WRONG], 4)
      const body = data.slice(10 + 64)
      return {
        prompt: `Quel montant cette autorisation permet-elle à ${sh(spender)} de prélever ?`,
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Le second mot (value) vaut ${body.replace(/^0+(?=.)/, '') === '0' ? '0' : body === MAX_WORD ? 'ffff…ffff (64 « f »)' : `0x${body.replace(/^0+/, '')} = ${fmtBaseUnits(raw)} unités de base`}. ${mode === 'max' ? 'C\'est 2²⁵⁶−1, la plus grande valeur possible : les interfaces de DEX (et les drainers) la demandent pour ne plus jamais redemander d\'autorisation. Le spender peut vider tout le solde présent et futur de ce jeton, tant que l\'autorisation n\'est pas révoquée.' : mode === 'zero' ? 'Une autorisation à 0 est une **révocation** : c\'est le geste de protection qu\'on conseille aux victimes après un drainer (via revoke.cash ou l\'explorateur).' : `Avec ${t.dec} décimales (${t.sym} sur ${chainName}), cela fait **${A} ${t.sym}** : le spender ne pourra pas prélever davantage.`}\n\n${mode !== 'finite' ? `L'option « ${O_FIN} » ne correspond à rien dans les données ; « ${O_WRONG} » en est la lecture avec de mauvaises décimales.` : `« ${O_WRONG} » est la lecture avec ${t.dec === 18 ? 6 : 18} décimales au lieu de ${t.dec}. Une autorisation illimitée remplirait le mot de « f » ; une révocation le laisserait à 0.`}`,
      }
    }

    if (variant === 'swapTo') {
      const bsc = t.chain === 'bsc'
      const router = bsc ? PANCAKE_V2_ROUTER : UNI_V2_ROUTER
      const routerName = bsc ? 'PancakeSwap : Router v2' : 'Uniswap V2 : Router 2'
      const wrapped = tokenOf(t.chain, bsc ? 'WBNB' : 'WETH')
      const outs = TOKENS.filter((x) => x.chain === t.chain && x !== t && x !== wrapped)
      const out = rng.pick(outs)
      const ethIn = rng.chance(0.4)
      const to = rng.chance(0.65) ? evmLow(rng) : signer
      const deadline = { uint: dayTime(rng) + 1200 }
      const outMin: CallArg = { uint: toBaseUnits(genAmount(rng, out.sym), out.dec).toString() }
      let sig: string
      let args: CallArg[]
      let layout: string
      let path: Tok[]
      if (ethIn) {
        sig = 'swapExactETHForTokens(uint256,address[],address,uint256)'
        path = [wrapped, out]
        args = [outMin, { list: path.map((p) => ({ addr: p.contract })) }, { addr: to }, deadline]
        layout = '[0] amountOutMin, [1] position du tableau path (0x80 = 128 octets), [2] **to**, [3] deadline, [4] longueur de path, [5] et suivants : les adresses du chemin'
      } else {
        sig = 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)'
        path = [t, wrapped, out]
        args = [amt, outMin, { list: path.map((p) => ({ addr: p.contract })) }, { addr: to }, deadline]
        layout = '[0] amountIn, [1] amountOutMin, [2] position du tableau path (0xa0 = 160 octets), [3] **to**, [4] deadline, [5] longueur de path, [6] et suivants : les adresses du chemin'
      }
      const data = calldata(STUB, t.chain, { to: router, sig, args })
      const last = path[path.length - 1].contract.toLowerCase()
      const first = path[0].contract.toLowerCase()
      const d = to === signer ? [router.toLowerCase(), last, first] : [signer, router.toLowerCase(), last]
      const { options, answer } = mkChoice(rng, to, d, 4)
      return {
        prompt: 'À quelle adresse le routeur versera-t-il les jetons achetés ?',
        context: `Transaction signée par ${signer}, adressée au routeur ${routerName} (${router}) sur ${chainName}${ethIn ? `, avec une valeur de ${frMax(round(rng.float(0.2, 25), 3), 3)} ${NATIVE[t.chain]}` : ''}. Signature : ${sig}.`,
        visual: { type: 'list', title: 'Données d\'entrée (vue « Original »)', items: inputItems(data) },
        kind: 'choice',
        options,
        answer,
        explain: `Les arguments statiques occupent un mot chacun, dans l'ordre de la signature ; le tableau path, dynamique, n'est représenté dans l'en-tête que par sa position, son contenu étant placé à la fin. Ici : ${layout}.\n\nLe paramètre to vaut ${to} : c'est le **bénéficiaire du swap**${to === signer ? ', qui est ici le signataire lui-même' : ', différent du signataire : une nouvelle adresse à suivre, que l\'on ne verrait pas en se contentant de l\'historique du signataire'}.\n\n- ${router.toLowerCase()} est le routeur appelé : il fait transiter les fonds sans les garder.\n- ${last} est le dernier élément de path : le contrat du jeton acheté (${out.sym}), pas un destinataire.\n${to === signer ? `- ${first} est le premier élément de path, le jeton vendu.` : `- ${signer} a signé et payé, mais ne reçoit rien dans cette transaction.`}`,
      }
    }

    // unverified
    const named = rng.chance(0.55)
    const contract = evm(rng)
    const e = round(rng.float(0.05, 12), 4)
    if (!named) {
      let sel = selectorOf(`f${rng.int(100000, 999999)}(uint256)`)
      while (SELECTOR_DB[sel]) sel = selectorOf(`g${rng.int(100000, 999999)}(uint256)`)
      const correct = 'Le sélecteur ne figure dans aucune base de signatures connue : le nom de la fonction est inconnu, il faut juger sur les effets (transferts, journaux, transactions internes) et, au besoin, analyser le bytecode'
      const { options, answer } = mkChoice(rng, correct, [
        'La transaction a échoué : un appel réussi affiche toujours un nom de fonction',
        'C\'est un simple envoi d\'ETH sans données d\'entrée',
        'Le contrat est forcément malveillant : seuls les escrocs ne publient pas leur code',
      ], 4)
      return {
        prompt: 'Que pouvez-vous conclure de cet affichage ?',
        context: `Transaction de ${sh(signer)} vers le contrat ${contract}, dont le code source n'est pas publié (contrat non vérifié). Valeur : ${frMax(e, 4)} ETH. Colonne « Méthode » de l'explorateur : ${sel}. Statut : succès.`,
        visual: { type: 'list', title: 'Données d\'entrée', items: [`MethodID : ${sel}`, `[0] : ${word(rng.int(1, 9999).toString(16))}`] },
        kind: 'choice',
        options,
        answer,
        explain: `Quand l'explorateur affiche le sélecteur brut (${sel}) au lieu d'un nom, c'est qu'il n'a ni le code source vérifié (et donc l'ABI) du contrat, ni de correspondance dans les bases publiques de signatures (type 4byte.directory). Un sélecteur n'est qu'une empreinte de 4 octets : on ne peut pas remonter à la signature par calcul.\n\nLa transaction a pourtant réussi (statut succès) et elle porte des données d'entrée : ce n'est ni un échec, ni un envoi simple (qui afficherait « Transfer » et 0x comme données). Un contrat non vérifié n'est pas une preuve de malveillance — beaucoup de robots de trading et de contrats privés ne publient pas leur code — mais il impose d'analyser les **effets** : transactions internes, événements, soldes avant et après, et si besoin le bytecode (décompilation).`,
      }
    }
    const [sig, pretty] = rng.pick(SCAM_NAMES)
    const sel = selectorOf(sig)
    const correct = 'Le nom provient d\'une base publique que n\'importe qui alimente, et c\'est l\'auteur du contrat qui l\'a choisi : il ne prouve rien ; seuls les effets observés (transferts, transactions internes, approvals) disent ce que fait l\'appel'
    const { options, answer } = mkChoice(rng, correct, [
      `Le nom est certifié par l'explorateur : la fonction fait bien ce qu'annonce « ${pretty} »`,
      'Le contrat est vérifié, puisque le nom de la fonction s\'affiche',
      'Le sélecteur identifie l\'auteur du contrat, qu\'il suffit de réquisitionner auprès de l\'explorateur',
    ], 4)
    return {
      prompt: 'Que pouvez-vous conclure de cet affichage ?',
      context: `Une victime a envoyé ${frMax(e, 4)} ETH au contrat ${contract} (code source non publié) après avoir reçu un message l'invitant à « sécuriser son portefeuille ». Colonne « Méthode » de l'explorateur : « ${pretty} » (sélecteur ${sel}). Dans la même transaction, une transaction interne de ${frMax(e, 4)} ETH part du contrat vers ${sh(evm(rng))}.`,
      kind: 'choice',
      options,
      answer,
      explain: `Pour un contrat non vérifié, l'explorateur ne connaît que le sélecteur ${sel} ; il affiche un nom lisible s'il trouve dans une base publique une signature dont le Keccak-256 commence par ces 4 octets. Or n'importe qui peut enregistrer une signature, et l'auteur du contrat choisit librement le nom de ses fonctions : ${sig} est une signature valide, qui ne fait que ce que dit le code.\n\nLes campagnes d'hameçonnage « Security Update » ou « Claim » exploitent exactement cela : la fonction se contente de reverser l'ETH reçu à l'escroc. C'est ce que montre ici la transaction interne : les ${frMax(e, 4)} ETH ressortent aussitôt du contrat. Un nom affiché ne signifie pas que le contrat est vérifié, et un sélecteur n'identifie personne : on suit l'adresse qui reçoit les fonds.`,
    }
  },
}

// ── 4. Contrats de dépôt (forwarders) ───────────────────────────────────────

export const forwarderSpot: DrillDef = {
  id: 'forwarder-spot',
  title: 'Adresse de dépôt contrat',
  description: 'Certaines plateformes attribuent à chaque client un contrat de dépôt (forwarder, déployé par CREATE2) qui reverse les fonds au hot wallet. Savoir quelle adresse réquisitionner et lire le reversement.',
  level: 3,
  track: 'contrats',
  icon: 'FileInput',
  generate(seed) {
    const rng = rngFor(seed, 'forwarder-spot')
    const variant = rng.weighted([['requis', 3], ['factory', 2], ['proof', 2], ['signer', 2], ['eth', 2]] as const)
    const ex = rng.pick(EXCHANGES)
    const S = evm(rng)
    const DEP = evm(rng)
    const HOT = evm(rng)
    const OP = evm(rng)
    const FAC = evm(rng)
    const t1 = dayTime(rng)
    const HOT_L = `${ex} — Hot Wallet`

    if (variant === 'eth') {
      const e = round(rng.float(0.2, 40), 4)
      const rows: Row[] = [
        { from: S, to: DEP, value: e, asset: 'ETH', method: 'Transfer', time: t1, fromLabel: 'Suspect', toLabel: 'Contrat (Forwarder, vérifié)' },
        { from: DEP, to: HOT, value: e, asset: 'ETH', method: 'Transfer (interne)', time: t1, fromLabel: 'Contrat (Forwarder, vérifié)', toLabel: HOT_L },
      ]
      const correct = 'Le contrat de dépôt a reversé l\'ETH au hot wallet dans la même transaction : c\'est une transaction interne, visible dans l\'onglet des transactions internes et non dans la liste des transactions'
      const { options, answer } = mkChoice(rng, correct, [
        'La transaction est encore en attente : l\'ETH sera crédité à la prochaine confirmation',
        'L\'ETH a été converti en WETH, qui s\'affiche dans l\'onglet des jetons',
        'Le dépôt a échoué et l\'ETH a été rendu au suspect',
      ], 4)
      return {
        prompt: `L'adresse ${sh(DEP)} a reçu ${frMax(e, 4)} ETH du suspect, mais son solde est de 0 ETH. Pourquoi ?`,
        context: `Le suspect déclare avoir envoyé ces ETH « sur son compte ${ex} ». ${sh(DEP)} est un contrat dont le code vérifié s'appelle Forwarder.`,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'choice',
        options,
        answer,
        explain: `${sh(DEP)} est un **contrat de dépôt** (forwarder) : chaque client de ${ex} en reçoit un. Sa fonction de réception (receive/fallback) renvoie immédiatement tout ETH reçu vers le portefeuille principal de la plateforme. Le reversement se produit dans la même transaction, sous forme de **transaction interne** : il n'a ni signature ni hash propres et n'apparaît que dans l'onglet des transactions internes.\n\nLa transaction est confirmée (le reversement en atteste), aucun WETH n'apparaît et rien n'est revenu au suspect. Pour la réquisition, c'est bien ${sh(DEP)}, l'adresse propre au client, qu'il faut citer — avec le hash de la transaction de dépôt — et non le hot wallet ${sh(HOT)}, partagé par tous les clients.`,
      }
    }

    const asset = rng.pick(['USDT', 'USDC'])
    const t = tokenOf('eth', asset)
    const amount = round(rng.float(300, 180000), 2)
    const first = variant === 'factory' ? true : rng.chance(0.5)
    const t2 = t1 + rng.int(1, 14) * 3600 + rng.int(0, 3599)
    const method = first ? 'createForwarder' : 'flushTokens'
    const sel = selectorOf(first ? 'createForwarder(address,bytes32)' : 'flushTokens(address)')
    const depLabel = first ? 'Adresse sans code au moment du dépôt' : 'Contrat (Forwarder, vérifié)'
    const rows: Row[] = [
      { from: S, to: DEP, value: amount, asset, method: 'transfer', time: t1, fromLabel: 'Suspect', toLabel: depLabel },
      { from: DEP, to: HOT, value: amount, asset, method, time: t2, fromLabel: depLabel, toLabel: HOT_L },
    ]
    const ctx = `Transaction 2 — from : ${OP} (compte externe, non étiqueté) ; to : ${first ? `${FAC} (contrat vérifié « ForwarderFactory », étiqueté ${ex})` : `${DEP} (contrat Forwarder, déployé auparavant par la fabrique ${FAC} de ${ex})`} ; données d'entrée commençant par ${sel} (${method}).`
    const base = `${sh(DEP)} est un **contrat de dépôt** (forwarder) attribué à un client de ${ex}. ${first ? `Son adresse a été calculée d'avance par CREATE2 (à partir de l'adresse de la fabrique, d'un sel et du code) : elle pouvait recevoir les ${asset} avant même d'avoir du code. La transaction 2 appelle createForwarder sur la fabrique ${sh(FAC)}, qui déploie le contrat à cette adresse et reverse les jetons au hot wallet.` : `Les jetons y restent jusqu'à ce que la plateforme appelle flushTokens, qui les reverse au hot wallet.`} La transaction 2 est signée par ${sh(OP)}, le portefeuille opérationnel de la plateforme, qui paie le gas.`

    if (variant === 'requis') {
      const { options, answer } = mkChoice(rng, DEP, [HOT, OP, FAC], 4)
      return {
        prompt: `Le suspect dit avoir envoyé ces ${asset} « sur son compte ${ex} ». Quelle adresse faut-il citer dans la réquisition à ${ex} pour identifier le titulaire du compte ?`,
        context: ctx,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'choice',
        options,
        answer,
        explain: `${base}\n\nC'est donc ${DEP} qui identifie le client : la plateforme sait à quel compte elle l'a attribuée. La réquisition cite cette adresse, le hash et la date du dépôt et le montant.\n\n- ${sh(HOT)} est le hot wallet, commun à tous les clients : le citer seul ne désigne personne.\n- ${sh(OP)} est le portefeuille opérationnel de ${ex}, qui déclenche les reversements pour tous les dépôts.\n- ${sh(FAC)} est la fabrique de contrats de dépôt, une infrastructure de la plateforme.`,
      }
    }
    if (variant === 'factory') {
      const correct = `Elle déploie le contrat de dépôt du client à une adresse calculée d'avance (CREATE2) : l'adresse pouvait recevoir les ${asset} avant d'avoir du code, et le déploiement reverse aussitôt les jetons au hot wallet`
      const { options, answer } = mkChoice(rng, correct, [
        'Elle ouvre un nouveau compte client chez la plateforme : c\'est la date d\'ouverture du compte du suspect',
        `Elle convertit les ${asset} en un autre jeton avant leur envoi au hot wallet`,
        'C\'est un mixeur : elle brouille le lien entre le dépôt et le hot wallet',
      ], 4)
      return {
        prompt: `À quoi sert l'appel createForwarder adressé à ${sh(FAC)} dans la transaction 2 ?`,
        context: ctx,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'choice',
        options,
        answer,
        explain: `${base}\n\nCREATE2 rend l'adresse d'un contrat prévisible : la plateforme peut afficher au client son adresse de dépôt sans payer le déploiement, qu'elle ne fait qu'au premier reversement. D'où l'étiquette « adresse sans code » au moment du dépôt.\n\nCe n'est pas l'ouverture du compte (l'adresse avait été attribuée au client avant le dépôt), aucune conversion n'a lieu (${asset} entrent, ${asset} sortent, même montant) et rien n'est brouillé : le flux dépôt → contrat → hot wallet reste entièrement lisible et attribuable à ${ex}.`,
      }
    }
    if (variant === 'proof') {
      const correct = `Un reversement déclenché par ${ex}, dont le portefeuille opérationnel paie le gas : il confirme que ${sh(DEP)} est une adresse de dépôt de la plateforme, pas un portefeuille du suspect`
      const { options, answer } = mkChoice(rng, correct, [
        `Le suspect a vidé ${sh(DEP)}, son portefeuille personnel, vers un autre de ses portefeuilles`,
        'Le hot wallet a prélevé les fonds de sa propre initiative, sans aucune transaction signée',
        `Un piratage du contrat ${sh(DEP)} : un tiers inconnu a détourné le dépôt`,
      ], 4)
      return {
        prompt: 'Que montre la transaction 2 ?',
        context: ctx,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'choice',
        options,
        answer,
        explain: `${base}\n\nC'est le schéma « réception puis balayage » des adresses de dépôt, sauf qu'ici le balayage est un appel de contrat. Le suspect n'a rien signé dans la transaction 2 (elle émane de ${sh(OP)}), toute transaction a un signataire, et le reversement aboutit sur le hot wallet étiqueté ${ex} : aucun tiers inconnu n'intervient. Le dépôt est donc acquis à la plateforme, qui peut identifier le client titulaire de ${sh(DEP)}.`,
      }
    }
    // signer
    const { options, answer } = mkChoice(rng, OP, [DEP, S, HOT], 4)
    return {
      prompt: 'Qui a signé la transaction 2 (et en a payé le gas) ?',
      context: ctx,
      visual: { type: 'transfers', chain: 'eth', rows },
      kind: 'choice',
      options,
      answer,
      explain: `${base}\n\nLe piège : dans la liste des transferts de jetons, la ligne de la transaction 2 part de ${sh(DEP)}. Mais « from » d'un événement Transfer n'est pas le signataire de la transaction : c'est le compte dont le solde de jetons diminue. Le signataire est le champ from de la transaction, ici ${sh(OP)}.\n\n- ${sh(DEP)} est un contrat : un contrat ne signe jamais, il s'exécute quand on l'appelle.\n- Le suspect ${sh(S)} n'intervient que dans la transaction 1.\n- Le hot wallet ${sh(HOT)} reçoit les fonds, il n'appelle rien.`,
    }
  },
}

// ── 5. Swap agrégé ──────────────────────────────────────────────────────────

interface Route {
  path: string[]
  wrapIn?: boolean
  unwrapOut?: boolean
}

const ROUTES: Route[] = [
  { path: ['USDT', 'WETH', 'WBTC'] },
  { path: ['USDC', 'WETH', 'WBTC'] },
  { path: ['DAI', 'USDC', 'WETH', 'WBTC'] },
  { path: ['WBTC', 'WETH', 'USDT'] },
  { path: ['WBTC', 'WETH', 'USDC', 'DAI'] },
  { path: ['WETH', 'USDC', 'DAI'], wrapIn: true },
  { path: ['WETH', 'WBTC'], wrapIn: true },
  { path: ['USDT', 'USDC', 'WETH'], unwrapOut: true },
  { path: ['DAI', 'USDT', 'WETH'], unwrapOut: true },
  { path: ['WBTC', 'WETH'], unwrapOut: true },
]

export const aggregatorRoute: DrillDef = {
  id: 'aggregator-route',
  title: 'Reconstituer un swap agrégé',
  description: 'Un agrégateur enchaîne plusieurs pools en une seule transaction et peut verser le résultat à un tiers. Retrouver l\'actif final, le bénéficiaire, le nombre de pools et le montant reçu.',
  level: 3,
  track: 'contrats',
  icon: 'Route',
  generate(seed) {
    const rng = rngFor(seed, 'aggregator-route')
    const variant = rng.weighted([['final', 3], ['pools', 2], ['amount', 2.5]] as const)
    const route = rng.pick(ROUTES)
    const P = rng.int(2400, 3900)
    const Q = rng.int(55000, 98000)
    const px = (a: string) => (isStable(a) ? 1 : a === 'WBTC' ? Q : P)
    const S = evm(rng)
    const RL = '1inch : Aggregation Router V5'
    const SL = 'Suspect (signataire)'
    const ben = rng.chance(0.55) ? evm(rng) : S
    const benL = ben === S ? SL : undefined
    const nPools = route.path.length - 1
    const dexes = ['Uniswap V3', 'Uniswap V2', 'Sushiswap', 'Balancer']
    const pools = Array.from({ length: nPools }, (_, i) => {
      const a = route.path[i]
      const b = route.path[i + 1]
      const dex = isStable(a) && isStable(b) ? 'Curve' : rng.pick(dexes)
      return { addr: evm(rng), label: `Pool ${dex} ${a}/${b}` }
    })
    const usd = rng.float(3000, 400000)
    const amounts: number[] = [roundA(route.path[0], usd / px(route.path[0]))]
    for (let i = 1; i < route.path.length; i++) {
      const fee = rng.pick([0.0001, 0.0005, 0.003])
      amounts.push(roundA(route.path[i], (amounts[i - 1] * px(route.path[i - 1]) / px(route.path[i])) * (1 - fee) * rng.float(0.997, 1.001)))
    }
    const method = rng.pick(['swap', 'unoswap'])
    const src = route.wrapIn ? 'ETH' : route.path[0]
    const dst = route.unwrapOut ? 'ETH' : route.path[route.path.length - 1]
    const out = amounts[amounts.length - 1]
    const feeAmt = rng.chance(0.4) ? roundA(dst, out * rng.float(0.0005, 0.003)) : 0
    const received = roundA(dst, out - feeAmt)
    const COLL = evm(rng)
    const COLL_L = 'Collecteur de frais (intégrateur)'
    const rows: Row[] = []
    const r = (from: string, fromLabel: string | undefined, to: string, toLabel: string | undefined, value: number, asset: string) => rows.push({ from, fromLabel, to, toLabel, value, asset, method })
    if (route.wrapIn) {
      r(S, SL, ONEINCH_V5, RL, amounts[0], 'ETH')
      r(ONEINCH_V5, RL, WETH_ADDR, 'Contrat WETH', amounts[0], 'ETH')
      r(NULL, NULL_LABEL, ONEINCH_V5, RL, amounts[0], 'WETH')
      r(ONEINCH_V5, RL, pools[0].addr, pools[0].label, amounts[0], 'WETH')
    } else if (rng.chance(0.5)) {
      r(S, SL, pools[0].addr, pools[0].label, amounts[0], route.path[0])
    } else {
      r(S, SL, ONEINCH_V5, RL, amounts[0], route.path[0])
      r(ONEINCH_V5, RL, pools[0].addr, pools[0].label, amounts[0], route.path[0])
    }
    for (let i = 1; i < nPools; i++) r(pools[i - 1].addr, pools[i - 1].label, pools[i].addr, pools[i].label, amounts[i], route.path[i])
    const lastPool = pools[nPools - 1]
    if (route.unwrapOut) {
      r(lastPool.addr, lastPool.label, ONEINCH_V5, RL, out, 'WETH')
      r(ONEINCH_V5, RL, NULL, NULL_LABEL, out, 'WETH')
      r(WETH_ADDR, 'Contrat WETH', ONEINCH_V5, RL, out, 'ETH')
      if (feeAmt) r(ONEINCH_V5, RL, COLL, COLL_L, feeAmt, 'ETH')
      r(ONEINCH_V5, RL, ben, benL, received, 'ETH')
    } else if (feeAmt) {
      r(lastPool.addr, lastPool.label, ONEINCH_V5, RL, out, dst)
      r(ONEINCH_V5, RL, COLL, COLL_L, feeAmt, dst)
      r(ONEINCH_V5, RL, ben, benL, received, dst)
    } else {
      r(lastPool.addr, lastPool.label, ben, benL, received, dst)
    }
    const time = dayTime(rng)
    rows.forEach((x) => (x.time = time))
    const chain = `${src}${route.wrapIn ? ' (enveloppé en WETH par le routeur)' : ''} → ${pools.map((p, i) => `${p.label} → ${route.path[i + 1]}`).join(' → ')}${route.unwrapOut ? ' → désenveloppé en ETH par le routeur' : ''} → ${ben === S ? 'le signataire' : sh(ben)}`
    const ctx = `Une seule transaction (${method}) adressée au routeur 1inch par le suspect. Toutes les lignes ci-dessous appartiennent à cette transaction.`
    const routeExplain = `Chemin reconstitué : ${chain}. Le routeur et les pools ne font que transiter ; ce qui compte est l'actif qui sort du dernier pool et son destinataire final.`
    const benNote = ben === S ? 'Ici le bénéficiaire est le signataire lui-même.' : `Ici le bénéficiaire ${sh(ben)} n'est pas le signataire : le paramètre de destination de l'agrégateur a envoyé le résultat à une autre adresse, qui devient la suite de la piste.`

    if (variant === 'final') {
      const penult = route.unwrapOut ? 'WETH' : route.path[route.path.length - 2]
      const correct = `${dst} versés à ${sh(ben)}`
      const d = ben === S ? [`${dst} versés à ${sh(ONEINCH_V5)}`, `${penult} versés à ${sh(S)}`, `${dst} versés à ${sh(lastPool.addr)}`] : [`${dst} versés à ${sh(S)}`, `${penult} versés à ${sh(ben)}`, `${dst} versés à ${sh(ONEINCH_V5)}`]
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: 'Quel actif sort de ce swap, et qui le reçoit ?',
        context: ctx,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'choice',
        options,
        answer,
        explain: `${routeExplain}\n\nL'actif final est donc **${dst}**, reçu par **${sh(ben)}**. ${benNote}\n\nLes leurres : ${penult} n'est qu'un actif intermédiaire, échangé dans le pool suivant ; le routeur (${sh(ONEINCH_V5)}) ne garde rien${feeAmt ? ` (hormis la commission de ${frMax(feeAmt, 8)} ${dst} reversée au collecteur)` : ''} ; ${ben === S ? `le dernier pool (${sh(lastPool.addr)}) est la contrepartie du dernier échange.` : `le signataire ${sh(S)} a payé, mais ne reçoit rien.`}`,
      }
    }
    if (variant === 'pools') {
      return {
        prompt: 'Combien de pools de liquidité ce swap a-t-il traversés ?',
        context: ctx,
        visual: { type: 'transfers', chain: 'eth', rows },
        kind: 'number',
        answer: nPools,
        tolerance: 0,
        unit: 'pool(s)',
        explain: `${routeExplain}\n\nOn compte les adresses distinctes qui reçoivent un actif et en renvoient un autre : ${frList(pools.map((p) => p.label))}, soit **${nPools} pool${nPools > 1 ? 's' : ''}**. Les transferts directs de pool à pool sont typiques des agrégateurs : ils évitent de repasser par le routeur entre deux échanges.\n\nNe comptent pas : le routeur (simple intermédiaire)${route.wrapIn || route.unwrapOut ? ', le contrat WETH (enveloppe 1 pour 1 de l\'ETH, pas un échange de marché), l\'adresse nulle' : ''}${feeAmt ? ', le collecteur de frais' : ''}.`,
      }
    }
    return {
      prompt: `Quel montant de ${dst} le bénéficiaire final reçoit-il ?`,
      context: ctx,
      visual: { type: 'transfers', chain: 'eth', rows },
      kind: 'number',
      answer: received,
      tolerance: 0.0005,
      unit: dst,
      explain: `${routeExplain}\n\nLe bénéficiaire ${sh(ben)} reçoit **${frMax(received, 8)} ${dst}**. ${benNote}${feeAmt ? `\n\nLe dernier pool a livré ${frMax(out, 8)} ${dst}${route.unwrapOut ? ' (en WETH, désenveloppés)' : ''} au routeur, qui en a prélevé ${frMax(feeAmt, 8)} ${dst} de commission pour l'intégrateur avant de verser le reste : ne pas confondre la sortie du pool et le montant effectivement reçu.` : `\n\nAucune commission n'est prélevée ici : le dernier versement correspond à la sortie du dernier pool. Les montants intermédiaires (${route.path.slice(1, -1).join(', ') || 'aucun'}) ne sont que des étapes.`}`,
    }
  },
}

// ── 6. Jetons enveloppés et jetons de reçu ──────────────────────────────────

type ReceiptType = 'WETH' | 'WBTC' | 'aWETH' | 'aUSDC' | 'LP'

const F_NONE = 'Personne : le contrat n\'a ni administrateur, ni pause, ni liste noire ; il faut agir sur les clés du suspect ou là où les fonds ressortent'
const F_ISSUER = 'L\'émetteur, en inscrivant l\'adresse sur la liste noire du contrat, comme pour l\'USDT ou l\'USDC'
const F_CUSTODY = 'Le dispositif de garde : il contrôle la création et le rachat, et le contrat peut être mis en pause par son propriétaire (sans liste noire par adresse)'
const F_GOV = 'La gouvernance du protocole : elle peut geler ou suspendre une réserve entière, pas viser une adresse précise'

export const receiptToken: DrillDef = {
  id: 'receipt-token',
  title: 'Jetons enveloppés et reçus',
  description: 'WETH, WBTC, aTokens, parts LP : ce que représente le jeton, où se trouve l\'actif sous-jacent, ce que signifie une création depuis l\'adresse nulle et qui peut geler.',
  level: 3,
  track: 'contrats',
  icon: 'Ticket',
  generate(seed) {
    const rng = rngFor(seed, 'receipt-token')
    const variant = rng.weighted([['what', 3], ['mint', 2.5], ['freeze', 2.5]] as const)
    const type: ReceiptType = variant === 'freeze' ? rng.pick(['WETH', 'WBTC', 'aWETH', 'LP'] as const) : rng.pick(['WETH', 'WBTC', 'aWETH', 'aUSDC', 'LP'] as const)
    const P = rng.int(2400, 3900)
    const S = evm(rng)
    const SL = 'Suspect'
    const e = round(rng.float(0.5, 60), 4)
    const stable = rng.pick(['USDC', 'USDT', 'DAI'])
    const time = dayTime(rng)
    let rows: Row[]
    let mintIdx = -1
    let what: string
    let backing: string
    let where: string
    let ctx: string
    let asset: string
    switch (type) {
      case 'WETH':
        asset = 'WETH'
        rows = [
          { from: S, to: WETH_ADDR, value: e, asset: 'ETH', method: 'deposit', fromLabel: SL, toLabel: 'Contrat WETH' },
          { from: NULL, to: S, value: e, asset: 'WETH', method: 'deposit', fromLabel: NULL_LABEL, toLabel: SL },
        ]
        what = 'Des ETH « enveloppés » au format ERC-20 : le contrat WETH conserve les ETH déposés et rend 1 ETH pour 1 WETH, à tout moment et sans intermédiaire'
        backing = 'des ETH déposés dans le contrat WETH'
        where = `Les ETH sont dans le contrat WETH (${sh(WETH_ADDR)}) ; ils ressortiront lors d'un withdraw (destruction de WETH et transaction interne d'ETH).`
        ctx = 'Transaction deposit() envoyée au contrat WETH.'
        break
      case 'WBTC': {
        asset = 'WBTC'
        const b = round(rng.float(0.05, 12), 5)
        const M = evm(rng)
        rows = [
          { from: NULL, to: M, value: b, asset: 'WBTC', method: 'mint', fromLabel: NULL_LABEL, toLabel: 'Marchand WBTC agréé' },
          { from: M, to: S, value: b, asset: 'WBTC', method: 'transfer', fromLabel: 'Marchand WBTC agréé', toLabel: SL },
        ]
        what = 'Des bitcoins conservés par un dépositaire sur la blockchain Bitcoin : un WBTC est créé quand un marchand agréé remet des BTC au dépositaire, et détruit lors du rachat'
        backing = 'de BTC remis au dépositaire par le marchand'
        where = 'Les BTC sont sur des adresses de garde, sur la blockchain Bitcoin : le lien entre les deux chaînes passe par les registres du dépositaire et du marchand (réquisition), pas par la blockchain.'
        ctx = 'Deux transactions successives sur Ethereum : création par le dispositif WBTC, puis envoi au suspect.'
        mintIdx = 0
        break
      }
      case 'aWETH': {
        asset = 'aWETH'
        const gw = evm(rng)
        rows = [
          { from: S, to: gw, value: e, asset: 'ETH', method: 'depositETH', fromLabel: SL, toLabel: 'Aave : WrappedTokenGateway' },
          { from: NULL, to: S, value: e, asset: 'aWETH', method: 'depositETH', fromLabel: NULL_LABEL, toLabel: SL },
        ]
        what = 'Un reçu de dépôt Aave : une créance sur l\'ETH déposé dans le pool, remboursable 1 pour 1 et dont le solde augmente avec les intérêts'
        backing = 'des ETH déposés dans Aave'
        where = 'L\'ETH est dans la réserve Aave (sous forme de WETH) ; il ressortira lors d\'un withdraw (destruction des aTokens), éventuellement vers une autre adresse désignée par le paramètre to.'
        ctx = 'Transaction depositETH envoyée à la passerelle WETH d\'Aave V3.'
        break
      }
      case 'aUSDC': {
        asset = 'aUSDC'
        const u = round(rng.float(500, 150000), 2)
        rows = [
          { from: S, to: AAVE_V3_POOL, value: u, asset: 'USDC', method: 'supply', fromLabel: SL, toLabel: 'Aave V3 : Pool' },
          { from: NULL, to: S, value: u, asset: 'aUSDC', method: 'supply', fromLabel: NULL_LABEL, toLabel: SL },
        ]
        what = 'Un reçu de dépôt Aave : une créance sur les USDC déposés dans le pool, remboursable 1 pour 1 et dont le solde augmente avec les intérêts'
        backing = 'des USDC déposés dans Aave'
        where = 'Les USDC sont dans la réserve Aave ; ils ressortiront lors d\'un withdraw (destruction des aUSDC), éventuellement vers une autre adresse désignée par le paramètre to.'
        ctx = 'Transaction supply envoyée au Pool Aave V3.'
        break
      }
      default: {
        asset = 'UNI-V2'
        const x = round(e * P, 2)
        const lp = round(Math.sqrt(x * e), 6)
        const pool = evm(rng)
        const pl = `Pool Uniswap V2 ${stable}/WETH`
        rows = [
          { from: S, to: pool, value: x, asset: stable, method: 'addLiquidity', fromLabel: SL, toLabel: pl },
          { from: S, to: pool, value: e, asset: 'WETH', method: 'addLiquidity', fromLabel: SL, toLabel: pl },
          { from: NULL, to: S, value: lp, asset: 'UNI-V2', method: 'addLiquidity', fromLabel: NULL_LABEL, toLabel: SL },
        ]
        what = `Une part du pool : un droit proportionnel sur ses deux réserves (${stable} et WETH), dont la composition varie avec le cours`
        backing = `des ${stable} et des WETH apportés au pool`
        where = `Les ${stable} et WETH sont dans le contrat du pool ; ils ressortiront lors d'un removeLiquidity (destruction des parts), vers l'adresse désignée par le paramètre to.`
        ctx = 'Transaction addLiquidity envoyée au routeur Uniswap V2.'
      }
    }
    rows.forEach((x) => (x.time ??= time))
    const mintRow = rows[mintIdx < 0 ? rows.length - 1 : mintIdx]
    const N = frMax(mintRow.value, 8)
    const label = type === 'LP' ? 'jetons UNI-V2 (parts de pool)' : asset
    const visual: DrillVisual = { type: 'transfers', chain: 'eth', rows }

    if (variant === 'what') {
      const others: Record<ReceiptType, string> = {
        WETH: 'Des ETH « enveloppés » au format ERC-20, rachetables 1 pour 1 auprès du contrat WETH',
        WBTC: 'Des bitcoins conservés par un dépositaire sur la blockchain Bitcoin, représentés sur Ethereum',
        aWETH: 'Un reçu de dépôt Aave : une créance sur de l\'ETH déposé dans le pool de prêt',
        aUSDC: 'Un reçu de dépôt Aave : une créance sur des USDC déposés dans le pool de prêt',
        LP: 'Une part d\'un pool de liquidité : un droit proportionnel sur ses deux réserves',
      }
      const generic = [
        'Un airdrop promotionnel du protocole, sans contrepartie ni valeur de rachat',
        'Un jeton de gouvernance qui ne confère qu\'un droit de vote, sans lien avec un dépôt',
        'Des fonds envoyés par un tiers, dont il faut identifier le titulaire par réquisition',
      ]
      const otherTypes = (Object.keys(others) as ReceiptType[]).filter((k) => k !== type && !(type.startsWith('a') && k.startsWith('a')))
      const d = rng.shuffle([others[rng.pick(otherTypes)], ...rng.shuffle(generic).slice(0, 2)])
      const { options, answer } = mkChoice(rng, what, d, 4)
      return {
        prompt: `Que représentent les ${N} ${label} reçus par le suspect ?`,
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${what}. ${where}\n\nPour l'enquêteur, ces jetons ne sont pas une valeur nouvelle : ils prolongent la piste de l'actif déposé. Il faut les suivre (transferts, ventes) **et** surveiller leur rachat, qui fera ressortir l'actif sous-jacent.\n\nLes autres propositions ne correspondent pas à cette transaction : un airdrop ou un jeton de gouvernance n'est la contrepartie d'aucun dépôt, et la ligne qui crée les jetons part de l'adresse nulle, qui n'appartient à personne : il n'y a pas de tiers expéditeur à identifier.`,
      }
    }
    if (variant === 'mint') {
      const correct = `Une création (mint) de ${N} ${label} en contrepartie ${backing} : l'adresse nulle n'appartient à personne et n'a rien envoyé`
      const { options, answer } = mkChoice(rng, correct, [
        `Un paiement de ${N} ${label} reçu de l'adresse 0x000…000, dont il faut identifier le titulaire`,
        `Une destruction (burn) de ${N} ${label}`,
        'Un remboursement de frais de gas versé par le protocole',
      ], 4)
      return {
        prompt: `Que signifie la ligne « ${mintRow.fromLabel} → ${mintRow.toLabel} : ${N} ${mintRow.asset} » ?`,
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Par convention ERC-20, un événement Transfer dont l'expéditeur est l'adresse nulle signale une **création** de jetons : le contrat émet des unités nouvelles. Ici, les ${N} ${label} sont créés en contrepartie ${backing}. ${where}\n\n- Personne ne détient la clé de l'adresse nulle : aucun titulaire à réquisitionner.\n- Une destruction serait un Transfer **vers** l'adresse nulle (lors du rachat).\n- Le gas n'est jamais remboursé par un Transfer de jetons : il est payé en ETH par le signataire.`,
      }
    }
    // freeze
    const correctF = type === 'WBTC' ? F_CUSTODY : type === 'aWETH' ? F_GOV : F_NONE
    const { options, answer } = mkChoice(rng, correctF, [F_NONE, F_ISSUER, F_CUSTODY, F_GOV], 4)
    const why: Record<string, string> = {
      WETH: 'Le contrat WETH (2017) est immuable : aucune fonction d\'administration, de pause ou de liste noire. Personne ne peut bloquer des WETH ; on agit sur les clés (saisie du support) ou au point de sortie (exchange qui reçoit les fonds).',
      LP: `Le contrat d'un pool Uniswap V2 est immuable et sans administrateur : les parts ne peuvent pas être gelées. Seul l'émetteur d'un actif sous-jacent centralisé (${stable === 'DAI' ? 'pas le DAI, émis par un protocole' : stable === 'USDT' ? 'Tether pour l\'USDT' : 'Circle pour l\'USDC'}) peut bloquer ses propres jetons à l'adresse qui les reçoit lors du retrait.`,
      WBTC: 'WBTC n\'a pas de liste noire par adresse : le levier est le dispositif de garde, qui refuse le rachat en BTC à un marchand et ne crée de jetons que pour des marchands identifiés. Le contrat est suspendable par son propriétaire, mais cela bloque tous les détenteurs à la fois.',
      aWETH: 'Aave n\'a pas de liste noire par adresse : la gouvernance (ou un gardien d\'urgence) peut geler une réserve (plus de nouveaux dépôts ni emprunts) ou la suspendre entièrement, ce qui touche tous les utilisateurs. Contre un suspect précis, il faut agir sur les clés ou au point de sortie.',
    }
    return {
      prompt: `Qui peut geler les ${label} détenus par le suspect ?`,
      context: ctx,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${why[type]}\n\nLa liste noire par adresse est propre à certains émetteurs centralisés (Tether, Circle) et à leurs propres jetons : elle ne s'étend pas aux jetons enveloppés ou de reçu émis par d'autres contrats. Avant de demander un gel, identifiez qui contrôle réellement le contrat du jeton concerné.`,
    }
  },
}

// ── 7. Prêt avec garantie ───────────────────────────────────────────────────

export const collateralLink: DrillDef = {
  id: 'collateral-link',
  title: 'Rattacher un emprunt à sa garantie',
  description: 'Des ETH volés déposés en garantie sur un protocole de prêt, un emprunt de stablecoins envoyé vers un exchange : quel lien, pour quel montant, et où sont restés les fonds volés ?',
  level: 4,
  track: 'contrats',
  icon: 'Landmark',
  generate(seed) {
    const rng = rngFor(seed, 'collateral-link')
    const variant = rng.weighted([['amount', 3.5], ['qualify', 2.5], ['where', 2]] as const)
    const P = rng.int(2400, 3900)
    const T = round(rng.float(5, 120), 2)
    const C = round(rng.float(3, 90), 2)
    const D = round(T + C, 2)
    const ltv = rng.float(0.3, 0.68)
    const borrowed = rng.pick(['USDC', 'USDT', 'DAI'])
    const B = Math.round((D * P * ltv) / 100) * 100
    const ex = rng.pick(EXCHANGES)
    const ex2 = rng.pick(EXCHANGES.filter((x) => x !== ex))
    const H = evm(rng)
    const S = evm(rng)
    const HOT = evm(rng)
    const GW = evm(rng)
    const RES = evm(rng)
    const DEP = evm(rng)
    const tClean = dayTime(rng)
    let t = tClean + rng.int(2, 20) * 86400
    const step = () => (t += rng.int(1, 30) * 3600)
    const rows: Row[] = [
      { from: HOT, to: S, value: C, asset: 'ETH', method: 'transfer', time: tClean, fromLabel: `${ex} — Hot Wallet (retrait au nom du suspect)`, toLabel: 'Suspect' },
      { from: H, to: S, value: T, asset: 'ETH', method: 'transfer', time: t, fromLabel: 'Attaquant (fonds volés)', toLabel: 'Suspect' },
    ]
    rows.push(
      { from: S, to: GW, value: D, asset: 'ETH', method: 'depositETH', time: step(), fromLabel: 'Suspect', toLabel: 'Aave : WrappedTokenGateway' },
      { from: NULL, to: S, value: D, asset: 'aWETH', method: 'depositETH', time: t, fromLabel: NULL_LABEL, toLabel: 'Suspect' },
      { from: RES, to: S, value: B, asset: borrowed, method: 'borrow', time: step(), fromLabel: `Aave V3 : réserve ${borrowed}`, toLabel: 'Suspect' },
      { from: S, to: DEP, value: B, asset: borrowed, method: 'transfer', time: step(), fromLabel: 'Suspect', toLabel: `${ex2} — adresse de dépôt` },
    )
    const share = T / D
    const linked = round(B * share, 2)
    const pct = frMax(round(share * 100, 1), 1)
    const ctx = `Avant ces opérations, le solde du suspect était nul. Cours de l'ETH lors de l'emprunt : ${frMax(P, 0)} $.`
    const visual: DrillVisual = { type: 'transfers', chain: 'eth', rows }
    const mech = `Le suspect a déposé ${frMax(D, 2)} ETH en garantie (dont ${frMax(T, 2)} ETH volés et ${frMax(C, 2)} ETH venus de ${ex}) et reçu ${frMax(D, 2)} aWETH, reçus de dépôt. Il a ensuite emprunté ${frMax(B, 0)} ${borrowed}, soit environ ${frMax(round(ltv * 100, 0), 0)} % de la valeur de sa garantie. Ces ${borrowed} sont des fonds **neufs**, sortis de la réserve d'Aave : ce ne sont pas les ETH volés convertis.`

    if (variant === 'amount') {
      return {
        prompt: `Au prorata de la garantie, quel montant des ${borrowed} envoyés à ${ex2} peut-on rattacher aux fonds volés ?`,
        context: ctx,
        visual,
        kind: 'number',
        answer: linked,
        tolerance: 0.01,
        unit: borrowed,
        explain: `${mech}\n\nL'emprunt n'a été possible que grâce à la garantie, composée à ${pct} % d'ETH volés (${frMax(T, 2)} / ${frMax(D, 2)}). Au prorata : ${frMax(B, 0)} × ${frMax(round(share, 4), 4)} ≈ **${frMax(linked, 2)} ${borrowed}**.\n\nC'est un lien **économique, indirect** : il se justifie par le raisonnement « sans la garantie volée, pas d'emprunt », et doit être présenté comme tel dans le rapport, avec la méthode. Rattacher 100 % des ${borrowed} (méthode « empoisonnement ») surestime le lien ; s'arrêter à la garantie et rattacher 0 ${borrowed} laisse filer le produit de l'opération vers ${ex2}.`,
      }
    }
    if (variant === 'qualify') {
      const correct = `Un lien indirect, économique : les ${borrowed} sont un emprunt neuf garanti par les ETH volés, qui restent bloqués dans Aave`
      const { options, answer } = mkChoice(rng, correct, [
        `Un lien direct : les ETH volés ont été échangés contre des ${borrowed}, ce sont les mêmes fonds sous une autre forme`,
        `Aucun lien : le dépôt dans Aave rompt le traçage, les ${borrowed} sont des fonds propres du protocole`,
        `Un lien direct à 100 %, puisque le même titulaire a déposé et emprunté`,
      ], 4)
      return {
        prompt: `Comment qualifier le lien entre les ETH volés et les ${borrowed} déposés chez ${ex2} ?`,
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${mech}\n\nIl n'y a donc pas de swap : les ETH volés n'ont pas quitté Aave, où ils garantissent la dette. Le lien entre ces ETH et les ${borrowed} est **indirect** (économique) : l'emprunt n'existe que grâce à la garantie. Il n'est pas rompu pour autant — le protocole n'a pas « blanchi » les fonds, il a prêté contre eux — mais il ne vaut pas identité des fonds, et la part de garantie propre (${frMax(C, 2)} ETH venus de ${ex}) interdit d'en rattacher mécaniquement 100 %.\n\nConséquences : réquisitionner ${ex2} pour le dépôt de ${frMax(B, 0)} ${borrowed} et viser la position Aave (les aWETH et la garantie) pour la saisie.`,
      }
    }
    const correct = `Dans la réserve d'Aave, comme garantie de la dette : le suspect détient ${frMax(D, 2)} aWETH qui la représentent, et la position peut être visée par une saisie`
    const { options, answer } = mkChoice(rng, correct, [
      `Chez ${ex2}, puisque le suspect y a envoyé le produit de l'emprunt`,
      'Détruits : l\'envoi à l\'adresse nulle les a fait disparaître de la circulation',
      `Convertis en ${borrowed} par le protocole lors de l'emprunt`,
    ], 4)
    return {
      prompt: 'Où se trouvent désormais les ETH volés ?',
      context: ctx,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${mech}\n\nLes ETH volés n'ont pas bougé depuis le dépôt : ils sont dans la réserve WETH d'Aave, représentés par les ${frMax(D, 2)} aWETH du suspect. Tant que la dette n'est pas remboursée, il ne peut les retirer qu'en partie ; si le cours de l'ETH baisse, la position peut être liquidée (des liquidateurs rachètent la garantie avec décote).\n\nAucune ligne n'envoie d'ETH à l'adresse nulle : la ligne « adresse nulle → suspect » est la création des aWETH. Ce qui est parti chez ${ex2}, ce sont les ${borrowed} empruntés, pas les ETH. Stratégie : saisir les clés du suspect (pour rembourser et retirer, ou céder la position) et réquisitionner ${ex2}.`,
    }
  },
}

// ── 8. Parts de pool ────────────────────────────────────────────────────────

export const lpTrace: DrillDef = {
  id: 'lp-trace',
  title: 'Suivre des parts de pool',
  description: 'A dépose de la liquidité, cède ses parts à B, qui retire vers C : qui reçoit les fonds, combien rattacher au dépôt initial, et pourquoi les montants retirés diffèrent des montants déposés.',
  level: 4,
  track: 'contrats',
  icon: 'Droplets',
  generate(seed) {
    const rng = rngFor(seed, 'lp-trace')
    const variant = rng.weighted([['who', 2.5], ['amount', 3.5], ['why', 2.5]] as const)
    const pair = rng.pick([['USDC', 'WETH'], ['USDT', 'WETH'], ['DAI', 'WETH'], ['USDC', 'WBTC']] as const)
    const [ST, VO] = pair
    const p0 = VO === 'WBTC' ? rng.int(55000, 98000) : rng.int(2400, 3900)
    let r = rng.float(0.7, 1.4)
    if (Math.abs(r - 1) < 0.08) r = r < 1 ? 0.88 : 1.12
    const p1 = Math.round(p0 * r)
    r = p1 / p0
    const g = 1 + rng.float(0.002, 0.02)
    const y = VO === 'WBTC' ? round(rng.float(0.3, 8), 5) : round(rng.float(3, 120), 4)
    const x = round(y * p0, 2)
    const L = round(Math.sqrt(x * y), 6)
    const f = rng.chance(0.5) ? 1 : round(rng.float(0.4, 0.9), 2)
    const given = round(L * f, 6)
    const own = variant === 'amount' && rng.chance(0.7) ? round(L * rng.float(0.2, 1.5), 6) : 0
    const burned = round(given + own, 6)
    const perLpX = (x / L) * Math.sqrt(r) * g
    const perLpY = (y / L / Math.sqrt(r)) * g
    const X1 = roundA(ST, perLpX * burned)
    const Y1 = roundA(VO, perLpY * burned)
    const A = evm(rng)
    const B = evm(rng)
    const C = evm(rng)
    const pool = evm(rng)
    const pl = `Pool Uniswap V2 ${ST}/${VO}`
    const AL = 'Adresse A (déposant)'
    const BL = 'Adresse B'
    const CL = 'Adresse C'
    let t = dayTime(rng)
    const rows: Row[] = [
      { from: A, to: pool, value: x, asset: ST, method: 'addLiquidity', time: t, fromLabel: AL, toLabel: pl },
      { from: A, to: pool, value: y, asset: VO, method: 'addLiquidity', time: t, fromLabel: AL, toLabel: pl },
      { from: NULL, to: A, value: L, asset: 'UNI-V2', method: 'addLiquidity', time: t, fromLabel: NULL_LABEL, toLabel: AL },
    ]
    if (own) rows.push({ from: NULL, to: B, value: own, asset: 'UNI-V2', method: 'addLiquidity', time: (t += rng.int(1, 5) * 86400), fromLabel: NULL_LABEL, toLabel: BL })
    rows.push({ from: A, to: B, value: given, asset: 'UNI-V2', method: 'transfer', time: (t += rng.int(1, 12) * 86400), fromLabel: AL, toLabel: BL })
    t += rng.int(2, 40) * 86400
    rows.push(
      { from: B, to: pool, value: burned, asset: 'UNI-V2', method: 'removeLiquidity', time: t, fromLabel: BL, toLabel: pl },
      { from: pool, to: NULL, value: burned, asset: 'UNI-V2', method: 'removeLiquidity', time: t, fromLabel: pl, toLabel: NULL_LABEL },
      { from: pool, to: C, value: X1, asset: ST, method: 'removeLiquidity', time: t, fromLabel: pl, toLabel: CL },
      { from: pool, to: C, value: Y1, asset: VO, method: 'removeLiquidity', time: t, fromLabel: pl, toLabel: CL },
    )
    const visual: DrillVisual = { type: 'transfers', chain: 'eth', rows }
    const ctx = `Cours de ${VO} : ${frMax(p0, 0)} ${ST} lors du dépôt, ${frMax(p1, 0)} ${ST} lors du retrait. Le retrait (removeLiquidity) est signé par B, avec le paramètre to = C.`
    const mech = `A a déposé ${frMax(x, 2)} ${ST} et ${frMax(y, 8)} ${VO} et reçu ${frMax(L, 6)} parts (UNI-V2), créées depuis l'adresse nulle. Il en a cédé ${f === 1 ? 'la totalité' : `${frMax(given, 6)} (${frMax(f * 100, 0)} %)`} à B par un simple transfert de jetons — sans que les actifs quittent le pool. B a ensuite brûlé ${frMax(burned, 6)} parts ${own ? `(${frMax(given, 6)} venues de A et ${frMax(own, 6)} issues de son propre dépôt) ` : ''}et le pool a versé les actifs correspondants à C.`

    if (variant === 'who') {
      const correct = f === 1
        ? 'Vers C : B a retiré la liquidité en désignant C comme destinataire, avec les parts cédées par A'
        : `En partie vers C : B a retiré, vers C, la liquidité des parts cédées par A ; A conserve ${frMax(round(L - given, 6), 6)} parts encore dans le pool`
      const { options, answer } = mkChoice(rng, correct, [
        'Vers B, qui a signé la transaction de retrait',
        'Nulle part : les actifs sont toujours dans le pool, seules des parts ont circulé',
        'Vers A, seul titulaire légitime du dépôt initial',
      ], 4)
      return {
        prompt: 'Les actifs déposés par A sont-ils ressortis du pool, et vers qui ?',
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${mech}\n\nLe transfert de parts de A à B est le maillon que l'on rate en ne suivant que les actifs : ni ${ST} ni ${VO} ne bougent à ce moment-là. Puis removeLiquidity verse les actifs au paramètre to, ici **C**, et non au signataire B : C est la nouvelle adresse à suivre, B l'adresse à attribuer.\n\nLes actifs sont bien sortis (lignes pool → C), et A n'a rien récupéré lui-même${f < 1 ? ', même s\'il garde des parts non retirées' : ''}.`,
      }
    }
    if (variant === 'amount') {
      const linkY = roundA(VO, Y1 * (given / burned))
      const linkX = roundA(ST, X1 * (given / burned))
      const askX = rng.chance(0.5)
      const ans = askX ? linkX : linkY
      const sym = askX ? ST : VO
      const tot = askX ? X1 : Y1
      return {
        prompt: `Quelle quantité des ${sym} reçus par C provient des parts cédées par A (au prorata des parts brûlées) ?`,
        context: ctx,
        visual,
        kind: 'number',
        answer: ans,
        tolerance: 0.005,
        unit: sym,
        explain: `${mech}\n\n${own ? `Les parts brûlées sont fongibles : sur ${frMax(burned, 6)} parts, ${frMax(given, 6)} venaient de A, soit ${frMax(round((given / burned) * 100, 1), 1)} %. C a reçu ${frMax(tot, 8)} ${sym} ; au prorata : ${frMax(tot, 8)} × ${frMax(round(given / burned, 4), 4)} ≈ **${frMax(ans, 8)} ${sym}**.` : `Toutes les parts brûlées venaient de A : la totalité des ${frMax(tot, 8)} ${sym} reçus par C se rattache au dépôt de A, soit **${frMax(ans, 8)} ${sym}**.`}\n\nOn raisonne sur les **parts**, pas sur les montants déposés : chaque part donne droit à la même fraction des réserves au moment du retrait, quelle que soit la date du dépôt. Comparer avec les ${frMax(askX ? x : y, 8)} ${sym} déposés par A serait faux, car la composition du pool a changé avec le cours.`,
      }
    }
    const up = p1 > p0
    const correct = `Le cours de ${VO} a ${up ? 'monté' : 'baissé'} entre le dépôt et le retrait : le pool (x·y = k) s'est rééquilibré, chaque part contient ${up ? `plus de ${ST} et moins de ${VO}` : `moins de ${ST} et plus de ${VO}`}, plus les frais accumulés — c'est bien la même liquidité`
    const { options, answer } = mkChoice(rng, correct, [
      `B a discrètement ajouté ou retiré des fonds dans le pool : les écarts révèlent un second flux à rechercher`,
      `Le pool a prélevé une commission fixe sur le retrait, d'où des montants plus faibles`,
      `Une partie des actifs a transité par un mixeur intégré au pool avant d'arriver à C`,
    ], 4)
    return {
      prompt: `A avait déposé ${frMax(x, 2)} ${ST} et ${frMax(y, 8)} ${VO} ; C reçoit ${frMax(X1, 2)} ${ST} et ${frMax(Y1, 8)} ${VO}. Pourquoi ces montants diffèrent-ils ?`,
      context: ctx,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${mech}\n\nDans un pool à produit constant, les arbitragistes alignent le prix du pool sur le marché : quand ${VO} ${up ? 'monte' : 'baisse'} (×${frMax(round(r, 3), 3)}), le pool ${up ? 'vend du ' + VO + ' et accumule du ' + ST : 'accumule du ' + VO + ' et cède du ' + ST}. Une part vaut alors ${frMax(round(Math.sqrt(r), 3), 3)} fois plus de ${ST} et ${frMax(round(1 / Math.sqrt(r), 3), 3)} fois ${up ? 'moins' : 'plus'} de ${VO} qu'au dépôt (sur la totalité des parts${f < 1 ? ', ramenée ici à la fraction cédée' : ''}), plus environ ${frMax(round((g - 1) * 100, 1), 1)} % de frais de swap accumulés. C'est la « dérive » (perte impermanente) normale d'une position de liquidité.\n\nAucun flux caché : le retrait ne contient que la destruction des parts et le versement des deux actifs. Il n'y a pas de commission fixe au retrait sur Uniswap V2 (les frais sont prélevés sur les swaps et profitent aux déposants), et aucun mixeur n'intervient.`,
    }
  },
}
