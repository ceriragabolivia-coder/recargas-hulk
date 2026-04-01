import React, { useState, useMemo } from 'react'
import { useConfiguracion, useTodosLosProductos, useCart, useAuth } from '../hooks/useData'
import { calcularPrecioVenta, formatBs, formatUSD, playCashRegisterSound } from '../utils/helpers'

export default function Catalogo() {
  const { productos, loading } = useTodosLosProductos()
  const { config, loading: loadingConfig } = useConfiguracion()
  const { addToCart } = useCart()
  const { perfil } = useAuth()
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [addedItem, setAddedItem] = useState(null) // Para animación simple

  const [localRechargeData, setLocalRechargeData] = useState({
    player_id: '',
    account_email: '',
    account_password: ''
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
      const j = p.juegos
      if (!j) return
      if (!map[j.id]) {
        map[j.id] = { ...j, productos: [] }
      }
      map[j.id].productos.push(p)
    })
    
    const arr = Object.values(map)
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre))
    // sort products too by order, then by base cost
    arr.forEach(j => {
      j.productos.sort((a, b) => a.orden - b.orden || a.costo_base - b.costo_base)
    })
    return arr
  }, [productos])

  if (loading || loadingConfig) {
    return (
      <div className="loading-page">
        <div className="spinner"></div><div>Cargando Catálogo...</div>
      </div>
    )
  }

  if (selectedJuego) {
    return (
    <div style={{ paddingLeft: '20px' }}>
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
              backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', 
              marginBottom: '24px', border: '1px solid var(--border-color)', textAlign: 'left'
            }}>
              <div style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Paquete:</span> 
                <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{pendingItem.p.nombre} ({formatBs(pendingItem.finalPrice.venta_bs)})</span>
              </div>
              <div style={{ fontSize: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cuenta a Recargar:</span> 
                <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                  {pendingItem.selectedJuego.metodo_recarga === 'cuenta_completa' 
                    ? <>Correo: {pendingItem.localRechargeData.account_email}<br/>Clave: {pendingItem.localRechargeData.account_password}</>
                    : `ID/UID: ${pendingItem.localRechargeData.player_id}`}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.5', fontStyle: 'italic' }}>
              Al presionar el botón de "Si" usted confirma que verificó la información proporcionada por usted mismo.
            </p>

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

        <div className="page-header mb-24" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-ghost" onClick={() => setSelectedJuego(null)} style={{ padding: '8px 16px', backgroundColor: 'var(--bg-panel)' }}>
            ← Volver
          </button>
          {selectedJuego.icono_url && (
            <img src={selectedJuego.icono_url} alt={selectedJuego.nombre} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '14px' }} />
          )}
          <div>
            <h1 className="page-title">{selectedJuego.nombre} - Lista de Precios</h1>
            <p className="page-subtitle">Precios finales de venta al cliente</p>
          </div>
        </div>

        <div className="card mb-24" style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-primary)' }}>
          {selectedJuego.metodo_recarga === 'cuenta_completa' ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  style={{ backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                  {selectedJuego.nombre.toLowerCase().includes('cod') ? '🔑 Clave de Activision' : '🔑 Clave de acceso'}
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="********"
                  value={localRechargeData.account_password}
                  onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-card)' }}
                />
              </div>
            </div>
          ) : selectedJuego.metodo_recarga === 'usuario_clave' ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  style={{ backgroundColor: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                  🔑 Contraseña
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="********"
                  value={localRechargeData.account_password}
                  onChange={e => setLocalRechargeData({...localRechargeData, account_password: e.target.value})}
                  style={{ backgroundColor: 'var(--bg-card)' }}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🆔 Introduce el ID del jugador aquí
                {selectedJuego.guia_id_url && (
                  <button 
                    onClick={() => setShowGuideModal(true)}
                    style={{ 
                      cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: '#000', 
                      width: '22px', height: '22px', borderRadius: '50%', display: 'flex', 
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
                className="form-input" 
                placeholder="ID del perfil al que se asignarán los paquetes..."
                value={localRechargeData.player_id}
                onChange={e => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  setLocalRechargeData({...localRechargeData, player_id: numericValue});
                }}
                style={{ fontSize: '16px', padding: '14px', backgroundColor: 'var(--bg-card)' }}
              />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Los paquetes que añadas a continuación se asignarán a este ID en tu pedido.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table table-cards-mobile">
              <thead>
                <tr>
                  <th>Producto / Paquete</th>
                  <th style={{ textAlign: 'right' }}>Precio (Bs)</th>
                  <th style={{ textAlign: 'right' }}>Precio (USD)</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {selectedJuego.productos.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No hay productos activos</td></tr>
                ) : (
                  selectedJuego.productos.map(p => {
                    const finalPrice = calcularPrecioVenta(p, selectedJuego, config, perfil)
                    return (
                      <tr key={p.id}>
                        <td data-label="Producto" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {p.icono_url ? (
                              <img src={p.icono_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>📦</span>
                            )}
                            {p.nombre}
                          </div>
                        </td>
                        <td data-label="Precio (Bs)" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                          {formatBs(finalPrice.venta_bs)}
                        </td>
                        <td data-label="Precio (USD)" style={{ textAlign: 'right', color: 'var(--accent-success)', fontWeight: 600, fontSize: 16 }}>
                          {formatUSD(finalPrice.venta_usd)}
                        </td>
                        <td data-label="" style={{ textAlign: 'right', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                          <button 
                            className="btn btn-primary"
                            style={{ 
                              padding: '6px 14px', fontSize: 13, minWidth: 90, width: '100%',
                              backgroundColor: addedItem === p.id ? 'var(--accent-success)' : '',
                              borderColor: addedItem === p.id ? 'var(--accent-success)' : ''
                            }}
                            onClick={() => {
                              if (selectedJuego.metodo_recarga === 'cuenta_completa') {
                                if (!localRechargeData.account_email.trim() || !localRechargeData.account_password.trim()) {
                                  alert('Por favor introduce el correo y clave antes de añadir paquetes al carrito.')
                                  return
                                }
                              } else if (selectedJuego.metodo_recarga === 'usuario_clave') {
                                if (!localRechargeData.account_user?.trim() || !localRechargeData.account_password.trim()) {
                                  alert('Por favor introduce el usuario y clave antes de añadir paquetes al carrito.')
                                  return
                                }
                              } else {
                                if (!localRechargeData.player_id.trim()) {
                                  alert('Por favor introduce el ID del jugador antes de añadir paquetes al carrito.')
                                  return
                                }
                              }
                              
                              setPendingItem({ p, selectedJuego, finalPrice, localRechargeData })
                            }}
                          >
                            {addedItem === p.id ? '✓ Añadido' : '+ Añadir'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: '20px' }}>
      <div className="page-header mb-24">
        <h1 className="page-title">Catálogo de Juegos y Servicios</h1>
        <p className="page-subtitle">Selecciona uno para ver su lista de precios de venta</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
        gap: '20px' 
      }}>
        {juegosData.map(juego => {
          const catIcon = juego.categorias?.icono || '🎮'
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
