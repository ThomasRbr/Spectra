import { World } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { EUR_USD, fromUsd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Chantage par courriel payé en litecoins : la victime paie l'escroc (avec son
// propre rendu), puis l'escroc regroupe les paiements de plusieurs victimes et
// en dépose une partie sur un exchange, le reste revenant sur une adresse de
// rendu du même type que ses entrées.

const r2 = (v: number) => Math.round(v * 100) / 100
const r8 = (v: number) => Math.round(v * 1e8) / 1e8

export const debLitecoin: ScenarioTemplate = {
  id: 'deb-litecoin',
  title: 'Chantage payé en litecoins',
  tagline: 'Litecoin fonctionne comme Bitcoin : entrées, sorties et rendu.',
  description:
    'Une victime de chantage par courriel a payé en litecoins (LTC). Retrouvez l\'adresse de l\'auteur dans la transaction de paiement, distinguez le paiement du rendu, puis suivez les fonds jusqu\'à l\'adresse de dépôt d\'un exchange. Litecoin reprend le modèle UTXO de Bitcoin : les mêmes réflexes s\'appliquent.',
  difficulty: 1,
  chains: ['ltc'],
  skills: ['lecture_tx', 'utxo', 'change', 'exchange_id'],
  estMinutes: 15,
  lessons: ['bases-blockchain', 'utxo', 'change-heuristics', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'ltc')
    const destKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const dest = exchange(w, destKey, 'ltc')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Auteur du chantage (inconnu)', category: 'suspect' })
    const sKind: AddrKind = r.pick(['p2pkh', 'p2sh'] as const)

    const victim = w.addr('ltc', { entity: victimE, kind: 'p2wpkh' })
    const vChange = w.addr('ltc', { entity: victimE, kind: 'p2wpkh', wallet: w.get(victim).wallet })
    const s1 = w.addr('ltc', { entity: suspect, kind: sKind })

    // ── Paiement de la victime ──────────────────────────────────────────────
    const demandEur = r.pick([400, 500, 600, 750, 800, 900, 1000, 1200])
    const demand = r2(fromUsd('LTC', demandEur * EUR_USD))
    const buyT = w.at(-r.float(6, 30))
    cv.withdraw(victim, r8(demand + r.float(0.4, 2.5)), buyT)
    const T0 = w.at(0)
    const pay = w.utxoTx({ time: T0, from: [victim], to: [{ address: s1, value: demand }], change: vChange })

    // ── Autres destinataires du même courriel ───────────────────────────────
    const nOthers = r.int(2, 3)
    const others: string[] = []
    for (let i = 0; i < nOthers; i++) {
      const o = w.addr('ltc')
      others.push(o)
      const v = r2(fromUsd('LTC', r.pick([300, 450, 500, 650, 800, 1000]) * EUR_USD))
      const t = w.at(r.float(-40, 50))
      w.fund(o, r8(v * r.float(1.05, 1.6)), t - Math.round(r.float(3, 72) * HOUR))
      w.utxoTx({ time: t, from: [o], to: [{ address: s1, value: v }] })
    }

    // ── Dépôt sur l'exchange, rendu vers le portefeuille de l'escroc ─────────
    const tOut = w.at(r.float(60, 90))
    const total = w.unspentValue(s1, tOut)
    const depValue = Math.floor(total * r.float(0.7, 0.85) * 10) / 10
    const deposit = w.addr('ltc', { entity: dest.entity, label: `${dest.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: 'p2wpkh' })
    const chg = w.addr('ltc', { entity: suspect, kind: sKind, wallet: w.get(s1).wallet })
    const out = w.utxoTx({ time: tOut, from: [s1], to: [{ address: deposit, value: depValue }], change: chg, spendAll: true })
    const sweep = dest.sweep([deposit], tOut + Math.round(r.float(1, 6) * HOUR))[0]
    const kept = r8(out.outputs.find((o) => o.address === chg)?.value ?? 0)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(12, w.at(-3 * 24), w.at(7 * 24))
    cv.noise(8, w.at(-4 * 24), w.at(5 * 24))

    const destName = dest.entity.name
    const kindLabel = sKind === 'p2pkh' ? 'commence par « L » (format historique)' : 'commence par « M » (script P2SH)'

    return {
      world: w,
      title: `Chantage au courriel — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour chantage. ${g('Il', 'Elle')} a reçu un courriel affirmant que son ordinateur avait été piraté et que des vidéos intimes seraient envoyées à ses contacts, sauf paiement de ${demandEur.toLocaleString('fr-FR')} € en litecoins. Paniqué${g('', 'e')}, ${g('il', 'elle')} a acheté des LTC sur Coinhouse et payé depuis son portefeuille. Ce type de courriel est envoyé en masse : la menace est en général fictive.\n\n` +
        `Litecoin est une copie adaptée de Bitcoin : modèle UTXO, transactions à entrées et sorties, rendu (change). Seuls les formats d'adresse changent : « ltc1… » (SegWit), « L… » (historique) et « M… » (script).\n\n` +
        `Votre mission : identifier l'adresse de l'auteur, comprendre la transaction qui alimente l'exchange et préparer la réquisition.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tOut + DAY, author: victimName,
          body:
            `« J'ai effacé le courriel tout de suite, j'avais honte. Je me souviens qu'il fallait payer ${demandEur.toLocaleString('fr-FR')} € en litecoins, exactement ${amt(demand, 'LTC')}, à une adresse qui figurait dans le message.\n\n` +
            `J'ai acheté les litecoins sur Coinhouse, je les ai reçus sur mon portefeuille, puis j'ai fait le paiement le ${fmtDate(pay.time)}.\n\n` +
            `Mon adresse Litecoin : ${A(w, victim)}\n` +
            `Transaction du paiement : ${pay.hash} »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: tOut + DAY, author: 'Chef de groupe',
          body:
            `Courriel non conservé : on part de la transaction de la victime.\n` +
            `Attention, elle comporte deux sorties : l'une est le paiement, l'autre le rendu qui revient au portefeuille de la victime. Ne pas les confondre.\n` +
            `Même vigilance sur la transaction suivante de l'auteur.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quelle est l\'adresse Litecoin de l\'auteur du chantage ?',
          answer: [s1],
          hint: 'Ouvrez la transaction citée dans la plainte : une des deux sorties correspond exactement au montant exigé.',
          explanation: `La sortie de ${amt(demand, 'LTC')} (le montant exigé) va vers ${A(w, s1)}, qui ${kindLabel}. L'autre sortie, ${A(w, vChange)}, est le rendu de la victime : même type d'adresse que son portefeuille (ltc1…) et montant non rond.`,
        },
        {
          id: 'o2', type: 'address', points: 25,
          prompt: 'Dans la transaction de l\'auteur qui alimente l\'exchange, quelle sortie est son rendu (change) ?',
          answer: [chg],
          hint: 'Le rendu a le plus souvent le même type d\'adresse que les entrées dépensées, un montant non rond, et ne mène pas à un service étiqueté.',
          explanation: `La transaction dépense les ${nOthers + 1} paiements reçus par ${A(w, s1)} et crée deux sorties : ${amt(depValue, 'LTC')} (montant rond) vers une adresse « ltc1… » de ${destName}, et ${amt(kept, 'LTC')} vers ${A(w, chg)}. Cette dernière a le même format que l'adresse de l'auteur et un montant quelconque : c'est le rendu, qui reste sous son contrôle.`,
        },
        {
          id: 'o3', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme l\'auteur a-t-il déposé des litecoins ?',
          answer: [destKey],
          hint: 'Suivez la sortie qui n\'est pas le rendu : l\'adresse est ensuite balayée avec d\'autres vers un hot wallet étiqueté.',
          explanation: `L'adresse de dépôt ${A(w, deposit)} est balayée vers le hot wallet de ${destName} avec d'autres dépôts clients. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o4', type: 'amount', points: 15, unit: 'LTC', tolerance: 0.01,
          prompt: 'Combien de LTC ont été crédités sur l\'adresse de dépôt de l\'exchange ?',
          answer: depValue,
          explanation: `${amt(depValue, 'LTC')}. C'est plus que le paiement de ${victimName} : l'adresse de l'auteur a reçu les paiements de ${nOthers} autres destinataires du même courriel, regroupés dans cette transaction.`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Pour l\'enquêteur, qu\'est-ce qui change entre Litecoin et Bitcoin ?',
          ...choice(r,
            'Peu de choses : même modèle UTXO avec rendu, seuls les formats d\'adresse diffèrent',
            [
              'Tout : Litecoin est un modèle à comptes, le solde reste donc sur l\'adresse',
              'Les adresses L… et M… sont des adresses Bitcoin : les fonds ont changé de chaîne',
              'Litecoin n\'a pas d\'explorateur public : seules les plateformes lisent les transactions',
            ]),
          explanation: 'Litecoin reprend le code de Bitcoin : UTXO, entrées et sorties, rendu, heuristiques identiques (type d\'adresse, montant rond, adresse neuve). Les préfixes diffèrent (ltc1, L, M) et les blocs sont plus rapides (environ 2 min 30). Les explorateurs publics existent. Seule nuance : l\'extension optionnelle MWEB permet des transactions confidentielles, mais elle reste peu utilisée et se repère à l\'entrée et à la sortie de ce bloc d\'extension.',
        },
      ],
      truth: {
        path: [pay.id, out.id, sweep.id],
        addresses: [s1, chg, deposit],
        debrief:
          `1. ${victimName} paie ${amt(demand, 'LTC')} à ${A(w, s1)}. Sa transaction a deux sorties : le paiement et son propre rendu ${A(w, vChange)} (même format ltc1… que son portefeuille).\n` +
          `2. ${nOthers} autres personnes paient la même adresse : le courriel a été envoyé en masse.\n` +
          `3. L'auteur dépense tous ces paiements en une transaction : ${amt(depValue, 'LTC')} (montant rond) vers l'adresse de dépôt ${destName} ${A(w, deposit)}, et ${amt(kept, 'LTC')} de rendu vers ${A(w, chg)}, du même format que son adresse.\n` +
          `4. ${destName} balaie l'adresse de dépôt vers son hot wallet : fin du traçage on-chain.\n\n` +
          `À retenir : tout ce que vous savez de Bitcoin s'applique à Litecoin. Dans chaque transaction, demandez-vous quelle sortie est le paiement et laquelle est le rendu.\n\n` +
          `Réflexes de l'enquêteur : requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits) avec demande de gel ; surveiller l'adresse de rendu, qui détient encore ${amt(kept, 'LTC')} ; rapprocher la plainte d'autres signalements visant la même adresse (les autres payeurs sont aussi des victimes).`,
      },
      hints: [
        'Ouvrez la transaction de la plainte depuis la pièce, puis comparez ses deux sorties au montant exigé.',
        'Dépliez les sorties de l\'adresse de l\'auteur : une seule transaction en part, avec deux sorties.',
        'Un montant rond qui part vers une adresse ensuite balayée vers un hot wallet = dépôt d\'exchange ; l\'autre sortie est le rendu.',
      ],
    }
  },
}
