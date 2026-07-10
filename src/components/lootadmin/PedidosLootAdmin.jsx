import React from 'react';
import { formatBs, formatUSD } from '../../utils/helpers';

export default function PedidosLootAdmin({ states, actions }) {
  const { pedidos, loading, filtroEstado } = states;
  const { setFiltroEstado, handleCompletarPedido, setMotivoRechazo, rechazarConMotivo, setRechazandoItem, rechazandoItem } = actions;

  // Filter Orders
  const filteredPedidos = pedidos.filter(p => {
    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'pendiente') return p.estado === 'pendiente' || p.estado === 'pendiente_pago';
    if (filtroEstado === 'completado') return p.estado === 'completado';
    if (filtroEstado === 'cancelado') return p.estado === 'cancelado' || p.estado === 'rechazado';
    if (filtroEstado === 'procesando') return p.estado === 'procesando';
    return true;
  });

  const getStatusClass = (estado) => {
    if (!estado) return '';
    const e = estado.toLowerCase();
    if (e.includes('completado')) return 'completada';
    if (e.includes('cancelado') || e.includes('rechazado')) return 'cancelada';
    if (e.includes('pendiente')) return 'pendiente';
    if (e.includes('procesando')) return 'procesando';
    return '';
  };

  const getPaymentMethod = (pedido) => {
    if (pedido.metodo_pago === 'saldo_billetera') return 'BILLETERA';
    if (pedido.metodo_pago === 'pago_movil') return 'PAGO MÓVIL';
    if (pedido.metodo_pago === 'binance') return 'BINANCE';
    if (pedido.metodo_pago === 'zinli') return 'ZINLI';
    return (pedido.metodo_pago || 'N/A').toUpperCase();
  };

  const formatearFechaLoot = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'P. M.' : 'A. M.';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return (
      <div style={{ textAlign: 'left' }}>
        <div style={{ color: 'white', fontWeight: 600 }}>{day} {month}</div>
        <div style={{ color: 'var(--loot-text-muted)', fontSize: '11px' }}>{year} - {hours}:{minutes} {ampm}</div>
      </div>
    );
  };

  return (
    <div className="loot-content">
      <div className="loot-page-header">
        <div>
          <h1 className="loot-page-title">GESTIÓN DE <span>ÓRDENES</span></h1>
          <p className="loot-page-subtitle">Revisa y valida manualmente los pedidos de recargas y gift cards.</p>
        </div>
        <div className="loot-header-actions">
          <div className="loot-input-wrapper">
            <span className="loot-input-icon">🔍</span>
            <input type="text" className="loot-input" placeholder="Buscar por ID, usuario o estado..." />
          </div>
          <button className="loot-btn" onClick={() => window.location.reload()}>
            <span>🔄</span> SINCRONIZAR
          </button>
          <div className="loot-pill">
            <span style={{ color: 'var(--loot-accent)' }}>!</span> 0 ÓRDENES
          </div>
        </div>
      </div>

      <div className="loot-filters">
        <button 
          className={`loot-filter-btn ${filtroEstado === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('todos')}
        >
          VER TODO ({pedidos.length})
        </button>
        <button 
          className={`loot-filter-btn ${filtroEstado === 'pendiente' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('pendiente')}
        >
          PENDIENTES ({pedidos.filter(p => p.estado.includes('pendiente')).length})
        </button>
        <button 
          className={`loot-filter-btn ${filtroEstado === 'procesando' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('procesando')}
        >
          EN PROCESO ({pedidos.filter(p => p.estado === 'procesando').length})
        </button>
        <button 
          className={`loot-filter-btn ${filtroEstado === 'completado' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('completado')}
        >
          COMPLETADAS ({pedidos.filter(p => p.estado === 'completado').length})
        </button>
        <button 
          className={`loot-filter-btn ${filtroEstado === 'cancelado' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('cancelado')}
        >
          CANCELADAS ({pedidos.filter(p => p.estado.includes('cancelado') || p.estado.includes('rechazado')).length})
        </button>
      </div>

      <div className="loot-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--loot-text-muted)' }}>Cargando órdenes...</div>
        ) : (
          <div className="loot-table-wrapper">
            <table className="loot-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>ID / FECHA</th>
                  <th>CLIENTE</th>
                  <th>PRODUCTO</th>
                  <th>MÉTODO DE PAGO</th>
                  <th>REFERENCIA</th>
                  <th>ESTADO</th>
                  <th style={{ textAlign: 'right' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map(pedido => {
                  const clienteNombre = pedido.cliente?.nombre || 'Desconocido';
                  const clienteEmail = pedido.cliente?.email || '';
                  const item = pedido.pedido_items && pedido.pedido_items[0];
                  const productoNombre = item?.productos?.nombre || 'Producto';
                  const productoInfo = item?.datos_formulario ? JSON.parse(item.datos_formulario) : {};
                  
                  // Extract player ID if present
                  let playerInfo = '';
                  if (productoInfo['ID de Jugador']) playerInfo = `ID: ${productoInfo['ID de Jugador']}`;
                  else if (productoInfo['Player ID']) playerInfo = `ID: ${productoInfo['Player ID']}`;
                  
                  const isProcessing = pedido.estado === 'procesando';
                  
                  return (
                    <tr key={pedido.id}>
                      <td>
                        <input type="checkbox" style={{ accentColor: 'var(--loot-primary)', width: '16px', height: '16px', cursor: 'pointer' }} />
                      </td>
                      <td>
                        <div className="loot-cell-id">{(pedido.numero_pedido || pedido.id.substring(0, 8)).toUpperCase()}</div>
                        {formatearFechaLoot(pedido.created_at)}
                      </td>
                      <td>
                        <div className="loot-cell-primary">{clienteNombre}</div>
                        <div className="loot-cell-secondary">{clienteEmail}</div>
                      </td>
                      <td>
                        <div className="loot-cell-product">{productoNombre}</div>
                        <div className="loot-cell-secondary">
                          {playerInfo || `${item?.cantidad || 1} X`}
                        </div>
                      </td>
                      <td>
                        <div className="loot-cell-price">{formatBs(pedido.total_bs || 0)}</div>
                        <div className="loot-cell-secondary">{getPaymentMethod(pedido)}</div>
                      </td>
                      <td>
                        <span className="loot-cell-ref">{pedido.referencia || 'N/A'}</span>
                      </td>
                      <td>
                        <span className={`loot-status ${getStatusClass(pedido.estado)}`}>
                          {pedido.estado === 'pendiente_pago' ? 'PENDIENTE' : pedido.estado}
                        </span>
                      </td>
                      <td>
                        <div className="loot-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="loot-action-btn" title="Ver Historial" onClick={() => {}}>🕒</button>
                          
                          {pedido.estado !== 'completado' && pedido.estado !== 'cancelado' && pedido.estado !== 'rechazado' && (
                            <>
                              <button 
                                className="loot-action-btn success" 
                                title="Completar"
                                onClick={() => handleCompletarPedido(pedido.id)}
                              >
                                ✓
                              </button>
                              
                              {rechazandoItem === pedido.id ? (
                                <div style={{ display: 'flex', gap: '5px', background: 'var(--loot-card-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--loot-danger)' }}>
                                  <input 
                                    autoFocus
                                    type="text" 
                                    className="loot-input"
                                    style={{ width: '150px', padding: '6px 12px' }}
                                    placeholder="Motivo..."
                                    onChange={(e) => setMotivoRechazo(e.target.value)}
                                  />
                                  <button className="loot-action-btn danger" onClick={() => rechazarConMotivo(pedido.id)}>X</button>
                                  <button className="loot-action-btn" onClick={() => setRechazandoItem(null)}>↩</button>
                                </div>
                              ) : (
                                <button 
                                  className="loot-action-btn danger" 
                                  title="Cancelar"
                                  onClick={() => setRechazandoItem(pedido.id)}
                                >
                                  ⊘
                                </button>
                              )}
                            </>
                          )}
                          
                          <button className="loot-action-btn" title="Eliminar" style={{ opacity: 0.5 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredPedidos.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--loot-text-muted)' }}>
                No hay órdenes para mostrar con este filtro.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
