import React, { useState } from 'react'
import { useAuth } from '../hooks/useData'
import { supabase } from '../lib/supabase'

export default function LandingAuthModal({ isOpen, onClose, initialView = 'login' }) {
  const [view, setView] = useState(initialView) // 'login' or 'register'
  const { login, loading: authLoading } = useAuth()
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  
  // Register State
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regNombre, setRegNombre] = useState('')
  const [regTelefono, setRegTelefono] = useState('')
  const [regRole, setRegRole] = useState('cliente')
  
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const isSubmitLoading = authLoading || false
  const [isRegistering, setIsRegistering] = useState(false)

  if (!isOpen) return null

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitLoading) return
    setError(null)

    const { error: err } = await login(loginEmail, loginPassword)
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          : err.message
      )
    } else {
      onClose()
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (isRegistering) return
    setIsRegistering(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const formattedPhone = '+58' + regTelefono.replace(/\D/g, '')
      if (formattedPhone.length < 10) {
        throw new Error('El número de teléfono debe tener al menos 10 dígitos')
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            nombres: regNombre.split(' ')[0] || '',
            apellidos: regNombre.split(' ').slice(1).join(' ') || '',
            whatsapp: formattedPhone,
            pais: 'Venezuela',
            estado: '',
            nickname: '',
            role_requested: regRole
          }
        }
      })

      if (authError) throw authError

      setSuccessMsg('¡Registro exitoso! Tu cuenta está siendo validada por un administrador.')
      setTimeout(() => {
        setView('login')
        setLoginEmail(regEmail)
        setSuccessMsg(null)
      }, 3000)

    } catch (err) {
      setError(err.message)
    } finally {
      setIsRegistering(false)
    }
  }

  const loadingState = isSubmitLoading || isRegistering

  return (
    <div className="landing-modal-overlay" onClick={onClose}>
      <div className="landing-modal-content" onClick={e => e.stopPropagation()}>
        <button className="landing-modal-close" onClick={onClose}>&times;</button>

        <div className="landing-auth-container">
          <div className="landing-auth-header">
            <div className="landing-auth-logo">⚡</div>
            <h2>{view === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
            <p>{view === 'login' ? 'Ingresa tus credenciales para continuar' : 'Únete a la mejor plataforma de recargas'}</p>
          </div>

          {error && (
            <div className="landing-auth-alert error">
              {error}
            </div>
          )}
          
          {successMsg && (
            <div className="landing-auth-alert success">
              {successMsg}
            </div>
          )}

          {view === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="landing-auth-form" style={{ opacity: loadingState ? 0.6 : 1, pointerEvents: loadingState ? 'none' : 'auto' }}>
              <div className="form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-landing-primary w-full mt-4" disabled={loadingState}>
                {loadingState ? '⏳ Procesando...' : '🔐 Iniciar Sesión'}
              </button>
              
              <div className="landing-auth-switch">
                <span>¿No tienes cuenta?</span>
                <button type="button" onClick={() => { setView('register'); setError(null); }}>Regístrate aquí</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="landing-auth-form" style={{ opacity: loadingState ? 0.6 : 1, pointerEvents: loadingState ? 'none' : 'auto' }}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Teléfono (WhatsApp)</label>
                <div className="phone-input-container">
                  <span className="phone-prefix">🇻🇪 +58</span>
                  <input
                    type="tel"
                    placeholder="4120000000"
                    value={regTelefono}
                    onChange={(e) => setRegTelefono(e.target.value.replace(/\D/g, ''))}
                    required
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="•••••••• (Mín. 6 caracteres)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn-landing-primary w-full mt-4" disabled={loadingState}>
                {loadingState ? '⏳ Procesando...' : '📝 Crear Cuenta'}
              </button>
              
              <div className="landing-auth-switch">
                <span>¿Ya tienes cuenta?</span>
                <button type="button" onClick={() => { setView('login'); setError(null); }}>Inicia Sesión</button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .landing-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }
        .landing-modal-content {
          background: var(--bg-card, #fff);
          border-radius: 16px;
          width: 100%;
          max-width: 450px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          border: 1px solid var(--border, #e2e8f0);
          animation: slideUp 0.3s ease-out;
        }
        .landing-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 28px;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          transition: color 0.2s;
        }
        .landing-modal-close:hover {
          color: var(--text-main, #0f172a);
        }
        .landing-auth-container {
          padding: 32px;
        }
        .landing-auth-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .landing-auth-logo {
          font-size: 40px;
          margin-bottom: 16px;
        }
        .landing-auth-header h2 {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          margin-bottom: 8px;
        }
        .landing-auth-header p {
          color: var(--text-muted, #64748b);
          font-size: 14px;
        }
        .landing-auth-alert {
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          text-align: center;
        }
        .landing-auth-alert.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .landing-auth-alert.success {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .landing-auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .landing-auth-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .landing-auth-form label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main, #0f172a);
        }
        .landing-auth-form input,
        .landing-auth-form select {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border, #e2e8f0);
          background: var(--bg-page, #f8fafc);
          color: var(--text-main, #0f172a);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .landing-auth-form input:focus,
        .landing-auth-form select:focus {
          border-color: var(--accent, #7b2ff7);
        }

        .phone-input-container {
          display: flex;
          align-items: center;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          background: var(--bg-page, #f8fafc);
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .phone-input-container:focus-within {
          border-color: var(--accent, #7b2ff7);
        }
        .phone-prefix {
          padding: 10px 12px;
          background: rgba(0,0,0,0.04);
          border-right: 1px solid var(--border, #e2e8f0);
          color: var(--text-main, #0f172a);
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
        }
        .landing-auth-form .phone-input-container input {
          border: none;
          border-radius: 0;
          background: transparent;
          width: 100%;
        }
        .landing-auth-form .phone-input-container input:focus {
          border-color: transparent;
        }

        .w-full { width: 100%; }
        .mt-4 { margin-top: 16px; }
        
        .landing-auth-switch {
          margin-top: 16px;
          text-align: center;
          font-size: 14px;
          color: var(--text-muted, #64748b);
        }
        .landing-auth-switch button {
          background: none;
          border: none;
          color: var(--accent, #7b2ff7);
          font-weight: 600;
          cursor: pointer;
          margin-left: 6px;
          padding: 0;
        }
        .landing-auth-switch button:hover {
          text-decoration: underline;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}
