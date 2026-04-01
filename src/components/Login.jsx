import { useState } from 'react'
import { useAuth } from '../hooks/useData'

export default function Login({ onGoToRegister }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: err } = await login(email, password)

    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          : err.message
      )
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '400px' }}>
        <div className="login-header">
          <div className="login-logo">⚡</div>
          <h1 className="login-title">Ceriraga</h1>
          <p className="login-subtitle">Sistema de Gestión de Recargas</p>
        </div>

        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: 'rgba(255, 107, 107, 0.1)', 
            border: '1px solid rgba(255, 107, 107, 0.2)', 
            borderRadius: '8px',
            color: '#ff6b6b',
            fontSize: '14px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Correo electrónico</label>
            <input
              type="email"
              className="form-input"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px' }} disabled={loading}>
            {loading ? '⏳ Cargando...' : '🔐 Iniciar Sesión'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
          <span style={{ color: 'var(--text-muted)' }}>¿No tienes cuenta? </span>
          <button
            type="button"
            style={{ 
              color: 'var(--accent-primary)', 
              cursor: 'pointer', 
              fontWeight: 600, 
              border: 'none', 
              background: 'none',
              padding: '0 4px'
            }}
            onClick={onGoToRegister}
          >
            Regístrate aquí
          </button>
        </p>
      </div>
    </div>
  )
}
