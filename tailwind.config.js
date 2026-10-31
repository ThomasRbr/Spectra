import defaultColors from 'tailwindcss/colors.js'
import plugin from 'tailwindcss/plugin.js'

// Toutes les couleurs de l'interface passent par des variables CSS (canaux RGB),
// ce qui permet deux thèmes sur les mêmes classes :
// - « encre » (par défaut) : graphite sombre, pour enquêter ;
// - « papier » (.theme-paper) : clair, pour lire et pour les documents.
// .theme-ink remet le thème sombre à l'intérieur d'une zone papier
// (simulateurs, schémas, aperçu du graphe).

const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

const INK_DARK = {
  950: '#0e1013', 900: '#121418', 850: '#15181d', 800: '#1b1f25', 700: '#262b33', 600: '#2f353e',
  500: '#3d444f', 400: '#7a8290', 300: '#959da9', 200: '#b4bbc5', 100: '#dfe3e8', strong: '#f3f5f7',
}
const INK_PAPER = {
  950: '#f7f7f5', 900: '#ffffff', 850: '#fbfbfa', 800: '#f1f2f4', 700: '#e3e5e8', 600: '#d5d8dd',
  500: '#b9bec6', 400: '#646c78', 300: '#525a65', 200: '#3b424c', 100: '#252a31', strong: '#111317',
}
const ACCENT_DARK = { DEFAULT: '#7ea6ff', strong: '#a9c3ff', soft: '#3a5a9e', ink: '#0b0d10' }
const ACCENT_PAPER = { DEFAULT: '#2f5bd3', strong: '#1e3f9e', soft: '#9db4ec', ink: '#ffffff' }

// Familles sémantiques (succès, alerte, danger, juridique…) : sur papier, les teintes
// claires faites pour le fond sombre sont remplacées par leurs versions foncées.
const FAMILIES = ['cyan', 'sky', 'teal', 'emerald', 'green', 'lime', 'yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'indigo', 'blue']
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
const PAPER_SHADE = { 50: 900, 100: 800, 200: 800, 300: 700, 400: 700, 500: 600, 600: 700, 700: 700, 800: 800, 900: 900 }

function vars(ink, accent, paper) {
  const out = {}
  for (const [k, c] of Object.entries(ink)) out[`--ink-${k}`] = hex(c)
  for (const [k, c] of Object.entries(accent)) out[`--accent${k === 'DEFAULT' ? '' : `-${k}`}`] = hex(c)
  for (const f of FAMILIES) for (const s of SHADES) out[`--${f}-${s}`] = hex(defaultColors[f][paper ? PAPER_SHADE[s] : s])
  return out
}

const semantic = Object.fromEntries(FAMILIES.map((f) => [f, Object.fromEntries(SHADES.map((s) => [s, v(`${f}-${s}`)]))]))

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      // Sept tailles d'interface (plus une d'affichage) au lieu de vingt.
      fontSize: {
        micro: '11px',
        meta: '12px',
        dense: '13px',
        body: '14px',
        title: '16px',
        section: '20px',
        page: '28px',
        display: '36px',
      },
      colors: {
        white: v('ink-strong'),
        ink: Object.fromEntries(Object.keys(INK_DARK).map((k) => [k, v(`ink-${k}`)])),
        accent: { DEFAULT: v('accent'), strong: v('accent-strong'), soft: v('accent-soft'), ink: v('accent-ink') },
        ...semantic,
      },
      boxShadow: {
        panel: '0 12px 32px -12px rgb(0 0 0 / .45)',
        pop: '0 16px 48px -16px rgb(0 0 0 / .55), 0 0 0 1px rgb(var(--ink-700) / .9)',
      },
      keyframes: {
        fadein: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        slidein: { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'none' } },
        pulseOnce: { '0%': { boxShadow: '0 0 0 0 rgb(var(--accent) / .45)' }, '100%': { boxShadow: '0 0 0 10px rgb(var(--accent) / 0)' } },
      },
      animation: { fadein: 'fadein .2s ease-out', slidein: 'slidein .2s ease-out', pulseOnce: 'pulseOnce .9s ease-out 2' },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // --tint : part de la couleur de donnée gardée quand elle sert de texte (voir tint()).
      const dark = { ...vars(INK_DARK, ACCENT_DARK, false), '--tint': '82%', 'color-scheme': 'dark' }
      const paper = { ...vars(INK_PAPER, ACCENT_PAPER, true), '--tint': '48%', 'color-scheme': 'light' }
      addBase({ ':root': dark, '.theme-ink': dark, '.theme-paper': paper })
    }),
  ],
}
