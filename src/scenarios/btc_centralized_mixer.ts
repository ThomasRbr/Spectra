import { World, type Tx } from '../engine/world'
import { exchange, mixer, roundCoin, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

const DISTRIBUTIONS: number[][] = [
  [50, 30, 20],
  [40, 35, 25],
  [45, 30, 25],
  [60, 25, 15],
  [35, 25, 20, 20],
  [40, 30, 20, 10],
]

export const btcCentralizedMixer: ScenarioTemplate = {
  id: 'centralized-mixer',
  title: 'À travers le mixeur',
  tagline: 'Nebula Mixer brouille les pistes… sauf si le client regroupe ses sorties.',
  description:
    'Des bitcoins volés par hameçonnage sont envoyés dans un mixeur centralisé. Le lien on-chain est rompu, mais les paramètres de la commande, la corrélation montant/temps et une erreur du suspect après le mixage permettent de renouer le fil jusqu\'à l\'exchange.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['mixer', 'cioh', 'exchange_id', 'requisition'],
  estMinutes: 30,
  lessons: ['mixeurs', 'clustering', 'change-heuristics', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakeName(r)
    const city = fakeCity(r)

    const neb = mixer(w, 'nebula', 'btc')
    const outKey = r.pick(['binova', 'nordex', 'kaizen', 'helvetix'] as const)
    const out = exchange(w, outKey, 'btc')
    const cv = exchange(w, 'coinvault', 'btc')
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const thief = w.customEntity({ name: 'Auteur du hameçonnage (inconnu)', category: 'suspect' })

    // ── Le vol ───────────────────────────────────────────────────────────────
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const nBuys = r.int(3, 6)
    for (let i = 0; i < nBuys; i++) cv.withdraw(victim, roundCoin(w, 0.15, 0.8, 0.001), w.at(-r.int(30, 500) * 24))
    const stolen = w.unspentValue(victim)
    const t0addr = w.addr('btc', { entity: thief })
    const theftFee = w.estimateFee('btc', w.utxosOf(victim).length, 1)
    const theft = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: t0addr, value: r8(stolen - theftFee) }], fee: theftFee, change: null, spendAll: true })

    // ── Dépôt dans le mixeur ─────────────────────────────────────────────────
    const deposit = w.addr('btc', { entity: neb.entity, label: `${neb.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const V = r8(Math.floor(w.unspentValue(t0addr) * r.float(0.93, 0.98) * 1000) / 1000)
    const keep = w.addr('btc', { entity: thief, kind: w.get(t0addr).kind })
    const depTx = w.utxoTx({ time: theft.time + r.float(1, 5) * HOUR, from: [t0addr], to: [{ address: deposit, value: V }], change: keep })
    const toPoolT = depTx.time + r.int(600, 3 * 3600)

    // ── Sorties du mixeur (répartition choisie par le client) ────────────────
    const dist = r.pick(DISTRIBUTIONS)
    const feePct = r.float(0.012, 0.03)
    const net = V * (1 - feePct)
    const payoutAddrs = dist.map(() => w.addr('btc', { entity: thief, kind: 'p2wpkh' }))
    const plannedValues = dist.map((pct) => roundAsset('BTC', (net * pct) / 100))

    // Toute l'activité des réserves du mixeur est exécutée dans l'ordre
    // chronologique (balayages de dépôts, sorties du suspect, autres clients).
    type Ev = { t: number; run: () => void }
    const events: Ev[] = []
    let toPool!: Tx
    events.push({ t: toPoolT, run: () => { toPool = forwardAll(w, deposit, r.pick(neb.pool), toPoolT, undefined, ['sweep']) } })
    const payouts: Tx[] = []
    dist.forEach((_, i) => {
      const t = toPoolT + r.float(1.5, 26) * HOUR
      events.push({ t, run: () => { payouts[i] = w.utxoTx({ time: Math.round(t), from: [r.pick(neb.pool)], to: [{ address: payoutAddrs[i], value: plannedValues[i] }], tags: ['mixer-payout'] }) } })
    })
    for (let i = 0; i < r.int(16, 26); i++) {
      const close = r.chance(0.45)
      const v = close ? r.pick(plannedValues) * r.float(0.8, 1.2) : r.float(0.01, V * 0.8)
      const t = depTx.time + r.float(-6, 40) * HOUR
      events.push({ t, run: () => { w.utxoTx({ time: Math.round(t), from: [r.pick(neb.pool)], to: [{ address: w.addr('btc'), value: roundAsset('BTC', v) }], tags: ['mixer-payout'] }) } })
    }
    for (let i = 0; i < r.int(6, 10); i++) {
      const t = Math.round(depTx.time + r.float(-30, 30) * HOUR)
      const t2 = t + r.int(600, 3 * 3600)
      const d = w.addr('btc', { entity: neb.entity, label: `${neb.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      events.push({
        t,
        run: () => {
          const u = w.addr('btc')
          w.fund(u, roundCoin(w, 0.05, 2, 0.001), t - r.int(2, 48) * HOUR)
          w.utxoTx({ time: t, from: [u], to: [{ address: d, value: r8(w.unspentValue(u) * r.float(0.5, 0.95)) }] })
        },
      })
      events.push({ t: t2, run: () => { forwardAll(w, d, r.pick(neb.pool), t2, undefined, ['sweep']) } })
    }
    events.sort((a, b) => a.t - b.t)
    for (const ev of events) ev.run()
    const payoutValues = payouts.map((tx, i) => tx.outputs.find((o) => o.address === payoutAddrs[i])!.value)
    const paidOut = payoutValues.reduce((s, v) => s + v, 0)
    const realFeePct = (1 - paidOut / V) * 100

    // ── L'erreur : regroupement des sorties mixées ───────────────────────────
    const lastPayout = Math.max(...payouts.map((p) => p.time))
    const consol = w.addr('btc', { entity: thief, kind: 'p2wpkh' })
    const consFee = w.estimateFee('btc', payoutAddrs.length, 1)
    const consTx = w.utxoTx({ time: lastPayout + r.float(5, 30) * HOUR, from: r.shuffle([...payoutAddrs]), to: [{ address: consol, value: r8(paidOut - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Encaissement ─────────────────────────────────────────────────────────
    const exDeposit = out.newDeposit()
    const cashTx = forwardAll(w, consol, exDeposit, consTx.time + r.float(3, 36) * HOUR)
    const sweep = out.sweep([exDeposit], cashTx.time + r.float(1, 6) * HOUR)[0]

    // Le reliquat conservé avant mixage part vers un casino (fausse piste)
    const orbit = w.entity('orbit')
    const orbitDep = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] })
    const keepTx = forwardAll(w, keep, orbitDep, depTx.time + r.float(20, 72) * HOUR)

    // ── Bruit ────────────────────────────────────────────────────────────────
    out.noise(14, w.at(-2 * 24), w.at(8 * 24))
    cv.noise(8, w.at(-10 * 24), w.at(5 * 24))

    const exName = out.entity.name
    const distTxt = dist.map((p) => `${p} %`).join(' / ')
    const cashValue = cashTx.outputs[0].value

    return {
      world: w,
      title: `Opération Nébuleuse — ${city}`,
      briefing:
        `${victimName} (${city}) a reçu un courriel imitant le fabricant de son portefeuille matériel, l'invitant à « resynchroniser » son appareil. La victime a saisi sa phrase de récupération sur le faux site : quelques heures plus tard, ${amt(r8(stolen - theftFee), 'BTC')} étaient vidés de son portefeuille.\n\n` +
        `Le voleur a envoyé l'essentiel des fonds dans Nebula Mixer, un mixeur centralisé : les bitcoins sont mélangés à ceux d'autres clients et restitués plus tard, sur des adresses neuves, moins une commission. Le lien on-chain direct est rompu.\n\n` +
        `Bonne nouvelle : Nebula vient d'être démantelé et un extrait de sa base de données a été transmis. Il contient les paramètres de la commande… mais pas les adresses de sortie. À vous de les retrouver.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte de la victime (extrait)', date: w.at(2 * 24), author: victimName,
          body:
            `« Mon adresse de réception habituelle : ${A(w, victim)}\n` +
            `La transaction qui a vidé mon portefeuille : ${theft.hash}\n` +
            `Je n'ai jamais autorisé ce transfert. »`,
        },
        {
          id: 'europol', type: 'rapport', title: 'Extrait de la base Nebula Mixer (saisie)', date: w.at(20 * 24), author: 'Coopération internationale — Europol EC3',
          body:
            `Commande n° NB-${r.int(100000, 999999)}\n` +
            `Adresse de dépôt attribuée : ${A(w, deposit)}\n` +
            `Montant reçu : ${amt(V, 'BTC')} — le ${fmtDate(depTx.time)}\n` +
            `Nombre d'adresses de sortie : ${dist.length}\n` +
            `Répartition demandée : ${distTxt}\n` +
            `Délai maximal demandé : 30 h\n` +
            `Commission : aléatoire (1 à 3 %) — valeur exacte non conservée\n` +
            `Adresses de sortie : [champ chiffré, non exploitable]`,
        },
        {
          id: 'methode', type: 'note', title: 'Fiche méthode — corrélation', date: w.at(21 * 24), author: 'Cellule d\'appui',
          body:
            `Outil de corrélation : partir de l'heure du dépôt, fixer une fenêtre (ex. 36 h), un montant en USD et une tolérance, et filtrer sur l'entité émettrice (Nebula Mixer).\n\n` +
            `Montant attendu d'une sortie ≈ montant déposé × (1 − commission) × part demandée.\n\n` +
            `Une corrélation seule n'est qu'une hypothèse : il faut la confirmer par un comportement on-chain (dépense commune, destination commune…).`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Après le mixage, le suspect a regroupé ses fonds. Quelle est l\'adresse de regroupement ?',
          answer: [consol],
          hint: 'Recherchez, après le dépôt, une transaction dont la sortie vaut environ le montant déposé moins 1 à 3 %.',
          explanation: `${A(w, consol)} reçoit ${amt(r8(paidOut - consFee), 'BTC')} en une transaction à ${dist.length} entrées, chacune issue d'un paiement de Nebula Mixer.`,
        },
        {
          id: 'o2', type: 'addresses', points: 25,
          prompt: 'Sélectionnez les adresses de sortie du mixeur appartenant au suspect.',
          answer: [...payoutAddrs],
          hint: 'Corrélez chaque part (montant × répartition) avec les paiements émis par Nebula, puis vérifiez lesquels sont dépensés ensemble.',
          explanation: `Les ${dist.length} sorties (${payoutValues.map((v) => amt(v, 'BTC')).join(', ')}) respectent la répartition ${distTxt}. Elles sont toutes dépensées dans la même transaction : l'heuristique des entrées communes les rattache à un seul portefeuille.`,
        },
        {
          id: 'o3', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme les fonds mixés ont-ils été déposés ?',
          answer: [outKey],
          explanation: `L'adresse de regroupement envoie ${amt(cashValue, 'BTC')} vers une adresse de dépôt ${exName}. ${procedureFor(out.entity)}`,
        },
        {
          id: 'o4', type: 'number', points: 15, tolerance: 0.5, unit: '%',
          prompt: 'Quelle commission (en % du montant déposé) Nebula Mixer a-t-il prélevée sur cette commande ?',
          answer: Math.round(realFeePct * 100) / 100,
          hint: 'Commission = 1 − (somme des sorties ÷ montant déposé).',
          explanation: `Somme des sorties : ${amt(r8(paidOut), 'BTC')} pour ${amt(V, 'BTC')} déposés, soit une commission de ${realFeePct.toFixed(2).replace('.', ',')} %.`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Pourquoi le regroupement des sorties est-il l\'erreur décisive du suspect ?',
          ...choice(r,
            'Il relie toutes les sorties mixées (entrées communes) et reconstitue le montant de la commande',
            [
              'Il a payé des frais de réseau trop faibles, ce qui signale un utilisateur novice',
              'Le mixeur conserve dans ses journaux l\'adresse vers laquelle le client regroupe ses fonds',
              'Les adresses SegWit sont traçables, contrairement aux adresses Legacy plus anciennes',
            ]),
          explanation: 'Un mixeur ne protège que si les sorties restent séparées. En les dépensant ensemble, le suspect signe une preuve on-chain qu\'elles lui appartiennent toutes, et le montant regroupé (dépôt − commission) correspond à la commande. Corrélation montant/temps + entrées communes = rattachement solide.',
        },
      ],
      truth: {
        path: [theft.id, depTx.id, toPool.id, ...payouts.map((p) => p.id), consTx.id, cashTx.id, sweep.id],
        addresses: [t0addr, deposit, ...payoutAddrs, consol, exDeposit, keep],
        debrief:
          `1. Le ${fmtDate(theft.time)}, le voleur vide le portefeuille de la victime vers ${A(w, t0addr)}.\n` +
          `2. Il dépose ${amt(V, 'BTC')} sur l'adresse de dépôt Nebula ${A(w, deposit)} et garde un reliquat, plus tard joué sur OrbitCasino (fausse piste).\n` +
          `3. Nebula balaie le dépôt vers sa réserve, puis paie ${dist.length} sorties depuis ses réserves, au milieu de dizaines de paiements à d'autres clients : ${payoutValues.map((v) => amt(v, 'BTC')).join(', ')} (répartition ${distTxt}, commission ${realFeePct.toFixed(2).replace('.', ',')} %).\n` +
          `4. Erreur : le suspect regroupe ces ${dist.length} sorties en une seule transaction vers ${A(w, consol)}.\n` +
          `5. Il envoie ensuite ${amt(cashValue, 'BTC')} sur un dépôt ${exName}.\n\n` +
          `Méthode : (a) corrélation montant/temps sur les paiements émis par le mixeur, à partir des paramètres de commande ; (b) confirmation par dépense commune ; (c) réquisition à ${exName} sur l'adresse de dépôt, en joignant l'analyse. Sans le regroupement, la corrélation seule n'aurait fourni que des hypothèses.`,
      },
      hints: [
        'Suivez le vol jusqu\'à l\'adresse de dépôt Nebula : le traçage direct s\'arrête là.',
        'Utilisez l\'outil de corrélation avec Nebula Mixer comme émetteur, à partir de l\'heure du dépôt, pour chaque part de la répartition.',
        'Autre piste : cherchez sans filtre d\'entité un montant proche du dépôt moins la commission.',
        'Parmi les candidats, retenez ceux dont les sorties sont dépensées ensemble.',
      ],
    }
  },
}

