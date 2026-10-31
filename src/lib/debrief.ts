// Débrief visuel : ce que l'enquêteur a exploré, comparé au flux réel de
// l'affaire (transactions trouvées ou manquées, adresses clés, endroit où la
// piste a été perdue, explorations hors flux).
import { CHAINS, fmtAsset, fmtUsd, usd } from '../engine/chains'
import { shortAddr } from '../engine/addressgen'
import { attribution } from '../engine/analysis'
import type { Tx, World } from '../engine/world'
import type { ScenarioInstance } from '../scenarios/types'

export interface Explored {
  txs: Record<string, true>
  addrs: Record<string, true>
}

export interface DebriefTx {
  id: string
  time: number
  text: string
  usd: number
}

export interface DebriefStats {
  truthTotal: number
  truthFound: number
  pct: number
  keyTotal: number
  keyFound: number
  keyMissed: string[]
  offPath: number
  /** Première transaction du flux manquée alors qu'une étape antérieure avait été trouvée. */
  lostAt?: DebriefTx
  missed: DebriefTx[]
  /** Profil d'exploration, en une phrase. */
  verdict: string
}

function label(w: World, id: string): string {
  return attribution(w, id).label ?? shortAddr(w.get(id).addr, 6)
}

/** Résumé lisible d'une transaction : qui envoie quoi à qui. */
export function txSummary(w: World, tx: Tx): string {
  if (tx.model === 'utxo') {
    const native = CHAINS[tx.chain].native
    const from = label(w, tx.inputs[0]?.address ?? '')
    const outs = [...tx.outputs].sort((a, b) => b.value - a.value).slice(0, 2).map((o) => `${fmtAsset(o.value, native)} → ${label(w, o.address)}`)
    return `${from}${tx.inputs.length > 1 ? ` (+${tx.inputs.length - 1})` : ''} : ${outs.join(', ')}${tx.outputs.length > 2 ? '…' : ''}`
  }
  const t = [...tx.transfers].sort((a, b) => usd(b.asset, b.value) - usd(a.asset, a.value))[0]
  if (!t) return `${tx.method ?? 'appel'} (sans transfert)`
  return `${label(w, t.from)} → ${label(w, t.to)} : ${fmtAsset(t.value, t.asset)}${tx.method ? ` (${tx.method})` : ''}`
}

export function computeDebrief(inst: ScenarioInstance, ex: Explored): DebriefStats {
  const w = inst.world
  const truth = [...new Set(inst.truth.path)].map((id) => w.txs.get(id)).filter((t): t is Tx => !!t).sort((a, b) => a.time - b.time)
  const found = truth.filter((t) => ex.txs[t.id])
  const view = (t: Tx): DebriefTx => ({ id: t.id, time: t.time, text: txSummary(w, t), usd: w.txUsd(t) })
  const missed = truth.filter((t) => !ex.txs[t.id])
  // Piste perdue : la première transaction manquée qui suit une transaction trouvée
  let lostAt: Tx | undefined
  let seenFound = false
  for (const t of truth) {
    if (ex.txs[t.id]) seenFound = true
    else if (seenFound) {
      lostAt = t
      break
    }
  }
  const keys = [...new Set(inst.truth.addresses)].filter((a) => w.addresses.has(a))
  const keyMissed = keys.filter((a) => !ex.addrs[a])
  const truthSet = new Set(truth.map((t) => t.id))
  const offPath = Object.keys(ex.txs).filter((id) => !truthSet.has(id)).length
  const pct = truth.length ? found.length / truth.length : 0
  const ratio = offPath / Math.max(1, found.length)
  const verdict =
    pct >= 0.85 && ratio <= 1.5 ? 'Exploration ciblée : vous avez suivi le flux presque sans détour.'
      : pct >= 0.85 ? `Flux bien couvert, mais au prix de nombreux détours (${offPath} transactions hors flux) : apprenez à écarter plus tôt les pistes sans issue.`
        : pct >= 0.5 ? 'Flux partiellement reconstitué : regardez où la piste a été perdue et quelle information aurait permis de continuer.'
          : found.length ? 'La piste a été perdue tôt : reprenez le débrief étape par étape avant de rejouer une autre graine.'
            : 'Aucune transaction du flux réel n\'a été affichée sur le graphe : les réponses ont été cherchées ailleurs (inspecteur, outils) ou au hasard.'
  return {
    truthTotal: truth.length,
    truthFound: found.length,
    pct,
    keyTotal: keys.length,
    keyFound: keys.length - keyMissed.length,
    keyMissed,
    offPath,
    lostAt: lostAt ? view(lostAt) : undefined,
    missed: missed.slice(0, 8).map(view),
    verdict,
  }
}

export { fmtUsd }
