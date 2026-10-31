import { useRef, useState } from 'react'
import { useGame, FLAG_META, type CaseExport } from '../../store/game'
import { useUi } from '../../store/ui'
import { attribution } from '../../engine/analysis'
import { CHAINS } from '../../engine/chains'
import { Icon } from '../common'

function download(name: string, type: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Onglets des graphes du dossier, et export / import des constatations. */
export function CaseBar() {
  const views = useGame((s) => s.views)
  const viewId = useGame((s) => s.viewId)
  const viewName = useGame((s) => s.viewName)
  const [editing, setEditing] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const all = [{ id: viewId, name: viewName }, ...views].sort((a, b) => (a.id < b.id ? -1 : 1))
  const g = useGame.getState

  const exportJson = () => {
    const data = g().exportCase()
    if (!data) return
    download(`spectra-${data.templateId}-${data.seed}.json`, 'application/json', JSON.stringify(data, null, 2))
    g().addLog('Export des constatations du dossier (JSON)', 'tool')
  }
  const exportCsv = () => {
    const s = g()
    const w = s.inst?.world
    if (!w) return
    const rows = [['Qualification', 'Réseau', 'Adresse', 'Attribution', 'Surveillée', 'Notes']]
    const ids = [...new Set([...Object.keys(s.flags), ...s.watch, ...Object.keys(s.notes).filter((k) => w.addresses.has(k))])]
    for (const id of ids) {
      const a = w.get(id)
      rows.push([s.flags[id] ? FLAG_META[s.flags[id]].label : '', CHAINS[a.chain].name, a.addr, attribution(w, id).label ?? '', s.watch.includes(id) ? 'oui' : '', s.notes[id] ?? ''])
    }
    download(`spectra-${s.template?.id}-${s.seed}-adresses.csv`, 'text/csv', '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n'))
    g().addLog(`Export de ${ids.length} adresse(s) marquée(s) ou annotée(s) (CSV)`, 'tool')
  }
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as CaseExport
      const err = g().importCase(data)
      useUi.getState().notify(err || 'Constatations importées : marquages, notes, liens et graphes ajoutés.')
    } catch {
      useUi.getState().notify('Fichier illisible : export SPECTRA au format JSON attendu.')
    }
  }

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-ink-700/70 bg-ink-900/80 px-2">
      <Icon name="Layers" size={13} className="mr-1 text-ink-400" />
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {all.map((v) => (
          <div key={v.id} className={`group flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-meta ${v.id === viewId ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}>
            {editing === v.id ? (
              <input
                autoFocus
                className="w-32 bg-transparent outline-none"
                defaultValue={v.name}
                onBlur={(e) => {
                  g().renameView(v.id, e.target.value)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button onClick={() => g().switchView(v.id)} onDoubleClick={() => setEditing(v.id)} title="Double-clic pour renommer">{v.name}</button>
            )}
            {all.length > 1 && (
              <button className="hidden text-ink-400 hover:text-rose-300 group-hover:inline" title="Supprimer ce graphe" onClick={() => {
                if (confirm(`Supprimer le graphe « ${v.name} » ? Les marquages et notes du dossier sont conservés.`)) g().deleteView(v.id)
              }}><Icon name="X" size={11} /></button>
            )}
          </div>
        ))}
        <button className="shrink-0 rounded-md px-1.5 py-0.5 text-ink-400 hover:bg-ink-800 hover:text-white" title="Nouveau graphe vide (piste parallèle)" onClick={() => g().newView(false)}><Icon name="Plus" size={13} /></button>
        <button className="shrink-0 rounded-md px-1.5 py-0.5 text-ink-400 hover:bg-ink-800 hover:text-white" title="Dupliquer le graphe actif" onClick={() => g().newView(true)}><Icon name="Copy" size={12} /></button>
      </div>
      <div className="relative">
        <button className="btn-ghost !px-2 !py-0.5 text-meta" onClick={() => setMenu((m) => !m)}><Icon name="FolderSync" size={13} /> Constatations</button>
        {menu && (
          <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg panel-solid p-1 shadow-panel" onMouseLeave={() => setMenu(false)}>
            <MenuItem icon="FileJson" label="Exporter le dossier (JSON)" sub="Marquages, notes, liens, graphes" onClick={() => { exportJson(); setMenu(false) }} />
            <MenuItem icon="Sheet" label="Exporter les adresses (CSV)" sub="Pour un tableur ou un logiciel d'analyse" onClick={() => { exportCsv(); setMenu(false) }} />
            <MenuItem icon="FileUp" label="Importer des constatations" sub="Export d'un collègue sur la même affaire" onClick={() => { fileRef.current?.click(); setMenu(false) }} />
          </div>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importFile(f)
          e.target.value = ''
        }} />
      </div>
    </div>
  )
}

function MenuItem({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-ink-700" onClick={onClick}>
      <Icon name={icon} size={14} className="mt-0.5 text-accent" />
      <span>
        <span className="block text-meta text-ink-100">{label}</span>
        <span className="block text-micro text-ink-400">{sub}</span>
      </span>
    </button>
  )
}
