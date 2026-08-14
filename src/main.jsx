import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'
import { WalletProvider } from './context/WalletContext'


// Error Boundary simple para producción
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { 
    if (error && error.message && error.message.includes("Failed to fetch dynamically imported module")) {
      const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0');
      if (reloadCount < 2) {
        sessionStorage.setItem('chunk_reload_count', (reloadCount + 1).toString());
        // Forzar recarga ignorando caché añadiendo un query param
        const url = new URL(window.location.href);
        url.searchParams.set('v', new Date().getTime());
        window.location.href = url.toString();
      } else {
        sessionStorage.removeItem('chunk_reload_count');
        return { hasError: true, error: new Error("No se pudo cargar una sección de la página. Por favor, borra la caché de tu navegador e intenta nuevamente.") };
      }
      return { hasError: false, error: null };
    }
    return { hasError: true, error }; 
  }
  componentDidCatch(error, info) { console.error("❌ Error Fatal en React:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', background: '#1a1a1a', height: '100vh' }}>
          <h1>Algo salió mal al cargar la aplicación</h1>
          <pre style={{ color: '#ff4d4d' }}>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("❌ No se encontró el elemento #root en el DOM");
} else {
  ReactDOM.createRoot(rootElement).render(
    <RootErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ConfigProvider>
            <CartProvider>
              <WalletProvider>
                <App />
                <Analytics />
                <SpeedInsights />
              </WalletProvider>
            </CartProvider>
          </ConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}
