import { World } from '../engine/world'
import { exchange, peelChain, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { fromUsd, roundAsset } from '../engine/chains'
import { decoyBranches, dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
/** Heure (0-23) à Paris d'un horodatage. */
function parisHour(ts: number): number {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(new Date(ts * 1000))
  return Number(p.find((x) => x.type === 'hour')!.value)
}
/** Premier horodatage ≥ `ts` tombant à l'heure pile `h` (heure de Paris). */
function nextHour(ts: number, h: number): number {
  let t = Math.ceil(ts / 3600) * 3600
  while (parisHour(t) !== h) t += 3600
  return t
}
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`

type Target = 'binance' | 'bitstamp' | 'okx' | 'huobex' | 'orbit' | 'cardhub' | 'hodlhodl' | 'self' | 'unknown'
const EXCHANGES = ['binance', 'bitstamp', 'okx', 'huobex'] as const

export const btcPeelChain: ScenarioTemplate = {
  id: 'peel-chain',
  title: 'La chaîne de pelage',
  tagline: 'Des dizaines de petits dépôts : remontez une peel chain jusqu\'au bout, puis triez la sortie finale.',
  description:
    'La réserve en bitcoins d\'un réseau de revente de stupéfiants a été identifiée. Elle a été constituée par regroupement d\'adresses de collecte payées par des dizaines de clients, puis ses fonds en sont extraits par petites tranches (« peel chain ») vers des plateformes, un casino, un vendeur de cartes cadeaux, une place de marché P2P… et vers des adresses du réseau lui-même. Remontez la constitution de la réserve, suivez la chaîne saut par saut sans vous laisser égarer par les pelures leurres, comptez les dépôts par plateforme, confrontez les déclarations du trésorier, puis triez l\'éclatement final pour trouver où part le reliquat.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['peel', 'change', 'exchange_id', 'requisition'],
  estMinutes: 55,
  lessons: ['utxo', 'change-heuristics', 'peel-chains', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    // Le « trésorier » (textes au masculin, description comprise)
    const suspectName = fakePerson(r, 'm').name
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
    const hodl = w.entity('hodlhodl')
    const satsdesk = w.entity('satsdesk')
    const network = w.customEntity({ name: `Réseau ${suspectName.split(' ')[1]} (stupéfiants)`, category: 'suspect' })

    // ── Plan des tranches : une plateforme principale nettement majoritaire ──
    const main = r.pick(EXCHANGES)
    const nSteps = r.int(13, 20)
    const mainCount = r.int(Math.ceil(nSteps * 0.3), Math.ceil(nSteps * 0.38))
    const plan: Target[] = Array.from({ length: mainCount }, () => main)
    for (let i = 0; i < r.int(1, 2); i++) plan.push('orbit')
    plan.push('cardhub', 'hodlhodl', 'self', 'self')
    for (let i = 0; i < r.int(1, 2); i++) plan.push('unknown')
    const others = EXCHANGES.filter((k) => k !== main)
    let j = r.int(0, others.length - 1)
    const counts: Record<string, number> = { [main]: mainCount }
    const nHops = Math.max(nSteps, plan.length)
    while (plan.length < nHops) {
      const k = others[j++ % others.length]
      if ((counts[k] ?? 0) >= mainCount - 2) {
        if (others.every((o) => (counts[o] ?? 0) >= mainCount - 2)) plan.push('unknown')
        continue
      }
      counts[k] = (counts[k] ?? 0) + 1
      plan.push(k)
    }
    r.shuffle(plan)

    // ── Constitution de la réserve : des dizaines de clients paient les adresses de collecte ──
    const nCollect = r.int(7, 10)
    const collect = w.addrs('btc', nCollect, { entity: network })
    const buyerPay = () => (r.chance(0.65) ? roundAsset('BTC', fromUsd('BTC', r.float(40, 380))) : roundCoin(w, 0.02, 0.12, 0.001))
    for (const c of collect) {
      for (let k = 0; k < r.int(6, 10); k++) {
        const t = w.at(-r.float(5, 26) * 24)
        const buyer = w.addr('btc')
        const v = buyerPay()
        w.fund(buyer, v * r.float(1.05, 1.8), t - Math.round(r.float(1, 20) * DAY))
        w.utxoTx({ time: t, from: [buyer], to: [{ address: c, value: v }] })
      }
    }
    const reserve = w.addr('btc', { entity: network, kind: 'p2wpkh' })
    const consT = w.at(-r.float(2, 4) * 24)
    const consTotal = collect.reduce((s, c) => s + w.unspentValue(c, consT), 0)
    const consFee = w.estimateFee('btc', collect.reduce((s, c) => s + w.utxosOf(c, consT).length, 0), 1)
    const consTx = w.utxoTx({ time: consT, from: collect, to: [{ address: reserve, value: r8(consTotal - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Peel chain ───────────────────────────────────────────────────────────
    const deposits: { target: Target; address: string; step: number }[] = []
    const steps = peelChain(w, {
      start: reserve,
      steps: nHops,
      time: w.at(0),
      stepH: [1.5, 16],
      peelFraction: [0.03, 0.085],
      peelTarget: (i) => {
        const t = plan[i]
        let a: string
        if (t === 'orbit') a = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] })
        else if (t === 'cardhub') a = w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
        else if (t === 'hodlhodl') a = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
        // Pelure leurre : adresse neuve du réseau, du même type que les sauts de la chaîne
        else if (t === 'self') a = w.addr('btc', { entity: network, kind: 'p2wpkh' })
        else if (t === 'unknown') a = w.addr('btc')
        else a = kits[t].newDeposit()
        deposits.push({ target: t, address: a, step: i })
        return a
      },
    })

    // Balayages par les services et suites des tranches
    const sweeps: string[] = []
    let selfIdx = 0
    const selfFate: { address: string; fate: 'dort' | 'casino'; value: number }[] = []
    for (const d of deposits) {
      const st = steps[d.step]
      if (!st) continue
      const t = st.tx.time + r.float(0.5, 10) * HOUR
      if (d.target === 'orbit') sweeps.push(forwardAll(w, d.address, orbitHot, t, undefined, ['sweep']).id)
      else if (d.target === 'cardhub') forwardAll(w, d.address, w.addr('btc', { entity: cardhub, label: 'CardHub — Trésorerie', tags: ['liquid'] }), t)
      else if (d.target === 'hodlhodl') forwardAll(w, d.address, w.addr('btc'), t, undefined, ['escrow-release'])
      else if (d.target === 'self') {
        // La première pelure leurre dort ; la seconde est jouée au casino quelques jours plus tard
        const fate = selfIdx++ === 0 ? 'dort' : 'casino'
        selfFate.push({ address: d.address, fate, value: st.peelValue })
        if (fate === 'casino') {
          // Deux mises successives, le rendu revenant sur l'adresse elle-même
          let tc = st.tx.time + Math.round(r.float(2, 4) * DAY)
          for (let m = 0; m < 2; m++) {
            const dep = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] })
            w.utxoTx({ time: tc, from: [d.address], to: [{ address: dep, value: r8(st.peelValue * r.float(0.25, 0.4)) }], change: d.address })
            forwardAll(w, dep, orbitHot, tc + Math.round(r.float(0.2, 3) * HOUR), undefined, ['sweep'])
            tc += Math.round(r.float(6, 40) * HOUR)
          }
        }
      } else if (d.target === 'unknown') {
        // Impasse : un particulier qui dépense plus tard vers une adresse inconnue
        w.utxoTx({ time: t + r.int(2, 20) * DAY, from: [d.address], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(d.address) * r.float(0.4, 0.7)) }] })
      } else sweeps.push(kits[d.target].sweep([d.address], t)[0].id)
    }

    // ── Fin de chaîne : l'adresse finale éclate le reliquat, puis règle le gros à un OTC ──
    const last = steps[steps.length - 1]
    const finalAddr = last.next
    const finalIn = w.unspentValue(finalAddr)
    const brT = last.tx.time + Math.round(r.float(1, 2) * DAY)
    const branches = decoyBranches(w, finalAddr, { time: brT, share: r.float(0.28, 0.38), branches: r.int(2, 3), returnTo: reserve })
    const otcDep = w.addr('btc', { entity: satsdesk, label: 'SatsDesk OTC — Adresse de règlement', tags: ['deposit'] })
    const otcTx = forwardAll(w, finalAddr, otcDep, brT + Math.round(r.float(8, 30) * HOUR))
    const otcValue = r8(otcTx.outputs[0].value)
    forwardAll(w, otcDep, w.addr('btc', { entity: satsdesk, label: 'SatsDesk OTC — Portefeuille de règlement', tags: ['liquid', 'hot'] }), otcTx.time + Math.round(r.float(1, 6) * HOUR), undefined, ['sweep'])

    // ── Habillage (après coup : la chaîne et la réserve ne sont pas modifiées) ──
    // Des clients continuent de payer sur les anciennes adresses de collecte, et l'un d'eux sur la réserve
    const lateCollect = Array.from({ length: r.int(3, 5) }, () => {
      const c = r.pick(collect)
      const t = consTx.time + Math.round(r.float(0.3, 8) * DAY)
      const buyer = w.addr('btc')
      const v = buyerPay()
      w.fund(buyer, v * r.float(1.05, 1.6), t - Math.round(r.float(1, 10) * DAY))
      return w.utxoTx({ time: t, from: [buyer], to: [{ address: c, value: v }] })
    })
    const lateRes = Array.from({ length: r.int(1, 2) }, () => {
      const t = w.at(r.float(12, 200))
      const buyer = w.addr('btc')
      const v = roundCoin(w, 0.01, 0.05, 0.001)
      w.fund(buyer, v * r.float(1.05, 1.6), t - Math.round(r.float(1, 10) * DAY))
      return w.utxoTx({ time: t, from: [buyer], to: [{ address: reserve, value: v }] })
    })
    dusting(w, reserve, { time: w.at(48), n: 1, spreadH: 40 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    for (const k of EXCHANGES) kits[k].noise(r.int(6, 10), w.at(-5 * 24), w.at(12 * 24))
    for (let i = 0; i < 6; i++) {
      const g = w.addr('btc')
      const ft = w.at(r.float(-10, 10) * 24)
      w.fund(g, roundCoin(w, 0.002, 0.05, 0.0001), ft)
      w.utxoTx({ time: ft + r.int(2, 72) * HOUR, from: [g], to: [{ address: w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] }), value: r8(w.unspentValue(g) * 0.6) }] })
    }

    // ── Réponses, calculées sur le monde final ───────────────────────────────
    const mainDeps = deposits.filter((d) => d.target === main && steps[d.step])
    const mainTotal = r8(mainDeps.reduce((s, d) => s + steps[d.step].peelValue, 0))
    const hops = steps.length
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
    const targetName = (t: Target) => ({ orbit: 'OrbitCasino', cardhub: 'CardHub (cartes cadeaux)', hodlhodl: 'Hodl Hodl (séquestre P2P)', self: 'adresses du réseau (pelures leurres)', unknown: 'particuliers non identifiés' } as Record<string, string>)[t] ?? kits[t as (typeof EXCHANGES)[number]].entity.name
    const recap = [...byTarget.entries()].sort((a, b) => b[1].n - a[1].n).map(([t, e]) => `   • ${targetName(t)} : ${plural(e.n, 'tranche')}, ${amt(r8(e.v), 'BTC')}`).join('\n')
    const mainName = kits[main].entity.name
    const reserveIn = r8(consTotal - consFee)
    const firstMain = mainDeps[0]
    const firstMainTx = steps[firstMain.step].tx
    const orbitTotal = r8(byTarget.get('orbit')?.v ?? 0)
    const orbitN = byTarget.get('orbit')?.n ?? 0
    const selfTotal = r8(byTarget.get('self')?.v ?? 0)
    const nBuyers = collect.reduce((s, c) => s + w.txsOf(c).filter((t) => t.outputs.some((o) => o.address === c) && t.id !== consTx.id).length, 0)
    // Sort de chaque branche, lu dans le monde (les commerçants payés sont tirés au hasard)
    const spentTo = (b: (typeof branches)[number]) => {
      const shops = new Set<string>()
      let people = 0
      for (const tx of b.follow) for (const o of tx.outputs) {
        if (o.address === b.address) continue
        const e = w.get(o.address).entityId
        if (e) shops.add(w.entities.get(e)!.name)
        else people++
      }
      return [...(shops.size ? [[...shops].join(', ')] : []), ...(people ? [people > 1 ? `${people} particuliers` : 'un particulier'] : [])].join(' et ')
    }
    const fateTxt = (b: (typeof branches)[number]) => (b.fate === 'dort' ? 'n\'a plus bougé' : b.fate === 'dépensée' ? `a ensuite payé ${spentTo(b)}` : b.fate === 'éclatée' ? `est ré-éclatée en ${b.follow.length} petites sommes vers des adresses inconnues` : 'revient ensuite sur la réserve')
    const branchTxt = branches.map((b) => `${b.tx.hash.slice(0, 10)}… (${amt(b.value, 'BTC')} vers une adresse neuve qui ${fateTxt(b)})`).join(', ')
    // Délais réels entre deux sauts de la chaîne
    const gaps = steps.slice(1).map((s, i) => (s.tx.time - steps[i].tx.time) / HOUR)
    const fmtH = (h: number) => {
      const m = Math.round(h * 60)
      if (m < 60) return `${m} min`
      return m % 60 && m < 600 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${Math.round(m / 60)} h`
    }
    const gapTxt = `entre ${fmtH(Math.min(...gaps))} et ${fmtH(Math.max(...gaps))} plus tard`
    // Chronologie procédurale : interpellation après la dernière opération du réseau
    const lastMove = Math.max(...[...w.txs.values()].filter((t) => t.inputs.some((i) => w.get(i.address).entityId === network.id)).map((t) => t.time))
    const tArrest = nextHour(lastMove + DAY, 6)
    const tSync = Math.round(r.float(lastMove + 1800, tArrest - 2 * HOUR))
    const tPv = nextHour(tArrest + 20 * HOUR, r.int(9, 11))
    const tAudition = tPv + Math.round(r.float(3, 6) * HOUR)
    const tNote = nextHour(tAudition + r.int(1, 3) * DAY, r.int(9, 16))
    const tCompta = Math.round(r.float(consTx.time + 2 * HOUR, steps[0].tx.time - HOUR))
    const selfTxt = selfFate.map((s) => `${A(w, s.address).slice(0, 14)}… (${amt(s.value, 'BTC')}, ${s.fate === 'dort' ? 'jamais dépensée' : 'jouée ensuite à OrbitCasino'})`).join(' et ')
    // Déclaration minorée du trésorier en audition (à confronter à la blockchain)
    const claimed = Math.max(0.05, Math.round(peeledTotal * r.float(0.3, 0.5) * 100) / 100)

    return {
      world: w,
      title: `Opération Pelure — ${city}`,
      briefing:
        `Dans le cadre d'une information judiciaire pour trafic de stupéfiants à ${city}, l'exploitation du téléphone saisi sur ${suspectName}, « trésorier » présumé du réseau, a révélé un portefeuille Bitcoin baptisé « Réserve ».\n\n` +
        `Les clients du réseau paient sur plusieurs adresses de collecte, regroupées ensuite sur cette réserve. Depuis, les fonds en sortent par petites tranches successives : c'est une peel chain. À chaque saut, une petite sortie part vers un service ou une autre adresse, et le gros du solde file vers une nouvelle adresse du même portefeuille. Toutes les petites sorties ne sont pas des dépôts : certaines reviennent au réseau.\n\n` +
        `Objectifs : remonter la constitution de la réserve, suivre la chaîne jusqu'au bout, identifier la plateforme qui a reçu le plus de tranches et le montant concerné, mesurer ce qui a été réellement sorti (à confronter à l'audition du trésorier), puis trier l'éclatement final pour savoir où est parti le reliquat.`,
      evidence: [
        {
          id: 'pv', type: 'pv', title: 'PV d\'exploitation du téléphone (extrait)', date: tPv, author: 'Enquêteur NTECH',
          body:
            `Application de portefeuille Bitcoin installée, compte « Réserve ».\n` +
            `Adresse de réception affichée : ${A(w, reserve)}\n` +
            `Historique local partiellement effacé. Phrase de récupération non retrouvée.\n` +
            `Téléphone saisi lors de l'interpellation du ${fmtDate(tArrest)}. Dernière synchronisation de l'application : ${fmtDate(tSync)}.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Conversation Telegram « Compta »', author: `@${handle}`, date: tCompta,
          body:
            `${handle} : t'as regroupé les collectes ?\n` +
            `Trésorier : oui tout est sur la réserve\n` +
            `${handle} : sors ça doucement, jamais de gros montant d'un coup, et change de plateforme de temps en temps\n` +
            `Trésorier : t'inquiète, je découpe. Un peu au casino aussi, des cartes cadeaux pour les gars, et je mets un peu de côté sur des adresses à moi\n` +
            `${handle} : et le gros qui reste à la fin ?\n` +
            `Trésorier : comme d'hab, le desk. Cash en main, pas de banque.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste', date: tNote, author: 'Cellule d\'appui',
          body:
            `Signature d'une peel chain :\n` +
            `• une entrée, deux sorties ;\n` +
            `• une petite sortie (la « pelure ») vers un service… ou vers une adresse du même portefeuille mise de côté : une adresse neuve du même type n'est pas forcément la continuation ;\n` +
            `• une grosse sortie vers une adresse neuve du même type, qui devient l'entrée du saut suivant.\n\n` +
            `Pensez à noter chaque adresse de dépôt : chacune doit figurer dans la réquisition adressée à la plateforme concernée.\n\n` +
            `En amont, une transaction à nombreuses entrées qui alimente la réserve signale un regroupement : par l'heuristique des entrées communes, toutes ces adresses appartiennent au même portefeuille.\n\n` +
            `En fin de chaîne, le reliquat est souvent éclaté en plusieurs transactions : cherchez celle qui emporte l'essentiel et vers qui.`,
        },
        {
          id: 'audition', type: 'pv', title: `PV d'audition ${de(suspectName)} (extrait)`, date: tAudition, author: 'Officier de police judiciaire',
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
          hint: 'Ajoutez l\'adresse de la réserve (PV d\'exploitation) et ouvrez sa toute première transaction entrante : elle compte de nombreuses entrées. Les petits versements arrivés plus tard ne sont pas le regroupement.',
          explanation: `Le ${fmtDate(consTx.time)}, une seule transaction dépense ${consTx.inputs.length} UTXO réparties sur ${nCollect} adresses et verse ${amt(reserveIn, 'BTC')} sur la réserve, sans rendu. C'est un regroupement (consolidation) : le trésorier a réuni les paiements des clients avant de commencer à les sortir. ${lateRes.length > 1 ? `Les ${lateRes.length} versements reçus` : 'Le versement reçu'} ensuite par la réserve, après le début de la chaîne, ${lateRes.length > 1 ? 'viennent' : 'vient'} de clients qui ont payé directement sur cette adresse : ${lateRes.length > 1 ? 'ils dorment' : 'il dort'} encore dessus.`,
        },
        {
          id: 'o7', type: 'number', points: 9, unit: 'adresses',
          prompt: 'Combien d\'adresses de collecte distinctes ont été regroupées sur la réserve ?',
          answer: nCollect,
          hint: 'Ouvrez la transaction de regroupement : comptez les adresses distinctes en entrée, pas les UTXO (une même adresse peut apparaître plusieurs fois).',
          explanation: `${nCollect} adresses distinctes (${consTx.inputs.length} entrées au total, chaque adresse ayant reçu plusieurs paiements). Par l'heuristique des entrées communes, elles appartiennent toutes au portefeuille du trésorier, ce qui contredit sa déclaration (« une seule adresse »). Au total, ces adresses ont reçu ${nBuyers} paiements de clients (dont ${lateCollect.length} après le regroupement, encore non dépensés) : autant de points d'entrée pour identifier des acheteurs, notamment ceux qui ont payé depuis une plateforme régulée.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) la réserve a-t-elle reçu lors de sa constitution ?',
          answer: reserveIn,
          hint: 'C\'est la valeur de l\'unique sortie de la transaction de regroupement (frais déduits), pas le « total reçu » de l\'adresse.',
          explanation: `${amt(reserveIn, 'BTC')} : la somme des ${consTx.inputs.length} UTXO de collecte (${amt(r8(consTotal), 'BTC')}) moins ${amt(r8(consFee), 'BTC')} de frais. C'est le point de départ de la peel chain et l'ordre de grandeur du produit du trafic sur la période. Le « total reçu » de la réserve est un peu plus élevé : il inclut les versements tardifs de clients, une poussière de 546 sats et, le cas échéant, une branche revenue en fin de chaîne.`,
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
          prompt: 'Combien de transactions de pelage (une petite sortie, un gros rendu) compte la chaîne, depuis la première dépense de la réserve jusqu\'à l\'adresse finale qui éclate le reliquat ?',
          answer: hops,
          hint: 'Chaque saut = une transaction avec une pelure et un rendu neuf. Aux sauts où la pelure part vers une adresse neuve du même type, la continuation reste la grosse sortie. Arrêtez-vous quand le rendu commence à se renvoyer la monnaie sur lui-même.',
          explanation: `La chaîne compte ${hops} sauts. À ${selfFate.length} reprises, la pelure part vers une adresse du réseau du même type que la chaîne (${selfTxt}) : type d'adresse et nouveauté ne tranchent pas, mais la taille (la pelure ne fait que 3 à 8,5 % du solde) et la suite (c'est la grosse sortie qui est dépensée au saut suivant, ${gapTxt}) désignent la continuation.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant total (en BTC) la peel chain a-t-elle versé à OrbitCasino ?',
          answer: orbitTotal,
          hint: 'Repérez les pelures dont l\'adresse de destination est étiquetée « OrbitCasino — Adresse de dépôt » et additionnez-les. Ignorez les dépôts d\'autres joueurs, et les mises faites plus tard depuis une pelure leurre.',
          explanation: `${plural(orbitN, 'tranche')} ${orbitN > 1 ? 'directes' : 'directe'} vers OrbitCasino, pour ${amt(orbitTotal, 'BTC')}. Une pelure leurre a aussi été jouée au casino quelques jours plus tard, mais depuis une adresse intermédiaire : ce n'est pas une tranche de la chaîne. Le casino en ligne sert ici de « blanchisseuse » : on mise peu, on retire des gains apparents. Service peu coopératif, mais l'exposition doit être documentée et comparée à la déclaration du trésorier (« une ou deux fois »).`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.02,
          prompt: 'Le trésorier affirme en audition n\'avoir sorti qu\'une petite somme. Quel montant total (en BTC) a été « pelé » de la chaîne, toutes destinations confondues ?',
          answer: peeledTotal,
          hint: 'Additionnez toutes les petites sorties des transactions de pelage, quelle que soit leur destination (plateformes, casino, commerçants, P2P, adresses inconnues ou du réseau). Les frais et l\'éclatement final ne comptent pas.',
          explanation: `${amt(peeledTotal, 'BTC')} ont été pelés en ${hops} tranches, contre ${amt(claimed, 'BTC')} déclarés : la déclaration est démentie par la blockchain. ${amt(selfTotal, 'BTC')} de ces tranches sont restées dans le réseau (pelures leurres), le reste est parti vers des tiers. Ce tableau (date, hash, montant, destinataire de chaque tranche) est l'annexe à joindre au PV de confrontation.`,
        },
        {
          id: 'o12', type: 'entity', points: 10,
          prompt: 'Au bout de la chaîne, vers quel service part l\'essentiel du reliquat ?',
          answer: ['satsdesk'],
          hint: 'Dépliez toutes les sorties de l\'adresse finale de la chaîne : plusieurs petites transactions partent vers des adresses neuves, une seule emporte le solde vers une adresse étiquetée.',
          explanation: `Le reliquat est réglé à SatsDesk OTC, courtier de gré à gré qui remet des espèces en échange des bitcoins (« le desk, cash en main », dit le trésorier). C'est la fin de la piste on-chain : il n'y a ni compte d'exchange régulé ni gel possible. ${procedureFor(satsdesk)} L'exposition doit être documentée et le courtier visé par une demande d'entraide, en espérant des données de contrepartie (identité déclarée, lieu de remise).`,
        },
        {
          id: 'o4', type: 'tx', points: 10,
          prompt: 'L\'adresse finale de la chaîne émet plusieurs transactions. Laquelle transporte le reliquat jusqu\'au point de sortie ?',
          answer: [otcTx.id],
          hint: 'Comparez les transactions émises par l\'adresse finale : montants, nombre de sorties, rendu renvoyé sur l\'adresse elle-même, destination attribuée ou non.',
          explanation: `L'adresse finale ${A(w, finalAddr).slice(0, 14)}… reçoit ${amt(r8(finalIn), 'BTC')}. Elle envoie d'abord ${branches.length} petites transactions qui se renvoient la monnaie sur elle-même : ${branchTxt}. Ce sont des branches sans issue. Puis ${otcTx.hash.slice(0, 12)}… dépense tout le solde restant, sans rendu, vers une adresse de règlement de SatsDesk OTC : c'est la continuation, et la fin de la chaîne.`,
        },
        {
          id: 'o13', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) est remis à SatsDesk OTC ?',
          answer: otcValue,
          hint: 'C\'est l\'unique sortie de la transaction qui vide l\'adresse finale.',
          explanation: `${amt(otcValue, 'BTC')}, réglés le ${fmtDate(otcTx.time)} sur ${A(w, otcDep).slice(0, 14)}…, ensuite reversée sur le portefeuille de règlement du courtier. C'est le plus gros versement de la chaîne à un tiers : la demande d'entraide doit citer ce hash, ce montant et cette date.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Quelle stratégie de réquisition retenir ?',
          hint: 'Que voit chaque plateforme de vos flux ? Et que désigne l\'adresse de son hot wallet ?',
          ...choice(r,
            'Une réquisition par plateforme régulée listant chaque dépôt (date, hash, montant), et une demande d\'entraide visant le courtier OTC',
            [
              'Une seule réquisition, adressée à la plateforme principale, citant l\'adresse de son hot wallet',
              'Une réquisition prioritaire à OrbitCasino, service sans KYC et donc le plus risqué de la liste',
              'Aucune réquisition tant que les pelures leurres n\'ont pas bougé, afin d\'agir sur l\'ensemble en une fois',
            ]),
          explanation: `Chaque plateforme ne voit que ses propres dépôts : on lui transmet la liste exhaustive des adresses de dépôt (une par tranche) avec horodatages, hash et montants. Le hot wallet mélange tous les clients et ne désigne personne. Le casino sans KYC répondra peu ; les exchanges régulés sont prioritaires, le courtier OTC relève de l'entraide internationale. Les pelures leurres, elles, se surveillent. ${procedureFor(kits[main].entity)}`,
        },
      ],
      truth: {
        path: [consTx.id, ...steps.map((s) => s.tx.id), ...sweeps, otcTx.id],
        addresses: [reserve, ...steps.map((s) => s.next), ...mainDeps.map((d) => d.address), otcDep],
        debrief:
          `1. ${nCollect} adresses de collecte reçoivent ${nBuyers} paiements de clients, puis sont regroupées en une transaction à ${consTx.inputs.length} entrées vers la réserve ${A(w, reserve)} (${amt(reserveIn, 'BTC')}). ${lateCollect.length} paiements arrivent encore après ce regroupement sur les anciennes adresses.\n` +
          `2. À partir du ${fmtDate(steps[0].tx.time, false)}, la réserve est « pelée » en ${hops} sauts : à chaque fois une petite sortie (3 à 8,5 % du solde) et le reste vers une adresse neuve du même type.\n` +
          `3. Destination des tranches :\n${recap}\n` +
          `4. Les plateformes balaient ensuite chaque adresse de dépôt vers leur hot wallet : on s'arrête au dépôt.\n` +
          `5. L'adresse finale ${A(w, finalAddr)} lâche ${branches.length} branches sans issue, puis règle ${amt(otcValue, 'BTC')} à SatsDesk OTC : le reliquat est sorti en espèces.\n` +
          `6. En audition, le trésorier déclare une seule adresse de réception et « pas plus de ${amt(claimed, 'BTC')} » sortis : la blockchain montre ${nCollect} adresses de collecte et ${amt(peeledTotal, 'BTC')} pelés, dont ${amt(orbitTotal, 'BTC')} vers le casino en ${orbitN} fois.\n\n` +
          `Fausses pistes : les pelures leurres vers des adresses du réseau du même type que la chaîne (${selfTxt}) ; les pelures vers des particuliers ; les branches de l'éclatement final ; les versements tardifs et la poussière reçus par la réserve.\n\n` +
          `Leçon : dans une peel chain, la continuation est la grosse sortie, celle qui est dépensée au saut suivant ; le type d'adresse seul ne suffit pas quand le suspect met de côté sur ses propres adresses. L'intérêt pour l'enquête est le nombre de points de contact avec des services régulés : ici ${mainDeps.length} dépôts chez ${mainName}, chacun rattaché au même compte KYC. La fin chez un courtier OTC, elle, ferme la piste on-chain : seule l'entraide internationale peut la rouvrir.`,
      },
      hints: [
        'L\'adresse de départ figure dans le PV d\'exploitation du téléphone : ajoutez-la au graphe.',
        'À chaque saut, la continuation est la grosse sortie, celle qui est dépensée au saut suivant.',
        'Ne suivez pas les balayages vers les hot wallets : le dépôt est le point d\'arrêt.',
        'Tenez une liste : destination → nombre de tranches → montant.',
        'Avant la chaîne, remontez la première entrée de la réserve : ses entrées révèlent les adresses de collecte.',
        'En fin de chaîne, une seule transaction vide l\'adresse finale sans rendu.',
      ],
    }
  },
}
