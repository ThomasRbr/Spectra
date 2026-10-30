import { useMemo, useState } from 'react'
import { CHAINS, fmtAsset, fmtUsd, usd, type AssetId } from '../../engine/chains'
import { CATEGORY, COOPERATION_LABEL, type EntityCategory } from '../../engine/entities'
import { KIND_LABEL, shortAddr } from '../../engine/addressgen'
import { attribution, changeAnalysis, clusterLabel, clusterOf, detectCoinjoin, detectLightning, exposure, riskScore, type Exposure } from '../../engine/analysis'
import { hdWalletOf } from '../../engine/hd'
import { openHdTool } from './HdTool'
import type { Tx, World } from '../../engine/world'
import { useGame, FLAG_META, type Flag } from '../../store/game'
import { useUi } from '../../store/ui'
import { aKey, tKey } from '../../lib/graph'
import { ChainBadge, CopyButton, Empty, EntityChip, EntityIcon, Icon, Logo, RiskGauge, Stat, Tabs, fmtTime } from '../common'
import { entityLogo } from '../logos'
import { FundingPanel, TracePanel, openTracer } from './Tracer'
import { DepositPanel, FingerprintCard, SwapMatchPanel, WalletUsage } from './Heuristics'
import { instantSwapDeposit } from '../../engine/heuristics'
import { FreezeButton, WatchButton } from './Live'
import { CoinjoinDemixCard, openDemix } from './Demix'
import { BalanceChart } from './Synthesis'

export function Inspector() {
  const selection = useGame((s) => s.selection)
  const inst = useGame((s) => s.inst)
  const clock = useGame((s) => s.live?.now ?? 0)
  if (!inst) return null
  const w = inst.world
  if (!selection) return <Empty icon="MousePointerClick" title="Aucune sélection" sub="Cliquez un nœud ou une transaction du graphe pour afficher son analyse détaillée." />
  if (selection.kind === 'address') return <AddressInspector key={`${selection.id}@${clock}`} w={w} id={selection.id} />
  if (selection.kind === 'tx') return <TxInspector key={`${selection.id}@${clock}`} w={w} id={selection.id} />
  return <EdgeInspector w={w} txIds={selection.txIds} source={selection.source} target={selection.target} />
}

// ── Ligne d'adresse cliquable ────────────────────────────────────────────

export function AddrLine({ w, id, right, compact }: { w: World; id: string; right?: React.ReactNode; compact?: boolean }) {
  const onGraph = useGame((s) => !!s.addrPos[id])
  const flag = useGame((s) => s.flags[id])
  const a = w.get(id)
  const at = attribution(w, id)
  const color = at.entity ? CATEGORY[at.entity.category].color : a.contract ? '#818cf8' : '#4a5a80'
  const name = at.label ?? (a.contract ? a.label ?? a.contract.name : undefined)
  return (
    <div
      className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-800"
      onClick={() => {
        const g = useGame.getState()
        if (!onGraph) g.addAddress(id)
        else g.focusOn(aKey(id))
        g.select({ kind: 'address', id })
      }}
      title={a.addr}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: color, background: flag ? FLAG_META[flag].color : 'transparent' }} />
      <div className="min-w-0 flex-1">
        {name && !compact && <div className="truncate text-[12px] font-medium text-ink-100">{name}</div>}
        <div className={`truncate font-mono ${name && !compact ? 'text-[10.5px] text-ink-300' : 'text-[11.5px] text-ink-200'}`}>{compact && name ? name : shortAddr(a.addr, 9)}</div>
      </div>
      {right}
      <span className={`shrink-0 ${onGraph ? 'text-accent' : 'text-ink-500 group-hover:text-ink-200'}`} title={onGraph ? 'Sur le graphe' : 'Ajouter au graphe'}>
        <Icon name={onGraph ? 'CircleDot' : 'CirclePlus'} size={13} />
      </span>
    </div>
  )
}

// ── Adresse ──────────────────────────────────────────────────────────────

type ATab = 'txs' | 'exposure' | 'cluster' | 'entity' | 'trace' | 'funding' | 'notes'

function AddressInspector({ w, id }: { w: World; id: string }) {
  const [tab, setTab] = useState<ATab>('txs')
  const a = w.get(id)
  const at = attribution(w, id)
  const flag = useGame((s) => s.flags[id])
  const sum = useMemo(() => w.summary(id), [w, id])
  const risk = useMemo(() => riskScore(w, id), [w, id])
  const cat = at.entity ? CATEGORY[at.entity.category] : null
  const color = cat?.color ?? (a.contract ? '#818cf8' : '#7a88a8')
  const logo = entityLogo(at.entity?.id)
  const isUtxo = CHAINS[a.chain].model === 'utxo'
  const balanceEntries = Object.entries(sum.balance) as [AssetId, number][]
  // Le chemin HD n'est montré que si l'enquêteur a dérivé ce portefeuille avec l'outil
  const hdRevealed = useGame((s) => (a.hd ? !!s.hdRevealed[a.hd.wallet] : false))
  const hdPath = useMemo(() => {
    if (!a.hd || !hdRevealed) return null
    const hw = hdWalletOf(w, id)
    return hw ? { path: a.hd.path, xpub: hw.xpub } : null
  }, [w, id, a.hd, hdRevealed])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700/60 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: color, background: `${color}14`, boxShadow: `0 0 18px ${color}33` }}>
            {logo ? <Logo src={logo} size={40} /> : <Icon name={cat?.icon ?? (a.contract ? 'FileCode2' : 'Wallet')} size={19} color={color} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">{at.label ?? (a.contract ? a.label ?? a.contract.name : 'Adresse non attribuée')}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <ChainBadge chain={a.chain} />
              <span className="chip bg-ink-700 text-ink-200">{KIND_LABEL[a.kind]}</span>
              {hdPath && (
                <button className="chip border border-amber-400/40 bg-amber-400/10 font-mono text-amber-200 hover:bg-amber-400/20" title="Chemin de dérivation HD (révélé par l'outil de dérivation)" onClick={() => openHdTool(hdPath.xpub)}>
                  <Icon name="KeyRound" size={11} /> {hdPath.path}
                </button>
              )}
              {at.entity && <EntityChip entity={at.entity} via={at.source} />}
              {flag && <span className="chip" style={{ color: FLAG_META[flag].color, background: `${FLAG_META[flag].color}1c` }}>⚑ {FLAG_META[flag].label}</span>}
            </div>
          </div>
          <RiskGauge score={risk.score} size={58} />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-2.5 py-1.5">
          <span className="flex-1 break-all font-mono text-[11px] leading-4 text-ink-100">{a.addr}</span>
          <CopyButton text={a.addr} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => useGame.getState().expand(id, 'in')}>
            <Icon name="ArrowDownLeft" size={13} className="text-emerald-400" /> Entrées
          </button>
          <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => useGame.getState().expand(id, 'out')}>
            <Icon name="ArrowUpRight" size={13} className="text-rose-400" /> Sorties
          </button>
          <FlagMenu id={id} />
          <WatchButton id={id} />
          <FreezeButton w={w} id={id} />
        </div>
        {risk.reasons.length > 0 && (
          <div className="mt-2.5 space-y-0.5">
            {risk.reasons.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                <Icon name="ShieldAlert" size={11} className="text-orange-400" /> {r}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-3">
        <Stat label="Solde actuel" value={balanceEntries.length ? balanceEntries.map(([as, v]) => fmtAsset(v, as)).join(' · ') : '0'} sub={balanceEntries.length ? fmtUsd(balanceEntries.reduce((s, [as, v]) => s + usd(as, v), 0)) : undefined} />
        <Stat label="Transactions" value={sum.txCount} sub={`${sum.nIn} entrantes · ${sum.nOut} sortantes`} />
        <Stat label="Total reçu" value={fmtUsd(sum.inUsd)} sub={assetsLine(sum.received)} accent="#34d399" />
        <Stat label="Total envoyé" value={fmtUsd(sum.outUsd)} sub={assetsLine(sum.sent)} accent="#fb7185" />
        <Stat label="Première activité" value={<span className="text-[12px]">{sum.first ? fmtTime(sum.first) : '—'}</span>} />
        <Stat label="Dernière activité" value={<span className="text-[12px]">{sum.last ? fmtTime(sum.last) : '—'}</span>} />
      </div>

      <div className="px-3">
        <Tabs<ATab>
          size="xs"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'txs', label: 'Historique', icon: 'List' },
            { id: 'exposure', label: 'Exposition', icon: 'Radar' },
            { id: 'cluster', label: isUtxo ? 'Cluster' : 'Dépôt', icon: 'Network' },
            { id: 'entity', label: 'Entité', icon: 'Building2' },
            { id: 'trace', label: 'Traçage', icon: 'Route' },
            { id: 'funding', label: 'Financement', icon: 'Sprout' },
            { id: 'notes', label: 'Notes', icon: 'StickyNote' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
        {tab === 'txs' && <TxList w={w} id={id} />}
        {tab === 'exposure' && <ExposurePanel w={w} id={id} />}
        {tab === 'cluster' && (isUtxo ? <ClusterPanel w={w} id={id} /> : <DepositPanel w={w} id={id} />)}
        {tab === 'entity' && <EntityPanel w={w} id={id} />}
        {tab === 'trace' && <TracePanel w={w} id={id} />}
        {tab === 'funding' && <FundingPanel w={w} id={id} />}
        {tab === 'notes' && <NotesPanel id={id} />}
      </div>
    </div>
  )
}

function assetsLine(m: Partial<Record<AssetId, number>>): string {
  const e = Object.entries(m) as [AssetId, number][]
  if (!e.length) return '—'
  return e.slice(0, 2).map(([a, v]) => fmtAsset(v, a)).join(' · ') + (e.length > 2 ? ' …' : '')
}

function FlagMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const flag = useGame((s) => s.flags[id])
  return (
    <div className="relative">
      <button className="btn-outline w-full !px-2 !py-1 text-xs" onClick={() => setOpen((v) => !v)}>
        <Icon name="Flag" size={13} color={flag ? FLAG_META[flag].color : undefined} /> Marquer
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg panel-solid p-1 shadow-panel" onMouseLeave={() => setOpen(false)}>
          {(Object.keys(FLAG_META) as Flag[]).map((f) => (
            <button
              key={f}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-ink-700"
              onClick={() => {
                useGame.getState().flag(id, flag === f ? null : f)
                setOpen(false)
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: FLAG_META[f].color }} />
              <span className="flex-1">{FLAG_META[f].label}</span>
              {flag === f && <Icon name="Check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TxList({ w, id }: { w: World; id: string }) {
  const [limit, setLimit] = useState(40)
  const [dir, setDir] = useState<'all' | 'in' | 'out'>('all')
  const revealed = useGame((s) => s.revealed)
  const txs = useMemo(() => w.txsOf(id).slice().reverse(), [w, id])
  const rows = txs.filter((tx) => dir === 'all' || (dir === 'in' ? w.flowIn(tx, id).length : w.flowOut(tx, id).length))
  return (
    <div>
      <BalanceChart w={w} id={id} />
      <div className="mb-2 flex gap-1">
        {(['all', 'in', 'out'] as const).map((d) => (
          <button key={d} onClick={() => setDir(d)} className={`chip ${dir === d ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-300 hover:text-white'}`}>
            {d === 'all' ? 'Toutes' : d === 'in' ? 'Entrantes' : 'Sortantes'}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-400">{rows.length} tx</span>
      </div>
      <div className="space-y-1">
        {rows.slice(0, limit).map((tx) => {
          const fi = w.flowIn(tx, id)
          const fo = w.flowOut(tx, id)
          const isOut = fo.length > 0 && fi.reduce((s, f) => s + usd(f.asset, f.value), 0) < fo.reduce((s, f) => s + usd(f.asset, f.value), 0)
          const flows = isOut ? fo : fi
          const net = isOut ? fo.map((f) => {
            const back = fi.find((x) => x.asset === f.asset)
            return { ...f, value: f.value - (back?.value ?? 0) }
          }) : fi
          const counterpart = describeCounterpart(w, tx, id, isOut)
          const tags = [...tx.tags, ...(detectCoinjoin(tx).is ? ['coinjoin'] : [])]
          return (
            <div
              key={tx.id}
              onClick={() => useGame.getState().select({ kind: 'tx', id: tx.id })}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition hover:border-ink-500 hover:bg-ink-800 ${revealed[tx.id] ? 'border-accent/25 bg-accent/[0.04]' : 'border-ink-700/60'}`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${isOut ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <Icon name={isOut ? 'ArrowUpRight' : 'ArrowDownLeft'} size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11.5px] text-ink-100">{counterpart}</span>
                  {tags.slice(0, 2).map((t) => (
                    <span key={t} className={`chip !px-1 !py-0 !text-[9.5px] ${t === 'coinjoin' ? 'bg-rose-500/15 text-rose-300' : 'bg-ink-700 text-ink-300'}`}>{t}</span>
                  ))}
                </div>
                <div className="text-[10.5px] text-ink-400">{fmtTime(tx.time)}{tx.memo ? ` · ${tx.chain === 'xrp' ? 'tag' : 'memo'} ${tx.memo}` : ''}</div>
              </div>
              <div className="text-right">
                {(net.length ? net : flows).slice(0, 2).map((f, i) => (
                  <div key={i} className={`font-mono text-[11.5px] ${isOut ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {isOut ? '−' : '+'}
                    {fmtAsset(Math.abs(f.value), f.asset)}
                  </div>
                ))}
              </div>
              <button
                title="Ajouter au graphe"
                className="shrink-0 text-ink-500 hover:text-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  useGame.getState().revealTx(tx.id, true)
                }}
              >
                <Icon name={revealed[tx.id] ? 'CircleDot' : 'CirclePlus'} size={14} />
              </button>
            </div>
          )
        })}
      </div>
      {rows.length > limit && (
        <button className="btn-ghost mt-2 w-full text-xs" onClick={() => setLimit((l) => l + 60)}>
          Afficher plus ({rows.length - limit})
        </button>
      )}
    </div>
  )
}

function describeCounterpart(w: World, tx: Tx, id: string, isOut: boolean): string {
  if (tx.model === 'utxo') {
    const others = (isOut ? tx.outputs : tx.inputs).filter((x) => x.address !== id)
    if (others.length === 1) return nameOf(w, others[0].address)
    return `${tx.inputs.length} entrée(s) → ${tx.outputs.length} sortie(s)`
  }
  const legs = tx.transfers.filter((t) => (isOut ? t.from === id : t.to === id))
  const other = legs[0] ? (isOut ? legs[0].to : legs[0].from) : undefined
  const m = tx.method && !tx.method.startsWith('transfer') ? `${tx.method} · ` : ''
  return m + (other ? nameOf(w, other) : '—')
}

function nameOf(w: World, id: string): string {
  const at = attribution(w, id)
  const a = w.get(id)
  return at.label ?? (a.contract ? a.label ?? a.contract.name : shortAddr(a.addr, 7))
}

function ExposureBars({ ex, total }: { ex: { direct: Exposure; indirect: Exposure }; total: number }) {
  const cats = new Set([...Object.keys(ex.direct), ...Object.keys(ex.indirect)]) as Set<EntityCategory>
  const rows = [...cats].map((c) => ({ c, d: ex.direct[c] ?? 0, i: ex.indirect[c] ?? 0 })).sort((a, b) => b.d + b.i - (a.d + a.i))
  const max = Math.max(1, ...rows.map((r) => r.d + r.i))
  if (!rows.length) return <div className="py-2 text-[11.5px] text-ink-400">Aucune exposition à une entité connue (3 sauts).</div>
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const m = CATEGORY[r.c]
        return (
          <div key={r.c}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-ink-200">
                <Icon name={m.icon} size={11} color={m.color} /> {m.label}
              </span>
              <span className="font-mono text-ink-300">
                {fmtUsd(r.d + r.i)} {total ? `· ${(((r.d + r.i) / total) * 100).toFixed(0)} %` : ''}
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700/60">
              <div style={{ width: `${(r.d / max) * 100}%`, background: m.color }} />
              <div style={{ width: `${(r.i / max) * 100}%`, background: `repeating-linear-gradient(45deg, ${m.color}aa 0 3px, transparent 3px 6px)` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ExposurePanel({ w, id }: { w: World; id: string }) {
  const exIn = useMemo(() => exposure(w, id, 'in'), [w, id])
  const exOut = useMemo(() => exposure(w, id, 'out'), [w, id])
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5 text-[11px] leading-relaxed text-ink-300">
        Exposition calculée jusqu'à 3 sauts, au prorata des montants. <span className="text-ink-100">Plein</span> = contrepartie directe, <span className="text-ink-100">hachuré</span> = indirecte.
      </div>
      <div>
        <div className="label mb-2 flex items-center gap-1.5"><Icon name="ArrowDownLeft" size={12} className="text-emerald-400" /> Sources des fonds</div>
        <ExposureBars ex={exIn} total={exIn.totalUsd} />
      </div>
      <div>
        <div className="label mb-2 flex items-center gap-1.5"><Icon name="ArrowUpRight" size={12} className="text-rose-400" /> Destinations des fonds</div>
        <ExposureBars ex={exOut} total={exOut.totalUsd} />
      </div>
    </div>
  )
}

function ClusterPanel({ w, id }: { w: World; id: string }) {
  const members = useMemo(() => clusterOf(w, id), [w, id])
  const [limit, setLimit] = useState(30)
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5">
        <Icon name="Network" size={16} className="text-violet-glow" />
        <div className="flex-1">
          <div className="text-[12.5px] font-semibold text-white">Cluster {clusterLabel(w, id)}</div>
          <div className="text-[11px] text-ink-300">{members.length} adresse(s) · heuristique des entrées communes (CoinJoin exclus)</div>
        </div>
        {members.length > 1 && (
          <button className="btn-outline !px-2 !py-1 text-[11px]" onClick={() => members.slice(0, 30).forEach((m) => useGame.getState().addAddress(m, aKey(id), 1))}>
            Tout ajouter
          </button>
        )}
      </div>
      {members.length === 1 ? (
        <div className="py-2 text-[11.5px] text-ink-400">Adresse isolée : elle n'a jamais été dépensée avec une autre adresse.</div>
      ) : (
        <div className="space-y-0.5">
          {members.slice(0, limit).map((m) => (
            <AddrLine key={m} w={w} id={m} right={<span className="font-mono text-[10.5px] text-ink-400">{w.txsOf(m).length} tx</span>} />
          ))}
          {members.length > limit && <button className="btn-ghost w-full text-xs" onClick={() => setLimit((l) => l + 50)}>Afficher plus</button>}
        </div>
      )}
      <WalletUsage w={w} id={id} />
    </div>
  )
}

function EntityPanel({ w, id }: { w: World; id: string }) {
  const at = attribution(w, id)
  if (!at.entity) return <Empty icon="CircleHelp" title="Entité inconnue" sub="Cette adresse n'est pas dans la base d'attribution. Analysez son comportement, son cluster et ses contreparties." />
  const e = at.entity
  const m = CATEGORY[e.category]
  const c = e.compliance
  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-3" style={{ borderColor: `${m.color}40`, background: `${m.color}0a` }}>
        <div className="flex items-center gap-2">
          <EntityIcon entity={e} size={18} color={m.color} />
          <div className="text-[14px] font-semibold text-white">{e.name}</div>
          <span className="chip ml-auto" style={{ color: m.color, background: `${m.color}1a` }}>{m.label}</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-200">{e.description}</p>
        {e.country && <div className="mt-2 text-[11.5px] text-ink-300"><Icon name="Globe" size={11} className="mr-1 inline" />Juridiction : <span className="text-ink-100">{e.country}</span></div>}
        <div className="mt-1 text-[11px] text-ink-400">Attribution : {at.source === 'cluster' ? 'déduite du cluster (entrées communes)' : 'base de données SPECTRA'}</div>
      </div>
      {c && (
        <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-3">
          <div className="label mb-2">Conformité & coopération</div>
          <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1.5 text-[11.5px]">
            <dt className="text-ink-400">Voie</dt>
            <dd className="text-ink-100">{COOPERATION_LABEL[c.cooperation]}</dd>
            <dt className="text-ink-400">Contact</dt>
            <dd className="font-mono text-[11px] text-cyan-200">{c.contact}</dd>
            <dt className="text-ink-400">Délai constaté</dt>
            <dd className="text-ink-100">{c.responseDays[1] ? `${c.responseDays[0]} à ${c.responseDays[1]} jours` : '—'}</dd>
            <dt className="text-ink-400">KYC</dt>
            <dd className="text-ink-100">{c.kyc}</dd>
            <dt className="text-ink-400">Gel possible</dt>
            <dd className={c.canFreeze ? 'text-emerald-300' : 'text-rose-300'}>{c.canFreeze ? 'Oui' : 'Non / incertain'}</dd>
            {c.regulator && (
              <>
                <dt className="text-ink-400">Régulateur</dt>
                <dd className="text-ink-100">{c.regulator}</dd>
              </>
            )}
          </dl>
          {c.notes && <p className="mt-2 border-t border-ink-700/60 pt-2 text-[11.5px] leading-relaxed text-ink-300">{c.notes}</p>}
          {c.cooperation !== 'none' && (
            <button className="btn-primary mt-3 w-full text-xs" onClick={() => useUi.getState().set({ requisition: { open: true, entityId: e.id, addresses: [id] } })}>
              <Icon name="Gavel" size={14} /> Rédiger une réquisition
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NotesPanel({ id }: { id: string }) {
  const note = useGame((s) => s.notes[id] ?? '')
  return (
    <div>
      <div className="label mb-1.5">Notes d'enquête</div>
      <textarea
        className="input min-h-[160px] resize-y font-mono text-[12px]"
        placeholder="Hypothèses, constatations, éléments à vérifier…"
        value={note}
        onChange={(e) => useGame.getState().setNote(id, e.target.value)}
      />
      <div className="mt-1 text-[10.5px] text-ink-400">Les notes sont reprises dans le rapport d'analyse.</div>
    </div>
  )
}

// ── Transaction ──────────────────────────────────────────────────────────

function TxInspector({ w, id }: { w: World; id: string }) {
  const tx = w.tx(id)
  const revealed = useGame((s) => !!s.revealed[id])
  const cj = detectCoinjoin(tx)
  const ln = useMemo(() => detectLightning(w, tx), [w, tx])
  // Pas d'analyse de rendu sur une fermeture de canal : les sorties reviennent à chacun des pairs
  const change = useMemo(() => (ln.kind === 'none' || ln.kind === 'open' ? changeAnalysis(w, tx) : []), [w, tx, ln.kind])
  const [openReason, setOpenReason] = useState<number | null>(null)
  const native = CHAINS[tx.chain].native
  const totalUsd = w.txUsd(tx)
  const swapDeposit = useMemo(() => instantSwapDeposit(w, tx), [w, tx])
  const preset = () => {
    // Montant de référence : ce qui entre dans un service (dépôt) si identifiable
    let ref = totalUsd
    let entityId: string | undefined
    if (tx.model === 'utxo') {
      for (const o of tx.outputs) {
        const e = w.get(o.address).entityId
        const ent = e ? w.entities.get(e) : undefined
        if (ent?.known && attribution(w, o.address).entity) {
          ref = usd(native, o.value)
          entityId = ent.id
          break
        }
      }
    } else {
      for (const t of tx.transfers) {
        const at = attribution(w, t.to)
        if (at.entity) {
          ref = usd(t.asset, t.value)
          entityId = at.entity.id
          break
        }
      }
    }
    useUi.getState().set({ correlator: { open: true, preset: { time: tx.time, usd: ref, entityId, excludeTx: tx.id } } })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700/60 p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-ink-600 bg-ink-800">
            <Icon name={cj.is ? 'Shuffle' : tx.bridge ? 'Waypoints' : tx.tags.includes('swap') ? 'ArrowLeftRight' : 'ArrowRightLeft'} size={18} className={cj.is ? 'text-rose-400' : 'text-accent'} />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-white">Transaction</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <ChainBadge chain={tx.chain} />
              {tx.method && <span className="chip bg-violet-500/15 font-mono text-violet-200">{tx.method}</span>}
              {tx.tags.map((t) => (
                <span key={t} className="chip bg-ink-700 text-ink-200">{t}</span>
              ))}
              {cj.is && <span className="chip bg-rose-500/15 text-rose-300">CoinJoin détecté</span>}
              {ln.kind !== 'none' && <span className="chip bg-amber-400/15 text-amber-200"><Icon name="Zap" size={11} /> Lightning</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/60 px-2.5 py-1.5">
          <span className="flex-1 break-all font-mono text-[11px] leading-4 text-ink-100">{tx.hash}</span>
          <CopyButton text={tx.hash} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button className="btn-outline !py-1 text-xs" onClick={() => useGame.getState().revealTx(id, true)}>
            <Icon name={revealed ? 'CircleDot' : 'CirclePlus'} size={13} /> {revealed ? 'Centrer / compléter' : 'Ajouter au graphe'}
          </button>
          <button className="btn-outline !py-1 text-xs" onClick={preset}>
            <Icon name="Radar" size={13} /> Corréler
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Date (Paris)" value={<span className="text-[12px]">{fmtTime(tx.time)}</span>} />
          <Stat label="Bloc" value={<span className="font-mono text-[12px]">{tx.block.toLocaleString('fr-FR')}</span>} />
          <Stat label="Valeur totale" value={fmtUsd(totalUsd)} />
          <Stat label="Frais" value={<span className="font-mono text-[12px]">{fmtAsset(tx.fee, tx.feeAsset)}</span>} sub={fmtUsd(usd(tx.feeAsset, tx.fee))} />
        </div>

        {tx.memo && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
            <Icon name="Hash" size={16} className="text-cyan-300" />
            <div className="flex-1">
              <div className="label !text-[10px] !text-cyan-300">{tx.chain === 'xrp' ? 'Destination tag' : tx.chain === 'ton' ? 'Commentaire (memo)' : 'Destination tag / memo'}</div>
              <div className="font-mono text-[15px] font-semibold text-white">{tx.memo}</div>
            </div>
            <CopyButton text={tx.memo} />
          </div>
        )}

        {tx.bridge && (
          <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-400/5 p-3">
            <div className="flex items-center gap-2">
              <Icon name="Waypoints" size={15} className="text-violet-glow" />
              <div className="text-[12.5px] font-semibold text-white">Événement de bridge ({tx.bridge.direction === 'out' ? 'départ' : 'arrivée'})</div>
            </div>
            <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[11.5px]">
              <dt className="text-ink-400">{tx.bridge.direction === 'out' ? 'Chaîne cible' : 'Chaîne source'}</dt>
              <dd><ChainBadge chain={tx.bridge.otherChain} /></dd>
              <dt className="text-ink-400">Nonce</dt>
              <dd className="font-mono text-ink-100">{tx.bridge.nonce}</dd>
              {tx.bridge.recipient && (
                <>
                  <dt className="text-ink-400">Destinataire</dt>
                  <dd className="truncate font-mono text-ink-100">{shortAddr(w.get(tx.bridge.recipient).addr, 10)}</dd>
                </>
              )}
            </dl>
            {(tx.tags.includes('l2-withdraw-init') || tx.tags.includes('l2-withdraw-finalize')) && (
              <div className="mt-2 text-[11px] leading-relaxed text-ink-300">Retrait d'un rollup optimiste vers Ethereum : initié sur le L2, il n'est exécutable sur Ethereum qu'après la période de contestation (environ 7 jours). Pendant ce délai, les fonds ne sont nulle part ailleurs : surveillez l'adresse de destination.</div>
            )}
            {tx.tags.includes('l2-deposit') && (
              <div className="mt-2 text-[11px] leading-relaxed text-ink-300">Dépôt via le bridge canonique du rollup : crédité sur le L2 en quelques minutes, en général sur la même adresse 0x.</div>
            )}
            {tx.bridge.otherTx && !w.visible(w.tx(tx.bridge.otherTx)) && (
              <div className="mt-2 rounded-lg border border-dashed border-violet-400/30 px-2 py-1.5 text-center text-[11px] text-violet-200">{tx.tags.includes('l2-withdraw-init') ? `Retrait en période de contestation : pas encore exécuté sur ${CHAINS[tx.bridge.otherChain].name} à l'heure de l'horloge.` : `Arrivée pas encore confirmée sur ${CHAINS[tx.bridge.otherChain].name} à l'heure de l'horloge.`}</div>
            )}
            {tx.bridge.otherTx && w.visible(w.tx(tx.bridge.otherTx)) && (
              <button className="btn-outline mt-2 w-full !py-1 text-xs" onClick={() => {
                useGame.getState().revealTx(tx.bridge!.otherTx!, true)
                useGame.getState().select({ kind: 'tx', id: tx.bridge!.otherTx! })
              }}>
                <Icon name="Link2" size={13} /> Ouvrir la transaction liée ({CHAINS[tx.bridge.otherChain].short})
              </button>
            )}
          </div>
        )}

        {swapDeposit && <SwapMatchPanel w={w} txId={tx.id} address={swapDeposit} />}

        {cj.is && (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-[11.5px] leading-relaxed text-ink-200">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-rose-300"><Icon name="Shuffle" size={13} /> CoinJoin</div>
            {cj.equalCount} sorties de <span className="font-mono text-white">{cj.denom} {native}</span> : impossible de relier une entrée à une sortie mixée par les montants. L'heuristique des entrées communes est désactivée pour cette transaction. Cherchez les erreurs post-mix (regroupement, rendu toxique).
          </div>
        )}
        {cj.is && <CoinjoinDemixCard w={w} txId={tx.id} />}
        {ln.kind !== 'none' && <LightningCard v={ln} />}
        {tx.model === 'account' && tx.transfers.some((t) => w.get(t.to).contract?.type === 'mixer') && (
          <button className="btn-outline mt-3 w-full !py-1.5 text-xs !border-rose-400/40 text-rose-200" onClick={() => openDemix(tx.transfers.find((t) => w.get(t.to).contract?.type === 'mixer')!.from)}>
            <Icon name="ScanSearch" size={13} /> Démixer les dépôts de cette adresse
          </button>
        )}

        {tx.model === 'utxo' ? (
          <div className="mt-3 space-y-3">
            <div>
              <div className="label mb-1.5 flex items-center justify-between">
                <span>Entrées ({tx.inputs.length})</span>
                <span className="font-mono normal-case tracking-normal text-ink-300">{fmtAsset(tx.inputs.reduce((s, i) => s + i.value, 0), native)}</span>
              </div>
              <div className="space-y-0.5 rounded-lg border border-ink-700/60 p-1">
                {tx.inputs.map((i) => (
                  <AddrLine key={i.n} w={w} id={i.address} compact right={
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-ink-200">{fmtAsset(i.value, native)}</span>
                      {i.prev ? (
                        <button title="Transaction d'origine" className="text-ink-400 hover:text-accent" onClick={(e) => {
                          e.stopPropagation()
                          useGame.getState().revealTx(i.prev!.tx, true)
                        }}>
                          <Icon name="Undo2" size={12} />
                        </button>
                      ) : (
                        <span title="Origine hors périmètre de l'exercice" className="text-ink-600"><Icon name="CircleDashed" size={12} /></span>
                      )}
                    </span>
                  } />
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-1.5 flex items-center justify-between">
                <span>Sorties ({tx.outputs.length})</span>
                <span className="font-mono normal-case tracking-normal text-ink-300">{fmtAsset(tx.outputs.reduce((s, i) => s + i.value, 0), native)}</span>
              </div>
              <div className="space-y-0.5 rounded-lg border border-ink-700/60 p-1">
                {tx.outputs.map((o) => {
                  const c = change.find((x) => x.n === o.n)
                  const spent = w.spender(tx.id, o.n)
                  return (
                    <div key={o.n}>
                      <AddrLine w={w} id={o.address} compact right={
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-ink-200">{fmtAsset(o.value, native)}</span>
                          <button title="Tracer ces fonds" className="text-ink-400 hover:text-teal-300" onClick={(e) => {
                            e.stopPropagation()
                            openTracer({ address: o.address, txId: tx.id })
                          }}>
                            <Icon name="Route" size={12} />
                          </button>
                          {spent ? (
                            <button title="Transaction de dépense" className="text-ink-400 hover:text-accent" onClick={(e) => {
                              e.stopPropagation()
                              useGame.getState().revealTx(spent, true)
                            }}>
                              <Icon name="Redo2" size={12} />
                            </button>
                          ) : (
                            <span title="Non dépensée (UTXO)" className="text-emerald-500"><Icon name="CircleDot" size={11} /></span>
                          )}
                        </span>
                      } />
                      {c && (
                        <div className="mb-1 ml-6 mr-2">
                          <button className="flex w-full items-center gap-2" onClick={() => setOpenReason(openReason === o.n ? null : o.n)}>
                            <span className="w-20 text-left text-[10px] text-ink-400">Rendu probable</span>
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
                              <div className="h-full rounded-full" style={{ width: `${c.prob * 100}%`, background: c.prob > 0.6 ? '#facc15' : '#4a5a80' }} />
                            </div>
                            <span className={`w-9 text-right font-mono text-[10px] ${c.prob > 0.6 ? 'text-yellow-300' : 'text-ink-400'}`}>{Math.round(c.prob * 100)} %</span>
                            <Icon name={openReason === o.n ? 'ChevronUp' : 'ChevronDown'} size={11} className="text-ink-400" />
                          </button>
                          {openReason === o.n && (
                            <ul className="mt-1 space-y-0.5 rounded-md bg-ink-950/60 p-2">
                              {c.reasons.map((r, k) => (
                                <li key={k} className="flex items-center gap-1.5 text-[10.5px]">
                                  <span className={`w-8 font-mono ${r.weight > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.weight > 0 ? '+' : ''}{r.weight}</span>
                                  <span className="text-ink-200">{r.text}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <FingerprintCard w={w} tx={tx} />
            {change.length > 0 && (
              <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-2 text-[10.5px] leading-relaxed text-ink-400">
                <Icon name="Info" size={11} className="mr-1 inline" /> Les heuristiques de rendu sont probabilistes : un portefeuille bien configuré peut les déjouer. Corroborez par le comportement ultérieur des sorties.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <div className="label mb-1.5">Transferts ({tx.transfers.length})</div>
            <div className="space-y-1.5">
              {tx.transfers.map((t) => (
                <div key={t.n} className="rounded-lg border border-ink-700/60 p-1.5">
                  <AddrLine w={w} id={t.from} compact />
                  <div className="flex items-center gap-2 px-2 py-0.5">
                    <Icon name="ArrowDown" size={12} className="text-ink-400" />
                    <span className="font-mono text-[12px] font-semibold" style={{ color: '#e2e8f0' }}>{fmtAsset(t.value, t.asset)}</span>
                    <span className="text-[10.5px] text-ink-400">{fmtUsd(usd(t.asset, t.value))}</span>
                    {t.asset !== native && <span className="chip bg-emerald-500/10 text-emerald-300">{CHAINS[tx.chain].tokenStandard}</span>}
                    <button title="Tracer ces fonds" className="ml-auto text-ink-400 hover:text-teal-300" onClick={() => openTracer({ address: t.to, txId: tx.id, asset: t.asset, from: t.from })}>
                      <Icon name="Route" size={12} />
                    </button>
                  </div>
                  <AddrLine w={w} id={t.to} compact />
                </div>
              ))}
            </div>
            {tx.signer && (
              <div className="mt-2 text-[11px] text-ink-400">
                Signataire (paie les frais) : <span className="font-mono text-ink-200">{shortAddr(w.get(tx.signer).addr, 8)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LightningCard({ v }: { v: ReturnType<typeof detectLightning> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[11.5px] leading-relaxed text-ink-200">
      <div className="flex items-center gap-1.5 font-semibold text-amber-200">
        <Icon name="Zap" size={13} /> {v.title}
        <span className="ml-auto font-mono text-[10.5px] font-normal text-amber-300/80">indice {Math.round(v.confidence * 100)} %</span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {v.reasons.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-amber-300">•</span><span>{r}</span></li>)}
      </ul>
      <button className="mt-2 flex items-center gap-1 text-[11px] text-amber-200 hover:text-white" onClick={() => setOpen((x) => !x)}>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={12} /> Ce que la blockchain montre… et ne montre pas
      </button>
      {open && (
        <div className="mt-1.5 grid gap-2 md:grid-cols-2">
          <div>
            <div className="label !text-[10px] !text-emerald-300">Visible on-chain</div>
            <ul className="mt-0.5 space-y-0.5">{v.visible.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>
          </div>
          <div>
            <div className="label !text-[10px] !text-rose-300">Invisible (hors chaîne)</div>
            <ul className="mt-0.5 space-y-0.5">{v.invisible.map((x, i) => <li key={i}>✗ {x}</li>)}</ul>
          </div>
          <div className="text-[10.5px] text-ink-400 md:col-span-2">Pour aller plus loin : réquisition du fournisseur de service Lightning ou du portefeuille custodial (registre des paiements, factures, identifiant de nœud), exploitation du téléphone saisi (base de données du portefeuille Lightning).</div>
        </div>
      )}
    </div>
  )
}

function EdgeInspector({ w, txIds, source, target }: { w: World; txIds: string[]; source: string; target: string }) {
  const txs = txIds.filter((t) => w.txs.has(t)).map((t) => w.tx(t)).sort((a, b) => a.time - b.time)
  const link = useGame((s) => s.links.find((l) => aKey(l.source) === source && aKey(l.target) === target))
  const isBridge = txs.length === 2 && txs.some((t) => t.bridge) && txs[0].chain !== txs[1].chain
  return (
    <div className="p-4">
      <div className="text-[15px] font-semibold text-white">{link ? 'Lien de corrélation' : isBridge ? 'Passage par bridge' : 'Flux agrégé'}</div>
      <div className="mt-1 text-[11.5px] text-ink-300">
        {link ? 'Rattachement probabiliste posé par vous à l\'aide du corrélateur : à corroborer (réquisition au service, comportement ultérieur).' : isBridge ? 'Les deux transactions sont reliées par l\'événement du bridge (même nonce).' : `${txs.length} transaction(s)`}
      </div>
      {link && (
        <button className="btn-outline mt-3 w-full !py-1 text-xs" onClick={() => {
          useGame.getState().removeLink(link.id)
          useGame.getState().select(null)
        }}>
          <Icon name="Unlink" size={13} /> Supprimer ce lien
        </button>
      )}
      {source.startsWith('a:') && <div className="mt-3"><div className="label mb-1">De</div><AddrLine w={w} id={source.slice(2)} /></div>}
      {target.startsWith('a:') && <div className="mt-2"><div className="label mb-1">Vers</div><AddrLine w={w} id={target.slice(2)} /></div>}
      <div className="label mb-1.5 mt-4">Transactions</div>
      <div className="space-y-1">
        {txs.map((tx) => (
          <button key={tx.id} className="flex w-full items-center gap-2 rounded-lg border border-ink-700/60 px-2 py-1.5 text-left hover:bg-ink-800" onClick={() => useGame.getState().select({ kind: 'tx', id: tx.id })}>
            <span className="font-mono text-[11px] text-ink-200">{shortAddr(tx.hash, 8)}</span>
            <span className="ml-auto text-[10.5px] text-ink-400">{fmtTime(tx.time)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { tKey }
