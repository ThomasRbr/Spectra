import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

// Faux conseiller bancaire : l'escroc dicte la MÊME adresse à toutes ses
// victimes (adresse réutilisée), la vide après chaque paiement vers un
// portefeuille de collecte, puis regroupe la collecte en une transaction à
// trois sorties : dépôt sur un exchange, abonnement VPN et rendu. Le rendu
// repart vers une seconde plateforme ; un reliquat dort. Habillage : deux
// victimes antérieures sur la même adresse, de la poussière, une collecte
// qui mêle plusieurs victimes. Le chemin principal reste net (mission n° 1).

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
/** Même jour (UTC) que `ts`, à l'heure UTC `h` (heures de bureau à Paris). */
const atUtcHour = (ts: number, h: number) => Math.floor(ts / DAY) * DAY + h * HOUR
/** Délai lisible (« 7 heures », « 31 heures ») entre deux horodatages. */
function delai(dt: number): string {
  const h = Math.round(dt / HOUR)
  return h < 1 ? 'moins d\'une heure' : `${h} heure${h > 1 ? 's' : ''}`
}

export const s01FirstTrace: ScenarioTemplate = {
  id: 'first-trace',
  title: 'Faux conseiller bancaire',
  tagline: 'Votre premier traçage Bitcoin, de la victime jusqu\'à l\'exchange.',
  description:
    'Une victime a été convaincue par un faux conseiller de « sécuriser » son épargne en bitcoins. Suivez les fonds saut par saut jusqu\'à la plateforme où l\'escroc les a déposés. L\'adresse dictée par SMS a déjà servi pour d\'autres victimes : apprenez à reconnaître la transaction qui transporte VOTRE paiement, à écarter la poussière, puis suivez les branches secondaires (paiement d\'un service, rendu qui repart vers une seconde plateforme) et préparez la réquisition.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'requisition'],
  estMinutes: 35,
  lessons: ['bases-blockchain', 'utxo', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'btc')
    const destKey = r.pick(['binance', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'btc')
    const ex2Key = r.pick(['kraken', 'coinbase'] as const)
    const ex2 = exchange(w, ex2Key, 'btc')
    const vpn = w.entity('mullvad')
    const vpnAddr = w.addr('btc', { entity: vpn, label: 'Mullvad VPN — Paiements' })

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const suspect = w.customEntity({ name: 'Faux conseiller (inconnu)', category: 'suspect' })

    // Adresse dictée par SMS (réutilisée pour toutes les victimes) et portefeuille de collecte
    const s1 = w.addr('btc', { entity: suspect })
    const s2 = w.addr('btc', { entity: suspect, kind: w.get(s1).kind })

    // ── Deux victimes antérieures, même adresse, même scénario ──────────────
    // Chaque paiement est vidé vers la collecte quelques heures plus tard.
    const prior: { payer: string; pay: Tx; fwd: Tx; value: number }[] = []
    const priorTimes = [-r.float(140, 200), -r.float(28, 44)]
    for (const h of priorTimes) {
      const payer = w.addr('btc', { kind: 'p2wpkh' })
      const value = roundCoin(w, 0.08, 0.6, 0.005)
      const t = w.at(h)
      w.fund(payer, r8(value * r.float(1.05, 1.5)), t - Math.round(r.float(6, 72) * HOUR))
      const pay = w.utxoTx({ time: t, from: [payer], to: [{ address: s1, value }] })
      const fwd = forwardAll(w, s1, s2, t + Math.round(r.float(1.5, 6) * HOUR))
      prior.push({ payer, pay, fwd, value })
    }
    const witness = prior[1]

    // ── Achat de la victime sur Coinhouse, puis paiement à l'escroc ─────────
    const amount = roundCoin(w, 0.18, 0.95, 0.01)
    // Achat en journée, trois ou quatre jours avant le paiement, juste après l'appel de l'escroc
    const buyT = atUtcHour(w.at(-24 * r.int(3, 4)), r.int(8, 16)) + r.int(0, 50) * 60
    const callT = buyT - r.int(35, 110) * 60
    cv.withdraw(victim, +(amount + r.float(0.002, 0.01)).toFixed(6), buyT)
    const t1 = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: s1, value: amount }] })

    // Saut vers la collecte : seule l'UTXO de la victime est disponible à cet instant
    const t2 = forwardAll(w, s1, s2, w.at(r.float(1.5, 7)))
    const fwdValue = r8(receivedIn(w, t2, s2))

    // ── Regroupement de la collecte : dépôt + VPN + rendu ───────────────────
    const t3T = w.at(r.float(10, 30))
    const total = r8(w.unspentValue(s2, t3T))
    const nCollected = w.utxosOf(s2, t3T).length
    const deposit = dest.newDeposit()
    const depValue = +(total * r.float(0.78, 0.9)).toFixed(6)
    const vpnValue = +r.float(0.0006, 0.0018).toFixed(6)
    const s3 = w.addr('btc', { entity: suspect, kind: w.get(s2).kind })
    const t3 = w.utxoTx({ time: t3T, from: [s2], to: [{ address: deposit, value: depValue }, { address: vpnAddr, value: vpnValue }], change: s3, spendAll: true })
    const sweep = dest.sweep([deposit], t3.time + r.int(2, 10) * HOUR)[0]

    // ── Le rendu repart vers une seconde plateforme ; un reliquat dort ──────
    const s4 = w.addr('btc', { entity: suspect, kind: w.get(s3).kind })
    const ex2Value = +(w.unspentValue(s3) * r.float(0.55, 0.75)).toFixed(6)
    const out2 = ex2.receive(s3, ex2Value, w.at(r.float(34, 45)), { change: s4, sweepDelayH: r.float(1, 6) })

    // ── Habillage : poussière sur l'adresse dictée par SMS (après les faits) ─
    // Créée après le flux : elle reste non dépensée et ne modifie aucun montant.
    const dust = dusting(w, s1, { time: t2.time + Math.round(r.float(20, 40) * HOUR), n: 2, spreadH: 14 })
    const dustCount = dust.txs.length

    // ── Bruit de fond des plateformes ───────────────────────────────────────
    dest.noise(14, w.at(-48), w.at(96))
    ex2.noise(8, w.at(-48), w.at(96))
    cv.noise(8, buyT - 2 * DAY, w.at(48))

    const depositReceived = receivedIn(w, t3, deposit)
    const changeT3 = r8(receivedIn(w, t3, s3))
    const ex2Received = receivedIn(w, out2.tx, out2.deposit)
    const leftover = r8(receivedIn(w, out2.tx, s4))
    const ex2Name = ex2.entity.name
    const nPayers = prior.length + 1
    const witnessP = fakePerson(r)
    const witnessCity = fakeCity(r)
    // Audition en journée, deux jours après les faits ; le chef de groupe et la brigade voisine suivent
    const plainteT = atUtcHour(w.at(48), r.int(7, 11)) + r.int(0, 50) * 60
    const noteT = plainteT + r.int(90, 150) * 60
    const signalT = plainteT + r.int(160, 260) * 60
    const renduDelay = delai(out2.tx.time - t3.time)
    const brigade = `brigade ${de(witnessCity)}`

    return {
      world: w,
      title: `Escroquerie au faux conseiller — ${city}`,
      briefing:
        `Le ${fmtDate(plainteT, false)}, ${victimName}, demeurant à ${city}, dépose plainte pour escroquerie.\n\n` +
        `Un individu se présentant comme « conseiller sécurité » de sa banque l'a ${g('convaincu', 'convaincue')} que son compte était piraté et qu'${g('il', 'elle')} devait convertir son épargne en bitcoins puis les transférer vers un « coffre-fort numérique ».\n\n` +
        `${g('Il', 'Elle')} a acheté ${amt(amount, 'BTC')} sur Coinhouse puis les a envoyés depuis son portefeuille personnel. Une autre brigade signale par ailleurs une plainte au mode opératoire identique.\n\n` +
        `Votre mission : suivre les fonds dans toutes leurs branches, identifier les plateformes où ils ont été déposés et les éléments à citer dans les réquisitions, et localiser ce que l'escroc détient encore. Attention : l'adresse dictée par SMS n'a pas servi qu'à cette victime.`,
      evidence: [
        {
          id: 'plainte',
          type: 'plainte',
          title: 'Procès-verbal de plainte (extrait)',
          date: plainteT,
          author: victimName,
          body:
            `« Le ${fmtDate(callT)}, j'ai reçu un appel du ${fakePhone(r)}. L'homme connaissait mon nom et ma banque. Il m'a dit que mon compte allait être vidé.\n\n` +
            `Sur ses instructions, j'ai acheté des bitcoins sur Coinhouse dans la foulée et je les ai retirés vers mon portefeuille. Le ${fmtDate(t1.time)}, il m'a ${g('rappelé', 'rappelée')} et je les ai envoyés à l'adresse qu'il venait de m'envoyer par SMS.\n\n` +
            `Mon adresse de portefeuille : ${A(w, victim)}\n` +
            `Identifiant de la transaction fourni par mon application : ${t1.hash} »`,
        },
        {
          id: 'sms',
          type: 'sms',
          title: 'Capture du SMS reçu',
          date: w.at(-0.2),
          author: 'Expéditeur masqué',
          body: `Votre coffre sécurisé est prêt. Adresse de transfert BTC :\n${A(w, s1)}\nNe communiquez ce code à personne. Service Sécurité.`,
        },
        {
          id: 'signalement',
          type: 'pv',
          title: `Message de la ${brigade}`,
          date: signalT,
          author: `Brigade ${de(witnessCity)}`,
          body:
            `Plainte ${de(witnessP.name)} : appel d'un faux « conseiller sécurité », achat de bitcoins, envoi vers un « coffre » dicté par SMS.\n\n` +
            `${witnessP.g('Le plaignant', 'La plaignante')} indique avoir envoyé ${amt(witness.value, 'BTC')} le ${fmtDate(witness.pay.time, false)}. ${witnessP.g('Il', 'Elle')} n'a conservé ni l'adresse ni le hash.\n\n` +
            `Si l'adresse figure dans votre procédure, merci de nous le faire savoir pour jonction éventuelle.`,
        },
        {
          id: 'note',
          type: 'note',
          title: 'Note du chef de groupe',
          date: noteT,
          author: 'Chef de groupe — SR',
          body:
            `Une adresse dictée à plusieurs victimes a plusieurs entrées et plusieurs sorties : ne suis que la transaction qui dépense LE paiement de notre victime. Une transaction antérieure à son paiement ne peut pas transporter son argent.\n\n` +
            `Pour la réquisition, il me faut l'adresse de dépôt ET la transaction qui l'alimente (hash, date, montant) : la plateforme doit pouvoir retrouver l'opération sans ambiguïté.\n\n` +
            `Ne t'arrête pas à la plus grosse sortie : un paiement de service ou un rendu qui repart ensuite peuvent mener à un autre compte de l'escroc. Termine en indiquant ce qu'il détient encore à la date de l'analyse.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Vers quelle adresse l\'escroc transfère-t-il le paiement de la victime, quelques heures après l\'avoir reçu ?',
          answer: [s2],
          hint: 'Sélectionnez l\'adresse dictée par SMS et classez ses transactions par date : prenez la première dépense POSTÉRIEURE au paiement de la victime. Elle n\'a qu\'une seule sortie.',
          explanation: `Le ${fmtDate(t2.time)}, ${A(w, s1)} est vidée en une seule sortie de ${amt(fwdValue, 'BTC')} vers ${A(w, s2)}, adresse non attribuée du même type : c'est la dépense de l'UTXO de la victime (montant reçu moins les frais). Les deux autres dépenses de l'adresse SMS sont ANTÉRIEURES au paiement : elles vident les versements d'autres victimes et ne peuvent pas contenir son argent. Elles vont d'ailleurs vers la même adresse ${A(w, s2).slice(0, 12)}… : c'est le portefeuille de collecte de l'escroc.`,
        },
        {
          id: 'o12', type: 'number', points: 8, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de victimes (celle de la plainte comprise) ont payé l\'adresse dictée par SMS ?',
          answer: nPayers,
          hint: 'Listez les entrées de l\'adresse SMS et comptez les portefeuilles émetteurs. Les montants de 0,00000546 BTC ne sont pas des paiements.',
          explanation: `${nPayers} victimes : ${victimName} et ${prior.length} autres, dont celle signalée par la ${brigade} (${amt(witness.value, 'BTC')} le ${fmtDate(witness.pay.time, false)} : date et montant concordent, le rapprochement est possible). Les ${dustCount} entrées de 546 satoshis venues d'adresses inconnues sont de la poussière, pas des versements : on ne les compte pas. Un escroc qui dicte la même adresse à toutes ses victimes facilite leur recensement.`,
        },
        {
          id: 'o13', type: 'choice', points: 6,
          prompt: `Après les faits, l'adresse dictée par SMS reçoit ${dustCount} fois 0,00000546 BTC d'adresses inconnues. Comment les traiter ?`,
          ...choice(r,
            'Comme de la poussière : des montants infimes sans lien avec l\'escroquerie, à ne pas suivre ni compter',
            [
              'Comme de nouvelles victimes, à identifier en priorité',
              'Comme la preuve que l\'escroc a déplacé les fonds vers ces adresses',
              'Comme des frais de réseau remboursés par les mineurs',
            ]),
          hint: 'Comparez ces montants à ceux des paiements des victimes, et regardez dans quel sens ils circulent.',
          explanation: '546 satoshis est le plus petit montant qu\'une sortie Bitcoin standard peut porter (seuil de « poussière »). Des envois de ce type arrivent sur des adresses déjà utilisées, souvent à des fins publicitaires ou de pistage. Ils entrent sur l\'adresse et n\'en sortent pas : rien à voir avec les fonds de la victime, et aucune victime ne paie une « sécurisation » de quelques centimes. On les note puis on les écarte.',
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction verse les fonds sur l\'adresse de dépôt de la plateforme ? Son hash figurera dans la réquisition.',
          answer: [t3.id],
          hint: 'C\'est la transaction qui dépense le portefeuille de collecte : elle a plusieurs entrées et trois sorties.',
          explanation: `La transaction ${t3.hash.slice(0, 16)}… du ${fmtDate(t3.time)} regroupe les ${nCollected} versements reçus par la collecte ${A(w, s2).slice(0, 12)}… (celui de la victime et ceux des victimes antérieures) et crée trois sorties : le dépôt ${dest.entity.name}, le paiement Mullvad et le rendu de l'escroc. C'est elle qu'on cite (hash, date, montant crédité) avec l'adresse de dépôt : la plateforme retrouve ainsi l'opération et le compte crédité.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Quelle plateforme reçoit la plus grosse part des fonds regroupés ?',
          answer: [destKey],
          hint: 'Suivez la plus grosse sortie de la transaction de regroupement. Une adresse étiquetée « Adresse de dépôt », ou balayée peu après vers un hot wallet étiqueté, appartient à un exchange.',
          explanation: `Les fonds passent par l'adresse SMS puis par la collecte, et ${amt(depositReceived, 'BTC')} sont déposés sur ${dest.entity.name}. L'adresse de dépôt est ensuite balayée (sweep) vers le hot wallet de la plateforme, avec d'autres dépôts clients.`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: 'Quelle adresse désigne le compte client de l\'escroc sur cette plateforme ?',
          answer: [deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse unique attribuée au client, juste avant le balayage.',
          explanation: 'Sur Bitcoin, chaque client reçoit une adresse de dépôt unique : c\'est elle qui permet à l\'exchange de retrouver le titulaire du compte. Le hot wallet, lui, mélange tous les clients.',
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.02,
          prompt: 'Combien de BTC cette adresse de dépôt reçoit-elle dans la transaction de regroupement ?',
          answer: depositReceived,
          hint: 'Dans la transaction de dépôt, lisez la sortie destinée à l\'adresse de dépôt, pas le total de la transaction.',
          explanation: `${amt(depositReceived, 'BTC')}. ${depositReceived > amount ? `C'est plus que le paiement de la victime (${amt(amount, 'BTC')})` : `Ce n'est pas le paiement de la victime (${amt(amount, 'BTC')}) à l'identique`} : la collecte mêlait les versements de ${nPayers} victimes (${amt(total, 'BTC')} au total). Le reste se partage entre l'abonnement VPN et l'adresse de rendu de l'escroc.`,
        },
        {
          id: 'o8', type: 'entity', points: 7,
          prompt: 'Quel service l\'escroc a-t-il payé dans la même transaction que le dépôt ?',
          answer: ['mullvad'],
          hint: 'La transaction de dépôt a une petite sortie vers une adresse étiquetée : laquelle ?',
          explanation: `${amt(vpnValue, 'BTC')} partent vers « Mullvad VPN — Paiements » : l'escroc s'offre un abonnement VPN, qui masquera ses adresses IP. C'est une information de contexte (préparation, volonté de dissimulation) plus qu'une piste : un fournisseur VPN payé en crypto ne connaît souvent qu'un numéro de compte, sans identité. Cela annonce aussi que les IP fournies par l'exchange risquent d'être celles d'un VPN.`,
        },
        {
          id: 'o7', type: 'address', points: 10,
          prompt: 'Des trois sorties du regroupement, laquelle revient à l\'escroc (rendu) ?',
          answer: [s3],
          hint: 'Des trois sorties, deux portent une étiquette (exchange, VPN). La troisième revient au portefeuille de l\'escroc.',
          explanation: `${A(w, s3)} reçoit ${amt(changeT3, 'BTC')} : la seule sortie non attribuée, du même type d'adresse que les entrées, et l'escroc la dépense lui-même ${renduDelay} plus tard. Contrairement au rendu de la victime, ce rendu-là est une piste : il faut le suivre.`,
        },
        {
          id: 'o11', type: 'choice', points: 7,
          prompt: 'Sur quoi vous appuyez-vous pour affirmer que cette sortie est le rendu de l\'escroc ?',
          ...choice(r,
            'Seule sortie non attribuée, même type d\'adresse que les entrées, et dépensée ensuite par l\'escroc lui-même',
            [
              'C\'est la plus petite sortie de la transaction, et le rendu est toujours la plus petite',
              'Elle porte l\'étiquette « rendu » dans la base d\'attribution de l\'outil',
              'Son montant est rond, ce qui signe à coup sûr une sortie de rendu',
            ]),
          hint: 'Comparez les trois sorties : étiquette, type d\'adresse, et ce que devient chacune ensuite.',
          explanation: 'Les deux autres sorties sont attribuées (adresse de dépôt d\'exchange, paiement Mullvad). La troisième n\'est connue d\'aucune base, utilise le même type d\'adresse que les adresses dépensées, et c\'est l\'escroc qui la dépense ensuite. Aucun de ces indices ne suffit seul ; leur convergence, si. La taille d\'une sortie n\'est pas un critère, et un montant rond évoque plutôt un paiement.',
        },
        {
          id: 'o9', type: 'entity', points: 10,
          prompt: 'Vers quelle seconde plateforme ce rendu est-il ensuite en partie envoyé ?',
          answer: [ex2Key],
          hint: 'Dépliez les sorties de l\'adresse de rendu : une adresse de dépôt étiquetée apparaît.',
          explanation: `Le ${fmtDate(out2.tx.time)}, le rendu envoie ${amt(ex2Received, 'BTC')} sur une adresse de dépôt ${ex2Name}, balayée ensuite vers son hot wallet. L'escroc dispose donc d'un second compte : ${ex2Name} est à requérir à son tour (adresse de dépôt ${A(w, out2.deposit).slice(0, 14)}…, transaction ${out2.tx.hash.slice(0, 12)}…). ${procedureFor(ex2.entity)} Deux plateformes, deux KYC : s'ils désignent la même personne, l'identification est consolidée.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) l\'escroc détient-il encore, sur une adresse jamais dépensée, à la fin du traçage ?',
          answer: leftover,
          hint: 'Suivez le rendu de la transaction vers la seconde plateforme : sa nouvelle adresse de rendu a un solde non nul.',
          explanation: `${amt(leftover, 'BTC')} reposent sur ${A(w, s4)}, rendu de la transaction vers ${ex2Name}, jamais dépensé. On la marque Suspect et on la place sous surveillance : si elle bouge, elle peut révéler un troisième point de sortie. Les quelques satoshis de poussière restés sur l'adresse SMS ne comptent pas : ils n'ont jamais appartenu aux victimes. Du bitcoin ne se gèle pas à distance : sa récupération passera par une saisie, une fois le titulaire identifié.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Quelle démarche engager en priorité pour identifier l\'escroc ?',
          ...choice(r,
            'Requérir la plateforme de destination sur l\'adresse de dépôt (KYC, IP, IBAN) et demander un gel',
            [
              'Requérir Coinhouse, plateforme d\'achat de la victime, sur le hot wallet de destination',
              'Classer le volet financier : Bitcoin est anonyme, les fonds sont perdus',
              'Requérir d\'abord le fournisseur VPN payé par l\'escroc, qui détient son identité',
            ]),
          hint: 'Qui détient l\'identité du titulaire d\'une adresse de dépôt ?',
          explanation: `La plateforme de destination détient le KYC du titulaire de l'adresse de dépôt. On demande aussi les adresses IP de connexion, les moyens de paiement liés et un gel conservatoire du compte. ${procedureFor(dest.entity)} Coinhouse n'est que la plateforme d'achat de la victime ; le VPN, payé en crypto, ne connaît qu'un numéro de compte anonyme. La même démarche vaut pour ${ex2Name}, second point de sortie. On informe aussi la ${brigade} : la personne qui y a porté plainte a payé la même adresse.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, sweep.id, out2.tx.id, ...(out2.sweep ? [out2.sweep.id] : [])],
        addresses: [s1, s2, s3, deposit, out2.deposit, s4],
        debrief:
          `1. La victime envoie ${amt(amount, 'BTC')} vers ${A(w, s1)}, l'adresse dictée par SMS. Cette adresse avait déjà reçu les versements de ${prior.length} autres victimes, chacun vidé dans les heures suivantes vers la même collecte : l'escroc dicte la même adresse à tout le monde.\n` +
          `2. Quelques heures après le paiement, l'escroc transfère ${amt(fwdValue, 'BTC')} vers son portefeuille de collecte ${A(w, s2)} : un saut sans rendu, postérieur au paiement (les deux dépenses antérieures de l'adresse SMS concernent les autres victimes).\n` +
          `3. Par la transaction ${t3.hash.slice(0, 12)}…, il regroupe les ${nCollected} versements de la collecte, dépose ${amt(depositReceived, 'BTC')} sur une adresse de dépôt ${dest.entity.name}, paie ${amt(vpnValue, 'BTC')} à Mullvad VPN et garde ${amt(changeT3, 'BTC')} sur une adresse de rendu ${A(w, s3)}.\n` +
          `4. ${dest.entity.name} balaie l'adresse de dépôt vers son hot wallet avec d'autres dépôts clients : c'est le point d'arrêt du traçage on-chain pour cette branche.\n` +
          `5. ${renduDelay[0].toUpperCase() + renduDelay.slice(1)} après le regroupement, le rendu repart : ${amt(ex2Received, 'BTC')} sur une adresse de dépôt ${ex2Name}, et ${amt(leftover, 'BTC')} restent sur ${A(w, s4)}, jamais dépensés.\n` +
          `6. Les ${dustCount} entrées de 546 satoshis reçues ensuite par l'adresse SMS sont de la poussière, sans lien avec l'affaire.\n\n` +
          `Réflexes : sur une adresse réutilisée, on suit la dépense postérieure au paiement de la victime, pas la première venue. Dès qu'un exchange est identifié, on s'arrête au dépôt et on réquisitionne, en citant l'adresse de dépôt et la transaction qui l'alimente. On suit toutes les autres branches, à commencer par le rendu de l'escroc : ici, il mène à un second compte, chez ${ex2Name}, et à un reliquat à surveiller. Les ${prior.length} autres versements reçus par l'adresse SMS désignent d'autres victimes, à rapprocher (${brigade}).`,
      },
      hints: [
        'Commencez par déplier les sorties de l\'adresse de la victime (clic droit ▸ Déplier les sorties, ou bouton « Sorties » du panneau d\'adresse).',
        'L\'adresse dictée par SMS a plusieurs dépenses : seule celle qui suit le paiement de la victime transporte son argent. Les montants de 546 satoshis sont de la poussière.',
        'Dans une transaction Bitcoin, la sortie qui revient vers le portefeuille émetteur s\'appelle le rendu (change). Les étiquettes colorées indiquent les entités connues de la base d\'attribution.',
        'Le rendu de l\'escroc n\'est pas une impasse : dépliez-le à son tour, il peut repartir vers une autre plateforme.',
      ],
    }
  },
}
