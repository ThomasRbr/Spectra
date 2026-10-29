import { useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { C, Explain, Instr, short } from './kit'

type NodeId = 'S' | 'Y' | 'Z' | 'D1' | 'D2' | 'D3' | 'H' | 'CW' | 'W'

const R = new Rng(6060)
const NODES: Record<NodeId, { x: number; y: number; label: string; sub: string; color: string; addr: string; exch?: boolean }> = {
  S: { x: 70, y: 50, label: 'Suspect', sub: 'portefeuille perso', color: C.rose, addr: genAddress(R, 'btc', 'p2wpkh') },
  Y: { x: 70, y: 135, label: 'Client Y', sub: 'autre client', color: '#7a88a8', addr: genAddress(R, 'btc', 'p2wpkh') },
  Z: { x: 70, y: 220, label: 'Client Z', sub: 'autre client', color: '#7a88a8', addr: genAddress(R, 'btc', 'p2wpkh') },
  D1: { x: 240, y: 50, label: 'Dépôt n° 1', sub: 'attribuée au suspect', color: C.amber, addr: genAddress(R, 'btc', 'p2wpkh'), exch: true },
  D2: { x: 240, y: 135, label: 'Dépôt n° 2', sub: 'client Y', color: C.amber, addr: genAddress(R, 'btc', 'p2wpkh'), exch: true },
  D3: { x: 240, y: 220, label: 'Dépôt n° 3', sub: 'client Z', color: C.amber, addr: genAddress(R, 'btc', 'p2wpkh'), exch: true },
  H: { x: 430, y: 135, label: 'Hot wallet', sub: 'mutualisé', color: C.cyan, addr: genAddress(R, 'btc', 'p2sh'), exch: true },
  CW: { x: 620, y: 60, label: 'Cold wallet', sub: 'stockage hors ligne', color: C.violet, addr: genAddress(R, 'btc', 'p2wpkh'), exch: true },
  W: { x: 620, y: 222, label: 'Retraits', sub: 'vers d\'autres clients', color: C.green, addr: genAddress(R, 'btc', 'p2wpkh') },
}

const EDGES: { from: NodeId; to: NodeId; step: number; amount: string }[] = [
  { from: 'S', to: 'D1', step: 0, amount: '2,1' },
  { from: 'Y', to: 'D2', step: 0, amount: '0,35' },
  { from: 'Z', to: 'D3', step: 0, amount: '5,8' },
  { from: 'D1', to: 'H', step: 1, amount: '2,1' },
  { from: 'D2', to: 'H', step: 1, amount: '0,35' },
  { from: 'D3', to: 'H', step: 1, amount: '5,8' },
  { from: 'H', to: 'CW', step: 2, amount: '6,0' },
  { from: 'H', to: 'W', step: 3, amount: '2,2496' },
]

const STEPS = [
  { title: 'Dépôts', text: 'Le suspect envoie 2,1 BTC vers SON adresse de dépôt, générée par l\'exchange pour son seul compte. D\'autres clients font de même sur leurs propres adresses.' },
  { title: 'Balayage (sweep)', text: 'Quelques minutes ou heures plus tard, l\'exchange regroupe les dépôts en une transaction de consolidation (3 entrées → hot wallet, 8,25 BTC − 0,0004 de frais). Les fonds du suspect se mélangent à ceux des autres clients.' },
  { title: 'Vers le cold wallet', text: 'L\'excédent du hot wallet (6 BTC) part en stockage à froid. Ce mouvement interne ne concerne aucun client en particulier.' },
  { title: 'Retraits', text: 'Le hot wallet paie les retraits d\'autres clients (2,2496 BTC). Suivre le flux au-delà n\'a plus de sens : les fonds sont fongibles dans la comptabilité de l\'exchange.' },
]

const VERDICT: Record<NodeId, { ok: boolean; text: string }> = {
  D1: { ok: true, text: 'Bonne cible : l\'adresse de dépôt est propre à un seul compte client. La réquisition à l\'exchange (avec le hash de la transaction de dépôt et la date) permet d\'obtenir l\'identité KYC, les IP de connexion, l\'IBAN de retrait et l\'historique du compte.' },
  H: { ok: false, text: 'Le hot wallet est mutualisé entre des milliers de clients : requérir « le titulaire » n\'a pas de sens. Sa présence confirme juste que les fonds sont arrivés chez l\'exchange — remontez au dépôt.' },
  CW: { ok: false, text: 'Le cold wallet est la réserve de l\'exchange : aucun lien avec un client donné. Mouvement purement interne.' },
  D2: { ok: false, text: 'Adresse de dépôt d\'un autre client (Y), sans lien avec les fonds suspects : la requérir viserait un tiers.' },
  D3: { ok: false, text: 'Adresse de dépôt d\'un autre client (Z), sans lien avec les fonds suspects.' },
  S: { ok: false, text: 'Portefeuille auto-hébergé du suspect : aucun prestataire à requérir. C\'est l\'adresse de dépôt, en aval, qui mène à un acteur régulé.' },
  Y: { ok: false, text: 'Un autre client, étranger aux faits.' },
  Z: { ok: false, text: 'Un autre client, étranger aux faits.' },
  W: { ok: false, text: 'Ces retraits sont payés avec le « pot commun » : ils n\'ont aucun lien établi avec le dépôt du suspect.' },
}

export default function ExchangeFlow() {
  const [step, setStep] = useState(0)
  const [pick, setPick] = useState<NodeId | null>(null)
  const quiz = step >= STEPS.length - 1

  return (
    <div className="space-y-3">
      <Instr>Avancez étape par étape pour suivre le dépôt du suspect dans un exchange. Puis cliquez sur l'adresse que vous mentionneriez dans une réquisition.</Instr>

      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button key={s.title} onClick={() => setStep(i)} className={`flex-1 rounded-md border px-1 py-1 text-[10.5px] transition ${i === step ? 'border-accent/70 bg-accent/10 text-white' : i < step ? 'border-ink-600 text-ink-200' : 'border-ink-700 text-ink-400'}`}>
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox="0 0 720 270" className="h-auto w-full" role="img" aria-label="Flux de dépôt dans un exchange">
          <defs>
            <marker id="ef-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a5a80" />
            </marker>
          </defs>
          <path d="M 186 14 H 690 Q 702 14 702 26 V 158 Q 702 170 690 170 H 532 Q 520 170 520 182 V 244 Q 520 256 508 256 H 186 Q 172 256 172 244 V 26 Q 172 14 186 14 Z" fill="#22d3ee06" stroke="#22d3ee33" strokeDasharray="5 5" />
          <text x={690} y={30} textAnchor="end" fill="#22d3ee99" fontSize={10} fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>
            PÉRIMÈTRE DE L'EXCHANGE (un seul cluster)
          </text>
          {EDGES.map((e, i) => {
            const a = NODES[e.from]
            const b = NODES[e.to]
            const vis = e.step <= step
            const cur = e.step === step
            const suspect = (e.from === 'S' || e.from === 'D1') && vis
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy)
            const off = 42
            const x1 = a.x + (dx / len) * off
            const y1 = a.y + (dy / len) * off * 0.6
            const x2 = b.x - (dx / len) * off
            const y2 = b.y - (dy / len) * off * 0.6
            return (
              <g key={i} style={{ opacity: vis ? 1 : 0.07, transition: 'opacity .5s' }}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={suspect ? C.rose : cur ? C.cyan : '#4a5a80'} strokeWidth={cur || suspect ? 2 : 1.4} strokeDasharray={cur ? '6 4' : undefined} className={cur ? 'animate-dash' : ''} markerEnd="url(#ef-arrow)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fill="#a9b4cc" fontSize={9.5} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {e.amount}
                </text>
              </g>
            )
          })}
          {(Object.keys(NODES) as NodeId[]).map((id) => {
            const n = NODES[id]
            const sel = pick === id
            const verdict = sel ? VERDICT[id] : null
            const stroke = verdict ? (verdict.ok ? C.green : C.rose) : n.color
            return (
              <g key={id} onClick={() => quiz && setPick(id)} style={{ cursor: quiz ? 'pointer' : 'default' }} role={quiz ? 'button' : undefined} aria-label={quiz ? `Choisir ${n.label}` : undefined}>
                <rect x={n.x - 44} y={n.y - 22} width={88} height={44} rx={10} fill={sel ? `${stroke}30` : '#10172a'} stroke={stroke} strokeWidth={sel ? 2.4 : 1.4} style={{ transition: 'all .3s' }} />
                <text x={n.x} y={n.y - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
                  {n.label}
                </text>
                <text x={n.x} y={n.y + 6} textAnchor="middle" fill="#7a88a8" fontSize={8.5} fontFamily="Inter, system-ui, sans-serif">
                  {n.sub}
                </text>
                <text x={n.x} y={n.y + 17} textAnchor="middle" fill="#a9b4cc" fontSize={8.5} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {short(n.addr, 5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {quiz && pick ? (
        <Explain tone={VERDICT[pick].ok ? 'ok' : 'bad'} title={VERDICT[pick].ok ? 'Bonne cible de réquisition' : 'Pas la bonne cible'}>
          {VERDICT[pick].text}
          <div className="mt-1 font-mono text-[11px] text-ink-300">{NODES[pick].addr}</div>
        </Explain>
      ) : (
        <Explain>
          <strong>{STEPS[step].title}.</strong> {STEPS[step].text}
          {quiz && <div className="mt-1 font-semibold text-accent">À vous : cliquez sur l'adresse à viser dans la réquisition.</div>}
        </Explain>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost !py-1 text-xs" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <Icon name="ArrowLeft" size={13} /> Précédent
        </button>
        <button
          className="btn-primary !py-1 text-xs"
          onClick={() => {
            if (quiz) {
              setStep(0)
              setPick(null)
            } else setStep((s) => s + 1)
          }}
        >
          {quiz ? 'Recommencer' : 'Étape suivante'} <Icon name={quiz ? 'RotateCcw' : 'ArrowRight'} size={13} />
        </button>
      </div>
    </div>
  )
}
