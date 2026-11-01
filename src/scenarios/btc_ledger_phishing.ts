import { World, type Tx } from '../engine/world'
import { dex, exchange, peelChain, swapper, roundCoin, HOUR, DAY, type ExchangeKit, type SwapperKit } from '../engine/patterns'
import { roundAsset, usd, fromUsd, type AssetId } from '../engine/chains'
import { decoyBranches, dusting, type Branch } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

const BRANCH_FATE: Record<Branch['fate'], string> = {
  dort: 'n\'a plus bougé',
  'dépensée': 'a servi à de petits paiements',
  retour: 'renvoyée plus tard au financeur de gaz',
  'éclatée': 'ré-éclatée en petites sommes',
}

/** Arrondi par défaut (évite de dépenser une fraction de plus que le solde). */
const floor8 = (v: number) => Math.floor(v * 1e8) / 1e8
const floor6 = (v: number) => Math.floor(v * 1e6) / 1e6
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
/** « de Paul » / « d'Inès ». */
const deN = (n: string) => (/^[AEIOUYÉÈÊÀÂÎ]/i.test(n) ? `d'${n}` : `de ${n}`)
const hhmm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))
/** Même jour que `ts`, à `h` heures pile (heure de Paris) : pièces rédigées aux heures de bureau. */
const atHour = (ts: number, h: number) => ts - (ts % HOUR) + (h - parisHour(ts)) * HOUR

/**
 * Commande ChangeNOW depuis Bitcoin qui dépense TOUT le solde de `from`
 * (sans rendu), avec des frais explicites sur le rapatriement du dépôt.
 * Équivalent local de `SwapperKit.order`, comme dans le scénario de chain hopping.
 */
function btcOrderAll(
  w: World,
  sw: SwapperKit,
  o: { from: string; time: number; recipient: string; delayMin?: [number, number]; feePct?: number; decoys?: number },
): { deposit: string; value: number; depositTx: Tx; sweepTx: Tx; payoutTx: Tx; payoutValue: number } {
  const r = w.rng
  const deposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
  const fee = w.estimateFee('btc', Math.max(1, w.utxosOf(o.from, o.time).length), 1)
  const value = floor8(w.unspentValue(o.from, o.time) - fee)
  const depositTx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value }], fee, change: null, spendAll: true })
  const fee2 = w.estimateFee('btc', 1, 1)
  const sweepTx = w.utxoTx({ time: o.time + r.int(120, 1200), from: [deposit], to: [{ address: sw.hot('btc'), value: floor8(value - fee2) }], fee: fee2, change: null, spendAll: true, tags: ['sweep'] })
  const feePct = o.feePct ?? r.float(0.006, 0.015)
  const [dmin, dmax] = o.delayMin ?? [8, 35]
  const payT = o.time + r.int(dmin, dmax) * 60
  const payoutValue = roundAsset('ETH', fromUsd('ETH', usd('BTC', value) * (1 - feePct)))
  const pay = (to: string, v: number, t: number) => w.transfer({ time: t, from: sw.hot('eth'), to, value: v, asset: 'ETH', method: 'payout' })
  const payoutTx = pay(o.recipient, payoutValue, payT)
  const nd = o.decoys ?? r.int(4, 8)
  for (let i = 0; i < nd; i++) {
    const close = r.chance(0.35)
    const v = close ? payoutValue * r.float(0.85, 1.15) : fromUsd('ETH', r.float(40, usd('ETH', payoutValue) * 3 + 200))
    pay(w.addr('eth'), roundAsset('ETH', v), payT + r.int(-2 * 3600, 3 * 3600))
  }
  return { deposit, value, depositTx, sweepTx, payoutTx, payoutValue }
}

export const btcLedgerPhishing: ScenarioTemplate = {
  id: 'ledger-phishing',
  title: 'Faux courrier Ledger : la phrase de récupération volée',
  tagline: 'Un courrier, un QR code, 24 mots saisis : BTC, ETH et USDT vidés dans l\'heure.',
  description:
    'Une victime reçoit par la poste un faux courrier aux couleurs de Ledger l\'invitant à « vérifier » son portefeuille matériel. Elle saisit sa phrase de récupération sur un faux site : l\'attaquant vide aussitôt ses bitcoins et ses comptes Ethereum. Suivez les fonds sur les deux chaînes, servez-vous du financeur de gaz pour mesurer la campagne (comptes vidés, tentatives sans suite), triez les sorties de l\'attaquant entre branches sans issue et dépôt non étiqueté, et retrouvez l\'exchange où tout converge.',
  difficulty: 2,
  chains: ['btc', 'eth'],
  skills: ['lecture_tx', 'utxo', 'evm', 'tokens', 'crosschain', 'osint', 'requisition'],
  estMinutes: 55,
  lessons: ['cles-portefeuilles', 'typologies', 'suivre-flux', 'chain-hopping', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const v2P = fakePerson(r)
    const city2 = r.pick(['Lyon', 'Nantes', 'Lille', 'Toulouse', 'Bordeaux', 'Marseille', 'Nice', 'Rouen'].filter((c) => c !== city))
    const domain = r.pick(['ledger-verif-appareil', 'ledger-securite-update', 'ledgr-verification', 'ledger-controle-fr'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const cvBtc = exchange(w, 'coinhouse', 'btc')
    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const usdtSrcKey = r.pick((['coinbase', 'kraken', 'bitstamp'] as const).filter((k) => k !== destKey))
    const ethKits = new Map<string, ExchangeKit>()
    const ex = (k: string): ExchangeKit => {
      let x = ethKits.get(k)
      if (!x) {
        x = exchange(w, k, 'eth')
        ethKits.set(k, x)
      }
      return x
    }
    const cvEth = ex('coinhouse')
    const dest = ex(destKey)
    const usdtSrc = ex(usdtSrcKey)
    const sw = swapper(w, 'changenow')
    const uni = dex(w, 'uniswap', 'eth')
    const tether = w.entity('tether')

    const attE = w.customEntity({ name: 'Opérateur du faux courrier « Ledger » (inconnu)', category: 'suspect', description: 'Campagne de phishing par courrier postal usurpant la marque Ledger.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })

    const T = w.at(0) // saisie des 24 mots sur le faux site

    // ── Portefeuilles de la victime (une seule phrase de récupération) ───────
    const nBtcAddr = r.int(3, 4)
    const victimBtc = w.addrs('btc', nBtcAddr, { entity: victimE, kind: 'p2wpkh' })
    for (const a of victimBtc) {
      for (let k = 0; k < (r.chance(0.4) ? 2 : 1); k++) cvBtc.withdraw(a, roundCoin(w, 0.03, 0.32, 0.0001), w.at(-r.float(40, 900) * 24))
    }
    const a1 = w.addr('eth', { entity: victimE }) // compte « Ethereum 1 » : ETH
    const a2 = w.addr('eth', { entity: victimE }) // compte « Ethereum 2 » : USDT, sans ETH
    cvEth.withdraw(a1, roundAsset('ETH', r.float(0.6, 2.4)), w.at(-r.float(300, 700) * 24))
    cvEth.withdraw(a1, roundAsset('ETH', r.float(0.4, 1.8)), w.at(-r.float(30, 280) * 24))
    const usdtA = Math.round(r.float(4000, 16000) / 100) * 100
    const usdtB = Math.round(r.float(1500, 9000) / 100) * 100
    usdtSrc.withdraw(a2, usdtA, w.at(-r.float(200, 500) * 24), 'USDT')
    usdtSrc.withdraw(a2, usdtB, w.at(-r.float(20, 180) * 24), 'USDT')
    const usdtStolen = usdtA + usdtB
    const ethHeld = roundAsset('ETH', w.balanceOf(a1, 'ETH'))

    // ── Infrastructure de l'attaquant ────────────────────────────────────────
    const gas = w.addr('eth', { entity: attE })
    const e1 = w.addr('eth', { entity: attE })
    const e2 = w.addr('eth', { entity: attE })
    const b1 = w.addr('btc', { entity: attE, kind: 'p2wpkh' })
    // Le financeur de gaz est approvisionné par un paiement ChangeNOW (origine inconnue)
    const gasFundTx = w.transfer({ time: w.at(-r.float(45, 75) * 24), from: sw.hot('eth'), to: gas, value: roundAsset('ETH', r.float(0.12, 0.3)), asset: 'ETH', method: 'payout' })

    // ── Autres victimes balayées grâce au même financeur de gaz ──────────────
    const nOther = r.int(2, 3)
    const otherTimes = [w.at(-r.float(25, 45) * 24), w.at(-r.float(4, 18) * 24), w.at(r.float(1.5, 4) * 24)].slice(0, nOther)
    const others: { addr: string; drain: Tx; gasTx: Tx; value: number; asset: AssetId; t: number }[] = []
    otherTimes.forEach((t, i) => {
      const ve = i === 0 ? w.customEntity({ name: v2P.name, category: 'victim' }) : w.customEntity({ name: 'Victime non identifiée', category: 'victim' })
      const v = w.addr('eth', { entity: ve })
      const asset: AssetId = r.chance(0.65) ? 'USDT' : 'USDC'
      const value = Math.round(r.float(1500, 22000) / 10) * 10
      ex(r.pick(['coinbase', 'kraken', 'binance', 'bitstamp'])).withdraw(v, value, t - Math.round(r.float(20, 300) * DAY), asset)
      const gasTx = w.transfer({ time: t, from: gas, to: v, value: roundAsset('ETH', r.float(0.004, 0.009)), asset: 'ETH' })
      const collector = w.addr('eth', { entity: attE })
      const drain = w.transfer({ time: t + r.int(60, 240), from: v, to: collector, value, asset })
      uni.swap({ trader: collector, assetIn: asset, amountIn: value, assetOut: 'ETH', time: t + r.int(15, 60) * 60 })
      others.push({ addr: v, drain, gasTx, value, asset, t })
    })

    // ── Tentatives sans suite : phrases volées, comptes déjà vides ───────────
    // Le script envoie du gaz à chaque compte dérivé d'une phrase récoltée ;
    // quand le propriétaire avait déjà déplacé ses jetons, rien ne suit.
    const nEmpty = r.int(4, 5)
    const empties: { addr: string; gasTx: Tx }[] = []
    for (let i = 0; i < nEmpty; i++) {
      const v = w.addr('eth')
      const k = ex(r.pick(['coinbase', 'kraken', 'binance', 'bitstamp']))
      const old = Math.round(r.float(500, 6000) / 10) * 10
      const tGasE = w.at(r.float(-40, 3) * 24)
      const tOld = w.at(-r.float(120, 600) * 24)
      k.withdraw(v, old, tOld, 'USDT')
      // Le propriétaire a depuis déplacé ses jetons vers un autre portefeuille, au moins deux mois avant l'envoi de gaz
      w.transfer({ time: Math.min(tOld + Math.round(r.float(5, 90) * DAY), tGasE - 60 * DAY), from: v, to: w.addr('eth'), value: old, asset: 'USDT' })
      empties.push({ addr: v, gasTx: w.transfer({ time: tGasE, from: gas, to: v, value: roundAsset('ETH', r.float(0.003, 0.008)), asset: 'ETH' }) })
    }

    // ── Le vol : tout part dans les mêmes minutes ────────────────────────────
    const tB = T + r.int(6, 14) * 60
    const nUtxo = victimBtc.reduce((s, a) => s + w.utxosOf(a, tB).length, 0)
    const btcTotal = victimBtc.reduce((s, a) => s + w.unspentValue(a, tB), 0)
    const feeB = w.estimateFee('btc', nUtxo, 1)
    const btcSweep = w.utxoTx({ time: tB, from: victimBtc, to: [{ address: b1, value: floor8(btcTotal - feeB) }], fee: feeB, change: null, spendAll: true })
    const btcStolen = btcSweep.outputs[0].value

    const tA1 = T + r.int(7, 16) * 60
    const ethSweep = w.transfer({ time: tA1, from: a1, to: e1, value: floor6(w.balanceOf(a1, 'ETH')), asset: 'ETH' })
    const tGas = T + r.int(8, 15) * 60
    const gasA2 = w.transfer({ time: tGas, from: gas, to: a2, value: roundAsset('ETH', r.float(0.004, 0.009)), asset: 'ETH' })
    const usdtSweep = w.transfer({ time: tGas + r.int(60, 240), from: a2, to: e1, value: usdtStolen, asset: 'USDT' })

    // USDT → ETH sur Uniswap avant tout gel possible
    const tSwap = usdtSweep.time + r.int(15, 55) * 60
    const swp = uni.swap({ trader: e1, assetIn: 'USDT', amountIn: usdtStolen, assetOut: 'ETH', time: tSwap })
    const swapDelayMin = Math.round((tSwap - usdtSweep.time) / 60)

    // Éclatement d'une partie de l'ETH vers des adresses neuves, avant le dépôt
    const branches = decoyBranches(w, e1, { time: tSwap + r.int(5, 15) * 60, share: r.float(0.22, 0.32), branches: 3, asset: 'ETH', returnTo: gas })
    const lastBranch = Math.max(...branches.map((b) => b.tx.time))

    // Dépôt des ETH sur l'exchange. L'adresse de dépôt, récente, n'est pas
    // encore étiquetée dans l'outil : elle se reconnaît à son balayage.
    const dep = dest.newDeposit()
    w.hiddenAttribution.add(dep)
    const e1Dep = floor6(w.balanceOf(e1, 'ETH') - r.float(0.004, 0.012))
    const d1 = dest.receive(e1, e1Dep, Math.max(T + Math.round(r.float(1.5, 2.5) * HOUR), lastBranch + r.int(10, 30) * 60), { asset: 'ETH', depositAddr: dep, sweepDelayH: r.float(0.3, 1) })
    // Poussière d'empoisonnement reçue après le dépôt (sosies de l'adresse)
    dusting(w, e1, { time: T + DAY, n: 2, spreadH: 18, min: d1.tx.time + HOUR })

    // BTC : peel chain courte, puis ChangeNOW (BTC → ETH)
    const peel = peelChain(w, { start: b1, steps: r.int(3, 4), time: T + Math.round(r.float(2, 3) * HOUR), stepH: [1, 1.8], peelFraction: [0.05, 0.12], peelTarget: () => w.addr('btc', { kind: 'p2wpkh' }) })
    const peelEnd = peel[peel.length - 1].next
    const peeled = floor8(peel.reduce((s, p) => s + p.peelValue, 0))
    const ord = btcOrderAll(w, sw, { from: peelEnd, time: peel[peel.length - 1].tx.time + r.int(25, 80) * 60, recipient: e2, feePct: r.float(0.006, 0.012) })
    const orderUsd = usd('BTC', ord.value)
    const orderDelay = Math.round((ord.payoutTx.time - ord.depositTx.time) / 60)

    // E2 dépose sur la MÊME adresse de dépôt que E1
    const e2Dep = floor6(w.balanceOf(e2, 'ETH') - r.float(0.003, 0.008))
    const d2 = dest.receive(e2, e2Dep, ord.payoutTx.time + Math.round(r.float(1, 3) * HOUR), { asset: 'ETH', depositAddr: dep, sweepDelayH: r.float(0.3, 1) })
    const totalDeposited = roundAsset('ETH', e1Dep + e2Dep)
    // Délai de balayage observé (le plus long des deux), pour le texte
    const sweepMin = Math.max(...[d1, d2].map((d) => (d.sweep ? Math.ceil((d.sweep.time - d.tx.time) / 60) : 0)))

    // ── Bruit ────────────────────────────────────────────────────────────────
    // Autres clients de ChangeNOW (BTC → ETH) autour de l'affaire
    for (let i = 0; i < r.int(3, 5); i++) {
      const c = w.addr('btc', { kind: 'p2wpkh' })
      const tO = w.at(r.float(-1, 2) * 24)
      w.fund(c, roundCoin(w, 0.02, 0.9, 0.0001), tO - r.int(2, 48) * HOUR)
      btcOrderAll(w, sw, { from: c, time: tO, recipient: w.addr('eth'), decoys: r.int(1, 3) })
    }
    // Paiements ChangeNOW de montant proche, hors de la fenêtre de corrélation
    for (let i = 0; i < 4; i++) {
      const dt = r.pick([-1, 1]) * r.float(4, 30) * HOUR
      w.transfer({ time: Math.round(ord.payoutTx.time + dt), from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', ord.payoutValue * r.float(0.96, 1.04)), asset: 'ETH', method: 'payout' })
    }
    uni.noise(35, w.at(-2 * 24), w.at(4 * 24), [['ETH', 'USDT'], ['ETH', 'USDC'], ['ETH', 'DAI']])
    dest.noise(16, w.at(-2 * 24), w.at(5 * 24), 'ETH')
    dest.noise(6, w.at(-2 * 24), w.at(5 * 24), 'USDT')
    cvBtc.noise(8, w.at(-3 * 24), w.at(3 * 24))
    cvEth.noise(6, w.at(-3 * 24), w.at(3 * 24), 'ETH')
    usdtSrc.noise(5, w.at(-3 * 24), w.at(3 * 24), 'USDT')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const destName = dest.entity.name
    const v2 = others[0]
    const lossUsd = usd('BTC', btcStolen) + usd('ETH', ethHeld) + usdtStolen
    const firstMove = Math.min(tB, tA1, tGas)
    const lastMove = Math.max(tB, ethSweep.time, usdtSweep.time)
    const windowMin = Math.max(1, Math.round((lastMove - firstMove) / 60))
    // Courrier distribué en fin de matinée
    const letterDate = atHour(w.at(-r.float(3, 8) * 24), 11) + 20 * 60
    const letterDays = Math.max(1, Math.round((T - letterDate) / DAY))
    // Le domaine existe avant l'envoi du courrier qui pointe vers lui
    const domainAge = letterDays + r.int(4, 12)
    // Plainte déposée le lendemain matin, aux heures d'ouverture
    const plainteDate = atHour(T + DAY, 10) + 25 * 60

    return {
      world: w,
      title: `Faux courrier Ledger — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie et accès frauduleux. ${g('Il', 'Elle')} a reçu par la poste un courrier à en-tête de Ledger, le fabricant de son portefeuille matériel, lui demandant de « vérifier » son appareil via un QR code avant une date limite. Le site ouvert par le QR code lui a demandé ses 24 mots de récupération ; ${g('il', 'elle')} les a saisis.\n\n` +
        `Ledger n'est pour rien dans ce courrier : c'est une usurpation de sa marque, rendue crédible par les fuites de données clients dont l'entreprise a été victime par le passé. Ledger ne demande jamais la phrase de récupération, et un portefeuille matériel n'est pas un compte : quiconque connaît les 24 mots reconstitue toutes les clés, sur toutes les chaînes.\n\n` +
        `Dans l'heure qui a suivi, tous les actifs de la victime ont été transférés : bitcoins, ETH et USDT. Objectifs : reconstituer le vol sur Bitcoin et sur Ethereum, exploiter le financement du gaz pour relier d'autres victimes, et retrouver l'exchange où les fonds convergent.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteDate, author: victimName,
          body:
            `« J'ai reçu une lettre de Ledger, avec le logo, mon nom et mon adresse exacts. Elle disait qu'une mise à jour de sécurité était obligatoire. J'ai scanné le QR code avec mon téléphone ; la page ressemblait à Ledger Live et m'a demandé mes 24 mots pour "confirmer l'authenticité de l'appareil". Je les ai tapés le ${fmtDate(T)}.\n\n` +
            `Le lendemain matin, mes comptes étaient vides. Voici ce que j'avais, d'après l'export de Ledger Live :\n` +
            `• Bitcoin (${amt(floor8(btcTotal), 'BTC')}), adresses ayant reçu des fonds :\n` +
            victimBtc.map((a) => `  ${A(w, a)}`).join('\n') + '\n' +
            `• Ethereum 1 : ${A(w, a1)} (${amt(ethHeld, 'ETH')})\n` +
            `• Ethereum 2 : ${A(w, a2)} (${amt(usdtStolen, 'USDT')}, mon épargne en dollars)\n\n` +
            `Je n'ai jamais donné ma phrase à personne d'autre. »`,
        },
        {
          id: 'courrier', type: 'capture', title: 'Scan du courrier reçu', date: letterDate,
          body:
            `[Logo et charte graphique imitant Ledger]\n` +
            `Objet : mise à jour de sécurité obligatoire de votre appareil\n\n` +
            `${g('Cher client', 'Chère cliente')},\n` +
            `Suite au renforcement de nos protocoles de sécurité, tous les appareils doivent faire l'objet d'une vérification avant le ${fmtDate(T + 5 * DAY, false)}. Sans cette vérification, l'accès à vos actifs pourrait être restreint.\n` +
            `Scannez le QR code ci-dessous et suivez la procédure (environ 5 minutes).\n\n` +
            `[QR code → hxxps://${domain}[.]example/fr/verify]\n` +
            `Le service Sécurité`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT sur le site de phishing', date: atHour(T + 2 * DAY, 11), author: 'Section cyber',
          body:
            `Domaine ${domain}[.]example enregistré ${domainAge} jours avant les faits (le courrier a été reçu ${letterDays} jours avant), titulaire masqué, hébergement derrière un service de protection anti-DDoS. La page reproduit l'interface de Ledger Live et envoie les mots saisis à un serveur distant : c'est un kit de phishing générique, déjà observé contre d'autres marques de portefeuilles.\n` +
            `Ledger rappelle publiquement ne jamais demander la phrase de récupération, ni par courrier, ni par téléphone, ni en ligne. Les destinataires sont vraisemblablement tirés de fichiers clients ayant fuité : la marque est usurpée, l'entreprise n'est pas impliquée.\n` +
            `Demandes en cours : signalement PHAROS et blocage du domaine auprès du registraire.`,
        },
        {
          id: 'rapprochement', type: 'email', title: 'Message d\'un autre service enquêteur', date: atHour(T + 3 * DAY, 9) + 40 * 60, author: `Brigade de recherches ${de(city2)}`,
          body:
            `Bonjour,\n` +
            `Nous traitons la plainte ${deN(v2P.name)} (${city2}), destinataire du même faux courrier Ledger. Sa phrase de récupération a été saisie sur un site similaire ; son adresse Ethereum ${A(w, v2.addr)} a été vidée de ${amt(v2.value, v2.asset)} le ${fmtDate(v2.drain.time, false)} (transaction ${v2.drain.hash}).\n` +
            `Avez-vous des éléments communs ? Un rapprochement des procédures nous semble pertinent.\n` +
            `Cordialement`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : une phrase, toutes les chaînes', date: atHour(T + 2 * DAY, 15), author: 'Cellule d\'appui',
          body:
            `• Les 24 mots permettent de dériver toutes les clés du portefeuille : chaque adresse Bitcoin, chaque compte Ethereum. L'attaquant importe la phrase dans un logiciel et vide tout, souvent avec un script.\n` +
            `• Sur Bitcoin, les UTXO de plusieurs adresses peuvent être dépensées dans une seule transaction : ici, ce regroupement désigne le portefeuille compromis, pas le voleur.\n` +
            `• Sur Ethereum, déplacer un jeton ERC-20 coûte du gaz, payé en ETH par l'adresse émettrice. Un compte qui ne détient que des USDT doit d'abord recevoir un peu d'ETH : l'adresse qui l'envoie appartient à l'attaquant, et elle sert souvent pour toutes ses victimes.\n` +
            `• Le saut BTC → ETH par un échangeur instantané ne laisse aucun lien on-chain : il se retrouve par corrélation (service, montant, horaire).`,
        },
      ],
      seeds: [victimBtc[0], a2],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 9,
          prompt: 'Quelle transaction a vidé le portefeuille Bitcoin de la victime ?',
          answer: [btcSweep.id],
          hint: 'Dépliez les sorties des adresses Bitcoin listées dans la plainte : elles sont toutes dépensées par la même transaction.',
          explanation: `Le ${fmtDate(tB)}, une seule transaction dépense les ${nUtxo} UTXO des ${nBtcAddr} adresses de la victime et envoie ${amt(btcStolen, 'BTC')} vers ${A(w, b1)}, sans rendu. Les vidages Ethereum ont lieu dans les mêmes minutes (fenêtre d'environ ${windowMin} min entre le premier et le dernier transfert) : c'est la signature d'un attaquant qui a restauré la phrase et balaie toutes les chaînes à la fois. Attention au réflexe de clustering : ces entrées communes regroupent les adresses de la victime, dont la clé est compromise, et ne désignent pas l'attaquant.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Vers quelle adresse de l\'attaquant les ETH et les USDT de la victime ont-ils été transférés ?',
          answer: [e1],
          hint: 'Dépliez les sorties des deux comptes Ethereum de la plainte : les deux vidages aboutissent à la même adresse.',
          explanation: `${A(w, e1)} reçoit ${amt(ethSweep.transfers[0].value, 'ETH')} du compte 1 à ${hhmm(ethSweep.time)} et ${amt(usdtStolen, 'USDT')} du compte 2 à ${hhmm(usdtSweep.time)}. Deux comptes de la victime vidés vers la même adresse dans les mêmes minutes : c'est le portefeuille de réception de l'attaquant sur Ethereum, point de départ de la suite du traçage.`,
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'Quelle adresse a fourni l\'ETH nécessaire (le gaz) pour transférer les USDT de la victime ?',
          answer: [gas],
          hint: 'Le compte « Ethereum 2 » ne détenait aucun ETH. Regardez ce qu\'il reçoit juste avant le départ des USDT.',
          explanation: `Le compte ${A(w, a2)} ne détenait que des USDT : impossible de les déplacer sans ETH pour payer le gaz. À ${hhmm(gasA2.time)}, ${A(w, gas)} lui envoie ${amt(gasA2.transfers[0].value, 'ETH')} ; ${Math.max(1, Math.round((usdtSweep.time - gasA2.time) / 60))} min plus tard, les ${amt(usdtStolen, 'USDT')} partent vers ${A(w, e1)}. Le financeur de gaz appartient à l'attaquant : il a lui-même été approvisionné par un paiement ChangeNOW le ${fmtDate(gasFundTx.time, false)}.`,
        },
        {
          id: 'o3', type: 'addresses', points: 10,
          prompt: 'Hormis le compte de la victime, quels comptes alimentés en gaz par ce financeur ont effectivement été vidés ?',
          answer: others.map((o) => o.addr),
          hint: 'Dépliez les sorties du financeur de gaz. Pour chaque destinataire, regardez ce qui suit le petit envoi d\'ETH : un départ de jetons dans les minutes qui suivent, ou rien du tout ?',
          explanation:
            `Le financeur ${A(w, gas)} a vidé ${nOther} autres comptes selon le même schéma que celui de la victime (quelques millièmes d'ETH, puis départ de tous les jetons dans les minutes qui suivent) :\n` +
            others.map((o) => `• ${A(w, o.addr)} : ${amt(o.value, o.asset)} le ${fmtDate(o.drain.time, false)}${o === v2 ? ` (plainte ${deN(v2P.name)}, ${city2})` : ' (victime à identifier)'}`).join('\n') +
            `\nLes ${nEmpty} autres destinataires de gaz n'ont rien perdu : leurs propriétaires avaient déplacé leurs jetons vers un autre portefeuille des mois plus tôt, et rien ne suit l'envoi d'ETH. Ce sont des phrases récoltées par la même campagne, sur des comptes déjà vides : des victimes de la collecte, sans préjudice financier. Les victimes vidées non identifiées peuvent l'être par réquisition aux exchanges qui ont financé leurs adresses.`,
        },
        {
          id: 'o12', type: 'number', points: 8, unit: 'comptes',
          prompt: 'À combien de comptes au total ce financeur a-t-il envoyé du gaz (compte « Ethereum 2 » de la victime compris, tentatives sans suite comprises) ?',
          answer: 1 + nOther + nEmpty,
          hint: 'Comptez les destinataires des sorties d\'ETH du financeur de gaz. Les ETH qu\'il reçoit en retour ne comptent pas.',
          explanation: `${1 + nOther + nEmpty} comptes : celui de la victime, ${nOther} autres comptes vidés et ${nEmpty} comptes déjà vides. Chaque destinataire correspond à une phrase de récupération tombée entre les mains de l'attaquant : c'est la mesure de la campagne, au-delà du seul préjudice.${branches.some((b) => b.fate === 'retour') ? ' Le financeur reçoit aussi de l\'ETH en retour, depuis une branche issue de l\'adresse de réception : l\'attaquant recycle une partie du butin pour payer le gaz des prochains vidages.' : ''}`,
        },
        {
          id: 'o4', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.02,
          prompt: 'Combien d\'ETH l\'attaquant a-t-il obtenus en échangeant les USDT volés sur Uniswap ?',
          answer: swp.amountOut,
          hint: 'Ouvrez le swap de l\'adresse qui a reçu les USDT : les USDT partent vers le pool, l\'ETH revient via le routeur.',
          explanation: `${swapDelayMin} minutes après le vol, ${A(w, e1)} échange ${amt(usdtStolen, 'USDT')} contre ${amt(swp.amountOut, 'ETH')} sur Uniswap. La conversion rapide n'est pas un hasard : ${tether.name} peut geler des USDT sur une adresse, pas des ETH. Une fois le swap fait, la fenêtre de gel est fermée ; d'où l'intérêt de saisir l'émetteur dès les premières minutes.`,
        },
        {
          id: 'o9', type: 'number', points: 9, unit: 'minutes', tolerance: 2,
          prompt: 'Combien de minutes se sont écoulées entre l\'arrivée des USDT volés chez l\'attaquant et leur conversion en ETH ?',
          answer: swapDelayMin,
          hint: 'Comparez l\'horodatage du transfert des USDT depuis le compte « Ethereum 2 » et celui du swap USDT → ETH effectué par l\'adresse qui les a reçus.',
          explanation: `${swapDelayMin} minutes : les USDT arrivent à ${hhmm(usdtSweep.time)}, le swap a lieu à ${hhmm(tSwap)}. C'est la fenêtre pendant laquelle une demande de gel à ${tether.name} aurait pu bloquer les fonds. Elle est presque toujours trop courte pour une victime qui découvre le vol le lendemain : d'où l'intérêt, pour les enquêteurs, de connaître les circuits d'urgence avec les émetteurs.`,
        },
        {
          id: 'o10', type: 'tx', points: 9,
          prompt: 'Quelle transaction a déposé les bitcoins chez ChangeNOW (hash à transmettre dans la réquisition) ?',
          answer: [ord.depositTx.id],
          hint: 'Suivez la grosse sortie de chaque saut de pelage depuis l\'adresse qui a reçu les bitcoins : la dernière adresse de la chaîne est vidée, sans rendu, vers une adresse de dépôt ChangeNOW.',
          explanation: `Le ${fmtDate(ord.depositTx.time)}, la dernière adresse de la peel chain (${A(w, peelEnd)}) envoie ${amt(ord.value, 'BTC')} sur l'adresse de dépôt ChangeNOW ${A(w, ord.deposit)}, sans rendu. Le hash de ce dépôt est la clé de la réquisition : il permet à l'échangeur de retrouver la commande et son adresse de paiement.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Les bitcoins finissent chez ChangeNOW. Quelle adresse Ethereum a reçu la contrepartie en ETH ?',
          answer: [e2],
          hint: `Suivez la peel chain jusqu'au dépôt ChangeNOW, puis lancez une corrélation : émetteur ChangeNOW, chaîne Ethereum, fenêtre d'environ 1 h, valeur ≈ ${usd0(orderUsd)}. Parmi les candidats, lequel rejoint ensuite une adresse déjà connue ?`,
          explanation: `Après ${peel.length} sauts de pelage (${amt(peeled, 'BTC')} détachés vers des adresses tierces), ${amt(ord.value, 'BTC')} (≈ ${usd0(orderUsd)}) sont déposés chez ChangeNOW. ${orderDelay} minutes plus tard, ChangeNOW verse ${amt(ord.payoutValue, 'ETH')} à ${A(w, e2)}. La corrélation seule reste une hypothèse ; elle est confirmée par la suite : ${A(w, e2)} dépose sur la même adresse de dépôt ${destName} que ${A(w, e1)}, qui a reçu les ETH et les USDT de la victime.`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt de l\'exchange de convergence reçoit les fonds des deux chaînes ?',
          answer: [dep],
          hint: 'L\'adresse de réception Ethereum a plusieurs sorties d\'ETH vers des adresses sans étiquette. Regardez ce que devient chacune : laquelle est balayée vers un hot wallet étiqueté, et reçoit aussi les ETH payés par ChangeNOW ?',
          explanation:
            `${A(w, dep)} reçoit ${amt(e1Dep, 'ETH')} le ${fmtDate(d1.tx.time)} puis ${amt(e2Dep, 'ETH')} le ${fmtDate(d2.tx.time)}, et chaque dépôt est balayé vers le hot wallet de ${destName} en ${sweepMin} minutes au plus. L'outil ne l'étiquette pas (adresse récente), mais ce balayage systématique et la convergence des deux flux la désignent. Les ${branches.length} autres sorties d'ETH de ${A(w, e1).slice(0, 10)}… sont des branches de moindre montant qui n'aboutissent à aucun service :\n` +
            branches.map((b) => `• ${A(w, b.address).slice(0, 12)}… : ${amt(b.value, 'ETH')}, ${BRANCH_FATE[b.fate]}`).join('\n') +
            `\nUne adresse de dépôt est propre à un compte client : c'est elle, avec les deux hash, qu'il faut citer dans la réquisition.`,
        },
        {
          id: 'o6', type: 'entity', points: 9,
          prompt: 'Sur quel exchange les fonds des deux chaînes convergent-ils ?',
          answer: [destKey],
          hint: 'Suivez les ETH de l\'adresse qui a vidé les comptes Ethereum, puis ceux de l\'adresse payée par ChangeNOW.',
          explanation: `${A(w, e1)} dépose ${amt(e1Dep, 'ETH')} et ${A(w, e2)} ${amt(e2Dep, 'ETH')} sur la même adresse de dépôt ${A(w, dep)}, balayée ensuite vers le hot wallet de ${destName} : ${amt(totalDeposited, 'ETH')} au total, sur un seul compte client. Le vol sur Bitcoin et le vol sur Ethereum aboutissent au même endroit, ce qui achève de les relier.`,
        },
        {
          id: 'o7', type: 'choice', points: 9,
          prompt: 'Quelle suite procédurale retenir ?',
          hint: 'Qui détient encore les fonds ou une identité ? Ledger a-t-il seulement accès aux clés ? Reste-t-il des USDT à geler ?',
          ...choice(r,
            `Requérir ${destName} sur l'adresse de dépôt (identité, IP, gel), ChangeNOW avec le hash du dépôt BTC, et rapprocher les procédures des victimes du même financeur de gaz`,
            [
              'Requérir Ledger, qui peut bloquer l\'appareil de la victime et révoquer la phrase de récupération compromise',
              `Demander à ${tether.name} de geler les USDT volés sur l'adresse de l'attaquant`,
              'Requérir Coinhouse, qui a vendu les bitcoins à la victime, pour identifier l\'auteur du vol',
            ]),
          explanation:
            `${destName} détient le titulaire du compte qui a reçu ${amt(totalDeposited, 'ETH')} : réquisition prioritaire avec demande de gel. ${procedureFor(dest.entity)}\n` +
            `ChangeNOW peut confirmer, à partir du hash du dépôt (${ord.depositTx.hash.slice(0, 16)}…), l'adresse de paiement de la commande et ses métadonnées. ${procedureFor(sw.entity)}\n` +
            `Ledger n'a aucun accès aux clés de ses clients (portefeuille non-custodial) : il ne peut rien bloquer ni révoquer, et sa marque est ici usurpée ; on lui signale le courrier, sans plus. Les USDT ont été échangés contre de l'ETH ${swapDelayMin} minutes après le vol : il n'y a plus rien à geler chez ${tether.name}. Coinhouse n'est que la plateforme d'achat de la victime.`,
        },
      ],
      truth: {
        path: [
          // Les vidages d'autres victimes postérieurs aux faits restent hors du flux de l'affaire
          gasFundTx.id, ...others.filter((o) => o.t < T).flatMap((o) => [o.gasTx.id, o.drain.id]),
          btcSweep.id, ethSweep.id, gasA2.id, usdtSweep.id, swp.tx.id, d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []),
          ...peel.map((p) => p.tx.id), ord.depositTx.id, ord.sweepTx.id, ord.payoutTx.id, d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : []),
        ],
        addresses: [...victimBtc, a1, a2, b1, gas, e1, e2, peelEnd, ord.deposit, dep, ...others.map((o) => o.addr)],
        debrief:
          `1. ${victimName} saisit ses 24 mots sur ${domain}[.]example le ${fmtDate(T)}. Ledger n'y est pour rien : sa marque est usurpée.\n` +
          `2. Dans les minutes qui suivent, l'attaquant vide tout. Bitcoin : une transaction dépense les ${nUtxo} UTXO de la victime et envoie ${amt(btcStolen, 'BTC')} vers ${A(w, b1)}. Ethereum : ${amt(ethHeld, 'ETH')} partent du compte 1 vers ${A(w, e1)} ; le compte 2, sans ETH, reçoit du gaz de ${A(w, gas)}, puis ses ${amt(usdtStolen, 'USDT')} partent vers la même adresse.\n` +
          `3. Le même financeur de gaz a servi pour ${nOther} autres victimes vidées, dont ${v2P.name} (${city2}), et pour ${nEmpty} comptes déjà vides (phrases récoltées sans préjudice).\n` +
          `4. ${swapDelayMin} minutes après le vol, les USDT sont échangés contre ${amt(swp.amountOut, 'ETH')} sur Uniswap, hors de portée d'un gel par ${tether.name}. ${A(w, e1)} éclate une partie de l'ETH en ${branches.length} branches sans issue, puis dépose ${amt(e1Dep, 'ETH')} sur une adresse de dépôt ${destName} non étiquetée, reconnaissable à son balayage. Les poussières d'USDT reçues ensuite viennent de sosies de l'adresse (empoisonnement) et ne signifient rien.\n` +
          `5. Les bitcoins suivent une peel chain de ${peel.length} sauts (${amt(peeled, 'BTC')} détachés), puis ${amt(ord.value, 'BTC')} sont convertis chez ChangeNOW : ${amt(ord.payoutValue, 'ETH')} versés à ${A(w, e2)}, qui dépose ${amt(e2Dep, 'ETH')} sur la même adresse de dépôt ${destName}.\n` +
          `6. Préjudice de la victime : ≈ ${usd0(lossUsd)}.\n\n` +
          `À retenir : la phrase de récupération est le portefeuille. Celui qui la détient vide toutes les chaînes à la fois, et ce synchronisme relie les flux BTC et ETH. Sur Ethereum, le financement du gaz est un pivot précieux : une adresse qui « prépare » des comptes avant de les vider relie souvent toute une campagne. Les sauts sans lien on-chain (échangeur instantané) se franchissent par corrélation, à confirmer par la convergence des flux et par réquisition.`,
      },
      hints: [
        'Partez des adresses de la plainte : dépliez les sorties des adresses Bitcoin et du compte « Ethereum 2 ». Notez les heures.',
        'Le compte qui ne détenait que des USDT a dû recevoir de l\'ETH avant d\'être vidé : dépliez les sorties de l\'adresse qui le lui a envoyé.',
        'Côté Bitcoin, suivez la grosse sortie de chaque saut jusqu\'au dépôt ChangeNOW, puis utilisez l\'outil de corrélation vers Ethereum. Comparez l\'adresse de dépôt atteinte avec celle de l\'autre flux.',
        'L\'adresse de réception Ethereum éclate une partie de l\'ETH vers plusieurs adresses neuves : une seule de ses sorties est balayée vers un hot wallet étiqueté, et c\'est aussi là qu\'arrivent les ETH payés par ChangeNOW.',
        'Tenez une chronologie à la minute : saisie des mots, vidages, swap, dépôts. Les écarts entre ces heures sont des éléments d\'enquête.',
      ],
    }
  },
}
