import { World, type Tx } from '../engine/world'
import { dex, exchange, privacyPool, HOUR } from '../engine/patterns'
import { aggregator, approve, failedTx, permit, transferFrom } from '../engine/defi'
import { tokenContract } from '../engine/evm'
import { fromUsd, roundAsset, type AssetId } from '../engine/chains'
import { dusting, personalSpending, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'
// Élision devant un prénom (« d'Aurélie », mais « de Yannick »)
const deN = (n: string) => (/^Y/.test(n) ? `de ${n}` : de(n))

const MIN = 60
const eth = (v: number) => roundAsset('ETH', v)
const cents = (v: number) => Math.round(v * 100) / 100
/** Durée lisible : « 45 minutes », « 2 h 05 ». */
const dur = (s: number) => {
  const m = Math.max(1, Math.round(s / 60))
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''}`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm ? `${h} h ${String(mm).padStart(2, '0')}` : `${h} h`
}
const parisDay = (t: number) => new Date(t * 1000).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })

export const evmApproveDrain: ScenarioTemplate = {
  id: 'approve-drain',
  title: 'L\'autorisation piégée',
  tagline: 'Un approve illimité, une signature permit, des transferFrom signés par l\'attaquant… et un butin qui disparaît dans Tornado Cash.',
  description:
    'Un faux site de « vérification de portefeuille » fait signer des autorisations de dépense. Une victime accorde un approve illimité, une autre ne signe qu\'un message permit que l\'attaquant publie lui-même ; d\'autres comptes, jamais signalés, sont vidés de la même façon. L\'attaquant convertit le butin via 1inch, ouvre des branches et des transferts jumeaux, puis une adresse relais dépose les ETH dans Tornado Cash par dénominations fixes. Lisez les appels décodés (spender, signataire, owner, pools, statut d\'échec) et triez les sorties du receveur.',
  difficulty: 3,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'defi', 'dex', 'typologies', 'privacy', 'gel'],
  estMinutes: 60,
  lessons: ['calldata-selecteurs', 'drainers-approvals', 'agregateurs-routeurs', 'privacy-pools'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const v1P = fakePerson(r)
    const v2P = fakePerson(r)
    const city = fakeCity(r)
    let city2 = fakeCity(r)
    while (city2 === city) city2 = fakeCity(r)
    const domain = r.pick(['veriflow-wallet.app', 'walletguard-check.io', 'secure-dappsync.net', 'chainvalid-portal.com'])
    const regDays = r.int(10, 25)
    const regT = w.at(-regDays * 24 - r.float(0, 10))

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const uni = dex(w, 'uniswap', 'eth')
    const agg = aggregator(w, 'oneinch', 'eth', uni)
    const tc = privacyPool(w, 'tornado', 'eth')
    const ch = exchange(w, 'coinhouse', 'eth')
    const bn = exchange(w, r.pick(['binance', 'okx', 'kraken'] as const), 'eth')
    const host = w.customEntity({
      name: 'NordaHost (hébergeur offshore, fictif)', category: 'merchant', known: true, country: 'Seychelles',
      description: 'Hébergeur web et registraire de noms de domaine (fictif) payable en crypto, prisé pour son anonymat.',
      compliance: { contact: 'abuse@nordahost.example', cooperation: 'mlat', responseDays: [60, 180], canFreeze: false, kyc: 'aucun', notes: 'Conserve l\'adresse e-mail du compte, les IP de connexion et les noms de domaine achetés.' },
    })

    // Commerçants fictifs du dossier (dépenses de l'attaquant)
    const giftShop = w.customEntity({ name: r.pick(['GiftNova', 'Kadoo Cards', 'VoucherBay']), category: 'merchant', known: true, description: 'Revendeur de cartes cadeaux et de recharges payables en stablecoins (fictif). Conserve l\'e-mail de livraison des codes.' })
    const casino = w.customEntity({ name: r.pick(['LuckyHex', 'Jackpot Nebula', 'SpinVault']), category: 'gambling', known: true, description: 'Casino en ligne acceptant les cryptoactifs (fictif), vérification d\'identité légère au-delà d\'un seuil.' })
    const vpn = w.customEntity({ name: r.pick(['Tunnelo VPN', 'NoTrace VPN']), category: 'merchant', known: true, description: 'Fournisseur VPN payable en crypto (fictif).' })
    const atkE = w.customEntity({ name: `Opérateur du faux site ${domain} (inconnu)`, category: 'scam' })
    const S = w.addr('eth', { entity: atkE }) // spender des autorisations
    const G = w.addr('eth', { entity: atkE }) // publie les permits, paie le gas
    const R = w.addr('eth', { entity: atkE }) // reçoit les jetons volés
    const T = w.addr('eth', { entity: atkE }) // relais qui alimente Tornado Cash

    const v1E = w.customEntity({ name: v1P.name, category: 'victim' })
    const v2E = w.customEntity({ name: v2P.name, category: 'victim' })
    const v3E = w.customEntity({ name: 'Victime évitée (signalement)', category: 'individual' })
    const V1 = w.addr('eth', { entity: v1E })
    const V2 = w.addr('eth', { entity: v2E })
    const V3 = w.addr('eth', { entity: v3E })

    // ── Préparation de l'attaquant ───────────────────────────────────────────
    w.fundAccount(G, eth(r.float(0.4, 1.1)), 'ETH', w.at(-r.float(8, 15) * 24))
    const gasS = w.transfer({ time: w.at(-r.float(3, 6) * 24), from: G, to: S, value: eth(r.float(0.08, 0.2)), asset: 'ETH' })
    const gasR = w.transfer({ time: w.at(-r.float(1, 2.5) * 24), from: G, to: R, value: eth(r.float(0.05, 0.12)), asset: 'ETH' })

    // ── Historique des victimes ──────────────────────────────────────────────
    const u1 = roundAsset('USDT', r.float(9000, 48000))
    ch.withdraw(V1, eth(r.float(0.05, 0.3)), w.at(-r.int(60, 200) * 24))
    ch.withdraw(V1, u1, w.at(-r.int(10, 50) * 24), 'USDT')
    const c2 = roundAsset('USDC', r.float(6000, 30000))
    bn.withdraw(V2, eth(r.float(0.03, 0.2)), w.at(-r.int(40, 160) * 24))
    bn.withdraw(V2, c2, w.at(-r.int(8, 40) * 24), 'USDC')
    const c3 = roundAsset('USDC', r.float(2000, 9000))
    bn.withdraw(V3, eth(r.float(0.03, 0.1)), w.at(-r.int(30, 90) * 24))
    bn.withdraw(V3, c3, w.at(-r.int(5, 30) * 24), 'USDC')
    // Autorisation légitime antérieure (routeur connu)
    approve(w, { owner: V1, spender: uni.router, asset: 'USDT', value: roundAsset('USDT', r.float(100, 900)), time: w.at(-r.int(5, 9) * 24) })

    // ── Répétition générale : l'attaquant teste le circuit sur son propre compte ─
    const testAcc = w.addr('eth', { entity: atkE })
    const tTest = w.at(-r.float(30, 44))
    w.transfer({ time: tTest - r.int(2, 6) * HOUR, from: G, to: testAcc, value: eth(r.float(0.02, 0.04)), asset: 'ETH' })
    const testSwap = uni.swap({ trader: testAcc, assetIn: 'ETH', amountIn: eth(0.008), assetOut: 'USDC', time: tTest - r.int(30, 90) * MIN })
    approve(w, { owner: testAcc, spender: S, asset: 'USDC', time: tTest })
    const testTf = transferFrom(w, { spender: S, owner: testAcc, to: R, value: testSwap.amountOut, asset: 'USDC', time: tTest + r.int(5, 40) * MIN })

    // ── Victime 1 : approve illimité, puis transferFrom ─────────────────────
    const ap1 = approve(w, { owner: V1, spender: S, asset: 'USDT', time: w.at(0) })
    const tf1 = transferFrom(w, { spender: S, owner: V1, to: R, value: u1, asset: 'USDT', time: w.at(r.float(5, 20)) })

    // ── Victime 2 : signature permit hors chaîne, publiée par G ──────────────
    const tSig = w.at(r.float(26, 40))
    const pm2 = permit(w, { owner: V2, spender: S, asset: 'USDC', submitter: G, time: tSig + r.int(4, 25) * MIN })
    const tf2 = transferFrom(w, { spender: S, owner: V2, to: R, value: c2, asset: 'USDC', time: pm2.time + r.int(1, 6) * MIN })

    // ── Autres comptes vidés, jamais signalés ───────────────────────────────
    const nOther = r.int(2, 3)
    const others: { owner: string; asset: AssetId; value: number; tx: Tx }[] = []
    for (let i = 0; i < nOther; i++) {
      const owner = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
      const asset: AssetId = r.chance(0.5) ? 'USDT' : 'USDC'
      const value = roundAsset(asset, r.float(800, 6000))
      bn.withdraw(owner, value, w.at(-r.int(6, 60) * 24), asset)
      const tA = w.at(r.float(-30, 48))
      approve(w, { owner, spender: S, asset, time: tA })
      others.push({ owner, asset, value, tx: transferFrom(w, { spender: S, owner, to: R, value, asset, time: tA + r.int(2, 9) * HOUR }) })
    }
    // Le spender manque de gas : seconde recharge par G
    w.transfer({ time: w.at(r.float(20, 30)), from: G, to: S, value: eth(r.float(0.04, 0.1)), asset: 'ETH' })

    // ── Victime 3 : approve, révocation à temps, transferFrom échoué ─────────
    const ap3 = approve(w, { owner: V3, spender: S, asset: 'USDC', time: w.at(r.float(44, 50)) })
    const revoke3 = approve(w, { owner: V3, spender: S, asset: 'USDC', value: 0, time: ap3.time + r.int(40, 180) * MIN })
    const usdcToken = tokenContract(w, 'eth', 'USDC')
    const fail3 = failedTx(w, {
      signer: S, to: usdcToken, time: revoke3.time + r.int(20, 120) * MIN, method: 'transferFrom', reason: 'ERC20: transfer amount exceeds allowance',
      call: { to: usdcToken, sig: 'transferFrom(address,address,uint256)', args: [{ addr: V3 }, { addr: R }, { amt: c3, asset: 'USDC' }] },
    })

    // ── Blanchiment : 1inch, branches, jumeaux, relais, Tornado ──────────────
    const usdtAll = roundAsset('USDT', w.balanceOf(R, 'USDT'))
    const sw1 = agg.swap({ trader: R, route: ['USDT', 'USDC'], amountIn: usdtAll, time: w.at(r.float(56, 60)) })
    // Branches USDC sans issue : dort, dépensée, retour vers l'adresse de gaz
    const usdc0 = w.balanceOf(R, 'USDC')
    const tBr = sw1.tx.time + Math.round(r.float(1, 3) * HOUR)
    const brDorm = w.addr('eth', { entity: atkE })
    const brSpent = w.addr('eth', { entity: atkE })
    const brBack = w.addr('eth', { entity: atkE })
    const brVals = [0, 1, 2].map(() => roundAsset('USDC', usdc0 * r.float(0.06, 0.1)))
    const brTx = [brDorm, brSpent, brBack].map((to, k) => w.transfer({ time: tBr + k * r.int(5, 30) * MIN, from: R, to, value: brVals[k], asset: 'USDC' }))
    for (const [k, e] of [giftShop, casino].entries()) {
      w.transfer({ time: brTx[1].time + Math.round(r.float(6 + k * 20, 20 + k * 30) * HOUR), from: brSpent, to: w.addr('eth', { entity: e, label: `${e.name} — Paiement` }), value: roundAsset('USDC', brVals[1] * r.float(0.25, 0.4)), asset: 'USDC' })
    }
    const backTx = w.transfer({ time: brTx[2].time + Math.round(r.float(10, 40) * HOUR), from: brBack, to: G, value: brVals[2], asset: 'USDC' })

    const usdcAll = roundAsset('USDC', w.balanceOf(R, 'USDC'))
    const daiIn = roundAsset('USDC', usdcAll * r.float(0.3, 0.4))
    const sw2 = agg.swap({ trader: R, route: ['USDC', 'ETH', 'DAI'], amountIn: daiIn, time: w.at(r.float(63, 66)) })
    const daiOut = sw2.amountOut
    const usdcRest = roundAsset('USDC', w.balanceOf(R, 'USDC'))
    const sw3 = agg.swap({ trader: R, route: ['USDC', 'ETH'], amountIn: usdcRest, time: w.at(r.float(67, 70)) })
    const ethOut = sw3.amountOut
    const Te = Math.floor(ethOut * 100) / 100
    const tReal = sw3.tx.time + r.int(20, 90) * MIN
    const realTx = w.transfer({ time: tReal, from: R, to: T, value: Te, asset: 'ETH' })
    // Jumeaux : montant voisin, rond au centième comme le vrai (le montant ne trahit rien), même
    // heure ; chacun est précédé d'un apport extérieur exactement du même montant (l'indice décisif).
    const twins = [0, 1].map((k) => {
      let v = cents(Te * (1 + r.float(0.001, 0.004) * (k ? 1 : -1)))
      if (v === Te) v = cents(Te + (k ? 0.01 : -0.01))
      const t = tReal + r.int(-20, 20) * MIN
      w.fundAccount(R, v, 'ETH', t - r.int(10, 50) * MIN)
      return w.transfer({ time: t, from: R, to: w.addr('eth'), value: v, asset: 'ETH' })
    })
    // Dépôts du relais dans Tornado Cash, par dénominations fixes
    const denoms: number[] = []
    let rem = Te
    for (const d of [10, 1]) while (rem + 1e-9 >= d) { denoms.push(d); rem = Math.round((rem - d) * 1e6) / 1e6 }
    for (let k = 0; k < 5 && rem + 1e-9 >= 0.1; k++) { denoms.push(0.1); rem = Math.round((rem - 0.1) * 1e6) / 1e6 }
    let tDep = tReal + Math.round(r.float(0.5, 3) * HOUR)
    const tcDeposits = denoms.map((d) => {
      const tx = tc.deposit(T, d, tDep)
      tDep += r.int(3, 25) * MIN
      return tx
    })
    const deposited = Math.round(denoms.reduce((s, d) => s + d, 0) * 1e6) / 1e6
    const n10 = denoms.filter((d) => d === 10).length
    const n1 = denoms.filter((d) => d === 1).length
    const n01 = denoms.filter((d) => d === 0.1).length

    // ── Habillage des comptes de l'attaquant ─────────────────────────────────
    priorHistory(w, G, { start: w.at(-50 * 24), end: w.at(-16 * 24), nIn: 3, nOut: 2, maxUsd: 1200 })
    // Achat du domaine puis de l'hébergement chez NordaHost (écrits à la main : toujours présents)
    for (const t of [regT, regT + r.int(20, 70) * HOUR]) w.transfer({ time: t, from: G, to: w.addr('eth', { entity: host, label: `${host.name} — Paiement` }), value: eth(fromUsd('ETH', r.float(18, 75))), asset: 'ETH' })
    personalSpending(w, G, { start: w.at(-14 * 24), end: w.at(6 * 24), n: 3, merchants: [vpn, giftShop], maxUsd: 160 })
    dusting(w, R, { time: tf1.time + 6 * HOUR, n: 2, spreadH: 10 })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    uni.noise(30, w.at(-3 * 24), w.at(6 * 24), [['ETH', 'USDC'], ['ETH', 'DAI'], ['ETH', 'USDT'], ['USDC', 'USDT']])
    const routes: AssetId[][] = [['USDC', 'ETH', 'DAI'], ['USDT', 'USDC'], ['ETH', 'USDC'], ['USDC', 'ETH'], ['DAI', 'ETH', 'USDT']]
    for (let i = 0; i < 18; i++) {
      const route = r.pick(routes)
      const a0 = route[0]
      const amountIn = roundAsset(a0, fromUsd(a0, r.float(300, 40000)))
      agg.swap({ trader: w.addr('eth'), route, amountIn, time: w.at(r.float(-3 * 24, 6 * 24)) })
    }
    for (let i = 0; i < 12; i++) {
      const u = w.addr('eth')
      approve(w, { owner: u, spender: r.pick([uni.router, agg.router]), asset: r.pick(['USDC', 'USDT', 'DAI'] as const), time: w.at(r.float(-4 * 24, 6 * 24)) })
    }
    tc.noise(1, 14, w.at(-2 * 24), w.at(6 * 24))
    tc.noise(0.1, 10, w.at(-2 * 24), w.at(6 * 24))
    tc.noise(10, 6, w.at(-3 * 24), w.at(7 * 24))
    ch.noise(8, w.at(-3 * 24), w.at(5 * 24), 'USDT')
    bn.noise(10, w.at(-3 * 24), w.at(5 * 24), 'USDC')

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const handle = fakeHandle(r)
    const d = (ts: number) => fmtDate(ts)
    const drained = 2 + nOther
    const othersTxt = [...others].sort((a, b) => a.tx.time - b.tx.time).map((o) => `${amt(o.value, o.asset)} le ${fmtDate(o.tx.time, false)}`).join(', ')
    const tLeft = eth(w.balanceOf(T, 'ETH'))
    const dormUsdc = roundAsset('USDC', w.balanceOf(brDorm, 'USDC'))
    const denomTxt = [n10 ? `${n10} × 10 ETH` : '', n1 ? `${n1} × 1 ETH` : '', n01 ? `${n01} × 0,1 ETH` : ''].filter(Boolean).join(' + ')
    // Délais réels (jamais écrits en dur)
    const sameDay = parisDay(ap1.time) === parisDay(tf1.time)
    const revokeDelay = dur(revoke3.time - ap3.time)
    const depDelay = dur(tcDeposits[0].time - tReal)
    const leftTxt = tLeft <= 0
      ? 'Le montant reçu tombait juste sur les dénominations : aucun reliquat ne reste sur le relais.'
      : tLeft < 0.1 - 1e-9
        ? `Le reliquat, ${amt(tLeft, 'ETH')}, est inférieur à la plus petite dénomination (0,1 ETH) : il dort encore sur le relais.`
        : `Le relais s'arrête après cinq dépôts de 0,1 ETH (sans doute pour ne pas multiplier les dépôts identiques) : ${amt(tLeft, 'ETH')} dorment encore sur le relais.`
    // Accord avec le genre de la personne qui a porté plainte
    const pl = v1P.g('le plaignant', 'la plaignante')
    const Pl = v1P.g('Le plaignant', 'La plaignante')
    const dePl = v1P.g('du plaignant', 'de la plaignante')

    return {
      world: w,
      title: `Faux site de vérification « ${domain} »`,
      briefing:
        `${v1P.name} (${city}) a reçu un courriel l'avertissant que son portefeuille devait être « vérifié » pour rester actif. Sur le site ${domain}, ${v1P.g('il', 'elle')} a connecté son portefeuille et confirmé une transaction présentée comme une simple vérification. Ses USDT ont disparu dans les heures qui ont suivi. ${v2P.name} (${city2}) décrit le même site, mais affirme n'avoir signé aucune transaction.\n\n` +
        `Ces sites ne volent pas les fonds directement : ils font signer une autorisation de dépense (approve) ou une signature hors chaîne (permit). L'attaquant, devenu « spender », déplace ensuite les jetons quand il le veut par transferFrom, une transaction qu'il signe lui-même. L'inspecteur décode chaque appel : fonction, arguments, signataire, journaux d'événements, statut.\n\n` +
        `Objectifs : identifier le spender et les comptes de l'attaquant, retrouver la transaction qui a réellement vidé chaque victime, mesurer l'ampleur de la campagne, lire l'échec d'une tentative, puis suivre le butin à travers 1inch, trier les sorties du receveur et documenter sa disparition dans un pool de confidentialité.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(4 * 24), author: v1P.name,
          body:
            `« Le site m'a demandé de cliquer sur "Vérifier mon portefeuille". Mon portefeuille m'a montré une demande que j'ai acceptée, il était écrit quelque chose comme "Autoriser l'accès à vos USDT". Le site a affiché "Portefeuille vérifié ✅". ${sameDay ? 'Le soir même' : 'Le lendemain'}, mon solde d'USDT était à zéro, alors que je n'ai rien envoyé.\n\n` +
            `Mon adresse : ${A(w, V1)}\n` +
            `La transaction que j'ai signée : ${ap1.hash} »`,
        },
        {
          id: 'courriel', type: 'email', title: 'Courriel d\'hameçonnage reçu par la victime', date: w.at(-6), author: `Support <no-reply@${domain}>`,
          body:
            `Objet : Action requise — vérification de votre portefeuille\n\n` +
            `Suite à la nouvelle réglementation européenne, tous les portefeuilles doivent être vérifiés avant le ${fmtDate(w.at(3 * 24), false)}.\n` +
            `Sans vérification, vos actifs pourraient être temporairement inaccessibles.\n\n` +
            `[ Vérifier mon portefeuille ] → https://${domain}/verify\n\n` +
            `Cette opération est gratuite et ne prend qu'une minute.`,
        },
        {
          id: 'rapprochement', type: 'email', title: 'Message d\'une brigade (plainte similaire)', date: w.at(6 * 24), author: `Brigade de gendarmerie ${de(city2)}`,
          body:
            `Bonjour,\n\n${v2P.name}, adresse ${A(w, V2)}, a perdu ${amt(c2, 'USDC')} le ${fmtDate(tf2.time, false)} après être ${v2P.g('passé', 'passée')} sur ${domain}. ${v2P.g('Il', 'Elle')} est formel${v2P.g('', 'le')} : ${v2P.g('il', 'elle')} n'a validé qu'une « signature de connexion », sans frais de gas, et son adresse n'a jamais signé la moindre transaction.\n\n` +
            `Un outil de contrôle des autorisations lui indique une autorisation illimitée sur ses USDC, créée par la transaction ${pm2.hash}.\n\nPouvez-vous nous éclairer ?\nCordialement`,
        },
        {
          id: 'forum', type: 'forum', title: 'Publication sur un forum de sécurité Web3', date: w.at(5 * 24), author: handle,
          body:
            `PSA : ${domain} est un drainer. J'ai signé leur "vérification" puis j'ai vu passer une alerte sur ce site ${revokeDelay} après. J'ai révoqué l'autorisation tout de suite (approve à 0). Je crois que j'ai eu de la chance, mes USDC sont toujours là.\n` +
            `Mon adresse : ${A(w, V3)}\n\n` +
            `— Réponse d'un autre membre : « Le spender de ce site a vidé d'autres comptes que personne n'a signalés. Regardez tous ses transferFrom. »`,
        },
        {
          id: 'whois', type: 'osint', title: `Recherche OSINT sur le domaine ${domain}`, date: w.at(7 * 24), author: 'Cellule d\'appui',
          body:
            `Domaine enregistré le ${fmtDate(regT, false)}, ${regDays} jours avant les faits dénoncés par ${pl}, via un registraire offshore qui accepte les paiements en crypto (NordaHost). Données du titulaire masquées.\n` +
            `Hébergement chez le même prestataire. Le site a été déréférencé par plusieurs listes de blocage le ${fmtDate(w.at(4 * 24), false)}.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : stablecoins, gel et pools de confidentialité', date: w.at(6 * 24), author: 'Cellule d\'appui',
          body:
            `• USDT (Tether) et USDC (Circle) : l'émetteur peut placer une adresse sur liste noire à la demande motivée des autorités.\n` +
            `• DAI : stablecoin décentralisé, sans émetteur capable de geler une adresse.\n` +
            `• Pool de confidentialité (Tornado Cash) : contrat sans opérateur, dénominations fixes (0,1 / 1 / 10 / 100 ETH). Un dépôt rompt le lien on-chain ; seul le retrait ultérieur, avec une autre adresse, peut éventuellement être rapproché par le montant, le temps et les erreurs de l'utilisateur. Aucun gel ni aucune réquisition possible auprès du contrat.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: `Quelle adresse figure comme « spender » dans l'autorisation signée par ${pl} ?`,
          answer: [S],
          hint: 'Ouvrez la transaction citée dans la plainte : la rubrique « Appel de contrat » décode approve(address,uint256) et son premier argument.',
          explanation: `${Pl} appelle approve(address,uint256) sur le contrat USDT. Le premier argument, spender, est ${A(w, S)} : ce compte peut désormais déplacer ses USDT sans nouvelle signature de sa part. L'événement Approval émis par le contrat USDT reprend owner, spender et montant. Une autorisation plus ancienne, accordée au routeur Uniswap pour un petit montant, est légitime : ne la confondez pas avec celle du faux site.`,
        },
        {
          id: 'o2', type: 'choice', points: 7,
          prompt: 'Le second argument de cet approve vaut 2²⁵⁶−1. Que signifie cette valeur ?',
          hint: 'Lisez l\'aide affichée sous la fonction décodée et la valeur de l\'argument « value ».',
          ...choice(r,
            'Une autorisation illimitée : le spender peut prélever tous les USDT présents et futurs de l\'adresse, sans limite de montant ni de durée',
            [
              'Un montant symbolique qui ne permet de prélever que les frais de vérification',
              'Une autorisation valable une seule fois, qui expire après le premier prélèvement',
              'Un code d\'erreur : l\'autorisation n\'a pas été enregistrée par le contrat',
            ]),
          explanation: `2²⁵⁶−1 est la plus grande valeur d'un uint256 : les portefeuilles et les dApps l'utilisent pour une autorisation « illimitée ». Elle reste active jusqu'à sa révocation (approve à 0), y compris pour des jetons reçus plus tard. C'est pourquoi un drainer peut attendre avant de frapper.`,
        },
        {
          id: 'o3', type: 'tx', points: 10,
          prompt: `Quelle transaction a réellement fait sortir les USDT ${dePl} ?`,
          answer: [tf1.id],
          hint: 'Ce n\'est pas la transaction signée par la victime. Cherchez, dans la liste des transactions de son adresse, la sortie d\'USDT, puis regardez qui la signe.',
          explanation: `La transaction ${tf1.hash.slice(0, 18)}… (${d(tf1.time)}) appelle transferFrom(address,address,uint256) sur le contrat USDT : from = ${pl}, to = ${A(w, R).slice(0, 12)}…, value = ${amt(u1, 'USDT')}. Elle est signée par le spender ${A(w, S).slice(0, 12)}…, qui paie le gas : la victime n'a rien signé pour ce prélèvement, et l'approve n'avait déplacé aucun fonds. Juridiquement, c'est l'acte de soustraction, signé par la clé de l'attaquant des heures après la « vérification ».`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Vers quelle adresse les jetons prélevés sont-ils envoyés ?',
          answer: [R],
          hint: 'Lisez l\'argument « to » de l\'appel transferFrom, ou l\'événement Transfer.',
          explanation: `Les prélèvements (USDT ${dePl}, USDC ${deN(v2P.name)}, ceux d'autres comptes et même l'essai initial de l'attaquant) aboutissent tous sur ${A(w, R)}. L'attaquant sépare les rôles : un compte pour les autorisations (le spender), un pour recevoir, un pour payer le gas. Le spender et le receveur ont tous deux reçu leurs ETH de gas du même compte ${A(w, G).slice(0, 12)}…, ce qui rattache les trois au même opérateur. Les micro-envois de quelques centimes d'USDT reçus d'adresses qui ressemblent à celle du receveur (mêmes premiers et derniers caractères) sont de l'empoisonnement d'adresse, sans valeur : ils ne viennent pas des victimes.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Quel compte a publié sur la chaîne l\'autorisation de la seconde victime ?',
          answer: [G],
          hint: 'Ouvrez la transaction citée par la brigade : qui la signe ? Comparez avec les arguments owner et spender de l\'appel.',
          explanation: `La transaction ${pm2.hash.slice(0, 18)}… appelle permit(owner, spender, value, deadline, v, r, s) sur le contrat USDC. Elle est signée par ${A(w, G)}, qui en paie le gas ; owner = ${v2P.name}, spender = ${A(w, S).slice(0, 12)}…. Les arguments v, r, s portent la signature de la victime, obtenue hors chaîne. Ce compte a aussi financé en gas le spender et le receveur, et il paie l'hébergeur offshore du faux site (NordaHost) : une piste d'identification secondaire.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: `Pourquoi ${v2P.name} affirme-t-${v2P.g('il', 'elle')} de bonne foi n'avoir signé aucune transaction ?`,
          hint: 'Regardez quelles transactions apparaissent dans la liste de son adresse, puis relisez l\'aide de la fonction permit.',
          ...choice(r,
            'Une signature permit (EIP-2612) se fait hors chaîne, sans gas : c\'est l\'attaquant qui la publie, la victime n\'apparaît que comme argument « owner »',
            [
              'Sa clé privée a été volée : l\'attaquant a signé l\'autorisation à sa place',
              'L\'autorisation a été signée depuis un autre portefeuille de la victime',
              'L\'USDC ne nécessite aucune autorisation : n\'importe qui peut transférer les jetons d\'autrui',
            ]),
          explanation: `Avec permit, le titulaire signe un message structuré (pas une transaction) que son portefeuille présente parfois comme une simple connexion. N'importe qui peut ensuite le publier : ici ${A(w, G).slice(0, 12)}…. L'autorisation ne figure pas dans la liste des transactions de la victime : on n'y voit que ses retraits d'exchange et le prélèvement de ${amt(c2, 'USDC')} par transferFrom, signé par le spender. Seule la lecture des arguments du permit établit le lien.`,
        },
        {
          id: 'o14', type: 'number', points: 9,
          prompt: 'Combien de comptes de victimes le spender a-t-il vidés par des transferFrom réussis ?',
          answer: drained,
          hint: 'Listez les transactions signées par le spender : ne comptez que les transferFrom réussis, un par compte prélevé. Méfiez-vous d\'un prélèvement minuscule, antérieur à la campagne : d\'où ce compte tenait-il son gas ?',
          explanation: `${drained} comptes de victimes : ${pl}, ${v2P.name} et ${nOther} comptes jamais signalés (${othersTxt}), tous prélevés vers ${A(w, R).slice(0, 12)}…. Le prélèvement de ${amt(testSwap.amountOut, 'USDC')} du ${fmtDate(testTf.time, false)} ne compte pas : le compte visé a reçu son gas de ${A(w, G).slice(0, 12)}…, acheté ces quelques USDC sur Uniswap juste avant et autorisé le spender lui-même ; c'est la répétition générale de l'attaquant sur son propre compte. La tentative visant l'auteur du signalement sur le forum a échoué et ne compte pas non plus. Les victimes non identifiées élargissent le préjudice : leurs adresses (argument from des transferFrom) permettent de les retrouver auprès des plateformes qui les ont alimentées.`,
        },
        {
          id: 'o11', type: 'tx', points: 9,
          prompt: 'Une tentative de prélèvement de l\'attaquant a échoué. Quelle est cette transaction ?',
          answer: [fail3.id],
          hint: 'Parcourez les transactions signées par le spender : l\'une porte le statut « Échec (reverted) ». La victime visée n\'apparaît que dans les arguments.',
          explanation: `La transaction ${fail3.hash.slice(0, 18)}… (${d(fail3.time)}), signée par le spender, appelle transferFrom sur le contrat USDC avec from = ${A(w, V3).slice(0, 12)}… (l'auteur du signalement sur le forum) et value = ${amt(c3, 'USDC')}. Elle a échoué : aucun transfert, aucun événement, mais des frais payés.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Pourquoi cette tentative a-t-elle échoué, et qu\'en tirer ?',
          hint: 'Lisez le motif d\'échec, puis la liste des transactions de l\'adresse visée.',
          ...choice(r,
            'L\'autorisation avait été révoquée (approve à 0) : « transfer amount exceeds allowance ». La tentative prouve l\'intention de l\'attaquant mais aucun préjudice',
            [
              'Le solde de la victime était insuffisant : elle avait déjà été vidée par une autre transaction',
              'Circle avait gelé l\'adresse du spender, qui ne pouvait plus recevoir d\'USDC',
              'Le gas fourni était insuffisant : l\'attaquant a réussi au second essai',
            ]),
          explanation: `${A(w, V3).slice(0, 12)}… a signé l'approve le ${d(ap3.time)} puis l'a révoqué le ${d(revoke3.time)} (approve(spender, 0)). Le contrat USDC refuse donc le transferFrom : « ERC20: transfer amount exceeds allowance ». Pénalement, c'est une tentative (art. 121-5 du Code pénal), qui documente le mode opératoire et la persistance de l'attaquant ; la personne visée n'a subi aucune perte.`,
        },
        {
          id: 'o8', type: 'amount', points: 9, unit: 'DAI', tolerance: 0.01,
          prompt: 'Combien de DAI l\'attaquant obtient-il par son swap multi-pools sur 1inch ?',
          answer: daiOut,
          hint: 'Parmi les transactions de l\'adresse receveuse, cherchez l\'appel unoswap dont la liste « pools » compte deux pools et dont l\'actif final est le DAI.',
          explanation: `La transaction ${sw2.tx.hash.slice(0, 18)}… appelle unoswap sur le routeur 1inch avec ${amt(daiIn, 'USDC')} et une liste de deux pools : USDC → ETH (pool ETH/USDC), puis ETH → DAI (pool DAI/ETH). Le routeur détient l'actif intermédiaire entre les deux étapes ; le receveur obtient ${amt(daiOut, 'DAI')}. Les autres unoswap du receveur n'ont qu'un pool : USDT → USDC au début (${amt(usdtAll, 'USDT')}), USDC → ETH à la fin (${amt(usdcRest, 'USDC')} contre ${amt(ethOut, 'ETH')}). Les DAI restent sur ${A(w, R).slice(0, 12)}… : aucun émetteur ne peut les geler, il faut surveiller l'adresse.`,
        },
        {
          id: 'o9', type: 'tx', points: 11,
          prompt: `Après la conversion en ETH, le receveur envoie trois montants d'environ ${amt(Te, 'ETH')} à quelques minutes d'intervalle. Lequel est la continuation du butin ?`,
          answer: [realTx.id],
          hint: 'Pour chaque envoi, regardez d\'où viennent les ETH (le swap 1inch, ou un apport arrivé juste avant ?) et ce que fait ensuite le destinataire.',
          explanation: `La transaction ${realTx.hash.slice(0, 18)}… verse ${amt(Te, 'ETH')} (les ${amt(ethOut, 'ETH')} du dernier swap, arrondis au centième) à ${A(w, T)}, qui commence à les déposer dans Tornado Cash ${depDelay} plus tard. Le montant ne départage rien : les trois envois sont ronds au centième et à moins de 1 % l'un de l'autre. Ce qui tranche, c'est l'origine des fonds : les deux jumeaux (${twins.map((t) => amt(t.transfers[0].value, 'ETH')).join(' et ')}) sont chacun précédés, peu avant, d'un apport exactement du même montant venu d'une adresse tierce ; ce sont d'autres fonds qui ne font que transiter pour brouiller la piste, et leurs destinataires ne bougent plus. Le vrai envoi, lui, n'a pas d'apport jumeau : il puise dans les ETH du swap. Les branches d'USDC ouvertes plus tôt n'aboutissent pas non plus : l'une dort (${amt(dormUsdc, 'USDC')}, gelables par Circle), l'une paie ${giftShop.name} (cartes cadeaux) et ${casino.name} (casino en ligne), la dernière revient vers le compte de gas ${A(w, G).slice(0, 12)}…, ce qui confirme qu'elle appartient au même opérateur.`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'Dans quel service le butin converti en ETH finit-il ?',
          answer: ['tornado'],
          hint: 'Suivez l\'adresse relais : ses sorties partent toutes vers des contrats étiquetés, pour des montants ronds.',
          explanation: `${A(w, T).slice(0, 12)}… dépose ses ETH dans les pools de Tornado Cash (${denomTxt}). Pool non-custodial à dénominations fixes : le dépôt rompt le lien on-chain, et il n'existe ni opérateur à requérir ni gel possible. Restent la surveillance des retraits futurs (montants, délais, erreurs de l'utilisateur) et les pistes hors chaîne : hébergeur du faux site, autres victimes, fonds gelables sur la branche dormante.`,
        },
        {
          id: 'o13', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.001,
          prompt: 'Combien d\'ETH l\'adresse relais a-t-elle déposés au total dans Tornado Cash ?',
          answer: deposited,
          hint: 'Additionnez les dépôts de l\'adresse relais vers les contrats du pool (dénominations fixes).',
          explanation: `${denoms.length} dépôts (${denomTxt}) = ${amt(deposited, 'ETH')}, étalés sur ${dur(tcDeposits[tcDeposits.length - 1].time - tcDeposits[0].time)}. ${leftTxt} Le découpage (montants, horaires) est à consigner : il servira à rapprocher d'éventuels retraits de mêmes dénominations dans les semaines suivantes.`,
        },
      ],
      truth: {
        path: [gasS.id, gasR.id, ap1.id, tf1.id, pm2.id, tf2.id, ap3.id, revoke3.id, fail3.id, sw1.tx.id, sw2.tx.id, sw3.tx.id, realTx.id, ...tcDeposits.map((t) => t.id)],
        addresses: [S, R, G, T],
        debrief:
          `1. Préparation : ${A(w, G)} approvisionne en gas le spender ${A(w, S)} et le receveur ${A(w, R)}. Le même compte paie l'hébergeur offshore du faux site et alimente un compte de test, sur lequel l'attaquant répète le circuit (approve puis transferFrom de ${amt(testSwap.amountOut, 'USDC')}) avant la campagne.\n` +
          `2. ${Pl} signe approve(spender = ${A(w, S).slice(0, 12)}…, 2²⁵⁶−1) sur l'USDT. Le spender signe ensuite transferFrom et prélève ${amt(u1, 'USDT')} vers le receveur.\n` +
          `3. ${v2P.name} ne signe qu'un message permit, publié par ${A(w, G).slice(0, 12)}… ; le spender prélève ${amt(c2, 'USDC')} par transferFrom quelques minutes plus tard. ${nOther} autres comptes, jamais signalés, sont vidés de la même façon (${othersTxt}).\n` +
          `4. L'auteur du signalement sur le forum révoque son autorisation à temps : le transferFrom de l'attaquant échoue (« transfer amount exceeds allowance »).\n` +
          `5. Le receveur convertit ses USDT en USDC (1inch), ouvre trois branches d'USDC sans issue (une dort, une paie ${giftShop.name} et ${casino.name}, une revient au compte de gas), convertit ${amt(daiIn, 'USDC')} en ${amt(daiOut, 'DAI')} (deux pools), puis le reste en ${amt(ethOut, 'ETH')}.\n` +
          `6. Il envoie ${amt(Te, 'ETH')} au relais ${A(w, T)}, à quelques minutes de deux transferts jumeaux de montants voisins, chacun financé par un apport extérieur du même montant arrivé juste avant.\n` +
          `7. Le relais dépose ${amt(deposited, 'ETH')} dans Tornado Cash (${denomTxt})${tLeft > 0 ? ` ; ${amt(tLeft, 'ETH')} restent sur le relais` : ''}.\n\n` +
          `À retenir : dans un drainer à autorisation, la victime signe l'autorisation (approve, ou permit hors chaîne), jamais le prélèvement : il faut lire le signataire et les arguments décodés (owner, spender, from, to), et lister tous les transferFrom du spender pour mesurer la campagne. Les sorties du receveur se trient par l'origine des fonds et le comportement des destinataires. Le pool de confidentialité clôt le traçage direct : restent les DAI non gelables, les USDC dormants gelables par Circle, et les pistes hors chaîne.`,
      },
      hints: [
        'Ouvrez la transaction de la plainte et lisez la rubrique « Appel de contrat » : fonction, spender, montant.',
        'La sortie des USDT de la victime figure dans sa liste de transactions, mais elle n\'est pas signée par elle.',
        'Pour la seconde victime, la transaction citée par la brigade n\'est pas signée par la victime : lisez signataire et arguments.',
        'Les transactions signées par le spender comprennent plusieurs prélèvements… et une tentative échouée.',
        'Un appel unoswap liste les pools traversés : comptez-les et suivez l\'actif reçu en fin de route.',
        'Pour trier les envois d\'ETH du receveur, regardez les entrées qui précèdent chacun d\'eux, puis ce que font les destinataires.',
      ],
    }
  },
}

