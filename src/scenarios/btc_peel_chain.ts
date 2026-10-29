import { World } from '../engine/world'
import { exchange, peelChain, person, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

type Target = 'binance' | 'bitstamp' | 'okx' | 'huobex' | 'orbit' | 'cardhub' | 'unknown'
const EXCHANGES = ['binance', 'bitstamp', 'okx', 'huobex'] as const

export const btcPeelChain: ScenarioTemplate = {
  id: 'peel-chain',
  title: 'La chaîne de pelage',
  tagline: 'Des dizaines de petits dépôts : remontez une peel chain jusqu\'au bout.',
  description:
    'La réserve en bitcoins d\'un réseau de revente de stupéfiants a été identifiée. Les fonds en sont extraits par petites tranches (« peel chain ») vers plusieurs plateformes, un casino et un vendeur de cartes cadeaux. Suivez la chaîne saut par saut, comptez les dépôts par plateforme et localisez le reliquat.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['peel', 'change', 'exchange_id', 'requisition'],
  estMinutes: 25,
  lessons: ['utxo', 'change-heuristics', 'peel-chains', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const suspectName = fakeName(r)
    const handle = fakeHandle(r)

    const kits: Record<(typeof EXCHANGES)[number], ExchangeKit> = {
      binance: exchange(w, 'binance', 'btc'),
      bitstamp: exchange(w, 'bitstamp', 'btc'),
      okx: exchange(w, 'okx', 'btc'),
      huobex: exchange(w, 'huobex', 'btc'),
    }
    const orbit = w.entity('orbit')
    const orbitHot = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Portefeuille principal', tags: ['liquid', 'hot'] })
    const cardhub = w.entity('cardhub')
    const network = w.customEntity({ name: `Réseau ${suspectName.split(' ')[1]} (stupéfiants)`, category: 'suspect' })

    // ── Plan des tranches : une plateforme principale nettement majoritaire ──
    const main = r.pick(EXCHANGES)
    const nSteps = r.int(12, 25)
    const mainCount = r.int(Math.ceil(nSteps * 0.3), Math.ceil(nSteps * 0.4))
    const plan: Target[] = Array.from({ length: mainCount }, () => main)
    for (let i = 0; i < r.int(1, 3); i++) plan.push('orbit')
    for (let i = 0; i < r.int(1, 2); i++) plan.push('cardhub')
    for (let i = 0; i < r.int(0, 2); i++) plan.push('unknown')
    const others = EXCHANGES.filter((k) => k !== main)
    let j = r.int(0, others.length - 1)
    const counts: Record<string, number> = { [main]: mainCount }
    while (plan.length < nSteps) {
      const k = others[j++ % others.length]
      if ((counts[k] ?? 0) >= mainCount - 2) {
        if (others.every((o) => (counts[o] ?? 0) >= mainCount - 2)) plan.push('unknown')
        continue
      }
      counts[k] = (counts[k] ?? 0) + 1
      plan.push(k)
    }
    r.shuffle(plan)

    // ── Constitution de la réserve : collectes regroupées ───────────────────
    const nCollect = r.int(7, 11)
    const collect = w.addrs('btc', nCollect, { entity: network })
    for (const c of collect) {
      for (let k = 0; k < r.int(3, 6); k++) {
        const buyer = person(w, 'btc', { history: r.chance(0.3) ? 1 : 0, time: w.at(-30 * 24) })
        w.fund(buyer, roundCoin(w, 0.03, 0.18, 0.0001), w.at(-r.float(25, 40) * 24))
        w.utxoTx({ time: w.at(-r.float(5, 24) * 24), from: [buyer], to: [{ address: c, value: roundCoin(w, 0.02, 0.15, 0.001) }] })
      }
    }
    const reserve = w.addr('btc', { entity: network, kind: 'p2wpkh' })
    const consTotal = collect.reduce((s, c) => s + w.unspentValue(c), 0)
    const consFee = w.estimateFee('btc', nCollect, 1)
    const consTx = w.utxoTx({ time: w.at(-r.float(2, 4) * 24), from: collect, to: [{ address: reserve, value: r8(consTotal - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Peel chain ───────────────────────────────────────────────────────────
    const deposits: { target: Target; address: string; step: number }[] = []
    const steps = peelChain(w, {
      start: reserve,
      steps: nSteps,
      time: w.at(0),
      stepH: [1.5, 16],
      peelFraction: [0.03, 0.085],
      peelTarget: (i) => {
        const t = plan[i]
        let a: string
        if (t === 'orbit') a = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] })
        else if (t === 'cardhub') a = w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
        else if (t === 'unknown') a = w.addr('btc')
        else a = kits[t].newDeposit()
        deposits.push({ target: t, address: a, step: i })
        return a
      },
    })

    // Balayages par les plateformes et suites des tranches
    const sweeps: string[] = []
    for (const d of deposits) {
      const st = steps[d.step]
      if (!st) continue
      const t = st.tx.time + r.float(0.5, 10) * HOUR
      if (d.target === 'orbit') sweeps.push(forwardAll(w, d.address, orbitHot, t, undefined, ['sweep']).id)
      else if (d.target === 'cardhub') forwardAll(w, d.address, w.addr('btc', { entity: cardhub, label: 'CardHub — Trésorerie', tags: ['liquid'] }), t)
      else if (d.target === 'unknown') {
        // Impasse : un particulier qui dépense plus tard vers une adresse inconnue
        w.utxoTx({ time: t + r.int(2, 20) * DAY, from: [d.address], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(d.address) * r.float(0.4, 0.7)) }] })
      } else sweeps.push(kits[d.target].sweep([d.address], t)[0].id)
    }

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (const k of EXCHANGES) kits[k].noise(r.int(6, 10), w.at(-5 * 24), w.at(12 * 24))
    for (let i = 0; i < 6; i++) {
      const g = w.addr('btc')
      const ft = w.at(r.float(-10, 10) * 24)
      w.fund(g, roundCoin(w, 0.002, 0.05, 0.0001), ft)
      w.utxoTx({ time: ft + r.int(2, 72) * HOUR, from: [g], to: [{ address: w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] }), value: r8(w.unspentValue(g) * 0.6) }] })
    }

    const mainDeps = deposits.filter((d) => d.target === main && steps[d.step])
    const mainTotal = r8(mainDeps.reduce((s, d) => s + steps[d.step].peelValue, 0))
    const hops = steps.length
    const last = steps[steps.length - 1]
    const finalAddr = last.next
    const remaining = w.unspentValue(finalAddr)
    const peeledTotal = r8(steps.reduce((s, st) => s + st.peelValue, 0))
    const byTarget = new Map<Target, { n: number; v: number }>()
    for (const d of deposits) {
      const st = steps[d.step]
      if (!st) continue
      const e = byTarget.get(d.target) ?? { n: 0, v: 0 }
      e.n++
      e.v += st.peelValue
      byTarget.set(d.target, e)
    }
    const targetName = (t: Target) => (t === 'orbit' ? 'OrbitCasino' : t === 'cardhub' ? 'CardHub' : t === 'unknown' ? 'adresses non attribuées' : kits[t].entity.name)
    const recap = [...byTarget.entries()].sort((a, b) => b[1].n - a[1].n).map(([t, e]) => `   • ${targetName(t)} : ${e.n} tranche(s), ${amt(r8(e.v), 'BTC')}`).join('\n')
    const mainName = kits[main].entity.name

    return {
      world: w,
      title: `Opération Pelure — ${city}`,
      briefing:
        `Dans le cadre d'une information judiciaire pour trafic de stupéfiants à ${city}, l'exploitation du téléphone saisi sur ${suspectName}, « trésorier » présumé du réseau, a révélé un portefeuille Bitcoin baptisé « Réserve ».\n\n` +
        `Les clients du réseau paient sur plusieurs adresses de collecte, regroupées ensuite sur cette réserve. Depuis, les fonds en sortent par petites tranches successives : c'est une peel chain. À chaque saut, une petite sortie part vers un service, et le gros du solde file vers une nouvelle adresse du même portefeuille.\n\n` +
        `Objectifs : suivre la chaîne jusqu'au bout, identifier la plateforme qui a reçu le plus de tranches et le montant concerné, puis localiser le reliquat.`,
      evidence: [
        {
          id: 'pv', type: 'pv', title: 'PV d\'exploitation du téléphone (extrait)', date: w.at(14 * 24), author: 'Enquêteur NTECH',
          body:
            `Application de portefeuille Bitcoin installée, compte « Réserve ».\n` +
            `Adresse de réception affichée : ${A(w, reserve)}\n` +
            `Historique local partiellement effacé. Phrase de récupération non retrouvée.\n` +
            `Dernière synchronisation : ${fmtDate(w.at(-1 * 24))}.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Conversation Telegram « Compta »', author: `@${handle}`, date: w.at(-3 * 24),
          body:
            `${handle} : t'as regroupé les collectes ?\n` +
            `Trésorier : oui tout est sur la réserve\n` +
            `${handle} : sors ça doucement, jamais de gros montant d'un coup, et change de plateforme de temps en temps\n` +
            `Trésorier : t'inquiète, je découpe. Un peu au casino aussi, et des cartes cadeaux pour les gars`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste', date: w.at(15 * 24), author: 'Cellule d\'appui',
          body:
            `Signature d'une peel chain :\n` +
            `• une entrée, deux sorties ;\n` +
            `• une petite sortie (la « pelure ») vers un service ;\n` +
            `• une grosse sortie vers une adresse neuve du même type, qui devient l'entrée du saut suivant.\n\n` +
            `Pensez à noter chaque adresse de dépôt : chacune doit figurer dans la réquisition adressée à la plateforme concernée.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 25,
          prompt: 'Quelle plateforme a reçu le plus grand nombre de tranches ?',
          answer: [main],
          hint: 'Comptez, saut par saut, les petites sorties attribuées à une plateforme (étiquette « Adresse de dépôt », ou cluster rattaché à un exchange après balayage).',
          explanation: `Répartition des tranches :\n${recap}\n${mainName} reçoit ${mainDeps.length} dépôts distincts : l'adresse de dépôt change à chaque tranche, mais elles sont vraisemblablement rattachées au même compte client, ce que la réquisition confirmera.`,
        },
        {
          id: 'o2', type: 'amount', points: 25, unit: 'BTC', tolerance: 0.03,
          prompt: 'Quel montant total (en BTC) a été versé sur cette plateforme via la peel chain ?',
          answer: mainTotal,
          hint: 'Additionnez les montants des pelures vers les adresses de dépôt de cette plateforme (pas les balayages vers le hot wallet).',
          explanation: `${mainDeps.length} dépôts pour un total de ${amt(mainTotal, 'BTC')}. C'est ce montant, avec la liste des adresses de dépôt et des dates, qui figure dans la réquisition.`,
        },
        {
          id: 'o3', type: 'number', points: 20, tolerance: 1, unit: 'transactions',
          prompt: 'Combien de transactions de pelage compte la chaîne, depuis la première dépense de la réserve jusqu\'à la dernière adresse non dépensée ?',
          answer: hops,
          hint: 'Chaque saut = une transaction avec une pelure et un rendu. Arrêtez-vous quand le rendu n\'est plus dépensé.',
          explanation: `La chaîne compte ${hops} sauts. ${amt(peeledTotal, 'BTC')} ont été « pelés » au total.`,
        },
        {
          id: 'o4', type: 'address', points: 20,
          prompt: 'Sur quelle adresse se trouve le reliquat en fin de chaîne ?',
          answer: [finalAddr],
          hint: 'C\'est le dernier rendu de la chaîne : il n\'a aucune sortie dépensée.',
          explanation: `Le reliquat (${amt(remaining, 'BTC')}) dort sur ${A(w, finalAddr)}. Il faut le placer sous surveillance (alerte de mouvement) : s'il part vers une plateforme, une réquisition et un gel rapides sont possibles.`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Quelle stratégie de réquisition retenir ?',
          ...choice(r,
            'Une réquisition par plateforme listant chaque dépôt (date, montant), et une alerte sur le reliquat',
            [
              'Une seule réquisition, adressée à la plateforme principale, citant l\'adresse de son hot wallet',
              'Une réquisition prioritaire à OrbitCasino, service sans KYC et donc le plus risqué de la liste',
              'Aucune réquisition tant que le reliquat n\'a pas bougé, afin d\'agir sur l\'ensemble en une fois',
            ]),
          explanation: `Chaque plateforme ne voit que ses propres dépôts : on lui transmet la liste exhaustive des adresses de dépôt (une par tranche) avec horodatages, hash et montants. Le hot wallet mélange tous les clients et ne désigne personne. Le casino sans KYC répondra peu ; les exchanges régulés sont prioritaires. ${procedureFor(kits[main].entity)}`,
        },
      ],
      truth: {
        path: [consTx.id, ...steps.map((s) => s.tx.id), ...sweeps],
        addresses: [reserve, ...steps.map((s) => s.next), ...mainDeps.map((d) => d.address)],
        debrief:
          `1. ${nCollect} adresses de collecte reçoivent les paiements des clients, puis sont regroupées en une transaction à ${consTx.inputs.length} entrées (plusieurs paiements par adresse) vers la réserve ${A(w, reserve)} (${amt(r8(consTotal - consFee), 'BTC')}).\n` +
          `2. À partir du ${fmtDate(steps[0].tx.time, false)}, la réserve est « pelée » en ${hops} sauts : à chaque fois une petite sortie (3 à 8,5 % du solde) vers un service, et le reste vers une adresse neuve du même type.\n` +
          `3. Destination des tranches :\n${recap}\n` +
          `4. Les plateformes balaient ensuite chaque adresse de dépôt vers leur hot wallet : on s'arrête au dépôt.\n` +
          `5. Le reliquat de ${amt(remaining, 'BTC')} repose sur ${A(w, finalAddr)}.\n\n` +
          `Leçon : dans une peel chain, la continuation est presque toujours la grosse sortie, de même type que l'entrée. L'intérêt pour l'enquête est le nombre de points de contact avec des services régulés : ici ${mainDeps.length} dépôts chez ${mainName}, chacun rattaché au même compte KYC. Les petites sorties vers des adresses non attribuées sont des impasses à documenter sans s'y perdre.`,
      },
      hints: [
        'L\'adresse de départ figure dans le PV d\'exploitation du téléphone : ajoutez-la au graphe.',
        'À chaque saut, la continuation est la grosse sortie, de même type d\'adresse que l\'entrée.',
        'Ne suivez pas les balayages vers les hot wallets : le dépôt est le point d\'arrêt.',
        'Tenez une liste : plateforme → nombre de dépôts → montant.',
      ],
    }
  },
}
