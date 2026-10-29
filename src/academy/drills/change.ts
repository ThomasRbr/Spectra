// Exercice « quelle sortie est le rendu ? », construit avec le moteur de
// simulation puis vérifié par l'analyse de rendu (changeAnalysis).
import { Rng } from '../../engine/rng'
import { World, type Tx } from '../../engine/world'
import { changeAnalysis, type ChangeCandidate } from '../../engine/analysis'
import { KIND_LABEL, shortAddr, type AddrKind } from '../../engine/addressgen'
import type { ChainId } from '../../engine/chains'
import type { DrillDef, DrillItem } from '../model'
import { fr, mkChoice, rngFor } from './util'

type Variant = 'type' | 'round' | 'reuse' | 'batch' | 'fresh'

const ROUND_STEPS = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.075, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1]

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

export interface Built {
  w: World
  tx: Tx
  changeAddr: string
  variant: Variant
  chain: ChainId
  kind: AddrKind
  nPay: number
}

function build(seed: number, variant: Variant): Built | null {
  const w = new World(seed)
  const rng = w.rng
  const chain: ChainId = rng.chance(0.85) ? 'btc' : 'ltc'
  const kinds: AddrKind[] = chain === 'btc' ? ['p2wpkh', 'p2wpkh', 'p2pkh', 'p2sh', 'p2tr'] : ['p2wpkh', 'p2pkh', 'p2sh']
  const kind = rng.pick(kinds)
  const other = rng.pick(kinds.filter((k) => k !== kind))
  const t = w.at(0)
  const nIn = rng.weighted([[1, 3], [2, 3], [3, 1]] as const)
  const wallet = w.addrs(chain, nIn, { kind })
  let total = 0
  for (const a of wallet) {
    const v = r8(rng.float(0.02, 0.9))
    total += v
    w.fund(a, v, t - rng.int(2, 40) * 86400)
  }
  const nPay = variant === 'batch' ? 2 : 1
  const pays: { address: string; value: number }[] = []
  let left = total * 0.85
  for (let i = 0; i < nPay; i++) {
    const roundPay = variant === 'round' || variant === 'batch' || (variant === 'type' && rng.chance(0.6)) || (variant === 'reuse' && rng.chance(0.5))
    let v: number
    if (roundPay) {
      const ok = ROUND_STEPS.filter((s) => s <= left / (nPay - i) && s >= 0.005)
      if (!ok.length) return null
      v = rng.pick(ok)
    } else {
      v = r8(left * rng.float(0.25, 0.7) / (nPay - i))
    }
    left -= v
    const recKind: AddrKind = variant === 'type' ? other : variant === 'batch' ? rng.pick(kinds) : kind
    const rec = w.addr(chain, { kind: recKind })
    if (variant === 'fresh' || rng.chance(0.3)) {
      for (let h = rng.int(1, 3); h > 0; h--) w.fund(rec, r8(rng.float(0.001, 0.2)), t - rng.int(1, 60) * 86400)
    }
    pays.push({ address: rec, value: v })
  }
  const tx = w.utxoTx({ time: t, from: wallet, to: pays, change: variant === 'reuse' ? wallet[0] : undefined, spendAll: true })
  const payAddrs = new Set(pays.map((p) => p.address))
  const ch = tx.outputs.find((o) => !payAddrs.has(o.address))
  if (!ch || tx.outputs.length !== nPay + 1) return null
  return { w, tx, changeAddr: ch.address, variant, chain, kind, nPay }
}

function ranked(b: Built): ChangeCandidate[] {
  return [...changeAnalysis(b.w, b.tx)].sort((x, y) => y.score - x.score)
}

export function isClear(b: Built): boolean {
  const r = ranked(b)
  return r.length >= 2 && r[0].address === b.changeAddr && r[0].score - r[1].score >= 1.5
}

const INTROS = [
  'Le suspect a réglé un achat depuis son portefeuille.',
  'Cette transaction part des adresses contrôlées par le suspect.',
  'Vous suivez les fonds de la victime : voici la transaction suivante.',
  'L\'adresse du suspect envoie des fonds à un tiers.',
]

export const utxoChange: DrillDef = {
  id: 'utxo-change',
  title: 'Trouver le rendu',
  description: 'Repérer la sortie qui revient au portefeuille de l\'émetteur grâce aux heuristiques de rendu.',
  level: 2,
  track: 'bitcoin',
  icon: 'Coins',
  generate(seed) {
    const rng = rngFor(seed, 'utxo-change')
    return render(rng, pickChangeCase(rng, seed))
  },
}

/** Tire une transaction dont le rendu est clairement désigné par les heuristiques (boucle bornée). */
export function pickChangeCase(rng: Rng, seed: number): Built {
  const variant = rng.weighted([['type', 3], ['round', 3], ['reuse', 1.5], ['batch', 2], ['fresh', 1.5]] as const) as Variant
  for (let i = 0; i < 12; i++) {
    const cand = build((seed * 7919 + i * 104729 + 17) >>> 0, i < 8 ? variant : 'reuse')
    if (cand && isClear(cand)) return cand
  }
  // Repli : retour sur l'adresse d'entrée (indice le plus fort).
  for (let i = 0; i < 50; i++) {
    const cand = build((seed + 0x5bd1e995 + i) >>> 0, 'reuse')
    if (cand && isClear(cand)) return cand
  }
  throw new Error('utxo-change : aucun cas exploitable')
}

function render(rng: Rng, b: Built): DrillItem {
  const { w, tx } = b
  const unit = b.chain === 'btc' ? 'BTC' : 'LTC'
  const hist = (addr: string) => w.txsOf(addr).filter((t) => t.id !== tx.id && t.time <= tx.time).length
  const inAddrs = new Set(tx.inputs.map((i) => i.address))
  const outLabel = (addr: string) => {
    if (inAddrs.has(addr)) return 'Adresse d\'entrée'
    const h = hist(addr)
    return h === 0 ? 'Adresse neuve (1re apparition)' : `Déjà vue (${h} tx antérieure${h > 1 ? 's' : ''})`
  }
  const optLabel = (n: number) => {
    const o = tx.outputs[n]
    return `Sortie #${n + 1} — ${shortAddr(w.get(o.address).addr, 8)} — ${fr(r8(o.value), 8)} ${unit}`
  }
  const correctIdx = tx.outputs.findIndex((o) => o.address === b.changeAddr)
  const NONE = 'Aucune : cette transaction n\'a pas de rendu'
  const distract = tx.outputs.map((_, i) => i).filter((i) => i !== correctIdx).map(optLabel)
  if (tx.outputs.length < 3 || rng.chance(0.4)) distract.push(NONE)
  const { options, answer } = mkChoice(rng, optLabel(correctIdx), distract, 5)
  const r = ranked(b)
  const changeCand = r[0]
  const trap = r[1]
  const fmtReasons = (c: ChangeCandidate) =>
    c.reasons.map((x) => `${x.weight > 0 ? '+' : '−'} ${x.text}`).join(' ; ')
  const inKind = KIND_LABEL[b.kind]
  return {
    prompt: 'Quelle sortie est vraisemblablement le rendu (retour au portefeuille de l\'émetteur) ?',
    context: `${rng.pick(INTROS)} Les entrées sont de type ${inKind}. L'historique de chaque adresse de sortie est indiqué.`,
    visual: {
      type: 'tx',
      chain: b.chain,
      asset: unit,
      hash: tx.hash,
      time: tx.time,
      inputs: tx.inputs.map((i) => ({ address: w.get(i.address).addr, value: r8(i.value) })),
      outputs: tx.outputs.map((o) => ({ address: w.get(o.address).addr, value: r8(o.value), label: outLabel(o.address) })),
    },
    kind: 'choice',
    options,
    answer,
    explain:
      `La sortie #${correctIdx + 1} cumule les indices de rendu : ${fmtReasons(changeCand)}.\n\n` +
      `Le piège principal est la sortie #${trap.n + 1} : ${fmtReasons(trap)}.\n\n` +
      'Rappels : un paiement est souvent un montant rond (le prix convenu), vers une adresse que le portefeuille de l\'émetteur ne génère pas (autre type de script, adresse déjà connue). Le rendu, lui, est le « reste » au montant quelconque, généralement sur une adresse neuve du même type que les entrées — ou, pour les portefeuilles mal conçus, sur l\'adresse d\'entrée elle-même. ' +
      (options.includes(NONE) ? `« Aucune » est peu plausible : il faudrait que les UTXO dépensées couvrent exactement les paiements plus les frais ; une transaction sans rendu n'a d'ordinaire qu'une sortie (envoi de la totalité, balayage), alors qu'ici ${tx.outputs.length} sorties dont une au montant résiduel apparaissent. ` : '') +
      'Ces heuristiques sont probabilistes : confirmez en observant comment la sortie est dépensée ensuite (avec d\'autres adresses du même cluster ?).',
  }
}
