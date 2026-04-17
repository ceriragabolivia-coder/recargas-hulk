import React, { useState, useMemo } from 'react'
import { useConfiguracion, useTodosLosProductos, useCart, useAuth } from '../hooks/useData'
import { calcularPrecioVenta, formatBs, formatUSD } from '../utils/helpers'

export default function Catalogo() {
  const { productos, loading } = useTodosLosProductos()
  const { config, loading: loadingConfig } = useConfiguracion()
  const { addToCart } = useCart()
  const { perfil, isCliente } = useAuth()
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [addedItem, setAddedItem] = useState(null) 

  const [localRechargeData, setLocalRechargeData] = useState({
    player_id: '',
    account_email: '',
    account_password: '',
    account_user: ''
  })
  
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [pendingItem, setPendingItem] = useState(null)

  const confirmAddToCart = () => {
    if (!pendingItem) return
    const { p, selectedJuego, finalPrice, localRechargeData } = pendingItem
    addToCart(p, selectedJuego, finalPrice, localRechargeData)
    setAddedItem(p.id)
    setTimeout(() => setAddedItem(null), 1000)
    setPendingItem(null)
  }
  
  const juegosData = useMemo(() => {
    const map = {}
    productos.forEach(p => {
      // Robustez: Manejar si 'juegos' es un objeto o un array de un solo elemento
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
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatBs(pendingItem.finalPrice.venta_bs)}</div>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Cuenta a Recargar:</span> 
                <span style={{ color: '#ffffff', textAlign: 'right', fontWeight: 800, fontSize: '18px', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,210,255,0.4)' }}>
                  {pendingItem.selectedJuego.metodo_recarga === 'cuenta_completa' 
                    ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Correo:</span><br/>{pendingItem.localRechargeData.account_email}<br/><div style={{height:8}}></div><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Clave:</span><br/>{pendingItem.localRechargeData.account_password}</>
                    : pendingItem.selectedJuego.metodo_recarga === 'usuario_clave'
                    ? <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Usuario:</span><br/>{pendingItem.localRechargeData.account_user}<br/><div style={{height:8}}></div><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>Clave:</span><br/>{pendingItem.localRechargeData.account_password}</>
                    : <><span style={{color:'var(--accent-primary)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase'}}>ID/UID:</span><br/>{pendingItem.localRechargeData.player_id}</>}
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
            padding: '20px', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s'
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA (Info y Características) */}
        <div style={{ flex: '1 1 280px', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <button className="btn btn-ghost" onClick={() => setSelectedJuego(null)} style={{ alignSelf: 'flex-start', padding: '8px 16px', backgroundColor: 'var(--bg-panel)' }}>
            ← Volver al Catálogo
          </button>
          
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 20px', gap: '16px' }}>
            {selectedJuego.icono_url ? (
              <img src={selectedJuego.icono_url} alt={selectedJuego.nombre} style={{ width: '100%', maxWidth: '260px', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '32px', filter: 'drop-shadow(0 16px 40px rgba(0,0,0,0.5))' }} />
            ) : (
              <div style={{ fontSize: '120px' }}>🎮</div>
            )}
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>{selectedJuego.nombre}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Lista de Precios Oficial</p>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '1px', fontWeight: 700 }}> Características</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Tipo:</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_tipo || 'Recarga'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Región:</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_region || 'Global'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Entrega:</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedJuego.caracteristicas_entrega || 'Inmediata'}</span>
              </div>
            </div>

            {selectedJuego.caracteristicas_nota && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(255, 171, 0, 0.1)', borderRadius: '8px', borderLeft: '3px solid var(--accent-warning)' }}>
                <p style={{ fontSize: '12px', color: 'var(--accent-warning)', lineHeight: '1.4' }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Nota Importante:</strong>
                  {selectedJuego.caracteristicas_nota}
                </p>
              </div>
            )}
          </div>

          {config?.tutorial_banner_texto && config?.tutorial_banner_link && (
            <a 
              href={config.tutorial_banner_link} 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                backgroundColor: 'rgba(0, 210, 255, 0.1)', borderRadius: '12px',
                border: '1px solid rgba(0, 210, 255, 0.2)', textDecoration: 'none',
                transition: 'all 0.2s ease', cursor: 'pointer'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 210, 255, 0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: '24px' }}>🔔</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{config.tutorial_banner_texto}</div>
                <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px' }}>Ver Tutorial →</div>
              </div>
            </a>
          )}

        </div>
        
        {/* COLUMNA DERECHA (Formulario de Recarga y Productos) */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {config?.promo_banner_texto && (
            <a 
              href={config.promo_banner_link || '#'} 
              target={config.promo_banner_link ? "_blank" : "_self"}
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
                background: 'linear-gradient(135deg, rgba(255, 171, 0, 0.15) 0%, rgba(255, 86, 48, 0.15) 100%)', 
                borderRadius: '16px', border: '1px solid rgba(255, 171, 0, 0.3)', textDecoration: 'none',
              }}
            >
              {config.promo_banner_icono_url ? (
                <img src={config.promo_banner_icono_url} alt="Promo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
              ) : (
                 <div style={{ fontSize: '32px' }}>🎁</div>
              )}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffab00', marginBottom: '4px' }}>¡Oferta Especial!</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.4' }}>{config.promo_banner_texto}</p>
              </div>
            </a>
          )}

          <div className="card card-recharge-info" style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-primary)', padding: '24px' }}>
            {selectedJuego.metodo_recarga === 'cuenta_completa' ? (
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
            ) : selectedJuego.metodo_recarga === 'usuario_clave' ? (
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
                  placeholder="ID del perfil al que se asignarán los paquetes..."
                  value={localRechargeData.player_id}
                  onChange={e => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    setLocalRechargeData({...localRechargeData, player_id: numericValue});
                  }}
                  style={{ backgroundColor: 'var(--bg-card)', padding: '20px', fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' }}
                />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Asegúrese de escribir su ID correctamente. Los paquetes que seleccione a continuación se asignarán a este perfil.
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Selecciona un paquete</h2>
            
            {selectedJuego.productos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '48px', opacity: 0.5 }}>📦</span>
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>No hay productos activos en este momento.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                {selectedJuego.productos.map(p => {
                  const finalPrice = calcularPrecioVenta(p, selectedJuego, config, perfil)
                  return (
                    <div 
                      key={p.id}
                      style={{
                        backgroundColor: '#00ff00',
                        borderRadius: '16px',
                        padding: '20px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(0, 255, 0, 0.25)',
                        transition: 'transform 0.2s',
                        color: '#000000',
                        border: '2px solid transparent'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      onClick={() => {
                        if (selectedJuego.metodo_recarga === 'cuenta_completa') {
                          if (!localRechargeData.account_email.trim() || !localRechargeData.account_password.trim()) {
                            alert('Por favor introduce el correo y clave primero.')
                            return
                          }
                        } else if (selectedJuego.metodo_recarga === 'usuario_clave') {
                          if (!localRechargeData.account_user?.trim() || !localRechargeData.account_password.trim()) {
                            alert('Por favor introduce el usuario y clave primero.')
                            return
                          }
                        } else {
                          if (!localRechargeData.player_id.trim()) {
                            alert('Por favor introduce el ID del jugador primero.')
                            return
                          }
                        }
                        
                        setPendingItem({ p, selectedJuego, finalPrice, localRechargeData })
                      }}
                    >
                      {p.icono_url ? (
                        <img src={p.icono_url} alt="" style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
                      ) : (
                        <div style={{ fontSize: '56px', marginBottom: '12px' }}>💎</div>
                      )}
                      
                      <strong style={{ fontSize: '15px', lineHeight: 1.2, marginBottom: '8px', minHeight: '34px', display: 'flex', alignItems: 'center' }}>
                        {p.nombre}
                      </strong>
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>{formatBs(finalPrice.venta_bs)}</span>
                        {!isCliente && (
                          <span style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px', fontWeight: 600 }}>{formatUSD(finalPrice.venta_usd)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
        </div>
      </div>
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
                justifyContent: 'center', padding: '24px 12px', cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center', gap: '12px',
                border: '1px solid transparent',
                backgroundColor: 'var(--bg-card)'
              }}
              onClick={() => setSelectedJuego(juego)}
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
                <img src={juego.icono_url} alt={juego.nombre} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: '24px', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }} />
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
    </div>
  )
}
