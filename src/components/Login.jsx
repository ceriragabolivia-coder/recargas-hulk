import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useData'

export default function Login({ onGoToRegister }) {
  const { login, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const isSubmitLoading = authLoading

  useEffect(() => {
    const reason = sessionStorage.getItem('logout_reason')
    if (reason === 'security_timeout') {
      setError('Tu sesión fue cerrada automáticamente por medidas de seguridad debido a inactividad. Por favor, vuelve a iniciar sesión.')
      sessionStorage.removeItem('logout_reason')
    }
  }, [])

  async function handleSubmit(e) {
    if (isSubmitLoading) return
    e.preventDefault()
    setError(null)

    const { error: err } = await login(email, password)

    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          : err.message
      )
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '400px' }}>
        <div className="login-header">
          <div className="login-logo">{isSubmitLoading ? '⌛' : '⚡'}</div>
          <h1 className="login-title">Ceriraga</h1>
          <p className="login-subtitle">
            {isSubmitLoading ? 'Verificando cuenta, por favor espera...' : 'Sistema de Gestión de Recargas'}
          </p>
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

        <form onSubmit={handleSubmit} style={{ opacity: isSubmitLoading ? 0.6 : 1, pointerEvents: isSubmitLoading ? 'none' : 'auto' }}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Correo electrónico</label>
            <input
              type="email"
              className="form-input"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitLoading}
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
              disabled={isSubmitLoading}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px' }} disabled={isSubmitLoading}>
            {isSubmitLoading ? '⏳ Procesando...' : '🔐 Iniciar Sesión'}
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
