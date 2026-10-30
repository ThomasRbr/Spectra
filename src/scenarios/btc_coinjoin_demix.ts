import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, roundCoin, HOUR } from '../engine/patterns'
import { detectCoinjoin } from '../engine/analysis'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const PREMIX_EXTRA = 0.00025 // frais de mixage + réseau prépayés dans chaque UTXO pré-mix

export const btcCoinjoinDemix: ScenarioTemplate = {
  id: 'coinjoin-demix',
  title: 'Démixer un CoinJoin',
  tagline: 'Sorties égales, rendu toxique et regroupement maladroit : percez un CoinJoin.',
  description:
    'Un maître-chanteur passe ses bitcoins dans un CoinJoin à dénomination fixe, précédé d\'une transaction de pré-mix (« Tx0 »). En théorie, ses sorties se fondent dans la masse. En pratique, le rendu toxique de la transaction de pré-mix et un regroupement post-mix permettent de retrouver sa trace jusqu\'à l\'exchange.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['coinjoin', 'change', 'cioh', 'exchange_id'],
  estMinutes: 60,
  lessons: ['utxo', 'change-heuristics', 'clustering', 'coinjoin', 'mixeurs', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const ceo = fakeName(r)
    const company = `${r.pick(['Transports', 'Menuiserie', 'Laboratoires', 'Groupe', 'Imprimerie', 'Clinique vétérinaire'])} ${r.pick(['Durand', 'Lacoste', 'Vasseur', 'Arnaud', 'Brunet', 'Leclerc'])}`

    const cv = exchange(w, 'coinhouse', 'btc')
    const outKey = r.pick(['binance', 'okx', 'huobex', 'bitstamp'] as const)
    const out = exchange(w, outKey, 'btc')
    const cardhub = w.entity('cardhub')
    const suspect = w.customEntity({ name: 'Maître-chanteur « DDoS » (inconnu)', category: 'suspect' })
    const victimE = w.customEntity({ name: company, category: 'victim' })

    // ── Paiement de la rançon DDoS ───────────────────────────────────────────
    const denom = r.pick([0.01, 0.05, 0.05] as const)
    const m = r.int(3, 5)
    const s0Kind: AddrKind = r.pick(['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const)
    const s0 = w.addr('btc', { entity: suspect, kind: s0Kind })
    const P = r8(roundCoin(w, m * denom * 1.2, m * denom * 1.7, denom >= 0.05 ? 0.01 : 0.001))
    const victimAddr = w.addr('btc', { entity: victimE })
    cv.withdraw(victimAddr, r8(P + r.float(0.001, 0.004)), w.at(-r.float(6, 20)))
    const ransomTx = w.utxoTx({ time: w.at(0), from: [victimAddr], to: [{ address: s0, value: P }] })

    // ── Seconde victime : même adresse de paiement, montant négocié à la baisse ─
    const company2 = `${r.pick(['Agence', 'Cabinet', 'Société', 'Atelier'])} ${r.pick(['Morel', 'Perrin', 'Gauthier', 'Masson', 'Renaud', 'Colin'])}`
    const victim2E = w.customEntity({ name: company2, category: 'victim' })
    const victim2Addr = w.addr('btc', { entity: victim2E, kind: 'p2wpkh' })
    const P2 = r8(roundCoin(w, m * denom * 0.3, m * denom * 0.7, denom >= 0.05 ? 0.005 : 0.001))
    w.fund(victim2Addr, r8(P2 + r.float(0.002, 0.01)), w.at(-r.float(20, 60)))
    const ransom2Tx = w.utxoTx({ time: w.at(r.float(1, 3.5)), from: [victim2Addr], to: [{ address: s0, value: P2 }] })
    const totalIn = r8(P + P2)

    // ── Tx0 : découpage en UTXO pré-mix + rendu toxique ─────────────────────
    const premix = Array.from({ length: m }, () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' }))
    const toxic = w.addr('btc', { entity: suspect, kind: s0Kind })
    const tx0 = w.utxoTx({
      time: w.at(r.float(4, 20)),
      from: [s0],
      to: premix.map((p) => ({ address: p, value: r8(denom + PREMIX_EXTRA) })),
      change: toxic,
      fee: sat(r.int(2500, 9000)),
      spendAll: true,
      tags: ['tx0'],
      method: 'Tx0 (pré-mix)',
    })
    const toxicValue = tx0.outputs.find((o) => o.address === toxic)!.value

    // ── CoinJoin (1 ou 2 tours) ──────────────────────────────────────────────
    const extra1 = r.int(4, 7)
    const cj1 = coinjoin(w, {
      chain: 'btc', time: tx0.time + r.float(1, 10) * HOUR, denom,
      participants: premix.map((p) => ({ from: p, changeTo: null })),
      extra: extra1,
      coordinatorFee: r8(0.00002 * (m + extra1)),
    })
    const cjs: Tx[] = [cj1.tx]
    let mixed = cj1.mixed
    if (r.chance(0.5)) {
      const extra2 = r.int(4, 6)
      const cj2 = coinjoin(w, {
        chain: 'btc', time: cj1.tx.time + r.float(2, 30) * HOUR, denom,
        participants: mixed.map((p) => ({ from: p, changeTo: null })),
        extra: extra2,
        coordinatorFee: r8(0.00001 * extra2),
      })
      cjs.push(cj2.tx)
      mixed = cj2.mixed
    }
    const lastCj = cjs[cjs.length - 1]

    // ── Activité post-mix des autres participants (bruit) ───────────────────
    const othersOut = (tx: Tx) => tx.outputs.filter((o) => o.value.toFixed(8) === denom.toFixed(8) && !mixed.includes(o.address) && !cj1.mixed.includes(o.address)).map((o) => o.address)
    const strangers = othersOut(lastCj)
    r.shuffle(strangers)
    // Un faux positif : deux sorties de participants différents dépensées ensemble
    const fpPair = strangers.splice(0, 2)
    const fpTx = w.utxoTx({ time: lastCj.time + r.float(4, 60) * HOUR, from: fpPair, to: [{ address: w.addr('btc'), value: r8(denom * 2 - 0.00006) }], fee: 0.00006, change: null, spendAll: true })
    for (const a of strangers) {
      if (!r.chance(0.6)) continue
      w.utxoTx({ time: lastCj.time + r.float(2, 96) * HOUR, from: [a], to: [{ address: w.addr('btc'), value: r8(denom * r.float(0.3, 0.8)) }] })
    }
    // Rendus des autres participants du 1er tour : parfois dépensés
    for (const o of cj1.tx.outputs) {
      const v = o.value.toFixed(8)
      if (v === denom.toFixed(8) || w.get(o.address).entityId === 'wasabi') continue
      if (r.chance(0.5)) w.utxoTx({ time: cj1.tx.time + r.float(3, 80) * HOUR, from: [o.address], to: [{ address: w.addr('btc'), value: r8(o.value * r.float(0.4, 0.9)) }] })
    }

    // ── L'erreur : regroupement post-mix avec le rendu toxique ──────────────
    const q = Math.min(m, r.int(2, 3))
    const used = r.shuffle([...mixed]).slice(0, q)
    const deposit = out.newDeposit()
    const inputs = r.shuffle([...used, toxic])
    const consIn = used.length * denom + toxicValue
    const consFee = w.estimateFee('btc', inputs.length, 1)
    const consTx = w.utxoTx({ time: lastCj.time + r.float(10, 70) * HOUR, from: inputs, to: [{ address: deposit, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    const sweep = out.sweep([deposit], consTx.time + r.float(1, 6) * HOUR)[0]
    // Une sortie mixée restante dépensée seule (aucun lien exploitable)
    const leftover = mixed.filter((a) => !used.includes(a))
    let cardTx: Tx | undefined
    if (leftover.length) {
      const inv = w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
      cardTx = w.utxoTx({ time: consTx.time + r.float(24, 120) * HOUR, from: [leftover[0]], to: [{ address: inv, value: r8(denom * r.float(0.4, 0.8)) }] })
    }

    // ── Bruit exchanges ──────────────────────────────────────────────────────
    out.noise(12, w.at(-2 * 24), w.at(10 * 24))
    cv.noise(8, w.at(-5 * 24), w.at(5 * 24))

    const exName = out.entity.name
    const nRounds = cjs.length
    const cjInfo = detectCoinjoin(cj1.tx)
    const deposited = consTx.outputs[0].value
    // Délai entre le dernier tour de CoinJoin et le regroupement fautif (heures)
    const waitH = Math.round(((consTx.time - lastCj.time) / 3600) * 10) / 10

    return {
      world: w,
      title: `Chantage au déni de service — ${city}`,
      briefing:
        `La société ${company} (${city}) a subi plusieurs attaques par déni de service (DDoS) paralysant son site de commande. Un message exigeait le paiement de ${amt(P, 'BTC')} pour que les attaques cessent. La direction (${ceo}) a payé depuis un compte Coinhouse ouvert pour l'occasion.\n\n` +
        `Le maître-chanteur a fait passer les fonds par un CoinJoin coordonné à dénomination fixe (zkSNACKs) : plusieurs participants mettent en commun des UTXO et reçoivent chacun une sortie de montant identique (${amt(denom, 'BTC')}). Impossible, en principe, de savoir quelle sortie appartient à qui.\n\n` +
        `Entre-temps, une seconde entreprise, ${company2}, a signalé le même chantage. Mesurez l'ampleur de la campagne, retrouvez la transaction de pré-mix, le CoinJoin, le rendu « toxique », la transaction qui trahit le suspect et la plateforme de destination.`,
      evidence: [
        {
          id: 'menace', type: 'email', title: 'Message de chantage', date: w.at(-r.float(30, 60)), author: 'contact anonyme (messagerie chiffrée)',
          body:
            `Votre site est tombé trois fois cette semaine. Ce n'est qu'un début.\n` +
            `Pour que cela cesse : ${amt(P, 'BTC')} à envoyer sur\n${A(w, s0)}\n` +
            `Délai : 48 heures. Après paiement, plus aucune attaque. Sinon, nous passerons à vos clients.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'audition de la direction (extrait)', date: w.at(3 * 24), author: ceo,
          body:
            `« Sur conseil de mon prestataire informatique, j'ai payé pour faire cesser les attaques. ` +
            `J'ai acheté les bitcoins sur Coinhouse et je les ai envoyés le ${fmtDate(ransomTx.time)}. ` +
            `Identifiant de transaction : ${ransomTx.hash} »`,
        },
        {
          id: 'signalement', type: 'email', title: `Signalement de ${company2}`, date: w.at(5 * 24), author: `Gérance de ${company2}`,
          body:
            `« Nous avons reçu le même message de menace, avec la même adresse bitcoin. Après négociation par messagerie, l'auteur a accepté un montant inférieur à sa demande initiale. ` +
            `Notre comptable a effectué le paiement le ${fmtDate(ransom2Tx.time, false)}, mais n'a conservé ni le montant exact ni la référence de la transaction. ` +
            `Nous déposerons plainte dès que possible. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note technique — CoinJoin', date: w.at(4 * 24), author: 'Cellule d\'appui',
          body:
            `Rappels :\n` +
            `• Avant le CoinJoin, une transaction « Tx0 » découpe les fonds en UTXO de taille fixe (dénomination + frais). Ce qui ne rentre pas dans une dénomination revient en rendu : c'est le rendu toxique, toujours relié à l'origine des fonds.\n` +
            `• Le CoinJoin lui-même : nombreuses entrées, nombreuses sorties de montant égal. L'heuristique des entrées communes ne s'y applique pas.\n` +
            `• Après le CoinJoin, dépenser ensemble plusieurs sorties mixées, ou une sortie mixée avec un rendu toxique, recrée un lien de propriété.\n` +
            `• Méfiance : deux sorties de même dénomination dépensées ensemble ne prouvent rien à elles seules.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o5', type: 'tx', points: 9,
          prompt: `Quelle transaction correspond au paiement de la seconde victime, ${company2} ?`,
          answer: [ransom2Tx.id],
          hint: 'Ajoutez l\'adresse du message de chantage au graphe et listez tous ses paiements entrants : un seul n\'est pas celui de la première victime.',
          explanation: `L'adresse de paiement reçoit deux versements : celui de ${company} (${ransomTx.hash.slice(0, 14)}…) et, le ${fmtDate(ransom2Tx.time)}, la transaction ${ransom2Tx.hash} venant d'une adresse sans lien avec Coinhouse. La réutilisation de la même adresse par le maître-chanteur relie les deux affaires : un seul auteur, une seule procédure.`,
        },
        {
          id: 'o6', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (BTC) l\'adresse de paiement a-t-elle reçu des deux victimes ?',
          answer: totalIn,
          hint: 'Faites la somme des deux paiements entrants (fiche de l\'adresse, onglet des flux).',
          explanation: `${amt(P, 'BTC')} + ${amt(P2, 'BTC')} = ${amt(totalIn, 'BTC')}. C'est l'assiette du préjudice global et le montant qui entre dans la Tx0 : il permet de vérifier que la somme des UTXO pré-mix, du rendu et des frais retombe bien sur le total reçu.`,
        },
        {
          id: 'o7', type: 'tx', points: 9,
          prompt: 'Quelle transaction de pré-mix (« Tx0 ») a découpé les fonds avant le CoinJoin ?',
          answer: [tx0.id],
          hint: 'C\'est la transaction qui dépense l\'adresse de paiement : plusieurs sorties identiques, une sortie différente.',
          explanation: `La transaction ${tx0.hash} (${fmtDate(tx0.time)}) dépense les deux paiements reçus et produit ${m} sorties identiques de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} (dénomination + frais prépayés), signature typique d'une Tx0 préparant un CoinJoin, plus une sortie de montant quelconque.`,
        },
        {
          id: 'o8', type: 'number', points: 8, unit: 'UTXO pré-mix',
          prompt: 'Combien d\'UTXO pré-mix la Tx0 a-t-elle créées ?',
          answer: m,
          hint: 'Comptez les sorties de la Tx0 de valeur égale à la dénomination augmentée de quelques satoshis.',
          explanation: `${m} sorties de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} : le suspect entre donc dans le CoinJoin avec ${m} participations. C'est le nombre maximal de sorties mixées qu'on cherchera ensuite à lui rattacher.`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: 'Quelle est l\'adresse du rendu toxique (la partie des fonds qui n\'est pas entrée dans le CoinJoin) ?',
          answer: [toxic],
          hint: 'Dans la Tx0, toutes les sorties sauf une ont la même valeur.',
          explanation: `La Tx0 crée ${m} UTXO de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} et un rendu de ${amt(toxicValue, 'BTC')} vers ${A(w, toxic)}, du même type que l'adresse de la rançon. Ce rendu n'est pas mixé : il reste directement relié aux paiements des victimes.`,
        },
        {
          id: 'o1', type: 'tx', points: 10,
          prompt: nRounds > 1 ? 'Identifiez une transaction CoinJoin dans laquelle les fonds du suspect ont été mélangés.' : 'Identifiez la transaction CoinJoin dans laquelle les fonds du suspect ont été mélangés.',
          answer: cjs.map((t) => t.id),
          hint: 'Suivez les sorties de la transaction Tx0 (sorties égales à la dénomination + quelques satoshis).',
          explanation: `${nRounds > 1 ? `Les fonds passent par ${nRounds} tours de CoinJoin. ` : ''}Le premier CoinJoin compte ${cj1.tx.inputs.length} entrées et ${cjInfo.equalCount ?? '?'} sorties de ${amt(denom, 'BTC')} : chaque participant reçoit le même montant, ce qui casse le lien entrée → sortie.`,
        },
        {
          id: 'o3', type: 'tx', points: 14,
          prompt: 'Quelle transaction post-mix permet de rattacher des sorties du CoinJoin au suspect ?',
          answer: [consTx.id],
          hint: 'Où le rendu toxique est-il dépensé, et avec quoi ?',
          explanation: `La transaction ${consTx.hash.slice(0, 14)}… dépense ensemble le rendu toxique et ${q} sorties mixées de ${amt(denom, 'BTC')}. Par entrées communes, ces sorties mixées appartiennent donc au propriétaire du rendu toxique, c'est-à-dire au maître-chanteur. Attention au faux positif : une autre transaction regroupe aussi deux sorties de ${amt(denom, 'BTC')}, mais rien ne la relie au suspect.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 2, unit: 'heures',
          prompt: `Combien d'heures le suspect a-t-il attendu entre le ${nRounds > 1 ? 'dernier tour de CoinJoin' : 'CoinJoin'} et ce regroupement ?`,
          answer: waitH,
          hint: 'Comparez les horodatages des deux transactions (frise chronologique ou fiches de transaction).',
          explanation: `${nRounds > 1 ? 'Dernier tour' : 'CoinJoin'} le ${fmtDate(lastCj.time)}, regroupement le ${fmtDate(consTx.time)} : environ ${waitH.toFixed(1).replace('.', ',')} h. Un délai aussi court annule une bonne part de l'intérêt du mixage (peu d'autres dépenses post-mix pour brouiller la corrélation temporelle) et s'ajoute au faisceau d'indices présenté au magistrat.`,
        },
        {
          id: 'o9', type: 'choice', points: 9,
          prompt: `Une autre transaction dépense ensemble deux sorties de ${amt(denom, 'BTC')} du même CoinJoin. Que pouvez-vous en conclure ?`,
          ...choice(r,
            'Rien contre le suspect : ces deux sorties ne sont rattachées à lui par aucun autre lien (rendu toxique, adresse connue)',
            [
              'Elles appartiennent au suspect, puisque toute dépense commune de sorties mixées désigne le même propriétaire',
              'Elles appartiennent au coordinateur du CoinJoin, qui récupère ainsi ses frais',
              'Elles prouvent que le suspect a fait un second tour de CoinJoin avec ses propres sorties',
            ]),
          hint: 'Qu\'est-ce qui, dans la transaction de regroupement du suspect, faisait le lien avec lui ? Retrouvez-vous cet élément ici ?',
          explanation: `La dépense commune montre seulement que ces deux sorties ont un même propriétaire, pas qui il est. Dans la transaction du suspect, c'est la présence du rendu toxique (issu de la Tx0, donc des paiements des victimes) qui fait le rattachement. Ici, aucune entrée n'est reliée au suspect : imputer ces fonds serait un faux positif, à écarter explicitement dans le rapport.`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: `Quelle adresse de dépôt reçoit les fonds regroupés ?`,
          answer: [deposit],
          hint: 'C\'est l\'unique sortie de la transaction de regroupement.',
          explanation: `${A(w, deposit)} reçoit ${amt(deposited, 'BTC')} puis est balayée avec d'autres dépôts vers un portefeuille chaud étiqueté : c'est le comportement d'une adresse de dépôt client, propre à un compte. C'est elle que viseront la réquisition et, le cas échéant, la demande de gel.`,
        },
        {
          id: 'o4', type: 'entity', points: 11,
          prompt: 'Vers quelle plateforme les fonds ont-ils été envoyés ?',
          answer: [outKey],
          hint: 'Suivez le balayage de l\'adresse de dépôt jusqu\'au portefeuille chaud étiqueté.',
          explanation: `La transaction de regroupement envoie ${amt(deposited, 'BTC')} vers une adresse de dépôt ${exName}, ensuite balayée. Réquisition à ${exName} sur cette adresse de dépôt, en joignant la démonstration (Tx0 → rendu toxique → regroupement). ${procedureFor(out.entity)}`,
        },
      ],
      truth: {
        path: [ransomTx.id, ransom2Tx.id, tx0.id, ...cjs.map((t) => t.id), consTx.id, sweep.id, ...(cardTx ? [cardTx.id] : [])],
        addresses: [s0, toxic, ...premix, ...mixed, deposit],
        debrief:
          `1. ${company} paie ${amt(P, 'BTC')} vers ${A(w, s0)} ; ${company2}, victime du même chantage, y verse ${amt(P2, 'BTC')} (${ransom2Tx.hash.slice(0, 14)}…). Total : ${amt(totalIn, 'BTC')}.\n` +
          `2. Tx0 (${tx0.hash.slice(0, 14)}…) : le suspect découpe les fonds en ${m} UTXO pré-mix de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} et renvoie le reste (${amt(toxicValue, 'BTC')}) vers ${A(w, toxic)} : le rendu toxique.\n` +
          `3. ${nRounds > 1 ? `Deux tours de CoinJoin (${fmtDate(cjs[0].time, false)} puis ${fmtDate(cjs[1].time, false)})` : `Un CoinJoin (${fmtDate(cjs[0].time, false)})`} : les ${m} UTXO deviennent ${m} sorties de ${amt(denom, 'BTC')} indiscernables de celles des autres participants.\n` +
          `4. Erreur : environ ${waitH.toFixed(1).replace('.', ',')} h plus tard, ${q} sorties mixées sont dépensées avec le rendu toxique dans ${consTx.hash.slice(0, 14)}…, vers l'adresse de dépôt ${exName} ${A(w, deposit)} (${amt(deposited, 'BTC')}).\n` +
          `5. ${leftover.length ? `Une autre sortie mixée est dépensée seule chez CardHub : sans erreur de ce type, elle resterait non attribuable.` : 'Toutes les sorties mixées ont été exploitées.'}\n\n` +
          `Leçon : un CoinJoin n'est pas une impasse. On cherche (a) le rendu toxique de la Tx0, (b) les dépenses communes post-mix, (c) les montants et délais caractéristiques. Mais on se garde des faux positifs : deux sorties de même dénomination dépensées ensemble ne désignent quelqu'un que si l'une d'elles est déjà rattachée au suspect.`,
      },
      hints: [
        'L\'adresse de paiement figure dans le message de chantage : ajoutez-la au graphe, examinez ses paiements entrants puis dépliez ses sorties.',
        'La Tx0 produit plusieurs sorties identiques et une sortie différente : cette dernière est le rendu toxique.',
        'Le CoinJoin est repéré automatiquement (nombreuses sorties égales). Ne cherchez pas à le « démêler » directement.',
        'Suivez la dépense du rendu toxique : sa sortie unique est une adresse de dépôt.',
      ],
    }
  },
}
