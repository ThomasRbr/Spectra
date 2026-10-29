import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../ui/common'
import { C, Explain, Instr, Seg, sha256Hex } from './kit'

const GENESIS_PREV = '0'.repeat(64)
const INITIAL_DATA = ['Bloc genèse', 'Alice → Bob : 2 BTC', 'Bob → Carole : 0,7 BTC', 'Carole → Exchange : 0,5 BTC', 'Exchange → Dave : 0,3 BTC']
const MAX_TRIES = 300000

type Diff = 1 | 2 | 3

async function blockHash(i: number, prev: string, data: string, nonce: number): Promise<string> {
  return sha256Hex(`${i}|${prev}|${data}|${nonce}`)
}

async function computeChain(data: string[], nonces: number[]): Promise<string[]> {
  const out: string[] = []
  let prev = GENESIS_PREV
  for (let i = 0; i < data.length; i++) {
    const h = await blockHash(i, prev, data[i], nonces[i])
    out.push(h)
    prev = h
  }
  return out
}

async function mine(i: number, prev: string, data: string, target: string, alive: () => boolean): Promise<{ nonce: number; tries: number } | null> {
  for (let n = 0; n < MAX_TRIES; n++) {
    if (n % 500 === 0 && !alive()) return null
    const h = await blockHash(i, prev, data, n)
    if (h.startsWith(target)) return { nonce: n, tries: n + 1 }
  }
  return null
}

export default function ChainTamper() {
  const [diff, setDiff] = useState<Diff>(2)
  const [data, setData] = useState<string[]>(INITIAL_DATA)
  const [nonces, setNonces] = useState<number[]>(() => INITIAL_DATA.map(() => 0))
  const [hashes, setHashes] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [mining, setMining] = useState<number | null>(null)
  const [lastTries, setLastTries] = useState<{ block: number; tries: number } | null>(null)
  const alive = useRef(true)
  const target = '0'.repeat(diff)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Minage initial (déterministe) de toute la chaîne
  useEffect(() => {
    let ok = true
    ;(async () => {
      const ns: number[] = []
      let prev = GENESIS_PREV
      for (let i = 0; i < INITIAL_DATA.length; i++) {
        const r = await mine(i, prev, INITIAL_DATA[i], '00', () => ok)
        if (!r || !ok) return
        ns.push(r.nonce)
        prev = await blockHash(i, prev, INITIAL_DATA[i], r.nonce)
      }
      if (ok) {
        setNonces(ns)
        setReady(true)
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  // Recalcul des empreintes à chaque changement
  useEffect(() => {
    let ok = true
    computeChain(data, nonces).then((h) => {
      if (ok) setHashes(h)
    })
    return () => {
      ok = false
    }
  }, [data, nonces])

  const valid = hashes ? hashes.map((h) => h.startsWith(target)) : []
  const firstBad = valid.findIndex((v) => !v)

  async function remine(i: number) {
    if (!hashes || mining !== null) return
    setMining(i)
    const prev = i === 0 ? GENESIS_PREV : hashes[i - 1]
    const r = await mine(i, prev, data[i], target, () => alive.current)
    if (!alive.current) return
    setMining(null)
    if (r) {
      setNonces((ns) => ns.map((n, k) => (k === i ? r.nonce : n)))
      setLastTries({ block: i, tries: r.tries })
    }
  }

  function reset() {
    setData(INITIAL_DATA)
    setDiff(2)
    setLastTries(null)
    setReady(false)
    // relance le minage initial
    ;(async () => {
      const ns: number[] = []
      let prev = GENESIS_PREV
      for (let i = 0; i < INITIAL_DATA.length; i++) {
        const r = await mine(i, prev, INITIAL_DATA[i], '00', () => alive.current)
        if (!r || !alive.current) return
        ns.push(r.nonce)
        prev = await blockHash(i, prev, INITIAL_DATA[i], r.nonce)
      }
      if (alive.current) {
        setNonces(ns)
        setReady(true)
      }
    })()
  }

  return (
    <div className="space-y-3">
      <Instr>
        Modifiez le contenu d'un bloc (par exemple « 2 BTC » en « 20 BTC »). Chaque bloc contient l'empreinte du précédent : observez la propagation, puis cliquez sur <strong>Re-miner</strong> pour retrouver un nonce valide.
      </Instr>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] text-ink-300">
          Difficulté (empreinte commençant par)
          <Seg<Diff>
            value={diff}
            onChange={setDiff}
            options={[
              { id: 1, label: '0' },
              { id: 2, label: '00' },
              { id: 3, label: '000' },
            ]}
          />
        </div>
        <button className="btn-outline !py-1 text-xs" onClick={reset} disabled={mining !== null}>
          <Icon name="RotateCcw" size={13} /> Réinitialiser
        </button>
      </div>

      {!ready || !hashes ? (
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-6 text-center text-sm text-ink-300">
          <Icon name="Pickaxe" size={18} className="mx-auto mb-2 animate-pulse text-accent" />
          Minage initial de la chaîne…
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map((d, i) => {
            const ok = valid[i]
            const col = ok ? C.green : C.rose
            const prev = i === 0 ? GENESIS_PREV : hashes[i - 1]
            return (
              <div key={i}>
                {i > 0 && (
                  <div className="flex justify-center py-0.5">
                    <Icon name="ArrowDown" size={14} color={valid[i - 1] ? '#4a5a80' : C.rose} />
                  </div>
                )}
                <div className="rounded-xl border p-2.5 transition-colors duration-300" style={{ borderColor: `${col}66`, background: `${col}0a` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip border font-mono" style={{ color: col, borderColor: `${col}55` }}>
                      <Icon name={ok ? 'ShieldCheck' : 'ShieldX'} size={12} /> Bloc #{i}
                    </span>
                    <input className="input !w-auto min-w-0 flex-1 !py-1 font-mono text-[12.5px]" value={d} onChange={(e) => setData((ds) => ds.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Données du bloc ${i}`} disabled={mining !== null} />
                    <span className="w-20 text-right font-mono text-[11px] text-ink-300">nonce {nonces[i]}</span>
                    <button className={ok ? 'btn-ghost !px-2 !py-1 text-xs' : 'btn-primary !px-2 !py-1 text-xs'} onClick={() => remine(i)} disabled={mining !== null || ok}>
                      <Icon name="Pickaxe" size={12} className={mining === i ? 'animate-spin' : ''} /> {mining === i ? 'Minage…' : 'Re-miner'}
                    </button>
                  </div>
                  <div className="mt-1.5 grid gap-x-3 font-mono text-[10.5px] sm:grid-cols-2">
                    <div className="truncate text-ink-400">
                      préc. : <span className="text-ink-300">{prev.slice(0, 24)}…</span>
                    </div>
                    <div className="truncate">
                      <span className="text-ink-400">empreinte : </span>
                      <span style={{ color: col }} className="font-semibold">
                        {hashes[i].slice(0, diff)}
                      </span>
                      <span className="text-ink-200">{hashes[i].slice(diff, 24)}…</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Explain tone={!ready ? 'info' : firstBad < 0 ? 'ok' : 'bad'}>
        {!ready || !hashes ? (
          'Recherche des nonces initiaux…'
        ) : firstBad < 0 ? (
          <>
            Toutes les empreintes commencent par « {target} » et chaque bloc référence l'empreinte exacte du précédent : la chaîne est <strong>valide</strong>.
            {lastTries && (
              <>
                {' '}
                Le dernier minage (bloc #{lastTries.block}) a demandé <strong>{lastTries.tries.toLocaleString('fr-FR')} essais</strong> — en moyenne 16^{diff} = {Math.pow(16, diff).toLocaleString('fr-FR')}. Sur Bitcoin, la difficulté réelle exige des milliards de milliards d'essais par bloc.
              </>
            )}
          </>
        ) : (
          <>
            Le bloc #{firstBad} n'a plus une empreinte valide{firstBad < data.length - 1 ? ', et comme son empreinte est recopiée dans le bloc suivant, tous les blocs suivants deviennent invalides en cascade' : ''}. Pour falsifier l'historique, un fraudeur devrait <strong>re-miner ce bloc et tous ceux qui le suivent</strong>, plus vite que l'ensemble du réseau honnête qui continue d'allonger la vraie chaîne. C'est pourquoi une transaction confirmée par plusieurs blocs est considérée comme <strong>immuable</strong> — et constitue une preuve fiable en procédure.
          </>
        )}
      </Explain>
    </div>
  )
}
