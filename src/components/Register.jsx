import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'

export default function Register({ onBackToLogin }) {
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [ageOption, setAgeOption] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombres: '',
    apellidos: '',
    nickname: '',
    whatsapp: '',
    pais: 'Venezuela',
    estado: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
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

    setLoading(true)
    
    // Check for existing user or whatsapp
    let cleanPhone = formData.whatsapp.replace(/\D/g, '')
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1)
    }
    let fullWhatsapp = ''
    if (cleanPhone.startsWith('58') && cleanPhone.length >= 11) {
      fullWhatsapp = '+' + cleanPhone
    } else {
      fullWhatsapp = '+58' + cleanPhone
    }

    if (fullWhatsapp.length < 12) {
      setError('El número de WhatsApp debe tener al menos 10 dígitos (ej: 4120000000)')
      setLoading(false)
      return
    }

    const { data: checkData, error: checkError } = await supabase.rpc('check_registration_data', {
      p_email: formData.email,
      p_whatsapp: fullWhatsapp
    })

    if (checkError) {
      setError('Ocurrió un error al verificar los datos de registro. Por favor, intenta de nuevo.')
      setLoading(false)
      return
    }

    if (checkData?.email_exists) {
      setError('Este correo electrónico ya está registrado en nuestro sistema (activo o suspendido). Por favor, utiliza otro.')
      setLoading(false)
      return
    }

    if (checkData?.whatsapp_exists) {
      setError('Este número de WhatsApp ya se encuentra asociado a otra cuenta.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await register(formData.email, formData.password, {
      nombres: formData.nombres,
      apellidos: formData.apellidos,
      nickname: formData.nickname,
      whatsapp: fullWhatsapp,
      pais: formData.pais,
      estado: formData.estado
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 className="login-title">¡Registro Exitoso!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Tu cuenta ha sido creada. Ahora puedes iniciar sesión para ver la lista de precios.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', height: '48px' }} onClick={onBackToLogin}>
            Ir al Inicio de Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <div className="login-header">
          <div className="login-logo" style={{ cursor: 'pointer' }} onClick={onBackToLogin}>⚡</div>
          <h1 className="login-title">Registro de Cliente</h1>
          <p className="login-subtitle">Crea tu cuenta para acceder al catálogo</p>
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
          <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>Nombres</label>
              <input name="nombres" type="text" className="form-input" required value={formData.nombres} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>Apellidos</label>
              <input name="apellidos" type="text" className="form-input" required value={formData.apellidos} onChange={handleChange} />
            </div>
          </div>

          <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>Email</label>
              <input name="email" type="email" className="form-input" required value={formData.email} onChange={handleChange} />
            </div>
             <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>WhatsApp</label>
              <div 
                className="form-input" 
                style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 12px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                  <img loading="lazy" decoding="async" src="/assets/venezuela_flag.png" 
                    alt="Venezuela Flag" 
                    style={{ width: '22px', height: 'auto', display: 'block', pointerEvents: 'none' }} 
                  />
                </span>
                <input 
                  name="whatsapp" 
                  type="text" 
                  required
                  style={{ 
                    border: 'none', background: 'transparent', outline: 'none', 
                    color: 'inherit', width: '100%', padding: '12px 12px 12px 0' 
                  }}
                  value={formData.whatsapp} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    if (val.length <= 12) handleChange({ target: { name: 'whatsapp', value: val }})
                  }} 
                  placeholder="Tu Número De WhatsApp"
                  maxLength={12}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                (Disponible Sólo Para Venezuela)
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '13px' }}>Nickname (Opcional)</label>
            <input name="nickname" type="text" className="form-input" value={formData.nickname} onChange={handleChange} />
          </div>

          <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>Contraseña</label>
              <input name="password" type="password" className="form-input" required value={formData.password} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '13px' }}>Confirmar</label>
              <input name="confirmPassword" type="password" className="form-input" required value={formData.confirmPassword} onChange={handleChange} />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div className="checkbox-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="age" 
                  checked={ageOption === 'mayor'} 
                  onChange={() => setAgeOption('mayor')} 
                  style={{ marginTop: '2px', accentColor: 'var(--accent-primary)', transform: 'scale(1.2)' }}
                />
                <span style={{ lineHeight: '1.4' }}>Confirmo que soy mayor de edad (+18) y me registro en esta página bajo mi responsabilidad y propia voluntad.</span>
              </label>
            </div>
            
            <div className="checkbox-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="age" 
                  checked={ageOption === 'menor'} 
                  onChange={() => setAgeOption('menor')} 
                  style={{ marginTop: '2px', accentColor: 'var(--accent-primary)', transform: 'scale(1.2)', minWidth: '13px' }}
                />
                <span style={{ lineHeight: '1.4' }}>Soy menor de edad pero estoy bajo la supervisión de mis padres, representantes o tutores responsables que son mayores de edad y conseguí su permiso y consentimiento para registrarme en esta página. Los pagos estarán efectuados bajo la responsabilidad de mi supervisor y me registro por mi propia voluntad y el de mis tutores.</span>
              </label>
            </div>

            <div className="checkbox-group" style={{ marginTop: '6px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={termsAccepted} 
                  onChange={(e) => setTermsAccepted(e.target.checked)} 
                  style={{ marginTop: '2px', accentColor: 'var(--accent-primary)', transform: 'scale(1.2)' }}
                />
                <span style={{ lineHeight: '1.4' }}>Al momento de registrarme en este sitio web acepto los términos y condiciones de uso de la plataforma.</span>
              </label>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: '48px', marginTop: '24px' }} disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
          <span style={{ color: 'var(--text-muted)' }}>¿Ya tienes cuenta? </span>
          <button 
            type="button"
            style={{ 
              color: 'var(--accent-primary)', 
              fontWeight: 600, 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer',
              padding: '0 4px'
            }}
            onClick={onBackToLogin}
          >
            Inicia Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
