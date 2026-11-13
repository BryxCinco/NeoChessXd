import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme, savedThemeId } from './themes/themes.js'

// Put the saved theme on the page before the first render: no flash of the
// default look.
applyTheme(savedThemeId())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
