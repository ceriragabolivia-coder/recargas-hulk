import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useClientes } from '../hooks/useData'

export default function Perfil() {
  const { user, perfil, updatePassword } = useAuth()
  const { updateProfile } = useClientes()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'
  
  const [whatsapp, setWhatsapp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const [misCupones, setMisCupones] = useState([])
  const [loadingCupones, setLoadingCupones] = useState(true)

  useEffect(() => {
    if (window.location.hash === '#mis-cupones') {
      setTimeout(() => {
        const el = document.getElementById('mis-cupones')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 500)
    }
  }, [])

  useEffect(() => {
    if (perfil?.whatsapp) {
      setWhatsapp(perfil.whatsapp)
    }
  }, [perfil])

  useEffect(() => {
    if (user?.id) {
      fetchMisCupones()
    }
  }, [user?.id])

  const fetchMisCupones = async () => {
    setLoadingCupones(true)
    const { data, error } = await supabase
      .from('cupones_usuarios')
      .select('usos, cupones(*)')
      .eq('usuario_id', user.id)
      
    if (!error && data) {
      // Filtrar los que están activos y donde usos < max_usos_usuario
      const validos = data.filter(item => 
        item.cupones && 
        item.cupones.activo && 
        (!item.cupones.fecha_fin || new Date() < new Date(item.cupones.fecha_fin)) &&
        (!item.cupones.max_usos_usuario || item.usos < item.cupones.max_usos_usuario)
      )
      setMisCupones(validos)
    }
    setLoadingCupones(false)
  }

  const handleUpdateWhatsApp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await updateProfile(user.id, { whatsapp })
      
      if (error) {
        setMessage({ type: 'error', text: 'Error al actualizar WhatsApp: ' + error.message })
      } else {
        setMessage({ type: 'success', text: 'WhatsApp actualizado correctamente' })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: 'Ocurrió un error inesperado al actualizar' })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await updatePassword(newPassword)
      
      if (error) {
        setMessage({ type: 'error', text: 'Error al cambiar contraseña: ' + error.message })
      } else {
        setMessage({ type: 'success', text: 'Contraseña actualizada con éxito' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      setMessage({ type: 'error', text: 'Ocurrió un error inesperado al cambiar la contraseña' })
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (event) => {
    try {
      setUploadingAvatar(true)
      setMessage({ type: '', text: '' })

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debes seleccionar una imagen para subir.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // Subir a Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Obtener URL publica
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
        
      if (!data.publicUrl) {
         throw new Error('Error al obtener la URL pública')
      }

      // Actualizar perfil
      const { error: updateError } = await updateProfile(user.id, {
        avatar_url: data.publicUrl
      })

      if (updateError) {
        throw updateError
      }
      
      setMessage({ type: 'success', text: 'Avatar actualizado. Recargando...' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al subir avatar: ' + error.message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header mb-24" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="page-subtitle">Gestiona tu información personal y seguridad</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', 
            border: '2px solid var(--accent-primary)', overflow: 'hidden', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', fontSize: '32px'
          }}>
            {perfil?.avatar_url ? (
              <img src={perfil.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{user?.email?.[0].toUpperCase()}</span>
            )}
          </div>
          <label className="btn btn-sm" style={{ cursor: 'pointer', backgroundColor: 'var(--bg-secondary)' }}>
            {uploadingAvatar ? 'G.' : '✏️ Cambiar Foto'}
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
          </label>
        </div>
      </div>

      {message.text && (
        <div className={`card mb-24`} style={{ 
          padding: '12px 16px', 
          backgroundColor: message.type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
          color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          border: `1px solid ${message.type === 'success' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)'}`,
          borderRadius: '12px',
          fontSize: '14px'
        }}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Sección Datos de Contacto */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📞</span> Datos de Contacto
          </h3>
          <form onSubmit={handleUpdateWhatsApp}>
            <div className="form-group mb-16">
              <label className="form-label">Correo Electrónico</label>
              <input type="text" className="form-input" value={user?.email} disabled style={{ opacity: 0.6 }} />
              <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                El correo no se puede cambiar.
              </small>
            </div>
            
            <div className="form-group mb-24">
              <label className="form-label">Número de WhatsApp</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>📱</span>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '40px', opacity: isAdmin ? 1 : 0.6 }}
                  placeholder="+58 412..."
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              {!isAdmin && (
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Para modificar tu WhatsApp vinculado, por favor contacta a Soporte.
                </small>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !isAdmin}>
              {loading ? 'Guardando...' : 'Actualizar WhatsApp'}
            </button>
          </form>
        </div>

        {/* Sección Seguridad */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔒</span> Seguridad
          </h3>
          <form onSubmit={handleChangePassword}>
            <div className="form-group mb-16">
              <label className="form-label">Nueva Contraseña</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group mb-24">
              <label className="form-label">Confirmar Nueva Contraseña</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-24" style={{ backgroundColor: 'rgba(52, 152, 219, 0.05)', border: '1px dashed rgba(52, 152, 219, 0.2)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--accent-primary)' }}>💡 Información de Cuenta</h4>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          <div><strong>Nickname:</strong> {perfil?.nickname || 'No asignado'}</div>
          <div><strong>Rol:</strong> {
            perfil?.rol === 'admin' ? '👑 Administrador' :
            perfil?.rol === 'revendedor' ? '⭐ Revendedor' : '👤 Cliente'
          }</div>
          <div><strong>País:</strong> {perfil?.pais || 'No especificado'}</div>
        </div>
      </div>

      {/* Mis Cupones */}
      <div id="mis-cupones" className="card mt-24" style={{ scrollMarginTop: '80px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎟️</span> Mis Cupones
        </h3>
        {loadingCupones ? (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Cargando cupones...</div>
        ) : misCupones.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🎫</span>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Aún no tienes cupones de descuento disponibles.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {misCupones.map((c, i) => (
              <div key={i} style={{ padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(216,180,254,0.05) 100%)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, fontSize: '18px', color: '#a855f7' }}>{c.cupones.codigo}</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>-{c.cupones.porcentaje_descuento}%</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>Usos restantes: {(c.cupones.max_usos_usuario || 1) - c.usos}</div>
                  {c.cupones.fecha_fin && <div>Vence: {new Date(c.cupones.fecha_fin).toLocaleDateString()}</div>}
                </div>
                <button 
                  className="btn btn-sm" 
                  onClick={() => { navigator.clipboard.writeText(c.cupones.codigo); alert("¡Código copiado!") }}
                  style={{ marginTop: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}
                >
                  📋 Copiar Código
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
