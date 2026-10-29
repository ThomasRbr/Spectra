import { World, type Tx } from '../engine/world'
import { exchange, person, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, procedureFor, receivedIn } from './util'

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
    'Une victime d\'une fausse plateforme d\'investissement, déjà en plainte, est démarchée par un « cabinet » qui promet de récupérer ses bitcoins contre des frais de procédure. Retrouvez les adresses de paiement, prouvez par le clustering que ces frais rejoignent le portefeuille de la première escroquerie, chiffrez le préjudice, identifiez la sortie et tirez-en les conséquences pour la victime et pour la procédure.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['cioh', 'change', 'osint', 'typologies', 'requisition'],
  estMinutes: 25,
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
    for (const sx of Sx) {
      for (let i = 0; i < r.int(1, 3); i++) {
        const t = t1 + Math.round(r.float(-10, 25) * DAY)
        const v = roundAsset('BTC', Math.round(fromUsd('BTC', r.float(800, 9000)) * 1e3) / 1e3)
        const roll = r.next()
        if (roll < 0.45) cv.withdraw(sx, v, t)
        else if (roll < 0.75) bs.withdraw(sx, v, t)
        else w.utxoTx({ time: t, from: [person(w, 'btc', { history: 2, time: t })], to: [{ address: sx, value: v }] })
      }
    }
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
    let tf = contactT + Math.round(r.float(1, 3) * DAY)
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
    const D2 = out.newDeposit()
    const Z = w.addr('btc', { entity: net, kind })
    const d2V = roundAsset('BTC', Math.floor(lIn * r.float(0.82, 0.93) * 100) / 100)
    const L = w.utxoTx({ time: lT, from: lFrom, to: [{ address: D2, value: d2V }], change: Z, spendAll: true })
    const zV = L.outputs.find((o) => o.address === Z)?.value ?? 0
    const sweep2 = out.sweep([D2], lT + Math.round(r.float(1, 6) * HOUR))[0]

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
    const deV = /^[AEIOUYÉÈ]/i.test(vp.name) ? `d'${vp.name}` : `de ${vp.name}`
    const dePLAT = /^[AEIOUYÉ]/i.test(PLAT) ? `d'${PLAT}` : `de ${PLAT}`

    return {
      world: w,
      title: `Faux cabinet de récupération — ${city}`,
      briefing:
        `${vp.name} (${city}) a perdu ${amt(r8(total1), 'BTC')} il y a quelques mois sur ${PLAT}, une fausse plateforme d'investissement ; ${g('il', 'elle')} a déposé plainte et la procédure est en cours. Récemment, ${g('il', 'elle')} a été ${g('contacté', 'contactée')} par « ${REC} », puis par un « ${firm} », qui lui promettaient de récupérer ses fonds contre des frais réglés en bitcoins.\n\n` +
        `Après ${n} versements, le « cabinet » réclame encore une taxe. ${g('Méfiant', 'Méfiante')}, ${vp.name} revient déposer plainte. Ce schéma, l'escroquerie à la récupération (recovery scam), vise des victimes déjà fragilisées : leurs coordonnées circulent, parfois entre les mains des mêmes auteurs.\n\n` +
        `Objectifs : identifier les adresses de paiement des frais, vérifier on-chain si elles mènent au portefeuille de la première escroquerie, chiffrer le nouveau préjudice, identifier la plateforme de sortie, puis décider de la réponse à la victime et du sort procédural de la plainte.`,
      evidence: [
        {
          id: 'proc', type: 'note', title: `Rappel de la procédure initiale n° ${procNo}`, date: c1T + Math.round(r.float(10, 20) * DAY), author: 'Service enquêteur saisi de la première plainte',
          body:
            `Plainte ${deV} pour escroquerie (fausse plateforme ${PLAT}).\n` +
            `Adresse de collecte communiquée par la plateforme : ${A(w, S0)}\n` +
            `Versements de la victime, depuis son compte Coinhouse :\n${p1.map((tx) => `- ${tx.hash} (${amt(receivedIn(w, tx, S0), 'BTC')})`).join('\n')}\n` +
            `Total : ${amt(r8(total1), 'BTC')}. Réquisition adressée à Coinhouse (données de la victime). Analyse des flux en aval à compléter.`,
        },
        {
          id: 'courrier', type: 'email', title: `Courrier à en-tête du « ${firm} »`, date: contactT + Math.round(r.float(0.5, 1.5) * DAY), author: maitre,
          body:
            `${firm} — Avocats au barreau de Paris — Toque ${toque}\nDépartement « Recouvrement d'actifs numériques », partenaire de ${REC}\n\n` +
            `${g('Monsieur', 'Madame')},\nMandaté dans le cadre de la cellule européenne de restitution, notre cabinet a localisé les ${amt(r8(total1), 'BTC')} que vous avez versés à ${PLAT} depuis l'adresse ${A(w, S0)}.\n` +
            `Ces fonds sont placés sous séquestre sur le portefeuille ${A(w, sq.hot)} dans l'attente de leur restitution.\n\n` +
            `Pour libérer les fonds, la procédure prévoit le règlement préalable, en bitcoins, des postes suivants : ${FEES.slice(0, n).map((f) => f.label).join(', ')}. Ces frais sont intégralement remboursés à la restitution.\n` +
            `Dossier agréé AMF. Confidentialité exigée : ne communiquez pas avec les services de police, cela bloquerait la procédure.\n\n${maitre}`,
        },
        {
          id: 'whatsapp', type: 'sms', title: `Échanges WhatsApp avec « ${maitre} » (extraits)`, date: lastPay.pay.time, author: phone,
          body:
            given.map((f, i) => `${maitre} : Étape ${i + 1}, ${f.label} : ${amt(f.value, 'BTC')} (environ ${eur(f.value)}) à envoyer sur\n${A(w, R[i])}`).join('\n') +
            `\n${maitre} : Dernière étape : ${lastPay.label}, ${amt(lastPay.value, 'BTC')}. Je vous envoie l'adresse en QR code, ne la recopiez pas ici.\n` +
            `${vp.name} : C'est fait, mais vous m'aviez dit que c'était la dernière fois…\n` +
            `${maitre} : Le séquestre exige encore une garantie de solvabilité. Après, tout est débloqué sous 48 h, je vous le promets.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Nouvelle plainte — déclaration de la victime', date: plainteT, author: vp.name,
          body:
            `« J'ai été ${g('contacté', 'contactée')} le ${fmtDate(contactT, false)} par ${REC}, qui connaissait le nom de la plateforme et le montant exact que j'avais perdu. Ils m'ont mis${g('', 'e')} en relation avec ${maitre}. ` +
            `À leur demande, j'ai installé un portefeuille sur mon téléphone « pour recevoir les fonds récupérés », acheté des bitcoins sur Coinhouse et payé ${n} fois.\n` +
            `Pour le dernier paiement, je n'ai plus l'adresse (QR code effacé), mais mon application indique la transaction : ${lastPay.pay.hash}\n` +
            `On me réclame aujourd'hui une « garantie de solvabilité ». J'ai compris que je m'étais fait avoir une deuxième fois. »`,
        },
        {
          id: 'osint', type: 'osint', title: 'Vérifications en sources ouvertes sur le « cabinet »', date: plainteT + Math.round(r.float(0.5, 2) * DAY), author: 'Cellule d\'appui',
          body:
            `• Le site ${domain} a été enregistré ${r.int(3, 6)} semaines avant le premier contact, via un service d'anonymisation des données du titulaire.\n` +
            `• Aucun avocat nommé ${lawyer.name} n'apparaît dans l'annuaire national des avocats ; la toque ${toque} ne correspond pas à ce nom.\n` +
            `• L'adresse postale du cabinet est celle d'un centre de domiciliation ; le numéro ${phone} est un mobile.\n` +
            `• Le nom « ${REC} » figure sur une liste noire de l'AMF des sites proposant de récupérer des fonds perdus. L'AMF n'« agrée » pas de tels services.\n` +
            `• L'adresse de « séquestre » citée dans le courrier reste à vérifier dans l'outil.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 20,
          prompt: `Sélectionnez toutes les adresses sur lesquelles ${vp.name} a versé les « frais » réclamés par le cabinet.`,
          answer: [...R],
          hint: 'Les premières adresses figurent dans les messages. Pour la dernière, ouvrez la transaction citée dans la plainte : laquelle des deux sorties est le paiement, laquelle est le rendu ?',
          explanation: `${n} adresses : ${R.map((a) => A(w, a)).join(', ')}. La dernière se déduit de la transaction ${lastPay.pay.hash.slice(0, 14)}… : la sortie de ${amt(lastPay.value, 'BTC')} est un montant rond (4 décimales) correspondant à la somme demandée, ${kind === 'p2wpkh' ? 'alors que' : 'sur une adresse d\'un autre type que l\'entrée, alors que'} l'autre sortie, au montant quelconque, revient vers une adresse neuve du portefeuille de la victime (${A(w, lastPay.change)}) : c'est le rendu. ${rxCount > 1 ? `Les ${rxCount} autres adresses de frais regroupées avec elles appartiennent au même portefeuille mais ont été alimentées par d'autres victimes : elles ne relèvent pas des paiements ${deV}.` : `L'autre adresse de frais regroupée avec elles appartient au même portefeuille mais a été alimentée par une autre victime : elle ne relève pas des paiements ${deV}.`}`,
        },
        {
          id: 'o2', type: 'tx', points: 20,
          prompt: 'Quelle transaction fait entrer les frais de « récupération » dans le portefeuille de la première escroquerie ?',
          answer: [L.id],
          hint: 'Suivez la dépense des adresses de frais, puis ouvrez le panneau cluster : une des entrées a déjà servi lors de la première escroquerie.',
          explanation: `La transaction ${L.hash.slice(0, 14)}… dépense ensemble les ${n} adresses de frais, ${rxCount} adresse${rxCount > 1 ? 's' : ''} d'autres victimes du « cabinet » et ${A(w, pivot)}. Or cette dernière figure aussi parmi les entrées du regroupement ${c1.hash.slice(0, 14)}…, aux côtés de l'adresse de collecte ${A(w, S0)} de la première plainte. Par l'heuristique des entrées communes, toutes ces adresses sont contrôlées par le même portefeuille : le faux cabinet et la fausse plateforme ne font qu'un. Le courrier le laissait deviner : il citait l'adresse de collecte et le montant exact perdu.`,
        },
        {
          id: 'o3', type: 'amount', points: 15, unit: 'BTC', tolerance: 0.01,
          prompt: `Quel montant total (en BTC) ${vp.name} a-t-${g('il', 'elle')} versé au faux cabinet ?`,
          answer: totalFees,
          hint: 'N\'additionnez que les sorties de paiement, pas les rendus revenus vers le portefeuille de la victime.',
          explanation: `${fees.map((f) => `${amt(f.value, 'BTC')} (${f.label})`).join(' + ')} = ${amt(totalFees, 'BTC')}, soit environ ${eur(totalFees)}. Le préjudice cumulé de la victime atteint ${amt(victimTotal, 'BTC')}.`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme les fonds regroupés sont-ils encaissés ?',
          answer: [outKey],
          hint: 'Suivez la sortie principale de la transaction de regroupement : à qui l\'outil attribue-t-il l\'adresse, et où est-elle balayée ?',
          explanation: `Le regroupement envoie ${amt(d2V, 'BTC')} vers une adresse de dépôt ${out.entity.name}, balayée ensuite vers son hot wallet ; le reste (${amt(zV, 'BTC')}) revient en rendu vers ${A(w, Z)}. Quelques mois plus tôt, la première collecte avait déjà été encaissée chez ${out.entity.name} (dépôt ${A(w, D1)}). ${procedureFor(out.entity)}`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Quelle adresse de dépôt a reçu les frais regroupés ?',
          answer: [D2],
          hint: 'Dans la transaction de regroupement, distinguez le paiement (montant rond, adresse attribuée à un exchange) du rendu.',
          explanation: `${A(w, D2)} reçoit ${amt(d2V, 'BTC')} : montant rond, adresse attribuée à ${out.entity.name} et balayée avec d'autres dépôts. C'est elle qu'il faut viser dans la réquisition (titulaire du compte, KYC, connexions), avec l'adresse de dépôt ${A(w, D1)} de la première escroquerie : deux dépôts du même portefeuille criminel désignent probablement le même compte client.`,
        },
        {
          id: 'o6', type: 'choice', points: 10,
          prompt: `Que répondre à ${vp.name}, qui demande s'${g('il', 'elle')} doit payer la « garantie de solvabilité » ?`,
          ...choice(r,
            'Ne plus rien verser et rompre le contact : aucun avocat ni service officiel ne réclame des frais en crypto-actifs pour restituer des fonds ; conserver les échanges et compléter la plainte',
            [
              'Payer cette dernière garantie si le cabinet fournit une attestation tamponnée, la procédure étant presque terminée',
              'Envoyer un petit montant « test » pour vérifier que le cabinet restitue bien les fonds',
              'Se tourner vers un autre cabinet de récupération, mieux noté en ligne, en exigeant un paiement au résultat',
            ]),
          hint: 'Relisez le courrier et les vérifications en sources ouvertes : qui peut ordonner une restitution, et à quel prix pour la victime ?',
          explanation: `Une restitution de fonds saisis est décidée par l'autorité judiciaire et ne coûte rien à la victime. Signaux d'alerte réunis ici : frais exigés d'avance et en bitcoins, urgence, consigne de ne pas parler à la police, faux « agrément AMF », avocat introuvable, site récent. L'adresse de « séquestre » (${A(w, sq.hot).slice(0, 14)}…) est un hot wallet de ${sq.entity.name} sans rapport avec le dossier : le solde affiché sert seulement à rassurer. Toute nouvelle demande, y compris d'un autre « cabinet », doit être considérée comme une nouvelle tentative.`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Quel sort donner à la nouvelle plainte ?',
          ...choice(r,
            `La rapprocher de la procédure initiale et en aviser le magistrat saisi : même portefeuille, donc même réseau, qui revictimise ${g('le plaignant', 'la plaignante')}`,
            [
              'La traiter séparément : le faux cabinet et la fausse plateforme sont, par nature, des auteurs différents',
              'La classer : la victime a payé volontairement des frais à un prestataire',
              'Attendre les réponses aux réquisitions de la première procédure avant de l\'enregistrer',
            ]),
          hint: 'Le lien établi on-chain désigne-t-il deux groupes d\'auteurs distincts, ou un seul portefeuille ?',
          explanation: `Le lien on-chain (entrées communes entre les frais et la collecte ${dePLAT}) établit un même portefeuille, donc très probablement les mêmes auteurs. Rapprocher les procédures permet de cumuler le préjudice (${amt(victimTotal, 'BTC')} pour cette victime), de requérir ${out.entity.name} sur les deux dépôts en une fois, et d'identifier les autres victimes : celles de la plateforme comme celles du « cabinet », à partir des retraits Coinhouse et Bitstamp qui alimentent le cluster.`,
        },
      ],
      truth: {
        path: [...p1.map((x) => x.id), c1.id, cash1.id, sweep1.id, late.id, ...fees.flatMap((f) => [f.buy.id, f.pay.id]), L.id, sweep2.id],
        addresses: [S0, ...Sx, K1, D1, ...R, ...Rx, D2, Z, ...fees.map((f) => f.from)],
        debrief:
          `1. Première escroquerie : ${vp.name} verse ${amt(r8(total1), 'BTC')} en ${nP1} fois sur ${A(w, S0)}, adresse de collecte ${dePLAT}. Le ${fmtDate(c1.time, false)}, cette adresse est regroupée avec ${nOther1} autres collectes, dont ${A(w, pivot)}, puis ${amt(d1V, 'BTC')} sont encaissés chez ${out.entity.name}.\n` +
          `2. L'adresse ${A(w, pivot)} reçoit ensuite un paiement tardif d'une autre victime (${amt(lateV, 'BTC')}), qui reste dormant.\n` +
          `3. Seconde escroquerie : « ${REC} » puis le « ${firm} » obtiennent ${n} paiements (${fees.map((f) => amt(f.value, 'BTC')).join(', ')}), soit ${amt(totalFees, 'BTC')}. Chaque paiement part du portefeuille personnel de la victime avec un rendu.\n` +
          `4. Le ${fmtDate(L.time, false)}, une seule transaction dépense les adresses de frais, celles d'autres victimes du cabinet et l'adresse pivot : la preuve, par entrées communes, que la fausse plateforme et le faux cabinet partagent le même portefeuille.\n` +
          `5. ${amt(d2V, 'BTC')} partent vers ${A(w, D2)} (${out.entity.name}), ${amt(zV, 'BTC')} restent en rendu.\n\n` +
          `À retenir : l'escroquerie à la récupération est souvent commise par le réseau initial, qui sait exactement qui a perdu quoi. Le clustering transforme une intuition (« ils connaissaient mon dossier ») en lien démontrable. Réflexes : prévenir la victime qu'aucun service légitime ne fait payer une restitution, joindre ou rapprocher les procédures, et requérir l'exchange de sortie sur l'ensemble des dépôts du cluster.`,
      },
      hints: [
        'Commencez par les adresses des messages WhatsApp : où leurs fonds repartent-ils ?',
        'Une transaction qui dépense ensemble plusieurs adresses désigne un même propriétaire : ouvrez le panneau cluster de l\'une d\'elles.',
        'L\'adresse de collecte de la première plainte appartient-elle au même cluster ? Cherchez l\'entrée qui figure dans les deux regroupements.',
      ],
    }
  },
}
