// Affaires générées : un générateur compose, à partir d'une graine, une affaire
// inédite (typologie, chaîne de départ, enchaînement de techniques de
// blanchiment, sortie sur une plateforme) avec ses pièces, ses objectifs et son
// débrief. Trois niveaux de difficulté, jouables à l'infini.
import { World } from '../engine/world'
import { CHAINS, fromUsd, roundAsset, usd, type AssetId, type ChainId } from '../engine/chains'
import type { Entity } from '../engine/entities'
import { bridge, dex, exchange, mixer, peelChain, roundUsdAmount, swapper, type DexKit } from '../engine/patterns'
import { aggregator, approve, forwarderExchange, lending, transferFrom, weth } from '../engine/defi'
import type { Tx } from '../engine/world'
import type { Difficulty, Objective, ScenarioTemplate, SkillId } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

type Typology = 'escroquerie' | 'piratage' | 'rancon' | 'drainer'
type StepKind = 'hop' | 'peel' | 'consolidate' | 'swapper' | 'mixer' | 'dex' | 'aggregator' | 'bridge' | 'lending' | 'weth'

interface Funds {
  chain: ChainId
  addr: string
  asset: AssetId
}

interface Step {
  kind: StepKind
  txs: string[]
  /** Récit de l'étape pour le débrief. */
  story: string
  /** Objectifs propres à l'étape (le générateur en retient une partie). */
  objectives: Objective[]
  hint: string
}

const H = 3600
const isUtxo = (c: ChainId) => CHAINS[c].model === 'utxo'
const DEX_KEY: Partial<Record<ChainId, string>> = { eth: 'uniswap', bsc: 'pancakeswap', tron: 'sunswap' }
const STABLE: Partial<Record<ChainId, AssetId[]>> = { eth: ['USDC', 'USDT', 'DAI'], bsc: ['USDT', 'USDC'], tron: ['USDT'] }
const EXCHANGES: Partial<Record<ChainId, string[]>> = {
  btc: ['binance', 'kraken', 'coinbase', 'bitstamp', 'okx'],
  eth: ['binance', 'kraken', 'coinbase', 'okx', 'bitstamp'],
  bsc: ['binance', 'okx'],
  tron: ['binance', 'okx', 'huobex'],
}

const STEP_LABEL: Record<StepKind, string> = {
  hop: 'rebond vers une nouvelle adresse',
  peel: 'peel chain',
  consolidate: 'regroupement avec un autre portefeuille du suspect',
  swapper: 'échangeur instantané inter-chaînes',
  mixer: 'mixeur centralisé',
  dex: 'swap sur un DEX',
  aggregator: 'swap agrégé multi-pools',
  bridge: 'bridge inter-chaînes',
  lending: 'garantie et emprunt sur un protocole de prêt',
  weth: 'enveloppe WETH',
}

function makeTemplate(level: Difficulty): ScenarioTemplate {
  const meta: Record<number, { label: string; minutes: number; steps: [number, number] }> = {
    2: { label: 'intermédiaire', minutes: 30, steps: [2, 3] },
    3: { label: 'avancée', minutes: 45, steps: [3, 4] },
    4: { label: 'experte', minutes: 60, steps: [4, 6] },
  }
  const m = meta[level]
  return {
    id: `generee-n${level}`,
    generated: true,
    title: `Affaire générée — difficulté ${m.label}`,
    tagline: 'Une affaire inédite à chaque graine : typologie, chaînes et techniques de blanchiment tirées au sort.',
    description: `Le générateur compose une affaire nouvelle à chaque partie : victime, typologie, chaîne de départ, ${m.steps[0]} à ${m.steps[1]} techniques de blanchiment enchaînées et sortie sur une plateforme. Objectifs, pièces et débrief sont construits automatiquement. Idéal pour s'entraîner sans fin une fois les missions écrites terminées.`,
    difficulty: level,
    chains: level === 2 ? ['btc', 'eth', 'tron'] : ['btc', 'eth', 'tron', 'bsc'],
    skills: (level === 2 ? ['utxo', 'evm', 'tokens', 'exchange_id', 'peel'] : ['utxo', 'evm', 'dex', 'defi', 'crosschain', 'bridge', 'exchange_id', 'requisition']) as SkillId[],
    estMinutes: m.minutes,
    lessons: ['suivre-flux', 'tracage-outille', 'exchanges', 'requisitions'],
    generate: (seed) => generate(seed, level, m.steps),
  }
}

function generate(seed: number, level: Difficulty, stepRange: [number, number]) {
  const w = new World(seed)
  const r = w.rng
  const victimP = fakePerson(r)
  const city = fakeCity(r)
  const handle = fakeHandle(r)

  // ── Typologie et point de départ ─────────────────────────────────────────
  const typos: Typology[] = level === 2 ? ['escroquerie', 'escroquerie', 'rancon', 'piratage'] : ['escroquerie', 'piratage', 'rancon', 'drainer']
  const typo = r.pick(typos)
  const startChain: ChainId = typo === 'drainer' ? 'eth' : typo === 'rancon' ? r.pick(['btc', 'btc', 'eth'] as const) : typo === 'piratage' ? r.pick(level >= 3 ? (['eth', 'btc', 'bsc'] as const) : (['eth', 'btc'] as const)) : r.pick(['btc', 'eth', 'tron', 'tron'] as const)
  const startAsset: AssetId = typo === 'drainer' ? r.pick(['USDC', 'USDT'] as const) : startChain === 'tron' ? 'USDT' : startChain === 'eth' && typo === 'escroquerie' ? r.pick(['ETH', 'USDT'] as const) : CHAINS[startChain].native

  const suspectE = w.customEntity({ name: `Suspect « ${handle} » (non identifié)`, category: 'suspect' })
  const victimE = typo === 'piratage'
    ? w.customEntity({ name: `${r.pick(['NordPay', 'Kryptia', 'Valoris', 'Hexagone Pay', 'Altiva'])} (plateforme victime, fictive)`, category: 'victim' })
    : w.customEntity({ name: typo === 'rancon' ? `${r.pick(['Clinique', 'Transports', 'Mairie de', 'Groupe'])} ${city} (victime)` : victimP.name, category: 'victim' })
  const victim = w.addr(startChain, { entity: victimE })
  const p1 = w.addr(startChain, { entity: suspectE })
  const targetUsd = typo === 'piratage' ? r.float(120_000, 900_000) : typo === 'rancon' ? r.float(40_000, 300_000) : r.float(6_000, 90_000)

  // Historique de la victime puis vol / paiements
  const t0 = w.at(0)
  const victimTxs: Tx[] = []
  let drainSigner: string | undefined
  if (isUtxo(startChain)) {
    w.fund(victim, roundAsset(startAsset, fromUsd(startAsset, targetUsd * 1.3)), w.at(-r.int(10, 60) * 24))
    const parts = typo === 'escroquerie' ? r.int(1, 3) : 1
    for (let i = 0; i < parts; i++) {
      const v = roundAsset(startAsset, fromUsd(startAsset, (targetUsd / parts) * r.float(0.85, 1.15)))
      victimTxs.push(w.utxoTx({ time: t0 + i * r.int(20, 72) * H, from: [victim], to: [{ address: p1, value: v }] }))
    }
  } else if (typo === 'drainer') {
    const v = roundUsdAmount(w, startAsset, targetUsd * 0.9, targetUsd * 1.1)
    w.fundAccount(victim, v, startAsset, w.at(-r.int(10, 60) * 24))
    approve(w, { owner: victim, spender: p1, asset: startAsset, time: t0 - r.int(2, 20) * H })
    drainSigner = p1
    victimTxs.push(transferFrom(w, { spender: p1, owner: victim, to: p1, value: v, asset: startAsset, time: t0 }))
  } else {
    const parts = typo === 'escroquerie' ? r.int(2, 4) : 1
    for (let i = 0; i < parts; i++) {
      const v = roundUsdAmount(w, startAsset, (targetUsd / parts) * 0.85, (targetUsd / parts) * 1.15)
      victimTxs.push(w.transfer({ time: t0 + i * r.int(20, 72) * H, from: victim, to: p1, value: v, asset: startAsset }))
    }
  }
  const stolen = victimTxs.reduce((s, tx) => s + w.flowIn(tx, p1).reduce((a, f) => a + f.value, 0), 0)
  let t = victimTxs[victimTxs.length - 1].time + r.float(1, 12) * H

  // ── Enchaînement des techniques ──────────────────────────────────────────
  let cur: Funds = { chain: startChain, addr: p1, asset: startAsset }
  const steps: Step[] = []
  const nSteps = r.int(stepRange[0], stepRange[1])
  let chainChanges = 0
  const used = new Set<StepKind>()
  const dexes = new Map<ChainId, DexKit>()
  const dexOf = (c: ChainId) => {
    let d = dexes.get(c)
    if (!d) dexes.set(c, (d = dex(w, DEX_KEY[c]!, c)))
    return d
  }
  const newSuspect = (c: ChainId) => w.addr(c, { entity: suspectE })
  const bal = (f: Funds) => (isUtxo(f.chain) ? w.unspentValue(f.addr, t) : w.balanceOf(f.addr, f.asset))
  const qty = (v: number, a: AssetId) => amt(roundAsset(a, v), a)

  for (let i = 0; i < nSteps; i++) {
    const last = steps[steps.length - 1]?.kind
    const pool: StepKind[] = isUtxo(cur.chain)
      ? ['peel', 'consolidate', 'hop', ...(level >= 3 && chainChanges < (level >= 4 ? 2 : 1) ? (['swapper'] as const) : []), ...(level >= 4 && cur.chain === 'btc' && !used.has('mixer') ? (['mixer'] as const) : [])]
      : [
        'hop',
        ...(DEX_KEY[cur.chain] ? (['dex'] as const) : []),
        ...(cur.chain === 'eth' && level >= 3 ? (['aggregator'] as const) : []),
        ...((cur.chain === 'eth' || cur.chain === 'bsc') && level >= 3 && chainChanges < (level >= 4 ? 2 : 1) ? (['bridge'] as const) : []),
        ...(level >= 3 && chainChanges < (level >= 4 ? 2 : 1) ? (['swapper'] as const) : []),
        ...(cur.chain === 'eth' && cur.asset === 'ETH' && level >= 4 && !used.has('lending') ? (['lending'] as const) : []),
        ...(cur.chain === 'eth' && cur.asset === 'ETH' && level >= 3 && !used.has('weth') ? (['weth'] as const) : []),
      ]
    const candidates = pool.filter((k) => k !== last && !(k === 'consolidate' && used.has('consolidate')))
    const kind = r.pick(candidates.length ? candidates : pool)
    used.add(kind)
    const step = runStep(kind)
    if (step) steps.push(step)
    t += r.float(2, 30) * H
  }

  function runStep(kind: StepKind): Step | null {
    const from = cur.addr
    const c = cur.chain
    const native = CHAINS[c].native
    switch (kind) {
      case 'hop': {
        const to = newSuspect(c)
        const v = bal(cur)
        const tx = isUtxo(c)
          ? w.utxoTx({ time: t, from: [from], to: [{ address: to, value: v - w.estimateFee(c, 2, 1) }], change: null, spendAll: true })
          : w.transfer({ time: t, from, to, value: v, asset: cur.asset })
        cur = { ...cur, addr: to }
        const got = w.flowIn(tx, to)[0]?.value ?? v
        return {
          kind, txs: [tx.id],
          story: `Les fonds (${qty(got, cur.asset)}) rebondissent de ${A(w, from)} vers une nouvelle adresse ${A(w, to)}.`,
          hint: 'Un simple rebond : suivez la sortie unique vers une adresse neuve.',
          objectives: [{ id: '', type: 'address', points: 8, prompt: `Vers quelle adresse les fonds sont-ils transférés depuis ${A(w, from).slice(0, 14)}… le ${fmtDate(tx.time, false)} ?`, answer: [to], hint: 'Ouvrez les sorties de cette adresse à la date indiquée.', explanation: `La transaction ${tx.hash.slice(0, 16)}… transfère ${qty(got, cur.asset)} vers ${A(w, to)}, adresse neuve qui ne sert qu'à ce rebond.` }],
        }
      }
      case 'peel': {
        const n = r.int(3, 6)
        const ps = peelChain(w, { start: from, steps: n, time: t, peelTarget: () => w.addr(c), stepH: [0.5, 6], peelFraction: [0.04, 0.12] })
        if (!ps.length) return null
        const end = ps[ps.length - 1].next
        const peeled = ps.reduce((s, p) => s + p.peelValue, 0)
        t = ps[ps.length - 1].tx.time
        cur = { ...cur, addr: end }
        return {
          kind, txs: ps.map((p) => p.tx.id),
          story: `Peel chain de ${ps.length} sauts depuis ${A(w, from)} : ${qty(peeled, native)} sont « pelés » vers des tiers, le reste aboutit sur ${A(w, end)}.`,
          hint: 'À chaque saut d\'une peel chain, la grosse sortie (même type d\'adresse) continue la chaîne ; l\'outil « Suivre la peel chain » de l\'inspecteur l\'automatise.',
          objectives: [
            { id: '', type: 'number', points: 9, unit: 'sauts', prompt: `Combien de transactions compte la peel chain qui part de ${A(w, from).slice(0, 14)}… ?`, answer: ps.length, hint: 'Suivez la sortie la plus grosse jusqu\'à ce que le schéma (une petite sortie + un gros rendu) s\'arrête.', explanation: `La chaîne compte ${ps.length} transactions ; chacune envoie une petite part vers une adresse tierce et le reste vers une nouvelle adresse du même type.` },
            { id: '', type: 'address', points: 9, prompt: 'Sur quelle adresse se termine la peel chain (le « reste » après la dernière pelure) ?', answer: [end], hint: 'C\'est la sortie de rendu de la dernière transaction de la chaîne.', explanation: `Après ${ps.length} pelures (${qty(peeled, native)} au total), le reste aboutit sur ${A(w, end)}.` },
          ],
        }
      }
      case 'consolidate': {
        const other = newSuspect(c)
        const otherVal = roundAsset(native, fromUsd(native, r.float(300, 6000)))
        w.fund(other, otherVal, t - r.int(24, 400) * H)
        const to = newSuspect(c)
        const total = w.unspentValue(from, t) + w.unspentValue(other, t)
        const fee = w.estimateFee(c, 3, 1)
        const tx = w.utxoTx({ time: t, from: [from, other], to: [{ address: to, value: total - fee }], fee, change: null, spendAll: true })
        cur = { ...cur, addr: to }
        return {
          kind, txs: [tx.id],
          story: `Le suspect regroupe les fonds avec ceux d'une autre de ses adresses, ${A(w, other)}, dans une même transaction vers ${A(w, to)} : l'heuristique des entrées communes relie les deux portefeuilles.`,
          hint: 'Une transaction à plusieurs entrées signées ensemble : l\'heuristique des entrées communes (CIOH) les attribue au même portefeuille.',
          objectives: [{ id: '', type: 'address', points: 10, prompt: 'Quelle autre adresse du suspect est dépensée dans la même transaction que les fonds volés (entrées communes) ?', answer: [other], hint: 'Ouvrez la transaction de regroupement : regardez ses entrées.', explanation: `${A(w, other)} est dépensée avec les fonds volés dans ${tx.hash.slice(0, 16)}… : selon l'heuristique des entrées communes, le suspect contrôle les deux adresses. Son historique antérieur est une nouvelle piste (financement, autres victimes).` }],
        }
      }
      case 'swapper': {
        const sw = swapper(w, r.pick(['changenow', 'changenow', 'exch'] as const))
        const toChain: ChainId = isUtxo(c) ? r.pick(['eth', 'tron'] as const) : r.pick((['btc', 'tron', 'eth', 'bsc'] as ChainId[]).filter((x) => x !== c))
        const toAsset: AssetId = toChain === 'tron' ? 'USDT' : CHAINS[toChain].native
        const recipient = newSuspect(toChain)
        const v = isUtxo(c) ? roundAsset(native, w.unspentValue(from, t) * 0.97) : bal(cur)
        const o = sw.order({ from, value: v, asset: cur.asset, time: t, toChain, toAsset, recipient })
        chainChanges++
        t = o.payoutTx.time
        cur = { chain: toChain, addr: recipient, asset: toAsset }
        return {
          kind, txs: [o.depositTx.id, o.payoutTx.id],
          story: `Les fonds sont confiés à l'échangeur instantané ${sw.entity.name} (dépôt de ${qty(v, isUtxo(c) ? native : (o.depositTx.transfers[0]?.asset ?? native))}) qui paie ${qty(o.payoutValue, toAsset)} sur ${CHAINS[toChain].name} vers ${A(w, recipient)}.`,
          hint: 'Un échangeur instantané rompt le lien on-chain : rapprochez le dépôt et le paiement par le montant (moins la commission) et le délai, avec le corrélateur.',
          objectives: [
            { id: '', type: 'entity', points: 8, prompt: 'Quel service a permis de changer de blockchain ?', answer: [sw.entity.id], hint: 'L\'adresse qui reçoit les fonds est attribuée par l\'outil.', explanation: `${sw.entity.name} est un échangeur instantané : le dépôt arrive sur une adresse de dépôt propre à la commande, le paiement part de son portefeuille sur l'autre chaîne.` },
            { id: '', type: 'address', points: 11, prompt: `Quelle adresse ${CHAINS[toChain].name} a reçu le paiement de l'échangeur ?`, answer: [recipient], hint: 'Corrélateur : montant équivalent (moins 0,5 à 2 % de commission) quelques minutes après le dépôt ; écartez les autres clients.', explanation: `Le paiement de ${qty(o.payoutValue, toAsset)} vers ${A(w, recipient)} intervient ${Math.round((o.payoutTx.time - o.depositTx.time) / 60)} min après le dépôt, pour un montant cohérent avec la commission. La réquisition de ${sw.entity.name} sur le hash de dépôt confirmerait la commande.` },
          ],
        }
      }
      case 'mixer': {
        const mx = mixer(w, 'sinbad', c)
        const recipient = newSuspect(c)
        const v = roundAsset(native, w.unspentValue(from, t) * 0.98)
        const res = mx.mix({ from, value: v, time: t, recipients: [recipient], delayH: [6, 30] })
        t = res.payouts[0].time
        cur = { ...cur, addr: recipient }
        return {
          kind, txs: [res.depositTx.id, res.payouts[0].id],
          story: `Passage par le mixeur ${mx.entity.name} : ${qty(v, native)} déposés, ${qty(w.flowIn(res.payouts[0], recipient)[0].value, native)} restitués ${Math.round((res.payouts[0].time - res.depositTx.time) / H)} h plus tard sur ${A(w, recipient)}.`,
          hint: 'Mixeur centralisé : le lien est rompu sur la chaîne ; cherchez un retrait de montant proche (moins 1 à 3 %) dans les heures qui suivent.',
          objectives: [{ id: '', type: 'address', points: 11, prompt: 'Quelle adresse reçoit le retrait du mixeur qui correspond au dépôt du suspect ?', answer: [recipient], hint: 'Montant déposé moins la commission, délai de quelques heures à un jour : comparez les retraits du mixeur avec le corrélateur.', explanation: `${A(w, recipient)} reçoit ${qty(w.flowIn(res.payouts[0], recipient)[0].value, native)}, soit le dépôt moins une commission d'environ ${Math.round((1 - w.flowIn(res.payouts[0], recipient)[0].value / v) * 100)} %. C'est une corrélation probable, pas une certitude : à présenter comme telle.` }],
        }
      }
      case 'dex': {
        const d = dexOf(c)
        const outs = cur.asset === native ? (STABLE[c] ?? ['USDT']) : [native]
        const assetOut = r.pick(outs)
        const amountIn = bal(cur)
        const sw = d.swap({ trader: from, assetIn: cur.asset, amountIn, assetOut, time: t })
        const before = cur.asset
        cur = { ...cur, asset: assetOut }
        return {
          kind, txs: [sw.tx.id],
          story: `Swap sur ${d.entity.name} : ${qty(amountIn, before)} contre ${qty(sw.amountOut, assetOut)}.`,
          hint: 'Un swap se lit en jambes : l\'actif part vers le routeur/pool, le pool renvoie l\'autre actif au même trader.',
          objectives: [
            { id: '', type: 'choice', points: 7, prompt: `En quel actif le suspect convertit-il ses ${before} sur ${d.entity.name} ?`, ...choice(r, assetOut, [...new Set([native, 'USDT', 'USDC', 'DAI', 'WBTC'])].filter((x) => x !== assetOut && x !== before).slice(0, 3)), hint: 'Lisez la jambe que le pool renvoie au trader.', explanation: `Le pool renvoie ${qty(sw.amountOut, assetOut)} au suspect : la piste continue dans cet actif.` },
            { id: '', type: 'amount', points: 9, unit: assetOut, tolerance: 0.01, prompt: `Combien de ${assetOut} le suspect obtient-il par ce swap ?`, answer: roundAsset(assetOut, sw.amountOut), hint: 'Montant de la jambe pool → trader.', explanation: `${qty(amountIn, before)} échangés contre ${qty(sw.amountOut, assetOut)} (frais du pool de 0,3 % et glissement compris).` },
          ],
        }
      }
      case 'aggregator': {
        const ag = aggregator(w, 'oneinch', 'eth', dexOf('eth'))
        const mids = (['ETH', 'USDC', 'USDT', 'DAI'] as AssetId[]).filter((x) => x !== cur.asset)
        const mid = r.pick(mids)
        const end = r.pick((['USDC', 'USDT', 'DAI', 'ETH'] as AssetId[]).filter((x) => x !== mid && x !== cur.asset))
        const amountIn = bal(cur)
        const res = ag.swap({ trader: from, route: [cur.asset, mid, end], amountIn, time: t })
        const before = cur.asset
        cur = { ...cur, asset: end }
        return {
          kind, txs: [res.tx.id],
          story: `Swap agrégé via ${ag.entity.name} en un seul appel : ${before} → ${mid} → ${end}, ${qty(res.amountOut, end)} reçus.`,
          hint: 'Un agrégateur enchaîne plusieurs pools dans la même transaction : le routeur garde transitoirement l\'actif intermédiaire, seul le dernier pool paie le trader.',
          objectives: [
            { id: '', type: 'number', points: 8, unit: 'pools', prompt: `Combien de pools le swap agrégé du ${fmtDate(res.tx.time, false)} traverse-t-il ?`, answer: res.pools.length, hint: 'Comptez les événements Swap du journal, ou les contrats « Pool » dans les jambes.', explanation: `Le chemin ${before} → ${mid} → ${end} traverse ${res.pools.length} pools ; l'actif intermédiaire (${mid}) ne fait que transiter par le routeur.` },
            { id: '', type: 'amount', points: 9, unit: end, tolerance: 0.01, prompt: `Quel montant de ${end} le suspect reçoit-il à l'issue du swap agrégé ?`, answer: roundAsset(end, res.amountOut), hint: 'C\'est la jambe du dernier pool vers le trader.', explanation: `Le dernier pool verse ${qty(res.amountOut, end)} au suspect.` },
          ],
        }
      }
      case 'bridge': {
        const b = bridge(w, 'arcbridge')
        const toChain: ChainId = c === 'eth' ? 'bsc' : 'eth'
        const recipient = newSuspect(toChain)
        const v = bal(cur)
        const res = b.send({ from, value: v, asset: cur.asset, time: t, toChain, recipient })
        const toAsset = res.inTx.transfers[0].asset
        chainChanges++
        t = res.inTx.time
        cur = { chain: toChain, addr: recipient, asset: toAsset }
        return {
          kind, txs: [res.outTx.id, res.inTx.id],
          story: `Passage par le bridge ${b.entity.name} de ${CHAINS[c].name} vers ${CHAINS[toChain].name} (nonce ${res.outTx.bridge!.nonce}) : ${qty(res.received, toAsset)} crédités à ${A(w, recipient)}.`,
          hint: 'Un bridge publie la chaîne cible, le destinataire et un nonce : l\'inspecteur ouvre directement la transaction d\'arrivée.',
          objectives: [{ id: '', type: 'address', points: 10, prompt: `Quelle adresse reçoit les fonds sur ${CHAINS[toChain].name} après le passage par le bridge ?`, answer: [recipient], hint: 'Ouvrez la transaction de départ : l\'événement du bridge donne le destinataire et le nonce ; « Ouvrir la transaction liée ».', explanation: `L'événement BridgeOut (nonce ${res.outTx.bridge!.nonce}) désigne ${A(w, recipient)} ; la transaction d'arrivée lui verse ${qty(res.received, toAsset)}.` }],
        }
      }
      case 'lending': {
        const l = lending(w, 'aave', 'eth')
        const collat = bal(cur)
        const sup = l.supply({ from, value: collat, time: t })
        const borrowAsset = r.pick(['USDC', 'USDT'] as const)
        const borrowed = roundAsset(borrowAsset, usd('ETH', collat) * r.float(0.45, 0.65))
        const bor = l.borrow({ from, value: borrowed, asset: borrowAsset, time: t + r.int(10, 120) * 60 })
        t = bor.time
        cur = { ...cur, asset: borrowAsset }
        return {
          kind, txs: [sup.id, bor.id],
          story: `Les ${qty(collat, 'ETH')} sont déposés en garantie sur ${l.entity.name} (aWETH reçus), puis le suspect emprunte ${qty(borrowed, borrowAsset)} « neufs » contre cette garantie.`,
          hint: 'Les fonds empruntés ne viennent pas des ETH volés mais du pool : le lien est économique (garantie), à rattacher par l\'événement Borrow du même compte.',
          objectives: [
            { id: '', type: 'amount', points: 10, unit: borrowAsset, tolerance: 0.01, prompt: `Combien de ${borrowAsset} le suspect emprunte-t-il contre sa garantie ?`, answer: borrowed, hint: 'Transaction « borrow » : jambe pool → suspect, et événement Borrow.', explanation: `${qty(borrowed, borrowAsset)} empruntés, soit environ ${Math.round((usd(borrowAsset, borrowed) / usd('ETH', collat)) * 100)} % de la valeur de la garantie.` },
            { id: '', type: 'choice', points: 8, prompt: 'Comment qualifier, dans un rapport, le lien entre les ETH volés et les stablecoins empruntés ?', ...choice(r, 'Un lien indirect (économique) : les fonds empruntés sortent du pool, garantis par les ETH volés', ['Un flux direct : ce sont les mêmes fonds convertis', 'Aucun lien : un emprunt rompt définitivement le traçage', 'Un swap : le protocole de prêt a échangé les ETH contre des stablecoins']), hint: 'D\'où viennent matériellement les stablecoins ?', explanation: 'Les stablecoins viennent des réserves du pool ; les ETH volés restent en garantie (aWETH). Le rattachement est un lien économique, solide mais à exposer comme tel, différent d\'un flux.' },
          ],
        }
      }
      case 'weth': {
        const wk = weth(w, 'eth')
        const v = bal(cur)
        const wrapTx = wk.wrap(from, v, t)
        const to = newSuspect('eth')
        const hopTx = w.transfer({ time: t + r.int(5, 90) * 60, from, to, value: v, asset: 'WETH' })
        const unwrapTx = wk.unwrap(to, v, hopTx.time + r.int(10, 240) * 60)
        t = unwrapTx.time
        cur = { ...cur, addr: to }
        return {
          kind, txs: [wrapTx.id, hopTx.id, unwrapTx.id],
          story: `Les ETH sont enveloppés en WETH, transférés sous forme de jeton à ${A(w, to)}, puis désenveloppés : le transfert intermédiaire n'apparaît pas comme un envoi d'ETH.`,
          hint: 'deposit() sur le contrat WETH crée des WETH (événement Deposit) ; le transfert suivant est un événement Transfer du jeton, pas une transaction en ETH.',
          objectives: [{ id: '', type: 'choice', points: 8, prompt: `Sous quelle forme les fonds parviennent-ils à ${A(w, to).slice(0, 14)}… ?`, ...choice(r, 'En WETH (ETH enveloppé en jeton ERC-20), ensuite désenveloppé', ['En ETH natif, par une transaction interne', 'En USDC, après un swap', 'En aWETH, jeton de reçu d\'un protocole de prêt']), hint: 'Regardez l\'actif de la jambe qui arrive sur cette adresse.', explanation: `L'adresse reçoit ${qty(v, 'WETH')} (événement Transfer du contrat WETH), puis appelle withdraw() pour récupérer autant d'ETH.` }],
        }
      }
    }
  }

  // ── Sortie sur une plateforme ────────────────────────────────────────────
  const exKey = r.pick(EXCHANGES[cur.chain] ?? ['binance'])
  const useForwarder = cur.chain === 'eth' && level >= 3 && r.chance(0.5)
  const holder = cur.addr
  const balance = bal(cur)
  const depositValue = isUtxo(cur.chain) ? roundAsset(CHAINS[cur.chain].native, balance * r.float(0.55, 0.8)) : roundAsset(cur.asset, balance * r.float(0.6, 0.85))
  let exEntity: Entity
  let deposit: string
  let depositTx: Tx
  let sweepTx: Tx | undefined
  if (useForwarder) {
    const fx = forwarderExchange(w, exKey, 'eth')
    const res = fx.receive(holder, depositValue, t, { asset: cur.asset })
    exEntity = fx.entity
    deposit = res.deposit
    depositTx = res.tx
    sweepTx = res.flush
    fx.noise(14, w.at(-48), t + 72 * H, cur.asset)
  } else {
    const ex = exchange(w, exKey, cur.chain)
    const res = ex.receive(holder, depositValue, t, { asset: cur.asset, change: isUtxo(cur.chain) ? holder : undefined })
    exEntity = ex.entity
    deposit = res.deposit
    depositTx = res.tx
    sweepTx = res.sweep
    ex.noise(12, w.at(-48), t + 72 * H, cur.asset)
  }
  const heldAddr = holder
  const heldValue = isUtxo(cur.chain) ? w.unspentValue(heldAddr) : w.balanceOf(heldAddr, cur.asset)
  const heldAsset = isUtxo(cur.chain) ? CHAINS[cur.chain].native : cur.asset
  const deposited = w.flowIn(depositTx, deposit).find((f) => f.asset === (isUtxo(cur.chain) ? CHAINS[cur.chain].native : cur.asset))?.value ?? depositValue

  // Bruit de fond sur les services traversés
  for (const d of dexes.values()) d.noise(18, w.at(-48), t + 48 * H)
  const chainsCrossed = new Set([startChain, ...steps.flatMap((s) => s.txs.map((id) => w.tx(id).chain)), cur.chain])

  // ── Objectifs ────────────────────────────────────────────────────────────
  const firstOut = steps[0]?.txs[0]
  const objectives: Objective[] = [
    { id: '', type: 'address', points: 8, prompt: typo === 'piratage' ? 'Vers quelle adresse les fonds de la plateforme sont-ils détournés ?' : typo === 'drainer' ? 'Quelle adresse a prélevé les fonds grâce à l\'autorisation signée par la victime ?' : 'Quelle adresse a reçu les fonds de la victime ?', answer: [p1], hint: 'Partez de l\'adresse et des transactions citées dans la plainte.', explanation: `${A(w, p1)} reçoit ${qty(stolen, startAsset)}${typo === 'drainer' ? ' par un transferFrom qu\'elle signe elle-même, grâce à l\'approve illimité accordé par la victime' : ''}.` },
    { id: '', type: 'amount', points: 8, unit: startAsset, tolerance: 0.01, prompt: `Quel montant total (${startAsset}) le suspect a-t-il reçu de la victime ?`, answer: roundAsset(startAsset, stolen), hint: victimTxs.length > 1 ? `La victime a payé en ${victimTxs.length} fois : additionnez.` : 'Montant reçu par l\'adresse du suspect dans la transaction de la plainte.', explanation: `${victimTxs.length > 1 ? `${victimTxs.length} paiements, ` : ''}${qty(stolen, startAsset)} au total.` },
  ]
  if (firstOut) objectives.push({ id: '', type: 'tx', points: 8, prompt: `Quelle transaction fait sortir les fonds de ${A(w, p1).slice(0, 14)}… pour la première fois ?`, answer: [firstOut], hint: 'Dépliez les sorties de la première adresse du suspect.', explanation: `${w.tx(firstOut).hash.slice(0, 18)}… est la première dépense des fonds volés (${STEP_LABEL[steps[0].kind]}).` })
  // Objectifs des étapes : au plus 5, en privilégiant la diversité
  const stepObjs = r.shuffle(steps.flatMap((s) => s.objectives.slice(0, 2))).slice(0, level === 2 ? 4 : level === 3 ? 4 : 5)
  objectives.push(...stepObjs)
  objectives.push(
    { id: '', type: 'entity', points: 9, prompt: 'Sur quelle plateforme le suspect dépose-t-il une partie des fonds ?', answer: [exEntity.id], hint: 'Suivez le dernier portefeuille du suspect : l\'adresse destinataire est reversée vers un portefeuille attribué.', explanation: `${exEntity.name}. ${procedureFor(exEntity)}` },
    { id: '', type: 'address', points: 10, prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition ?', answer: [deposit], hint: useForwarder ? 'L\'adresse de dépôt est ici un contrat (forwarder) : ni le hot wallet, ni la fabrique, ni le portefeuille opérationnel.' : 'Pas le hot wallet : l\'adresse qui reçoit les fonds du suspect avant le balayage.', explanation: `${A(w, deposit)} est l'adresse de dépôt propre au client${useForwarder ? ' (contrat forwarder, reversé par la plateforme)' : ''}, balayée ensuite vers le portefeuille principal de ${exEntity.name}.` },
    { id: '', type: 'amount', points: 9, unit: isUtxo(cur.chain) ? CHAINS[cur.chain].native : cur.asset, tolerance: 0.01, prompt: 'Quel montant est déposé sur la plateforme ?', answer: roundAsset(heldAsset, deposited), hint: 'Montant reçu par l\'adresse de dépôt dans la transaction du suspect.', explanation: `${qty(deposited, heldAsset)} déposés le ${fmtDate(depositTx.time)}.` },
  )
  if (heldValue > 0 && usd(heldAsset, heldValue) > 20) {
    const freezable = heldAsset === 'USDT' || heldAsset === 'USDC'
    objectives.push(
      { id: '', type: 'amount', points: 9, unit: heldAsset, tolerance: 0.01, prompt: `Quel montant (${heldAsset}) reste détenu par le suspect hors de la plateforme, sur ${A(w, heldAddr).slice(0, 14)}… ?`, answer: roundAsset(heldAsset, heldValue), hint: 'Solde de la dernière adresse du suspect après le dépôt (ou montant de son rendu).', explanation: `${qty(heldValue, heldAsset)} restent sur ${A(w, heldAddr)}. Placez-la sous surveillance.` },
      { id: '', type: 'choice', points: 8, prompt: 'Que peut-on faire pour ce reliquat détenu hors de la plateforme ?', ...choice(r,
        freezable ? `Demander le gel à l'émetteur (${heldAsset === 'USDT' ? 'Tether' : 'Circle'}) sur cette adresse, en plus de la surveillance` : 'Aucun émetteur ne peut le geler : surveiller l\'adresse et agir dès que les fonds touchent une plateforme',
        freezable
          ? ['Rien : un reliquat hors plateforme est perdu', 'Demander au DEX de bloquer l\'adresse', 'Réquisitionner la plateforme pour qu\'elle gèle une adresse qui n\'est pas chez elle']
          : [`Demander le gel à l'émetteur de ${heldAsset}`, 'Demander au mineur ou au validateur de bloquer les fonds', 'Réquisitionner la plateforme pour qu\'elle gèle une adresse qui n\'est pas chez elle']),
        hint: `L'actif détenu (${heldAsset}) a-t-il un émetteur centralisé capable de bloquer une adresse ?`, explanation: freezable ? `${heldAsset} est émis par une société qui peut bloquer une adresse sur demande motivée : à solliciter vite, car le suspect peut bouger les fonds.` : `${heldAsset} n'a pas d'émetteur capable de geler une adresse : seule la surveillance permet d'agir quand les fonds rejoindront un service régulé.` },
    )
  }
  if (chainsCrossed.size > 1) objectives.push({ id: '', type: 'number', points: 7, unit: 'chaînes', prompt: 'Combien de blockchains différentes les fonds ont-ils traversées (départ compris) ?', answer: chainsCrossed.size, hint: 'Comptez la chaîne de départ et chaque changement de chaîne (bridge, échangeur instantané).', explanation: `${[...chainsCrossed].map((c) => CHAINS[c].name).join(', ')}.` })
  const finalObjectives = objectives.slice(0, 12).map((o, i) => ({ ...o, id: `o${i + 1}` })) as Objective[]

  // ── Récit, pièces, débrief ───────────────────────────────────────────────
  const typoText: Record<Typology, string> = {
    escroquerie: `${victimP.name} (${city}) a été ${victimP.g('convaincu', 'convaincue')} par un faux conseiller en investissement de transférer ses économies vers une « plateforme » qui s'est révélée fictive.`,
    piratage: `${victimE.name} signale le détournement de fonds de son portefeuille chaud après la compromission d'une clé d'accès.`,
    rancon: `${victimE.name} a payé une rançon après le chiffrement de son système d'information par un groupe criminel.`,
    drainer: `${victimP.name} (${city}) a connecté son portefeuille à un faux site de « vérification » et signé une autorisation de dépense (approve) sans en comprendre la portée ; quelques heures plus tard, ses ${startAsset} ont été prélevés.`,
  }
  const truthPath = [...victimTxs.map((x) => x.id), ...steps.flatMap((s) => s.txs), depositTx.id, ...(sweepTx ? [sweepTx.id] : [])]
  const debrief = [
    `1. ${typoText[typo]} Le suspect reçoit ${qty(stolen, startAsset)} sur ${A(w, p1)}.`,
    ...steps.map((s, i) => `${i + 2}. ${s.story}`),
    `${steps.length + 2}. Dépôt de ${qty(deposited, heldAsset)} sur ${A(w, deposit)} (${exEntity.name}).${heldValue > 0 ? ` ${qty(heldValue, heldAsset)} restent sur ${A(w, heldAddr)}.` : ''}`,
    '',
    `Techniques enchaînées : ${steps.map((s) => STEP_LABEL[s.kind]).join(' → ') || 'aucune'}. Chaque technique a sa lecture : rejouez une autre graine pour en rencontrer d'autres combinaisons.`,
  ].join('\n')
  const hints = [
    'Partez de la plainte : adresse de la victime et transactions citées.',
    ...[...new Set(steps.map((s) => s.hint))].slice(0, 4),
    'À la fin du parcours, l\'adresse destinataire est balayée vers un portefeuille de plateforme : c\'est elle, l\'adresse de dépôt, qu\'on réquisitionne.',
  ]

  return {
    world: w,
    title: `${{ escroquerie: 'Faux placement', piratage: 'Détournement de portefeuille chaud', rancon: 'Paiement de rançon', drainer: 'Autorisation piégée' }[typo]} — ${city}`,
    briefing:
      `${typoText[typo]}\n\n` +
      `Le dossier vous est transmis pour reconstituer le parcours des fonds, identifier la plateforme où le suspect a tenté de les encaisser et les montants encore détenus. Les techniques employées et les chaînes traversées ne sont pas connues à l'avance.\n\n` +
      `Affaire générée (graine ${seed}) : ${steps.length} technique(s) de blanchiment, difficulté ${level === 2 ? 'intermédiaire' : level === 3 ? 'avancée' : 'experte'}.`,
    evidence: [
      {
        id: 'plainte', type: 'plainte' as const, title: typo === 'piratage' ? 'Signalement de la plateforme victime' : 'Procès-verbal de plainte (extrait)', date: victimTxs[victimTxs.length - 1].time + 2 * 86400, author: victimE.name,
        body:
          `${typo === 'piratage' ? 'Adresse du portefeuille chaud compromis' : 'Mon adresse'} : ${A(w, victim)} (${CHAINS[startChain].name})\n` +
          `Transaction(s) en cause :\n${victimTxs.map((x) => `- ${x.hash} (${fmtDate(x.time)})`).join('\n')}` +
          (drainSigner ? '\n\nJe n\'ai signé aucune de ces transactions : seulement une « vérification » sur le site, quelques heures avant.' : ''),
      },
      {
        id: 'note', type: 'note' as const, title: 'Note de la cellule d\'appui', date: t, author: 'Cellule d\'appui crypto',
        body: `• Chaînes susceptibles d'être concernées : ${[...chainsCrossed].map((c) => CHAINS[c].name).join(', ')}.\n• Vérifiez chaque conversion (swap, bridge, échangeur) avant de poursuivre : la piste peut changer d'actif ou de chaîne.\n• Les montants demandés sont ceux visibles sur la chaîne, à l'unité près.`,
      },
    ],
    seeds: [victim],
    objectives: finalObjectives,
    truth: { path: truthPath, addresses: [p1, ...steps.flatMap((s) => s.txs.map((id) => w.tx(id)).flatMap((x) => x.transfers.map((y) => y.to).concat(x.outputs.map((o) => o.address))).filter((a) => w.get(a).entityId === suspectE.id)).slice(0, 12), deposit], debrief },
    hints,
  }
}

export const GENERATED: ScenarioTemplate[] = [makeTemplate(2), makeTemplate(3), makeTemplate(4)]
