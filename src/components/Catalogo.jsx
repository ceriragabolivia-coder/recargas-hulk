import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfiguracion, useTodosLosProductos, useCart, useAuth, useCuentasGuardadas } from '../hooks/useData'
import { calcularPrecioVenta, formatBs, formatUSD, getOptimizedImageUrl } from '../utils/helpers'
import TutorialVideoModal from './TutorialVideoModal'

export default function Catalogo() {
  const { productos, loading } = useTodosLosProductos()
  const { config, loading: loadingConfig } = useConfiguracion()
  const { addToCart, clearCart } = useCart()
  const { perfil, isCliente } = useAuth()
  const navigate = useNavigate()
  
  const [selectedJuegoId, setSelectedJuegoId] = useState(() => localStorage.getItem('selectedJuegoId'))
  
  // Escuchar el evento de reset desde el sidebar
  useEffect(() => {
    const handleReset = () => {
      setSelectedJuegoId(null);
      localStorage.removeItem('selectedJuegoId');
    };
    window.addEventListener('reset-catalogo', handleReset);
    return () => window.removeEventListener('reset-catalogo', handleReset);
  }, []);

  const juegosData = useMemo(() => {
    const map = {}
    productos.forEach(p => {
      const jData = Array.isArray(p.juegos) ? p.juegos[0] : p.juegos
      if (!jData || jData.activo === false) return

      if (!map[jData.id]) {
        map[jData.id] = { ...jData, productos: [] }
      }
      map[jData.id].productos.push(p)
    })
    
    const arr = Object.values(map)
    arr.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    
    arr.forEach(j => {
      j.productos.sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.costo_base || 0) - (b.costo_base || 0))
    })
    return arr
  }, [productos])

  const selectedJuego = useMemo(() => 
    selectedJuegoId ? juegosData.find(j => String(j.id) === String(selectedJuegoId)) : null
  , [juegosData, selectedJuegoId])

  const handleSetSelectedJuego = (juego) => {
    const id = juego?.id || null
    setSelectedJuegoId(id)
    setActiveProductType('recarga') // Reset tab
    if (id) localStorage.setItem('selectedJuegoId', id)
    else localStorage.removeItem('selectedJuegoId')
  }
  const [addedItem, setAddedItem] = useState(null) 
  const [buyMode, setBuyMode] = useState('single') // 'single' o 'multiple'

  const [activeProductType, setActiveProductType] = useState('recarga')

  const [localRechargeData, setLocalRechargeData] = useState({
    player_id: '',
    zone_id: '',
    account_email: '',
    account_password: '',
    account_user: ''
  })
  
  const hasRecargas = useMemo(() => {
    if (!selectedJuego || !selectedJuego.productos) return false
    return selectedJuego.productos.some(p => p.tipo_producto !== 'gift_card')
  }, [selectedJuego])

  const hasGiftCards = useMemo(() => {
    if (!selectedJuego || !selectedJuego.productos) return false
    return selectedJuego.productos.some(p => p.tipo_producto === 'gift_card')
  }, [selectedJuego])

  const showTabs = hasRecargas && hasGiftCards
  const isGiftCardView = showTabs ? activeProductType === 'gift_card' : (!hasRecargas && hasGiftCards)
  const effectiveMetodoRecarga = isGiftCardView ? 'entrega_codigo' : (selectedJuego?.metodo_recarga || 'sin_datos')

  const { cuentas, guardarCuenta, eliminarCuenta } = useCuentasGuardadas(selectedJuegoId)
  const [shouldSaveData, setShouldSaveData] = useState(false)

  const resetRechargeForm = () => {
    setLocalRechargeData({
      player_id: '',
      zone_id: '',
      account_email: '',
      account_password: '',
      account_user: ''
    })
    setVerificacionResultado(null)
    setShouldSaveData(false)
  }

  const handleSelectCuenta = (cuenta) => {
    setLocalRechargeData({
      player_id: cuenta.player_id || '',
      zone_id: cuenta.zone_id || '',
      account_email: cuenta.email || '',
      account_password: cuenta.password || '',
      account_user: cuenta.username || ''
    })
    if (cuenta.player_id !== localRechargeData.player_id) {
      setVerificacionResultado(null)
    }
  }
  
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [pendingItem, setPendingItem] = useState(null)
  const [infoProductModal, setInfoProductModal] = useState(null)
  const [expandedImage, setExpandedImage] = useState(null)
  const [isVerificando, setIsVerificando] = useState(false)
  const [verificacionResultado, setVerificacionResultado] = useState(null)
  const [showTutorialModal, setShowTutorialModal] = useState(false)

  const handleVerificarJugador = async () => {
    if (!localRechargeData.player_id.trim()) {
      alert('Por favor introduce primero el ID del jugador.')
      return
    }

    setIsVerificando(true)
    setVerificacionResultado(null)

    const juegoNombreNormalizado = selectedJuego.nombre.toLowerCase().replace(/\s/g, '')
    
    try {
      let url = ''
      if (juegoNombreNormalizado.includes('freefire')) {
        url = `https://tiendagiftven.net/conexion_api/api.php?action=ValidarParametros&id=${localRechargeData.player_id}`
      } else if (juegoNombreNormalizado.includes('bloodstrike')) {
        url = `/proxy/bloodstrike?roleid=${localRechargeData.player_id}&client_type=gameclub`
      }

      const response = await fetch(url)
      const data = await response.json()
      
      if (juegoNombreNormalizado.includes('freefire')) {
        if (data.alerta === 'green') {
          setVerificacionResultado({
            success: true,
            nickname: data.nickname,
            verified_id: localRechargeData.player_id,
            mensaje: data.mensaje
          })
        } else {
          setVerificacionResultado({
            success: false,
            mensaje: data.mensaje || 'Jugador no encontrado'
          })
        }
      } else if (juegoNombreNormalizado.includes('bloodstrike')) {
        // Formato Netease real: { code: "0000", msg: null, data: { rolename: "..." } }
        if (data.code === "0000" || data.msg === 'success') {
          setVerificacionResultado({
            success: true,
            nickname: data.data?.rolename || 'Jugador Encontrado',
            verified_id: localRechargeData.player_id,
            mensaje: 'ID Verificado exitosamente'
          })
        } else {
          setVerificacionResultado({
            success: false,
            mensaje: data.msg || 'ID de BloodStrike no válido o no encontrado'
          })
        }
      }
    } catch (error) {
      console.error('Error verificando jugador:', error)
      setVerificacionResultado({
        success: false,
        mensaje: 'Error al conectar con la API de verificación'
      })
    } finally {
      setIsVerificando(false)
    }
  }

  const confirmAddToCart = async () => {
    if (!pendingItem) return
    const { p, selectedJuego, finalPrice, localRechargeData } = pendingItem
    
    if (buyMode === 'single') {
      clearCart() // Opción B: Limpiar carrito antes de compra directa
      addToCart(p, selectedJuego, finalPrice, localRechargeData)

      if (shouldSaveData) {
        console.log('💾 Guardando cuenta en base de datos...')
        await guardarCuenta({
          tipo_dato: selectedJuego.metodo_recarga || 'id',
          player_id: localRechargeData.player_id,
          zone_id: localRechargeData.zone_id,
          email: localRechargeData.account_email,
          password: localRechargeData.account_password,
          username: localRechargeData.account_user,
          nombre_perfil: localRechargeData.player_id || localRechargeData.account_email || localRechargeData.account_user || 'Cuenta'
        })
      }

      setPendingItem(null)
      navigate('/Checkout')
    } else {
      addToCart(p, selectedJuego, finalPrice, localRechargeData)
      
      if (shouldSaveData) {
        console.log('💾 Guardando cuenta en base de datos...')
        await guardarCuenta({
          tipo_dato: selectedJuego.metodo_recarga || 'id',
          player_id: localRechargeData.player_id,
          zone_id: localRechargeData.zone_id,
          email: localRechargeData.account_email,
          password: localRechargeData.account_password,
          username: localRechargeData.account_user,
          nombre_perfil: localRechargeData.player_id || localRechargeData.account_email || localRechargeData.account_user || 'Cuenta'
        })
      }

      setAddedItem(p.id)
      setTimeout(() => setAddedItem(null), 1000)
      setPendingItem(null)
    }
    resetRechargeForm()
  }
  

  if (loading || loadingConfig) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando Catálogo de Juegos...</p>
      </div>
    )
  }

  if (selectedJuego) {
    return (
    <div className="catalogo-container">
      <style>{`
        @media (max-width: 768px) {
          .game-detail-flex { flex-direction: column !important; }
          .game-info-col { max-width: 100% !important; flex: 1 1 100% !important; }
          .game-recharge-col { flex: 1 1 100% !important; }
          .catalogo-container { padding: 8px !important; }
          .card-recharge-info { padding: 12px !important; }
          .product-grid-mobile { 
            grid-template-columns: repeat(2, 1fr) !important; 
            gap: 10px !important;
            content-visibility: auto;
            contain-intrinsic-size: 1px 1000px;
          }
        }
      `}</style>
      {/* MODAL DE CONFIRMACIÓN */}
      {pendingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{
            backgroundColor: 'var(--bg-panel)', padding: '40px',
            borderRadius: '16px', width: '90%', maxWidth: '480px',
            textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
            animation: 'bounceIn 0.3s', border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: 'rgba(255, 171, 0, 0.15)',
              border: '2px solid #ffab00', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 24px',
              fontSize: '36px', color: '#ffab00', fontWeight: 'bold'
            }}>!</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
              ¿Está seguro de registrar los siguientes datos?
            </h2>
            
            <div style={{ 
              backgroundColor: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', 
              marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left',
              boxShadow: 'inset 0 4px 24px rgba(0,0,0,0.6)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Paquete:</span> 
                <span style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent-success)', fontWeight: 800, fontSize: '16px' }}>{pendingItem.p.nombre}</div>
                  <div translate="no" className="notranslate" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>{formatBs(pendingItem.finalPrice.venta_bs)}</span>
                  </div>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Cuenta a Recargar:</span> 
                <span style={{ color: '#ffffff', textAlign: 'right', fontWeight: 800, fontSize: '18px', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,210,255,0.4)' }}>
                  {(() => {
                    const pendingEffectiveMetodo = (pendingItem.p.tipo_producto === 'gift_card') ? 'entrega_codigo' : (pendingItem.selectedJuego.metodo_recarga || 'sin_datos');
                    return pendingEffectiveMetodo === 'solo_correo' 
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Correo:</span><br/>{pendingItem.localRechargeData.account_email}</>
                      : pendingEffectiveMetodo === 'solo_usuario' 
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Usuario:</span><br/>{pendingItem.localRechargeData.account_user}</>
                      : pendingEffectiveMetodo === 'cuenta_completa' 
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Correo:</span><br/>{pendingItem.localRechargeData.account_email}<br/><div style={{height:8}}></div><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Clave:</span><br/>{pendingItem.localRechargeData.account_password}</>
                      : pendingEffectiveMetodo === 'usuario_clave'
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Usuario:</span><br/>{pendingItem.localRechargeData.account_user}<br/><div style={{height:8}}></div><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Clave:</span><br/>{pendingItem.localRechargeData.account_password}</>
                      : pendingEffectiveMetodo === 'id_zone'
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>ID:</span> {pendingItem.localRechargeData.player_id}<br/><div style={{height:4}}></div><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>ZONE ID:</span> {pendingItem.localRechargeData.zone_id}</>
                      : pendingEffectiveMetodo === 'entrega_codigo'
                      ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Entrega:</span><br/>Código de Canje (Vía Baúl/Manual)</>
                      : <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>ID/UID:</span><br/>{pendingItem.localRechargeData.player_id}</>
                  })()}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 171, 0, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 171, 0, 0.2)', marginBottom: '32px' }}>
              <p style={{ fontSize: '14px', color: '#ffab00', lineHeight: '1.5', fontWeight: 600, margin: 0 }}>
                ⚠️ Al presionar "¡Sí, Confirmar!" certificas que tu información es correcta.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <button 
                className="btn btn-primary"
                style={{ padding: '12px 32px', flex: 1, fontSize: '16px' }}
                onClick={confirmAddToCart}
              >¡Sí, Confirmar!</button>
              <button 
                className="btn btn-ghost"
                style={{ padding: '12px 32px', flex: 1, fontSize: '16px', color: 'var(--text-muted)' }}
                onClick={() => setPendingItem(null)}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GUÍA (CAPTURA DE PANTALLA) */}
      {showGuideModal && selectedJuego.guia_id_url && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s'
          }}
          onClick={() => setShowGuideModal(false)}
        >
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button 
              style={{
                position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none',
                color: '#fff', fontSize: '32px', cursor: 'pointer'
              }}
              onClick={() => setShowGuideModal(false)}
            >✕</button>
            <img 
              src={selectedJuego.guia_id_url} 
              alt="Guía de ID" 
              style={{ 
                maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', 
                boxShadow: '0 0 40px rgba(0, 210, 255, 0.3)',
                border: '2px solid var(--accent-primary)'
              }} 
              onClick={e => e.stopPropagation()}
            />
            <div style={{ marginTop: '20px', color: '#fff', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>Guía informativa: {selectedJuego.nombre}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Haz clic fuera de la imagen para cerrar</p>
            </div>
          </div>
        </div>
      )}

      <div className="game-detail-flex" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA (Info y Características) */}
        <div className="game-info-col" style={{ flex: '1 1 280px', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          <button className="btn btn-ghost" onClick={() => handleSetSelectedJuego(null)} style={{ alignSelf: 'flex-start', padding: '4px 10px', backgroundColor: 'var(--bg-panel)', fontSize: '12px' }}>
            ← Volver al Catálogo
          </button>
          
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 12px', gap: '0px' }}>
            {selectedJuego.icono_url ? (
              <img src={getOptimizedImageUrl(selectedJuego.icono_url, 300)} alt={selectedJuego.nombre} style={{ width: 110, height: 110, minWidth: 110, minHeight: 110, flexShrink: 0, objectFit: 'cover', borderRadius: '16px', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))', backgroundColor: 'rgba(255,255,255,0.02)' }} />
            ) : (
              <div style={{ fontSize: '80px' }}>🎮</div>
            )}
            <div style={{ marginTop: '0px' }}>
              <h1 translate="no" className="notranslate" style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)', lineHeight: 1.2 }}>{selectedJuego.nombre}</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lista de Precios Oficial</p>
            </div>
          </div>

          <div className="card" style={{ padding: '8px 12px' }}>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '1px', fontWeight: 700 }}> Características</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '3px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tipo:</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_tipo || 'Recarga'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '3px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Región:</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_region || 'Global'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '3px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Entrega:</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_entrega || 'Inmediata'}</span>
              </div>
            </div>

            {selectedJuego.caracteristicas_nota && (
              <div style={{ marginTop: '4px', padding: '6px 10px', backgroundColor: 'rgba(255, 171, 0, 0.08)', borderRadius: '6px', borderLeft: '2px solid var(--accent-warning)' }}>
                <p style={{ fontSize: '11px', color: 'var(--accent-warning)', lineHeight: '1.3', margin: 0 }}>
                  <strong style={{ fontSize: '10px' }}>Nota:</strong> {selectedJuego.caracteristicas_nota}
                </p>
              </div>
            )}

          </div>

          {selectedJuego.tutorial_video_url && (
            <div 
              className="tutorial-banner-card"
              onClick={() => setShowTutorialModal(true)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: '16px',
                overflow: 'hidden',
                marginTop: '4px',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                background: 'var(--bg-panel)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,210,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)' }}
            >
              {selectedJuego.tutorial_banner_img ? (
                <img src={getOptimizedImageUrl(selectedJuego.tutorial_banner_img, 600)} alt="Tutorial" style={{ width: '100%', display: 'block' }} />
              ) : (
                <div style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(0, 115, 230, 0.1) 100%)' }}>
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(0, 210, 255, 0.2)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0,
                    boxShadow: '0 0 15px rgba(0, 210, 255, 0.3)'
                  }}>
                    🔔
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedJuego.tutorial_banner_texto || `¿Aún no sabes recargar ${selectedJuego.nombre}?`}
                    </h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      Aquí tienes un video guía <span style={{ textDecoration: 'underline' }}>Click aquí</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {config?.tutorial_banner_texto && config?.tutorial_banner_link && (
            <a 
              href={config.tutorial_banner_link} 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                backgroundColor: 'rgba(0, 210, 255, 0.1)', borderRadius: '12px',
                border: '1px solid rgba(0, 210, 255, 0.2)', textDecoration: 'none',
                transition: 'all 0.2s ease', cursor: 'pointer'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: '20px' }}>🔔</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{config.tutorial_banner_texto}</div>
                <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginTop: '2px' }}>Ver Tutorial →</div>
              </div>
            </a>
          )}

          {config?.promo_banner_texto && (
            <a 
              href={config.promo_banner_link || '#'} 
              target={config.promo_banner_link ? "_blank" : "_self"}
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
                background: 'linear-gradient(135deg, rgba(255, 171, 0, 0.15) 0%, rgba(255, 86, 48, 0.15) 100%)', 
                borderRadius: '12px', border: '1px solid rgba(255, 171, 0, 0.3)', textDecoration: 'none',
                marginTop: '4px'
              }}
            >
              {config.promo_banner_icono_url ? (
                <img src={getOptimizedImageUrl(config.promo_banner_icono_url, 100)} alt="Promo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              ) : (
                 <div style={{ fontSize: '20px' }}>🎁</div>
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#ffab00', marginBottom: '0px' }}>¡Oferta Especial!</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.2', margin: 0 }}>{config.promo_banner_texto}</p>
              </div>
            </a>
          )}

        </div>
        
        {/* COLUMNA DERECHA (Formulario de Recarga y Productos) */}
        <div className="game-recharge-col" style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          

          <div className="card card-recharge-info" style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-primary)', padding: '10px' }}>
            {effectiveMetodoRecarga === 'sin_datos' ? (
              <div style={{ textAlign: 'center', padding: '10px' }}>
                <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
                  ⚡ Este servicio tiene entrega inmediata. 
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  No necesitas ingresar ningún dato. Recibirás tu código automáticamente después del pago.
                </p>
              </div>
            ) : effectiveMetodoRecarga === 'entrega_codigo' ? (
              <div style={{ textAlign: 'center', padding: '10px' }}>
                <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
                  🎁 Entrega de Código
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Recibirás tu código de canje en tu panel de pedidos. No requieres ingresar datos de cuenta.
                </p>
              </div>
            ) : effectiveMetodoRecarga === 'solo_correo' ? (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📧 Correo Electrónico
                  </label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="ejemplo@correo.com"
                    value={localRechargeData.account_email}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
              </div>
            ) : effectiveMetodoRecarga === 'solo_usuario' ? (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 Usuario (@)
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="@Usuario"
                    value={localRechargeData.account_user || ''}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
              </div>
            ) : effectiveMetodoRecarga === 'cuenta_completa' ? (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedJuego.nombre.toLowerCase().includes('cod') ? '📧 Correo de Activision' : '📧 Correo de la cuenta para recargar'}
                    {selectedJuego.guia_id_url && (
                      <span 
                        onClick={() => setShowGuideModal(true)}
                        style={{ 
                          cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: '#000', 
                          width: '18px', height: '18px', borderRadius: '50%', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' 
                        }}
                        title="Ver dónde obtener esta información"
                      >?</span>
                    )}
                  </label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="ejemplo@correo.com"
                    value={localRechargeData.account_email}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_email: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>
                    {selectedJuego.nombre.toLowerCase().includes('cod') ? '🔑 Clave de Activision' : '🔑 Clave de acceso'}
                  </label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="********"
                    value={localRechargeData.account_password}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
              </div>
            ) : effectiveMetodoRecarga === 'usuario_clave' ? (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 Nombre de usuario
                    {selectedJuego.guia_id_url && (
                      <span 
                        onClick={() => setShowGuideModal(true)}
                        style={{ 
                          cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: '#000', 
                          width: '18px', height: '18px', borderRadius: '50%', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' 
                        }}
                        title="Ver dónde obtener esta información"
                      >?</span>
                    )}
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Tu nombre de usuario en el juego"
                    value={localRechargeData.account_user || ''}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_user: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>
                    🔑 Contraseña
                  </label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="********"
                    value={localRechargeData.account_password}
                    onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                    style={{ backgroundColor: 'var(--bg-card)', padding: '16px', fontSize: '15px' }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🆔 Introduce el ID del jugador aquí
                  {selectedJuego.guia_id_url && (
                    <button 
                      onClick={() => setShowGuideModal(true)}
                      style={{ 
                        cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: '#000', 
                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold',
                        border: 'none', outline: 'none', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      title="¿Cómo obtener mi ID?"
                    >?</button>
                  )}
                </label>
                <input 
                  type="text" 
                  className="form-input recharge-input" 
                  placeholder="ID del Jugador"
                  value={localRechargeData.player_id}
                  onChange={e => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 30);
                    setLocalRechargeData({...localRechargeData, player_id: numericValue});
                    if (verificacionResultado) setVerificacionResultado(null);
                  }}
                  style={{ backgroundColor: 'var(--bg-card)', padding: '20px', fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}
                />
                
                {effectiveMetodoRecarga === 'id_zone' && (
                  <div style={{ marginTop: '16px' }}>
                    <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '16px' }}>
                      🆔 Zone ID
                    </label>
                    <input 
                      type="text" 
                      className="form-input recharge-input" 
                      placeholder="Zone ID (Máx 4 dígitos)"
                      maxLength={4}
                      value={localRechargeData.zone_id}
                      onChange={e => {
                        const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                        setLocalRechargeData({...localRechargeData, zone_id: numericValue});
                      }}
                      style={{ backgroundColor: 'var(--bg-card)', padding: '20px', fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}
                    />
                  </div>
                )}

                {(selectedJuego.verificacion_api_activa || (selectedJuego.verificacion_api_activa === undefined && (selectedJuego.nombre.toLowerCase().includes('free fire') || selectedJuego.nombre.toLowerCase().includes('blood strike')))) && (
                  <div style={{ marginTop: '12px' }}>
                    <button 
                      className="btn"
                      onClick={handleVerificarJugador}
                      disabled={isVerificando}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        cursor: isVerificando ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isVerificando ? (
                        <>
                          <div className="spinner-small" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          <span>Verificando...</span>
                        </>
                      ) : (
                        <>
                          <span>👤 Verificar nombre del jugador</span>
                        </>
                      )}
                    </button>

                    {verificacionResultado && (
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '12px 16px', 
                        borderRadius: '12px', 
                        backgroundColor: verificacionResultado.success ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                        border: `1px solid ${verificacionResultado.success ? '#00c853' : '#ff5252'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        animation: 'fadeIn 0.3s'
                      }}>
                        <div style={{ 
                          fontSize: '18px', 
                          color: verificacionResultado.success ? '#00c853' : '#ff5252' 
                        }}>
                          {verificacionResultado.success ? '✅' : '❌'}
                        </div>
                        <div>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '14px', 
                            fontWeight: 700, 
                            color: verificacionResultado.success ? '#00c853' : '#ff5252' 
                          }}>
                            {verificacionResultado.success ? `Jugador encontrado: ${verificacionResultado.nickname}` : verificacionResultado.mensaje}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Asegúrese de escribir su ID correctamente. Los paquetes que seleccione a continuación se asignarán a este perfil.
                </p>
              </div>
            {!(effectiveMetodoRecarga === 'sin_datos' || effectiveMetodoRecarga === 'entrega_codigo') && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: 'rgba(0, 210, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
                <input 
                  type="checkbox" 
                  id="save-data-checkbox"
                  checked={shouldSaveData}
                  onChange={(e) => setShouldSaveData(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="save-data-checkbox" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                  Guardar estos datos para futuras compras
                </label>
              </div>
            )}
          </>
        )}

            {/* SECCIÓN DE CUENTAS GUARDADAS */}
            {cuentas.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>
                  📁 Tus Cuentas Guardadas
                </label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                  {cuentas.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => handleSelectCuenta(c)}
                      style={{ 
                        padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', 
                        border: '1px solid var(--border-color)', cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', transition: 'all 0.2s',
                        color: 'var(--text-primary)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
                    >
                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {c.player_id || c.email || c.username || c.nombre_perfil || 'Cuenta'}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(window.confirm('¿Eliminar esta cuenta guardada?')) eliminarCuenta(c.id); }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px', padding: '0 4px', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ff5252'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}



          </div>

          <div>
            <div style={{ 
              display: 'flex', 
              backgroundColor: 'rgba(255,255,255,0.03)', 
              borderRadius: '16px', 
              padding: '6px',
              border: '1px solid var(--border-color)',
              marginBottom: '20px',
              gap: '6px'
            }}>
              <button 
                onClick={() => setBuyMode('single')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: buyMode === 'single' ? 'var(--accent-primary)' : 'transparent',
                  color: buyMode === 'single' ? '#000' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: buyMode === 'single' ? '0 4px 15px rgba(0, 210, 255, 0.4)' : 'none'
                }}
              >
                <span style={{ fontSize: '18px' }}>🛍️</span> Comprar un paquete
              </button>
              <button 
                onClick={() => setBuyMode('multiple')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: buyMode === 'multiple' ? 'var(--accent-primary)' : 'transparent',
                  color: buyMode === 'multiple' ? '#000' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: buyMode === 'multiple' ? '0 4px 15px rgba(0, 210, 255, 0.4)' : 'none'
                }}
              >
                <span style={{ fontSize: '18px' }}>🛒</span> Comprar varios paquetes
              </button>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Selecciona un paquete</h2>
            
            {(() => {
              const hasRecargas = selectedJuego.productos.some(p => p.tipo_producto !== 'gift_card')
              const hasGiftCards = selectedJuego.productos.some(p => p.tipo_producto === 'gift_card')
              const showTabs = hasRecargas && hasGiftCards
              
              // DEBUG INFO FOR CERIRAGA
              const debugStr = `Total: ${selectedJuego.productos.length} | Recargas: ${hasRecargas} | GiftCards: ${hasGiftCards} | showTabs: ${showTabs}`
              
              const filteredProducts = showTabs 
                ? selectedJuego.productos.filter(p => activeProductType === 'gift_card' ? p.tipo_producto === 'gift_card' : p.tipo_producto !== 'gift_card')
                : selectedJuego.productos

              return (
                <>
                  <div style={{ fontSize: '10px', color: 'red', marginBottom: '8px' }}>{debugStr}</div>
                  {showTabs && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button 
                        onClick={() => { setActiveProductType('recarga'); setPendingItem(null); }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                          backgroundColor: activeProductType === 'recarga' ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
                          color: activeProductType === 'recarga' ? 'var(--accent-primary)' : 'var(--text-muted)',
                          border: activeProductType === 'recarga' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {selectedJuego?.metodo_recarga === 'cuenta_completa' || selectedJuego?.metodo_recarga === 'usuario_clave' ? 'Recarga Interna' : selectedJuego?.metodo_recarga === 'solo_usuario' ? 'Recarga por Usuario' : selectedJuego?.metodo_recarga === 'solo_correo' ? 'Recarga por Correo' : 'Recarga por ID'}
                      </button>
                      <button 
                        onClick={() => { setActiveProductType('gift_card'); setPendingItem(null); }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                          backgroundColor: activeProductType === 'gift_card' ? 'rgba(255, 171, 0, 0.15)' : 'transparent',
                          color: activeProductType === 'gift_card' ? 'var(--accent-warning)' : 'var(--text-muted)',
                          border: activeProductType === 'gift_card' ? '1px solid var(--accent-warning)' : '1px solid var(--border-color)',
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Gift Cards
                      </button>
                    </div>
                  )}

                  {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '48px', opacity: 0.5 }}>📦</span>
                      <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>No hay productos disponibles en esta categoría.</p>
                    </div>
                  ) : (
                    <div className="product-grid-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                      {filteredProducts.map(p => {
                        const finalPrice = calcularPrecioVenta(p, selectedJuego, config, perfil)
                        return (
                    <div 
                      key={p.id}
                      className="product-card-premium"
                      onClick={() => {
                        const prodEffectiveMetodo = (p.tipo_producto === 'gift_card') ? 'entrega_codigo' : effectiveMetodoRecarga;

                        if (prodEffectiveMetodo === 'sin_datos') {
                          // No validation needed
                        } else if (prodEffectiveMetodo === 'solo_correo') {
                          if (!localRechargeData.account_email.trim()) {
                            alert('Por favor introduce el correo electrónico primero.')
                            return
                          }
                        } else if (prodEffectiveMetodo === 'solo_usuario') {
                          if (!localRechargeData.account_user?.trim()) {
                            alert('Por favor introduce el usuario primero.')
                            return
                          }
                        } else if (prodEffectiveMetodo === 'cuenta_completa') {
                          if (!localRechargeData.account_email.trim() || !localRechargeData.account_password.trim()) {
                            alert('Por favor introduce el correo y clave primero.')
                            return
                          }
                        } else if (prodEffectiveMetodo === 'usuario_clave') {
                          if (!localRechargeData.account_user?.trim() || !localRechargeData.account_password.trim()) {
                            alert('Por favor introduce el usuario y clave primero.')
                            return
                          }
                        } else if (prodEffectiveMetodo === 'entrega_codigo') {
                          // No validation needed
                        } else {
                          if (!localRechargeData.player_id.trim()) {
                            alert('Por favor introduce el ID del jugador primero.')
                            return
                          }
                          
                          const isVerificationActive = selectedJuego.verificacion_api_activa || 
                            (selectedJuego.verificacion_api_activa === undefined && (selectedJuego.nombre.toLowerCase().includes('free fire') || selectedJuego.nombre.toLowerCase().includes('blood strike')));

                          if (isVerificationActive) {
                            if (!verificacionResultado?.success || verificacionResultado.verified_id !== localRechargeData.player_id) {
                              alert('Debes verificar el nombre del jugador antes de seleccionar un paquete.')
                              return
                            }
                          }
                        }
                        
                        setPendingItem({ 
                          p, 
                          selectedJuego, 
                          finalPrice, 
                          localRechargeData: {
                            ...localRechargeData,
                            nickname: (verificacionResultado?.success && verificacionResultado.verified_id === localRechargeData.player_id) 
                                      ? verificacionResultado.nickname : null
                          } 
                        })
                      }}
                    >
                      {p.icono_url ? (
                        <img loading="lazy" src={getOptimizedImageUrl(p.icono_url, 200)} alt="" style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
                      ) : (
                        <div style={{ fontSize: '56px', marginBottom: '12px' }}>💎</div>
                      )}
                      
                      <strong style={{ fontSize: '15px', lineHeight: 1.2, marginBottom: '8px', minHeight: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.nombre}
                      </strong>
                      
                      <div translate="no" className="notranslate" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>{formatBs(finalPrice.venta_bs)}</span>
                        {!isCliente && (
                          <span style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px', fontWeight: 600 }}>{formatUSD(finalPrice.venta_usd)}</span>
                        )}
                      </div>

                      {(p.info_adicional_texto || p.info_adicional_imagen_url) && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); setInfoProductModal(p); }} 
                          style={{ 
                            position: 'absolute', top: '8px', right: '8px',
                            backgroundColor: '#ff2a2a', color: '#ffffff', 
                            fontSize: '16px', fontWeight: '900', cursor: 'pointer', 
                            borderRadius: '50%', width: '28px', height: '28px', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(255, 42, 42, 0.6)', border: '2px solid #ffffff',
                            transition: 'all 0.2s', zIndex: 2
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                          title="Información importante"
                        >
                          i
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            </>
          )
        })()}
          </div>
          
        </div>
      </div>

      {/* MODAL DE INFO ADICIONAL (ⓘ) */}
      {infoProductModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s', padding: '16px', backdropFilter: 'blur(5px)'
        }} onClick={() => setInfoProductModal(null)}>
          <div style={{
            backgroundColor: 'var(--bg-panel)', width: '100%', maxWidth: '420px',
            borderRadius: '24px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.8)', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)', animation: 'scaleUp 0.3s'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>{infoProductModal.nombre}</span>
              </div>
              <button 
                onClick={() => setInfoProductModal(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '16px', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            
            <div style={{ padding: '0', maxHeight: '70vh', overflowY: 'auto' }}>
              {infoProductModal.info_adicional_imagen_url && (
                <div 
                  onClick={() => setExpandedImage(infoProductModal.info_adicional_imagen_url)}
                  style={{ 
                    width: '100%', 
                    height: '40vh',
                    minHeight: '250px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    backgroundColor: '#000',
                    backgroundImage: `url(${infoProductModal.info_adicional_imagen_url})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    cursor: 'zoom-in',
                    position: 'relative'
                  }}
                  title="Haz clic para ampliar la imagen"
                >
                  <div style={{
                    position: 'absolute', bottom: '12px', right: '12px',
                    backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff',
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    border: '1px solid rgba(255,255,255,0.12)', fontWeight: 'bold'
                  }}>
                    🔍 Ampliar imagen
                  </div>
                </div>
              )}
              {infoProductModal.info_adicional_texto && (
                <div style={{ padding: '24px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {infoProductModal.info_adicional_texto}
                  </p>
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => setInfoProductModal(null)} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px' }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEN EXPANDIDA (TUTORIAL BANNER) */}
      {expandedImage && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 20000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', backdropFilter: 'blur(10px)',
            cursor: 'zoom-out', animation: 'fadeIn 0.25s'
          }}
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="Expanded Preview" 
            style={{
              maxWidth: '100%', maxHeight: '95vh',
              borderRadius: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
              objectFit: 'contain', border: '1px solid rgba(255,255,255,0.08)',
              animation: 'scaleUp 0.25s'
            }}
          />
          <button
            style={{
              position: 'absolute', top: '24px', right: '24px',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: '20px', width: '44px', height: '44px',
              borderRadius: '50%', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
            onClick={(e) => { e.stopPropagation(); setExpandedImage(null); }}
          >
            ✕
          </button>
        </div>
      )}

    </div>
    )
  }

  return (
    <div className="catalogo-container">
      <div className="page-header mb-24">
        <h1 className="page-title">Catálogo de Juegos y Servicios</h1>
        <p className="page-subtitle">Selecciona uno para ver su lista de precios de venta</p>
      </div>

      <div className="catalogo-grid">
        {juegosData.map(juego => {
          const catIcon = (juego.categorias && juego.categorias.icono) ? juego.categorias.icono : '🎮'
          return (
            <div 
              key={juego.id} 
              className="card"
              style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                justifyContent: 'center', padding: '16px 12px', cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center', gap: '8px',
                border: '1px solid transparent',
                backgroundColor: 'var(--bg-card)'
              }}
              onClick={() => {
                handleSetSelectedJuego(juego);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 210, 255, 0.15)'
                e.currentTarget.style.borderColor = 'var(--accent-primary)'
                e.currentTarget.style.backgroundColor = 'var(--bg-panel)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              {juego.icono_url ? (
                <img src={getOptimizedImageUrl(juego.icono_url, 200)} alt={juego.nombre} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }} />
              ) : (
                <div style={{ fontSize: '72px' }}>{catIcon}</div>
              )}
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginTop: '12px' }}>
                {juego.nombre}
              </div>
            </div>
          )
        })}
      </div>
      {selectedJuego && (
        <TutorialVideoModal 
          isOpen={showTutorialModal} 
          onClose={() => setShowTutorialModal(false)} 
          videoUrl={selectedJuego.tutorial_video_url} 
          title={`¿Cómo recargar ${selectedJuego.nombre}?`} 
        />
      )}
    </div>
  )
}
