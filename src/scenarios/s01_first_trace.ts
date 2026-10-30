import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

export const s01FirstTrace: ScenarioTemplate = {
  id: 'first-trace',
  title: 'Faux conseiller bancaire',
  tagline: 'Votre premier traçage Bitcoin, de la victime jusqu\'à l\'exchange.',
  description:
    'Une victime a été convaincue par un faux conseiller de « sécuriser » son épargne en bitcoins. Suivez les fonds saut par saut jusqu\'à la plateforme où l\'escroc les a déposés, sans oublier les branches secondaires (paiement d\'un service, rendu qui repart vers une seconde plateforme), puis préparez la réquisition.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'requisition'],
  estMinutes: 30,
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
    const vpn = w.entity('mullvad')
    const vpnAddr = w.addr('btc', { entity: vpn, label: 'Mullvad VPN — Paiements' })

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const suspect = w.customEntity({ name: 'Faux conseiller (inconnu)', category: 'suspect' })

    // Achat initial sur Coinhouse
    const amount = roundCoin(w, 0.18, 0.95, 0.01)
    const buyT = w.at(-3 * 24 - r.int(0, 30))
    cv.withdraw(victim, +(amount + r.float(0.002, 0.01)).toFixed(6), buyT)

    // Paiement à l'escroc
    const s1 = w.addr('btc', { entity: suspect })
    const t1 = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: s1, value: amount }] })

    // Saut intermédiaire
    const s2 = w.addr('btc', { entity: suspect, kind: w.get(s1).kind })
    const t2 = forwardAll(w, s1, s2, w.at(r.float(1.5, 7)))

    // Répartition : dépôt sur l'exchange + petit achat + reste conservé
    const deposit = dest.newDeposit()
    const total = w.unspentValue(s2)
    const depValue = +(total * r.float(0.78, 0.9)).toFixed(6)
    const vpnValue = +r.float(0.0006, 0.0018).toFixed(6)
    const s3 = w.addr('btc', { entity: suspect, kind: w.get(s2).kind })
    const t3 = w.utxoTx({ time: w.at(r.float(10, 30)), from: [s2], to: [{ address: deposit, value: depValue }, { address: vpnAddr, value: vpnValue }], change: s3 })
    const sweep = dest.sweep([deposit], t3.time + r.int(2, 10) * HOUR)[0]

    // Second point de sortie : le rendu repart, avant la plainte, vers une autre plateforme ;
    // un reliquat reste sur une nouvelle adresse de rendu, jamais dépensée
    const ex2Key = r.pick(['kraken', 'coinbase'] as const)
    const ex2 = exchange(w, ex2Key, 'btc')
    const s4 = w.addr('btc', { entity: suspect, kind: w.get(s3).kind })
    const ex2Value = +(w.unspentValue(s3) * r.float(0.55, 0.75)).toFixed(6)
    const out2 = ex2.receive(s3, ex2Value, w.at(r.float(34, 45)), { change: s4, sweepDelayH: r.float(1, 6) })

    // Bruit
    dest.noise(14, w.at(-48), w.at(96))
    ex2.noise(8, w.at(-48), w.at(96))
    cv.noise(8, buyT - 2 * DAY, w.at(48))

    const depositReceived = receivedIn(w, t3, deposit)
    const changeT3 = Math.round(receivedIn(w, t3, s3) * 1e8) / 1e8
    const ex2Received = receivedIn(w, out2.tx, out2.deposit)
    const leftover = Math.round(receivedIn(w, out2.tx, s4) * 1e8) / 1e8
    const ex2Name = ex2.entity.name

    return {
      world: w,
      title: `Escroquerie au faux conseiller — ${city}`,
      briefing:
        `Le ${fmtDate(w.at(2 * 24), false)}, ${victimName}, demeurant à ${city}, dépose plainte pour escroquerie.\n\n` +
        `Un individu se présentant comme « conseiller sécurité » de sa banque l'a ${g('convaincu', 'convaincue')} que son compte était piraté et qu'${g('il', 'elle')} devait convertir son épargne en bitcoins puis les transférer vers un « coffre-fort numérique ».\n\n` +
        `${g('Il', 'Elle')} a acheté ${amt(amount, 'BTC')} sur Coinhouse puis les a envoyés depuis son portefeuille personnel. Votre mission : suivre les fonds dans toutes leurs branches, identifier les plateformes où ils ont été déposés et les éléments à citer dans les réquisitions, et localiser ce que l'escroc détient encore.`,
      evidence: [
        {
          id: 'plainte',
          type: 'plainte',
          title: 'Procès-verbal de plainte (extrait)',
          date: w.at(48),
          author: victimName,
          body:
            `« Le ${fmtDate(w.at(0))}, j'ai reçu un appel du ${fakePhone(r)}. L'homme connaissait mon nom et ma banque. Il m'a dit que mon compte allait être vidé.\n\n` +
            `Sur ses instructions, j'ai acheté des bitcoins sur Coinhouse, je les ai retirés vers mon portefeuille, puis je les ai envoyés à l'adresse qu'il m'a dictée par SMS.\n\n` +
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
          id: 'note',
          type: 'note',
          title: 'Note du chef de groupe',
          date: w.at(50),
          author: 'Chef de groupe — SR',
          body:
            `Pour la réquisition, il me faut l'adresse de dépôt ET la transaction qui l'alimente (hash, date, montant) : la plateforme doit pouvoir retrouver l'opération sans ambiguïté.\n\n` +
            `Ne t'arrête pas à la plus grosse sortie : un paiement de service ou un rendu qui repart quelques heures plus tard peuvent mener à un autre compte de l'escroc. Termine en indiquant ce qu'il détient encore à la date de l'analyse.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Vers quelle adresse l\'escroc transfère-t-il d\'abord la totalité du paiement de la victime ?',
          answer: [s2],
          hint: 'Dépliez les sorties de l\'adresse dictée par SMS : la transaction suivante n\'a qu\'une seule sortie.',
          explanation: `Quelques heures après le paiement, ${A(w, s1)} est vidée en une seule sortie vers ${A(w, s2)}, adresse non attribuée du même type. Une transaction sans rendu qui transfère tout le solde est un saut interne au portefeuille de l'escroc : il éloigne les fonds de l'adresse communiquée à la victime.`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction alimente l\'adresse de dépôt de l\'exchange ? (elle sera citée dans la réquisition)',
          answer: [t3.id],
          hint: 'C\'est la transaction qui dépense la seconde adresse de l\'escroc : elle a trois sorties.',
          explanation: `La transaction ${t3.hash.slice(0, 16)}… du ${fmtDate(t3.time)} dépense ${A(w, s2).slice(0, 12)}… et crée trois sorties : le dépôt ${dest.entity.name}, le paiement Mullvad et le rendu de l'escroc. C'est elle qu'on cite (hash, date, montant crédité) avec l'adresse de dépôt : la plateforme retrouve ainsi l'opération et le compte crédité.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme la majorité des fonds a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Suivez la plus grosse sortie de chaque transaction. Une adresse étiquetée « Adresse de dépôt », ou balayée peu après vers un hot wallet étiqueté, appartient à un exchange.',
          explanation: `Les fonds passent par deux adresses de l'escroc puis ${amt(depositReceived, 'BTC')} sont déposés sur ${dest.entity.name}. L'adresse de dépôt est ensuite balayée (sweep) vers le hot wallet de la plateforme, avec d'autres dépôts clients.`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: 'Quelle est l\'adresse de dépôt à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse unique attribuée au client, juste avant le balayage.',
          explanation: 'Sur Bitcoin, chaque client reçoit une adresse de dépôt unique : c\'est elle qui permet à l\'exchange de retrouver le titulaire du compte. Le hot wallet, lui, mélange tous les clients.',
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant (en BTC) a été crédité sur cette adresse de dépôt ?',
          answer: depositReceived,
          hint: 'Dans la transaction de dépôt, lisez la sortie destinée à l\'adresse de dépôt, pas le total de la transaction.',
          explanation: `${amt(depositReceived, 'BTC')} : le reste a servi à payer un abonnement VPN et est resté sur une adresse de rendu contrôlée par l'escroc.`,
        },
        {
          id: 'o8', type: 'entity', points: 8,
          prompt: 'Quel service l\'escroc a-t-il payé dans la même transaction que le dépôt ?',
          answer: ['mullvad'],
          hint: 'La transaction de dépôt a une petite sortie vers une adresse étiquetée : laquelle ?',
          explanation: `${amt(vpnValue, 'BTC')} partent vers « Mullvad VPN — Paiements » : l'escroc s'offre un abonnement VPN, qui masquera ses adresses IP. C'est une information de contexte (préparation, volonté de dissimulation) plus qu'une piste : un fournisseur VPN payé en crypto ne connaît souvent qu'un numéro de compte, sans identité. Cela annonce aussi que les IP fournies par l'exchange risquent d'être celles d'un VPN.`,
        },
        {
          id: 'o7', type: 'address', points: 10,
          prompt: 'Dans la transaction de dépôt, quelle sortie est le rendu qui revient à l\'escroc ?',
          answer: [s3],
          hint: 'Des trois sorties, deux portent une étiquette (exchange, VPN). La troisième revient au portefeuille de l\'escroc.',
          explanation: `${A(w, s3)} reçoit ${amt(changeT3, 'BTC')} : la seule sortie non attribuée, du même type d'adresse que l'entrée, et l'escroc la dépense lui-même quelques heures plus tard. Contrairement au rendu de la victime, ce rendu-là est une piste : il faut le suivre.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quel faisceau d\'indices désigne cette sortie comme le rendu de l\'escroc ?',
          ...choice(r,
            'Seule sortie non attribuée, même type d\'adresse que l\'entrée, et dépensée ensuite par l\'escroc lui-même',
            [
              'C\'est la plus petite sortie de la transaction, et le rendu est toujours la plus petite',
              'Elle porte l\'étiquette « rendu » dans la base d\'attribution de l\'outil',
              'Son montant est rond, ce qui signe à coup sûr une sortie de rendu',
            ]),
          hint: 'Comparez les trois sorties : étiquette, type d\'adresse, et ce que devient chacune ensuite.',
          explanation: 'Les deux autres sorties sont attribuées (adresse de dépôt d\'exchange, paiement Mullvad). La troisième n\'est connue d\'aucune base, utilise le même type d\'adresse que l\'adresse dépensée, et c\'est l\'escroc qui la dépense ensuite. Aucun de ces indices ne suffit seul ; leur convergence, si. La taille d\'une sortie n\'est pas un critère, et un montant rond évoque plutôt un paiement.',
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
          explanation: `${amt(leftover, 'BTC')} reposent sur ${A(w, s4)}, rendu de la transaction vers ${ex2Name}, jamais dépensé. On la marque Suspect et on la place sous surveillance : si elle bouge, elle peut révéler un troisième point de sortie. Du bitcoin ne se gèle pas à distance : sa récupération passera par une saisie, une fois le titulaire identifié.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Quelle est la suite d\'enquête la plus pertinente ?',
          ...choice(r,
            'Requérir la plateforme de destination sur l\'adresse de dépôt (KYC, IP, IBAN) et demander un gel',
            [
              'Requérir Coinhouse, plateforme d\'achat de la victime, sur le hot wallet de destination',
              'Classer le volet financier : Bitcoin est anonyme, les fonds sont perdus',
              'Requérir d\'abord le fournisseur VPN payé par l\'escroc, qui détient son identité',
            ]),
          hint: 'Qui détient l\'identité du titulaire d\'une adresse de dépôt ?',
          explanation: `La plateforme de destination détient le KYC du titulaire de l'adresse de dépôt. On demande aussi les adresses IP de connexion, les moyens de paiement liés et un gel conservatoire du compte. ${procedureFor(dest.entity)} Coinhouse n'est que la plateforme d'achat de la victime ; le VPN, payé en crypto, ne détient souvent qu'une adresse e-mail. La même démarche vaut pour ${ex2Name}, second point de sortie.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, sweep.id, out2.tx.id, ...(out2.sweep ? [out2.sweep.id] : [])],
        addresses: [s1, s2, s3, deposit, out2.deposit, s4],
        debrief:
          `1. La victime envoie ${amt(amount, 'BTC')} vers ${A(w, s1)} (adresse dictée par SMS).\n` +
          `2. L'escroc transfère la totalité vers une seconde adresse ${A(w, s2)} : c'est un saut sans rendu (tout le solde part).\n` +
          `3. Par la transaction ${t3.hash.slice(0, 12)}…, il dépose ${amt(depositReceived, 'BTC')} sur une adresse de dépôt ${dest.entity.name}, paie ${amt(vpnValue, 'BTC')} à Mullvad VPN et garde ${amt(changeT3, 'BTC')} sur une adresse de rendu ${A(w, s3)}.\n` +
          `4. ${dest.entity.name} balaie l'adresse de dépôt vers son hot wallet avec d'autres dépôts clients : c'est le point d'arrêt du traçage on-chain pour cette branche.\n` +
          `5. Quelques heures plus tard, le rendu repart : ${amt(ex2Received, 'BTC')} sur une adresse de dépôt ${ex2Name}, et ${amt(leftover, 'BTC')} restent sur ${A(w, s4)}, jamais dépensés.\n\n` +
          `Réflexes : dès qu'un exchange est identifié, on s'arrête au dépôt et on réquisitionne, en citant l'adresse de dépôt et la transaction qui l'alimente. Suivre le hot wallet n'a plus de sens. En revanche, on suit toutes les autres branches, à commencer par le rendu de l'escroc : ici, il mène à un second compte, chez ${ex2Name}, et à un reliquat à surveiller.`,
      },
      hints: [
        'Commencez par déplier les sorties de l\'adresse de la victime (clic droit ▸ Déplier les sorties, ou bouton « Sorties » du panneau d\'adresse).',
        'Dans une transaction Bitcoin, la sortie qui revient vers le portefeuille émetteur s\'appelle le rendu (change).',
        'Les étiquettes colorées indiquent les entités connues de la base d\'attribution.',
        'Le rendu de l\'escroc n\'est pas une impasse : dépliez-le à son tour, il peut repartir vers une autre plateforme.',
      ],
    }
  },
}
