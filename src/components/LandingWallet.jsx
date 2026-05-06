import React, { useState, useEffect, useMemo } from 'react'
import { useWallet, useAuth, useMetodosPago, useVentas } from '../hooks/useData'
import { formatUSD, formatBs } from '../utils/helpers'
import { supabase } from '../lib/supabase'

export default function LandingWallet({ onClose }) {
  const { wallet, adminSalesBalance, recargas, transacciones, loading, solicitarRecarga, refetch } = useWallet()
  const { perfil, isCliente, user } = useAuth()
  const { metodos } = useMetodosPago()
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin' || perfil?.rol?.toLowerCase() === 'administrador'
  const { verificarYRegistrarReferencia } = useVentas()

  const [monto, setMonto] = useState('')
  const [monedaRecarga, setMonedaRecarga] = useState(isCliente ? 'bs' : 'usd')
  const [metodoId, setMetodoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [alert, setAlert] = useState(null) // { type, message }
  
  // Admin specific states
  const [pendingRecargas, setPendingRecargas] = useState([])
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  const fetchPendingRecargas = async () => {
    if (!isAdmin) return
    setLoadingAdmin(true)
    const { data: rawRecargas } = await supabase
      .from('billetera_recargas')
      .select('*, metodos_pago(nombre)')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })

    if (rawRecargas && rawRecargas.length > 0) {
      const userIds = [...new Set(rawRecargas.map(r => r.auth_user_id))]
      const { data: usersData } = await supabase
        .from('clientes')
        .select('auth_user_id, nombres, apellidos, nickname')
        .in('auth_user_id', userIds)
      const userMap = new Map((usersData || []).map(u => [u.auth_user_id, u]))
      setPendingRecargas(rawRecargas.map(r => ({ ...r, clientes: userMap.get(r.auth_user_id) })))
    } else {
      setPendingRecargas([])
    }
    setLoadingAdmin(false)
  }

  useEffect(() => {
    if (isAdmin) fetchPendingRecargas()
  }, [isAdmin])

  // Suscripción Realtime para transacciones de billetera (Actualiza el historial en vivo)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`wallet_activity_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'billetera_transacciones',
        filter: `auth_user_id=eq.${user.id}`
      }, () => {
        console.log("♻️ Nuevo movimiento detectado, refrescando historial...");
        refetch(); // Esta función viene de useWallet() y actualiza los datos
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_receipt.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(`receipts/${fileName}`, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(`receipts/${fileName}`)
      
      setComprobanteUrl(publicUrl)
    } catch (err) {
      setAlert({ type: 'error', message: 'Error al subir comprobante: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitRecarga = async (e) => {
    e.preventDefault()
    if (!monto || !metodoId || !referencia) {
      setAlert({ type: 'warning', message: 'Por favor completa todos los campos.' })
      return
    }

    setIsProcessing(true)
    try {
      // Validar referencia
      try {
        await verificarYRegistrarReferencia(referencia, monto, 'recarga')
      } catch (err) {
        if (err.message === 'Referencia Duplicada') {
          setAlert({ type: 'error', message: 'Esta referencia ya ha sido utilizada.' })
          setIsProcessing(false)
          return
        }
        throw err
      }

      const { error } = await solicitarRecarga(Number(monto), metodoId, referencia, comprobanteUrl, monedaRecarga)
      if (error) throw error

      setAlert({ type: 'success', message: 'Solicitud enviada con éxito. Se actualizará al ser verificada.' })
      setMonto('')
      setReferencia('')
      setMetodoId('')
      setComprobanteUrl(null)
      refetch()
    } catch (err) {
      setAlert({ type: 'error', message: 'Error al enviar solicitud: ' + err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProcesarRecarga = async (recargaId, status) => {
    try {
      if (status === 'aprobado') {
        const { data, error } = await supabase.rpc('aprobar_recarga_rpc', {
          p_recarga_id: recargaId,
          p_admin_id: perfil.id
        })
        if (error) throw error
      } else {
        await supabase
          .from('billetera_recargas')
          .update({ estado: 'rechazado', atendido_por_id: perfil.id, updated_at: new Date().toISOString() })
          .eq('id', recargaId)
      }

      setAlert({ type: 'success', message: `Recarga ${status} correctamente.` })
      fetchPendingRecargas()
      refetch()
    } catch (err) {
      setAlert({ type: 'error', message: 'Error al procesar: ' + err.message })
    }
  }

  const combinedHistory = useMemo(() => {
    const history = [
      ...transacciones
        .filter(t => !isCliente || t.moneda !== 'usd')
        .map(t => ({
          id: t.id, fecha: t.created_at, desc: t.descripcion,
          monto: t.monto, tipo: t.tipo, estado: 'completado', moneda: t.moneda || 'usd'
        })),
      ...recargas
        .filter(r => r.estado !== 'aprobado' && (!isCliente || r.moneda !== 'usd'))
        .map(r => ({
          id: r.id, fecha: r.created_at,
          desc: `Recarga (${r.metodos_pago?.nombre || 'Pago'})`,
          monto: r.monto, tipo: 'recarga', estado: r.estado, moneda: r.moneda || 'usd',
          ref: r.referencia_pago
        }))
    ]
    return history.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [transacciones, recargas, isCliente])

  if (loading) return <div className="loading-wallet">Cargando Billetera...</div>

  return (
    <div className="landing-wallet-container">
      <div className="wallet-header">
        <div className="wallet-title-area">
          <h2>Mi Billetera</h2>
          <p>Gestiona tu saldo y realiza recargas de forma segura.</p>
        </div>
        <button className="btn-close-wallet" onClick={onClose}>✕</button>
      </div>

      <div className="wallet-content-grid">
        {/* COLUMNA IZQUIERDA: SALDOS Y ACTIVIDAD */}
        <div className="wallet-main-col">
          {/* Tarjetas de Saldo */}
          <div className="balance-cards">
            {!isCliente && (
              <div className="balance-card usd">
                <div className="balance-label">SALDO DÓLARES</div>
                <div className="balance-value">{formatUSD(wallet?.saldo || 0)}</div>
                <div className="balance-icon">💵</div>
              </div>
            )}
            <div className="balance-card bs">
              <div className="balance-label">SALDO BOLÍVARES</div>
              <div className="balance-value">{formatBs(wallet?.saldo_bs || 0)}</div>
              <div className="balance-icon">🏦</div>
            </div>
          </div>

          {/* Gestión Admin (Si aplica) */}
          {isAdmin && pendingRecargas.length > 0 && (
            <div className="wallet-section admin-section">
              <div className="section-header">
                <h3>Recargas Pendientes</h3>
                <button className="btn-refresh" onClick={fetchPendingRecargas}>🔄</button>
              </div>
              <div className="pending-list">
                {pendingRecargas.map(r => (
                  <div key={r.id} className="pending-item">
                    <div className="item-info">
                      <div className="user-name">{r.clientes?.nickname || 'Usuario'}</div>
                      <div className="item-meta">{r.metodos_pago?.nombre} • Ref: {r.referencia_pago}</div>
                    </div>
                    <div className="item-amount" style={{ color: r.moneda === 'bs' ? '#a855f7' : '#00c853' }}>
                      {r.moneda === 'bs' ? formatBs(r.monto) : formatUSD(r.monto)}
                    </div>
                    <div className="item-actions">
                      <button className="btn-approve" onClick={() => handleProcesarRecarga(r.id, 'aprobado')}>✓</button>
                      <button className="btn-reject" onClick={() => handleProcesarRecarga(r.id, 'rechazado')}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          <div className="wallet-section">
            <div className="section-header">
              <h3>Actividad Reciente</h3>
            </div>
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedHistory.map(item => (
                    <tr key={item.id}>
                      <td data-label="Fecha">{new Date(item.fecha).toLocaleDateString()}</td>
                      <td data-label="Descripción">
                        <div className="history-desc">{item.desc}</div>
                        {item.ref && <div className="history-ref">Ref: {item.ref}</div>}
                      </td>
                      <td data-label="Monto" className={item.monto > 0 ? 'text-positive' : 'text-negative'}>
                        {item.monto > 0 ? '+' : ''}
                        {item.moneda === 'bs' ? formatBs(item.monto) : formatUSD(item.monto)}
                      </td>
                      <td data-label="Estado">
                        <span className={`status-badge ${item.estado}`}>
                          {item.estado === 'completado' ? 'Completado' : item.estado === 'pendiente' ? 'Pendiente' : 'Rechazado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {combinedHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-history">No hay movimientos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE RECARGA */}
        <aside className="wallet-sidebar">
          <div className="recharge-form-card">
            <h3>Cargar Saldo</h3>
            <p>Selecciona tu método y envía el reporte.</p>

            <form onSubmit={handleSubmitRecarga}>
              <div className="form-group">
                <label>Moneda</label>
                <div className="currency-selector">
                  {!isCliente && (
                    <button 
                      type="button" 
                      className={monedaRecarga === 'usd' ? 'active' : ''} 
                      onClick={() => setMonedaRecarga('usd')}
                    >USD</button>
                  )}
                  <button 
                    type="button" 
                    className={monedaRecarga === 'bs' ? 'active' : ''} 
                    onClick={() => setMonedaRecarga('bs')}
                  >BS</button>
                </div>
              </div>

              <div className="form-group">
                <label>Monto</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Método de Pago</label>
                <div className="methods-grid">
                  {metodos.filter(m => m.activo && (monedaRecarga === 'bs' ? m.habilitado_billetera_bs : m.habilitado_billetera)).map(m => (
                    <div 
                      key={m.id} 
                      className={`method-item ${metodoId === m.id ? 'active' : ''}`}
                      onClick={() => setMetodoId(m.id)}
                    >
                      <img src={m.icono_url || 'https://via.placeholder.com/40'} alt="" />
                      <span>{m.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>

              {metodoId && (
                <div className="payment-details fade-in">
                  <div className="details-header">Datos para el pago:</div>
                  <pre className="details-text">{metodos.find(m => m.id === metodoId)?.datos}</pre>
                  <button 
                    type="button" 
                    className="btn-copy" 
                    onClick={() => navigator.clipboard.writeText(metodos.find(m => m.id === metodoId)?.datos)}
                  >
                    Copiar Datos
                  </button>
                </div>
              )}

              <div className="form-group">
                <label>Número de Referencia</label>
                <input 
                  type="text" 
                  placeholder="Últimos 6 dígitos"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value.replace(/\D/g, '').slice(-6))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Comprobante (Opcional)</label>
                <div className="upload-box">
                  {comprobanteUrl ? (
                    <img src={comprobanteUrl} alt="Comprobante" className="preview-img" />
                  ) : (
                    <div className="upload-placeholder">
                      <span>📤</span>
                      <small>{uploading ? 'Subiendo...' : 'Subir imagen'}</small>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                </div>
              </div>

              {alert && (
                <div className={`alert-inline ${alert.type}`}>
                  {alert.message}
                </div>
              )}

              <button type="submit" className="btn-submit-recharge" disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Enviar Reporte'}
              </button>
            </form>
          </div>
        </aside>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .landing-wallet-container {
          background: var(--bg-card);
          border-radius: 24px;
          padding: 30px;
          color: var(--text-main);
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          border: 1px solid var(--border);
          animation: fadeIn 0.4s ease-out;
          width: 100%;
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .wallet-title-area h2 {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 4px 0;
          background: linear-gradient(135deg, #00d2ff, var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .wallet-title-area p {
          color: var(--text-muted);
          margin: 0;
          font-size: 14px;
        }

        .btn-close-wallet {
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

        .btn-close-wallet:hover {
          background: #ef4444;
          color: white;
          transform: rotate(90deg);
        }

        .wallet-content-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 30px;
        }

        .balance-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .balance-card {
          padding: 24px;
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--border);
          transition: transform 0.3s;
        }

        .balance-card:hover {
          transform: translateY(-5px);
        }

        .balance-card.usd {
          background: linear-gradient(135deg, rgba(0, 200, 83, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
          border-color: rgba(0, 200, 83, 0.3);
        }

        .balance-card.bs {
          background: linear-gradient(135deg, rgba(123, 47, 247, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
          border-color: rgba(123, 47, 247, 0.3);
        }

        .balance-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .balance-value {
          font-size: 32px;
          font-weight: 900;
          color: var(--text-main);
          word-break: break-all;
          line-height: 1.1;
        }

        .balance-icon {
          position: absolute;
          right: 20px;
          bottom: 20px;
          font-size: 40px;
          opacity: 0.2;
        }

        .wallet-section {
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .history-table-wrapper {
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
        }

        .history-table th {
          text-align: left;
          font-size: 12px;
          color: var(--text-muted);
          padding: 12px;
          border-bottom: 1px solid var(--border);
        }

        .history-table td {
          padding: 12px 8px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          word-break: break-word;
        }

        .history-desc {
          font-weight: 600;
          font-size: 14px;
        }

        .history-ref {
          font-size: 11px;
          color: var(--text-muted);
        }

        .text-positive { color: #00c853; font-weight: 700; }
        .text-negative { color: #ff5252; font-weight: 700; }

        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-badge.completado { background: rgba(0, 200, 83, 0.1); color: #00c853; }
        .status-badge.pendiente { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.rechazado { background: rgba(255, 82, 82, 0.1); color: #ff5252; }

        .empty-history {
          text-align: center;
          padding: 40px;
          color: var(--text-muted);
          font-style: italic;
        }

        /* SIDEBAR / FORM */
        .recharge-form-card {
          background: var(--bg-hover);
          border-radius: 20px;
          padding: 24px;
          border: 1px solid var(--border);
          position: sticky;
          top: 100px;
        }

        .recharge-form-card h3 { margin: 0 0 4px 0; font-size: 20px; }
        .recharge-form-card p { font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0; }

        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-muted); }

        .currency-selector {
          display: flex;
          gap: 10px;
          background: rgba(0,0,0,0.1);
          padding: 4px;
          border-radius: 12px;
        }

        .currency-selector button {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .currency-selector button.active {
          background: var(--accent);
          color: white;
          box-shadow: 0 4px 10px rgba(123, 47, 247, 0.3);
        }

        .recharge-form-card input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-main);
          outline: none;
          font-size: 16px;
          font-weight: 700;
        }

        .recharge-form-card input:focus {
          border-color: var(--accent);
        }

        .methods-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .method-item {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .method-item:hover { border-color: var(--accent); transform: translateY(-2px); }
        .method-item.active { border-color: var(--accent); background: var(--accent-light); }
        .method-item img { width: 32px; height: 32px; object-fit: contain; }
        .method-item span { font-size: 10px; font-weight: 700; text-align: center; }

        .payment-details {
          margin-top: 15px;
          padding: 15px;
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          border: 1px dashed var(--accent);
        }

        .details-header { font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
        .details-text { font-size: 12px; color: var(--text-main); white-space: pre-wrap; font-family: monospace; margin: 0; }
        .btn-copy {
          margin-top: 10px;
          width: 100%;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--accent);
          background: transparent;
          color: var(--accent);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .upload-box {
          height: 100px;
          border: 2px dashed var(--border);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }

        .upload-placeholder { text-align: center; }
        .upload-placeholder span { font-size: 24px; display: block; }
        .upload-placeholder small { font-size: 11px; color: var(--text-muted); }
        .preview-img { width: 100%; height: 100%; object-fit: cover; }
        .upload-box input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

        .btn-submit-recharge {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          background: var(--accent);
          color: white;
          border: none;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          margin-top: 10px;
          transition: all 0.2s;
        }

        .btn-submit-recharge:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 10px 20px rgba(123, 47, 247, 0.4); }
        .btn-submit-recharge:disabled { opacity: 0.5; cursor: not-allowed; }

        .alert-inline {
          padding: 12px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 15px;
          text-align: center;
        }
        .alert-inline.success { background: rgba(0, 200, 83, 0.1); color: #00c853; border: 1px solid #00c853; }
        .alert-inline.error { background: rgba(255, 82, 82, 0.1); color: #ff5252; border: 1px solid #ff5252; }
        .alert-inline.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid #f59e0b; }

        /* ADMIN ITEM */
        .pending-item {
          display: flex;
          align-items: center;
          padding: 12px;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          margin-bottom: 10px;
          gap: 15px;
        }

        .item-info { flex: 1; }
        .user-name { font-weight: 700; font-size: 14px; }
        .item-meta { font-size: 11px; color: var(--text-muted); }
        .item-amount { font-weight: 800; font-size: 14px; }
        .item-actions { display: flex; gap: 8px; }
        .item-actions button {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }
        .btn-approve { background: #00c853; color: white; }
        .btn-reject { background: #ff5252; color: white; }
        .item-actions button:hover { transform: scale(1.1); }

        @media (max-width: 900px) {
          .landing-wallet-container { padding: 16px; border-radius: 16px; }
          .wallet-header { margin-bottom: 20px; padding-bottom: 12px; }
          .wallet-title-area h2 { font-size: 22px; }
          .wallet-content-grid { grid-template-columns: 1fr; gap: 20px; }
          .wallet-sidebar { order: 2; }
          .wallet-main-col { order: 1; }
          .recharge-form-card { position: static; padding: 15px; margin-top: 0; }
          .landing-wallet-container { padding: 15px; border-radius: 16px; }
          .balance-cards { grid-template-columns: 1fr; gap: 12px; }
          .balance-card { padding: 12px; }
          .balance-value { font-size: 22px; }
          .balance-icon { font-size: 26px; }
          
          .methods-grid { gap: 8px; }
          .history-table thead { display: none; }
          .history-table tr { 
            display: flex; 
            flex-direction: column; 
            padding: 12px; 
            border-bottom: 1px solid var(--border);
            gap: 4px;
          }
          .history-table td { 
            display: block; 
            padding: 0; 
            border: none; 
            text-align: left;
            width: 100% !important;
          }
          .history-table td::before {
            content: attr(data-label);
            font-size: 10px;
            color: var(--text-muted);
            text-transform: uppercase;
            display: block;
            margin-bottom: 2px;
          }
          .history-desc { font-size: 13px; font-weight: 500; }
          .status-badge { display: inline-block; }
          
          .methods-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 480px) {
          .methods-grid { grid-template-columns: repeat(2, 1fr); }
          .history-table-wrapper { margin: 0 -10px; padding: 0 10px; }
          .item-actions { flex-direction: column; }
        }
      `}} />
    </div>
  )
}
