import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd, fromUsd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const xmr = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} XMR`

/** Début du jour calendaire (heure de Paris) contenant `ts`. */
function parisDayStart(ts: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0)
  return ts - (g('hour') * 3600 + g('minute') * 60 + g('second'))
}
const weekday = (ts: number) => new Date(ts * 1000).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })

const VICTIMS = ['Clinique du Parc', 'Centre d\'imagerie Saint-Roch', 'Cabinet d\'expertise comptable Morel & Associés', 'Laboratoire d\'analyses Pasteur-Est', 'Étude notariale Girard']

export const btcMoneroAtomic: ScenarioTemplate = {
  id: 'monero-atomic',
  title: 'Au-delà du mur Monero',
  tagline: 'Deux portes d\'entrée, une clé de vue, une sortie à dater : travailler les bords d\'un passage par Monero.',
  description:
    'La rançon d\'une extorsion après vol de données part en Monero par deux voies différentes, dont l\'une ressemble, pour l\'outil, à un canal Lightning. Quelques jours plus tard, des bitcoins ressortent d\'une plateforme. Avec la clé de vue retrouvée chez le suspect, une note et la corrélation montant / temps, identifiez les points d\'entrée et de sortie, la plateforme à requérir, et mesurez honnêtement la force du rattachement.',
  difficulty: 4,
  chains: ['btc', 'xmr'],
  skills: ['privacy', 'crosschain', 'exchange_id', 'requisition', 'osint'],
  estMinutes: 85,
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

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const cv = exchange(w, 'coinhouse', 'btc')
    const cnE = w.entity('changenow')
    const cnDep = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    const cnHot = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Hot Wallet BTC', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const hx = exchange(w, 'huobex', 'btc')
    const others = r.shuffle(['binance', 'kraken', 'okx', 'bitstamp', 'coinbase'] as const)
    const dx = exchange(w, others[0], 'btc')
    const mk = exchange(w, others[1], 'btc')
    const cardhub = w.entity('cardhub')
    const suspect = w.customEntity({ name: `${sp.name} (@${handle}, mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const makerE = w.customEntity({ name: 'Contrepartie de swap atomique (non identifiée)', category: 'individual' })

    const fpKey = (id: string) => {
      const p = w.walletProfile(id)
      return `${p.version}|${p.locktime}|${p.rbf}`
    }

    // ── Rançon ───────────────────────────────────────────────────────────────
    const R = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
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

    // ── Entrée 1 : échangeur instantané (BTC → XMR) ──────────────────────────
    const tE1 = tPay + Math.round(r.float(3, 20) * HOUR)
    const Aval = roundCoin(w, P * 0.5, P * 0.65, 0.001)
    const R2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const entryTx = w.utxoTx({ time: tE1, from: [R], to: [{ address: cnDep, value: Aval }], change: R2, spendAll: true })
    const cnSweep = forwardAll(w, cnDep, cnHot, tE1 + r.int(10, 40) * 60, undefined, ['sweep'])
    const xmrA = roundAsset('XMR', fromUsd('XMR', usd('BTC', Aval) * (1 - r.float(0.006, 0.015))))
    const tXa = tE1 + r.int(15, 45) * 60

    // ── Entrée 2 : swap atomique (verrou P2WSH 2-de-2, réclamé par la contrepartie) ──
    const tLock = tE1 + Math.round(r.float(20, 60) * HOUR)
    const lock = w.addr('btc', { kind: 'p2wsh', wallet: `swap:${R2}` })
    const R3 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const Bval = Math.floor(w.unspentValue(R2, tLock) * r.float(0.85, 0.93) * 1000) / 1000
    const lockTx = w.utxoTx({ time: tLock, from: [R2], to: [{ address: lock, value: Bval }], change: R3, spendAll: true })
    const makerAddr = w.addr('btc', { entity: makerE, kind: 'p2wpkh' })
    const redeemFee = w.estimateFee('btc', 1, 1)
    const redeemTx = w.rawUtxoTx({ time: tLock + r.int(25, 70) * 60, spend: [{ address: lock }], outputs: [{ address: makerAddr, value: r8(Bval - redeemFee) }] })
    redeemTx.fp = { version: 2, locktime: 0, rbf: false }
    const xmrB = roundAsset('XMR', fromUsd('XMR', usd('BTC', Bval) * (1 - r.float(0.008, 0.02))))
    const tXb = redeemTx.time + r.int(20, 50) * 60
    // La contrepartie (teneur de marché) regroupe et dépose chez un exchange : fausse piste
    const makerOther = w.addr('btc', { entity: makerE, kind: 'p2wpkh' })
    w.fund(makerOther, roundCoin(w, 0.2, 1.5, 0.001), redeemTx.time - Math.round(r.float(2, 30) * HOUR))
    const makerDep = mk.newDeposit()
    const tMk = redeemTx.time + Math.round(r.float(18, 60) * HOUR)
    const makerIn = w.unspentValue(makerAddr, tMk) + w.unspentValue(makerOther, tMk)
    const makerFee = w.estimateFee('btc', 2, 1)
    const makerTx = w.utxoTx({ time: tMk, from: [makerAddr, makerOther], to: [{ address: makerDep, value: r8(makerIn - makerFee) }], fee: makerFee, change: null, spendAll: true })
    mk.sweep([makerDep], tMk + Math.round(r.float(1, 6) * HOUR))

    // ── Sortie : XMR → BTC sur une plateforme, jour annoncé dans une note ────
    const tExit0 = tLock + Math.round(r.float(3, 8) * DAY)
    const day0 = parisDayStart(tExit0)
    const tExit = day0 + Math.round(r.float(9, 18) * HOUR)
    const E = Math.round((Aval + Bval) * r.float(0.6, 0.82) * 1e5) / 1e5
    const quoted = Math.round(E * 100) / 100
    const quotedTxt = quoted.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
    const X1 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const exitTx = hx.withdraw(X1, E, tExit)
    // Leurres : montants voisins le même jour (et un très proche la veille ou le lendemain)
    const sgn = () => (r.chance(0.5) ? 1 : -1)
    const decoys: { addr: string; tx: Tx }[] = []
    const dec = (pay: (to: string, v: number, t: number) => Tx, v: number, t: number) => {
      const a = unlike(w.addr('btc'))
      decoys.push({ addr: a, tx: pay(a, Math.round(v * 1e5) / 1e5, Math.round(t)) })
    }
    dec((to, v, t) => hx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.015, 0.03)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => dx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.001, 0.004)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => w.utxoTx({ time: t, from: [cnHot], to: [{ address: to, value: v }], change: cnHot, tags: ['payout'] }), E * (1 + sgn() * r.float(0.008, 0.02)), day0 + r.float(1, 23) * HOUR)
    dec((to, v, t) => hx.withdraw(to, v, t), E * (1 + sgn() * r.float(0.001, 0.003)), r.chance(0.5) ? day0 - r.float(2, 20) * HOUR : day0 + r.float(26, 44) * HOUR)
    // Comportement ultérieur : la sortie du suspect est dépensée par son logiciel habituel
    const X2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const invoice = w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
    const spendX = w.utxoTx({ time: tExit + Math.round(r.float(20, 60) * HOUR), from: [X1], to: [{ address: invoice, value: roundCoin(w, 0.01, 0.04, 0.0001) }], change: X2 })
    decoys.forEach((d, i) => {
      if (i === 3) return
      w.utxoTx({ time: d.tx.time + Math.round(r.float(5, 50) * HOUR), from: [d.addr], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(d.addr) * r.float(0.3, 0.7)) }] })
    })

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (let i = 0; i < r.int(5, 8); i++) {
      const c = w.addr('btc')
      const d = w.addr('btc', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
      const t = tE1 + r.float(-2, 9) * DAY
      w.fund(c, roundCoin(w, 0.01, 0.9, 0.0001), t - r.int(2, 30) * HOUR)
      forwardAll(w, c, d, Math.round(t))
      forwardAll(w, d, cnHot, Math.round(t) + r.int(10, 60) * 60, undefined, ['sweep'])
    }
    for (let i = 0; i < r.int(6, 10); i++) w.utxoTx({ time: Math.round(tE1 + r.float(-2, 9) * DAY), from: [cnHot], to: [{ address: w.addr('btc'), value: roundCoin(w, 0.005, 0.6, 0.00001) }], change: cnHot, tags: ['payout'] })
    hx.noise(14, day0 - 3 * DAY, day0 + 3 * DAY)
    dx.noise(10, day0 - 3 * DAY, day0 + 3 * DAY)
    mk.noise(8, tMk - 2 * DAY, tMk + 2 * DAY)
    cv.noise(6, tPay - 5 * DAY, tPay + 2 * DAY)

    // ── Valeurs pour les textes ──────────────────────────────────────────────
    const entered = r8(Aval + Bval)
    const tArrest = tExit + Math.round(r.float(5, 15) * DAY)
    let vk = ''
    for (let i = 0; i < 64; i++) vk += '0123456789abcdef'[r.int(0, 15)]
    const primary = `4${r.pick(['A', 'B', '8', '9'])}${Array.from({ length: 6 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[r.int(0, 57)]).join('')}`
    const exitHit = Math.abs(quoted - E) / E
    const nDecoysSameDay = 3

    return {
      world: w,
      title: `Extorsion et Monero — ${victimName} (${city})`,
      briefing:
        `La structure « ${victimName} » (${city}) a été victime d'une intrusion informatique : des données sensibles ont été copiées, puis l'auteur a exigé ${btc(P)} pour ne pas les publier. Sur décision de sa direction, la structure a payé depuis un compte Coinhouse.\n\n` +
        `Les investigations techniques ont conduit à ${sp.name} (@${handle}), ${ge('interpellé', 'interpellée')} à son domicile. Son ordinateur a été exploité : un portefeuille Monero chiffré (mot de passe inconnu), un fichier texte contenant la clé de vue privée de ce portefeuille, et une note. ${ge('Il', 'Elle')} conteste toute implication.\n\n` +
        `La rançon a quitté Bitcoin pour Monero, où l'on ne suit pas les fonds. Travaillez les bords : comment les bitcoins sont-ils entrés dans Monero, et où sont-ils ressortis ? Le magistrat attend aussi votre appréciation de la force probante de chaque rapprochement.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Message d\'extorsion', date: tPay - Math.round(r.float(30, 70) * HOUR), author: `@${handle}`,
          body:
            `Nous avons copié l'intégralité de vos dossiers. Une partie est jointe à titre de preuve.\n` +
            `Pour éviter leur publication et le signalement à vos clients : ${btc(P)} à envoyer sur\n${A(w, R)}\n` +
            `Vous avez 72 heures. Aucune négociation.`,
        },
        {
          id: 'pv', type: 'pv', title: `Procès-verbal d'audition — ${director.name}, direction de « ${victimName} » (extrait)`, date: tPay + Math.round(r.float(1, 3) * DAY), author: director.name,
          body: `« Nous avons payé pour protéger nos clients. Les bitcoins ont été achetés sur Coinhouse et envoyés le ${fmtDate(tPay)} ; référence de la transaction : ${ransomTx.hash}. Aucune donnée n'a été publiée depuis. »`,
        },
        {
          id: 'cles', type: 'extraction', title: 'Exploitation de l\'ordinateur — fichier « cles.txt » et portefeuille en lecture seule', date: tArrest + Math.round(r.float(3, 9) * DAY), author: 'Cellule d\'appui numérique',
          body:
            `Fichier « cles.txt » : adresse principale Monero ${primary}… (95 caractères), clé de vue privée ${vk}.\n\n` +
            `Sur un poste dédié, un portefeuille en lecture seule a été créé à partir de l'adresse principale et de la clé de vue (aucune clé de dépense). Il fait apparaître deux réceptions :\n` +
            `- ${fmtDate(tXa)} : + ${xmr(xmrA)}\n` +
            `- ${fmtDate(tXb)} : + ${xmr(xmrB)}\n\n` +
            `Solde affiché par le portefeuille en lecture seule : ${xmr(r8(xmrA + xmrB))}. Les dépenses ne sont pas détectables sans les « images de clé » (key images), calculables seulement avec la clé de dépense : ce solde est donc un maximum.`,
        },
        {
          id: 'note', type: 'extraction', title: 'Exploitation de l\'ordinateur — application de notes', date: tArrest + Math.round(r.float(3, 9) * DAY), author: 'Cellule d\'appui numérique',
          body:
            `Note modifiée le ${fmtDate(tExit - Math.round(r.float(30, 70) * HOUR))} :\n` +
            `« ${weekday(tExit)} : ressortir ~${quotedTxt} en BTC (plateforme habituelle), adresse neuve, appli habituelle »\n` +
            `« le reste : on laisse dormir en XMR »`,
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche technique — clés Monero', date: tArrest - 90 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- La clé de vue privée permet de reconnaître les sorties reçues par un portefeuille (montants, dates) ; elle ne permet pas de dépenser.\n` +
            `- Les dépenses d'un portefeuille ne se détectent qu'avec la clé de dépense (images de clé) ou le fichier de portefeuille déchiffré.\n` +
            `- Les montants, émetteurs et destinataires restent masqués pour tout observateur extérieur : on ne trace pas « à travers » Monero, on rapproche ses bords.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Par quel service la première partie de la rançon est-elle entrée dans Monero ?',
          answer: ['changenow'],
          hint: 'Suivez la première dépense de l\'adresse de la rançon : la destination est une adresse de dépôt, balayée peu après vers un portefeuille chaud attribué.',
          explanation: `Le ${fmtDate(tE1)}, ${btc(Aval)} partent sur une adresse de dépôt ChangeNOW, balayée vers son portefeuille chaud. Aucun paiement BTC compatible ne suit : la commande a été payée en XMR. ${xmr(xmrA)} arrivent ${Math.round((tXa - tE1) / 60)} min plus tard dans le portefeuille dont la clé de vue a été saisie, ce qui relie cette entrée au suspect. ${procedureFor(cnE)}`,
        },
        {
          id: 'o2', type: 'choice', points: 12,
          prompt: 'Une autre partie des fonds part vers une sortie de type script (P2WSH), dépensée moins de deux heures plus tard vers une adresse unique. De quoi s\'agit-il le plus probablement ?',
          ...choice(r,
            'Un swap atomique : verrou 2-de-2 côté Bitcoin, réclamé par la contrepartie qui livre des XMR',
            [
              'Un canal Lightning ouvert puis refermé de façon coopérative après quelques paiements',
              'Un coffre multisignature personnel, vidé ensuite par le suspect vers sa propre adresse',
              'Un CoinJoin à deux participants, destiné à brouiller la piste des fonds de la rançon',
            ]),
          hint: 'L\'outil détecte une structure, pas une intention. Regardez à qui va la totalité des fonds, ce que devient cette adresse, et ce qu\'enregistre la clé de vue peu après.',
          explanation: `${lockTx.hash.slice(0, 12)}… verrouille ${btc(Bval)} dans un script P2WSH ; ${Math.round((redeemTx.time - lockTx.time) / 60)} min plus tard, la totalité est réclamée vers une seule adresse, qui regroupe ensuite ces fonds avec d'autres et les dépose chez ${mk.entity.name} : c'est la contrepartie, pas le suspect. Un canal refermé en moins de deux heures avec tout le solde chez le pair n'a pas de sens ; en revanche, ${xmr(xmrB)} arrivent dans le portefeuille du suspect ${Math.round((tXb - redeemTx.time) / 60)} min après la réclamation. C'est la signature d'un swap atomique BTC → XMR : pas de service à requérir, une contrepartie pseudonyme. Suivre ces bitcoins jusqu'à ${mk.entity.name} serait une fausse piste.`,
        },
        {
          id: 'o9', type: 'tx', points: 8,
          prompt: 'Quelle transaction dépense la sortie script (P2WSH) créée avec les fonds de la rançon ?',
          answer: [redeemTx.id],
          hint: 'Ouvrez la transaction qui crée la sortie script, puis suivez la dépense de cette sortie (et non celle du rendu).',
          explanation: `${redeemTx.hash.slice(0, 16)}… dépense le verrou ${Math.round((redeemTx.time - lockTx.time) / 60)} min après sa création et verse ${btc(r8(Bval - redeemFee))} à une adresse unique (${A(w, makerAddr)}), sans rendu vers le suspect. Une seule entrée (le verrou), une seule sortie : c'est la réclamation (« redeem ») par la partie qui a révélé le secret du swap, c'est-à-dire la contrepartie, après avoir livré ses XMR.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 2, unit: 'minutes',
          prompt: 'Combien de minutes séparent cette dépense de la seconde réception XMR enregistrée par la clé de vue ?',
          answer: Math.round((tXb - redeemTx.time) / 60),
          hint: 'Comparez l\'horodatage de la dépense de la sortie script avec la seconde ligne du portefeuille en lecture seule (pièce « cles.txt »).',
          explanation: `Dépense du verrou le ${fmtDate(redeemTx.time)}, réception de ${xmr(xmrB)} le ${fmtDate(tXb)} : ${Math.round((tXb - redeemTx.time) / 60)} minutes, le temps de quelques confirmations Monero. Dans un swap atomique, la contrepartie envoie les XMR, puis réclame les BTC avec le secret ; les deux opérations se répondent à quelques dizaines de minutes près. Ce rapprochement temporel, joint au montant (${btc(Bval)} ≈ ${xmr(xmrB)} au cours, moins la marge), établit la seconde entrée dans le portefeuille du suspect.`,
        },
        {
          id: 'o11', type: 'entity', points: 8,
          prompt: 'Vers quelle plateforme les bitcoins issus de cette sortie script finissent-ils par être déposés ?',
          answer: [mk.entity.id],
          hint: 'Suivez l\'adresse qui a reçu les fonds du verrou : elle est dépensée avec une autre adresse vers une adresse de dépôt, balayée vers un portefeuille chaud attribué.',
          explanation: `${A(w, makerAddr)} est dépensée avec une autre adresse (${A(w, makerOther).slice(0, 14)}…) vers une adresse de dépôt ${mk.entity.name} le ${fmtDate(makerTx.time)}. Ces bitcoins appartiennent désormais à la contrepartie du swap, qui a payé en XMR : les requérir chez ${mk.entity.name} identifierait un teneur de marché, pas le suspect. C'est une piste à documenter (et à écarter) dans le rapport, pour montrer pourquoi la traçabilité « naïve » des BTC mène à un tiers.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Combien de BTC au total ont été convertis en Monero (toutes voies confondues) ?',
          answer: entered,
          hint: 'Additionnez le dépôt chez l\'échangeur et le montant verrouillé dans le script.',
          explanation: `${btc(Aval)} via ChangeNOW et ${btc(Bval)} via le swap atomique, soit ${btc(entered)} (≈ ${Math.round(usd('BTC', entered)).toLocaleString('fr-FR')} $). Le reliquat (${btc(r8(w.unspentValue(R3)))}) est resté sur ${A(w, R3)}.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Sur quelle adresse est resté le reliquat BTC de la rançon qui n\'a pas été converti en Monero ?',
          answer: [R3],
          hint: 'Chaque dépense vers Monero a laissé un rendu au suspect ; suivez le rendu de la seconde.',
          explanation: `${A(w, R3)} reçoit le rendu de la transaction de verrouillage (${btc(r8(w.unspentValue(R3)))}) et n'est plus dépensée. Ces bitcoins n'ont jamais quitté Bitcoin : leur clé se trouve vraisemblablement sur les supports du suspect, ce qui en fait une cible de saisie directe, indépendante de toute coopération d'un prestataire.`,
        },
        {
          id: 'o4', type: 'address', points: 14,
          prompt: 'Quelle adresse BTC est le candidat de sortie le plus probable ?',
          answer: [X1],
          hint: `Corrélateur sans filtre d'émetteur : chaîne Bitcoin, début à 0 h le jour indiqué dans la note, fenêtre 24 h, montant ≈ ${quotedTxt} BTC, tolérance d'environ 3 %. Puis comparez l'empreinte de la dépense suivante de chaque candidat avec celle des transactions du suspect avant Monero.`,
          explanation: `${A(w, X1)} reçoit ${btc(E)} le ${fmtDate(tExit)}, le jour annoncé, pour un montant compatible avec « ~${quotedTxt} » (écart ${(exitHit * 100).toFixed(2).replace('.', ',')} %). ${nDecoysSameDay} autres paiements du même jour ont des montants voisins, et un quatrième, très proche, tombe un autre jour. Ce qui départage : la dépense suivante de ${A(w, X1)} porte la même empreinte de logiciel (version, nLockTime, RBF) que les transactions du suspect avant Monero (« appli habituelle »), ce qui n'est pas le cas des autres candidats. Rattachement probable, non certain.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Quelle plateforme a versé ces bitcoins de sortie, et doit donc être requise ?',
          answer: ['huobex'],
          hint: 'Ouvrez la transaction qui crédite votre candidat de sortie : de quel portefeuille chaud attribué part-elle ?',
          explanation: `Le paiement vers ${A(w, X1)} part du portefeuille chaud de ${hx.entity.name} (« plateforme habituelle ») : le suspect y a vraisemblablement déposé des XMR et retiré des BTC. La réquisition vise le compte qui a ordonné ce retrait (hash de la transaction, adresse de destination) : identité, IP, historique des dépôts XMR. ${procedureFor(hx.entity)} Attention : ${hx.entity.name} pratique un KYC allégé et répond irrégulièrement ; prévoir des actes complémentaires.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant (en BTC) est ressorti de Monero sur ce candidat ?',
          answer: E,
          hint: 'Lisez la sortie de la transaction de retrait vers votre candidat, au satoshi près (la note ne donne qu\'un arrondi).',
          explanation: `${btc(E)}, soit ${Math.round((E / entered) * 100)} % de ce qui était entré. Le reste a pu être conservé en XMR (« on laisse dormir ») : le solde du portefeuille en lecture seule n'est qu'un maximum, faute de voir les dépenses.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelles mesures conservatoires envisager sur les avoirs du suspect ?',
          ...choice(r,
            'Saisir les bitcoins dont les clés sont sur les supports (reliquat, rendu de la sortie) selon le cadre procédural applicable, et demander un gel à la plateforme de sortie',
            [
              'Demander à ChangeNOW de geler le reliquat resté sur l\'adresse du suspect',
              'Demander au réseau Monero de bloquer les XMR du portefeuille identifié par la clé de vue',
              'Requérir la contrepartie du swap atomique pour qu\'elle restitue les bitcoins réclamés',
            ]),
          hint: 'Qui contrôle réellement chacun des avoirs identifiés : le suspect, un prestataire, une contrepartie, ou personne ?',
          explanation: `Le reliquat (${A(w, R3).slice(0, 14)}…) et le rendu de la sortie (${A(w, X2).slice(0, 14)}…) sont des adresses du suspect : on les saisit en exploitant les clés présentes sur les supports, selon le cadre procédural applicable. Chez ${hx.entity.name}, plateforme de sortie, on demande le gel du compte et la préservation des données. ChangeNOW ne détient pas l'adresse du suspect ; Monero n'a pas d'opérateur capable de bloquer des fonds (seule la clé de dépense, si le mot de passe du portefeuille est obtenu, permettrait d'appréhender les XMR) ; la contrepartie du swap a acquis les BTC en échange de ses XMR.`,
        },
        {
          id: 'o7', type: 'choice', points: 14,
          prompt: 'Que peut-on honnêtement conclure de cette analyse ?',
          ...choice(r,
            'Entrées établies ; sortie rattachée par un faisceau (date, montant, empreinte), à corroborer par réquisition',
            [
              'Preuve certaine : la clé de vue permet de suivre les XMR jusqu\'à la plateforme de sortie',
              'Aucune conclusion possible : Monero interdit tout rapprochement entre l\'entrée et la sortie',
              'Preuve certaine : une empreinte de portefeuille identique désigne un seul et même utilisateur',
            ]),
          hint: 'Distinguez ce qui est constaté (flux on-chain, réceptions visibles avec la clé de vue) de ce qui est déduit (date, montant, empreinte).',
          explanation: `Les deux entrées sont solidement établies : flux on-chain depuis l'adresse de la rançon, et réceptions XMR correspondantes visibles avec la clé de vue saisie. La sortie, elle, repose sur un faisceau : date annoncée dans la note, montant compatible, empreinte du logiciel. Chacun de ces indices est faible isolément (une empreinte est partagée par de nombreux utilisateurs) ; ensemble, ils désignent un candidat probable, à confirmer par la réponse de la plateforme de sortie (compte, IP, dépôts XMR) et par l'exploitation des supports (fichier de portefeuille déchiffré, qui révélerait les dépenses). La clé de vue ne montre pas les sorties d'un portefeuille Monero.`,
        },
      ],
      truth: {
        path: [ransomTx.id, entryTx.id, cnSweep.id, lockTx.id, redeemTx.id, exitTx.id, spendX.id],
        addresses: [R, R2, R3, cnDep, lock, X1, X2],
        debrief:
          `1. « ${victimName} » paie ${btc(P)} sur ${A(w, R)} le ${fmtDate(tPay)}.\n` +
          `2. Entrée n° 1 : ${btc(Aval)} déposés chez ChangeNOW (commande BTC → XMR) ; ${xmr(xmrA)} arrivent dans le portefeuille Monero du suspect.\n` +
          `3. Entrée n° 2 : ${btc(Bval)} verrouillés dans un script 2-de-2 puis réclamés par la contrepartie d'un swap atomique ; ${xmr(xmrB)} arrivent dans le même portefeuille. Les bitcoins réclamés appartiennent désormais à la contrepartie, qui les dépose chez ${mk.entity.name} : fausse piste. La réclamation (${redeemTx.hash.slice(0, 12)}…) précède de ${Math.round((tXb - redeemTx.time) / 60)} min la réception XMR. Le reliquat non converti (${btc(r8(w.unspentValue(R3)))}) reste sur ${A(w, R3)}.\n` +
          `4. Le ${fmtDate(tExit)}, conformément à la note, ${hx.entity.name} verse ${btc(E)} sur ${A(w, X1)}, dépensée ensuite par le logiciel habituel du suspect (achat CardHub, rendu sur ${A(w, X2)}).\n\n` +
          `À retenir : face à Monero, on rapproche les bords. Côté entrée, la clé de vue saisie transforme une hypothèse en constat (les XMR sont bien arrivés chez le suspect). Côté sortie, on combine une fenêtre large (ici, une journée entière), une tolérance adaptée à l'arrondi de la source, et des indices de comportement (empreinte, type d'adresse, dépense suivante). Un swap atomique ressemble à un canal Lightning : la détection automatique est un point de départ, pas une conclusion. Enfin, la force de chaque rapprochement doit être exposée telle quelle dans la procédure.`,
      },
      hints: [
        'Partez de l\'adresse du message d\'extorsion : deux sorties successives mènent vers Monero, par deux voies différentes.',
        'La transaction signalée « Lightning » est-elle vraiment un canal ? Regardez la dépense de la sortie script et rapprochez les horaires des réceptions XMR de la clé de vue.',
        'Pour la sortie, ne partez pas des entrées : utilisez la date de la note, une fenêtre de 24 h et une tolérance de quelques %.',
        'Plusieurs candidats ont un montant compatible : comparez l\'empreinte (version, nLockTime, RBF) de leur dépense suivante avec celle des premières transactions du suspect.',
      ],
    }
  },
}
