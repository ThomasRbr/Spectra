import { World, type Tx } from '../engine/world'
import { dex, exchange, swapper, HOUR, DAY, type SwapperKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import { lookalike } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const RELATIONS = [
  { rel: 'père', f: false },
  { rel: 'mère', f: true },
  { rel: 'frère', f: false },
  { rel: 'sœur', f: true },
  { rel: 'compagne', f: true },
  { rel: 'compagnon', f: false },
] as const

/** [masculin, féminin] */
const ACTIVITIES: [string, string][] = [
  ['cofondateur d\'une société de conservation de crypto-actifs', 'cofondatrice d\'une société de conservation de crypto-actifs'],
  ['fondateur d\'une start-up de services blockchain', 'fondatrice d\'une start-up de services blockchain'],
  ['dirigeant d\'une société de minage', 'dirigeante d\'une société de minage'],
  ['fondateur d\'un média spécialisé dans les crypto-actifs', 'fondatrice d\'un média spécialisé dans les crypto-actifs'],
]

/** Montant entier « au cent près » (USDT à 2 décimales). */
const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * Sortie de peel chain envoyée à un échangeur instantané (BTC → USDT-TRC20).
 * Équivalent de `SwapperKit.order` mais la transaction de dépôt garde un rendu
 * explicite (la peel chain continue) et le rapatriement du dépôt passe des
 * frais explicites (sinon `utxoTx` peut auto-financer l'adresse de dépôt).
 */
function btcPeelToSwapper(
  w: World,
  sw: SwapperKit,
  o: { from: string; value: number; time: number; change: string; recipient: string; feePct: number; decoys: number },
): { deposit: string; depositTx: Tx; sweepTx: Tx; payoutTx: Tx; payoutValue: number } {
  const r = w.rng
  const deposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
  const depositTx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: deposit, value: o.value }], change: o.change, spendAll: true, tags: ['peel'] })
  const fee = w.estimateFee('btc', 1, 1)
  const sweepTx = w.utxoTx({ time: o.time + r.int(300, 1500), from: [deposit], to: [{ address: sw.hot('btc'), value: w.unspentValue(deposit) - fee }], fee, change: null, spendAll: true, tags: ['sweep'] })
  const payT = o.time + r.int(12, 40) * 60
  const payoutValue = roundAsset('USDT', usd('BTC', o.value) * (1 - o.feePct))
  const pay = (to: string, value: number, time: number) => w.transfer({ time, from: sw.hot('tron'), to, value, asset: 'USDT', method: 'payout' })
  const payoutTx = pay(o.recipient, payoutValue, payT)
  // Autres clients de l'échangeur payés en USDT-TRC20 dans la même fenêtre.
  for (let i = 0; i < o.decoys; i++) {
    const close = r.chance(0.35)
    const v = close ? payoutValue * r.float(0.85, 1.15) : r.float(60, payoutValue * 2.5 + 300)
    pay(w.addr('tron'), roundAsset('USDT', v), payT + r.int(-2 * 3600, Math.round(1.5 * 3600)))
  }
  return { deposit, depositTx, sweepTx, payoutTx, payoutValue }
}

export const tronKidnappingRansom: ScenarioTemplate = {
  id: 'tron-kidnapping-ransom',
  title: 'Enlèvement : la rançon en USDT',
  tagline: 'Une rançon fractionnée en quelques minutes : trouver les USDT encore gelables avant qu\'ils ne disparaissent.',
  description:
    'Un proche d\'un entrepreneur du secteur crypto a été séquestré. La famille a payé, sous le contrôle des enquêteurs, une rançon en USDT-TRC20 et en bitcoins. La victime est libérée, mais les fonds se dispersent : identifiez l\'adresse qui détient encore des USDT, le montant à faire geler par l\'émetteur, les plateformes de dépôt et le lien entre les volets Bitcoin et Tron.',
  difficulty: 3,
  chains: ['tron', 'btc'],
  skills: ['tron', 'tokens', 'gel', 'requisition', 'crosschain', 'typologies'],
  estMinutes: 30,
  lessons: ['tron-usdt', 'gel-saisie', 'stablecoins', 'requisitions', 'suivre-flux'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const entP = fakePerson(r)
    const entName = entP.name
    const ge = entP.g
    const deEnt = `${/^[AEIOUYÉÈÊÀÂÎ]/.test(entName) ? "d'" : "de "}${entName}`
    const activity = ge(...r.pick(ACTIVITIES))
    const relation = r.pick(RELATIONS)
    const hf = relation.f
    const gh = (m: string, f: string) => (hf ? f : m)
    const theRel = `${hf ? 'la' : 'le'} ${relation.rel}`
    const TheRel = `${hf ? 'La' : 'Le'} ${relation.rel}`
    const handle = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const tether = w.entity('tether')
    const usdtContract = w.addr('tron', { entity: tether, label: 'Tether: USDT (TRC-20)', contract: { name: 'Tether USD (TRC-20)', type: 'token' } })
    const cvT = exchange(w, 'coinhouse', 'tron')
    const kA = r.pick(['okx', 'binance'] as const)
    const kB = kA === 'okx' ? 'binance' : 'okx'
    const exA = exchange(w, kA, 'tron')
    const exB = exchange(w, kB, 'tron')
    const btcKey = r.pick(['kraken', 'bitstamp', 'binance', 'okx'] as const)
    const exBtc = exchange(w, btcKey, 'btc')
    const sun = dex(w, 'sunswap', 'tron')
    const cn = swapper(w, 'changenow')

    const famE = w.customEntity({ name: `${entName} (famille de la victime)`, category: 'victim' })
    const gang = w.customEntity({ name: 'Ravisseurs (non identifiés)', category: 'suspect' })
    const accompliceE = w.customEntity({ name: 'Bénéficiaire non identifié', category: 'individual' })

    // ── Montants ─────────────────────────────────────────────────────────────
    const ransomUsdt = r.int(18, 45) * 10000
    const ransomBtc = r.pick([0.5, 1, 1.5, 2, 2.5, 3])
    const famTest = r.pick([20, 50, 100])
    const gangTest = r.pick([10, 15, 20])

    // ── Chronologie ──────────────────────────────────────────────────────────
    const tMain = w.at(0)
    const tKid = tMain - Math.round(r.float(40, 60) * HOUR)
    const tDemand = tKid + Math.round(r.float(5, 10) * HOUR)
    const tProof = tMain - Math.round(r.float(5, 8) * HOUR)
    const tFamTest = tMain - Math.round(r.float(1.2, 2.5) * HOUR)

    // ── Portefeuilles de la famille ──────────────────────────────────────────
    const VT = w.addr('tron', { entity: famE })
    const FB = w.addr('btc', { entity: famE, kind: 'p2wpkh' })
    cvT.withdraw(VT, r.int(300, 900), tMain - r.int(60, 300) * DAY, 'TRX')
    for (let i = 0; i < r.int(2, 4); i++) cvT.withdraw(VT, r2(r.float(800, 9000)), tMain - r.int(20, 250) * DAY, 'USDT')
    // Fonds mobilisés en urgence sur Coinhouse
    cvT.withdraw(VT, ransomUsdt + famTest + r.int(50, 900), tMain - Math.round(r.float(14, 26) * HOUR), 'USDT')
    w.fund(FB, roundAsset('BTC', ransomBtc + r.float(0.15, 1.2)), tMain - r.int(40, 400) * DAY)

    // ── Préparation des ravisseurs (jours précédents) ────────────────────────
    const P = w.addr('tron', { entity: gang })
    const C = w.addr('tron', { entity: gang })
    const S1 = w.addr('tron', { entity: gang })
    const S2 = w.addr('tron', { entity: gang })
    const S3 = w.addr('tron', { entity: gang })
    const S4 = w.addr('tron', { entity: gang })
    const S4b = w.addr('tron', { entity: gang })
    const R = w.addr('tron', { entity: gang })
    const B0 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const tPrep = tKid - Math.round(r.float(5, 9) * DAY)
    const wTrx = exB.withdraw(P, r.int(25, 45) * 100, tPrep, 'TRX')
    const wUsdt = exB.withdraw(P, gangTest, tPrep + r.int(20, 120) * 60, 'USDT')
    const gasTxs: Tx[] = []
    let tg = tPrep + Math.round(r.float(3, 20) * HOUR)
    for (const a of [C, S1, S2, S3, S4, S4b, R]) {
      gasTxs.push(w.transfer({ time: tg, from: P, to: a, value: r.int(10, 30) * 10, asset: 'TRX' }))
      tg += r.int(2, 25) * 60
    }
    // Transfert « test » des ravisseurs vers leur adresse de collecte
    const gangTestTx = w.transfer({ time: tg + r.int(1, 6) * HOUR, from: P, to: C, value: gangTest, asset: 'USDT' })

    // ── Négociation : preuve de contrôle et test de la famille ───────────────
    const proofTx = w.transfer({ time: tProof, from: C, to: VT, value: 1, asset: 'USDT' })
    const famTestTx = w.transfer({ time: tFamTest, from: VT, to: C, value: famTest, asset: 'USDT' })
    const mainTx = w.transfer({ time: tMain, from: VT, to: C, value: ransomUsdt, asset: 'USDT' })
    const tBtc = tMain + r.int(10, 25) * 60
    const btcTx = w.utxoTx({ time: tBtc, from: [FB], to: [{ address: B0, value: ransomBtc }] })

    // Bruit : un robot d'address poisoning vise le payeur juste après le gros transfert
    const poison = w.addr('tron', { addr: lookalike(r, 'tron', A(w, C), 5, 5) })
    const poisonTx = w.transfer({ time: tMain + r.int(3, 15) * 60, from: poison, to: VT, value: r.pick([0.01, 0.1, 1]), asset: 'USDT' })

    // ── Fractionnement de la collecte (quelques minutes) ─────────────────────
    const total = w.balanceOf(C, 'USDT')
    const s1 = Math.round((total * r.float(0.28, 0.4)) / 100) * 100
    const s2 = Math.round((total * r.float(0.15, 0.22)) / 100) * 100
    const s3 = Math.round((total * r.float(0.18, 0.25)) / 100) * 100
    const s4 = r2(total - s1 - s2 - s3)
    const order = r.shuffle([0, 1, 2, 3])
    const dests = [S1, S2, S3, S4]
    const vals = [s1, s2, s3, s4]
    const splitTx: Tx[] = []
    let ts = tMain + r.int(4, 9) * 60
    for (const k of order) {
      splitTx[k] = w.transfer({ time: ts, from: C, to: dests[k], value: vals[k], asset: 'USDT' })
      ts += r.int(1, 4) * 60
    }
    const splitEnd = Math.max(...splitTx.map((t) => t.time))

    // S2 : conversion USDT → TRX sur SunSwap (sortie du périmètre de gel), puis dépôt partiel
    const swapRes = sun.swap({ trader: S2, assetIn: 'USDT', amountIn: s2, assetOut: 'TRX', time: splitEnd + r.int(25, 55) * 60 })
    const trxOut = swapRes.amountOut
    const trxDeposited = Math.round(trxOut * r.float(0.86, 0.93))
    const trxKept = roundAsset('TRX', trxOut - trxDeposited)
    const D_b = exB.newDeposit()
    const s2Dep = exB.receive(S2, trxDeposited, swapRes.tx.time + r.int(30, 80) * 60, { asset: 'TRX', depositAddr: D_b, sweepDelayH: r.float(0.2, 0.7) })

    // S3 : dépôt direct chez l'exchange A
    const s3Dep = exA.receive(S3, s3, splitEnd + r.int(25, 70) * 60, { asset: 'USDT', sweepDelayH: r.float(0.2, 0.7) })
    const D_a = s3Dep.deposit

    // S4 : un saut supplémentaire, puis dépôt sur le même compte de l'exchange B
    const s4Hop = forwardAll(w, S4, S4b, splitEnd + r.int(40, 80) * 60, 'USDT')
    const s4Dep = exB.receive(S4b, s4, s4Hop.time + r.int(50, 90) * 60, { asset: 'USDT', depositAddr: D_b, sweepDelayH: r.float(0.2, 0.7) })

    // S1 : immobile (cible du gel)

    // ── Volet BTC : courte peel chain ────────────────────────────────────────
    const B1 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const B2 = w.addr('btc', { entity: gang, kind: 'p2wpkh' })
    const cnValue = roundAsset('BTC', Math.round(ransomBtc * r.float(0.25, 0.38) * 1e4) / 1e4)
    const peel1 = btcPeelToSwapper(w, cn, { from: B0, value: cnValue, time: tBtc + Math.round(r.float(0.8, 1.4) * HOUR), change: B1, recipient: R, feePct: r.float(0.006, 0.015), decoys: r.int(5, 8) })
    const U = w.addr('btc', { entity: accompliceE, kind: r.pick(['p2wpkh', 'p2sh'] as const) })
    const uValue = roundAsset('BTC', Math.round(w.unspentValue(B1) * r.float(0.08, 0.16) * 1e4) / 1e4)
    const peel2 = w.utxoTx({ time: peel1.depositTx.time + Math.round(r.float(0.6, 1.2) * HOUR), from: [B1], to: [{ address: U, value: uValue }], change: B2, spendAll: true, tags: ['peel'] })
    const depBtc = exBtc.newDeposit()
    const peel3 = forwardAll(w, B2, depBtc, peel2.time + Math.round(r.float(0.5, 1) * HOUR))
    const btcDeposited = peel3.outputs[0].value
    const btcSweep = exBtc.sweep([depBtc], peel3.time + Math.round(r.float(0.3, 0.8) * HOUR))[0]

    // R : produit de la conversion ChangeNOW, renvoyé sur le compte de l'exchange A
    const rDep = exA.receive(R, peel1.payoutValue, peel1.payoutTx.time + r.int(15, 45) * 60, { asset: 'USDT', depositAddr: D_a, sweepDelayH: r.float(0.2, 0.7) })

    // ── Instant T ────────────────────────────────────────────────────────────
    const lastSuspect = Math.max(s2Dep.tx.time, s3Dep.tx.time, s4Dep.tx.time, rDep.tx.time, peel3.time, btcSweep.time, ...[s2Dep, s3Dep, s4Dep, rDep].map((d) => d.sweep?.time ?? 0))
    const tNow = lastSuspect + r.int(20, 45) * 60
    const hNow = Math.max(1, Math.round((tNow - tMain) / HOUR))
    const tRelease = tMain + Math.round(r.float(1.8, 3) * HOUR)

    // ── Bruit ────────────────────────────────────────────────────────────────
    exA.noise(16, tMain - 3 * DAY, tMain - 8 * HOUR, 'USDT')
    exB.noise(14, tMain - 3 * DAY, tMain - 8 * HOUR, 'USDT')
    exB.noise(6, tMain - 3 * DAY, tMain - 8 * HOUR, 'TRX')
    cvT.noise(8, tMain - 20 * DAY, tMain - 8 * HOUR, 'USDT')
    exBtc.noise(8, tMain - 5 * DAY, tMain - 10 * HOUR)
    for (let i = 0; i < r.int(6, 10); i++) exA.withdraw(w.addr('tron'), r2(r.float(80, 20000)), tMain + r.int(0, Math.max(1, hNow - 1) * 60) * 60, 'USDT')
    for (let i = 0; i < r.int(5, 9); i++) exB.withdraw(w.addr('tron'), r2(r.float(80, 20000)), tMain + r.int(0, Math.max(1, hNow - 1) * 60) * 60, 'USDT')
    sun.noise(r.int(18, 26), tMain - DAY, tMain + 3 * HOUR, [['TRX', 'USDT']])

    // ── Valeurs pour les textes ──────────────────────────────────────────────
    const frozen = w.balanceOf(S1, 'USDT')
    const splitMin = Math.round((splitEnd - tMain) / 60)
    const totalUsdtOut = r2(s3 + s4 + peel1.payoutValue)
    const nameA = exA.entity.name
    const nameB = exB.entity.name
    const nameBtc = exBtc.entity.name
    const demandText = `${amt(ransomUsdt, 'USDT')} et ${amt(ransomBtc, 'BTC')}`

    return {
      world: w,
      title: `Enlèvement — ${city}`,
      briefing:
        `Le ${fmtDate(tKid, false).replace(/^1 /, "1er ")}, ${theRel} ${deEnt} (${city}), ${activity}, a été ${gh('enlevé', 'enlevée')} devant son domicile. Quelques heures plus tard, ${entName} a reçu sur Telegram une demande de rançon de ${demandText}, assortie de la consigne habituelle : ne pas prévenir la police. ${ge('Il', 'Elle')} a pourtant alerté les enquêteurs sans attendre.\n\n` +
        `Le paiement a été effectué sous le contrôle des enquêteurs et de la cellule de négociation, depuis les portefeuilles personnels ${deEnt}. ${TheRel} de ${ge('l\'entrepreneur', 'l\'entrepreneuse')} a été ${gh('libéré', 'libérée')} le ${fmtDate(tRelease)}, sans blessure grave. Les auteurs sont en fuite.\n\n` +
        `Nous sommes le ${fmtDate(tNow)} (H+${hNow} après le paiement principal). Le magistrat de permanence attend votre analyse pour signer les demandes urgentes : quelles adresses tiennent encore des fonds gelables, auprès de qui agir, et dans quel ordre. Sur Tron, chaque minute compte : un USDT peut être converti ou déposé sur un exchange en quelques secondes.`,
      evidence: [
        {
          id: 'telegram', type: 'telegram', title: 'Messages des ravisseurs (Telegram, extraits)', date: tDemand, author: `@${handle}`,
          body:
            `@${handle} : On a ${hf ? 'ta' : 'ton'} ${relation.rel}. ${gh('Il', 'Elle')} va bien tant que tu fais ce qu'on dit. Pas de police.\n` +
            `@${handle} : ${amt(ransomUsdt, 'USDT')} réseau TRC20 sur ${A(w, C)}\n` +
            `@${handle} : + ${amt(ransomBtc, 'BTC')} sur ${A(w, B0)}\n` +
            `Négociateur (au nom de la famille) : Prouvez que vous contrôlez cette adresse Tron.\n` +
            `@${handle} : On vient de t'envoyer 1 USDT depuis l'adresse. Regarde ton portefeuille.\n` +
            `@${handle} : Envoie d'abord un petit montant pour tester, ensuite tout. Après le paiement, on ${gh('le', 'la')} relâche.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV de remise de la rançon (extrait)', date: tBtc + 2 * HOUR, author: 'Cellule de négociation — section de recherches',
          body:
            `Paiements effectués par ${entName} depuis ses portefeuilles personnels, en présence des enquêteurs :\n` +
            `- Portefeuille Tron de la famille : ${A(w, VT)}\n` +
            `- Portefeuille Bitcoin de la famille : ${A(w, FB)}\n\n` +
            `1. ${fmtDate(tProof)} — réception de 1 USDT envoyé par les ravisseurs (preuve de contrôle demandée par le négociateur).\n` +
            `2. ${fmtDate(tFamTest)} — paiement test de ${amt(famTest, 'USDT')}, confirmé par les ravisseurs.\n` +
            `3. ${fmtDate(tMain)} — paiement principal de ${amt(ransomUsdt, 'USDT')} : ${mainTx.hash}\n` +
            `4. ${fmtDate(tBtc)} — paiement de ${amt(ransomBtc, 'BTC')} : ${btcTx.hash}`,
        },
        {
          id: 'situation', type: 'rapport', title: `Point de situation à H+${hNow}`, date: tNow, author: 'Directeur d\'enquête',
          body:
            `${TheRel} ${deEnt} a été ${gh('retrouvé', 'retrouvée')} le ${fmtDate(tRelease)} et ${gh('pris', 'prise')} en charge par les secours. La priorité passe désormais à l'identification des auteurs et à la préservation du produit de l'infraction.\n\n` +
            `Demandes attendues du groupe crypto, dans l'heure :\n` +
            `- l'adresse (ou les adresses) qui détiennent encore des USDT, et le montant exact à faire geler ;\n` +
            `- les plateformes où des fonds ont été déposés (gel du compte et réquisition d'identification) ;\n` +
            `- le devenir des bitcoins.\n\n` +
            `Attention : le portefeuille de la famille a reçu, juste après le paiement, des micro-transferts d'adresses inconnues. Vérifiez avant de conclure.`,
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche réflexe — rançon payée en stablecoins', date: tMain - 30 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- L'USDT TRC-20 est un jeton émis par une société : son émetteur peut placer une adresse sur liste noire, ce qui bloque tous les USDT qu'elle détient. Le TRX, actif natif de Tron, n'est gelable par personne.\n` +
            `- Une adresse vidée ne peut plus être gelée utilement : seul compte le solde au moment de la demande.\n` +
            `- Sur Tron, un exchange attribue en général une adresse de dépôt par client, commune au TRX et aux jetons TRC-20 : deux flux vers la même adresse de dépôt aboutissent sur le même compte.\n` +
            `- Les échangeurs instantanés ne laissent pas de lien on-chain entre le dépôt et le paiement : corrélez montant et horaire.`,
        },
      ],
      seeds: [VT, FB],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse Tron a collecté la rançon avant son fractionnement ?',
          answer: [C],
          hint: 'Ouvrez le paiement principal mentionné dans le PV et comparez son destinataire, caractère par caractère, avec l\'adresse donnée sur Telegram.',
          explanation: `${A(w, C)} reçoit le test des ravisseurs (${amt(gangTest, 'USDT')}), renvoie 1 USDT de preuve à la famille, puis reçoit ${amt(famTest, 'USDT')} de test et ${amt(ransomUsdt, 'USDT')}. ${splitMin} minutes après le paiement principal, elle a déjà réparti ${amt(total, 'USDT')} sur quatre adresses. Attention au sosie ${A(w, poison)}, qui partage les 5 premiers et 5 derniers caractères : c'est un robot d'address poisoning qui a envoyé de la poussière au payeur, sans lien avec les ravisseurs.`,
        },
        {
          id: 'o2', type: 'address', points: 15,
          prompt: `À H+${hNow}, quelle adresse détient encore des USDT issus de la rançon ?`,
          answer: [S1],
          hint: 'Ouvrez chacune des quatre adresses alimentées par la collecte et regardez leur solde actuel, actif par actif (USDT ≠ TRX). Plus rapide : tracez les USDT reçus par l\'adresse de collecte (touche R) et lisez « Fonds encore détenus ».',
          explanation: `Des quatre adresses servies par la collecte, ${A(w, S1)} n'a fait aucun mouvement : elle détient toujours ${amt(frozen, 'USDT')}. ${A(w, S3)} et ${A(w, S4)} sont vides (fonds déposés chez ${nameA} et ${nameB}). ${A(w, S2)} détient encore ${amt(trxKept, 'TRX')}, mais ce sont des TRX issus d'un swap SunSwap : l'émetteur de l'USDT n'a aucune prise sur eux.`,
        },
        {
          id: 'o3', type: 'amount', points: 15, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT faut-il demander à geler sur cette adresse ?',
          answer: frozen,
          hint: 'Le gel porte sur le solde présent au moment de la demande, pas sur le montant de la rançon.',
          explanation: `${amt(frozen, 'USDT')}, soit ${Math.round((frozen / ransomUsdt) * 100)} % de la part USDT de la rançon. C'est le solde exact de ${A(w, S1)} : la demande doit citer l'adresse complète et ce montant. Le reste n'est plus sur une adresse auto-hébergée (exchanges) ou n'est plus en USDT (TRX).`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'À qui adresser en urgence la demande de gel de ces USDT ?',
          answer: ['tether'],
          hint: 'Qui, techniquement, peut bloquer un jeton TRC-20 sur une adresse que personne d\'autre ne contrôle ?',
          explanation: `Tether, émetteur de l'USDT (contrat ${A(w, usdtContract)}), peut inscrire l'adresse sur sa liste noire : les USDT y deviennent intransférables. ${procedureFor(tether)} Le gel n'est qu'une mesure conservatoire : la saisie pénale suit (ordonnance du JLD ou du juge d'instruction), puis la réémission des USDT vers un portefeuille de l'État. Ni SunSwap (protocole automatisé) ni ${nameA} ou ${nameB} n'ont de pouvoir sur une adresse auto-hébergée.`,
        },
        {
          id: 'o5', type: 'addresses', points: 15,
          prompt: 'Sélectionnez toutes les adresses de dépôt d\'exchange (Tron et Bitcoin) qui ont reçu une partie de la rançon.',
          answer: [D_a, D_b, depBtc],
          hint: 'Suivez chaque branche jusqu\'à une adresse étiquetée « Adresse de dépôt ». Certaines branches convergent vers la même adresse.',
          explanation:
            `Trois adresses de dépôt, donc trois comptes clients :\n` +
            `- ${nameA} ${A(w, D_a)} : ${amt(s3, 'USDT')} (branche directe) puis ${amt(peel1.payoutValue, 'USDT')} venus de la conversion des BTC ;\n` +
            `- ${nameB} ${A(w, D_b)} : ${amt(trxDeposited, 'TRX')} (après swap SunSwap) puis ${amt(s4, 'USDT')} (après un saut) ;\n` +
            `- ${nameBtc} ${A(w, depBtc)} : ${amt(btcDeposited, 'BTC')} en fin de peel chain.\n` +
            `Sur Tron, l'adresse de dépôt est propre à un client : deux branches qui y aboutissent désignent le même compte. ${procedureFor(exA.entity)}`,
        },
        {
          id: 'o6', type: 'address', points: 15,
          prompt: 'Une partie des bitcoins est revenue sur Tron. Quelle adresse Tron a reçu le produit de cette conversion ?',
          answer: [R],
          hint: `La première sortie de la peel chain part chez ChangeNOW. Corrélation : émetteur ChangeNOW, chaîne Tron, à partir de l'heure du dépôt, fenêtre d'environ 1 h, quelques % de tolérance sur ≈ ${Math.round(usd('BTC', cnValue)).toLocaleString('fr-FR')} $.`,
          explanation: `${A(w, B0)} envoie ${amt(cnValue, 'BTC')} (≈ ${Math.round(usd('BTC', cnValue)).toLocaleString('fr-FR')} $) à une adresse de dépôt ChangeNOW ; ${Math.round((peel1.payoutTx.time - peel1.depositTx.time) / 60)} minutes plus tard, ChangeNOW verse ${amt(peel1.payoutValue, 'USDT')} à ${A(w, R)}. Deux éléments confirment la corrélation : cette adresse a reçu ses TRX de frais du même financeur que la collecte (${A(w, P)}), et elle dépose ensuite les USDT sur la même adresse ${nameA} que la branche ${A(w, S3)}. Les deux volets de la rançon aboutissent donc au même compte.`,
        },
        {
          id: 'o7', type: 'choice', points: 20,
          prompt: 'Dans quel ordre engager les actes ?',
          ...choice(r,
            'Gel Tether sur l\'adresse qui détient les USDT, puis gel des comptes chez les exchanges, puis réquisitions d\'identification',
            [
              'Réquisitions d\'identification aux exchanges d\'abord, gel Tether une fois les titulaires connus',
              'Demander à SunSwap de bloquer les TRX issus du swap, puis requérir Tether pour le reste',
              'Requérir ChangeNOW pour l\'identité KYC du client, préalable indispensable à tout gel',
            ]),
          hint: 'Classez les actes selon la vitesse à laquelle les fonds peuvent encore bouger.',
          explanation: `Les fonds encore auto-hébergés peuvent partir en quelques secondes : le gel Tether de ${A(w, S1)} (${amt(frozen, 'USDT')}) passe en premier. Viennent ensuite les demandes de gel conservatoire des comptes ${nameA}, ${nameB} et ${nameBtc}, dont les soldes peuvent encore être retirés, puis les réquisitions d'identification (KYC, IP de connexion, historique) et la demande de données de commande à ChangeNOW (hash du dépôt BTC). ${procedureFor(exB.entity)} SunSwap est un contrat automatisé sans opérateur capable de bloquer, et ChangeNOW ne pratique pas de KYC.`,
        },
      ],
      truth: {
        path: [
          wTrx.id, wUsdt.id, ...gasTxs.map((t) => t.id), gangTestTx.id, proofTx.id, famTestTx.id, mainTx.id,
          ...splitTx.map((t) => t.id), swapRes.tx.id, s2Dep.tx.id, ...(s2Dep.sweep ? [s2Dep.sweep.id] : []),
          s3Dep.tx.id, ...(s3Dep.sweep ? [s3Dep.sweep.id] : []), s4Hop.id, s4Dep.tx.id, ...(s4Dep.sweep ? [s4Dep.sweep.id] : []),
          btcTx.id, peel1.depositTx.id, peel1.sweepTx.id, peel1.payoutTx.id, rDep.tx.id, ...(rDep.sweep ? [rDep.sweep.id] : []),
          peel2.id, peel3.id, btcSweep.id,
        ],
        addresses: [C, S1, S2, S3, S4, S4b, R, P, B0, B1, B2, D_a, D_b, depBtc, peel1.deposit],
        debrief:
          `1. Préparation : ${A(w, P)}, alimentée par un retrait ${nameB} (${amt(wTrx.transfers[0].value, 'TRX')} puis ${amt(gangTest, 'USDT')}), finance en TRX la collecte et toutes les adresses de fractionnement, puis envoie ${amt(gangTest, 'USDT')} de test à la collecte ${A(w, C)}.\n` +
          `2. Négociation : la collecte renvoie 1 USDT à la famille (preuve de contrôle), puis reçoit ${amt(famTest, 'USDT')} de test et ${amt(ransomUsdt, 'USDT')} le ${fmtDate(tMain)}.\n` +
          `3. En ${splitMin} minutes, ${amt(total, 'USDT')} sont répartis : ${amt(s1, 'USDT')} vers ${A(w, S1)} (immobile), ${amt(s2, 'USDT')} vers ${A(w, S2)}, ${amt(s3, 'USDT')} vers ${A(w, S3)}, ${amt(s4, 'USDT')} vers ${A(w, S4)}.\n` +
          `4. ${A(w, S2)} convertit ses USDT en ${amt(trxOut, 'TRX')} sur SunSwap et en dépose ${amt(trxDeposited, 'TRX')} chez ${nameB} ; ${A(w, S4)} fait un saut puis dépose ${amt(s4, 'USDT')} sur la même adresse ${nameB} ; ${A(w, S3)} dépose ${amt(s3, 'USDT')} chez ${nameA}.\n` +
          `5. Volet BTC : ${A(w, B0)} envoie ${amt(cnValue, 'BTC')} à ChangeNOW (payés ${amt(peel1.payoutValue, 'USDT')} sur ${A(w, R)}, puis déposés chez ${nameA}), ${amt(uValue, 'BTC')} à une adresse non identifiée, et le reliquat de ${amt(btcDeposited, 'BTC')} chez ${nameBtc}.\n` +
          `6. À H+${hNow}, seuls ${amt(frozen, 'USDT')} restent gelables par Tether, sur ${A(w, S1)}. Total déposé en USDT sur les exchanges : ${amt(totalUsdtOut, 'USDT')}.\n\n` +
          `À retenir : dans une affaire de rançon, le traçage se fait contre la montre. On cherche d'abord le solde encore détenu en USDT (gelable par l'émetteur), on distingue l'actif natif (TRX, non gelable) et on bascule ensuite vers les comptes d'exchange (gel puis identification). Les transferts « test » et le financement en TRX (gas) relient toutes les adresses des auteurs, et le retrait ${nameB} qui a alimenté ${A(w, P)} est une piste d'identification à part entière.`,
      },
      hints: [
        'Partez du paiement principal (PV) : la collecte se vide en quelques minutes. Ouvrez chacune de ses sorties et lisez le solde restant, actif par actif.',
        'Un USDT converti en TRX sur SunSwap échappe au gel de l\'émetteur ; un USDT déposé sur un exchange relève du gel du compte, pas de Tether.',
        'Côté Bitcoin, la première sortie de la peel chain va chez ChangeNOW : corrélez sur Tron (USDT) à partir de l\'heure et de la valeur du dépôt, puis vérifiez qui finance les frais de l\'adresse trouvée.',
      ],
    }
  },
}
