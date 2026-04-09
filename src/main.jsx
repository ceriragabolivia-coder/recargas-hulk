import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

import { CartProvider } from './hooks/useData'
import { ConfigProvider } from './context/ConfigContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
