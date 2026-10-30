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
    'La réserve en bitcoins d\'un réseau de revente de stupéfiants a été identifiée. Elle a été constituée par regroupement de plusieurs adresses de collecte, puis ses fonds en sont extraits par petites tranches (« peel chain ») vers plusieurs plateformes, un casino et un vendeur de cartes cadeaux. Remontez la constitution de la réserve, suivez la chaîne saut par saut, comptez les dépôts par plateforme, confrontez les déclarations du trésorier et localisez le reliquat.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['peel', 'change', 'exchange_id', 'requisition'],
  estMinutes: 45,
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
    const reserveIn = r8(consTotal - consFee)
    const firstMain = mainDeps[0]
    const firstMainTx = steps[firstMain.step].tx
    const orbitTotal = r8(byTarget.get('orbit')?.v ?? 0)
    const orbitN = byTarget.get('orbit')?.n ?? 0
    // Déclaration minorée du trésorier en audition (à confronter à la blockchain)
    const claimed = Math.max(0.05, Math.round(peeledTotal * r.float(0.3, 0.5) * 100) / 100)
    const tAudition = w.at(16 * 24)

    return {
      world: w,
      title: `Opération Pelure — ${city}`,
      briefing:
        `Dans le cadre d'une information judiciaire pour trafic de stupéfiants à ${city}, l'exploitation du téléphone saisi sur ${suspectName}, « trésorier » présumé du réseau, a révélé un portefeuille Bitcoin baptisé « Réserve ».\n\n` +
        `Les clients du réseau paient sur plusieurs adresses de collecte, regroupées ensuite sur cette réserve. Depuis, les fonds en sortent par petites tranches successives : c'est une peel chain. À chaque saut, une petite sortie part vers un service, et le gros du solde file vers une nouvelle adresse du même portefeuille.\n\n` +
        `Objectifs : remonter la constitution de la réserve, suivre la chaîne jusqu'au bout, identifier la plateforme qui a reçu le plus de tranches et le montant concerné, mesurer ce qui a été réellement sorti (à confronter à l'audition du trésorier), puis localiser le reliquat.`,
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
            `Pensez à noter chaque adresse de dépôt : chacune doit figurer dans la réquisition adressée à la plateforme concernée.\n\n` +
            `En amont, une transaction à nombreuses entrées qui alimente la réserve signale un regroupement : par l'heuristique des entrées communes, toutes ces adresses appartiennent au même portefeuille.`,
        },
        {
          id: 'audition', type: 'pv', title: `PV d'audition de ${suspectName} (extrait)`, date: tAudition, author: 'Officier de police judiciaire',
          body:
            `Question : Que sont devenus les bitcoins du portefeuille « Réserve » ?\n` +
            `Réponse : J'en ai sorti un peu, de temps en temps, pour payer des dettes. En tout, pas plus de ${amt(claimed, 'BTC')}, je vous le jure. Le reste, je n'y ai pas touché.\n` +
            `Question : Sur quelles plateformes ?\n` +
            `Réponse : Je ne me souviens plus. Une ou deux fois au casino en ligne, c'est tout.\n` +
            `Question : Combien d'adresses utilisiez-vous pour recevoir les paiements des clients ?\n` +
            `Réponse : Une seule, toujours la même.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o6', type: 'tx', points: 9,
          prompt: 'Quelle transaction a constitué la réserve en regroupant les adresses de collecte ?',
          answer: [consTx.id],
          hint: 'Ajoutez l\'adresse de la réserve (PV d\'exploitation) et ouvrez son unique flux entrant : il compte de nombreuses entrées.',
          explanation: `Le ${fmtDate(consTx.time)}, une seule transaction dépense ${consTx.inputs.length} UTXO réparties sur ${nCollect} adresses et verse ${amt(reserveIn, 'BTC')} sur la réserve, sans rendu. C'est un regroupement (consolidation) : le trésorier a réuni les paiements des clients avant de commencer à les sortir.`,
        },
        {
          id: 'o7', type: 'number', points: 9, unit: 'adresses',
          prompt: 'Combien d\'adresses de collecte distinctes ont été regroupées sur la réserve ?',
          answer: nCollect,
          hint: 'Ouvrez la transaction de regroupement : comptez les adresses distinctes en entrée, pas les UTXO (une même adresse peut apparaître plusieurs fois).',
          explanation: `${nCollect} adresses distinctes (${consTx.inputs.length} entrées au total, chaque adresse ayant reçu plusieurs paiements). Par l'heuristique des entrées communes, elles appartiennent toutes au portefeuille du trésorier, ce qui contredit sa déclaration (« une seule adresse »). Chacune a reçu des paiements de clients : autant de points d'entrée pour identifier des acheteurs, notamment ceux qui ont payé depuis une plateforme régulée.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) la réserve a-t-elle reçu lors de sa constitution ?',
          answer: reserveIn,
          hint: 'C\'est la valeur de l\'unique sortie de la transaction de regroupement (frais déduits).',
          explanation: `${amt(reserveIn, 'BTC')} : la somme des ${consTx.inputs.length} UTXO de collecte (${amt(r8(consTotal), 'BTC')}) moins ${amt(r8(consFee), 'BTC')} de frais. C'est le point de départ de la peel chain et l'ordre de grandeur du produit du trafic sur la période.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Quelle plateforme a reçu le plus grand nombre de tranches ?',
          answer: [main],
          hint: 'Comptez, saut par saut, les petites sorties attribuées à une plateforme (étiquette « Adresse de dépôt », ou cluster rattaché à un exchange après balayage).',
          explanation: `Répartition des tranches :\n${recap}\n${mainName} reçoit ${mainDeps.length} dépôts distincts : l'adresse de dépôt change à chaque tranche, mais elles sont vraisemblablement rattachées au même compte client, ce que la réquisition confirmera.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.03,
          prompt: 'Quel montant total (en BTC) a été versé sur cette plateforme via la peel chain ?',
          answer: mainTotal,
          hint: 'Additionnez les montants des pelures vers les adresses de dépôt de cette plateforme (pas les balayages vers le hot wallet).',
          explanation: `${mainDeps.length} dépôts pour un total de ${amt(mainTotal, 'BTC')}. C'est ce montant, avec la liste des adresses de dépôt et des dates, qui figure dans la réquisition.`,
        },
        {
          id: 'o9', type: 'tx', points: 9,
          prompt: 'Quelle est la première transaction de pelage à destination de la plateforme qui a reçu le plus de tranches ?',
          answer: [firstMainTx.id],
          hint: 'Parcourez la chaîne depuis la réserve, dans l\'ordre : arrêtez-vous au premier saut dont la petite sortie aboutit à une adresse de dépôt de cette plateforme.',
          explanation: `Le premier dépôt chez ${mainName} intervient au saut n° ${firstMain.step + 1}, le ${fmtDate(firstMainTx.time)} (${amt(steps[firstMain.step].peelValue, 'BTC')}). Sa date borne la période à couvrir dans la réquisition (du premier au dernier dépôt), et son hash permet à la plateforme de retrouver immédiatement le compte crédité.`,
        },
        {
          id: 'o3', type: 'number', points: 9, tolerance: 1, unit: 'transactions',
          prompt: 'Combien de transactions de pelage compte la chaîne, depuis la première dépense de la réserve jusqu\'à la dernière adresse non dépensée ?',
          answer: hops,
          hint: 'Chaque saut = une transaction avec une pelure et un rendu. Arrêtez-vous quand le rendu n\'est plus dépensé.',
          explanation: `La chaîne compte ${hops} sauts. ${amt(peeledTotal, 'BTC')} ont été « pelés » au total.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant total (en BTC) la peel chain a-t-elle versé à OrbitCasino ?',
          answer: orbitTotal,
          hint: 'Repérez les pelures dont l\'adresse de destination est étiquetée « OrbitCasino — Adresse de dépôt » et additionnez-les. Ignorez les dépôts d\'autres joueurs sur le casino.',
          explanation: `${orbitN} tranche(s) vers OrbitCasino, pour ${amt(orbitTotal, 'BTC')}. Le casino en ligne sert ici de « blanchisseuse » : on mise peu, on retire des gains apparents. Service peu coopératif, mais l'exposition doit être documentée et comparée à la déclaration du trésorier (« une ou deux fois »).`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.02,
          prompt: 'Le trésorier affirme en audition n\'avoir sorti qu\'une petite somme. Quel montant total (en BTC) a réellement été « pelé » de la réserve ?',
          answer: peeledTotal,
          hint: 'Additionnez toutes les petites sorties de la chaîne, quelle que soit leur destination (plateformes, casino, cartes cadeaux, adresses inconnues). Les frais de transaction ne comptent pas.',
          explanation: `${amt(peeledTotal, 'BTC')} ont été pelés en ${hops} tranches, contre ${amt(claimed, 'BTC')} déclarés : la déclaration est démentie par la blockchain. Ce tableau (date, hash, montant, destinataire de chaque tranche) est l'annexe à joindre au PV de confrontation.`,
        },
        {
          id: 'o4', type: 'address', points: 10,
          prompt: 'Sur quelle adresse se trouve le reliquat en fin de chaîne ?',
          answer: [finalAddr],
          hint: 'C\'est le dernier rendu de la chaîne : il n\'a aucune sortie dépensée.',
          explanation: `Le reliquat (${amt(remaining, 'BTC')}) dort sur ${A(w, finalAddr)}. Il faut le placer sous surveillance (alerte de mouvement) : s'il part vers une plateforme, une réquisition et un gel rapides sont possibles.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Quelle stratégie de réquisition retenir ?',
          hint: 'Que voit chaque plateforme de vos flux ? Et que désigne l\'adresse de son hot wallet ?',
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
          `1. ${nCollect} adresses de collecte reçoivent les paiements des clients, puis sont regroupées en une transaction à ${consTx.inputs.length} entrées (plusieurs paiements par adresse) vers la réserve ${A(w, reserve)} (${amt(reserveIn, 'BTC')}).\n` +
          `2. À partir du ${fmtDate(steps[0].tx.time, false)}, la réserve est « pelée » en ${hops} sauts : à chaque fois une petite sortie (3 à 8,5 % du solde) vers un service, et le reste vers une adresse neuve du même type.\n` +
          `3. Destination des tranches :\n${recap}\n` +
          `4. Les plateformes balaient ensuite chaque adresse de dépôt vers leur hot wallet : on s'arrête au dépôt.\n` +
          `5. Le reliquat de ${amt(remaining, 'BTC')} repose sur ${A(w, finalAddr)}.\n` +
          `6. En audition, le trésorier déclare une seule adresse de réception et « pas plus de ${amt(claimed, 'BTC')} » sortis : la blockchain montre ${nCollect} adresses de collecte et ${amt(peeledTotal, 'BTC')} pelés, dont ${amt(orbitTotal, 'BTC')} vers le casino en ${orbitN} fois.\n\n` +
          `Leçon : dans une peel chain, la continuation est presque toujours la grosse sortie, de même type que l'entrée. L'intérêt pour l'enquête est le nombre de points de contact avec des services régulés : ici ${mainDeps.length} dépôts chez ${mainName}, chacun rattaché au même compte KYC. Les petites sorties vers des adresses non attribuées sont des impasses à documenter sans s'y perdre.`,
      },
      hints: [
        'L\'adresse de départ figure dans le PV d\'exploitation du téléphone : ajoutez-la au graphe.',
        'À chaque saut, la continuation est la grosse sortie, de même type d\'adresse que l\'entrée.',
        'Ne suivez pas les balayages vers les hot wallets : le dépôt est le point d\'arrêt.',
        'Tenez une liste : plateforme → nombre de dépôts → montant.',
        'Avant la chaîne, remontez l\'unique entrée de la réserve : ses entrées révèlent les adresses de collecte.',
      ],
    }
  },
}
