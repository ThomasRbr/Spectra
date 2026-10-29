import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, privacyPool, swapper, roundCoin, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

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
    const director = fakeName(r)

    const cv = exchange(w, 'coinhouse', 'btc')
    const sw = swapper(w, 'changenow')
    const pp = privacyPool(w, 'tornado', 'eth')
    const outKey = r.pick(['kraken', 'okx', 'binance'] as const)
    const out = exchange(w, outKey, 'eth')
    const suspect = w.customEntity({ name: 'Groupe « Minotaure » (inconnu)', category: 'suspect' })
    const victimE = w.customEntity({ name: `Laboratoire ${r.pick(['Morel', 'Garnier', 'Roussel', 'Perrin'])}`, category: 'victim' })

    // ── Rançon ───────────────────────────────────────────────────────────────
    const denom = 0.1
    const m = r.int(4, 6)
    const P = r8(roundCoin(w, m * denom * 1.25, m * denom * 1.6, 0.001))
    const s0 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const victimAddr = w.addr('btc', { entity: victimE })
    cv.withdraw(victimAddr, r8(P + r.float(0.002, 0.006)), w.at(-r.float(6, 20)))
    const ransomTx = w.utxoTx({ time: w.at(0), from: [victimAddr], to: [{ address: s0, value: P }] })

    // ── Tx0 et CoinJoin ──────────────────────────────────────────────────────
    const premix = Array.from({ length: m }, () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' }))
    const toxic = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const tx0 = w.utxoTx({
      time: w.at(r.float(3, 10)), from: [s0], to: premix.map((p) => ({ address: p, value: r8(denom + PREMIX_EXTRA) })),
      change: toxic, fee: sat(r.int(2500, 9000)), spendAll: true, tags: ['tx0'], method: 'Tx0 (pré-mix)',
    })
    const toxicValue = tx0.outputs.find((o) => o.address === toxic)!.value
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
    // Leurre n° 2 : autres paiements ChangeNOW de montant proche, dont un avant le dépôt
    for (let i = 0; i < r.int(6, 9); i++) {
      const close = i < 3
      const dt = i === 0 ? -r.int(20, 90) * 60 : r.int(-3 * 3600, 4 * 3600)
      const v = close ? payEth * r.float(0.97, 1.03) : fromUsd('ETH', r.float(300, usd('ETH', payEth) * 2.5))
      w.transfer({ time: payT + dt, from: sw.hot('eth'), to: w.addr('eth'), value: roundAsset('ETH', v), asset: 'ETH', method: 'payout' })
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

    return {
      world: w,
      title: `Opération Minotaure — ${city}`,
      briefing:
        `Le ${victimE.name}, à ${city}, a payé une rançon de ${amt(P, 'BTC')} après le chiffrement de ses serveurs. Le directeur, ${director}, a déposé plainte.\n\n` +
        `Le groupe est connu pour brouiller ses traces : CoinJoin, échangeur instantané, pool de confidentialité. Aucune de ces étapes n'est infranchissable si l'utilisateur commet une erreur, mais chacune comporte des pistes trompeuses.\n\n` +
        `Retrouvez le parcours des fonds jusqu'à leur sortie, en écartant explicitement les leurres. Le rapport doit dire, pour chaque rattachement, sur quel indice il repose.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Note de rançon', date: w.at(-6),
          body: `Vos fichiers sont chiffrés. Pour la clé : ${amt(P, 'BTC')} sur ${A(w, s0)}. Aucune négociation.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'audition du directeur (extrait)', date: w.at(2 * 24), author: director,
          body: `« Nous avons acheté les bitcoins chez Coinhouse et payé le ${fmtDate(ransomTx.time)}. Transaction : ${ransomTx.hash}. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui', date: w.at(3 * 24), author: 'Cellule d\'appui crypto',
          body: `Le groupe utilise un CoinJoin à dénomination fixe (${denom} BTC), puis un échangeur instantané. Il a déjà été vu sur Tornado Cash. Méfiance : les regroupements de sorties mixées ne désignent personne s'ils ne touchent aucune adresse du suspect.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 15,
          prompt: 'Quelle transaction post-mix rattache des sorties du CoinJoin au suspect ?',
          answer: [consTx.id],
          explanation: `${consTx.hash.slice(0, 16)}… dépense ensemble le rendu toxique de la Tx0 et ${q} sorties mixées : par entrées communes, elles reviennent au propriétaire du rendu toxique. Le regroupement ${fpTx.hash.slice(0, 12)}… réunit aussi deux sorties mixées, mais aucune adresse du suspect : c'est le leurre.`,
        },
        {
          id: 'o2', type: 'address', points: 20,
          prompt: 'Quelle adresse Ethereum a reçu le paiement de ChangeNOW correspondant au dépôt du suspect ?',
          answer: [e1],
          explanation: `Le dépôt de ${amt(depBtc, 'BTC')} chez ChangeNOW est suivi ${Math.round((payT - consTx.time) / 60)} minutes plus tard d'un paiement de ${amt(payEth, 'ETH')} vers ${A(w, e1)}, soit la valeur déposée moins une commission d'environ 1 %. Les paiements de montant proche sont écartés : l'un précède le dépôt, les autres n'ont pas la bonne valeur ou ne déposent pas ensuite dans Tornado.`,
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
          explanation: `${amt(depEth, 'ETH')}, envoyés par le collecteur sur l'adresse de dépôt ${out.entity.name}.`,
        },
        {
          id: 'o6', type: 'choice', points: 15,
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
      ],
      truth: {
        path: [ransomTx.id, tx0.id, cj.tx.id, consTx.id, swSweep.id, payoutTx.id, ...deposits.map((d) => d.id), resTx.id, ...chosen.map((c) => c.tx.id), ...consolidations.map((c) => c.id), resToK.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : [])],
        addresses: [s0, toxic, ...used, swDeposit, e1, rAddr, K, dep.deposit],
        debrief:
          `1. La rançon (${amt(P, 'BTC')}) arrive sur ${A(w, s0)}, découpée par une Tx0 en ${m} UTXO de pré-mix et un rendu toxique (${A(w, toxic)}).\n` +
          `2. Après le CoinJoin, ${q} sorties mixées sont dépensées avec le rendu toxique et envoyées chez ChangeNOW : c'est l'erreur qui démixe.\n` +
          `3. ChangeNOW paie ${amt(payEth, 'ETH')} à ${A(w, e1)} (corrélation montant / délai, à confirmer par réquisition).\n` +
          `4. ${A(w, e1)} dépose ${nDep} × 1 ETH dans Tornado Cash et envoie le reliquat à ${A(w, rAddr)}.\n` +
          `5. ${chosen.length} retraits convergent vers ${A(w, K)}, qui reçoit aussi le reliquat, puis déposent ${amt(depEth, 'ETH')} chez ${out.entity.name}.\n\n` +
          `Leurres : le regroupement de deux sorties mixées étrangères, les paiements ChangeNOW de montant proche, et le collecteur dont un retrait précède les dépôts du suspect.`,
      },
      hints: [],
    }
  },
}
