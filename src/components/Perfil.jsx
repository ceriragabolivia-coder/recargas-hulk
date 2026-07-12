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
  
  const [misCodigosCreador, setMisCodigosCreador] = useState([])
  const [loadingCodigos, setLoadingCodigos] = useState(true)

  // Recompensas
  const [objetivos, setObjetivos] = useState([])
  const [recompensasCanjeadas, setRecompensasCanjeadas] = useState([])
  const [redeemingObjetivoId, setRedeemingObjetivoId] = useState(null)
  
  // Selección de premio múltiple
  const [showSelectPremioModal, setShowSelectPremioModal] = useState(false)
  const [objetivoToRedeem, setObjetivoToRedeem] = useState(null)
  const [codigoToRedeem, setCodigoToRedeem] = useState(null)
  
  // Custom Alert
  const [alertModal, setAlertModal] = useState(null)
  
  const [miCodigoUsado, setMiCodigoUsado] = useState(null)
  
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [selectedCodigoForUsers, setSelectedCodigoForUsers] = useState(null)
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(false)

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
      fetchMisCodigosCreador()
      fetchMiCodigoUsado()
    }
  }, [user?.id])
  
  const fetchMiCodigoUsado = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          creador_codigo_id,
          codigos_creadores(codigo)
        `)
        .eq('auth_user_id', user.id)
        .single()
        
      if (!error && data?.codigos_creadores) {
        setMiCodigoUsado(data.codigos_creadores.codigo)
      }
    } catch (err) {
      console.error(err)
    }
  }
  
  const openRegisteredUsers = async (codigoId) => {
    setSelectedCodigoForUsers(codigoId)
    setShowUsersModal(true)
    setLoadingRegisteredUsers(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombres, apellidos, nickname, usuario, fecha_registro, compras_con_codigo_creador')
        .eq('creador_codigo_id', codigoId)
        .order('fecha_registro', { ascending: false })
      
      if (error) throw error
      setRegisteredUsers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRegisteredUsers(false)
    }
  }

  const fetchMisCodigosCreador = async () => {
    setLoadingCodigos(true)
    try {
      const { data, error } = await supabase
        .from('codigos_creadores')
        .select('*')
        .eq('usuario_id', perfil?.id || user.id)
      
      if (error) throw error
      const codigos = data || []
      setMisCodigosCreador(codigos)
      
      if (codigos.length > 0) {
        fetchRecompensas(codigos.map(c => c.id))
      }
    } catch (err) {
      console.error('Error fetching codigos creador:', err)
    } finally {
      setLoadingCodigos(false)
    }
  }

  const fetchRecompensas = async (codigosIds) => {
    // 1. Fetch Objetivos (Globales e Individuales de mis códigos)
    let query = supabase.from('creador_objetivos').select(`
      *,
      p1:producto_1_id(id, nombre, juego_id, icono_url),
      p2:producto_2_id(id, nombre, juego_id, icono_url),
      p3:producto_3_id(id, nombre, juego_id, icono_url)
    `).order('meta_registros', { ascending: true })
    
    if (codigosIds && codigosIds.length > 0) {
      query = query.or(`codigo_id.is.null, codigo_id.in.(${codigosIds.join(',')})`)
    } else {
      query = query.is('codigo_id', null)
    }
    
    const { data: objData, error: objError } = await query
    
    let combinedObjectives = []
    if (objData) {
      // Obtener el progreso real (contando compras mínimas si aplica)
      const { data: progData } = await supabase.rpc('get_creador_objetivos_progreso', { p_codigos_ids: codigosIds })
      
      combinedObjectives = objData.map(obj => {
        const prog = progData?.find(p => p.objetivo_id === obj.id)
        return {
          ...obj,
          referidos_validos: prog ? parseInt(prog.referidos_validos) : 0
        }
      })
      setObjetivos(combinedObjectives)
    }
    
    // 2. Fetch Canjes realizados por mí
    const { data: canjData } = await supabase.from('creador_recompensas_canjeadas').select('*').eq('creador_auth_id', user.id)
    if (canjData) setRecompensasCanjeadas(canjData)
  }

  const iniciarCanje = (objetivo, codigo) => {
    const opciones = []
    if ((objetivo.recompensa_1_tipo === 'producto' && objetivo.p1) || (objetivo.recompensa_1_tipo !== 'producto' && objetivo.recompensa_1_valor > 0)) opciones.push({ id: 1, tipo: objetivo.recompensa_1_tipo, valor: objetivo.recompensa_1_valor, p: objetivo.p1 })
    if ((objetivo.recompensa_2_tipo === 'producto' && objetivo.p2) || (objetivo.recompensa_2_tipo !== 'producto' && objetivo.recompensa_2_valor > 0)) opciones.push({ id: 2, tipo: objetivo.recompensa_2_tipo, valor: objetivo.recompensa_2_valor, p: objetivo.p2 })
    if ((objetivo.recompensa_3_tipo === 'producto' && objetivo.p3) || (objetivo.recompensa_3_tipo !== 'producto' && objetivo.recompensa_3_valor > 0)) opciones.push({ id: 3, tipo: objetivo.recompensa_3_tipo, valor: objetivo.recompensa_3_valor, p: objetivo.p3 })

    if (opciones.length === 1) {
      procesarCanje(objetivo, codigo, opciones[0])
    } else {
      setObjetivoToRedeem({ ...objetivo, opcionesParsed: opciones })
      setCodigoToRedeem(codigo)
      setShowSelectPremioModal(true)
    }
  }

  const procesarCanje = async (objetivo, codigo, opcionElegida) => {
    if (!window.confirm('¿Seguro que deseas canjear este premio?')) return
    setRedeemingObjetivoId(objetivo.id)
    try {
      let pedidoId = null;
      let productoElegidoId = null;
      
      if (opcionElegida.tipo === 'producto') {
        productoElegidoId = opcionElegida.p.id
        // 1. Crear Pedido $0
        const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos').insert([{
          cliente_id: user.id,
          estado: 'procesando',
          total_usd: 0,
          total_bs: 0
        }]).select().single()
        
        if (pedidoError) throw pedidoError
        pedidoId = pedidoData.id
        
        await supabase.from('pedido_items').insert([{
          pedido_id: pedidoId,
          producto_id: productoElegidoId,
          juego_nombre: 'Premio Creador', // Fallback
          producto_nombre: opcionElegida.p.nombre,
          cantidad: 1,
          precio_usd: 0,
          precio_bs: 0
        }])
      } else {
        // Es saldo
        const moneda = opcionElegida.tipo === 'saldo_usd' ? 'usd' : 'bs'
        const { error: rpcError } = await supabase.rpc('recompensar_creador_billetera_rpc', {
          p_creador_auth_id: user.id,
          p_monto: opcionElegida.valor,
          p_moneda: moneda
        })
        if (rpcError) throw rpcError
      }

      // 3. Registrar el canje
      const { error: canjeError } = await supabase.from('creador_recompensas_canjeadas').insert([{
        objetivo_id: objetivo.id,
        codigo_id: codigo.id,
        producto_elegido_id: productoElegidoId,
        pedido_id: pedidoId,
        tipo_recompensa_canjeada: opcionElegida.tipo,
        valor_recompensa_canjeada: opcionElegida.valor || 0
      }])
      
      if (canjeError) throw canjeError
      
      if (opcionElegida.tipo === 'producto') {
         setAlertModal({ type: 'success', title: '¡Premio Canjeado!', message: `Se ha generado el pedido #${pedidoId} para procesar tu entrega.` })
      } else {
         setAlertModal({ type: 'success', title: '¡Premio Canjeado!', message: `Se han añadido ${opcionElegida.valor} ${opcionElegida.tipo === 'saldo_usd' ? 'USD' : 'Bs'} a tu billetera exitosamente.` })
      }
      
      // Refrescar recompensas
      fetchRecompensas(misCodigosCreador.map(c => c.id))
      setShowSelectPremioModal(false)
      
    } catch (err) {
      console.error(err)
      setAlertModal({ type: 'error', title: 'Error', message: 'Ocurrió un error al canjear el premio: ' + err.message })
    } finally {
      setRedeemingObjetivoId(null)
    }
  }

  const fetchMisCupones = async () => {
    setLoadingCupones(true)
    try {
      const { data: usrCupones, error } = await supabase
        .from('cupones_usuarios')
        .select('usos, cupon_id')
        .eq('usuario_id', perfil?.id || user.id)

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
          {miCodigoUsado && (
            <div><strong>Código de creador asociado:</strong> <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{miCodigoUsado}</span></div>
          )}
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
      {/* Mis Códigos de Creador */}
      <div id="mis-codigos-creador" className="card mt-24" style={{ scrollMarginTop: '80px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🌟</span> Mis Códigos de Creador
        </h3>
        {loadingCodigos ? (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Cargando códigos...</div>
        ) : misCodigosCreador.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'rgba(255, 215, 0, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🌟</span>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>No tienes códigos de creador vinculados a tu cuenta.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {misCodigosCreador.map((c, i) => (
              <div key={i} style={{ padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,165,0,0.05) 100%)', border: '1px solid rgba(255,215,0,0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, fontSize: '22px', color: '#FFD700', letterSpacing: '1px' }}>{c.codigo}</span>
                  <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent-success)' }}>-{c.porcentaje_descuento}%</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Usos Totales</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.usos_totales}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registrados</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFD700' }}>{c.usuarios_registrados}</div>
                  </div>
                </div>
                
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                  Estado: <span style={{ color: c.activo ? '#38ef7d' : '#ef4444', fontWeight: 'bold' }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                </div>

                {/* Objetivos del Creador */}
                {objetivos.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '14px', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>🏆 Metas y Premios</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {objetivos.filter(obj => obj.codigo_id === null || obj.codigo_id === c.id).map(obj => {
                        const canjeado = recompensasCanjeadas.find(rc => rc.objetivo_id === obj.id && rc.codigo_id === c.id)
                        const referidosValidos = obj.referidos_validos !== undefined ? obj.referidos_validos : c.usuarios_registrados
                        const progreso = Math.min((referidosValidos / obj.meta_registros) * 100, 100)
                        const alcanzado = referidosValidos >= obj.meta_registros
                        
                        return (
                          <div key={obj.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>Meta: {obj.meta_registros} referidos</span>
                                {obj.compras_minimas_usuario > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mín. compras: {obj.compras_minimas_usuario}</span>}
                              </div>
                              {canjeado ? (
                                <span style={{ fontSize: '11px', background: 'rgba(56, 239, 125, 0.1)', color: '#38ef7d', padding: '2px 8px', borderRadius: '8px', fontWeight: 'bold' }}>✓ RECLAMADO</span>
                              ) : alcanzado ? (
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => iniciarCanje(obj, c)}
                                  disabled={redeemingObjetivoId === obj.id}
                                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', border: 'none', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                  {redeemingObjetivoId === obj.id ? '...' : '🎁 CANJEAR'}
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{referidosValidos} / {obj.meta_registros}</span>
                              )}
                            </div>
                            
                            {/* Barra de progreso */}
                            {!canjeado && (
                              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                <div style={{ height: '100%', width: `${progreso}%`, background: alcanzado ? '#38ef7d' : '#FFD700', transition: 'width 0.5s ease' }}></div>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {obj.recompensa_1_tipo === 'producto' && obj.p1 && <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>🎁 {obj.p1.nombre}</div>}
                              {obj.recompensa_1_tipo === 'saldo_usd' && <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>🎁 ${obj.recompensa_1_valor} USD</div>}
                              {obj.recompensa_1_tipo === 'saldo_bs' && <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>🎁 {obj.recompensa_1_valor} Bs</div>}
                              
                              {((obj.recompensa_2_tipo === 'producto' && obj.p2) || (obj.recompensa_2_tipo !== 'producto' && obj.recompensa_2_valor > 0)) && (
                                <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>
                                  {obj.recompensa_2_tipo === 'producto' ? `🎁 ${obj.p2?.nombre}` : obj.recompensa_2_tipo === 'saldo_usd' ? `🎁 $${obj.recompensa_2_valor} USD` : `🎁 ${obj.recompensa_2_valor} Bs`}
                                </div>
                              )}
                              
                              {((obj.recompensa_3_tipo === 'producto' && obj.p3) || (obj.recompensa_3_tipo !== 'producto' && obj.recompensa_3_valor > 0)) && (
                                <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>
                                  {obj.recompensa_3_tipo === 'producto' ? `🎁 ${obj.p3?.nombre}` : obj.recompensa_3_tipo === 'saldo_usd' ? `🎁 $${obj.recompensa_3_valor} USD` : `🎁 ${obj.recompensa_3_valor} Bs`}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Seleccionar Premio Múltiple */}
      {showSelectPremioModal && objetivoToRedeem && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1200 }} onClick={() => setShowSelectPremioModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '500px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textAlign: 'center' }}>🎉 ¡Felicidades! 🎉</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', textAlign: 'center', fontSize: '15px' }}>
              Has alcanzado tu meta de {objetivoToRedeem.meta_registros} referidos. 
              Selecciona cuál de las siguientes recompensas deseas recibir:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {objetivoToRedeem.opcionesParsed?.map((opc, i) => (
                <button 
                  key={i}
                  className="btn"
                  onClick={() => procesarCanje(objetivoToRedeem, codigoToRedeem, opc)}
                  style={{ 
                    padding: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'; e.currentTarget.style.borderColor = '#a855f7' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  <div style={{ fontSize: '24px' }}>🎁</div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>
                    {opc.tipo === 'producto' ? opc.p.nombre : opc.tipo === 'saldo_usd' ? `$${opc.valor} USD` : `${opc.valor} Bs`}
                  </div>
                </button>
              ))}
            </div>
            
            <button className="btn btn-ghost" onClick={() => setShowSelectPremioModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal Usuarios Registrados */}
      {showUsersModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 1200 }} onClick={() => setShowUsersModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
            maxWidth: '500px', width: '95%', padding: '30px', borderRadius: '24px', 
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>👥 Usuarios Registrados</h3>
              <button className="btn-close" onClick={() => setShowUsersModal(false)} style={{ fontSize: '24px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingRegisteredUsers ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Cargando usuarios...</div>
              ) : registeredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Aún no hay usuarios registrados con este código.</div>
              ) : (
                registeredUsers.map(u => (
                  <div key={u.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>{u.nombres} {u.apellidos} {u.nickname ? `(${u.nickname})` : ''}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.usuario}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Registrado: {new Date(u.fecha_registro).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compras</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-success)' }}>{u.compras_con_codigo_creador}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Re-uso del modal de alerta, pero no teníamos AlertModal importado. */}
      {alertModal && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 9999 }}>
          <div className="modal-content" style={{ padding: '30px', maxWidth: '400px', textAlign: 'center', borderRadius: '24px', background: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '12px', color: alertModal.type === 'error' ? '#ef4444' : '#38ef7d' }}>
              {alertModal.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px', lineHeight: 1.5 }}>
              {alertModal.message}
            </p>
            <button className="btn btn-primary" onClick={() => setAlertModal(null)} style={{ width: '100%' }}>Aceptar</button>
          </div>
        </div>
      )}

    </div>
  )
}
