import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY } from '../engine/patterns'
import { lookalike } from '../engine/addressgen'
import { ASSETS, fmtUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import { dusting, personalSpending } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fakePhone, fmtDate, procedureFor } from './util'

const MIN = 60
const MP_FEE = 0.025
const ROYALTY = 0.05
const eth = (v: number) => roundAsset('ETH', v)

/** Heure de bureau (≈ 9 h – 17 h à Paris) le jour de `t` : plaintes, réponses et notes ne sont pas datées de la nuit. */
const office = (t: number) => Math.floor(t / 86400) * 86400 + 8 * 3600 + (t % (7 * 3600))

function dollars(v: number): string {
  return `${Math.round(v).toLocaleString('fr-FR')} $`
}

function heure(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

/** Tarif fixe du « service opérateur » selon l'opérateur de la victime (ETH). */
const OPERATORS = [
  { name: 'Telvia Mobile', price: 2 },
  { name: 'Ondéo Télécom', price: 1.5 },
  { name: 'Axéa Mobile', price: 2.5 },
] as const
const COLLECTIONS = ['Chats de Gouttière', 'Pixel Marins', 'Gargouilles Club', 'Néon Bastille'] as const

export const ethAccountTakeover: ScenarioTemplate = {
  id: 'eth-account-takeover',
  title: 'SIM swap : un compte Coinbase vidé',
  tagline: 'Une ligne détournée, un compte réinitialisé, de l\'ETH éparpillé… et un butin qui finit en NFT.',
  description:
    'Un particulier perd soudain le réseau sur son téléphone : sa ligne a été transférée sur une autre carte SIM. Dans la foulée, son compte Coinbase est réinitialisé et vidé vers une adresse neuve. Suivez l\'ETH et les USDC à travers Uniswap, triez l\'éclatement du butin (Monero, réserve, prestataire du SIM swap, trois transferts jumeaux), trouvez l\'erreur d\'hygiène opérationnelle de l\'attaquant et la place de marché NFT où il a dépensé sa part.',
  difficulty: 3,
  chains: ['eth', 'xmr'],
  skills: ['evm', 'tokens', 'dex', 'privacy', 'requisition', 'osint', 'poisoning'],
  estMinutes: 75,
  lessons: ['comptes-evm', 'dex-defi', 'monero', 'requisitions', 'analyse-comportementale'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victim = fakePerson(r)
    const g = victim.g
    const city = fakeCity(r)
    const phone = fakePhone(r)
    const op = r.pick(OPERATORS)
    const operator = op.name
    const shopCity = r.pick(['Paris (10e)', 'Saint-Denis', 'Marseille (3e)', 'Créteil', 'Villeurbanne'])
    const leakSite = r.pick(['ModaLine', 'CasaDéco', 'SportiZone', 'TechnoMarché'])
    const collection = r.pick(COLLECTIONS)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const cb = exchange(w, 'coinbase', 'eth')
    const uni = dex(w, 'uniswap', 'eth')
    const exKey = r.pick(['binance', 'kraken'] as const)
    const ex = exchange(w, exKey, 'eth')
    const other = exchange(w, exKey === 'binance' ? 'kraken' : 'binance', 'eth')
    const cnE = w.entity('changenow')
    const cnHot = w.addr('eth', { entity: cnE, label: 'ChangeNOW — Hot Wallet ETH', tags: ['liquid', 'hot'] })
    const cnDeposit = () => w.addr('eth', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    /** Commande ETH → XMR : dépôt puis rapatriement vers le hot wallet ; le paiement en XMR n'est pas observable. */
    const xmrOrder = (from: string, value: number, time: number, asset: AssetId = 'ETH') => {
      const deposit = cnDeposit()
      const depositTx = w.transfer({ time, from, to: deposit, value, asset })
      const sweepTx = w.transfer({ time: time + r.int(3, 25) * MIN, from: deposit, to: cnHot, value, asset, method: 'sweep', tags: ['sweep'] })
      return { deposit, depositTx, sweepTx }
    }
    const mosaique = w.entity('mosaique')
    // Casino en ligne sans KYC où se perd une des branches jumelles
    const casinoE = w.customEntity({ name: r.pick(['LuckyLynx Casino', 'Vegas Nova', 'Roulette Royale']), category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant l\'ETH, sans vérification d\'identité.' })
    const market = w.addr('eth', { entity: mosaique, label: 'Mosaïque Market : contrat d\'échange', contract: { name: 'Mosaïque Exchange', type: 'router' } })
    const mpFee = w.addr('eth', { entity: mosaique, label: 'Mosaïque Market : commissions', tags: ['liquid'] })
    const artistE = w.customEntity({ name: `Créateur de la collection « ${collection} »`, category: 'individual' })
    const royalty = w.addr('eth', { entity: artistE })
    const sale = (buyer: string, seller: string, price: number, tokenId: number, time: number): Tx =>
      w.multi({
        time, signer: buyer, method: `matchOrders — transferFrom (« ${collection} » #${tokenId})`, tags: ['nft-sale'],
        legs: [
          { from: buyer, to: market, value: price, asset: 'ETH' },
          { from: market, to: seller, value: eth(price * (1 - MP_FEE - ROYALTY)), asset: 'ETH' },
          { from: market, to: mpFee, value: eth(price * MP_FEE), asset: 'ETH' },
          { from: market, to: royalty, value: eth(price * ROYALTY), asset: 'ETH' },
        ],
      })

    const atkE = w.customEntity({ name: 'Auteur du SIM swap (inconnu)', category: 'suspect' })
    const vendorE = w.customEntity({ name: '« Services opérateur » (Telegram, inconnu)', category: 'suspect' })
    const A1 = w.addr('eth', { entity: atkE }) // adresse neuve ajoutée au compte Coinbase
    const A2 = w.addr('eth', { entity: atkE }) // part mise de côté
    const Z = w.addr('eth', { entity: atkE }) // portefeuille personnel de l'attaquant (erreur opsec)
    const H = w.addr('eth', { entity: atkE }) // relais vers le portefeuille personnel
    const vendor = w.addr('eth', { entity: vendorE }) // prestataire du SIM swap

    // ── Historique du portefeuille personnel Z (avant les faits) ─────────────
    const zW1 = ex.withdraw(Z, eth(r.float(0.8, 1.8)), w.at(-r.int(60, 90) * 24))
    const zSwap = uni.swap({ trader: Z, assetIn: 'ETH', amountIn: eth(r.float(0.05, 0.15)), assetOut: 'USDT', time: w.at(-r.int(45, 58) * 24) })
    const oldId = r.int(100, 3999)
    const zOldNft = sale(Z, w.addr('eth'), eth(r.float(0.15, 0.35)), oldId, w.at(-r.int(30, 42) * 24))
    const zW2 = ex.withdraw(Z, eth(r.float(0.4, 1.1)), w.at(-r.int(6, 14) * 24))
    // Habitudes du titulaire : un VPN et des eSIM de voyage, payés en ETH
    const vpnE = w.customEntity({ name: r.pick(['Proxima VPN', 'Veilleur VPN']), category: 'merchant', known: true, description: 'Fournisseur VPN payable en crypto (fictif) ; conserve l\'adresse électronique du compte.' })
    const esimE = w.customEntity({ name: r.pick(['SimVoyage', 'GlobeSIM']), category: 'merchant', known: true, description: 'Vente d\'eSIM de données pour l\'étranger, payables en crypto (fictif) ; conserve l\'adresse électronique de commande et l\'identifiant de l\'appareil.' })
    const zSpend = personalSpending(w, Z, { start: w.at(-50 * 24), end: w.at(-3 * 24), n: r.int(2, 3), merchants: [vpnE, esimE], maxUsd: 180, asset: 'ETH' })

    // ── Le prestataire « services opérateur » : clients payant au tarif fixe ──
    const clientPays: Tx[] = []
    for (let i = 0; i < r.int(6, 9); i++) {
      const c = w.addr('eth')
      const t = w.at(Math.round(r.float(-40, 12) * 24) + r.float(-6, 6))
      r.pick([cb, other, ex]).withdraw(c, eth(r.float(4, 30)), t - r.int(40, 180) * MIN, 'ETH')
      clientPays.push(w.transfer({ time: t, from: c, to: vendor, value: r.pick([1.5, 2, 2.5]), asset: 'ETH' }))
    }

    // ── L'attaque ────────────────────────────────────────────────────────────
    // En soirée (≈ 22 h – 23 h, heure de Paris)
    const simT = Math.floor(w.t0 / DAY) * DAY + Math.round(r.float(20.2, 21.2) * HOUR)
    const resetT = simT + r.int(8, 15) * MIN
    const loginT = resetT + r.int(2, 5) * MIN
    const addT = loginT + r.int(3, 8) * MIN
    const usdcW = roundAsset('USDC', r.float(15000, 80000))
    const ethW = eth(r.float(6, 22))
    const lossUsd = usd('ETH', ethW) + usdcW

    const wdUsdc = cb.withdraw(A1, usdcW, addT + r.int(4, 10) * MIN, 'USDC')
    const gasV = eth(r.float(0.03, 0.08))
    const gasTx = w.transfer({ time: wdUsdc.time + r.int(4, 12) * MIN, from: Z, to: A1, value: gasV, asset: 'ETH' })
    const sw = uni.swap({ trader: A1, assetIn: 'USDC', amountIn: usdcW, assetOut: 'ETH', time: gasTx.time + r.int(3, 10) * MIN })
    const wdEth = cb.withdraw(A1, ethW, sw.tx.time + r.int(8, 25) * MIN, 'ETH')

    // Éclatement de l'ETH
    const splitT = wdEth.time + Math.round(r.float(1.5, 3) * HOUR)
    const total = w.balanceOf(A1, 'ETH')
    const avail = total - op.price - 0.05
    const cnV = eth(avail * r.float(0.56, 0.6))
    const order = xmrOrder(A1, cnV, splitT)
    const vendorTx = w.transfer({ time: splitT + r.int(6, 18) * MIN, from: A1, to: vendor, value: op.price, asset: 'ETH' })
    const a2V = eth(avail * r.float(0.12, 0.15))
    const a2Tx = w.transfer({ time: vendorTx.time + r.int(8, 25) * MIN, from: A1, to: A2, value: a2V, asset: 'ETH' })
    // Trois transferts jumeaux : un seul (vers le relais H) mène au portefeuille personnel
    const zV = eth(avail * r.float(0.05, 0.06))
    const tTw = a2Tx.time + r.int(30, 70) * MIN
    const T1 = w.addr('eth', { entity: atkE })
    const T2 = w.addr('eth', { entity: atkE })
    const offs = r.shuffle([0, r.int(4, 22) * (r.chance(0.5) ? 1 : -1), r.int(4, 22) * (r.chance(0.5) ? 1 : -1)])
    const hTx = w.transfer({ time: tTw + offs[0] * MIN, from: A1, to: H, value: zV, asset: 'ETH' })
    const t1Tx = w.transfer({ time: tTw + offs[1] * MIN + 37, from: A1, to: T1, value: eth(zV * (1 + r.float(0.001, 0.004))), asset: 'ETH' })
    const t2Tx = w.transfer({ time: tTw + offs[2] * MIN - 41, from: A1, to: T2, value: eth(zV * (1 - r.float(0.001, 0.004))), asset: 'ETH' })
    const left = eth(w.balanceOf(A1, 'ETH'))

    // T2 : joué sur un casino en ligne ; T1 : dort
    const orbitDep = w.addr('eth', { entity: casinoE, label: `${casinoE.name} — Adresse de dépôt`, tags: ['deposit'] })
    const t2a = eth(w.balanceOf(T2, 'ETH') * r.float(0.4, 0.6))
    w.transfer({ time: t2Tx.time + Math.round(r.float(3, 10) * HOUR), from: T2, to: orbitDep, value: t2a, asset: 'ETH' })
    w.transfer({ time: t2Tx.time + Math.round(r.float(14, 30) * HOUR), from: T2, to: orbitDep, value: eth(w.balanceOf(T2, 'ETH') - 0.004), asset: 'ETH' })

    // H relaie vers le portefeuille personnel
    const hzTx = w.transfer({ time: hTx.time + Math.round(r.float(1, 3) * HOUR), from: H, to: Z, value: eth(zV - 0.002), asset: 'ETH' })

    // Fausse piste : adresses sosies (address poisoning automatisé)
    const poison = w.addr('eth', { addr: lookalike(r, 'eth', A(w, Z), 4, 4) })
    w.fundAccount(poison, 0.004, 'ETH', hzTx.time - r.int(2, 8) * DAY)
    w.fundAccount(poison, 1, 'USDC', hzTx.time - r.int(2, 8) * DAY)
    const poisonTx = w.transfer({ time: tTw + r.int(30, 90) * MIN, from: poison, to: A1, value: 0.01, asset: 'USDC' })
    dusting(w, Z, { time: hzTx.time + 6 * HOUR, n: r.int(2, 3), spreadH: 20, token: 'USDC' })

    // Le prestataire encaisse ses paiements (hors flux de l'affaire)
    const vendorKit = r.pick([ex, other])
    // (sur le solde détenu à cet instant : les paiements de clients postérieurs ne comptent pas)
    const tCash = splitT + Math.round(r.float(30, 60) * HOUR)
    const vendorHeld = w.txsOf(vendor).filter((t) => t.time < tCash).reduce((s, t) => s + t.transfers.filter((x) => x.asset === 'ETH').reduce((a, x) => a + (x.to === vendor ? x.value : 0) - (x.from === vendor ? x.value : 0), 0), 0)
    const vendorCash = vendorKit.receive(vendor, eth(vendorHeld * r.float(0.55, 0.7)), tCash)

    // Z dépense sa part : deux NFT achetés sur Mosaïque Market
    const nftT1 = hzTx.time + Math.round(r.float(10, 26) * HOUR)
    const zBal = w.balanceOf(Z, 'ETH')
    const p1 = eth(Math.round(zBal * r.float(0.42, 0.5) * 100) / 100)
    const p2 = eth(Math.round(zBal * r.float(0.28, 0.36) * 100) / 100)
    const id1 = r.int(4000, 6999)
    const id2 = r.int(7000, 9999)
    const seller1 = w.addr('eth')
    const seller2 = w.addr('eth')
    const nft1 = sale(Z, seller1, p1, id1, nftT1)
    const nft2 = sale(Z, seller2, p2, id2, nftT1 + Math.round(r.float(2, 7) * HOUR))
    const nftSpent = eth(p1 + p2)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    cb.noise(20, w.at(-3 * 24), w.at(3 * 24), 'ETH')
    cb.noise(12, w.at(-3 * 24), w.at(3 * 24), 'USDC')
    uni.noise(35, w.at(-2 * 24), w.at(2 * 24), [['ETH', 'USDC'], ['ETH', 'USDT'], ['ETH', 'DAI']])
    ex.noise(14, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    other.noise(10, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    // Autres ventes sur Mosaïque Market autour des achats
    for (let i = 0; i < r.int(6, 9); i++) {
      const b = w.addr('eth')
      const t = nftT1 + Math.round(r.float(-30, 30) * HOUR)
      const p = eth(r.float(0.08, 1.2))
      w.fundAccount(b, eth(p + r.float(0.01, 0.3)), 'ETH', t - r.int(2, 72) * HOUR)
      sale(b, w.addr('eth'), p, r.int(100, 9999), t)
    }
    // Autres clients de ChangeNOW (dont un dépôt de montant voisin) et paiements ETH du hot wallet
    for (let i = 0; i < r.int(7, 10); i++) {
      const c = w.addr('eth')
      const close = i === 0
      const v = close ? eth(cnV * r.float(0.9, 1.1)) : eth(r.float(0.2, 12))
      const t = close ? splitT + r.int(-90, 90) * MIN : splitT + Math.round(r.float(-30, 30) * HOUR)
      w.fundAccount(c, eth(v + r.float(0.01, 0.05)), 'ETH', t - r.int(2, 72) * HOUR)
      xmrOrder(c, v, t)
    }
    for (let i = 0; i < r.int(8, 12); i++) {
      w.transfer({ time: splitT + Math.round(r.float(-24, 24) * HOUR), from: cnHot, to: w.addr('eth'), value: eth(r.float(0.1, 9)), asset: 'ETH', method: 'payout' })
    }

    const lossNoticeT = simT + Math.round(r.float(8.5, 10.5) * HOUR)
    const plainteT = office(simT + Math.round(r.float(1.2, 2.5) * DAY))
    const cbRespT = office(plainteT + Math.round(r.float(5, 9) * DAY))
    const opRespT = office(plainteT + Math.round(r.float(3, 6) * DAY))
    const osintT = office(cbRespT + Math.round(r.float(1, 2) * DAY))
    const ip = `203.0.113.${r.int(10, 250)}`
    const imei = `35${r.int(1000, 9999)}${r.int(1000, 9999)}${r.int(1000, 9999)}${r.int(0, 9)}`
    const zAgeDays = Math.round((simT - zW1.time) / DAY)
    const swapToEth = sw.amountOut
    const twinRows = [{ to: H, tx: hTx }, { to: T1, tx: t1Tx }, { to: T2, tx: t2Tx }].sort((a, b) => a.tx.time - b.tx.time)
    const twinFirst = twinRows[0].tx.time
    const twinLast = twinRows[2].tx.time
    const vendorClients = clientPays.length
    const zHeldAfter = eth(w.balanceOf(Z, 'ETH'))
    // Paiements réellement faits par le portefeuille personnel avant les faits
    const zShops = [...new Set(zSpend.addresses.map((a) => w.get(a).entityId).filter((x): x is string => !!x))].map((id) => w.entities.get(id)!.name)
    const zPeople = zSpend.addresses.filter((a) => !w.get(a).entityId).length
    const zPayText = [
      zShops.length ? `des paiements à ${zShops.join(' et ')}` : '',
      zPeople ? (zPeople > 1 ? `${zPeople} virements à des particuliers` : 'un virement à un particulier') : '',
    ].filter(Boolean).join(', ')

    return {
      world: w,
      title: `SIM swap — compte Coinbase vidé (${city})`,
      briefing:
        `Le ${fmtDate(simT, false)} vers ${heure(simT)}, le téléphone ${de(victim.name)} (${city}) affiche soudain « Aucun service ». ${g('Il', 'Elle')} pense à une panne et se couche. Le lendemain matin, sa messagerie contient des alertes de Coinbase : nouvel appareil, nouvelle adresse de retrait, deux retraits. Son compte, sur lequel ${g('il', 'elle')} détenait ${amt(ethW, 'ETH')} et ${amt(usdcW, 'USDC')}, est vide.\n\n` +
        `L'opérateur ${operator} (nom fictif) confirme que la ligne a été transférée sur une nouvelle carte SIM le soir même : c'est un SIM swap. Avec le numéro, l'attaquant a reçu les codes SMS de réinitialisation et de double authentification du compte de la victime ; Coinbase n'a pas été piraté.\n\n` +
        `Les réponses de Coinbase et de l'opérateur sont arrivées. Suivez les fonds depuis l'adresse de retrait, inventoriez chaque part du butin (échangeur, réserve, rémunération du prestataire, part personnelle), écartez les fausses pistes et cherchez l'erreur de l'attaquant qui permettrait de l'identifier.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victim.name,
          body:
            `« Le soir du ${fmtDate(simT, false)}, mon téléphone (${phone}) n'avait plus de réseau. Je n'ai reçu aucun appel ni SMS suspect, je n'ai donné aucun code à personne. Le lendemain vers ${heure(lossNoticeT)}, j'ai vu les courriels de Coinbase et de ma messagerie : changement de mot de passe, connexion depuis un appareil Android inconnu, ajout d'une adresse de retrait, puis deux retraits.\n\n` +
            `J'avais sur mon compte ${amt(ethW, 'ETH')} et ${amt(usdcW, 'USDC')}, accumulés depuis plusieurs années. La double authentification de mon compte se faisait par SMS. »`,
        },
        {
          id: 'coinbase', type: 'note', title: 'Réponse de Coinbase (portail forces de l\'ordre)', date: cbRespT, author: 'Coinbase — Équipe des demandes des forces de l\'ordre',
          body:
            `Compte : ${victim.name}, ${g('client', 'cliente')} depuis ${new Date((simT - r.int(3, 6) * 365 * DAY) * 1000).getUTCFullYear()}, KYC vérifié. Double authentification : SMS au ${phone}.\n\n` +
            `Journal des événements (heure de Paris) :\n` +
            `• ${fmtDate(resetT)} — réinitialisation du mot de passe, code envoyé par SMS au numéro du compte\n` +
            `• ${fmtDate(loginT)} — connexion depuis un nouvel appareil (Android), IP ${ip} (sortie d'un service VPN commercial d'après nos fournisseurs de données)\n` +
            `• ${fmtDate(addT)} — ajout de l'adresse de retrait ${A(w, A1)}\n` +
            `• ${fmtDate(wdUsdc.time)} — retrait de ${amt(usdcW, 'USDC')} (ERC-20), transaction ${wdUsdc.hash}\n` +
            `• ${fmtDate(wdEth.time)} — retrait de ${amt(ethW, 'ETH')} après contrôle automatique, transaction ${wdEth.hash}\n\n` +
            `Le compte a été verrouillé à la demande du client le ${fmtDate(lossNoticeT + r.int(20, 90) * MIN)}. Les fonds ayant quitté la plateforme vers une adresse externe, aucun gel n'est possible de notre côté.`,
        },
        {
          id: 'operateur', type: 'email', title: `Courriel ${de(operator)} — réponse à réquisition`, date: opRespT, author: `${operator} — Service des obligations légales`,
          body:
            `Objet : ligne ${phone} — changement de carte SIM\n\n` +
            `Le ${fmtDate(simT)}, une nouvelle carte SIM a été activée sur la ligne ${de(victim.name)}, à la suite d'une demande en boutique à ${shopCity}. Le demandeur a présenté une carte d'identité au nom du titulaire ; la copie conservée présente des incohérences (photographie, police de caractères) et paraît falsifiée.\n\n` +
            `La nouvelle SIM a fonctionné dans un terminal Android (IMEI ${imei}) jusqu'au lendemain ${heure(lossNoticeT + 40 * MIN)}, heure de la suspension à la demande du client. Ce même terminal a été associé dans les 30 jours précédents à deux autres lignes, elles aussi concernées par un changement de SIM contesté. Les images de vidéoprotection de la boutique sont conservées 30 jours.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT — exposition de la victime et « services opérateur »', date: osintT, author: 'Cellule d\'appui — analyse numérique',
          body:
            `1. L'adresse e-mail et le numéro ${de(victim.name)} figurent dans la fuite de données du site marchand ${leakSite} (fictif), diffusée sur un forum quelques mois avant les faits. ${g('Il', 'Elle')} a publié sur un réseau social plusieurs messages évoquant son « stack ETH ».\n` +
            `2. Une chaîne Telegram francophone propose des « services opérateur » (changement de SIM sur commande). Tarifs relevés, payables en ETH « après livraison », depuis l'adresse qui a reçu le butin : ${OPERATORS.map((o) => `${o.name} ${String(o.price).replace('.', ',')} ETH`).join(' · ')}. L'adresse de paiement n'est communiquée qu'en message privé.\n` +
            `3. L'adresse de retrait ${A(w, A1)} n'a aucune étiquette et aucun historique avant les faits : c'est une adresse jetable. Aucune autre adresse du dossier n'apparaît dans les bases publiques ou sur les réseaux sociaux.\n\n` +
            `Rappel méthodologique : une adresse jetable n'a pas de passé, un portefeuille personnel en a un (retraits réguliers d'un même exchange, petits swaps, achats, ancienneté). Toute adresse qui « aide » l'adresse jetable mérite qu'on regarde son histoire. Des micro-envois d'adresses sosies sont fréquents après tout gros mouvement : ils ne prouvent aucun lien.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse de retrait l\'attaquant a-t-il ajoutée au compte Coinbase de la victime ?',
          answer: [A1],
          hint: 'Elle figure dans le journal des événements transmis par Coinbase.',
          explanation: `${A(w, A1)}, ajoutée le ${fmtDate(addT)}, ${Math.round((addT - simT) / MIN)} minutes après l'activation de la nouvelle SIM. Elle n'a aucun historique avant les retraits : adresse créée pour l'occasion. Ses entrées : les deux retraits Coinbase, un peu d'ETH venu d'une autre adresse, le swap Uniswap et une poussière d'USDC envoyée par une adresse sosie.`,
        },
        {
          id: 'o2', type: 'amount', points: 8, unit: 'USD', tolerance: 0.02,
          prompt: 'Quel est le montant total détourné, en dollars (au cours de l\'outil) ?',
          answer: lossUsd,
          hint: 'Additionnez la valeur des deux retraits : l\'ETH au cours affiché par l\'outil, l\'USDC à 1 $.',
          explanation: `${amt(ethW, 'ETH')} × ${ASSETS.ETH.usd.toLocaleString('fr-FR')} $ ≈ ${dollars(usd('ETH', ethW))}, plus ${amt(usdcW, 'USDC')} ≈ ${dollars(usdcW)} : environ ${dollars(lossUsd)} au total. Dans le rapport, préciser le cours retenu et sa date : le préjudice en euros dépend du cours au jour des faits.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH l\'attaquant a-t-il obtenus en convertissant les USDC volés ?',
          answer: swapToEth,
          hint: 'Ouvrez la transaction de swap de l\'adresse de retrait et lisez la jambe ETH qui revient au trader.',
          explanation: `La transaction ${sw.tx.hash.slice(0, 14)}… échange sur Uniswap ${amt(usdcW, 'USDC')} contre ${amt(swapToEth, 'ETH')}, soit environ ${dollars(usd('ETH', swapToEth))} après la commission du pool et le glissement de prix. Pourquoi si vite ? L'USDC est un jeton centralisé que Circle peut geler ; l'ETH natif, lui, ne se gèle pas. Ajoutés aux ${amt(ethW, 'ETH')} retirés directement, ils forment le stock d'ETH que l'attaquant éclate ensuite.`,
        },
        {
          id: 'o4', type: 'tx', points: 10,
          prompt: 'L\'essentiel de l\'ETH part vers un échangeur instantané contre du Monero. Quelle transaction de dépôt faut-il citer dans la réquisition à ce service ?',
          answer: [order.depositTx.id],
          hint: 'Suivez la plus grosse sortie d\'ETH de l\'adresse de retrait : une adresse de dépôt aussitôt reversée à un hot wallet étiqueté.',
          explanation:
            `Le ${fmtDate(splitT)}, ${amt(cnV, 'ETH')} (≈ ${fmtUsd(usd('ETH', cnV))}) partent sur ${A(w, order.deposit)}, adresse de dépôt ChangeNOW, balayée ensuite vers son hot wallet. Aucun paiement ChangeNOW en ETH ne revient ensuite vers une adresse du dossier : la contrepartie est payée en XMR, invisible. Le mur Monero arrête le suivi, pas l'enquête : avec le hash ${order.depositTx.hash}, l'échangeur peut retrouver la commande (adresse XMR de destination, horodatages, IP, éventuel e-mail). ${procedureFor(cnE)} Attention au leurre : un autre client dépose un montant voisin à la même période, depuis une adresse sans lien avec l'affaire.`,
        },
        {
          id: 'o13', type: 'address', points: 10,
          prompt: 'Une sortie de l\'adresse de retrait rémunère le prestataire qui a réalisé le SIM swap. Quelle adresse a été payée ?',
          answer: [vendor],
          hint: `Rapprochez les tarifs relevés dans la note OSINT de l'opérateur de la victime, puis cherchez parmi les sorties de l'adresse de retrait un montant rond qui y correspond. Regardez ensuite qui d'autre paie cette adresse.`,
          explanation: `La ligne de la victime est chez ${operator}, facturé ${String(op.price).replace('.', ',')} ETH par la chaîne Telegram. Le ${fmtDate(vendorTx.time)}, l'adresse de retrait envoie exactement ${amt(op.price, 'ETH')} à ${A(w, vendor)}. Cette adresse reçoit par ailleurs ${vendorClients} paiements de 1,5, 2 ou 2,5 ETH, chacun venu d'une adresse qui vient elle-même de recevoir un retrait d'exchange : la signature d'autres SIM swaps payés au même tarif. Le prestataire encaisse ensuite une partie de ses recettes chez ${vendorKit.entity.name} (adresse de dépôt ${A(w, vendorCash.deposit).slice(0, 12)}…) : une piste d'identification distincte, qui peut aussi révéler d'autres victimes.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Une part importante de l\'ETH est mise de côté sur une adresse de l\'attaquant, qui ne bouge plus. Laquelle ?',
          answer: [A2],
          hint: 'Parmi les sorties de l\'adresse de retrait, cherchez un envoi vers une adresse neuve qui ne dépense rien ensuite, nettement plus gros que les trois petits transferts jumeaux.',
          explanation: `Le ${fmtDate(a2Tx.time)}, ${A(w, A1)} envoie ${amt(a2V, 'ETH')} vers ${A(w, A2)}, adresse sans historique ni dépense ultérieure : une réserve de l'attaquant. Elle n'a ni étiquette ni lien avec un service, mais le transfert direct depuis l'adresse de retrait suffit à la rattacher au butin. Elle ne se confond pas avec ${A(w, T1).slice(0, 12)}…, qui dort aussi mais n'a reçu qu'un des trois petits transferts jumeaux.`,
        },
        {
          id: 'o9', type: 'choice', points: 8,
          prompt: 'Que faire des ETH immobilisés sur cette adresse de réserve ?',
          ...choice(r,
            'La placer sous surveillance (alerte sur tout mouvement) : l\'ETH natif n\'est gelable par personne, une réquisition suivra s\'il atteint une plateforme',
            [
              'Demander à Circle, émetteur de l\'USDC, de geler les ETH de l\'adresse',
              'Demander à Coinbase de geler l\'adresse, puisque les fonds proviennent de ses retraits',
              'Demander à Uniswap de bloquer l\'adresse, qui a utilisé son routeur',
            ]),
          hint: 'Qui pourrait techniquement bloquer de l\'ETH natif détenu dans un portefeuille auto-hébergé ?',
          explanation: `L'ETH est l'actif natif d'Ethereum : aucun émetteur ne peut le bloquer, contrairement à l'USDC (Circle) ou à l'USDT (Tether). Coinbase n'a plus la main sur des fonds retirés, et un DEX n'a aucun pouvoir sur les adresses de ses utilisateurs. La seule mesure utile est la surveillance : dès que ${A(w, A2)} enverra ses ${amt(a2V, 'ETH')} vers un exchange ou un échangeur, une demande de gel et une réquisition pourront viser le compte destinataire. Une saisie directe supposerait de retrouver les clés (perquisition).`,
        },
        {
          id: 'o5', type: 'address', points: 11,
          prompt: 'Quelle adresse trahit l\'attaquant (erreur d\'hygiène opérationnelle) ?',
          answer: [Z],
          hint: 'Avant le swap, l\'adresse de retrait n\'a pas d\'ETH pour payer le gas. Qui lui en envoie, et quelle est l\'histoire de cette adresse ?',
          explanation:
            `Pour payer le gas du swap, il fallait de l'ETH sur ${A(w, A1)}, qui n'en avait pas encore : ${A(w, Z)} lui envoie ${amt(gasV, 'ETH')} le ${fmtDate(gasTx.time)}, ${Math.round((sw.tx.time - gasTx.time) / MIN)} minutes avant le swap. Cette adresse n'a rien de jetable : active depuis ${zAgeDays} jours, alimentée par des retraits ${ex.entity.name} (${amt(zW1.transfers[0].value, 'ETH')} puis ${amt(zW2.transfers[0].value, 'ETH')}), un petit swap ETH → USDT, un achat de NFT sur Mosaïque Market, ${zPayText} : le profil d'un portefeuille personnel. ` +
            `Le leurre ${A(w, poison)}, qui imite ses premiers et derniers caractères, n'a envoyé que ${amt(0.01, 'USDC')} de poussière à l'adresse de retrait (address poisoning automatisé) : il n'a jamais financé l'attaquant.`,
        },
        {
          id: 'o15', type: 'tx', points: 12,
          prompt: `Entre ${heure(twinFirst)} et ${heure(twinLast)}, trois transferts d'environ ${amt(zV, 'ETH')} quittent l'adresse de retrait. Lequel finit dans le portefeuille personnel de l'attaquant ?`,
          answer: [hTx.id],
          hint: 'Les montants sont quasi identiques : suivez chaque destinataire jusqu\'à sa première dépense.',
          explanation:
            `${twinRows.map((x) => `${heure(x.tx.time)} → ${A(w, x.to).slice(0, 12)}… (${amt(x.tx.transfers[0].value, 'ETH')})`).join(' ; ')}. ` +
            `${A(w, H).slice(0, 12)}… reverse ${amt(hzTx.transfers[0].value, 'ETH')} à ${A(w, Z).slice(0, 12)}…, l'adresse qui avait payé le gas, ${Math.round((hzTx.time - hTx.time) / 60)} minutes plus tard : c'est la part personnelle, passée par un relais pour casser le lien direct. ${A(w, T1).slice(0, 12)}… ne bouge plus (réserve), et ${A(w, T2).slice(0, 12)}… est jouée sur ${casinoE.name}, un casino sans KYC : deux branches sans issue. Le montant ne départage rien ; c'est le comportement ultérieur qui désigne la continuation.`,
        },
        {
          id: 'o16', type: 'entity', points: 10,
          prompt: 'Où le portefeuille personnel dépense-t-il l\'essentiel de sa part ?',
          answer: ['mosaique'],
          hint: 'Suivez les sorties du portefeuille personnel après l\'arrivée de sa part : ce sont des appels à un contrat étiqueté, qui redistribue le paiement à plusieurs adresses.',
          explanation: `${A(w, Z)} achète deux NFT de la collection « ${collection} » (#${id1} et #${id2}) sur Mosaïque Market, le contrat d'échange reversant le prix aux vendeurs moins la commission de la place de marché et les redevances du créateur. Les vendeurs, sans lien avec l'affaire, sont payés de bonne foi : le butin est désormais converti en NFT détenus par l'attaquant. Mosaïque Market ne détient pas les fonds et ne peut pas les geler, mais connaît ses utilisateurs : e-mail, adresses IP, portefeuilles connectés au même compte, historique (dont l'achat #${oldId} du ${fmtDate(zOldNft.time, false)}). ${procedureFor(mosaique)}`,
        },
        {
          id: 'o14', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le portefeuille personnel dépense-t-il en NFT après avoir reçu sa part du butin ?',
          answer: nftSpent,
          hint: 'Additionnez les deux paiements envoyés au contrat d\'échange de la place de marché après la réception de la part (pas l\'achat antérieur aux faits).',
          explanation: `${amt(p1, 'ETH')} le ${fmtDate(nft1.time)} (#${id1}) et ${amt(p2, 'ETH')} le ${fmtDate(nft2.time)} (#${id2}), soit ${amt(nftSpent, 'ETH')}${nftSpent > hzTx.transfers[0].value ? `, davantage que la part reçue (${amt(hzTx.transfers[0].value, 'ETH')}) : l'attaquant mêle le butin à ses propres fonds` : `, l'essentiel de la part reçue (${amt(hzTx.transfers[0].value, 'ETH')}), mêlée au solde propre du portefeuille`}. L'achat du ${fmtDate(zOldNft.time, false)}, antérieur aux faits, ne compte pas. Il reste ${amt(zHeldAfter, 'ETH')} sur le portefeuille.`,
        },
        {
          id: 'o6', type: 'entity', points: 9,
          prompt: 'Quelle plateforme peut identifier par son KYC le titulaire du portefeuille personnel ?',
          answer: [exKey],
          hint: 'Regardez d\'où viennent les premiers ETH de cette adresse.',
          explanation: `${ex.entity.name} a effectué les retraits vers ${A(w, Z)} (${fmtDate(zW1.time, false)} et ${fmtDate(zW2.time, false)}) : son client est identifié (KYC), avec ses IP et appareils de connexion, à comparer avec l'IMEI, les données de l'opérateur et les journaux de Mosaïque Market. ${procedureFor(ex.entity)} ${other.entity.name}, qui peut apparaître sur le graphe (flux de fond, retraits vers des clients du prestataire, encaissements), n'a jamais alimenté ce portefeuille.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Quelle conclusion porter au rapport ?',
          ...choice(r,
            `Le titulaire du compte ${ex.entity.name} relié à l'adresse qui a payé le gas est un suspect sérieux ; l'attribution reste à corroborer (KYC ${ex.entity.name}, journaux Mosaïque Market, commande ChangeNOW, téléphonie, vidéoprotection)`,
            [
              'Coinbase a été piraté : la plateforme est responsable du détournement et doit être poursuivie',
              'Les fonds sont passés en Monero et en NFT : plus rien ne peut être établi, le dossier doit être classé',
              `Le titulaire du compte ${ex.entity.name} est l'auteur du SIM swap avec certitude : la blockchain le prouve à elle seule`,
            ]),
          hint: 'Distinguez ce que prouve la blockchain (un lien entre adresses et des comptes) de ce qu\'il reste à établir (qui a agi).',
          explanation:
            `Le lien on-chain est fort (gas fourni ${Math.round((sw.tx.time - gasTx.time) / MIN)} minutes avant le swap, part du butin reversée via un relais, achats de NFT avec cette part), mais il désigne le titulaire d'un compte, pas forcément l'auteur des faits : prête-nom, portefeuille partagé ou revendu restent possibles. On le présente comme une hypothèse étayée, à confirmer par les réquisitions (${ex.entity.name}, Mosaïque Market, ChangeNOW), la téléphonie (IMEI ${imei}, autres lignes détournées) et les images de la boutique. Le prestataire payé ${String(op.price).replace('.', ',')} ETH est un coauteur probable distinct. Coinbase n'est pas en cause : c'est le compte de la victime qui a été compromis par le détournement de sa ligne.`,
        },
      ],
      truth: {
        path: [zW1.id, zSwap.tx.id, zW2.id, wdUsdc.id, gasTx.id, sw.tx.id, wdEth.id, order.depositTx.id, order.sweepTx.id, vendorTx.id, a2Tx.id, hTx.id, hzTx.id, nft1.id, nft2.id],
        addresses: [A1, Z, A2, H, vendor, order.deposit, market],
        debrief:
          `1. Le ${fmtDate(simT)}, un complice obtient en boutique, avec une fausse carte d'identité, une nouvelle SIM pour la ligne ${de(victim.name)}. La victime, exposée par une fuite de données et ses publications, perd le réseau.\n` +
          `2. Avec les codes SMS, l'attaquant réinitialise le mot de passe Coinbase de la victime, se connecte via un VPN, ajoute ${A(w, A1)} et retire ${amt(usdcW, 'USDC')} puis ${amt(ethW, 'ETH')} (≈ ${fmtUsd(lossUsd)}).\n` +
          `3. Erreur d'hygiène opérationnelle : faute d'ETH pour le gas, il envoie ${amt(gasV, 'ETH')} depuis ${A(w, Z)}, son portefeuille personnel alimenté par ${ex.entity.name}. Il convertit ensuite les USDC en ${amt(swapToEth, 'ETH')} sur Uniswap.\n` +
          `4. Éclatement : ${amt(cnV, 'ETH')} chez ChangeNOW contre du XMR (fin du suivi on-chain), ${amt(op.price, 'ETH')} au prestataire des « services opérateur » (${A(w, vendor)}, payé par ${vendorClients} autres clients au même tarif), ${amt(a2V, 'ETH')} mis de côté sur ${A(w, A2)}, puis trois transferts jumeaux d'environ ${amt(zV, 'ETH')} : l'un vers le relais ${A(w, H)}, reversé au portefeuille personnel, un autre qui dort, un dernier joué sur ${casinoE.name}. Il reste ${amt(left, 'ETH')} sur l'adresse de retrait.\n` +
          `5. Le portefeuille personnel dépense ${amt(nftSpent, 'ETH')} en deux NFT « ${collection} » sur Mosaïque Market, place de marché française qui conserve e-mail, IP et portefeuilles connectés.\n\n` +
          `À retenir : derrière un mur Monero, on exploite les bords (hash de dépôt réquisitionnable chez l'échangeur) et surtout les erreurs : l'origine du gas d'une adresse jetable est l'un des pivots les plus productifs. Face à des transferts jumeaux, seul le devenir de chaque destinataire tranche. Un achat de NFT n'efface pas la trace : la place de marché, même sans garde des fonds, détient des données d'identification. Côté prévention, la double authentification par SMS est vulnérable au SIM swap ; une application d'authentification ou une clé de sécurité la remplace avantageusement.`,
      },
      hints: [
        'L\'adresse de retrait figure dans la réponse de Coinbase : ouvrez ses flux entrants. Avant le swap, une entrée d\'ETH ne vient pas de Coinbase.',
        'Un swap USDC → ETH se lit en jambes : USDC du trader vers le pool, ETH du pool vers le routeur puis vers le trader. Suivez ensuite les sorties d\'ETH une par une, de la plus grosse à la plus petite.',
        'Un montant rond qui correspond à un tarif publié désigne un paiement de prestation ; trois montants identiques à quelques minutes d\'intervalle se départagent par ce que fait chaque destinataire ensuite.',
        'Côté Monero, rien à suivre : le seul fil est le hash du dépôt chez l\'échangeur. Pour identifier l\'auteur, remontez l\'historique de l\'adresse qui a payé le gas et regardez où elle dépense sa part.',
      ],
    }
  },
}
