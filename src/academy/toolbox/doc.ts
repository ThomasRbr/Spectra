// Petit moteur de documents : un modèle décrit son contenu en blocs, rendus
// ensuite en HTML imprimable (A4, noir sur blanc) et en texte brut.
import type { FieldValues } from './types'

/** Marqueur d'un champ laissé vide : ligne à compléter à la main. */
export const BLANK = '\u0001'

export const NOTICE = 'Modèle pédagogique — à adapter aux trames de votre service et aux textes en vigueur.'

export type DocBlock =
  | { k: 'title'; text: string; sub?: string }
  | { k: 'meta'; rows: [string, string][] }
  | { k: 'h'; text: string }
  | { k: 'p'; text: string }
  | { k: 'list'; items: string[]; ordered?: boolean }
  | { k: 'checks'; items: string[] }
  | { k: 'table'; headers: string[]; rows: string[][]; blankRows?: number; widths?: number[] }
  | { k: 'lines'; n: number }
  | { k: 'qa'; items: { q: string; a?: string; n?: number }[] }
  | { k: 'sign'; left?: string[]; right: string[] }
  | { k: 'note'; text: string }

export interface Doc {
  title: string
  blocks: DocBlock[]
}

// ── Aides pour les modèles ─────────────────────────────────────────────────

/** Valeur d'un champ, ou ligne à compléter. */
export function fv(v: FieldValues, key: string): string {
  const s = (v[key] ?? '').trim()
  return s || BLANK
}

/** Date ISO (aaaa-mm-jj) → jj/mm/aaaa ; vide → ligne à compléter. */
export function fdate(v: FieldValues, key: string): string {
  const s = (v[key] ?? '').trim()
  if (!s) return BLANK
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

/** Lignes non vides d'un champ multiligne. */
export function flines(v: FieldValues, key: string): string[] {
  return (v[key] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * Champ multiligne → liste à puces si renseigné, sinon lignes à compléter.
 * Les puces saisies (« - », « • ») sont retirées.
 */
export function fmulti(v: FieldValues, key: string, blankLines = 3, ordered = false): DocBlock {
  const lines = flines(v, key).map((l) => l.replace(/^[-•*]\s*/, ''))
  if (!lines.length) return { k: 'lines', n: blankLines }
  if (lines.length === 1) return { k: 'p', text: lines[0] }
  return { k: 'list', items: lines, ordered }
}

/** Tableau saisi « une ligne par élément, colonnes séparées par ; ou | ». */
export function ftable(v: FieldValues, key: string, cols: number): string[][] {
  return flines(v, key).map((l) => {
    const cells = l.split(/\s*[;|\t]\s*/)
    const row = cells.slice(0, cols)
    if (cells.length > cols) row[cols - 1] = cells.slice(cols - 1).join(' ; ')
    while (row.length < cols) row.push('')
    return row
  })
}

// ── Rendu HTML ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Échappe, puis applique **gras**, retours à la ligne et champs vides. */
function inlineHtml(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .split(BLANK)
    .join('<span class="blank"></span>')
}

const CSS = `
@page { size: A4; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: #000; background: #fff; font: 10.5pt/1.45 Georgia, 'Times New Roman', serif; }
.page { max-width: 180mm; margin: 0 auto; padding: 10mm 0 14mm; }
.notice { border: 1px solid #000; padding: 4px 8px; font: italic 8.5pt/1.35 Arial, sans-serif; margin-bottom: 8mm; }
h1 { font: 700 14pt/1.25 Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; text-align: center; margin: 0; }
.sub { text-align: center; font: 9.5pt/1.3 Arial, sans-serif; margin: 3px 0 6mm; }
h2 { font: 700 10.5pt/1.3 Arial, sans-serif; text-transform: uppercase; letter-spacing: .03em; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 6mm 0 2.5mm; break-after: avoid; }
p { margin: 0 0 2.5mm; text-align: justify; }
ul, ol { margin: 0 0 2.5mm; padding-left: 7mm; }
li { margin: 0 0 1.2mm; }
table { width: 100%; border-collapse: collapse; margin: 1mm 0 3mm; font-size: 9.5pt; }
th, td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; text-align: left; word-break: break-word; }
th { font: 700 8.5pt/1.25 Arial, sans-serif; text-transform: uppercase; background: #f2f2f2; }
td.e { height: 8mm; }
table.meta td { border: 0; padding: 1px 0; }
table.meta td.l { width: 42mm; font: 700 9pt Arial, sans-serif; }
.blank { display: inline-block; min-width: 45mm; border-bottom: 1px dotted #000; height: 1.05em; vertical-align: baseline; }
.line { border-bottom: 1px dotted #555; height: 7.5mm; }
.checks { list-style: none; padding-left: 0; }
.checks li { padding-left: 6mm; text-indent: -6mm; }
.box { display: inline-block; width: 3.4mm; height: 3.4mm; border: 1px solid #000; margin-right: 2.6mm; vertical-align: -0.4mm; text-indent: 0; }
.qa { margin: 0 0 3mm; break-inside: avoid; }
.qa .q { font-weight: 700; margin-bottom: 1mm; }
.qa .a { padding-left: 6mm; }
.note { border-left: 3px solid #000; padding: 2px 0 2px 8px; margin: 3mm 0; font-size: 9.5pt; }
.sign { display: flex; justify-content: space-between; gap: 12mm; margin-top: 10mm; break-inside: avoid; }
.sign div { flex: 1; min-height: 28mm; }
.sign div.r { text-align: right; }
.foot { margin-top: 10mm; border-top: 1px solid #000; padding-top: 2mm; font: 8pt Arial, sans-serif; text-align: center; }
.print { position: fixed; top: 12px; right: 12px; font: 600 13px Arial, sans-serif; padding: 7px 14px; border-radius: 8px; border: 1px solid #000; background: #fff; cursor: pointer; }
@media print { .print { display: none; } .page { padding: 0; } }
`

function blockHtml(b: DocBlock): string {
  switch (b.k) {
    case 'title':
      return `<h1>${inlineHtml(b.text)}</h1>${b.sub ? `<div class="sub">${inlineHtml(b.sub)}</div>` : '<div class="sub"></div>'}`
    case 'meta':
      return `<table class="meta">${b.rows.map(([l, val]) => `<tr><td class="l">${inlineHtml(l)}</td><td>${inlineHtml(val)}</td></tr>`).join('')}</table>`
    case 'h':
      return `<h2>${inlineHtml(b.text)}</h2>`
    case 'p':
      return `<p>${inlineHtml(b.text)}</p>`
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul'
      return `<${tag}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${tag}>`
    }
    case 'checks':
      return `<ul class="checks">${b.items.map((i) => `<li><span class="box"></span>${inlineHtml(i)}</li>`).join('')}</ul>`
    case 'table': {
      const cols = b.headers.length
      const head = `<tr>${b.headers.map((h, i) => `<th${b.widths?.[i] ? ` style="width:${b.widths[i]}%"` : ''}>${inlineHtml(h)}</th>`).join('')}</tr>`
      const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${c ? inlineHtml(c) : '&nbsp;'}</td>`).join('')}</tr>`).join('')
      const blanks = Array.from({ length: b.blankRows ?? 0 }, () => `<tr>${'<td class="e"></td>'.repeat(cols)}</tr>`).join('')
      return `<table>${head}${rows}${blanks}</table>`
    }
    case 'lines':
      return Array.from({ length: b.n }, () => '<div class="line"></div>').join('')
    case 'qa':
      return b.items
        .map((it, i) => {
          const a = it.a?.trim()
          return `<div class="qa"><div class="q">${i + 1}. ${inlineHtml(it.q)}</div>${a ? `<div class="a">${inlineHtml(a)}</div>` : Array.from({ length: it.n ?? 2 }, () => '<div class="line"></div>').join('')}</div>`
        })
        .join('')
    case 'sign':
      return `<div class="sign"><div>${(b.left ?? []).map(inlineHtml).join('<br>')}</div><div class="r">${b.right.map(inlineHtml).join('<br>')}</div></div>`
    case 'note':
      return `<div class="note">${inlineHtml(b.text)}</div>`
  }
}

export function docToHtml(doc: Doc, opts: { printButton?: boolean } = {}): string {
  const body = doc.blocks.map(blockHtml).join('\n')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${CSS}</style></head>
<body>${opts.printButton ? '<button class="print" onclick="window.print()">Imprimer / PDF</button>' : ''}<div class="page">
<div class="notice">${esc(NOTICE)}</div>
${body}
<div class="foot">Document généré par SPECTRA — ${esc(NOTICE)}</div>
</div></body></html>`
}

// ── Rendu texte ────────────────────────────────────────────────────────────

const DOTS = '……………………'

function inlineText(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').split(BLANK).join(DOTS)
}

function blockText(b: DocBlock): string {
  switch (b.k) {
    case 'title':
      return [inlineText(b.text).toUpperCase(), b.sub ? inlineText(b.sub) : ''].filter(Boolean).join('\n')
    case 'meta':
      return b.rows.map(([l, val]) => `${inlineText(l)} : ${inlineText(val)}`).join('\n')
    case 'h':
      return inlineText(b.text).toUpperCase()
    case 'p':
      return inlineText(b.text)
    case 'list':
      return b.items.map((i, n) => `${b.ordered ? `${n + 1}.` : '-'} ${inlineText(i)}`).join('\n')
    case 'checks':
      return b.items.map((i) => `[ ] ${inlineText(i)}`).join('\n')
    case 'table': {
      const head = b.headers.map(inlineText).join(' | ')
      const rows = b.rows.map((r) => r.map((c) => (c ? inlineText(c) : '')).join(' | '))
      const blanks = Array.from({ length: b.blankRows ?? 0 }, () => b.headers.map(() => '').join(' | '))
      return [head, ...rows, ...blanks].join('\n')
    }
    case 'lines':
      return Array.from({ length: b.n }, () => DOTS + DOTS + DOTS).join('\n')
    case 'qa':
      return b.items.map((it, i) => `${i + 1}. ${inlineText(it.q)}\n   ${it.a?.trim() ? inlineText(it.a.trim()).replace(/\n/g, '\n   ') : DOTS + DOTS}`).join('\n')
    case 'sign':
      return [...(b.left ?? []), '', ...b.right].map(inlineText).join('\n')
    case 'note':
      return `NB : ${inlineText(b.text)}`
  }
}

export function docToText(doc: Doc): string {
  return [`[${NOTICE}]`, ...doc.blocks.map(blockText)].join('\n\n').replace(/\n{3,}/g, '\n\n')
}
