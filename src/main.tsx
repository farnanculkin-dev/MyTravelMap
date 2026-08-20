import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { checkSupabaseConnectivity } from './lib/supabaseConnectivity'

if (import.meta.env.DEV) {
  void checkSupabaseConnectivity()
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
