import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

export const s01FirstTrace: ScenarioTemplate = {
  id: 'first-trace',
  title: 'Faux conseiller bancaire',
  tagline: 'Votre premier traçage Bitcoin, de la victime jusqu\'à l\'exchange.',
  description:
    'Une victime a été convaincue par un faux conseiller de « sécuriser » son épargne en bitcoins. Suivez les fonds saut par saut jusqu\'à la plateforme où l\'escroc les a déposés, puis préparez la réquisition.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'requisition'],
  estMinutes: 10,
  lessons: ['bases-blockchain', 'utxo', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinvault', 'btc')
    const destKey = r.pick(['binova', 'nordex', 'kaizen'] as const)
    const dest = exchange(w, destKey, 'btc')
    const vpn = w.entity('shieldvpn')
    const vpnAddr = w.addr('btc', { entity: vpn, label: 'ShieldVPN — Paiements' })

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const suspect = w.customEntity({ name: 'Faux conseiller (inconnu)', category: 'suspect' })

    // Achat initial sur Coinvault
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

    // Bruit
    dest.noise(14, w.at(-48), w.at(96))
    cv.noise(8, buyT - 2 * DAY, w.at(48))

    const depositReceived = receivedIn(w, t3, deposit)

    return {
      world: w,
      title: `Escroquerie au faux conseiller — ${city}`,
      briefing:
        `Le ${fmtDate(w.at(2 * 24), false)}, ${victimName}, demeurant à ${city}, dépose plainte pour escroquerie.\n\n` +
        `Un individu se présentant comme « conseiller sécurité » de sa banque l'a ${g('convaincu', 'convaincue')} que son compte était piraté et qu'${g('il', 'elle')} devait convertir son épargne en bitcoins puis les transférer vers un « coffre-fort numérique ».\n\n` +
        `${g('Il', 'Elle')} a acheté ${amt(amount, 'BTC')} sur Coinvault puis les a envoyés depuis son portefeuille personnel. Votre mission : suivre les fonds, identifier la plateforme où ils ont été déposés et l'adresse de dépôt à réquisitionner.`,
      evidence: [
        {
          id: 'plainte',
          type: 'plainte',
          title: 'Procès-verbal de plainte (extrait)',
          date: w.at(48),
          author: victimName,
          body:
            `« Le ${fmtDate(w.at(0))}, j'ai reçu un appel du ${fakePhone(r)}. L'homme connaissait mon nom et ma banque. Il m'a dit que mon compte allait être vidé.\n\n` +
            `Sur ses instructions, j'ai acheté des bitcoins sur Coinvault, je les ai retirés vers mon portefeuille, puis je les ai envoyés à l'adresse qu'il m'a dictée par SMS.\n\n` +
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
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 30,
          prompt: 'Sur quelle plateforme la majorité des fonds a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Suivez la plus grosse sortie de chaque transaction. Une adresse étiquetée « Adresse de dépôt », ou balayée peu après vers un hot wallet étiqueté, appartient à un exchange.',
          explanation: `Les fonds passent par deux adresses de l'escroc puis ${amt(depositReceived, 'BTC')} sont déposés sur ${dest.entity.name}. L'adresse de dépôt est ensuite balayée (sweep) vers le hot wallet de la plateforme, avec d'autres dépôts clients.`,
        },
        {
          id: 'o2', type: 'address', points: 30,
          prompt: 'Quelle est l\'adresse de dépôt à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse unique attribuée au client, juste avant le balayage.',
          explanation: 'Sur Bitcoin, chaque client reçoit une adresse de dépôt unique : c\'est elle qui permet à l\'exchange de retrouver le titulaire du compte. Le hot wallet, lui, mélange tous les clients.',
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant (en BTC) a été crédité sur cette adresse de dépôt ?',
          answer: depositReceived,
          explanation: `${amt(depositReceived, 'BTC')} : le reste a servi à payer un abonnement VPN et est resté sur une adresse de rendu contrôlée par l'escroc.`,
        },
        {
          id: 'o4', type: 'choice', points: 20,
          prompt: 'Quelle est la suite d\'enquête la plus pertinente ?',
          ...choice(r,
            'Requérir la plateforme de destination sur l\'adresse de dépôt (KYC, IP, IBAN) et demander un gel',
            [
              'Requérir Coinvault, plateforme d\'achat de la victime, sur le hot wallet de destination',
              'Classer le volet financier : Bitcoin est anonyme, les fonds sont perdus',
              'Requérir d\'abord le fournisseur VPN payé par l\'escroc, qui détient son identité',
            ]),
          explanation: `La plateforme de destination détient le KYC du titulaire de l'adresse de dépôt. On demande aussi les adresses IP de connexion, les moyens de paiement liés et un gel conservatoire du compte. ${procedureFor(dest.entity)} Coinvault n'est que la plateforme d'achat de la victime ; le VPN, payé en crypto, ne détient souvent qu'une adresse e-mail.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, sweep.id],
        addresses: [s1, s2, s3, deposit],
        debrief:
          `1. La victime envoie ${amt(amount, 'BTC')} vers ${A(w, s1)} (adresse dictée par SMS).\n` +
          `2. L'escroc transfère la totalité vers une seconde adresse ${A(w, s2)} : c'est un saut sans rendu (tout le solde part).\n` +
          `3. Il dépose ${amt(depositReceived, 'BTC')} sur une adresse de dépôt ${dest.entity.name}, paie ${amt(vpnValue, 'BTC')} à ShieldVPN et conserve le reste sur une adresse de rendu.\n` +
          `4. ${dest.entity.name} balaie l'adresse de dépôt vers son hot wallet avec d'autres dépôts clients : c'est le point d'arrêt du traçage on-chain.\n\n` +
          `Réflexe : dès qu'un exchange est identifié, on s'arrête au dépôt et on réquisitionne. Suivre le hot wallet n'a plus de sens.`,
      },
      hints: [
        'Commencez par déplier les sorties de l\'adresse de la victime (clic droit ▸ Déplier les sorties, ou bouton « Sorties » du panneau d\'adresse).',
        'Dans une transaction Bitcoin, la sortie qui revient vers le portefeuille émetteur s\'appelle le rendu (change).',
        'Les étiquettes colorées indiquent les entités connues de la base d\'attribution.',
      ],
    }
  },
}
