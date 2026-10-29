import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Box, C, Explain, Instr, hexToBytes, popcount8, useSha256 } from './kit'

const DEFAULT_A = 'Virement de 0,5 BTC vers Alice'
const DEFAULT_B = 'Virement de 0,6 BTC vers Alice'

function tweak(s: string): string {
  if (!s) return 'a'
  // Change un seul caractère, au milieu du texte
  const i = Math.floor(s.length / 2)
  const ch = s[i]
  const next = ch === 'z' ? 'a' : ch === ' ' ? '_' : String.fromCharCode(ch.charCodeAt(0) + 1)
  return s.slice(0, i) + next + s.slice(i + 1)
}

function HashLine({ hash, other, label }: { hash: string | null; other: string | null; label: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-300">
        <span>{label}</span>
        <span className="font-mono">{hash ? '64 caractères hexadécimaux = 256 bits' : 'calcul…'}</span>
      </div>
      <div className="break-all rounded-lg border border-ink-700 bg-ink-950/70 px-2.5 py-2 font-mono text-[12.5px] leading-relaxed tracking-wide">
        {hash
          ? hash.split('').map((c, i) => {
              const diff = other && other[i] !== c
              return (
                <span key={i} className={`transition-colors duration-300 ${diff ? 'rounded-sm bg-accent/15 text-accent' : 'text-ink-300'}`}>
                  {c}
                </span>
              )
            })
          : '…'}
      </div>
    </div>
  )
}

export default function HashPlayground() {
  const [a, setA] = useState(DEFAULT_A)
  const [b, setB] = useState(DEFAULT_B)
  const ha = useSha256(a)
  const hb = useSha256(b)

  const stats = useMemo(() => {
    if (!ha || !hb) return null
    const ba = hexToBytes(ha)
    const bb = hexToBytes(hb)
    const bits: boolean[] = []
    let changed = 0
    for (let i = 0; i < 32; i++) {
      const x = ba[i] ^ bb[i]
      changed += popcount8(x)
      for (let k = 7; k >= 0; k--) bits.push(((x >> k) & 1) === 1)
    }
    let hexDiff = 0
    for (let i = 0; i < 64; i++) if (ha[i] !== hb[i]) hexDiff++
    return { bits, changed, hexDiff }
  }, [ha, hb])

  const charDiff = useMemo(() => {
    let d = Math.abs(a.length - b.length)
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++
    return d
  }, [a, b])

  const same = a === b

  return (
    <div className="space-y-3">
      <Instr>Modifiez l'un des deux textes (même une seule lettre, une virgule, une majuscule) et observez les deux empreintes SHA-256 calculées en direct par votre navigateur.</Instr>

      <div className="grid gap-3 sm:grid-cols-2">
        <Box title="Texte A">
          <textarea className="input h-16 resize-none font-mono text-[12.5px]" value={a} onChange={(e) => setA(e.target.value)} aria-label="Texte A" />
        </Box>
        <Box
          title="Texte B"
          right={
            <div className="flex gap-1">
              <button className="btn-ghost !px-2 !py-0.5 text-[11px]" onClick={() => setB(a)} title="Copier A dans B">
                <Icon name="Copy" size={12} /> = A
              </button>
              <button className="btn-ghost !px-2 !py-0.5 text-[11px]" onClick={() => setB(tweak(a))} title="B = A avec un caractère modifié">
                <Icon name="Shuffle" size={12} /> 1 caractère
              </button>
            </div>
          }
        >
          <textarea className="input h-16 resize-none font-mono text-[12.5px]" value={b} onChange={(e) => setB(e.target.value)} aria-label="Texte B" />
        </Box>
      </div>

      <div className="space-y-2">
        <HashLine hash={ha} other={hb} label="SHA-256(A)" />
        <HashLine hash={hb} other={ha} label="SHA-256(B)" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <Box title="Bits modifiés (256)">
          <div className="grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[2px]" style={{ width: 224 }} aria-label="Carte des bits modifiés">
            {(stats?.bits ?? Array.from({ length: 256 }, () => false)).map((on, i) => (
              <span key={i} className="h-[5px] rounded-[1px] transition-colors duration-300" style={{ background: on ? C.cyan : '#1f2b47', boxShadow: on ? `0 0 4px ${C.cyan}88` : undefined }} />
            ))}
          </div>
        </Box>
        <Box title="Mesure de l'effet avalanche">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-white">{charDiff}</div>
              <div className="text-[10.5px] text-ink-300">caractère(s) d'entrée différent(s)</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-accent">{stats ? stats.changed : '…'}</div>
              <div className="text-[10.5px] text-ink-300">bits de sortie changés / 256</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{stats ? Math.round((stats.changed / 256) * 100) : '…'} %</div>
              <div className="text-[10.5px] text-ink-300">≈ 50 % attendu</div>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${stats ? (stats.changed / 256) * 100 : 0}%` }} />
          </div>
        </Box>
      </div>

      <Explain tone={same ? 'ok' : 'info'}>
        {same ? (
          <>
            Les deux textes sont <strong>identiques</strong> : les empreintes le sont aussi, au bit près. Une empreinte est <strong>déterministe</strong> — c'est ce qui permet de vérifier qu'un fichier, une transaction ou un scellé numérique n'a pas été altéré.
          </>
        ) : stats ? (
          <>
            {charDiff} caractère(s) de différence en entrée ont modifié <strong>{stats.changed} bits sur 256</strong> ({stats.hexDiff} caractères hexadécimaux sur 64, en cyan). C'est l'<strong>effet avalanche</strong> : la moindre modification produit une empreinte méconnaissable, sans rapport visible avec l'originale. Impossible de « deviner » le texte à partir de l'empreinte (fonction à sens unique), et la longueur reste toujours de 64 caractères, que l'entrée fasse 1 lettre ou 1 Go.
          </>
        ) : (
          'Calcul des empreintes…'
        )}
      </Explain>
    </div>
  )
}
