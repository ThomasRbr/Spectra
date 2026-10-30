import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { fromUsd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fakePhone, fmtDate } from './util'

/** Satoshis → BTC (valeur exacte à 8 décimales). */
const sat = (n: number) => Math.round(n) / 1e8
/** Arrondi à 8 décimales. */
const r8 = (v: number) => Math.round(v * 1e8) / 1e8

export const btcChangeAnatomy: ScenarioTemplate = {
  id: 'change-anatomy',
  title: 'Anatomie d\'une transaction',
  tagline: 'Entrées, sorties, frais et rendu : apprenez à lire une transaction Bitcoin.',
  description:
    'Un faux vendeur de véhicules d\'occasion s\'est fait payer en bitcoins. Pour suivre l\'argent, il faut distinguer, dans chaque transaction, le paiement du rendu (change) qui revient au portefeuille de l\'escroc. Appliquez les heuristiques classiques : type d\'adresse, montant rond, adresse neuve, réutilisation d\'adresse, puis les entrées communes pour rattacher une seconde victime.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change'],
  estMinutes: 35,
  lessons: ['bases-blockchain', 'utxo', 'change-heuristics', 'clustering'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakeName(r)
    const city = fakeCity(r)

    // Types d'adresse : le portefeuille de l'escroc est homogène (K), les
    // destinataires de paiements utilisent d'autres types.
    const K: AddrKind = r.pick(['p2wpkh', 'p2wpkh', 'p2tr'] as const)
    const otherKinds = (['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as AddrKind[]).filter((k) => k !== K)
    const victimKind: AddrKind = r.pick(['p2pkh', 'p2sh'] as const)

    // Deux plateformes de dépôt distinctes, tirées au sort
    const [kB, kD] = r.pickN(['binance', 'bitstamp', 'kraken', 'coinbase', 'okx'] as const, 2)
    const cv = exchange(w, 'coinhouse', 'btc')
    const exB = exchange(w, kB, 'btc')
    const exD = exchange(w, kD, 'btc')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Faux vendeur « AutoPrestige »', category: 'suspect' })
    const muleE = w.customEntity({ name: 'Complice (non identifié)', category: 'individual' })
    const thirdE = w.customEntity({ name: 'Bénéficiaire inconnu', category: 'individual' })

    // ── Victime : portefeuille ancien, alimenté depuis Coinhouse ─────────────
    const victim = w.addr('btc', { entity: victimE, kind: victimKind })
    const price = roundCoin(w, 0.22, 0.6, 0.01)
    const buyT = w.at(-2 * 24 - r.int(2, 20))
    cv.withdraw(victim, r8(price + r.float(0.01, 0.04)), buyT)
    for (let i = 0; i < r.int(1, 3); i++) cv.withdraw(victim, roundCoin(w, 0.002, 0.03, 0.0001), w.at(-r.int(20, 200) * 24))

    // ── Paiement de la victime (son propre rendu revient vers elle) ──────────
    const s0 = w.addr('btc', { entity: suspect, kind: K })
    const txPay = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: s0, value: price }], fee: sat(r.int(1400, 6200)) })
    const victimChange = txPay.outputs.find((o) => o.address !== s0)!.address

    // ── TX A : paiement rond vers un complice (autre type), rendu neuf ──────
    const muleKind = r.pick(otherKinds)
    const mule = w.addr('btc', { entity: muleE, kind: muleKind })
    w.fund(mule, roundCoin(w, 0.01, 0.08, 0.001), w.at(-r.int(10, 90) * 24))
    const payA = roundCoin(w, 0.03, 0.09, 0.005)
    const s1 = w.addr('btc', { entity: suspect, kind: K })
    const txA = w.utxoTx({ time: w.at(r.float(3, 9)), from: [s0], to: [{ address: mule, value: r8(payA) }], change: s1, fee: sat(r.int(1500, 6000)) })

    // ── TX B : dépôt rond sur la première plateforme (type différent, adresse étiquetée) ────
    const depKind = r.pick(otherKinds)
    const depB = w.addr('btc', { entity: exB.entity, label: `${exB.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: depKind })
    const balB = w.unspentValue(s1)
    const payB = r8(Math.floor((balB * r.float(0.55, 0.72)) * 100) / 100)
    const s2 = w.addr('btc', { entity: suspect, kind: K })
    const txB = w.utxoTx({ time: w.at(r.float(14, 30)), from: [s1], to: [{ address: depB, value: payB }], change: s2, fee: sat(r.int(1800, 7000)) })
    const sweepB = exB.sweep([depB], txB.time + r.int(1, 8) * HOUR)[0]

    // ── TX C : paiement non rond, même type, rendu vers l'adresse d'entrée ──
    const third = w.addr('btc', { entity: thirdE, kind: K })
    const payC = r8(Math.min(fromUsd('BTC', r.float(600, 1900)), w.unspentValue(s2) * r.float(0.3, 0.5)))
    const txC = w.utxoTx({ time: w.at(r.float(40, 60)), from: [s2], to: [{ address: third, value: payC }], change: s2, fee: sat(r.int(1500, 5500)) })

    // ── Seconde victime : alimente une autre adresse du même portefeuille ──
    const victim2Name = fakeName(r)
    const victim2E = w.customEntity({ name: victim2Name, category: 'victim' })
    const victim2 = w.addr('btc', { entity: victim2E })
    const price2 = roundCoin(w, 0.08, 0.25, 0.01)
    cv.withdraw(victim2, r8(price2 + r.float(0.002, 0.01)), w.at(r.float(30, 50)))
    const sx = w.addr('btc', { entity: suspect, kind: K })
    const txPay2 = w.utxoTx({ time: w.at(r.float(55, 70)), from: [victim2], to: [{ address: sx, value: price2 }], fee: sat(r.int(1400, 5000)) })

    // ── TX D : deux entrées (s2 + sx), dépôt rond sur la seconde plateforme, rendu neuf ────
    const depKindD = r.pick(otherKinds)
    const depD = w.addr('btc', { entity: exD.entity, label: `${exD.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: depKindD })
    const balD = w.unspentValue(s2) + w.unspentValue(sx)
    const payD = r8(Math.floor(balD * r.float(0.62, 0.8) * 100) / 100)
    const s3 = w.addr('btc', { entity: suspect, kind: K })
    const txD = w.utxoTx({ time: w.at(r.float(80, 110)), from: [s2, sx], to: [{ address: depD, value: payD }], change: s3, spendAll: true, fee: sat(r.int(2600, 9800)) })
    const sweepD = exD.sweep([depD], txD.time + r.int(1, 10) * HOUR)[0]

    // ── Bruit de fond ────────────────────────────────────────────────────────
    exB.noise(12, w.at(-3 * 24), w.at(6 * 24))
    exD.noise(10, w.at(-2 * 24), w.at(7 * 24))
    cv.noise(8, buyT - 3 * DAY, w.at(4 * 24))
    // Le complice dépense plus tard ses fonds (impasse pour l'enquêteur)
    w.utxoTx({ time: w.at(r.float(30, 90)), from: [mule], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(mule) * r.float(0.3, 0.6)) }] })

    const feeD = txD.fee
    const changeB = txB.outputs.find((o) => o.address === s2)!.value
    const changeA = txA.outputs.find((o) => o.address === s1)!.value
    const changePay = txPay.outputs.find((o) => o.address === victimChange)!.value
    const remaining = txD.outputs.find((o) => o.address === s3)!.value
    const sumInD = txD.inputs.reduce((s, i) => s + i.value, 0)
    const sumOutD = txD.outputs.reduce((s, o) => s + o.value, 0)
    const nameB = exB.entity.name
    const nameD = exD.entity.name
    const kindLabel: Record<AddrKind, string> = { p2pkh: 'Legacy (1…)', p2sh: 'P2SH (3…)', p2wpkh: 'SegWit natif (bc1q…)', p2tr: 'Taproot (bc1p…)', eoa: '', contract: '', account: '', stealth: '', p2wsh: '', ton_wallet: '' }
    const city2 = fakeCity(r)

    return {
      world: w,
      title: `Faux vendeur automobile — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, a versé ${amt(price, 'BTC')} à un vendeur rencontré sur un site d'annonces, pour un véhicule qui n'a jamais été livré. Le « vendeur » exigeait un paiement en bitcoins « pour éviter les frais bancaires ».\n\n` +
        `Sur Bitcoin, une transaction consomme des sorties précédentes (entrées) et crée de nouvelles sorties. Comme on dépense toujours la totalité d'une UTXO, le portefeuille de l'émetteur se renvoie la différence sur une sortie de rendu (change). Pour suivre l'escroc, il faut donc, à chaque saut, reconnaître le rendu.\n\n` +
        `Votre mission : suivre les fonds depuis le paiement de la victime, identifier le rendu de chaque transaction, repérer les bénéficiaires et les plateformes de dépôt, rattacher la seconde victime signalée par un autre service, et localiser le reliquat encore détenu par l'escroc.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(4 * 24), author: victimName,
          body:
            `« J'ai trouvé l'annonce d'un utilitaire à un prix intéressant. Le vendeur, joignable au ${fakePhone(r)}, m'a demandé de payer en bitcoins sur une adresse qu'il m'a envoyée par message.\n\n` +
            `Le ${fmtDate(txPay.time)}, j'ai envoyé ${amt(price, 'BTC')} depuis mon portefeuille.\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Adresse du vendeur : ${A(w, s0)}\n` +
            `Identifiant de transaction : ${txPay.hash} »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: w.at(5 * 24), author: 'Chef de groupe — SR',
          body:
            `Rappels de méthode avant de tracer :\n\n` +
            `• Le portefeuille de l'escroc génère toujours le même type d'adresse : repérez-le dès l'adresse fournie par le vendeur, puis vérifiez-le à chaque saut.\n` +
            `• Un paiement est souvent un montant rond (0,05 BTC, 0,2 BTC…) ; le rendu « absorbe » les frais et a donc un montant non rond.\n` +
            `• Un portefeuille moderne crée une adresse neuve pour chaque rendu… sauf s'il est mal configuré.\n` +
            `• La plus grosse sortie n'est PAS forcément le rendu.\n\n` +
            `La transaction ${txC.hash} me semble atypique : regardez-la de près.`,
        },
        {
          id: 'annonce', type: 'capture', title: 'Capture de l\'annonce', date: w.at(-4 * 24),
          body: `Utilitaire 3,5 t — très bon état — ${Math.round(price * 67250 / 100) * 100} €\nPaiement en BTC uniquement (« plus rapide, pas de frais bancaires »).\nLivraison sous 48 h après réception du paiement.`,
        },
        {
          id: 'signalement', type: 'pv', title: `Signalement d'une brigade de ${city2}`, date: w.at(6 * 24), author: `Brigade de recherches de ${city2}`,
          body:
            `Objet : rapprochement — faux vendeur « AutoPrestige ».\n\n` +
            `${victim2Name} a déposé plainte dans notre unité pour des faits similaires (utilitaire jamais livré, même numéro de téléphone que dans votre procédure). ${victim2Name} déclare avoir payé ${amt(price2, 'BTC')} le ${fmtDate(txPay2.time)}, depuis un portefeuille alimenté par Coinhouse. L'adresse de destination n'a pas été conservée par le plaignant.\n\n` +
            `Merci de nous indiquer si ce paiement apparaît dans vos travaux.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Dans la transaction de paiement de la victime, quelle sortie est le rendu qui revient à son propre portefeuille ?',
          answer: [victimChange],
          hint: 'La victime a payé un montant rond au vendeur. L\'autre sortie, non ronde, revient vers une adresse du même type que la sienne.',
          explanation: `${A(w, victimChange)} reçoit ${amt(r8(changePay), 'BTC')} : montant non rond, adresse neuve, même type (${kindLabel[victimKind]}) que l'adresse de la victime. Le paiement, lui, est le montant rond de la plainte vers une adresse ${kindLabel[K]}. Ce rendu appartient à la victime : premier réflexe, ne pas le prendre pour une piste.`,
        },
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Après avoir reçu les fonds de la victime, l\'escroc effectue une première dépense. Quelle est l\'adresse de rendu de cette transaction ?',
          answer: [s1],
          hint: 'Comparez le type d\'adresse et le caractère rond des deux sorties.',
          explanation: `La transaction ${txA.hash.slice(0, 12)}… paie ${amt(payA, 'BTC')} (montant rond) vers une adresse ${kindLabel[muleKind]} déjà utilisée auparavant. L'autre sortie, ${amt(changeA, 'BTC')}, est non ronde, neuve et du même type (${kindLabel[K]}) que l'entrée : c'est le rendu.`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Dans cette première dépense, à quelle adresse l\'escroc envoie-t-il le paiement ?',
          answer: [mule],
          hint: 'C\'est la sortie au montant rond, d\'un type d\'adresse différent de celui du portefeuille de l\'escroc.',
          explanation: `${A(w, mule)} reçoit ${amt(payA, 'BTC')}, un montant rond, sur une adresse ${kindLabel[muleKind]} qui avait déjà un historique : ce n'est pas un rendu, c'est un bénéficiaire. Probablement un complice ou un prestataire, à documenter : ses fonds repartent ensuite vers une adresse inconnue, sans plateforme identifiable à ce stade (impasse provisoire, à signaler dans le rapport).`,
        },
        {
          id: 'o2', type: 'address', points: 10,
          prompt: 'Le rendu est ensuite utilisé pour un dépôt sur une plateforme. Quelle est l\'adresse de rendu de cette transaction ?',
          answer: [s2],
          hint: 'Ici, le paiement est plus gros que le rendu : ne vous fiez pas à la taille des sorties.',
          explanation: `${amt(payB, 'BTC')} partent vers une adresse de dépôt ${nameB} (montant rond, type différent, attribuée à un exchange). Le rendu de ${amt(changeB, 'BTC')} est plus petit que le paiement : la taille d'une sortie n'est pas un critère.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: `Quel montant (en BTC) l'escroc dépose-t-il sur ${nameB} ?`,
          answer: payB,
          hint: `Ouvrez la transaction dont une sortie est étiquetée « ${nameB} — Adresse de dépôt » et lisez cette sortie.`,
          explanation: `${amt(payB, 'BTC')}, un montant rond : c'est le paiement de la transaction, le rendu de ${amt(changeB, 'BTC')} revenant à l'escroc. L'adresse de dépôt ${A(w, depB).slice(0, 14)}… est ensuite balayée vers le hot wallet de ${nameB} : on la cite dans une réquisition, avec ce montant et le hash ${txB.hash.slice(0, 12)}….`,
        },
        {
          id: 'o3', type: 'choice', points: 10,
          prompt: 'Dans la transaction signalée par le chef de groupe, quel indice permet d\'identifier le rendu avec quasi-certitude ?',
          ...choice(r,
            'Une sortie revient vers l\'adresse d\'entrée (réutilisation d\'adresse)',
            [
              'Le rendu est la sortie dont le montant est le plus rond des deux',
              'Le rendu utilise un type d\'adresse différent de celui de l\'entrée',
              'Le rendu est toujours placé en première position (sortie n° 0)',
            ]),
          hint: 'Comparez les adresses des sorties à celle de l\'entrée.',
          explanation: `Dans ${txC.hash.slice(0, 12)}…, les deux sorties ont le même type d'adresse et des montants non ronds : ces heuristiques ne tranchent pas. En revanche, une sortie revient vers ${A(w, s2).slice(0, 14)}…, l'adresse d'entrée elle-même. La réutilisation d'adresse est l'indice le plus fort (et une faute d'hygiène du suspect). L'ordre des sorties est aléatoire et n'apporte rien.`,
        },
        {
          id: 'o9', type: 'address', points: 10,
          prompt: `Sur quelle adresse de l'escroc ${victim2Name}, la victime signalée par l'autre brigade, a-t-elle versé ses bitcoins ?`,
          answer: [sx],
          hint: 'Suivez le rendu jusqu\'à une transaction à deux entrées : l\'autre entrée a été alimentée au montant et à la date du signalement.',
          explanation: `${A(w, sx)} reçoit exactement ${amt(price2, 'BTC')} le ${fmtDate(txPay2.time)}, comme indiqué dans le signalement. Elle est du même type (${kindLabel[K]}) que le reste du portefeuille et elle est dépensée avec ${A(w, s2).slice(0, 12)}… dans la même transaction : c'est une adresse de l'escroc. On peut répondre à la brigade : le paiement apparaît bien, et les deux procédures visent le même portefeuille.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quelle heuristique permet de rattacher cette adresse au portefeuille de l\'escroc ?',
          ...choice(r,
            'Les entrées communes : des adresses dépensées ensemble dans une transaction sont contrôlées par le même portefeuille',
            [
              'La proximité des dates : deux adresses actives le même jour appartiennent au même propriétaire',
              'Le montant rond du paiement de la seconde victime, qui signe une adresse de l\'escroc',
              'L\'étiquette de la base d\'attribution, qui attribue l\'adresse au faux vendeur',
            ]),
          hint: 'Regardez la transaction finale : combien d\'entrées, et d\'où viennent-elles ?',
          explanation: `Pour dépenser deux entrées dans une même transaction, il faut détenir les clés des deux adresses : c'est l'heuristique des entrées communes (CIOH), pilier du clustering Bitcoin. Elle a des exceptions connues (CoinJoin, paiements groupés) qu'il faut écarter avant de conclure ; ici, rien de tel : deux entrées, une adresse de dépôt et un rendu du même type que le portefeuille. Aucune étiquette ne désigne ces adresses : c'est l'analyse qui les rattache.`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'escroc effectue-t-il son dépôt final, depuis ces deux adresses regroupées ?',
          answer: [kD],
          hint: 'Dans la transaction à deux entrées, une sortie est étiquetée « Adresse de dépôt ».',
          explanation: `${amt(payD, 'BTC')} partent vers une adresse de dépôt ${nameD}, balayée ensuite vers son hot wallet. L'escroc utilise donc deux plateformes (${nameB} puis ${nameD}) : deux réquisitions, deux KYC à confronter. Ce dépôt mêle l'argent des deux victimes, ce qui intéresse aussi la brigade de ${city2}.`,
        },
        {
          id: 'o4', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quels frais de réseau (en BTC) l\'escroc a-t-il payés pour cette transaction finale à deux entrées ?',
          answer: feeD,
          hint: 'Frais = somme des entrées − somme des sorties. Ils ne figurent dans aucune sortie.',
          explanation: `Entrées : ${amt(r8(sumInD), 'BTC')} ; sorties : ${amt(r8(sumOutD), 'BTC')} ; frais = ${amt(feeD, 'BTC')}. Les frais reviennent au mineur du bloc : ils n'apparaissent comme aucune sortie.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Où se trouve le reliquat des fonds encore détenu par l\'escroc à la fin du traçage ?',
          answer: [s3],
          hint: 'Suivez le rendu jusqu\'à une sortie qui n\'a pas encore été dépensée.',
          explanation: `Le rendu de la dernière transaction (${amt(remaining, 'BTC')}) repose sur ${A(w, s3)}, non dépensée. Cette transaction à deux entrées a aussi un intérêt d'enquête : par l'heuristique des entrées communes, elle relie l'adresse alimentée par une seconde victime au portefeuille de l'escroc.`,
        },
      ],
      truth: {
        path: [txPay.id, txA.id, txB.id, sweepB.id, txC.id, txPay2.id, txD.id, sweepD.id],
        addresses: [s0, s1, s2, sx, s3, depB, depD, mule],
        debrief:
          `1. La victime paie ${amt(price, 'BTC')} vers ${A(w, s0)}. Sa propre transaction a déjà un rendu : ${amt(r8(changePay), 'BTC')} reviennent vers une adresse neuve de type ${kindLabel[victimKind]} (${A(w, victimChange)}), comme son adresse d'origine.\n` +
          `2. TX A — l'escroc paie ${amt(payA, 'BTC')} (rond, ${kindLabel[muleKind]}) à un complice (${A(w, mule)}) ; le rendu ${amt(changeA, 'BTC')} part vers ${A(w, s1)} (neuve, ${kindLabel[K]}, non ronde).\n` +
          `3. TX B — dépôt rond de ${amt(payB, 'BTC')} sur ${nameB} ; rendu ${amt(changeB, 'BTC')} vers ${A(w, s2)}, plus petit que le paiement.\n` +
          `4. TX C — paiement non rond de ${amt(payC, 'BTC')} vers une adresse du même type : seule la réutilisation de ${A(w, s2).slice(0, 14)}… en sortie trahit le rendu.\n` +
          `5. Une seconde victime, ${victim2Name} (signalée par la brigade de ${city2}), paie ${amt(price2, 'BTC')} vers ${A(w, sx)}, autre adresse du même portefeuille.\n` +
          `6. TX D — l'escroc dépense ensemble ${A(w, s2).slice(0, 12)}… et ${A(w, sx).slice(0, 12)}… (entrées communes ⇒ même propriétaire), dépose ${amt(payD, 'BTC')} sur ${nameD} et conserve ${amt(remaining, 'BTC')} sur ${A(w, s3)}. Frais : ${amt(feeD, 'BTC')}.\n\n` +
          `Leçon : aucune heuristique n'est infaillible seule. On les combine (type d'adresse, montant rond, adresse neuve, réutilisation, attribution, entrées communes) et on vérifie la cohérence sur plusieurs sauts. Les deux adresses de dépôt (${nameB}, ${nameD}) font l'objet de réquisitions ; le complice est documenté ; la procédure de ${city2} est rapprochée ; le reliquat est placé sous surveillance.`,
      },
      hints: [
        'Ouvrez la transaction de la victime : repérez d\'abord quelle sortie est le paiement et laquelle est son propre rendu.',
        'Le panneau de détail d\'une transaction affiche une estimation de probabilité de rendu pour chaque sortie : lisez les raisons invoquées.',
        'Une adresse qui apparaît à la fois en entrée et en sortie d\'une même transaction est presque toujours le rendu.',
        'Frais = Σ entrées − Σ sorties.',
        'Une transaction qui dépense plusieurs adresses à la fois relie ces adresses au même portefeuille : cherchez celle qui rattache la seconde victime.',
      ],
    }
  },
}
