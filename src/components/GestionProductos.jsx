import React, { useState, useMemo, useRef } from 'react'
import { useJuegos, useProductos, useConfiguracion, useProductoCodigos } from '../hooks/useData'
import { useAuth } from '../context/AuthContext'
import { calcularPrecioVenta, formatUSD, formatBs, removeWhiteBackground, getOptimizedImageUrl } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import { compressImage } from '../utils/imageCompression'
import AlertModal from './AlertModal'


export default function GestionProductos() {
  const { juegos, categorias, loading: loadingJuegos, createJuego, updateJuego, deleteJuego } = useJuegos()
  const { perfil } = useAuth()
  const { config, loading: loadingConfig } = useConfiguracion()
  const [selectedJuegoId, setSelectedJuegoId] = useState(null)
  const selectedJuego = useMemo(() => juegos.find(j => j.id === selectedJuegoId), [juegos, selectedJuegoId])
  const [searchJuego, setSearchJuego] = useState('')
  const { productos, categorias: allCategorias, loading: loadingProductos, error: errorProductos, createProducto, updateProducto, deleteProducto, toggleProducto, reorderProductos, createCategoria, updateCategoria, deleteCategoria } = useProductos(selectedJuego?.id)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGameModalOpen, setIsGameModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [saving, setSaving] = useState(false)
  const [alertModal, setAlertModal] = useState(null) // { type, title, message, onConfirm }
  const [shouldRemoveBg, setShouldRemoveBg] = useState(true)

  // Formulario de nuevo/editar juego
  const [formGame, setFormGame] = useState({
    id: null,
    nombre: '',
    categoria_id: '',
    tipo_calculo: 'estandar',
    metodo_recarga: 'id_jugador',
    guia_id_url: null,
    caracteristicas_tipo: 'Recarga (Automática)',
    caracteristicas_region: 'Global',
    caracteristicas_entrega: 'Inmediata',
    caracteristicas_nota: '',
    instrucciones_recarga: '',
    tutorial_video_url: '',
    tutorial_banner_texto: '',
    tutorial_banner_img: '',
    icono_url: null
  })

  const juegosFiltrados = useMemo(() => {
    if (!searchJuego.trim()) return juegos
    return juegos.filter(j => j.nombre.toLowerCase().includes(searchJuego.toLowerCase()))
  }, [juegos, searchJuego])

  React.useEffect(() => {
    if (allCategorias.length > 0 && !formGame.categoria_id) {
      setFormGame(prev => ({ ...prev, categoria_id: allCategorias[0].id }))
    }
  }, [allCategorias])

  const handleOpenGameModal = () => {
    setFormGame({
      id: null,
      nombre: '',
      categoria_id: allCategorias[0]?.id || '',
      tipo_calculo: 'estandar',
      metodo_recarga: 'id_jugador',
      guia_id_url: null,
      caracteristicas_tipo: 'Recarga (Automática)',
      caracteristicas_region: 'Global',
      caracteristicas_entrega: 'Inmediata',
      caracteristicas_nota: '',
      instrucciones_recarga: '',
      tutorial_video_url: '',
      tutorial_banner_texto: '',
      tutorial_banner_img: '',
      icono_url: null,
      verificacion_api_activa: false,
      verificacion_api_url: '',
      mostrar_precio_dual: false
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
      guia_id_url: selectedJuego.guia_id_url || null,
      caracteristicas_tipo: selectedJuego.caracteristicas_tipo || 'Recarga (Automática)',
      caracteristicas_region: selectedJuego.caracteristicas_region || 'Global',
      caracteristicas_entrega: selectedJuego.caracteristicas_entrega || 'Inmediata',
      caracteristicas_nota: selectedJuego.caracteristicas_nota || '',
      instrucciones_recarga: selectedJuego.instrucciones_recarga || '',
      tutorial_video_url: selectedJuego.tutorial_video_url || '',
      tutorial_banner_texto: selectedJuego.tutorial_banner_texto || '',
      tutorial_banner_img: selectedJuego.tutorial_banner_img || '',
      icono_url: selectedJuego.icono_url || null,
      verificacion_api_activa: selectedJuego.verificacion_api_activa === undefined 
        ? (selectedJuego.nombre.toLowerCase().includes('free fire') || selectedJuego.nombre.toLowerCase().includes('blood strike'))
        : !!selectedJuego.verificacion_api_activa,
      verificacion_api_url: selectedJuego.verificacion_api_url || '',
      mostrar_precio_dual: !!selectedJuego.mostrar_precio_dual
    })
    setIsGameModalOpen(true)
  }

  const handleToggleProcesamientoApi = async (nuevoValor) => {
    if (!selectedJuego) return
    await updateJuego(selectedJuego.id, { procesamiento_automatico_api: nuevoValor })
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
        guia_id_url: formGame.guia_id_url,
        caracteristicas_tipo: formGame.caracteristicas_tipo,
        caracteristicas_region: formGame.caracteristicas_region,
        caracteristicas_entrega: formGame.caracteristicas_entrega,
        caracteristicas_nota: formGame.caracteristicas_nota,
        instrucciones_recarga: formGame.instrucciones_recarga,
        tutorial_video_url: formGame.tutorial_video_url,
        tutorial_banner_texto: formGame.tutorial_banner_texto,
        tutorial_banner_img: formGame.tutorial_banner_img,
        icono_url: formGame.icono_url,
        verificacion_api_activa: formGame.verificacion_api_activa,
        verificacion_api_url: formGame.verificacion_api_url,
        mostrar_precio_dual: formGame.mostrar_precio_dual
      })
      if (!res.error) {
        // useJuegos hook will refresh the 'juegos' list automatically
      }
    } else {
      const { id: _ignored, ...gamePayload } = formGame
      res = await createJuego(gamePayload)
    }

    if (res.error) setAlertModal({ type: 'error', message: "Error: " + res.error.message })
    setSaving(false)
    setIsGameModalOpen(false)
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setSaving(true)
    const { error } = await createCategoria({ nombre: newCategoryName, activa: true, orden: allCategorias.length })
    if (error) setAlertModal({ type: 'error', message: "Error: " + error.message })
    else {
      setNewCategoryName('')
      setAlertModal({ type: 'success', message: 'Categoría creada con éxito' })
      setIsCategoryModalOpen(false)
    }
    setSaving(false)
  }

  const handleDeleteJuego = async () => {
    setAlertModal({
      type: 'confirm',
      title: 'Eliminar Servicio',
      message: `¿Estás seguro de que quieres eliminar TODO el servicio de "${selectedJuego.nombre}" y deshabilitar sus paquetes?`,
      onConfirm: async () => {
        setSaving(true)
        await deleteJuego(selectedJuego.id)
        setSelectedJuegoId(null)
        setSaving(false)
        setAlertModal(null)
      }
    })
  }

  const handleCloneJuego = async () => {
    if (!selectedJuego) return
    setAlertModal({
      type: 'confirm',
      title: 'Clonar Servicio',
      message: `¿Estás seguro que quieres clonar el servicio "${selectedJuego.nombre}" con todos sus paquetes?`,
      onConfirm: async () => {
        setSaving(true)
        try {
          // 1. Clonar el Juego
          const { id: _oldId, created_at: _ca, updated_at: _ua, ...gameData } = selectedJuego
          const clonePayload = {
            ...gameData,
            nombre: `${gameData.nombre} (Copia)`,
            activo: true
          }
          const { data: newGame, error: gameError } = await createJuego(clonePayload)
          if (gameError) throw gameError

          // 2. Obtener productos originales
          // Note: useProductos hook uses the selectedJuegoId, but we need the original ones.
          // Since we already have 'productos' from the hook (they belong to selectedJuego.id), we use them.
          if (productos && productos.length > 0) {
            const productsPayload = productos.map(({ id: _pId, created_at: _pca, updated_at: _pua, ...pData }) => ({
              ...pData,
              juego_id: newGame.id,
              activo: pData.activo !== false
            }))
            const { error: productsError } = await supabase.from('productos').insert(productsPayload)
            if (productsError) throw productsError
          }

          setAlertModal({ type: 'success', message: 'Servicio clonado con éxito' })
          setSelectedJuegoId(newGame.id)
        } catch (err) {
          setAlertModal({ type: 'error', message: 'Error al clonar: ' + err.message })
        } finally {
          setSaving(false)
        }
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
    descuento_revendedor: '',
    info_adicional_texto: '',
    info_adicional_imagen_url: '',
    entrega_automatica: false,
    tipo_producto: 'recarga',
    proveedor_api_id: ''
  })
  const [newIconFile, setNewIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(null)
  const [newInfoFile, setNewInfoFile] = useState(null)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [sincronizandoCosto, setSincronizandoCosto] = useState(false)
  const lastProveedorIdSincronizado = useRef(null)

  // Trae el costo (precio) del producto en el catálogo del proveedor TiendaGiftVen
  // y lo asigna automáticamente a costo_base, sobreescribiendo cualquier valor manual previo.
  const sincronizarCostoProveedor = async (proveedorApiId) => {
    const id = parseInt(proveedorApiId, 10)
    if (!id || isNaN(id)) return
    if (lastProveedorIdSincronizado.current === id) return
    const apiKey = config?.tiendagiftven_api_key
    if (!apiKey || apiKey === '0') {
      setAlertModal({ 
        type: 'error', 
        message: 'No se puede sincronizar el costo porque no has configurado la API Key de TiendaGiftVen. Ve al panel de "Proveedor API" para configurarla.' 
      })
      return
    }

    setSincronizandoCosto(true)
    try {
      const res = await fetch('/api/tiendagiftven/proxy?endpoint=productos', {
        headers: { 'X-API-Key': apiKey }
      })
      
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        throw new Error('La respuesta del servidor no es un JSON válido. Revisa la consola o la configuración del servidor.')
      }

      if (data.ok) {
        const prodProveedor = (data.productos || []).find(p => p.id === id)
        if (prodProveedor) {
          lastProveedorIdSincronizado.current = id
          setFormData(prev => ({ ...prev, costo_base: parseFloat(prodProveedor.precio) }))
        } else {
          setAlertModal({ type: 'error', message: `No se encontró el producto con ID ${id} en el catálogo del proveedor.` })
        }
      } else {
        setAlertModal({ type: 'error', message: data.error || 'Error consultando el catálogo del proveedor' })
      }
    } catch (err) {
      console.error('Error sincronizando costo del proveedor:', err)
      setAlertModal({ 
        type: 'error', 
        message: `Error al sincronizar costo: ${err.message}` 
      })
    } finally {
      setSincronizandoCosto(false)
    }
  }

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
    setFormData({ id: null, nombre: '', costo_base: '', margen_ganancia: '30', icono_url: null, descuento_revendedor: '', info_adicional_texto: '', info_adicional_imagen_url: null, entrega_automatica: false, tipo_producto: 'recarga', proveedor_api_id: '' })
    lastProveedorIdSincronizado.current = null
    setNewIconFile(null)
    setIconPreview(null)
    setNewInfoFile(null)
    setShouldRemoveBg(true) // Reset to default
    setIsModalOpen(true)
  }

  const handleEditProducto = (prod) => {
    setFormData({
      id: prod.id,
      nombre: prod.nombre,
      costo_base: prod.costo_base,
      margen_ganancia: prod.margen_ganancia * 100,
      icono_url: prod.icono_url,
      descuento_revendedor: prod.descuento_revendedor || '',
      info_adicional_texto: prod.info_adicional_texto || '',
      info_adicional_imagen_url: prod.info_adicional_imagen_url || null,
      entrega_automatica: prod.entrega_automatica || false,
      tipo_producto: prod.tipo_producto || 'recarga',
      proveedor_api_id: prod.proveedor_api_id || ''
    })
    lastProveedorIdSincronizado.current = prod.proveedor_api_id || null
    setNewIconFile(null)
    setIconPreview(prod.icono_url)
    setNewInfoFile(null)
    setIsModalOpen(true)
  }

  const handleDuplicateProducto = (prod) => {
    setFormData({
      id: null,
      nombre: `${prod.nombre} (Copia)`,
      costo_base: prod.costo_base,
      margen_ganancia: prod.margen_ganancia * 100,
      icono_url: prod.icono_url,
      descuento_revendedor: prod.descuento_revendedor || '',
      info_adicional_texto: prod.info_adicional_texto || '',
      info_adicional_imagen_url: prod.info_adicional_imagen_url || null,
      entrega_automatica: prod.entrega_automatica || false,
      tipo_producto: prod.tipo_producto || 'recarga',
      proveedor_api_id: prod.proveedor_api_id || ''
    })
    lastProveedorIdSincronizado.current = null
    setNewIconFile(null)
    setIconPreview(prod.icono_url)
    setNewInfoFile(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      let finalIconUrl = formData.icono_url
      let finalInfoUrl = formData.info_adicional_imagen_url

      // Si hay un nuevo archivo seleccionado, procesarlo y subirlo
      if (newIconFile) {
        let finalFile = newIconFile
        let contentType = newIconFile.type

        if (shouldRemoveBg) {
          finalFile = await removeWhiteBackground(newIconFile)
          contentType = 'image/png'
        }

        const fileName = `prod-new-${Date.now()}${shouldRemoveBg ? '.png' : ''}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, await compressImage(finalFile), { cacheControl: '31536000', upsert: true })

        if (uploadError) throw new Error('Error subiendo ícono: ' + uploadError.message)

        const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalIconUrl = data.publicUrl
      }

      if (newInfoFile) {
        const fileName = `prod-extra-${Date.now()}-${newInfoFile.name.replace(/\.[^/.]+$/, "")}.png`
        const { error: uploadErrorInfo } = await supabase.storage
          .from('logos')
          .upload(fileName, await compressImage(newInfoFile), { cacheControl: '31536000', upsert: true })
        
        if (uploadErrorInfo) throw new Error('Error subiendo imagen extra: ' + uploadErrorInfo.message)

        const { data: infoData } = supabase.storage.from('logos').getPublicUrl(fileName)
        finalInfoUrl = infoData.publicUrl
      }

      const margenDecimal = parseFloat(formData.margen_ganancia) / 100
      const descRevendedor = formData.descuento_revendedor !== '' ? parseFloat(formData.descuento_revendedor) : null
      const payload = {
        nombre: formData.nombre,
        costo_base: parseFloat(formData.costo_base),
        margen_ganancia: margenDecimal,
        icono_url: finalIconUrl,
        descuento_revendedor: descRevendedor,
        info_adicional_texto: formData.info_adicional_texto || null,
        info_adicional_imagen_url: finalInfoUrl,
        entrega_automatica: formData.entrega_automatica,
        tipo_producto: formData.tipo_producto,
        proveedor_api_id: formData.proveedor_api_id ? parseInt(formData.proveedor_api_id, 10) : null
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
        const { error } = await deleteProducto(id)
        if (error) {
          setAlertModal({ type: 'error', message: error.message })
        } else {
          setAlertModal(null)
        }
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
      
      let finalFile = file
      let contentType = file.type

      if (shouldRemoveBg) {
        finalFile = await removeWhiteBackground(file)
        contentType = 'image/png'
      }

      const fileName = `prod-${prodId}-${Date.now()}${shouldRemoveBg ? '.png' : ''}`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, await compressImage(finalFile), { cacheControl: '31536000', upsert: true })
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

      let finalFile = file
      let contentType = file.type

      if (shouldRemoveBg) {
        finalFile = await removeWhiteBackground(file)
        contentType = 'image/png'
      }

      const fileName = `${selectedJuego.id}-${Date.now()}${shouldRemoveBg ? '.png' : ''}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, await compressImage(finalFile), { cacheControl: '31536000', upsert: true })

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

      setSaving(false)
    } catch (err) {
      setAlertModal({ type: 'error', message: "Error inesperado en el código: " + err.message })
      setSaving(false)
    } finally {
      // Limpiamos el input file para permitir seleccionar la misma imagen
      e.target.value = null
    }
  }

  const iconosExistentes = Array.from(new Set(productos.filter(p => p?.icono_url).map(p => p.icono_url)));
  const infoImagesExistentes = Array.from(new Set(productos.filter(p => p?.info_adicional_imagen_url).map(p => p.info_adicional_imagen_url)));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Gestión de Productos</h1>
        <p className="page-subtitle">Añade o elimina los paquetes de cada juego y establece su rentabilidad.</p>
      </div>

      <div className="content-grid" style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden', padding: '24px 32px 32px' }}>
        {/* COLUMNA DE JUEGOS */}
        <div className="card juegos-column" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="section-header" style={{ marginBottom: '16px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Juegos</h2>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsCategoryModalOpen(true)} title="Gestionar Categorías">📁</button>
              <button className="btn btn-ghost btn-sm" onClick={handleOpenGameModal} title="Añadir Juego">+</button>
            </div>
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
                  onClick={() => setSelectedJuegoId(juego.id)}
                >
                  {juego.nombre}
                </div>
              ))
            )}
          </div>
        </div>

        {/* LISTA DE PAQUETES/PRODUCTOS */}
        <div className="card product-list-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
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
              <img src={getOptimizedImageUrl(selectedJuego.icono_url, 200)} alt={selectedJuego.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
        <div className="flex gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', opacity: 0.8, color: 'var(--text-muted)', marginRight: '8px' }}>
            <input 
              type="checkbox" 
              checked={shouldRemoveBg} 
              onChange={(e) => setShouldRemoveBg(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Auto-PNG (Quitar Fondo)
          </label>
          {/* Toggle: Procesamiento automático con API */}
          <label
            title="Cuando está activado, los pedidos de este juego/servicio se procesan automáticamente con la API del proveedor al verificarse el pago por el sistema APK, sin intervención del admin."
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '5px 10px', borderRadius: '20px',
              border: selectedJuego.procesamiento_automatico_api
                ? '1px solid rgba(0,210,255,0.5)'
                : '1px solid rgba(255,255,255,0.1)',
              backgroundColor: selectedJuego.procesamiento_automatico_api
                ? 'rgba(0,210,255,0.1)'
                : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s'
            }}
          >
            {/* Toggle switch custom */}
            <div
              onClick={() => handleToggleProcesamientoApi(!selectedJuego.procesamiento_automatico_api)}
              style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative',
                backgroundColor: selectedJuego.procesamiento_automatico_api ? '#00d2ff' : 'rgba(255,255,255,0.15)',
                transition: 'background-color 0.2s', cursor: 'pointer', flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 2,
                left: selectedJuego.procesamiento_automatico_api ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }} />
            </div>
            <span style={{
              fontSize: '11px',
              color: selectedJuego.procesamiento_automatico_api ? '#00d2ff' : 'var(--text-muted)',
              fontWeight: selectedJuego.procesamiento_automatico_api ? 700 : 400,
              transition: 'color 0.2s',
              whiteSpace: 'nowrap'
            }}>
              ⚡ Auto-procesar con API
            </span>
          </label>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={handleEditJuego} title="Editar Configuración del Juego">
            ✏️
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={handleCloneJuego} title="Clonar Servicio (Copia profunda)">
            📋
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={handleDeleteJuego} title="Eliminar Juego">
            🗑️
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            + Añadir Paquete
          </button>
        </div>
      </div>
      <input
        type="file"
        id="game-logo-upload"
        accept="image/png, image/jpeg, image/webp"
        style={{ display: 'none' }}
        onChange={handleUploadLogo}
      />

      {loadingProductos ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner"></div></div>
      ) : productos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-text">No hay paquetes para {selectedJuego.nombre}</div>
          <div className="empty-state-sub">Haz clic en Añadir Paquete arriba para empezar.</div>
        </div>
      ) : (
        <div className="table-container compact-table" style={{ flex: 1, fontSize: '12px' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '8px 4px', textAlign: 'center' }}>Ord.</th>
                <th style={{ padding: '8px 4px' }}>Paquete</th>
                <th style={{ padding: '8px 4px' }}>Costo</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>% Margen</th>
                <th style={{ padding: '8px 4px' }}>Venta ($)</th>
                <th style={{ padding: '8px 4px' }}>Precio Bs</th>
                <th style={{ padding: '8px 4px' }}>Ganancia</th>
                <th style={{ padding: '8px 4px' }}>D. Rev</th>
                <th style={{ width: 60, padding: '8px 4px', textAlign: 'center' }}>Est.</th>
                <th style={{ width: 60, padding: '8px 4px', textAlign: 'center' }}>Acc.</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((prod, idx) => {
                const precio = calcularPrecioVenta(prod, selectedJuego, config)
                const isDragging = draggedIndex === idx
                const isDisabled = prod.activo === false
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
                      backgroundColor: isDragging ? 'rgba(0, 210, 255, 0.05)' : isDisabled ? 'rgba(255,255,255,0.01)' : 'transparent',
                      opacity: isDisabled ? 0.45 : isDragging ? 0.5 : 1,
                      transition: 'all 0.2s',
                      filter: isDisabled ? 'grayscale(0.4)' : 'none'
                    }}
                  >
                    <td style={{ padding: '4px' }}>
                      <div className="flex gap-2" style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ fontSize: 12, cursor: 'grab', marginRight: 1, color: 'var(--text-muted)' }} title="Arrastrar para reordenar">☰</div>
                        <div className="flex flex-column gap-1">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleMoveProduct(idx, -1)}
                            disabled={idx === 0}
                            title="Subir"
                            style={{ opacity: idx === 0 ? 0.25 : 1, fontSize: 8, padding: '0px 1px', minWidth: 'auto', height: '14px' }}
                          >
                            ▲
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleMoveProduct(idx, 1)}
                            disabled={idx === productos.length - 1}
                            title="Bajar"
                            style={{ opacity: idx === productos.length - 1 ? 0.25 : 1, fontSize: 8, padding: '0px 1px', minWidth: 'auto', height: '14px' }}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '4px' }}>
                      <div className="flex items-center gap-4">
                        <div
                          title="Cambiar ícono del paquete"
                          style={{
                            width: 20, height: 20, borderRadius: 4, backgroundColor: 'var(--bg-panel)',
                            border: '1px dashed var(--border-active)', cursor: 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            overflow: 'hidden', flexShrink: 0
                          }}
                          onClick={() => document.getElementById(`prod-icon-${prod.id}`).click()}
                        >
                          {prod.icono_url ? (
                            <img src={getOptimizedImageUrl(prod.icono_url, 150)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>📦</span>
                          )}
                        </div>
                        <input
                          type="file"
                          id={`prod-icon-${prod.id}`}
                          accept="image/png, image/jpeg, image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => handleUploadProductIcon(e, prod.id)}
                        />
                        <span className="font-bold" style={{ color: isDisabled ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '12px' }}>{prod.nombre}</span>
                      </div>
                    </td>
                    <td style={{ padding: '4px' }}>{formatUSD(prod.costo_base)}</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}><span className="badge badge-info" style={{ padding: '1px 4px', fontSize: '10px' }}>{prod.margen_ganancia * 100}%</span></td>
                    <td style={{ padding: '4px', color: isDisabled ? 'var(--text-muted)' : 'var(--accent-primary)', fontWeight: 600 }}>{formatUSD(precio.venta_usd)}</td>
                    <td style={{ padding: '4px', color: isDisabled ? 'var(--text-muted)' : 'var(--accent-success)', fontWeight: 600 }}>{formatBs(precio.venta_bs)}</td>
                    <td style={{ padding: '4px', color: isDisabled ? 'var(--text-muted)' : 'var(--accent-warning)', fontWeight: 600 }}>{formatUSD(precio.ganancia_usd)}</td>
                    <td style={{ padding: '4px' }}>
                      {prod.descuento_revendedor ? (
                        <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 4px' }}>{prod.descuento_revendedor}%</span>
                      ) : (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Global</span>
                      )}
                    </td>
                    {/* Botón Toggle Habilitar/Deshabilitar */}
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleProducto(prod.id, prod.activo !== false)}
                        title={isDisabled ? 'Habilitar paquete' : 'Deshabilitar paquete'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '2px 6px',
                          borderRadius: '16px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '9px',
                          letterSpacing: '0.2px',
                          transition: 'all 0.2s ease',
                          backgroundColor: isDisabled
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(34, 197, 94, 0.15)',
                          color: isDisabled
                            ? 'var(--text-muted)'
                            : '#22c55e'
                        }}
                      >
                        <span style={{ fontSize: '6px' }}>{isDisabled ? '⬜' : '🟢'}</span>
                        {isDisabled ? 'OFF' : 'ON'}
                      </button>
                    </td>
                    <td style={{ padding: '4px' }}>
                      <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleEditProducto(prod)}
                          title={`Editar ${prod.nombre}`}
                          style={{ width: '24px', height: '24px' }}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleDuplicateProducto(prod)}
                          title={`Duplicar ${prod.nombre}`}
                          style={{ width: '24px', height: '24px' }}
                        >
                          📋
                        </button>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          onClick={() => handleDelete(prod.id, prod.nombre)}
                          title={`Eliminar ${prod.nombre}`}
                          style={{ width: '24px', height: '24px' }}
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
        </div >

      </div >

  {/* MODAL CREAR PRODUCTO */}
{
  isModalOpen && (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">{formData.id ? `Editar paquete en ${selectedJuego?.nombre}` : `Añadir a ${selectedJuego?.nombre}`}</h2>
        <form onSubmit={handleSubmit}>
          {/* SECTOR DE ÍCONO */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
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
            
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input 
                  type="checkbox" 
                  checked={shouldRemoveBg} 
                  onChange={(e) => setShouldRemoveBg(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Auto-PNG (Quitar Fondo Blanco)
              </label>
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
            <div style={{ width: '100%', marginTop: 16 }}>
              <input
                type="text"
                className="form-input"
                placeholder="URL de la imagen (Copia esta URL o pega otra existente)"
                value={(!newIconFile && formData.icono_url) ? formData.icono_url : ''}
                onChange={(e) => {
                  const url = e.target.value;
                  setNewIconFile(null);
                  setIconPreview(url);
                  setFormData(prev => ({ ...prev, icono_url: url }));
                }}
                style={{ fontSize: 11, padding: '8px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del Paquete</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: 110 Diamantes"
              value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })}
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
                onChange={e => setFormData({ ...formData, costo_base: e.target.value })}
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
                onChange={e => setFormData({ ...formData, margen_ganancia: e.target.value })}
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
              onChange={e => setFormData({ ...formData, descuento_revendedor: e.target.value })}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Si se establece, este descuento será exclusivo para este paquete and NO se sumará al global del servicio.
            </p>
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '20px 0' }} />
          <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '12px' }}>Información Adicional (Modal ⓘ)</h4>
          
          <div className="form-group">
            <label className="form-label">Texto Informativo (Opcional)</label>
            <textarea
              className="form-input"
              placeholder="Detalla qué incluye el paquete..."
              rows="3"
              style={{ resize: 'vertical' }}
              value={formData.info_adicional_texto}
              onChange={e => setFormData({ ...formData, info_adicional_texto: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Imagen Adjunta (Opcional)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {newInfoFile ? (
                    <img src={URL.createObjectURL(newInfoFile)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : formData.info_adicional_imagen_url ? (
                    <img src={getOptimizedImageUrl(formData.info_adicional_imagen_url, 600)} alt="info" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 24, opacity: 0.3 }}>🖼️</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    id="info-file-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) setNewInfoFile(file)
                    }}
                  />
                  <label htmlFor="info-file-upload" className="btn btn-ghost btn-sm">
                    📤 Subir Imagen
                  </label>
                  {(newInfoFile || formData.info_adicional_imagen_url) && (
                    <button type="button" className="btn btn-ghost btn-sm text-danger" style={{ marginLeft: '8px', color: '#ff5252' }} onClick={() => { setNewInfoFile(null); setFormData(prev => ({...prev, info_adicional_imagen_url: null})) }}>🗑️ Quitar</button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="URL de la imagen adjunta (Copia esta URL o pega otra existente)"
                  value={(!newInfoFile && formData.info_adicional_imagen_url) ? formData.info_adicional_imagen_url : ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    setNewInfoFile(null);
                    setFormData(prev => ({ ...prev, info_adicional_imagen_url: url }));
                  }}
                  style={{ fontSize: 11, padding: '8px', backgroundColor: 'rgba(0,0,0,0.2)' }}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Tipo de Producto</label>
            <select
              className="form-input"
              value={formData.tipo_producto}
              onChange={e => setFormData({ ...formData, tipo_producto: e.target.value })}
            >
              <option value="recarga">Recarga (Juego/Puntos)</option>
              <option value="paquete">Paquetes</option>
              <option value="gift_card">Gift Card / Código</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ color: '#fbbf24' }}>📦 ID Producto Proveedor (Opcional - TiendaGiftVen API)</label>
            <input
              type="number"
              className="form-input"
              value={formData.proveedor_api_id || ''}
              onChange={e => {
                lastProveedorIdSincronizado.current = null
                setFormData({ ...formData, proveedor_api_id: e.target.value })
              }}
              onBlur={e => sincronizarCostoProveedor(e.target.value)}
              placeholder="Ej. 5"
              style={{ borderColor: formData.proveedor_api_id ? '#fbbf24' : '' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              {sincronizandoCosto ? 'Consultando costo en el catálogo del proveedor...' : 'Si colocas el ID que obtuviste del catálogo, el pedido se procesará automáticamente por la API al ser aprobado y el "Costo tu proveedor" se actualizará automáticamente con el precio del proveedor.'}
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.entrega_automatica}
                onChange={e => setFormData({ ...formData, entrega_automatica: e.target.checked })}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)' }}
              />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>📦 Activar Entrega Automática (Baúl)</span>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Si se activa, el sistema entregará un código del baúl automáticamente al completar el pedido.</p>
              </div>
            </label>
          </div>

          {formData.id && formData.entrega_automatica && (
            <ProductVault productoId={formData.id} setAlertModal={setAlertModal} />
          )}

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
        <h2 className="modal-title">{formGame.id ? 'Editar Servicio' : 'Añadir Nuevo Servicio'}</h2>
        <form onSubmit={handleGameSubmit}>
          {/* LOGO DEL SERVICIO EN EL MODAL */}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <label className="form-label" style={{ alignSelf: 'flex-start' }}>Logo del Servicio</label>
            <div 
              onClick={() => document.getElementById('modal-game-logo-upload').click()}
              style={{
                width: 100, height: 100, borderRadius: 16, backgroundColor: 'var(--bg-panel)',
                border: '1px dashed var(--border-active)', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                position: 'relative', marginTop: '8px'
              }}
            >
              {formGame.icono_url ? (
                <img src={getOptimizedImageUrl(formGame.icono_url, 200)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 32, display: 'block' }}>🎮</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Subir Logo</span>
                </div>
              )}
              {saving && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 20, height: 20 }}></div>
                </div>
              )}
            </div>
            <input
              type="file"
              id="modal-game-logo-upload"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files[0]
                if (!file) return
                setSaving(true)
                try {
                  let finalFile = file
                  let contentType = file.type
                  if (shouldRemoveBg) {
                    finalFile = await removeWhiteBackground(file)
                    contentType = 'image/png'
                  }
                  const fileName = `game-${Date.now()}${shouldRemoveBg ? '.png' : ''}`
                  const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, await compressImage(finalFile), { cacheControl: '31536000', upsert: true })
                  if (uploadError) throw uploadError
                  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
                  setFormGame(prev => ({ ...prev, icono_url: publicUrl }))
                } catch (err) {
                  setAlertModal({ type: 'error', message: 'Error subiendo logo: ' + err.message })
                } finally {
                  setSaving(false)
                  e.target.value = null
                }
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre (Ej: Free Fire, Netflix)</label>
            <input
              type="text"
              className="form-input"
              value={formGame.nombre}
              onChange={e => setFormGame({ ...formGame, nombre: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select
              className="form-input"
              value={formGame.categoria_id}
              onChange={e => setFormGame({ ...formGame, categoria_id: e.target.value })}
              required
            >
              <option value="">Selecciona una categoría</option>
              {allCategorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Fórmula de rentabilidad base</label>
            <select
              className="form-input"
              value={formGame.tipo_calculo}
              onChange={e => setFormGame({ ...formGame, tipo_calculo: e.target.value })}
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
              onChange={e => setFormGame({ ...formGame, metodo_recarga: e.target.value })}
            >
              <option value="id_jugador">🆔 ID del Jugador</option>
              <option value="id_zone">🆔 ID + Zone ID</option>
              <option value="cuenta_completa">🔐 Correo y Clave</option>
              <option value="usuario_clave">👤 Usuario y Clave</option>
              <option value="solo_correo">📧 Solo Correo</option>
              <option value="solo_usuario">👤 Solo Usuario (@)</option>
              <option value="opcional_cuenta">🔄 Opcional: Su Cuenta o Nueva</option>
              <option value="sin_datos">📥 Sin Datos (Entrega Automática)</option>
              <option value="entrega_codigo">🎁 Entrega de Código (Gift Card)</option>
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {formGame.metodo_recarga === 'id_jugador'
                ? 'Se le pedirá al cliente solo su ID identificador en el juego.'
                : formGame.metodo_recarga === 'id_zone'
                  ? 'Se le pedirá al cliente su ID del jugador y su ID de zona (ej. Mobile Legends).'
                  : formGame.metodo_recarga === 'cuenta_completa'
                    ? 'Se le pedirá al cliente su correo electrónico y contraseña del juego.'
                    : formGame.metodo_recarga === 'usuario_clave'
                        ? 'Se le pedirá al cliente su nombre de usuario y contraseña del juego.'
                        : formGame.metodo_recarga === 'solo_correo'
                          ? 'Se le pedirá al cliente únicamente su correo electrónico.'
                          : formGame.metodo_recarga === 'solo_usuario'
                            ? 'Se le pedirá al cliente únicamente su @Usuario (ej. Telegram).'
                            : formGame.metodo_recarga === 'opcional_cuenta'
                              ? 'El cliente elegirá si provee sus datos para activar en su cuenta, o si quiere una cuenta nueva.'
                              : formGame.metodo_recarga === 'entrega_codigo'
                                ? 'No se piden datos al cliente. El administrador proveerá el código manualmente.'
                                : 'No se le pedirá ningún dato al cliente. Ideal para Gift Cards automáticas en Baúl.'}
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
                  <img src={getOptimizedImageUrl(formGame.guia_id_url, 600)} alt="Guia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, await compressImage(file), { cacheControl: '31536000', upsert: true })
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
          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)' }} />
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>Características Visuales del Catálogo</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Recarga (Automática)"
                value={formGame.caracteristicas_tipo}
                onChange={e => setFormGame({ ...formGame, caracteristicas_tipo: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Región</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Global, LATAM"
                value={formGame.caracteristicas_region}
                onChange={e => setFormGame({ ...formGame, caracteristicas_region: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Entrega</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Inmediata"
                value={formGame.caracteristicas_entrega}
                onChange={e => setFormGame({ ...formGame, caracteristicas_entrega: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nota o Advertencia</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Válido solo para cuentas LATAM."
                value={formGame.caracteristicas_nota}
                onChange={e => setFormGame({ ...formGame, caracteristicas_nota: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Guía de Recarga (Paso a paso)</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Ej: 1) Selecciona el paquete... 2) Ingresa tu ID... (Soporta HTML básico)"
                value={formGame.instrucciones_recarga}
                onChange={e => setFormGame({ ...formGame, instrucciones_recarga: e.target.value })}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
            </div>
          </div>

          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)' }} />
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>Configuración de Verificación de Jugador</h3>
          
          <div className="form-group" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="verificacion_api_activa"
                checked={!!formGame.verificacion_api_activa}
                onChange={e => setFormGame({ ...formGame, verificacion_api_activa: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="verificacion_api_activa" className="form-label" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>
                Activar API de Verificación de Nombres
              </label>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Si se activa, el usuario deberá verificar su ID antes de poder añadir el paquete al carrito.
            </p>
          </div>

          {formGame.verificacion_api_activa && (
            <div className="form-group">
              <label className="form-label">URL de la API (Opcional - Uso futuro)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: https://api.game.com/verify?id={{ID}}"
                value={formGame.verificacion_api_url}
                onChange={e => setFormGame({ ...formGame, verificacion_api_url: e.target.value })}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Actualmente se usan las APIs integradas para Free Fire y Blood Strike.
              </p>
            </div>
          )}

          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)' }} />
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>Visualización de Precios</h3>
          
          <div className="form-group" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="mostrar_precio_dual"
                checked={!!formGame.mostrar_precio_dual}
                onChange={e => setFormGame({ ...formGame, mostrar_precio_dual: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="mostrar_precio_dual" className="form-label" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>
                Mostrar Precio Dual al Cliente (Bs. y USD)
              </label>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Si se activa, el cliente verá ambos precios. Útil para Zinli o Wally Tech.
            </p>
          </div>

          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)' }} />
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>Configuración de Video Tutorial</h3>
          
          <div className="form-group">
            <label className="form-label">Video Tutorial (Archivo o YouTube)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="URL de YouTube: https://www.youtube.com/watch?v=..."
                value={formGame.tutorial_video_url}
                onChange={e => setFormGame({ ...formGame, tutorial_video_url: e.target.value })}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="file"
                  id="tutorial-video-upload"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    if (file.size > 50 * 1024 * 1024) { // 50MB limit
                      setAlertModal({ type: 'error', message: 'El video no debe superar los 50MB' })
                      return
                    }
                    setSaving(true)
                    try {
                      const fileName = `video-${Date.now()}-${file.name}`
                      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, await compressImage(file), { cacheControl: '31536000', upsert: true })
                      if (uploadError) throw uploadError
                      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
                      setFormGame(prev => ({ ...prev, tutorial_video_url: publicUrl }))
                    } catch (err) {
                      setAlertModal({ type: 'error', message: 'Error subiendo video: ' + err.message })
                    } finally {
                      setSaving(false)
                    }
                  }}
                />
                <label htmlFor="tutorial-video-upload" className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
                  {saving ? 'Procesando...' : '📤 Subir Video Local'}
                </label>
                {formGame.tutorial_video_url && (
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm" 
                    style={{ color: 'var(--accent-error)', flexShrink: 0 }}
                    onClick={() => setFormGame(prev => ({ ...prev, tutorial_video_url: '' }))}
                  >
                    🗑️ Remover Video
                  </button>
                )}
                {formGame.tutorial_video_url && !formGame.tutorial_video_url.includes('youtube') && !formGame.tutorial_video_url.includes('youtu.be') && (
                  <div style={{ fontSize: '11px', color: 'var(--accent-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ✅ Video cargado correctamente
                  </div>
                )}
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Puedes pegar un link de YouTube o subir un video propio (MP4, WebM, etc).
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Texto del Banner (Opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: ¿Aún no sabes recargar vía Pago Móvil?"
              value={formGame.tutorial_banner_texto}
              onChange={e => setFormGame({ ...formGame, tutorial_banner_texto: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Imagen del Banner (Opcional - Reemplaza al texto)</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 8 }}>
              <div style={{
                width: 100, height: 50, borderRadius: 8, backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                {formGame.tutorial_banner_img ? (
                  <img src={getOptimizedImageUrl(formGame.tutorial_banner_img, 600)} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 18, opacity: 0.3 }}>🖼️</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  id="tutorial-banner-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    setSaving(true)
                    try {
                      const fileName = `banner-${Date.now()}.png`
                      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, await compressImage(file), { cacheControl: '31536000', upsert: true })
                      if (uploadError) throw uploadError
                      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
                      setFormGame(prev => ({ ...prev, tutorial_banner_img: publicUrl }))
                    } catch (err) {
                      setAlertModal({ type: 'error', message: 'Error subiendo banner: ' + err.message })
                    } finally {
                      setSaving(false)
                    }
                  }}
                />
                <label htmlFor="tutorial-banner-upload" className="btn btn-ghost btn-sm">
                  {saving ? 'Procesando...' : '📤 Subir Banner'}
                </label>
                {formGame.tutorial_banner_img && (
                  <button type="button" className="btn btn-ghost btn-sm text-danger" style={{ marginLeft: '8px' }} onClick={() => setFormGame(prev => ({ ...prev, tutorial_banner_img: '' }))}>🗑️</button>
                )}
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

{/* MODAL GESTIÓN DE CATEGORÍAS */}
{isCategoryModalOpen && (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <h2 className="modal-title">Gestión de Categorías</h2>
        <div style={{ marginBottom: '20px' }}>
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Nueva categoría..." 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '...' : '+'}
            </button>
          </form>
        </div>
        
        <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          {allCategorias.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No hay categorías creadas.
            </div>
          ) : (
            allCategorias.map(cat => (
              <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => updateCategoria(cat.id, { activa: !cat.activa })}
                    style={{
                      background: cat.activa ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: cat.activa ? '#22c55e' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={cat.activa ? 'Desactivar Categoría' : 'Activar Categoría'}
                  >
                    <span style={{ fontSize: '8px' }}>{cat.activa ? '🟢' : '⚪'}</span>
                    {cat.activa ? 'ACTIVA' : 'OFF'}
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{cat.orden}</span>
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ padding: '4px', color: '#ff4d4f' }}
                    onClick={() => {
                      if (window.confirm(`¿Seguro que deseas eliminar la categoría "${cat.nombre}"?`)) {
                        deleteCategoria(cat.id)
                      }
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="btn btn-ghost" onClick={() => setIsCategoryModalOpen(false)}>Cerrar</button>
        </div>
      </div>
    </div>
)}

  <AlertModal
    isOpen={!!alertModal}
    type={alertModal?.type}
    title={alertModal?.title}
    message={alertModal?.message}
    onConfirm={alertModal?.onConfirm || (() => setAlertModal(null))}
    onCancel={() => setAlertModal(null)}
  />
</div>
  )
}

// ─── Componente: Lista de códigos del baúl con Drag & Drop ───────────────────
function VaultCodesList({ codigos, loading, pedidoLoading, reorderCodigos, deleteCodigo, deleteCodigoUsado, handleVerPedido }) {
  const available = codigos.filter(c => !c.usado).sort((a, b) => {
    if (a.orden != null && b.orden != null) return a.orden - b.orden
    if (a.orden != null) return -1
    if (b.orden != null) return 1
    return new Date(a.created_at) - new Date(b.created_at)
  })
  const used = codigos.filter(c => c.usado).sort((a, b) => new Date(b.usado_at || b.created_at) - new Date(a.usado_at || a.created_at))
  const allRows = [...available, ...used]

  const [dragOverId, setDragOverId] = useState(null)
  const dragItem = useRef(null)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [editOrderVal, setEditOrderVal] = useState('')
  const [codigoToDelete, setCodigoToDelete] = useState(null)

  const handleDragStart = (e, codigo) => {
    if (codigo.usado) return
    dragItem.current = codigo
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, targetCodigo) => {
    if (!dragItem.current || targetCodigo.usado) return
    e.preventDefault()
    setDragOverId(targetCodigo.id)
  }

  const handleDrop = (e, targetCodigo) => {
    e.preventDefault()
    setDragOverId(null)
    if (!dragItem.current || targetCodigo.id === dragItem.current.id || targetCodigo.usado) return

    const newAvailable = [...available]
    const fromIdx = newAvailable.findIndex(c => c.id === dragItem.current.id)
    const toIdx = newAvailable.findIndex(c => c.id === targetCodigo.id)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = newAvailable.splice(fromIdx, 1)
    newAvailable.splice(toIdx, 0, moved)
    reorderCodigos(newAvailable)
    dragItem.current = null
  }

  const handleDragEnd = () => {
    dragItem.current = null
    setDragOverId(null)
  }

  const handleOrderInputBlur = (codigo) => {
    const num = parseInt(editOrderVal, 10)
    if (!isNaN(num) && num >= 1 && num <= available.length) {
      const newAvailable = [...available]
      const fromIdx = newAvailable.findIndex(c => c.id === codigo.id)
      if (fromIdx !== -1) {
        const [moved] = newAvailable.splice(fromIdx, 1)
        newAvailable.splice(num - 1, 0, moved)
        reorderCodigos(newAvailable)
      }
    }
    setEditingOrderId(null)
    setEditOrderVal('')
  }

  if (loading || pedidoLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner-small"></div></div>
  }

  if (codigos.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>El baúl está vacío</div>
  }

  return (
    <div style={{ marginTop: '16px' }}>
      {available.length > 0 && (
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⠿</span> Arrastra para reordenar · Haz clic en el número para editar la posición
        </p>
      )}
      <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '6px 4px', textAlign: 'center', width: '24px', color: 'var(--text-muted)' }}></th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Código</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: '60px' }}>Pos.</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: '40px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((c, visIdx) => {
              const pos = available.findIndex(a => a.id === c.id)
              const isDragging = dragItem.current?.id === c.id
              const isOver = dragOverId === c.id
              return (
                <tr
                  key={c.id}
                  draggable={!c.usado}
                  onDragStart={e => handleDragStart(e, c)}
                  onDragOver={e => handleDragOver(e, c)}
                  onDrop={e => handleDrop(e, c)}
                  onDragEnd={handleDragEnd}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: isOver
                      ? 'rgba(99,102,241,0.18)'
                      : isDragging
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                    opacity: isDragging ? 0.5 : 1,
                    transition: 'background-color 0.15s',
                    cursor: c.usado ? 'default' : 'grab',
                  }}
                >
                  {/* Handle drag */}
                  <td style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', userSelect: 'none' }}>
                    {!c.usado && <span title="Arrastra para reordenar">⠿</span>}
                  </td>
                  {/* Código */}
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.codigo}
                  </td>
                  {/* Estado */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {c.usado ? (
                      c.pedidos?.numero_pedido ? (
                        <span
                          onClick={() => handleVerPedido(c.pedido_id)}
                          style={{ color: 'var(--accent-primary)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', fontSize: '10px' }}
                          title="Ver pedido"
                        >
                          #{String(c.pedidos.numero_pedido).replace('#', '')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Utilizado</span>
                      )
                    ) : (
                      <span style={{ color: 'var(--accent-success)', fontSize: '10px' }}>Disponible</span>
                    )}
                  </td>
                  {/* Posición editable */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {!c.usado ? (
                      editingOrderId === c.id ? (
                        <input
                          type="number"
                          min="1"
                          max={available.length}
                          autoFocus
                          value={editOrderVal}
                          onChange={e => setEditOrderVal(e.target.value)}
                          onBlur={() => handleOrderInputBlur(c)}
                          onKeyDown={e => { if (e.key === 'Enter') handleOrderInputBlur(c); if (e.key === 'Escape') { setEditingOrderId(null); setEditOrderVal('') } }}
                          style={{
                            width: '40px', padding: '2px 4px', fontSize: '11px',
                            background: 'rgba(99,102,241,0.15)', border: '1px solid var(--accent-primary)',
                            borderRadius: '4px', color: '#fff', textAlign: 'center'
                          }}
                        />
                      ) : (
                        <span
                          onClick={() => { setEditingOrderId(c.id); setEditOrderVal(String(pos + 1)) }}
                          title="Clic para editar posición"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)',
                            fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                            border: '1px solid rgba(99,102,241,0.4)',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.4)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                        >
                          {pos + 1}
                        </span>
                      )
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
                    )}
                  </td>
                  {/* Acción */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {c.usado ? (
                      <button
                        type="button"
                        onClick={() => setCodigoToDelete(c)}
                        style={{
                          background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '4px', color: '#ef4444', cursor: 'pointer',
                          fontSize: '12px', padding: '2px 5px', opacity: 0.6, transition: 'opacity 0.2s'
                        }}
                        title="Eliminar código usado del historial"
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                      >🗑️</button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCodigoToDelete(c)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#ef4444', cursor: 'pointer',
                          fontSize: '14px', padding: '2px 5px', opacity: 0.7, transition: 'opacity 0.2s'
                        }}
                        title="Eliminar código disponible"
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                      >🗑️</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {codigoToDelete && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 13000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            backdropFilter: 'blur(6px)', padding: '16px' 
          }}
          onClick={() => setCodigoToDelete(null)}
        >
          <div 
            className="card" 
            style={{ 
              width: '100%', maxWidth: '400px', backgroundColor: '#13151a', 
              border: '1px solid var(--border-color)', borderRadius: '16px', 
              padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', 
              color: '#fff', textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold' }}>
              Confirmar Eliminación
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              ¿Estás seguro de que deseas eliminar permanentemente este código del baúl?
            </p>
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', 
              borderRadius: '8px', fontFamily: 'monospace', fontSize: '16px', 
              color: 'var(--accent-primary)', marginBottom: '24px', wordBreak: 'break-all'
            }}>
              {codigoToDelete.codigo}
            </div>
            {codigoToDelete.usado && (
              <p style={{ margin: '0 0 24px', fontSize: '12px', color: '#ef4444' }}>
                Este código está marcado como utilizado. Eliminarlo borrará el registro del historial.
              </p>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setCodigoToDelete(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  if (codigoToDelete.usado) {
                    deleteCodigoUsado(codigoToDelete.id)
                  } else {
                    deleteCodigo(codigoToDelete.id)
                  }
                  setCodigoToDelete(null)
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

function ProductVault({ productoId, setAlertModal }) {

  const { codigos, loading, addCodigos, deleteCodigo, deleteCodigoUsado, reorderCodigos } = useProductoCodigos(productoId)
  const [newCodesText, setNewCodesText] = useState('')
  const [adding, setAdding] = useState(false)
  const [selectedPedidoDetalle, setSelectedPedidoDetalle] = useState(null)
  const [pedidoLoading, setPedidoLoading] = useState(false)

  const available = codigos.filter(c => !c.usado).length
  const total = codigos.length

  const handleAdd = async () => {
    if (!newCodesText.trim()) return
    setAdding(true)
    const list = newCodesText.split('\n').filter(c => c.trim().length > 0)
    const { error } = await addCodigos(list)
    setAdding(false)
    if (error) {
      if (setAlertModal) setAlertModal({ type: 'error', message: error.message || 'Error al añadir códigos.' })
      else alert('Error: ' + (error.message || 'Error al añadir códigos.'))
    } else {
      setNewCodesText('')
    }
  }

  const handleVerPedido = async (pedidoId) => {
    if (!pedidoId) return
    setPedidoLoading(true)
    try {
      const { data: pedido, error: err1 } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (err1) throw err1

      if (pedido) {
        const { data: items, error: err2 } = await supabase
          .from('pedido_items')
          .select('*')
          .eq('pedido_id', pedidoId)
        
        if (err2) throw err2

        let clienteData = null
        if (pedido.cliente_id) {
          const { data: client, error: err3 } = await supabase
            .from('clientes')
            .select('id, auth_user_id, nombres, apellidos, nickname, whatsapp, usuario, fecha_registro')
            .or(`id.eq.${pedido.cliente_id},auth_user_id.eq.${pedido.cliente_id}`)
            .maybeSingle()
          
          if (client && !err3) {
            clienteData = client
          }
        }
        
        setSelectedPedidoDetalle({
          ...pedido,
          cliente: clienteData,
          items: items || []
        })
      }
    } catch (err) {
      if (setAlertModal) {
        setAlertModal({ type: 'error', message: 'Error cargando detalles del pedido: ' + err.message })
      } else {
        alert('Error: ' + err.message)
      }
    } finally {
      setPedidoLoading(false)
    }
  }

  const formatFecha = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  const formatUSD = (n) => `$${Number(n || 0).toFixed(2)}`
  const formatBs = (n) => `${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case 'pendiente': return { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }
      case 'completado': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }
      case 'cancelado': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      case 'procesando': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }
      case 'reembolsado': return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }
      default: return { bg: 'rgba(255, 255, 255, 0.05)', color: '#fff' }
    }
  }

  return (
    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', margin: 0 }}>🗄️ Gestión del Baúl</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-info" style={{ fontSize: '10px' }}>Total: {total}</span>
          <span className="badge badge-success" style={{ fontSize: '10px' }}>Disponibles: {available}</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontSize: '11px' }}>Añadir códigos (uno por línea)</label>
        <textarea
          className="form-input"
          placeholder="Código 1&#10;Código 2&#10;Código 3..."
          rows="4"
          value={newCodesText}
          onChange={e => setNewCodesText(e.target.value)}
          style={{ fontSize: '12px', fontFamily: 'monospace' }}
        />
        <button 
          type="button" 
          className="btn btn-primary btn-sm" 
          style={{ marginTop: '8px', width: '100%' }}
          onClick={handleAdd}
          disabled={adding || !newCodesText.trim()}
        >
          {adding ? 'Añadiendo...' : '➕ Añadir Códigos al Baúl'}
        </button>
      </div>

      {/* TABLA DEL BAÚL CON DRAG-AND-DROP */}
      <VaultCodesList
        codigos={codigos}
        loading={loading}
        pedidoLoading={pedidoLoading}
        reorderCodigos={reorderCodigos}
        deleteCodigo={deleteCodigo}
        deleteCodigoUsado={deleteCodigoUsado}
        handleVerPedido={handleVerPedido}
      />


      {/* MODAL DETALLES DEL PEDIDO */}
      {selectedPedidoDetalle && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 12000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            backdropFilter: 'blur(6px)', padding: '16px' 
          }}
          onClick={() => setSelectedPedidoDetalle(null)}
        >
          <div 
            className="card" 
            style={{ 
              width: '100%', maxWidth: '550px', maxHeight: '90vh', 
              overflowY: 'auto', backgroundColor: '#13151a', 
              border: '1px solid var(--border-color)', borderRadius: '20px', 
              padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', 
              color: '#fff', position: 'relative' 
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                Pedido {selectedPedidoDetalle.numero_pedido.startsWith('#') ? selectedPedidoDetalle.numero_pedido : `#${selectedPedidoDetalle.numero_pedido}`}
              </h3>
              <button 
                onClick={() => setSelectedPedidoDetalle(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cliente</span>
                <span style={{ fontWeight: 'bold' }}>
                  {selectedPedidoDetalle.cliente ? `${selectedPedidoDetalle.cliente.nombres} ${selectedPedidoDetalle.cliente.apellidos || ''}` : 'Cargando cliente...'}
                </span>
                {selectedPedidoDetalle.cliente?.whatsapp && (
                  <span style={{ display: 'block', color: 'var(--accent-success)', marginTop: '2px' }}>
                    📱 {selectedPedidoDetalle.cliente.whatsapp}
                  </span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fecha / Hora</span>
                <span>{formatFecha(selectedPedidoDetalle.created_at)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Estado</span>
                {(() => {
                  const style = getEstadoStyle(selectedPedidoDetalle.estado)
                  return (
                    <span style={{ 
                      backgroundColor: style.bg, color: style.color, 
                      padding: '4px 10px', borderRadius: '12px', 
                      fontSize: '10px', fontWeight: 'bold', display: 'inline-block' 
                    }}>
                      {selectedPedidoDetalle.estado.toUpperCase()}
                    </span>
                  )
                })()}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Método de Pago</span>
                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {selectedPedidoDetalle.metodo_pago || 'Billetera'}
                </span>
              </div>
            </div>

            {/* Payment Summary */}
            <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monto Total:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {formatUSD(selectedPedidoDetalle.total_usd)} / {formatBs(selectedPedidoDetalle.total_bs)}
                </span>
              </div>
              {selectedPedidoDetalle.referencia_pago && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Referencia:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-success)' }}>
                    {selectedPedidoDetalle.referencia_pago}
                  </span>
                </div>
              )}
            </div>

            {/* Items Title */}
            <h4 style={{ fontSize: '13px', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', color: 'var(--text-muted)' }}>
              Detalle de Productos
            </h4>

            {/* Items List */}
            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              {selectedPedidoDetalle.items.map(item => (
                <div 
                  key={item.id} 
                  style={{ 
                    padding: '12px', backgroundColor: 'rgba(255,255,255,0.01)', 
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{item.producto_nombre}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Cant: {item.cantidad}</span>
                  </div>

                  {/* Recharge Info */}
                  <div style={{ fontSize: '11px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}>
                    {item.metodo_recarga === 'cuenta_completa' ? (
                      <>
                        <div>📧 Correo: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.account_email}</span></div>
                        <div style={{ marginTop: '2px' }}>🔑 Clave: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.account_password}</span></div>
                      </>
                    ) : item.metodo_recarga === 'usuario_clave' ? (
                      <>
                        <div>👤 Usuario: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.account_user}</span></div>
                        <div style={{ marginTop: '2px' }}>🔑 Clave: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.account_password}</span></div>
                      </>
                    ) : item.metodo_recarga === 'id_zone' ? (
                      <>
                        <div>🆔 ID: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.player_id}</span> | 🌐 ZONE ID: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.zone_id}</span></div>
                        {item.nickname && <div style={{ marginTop: '2px' }}>👤 Nickname: <span style={{ color: '#fff', fontWeight: 'bold' }}>{item.nickname}</span></div>}
                      </>
                    ) : item.player_id ? (
                      <>
                        <div>🆔 Player ID: <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.player_id}</span></div>
                        {item.nickname && <div style={{ marginTop: '2px' }}>👤 Nickname: <span style={{ color: '#fff', fontWeight: 'bold' }}>{item.nickname}</span></div>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Sin datos de recarga requeridos (Entrega Directa)</span>
                    )}

                    {/* Delivered Code */}
                    {item.codigo_entregado && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🎁 Código Entregado:</span>
                        <span style={{ backgroundColor: 'rgba(0, 210, 255, 0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
                          {item.codigo_entregado}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setSelectedPedidoDetalle(null)}
                style={{ padding: '8px 20px', borderRadius: '10px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
