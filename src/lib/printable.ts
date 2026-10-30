// Ouverture des documents imprimables (rapport, certificats).
// Dans le navigateur : nouvel onglet. Dans l'application de bureau, où les
// nouveaux onglets n'existent pas : aperçu intégré avec impression.

/** Vrai quand SPECTRA tourne dans l'application de bureau (Tauri). */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function openPrintable(html: string, filename: string): void {
  if (!isDesktop) {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      return
    }
  }
  showOverlay(html, filename)
}

function button(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = `font:600 13px Inter,system-ui,sans-serif;padding:7px 14px;border-radius:8px;cursor:pointer;border:1px solid ${primary ? '#22d3ee' : '#2c3a5c'};background:${primary ? '#22d3ee' : '#10172a'};color:${primary ? '#05070d' : '#d6dcea'}`
  return b
}

function showOverlay(html: string, filename: string) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:rgba(5,7,13,.92);backdrop-filter:blur(4px)'
  const bar = document.createElement('div')
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #1f2b47;background:#090d18'
  const title = document.createElement('div')
  title.textContent = 'Aperçu avant impression'
  title.style.cssText = 'flex:1;font:600 14px Inter,system-ui,sans-serif;color:#fff'
  const print = button('Imprimer / PDF', true)
  const save = button('Enregistrer le fichier', false)
  const close = button('Fermer', false)
  bar.append(title, print, save, close)

  const frame = document.createElement('iframe')
  frame.srcdoc = html
  frame.style.cssText = 'flex:1;border:0;background:#fff;margin:16px auto;width:min(1200px,calc(100% - 32px));border-radius:8px'
  overlay.append(bar, frame)
  document.body.append(overlay)

  const dismiss = () => {
    overlay.remove()
    window.removeEventListener('keydown', onKey, true)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      dismiss()
    }
  }
  window.addEventListener('keydown', onKey, true)
  print.onclick = () => frame.contentWindow?.print()
  close.onclick = dismiss
  save.onclick = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
}
