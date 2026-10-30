import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import { genAddress } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Pump and dump d'un jeton lancé sur une plateforme de lancement (MoonPad,
// fictive) sur BNB Smart Chain. Le jeton n'est pas un actif du moteur : seuls
// les flux de BNB sont représentés (achat = BNB vers la courbe ou le pool,
// vente = BNB du pool vers le vendeur). Les initiés achètent dans le bloc de
// lancement via des portefeuilles financés par une même source, un canal
// d'« appels » rémunéré fait monter le cours, puis ils revendent en bloc.

const TOKENS = [
  { name: 'Grenouille Turbo', ticker: 'GRENOU' },
  { name: 'Croissant Rocket', ticker: 'CROISS' },
  { name: 'Mistral Inu', ticker: 'MISTRAL' },
  { name: 'Pétanque Pepe', ticker: 'PETANQ' },
  { name: 'Camembert AI', ticker: 'CAMAI' },
  { name: 'Coq Doré', ticker: 'COQDOR' },
] as const
const CHANNELS = ['Moonshot Calls FR', 'Gem Hunters Club', 'Alpha Calls 100x', 'Degen Radar'] as const

const bnb = (v: number) => roundAsset('BNB', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

export const pumpDump: ScenarioTemplate = {
  id: 'pump-dump',
  title: 'Pump and dump sur une plateforme de lancement',
  tagline: 'Des achats groupés dans le premier bloc, un « call » payé, une revente éclair.',
  description:
    'Un jeton lancé sur MoonPad s\'envole après la publication d\'un « call » sur un canal Telegram, puis s\'effondre en quelques minutes. Identifiez la source qui a financé les portefeuilles d\'initiés, délimitez-les, mesurez leur gain, prouvez la rémunération du canal et suivez l\'encaissement.',
  difficulty: 3,
  chains: ['bsc'],
  skills: ['evm', 'dex', 'defi', 'typologies', 'exchange_id', 'osint'],
  estMinutes: 60,
  lessons: ['manipulation-marche', 'rug-pulls', 'dex-defi', 'comptes-evm', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const g = victimP.g
    const tok = r.pick(TOKENS)
    const T = `$${tok.ticker}`
    const channel = r.pick(CHANNELS)
    const callerHandle = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const fundKey = r.pick(['binance', 'okx'] as const)
    const destKey = r.pick((['kraken', 'okx', 'binance', 'coinbase'] as const).filter((k) => k !== fundKey))
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'bsc')))
      return x
    }
    const fund = ex(fundKey)
    const dest = ex(destKey)
    const ramps = ['binance', 'okx', 'kraken'].map(ex)
    const pcs = dex(w, 'pancakeswap', 'bsc')
    const moonpad = w.entity('moonpad')

    const groupE = w.customEntity({ name: 'Groupe d\'initiés (inconnu)', category: 'suspect' })
    const callerE = w.customEntity({ name: `Canal « ${channel} » (inconnu)`, category: 'individual' })
    const victimE = w.customEntity({ name: victimP.name, category: 'victim' })
    const curve = w.addr('bsc', { entity: moonpad, label: `MoonPad : courbe de prix ${T}`, contract: { name: `MoonPad Bonding Curve ${T}`, type: 'pool' } })
    const mpFee = w.addr('bsc', { entity: moonpad, label: 'MoonPad : frais de plateforme', tags: ['liquid'] })
    const pool = w.addr('bsc', { entity: pcs.entity, label: `PancakeSwap: Pool ${T}/WBNB`, contract: { name: `PancakeSwap ${T}/WBNB Pool`, type: 'pool' } })
    // Adresse du contrat du jeton : citée dans les annonces, sans flux de BNB propre.
    const tokenCa = genAddress(r, 'bsc', 'contract')

    const buy = (trader: string, value: number, time: number, to: string, venue: string): Tx =>
      w.multi({ time, signer: trader, legs: [{ from: trader, to, value, asset: 'BNB' }], method: venue === 'mp' ? `buy (${T}) — MoonPad` : `swapExactETHForTokens (BNB → ${T})`, tags: ['swap'] })
    const sell = (trader: string, value: number, time: number, from: string, venue: string): Tx =>
      w.multi({ time, signer: trader, legs: [{ from, to: trader, value, asset: 'BNB' }], method: venue === 'mp' ? `sell (${T}) — MoonPad` : `swapExactTokensForETH (${T} → BNB)`, tags: ['swap'] })

    // ── Chronologie ──────────────────────────────────────────────────────────
    const tL = w.at(0)

    // 1. La source des initiés est alimentée par un exchange
    const K = r.int(7, 10)
    const buys = Array.from({ length: K }, () => bnb(r.float(0.6, 2.8)))
    const createFee = 0.02
    const funds = buys.map((b, i) => bnb(b + r.float(0.01, 0.04) + (i === 0 ? createFee : 0)))
    const callFee = bnb(Math.round(r.float(1.5, 4) * 10) / 10)
    const srcTotal = bnb(funds.reduce((s, v) => s + v, 0) + callFee + r.float(0.5, 2))
    const source = w.addr('bsc', { entity: groupE })
    const fundTx = fund.withdraw(source, srcTotal, tL - Math.round(r.float(2, 5) * DAY), 'BNB')

    // 2. Paiement du canal d'appels (la veille), parmi d'autres annonceurs
    const callerAddr = w.addr('bsc', { entity: callerE })
    const callPay = w.transfer({ time: tL - Math.round(r.float(14, 30) * HOUR), from: source, to: callerAddr, value: callFee, asset: 'BNB' })
    const otherPromos: Tx[] = []
    for (let i = 0; i < r.int(4, 7); i++) {
      const p = w.addr('bsc')
      const v = bnb(Math.round(r.float(1.2, 4.5) * 10) / 10)
      const t = tL + Math.round(r.float(-20, 12) * DAY)
      w.fundAccount(p, bnb(v + r.float(0.05, 1)), 'BNB', t - Math.round(r.float(2, 48) * HOUR))
      otherPromos.push(w.transfer({ time: t, from: p, to: callerAddr, value: v, asset: 'BNB' }))
    }
    // L'administrateur du canal encaisse ses recettes sur un exchange (adresse de dépôt à son nom)
    const callerKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const callerKit = ex(callerKey)
    const callerCash = callerKit.receive(callerAddr, bnb(w.balanceOf(callerAddr, 'BNB') * 0.9), tL + Math.round(r.float(12, 20) * DAY), { asset: 'BNB', sweepDelayH: r.float(0.5, 4) })

    // 3. Financement groupé des portefeuilles d'initiés
    const insiders = Array.from({ length: K }, () => w.addr('bsc', { entity: groupE }))
    const creator = insiders[0]
    const tF = tL - Math.round(r.float(1, 3) * HOUR)
    const fundTxs = insiders.map((a, i) => w.transfer({ time: tF + i * r.int(20, 140), from: source, to: a, value: funds[i], asset: 'BNB' }))
    const fundedTotal = bnb(funds.reduce((s, v) => s + v, 0))

    // 4. Création du jeton puis achats groupés dans le bloc suivant
    const createTx = w.multi({ time: tL, signer: creator, legs: [{ from: creator, to: mpFee, value: createFee, asset: 'BNB' }], method: `createToken (${T}) — MoonPad` })
    const tB = tL + 3
    const bundle = insiders.map((a, i) => buy(a, buys[i], tB, curve, 'mp'))

    // Robots de sniping indépendants (financés par des exchanges, actifs ailleurs)
    const bots = Array.from({ length: 2 }, (_, i) => {
      const b = w.addr('bsc')
      r.pick(ramps).withdraw(b, bnb(r.float(4, 15)), tL - Math.round(r.float(5, 40) * DAY), 'BNB')
      const v = bnb(r.float(0.3, 1.5))
      buy(b, v, tB + 3 * (i + 1), curve, 'mp')
      sell(b, bnb(v * r.float(1.3, 2.2)), tL + Math.round(r.float(0.3, 1.2) * HOUR), curve, 'mp')
      return b
    })

    // 5. Acheteurs organiques sur la courbe, jusqu'à la migration
    const tG = tL + Math.round(r.float(2, 4.5) * HOUR)
    for (let i = 0; i < r.int(8, 12); i++) {
      const a = w.addr('bsc')
      const t = tL + Math.round(r.float(0.2, (tG - tL) / HOUR - 0.2) * HOUR)
      const v = bnb(r.float(0.1, 2))
      w.fundAccount(a, bnb(v + r.float(0.02, 0.5)), 'BNB', t - Math.round(r.float(1, 30) * HOUR))
      buy(a, v, t, curve, 'mp')
    }
    const migFee = bnb(w.balanceOf(curve, 'BNB') * 0.02)
    const migV = bnb(w.balanceOf(curve, 'BNB') - migFee)
    const migTx = w.multi({ time: tG, signer: curve, legs: [{ from: curve, to: pool, value: migV, asset: 'BNB' }, { from: curve, to: mpFee, value: migFee, asset: 'BNB' }], method: `migrate (${T}) — liquidité vers PancakeSwap` })

    // 6. Le « call » puis l'afflux d'acheteurs sur PancakeSwap
    const tC = tG + Math.round(r.float(20, 60) * 60)
    const tD = tC + Math.round(r.float(35, 80) * 60)
    const victim = w.addr('bsc', { entity: victimE })
    const vBuy1V = bnb(r.float(1, 4))
    const vBuy2V = bnb(r.float(0.5, 2.5))
    const vFund = r.pick(ramps).withdraw(victim, bnb(vBuy1V + vBuy2V + r.float(0.05, 0.5)), tC - Math.round(r.float(1, 20) * DAY), 'BNB')
    const vBuy1 = buy(victim, vBuy1V, tC + Math.round(r.float(3, 15) * 60), pool, 'pcs')
    const vBuy2 = buy(victim, vBuy2V, tD - Math.round(r.float(3, 15) * 60), pool, 'pcs')
    const nPub = r.int(16, 24)
    for (let i = 0; i < nPub; i++) {
      const a = w.addr('bsc')
      const t = tC + Math.round(r.float(1, (tD - tC) / 60 + 25) * 60)
      const v = bnb(r.float(0.2, 5))
      w.fundAccount(a, bnb(v + r.float(0.02, 0.6)), 'BNB', t - Math.round(r.float(1, 72) * HOUR))
      buy(a, v, t, pool, 'pcs')
    }

    // 7. Revente groupée des initiés
    const poolBefore = w.balanceOf(pool, 'BNB')
    const dumpTotal = poolBefore * r.float(0.55, 0.68)
    const buySum = buys.reduce((s, b) => s + b, 0)
    const sells = buys.map((b) => bnb((dumpTotal * b) / buySum))
    const dumpTxs = insiders.map((a, i) => sell(a, sells[i], tD + i * r.int(15, 90), pool, 'pcs'))
    // Quelques acheteurs paniquent et revendent à perte
    for (let i = 0; i < r.int(3, 5); i++) {
      const a = w.addr('bsc')
      w.fundAccount(a, bnb(r.float(0.3, 2)), 'BNB', tC + r.int(60, 1800))
      buy(a, bnb(w.balanceOf(a, 'BNB') * 0.95), tC + r.int(1900, 2400), pool, 'pcs')
      sell(a, bnb(r.float(0.05, 0.3)), tD + Math.round(r.float(0.3, 3) * HOUR), pool, 'pcs')
    }

    // 8. Regroupement des gains, conversion en USDT et dépôt
    const hub = w.addr('bsc', { entity: groupE })
    const tHub = tD + Math.round(r.float(1, 3) * HOUR)
    const hubTxs = insiders.map((a, i) => w.transfer({ time: tHub + i * r.int(30, 300), from: a, to: hub, value: bnb(w.balanceOf(a, 'BNB')), asset: 'BNB' }))
    const hubIn = bnb(hubTxs.reduce((s, t) => s + t.transfers[0].value, 0))
    const profit = bnb(hubIn - fundedTotal)
    const swapIn = bnb(hubIn * r.float(0.9, 0.97))
    const sw = pcs.swap({ trader: hub, assetIn: 'BNB', amountIn: swapIn, assetOut: 'USDT', time: tHub + Math.round(r.float(1, 3) * HOUR) })
    const dep = dest.newDeposit()
    const u1 = roundAsset('USDT', sw.amountOut * r.float(0.45, 0.6))
    const d1 = dest.receive(hub, u1, sw.tx.time + Math.round(r.float(1, 5) * HOUR), { asset: 'USDT', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const d2 = dest.receive(hub, roundAsset('USDT', sw.amountOut - u1), d1.tx.time + Math.round(r.float(3, 12) * HOUR), { asset: 'USDT', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })

    // ── Bruit ────────────────────────────────────────────────────────────────
    pcs.noise(24, tL - 2 * DAY, tL + 4 * DAY, [['BNB', 'USDT'], ['BNB', 'USDC']])
    dest.noise(14, tL - 2 * DAY, tL + 5 * DAY, 'USDT')
    fund.noise(10, fundTx.time - 3 * DAY, tL + 2 * DAY, 'BNB')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const launchBlock = bundle[0].block
    const victimLoss = bnb(vBuy1V + vBuy2V)
    const destName = dest.entity.name
    const callToDump = Math.round((dumpTxs[0].time - tC) / 60)
    const deposited = roundAsset('USDT', d1.tx.transfers[0].value + d2.tx.transfers[0].value)
    const promoCount = otherPromos.length + 1

    return {
      world: w,
      title: `Pump and dump ${T} — ${city}`,
      briefing:
        `${victimP.name}, demeurant à ${city}, dépose plainte : ${g('il', 'elle')} a acheté le jeton « ${tok.name} » (${T}) après un « call » publié sur le canal Telegram « ${channel} », qui annonçait « le prochain x100 ». En moins d'une heure, le cours s'est effondré de plus de 80 %.\n\n` +
        `Le jeton a été créé sur MoonPad, une plateforme de lancement où le prix suit une courbe automatique avant l'introduction sur PancakeSwap. Le jeton lui-même n'apparaît pas sur le graphe : seuls les BNB sont représentés. Un achat se lit comme un envoi de BNB vers la courbe ou le pool, une vente comme un versement de BNB du pool vers le vendeur.\n\n` +
        `Objectifs : établir si un groupe d'initiés a acheté dès le lancement et revendu en bloc après le call, remonter à la source de leur financement, mesurer leur gain, prouver le lien avec le canal d'appels, suivre l'encaissement des initiés comme celui du canal, et préparer les mesures conservatoires.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tD + 2 * DAY, author: victimP.name,
          body:
            `« Je suis abonné${g('', 'e')} au canal « ${channel} ». Quand le call ${T} est tombé, j'ai acheté tout de suite sur PancakeSwap, puis j'ai renforcé un peu plus tard. Quelques minutes après, le graphique s'est écroulé d'un coup.\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Premier achat (${amt(vBuy1V, 'BNB')}) : ${vBuy1.hash}\n` +
            `Second achat (${amt(vBuy2V, 'BNB')}) : ${vBuy2.hash}\n\n` +
            `J'ai perdu environ ${usd0(usd('BNB', victimLoss))}. »`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Canal « ${channel} » (message du ${fmtDate(tC)})`, author: `@${callerHandle}`, date: tC,
          body:
            `🚨🚨 CALL DU JOUR 🚨🚨\n` +
            `${T} — ${tok.name}\n` +
            `CA : ${tokenCa}\n` +
            `Pool PancakeSwap : ${A(w, pool)}\n` +
            `Vient de quitter MoonPad ✅ Communauté organique ✅ Dev safu ✅\n` +
            `Objectif x100, on ne rate pas celui-là 🚀🚀\n` +
            `(NFA, DYOR)`,
        },
        {
          id: 'capture', type: 'capture', title: `Page MoonPad du jeton ${T} (capture d'un acheteur)`, date: tG - 30 * 60,
          body:
            `${tok.name} (${T}) — Courbe : ${Math.round(r.float(88, 97))} % vers PancakeSwap\n` +
            `Créé par ${A(w, creator)} le ${fmtDate(tL)}\n` +
            `Courbe de prix : ${A(w, curve)}\n` +
            `Détenteurs : ${K + 2 + r.int(8, 12)} · « Dev a vendu : non »`,
        },
        {
          id: 'osint', type: 'osint', title: `Note OSINT sur le canal « ${channel} »`, date: tD + 3 * DAY, author: 'Cellule cyber',
          body:
            `Canal d'environ ${r.int(18, 60)} 000 abonnés, administré par @${callerHandle}. Une grille tarifaire circule en message privé : « call sponsorisé » entre 1,5 et 4 BNB, paiement préalable.\n` +
            `Adresse de paiement indiquée aux annonceurs : ${A(w, callerAddr)}\n` +
            `Les calls ne mentionnent jamais leur caractère sponsorisé.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : lancements et achats groupés', date: tD + 3 * DAY, author: 'Cellule d\'appui',
          body:
            `• Sur une plateforme de lancement, le prix monte mécaniquement avec chaque achat le long de la courbe : acheter dans le tout premier bloc, c'est acheter au prix le plus bas.\n` +
            `• Un « bundle » est un ensemble d'achats soumis ensemble, souvent dans le bloc du lancement, depuis des portefeuilles neufs. Leur financement commun et récent est la signature d'un même opérateur.\n` +
            `• Les robots de sniping indépendants achètent aussi très tôt ; ils se distinguent par leur historique (autres lancements, financement ancien et distinct).\n` +
            `• BNB Smart Chain produit un bloc toutes les 3 secondes environ.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse a financé les portefeuilles des initiés ?',
          answer: [source],
          hint: 'Partez du créateur affiché sur la page MoonPad : remontez son premier financement, puis regardez qui d\'autre cette adresse a financé juste avant le lancement.',
          explanation: `${A(w, source)}, alimentée par ${fund.entity.name}, envoie des BNB à ${K} portefeuilles neufs en quelques minutes, ${Math.round((tL - tF) / 60)} minutes environ avant la création du jeton. C'est la source commune des achats groupés. ${procedureFor(fund.entity)}`,
        },
        {
          id: 'o2', type: 'addresses', points: 12,
          prompt: 'Quels portefeuilles composent le groupe d\'initiés ?',
          answer: insiders,
          hint: 'Ce sont les portefeuilles financés par la source commune : tous achètent sur la courbe dans le même bloc, juste après la création.',
          explanation: `Les ${K} portefeuilles (dont le créateur ${A(w, creator)}) achètent pour ${amt(bnb(buySum), 'BNB')} dans le bloc ${launchBlock.toLocaleString('fr-FR')}, trois secondes après la création. Les deux autres acheteurs très précoces sont des robots indépendants : financés par des exchanges des semaines plus tôt, ils revendent bien avant le call et ne renvoient rien au groupe.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Sur quel DEX les initiés ont-ils revendu leurs jetons ?',
          answer: ['pancakeswap'],
          hint: 'Les ventes interviennent après la migration de la liquidité : elles versent des BNB depuis le pool où achètent les abonnés du canal.',
          explanation: `Après la migration du ${fmtDate(tG)}, la liquidité est sur le pool PancakeSwap ${A(w, pool)}. Les ${K} ventes s'enchaînent à partir du ${fmtDate(tD)}, quelques dizaines de minutes après le call, et retirent ${amt(bnb(sells.reduce((s, v) => s + v, 0)), 'BNB')} du pool. PancakeSwap n'est que le lieu d'exécution : un protocole sans compte ni KYC.`,
        },
        {
          id: 'o9', type: 'number', points: 10, tolerance: 2, unit: 'minutes',
          prompt: 'Combien de minutes séparent la publication du call de la première revente des initiés ?',
          answer: callToDump,
          hint: 'L\'heure du call figure sur le message Telegram ; la première revente est la plus ancienne des transactions où le pool PancakeSwap verse des BNB à l\'un des portefeuilles du groupe.',
          explanation: `Call publié le ${fmtDate(tC)} ; première revente des initiés le ${fmtDate(dumpTxs[0].time)}, soit environ ${callToDump} minutes plus tard, et les ${K} ventes s'enchaînent en quelques minutes. Ce délai court est typique : le call déclenche l'afflux d'acheteurs, les initiés vendent au sommet dans la foulée. Rapprochée du paiement du canal la veille, cette chronologie est l'un des éléments les plus parlants du dossier.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Sur quelle adresse les initiés regroupent-ils le produit de leurs ventes ?',
          answer: [hub],
          hint: 'Après la revente, suivez la sortie de BNB de plusieurs portefeuilles du groupe : ils se vident tous vers la même adresse.',
          explanation: `Entre une et trois heures après le dump, les ${K} portefeuilles envoient tout leur solde à ${A(w, hub)} (${amt(hubIn, 'BNB')} au total). Ce regroupement confirme l'unité de contrôle : des acheteurs indépendants n'auraient aucune raison de reverser leurs gains au même endroit. C'est de cette adresse que partent la conversion en USDT et les dépôts.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BNB', tolerance: 0.03,
          prompt: 'Quel gain net (en BNB) les initiés ont-ils réalisé ?',
          answer: profit,
          hint: 'Comparez ce que la source a versé aux initiés avec ce que les initiés ont reversé, après leurs ventes, à leur adresse de regroupement.',
          explanation: `Les initiés reçoivent ${amt(fundedTotal, 'BNB')} de la source, achètent pour ${amt(bnb(buySum), 'BNB')}, revendent pour ${amt(bnb(sells.reduce((s, v) => s + v, 0)), 'BNB')}, puis reversent ${amt(hubIn, 'BNB')} à ${A(w, hub)}. Gain net : ${amt(profit, 'BNB')} (≈ ${usd0(usd('BNB', profit))}), sans compter les ${amt(callFee, 'BNB')} payés au canal.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Sur quel exchange les gains ont-ils été encaissés ?',
          answer: [destKey],
          hint: 'Suivez l\'adresse de regroupement : conversion en USDT, puis dépôts.',
          explanation: `L'adresse de regroupement échange ${amt(swapIn, 'BNB')} contre ${amt(sw.amountOut, 'USDT')} sur PancakeSwap, puis dépose en deux fois sur ${A(w, dep)}, adresse de dépôt de ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o10', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT a été déposé sur l\'exchange d\'encaissement ?',
          answer: deposited,
          hint: 'Après le swap BNB → USDT, l\'adresse de regroupement dépose en deux fois sur la même adresse de dépôt : additionnez les deux.',
          explanation: `${amt(d1.tx.transfers[0].value, 'USDT')} le ${fmtDate(d1.tx.time)} puis ${amt(d2.tx.transfers[0].value, 'USDT')} le ${fmtDate(d2.tx.time)}, soit ${amt(deposited, 'USDT')} sur ${A(w, dep)}. C'est le montant à mentionner dans la demande de gel adressée à ${destName}, avec les deux hash de dépôt ; le reste des BNB (${amt(bnb(hubIn - swapIn), 'BNB')}) est resté sur l'adresse de regroupement.`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction prouve la rémunération du canal d\'appels par le groupe d\'initiés ?',
          answer: [callPay.id],
          hint: 'L\'adresse de paiement du canal reçoit de nombreux annonceurs : un seul paiement vient de la source commune.',
          explanation: `Le ${fmtDate(callPay.time)}, la source commune verse ${amt(callFee, 'BNB')} à l'adresse de paiement du canal, la veille du call. Les autres paiements reçus par cette adresse viennent d'annonceurs sans lien avec ${T}. Le call n'était donc pas une recommandation spontanée mais une promotion payée par ceux qui allaient revendre.`,
        },
        {
          id: 'o11', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme l\'administrateur du canal encaisse-t-il les paiements de ses annonceurs ?',
          answer: [callerKey],
          hint: 'Suivez la sortie de l\'adresse de paiement du canal citée dans la note OSINT, quelques jours après les faits.',
          explanation: `Le ${fmtDate(callerCash.tx.time)}, l'adresse de paiement du canal envoie ${amt(callerCash.tx.transfers[0].value, 'BNB')}, soit l'essentiel des ${promoCount} paiements reçus, à ${A(w, callerCash.deposit)}, adresse de dépôt ${callerKit.entity.name}. Le compte client permettra d'identifier @${callerHandle}, dont la responsabilité (promotion payée non signalée comme telle, connaissance ou non du projet de revente) reste à apprécier. ${procedureFor(callerKit.entity)}`,
        },
        {
          id: 'o12', type: 'choice', points: 10,
          prompt: 'Quelle mesure conservatoire est la plus urgente pour préserver le produit de la manipulation ?',
          hint: 'Où se trouvent les fonds au moment où vous agissez, et qui peut les bloquer ?',
          ...choice(r,
            `Requérir ${destName} pour bloquer le compte crédité, en citant l'adresse de dépôt et les hash des deux dépôts`,
            [
              'Demander à PancakeSwap de geler le pool et d\'annuler les ventes des initiés',
              'Demander à MoonPad de retirer le jeton, ce qui restituera automatiquement les BNB aux acheteurs',
              'Demander à l\'émetteur de l\'USDT de geler l\'adresse de dépôt de l\'exchange',
            ]),
          explanation: `Les USDT sont désormais sous la garde de ${destName} : seule la plateforme peut bloquer le compte client avant un retrait. PancakeSwap et la courbe MoonPad sont des contrats sans opérateur capable d'annuler une transaction ; retirer un jeton de l'interface ne rembourse personne. Geler l'adresse de dépôt chez l'émetteur toucherait l'exchange et ses autres clients, sans viser le titulaire du compte : la bonne cible est le compte, via la plateforme.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Quels éléments établissent la coordination entre les initiés ?',
          ...choice(r,
            'Financement commun juste avant le lancement, achats dans un même bloc, revente groupée après le call, gains regroupés',
            [
              'Le simple fait d\'avoir acheté tôt et revendu avec profit, qui suffit à rattacher chaque acheteur précoce à la manipulation',
              'La chute du cours après le call, qui démontre à elle seule que l\'administrateur du canal a organisé toute l\'opération',
              'Le recours à MoonPad, plateforme de lancement réservée aux projets frauduleux, qui suffit à caractériser l\'entente',
            ]),
          explanation: `Chaque indice pris seul est fragile ; c'est leur convergence qui fait la preuve : même source (${A(w, source).slice(0, 10)}…), même bloc d'achat, ventes dans la même fenêtre, gains regroupés sur une seule adresse, et paiement du canal par la même source. Les robots qui ont aussi acheté tôt ne présentent aucun de ces liens. Selon que le jeton est ou non admis sur une plateforme régulée, les faits peuvent relever de la manipulation de marché prévue par le règlement MiCA ou de qualifications de droit commun (escroquerie, pratiques commerciales trompeuses) ; la qualification revient au parquet.`,
        },
      ],
      truth: {
        path: [vFund.id, vBuy1.id, vBuy2.id, fundTx.id, callPay.id, ...fundTxs.map((t) => t.id), createTx.id, ...bundle.map((t) => t.id), migTx.id, ...dumpTxs.map((t) => t.id), ...hubTxs.map((t) => t.id), sw.tx.id, d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : []), callerCash.tx.id],
        addresses: [pool, source, ...insiders, callerAddr, hub, dep, curve, callerCash.deposit],
        debrief:
          `1. ${fund.entity.name} alimente la source ${A(w, source)} (${amt(srcTotal, 'BNB')}). La veille du lancement, elle paie ${amt(callFee, 'BNB')} au canal « ${channel} ».\n` +
          `2. Une à trois heures avant le lancement, elle finance ${K} portefeuilles neufs (${amt(fundedTotal, 'BNB')}).\n` +
          `3. Le ${fmtDate(tL)}, l'un d'eux crée ${T} sur MoonPad ; trois secondes plus tard, les ${K} portefeuilles achètent ensemble sur la courbe (${amt(bnb(buySum), 'BNB')}), au prix le plus bas. ${bots.length} robots indépendants achètent aussi tôt.\n` +
          `4. Des acheteurs organiques font progresser la courbe jusqu'à la migration vers PancakeSwap (${amt(migV, 'BNB')}).\n` +
          `5. Le call est publié le ${fmtDate(tC)} ; ${nPub + 1} acheteurs, dont ${victimP.name} (${amt(victimLoss, 'BNB')}), se ruent sur le pool. À partir du ${fmtDate(tD)}, les initiés revendent tout en quelques minutes.\n` +
          `6. Les gains sont regroupés sur ${A(w, hub)} (${amt(hubIn, 'BNB')}, gain net ${amt(profit, 'BNB')}), convertis en ${amt(sw.amountOut, 'USDT')} et déposés sur ${destName}.\n` +
          `7. Quelques jours plus tard, l'administrateur du canal transfère ses recettes publicitaires (${amt(callerCash.tx.transfers[0].value, 'BNB')}) vers son compte ${callerKit.entity.name}.\n\n` +
          `À retenir : dans un pump and dump, la blockchain conserve la chronologie complète. Le financement commun révèle le groupe, le bloc de lancement révèle l'avantage pris, la fenêtre de vente révèle la concertation, et le paiement du canal relie la promotion aux vendeurs. Trois réquisitions s'imposent : ${fund.entity.name} pour l'origine des fonds de la source, ${destName} pour le compte qui a encaissé (avec demande de gel), ${callerKit.entity.name} pour identifier l'administrateur du canal.`,
      },
      hints: [
        'Depuis l\'achat de la victime, ouvrez le pool : sa première transaction est la migration depuis la courbe MoonPad, dont l\'historique montre les tout premiers achats.',
        'Les achats du bloc de lancement viennent de portefeuilles neufs : remontez le financement de chacun.',
        'Le gain net se calcule entre deux adresses : ce que la source a versé aux initiés et ce que les initiés ont reversé ensuite.',
        'L\'adresse de paiement du canal figure dans la note OSINT : cherchez parmi ses entrées celle qui vient de la source, puis regardez où elle envoie ses recettes.',
        'Pour la chronologie, rapprochez l\'heure du message Telegram des transactions de vente des initiés sur le pool.',
      ],
    }
  },
}
