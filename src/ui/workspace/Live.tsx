import { useMemo } from 'react'
import { fmtAsset, fmtUsd, usd, type AssetId } from '../../engine/chains'
import { freezeOption } from '../../engine/freeze'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Empty, Icon, fmtTime } from '../common'
import { AddrLine } from './Inspector'

const STEPS: [string, number][] = [['+15 min', 900], ['+1 h', 3600], ['+6 h', 6 * 3600], ['+1 j', 86400]]

/** Horloge du mode temps réel, dans la barre supérieure. */
export function LiveClockBar() {
  const live = useGame((s) => s.live)
  const unread = useGame((s) => s.alerts.length)
  if (!live) return null
  const span = Math.max(1, live.end - live.start)
  const pct = ((live.now - live.start) / span) * 100
  const done = live.now >= live.end
  const go = (dt: number) => useGame.getState().advanceClock(live.now + dt)
  return (
    <div className="mr-2 flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] py-0.5 pl-2 pr-1" title="Mode temps réel : les transactions postérieures à l'horloge ne sont pas encore visibles">
      <span className={`h-2 w-2 rounded-full ${done ? 'bg-ink-500' : 'animate-pulse bg-rose-400'}`} />
      <div className="mr-1 leading-tight">
        <div className="whitespace-nowrap font-mono text-[11.5px] text-white">{fmtTime(live.now)}</div>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-rose-300" style={{ width: `${pct}%` }} /></div>
      </div>
      {STEPS.map(([l, dt]) => (
        <button key={l} disabled={done} className="whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10.5px] text-rose-100 hover:bg-rose-400/15 disabled:opacity-40" onClick={() => go(dt)}>{l}</button>
      ))}
      <button disabled={done} className="rounded px-1.5 py-0.5 text-[10.5px] text-rose-100 hover:bg-rose-400/15 disabled:opacity-40" title="Avancer jusqu'au dernier fait connu de l'affaire" onClick={() => useGame.getState().advanceClock(live.end)}>
        <Icon name="SkipForward" size={12} />
      </button>
      {unread > 0 && <span className="ml-0.5 rounded bg-rose-400/20 px-1 font-mono text-[10px] text-rose-200">{unread}</span>}
    </div>
  )
}

/** Bouton « Surveiller » d'une adresse. */
export function WatchButton({ id }: { id: string }) {
  const on = useGame((s) => s.watch.includes(id))
  return (
    <button className={`btn-outline w-full !px-2 !py-1 text-xs ${on ? '!border-rose-400/50 text-rose-200' : ''}`} onClick={() => useGame.getState().toggleWatch(id)} title="Alerte à chaque mouvement quand l'horloge avance (mode temps réel)">
      <Icon name={on ? 'EyeOff' : 'Eye'} size={13} /> {on ? 'Ne plus surveiller' : 'Surveiller'}
    </button>
  )
}

/** Bouton « Demander un gel » (mode temps réel). */
export function FreezeButton({ w, id }: { w: World; id: string }) {
  const live = useGame((s) => !!s.live)
  const req = useGame((s) => s.freezes.find((f) => f.address === id && f.status !== 'late'))
  const clock = useGame((s) => s.live?.now)
  const opt = useMemo(() => (live ? freezeOption(w, id) : null), [w, id, live, clock])
  if (!live || !opt) return null
  if (req) {
    return (
      <div className={`col-span-2 rounded-lg border px-2 py-1 text-center text-[11px] ${req.status === 'effective' ? 'border-sky-400/40 bg-sky-400/10 text-sky-100' : 'border-ink-600 text-ink-200'}`}>
        <Icon name="Snowflake" size={12} className="mr-1 inline" />
        {req.status === 'effective' ? `Gelé par ${req.authority} : ${fmtUsd(req.frozenUsd)}` : `Gel demandé à ${req.authority} · effet vers ${fmtTime(req.effectiveAt)}`}
      </div>
    )
  }
  const blocked = 'reason' in opt
  return (
    <button
      className={`btn-outline col-span-2 !px-2 !py-1 text-xs ${blocked ? 'opacity-60' : '!border-sky-400/50 text-sky-100'}`}
      title={blocked ? opt.reason : `Demande à ${opt.authority}, traitement en ${Math.round(opt.delayH)} h environ`}
      onClick={() => {
        const err = useGame.getState().requestFreeze(id)
        useUi.getState().notify(err || `Demande de gel envoyée à ${(opt as { authority: string }).authority}.`)
      }}
    >
      <Icon name="Snowflake" size={13} /> {blocked ? 'Gel impossible ici' : `Demander un gel (${opt.authority})`}
    </button>
  )
}

function balanceUsd(w: World, id: string): number {
  const b = w.summary(id).balance
  return Object.entries(b).reduce((s, [a, v]) => s + usd(a as AssetId, v ?? 0), 0)
}

/** Onglet « Veille » du dossier : adresses surveillées et mouvements constatés. */
export function WatchPanel() {
  const w = useGame((s) => s.inst?.world)
  const live = useGame((s) => s.live)
  const watch = useGame((s) => s.watch)
  const alerts = useGame((s) => s.alerts)
  const freezes = useGame((s) => s.freezes)
  const rows = useMemo(() => (w ? watch.map((id) => ({ id, held: balanceUsd(w, id), last: w.txsOf(id).slice(-1)[0]?.time })) : []), [w, watch, live?.now])
  if (!w) return null
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5 text-[11px] leading-relaxed text-ink-300">
        {live
          ? <>Mode temps réel : avancez l'horloge depuis la barre supérieure. Chaque mouvement d'une adresse surveillée déclenche une alerte : c'est le moment de demander un gel avant que les fonds ne repartent.</>
          : <>Affaire rétrospective : toute l'histoire est déjà visible. La surveillance sert surtout en <span className="text-white">temps réel</span> (option « Déroulement » au lancement d'une mission).</>}
      </div>
      <div>
        <div className="label mb-1.5">Adresses surveillées ({watch.length})</div>
        {watch.length === 0 ? (
          <Empty icon="Eye" title="Aucune adresse surveillée" sub="Bouton « Surveiller » de l'inspecteur, ou clic droit sur un nœud du graphe." />
        ) : (
          <div className="space-y-0.5">
            {rows.map((r) => (
              <AddrLine key={r.id} w={w} id={r.id} compact right={
                <span className="text-right leading-tight">
                  <span className={`block font-mono text-[11px] ${r.held > 1 ? 'text-yellow-200' : 'text-ink-400'}`}>{fmtUsd(r.held)}</span>
                  {r.last && <span className="block text-[9.5px] text-ink-400">{fmtTime(r.last)}</span>}
                </span>
              } />
            ))}
          </div>
        )}
      </div>
      {freezes.length > 0 && (
        <div>
          <div className="label mb-1.5">Demandes de gel ({freezes.length}) · {fmtUsd(freezes.reduce((s2, f) => s2 + f.frozenUsd, 0))} bloqués</div>
          <div className="space-y-1">
            {freezes.map((f) => (
              <div key={f.id} className={`rounded-lg border p-1.5 ${f.status === 'effective' ? 'border-sky-400/30 bg-sky-400/[0.05]' : f.status === 'late' ? 'border-ink-700/60 opacity-70' : 'border-ink-700/60'}`}>
                <div className="flex items-center gap-1.5 px-1.5 text-[10.5px]">
                  <Icon name="Snowflake" size={12} className={f.status === 'effective' ? 'text-sky-300' : 'text-ink-400'} />
                  <span className="text-ink-200">{f.authority}</span>
                  <span className="ml-auto text-ink-400">{f.status === 'pending' ? `effet vers ${fmtTime(f.effectiveAt)}` : f.status === 'effective' ? Object.entries(f.frozen).map(([a, v]) => fmtAsset(v ?? 0, a as AssetId)).join(' + ') : 'trop tard'}</span>
                </div>
                <AddrLine w={w} id={f.address} compact />
              </div>
            ))}
          </div>
        </div>
      )}
      {alerts.length > 0 && (
        <div>
          <div className="label mb-1.5 flex items-center justify-between">
            <span>Mouvements constatés ({alerts.length})</span>
            <button className="text-[10.5px] normal-case tracking-normal text-ink-400 hover:text-white" onClick={() => useGame.setState({ alerts: [] })}>Effacer</button>
          </div>
          <div className="space-y-1">
            {[...alerts].reverse().map((a) => (
              <div key={a.id} className="rounded-lg border border-rose-400/20 bg-rose-400/[0.04] p-1.5">
                <div className="flex items-center gap-1.5 px-1.5 text-[10.5px]">
                  <Icon name={a.dir === 'out' ? 'ArrowUpRight' : 'ArrowDownLeft'} size={12} className={a.dir === 'out' ? 'text-rose-400' : 'text-emerald-400'} />
                  <span className="text-ink-300">{fmtTime(a.time)}</span>
                  <span className={`font-mono ${a.dir === 'out' ? 'text-rose-200' : 'text-emerald-200'}`}>{a.dir === 'out' ? '−' : '+'}{fmtUsd(a.usd)}</span>
                  {freezes.some((f) => f.status === 'effective' && f.address === a.address && f.via === 'issuer' && f.effectiveAt <= a.time) && <span className="chip !py-0 bg-sky-400/15 text-sky-200" title="Dans la réalité, ce mouvement aurait été bloqué par le gel">après le gel</span>}
                  <button className="ml-auto text-ink-400 hover:text-accent" title="Ajouter la transaction au graphe" onClick={() => {
                    useGame.getState().revealTx(a.txId, true)
                    useGame.getState().select({ kind: 'tx', id: a.txId })
                  }}><Icon name="CirclePlus" size={13} /></button>
                </div>
                <AddrLine w={w} id={a.address} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
