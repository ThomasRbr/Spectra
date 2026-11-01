import { World, type Tx } from '../engine/world'
import { bridge, exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { decoyBranches, dusting } from '../engine/realism'
import { roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Memecoins fictifs. Le jeton n'est pas un actif du moteur : comme dans le
// rug pull BSC, seuls les flux de SOL et d'USDC sont représentés ; le contrat
// du jeton (mint) et le pool Raydium sont des adresses étiquetées.
const TOKENS = [
  { name: 'Bouffon', ticker: 'BOUFFON' },
  { name: 'Baguette Inu', ticker: 'BAGUET' },
  { name: 'Escargot Rapide', ticker: 'ESCARGO' },
  { name: 'Raclette Moon', ticker: 'RACLET' },
  { name: 'Pinard Coin', ticker: 'PINARD' },
  { name: 'Le Grognon', ticker: 'GROGNON' },
  { name: 'Chouquette', ticker: 'CHOUQ' },
] as const

// Autres jetons fictifs, pour l'historique des bots de sniping indépendants.
const OTHER_TICKERS = ['MOUETTE', 'TARTIF', 'KASSOS', 'PAPYDOG', 'ZINZIN', 'FRITON', 'GLOUTON', 'PANACHE']

const RAMPS = ['coinbase', 'kraken', 'binance', 'okx', 'bitstamp', 'coinhouse'] as const

const sol = (v: number) => roundAsset('SOL', v)
const usdc = (v: number) => roundAsset('USDC', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
// Jour civil (heure de Paris) d'un horodatage, pour situer deux événements l'un par rapport à l'autre
const parisDay = (t: number) => Date.parse(new Date(t * 1000).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }))
/** « la veille du lancement », « le jour même du lancement »… selon l'écart réel en jours civils. */
const relDay = (t: number, ref: number, what: string) => {
  const d = Math.round((parisDay(ref) - parisDay(t)) / 86400000)
  return d === 0 ? `le jour même du ${what}` : d === 1 ? `la veille du ${what}` : d === 2 ? `l'avant-veille du ${what}` : `${d} jours avant le ${what}`
}

export const solMemecoinRug: ScenarioTemplate = {
  id: 'sol-memecoin-rug',
  title: 'Rug pull d\'un memecoin sur Solana',
  tagline: 'Un jeton « 100x », des snipers dans le premier bloc, une liquidité qui s\'évapore… et un développeur qui n\'en est pas à son coup d\'essai.',
  description:
    'Un développeur anonyme lance un memecoin sur Raydium, paie sa promotion, puis retire toute la liquidité quelques heures plus tard. Identifiez son portefeuille et ses snipers, mesurez le retrait, découvrez qu\'il a déjà vidé un autre pool quelques semaines plus tôt, puis suivez la conversion en USDC : une part chez un exchange, une part conservée, et la plus grosse part partie sur Ethereum par un bridge.',
  difficulty: 2,
  chains: ['sol', 'eth'],
  skills: ['evm', 'tokens', 'dex', 'bridge', 'typologies', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 60,
  lessons: ['solana', 'rug-pulls', 'dex-defi', 'bridges', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const handle = fakeHandle(r)
    const kolHandle = r.pick(['moonboy_fr', 'gemhunter.sol', 'cryptokev', 'lapepite_x', 'solsensei'])
    const tok = r.pick(TOKENS)
    const tokOld = r.pick(TOKENS.filter((t) => t.ticker !== tok.ticker))
    const T = `$${tok.ticker}`
    const TO = `$${tokOld.ticker}`

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const fundKey = r.pick(['binance', 'okx'] as const)
    const destKey = r.pick((['kraken', 'bitstamp', 'coinbase', 'binance', 'okx'] as const).filter((k) => k !== fundKey))
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string): ExchangeKit => {
      let x = kits.get(k)
      if (!x) {
        x = exchange(w, k, 'sol')
        kits.set(k, x)
      }
      return x
    }
    const fund = ex(fundKey)
    const dest = ex(destKey)
    const cv = ex('coinhouse')
    const br = bridge(w, 'arcbridge')

    const raydium = w.entity('raydium')
    const projectE = w.customEntity({ name: `${tok.name} (${T})`, category: 'scam', description: 'Memecoin lancé sur Raydium, abandonné après le retrait de la liquidité (rug pull).' })
    const oldProjectE = w.customEntity({ name: `${tokOld.name} (${TO})`, category: 'scam', description: 'Memecoin lancé sur Raydium quelques semaines plus tôt et abandonné de la même façon.' })
    const devE = w.customEntity({ name: `Développeur « ${handle} » (inconnu)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const kolE = w.customEntity({ name: `Influenceur @${kolHandle}`, category: 'individual' })
    const volBot = w.customEntity({ name: 'VolumeForge (bot de volume)', category: 'merchant', known: true, description: 'Service (fictif) de « bots de volume » : achats et ventes automatiques pour faire grimper un jeton dans les classements des agrégateurs. Paiement en SOL, sans KYC.' })

    const dev = w.addr('sol', { entity: devE })
    const relay = w.addr('sol', { entity: devE })
    const victim = w.addr('sol', { entity: victimE })
    const kol = w.addr('sol', { entity: kolE })
    const volAddr = w.addr('sol', { entity: volBot, label: 'VolumeForge — Paiements', tags: ['liquid'] })
    const mint = w.addr('sol', { entity: projectE, label: `Jeton ${tok.name} (${T})`, contract: { name: `${T} — SPL Token Mint`, type: 'token' } })
    const pool = w.addr('sol', { entity: raydium, label: `Raydium: Pool ${T}/SOL`, contract: { name: `Raydium ${T}/SOL Pool`, type: 'pool' } })
    const oldMint = w.addr('sol', { entity: oldProjectE, label: `Jeton ${tokOld.name} (${TO})`, contract: { name: `${TO} — SPL Token Mint`, type: 'token' } })
    const oldPool = w.addr('sol', { entity: raydium, label: `Raydium: Pool ${TO}/SOL`, contract: { name: `Raydium ${TO}/SOL Pool`, type: 'pool' } })
    const poolFee = w.addr('sol', { entity: raydium, label: 'Raydium: Frais de création de pool', tags: ['liquid'] })
    const poolUsdc = w.addr('sol', { entity: raydium, label: 'Raydium: Pool SOL/USDC', contract: { name: 'Raydium SOL/USDC Pool', type: 'pool' } })
    const otherPools = new Map<string, string>()
    const otherPool = (t: string) => {
      let p = otherPools.get(t)
      if (!p) {
        p = w.addr('sol', { entity: raydium, label: `Raydium: Pool $${t}/SOL`, contract: { name: `Raydium $${t}/SOL Pool`, type: 'pool' } })
        otherPools.set(t, p)
      }
      return p
    }

    const buy = (trader: string, value: number, time: number, ticker = T, to = pool, fee?: number): Tx =>
      w.multi({ time, signer: trader, legs: [{ from: trader, to, value, asset: 'SOL' }], method: `swapBaseIn (SOL → ${ticker})`, tags: ['swap'], fee })
    const sell = (trader: string, value: number, time: number, ticker = T, from = pool): Tx =>
      w.multi({ time, signer: trader, legs: [{ from, to: trader, value, asset: 'SOL' }], method: `swapBaseIn (${ticker} → SOL)`, tags: ['swap'] })
    const raySwap = (trader: string, assetIn: AssetId, amountIn: number, assetOut: AssetId, time: number) => {
      const amountOut = roundAsset(assetOut, (usd(assetIn, amountIn) * 0.9975 * r.float(0.994, 0.999)) / usd(assetOut, 1))
      const tx = w.multi({
        time, signer: trader, method: `swapBaseIn (${assetIn} → ${assetOut})`, tags: ['swap'],
        legs: [{ from: trader, to: poolUsdc, value: amountIn, asset: assetIn }, { from: poolUsdc, to: trader, value: amountOut, asset: assetOut }],
      })
      return { tx, amountOut }
    }

    // ── Chronologie ──────────────────────────────────────────────────────────
    const tL = w.at(0) // ajout de liquidité (lancement)
    const rugH = r.float(9, 15)
    const tRug = w.at(rugH)

    // Snipers du développeur : montants préparés à l'avance
    const nS = r.int(3, 4)
    const snipers = Array.from({ length: nS }, () => w.addr('sol', { entity: devE }))
    const sniperBuys = snipers.map(() => sol(r.float(3, 9)))
    const sniperFunds = sniperBuys.map((b) => sol(b + r.float(0.05, 0.15)))
    const relayTotal = sol(sniperFunds.reduce((s, v) => s + v, 0) + 0.02)
    const L = sol(r.float(25, 60))
    const mintRent = 0.0021
    const createFee = 0.4

    // Premier lancement, trois semaines plus tôt (même mode opératoire, plus petit)
    const tOld = w.at(-r.float(17, 23) * 24)
    const oldRugH = r.float(3, 7)
    const oldSnipers = [w.addr('sol', { entity: devE }), w.addr('sol', { entity: devE })]
    const oldSniperBuys = oldSnipers.map(() => sol(r.float(1.2, 3.5)))
    const oldSniperFunds = oldSniperBuys.map((b) => sol(b + r.float(0.04, 0.1)))
    const oldRelayTotal = sol(oldSniperFunds.reduce((s, v) => s + v, 0) + 0.015)
    const Lold = sol(r.float(6, 14))
    const kolFee = sol(r.float(4, 9))
    const volFees = [sol(r.float(0.8, 1.6)), sol(r.float(1.5, 3))]
    const W0 = sol(relayTotal + L + mintRent + createFee + oldRelayTotal + Lold + mintRent + createFee + kolFee + volFees[0] + volFees[1] + r.float(1.2, 4))

    // 1. Financement du développeur : retrait depuis un exchange (first funder)
    const tFund = w.at(-r.float(26, 34) * 24)
    const fundTx = fund.withdraw(dev, W0, tFund, 'SOL')

    // 2. Premier lancement ($OLD) : jeton, snipers via le même relais, pool, retrait
    w.multi({ time: tOld - Math.round(r.float(3, 5) * HOUR), signer: dev, legs: [{ from: dev, to: oldMint, value: mintRent, asset: 'SOL' }], method: `InitializeMint2 + CreateMetadata (${TO})`, fee: 0.000015 })
    const oldRelayTx = w.transfer({ time: tOld - Math.round(r.float(2, 2.8) * HOUR), from: dev, to: relay, value: oldRelayTotal, asset: 'SOL' })
    oldSnipers.forEach((s, i) => w.transfer({ time: tOld - Math.round(r.float(0.5, 1.5) * HOUR), from: relay, to: s, value: oldSniperFunds[i], asset: 'SOL' }))
    w.transfer({ time: tOld - Math.round(r.float(0.6, 1.4) * HOUR), from: dev, to: volAddr, value: volFees[0], asset: 'SOL', method: 'transfer (paiement VolumeForge)' })
    const oldLpTx = w.multi({
      time: tOld, signer: dev, method: `initialize2 — création du pool ${TO}/SOL et ajout de liquidité`,
      legs: [{ from: dev, to: oldPool, value: Lold, asset: 'SOL' }, { from: dev, to: poolFee, value: createFee, asset: 'SOL' }],
    })
    oldSnipers.forEach((s, i) => buy(s, oldSniperBuys[i], tOld + 1, TO, oldPool, +r.float(0.002, 0.01).toFixed(6)))
    const nOB = r.int(5, 8)
    let oldPublic = 0
    for (let i = 0; i < nOB; i++) {
      const a = w.addr('sol')
      const t = tOld + Math.round(r.float(0.1, oldRugH - 0.4) * HOUR)
      const v = sol(r.float(0.3, 5))
      ex(r.pick(RAMPS)).withdraw(a, sol(v + r.float(0.02, 0.8)), t - Math.round(r.float(1, 30) * HOUR), 'SOL')
      buy(a, v, t, TO, oldPool)
      oldPublic += v
    }
    const tOldRug = tOld + Math.round(oldRugH * HOUR)
    oldSnipers.forEach((s, i) => sell(s, sol(Math.min(oldSniperBuys[i] * r.float(2, 3.5), w.balanceOf(oldPool, 'SOL') * 0.2)), tOldRug - r.int(5, 20) * 60, TO, oldPool))
    const oldRemoved = Math.floor(w.balanceOf(oldPool, 'SOL') * 1e4) / 1e4
    const oldRugTx = w.multi({ time: tOldRug, signer: dev, method: `withdraw — retrait de 100 % de la liquidité ${TO}/SOL`, legs: [{ from: oldPool, to: dev, value: oldRemoved, asset: 'SOL' }] })
    oldSnipers.forEach((s) => w.transfer({ time: tOldRug + r.int(10, 50) * 60, from: s, to: dev, value: Math.floor(w.balanceOf(s, 'SOL') * 1e4) / 1e4, asset: 'SOL' }))

    // Versement ultérieur depuis une adresse non attribuée (fausse piste « financeur »)
    const extraTx = w.fundAccount(dev, sol(r.float(1.5, 5)), 'SOL', w.at(-r.float(40, 70)))

    // 3. Création du jeton, promotion payée, préparation des snipers via le même relais
    const mintTx = w.multi({ time: w.at(-r.float(4, 8)), signer: dev, legs: [{ from: dev, to: mint, value: mintRent, asset: 'SOL' }], method: `InitializeMint2 + CreateMetadata (${T})`, fee: 0.000015 })
    const kolTx = w.transfer({ time: w.at(-r.float(18, 30)), from: dev, to: kol, value: kolFee, asset: 'SOL' })
    const relayTx = w.transfer({ time: w.at(-r.float(2.5, 3.5)), from: dev, to: relay, value: relayTotal, asset: 'SOL' })
    const sniperFundTxs = snipers.map((s, i) => w.transfer({ time: w.at(-r.float(0.6, 1.9)), from: relay, to: s, value: sniperFunds[i], asset: 'SOL' }))
    const volTx = w.transfer({ time: w.at(-r.float(0.4, 1.2)), from: dev, to: volAddr, value: volFees[1], asset: 'SOL', method: 'transfer (paiement VolumeForge)' })

    // 4. Lancement : création du pool et ajout de liquidité
    const lpTx = w.multi({
      time: tL, signer: dev, method: `initialize2 — création du pool ${T}/SOL et ajout de liquidité`,
      legs: [{ from: dev, to: pool, value: L, asset: 'SOL' }, { from: dev, to: poolFee, value: createFee, asset: 'SOL' }],
    })

    // 5. Bloc de lancement : les snipers achètent une seconde après
    const sniperBuyTxs = snipers.map((s, i) => buy(s, sniperBuys[i], tL + 1, T, pool, +r.float(0.002, 0.01).toFixed(6)))

    // Bots de sniping indépendants (fausses pistes) : financés par des exchanges, actifs sur d'autres lancements
    const botKeys = r.shuffle((['kraken', 'okx', 'coinbase', 'binance'] as const).filter((k) => k !== fundKey)).slice(0, 2)
    const bots = botKeys.map((k) => {
      const b = w.addr('sol')
      ex(k).withdraw(b, sol(r.float(18, 60)), w.at(-r.float(6, 30) * 24), 'SOL')
      for (const t of r.pickN(OTHER_TICKERS, 2)) {
        const tb = w.at(-r.float(1, 5) * 24)
        const v = sol(r.float(1, 5))
        buy(b, v, tb, `$${t}`, otherPool(t), +r.float(0.002, 0.01).toFixed(6))
        sell(b, sol(v * r.float(0.4, 2.5)), tb + r.int(300, 7200), `$${t}`, otherPool(t))
      }
      return b
    })
    const botBuys = bots.map(() => sol(r.float(2, 8)))
    const botBuyTxs = bots.map((b, i) => buy(b, botBuys[i], tL + 1 + i, T, pool, +r.float(0.002, 0.01).toFixed(6)))
    bots.forEach((b, i) => sell(b, sol(botBuys[i] * r.float(1.4, 2.6)), tL + Math.round(r.float(0.1, 2) * HOUR)))

    // 6. Acheteurs publics, dont la victime (qui avait déjà joué un memecoin auparavant)
    const vPrevT = OTHER_TICKERS[r.int(0, OTHER_TICKERS.length - 1)]
    const vPrevAt = w.at(-r.float(5, 12) * 24)
    cv.withdraw(victim, sol(r.float(1.5, 3)), vPrevAt - Math.round(r.float(2, 20) * HOUR), 'SOL')
    const vPrevBuy = sol(r.float(0.6, 1.2))
    buy(victim, vPrevBuy, vPrevAt, `$${vPrevT}`, otherPool(vPrevT))
    sell(victim, sol(vPrevBuy * r.float(1.1, 1.8)), vPrevAt + Math.round(r.float(5, 40) * HOUR), `$${vPrevT}`, otherPool(vPrevT))
    const v1 = sol(r.float(6, 20))
    const v2 = sol(r.float(3, 10))
    const victimFund = cv.withdraw(victim, sol(v1 + v2 + r.float(0.05, 0.5)), w.at(-r.float(6, 20)), 'SOL')
    const vBuy1 = buy(victim, v1, w.at(r.float(0.4, 2.5)))
    const vBuy2 = buy(victim, v2, w.at(r.float(3.5, rugH - 1)))
    const victimLoss = sol(v1 + v2)

    const nB = r.int(13, 17)
    const buyers: { addr: string; value: number; t: number }[] = []
    for (let i = 0; i < nB; i++) {
      const a = w.addr('sol')
      const t = w.at(r.float(0.15, rugH - 0.6))
      const v = sol(r.float(0.3, 12))
      ex(r.pick(RAMPS)).withdraw(a, sol(v + r.float(0.02, 1.5)), t - Math.round(r.float(1, 40) * HOUR), 'SOL')
      buy(a, v, t)
      buyers.push({ addr: a, value: v, t })
    }
    // Quelques acheteurs revendent à temps (avec gain ou perte)
    const early = buyers.filter((b) => b.t < tRug - 2 * HOUR)
    for (const b of r.pickN(early, Math.min(3, early.length))) {
      const ts = Math.min(b.t + Math.round(r.float(0.3, 4) * HOUR), tRug - r.int(1800, 3000))
      sell(b.addr, sol(b.value * r.float(0.5, 2.2)), ts)
    }

    // 7. Les snipers revendent juste avant le retrait (le développeur « dump »)
    const poolBefore = w.balanceOf(pool, 'SOL')
    const wanted = sniperBuys.map((b) => b * r.float(3, 7))
    const scale = Math.min(1, (poolBefore * 0.45) / wanted.reduce((s, v) => s + v, 0))
    const dumps = wanted.map((v) => sol(v * scale))
    const dumpTxs = snipers.map((s, i) => sell(s, dumps[i], tRug - r.int(4, 25) * 60))

    // 8. Rug pull : retrait de toute la liquidité
    const removed = Math.floor(w.balanceOf(pool, 'SOL') * 1e4) / 1e4
    const rugTx = w.multi({
      time: tRug, signer: dev, method: `withdraw — retrait de 100 % de la liquidité ${T}/SOL`,
      legs: [{ from: pool, to: dev, value: removed, asset: 'SOL' }],
    })

    // 9. Les snipers renvoient leurs SOL au développeur
    const returnTxs = snipers.map((s) => w.transfer({ time: tRug + r.int(8, 45) * 60, from: s, to: dev, value: Math.floor(w.balanceOf(s, 'SOL') * 1e4) / 1e4, asset: 'SOL' }))
    const sniperProfit = sol(returnTxs.reduce((s, t) => s + t.transfers[0].value, 0))

    // 10. Conversion SOL → USDC sur Raydium
    const tSwap = tRug + Math.round(r.float(1, 2.5) * HOUR)
    const swapIn = sol(w.balanceOf(dev, 'SOL') * r.float(0.86, 0.9))
    const sw = raySwap(dev, 'SOL', swapIn, 'USDC', tSwap)

    // 11. Dispersion vers trois portefeuilles neufs (chacun reçoit d'abord des SOL pour les frais)
    //     outs[0] → exchange · outs[1] → conserve · outs[2] → bridge vers Ethereum
    const outs = [w.addr('sol', { entity: devE }), w.addr('sol', { entity: devE }), w.addr('sol', { entity: devE })]
    const u1 = usdc(sw.amountOut * r.float(0.24, 0.3))
    const u2 = usdc(sw.amountOut * r.float(0.14, 0.2))
    const u3 = usdc(sw.amountOut - u1 - u2)
    const parts = [u1, u2, u3]
    const gasTxs: Tx[] = []
    const splitTxs: Tx[] = []
    const order = r.shuffle([0, 1, 2])
    order.forEach((i, k) => {
      const tg = tSwap + r.int(10, 30) * 60 + k * r.int(60, 240)
      gasTxs.push(w.transfer({ time: tg, from: dev, to: outs[i], value: sol(r.float(0.01, 0.03)), asset: 'SOL' }))
      splitTxs.push(w.transfer({ time: tg + r.int(2, 10) * 60, from: dev, to: outs[i], value: parts[i], asset: 'USDC' }))
    })

    // 12. Le premier dépose sur un exchange ; le deuxième conserve ; le troisième passe sur Ethereum
    const d1 = dest.receive(outs[0], u1, tSwap + Math.round(r.float(2, 5) * HOUR), { asset: 'USDC', sweepDelayH: r.float(0.3, 1.2) })
    const dep = d1.deposit
    const ethR = w.addr('eth', { entity: devE })
    const tBridge = d1.tx.time + Math.round(r.float(6, 18) * HOUR)
    const bout = br.send({ from: outs[2], value: u3, asset: 'USDC', time: tBridge, toChain: 'eth', recipient: ethR, delayMin: [3, 15] })

    // ── Habillage du portefeuille du développeur (après le flux réel) ───────
    // Éclatement de SOL vers des portefeuilles neufs, sans lien avec la sortie
    const branches = decoyBranches(w, dev, { time: tRug + Math.round(r.float(3, 5) * HOUR), share: 0.45, branches: 3, entity: devE, returnTo: dev })
    // Le relais rend ses reliquats au développeur après chaque lancement
    const sweepTimes = [tOldRug + Math.round(r.float(2, 9) * HOUR), tRug + Math.round(r.float(5, 10) * HOUR)]
    sweepTimes.forEach((t, i) => {
      const left = Math.floor(w.balanceOf(relay, 'SOL') * 1e4) / 1e4
      // Premier reliquat : pris sur ce qui restait après le lancement précédent (le solde final inclut aussi le second)
      const oldLeft = oldRelayTotal - oldSniperFunds.reduce((s, x) => s + x, 0)
      const v = i === 0 ? Math.floor(oldLeft * r.float(0.4, 0.6) * 1e4) / 1e4 : left
      if (v > 0) w.transfer({ time: t, from: relay, to: dev, value: v, asset: 'SOL', method: 'transfer (reliquat)' })
    })
    // Empoisonnement d'adresse : des sosies envoient des micro-montants d'USDC
    dusting(w, dev, { time: tRug + DAY, n: 3, spreadH: 30, token: 'USDC' })
    dusting(w, outs[1], { time: tRug + 2 * DAY, n: 2, spreadH: 30, token: 'USDC' })

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (let i = 0; i < 26; i++) {
      const trader = w.addr('sol')
      const t = w.at(r.float(-2, 5) * 24)
      if (r.chance(0.5)) raySwap(trader, 'SOL', sol(r.float(1, 250)), 'USDC', t)
      else raySwap(trader, 'USDC', usdc(r.float(100, 40000)), 'SOL', t)
    }
    dest.noise(14, w.at(-2 * 24), w.at(5 * 24), 'USDC')
    dest.noise(8, w.at(-2 * 24), w.at(5 * 24), 'SOL')
    fund.noise(12, tFund - 3 * DAY, w.at(3 * 24), 'SOL')
    for (const [k, kit] of kits) if (k !== fundKey && k !== destKey) kit.noise(8, w.at(-6 * 24), w.at(3 * 24), 'SOL')
    // Autres utilisateurs du bridge dans la même fenêtre
    for (let i = 0; i < r.int(3, 5); i++) {
      const u = w.addr('sol')
      const v = usdc(r.float(300, 25000))
      const ts = tBridge + r.int(-6, 6) * HOUR
      w.fundAccount(u, v, 'USDC', ts - r.int(2, 30) * HOUR)
      const tc = 'eth' as const
      br.send({ from: u, value: v, asset: 'USDC', time: ts, toChain: tc, recipient: w.addr(tc) })
    }

    // ── Synthèse (calculée sur le monde final) ─────────────────────────────
    const publicIn = sol(buyers.reduce((s, b) => s + b.value, 0) + victimLoss)
    const launchBlock = sniperBuyTxs[0].block
    const sameBlockBots = botBuyTxs.filter((t) => t.block === launchBlock).length
    const sniperIn = sol(sniperBuys.reduce((s, v) => s + v, 0))
    const fundName = fund.entity.name
    const destName = dest.entity.name
    const nOthers = nB + bots.length
    const devSolLeft = sol(w.balanceOf(dev, 'SOL'))
    const keptUsdc = usdc(w.balanceOf(outs[1], 'USDC'))
    const ethHeld = usdc(w.balanceOf(ethR, 'USDC'))
    const nBranchDev = branches.length
    const oldDays = Math.round((tL - tOld) / DAY)
    const oldWeeks = Math.round(oldDays / 7) <= 2 ? 'deux semaines' : 'trois semaines'
    const kolRel = relDay(kolTx.time, tL, 'lancement')
    const branchTxt = branches.map((b) => `${A(w, b.address).slice(0, 8)}… (${amt(b.value, 'SOL')}, ${b.fate === 'dort' ? 'jamais dépensés' : b.fate === 'dépensée' ? 'petites dépenses' : b.fate === 'retour' ? 'renvoyés au développeur' : 'ré-éclatés en petits montants'})`).join(', ')

    return {
      world: w,
      title: `Rug pull ${T} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. ${g('Il', 'Elle')} a acheté le memecoin « ${tok.name} » (${T}), lancé sur Solana par un développeur se présentant sous le pseudonyme « ${handle} » sur X et Telegram, qui promettait « la liquidité brûlée » et « un x100 avant la fin de la semaine ». Le lancement avait été relayé par l'influenceur @${kolHandle}.\n\n` +
        `${Math.round(rugH)} heures après le lancement, le cours s'est effondré à zéro : le développeur a retiré toute la liquidité du pool Raydium, puis le canal Telegram a été supprimé. Les jetons de la victime ne peuvent plus être revendus. Sur un forum, d'anciens acheteurs affirment que « ${handle} » a déjà fait le coup.\n\n` +
        `Le jeton n'apparaît pas sur le graphe : seuls les SOL et les USDC sont représentés. Un achat se lit comme un envoi de SOL vers le pool ${T}/SOL, une vente comme un versement de SOL du pool vers le vendeur.\n\n` +
        `Objectifs : identifier le portefeuille du développeur et ses snipers, mesurer le retrait de liquidité, établir ses antécédents, suivre chaque part du produit (exchange, portefeuille dormant, bridge) et remonter au financement initial du développeur. Le portefeuille du développeur est actif : triez ses mouvements.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(2 * 24), author: victimName,
          body:
            `« J'ai vu passer le jeton ${T} sur X, d'abord chez @${kolHandle} que je suis depuis longtemps, puis sur le compte @${handle} et dans un groupe Telegram où tout le monde parlait d'un x100. J'avais déjà essayé un autre memecoin quelques jours avant, ça s'était bien passé. J'ai acheté des SOL sur Coinhouse, je les ai envoyés sur mon portefeuille Solana et j'ai acheté sur Raydium, deux fois.\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Premier achat (${amt(v1, 'SOL')}) : ${vBuy1.hash}\n` +
            `Second achat (${amt(v2, 'SOL')}) : ${vBuy2.hash}\n\n` +
            `Le ${fmtDate(tRug)}, le cours est tombé à zéro d'un coup. Je n'ai rien pu revendre. Au total j'ai perdu ${amt(victimLoss, 'SOL')}, environ ${usd0(usd('SOL', victimLoss))}. »`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Annonce épinglée du canal Telegram ${T}`, author: `@${handle}`, date: tL - 40 * 60,
          body:
            `🃏 ${T} — ${tok.name.toUpperCase()} LAUNCH 🃏\n` +
            `CA : ${A(w, mint)}\n` +
            `Ouverture du pool Raydium : ${fmtDate(tL)}\n` +
            `✅ LP burned 🔥  ✅ Mint authority revoked  ✅ 0 % team tokens\n` +
            `✅ Dev based, pas de snipers, fair launch pour la commu 🇫🇷\n` +
            `On vise le x100 cette semaine. NFA, DYOR 🚀`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture d\'un agrégateur de cours (après les faits)', date: tRug + 2 * HOUR,
          body:
            `${T}/SOL · Raydium\n` +
            `Pool : ${A(w, pool)}\n` +
            `Prix : -99,9 % (24 h)\n` +
            `Liquidité : 0 SOL\n` +
            `Âge de la paire : ${Math.round(rugH + 2)} h · Acheteurs : ${nOthers + nS + 1}\n` +
            `Dernière transaction notable : retrait de liquidité (withdraw), ${fmtDate(tRug)}`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil Reddit r/solanamemecoins (copie d\'écran)', date: tRug + 5 * HOUR, author: 'u/rekt_again_fr',
          body:
            `Encore un rug ${de(handle)} 🤡. Pour ceux qui débarquent : il y a ${oldWeeks} il avait sorti ${TO} (« ${tokOld.name} »), même discours « LP burned, pas de snipers », même pool vidé au bout de quelques heures. J'y avais laissé quelques SOL.\n` +
            `Je n'ai plus le CA de ${TO}, mais si quelqu'un a l'adresse du dev il suffit de regarder son historique.\n` +
            `> réponse de u/solsleuth : et il a payé @${kolHandle} ${kolRel}, c'est visible on-chain 👀`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT sur le compte promoteur', date: w.at(3 * 24), author: 'Cellule cyber',
          body:
            `Compte X @${handle} : créé ${r.int(6, 12)} semaines avant les faits, ${r.int(4, 18)} 400 abonnés dont une large majorité de comptes inactifs ou créés en série (achat d'abonnés probable). Aucune identité réelle, photo de profil générée.\n` +
            `Le site du projet a été enregistré ${r.int(2, 6)} jours avant le lancement, derrière un service d'anonymisation du titulaire. Toutes les publications ont été supprimées dans l'heure qui a suivi le retrait de liquidité.\n` +
            `Le compte avait épinglé l'adresse du contrat du jeton (CA) ${A(w, mint)}.\n` +
            `L'influenceur @${kolHandle} (environ ${r.int(30, 90)} 000 abonnés) affiche dans sa biographie une adresse Solana « pour les collabs » : ${A(w, kol)}. Il a publié un message promotionnel sur ${T} ${kolRel}, sans mention de partenariat rémunéré.\n` +
            `Piste : sur Solana, le portefeuille qui crée le jeton et le pool est visible on-chain. Son premier financement est souvent le meilleur pivot d'identification.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : lire un lancement sur Solana', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• Solana est un modèle à comptes : pas de rendu, les soldes se suivent comme sur Ethereum. Les frais de base sont infimes (0,000005 SOL), les « frais de priorité » plus élevés trahissent souvent des robots.\n` +
            `• Un bloc (slot) dure environ 0,4 s. Acheter dans le même bloc que l'ouverture du pool, ou juste après, suppose un robot préparé à l'avance : on parle de « snipers ».\n` +
            `• Un sniper lié au développeur se reconnaît à son financement (même source, même relais), à sa revente juste avant le retrait, et au retour des fonds vers le développeur.\n` +
            `• « LP burned » signifie que les jetons de liquidité ont été détruits : le retrait devient impossible. Si un retrait a eu lieu, la promesse était fausse.\n` +
            `• Un portefeuille de développeur actif reçoit des micro-montants d'USDC venant d'adresses « sosies » (mêmes premiers et derniers caractères) : c'est de l'empoisonnement d'adresse, sans lien avec l'affaire.\n` +
            `• Un bridge publie dans ses événements la chaîne cible, le destinataire et un nonce : la transaction d'arrivée sur l'autre chaîne porte le même nonce.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse du développeur, qui a créé le jeton puis retiré la liquidité ?',
          answer: [dev],
          hint: 'Ouvrez le contrat du jeton (CA de l\'annonce Telegram) : sa transaction de création désigne le portefeuille qui l\'a déployé. Vérifiez sur le pool qui a ajouté puis retiré la liquidité.',
          explanation: `${A(w, dev)} crée le jeton (${fmtDate(mintTx.time)}), crée le pool ${T}/SOL en y apportant ${amt(L, 'SOL')} au lancement (${fmtDate(tL)}), puis signe le retrait de toute la liquidité le ${fmtDate(tRug)}. Créateur du mint, apporteur et bénéficiaire de la liquidité : c'est le même portefeuille. Les acheteurs du pool, eux, n'ont fait qu'envoyer des SOL au pool.`,
        },
        {
          id: 'o9', type: 'amount', points: 7, unit: 'SOL', tolerance: 0.01,
          prompt: 'Combien de SOL le développeur a-t-il apportés au pool lors du lancement (liquidité initiale, hors frais de création du pool) ?',
          answer: L,
          hint: 'Ouvrez la transaction de création du pool (initialize2) : elle comporte deux jambes, l\'apport au pool et les frais versés à Raydium. Attention, le développeur a créé deux pools : prenez celui de ce jeton.',
          explanation: `Le ${fmtDate(tL)}, la transaction de lancement verse ${amt(L, 'SOL')} au pool ${T}/SOL et ${amt(createFee, 'SOL')} de frais de création à Raydium. C'est la mise de départ du développeur, à comparer à ce qu'il retire au rug pull. Ne pas confondre avec l'initialize2 du ${fmtDate(tOld, false)} (${amt(Lold, 'SOL')}), qui concerne l'autre jeton, ${TO}.`,
        },
        {
          id: 'o2', type: 'addresses', points: 10,
          prompt: `Quelles adresses sont les snipers contrôlés par le développeur lors du lancement de ${T} ?`,
          answer: snipers,
          hint: 'Regardez les tout premiers achats sur le pool, puis remontez le financement de chacun : les snipers du développeur partagent la même source.',
          explanation:
            `Dans le bloc ${launchBlock.toLocaleString('fr-FR')}, une seconde après l'ouverture du pool, ${nS} adresses achètent pour ${amt(sniperIn, 'SOL')} au total. Toutes ont été financées dans les deux heures précédant le lancement par le même relais ${A(w, relay)}, lui-même alimenté par le développeur. Elles revendent quelques minutes avant le retrait de liquidité et renvoient leurs SOL au développeur (${amt(sniperProfit, 'SOL')}).\n` +
            `Les ${bots.length} autres acheteurs très précoces${sameBlockBots ? ` (dont ${sameBlockBots} dans le même bloc)` : ''} sont des bots de sniping indépendants : financés par ${botKeys.map((k) => w.entity(k).name).join(' et ')}, actifs sur d'autres lancements, ils ne renvoient rien au développeur. Les deux snipers financés par le même relais ${oldDays} jours plus tôt ont servi au lancement de ${TO}, pas à celui-ci : ils n'achètent pas sur le pool ${T}.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Par quel portefeuille relais les snipers du développeur ont-ils été financés ?',
          answer: [relay],
          hint: 'Remontez le flux entrant de chaque sniper juste avant le lancement : ils ont tous la même source, elle-même alimentée par le développeur.',
          explanation: `${A(w, relay)} reçoit ${amt(relayTotal, 'SOL')} du développeur ${Math.round((tL - relayTx.time) / 3600)} h environ avant le lancement, puis répartit ${sniperFunds.map((v) => amt(v, 'SOL')).join(', ')} entre les ${nS} snipers. Son historique montre qu'il avait déjà servi, le ${fmtDate(oldRelayTx.time, false)}, à financer deux snipers du lancement de ${TO}, et qu'il rend ses reliquats au développeur après chaque lancement : un relais réutilisé d'une affaire à l'autre relie les deux escroqueries au même auteur.`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'SOL', tolerance: 0.02,
          prompt: `Combien de SOL le développeur a-t-il retirés du pool ${T}/SOL lors du rug pull ?`,
          answer: removed,
          hint: 'C\'est la seule transaction où ce pool verse ses SOL au développeur.',
          explanation: `Le retrait du ${fmtDate(tRug)} rapporte ${amt(removed, 'SOL')} (≈ ${usd0(usd('SOL', removed))}) au développeur, qui avait apporté ${amt(L, 'SOL')} de liquidité. Le reste du pool vient des acheteurs (${amt(publicIn, 'SOL')} injectés par le public, dont ${amt(victimLoss, 'SOL')} par ${g('le plaignant', 'la plaignante')}), déduction faite des reventes : quelques minutes plus tôt, les snipers en avaient déjà extrait ${amt(sol(dumps.reduce((s, v) => s + v, 0)), 'SOL')}. La promesse « LP burned » était fausse.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'SOL', tolerance: 0.02,
          prompt: 'Combien de SOL les snipers ont-ils renvoyés au développeur après le retrait de liquidité ?',
          answer: sniperProfit,
          hint: 'Après le rug pull, chaque sniper vide son solde vers une même adresse : additionnez ces transferts (et seulement ceux du jour du rug pull de ce jeton).',
          explanation: `Les ${nS} snipers renvoient ${amt(sniperProfit, 'SOL')} au développeur dans l'heure qui suit le retrait (après avoir acheté pour ${amt(sniperIn, 'SOL')} et revendu juste avant). Ce retour des fonds est la preuve la plus solide du contrôle des snipers par le développeur. Les retours des snipers de ${TO}, ${oldDays} jours plus tôt, ne font pas partie de ce montant.`,
        },
        {
          id: 'o12', type: 'address', points: 10,
          prompt: 'Le développeur n\'en est pas à son coup d\'essai. Quel autre pool Raydium a-t-il créé puis vidé avant celui-ci ?',
          answer: [oldPool],
          hint: 'Parcourez l\'historique du portefeuille du développeur avant le lancement : cherchez une autre création de pool (initialize2) suivie d\'un retrait (withdraw).',
          explanation: `Le ${fmtDate(tOld)}, le développeur crée le pool ${TO}/SOL (${A(w, oldPool)}) avec ${amt(Lold, 'SOL')}, sniping par deux adresses financées par le même relais, paiement à VolumeForge, puis retire ${amt(oldRemoved, 'SOL')} environ ${Math.round(oldRugH)} h plus tard (${oldRugTx.hash.slice(0, 14)}…). ${nOB} acheteurs y ont injecté ${amt(sol(oldPublic), 'SOL')} : autant de victimes potentielles à rechercher, et la preuve d'une habitude (escroquerie en série). Le message du forum l'annonçait, la blockchain le démontre.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Quel exchange a financé le portefeuille du développeur (premier financement) ?',
          answer: [fundKey],
          hint: 'Remontez les flux entrants du développeur jusqu\'au plus ancien. Ni les retours de snipers, ni les retraits de liquidité, ni les micro-montants ne sont des financements.',
          explanation: `Le ${fmtDate(tFund)}, ${fundName} verse ${amt(W0, 'SOL')} au développeur depuis son hot wallet : c'est son premier financement (« first funder »), qui couvre les deux lancements. Le versement de ${amt(extraTx.transfers[0].value, 'SOL')} venu d'une adresse non attribuée est bien postérieur et accessoire ; les SOL du pool ${TO} sont le produit d'une première escroquerie. Ce retrait est rattaché à un compte client : la réquisition à ${fundName} (hash ${fundTx.hash.slice(0, 16)}…) peut donner l'identité du développeur. ${procedureFor(fund.entity)}`,
        },
        {
          id: 'o5', type: 'entity', points: 8,
          prompt: 'Sur quel exchange une partie des fonds convertis a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Après le retrait, suivez les SOL du développeur : un swap sur Raydium, puis des USDC dispersés sur trois portefeuilles neufs. Un seul envoie vers une adresse balayée par un hot wallet.',
          explanation: `Le développeur échange ${amt(swapIn, 'SOL')} contre ${amt(sw.amountOut, 'USDC')} sur le pool SOL/USDC de Raydium, répartit les USDC sur trois portefeuilles neufs (après leur avoir envoyé un peu de SOL pour les frais) : ${A(w, outs[0]).slice(0, 8)}… dépose ${amt(u1, 'USDC')} sur ${destName}. Les deux autres portefeuilles ne touchent aucun exchange.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt faut-il viser dans la réquisition à cet exchange ?',
          answer: [dep],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDC avant d\'être balayée.',
          explanation: `${A(w, outs[0])} verse ${amt(u1, 'USDC')} sur ${A(w, dep)}, balayée ensuite vers le hot wallet ${de(destName)} : c'est l'adresse de dépôt propre au compte client. Le hot wallet, commun à toute la clientèle, n'identifie personne.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: 'Lequel des trois portefeuilles alimentés en USDC conserve ses fonds sur Solana ?',
          answer: [outs[1]],
          hint: 'Vérifiez ce que fait chacun des trois portefeuilles après réception. Les micro-montants reçus de sosies ne sont pas des mouvements du suspect.',
          explanation: `${A(w, outs[1])} a reçu ${amt(u2, 'USDC')} et n'a rien envoyé (${amt(keptUsdc, 'USDC')} au solde, poussière d'empoisonnement comprise). Les deux autres ont bougé : l'un vers ${destName}, l'autre vers le contrat ArcBridge. Ces USDC peuvent faire l'objet d'une demande de gel auprès de Circle, émetteur de l'USDC.`,
        },
        {
          id: 'o13', type: 'address', points: 10,
          prompt: 'La plus grosse part des USDC a quitté Solana. Sur quelle adresse de quelle autre chaîne est-elle arrivée ?',
          answer: [ethR],
          hint: 'Le troisième portefeuille appelle le contrat d\'un bridge (bridgeOut) : l\'événement publie la chaîne cible, le destinataire et un nonce. Retrouvez la transaction d\'arrivée qui porte le même nonce.',
          explanation: `Le ${fmtDate(bout.outTx.time)}, ${A(w, outs[2]).slice(0, 8)}… envoie ${amt(u3, 'USDC')} au contrat ArcBridge sur Solana, à destination d'Ethereum ; quelques minutes plus tard, le contrat ArcBridge sur Ethereum verse ${amt(bout.received, 'USDC')} à ${A(w, ethR)} (même nonce ${bout.outTx.bridge?.nonce}). L'adresse Ethereum n'a rien dépensé depuis : ${amt(ethHeld, 'USDC')} y sont toujours. Les autres utilisateurs du bridge dans la même fenêtre ont d'autres montants, d'autres nonces et d'autres destinataires.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Quelle suite procédurale retenir ?',
          hint: 'Qui détient une identité, qui peut bloquer un stablecoin, et qui ne peut ni l\'un ni l\'autre ?',
          ...choice(r,
            `Requérir ${destName} sur l'adresse de dépôt et ${fundName} sur le retrait initial ; demander en urgence à Circle le gel des USDC encore détenus, sur Solana comme sur Ethereum`,
            [
              'Requérir Raydium, qui détient l\'identité du créateur du pool et peut annuler le retrait de liquidité',
              'Requérir ArcBridge pour qu\'il restitue les USDC passés sur Ethereum, puisqu\'ils ont transité par son contrat',
              `Attendre que les USDC dormants bougent vers un exchange avant de lancer toute réquisition`,
            ]),
          explanation:
            `${destName} détient le titulaire du compte qui a reçu ${amt(u1, 'USDC')} : réquisition prioritaire, avec demande de gel. ${procedureFor(dest.entity)}\n` +
            `${fundName} ne détient plus les fonds, mais connaît le titulaire du compte qui a financé le développeur : deuxième réquisition.\n` +
            `Les USDC dormants (${amt(keptUsdc, 'USDC')} sur Solana, ${amt(ethHeld, 'USDC')} sur Ethereum) restent à la merci d'un déplacement : la demande de gel à Circle n'attend pas. Raydium et ArcBridge sont des protocoles sans compte ni KYC : ils n'identifient personne et ne peuvent rien annuler ni restituer.`,
        },
      ],
      truth: {
        path: [
          fundTx.id, mintTx.id, relayTx.id, ...sniperFundTxs.map((t) => t.id), lpTx.id, ...sniperBuyTxs.map((t) => t.id),
          victimFund.id, vBuy1.id, vBuy2.id, ...dumpTxs.map((t) => t.id), rugTx.id, ...returnTxs.map((t) => t.id), sw.tx.id,
          ...gasTxs.map((t) => t.id), ...splitTxs.map((t) => t.id), d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), bout.outTx.id, bout.inTx.id,
        ],
        addresses: [dev, relay, ...snipers, mint, pool, ...outs, dep, ethR, oldPool],
        debrief:
          `1. Le ${fmtDate(tFund, false)}, ${fundName} verse ${amt(W0, 'SOL')} au développeur ${A(w, dev)} : c'est son premier financement.\n` +
          `2. Le ${fmtDate(tOld, false)}, répétition générale : jeton ${TO}, deux snipers financés par le relais ${A(w, relay)}, paiement à VolumeForge, pool de ${amt(Lold, 'SOL')} vidé au bout de ${Math.round(oldRugH)} h (${amt(oldRemoved, 'SOL')} retirés, ${nOB} acheteurs piégés).\n` +
          `3. Avant ce lancement, il paie l'influenceur @${kolHandle} (${amt(kolFee, 'SOL')}, ${fmtDate(kolTx.time, false)}) et VolumeForge (${amt(volFees[1], 'SOL')}, ${volTx.hash.slice(0, 10)}…), crée ${T} (${A(w, mint)}) et prépare ${nS} snipers via le même relais.\n` +
          `4. Le ${fmtDate(tL)}, il crée le pool Raydium ${T}/SOL avec ${amt(L, 'SOL')}. Une seconde plus tard, ses ${nS} snipers achètent pour ${amt(sniperIn, 'SOL')}, aux côtés de ${bots.length} bots indépendants (fausses pistes : financés ailleurs, rien ne revient au développeur).\n` +
          `5. Pendant ${Math.round(rugH)} heures, ${nB + 1} acheteurs du public, dont ${victimName} (${amt(victimLoss, 'SOL')}), injectent ${amt(publicIn, 'SOL')}.\n` +
          `6. Les snipers revendent ; le développeur retire toute la liquidité (${amt(removed, 'SOL')}) ; les snipers lui renvoient ${amt(sniperProfit, 'SOL')}.\n` +
          `7. Il convertit ${amt(swapIn, 'SOL')} en ${amt(sw.amountOut, 'USDC')} et répartit les USDC : ${amt(u1, 'USDC')} déposés sur ${destName} (${A(w, dep).slice(0, 10)}…), ${amt(u2, 'USDC')} laissés dormants sur ${A(w, outs[1]).slice(0, 10)}…, ${amt(u3, 'USDC')} passés sur Ethereum par ArcBridge vers ${A(w, ethR).slice(0, 12)}…, où ils dorment encore.\n` +
          `8. Fausses pistes du portefeuille du développeur : ${nBranchDev} envois de SOL vers des portefeuilles neufs quelques heures après le retrait (${branchTxt}), aucun ne rejoint un exchange ni le bridge ; des micro-montants d'USDC venus d'adresses sosies (empoisonnement) ; le versement non attribué antérieur au lancement. Il lui reste ${amt(devSolLeft, 'SOL')}.\n\n` +
          `À retenir : dans un rug pull de memecoin, le développeur se désigne lui-même en créant le jeton, en apportant puis en retirant la liquidité, et son historique trahit souvent d'autres lancements (relais et prestataires réutilisés). Les snipers « maison » se reconnaissent à leur financement commun et au retour des fonds. L'affaire ne s'arrête pas à l'exchange : la plus grosse part est passée par un bridge et dort sur Ethereum, en USDC gelable par l'émetteur. Les pivots d'identification restent le premier financement (${fundName}) et l'adresse de dépôt (${destName}).`,
      },
      hints: [
        'Partez du contrat du jeton (CA) cité dans l\'annonce Telegram : sa transaction de création désigne le portefeuille du développeur.',
        'Sur le pool, classez les transactions par heure : l\'ajout de liquidité, puis les achats du tout premier bloc. Remontez le financement de chacun de ces acheteurs.',
        'L\'historique du développeur remonte à plusieurs semaines : repérez une autre création de pool et le relais qui revient.',
        'Après le retrait, suivez les SOL du développeur : un swap SOL → USDC sur Raydium, puis trois portefeuilles neufs. Suivez chacun jusqu\'au bout : exchange, rien, ou bridge.',
        'Les envois de SOL du développeur vers d\'autres portefeuilles neufs après le retrait et les micro-montants d\'USDC venus de sosies sont des fausses pistes : vérifiez où ils mènent avant de les retenir.',
      ],
    }
  },
}
