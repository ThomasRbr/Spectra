import { World, type Tx } from '../engine/world'
import { bridge, dex, exchange, swapper, roundCoin, HOUR, DAY, type SwapperKit } from '../engine/patterns'
import { roundAsset, usd, fromUsd, CHAINS, type AssetId, type ChainId } from '../engine/chains'
import { decoyBranches, dusting, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakeName, fmtDate, procedureFor } from './util'

/**
 * Commande d'échangeur instantané depuis Bitcoin (équivalent de
 * `SwapperKit.order`, mais le rapatriement du dépôt vers le hot wallet passe
 * des frais explicites : sinon `utxoTx` recalcule des frais aléatoires
 * supérieurs au solde et « auto-finance » l'adresse de dépôt avec des
 * poussières venues de nulle part).
 */
function btcOrder(
  w: World,
  sw: SwapperKit,
  o: { from: string; value: number; time: number; toChain: ChainId; toAsset?: AssetId; recipient: string; delayMin?: [number, number]; feePct?: number; decoys?: number },
): { deposit: string; depositTx: Tx; sweepTx: Tx; payoutTx: Tx; payoutValue: number } {
  const r = w.rng
  const toAsset = o.toAsset ?? CHAINS[o.toChain].native
  const deposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
  const depositTx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }] })
  const fee = w.estimateFee('btc', 1, 1)
  const sweepTx = w.utxoTx({ time: o.time + r.int(120, 1200), from: [deposit], to: [{ address: sw.hot('btc'), value: w.unspentValue(deposit) - fee }], fee, change: null, spendAll: true, tags: ['sweep'] })
  const feePct = o.feePct ?? r.float(0.006, 0.02)
  const [dmin, dmax] = o.delayMin ?? [6, 45]
  const payT = o.time + r.int(dmin, dmax) * 60
  const payoutValue = roundAsset(toAsset, fromUsd(toAsset, usd('BTC', o.value) * (1 - feePct)))
  const pay = (to: string, value: number, time: number) => w.transfer({ time, from: sw.hot(o.toChain), to, value, asset: toAsset, method: 'payout' })
  const payoutTx = pay(o.recipient, payoutValue, payT)
  const nd = o.decoys ?? r.int(4, 9)
  for (let i = 0; i < nd; i++) {
    const close = r.chance(0.35)
    const v = close ? payoutValue * r.float(0.88, 1.12) : fromUsd(toAsset, r.float(40, usd(toAsset, payoutValue) * 3 + 200))
    pay(w.addr(o.toChain), roundAsset(toAsset, v), payT + r.int(-2 * 3600, 3 * 3600))
  }
  return { deposit, depositTx, sweepTx, payoutTx, payoutValue }
}

const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

export const accChainHopping: ScenarioTemplate = {
  id: 'chain-hopping',
  title: 'Chain hopping : BTC → ETH → BSC → Monero',
  tagline: 'Échangeur instantané, bridge, DEX, branches et jumeaux : trois chaînes, une seule piste, et une sortie vers Monero.',
  description:
    'Les bitcoins d\'une escroquerie au faux placement sont convertis en ETH via un échangeur instantané, bridgés vers BNB Smart Chain et échangés en USDT. Là, le réseau éclate les fonds en plusieurs branches et en transferts jumeaux de même montant ; une seule branche repart, un à deux jours plus tard, chez le même échangeur pour être convertie en Monero. Le saut BTC → ETH ne laisse aucun lien on-chain et plusieurs paiements de l\'échangeur lui ressemblent : il faut trancher par des indices vérifiables.',
  difficulty: 3,
  chains: ['btc', 'eth', 'bsc'],
  skills: ['crosschain', 'bridge', 'dex', 'tokens', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 75,
  lessons: ['chain-hopping', 'bridges', 'dex-defi', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const handle = fakeHandle(r)

    const sw = swapper(w, 'changenow')
    const br = bridge(w, 'arcbridge')
    const cake = dex(w, 'pancakeswap', 'bsc')
    const ex2Key = r.pick(['kraken', 'coinbase', 'bitstamp'] as const)
    const ex2 = exchange(w, ex2Key, 'eth')
    const bscEx = exchange(w, r.pick(['binance', 'okx'] as const), 'bsc')

    const suspect = w.customEntity({ name: 'Réseau « BitFortune Capital » (inconnu)', category: 'suspect' })
    const s0 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })

    // ── Collecte : les plaignants, plus deux versements jamais déclarés ──────
    const nV = r.int(3, 5)
    const victims: { name: string; addr: string; tx: string; hash: string; value: number }[] = []
    for (let i = 0; i < nV; i++) {
      const name = fakeName(r)
      const va = w.addr('btc', { entity: w.customEntity({ name, category: 'victim' }), kind: 'p2wpkh' })
      const value = roundCoin(w, 0.08, 0.45, 0.001)
      const tx = w.fund(s0, value, w.at(-r.float(2, 12) * 24 + i), { from: [va] })
      victims.push({ name, addr: va, tx: tx.id, hash: tx.hash, value })
    }
    const collected = roundAsset('BTC', victims.reduce((s, v) => s + v.value, 0))
    const hiddenE = () => w.customEntity({ name: 'Victime non déclarée', category: 'victim' })
    const hbVa = w.addr('btc', { entity: hiddenE(), kind: r.pick(['p2wpkh', 'p2sh'] as const) })
    const hbValue = roundCoin(w, 0.05, 0.3, 0.001)
    const hbTx = w.fund(s0, hbValue, w.at(-r.float(0.5, 1.6) * 24), { from: [hbVa] })

    // ── Commande ChangeNOW : BTC → ETH, payée sur une adresse neuve ──────────
    const e1 = w.addr('eth', { entity: suspect })
    const orderValue = roundAsset('BTC', (collected + hbValue) * r.float(0.95, 0.985))
    const orderT = w.at(r.float(2, 10))
    const ord = btcOrder(w, sw, { from: s0, value: orderValue, time: orderT, toChain: 'eth', recipient: e1, feePct: r.float(0.006, 0.012), delayMin: [8, 40] })
    const depositUsd = usd('BTC', orderValue)
    // Versement tardif d'une victime non déclarée : il arrive après le départ des fonds et dort sur l'adresse de collecte.
    const haVa = w.addr('btc', { entity: hiddenE(), kind: 'p2wpkh' })
    const haValue = roundCoin(w, 0.03, 0.2, 0.001)
    const haTx = w.fund(s0, haValue, orderT + Math.round(r.float(20, 60) * HOUR), { from: [haVa] })
    const received = roundAsset('BTC', collected + hbValue + haValue)

    // Paiements ChangeNOW sosies, dans la même fenêtre que le vrai paiement
    const tLook = (k: number) => Math.max(ord.depositTx.time + 5 * 60 + k * 60, ord.payoutTx.time + r.int(-30, 30) * 60)
    const lk1Addr = w.addr('eth')
    const lk1Value = roundAsset('ETH', fromUsd('ETH', depositUsd * r.float(1.003, 1.007)))
    const lk1 = w.transfer({ time: tLook(0), from: sw.hot('eth'), to: lk1Addr, value: lk1Value, asset: 'ETH', method: 'payout' })
    const lk2Addr = w.addr('eth')
    const lk2Value = roundAsset('ETH', ord.payoutValue * r.float(0.988, 0.994))
    const lk2 = w.transfer({ time: tLook(1), from: sw.hot('eth'), to: lk2Addr, value: lk2Value, asset: 'ETH', method: 'payout' })
    w.transfer({ time: lk2.time + Math.round(r.float(3, 20) * HOUR), from: lk2Addr, to: w.addr('eth'), value: roundAsset('ETH', lk2Value * r.float(0.95, 0.99)), asset: 'ETH' })

    // ── ETH → ArcBridge vers BSC (l'ETH devient du BNB) ─────────────────────
    const b1 = w.addr('bsc', { entity: suspect })
    const bridgeIn = roundAsset('ETH', ord.payoutValue * r.float(0.97, 0.99))
    const brT = ord.payoutTx.time + r.int(40, 300) * 60
    const brRes = br.send({ from: e1, value: bridgeIn, time: brT, toChain: 'bsc', recipient: b1 })
    // Reliquat d'ETH resté sur e1 : encaissé sur un exchange régulé (sortie secondaire)
    const residualEth = Math.floor(w.balanceOf(e1, 'ETH') * 1e6) / 1e6
    const dep2 = ex2.receive(e1, residualEth, brT + Math.round(r.float(6, 16) * HOUR), { asset: 'ETH' })

    // ── BSC : swap BNB → USDT, puis éclatement ───────────────────────────────
    const swapT = brRes.inTx.time + r.int(10, 90) * 60
    const swp = cake.swap({ trader: b1, assetIn: 'BNB', amountIn: roundAsset('BNB', brRes.received * r.float(0.94, 0.97)), assetOut: 'USDT', time: swapT })
    const usdtGot = swp.amountOut
    const b2 = w.addr('bsc', { entity: suspect })
    const Rb = Math.floor((usdtGot * r.float(0.42, 0.52)) / 100) * 100
    const tD = swapT + r.int(40, 110) * 60
    const realTx = w.transfer({ time: tD, from: b1, to: b2, value: Rb, asset: 'USDT' })
    const gasTx = w.transfer({ time: tD + r.int(2, 9) * 60, from: b1, to: b2, value: roundAsset('BNB', Math.min(w.balanceOf(b1, 'BNB') * 0.5, 0.03)), asset: 'BNB' })
    // Transferts jumeaux : montants ronds voisins (comme le vrai : le montant ne trahit rien), même heure,
    // chacun précédé d'un apport extérieur exactement du même montant (l'indice décisif, exposé dans l'explication)
    const twins = {
      txs: [-1, 1].map((sg) => {
        const v = Math.round((Rb * (1 + sg * r.float(0.002, 0.006))) / 100) * 100
        const value = v === Rb ? Rb + sg * 100 : v
        const t = tD + r.int(-25, 25) * 60
        w.fundAccount(b1, value, 'USDT', t - r.int(10, 50) * 60)
        return w.transfer({ time: t, from: b1, to: w.addr('bsc'), value, asset: 'USDT' })
      }),
    }
    // Branches sans issue avec le reste des USDT (dort / dépensée / retour / ré-éclatée)
    const branches = decoyBranches(w, b1, { time: tD + r.int(25, 60) * 60, share: 0.88, branches: 3, asset: 'USDT', returnTo: b1 })

    // ── Sortie : la branche utile repart chez ChangeNOW (USDT BEP-20 → XMR) ──
    const tFinal = tD + Math.round(r.float(24, 46) * HOUR)
    const cnDep = w.addr('bsc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const finalTx = w.transfer({ time: tFinal, from: b2, to: cnDep, value: Rb, asset: 'USDT' })
    const cnSweep = w.transfer({ time: tFinal + r.int(3, 20) * 60, from: cnDep, to: sw.hot('bsc'), value: Rb, asset: 'USDT', method: 'sweep', tags: ['sweep'] })

    // ── Habillage ────────────────────────────────────────────────────────────
    // Portefeuille de sortie BSC : vie antérieure (USDT reçus et dépensés), dépenses entre deux.
    priorHistory(w, b2, { start: w.at(-80 * 24), end: w.at(-3 * 24), nIn: 4, nOut: 3, maxUsd: 2500, asset: 'USDT' })
    // Deux petites dépenses entre la réception et le départ final (écrites à la main : cartes cadeaux puis casino)
    const giftShop = w.customEntity({ name: r.pick(['GiftNova', 'Kadoo Cards', 'VoucherBay']), category: 'merchant', known: true, description: 'Revendeur de cartes cadeaux payables en stablecoins (fictif). Conserve l\'e-mail de livraison des codes.' })
    const casino = w.customEntity({ name: r.pick(['RoyalHash Casino', 'BetNebula', 'Lucky Satoshi Club']), category: 'gambling', known: true, description: 'Casino en ligne crypto (fictif), vérification d\'identité au-delà d\'un seuil de retrait.' })
    const tSp1 = tD + Math.round(r.float(2, 8) * HOUR)
    const tSp2 = Math.round(r.float(tSp1 + HOUR, tFinal - HOUR))
    for (const [t, e] of [[tSp1, giftShop], [tSp2, casino]] as const) w.transfer({ time: t, from: b2, to: w.addr('bsc', { entity: e, label: `${e.name} — Paiement` }), value: roundAsset('USDT', r.float(25, 220)), asset: 'USDT' })
    // Poussière et empoisonnement d'adresse
    dusting(w, s0, { time: orderT + 12 * HOUR, n: 2, spreadH: 30 })
    dusting(w, e1, { time: ord.payoutTx.time + 3 * HOUR, n: 2, spreadH: 6 })
    dusting(w, b1, { time: tD + 4 * HOUR, n: 1, spreadH: 3 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    // Autres clients de ChangeNOW (BTC → ETH / Tron), étalés sur plusieurs jours
    for (let i = 0; i < r.int(4, 6); i++) {
      const c = w.addr('btc')
      const v = roundCoin(w, 0.02, 1.2, 0.0001)
      const tOrd = w.at(r.float(-3, 5) * 24)
      w.fund(c, v * 1.05, tOrd - r.int(2, 48) * HOUR)
      const toChain = r.pick(['eth', 'eth', 'tron'] as const)
      btcOrder(w, sw, { from: c, value: v, time: tOrd, toChain, toAsset: toChain === 'tron' ? 'USDT' : undefined, recipient: w.addr(toChain), decoys: r.int(1, 3) })
    }
    // Paiements ChangeNOW sur ETH à des montants proches, en dehors de la fenêtre
    for (let i = 0; i < 4; i++) {
      const dt = r.pick([-1, 1]) * r.float(4, 30) * HOUR
      w.transfer({ time: Math.round(ord.payoutTx.time + dt), from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', ord.payoutValue * r.float(0.97, 1.03)), asset: 'ETH', method: 'payout' })
    }
    // Autres clients de ChangeNOW qui déposent des USDT sur BSC
    for (let i = 0; i < r.int(3, 5); i++) {
      const u = w.addr('bsc')
      const t = Math.round(tFinal + r.float(-30, 30) * HOUR)
      const d = w.addr('bsc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      const v = roundAsset('USDT', r.float(300, Rb * 1.4))
      w.fundAccount(u, v, 'USDT', t - r.int(2, 72) * HOUR)
      w.transfer({ time: t, from: u, to: d, value: v, asset: 'USDT' })
      w.transfer({ time: t + r.int(3, 20) * 60, from: d, to: sw.hot('bsc'), value: v, asset: 'USDT', method: 'sweep', tags: ['sweep'] })
    }
    // Autres utilisateurs du bridge
    for (let i = 0; i < r.int(6, 10); i++) {
      const u = w.addr('eth')
      const v = roundAsset('ETH', r.float(0.3, bridgeIn * 1.5))
      const tBr = w.at(r.float(-2, 4) * 24)
      w.fundAccount(u, roundAsset('ETH', v * 1.03), 'ETH', tBr - r.float(0.2, 3) * DAY)
      const toChain = r.pick(['bsc', 'bsc', 'sol'] as const)
      br.send({ from: u, value: v, time: tBr, toChain, recipient: w.addr(toChain) })
    }
    cake.noise(30, w.at(-2 * 24), w.at(6 * 24), [['BNB', 'USDT'], ['BNB', 'USDC']])
    bscEx.noise(14, w.at(-2 * 24), w.at(6 * 24), 'USDT')
    ex2.noise(10, w.at(-2 * 24), w.at(6 * 24), 'ETH')

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const v0 = victims[0]
    const ex2Name = ex2.entity.name
    const btcChange = ord.depositTx.outputs.find((o) => o.address !== ord.deposit)!
    const feeObs = (1 - usd('ETH', ord.payoutValue) / depositUsd) * 100
    const lk2Fee = (1 - usd('ETH', lk2Value) / depositUsd) * 100
    const lk1Ratio = (usd('ETH', lk1Value) / depositUsd) * 100
    const fateTxt = (b: (typeof branches)[number]) => ({
      dort: 'n\'a plus bougé',
      dépensée: `a servi à ${b.follow.length} petits paiements`,
      retour: 'est revenue sur l\'adresse BSC de départ',
      éclatée: `a été ré-éclatée en ${b.follow.length} sous-adresses qui dorment`,
    })[b.fate]
    const swapToRealMin = Math.round((tD - swapT) / 60)
    const subAddrs = branches.flatMap((b) => (b.fate === 'éclatée' ? b.follow.map((t) => t.transfers[0].to) : []))
    const frozenable = roundAsset('USDT', [b1, ...branches.map((b) => b.address), ...subAddrs].reduce((s, a) => s + w.balanceOf(a, 'USDT'), 0))
    const twinTxt = twins.txs.map((t) => `${amt(t.transfers[0].value, 'USDT')} vers ${A(w, t.transfers[0].to).slice(0, 10)}… à ${fmtDate(t.time).split(' à ')[1] ?? ''}`).join(' et ')

    return {
      world: w,
      title: `Opération BitFortune — ${city}`,
      briefing:
        `${['Trois', 'Quatre', 'Cinq'][nV - 3]} plaintes ont été jointes : les victimes ont toutes versé des bitcoins sur la plateforme « BitFortune Capital », qui promettait des rendements de trading automatisé. Le site a fermé.\n\n` +
        `L'adresse de collecte BTC est connue. Les fonds ont quitté Bitcoin : le réseau « saute » de chaîne en chaîne (chain hopping) via un échangeur instantané et un bridge, puis éclate les fonds en plusieurs branches et en transferts de même montant pour casser le traçage.\n\n` +
        `L'échangeur instantané ne crée aucun lien on-chain entre le dépôt et le paiement : utilisez l'outil de corrélation (émetteur = le service, chaîne cible, fenêtre de temps, tolérance de montant), puis départagez les candidats par des indices vérifiables. Le bridge, lui, publie la transaction correspondante sur la chaîne de destination.\n\n` +
        `Le magistrat attend un état complet : préjudice réel (toutes victimes confondues), chaque point de sortie, ce qui reste saisissable ou gelable et les réquisitions à adresser.`,
      evidence: [
        {
          id: 'synthese', type: 'rapport', title: 'Synthèse des plaintes', date: w.at(5 * 24), author: 'Section de recherches',
          body:
            `Adresse de dépôt communiquée aux victimes par BitFortune : ${A(w, s0)}\n\n` +
            victims.map((v) => `- ${v.name} : ${amt(v.value, 'BTC')} — tx ${v.hash}`).join('\n') +
            `\n\nTotal déclaré : ${amt(collected, 'BTC')}.\n` +
            `NB : d'autres victimes n'ont peut-être pas encore porté plainte ; vérifier l'ensemble des versements reçus par l'adresse, y compris après la fermeture du site.`,
        },
        {
          id: 'plainte', type: 'plainte', title: `Plainte ${/^Y/.test(v0.name) ? `de ${v0.name}` : de(v0.name)} (extrait)`, date: w.at(3 * 24), author: v0.name,
          body: `« Mon conseiller m'a dit que mes gains étaient bloqués et qu'il fallait payer une taxe. J'ai compris que c'était une arnaque quand le site a disparu, le ${fmtDate(w.at(2 * 24), false)}. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — page « Déposer » de BitFortune', date: w.at(-10 * 24),
          body: `BitFortune Capital · Dépôt\nRéseau : Bitcoin uniquement\nAdresse : ${A(w, s0)}\nVos fonds sont crédités après 2 confirmations.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Échange Telegram saisi chez un « conseiller » (extrait)', date: w.at(6 * 24), author: 'Exploitation de téléphone',
          body:
            `— ${handle} : « Tout est passé côté BSC, converti en dollars numériques. J'ai fait plusieurs paquets, et j'ai envoyé des montants identiques un peu partout pour noyer le poisson. »\n` +
            `— « Et le gros paquet ? »\n` +
            `— ${handle} : « Je le laisse reposer un jour ou deux puis il repart chez le même échangeur qu'au début, en XMR. Là, c'est fini, personne ne suit. »\n` +
            `— « Et ce qui restait côté ETH ? »\n` +
            `— ${handle} : « Le reliquat, je l'ai mis sur mon compte perso, une plateforme américaine ou européenne, ça ira. Rien ne relie les deux. »`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o6', type: 'number', points: 8,
          prompt: 'Combien de versements reçus par l\'adresse de collecte ne correspondent à aucune plainte (poussières de 546 sats exclues) ?',
          answer: 2,
          hint: 'Comparez tous les paiements entrants de l\'adresse de collecte, jusqu\'à aujourd\'hui, avec les hash cités dans la synthèse des plaintes.',
          explanation: `Deux versements ne figurent dans aucune plainte : ${hbTx.hash.slice(0, 16)}… (${fmtDate(hbTx.time)}, ${amt(hbValue, 'BTC')}), avant le départ des fonds, et ${haTx.hash.slice(0, 16)}… (${fmtDate(haTx.time)}, ${amt(haValue, 'BTC')}), arrivé après le dépôt chez ChangeNOW : cette victime a payé alors que les fonds étaient déjà partis, et son versement dort encore sur l'adresse. Les quelques entrées de 546 sats sont de la poussière envoyée par des tiers, sans valeur ni lien avec l'escroquerie.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (BTC) les victimes ont-elles versé sur l\'adresse de collecte ?',
          answer: received,
          hint: 'Additionnez tous les versements entrants des victimes, déclarées ou non, en écartant la poussière.',
          explanation: `${amt(collected, 'BTC')} déclarés par les ${nV} plaignants + ${amt(hbValue, 'BTC')} et ${amt(haValue, 'BTC')} non déclarés = ${amt(received, 'BTC')}. C'est le préjudice minimal établi on-chain, base de la saisie et de la qualification. Le dernier versement (${amt(haValue, 'BTC')}) est toujours sur l'adresse de collecte : saisissable si la clé est retrouvée.`,
        },
        {
          id: 'o8', type: 'tx', points: 8,
          prompt: 'Quelle transaction dépose les fonds collectés chez l\'échangeur instantané ChangeNOW ?',
          answer: [ord.depositTx.id],
          hint: 'Dépliez les sorties de l\'adresse de collecte : l\'une part vers une adresse étiquetée « ChangeNOW — Adresse de dépôt ».',
          explanation: `La transaction ${ord.depositTx.hash} (${fmtDate(ord.depositTx.time)}) verse ${amt(orderValue, 'BTC')} (≈ ${usd0(depositUsd)}) sur l'adresse de dépôt ChangeNOW ${A(w, ord.deposit)}, aussitôt rapatriée vers le hot wallet BTC du service. C'est l'identifiant à fournir à ChangeNOW pour retrouver la commande, et le point de départ de la corrélation vers Ethereum.`,
        },
        {
          id: 'o9', type: 'address', points: 7,
          prompt: 'Lors de ce dépôt, une partie des bitcoins est restée aux escrocs. Sur quelle adresse (rendu) ?',
          answer: [btcChange.address],
          hint: 'La transaction de dépôt a deux sorties : le montant de la commande et le rendu.',
          explanation: `La seconde sortie (${amt(btcChange.value, 'BTC')}) part vers ${A(w, btcChange.address)}, une adresse neuve du même type que l'adresse de collecte : c'est le rendu, contrôlé par les escrocs. Ces fonds n'ont pas bougé : avoirs saisissables si la clé est retrouvée (perquisition, saisie de matériel).`,
        },
        {
          id: 'o1', type: 'address', points: 12,
          prompt: 'Quelle adresse Ethereum a reçu le paiement de ChangeNOW correspondant au dépôt BTC des escrocs ?',
          answer: [e1],
          hint: `Corrélation : émetteur ChangeNOW, chaîne Ethereum, à partir de l'heure du dépôt, fenêtre d'environ 1 h, tolérance de 2 à 3 % sur ≈ ${usd0(depositUsd)}. Plusieurs candidats sortent : vérifiez si chaque montant est possible, puis ce que devient chaque adresse.`,
          explanation: `Plusieurs paiements ChangeNOW de montant voisin tombent dans la fenêtre, dont deux très proches du bon. ${A(w, e1).slice(0, 12)}… reçoit ${amt(ord.payoutValue, 'ETH')} ${Math.round((ord.payoutTx.time - ord.depositTx.time) / 60)} minutes après le dépôt, soit une commission de ${feeObs.toFixed(1).replace('.', ',')} %, et bridge ses ETH vers BNB Smart Chain dans les heures qui suivent, ce que décrit le « conseiller » sur Telegram. Le paiement de ${amt(lk1Value, 'ETH')} à ${A(w, lk1Addr).slice(0, 12)}… représente ${lk1Ratio.toFixed(1).replace('.', ',')} % de la valeur déposée : un échangeur ne rend jamais plus qu'il ne reçoit, ce paiement correspond à un autre dépôt. Celui de ${amt(lk2Value, 'ETH')} à ${A(w, lk2Addr).slice(0, 12)}… (commission apparente ${lk2Fee.toFixed(1).replace('.', ',')} %) est plausible par le montant, mais son destinataire renvoie ses ETH vers une adresse ordinaire sur Ethereum et ne touche jamais au bridge : un autre client.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Que demander en priorité à ChangeNOW ?',
          ...choice(r,
            'Les données des commandes liées aux hash de dépôt, côté Bitcoin et côté BSC (adresses de paiement, dont l\'adresse Monero, horodatages, IP)',
            [
              'L\'identité KYC complète du client (pièce d\'identité, justificatif de domicile)',
              'Le gel des ETH déjà versés par l\'échangeur sur l\'adresse de paiement du client',
              'La clé privée de l\'adresse de dépôt, pour reprendre la main sur les fonds',
            ]),
          hint: 'Un échangeur instantané sans compte connaît les commandes, pas forcément la personne ; et il ne détient plus les fonds payés.',
          explanation: `${procedureFor(sw.entity)} ChangeNOW ne fait pas de KYC et ne peut rien geler une fois le paiement effectué. En revanche, avec les hash des dépôts (${ord.depositTx.hash.slice(0, 14)}… sur Bitcoin, ${finalTx.hash.slice(0, 14)}… sur BSC), il peut communiquer les métadonnées des deux commandes : elles confirment le lien dépôt → paiement (qui n'est qu'une corrélation), donnent l'adresse Monero de la dernière commande et parfois une IP ou un e-mail commun aux deux.`,
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'L\'adresse Ethereum fait passer ses fonds par un bridge. Quelle adresse les reçoit sur la chaîne de destination ?',
          answer: [b1],
          hint: 'Ouvrez la transaction « bridgeOut » : l\'événement du bridge indique la chaîne, le destinataire et la transaction correspondante.',
          explanation: `La transaction bridgeOut vers ArcBridge (nonce ${brRes.outTx.bridge?.nonce}) référence la transaction bridgeIn sur BNB Smart Chain : ${amt(brRes.received, 'BNB')} versés à ${A(w, b1)}. Le bridge publie la chaîne de destination, le destinataire et la transaction correspondante : ce n'est pas une rupture de traçage, même quand l'actif change (ici ETH → BNB, conversion opérée par le bridge).`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'Le reliquat d\'ETH resté sur l\'adresse Ethereum a été encaissé ailleurs. Sur quelle plateforme ?',
          answer: [ex2Key],
          hint: 'Après le bridge, l\'adresse Ethereum conserve un petit solde : suivez sa dernière transaction sortante (les micro-envois reçus d\'adresses sosies sont de l\'empoisonnement, sans intérêt).',
          explanation: `Le ${fmtDate(dep2.tx.time)}, ${A(w, e1)} vide son solde vers l'adresse de dépôt ${ex2Name} ${A(w, dep2.deposit)}, balayée ensuite vers le portefeuille chaud de la plateforme. Contrairement à ce qu'affirme le « conseiller », la même adresse Ethereum relie les deux sorties : une réquisition à ${ex2Name} pourra identifier un titulaire. ${procedureFor(ex2.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 7, unit: 'ETH', tolerance: 0.01,
          prompt: 'Quel montant d\'ETH a été déposé sur cette plateforme secondaire ?',
          answer: residualEth,
          hint: 'C\'est la différence entre l\'ETH reçu de ChangeNOW et l\'ETH envoyé dans le bridge.',
          explanation: `${amt(ord.payoutValue, 'ETH')} reçus − ${amt(bridgeIn, 'ETH')} bridgés = ${amt(residualEth, 'ETH')}, déposés en une fois chez ${ex2Name}. Montant modeste, mais il désigne un compte nominatif, peut-être ouvert sous une identité plus fragile.`,
        },
        {
          id: 'o13', type: 'address', points: 12,
          prompt: 'Après le swap sur PancakeSwap, l\'adresse BSC envoie des USDT vers de nombreuses adresses, dont trois montants quasi identiques à quelques minutes d\'écart. Quelle adresse destinataire mène au point de sortie ?',
          answer: [b2],
          hint: 'Suivez chaque destination. Regardez aussi d\'où viennent les USDT de chaque envoi : la sortie du swap, ou des apports arrivés juste avant ?',
          explanation: `${A(w, b2)} reçoit ${amt(Rb, 'USDT')} le ${fmtDate(realTx.time)}, issus du swap (${amt(usdtGot, 'USDT')} obtenus ${swapToRealMin} minutes plus tôt), plus un peu de BNB pour le gaz ; elle les dépose ${Math.round((tFinal - tD) / HOUR)} h plus tard chez ChangeNOW. Le montant ne départage rien : les trois envois sont ronds à la centaine. Les deux jumeaux (${twinTxt}) ne sont pas les fonds du swap : chacun est précédé, peu avant, d'un apport exactement du même montant venu d'une adresse tierce (le réseau fait transiter d'autres fonds pour brouiller la piste), aucun ne s'accompagne de BNB pour le gaz, et leurs destinataires n'en font rien. Les ${branches.length} autres branches (${branches.map((b) => `${amt(b.value, 'USDT')} qui ${fateTxt(b)}`).join(' ; ')}) n'atteignent aucun service de sortie.`,
        },
        {
          id: 'o3', type: 'entity', points: 9,
          prompt: 'Où la branche utile finit-elle ?',
          answer: ['changenow'],
          hint: 'Suivez la dernière sortie d\'USDT de l\'adresse identifiée à l\'étape précédente.',
          explanation: `Le ${fmtDate(finalTx.time)}, ${A(w, b2).slice(0, 12)}… dépose ${amt(Rb, 'USDT')} sur une adresse de dépôt ChangeNOW sur BSC, aussitôt balayée vers le hot wallet du service. Aucun paiement correspondant n'apparaît ensuite sur les chaînes visibles : conformément au message Telegram, la commande a été payée en Monero, chaîne opaque. Le réseau a réutilisé le même échangeur qu'au départ : une seule demande peut viser les deux commandes.`,
        },
        {
          id: 'o4', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT a été déposé chez ChangeNOW pour la conversion finale ?',
          answer: Rb,
          hint: 'C\'est le transfert de l\'adresse de sortie BSC vers l\'adresse de dépôt ChangeNOW (pas ses petits paiements intermédiaires).',
          explanation: `${amt(Rb, 'USDT')}, exactement le montant rond reçu du swap par la branche utile. Les deux petits paiements de cette adresse entre les deux (${giftShop.name}, cartes cadeaux, puis ${casino.name}, casino en ligne) sont prélevés sur ses fonds antérieurs : elle avait déjà une vie avant les faits. Ces deux commerçants sont des pistes secondaires (e-mail de livraison, compte joueur).`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quelle mesure conservatoire est la plus utile à ce stade ?',
          ...choice(r,
            `Demander à Tether de geler les USDT restés sur les adresses BSC du réseau (adresse de réception du bridge et branches dormantes)`,
            [
              'Demander à ChangeNOW de geler les USDT déposés pour la conversion finale',
              'Demander à ArcBridge d\'annuler le transfert inter-chaînes',
              'Demander à PancakeSwap de bloquer le pool BNB/USDT utilisé pour le swap',
            ]),
          hint: 'Où restent des fonds identifiés, sous quelle forme, et qui a techniquement la main dessus ?',
          explanation: `Les USDT déposés chez ChangeNOW ont été convertis en Monero et payés : l'échangeur ne détient plus rien et ne gèle pas. Un bridge ne peut pas « annuler » un transfert exécuté, et un DEX n'a pas de prise sur un pool. En revanche, environ ${amt(frozenable, 'USDT')} dorment encore sur l'adresse BSC de réception et sur les branches du réseau : l'USDT est un jeton centralisé que Tether sait geler adresse par adresse. ${procedureFor(w.entity('tether'))} En parallèle : réquisitions à ChangeNOW (deux commandes) et à ${ex2Name} (reliquat d'ETH).`,
        },
      ],
      truth: {
        path: [...victims.map((v) => v.tx), hbTx.id, ord.depositTx.id, ord.sweepTx.id, ord.payoutTx.id, brRes.outTx.id, brRes.inTx.id, swp.tx.id, realTx.id, dep2.tx.id, ...(dep2.sweep ? [dep2.sweep.id] : []), finalTx.id, cnSweep.id],
        addresses: [s0, ord.deposit, e1, b1, b2, cnDep, btcChange.address, dep2.deposit],
        debrief:
          `1. ${nV} plaignants versent ${amt(collected, 'BTC')} sur ${A(w, s0)} ; deux versements non déclarés (${amt(hbValue, 'BTC')} avant le départ des fonds, ${amt(haValue, 'BTC')} après) portent le total à ${amt(received, 'BTC')}.\n` +
          `2. Les escrocs déposent ${amt(orderValue, 'BTC')} sur une adresse de dépôt ChangeNOW (${ord.depositTx.hash.slice(0, 14)}…) ; le rendu (${amt(btcChange.value, 'BTC')}) reste sur ${A(w, btcChange.address)}. Aucun lien on-chain avec la suite.\n` +
          `3. La corrélation fait ressortir plusieurs paiements ChangeNOW voisins, dont : ${amt(ord.payoutValue, 'ETH')} à ${A(w, e1)} (le bon), un paiement supérieur à la valeur déposée (impossible) et un paiement plausible dont le destinataire ne touche jamais au bridge.\n` +
          `4. ${A(w, e1)} envoie ${amt(bridgeIn, 'ETH')} dans ArcBridge vers BNB Smart Chain ; le bridge verse ${amt(brRes.received, 'BNB')} à ${A(w, b1)}. Le reliquat (${amt(residualEth, 'ETH')}) est déposé chez ${ex2Name}.\n` +
          `5. Sur PancakeSwap, ${A(w, b1)} obtient ${amt(usdtGot, 'USDT')}. Il envoie ${amt(Rb, 'USDT')} à ${A(w, b2)}, deux montants jumeaux financés par des apports extérieurs arrivés juste avant, et ${branches.length} branches sans issue.\n` +
          `6. ${Math.round((tFinal - tD) / HOUR)} h plus tard, ${A(w, b2)} dépose ${amt(Rb, 'USDT')} chez ChangeNOW sur BSC : la commande est payée en Monero, hors de portée du traçage.\n\n` +
          `À retenir : un bridge est transparent (il publie la chaîne et le destinataire), un DEX aussi. Les maillons faibles sont l'échangeur instantané (le lien n'y est qu'une corrélation, à départager par la vraisemblance des montants et le comportement ultérieur) et les éclatements, qu'on trie en suivant chaque branche et en vérifiant l'origine des fonds de chaque envoi. La sortie vers Monero clôt le traçage on-chain : restent les réquisitions à ChangeNOW (deux commandes) et à ${ex2Name}, et le gel par Tether des USDT encore présents sur les branches dormantes.`,
      },
      hints: [
        'Listez tous les versements reçus par l\'adresse de collecte, jusqu\'à aujourd\'hui, puis suivez ses sorties : l\'une d\'elles est une adresse de dépôt d\'un échangeur instantané.',
        'Dans l\'outil de corrélation, partez de l\'heure exacte du dépôt ChangeNOW et de sa valeur en USD ; choisissez Ethereum comme chaîne cible. Écartez un candidat dont le montant dépasse la valeur déposée.',
        'Le détail d\'une transaction bridgeOut indique la chaîne et la transaction de destination. N\'oubliez pas ce qui reste sur l\'adresse Ethereum.',
        'Sur BSC, après le swap, ouvrez chaque envoi d\'USDT : les jumeaux sont précédés d\'un apport extérieur du même montant ; une seule destination finit, un à deux jours plus tard, chez un service identifié.',
      ],
    }
  },
}
