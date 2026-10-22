import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { prefetchSolar } from './hooks/useSolar'
import { prefetchHostStats } from './hooks/useHostStats'

// De menubalk zit in de 3D-scène en mount pas als alle modellen geladen
// zijn; door de API-calls nu al te starten staat de data er meteen.
prefetchSolar()
prefetchHostStats()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
