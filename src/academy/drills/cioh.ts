// Exercices UTXO avancés : clustering par entrées communes (CIOH) et
// reconnaissance des CoinJoin face aux retraits groupés et consolidations.
import { Rng } from '../../engine/rng'
import { genAddress, genTxHash, type AddrKind } from '../../engine/addressgen'
import type { ChainId } from '../../engine/chains'
import type { DrillDef } from '../model'
import { dayTime, frList, frMax, LETTERS, mkChoice, rngFor } from './util'

// ── CIOH ─────────────────────────────────────────────────────────────────────

interface SimTx {
  inputs: { l: string; v: number }[]
  outputs: { l: string; v: number }[]
  coinjoin?: { denom: number; n: number; changes: number }
  role: 'link' | 'noise' | 'coinjoin'
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4

function unionFind(txs: SimTx[]) {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  for (const t of txs) {
    if (t.coinjoin) continue
    const first = t.inputs[0].l
    for (const i of t.inputs) {
      const a = find(first)
      const b = find(i.l)
      if (a !== b) parent.set(b, a)
    }
  }
  return find
}

/** Expose la vérité de l'exercice pour les vérifications automatiques. */
export function ciohCluster(txs: SimTx[], target: string): string[] {
  const find = unionFind(txs)
  const all = new Set<string>()
  for (const t of txs) for (const x of [...t.inputs, ...t.outputs]) all.add(x.l)
  return [...all].filter((l) => find(l) === find(target)).sort()
}

const setLabel = (s: Iterable<string>) => {
  const arr = [...new Set(s)].sort()
  return arr.length === 1 ? `${arr[0]} seule` : frList(arr)
}

export const ciohClusterDrill: DrillDef = {
  id: 'cioh-cluster',
  title: 'Clustering par entrées communes',
  description: 'Regrouper les adresses d\'un même portefeuille avec l\'heuristique des entrées communes, sans se laisser piéger par un CoinJoin.',
  level: 2,
  track: 'bitcoin',
  icon: 'Network',
  generate(seed) {
    const rng = rngFor(seed, 'cioh-cluster')
    const L = rng.shuffle(LETTERS.slice(0, 22))
    let li = 0
    const next = () => L[li++]
    const k = rng.pick([2, 3, 3, 4, 4])
    const W = Array.from({ length: k }, next)
    const txs: SimTx[] = []
    const linked = [W[0]]
    const pending = W.slice(1)
    let lastChange: string | undefined
    let lastChangeValue = 0
    const val = () => r4(rng.float(0.01, 0.6))
    while (pending.length) {
      const take = pending.splice(0, pending.length >= 2 && rng.chance(0.4) ? 2 : 1)
      // Parfois le rendu d'une transaction précédente est dépensé avec une adresse déjà reliée : il rejoint le cluster.
      const useChange = !!lastChange && rng.chance(0.45)
      const anchors = useChange ? [lastChange!, rng.pick(linked)] : [rng.pick(linked)]
      const ins = rng.shuffle([...anchors, ...take]).map((l) => ({ l, v: useChange && l === lastChange ? lastChangeValue : val() }))
      const total = ins.reduce((s, x) => s + x.v, 0)
      const pay = r4(Math.max(0.005, Math.round(total * rng.float(0.3, 0.7) * 100) / 100))
      const fee = r4(rng.float(0.0001, 0.0006))
      const P = next()
      const C = next()
      txs.push({ role: 'link', inputs: ins, outputs: rng.shuffle([{ l: P, v: pay }, { l: C, v: r4(total - pay - fee) }]) })
      if (useChange) linked.push(lastChange!)
      linked.push(...take)
      lastChange = C
      lastChangeValue = r4(total - pay - fee)
    }
    // Bruit : un autre portefeuille, qui paie parfois une adresse du cluster.
    const hasNoise = rng.chance(0.75)
    if (hasNoise) {
      const n1 = next()
      const n2 = next()
      const ins = [{ l: n1, v: val() }, { l: n2, v: val() }]
      const total = ins[0].v + ins[1].v
      const paid = rng.chance(0.6) ? rng.pick(W) : next()
      const pay = r4(total * rng.float(0.3, 0.7))
      const noiseTx: SimTx = { role: 'noise', inputs: ins, outputs: rng.shuffle([{ l: paid, v: pay }, { l: next(), v: r4(total - pay - 0.0003) }]) }
      txs.splice(rng.int(0, txs.length), 0, noiseTx)
    }
    // CoinJoin : un membre du cluster participe avec d'autres inconnus.
    const hasCj = rng.chance(0.55)
    let cjOthers: string[] = []
    if (hasCj) {
      const member = rng.pick(W)
      const nOthers = rng.int(4, 5)
      cjOthers = Array.from({ length: nOthers }, next)
      const denom = rng.pick([0.001, 0.01, 0.05, 0.1])
      const ins = rng.shuffle([member, ...cjOthers]).map((l) => ({ l, v: r4(denom * rng.float(1.02, 1.8)) }))
      txs.push({ role: 'coinjoin', inputs: ins, outputs: [], coinjoin: { denom, n: ins.length, changes: rng.int(2, ins.length - 1) } })
    }
    const target = rng.pick(W)
    const cluster = ciohCluster(txs, target)
    const correct = setLabel(cluster)

    // Distracteurs
    const linkTxs = txs.filter((t) => t.role === 'link')
    const payOuts = linkTxs.flatMap((t) => t.outputs.map((o) => o.l)).filter((l) => !cluster.includes(l))
    const direct = new Set<string>([target])
    for (const t of linkTxs) if (t.inputs.some((i) => i.l === target)) t.inputs.forEach((i) => direct.add(i.l))
    const noiseTx = txs.find((t) => t.role === 'noise')
    const d: string[] = []
    if (hasCj && txs.find((t) => t.coinjoin)!.inputs.some((i) => cluster.includes(i.l))) d.push(setLabel([...cluster, ...cjOthers]))
    if (payOuts.length) d.push(setLabel([...cluster, ...payOuts]))
    if (direct.size < cluster.length) d.push(setLabel(direct))
    if (noiseTx && noiseTx.outputs.some((o) => cluster.includes(o.l))) d.push(setLabel([...cluster, ...noiseTx.inputs.map((i) => i.l)]))
    if (payOuts.length) d.push(setLabel([...cluster, payOuts[0]]))
    if (cluster.length > 2) d.push(setLabel(cluster.filter((l) => l !== cluster.find((x) => x !== target))))
    d.push(setLabel([target]))
    if (noiseTx) d.push(setLabel([...cluster, ...noiseTx.inputs.map((i) => i.l)]))
    const { options, answer } = mkChoice(rng, correct, d, rng.pick([4, 4, 5]))

    const items = txs.map((t, i) => {
      if (t.coinjoin) {
        return `Tx ${i + 1} — entrées : ${t.inputs.map((x) => x.l).join(', ')} → ${t.coinjoin.n} sorties de ${frMax(t.coinjoin.denom)} BTC exactement vers des adresses neuves + ${t.coinjoin.changes} petites sorties de montants variés`
      }
      return `Tx ${i + 1} — entrées : ${t.inputs.map((x) => `${x.l} (${frMax(x.v, 4)} BTC)`).join(' + ')} → sorties : ${t.outputs.map((x) => `${x.l} (${frMax(x.v, 4)} BTC)`).join(', ')}`
    })

    // Explication
    const lines: string[] = []
    txs.forEach((t, i) => {
      if (t.role !== 'link') return
      lines.push(`Tx ${i + 1} dépense ensemble ${frList(t.inputs.map((x) => x.l))} : il a fallu signer avec les clés de chacune, elles sont présumées détenues par le même portefeuille.`)
      for (const x of t.inputs) {
        const j = txs.findIndex((u, k) => k < i && u.outputs.some((o) => o.l === x.l))
        if (j >= 0) lines.push(`(${x.l} est une sortie de Tx ${j + 1} : ce n'est pas cette sortie qui la rattache, mais le fait qu'elle soit dépensée comme entrée dans Tx ${i + 1}.)`)
      }
    })
    let explain = `L'heuristique des entrées communes (CIOH) : toutes les entrées d'une transaction ordinaire sont contrôlées par la même entité, puisqu'il faut la clé privée de chacune pour signer. Elle est transitive.\n\n${lines.join('\n')}\n\nPar transitivité, le portefeuille de ${target} regroupe : ${frList(cluster)}.`
    if (hasCj) explain += `\n\nLa transaction CoinJoin (sorties de montant identique, nombreuses entrées) est une transaction collaborative : ses entrées appartiennent à des participants différents. La CIOH ne s'y applique pas : ${frList(cjOthers)} ne doivent pas être rattachées au cluster.`
    if (noiseTx) explain += `\n\n${frList(noiseTx.inputs.map((x) => x.l))} sont dépensées ensemble dans une autre transaction : elles forment un autre portefeuille.${noiseTx.outputs.some((o) => cluster.includes(o.l)) ? ' Avoir payé une adresse du cluster ne les y rattache pas : envoyer des fonds à quelqu\'un ne prouve pas qu\'on est la même personne.' : ''}`
    explain += `\n\nLes sorties (paiements et rendus) ne sont pas couvertes par la CIOH : un destinataire n'est pas le payeur, et l'identification du rendu relève d'une autre heuristique, moins fiable. Une sortie n'entre dans le cluster que si elle est ensuite dépensée comme entrée avec une adresse du cluster.`

    return {
      prompt: `Selon la seule heuristique des entrées communes, quelles adresses appartiennent au même portefeuille que ${target} ?`,
      context: 'Transactions Bitcoin observées (les adresses sont désignées par des lettres).',
      visual: { type: 'list', title: 'Transactions observées', items },
      kind: 'choice',
      options,
      answer,
      explain,
    }
  },
}

// ── CoinJoin ou pas ? ─────────────────────────────────────────────────────────

type CjKind = 'whirlpool' | 'wabisabi' | 'batch' | 'consolidation' | 'payment' | 'equalpay'

const CJ = 'CoinJoin (transaction collaborative de plusieurs participants)'
const BATCH = 'Retrait groupé (batch) d\'un exchange'
const CONSO = 'Consolidation d\'UTXO d\'un même portefeuille'
const PAY = 'Paiement simple avec rendu'
const EQUALPAY = 'Paiements groupés de montants identiques par un seul payeur'

const ANSWER: Record<CjKind, string> = { whirlpool: CJ, wabisabi: CJ, batch: BATCH, consolidation: CONSO, payment: PAY, equalpay: EQUALPAY }

const sats = (v: number) => Math.round(v * 1e8)

export const coinjoinSpot: DrillDef = {
  id: 'coinjoin-spot',
  title: 'CoinJoin ou pas ?',
  description: 'Distinguer un CoinJoin d\'un retrait groupé d\'exchange, d\'une consolidation ou d\'un paiement ordinaire.',
  level: 3,
  track: 'confidentialite',
  icon: 'Shuffle',
  generate(seed) {
    const rng = rngFor(seed, 'coinjoin-spot')
    const kind = rng.weighted([['whirlpool', 2], ['wabisabi', 1.5], ['batch', 2.5], ['consolidation', 1.5], ['payment', 1], ['equalpay', 1.2]] as const) as CjKind
    const chain: ChainId = 'btc'
    const A = (k: AddrKind) => genAddress(rng, chain, k)
    let inputs: { address: string; value: number; label?: string }[] = []
    let outputs: { address: string; value: number; label?: string }[] = []
    let detail = ''
    switch (kind) {
      case 'whirlpool': {
        const denom = rng.pick([0.001, 0.01, 0.05, 0.5])
        const n = 5
        inputs = Array.from({ length: n }, () => ({ address: A('p2wpkh'), value: (sats(denom) + rng.int(1000, Math.round(sats(denom) * 0.004) + 2000)) / 1e8 }))
        outputs = Array.from({ length: n }, () => ({ address: A('p2wpkh'), value: denom }))
        detail = `${n} entrées distinctes légèrement supérieures à ${frMax(denom)} BTC, ${n} sorties de exactement ${frMax(denom)} BTC vers des adresses neuves, aucune autre sortie : c'est la signature d'un CoinJoin de type Whirlpool (5 entrées / 5 sorties).`
        break
      }
      case 'wabisabi': {
        const denom = rng.pick([0.0131072, 0.02, 0.05, 0.1])
        const nIn = rng.int(9, 14)
        const nEq = rng.int(5, Math.min(9, nIn - 2))
        inputs = Array.from({ length: nIn }, () => ({ address: A(rng.pick(['p2wpkh', 'p2wpkh', 'p2tr', 'p2sh'] as const)), value: rng.int(sats(denom) / 2, sats(denom) * 2.6) / 1e8 }))
        while (inputs.reduce((s, x) => s + sats(x.value), 0) < (nEq + 1) * sats(denom)) inputs.push({ address: A('p2wpkh'), value: rng.int(sats(denom), sats(denom) * 2.6) / 1e8 })
        const inTotal = inputs.reduce((s, x) => s + sats(x.value), 0)
        outputs = Array.from({ length: nEq }, () => ({ address: A('p2wpkh'), value: denom }))
        let rest = inTotal - nEq * sats(denom) - rng.int(5000, 20000)
        const nCh = rng.int(3, 5)
        for (let i = 0; i < nCh && rest > 0; i++) {
          const v = i === nCh - 1 ? rest : Math.floor(rest * rng.float(0.15, 0.4))
          if (v > 1000) outputs.push({ address: A('p2wpkh'), value: v / 1e8 })
          rest -= v
        }
        detail = `${inputs.length} entrées de montants et de types variés (plusieurs participants), ${nEq} sorties identiques de ${frMax(denom)} BTC et quelques sorties « rendu » : CoinJoin de type Wasabi/WabiSabi. On ne peut pas dire quelle entrée finance quelle sortie égale.`
        break
      }
      case 'batch': {
        const hot = A(rng.pick(['p2wpkh', 'p2sh'] as const))
        const label = rng.chance(0.5) ? 'Hot wallet (attribué : exchange)' : undefined
        const nIn = rng.int(1, 2)
        inputs = Array.from({ length: nIn }, () => ({ address: hot, value: rng.int(150_000_000, 900_000_000) / 1e8, label }))
        const inTotal = inputs.reduce((s, x) => s + sats(x.value), 0)
        const nOut = rng.int(6, 12)
        const used = new Set<number>()
        let spent = 0
        for (let i = 0; i < nOut; i++) {
          let v = rng.int(80_000, 12_000_000)
          while (used.has(v)) v++
          used.add(v)
          spent += v
          outputs.push({ address: A(rng.pick(['p2wpkh', 'p2pkh', 'p2sh', 'p2tr'] as const)), value: v / 1e8 })
        }
        outputs.push({ address: hot, value: (inTotal - spent - rng.int(8000, 30000)) / 1e8, label })
        rng.shuffle(outputs)
        detail = `${nIn === 1 ? 'Une seule entrée' : 'Deux entrées de la même adresse'}, ${nOut} sorties de montants tous différents vers des adresses de types variés, et un gros rendu qui revient à l'adresse d'origine : c'est un exchange qui regroupe les retraits de ses clients dans une seule transaction pour économiser des frais. Un seul payeur, aucune sortie égale : ce n'est PAS un CoinJoin, et la CIOH s'applique normalement.`
        break
      }
      case 'consolidation': {
        const k = rng.pick(['p2wpkh', 'p2pkh', 'p2sh'] as const)
        const nIn = rng.int(5, 12)
        const deposits = rng.chance(0.4)
        inputs = Array.from({ length: nIn }, () => ({ address: A(k), value: rng.int(50_000, 30_000_000) / 1e8, label: deposits ? 'Adresse de dépôt (exchange)' : undefined }))
        const inTotal = inputs.reduce((s, x) => s + sats(x.value), 0)
        outputs = [{ address: A(k), value: (inTotal - rng.int(3000, 25000)) / 1e8, label: deposits ? 'Hot wallet (exchange)' : undefined }]
        detail = `${nIn} entrées du même type regroupées vers une unique sortie : c'est une consolidation (${deposits ? 'ici le balayage des adresses de dépôt d\'un exchange vers son hot wallet' : 'un portefeuille qui rassemble ses petites UTXO'}). Un CoinJoin a forcément plusieurs sorties de même montant ; ici il n'y en a qu'une, et la CIOH relie toutes les entrées.`
        break
      }
      case 'payment': {
        const k = rng.pick(['p2wpkh', 'p2pkh', 'p2tr'] as const)
        const nIn = rng.int(1, 2)
        inputs = Array.from({ length: nIn }, () => ({ address: A(k), value: rng.int(500_000, 60_000_000) / 1e8 }))
        const inTotal = inputs.reduce((s, x) => s + sats(x.value), 0)
        const pay = Math.floor((inTotal * rng.float(0.2, 0.7)) / 100_000) * 100_000 || 100_000
        outputs = rng.shuffle([
          { address: A(rng.pick(['p2wpkh', 'p2sh'] as const)), value: pay / 1e8 },
          { address: A(k), value: (inTotal - pay - rng.int(2000, 15000)) / 1e8 },
        ])
        detail = `${nIn} entrée${nIn > 1 ? 's' : ''}, deux sorties de montants différents (un montant rond = le paiement, un reste = le rendu) : transaction ordinaire.`
        break
      }
      case 'equalpay': {
        const k = rng.pick(['p2wpkh', 'p2pkh'] as const)
        const payer = A(k)
        const n = rng.int(4, 6)
        const amount = rng.pick([0.002, 0.005, 0.01, 0.025])
        inputs = [{ address: payer, value: (sats(amount) * n + rng.int(200_000, 5_000_000)) / 1e8 }]
        if (rng.chance(0.4)) inputs.push({ address: payer, value: rng.int(100_000, 2_000_000) / 1e8 })
        const inTotal = inputs.reduce((s, x) => s + sats(x.value), 0)
        outputs = Array.from({ length: n }, () => ({ address: A(rng.pick(['p2wpkh', 'p2pkh', 'p2sh'] as const)), value: amount }))
        outputs.push({ address: A(k), value: (inTotal - sats(amount) * n - rng.int(3000, 15000)) / 1e8 })
        rng.shuffle(outputs)
        detail = `Plusieurs sorties de ${frMax(amount)} BTC, mais elles sont financées par une seule adresse (${inputs.length > 1 ? 'deux UTXO de la même adresse' : 'une seule entrée'}) : il n'y a qu'un participant. Des montants égaux ne suffisent pas à faire un CoinJoin — ici, un payeur règle plusieurs bénéficiaires du même montant (salaires, remboursements, paiements de mules…).`
        break
      }
    }
    const correct = ANSWER[kind]
    const pool = kind === 'equalpay' ? [CJ, CONSO, PAY] : kind === 'batch' ? [CJ, CONSO, PAY, EQUALPAY] : [CJ, BATCH, CONSO, PAY, EQUALPAY]
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(pool.filter((p) => p !== correct)), rng.pick([4, 4, 5]))
    const notes: string[] = []
    if (correct !== CJ && options.includes(CJ)) notes.push('CoinJoin : il faut à la fois de nombreuses entrées appartenant visiblement à des participants distincts ET plusieurs sorties de montant strictement identique.')
    if (correct !== BATCH && options.includes(BATCH)) notes.push('Retrait groupé : une ou deux entrées d\'un hot wallet, beaucoup de sorties de montants variés et un rendu vers le hot wallet.')
    if (correct !== CONSO && options.includes(CONSO)) notes.push('Consolidation : beaucoup d\'entrées, une seule sortie.')
    if (correct !== PAY && options.includes(PAY)) notes.push('Paiement simple : une ou deux entrées, deux sorties (paiement + rendu).')
    if (correct !== EQUALPAY && options.includes(EQUALPAY)) notes.push('Paiements groupés identiques : un seul payeur, plusieurs sorties égales.')
    return {
      prompt: 'Comment qualifier cette transaction ?',
      context: rng.pick([
        'Transaction relevée sur le chemin des fonds.',
        'Un collègue pense avoir trouvé un CoinJoin. Qu\'en est-il ?',
        'Votre outil n\'a pas d\'étiquette pour cette transaction.',
      ]),
      visual: { type: 'tx', chain, asset: 'BTC', hash: genTxHash(rng, chain), time: dayTime(rng), inputs, outputs },
      kind: 'choice',
      options,
      answer,
      explain: `${detail}\n\nRepères pour les autres réponses : ${notes.join(' ')}\n\nEnjeu : sur un CoinJoin, la CIOH et les heuristiques de rendu ne s'appliquent pas ; sur un retrait groupé, la sortie qui vous intéresse mène à un client identifiable de l'exchange (réquisition possible sur le hash de la transaction).`,
    }
  },
}
