import { World, type Tx } from '../engine/world'
import { exchange, person, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

/** Heure (0-23) à Paris d'un horodatage. */
function parisHour(ts: number): number {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(new Date(ts * 1000))
  return Number(p.find((x) => x.type === 'hour')!.value)
}
/** Repousse un horodatage nocturne à la première heure de journée (8 h - 21 h, heure de Paris). */
function daytime(ts: number): number {
  let t = ts
  while (parisHour(t) < 8 || parisHour(t) >= 21) t += 3600
  return t
}
/** Écart lisible : « 5 semaines », « 3 mois ». */
function spanTxt(sec: number): string {
  const d = sec / 86400
  if (d < 50) return `${Math.max(2, Math.round(d / 7))} semaines`
  return `${Math.round(d / 30)} mois`
}

/** Conversion indicative (récit uniquement) : les victimes raisonnent en euros. */
const EUR_PER_USD = 0.92
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const eur = (btc: number) => `${(Math.round((usd('BTC', btc) * EUR_PER_USD) / 10) * 10).toLocaleString('fr-FR')} €`
/** « DA SILVA » → « Da Silva », « LEFÈVRE » → « Lefèvre ». */
const cap = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())
/** Montant BTC demandé : équivalent en dollars arrondi à 4 décimales (montant « rond » typique d'un paiement). */
const feeBtc = (w: World, minUsd: number, maxUsd: number) => roundAsset('BTC', Math.round(fromUsd('BTC', w.rng.float(minUsd, maxUsd)) * 1e4) / 1e4)

const FEES = [
  { label: 'frais d\'ouverture de dossier', usd: [500, 1100] },
  { label: 'consignation des frais de procédure', usd: [1800, 4200] },
  { label: 'taxe de conformité anti-blanchiment', usd: [3500, 7500] },
] as const

export const btcRecoveryScam: ScenarioTemplate = {
  id: 'recovery-scam',
  title: 'Le faux cabinet de récupération',
  tagline: 'Promettre de rendre l\'argent volé… contre des frais : la seconde lame de l\'escroquerie.',
  description:
    'Une victime d\'une fausse plateforme d\'investissement, déjà en plainte, est démarchée par un « cabinet » qui promet de récupérer ses bitcoins contre des frais de procédure. Retrouvez les adresses de paiement, prouvez par le clustering que ces frais rejoignent le portefeuille de la première escroquerie, chiffrez le préjudice, suivez une sortie qui évite cette fois les exchanges (vente P2P sur Hodl Hodl, cartes cadeaux) jusqu\'à la contrepartie identifiable, et tirez-en les conséquences pour la victime et pour la procédure.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['cioh', 'change', 'osint', 'typologies', 'requisition'],
  estMinutes: 55,
  lessons: ['typologies', 'clustering', 'change-heuristics', 'osint', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const vp = fakePerson(r)
    const g = vp.g
    const city = fakeCity(r)
    const PLAT = r.pick(['NovaVest Capital', 'Altheon Markets', 'BlueOak Trading', 'Veltrix Invest'])
    const REC = r.pick(['Crypto Recovery Experts', 'Blockchain Restitution Services', 'Fund Recovery Partners'])
    let lawyer = fakePerson(r)
    while (lawyer.name.split(' ').slice(1).join(' ') === vp.name.split(' ').slice(1).join(' ')) lawyer = fakePerson(r)
    const lawyerLast = cap(lawyer.name.split(' ').slice(1).join(' '))
    const firm = `Cabinet ${lawyerLast} & Associés`
    const maitre = `Maître ${lawyer.name}`

    const cv = exchange(w, 'coinhouse', 'btc')
    const bs = exchange(w, 'bitstamp', 'btc')
    const outKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const out = exchange(w, outKey, 'btc')
    const sqKey = r.pick(['coinbase', 'kraken'] as const)
    const sq = exchange(w, sqKey, 'btc')
    const hodl = w.entity('hodlhodl')

    const victimE = w.customEntity({ name: vp.name, category: 'victim' })
    w.customEntity({ name: `${PLAT} (fausse plateforme)`, category: 'scam', description: 'Fausse plateforme d\'investissement (fictive).' })
    const net = w.customEntity({ name: `Réseau ${PLAT} (opérateurs)`, category: 'suspect' })
    const kind: AddrKind = r.pick(['p2wpkh', 'p2wpkh', 'p2pkh', 'p2sh'] as const)

    // ── Première escroquerie : la fausse plateforme ─────────────────────────
    const t1 = w.at(-r.int(80, 150) * 24)
    const S0 = w.addr('btc', { entity: net, kind })
    const nOther1 = r.int(2, 3)
    const Sx = w.addrs('btc', nOther1, { entity: net, kind })
    const pivot = Sx[0]
    const nP1 = r.int(2, 3)
    const p1: Tx[] = []
    let tp = t1
    for (let i = 0; i < nP1; i++) {
      p1.push(cv.withdraw(S0, roundAsset('BTC', Math.round(fromUsd('BTC', r.float(1500, 12000)) * 1e3) / 1e3), tp))
      tp += Math.round(r.float(3, 10) * DAY)
    }
    const total1 = p1.reduce((s, tx) => s + receivedIn(w, tx, S0), 0)
    // Autres « investisseurs » de la fausse plateforme : l'adresse de collecte communiquée aux clients
    // est la même pour tous, et l'adresse pivot sert à d'autres encore (avant le premier regroupement)
    const investorPay = (target: string, t: number) => {
      const v = roundAsset('BTC', Math.round(fromUsd('BTC', r.float(800, 9000)) * 1e3) / 1e3)
      const roll = r.next()
      if (roll < 0.45) return cv.withdraw(target, v, t)
      if (roll < 0.75) return bs.withdraw(target, v, t)
      return w.utxoTx({ time: t, from: [person(w, 'btc', { history: 2, time: t })], to: [{ address: target, value: v }] })
    }
    const s0Others = Array.from({ length: r.int(5, 7) }, () => investorPay(S0, t1 + Math.round(r.float(-8, 25) * DAY)))
    for (const sx of Sx) for (let i = 0; i < (sx === pivot ? r.int(5, 7) : r.int(1, 3)); i++) investorPay(sx, t1 + Math.round(r.float(-10, 25) * DAY))
    // Regroupement n° 1 : la collecte de la victime et celle d'autres victimes
    const c1T = Math.max(tp, t1 + 26 * DAY) + Math.round(r.float(2, 8) * DAY)
    const K1 = w.addr('btc', { entity: net, kind })
    const c1From = r.shuffle([S0, ...Sx])
    const c1In = c1From.reduce((s, a) => s + w.unspentValue(a, c1T), 0)
    const c1Fee = w.estimateFee('btc', c1From.reduce((s, a) => s + w.utxosOf(a, c1T).length, 0), 1)
    const c1 = w.utxoTx({ time: c1T, from: c1From, to: [{ address: K1, value: r8(c1In - c1Fee) }], fee: c1Fee, change: null, spendAll: true, method: 'consolidation' })
    // Premier encaissement sur l'exchange de sortie
    const D1 = out.newDeposit()
    const d1V = roundAsset('BTC', Math.floor(w.unspentValue(K1) * r.float(0.88, 0.96) * 100) / 100)
    const cash1 = w.utxoTx({ time: c1T + Math.round(r.float(1, 3) * DAY), from: [K1], to: [{ address: D1, value: d1V }], spendAll: true })
    const sweep1 = out.sweep([D1], cash1.time + Math.round(r.float(1, 6) * HOUR))[0]
    // Paiement tardif d'une autre victime sur l'adresse « pivot », jamais dépensé depuis
    const lateT = c1T + Math.round(r.float(5, 20) * DAY)
    const lateV = roundAsset('BTC', Math.round(fromUsd('BTC', r.float(900, 5000)) * 1e3) / 1e3)
    const late = r.chance(0.5) ? cv.withdraw(pivot, lateV, lateT) : bs.withdraw(pivot, lateV, lateT)

    // ── Seconde escroquerie : le faux cabinet de récupération ───────────────
    const contactT = w.at(-r.float(14, 22) * 24)
    const n = r.int(2, 3)
    const R = w.addrs('btc', n, { entity: net, kind })
    const fees: { label: string; value: number; buy: Tx; pay: Tx; change: string; from: string }[] = []
    // Le courrier arrive dans les heures du premier contact, avant tout achat de bitcoins par la victime
    const courrierT = contactT + Math.round(r.float(2, 10) * HOUR)
    let tf = contactT + Math.round(r.float(1.5, 3) * DAY)
    for (let i = 0; i < n; i++) {
      const value = feeBtc(w, FEES[i].usd[0], FEES[i].usd[1])
      const vAddr = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
      const buy = cv.withdraw(vAddr, r8(value + r.float(0.0006, 0.003)), tf - r.int(2, 20) * HOUR)
      const pay = w.utxoTx({ time: tf, from: [vAddr], to: [{ address: R[i], value }] })
      const change = pay.outputs.find((o) => o.address !== R[i])!.address
      fees.push({ label: FEES[i].label, value, buy, pay, change, from: vAddr })
      tf += Math.round(r.float(3, 7) * DAY)
    }
    const totalFees = r8(fees.reduce((s, f) => s + f.value, 0))
    const lastPay = fees[fees.length - 1]

    // Autres victimes du même « cabinet » (même portefeuille)
    const Rx: string[] = []
    for (let j = 0; j < r.int(1, 2); j++) {
      const ra = w.addr('btc', { entity: net, kind })
      Rx.push(ra)
      for (let i = 0; i < r.int(1, 2); i++) {
        const t = contactT + Math.round(r.float(-6, 14) * DAY)
        const v = feeBtc(w, 600, 5000)
        if (r.chance(0.5)) cv.withdraw(ra, v, t)
        else bs.withdraw(ra, v, t)
      }
    }

    // Regroupement n° 2 : les frais rejoignent l'adresse pivot de la première escroquerie
    const lT = Math.max(lastPay.pay.time, lateT, ...Rx.flatMap((a) => w.utxosOf(a).map((u) => u.time))) + Math.round(r.float(1, 3) * DAY)
    const lFrom = r.shuffle([...R, ...Rx, pivot])
    const lIn = lFrom.reduce((s, a) => s + w.unspentValue(a, lT), 0)
    // Cette fois, pas d'exchange : les bitcoins sont vendus de gré à gré sur Hodl Hodl (séquestre multisig)
    const escrow = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
    const Z = w.addr('btc', { entity: net, kind })
    const d2V = roundAsset('BTC', Math.floor(lIn * r.float(0.82, 0.93) * 1000) / 1000)
    const L = w.utxoTx({ time: lT, from: lFrom, to: [{ address: escrow, value: d2V }], change: Z, spendAll: true })
    const zV = L.outputs.find((o) => o.address === Z)?.value ?? 0
    // L'acheteur vire les euros au vendeur, le séquestre est libéré vers lui… et il dépose ses bitcoins chez Coinhouse
    const buyerAddr = w.addr('btc', { kind: 'p2wpkh' })
    const release = forwardAll(w, escrow, buyerAddr, lT + Math.round(r.float(3, 20) * HOUR), undefined, ['escrow-release'])
    const releaseV = release.outputs[0].value
    const buyerDep = cv.receive(buyerAddr, r8(Math.floor(releaseV * r.float(0.9, 0.98) * 1e4) / 1e4), release.time + Math.round(r.float(1, 4) * DAY))

    // ── Habillage du rendu : cartes cadeaux et mise de côté ─────────────────
    const shopName = r.pick(['Giftora', 'CadoFlash', 'PrepaidHub', 'VoucherNest'])
    const cardhub = w.customEntity({ name: shopName, category: 'merchant', known: true, risk: 'medium', description: 'Revendeur en ligne de cartes cadeaux et de cartes prépayées payables en crypto-actifs (fictif).', country: 'Estonie' })
    const cardTreasury = w.addr('btc', { entity: cardhub, label: `${shopName} — Trésorerie`, tags: ['liquid'] })
    const cardTxs: Tx[] = []
    let tc = lT + Math.round(r.float(0.2, 0.8) * DAY)
    for (let i = 0; i < r.int(3, 4); i++) {
      const inv = w.addr('btc', { entity: cardhub, label: `${shopName} — Facture`, tags: ['invoice'] })
      const v = roundAsset('BTC', Math.min(fromUsd('BTC', r.int(5, 25) * 20), zV * 0.12))
      cardTxs.push(w.utxoTx({ time: tc, from: [Z], to: [{ address: inv, value: v }], change: Z }))
      forwardAll(w, inv, cardTreasury, tc + Math.round(r.float(0.1, 2) * HOUR))
      tc += Math.round(r.float(0.3, 1.2) * DAY)
    }
    const cardTotal = r8(cardTxs.reduce((s, t) => s + t.outputs.filter((o) => o.address !== Z).reduce((x, o) => x + o.value, 0), 0))
    const stash = w.addr('btc', { entity: net, kind })
    const stashTx = w.utxoTx({ time: tc + Math.round(r.float(1, 4) * DAY), from: [Z], to: [{ address: stash, value: r8(w.unspentValue(Z) * r.float(0.4, 0.6)) }], change: Z })
    const zLeft = r8(w.unspentValue(Z))
    // Le rendu du premier encaissement sert de caisse de fonctionnement : VPN et achat de « fichiers » de victimes
    const K1b = cash1.outputs.find((o) => o.address !== D1)!.address
    const opsSpend: { label: string; tx: Tx }[] = []
    {
      const vpnName = r.pick(['Tunnelio VPN', 'NoTrace VPN', 'CloakNet VPN'])
      const vpn = w.addr('btc', { entity: w.customEntity({ name: vpnName, category: 'merchant', known: true, description: 'Fournisseur de VPN payable en crypto-actifs (fictif).', country: 'Panama' }), label: `${vpnName} — Paiement`, tags: ['invoice'] })
      const vpnV = roundAsset('BTC', Math.min(fromUsd('BTC', r.pick([60, 66, 72])), w.unspentValue(K1b) * 0.1))
      opsSpend.push({ label: `abonnement VPN (${vpnName})`, tx: w.utxoTx({ time: cash1.time + Math.round(r.float(2, 20) * HOUR), from: [K1b], to: [{ address: vpn, value: vpnV }], change: K1b }) })
      const listSeller = w.addr('btc', { entity: w.customEntity({ name: 'Vendeur de fichiers de victimes (inconnu)', category: 'individual' }) })
      for (let i = 0; i < r.int(1, 2); i++) {
        const v = roundAsset('BTC', Math.min(fromUsd('BTC', r.int(4, 12) * 100), w.unspentValue(K1b) * 0.25))
        opsSpend.push({ label: 'achat de fichier de « leads »', tx: w.utxoTx({ time: cash1.time + Math.round(r.float(6, 44) * HOUR) + i * 3600, from: [K1b], to: [{ address: listSeller, value: v }], change: K1b }) })
      }
    }

    // ── Bruit ────────────────────────────────────────────────────────────────
    cv.noise(16, t1 - 10 * DAY, lT + 5 * DAY)
    bs.noise(8, t1 - 10 * DAY, lT + 5 * DAY)
    out.noise(14, c1T - 5 * DAY, lT + 8 * DAY)
    // « Séquestre » cité par le faux cabinet : un hot wallet d'exchange très actif
    for (let i = 0; i < 4; i++) w.fund(sq.hot, roundAsset('BTC', r.float(40, 260)), contactT - Math.round(r.float(1, 60) * DAY))
    sq.noise(14, contactT - 20 * DAY, lT + 5 * DAY)

    // ── Textes ───────────────────────────────────────────────────────────────
    const procNo = `${new Date(t1 * 1000).getFullYear()}/${r.int(10000, 99999)}`
    const plainteT = lastPay.pay.time + Math.round(r.float(2, 6) * DAY)
    const phone = fakePhone(r)
    const toque = `${String.fromCharCode(65 + r.int(0, 25))}${r.int(100, 999)}`
    const domain = `${REC.toLowerCase().replace(/[^a-z]+/g, '-')}-${r.pick(['eu', 'legal', 'france', 'law'])}.com`
    const given = fees.slice(0, n - 1)
    const rxCount = Rx.length
    const victimTotal = r8(total1 + totalFees)
    // Préjudice des autres victimes du « cabinet » (adresses de frais regroupées avec celles de la victime)
    const rxTotal = r8(Rx.reduce((s, a) => s + (w.summary(a).received.BTC ?? 0), 0))
    const rxPays = Rx.reduce((s, a) => s + w.summary(a).nIn, 0)
    const deV = de(vp.name)
    const dePLAT = de(PLAT)
    const methodGap = spanTxt(lT - cash1.time)

    return {
      world: w,
      title: `Faux cabinet de récupération — ${city}`,
      briefing:
        `${vp.name} (${city}) a perdu ${amt(r8(total1), 'BTC')} il y a quelques mois sur ${PLAT}, une fausse plateforme d'investissement ; ${g('il', 'elle')} a déposé plainte et la procédure est en cours. Récemment, ${g('il', 'elle')} a été ${g('contacté', 'contactée')} par « ${REC} », puis par un « ${firm} », qui lui promettaient de récupérer ses fonds contre des frais réglés en bitcoins.\n\n` +
        `Après ${n} versements, le « cabinet » réclame encore une taxe. ${g('Méfiant', 'Méfiante')}, ${vp.name} revient déposer plainte. Ce schéma, l'escroquerie à la récupération (recovery scam), vise des victimes déjà fragilisées : leurs coordonnées circulent, parfois entre les mains des mêmes auteurs.\n\n` +
        `Objectifs : identifier les adresses de paiement des frais, vérifier on-chain si elles mènent au portefeuille de la première escroquerie, chiffrer le nouveau préjudice, suivre la sortie des fonds (qui, cette fois, évite les exchanges), puis décider de la réponse à la victime et du sort procédural de la plainte.`,
      evidence: [
        {
          id: 'proc', type: 'note', title: `Rappel de la procédure initiale n° ${procNo}`, date: daytime(c1T + Math.round(r.float(10, 20) * DAY)), author: 'Service enquêteur saisi de la première plainte',
          body:
            `Plainte ${deV} pour escroquerie (fausse plateforme ${PLAT}).\n` +
            `Adresse de collecte communiquée par la plateforme : ${A(w, S0)}\n` +
            `Versements de la victime, depuis son compte Coinhouse :\n${p1.map((tx) => `- ${tx.hash} (${amt(receivedIn(w, tx, S0), 'BTC')})`).join('\n')}\n` +
            `Total : ${amt(r8(total1), 'BTC')}. Réquisition adressée à Coinhouse (données de la victime). Analyse des flux en aval à compléter.`,
        },
        {
          id: 'courrier', type: 'email', title: `Courrier à en-tête du « ${firm} »`, date: courrierT, author: maitre,
          body:
            `${firm} — Avocats au barreau de Paris — Toque ${toque}\nDépartement « Recouvrement d'actifs numériques », partenaire de ${REC}\n\n` +
            `${g('Monsieur', 'Madame')},\nMandaté dans le cadre de la cellule européenne de restitution, notre cabinet a localisé les ${amt(r8(total1), 'BTC')} que vous avez versés à ${PLAT} depuis l'adresse ${A(w, S0)}.\n` +
            `Ces fonds sont placés sous séquestre sur le portefeuille ${A(w, sq.hot)} dans l'attente de leur restitution.\n\n` +
            `Pour libérer les fonds, la procédure prévoit le règlement préalable, en bitcoins, des postes suivants : ${FEES.slice(0, n).map((f) => f.label).join(', ')}. Ces frais sont intégralement remboursés à la restitution.\n` +
            `Dossier agréé AMF. Confidentialité exigée : ne communiquez pas avec les services de police, cela bloquerait la procédure.\n\n${maitre}`,
        },
        {
          id: 'whatsapp', type: 'sms', title: `Échanges WhatsApp avec « ${maitre} » (extraits)`, date: lastPay.pay.time + Math.round(r.float(1, 6) * HOUR), author: phone,
          body:
            given.map((f, i) => `${maitre} : Étape ${i + 1}, ${f.label} : ${amt(f.value, 'BTC')} (environ ${eur(f.value)}) à envoyer sur\n${A(w, R[i])}`).join('\n') +
            `\n${maitre} : Dernière étape : ${lastPay.label}, ${amt(lastPay.value, 'BTC')}. Je vous envoie l'adresse en QR code, ne la recopiez pas ici.\n` +
            `${vp.name} : C'est fait, mais vous m'aviez dit que c'était la dernière fois…\n` +
            `${maitre} : Le séquestre exige encore une garantie de solvabilité. Après, tout est débloqué sous 48 h, je vous le promets.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Nouvelle plainte — déclaration de la victime', date: daytime(plainteT), author: vp.name,
          body:
            `« J'ai été ${g('contacté', 'contactée')} le ${fmtDate(contactT, false)} par ${REC}, qui connaissait le nom de la plateforme et le montant exact que j'avais perdu. Ils m'ont mis${g('', 'e')} en relation avec ${maitre}. ` +
            `À leur demande, j'ai installé un portefeuille sur mon téléphone « pour recevoir les fonds récupérés », acheté des bitcoins sur Coinhouse et payé ${n} fois.\n` +
            `Pour le dernier paiement, je n'ai plus l'adresse (QR code effacé), mais mon application indique la transaction : ${lastPay.pay.hash}\n` +
            `On me réclame aujourd'hui une « garantie de solvabilité ». J'ai compris que je m'étais fait avoir une deuxième fois. »`,
        },
        {
          id: 'osint', type: 'osint', title: 'Vérifications en sources ouvertes sur le « cabinet »', date: daytime(plainteT + Math.round(r.float(0.5, 2) * DAY)), author: 'Cellule d\'appui',
          body:
            `• Le site ${domain} a été enregistré ${r.int(3, 6)} semaines avant le premier contact, via un service d'anonymisation des données du titulaire.\n` +
            `• Aucun avocat nommé ${lawyer.name} n'apparaît dans l'annuaire national des avocats ; la toque ${toque} ne correspond pas à ce nom.\n` +
            `• L'adresse postale du cabinet est celle d'un centre de domiciliation ; le numéro ${phone} est un mobile.\n` +
            `• Le nom « ${REC} » figure sur une liste noire de l'AMF des sites proposant de récupérer des fonds perdus. L'AMF n'« agrée » pas de tels services.\n` +
            `• L'adresse de « séquestre » citée dans le courrier reste à vérifier dans l'outil.`,
        },
        {
          id: 'p2p', type: 'note', title: 'Note de la cellule d\'appui : ventes de gré à gré (P2P)', date: daytime(plainteT + Math.round(r.float(2, 3) * DAY)), author: 'Cellule d\'appui',
          body:
            `Les réseaux dont un compte d'exchange risque d'être visé vendent souvent leurs bitcoins de gré à gré, sur des places de marché P2P comme Hodl Hodl :\n` +
            `• le vendeur verse les bitcoins sur un séquestre multisignature (adresse P2SH « 3… ») propre à la transaction ;\n` +
            `• l'acheteur paie le vendeur hors chaîne, le plus souvent par virement bancaire ;\n` +
            `• à réception, le séquestre est libéré vers l'adresse de l'acheteur.\n\n` +
            `La plateforme ne détient pas les fonds et ne pratique pas de KYC. En revanche, l'acheteur est un tiers de bonne foi, souvent client d'un exchange régulé : son relevé bancaire désigne le compte qui a encaissé les euros.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 12,
          prompt: `Sélectionnez toutes les adresses sur lesquelles ${vp.name} a versé les « frais » réclamés par le cabinet.`,
          answer: [...R],
          hint: 'Les premières adresses figurent dans les messages. Pour la dernière, ouvrez la transaction citée dans la plainte : laquelle des deux sorties est le paiement, laquelle est le rendu ?',
          explanation: `${n} adresses : ${R.map((a) => A(w, a)).join(', ')}. La dernière se déduit de la transaction ${lastPay.pay.hash.slice(0, 14)}… : la sortie de ${amt(lastPay.value, 'BTC')} est un montant rond (4 décimales) correspondant à la somme demandée, ${kind === 'p2wpkh' ? 'alors que' : 'sur une adresse d\'un autre type que l\'entrée, alors que'} l'autre sortie, au montant quelconque, revient vers une adresse neuve du portefeuille de la victime (${A(w, lastPay.change)}) : c'est le rendu. ${rxCount > 1 ? `Les ${rxCount} autres adresses de frais regroupées avec elles appartiennent au même portefeuille mais ont été alimentées par d'autres victimes : elles ne relèvent pas des paiements ${deV}.` : `L'autre adresse de frais regroupée avec elles appartient au même portefeuille mais a été alimentée par une autre victime : elle ne relève pas des paiements ${deV}.`}`,
        },
        {
          id: 'o2', type: 'tx', points: 12,
          prompt: 'Quelle transaction fait entrer les frais de « récupération » dans le portefeuille de la première escroquerie ?',
          answer: [L.id],
          hint: 'Suivez la dépense des adresses de frais, puis ouvrez le panneau cluster : une des entrées a déjà servi lors de la première escroquerie.',
          explanation: `La transaction ${L.hash.slice(0, 14)}… dépense ensemble les ${n} adresses de frais, ${rxCount} adresse${rxCount > 1 ? 's' : ''} d'autres victimes du « cabinet » et ${A(w, pivot)}. Or cette dernière figure aussi parmi les entrées du regroupement ${c1.hash.slice(0, 14)}…, aux côtés de l'adresse de collecte ${A(w, S0)} de la première plainte. Par l'heuristique des entrées communes, toutes ces adresses sont contrôlées par le même portefeuille : le faux cabinet et la fausse plateforme ne font qu'un. Le courrier le laissait deviner : il citait l'adresse de collecte et le montant exact perdu.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Quelle adresse, dépensée dans le regroupement des frais, avait déjà été regroupée avec l\'adresse de collecte de la première plainte ?',
          answer: [pivot],
          hint: 'Passez en revue les entrées de la transaction qui regroupe les frais : pour chacune, regardez si elle apparaît dans une autre transaction à entrées multiples, plus ancienne.',
          explanation: `${A(w, pivot)} est l'adresse « pivot » : elle figure parmi les entrées du premier regroupement (${c1.hash.slice(0, 14)}…, le ${fmtDate(c1.time, false)}), aux côtés de ${A(w, S0)}, puis parmi celles du regroupement des frais (${L.hash.slice(0, 14)}…). Entre-temps, elle a reçu un paiement tardif d'une autre victime ${dePLAT} (${amt(lateV, 'BTC')}), ce qui explique qu'elle ait encore eu un solde à dépenser. C'est le maillon qui relie les deux clusters : sans elle, on aurait deux portefeuilles distincts ; avec elle, l'heuristique des entrées communes les fusionne. Au procès-verbal, on décrit précisément ces deux transactions, car toute la démonstration repose sur elles.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: `Quel montant total (en BTC) ${vp.name} a-t-${g('il', 'elle')} versé au faux cabinet ?`,
          answer: totalFees,
          hint: 'N\'additionnez que les sorties de paiement, pas les rendus revenus vers le portefeuille de la victime.',
          explanation: `${fees.map((f) => `${amt(f.value, 'BTC')} (${f.label})`).join(' + ')} = ${amt(totalFees, 'BTC')}, soit environ ${eur(totalFees)}. Le préjudice cumulé de la victime atteint ${amt(victimTotal, 'BTC')}.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: `Quel montant total (en BTC) les autres victimes du faux cabinet ont-elles versé sur les adresses de frais regroupées avec celles ${deV} (hors adresse pivot) ?`,
          answer: rxTotal,
          hint: 'Dans la transaction de regroupement des frais, écartez les adresses payées par la victime et l\'adresse pivot ; additionnez ce que les autres adresses ont reçu avant d\'être dépensées.',
          explanation: `${rxCount > 1 ? `Les ${rxCount} adresses` : 'L\'adresse'} ${Rx.map((a) => A(w, a)).join(', ')} ${rxCount > 1 ? 'ont reçu' : 'a reçu'} ${rxPays} paiement${rxPays > 1 ? 's' : ''} pour un total de ${amt(rxTotal, 'BTC')}, toujours au départ de Coinhouse ou de Bitstamp et pour des montants arrondis au dix-millième de bitcoin : le même mode opératoire que les « frais » réclamés à ${vp.name}. Ces sommes chiffrent un préjudice distinct, celui de victimes qui n'ont peut-être pas encore déposé plainte. Les retraits d'exchange qui les ont alimentées permettent de les identifier par réquisition.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Vers quel service les fonds regroupés sont-ils envoyés ?',
          answer: ['hodlhodl'],
          hint: 'Suivez la sortie principale de la transaction de regroupement : à qui l\'outil attribue-t-il l\'adresse ? Ce n\'est pas, cette fois, une adresse de dépôt d\'exchange.',
          explanation: `Le regroupement envoie ${amt(d2V, 'BTC')} (montant arrondi au millième, typique d'une annonce de vente) vers un séquestre multisignature de Hodl Hodl, place de marché P2P sans KYC ; le reste (${amt(zV, 'BTC')}) revient en rendu vers ${A(w, Z)}. La première collecte avait été encaissée ${methodGap} plus tôt chez ${out.entity.name} : le réseau a changé de méthode et vend désormais ses bitcoins de gré à gré, contre des euros versés hors chaîne. ${procedureFor(hodl)}`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Quelle adresse de séquestre a reçu les frais regroupés ?',
          answer: [escrow],
          hint: 'Dans la transaction de regroupement, distinguez le paiement (montant arrondi, adresse attribuée à un service) du rendu (adresse neuve, même type que les entrées).',
          explanation: `${A(w, escrow)} reçoit ${amt(d2V, 'BTC')} : adresse P2SH attribuée à Hodl Hodl, propre à cette vente. Elle est vidée ${Math.round((release.time - L.time) / HOUR)} h plus tard vers ${A(w, buyerAddr).slice(0, 14)}… (${amt(releaseV, 'BTC')}, frais déduits) : c'est la libération du séquestre à l'acheteur, après réception de son paiement. La plateforme ne détient pas les fonds mais connaît les deux pseudonymes, les messages échangés et le moyen de paiement convenu : à requérir avec le hash ${L.hash.slice(0, 12)}….`,
        },
        {
          id: 'o13', type: 'entity', points: 10,
          prompt: 'L\'acheteur des bitcoins vendus sur Hodl Hodl dépose ensuite les fonds sur une plateforme régulée. Laquelle ?',
          answer: ['coinhouse'],
          hint: 'Suivez la libération du séquestre jusqu\'à l\'adresse de l\'acheteur, puis la dépense suivante de cette adresse.',
          explanation: `Le ${fmtDate(buyerDep.tx.time, false)}, l'acheteur envoie ${amt(buyerDep.tx.outputs.find((o) => o.address === buyerDep.deposit)!.value, 'BTC')} vers une adresse de dépôt Coinhouse. C'est la meilleure piste de la sortie : Coinhouse identifie son client : ${procedureFor(cv.entity)} Entendu comme témoin, l'acheteur produira le relevé du virement qu'il a fait pour payer les bitcoins, donc le compte bancaire (IBAN) qui a encaissé les euros du réseau, ou celui d'une mule. L'acheteur n'est pas un suspect : il a payé ses bitcoins.`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt d\'exchange avait reçu l\'encaissement des fonds de la première escroquerie ?',
          answer: [D1],
          hint: 'Repartez de l\'adresse de collecte de la procédure initiale et suivez le premier regroupement jusqu\'à son encaissement.',
          explanation: `Le premier regroupement (${c1.hash.slice(0, 14)}…) alimente ${A(w, K1)}, qui envoie ${amt(d1V, 'BTC')} vers ${A(w, D1)} le ${fmtDate(cash1.time, false)} ; cette adresse de dépôt ${out.entity.name} est balayée quelques heures plus tard vers le hot wallet. La réquisition à ${out.entity.name} vise ce dépôt : titulaire du compte, KYC, connexions. L'identité déclarée (même s'il s'agit d'une mule) ouvre une piste d'identification, à rapprocher du compte bancaire révélé par l'acheteur P2P. Le rendu de cet encaissement (${A(w, K1b).slice(0, 14)}…) sert ensuite de caisse de fonctionnement : ${opsSpend.map((o) => o.label).join(', ')}. Ces petites dépenses ne sont pas la sortie des fonds, mais elles documentent l'organisation du réseau (le fichier de « leads » explique comment il connaissait le dossier de la victime).`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: 'Après le regroupement des frais, sur quelle adresse le réseau a-t-il conservé la part non vendue ?',
          answer: [Z],
          hint: 'La transaction de regroupement a deux sorties : l\'une part vers le séquestre, l\'autre est un rendu. Comparez le type d\'adresse, le caractère rond des montants et l\'attribution.',
          explanation: `${A(w, Z)} reçoit ${amt(zV, 'BTC')}, montant quelconque, sur une adresse neuve du même type que les entrées du regroupement : c'est le rendu, resté sous le contrôle du réseau. Il sert ensuite de porte-monnaie : ${cardTxs.length} achats de cartes cadeaux ${shopName} (${amt(cardTotal, 'BTC')} au total, autant de commandes dont ${shopName} connaît l'e-mail de livraison et l'IP), puis une mise de côté de ${amt(stashTx.outputs.find((o) => o.address === stash)!.value, 'BTC')} sur ${A(w, stash).slice(0, 14)}…, qui dort. Il reste ${amt(zLeft, 'BTC')} sur le rendu. Ni l'un ni l'autre ne sont gelables en l'état (aucun intermédiaire ne les détient) : surveillance des deux adresses.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Comment identifier les autres victimes de ce réseau à partir du graphe ?',
          ...choice(r,
            'Requérir Coinhouse et Bitstamp sur les retraits qui ont alimenté les adresses de collecte et de frais du cluster, afin d\'obtenir l\'identité des clients donneurs d\'ordre',
            [
              `Requérir ${out.entity.name} sur l'ensemble des clients ayant déposé le même jour que le réseau`,
              'Publier les adresses du cluster sur les réseaux sociaux pour inviter les victimes à se manifester',
              'Attendre que d\'autres plaintes mentionnent spontanément les mêmes adresses',
            ]),
          hint: 'D\'où viennent les paiements reçus par les adresses du cluster ? Qui connaît l\'identité de ceux qui les ont envoyés ?',
          explanation: `Les paiements des victimes partent de comptes Coinhouse ou Bitstamp (retraits depuis leurs hot wallets). Chaque retrait vers une adresse du cluster correspond à un client de l'exchange qui a donné l'ordre de virement : une réquisition ciblée (hash de transaction, adresse de destination, date) permet d'obtenir son identité et de le contacter comme victime potentielle. Requérir ${out.entity.name} sur des clients sans lien avec le dossier serait disproportionné, et la publication d'adresses exposerait l'enquête. Les victimes ainsi identifiées renforcent la procédure (préjudice global, circonstances aggravantes éventuelles selon les éléments réunis).`,
        },
        {
          id: 'o6', type: 'choice', points: 8,
          prompt: `Que répondre à ${vp.name}, qui demande s'${g('il', 'elle')} doit payer la « garantie de solvabilité » ?`,
          ...choice(r,
            'Ne plus rien verser et rompre le contact : aucun avocat ni service officiel ne réclame des frais en crypto-actifs pour restituer des fonds ; conserver les échanges et compléter la plainte',
            [
              'Payer cette dernière garantie si le cabinet fournit une attestation tamponnée, la procédure étant presque terminée',
              'Envoyer un petit montant « test » pour vérifier que le cabinet restitue bien les fonds',
              'Se tourner vers un autre cabinet de récupération, mieux noté en ligne, en exigeant un paiement au résultat',
            ]),
          hint: 'Relisez le courrier et les vérifications en sources ouvertes : qui peut ordonner une restitution, et à quel prix pour la victime ?',
          explanation: `Une restitution de fonds saisis est décidée par l'autorité judiciaire et ne coûte rien à la victime. Signaux d'alerte réunis ici : frais exigés d'avance et en bitcoins, urgence, consigne de ne pas parler à la police, faux « agrément AMF », avocat introuvable, site récent. L'adresse de « séquestre » (${A(w, sq.hot).slice(0, 14)}…) est un hot wallet ${de(sq.entity.name)} sans rapport avec le dossier : le solde affiché sert seulement à rassurer. Toute nouvelle demande, y compris d'un autre « cabinet », doit être considérée comme une nouvelle tentative.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Quel sort donner à la nouvelle plainte ?',
          ...choice(r,
            `La rapprocher de la procédure initiale et en aviser le magistrat saisi : même portefeuille, donc même réseau, qui revictimise ${g('le plaignant', 'la plaignante')}`,
            [
              'La traiter séparément : le faux cabinet et la fausse plateforme sont, par nature, des auteurs différents',
              'La classer : la victime a payé volontairement des frais à un prestataire',
              'Attendre les réponses aux réquisitions de la première procédure avant de l\'enregistrer',
            ]),
          hint: 'Le lien établi on-chain désigne-t-il deux groupes d\'auteurs distincts, ou un seul portefeuille ?',
          explanation: `Le lien on-chain (entrées communes entre les frais et la collecte ${dePLAT}) établit un même portefeuille, donc très probablement les mêmes auteurs. Rapprocher les procédures permet de cumuler le préjudice (${amt(victimTotal, 'BTC')} pour cette victime), de coordonner en une fois les réquisitions (${out.entity.name} pour le premier encaissement, Hodl Hodl et Coinhouse pour la vente P2P) et d'identifier les autres victimes : celles de la plateforme comme celles du « cabinet », à partir des retraits Coinhouse et Bitstamp qui alimentent le cluster.`,
        },
      ],
      truth: {
        // Les paiements de frais (objet de la nouvelle plainte) en tête : ils servent de point de départ au traçage
        path: [...fees.map((f) => f.pay.id), ...fees.map((f) => f.buy.id), L.id, sweep1.id, ...p1.map((x) => x.id), c1.id, cash1.id, late.id],
        addresses: [...R, ...fees.map((f) => f.from), S0, ...Sx, K1, D1, ...Rx, Z],
        debrief:
          `1. Première escroquerie : ${vp.name} verse ${amt(r8(total1), 'BTC')} en ${nP1} fois sur ${A(w, S0)}, adresse de collecte ${dePLAT} que ${s0Others.length} autres « investisseurs » ont aussi payée. Le ${fmtDate(c1.time, false)}, cette adresse est regroupée avec ${nOther1} autres collectes, dont ${A(w, pivot)}, puis ${amt(d1V, 'BTC')} sont encaissés chez ${out.entity.name} ; le rendu de cet encaissement paie ensuite un VPN et des fichiers de victimes.\n` +
          `2. L'adresse ${A(w, pivot)} reçoit ensuite un paiement tardif d'une autre victime (${amt(lateV, 'BTC')}).\n` +
          `3. Seconde escroquerie : « ${REC} » puis le « ${firm} » obtiennent ${n} paiements (${fees.map((f) => amt(f.value, 'BTC')).join(', ')}), soit ${amt(totalFees, 'BTC')}. Chaque paiement part du portefeuille personnel de la victime avec un rendu.\n` +
          `4. Le ${fmtDate(L.time, false)}, une seule transaction dépense les adresses de frais, celles d'autres victimes du cabinet et l'adresse pivot : la preuve, par entrées communes, que la fausse plateforme et le faux cabinet partagent le même portefeuille.\n` +
          `5. ${amt(d2V, 'BTC')} partent sur un séquestre Hodl Hodl (${A(w, escrow)}) : vente P2P, libérée à un acheteur qui dépose ensuite chez Coinhouse. ${amt(zV, 'BTC')} restent en rendu sur ${A(w, Z)}, qui achète des cartes cadeaux ${shopName} (${amt(cardTotal, 'BTC')}) et met de côté une partie sur ${A(w, stash)}.\n` +
          `6. Les autres adresses de frais du cluster ont reçu ${amt(rxTotal, 'BTC')} d'autres victimes du « cabinet », identifiables par réquisition à Coinhouse et Bitstamp sur les retraits correspondants.\n\n` +
          `Fausses pistes : l'adresse de « séquestre » du courrier, simple hot wallet ${de(sq.entity.name)} ; les rendus revenus au portefeuille de la victime ; les adresses de frais des autres victimes, qui appartiennent au réseau mais n'ont pas reçu l'argent de votre plaignant ; l'acheteur P2P, tiers de bonne foi et non complice.\n\n` +
          `À retenir : l'escroquerie à la récupération est souvent commise par le réseau initial, qui sait exactement qui a perdu quoi. Le clustering transforme une intuition (« ils connaissaient mon dossier ») en lien démontrable. Quand la sortie évite les exchanges (vente P2P), la piste passe par la contrepartie : l'acheteur, son exchange et son relevé bancaire. Réflexes : prévenir la victime qu'aucun service légitime ne fait payer une restitution, joindre ou rapprocher les procédures, requérir l'exchange du premier encaissement, Hodl Hodl et l'exchange de l'acheteur.`,
      },
      hints: [
        'Commencez par les adresses des messages WhatsApp : où leurs fonds repartent-ils ?',
        'Une transaction qui dépense ensemble plusieurs adresses désigne un même propriétaire : ouvrez le panneau cluster de l\'une d\'elles.',
        'L\'adresse de collecte de la première plainte appartient-elle au même cluster ? Cherchez l\'entrée qui figure dans les deux regroupements.',
        'Le regroupement des frais n\'aboutit pas chez un exchange : lisez l\'étiquette de sa sortie principale, puis suivez la libération du séquestre.',
      ],
    }
  },
}
