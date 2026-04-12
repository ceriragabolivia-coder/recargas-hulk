import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  </BrowserRouter>
)
