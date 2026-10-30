import { World, type Tx } from '../engine/world'
import { atm, exchange, HOUR, DAY } from '../engine/patterns'
import { ASSETS, EUR_USD, roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor, receivedIn } from './util'

// Escroquerie au faux conseiller bancaire : la victime insère des espèces
// dans des DAB crypto en scannant le QR code de l'escroc. Les bitcoins sont
// revendus de gré à gré (P2P) à des acheteurs qui paient en euros, et une
// mule retire le reste en espèces sur un autre distributeur.

const BANKS = ['Banque Hexagone', 'Crédit Saint-Martin', 'Caisse d\'Épargne du Val', 'Banque Populaire des Rives'] as const
const FEE = 0.1

const btc = (v: number) => roundAsset('BTC', v)
const eur = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`

/** Cours appliqué au guichet, commission incluse (€ par BTC). */
const RATE_EUR = ASSETS.BTC.usd / EUR_USD / (1 - FEE)

export const dabCashP2p: ScenarioTemplate = {
  id: 'dab-cash-p2p',
  title: 'Le faux conseiller et la borne crypto',
  tagline: 'Des billets dans un distributeur, un QR code, puis des acheteurs P2P et une mule au guichet.',
  description:
    'Un faux conseiller bancaire convainc une victime de « sécuriser » son épargne en insérant des billets dans des distributeurs de crypto-actifs. Identifiez l\'exploitant à requérir et l\'adresse de l\'escroc, reconstituez la somme en espèces, puis suivez la revente de gré à gré et le retrait en espèces d\'une mule.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 42,
  lessons: ['dab-cash-p2p', 'utxo', 'change-heuristics', 'typologies', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    let muleCity = fakeCity(r)
    while (muleCity === city) muleCity = fakeCity(r)
    const victimP = fakePerson(r, 'f')
    const victimName = victimP.name
    const age = r.int(71, 86)
    const bank = r.pick(BANKS)
    const fakeAdvisor = fakePerson(r)
    const handle = fakeHandle(r)
    const machines = [`CG-0${r.int(100, 499)}`, `CG-0${r.int(500, 899)}`]
    const muleMachine = `CG-1${r.int(100, 499)}`

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const dab = atm(w, 'cryptoguichet', 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    const scamE = w.customEntity({ name: '« Service sécurité » (faux conseiller, inconnu)', category: 'suspect' })
    const scam = w.addr('btc', { entity: scamE, kind: 'p2wpkh' })

    // Autre victime, quelques jours plus tôt, sur la même adresse
    const tV = w.at(0)
    const priorCash = [r.int(60, 99) * 10, r.int(40, 99) * 10]
    const priorTxs = priorCash.map((c, i) => dab.cashIn({ cashEur: c, to: scam, time: tV - Math.round(r.float(3, 6) * DAY) + i * Math.round(r.float(1, 3) * HOUR), feePct: FEE }).tx)

    // ── Dépôts d'espèces de la victime (deux jours, deux bornes) ────────────
    const nDay1 = r.int(2, 3)
    const nDay2 = r.int(2, 3)
    const sessions: { cash: number; tx: Tx; value: number; machine: string }[] = []
    let t = tV
    for (let i = 0; i < nDay1 + nDay2; i++) {
      if (i === nDay1) t = tV + DAY + Math.round(r.float(-1, 2) * HOUR)
      else if (i > 0) t += Math.round(r.float(0.6, 2.5) * HOUR)
      const cash = r.int(80, 99) * 10
      const machine = machines[i < nDay1 ? (i === 0 ? 0 : 1) : r.int(0, 1)]
      const res = dab.cashIn({ cashEur: cash, to: scam, time: t, feePct: FEE })
      sessions.push({ cash, tx: res.tx, value: res.value, machine })
    }
    const victimBtc = btc(sessions.reduce((s, x) => s + x.value, 0))
    const victimEur = Math.round(sessions.reduce((s, x) => s + x.value, 0) * RATE_EUR)
    const kept = sessions[r.int(0, nDay1 - 1)]
    const lastSession = sessions[sessions.length - 1].tx.time
    const withdrawn = Math.ceil(victimEur / 500) * 500 + r.pick([0, 500])

    // ── Revente P2P puis mule ───────────────────────────────────────────────
    const total = w.unspentValue(scam)
    const b1v = btc(total * r.float(0.24, 0.34))
    const b2v = btc(total * r.float(0.15, 0.24))
    const buyer1 = w.addr('btc', { kind: r.pick(['p2pkh', 'p2sh'] as const) })
    const buyer2 = w.addr('btc', { kind: r.pick(['p2pkh', 'p2sh', 'p2tr'] as const) })
    const c1 = w.addr('btc', { entity: scamE, kind: 'p2wpkh', wallet: w.get(scam).wallet })
    const c2 = w.addr('btc', { entity: scamE, kind: 'p2wpkh', wallet: w.get(scam).wallet })
    const c3 = w.addr('btc', { entity: scamE, kind: 'p2wpkh', wallet: w.get(scam).wallet })
    const tS1 = lastSession + Math.round(r.float(3, 10) * HOUR)
    const sale1 = w.utxoTx({ time: tS1, from: [scam], to: [{ address: buyer1, value: b1v }], change: c1, spendAll: true })
    const sale2 = w.utxoTx({ time: tS1 + Math.round(r.float(5, 18) * HOUR), from: [c1], to: [{ address: buyer2, value: b2v }], change: c2, spendAll: true })
    const muleE = w.customEntity({ name: 'Mule (inconnue)', category: 'individual' })
    const mule = w.addr('btc', { entity: muleE, kind: 'p2wpkh' })
    const muleV = btc(w.unspentValue(c2) * r.float(0.82, 0.92))
    const toMule = w.utxoTx({ time: sale2.time + Math.round(r.float(4, 14) * HOUR), from: [c2], to: [{ address: mule, value: muleV }], change: c3, spendAll: true })
    const cashOutV = btc(muleV - 0.0001)
    const out = dab.cashOut({ from: mule, value: cashOutV, time: toMule.time + Math.round(r.float(16, 40) * HOUR), change: null, sweepDelayH: r.float(2, 12) })
    const ticket = out.deposit

    // L'acheteur 1 dépose ses bitcoins chez Coinhouse ; l'acheteur 2 les conserve
    const b1dep = cv.receive(buyer1, btc(b1v - 0.0002), sale1.time + Math.round(r.float(1, 4) * DAY), { change: null })

    // ── Bruit ────────────────────────────────────────────────────────────────
    dab.noise(26, tV - 7 * DAY, out.tx.time + 2 * DAY)
    cv.noise(8, tV - 7 * DAY, out.tx.time + 2 * DAY)

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const plainteDate = lastSession + Math.round(r.float(1.5, 2.5) * DAY)
    const tol = Math.max(20, Math.round(victimEur * 0.015))
    const daysLeft = Math.max(1, 30 - Math.round((plainteDate - kept.tx.time) / DAY))
    // Autre victime (achats antérieurs), délai de revente, reliquat de l'escroc
    const priorBtc = btc(priorTxs.reduce((s, x) => s + receivedIn(w, x, scam), 0))
    const resaleH = Math.round(((tS1 - lastSession) / HOUR) * 10) / 10
    const c3V = receivedIn(w, toMule, c3)
    const rateTxt = RATE_EUR.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return {
      world: w,
      title: `Le faux conseiller de ${bank} — ${city}`,
      briefing:
        `${victimName}, ${age} ans, demeurant à ${city}, a été appelée par un « conseiller du service sécurité » de sa banque, ${bank}. Selon lui, des fraudeurs s'apprêtaient à vider ses comptes : il fallait retirer son épargne en espèces et la « mettre à l'abri » en l'insérant dans une « borne de sécurisation », en scannant un QR code reçu par SMS.\n\n` +
        `Pendant deux jours, elle a inséré des billets dans des distributeurs de crypto-actifs installés chez des buralistes. Les bitcoins achetés sont partis vers l'adresse de l'escroc. Elle n'a conservé qu'un seul ticket.\n\n` +
        `Objectifs : identifier l'exploitant des distributeurs et l'adresse de l'escroc, reconstituer la somme en espèces réellement insérée (et repérer une éventuelle autre victime), suivre la revente des bitcoins, le retrait en espèces de la mule et ce qui reste à l'escroc, et hiérarchiser les actes urgents.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteDate, author: victimName,
          body:
            `« Le conseiller s'appelait ${fakeAdvisor.name}, il connaissait mon nom et le nom de mon agence. Il m'a dit que je devais faire vite et ne rien dire au guichet de la banque.\n\n` +
            `J'ai retiré ${eur(withdrawn)} en liquide en plusieurs fois. Le ${fmtDate(sessions[0].tx.time, false)}, je suis allée dans deux bureaux de tabac, et je suis retournée le lendemain. À chaque fois je scannais le QR code du SMS, je mettais les billets, pas plus de 1 000 € à la fois comme il me l'avait dit. Je ne sais plus combien exactement, il me reste un peu d'argent à la maison.\n\n` +
            `J'ai jeté les tickets comme il me l'avait demandé, sauf un que j'ai retrouvé dans mon sac. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Ticket de distributeur remis par la victime (photographie)', date: kept.tx.time,
          body:
            `[logo illisible] — TICKET CLIENT\n` +
            `Borne n° ${kept.machine}\n` +
            `Date : ${fmtDate(kept.tx.time)}\n` +
            `Opération : ACHAT BTC\n` +
            `Montant inséré : ${kept.cash.toLocaleString('fr-FR')},00 €\n` +
            `Cours appliqué (frais inclus) : 1 BTC = ${rateTxt} €\n` +
            `Montant envoyé : ${amt(kept.value, 'BTC')}\n` +
            `Adresse : ${A(w, scam).slice(0, 8)}…${A(w, scam).slice(-5)}\n` +
            `Transaction : ${kept.tx.hash}\n` +
            `Conservez ce ticket. Aucune annulation possible.`,
        },
        {
          id: 'sms', type: 'sms', title: 'SMS reçus par la victime', date: sessions[0].tx.time - 2 * HOUR, author: 'Expéditeur « SECU-BANQUE »',
          body:
            `« ${bank} – Service sécurité : votre dossier de protection est ouvert. Rendez-vous à la borne la plus proche et scannez le QR code ci-joint. Ne communiquez ce code à personne, y compris à votre agence. »\n` +
            `[image : QR code]\n` +
            `« Merci Madame, nous avons bien reçu votre dépôt. Merci de continuer demain, le plafond journalier est presque atteint. »`,
        },
        {
          id: 'osint', type: 'osint', title: 'Annonce relevée sur un groupe Telegram d\'échange P2P', date: tS1 - 3 * HOUR, author: 'Cellule cyber',
          body:
            `Vendeur « ${handle} » : « Vends BTC propres (minage), paiement par virement instantané ou espèces en main propre, envoi immédiat après réception. Petites et moyennes quantités. »\n` +
            `Le même pseudonyme apparaît dans d'autres groupes de revente. Dans une vente P2P, l'acheteur paie le vendeur en euros (virement ou espèces) puis reçoit les bitcoins : il détient donc des informations sur le vendeur (compte bancaire, numéro de téléphone, lieu de rendez-vous).`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : DAB crypto', date: plainteDate, author: 'Cellule d\'appui',
          body:
            `• Achat au guichet : le client insère des espèces, l'exploitant envoie les bitcoins depuis son portefeuille chaud vers l'adresse scannée. Toutes les ventes de l'exploitant partent donc de la même adresse.\n` +
            `• Vente au guichet : le client envoie ses bitcoins vers une adresse propre à son ticket, puis retire des espèces. Chaque adresse de ticket désigne une opération précise, donc un appareil, une heure et un client.\n` +
            `• L'exploitant d'un réseau de distributeurs est un prestataire enregistré : il conserve les tickets, le numéro de téléphone vérifié et, au-delà de ses seuils, une pièce d'identité. La vidéosurveillance des appareils n'est conservée que peu de temps.`,
        },
      ],
      seeds: [scam],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 8,
          prompt: 'Quel exploitant de distributeurs faut-il requérir ?',
          answer: ['cryptoguichet'],
          hint: 'Ouvrez la transaction du ticket : l\'adresse qui envoie les bitcoins est attribuée.',
          explanation: `Les achats partent du portefeuille chaud ${A(w, dab.hot)}, attribué à CryptoGuichet. ${procedureFor(dab.entity)}`,
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse de l\'escroc qui a reçu les bitcoins ?',
          answer: [scam],
          hint: 'Le ticket ne montre l\'adresse que tronquée : le hash de la transaction, lui, est complet.',
          explanation: `La transaction du ticket envoie ${amt(kept.value, 'BTC')} à ${A(w, scam)}, cohérente avec l'adresse tronquée imprimée. Cette adresse a aussi reçu, quelques jours plus tôt, deux achats au guichet d'une autre personne : d'autres victimes sont probables.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) l\'adresse de l\'escroc avait-elle déjà reçu avant les faits dénoncés par la plaignante ?',
          answer: priorBtc,
          hint: 'Triez les transactions entrantes de l\'adresse de l\'escroc par date : additionnez celles qui précèdent le premier jour décrit dans la plainte.',
          explanation: `Deux achats au guichet, ${priorTxs.map((x) => fmtDate(x.time, false)).join(' et ')}, envoient ${priorTxs.map((x) => amt(receivedIn(w, x, scam), 'BTC')).join(' + ')} = ${amt(priorBtc, 'BTC')} à la même adresse, soit environ ${priorCash.map(eur).join(' et ')} insérés. Ils partent eux aussi du portefeuille chaud de CryptoGuichet, à quelques heures d'intervalle et sous 1 000 € : même mode opératoire, très probablement une autre victime du même faux conseiller. La réquisition à l'exploitant doit les inclure : le téléphone vérifié lors de ces achats identifiera cette personne, qui n'a peut-être pas encore porté plainte.`,
        },
        {
          id: 'o3', type: 'number', points: 12, unit: '€', tolerance: tol,
          prompt: 'Quelle somme en espèces la victime a-t-elle réellement insérée dans les distributeurs ?',
          answer: victimEur,
          hint: 'Ne retenez que les achats au guichet des deux jours décrits par la victime, additionnez les bitcoins reçus et appliquez le cours imprimé sur le ticket (frais inclus).',
          explanation: `${sessions.length} achats au guichet les ${fmtDate(sessions[0].tx.time, false)} et ${fmtDate(sessions[sessions.length - 1].tx.time, false)} : ${sessions.map((x) => amt(x.value, 'BTC')).join(' + ')} = ${amt(victimBtc, 'BTC')}. Au cours appliqué de ${rateTxt} €/BTC, cela représente ${eur(victimEur)} (${sessions.map((x) => eur(x.cash)).join(' + ')}). Les deux achats antérieurs (${priorCash.map(eur).join(' et ')}) ne concernent pas la victime : ils précèdent les faits de plusieurs jours. Chaque dépôt reste sous 1 000 € : l'escroc connaissait le seuil au-delà duquel l'exploitant exige une pièce d'identité.`,
        },
        {
          id: 'o11', type: 'number', points: 8, unit: 'heures', tolerance: 1,
          prompt: 'Combien d\'heures se sont écoulées entre le dernier dépôt d\'espèces de la victime et la première revente des bitcoins ?',
          answer: resaleH,
          hint: 'Comparez l\'horodatage du dernier achat au guichet de la victime et celui de la première dépense de l\'adresse de l\'escroc.',
          explanation: `Environ ${resaleH.toLocaleString('fr-FR')} heures : la première vente P2P part le ${fmtDate(tS1)}, alors que le dernier achat de la victime date du ${fmtDate(lastSession)}. Les escrocs liquident vite, souvent avant même que la victime ne réalise la fraude. Ce délai montre que l'acheteur était prêt à l'avance (annonce publiée quelques heures plus tôt) et justifie, dans les affaires en cours, une réaction immédiate dès la plainte.`,
        },
        {
          id: 'o4', type: 'addresses', points: 10,
          prompt: 'Quelles adresses correspondent aux acheteurs P2P des bitcoins ?',
          answer: [buyer1, buyer2],
          hint: 'Suivez les dépenses de l\'adresse de l\'escroc : distinguez à chaque fois le paiement du rendu (même type d\'adresse, même logiciel), puis écartez l\'adresse dont les fonds finissent au guichet.',
          explanation: `Deux ventes successives paient ${A(w, buyer1)} (${amt(b1v, 'BTC')}) puis ${A(w, buyer2)} (${amt(b2v, 'BTC')}), le rendu revenant à chaque fois sur une nouvelle adresse du même portefeuille (${A(w, c1).slice(0, 12)}…, ${A(w, c2).slice(0, 12)}…). Le premier acheteur dépose ensuite ses bitcoins chez Coinhouse : une réquisition l'identifiera, et il pourra dire comment il a payé le vendeur. Le troisième paiement, vers ${A(w, mule).slice(0, 12)}…, n'est pas une vente : ces fonds sont retirés en espèces.`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'un des acheteurs P2P a-t-il ensuite déposé les bitcoins achetés ?',
          answer: ['coinhouse'],
          hint: 'Suivez la dépense de chacune des adresses d\'acheteurs : l\'une d\'elles finit sur une adresse de dépôt attribuée.',
          explanation: `${A(w, buyer1)} envoie ${amt(b1dep.tx.outputs.find((x) => x.address === b1dep.deposit)?.value ?? 0, 'BTC')} vers une adresse de dépôt Coinhouse le ${fmtDate(b1dep.tx.time, false)}, balayée ensuite vers le hot wallet. ${procedureFor(cv.entity)} La réquisition identifie le titulaire du compte : entendu comme témoin, il dira comment il a payé le vendeur « ${handle} » (IBAN bénéficiaire du virement, numéro de téléphone, lieu de remise d'espèces), ce qui remonte vers l'escroc. Le second acheteur conserve ses bitcoins : il faudra une autre voie pour l'identifier.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quel statut donner, à ce stade, aux acheteurs P2P ?',
          ...choice(r,
            'Des témoins à identifier et entendre : ils ont payé le vendeur en euros, et leur moyen de paiement remonte vers l\'escroc ; leur bonne foi se vérifie sans être présumée',
            [
              'Des complices de l\'escroquerie, puisqu\'ils détiennent des bitcoins issus de la victime',
              'Des personnes sans intérêt pour l\'enquête : une vente de gré à gré est anonyme par nature',
              'Des victimes, à qui la plaignante doit rembourser les bitcoins achetés',
            ]),
          hint: 'Relisez l\'annonce relevée par la cellule cyber : que détient l\'acheteur sur le vendeur ?',
          explanation: `L'acheteur P2P a payé le vendeur avant de recevoir les bitcoins : il connaît le moyen de paiement (IBAN, téléphone, lieu de rendez-vous) et peut décrire l'échange. Il n'est pas suspect par principe, mais sa bonne foi doit être vérifiée (prix anormalement bas, achats répétés auprès du même vendeur, liens avec le réseau). Le recel suppose la connaissance de l'origine frauduleuse, qui ne se présume pas.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Quelle adresse appartient à la mule chargée de retirer les espèces ?',
          answer: [mule],
          hint: 'Après les deux ventes, la troisième dépense de l\'escroc paie une adresse qui revend aussitôt tout son solde à un distributeur.',
          explanation: `${A(w, mule)} reçoit ${amt(muleV, 'BTC')} de l'escroc le ${fmtDate(toMule.time)}, puis envoie la quasi-totalité vers une adresse de ticket CryptoGuichet ${Math.round((out.tx.time - toMule.time) / HOUR)} heures plus tard. Ce n'est pas une vente P2P : aucun dépôt sur une plateforme, aucune conservation, mais une conversion immédiate en espèces sur une autre borne, dans une autre ville. C'est le profil d'une mule, rémunérée pour retirer l'argent au guichet et le remettre au réseau.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Quelle adresse de ticket correspond au retrait en espèces effectué par la mule ?',
          answer: [ticket],
          hint: 'La dernière adresse alimentée par l\'escroc envoie tout son solde vers une adresse de l\'exploitant des distributeurs : c\'est une vente au guichet.',
          explanation: `Le ${fmtDate(out.tx.time)}, ${A(w, mule)} envoie ${amt(cashOutV, 'BTC')} vers ${A(w, ticket)}, adresse de ticket de vente CryptoGuichet, soit un retrait d'environ ${eur(out.cashEur)} en espèces. Cette adresse désigne une opération unique : l'exploitant peut indiquer l'appareil, l'heure, le numéro de téléphone et, au-dessus de son seuil de 1 000 €, la pièce d'identité et le selfie du client.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Après l\'envoi à la mule, sur quelle adresse reste le reliquat des fonds de l\'escroc ?',
          answer: [c3],
          hint: 'La transaction vers la mule a deux sorties : l\'une est revendue au guichet, l\'autre est un rendu qui ne bouge plus.',
          explanation: `${A(w, c3)} reçoit le rendu de l'envoi à la mule (${amt(c3V, 'BTC')}), sur une adresse neuve du même portefeuille que les rendus précédents (${A(w, c1).slice(0, 12)}…, ${A(w, c2).slice(0, 12)}…). Ces fonds n'ont pas bougé : l'adresse est à surveiller, car une prochaine dépense (nouvelle vente P2P, dépôt sur une plateforme) offrirait un nouveau point d'identification, voire de gel.`,
        },
        {
          id: 'o6', type: 'choice', points: 9,
          prompt: 'Quel acte faut-il engager en priorité ?',
          ...choice(r,
            `Requérir sans délai l'exploitant pour figer et obtenir les vidéos des bornes utilisées, dont la conservation est courte`,
            [
              `Attendre l'identité de la mule communiquée par l'exploitant avant de demander les vidéos, afin de mieux cibler la demande ultérieure`,
              `Solliciter un juge d'instruction : les vidéos d'une borne ne peuvent être obtenues que sur commission rogatoire`,
              `Renoncer aux vidéos : la pièce d'identité fournie au guichet suffit pour identifier et confondre la mule`,
            ]),
          hint: 'Relisez la note de l\'analyste : parmi les données de l\'exploitant, lesquelles disparaissent le plus vite ?',
          explanation: `Les images ne sont conservées qu'une trentaine de jours : il reste environ ${daysLeft} jours pour les premiers dépôts de la victime. La réquisition (art. 60-1 ou 77-1-1 du CPP selon le cadre d'enquête) vise en même temps les tickets de la victime, ceux de la mule (adresse ${A(w, ticket)}) et les vidéos des appareils ${machines.join(', ')} et ${muleMachine}. Une pièce d'identité peut être empruntée ou fausse : l'image de la personne au guichet reste décisive. Pensez aussi aux caméras des commerces qui hébergent les bornes.`,
        },
      ],
      truth: {
        path: [...sessions.map((s) => s.tx.id), ...priorTxs.map((t) => t.id), sale1.id, sale2.id, toMule.id, out.tx.id, ...(out.sweep ? [out.sweep.id] : []), b1dep.tx.id],
        addresses: [scam, c1, c2, c3, buyer1, buyer2, mule, ticket],
        debrief:
          `1. Le faux conseiller fournit par SMS un QR code contenant l'adresse ${A(w, scam)}, déjà utilisée quelques jours plus tôt pour une autre personne (${priorCash.map(eur).join(' et ')}, soit ${amt(priorBtc, 'BTC')}).\n` +
          `2. Sur deux jours, ${victimName} effectue ${sessions.length} achats au guichet chez CryptoGuichet, tous sous 1 000 € : ${eur(victimEur)} en espèces, soit ${amt(victimBtc, 'BTC')} après une commission de 10 %.\n` +
          `3. ${resaleH.toLocaleString('fr-FR')} heures après le dernier dépôt, l'escroc revend ${amt(b1v, 'BTC')} puis ${amt(b2v, 'BTC')} à deux acheteurs P2P (le premier dépose ensuite chez Coinhouse), en récupérant le rendu sur de nouvelles adresses de son portefeuille.\n` +
          `4. Il envoie ${amt(muleV, 'BTC')} à une mule, qui les revend sur la borne ${muleMachine} à ${muleCity} : environ ${eur(out.cashEur)} en espèces, via l'adresse de ticket ${A(w, ticket)}. Le reliquat reste sur ${A(w, c3)}.\n\n` +
          `À retenir : le DAB crypto est une porte d'entrée et de sortie des espèces. Les achats partent tous du portefeuille chaud de l'exploitant ; chaque vente a sa propre adresse de ticket. L'exploitant, prestataire enregistré, détient tickets, téléphones, pièces d'identité au-delà de ses seuils et vidéos, ces dernières conservées peu de temps : la réquisition est urgente. Les acheteurs P2P ne sont pas des suspects par principe, mais des témoins qui ont payé le vendeur : leur paiement (virement, rendez-vous) remonte vers l'escroc.`,
      },
      hints: [
        'Cliquez le hash imprimé sur le ticket : la transaction montre l\'émetteur (l\'exploitant) et le destinataire.',
        'Sur l\'adresse de l\'escroc, triez les entrées par date : seules celles des deux jours de la plainte concernent la victime.',
        'L\'outil d\'analyse du rendu aide à séparer, dans chaque dépense, le paiement de la monnaie rendue.',
        'Une adresse qui envoie tout son solde vers une adresse de ticket de l\'exploitant effectue une vente au guichet.',
        'Les entrées antérieures aux faits et les rendus qui ne bougent plus comptent aussi : autre victime d\'un côté, reliquat à surveiller de l\'autre.',
      ],
    }
  },
}
