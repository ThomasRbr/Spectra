// Export du graphe d'enquête : image vectorielle (SVG) fidèle à l'affichage,
// et annexe judiciaire imprimable (graphe numéroté, tableaux des adresses et
// des transactions, annotations, mentions).
import type { Core, EdgeSingular, NodeSingular } from 'cytoscape'
import { CHAINS, fmtAsset, fmtUsd, usd } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import { attribution } from '../../engine/analysis'
import { useGame, FLAG_META } from '../../store/game'
import { useGraph } from '../../store/graph'
import { openPrintable } from '../../lib/printable'
import { idOf } from '../../lib/graph'

type Theme = 'dark' | 'light'

const PALETTE: Record<Theme, { bg: string; fill: string; text: string; sub: string; labelBg: string; edgeText: string; legend: string }> = {
  dark: { bg: '#0e1013', fill: '#1b1f25', text: '#dfe3e8', sub: '#959da9', labelBg: '#0e1013', edgeText: '#b4bbc5', legend: '#15181d' },
  light: { bg: '#ffffff', fill: '#ffffff', text: '#1f2937', sub: '#6b7280', labelBg: '#ffffff', edgeText: '#374151', legend: '#f8fafc' },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** En thème clair, les couleurs très claires (blanc, gris pâle) deviennent foncées pour rester lisibles. */
function ink(color: string, theme: Theme): string {
  if (theme === 'dark') return color
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) {
    const rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color)
    if (!rgb) return color
    const lum = (0.299 * +rgb[1] + 0.587 * +rgb[2] + 0.114 * +rgb[3]) / 255
    return lum > 0.82 ? '#334155' : color
  }
  const v = parseInt(m[1], 16)
  const lum = (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255
  return lum > 0.82 ? '#334155' : `#${m[1]}`
}

function polygon(cx: number, cy: number, r: number, sides: number, rot = 0): string {
  const pts: string[] = []
  for (let i = 0; i < sides; i++) {
    const a = rot + (2 * Math.PI * i) / sides
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

function shapeSvg(n: NodeSingular, theme: Theme, P: (typeof PALETTE)[Theme]): string {
  const p = n.position()
  const w = n.width()
  const h = n.height()
  const r = Math.max(w, h) / 2
  const shape = String(n.style('shape'))
  const stroke = ink(String(n.style('border-color')), theme)
  const sw = Math.max(1.2, parseFloat(String(n.style('border-width'))) || 2)
  const dash = String(n.style('border-style')) === 'dashed' ? ' stroke-dasharray="5 3"' : String(n.style('border-style')) === 'double' ? '' : ''
  const fill = n.data('kind') === 'tx' ? (theme === 'dark' ? '#23272e' : '#f1f5f9') : P.fill
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}`
  let s: string
  if (shape.includes('rectangle')) s = `<rect x="${(p.x - w / 2).toFixed(1)}" y="${(p.y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(10, w / 5).toFixed(1)}" ${attrs}/>`
  else if (shape.includes('diamond')) s = `<polygon points="${polygon(p.x, p.y, r, 4)}" ${attrs}/>`
  else if (shape.includes('hexagon')) s = `<polygon points="${polygon(p.x, p.y, r, 6)}" ${attrs}/>`
  else if (shape.includes('octagon')) s = `<polygon points="${polygon(p.x, p.y, r, 8, Math.PI / 8)}" ${attrs}/>`
  else s = `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" ${attrs}/>`
  // Double bordure (victime, groupe replié)
  if (String(n.style('border-style')) === 'double') {
    const inner = shape.includes('rectangle')
      ? `<rect x="${(p.x - w / 2 + 4).toFixed(1)}" y="${(p.y - h / 2 + 4).toFixed(1)}" width="${(w - 8).toFixed(1)}" height="${(h - 8).toFixed(1)}" rx="6" fill="none" stroke="${stroke}" stroke-width="1"/>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(r - 4).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="1"/>`
    s += inner
  }
  return s
}

function edgeSvg(e: EdgeSingular, theme: Theme, P: (typeof PALETTE)[Theme]): string {
  const s = e.source().position()
  const t = e.target().position()
  const color = ink(String(e.style('line-color')), theme)
  const width = Math.max(1, parseFloat(String(e.style('width'))) || 1.5)
  const ls = String(e.style('line-style'))
  const dash = ls === 'dashed' ? ' stroke-dasharray="6 4"' : ls === 'dotted' ? ' stroke-dasharray="1.5 3"' : ''
  const opacity = Math.max(0.35, parseFloat(String(e.style('opacity'))) || 0.8)
  const label = String(e.data('label') ?? '')
  let path: string
  let mid: { x: number; y: number }
  let arrow = ''
  if (e.source().id() === e.target().id()) {
    // Boucle (conversion sur la même adresse) : arc au-dessus à droite du nœud
    const r = e.source().width() / 2
    const x0 = s.x + r * 0.7
    const y0 = s.y - r * 0.7
    path = `M${x0.toFixed(1)},${y0.toFixed(1)} C${(x0 + 50).toFixed(1)},${(y0 - 60).toFixed(1)} ${(x0 - 40).toFixed(1)},${(y0 - 75).toFixed(1)} ${(s.x - r * 0.2).toFixed(1)},${(s.y - r).toFixed(1)}`
    mid = { x: x0 + 8, y: y0 - 58 }
  } else {
    const dx = t.x - s.x
    const dy = t.y - s.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const rs = e.source().width() / 2 + 2
    const rt = e.target().width() / 2 + 4
    const x1 = s.x + ux * rs
    const y1 = s.y + uy * rs
    const x2 = t.x - ux * rt
    const y2 = t.y - uy * rt
    path = `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`
    mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
    if (String(e.style('target-arrow-shape')) !== 'none') {
      const a = 7 + width
      const bx = x2 - ux * a
      const by = y2 - uy * a
      arrow = String(e.style('target-arrow-shape')) === 'tee'
        ? `<line x1="${(x2 - uy * 6).toFixed(1)}" y1="${(y2 + ux * 6).toFixed(1)}" x2="${(x2 + uy * 6).toFixed(1)}" y2="${(y2 - ux * 6).toFixed(1)}" stroke="${color}" stroke-width="2"/>`
        : `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(bx - uy * a * 0.45).toFixed(1)},${(by + ux * a * 0.45).toFixed(1)} ${(bx + uy * a * 0.45).toFixed(1)},${(by - ux * a * 0.45).toFixed(1)}" fill="${color}"/>`
    }
  }
  let out = `<g opacity="${opacity.toFixed(2)}"><path d="${path}" fill="none" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round"${dash}/>${arrow}</g>`
  if (label && e.data('kind') !== 'io') {
    const tw = label.length * 5.6 + 8
    out += `<rect x="${(mid.x - tw / 2).toFixed(1)}" y="${(mid.y - 8).toFixed(1)}" width="${tw.toFixed(1)}" height="15" rx="3" fill="${P.labelBg}" stroke="${color}" stroke-width="0.6" opacity="0.95"/><text x="${mid.x.toFixed(1)}" y="${(mid.y + 3).toFixed(1)}" font-family="JetBrains Mono, monospace" font-size="9" fill="${P.edgeText}" text-anchor="middle">${esc(label)}</text>`
  }
  return out
}

export interface SvgResult {
  svg: string
  /** Numéro affiché de chaque nœud (A1…, T1…, G1…). */
  numbers: Map<string, string>
}

/** Image vectorielle du graphe tel qu'affiché (positions, formes, couleurs, annotations). */
export function graphSvg(cy: Core, theme: Theme, numbered = false): SvgResult {
  const P = PALETTE[theme]
  const nodes = cy.nodes().not('[kind="parent"]').filter((n) => !n.hasClass('faded') && !n.hasClass('future'))
  const edges = cy.edges().filter((e) => nodes.contains(e.source()) && nodes.contains(e.target()) && !e.hasClass('dim'))
  const view = useGraph.getState().view()
  const numbers = new Map<string, string>()
  const order = [...nodes].sort((a, b) => a.position().x - b.position().x || a.position().y - b.position().y)
  let na = 0
  let nt = 0
  let ng = 0
  for (const n of order) {
    const k = n.data('kind')
    numbers.set(n.id(), k === 'tx' ? `T${++nt}` : k === 'group' || k === 'agg' ? `G${++ng}` : `A${++na}`)
  }
  const bb = nodes.boundingBox({ includeLabels: true })
  let x1 = bb.x1
  let y1 = bb.y1
  let x2 = bb.x2
  let y2 = bb.y2
  for (const a of view.annotations) {
    x1 = Math.min(x1, a.x)
    y1 = Math.min(y1, a.y - 24)
    x2 = Math.max(x2, a.x + a.w)
    y2 = Math.max(y2, a.y + a.h)
  }
  const pad = 40
  const legendH = 54
  x1 -= pad
  y1 -= pad
  x2 += pad
  y2 += pad
  const W = Math.max(400, x2 - x1)
  const H = y2 - y1 + legendH
  const parts: string[] = []
  parts.push(`<rect x="${x1}" y="${y1}" width="${W}" height="${H}" fill="${P.bg}"/>`)
  // Couloirs par chaîne
  if (useGraph.getState().opts.mode === 'lanes') {
    for (const l of useGraph.getState().lanes) parts.push(`<rect x="${x1}" y="${l.y0}" width="${W}" height="${l.y1 - l.y0}" fill="${l.color}" opacity="0.06"/><text x="${x1 + 10}" y="${l.y0 + 16}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${ink(l.color, theme)}">${esc(l.label.toUpperCase())}</text>`)
  }
  // Cadres des groupes dépliés
  cy.nodes('[kind="parent"]').forEach((p) => {
    const b = p.boundingBox()
    const c = ink(String(p.data('color') ?? '#7ea6ff'), theme)
    parts.push(`<rect x="${b.x1.toFixed(1)}" y="${b.y1.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="10" fill="${c}" fill-opacity="0.05" stroke="${c}" stroke-dasharray="6 4"/><text x="${(b.x1 + b.w / 2).toFixed(1)}" y="${(b.y1 - 5).toFixed(1)}" font-family="Inter, sans-serif" font-size="10.5" font-weight="600" fill="${c}" text-anchor="middle">${esc(String(p.data('label')))}</text>`)
  })
  // Cadres d'annotation (sous les nœuds)
  for (const a of view.annotations.filter((x) => x.kind === 'box')) {
    const c = ink(a.color, theme)
    parts.push(`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="8" fill="${c}" fill-opacity="0.06" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${a.x + 6}" y="${a.y - 6}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${c}">${esc(a.text || 'Cadre')}</text>`)
  }
  edges.forEach((e) => {
    parts.push(edgeSvg(e, theme, P))
  })
  nodes.forEach((n) => {
    const p = n.position()
    parts.push(shapeSvg(n, theme, P))
    const lines = String(n.data('label') ?? '').split('\n').filter(Boolean)
    const ly = p.y + n.height() / 2 + 13
    lines.forEach((l, i) => {
      parts.push(`<text x="${p.x.toFixed(1)}" y="${(ly + i * 12.5).toFixed(1)}" font-family="${n.data('kind') === 'tx' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif'}" font-size="${i === 0 ? 10.5 : 9.5}" font-weight="${i === 0 ? 600 : 400}" fill="${i === 0 ? P.text : P.sub}" text-anchor="middle">${esc(l)}</text>`)
    })
    if (numbered) {
      const num = numbers.get(n.id())!
      const bx = p.x - n.width() / 2 - 4
      const by = p.y - n.height() / 2 - 4
      parts.push(`<rect x="${(bx - 11).toFixed(1)}" y="${(by - 8).toFixed(1)}" width="${num.length * 6.6 + 8}" height="15" rx="7" fill="${theme === 'dark' ? '#7ea6ff' : '#1d4ed8'}"/><text x="${(bx - 7).toFixed(1)}" y="${(by + 3).toFixed(1)}" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#ffffff">${num}</text>`)
    }
  })
  // Notes (au-dessus des nœuds)
  for (const a of view.annotations.filter((x) => x.kind === 'note')) {
    const c = ink(a.color, theme)
    const words = a.text.split(/\s+/)
    const rows: string[] = []
    let cur = ''
    for (const wd of words) {
      if ((cur + ' ' + wd).trim().length > 34) {
        rows.push(cur.trim())
        cur = wd
      } else cur += ` ${wd}`
    }
    if (cur.trim()) rows.push(cur.trim())
    const h = 24 + rows.length * 13
    parts.push(`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${h}" rx="7" fill="${P.fill}" stroke="${c}"/><rect x="${a.x}" y="${a.y}" width="${a.w}" height="16" rx="7" fill="${c}" fill-opacity="0.25"/><text x="${a.x + 7}" y="${a.y + 11.5}" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="${c}">NOTE</text>${rows.map((r, i) => `<text x="${a.x + 7}" y="${a.y + 30 + i * 13}" font-family="Inter, sans-serif" font-size="10.5" fill="${P.text}">${esc(r)}</text>`).join('')}`)
  }
  // Légende
  const ly = y2 + 10
  const kinds = new Set(edges.map((e) => String(e.data('kind'))))
  const items: [string, string, string][] = [['#5ec8e5', 'Victime', ''], ['#ff8a4c', 'Suspect', ''], [P.sub, 'Montant ∝ épaisseur', '']]
  if (kinds.has('swap')) items.push(['#c084fc', 'Conversion (swap)', ''])
  if (kinds.has('internal')) items.push(['#f5c451', 'Transaction interne', '5 3'])
  if (kinds.has('approval')) items.push(['#fb923c', 'Autorisation', '2 3'])
  if (kinds.has('bridge')) items.push(['#a78bfa', 'Bridge', '6 3'])
  if (kinds.has('mint') || kinds.has('burn')) items.push(['#e879f9', 'Mint / burn', '1.5 3'])
  parts.push(`<rect x="${x1}" y="${ly - 4}" width="${W}" height="${legendH}" fill="${P.legend}"/>`)
  let lx = x1 + 16
  for (const [c, label, dash] of items) {
    const col = ink(c, theme)
    parts.push(`<line x1="${lx}" y1="${ly + 14}" x2="${lx + 22}" y2="${ly + 14}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/><text x="${lx + 28}" y="${ly + 18}" font-family="Inter, sans-serif" font-size="10.5" fill="${P.text}">${esc(label)}</text>`)
    lx += 40 + label.length * 6
  }
  parts.push(`<text x="${x1 + 16}" y="${ly + 38}" font-family="Inter, sans-serif" font-size="9" fill="${P.sub}">Graphe généré par SPECTRA (outil d'entraînement, données simulées) · ${esc(new Date().toLocaleString('fr-FR'))}</text>`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1.toFixed(0)} ${y1.toFixed(0)} ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}">${parts.join('')}</svg>`
  return { svg, numbers }
}

export function exportSvg(cy: Core, theme: Theme) {
  const { svg } = graphSvg(cy, theme)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `spectra-graphe-${theme === 'light' ? 'clair' : 'sombre'}-${Date.now()}.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Annexe judiciaire : graphe numéroté et tableaux de correspondance, prêts à imprimer. */
export function exportAnnex(cy: Core) {
  const g = useGame.getState()
  if (!g.inst || !g.template) return
  const w = g.inst.world
  const { svg, numbers } = graphSvg(cy, 'light', true)
  const view = useGraph.getState().view()
  const nodes = cy.nodes().not('[kind="parent"]').filter((n) => numbers.has(n.id()))
  const numOfAddr = new Map<string, string>()
  nodes.forEach((n) => {
    const k = n.id()
    if (k.startsWith('a:')) numOfAddr.set(idOf(k), numbers.get(k)!)
    if (k.startsWith('g:') || k.startsWith('n:')) for (const m of (n.data('members') as string[]) ?? []) numOfAddr.set(m, numbers.get(k)!)
  })
  const sortNum = (a: string, b: string) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1))
  // Adresses
  const addrRows = [...nodes].filter((n) => n.id().startsWith('a:')).sort((a, b) => sortNum(numbers.get(a.id())!, numbers.get(b.id())!)).map((n) => {
    const id = idOf(n.id())
    const a = w.get(id)
    const at = attribution(w, id)
    const flag = g.flags[id]
    return `<tr><td class="num">${numbers.get(n.id())}</td><td class="mono">${esc(a.addr)}</td><td>${CHAINS[a.chain].name}</td><td>${at.entity ? `${esc(at.label ?? at.entity.name)}<br><span class="sub">${CATEGORY[at.entity.category].label}${at.source === 'cluster' ? ' · par cluster' : ''}</span>` : a.contract ? `${esc(a.label ?? a.contract.name)}<br><span class="sub">Smart contract</span>` : '<span class="sub">Non attribuée</span>'}</td><td>${flag ? FLAG_META[flag].label : ''}</td><td>${esc(g.notes[id] ?? '')}</td></tr>`
  })
  const groupRows = [...nodes].filter((n) => n.id().startsWith('g:') || n.id().startsWith('n:')).sort((a, b) => sortNum(numbers.get(a.id())!, numbers.get(b.id())!)).map((n) => {
    const mem = (n.data('members') as string[]) ?? []
    return `<tr><td class="num">${numbers.get(n.id())}</td><td>${esc(String(n.data('label')).split('\n')[0])}</td><td class="mono small">${mem.map((m) => esc(w.get(m).addr)).join('<br>')}</td></tr>`
  })
  // Transactions représentées
  const txIds = new Set<string>()
  cy.edges().forEach((e) => {
    if (!e.hasClass('dim')) for (const t of (e.data('txIds') as string[]) ?? []) txIds.add(t)
  })
  const txs = [...txIds].map((t) => w.txs.get(t)).filter((t): t is NonNullable<typeof t> => !!t).sort((a, b) => a.time - b.time)
  const nodeRef = (id: string) => numOfAddr.get(id) ?? '—'
  const txRows = txs.map((tx, i) => {
    let flow: string
    let amounts: string
    if (tx.model === 'utxo') {
      const native = CHAINS[tx.chain].native
      flow = `${[...new Set(tx.inputs.map((x) => nodeRef(x.address)))].join(', ')} → ${[...new Set(tx.outputs.map((x) => nodeRef(x.address)))].join(', ')}`
      amounts = tx.outputs.filter((o) => numOfAddr.has(o.address)).map((o) => `${nodeRef(o.address)} : ${fmtAsset(o.value, native)}`).join('<br>')
    } else {
      const legs = tx.transfers.filter((t) => numOfAddr.has(t.from) || numOfAddr.has(t.to))
      flow = legs.map((t) => `${nodeRef(t.from)} → ${nodeRef(t.to)}`).filter((v, k, arr) => arr.indexOf(v) === k).join('<br>') || (tx.method ?? '')
      amounts = legs.map((t) => fmtAsset(t.value, t.asset)).join('<br>')
    }
    const tnum = numbers.get(`t:${tx.id}`) ?? `X${i + 1}`
    return `<tr><td class="num">${tnum}</td><td>${new Date(tx.time * 1000).toISOString().replace('T', ' ').slice(0, 16)} UTC</td><td class="mono small">${esc(tx.hash)}</td><td>${CHAINS[tx.chain].short}${tx.method ? `<br><span class="sub">${esc(tx.method)}</span>` : ''}${tx.status === 'reverted' ? '<br><span class="sub">échouée</span>' : ''}</td><td>${flow}</td><td class="mono small">${amounts}</td><td class="right">${fmtUsd(w.txUsd(tx))}</td></tr>`
  })
  const notes = view.annotations.filter((a) => a.text.trim()).map((a, i) => `<li><b>${a.kind === 'box' ? 'Cadre' : 'Note'} ${i + 1}</b> — ${esc(a.text)}</li>`)
  const mode = { layers: 'couches (sens des flux)', time: 'chronologique', lanes: 'couloirs par chaîne' }[useGraph.getState().opts.mode]
  const totalUsd = txs.reduce((s, t) => s + t.transfers.reduce((a, x) => a + usd(x.asset, x.value), 0), 0)
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Annexe — ${esc(g.inst.title)}</title>
<style>
body{font:12px/1.45 Inter,system-ui,sans-serif;color:#111827;margin:28px 34px}h1{font-size:19px;margin:0 0 2px}h2{font-size:14px;margin:26px 0 8px;border-bottom:1.5px solid #1d4ed8;padding-bottom:3px;color:#1e3a8a}
.meta{color:#4b5563;font-size:11.5px}.fig{border:1px solid #d1d5db;border-radius:8px;padding:8px;margin-top:12px;page-break-inside:avoid}.fig svg{width:100%;height:auto}
table{border-collapse:collapse;width:100%;font-size:10.5px}th,td{border:1px solid #d1d5db;padding:4px 6px;vertical-align:top;text-align:left}th{background:#eff6ff;color:#1e3a8a}
.num{font-weight:700;color:#1d4ed8;white-space:nowrap}.mono{font-family:'JetBrains Mono',monospace;word-break:break-all}.small{font-size:9.5px}.sub{color:#6b7280;font-size:9.5px}.right{text-align:right;white-space:nowrap}
.warn{margin-top:22px;padding:8px 10px;border:1px solid #fcd34d;background:#fffbeb;border-radius:6px;font-size:10.5px;color:#78350f}@media print{body{margin:12mm}h2{page-break-after:avoid}}
</style></head><body>
<h1>Annexe — Graphe d'analyse des flux</h1>
<div class="meta">Affaire : <b>${esc(g.inst.title)}</b> · ${esc(g.template.title)} · graine ${g.seed}<br>Graphe : « ${esc(g.viewName)} » · présentation ${mode} · édité le ${new Date().toLocaleString('fr-FR')}</div>
<div class="fig">${svg}</div>
<div class="meta" style="margin-top:6px">Les nœuds sont numérotés de gauche à droite : A = adresse, G = groupe d'adresses ou contreparties réunies, T = transaction (modèle UTXO). Les tableaux ci-dessous donnent la correspondance complète.</div>
<h2>1. Adresses représentées (${addrRows.length})</h2>
<table><thead><tr><th>N°</th><th>Adresse</th><th>Réseau</th><th>Attribution</th><th>Marquage</th><th>Note de l'enquêteur</th></tr></thead><tbody>${addrRows.join('')}</tbody></table>
${groupRows.length ? `<h2>2. Groupes et contreparties réunies (${groupRows.length})</h2><table><thead><tr><th>N°</th><th>Groupe</th><th>Adresses membres</th></tr></thead><tbody>${groupRows.join('')}</tbody></table>` : ''}
<h2>${groupRows.length ? 3 : 2}. Transactions représentées (${txRows.length}) · ${fmtUsd(totalUsd)}</h2>
<table><thead><tr><th>N°</th><th>Date</th><th>Hash</th><th>Réseau</th><th>Flux (n° de nœuds)</th><th>Montants</th><th>Valeur</th></tr></thead><tbody>${txRows.join('')}</tbody></table>
${notes.length ? `<h2>${groupRows.length ? 4 : 3}. Annotations de l'enquêteur</h2><ol>${notes.join('')}</ol>` : ''}
<div class="warn">Les attributions proviennent de la base de l'outil et de ses heuristiques (entrées communes, adresses de dépôt) : elles constituent des éléments d'orientation à corroborer par réquisition. Les valeurs en dollars sont calculées au cours de l'outil. Document généré par SPECTRA, outil d'entraînement : toutes les données sont simulées.</div>
</body></html>`
  openPrintable(html, `annexe-graphe-${g.template.id}-${g.seed}.html`)
  g.addLog('Annexe judiciaire du graphe générée', 'tool')
}
