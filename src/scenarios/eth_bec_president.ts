import { World } from '../engine/world'
import { exchange, swapper, HOUR, DAY } from '../engine/patterns'
import { dusting } from '../engine/realism'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor, type FakePerson } from './util'

/** Cours EUR/USD figé pour l'exercice (les achats de la mule se font en euros). */
const EUR_USD = 1.08

const COMPANIES = [
  { name: 'Menuiseries Morvan', domain: 'menuiseries-morvan.example', activity: 'la menuiserie industrielle', staff: 48 },
  { name: 'Transports Lemaire', domain: 'transports-lemaire.example', activity: 'le transport routier de marchandises', staff: 65 },
  { name: 'Atelier Mécanique Delmas', domain: 'meca-delmas.example', activity: 'l\'usinage de précision', staff: 37 },
  { name: 'Groupe Alimentaire Vallon', domain: 'vallon-alimentaire.example', activity: 'le négoce alimentaire', staff: 82 },
  { name: 'Imprimerie Chambord', domain: 'imprimerie-chambord.example', activity: 'l\'imprimerie et le façonnage', staff: 29 },
  { name: 'Thermique Bellanger', domain: 'thermique-bellanger.example', activity: 'le génie climatique', staff: 54 },
] as const

/** Domaine sosie : « rn » à la place du premier « m » (homographe visuel). */
function homograph(domain: string): string {
  const i = domain.indexOf('m')
  return domain.slice(0, i) + 'rn' + domain.slice(i + 1)
}

/** « de » élidé devant voyelle : « d'Émilie », « de Marc ». */
function de(name: string): string {
  return /^[AEÉÈIOUYH]/i.test(name) ? `d'${name}` : `de ${name}`
}

/** Heure locale (Paris) d'un horodatage. */
const parisHour = (t: number) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t * 1000)))
/** Décale vers l'avant jusqu'aux heures de bureau. */
const office = (t: number) => {
  const h = parisHour(t)
  let u = h >= 9 && h < 18 ? t : t + (h >= 18 ? 24 - h + 9 : 9 - h) * HOUR
  // Changement d'heure pendant le décalage : on ajuste heure par heure
  while (parisHour(u) < 9 || parisHour(u) >= 18) u += HOUR
  return u
}

function eur(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function slug(p: FakePerson): string {
  const [first, ...last] = p.name.split(' ')
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  return `${clean(first)}.${clean(last.join(''))}`
}

function fakeIban(w: World): string {
  const g = () => String(w.rng.int(1000, 9999))
  return `FR76 ${g()} ${g()} ${g()} ${g()} ${g()} ${w.rng.int(100, 999)}`
}

function distinctPeople(w: World, n: number): FakePerson[] {
  const out: FakePerson[] = []
  while (out.length < n) {
    const p = fakePerson(w.rng)
    if (!out.some((o) => o.name === p.name || o.name.split(' ')[1] === p.name.split(' ')[1])) out.push(p)
  }
  return out
}

export const ethBecPresident: ScenarioTemplate = {
  id: 'eth-bec-president',
  title: 'Fraude au président : du virement à l\'USDT',
  tagline: 'Un faux PDG, un faux fournisseur, une société écran tenue par un gérant de paille, et des USDT qui finissent chez un courtier OTC.',
  description:
    'La comptable d\'une PME a réglé la facture d\'un « nouveau fournisseur » sur ordre d\'un faux PDG. Le bénéficiaire est une société écran dont le gérant de paille, recruté par une fausse offre d\'emploi, a converti les fonds en USDT chez Coinhouse. Retrouvez l\'adresse du commanditaire, triez ses sorties (recruteur, échangeur, exchange, poussière), suivez les USDT d\'Ethereum à Tron jusqu\'au courtier OTC, localisez les fonds encore gelables et cartographiez le réseau de collectrices.',
  difficulty: 2,
  chains: ['eth', 'tron'],
  skills: ['tokens', 'tron', 'exchange_id', 'requisition', 'gel', 'typologies'],
  estMinutes: 52,
  lessons: ['typologies', 'stablecoins', 'exchanges', 'requisitions', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    let muleCity = fakeCity(r)
    while (muleCity === city) muleCity = fakeCity(r)
    const company = r.pick(COMPANIES)
    const fakeDomain = homograph(company.domain)
    const [acct, ceo, mule] = distinctPeople(w, 3)
    const ga = acct.g
    const gm = mule.g
    const gc = ceo.g
    const lawyer = `Maître ${r.pick(['Delorme', 'Vasseur', 'Aubriot', 'Kessler', 'Montfort'])}`
    const shell = r.pick(['Valtis Partners Ltd', 'Northgate Settlements Ltd', 'Brightwell Clearing Ltd'])
    // Société écran française qui reçoit le virement, présentée comme un nouveau fournisseur
    const shellCo = r.pick(['Lumex Négoce', 'Arvalis Trading', 'Nordis Distribution', 'Kelvane Import'])
    const shellLabel = `EURL ${shellCo}`
    const siren = `${r.int(900, 989)} ${r.int(100, 999)} ${r.int(100, 999)}`
    const commissionPct = r.pick([4, 5, 6])
    const bankName = 'Orfélia Banque'
    const muleIban = fakeIban(w)
    const companyIban = fakeIban(w)

    // ── Acteurs on-chain ─────────────────────────────────────────────────────
    const ch = exchange(w, 'coinhouse', 'eth')
    const k1 = r.pick(['okx', 'binance'] as const)
    const e1 = exchange(w, k1, 'eth') // sortie directe en USDT ERC-20
    const kr = exchange(w, 'kraken', 'eth')
    const cn = swapper(w, 'changenow')
    const tether = w.entity('tether')
    const satsdesk = w.entity('satsdesk')
    const otc = w.addr('tron', { entity: satsdesk, label: 'SatsDesk OTC — Portefeuille de règlement', tags: ['liquid', 'hot'] })

    const muleE = w.customEntity({ name: `${mule.name} (titulaire du compte Coinhouse)`, category: 'individual' })
    const orgE = w.customEntity({ name: 'Commanditaire de la fraude (inconnu)', category: 'suspect' })
    const P = w.addr('eth', { entity: muleE }) // portefeuille personnel de la mule (fausse piste)
    const O = w.addr('eth', { entity: orgE }) // adresse fournie par le commanditaire
    const G = w.addr('eth', { entity: orgE }) // financeur de gas ETH
    const T1 = w.addr('tron', { entity: orgE })
    const T2 = w.addr('tron', { entity: orgE })
    const GT = w.addr('tron', { entity: orgE }) // financeur de TRX

    // ── Préparation (semaines précédentes) ──────────────────────────────────
    const adT = w.at(-r.int(38, 50) * 24)
    const openT = w.at(-r.int(18, 26) * 24)
    const pAddedT = openT + Math.round(r.float(1, 3) * DAY)
    const pTest = ch.withdraw(P, roundAsset('ETH', r.float(0.03, 0.09)), pAddedT + r.int(1, 5) * HOUR)
    const oAddedT = w.at(-r.float(4, 7) * 24)

    // Le commanditaire a déjà utilisé O : gas, puis USDT d'une autre mule (retrait Kraken)
    w.fundAccount(G, roundAsset('ETH', r.float(0.6, 1.4)), 'ETH', w.at(-r.int(30, 40) * 24))
    const gasTx = w.transfer({ time: w.at(-r.float(15, 17) * 24), from: G, to: O, value: roundAsset('ETH', r.float(0.03, 0.06)), asset: 'ETH' })
    const krValue = roundAsset('USDT', Math.round(r.float(45000, 120000) / 10) * 10 + r.int(1, 99) / 100)
    const krT = w.at(-r.float(11, 13) * 24)
    const krTx = kr.withdraw(O, krValue, krT, 'USDT')
    const dep1 = e1.newDeposit()
    const krFwd = e1.receive(O, krValue, krT + Math.round(r.float(3, 10) * HOUR), { asset: 'USDT', depositAddr: dep1 })

    // Seconde adresse collectrice du réseau : même financeur de gas, alimentée par une autre mule (Coinhouse)
    const O2 = w.addr('eth', { entity: orgE })
    const gasO2 = w.transfer({ time: w.at(-r.float(22, 26) * 24), from: G, to: O2, value: roundAsset('ETH', r.float(0.02, 0.05)), asset: 'ETH' })
    const o2In = Array.from({ length: r.int(1, 2) }, (_, i) =>
      ch.withdraw(O2, roundAsset('USDT', Math.round(r.float(15000, 60000) / 10) * 10 + r.int(1, 99) / 100), w.at(-r.float(19, 20) * 24 + i * r.float(20, 40)), 'USDT'))
    const o2Total = roundAsset('USDT', o2In.reduce((s, t) => s + t.transfers[0].value, 0))
    const o2RecruitPct = r.pick([2, 2.5, 3])
    const o2Recruit = roundAsset('USDT', Math.round((o2Total * o2RecruitPct) / 100))
    const o2FwdT = o2In[o2In.length - 1].time + Math.round(r.float(2, 8) * HOUR)
    // recruiter est créé plus bas : on garde la valeur, la transaction est ajoutée après coup
    const o2Fwd = e1.receive(O2, roundAsset('USDT', o2Total - o2Recruit), o2FwdT, { asset: 'USDT', depositAddr: dep1 })

    // ── La fraude : courriels, virement, conversion ─────────────────────────
    const eurV = Math.round(r.float(180000, 450000) / 10) * 10 + r.pick([0, 0.5, 0.8])
    // Heures de bureau (UTC 7 h – 15 h 30, soit la journée de travail à Paris)
    // Courriels des deux jours précédents et virement : trois jours ouvrés (virement un mercredi, jeudi ou vendredi)
    let day0 = Math.floor(w.t0 / DAY) * DAY
    while (![3, 4, 5].includes(new Date(day0 * 1000).getUTCDay())) day0 += DAY
    const mail1T = day0 - 2 * DAY + Math.round(r.float(7, 15.5) * HOUR)
    const mail2T = day0 - DAY + Math.round(r.float(7, 15.5) * HOUR)
    const mail3T = day0 + Math.round(r.float(7, 10) * HOUR)
    const wireT = mail3T + Math.round(r.float(1.5, 3) * HOUR)
    const creditT = wireT + Math.round(r.float(2, 5) * HOUR)
    const eurKept = Math.round(eurV * commissionPct) / 100
    const eurToCh = Math.round((eurV - eurKept) * 100) / 100
    const parts = r.split(eurToCh, 3, 0.4).map((x) => Math.round(x / 10) * 10)
    parts[2] = Math.round((eurToCh - parts[0] - parts[1]) * 100) / 100
    const chFee = r.float(0.012, 0.018)
    const sepaT = [creditT + Math.round(r.float(2, 6) * HOUR), wireT + Math.round(r.float(23, 29) * HOUR), wireT + Math.round(r.float(44, 50) * HOUR)]
    const usdtBought = parts.map((e) => roundAsset('USDT', e * EUR_USD * (1 - chFee)))
    // Retrait test d'une petite somme avant le premier gros retrait, sur consigne du « recruteur »
    const testV = roundAsset('USDT', r.int(2, 10) * 10)
    usdtBought[0] = roundAsset('USDT', usdtBought[0] - testV)
    const wdTestT = sepaT[0] + Math.round(r.float(0.4, 1) * HOUR)
    const wdTest = ch.withdraw(O, testV, wdTestT, 'USDT')
    const wd = usdtBought.map((u, i) => ch.withdraw(O, u, (i === 0 ? wdTestT + Math.round(r.float(0.3, 1.2) * HOUR) : sepaT[i] + Math.round(r.float(1, 3) * HOUR)), 'USDT'))
    const U = roundAsset('USDT', testV + usdtBought.reduce((s, v) => s + v, 0))

    // ── Fractionnement ───────────────────────────────────────────────────────
    const splitT = wd[2].time + Math.round(r.float(2, 5) * HOUR)
    const cnValue = roundAsset('USDT', U * r.float(0.42, 0.55))
    // TRX pour les frais des adresses Tron
    w.fundAccount(GT, roundAsset('TRX', r.float(2500, 6000)), 'TRX', w.at(-r.int(20, 30) * 24))
    const gasT1 = w.transfer({ time: splitT - Math.round(r.float(1, 3) * HOUR), from: GT, to: T1, value: r.pick([50, 80, 100, 120]), asset: 'TRX' })
    const gasT2 = w.transfer({ time: splitT - Math.round(r.float(0.5, 1) * HOUR), from: GT, to: T2, value: r.pick([30, 40, 60]), asset: 'TRX' })
    const order = cn.order({ from: O, value: cnValue, asset: 'USDT', time: splitT, toChain: 'tron', toAsset: 'USDT', recipient: T1, feePct: r.float(0.004, 0.012), delayMin: [6, 28], decoys: r.int(5, 8) })
    const cnFeePct = (1 - order.payoutValue / cnValue) * 100

    // Commission du recruteur de mules, prélevée juste avant le fractionnement
    const recruiter = w.addr('eth')
    const recruitPct = r.pick([2, 2.5, 3])
    const recruitV = roundAsset('USDT', Math.round((U * recruitPct) / 100))
    const recruitTx = w.transfer({ time: splitT - Math.round(r.float(0.5, 2) * HOUR), from: O, to: recruiter, value: recruitV, asset: 'USDT' })

    // Le reste en ERC-20 : deux dépôts sur la même adresse de dépôt que la fois précédente
    const rest = roundAsset('USDT', U + 0 - cnValue - recruitV)
    const e1a = roundAsset('USDT', rest * r.float(0.45, 0.6))
    const e1Dep1 = e1.receive(O, e1a, splitT + Math.round(r.float(1, 3) * HOUR), { asset: 'USDT', depositAddr: dep1 })
    const e1b = roundAsset('USDT', rest - e1a)
    const e1Dep2 = e1.receive(O, e1b, e1Dep1.tx.time + Math.round(r.float(2, 6) * HOUR), { asset: 'USDT', depositAddr: dep1 })
    const e1Total = roundAsset('USDT', e1a + e1b)

    // Côté Tron : une part mise de côté sur une adresse dormante, le reste réglé à un courtier OTC
    const frozenValue = roundAsset('USDT', Math.round(order.payoutValue * r.float(0.3, 0.45)))
    const toT2 = w.transfer({ time: order.payoutTx.time + Math.round(r.float(0.5, 3) * HOUR), from: T1, to: T2, value: frozenValue, asset: 'USDT' })
    const otcValue = roundAsset('USDT', order.payoutValue - frozenValue)
    const tOtc = Math.max(toT2.time, e1Dep2.tx.time, e1Dep2.sweep?.time ?? 0) + Math.round(r.float(4, 20) * HOUR)
    const otcTx = w.transfer({ time: tOtc, from: T1, to: otc, value: otcValue, asset: 'USDT' })

    // ── Habillage du réseau (après le flux : les montants ne bougent pas) ───
    // La seconde collectrice paie aussi la commission du recruteur
    const o2RecruitTx = w.transfer({ time: o2FwdT - Math.round(r.float(0.5, 1.5) * HOUR), from: O2, to: recruiter, value: o2Recruit, asset: 'USDT' })
    // Le recruteur touche aussi d'autres collectrices et dépense ailleurs
    // Le financeur de gas : alimenté par un paiement d'échangeur instantané, il prépare d'autres collectrices
    const gFromCn = w.transfer({ time: w.at(-r.float(42, 50) * 24), from: cn.hot('eth'), to: G, value: roundAsset('ETH', r.float(0.3, 0.8)), asset: 'ETH', method: 'payout' })
    const gFromCn2 = w.transfer({ time: w.at(-r.float(8, 12) * 24), from: cn.hot('eth'), to: G, value: roundAsset('ETH', r.float(0.2, 0.5)), asset: 'ETH', method: 'payout' })
    // Le financeur de TRX prépare lui aussi d'autres adresses Tron, le jour du fractionnement
    const gtOther = [r.float(-20, -4), r.float(3, 20)].map((h) => w.transfer({ time: splitT + Math.round(h * HOUR), from: GT, to: w.addr('tron'), value: r.pick([40, 50, 80, 100]), asset: 'TRX' }))
    const otherCollectors = Array.from({ length: r.int(3, 4) }, () => w.addr('eth'))
    const gOther: typeof gasTx[] = []
    for (const c of otherCollectors) {
      gOther.push(w.transfer({ time: w.at(-r.float(28, 40) * 24), from: G, to: c, value: roundAsset('ETH', r.float(0.02, 0.05)), asset: 'ETH' }))
      const tIn = gOther[gOther.length - 1].time + Math.round(r.float(1, 5) * DAY)
      const collected = roundAsset('USDT', r.int(1500, 8000) * 10)
      w.fundAccount(c, collected, 'USDT', tIn)
      w.transfer({ time: tIn + Math.round(r.float(3, 30) * HOUR), from: c, to: recruiter, value: roundAsset('USDT', Math.round(collected * r.pick([0.02, 0.025, 0.03]))), asset: 'USDT' })
    }
    // Empoisonnement d'adresse : des sosies de l'adresse du commanditaire et de l'adresse Tron envoient des montants infimes
    const oDust = dusting(w, O, { time: splitT, n: 3, spreadH: 36 })
    const t1Dust = dusting(w, T1, { time: order.payoutTx.time, n: 2, spreadH: 20 })
    // Autres clients du courtier OTC
    for (let i = 0; i < r.int(4, 6); i++) {
      const c = w.addr('tron')
      const tc = order.payoutTx.time + Math.round(r.float(-3, 4) * DAY)
      const v = roundAsset('USDT', r.float(5000, 90000))
      w.fundAccount(c, roundAsset('USDT', v * r.float(1.3, 2.5)), 'USDT', tc - Math.round(r.float(2, 48) * HOUR))
      w.transfer({ time: tc, from: c, to: otc, value: v, asset: 'USDT' })
      w.transfer({ time: tc + Math.round(r.float(2, 72) * HOUR), from: c, to: w.addr('tron'), value: roundAsset('USDT', v * r.float(0.1, 0.25)), asset: 'USDT' })
    }

    // ── Bruit de fond ────────────────────────────────────────────────────────
    ch.noise(14, w.at(-6 * 24), w.at(6 * 24), 'USDT')
    ch.noise(8, w.at(-6 * 24), w.at(6 * 24), 'ETH')
    e1.noise(14, w.at(-14 * 24), w.at(6 * 24), 'USDT')
    kr.noise(8, w.at(-14 * 24), w.at(-8 * 24), 'USDT')
    // Autres clients de ChangeNOW (commandes ERC-20 → TRC-20 ou ETH → TRX)
    for (let i = 0; i < r.int(6, 9); i++) {
      const c = w.addr('eth')
      const t = splitT + Math.round(r.float(-2, 2) * DAY)
      if (r.chance(0.6)) {
        const v = roundAsset('USDT', r.float(800, 40000))
        w.fundAccount(c, v, 'USDT', t - r.int(2, 48) * HOUR)
        cn.order({ from: c, value: v, asset: 'USDT', time: t, toChain: 'tron', toAsset: 'USDT', recipient: w.addr('tron'), decoys: r.int(0, 2) })
      } else {
        const v = roundAsset('ETH', r.float(0.3, 6))
        w.fundAccount(c, v, 'ETH', t - r.int(2, 48) * HOUR)
        cn.order({ from: c, value: v, asset: 'ETH', time: t, toChain: 'tron', toAsset: 'TRX', recipient: w.addr('tron'), decoys: r.int(0, 2) })
      }
    }

    const plainteT = office(wireT + Math.round(r.float(80, 100) * HOUR))
    const reqT = office(plainteT + Math.round(r.float(4, 7) * DAY))
    const releveT = office(plainteT + 2 * DAY)
    const kbisT = office(plainteT + DAY)
    // Chronologie de la société écran : annonce → immatriculation → compte bancaire → compte Coinhouse
    const regT = adT + r.int(6, 12) * DAY
    const bankOpenT = regT + Math.round((openT - regT) * r.float(0.3, 0.7))
    const gerant = gm('gérant', 'gérante')
    const leGerant = gm('le gérant', 'la gérante')
    const invoice = `F-${new Date(wireT * 1000).getUTCFullYear()}-${r.int(1000, 9999)}`
    const ceoMail = `${slug(ceo)}@${company.domain}`
    const fakeMail = `${slug(ceo)}@${fakeDomain}`
    const acctMail = `${slug(acct)}@${company.domain}`
    const birthYear = r.int(1979, 2002)
    const muleLabel = `${gm('M.', 'Mme')} ${mule.name}`
    const companyLabel = `SAS ${company.name}`
    const pct = (v: number) => `${Math.round((v / U) * 100)} %`

    return {
      world: w,
      title: `Fraude au président — ${company.name} (${city})`,
      briefing:
        `${companyLabel}, PME de ${company.staff} salariés spécialisée dans ${company.activity} à ${city}, a déposé plainte pour escroquerie. ${acct.name}, comptable de la société, a reçu plusieurs courriels de ${gc('son président', 'sa présidente')}, ${ceo.name}, puis l'appel d'un prétendu avocat : une acquisition confidentielle imposait de régler sans délai la facture d'un « nouveau fournisseur » associé à l'opération. ${ga('Il', 'Elle')} a exécuté un virement de ${eur(eurV)}.\n\n` +
        `${gc('Le président', 'La présidente')} n'avait rien demandé : les courriels venaient d'un domaine sosie, et le fournisseur n'existe pas. Le compte bénéficiaire, ouvert chez ${bankName} (néobanque, nom fictif), est celui de l'${shellLabel}, société immatriculée quelques semaines plus tôt, dont ${leGerant}, ${muleLabel}, est ${gm('domicilié', 'domiciliée')} à ${muleCity}. Les fonds en ont été retirés en quelques jours vers le compte professionnel de la société chez Coinhouse, où ils ont servi à acheter des USDT sur Ethereum.\n\n` +
        `La réquisition adressée à Coinhouse vient d'aboutir. À vous de suivre les USDT depuis le compte de la société écran : retrouvez l'adresse du commanditaire, triez ses sorties (recruteur, échangeur, exchange, poussière), suivez la branche Tron jusqu'à sa sortie, localisez ce qui peut encore être gelé, puis qualifiez le rôle de ${muleLabel}.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: `Plainte de la ${companyLabel} (extrait)`, date: plainteT, author: `${ceo.name}, ${gc('président', 'présidente')}`,
          body:
            `« Je dépose plainte au nom de la société. Le ${fmtDate(wireT, false)}, notre comptable, ${acct.name}, a viré ${eur(eurV)} depuis notre compte professionnel (${companyIban}) vers le compte ${muleIban} de l'${shellLabel}, référence « Facture ${invoice} — acompte ». Nous n'avons jamais travaillé avec cette société.\n\n` +
            `${ga('Il', 'Elle')} pensait obéir à mes instructions : des courriels « confidentiels » signés de mon nom et un appel de ${lawyer}, prétendu avocat d'affaires. J'étais en déplacement et je n'ai jamais donné cet ordre. Nous avons découvert la fraude ${Math.round((plainteT - wireT) / DAY)} jours plus tard, à mon retour ; le rappel de fonds demandé à notre banque est resté sans effet. »`,
        },
        {
          id: 'emails', type: 'email', title: 'Échange de courriels avec le « président »', date: mail3T, author: `${ceo.name} <${fakeMail}>`,
          body:
            `De : ${ceo.name} <${fakeMail}>\nÀ : ${acct.name} <${acctMail}>\nDate : ${fmtDate(mail1T)}\nObjet : Dossier confidentiel\n\n« ${acct.name.split(' ')[0]}, êtes-vous disponible cette semaine ? Je mène une opération de croissance externe soumise à une stricte confidentialité (AMF). N'en parlez à personne, y compris au sein de la direction. Vous serez contacté${ga('', 'e')} par ${lawyer}. »\n\n` +
            `— ${fmtDate(mail2T)} —\n« Merci pour votre discrétion. ${lawyer} vous confirmera les modalités par téléphone. Je compte sur vous. »\n\n` +
            `— ${fmtDate(mail3T)} —\n« La facture de notre nouveau fournisseur sur ce dossier doit être réglée aujourd'hui, avant la clôture. Bénéficiaire : ${shellLabel}. IBAN : ${muleIban}. Montant : ${eur(eurV)}. Merci de me confirmer l'exécution par retour. »\n[Pièce jointe : facture ${invoice}, ${shellLabel}, « prestations d'intégration et d'audit — acompte 40 % »]\n\n` +
            `[Note de l'enquêteur : l'adresse authentique ${gc('du président', 'de la présidente')} est ${ceoMail}. Le domaine de l'expéditeur, ${fakeDomain}, remplace le « m » par « rn » ; il a été enregistré ${r.int(5, 12)} jours avant le premier courriel.]`,
        },
        {
          id: 'releve', type: 'rapport', title: `Relevé du compte bénéficiaire — ${bankName} (sur réquisition)`, date: releveT, author: `${bankName} — Service des réquisitions`,
          body:
            `Titulaire : ${shellLabel} (SIREN ${siren}), représentée par ${mule.name}, ${gerant} — IBAN ${muleIban} — compte ouvert le ${fmtDate(bankOpenT, false)}\n\n` +
            `${fmtDate(creditT)} · VIR SEPA REÇU · ${companyLabel} · « Facture ${invoice} — acompte » · crédit ${eur(eurV)}\n` +
            parts.map((p, i) => `${fmtDate(sepaT[i])} · VIR SEPA ÉMIS · COINHOUSE (compte client) · débit ${eur(p)}`).join('\n') +
            `\n\nSolde au ${fmtDate(releveT, false)} : ${eur(eurKept + r.int(40, 900))}. Compte bloqué à titre conservatoire à réception de la réquisition. Aucun autre mouvement significatif dans la période.`,
        },
        {
          id: 'coinhouse', type: 'note', title: 'Réponse de Coinhouse à réquisition judiciaire', date: reqT, author: 'Coinhouse — Service conformité',
          body:
            `Titulaire : compte professionnel de l'${shellLabel} (SIREN ${siren}, extrait Kbis fourni), représentée par ${gm('son gérant', 'sa gérante')} ${mule.name}, ${gm('né', 'née')} en ${birthYear}, ${gm('domicilié', 'domiciliée')} à ${muleCity}. Vérification d'identité du représentant : carte nationale d'identité authentique, selfie de vivacité conforme. Compte ouvert le ${fmtDate(openT, false)}. Activité déclarée : « négoce et prestations de services ».\n` +
            `Moyen de paiement lié : IBAN ${muleIban} (${bankName}).\n\n` +
            `Dépôts en euros : ${parts.map((p, i) => `${eur(p)} le ${fmtDate(sepaT[i], false)}`).join(', ')}. Chaque dépôt a été intégralement converti en USDT (réseau Ethereum) puis retiré dans l'heure ou les heures suivantes vers une adresse externe.\n\n` +
            `Carnet d'adresses de retrait :\n• ${A(w, P)} — ajoutée le ${fmtDate(pAddedT, false)}, libellé « mon wallet »\n• ${A(w, O)} — ajoutée le ${fmtDate(oAddedT, false)}, libellé « wallet société »\n\n` +
            `Connexions : adresses IP d'un fournisseur d'accès grand public, géolocalisées à ${muleCity}, sur un appareil unique ; aucune connexion par VPN. Le compte est gelé ; solde résiduel nul. Les hash des retraits figureront dans le relevé complet.`,
        },
        {
          id: 'annonce', type: 'capture', title: 'Annonce d\'emploi conservée par la mule (capture)', date: adT, author: shell,
          body:
            `${shell} — Agent(e) de paiement H/F — 100 % télétravail\n\n` +
            `Cabinet international de règlement, nous recherchons des agents en France pour traiter les paiements de nos clients européens.\nMissions : réceptionner les règlements sur votre compte personnel, les convertir en USDT via une plateforme agréée, puis les transférer vers le portefeuille de la société.\n` +
            `Rémunération : 1 800 € par mois + ${commissionPct} % des montants traités. Aucune expérience requise, formation assurée par WhatsApp. Pour des raisons fiscales, nous vous accompagnons dans la création de votre propre société (frais pris en charge).\nPièces demandées : CNI, justificatif de domicile, RIB.`,
        },
        {
          id: 'kbis', type: 'osint', title: `Annonces légales et registre : ${shellLabel}`, date: kbisT, author: 'Cellule d\'appui',
          body:
            `${shellLabel} — SIREN ${siren} — capital social : 1 € — immatriculée le ${fmtDate(regT, false)}.\n` +
            `Siège : société de domiciliation commerciale à ${muleCity}. Objet : « négoce de biens, conseil et prestations de services aux entreprises ». ${gm('Gérant et associé unique', 'Gérante et associée unique')} : ${mule.name}.\n` +
            `Aucun salarié, aucun dépôt de comptes, aucun site internet. Les formalités de création ont été effectuées en ligne par un prestataire, réglées par carte bancaire au nom de ${shell}.\n\n` +
            `Note : une société écran créée au nom d'un tiers recruté (« gérant de paille ») donne à un virement frauduleux l'apparence d'un règlement fournisseur, ce qui retarde les alertes bancaires.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Vers quelle adresse Ethereum, fournie par le commanditaire, la mule a-t-elle retiré les USDT achetés avec les fonds de la société ?',
          answer: [O],
          hint: 'Le carnet d\'adresses de Coinhouse en cite deux : vérifiez laquelle reçoit des USDT du hot wallet Coinhouse après le virement.',
          explanation:
            `${A(w, O)} reçoit d'abord un retrait test de ${amt(testV, 'USDT')} (${fmtDate(wdTest.time)}), puis trois retraits d'USDT du hot wallet Coinhouse, les ${wd.map((t) => fmtDate(t.time)).join(', ')}, chacun quelques heures après un dépôt en euros. L'autre adresse du carnet, ${A(w, P)}, n'a reçu qu'un petit retrait de ${amt(pTest.transfers[0].value, 'ETH')} à l'ouverture du compte (portefeuille personnel ${gm('du gérant', 'de la gérante')}, sans lien avec les fonds). ` +
            `${A(w, O)} n'est pas une adresse neuve : elle reçoit son ETH de gas de ${A(w, G)} et a déjà reçu ${amt(krValue, 'USDT')} d'un retrait Kraken ${Math.round((wd[0].time - krT) / DAY)} jours plus tôt, signe qu'elle collecte pour plusieurs mules. Les micro-transferts reçus d'adresses qui lui ressemblent (mêmes premiers et derniers caractères) sont de l'empoisonnement d'adresse, sans lien avec les fonds.`,
        },
        {
          id: 'o2', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT la mule a-t-elle achetés puis retirés vers cette adresse (total des retraits Coinhouse) ?',
          answer: U,
          hint: 'Additionnez tous les transferts d\'USDT reçus du hot wallet Coinhouse après le virement, petit retrait test compris ; le retrait Kraken antérieur et la poussière n\'appartiennent pas à cette affaire.',
          explanation:
            `${[testV, ...usdtBought].map((v) => amt(v, 'USDT')).join(' + ')} = ${amt(U, 'USDT')} : le premier, de quelques dizaines d'USDT, est un retrait test (on vérifie que l'adresse fonctionne avant d'envoyer le gros des fonds), prélevé sur le premier achat. Cohérence avec les euros : ${eur(eurToCh)} versés à Coinhouse (le virement de ${eur(eurV)} moins ${eur(eurKept)}, soit ${commissionPct} % conservés par ${leGerant}, sa « commission »), convertis à environ ${EUR_USD.toLocaleString('fr-FR')} $ par euro, frais de la plateforme déduits (≈ ${(chFee * 100).toFixed(1).replace('.', ',')} %).`,
        },
        {
          id: 'o3', type: 'entity', points: 8,
          prompt: 'Quel service a fait passer une partie des USDT d\'Ethereum (ERC-20) vers Tron (TRC-20) ?',
          answer: ['changenow'],
          hint: 'Une sortie de l\'adresse du commanditaire aboutit sur une adresse de dépôt aussitôt balayée vers un hot wallet : regardez son étiquette.',
          explanation:
            `${A(w, O)} envoie ${amt(cnValue, 'USDT')} (${pct(cnValue)} du total) sur une adresse de dépôt ChangeNOW (transaction ${order.depositTx.hash}). L'échangeur paie l'équivalent en USDT TRC-20 depuis son hot wallet Tron : le lien entre les deux chaînes n'existe pas on-chain, il se retrouve par corrélation montant/temps. Les escrocs privilégient l'USDT sur Tron pour ses frais très bas et sa liquidité chez les courtiers. ${procedureFor(cn.entity)}`,
        },
        {
          id: 'o11', type: 'tx', points: 9,
          prompt: 'Quelle transaction, sur Tron, correspond au paiement de ChangeNOW pour la commande du commanditaire ?',
          answer: [order.payoutTx.id],
          hint: 'Sélectionnez le dépôt ChangeNOW côté Ethereum et lancez le corrélateur sur Tron : émetteur ChangeNOW, USDT, montant voisin diminué des frais, dans l\'heure qui suit.',
          explanation: `La transaction ${order.payoutTx.hash.slice(0, 16)}… paie ${amt(order.payoutValue, 'USDT')} à ${A(w, T1)} ${Math.round((order.payoutTx.time - order.depositTx.time) / 60)} minutes après le dépôt de ${amt(cnValue, 'USDT')}. D'autres paiements ChangeNOW tombent dans la même fenêtre, parfois de montant proche : le bon candidat est celui dont le destinataire poursuit le circuit (financement en TRX par l'opérateur juste avant, transfert vers une adresse financée par le même portefeuille, puis règlement à un courtier OTC). Au procès-verbal, ce lien reste une corrélation : il se confirme par réquisition à ChangeNOW (identifiant de commande, adresse de destination déclarée).`,
        },
        {
          id: 'o4', type: 'address', points: 10,
          prompt: 'Sur quelle adresse de dépôt d\'exchange la part restée en ERC-20 a-t-elle été déposée ?',
          answer: [dep1],
          hint: 'Triez les sorties d\'USDT de l\'adresse du commanditaire postérieures au virement : une vers ChangeNOW, une petite vers une adresse non attribuée, et deux vers une même adresse de dépôt aussitôt balayée.',
          explanation:
            `${amt(e1a, 'USDT')} puis ${amt(e1b, 'USDT')} (${amt(e1Total, 'USDT')}) sont déposés sur ${A(w, dep1)}, adresse de dépôt ${e1.entity.name} — la même qui avait reçu les USDT issus de Kraken et ceux d'une seconde collectrice : c'est un compte du réseau, réutilisé. ${procedureFor(e1.entity)} La plateforme peut geler le compte de son client et fournir KYC, IP et historique. ` +
            `Les autres sorties ne sont pas des dépôts d'exchange : ${amt(cnValue, 'USDT')} partent chez ChangeNOW (passage vers Tron), et ${amt(recruitV, 'USDT')} (${recruitPct.toLocaleString('fr-FR')} % du total, juste avant le fractionnement) vont à ${A(w, recruiter).slice(0, 12)}…, adresse non attribuée qui reçoit des montants proportionnels de plusieurs collectrices : la commission du recruteur de mules.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Sur quelle adresse dorment encore des USDT gelables par leur émetteur ?',
          answer: [T2],
          hint: 'Suivez les sorties d\'USDT de l\'adresse Tron payée par ChangeNOW : l\'une va vers un service attribué, l\'autre vers une adresse qui ne bouge plus.',
          explanation:
            `${A(w, T1)} envoie ${amt(frozenValue, 'USDT')} à ${A(w, T2)}, qui n'a plus bougé depuis le ${fmtDate(toT2.time)}. ${A(w, T2)} a reçu ses TRX de ${A(w, GT)}, le même financeur que ${A(w, T1)} : les deux adresses relèvent du même opérateur. ${procedureFor(tether)} C'est l'urgence n° 1 : un gel Tether préserve les fonds en quelques heures, avant la saisie pénale proprement dite.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT peut être gelé sur cette adresse ?',
          answer: frozenValue,
          hint: 'Ouvrez l\'adresse dormante : son solde en USDT TRC-20 est le montant encore entre les mains du réseau, donc gelable par l\'émetteur.',
          explanation:
            `${amt(frozenValue, 'USDT')}, soit ${pct(frozenValue)} des USDT achetés. Le reste est à rechercher sur le compte ${e1.entity.name} (${amt(e1Total, 'USDT')}), dont le gel dépend de la réactivité de la plateforme ; les ${amt(otcValue, 'USDT')} réglés au courtier OTC ont été convertis en espèces hors chaîne et ne sont plus gelables on-chain. Les micro-transferts reçus par l'adresse Tron payée par ChangeNOW (sosies) ne changent rien au calcul. Côté euros, la commission conservée par ${leGerant} (${eur(eurKept)}) est bloquée chez ${bankName}.`,
        },
        {
          id: 'o13', type: 'entity', points: 9,
          prompt: 'Vers quel prestataire part la plus grosse part des USDT TRC-20, en dernier ?',
          answer: ['satsdesk'],
          hint: 'Sur l\'adresse Tron payée par ChangeNOW, cherchez la dernière sortie d\'USDT : son destinataire est attribué.',
          explanation: `Le ${fmtDate(otcTx.time)}, après tous les autres mouvements, ${A(w, T1)} envoie ${amt(otcValue, 'USDT')} au portefeuille de règlement de SatsDesk OTC, courtier de gré à gré qui remet des espèces (ou un virement depuis une autre juridiction) contre des USDT. Ce portefeuille reçoit dans les mêmes jours les règlements d'autres clients, de toutes tailles : c'est une adresse de service, pas un complice. ${procedureFor(satsdesk)} Le règlement OTC est la vraie sortie du butin : il faudra la documenter (hash, montant, horodatage) et la signaler, sans attendre de réponse rapide.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Quelle adresse Ethereum a fourni à l\'adresse du commanditaire l\'ETH nécessaire au paiement de ses frais (gas) ?',
          answer: [G],
          hint: 'Une adresse qui ne reçoit que des jetons ne peut pas les déplacer : elle a besoin d\'ETH. Cherchez la première transaction entrante en ETH de l\'adresse du commanditaire.',
          explanation: `${A(w, G)} envoie ${amt(gasTx.transfers[0].value, 'ETH')} à ${A(w, O)} le ${fmtDate(gasTx.time)}, avant toute arrivée d'USDT. Le financeur de gas est un pivot classique sur les chaînes à comptes : c'est le portefeuille « de service » de l'opérateur, qui prépare ses adresses de collecte. Il ne détient pas les fonds de la fraude, mais il relie entre elles des adresses qui, sans lui, paraîtraient indépendantes.`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Ce financeur de gas alimente une autre adresse collectrice du réseau. Laquelle ?',
          answer: [O2],
          hint: 'Dépliez les sorties en ETH du financeur de gas, puis regardez ce que reçoit chaque bénéficiaire.',
          explanation: `${A(w, G)} finance aussi ${A(w, O2)} (${amt(gasO2.transfers[0].value, 'ETH')} le ${fmtDate(gasO2.time, false)}). Cette adresse reçoit ensuite des USDT du hot wallet Coinhouse, verse ${o2RecruitPct.toLocaleString('fr-FR')} % au même recruteur que l'adresse du commanditaire (${A(w, recruiter).slice(0, 12)}…), puis dépose le reste sur ${A(w, dep1)}, la même adresse de dépôt ${e1.entity.name} : même financeur, même recruteur, même compte de sortie. Les ${otherCollectors.length} autres adresses financées en gas par ${A(w, G).slice(0, 10)}… ne reçoivent pas d'USDT de Coinhouse : elles collectent ailleurs. C'est très probablement la collecte d'une autre mule, donc d'une autre victime de fraude au président ou d'escroquerie apparentée.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT cette seconde adresse collectrice a-t-elle reçus de Coinhouse ?',
          answer: o2Total,
          hint: 'Additionnez les transferts d\'USDT reçus du hot wallet Coinhouse par cette adresse, avant son dépôt sur l\'exchange.',
          explanation: `${o2In.length > 1 ? `${o2In.map((t) => amt(t.transfers[0].value, 'USDT')).join(' + ')} = ` : ''}${amt(o2Total, 'USDT')}, retirés de Coinhouse ${o2In.length > 1 ? 'les ' + o2In.map((t) => fmtDate(t.time, false)).join(' et ') : 'le ' + fmtDate(o2In[0].time, false)}, puis répartis entre la commission du recruteur (${amt(o2Recruit, 'USDT')}) et un dépôt chez ${e1.entity.name} (${amt(o2Total - o2Recruit, 'USDT')}). Ce montant chiffre un préjudice distinct de celui de ${companyLabel}, qui pourrait correspondre à une plainte déjà enregistrée ailleurs : il justifie un rapprochement via les fichiers de procédure et les signalements de fraude au président.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelle suite donner à la découverte de la seconde adresse collectrice ?',
          ...choice(r,
            'Requérir Coinhouse sur les retraits vers cette adresse pour identifier la seconde mule, et rapprocher le dossier des plaintes de fraude au président correspondantes',
            [
              'Demander à Tether de geler les USDT de cette adresse',
              'L\'ignorer : elle est antérieure aux faits et sans rapport avec la plainte de la société',
              'Requérir directement la mule de la présente affaire, qui a forcément alimenté cette adresse',
            ]),
          hint: 'Que reste-t-il sur cette adresse aujourd\'hui ? Qui connaît l\'identité de celui qui l\'a alimentée ?',
          explanation: `L'adresse a déjà tout transféré vers ${e1.entity.name} : il n'y a plus rien à geler chez Tether. Elle n'est pas hors sujet pour autant : même financeur, même recruteur, même dépôt de sortie, donc même réseau. Coinhouse sait quel client a ordonné ces retraits (KYC, IBAN lié, carnet d'adresses), ce qui identifie une seconde mule et, par son relevé bancaire, une autre victime. Rien n'indique ${/^[AEÉÈIOUYH]/i.test(mule.name) ? 'qu\'' : 'que '}${mule.name} soit à l'origine de ces retraits : son carnet d'adresses ne contient pas cette adresse.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: `Comment qualifier, à ce stade, le rôle de ${muleLabel} ?`,
          ...choice(r,
            `Mule à entendre rapidement : ${gm('il', 'elle')} a agi sous sa vraie identité, sur instruction d'un tiers ; sa connaissance de l'origine frauduleuse des fonds (blanchiment) reste à établir`,
            [
              `Auteur principal de l'escroquerie : son identité KYC suffit à ${gm('le', 'la')} poursuivre comme organisateur de la fraude au président`,
              `Simple victime d'une offre d'emploi : aucune audition n'est utile, son volet peut être classé`,
              `${gm('Complice certain', 'Complice certaine')} : le seul fait d'avoir reçu le virement prouve qu'${gm('il', 'elle')} connaissait l'origine des fonds`,
            ]),
          hint: 'Relisez la réponse de Coinhouse et l\'annonce d\'emploi : sous quelle identité la mule a-t-elle agi, et qu\'est-ce qui reste à établir pour engager sa responsabilité ?',
          explanation:
            `Tout désigne une mule recrutée par une fausse offre d'emploi et placée en ${gerant} de paille de l'${shellLabel} : vraie CNI, IP de son domicile, société créée par un prestataire payé par ${shell}, libellé « wallet société » pour l'adresse fournie, commission de ${commissionPct} % prévue par l'annonce. ${gm('Il', 'Elle')} n'est pas ${gm('l\'organisateur', 'l\'organisatrice')}, mais ${gm('il', 'elle')} n'est pas pour autant hors de cause : prêter son compte et convertir des fonds sans justification peut constituer un blanchiment (art. 324-1 du code pénal) si l'on établit qu'${gm('il', 'elle')} connaissait ou ne pouvait ignorer leur origine. Son audition est prioritaire : contacts WhatsApp, numéro du « recruteur », instructions reçues, autres comptes ouverts, et éventuellement les identifiants d'autres mules (comme celle du retrait Kraken).`,
        },
      ],
      truth: {
        path: [wdTest.id, ...wd.map((t) => t.id), order.depositTx.id, order.payoutTx.id, e1Dep1.tx.id, e1Dep2.tx.id, gasT1.id, gasT2.id, toT2.id, otcTx.id, gasTx.id, krTx.id, krFwd.tx.id, gasO2.id, ...o2In.map((t) => t.id), o2Fwd.tx.id],
        addresses: [O, G, O2, dep1, order.deposit, T1, T2, GT, recruiter, otc],
        debrief:
          `1. Courriels depuis le domaine sosie ${fakeDomain}, appel de « ${lawyer} » : le ${fmtDate(wireT, false)}, ${acct.name} règle ${eur(eurV)} à un prétendu nouveau fournisseur, l'${shellLabel}, société écran dont ${leGerant}, ${mule.name}, a été ${gm('recruté', 'recrutée')} ${Math.round((wireT - adT) / DAY)} jours plus tôt par une fausse offre d'emploi d'« agent de paiement » publiée par ${shell}.\n` +
          `2. ${gm('Le gérant', 'La gérante')} garde ${eur(eurKept)} (${commissionPct} %), verse ${eur(eurToCh)} à Coinhouse en trois virements, achète ${amt(U, 'USDT')} et les retire vers ${A(w, O)}, l'adresse fournie par le commanditaire, après un retrait test de ${amt(testV, 'USDT')}.\n` +
          `3. Le commanditaire verse ${amt(recruitV, 'USDT')} (${recruitPct.toLocaleString('fr-FR')} %) au recruteur ${A(w, recruiter)}, puis fractionne : ${amt(cnValue, 'USDT')} partent chez ChangeNOW (ERC-20 → TRC-20), ${amt(e1Total, 'USDT')} sont déposés en deux fois sur ${e1.entity.name} (${A(w, dep1)}), adresse de dépôt déjà utilisée pour les fonds d'autres mules.\n` +
          `4. Sur Tron, ${A(w, T1)} reçoit ${amt(order.payoutValue, 'USDT')}, met ${amt(frozenValue, 'USDT')} de côté sur ${A(w, T2)}, où ils dorment, et règle en dernier ${amt(otcValue, 'USDT')} à SatsDesk OTC : fin du suivi on-chain, sortie en espèces chez un courtier peu coopératif.\n` +
          `5. Le réseau : ${A(w, G)}, lui-même alimenté notamment par des paiements ChangeNOW, finance en gas l'adresse du commanditaire, une seconde collectrice, ${A(w, O2)} (${amt(o2Total, 'USDT')} reçus d'une autre mule via Coinhouse, commission au même recruteur, dépôt sur le même compte ${e1.entity.name}), et ${otherCollectors.length} autres adresses. Avec le retrait Kraken antérieur, au moins trois mules alimentent ce compte de sortie.\n\n` +
          `Fausses pistes : le portefeuille personnel ${gm('du gérant', 'de la gérante')} (« mon wallet »), la poussière envoyée par des adresses sosies, les paiements ChangeNOW de montant voisin à d'autres clients, la commission du recruteur (une piste, pas la sortie du butin).\n\n` +
          `À retenir : la fraude au président est une escroquerie « hors chaîne » qui devient traçable dès que la société écran convertit les fonds chez un prestataire régulé. L'ordre des actes compte : gel Tether sur ${A(w, T2)} et demande de gel à ${e1.entity.name} d'abord, réquisitions (KYC, IP, historique) ensuite, audition ${gm('du gérant', 'de la gérante')} enfin ; le règlement OTC se documente et se signale. L'USDT n'est pas « anonyme » : centralisé, il se gèle sur Ethereum comme sur Tron.`,
      },
      hints: [
        'Partez de la réponse de Coinhouse : des deux adresses du carnet, une seule reçoit des USDT après le virement. Dépliez ensuite ses sorties d\'USDT.',
        'La part envoyée à ChangeNOW ne se suit pas on-chain : sélectionnez le dépôt et corrélez côté Tron (émetteur ChangeNOW, USDT, fenêtre d\'une heure, tolérance ≈ 2 %).',
        'L\'adresse Tron payée par ChangeNOW reçoit d\'abord des TRX pour ses frais ; ses deux sorties d\'USDT mènent l\'une à une adresse qui ne bouge plus, l\'autre, en dernier, à un courtier.',
        'Pour cartographier le réseau, remontez l\'ETH de gas de l\'adresse du commanditaire : son financeur alimente d\'autres adresses.',
      ],
    }
  },
}
