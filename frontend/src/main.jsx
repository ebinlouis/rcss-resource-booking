import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.jsx'

const startupLoader = document.getElementById('startup-loader')

if (startupLoader) {
  startupLoader.remove()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)