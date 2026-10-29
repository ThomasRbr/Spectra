import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import { App } from './ui/App'
import { useGame } from './store/game'
import { useUi } from './store/ui'

// Accès aux stores depuis la console, en développement uniquement.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__spectra = { game: useGame, ui: useUi }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
