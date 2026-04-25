import React, { useState, useMemo } from 'react'
import {
  useJuegos,
  useProductos,
  useConfiguracion,
   useVentas,
  useTodosLosProductos,
  useUsuarios
} from '../hooks/useData'
import { calcularPrecioVenta, formatUSD, formatBs, playCashRegisterSound } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function RegistroVentas({ onNavigate }) {
  const { juegos, categorias, loading: loadingJuegos } = useJuegos()
  const { config, loading: loadingConfig } = useConfiguracion()
  const { ventasHoy, resumen, registrarVenta, deleteVenta, loading: loadingVentas } = useVentas()
  const { clientes: allClients } = useUsuarios()

  const [selectedCategoria, setSelectedCategoria] = useState('Todas')
  const [search, setSearch] = useState('')
  const [selectedJuego, setSelectedJuego] = useState(null)
  
  // Custom Hook instance inside component is valid, but we need dynamic ID.
  // Instead of re-calling the hook conditionally, we pass the selectedJuego ID
  // It will fetch when ID changes.
  const { productos, loading: loadingProductos } = useProductos(selectedJuego?.id)
  
  // Hook para búsqueda global
  const { productos: todosLosProductos, loading: loadingTodos } = useTodosLosProductos()

  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cantidades, setCantidades] = useState({})
  const [alertModal, setAlertModal] = useState(null) // { type, title, message, onConfirm }
  const [selectedVentaDetalle, setSelectedVentaDetalle] = useState(null)

  const isBuscando = search.trim().length > 0;

  // Filtrar juegos
  const juegosFiltrados = useMemo(() => {
    let filtrados = juegos
    if (selectedCategoria !== 'Todas') {
      const cat = categorias.find(c => c.nombre === selectedCategoria)
      if (cat) filtrados = filtrados.filter(j => j.categoria_id === cat.id)
    }
    return filtrados
  }, [juegos, categorias, selectedCategoria])

  // Filtrar productos globales para la barra de búsqueda
  const productosBuscados = useMemo(() => {
    if (!isBuscando || !todosLosProductos) return []
    const term = search.toLowerCase()
    return todosLosProductos.filter(p => 
      p.nombre.toLowerCase().includes(term) || 
      (p.juegos && p.juegos.nombre.toLowerCase().includes(term))
    )
  }, [search, todosLosProductos, isBuscando])

  const handleSelectJuego = (juego) => {
    setSelectedJuego(juego)
  }

  const handleSelectCategoria = (catName) => {
    setSelectedCategoria(catName)
    setSelectedJuego(null)
  }

  const handleRegistrar = async (producto, juegoAsociado = selectedJuego, cantidad = 1) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const { data, error } = await registrarVenta(producto.id, cantidad, '')
    
    if (error) {
      showToast('error', `Error: ${error.message}`)
    } else {
      playCashRegisterSound()
      showToast('success', `Venta registrada: ${cantidad}x ${producto.nombre} de ${juegoAsociado.nombre}`)
      setCantidades(prev => ({...prev, [producto.id]: 1}))
      if (isBuscando) setSearch('') // Limpiar búsqueda para volver al inicio rápido
    }
    setIsSubmitting(false)
  }

  const handleDeleteVenta = async (ventaId, nombreVenta) => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Venta',
      message: `¿Seguro que quieres eliminar la venta de ${nombreVenta}? Esto afectará tu cuadre del día.`,
      onConfirm: async () => {
        const { error } = await deleteVenta(ventaId)
        if (error) showToast('error', `Error al eliminar: ${error.message}`)
        else showToast('success', 'Venta eliminada correctamente')
        setAlertModal(null)
      }
    })
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const getTasaDelDiaLabel = () => {
    if (!config || Object.keys(config).length === 0) return 'Cargando...'
    return `Tasa Oficial: Bs ${config.tasa_dolar}`
  }

  const getClienteName = (authUserId) => {
    if (!authUserId || !allClients) return '-'
    const c = allClients.find(cl => cl.auth_user_id === authUserId)
    if (!c) return 'Sistema'
    return c.nickname || `${c.nombres} ${c.apellidos || ''}`
  }

  if (loadingJuegos || loadingConfig || loadingVentas) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <div>Cargando datos...</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="flex justify-between items-center mb-16">
          <div>
            <h1 className="page-title">Registro de Ventas</h1>
            <p className="page-subtitle">{getTasaDelDiaLabel()}</p>
          </div>
          {/* Aquí podríamos poner un selector rápido de tasa o un botón "Actualizar tasa" */}
        </div>
      </div>

      <div className="page-content" style={{ flex: 1, overflow: 'hidden', paddingTop: 0 }}>
        <div className="registro-layout">
          
          {/* IZQUIERDA: Selector de Juego y Productos */}
          <div className="registro-main" style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Buscador y Categorías */}
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-input"
                placeholder="Buscar juego o servicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="tabs" style={{ flexWrap: 'wrap' }}>
              <button
                className={`tab ${selectedCategoria === 'Todas' ? 'active' : ''}`}
                onClick={() => handleSelectCategoria('Todas')}
              >
                Todas
              </button>
              {categorias.map(c => (
                <button
                  key={c.id}
                  className={`tab ${selectedCategoria === c.nombre ? 'active' : ''}`}
                  onClick={() => handleSelectCategoria(c.nombre)}
                >
                  {c.nombre}
                </button>
              ))}
            </div>

            {/* Grid de Juegos o Lista de Productos si hay uno seleccionado */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              
              {isBuscando ? (
                // RESULTADOS DE BÚSQUEDA GLOBAL DE PRODUCTOS
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title" style={{ margin: 0, color: 'var(--text-primary)' }}>
                      Resultados para "{search}"
                    </h2>
                  </div>

                  {loadingTodos ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner"></div></div>
                  ) : productosBuscados.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-text">No se encontraron productos</div>
                      <div className="empty-state-sub">Prueba buscando otro nombre o juego.</div>
                    </div>
                  ) : (
                    <div>
                      {productosBuscados.map(prod => {
                        const precio = calcularPrecioVenta(prod, prod.juegos, config)
                        return (
                          <div key={prod.id} className="product-item">
                            <div className="product-info">
                              <span className="product-name">
                                {prod.nombre} 
                                <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 10 }}>{prod.juegos?.nombre}</span>
                              </span>
                              <div className="product-price">
                                <span className="product-price-usd" title="Precio final en USD">{formatUSD(precio.venta_usd)}</span>
                                <span className="product-price-bs" title={`Tasa aplicada: ${precio.tasa_usada}`}>{formatBs(precio.venta_bs)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-16">
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ganancia</div>
                                <div className="product-ganancia">{formatUSD(precio.ganancia_usd)}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input 
                                  type="number" 
                                  min="1"
                                  className="form-input" 
                                  style={{ width: 60, padding: '4px 8px', textAlign: 'center', height: '32px' }}
                                  value={cantidades[prod.id] || 1}
                                  onChange={(e) => setCantidades({...cantidades, [prod.id]: parseInt(e.target.value) || 1})}
                                  title="Cantidad"
                                />
                                <button 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleRegistrar(prod, prod.juegos, cantidades[prod.id] || 1)}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? '...' : '+ Vender'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : !selectedJuego ? (
                <>
                  <div className="games-grid">
                    {juegosFiltrados.map(juego => (
                      <div 
                        key={juego.id} 
                        className="game-card"
                        onClick={() => handleSelectJuego(juego)}
                      >
                        <div className="game-card-icon">
                          {categorias.find(c => c.id === juego.categoria_id)?.icono || '🎮'}
                        </div>
                        <div className="game-card-name">{juego.nombre}</div>
                      </div>
                    ))}
                  </div>
                  {juegosFiltrados.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-state-icon">😞</div>
                      <div className="empty-state-text">No se encontraron juegos</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center gap-12">
                      <button 
                        className="btn btn-ghost btn-icon" 
                        onClick={() => setSelectedJuego(null)}
                      >
                        🔙
                      </button>
                      <div>
                        <h2 className="card-title" style={{ margin: 0, color: 'var(--text-primary)' }}>
                          {selectedJuego.nombre}
                        </h2>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Tipo de cálculo: {selectedJuego.tipo_calculo}
                        </span>
                      </div>
                    </div>
                  </div>

                  {loadingProductos ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando paquetes...</div>
                    </div>
                  ) : productos.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-text">Sin productos</div>
                      <div className="empty-state-sub">Agrega productos en Gestión de Productos</div>
                    </div>
                  ) : (
                    <div>
                      {productos.map(prod => {
                        const precio = calcularPrecioVenta(prod, selectedJuego, config)
                        return (
                          <div key={prod.id} className="product-item">
                            <div className="product-info">
                              <span className="product-name">{prod.nombre}</span>
                              <div className="product-price">
                                <span className="product-price-usd" title="Precio final en USD">{formatUSD(precio.venta_usd)}</span>
                                <span className="product-price-bs" title={`Tasa aplicada: ${precio.tasa_usada}`}>{formatBs(precio.venta_bs)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-16">
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ganancia</div>
                                <div className="product-ganancia">{formatUSD(precio.ganancia_usd)}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input 
                                  type="number" 
                                  min="1"
                                  className="form-input" 
                                  style={{ width: 60, padding: '4px 8px', textAlign: 'center', height: '32px' }}
                                  value={cantidades[prod.id] || 1}
                                  onChange={(e) => setCantidades({...cantidades, [prod.id]: parseInt(e.target.value) || 1})}
                                  title="Cantidad"
                                />
                                <button 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleRegistrar(prod, selectedJuego, cantidades[prod.id] || 1)}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? '...' : '+ Vender'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
          </div>

          {/* DERECHA: Resumen de Ventas del Día */}
          <div className="ventas-panel">
            <div className="ventas-panel-header">
              <span style={{ fontWeight: 600, fontSize: 15 }}>Ventas de Hoy</span>
              <span className="badge badge-info">{resumen?.recargas_totales || 0}</span>
            </div>
            
            <div className="ventas-panel-list">
              {ventasHoy.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 10px' }}>
                  <div className="empty-state-text">No hay ventas hoy</div>
                  <div className="empty-state-sub">Las ventas aparecerán aquí</div>
                </div>
              ) : (
                ventasHoy.map(v => (
                  <div 
                    key={v.id} 
                    className="venta-item" 
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => setSelectedVentaDetalle(v)}
                  >
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="venta-item-name" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {v.juegos?.nombre ? `${v.juegos.nombre} - ${v.productos?.nombre || '?'}` : (v.notas || 'Venta Libre')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {v.hora.substring(0, 5)} • Ganancia: {formatUSD(v.ganancia_usd)}
                        {v.vendedor && (
                          <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 700 }}>
                            👤 {v.vendedor.nickname || v.vendedor.nombres}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="venta-item-amount">{formatBs(v.precio_venta_bs)}</div>
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVenta(v.id, v.juegos?.nombre ? v.productos?.nombre : v.notas);
                        }}
                      title="Eliminar venta"
                      style={{ padding: 4, width: 24, height: 24, minHeight: 24, marginLeft: 4 }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="ventas-panel-footer">
              <div className="flex justify-between items-end">
                <div>
                  <div className="ventas-total-label">Total Recaudado Bs</div>
                  <div className="ventas-total-value">
                    {formatBs(resumen?.ventas_totales_bs || 0)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="ventas-total-label">Ganancia USD</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-warning)' }}>
                    {formatUSD(resumen?.ganancias_totales || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.message}
          </div>
        </div>
      )}

      {selectedVentaDetalle && (
        <AlertModal
          isOpen={!!selectedVentaDetalle}
          title={`Detalle de Venta #${selectedVentaDetalle.id}`}
          type="info"
          onConfirm={() => setSelectedVentaDetalle(null)}
          message={(
            <div style={{ textAlign: 'left', fontSize: '13px' }}>
              <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '4px' }}>PRODUCTO / SERVICIO</div>
                <div>{selectedVentaDetalle.juegos?.nombre} - {selectedVentaDetalle.productos?.nombre}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedVentaDetalle.notas}</div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '4px' }}>MONTO</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-success)' }}>{formatBs(selectedVentaDetalle.precio_venta_bs)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({formatUSD(selectedVentaDetalle.precio_venta_usd)})</div>
                </div>
                <div style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '4px' }}>ADMIN RESPONSABLE</div>
                  <div>{selectedVentaDetalle.vendedor?.nickname || selectedVentaDetalle.vendedor?.nombres || 'Sistema'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedVentaDetalle.fecha} {selectedVentaDetalle.hora.substring(0, 5)}</div>
                </div>
              </div>

              {selectedVentaDetalle.pedido ? (
                <div style={{ padding: '10px', backgroundColor: 'rgba(0,210,255,0.05)', borderRadius: '8px', border: '1px solid rgba(0,210,255,0.1)' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div 
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => onNavigate('pedidos', { orderId: selectedVentaDetalle.pedido.id })}
                      title="Ver resumen del pedido"
                    >
                      DATOS DEL PEDIDO #{selectedVentaDetalle.pedido.numero_pedido}
                    </div>
                    <button 
                      className="btn btn-sm btn-ghost" 
                      style={{ fontSize: '10px', padding: '2px 8px', height: 'auto', border: '1px solid var(--accent-primary)' }}
                      onClick={() => onNavigate('pedidos', { orderId: selectedVentaDetalle.pedido.id })}
                    >
                      👁️ Ver Detalles
                    </button>
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Cliente:</strong> {getClienteName(selectedVentaDetalle.pedido.cliente_id)}
                  </div>
                  <div style={{ marginBottom: '4px' }}><strong>Referencia:</strong> {selectedVentaDetalle.pedido.referencia_pago}</div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Procesado por:</strong> {getClienteName(selectedVentaDetalle.pedido.atendido_por_id)}
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong>Items:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {selectedVentaDetalle.pedido.pedido_items?.map((item, i) => (
                        <li key={i}>{item.cantidad}x {item.productos?.nombre}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Esta fue una venta manual (no asociada a un pedido)
                </div>
              )}
            </div>
          )}
        />
      )}

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
