import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

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

export const solMemecoinRug: ScenarioTemplate = {
  id: 'sol-memecoin-rug',
  title: 'Rug pull d\'un memecoin sur Solana',
  tagline: 'Un jeton « 100x », des snipers dans le premier bloc, une liquidité qui s\'évapore.',
  description:
    'Un développeur anonyme lance un memecoin sur Raydium, fait la promotion sur X et Telegram, puis retire toute la liquidité quelques heures plus tard. Identifiez son portefeuille et ses snipers, mesurez le retrait, suivez la conversion en USDC jusqu\'à l\'exchange de sortie et remontez au premier financement du développeur.',
  difficulty: 2,
  chains: ['sol'],
  skills: ['evm', 'tokens', 'dex', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 50,
  lessons: ['solana', 'rug-pulls', 'dex-defi', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const handle = fakeHandle(r)
    const tok = r.pick(TOKENS)
    const T = `$${tok.ticker}`

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

    const raydium = w.entity('raydium')
    const projectE = w.customEntity({ name: `${tok.name} (${T})`, category: 'scam', description: 'Memecoin lancé sur Raydium, abandonné après le retrait de la liquidité (rug pull).' })
    const devE = w.customEntity({ name: `Développeur « ${handle} » (inconnu)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })

    const dev = w.addr('sol', { entity: devE })
    const relay = w.addr('sol', { entity: devE })
    const victim = w.addr('sol', { entity: victimE })
    const mint = w.addr('sol', { entity: projectE, label: `Jeton ${tok.name} (${T})`, contract: { name: `${T} — SPL Token Mint`, type: 'token' } })
    const pool = w.addr('sol', { entity: raydium, label: `Raydium: Pool ${T}/SOL`, contract: { name: `Raydium ${T}/SOL Pool`, type: 'pool' } })
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
    const W0 = sol(relayTotal + L + mintRent + createFee + r.float(1.2, 4))

    // 1. Financement du développeur : retrait depuis un exchange (first funder)
    const tFund = w.at(-r.float(2, 5) * 24)
    const fundTx = fund.withdraw(dev, W0, tFund, 'SOL')
    // Versement ultérieur depuis une adresse non attribuée (fausse piste « financeur »)
    const extraTx = w.fundAccount(dev, sol(r.float(1.5, 5)), 'SOL', w.at(-r.float(12, 30)))

    // 2. Création du jeton
    const mintTx = w.multi({ time: w.at(-r.float(4, 8)), signer: dev, legs: [{ from: dev, to: mint, value: mintRent, asset: 'SOL' }], method: `InitializeMint2 + CreateMetadata (${T})`, fee: 0.000015 })

    // 3. Préparation des snipers via un portefeuille relais
    const relayTx = w.transfer({ time: w.at(-r.float(2.5, 3.5)), from: dev, to: relay, value: relayTotal, asset: 'SOL' })
    const sniperFundTxs = snipers.map((s, i) => w.transfer({ time: w.at(-r.float(0.6, 1.9)), from: relay, to: s, value: sniperFunds[i], asset: 'SOL' }))

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
    const botSellTxs = bots.map((b, i) => sell(b, sol(botBuys[i] * r.float(1.4, 2.6)), tL + Math.round(r.float(0.1, 2) * HOUR)))

    // 6. Acheteurs publics, dont la victime
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
    const swapIn = sol(w.balanceOf(dev, 'SOL') * r.float(0.88, 0.94))
    const sw = raySwap(dev, 'SOL', swapIn, 'USDC', tSwap)

    // 11. Dispersion vers trois portefeuilles (chacun reçoit d'abord des SOL pour les frais)
    const outs = [w.addr('sol', { entity: devE }), w.addr('sol', { entity: devE }), w.addr('sol', { entity: devE })]
    const u1 = usdc(sw.amountOut * r.float(0.35, 0.45))
    const u2 = usdc(sw.amountOut * r.float(0.3, 0.38))
    const u3 = usdc(sw.amountOut - u1 - u2)
    const parts = [u1, u2, u3]
    const gasTxs: Tx[] = []
    const splitTxs: Tx[] = []
    outs.forEach((o, i) => {
      const tg = tSwap + r.int(10, 30) * 60 + i * r.int(60, 240)
      gasTxs.push(w.transfer({ time: tg, from: dev, to: o, value: sol(r.float(0.01, 0.03)), asset: 'SOL' }))
      splitTxs.push(w.transfer({ time: tg + r.int(2, 10) * 60, from: dev, to: o, value: parts[i], asset: 'USDC' }))
    })

    // 12. Deux portefeuilles déposent sur la MÊME adresse de dépôt ; le troisième conserve
    const dep = dest.newDeposit()
    const d1 = dest.receive(outs[0], u1, tSwap + Math.round(r.float(2, 5) * HOUR), { asset: 'USDC', depositAddr: dep, sweepDelayH: r.float(0.3, 1.2) })
    const d2 = dest.receive(outs[1], u2, d1.tx.time + Math.round(r.float(4, 10) * HOUR), { asset: 'USDC', depositAddr: dep, sweepDelayH: r.float(0.3, 1.2) })
    const depositedUsdc = usdc(u1 + u2)
    const devSolLeft = sol(w.balanceOf(dev, 'SOL'))

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
    for (const [k, kit] of kits) if (k !== fundKey && k !== destKey) kit.noise(4, w.at(-6 * 24), w.at(3 * 24), 'SOL')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const publicIn = sol(buyers.reduce((s, b) => s + b.value, 0) + victimLoss)
    const launchBlock = sniperBuyTxs[0].block
    const sameBlockBots = botBuyTxs.filter((t) => t.block === launchBlock).length
    const sniperIn = sol(sniperBuys.reduce((s, v) => s + v, 0))
    const fundName = fund.entity.name
    const destName = dest.entity.name
    const nOthers = nB + bots.length

    return {
      world: w,
      title: `Rug pull ${T} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. ${g('Il', 'Elle')} a acheté le memecoin « ${tok.name} » (${T}), lancé sur Solana par un développeur se présentant sous le pseudonyme « ${handle} » sur X et Telegram, qui promettait « la liquidité brûlée » et « un x100 avant la fin de la semaine ».\n\n` +
        `Quelques heures après le lancement, le cours s'est effondré à zéro : le développeur a retiré toute la liquidité du pool Raydium, puis le canal Telegram a été supprimé. Les jetons de la victime ne peuvent plus être revendus.\n\n` +
        `Le jeton n'apparaît pas sur le graphe : seuls les SOL et les USDC sont représentés. Un achat se lit comme un envoi de SOL vers le pool ${T}/SOL, une vente comme un versement de SOL du pool vers le vendeur.\n\n` +
        `Objectifs : identifier le portefeuille du développeur et ses snipers, mesurer le retrait de liquidité, suivre la sortie des fonds jusqu'à l'exchange et remonter au financement initial du développeur.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(2 * 24), author: victimName,
          body:
            `« J'ai vu passer le jeton ${T} sur X, sur le compte @${handle}, puis dans un groupe Telegram où tout le monde parlait d'un x100. J'ai acheté des SOL sur Coinhouse, je les ai envoyés sur mon portefeuille Solana et j'ai acheté sur Raydium, deux fois.\n\n` +
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
            `Pool Raydium ouvert le ${fmtDate(tL)}\n` +
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
          id: 'osint', type: 'osint', title: 'Note OSINT sur le compte promoteur', date: w.at(3 * 24), author: 'Cellule cyber',
          body:
            `Compte X @${handle} : créé ${r.int(3, 9)} semaines avant les faits, ${r.int(4, 18)} 400 abonnés dont une large majorité de comptes inactifs ou créés en série (achat d'abonnés probable). Aucune identité réelle, photo de profil générée.\n` +
            `Le site du projet a été enregistré ${r.int(2, 6)} jours avant le lancement, derrière un service d'anonymisation du titulaire. Toutes les publications ont été supprimées dans l'heure qui a suivi le retrait de liquidité.\n` +
            `Le compte avait épinglé l'adresse du contrat du jeton (CA) ${A(w, mint)}.\n` +
            `Piste : sur Solana, le portefeuille qui crée le jeton et le pool est visible on-chain. Son premier financement est souvent le meilleur pivot d'identification.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : lire un lancement sur Solana', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• Solana est un modèle à comptes : pas de rendu, les soldes se suivent comme sur Ethereum. Les frais de base sont infimes (0,000005 SOL), les « frais de priorité » plus élevés trahissent souvent des robots.\n` +
            `• Un bloc (slot) dure environ 0,4 s. Acheter dans le même bloc que l'ouverture du pool, ou juste après, suppose un robot préparé à l'avance : on parle de « snipers ».\n` +
            `• Un sniper lié au développeur se reconnaît à son financement (même source, même relais), à sa revente juste avant le retrait, et au retour des fonds vers le développeur.\n` +
            `• « LP burned » signifie que les jetons de liquidité ont été détruits : le retrait devient impossible. Si un retrait a eu lieu, la promesse était fausse.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse du développeur, qui a créé le jeton puis retiré la liquidité ?',
          answer: [dev],
          hint: 'Ouvrez le contrat du jeton (CA de l\'annonce Telegram) : sa transaction de création désigne le portefeuille qui l\'a déployé. Vérifiez sur le pool qui a ajouté puis retiré la liquidité.',
          explanation: `${A(w, dev)} crée le jeton (${fmtDate(mintTx.time)}), crée le pool ${T}/SOL en y apportant ${amt(L, 'SOL')} au lancement (${fmtDate(tL)}), puis signe le retrait de toute la liquidité le ${fmtDate(tRug)}. Créateur du mint, apporteur et bénéficiaire de la liquidité : c'est le même portefeuille.`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'SOL', tolerance: 0.01,
          prompt: 'Combien de SOL le développeur a-t-il apportés au pool lors du lancement (liquidité initiale, hors frais de création du pool) ?',
          answer: L,
          hint: 'Ouvrez la transaction de création du pool (initialize2) : elle comporte deux jambes, l\'apport au pool et les frais versés à Raydium.',
          explanation: `Le ${fmtDate(tL)}, la transaction de lancement verse ${amt(L, 'SOL')} au pool ${T}/SOL et ${amt(createFee, 'SOL')} de frais de création à Raydium. C'est la mise de départ du développeur, à comparer à ce qu'il retire au rug pull : la différence mesure ce qu'il a pris au public.`,
        },
        {
          id: 'o2', type: 'addresses', points: 10,
          prompt: 'Quelles adresses sont les snipers contrôlés par le développeur ?',
          answer: snipers,
          hint: 'Regardez les tout premiers achats sur le pool, puis remontez le financement de chacun : les snipers du développeur partagent la même source.',
          explanation:
            `Dans le bloc ${launchBlock.toLocaleString('fr-FR')}, une seconde après l'ouverture du pool, ${nS} adresses achètent pour ${amt(sniperIn, 'SOL')} au total. Toutes ont été financées dans les deux heures précédant le lancement par le même relais ${A(w, relay)}, lui-même alimenté par le développeur. Elles revendent quelques minutes avant le retrait de liquidité et renvoient leurs SOL au développeur (${amt(sniperProfit, 'SOL')}).\n` +
            `Les ${bots.length} autres acheteurs très précoces${sameBlockBots ? ` (dont ${sameBlockBots} dans le même bloc)` : ''} sont des bots de sniping indépendants : financés par ${botKeys.map((k) => w.entity(k).name).join(' et ')}, actifs sur d'autres lancements, ils ne renvoient rien au développeur. Acheter tôt ne suffit pas : c'est le lien de financement qui fait le sniper « maison ».`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Par quel portefeuille relais les snipers du développeur ont-ils été financés ?',
          answer: [relay],
          hint: 'Remontez le flux entrant de chaque sniper juste avant le lancement : ils ont tous la même source, elle-même alimentée par le développeur.',
          explanation: `${A(w, relay)} reçoit ${amt(relayTotal, 'SOL')} du développeur ${Math.round((tL - relayTx.time) / 3600)} h environ avant le lancement, puis répartit ${sniperFunds.map((v) => amt(v, 'SOL')).join(', ')} entre les ${nS} snipers. Ce relais sert à masquer le lien direct entre développeur et snipers ; il le rend au contraire évident : une seule source, des montants calibrés juste au-dessus des achats du premier bloc.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'SOL', tolerance: 0.02,
          prompt: 'Combien de SOL le développeur a-t-il retirés du pool lors du rug pull ?',
          answer: removed,
          hint: 'C\'est la seule transaction où le pool verse ses SOL au développeur.',
          explanation: `Le retrait du ${fmtDate(tRug)} rapporte ${amt(removed, 'SOL')} (≈ ${usd0(usd('SOL', removed))}) au développeur, qui avait apporté ${amt(L, 'SOL')} de liquidité. Le reste du pool vient des acheteurs (${amt(publicIn, 'SOL')} injectés par le public, dont ${amt(victimLoss, 'SOL')} par ${g('le plaignant', 'la plaignante')}), déduction faite des reventes : quelques minutes plus tôt, les snipers en avaient déjà extrait ${amt(sol(dumps.reduce((s, v) => s + v, 0)), 'SOL')}. Le pool est vidé, les jetons restants ne valent plus rien : la promesse « LP burned » était fausse.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'SOL', tolerance: 0.02,
          prompt: 'Combien de SOL les snipers ont-ils renvoyés au développeur après le retrait de liquidité ?',
          answer: sniperProfit,
          hint: 'Après le rug pull, chaque sniper vide son solde vers une même adresse : additionnez ces transferts.',
          explanation: `Les ${nS} snipers renvoient ${amt(sniperProfit, 'SOL')} au développeur dans l'heure qui suit le retrait (après avoir acheté pour ${amt(sniperIn, 'SOL')} et revendu juste avant). Ce retour des fonds est la preuve la plus solide du contrôle des snipers par le développeur, et ce gain s'ajoute au produit de l'escroquerie.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Quel exchange a financé le portefeuille du développeur avant le lancement (premier financement) ?',
          answer: [fundKey],
          hint: 'Remontez les flux entrants du développeur jusqu\'au plus ancien : c\'est lui qui a apporté les SOL nécessaires à la création du jeton, du pool et des snipers.',
          explanation: `Le ${fmtDate(tFund)}, ${fundName} verse ${amt(W0, 'SOL')} au développeur depuis son hot wallet : c'est son premier financement (« first funder »), qui couvre la création du jeton, la liquidité et les snipers. Le versement suivant (${amt(extraTx.transfers[0].value, 'SOL')}, adresse non attribuée) est postérieur et accessoire. Ce retrait est rattaché à un compte client : la réquisition à ${fundName} (hash ${fundTx.hash.slice(0, 16)}…) peut donner l'identité du développeur. ${procedureFor(fund.entity)}`,
        },
        {
          id: 'o5', type: 'entity', points: 9,
          prompt: 'Sur quel exchange les fonds convertis ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Après le retrait, suivez les SOL du développeur : un swap sur Raydium, puis des USDC dispersés sur plusieurs portefeuilles.',
          explanation: `Le développeur échange ${amt(swapIn, 'SOL')} contre ${amt(sw.amountOut, 'USDC')} sur le pool SOL/USDC de Raydium, répartit les USDC sur trois portefeuilles neufs (après leur avoir envoyé un peu de SOL pour payer les frais), et deux d'entre eux déposent ${amt(depositedUsdc, 'USDC')} sur ${destName}.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt faut-il viser dans la réquisition à l\'exchange de sortie ?',
          answer: [dep],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDC avant d\'être balayée.',
          explanation: `${A(w, outs[0])} (${amt(u1, 'USDC')}) et ${A(w, outs[1])} (${amt(u2, 'USDC')}) déposent tous deux sur ${A(w, dep)}, balayée ensuite vers le hot wallet de ${destName}. Deux portefeuilles qui alimentent la même adresse de dépôt aboutissent au même compte client : la dispersion n'a servi à rien.`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: 'Lequel des portefeuilles alimentés en USDC par le développeur conserve encore ses fonds (gelables) ?',
          answer: [outs[2]],
          hint: 'Après le swap, le développeur répartit ses USDC sur plusieurs portefeuilles neufs : vérifiez lequel n\'a rien envoyé à l\'exchange.',
          explanation: `${A(w, outs[2])} a reçu ${amt(u3, 'USDC')} et n'a rien dépensé. Ces USDC peuvent faire l'objet d'une demande de gel auprès de l'émetteur de l'USDC, qui dispose de cette capacité : c'est la seule part du produit encore hors d'un exchange qu'on peut préserver.`,
        },
        {
          id: 'o7', type: 'choice', points: 9,
          prompt: 'Quelle suite procédurale retenir ?',
          hint: 'Qui détient une identité : un protocole sans compte, ou les plateformes à chaque bout de la chaîne ? Et qui peut bloquer un stablecoin ?',
          ...choice(r,
            `Requérir ${destName} sur l'adresse de dépôt (identité, IP, gel du solde) et ${fundName} sur le retrait qui a financé le développeur ; signaler les USDC restants à leur émetteur`,
            [
              'Requérir Raydium, qui détient l\'identité du créateur du pool et peut annuler le retrait de liquidité',
              `Demander à ${fundName} de geler les fonds du développeur, puisqu'ils proviennent de sa plateforme`,
              'Attendre que les USDC restés sur le troisième portefeuille bougent avant de lancer toute réquisition',
            ]),
          explanation:
            `${destName} détient le titulaire du compte qui a reçu ${amt(depositedUsdc, 'USDC')} : c'est la réquisition prioritaire, avec demande de gel. ${procedureFor(dest.entity)}\n` +
            `${fundName} ne détient plus les fonds, mais connaît le titulaire du compte qui a financé le développeur : deuxième réquisition, sur le retrait du ${fmtDate(tFund, false)}.\n` +
            `Raydium est un protocole sans compte ni KYC : il n'identifie personne et ne peut rien annuler. Les ${amt(u3, 'USDC')} restés sur ${A(w, outs[2])} peuvent faire l'objet d'une demande de gel auprès de l'émetteur de l'USDC, qui dispose de cette capacité.`,
        },
      ],
      truth: {
        path: [
          fundTx.id, mintTx.id, relayTx.id, ...sniperFundTxs.map((t) => t.id), lpTx.id, ...sniperBuyTxs.map((t) => t.id),
          victimFund.id, vBuy1.id, vBuy2.id, ...dumpTxs.map((t) => t.id), rugTx.id, ...returnTxs.map((t) => t.id), sw.tx.id,
          ...gasTxs.map((t) => t.id), ...splitTxs.map((t) => t.id), d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : []),
        ],
        addresses: [dev, relay, ...snipers, mint, pool, ...outs, dep],
        debrief:
          `1. Le ${fmtDate(tFund, false)}, ${fundName} verse ${amt(W0, 'SOL')} au développeur ${A(w, dev)} : c'est son premier financement.\n` +
          `2. Quelques heures avant le lancement, il crée le jeton ${T} (${A(w, mint)}) et prépare ${nS} snipers via le relais ${A(w, relay)}.\n` +
          `3. Le ${fmtDate(tL)}, il crée le pool Raydium ${T}/SOL avec ${amt(L, 'SOL')}. Une seconde plus tard, ses ${nS} snipers achètent pour ${amt(sniperIn, 'SOL')}, aux côtés de ${bots.length} bots indépendants.\n` +
          `4. Pendant ${Math.round(rugH)} heures, ${nB + 1} acheteurs du public, dont ${victimName} (${amt(victimLoss, 'SOL')}), injectent ${amt(publicIn, 'SOL')}.\n` +
          `5. Quelques minutes avant la fin, les snipers revendent ; puis le développeur retire toute la liquidité, soit ${amt(removed, 'SOL')}. Les snipers lui renvoient ${amt(sniperProfit, 'SOL')}.\n` +
          `6. Il convertit ${amt(swapIn, 'SOL')} en ${amt(sw.amountOut, 'USDC')} sur Raydium et répartit les USDC sur trois portefeuilles : deux déposent ${amt(depositedUsdc, 'USDC')} sur la même adresse de dépôt ${destName}, le troisième conserve ${amt(u3, 'USDC')}. Il reste ${amt(devSolLeft, 'SOL')} sur le portefeuille du développeur.\n\n` +
          `À retenir : dans un rug pull de memecoin, le pool centralise la preuve (chaque achat est une victime potentielle) et le développeur se désigne lui-même en créant le jeton, en apportant puis en retirant la liquidité. Les snipers « maison » se trahissent par leur financement commun et le retour des fonds. Deux pivots d'identification : le premier financement du développeur (${fundName}) et l'adresse de dépôt de sortie (${destName}). Les promesses marketing (« LP burned », « pas de snipers ») se vérifient on-chain en quelques clics.`,
      },
      hints: [
        'Partez du contrat du jeton (CA) cité dans l\'annonce Telegram : sa transaction de création désigne le portefeuille du développeur.',
        'Sur le pool, classez les transactions par heure : l\'ajout de liquidité, puis les achats du tout premier bloc. Remontez le financement de chacun de ces acheteurs.',
        'Après le retrait de liquidité, suivez les SOL du développeur : un swap SOL → USDC sur Raydium, puis des USDC dispersés. Comparez les adresses de dépôt atteintes.',
        'Faites le bilan du développeur : liquidité apportée, liquidité retirée, gains renvoyés par les snipers, USDC encore en sa possession.',
      ],
    }
  },
}
