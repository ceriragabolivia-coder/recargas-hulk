import React, { useState } from 'react';
import { formatUSD, formatBs } from '../../utils/helpers';

export default function GestionProductosLootAdmin({ states, actions }) {
  const { 
    juegos, categorias, productos, selectedJuegoId, searchJuego, 
    allCategorias, loadingJuegos, loadingProductos 
  } = states;
  const { 
    setSelectedJuegoId, setSearchJuego, handleOpenGameModal, 
    setIsCategoryModalOpen, handleOpenProductModal, toggleProducto, deleteProducto 
  } = actions;

  const [activeTab, setActiveTab] = useState('productos');

  const selectedJuego = juegos.find(j => j.id === selectedJuegoId) || (juegos.length > 0 ? juegos[0] : null);
  if (!selectedJuegoId && juegos.length > 0) {
    setTimeout(() => setSelectedJuegoId(juegos[0].id), 0);
  }

  // Helper para buscar juegos
  const juegosFiltrados = searchJuego.trim() 
    ? juegos.filter(j => j.nombre.toLowerCase().includes(searchJuego.toLowerCase()))
    : juegos;

  return (
    <div className="loot-content">
      <div className="loot-page-header">
        <div>
          <h1 className="loot-page-title">CATÁLOGO Y <span>PRODUCTOS</span></h1>
          <p className="loot-page-subtitle">Gestiona los servicios, paquetes, márgenes y categorías de la tienda.</p>
        </div>
        <div className="loot-header-actions">
          <div className="loot-input-wrapper">
            <span className="loot-input-icon">🔍</span>
            <input 
              type="text" 
              className="loot-input" 
              placeholder="Buscar servicio..." 
              value={searchJuego}
              onChange={(e) => setSearchJuego(e.target.value)}
            />
          </div>
          <button className="loot-btn" onClick={() => setIsCategoryModalOpen(true)}>
            <span>📁</span> CATEGORÍAS
          </button>
          <button className="loot-btn primary" onClick={handleOpenGameModal}>
            <span>+</span> NUEVO SERVICIO
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Sidebar de Servicios (Juegos) */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loadingJuegos ? (
            <div style={{ padding: '20px', color: 'var(--loot-text-muted)' }}>Cargando servicios...</div>
          ) : (
            juegosFiltrados.map(juego => {
              const isActive = selectedJuegoId === juego.id;
              return (
                <div 
                  key={juego.id}
                  onClick={() => setSelectedJuegoId(juego.id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    backgroundColor: isActive ? 'rgba(30, 92, 255, 0.1)' : 'var(--loot-card-bg)',
                    border: `1px solid ${isActive ? 'var(--loot-primary)' : 'var(--loot-border)'}`,
                    borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                    {juego.icono_url ? (
                      <img loading="lazy" decoding="async" src={juego.icono_url} alt="Icono" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎮</div>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, color: isActive ? 'var(--loot-primary)' : 'white', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {juego.nombre}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--loot-text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                      {allCategorias.find(c => c.id === juego.categoria_id)?.nombre || 'Sin Categoría'}
                    </div>
                  </div>
                  {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--loot-primary)' }}></div>}
                </div>
              );
            })
          )}
        </div>

        {/* Contenido Principal (Paquetes) */}
        <div style={{ flex: 1 }}>
          {selectedJuego ? (
            <div className="loot-card">
              <div style={{ padding: '24px', borderBottom: '1px solid var(--loot-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', color: 'white', fontWeight: 800 }}>{selectedJuego.nombre.toUpperCase()}</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--loot-text-muted)' }}>MÉTODO: {selectedJuego.metodo_recarga}</p>
                </div>
                <button className="loot-btn primary" onClick={() => handleOpenProductModal()}>
                  + NUEVO PAQUETE
                </button>
              </div>

              {loadingProductos ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--loot-text-muted)' }}>Cargando paquetes...</div>
              ) : (
                <div className="loot-table-wrapper">
                  <table className="loot-table">
                    <thead>
                      <tr>
                        <th>ORDEN</th>
                        <th>PRODUCTO</th>
                        <th>TIPO</th>
                        <th>PRECIO (COSTO / VENTA)</th>
                        <th>ESTADO</th>
                        <th style={{ textAlign: 'right' }}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((prod, idx) => (
                        <tr key={prod.id}>
                          <td>
                            <div className="loot-cell-secondary">#{idx + 1}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {prod.icono_url ? (
                                <img loading="lazy" decoding="async" src={prod.icono_url} className="loot-product-icon" alt="Prod" />
                              ) : (
                                <div className="loot-product-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                              )}
                              <div className="loot-cell-primary" style={{ margin: 0 }}>{prod.nombre}</div>
                            </div>
                          </td>
                          <td>
                            <div className="loot-cell-secondary" style={{ textTransform: 'uppercase' }}>{prod.tipo_producto || 'Recarga'}</div>
                          </td>
                          <td>
                            <div className="loot-cell-price">{formatUSD(prod.precio_usd || 0)}</div>
                            <div className="loot-cell-secondary">Costo: {formatUSD(prod.costo_base || 0)}</div>
                          </td>
                          <td>
                            <button 
                              onClick={() => toggleProducto(prod.id, !prod.activo)}
                              className={`loot-status ${prod.activo ? 'completada' : 'cancelada'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              {prod.activo ? 'ACTIVO' : 'INACTIVO'}
                            </button>
                          </td>
                          <td>
                            <div className="loot-actions" style={{ justifyContent: 'flex-end' }}>
                              <button className="loot-action-btn" title="Editar" onClick={() => handleOpenProductModal(prod)}>✏️</button>
                              <button className="loot-action-btn danger" title="Eliminar" onClick={() => {
                                if(window.confirm('¿Eliminar este paquete?')) deleteProducto(prod.id)
                              }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {productos.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--loot-text-muted)' }}>
                            No hay paquetes configurados para este servicio.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed var(--loot-border)', borderRadius: '20px', color: 'var(--loot-text-muted)' }}>
              Selecciona un servicio para ver sus paquetes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
