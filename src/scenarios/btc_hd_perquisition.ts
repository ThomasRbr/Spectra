import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { createHdWallet, scanHdWallet } from '../engine/hd'
import { priorHistory, dusting } from '../engine/realism'
import type { Entity } from '../engine/entities'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, forwardAll } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const BRANDS = ['Livret Crypto Plus', 'Épargne Satoshi', 'Horizon Rendement BTC', 'Patrimoine Numérique Conseil', 'Bitcoin Garanti 12 %']
const INITIALS = ['M. B.', 'C. L.', 'J.-P. R.', 'A. D.', 'S. M.', 'F. G.', 'N. T.', 'H. V.', 'R. K.', 'E. P.', 'L. Z.', 'O. C.']
// Clients « grands comptes » : initiales distinctes de celles des épargnants
const INITIALS_BIG = ['G. W.', 'T. Q.', 'P.-A. J.', 'Y. F.', 'B. H.', 'X. D.']
const LAWYERS: [string, boolean][] = [['Me Hélène VASSEUR', true], ['Me Karim BELKACEM', false], ['Me Anne-Sophie LORIOT', true], ['Me Damien FERRAND', false]]
/** Initiales d'un nom « Prénom NOM ». */
const ini = (name: string) => name.split(' ').slice(0, 2).map((x) => `${x[0]}.`).join(' ')
/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))

/** Montant BTC lisible (pas de zéros inutiles). */
const btc = (v: number) => amt(r8(v), 'BTC')
/** Adresse tronquée telle qu'une interface l'affiche (non cliquable). */
const trunc = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`
const usdFr = (v: number) => `${Math.round(usd('BTC', v)).toLocaleString('fr-FR')} $`

/**
 * Dépenses courantes depuis une adresse UTXO, dans l'ordre chronologique (la
 * brique `personalSpending` tire ses dates sans les trier : sur UTXO, une
 * dépense antérieure à la précédente ne voit pas le rendu et déclenche un
 * financement externe). Rendu renvoyé sur l'adresse ; aucune dépense n'est
 * financée de l'extérieur (on saute celles qui dépasseraient le solde).
 */
function spendSeries(w: World, addr: string, o: { start: number; end: number; n: number; merchants: (string | Entity)[]; maxUsd: number }): Tx[] {
  const shops = o.merchants.map((m) => (typeof m === 'string' ? w.entity(m) : m))
  const times = Array.from({ length: o.n }, () => Math.round(w.rng.float(o.start, o.end))).sort((a, b) => a - b)
  const txs: Tx[] = []
  for (const t of times) {
    const shop = w.rng.chance(0.75) ? w.rng.pick(shops) : undefined
    const v = roundAsset('BTC', fromUsd('BTC', w.rng.float(15, o.maxUsd)))
    if (w.unspentValue(addr, t) < v * 1.2 + 0.0003) continue
    const dst = w.addr('btc', { entity: shop, label: shop ? `${shop.name} — Paiement` : undefined })
    txs.push(w.utxoTx({ time: t, from: [addr], to: [{ address: dst, value: v }], change: addr, autoFund: false }))
  }
  return txs
}

export const btcHdPerquisition: ScenarioTemplate = {
  id: 'hd-perquisition',
  title: 'Perquisition : la zpub du tiroir',
  tagline: 'Une clé publique étendue griffonnée sur un carnet : tout le portefeuille, épargne personnelle et coffre caché compris.',
  description:
    'Lors de la perquisition chez l\'animateur présumé d\'un faux livret d\'épargne en bitcoins, les enquêteurs saisissent un portefeuille matériel, sa phrase de récupération, un carnet portant une clé publique étendue (zpub) et un téléphone équipé d\'une application de suivi en lecture seule. Dérivez le portefeuille, séparez l\'épargne personnelle du produit de l\'escroquerie, retrouvez la rémunération du démarcheur, démêlez l\'éclatement de dernière minute et chiffrez ce que la graine permet encore de saisir… sans vous fier au solde qu\'affiche l\'application.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['utxo', 'cioh', 'change', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 75,
  lessons: ['portefeuilles-hd', 'forensique-supports', 'gel-saisie', 'saisie-avancee', 'requisitions', 'cles-portefeuilles'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const first = sp.name.split(' ')[0]
    const brand = r.pick(BRANDS)
    const complainant = fakePerson(r)
    const opj = fakePerson(r)
    const [lawyer, lawyerF] = r.pick(LAWYERS)
    const mec = ge('le mis en cause', 'la mise en cause')
    /** Même jour (heure de Paris), entre `hMin` et `hMax` heures. */
    const atHour = (ts: number, hMin: number, hMax: number) => ts - parisHour(ts) * HOUR - (ts % HOUR) + Math.round(r.float(hMin, hMax) * HOUR)
    const advisorAlias = r.pick(['Kévin conseil', 'Max patrimoine', 'Yanis gestion', 'Dylan conseiller', 'Steve placements'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const keys = r.shuffle(['kraken', 'bitstamp', 'binance', 'coinbase', 'okx'] as const)
    const exA = exchange(w, keys[0], 'btc')
    const exB = exchange(w, keys[1], 'btc')
    const exC = exchange(w, keys[2], 'btc')
    const ramp = exchange(w, keys[3], 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    // Commerçants propres au dossier (fictifs)
    const giftShop = w.customEntity({ name: 'Cadeo Cartes', category: 'merchant', known: true, description: 'Revendeur en ligne (fictif) de cartes cadeaux et de recharges prépayées payables en bitcoin ; le code est livré par courriel.' })
    const casino = w.customEntity({ name: 'Casino Lune Rousse', category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant le bitcoin, sans vérification d\'identité sous un certain seuil de retrait.' })
    const betting = w.customEntity({ name: 'PariFoot Turbo (paris sportifs)', category: 'gambling', known: true, description: 'Site de paris sportifs en ligne (fictif, hors agrément ANJ) acceptant le bitcoin.' })
    const topup = w.customEntity({ name: 'Recharge Mobile Express', category: 'merchant', known: true, description: 'Service en ligne (fictif) de recharge de crédit pour lignes mobiles prépayées, payable en bitcoin ; le numéro rechargé figure dans la commande.' })
    const suspect = w.customEntity({ name: `${sp.name} (${mec})`, category: 'suspect' })
    const victimE = w.customEntity({ name: complainant.name, category: 'victim' })
    const advisorE = w.customEntity({ name: `« ${advisorAlias} » (démarcheur téléphonique, non identifié)`, category: 'suspect' })
    const shopE = w.customEntity({ name: 'Matériel Photo Express', category: 'merchant', known: true, description: 'Commerçant en ligne (fictif) acceptant le bitcoin via un processeur de paiement.' })
    const hd = createHdWallet(w, { chain: 'btc', kind: 'p2wpkh', entity: suspect, label: 'Portefeuille matériel (scellé n° 1)' })

    const t0 = w.at(0)

    // ── 1. Épargne personnelle (antérieure aux faits) : index 0 et 1 ─────────
    // Achats programmés sur Coinhouse retirés vers une adresse fixe, quelques
    // dépenses personnelles (rendu renvoyé sur l'adresse d'envoi).
    const S0 = hd.receive(0)
    const S1 = hd.receive(1)
    const savStart = w.at(-24 * r.int(380, 520))
    const savEnd = w.at(-24 * r.int(18, 40))
    // Achats programmés mensuels, retirés à intervalle régulier (quelques jours de jeu)
    const nDca = r.int(8, 10)
    const dcaStep = (savEnd - savStart) / (nDca - 1)
    const dcaUsd = r.pick([150, 200, 250, 300])
    const dcaTxs = Array.from({ length: nDca }, (_, k) => {
      const t = Math.round(savStart + k * dcaStep + (k > 0 && k < nDca - 1 ? r.float(-3, 3) * DAY : 0))
      return cv.withdraw(S0, roundAsset('BTC', fromUsd('BTC', dcaUsd * (dcaStep / (30 * DAY)) * r.float(0.85, 1.15))), t)
    })
    const dcaWeeks = Math.round(dcaStep / (7 * DAY))
    const s1In = cv.withdraw(S1, roundCoin(w, 0.012, 0.035, 0.001), Math.round(r.float(savStart + 60 * DAY, savEnd - 20 * DAY)))
    const persoShops = [w.entity('mullvad'), shopE]
    const persoSpends: Tx[] = []
    const persoTimes = Array.from({ length: r.int(3, 5) }, () => Math.round(r.float(savStart + 90 * DAY, savEnd + 10 * DAY))).sort((a, b) => a - b)
    for (let i = 0; i < persoTimes.length; i++) {
      const t = persoTimes[i]
      const v = roundAsset('BTC', fromUsd('BTC', r.float(18, 140)))
      if (w.unspentValue(S0, t) < v * 1.3 + 0.0002) continue
      const shop = i % 3 === 2 ? undefined : persoShops[i % 2]
      const dst = w.addr('btc', { entity: shop, label: shop ? `${shop.name} — Paiement` : undefined })
      persoSpends.push(w.utxoTx({ time: t, from: [S0], to: [{ address: dst, value: v }], change: S0, autoFund: false }))
    }

    // ── 2. Adresse de collecte (index 2), réutilisée ─────────────────────────
    const K = hd.receive(2)

    // ── 3. Versements des épargnants : une adresse de réception neuve par client ──
    const nV = r.int(8, 11)
    const named = r.int(1, 3)
    const pays: { tx: Tx; addr: string; idx: number; value: number; time: number; initials: string; from: string }[] = []
    let idx = 3
    let t = t0
    // Le plaignant garde ses propres initiales ; les autres épargnants n'en partagent aucune
    const initials = r.shuffle(INITIALS.filter((x) => x !== ini(complainant.name)))
    initials.splice(named, 0, ini(complainant.name))
    for (let i = 0; i < nV; i++) {
      const a = hd.receive(idx)
      const value = roundCoin(w, 0.05, 0.34, 0.001)
      const va = i === named ? w.addr('btc', { entity: victimE, kind: 'p2wpkh' }) : w.addr('btc')
      // L'épargnant achète ses bitcoins sur une application, puis les envoie (en journée ou en soirée)
      const tPay = atHour(t, 8, 22.5)
      ;(r.chance(0.5) ? cv : ramp).withdraw(va, roundAsset('BTC', value + r.float(0.0004, 0.004)), tPay - Math.round(r.float(1, 30) * HOUR))
      const tx = w.utxoTx({ time: tPay, from: [va], to: [{ address: a, value }], change: va })
      pays.push({ tx, addr: a, idx, value, time: tPay, initials: initials[i % initials.length], from: va })
      // Adresse remise à un prospect qui n'a finalement rien versé : index sauté
      idx += r.chance(0.3) ? 2 : 1
      t += Math.round(r.float(1.5, 5) * DAY)
    }
    const lastIdx = pays[pays.length - 1].idx
    const victimPay = pays[named]
    const totalVictims = r8(pays.reduce((s, p) => s + p.value, 0))

    // ── 4. Regroupements sur la collecte, puis dépenses depuis la collecte ───
    const consolidations: Tx[] = []
    const consolidate = (time: number) => {
      const from = pays.filter((p) => p.time < time && w.unspentValue(p.addr, time) > 0).map((p) => p.addr)
      const total = from.reduce((s, a) => s + w.unspentValue(a, time), 0)
      const fee = w.estimateFee('btc', from.length, 1)
      const tx = w.utxoTx({ time, from, to: [{ address: K, value: r8(total - fee) }], fee, change: null, spendAll: true, method: 'consolidation' })
      consolidations.push(tx)
      return tx
    }
    const fromK = (time: number, to: string, value: number) =>
      w.utxoTx({ time, from: [K], to: [{ address: to, value }], change: K, autoFund: false })
    const deposits: { ex: ExchangeKit; addr: string; tx: Tx; value: number; sweep: Tx }[] = []
    const deposit = (ex: ExchangeKit, time: number, frac: number) => {
      const addr = ex.newDeposit()
      const value = Math.floor(w.unspentValue(K, time) * frac * 1000) / 1000
      const tx = fromK(time, addr, value)
      const sweep = ex.sweep([addr], time + Math.round(r.float(1, 8) * HOUR))[0]
      deposits.push({ ex, addr, tx, value, sweep })
    }
    const advisor = w.addr('btc', { entity: advisorE, kind: 'p2wpkh' })
    const commissions: { tx: Tx; value: number }[] = []
    const commission = (time: number) => {
      const value = Math.min(roundCoin(w, 0.012, 0.03, 0.0005), Math.floor(w.unspentValue(K, time) * 0.25 * 1e4) / 1e4)
      commissions.push({ tx: fromK(time, advisor, value), value })
    }

    const c1 = consolidate(pays[Math.floor(nV * 0.35)].time + Math.round(r.float(6, 30) * HOUR))
    deposit(exA, c1.time + Math.round(r.float(6, 20) * HOUR), r.float(0.32, 0.42))
    const invoice = w.addr('btc', { entity: giftShop, label: `${giftShop.name} — Facture`, tags: ['invoice'] })
    const cardValue = roundCoin(w, 0.004, 0.012, 0.0001)
    const cardTx = fromK(c1.time + Math.round(r.float(1.2, 2.5) * DAY), invoice, cardValue)
    const c2 = consolidate(pays[Math.floor(nV * 0.7)].time + Math.round(r.float(6, 30) * HOUR))
    commission(c2.time + Math.round(r.float(5, 20) * HOUR))
    deposit(exB, c2.time + Math.round(r.float(1.2, 2.2) * DAY), r.float(0.28, 0.38))
    const c3 = consolidate(pays[nV - 1].time + Math.round(r.float(6, 30) * HOUR))
    commission(c3.time + Math.round(r.float(4, 16) * HOUR))
    const commTotal = r8(commissions.reduce((s, c) => s + c.value, 0))

    // ── 5. Mise en demeure, puis éclatement en quatre branches ───────────────
    // Courriel du cabinet envoyé en journée, ouvert peu après
    const tMail = atHour(c3.time + Math.round(r.float(1.5, 3) * DAY), 9, 18)
    const tOpen = tMail + Math.round(r.float(0.2, 1) * HOUR)
    const tSplit = tMail + Math.round(r.float(10, 30) * HOUR)
    const MOBILE = 'wallet:mobile-inconnu'
    const D = [0, 1, 2, 3].map(() => w.addr('btc', { entity: suspect, kind: 'p2wpkh', wallet: MOBILE }))
    const keep = roundCoin(w, 0.004, 0.012, 0.0005)
    const splitFee = w.estimateFee('btc', w.utxosOf(K, tSplit).length, 5)
    const X = Math.floor(((w.unspentValue(K, tSplit) - keep - splitFee) / 4) * 1e4) / 1e4
    const split = w.utxoTx({ time: tSplit, from: [K], to: D.map((d) => ({ address: d, value: X })), change: K, fee: splitFee, autoFund: false })
    const [D1, D2, D3, D4] = D

    // Branche 1 : retour dans le portefeuille matériel, sur une adresse générée
    // par le logiciel d'encaissement, au-delà de la limite d'écart (le « coffre »).
    const hIdx = lastIdx + r.int(24, 34)
    const h2Idx = hIdx + r.int(2, 4)
    const cIdx = h2Idx + r.int(1, 3)
    const coffre = hd.receive(cIdx)
    const E2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh', wallet: MOBILE })
    const E4 = w.addr('btc', { entity: suspect, kind: 'p2wpkh', wallet: MOBILE })
    const tFwd = tSplit + Math.round(r.float(2, 6) * HOUR)
    const offs = r.shuffle([0, Math.round(r.float(8, 20) * 60), Math.round(r.float(25, 50) * 60)])
    const fwd1 = forwardAll(w, D1, coffre, tFwd + offs[0])
    const fwd2 = forwardAll(w, D2, E2, tFwd + offs[1])
    const fwd4 = forwardAll(w, D4, E4, tFwd + offs[2])
    const twins = [fwd1, fwd2, fwd4].sort((a, b) => a.time - b.time)
    const coffreValue = fwd1.outputs[0].value
    // Perquisition à l'heure légale du matin (6 h–21 h), quelques jours après l'éclatement
    const tPerq = atHour(tFwd + r.int(5, 12) * DAY, 6, 7.5)
    // Branche 4 : ré-éclatée en petits montants vers des adresses inconnues
    const subs = Array.from({ length: r.int(3, 4) }, () => w.addr('btc'))
    const e4Total = fwd4.outputs[0].value
    const subFee = w.estimateFee('btc', 1, subs.length)
    const parts = r.split(e4Total - subFee, subs.length, 0.6).map((p) => Math.floor(p * 1e8) / 1e8)
    w.utxoTx({ time: tFwd + Math.round(r.float(1, 3) * DAY), from: [E4], to: subs.map((s, i) => ({ address: s, value: parts[i] })), change: null, autoFund: false })
    // Branche 3 : porte-monnaie de dépenses courantes (casino, cartes cadeaux…), jusqu'à la veille de la perquisition
    const d3 = { txs: spendSeries(w, D3, { start: tFwd + 4 * HOUR, end: tPerq - 10 * HOUR, n: r.int(8, 10), merchants: [casino, giftShop, casino, w.entity('mullvad')], maxUsd: Math.min(900, usd('BTC', X) * 0.07) }) }
    const d3Spent = r8(d3.txs.reduce((s, x) => s + x.outputs.filter((o) => o.address !== D3).reduce((a, o) => a + o.value, 0), 0))
    // Poussière reçue autour de l'éclatement sur l'adresse de collecte, réutilisée et donc repérée (jamais dépensée)
    dusting(w, K, { time: tSplit - Math.round(r.float(6, 20) * HOUR), n: r.int(3, 4), spreadH: 26 })

    // ── 6. Factures « grands comptes » du logiciel d'encaissement ────────────
    const bigValue = Math.max(0.02, Math.min(roundCoin(w, 0.08, 0.3, 0.01), Math.floor(coffreValue * 0.8 * 100) / 100))
    const smallValue = roundCoin(w, 0.004, 0.02, 0.0001)
    const tBig = pays[Math.floor(nV * 0.6)].time + Math.round(r.float(6, 40) * HOUR)
    const hBig = hd.receive(hIdx)
    const hSmall = hd.receive(h2Idx)
    const bigTx = w.fund(hBig, bigValue, tBig, { senders: 1 })
    const smallTx = w.fund(hSmall, smallValue, tBig + Math.round(r.float(2, 9) * DAY), { senders: 1 })

    // ── 7. Le démarcheur : une adresse qui a sa propre vie ───────────────────
    priorHistory(w, advisor, { start: w.at(-24 * r.int(150, 260)), end: t0 - 2 * DAY, nIn: r.int(4, 6), nOut: r.int(2, 3), maxUsd: 1800 })
    const advSpends = spendSeries(w, advisor, { start: commissions[0].tx.time + 6 * HOUR, end: tPerq - 6 * HOUR, n: r.int(3, 5), merchants: [betting, topup, betting], maxUsd: 500 })
    /** Bénéficiaires des paiements (hors rendu) : commerçants nommés, puis particuliers. */
    const payees = (txs: Tx[], from: string) => {
      const ids = new Set<string>()
      let people = 0
      for (const x of txs) for (const o of x.outputs) {
        if (o.address === from) continue
        const e = w.get(o.address).entityId
        if (e) ids.add(e)
        else people++
      }
      return { ids, people }
    }
    const shopsOf = (txs: Tx[], from: string) => {
      const { ids, people } = payees(txs, from)
      return [...[...ids].map((e) => w.entities.get(e)!.name), ...(people ? [people > 1 ? `${people} paiements à des particuliers` : 'un paiement à un particulier'] : [])].join(', ')
    }
    const advDep = exC.receive(advisor, roundCoin(w, 0.008, 0.02, 0.0005), commissions[1].tx.time + Math.round(r.float(1, 4) * DAY))

    // ── Bruit ──
    const tEnd = tPerq + 2 * DAY
    exA.noise(12, w.at(-10 * 24), tEnd)
    exB.noise(10, w.at(-10 * 24), tEnd)
    exC.noise(8, w.at(-10 * 24), tEnd)
    cv.noise(8, savStart, tEnd)
    ramp.noise(8, w.at(-10 * 24), tEnd)

    // ── Vérité : portefeuille complet vs vue de l'application (gap 20) ──
    const used = hd.used()
    const usedReceive = used.filter((id) => w.get(id).hd!.path.split('/')[4] === '0')
    const usedChange = used.length - usedReceive.length
    const total = r8(used.reduce((s, id) => s + w.unspentValue(id), 0))
    const appScan = scanHdWallet(w, hd.xpub, { gap: 20 })!
    const appUsed = [...appScan.receive, ...appScan.change].filter((x) => x.used)
    const appTotal = r8(appUsed.reduce((s, x) => s + w.unspentValue(x.id), 0))
    const savings = r8(w.unspentValue(S0) + w.unspentValue(S1))
    const kLeft = r8(w.unspentValue(K))
    const s0Ins = w.txsOf(S0).filter((x) => x.outputs.some((o) => o.address === S0) && !x.inputs.some((i) => i.address === S0)).length
    const richest = [...used].sort((a, b) => w.unspentValue(b) - w.unspentValue(a))[0]
    const outside = r8(fwd2.outputs[0].value + e4Total)

    const byEx = new Map<string, number>()
    for (const d of deposits) byEx.set(d.ex.entity.id, (byEx.get(d.ex.entity.id) ?? 0) + d.value)
    const pvNum = `${r.int(10, 99)}/${String(r.int(1, 9999)).padStart(5, '0')}`
    const nInvoices = h2Idx - lastIdx + r.int(2, 6)
    const shownReq = r.shuffle([...pays]).slice(0, 4).sort((a, b) => a.idx - b.idx)
    // Plus petite limite d'écart qui fait apparaître toutes les adresses utilisées
    const minGap = hIdx - lastIdx
    const hm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    const twinLine = twins.map((x) => `${hm(x.time)} : ${btc(x.outputs[0].value)} vers ${A(w, x.outputs[0].address).slice(0, 14)}…`).join(' ; ')
    const [bigIni, smallIni] = r.shuffle(INITIALS_BIG.filter((x) => x !== ini(complainant.name)))
    // Plainte déposée après la mise en demeure (les épargnants ont pris un avocat), avant la perquisition
    const tPlainte = atHour(tMail + Math.round(r.float(1.5, Math.max(1.6, (tPerq - tMail) / DAY - 1.5)) * DAY), 9, 17)
    // Exploitation des scellés et réquisition urgente pendant la garde à vue
    const tExtract = atHour(tPerq + 3 * HOUR, 15, 19)
    const tEnc = atHour(tPerq + DAY, 9, 12)
    const tCoin = atHour(tPerq + DAY, 13, 18)
    const nSkipped = lastIdx - 3 + 1 - nV
    const perso = persoSpends.length ? shopsOf(persoSpends, S0) : ''
    const d3P = payees(d3.txs, D3)
    const d3Leads = [
      ...(d3P.ids.has(giftShop.id) ? [`${giftShop.name}, qui livre ses cartes cadeaux par courriel, connaît au moins une adresse électronique de l'acheteur (le même revendeur a déjà été payé depuis l'adresse de collecte)`] : []),
      ...(d3P.ids.has(casino.id) ? [`${casino.name}, casino sans vérification d'identité sous un seuil de retrait, est moins prometteur`] : []),
    ]
    const d3Lead = d3Leads.length ? `C'est une impasse pour le traçage des fonds, mais une piste secondaire : ${d3Leads.join(' ; ')}.` : `C'est une impasse pour le traçage des fonds : seuls des particuliers non identifiés sont payés.`
    const d3Days = d3.txs.length ? Math.max(1, Math.round((d3.txs[d3.txs.length - 1].time - split.time) / DAY)) : 0
    const advP = payees(advSpends, advisor)
    const advLife = [
      ...(advSpends.length ? [`dépenses : ${shopsOf(advSpends, advisor)}`] : []),
      `dépôt chez ${exC.entity.name}`,
    ].join(' ; ')
    const topupLead = advP.ids.has(topup.id) ? ` Ses paiements à ${topup.name} sont une seconde piste : le service connaît le numéro de ligne prépayée rechargé, à rapprocher du numéro de « ${advisorAlias} ».` : ''

    return {
      world: w,
      title: `Faux livret « ${brand} » — ${city}`,
      briefing:
        `Depuis plusieurs mois, le site « ${brand} » promet un rendement garanti sur un « livret » en bitcoins. Les épargnants versent des bitcoins sur une adresse que leur « conseiller » leur communique par courriel, une adresse différente pour chaque client. Aucun intérêt n'a jamais été versé ; ${pays.length} versements ont été recensés à partir des plaintes et des premières constatations.\n\n` +
        `${sp.name}, ${ge('identifié comme l\'animateur présumé', 'identifiée comme l\'animatrice présumée')}, a été ${ge('interpellé', 'interpellée')} à son domicile ${de(city)}. La perquisition a permis de saisir un portefeuille matériel, une feuille de récupération, un carnet, un téléphone et un ordinateur. Le carnet porte une clé publique étendue (zpub) ; le téléphone contient une application de suivi en lecture seule. ${ge('Il', 'Elle')} soutient que le boîtier ne contient que son épargne personnelle.\n\n` +
        `Le magistrat souhaite savoir, avant la fin de la garde à vue, ce que détient réellement ce portefeuille et ce qui relève de l'escroquerie, où sont partis les fonds déjà sortis, qui d'autre a été rémunéré, et ce que la phrase de récupération placée sous scellé permet encore de saisir. Utilisez l'outil « Dérivation HD » (cliquez sur la zpub dans les pièces) et confrontez son résultat aux autres pièces.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tPlainte, author: complainant.name,
          body:
            `« J'ai été démarché${complainant.female ? 'e' : ''} par téléphone par un conseiller ${/^[aeiouyàâäéèêëîïôöùûüœh]/i.test(brand) ? 'd\'' : 'de '}« ${brand} » qui m'a promis 12 % par an. Il m'a envoyé par courriel une adresse « personnelle et sécurisée » pour mon livret : ${A(w, victimPay.addr)}. ` +
            `J'ai acheté ${btc(victimPay.value)} sur une application et je les ai envoyés le ${fmtDate(victimPay.time)}. Référence de la transaction : ${victimPay.tx.hash}. Depuis, le site ne répond plus. Avec d'autres épargnants, nous avons pris un avocat. »`,
        },
        {
          id: 'perquisition', type: 'perquisition', title: `Procès-verbal de perquisition (extrait) — PV n° ${pvNum}`, date: tPerq, author: `${opj.name}, officier de police judiciaire`,
          body:
            `Le ${fmtDate(tPerq)}, au domicile ${de(sp.name)} à ${city}, en sa présence constante, assisté${opj.female ? 'e' : ''} de deux enquêteurs de la section de recherches.\n\n` +
            `Découvrons et saisissons :\n` +
            `- scellé n° 1 : un portefeuille matériel (boîtier noir, port USB-C) dans sa boîte d'origine, rangé dans le tiroir du bureau ;\n` +
            `- scellé n° 2 : une carte cartonnée portant 24 mots manuscrits (phrase de récupération). Les mots ne sont pas reproduits au présent procès-verbal ; la carte est placée sous enveloppe scellée, sans photographie ;\n` +
            `- scellé n° 3 : un carnet à spirale ; page 14, une chaîne de caractères manuscrite commençant par « zpub » (voir photographie jointe) ;\n` +
            `- scellé n° 4 : un smartphone, découvert déverrouillé sur la table du salon, aussitôt placé en mode avion puis dans une pochette d'isolement ;\n` +
            `- scellé n° 5 : un ordinateur portable, éteint, découvert dans la chambre.\n\n` +
            `Aucun second téléphone n'est découvert, malgré la présence dans un tiroir de la boîte vide d'un modèle récent. Interrogé${ge('', 'e')} sur la nature du boîtier, ${sp.name} déclare : « C'est mon épargne personnelle, je fais des achats programmés depuis des années, il n'y a presque rien dessus, regardez l'appli. »`,
        },
        {
          id: 'carnet', type: 'capture', title: 'Photographie du scellé n° 3 — carnet, page 14 (description)', date: tPerq, author: 'Section de recherches — technicien en identification criminelle',
          body:
            `Écriture manuscrite au stylo bleu, partiellement raturée en haut de page (« achats 2e trimestre ? »).\n` +
            `Au centre, encadré : « clé publique — NE PAS PERDRE — compte 0 »\n` +
            `${hd.xpub}\n` +
            `En dessous : « appli de suivi = lecture seule. Boîtier = signature. Rendu sur l'adresse d'envoi (option décochée). »`,
        },
        {
          id: 'appli', type: 'extraction', title: 'Extraction du smartphone (scellé n° 4) — application de suivi en lecture seule', date: tExtract, author: 'Section de recherches — cellule d\'appui numérique',
          body:
            `Extraction logique réalisée sur copie de travail, empreinte SHA-256 de l'image consignée au procès-verbal.\n\n` +
            `Application : portefeuille « Épargne » — mode « lecture seule (watch-only) »\n` +
            `Clé importée : ${hd.xpub}\n` +
            `Type : SegWit natif (BIP 84), compte 0\n` +
            `Limite d'écart (gap limit) : 20 (valeur par défaut)\n` +
            `Dernière synchronisation : ${fmtDate(tPerq - Math.round(r.float(2, 10) * HOUR))}\n` +
            `Adresses utilisées affichées : ${appUsed.length}\n` +
            `Solde affiché : ${btc(appTotal)}\n` +
            `Libellés saisis par l'utilisateur : index 0 « DCA », index 1 « épargne 2 », index 2 « collecte ».\n\n` +
            `Aucune clé privée n'est présente dans l'application (signature déléguée au portefeuille matériel).`,
        },
        {
          id: 'sms', type: 'sms', title: `Extraction du smartphone (scellé n° 4) — messagerie, contact « ${advisorAlias} »`, date: tExtract, author: 'Section de recherches — cellule d\'appui numérique',
          body:
            `Conversation avec le contact enregistré « ${advisorAlias} » (numéro prépayé, sans abonné identifié à ce stade). Extraits :\n\n` +
            `[${fmtDate(commissions[0].tx.time - Math.round(r.float(3, 20) * HOUR))}] ${advisorAlias} : « ${pays[Math.floor(nV * 0.4)].initials} et ${pays[Math.floor(nV * 0.55)].initials} ont payé, je t'avais dit qu'ils étaient chauds. Ma part ? »\n` +
            `[${fmtDate(commissions[0].tx.time + Math.round(r.float(10, 50) * 60))}] ${first} : « Envoyé sur ton adresse habituelle, comme convenu. »\n` +
            `[${fmtDate(commissions[1].tx.time - Math.round(r.float(5, 30) * HOUR))}] ${advisorAlias} : « J'ai encore relancé trois prospects. On fait les comptes avant la fin du mois ? Toujours en BTC, pas de virement. »\n` +
            `[${fmtDate(commissions[1].tx.time + Math.round(r.float(10, 50) * 60))}] ${first} : « C'est parti. Efface les messages. »\n` +
            `[${fmtDate(tOpen + Math.round(r.float(0.3, 4) * HOUR))}] ${first} : « ${lawyerF ? 'Une avocate' : 'Un avocat'} m'écrit pour plusieurs clients. Je mets tout à l'abri, ne m'appelle plus sur ce numéro. »\n\n` +
            `Aucune adresse n'apparaît dans la conversation.`,
        },
        {
          id: 'mail', type: 'email', title: 'Extraction du smartphone (scellé n° 4) — courriel reçu', date: tMail, author: `${lawyer}, ${lawyerF ? 'avocate' : 'avocat'} au barreau ${de(city)}`,
          body:
            `Objet : ${brand} — mise en demeure\n\n` +
            `« Madame, Monsieur, j'interviens pour le compte de plusieurs souscripteurs du produit « ${brand} », dont ${complainant.name}. Mes clients vous mettent en demeure de leur restituer, sous huit jours, l'intégralité des sommes versées. À défaut, une plainte avec constitution de partie civile sera déposée et une saisie conservatoire sollicitée. »\n\n` +
            `Courriel ouvert le ${fmtDate(tOpen)}.`,
        },
        {
          id: 'encaissement', type: 'extraction', title: 'Extraction de l\'ordinateur portable (scellé n° 5) — logiciel d\'encaissement (export)', date: tEnc, author: 'Section de recherches — cellule d\'appui numérique',
          body:
            `Logiciel d'encaissement auto-hébergé, configuré avec la même clé publique étendue (une adresse dérivée par facture ou par demande manuelle). Export de l'historique :\n\n` +
            `Factures « grands comptes » générées : ${nInvoices} — payées : 2 — expirées sans paiement : ${nInvoices - 2}\n` +
            `- Facture « ${bigIni} » — ${btc(bigValue)} — payée le ${fmtDate(bigTx.time)} — adresse ${trunc(A(w, hBig))}\n` +
            `- Facture « ${smallIni} » — ${btc(smallValue)} — payée le ${fmtDate(smallTx.time)} — adresse ${trunc(A(w, hSmall))}\n` +
            `- Demande manuelle, libellé « coffre », créée le ${fmtDate(tSplit - Math.round(r.float(1, 4) * HOUR))} — montant non renseigné — adresse ${trunc(A(w, coffre))}\n\n` +
            `Courriels de l'application téléphonique (demandes de paiement envoyées aux clients, extraits) :\n` +
            shownReq.map((p) => `- « ${p.initials} » — ${btc(p.value)} — adresse ${trunc(A(w, p.addr))}`).join('\n'),
        },
        {
          id: 'coinhouse', type: 'rapport', title: 'Réponse de Coinhouse à réquisition urgente (extrait)', date: tCoin, author: 'Coinhouse — service conformité',
          body:
            `${sp.name} est client${ge('', 'e')} depuis le ${fmtDate(savStart - r.int(20, 90) * DAY, false)} (vérification d'identité complète). Le compte présente des achats programmés mensuels de bitcoin, retirés environ toutes les ${dcaWeeks} semaines (${nDca} retraits) vers une adresse externe enregistrée sous le libellé « DCA », ainsi qu'un retrait ponctuel vers une seconde adresse enregistrée sous le libellé « épargne 2 ». Les adresses seront communiquées en annexe, sous huit jours.\n\n` +
            `Aucun dépôt de bitcoins provenant de l'extérieur n'a été reçu sur ce compte. Dernière connexion : ${fmtDate(tSplit - Math.round(r.float(2, 9) * DAY))}.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui — portefeuilles HD', date: tPerq - 30 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Une clé publique étendue (xpub / ypub / zpub) permet de recalculer toutes les adresses d'un compte : réception (branche 0) et rendu (branche 1). Elle ne permet ni de signer ni de dépenser. Une adresse qui n'en dérive pas n'appartient pas à ce compte (elle peut appartenir à un autre portefeuille du même utilisateur, ou à un tiers).\n` +
            `- Un logiciel de portefeuille arrête de chercher après un certain nombre d'adresses consécutives sans transaction (gap limit). Ce qu'il affiche n'est donc pas forcément tout ce que contient le portefeuille.\n` +
            `- Un même portefeuille peut mêler des fonds d'origines différentes : l'origine de chaque entrée (retrait d'une plateforme au nom du titulaire, versement d'un tiers) permet de les séparer.\n` +
            `- Les sorties vers des adresses de dépôt d'exchange désignent des comptes clients identifiables par réquisition.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'choice', points: 8,
          prompt: 'Que permet, à elle seule, la clé publique étendue relevée sur le carnet ?',
          ...choice(r,
            'Recalculer et surveiller toutes les adresses du compte, sans pouvoir dépenser',
            [
              'Signer des transactions et vider le portefeuille vers un compte de saisie',
              'Consulter le solde de la première adresse de réception, et elle seule',
              'Obtenir l\'identité du titulaire auprès du fabricant du boîtier',
            ]),
          explanation: `Une zpub (BIP 84) est une clé publique : elle permet de dériver toutes les adresses du compte, passées et futures, sur les branches de réception et de rendu, donc de reconstituer l'historique et de surveiller le portefeuille. Elle ne contient aucune clé privée : impossible de signer, donc de saisir les fonds avec elle seule. Le fabricant d'un portefeuille matériel ne détient ni les clés ni l'identité de l'utilisateur.`,
        },
        {
          id: 'o2', type: 'number', points: 10, tolerance: 1, unit: 'adresses',
          prompt: 'Combien d\'adresses de ce portefeuille (réception et rendu confondus) ont été réellement utilisées ?',
          answer: used.length,
          hint: 'L\'outil « Dérivation HD » compte les adresses utilisées. Le résultat dépend de la limite d\'écart choisie : confrontez-le à l\'export du logiciel d\'encaissement.',
          explanation: `${used.length} adresses : ${usedReceive.length} de réception et ${usedChange} de rendu. ${usedChange === 0 ? 'La branche de rendu est vide : comme l\'indique le carnet, l\'option des adresses de rendu est décochée et le logiciel renvoie le rendu sur l\'adresse d\'envoi, d\'où la réutilisation de l\'adresse de collecte. ' : ''}Avec la limite par défaut (20), l'outil comme l'application n'en trouvent que ${appUsed.length} : les deux adresses de factures payées (index ${hIdx} et ${h2Idx}) et le « coffre » (index ${cIdx}) se trouvent après plus de 20 adresses vides, laissées par les factures expirées.`,
        },
        {
          id: 'o8', type: 'number', points: 10, tolerance: 1, unit: 'adresses',
          prompt: 'Quelle est la plus petite limite d\'écart (gap limit) qui fait apparaître toutes les adresses utilisées de ce portefeuille ?',
          answer: minGap,
          hint: 'Repérez la dernière adresse de réception remise à un épargnant, puis la première adresse de facture payée : comptez les adresses vides consécutives qui les séparent. Le balayage s\'arrête dès qu\'il en a vu autant que la limite.',
          explanation:
            `La dernière adresse remise à un épargnant est à l'index ${lastIdx} de la branche de réception ; la première facture payée est à l'index ${hIdx}. Entre les deux, ${hIdx - lastIdx - 1} adresses consécutives n'ont jamais servi (factures expirées). Un logiciel qui s'arrête après N adresses vides doit donc avoir N ≥ ${minGap} pour atteindre l'index ${hIdx} ; ensuite, les index ${h2Idx} et ${cIdx} ne sont plus séparés que par quelques adresses vides. ` +
            `Avec la valeur par défaut (20), l'application et l'outil s'arrêtent avant. En pratique, on ne cherche pas la valeur « juste » : on balaie large (50, 100 ou plus) dès qu'une pièce évoque des index élevés, puis on consigne au procès-verbal la limite retenue.`,
        },
        {
          id: 'o13', type: 'addresses', points: 10,
          prompt: 'Le portefeuille ne sert pas qu\'à l\'escroquerie. Sélectionnez les adresses de réception qui relèvent de l\'épargne personnelle du mis en cause, sans lien avec les versements des épargnants.',
          answer: [S0, S1],
          hint: 'La réponse de Coinhouse décrit deux adresses de retrait sans les citer. Regardez l\'origine des fonds de chaque adresse de réception : retrait d\'une plateforme, ou envoi d\'un particulier ? Et la date : avant ou pendant les faits ?',
          explanation:
            `${A(w, S0)} (index 0, « DCA ») reçoit ${s0Ins} retraits du hot wallet de Coinhouse, à peu près toutes les ${dcaWeeks} semaines du ${fmtDate(dcaTxs[0].time, false)} au ${fmtDate(dcaTxs[nDca - 1].time, false)}, bien avant le premier versement d'un épargnant (${fmtDate(pays[0].time, false)})${perso ? `, et paie quelques achats personnels (${perso}) avec rendu sur elle-même` : ''} ; ${A(w, S1)} (index 1, « épargne 2 ») reçoit un retrait Coinhouse unique le ${fmtDate(s1In.time, false)}. Ni l'une ni l'autre n'est regroupée vers la collecte. ` +
            `Ce sont les deux adresses annoncées par Coinhouse, plateforme où ${mec} est client${ge('', 'e')} sous son identité. Les adresses des épargnants, à l'inverse, reçoivent chacune un seul envoi d'un particulier pendant la période des faits, puis sont vidées vers l'adresse de collecte (index 2). Cette épargne (${btc(savings)} à ce jour) n'est pas le produit de l'escroquerie : elle peut être saisie à d'autres titres (saisie en valeur, confiscation du patrimoine), mais elle ne doit pas gonfler le préjudice.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) les épargnants ont-ils versé sur les adresses de réception remises par l\'application (hors épargne personnelle et hors factures « grands comptes ») ?',
          answer: totalVictims,
          hint: 'Additionnez les entrées des adresses de réception qui ont reçu un unique envoi d\'un particulier puis ont été vidées vers l\'adresse de collecte. Écartez les adresses alimentées par Coinhouse et les adresses de factures, situées bien plus loin dans la branche.',
          explanation: `${pays.length} versements sur les index 3 à ${lastIdx} de la branche de réception, pour ${btc(totalVictims)} (≈ ${usdFr(totalVictims)}). C'est l'assiette du préjudice connu à ce stade : chaque adresse correspond à un épargnant, que l'on peut rechercher à partir de l'adresse qui l'a alimentée (chacune a reçu peu avant un retrait d'une plateforme : la réquisition identifiera l'épargnant). Les retraits Coinhouse des index 0 et 1 (épargne personnelle) et les deux factures « grands comptes » (${btc(r8(bigValue + smallValue))}, payées par d'autres clients à identifier) ne s'additionnent pas à ce total.`,
        },
        {
          id: 'o5', type: 'addresses', points: 10,
          prompt: 'Sélectionnez toutes les adresses de dépôt d\'exchange alimentées par ce portefeuille.',
          answer: deposits.map((d) => d.addr),
          hint: 'Dépliez les sorties de l\'adresse de collecte : les adresses de dépôt sont étiquetées et balayées vers un hot wallet. Seules comptent les sorties du portefeuille saisi.',
          explanation:
            `${deposits.length} dépôts depuis l'adresse de collecte :\n` +
            deposits.map((d) => `- ${d.ex.entity.name} ${A(w, d.addr)} : ${btc(d.value)} le ${fmtDate(d.tx.time)}`).join('\n') +
            `\nChaque adresse de dépôt est propre à un compte client : c'est la donnée à citer dans la réquisition (identité, IP, IBAN de retrait, solde). Le paiement à ${giftShop.name} (${btc(cardValue)}) est un achat de cartes cadeaux, pas un compte d'exchange. Le dépôt ${exC.entity.name} visible plus loin (${btc(advDep.tx.outputs.find((o) => o.address === advDep.deposit)!.value)}) part de l'adresse du démarcheur, pas du portefeuille saisi : il concerne une autre personne.`,
        },
        {
          id: 'o9', type: 'address', points: 10,
          prompt: 'Hors exchanges, rendus et achat de cartes cadeaux, une même adresse externe reçoit plusieurs paiements de l\'adresse de collecte. Laquelle ?',
          answer: [advisor],
          hint: `Dépliez les sorties de l'adresse de collecte : écartez les adresses étiquetées (dépôts d'exchange, ${giftShop.name}) et l'éclatement final. La messagerie du téléphone évoque une « adresse habituelle ».`,
          explanation: `${A(w, advisor)} reçoit ${commissions.length} paiements de la collecte (${commissions.map((c) => `${btc(c.value)} le ${fmtDate(c.tx.time, false)}`).join(', ')}). Elle n'est ni étiquetée ni dérivée de la zpub, et elle a une vie propre : entrées d'autres origines depuis des mois ; ${advLife}. Les paiements suivent de près les messages de « ${advisorAlias} » réclamant « sa part » : c'est vraisemblablement l'adresse du démarcheur. Son dépôt chez ${exC.entity.name} est la meilleure piste pour l'identifier.${topupLead} La concordance avec la messagerie reste un indice à corroborer (téléphonie, auditions), pas une preuve d'identité.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (en BTC) le portefeuille a-t-il versé à cette adresse ?',
          answer: commTotal,
          hint: 'Additionnez les sorties de l\'adresse de collecte vers l\'adresse externe qui revient plusieurs fois (pas les rendus).',
          explanation: `${btc(commTotal)} (≈ ${usdFr(commTotal)}) en ${commissions.length} paiements, soit environ ${Math.round((commTotal / totalVictims) * 100)} % des versements des épargnants. Les autres entrées de cette adresse (antérieures aux faits) n'ont pas à être comptées : elles viennent d'ailleurs. Ce montant documente la rémunération du démarcheur et pourra être confronté à ses déclarations, une fois identifié.`,
        },
        {
          id: 'o14', type: 'tx', points: 12,
          prompt: 'Après la mise en demeure, l\'adresse de collecte éclate son solde en quatre sorties identiques ; quelques heures plus tard, trois transferts de montant presque égal partent en moins d\'une heure. Lequel ramène des fonds dans le portefeuille saisi ?',
          answer: [fwd1.id],
          hint: 'Les quatre sorties de l\'éclatement ne dérivent pas de la zpub. Suivez chacune d\'elles, puis vérifiez dans l\'outil « Dérivation HD » (limite d\'écart élargie) si la destination appartient au compte. L\'export du logiciel d\'encaissement mentionne une demande « coffre ».',
          explanation:
            `L'éclatement ${split.hash.slice(0, 14)}… (${fmtDate(split.time)}) envoie ${btc(X)} à quatre adresses d'un autre portefeuille (elles n'ont aucun chemin de dérivation dans la zpub). Puis, en moins d'une heure : ${twinLine}. ` +
            `Seul ${fwd1.hash.slice(0, 14)}… aboutit sur une adresse dérivée de la zpub : ${A(w, coffre)}, chemin m/84'/0'/0'/0/${cIdx}, la demande manuelle « coffre » de l'export. ` +
            `Les deux autres transferts, de montant presque égal et partis dans la même fenêtre de moins d'une heure, sont des leurres : ${A(w, E2).slice(0, 14)}… ne dérive pas de la zpub et n'a plus bougé ; ${A(w, E4).slice(0, 14)}… ne dérive pas non plus de la zpub et se ré-éclate en ${subs.length} petits montants vers des adresses inconnues. La quatrième sortie de l'éclatement ne transfère rien d'un bloc : elle sert de porte-monnaie de dépenses. Montant et horaire ne départagent pas les jumeaux ; la dérivation, si.`,
        },
        {
          id: 'o15', type: 'address', points: 8,
          prompt: 'Une des quatre sorties de l\'éclatement sert ensuite de porte-monnaie de dépenses courantes. Laquelle ?',
          answer: [D3],
          hint: 'Parmi les quatre adresses qui reçoivent l\'éclatement, une seule ne se vide pas d\'un bloc : elle paie de nombreux petits montants sur plusieurs jours.',
          explanation: `${A(w, D3)} reçoit ${btc(X)} puis règle ${d3.txs.length} petites dépenses en ${d3Days} jour${d3Days > 1 ? 's' : ''} (la dernière le ${fmtDate(d3.txs[d3.txs.length - 1].time, false)}, avant la perquisition), pour ${btc(d3Spent)} au total : ${shopsOf(d3.txs, D3)}, avec rendu sur elle-même. ${d3Lead} Le second téléphone, dont la boîte a été retrouvée vide, contient vraisemblablement ce portefeuille.`,
        },
        {
          id: 'o3', type: 'address', points: 10,
          prompt: 'Quelle adresse du portefeuille saisi détient aujourd\'hui le solde le plus élevé ?',
          answer: [richest],
          hint: 'L\'export du logiciel d\'encaissement mentionne des adresses qui n\'apparaissent pas dans la liste par défaut. Augmentez la limite d\'écart dans l\'outil.',
          explanation: `${A(w, richest)} (chemin ${w.get(richest).hd!.path}) détient ${btc(w.unspentValue(richest))}${richest === coffre ? `, reçus le ${fmtDate(fwd1.time)} depuis l'une des branches de l'éclatement` : ''}. Elle est invisible avec la limite d'écart par défaut : entre l'index ${lastIdx} (dernière adresse remise à un épargnant) et l'index ${hIdx}, le logiciel d'encaissement a consommé ${hIdx - lastIdx - 1} adresses restées vides. Il faut porter la limite à au moins ${minGap} pour la faire apparaître (50 en pratique). L'adresse de collecte n'a gardé que ${btc(kLeft)} (dont quelques UTXO de poussière de 546 sats, jamais dépensées).`,
        },
        {
          id: 'o4', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) la phrase de récupération placée sous scellé permet-elle de saisir sur ce compte, toutes adresses confondues ?',
          answer: total,
          hint: 'Additionnez le solde de chaque adresse utilisée, sur les deux branches, après un balayage complet. Le solde affiché par l\'application n\'est pas une référence ; les adresses issues de l\'éclatement qui ne dérivent pas de la zpub ne comptent pas.',
          explanation: `${btc(total)} (≈ ${usdFr(total)}) : ${btc(coffreValue)} sur le coffre, ${btc(r8(bigValue + smallValue))} sur les deux adresses de factures, ${btc(kLeft)} restés sur la collecte et ${btc(savings)} d'épargne personnelle (index 0 et 1). L'application n'affiche que ${btc(appTotal)} : elle s'arrête à la limite de 20 adresses vides. C'est précisément ce que ${mec} invitait à « regarder ». ` +
            `Les ${btc(outside)} partis vers ${A(w, E2).slice(0, 12)}… et ${A(w, E4).slice(0, 12)}…, et le porte-monnaie de dépenses, sont hors de portée de cette phrase : ils relèvent d'un autre portefeuille (le second téléphone ?) et sont à surveiller. Le montant à saisir est confirmé au moment du transfert.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Comment sécuriser les fonds encore présents sur ce portefeuille ?',
          ...choice(r,
            'Sur instruction du magistrat, transférer vers le portefeuille de saisie du service, à deux, chaque étape au PV',
            [
              'Restaurer la phrase sur le téléphone d\'un enquêteur pour déplacer les fonds au plus vite, puis rédiger le PV',
              'Transférer les fonds à l\'aide de la zpub, ce qui évite de manipuler la phrase de récupération sous scellé',
              'Laisser les fonds en place et demander au fabricant du boîtier de bloquer l\'appareil à distance',
            ]),
          explanation: `Seule la phrase de récupération (ou le boîtier et son code) permet de signer. La saisie consiste à transférer les fonds vers un portefeuille contrôlé par l'État (portefeuille de saisie du service, puis gestion par l'AGRASC), sur instruction du magistrat, depuis un poste dédié, sous double contrôle, en consignant au procès-verbal les adresses, montants et hash de transaction. On ne restaure jamais une phrase sur un équipement personnel (sécurité, traçabilité, loyauté de la preuve). La zpub ne donne aucun pouvoir de dépense et aucun fabricant ne peut bloquer un portefeuille auto-hébergé. Le transfert doit couvrir toutes les adresses, y compris celles au-delà de la limite d'écart, et distinguer au procès-verbal le produit présumé de l'escroquerie de l'épargne antérieure.`,
        },
      ],
      truth: {
        path: [
          ...pays.map((p) => p.tx.id), ...consolidations.map((x) => x.id),
          ...deposits.flatMap((d) => [d.tx.id, d.sweep.id]), cardTx.id, ...commissions.map((c) => c.tx.id),
          bigTx.id, smallTx.id, split.id, fwd1.id,
        ].sort((a, b) => w.tx(a).time - w.tx(b).time),
        addresses: [K, coffre, hBig, hSmall, ...pays.map((p) => p.addr), ...deposits.map((d) => d.addr), advisor, D1, S0, S1],
        debrief:
          `1. Le portefeuille matériel sert d'abord d'épargne : depuis le ${fmtDate(dcaTxs[0].time, false)}, des achats programmés sur Coinhouse arrivent sur l'index 0 (« DCA ») et un retrait ponctuel sur l'index 1${perso ? ' ; quelques achats personnels' : ''}. Rien à voir avec l'escroquerie : ${btc(savings)} à ce jour.\n` +
          `2. ${pays.length} épargnants versent au total ${btc(totalVictims)}, chacun sur une adresse de réception neuve (index 3 à ${lastIdx}${nSkipped > 0 ? `, ${nSkipped === 1 ? 'un index sauté pour un prospect qui n\'a' : `${nSkipped} index sautés pour des prospects qui n'ont`} pas payé` : ''}). ${mec[0].toUpperCase() + mec.slice(1)} les regroupe en ${consolidations.length} fois sur l'adresse de collecte (index 2), réutilisée : le logiciel renvoie le rendu sur l'adresse d'envoi.\n` +
          `3. Depuis la collecte : ${deposits.length} dépôts (${deposits.map((d) => `${d.ex.entity.name} ${btc(d.value)}`).join(', ')}), un achat chez ${giftShop.name} et ${commissions.length} paiements (${btc(commTotal)}) vers ${A(w, advisor).slice(0, 14)}…, l'« adresse habituelle » du démarcheur « ${advisorAlias} », qui a sa propre vie (${advLife}).\n` +
          `4. Après la mise en demeure de ${lawyer}, la collecte est éclatée en quatre sorties de ${btc(X)} vers un autre portefeuille. Trois transferts jumeaux partent en moins d'une heure : un seul revient dans le portefeuille matériel, sur l'adresse « coffre » (index ${cIdx}) générée par le logiciel d'encaissement ; un autre dort hors de la zpub, le troisième se ré-éclate. La quatrième sortie devient un porte-monnaie de dépenses.\n` +
          `5. Le logiciel d'encaissement a laissé plus de 20 adresses vides (factures expirées) : l'application, réglée sur une limite d'écart de 20, affiche ${btc(appTotal)}. La phrase sous scellé permet en réalité de saisir ${btc(total)} sur ${used.length} adresses, dont ${btc(coffreValue)} sur le coffre.\n\n` +
          `À retenir : une clé publique étendue trouvée en perquisition relie avec certitude toutes les adresses d'un compte, bien plus fort qu'une heuristique, et dit aussi ce qui n'en fait pas partie : face à des transferts jumeaux, la dérivation tranche là où montant et horaire ne disent rien. Mais un portefeuille mêle souvent des fonds d'origines différentes (épargne, produit de l'infraction) qu'il faut séparer par l'origine de chaque entrée, et le résultat dépend de la limite d'écart : en cas de doute, on balaie large. Pour saisir, il faut la phrase ou le boîtier : transfert vers le portefeuille de saisie sur instruction du magistrat, à deux, tout au procès-verbal. Les fonds partis hors de la zpub restent à surveiller.`,
      },
      hints: [
        'Cliquez sur la zpub dans la photographie du carnet : l\'outil « Dérivation HD » s\'ouvre sur ce portefeuille.',
        'Toutes les adresses du compte ne relèvent pas de l\'escroquerie : comparez l\'origine des fonds des index 0 et 1 (retraits Coinhouse, avant les faits) avec celle des adresses suivantes.',
        'Montez la limite d\'écart (gap limit) à 50 : 20 adresses vides consécutives ne prouvent pas que le portefeuille s\'arrête là.',
        'L\'adresse de collecte (index 2) concentre les sorties : dépôts d\'exchange étiquetés, une adresse externe qui revient plusieurs fois, puis l\'éclatement final.',
        'Pour départager les transferts jumeaux qui suivent l\'éclatement, demandez-vous lequel aboutit sur une adresse que la zpub sait dériver.',
      ],
    }
  },
}
