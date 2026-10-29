// Mesure les heuristiques du lot 2 contre la vérité terrain des missions :
// empreinte de portefeuille (analyse de rendu), adresses de dépôt sur les
// modèles à comptes, rapprochement des échangeurs instantanés, peel chains.
// Usage : npx tsx scripts/check-heuristics.ts [idScenario]
import { SCENARIOS } from '../src/scenarios/index'
import { changeAnalysis, detectCoinjoin, txFingerprint } from '../src/engine/analysis'
import { depositAnalysis, followPeelChain, instantSwapDeposit, matchInstantSwap } from '../src/engine/heuristics'
import { CHAINS } from '../src/engine/chains'

const only = process.argv[2]
const c = { fpRight: 0, fpWrong: 0, changeTop: 0, changeTotal: 0, depHit: 0, depTotal: 0, depFalse: 0, swapTop: 0, swapTotal: 0, peelHit: 0, peelTotal: 0, invalid: 0 }
const problems: string[] = []

for (const s of SCENARIOS) {
  if (only && s.id !== only) continue
  for (const seed of [1, 42, 1337]) {
    const inst = s.generate(seed)
    const w = inst.world
    const truth = new Set(inst.truth.path)

    for (const tx of w.txs.values()) {
      if (tx.model !== 'utxo') continue
      const fp = txFingerprint(w, tx)
      if (!fp || !Number.isFinite(fp.feeRate)) c.invalid++
      if (detectCoinjoin(tx).is || tx.outputs.length < 2 || !tx.inputs.length) continue
      // Rendu réel : sortie du même portefeuille logiciel que la première entrée
      const wallet = w.get(tx.inputs[0].address).wallet
      const mine = tx.outputs.filter((o) => w.get(o.address).wallet === wallet && !tx.inputs.some((i) => i.address === o.address))
      if (mine.length !== 1) continue
      const ca = changeAnalysis(w, tx)
      c.changeTotal++
      if ([...ca].sort((a, b) => b.score - a.score)[0]?.address === mine[0].address) c.changeTop++
      for (const cand of ca) {
        const r = cand.reasons.find((x) => x.text.includes('logiciel'))
        if (!r) continue
        const isChange = cand.address === mine[0].address
        if ((r.weight > 0) === isChange) c.fpRight++
        else c.fpWrong++
      }
    }

    for (const a of w.addresses.values()) {
      if (CHAINS[a.chain].model !== 'account' || a.contract) continue
      const v = depositAnalysis(w, a.id)
      const isDeposit = a.tags.includes('deposit') && w.txsOf(a.id).some((t) => w.flowOut(t, a.id).length)
      if (isDeposit) {
        c.depTotal++
        if (v.role === 'deposit') c.depHit++
      } else if (v.role === 'deposit' && v.targetEntity && v.targetEntity.category !== 'individual') c.depFalse++
    }

    for (const id of inst.truth.path) {
      const tx = w.txs.get(id)
      if (!tx) continue
      const dep = instantSwapDeposit(w, tx)
      if (!dep) continue
      const m = matchInstantSwap(w, tx.id, dep)
      const outs = m.candidates.length ? m.candidates : []
      // N'est mesurable que si le paiement réel figure dans le flux de vérité.
      const real = [...truth].find((t) => {
        const p = w.txs.get(t)
        return p && p.time > tx.time && p.time - tx.time < 4 * 3600 && p.tags.includes('payout')
      })
      if (!real) continue
      c.swapTotal++
      if (outs[0]?.txId === real) c.swapTop++
      else problems.push(`${s.id}#${seed} : échangeur, paiement réel classé ${outs.findIndex((x) => x.txId === real) + 1 || '—'}`)
    }

    // Peel chains : départ = entrée d'une tx « peel » qui n'est pas elle-même issue d'une tx « peel »
    const peels = [...w.txs.values()].filter((t) => t.tags.includes('peel'))
    const fromPeel = new Set(peels.flatMap((t) => t.outputs.map((o) => o.address)))
    for (const t of peels) {
      const start = t.inputs[0].address
      if (fromPeel.has(start)) continue
      const chain = new Set<string>()
      let cur: string | undefined = start
      while (cur) {
        const next: typeof t | undefined = peels.find((p) => p.inputs[0].address === cur)
        if (!next) break
        chain.add(next.id)
        cur = [...next.outputs].sort((a, b) => b.value - a.value)[0]?.address
        if (chain.size > 100) break
      }
      if (chain.size < 3) continue
      const r = followPeelChain(w, start)
      c.peelTotal++
      const got = r.txIds.filter((x) => chain.has(x)).length
      if (got / chain.size >= 0.9) c.peelHit++
      else problems.push(`${s.id}#${seed} : peel chain ${got}/${chain.size} sauts suivis (${r.end.reason})`)
    }
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—')
console.log(`Empreinte : raison juste ${c.fpRight}/${c.fpRight + c.fpWrong} (${pct(c.fpRight, c.fpRight + c.fpWrong)})`)
console.log(`Rendu : bonne sortie en tête ${c.changeTop}/${c.changeTotal} (${pct(c.changeTop, c.changeTotal)})`)
console.log(`Dépôts : ${c.depHit}/${c.depTotal} détectés (${pct(c.depHit, c.depTotal)}), ${c.depFalse} faux positif(s) vers un service`)
console.log(`Échangeurs : paiement réel en tête ${c.swapTop}/${c.swapTotal} (${pct(c.swapTop, c.swapTotal)})`)
console.log(`Peel chains : ${c.peelHit}/${c.peelTotal} suivies à 90 % ou plus`)
if (problems.length) console.log(problems.slice(0, 30).join('\n'))
if (c.invalid) console.log(`${c.invalid} empreinte(s) invalide(s)`)
const bad = c.invalid > 0 || c.fpRight < (c.fpRight + c.fpWrong) * 0.7 || c.depHit < c.depTotal * 0.8 || c.swapTop < c.swapTotal * 0.7 || c.peelHit < c.peelTotal * 0.8
process.exit(bad ? 1 : 0)
