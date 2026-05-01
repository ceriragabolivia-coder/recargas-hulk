import React, { useState } from 'react'
import { useClientes, useAuth } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function Usuarios({ onNavigate }) {
  const { clientes, loading, updateProfileRoleAndDiscount, updateProfile, updateProfileStatus, ajustarSaldoWallet, ajustarSaldoWalletBs, resetUserPassword, refetch } = useClientes()
  const { perfil } = useAuth()
  
  const [editingRow, setEditingRow] = useState(null)
  const [editingData, setEditingData] = useState({})
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState(null)

  // Búsqueda y Paginación
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9

  // Estados para Billetera y Ajustes
  const [ajustandoCliente, setAjustandoCliente] = useState(null)
  const [nuevoSaldo, setNuevoSaldo] = useState('')
  const [nuevoSaldoBs, setNuevoSaldoBs] = useState('')
  const [notaAjuste, setNotaAjuste] = useState('')
  const [ajusteMoneda, setAjusteMoneda] = useState('usd') // 'usd' or 'bs'

  // Estados para ver Historial
  const [viendoMovimientos, setViendoMovimientos] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)
  
  // Estados para Restablecer Contraseña
  const [reseteandoPassword, setReseteandoPassword] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Estados para Configuración de Módulos (Negocio)
  const [configurandoModulos, setConfigurandoModulos] = useState(null)
  const [modulosSeleccionados, setModulosSeleccionados] = useState([])

  const MODULOS_DISPONIBLES = [
    { key: 'dashboard', label: '📊 Dashboard', desc: 'Vista general de estadísticas' },
    { key: 'ventas', label: '🛒 Registro de Ventas', desc: 'Punto de venta y caja' },
    { key: 'productos', label: '📦 Gestión de Productos', desc: 'Inventario y precios' },
    { key: 'reportes', label: '📈 Reportes', desc: 'Análisis de ventas' },
    { key: 'chats', label: '💬 Soporte', desc: 'Atención al cliente' },
    { key: 'pedidos', label: '📋 Gestión de Pedidos', desc: 'Cola de pedidos entrantes' }
  ]

  const formatFecha = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('es-VE', { 
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  const handleEditClick = (cliente) => {
    setEditingRow(cliente.id)
    setEditingData({
      rol: cliente.rol || 'cliente',
      porcentaje_descuento: cliente.porcentaje_descuento || 0,
      whatsapp: cliente.whatsapp || '',
      estado: cliente.estado || 'pendiente',
      config_modulos: cliente.config_modulos || []
    })
  }

  const handleQuickStatus = async (cliente, newStatus) => {
    setSaving(true)
    try {
      const { error } = await updateProfileStatus(cliente, newStatus)
      if (error) throw error
      await refetch()
    } catch (error) {
      setAlertModal({ type: 'error', message: "Error: " + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelClick = () => {
    setEditingRow(null)
    setEditingData({})
  }

  const handleSaveClick = async (cliente) => {
    setSaving(true)
    
    try {
      // Si cambia el rol o descuento (afecta a 'perfiles')
      if (cliente.auth_user_id) {
        const { error: errorProfile } = await updateProfileRoleAndDiscount(cliente.auth_user_id, {
          rol: editingData.rol,
          porcentaje_descuento: editingData.rol === 'revendedor' ? parseFloat(editingData.porcentaje_descuento || 0) : 0,
          estado: editingData.estado,
          config_modulos: editingData.rol === 'negocio' ? editingData.config_modulos : []
        })
        if (errorProfile) throw errorProfile
      }

      // Si cambia el whatsapp (afecta a 'clientes')
      if (cliente.whatsapp !== editingData.whatsapp) {
        if (cliente.auth_user_id) {
          const { error: errorCli } = await updateProfile(cliente.auth_user_id, { whatsapp: editingData.whatsapp })
          if (errorCli) throw errorCli
        }
      }

      await refetch()
      setEditingRow(null)
    } catch (error) {
      setAlertModal({ type: 'error', message: "Error al guardar: " + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleAbrirAjuste = (cliente) => {
    setAjustandoCliente(cliente)
    setNuevoSaldo(cliente.billetera_saldo || 0)
    setNuevoSaldoBs(cliente.billetera_saldo_bs || 0)
    setNotaAjuste('')
    setAjusteMoneda('usd')
  }

  const handleGuardarAjuste = async () => {
    const saldoActual = ajusteMoneda === 'bs' ? nuevoSaldoBs : nuevoSaldo;
    if (saldoActual === '' || parseFloat(saldoActual) < 0) {
      alert("Introduce un saldo válido mayor o igual a 0")
      return;
    }
    setSaving(true)
    const saldoNum = parseFloat(saldoActual);
    try {
      let result;
      if (ajusteMoneda === 'bs') {
        result = await ajustarSaldoWalletBs(
          ajustandoCliente.auth_user_id, 
          perfil.id, 
          saldoNum, 
          notaAjuste || `Ajuste manual de saldo Bs por administrador`
        )
      } else {
        result = await ajustarSaldoWallet(
          ajustandoCliente.auth_user_id, 
          perfil.id, 
          saldoNum, 
          notaAjuste || `Ajuste manual por administrador`
        )
      }
      
      if (result.error) throw result.error
      if (!result.data) throw new Error("No se pudo ejecutar el ajuste.")
      
      const label = ajusteMoneda === 'bs' ? formatBs(saldoNum) : formatUSD(saldoNum);
      setAlertModal({ type: 'success', message: `Saldo ${ajusteMoneda === 'bs' ? 'Bs' : 'USD'} ajustado correctamente a ${label}` })
      setAjustandoCliente(null)
      refetch()
    } catch (err) {
      setAlertModal({ type: 'error', message: "Error al ajustar billetera: " + err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres")
      return
    }
    
    setSaving(true)
    try {
      const { data, error } = await resetUserPassword(reseteandoPassword.auth_user_id, newPassword)
      
      if (error) throw error
      if (data && !data.success) throw new Error(data.error)
      
      setAlertModal({ 
        type: 'success', 
        message: `Contraseña de ${reseteandoPassword.nombres} se ha restablecido exitosamente.` 
      })
      setReseteandoPassword(null)
      setNewPassword('')
    } catch (err) {
      setAlertModal({ type: 'error', message: "Error al restablecer contraseña: " + err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleVerMovimientos = async (cliente) => {
    setViendoMovimientos(cliente)
    setLoadingMovimientos(true)
    
    // Obtener transacciones directamente (solo visible para admin, sin proxy)
    const { data } = await supabase
      .from('billetera_transacciones')
      .select('*')
      .eq('auth_user_id', cliente.auth_user_id)
      .order('created_at', { ascending: false })
      
    if (data) setMovimientos(data)
    setLoadingMovimientos(false)
  }

  // Lógica de filtrado y paginación
  const filteredClientes = clientes.filter(c => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (c.nombres && c.nombres.toLowerCase().includes(term)) ||
      (c.apellidos && c.apellidos.toLowerCase().includes(term)) ||
      (c.whatsapp && c.whatsapp.toLowerCase().includes(term)) ||
      (c.usuario && c.usuario.toLowerCase().includes(term))
    )
  })

  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentClientes = filteredClientes.slice(indexOfFirstItem, indexOfLastItem)

  return (
    <div className="page-content" style={{ maxWidth: '100%', padding: '0 24px', margin: '0 auto' }}>
      <div className="page-header mb-24" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="page-subtitle">Administra los roles, permisos y descuentos de los miembros de la plataforma</p>
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="🔍 Buscar nombre, teléfono o correo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1) // Volver a la página 1 al buscar
            }}
            style={{ paddingLeft: '32px', borderRadius: '20px' }}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando usuarios...
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Contacto</th>
                  <th>País</th>
                  <th>Billetera</th>
                  <th>Registro & Actividad</th>
                  <th>Estatus</th>
                  <th>Rol y Permisos</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentClientes.map(cliente => {
                  const isEditing = editingRow === cliente.id
                  return (
                    <tr key={cliente.id} style={{ backgroundColor: isEditing ? 'rgba(52, 152, 219, 0.05)' : 'transparent' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {cliente.nombres} {cliente.apellidos}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {cliente.nickname ? `@${cliente.nickname}` : 'Sin apodo'}
                        </div>
                      </td>
                      
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          📧 {cliente.usuario}
                        </div>
                        
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '13px' }}>📱</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '4px 8px', fontSize: '13px', width: '120px' }}
                              value={editingData.whatsapp}
                              onChange={(e) => setEditingData({...editingData, whatsapp: e.target.value})}
                              placeholder="+58 412..."
                            />
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            📱 {cliente.whatsapp || 'No registrado'}
                          </div>
                        )}
                      </td>
                      
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {cliente.pais || 'Venezuela'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-success)' }}>
                            💵 {formatUSD(cliente.billetera_saldo)}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7' }}>
                            🏦 {formatBs(cliente.billetera_saldo_bs)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '12px' }}>📅</span> {formatFecha(cliente.fecha_registro)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          Suscrito hace {Math.max(0, Math.floor((new Date() - new Date(cliente.fecha_registro)) / (1000 * 60 * 60 * 24)))} días
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>
                          <span style={{ opacity: 0.8 }}>Últ. acceso:</span> {cliente.ultima_conexion ? new Date(cliente.ultima_conexion).toLocaleString('es-VE', {dateStyle: 'short', timeStyle: 'short'}) : 'No registrado'}
                        </div>
                      </td>

                      <td>
                        {isEditing ? (
                          <select 
                            className="form-input" 
                            style={{ padding: '6px', fontSize: '12px', width: '120px' }}
                            value={editingData.estado}
                            onChange={(e) => setEditingData({...editingData, estado: e.target.value})}
                          >
                            <option value="aprobado">🟢 Aprobado</option>
                            <option value="pendiente">⏳ Pendiente</option>
                            <option value="rechazado">🔴 Rechazado</option>
                            <option value="suspendido">🚫 Suspendido</option>
                            <option value="baneado">💀 Baneado</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              display: 'inline-block',
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '11px', 
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              backgroundColor: 
                                cliente.estado === 'aprobado' ? 'rgba(34, 197, 94, 0.15)' : 
                                cliente.estado === 'pendiente' ? 'rgba(234, 179, 8, 0.15)' : 
                                cliente.estado === 'rechazado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                              color: 
                                cliente.estado === 'aprobado' ? '#22c55e' : 
                                cliente.estado === 'pendiente' ? '#eab308' : 
                                cliente.estado === 'rechazado' ? '#ef4444' : '#9ca3af',
                              border: `1px solid ${
                                cliente.estado === 'aprobado' ? 'rgba(34, 197, 94, 0.3)' : 
                                cliente.estado === 'pendiente' ? 'rgba(234, 179, 8, 0.3)' : 
                                cliente.estado === 'rechazado' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(156, 163, 175, 0.3)'
                              }`
                            }}>
                              {cliente.estado === 'aprobado' ? 'Aprobado' : 
                               cliente.estado === 'pendiente' ? 'Pendiente' : 
                               cliente.estado === 'rechazado' ? 'Rechazado' : 
                               cliente.estado === 'suspendido' ? 'Suspendido' : 'Baneado'}
                            </span>
                            
                            {!isEditing && cliente.estado === 'pendiente' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button 
                                  onClick={() => handleQuickStatus(cliente, 'aprobado')}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                                  title="Aprobar rápidamente"
                                >✅</button>
                                <button 
                                  onClick={() => handleQuickStatus(cliente, 'rechazado')}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                                  title="Rechazar rápidamente"
                                >❌</button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ minWidth: '220px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <select 
                              className="form-input" 
                              style={{ padding: '6px', fontSize: '13px', width: '100%' }}
                              value={editingData.rol}
                              onChange={(e) => setEditingData({...editingData, rol: e.target.value})}
                            >
                              <option value="cliente">👤 Cliente</option>
                              <option value="revendedor">⭐ Revendedor</option>
                              <option value="negocio">🏢 Negocio (Punto de Venta)</option>
                              <option value="admin">👑 Administrador</option>
                            </select>

                            {editingData.rol === 'negocio' && (
                              <button 
                                className="btn btn-sm"
                                style={{ width: '100%', fontSize: '11px', backgroundColor: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,210,255,0.2)' }}
                                onClick={() => {
                                  setConfigurandoModulos(cliente)
                                  setModulosSeleccionados(editingData.config_modulos || [])
                                }}
                              >
                                ⚙️ Configurar Módulos
                              </button>
                            )}

                            {editingData.rol === 'revendedor' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Descuento:</span>
                                <div style={{ position: 'relative', width: '80px' }}>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ padding: '4px 20px 4px 8px', fontSize: '13px' }}
                                    value={editingData.porcentaje_descuento}
                                    onChange={(e) => setEditingData({...editingData, porcentaje_descuento: e.target.value})}
                                    min="0"
                                    max="100"
                                  />
                                  <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ 
                              display: 'inline-block',
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '12px', 
                              fontWeight: 600,
                              backgroundColor: cliente.rol === 'admin' ? 'rgba(156, 39, 176, 0.15)' : 
                                               cliente.rol === 'revendedor' ? 'rgba(255, 152, 0, 0.15)' : 
                                               cliente.rol === 'negocio' ? 'rgba(0, 210, 255, 0.15)' : 'rgba(52, 152, 219, 0.15)',
                              color: cliente.rol === 'admin' ? '#ce93d8' : 
                                     cliente.rol === 'revendedor' ? '#ffb74d' : 
                                     cliente.rol === 'negocio' ? 'var(--accent-primary)' : 'var(--accent-primary)'
                            }}>
                              {cliente.rol === 'admin' ? '👑 Administrador' : 
                               cliente.rol === 'revendedor' ? '⭐ Revendedor' : 
                               cliente.rol === 'negocio' ? '🏢 Negocio' : '👤 Cliente'}
                            </span>
                            
                            {cliente.rol === 'revendedor' && cliente.porcentaje_descuento > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{cliente.porcentaje_descuento}%</span> descuento aplicado
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '13px' }}
                              onClick={() => handleSaveClick(cliente)}
                              disabled={saving}
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button 
                              className="btn btn-ghost" 
                              style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--text-muted)' }}
                              onClick={handleCancelClick}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button 
                              className="btn btn-ghost"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => {
                                if (onNavigate) {
                                  onNavigate('chats', { targetClientId: cliente.auth_user_id })
                                }
                              }}
                              title={`Chat con ${cliente.nombres}`}
                            >
                              💬 Chat
                            </button>
                            <button 
                              className="btn btn-ghost"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => handleAbrirAjuste(cliente)}
                              title="Ajustar saldo de billetera"
                            >
                              💵 Saldo
                            </button>
                            <button 
                              className="btn btn-ghost"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              onClick={() => handleVerMovimientos(cliente)}
                              title="Ver movimientos de billetera"
                            >
                              📋 Historial
                            </button>
                             <button 
                               className="btn btn-ghost"
                               style={{ padding: '6px 10px', fontSize: '12px' }}
                               onClick={() => {
                                 setReseteandoPassword(cliente)
                                 setNewPassword('')
                                 setShowPassword(false)
                               }}
                               title="Restablecer contraseña"
                             >
                               🔑 Clave
                             </button>
                             <button 
                               className="btn btn-ghost"
                               style={{ padding: '6px 10px', fontSize: '12px' }}
                               onClick={() => handleEditClick(cliente)}
                               title="Editar usuario"
                             >
                               ✏️ Editar
                             </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredClientes.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      {searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredClientes.length)} de {filteredClientes.length} usuarios
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => {
                  // Mostrar solo +-2 páginas alrededor de la actual para no colapsar UI
                  if (num === 1 || num === totalPages || (num >= currentPage - 1 && num <= currentPage + 1)) {
                    return (
                      <button
                        key={num}
                        className={`btn btn-sm ${currentPage === num ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    )
                  }
                  if (num === currentPage - 2 || num === currentPage + 2) {
                    return <span key={num} style={{ color: 'var(--text-muted)' }}>...</span>
                  }
                  return null;
                })}
              </div>

              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Ajuste de Saldo */}
      {ajustandoCliente && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ backgroundColor: '#1a1d21', borderRadius: '24px', width: '100%', maxWidth: '450px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Ajustar Saldo de Billetera</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
              Modificando fondo de: <strong style={{color: '#fff'}}>{ajustandoCliente.nombres} {ajustandoCliente.apellidos}</strong>
            </p>

            {/* Selector de Moneda */}
            <div className="form-group mb-16">
              <label className="form-label">Moneda a Ajustar</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAjusteMoneda('usd')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer',
                    backgroundColor: ajusteMoneda === 'usd' ? 'rgba(0, 210, 255, 0.15)' : 'var(--bg-panel)',
                    border: `2px solid ${ajusteMoneda === 'usd' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    color: ajusteMoneda === 'usd' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: '13px', transition: 'all 0.2s ease'
                  }}
                >
                  💵 USD
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteMoneda('bs')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer',
                    backgroundColor: ajusteMoneda === 'bs' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-panel)',
                    border: `2px solid ${ajusteMoneda === 'bs' ? '#8b5cf6' : 'var(--border-color)'}`,
                    color: ajusteMoneda === 'bs' ? '#a855f7' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: '13px', transition: 'all 0.2s ease'
                  }}
                >
                  🏦 Bolívares
                </button>
              </div>
            </div>

            <div className="form-group mb-16">
              <label className="form-label">Saldo Actual ({ajusteMoneda === 'bs' ? 'Bs' : 'USD'})</label>
              <input type="text" className="form-input" style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: ajusteMoneda === 'bs' ? '#a855f7' : 'var(--accent-success)', fontWeight: 'bold' }} value={ajusteMoneda === 'bs' ? formatBs(ajustandoCliente.billetera_saldo_bs) : formatUSD(ajustandoCliente.billetera_saldo)} disabled />
            </div>

            <div className="form-group mb-16">
              <label className="form-label">Nuevo Saldo Exacto ({ajusteMoneda === 'bs' ? 'Bs' : 'USD'})</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                className="form-input" 
                value={ajusteMoneda === 'bs' ? nuevoSaldoBs : nuevoSaldo}
                onChange={(e) => ajusteMoneda === 'bs' ? setNuevoSaldoBs(e.target.value) : setNuevoSaldo(e.target.value)}
                placeholder={ajusteMoneda === 'bs' ? 'Ej. 500.00' : 'Ej. 50.00'}
                style={{ fontSize: '18px', fontWeight: 'bold' }}
              />
            </div>

            <div className="form-group mb-24">
              <label className="form-label">Motivo o Nota del Ajuste (Opcional)</label>
              <input 
                type="text" 
                className="form-input" 
                value={notaAjuste}
                onChange={(e) => setNotaAjuste(e.target.value)}
                placeholder="Ej. Corrección por fallo de sistema"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAjustandoCliente(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGuardarAjuste} disabled={saving}>{saving ? 'Procesando...' : 'Aplicar Ajuste'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ver Movimientos de Billetera */}
      {viendoMovimientos && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ backgroundColor: '#1a1d21', borderRadius: '24px', width: '100%', maxWidth: '700px', padding: '32px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '20px' }}>Historial Completo de Billetera</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setViendoMovimientos(null)}>✕ Cerrar</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              Transacciones del usuario: <strong style={{color: '#fff'}}>{viendoMovimientos.nombres} {viendoMovimientos.apellidos}</strong>
            </p>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
              {loadingMovimientos ? (
                <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando movimientos...</p>
              ) : movimientos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📭</span>
                  <p style={{ color: 'var(--text-muted)' }}>No hay movimientos registrados.</p>
                </div>
              ) : (
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: 'var(--bg-card)' }}>Fecha</th>
                      <th style={{ backgroundColor: 'var(--bg-card)' }}>Tipo</th>
                      <th style={{ backgroundColor: 'var(--bg-card)' }}>Descripción</th>
                      <th style={{ backgroundColor: 'var(--bg-card)', textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => (
                      <tr key={m.id}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('es-VE')}</td>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                            backgroundColor: m.tipo === 'ajuste_admin' ? 'rgba(156, 39, 176, 0.15)' : 'rgba(0, 210, 255, 0.1)',
                            color: m.tipo === 'ajuste_admin' ? '#ce93d8' : 'var(--text-primary)',
                            border: `1px solid ${m.tipo === 'ajuste_admin' ? 'rgba(156,39,176,0.3)' : 'transparent'}`
                          }}>
                            {m.tipo.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{m.descripcion}</td>
                        <td style={{ fontWeight: 800, textAlign: 'right', color: m.monto > 0 ? (m.moneda === 'bs' ? '#a855f7' : 'var(--accent-success)') : 'var(--accent-error)' }}>
                          {m.monto > 0 ? '+' : ''}{m.moneda === 'bs' ? formatBs(m.monto) : formatUSD(m.monto)}
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>{m.moneda === 'bs' ? 'Bs' : 'USD'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restablecer Contraseña */}
      {reseteandoPassword && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ backgroundColor: '#1a1d21', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Restablecer Contraseña</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
              Estableciendo nueva clave para: <strong style={{color: '#fff'}}>{reseteandoPassword.nombres} {reseteandoPassword.apellidos}</strong>
            </p>

            <div className="form-group mb-24">
              <label className="form-label">Nueva Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"}
                  className="form-input" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px'
                  }}
                >
                  {showPassword ? '👁️' : '🕶️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setReseteandoPassword(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResetPassword} disabled={saving}>{saving ? 'Procesando...' : 'Cambiar Clave'}</button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={() => setAlertModal(null)}
          onCancel={() => setAlertModal(null)}
        />
      )}

      {/* Modal Configuración de Módulos para Negocio */}
      {configurandoModulos && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ backgroundColor: '#1a1d21', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Configurar Accesos del Negocio</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
              Selecciona qué módulos tendrá activos <strong style={{color: '#fff'}}>{configurandoModulos.nombres}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {MODULOS_DISPONIBLES.map(mod => {
                const isActive = modulosSeleccionados.includes(mod.key)
                return (
                  <div 
                    key={mod.key}
                    onClick={() => {
                      if (isActive) setModulosSeleccionados(modulosSeleccionados.filter(k => k !== mod.key))
                      else setModulosSeleccionados([...modulosSeleccionados, mod.key])
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '16px',
                      backgroundColor: isActive ? 'rgba(0, 210, 255, 0.05)' : 'var(--bg-panel)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      width: '20px', height: '20px', borderRadius: '6px', 
                      border: `2px solid ${isActive ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                      transition: 'all 0.2s'
                    }}>
                      {isActive && <span style={{ color: '#000', fontWeight: 'bold', fontSize: '12px' }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isActive ? '#fff' : 'var(--text-muted)' }}>{mod.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mod.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfigurandoModulos(null)}>Cancelar</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={() => {
                  setEditingData({ ...editingData, config_modulos: modulosSeleccionados })
                  setConfigurandoModulos(null)
                }}
              >
                Confirmar Selección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
