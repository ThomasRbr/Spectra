import { World, type Tx } from '../engine/world'
import { exchange, person, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

export const btcSextortionCluster: ScenarioTemplate = {
  id: 'sextortion-cluster',
  title: 'Campagne de sextorsion',
  tagline: 'Des centaines de mails, quelques adresses, un seul portefeuille : le clustering à l\'œuvre.',
  description:
    'Une vague de courriels de « sextorsion » exige des paiements en bitcoins. Chaque mail contient une adresse différente, mais l\'escroc finit par regrouper ses gains. Utilisez l\'heuristique des entrées communes (CIOH) pour reconstituer toutes les adresses de la campagne, chiffrer le préjudice et trouver la sortie.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['cioh', 'utxo', 'typologies', 'exchange_id'],
  estMinutes: 20,
  lessons: ['utxo', 'clustering', 'typologies', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakeName(r)
    const city = fakeCity(r)

    const cv = exchange(w, 'coinvault', 'btc')
    const nordex = exchange(w, 'nordex', 'btc')
    const outKey = r.pick(['huobex', 'kaizen', 'binova'] as const)
    const out = exchange(w, outKey, 'btc')

    const scammer = w.customEntity({ name: 'Campagne de sextorsion « Webcam »', category: 'scam' })
    const otherScam = w.customEntity({ name: 'Autre campagne (copie du modèle)', category: 'scam' })
    const kind: AddrKind = r.pick(['p2pkh', 'p2wpkh'] as const)
    const n = r.int(4, 7)
    const camp = w.addrs('btc', n, { entity: scammer, kind })
    const decoy = w.addr('btc', { entity: otherScam, kind })

    // ── Paiements des victimes ───────────────────────────────────────────────
    const payments: { tx: Tx; addr: string; value: number }[] = []
    const demand = () => roundAsset('BTC', fromUsd('BTC', r.pick([800, 950, 1000, 1200, 1250, 1500, 1800, 2000]) * r.float(0.985, 1.015)))
    const pay = (target: string, t: number, via: 'cv' | 'nordex' | string): Tx => {
      const v = demand()
      if (via === 'cv') return cv.withdraw(target, v, t)
      if (via === 'nordex') return nordex.withdraw(target, v, t)
      return w.utxoTx({ time: t, from: [via], to: [{ address: target, value: v }] })
    }
    const k = r.int(0, n - 1) // adresse reçue par la victime
    // Plan des paiements, exécuté ensuite dans l'ordre chronologique
    type Plan = { t: number; target: string; via: 'cv' | 'nordex' | 'person' | 'shared'; plaint?: boolean }
    const plan: Plan[] = []
    for (let i = 0; i < n; i++) {
      const np = r.int(3, 7)
      for (let p = 0; p < np; p++) {
        if (i === k && p === 0) {
          plan.push({ t: w.at(-r.float(1, 2) * 24), target: camp[i], via: 'cv', plaint: true })
          continue
        }
        const roll = r.next()
        plan.push({ t: w.at(-r.float(2, 20) * 24), target: camp[i], via: roll < 0.45 ? 'cv' : roll < 0.65 ? 'nordex' : 'person' })
      }
    }
    // Une même victime paie la campagne et la campagne leurre
    plan.push({ t: w.at(-r.float(3, 15) * 24), target: camp[(k + 1) % n], via: 'shared' })
    plan.push({ t: w.at(-r.float(1, 12) * 24), target: decoy, via: 'shared' })
    for (let p = 0; p < r.int(2, 4); p++) plan.push({ t: w.at(-r.float(2, 18) * 24), target: decoy, via: r.chance(0.5) ? 'cv' : 'person' })
    plan.sort((a, b) => a.t - b.t)
    const sharedVictim = person(w, 'btc', { history: 2, time: plan[0].t })
    let plaintTx: Tx | undefined
    for (const pl of plan) {
      const via = pl.via === 'person' ? person(w, 'btc', { history: r.int(1, 3), time: pl.t }) : pl.via === 'shared' ? sharedVictim : pl.via
      const tx = pay(pl.target, pl.t, via)
      if (pl.plaint) plaintTx = tx
      if (pl.target !== decoy) payments.push({ tx, addr: pl.target, value: receivedFrom(tx, pl.target) })
    }

    // ── Campagne leurre : même modèle de mail, autre portefeuille ────────────
    const decoyOut = w.addr('btc', { entity: otherScam })
    const decoyTotal = w.unspentValue(decoy)
    w.utxoTx({ time: w.at(r.float(30, 70)), from: [decoy], to: [{ address: decoyOut, value: r8(decoyTotal - 0.00003) }], fee: 0.00003, change: null, spendAll: true })

    // ── Regroupements (entrées communes) ─────────────────────────────────────
    const consol = w.addr('btc', { entity: scammer, kind: 'p2wpkh' })
    const bridgeIdx = r.int(1, n - 2)
    const g1 = camp.slice(0, bridgeIdx)
    const g2 = camp.slice(bridgeIdx + 1)
    const bridgeAddr = camp[bridgeIdx]
    const largest = Math.max(...w.utxosOf(bridgeAddr).map((u) => u.value))
    const in1 = g1.reduce((s, a) => s + w.unspentValue(a), 0) + largest
    const nIn1 = g1.reduce((s, a) => s + w.utxosOf(a).length, 0) + 1
    const fee1 = w.estimateFee('btc', nIn1, 1)
    const c1 = w.rawUtxoTx({
      time: w.at(r.float(20, 40)),
      spend: [...r.shuffle([...g1.map((a) => ({ address: a })), { address: bridgeAddr, value: largest }])],
      outputs: [{ address: consol, value: r8(in1 - fee1) }],
      method: 'consolidation',
    })
    const in2 = g2.reduce((s, a) => s + w.unspentValue(a), 0) + w.unspentValue(bridgeAddr)
    const nIn2 = g2.reduce((s, a) => s + w.utxosOf(a).length, 0) + w.utxosOf(bridgeAddr).length
    const fee2 = w.estimateFee('btc', nIn2, 1)
    const c2 = w.rawUtxoTx({
      time: c1.time + r.float(30, 90) * HOUR,
      spend: r.shuffle([...g2.map((a) => ({ address: a })), { address: bridgeAddr }]),
      outputs: [{ address: consol, value: r8(in2 - fee2) }],
      method: 'consolidation',
    })

    // ── Sortie vers l'exchange ───────────────────────────────────────────────
    const deposit = out.newDeposit()
    const kBal = w.unspentValue(consol)
    const depValue = r8(Math.floor(kBal * r.float(0.82, 0.93) * 1000) / 1000)
    const rest = w.addr('btc', { entity: scammer, kind: 'p2wpkh' })
    const cashTx = w.utxoTx({ time: c2.time + r.float(6, 40) * HOUR, from: [consol], to: [{ address: deposit, value: depValue }], change: rest, spendAll: true })
    const sweep = out.sweep([deposit], cashTx.time + r.float(1, 8) * HOUR)[0]

    // ── Bruit ────────────────────────────────────────────────────────────────
    cv.noise(14, w.at(-22 * 24), w.at(6 * 24))
    nordex.noise(8, w.at(-22 * 24), w.at(6 * 24))
    out.noise(12, w.at(-3 * 24), w.at(10 * 24))

    const total = r8(payments.reduce((s, p) => s + p.value, 0))
    const nPay = payments.length
    const plaint = plaintTx!
    const plaintValue = receivedFrom(plaint, camp[k])
    const other = camp[(k + 1 + r.int(0, n - 2)) % n]
    const exName = out.entity.name
    const demandUsd = Math.round(usd('BTC', plaintValue) / 50) * 50

    return {
      world: w,
      title: `Sextorsion de masse — ${city}`,
      briefing:
        `${victimName} (${city}) a reçu un courriel affirmant que sa webcam avait été piratée et menaçant de diffuser une vidéo intime à ses contacts. Sous le coup de la panique, la victime a payé la somme exigée en bitcoins depuis son compte Coinvault.\n\n` +
        `PHAROS signale une campagne massive : des milliers de destinataires, le même texte, mais des adresses Bitcoin qui varient d'un envoi à l'autre. Ces adresses semblent n'avoir aucun lien entre elles… jusqu'à ce que l'escroc les dépense.\n\n` +
        `Objectifs : reconstituer l'ensemble des adresses de la campagne par clustering, chiffrer le montant total versé par les victimes, et identifier la plateforme de sortie.`,
      evidence: [
        {
          id: 'email', type: 'email', title: 'Courriel reçu par la victime', date: plaint.time - r.int(6, 30) * HOUR, author: 'expéditeur usurpé (son propre nom de compte)',
          body:
            `Objet : Votre compte a été compromis\n\n` +
            `Bonjour,\nJe vous écris depuis votre propre adresse : j'ai accès à votre appareil depuis plusieurs mois. J'ai enregistré une vidéo de vous via votre webcam pendant que vous consultiez certains sites.\n\n` +
            `Si vous voulez que cette vidéo ne soit pas envoyée à tous vos contacts, envoyez l'équivalent de ${demandUsd.toLocaleString('fr-FR')} $ en Bitcoin à l'adresse suivante :\n\n${A(w, camp[k])}\n\n` +
            `Vous avez 48 heures. Je saurai quand vous aurez ouvert ce message. Ne répondez pas, ne contactez pas la police.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Déclaration de la victime', date: plaint.time + 2 * DAY, author: victimName,
          body:
            `« J'ai acheté des bitcoins sur Coinvault et je les ai envoyés directement à l'adresse du mail, le ${fmtDate(plaint.time)}.\n` +
            `Montant indiqué par Coinvault : ${amt(plaintValue, 'BTC')}.\n` +
            `Référence de transaction : ${plaint.hash} »`,
        },
        {
          id: 'pharos', type: 'note', title: 'Signalements PHAROS (extrait)', date: w.at(3 * 24), author: 'Plateforme PHAROS',
          body:
            `Modèle de courriel identique signalé à de nombreuses reprises ces trois dernières semaines. Adresses BTC relevées dans les signalements :\n` +
            `• ${A(w, camp[k])}\n• ${A(w, other)}\n• ${A(w, decoy)}\n\n` +
            `Attention : ce modèle circule sur des forums et est réutilisé par plusieurs groupes. Rattachement à un même auteur non établi.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 30,
          prompt: 'Sélectionnez toutes les adresses de réception de la campagne (adresses ayant reçu des paiements de victimes et appartenant au même portefeuille).',
          answer: [...camp],
          hint: 'Suivez la dépense de l\'adresse du mail : la transaction de regroupement a plusieurs entrées. Ouvrez ensuite le panneau cluster.',
          explanation: `${n} adresses de réception sont reliées par deux transactions de regroupement. L'adresse ${A(w, bridgeAddr).slice(0, 14)}… figure dans les deux : c'est elle qui « soude » le cluster. Par l'heuristique des entrées communes, toutes ces adresses sont contrôlées par la même personne.`,
        },
        {
          id: 'o2', type: 'amount', points: 25, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant total (en BTC) les victimes ont-elles versé sur ces adresses ?',
          answer: total,
          hint: 'Additionnez les montants reçus par chaque adresse du cluster (avant regroupement).',
          explanation: `${nPay} paiements pour un total de ${amt(total, 'BTC')}. Chaque paiement correspond potentiellement à une victime à identifier, notamment par réquisition aux plateformes d'où proviennent les fonds (Coinvault, Nordex…).`,
        },
        {
          id: 'o3', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il encaissé les fonds ?',
          answer: [outKey],
          explanation: `Depuis l'adresse de regroupement, ${amt(depValue, 'BTC')} partent vers une adresse de dépôt ${exName}, ensuite balayée vers son hot wallet. ${procedureFor(out.entity)}`,
        },
        {
          id: 'o4', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de regroupement de la campagne ?',
          answer: [consol],
          explanation: `${A(w, consol)} reçoit les deux transactions de regroupement, puis alimente le dépôt chez ${exName}.`,
        },
        {
          id: 'o5', type: 'choice', points: 15,
          prompt: 'PHAROS signale une troisième adresse avec le même modèle de courriel. Que conclure ?',
          ...choice(r,
            'Rattachement non établi : aucune dépense commune avec le cluster, fonds partis ailleurs',
            [
              'Elle appartient à la campagne : le texte du courriel est strictement identique',
              'Elle appartient à la campagne : une même victime a payé cette adresse et le cluster',
              'Elle appartient à la campagne : elle utilise le même type d\'adresse que le cluster',
            ]),
          explanation: `${A(w, decoy).slice(0, 14)}… n'est jamais co-dépensée avec les adresses du cluster et ses fonds partent vers une destination distincte. Le modèle de mail est public et réutilisé ; qu'une victime ait payé deux escrocs différents ne prouve rien sur leur lien ; le type d'adresse est un indice trop faible. Seul un lien on-chain (entrées communes, flux commun) ou une donnée de réquisition permettrait le rattachement.`,
        },
      ],
      truth: {
        path: [...payments.map((p) => p.tx.id), c1.id, c2.id, cashTx.id, sweep.id],
        addresses: [...camp, consol, deposit, rest],
        debrief:
          `1. La campagne utilise ${n} adresses de réception (${kind === 'p2pkh' ? 'Legacy' : 'SegWit'}), réparties entre les envois. Les victimes y versent ${nPay} paiements, souvent directement depuis Coinvault ou Nordex.\n` +
          `2. Regroupement n°1 (${fmtDate(c1.time, false)}) : ${g1.length + 1} adresses en entrée, dont une seule UTXO de ${A(w, bridgeAddr).slice(0, 14)}….\n` +
          `3. Regroupement n°2 : le reste de cette même adresse avec ${g2.length} autres. Elle relie les deux groupes : le cluster contient les ${n} adresses.\n` +
          `4. Les deux regroupements alimentent ${A(w, consol)}, qui envoie ${amt(depValue, 'BTC')} vers ${exName} et garde le reste en rendu.\n` +
          `5. L'adresse leurre signalée par PHAROS appartient à une autre campagne qui réutilise le même texte : elle n'est jamais co-dépensée avec le cluster.\n\n` +
          `Leçon : l'heuristique des entrées communes (CIOH) part du principe que toutes les entrées d'une transaction sont signées par le même portefeuille. C'est l'outil de base pour passer d'une adresse à un portefeuille entier, et donc d'une victime à toutes les victimes. Ses limites : CoinJoin et paiements collaboratifs (exclus ici). Réquisitions : ${exName} (titulaire du dépôt) et Coinvault/Nordex (identification des autres victimes).`,
      },
      hints: [
        'Ajoutez l\'adresse du courriel au graphe, puis dépliez ses sorties.',
        'Une transaction avec de nombreuses entrées provenant d\'adresses différentes signale un même propriétaire.',
        'Le panneau cluster de l\'adresse liste tous les membres reliés par entrées communes.',
        'Pour le montant total, ne comptez que les paiements reçus par les adresses du cluster, pas les regroupements.',
      ],
    }
  },
}

function receivedFrom(tx: Tx, addr: string): number {
  return tx.outputs.filter((o) => o.address === addr).reduce((s, o) => s + o.value, 0)
}
