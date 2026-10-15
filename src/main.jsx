import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import { configured } from './supabase'
import { AuthProvider } from './auth'
import { BadgesProvider } from './badges'
import App from './App'
import Setup from './pages/Setup'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {configured ? (
      <BrowserRouter>
        <AuthProvider>
          <BadgesProvider>
            <App />
          </BadgesProvider>
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <Setup />
    )}
  </React.StrictMode>
)
