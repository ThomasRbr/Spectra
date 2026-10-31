// Identité SPECTRA : un prisme qui décompose un faisceau en trois couleurs,
// comme l'analyse décompose un flux. Les trois rayons reprennent les teintes
// de données de l'interface (Bitcoin, stablecoins, sélection).

export const SPECTRUM = ['#f2a541', '#3fc7a4', '#7ea6ff'] as const

/** Marque seule, sans fond. `mono` la dessine dans la couleur du texte courant. */
export function SpectraMark({ size = 28, mono = false, className }: { size?: number; mono?: boolean; className?: string }) {
  const [a, b, c] = mono ? ['currentColor', 'currentColor', 'currentColor'] : SPECTRUM
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className ?? ''}`} role="img" aria-label="Spectra">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}>
        <path d="M1.8 18.2 10 16" stroke="currentColor" strokeOpacity={0.55} />
        <path d="M10 16l7.8-.5" stroke="currentColor" strokeOpacity={0.3} />
        <path d="M6 25 14 7l8 18z" stroke="currentColor" fill="currentColor" fillOpacity={0.06} />
        <path d="M17.8 15.5 30.2 10.8" stroke={a} />
        <path d="M17.8 15.5h12.4" stroke={b} />
        <path d="M17.8 15.5l12.4 4.7" stroke={c} />
      </g>
    </svg>
  )
}

/** La marque en SVG brut, pour les documents imprimables (fond clair). */
export function spectraMarkSvg(size = 40, ink = '#1b1e23'): string {
  const [a, b, c] = ['#d98a1f', '#1e9c7e', '#2f5bd3']
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"><path d="M1.8 18.2 10 16" stroke="${ink}" stroke-opacity=".55"/><path d="M10 16l7.8-.5" stroke="${ink}" stroke-opacity=".3"/><path d="M6 25 14 7l8 18z" stroke="${ink}" fill="${ink}" fill-opacity=".05"/><path d="M17.8 15.5 30.2 10.8" stroke="${a}"/><path d="M17.8 15.5h12.4" stroke="${b}"/><path d="M17.8 15.5l12.4 4.7" stroke="${c}"/></g></svg>`
}

/** Marque + nom, pour la navigation. */
export function SpectraWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-white">
      <SpectraMark size={28} />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.16em]">SPECTRA</div>
          <div className="mt-1 text-micro text-ink-400">Crypto Tracing Lab</div>
        </div>
      )}
    </div>
  )
}
