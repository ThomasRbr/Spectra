/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05070d',
          900: '#090d18',
          850: '#0c1120',
          800: '#10172a',
          700: '#172036',
          600: '#1f2b47',
          500: '#2c3a5c',
          400: '#4a5a80',
          300: '#7a88a8',
          200: '#a9b4cc',
          100: '#d6dcea',
        },
        accent: { DEFAULT: '#22d3ee', soft: '#0e7490' },
        violet: { glow: '#a78bfa' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,.25), 0 0 24px -4px rgba(34,211,238,.35)',
        panel: '0 10px 40px -10px rgba(0,0,0,.6)',
      },
      keyframes: {
        fadein: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(34,211,238,.5)' }, '100%': { boxShadow: '0 0 0 12px rgba(34,211,238,0)' } },
      },
      animation: { fadein: 'fadein .25s ease-out', pulseRing: 'pulseRing 1.6s infinite' },
    },
  },
  plugins: [],
}
