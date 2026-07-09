import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useClientes } from '../hooks/useData'
import AvatarEditor from './AvatarEditor'
import { compressImage } from '../utils/imageCompression'
import { getOptimizedImageUrl } from '../utils/helpers'

export default function LandingPerfil({ onClose }) {
  const { user, perfil, updatePassword, refetch } = useAuth()
  const { updateProfile } = useClientes()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador'
  
  const [whatsapp, setWhatsapp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [alert, setAlert] = useState(null)
  const [localAvatar, setLocalAvatar] = useState(null)
  const [imageToCrop, setImageToCrop] = useState(null)
  
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
    if (user) {
      fetchMisCupones()
    }
  }, [user])

  const fetchMisCupones = async () => {
    setLoadingCupones(true)
    try {
      const { data: usrCupones, error } = await supabase
        .from('cupones_usuarios')
        .select('usos, cupon_id')
        .eq('usuario_id', user.id)

      if (error) throw error

      if (!usrCupones || usrCupones.length === 0) {
        setMisCupones([])
        return
      }

      const cuponIds = usrCupones.map(c => c.cupon_id)
      const { data: cuponesData, error: errC } = await supabase
        .from('cupones')
        .select('*')
        .in('id', cuponIds)

      if (errC) throw errC

      const merged = usrCupones.map(uc => {
        const cData = cuponesData?.find(c => c.id === uc.cupon_id)
        return {
          usos: uc.usos,
          cupones: cData
        }
      })

      const validos = merged.filter(item => 
        item.cupones && 
        item.cupones.activo && 
        (!item.cupones.fecha_fin || new Date() < new Date(item.cupones.fecha_fin)) &&
        (!item.cupones.max_usos_usuario || item.usos < item.cupones.max_usos_usuario)
      )

      setMisCupones(validos)
    } catch (err) {
      console.error('Error fetching cupones:', err)
    } finally {
      setLoadingCupones(false)
    }
  }

  useEffect(() => {
    if (perfil?.whatsapp) {
      setWhatsapp(perfil.whatsapp)
    }
    if (perfil?.avatar_url) {
      setLocalAvatar(perfil.avatar_url)
    }
  }, [perfil])

  const handleUpdateWhatsApp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAlert(null)

    try {
      const { error } = await updateProfile(user.id, { whatsapp })
      if (error) throw error
      setAlert({ type: 'success', message: 'WhatsApp actualizado correctamente' })
      refetch()
    } catch (error) {
      setAlert({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setAlert({ type: 'error', message: 'Las contraseñas no coinciden' })
      return
    }
    if (newPassword.length < 6) {
      setAlert({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    setLoading(true)
    setAlert(null)

    try {
      const { error } = await updatePassword(newPassword)
      if (error) throw error
      setAlert({ type: 'success', message: 'Contraseña actualizada con éxito' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setAlert({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

   const handleAvatarUpload = (event) => {
    if (!event.target.files || event.target.files.length === 0) return
    
    const file = event.target.files[0]
    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveCroppedImage = async (blob) => {
    try {
      setUploadingAvatar(true)
      setAlert(null)
      setImageToCrop(null)

      const compressedBlob = await compressImage(blob)
      const fileName = `${user.id}-${Date.now()}.webp`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedBlob, { cacheControl: '31536000', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
        
      const { error: updateError } = await updateProfile(user.id, {
        avatar_url: data.publicUrl
      })

      if (updateError) throw updateError
      
      setLocalAvatar(data.publicUrl)
      setAlert({ type: 'success', message: 'Avatar actualizado' })
      
      // Forzar recarga inmediata en el contexto global
      await refetch()
      
      // Limpiar estados locales para forzar renderizado desde contexto
      setImageToCrop(null)
    } catch (error) {
      setAlert({ type: 'error', message: error.message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="landing-perfil-container">
      <div className="perfil-header">
        <div className="perfil-title-area">
          <h2>Mi Perfil</h2>
          <p>Personaliza tu cuenta y mantén tu seguridad al día.</p>
        </div>
        <button className="btn-close-perfil" onClick={onClose}>✕</button>
      </div>

      <div className="perfil-content-grid">
        {/* LADO IZQUIERDO: AVATAR E INFO */}
        <div className="perfil-sidebar">
          <div className="avatar-section-card">
            <div className="avatar-wrapper">
              {localAvatar ? (
                <img src={getOptimizedImageUrl(localAvatar, 150)} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">{user?.email?.[0].toUpperCase()}</div>
              )}
              <label className="avatar-edit-btn">
                <span>📷</span>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>
            <div className="user-email-display">{user?.email}</div>
            <div className={`role-badge ${perfil?.rol || 'cliente'}`}>
              {perfil?.rol === 'admin' ? 'Administrador' : perfil?.rol === 'revendedor' ? 'Revendedor' : 'Cliente'}
            </div>

            <div className="account-details-list">
              <div className="detail-item">
                <span className="label">Nickname</span>
                <span className="value">{perfil?.nickname || 'Sin asignar'}</span>
              </div>
              <div className="detail-item">
                <span className="label">País</span>
                <span className="value">{perfil?.pais || 'Venezuela'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIOS */}
        <div className="perfil-main-col">
          {alert && (
            <div className={`alert-inline ${alert.type} fade-in`}>
              {alert.type === 'success' ? '✅' : '❌'} {alert.message}
            </div>
          )}

          <div className="forms-stack">
            {/* WhatsApp Form */}
            <div className="perfil-form-card">
              <h3><span className="icon">📱</span> Datos de Contacto</h3>
              <form onSubmit={handleUpdateWhatsApp}>
                <div className="form-group">
                  <label>Número de WhatsApp</label>
                  <div className="input-with-icon">
                    <span className="input-icon">📞</span>
                    <input 
                      type="text" 
                      placeholder="+58 412..."
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      disabled={!isAdmin && perfil?.rol !== 'revendedor'} // Solo admin o revendedores pueden cambiarlo si no es admin, pero perfil.jsx decía que solo admin.
                    />
                  </div>
                  {!isAdmin && perfil?.rol !== 'revendedor' && (
                    <small className="field-hint">Para cambiar tu WhatsApp contacta a Soporte.</small>
                  )}
                </div>
                <button type="submit" className="btn-save-profile" disabled={loading || (!isAdmin && perfil?.rol !== 'revendedor')}>
                  {loading ? 'Guardando...' : 'Actualizar WhatsApp'}
                </button>
              </form>
            </div>

            {/* Password Form */}
            <div className="perfil-form-card">
              <h3><span className="icon">🔒</span> Seguridad</h3>
              <form onSubmit={handleChangePassword}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nueva Contraseña</label>
                    <input 
                      type="password" 
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirmar Contraseña</label>
                    <input 
                      type="password" 
                      placeholder="Repite la contraseña"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-save-password" disabled={loading}>
                  {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
              </form>
            </div>

            {/* Mis Cupones */}
            <div id="mis-cupones" className="perfil-form-card" style={{ scrollMarginTop: '80px' }}>
              <h3><span className="icon">🎟️</span> Mis Cupones</h3>
              {loadingCupones ? (
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Cargando cupones...</div>
              ) : misCupones.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🎫</span>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Aún no tienes cupones de descuento disponibles.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {misCupones.map((c, i) => (
                    <div key={i} style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.2)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 900, fontSize: '18px', color: '#a855f7' }}>{c.cupones.codigo}</span>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>-{c.cupones.porcentaje_descuento}%</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        <div>Usos restantes: {(c.cupones.max_usos_usuario || 1) - c.usos}</div>
                        {c.cupones.fecha_fin && <div>Vence: {new Date(c.cupones.fecha_fin).toLocaleDateString()}</div>}
                      </div>
                      <button 
                        className="btn-secondary" 
                        style={{ width: '100%', fontSize: '12px', padding: '8px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(c.cupones.codigo); alert("¡Código copiado!") }}
                      >
                        Copiar Código
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
         </div>
      </div>

      {imageToCrop && (
        <AvatarEditor 
          imageSrc={imageToCrop} 
          onSave={handleSaveCroppedImage} 
          onCancel={() => setImageToCrop(null)} 
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .landing-perfil-container {
          background: var(--bg-card);
          border-radius: 24px;
          padding: 30px;
          color: var(--text-main);
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          border: 1px solid var(--border);
          animation: fadeIn 0.4s ease-out;
        }

        .perfil-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .perfil-title-area h2 {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 4px 0;
          background: linear-gradient(135deg, #00d2ff, var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .perfil-title-area p {
          color: var(--text-muted);
          margin: 0;
          font-size: 14px;
        }

        .btn-close-perfil {
          background: var(--bg-hover);
          border: none;
          color: var(--text-main);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
        }

        .btn-close-perfil:hover {
          background: #ef4444;
          color: white;
          transform: rotate(90deg);
        }

        .perfil-content-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 40px;
        }

        /* SIDEBAR */
        .avatar-section-card {
          background: var(--bg-hover);
          border-radius: 20px;
          padding: 30px;
          text-align: center;
          border: 1px solid var(--border);
        }

        .avatar-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto 20px;
        }

        .avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--accent);
          box-shadow: 0 8px 20px rgba(123, 47, 247, 0.3);
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          font-size: 48px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(123, 47, 247, 0.3);
        }

        .avatar-edit-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 36px;
          height: 36px;
          background: white;
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }

        .avatar-edit-btn:hover { transform: scale(1.1); }
        .avatar-edit-btn input { display: none; }

        .user-email-display {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          word-break: break-all;
        }

        .role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 24px;
        }

        .role-badge.admin { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .role-badge.revendedor { background: rgba(0, 210, 255, 0.1); color: #00d2ff; }
        .role-badge.cliente { background: rgba(123, 47, 247, 0.1); color: #7b2ff7; }

        .account-details-list {
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .detail-item .label { color: var(--text-muted); }
        .detail-item .value { font-weight: 600; }

        /* MAIN COLUMN */
        .forms-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .perfil-form-card {
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          padding: 24px;
          border: 1px solid var(--border);
        }

        .perfil-form-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 20px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .form-group { margin-bottom: 20px; flex: 1; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-muted); }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.6;
        }

        .perfil-form-card input {
          width: 100%;
          padding: 12px 16px;
          padding-left: 40px;
          border-radius: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-main);
          outline: none;
          transition: all 0.2s;
        }

        .perfil-form-card input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 10px rgba(123, 47, 247, 0.1);
        }

        .perfil-form-card input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-row {
          display: flex;
          gap: 20px;
        }

        .field-hint {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          color: var(--text-muted);
        }

        .btn-save-profile, .btn-save-password {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          background: var(--accent);
          color: white;
          border: none;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-save-profile:hover, .btn-save-password:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(123, 47, 247, 0.3);
        }

        .btn-save-profile:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .alert-inline {
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          margin-bottom: 24px;
          text-align: center;
          font-weight: 600;
        }

        .alert-inline.success { background: rgba(0, 200, 83, 0.1); color: #00c853; border: 1px solid #00c853; }
        .alert-inline.error { background: rgba(255, 82, 82, 0.1); color: #ff5252; border: 1px solid #ff5252; }

        @media (max-width: 900px) {
          .perfil-content-grid { grid-template-columns: 1fr; }
          .perfil-sidebar { order: -1; }
          .form-row { flex-direction: column; gap: 0; }
        }
      `}} />
    </div>
  )
}
