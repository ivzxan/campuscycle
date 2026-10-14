import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { configured } from './supabase'
import { AuthProvider } from './auth'
import App from './App'
import Setup from './pages/Setup'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {configured ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <Setup />
    )}
  </React.StrictMode>
)
