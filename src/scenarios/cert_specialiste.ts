import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, privacyPool, swapper, roundCoin, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'
import { dusting, lookalikeFlows, personalSpending, twinTransfers } from '../engine/realism'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const PREMIX_EXTRA = 0.00025

/**
 * Affaire d'examen (certification « Spécialiste ») : un seul suspect, trois
 * techniques de brouillage enchaînées (CoinJoin, échangeur instantané, pool de
 * confidentialité) et un leurre à chaque étape.
 */
export const certSpecialiste: ScenarioTemplate = {
  id: 'cert-specialiste',
  certOnly: true,
  title: 'Examen — Le labyrinthe',
  tagline: 'CoinJoin, échangeur instantané, Tornado : un suspect, trois brouillages, trois leurres.',
  description:
    'Une rançon en bitcoins passe dans un CoinJoin, ressort par un échangeur instantané vers Ethereum, puis traverse Tornado Cash avant d\'atteindre un exchange. À chaque étape, une erreur d\'hygiène permet de raccrocher la trace, et un leurre attend l\'analyste trop pressé.',
  difficulty: 4,
  chains: ['btc', 'eth'],
  skills: ['coinjoin', 'crosschain', 'privacy', 'cioh', 'exchange_id'],
  estMinutes: 90,
  lessons: ['coinjoin', 'chain-hopping', 'privacy-pools', 'demixage-avance'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const dir = fakePerson(r)
    const director = dir.name
    const dirLast = director.split(' ').slice(1).join(' ').toLowerCase()

    const cv = exchange(w, 'coinhouse', 'btc')
    const sw = swapper(w, 'changenow')
    const pp = privacyPool(w, 'tornado', 'eth')
    const outKey = r.pick(['kraken', 'okx', 'binance'] as const)
    const out = exchange(w, outKey, 'eth')
    const suspect = w.customEntity({ name: 'Groupe « Minotaure » (inconnu)', category: 'suspect' })
    const victimE = w.customEntity({ name: `Laboratoire ${r.pick(['Morel', 'Garnier', 'Roussel', 'Perrin'].filter((n) => n.toLowerCase() !== dirLast))}`, category: 'victim' })

    // ── Rançon ───────────────────────────────────────────────────────────────
    const denom = 0.1
    const m = r.int(4, 6)
    const P = r8(roundCoin(w, m * denom * 1.25, m * denom * 1.6, 0.001))
    const s0 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const victimAddr = w.addr('btc', { entity: victimE })
    cv.withdraw(victimAddr, r8(P + r.float(0.002, 0.006)), w.at(-r.float(6, 20)))
    const ransomTx = w.utxoTx({ time: w.at(0), from: [victimAddr], to: [{ address: s0, value: P }] })

    // ── Découpage avant mixage, puis CoinJoin (protocole WabiSabi de Wasabi) ──
    // Le suspect découpe la rançon en UTXO de la dénomination visée + une marge de frais :
    // chacune ressortira en une sortie standard. Le reliquat (rendu) n'est pas mixé.
    const premix = Array.from({ length: m }, () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' }))
    const toxic = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const tx0 = w.utxoTx({
      time: w.at(r.float(3, 10)), from: [s0], to: premix.map((p) => ({ address: p, value: r8(denom + PREMIX_EXTRA) })),
      change: toxic, fee: sat(r.int(2500, 9000)), spendAll: true, method: 'découpage avant mixage',
    })
    const toxicValue = tx0.outputs.find((o) => o.address === toxic)!.value
    // zkSNACKs a cessé de coordonner en juin 2024 : après cette date, coordinateur communautaire
    const zkEnd = Date.UTC(2024, 5, 1) / 1000
    if (tx0.time >= zkEnd) w.entity('wasabi', { name: 'Coordinateur CoinJoin communautaire (WabiSabi)', description: 'Coordinateur indépendant compatible avec Wasabi Wallet (protocole WabiSabi), apparu après l\'arrêt de zkSNACKs en juin 2024 : transactions collaboratives à sorties de montants standard, frais de coordination prélevés dans la transaction, aucun KYC.' })
    const coordName = w.entity('wasabi').name
    const cj = coinjoin(w, {
      chain: 'btc', time: tx0.time + r.float(1, 6) * HOUR, denom,
      participants: premix.map((p) => ({ from: p, changeTo: null })),
      extra: r.int(4, 7), coordinatorFee: r8(0.00002 * (m + 6)),
    })
    const mixed = cj.mixed
    // Leurre n° 1 : deux sorties de participants inconnus regroupées
    const strangers = cj.tx.outputs.filter((o) => Math.abs(o.value - denom) < 1e-9 && !mixed.includes(o.address)).map((o) => o.address)
    const fpTx = w.utxoTx({ time: cj.tx.time + r.float(3, 30) * HOUR, from: r.shuffle(strangers).slice(0, 2), to: [{ address: w.addr('btc'), value: r8(denom * 2 - 0.00006) }], fee: 0.00006, change: null, spendAll: true })

    // ── L'erreur post-mix : regroupement avec le rendu toxique, vers ChangeNOW ──
    const q = Math.min(m, r.int(2, 3))
    const used = r.shuffle([...mixed]).slice(0, q)
    const swDeposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const consIn = q * denom + toxicValue
    const consFee = w.estimateFee('btc', q + 1, 1)
    const consTx = w.utxoTx({ time: cj.tx.time + r.float(8, 40) * HOUR, from: r.shuffle([...used, toxic]), to: [{ address: swDeposit, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    const depBtc = r8(consIn - consFee)
    const sweepFee = w.estimateFee('btc', 1, 1)
    const swSweep = w.utxoTx({ time: consTx.time + r.int(300, 1500), from: [swDeposit], to: [{ address: sw.hot('btc'), value: r8(depBtc - sweepFee) }], fee: sweepFee, change: null, spendAll: true, tags: ['sweep'] })
    const e1 = w.addr('eth', { entity: suspect })
    const payEth = roundAsset('ETH', fromUsd('ETH', usd('BTC', depBtc) * (1 - r.float(0.007, 0.015))))
    const payT = consTx.time + r.int(8, 40) * 60
    const payoutTx = w.transfer({ time: payT, from: sw.hot('eth'), to: e1, value: payEth, asset: 'ETH', method: 'payout' })
    // Leurre n° 2 : autres paiements ChangeNOW de montant proche. Celui de valeur quasi identique
    // précède le dépôt ; les autres s'écartent d'au moins 4 % (jamais confondables avec le bon).
    for (let i = 0; i < r.int(6, 9); i++) {
      const tp = i === 0 ? consTx.time - r.int(10, 80) * 60 : payT + r.int(-3 * 3600, 4 * 3600)
      const sign = r.chance(0.5) ? 1 : -1
      let v = i === 0 ? payEth * r.float(0.985, 1.015) : i < 3 ? payEth * (1 + sign * r.float(0.04, 0.08)) : fromUsd('ETH', r.float(300, usd('ETH', payEth) * 2.5))
      if (i >= 3 && Math.abs(v / payEth - 1) < 0.1) v = payEth * (1 + sign * r.float(0.12, 0.6))
      w.transfer({ time: tp, from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', v), asset: 'ETH', method: 'payout' })
    }

    // ── Tornado Cash (1 ETH) ─────────────────────────────────────────────────
    const nDep = Math.max(3, Math.floor(payEth - 0.4))
    let t = payT + r.int(1, 3) * HOUR
    const deposits: Tx[] = []
    for (let i = 0; i < nDep; i++) {
      t += r.int(10, 40) * 60
      deposits.push(pp.deposit(e1, 1, t))
    }
    const firstDep = deposits[0].time
    const lastDep = t
    // Dépenses personnelles de l'adresse Ethereum, payées sur le reliquat du paiement (avant son envoi)
    const shop = (name: string, category: 'merchant' | 'gambling', description: string) => w.customEntity({ name, category, known: true, description })
    personalSpending(w, e1, { start: payT + HOUR, end: lastDep, n: 3, asset: 'ETH', maxUsd: 60, merchants: [
      shop('Securimail (messagerie chiffrée)', 'merchant', 'Messagerie chiffrée (fictive) avec abonnement payable en crypto-actifs : conserve l\'identifiant du compte et les dates de paiement.'),
      shop('Spinzo (casino en ligne)', 'gambling', 'Casino en ligne (fictif) acceptant l\'ETH, licence offshore, KYC au-delà d\'un seuil de retrait.'),
    ] })
    const rAddr = w.addr('eth', { entity: suspect })
    const residue = roundAsset('ETH', w.balanceOf(e1, 'ETH') - 0.02)
    const resTx = w.transfer({ time: lastDep + r.int(1, 5) * HOUR, from: e1, to: rAddr, value: residue, asset: 'ETH' })
    const withdrawals = Array.from({ length: nDep }, () => {
      const wa = w.addr('eth', { entity: suspect })
      return { addr: wa, tx: pp.withdraw(wa, 1, lastDep + Math.round(r.float(1, 10) * DAY), true) }
    })
    const K = w.addr('eth', { entity: suspect })
    const chosen = withdrawals.slice(0, Math.max(2, nDep - 1))
    const consolidations = chosen.map((c) => w.transfer({ time: c.tx.time + r.int(1, 24) * HOUR, from: c.addr, to: K, value: w.balanceOf(c.addr, 'ETH'), asset: 'ETH' }))
    const lastCons = Math.max(...consolidations.map((x) => x.time))
    const resToK = w.transfer({ time: lastCons - r.int(1, 12) * HOUR, from: rAddr, to: K, value: residue, asset: 'ETH' })
    // Leurre n° 3 : un autre utilisateur regroupe aussi des retraits de 1 ETH, dont un antérieur aux dépôts
    const decoyK = w.addr('eth')
    for (let i = 0; i < r.int(3, 5); i++) {
      const wa = w.addr('eth')
      const tw = i === 0 ? firstDep - Math.round(r.float(1, 3) * DAY) : lastDep + Math.round(r.float(1, 10) * DAY)
      const tx = pp.withdraw(wa, 1, tw, true)
      w.transfer({ time: tx.time + r.int(1, 20) * HOUR, from: wa, to: decoyK, value: w.balanceOf(wa, 'ETH'), asset: 'ETH' })
    }
    pp.noise(1, r.int(45, 65), firstDep - 6 * DAY, lastDep + 14 * DAY)

    // ── Sortie : dépôt sur l'exchange ───────────────────────────────────────
    const depEth = roundAsset('ETH', w.balanceOf(K, 'ETH') * r.float(0.97, 0.995))
    const dep = out.receive(K, depEth, lastCons + r.int(2, 18) * HOUR, { asset: 'ETH' })

    // ── Bruit ──
    cv.noise(8, w.at(-5 * 24), w.at(5 * 24))
    out.noise(14, lastCons - 3 * DAY, lastCons + 3 * DAY, 'ETH')

    // ── Habillage et fausses pistes (affaire d'examen : la plus exigeante) ───
    // Empoisonnement des adresses du suspect, vie propre de l'adresse Ethereum et
    // du collecteur, transferts jumeaux (même montant, même heure) et branches
    // mortes autour du flux. Ces apports sont « propres » : ils n'entrent pas
    // dans le traçage de la rançon, mais multiplient les pistes à écarter.
    // (poussière toujours postérieure à la première activité de l'adresse visée)
    const firstK = Math.min(resToK.time, ...consolidations.map((x) => x.time))
    dusting(w, s0, { time: ransomTx.time, n: 5, spreadH: 30, min: ransomTx.time + 600 })
    dusting(w, e1, { time: payT, n: 4, spreadH: 30, min: payT + 600 })
    dusting(w, K, { time: lastCons, n: 3, spreadH: 40, min: firstK + 600 })
    personalSpending(w, K, { start: dep.tx.time + 2 * HOUR, end: dep.tx.time + 15 * DAY, n: 3, asset: 'ETH', merchants: [
      shop('Cadeaurama (cartes cadeaux)', 'merchant', 'Revendeur (fictif) de cartes cadeaux payables en crypto-actifs : conserve l\'adresse e-mail de livraison des codes.'),
      shop('Kordel Cloud (serveurs VPS)', 'merchant', 'Hébergeur de serveurs privés virtuels (fictif) acceptant l\'ETH : conserve l\'e-mail du client et les adresses IP de connexion.'),
    ] })
    // Jumeaux de 1 ETH autour du premier dépôt, chacun financé juste avant par un apport extérieur
    // du montant exact (toujours après le paiement de ChangeNOW, première activité de l'adresse)
    for (let i = 0; i < 4; i++) {
      const v = roundAsset('ETH', 1 + r.float(-0.004, 0.004))
      const tt = firstDep + r.int(-25, 25) * 60
      w.fundAccount(e1, v, 'ETH', Math.max(payT + 600, tt - r.int(600, 3 * 3600)))
      w.transfer({ time: tt, from: e1, to: w.addr('eth'), value: v, asset: 'ETH' })
    }
    const twinsK = twinTransfers(w, K, { value: depEth, time: dep.tx.time, n: 3, asset: 'ETH' })
    lookalikeFlows(w, { chain: 'eth', value: payEth, time: payT, n: 3, asset: 'ETH' })

    return {
      world: w,
      title: `Opération Minotaure — ${city}`,
      briefing:
        `Le ${victimE.name}, à ${city}, a payé une rançon de ${amt(P, 'BTC')} après le chiffrement de ses serveurs. ${dir.g('Le directeur', 'La directrice')}, ${director}, a déposé plainte.\n\n` +
        `Le groupe est connu pour brouiller ses traces : CoinJoin, échangeur instantané, pool de confidentialité. Aucune de ces étapes n'est infranchissable si l'utilisateur commet une erreur, mais chacune comporte des pistes trompeuses.\n\n` +
        `Retrouvez le parcours des fonds jusqu'à leur sortie, en écartant explicitement les leurres. Le rapport doit dire, pour chaque rattachement, sur quel indice il repose.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Note de rançon', date: w.at(-6),
          body: `Vos fichiers sont chiffrés. Pour la clé : ${amt(P, 'BTC')} sur ${A(w, s0)}. Aucune négociation.`,
        },
        {
          id: 'pv', type: 'pv', title: `PV d'audition ${dir.g('du directeur', 'de la directrice')} (extrait)`, date: w.at(2 * 24), author: director,
          body: `« Nous avons acheté les bitcoins chez Coinhouse et payé le ${fmtDate(ransomTx.time)}. Transaction : ${ransomTx.hash}. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui', date: w.at(3 * 24), author: 'Cellule d\'appui crypto',
          body: `Le groupe découpe ses fonds avant de les mixer dans des CoinJoin de type Wasabi (sorties standard de ${amt(denom, 'BTC')}), puis passe par un échangeur instantané. Il a déjà été vu sur Tornado Cash. Méfiance : les regroupements de sorties mixées ne désignent personne s'ils ne touchent aucune adresse du suspect.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 15,
          prompt: 'Quelle transaction post-mix rattache des sorties du CoinJoin au suspect ?',
          answer: [consTx.id],
          explanation: `${consTx.hash.slice(0, 16)}… dépense ensemble le rendu non mixé du découpage et ${q} sorties mixées : par entrées communes, elles reviennent au propriétaire de ce rendu. Le regroupement ${fpTx.hash.slice(0, 12)}… réunit aussi deux sorties mixées, mais aucune adresse du suspect : c'est le leurre.`,
        },
        {
          id: 'o2', type: 'address', points: 20,
          prompt: 'Quelle adresse Ethereum a reçu le paiement de ChangeNOW correspondant au dépôt du suspect ?',
          answer: [e1],
          explanation: `Le dépôt de ${amt(depBtc, 'BTC')} chez ChangeNOW est suivi ${Math.round((payT - consTx.time) / 60)} minutes plus tard d'un paiement de ${amt(payEth, 'ETH')} vers ${A(w, e1)}, soit la valeur déposée moins une commission d'environ 1 %. Les autres paiements de ChangeNOW de montant voisin sont écartés : celui de valeur quasi identique part avant même le dépôt du suspect, les autres s'écartent d'au moins 4 % de la valeur attendue, et aucun destinataire ne dépose ensuite dans Tornado Cash. Les envois de montant voisin venus d'adresses tierces, à la même heure, ne sont pas des paiements de ChangeNOW.`,
        },
        {
          id: 'o3', type: 'address', points: 20,
          prompt: 'Quelle adresse regroupe des retraits de Tornado Cash attribuables au suspect ?',
          answer: [K],
          explanation: `${A(w, K)} reçoit ${chosen.length} retraits de 1 ETH, tous postérieurs aux ${nDep} dépôts du suspect, ainsi que le reliquat non mixé (${amt(residue, 'ETH')}) parti de ${A(w, e1)} via ${A(w, rAddr)}. Ce lien non mixé est l'erreur d'hygiène qui rattache le collecteur.`,
        },
        {
          id: 'o4', type: 'entity', points: 15,
          prompt: 'Sur quel exchange les fonds sortent-ils ?',
          answer: [outKey],
          explanation: `Le collecteur dépose ${amt(depEth, 'ETH')} sur une adresse de dépôt ${out.entity.name}. ${procedureFor(out.entity)}`,
        },
        {
          id: 'o5', type: 'amount', points: 15, unit: 'ETH', tolerance: 0.02,
          prompt: 'Combien d\'ETH ont été déposés sur cet exchange ?',
          answer: depEth,
          explanation: `${amt(depEth, 'ETH')}, envoyés par le collecteur sur l'adresse de dépôt ${out.entity.name}. Dans la même demi-heure, ${twinsK.txs.length} envois de montant voisin (${twinsK.txs.map((t) => amt(t.transfers[0].value, 'ETH')).join(', ')}) partent du collecteur vers des adresses neuves : ce ne sont pas des dépôts chez l'exchange (adresses non attribuées, sans balayage), et chacun est précédé d'un apport extérieur du même montant, simple transit sans lien avec les retraits de Tornado Cash.`,
        },
        {
          id: 'o6', type: 'choice', points: 12,
          prompt: 'Une autre adresse regroupe elle aussi plusieurs retraits de 1 ETH du même pool. Pourquoi l\'écarter ?',
          ...choice(r,
            'L\'un de ses retraits est antérieur au premier dépôt du suspect : ce ne peut pas être ses fonds',
            [
              'Ses retraits passent par un relayer, contrairement à ceux du suspect',
              'Elle reçoit moins de retraits que le collecteur du suspect',
              'Un retrait de 1 ETH est trop petit pour un groupe criminel',
            ]),
          explanation: `Un pool ne rend que ce qui y a été déposé avant : un retrait antérieur au premier dépôt du suspect appartient à quelqu'un d'autre. Le relayer est partagé par tous, et le nombre de retraits ne prouve rien à lui seul.`,
        },
        {
          id: 'o7', type: 'address', points: 10,
          prompt: 'Quelle est la première adresse du suspect, celle communiquée dans la note de rançon ?',
          answer: [s0],
          explanation: `${A(w, s0)} reçoit les ${amt(P, 'BTC')} de la victime (${ransomTx.hash.slice(0, 12)}…). C'est le point de départ du traçage ; méfiez-vous des micro-envois d'adresses sosies (empoisonnement) qui encombrent son historique sans rien signifier.`,
        },
        {
          id: 'o8', type: 'number', points: 12, tolerance: 0, unit: 'UTXO',
          prompt: 'Avant le CoinJoin, en combien d\'UTXO de montant identique la rançon est-elle découpée ?',
          answer: m,
          explanation: `${tx0.hash.slice(0, 12)}… crée ${m} sorties de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} (dénomination ${amt(denom, 'BTC')} + marge de frais) et un rendu. Le coordinateur (${coordName}) accepte des entrées de tout montant : en découpant d'avance, le suspect s'assure que chaque UTXO ressortira en une sortie standard. Ce découpage annonce combien de sorties mixées il faudra retrouver après le CoinJoin.`,
        },
        {
          id: 'o9', type: 'address', points: 12,
          prompt: 'Quelle adresse reçoit le rendu de ce découpage, qui n\'entrera jamais dans le CoinJoin ?',
          answer: [toxic],
          explanation: `${A(w, toxic)} reçoit ${amt(toxicValue, 'BTC')}, le reliquat qui ne remplit pas une dénomination. C'est lui qui, dépensé avec des sorties mixées, « démixe » le CoinJoin par entrées communes : la clé de toute l'affaire.`,
        },
        {
          id: 'o10', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.001,
          prompt: 'Quel montant de BTC est déposé chez l\'échangeur instantané (ChangeNOW) ?',
          answer: depBtc,
          explanation: `La transaction de regroupement post-mix verse ${amt(depBtc, 'BTC')} sur l'adresse de dépôt ChangeNOW ${A(w, swDeposit).slice(0, 12)}…, balayée aussitôt vers le hot wallet de l'échangeur. Ce montant, et le délai, servent à corréler le paiement de sortie en ETH.`,
        },
        {
          id: 'o11', type: 'address', points: 12,
          prompt: 'Quelle adresse de dépôt citerez-vous dans la réquisition à l\'exchange de sortie ?',
          answer: [dep.deposit],
          explanation: `${A(w, dep.deposit)} reçoit ${amt(depEth, 'ETH')} du collecteur, le ${fmtDate(dep.tx.time)} ; c'est le compte client à identifier et à geler, pas le hot wallet ${de(out.entity.name)}.`,
        },
        {
          id: 'o12', type: 'choice', points: 12,
          prompt: 'Après le CoinJoin, deux regroupements de sorties mixées apparaissent. Lequel rattache les fonds au suspect, et pourquoi ?',
          ...choice(r,
            'Celui qui dépense des sorties mixées AVEC le rendu non mixé du découpage : par entrées communes, il revient au propriétaire du rendu',
            [
              'Le regroupement de deux sorties mixées étrangères : il est plus ancien, donc prioritaire',
              'Celui qui comporte le plus de sorties : la quantité prouve l\'appartenance',
              'Aucun : un regroupement de sorties de CoinJoin ne peut jamais être rattaché',
            ]),
          explanation: `Seul le regroupement qui mêle des sorties mixées au rendu non mixé (${A(w, toxic).slice(0, 10)}…) est rattachable : l'heuristique des entrées communes relie toutes les entrées d'une même transaction au même portefeuille. Le regroupement ${fpTx.hash.slice(0, 10)}… ne réunit que des sorties de participants inconnus, sans aucune adresse du suspect : c'est le leurre.`,
        },
      ],
      truth: {
        path: [ransomTx.id, tx0.id, cj.tx.id, consTx.id, swSweep.id, payoutTx.id, ...deposits.map((d) => d.id), resTx.id, ...chosen.map((c) => c.tx.id), ...consolidations.map((c) => c.id), resToK.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : [])],
        addresses: [s0, toxic, ...used, swDeposit, e1, rAddr, K, dep.deposit],
        debrief:
          `1. La rançon (${amt(P, 'BTC')}) arrive sur ${A(w, s0)}, découpée en ${m} UTXO de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} et un rendu non mixé (${A(w, toxic)}), avant un CoinJoin coordonné par ${coordName}.\n` +
          `2. Après le CoinJoin, ${q} sorties mixées sont dépensées avec ce rendu et envoyées chez ChangeNOW : c'est l'erreur qui démixe.\n` +
          `3. ChangeNOW paie ${amt(payEth, 'ETH')} à ${A(w, e1)} (corrélation montant / délai, à confirmer par réquisition).\n` +
          `4. ${A(w, e1)} dépose ${nDep} × 1 ETH dans Tornado Cash et envoie le reliquat à ${A(w, rAddr)}.\n` +
          `5. ${chosen.length} retraits convergent vers ${A(w, K)}, qui reçoit aussi le reliquat puis dépose ${amt(depEth, 'ETH')} chez ${out.entity.name}.\n\n` +
          `Leurres : le regroupement de deux sorties mixées étrangères, les paiements ChangeNOW de montant voisin (l'un antérieur au dépôt, les autres décalés d'au moins 4 %), les envois jumeaux de 1 ETH et de ${amt(depEth, 'ETH')} vers des adresses neuves (chacun précédé d'un apport extérieur du même montant), et le collecteur dont un retrait précède les dépôts du suspect.`,
      },
      hints: [],
    }
  },
}
