import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ConfigProvider } from './context/ConfigContext'

console.log('🚀 Iniciando sistema principal...');

// Error Boundary simple para producción
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { 
    // Auto-recargar silenciosamente si el error es de un archivo JS desactualizado por un nuevo despliegue
    if (error && error.message && error.message.includes("Failed to fetch dynamically imported module")) {
      window.location.reload();
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
        <ConfigProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </ConfigProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}
