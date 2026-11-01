import { World, type Tx } from '../engine/world'
import { exchange, mixer, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { Entity } from '../engine/entities'
import { dusting, personalSpending, priorHistory, twinTransfers } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const r3 = (v: number) => Math.floor(v * 1000) / 1000

// Pas de nom de famille du générateur d'identités (évite les homonymes avec les personnages)
const COMPANIES = ['Clinique du Parc', 'Mairie de Saint-Aubin', 'Transports Leroy', 'Groupe Hexafor', 'Cabinet Arcis Avocats', 'Plasturgie de l\'Ouest', 'Laboratoires Vidal-Sorel', 'Coopérative Agrinord', 'Logistique Rhône-Alpes', 'Hôtel Belvédère', 'Menuiseries Chauvin', 'Office notarial des Tilleuls']
/** Même jour, heure de service (8 h–18 h, heure de Paris) : pour les pièces de procédure. */
const office = (ts: number) => Math.floor(ts / 86400) * 86400 + 7 * 3600 + (Math.abs(Math.round(ts)) % (9 * 3600))

type Fate = 'dort' | 'dépensée' | 'retour' | 'éclatée'
interface DecoyBranch { address: string; tx: Tx; value: number; fate: Fate; follow: Tx[] }

/**
 * Dépenses personnelles créées dans l'ordre chronologique : `personalSpending`
 * tire ses dates au hasard et, créées dans le désordre, une dépense antérieure
 * ne voit plus la pièce consommée par une dépense postérieure (financement
 * automatique parasite). On l'appelle donc paiement par paiement, trié.
 */
function spendInOrder(w: World, addr: string, o: { start: number; end: number; n: number; merchants: (string | Entity)[]; maxUsd: number }): Tx[] {
  const ts = Array.from({ length: o.n }, () => Math.round(w.rng.float(o.start, o.end))).sort((a, b) => a - b)
  return ts.flatMap((t) => personalSpending(w, addr, { start: t, end: t, n: 1, merchants: o.merchants, maxUsd: o.maxUsd }).txs)
}

export const btcRansomwareRaas: ScenarioTemplate = {
  id: 'ransomware-raas',
  title: 'LockBit : anatomie d\'un RaaS',
  tagline: 'Une rançon partagée, un affilié qui éclate ses fonds, des envois jumeaux, et un portefeuille qui relie toutes les attaques.',
  description:
    'Une entreprise française a payé une rançon au groupe LockBit, qui fonctionne en « Ransomware-as-a-Service ». Chaque rançon est partagée entre l\'affilié qui a mené l\'attaque et les opérateurs. Retrouvez la clé de partage et le portefeuille des opérateurs, recensez les victimes du groupe, puis suivez la part de l\'affilié à travers un éclatement en branches, des envois jumeaux et un mixeur jusqu\'à sa plateforme d\'encaissement. Les portefeuilles des suspects vivent : historique, autres victimes, serveurs payés en bitcoin, poussière.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['ransomware', 'change', 'cioh', 'mixer', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 100,
  lessons: ['ransomware', 'utxo', 'change-heuristics', 'mixeurs', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const rssi = fakeName(r)
    const affHandle = fakeHandle(r)

    const lf = w.entity('lockbit', { known: false })
    const nAff = r.int(2, 3)
    const affE: Entity[] = Array.from({ length: nAff }, (_, i) => w.customEntity({ name: i === 0 ? `Affilié LockBit « ${affHandle} »` : `Affilié LockBit n° ${i + 1}`, category: 'ransomware' }))
    // Sinbad a été saisi en novembre 2023 : l'affaire (2024-2026) utilise un mixeur fictif du même modèle
    w.entity('sinbad', { name: 'Nebula Mix', description: 'Mixeur centralisé (custodial, fictif), apparu après la saisie de Sinbad en novembre 2023 : mélange les fonds avec ceux d\'autres utilisateurs et restitue après un délai, moins une commission. Ne coopère pas.' })
    const neb = mixer(w, 'sinbad', 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    const brokers: ExchangeKit[] = [cv, exchange(w, 'swissborg', 'btc'), exchange(w, 'bitstamp', 'btc')]
    const xKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const X = exchange(w, xKey, 'btc')
    const yKey = r.pick((['huobex', 'okx', 'binance'] as const).filter((k) => k !== xKey))
    const Y = exchange(w, yKey, 'btc')
    // Garantex : sanctionné (OFAC, avril 2022), domaines saisis en mars 2025 ; activité reprise sous le nom Grinex,
    // lui-même sanctionné en août 2025. Le nom et la qualification suivent la date de l'affaire.
    const tCase = w.t0 + 10 * DAY
    const gEra = tCase < 1740787200 ? 'garantex' : tCase < 1755648000 ? 'grinex' : 'grinex-sanctionné' // 1er mars 2025, 20 août 2025
    const gName = gEra === 'garantex' ? 'Garantex' : 'Grinex'
    const gLabel = gEra === 'garantex'
      ? 'exchange russe visé par des sanctions internationales (OFAC, avril 2022)'
      : gEra === 'grinex'
        ? 'exchange enregistré au Kirghizstan, présenté comme le successeur de Garantex (exchange sanctionné par l\'OFAC, domaines saisis en mars 2025)'
        : 'exchange enregistré au Kirghizstan, successeur de Garantex, lui-même sanctionné par l\'OFAC depuis août 2025'
    if (gEra !== 'garantex') w.entity('garantex', { name: 'Grinex', country: 'Kirghizstan', description: `Exchange enregistré au Kirghizstan, qui a repris l'activité de Garantex après la saisie de ses domaines en mars 2025${gEra === 'grinex-sanctionné' ? ' ; sanctionné par l\'OFAC en août 2025' : ''}. Aucune coopération.` })
    const garantex = exchange(w, 'garantex', 'btc')
    const orbit = w.customEntity({ name: 'NeonSlots', category: 'gambling', known: true, risk: 'medium', description: 'Casino en ligne crypto (fictif), adresse de dépôt propre à chaque joueur, sans vérification d\'identité sous un seuil de retrait.' })
    const cardvault = w.customEntity({ name: 'CardVault', category: 'merchant', known: true, risk: 'medium', description: 'Revendeur de cartes cadeaux contre crypto-actifs (fictif) ; codes livrés par courriel.' })
    const host = w.customEntity({
      name: 'BulletHost', category: 'merchant', known: true, country: 'Seychelles',
      description: 'Hébergeur « bulletproof » offshore (fictif) : serveurs privés virtuels payables en bitcoin, sans vérification d\'identité, réputé ignorer les signalements d\'abus.',
      compliance: { contact: 'abuse@bullethost.example (sans suite)', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun', notes: 'Ne répond ni aux signalements ni aux demandes des autorités. Les paiements reçus documentent toutefois l\'achat d\'infrastructure.' },
    })

    const opPct = r.pick([20, 20, 25] as const)
    const p = opPct / 100
    const operator = w.addr('btc', { entity: lf, kind: 'p2wpkh' })

    // ── Victimes (ordre chronologique) et attribution aux affiliés ──────────
    const m = r.int(5, 7)
    const names = r.pickN(COMPANIES, m)
    const plaintIdx = r.int(1, m - 2)
    const a0Prev = r.int(0, plaintIdx - 1)
    const a0Next = r.chance(0.5) ? r.int(plaintIdx + 1, m - 1) : -1
    const affOf: number[] = []
    let rr = r.int(0, 5)
    for (let i = 0; i < m; i++) affOf.push(i === plaintIdx || i === a0Prev || i === a0Next ? 0 : 1 + (rr++ % (nAff - 1)))
    // Adresse de paiement déclarée par chaque affilié dans le panneau : réutilisée d'une attaque à l'autre
    const payout = affE.map((e, i) => w.addr('btc', { entity: e, kind: i === 0 ? 'p2wpkh' : r.pick(['p2wpkh', 'p2sh'] as const) }))
    const P = payout[0]

    const times = Array.from({ length: m }, () => w.at(-r.float(5, 120) * 24)).sort((a, b) => a - b)
    for (let i = 1; i < m; i++) times[i] = Math.max(times[i], times[i - 1] + Math.round(r.float(2.5, 7) * DAY))
    interface Victim { name: string; ransomAddr: string; payments: Tx[]; paid: number; split: Tx; affAddr: string; affIdx: number; affShare: number; opShare: number }
    const victims: Victim[] = []
    const usedDemands = new Set<number>()
    for (let i = 0; i < m; i++) {
      const isPlaint = i === plaintIdx
      const ransomAddr = w.addr('btc', { entity: lf, kind: 'p2wpkh' })
      let usdDemand = r.int(60, 900) * 1000
      while (usedDemands.has(usdDemand)) usdDemand = r.int(60, 900) * 1000
      usedDemands.add(usdDemand)
      const ransom = r4(fromUsd('BTC', usdDemand))
      const broker = isPlaint ? cv : r.pick(brokers)
      const payments: Tx[] = []
      const t = times[i]
      if (isPlaint || r.chance(0.4)) {
        const test = r4(r.float(0.002, 0.01))
        payments.push(broker.withdraw(ransomAddr, test, Math.round(t - r.float(3, 20) * HOUR)))
        payments.push(broker.withdraw(ransomAddr, r4(ransom - test), t))
      } else payments.push(broker.withdraw(ransomAddr, ransom, t))
      const paid = w.unspentValue(ransomAddr)
      // Partage automatique : affilié / opérateurs
      const affAddr = payout[affOf[i]]
      const fee = w.estimateFee('btc', payments.length, 2)
      const opShare = r8((paid - fee) * p)
      const affShare = r8(paid - fee - opShare)
      const split = w.utxoTx({ time: Math.round(t + r.float(1, 6) * HOUR), from: [ransomAddr], to: [{ address: affAddr, value: affShare }, { address: operator, value: opShare }], fee, change: null, spendAll: true, method: 'partage RaaS' })
      victims.push({ name: names[i], ransomAddr, payments, paid, split, affAddr, affIdx: affOf[i], affShare, opShare })
    }
    const plaint = victims[plaintIdx]
    const totalPaid = r8(victims.reduce((s, v) => s + v.paid, 0))
    const lastSplit = Math.max(...victims.map((v) => v.split.time))
    const a0Victims = victims.filter((v) => v.affIdx === 0)
    const firstA0 = victims[a0Prev]

    // ── Portefeuille de l'affilié : vie antérieure et dépenses avant l'éclatement ──
    const a0 = affE[0]
    priorHistory(w, P, { start: times[0] - 160 * DAY, end: firstA0.split.time - 4 * DAY, nIn: r.int(3, 4), nOut: 2, maxUsd: 1400 })
    const tE = Math.round(plaint.split.time + r.float(8, 28) * HOUR)
    spendInOrder(w, P, { start: firstA0.split.time + 3 * HOUR, end: tE - 3 * HOUR, n: r.int(2, 3), merchants: [host, host, 'mullvad'], maxUsd: 700 })

    // ── Éclatement : quatre envois en moins de trois heures, un seul mène quelque part ──
    const kindP = w.get(P).kind
    const h1 = w.addr('btc', { entity: a0, kind: kindP })
    const availE = w.unspentValue(P, tE - 2 * HOUR)
    const mainValue = r3(plaint.affShare * r.float(0.3, 0.42))
    const decoyParts = r.split(Math.max(0.01, (availE - mainValue) * r.float(0.6, 0.72)), 3, 0.6).map((v) => r3(v))
    const fates = r.shuffle<Fate>(['dort', 'dépensée', 'retour', 'éclatée']).slice(0, 3)
    const slots: number[] = []
    let ts = tE - r.int(30, 80) * 60
    for (let i = 0; i < 4; i++) { slots.push(ts); ts += r.int(6, 45) * 60 }
    const mainSlot = r.int(0, 3)
    let mainTx!: Tx
    const decoys: DecoyBranch[] = []
    let di = 0
    for (let s = 0; s < 4; s++) {
      if (s === mainSlot) {
        mainTx = w.utxoTx({ time: slots[s], from: [P], to: [{ address: h1, value: mainValue }], change: P })
        continue
      }
      const addr = w.addr('btc', { entity: a0, kind: kindP })
      const v = decoyParts[di]
      const tx = w.utxoTx({ time: slots[s], from: [P], to: [{ address: addr, value: v }], change: P })
      decoys.push({ address: addr, tx, value: v, fate: fates[di], follow: [] })
      di++
    }
    // Sort de chaque branche leurre
    for (const b of decoys) {
      const later = b.tx.time + r.int(8 * HOUR, 4 * DAY)
      if (b.fate === 'dépensée') b.follow.push(...spendInOrder(w, b.address, { start: later, end: later + 8 * DAY, n: r.int(2, 3), merchants: [cardvault, orbit, 'mullvad'], maxUsd: Math.min(450, usd('BTC', b.value) * 0.2) }))
      if (b.fate === 'retour') {
        const fee = w.estimateFee('btc', 1, 1)
        b.follow.push(w.utxoTx({ time: later, from: [b.address], to: [{ address: P, value: r8(w.unspentValue(b.address, later) - fee) }], fee, change: null, spendAll: true }))
      }
      if (b.fate === 'éclatée') {
        const n = r.int(2, 3)
        for (let k = 0; k < n; k++) b.follow.push(w.utxoTx({ time: later + k * r.int(600, 2400), from: [b.address], to: [{ address: w.addr('btc', { entity: a0, kind: kindP }), value: r3(b.value / (n + 0.6)) }], change: b.address }))
      }
    }
    /** Destinataires de paiements : « à BulletHost, à Mullvad VPN et à des particuliers ». */
    const payees = (txs: Tx[], self: string) => [...new Set(txs.flatMap((x) => x.outputs.filter((o) => o.address !== self).map((o) => `à ${w.ownerOf(o.address)?.name ?? 'des particuliers'}`)))].join(', ').replace(/, ([^,]+)$/, ' et $1')
    const fateText = (b: DecoyBranch): string => {
      switch (b.fate) {
        case 'dort': return 'n\'est jamais dépensée : les fonds y dorment'
        case 'dépensée': return `ne sert qu'à ${b.follow.length} petits paiements (${payees(b.follow, b.address)}), le reste dort`
        case 'retour': return `revient intégralement, plus tard, vers l'adresse de paiement de l'affilié (${b.follow[0]?.hash.slice(0, 10)}…)`
        case 'éclatée': return `est ré-éclatée en ${b.follow.length} petites adresses qui ne bougent plus`
      }
    }

    // ── Envois jumeaux depuis la branche réelle ──────────────────────────────
    const kind2 = r.pick(['p2wpkh', 'p2tr'] as const)
    const tT = Math.round(mainTx.time + r.float(5, 20) * HOUR)
    const h4 = w.addr('btc', { entity: a0, kind: kind2 })
    const fwdFee = w.estimateFee('btc', 1, 1)
    const V = r8(w.unspentValue(h1, tT) - fwdFee)
    const realTwin = w.utxoTx({ time: tT, from: [h1], to: [{ address: h4, value: V }], fee: fwdFee, change: null, spendAll: true })
    const twinDst = Array.from({ length: 3 }, () => w.addr('btc', { entity: a0, kind: kind2 }))
    const twins = twinTransfers(w, h1, { value: V, time: tT, n: 3, spreadMin: 22, to: twinDst })
    const twinTxs = twins.txs
    // Destin des destinations jumelles : l'une dort, l'une part au casino, l'une fait un saut puis dort
    const orbitDep = w.addr('btc', { entity: orbit, label: `${orbit.name} — Adresse de dépôt`, tags: ['deposit'] })
    const twinCasino = forwardAll(w, twinDst[1], orbitDep, Math.round(tT + r.float(20, 60) * HOUR))
    const twinHopAddr = w.addr('btc', { entity: a0, kind: kind2 })
    forwardAll(w, twinDst[2], twinHopAddr, Math.round(tT + r.float(30, 90) * HOUR))
    dusting(w, h1, { time: tT + 30 * HOUR, n: 2, spreadH: 20 })

    // ── Branche réelle : mixage partiel puis dépôt sur l'exchange ────────────
    const h5 = w.addr('btc', { entity: a0, kind: kind2 })
    const mixValue = r3(V * r.float(0.3, 0.42))
    const mixRes = neb.mix({ from: h4, value: mixValue, time: Math.round(tT + r.float(3, 20) * HOUR), recipients: [w.addr('btc', { entity: a0 }), w.addr('btc', { entity: a0 })], change: h5 })
    const h6 = w.addr('btc', { entity: a0, kind: kind2 })
    const xT = Math.round(mixRes.depositTx.time + r.float(10, 40) * HOUR)
    const xValue = r3(w.unspentValue(h5, xT) * r.float(0.82, 0.94))
    const xDeposit = X.newDeposit()
    const xTx = w.utxoTx({ time: xT, from: [h5], to: [{ address: xDeposit, value: xValue }], change: h6, spendAll: true })
    const xSweep = X.sweep([xDeposit], Math.round(xT + r.float(1, 6) * HOUR))[0]

    // ── Portefeuille de l'affilié après l'éclatement ─────────────────────────
    spendInOrder(w, P, { start: tE + DAY, end: tE + 18 * DAY, n: r.int(3, 4), merchants: [host, 'mullvad', cardvault], maxUsd: 550 })
    dusting(w, P, { time: tE, n: r.int(2, 3), spreadH: 40 })

    // ── Autres affiliés ──────────────────────────────────────────────────────
    for (const v of victims) {
      if (v.affIdx === 0) continue
      const t = Math.round(v.split.time + r.float(1, 4) * DAY)
      if (v.affIdx === 1) {
        const dep = Y.newDeposit()
        forwardAll(w, v.affAddr, dep, t)
        Y.sweep([dep], Math.round(t + r.float(1, 8) * HOUR))
      } else {
        const have = w.unspentValue(v.affAddr, t)
        if (have > 0.002) neb.mix({ from: v.affAddr, value: r8(have * 0.97), time: t, recipients: [w.addr('btc'), w.addr('btc'), w.addr('btc')] })
      }
    }

    // ── Portefeuille des opérateurs : vie antérieure, infrastructure, poussière ──
    const oldOp = w.addr('btc', { entity: lf, kind: 'p2wpkh' })
    const carry = r3(fromUsd('BTC', r.float(4000, 16000)))
    w.fund(oldOp, r8(carry + 0.002), times[0] - Math.round(r.float(70, 120) * DAY))
    const carryTx = w.utxoTx({ time: times[0] - Math.round(r.float(15, 50) * DAY), from: [oldOp], to: [{ address: operator, value: carry }], change: null })
    const infra: Tx[] = []
    const infraShops: Entity[] = [host, host, w.entity('mullvad'), host, cardvault]
    const infraAfter = r.shuffle(victims.slice(1).map((_, i) => i + 1)).slice(0, Math.min(4, m - 1))
    infraAfter.forEach((vi, k) => {
      const t = Math.round(victims[vi].split.time + r.float(6, 40) * HOUR)
      const shop = infraShops[k % infraShops.length]
      const v = roundAsset('BTC', fromUsd('BTC', r.float(90, 900)))
      if (w.unspentValue(operator, t) < v + 0.0005) return
      const dst = w.addr('btc', { entity: shop, label: `${shop.name} — Paiement` })
      infra.push(w.utxoTx({ time: t, from: [operator], to: [{ address: dst, value: v }], change: operator }))
    })
    const spanH = Math.max(24, (lastSplit - times[0]) / HOUR / 2)
    dusting(w, operator, { time: Math.round((times[0] + lastSplit) / 2), n: 3, spreadH: Math.min(spanH - 6, 30 * 24) })

    // ── Opérateurs : sortie partielle vers un exchange sanctionné (dernier acte) ──
    const gT = Math.round(Math.max(lastSplit + r.float(2, 6) * DAY, xSweep.time + r.float(8, 48) * HOUR))
    const opTotal = w.unspentValue(operator, gT)
    const opInCount = w.utxosOf(operator, gT).length
    const opRest = w.addr('btc', { entity: lf, kind: 'p2wpkh' })
    const gDeposit = garantex.newDeposit()
    const gValue = r3(opTotal * r.float(0.4, 0.6))
    const gTx = w.utxoTx({ time: gT, from: [operator], to: [{ address: gDeposit, value: gValue }], change: opRest, spendAll: true })
    // D'autres clients de Garantex déposent des montants voisins au même moment
    const lookDeps: string[] = []
    for (let i = 0; i < 2; i++) {
      const src = w.addr('btc')
      const v = r8(gValue * (1 + r.float(-0.012, 0.012)))
      w.fund(src, r8(v * r.float(1.05, 1.4)), gT - Math.round(r.float(1, 6) * DAY))
      const d = garantex.newDeposit()
      w.utxoTx({ time: gT + r.int(-40, 40) * 60, from: [src], to: [{ address: d, value: v }] })
      lookDeps.push(d)
    }
    garantex.sweep([gDeposit, ...lookDeps], Math.round(gT + r.float(2, 12) * HOUR))
    // Le rendu des opérateurs continue de payer l'infrastructure
    const opRestPays = spendInOrder(w, opRest, { start: gT + 10 * HOUR, end: gT + 20 * DAY, n: r.int(2, 3), merchants: [host, host, 'mullvad'], maxUsd: 800 })
    dusting(w, opRest, { time: gT + 5 * DAY, n: 2, spreadH: 72 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    X.noise(14, w.at(-10 * 24), w.at(25 * 24))
    Y.noise(8, w.at(-60 * 24), w.at(20 * 24))
    cv.noise(10, w.at(-60 * 24), w.at(10 * 24))
    garantex.noise(6, w.at(-30 * 24), w.at(25 * 24))

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const opRestNow = r8(w.unspentValue(opRest))
    const pShares = victims.filter((v) => v.split.outputs.some((o) => o.address === P))
    const pInputs = w.txsOf(P).filter((t) => t.outputs.some((o) => o.address === P) && !t.inputs.some((i) => i.address === P))
    const portalId = Array.from({ length: 16 }, () => '0123456789ABCDEF'[r.int(0, 15)]).join('')
    const plaintFinal = plaint.payments[plaint.payments.length - 1]
    const xName = X.entity.name
    const recapVictims = victims.map((v) => `   • ${v.name} — ${fmtDate(v.payments[v.payments.length - 1].time, false)} — ${amt(v.paid, 'BTC')}`).join('\n')
    const hm = (t: number) => new Date(t * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    const c2Ip = `${r.int(80, 195)}.${r.int(10, 250)}.${r.int(1, 250)}.${r.int(2, 250)}`
    const branchList = decoys.map((b) => `   • ${A(w, b.address)} (${amt(b.value, 'BTC')}, ${hm(b.tx.time)}) ${fateText(b)}`).join('\n')
    const prevTime = (t: Tx) => Math.max(...t.inputs.map((i) => (i.prev ? w.tx(i.prev.tx).time : 0)))
    // Pièce extérieure (apport d'un tiers) dépensée par chaque jumelle
    const extTime = (t: Tx) => Math.max(...t.inputs.map((i) => (i.prev ? w.tx(i.prev.tx) : undefined)).filter((p): p is Tx => !!p && !p.inputs.some((j) => w.get(j.address).entityId === a0.id)).map((p) => p.time))
    const twinList = [...twinTxs].sort((a, b) => a.time - b.time).map((t) => `   • ${t.hash.slice(0, 12)}… (${hm(t.time)}) : dépense une pièce arrivée d'un tiers ${Math.max(1, Math.round((t.time - extTime(t)) / 60))} min plus tôt, et rend la monnaie à la branche`).join('\n')
    const infraList = payees(infra, operator)
    const opRestList = payees(opRestPays, opRest)

    return {
      world: w,
      title: `Rançongiciel LockBit — ${plaint.name}`,
      briefing:
        `${plaint.name} (${city}) a été victime du rançongiciel LockBit : serveurs chiffrés, données exfiltrées, menace de publication sur le site vitrine du groupe. Après négociation, la direction a payé la rançon en bitcoins achetés sur Coinhouse.\n\n` +
        `LockBit fonctionne en RaaS (Ransomware-as-a-Service) : des « affiliés » mènent les intrusions avec l'outil fourni par les opérateurs, et chaque rançon est automatiquement partagée entre l'affilié et les opérateurs selon une clé fixe. Les affiliés déclarent dans le panneau une adresse de paiement, qu'ils réutilisent souvent d'une attaque à l'autre.\n\n` +
        `Les portefeuilles rencontrés ne servent pas qu'à cette affaire : historique antérieur, autres victimes, serveurs et VPN payés en bitcoin, poussière. À chaque étape, triez.\n\n` +
        `Objectifs : déterminer la clé de partage, identifier l'adresse d'agrégation des opérateurs, recenser les victimes et le total des rançons, puis suivre la part de l'affilié, malgré ses manœuvres, jusqu'à sa plateforme d'encaissement.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: `Note de rançon (${portalId.slice(0, 9)}.README.txt)`, date: plaint.payments[0].time - Math.round(r.float(5, 9) * DAY),
          body:
            `~~~ LockBit ~~~\n` +
            `Vos fichiers sont chiffrés et nous avons copié ${r.int(180, 900)} Go de vos données.\n` +
            `N'essayez pas de restaurer vous-mêmes, vous perdriez tout.\n\n` +
            `Connectez-vous à notre portail de négociation (Tor) avec l'identifiant : ${portalId}\n` +
            `Sans contact sous 72 heures, vos données seront publiées sur notre blog.\n` +
            `Paiement uniquement en Bitcoin, sur l'adresse unique communiquée dans le portail.`,
        },
        {
          id: 'chat', type: 'capture', title: 'Extrait du portail de négociation', date: plaintFinal.time - Math.round(r.float(1, 3) * DAY), author: 'Support LockBit / négociateur de la victime',
          body:
            `LockBit : Votre prix est ${amt(r4(plaint.paid * r.float(1.6, 2.4)), 'BTC')}. C'est 1 % de votre chiffre d'affaires, nous avons lu vos bilans.\n` +
            `Victime : Nous ne pouvons pas payer ce montant. Nous proposons ${amt(r4(plaint.paid * 0.6), 'BTC')}.\n` +
            `LockBit : Notre partenaire qui s'occupe de votre dossier accepte ${amt(r4(plaint.paid), 'BTC')}, dernier mot. L'équipe prend sa part, il ne descendra pas plus bas.\n` +
            `LockBit : Adresse de paiement (unique pour vous) : ${A(w, plaint.ransomAddr)}\n` +
            `LockBit : Envoyez d'abord un petit montant test si vous voulez.`,
        },
        {
          id: 'pv', type: 'pv', title: 'Audition du RSSI (extrait)', date: office(plaintFinal.time + 2 * DAY), author: rssi,
          body:
            `« Nous avons d'abord envoyé un paiement test, puis le solde le ${fmtDate(plaintFinal.time)}.\n` +
            `Transaction du solde : ${plaintFinal.hash}\n` +
            `Le déchiffreur fourni ensuite fonctionnait partiellement. »`,
        },
        {
          id: 'dfir', type: 'rapport', title: 'Rapport de réponse à incident (extrait)', date: office(plaintFinal.time + 9 * DAY), author: 'Prestataire de réponse à incident (PRIS)',
          body:
            `Accès initial : compte VPN d'un prestataire de maintenance, sans double authentification, utilisé depuis une IP de sortie Mullvad.\n` +
            `Mouvements latéraux : Cobalt Strike ; serveur de commande et de contrôle à l'adresse ${c2Ip}, hébergée chez BulletHost (hébergeur offshore payable en bitcoin).\n` +
            `Exfiltration : ${r.int(120, 600)} Go vers un serveur de stockage du même hébergeur, quatre jours avant le chiffrement.\n` +
            `Opérateur humain : horaires d'activité compatibles avec un fuseau UTC+3 ; pseudonyme « ${affHandle} » laissé dans un fichier de configuration.`,
        },
        {
          id: 'cert', type: 'note', title: 'Fiche menace CERT — LockBit', date: office(w.at(-130 * 24)), author: 'CERT partenaire',
          body:
            `LockBit : RaaS actif depuis 2019 (versions 2.0 en 2021 et 3.0 en 2022)${w.t0 > 1708387200 ? ' ; infrastructure saisie en février 2024 (opération Cronos), le groupe a ensuite relancé son programme d\'affiliation' : ''}. Programme d'affiliation : l'affilié reçoit la majorité de chaque rançon (autour de 80 %), l'équipe centrale une part fixe prélevée automatiquement à chaque paiement.\n` +
            `Adresses de rançon uniques par victime ; l'adresse de paiement de l'affilié, elle, est déclarée une fois dans le panneau.\n` +
            `Affiliés : achats d'infrastructure (VPS, VPN) en bitcoin, mixeurs, exchanges à KYC faible ; manœuvres de diversion observées (éclatement des fonds en plusieurs adresses, envois de montants identiques à quelques minutes d'intervalle).\n` +
            `Équipe centrale : observée en lien avec des plateformes sanctionnées.`,
        },
        {
          id: 'europol', type: 'note', title: 'Renseignement partenaire — Europol (diffusion restreinte)', date: office(gT + 4 * DAY), author: 'Point de contact Europol (EC3)',
          body:
            `Un affilié utilisant le pseudonyme « ${affHandle} » est rattaché à plusieurs intrusions du groupe en Europe sur la période. Il déclare dans le panneau une adresse de paiement unique (non communiquée ici).\n` +
            `Méthode connue : après chaque partage, éclatement des fonds vers plusieurs adresses neuves, puis envois de montants identiques depuis une même adresse pour brouiller les corrélations. Seule une branche aboutit habituellement chez un exchange.\n` +
            `Toute adresse d'agrégation de l'équipe centrale identifiée par votre service est à nous transmettre pour rapprochement.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'number', points: 10, tolerance: 2, unit: '%',
          prompt: 'Quelle part (en %) de chaque rançon revient aux opérateurs de LockBit ?',
          answer: opPct,
          hint: 'Examinez la transaction qui dépense l\'adresse de rançon : deux sorties, dans un rapport constant d\'une victime à l\'autre.',
          explanation: `Chaque transaction de partage envoie ${opPct} % (après frais) aux opérateurs et ${100 - opPct} % à l'affilié. Pour ${plaint.name} : ${amt(plaint.opShare, 'BTC')} contre ${amt(plaint.affShare, 'BTC')}. Le rapport est le même pour toutes les victimes, quel que soit l'affilié : c'est la clé de partage du programme, appliquée par le panneau.`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: 'Quelle est l\'adresse d\'agrégation des opérateurs (celle qui reçoit la part « opérateurs » de chaque partage) ?',
          answer: [operator],
          hint: 'Deux sorties du partage reviennent à des adresses déjà vues : l\'une ne reçoit que des partages d\'un même affilié, l\'autre reçoit la petite part de TOUS les partages.',
          explanation: `${A(w, operator)} reçoit la petite part (${opPct} %) de ${m} transactions de partage, quel que soit l'affilié. Piège : l'adresse de paiement de l'affilié de la plaignante (${A(w, P)}) est elle aussi réutilisée (${pShares.length} partages), mais elle reçoit la grosse part, et uniquement pour ses propres attaques. Les autres entrées de l'adresse d'agrégation (reliquat d'une ancienne adresse du groupe, poussière de 546 sats) ne sont pas des partages.`,
        },
        {
          id: 'o6', type: 'addresses', points: 12,
          prompt: 'Sélectionnez toutes les adresses de rançon (une par victime) dont la part « opérateurs » aboutit à cette adresse d\'agrégation, y compris celle de l\'entreprise plaignante.',
          answer: victims.map((v) => v.ransomAddr),
          hint: 'Parmi les entrées de l\'adresse d\'agrégation, ne retenez que les transactions de partage (deux sorties, rapport constant) ; leur entrée est une adresse de rançon. Écartez le reliquat de l\'ancienne adresse et la poussière.',
          explanation: `${m} adresses de rançon, une par victime :\n${victims.map((v) => `   • ${A(w, v.ransomAddr)} — ${v.name}`).join('\n')}\nLes partages ne sont pas les seules entrées de l'adresse d'agrégation : le transfert de ${amt(carry, 'BTC')} du ${fmtDate(carryTx.time, false)} vient d'une ancienne adresse du groupe (une seule sortie, aucun affilié payé) et les dépôts de 546 sats sont de la poussière. Chaque adresse de rançon permet ensuite de remonter au courtier qui a vendu les bitcoins à la victime, donc d'identifier des victimes qui n'ont pas porté plainte.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.02,
          prompt: 'Montant total (en BTC) des rançons payées par l\'ensemble des victimes reliées à cette adresse ?',
          answer: totalPaid,
          hint: 'Remontez chaque partage jusqu\'à son adresse de rançon, et additionnez tous les paiements reçus (tests compris).',
          explanation: `${m} victimes :\n${recapVictims}\nTotal : ${amt(totalPaid, 'BTC')} (≈ ${Math.round(usd('BTC', totalPaid)).toLocaleString('fr-FR')} $). Le reliquat de l'ancienne adresse et la poussière ne sont pas des rançons et ne s'additionnent pas.`,
        },
        {
          id: 'o12', type: 'number', points: 8, tolerance: 0,
          prompt: 'L\'adresse de paiement de l\'affilié qui a attaqué la plaignante est réutilisée. Combien de rançons (transactions de partage) l\'ont alimentée ?',
          answer: pShares.length,
          hint: 'Ouvrez toutes les entrées de cette adresse : un partage a deux sorties, dont l\'une va à l\'adresse d\'agrégation des opérateurs. Les autres entrées (fonds anciens, poussière, retour d\'une branche) ne comptent pas.',
          explanation: `${pShares.length} partages alimentent ${A(w, P)} :\n${pShares.map((v) => `   • ${v.name} — ${amt(v.affShare, 'BTC')} le ${fmtDate(v.split.time, false)}`).join('\n')}\nL'adresse reçoit au total ${pInputs.length} transactions entrantes (hors rendus qu'elle se renvoie) : le reste est l'historique antérieur de l'affilié (fonds sans lien avec LockBit, des mois avant), de la poussière et, le cas échéant, le retour d'une de ses propres branches. Ces autres attaques du même affilié sont à rapprocher de la procédure (renseignement Europol).`,
        },
        {
          id: 'o13', type: 'address', points: 12,
          prompt: 'Peu après le partage de la rançon de la plaignante, l\'affilié éclate ses fonds vers quatre adresses neuves en moins de trois heures. Laquelle de ces branches mène à sa plateforme d\'encaissement ?',
          answer: [h1],
          hint: 'Les quatre branches ont le même type d\'adresse et des montants arrondis comparables : suivez chacune jusqu\'au bout. Une seule repart vers une nouvelle adresse puis vers des services.',
          explanation: `La branche ${A(w, h1)} (${amt(mainValue, 'BTC')}, ${hm(mainTx.time)}) est transférée en totalité ${Math.round((realTwin.time - mainTx.time) / HOUR)} h plus tard vers ${A(w, h4)}, qui alimente le mixeur puis l'exchange. Les trois autres sont des impasses :\n${branchList}\nNi le montant (toutes les branches sont arrondies au millième), ni le type d'adresse, ni l'ordre d'envoi ne désignent la bonne : seul le suivi de chaque branche jusqu'à son terme permet de trancher, et c'est ce qui doit figurer au rapport.`,
        },
        {
          id: 'o14', type: 'tx', points: 12,
          prompt: `Depuis cette branche, quatre transactions d'environ ${amt(r4(V), 'BTC')} partent en moins d'une heure vers quatre adresses différentes. Laquelle transporte réellement les fonds issus de la rançon ?`,
          answer: [realTwin.id],
          hint: 'Comparez les entrées : quelle pièce chaque transaction dépense-t-elle ? Y a-t-il un rendu ? Le montant exact, rapporté à ce que la branche a reçu, est décisif.',
          explanation: `${realTwin.hash.slice(0, 16)}… (${hm(realTwin.time)}) dépense l'unique pièce reçue lors de l'éclatement (${amt(mainValue, 'BTC')}) et envoie ${amt(V, 'BTC')} vers ${A(w, h4)}, sans rendu : exactement le montant reçu moins les frais. Les trois jumelles, de montant presque identique, sont des leurres alimentés par des fonds frais :\n${twinList}\nAucune ne touche la pièce de l'éclatement. Leurs destinations sont d'ailleurs sans issue utile (l'une dort, une autre part chez ${orbit.name}, la dernière fait un saut puis dort). Suivre la pièce, et non le montant, démonte la manœuvre.`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) de la branche réelle est envoyé dans un mixeur ?',
          answer: mixValue,
          hint: 'Suivez la continuation retenue : la transaction suivante a une sortie vers une adresse de dépôt attribuée à un mixeur.',
          explanation: `${A(w, h4)} envoie ${amt(mixValue, 'BTC')} (montant arrondi au millième) vers une adresse de dépôt ${neb.entity.name}, soit ${Math.round((mixValue / V) * 100)} % des fonds de la branche. Le mixeur ne reçoit qu'une fraction : le reste ne passe pas par lui et se suit directement.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Sur quelle adresse revient le reste des fonds lors de ce dépôt dans le mixeur (rendu) ?',
          answer: [h5],
          hint: 'La transaction de dépôt au mixeur a deux sorties : l\'une est attribuée au mixeur, l\'autre est une adresse neuve du même type que l\'adresse dépensée.',
          explanation: `${A(w, h5)} reçoit le rendu de la transaction de dépôt chez ${neb.entity.name} : même type d'adresse que ${A(w, h4).slice(0, 14)}…, montant non arrondi, et c'est elle qui alimente ensuite le dépôt sur l'exchange. Repérer ce rendu permet de « contourner » le mixeur : la majorité des fonds n'y est jamais entrée.`,
        },
        {
          id: 'o10', type: 'tx', points: 10,
          prompt: 'Quelle transaction dépose la part affilié sur sa plateforme d\'encaissement (hash à joindre à la réquisition) ?',
          answer: [xTx.id],
          hint: 'Suivez la dépense du rendu : la sortie principale va vers une adresse de dépôt, balayée ensuite vers le portefeuille chaud d\'un exchange.',
          explanation: `${xTx.hash.slice(0, 16)}… envoie ${amt(xValue, 'BTC')} depuis ${A(w, h5).slice(0, 14)}… vers l'adresse de dépôt ${A(w, xDeposit)} de ${xName}, le ${fmtDate(xTx.time)} ; le rendu part sur ${A(w, h6).slice(0, 14)}…, où il dort. Le hash, l'adresse de dépôt, la date et le montant sont les quatre éléments qui permettent à la plateforme de retrouver le compte crédité sans ambiguïté.`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme l\'affilié ayant attaqué l\'entreprise plaignante a-t-il encaissé sa part ?',
          answer: [xKey],
          hint: 'Au bout de la branche réelle et de la bonne jumelle : un passage partiel par un mixeur, puis la grosse sortie vers une adresse de dépôt.',
          explanation: `Partage → ${A(w, P).slice(0, 12)}… (adresse de paiement réutilisée) → éclatement, branche ${A(w, h1).slice(0, 12)}… → transfert intégral vers ${A(w, h4).slice(0, 12)}… (parmi quatre envois jumeaux) → ${amt(mixValue, 'BTC')} dans ${neb.entity.name} → ${amt(xValue, 'BTC')} vers une adresse de dépôt ${xName}. ${orbit.name}, atteint par une jumelle, et les commerçants payés par une branche leurre ne reçoivent pas les fonds de la rançon.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) les opérateurs ont-ils envoyé depuis leur adresse d\'agrégation vers une plateforme d\'échange non coopérative ?',
          answer: gValue,
          hint: 'Après la dernière rançon, l\'adresse d\'agrégation fait une grosse dépense qui vide toutes ses pièces : une sortie vers une adresse de dépôt attribuée, l\'autre est le rendu. Les petites dépenses antérieures paient de l\'infrastructure.',
          explanation: `Le ${fmtDate(gTx.time, false)}, ${A(w, operator)} dépense ses ${opInCount} pièces et envoie ${amt(gValue, 'BTC')} vers une adresse de dépôt ${gName}, ${gLabel} ; le rendu part sur ${A(w, opRest)}, qui continue ensuite ses paiements (${opRestList}) et détient encore ${amt(opRestNow, 'BTC')}. Les ${infra.length} petites dépenses antérieures de l'adresse d'agrégation sont des paiements ${infraList} (infrastructure et vie courante), pas des dépôts sur une plateforme d'échange. D'autres clients de ${gName} déposent des montants voisins à la même heure : seul compte le dépôt issu de l'adresse d'agrégation. ${gName} ne répondra pas : l'exposition se documente et se signale (partenaires, TRACFIN), et le rendu des opérateurs se place sous surveillance.`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Quelle suite donner en priorité ?',
          ...choice(r,
            'Requérir l\'exchange de l\'affilié et transmettre l\'adresse d\'agrégation des opérateurs aux partenaires',
            [
              `Requérir ${gName}, plateforme qui a reçu une partie des fonds des opérateurs`,
              `Requérir ${orbit.name}, qui a reçu un envoi de même montant le jour du blanchiment`,
              'Demander à BulletHost l\'identité du client qui a loué le serveur de commande',
            ]),
          hint: 'Parmi les services rencontrés, lesquels coopèrent, lesquels ont reçu les fonds de la rançon, et à qui l\'adresse des opérateurs est-elle utile ?',
          explanation: `L'exchange de l'affilié (${xName}) est la seule porte d'identification réaliste : identité, IP, gel. ${procedureFor(X.entity)} L'adresse des opérateurs relie toutes les attaques : c'est un renseignement précieux pour les partenaires (Europol, CERT-FR, autres services saisis). ${gName} ne coopère pas ; BulletHost non plus (même si ses paiements documentent l'achat de l'infrastructure de l'attaque). ${orbit.name} n'a reçu qu'une jumelle alimentée par d'autres fonds : ce n'est pas la piste de la rançon.`,
        },
      ],
      truth: {
        path: [
          ...plaint.payments.map((x) => x.id), plaint.split.id,
          ...victims.filter((v) => v !== plaint).flatMap((v) => [...v.payments.map((x) => x.id), v.split.id]),
          mainTx.id, realTwin.id, mixRes.depositTx.id, xTx.id, xSweep.id, gTx.id,
        ],
        addresses: [plaint.ransomAddr, operator, P, ...victims.filter((v) => v !== plaint).map((v) => v.ransomAddr), h1, h4, h5, h6, xDeposit, mixRes.deposit, opRest, gDeposit],
        debrief:
          `1. ${plaint.name} paie ${amt(plaint.paid, 'BTC')} (test compris) sur l'adresse unique ${A(w, plaint.ransomAddr)}.\n` +
          `2. Quelques heures après le solde, une transaction de partage envoie ${100 - opPct} % à l'adresse de paiement de l'affilié « ${affHandle} » (${A(w, P)}, réutilisée pour ${pShares.length} attaques) et ${opPct} % à ${A(w, operator)}.\n` +
          `3. L'adresse d'agrégation reçoit la part opérateurs de ${m} rançons :\n${recapVictims}\n   Total : ${amt(totalPaid, 'BTC')}. Ses autres entrées (reliquat d'une ancienne adresse du groupe, poussière) et ses petites dépenses (paiements ${infraList}) sont la vie ordinaire d'un portefeuille opérationnel.\n` +
          `4. L'affilié éclate ses fonds vers quatre adresses neuves ; seule ${A(w, h1)} aboutit. Les leurres :\n${branchList}\n` +
          `5. Depuis ${A(w, h1).slice(0, 14)}…, quatre envois d'environ ${amt(r4(V), 'BTC')} partent en moins d'une heure ; seul ${realTwin.hash.slice(0, 12)}… dépense la pièce de l'éclatement (sans rendu, montant reçu moins frais). Les jumelles sont financées par des fonds frais ; l'une finit chez ${orbit.name} (${twinCasino.hash.slice(0, 10)}…).\n` +
          `6. ${A(w, h4).slice(0, 14)}… mixe ${amt(mixValue, 'BTC')} chez ${neb.entity.name} (rendu sur ${A(w, h5)}), puis dépose ${amt(xValue, 'BTC')} chez ${xName} (${xTx.hash.slice(0, 12)}…).\n` +
          `7. Dernier acte : les opérateurs envoient ${amt(gValue, 'BTC')} vers ${gName} (${gLabel}), au milieu de dépôts voisins d'autres clients, et conservent le rendu sur ${A(w, opRest)}.\n\n` +
          `Leçon : dans un RaaS, la transaction de partage est la signature du modèle économique. Le rapport constant entre les deux sorties révèle la clé de partage, et l'adresse qui reçoit la petite part à chaque attaque désigne l'équipe centrale, ce qui relie des victimes qui n'ont jamais porté plainte ensemble. Côté affilié, les manœuvres de diversion (branches, jumelles) ne résistent pas à une règle simple : suivre les pièces, pas les montants, et pousser chaque branche jusqu'à son terme avant de conclure. On cible ensuite la sortie vers un exchange coopératif, en suivant le rendu plutôt que la fraction mixée.`,
      },
      hints: [
        'L\'adresse de rançon figure dans l\'extrait du portail de négociation.',
        'La transaction qui dépense l\'adresse de rançon n\'a que deux sorties : calculez leur rapport, puis regardez laquelle reçoit la petite part de toutes les attaques.',
        'L\'adresse de paiement de l\'affilié vit : historique ancien, serveurs payés, poussière. Les partages se reconnaissent à leurs deux sorties, dont l\'une va aux opérateurs.',
        'Lors de l\'éclatement, suivez les quatre branches jusqu\'au bout : trois sont des impasses.',
        'Face à des envois de même montant, regardez la pièce dépensée par chacun et la présence d\'un rendu.',
        'Les opérateurs ne vident leur adresse d\'agrégation qu\'une fois : une sortie vers un service, un rendu.',
      ],
    }
  },
}
