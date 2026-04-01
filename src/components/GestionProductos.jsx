import React, { useState, useMemo } from 'react'
import { useJuegos, useProductos, useConfiguracion } from '../hooks/useData'
import { calcularPrecioVenta, formatUSD, formatBs, removeWhiteBackground } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'


export default function GestionProductos() {
  const { juegos, categorias, loading: loadingJuegos, createJuego, updateJuego, deleteJuego } = useJuegos()
  const { config, loading: loadingConfig } = useConfiguracion()
  const [selectedJuego, setSelectedJuego] = useState(null)
  const [searchJuego, setSearchJuego] = useState('')
  const { productos, loading: loadingProductos, createProducto, updateProducto, deleteProducto, reorderProductos } = useProductos(selectedJuego?.id)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGameModalOpen, setIsGameModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState(null) // { type, title, message, onConfirm }

  // Formulario de nuevo/editar juego
  const [formGame, setFormGame] = useState({
    id: null,
    nombre: '',
    categoria_id: '',
    tipo_calculo: 'estandar',
    metodo_recarga: 'id_jugador',
    guia_id_url: null
  })

  const juegosFiltrados = useMemo(() => {
    if (!searchJuego.trim()) return juegos
    return juegos.filter(j => j.nombre.toLowerCase().includes(searchJuego.toLowerCase()))
  }, [juegos, searchJuego])

  React.useEffect(() => {
    if (categorias.length > 0 && !formGame.categoria_id) {
      setFormGame(prev => ({...prev, categoria_id: categorias[0].id}))
    }
  }, [categorias])

  const handleOpenGameModal = () => {
    setFormGame({
      id: null,
      nombre: '',
      categoria_id: categorias[0]?.id || '',
      tipo_calculo: 'estandar',
      metodo_recarga: 'id_jugador',
      guia_id_url: null
    })
    setIsGameModalOpen(true)
  }

  const handleEditJuego = () => {
    if (!selectedJuego) return
    setFormGame({
      id: selectedJuego.id,
      nombre: selectedJuego.nombre,
      categoria_id: selectedJuego.categoria_id,
      tipo_calculo: selectedJuego.tipo_calculo,
      metodo_recarga: selectedJuego.metodo_recarga || 'id_jugador',
      guia_id_url: selectedJuego.guia_id_url || null
    })
    setIsGameModalOpen(true)
  }

  const handleGameSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    let res;
    if (formGame.id) {
      res = await updateJuego(formGame.id, {
        nombre: formGame.nombre,
        categoria_id: formGame.categoria_id,
        tipo_calculo: formGame.tipo_calculo,
        metodo_recarga: formGame.metodo_recarga,
        guia_id_url: formGame.guia_id_url
      })
      if (!res.error) {
        setSelectedJuego(prev => ({...prev, ...formGame}))
      }
    } else {
      const { id: _ignored, ...gamePayload } = formGame
      res = await createJuego(gamePayload)
    }

    if (res.error) setAlertModal({ type: 'error', message: "Error: " + res.error.message })
    setSaving(false)
    setIsGameModalOpen(false)
  }

  const handleDeleteJuego = async () => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Servicio',
      message: `¿Estás seguro de que quieres eliminar TODO el servicio de "${selectedJuego.nombre}" y deshabilitar sus paquetes?`,
      onConfirm: async () => {
        setSaving(true)
        await deleteJuego(selectedJuego.id)
        setSelectedJuego(null)
        setSaving(false)
        setAlertModal(null)
      }
    })
  }

  // Formulario de nuevo/editar producto
  const [formData, setFormData] = useState({
    id: null,
    nombre: '',
    costo_base: '',
    margen_ganancia: '',
    icono_url: null,
    descuento_revendedor: ''
  })
  const [newIconFile, setNewIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(null)
  const [draggedIndex, setDraggedIndex] = useState(null)
  
  // Vista previa calculada
  const previewPrecio = () => {
    if (!selectedJuego || !config) return null
    if (!formData.costo_base || formData.costo_base === '') return null
    
    // Convertir el margen que el usuario escribe (ej. 30%) a decimal (0.30)
    const margenDecimal = formData.margen_ganancia ? parseFloat(formData.margen_ganancia) / 100 : 0
    
    return calcularPrecioVenta(
      { 
        costo_base: parseFloat(formData.costo_base), 
        margen_ganancia: margenDecimal 
      },
      selectedJuego,
      config
    )
  }

  const handleOpenModal = () => {
    setFormData({ id: null, nombre: '', costo_base: '', margen_ganancia: '30', icono_url: null, descuento_revendedor: '' })
    setNewIconFile(null)
    setIconPreview(null)
    setIsModalOpen(true)
  }

  const handleEditProducto = (prod) => {
    setFormData({
      id: prod.id,
      nombre: prod.nombre,
      costo_base: prod.costo_base,
      margen_ganancia: prod.margen_ganancia * 100,
      icono_url: prod.icono_url,
      descuento_revendedor: prod.descuento_revendedor || ''
    })
    setNewIconFile(null)
    setIconPreview(prod.icono_url)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      let finalIconUrl = formData.icono_url

      // Si hay un nuevo archivo seleccionado, procesarlo y subirlo
      if (newIconFile) {
        const pngBlob = await removeWhiteBackground(newIconFile)
        const fileName = `prod-new-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, pngBlob, { contentType: 'image/png' })
        
        if (uploadError) throw new Error('Error subiendo ícono: ' + uploadError.message)
        
        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalIconUrl = data.publicUrl
      }

      const margenDecimal = parseFloat(formData.margen_ganancia) / 100
      const descRevendedor = formData.descuento_revendedor !== '' ? parseFloat(formData.descuento_revendedor) : null
      const payload = {
        nombre: formData.nombre,
        costo_base: parseFloat(formData.costo_base),
        margen_ganancia: margenDecimal,
        icono_url: finalIconUrl,
        descuento_revendedor: descRevendedor
      }

      if (formData.id) {
        await updateProducto(formData.id, payload)
      } else {
        await createProducto(payload)
      }

      setIsModalOpen(false)
    } catch (err) {
      setAlertModal({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, nombre) => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Paquete',
      message: `¿Estás seguro que quieres eliminar "${nombre}"?`,
      onConfirm: async () => {
        await deleteProducto(id)
        setAlertModal(null)
      }
    })
  }

  const handleMoveProduct = async (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= productos.length) return
    const current = productos[index]
    const target = productos[newIndex]
    
    // Optimistic local update for smoother feel
    const newProductos = [...productos]
    const [moved] = newProductos.splice(index, 1)
    newProductos.splice(newIndex, 0, moved)
    
    // Update DB
    await reorderProductos([
      { id: current.id, orden: newIndex },
      { id: target.id, orden: index }
    ])
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Optional: set a transparent image or style
    e.currentTarget.style.opacity = '0.5'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    // No action during drag over for simplicity, wait for drop
  }

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
       setDraggedIndex(null)
       return
    }

    const current = productos[draggedIndex]
    const target = productos[targetIndex]

    // Create a copy of the list and move the item
    const newList = [...productos]
    const [movedItem] = newList.splice(draggedIndex, 1)
    newList.splice(targetIndex, 0, movedItem)

    // Prepare batch update for database
    const updates = newList.map((item, idx) => ({
      id: item.id,
      orden: idx
    }))

    setDraggedIndex(null)
    await reorderProductos(updates)
  }

  const handleUploadProductIcon = async (e, prodId) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        setAlertModal({ type: 'error', message: 'La imagen no debe superar los 2MB' })
        return
      }
      setSaving(true)
      // Eliminar fondo blanco y convertir a PNG transparente
      const pngBlob = await removeWhiteBackground(file)
      const fileName = `prod-${prodId}-${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, pngBlob, { contentType: 'image/png' })
      if (uploadError) {
        setAlertModal({ type: 'error', message: 'Error subiendo imagen: ' + uploadError.message })
        setSaving(false)
        return
      }
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
      if (!data?.publicUrl) {
        setAlertModal({ type: 'error', message: 'Error al generar la URL de la imagen' })
        setSaving(false)
        return
      }
      await updateProducto(prodId, { icono_url: data.publicUrl })
      setSaving(false)
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error: ' + err.message })
      setSaving(false)
    } finally {
      e.target.value = null
    }
  }

  if (loadingJuegos || loadingConfig) {
    return (
      <div className="loading-page">
        <div className="spinner"></div><div>Cargando...</div>
      </div>
    )
  }

  const calculoRealTime = previewPrecio()

  const handleUploadLogo = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return

      if (file.size > 2 * 1024 * 1024) {
        setAlertModal({ type: 'error', message: "La imagen no debe superar los 2MB" })
        return
      }

      setSaving(true)
      
      // Eliminar fondo blanco y convertir a PNG transparente
      const pngBlob = await removeWhiteBackground(file)
      
      const fileName = `${selectedJuego.id}-${Date.now()}.png`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, pngBlob, { contentType: 'image/png' })

      if (uploadError) {
        setAlertModal({ type: 'error', message: 'Error subiendo imagen al storage: ' + uploadError.message })
        setSaving(false)
        return
      }

      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      if (!data || !data.publicUrl) {
         setAlertModal({ type: 'error', message: "La imagen subió pero falló al generar la URL." })
         setSaving(false)
         return
      }

      const { error: updateError } = await updateJuego(selectedJuego.id, { icono_url: data.publicUrl })
      if (updateError) {
         setAlertModal({ type: 'error', message: 'Error al guardar en la base de datos: ' + updateError.message })
         setSaving(false)
         return
      }

      setSelectedJuego(prev => ({ ...prev, icono_url: data.publicUrl }))
      setSaving(false)
    } catch (err) {
      setAlertModal({ type: 'error', message: "Error inesperado en el código: " + err.message })
      setSaving(false)
    } finally {
      // Limpiamos el input file para permitir seleccionar la misma imagen
      e.target.value = null
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Gestión de Productos</h1>
        <p className="page-subtitle">Añade o elimina los paquetes de cada juego y establece su rentabilidad.</p>
      </div>

      <div className="page-content responsive-grid-2col" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 3fr', gap: '24px' }}>
        
        {/* LISTA DE JUEGOS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: '20px 20px 10px', margin: 0, borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Juegos</h2>
              <button className="btn btn-ghost btn-sm" onClick={handleOpenGameModal} title="Añadir Juego">+</button>
            </div>
            <div className="search-box" style={{ width: '100%', marginBottom: '4px' }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-input"
                placeholder="Buscar juego..."
                value={searchJuego}
                onChange={(e) => setSearchJuego(e.target.value)}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {juegosFiltrados.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-text">No se encontraron juegos</div>
              </div>
            ) : (
              juegosFiltrados.map(juego => (
                <div
                  key={juego.id}
                  className={`nav-item ${selectedJuego?.id === juego.id ? 'active' : ''}`}
                  style={{ padding: '14px 20px', margin: 0, borderRadius: 0, borderBottom: '1px solid var(--border-color)' }}
                  onClick={() => setSelectedJuego(juego)}
                >
                  {juego.nombre}
                </div>
              ))
            )}
          </div>
        </div>

        {/* LISTA DE PAQUETES/PRODUCTOS */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedJuego ? (
            <div className="empty-state">
              <div className="empty-state-icon">👈</div>
              <div className="empty-state-text">Selecciona un juego a la izquierda</div>
              <div className="empty-state-sub">Podrás ver sus paquetes y agregar nuevos.</div>
            </div>
          ) : (
            <>
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div 
                    title="Cambiar logo del juego"
                    style={{ 
                      width: 60, height: 60, borderRadius: 12, backgroundColor: 'var(--bg-panel)',
                      border: '1px dashed var(--border-active)', cursor: 'pointer',
                      display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                      position: 'relative'
                    }}
                    onClick={() => document.getElementById('game-logo-upload').click()}
                  >
                    {selectedJuego.icono_url ? (
                      <img src={selectedJuego.icono_url} alt={selectedJuego.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 24, color: 'var(--text-muted)' }}>🎮</span>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>
                      Editar
                    </div>
                  </div>
                  <div>
                    <h2 className="card-title" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
                      Paquetes de {selectedJuego.nombre}
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'none', marginTop: 4 }}>
                      Fórmula base: {selectedJuego.tipo_calculo}
                    </p>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="game-logo-upload" 
                  accept="image/png, image/jpeg, image/webp" 
                  style={{ display: 'none' }} 
                  onChange={handleUploadLogo} 
                />
                <div className="flex gap-8">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={handleEditJuego} title="Editar Configuración del Juego">
                    ✏️
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={handleDeleteJuego} title="Eliminar Juego">
                    🗑️
                  </button>
                  <button className="btn btn-primary" onClick={handleOpenModal}>
                    + Añadir Paquete
                  </button>
                </div>
              </div>

              {loadingProductos ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner"></div></div>
              ) : productos.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-text">No hay paquetes para {selectedJuego.nombre}</div>
                  <div className="empty-state-sub">Haz clic en Añadir Paquete arriba para empezar.</div>
                </div>
              ) : (
                <div className="table-container" style={{ flex: 1 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Orden</th>
                        <th>Paquete</th>
                        <th>Costo (USD)</th>
                        <th>Margen (%)</th>
                        <th>Precio Venta (USD)</th>
                        <th>Precio (Bs)</th>
                        <th>Ganancia Neta</th>
                        <th>Desc. Revend.</th>
                        <th style={{ width: 80 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((prod, idx) => {
                        const precio = calcularPrecioVenta(prod, selectedJuego, config)
                        const isDragging = draggedIndex === idx
                        return (
                          <tr 
                            key={prod.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={(e) => {
                               e.currentTarget.style.opacity = '1'
                               setDraggedIndex(null)
                            }}
                            style={{ 
                               cursor: 'move',
                               backgroundColor: isDragging ? 'rgba(0, 210, 255, 0.05)' : 'transparent',
                               opacity: isDragging ? 0.5 : 1,
                               transition: 'background-color 0.2s'
                            }}
                          >
                            <td>
                              <div className="flex gap-4" style={{ justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ fontSize: 16, cursor: 'grab', marginRight: 4, color: 'var(--text-muted)' }} title="Arrastrar para reordenar">☰</div>
                                <div className="flex flex-column gap-2">
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    onClick={() => handleMoveProduct(idx, -1)}
                                    disabled={idx === 0}
                                    title="Subir"
                                    style={{ opacity: idx === 0 ? 0.25 : 1, fontSize: 10, padding: '1px 3px', minWidth: 'auto', height: '18px' }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    onClick={() => handleMoveProduct(idx, 1)}
                                    disabled={idx === productos.length - 1}
                                    title="Bajar"
                                    style={{ opacity: idx === productos.length - 1 ? 0.25 : 1, fontSize: 10, padding: '1px 3px', minWidth: 'auto', height: '18px' }}
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-8">
                                <div
                                  title="Cambiar ícono del paquete"
                                  style={{
                                    width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--bg-panel)',
                                    border: '1px dashed var(--border-active)', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    overflow: 'hidden', flexShrink: 0
                                  }}
                                  onClick={() => document.getElementById(`prod-icon-${prod.id}`).click()}
                                >
                                  {prod.icono_url ? (
                                    <img src={prod.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                  ) : (
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📦</span>
                                  )}
                                </div>
                                <input
                                  type="file"
                                  id={`prod-icon-${prod.id}`}
                                  accept="image/png, image/jpeg, image/webp"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleUploadProductIcon(e, prod.id)}
                                />
                                <span className="font-bold">{prod.nombre}</span>
                              </div>
                            </td>
                            <td>{formatUSD(prod.costo_base)}</td>
                            <td><span className="badge badge-info">{prod.margen_ganancia * 100}%</span></td>
                            <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{formatUSD(precio.venta_usd)}</td>
                            <td style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{formatBs(precio.venta_bs)}</td>
                            <td style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>{formatUSD(precio.ganancia_usd)}</td>
                            <td>
                              {prod.descuento_revendedor ? (
                                <span className="badge badge-success" style={{ fontSize: '11px' }}>{prod.descuento_revendedor}%</span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Global</span>
                              )}
                            </td>
                            <td>
                              <div className="flex gap-8">
                                <button 
                                  className="btn btn-ghost btn-icon btn-sm"
                                  onClick={() => handleEditProducto(prod)}
                                  title={`Editar ${prod.nombre}`}
                                >
                                  ✏️
                                </button>
                                <button 
                                  className="btn btn-danger btn-icon btn-sm"
                                  onClick={() => handleDelete(prod.id, prod.nombre)}
                                  title={`Eliminar ${prod.nombre}`}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* MODAL CREAR PRODUCTO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">{formData.id ? `Editar paquete en ${selectedJuego?.nombre}` : `Añadir a ${selectedJuego?.nombre}`}</h2>
            <form onSubmit={handleSubmit}>
              {/* SECTOR DE ÍCONO */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div 
                  onClick={() => document.getElementById('modal-icon-upload').click()}
                  style={{
                    width: 80, height: 80, borderRadius: 16, backgroundColor: 'var(--bg-panel)',
                    border: '2px dashed var(--accent-primary)', cursor: 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden', position: 'relative', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24 }}>📥</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Ícono</div>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 9, padding: '2px 0', textAlign: 'center' }}>
                    Click para cambiar
                  </div>
                </div>
                <input 
                  type="file" 
                  id="modal-icon-upload" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) {
                      setNewIconFile(file)
                      setIconPreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre del Paquete</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 110 Diamantes"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  required 
                />
              </div>
              
              <div className="flex gap-16">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Costo tu proveedor ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    placeholder="0.00"
                    value={formData.costo_base}
                    onChange={e => setFormData({...formData, costo_base: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Margen a ganar (%)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="30"
                    value={formData.margen_ganancia}
                    onChange={e => setFormData({...formData, margen_ganancia: e.target.value})}
                    required 
                  />
                </div>
              </div>

              {/* DESCUENTO PARA REVENDEDORES */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Descuento Revendedor (%)
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Opcional - Prevalece sobre el global)</span>
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0"
                  max="100"
                  className="form-input" 
                  placeholder="Dejar vacío para usar el descuento global del juego"
                  value={formData.descuento_revendedor}
                  onChange={e => setFormData({...formData, descuento_revendedor: e.target.value})}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Si se establece, este descuento será exclusivo para este paquete y NO se sumará al global del servicio.
                </p>
              </div>

              {/* VISTA PREVIA DEL CÁLCULO EN TIEMPO REAL */}
              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-active)', marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>Proyección del precio final al cliente</h4>
                {calculoRealTime ? (
                  <div className="flex justify-between items-center text-center">
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>Precio Venta USD</div>
                      <div className="font-bold" style={{ fontSize: 20, color: 'var(--text-primary)' }}>{formatUSD(calculoRealTime.venta_usd)}</div>
                    </div>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>Precio Final Bs</div>
                      <div className="font-bold" style={{ fontSize: 20, color: 'var(--accent-success)' }}>{formatBs(calculoRealTime.venta_bs)}</div>
                    </div>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>Tu Ganancia Neta</div>
                      <div className="font-bold" style={{ fontSize: 20, color: 'var(--accent-warning)' }}>{formatUSD(calculoRealTime.ganancia_usd)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted text-sm text-center">Escribe un costo para ver el cálculo...</div>
                )}
              </div>

              <div className="flex justify-between mt-24">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !formData.nombre || !formData.costo_base}>
                  {saving ? 'Guardando...' : formData.id ? 'Actualizar Paquete' : 'Guardar Paquete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR JUEGO */}
      {isGameModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Añadir Nuevo Servicio</h2>
            <form onSubmit={handleGameSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre (Ej: Free Fire, Netflix)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formGame.nombre}
                  onChange={e => setFormGame({...formGame, nombre: e.target.value})}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select 
                  className="form-input" 
                  value={formGame.categoria_id}
                  onChange={e => setFormGame({...formGame, categoria_id: e.target.value})}
                  required
                >
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fórmula de rentabilidad base</label>
                <select 
                  className="form-input" 
                  value={formGame.tipo_calculo}
                  onChange={e => setFormGame({...formGame, tipo_calculo: e.target.value})}
                >
                  <option value="estandar">1) Estándar: Costo + [Porcentaje %]</option>
                  <option value="paypal">2) PayPal: Costo - [Retención PayPal]</option>
                  <option value="descuento_doble">3) Descuento Doble (SmileOne)</option>
                  <option value="ref_cruzada">4) Ref Cruzada: Calculadora Multiplicador</option>
                  <option value="venta_fija">5) Venta Fija (Sin margen automático)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Método de Recarga</label>
                <select 
                  className="form-input" 
                  value={formGame.metodo_recarga}
                  onChange={e => setFormGame({...formGame, metodo_recarga: e.target.value})}
                >
                  <option value="id_jugador">🆔 ID del Jugador</option>
                  <option value="cuenta_completa">🔐 Correo y Clave</option>
                  <option value="usuario_clave">👤 Usuario y Clave</option>
                </select>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {formGame.metodo_recarga === 'id_jugador' 
                    ? 'Se le pedirá al cliente solo su ID identificador en el juego.' 
                    : formGame.metodo_recarga === 'cuenta_completa'
                    ? 'Se le pedirá al cliente su correo electrónico y contraseña del juego.'
                    : 'Se le pedirá al cliente su nombre de usuario y contraseña del juego.'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Captura de Guía ID/Cuenta
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Opcional)</span>
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ 
                    width: 70, height: 70, borderRadius: 8, backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    {formGame.guia_id_url ? (
                      <img src={formGame.guia_id_url} alt="Guia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 24, opacity: 0.3 }}>🖼️</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="file" 
                      id="guia-upload" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file) return
                        setSaving(true)
                        try {
                          const fileName = `guia-${Date.now()}.png`
                          const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file)
                          if (uploadError) throw uploadError
                          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
                          setFormGame(prev => ({ ...prev, guia_id_url: publicUrl }))
                        } catch (err) {
                          setAlertModal({ type: 'error', message: 'Error subiendo guía: ' + err.message })
                        } finally {
                          setSaving(false)
                        }
                      }}
                    />
                    <label htmlFor="guia-upload" className="btn btn-ghost btn-sm">
                      {saving ? 'Procesando...' : '📤 Subir Captura Guía'}
                    </label>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Esta imagen se mostrará al cliente cuando presione el ícono de ayuda.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-24">
                <button type="button" className="btn btn-ghost" onClick={() => setIsGameModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !formGame.nombre}>
                  {saving ? 'Guardando...' : formGame.id ? 'Actualizar Juego' : 'Crear Juego'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
