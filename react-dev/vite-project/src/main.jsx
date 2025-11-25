import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PlatoonApp from './PlatoonApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PlatoonApp />
  </StrictMode>,
)
