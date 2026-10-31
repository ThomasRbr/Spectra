import { World, type Tx } from '../engine/world'
import { bridge, coinjoin, dex, exchange, privacyPool, HOUR, DAY, type BridgeKit } from '../engine/patterns'
import { aggregator, safeExec } from '../engine/defi'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const MIN = 60
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const r2 = (v: number) => Math.round(v * 100) / 100
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const musd = (v: number) => `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M$`
const btc8 = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} BTC`

/** Dénominations standard d'un CoinJoin de type Wasabi 2 (puissances de 2 en satoshis). */
const DENOMS = [5.36870912, 10.73741824, 21.47483648]
const PREMIX_EXTRA = 0.0003
const POOL_DENOM = 100

/**
 * Date de l'affaire : premier semestre 2024, quand le coordinateur CoinJoin
 * zkSNACKs fonctionnait encore. Calculée depuis la graine (déterministe).
 */
function caseStart(seed: number): number {
  const s = Math.abs(Math.trunc(seed))
  return 1704067200 + (12 + (s % 105)) * 86400 + (7 + (s % 11)) * 3600 + (s % 3000)
}

/** Bridge ETH → BTC : départ en ETH vers le contrat, arrivée en vraie transaction UTXO payée par la réserve du bridge. */
function bridgeToBtc(w: World, br: BridgeKit, nonce: { n: number }, o: { from: string; value: number; time: number; recipient: string }): { outTx: Tx; inTx: Tx; received: number } {
  const r = w.rng
  const reserve = br.contract('btc')
  const outTx = w.transfer({ time: o.time, from: o.from, to: br.contract('eth'), value: o.value, asset: 'ETH', method: 'bridgeOut', tags: ['bridge'] })
  const received = r8(fromUsd('BTC', usd('ETH', o.value) * (1 - r.float(0.001, 0.004))))
  const inTx = w.utxoTx({ time: o.time + r.int(4, 25) * MIN, from: [reserve], to: [{ address: o.recipient, value: received }], change: reserve, tags: ['bridge'], method: 'bridgeIn' })
  const n = ++nonce.n
  outTx.bridge = { direction: 'out', otherChain: 'btc', otherTx: inTx.id, nonce: n, recipient: o.recipient }
  inTx.bridge = { direction: 'in', otherChain: 'eth', otherTx: outTx.id, nonce: n, recipient: o.recipient }
  return { outTx, inTx, received }
}

export const ethBridgeValidateurs: ScenarioTemplate = {
  id: 'bridge-validateurs',
  title: 'Cinq clés sur neuf',
  tagline: 'Un bridge vidé avec les clés de ses propres validateurs, découvert des jours plus tard : course contre le blanchiment.',
  description:
    'Le contrat de garde de Nexus Bridge, protégé par 5 signatures de validateurs sur 9, est vidé de son ETH et de son USDC. L\'attaquant convertit aussitôt l\'USDC gelable, passe une partie par un pool de confidentialité, une autre vers Bitcoin puis dans des CoinJoin, et commet une erreur sur une plateforme régulée. Reconstituez les flux, expliquez les choix de l\'attaquant et chiffrez ce qui reste saisissable.',
  difficulty: 4,
  chains: ['eth', 'btc'],
  skills: ['evm', 'tokens', 'dex', 'defi', 'bridge', 'crosschain', 'privacy', 'coinjoin', 'gel'],
  estMinutes: 60,
  lessons: ['affaire-ronin', 'bridges', 'privacy-pools', 'blanchiment-defi'],
  generate(seed) {
    const w = new World(seed, caseStart(seed))
    const r = w.rng
    const T = w.at(0)

    // ── Acteurs ─────────────────────────────────────────────────────────────
    const nexus = w.entity('nexusbridge')
    const hk = w.customEntity({ name: 'Attaquant de Nexus Bridge (non identifié)', category: 'hack' })
    const uni = dex(w, 'uniswap', 'eth')
    const agg = aggregator(w, 'oneinch', 'eth', uni)
    const pp = privacyPool(w, 'tornado', 'eth')
    const br = bridge(w, 'arcbridge')
    const exKey = r.pick(['binance', 'okx', 'kraken', 'coinbase'] as const)
    const ex = exchange(w, exKey, 'eth')
    w.entity('circle')
    const cto = fakePerson(r)
    const handle = fakeHandle(r)
    const nonce = { n: r.int(400000, 900000) }

    const vault = w.addr('eth', { entity: nexus, label: 'Nexus Bridge : contrat de garde (Ethereum)', contract: { name: 'Nexus Bridge Vault (5 signatures sur 9)', type: 'bridge', verified: true } })
    const comms = w.addr('eth', { entity: nexus, label: 'Nexus Bridge — Adresse officielle' })

    // ── Vie normale du bridge : dépôts des joueurs, retraits signés ──────────
    w.fundAccount(vault, roundAsset('ETH', r.float(40000, 60000)), 'ETH', T - r.int(200, 300) * DAY)
    w.fundAccount(vault, roundAsset('USDC', r.float(3e7, 5e7)), 'USDC', T - r.int(200, 300) * DAY)
    for (let i = 0; i < r.int(14, 20); i++) {
      const u = w.addr('eth')
      const as = r.chance(0.6) ? 'ETH' : 'USDC'
      const v = as === 'ETH' ? r2(r.float(0.2, 60)) : r2(r.float(200, 80000))
      const t = T - Math.round(r.float(0.5, 20) * DAY)
      w.fundAccount(u, roundAsset(as, v * 1.02), as, t - r.int(1, 48) * HOUR)
      w.transfer({ time: t, from: u, to: vault, value: v, asset: as, method: 'depositFor', tags: ['bridge'] })
    }
    const relayer = w.addr('eth', { entity: nexus, label: 'Nexus Bridge — Relais des validateurs' })
    for (let i = 0; i < r.int(8, 12); i++) {
      const as = r.chance(0.6) ? 'ETH' : 'USDC'
      const v = as === 'ETH' ? r2(r.float(0.2, 40)) : r2(r.float(200, 60000))
      safeExec(w, { safe: vault, executor: relayer, to: w.addr('eth'), value: v, asset: as, time: T - Math.round(r.float(0.3, 20) * DAY), signers: 5 })
    }

    // ── Préparation : gas de l'attaquant retiré de Tornado Cash ─────────────
    const H0 = w.addr('eth', { entity: hk })
    const gasTx = pp.withdraw(H0, 1, T - Math.round(r.float(1, 4) * DAY), true)

    // ── Le vol : deux retraits signés par 5 clés de validateurs ─────────────
    const stolenEth = r.int(140, 260) * 100
    const stolenUsdc = r.int(80, 220) * 100000
    const d1 = safeExec(w, { safe: vault, executor: H0, to: H0, value: stolenEth, asset: 'ETH', time: T, signers: 5 })
    const d2 = safeExec(w, { safe: vault, executor: H0, to: H0, value: stolenUsdc, asset: 'USDC', time: T + r.int(2, 9) * MIN, signers: 5 })
    d1.tags.push('hack')
    d2.tags.push('hack')
    const stolenUsd = usd('ETH', stolenEth) + usd('USDC', stolenUsdc)

    // ── Conversion immédiate de l'USDC (gelable) en ETH via 1inch ───────────
    const swapT = d2.time + r.int(8, 40) * MIN
    const sw = agg.swap({ trader: H0, route: ['USDC', 'ETH'], amountIn: stolenUsdc, time: swapT })
    const swapOut = sw.amountOut

    // ── Découverte du piratage (plusieurs jours plus tard) ──────────────────
    const discDays = r.int(4, 7)
    const discT = T + discDays * DAY + r.int(2, 10) * HOUR
    const bounty = w.transfer({ time: discT + r.int(3, 10) * HOUR, from: comms, to: H0, value: 0.0001, asset: 'ETH', method: 'transfer + message', memo: 'Nexus Bridge security: contact us to discuss the return of the funds. Law enforcement is involved.' })
    for (let i = 0; i < r.int(2, 4); i++) {
      w.transfer({ time: discT + Math.round(r.float(1, 48) * HOUR), from: w.addr('eth'), to: H0, value: roundAsset('ETH', r.float(0.0001, 0.004)), asset: 'ETH', method: 'transfer + message', memo: r.pick(['gm', 'return the funds', 'nice', 'everyone is watching this address']) })
    }

    // ── Dépôt maladroit sur une plateforme régulée (via une adresse relais) ─
    const E1 = w.addr('eth', { entity: hk })
    const exAmt = r.int(3, 9) * 100
    const exHopT = discT + Math.round(r.float(10, 40) * HOUR)
    const hopEx = w.transfer({ time: exHopT, from: H0, to: E1, value: exAmt, asset: 'ETH' })
    const exDepAmt = r2(exAmt - r.float(0.01, 0.05))
    const exRes = ex.receive(E1, exDepAmt, exHopT + Math.round(r.float(1, 6) * HOUR), { sweepDelayH: r.float(0.5, 3) })

    // ── Pool de confidentialité : dépôts de 100 ETH depuis une adresse relais ─
    const P = w.addr('eth', { entity: hk })
    const nDep = r.int(18, 30)
    const ppHopT = discT + Math.round(r.float(1, 3) * DAY)
    const hopPp = w.transfer({ time: ppHopT, from: H0, to: P, value: nDep * POOL_DENOM + 0.5, asset: 'ETH' })
    let tp = ppHopT + r.int(20, 90) * MIN
    const ppDeps: Tx[] = []
    for (let i = 0; i < nDep; i++) {
      ppDeps.push(pp.deposit(P, POOL_DENOM, tp))
      tp += r.chance(0.8) ? r.int(2, 20) * MIN : r.int(4, 14) * HOUR
    }

    // ── Passage vers Bitcoin (ArcBridge) puis CoinJoin ──────────────────────
    const B = w.addr('eth', { entity: hk })
    const btcEth = r.int(15, 30) * 100
    const btcHopT = ppHopT + Math.round(r.float(1, 3) * DAY)
    const hopBtc = w.transfer({ time: btcHopT, from: H0, to: B, value: btcEth + 0.3, asset: 'ETH' })
    const reserve = br.contract('btc')
    w.sweepInto(reserve, r8(fromUsd('BTC', usd('ETH', btcEth)) * r.float(1.6, 2.2)), T - Math.round(r.float(3, 8) * DAY))
    const Xb = w.addr('btc', { entity: hk, kind: 'p2wpkh' })
    const half = Math.round(btcEth * r.float(0.4, 0.6) / 10) * 10
    const b1 = bridgeToBtc(w, br, nonce, { from: B, value: half, time: btcHopT + Math.round(r.float(1, 5) * HOUR), recipient: Xb })
    const b2 = bridgeToBtc(w, br, nonce, { from: B, value: btcEth - half, time: b1.outTx.time + Math.round(r.float(2, 9) * HOUR), recipient: Xb })
    const btcIn = r8(b1.received + b2.received)

    const splitT = b2.inTx.time + Math.round(r.float(4, 20) * HOUR)
    const D = DENOMS.find((d) => Math.floor((btcIn * 0.85) / (d + PREMIX_EXTRA)) <= 16) ?? DENOMS[DENOMS.length - 1]
    const m = Math.max(3, Math.floor((btcIn * 0.85) / (D + PREMIX_EXTRA)))
    const premix = w.addrs('btc', m, { entity: hk, kind: 'p2wpkh' })
    const toxic = w.addr('btc', { entity: hk, kind: 'p2wpkh' })
    const splitTx = w.utxoTx({ time: splitT, from: [Xb], to: premix.map((p) => ({ address: p, value: r8(D + PREMIX_EXTRA) })), change: toxic, fee: w.estimateFee('btc', 2, m + 1), spendAll: true, method: 'découpage pré-mix' })
    const nRounds = Math.ceil(m / 8)
    const groups: string[][] = Array.from({ length: nRounds }, () => [])
    premix.forEach((p, i) => groups[i % nRounds].push(p))
    let tc = splitT + r.float(1, 6) * HOUR
    const cjs: Tx[] = []
    for (const grp of groups) {
      const extra = r.int(5, 9)
      cjs.push(coinjoin(w, { chain: 'btc', time: Math.round(tc), denom: D, participants: grp.map((p) => ({ from: p, changeTo: null })), extra, coordinatorFee: r8(0.00002 * (grp.length + extra)) }).tx)
      tc += r.float(2, 9) * HOUR
    }

    // ── Bruit ────────────────────────────────────────────────────────────────
    uni.noise(30, T - 2 * DAY, T + 10 * DAY, [['ETH', 'USDC'], ['ETH', 'USDT']])
    pp.noise(POOL_DENOM, r.int(18, 28), T - 10 * DAY, tp + 5 * DAY)
    pp.noise(1, r.int(8, 14), T - 10 * DAY, tp + 5 * DAY)
    ex.noise(12, T - 2 * DAY, tp + 4 * DAY)
    for (let i = 0; i < r.int(5, 8); i++) {
      const u = w.addr('eth')
      const v = r2(r.float(1, 150))
      const tb = Math.round(r.float(btcHopT - 2 * DAY, btcHopT + 2 * DAY))
      w.fundAccount(u, roundAsset('ETH', v * 1.05), 'ETH', tb - Math.round(r.float(0.2, 2) * DAY))
      bridgeToBtc(w, br, nonce, { from: u, value: v, time: tb, recipient: w.addr('btc') })
    }
    // Leurre du forum : un retrait de 100 ETH du pool vers une adresse sans lien, peu après les dépôts
    const decoyAddr = w.addr('eth')
    const decoyW = pp.withdraw(decoyAddr, POOL_DENOM, ppDeps[nDep - 1].time + r.int(30, 150) * MIN, true)

    // ── Réponses ─────────────────────────────────────────────────────────────
    const held = roundAsset('ETH', w.balanceOf(H0, 'ETH'))
    const exName = ex.entity.name
    const totalEth = roundAsset('ETH', stolenEth + swapOut)
    const nCj = cjs.length

    return {
      world: w,
      title: 'Piratage de Nexus Bridge',
      briefing:
        `Nexus Bridge relie Ethereum au réseau d'un jeu en ligne très populaire. Côté Ethereum, les fonds des joueurs reposent dans un contrat de garde qui n'exécute un retrait que s'il porte les signatures de 5 des 9 validateurs. Le ${fmtDate(discT, false)}, un joueur qui ne parvient pas à retirer ses fonds donne l'alerte : le contrat a été vidé ${discDays} jours plus tôt. La filiale européenne de l'opérateur, établie à Paris, dépose plainte ; le parquet de Paris (section de lutte contre la cybercriminalité) vous saisit des investigations sur les flux.\n\n` +
        `Le schéma rappelle des piratages de bridges publiquement documentés, dont celui du bridge Ronin en 2022 : compromission de clés de validateurs par ingénierie sociale, retraits « réguliers » du point de vue du contrat, détection tardive, puis blanchiment par pools de confidentialité, passage sur Bitcoin et CoinJoin.\n\n` +
        `Objectifs : identifier l'attaquant et chiffrer le vol, expliquer ses premières décisions, mesurer l'usage du pool de confidentialité, suivre la branche Bitcoin, trouver la plateforme régulée où des fonds peuvent être saisis, et chiffrer ce qui reste sur l'adresse de l'attaquant.`,
      evidence: [
        {
          id: 'communique', type: 'rapport', title: 'Communiqué de Nexus Bridge', date: discT + r.int(4, 12) * HOUR, author: 'Nexus Bridge — Direction',
          body:
            `Le ${fmtDate(discT, false)}, nous avons constaté que notre contrat de garde sur Ethereum (${A(w, vault)}) avait été vidé par deux retraits frauduleux exécutés le ${fmtDate(T)}. Les deux transactions portaient des signatures valides de validateurs : un attaquant a obtenu le contrôle de 5 des 9 clés.\n\n` +
            `Les dépôts et retraits du bridge sont suspendus. Nous travaillons avec les autorités et les plateformes pour bloquer les fonds. L'attaquant est invité à nous contacter.`,
        },
        {
          id: 'postmortem', type: 'rapport', title: 'Rapport d\'incident technique (version transmise aux enquêteurs)', date: discT + r.int(2, 5) * DAY, author: `${cto.name}, directeur technique de Nexus`,
          body:
            `• Quatre des neuf clés de validateurs étaient opérées par nos équipes sur la même infrastructure. Un ingénieur a reçu une offre d'emploi très attractive ; le document « d'offre » piégé a compromis son poste, puis nos serveurs de signature.\n` +
            `• La cinquième signature provient d'un validateur partenaire : une autorisation temporaire, accordée lors d'un pic de charge, permettait à notre infrastructure de signer en son nom. Elle n'avait jamais été révoquée.\n` +
            `• Aucune alerte n'existait sur le volume des retraits : deux retraits d'un montant exceptionnel sont passés inaperçus pendant ${discDays} jours.\n` +
            `• Le contrat de garde vérifie les signatures concaténées dans le champ « signatures » de l'appel (65 octets par signature).`,
        },
        {
          id: 'alerte', type: 'rapport', title: 'Alerte d\'un partenaire d\'analyse de la chaîne', date: tc + Math.round(r.float(6, 30) * HOUR), author: 'Cellule d\'analyse partenaire',
          body:
            `Suivi de l'adresse de l'attaquant de Nexus Bridge : après la conversion des stablecoins, une partie des fonds a transité par Tornado Cash par dépôts successifs depuis une adresse relais, et une autre a été envoyée vers Bitcoin par ArcBridge, depuis une seconde adresse relais. Côté Bitcoin, les arrivées ont été découpées puis engagées dans des CoinJoin (coordinateur zkSNACKs).\n\n` +
            `Typologie compatible avec celle de groupes liés à un État publiquement documentée, sans élément d'attribution à ce stade.`,
        },
        {
          id: 'parquet', type: 'note', title: 'Instructions du parquet (extrait)', date: discT + r.int(1, 3) * DAY, author: 'Parquet de Paris — section cybercriminalité',
          body:
            `Priorités : 1) quantifier le préjudice par actif ; 2) identifier toute plateforme régulée ayant reçu des fonds issus du vol, en vue d'une saisie pénale de la créance du titulaire du compte ; 3) déterminer ce qui demeure sur les adresses contrôlées par l'attaquant, en vue d'un signalement aux émetteurs et plateformes ; 4) documenter les passages par des services de confidentialité, sans conclure au-delà de ce que les flux établissent.`,
        },
        {
          id: 'forum', type: 'forum', title: 'Message d\'un « détective » sur un réseau social', date: decoyW.time + r.int(2, 10) * HOUR, author: `@${handle}`,
          body:
            `Je tiens le pirate de Nexus : une heure après ses derniers dépôts de 100 ETH dans Tornado, 100 ETH ressortent vers ${A(w, decoyAddr)}. Même montant, même heure, c'est lui. Il faut geler cette adresse !`,
        },
      ],
      seeds: [vault],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: 'Quelle est l\'adresse de l\'attaquant, bénéficiaire des retraits frauduleux ?',
          answer: [H0],
          hint: 'Parmi les sorties du contrat de garde à la date indiquée par le communiqué, deux retraits sont sans commune mesure avec les autres.',
          explanation: `${A(w, H0)} reçoit les deux retraits du ${fmtDate(T)}, exécutés par elle-même (c'est elle qui signe la transaction et paie le gas) avec les signatures des validateurs. Son gas venait d'un retrait de 1 ETH de Tornado Cash quelques jours plus tôt (${gasTx.hash.slice(0, 12)}…) : préparation classique pour ne laisser aucune origine identifiable.`,
        },
        {
          id: 'o2', type: 'amount', points: 6, unit: 'ETH', tolerance: 0.001,
          prompt: 'Quel montant d\'ETH a été dérobé ?',
          answer: stolenEth,
          hint: 'Lisez le transfert du retrait en ETH.',
          explanation: `${amt(stolenEth, 'ETH')} (${usdFmt(usd('ETH', stolenEth))}) sortent du contrat dans ${d1.hash.slice(0, 12)}…. Le montant rond trahit une opération manuelle, à l'inverse des retraits des joueurs.`,
        },
        {
          id: 'o3', type: 'amount', points: 6, unit: 'USDC', tolerance: 0.001,
          prompt: 'Quel montant d\'USDC a été dérobé ?',
          answer: stolenUsdc,
          hint: 'Second retrait, quelques minutes après le premier : un transfert de jeton USDC.',
          explanation: `${amt(stolenUsdc, 'USDC')} sortent dans ${d2.hash.slice(0, 12)}…. Préjudice total : ${usdFmt(stolenUsd)} (${musd(stolenUsd)}), au cours affiché par l'outil.`,
        },
        {
          id: 'o4', type: 'number', points: 8,
          prompt: 'Combien de signatures de validateurs le retrait en ETH comporte-t-il ?',
          answer: 5,
          hint: 'Appel de contrat décodé : la taille du paramètre « signatures » est indiquée en octets ; le rapport technique donne la taille d\'une signature.',
          explanation: `Le paramètre « signatures » de l'appel fait 325 octets, soit 5 signatures de 65 octets (r, s, v) : exactement le seuil de 5 sur 9. Pour le contrat, le retrait est parfaitement régulier ; c'est la détention des clés qui a été compromise. Sur un bridge de ce type, la sécurité de milliards de dollars repose sur quelques clés et sur l'hygiène de ceux qui les gardent.`,
        },
        {
          id: 'o5', type: 'tx', points: 8,
          prompt: 'Quelle transaction convertit l\'USDC volé en ETH ?',
          answer: [sw.tx.id],
          hint: 'Peu après les retraits, l\'adresse de l\'attaquant appelle un agrégateur de DEX.',
          explanation: `${sw.tx.hash.slice(0, 16)}… appelle le routeur de 1inch (fonction unoswap) : ${amt(stolenUsdc, 'USDC')} partent vers le routeur puis un pool USDC/ETH, et ${amt(roundAsset('ETH', swapOut), 'ETH')} reviennent à l'attaquant, ${Math.round((swapT - d2.time) / MIN)} minutes après le vol.`,
        },
        {
          id: 'o6', type: 'choice', points: 8,
          prompt: 'Pourquoi l\'attaquant convertit-il l\'USDC aussi vite, avant même que le vol soit découvert ?',
          ...choice(r,
            'Circle, émetteur de l\'USDC, peut bloquer une adresse et figer ses jetons ; l\'ETH n\'a pas d\'émetteur capable de le geler',
            [
              'Pour payer moins de frais de gas lors des transferts suivants',
              'Parce qu\'un pool de confidentialité n\'accepte que l\'USDC converti par un agrégateur',
              'Pour faire baisser le cours de l\'USDC et racheter moins cher plus tard',
            ]),
          hint: 'Quelle entité a le pouvoir d\'agir sur un solde d\'USDC ?',
          explanation: `Un stablecoin centralisé comme l'USDC comporte une liste noire : sur demande des autorités, l'émetteur peut geler une adresse. L'attaquant s'en prémunit en convertissant immédiatement en ETH, natif et sans émetteur, par un DEX ou un agrégateur qui n'exige aucun compte. Leçon pour l'enquêteur : quand un vol comprend des stablecoins, la demande de gel à l'émetteur est la première démarche, et elle se joue en minutes.`,
        },
        {
          id: 'o7', type: 'number', points: 10,
          prompt: 'Combien de dépôts l\'attaquant effectue-t-il dans le pool de confidentialité ?',
          answer: nDep,
          hint: 'Après la découverte du vol, une adresse relais reçoit un montant multiple de 100 ETH, puis le dépose par tranches dans Tornado Cash.',
          explanation: `L'adresse relais ${A(w, P).slice(0, 12)}… reçoit ${amt(nDep * POOL_DENOM + 0.5, 'ETH')} et effectue ${nDep} dépôts dans le pool, soit ${amt(nDep * POOL_DENOM, 'ETH')}. Les retraits correspondants, vers des adresses neuves et souvent via un relayeur, ne peuvent pas être reliés aux dépôts par les montants : tous sont identiques.`,
        },
        {
          id: 'o8', type: 'number', points: 6, unit: 'ETH',
          prompt: 'Quelle est la dénomination (en ETH) du pool utilisé ?',
          answer: POOL_DENOM,
          hint: 'Lisez l\'étiquette du contrat qui reçoit les dépôts, ou le montant de chacun.',
          explanation: `Pool de ${POOL_DENOM} ETH, la plus grosse dénomination de Tornado Cash : chaque dépôt est indiscernable des autres. Le message du forum illustre l'erreur à éviter : un retrait de 100 ETH « une heure après » ne prouve rien, des dizaines d'utilisateurs ayant déposé et retiré la même dénomination dans la même fenêtre. Seules des erreurs opérationnelles (adresse de retrait réutilisée, regroupement des retraits) permettent parfois un rapprochement, à présenter comme une présomption.`,
        },
        {
          id: 'o9', type: 'address', points: 10,
          prompt: 'Sur quelle adresse Bitcoin arrivent les fonds passés par ArcBridge ?',
          answer: [Xb],
          hint: 'Une seconde adresse relais envoie de l\'ETH vers le contrat d\'ArcBridge : l\'événement du bridge (destinataire, nonce) ouvre la transaction d\'arrivée sur Bitcoin.',
          explanation: `${A(w, B).slice(0, 12)}… envoie ${amt(half, 'ETH')} puis ${amt(btcEth - half, 'ETH')} vers ArcBridge ; les deux arrivées (${btc8(b1.received)} et ${btc8(b2.received)}) créditent ${A(w, Xb)}. Les fonds y sont découpés en ${m} UTXO de ${btc8(D)} + marge (rendu de ${btc8(splitTx.outputs.find((o) => o.address === toxic)!.value)}), puis engagés dans ${nCj > 1 ? `${nCj} CoinJoin` : 'un CoinJoin'}. Au-delà, sans erreur post-mix, la piste s'arrête : on documente la sortie vers le CoinJoin et on surveille le rendu non mixé.`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme régulée l\'attaquant commet-il l\'erreur de déposer des fonds ?',
          answer: [exKey],
          hint: 'Après la découverte, l\'adresse de l\'attaquant envoie quelques centaines d\'ETH à une adresse relais, qui les dépose aussitôt sur une adresse étiquetée.',
          explanation: `${A(w, E1).slice(0, 12)}… reçoit ${amt(exAmt, 'ETH')} de l'attaquant et dépose ${amt(exDepAmt, 'ETH')} sur une adresse de dépôt de ${exName}, balayée vers son portefeuille chaud. Un seul saut depuis une adresse publiquement signalée : l'alerte de conformité de la plateforme est quasi certaine. ${procedureFor(ex.entity)} Le compte est gelé ; la saisie pénale porte sur la créance du titulaire envers la plateforme, et son KYC devient une piste d'identification.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt citerez-vous à cette plateforme ?',
          answer: [exRes.deposit],
          hint: 'Adresse étiquetée « Adresse de dépôt », alimentée par l\'adresse relais.',
          explanation: `${A(w, exRes.deposit)} reçoit ${amt(exDepAmt, 'ETH')} le ${fmtDate(exRes.tx.time)} (transaction ${exRes.tx.hash.slice(0, 12)}…). Sur Ethereum, chaque client a son adresse de dépôt : elle désigne un compte unique.`,
        },
        {
          id: 'o12', type: 'amount', points: 10, unit: 'ETH', tolerance: 0.005,
          prompt: 'Combien d\'ETH restent sur l\'adresse de l\'attaquant à la fin de la période étudiée ?',
          answer: held,
          hint: 'Solde de l\'adresse principale : ETH volé + ETH issu de la conversion + apports, moins les envois vers les trois adresses relais.',
          explanation: `${amt(stolenEth, 'ETH')} volés + ${amt(roundAsset('ETH', swapOut), 'ETH')} issus de l'USDC + 1 ETH de gas et quelques messages entrants, moins ${amt(exAmt, 'ETH')} (plateforme), ${amt(nDep * POOL_DENOM + 0.5, 'ETH')} (pool) et ${amt(btcEth + 0.3, 'ETH')} (Bitcoin) : il reste ${amt(held, 'ETH')} (${usdFmt(usd('ETH', held))}), soit l'essentiel du butin. Ces fonds sont identifiés, immobiles et signalés : toute sortie vers un service régulé déclenchera une alerte. Comme dans l'affaire Ronin, l'attaquant blanchit lentement, par tranches.`,
        },
      ],
      truth: {
        path: [gasTx.id, d1.id, d2.id, sw.tx.id, bounty.id, hopEx.id, exRes.tx.id, ...(exRes.sweep ? [exRes.sweep.id] : []), hopPp.id, ...ppDeps.map((x) => x.id), hopBtc.id, b1.outTx.id, b1.inTx.id, b2.outTx.id, b2.inTx.id, splitTx.id, ...cjs.map((x) => x.id)],
        addresses: [H0, E1, exRes.deposit, P, B, Xb, toxic, ...premix],
        debrief:
          `1. Préparation : ${A(w, H0)} reçoit 1 ETH de Tornado Cash. Les clés de 5 validateurs sur 9 ont été obtenues : quatre par un faux recrutement visant un ingénieur, la cinquième par une délégation de signature jamais révoquée.\n` +
          `2. Vol, le ${fmtDate(T)} : ${amt(stolenEth, 'ETH')} et ${amt(stolenUsdc, 'USDC')} (${musd(stolenUsd)}) sortent du contrat de garde par deux appels porteurs de 5 signatures.\n` +
          `3. ${Math.round((swapT - d2.time) / MIN)} minutes plus tard, l'USDC est converti en ${amt(roundAsset('ETH', swapOut), 'ETH')} via 1inch, hors de portée d'un gel de Circle. Le vol n'est découvert que ${discDays} jours après.\n` +
          `4. Blanchiment par tranches : ${nDep} dépôts de ${POOL_DENOM} ETH dans Tornado Cash depuis ${A(w, P).slice(0, 12)}… ; ${amt(btcEth, 'ETH')} vers Bitcoin par ArcBridge (arrivée ${A(w, Xb).slice(0, 14)}…), découpés en ${m} UTXO puis mixés dans ${nCj} CoinJoin.\n` +
          `5. Erreur : ${amt(exDepAmt, 'ETH')} déposés chez ${exName} (${A(w, exRes.deposit).slice(0, 12)}…) via un seul relais : gel et saisie possibles.\n` +
          `6. ${amt(held, 'ETH')} restent sur l'adresse de l'attaquant (${amt(totalEth, 'ETH')} détenus après conversion).\n\n` +
          `À retenir : un bridge à validateurs est aussi sûr que la garde de ses clés ; le contrat ne voit qu'un retrait régulier. Côté enquête, l'ordre des démarches compte : gel des stablecoins chez l'émetteur dans les minutes, signalement des adresses aux plateformes, puis suivi patient d'un attaquant qui blanchit par tranches. Les pools de confidentialité et les CoinJoin cassent le lien on-chain ; un rapprochement « même montant, même heure » n'est pas une preuve. Ce sont les erreurs opérationnelles (dépôt sur une plateforme régulée) qui ouvrent la voie à la saisie et à l'identification. L'attribution à un groupe étatique, enfin, ne se déduit pas des flux.`,
      },
      hints: [
        'Partez du contrat de garde : ses sorties du jour des faits désignent l\'attaquant.',
        'Dans l\'appel décodé d\'un retrait, la taille du paramètre « signatures » donne le nombre de validateurs (65 octets chacun).',
        'L\'adresse de l\'attaquant alimente trois adresses relais, chacune avec un rôle : une plateforme, un pool, un bridge.',
        'Sur la transaction de départ vers ArcBridge, l\'événement du bridge permet d\'ouvrir directement la transaction d\'arrivée sur Bitcoin.',
        'Le solde restant se lit dans l\'onglet de l\'adresse principale ; vérifiez-le en refaisant le compte des entrées et sorties.',
      ],
    }
  },
}
