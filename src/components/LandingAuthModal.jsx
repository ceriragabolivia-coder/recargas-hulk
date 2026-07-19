import React, { useState, useEffect } from 'react'
import { useAuth, useConfiguracion } from '../hooks/useData'
import { supabase } from '../lib/supabase'

export default function LandingAuthModal({ isOpen, onClose, initialView = 'login' }) {
  const [view, setView] = useState(initialView) // 'login' or 'register'
  const { login, loading: authLoading } = useAuth()
  const { config } = useConfiguracion()

  const authIcon = '/logo_verde.png'
  const logoSize = config?.landing_auth_logo_size || '100px'
  const titleSize = config?.landing_auth_title_size || '24px'
  const textSize = config?.landing_auth_text_size || '14px'
  const bgImage = config?.landing_auth_bg_image || null
  
  const bgOpacityStr = config?.landing_auth_bg_opacity || '85'
  const bgOpacity = parseInt(bgOpacityStr, 10) / 100
  const overlayColorTop = `rgba(17, 24, 39, ${bgOpacity})`
  const overlayColorBottom = `rgba(17, 24, 39, ${Math.min(bgOpacity + 0.1, 1)})`

  useEffect(() => {
      if (isOpen) {
      setView(initialView)
      setError(null)
      setSuccessMsg(null)

      // Mostrar mensaje si la cuenta está pendiente de aprobación
      const isPending = sessionStorage.getItem('account_pending')
      if (isPending) {
        sessionStorage.removeItem('account_pending')
        setView('login')
        setError('⏳ Tu cuenta está pendiente de aprobación por un administrador. Te avisaremos cuando esté activa.')
        return
      }

      // Cargar email recordado
      const savedEmail = localStorage.getItem('rememberedEmail')
      if (savedEmail) {
        setLoginEmail(savedEmail)
        setRememberMe(true)
      }
    }
  }, [isOpen, initialView])
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  
  // Register State
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regNombre, setRegNombre] = useState('')
  const [regTelefono, setRegTelefono] = useState('')
  const [regCreadorCodigo, setRegCreadorCodigo] = useState('')
  const [regRole, setRegRole] = useState('cliente')
  const [ageOption, setAgeOption] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  
  // Remember Me State
  const [rememberMe, setRememberMe] = useState(false)
  
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
      // Manejar "Recordar sesión"
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', loginEmail)
      } else {
        localStorage.removeItem('rememberedEmail')
      }
      onClose()
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (isRegistering) return
    setError(null)
    setSuccessMsg(null)

    if (regPassword !== regConfirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (!ageOption) {
      setError('Debes confirmar tu edad para poder registrarte.')
      return
    }

    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones de uso de la plataforma para continuar.')
      return
    }

    setIsRegistering(true)
    try {
      let cleanPhone = regTelefono.replace(/\D/g, '')
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1)
      }
      let formattedPhone = ''
      if (cleanPhone.startsWith('58') && cleanPhone.length >= 11) {
        formattedPhone = '+' + cleanPhone
      } else {
        formattedPhone = '+58' + cleanPhone
      }

      if (formattedPhone.length < 12) {
        throw new Error('El número de teléfono debe tener al menos 10 dígitos (ej: 4120000000)')
      }

      const { data: checkData, error: checkError } = await supabase.rpc('check_registration_data', {
        p_email: regEmail,
        p_whatsapp: formattedPhone
      })

      if (checkError) {
        throw new Error('Ocurrió un error al verificar los datos de registro. Por favor, intenta de nuevo.')
      }

      if (checkData?.email_exists) {
        throw new Error('Este correo electrónico ya está registrado en nuestro sistema (activo o suspendido). Por favor, utiliza otro.')
      }

      if (checkData?.whatsapp_exists) {
        throw new Error('Este número de WhatsApp ya se encuentra asociado a otra cuenta.')
      }

      if (regCreadorCodigo.trim()) {
        const { data: codeData, error: codeErr } = await supabase
          .from('codigos_creadores')
          .select('id, activo, usos_totales, limite_global')
          .ilike('codigo', regCreadorCodigo.trim())
          .maybeSingle();
        
        if (codeErr) throw new Error('Error al validar el código de creador');
        if (!codeData) throw new Error('El Código de Creador ingresado no existe.');
        if (!codeData.activo) throw new Error('El Código de Creador ingresado ya no está activo.');
        if (codeData.limite_global > 0 && codeData.usos_totales >= codeData.limite_global) throw new Error('Este Código de Creador ya alcanzó su límite máximo de usos.');
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
            creador_codigo: regCreadorCodigo.trim().toUpperCase(),
            role_requested: regRole
          }
        }
      })

      if (authError) throw authError

      setSuccessMsg('✅ ¡Registro exitoso! Tu cuenta está pendiente de aprobación.')
      setView('pending_approval')

    } catch (err) {
      setError(err.message)
    } finally {
      setIsRegistering(false)
    }
  }

  const loadingState = isSubmitLoading || isRegistering

  return (
    <div className="landing-modal-overlay" onClick={onClose}>
      <div 
        className="landing-modal-content" 
        onClick={e => e.stopPropagation()}
        style={{
          backgroundImage: bgImage ? `linear-gradient(${overlayColorTop}, ${overlayColorBottom}), url(${bgImage})` : undefined,
          backgroundSize: '100% auto',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <button className="landing-modal-close" onClick={onClose}>&times;</button>

        <div className="landing-auth-container">
          <div className="landing-auth-header">
            {view !== 'login' && (
              <h2 style={{ fontSize: titleSize }}>
                {view === 'pending_approval' ? 'Solicitud de Aprobación' : 'Crea tu cuenta'}
              </h2>
            )}
            <p style={{ 
              fontSize: view === 'login' ? `calc(${textSize} + 1px)` : textSize, 
              fontWeight: view === 'login' ? 'bold' : 'normal',
              color: view === 'login' ? '#ffffff' : undefined,
              marginTop: view === 'login' ? '4px' : '0',
              whiteSpace: view === 'login' ? 'nowrap' : 'normal'
            }}>
              {view === 'login' ? 'Ingresa tus credenciales para continuar' : view === 'pending_approval' ? 'Por favor solicita la activación de tu cuenta' : 'Únete a la mejor plataforma de recargas'}
            </p>
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
                  name="email"
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
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-remember-me">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Recordar mi cuenta en este navegador
                </label>
              </div>
              <button type="submit" className="btn-landing-primary w-full mt-4" disabled={loadingState}>
                {loadingState ? '⏳ Procesando...' : '🔐 Iniciar Sesión'}
              </button>
              
              <div className="landing-auth-switch" style={{ marginTop: '50px', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', color: '#e2e8f0' }}>¿No tienes cuenta?</span>
                <button 
                  type="button" 
                  onClick={() => { setView('register'); setError(null); }}
                  style={{ 
                    fontWeight: 'bold', 
                    color: 'var(--accent-primary, #a3e635)', 
                    textDecoration: 'underline', 
                    fontSize: '15px',
                    marginLeft: '8px'
                  }}
                >
                  Regístrate aquí
                </button>
              </div>
            </form>
          ) : view === 'pending_approval' ? (
            <div className="landing-auth-pending-container">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontSize: '15px', color: 'var(--text-main, #0f172a)', lineHeight: '1.6', marginBottom: '24px' }}>
                  Tu cuenta ha sido creada con éxito. Para comenzar a operar en la plataforma, debes solicitar la aprobación de tu cuenta a nuestro equipo de soporte técnico.
                </p>
                
                <a 
                  href={`https://wa.me/584145078108?text=${encodeURIComponent(`Hola! Quiero validar mi cuenta en la plataforma Recargas Hulk! Mi usuario es ${regNombre}`)}`}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-whatsapp-approval"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 448 512" 
                    style={{ width: '20px', height: '20px', fill: 'currentColor' }}
                  >
                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                  </svg>
                  Solicitar Aprobación
                </a>
              </div>
              
              <div className="landing-auth-switch" style={{ marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => { 
                    setView('login'); 
                    setLoginEmail(regEmail); 
                    setSuccessMsg(null); 
                    setError(null); 
                  }}
                >
                  ← Volver al Inicio de Sesión
                </button>
              </div>
            </div>
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
                  <span className="phone-prefix" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px' }}>
                    <img loading="lazy" decoding="async" src="/assets/venezuela_flag.png" 
                      alt="Venezuela Flag" 
                      style={{ width: '22px', height: 'auto', display: 'block', pointerEvents: 'none' }} 
                    />
                  </span>
                  <input
                    type="tel"
                    placeholder="Tu Número De WhatsApp"
                    value={regTelefono}
                    onChange={(e) => setRegTelefono(e.target.value.replace(/\D/g, ''))}
                    required
                    maxLength={12}
                  />
                </div>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px', display: 'block', textAlign: 'left', fontStyle: 'italic' }}>
                  (Disponible Sólo Para Venezuela)
                </span>
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
              
              <div className="form-group">
                <label>Código de Creador (Opcional)</label>
                <input
                  type="text"
                  placeholder="Si tienes un código, ingrésalo aquí"
                  value={regCreadorCodigo}
                  onChange={(e) => setRegCreadorCodigo(e.target.value.toUpperCase())}
                  maxLength={20}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Confirmar Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'var(--text-muted, #64748b)', textAlign: 'left' }}>
                <div className="checkbox-group">
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="age_modal" 
                      checked={ageOption === 'mayor'} 
                      onChange={() => setAgeOption('mayor')} 
                      style={{ marginTop: '3px', accentColor: 'var(--accent, #7b2ff7)', transform: 'scale(1.2)' }}
                    />
                    <span style={{ lineHeight: '1.4', color: 'var(--text-muted, #64748b)' }}>
                      Confirmo que soy mayor de edad (+18) y me registro en esta página bajo mi responsabilidad y propia voluntad.
                    </span>
                  </label>
                </div>
                
                <div className="checkbox-group">
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="age_modal" 
                      checked={ageOption === 'menor'} 
                      onChange={() => setAgeOption('menor')} 
                      style={{ marginTop: '3px', accentColor: 'var(--accent, #7b2ff7)', transform: 'scale(1.2)' }}
                    />
                    <span style={{ lineHeight: '1.4', color: 'var(--text-muted, #64748b)' }}>
                      Soy menor de edad pero estoy bajo la supervisión de mis padres o tutores responsables y conseguí su consentimiento para registrarme.
                    </span>
                  </label>
                </div>

                <div className="checkbox-group" style={{ marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={termsAccepted} 
                      onChange={(e) => setTermsAccepted(e.target.checked)} 
                      style={{ marginTop: '3px', accentColor: 'var(--accent, #7b2ff7)', transform: 'scale(1.2)' }}
                    />
                    <span style={{ lineHeight: '1.4', color: 'var(--text-muted, #64748b)' }}>
                      Al momento de registrarme en este sitio web acepto los términos y condiciones de uso de la plataforma.
                    </span>
                  </label>
                </div>
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

        /* Checkbox Styling */
        .form-remember-me {
          margin-top: -4px;
          margin-bottom: 4px;
        }
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 13.5px;
          color: var(--text-muted, #64748b);
          user-select: none;
          transition: color 0.2s;
        }
        .checkbox-container:hover {
          color: var(--text-main, #0f172a);
        }
        .checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0; width: 0;
        }
        .checkmark {
          height: 18px;
          width: 18px;
          background-color: var(--bg-page, #f8fafc);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 4px;
          position: relative;
          transition: all 0.2s ease;
        }
        .checkbox-container:hover input ~ .checkmark {
          border-color: var(--accent, #7b2ff7);
        }
        .checkbox-container input:checked ~ .checkmark {
          background-color: var(--accent, #7b2ff7);
          border-color: var(--accent, #7b2ff7);
          box-shadow: 0 0 8px rgba(123, 47, 247, 0.3);
        }
        .checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }
        .checkbox-container input:checked ~ .checkmark:after {
          display: block;
        }
        .checkbox-container .checkmark:after {
          left: 6px;
          top: 2px;
          width: 4px;
          height: 9px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .btn-whatsapp-approval {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background-color: #25D366;
          color: #fff !important;
          font-weight: 700;
          font-size: 16px;
          padding: 14px 24px;
          border-radius: 12px;
          text-decoration: none;
          width: 100%;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
          margin-top: 10px;
          box-sizing: border-box;
        }
        .btn-whatsapp-approval:hover {
          background-color: #20ba5a;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4);
        }
        .btn-whatsapp-approval:active {
          transform: translateY(0);
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
