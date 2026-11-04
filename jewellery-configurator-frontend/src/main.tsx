import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store/Store'
import { AuthProvider } from './auth'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider><StoreProvider><App /></StoreProvider></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
