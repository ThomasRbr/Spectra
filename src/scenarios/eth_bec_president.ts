import { World } from '../engine/world'
import { exchange, swapper, HOUR, DAY } from '../engine/patterns'
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
  tagline: 'Un faux PDG, un virement de plusieurs centaines de milliers d\'euros, une mule et des USDT éclatés entre Ethereum et Tron.',
  description:
    'La comptable d\'une PME a viré une somme importante sur ordre d\'un faux PDG. Le compte bénéficiaire appartient à une mule recrutée par une fausse offre d\'emploi, qui a converti les fonds en USDT chez Coinhouse. Retrouvez l\'adresse du commanditaire, suivez les USDT d\'Ethereum à Tron, localisez les plateformes de sortie et les fonds encore gelables, et qualifiez le rôle de la mule.',
  difficulty: 2,
  chains: ['eth', 'tron'],
  skills: ['tokens', 'tron', 'exchange_id', 'requisition', 'gel', 'typologies'],
  estMinutes: 45,
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
    const commissionPct = r.pick([4, 5, 6])
    const bankName = 'Orfélia Banque'
    const muleIban = fakeIban(w)
    const companyIban = fakeIban(w)

    // ── Acteurs on-chain ─────────────────────────────────────────────────────
    const ch = exchange(w, 'coinhouse', 'eth')
    const [k1, k2] = r.shuffle(['okx', 'binance'] as const)
    const e1 = exchange(w, k1, 'eth') // sortie directe en USDT ERC-20
    const e2 = exchange(w, k2, 'tron') // sortie en USDT TRC-20 après ChangeNOW
    const kr = exchange(w, 'kraken', 'eth')
    const cn = swapper(w, 'changenow')
    const tether = w.entity('tether')

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
    const o2Fwd = e1.receive(O2, o2Total, o2In[o2In.length - 1].time + Math.round(r.float(2, 8) * HOUR), { asset: 'USDT', depositAddr: dep1 })

    // ── La fraude : courriels, virement, conversion ─────────────────────────
    const eurV = Math.round(r.float(180000, 450000) / 10) * 10 + r.pick([0, 0.5, 0.8])
    // Heures de bureau (UTC 7 h – 15 h 30, soit la journée de travail à Paris)
    const day0 = Math.floor(w.t0 / DAY) * DAY
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
    const wd = usdtBought.map((u, i) => ch.withdraw(O, u, sepaT[i] + Math.round(r.float(1, 3) * HOUR), 'USDT'))
    const U = roundAsset('USDT', usdtBought.reduce((s, v) => s + v, 0))

    // ── Fractionnement ───────────────────────────────────────────────────────
    const splitT = wd[2].time + Math.round(r.float(2, 5) * HOUR)
    const cnValue = roundAsset('USDT', U * r.float(0.42, 0.55))
    // TRX pour les frais des adresses Tron
    w.fundAccount(GT, roundAsset('TRX', r.float(2500, 6000)), 'TRX', w.at(-r.int(20, 30) * 24))
    const gasT1 = w.transfer({ time: splitT - Math.round(r.float(1, 3) * HOUR), from: GT, to: T1, value: r.pick([50, 80, 100, 120]), asset: 'TRX' })
    const gasT2 = w.transfer({ time: splitT - Math.round(r.float(0.5, 1) * HOUR), from: GT, to: T2, value: r.pick([30, 40, 60]), asset: 'TRX' })
    const order = cn.order({ from: O, value: cnValue, asset: 'USDT', time: splitT, toChain: 'tron', toAsset: 'USDT', recipient: T1, feePct: r.float(0.004, 0.012), delayMin: [6, 28], decoys: r.int(5, 8) })
    const cnFeePct = (1 - order.payoutValue / cnValue) * 100

    // Le reste en ERC-20 : deux dépôts sur la même adresse de dépôt que la fois précédente
    const rest = w.balanceOf(O, 'USDT')
    const e1a = roundAsset('USDT', rest * r.float(0.45, 0.6))
    const e1Dep1 = e1.receive(O, e1a, splitT + Math.round(r.float(1, 3) * HOUR), { asset: 'USDT', depositAddr: dep1 })
    const e1b = w.balanceOf(O, 'USDT')
    const e1Dep2 = e1.receive(O, e1b, e1Dep1.tx.time + Math.round(r.float(2, 6) * HOUR), { asset: 'USDT', depositAddr: dep1 })
    const e1Total = e1a + e1b

    // Côté Tron : une part vers l'exchange, le reste vers une adresse dormante
    const e2Value = roundAsset('USDT', order.payoutValue * r.float(0.5, 0.65))
    const e2Dep = e2.receive(T1, e2Value, order.payoutTx.time + Math.round(r.float(1, 4) * HOUR), { asset: 'USDT' })
    const frozenValue = w.balanceOf(T1, 'USDT')
    const toT2 = w.transfer({ time: e2Dep.tx.time + Math.round(r.float(0.3, 2) * HOUR), from: T1, to: T2, value: frozenValue, asset: 'USDT' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    ch.noise(14, w.at(-6 * 24), w.at(6 * 24), 'USDT')
    ch.noise(8, w.at(-6 * 24), w.at(6 * 24), 'ETH')
    e1.noise(14, w.at(-14 * 24), w.at(6 * 24), 'USDT')
    e2.noise(14, w.at(-4 * 24), w.at(6 * 24), 'USDT')
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

    const plainteT = wireT + Math.round(r.float(80, 100) * HOUR)
    const reqT = plainteT + Math.round(r.float(4, 7) * DAY)
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
        `${companyLabel}, PME de ${company.staff} salariés spécialisée dans ${company.activity} à ${city}, a déposé plainte pour escroquerie. ${acct.name}, comptable de la société, a reçu plusieurs courriels de ${gc('son président', 'sa présidente')}, ${ceo.name}, puis l'appel d'un prétendu avocat : une acquisition confidentielle imposait de verser sans délai un acompte. ${ga('Il', 'Elle')} a exécuté un virement de ${eur(eurV)}.\n\n` +
        `${gc('Le président', 'La présidente')} n'avait rien demandé : les courriels venaient d'un domaine sosie. Le compte bénéficiaire, ouvert chez ${bankName} (néobanque, nom fictif), est au nom d'un particulier, ${muleLabel}, ${gm('domicilié', 'domiciliée')} à ${muleCity}. Les fonds en ont été retirés en quelques jours vers Coinhouse, où ils ont servi à acheter des USDT sur Ethereum.\n\n` +
        `La réquisition adressée à Coinhouse vient d'aboutir. À vous de suivre les USDT depuis le compte de la mule : retrouvez l'adresse du commanditaire, les plateformes de sortie et ce qui peut encore être gelé, puis qualifiez le rôle de ${muleLabel}.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: `Plainte de la ${companyLabel} (extrait)`, date: plainteT, author: `${ceo.name}, ${gc('président', 'présidente')}`,
          body:
            `« Je dépose plainte au nom de la société. Le ${fmtDate(wireT, false)}, notre comptable, ${acct.name}, a viré ${eur(eurV)} depuis notre compte professionnel (${companyIban}) vers le compte ${muleIban} ouvert au nom ${de(mule.name)}, référence « Acompte acquisition — ${invoice} ».\n\n` +
            `${ga('Il', 'Elle')} pensait obéir à mes instructions : des courriels « confidentiels » signés de mon nom et un appel de ${lawyer}, prétendu avocat d'affaires. J'étais en déplacement et je n'ai jamais donné cet ordre. Nous avons découvert la fraude ${Math.round((plainteT - wireT) / DAY)} jours plus tard, à mon retour ; le rappel de fonds demandé à notre banque est resté sans effet. »`,
        },
        {
          id: 'emails', type: 'email', title: 'Échange de courriels avec le « président »', date: mail3T, author: `${ceo.name} <${fakeMail}>`,
          body:
            `De : ${ceo.name} <${fakeMail}>\nÀ : ${acct.name} <${acctMail}>\nDate : ${fmtDate(mail1T)}\nObjet : Dossier confidentiel\n\n« ${acct.name.split(' ')[0]}, êtes-vous disponible cette semaine ? Je mène une opération de croissance externe soumise à une stricte confidentialité (AMF). N'en parlez à personne, y compris au sein de la direction. Vous serez contacté${ga('', 'e')} par ${lawyer}. »\n\n` +
            `— ${fmtDate(mail2T)} —\n« Merci pour votre discrétion. ${lawyer} vous confirmera les modalités par téléphone. Je compte sur vous. »\n\n` +
            `— ${fmtDate(mail3T)} —\n« L'acompte doit partir aujourd'hui, avant la clôture. Bénéficiaire : ${mule.name}, mandataire du cabinet pour le séquestre. IBAN : ${muleIban}. Montant : ${eur(eurV)}. Merci de me confirmer l'exécution par retour. »\n\n` +
            `[Note de l'enquêteur : l'adresse authentique ${gc('du président', 'de la présidente')} est ${ceoMail}. Le domaine de l'expéditeur, ${fakeDomain}, remplace le « m » par « rn » ; il a été enregistré ${r.int(5, 12)} jours avant le premier courriel.]`,
        },
        {
          id: 'releve', type: 'rapport', title: `Relevé du compte bénéficiaire — ${bankName} (sur réquisition)`, date: plainteT + 2 * DAY, author: `${bankName} — Service des réquisitions`,
          body:
            `Titulaire : ${mule.name} — IBAN ${muleIban} — compte ouvert le ${fmtDate(openT - r.int(5, 20) * DAY, false)}\n\n` +
            `${fmtDate(creditT)} · VIR SEPA REÇU · ${companyLabel} · « Acompte acquisition — ${invoice} » · crédit ${eur(eurV)}\n` +
            parts.map((p, i) => `${fmtDate(sepaT[i])} · VIR SEPA ÉMIS · COINHOUSE (compte client) · débit ${eur(p)}`).join('\n') +
            `\n\nSolde au ${fmtDate(reqT, false)} : ${eur(eurKept + r.int(40, 900))}. Compte bloqué à titre conservatoire à réception de la réquisition. Aucun autre mouvement significatif dans la période.`,
        },
        {
          id: 'coinhouse', type: 'note', title: 'Réponse de Coinhouse à réquisition judiciaire', date: reqT, author: 'Coinhouse — Service conformité',
          body:
            `Titulaire : ${mule.name}, ${gm('né', 'née')} en ${birthYear}, ${gm('domicilié', 'domiciliée')} à ${muleCity}. Vérification d'identité : carte nationale d'identité authentique, selfie de vivacité conforme. Compte ouvert le ${fmtDate(openT, false)}. Profession déclarée : « agent de paiement en télétravail ».\n` +
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
            `Rémunération : 1 800 € par mois + ${commissionPct} % des montants traités. Aucune expérience requise, formation assurée par WhatsApp.\nPièces demandées : CNI, justificatif de domicile, RIB.`,
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
            `${A(w, O)} reçoit trois retraits d'USDT du hot wallet Coinhouse, les ${wd.map((t) => fmtDate(t.time)).join(', ')}, chacun quelques heures après un dépôt en euros de la mule. L'autre adresse du carnet, ${A(w, P)}, n'a reçu qu'un petit retrait de ${amt(pTest.transfers[0].value, 'ETH')} à l'ouverture du compte (portefeuille personnel de la mule, sans lien avec les fonds). ` +
            `${A(w, O)} n'est pas une adresse neuve : elle reçoit son ETH de gas de ${A(w, G)} et a déjà reçu ${amt(krValue, 'USDT')} d'un retrait Kraken ${Math.round((wd[0].time - krT) / DAY)} jours plus tôt, signe qu'elle collecte pour plusieurs mules.`,
        },
        {
          id: 'o2', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT la mule a-t-elle achetés puis retirés vers cette adresse (total des retraits Coinhouse) ?',
          answer: U,
          hint: 'Additionnez les trois transferts d\'USDT reçus du hot wallet Coinhouse après le virement ; le retrait Kraken antérieur n\'appartient pas à cette affaire.',
          explanation:
            `${usdtBought.map((v) => amt(v, 'USDT')).join(' + ')} = ${amt(U, 'USDT')}. Cohérence avec les euros : ${eur(eurToCh)} versés à Coinhouse (le virement de ${eur(eurV)} moins ${eur(eurKept)}, soit ${commissionPct} % conservés par la mule, sa « commission »), convertis à environ ${EUR_USD.toLocaleString('fr-FR')} $ par euro, frais de la plateforme déduits (≈ ${(chFee * 100).toFixed(1).replace('.', ',')} %).`,
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
          explanation: `La transaction ${order.payoutTx.hash.slice(0, 16)}… paie ${amt(order.payoutValue, 'USDT')} à ${A(w, T1)} ${Math.round((order.payoutTx.time - order.depositTx.time) / 60)} minutes après le dépôt de ${amt(cnValue, 'USDT')}. D'autres paiements ChangeNOW tombent dans la même fenêtre, parfois de montant proche : le bon candidat est celui dont le destinataire poursuit le circuit (financement en TRX par l'opérateur juste avant, puis dépôt sur un exchange). Au procès-verbal, ce lien reste une corrélation : il se confirme par réquisition à ChangeNOW (identifiant de commande, adresse de destination déclarée).`,
        },
        {
          id: 'o4', type: 'addresses', points: 12,
          prompt: 'Sélectionnez les adresses de dépôt d\'exchanges sur lesquelles les USDT ont abouti (toutes chaînes confondues).',
          answer: [dep1, e2Dep.deposit],
          hint: 'Deux branches : l\'ERC-20 restant part directement vers un exchange ; la branche TRC-20 se reprend côté Tron avec le corrélateur (émetteur ChangeNOW, USDT, fenêtre d\'une heure après le dépôt, tolérance ≈ 2 %).',
          explanation:
            `Branche Ethereum : ${amt(e1a, 'USDT')} puis ${amt(e1b, 'USDT')} (${amt(e1Total, 'USDT')}) sont déposés sur ${A(w, dep1)}, adresse de dépôt ${e1.entity.name} — la même qui avait reçu les USDT issus de Kraken : c'est un compte du réseau, réutilisé. ` +
            `Branche Tron : ChangeNOW paie ${amt(order.payoutValue, 'USDT')} (≈ ${cnFeePct.toFixed(1).replace('.', ',')} % de frais) à ${A(w, T1)} ${Math.round((order.payoutTx.time - order.depositTx.time) / 60)} minutes après le dépôt ; parmi les paiements de montant voisin, c'est la seule adresse qui poursuit le circuit (dépôt sur un exchange, transfert vers une adresse financée en TRX par le même portefeuille). Elle dépose ${amt(e2Value, 'USDT')} sur ${A(w, e2Dep.deposit)}, adresse de dépôt ${e2.entity.name}. ` +
            `${procedureFor(e1.entity)} ${procedureFor(e2.entity)} Les deux plateformes peuvent geler le compte de leur client et fournir KYC, IP et historique.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Sur quelle adresse dorment encore des USDT gelables par leur émetteur ?',
          answer: [T2],
          hint: 'Suivez la seconde sortie d\'USDT de l\'adresse Tron payée par ChangeNOW.',
          explanation:
            `${A(w, T1)} envoie le reste, ${amt(frozenValue, 'USDT')}, à ${A(w, T2)}, qui n'a plus bougé depuis le ${fmtDate(toT2.time)}. ${A(w, T2)} a reçu ses TRX de ${A(w, GT)}, le même financeur que ${A(w, T1)} : les deux adresses relèvent du même opérateur. ${procedureFor(tether)} C'est l'urgence n° 1 : un gel Tether préserve les fonds en quelques heures, avant la saisie pénale proprement dite.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT peut être gelé sur cette adresse ?',
          answer: frozenValue,
          hint: 'Ouvrez l\'adresse dormante : son solde en USDT TRC-20 est le montant encore entre les mains du réseau, donc gelable par l\'émetteur.',
          explanation:
            `${amt(frozenValue, 'USDT')}, soit ${pct(frozenValue)} des USDT achetés. Le reste est à rechercher sur les comptes ${e1.entity.name} (${amt(e1Total, 'USDT')}) et ${e2.entity.name} (${amt(e2Value, 'USDT')}) : leur gel dépend de la réactivité des plateformes et de ce que le titulaire a déjà retiré. Côté euros, la commission conservée par la mule (${eur(eurKept)}) est bloquée chez ${bankName}.`,
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
          explanation: `${A(w, G)} finance aussi ${A(w, O2)} (${amt(gasO2.transfers[0].value, 'ETH')} le ${fmtDate(gasO2.time, false)}). Cette adresse reçoit ensuite des USDT du hot wallet Coinhouse, puis les dépose sur ${A(w, dep1)}, la même adresse de dépôt ${e1.entity.name} que l'adresse du commanditaire : même financeur, même compte de sortie, même mode opératoire. C'est très probablement la collecte d'une autre mule, donc d'une autre victime de fraude au président ou d'escroquerie apparentée.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT cette seconde adresse collectrice a-t-elle reçus de Coinhouse ?',
          answer: o2Total,
          hint: 'Additionnez les transferts d\'USDT reçus du hot wallet Coinhouse par cette adresse, avant son dépôt sur l\'exchange.',
          explanation: `${o2In.map((t) => amt(t.transfers[0].value, 'USDT')).join(' + ')} = ${amt(o2Total, 'USDT')}, retirés de Coinhouse ${o2In.length > 1 ? 'les ' + o2In.map((t) => fmtDate(t.time, false)).join(' et ') : 'le ' + fmtDate(o2In[0].time, false)}, puis déposés en une fois chez ${e1.entity.name}. Ce montant chiffre un préjudice distinct de celui de ${companyLabel}, qui pourrait correspondre à une plainte déjà enregistrée ailleurs : il justifie un rapprochement via les fichiers de procédure et les signalements de fraude au président.`,
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
          explanation: `L'adresse a déjà tout transféré vers ${e1.entity.name} : il n'y a plus rien à geler chez Tether. Elle n'est pas hors sujet pour autant : même financeur, même dépôt de sortie, donc même réseau. Coinhouse sait quel client a ordonné ces retraits (KYC, IBAN lié, carnet d'adresses), ce qui identifie une seconde mule et, par son relevé bancaire, une autre victime. Rien n'indique que ${mule.name} soit à l'origine de ces retraits : son carnet d'adresses ne contient pas cette adresse.`,
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
            `Tout désigne une mule recrutée par une fausse offre d'emploi : vraie CNI, IP de son domicile, libellé « wallet société » pour l'adresse fournie, commission de ${commissionPct} % prévue par l'annonce. ${gm('Il', 'Elle')} n'est pas ${gm('l\'organisateur', 'l\'organisatrice')}, mais ${gm('il', 'elle')} n'est pas pour autant hors de cause : prêter son compte et convertir des fonds sans justification peut constituer un blanchiment (art. 324-1 du code pénal) si l'on établit qu'${gm('il', 'elle')} connaissait ou ne pouvait ignorer leur origine. Son audition est prioritaire : contacts WhatsApp, numéro du « recruteur », instructions reçues, autres comptes ouverts, et éventuellement les identifiants d'autres mules (comme celle du retrait Kraken).`,
        },
      ],
      truth: {
        path: [gasTx.id, krTx.id, krFwd.tx.id, gasO2.id, ...o2In.map((t) => t.id), o2Fwd.tx.id, ...wd.map((t) => t.id), order.depositTx.id, order.payoutTx.id, e1Dep1.tx.id, e1Dep2.tx.id, gasT1.id, gasT2.id, e2Dep.tx.id, toT2.id],
        addresses: [O, G, O2, dep1, order.deposit, T1, T2, GT, e2Dep.deposit],
        debrief:
          `1. Courriels depuis le domaine sosie ${fakeDomain}, appel de « ${lawyer} » : le ${fmtDate(wireT, false)}, ${acct.name} vire ${eur(eurV)} vers le compte ${de(mule.name)}, ${gm('recruté', 'recrutée')} ${Math.round((wireT - adT) / DAY)} jours plus tôt par une fausse offre d'emploi d'« agent de paiement ».\n` +
          `2. La mule garde ${eur(eurKept)} (${commissionPct} %), verse ${eur(eurToCh)} à Coinhouse en trois virements, achète ${amt(U, 'USDT')} et les retire vers ${A(w, O)}, l'adresse fournie par le commanditaire.\n` +
          `3. Le commanditaire fractionne : ${amt(cnValue, 'USDT')} partent chez ChangeNOW (ERC-20 → TRC-20), ${amt(e1Total, 'USDT')} sont déposés en deux fois sur ${e1.entity.name} (${A(w, dep1)}), adresse de dépôt déjà utilisée pour les fonds d'une autre mule.\n` +
          `4. Sur Tron, ${A(w, T1)} reçoit ${amt(order.payoutValue, 'USDT')}, en dépose ${amt(e2Value, 'USDT')} sur ${e2.entity.name} et transfère ${amt(frozenValue, 'USDT')} sur ${A(w, T2)}, où ils dorment.\n` +
          `5. Le réseau : ${A(w, G)} finance en gas l'adresse du commanditaire et une seconde collectrice, ${A(w, O2)}, qui a reçu ${amt(o2Total, 'USDT')} d'une autre mule via Coinhouse avant de les déposer sur le même compte ${e1.entity.name}. Avec le retrait Kraken antérieur, au moins trois mules alimentent ce compte de sortie.\n\n` +
          `À retenir : la fraude au président est une escroquerie « hors chaîne » qui devient traçable dès que la mule convertit les fonds chez un prestataire régulé. L'ordre des actes compte : gel Tether sur ${A(w, T2)} et demandes de gel aux exchanges de sortie d'abord, réquisitions (KYC, IP, historique) ensuite, audition de la mule enfin. L'USDT n'est pas « anonyme » : centralisé, il se gèle sur Ethereum comme sur Tron.`,
      },
      hints: [
        'Partez de la réponse de Coinhouse : des deux adresses du carnet, une seule reçoit des USDT après le virement. Dépliez ensuite ses sorties d\'USDT.',
        'La part envoyée à ChangeNOW ne se suit pas on-chain : sélectionnez le dépôt et corrélez côté Tron (émetteur ChangeNOW, USDT, fenêtre d\'une heure, tolérance ≈ 2 %).',
        'L\'adresse Tron payée par ChangeNOW reçoit d\'abord des TRX pour ses frais ; ses deux sorties d\'USDT mènent l\'une à un exchange, l\'autre à une adresse qui ne bouge plus.',
        'Pour cartographier le réseau, remontez l\'ETH de gas de l\'adresse du commanditaire : son financeur alimente d\'autres adresses.',
      ],
    }
  },
}
