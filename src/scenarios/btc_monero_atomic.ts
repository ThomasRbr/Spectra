import { World, type Tx } from '../engine/world'
import { exchange, openChannel, roundCoin, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd, fromUsd } from '../engine/chains'
import { decoyBranches, dusting, otherVictimPayments, personalSpending, type Branch } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const xmr = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} XMR`
const pct = (v: number) => `${(v * 100).toFixed(2).replace('.', ',')} %`

/** Début du jour calendaire (heure de Paris) contenant `ts`. */
function parisDayStart(ts: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0)
  return ts - (g('hour') * 3600 + g('minute') * 60 + g('second'))
}
const weekday = (ts: number) => new Date(ts * 1000).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
/** Même jour, heure de service (8 h–18 h, heure de Paris) : pour les pièces de procédure. */
const office = (ts: number) => Math.floor(ts / 86400) * 86400 + 7 * 3600 + (Math.abs(Math.round(ts)) % (9 * 3600))
const hhmm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

// Pas de nom de famille du générateur d'identités (évite les homonymes avec les personnages)
const VICTIMS = ['Clinique du Parc', 'Centre d\'imagerie Saint-Roch', 'Cabinet d\'expertise comptable Arcole Conseil', 'Laboratoire d\'analyses Pasteur-Est', 'Étude notariale du Mail']
const OTHER_TARGETS = ['un cabinet dentaire', 'une agence immobilière', 'un cabinet d\'avocats', 'une PME de transport', 'une mutuelle locale', 'un office de tourisme']

const FATE: Record<Branch['fate'], string> = {
  dort: 'jamais dépensée depuis',
  dépensée: 'quelques petites dépenses (commerçants ou particuliers), puis plus rien',
  retour: 'renvoyée quelques heures ou jours plus tard vers une autre adresse du suspect, où elle dort',
  éclatée: 'redécoupée en plusieurs sorties vers des adresses neuves, sans activité ultérieure',
}

export const btcMoneroAtomic: ScenarioTemplate = {
  id: 'monero-atomic',
  title: 'Au-delà du mur Monero',
  tagline: 'Une adresse d\'extorsion réutilisée, des branches mortes, trois verrous jumeaux et une sortie à dater : travailler les bords d\'un passage par Monero.',
  description:
    'La rançon d\'une extorsion après vol de données arrive sur une adresse déjà utilisée contre d\'autres victimes. L\'auteur éclate une partie des fonds en branches sans issue, entre dans Monero par un échangeur instantané puis par un swap atomique noyé parmi des transferts jumeaux et des swaps d\'autres utilisateurs, et ressort quelques jours plus tard sur une plateforme. Avec la clé de vue saisie, une note et la corrélation montant / temps, triez à chaque étape, identifiez les points d\'entrée et de sortie, et mesurez honnêtement la force de chaque rattachement.',
  difficulty: 4,
  chains: ['btc', 'xmr'],
  skills: ['privacy', 'crosschain', 'exchange_id', 'requisition', 'osint'],
  estMinutes: 100,
  lessons: ['monero', 'echangeurs-instantanes', 'lightning', 'analyse-comportementale', 'chain-hopping', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimName = r.pick(VICTIMS)
    const director = fakePerson(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const handle = fakeHandle(r)
    const [target1, target2] = r.shuffle([...OTHER_TARGETS])
    const city1 = fakeCity(r)
    const city2 = fakeCity(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const cv = exchange(w, 'coinhouse', 'btc')
    const cnE = w.entity('changenow')
    const cnDep = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    const cnHot = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Hot Wallet BTC', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const hx = exchange(w, 'huobex', 'btc')
    const others = r.shuffle(['binance', 'kraken', 'okx', 'bitstamp', 'coinbase'] as const)
    const dx = exchange(w, others[0], 'btc')
    const mk = exchange(w, others[1], 'btc')
    // Commerces fictifs propres au dossier
    const vouchio = w.customEntity({ name: 'Vouchio', category: 'merchant', known: true, risk: 'medium', description: 'Vente de cartes cadeaux et de bons d\'achat contre bitcoin (fictif) ; factures à adresse unique, codes livrés par courriel.' })
    const spinwell = w.customEntity({ name: 'Spinwell', category: 'gambling', known: true, risk: 'medium', description: 'Casino en ligne crypto (fictif), inscription par simple adresse électronique.' })
    const satshost = w.customEntity({ name: 'SatsHost', category: 'merchant', known: true, risk: 'high', country: 'Seychelles', description: 'Hébergeur de serveurs privés virtuels payables en bitcoin (fictif), sans vérification d\'identité ; conserve l\'adresse électronique et les journaux de connexion.' })
    const lumen = w.entity('lumen_lsp')
    const suspect = w.customEntity({ name: `${sp.name} (@${handle}, mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const makerE = w.customEntity({ name: 'Contrepartie de swap atomique (non identifiée)', category: 'individual' })
    const mine = () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' })

    const fpKey = (id: string) => {
      const p = w.walletProfile(id)
      return `${p.version}|${p.locktime}|${p.rbf}`
    }

    // ── Rançon ───────────────────────────────────────────────────────────────
    const R = mine()
    const suspectKey = fpKey(R)
    /** Adresse d'un tiers dont le logiciel a une empreinte différente de celle du suspect. */
    const unlike = (id: string) => {
      let k = 0
      while (fpKey(id) === suspectKey) w.get(id).wallet = `${id}#${++k}`
      return id
    }
    const P = roundCoin(w, 1.6, 3.8, 0.1)
    const victimAddr = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const tPay = w.at(0)
    cv.withdraw(victimAddr, r8(P + r.float(0.002, 0.01)), tPay - Math.round(r.float(5, 20) * HOUR))
    const ransomTx = w.utxoTx({ time: tPay, from: [victimAddr], to: [{ address: R, value: P }] })

    // ── Éclatement : branches sans issue, prélevées sur la rançon ────────────
    const K = mine()
    // Une branche par appel, à des heures croissantes : appelée avec plusieurs
    // branches, decoyBranches peut dater une branche AVANT la précédente, dont
    // le rendu n'existe pas encore, et déclencher un financement automatique.
    const branches: Branch[] = []
    let tBranch = tPay + Math.round(r.float(1, 3) * HOUR)
    const nBranches = r.int(3, 4)
    for (let i = 0; i < nBranches; i++) {
      branches.push(...decoyBranches(w, R, { time: tBranch, share: r.float(0.04, 0.065), branches: 1, returnTo: K }))
      tBranch += r.int(8, 45) * 60
    }
    const lastBranchT = Math.max(...branches.map((b) => b.tx.time))

    // ── Entrée 1 : échangeur instantané (BTC → XMR) ──────────────────────────
    const tE1 = lastBranchT + Math.round(r.float(4, 14) * HOUR)
    const Aval = roundCoin(w, P * 0.38, P * 0.46, 0.001)
    const R2 = mine()
    const entryTx = w.utxoTx({ time: tE1, from: [R], to: [{ address: cnDep, value: Aval }], change: R2, spendAll: true })
    const cnSweep = forwardAll(w, cnDep, cnHot, tE1 + r.int(10, 40) * 60, undefined, ['sweep'])
    const xmrA = roundAsset('XMR', fromUsd('XMR', usd('BTC', Aval) * (1 - r.float(0.006, 0.015))))
    const tXa = tE1 + r.int(15, 45) * 60

    // ── Entrée 2 : swap atomique (verrou P2WSH 2-de-2, réclamé par la contrepartie) ──
    const tLock = tE1 + Math.round(r.float(20, 60) * HOUR)
    const lock = w.addr('btc', { kind: 'p2wsh', wallet: `swap:${R2}` })
    const R3 = mine()
    const Bval = Math.floor(w.unspentValue(R2, tLock) * r.float(0.85, 0.93) * 1000) / 1000
    const lockTx = w.utxoTx({ time: tLock, from: [R2], to: [{ address: lock, value: Bval }], change: R3, spendAll: true })
    const makerAddr = w.addr('btc', { entity: makerE, kind: 'p2wpkh' })
    const redeemFee = w.estimateFee('btc', 1, 1)
    const redeemTx = w.rawUtxoTx({ time: tLock + r.int(25, 70) * 60, spend: [{ address: lock }], outputs: [{ address: makerAddr, value: r8(Bval - redeemFee) }] })
    redeemTx.fp = { version: 2, locktime: 0, rbf: false }
    const xmrB = roundAsset('XMR', fromUsd('XMR', usd('BTC', Bval) * (1 - r.float(0.008, 0.02))))
    const tXb = redeemTx.time + r.int(20, 50) * 60
    const tMk = redeemTx.time + Math.round(r.float(18, 60) * HOUR)

    /** Swap atomique d'un autre utilisateur : verrou P2WSH puis réclamation vers `claimTo`. */
    const foreignSwap = (v: number, t: number, claimTo: string) => {
      const u = unlike(w.addr('btc', { kind: 'p2wpkh' }))
      w.fund(u, r8(v * r.float(1.05, 1.6)), t - Math.round(r.float(2, 96) * HOUR))
      const lk = w.addr('btc', { kind: 'p2wsh', wallet: `swap:${u}` })
      const lt = w.utxoTx({ time: t, from: [u], to: [{ address: lk, value: v }] })
      const fee = w.estimateFee('btc', 1, 1)
      const rt = w.rawUtxoTx({ time: t + r.int(20, 65) * 60, spend: [{ address: lk }], outputs: [{ address: claimTo, value: r8(v - fee) }] })
      rt.fp = { version: 2, locktime: 0, rbf: false }
      return { lock: lk, lockTx: lt, redeemTx: rt }
    }
    // Autres swaps du même teneur de marché (il réutilise son adresse de réclamation)
    Array.from({ length: r.int(2, 3) }, () =>
      foreignSwap(roundCoin(w, 0.05, 1.2, 0.001), redeemTx.time - Math.round(r.float(5, 30) * HOUR), makerAddr))
    // Swaps d'autres utilisateurs, de montant voisin, dans l'heure du verrou du suspect
    void [
      foreignSwap(r8(Math.round(Bval * (1 + r.float(0.003, 0.012) * (r.chance(0.5) ? 1 : -1)) * 1e5) / 1e5), tLock + r.int(-50, 50) * 60, makerAddr),
      foreignSwap(r8(Math.round(Bval * (1 + r.float(0.003, 0.012) * (r.chance(0.5) ? 1 : -1)) * 1e5) / 1e5), tLock + r.int(-50, 50) * 60, w.addr('btc', { kind: 'p2wpkh' })),
    ]
    // La contrepartie regroupe ses réclamations et dépose chez un exchange : fausse piste
    const makerOther = w.addr('btc', { entity: makerE, kind: 'p2wpkh' })
    w.fund(makerOther, roundCoin(w, 0.2, 1.5, 0.001), redeemTx.time - Math.round(r.float(2, 30) * HOUR))
    const makerDep = mk.newDeposit()
    const makerIn = w.unspentValue(makerAddr, tMk) + w.unspentValue(makerOther, tMk)
    const makerNIn = w.utxosOf(makerAddr, tMk).length + w.utxosOf(makerOther, tMk).length
    const makerFee = w.estimateFee('btc', makerNIn, 1)
    const makerTx = w.utxoTx({ time: tMk, from: [makerAddr, makerOther], to: [{ address: makerDep, value: r8(makerIn - makerFee) }], fee: makerFee, change: null, spendAll: true })
    mk.sweep([makerDep], tMk + Math.round(r.float(1, 6) * HOUR))
    const makerClaims = makerTx.inputs.filter((i) => i.address === makerAddr).length

    // ── Transferts jumeaux depuis R2 : même montant, dans la même heure ──────
    // Réalimentée juste avant par des apports extérieurs, R2 émet deux autres
    // sorties de ≈ Bval : l'ouverture d'un canal Lightning et un coffre 2-de-3.
    const twinVal = () => r8(Math.round(Bval * (1 + r.float(-0.004, 0.004)) * 1e5) / 1e5)
    const twinT = () => tLock + (r.chance(0.5) ? 1 : -1) * r.int(4, 25) * 60
    const tw1T = twinT()
    const tw1V = twinVal()
    w.fund(R2, r8(tw1V * 1.02 + 0.0002), tw1T - r.int(15 * 60, 2 * HOUR))
    const channel = openChannel(w, { from: R2, peer: lumen, capacity: tw1V, time: tw1T, change: R2 })
    const tClose = tw1T + Math.round(r.float(3, 8) * DAY)
    const closeTx = channel.cooperativeClose({ time: tClose, toLocal: r8(tw1V * r.float(0.55, 0.8)) })
    const chanBack = closeTx.outputs.find((o) => w.get(o.address).entityId === suspect.id)
    const tw2T = twinT()
    const tw2V = twinVal()
    w.fund(R2, r8(tw2V * 1.02 + 0.0002), tw2T - r.int(15 * 60, 2 * HOUR))
    const vault = w.addr('btc', { kind: 'p2wsh', wallet: `vault:${handle}`, multisig: { m: 2, n: 3 } })
    const vaultTx = w.utxoTx({ time: tw2T, from: [R2], to: [{ address: vault, value: tw2V }], change: R2 })

    // ── Sortie : XMR → BTC sur une plateforme, jour annoncé dans une note ────
    const tExit0 = tLock + Math.round(r.float(3, 8) * DAY)
    const day0 = parisDayStart(tExit0)
    const tExit = day0 + Math.round(r.float(9, 18) * HOUR)
    const E = Math.round((Aval + Bval) * r.float(0.6, 0.82) * 1e5) / 1e5
    const quoted = Math.round(E * 100) / 100
    const quotedTxt = quoted.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
    const X1 = mine()
    const exitTx = hx.withdraw(X1, E, tExit)
    // Leurres : montants voisins le même jour (dont un de la même plateforme dans
    // l'heure), et un très proche la veille ou le lendemain
    const sgn = () => (r.chance(0.5) ? 1 : -1)
    const decoys: { addr: string; tx: Tx; spent: boolean }[] = []
    const dec = (pay: (to: string, v: number, t: number) => Tx, v: number, t: number, spent = true) => {
      const a = unlike(w.addr('btc'))
      decoys.push({ addr: a, tx: pay(a, Math.round(v * 1e5) / 1e5, Math.round(t)), spent })
    }
    dec((to, v, t) => hx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.015, 0.03)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => dx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.001, 0.004)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => w.utxoTx({ time: t, from: [cnHot], to: [{ address: to, value: v }], change: cnHot, tags: ['payout'] }), E * (1 + sgn() * r.float(0.008, 0.02)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => hx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.002, 0.006)), tExit + sgn() * r.int(12, 50) * 60)
    dec((to, v, t) => hx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.001, 0.003)), r.chance(0.5) ? day0 - r.float(2, 20) * HOUR : day0 + r.float(26, 44) * HOUR, false)
    // Comportement ultérieur : la sortie du suspect est dépensée par son logiciel habituel
    const X2 = mine()
    const invoice = w.addr('btc', { entity: vouchio, label: 'Vouchio — Facture', tags: ['invoice'] })
    const cardValue = roundCoin(w, 0.01, 0.04, 0.0001)
    const spendX = w.utxoTx({ time: tExit + Math.round(r.float(20, 60) * HOUR), from: [X1], to: [{ address: invoice, value: cardValue }], change: X2 })
    for (const d of decoys) {
      if (!d.spent) continue
      w.utxoTx({ time: d.tx.time + Math.round(r.float(5, 50) * HOUR), from: [d.addr], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(d.addr) * r.float(0.3, 0.7)) }] })
    }

    // ── Habillage des portefeuilles du suspect (après le flux réel) ──────────
    // Adresse d'extorsion réutilisée : victimes antérieures, puis vidage vers ChangeNOW
    const priorVictims = otherVictimPayments(w, R, { start: tPay - 50 * DAY, end: tPay - 9 * DAY, n: r.int(2, 3), minUsd: 6000, maxUsd: 30000 })
    const tEarly = tPay - Math.round(r.float(5, 8) * DAY)
    const cnDep0 = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    const earlyTx = forwardAll(w, R, cnDep0, tEarly)
    forwardAll(w, cnDep0, cnHot, tEarly + r.int(10, 40) * 60, undefined, ['sweep'])
    const earlyValue = receivedIn(w, earlyTx, cnDep0)
    const xmr0 = roundAsset('XMR', fromUsd('XMR', usd('BTC', earlyValue) * (1 - r.float(0.006, 0.015))))
    const tX0 = tEarly + r.int(15, 45) * 60
    // Paiement tardif d'une autre victime, après le départ des fonds (reste sur l'adresse)
    const lateVictims = otherVictimPayments(w, R, { start: tE1 + 1 * DAY, end: tLock + 2 * DAY, n: 1, minUsd: 4000, maxUsd: 15000 })
    // Poussière
    dusting(w, R, { time: tPay + 30 * HOUR, n: 3, spreadH: 24 })
    dusting(w, R2, { time: tLock + 30 * HOUR, n: r.int(2, 3), spreadH: 18 })
    dusting(w, X2, { time: spendX.time + 36 * HOUR, n: 3, spreadH: 28 })
    // Rendu de la sortie réutilisé : dépenses personnelles et nouveau retrait Huobex
    // Un paiement par fenêtre, fenêtres successives : personalSpending tire ses
    // dates sans les trier, et un paiement daté avant le précédent ne trouve pas
    // encore son rendu (financement automatique par un tiers).
    const spending = { txs: [] as Tx[] }
    const nSpend = r.int(4, 5)
    const spendSpan = (9 * DAY) / nSpend
    for (let i = 0; i < nSpend; i++) {
      const s0 = spendX.time + 3 * HOUR + i * spendSpan
      spending.txs.push(...personalSpending(w, X2, { start: s0, end: s0 + spendSpan * 0.9, n: 1, merchants: [vouchio, 'mullvad', spinwell, satshost], maxUsd: 450 }).txs)
    }
    const tReuse = spendX.time + Math.round(r.float(2, 6) * DAY)
    const reuseValue = roundCoin(w, 0.05, 0.25, 0.001)
    const reuseTx = hx.withdraw(X2, reuseValue, tReuse)

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (let i = 0; i < r.int(5, 8); i++) {
      const c = w.addr('btc')
      const d = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
      const t = tE1 + r.float(-2, 9) * DAY
      w.fund(c, roundCoin(w, 0.01, 0.9, 0.0001), t - r.int(2, 30) * HOUR)
      forwardAll(w, c, d, Math.round(t))
      forwardAll(w, d, cnHot, Math.round(t) + r.int(10, 60) * 60, undefined, ['sweep'])
    }
    // Deux clients de ChangeNOW déposent presque le même montant que le suspect, dans l'heure
    for (let i = 0; i < 2; i++) {
      const c = unlike(w.addr('btc'))
      const d = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
      const t = tE1 + sgn() * r.int(8, 55) * 60
      const v = r8(Math.round(Aval * (1 + sgn() * r.float(0.002, 0.012)) * 1e5) / 1e5)
      w.fund(c, r8(v * r.float(1.02, 1.4)), t - r.int(2, 30) * HOUR)
      w.utxoTx({ time: t, from: [c], to: [{ address: d, value: v }] })
      forwardAll(w, d, cnHot, t + r.int(10, 60) * 60, undefined, ['sweep'])
    }
    for (let i = 0; i < r.int(6, 10); i++) w.utxoTx({ time: Math.round(tE1 + r.float(-2, 9) * DAY), from: [cnHot], to: [{ address: w.addr('btc'), value: roundCoin(w, 0.005, 0.6, 0.00001) }], change: cnHot, tags: ['payout'] })
    hx.noise(14, day0 - 3 * DAY, day0 + 3 * DAY)
    dx.noise(10, day0 - 3 * DAY, day0 + 3 * DAY)
    mk.noise(8, tMk - 2 * DAY, tMk + 2 * DAY)
    cv.noise(6, tPay - 5 * DAY, tPay + 2 * DAY)

    // ── Valeurs pour les textes (calculées sur le monde final) ───────────────
    const entered = r8(Aval + Bval)
    const reliquat = r8(w.unspentValue(R3))
    const DUST_MAX = 0.00001
    const rIncoming = w.txsOf(R).filter((t) => !t.inputs.some((i) => i.address === R) && receivedIn(w, t, R) > DUST_MAX)
    const rDust = w.txsOf(R).filter((t) => !t.inputs.some((i) => i.address === R) && receivedIn(w, t, R) <= DUST_MAX)
    const nPayments = rIncoming.length
    const rLeft = r8(w.unspentValue(R))
    const branchTotal = r8(branches.reduce((s, b) => s + b.value, 0))
    const tArrest = tExit + Math.round(r.float(5, 15) * DAY)
    let vk = ''
    for (let i = 0; i < 64; i++) vk += '0123456789abcdef'[r.int(0, 15)]
    const primary = `4${r.pick(['A', 'B', '8', '9'])}${Array.from({ length: 6 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[r.int(0, 57)]).join('')}`
    const exitHit = Math.abs(quoted - E) / E
    const sameDay = decoys.filter((d) => d.tx.time >= day0 && d.tx.time < day0 + DAY)
    const hourDecoy = decoys[3]
    const offDay = decoys[4]
    const hourDecoyV = receivedIn(w, hourDecoy.tx, hourDecoy.addr)
    const lockMin = Math.round((redeemTx.time - lockTx.time) / 60)
    const redeemToXmr = Math.round((tXb - redeemTx.time) / 60)
    const twinsList = [
      { t: lockTx.time, v: Bval, what: 'verrou' },
      { t: channel.tx.time, v: tw1V, what: 'canal' },
      { t: vaultTx.time, v: tw2V, what: 'coffre' },
    ].sort((a, b) => a.t - b.t)
    const dayOf = (ts: number) => fmtDate(ts, false)
    const twinWindow = dayOf(twinsList[0].t) === dayOf(twinsList[2].t) ? `le ${dayOf(twinsList[0].t)}, entre ${hhmm(twinsList[0].t)} et ${hhmm(twinsList[2].t)}` : `entre le ${dayOf(twinsList[0].t)} à ${hhmm(twinsList[0].t)} et le ${dayOf(twinsList[2].t)} à ${hhmm(twinsList[2].t)}`
    const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
    const priorTxt = pl(priorVictims.txs.length, 'paiement antérieur', 'paiements antérieurs')
    // Destinataires des dépenses du rendu de la sortie (lus dans le monde)
    const spendNames = [...new Set(spending.txs.flatMap((x) => x.outputs.filter((o) => o.address !== X2).map((o) => w.ownerOf(o.address)?.name ?? 'des particuliers')))]
    const spendList = spendNames.join(', ').replace(/, ([^,]+)$/, ' et $1')
    const branchLines = branches.map((b) => `${btc(b.value)} vers ${A(w, b.address).slice(0, 14)}… (${FATE[b.fate]})`).join(' ; ')
    const choiceO2 = choice(r,
      'Un swap atomique : verrou 2-de-2 côté Bitcoin, réclamé par la contrepartie qui livre des XMR',
      [
        'Un canal Lightning ouvert puis refermé de façon coopérative après quelques paiements',
        'Un coffre multisignature personnel, vidé ensuite par le suspect vers sa propre adresse',
        'Un CoinJoin à deux participants, destiné à brouiller la piste des fonds de la rançon',
      ])
    const choiceO7 = choice(r,
      'Entrées établies ; sortie rattachée par un faisceau (date, montant, empreinte, réutilisation du rendu), à corroborer par réquisition',
      [
        'Preuve certaine : la clé de vue permet de suivre les XMR jusqu\'à la plateforme de sortie',
        'Aucune conclusion possible : Monero interdit tout rapprochement entre l\'entrée et la sortie',
        'Preuve certaine : une empreinte de portefeuille identique désigne un seul et même utilisateur',
      ])

    return {
      world: w,
      title: `Extorsion et Monero — ${victimName} (${city})`,
      briefing:
        `La structure « ${victimName} » (${city}) a été victime d'une intrusion informatique : des données sensibles ont été copiées, puis l'auteur a exigé ${btc(P)} pour ne pas les publier. Sur décision de sa direction, la structure a payé depuis un compte Coinhouse.\n\n` +
        `Les investigations techniques ont conduit à ${sp.name} (@${handle}), ${ge('interpellé', 'interpellée')} à son domicile. Son ordinateur a été exploité : un portefeuille Monero chiffré (mot de passe inconnu), un fichier texte contenant la clé de vue privée de ce portefeuille, et une note. ${ge('Il', 'Elle')} conteste toute implication.\n\n` +
        `L'adresse de la rançon n'est pas neuve : d'autres structures ont reçu le même message. Après le paiement, les fonds ont été éclatés, puis ont quitté Bitcoin pour Monero, où l'on ne suit pas les fonds. Travaillez les bords, en triant à chaque étape : quelles sorties entrent réellement dans Monero, et où les bitcoins sont-ils ressortis ? Le magistrat attend aussi votre appréciation de la force probante de chaque rapprochement.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Message d\'extorsion', date: tPay - Math.round(r.float(30, 70) * HOUR), author: `@${handle}`,
          body:
            `Nous avons copié l'intégralité de vos dossiers. Une partie est jointe à titre de preuve.\n` +
            `Pour éviter leur publication et le signalement à vos clients : ${btc(P)} à envoyer sur\n${A(w, R)}\n` +
            `Vous avez 72 heures. Aucune négociation.`,
        },
        {
          id: 'pv', type: 'pv', title: `Procès-verbal d'audition — ${director.name}, direction de « ${victimName} » (extrait)`, date: office(tPay + Math.round(r.float(1, 3) * DAY)), author: director.name,
          body: `« Nous avons payé pour protéger nos clients. Les bitcoins ont été achetés sur Coinhouse et envoyés le ${fmtDate(tPay)} ; référence de la transaction : ${ransomTx.hash}. Aucune donnée n'a été publiée depuis. »`,
        },
        {
          id: 'signalements', type: 'rapport', title: 'Rapprochement des signalements — même message, même adresse', date: office(tPay + Math.round(r.float(4, 9) * DAY)), author: 'Cellule cyber départementale',
          body:
            `Le message d'extorsion reçu par « ${victimName} » (même formulation, même adresse bitcoin) a été retrouvé dans des signalements de ${target1} (${city1}) et de ${target2} (${city2}). Aucune de ces structures n'a déposé plainte à ce jour ; l'une indique « avoir réglé pour en finir », l'autre n'a pas répondu.\n` +
            `Conséquence : l'adresse de la rançon a pu recevoir d'autres paiements que celui de la plaignante, avant comme après. Chaque paiement identifié est une victime potentielle à rechercher (par le prestataire qui lui a vendu les bitcoins).`,
        },
        {
          id: 'cles', type: 'extraction', title: 'Exploitation de l\'ordinateur — fichier « cles.txt » et portefeuille en lecture seule', date: tArrest + Math.round(r.float(3, 9) * DAY), author: 'Cellule d\'appui numérique',
          body:
            `Fichier « cles.txt » : adresse principale Monero ${primary}… (95 caractères), clé de vue privée ${vk}.\n\n` +
            `Sur un poste dédié, un portefeuille en lecture seule a été créé à partir de l'adresse principale et de la clé de vue (aucune clé de dépense). Il fait apparaître trois réceptions :\n` +
            `- ${fmtDate(tX0)} : + ${xmr(xmr0)}\n` +
            `- ${fmtDate(tXa)} : + ${xmr(xmrA)}\n` +
            `- ${fmtDate(tXb)} : + ${xmr(xmrB)}\n\n` +
            `Solde affiché par le portefeuille en lecture seule : ${xmr(r8(xmr0 + xmrA + xmrB))}. Les dépenses ne sont pas détectables sans les « images de clé » (key images), calculables seulement avec la clé de dépense : ce solde est donc un maximum.`,
        },
        {
          id: 'note', type: 'extraction', title: 'Exploitation de l\'ordinateur — application de notes', date: tArrest + Math.round(r.float(3, 9) * DAY), author: 'Cellule d\'appui numérique',
          body:
            `Note modifiée le ${fmtDate(tExit - Math.round(r.float(30, 70) * HOUR))} :\n` +
            `« ${weekday(tExit)} : ressortir ~${quotedTxt} en BTC (plateforme habituelle), adresse neuve, appli habituelle »\n` +
            `« le reste : on laisse dormir en XMR »\n` +
            `« ne plus jamais toucher à l'adresse du message »`,
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche technique — clés Monero et swaps atomiques', date: office(tArrest - 90 * DAY), author: 'Groupe d\'appui crypto-actifs',
          body:
            `- La clé de vue privée permet de reconnaître les sorties reçues par un portefeuille (montants, dates) ; elle ne permet pas de dépenser.\n` +
            `- Les dépenses d'un portefeuille ne se détectent qu'avec la clé de dépense (images de clé) ou le fichier de portefeuille déchiffré.\n` +
            `- Les montants, émetteurs et destinataires restent masqués pour tout observateur extérieur : on ne trace pas « à travers » Monero, on rapproche ses bords.\n` +
            `- Swap atomique BTC → XMR : le vendeur de BTC verrouille ses fonds dans un script P2WSH ; la contrepartie envoie les XMR, puis réclame le verrou en révélant un secret. Côté Bitcoin, on voit une sortie script dépensée en une seule transaction vers une adresse tierce, peu de temps après. Un canal Lightning, lui, reste ouvert des jours et se ferme en rendant une part à chacun ; un coffre multisignature dort.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o13', type: 'number', points: 8, tolerance: 0, unit: 'paiements',
          prompt: 'Combien de paiements de tiers l\'adresse figurant dans le message d\'extorsion a-t-elle reçus au total (hors poussière de 546 sats et hors rendus de ses propres transactions) ?',
          answer: nPayments,
          hint: 'Ouvrez l\'historique complet de l\'adresse, avant et après la rançon. Écartez les entrées de 0,00000546 BTC et les sorties qui reviennent à l\'adresse elle-même dans ses propres dépenses.',
          explanation: `${nPayments} paiements : ${rIncoming.map((t) => `${btc(receivedIn(w, t, R))} le ${fmtDate(t.time, false)}`).join(', ')}. Celui de ${btc(P)} est la rançon de « ${victimName} » ; ${priorTxt} ${priorVictims.txs.length > 1 ? 'ont été vidés' : 'a été vidé'} vers ChangeNOW le ${fmtDate(earlyTx.time, false)} ; ${lateVictims.txs.length} paiement tardif est arrivé après le départ des fonds et dort toujours sur l'adresse (solde actuel ${btc(rLeft)}, poussière comprise). Les ${rDust.length} entrées de 546 sats sont de la poussière envoyée par des tiers, et les sorties des branches qui reviennent à l'adresse sont des rendus : ni les unes ni les autres ne sont des paiements. Chaque paiement est une victime potentielle à identifier, ce qui rejoint les signalements.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Après la rançon, l\'adresse du message émet plusieurs sorties. Par quel service la première partie de la rançon entre-t-elle dans Monero ?',
          answer: ['changenow'],
          hint: 'Listez les sorties de l\'adresse après le paiement de la plaignante : la plupart vont vers des adresses neuves non attribuées ; une seule va vers une adresse de dépôt balayée vers un portefeuille chaud attribué. Rapprochez ensuite son heure des réceptions de la clé de vue.',
          explanation: `Dans les heures qui suivent la rançon, ${branches.length} branches partent vers des adresses neuves (${btc(branchTotal)} au total) : ${branchLines}. Aucune n'atteint un service d'échange ni ne correspond à une réception XMR : ce sont des branches sans issue. Le ${fmtDate(tE1)}, en revanche, ${btc(Aval)} partent sur une adresse de dépôt ChangeNOW, balayée vers son portefeuille chaud, et ${xmr(xmrA)} arrivent ${Math.round((tXa - tE1) / 60)} min plus tard dans le portefeuille dont la clé de vue a été saisie. Deux autres clients déposent un montant voisin chez ChangeNOW dans la même heure, depuis des portefeuilles sans lien avec l'adresse de la rançon : seul le dépôt issu de l'adresse de la rançon compte. ${procedureFor(cnE)}`,
        },
        {
          id: 'o14', type: 'tx', points: 12,
          prompt: `Le rendu de ce dépôt est dépensé plus tard : ${twinWindow}, trois transactions de ≈ ${btc(Bval)} partent de cette adresse de rendu. Laquelle verrouille les fonds du swap atomique ?`,
          answer: [lockTx.id],
          hint: 'Les trois ont une sortie de type script (P2WSH). Pour chacune, suivez cette sortie : est-elle dépensée, quand, vers combien d\'adresses ? Rapprochez ensuite de la dernière réception de la clé de vue.',
          explanation: `${lockTx.hash.slice(0, 14)}… verrouille ${btc(Bval)} : la sortie script est dépensée ${lockMin} min plus tard, en une seule transaction, vers une adresse tierce, et ${xmr(xmrB)} arrivent ${redeemToXmr} min après dans le portefeuille Monero du suspect. Les deux jumelles sont alimentées par des apports extérieurs reçus juste avant, ce qui les sépare déjà des fonds de la rançon. ${channel.tx.hash.slice(0, 14)}… (${btc(tw1V)}) ouvre un canal Lightning avec ${lumen.name} : il reste ouvert ${Math.round((tClose - channel.tx.time) / DAY)} jours, puis une fermeture coopérative rend ${chanBack ? btc(chanBack.value) : 'une part'} au suspect et le reste au nœud du fournisseur. ${vaultTx.hash.slice(0, 14)}… (${btc(tw2V)}) alimente un coffre multisignature 2-de-3 jamais dépensé. Un swap se dénoue en moins de deux heures, en une seule transaction vers la contrepartie ; ni un canal ni un coffre ne se comportent ainsi.`,
        },
        {
          id: 'o2', type: 'choice', points: 10,
          prompt: 'Pourquoi cette sortie script, dépensée moins de deux heures plus tard vers une adresse unique, désigne-t-elle une entrée dans Monero ?',
          ...choiceO2,
          hint: 'L\'outil détecte une structure, pas une intention. Regardez à qui va la totalité des fonds, ce que devient cette adresse, et ce qu\'enregistre la clé de vue peu après.',
          explanation: `${lockTx.hash.slice(0, 12)}… verrouille ${btc(Bval)} dans un script P2WSH ; ${lockMin} min plus tard, la totalité est réclamée vers une seule adresse, qui regroupe ensuite ces fonds avec d'autres et les dépose chez ${mk.entity.name} : c'est la contrepartie, pas le suspect. Un canal refermé en moins de deux heures avec tout le solde chez le pair n'a pas de sens (le vrai canal du suspect, lui, est resté ouvert des jours) ; un coffre personnel aurait été vidé vers le suspect. En revanche, ${xmr(xmrB)} arrivent dans le portefeuille du suspect ${redeemToXmr} min après la réclamation. C'est la signature d'un swap atomique BTC → XMR : pas de service à requérir, une contrepartie pseudonyme.`,
        },
        {
          id: 'o9', type: 'tx', points: 8,
          prompt: 'Quelle transaction dépense la sortie script du swap atomique du suspect ?',
          answer: [redeemTx.id],
          hint: 'Ouvrez la transaction de verrouillage retenue et suivez la dépense de la sortie script (et non celle du rendu). Attention : l\'adresse qui réclame reçoit aussi d\'autres verrous.',
          explanation: `${redeemTx.hash.slice(0, 16)}… dépense le verrou ${lockMin} min après sa création et verse ${btc(r8(Bval - redeemFee))} à ${A(w, makerAddr)}, sans rendu vers le suspect : c'est la réclamation (« redeem ») par la partie qui a révélé le secret, la contrepartie. Cette adresse réclame ${makerClaims} verrous en tout avant de les regrouper, dont un d'un autre utilisateur verrouillé dans la même heure pour un montant voisin : c'est un teneur de marché qui réutilise son adresse. Seule la transaction qui dépense la sortie script créée par le suspect est la bonne ; les autres réclamations concernent d'autres swaps.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 2, unit: 'minutes',
          prompt: 'Combien de minutes séparent cette réclamation de la réception XMR correspondante enregistrée par la clé de vue ?',
          answer: redeemToXmr,
          hint: 'Comparez l\'horodatage de la réclamation avec la ligne du portefeuille en lecture seule (pièce « cles.txt ») qui la suit.',
          explanation: `Réclamation le ${fmtDate(redeemTx.time)}, réception de ${xmr(xmrB)} le ${fmtDate(tXb)} : ${redeemToXmr} minutes, le temps de quelques confirmations Monero. Dans un swap atomique, la contrepartie envoie les XMR, puis réclame les BTC avec le secret ; les deux opérations se répondent à quelques dizaines de minutes près. Ce rapprochement temporel, joint au montant (${btc(Bval)} ≈ ${xmr(xmrB)} au cours, moins la marge), établit la seconde entrée de la rançon dans le portefeuille du suspect. La première ligne de « cles.txt » (${fmtDate(tX0, false)}) correspond à une entrée plus ancienne, antérieure à la rançon.`,
        },
        {
          id: 'o11', type: 'entity', points: 6,
          prompt: 'Vers quelle plateforme les bitcoins réclamés par la contrepartie finissent-ils par être déposés ?',
          answer: [mk.entity.id],
          hint: 'Suivez l\'adresse qui a réclamé le verrou : elle est dépensée avec une autre adresse vers une adresse de dépôt, balayée vers un portefeuille chaud attribué.',
          explanation: `${A(w, makerAddr)} est dépensée avec une autre adresse (${A(w, makerOther).slice(0, 14)}…) vers une adresse de dépôt ${mk.entity.name} le ${fmtDate(makerTx.time)}. Ces bitcoins appartiennent désormais à la contrepartie du swap, qui a payé en XMR : les requérir chez ${mk.entity.name} identifierait un teneur de marché, pas le suspect. C'est une piste à documenter (et à écarter) dans le rapport, pour montrer pourquoi la traçabilité « naïve » des BTC mène à un tiers.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Combien de BTC issus de la rançon ont été convertis en Monero (toutes voies confondues) ?',
          answer: entered,
          hint: 'Additionnez le dépôt chez l\'échangeur et le montant verrouillé dans le swap atomique. Ni les branches, ni le canal, ni le coffre, ni le vidage antérieur à la rançon n\'en font partie.',
          explanation: `${btc(Aval)} via ChangeNOW et ${btc(Bval)} via le swap atomique, soit ${btc(entered)} (≈ ${Math.round(usd('BTC', entered)).toLocaleString('fr-FR')} $). Les branches (${btc(branchTotal)}) sont restées en bitcoin ; le canal Lightning et le coffre ont été financés par des apports extérieurs ; le dépôt ChangeNOW du ${fmtDate(earlyTx.time, false)} (${btc(earlyValue)}) précède la rançon et provient d'autres victimes. Le reliquat de la rançon (${btc(reliquat)}) est resté sur ${A(w, R3)}.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Sur quelle adresse est resté le reliquat BTC de la rançon qui n\'a pas été converti en Monero ?',
          answer: [R3],
          hint: 'Suivez le rendu de la transaction de verrouillage du swap (et non celui des deux transactions jumelles, qui revient à l\'adresse émettrice).',
          explanation: `${A(w, R3)} reçoit le rendu de la transaction de verrouillage (${btc(reliquat)}) et n'est plus dépensée. Les deux jumelles rendent leur monnaie à l'adresse émettrice elle-même, alimentée par des apports extérieurs : ce n'est pas l'argent de la rançon. Ces bitcoins n'ont jamais quitté Bitcoin : leur clé se trouve vraisemblablement sur les supports du suspect, ce qui en fait une cible de saisie directe, selon le cadre procédural applicable, indépendante de toute coopération d'un prestataire.`,
        },
        {
          id: 'o4', type: 'address', points: 14,
          prompt: 'Quelle adresse BTC est le candidat de sortie le plus probable ?',
          answer: [X1],
          hint: `Corrélateur sans filtre d'émetteur : chaîne Bitcoin, début à 0 h le jour indiqué dans la note, fenêtre 24 h, montant ≈ ${quotedTxt} BTC, tolérance d'environ 3 %. Puis, pour chaque candidat, ouvrez sa dépense suivante : empreinte du logiciel, et devenir du rendu.`,
          explanation: `${A(w, X1)} reçoit ${btc(E)} le ${fmtDate(tExit)}, le jour annoncé, pour un montant compatible avec « ~${quotedTxt} » (écart ${pct(exitHit)}). ${sameDay.length} autres paiements du même jour ont des montants voisins, dont un versé par la même plateforme ${Math.round(Math.abs(hourDecoy.tx.time - tExit) / 60)} min plus ${hourDecoy.tx.time > tExit ? 'tard' : 'tôt'} (${btc(hourDecoyV)}) ; un autre, très proche, tombe le ${fmtDate(offDay.tx.time, false)}, hors du jour annoncé. Ce qui départage : la dépense suivante de ${A(w, X1)} porte la même empreinte de logiciel (version, nLockTime, RBF) que les transactions du suspect avant Monero (« appli habituelle »), ce qui n'est le cas d'aucun autre candidat ; et son rendu ${A(w, X2).slice(0, 14)}… est réutilisé ensuite pour des dépenses personnelles et un nouveau retrait de la même plateforme. Rattachement probable, non certain.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Quelle plateforme a versé ces bitcoins de sortie, et doit donc être requise ?',
          answer: ['huobex'],
          hint: 'Ouvrez la transaction qui crédite votre candidat de sortie : de quel portefeuille chaud attribué part-elle ?',
          explanation: `Le paiement vers ${A(w, X1)} part du portefeuille chaud de ${hx.entity.name} (« plateforme habituelle ») ; le même portefeuille chaud verse encore ${btc(reuseValue)} le ${fmtDate(reuseTx.time, false)} sur le rendu ${A(w, X2).slice(0, 14)}… : le suspect y a vraisemblablement déposé des XMR et retiré des BTC, à plusieurs reprises. La réquisition vise le ou les comptes qui ont ordonné ces retraits (hash des transactions, adresses de destination) : identité, IP, historique des dépôts XMR. ${procedureFor(hx.entity)} Attention : ${hx.entity.name} pratique un KYC allégé et répond irrégulièrement ; prévoir des actes complémentaires.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant (en BTC) est ressorti de Monero sur ce candidat ?',
          answer: E,
          hint: 'Lisez la sortie de la transaction de retrait vers votre candidat, au satoshi près (la note ne donne qu\'un arrondi).',
          explanation: `${btc(E)}, soit ${Math.round((E / entered) * 100)} % de ce qui était entré avec la rançon. Le reste a pu être conservé en XMR (« on laisse dormir ») : le solde du portefeuille en lecture seule n'est qu'un maximum, faute de voir les dépenses. Une partie a ensuite été dépensée chez ${vouchio.name} (${btc(cardValue)}, cartes cadeaux), le rendu restant au suspect.`,
        },
        {
          id: 'o7', type: 'choice', points: 12,
          prompt: 'Que peut-on honnêtement conclure de cette analyse ?',
          ...choiceO7,
          hint: 'Distinguez ce qui est constaté (flux on-chain, réceptions visibles avec la clé de vue) de ce qui est déduit (date, montant, empreinte, comportement ultérieur).',
          explanation: `Les deux entrées de la rançon sont solidement établies : flux on-chain depuis l'adresse de la rançon, et réceptions XMR correspondantes visibles avec la clé de vue saisie. La sortie repose sur un faisceau : date annoncée dans la note, montant compatible, empreinte du logiciel, réutilisation du rendu avec un second retrait de la même plateforme. Chacun de ces indices est faible isolément (une empreinte est partagée par de nombreux utilisateurs, un candidat de la même plateforme tombe dans la même heure) ; ensemble, ils désignent un candidat probable, à confirmer par la réponse de la plateforme de sortie (compte, IP, dépôts XMR) et par l'exploitation des supports (fichier de portefeuille déchiffré, qui révélerait les dépenses). La clé de vue ne montre pas les sorties d'un portefeuille Monero.`,
        },
      ],
      truth: {
        path: [ransomTx.id, entryTx.id, cnSweep.id, lockTx.id, redeemTx.id, exitTx.id, spendX.id],
        addresses: [R, R2, R3, cnDep, lock, X1, X2, makerAddr, K, ...branches.map((b) => b.address)],
        debrief:
          `1. L'adresse ${A(w, R)} sert à plusieurs extorsions : ${priorTxt}, ${priorVictims.txs.length > 1 ? 'vidés' : 'vidé'} vers ChangeNOW le ${fmtDate(earlyTx.time, false)} (${btc(earlyValue)}, ${xmr(xmr0)} reçus dans le portefeuille du suspect), puis la rançon de « ${victimName} » (${btc(P)}, le ${fmtDate(tPay)}), puis un paiement tardif qui y dort encore. Poussière et rendus internes ne sont pas des paiements.\n` +
          `2. Éclatement : ${branches.length} branches sans issue (${btc(branchTotal)}) partent vers des adresses neuves du suspect ; aucune n'atteint un service d'échange ni ne correspond à une réception XMR.\n` +
          `3. Entrée n° 1 : ${btc(Aval)} déposés chez ChangeNOW (commande BTC → XMR) ; ${xmr(xmrA)} arrivent ${Math.round((tXa - tE1) / 60)} min plus tard. Deux dépôts de montant voisin dans la même heure viennent d'autres clients.\n` +
          `4. Entrée n° 2 : depuis le rendu ${A(w, R2)}, trois transactions de ≈ ${btc(Bval)} partent dans la même heure. Le canal Lightning (fermé ${Math.round((tClose - channel.tx.time) / DAY)} jours plus tard) et le coffre 2-de-3 (jamais dépensé) sont financés par des apports extérieurs ; le verrou ${lockTx.hash.slice(0, 12)}… est réclamé ${lockMin} min plus tard par la contrepartie d'un swap atomique, et ${xmr(xmrB)} arrivent ${redeemToXmr} min après. La contrepartie, teneur de marché qui réclame aussi d'autres verrous, dépose chez ${mk.entity.name} : fausse piste. Le reliquat (${btc(reliquat)}) reste sur ${A(w, R3)}.\n` +
          `5. Le ${fmtDate(tExit)}, conformément à la note, ${hx.entity.name} verse ${btc(E)} sur ${A(w, X1)}, parmi ${sameDay.length} autres paiements voisins du même jour (dont un de ${hx.entity.name} dans l'heure). Seule ${A(w, X1).slice(0, 14)}… est dépensée par le logiciel habituel du suspect : achat de cartes cadeaux chez ${vouchio.name} (${btc(cardValue)}), rendu sur ${A(w, X2)}, réutilisé ensuite (${spending.txs.length} paiements, à ${spendList}, et un nouveau retrait ${hx.entity.name} de ${btc(reuseValue)}). Les commerçants payés sont des pistes secondaires de réquisition (comptes, adresses électroniques, adresses IP).\n` +
          `6. Mesures : saisie des bitcoins dont les clés sont sur les supports (reliquat, rendu de la sortie${branches.some((b) => b.fate === 'dort') ? ', branches dormantes' : ''}), gel et réquisition chez ${hx.entity.name}, réquisition ChangeNOW (commandes liées aux dépôts). ChangeNOW ne détient pas les adresses du suspect ; Monero n'a pas d'opérateur capable de bloquer des fonds ; la contrepartie du swap a acquis les BTC en échange de ses XMR.\n\n` +
          `À retenir : face à Monero, on rapproche les bords, et chaque bord se trie. Une adresse d'extorsion réutilisée mélange plusieurs victimes ; un éclatement crée des branches mortes ; des transferts jumeaux imitent le verrou d'un swap ; des swaps d'autres utilisateurs et des dépôts d'autres clients tombent dans la même heure. Ce qui départage, c'est le devenir de chaque sortie (dépensée vite vers un tiers, fermée après des jours, dormante), sa concordance avec la clé de vue, et le comportement du portefeuille (empreinte, réutilisation du rendu). La force de chaque rapprochement doit être exposée telle quelle dans la procédure.`,
      },
      hints: [
        'Partez de l\'adresse du message d\'extorsion et lisez tout son historique : plusieurs victimes, de la poussière, des branches, et une seule sortie vers un service.',
        'Côté rendu, trois sorties de même montant partent dans la même heure : suivez chaque sortie script jusqu\'à sa dépense (ou son absence de dépense).',
        'Rapprochez chaque entrée candidate des trois lignes du portefeuille en lecture seule : la première est antérieure à la rançon.',
        'Pour la sortie, ne partez pas des entrées : utilisez la date de la note, une fenêtre de 24 h et une tolérance de quelques %.',
        'Plusieurs candidats ont un montant compatible : comparez l\'empreinte (version, nLockTime, RBF) de leur dépense suivante avec celle des premières transactions du suspect, puis regardez ce que devient le rendu.',
      ],
    }
  },
}
