import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { CHAINS, type ChainId } from '../../engine/chains'
import { genAddress, type AddrKind } from '../../engine/addressgen'
import { Explain, Instr } from './kit'

interface AType {
  id: string
  chain: ChainId
  kind: AddrKind
  label: string
  prefix: number // nombre de caractères du préfixe à surligner
  alphabet: string
  explain: string
}

const TYPES: AType[] = [
  { id: 'p2pkh', chain: 'btc', kind: 'p2pkh', label: 'Bitcoin — Legacy P2PKH', prefix: 1, alphabet: 'Base58Check', explain: 'Commence par « 1 » (octet de version 0x00). Format historique, 26 à 34 caractères, sensible à la casse. Courant sur les vieux portefeuilles et certaines plateformes.' },
  { id: 'p2sh', chain: 'btc', kind: 'p2sh', label: 'Bitcoin — Script P2SH', prefix: 1, alphabet: 'Base58Check', explain: 'Commence par « 3 » (version 0x05) : l\'adresse est l\'empreinte d\'un script (multisig, SegWit encapsulé). Très utilisé par les exchanges pour leurs portefeuilles multisignatures.' },
  { id: 'p2wpkh', chain: 'btc', kind: 'p2wpkh', label: 'Bitcoin — SegWit natif', prefix: 4, alphabet: 'Bech32 (minuscules)', explain: '« bc1 » = partie lisible Bitcoin + séparateur, puis « q » = version de témoin 0. 42 caractères pour une clé (P2WPKH), 62 pour un script (P2WSH). Format majoritaire aujourd\'hui.' },
  { id: 'p2tr', chain: 'btc', kind: 'p2tr', label: 'Bitcoin — Taproot', prefix: 4, alphabet: 'Bech32m (minuscules)', explain: '« bc1p » = témoin version 1 (Taproot, 2021). 62 caractères. Utilisé par les portefeuilles récents, les ordinals et certains outils de confidentialité.' },
  { id: 'evm', chain: 'eth', kind: 'eoa', label: 'Ethereum / EVM (0x)', prefix: 2, alphabet: 'Hexadécimal (40 car.)', explain: '« 0x » + 40 caractères hexadécimaux (20 octets). Attention : le même format est utilisé par BNB Chain, Polygon, Arbitrum, Base… L\'adresse seule ne dit pas la chaîne : interrogez plusieurs explorateurs. Les majuscules mélangées sont une somme de contrôle (EIP-55).' },
  { id: 'tron', chain: 'tron', kind: 'eoa', label: 'Tron', prefix: 1, alphabet: 'Base58Check', explain: 'Commence par « T » (octet 0x41), 34 caractères. Réseau de prédilection de l\'USDT-TRC20, omniprésent dans les escroqueries et le blanchiment.' },
  { id: 'xrp', chain: 'xrp', kind: 'account', label: 'XRP Ledger', prefix: 1, alphabet: 'Base58 (alphabet Ripple)', explain: 'Commence par « r », 25 à 35 caractères, avec un alphabet Base58 propre à Ripple. Les exchanges y utilisent une adresse partagée + un « destination tag » pour identifier le client.' },
  { id: 'ltc', chain: 'ltc', kind: 'p2wpkh', label: 'Litecoin — SegWit', prefix: 5, alphabet: 'Bech32', explain: '« ltc1 » remplace « bc1 » : même structure que Bitcoin SegWit, autre réseau. Les formats Legacy Litecoin commencent par « L » ou « M ».' },
  { id: 'sol', chain: 'sol', kind: 'eoa', label: 'Solana', prefix: 0, alphabet: 'Base58 (32-44 car.)', explain: 'Pas de préfixe : c\'est la clé publique Ed25519 (32 octets) encodée en Base58, 32 à 44 caractères. On la reconnaît par élimination : Base58, longueur ~44, aucun préfixe connu.' },
  { id: 'xmr', chain: 'xmr', kind: 'stealth', label: 'Monero', prefix: 1, alphabet: 'Base58 Monero (95 car.)', explain: 'Commence par « 4 » (« 8 » pour une sous-adresse), 95 caractères : elle contient deux clés publiques (dépense et visualisation). Les montants et destinataires sont masqués on-chain : traçage très limité.' },
]

function makeQuestion(round: number) {
  const r = new Rng(4242 + round * 97)
  const t = TYPES[(round * 7 + 3) % TYPES.length]
  const address = genAddress(r, t.chain, t.kind)
  // 4 propositions dont la bonne
  const others = r.pickN(
    TYPES.filter((x) => x.id !== t.id),
    3,
  )
  const options = r.shuffle([t, ...others])
  return { t, address, options }
}

export default function AddressAnatomy() {
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const q = useMemo(() => makeQuestion(round), [round])
  const revealed = picked !== null
  const correct = picked === q.t.id
  const col = CHAINS[q.t.chain].color

  function choose(id: string) {
    if (revealed) return
    setPicked(id)
    setScore((s) => ({ ok: s.ok + (id === q.t.id ? 1 : 0), total: s.total + 1 }))
  }
  function next() {
    setPicked(null)
    setRound((r) => r + 1)
  }

  return (
    <div className="space-y-3">
      <Instr>Observez l'adresse et choisissez la chaîne et le type correspondants. Indices : premier(s) caractère(s), longueur, alphabet (Base58, Bech32 en minuscules, hexadécimal).</Instr>
      <div className="flex items-center justify-between text-[12px] text-ink-300">
        <span>
          Adresse n° {round + 1} · score <span className="font-semibold text-white">{score.ok}</span> / {score.total}
        </span>
        <span className="font-mono">{q.address.length} caractères</span>
      </div>

      <div className="rounded-xl border bg-ink-950/70 p-3 transition-colors duration-300" style={{ borderColor: revealed ? `${col}88` : '#172036' }}>
        <div className="break-all font-mono text-[14px] leading-relaxed tracking-wide">
          <span className="rounded px-0.5 transition-colors duration-300" style={revealed && q.t.prefix > 0 ? { background: `${col}30`, color: col, fontWeight: 700 } : { color: '#d6dcea' }}>
            {q.address.slice(0, q.t.prefix)}
          </span>
          <span className="text-ink-100">{q.address.slice(q.t.prefix)}</span>
        </div>
        {revealed && (
          <div className="mt-2 flex flex-wrap gap-1.5 animate-fadein">
            <span className="chip border" style={{ color: col, borderColor: `${col}55` }}>
              {CHAINS[q.t.chain].name}
            </span>
            <span className="chip bg-ink-700 text-ink-100">{q.t.alphabet}</span>
            <span className="chip bg-ink-700 text-ink-100">préfixe : {q.t.prefix ? `« ${q.address.slice(0, q.t.prefix)} »` : 'aucun'}</span>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o) => {
          const isAns = o.id === q.t.id
          const isPicked = picked === o.id
          const st = !revealed ? 'border-ink-700 bg-ink-850 hover:border-accent/60 hover:bg-ink-800' : isAns ? 'border-emerald-400/70 bg-emerald-500/10' : isPicked ? 'border-rose-500/70 bg-rose-500/10' : 'border-ink-700 bg-ink-900 opacity-50'
          return (
            <button key={o.id} disabled={revealed} onClick={() => choose(o.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] text-ink-100 transition ${st}`}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHAINS[o.chain].color }} />
              <span className="flex-1">{o.label}</span>
              {revealed && isAns && <Icon name="Check" size={14} className="text-emerald-300" />}
              {revealed && isPicked && !isAns && <Icon name="X" size={14} className="text-rose-300" />}
            </button>
          )
        })}
      </div>

      {revealed ? (
        <Explain tone={correct ? 'ok' : 'bad'} title={correct ? 'Bonne réponse' : `Non : c'est ${q.t.label}`}>
          {q.t.explain}
          <div className="mt-2">
            <button className="btn-primary !py-1 text-xs" onClick={next}>
              Adresse suivante <Icon name="ArrowRight" size={13} />
            </button>
          </div>
        </Explain>
      ) : (
        <Explain>
          Une adresse n'est qu'un encodage lisible d'une clé publique ou d'un script. Son <strong>format</strong> trahit souvent la chaîne et le type de portefeuille — premier réflexe avant d'ouvrir le bon explorateur et de choisir le bon outil d'analyse.
        </Explain>
      )}

      <details className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-[12px] text-ink-300">
        <summary className="cursor-pointer select-none text-ink-200">Aide-mémoire des préfixes</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {TYPES.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-mono" style={{ color: CHAINS[t.chain].color }}>
                {t.id === 'sol' ? '(aucun)' : t.id === 'evm' ? '0x' : t.id === 'p2wpkh' ? 'bc1q' : t.id === 'p2tr' ? 'bc1p' : t.id === 'ltc' ? 'ltc1' : genAddress(new Rng(1), t.chain, t.kind).slice(0, t.prefix)}
              </span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
