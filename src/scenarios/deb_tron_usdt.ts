import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Faux propriétaire : une annonce de location trop belle, un bailleur
// « expatrié » qui réclame frais de réservation puis caution en USDT-TRC20.
// La même adresse de paiement sert à toutes ses annonces ; elle est vidée par
// lots vers un « coffre » qui lui envoie à chaque fois quelques TRX pour les
// frais. Le coffre n'a pas encore été vidé : les USDT sont gelables (fin
// d'affaire : fonds détenus). Habillage : autres candidats piégés, transferts
// sosies (address poisoning), vie antérieure du coffre, casino et cartes
// cadeaux, achat de TRX et petit dépôt-test sur un exchange.

const PLATFORMS = ['LocaDirect', 'Appart\'Facile', 'ImmoPrivé', 'LogiNow'] as const
const usdt = (v: number) => roundAsset('USDT', v)
const trx = (v: number) => roundAsset('TRX', v)

export const debTronUsdt: ScenarioTemplate = {
  id: 'deb-tron-usdt',
  title: 'USDT sur Tron : la caution du faux propriétaire',
  tagline: 'Une caution versée en USDT, une adresse qui sert à toutes les annonces, et des fonds encore gelables.',
  description:
    'Pour décrocher un appartement, une victime a versé des frais de réservation puis une caution en USDT (réseau Tron) à un « propriétaire expatrié ». L\'adresse de paiement sert à toutes ses fausses annonces et reçoit aussi des transferts sosies. Triez les entrées et les sorties : recensez les candidats piégés, retrouvez le lot qui transporte la caution vers le « coffre » de l\'escroc, distinguez la valeur (USDT) des frais (TRX), repérez les pistes d\'identification et chiffrez ce qui reste gelable avant qu\'il ne disparaisse.',
  difficulty: 1,
  chains: ['tron'],
  skills: ['lecture_tx', 'tokens', 'tron', 'poisoning', 'gel'],
  estMinutes: 35,
  lessons: ['tron-usdt', 'stablecoins', 'suivre-flux', 'gel-stablecoins'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const site = r.pick(PLATFORMS)
    const landlord = fakePerson(r)
    const exile = r.pick(['Dubaï', 'Abou Dhabi', 'Malte', 'Montréal'])

    const fundKey = r.pick(['coinhouse', 'kraken', 'bitstamp'] as const)
    const exKey = r.pick(['binance', 'okx'] as const)
    const fund = exchange(w, fundKey, 'tron')
    const ex = exchange(w, exKey, 'tron')

    const scamE = w.customEntity({ name: `${landlord.g('Faux propriétaire', 'Fausse propriétaire')} « ${landlord.name} » (inconnu)`, category: 'scam', description: 'Fausses annonces de location : frais de réservation et caution exigés en USDT.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })
    const L = w.addr('tron', { entity: scamE })
    const K = w.addr('tron', { entity: scamE })
    const usdtFee = () => trx(r.float(13, 28))
    const path: Tx[] = []

    // ── Vie antérieure du coffre : achat de TRX, anciens encaissements ──────
    const T0 = w.at(0)
    const trxBuy = ex.withdraw(K, trx(r.int(900, 2200)), T0 - Math.round(r.float(14, 22) * DAY), 'TRX')
    priorHistory(w, K, { start: T0 - 48 * DAY, end: T0 - 16 * DAY, nIn: 3, nOut: 2, maxUsd: 1400, asset: 'USDT' })

    /** Lot : quelques TRX du coffre vers l'adresse de paiement, puis tous ses USDT vers le coffre. */
    const sweeps: { topup: Tx; sw: Tx; value: number }[] = []
    const sweepL = (t: number) => {
      const topup = w.transfer({ time: t - r.int(4, 30) * 60, from: K, to: L, value: trx(r.int(18, 40)), asset: 'TRX', fee: 1.1 })
      const value = usdt(w.balanceOf(L, 'USDT'))
      const sw = w.transfer({ time: t, from: L, to: K, value, asset: 'USDT', fee: usdtFee() })
      const s = { topup, sw, value }
      sweeps.push(s)
      return s
    }
    /** Un autre candidat piégé paie l'adresse de l'annonce. */
    const candidates: { payer: string; value: number; tx: Tx }[] = []
    const candidate = (t: number) => {
      const payer = w.addr('tron')
      // Montants distincts : le signalement de l'autre brigade (montant + date) désigne un seul paiement
      let value = 0
      do value = usdt(r.pick([r.int(12, 30) * 10, r.int(12, 32) * 100]))
      while (candidates.some((c) => c.value === value))
      w.fundAccount(payer, trx(r.int(40, 120)), 'TRX', t - Math.round(r.float(24, 240) * HOUR))
      w.fundAccount(payer, usdt(value + r.int(0, 6) * 10), 'USDT', t - Math.round(r.float(2, 48) * HOUR))
      const tx = w.transfer({ time: t, from: payer, to: L, value, asset: 'USDT', fee: usdtFee() })
      candidates.push({ payer, value, tx })
      return tx
    }

    // ── Avant les faits : deux candidats, un premier lot vers le coffre ─────
    candidate(T0 - Math.round(r.float(9, 13) * DAY))
    candidate(T0 - Math.round(r.float(3, 6) * DAY))
    const swA = sweepL(T0 - Math.round(r.float(30, 60) * HOUR))

    // ── La victime : frais de réservation ────────────────────────────────────
    const rent = r.int(55, 95) * 10
    const p1 = usdt(r.int(15, 30) * 10)
    const p2 = usdt(rent * 3)
    fund.withdraw(victim, trx(r.int(60, 150)), T0 - Math.round(r.float(50, 110) * HOUR), 'TRX')
    fund.withdraw(victim, usdt(p1 + r.int(0, 4) * 10), T0 - Math.round(r.float(2, 12) * HOUR), 'USDT')
    const pay1 = w.transfer({ time: T0, from: victim, to: L, value: p1, asset: 'USDT', fee: usdtFee() })
    const midCand = candidate(T0 + Math.round(r.float(3, 12) * HOUR))
    const swB = sweepL(T0 + Math.round(r.float(16, 24) * HOUR))

    // ── La victime : caution + premier loyer ─────────────────────────────────
    // En journée, deux jours après les frais de réservation (toujours après le lot qui les emporte)
    const p2T = Math.floor((T0 + 2 * DAY) / DAY) * DAY + r.int(7, 18) * HOUR + r.int(0, 59) * 60
    fund.withdraw(victim, usdt(p2 + r.int(0, 5) * 10), p2T - Math.round(r.float(2, 10) * HOUR), 'USDT')
    const pay2 = w.transfer({ time: p2T, from: victim, to: L, value: p2, asset: 'USDT', fee: usdtFee() })
    const swC = sweepL(p2T + Math.round(r.float(1.5, 6) * HOUR))
    path.push(pay1, swB.sw, pay2, swC.sw)

    // ── Après les faits : d'autres candidats, un dernier lot ─────────────────
    const witnessTx = candidate(p2T + Math.round(r.float(30, 60) * HOUR))
    candidate(p2T + Math.round(r.float(70, 110) * HOUR))
    const swD = sweepL(p2T + Math.round(r.float(115, 135) * HOUR))
    const witness = candidates.find((c) => c.tx === witnessTx)!

    // ── Le coffre dépense un peu (casino, cartes cadeaux) et teste une sortie
    // Même adresse de dépôt au casino pour les deux mises : un seul compte joueur.
    const casino = w.customEntity({ name: r.pick(['Tronvegas', 'SpinTRX', 'Lucky Tether Casino']), category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant l\'USDT-TRC20, inscription par simple adresse électronique, sans vérification d\'identité sous un certain seuil de retrait.' })
    const giftShop = w.customEntity({ name: r.pick(['Bonkado', 'CartesExpress', 'GiftTRX']), category: 'merchant', known: true, description: 'Revendeur en ligne (fictif) de cartes cadeaux payables en USDT ; le code est livré par courriel.' })
    const orbitAddr = w.addr('tron', { entity: casino, label: `${casino.name} — Dépôt joueur` })
    const cardAddr = w.addr('tron', { entity: giftShop, label: `${giftShop.name} — Paiement` })
    const spendT = (a: number, b: number) => swC.sw.time + Math.round(r.float(a, b) * HOUR)
    const bets = [
      w.transfer({ time: spendT(8, 30), from: K, to: orbitAddr, value: usdt(r.int(10, 30) * 10), asset: 'USDT', fee: usdtFee() }),
      w.transfer({ time: spendT(50, 90), from: K, to: orbitAddr, value: usdt(r.int(15, 40) * 10), asset: 'USDT', fee: usdtFee() }),
    ]
    const card = w.transfer({ time: spendT(30, 70), from: K, to: cardAddr, value: usdt(r.pick([50, 100, 150, 200])), asset: 'USDT', fee: usdtFee() })
    w.transfer({ time: spendT(95, 110), from: K, to: w.addr('tron'), value: usdt(r.int(4, 12) * 10), asset: 'USDT', fee: usdtFee() })
    const testV = usdt(r.int(2, 5) * 10)
    const test = ex.receive(K, testV, swD.sw.time + Math.round(r.float(20, 40) * HOUR), { asset: 'USDT' })

    // ── Transferts sosies (address poisoning) sur l'adresse de paiement et le coffre
    // Les robots d'empoisonnement réagissent aux gros transferts : ici, après le lot de la caution
    const poisonL = dusting(w, L, { time: swC.sw.time + 30 * HOUR, n: 3, spreadH: 24 })
    dusting(w, K, { time: swC.sw.time + 20 * HOUR, n: 2, spreadH: 20 })

    // ── Bruit de fond des plateformes ───────────────────────────────────────
    ex.noise(14, T0 - 5 * DAY, T0 + 10 * DAY, 'USDT')
    ex.noise(6, T0 - 5 * DAY, T0 + 10 * DAY, 'TRX')
    fund.noise(8, T0 - 5 * DAY, T0 + 8 * DAY, 'USDT')

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const inUsdt = w.txsOf(L).flatMap((t) => t.transfers).filter((x) => x.to === L && x.asset === 'USDT')
    const realIn = inUsdt.filter((x) => x.value >= 1 && x.from !== K)
    const payers = new Set(realIn.map((x) => x.from))
    const nPayers = payers.size
    const collected = usdt(realIn.reduce((s, x) => s + x.value, 0))
    const nPoison = poisonL.txs.length
    const vault = usdt(w.balanceOf(K, 'USDT'))
    const swCValue = swC.value
    const swept = usdt(sweeps.reduce((s, x) => s + x.value, 0))
    const orbitTotal = usdt(bets.reduce((s, x) => s + x.transfers[0].value, 0))
    const cardV = card.transfers[0].value
    const exName = ex.entity.name
    const witnessP = fakePerson(r)
    const witnessCity = fakeCity(r)
    const lastIn = sweeps[sweeps.length - 1]
    const poisonVals = [...new Set(poisonL.txs.map((t) => t.transfers[0].value))].sort((a, b) => a - b)
    const poisonTxt = poisonVals.map((v) => v.toFixed(2).replace('.', ',')).join(' ou ') + ' USDT'
    const vaultDust = usdt(w.txsOf(K).filter((t) => t.tags.includes('poisoning')).reduce((s, t) => s + t.transfers[0].value, 0))
    const brigade = `brigade ${de(witnessCity)}`

    return {
      world: w,
      title: `La caution du faux propriétaire — ${city}`,
      briefing:
        `${victimName} cherchait un appartement à ${city}. Sur le site d'annonces ${site}, un T2 lumineux, bien placé et nettement sous le prix du marché. Le « propriétaire », ${landlord.name}, se dit ${landlord.g('expatrié', 'expatriée')} à ${exile} : pas de visite possible, mais un dossier « sécurisé » par courriel. ${landlord.g('Il', 'Elle')} réclame d'abord des frais de réservation, puis la caution et le premier loyer, en USDT sur le réseau Tron « pour éviter les frais bancaires internationaux ». Les clés n'arrivent jamais ; l'annonce a disparu.\n\n` +
        `Sur Tron, la monnaie native est le TRX, qui paie les frais ; l'USDT y circule comme un jeton (TRC-20). L'adresse donnée à la victime a servi à d'autres annonces : il faudra trier ses entrées et ses sorties.\n\n` +
        `Votre mission : suivre la caution jusqu'au portefeuille où l'escroc accumule les fonds, mesurer le nombre de candidats piégés, relever les pistes d'identification et chiffrer ce qui peut encore être gelé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: p2T + 2 * DAY, author: victimName,
          body:
            `« J'ai payé ${amt(p1, 'USDT')} de frais de réservation le ${fmtDate(pay1.time)}, puis ${amt(p2, 'USDT')} le ${fmtDate(pay2.time)} : deux mois de caution et le premier loyer de ${amt(rent, 'USDT')}. J'avais acheté les USDT et un peu de TRX sur ${fund.entity.name}, comme on me l'avait expliqué.\n\n` +
            `Mon adresse Tron : ${A(w, victim)}\n` +
            `Hash du second paiement : ${pay2.hash} »`,
        },
        {
          id: 'email', type: 'email', title: `Courriel du « propriétaire » (${landlord.name})`, date: p2T - 6 * HOUR, author: landlord.name,
          body:
            `Bonjour,\n\nVotre dossier a été retenu parmi de nombreuses candidatures. Pour bloquer l'appartement, merci de régler la caution (2 mois) et le premier loyer, soit ${amt(p2, 'USDT')}, sur mon adresse habituelle (réseau TRC-20 UNIQUEMENT) :\n\n${A(w, L)}\n\n` +
            `Les clés vous seront envoyées par coursier dès réception. Vérifiez bien l'adresse avant l'envoi : copiez-la depuis ce message, pas depuis votre historique.\n\nCordialement,\n${landlord.name}`,
        },
        {
          id: 'signalement', type: 'pv', title: `Signalement de la ${brigade}`, date: p2T + 6 * DAY, author: `Brigade ${de(witnessCity)}`,
          body:
            `Plainte ${de(witnessP.name)} : annonce de location sur ${site}, propriétaire « ${landlord.name} » à l'étranger, paiement exigé en USDT.\n\n` +
            `${witnessP.g('Le plaignant', 'La plaignante')} déclare avoir versé ${amt(witness.value, 'USDT')} le ${fmtDate(witness.tx.time, false)} vers « l'adresse habituelle » du propriétaire, qu'${witnessP.g('il', 'elle')} n'a pas conservée.\n\n` +
            `Transmis pour rapprochement éventuel.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: p2T + 6 * DAY, author: 'Chef de groupe',
          body:
            `L'adresse de paiement reçoit de tout : des candidats, du TRX, et des micro-transferts depuis des adresses qui lui ressemblent. Trie avant de compter.\n\n` +
            `Les USDT sont vidés par lots : pour chaque lot, regarde ce qui était sur l'adresse AU MOMENT du transfert. Un lot antérieur au paiement ne peut pas contenir la caution.\n\n` +
            `Si les fonds dorment encore quelque part, c'est la priorité absolue : chiffre-les, l'émetteur peut les geler.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'Vers quelle adresse les USDT reçus par l\'adresse de paiement sont-ils regroupés (le « coffre ») ?',
          answer: [K],
          hint: 'Dépliez les sorties d\'USDT de l\'adresse donnée dans le courriel : elles partent toutes vers la même adresse non étiquetée.',
          explanation: `Chaque lot d'USDT de ${A(w, L)} part vers ${A(w, K)} (${sweeps.length} transferts, ${amt(swept, 'USDT')} au total). Cette adresse lui envoie aussi les TRX nécessaires aux frais avant chaque lot : c'est le portefeuille de l'escroc, son « coffre ». Les micro-transferts reçus par l'adresse de paiement depuis des adresses ressemblantes ne vont nulle part : ce sont des leurres.`,
        },
        {
          id: 'o2', type: 'tx', points: 11,
          prompt: 'Quelle transaction transporte la caution de la victime vers le coffre ?',
          answer: [swC.sw.id],
          hint: 'Classez les transferts d\'USDT sortants de l\'adresse de paiement par date et placez le paiement de la caution parmi eux : prenez le premier lot qui le suit.',
          explanation: `La caution arrive le ${fmtDate(pay2.time)} ; le lot suivant part le ${fmtDate(swC.sw.time)} (${swC.sw.hash.slice(0, 12)}…, ${amt(swCValue, 'USDT')}). Les lots du ${fmtDate(swA.sw.time)} et du ${fmtDate(swB.sw.time)} sont antérieurs à la caution : le premier vide l'argent d'autres candidats, le second emporte les frais de réservation de la victime (avec le paiement d'un autre candidat), mais pas la caution. Celui du ${fmtDate(swD.sw.time)} vide des paiements arrivés après. Sur un modèle à comptes, il n'y a pas de pièces à suivre : on raisonne sur le solde de l'adresse entre deux transferts.`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT ce lot transfère-t-il ?',
          answer: swCValue,
          hint: 'Ouvrez la transaction et lisez le transfert de jeton (USDT), pas les frais en TRX.',
          explanation: `${amt(swCValue, 'USDT')} : les USDT arrivés sur l'adresse de paiement depuis le lot précédent. ${Math.abs(swCValue - p2) < 0.005 ? `C'est exactement la caution (${amt(p2, 'USDT')}) : entre les deux lots, seule la caution est arrivée.` : `La caution (${amt(p2, 'USDT')}) en représente l'essentiel.`} Ce montant et le hash relient la caution au coffre dans le rapport.`,
        },
        {
          id: 'o4', type: 'number', points: 9, tolerance: 0, unit: 'candidats',
          prompt: 'Combien de portefeuilles distincts (celui de la victime compris) ont réellement payé l\'adresse de paiement en USDT ?',
          answer: nPayers,
          hint: 'Listez les entrées d\'USDT de l\'adresse de paiement. Écartez les montants de quelques centimes venus d\'adresses qui ressemblent à celle de l\'escroc, et les TRX envoyés par le coffre.',
          explanation: `${nPayers} portefeuilles : ${victimName} (deux paiements) et ${nPayers - 1} autres candidats, aux montants typiques de frais de dossier ou de caution. Les ${nPoison} entrées de quelques centimes viennent d'adresses sosies (mêmes premiers et derniers caractères) : ce sont des tentatives d'empoisonnement, pas des victimes. Les TRX reçus viennent du coffre lui-même. On compte des portefeuilles, pas des transactions.`,
        },
        {
          id: 'o5', type: 'choice', points: 7,
          prompt: `L'adresse de paiement reçoit ${nPoison} transferts de ${poisonTxt} depuis des adresses qui lui ressemblent à s'y méprendre. De quoi s'agit-il ?`,
          ...choice(r,
            'D\'une tentative d\'empoisonnement d\'adresse : on espère qu\'un correspondant copiera l\'adresse sosie depuis son historique',
            [
              'De remboursements partiels versés par l\'escroc aux candidats mécontents',
              'De frais de réseau prélevés automatiquement par Tron sur chaque adresse active',
              'De nouvelles victimes, qui testent l\'adresse avant de payer',
            ]),
          hint: 'Comparez les adresses émettrices à celle de l\'escroc : premiers et derniers caractères.',
          explanation: 'L\'« address poisoning » vise les adresses très actives en USDT : un robot crée une adresse dont le début et la fin imitent une adresse réelle, puis y envoie un montant infime pour apparaître dans l\'historique. Quiconque copie l\'adresse depuis son historique (sans la vérifier en entier) paie le fraudeur. Ici, ces micro-transferts sont étrangers à l\'affaire : on ne les compte pas comme victimes et on ne les suit pas. Le courriel du « propriétaire » met d\'ailleurs ses propres victimes en garde contre ce piège.',
        },
        {
          id: 'o6', type: 'tx', points: 9,
          prompt: 'Quelle transaction correspond au paiement du candidat signalé par l\'autre brigade ?',
          answer: [witness.tx.id],
          hint: 'Le signalement donne un montant et une date : cherchez l\'entrée d\'USDT de l\'adresse de paiement qui concorde.',
          explanation: `Le ${fmtDate(witness.tx.time)}, ${amt(witness.value, 'USDT')} arrivent de ${A(w, witness.payer).slice(0, 10)}… (${witness.tx.hash.slice(0, 12)}…) : montant et date concordent avec le signalement de la ${brigade}, et aucun autre paiement de ce montant n'est arrivé ce jour-là. La plainte peut être jointe, et l'adresse ${witnessP.g('du plaignant', 'de la plaignante')}, qu'${witnessP.g('il', 'elle')} n'avait pas conservée, est retrouvée.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT les candidats piégés (victime comprise) ont-ils versé à l\'adresse de paiement ?',
          answer: collected,
          hint: 'Additionnez les entrées d\'USDT retenues à la question du nombre de candidats, sans les micro-transferts sosies.',
          explanation: `${amt(collected, 'USDT')}, dont ${amt(usdt(p1 + p2), 'USDT')} pour ${victimName}. C'est le préjudice global apparent des fausses annonces sur la période, à transmettre au parquet pour un regroupement des procédures. Les centimes des sosies ne s'additionnent pas : ils n'ont rien à voir avec les victimes.`,
        },
        {
          id: 'o8', type: 'choice', points: 7,
          prompt: 'Quelques minutes avant chaque lot, le coffre envoie 18 à 40 TRX à l\'adresse de paiement. Pourquoi ?',
          ...choice(r,
            'Pour payer les frais : sans TRX, l\'adresse de paiement ne peut pas transférer ses USDT',
            [
              'Pour rembourser une partie des candidats, en TRX plutôt qu\'en USDT',
              'Pour convertir les USDT en TRX avant le transfert, afin de brouiller la piste',
              'Pour rémunérer la plateforme d\'annonces qui a publié l\'offre',
            ]),
          hint: 'Dans quelle unité sont payés les frais de chaque transfert d\'USDT ?',
          explanation: `Sur Tron, tout transfert de jeton consomme de l'énergie et de la bande passante, payées en TRX. L'adresse de paiement ne reçoit que des USDT des candidats : pour les déplacer, l'escroc doit d'abord y envoyer un peu de TRX. Ce va-et-vient (TRX du coffre vers l'adresse, USDT de l'adresse vers le coffre) est une signature : il relie les deux adresses au même contrôleur. On suit les USDT (la valeur) ; les TRX ne sont que du carburant.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'Après les faits, le coffre paie à plusieurs reprises un service de jeux en ligne. Lequel ?',
          answer: [casino.id],
          hint: 'Dépliez les sorties d\'USDT du coffre : certaines vont vers des adresses étiquetées.',
          explanation: `Le coffre mise deux fois sur ${casino.name} (${amt(orbitTotal, 'USDT')} au total), toujours vers la même adresse de dépôt joueur ${A(w, orbitAddr).slice(0, 10)}… : un seul compte. Il paie aussi ${amt(cardV, 'USDT')} à ${giftShop.name} (cartes cadeaux). Ce sont des dépenses personnelles : elles renseignent sur les habitudes du suspect. ${giftShop.name} connaît l'adresse électronique de livraison des codes ; le casino, sans vérification d'identité, n'aura guère que des IP et un pseudonyme : piste secondaire, à documenter sans s'y attarder. Ces dépenses restent modestes au regard du solde.`,
        },
        {
          id: 'o10', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme régulée le titulaire du coffre dispose-t-il d\'un compte ? (deux transactions le montrent)',
          answer: [exKey],
          hint: 'Regardez d\'où viennent les TRX du coffre (sa seule entrée de TRX), et vers quelle adresse étiquetée « Adresse de dépôt » il envoie un petit montant d\'USDT, plusieurs jours après la caution.',
          explanation: `Le ${fmtDate(trxBuy.time)}, le coffre reçoit ${amt(trxBuy.transfers[0].value, 'TRX')} du hot wallet ${de(exName)} (${trxBuy.hash.slice(0, 12)}…) : un retrait depuis un compte client. Le ${fmtDate(test.tx.time)}, il envoie ${amt(testV, 'USDT')} vers une adresse de dépôt ${exName} (${test.tx.hash.slice(0, 12)}…), balayée ensuite : un dépôt-test, typique d'un escroc qui prépare sa sortie. ${procedureFor(ex.entity)} La réquisition vise les deux opérations (identité, IP, IBAN) et demande la surveillance du compte.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT reposent encore sur le coffre ?',
          answer: vault,
          hint: 'Lisez le solde USDT du coffre dans son résumé (rubrique USDT, pas TRX).',
          explanation: `${amt(vault, 'USDT')} : les ${amt(swept, 'USDT')} des lots reçus de l'adresse de paiement et le reliquat de son historique antérieur, moins les dépenses récentes (casino, cartes cadeaux, un virement à un particulier) et le dépôt-test${vaultDust > 0 ? ` (le solde affiché compte aussi ${amt(vaultDust, 'USDT')} de micro-transferts sosies, sans incidence)` : ''}. L'essentiel des cautions n'a pas quitté la blockchain : c'est le montant à citer dans la demande de gel, qui doit partir tout de suite. Le dépôt-test montre que la sortie se prépare.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelle est la mesure la plus urgente pour préserver ces fonds ?',
          ...choice(r,
            'Demander à Tether, émetteur de l\'USDT, de geler les jetons du coffre, en citant l\'adresse, le solde et les hash',
            [
              `Attendre la réponse ${de(exName)} sur l'identité du titulaire avant toute démarche`,
              'Demander aux validateurs de Tron de bloquer l\'adresse du coffre',
              'Envoyer un message on-chain à l\'escroc pour le sommer de restituer les fonds',
            ]),
          hint: 'Qui contrôle le smart contract de l\'USDT, et combien de temps faut-il pour vider une adresse ?',
          explanation: `L'USDT est un jeton centralisé : Tether peut inscrire une adresse sur liste noire et rendre ses jetons inutilisables. La demande passe par son portail dédié aux forces de l'ordre, en citant ${A(w, K)}, le solde (${amt(vault, 'USDT')}) et les hash des lots ; elle part immédiatement, en parallèle de la réquisition à ${exName}. Le gel est une mesure conservatoire de l'émetteur ; la saisie suit les règles de la saisie pénale. Attendre l'identification laisserait le temps de vider l'adresse, les validateurs ne bloquent pas un jeton, et prévenir l'escroc serait contre-productif.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [L, K, test.deposit],
        debrief:
          `1. ${victimName} verse ${amt(p1, 'USDT')} de frais de réservation (${fmtDate(pay1.time, false)}) puis ${amt(p2, 'USDT')} de caution et premier loyer (${fmtDate(pay2.time, false)}) à ${A(w, L)}, « l'adresse habituelle » du faux propriétaire.\n` +
          `2. Cette adresse sert à toutes les annonces : ${nPayers} portefeuilles l'ont payée, pour ${amt(collected, 'USDT')}. Elle reçoit aussi ${nPoison} micro-transferts d'adresses sosies (address poisoning), étrangers à l'affaire.\n` +
          `3. L'escroc la vide par lots vers son coffre ${A(w, K)}, en lui envoyant à chaque fois quelques TRX pour les frais. Les frais de réservation partent dans le lot du ${fmtDate(swB.sw.time, false)} ; la caution dans celui du ${fmtDate(swC.sw.time)} (${amt(swCValue, 'USDT')}). Les lots du ${fmtDate(swA.sw.time, false)} et du ${fmtDate(lastIn.sw.time, false)} concernent d'autres candidats.\n` +
          `4. Le coffre a une vie propre : anciens encaissements, achat de TRX chez ${exName}, paiements à ${casino.name} et ${giftShop.name}, et un dépôt-test de ${amt(testV, 'USDT')} chez ${exName}.\n` +
          `5. ${amt(vault, 'USDT')} y reposent encore : fonds détenus, gelables par Tether.\n\n` +
          `À retenir : sur une adresse réutilisée d'un modèle à comptes, on ne suit pas une pièce mais un solde : le transfert qui suit un paiement est celui qui l'emporte. On écarte les micro-transferts sosies et on lit les TRX comme du carburant. Quand les fonds dorment encore, la demande de gel passe avant tout le reste.\n\n` +
          `Réflexes de l'enquêteur : (1) gel immédiat des USDT du coffre auprès de Tether ; (2) réquisition à ${exName} sur le retrait de TRX et le dépôt-test (identité, IP, IBAN), avec surveillance du compte ; (3) signalement de l'annonce et du compte à ${site} ; (4) rapprochement avec la plainte transmise par la ${brigade} et recherche des autres candidats.`,
      },
      hints: [
        'Partez du portefeuille de la victime : ses deux paiements vont vers l\'adresse donnée dans le courriel.',
        'Sur l\'adresse de paiement, écartez les centimes envoyés par des adresses ressemblantes et les TRX du coffre : il reste les candidats.',
        'Les USDT partent par lots vers une même adresse. Placez la caution dans la chronologie : le lot qui la suit est le bon.',
        'Le coffre n\'a presque rien dépensé : lisez son solde USDT, puis cherchez d\'où viennent ses TRX et vers quelle adresse de dépôt étiquetée part un petit montant d\'USDT.',
      ],
    }
  },
}
