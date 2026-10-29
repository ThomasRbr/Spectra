// Exercices sur le modèle à comptes : actif natif ou jeton, adresse de dépôt
// ou hot wallet, destination tag XRP.
import { Rng } from '../../engine/rng'
import { CHAINS, type ChainId } from '../../engine/chains'
import { genAddress, shortAddr } from '../../engine/addressgen'
import type { DrillDef, DrillItem, FlowEdge, FlowNode } from '../model'
import { dayTime, de, frDate, frMax, mkChoice, rngFor } from './util'

const EXCHANGES = ['Binance', 'OKX', 'Bitstamp', 'Coinhouse', 'Huobex', 'SwissBorg']

// ── Natif ou jeton ? ─────────────────────────────────────────────────────────

const TV_CHAINS = [
  { chain: 'eth' as ChainId, native: 'ETH', tokens: ['USDT', 'USDC', 'DAI'], std: 'ERC-20', explorer: 'Etherscan', name: 'Ethereum' },
  { chain: 'tron' as ChainId, native: 'TRX', tokens: ['USDT', 'USDT', 'USDC'], std: 'TRC-20', explorer: 'Tronscan', name: 'Tron' },
  { chain: 'bsc' as ChainId, native: 'BNB', tokens: ['USDT', 'USDC'], std: 'BEP-20', explorer: 'BscScan', name: 'BNB Smart Chain' },
]

const NATIVE_USD: Record<string, number> = { ETH: 3185, TRX: 0.162, BNB: 583 }

function nativeAmount(rng: Rng, native: string): number {
  const usdv = rng.float(150, 40000)
  const v = usdv / NATIVE_USD[native]
  return native === 'TRX' ? Math.round(v) : Math.round(v * 1e4) / 1e4
}

export const tokenVsNative: DrillDef = {
  id: 'token-vs-native',
  title: 'Natif ou jeton ?',
  description: 'Comprendre ce qu\'une transaction transfère vraiment : l\'actif natif de la chaîne ou un jeton émis par un smart contract.',
  level: 1,
  track: 'stablecoins',
  icon: 'Coins',
  generate(seed) {
    const rng = rngFor(seed, 'token-vs-native')
    const c = rng.pick(TV_CHAINS)
    const variant = rng.weighted([['nature', 3], ['fees', 1.5], ['freeze', 1.5]] as const)
    const time = dayTime(rng)
    const S = genAddress(rng, c.chain, 'eoa')
    const R = genAddress(rng, c.chain, 'eoa')
    const C = genAddress(rng, c.chain, 'contract')
    const short = (a: string) => shortAddr(a, 6)

    if (variant === 'freeze') {
      // BSC exclu : l'USDT y est un jeton « ponté » qui n'est pas émis par Tether.
      const cc = c.chain === 'bsc' ? TV_CHAINS[rng.int(0, 1)] : c
      const S2 = genAddress(rng, cc.chain, 'eoa')
      const R2 = genAddress(rng, cc.chain, 'eoa')
      const C2 = genAddress(rng, cc.chain, 'contract')
      const isToken = rng.chance(0.55)
      const tok = cc.chain === 'tron' ? 'USDT' : rng.pick(['USDT', 'USDC'])
      const issuer = tok === 'USDT' ? 'Tether' : 'Circle'
      const amount = isToken ? Math.round(rng.float(2000, 250000)) : nativeAmount(rng, cc.native)
      const rows: Extract<DrillItem['visual'], { type: 'transfers' }>['rows'] = isToken
        ? [
            { from: S2, to: C2, value: 0, asset: cc.native, method: 'transfer', time, fromLabel: 'Victime', toLabel: `Contrat ${tok} (${cc.std})` },
            { from: S2, to: R2, value: amount, asset: tok, method: 'Transfer (événement)', time, fromLabel: 'Victime', toLabel: 'Suspect' },
          ]
        : [{ from: S2, to: R2, value: amount, asset: cc.native, method: 'transfer', time, fromLabel: 'Victime', toLabel: 'Suspect' }]
      const ISSUER = `L'émetteur du jeton (${issuer}), qui peut bloquer l'adresse dans le contrat`
      const NOBODY = `Personne on-chain : seul un intermédiaire qui détiendrait ensuite les fonds (exchange) pourrait les bloquer`
      const VALID = `Les validateurs ${de(cc.name)}, sur réquisition`
      const WALLET = 'L\'éditeur du portefeuille utilisé par le suspect'
      const correct = isToken ? ISSUER : NOBODY
      const { options, answer } = mkChoice(rng, correct, rng.shuffle([isToken ? NOBODY : ISSUER, VALID, WALLET]), 4)
      return {
        prompt: 'Les fonds sont encore sur l\'adresse du suspect. Qui peut techniquement les geler à ce stade ?',
        context: `Transaction relevée sur ${cc.explorer} (${cc.name}).`,
        visual: { type: 'transfers', chain: cc.chain, rows },
        kind: 'choice',
        options,
        answer,
        explain: isToken
          ? `La transaction appelle le contrat ${tok} (valeur 0 ${cc.native}) : ce sont des jetons ${tok}, gérés par un smart contract. Les contrats USDT et USDC comportent une fonction de liste noire contrôlée par l'émetteur (${issuer}) : sur demande des autorités, il peut geler l'adresse, ce qui rend les jetons inutilisables. C'est une démarche à engager très vite, avant que les fonds ne bougent.\n\nÀ l'inverse, l'actif natif (${cc.native}) ne peut être gelé par personne on-chain. Les validateurs ne censurent pas des adresses sur réquisition, et l'éditeur d'un portefeuille non custodial n'a pas accès aux clés.`
          : `C'est un transfert d'actif natif (${cc.native}) : aucun contrat n'intervient. Personne — ni les validateurs, ni l'éditeur d'un portefeuille non custodial, ni un émetteur (il n'y en a pas) — ne peut geler ces fonds on-chain. Il faut les suivre jusqu'à un intermédiaire (exchange, service custodial) capable de bloquer le compte.\n\nLe gel par l'émetteur n'existe que pour certains jetons centralisés comme l'USDT ou l'USDC.`,
      }
    }

    const isToken = variant === 'fees' ? true : rng.chance(0.55)
    const tok = rng.pick(c.tokens)
    const tokAmount = Math.round(rng.float(500, 120000) * 100) / 100
    const natAmount = nativeAmount(rng, c.native)
    const rows: Extract<DrillItem['visual'], { type: 'transfers' }>['rows'] = isToken
      ? [
          { from: S, to: C, value: 0, asset: c.native, method: 'transfer', time, toLabel: `Contrat ${tok} (${c.std})` },
          { from: S, to: R, value: tokAmount, asset: tok, method: 'Transfer (événement)', time },
        ]
      : [{ from: S, to: R, value: natAmount, asset: c.native, method: 'transfer', time }]

    if (variant === 'fees') {
      const correct = `${c.native}, l'actif natif ${de(c.name)}`
      const { options, answer } = mkChoice(rng, correct, rng.shuffle([`${tok}, prélevés sur le montant envoyé`, 'Aucun : les transferts de stablecoins sont gratuits', 'Le destinataire, à réception des fonds']), 4)
      return {
        prompt: 'Avec quel actif l\'émetteur a-t-il payé les frais de cette transaction ?',
        context: `Transaction relevée sur ${c.explorer}. La première ligne est la transaction elle-même, la seconde l'événement émis par le contrat.`,
        visual: { type: 'transfers', chain: c.chain, rows },
        kind: 'choice',
        options,
        answer,
        explain:
          `Sur ${c.name}, toute transaction se paie dans l'actif natif (${c.native}), y compris un transfert de jeton ${c.std}. Le montant de ${tok} arrive intact au destinataire.` +
          (c.chain === 'tron' ? ' Sur Tron, les frais prennent la forme d\'énergie et de bande passante : obtenues en bloquant (staking) ou en louant du TRX, ou à défaut payées en TRX brûlés.' : ' Le gas est payé en ' + c.native + ' par le signataire.') +
          `\n\nConséquence d'enquête : un portefeuille qui ne détient que des ${tok} doit d'abord recevoir un peu de ${c.native} pour bouger ses jetons. Repérer qui lui a fourni ce « carburant » est souvent une piste précieuse.`,
      }
    }

    // nature
    let correct: string
    let distract: string[]
    if (isToken) {
      correct = `${frMax(tokAmount, 2)} ${tok} vers ${short(R)}`
      distract = [`${frMax(tokAmount, 2)} ${tok} vers le contrat ${short(C)}`, `Rien : 0 ${c.native} transféré, la transaction est vide`, `${frMax(tokAmount, 2)} ${c.native} vers ${short(R)}`]
    } else {
      const fakeTok = rng.pick(c.tokens)
      correct = `${frMax(natAmount, 4)} ${c.native} vers ${short(R)}`
      distract = [`${frMax(natAmount, 4)} ${fakeTok} (jeton ${c.std}) vers ${short(R)}`, `Rien : aucun événement Transfer de jeton, la transaction est vide`, `${frMax(natAmount, 4)} ${c.native} vers ${short(S)}`]
    }
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(distract), 4)
    return {
      prompt: 'Que transfère réellement cette transaction, et à qui ?',
      context: `Vue ${c.explorer} (${c.name}). ${isToken ? 'Deux lignes : la transaction signée, puis l\'événement émis pendant son exécution.' : 'Une seule ligne : la transaction signée.'}`,
      visual: { type: 'transfers', chain: c.chain, rows },
      kind: 'choice',
      options,
      answer,
      explain: isToken
        ? `La transaction est adressée au contrat du jeton ${tok}, avec une valeur de 0 ${c.native} : c'est normal, elle ne transporte pas d'actif natif, elle appelle la fonction transfer() du contrat. Le contrat met à jour ses soldes internes et émet un événement Transfer : c'est lui qui indique le vrai bénéficiaire (${short(R)}) et le montant (${frMax(tokAmount, 2)} ${tok}).\n\nPièges : le champ « To » de la transaction désigne le contrat, pas le destinataire ; « 0 ${c.native} » ne signifie pas une transaction vide ; et les ${tok} ne sont pas des ${c.native}.`
        : `La transaction transfère directement de l'actif natif (${c.native}) de ${short(S)} vers ${short(R)} : pas de contrat appelé, pas d'événement de jeton — c'est attendu pour un transfert natif, la valeur figure dans la transaction elle-même.\n\nPièges : un transfert de jeton ${c.std} apparaîtrait comme un appel à un contrat avec 0 ${c.native} et un événement Transfer ; l'absence d'événement ne signifie pas une transaction vide.`,
    }
  },
}

// ── Adresse de dépôt ou hot wallet ? ─────────────────────────────────────────

export const depositVsHot: DrillDef = {
  id: 'deposit-vs-hot',
  title: 'Dépôt ou hot wallet ?',
  description: 'Identifier l\'adresse qui désigne le compte client d\'un exchange, à indiquer dans la réquisition.',
  level: 1,
  track: 'enquete',
  icon: 'Landmark',
  generate(seed) {
    const rng = rngFor(seed, 'deposit-vs-hot')
    const ex = rng.pick(EXCHANGES)
    const mode = rng.weighted([['account', 3], ['btc', 2], ['xrp', 1.5]] as const)
    const t0 = dayTime(rng)
    const prompt = `Quelle donnée indiquer dans la réquisition adressée à ${ex} pour identifier le titulaire du compte ?`

    if (mode === 'xrp') {
      const H = genAddress(rng, 'xrp', 'account')
      const V = genAddress(rng, 'xrp', 'account')
      const tags = new Set<number>()
      while (tags.size < rng.int(4, 5)) tags.add(rng.int(100000, 999999999))
      const [tag, ...otherTags] = [...tags]
      const amount = Math.round(rng.float(2000, 90000))
      const rows = rng
        .shuffle([
          { from: V, to: H, value: amount, asset: 'XRP', memo: String(tag), method: 'Payment', fromLabel: 'Victime', toLabel: `${ex} (adresse partagée)` },
          ...otherTags.map((tg) => ({ from: genAddress(rng, 'xrp', 'account'), to: H, value: Math.round(rng.float(50, 60000)), asset: 'XRP', memo: String(tg), method: 'Payment', toLabel: `${ex} (adresse partagée)` })),
        ])
        .map((r, i) => ({ ...r, time: t0 + i * rng.int(600, 7200) }))
      const correct = `L'adresse ${shortAddr(H, 6)} et le destination tag ${tag}`
      const { options, answer } = mkChoice(rng, correct, [`L'adresse ${shortAddr(H, 6)} seule`, `L'adresse ${shortAddr(H, 6)} et le destination tag ${rng.pick(otherTags)}`, `L'adresse ${shortAddr(V, 6)} (expéditrice)`], 4)
      return {
        prompt,
        context: `La victime a envoyé ${frMax(amount)} XRP depuis ${shortAddr(V, 6)} vers ${ex}. Sur le XRP Ledger, l'exchange reçoit les dépôts de tous ses clients sur une même adresse.`,
        visual: { type: 'transfers', chain: 'xrp', rows },
        kind: 'choice',
        options,
        answer,
        explain:
          `Sur XRP (comme Stellar, EOS, Hedera…), les exchanges utilisent une adresse partagée par tous leurs clients ; c'est le destination tag (ici ${tag}) qui désigne le compte crédité. L'adresse seule ne permet pas à ${ex} d'identifier un client : il faut transmettre l'adresse, le tag, le hash de la transaction, la date et le montant.\n\n` +
          `Le tag d'une autre ligne correspond à un autre client. L'adresse expéditrice est celle de la victime, pas celle du titulaire du compte destinataire.`,
      }
    }

    const chain: ChainId = mode === 'btc' ? 'btc' : rng.pick(['eth', 'tron', 'bsc'] as const)
    const native = CHAINS[chain].native
    const asset = mode === 'btc' ? 'BTC' : rng.chance(0.6) ? 'USDT' : native
    const kind = chain === 'btc' ? 'p2wpkh' : 'eoa'
    const V = genAddress(rng, chain, kind)
    const D = genAddress(rng, chain, kind)
    const H = genAddress(rng, chain, kind)
    const nOther = rng.int(2, 3)
    const others = Array.from({ length: nOther }, () => ({ s: genAddress(rng, chain, kind), d: genAddress(rng, chain, kind) }))
    const amt = () => (asset === 'BTC' ? Math.round(rng.float(0.01, 1.5) * 1e4) / 1e4 : asset === 'USDT' ? Math.round(rng.float(300, 60000)) : nativeAmount(rng, native))
    const amount = amt()
    const short = (a: string) => shortAddr(a, 7)

    const correct = short(D)
    const { options, answer } = mkChoice(rng, correct, rng.shuffle([short(H), short(others[0].d), short(V)]), 4)
    const explain =
      `${short(D)} est l'adresse de dépôt : ${ex} l'a générée pour un seul client, qui l'a communiquée (ou utilisée) pour recevoir les fonds de la victime. Elle désigne donc un compte précis : c'est elle, avec le hash de la transaction, la date et le montant, qui permet à ${ex} d'identifier le titulaire.\n\n` +
      `${short(H)} est le hot wallet : il reçoit le balayage (sweep) des dépôts de tous les clients. Le réquisitionner reviendrait à demander « qui sont vos clients ? » — inexploitable. ${short(others[0].d)} est l'adresse de dépôt d'un autre client, sans lien avec l'affaire. ${short(V)} est l'adresse de la victime.\n\n` +
      `Réflexe : remonter d'un saut avant le hot wallet. Les fonds y « disparaissent » dans la masse, mais l'adresse de dépôt qui les y a envoyés reste une preuve d'attribution.`

    if (mode === 'btc') {
      const nodes: FlowNode[] = [
        { id: 'v', label: short(V), kind: 'victim', sub: 'Victime' },
        { id: 'd', label: short(D), kind: 'deposit', sub: ex },
        ...others.map((o, i) => ({ id: `o${i}`, label: short(o.d), kind: 'deposit' as const, sub: ex })),
        { id: 's', label: 'Balayage', kind: 'tx', sub: 'consolidation' },
        { id: 'h', label: short(H), kind: 'hot', sub: `${ex} — hot wallet` },
      ]
      const edges: FlowEdge[] = [
        { from: 'v', to: 'd', label: `${frMax(amount, 4)} BTC` },
        { from: 'd', to: 's' },
        ...others.map((_, i) => ({ from: `o${i}`, to: 's' })),
        { from: 's', to: 'h', label: 'total − frais' },
      ]
      return {
        prompt,
        context: `La victime a envoyé ${frMax(amount, 4)} BTC. Votre outil attribue toutes les adresses de droite à ${ex} : quelques heures plus tard, une transaction de balayage regroupe plusieurs dépôts vers son hot wallet.`,
        visual: { type: 'flow', nodes, edges },
        kind: 'choice',
        options,
        answer,
        explain,
      }
    }

    const rows: Extract<DrillItem['visual'], { type: 'transfers' }>['rows'] = []
    rows.push({ from: V, to: D, value: amount, asset, method: 'transfer', time: t0, fromLabel: 'Victime', toLabel: ex })
    others.forEach((o, i) => rows.push({ from: o.s, to: o.d, value: amt(), asset, method: 'transfer', time: t0 + (i - 1) * rng.int(900, 5400), toLabel: ex }))
    const sweepT = t0 + rng.int(2, 8) * 3600
    const sweeps = rng.shuffle([{ d: D, v: amount }, ...others.map((o, i) => ({ d: o.d, v: rows[i + 1].value }))])
    sweeps.forEach((s, i) => rows.push({ from: s.d, to: H, value: s.v, asset, method: 'sweep', time: sweepT + i * rng.int(20, 300), fromLabel: ex, toLabel: `${ex} — hot wallet` }))
    rows.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    return {
      prompt,
      context: `La victime a envoyé ${frMax(amount, 4)} ${asset} depuis ${short(V)}. Votre outil attribue à ${ex} les adresses de destination et le hot wallet.`,
      visual: { type: 'transfers', chain, rows },
      kind: 'choice',
      options,
      answer,
      explain,
    }
  },
}

// ── Destination tag XRP ──────────────────────────────────────────────────────

export const xrpTag: DrillDef = {
  id: 'xrp-tag',
  title: 'Retrouver le destination tag',
  description: 'Identifier, parmi les dépôts sur l\'adresse partagée d\'un exchange XRP, le tag qui désigne le compte du suspect.',
  level: 2,
  track: 'comptes',
  icon: 'Tag',
  generate(seed) {
    const rng = rngFor(seed, 'xrp-tag')
    const ex = rng.pick(EXCHANGES)
    const H = genAddress(rng, 'xrp', 'account')
    const n = rng.int(4, 6)
    const base = dayTime(rng)
    const tags = new Set<number>()
    while (tags.size < n + 1) tags.add(rng.weighted([[rng.int(1000, 99999), 1], [rng.int(100000, 9999999), 2], [rng.int(10000000, 3999999999), 2]] as const))
    const tagList = [...tags]
    const amounts = new Set<number>()
    while (amounts.size < n) amounts.add(Math.round(rng.float(80, 75000) / 5) * 5)
    const amountList = [...amounts]
    const rows: Extract<DrillItem['visual'], { type: 'transfers' }>['rows'] = Array.from({ length: n }, (_, i) => ({
      from: genAddress(rng, 'xrp', 'account'),
      to: H,
      value: amountList[i],
      asset: 'XRP',
      memo: String(tagList[i]),
      method: 'Payment',
      time: base + rng.int(0, 2) * 86400 + rng.int(-3 * 3600, 3 * 3600),
      toLabel: `${ex} (adresse partagée)`,
    }))
    const k = rng.int(0, n - 1)
    const clue = rng.chance(0.5) ? 'sender' : 'amount'
    let context: string
    let explainClue: string
    if (clue === 'sender') {
      const suspect = rows[k].from
      context = `L'exploitation du téléphone du suspect montre qu'il contrôle l'adresse ${suspect}. Il a déposé des XRP chez ${ex}.`
      explainClue = `La ligne émise par l'adresse du suspect (${shortAddr(suspect, 6)}) porte le tag ${tagList[k]}.`
      if (rng.chance(0.45)) {
        // Le même suspect envoie aussi vers un autre service : tag sans intérêt pour cette réquisition.
        const other = genAddress(rng, 'xrp', 'account')
        rows.push({ from: suspect, to: other, value: Math.round(rng.float(50, 5000)), asset: 'XRP', memo: String(tagList[n]), method: 'Payment', time: rows[k].time! + rng.int(3600, 20000), toLabel: 'Autre service (non attribué)' })
        explainClue += ` Le suspect a aussi envoyé des XRP avec le tag ${tagList[n]}, mais vers une autre adresse que celle de ${ex} : ce tag concerne un autre service et ne sert à rien dans la réquisition à ${ex}.`
      }
    } else {
      context = `La victime explique avoir envoyé ${frMax(amountList[k])} XRP le ${frDate(rows[k].time!)} vers le compte ${ex} que lui avait indiqué l'escroc. Elle a perdu l'accès à son portefeuille et ne connaît pas son adresse.`
      explainClue = `Le seul dépôt de ${frMax(amountList[k])} XRP, le ${frDate(rows[k].time!)}, porte le tag ${tagList[k]}.`
    }
    rng.shuffle(rows)
    rows.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
    return {
      prompt: `Quel destination tag faut-il communiquer à ${ex} ? (saisissez uniquement le nombre)`,
      context,
      visual: { type: 'transfers', chain: 'xrp', rows },
      kind: 'text',
      answer: String(tagList[k]),
      explain:
        `${explainClue}\n\n` +
        `Toutes ces opérations arrivent sur la même adresse ${shortAddr(H, 6)} : c'est l'adresse partagée de ${ex}, qui reçoit les dépôts de tous ses clients. Le destination tag est le numéro qui indique à l'exchange quel compte créditer — l'équivalent d'une référence de virement. Sans lui, ${ex} ne peut pas dire à quel client appartient un dépôt.\n\n` +
        `Dans la réquisition : adresse de destination + destination tag + hash de la transaction + date et montant. Un tag « proche » ou celui d'une autre ligne désignerait un autre client — attention aux erreurs de recopie sur ces longs nombres.`,
    }
  },
}

