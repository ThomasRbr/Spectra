import { World, type Tx } from '../engine/world'
import { exchange, tonTransfer, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { dusting } from '../engine/realism'
import { ASSETS, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Escroquerie « airdrop / boost » par un bot Telegram et sa mini-application.
// Les victimes paient en TON et en USDT (jetton) avec, en commentaire, leur
// identifiant Telegram ; l'escroc encaisse sur une adresse de collecte puis
// vide celle-ci vers son portefeuille de travail, qui a un passé (retraits
// d'exchange, achat aux enchères du pseudonyme du canal, achat de membres).
// Mises de côté, dépôts sur un exchange, puis l'essentiel finit chez TonPocket
// (portefeuille custodial à adresse partagée, compte désigné par le commentaire).

const BOTS = ['TonBoostX', 'NotAirdropPlus', 'TonHarvest', 'GramYield', 'TonMinerPro', 'DurovDrop'] as const
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const ton = (v: number) => roundAsset('TON', v)
const usdt = (v: number) => roundAsset('USDT', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const GIFT_SHOPS = ['CadoBox', 'GiftTon', 'PremiumCards', 'Recharge Express'] as const
/** Heure locale (Paris) d'un horodatage. */
const parisHour = (t: number) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t * 1000)))
/** Décale vers l'avant jusqu'aux heures de bureau (pièces de procédure datées en journée). */
const office = (t: number) => {
  const h = parisHour(t)
  let u = h >= 9 && h < 19 ? t : t + (h >= 19 ? 24 - h + 9 : 9 - h) * HOUR
  // Changement d'heure pendant le décalage : on ajuste heure par heure
  while (parisHour(u) < 9 || parisHour(u) >= 19) u += HOUR
  return u
}

/** Même compte, forme « bounceable » (EQ…) : drapeau et somme de contrôle changent, pas le hash du compte. */
function bounceableForm(w: World, uq: string): string {
  let crc = ''
  for (let i = 0; i < 3; i++) crc += B64URL[w.rng.int(0, B64URL.length - 1)]
  return 'EQ' + uq.slice(2, 45) + crc
}

/** Identifiant Telegram fictif (10 chiffres). */
function tgId(w: World): string {
  return String(w.rng.int(5_000_000_000, 7_999_999_999))
}

interface Pay {
  victim: string
  asset: 'TON' | 'USDT'
  value: number
  tx: Tx
  comment: string
}

export const tonTelegramScam: ScenarioTemplate = {
  id: 'ton-telegram-scam',
  title: 'Le bot Telegram « boost » sur TON',
  tagline: 'Une mini-application, des TON et des USDT, des commentaires qui désignent les comptes… et un pseudonyme acheté aux enchères.',
  description:
    'Un bot Telegram promet de « booster » des TON et des USDT grâce à un faux programme d\'airdrop. Les victimes paient depuis leur portefeuille TON en indiquant leur identifiant Telegram en commentaire. Retrouvez l\'adresse de collecte, triez les mouvements du portefeuille de l\'administrateur (passé, mises de côté, poussière), isolez les commentaires qui désignent ses comptes chez les services de sortie et trouvez le paiement qui le rattache au compte Telegram du canal.',
  difficulty: 2,
  chains: ['ton'],
  skills: ['lecture_tx', 'tokens', 'memo', 'exchange_id', 'requisition', 'typologies', 'osint'],
  estMinutes: 48,
  lessons: ['ton-telegram', 'xrp-memos', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const bot = r.pick(BOTS)
    const admin = fakeHandle(r)
    const boostPct = r.pick([30, 40, 50, 80])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const fundKeys = (['binance', 'okx', 'kraken'] as const).filter((k) => k !== destKey)
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'ton')))
      return x
    }
    const dest = ex(destKey)
    const pocket = ex('tonpocket')
    for (const k of fundKeys) ex(k)

    const scamE = w.customEntity({ name: `Bot Telegram @${bot}_bot (inconnu)`, category: 'scam', description: 'Faux programme d\'airdrop et de « boost » de TON opéré par un bot Telegram.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const collect = w.addr('ton', { entity: scamE })
    const relay = w.addr('ton', { entity: scamE })
    const collectEq = bounceableForm(w, A(w, collect))

    // ── Vie antérieure du portefeuille de l'administrateur (futur relais) ───
    // Retraits depuis son compte d'exchange, achat aux enchères du pseudonyme
    // Telegram qui administre le canal, achat de « membres » pour le canal.
    const tStart0 = w.at(0)
    const adminEx = ex(r.pick(fundKeys))
    const marketE = w.customEntity({
      name: 'Gramota', category: 'nft_marketplace', known: true, country: 'Émirats arabes unis',
      description: 'Place de marché (fictive) de pseudonymes et de numéros Telegram vendus aux enchères sous forme de NFT sur TON. Le paiement du gagnant porte en commentaire le numéro d\'enchère et le pseudonyme acquis, qui est ensuite rattaché à un compte Telegram.',
      compliance: { contact: 'Service juridique de Gramota', cooperation: 'voluntary', responseDays: [15, 60], canFreeze: false, kyc: 'faible', notes: 'Conserve le compte Telegram connecté lors de l\'enchère, le portefeuille payeur et l\'historique des pseudonymes attribués.' },
    })
    const marketAddr = w.addr('ton', { entity: marketE, label: 'Gramota — Paiement des enchères' })
    const auctionNo = r.int(100000, 999999)
    const h1 = adminEx.withdraw(relay, ton(r.float(150, 500)), tStart0 - Math.round(r.float(60, 90) * DAY), 'TON')
    const usernameTx = tonTransfer(w, { from: relay, to: marketAddr, value: ton(Math.round(h1.transfers[0].value * r.float(0.3, 0.6))), asset: 'TON', comment: `Enchère n° ${auctionNo} — @${admin}`, time: tStart0 - Math.round(r.float(40, 55) * DAY) })
    const h2 = adminEx.withdraw(relay, ton(r.float(100, 300)), tStart0 - Math.round(r.float(15, 25) * DAY), 'TON')
    const promoSeller = w.addr('ton')
    for (let i = 0; i < r.int(2, 3); i++) {
      const c = w.addr('ton')
      const v = ton(Math.round(r.float(20, 90)))
      const tc = tStart0 - Math.round(r.float(2, 40) * DAY)
      w.fundAccount(c, ton(v + r.float(1, 10)), 'TON', tc - Math.round(r.float(2, 48) * HOUR))
      tonTransfer(w, { from: c, to: promoSeller, value: v, asset: 'TON', comment: 'Boost membres', time: tc })
    }
    const promoTxs = [r.float(7, 9), r.float(3, 5)].map((d) => tonTransfer(w, { from: relay, to: promoSeller, value: ton(Math.round(r.float(20, 60))), asset: 'TON', comment: `Boost membres ${bot} Official`, time: tStart0 - Math.round(d * DAY) }))
    // Autres acheteurs de pseudonymes sur la place de marché
    for (let i = 0; i < 3; i++) {
      const c = w.addr('ton')
      const t = tStart0 - Math.round(r.float(5, 90) * DAY)
      const v = ton(Math.round(r.float(20, 280)))
      w.fundAccount(c, ton(v + r.float(5, 50)), 'TON', t - Math.round(r.float(1, 10) * DAY))
      tonTransfer(w, { from: c, to: marketAddr, value: v, asset: 'TON', comment: `Enchère n° ${r.int(100000, 999999)}`, time: t })
    }

    // ── Victimes ─────────────────────────────────────────────────────────────
    const tStart = w.at(0)
    const pays: Pay[] = []
    const victimAddr = w.addr('ton', { entity: victimE })
    const victimTg = tgId(w)
    // La victime achète ses TON et ses USDT sur un exchange
    const vTon = ton(Math.round(r.float(180, 900)))
    const vUsdt = usdt(Math.round(r.float(6, 40)) * 50)
    const vFund = ex(r.pick(fundKeys))
    const vFundTon = vFund.withdraw(victimAddr, ton(vTon + r.float(5, 30)), tStart - Math.round(r.float(10, 40) * HOUR), 'TON')
    const vFundUsdt = vFund.withdraw(victimAddr, usdt(vUsdt + r.int(0, 3) * 10), tStart - Math.round(r.float(2, 9) * HOUR), 'USDT')
    const vPay1 = tonTransfer(w, { from: victimAddr, to: collect, value: vTon, asset: 'TON', comment: victimTg, time: tStart })
    pays.push({ victim: victimAddr, asset: 'TON', value: vTon, tx: vPay1, comment: victimTg })
    // Faux « bonus » versé pour mettre en confiance
    const bonus = ton(vTon * boostPct / 100 * r.float(0.08, 0.15))
    const bonusTx = tonTransfer(w, { from: collect, to: victimAddr, value: bonus, asset: 'TON', comment: `${bot} 🎁 boost payout`, time: tStart + Math.round(r.float(5, 20) * HOUR) })
    const vPay2 = tonTransfer(w, { from: victimAddr, to: collect, value: vUsdt, asset: 'USDT', comment: victimTg, time: bonusTx.time + Math.round(r.float(3, 18) * HOUR) })
    pays.push({ victim: victimAddr, asset: 'USDT', value: vUsdt, tx: vPay2, comment: victimTg })

    // Autres victimes (non identifiées) : 1 à 2 paiements chacune
    const nOthers = r.int(6, 9)
    const others: string[] = []
    for (let i = 0; i < nOthers; i++) {
      const a = w.addr('ton')
      others.push(a)
      const id = tgId(w)
      const nP = r.chance(0.35) ? 2 : 1
      for (let j = 0; j < nP; j++) {
        const asset: 'TON' | 'USDT' = r.chance(0.55) ? 'TON' : 'USDT'
        const value = asset === 'TON' ? ton(Math.round(r.float(40, 1400))) : usdt(Math.round(r.float(2, 60)) * 50)
        const t = w.at(r.float(-30, 4 * 24))
        if (r.chance(0.5)) {
          const fk = ex(r.pick(fundKeys))
          fk.withdraw(a, asset === 'TON' ? ton(value + r.float(2, 20)) : usdt(value + r.int(0, 5) * 10), t - Math.round(r.float(1, 30) * HOUR), asset)
        } else {
          w.fundAccount(a, asset === 'TON' ? ton(value * r.float(1.02, 1.3)) : usdt(value + r.int(1, 8) * 10), asset, t - Math.round(r.float(1, 72) * HOUR))
        }
        const tx = tonTransfer(w, { from: a, to: collect, value, asset, comment: id, time: t })
        pays.push({ victim: a, asset, value, tx, comment: id })
      }
    }
    // Deux autres victimes reçoivent aussi un « bonus »
    const firstTonPay = new Map<string, Pay>()
    for (const p of pays) if (p.victim !== victimAddr && p.asset === 'TON' && !firstTonPay.has(p.victim)) firstTonPay.set(p.victim, p)
    const bonusOthers = r.pickN([...firstTonPay.values()], 2).map((p) =>
      tonTransfer(w, { from: collect, to: p.victim, value: ton(p.value * r.float(0.03, 0.08)), asset: 'TON', comment: `${bot} 🎁 boost payout`, time: p.tx.time + Math.round(r.float(4, 30) * HOUR) }),
    )

    const collectedTon = ton(pays.filter((p) => p.asset === 'TON').reduce((s, p) => s + p.value, 0))
    const collectedUsdt = usdt(pays.filter((p) => p.asset === 'USDT').reduce((s, p) => s + p.value, 0))
    const collectedUsd = Math.round((usd('TON', collectedTon) + collectedUsdt) * 100) / 100
    const lastPay = Math.max(...pays.map((p) => p.tx.time), ...bonusOthers.map((t) => t.time))

    // ── Bruit des services à adresse partagée (avant de choisir les commentaires de l'escroc) ──
    dest.noise(18, w.at(-3 * 24), w.at(9 * 24), 'TON')
    dest.noise(14, w.at(-3 * 24), w.at(9 * 24), 'USDT')
    pocket.noise(16, w.at(-3 * 24), w.at(9 * 24), 'TON')
    pocket.noise(8, w.at(-3 * 24), w.at(9 * 24), 'USDT')
    for (const k of fundKeys) ex(k).noise(6, w.at(-5 * 24), w.at(7 * 24), 'TON')

    const usedMemos = new Set([...w.txs.values()].map((t) => t.memo).filter((m): m is string => !!m))
    const freshMemo = (kit: ExchangeKit) => {
      let m = kit.newMemo()
      while (usedMemos.has(m)) m = kit.newMemo()
      usedMemos.add(m)
      return m
    }
    const exMemo = freshMemo(dest)
    const pocketMemo = freshMemo(pocket)

    // ── Encaissement : collecte → relais → services ────────────────────────
    const tMove = lastPay + Math.round(r.float(3, 10) * HOUR)
    const bonusOut = ton(bonus + bonusOthers.reduce((s, t) => s + t.transfers[0].value, 0))
    const tonAvail = ton(collectedTon - bonusOut)
    const keepTon = ton(r.float(1.5, 4))
    const moveTon = ton(tonAvail - keepTon)
    const mvTon = tonTransfer(w, { from: collect, to: relay, value: moveTon, asset: 'TON', time: tMove })
    const mvUsdt = tonTransfer(w, { from: collect, to: relay, value: collectedUsdt, asset: 'USDT', time: tMove + r.int(60, 600) })

    // Mise de côté : deux adresses neuves reçoivent une petite part des TON
    const reserveAddr = w.addr('ton', { entity: scamE })
    const giftAddr = w.addr('ton', { entity: scamE })
    const reserveV = ton(Math.round(moveTon * r.float(0.06, 0.1)))
    const giftV = ton(Math.round(moveTon * r.float(0.03, 0.05)))
    const reserveTx = tonTransfer(w, { from: relay, to: reserveAddr, value: reserveV, asset: 'TON', time: tMove + Math.round(r.float(1, 3) * HOUR) })
    const giftTx = tonTransfer(w, { from: relay, to: giftAddr, value: giftV, asset: 'TON', time: reserveTx.time + r.int(4, 30) * 60 })
    const shopName = GIFT_SHOPS[(Math.imul(w.seed, 2654435761) >>> 20) % GIFT_SHOPS.length]
    const cardhub = w.customEntity({ name: shopName, category: 'merchant', known: true, description: 'Vente de cartes cadeaux et d\'abonnements contre TON (fictif) ; chaque commande est livrée à un compte Telegram ou à une adresse e-mail.' })
    const giftSpend = [0, 1].map((i) => tonTransfer(w, { from: giftAddr, to: w.addr('ton', { entity: cardhub, label: `${shopName} — Paiement` }), value: ton(giftV * r.float(0.3, 0.42)), asset: 'TON', time: giftTx.time + Math.round(r.float(10 + i * 30, 30 + i * 40) * HOUR) }))

    // Dépôts sur l'exchange (adresse partagée, commentaire = compte client)
    const exTonV = ton(Math.round(moveTon * r.float(0.18, 0.28)))
    const u1 = usdt(Math.round(collectedUsdt * r.float(0.45, 0.6)))
    const u2 = usdt(collectedUsdt - u1)
    const tDep = tMove + Math.round(r.float(6, 20) * HOUR)
    const dep1 = tonTransfer(w, { from: relay, to: dest.hot, value: u1, asset: 'USDT', comment: exMemo, time: tDep })
    const dep2 = tonTransfer(w, { from: relay, to: dest.hot, value: exTonV, asset: 'TON', comment: exMemo, time: tDep + r.int(10, 50) * 60 })
    const dep3 = tonTransfer(w, { from: relay, to: dest.hot, value: u2, asset: 'USDT', comment: exMemo, time: tDep + Math.round(r.float(2, 7) * HOUR) })
    const depTxs = [dep1, dep2, dep3]
    const depositedUsd = usd('TON', exTonV) + u1 + u2

    // L'essentiel des TON part en dernier vers le portefeuille custodial intégré à Telegram
    const toPocket = ton(Math.floor(moveTon - reserveV - giftV - exTonV - r.float(2, 5)))
    const pocketTx = tonTransfer(w, { from: relay, to: pocket.hot, value: toPocket, asset: 'TON', comment: pocketMemo, time: dep3.time + Math.round(r.float(4, 12) * HOUR) })
    // Des sosies du portefeuille de l'administrateur lui envoient des montants infimes
    const relayDust = dusting(w, relay, { time: tDep, n: 2, spreadH: 30 })

    // Leurres : dépôts concomitants d'autres clients sur l'exchange, montants voisins
    for (let i = 0; i < r.int(5, 8); i++) {
      const a = w.addr('ton')
      const asset: 'TON' | 'USDT' = r.chance(0.5) ? 'USDT' : 'TON'
      const v = asset === 'USDT' ? usdt(Math.round(u1 * r.float(0.6, 1.4))) : ton(Math.round(exTonV * r.float(0.6, 1.4)))
      const td = tDep + r.int(-5 * 3600, 6 * 3600)
      w.fundAccount(a, asset === 'USDT' ? usdt(v + r.int(5, 60)) : ton(v + r.float(2, 30)), asset, td - Math.round(r.float(2, 48) * HOUR))
      tonTransfer(w, { from: a, to: dest.hot, value: v, asset, comment: freshMemo(dest), time: td })
    }

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const destName = dest.entity.name
    const nVictims = nOthers + 1
    const vLossUsd = usd('TON', vTon) + vUsdt
    // Paiements de victimes provenant directement d'un retrait d'exchange (identifiables par réquisition)
    const fromExchange = pays.filter((p) => w.txsOf(p.victim).some((t) => t.time < p.tx.time && t.transfers.some((x) => x.to === p.victim && [...kits.values()].some((k) => k.hot === x.from))))
    const nExVictims = new Set(fromExchange.map((p) => p.victim)).size

    return {
      world: w,
      title: `@${bot}_bot — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Sur Telegram, ${g('il', 'elle')} a lancé la mini-application du bot @${bot}_bot, qui promettait un « boost » de +${boostPct} % en sept jours sur les TON et les USDT déposés, au titre d'un prétendu airdrop. Après un premier petit « gain », ${g('il', 'elle')} a renvoyé des USDT ; puis le bot a cessé de répondre.\n\n` +
        `Sur la blockchain TON, les paiements portent souvent un commentaire en clair. Les services qui utilisent une adresse unique pour tous leurs clients (exchanges, portefeuilles intégrés à Telegram) identifient le compte crédité grâce à ce commentaire : sans lui, impossible de savoir à qui le dépôt profite.\n\n` +
        `Objectifs : identifier l'adresse de collecte du bot, mesurer la collecte et le nombre de victimes, puis trier les mouvements du portefeuille qui reçoit les fonds (il a une vie bien antérieure à l'escroquerie) pour suivre l'argent jusqu'aux services de sortie, relever les commentaires qui désignent les comptes de l'escroc et trouver ce qui le rattache à un compte Telegram.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: office(lastPay + 2 * DAY), author: victimName,
          body:
            `« Un ami m'a transféré le lien du bot @${bot}_bot. Dans la mini-application, on choisissait un montant et le bot affichait l'adresse où envoyer, avec mon identifiant Telegram (${victimTg}) à mettre en commentaire "pour créditer mon compte".\n\n` +
            `J'ai envoyé ${amt(vTon, 'TON')} le ${fmtDate(vPay1.time)} depuis mon portefeuille : ${A(w, victimAddr)}\n` +
            `Transaction : ${vPay1.hash}\n\n` +
            `J'ai reçu un « bonus » de ${amt(bonus, 'TON')}, alors j'ai renvoyé ${amt(vUsdt, 'USDT')} le ${fmtDate(vPay2.time, false)}. Ensuite plus rien, et le bot me demandait des "frais de déblocage". Au total j'ai envoyé environ ${usd0(vLossUsd)}, et je n'ai récupéré que ce « bonus ». »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture de la mini-application @${bot}_bot`, date: tStart - 2 * HOUR,
          body:
            `💎 ${bot.toUpperCase()} — AIRDROP SAISON 2 💎\n` +
            `Boost garanti : +${boostPct} % en 7 jours sur TON et USDT\n\n` +
            `Adresse de dépôt officielle :\n${collectEq}\n\n` +
            `⚠️ COMMENTAIRE OBLIGATOIRE : votre ID Telegram (${victimTg})\n` +
            `Sans commentaire, le dépôt ne peut pas être attribué à votre compte.\n` +
            `Retraits débloqués dès 100 TON de solde.`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Canal « ${bot} Official » (message épinglé)`, author: `@${admin}`, date: w.at(-2 * 24),
          body:
            `🚀 La saison 2 de l'airdrop ${bot} est ouverte !\n` +
            `Plus de ${r.int(12, 40)} 000 membres déjà boostés 🔥 Retraits instantanés 💸\n` +
            `👉 Lancez la mini-app @${bot}_bot, déposez TON ou USDT, et regardez votre solde grimper.\n` +
            `Places limitées, fin de la saison dans 72 h ⏳`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note de veille : pseudonymes Telegram vendus aux enchères', date: office(lastPay + 3 * DAY), author: 'Cellule cyber',
          body:
            `Les pseudonymes courts ou recherchés de Telegram (@nom) se vendent aux enchères sur des places de marché, sous forme de NFT sur la blockchain TON. Le gagnant paie depuis son portefeuille, et le pseudonyme est ensuite rattaché à son compte Telegram. Sur la place de marché Gramota, le paiement porte en commentaire le numéro d'enchère et le pseudonyme acquis.\n\n` +
            `Le canal « ${bot} Official » est administré par le compte @${admin}. Les opérateurs d'arnaques Telegram achètent souvent un pseudonyme « propre » pour leurs canaux, et des « membres » pour les faire paraître actifs.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : lire une transaction TON', date: office(lastPay + 2 * DAY) + HOUR, author: 'Cellule d\'appui',
          body:
            `• TON est un modèle à comptes. Chaque portefeuille est un petit contrat ; les USDT y circulent comme jetons au standard Jetton (méthode « jetton transfer »).\n` +
            `• Une même adresse s'écrit sous plusieurs formes : « UQ… » (non-bounceable, d'usage pour les portefeuilles), « EQ… » (bounceable, d'usage pour les contrats et les services) et une forme brute « 0:<64 caractères hexadécimaux> ». Le drapeau et la somme de contrôle changent, pas le compte. Les hash de transaction s'affichent aussi en hexadécimal ou en base64.\n` +
            `• Le commentaire (memo) d'un transfert est public. Sur une adresse de service partagée, c'est lui qui désigne le compte client. Le commentaire saisi par une victime ne désigne que son propre compte… chez l'escroc.\n` +
            `• Telegram et les portefeuilles intégrés sont des services distincts : un portefeuille custodial détient les fonds et connaît son client ; la messagerie, elle, ne voit pas la blockchain.`,
        },
      ],
      seeds: [victimAddr],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de collecte du bot, qui reçoit les paiements des victimes ?',
          answer: [collect],
          hint: 'Ouvrez la transaction citée dans la plainte : le destinataire est l\'adresse de collecte, quelle que soit la forme sous laquelle la mini-application l\'affiche.',
          explanation: `${A(w, collect)} reçoit les paiements de ${nVictims} portefeuilles distincts, chacun accompagné d'un identifiant Telegram en commentaire. La mini-application affichait ${collectEq} : c'est la forme bounceable de la même adresse.`,
        },
        {
          id: 'o6', type: 'choice', points: 8,
          prompt: `La mini-application affichait l'adresse ${collectEq.slice(0, 10)}…, l'explorateur montre ${A(w, collect).slice(0, 10)}…. Que faut-il en conclure ?`,
          ...choice(r,
            'Même compte sous deux formes (bounceable « EQ », non-bounceable « UQ ») : citer les deux et la forme brute',
            [
              'Ce sont deux comptes distincts : la mini-application a redirigé les paiements vers une seconde adresse contrôlée par l\'escroc',
              'La forme « EQ » désigne la version testnet de l\'adresse : seuls les paiements sur « UQ » ont une valeur réelle',
              'La forme « EQ » est celle de Telegram : la messagerie détient donc les fonds et peut les restituer sur demande',
            ]),
          hint: 'Relisez la note de l\'analyste sur les différentes formes d\'une adresse TON, et comparez les caractères centraux des deux écritures.',
          explanation: `Sur TON, la forme « user-friendly » encode le compte (workchain + hash) avec un drapeau : « EQ » bounceable, « UQ » non-bounceable, et une somme de contrôle. ${collectEq} et ${A(w, collect)} désignent le même portefeuille. Une réquisition ou une demande de signalement doit citer la forme brute et les deux formes courantes, pour éviter qu'un service ne réponde « adresse inconnue ».`,
        },
        {
          id: 'o9', type: 'number', points: 9, tolerance: 0, unit: 'portefeuilles',
          prompt: 'Combien de portefeuilles distincts (plaignant compris) ont envoyé des fonds à l\'adresse de collecte ?',
          answer: nVictims,
          hint: 'Listez les transactions entrantes de l\'adresse de collecte et comptez les expéditeurs différents : certains ont payé deux fois.',
          explanation: `${nVictims} portefeuilles pour ${pays.length} paiements : certaines victimes ont payé deux fois, souvent après un faux « bonus ». Chaque portefeuille indique en commentaire son propre identifiant Telegram (repris à l'identique lors d'un second paiement), ce qui confirme qu'il s'agit d'autant de comptes victimes. ${nExVictims} de ces portefeuilles ont été alimentés juste avant par un retrait d'exchange : leurs titulaires sont identifiables par réquisition, pour être entendus et rattachés à la procédure.`,
        },
        {
          id: 'o2', type: 'amount', points: 9, unit: 'USD', tolerance: 0.02,
          prompt: 'Quel montant total (en dollars) l\'adresse de collecte a-t-elle reçu des victimes ?',
          answer: collectedUsd,
          hint: 'L\'adresse de collecte ne reçoit rien d\'autre que les paiements des victimes : son total reçu, TON et USDT confondus, répond à la question.',
          explanation: `${pays.length} paiements : ${amt(collectedTon, 'TON')} et ${amt(collectedUsdt, 'USDT')}, soit ${usd0(collectedUsd)} au cours de l'exercice (1 TON = ${ASSETS.TON.usd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $). Les faux « bonus » renvoyés à ${bonusOthers.length + 1} victimes (${amt(bonusOut, 'TON')}) sont des sorties : ils ne réduisent pas la collecte et font partie du mécanisme (mettre en confiance pour obtenir un second versement).`,
        },
        {
          id: 'o11', type: 'amount', points: 8, unit: 'TON', tolerance: 0.01,
          prompt: 'Quel montant total de TON l\'adresse de collecte a-t-elle renvoyé aux victimes sous forme de faux « bonus » ?',
          answer: bonusOut,
          hint: 'Repérez les petites sorties de l\'adresse de collecte vers des portefeuilles de victimes, avec un commentaire promotionnel.',
          explanation: `${bonusOthers.length + 1} « bonus » (${[bonus, ...bonusOthers.map((t) => t.transfers[0].value)].map((v) => amt(v, 'TON')).join(', ')}), soit ${amt(bonusOut, 'TON')}, tous accompagnés du commentaire « ${bot} 🎁 boost payout ». C'est le ressort de la chaîne de Ponzi miniature : un faux gain rapide pour obtenir un second versement, souvent plus élevé. Dans le calcul du préjudice, ces sommes se déduisent des pertes des victimes concernées, mais pas de la collecte brute.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Vers quelle adresse les fonds collectés sont-ils transférés avant d\'atteindre les services de sortie ?',
          answer: [relay],
          hint: 'Écartez les petits « bonus » renvoyés aux victimes : la seule grosse sortie de l\'adresse de collecte, en TON puis en USDT, mène à cette adresse.',
          explanation: `Le ${fmtDate(mvTon.time)}, l'adresse de collecte transfère ${amt(moveTon, 'TON')} puis ${amt(collectedUsdt, 'USDT')} vers ${A(w, relay)}, à quelques minutes d'intervalle et sans commentaire. Ce n'est pas une adresse jetable : elle existe depuis le ${fmtDate(h1.time, false)}, a été alimentée par des retraits ${adminEx.entity.name}, a acheté un pseudonyme Telegram et des « membres » pour le canal du bot. C'est le portefeuille de travail de l'administrateur, qui sert de relais entre l'adresse affichée par la mini-application, exposée aux signalements, et les services de sortie.`,
        },
        {
          id: 'o13', type: 'tx', points: 10,
          prompt: 'Quelle transaction antérieure aux faits rattache ce portefeuille à un compte Telegram ?',
          answer: [usernameTx.id],
          hint: 'Remontez l\'historique du portefeuille qui reçoit les fonds collectés et lisez les commentaires de ses paiements vers des services attribués. Croisez avec la note de veille.',
          explanation: `Le ${fmtDate(usernameTx.time, false)}, ${A(w, relay)} paie ${amt(usernameTx.transfers[0].value, 'TON')} à la place de marché Gramota avec le commentaire « Enchère n° ${auctionNo} — @${admin} » : il a acheté aux enchères le pseudonyme @${admin}, celui-là même qui administre le canal « ${bot} Official ». Le lien entre le portefeuille et le compte Telegram est donc établi par la blockchain, pas seulement par le contenu du canal. Les autres paiements antérieurs ne s'y prêtent pas : les retraits ${adminEx.entity.name} identifient un client de l'exchange (à requérir aussi), et les paiements « Boost membres ${bot} Official » à un vendeur non identifié ne désignent aucun compte. ${procedureFor(marketE)} La demande vise le compte Telegram connecté lors de l'enchère n° ${auctionNo}.`,
        },
        {
          id: 'o3', type: 'entity', points: 8,
          prompt: 'Vers quel service la plus grosse part des TON est-elle finalement envoyée ?',
          answer: ['tonpocket'],
          hint: 'Depuis le portefeuille relais, triez les sorties de TON par montant : les deux petites vers des adresses neuves sont des mises de côté ; parmi les services attribués, cherchez le plus gros transfert.',
          explanation: `En dernier, le ${fmtDate(pocketTx.time)}, le relais ${A(w, relay)} envoie ${amt(toPocket, 'TON')} à l'adresse partagée de TonPocket, portefeuille custodial intégré à Telegram, avec le commentaire ${pocketMemo} : c'est plus que tout ce qui est parti vers l'exchange en TON (${amt(exTonV, 'TON')}). Une fois chez TonPocket, les fonds peuvent circuler entre comptes du service sans laisser de trace on-chain : seul le prestataire peut dire ce qu'ils sont devenus. ${procedureFor(pocket.entity)} Les autres sorties ne sont pas la piste principale : ${amt(reserveV, 'TON')} dorment sur ${A(w, reserveAddr).slice(0, 12)}… (réserve à surveiller), ${amt(giftV, 'TON')} partent sur ${A(w, giftAddr).slice(0, 12)}…, qui achète des cartes cadeaux chez ${shopName} ; les micro-transferts entrants viennent d'adresses sosies (empoisonnement).`,
        },
        {
          id: 'o10', type: 'number', points: 9, tolerance: 0, unit: 'commentaire',
          prompt: 'Quel commentaire désigne le compte TonPocket crédité par le relais ?',
          answer: Number(pocketMemo),
          hint: 'Ouvrez le transfert du relais vers l\'adresse partagée de TonPocket et lisez le champ « Commentaire (memo) ».',
          explanation: `Le dépôt de ${amt(toPocket, 'TON')} sur l'adresse partagée de TonPocket porte le commentaire ${pocketMemo}. C'est l'identifiant du compte client à indiquer dans la demande adressée au portefeuille custodial, avec le hash ${pocketTx.hash.slice(0, 12)}…, la date et le montant. Un portefeuille intégré à Telegram reste un prestataire distinct de la messagerie : c'est lui, et non Telegram, qui détient les fonds et connaît son client.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Sur quel exchange les USDT et une partie des TON ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Le relais effectue trois dépôts (TON et USDT) vers une même adresse, étiquetée comme hot wallet d\'un exchange.',
          explanation: `Trois dépôts du relais (${amt(u1, 'USDT')}, ${amt(exTonV, 'TON')}, ${amt(u2, 'USDT')}, soit ${usd0(depositedUsd)}) arrivent sur l'adresse partagée de l'exchange ${destName}, étiquetée comme son hot wallet.`,
        },
        {
          id: 'o5', type: 'number', points: 12, tolerance: 0, unit: 'commentaire',
          prompt: 'Quel commentaire accompagne les dépôts de l\'escroc sur l\'exchange (identifiant de son compte) ?',
          answer: Number(exMemo),
          hint: 'Ouvrez le détail des dépôts du relais vers le hot wallet de l\'exchange. Ne confondez pas avec l\'identifiant Telegram des victimes ni avec le commentaire du dépôt TonPocket.',
          explanation: `Les trois dépôts portent le commentaire ${exMemo}. Les autres dépôts reçus au même moment par ${destName} portent d'autres commentaires : ce sont d'autres clients. Le nombre ${victimTg} n'est que l'identifiant Telegram de la victime, saisi à la demande du bot ; ${pocketMemo} désigne le compte TonPocket.`,
        },
        {
          id: 'o7', type: 'choice', points: 9,
          prompt: 'Pourquoi la réquisition à l\'exchange doit-elle impérativement mentionner le commentaire des dépôts ?',
          ...choice(r,
            'L\'adresse est partagée par tous les clients : seul le commentaire, avec hash, date et montant, désigne le compte',
            [
              'Le commentaire est chiffré par l\'exchange : il faut le fournir pour que la plateforme puisse déchiffrer la transaction',
              'Sans commentaire, l\'exchange est tenu de considérer la réquisition comme irrecevable au regard du règlement MiCA',
              'Le commentaire contient le numéro de téléphone du titulaire, ce qui dispense de demander les données KYC',
            ]),
          hint: 'Combien de clients de l\'exchange déposent sur cette même adresse ? Qu\'est-ce qui distingue le dépôt de l\'un de celui d\'un autre ?',
          explanation: `${destName} reçoit sur ${A(w, dest.hot)} les dépôts de très nombreux clients. La réquisition vise le commentaire ${exMemo} et cite les hash ${dep1.hash.slice(0, 12)}…, ${dep2.hash.slice(0, 12)}… et ${dep3.hash.slice(0, 12)}…, leurs dates et montants. ${procedureFor(dest.entity)} Demandez aussi le gel du solde du compte.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Comment identifier les autres victimes du bot ?',
          ...choice(r,
            'Requérir les exchanges qui ont alimenté certains portefeuilles victimes juste avant leur paiement, et rapprocher les identifiants Telegram portés en commentaire des plaintes enregistrées',
            [
              'Écrire au bot depuis un compte d\'enquête pour lui demander la liste de ses utilisateurs',
              'Demander à l\'exchange de sortie la liste de tous ses clients ayant déposé le même jour',
              'Publier l\'adresse de collecte sur le canal du bot pour inviter les victimes à se signaler',
            ]),
          hint: 'Qui connaît l\'identité des expéditeurs ? Que contiennent les commentaires des paiements reçus ?',
          explanation: `Les portefeuilles victimes sont non custodiaux, mais ${nExVictims} d'entre eux ont reçu leurs TON ou USDT d'un retrait d'exchange peu avant de payer : une réquisition ciblée (hash, adresse, date) identifie le client. Les identifiants Telegram en commentaire, publics, permettent de rapprocher des plaintes déjà déposées ailleurs. Contacter le bot alerterait l'escroc, une demande massive à l'exchange serait disproportionnée, et publier sur le canal du bot n'a aucun sens procédural.`,
        },
      ],
      truth: {
        path: [vFundTon.id, vFundUsdt.id, vPay1.id, bonusTx.id, vPay2.id, ...pays.filter((p) => p.victim !== victimAddr).map((p) => p.tx.id), mvTon.id, mvUsdt.id, ...depTxs.map((t) => t.id), pocketTx.id],
        addresses: [collect, relay, pocket.hot, dest.hot, reserveAddr, giftAddr],
        debrief:
          `1. Le bot @${bot}_bot affiche l'adresse ${collectEq} (forme bounceable de ${A(w, collect)}) et exige l'identifiant Telegram de la victime en commentaire, pour donner l'illusion d'un compte crédité.\n` +
          `2. ${nVictims} portefeuilles y envoient ${pays.length} paiements : ${amt(collectedTon, 'TON')} et ${amt(collectedUsdt, 'USDT')} (${usd0(collectedUsd)}). ${bonusOthers.length + 1} victimes, dont ${victimName}, reçoivent un faux « bonus » pour les inciter à renvoyer des fonds.\n` +
          `3. Le ${fmtDate(tMove, false)}, les fonds passent sur ${A(w, relay)}, le portefeuille de travail de l'administrateur : alimenté depuis le ${fmtDate(h1.time, false)} par des retraits ${adminEx.entity.name}, il a payé aux enchères Gramota le pseudonyme @${admin} (« Enchère n° ${auctionNo} ») qui administre le canal du bot, et acheté des « membres » pour ce canal (${promoTxs.length} paiements). Quelques TON (${amt(keepTon, 'TON')}) restent sur l'adresse de collecte pour les frais.\n` +
          `4. Le relais met ${amt(reserveV, 'TON')} de côté sur ${A(w, reserveAddr)} (qui dort) et ${amt(giftV, 'TON')} sur ${A(w, giftAddr)} (cartes cadeaux ${shopName}), dépose ${amt(collectedUsdt, 'USDT')} et ${amt(exTonV, 'TON')} sur ${destName} (commentaire ${exMemo}), puis envoie en dernier l'essentiel, ${amt(toPocket, 'TON')}, à TonPocket (commentaire ${pocketMemo}), où les fonds sortent du champ de la blockchain.\n\n` +
          `Fausses pistes : les mises de côté et les cartes cadeaux, la poussière envoyée par des sosies du relais, les dépôts d'autres clients de ${destName} au même moment, et l'identifiant Telegram de la victime porté en commentaire.\n\n` +
          `À retenir : sur TON, comme sur XRP, les services utilisent souvent une adresse partagée et identifient le client par le commentaire. Trois commentaires de paiement circulent dans ce dossier, avec des sens très différents : l'identifiant Telegram de la victime (sans valeur pour la réquisition), le compte TonPocket et le compte ${destName} de l'escroc ; un quatrième, plus ancien, rattache le relais au pseudonyme @${admin}. Quatre demandes sont possibles : TonPocket et ${destName} (commentaire, hash, dates, montants), Gramota (enchère n° ${auctionNo}) et ${adminEx.entity.name} (retraits vers le relais). Pensez à décliner l'adresse sous ses différentes formes (EQ, UQ, brute).`,
      },
      hints: [
        'Partez du portefeuille de la victime et ouvrez son premier paiement : le destinataire est l\'adresse de collecte.',
        'L\'adresse de collecte ne fait que deux types de sorties : des petits « bonus » aux victimes et le transfert vers un relais.',
        'Le relais a un passé : remontez ses premières transactions et lisez les commentaires de ses paiements.',
        'Depuis le relais, les fonds partent vers deux adresses neuves et deux adresses partagées de services. Dans le détail de chaque transaction, lisez le champ « Commentaire (memo) ».',
        'L\'exchange reçoit de nombreux dépôts au même moment : ne retenez que ceux qui viennent du relais.',
        'Pour les autres victimes, regardez d\'où viennent les fonds des portefeuilles payeurs : certains sortent tout juste d\'un exchange.',
      ],
    }
  },
}
