import { World, type Tx } from '../engine/world'
import { bridge, dex, exchange, swapper, roundCoin, HOUR, DAY, type SwapperKit } from '../engine/patterns'
import { roundAsset, usd, fromUsd, CHAINS, type AssetId, type ChainId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

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

export const accChainHopping: ScenarioTemplate = {
  id: 'chain-hopping',
  title: 'Chain hopping : BTC → ETH → BSC',
  tagline: 'Échangeur instantané, bridge et DEX : trois chaînes, une seule piste.',
  description:
    'Les bitcoins d\'une escroquerie au faux placement sont convertis en ETH via un échangeur instantané, bridgés vers BNB Smart Chain, échangés en USDT puis déposés sur un exchange. Le saut BTC → ETH ne laisse aucun lien on-chain : il faut le retrouver par corrélation montant/temps.',
  difficulty: 3,
  chains: ['btc', 'eth', 'bsc'],
  skills: ['crosschain', 'bridge', 'dex', 'exchange_id', 'requisition'],
  estMinutes: 30,
  lessons: ['chain-hopping', 'bridges', 'dex-defi', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)

    const sw = swapper(w, 'ocelot')
    const br = bridge(w, 'arcbridge')
    const syrup = dex(w, 'syrupswap', 'bsc')
    const destKey = r.pick(['binova', 'kaizen', 'huobex'] as const)
    const dest = exchange(w, destKey, 'bsc')

    const suspect = w.customEntity({ name: 'Réseau « BitFortune Capital » (inconnu)', category: 'suspect' })
    const s0 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })

    // Victimes : paiements en BTC vers l'adresse de la fausse plateforme
    const nV = r.int(3, 5)
    const victims: { name: string; addr: string; tx: string; hash: string; value: number }[] = []
    for (let i = 0; i < nV; i++) {
      const name = fakeName(r)
      const va = w.addr('btc', { entity: w.customEntity({ name, category: 'victim' }), kind: 'p2wpkh' })
      const value = roundCoin(w, 0.08, 0.45, 0.001)
      const tx = w.fund(s0, value, w.at(-r.float(2, 12) * 24 + i), { from: [va] })
      victims.push({ name, addr: va, tx: tx.id, hash: tx.hash, value })
    }
    const collected = victims.reduce((s, v) => s + v.value, 0)

    // Commande Ocelot Swap : BTC → ETH, payée sur une adresse neuve
    const e1 = w.addr('eth', { entity: suspect })
    const orderValue = roundAsset('BTC', collected * r.float(0.95, 0.985))
    const orderT = w.at(r.float(2, 10))
    const ord = btcOrder(w, sw, { from: s0, value: orderValue, time: orderT, toChain: 'eth', recipient: e1, feePct: r.float(0.006, 0.012), delayMin: [8, 40] })

    // ETH → bridge ArcBridge vers BSC (l'ETH devient du BNB)
    const b1 = w.addr('bsc', { entity: suspect })
    const bridgeIn = roundAsset('ETH', ord.payoutValue * r.float(0.97, 0.99))
    const brT = ord.payoutTx.time + r.int(40, 300) * 60
    const brRes = br.send({ from: e1, value: bridgeIn, time: brT, toChain: 'bsc', recipient: b1 })

    // BNB → USDT sur SyrupSwap, puis dépôt sur l'exchange
    const swapT = brRes.inTx.time + r.int(10, 90) * 60
    const swp = syrup.swap({ trader: b1, assetIn: 'BNB', amountIn: roundAsset('BNB', brRes.received * r.float(0.96, 0.99)), assetOut: 'USDT', time: swapT })
    const dep = dest.receive(b1, swp.amountOut, swapT + r.int(20, 180) * 60, { asset: 'USDT' })

    // ── Bruit ──
    // Autres clients d'Ocelot (BTC → ETH / Tron), étalés sur plusieurs jours
    for (let i = 0; i < r.int(4, 6); i++) {
      const c = w.addr('btc')
      const v = roundCoin(w, 0.02, 1.2, 0.0001)
      const tOrd = w.at(r.float(-3, 5) * 24)
      w.fund(c, v * 1.05, tOrd - r.int(2, 48) * HOUR)
      const toChain = r.pick(['eth', 'eth', 'tron'] as const)
      btcOrder(w, sw, { from: c, value: v, time: tOrd, toChain, toAsset: toChain === 'tron' ? 'USDT' : undefined, recipient: w.addr(toChain), decoys: r.int(1, 3) })
    }
    // Paiements Ocelot sur ETH à des montants proches, en dehors de la fenêtre
    for (let i = 0; i < 4; i++) {
      const dt = r.pick([-1, 1]) * r.float(4, 30) * HOUR
      w.transfer({ time: Math.round(ord.payoutTx.time + dt), from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', ord.payoutValue * r.float(0.97, 1.03)), asset: 'ETH', method: 'payout' })
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
    syrup.noise(30, w.at(-2 * 24), w.at(5 * 24), [['BNB', 'USDT'], ['BNB', 'USDC']])
    dest.noise(16, w.at(-2 * 24), w.at(5 * 24), 'USDT')
    dest.noise(6, w.at(-2 * 24), w.at(5 * 24), 'BNB')

    const depositUsd = usd('BTC', orderValue)
    const v0 = victims[0]

    return {
      world: w,
      title: `Opération BitFortune — ${city}`,
      briefing:
        `${nV} plaintes ont été jointes : les victimes ont toutes versé des bitcoins sur la plateforme « BitFortune Capital », qui promettait des rendements de trading automatisé. Le site a fermé.\n\n` +
        `L'adresse de collecte BTC est connue. Les fonds semblent avoir quitté Bitcoin : les réseaux d'escrocs « sautent » de chaîne en chaîne (chain hopping) via des échangeurs instantanés et des bridges pour casser le traçage.\n\n` +
        `L'échangeur instantané ne crée aucun lien on-chain entre le dépôt et le paiement : utilisez l'outil de corrélation (émetteur = le service, chaîne cible, fenêtre de temps, tolérance de montant). Le bridge, lui, publie la transaction correspondante sur la chaîne de destination.`,
      evidence: [
        {
          id: 'synthese', type: 'rapport', title: 'Synthèse des plaintes', date: w.at(5 * 24), author: 'Section de recherches',
          body:
            `Adresse de dépôt communiquée aux victimes par BitFortune : ${A(w, s0)}\n\n` +
            victims.map((v) => `- ${v.name} : ${amt(v.value, 'BTC')} — tx ${v.hash}`).join('\n') +
            `\n\nTotal déclaré : ${amt(collected, 'BTC')}.`,
        },
        {
          id: 'plainte', type: 'plainte', title: `Plainte de ${v0.name} (extrait)`, date: w.at(3 * 24), author: v0.name,
          body: `« Mon conseiller m'a dit que mes gains étaient bloqués et qu'il fallait payer une taxe. J'ai compris que c'était une arnaque quand le site a disparu, le ${fmtDate(w.at(2 * 24), false)}. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — page « Déposer » de BitFortune', date: w.at(-10 * 24),
          body: `BitFortune Capital · Dépôt\nRéseau : Bitcoin uniquement\nAdresse : ${A(w, s0)}\nVos fonds sont crédités après 2 confirmations.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 25,
          prompt: 'Quelle adresse Ethereum a reçu le paiement d\'Ocelot Swap correspondant au dépôt BTC des escrocs ?',
          answer: [e1],
          hint: `Corrélation : émetteur Ocelot Swap, chaîne Ethereum, à partir de l'heure du dépôt, fenêtre d'environ 1 h, tolérance de 2 à 5 % sur la valeur USD du dépôt (≈ ${Math.round(depositUsd).toLocaleString('fr-FR')} $). Parmi les candidats, lequel a une activité ultérieure ?`,
          explanation: `Le dépôt de ${amt(orderValue, 'BTC')} (≈ ${Math.round(depositUsd).toLocaleString('fr-FR')} $) chez Ocelot est suivi, ${Math.round((ord.payoutTx.time - ord.depositTx.time) / 60)} minutes plus tard, d'un paiement de ${amt(ord.payoutValue, 'ETH')} vers ${A(w, e1)} : montant diminué de la commission (≈ ${((1 - usd('ETH', ord.payoutValue) / depositUsd) * 100).toFixed(1).replace('.', ',')} %) et délai typique d'un échangeur. Cette adresse bridge ensuite ses ETH, ce qui conforte l'hypothèse.`,
        },
        {
          id: 'o2', type: 'address', points: 15,
          prompt: 'L\'adresse Ethereum fait passer ses fonds par un bridge. Quelle adresse les reçoit sur la chaîne de destination ?',
          answer: [b1],
          hint: 'Ouvrez la transaction « bridgeOut » : l\'événement du bridge indique la chaîne, le destinataire et la transaction correspondante.',
          explanation: `La transaction bridgeOut vers ArcBridge (nonce ${brRes.outTx.bridge?.nonce}) référence la transaction bridgeIn sur BNB Smart Chain : ${amt(brRes.received, 'BNB')} versés à ${A(w, b1)}. Le bridge publie la chaîne de destination, le destinataire et la transaction correspondante : ce n'est pas une rupture de traçage, même quand l'actif change (ici ETH → BNB, conversion opérée par le bridge).`,
        },
        {
          id: 'o3', type: 'entity', points: 20,
          prompt: 'Sur quel exchange les fonds ont-ils finalement été déposés ?',
          answer: [destKey],
          hint: 'Sur BSC, l\'adresse de destination échange ses BNB contre des USDT avant de les envoyer ailleurs.',
          explanation: `Après le swap BNB → USDT sur SyrupSwap, les USDT sont déposés sur une adresse de dépôt ${dest.entity.name}.`,
        },
        {
          id: 'o4', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.02,
          prompt: 'Quel montant d\'USDT a été déposé sur cet exchange ?',
          answer: swp.amountOut,
          explanation: `${amt(swp.amountOut, 'USDT')}, issus du swap de ${amt(roundAsset('BNB', swp.tx.transfers[0].value), 'BNB')} sur SyrupSwap.`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Que demander en priorité à Ocelot Swap ?',
          ...choice(r,
            'Les données de la commande liée au hash de dépôt (adresse de paiement, horodatages, IP)',
            [
              'L\'identité KYC complète du client (pièce d\'identité, justificatif de domicile)',
              'Le gel des ETH déjà versés par l\'échangeur sur l\'adresse de paiement du client',
              'La clé privée de l\'adresse de dépôt, pour reprendre la main sur les fonds',
            ]),
          explanation: `${procedureFor(sw.entity)} Ocelot ne fait pas de KYC et ne peut rien geler une fois le paiement effectué (les ETH sont sur une adresse que le client contrôle seul). En revanche, en fournissant le hash du dépôt (${ord.depositTx.hash.slice(0, 16)}…), on peut obtenir les métadonnées de la commande : elles confirment le lien dépôt → paiement (qui n'est qu'une corrélation) et fournissent parfois une IP ou un e-mail.`,
        },
      ],
      truth: {
        path: [...victims.map((v) => v.tx), ord.depositTx.id, ord.sweepTx.id, ord.payoutTx.id, brRes.outTx.id, brRes.inTx.id, swp.tx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : [])],
        addresses: [s0, ord.deposit, e1, b1, dep.deposit],
        debrief:
          `1. ${nV} victimes versent ${amt(collected, 'BTC')} sur ${A(w, s0)}.\n` +
          `2. Les escrocs déposent ${amt(orderValue, 'BTC')} sur une adresse de dépôt Ocelot Swap (le reste part en rendu). Aucun lien on-chain avec la suite : Ocelot paie depuis son hot wallet ETH, mélangé aux paiements d'autres clients.\n` +
          `3. La corrélation (émetteur Ocelot, Ethereum, fenêtre ~1 h, tolérance quelques %) fait ressortir ${amt(ord.payoutValue, 'ETH')} versés à ${A(w, e1)} ${Math.round((ord.payoutTx.time - ord.depositTx.time) / 60)} minutes après le dépôt.\n` +
          `4. ${A(w, e1)} envoie ${amt(bridgeIn, 'ETH')} dans ArcBridge vers BNB Smart Chain ; le bridge verse ${amt(brRes.received, 'BNB')} à ${A(w, b1)}.\n` +
          `5. Sur SyrupSwap, ${A(w, b1)} échange ses BNB contre ${amt(swp.amountOut, 'USDT')}, déposés sur ${dest.entity.name}.\n\n` +
          `À retenir : un bridge est transparent (il publie la chaîne et le destinataire), un DEX aussi. Le maillon faible du traçage est l'échangeur instantané : le lien n'y est qu'une corrélation, à consolider par réquisition (données de commande). La réquisition finale vise ${dest.entity.name} (adresse de dépôt BSC), avec demande de gel. ${procedureFor(dest.entity)}`,
      },
      hints: [
        'Suivez les sorties de l\'adresse de collecte BTC : l\'une d\'elles est une adresse de dépôt d\'un échangeur instantané.',
        'Dans l\'outil de corrélation, partez de l\'heure exacte du dépôt Ocelot et de sa valeur en USD ; choisissez Ethereum comme chaîne cible.',
        'Le détail d\'une transaction bridgeOut indique la chaîne et la transaction de destination : cliquez dessus pour changer de chaîne.',
        'Sur BSC, un swap SyrupSwap convertit les BNB en USDT : suivez les USDT renvoyés par le pool.',
      ],
    }
  },
}
