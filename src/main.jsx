import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { CartProvider } from './hooks/useData'
import { ConfigProvider } from './context/ConfigContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </ConfigProvider>
  </React.StrictMode>,
)
