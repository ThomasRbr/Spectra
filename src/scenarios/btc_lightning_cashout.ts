import { World, type Tx } from '../engine/world'
import { exchange, lnCustodial, openChannel, roundCoin, HOUR, DAY, type LnRecord } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { Entity } from '../engine/entities'
import { dusting, otherVictimPayments } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const SAT = 1e8
const sats = (v: number) => Math.round(v * SAT)
const fmtSat = (n: number) => n.toLocaleString('fr-FR')

type Fate = 'dort' | 'dépensée' | 'retour' | 'éclatée'

export const btcLightningCashout: ScenarioTemplate = {
  id: 'lightning-cashout',
  title: 'Sortie par Lightning',
  tagline: 'Des canaux qui s\'ouvrent et se ferment, des envois jumeaux, des branches mortes, et un prestataire qui, lui, a tout noté.',
  description:
    'Le produit d\'une campagne de sextorsion part dans le réseau Lightning : canaux ouverts avec un fournisseur de liquidité, paiements hors chaîne, fermetures, puis retour vers la blockchain. Le suspect brouille les pistes : éclatement en branches sans issue, envoi jumeau de même montant vers une autre sortie P2WSH, portefeuille personnel chargé d\'un historique. Triez à chaque étape, reconstituez les entrées et sorties on-chain et identifiez le prestataire qui détient l\'historique des paiements.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['utxo', 'lecture_tx', 'change', 'privacy', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 95,
  lessons: ['lightning', 'requisitions', 'cooperation-internationale', 'typologies', 'utxo'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const handle = fakeHandle(r)
    const complainant = fakePerson(r, 'm')

    const vp = lnCustodial(w, 'voltpocket')
    const lumen = w.entity('lumen_lsp')
    const chx = exchange(w, 'coinhouse', 'btc')
    const host = w.customEntity({
      name: 'NordHost', category: 'merchant', known: true, risk: 'high', country: 'Seychelles',
      description: 'Hébergeur offshore (fictif) dit « bulletproof » : serveurs privés virtuels et relais d\'envoi de courriels en masse, payables en bitcoin, peu regardant sur les contenus hébergés.',
    })
    const suspect = w.customEntity({ name: `${sp.name} (mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: complainant.name, category: 'victim' })
    // Commerces fictifs propres au dossier (le spammeur achète des domaines, des cartes cadeaux, joue)
    const kadeo = w.customEntity({ name: 'Kadeo', category: 'merchant', known: true, risk: 'medium', description: 'Vente en ligne de cartes cadeaux contre crypto-actifs (fictif). Conserve l\'adresse électronique de livraison des codes.' })
    const domar = w.customEntity({ name: 'DomaRegistr', category: 'merchant', known: true, risk: 'medium', description: 'Bureau d\'enregistrement de noms de domaine payable en bitcoin (fictif), sans vérification d\'identité.' })
    const spin = w.customEntity({ name: 'Spinmoon', category: 'gambling', known: true, risk: 'medium', description: 'Casino en ligne crypto (fictif), inscription par simple adresse électronique.' })
    const mine = (kind: 'p2wpkh' | 'p2tr' = 'p2wpkh') => w.addr('btc', { entity: suspect, kind })
    const shopAddr = (e: string | Entity) => {
      const en = typeof e === 'string' ? w.entity(e) : e
      return w.addr('btc', { entity: en, label: `${en.name} — Paiement` })
    }
    const times = (n: number, a: number, b: number) => Array.from({ length: n }, () => Math.round(r.float(a, b))).sort((x, y) => x - y)
    /** Paiement simple avec rendu sur l'adresse elle-même ; ignoré si les fonds manquent à cet instant. */
    const pay = (from: string, to: string, v: number, t: number): Tx | undefined => {
      if (v <= 0 || w.unspentValue(from, t) < v + 0.00015) return undefined
      return w.utxoTx({ time: t, from: [from], to: [{ address: to, value: r8(v) }], change: from, autoFund: false })
    }

    // ════════════════════ FLUX RÉEL ════════════════════

    // ── Paiements des victimes de sextorsion (adresse unique réutilisée) ─────
    const S = mine()
    // Portefeuille « Perso » du suspect : adresse de réception réutilisée, aussi utilisée comme rendu
    const P = mine()
    const nV = r.int(12, 17)
    const named = r.int(2, 6)
    const pays: { tx: Tx; value: number; time: number }[] = []
    let t = w.at(0)
    for (let i = 0; i < nV; i++) {
      const va = i === named ? w.addr('btc', { entity: victimE, kind: 'p2wpkh' }) : w.addr('btc')
      const value = roundAsset('BTC', fromUsd('BTC', r.float(350, 1600)))
      pays.push({ tx: w.fund(S, value, t, { from: [va] }), value, time: t })
      t += Math.round(r.float(0.4, 2.2) * DAY)
    }
    const victimPay = pays[named]
    const demand = victimPay.value

    // ── Canal 1 : ouvert à mi-campagne depuis l'adresse de collecte ──────────
    const k1 = Math.floor(nV * 0.5)
    const tOpen1 = pays[k1].time + Math.round(r.float(3, 12) * HOUR)
    const cap1 = Math.max(0.01, Math.floor((w.unspentValue(S, tOpen1) * r.float(0.75, 0.9)) / 0.005) * 0.005)
    const S2 = mine()
    const ch1 = openChannel(w, { from: S, peer: lumen, capacity: r8(cap1), time: tOpen1, change: S2 })

    // ── Regroupement ─────────────────────────────────────────────────────────
    const tCons = pays[nV - 1].time + Math.round(r.float(6, 30) * HOUR)
    const S3 = mine()
    const consIn = w.unspentValue(S, tCons) + w.unspentValue(S2, tCons)
    const consN = w.utxosOf(S, tCons).length + w.utxosOf(S2, tCons).length
    const consFee = w.estimateFee('btc', consN, 1)
    const consTx = w.utxoTx({ time: tCons, from: [S, S2], to: [{ address: S3, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Éclatement en quatre branches sans issue (montants non ronds, P2WPKH) ──
    const fates = r.shuffle<Fate>(['dort', 'dépensée', 'retour', 'éclatée'])
    const brTotal = w.unspentValue(S3, tCons) * r.float(0.18, 0.28)
    const brParts = r.split(brTotal, 4, 0.8)
    let tb = tCons + Math.round(r.float(0.6, 1.4) * HOUR)
    const branches: { addr: string; tx: Tx; value: number; fate: Fate; follow: Tx[] }[] = []
    brParts.forEach((p, i) => {
      const value = r8(Math.round(p * 1e5) / 1e5 + r.int(1, 9) * 1e-8)
      const addr = mine()
      const tx = w.utxoTx({ time: tb, from: [S3], to: [{ address: addr, value }], change: S3 })
      branches.push({ addr, tx, value, fate: fates[i], follow: [] })
      tb += r.int(8, 35) * 60
    })

    // ── Canal 2 : financé par le reste du regroupement, rendu sur « Perso » ──
    const tOpen2 = tCons + Math.round(r.float(4.5, 9) * HOUR)
    const cap2 = Math.max(0.01, Math.floor((w.unspentValue(S3, tOpen2) * r.float(0.85, 0.95)) / 0.005) * 0.005)
    const ch2 = openChannel(w, { from: S3, peer: lumen, capacity: r8(cap2), time: tOpen2, change: P })
    const ch2Change = ch2.tx.outputs.find((o) => o.address === P)?.value ?? 0

    // ── Paiements Lightning (hors chaîne) vers le compte custodial ───────────
    const acct = `VP-${r.int(100000, 999999)}`
    const lnIn: LnRecord[] = []
    const lnOut: LnRecord[] = []
    const payIn = (time: number, satsV: number) => lnIn.push(vp.pay({ time, account: acct, sats: satsV, direction: 'receive', description: r.pick(['recharge', 'top-up', '', 'épargne']) }))
    const tClose1 = tOpen2 + Math.round(r.float(1, 3) * DAY)
    const via1 = Math.round(sats(cap1) * r.float(0.4, 0.6) / 1000) * 1000
    const n1 = r.int(2, 3)
    for (let i = 0; i < n1; i++) payIn(Math.round(r.float(tOpen1 + 2 * HOUR, tClose1 - 2 * HOUR)), Math.round(via1 / n1))
    const tClose2 = tOpen2 + Math.round(r.float(4, 8) * DAY)
    const via2 = Math.round(sats(cap2) * r.float(0.3, 0.5) / 1000) * 1000
    const n2 = r.int(2, 3)
    for (let i = 0; i < n2; i++) payIn(Math.round(r.float(tOpen2 + 2 * HOUR, tClose2 - 2 * HOUR)), Math.round(via2 / n2))

    // ── Fermetures ───────────────────────────────────────────────────────────
    const C1 = mine()
    const coopTx = ch1.cooperativeClose({ time: tClose1, toLocal: r8(cap1 - (n1 * Math.round(via1 / n1)) / SAT - 0.00002), localAddr: C1 })
    const C2 = mine(r.pick(['p2wpkh', 'p2tr'] as const))
    const fc = ch2.forceClose({ time: tClose2, toLocal: r8(cap2 - (n2 * Math.round(via2 / n2)) / SAT - 0.00002), by: 'local', sweepTo: C2 })
    const sweepTx = fc.sweepTx!
    const c1Value = coopTx.outputs.find((o) => o.address === C1)!.value
    const c2Value = sweepTx.outputs[0].value
    const recovered = r8(c1Value + c2Value)

    // ── Dépôt on-chain sur le compte custodial, puis retrait ─────────────────
    const tDep = tClose1 + Math.round(r.float(2, 10) * HOUR)
    const dep = vp.deposit(C1, r8(w.unspentValue(C1, tDep) - 0.00005), tDep, { change: null, sweepDelayH: r.float(0.5, 4) })
    const depValue = dep.tx.outputs.find((o) => o.address === dep.deposit)!.value
    for (let i = 0; i < r.int(2, 4); i++) {
      const kind = r.pick(['carte', 'bon', 'vpn', 'jeu'] as const)
      const eur = kind === 'vpn' ? r.pick([5, 10, 60]) : r.pick([25, 50, 100, 150, 200])
      const description = kind === 'carte' ? `carte cadeau ${eur} €` : kind === 'bon' ? `bon d'achat ${eur} €` : kind === 'vpn' ? `abonnement VPN ${eur} €` : `crédit jeu en ligne ${eur} €`
      lnOut.push(vp.pay({ time: Math.round(r.float(tDep + HOUR, tClose2 + 20 * HOUR)), account: acct, sats: sats(fromUsd('BTC', eur * 1.08)), direction: 'send', counterparty: 'nœud marchand', description }))
    }
    const balanceSat = sats(depValue) + lnIn.reduce((s, x) => s + x.sats, 0) - lnOut.reduce((s, x) => s + x.sats, 0)
    const wSat = Math.floor(balanceSat * r.float(0.86, 0.95) / 1000) * 1000
    const tW = Math.max(sweepTx.time, ...lnOut.map((x) => x.time)) + Math.round(r.float(10, 50) * HOUR)
    // Le « coffre » du suspect (portefeuille matériel), déjà alimenté avant les faits
    const W = mine(r.pick(['p2wpkh', 'p2tr'] as const))
    const wTx = vp.withdraw(W, wSat / SAT, tW)

    // ════════════════════ HABILLAGE ════════════════════

    // ── Sort des branches ────────────────────────────────────────────────────
    for (const b of branches) {
      const later = b.tx.time + Math.round(r.float(8, 60) * HOUR)
      if (b.fate === 'dépensée') {
        const n = r.int(2, 3)
        for (const ts of times(n, later, later + 5 * DAY)) {
          const shop = r.pick([kadeo, spin, kadeo, domar])
          const tx = pay(b.addr, shopAddr(shop), roundAsset('BTC', b.value * r.float(0.12, 0.27)), ts)
          if (tx) b.follow.push(tx)
        }
      } else if (b.fate === 'retour') {
        b.follow.push(forwardAll(w, b.addr, P, later))
      } else if (b.fate === 'éclatée') {
        const n = r.int(2, 3)
        for (let k = 0; k < n; k++) {
          const tx = pay(b.addr, w.addr('btc'), r8(Math.round((b.value / (n + 1)) * r.float(0.9, 1.05) * 1e5) / 1e5), later + k * r.int(600, 2400))
          if (tx) b.follow.push(tx)
        }
      }
    }
    const dormant = branches.find((b) => b.fate === 'dort')!

    // ── Ancienne campagne (adresse S0) : autres victimes, jumeau du canal 1, report vers « Perso » ──
    const S0 = mine()
    const oldTarget = cap1 * 1.03 + cap2 * r.float(1.2, 1.45)
    let oldSum = 0
    let nOld = 0
    const tOld0 = w.at(-r.float(110, 150) * 24)
    const tOld1 = w.at(-r.float(60, 80) * 24)
    while (oldSum < oldTarget) {
      const v = roundAsset('BTC', fromUsd('BTC', r.float(300, 1500)))
      w.fund(S0, v, Math.round(r.float(tOld0, tOld1)), { from: [w.addr('btc')] })
      oldSum += v
      nOld++
    }
    const Y = mine()
    let tTwinB = tOpen1 + r.int(-25, 25) * 60
    if (Math.abs(tTwinB - tOpen1) < 240) tTwinB = tOpen1 + (r.chance(0.5) ? 1 : -1) * r.int(6, 25) * 60
    const twinB = w.utxoTx({ time: tTwinB, from: [S0], to: [{ address: Y, value: r8(cap1) }], change: S0, autoFund: false })
    const tS0P = Math.round(Math.max(tOpen1 + 3 * HOUR, tOpen2 - r.float(20, 60) * HOUR))
    const s0p = forwardAll(w, S0, P, tS0P)
    // Jumeau du canal 2 : même capacité, même heure, autre sortie P2WSH (jamais dépensée)
    const vault = w.addr('btc', { kind: 'p2wsh', wallet: `vault:${suspect.id}` })
    let tTwinA = tOpen2 + r.int(-25, 25) * 60
    if (Math.abs(tTwinA - tOpen2) < 240) tTwinA = tOpen2 + (r.chance(0.5) ? 1 : -1) * r.int(6, 25) * 60
    const twinA = w.utxoTx({ time: tTwinA, from: [P], to: [{ address: vault, value: r8(cap2) }], change: P, autoFund: false })

    // ── Vie antérieure de « Perso » : compte Coinhouse, hébergeur, VPN, épargne vers le coffre ──
    const cxWithdrawals = times(r.int(4, 5), w.at(-r.float(170, 230) * 24), w.at(-50 * 24)).map((ts) => chx.withdraw(P, roundAsset('BTC', fromUsd('BTC', r.float(350, 1200))), ts))
    // Épargne : après chaque achat Coinhouse, une part rejoint le coffre dans les jours qui suivent
    const savings: Tx[] = []
    for (const cw of cxWithdrawals) {
      const tx = pay(P, W, Math.floor(receivedIn(w, cw, P) * r.float(0.4, 0.7) * 1e4) / 1e4, cw.time + Math.round(r.float(1, 6) * DAY))
      if (tx) savings.push(tx)
    }
    const hostPays: Tx[] = []
    // Factures de l'hébergeur avant la campagne, puis renouvellements (relais SMTP supplémentaires) pendant
    for (const ts of [...times(r.int(2, 3), w.at(-32 * 24), w.at(-1.5 * 24)), ...times(2, pays[1].time, tCons - 2 * HOUR)]) {
      const tx = pay(P, shopAddr(host), roundAsset('BTC', fromUsd('BTC', r.float(90, 260))), ts)
      if (tx) hostPays.push(tx)
    }
    for (const ts of times(2, w.at(-110 * 24), w.at(-10 * 24))) pay(P, shopAddr('mullvad'), roundAsset('BTC', fromUsd('BTC', 5.5 * 1.08)), ts)
    for (const ts of times(r.int(1, 2), w.at(-90 * 24), w.at(-3 * 24))) pay(P, shopAddr(domar), roundAsset('BTC', fromUsd('BTC', r.float(12, 45))), ts)
    // Envoi « test » vers l'adresse de collecte, quelques heures avant le premier paiement
    const testTx = w.utxoTx({ time: w.at(-r.float(4, 30)), from: [P], to: [{ address: S, value: r8(r.int(10, 30) * 1e-5) }], change: P, autoFund: false })
    // Après les faits : dépenses courantes et nouvelle épargne
    for (const ts of times(r.int(4, 5), tOpen2 + 10 * HOUR, tW + 9 * DAY)) {
      const to = r.chance(0.75) ? shopAddr(r.pick([kadeo, spin, domar, kadeo])) : w.addr('btc')
      pay(P, to, roundAsset('BTC', fromUsd('BTC', r.float(40, 300))), ts)
    }
    for (const ts of times(2, tW + DAY, tW + 6 * DAY)) {
      const tx = pay(P, W, roundCoin(w, 0.002, 0.008, 0.0005), ts)
      if (tx) savings.push(tx)
    }
    dusting(w, W, { time: tW - 5 * DAY, n: 2, spreadH: 240 })

    // ── Adresse de collecte : poussière et victimes tardives ─────────────────
    const dust = dusting(w, S, { time: Math.round((pays[0].time + tCons) / 2), n: r.int(4, 6), spreadH: 120 })
    const late = otherVictimPayments(w, S, { start: tCons + 10 * HOUR, end: tW + 12 * DAY, n: r.int(3, 5), minUsd: 300, maxUsd: 1200 })

    // ── Bruit : autres clients du service, retraits sosies, autres canaux du LSP ──
    vp.noise(14, w.at(-5 * 24), tW + 4 * DAY)
    chx.noise(6, w.at(-200 * 24), w.at(10 * 24))
    const lookalikes: Tx[] = []
    for (let i = 0; i < 3; i++) {
      const f = 1 + (r.chance(0.5) ? 1 : -1) * r.float(0.002, 0.02)
      lookalikes.push(vp.withdraw(w.addr('btc'), r8(Math.round((wSat / SAT) * f * 1e5) / 1e5), tW + Math.round(r.float(-3, 3) * HOUR)))
    }
    for (let i = 0; i < r.int(2, 3); i++) {
      vp.withdraw(w.addr('btc'), r8(Math.round((wSat / SAT) * r.float(0.85, 1.15) * 1e5) / 1e5), tW + Math.round(r.float(-30, 30) * HOUR))
    }
    for (let i = 0; i < r.int(2, 4); i++) {
      const u = w.addr('btc', { kind: 'p2wpkh' })
      const cap = roundCoin(w, 0.01, 0.15, 0.005)
      const to = Math.round(r.float(w.at(-10 * 24), tW))
      w.fund(u, r8(cap + r.float(0.001, 0.05)), to - Math.round(r.float(2, 72) * HOUR))
      const oc = openChannel(w, { from: u, peer: lumen, capacity: r8(cap), time: to })
      if (r.chance(0.6)) oc.cooperativeClose({ time: to + Math.round(r.float(1, 20) * DAY), toLocal: r8(cap * r.float(0.1, 0.9)) })
    }

    // ════════════════════ RÉPONSES (monde final) ════════════════════
    const victimTxs = [...pays.map((p) => p.tx), ...late.txs.filter((x) => x.outputs.some((o) => o.address === S))]
    const victimVals = victimTxs.map((x) => receivedIn(w, x, S))
    const totalVictims = r8(victimVals.reduce((s, v) => s + v, 0))
    const nVictims = victimTxs.length
    const dustCount = dust.txs.length
    const wBalance = r8(w.unspentValue(W))
    const wIn = w.txsOf(W).filter((x) => x.outputs.some((o) => o.address === W))
    const savingsIn = savings.length
    const twinGapMin = Math.round(Math.abs(twinA.time - ch2.tx.time) / 60)
    const lnInSat = lnIn.reduce((s, x) => s + x.sats, 0)
    const lnOutSat = lnOut.reduce((s, x) => s + x.sats, 0)
    const shopsOf = (b: (typeof branches)[number]) => [...new Set(b.follow.flatMap((x) => x.outputs.map((o) => w.get(o.address).entityId).filter((e): e is string => !!e && e !== suspect.id).map((e) => w.entities.get(e)!.name)))]
    const spentBranch = branches.find((b) => b.fate === 'dépensée')!
    const fateText = (b: (typeof branches)[number]) =>
      b.fate === 'dort' ? 'jamais dépensée'
        : b.fate === 'dépensée' ? `dépensée en ${b.follow.length} petits paiements (${shopsOf(b).join(', ') || 'particuliers'})`
          : b.fate === 'retour' ? 'renvoyée en totalité vers « Perso »'
            : `ré-éclatée en ${b.follow.length} envois vers des adresses neuves`
    const branchList = branches.map((b) => `${btc(b.value)} → ${A(w, b.addr)} (${fateText(b)})`).join(' ; ')

    const tArrest = tW + Math.round(r.float(4, 14) * DAY)
    const tExtract = tArrest + Math.round(r.float(3, 8) * DAY)
    const fmtCsv = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ')
    // Pièces de procédure datées aux heures de service (8 h–18 h, heure de Paris), le même jour
    const office = (ts: number) => Math.floor(ts / DAY) * DAY + 7 * HOUR + (Math.abs(Math.round(ts)) % (9 * HOUR))
    const testLeadH = Math.round((pays[0].time - testTx.time) / HOUR)
    const twin1GapMin = Math.round(Math.abs(twinB.time - ch1.tx.time) / 60)
    // Autres retraits du portefeuille chaud autour de celui du suspect, à moins de 2,5 % du montant
    const wBtc = wSat / SAT
    const nearW = [...w.txs.values()]
      .filter((x) => x.id !== wTx.id && x.inputs.some((i) => i.address === vp.hot) && Math.abs(x.time - wTx.time) <= 3 * HOUR)
      .map((x) => x.outputs.find((o) => o.address !== vp.hot)?.value ?? 0)
      .filter((v) => v > 0 && Math.abs(v - wBtc) / wBtc < 0.025)
      .sort((a, b) => a - b)
    const lnOutList = [...lnOut].sort((a, b) => a.time - b.time).map((x) => x.description).join(', ')
    const rows: { time: number; line: string }[] = [
      ...vp.records.map((x) => ({ time: x.time, line: `${fmtCsv(x.time)};ln_${x.direction === 'receive' ? 'reçu' : 'envoyé'};${x.direction === 'receive' ? '+' : '-'}${x.sats};${x.paymentHash.slice(0, 16)}…;${x.description ?? ''}` })),
      { time: dep.tx.time, line: `${fmtCsv(dep.tx.time)};dépôt_onchain;+${sats(depValue)};—;confirmé` },
      { time: wTx.time, line: `${fmtCsv(wTx.time)};retrait_onchain;-${wSat};—;envoyé (frais réseau inclus)` },
    ].sort((a, b) => a.time - b.time)

    return {
      world: w,
      title: `Sextorsion et Lightning — ${city}`,
      briefing:
        `Une campagne de courriels de sextorsion (« j'ai piraté votre webcam, payez ou j'envoie la vidéo à vos contacts ») a visé des milliers d'adresses électroniques francophones. L'adresse bitcoin réutilisée dans les messages a reçu de nombreux paiements, et en reçoit encore. ${complainant.name} (${city}) a payé et porté plainte.\n\n` +
        `Les investigations ont conduit à l'interpellation ${de(sp.name)}, ${ge('connu', 'connue')} sous le pseudonyme @${handle}. En audition, ${ge('il', 'elle')} affirme avoir « tout passé en Lightning, donc intraçable ». L'exploitation de son téléphone et de son ordinateur a livré un portefeuille on-chain « Perso », un fichier d'export d'un portefeuille Lightning sans nom de service, et la réponse de Coinhouse est arrivée.\n\n` +
        `Attention : le suspect a multiplié les mouvements autour des étapes clés (branches sans issue, envois de même montant à la même heure, dépenses courantes). Reconstituez la partie visible du circuit, triez à chaque étape, identifiez le prestataire custodial et les avoirs encore saisissables, et mesurez ce qui restera hors de portée de la blockchain.`,
      evidence: [
        {
          id: 'mail', type: 'email', title: 'Courriel de sextorsion reçu par le plaignant', date: victimPay.time - Math.round(r.float(5, 30) * HOUR), author: 'expéditeur usurpé (adresse du destinataire)',
          body:
            `Bonjour,\nJ'ai pris le contrôle de votre appareil il y a plusieurs mois et j'ai enregistré une vidéo de vous pendant que vous visitiez certains sites.\n` +
            `Pour que cette vidéo ne soit pas envoyée à tous vos contacts, transférez ${btc(demand)} à l'adresse suivante :\n${A(w, S)}\n` +
            `Vous avez 48 heures. Ne répondez pas à ce message.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: office(victimPay.time + Math.round(r.float(1, 4) * DAY)), author: complainant.name,
          body: `« J'ai paniqué et j'ai payé. J'ai acheté les bitcoins sur une application et j'ai envoyé ${btc(victimPay.value)} le ${fmtDate(victimPay.time)}. La transaction est ${victimPay.tx.hash}. Je me rends compte que c'était une arnaque : je n'ai jamais eu de webcam sur cet ordinateur. »`,
        },
        {
          id: 'audition', type: 'pv', title: `Procès-verbal d'audition ${de(sp.name)} (extrait)`, date: office(tArrest + Math.round(r.float(5, 20) * HOUR)), author: 'Section de recherches',
          body:
            `Question : Que sont devenus les bitcoins reçus sur l'adresse figurant dans les courriels ?\n` +
            `Réponse : Je les ai mis sur Lightning. J'ai ouvert des canaux avec un fournisseur, j'ai payé des trucs, j'ai tout refermé. Sur Lightning, personne ne voit rien.\n` +
            `Question : Combien de canaux avez-vous ouverts, et avec qui ?\n` +
            `Réponse : Un ou deux, je ne sais plus. Avec le fournisseur proposé par défaut dans l'application.\n` +
            `Question : Et le portefeuille « Perso » de votre téléphone ?\n` +
            `Réponse : Ce sont mes économies, achetées sur Coinhouse. Ça n'a rien à voir.\n` +
            `Question : Où sont les fonds aujourd'hui ?\n` +
            `Réponse : Il ne reste rien.`,
        },
        {
          id: 'extraction', type: 'extraction', title: 'Exploitation du téléphone (scellé n° 1) — extrait du rapport', date: office(tExtract - Math.round(r.float(1, 2) * DAY)), author: 'Cellule d\'appui numérique',
          body:
            `Application de portefeuille Bitcoin non custodial. Un portefeuille nommé « Perso » ; adresse de réception affichée (réutilisée, jamais renouvelée) :\n${A(w, P)}\n` +
            `Application Lightning : désinstallée, aucune donnée exploitable sur le téléphone.\n` +
            `Bloc-notes : « coffre = trezor, seed sur papier dans la boîte à chaussures — NE PAS Y TOUCHER ». Aucune adresse notée. Le boîtier Trezor n'a pas été retrouvé lors de la perquisition.\n` +
            `Messagerie : ${hostPays.length} factures « VPS + relais SMTP » de l'hébergeur NordHost, réglées en bitcoin depuis « Perso », la première le ${fmtDate(hostPays[0]?.time ?? w.at(-30 * 24), false)}, la dernière le ${fmtDate(hostPays[hostPays.length - 1]?.time ?? w.at(-2 * 24), false)}.`,
        },
        {
          id: 'coinhouse', type: 'rapport', title: 'Réponse de Coinhouse à réquisition', date: office(tExtract + Math.round(r.float(2, 6) * DAY)), author: 'Service conformité de Coinhouse',
          body:
            `Compte client ouvert au nom ${de(sp.name)} (KYC vérifié). Achats de bitcoin par virement SEPA, puis retraits vers une adresse externe unique :\n` +
            cxWithdrawals.map((x) => `• ${fmtDate(x.time, false)} — ${btc(receivedIn(w, x, P))} vers ${A(w, P)}`).join('\n') +
            `\nAucun dépôt de crypto-actifs sur le compte. Aucun retrait pendant la période des faits.`,
        },
        {
          id: 'csv', type: 'releve', title: 'Fichier d\'export retrouvé sur l\'ordinateur (scellé n° 2) — relevé d\'opérations', date: office(tExtract), author: 'Cellule d\'appui numérique',
          body:
            `Fichier « export_operations.csv », dossier Téléchargements. Aucun nom de service dans le fichier ; horodatage en UTC.\n` +
            `Compte : ${acct}\n\n` +
            `date;type;montant_sat;hash_paiement;description\n` +
            rows.map((x) => x.line).join('\n'),
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche technique — Lightning vu de la blockchain', date: office(tArrest - 60 * DAY), author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Ouverture de canal : une transaction dont une sortie est un script P2WSH (multisignature 2-de-2 entre les deux pairs).\n` +
            `- Fermeture coopérative : la sortie du canal est dépensée vers une ou deux adresses ordinaires, sans délai.\n` +
            `- Fermeture forcée : la sortie du canal est dépensée par une transaction d'engagement ; le solde de celui qui force est bloqué sur une sortie à délai (souvent 144 blocs), puis récupéré par une seconde transaction ; deux petites sorties de 330 sats (« ancres ») servent à relever les frais.\n` +
            `- Piège : une sortie P2WSH unique ressemble à une ouverture de canal, mais un coffre multisignature a exactement la même forme. Tant que la sortie n'est pas dépensée, rien ne les distingue : ce sont l'origine des fonds et la dépense ultérieure (fermeture, part du fournisseur) qui tranchent.\n` +
            `- Un portefeuille Lightning custodial fonctionne comme un compte : dépôts et retraits on-chain, paiements internes inscrits dans ses propres registres.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Montant total (en BTC) versé par les victimes sur l\'adresse de collecte indiquée dans les courriels ?',
          answer: totalVictims,
          hint: 'Ouvrez l\'adresse du courriel et triez ses entrées : écartez la poussière (546 sats) et le petit envoi « test » reçu peu avant le premier paiement, mais gardez les victimes tardives, qui paient encore après que l\'adresse a été vidée.',
          explanation: `${nVictims} paiements de victimes (de ${btc(Math.min(...victimVals))} à ${btc(Math.max(...victimVals))}), dont ${late.txs.length} arrivés après le regroupement et jamais déplacés, soit ${btc(totalVictims)} (≈ ${Math.round(usd('BTC', totalVictims)).toLocaleString('fr-FR')} $). Ne sont pas des victimes : ${dustCount} entrées de 546 sats (poussière envoyée par des tiers, sans valeur) et l'envoi de ${btc(receivedIn(w, testTx, S))} du ${fmtDate(testTx.time)}, arrivé ${testLeadH} h avant le premier paiement et venu du portefeuille « Perso » du suspect : il vérifiait que l'adresse fonctionnait. Chaque paiement de victime est une plainte potentielle à susciter (via le service qui a vendu les bitcoins).`,
        },
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: 'Quelle transaction ouvre le premier canal Lightning, financé directement depuis l\'adresse de collecte ?',
          answer: [ch1.tx.id],
          hint: 'Suivez les dépenses de l\'adresse du courriel : cherchez une sortie de type script (P2WSH) de montant rond. L\'inspecteur signale les ouvertures de canal probables.',
          explanation: `${ch1.tx.hash.slice(0, 16)}… (${fmtDate(ch1.tx.time)}) envoie ${btc(cap1)} sur une sortie P2WSH (2-de-2 avec le nœud de ${lumen.name}) et rend le reste sur ${A(w, S2)}. La sortie est dépensée plus tard par une fermeture coopérative dont l'une des parts va à une adresse attribuée à ${lumen.name} : c'est ce qui confirme le canal. Pour mémoire, à ${twin1GapMin} minutes d'écart, une ancienne adresse du suspect envoie aussi exactement ${btc(cap1)} vers une adresse ordinaire (${twinB.hash.slice(0, 12)}…) : ce jumeau ne part pas de l'adresse de collecte et ne finance aucun canal.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Avant l\'ouverture du second canal, sur quelle adresse le suspect regroupe-t-il le reste de l\'adresse de collecte et le rendu du premier canal ?',
          answer: [S3],
          hint: 'Après le dernier paiement de la vague principale, l\'adresse de collecte est dépensée avec une autre adresse du suspect dans une transaction à une seule sortie.',
          explanation: `${consTx.hash.slice(0, 14)}… dépense ensemble l'adresse de collecte et ${A(w, S2)} (rendu de l'ouverture du premier canal) vers ${A(w, S3)} : par entrées communes, le rendu du premier canal est rattaché au suspect. ${A(w, S3)} est ensuite dépensée cinq fois en quelques heures : quatre branches et l'ouverture du second canal (objectif suivant).`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `Autour de l'ouverture du second canal, ${btc(cap2)} partent deux fois vers une sortie P2WSH, à ${twinGapMin} minutes d'intervalle, et l'adresse de regroupement émet aussi plusieurs autres envois. Quelle transaction ouvre réellement le second canal financé par les victimes ?`,
          answer: [ch2.tx.id],
          hint: 'Comparez les deux transactions de même montant : d\'où viennent leurs fonds, et que devient ensuite leur sortie P2WSH ? Écartez aussi les dépenses de l\'adresse de regroupement vers des adresses ordinaires.',
          explanation: `La bonne transaction est ${ch2.tx.hash.slice(0, 16)}… : elle dépense ${A(w, S3)} (le regroupement des fonds des victimes), crée la sortie P2WSH de ${btc(cap2)} et rend ${btc(ch2Change)} sur « Perso ». Sa sortie est dépensée le ${fmtDate(fc.commitTx.time, false)} par une transaction d'engagement (ancres de 330 sats, part immédiate vers une adresse de ${lumen.name}) : c'est un canal. Le jumeau ${twinA.hash.slice(0, 16)}… envoie le même montant vers une autre sortie P2WSH, mais il est financé par « Perso », alimenté ${Math.round((twinA.time - s0p.time) / HOUR)} h plus tôt par une ancienne adresse de collecte (${A(w, S0)}) : ce ne sont pas les fonds de cette campagne, et sa sortie n'est jamais dépensée (coffre multisignature ou canal resté ouvert : un avoir à viser, pas la suite du flux). Les quatre autres dépenses de ${A(w, S3)} (${branches.map((b) => btc(b.value)).join(', ')}) vont vers des adresses P2WPKH ordinaires, pour des montants non ronds : des branches, pas un canal.`,
        },
        {
          id: 'o14', type: 'address', points: 10,
          prompt: 'Parmi les quatre branches émises par l\'adresse de regroupement avant le second canal, laquelle détient encore intégralement les fonds reçus (cible de saisie) ?',
          answer: [dormant.addr],
          hint: 'Ouvrez chacune des quatre adresses de branche et regardez si elle a été dépensée, et vers où.',
          explanation: `Les quatre branches : ${branchList}. Seule ${A(w, dormant.addr)} n'a jamais bougé : ses ${btc(dormant.value)} sont toujours sous le contrôle de la clé du suspect, à viser dans la saisie. Les autres sont des impasses : la branche « retour » rejoint simplement le portefeuille « Perso », la branche dépensée se perd chez ${shopsOf(spentBranch).join(' et ') || 'des particuliers'} (réquisitions secondaires possibles), la branche ré-éclatée se disperse en petits montants sans suite.`,
        },
        {
          id: 'o2', type: 'choice', points: 10,
          prompt: 'Comment le second canal ouvert par le suspect a-t-il été fermé ?',
          ...choice(r,
            'Fermeture forcée par le suspect : son solde a été bloqué par un délai puis récupéré',
            [
              'Fermeture coopérative : les deux pairs ont signé ensemble la répartition du solde',
              'Fermeture forcée par le fournisseur : le solde du suspect lui revient immédiatement',
              'Transaction de pénalité : le fournisseur a sanctionné la diffusion d\'un ancien état',
            ]),
          hint: 'Ouvrez la transaction qui dépense la sortie du canal : quelles sorties sont des scripts, lesquelles sont attribuées, laquelle est dépensée plus tard ?',
          explanation: `La transaction d'engagement ${fc.commitTx.hash.slice(0, 12)}… verse la part du fournisseur immédiatement sur une adresse ${lumen.name}, place ${btc(fc.commitTx.outputs.find((o) => o.address === fc.delayed)!.value)} sur une sortie P2WSH à délai et ajoute deux ancres de 330 sats ; son nLockTime commence par 0x20. La sortie à délai est récupérée ${Math.round((sweepTx.time - fc.commitTx.time) / HOUR)} h plus tard (délai CSV de 144 blocs) vers ${A(w, C2)}, adresse non attribuée : c'est le diffuseur, donc le suspect, qui a forcé la fermeture. Une pénalité aurait tout attribué à une seule partie.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Combien de BTC le suspect a-t-il récupérés on-chain à la fermeture de ses deux canaux (hors part du fournisseur) ?',
          answer: recovered,
          hint: 'Fermeture coopérative : une sortie pour chaque pair (celle du fournisseur est attribuée). Fermeture forcée : comptez ce que le suspect récupère réellement, après le délai.',
          explanation: `${btc(c1Value)} à la fermeture coopérative (vers ${A(w, C1)}) et ${btc(c2Value)} récupérés après la fermeture forcée (vers ${A(w, C2)}, jamais dépensés depuis), soit ${btc(recovered)}. Pour mémoire, ${btc(r8(cap1 + cap2))} avaient été engagés dans les canaux : la différence correspond aux paiements effectués hors chaîne (routés par le fournisseur) et aux frais. La sortie P2WSH jumelle de ${btc(cap2)} n'entre pas dans ce calcul : elle n'a jamais été un canal fermé.`,
        },
        {
          id: 'o5', type: 'tx', points: 10,
          prompt: 'Quelle transaction on-chain correspond à la ligne « dépôt_onchain » du fichier d\'export ?',
          answer: [dep.tx.id],
          hint: 'Le montant du fichier est en satoshis (1 BTC = 100 000 000 sats) et l\'heure en UTC. Partez de l\'adresse qui reçoit le solde du suspect à la fermeture coopérative.',
          explanation: `${dep.tx.hash.slice(0, 16)}… envoie ${btc(depValue)} (${fmtSat(sats(depValue))} sats) depuis ${A(w, C1)}, le ${fmtCsv(dep.tx.time)} UTC (${fmtDate(dep.tx.time)} à l'heure de Paris), vers ${A(w, dep.deposit)}. Montant au satoshi près et heure identiques à la ligne du fichier : le compte ${acct} appartient bien au détenteur de l'ordinateur.`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Quel prestataire faut-il requérir pour obtenir l\'identité du titulaire du compte décrit dans le fichier d\'export et l\'historique complet de ses paiements ?',
          answer: ['voltpocket'],
          hint: 'Rapprochez la ligne « dépôt_onchain » du fichier d\'une transaction on-chain du suspect (montant et heure), puis regardez qui contrôle l\'adresse de destination.',
          explanation: `Le dépôt du fichier correspond au versement des fonds de la fermeture coopérative sur une adresse de dépôt ${vp.entity.name}, balayée vers son portefeuille chaud. ${vp.entity.name} est un portefeuille Lightning custodial : contrairement au fournisseur de liquidité, il tient un registre de chaque paiement (facture, hash, date, montant) et des connexions. ${procedureFor(vp.entity)} ${lumen.name} peut compléter (dates des canaux, identifiant de nœud, IP), mais ne connaît ni l'identité ni les paiements au-delà du saut suivant. Coinhouse, qui connaît le suspect, n'a vu passer aucun fonds de la campagne.`,
        },
        {
          id: 'o12', type: 'number', points: 10, tolerance: 1, unit: 'sats',
          prompt: 'D\'après le fichier d\'export, quel solde (en satoshis) reste sur le compte custodial après le retrait on-chain ?',
          answer: balanceSat - wSat,
          hint: 'Solde = dépôt on-chain + paiements reçus − paiements envoyés − retrait on-chain, ligne par ligne.',
          explanation: `${fmtSat(sats(depValue))} (dépôt) + ${fmtSat(lnInSat)} (${lnIn.length} paiements Lightning reçus pendant que les canaux étaient ouverts : le suspect s'est payé lui-même à travers le fournisseur) − ${fmtSat(lnOutSat)} (dépenses) − ${fmtSat(wSat)} (retrait) = ${fmtSat(balanceSat - wSat)} sats, soit ${btc((balanceSat - wSat) / SAT)}. Contrairement à ce que déclare le suspect (« il ne reste rien »), ce solde est toujours détenu par le prestataire pour son compte : il doit figurer dans la réquisition, avec une demande de gel conservatoire, selon la voie de coopération applicable.`,
        },
        {
          id: 'o6', type: 'address', points: 12,
          prompt: 'Sur quelle adresse le retrait on-chain mentionné dans le fichier d\'export a-t-il été versé ?',
          answer: [W],
          hint: 'Le portefeuille chaud du service paie plusieurs retraits de montant voisin dans les heures qui entourent celui du fichier : exigez l\'égalité au satoshi et à la minute, puis regardez l\'historique de l\'adresse retenue.',
          explanation: `Le ${fmtCsv(wTx.time)} UTC (${fmtDate(wTx.time)} à l'heure de Paris), le portefeuille chaud de ${vp.entity.name} verse ${btc(wSat / SAT)} (${fmtSat(wSat)} sats) à ${A(w, W)}. Dans les 3 heures qui précèdent et suivent, le même portefeuille chaud paie ${nearW.length} autres retraits à moins de 2,5 % de ce montant (${nearW.map((v) => btc(v)).join(', ')}) : aucun ne correspond au satoshi, et aucune de ces adresses n'a de lien avec le suspect. ${A(w, W)}, elle, avait déjà reçu ${savings.filter((x) => x.time < wTx.time).length} versements d'épargne depuis « Perso » avant les faits : c'est le « coffre » Trezor du bloc-notes.`,
        },
        {
          id: 'o15', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (en BTC) dort aujourd\'hui sur ce « coffre » (somme à viser dans la saisie) ?',
          answer: wBalance,
          hint: 'Additionnez toutes les entrées de l\'adresse : le retrait du service, mais aussi l\'épargne venue de « Perso » avant et après les faits. Vérifiez qu\'aucune sortie n\'en est partie.',
          explanation: `${A(w, W)} a reçu ${wIn.length} entrées et n'a jamais rien dépensé : le retrait ${vp.entity.name} de ${btc(wSat / SAT)}, ${savingsIn} versements depuis « Perso » (dont ${savings.filter((x) => x.time > wTx.time).length} après le retrait) et ${wIn.filter((x) => x.tags.includes('dust')).length} entrées de poussière de 546 sats, soit ${btc(wBalance)}. Seule la part issue du retrait est directement le produit de la sextorsion ; le reste devra être qualifié (avant les faits, épargne d'origine Coinhouse ; après, fonds de « Perso » où se mêlent l'ancienne campagne, le rendu du second canal et la branche « retour »), mais l'ensemble est saisissable si la seed papier est retrouvée.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Dans ce dossier, qu\'est-ce que la blockchain Bitcoin ne permet pas de voir ?',
          ...choice(r,
            'Les paiements faits dans les canaux : leurs montants, leurs dates et leurs destinataires',
            [
              'La capacité de chaque canal et l\'adresse qui a financé son ouverture',
              'Les adresses où le suspect a récupéré ses fonds à la fermeture des canaux',
              'Le montant revenu au fournisseur de liquidité lors de chaque fermeture',
            ]),
          hint: 'Reprenez ce que vous avez établi sur le graphe (ouvertures, fermetures, récupérations), puis ce que seul le fichier d\'export vous a appris.',
          explanation: `Ouvertures, capacités, fermetures, répartition finale et adresses de récupération sont visibles on-chain. Les paiements dans les canaux, eux, sont hors chaîne et routés en oignon : seuls les prestataires qui les voient passer (portefeuille custodial du destinataire, nœuds de routage pour le saut suivant) en gardent une trace. D'où l'importance des réquisitions et de l'exploitation des supports (fichier d'export, base de données du nœud ou de l'application).`,
        },
      ],
      truth: {
        path: [
          ...pays.map((p) => p.tx.id), ch1.tx.id, consTx.id, ch2.tx.id, coopTx.id, fc.commitTx.id, sweepTx.id,
          dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), wTx.id,
        ],
        addresses: [S, S2, S3, P, ch1.funding, ch2.funding, C1, C2, dep.deposit, W, fc.delayed, dormant.addr],
        debrief:
          `1. ${nVictims} victimes paient au total ${btc(totalVictims)} sur ${A(w, S)} (dont ${late.txs.length} après que l'adresse a été vidée). ${testLeadH} h avant le premier paiement, le suspect y avait envoyé un « test » depuis son portefeuille « Perso » (${A(w, P)}) ; s'y ajoutent ${dustCount} poussières sans valeur.\n` +
          `2. À mi-campagne, ${btc(cap1)} ouvrent un canal avec ${lumen.name}. Au même moment, une ancienne adresse de collecte (${A(w, S0)}, ${nOld} paiements d'une campagne antérieure) envoie exactement le même montant vers une adresse ordinaire : jumeau sans lien avec le canal.\n` +
          `3. Le reste est regroupé sur ${A(w, S3)}, qui émet quatre branches (${branches.map((b) => `${btc(b.value)} : ${b.fate}`).join(' ; ')}) puis ouvre le second canal de ${btc(cap2)}, rendu sur « Perso ». ${twinGapMin} minutes d'écart avec le jumeau : « Perso », renfloué par l'ancienne campagne, envoie aussi ${btc(cap2)} vers une sortie P2WSH qui ne sera jamais dépensée. Seul le canal financé par ${A(w, S3)} est fermé ensuite.\n` +
          `4. Hors chaîne, le suspect paie ${lnIn.length} factures émises par son propre compte ${vp.entity.name} (${acct}) pour ${fmtSat(lnInSat)} sats, puis dépense une partie de ce compte (${lnOutList}). Rien de tout cela n'apparaît on-chain.\n` +
          `5. Le premier canal est fermé de façon coopérative (${btc(c1Value)} pour le suspect) ; le second est fermé de force par le suspect (${btc(c2Value)} récupérés après le délai, toujours sur ${A(w, C2)}).\n` +
          `6. Les fonds de la fermeture coopérative sont déposés on-chain sur le compte ${vp.entity.name}, qui verse enfin ${btc(wSat / SAT)} sur le coffre ${A(w, W)}, parmi ${nearW.length} retraits de montant voisin payés dans les mêmes heures. Le coffre, alimenté aussi par l'épargne de « Perso », détient ${btc(wBalance)} ; ${fmtSat(balanceSat - wSat)} sats restent sur le compte custodial ; la branche dormante garde ${btc(dormant.value)} ; la sortie P2WSH jumelle ${btc(cap2)}. Autant de cibles de gel et de saisie, contrairement à « il ne reste rien ».\n\n` +
          `Fausses pistes : le jumeau de ${btc(cap1)} et celui de ${btc(cap2)} se réfutent par l'origine des fonds (pas l'adresse de collecte ni le regroupement) et par l'absence de fermeture ; les branches se réfutent par leur forme (P2WPKH, montants non ronds) et leur sort ; les retraits sosies par l'égalité au satoshi et l'historique du coffre. Coinhouse identifie le suspect mais n'a vu passer aucun fonds de la campagne.\n\n` +
          `À retenir : Lightning n'efface pas tout. Les entrées et sorties du réseau sont des transactions Bitcoin ordinaires, reconnaissables à leur structure (sortie P2WSH, ancres, délais), mais une sortie P2WSH seule ne prouve pas un canal. Ce qui se passe entre l'ouverture et la fermeture est invisible on-chain, mais pas forcément perdu : les prestataires custodiaux tiennent des registres, et les supports saisis (exports, bases de données de nœud) en contiennent souvent une copie.`,
      },
      hints: [
        'Partez de l\'adresse du courriel de sextorsion et triez ses entrées (victimes, poussière, test) avant de déplier ses sorties : une sortie P2WSH au montant rond signe une ouverture de canal probable.',
        'Une sortie P2WSH de même montant à la même heure n\'est pas forcément le canal : regardez d\'où viennent les fonds et si la sortie est dépensée plus tard par une fermeture.',
        'Suivez chaque sortie de canal jusqu\'à sa dépense : une ou deux sorties ordinaires sans délai = fermeture coopérative ; sortie à délai et ancres de 330 sats = fermeture forcée.',
        'Le fichier d\'export ne nomme pas le service : rapprochez ses lignes on-chain (montant en sats, heure UTC) des transactions du suspect.',
        'Le retrait final est payé par le portefeuille chaud du service parmi d\'autres retraits voisins : exigez l\'égalité au satoshi, puis vérifiez l\'historique de l\'adresse retenue.',
      ],
    }
  },
}
