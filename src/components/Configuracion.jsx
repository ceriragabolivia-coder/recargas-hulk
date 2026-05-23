import React, { useState, useRef } from 'react'
import { useMetodosPago, useConfiguracion, useMensajesSistema, useNotificacionesPush, useAuth } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { removeWhiteBackground } from '../utils/helpers'
import AlertModal from './AlertModal'

export default function Configuracion() {
  const { metodos, loading: metodosLoading, createMetodo, updateMetodo, deleteMetodo } = useMetodosPago()
  const { config, updateConfig, refetch: refetchConfig, loading: configLoading } = useConfiguracion()
  const { mensajes, loading: mensajesLoading, createMensaje, updateMensaje, deleteMensaje } = useMensajesSistema()
  const { enviarNotificacion } = useNotificacionesPush()
  const { perfil } = useAuth()
  const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'
  const [activeTab, setActiveTab] = useState(isNegocio ? 'efectos' : 'pagos')
  
  // Estado para el formulario de edición/creación
  const [isEditing, setIsEditing] = useState(false)
  const [currentMetodo, setCurrentMetodo] = useState({ nombre: '', datos: '', activo: true, icono_url: null, qr_url: null })
  const [showForm, setShowForm] = useState(false)

  // Estado para Mensajes Pop-up
  const [showMensajeForm, setShowMensajeForm] = useState(false)
  const [isEditingMensaje, setIsEditingMensaje] = useState(false)
  const [currentMensaje, setCurrentMensaje] = useState({ titulo: '', contenido: '', activo: true, imagen_url: null, hora_inicio: '', hora_fin: '' })

  // Estado para Notificaciones Push
  const [formNoti, setFormNoti] = useState({ titulo: '', mensaje: '', imagen_url: null })
  const [notiDuracion, setNotiDuracion] = useState(1) // Por defecto 1 hora
  const [notiUnidad, setNotiUnidad] = useState('horas') // 'horas' o 'minutos'
  const [sendingNoti, setSendingNoti] = useState(false)

  // Estado para el favicon y logo sidebar
  const [uploadingImage, setUploadingImage] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const fileInputRef = useRef(null)
  const logoFileInputRef = useRef(null)

  const [tiempoLimitePago, setTiempoLimitePago] = useState('15')
  
  // Estados para Banners dinámicos
  const [promoBannerTexto, setPromoBannerTexto] = useState('')
  const [promoBannerLink, setPromoBannerLink] = useState('')
  const [promoBannerIconoUrl, setPromoBannerIconoUrl] = useState('')
  const [tutorialBannerTexto, setTutorialBannerTexto] = useState('')
  const [tutorialBannerLink, setTutorialBannerLink] = useState('')
  
  // Estados faltantes definidos para evitar crash
  const [sidebarTitle, setSidebarTitle] = useState('')
  const [sidebarSubtitle, setSidebarSubtitle] = useState('')
  const [cashbackPorcentaje, setCashbackPorcentaje] = useState('0')
  const [cashbackActivo, setCashbackActivo] = useState(false)
  
  // Estados para Fondo Flotante
  const [bgFloatingEnabled, setBgFloatingEnabled] = useState(false)
  const [bgFloatingSpeed, setBgFloatingSpeed] = useState('10')
  const [bgFloatingDensity, setBgFloatingDensity] = useState('15')
  const [bgFloatingSize, setBgFloatingSize] = useState('80')
  const [bgFloatingOpacity, setBgFloatingOpacity] = useState('0.4')
  const [bgFloatingImages, setBgFloatingImages] = useState([])
  const [bgGlobalUrl, setBgGlobalUrl] = useState('')
  const bgGlobalFileInputRef = useRef(null)
  
  // Estados para Horario de Atención
  const [showHorarioPopup, setShowHorarioPopup] = useState(false)
  const [horarioAtencionTexto, setHorarioAtencionTexto] = useState('Lunes a Domingo: 8:00 AM - 10:00 PM')
  const [horarioFlyerUrl, setHorarioFlyerUrl] = useState('')

  // Estados para selección de productos en Footer
  const [juegosLista, setJuegosLista] = useState([])
  const [footerProductosIds, setFooterProductosIds] = useState([])
  const [savingFooterProductos, setSavingFooterProductos] = useState(false)
  
  // Ref para evitar que las actualizaciones de Realtime sobrescriban lo que el admin está escribiendo
  const initialized = useRef(false)

  // Sincronizar estado local con config al cargar
  React.useEffect(() => {
    // Solo inicializar si no se ha hecho ya y si config tiene datos reales (no {})
    if (!configLoading && config && Object.keys(config).length > 0 && !initialized.current) {
      setSidebarTitle(config.sidebar_title || 'Ceriraga')
      setSidebarSubtitle(config.sidebar_subtitle || 'Centro de Recargas')
      setCashbackPorcentaje(config.cashback_porcentaje || '0')
      setCashbackActivo(config.cashback_activo === 'true')
      setTiempoLimitePago(config.tiempo_limite_pago || '15')
      
      // Banners
      setPromoBannerTexto(config.promo_banner_texto || '')
      setPromoBannerLink(config.promo_banner_link || '')
      setPromoBannerIconoUrl(config.promo_banner_icono_url || '')
      setTutorialBannerTexto(config.tutorial_banner_texto || '')
      setTutorialBannerLink(config.tutorial_banner_link || '')

      // Fondo Flotante
      setBgFloatingEnabled(config.bg_floating_enabled === 'true')
      setBgFloatingSpeed(config.bg_floating_speed || '10')
      setBgFloatingDensity(config.bg_floating_density || '15')
      setBgFloatingSize(config.bg_floating_size || '80')
      setBgFloatingOpacity(config.bg_floating_opacity || '0.4')
      try {
        setBgFloatingImages(JSON.parse(config.bg_floating_images || '[]'))
      } catch (e) {
        setBgFloatingImages([])
      }

      // Fondo Global
      setBgGlobalUrl(config.fondo_global_url || '')

      // Horario
      setShowHorarioPopup(config.show_horario_popup === 'true')
      setHorarioAtencionTexto(config.horario_atencion_texto || 'Lunes a Domingo: 8:00 AM - 10:00 PM')
      setHorarioFlyerUrl(config.horario_flyer_url || '')

      // Footer productos
      try {
        setFooterProductosIds(JSON.parse(config.footer_productos_ids || '[]'))
      } catch (e) {
        setFooterProductosIds([])
      }

      initialized.current = true
    }
  }, [config, configLoading])

  // Cargar juegos al entrar a la pestaña footer
  React.useEffect(() => {
    if (activeTab === 'footer' && juegosLista.length === 0) {
      supabase
        .from('juegos')
        .select('id, nombre, icono_url, activo')
        .is('owner_id', null)
        .order('nombre')
        .then(({ data }) => setJuegosLista(data || []))
    }
  }, [activeTab])

  const toggleFooterProducto = (id) => {
    setFooterProductosIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSaveFooterProductos = async () => {
    setSavingFooterProductos(true)
    await updateConfig('footer_productos_ids', JSON.stringify(footerProductosIds), true)
    setSavingFooterProductos(false)
    setAlertModal({ type: 'success', message: `✅ Productos del footer actualizados (${footerProductosIds.length} seleccionados)` })
  }

  const handleEdit = (metodo) => {
    setCurrentMetodo(metodo)
    setIsEditing(true)
    setShowForm(true)
  }

  const handleAddNew = () => {
    setCurrentMetodo({ nombre: '', datos: '', activo: true, icono_url: null, qr_url: null })
    setIsEditing(false)
    setShowForm(true)
  }

  const handleIconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const pngBlob = await removeWhiteBackground(file)
      const path = `payment-icons/${Date.now()}.png`
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, pngBlob, { contentType: 'image/png' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      setCurrentMetodo(prev => ({ ...prev, icono_url: publicUrl }))
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al subir el icono: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleQRUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    try {
      // Para el QR no removemos fondo blanco, lo subimos tal cual para asegurar legibilidad
      const path = `qr-codes/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      setCurrentMetodo(prev => ({ ...prev, qr_url: publicUrl }))
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al subir el QR: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFloatingImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const pngBlob = await removeWhiteBackground(file)
      const path = `floating-bg/${Date.now()}.png`
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, pngBlob, { contentType: 'image/png' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      
      const newImages = [...bgFloatingImages, publicUrl]
      setBgFloatingImages(newImages)
      await updateConfig('bg_floating_images', JSON.stringify(newImages), true)
      setAlertModal({ type: 'success', message: 'Imagen añadida correctamente al efecto flotante' })
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al subir la imagen: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveFloatingImage = async (url) => {
    const newImages = bgFloatingImages.filter(img => img !== url)
    setBgFloatingImages(newImages)
    await updateConfig('bg_floating_images', JSON.stringify(newImages), true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isEditing) {
      await updateMetodo(currentMetodo.id, { 
        nombre: currentMetodo.nombre, 
        datos: currentMetodo.datos,
        activo: currentMetodo.activo,
        icono_url: currentMetodo.icono_url,
        qr_url: currentMetodo.qr_url
      })
    } else {
      await createMetodo(currentMetodo.nombre, currentMetodo.datos, currentMetodo.icono_url, currentMetodo.qr_url)
    }
    setShowForm(false)
  }

  const toggleStatus = async (metodo) => {
    await updateMetodo(metodo.id, { activo: !metodo.activo })
  }

  const handleTaskbarIconUpload = async (key, file) => {
    if (!file) return
    setUploadingImage(true)
    try {
      const pngBlob = await removeWhiteBackground(file)
      const fileName = `taskbar_${key}_${Date.now()}.png`
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, pngBlob, { contentType: 'image/png' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      await updateConfig(`tb_icon_${key}`, publicUrl, true)
      refetchConfig()
      setAlertModal({ type: 'success', message: 'Icono actualizado correctamente' })
    } catch (error) {
      setAlertModal({ type: 'error', message: 'Error al subir la imagen: ' + error.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const pngBlob = await removeWhiteBackground(file)
      const fileName = `favicon-${Date.now()}.png`
      const filePath = `system/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, pngBlob, { contentType: 'image/png' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      await updateConfig('favicon_url', publicUrl, true)
      
       // Actualizar dinamicamente en DOM para verlo instantaneo
       const existingLinks = document.querySelectorAll("link[rel~='icon']")
       existingLinks.forEach(l => l.parentNode.removeChild(l))

       const newLink = document.createElement('link')
       newLink.rel = 'icon'
       newLink.href = publicUrl
       if (publicUrl.toLowerCase().endsWith('.svg')) newLink.type = 'image/svg+xml'
       else if (publicUrl.toLowerCase().endsWith('.png')) newLink.type = 'image/png'
       else if (publicUrl.toLowerCase().endsWith('.ico')) newLink.type = 'image/x-icon'

       document.head.appendChild(newLink)

    } catch (err) {
      console.error('Error subiendo favicon:', err)
      setAlertModal({ type: 'error', message: 'Error subiendo la imagen al servidor: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSidebarLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const pngBlob = await removeWhiteBackground(file)
      const fileName = `sidebar-logo-${Date.now()}.png`
      const filePath = `system/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, pngBlob, { contentType: 'image/png' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      await updateConfig('sidebar_logo_url', publicUrl, true)
      refetchConfig()
      setAlertModal({ type: 'success', message: 'Logo del panel actualizado correctamente' })
    } catch (err) {
      console.error('Error subiendo logo:', err)
      setAlertModal({ type: 'error', message: 'Error subiendo la imagen: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleBgGlobalUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingImage(true)
    try {
      // Use original file for background to preserve quality and since it might not be a logo with white background
      const fileName = `bg-global-${Date.now()}.${file.name.split('.').pop()}`
      const filePath = `system/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      await updateConfig('fondo_global_url', publicUrl, true)
      setBgGlobalUrl(publicUrl)
      refetchConfig()
      setAlertModal({ type: 'success', message: 'Fondo global actualizado correctamente' })
    } catch (err) {
      console.error('Error subiendo fondo:', err)
      setAlertModal({ type: 'error', message: 'Error subiendo la imagen: ' + err.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSaveSidebarText = async () => {
    try {
      if (sidebarTitle) await updateConfig('sidebar_title', sidebarTitle, true)
      if (sidebarSubtitle) await updateConfig('sidebar_subtitle', sidebarSubtitle, true)
      refetchConfig()
      setAlertModal({ type: 'success', message: 'Textos del panel actualizados correctamente' })
    } catch (err) {
      setAlertModal({ type: 'error', message: 'Error al actualizar los textos' })
    }
  }

  const handleSaveBanners = async () => {
    try {
      await updateConfig('promo_banner_texto', promoBannerTexto, true)
      await updateConfig('promo_banner_link', promoBannerLink, true)
      await updateConfig('promo_banner_icono_url', promoBannerIconoUrl, true)
      await updateConfig('tutorial_banner_texto', tutorialBannerTexto, true)
      await updateConfig('tutorial_banner_link', tutorialBannerLink, true)
      refetchConfig()
      setAlertModal({ type: 'success', message: 'Banners del catálogo actualizados correctamente' })
    } catch (err) {
      console.error('Error guardando banners:', err)
      setAlertModal({ type: 'error', message: 'Error al guardar los campos de banners.' })
    }
  }

  return (
    <div className="page-content">
      <div className="page-header mb-24">
        <div>
          <h1 className="page-title">Configuración del Sistema</h1>
          <p className="page-subtitle">Gestiona los parámetros globales y opciones de pago.</p>
        </div>
      </div>

      <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px' }}>
        {/* Sidebar de Configuración */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!isNegocio && (
            <button 
              className={`btn ${activeTab === 'pagos' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setActiveTab('pagos')}
            >
              💳 Métodos de Pago
            </button>
          )}
          {!isNegocio && (
            <button 
              className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setActiveTab('general')}
            >
              ⚙️ General
            </button>
          )}
          {!isNegocio && (
            <>
              <button 
                className={`btn ${activeTab === 'taskbar' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setActiveTab('taskbar')}
              >
                🔔 Barra de Tareas
              </button>
              <button 
                className={`btn ${activeTab === 'mensajes' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setActiveTab('mensajes')}
              >
                📢 Mensajes Pop-up
              </button>
              <button 
                className={`btn ${activeTab === 'notificaciones' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setActiveTab('notificaciones')}
              >
                🔔 Notificaciones Push
              </button>
              <button 
                className={`btn ${activeTab === 'cashback' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setActiveTab('cashback')}
              >
                💸 Cash Back
              </button>
              <button 
                className={`btn ${activeTab === 'horario' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setActiveTab('horario')}
              >
                📅 Horario Pop-up
              </button>
            </>
          )}
          <button 
            className={`btn ${activeTab === 'efectos' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            onClick={() => setActiveTab('efectos')}
          >
            ✨ Efectos Visuales
          </button>
          {!isNegocio && (
            <button 
              className={`btn ${activeTab === 'footer' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setActiveTab('footer')}
            >
              🌐 Pie de Página
            </button>
          )}
          {!isNegocio && (
            <button 
              className={`btn ${activeTab === 'mobile' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setActiveTab('mobile')}
            >
              📲 App Móvil
            </button>
          )}
        </div>

        {/* Contenido Principal */}
        <div className="card">
          {activeTab === 'pagos' && (
            <>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title">Gestión de Métodos de Pago</h2>
                {!showForm && (
                  <button className="btn btn-primary btn-sm" onClick={handleAddNew}>
                    + Añadir Método
                  </button>
                )}
              </div>

              {!showForm && (
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0, 210, 255, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>⏱️ Tiempo Límite para Pagos</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Minutos que tiene el cliente para realizar y reportar su pago antes de que el pedido sea eliminado automáticamente.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '80px', textAlign: 'center', fontWeight: 'bold' }}
                            value={tiempoLimitePago}
                            onChange={(e) => setTiempoLimitePago(e.target.value)}
                            onBlur={(e) => updateConfig('tiempo_limite_pago', e.target.value)}
                          />
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>minutos</span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => updateConfig('tiempo_limite_pago', tiempoLimitePago).then(() => setAlertModal({ type: 'success', message: 'Tiempo límite actualizado' }))}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding: '24px' }}>
                {showForm ? (
                  <form onSubmit={handleSubmit} className="fade-in">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
                      <div className="payment-upload-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Subir Icono */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-panel)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                           <div style={{ 
                             width: '50px', height: '50px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', 
                             border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', 
                             justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                           }}>
                              {currentMetodo.icono_url ? (
                                <img src={currentMetodo.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: '20px' }}>🖼️</span>
                              )}
                           </div>
                           <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>Icono del Método</p>
                              <input type="file" accept="image/*" onChange={handleIconUpload} style={{ display: 'none' }} id="icon-upload" />
                              <label htmlFor="icon-upload" className="btn btn-ghost btn-xs" style={{ padding: '4px 8px' }}>
                                {uploadingImage ? '...' : 'Subir'}
                              </label>
                           </div>
                        </div>

                        {/* Subir QR */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-panel)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                           <div style={{ 
                             width: '50px', height: '50px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', 
                             border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', 
                             justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                           }}>
                              {currentMetodo.qr_url ? (
                                <img src={currentMetodo.qr_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: '20px' }}>🔳</span>
                              )}
                           </div>
                           <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>Código QR (Pago)</p>
                              <input type="file" accept="image/*" onChange={handleQRUpload} style={{ display: 'none' }} id="qr-upload" />
                              <label htmlFor="qr-upload" className="btn btn-ghost btn-xs" style={{ padding: '4px 8px' }}>
                                {uploadingImage ? '...' : 'Subir'}
                              </label>
                           </div>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nombre del Método</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: Zelle, Pago Móvil, Binance Pay"
                          value={currentMetodo.nombre}
                          onChange={(e) => setCurrentMetodo({...currentMetodo, nombre: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Datos para el Pago</label>
                        <textarea 
                          className="form-input" 
                          style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '14px' }}
                          placeholder="Ej: Correo, Teléfono, Banco, Cédula..."
                          value={currentMetodo.datos}
                          onChange={(e) => setCurrentMetodo({...currentMetodo, datos: e.target.value})}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploadingImage}>
                          {isEditing ? 'Guardar Cambios' : 'Crear Método'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ flex: 1 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {metodosLoading ? (
                      <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando métodos de pago...</p>
                    ) : metodos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '2px dashed var(--border-color)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>No hay métodos de pago registrados.</p>
                        <button className="btn btn-primary" onClick={handleAddNew}>Añadir el primero</button>
                      </div>
                    ) : (
                      metodos.map(m => (
                        <div key={m.id} className="card" style={{ 
                          padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ 
                              width: '56px', height: '56px', borderRadius: '12px', 
                              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                            }}>
                              {m.icono_url ? (
                                <img src={m.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: '20px' }}>
                                  {m.nombre.toLowerCase().includes('zelle') ? '🟣' : 
                                   m.nombre.toLowerCase().includes('pago') ? '📱' : 
                                   m.nombre.toLowerCase().includes('binance') ? '🟡' : '💳'}
                                </span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {m.nombre}
                                {!m.activo && <span className="badge badge-error" style={{ fontSize: '10px' }}>Inactivo</span>}
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'pre-line' }}>
                                {m.datos}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(m)}>Editar</button>
                              <button 
                                className={`btn btn-sm ${m.activo ? 'btn-ghost' : 'btn-primary'}`} 
                                onClick={() => toggleStatus(m)}
                                style={m.activo ? { color: 'var(--accent-error)' } : {}}
                              >
                                {m.activo ? 'Desactivar' : 'Activar'}
                              </button>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => {
                                setAlertModal({
                                  type: 'confirm',
                                  title: 'Eliminar Método',
                                  message: '¿Seguro que deseas eliminar este método?',
                                  onConfirm: () => {
                                    deleteMetodo(m.id)
                                    setAlertModal(null)
                                  }
                                })
                              }}>🗑️</button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {/* Toggle para Billetera USD */}
                              <div 
                                onClick={() => updateMetodo(m.id, { habilitado_billetera: !m.habilitado_billetera })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  cursor: 'pointer', padding: '4px 10px', borderRadius: '8px',
                                  backgroundColor: m.habilitado_billetera ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${m.habilitado_billetera ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                                  transition: 'all 0.2s ease',
                                }}
                                title={m.habilitado_billetera ? 'Desactivar para USD' : 'Activar para USD'}
                              >
                                <span style={{ fontSize: '12px' }}>🇺🇸</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: m.habilitado_billetera ? '#22c55e' : 'var(--text-muted)' }}>
                                  Billetera
                                </span>
                                <div style={{
                                  width: '28px', height: '14px', borderRadius: '7px',
                                  backgroundColor: m.habilitado_billetera ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                  position: 'relative', transition: 'all 0.3s ease',
                                }}>
                                  <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    backgroundColor: 'white', position: 'absolute', top: '2px',
                                    left: m.habilitado_billetera ? '16px' : '2px',
                                    transition: 'all 0.3s ease',
                                  }} />
                                </div>
                              </div>

                              {/* Toggle para Billetera Bs */}
                              <div 
                                onClick={() => updateMetodo(m.id, { habilitado_billetera_bs: !m.habilitado_billetera_bs })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  cursor: 'pointer', padding: '4px 10px', borderRadius: '8px',
                                  backgroundColor: m.habilitado_billetera_bs ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${m.habilitado_billetera_bs ? 'rgba(168, 85, 247, 0.3)' : 'var(--border-color)'}`,
                                  transition: 'all 0.2s ease',
                                }}
                                title={m.habilitado_billetera_bs ? 'Desactivar para Bs' : 'Activar para Bs'}
                              >
                                <span style={{ fontSize: '12px' }}>🇻🇪</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: m.habilitado_billetera_bs ? '#a855f7' : 'var(--text-muted)' }}>
                                  Bolívares
                                </span>
                                <div style={{
                                  width: '28px', height: '14px', borderRadius: '7px',
                                  backgroundColor: m.habilitado_billetera_bs ? '#a855f7' : 'rgba(255,255,255,0.1)',
                                  position: 'relative', transition: 'all 0.3s ease',
                                }}>
                                  <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    backgroundColor: 'white', position: 'absolute', top: '2px',
                                    left: m.habilitado_billetera_bs ? '16px' : '2px',
                                    transition: 'all 0.3s ease',
                                  }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'general' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Configuración General del Sistema</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '600px' }}>
                  
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Identidad Visual (Favicon)</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Sube una imagen para cambiar el icono que aparece en la pestaña del navegador.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                       <div style={{ 
                         width: '80px', height: '80px', borderRadius: '12px', backgroundColor: '#000', 
                         border: '2px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', 
                         alignItems: 'center', justifyContent: 'center' 
                       }}>
                         {config?.favicon_url ? (
                           <img src={config.favicon_url} alt="Favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                         ) : (
                           <span style={{ fontSize: '32px', opacity: 0.3 }}>⚙️</span>
                         )}
                       </div>
                       
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <input 
                           type="file" 
                           ref={fileInputRef} 
                           style={{ display: 'none' }} 
                           accept="image/*"
                           onChange={handleFaviconUpload}
                         />
                         <button 
                           className="btn btn-primary" 
                           onClick={() => fileInputRef.current?.click()}
                           disabled={uploadingImage}
                         >
                           {uploadingImage ? 'Subiendo...' : '📤 Subir Nueva Imagen'}
                         </button>
                         {config?.favicon_url && (
                           <span style={{ fontSize: '12px', color: 'var(--accent-success)' }}>
                             ✓ Favicon activo detectado
                           </span>
                         )}
                       </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Identidad del Panel (Sidebar)</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Personaliza el logo y los textos principales que aparecen en la barra lateral del sistema.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '200px' }}>
                        <label className="form-label">Logo Principal</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           <div style={{ 
                             width: '64px', height: '64px', borderRadius: '12px', backgroundColor: '#000', 
                             border: '2px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', 
                             alignItems: 'center', justifyContent: 'center' 
                           }}>
                             {config?.sidebar_logo_url ? (
                               <img src={config.sidebar_logo_url} alt="Logo Sidebar" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                             ) : (
                               <span style={{ fontSize: '28px' }}>⚡</span>
                             )}
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                             <input 
                               type="file" 
                               ref={logoFileInputRef} 
                               style={{ display: 'none' }} 
                               accept="image/*"
                               onChange={handleSidebarLogoUpload}
                             />
                             <button 
                               className="btn btn-ghost btn-sm" 
                               style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                               onClick={() => logoFileInputRef.current?.click()}
                               disabled={uploadingImage}
                             >
                               {uploadingImage ? 'Subiendo...' : '📤 Cambiar Logo'}
                             </button>
                           </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minWidth: '250px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '13px' }}>Título Principal</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={sidebarTitle} 
                            onChange={e => setSidebarTitle(e.target.value)} 
                            placeholder="Ej: Ceriraga" 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '13px' }}>Subtítulo</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={sidebarSubtitle} 
                            onChange={e => setSidebarSubtitle(e.target.value)} 
                            placeholder="Ej: Centro de Recargas" 
                          />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveSidebarText}>
                          ✓ Guardar Textos
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Fondo Global de la Aplicación</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Sube una imagen para usarla como fondo en toda la plataforma (Landing y Panel). Se adaptará a cualquier pantalla.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
                       <div style={{ 
                         width: '100%', maxWidth: '280px', height: '160px', borderRadius: '12px', backgroundColor: '#000', 
                         border: '2px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', 
                         alignItems: 'center', justifyContent: 'center' 
                       }}>
                         {bgGlobalUrl ? (
                           <img src={bgGlobalUrl} alt="Fondo Global" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                         ) : (
                           <span style={{ fontSize: '28px' }}>🖼️</span>
                         )}
                       </div>
                       
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <input 
                           type="file" 
                           ref={bgGlobalFileInputRef} 
                           style={{ display: 'none' }} 
                           accept="image/*"
                           onChange={handleBgGlobalUpload}
                         />
                         <button 
                           className="btn btn-primary" 
                           onClick={() => bgGlobalFileInputRef.current?.click()}
                           disabled={uploadingImage}
                         >
                           {uploadingImage ? 'Subiendo...' : '📤 Subir Fondo Global'}
                         </button>
                         {bgGlobalUrl && (
                           <>
                             <span style={{ fontSize: '12px', color: 'var(--accent-success)' }}>
                               ✓ Fondo activo detectado
                             </span>
                             <button 
                               className="btn btn-danger btn-sm" 
                               onClick={async () => {
                                 await updateConfig('fondo_global_url', '', true);
                                 setBgGlobalUrl('');
                               }}
                             >
                               Eliminar Fondo
                             </button>
                           </>
                         )}
                       </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Estado de Operaciones</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Controla la visibilidad del cartel de disponibilidad para los clientes.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Toggle Visibilidad */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '15px' }}>Mostrar Cartel Público</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Visible en el catálogo superior</p>
                        </div>
                        <button 
                          onClick={() => updateConfig('mostrar_banner_estado', config?.mostrar_banner_estado === 'true' ? 'false' : 'true', true)}
                          style={{
                            width: '44px', height: '22px', borderRadius: '11px', 
                            backgroundColor: config?.mostrar_banner_estado === 'true' ? 'var(--accent-success)' : '#3f3f46',
                            position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.3s'
                          }}
                        >
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                            position: 'absolute', top: '3px', 
                            left: config?.mostrar_banner_estado === 'true' ? '25px' : '3px',
                            transition: 'all 0.3s'
                          }} />
                        </button>
                      </div>

                      {/* Selector de Estado */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <button 
                          onClick={() => updateConfig('estado_operativo', 'activo', true)}
                          className={`btn ${config?.estado_operativo === 'activo' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ 
                            display: 'flex', gap: '12px', padding: '16px', height: 'auto',
                            border: config?.estado_operativo === 'activo' ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: config?.estado_operativo === 'activo' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                            color: config?.estado_operativo === 'activo' ? '#22c55e' : 'var(--text-muted)'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🟢</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800 }}>Activos</div>
                            <div style={{ fontSize: '10px', opacity: 0.8 }}>Procesando pedidos</div>
                          </div>
                        </button>
                        <button 
                          onClick={() => updateConfig('estado_operativo', 'descanso', true)}
                          className={`btn ${config?.estado_operativo === 'descanso' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ 
                            display: 'flex', gap: '12px', padding: '16px', height: 'auto',
                            border: config?.estado_operativo === 'descanso' ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: config?.estado_operativo === 'descanso' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            color: config?.estado_operativo === 'descanso' ? '#ef4444' : 'var(--text-muted)'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🔴</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800 }}>Descanso</div>
                            <div style={{ fontSize: '10px', opacity: 0.8 }}>Horario de pausa</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Banners del Catálogo</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Configura el anuncio especial (con ícono) y el banner de tutorial en la pantalla del catálogo de los paquetes.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ color: 'var(--accent-primary)' }}>🎁 Banner Promocional Principal</label>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Texto. Ej: Gira y gana en nuestra ruleta..."
                            value={promoBannerTexto}
                            onChange={(e) => setPromoBannerTexto(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="URL Link de destino. Ej: /ruleta"
                            value={promoBannerLink}
                            onChange={(e) => setPromoBannerLink(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="URL de Ícono/Imagen promocional. Ej: https://..."
                            value={promoBannerIconoUrl}
                            onChange={(e) => setPromoBannerIconoUrl(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0, paddingBottom: 0 }}>
                        <label className="form-label" style={{ color: 'var(--accent-warning)' }}>🔔 Banner del Tutorial (Campanita)</label>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Texto. Ej: ¿Aún no sabes recargar vía Pago Móvil?"
                            value={tutorialBannerTexto}
                            onChange={(e) => setTutorialBannerTexto(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="URL del tutorial / Link de destino. Ej: https://youtube.com/..."
                            value={tutorialBannerLink}
                            onChange={(e) => setTutorialBannerLink(e.target.value)}
                          />
                        </div>
                      </div>

                      <button 
                        className="btn btn-primary" 
                        onClick={handleSaveBanners}
                        style={{ marginTop: '8px' }}
                      >
                        ✓ Guardar Cambios en Banners
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'taskbar' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Barra de Tareas</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                  Personaliza los iconos y notificaciones que aparecen en la barra superior del sistema.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { key: 'pagos_pendientes', icon: '💳', label: 'Pagos Pendientes por Confirmar', desc: 'Muestra la cantidad de pagos sin verificar' },
                    { key: 'ordenes_pendientes', icon: '📋', label: 'Órdenes Pendientes por Procesar', desc: 'Pedidos en estado pendiente' },
                    { key: 'recargas_pendientes', icon: '⚡', label: 'Recargas Pendientes', desc: 'Pagos verificados pero no completados' },
                    { key: 'usuarios_online', icon: '👥', label: 'Usuarios en Línea', desc: 'Cantidad de usuarios conectados' },
                  ].map(item => {
                    const iconUrl = config[`tb_icon_${item.key}`]
                    return (
                      <div key={item.key} className="card" style={{ 
                        padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <label style={{ 
                            width: '48px', height: '48px', borderRadius: '12px', 
                            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                            cursor: uploadingImage ? 'not-allowed' : 'pointer', overflow: 'hidden', position: 'relative'
                          }} title="Haz clic para cambiar el icono">
                            {iconUrl ? (
                              <img src={iconUrl} alt="Icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              item.icon
                            )}
                            <div style={{
                              position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: 0, transition: 'opacity 0.2s', fontSize: '12px', color: 'white'
                            }} className="hover:opacity-100">
                              ✏️
                            </div>
                            <input 
                              type="file" 
                              style={{ display: 'none' }} 
                              accept="image/*"
                              disabled={uploadingImage}
                              onChange={(e) => {
                                if (e.target.files[0]) handleTaskbarIconUpload(item.key, e.target.files[0])
                              }}
                            />
                          </label>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{item.label}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
                          </div>
                        </div>
                        
                        {/* Toggle de Visibilidad */}
                        <div 
                          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                          onClick={() => updateConfig(`tb_show_${item.key}`, config[`tb_show_${item.key}`] === 'false' ? 'true' : 'false', true)}
                        >
                          <span style={{ 
                            fontSize: '12px', 
                            color: config[`tb_show_${item.key}`] !== 'false' ? 'var(--accent-success)' : 'var(--text-muted)', 
                            fontWeight: 600,
                            transition: 'all 0.3s ease'
                          }}>
                            {config[`tb_show_${item.key}`] !== 'false' ? 'Activo' : 'Inactivo'}
                          </span>
                          <div style={{
                            width: '40px', height: '22px', borderRadius: '11px', 
                            backgroundColor: config[`tb_show_${item.key}`] !== 'false' ? 'var(--accent-success)' : '#3f3f46',
                            position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease'
                          }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                              position: 'absolute', top: '2px', 
                              left: config[`tb_show_${item.key}`] !== 'false' ? '20px' : '2px', 
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(0, 210, 255, 0.06)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.15)' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    💡 <strong>Tip:</strong> Los contadores se actualizan automáticamente cada 30 segundos. Los iconos sin actividad se muestran atenuados en la barra.
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'mensajes' && (
            <>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="card-title">Mensajes Emergentes (Pop-ups)</h2>
                {!showMensajeForm && (
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setCurrentMensaje({ titulo: '', contenido: '', activo: true, imagen_url: null })
                    setIsEditingMensaje(false)
                    setShowMensajeForm(true)
                  }}>
                    + Nuevo Mensaje
                  </button>
                )}
              </div>

              <div style={{ padding: '24px' }}>
                {showMensajeForm ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (isEditingMensaje) {
                      await updateMensaje(currentMensaje.id, currentMensaje)
                    } else {
                      await createMensaje(currentMensaje)
                    }
                    setShowMensajeForm(false)
                  }} className="fade-in">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ 
                          width: '120px', height: '80px', borderRadius: '12px', backgroundColor: 'var(--bg-panel)', 
                          border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', 
                          justifyContent: 'center', overflow: 'hidden'
                        }}>
                          {currentMensaje.imagen_url ? (
                            <img src={currentMensaje.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '24px' }}>🖼️</span>
                          )}
                        </div>
                        <div>
                          <input type="file" accept="image/*" style={{ display: 'none' }} id="msg-img-upload" 
                            onChange={async (e) => {
                              const file = e.target.files[0]
                              if (!file) return
                              setUploadingImage(true)
                              try {
                                const path = `popups/${Date.now()}.png`
                                const { error: uploadError } = await supabase.storage.from('logos').upload(path, file)
                                if (uploadError) throw uploadError
                                const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
                                setCurrentMensaje(prev => ({ ...prev, imagen_url: publicUrl }))
                              } finally {
                                setUploadingImage(false)
                              }
                            }} 
                          />
                          <label htmlFor="msg-img-upload" className="btn btn-ghost btn-sm">
                            {uploadingImage ? 'Subiendo...' : '📤 Subir Imagen'}
                          </label>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Opcional: Se mostrará en el centro del pop-up</p>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Título del Mensaje</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={currentMensaje.titulo}
                          onChange={(e) => setCurrentMensaje({...currentMensaje, titulo: e.target.value})}
                          required
                          placeholder="Ej: ¡Nueva Promoción de Diamantes!"
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                          <label className="form-label">Hora de Inicio (Activación)</label>
                          <input 
                            type="time" 
                            className="form-input"
                            value={currentMensaje.hora_inicio || ''}
                            onChange={(e) => setCurrentMensaje({...currentMensaje, hora_inicio: e.target.value})}
                          />
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Dejar vacío para siempre activo</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Hora de Fin (Desactivación)</label>
                          <input 
                            type="time" 
                            className="form-input"
                            value={currentMensaje.hora_fin || ''}
                            onChange={(e) => setCurrentMensaje({...currentMensaje, hora_fin: e.target.value})}
                          />
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Dejar vacío para siempre activo</p>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Contenido HTML / Texto</label>
                        <textarea 
                          className="form-input" 
                          style={{ minHeight: '150px' }}
                          value={currentMensaje.contenido}
                          onChange={(e) => setCurrentMensaje({...currentMensaje, contenido: e.target.value})}
                          required
                          placeholder="Escribe el mensaje que verán los clientes..."
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox" 
                          id="msg-active"
                          checked={currentMensaje.activo}
                          onChange={(e) => setCurrentMensaje({...currentMensaje, activo: e.target.checked})}
                        />
                        <label htmlFor="msg-active" style={{ cursor: 'pointer', fontSize: '14px' }}>Mensaje Activo (Se mostrará a los clientes)</label>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploadingImage}>
                          {isEditingMensaje ? 'Actualizar' : 'Crear'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowMensajeForm(false)} style={{ flex: 1 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {mensajesLoading ? (
                      <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando mensajes...</p>
                    ) : mensajes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                        No hay mensajes de sistema configurados.
                      </div>
                    ) : (
                      mensajes.map(m => (
                        <div key={m.id} className="card" style={{ 
                          padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ width: 48, height: 32, borderRadius: 4, backgroundColor: '#000', overflow: 'hidden' }}>
                              {m.imagen_url && <img src={m.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{m.titulo}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(m.creado_at).toLocaleDateString()}</div>
                            </div>
                            {m.activo && <span className="badge badge-success">Activo</span>}
                            {(m.hora_inicio || m.hora_fin) && (
                              <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                ⏰ {m.hora_inicio || '00:00'} - {m.hora_fin || '23:59'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                              setCurrentMensaje(m)
                              setIsEditingMensaje(true)
                              setShowMensajeForm(true)
                            }}>Editar</button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => {
                              setAlertModal({
                                type: 'confirm',
                                title: 'Eliminar Mensaje',
                                message: '¿Estás seguro de eliminar este mensaje?',
                                onConfirm: () => {
                                  deleteMensaje(m.id)
                                  setAlertModal(null)
                                }
                              })
                            }}>🗑️</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'notificaciones' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Enviar Notificación Push (En Vivo)</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                  Escribe un mensaje que llegará instantáneamente a todos los clientes que estén navegando el sitio.
                </p>

                <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Título de la Notificación</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: ¡Nuevo Juego Añadido!"
                        value={formNoti.titulo}
                        onChange={(e) => setFormNoti({...formNoti, titulo: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mensaje</label>
                      <textarea 
                        className="form-input" 
                        style={{ minHeight: '100px' }}
                        placeholder="Ej: Ya puedes recargar tus diamantes en Free Fire Max..."
                        value={formNoti.mensaje}
                        onChange={(e) => setFormNoti({...formNoti, mensaje: e.target.value})}
                      ></textarea>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Duración de visibilidad</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <button 
                          type="button"
                          className={`btn btn-xs ${notiUnidad === 'horas' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ borderRadius: '8px', fontSize: '10px', padding: '4px 12px' }}
                          onClick={() => { setNotiUnidad('horas'); if(notiDuracion > 72) setNotiDuracion(24); }}
                        >Horas</button>
                        <button 
                          type="button"
                          className={`btn btn-xs ${notiUnidad === 'minutos' ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ borderRadius: '8px', fontSize: '10px', padding: '4px 12px' }}
                          onClick={() => { setNotiUnidad('minutos'); if(notiDuracion > 60) setNotiDuracion(30); }}
                        >Minutos</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                          type="range" 
                          min="1" 
                          max={notiUnidad === 'horas' ? "72" : "60"} 
                          step="1"
                          style={{ flex: 1 }}
                          value={notiDuracion}
                          onChange={(e) => setNotiDuracion(parseInt(e.target.value))}
                        />
                        <span style={{ 
                          width: '80px', textAlign: 'center', backgroundColor: 'var(--bg-panel)', 
                          padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)'
                        }}>
                          {notiDuracion}{notiUnidad === 'horas' ? 'h' : 'm'}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        La notificación desaparecerá automáticamente después de {notiDuracion} {notiUnidad}.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, height: '48px', fontSize: '16px', fontWeight: 700 }}
                        disabled={sendingNoti || !formNoti.titulo || !formNoti.mensaje}
                        onClick={async () => {
                          setSendingNoti(true)
                          try {
                            const duracionFinal = notiUnidad === 'horas' ? notiDuracion * 60 : notiDuracion
                            const { error } = await enviarNotificacion(formNoti, duracionFinal)
                            if (error) throw error
                            setAlertModal({ type: 'success', message: '¡Notificación enviada con éxito!' })
                            setFormNoti({ titulo: '', mensaje: '', imagen_url: null })
                          } catch (err) {
                            setAlertModal({ type: 'error', message: 'Error: ' + err.message })
                          } finally {
                            setSendingNoti(false)
                          }
                        }}
                      >
                        {sendingNoti ? 'Enviando...' : '🚀 Enviar Notificación'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ 
                      padding: '20px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        width: '100%', height: '140px', borderRadius: '12px', backgroundColor: 'var(--bg-card)',
                        border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', overflow: 'hidden', marginBottom: '16px'
                      }}>
                        {formNoti.imagen_url ? (
                          <img src={formNoti.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '32px' }}>🖼️</span>
                        )}
                      </div>
                      <input 
                        type="file" 
                        id="noti-img-upload" 
                        style={{ display: 'none' }} 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0]
                          if (!file) return
                          setUploadingImage(true)
                          try {
                            const path = `notificaciones/${Date.now()}.png`
                            const { error: uploadError } = await supabase.storage.from('logos').upload(path, file)
                            if (uploadError) throw uploadError
                            const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
                            setFormNoti(prev => ({ ...prev, imagen_url: publicUrl }))
                          } finally {
                            setUploadingImage(false)
                          }
                        }}
                      />
                      <label htmlFor="noti-img-upload" className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
                        {uploadingImage ? 'Subiendo...' : '📤 Subir Imagen'}
                      </label>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Opcional: La imagen será visible en la esquina de la notificación.
                      </p>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'rgba(0, 210, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        💡 <strong>Aviso:</strong> Esta acción es irreversible y masiva. Todos los usuarios conectados recibirán el mensaje y escucharán la campanita.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'cashback' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Retorno (Cash Back)</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '600px' }}>
                  
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Sistema de Cash Back Global</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                      Cuando está activo, el sistema retornará un porcentaje del monto total de los pedidos completados a la billetera del usuario.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Toggle Visibilidad */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '15px' }}>Habilitar Cash Back</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Otorgará el saldo automáticamente al completar pedidos</p>
                        </div>
                        <button 
                          onClick={() => {
                            const newValue = !cashbackActivo
                            setCashbackActivo(newValue)
                            updateConfig('cashback_activo', newValue ? 'true' : 'false', true)
                          }}
                          style={{
                            width: '44px', height: '22px', borderRadius: '11px', 
                            backgroundColor: cashbackActivo ? 'var(--accent-success)' : '#3f3f46',
                            position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.3s'
                          }}
                        >
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                            position: 'absolute', top: '3px', 
                            left: cashbackActivo ? '25px' : '3px',
                            transition: 'all 0.3s'
                          }} />
                        </button>
                      </div>

                      {/* Porcentaje */}
                      <div className="form-group" style={{ opacity: cashbackActivo ? 1 : 0.5, pointerEvents: cashbackActivo ? 'auto' : 'none' }}>
                        <label className="form-label" style={{ fontSize: '13px' }}>Porcentaje de Retorno (%)</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            inputMode="decimal"
                            className="form-input" 
                            style={{ maxWidth: '150px', fontSize: '18px', fontWeight: 'bold' }}
                            value={cashbackPorcentaje} 
                            onChange={(e) => setCashbackPorcentaje(e.target.value.replace(',', '.'))}
                            onBlur={(e) => {
                              const cleanValue = e.target.value.replace(',', '.')
                              updateConfig('cashback_porcentaje', cleanValue, true)
                            }}
                            placeholder="Ej: 5.0" 
                          />
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-muted)' }}>%</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                          Ejemplo: Si el porcentaje es 5% y el usuario gastó $100, recibirá $5.00 en su billetera al completar la recarga.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'horario' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Pop-up de Horario de Atención</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                  Configura un mensaje emergente que se mostrará a los clientes logueados al ingresar a la plataforma para informar sobre el horario laboral.
                </p>

                <div className="responsive-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '15px' }}>Habilitar Pop-up</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Muestra el aviso al entrar (Solo logueados)</p>
                      </div>
                      <button 
                        onClick={() => {
                          const newVal = !showHorarioPopup
                          setShowHorarioPopup(newVal)
                          updateConfig('show_horario_popup', newVal ? 'true' : 'false', true)
                        }}
                        style={{
                          width: '44px', height: '22px', borderRadius: '11px', 
                          backgroundColor: showHorarioPopup ? 'var(--accent-success)' : '#3f3f46',
                          position: 'relative', transition: 'all 0.3s ease', cursor: 'pointer', border: 'none'
                        }}
                      >
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                          position: 'absolute', top: '2px', left: showHorarioPopup ? '24px' : '2px',
                          transition: 'all 0.3s ease'
                        }} />
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Texto del Horario</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Lunes a Viernes: 8am - 10pm"
                        value={horarioAtencionTexto}
                        onChange={(e) => setHorarioAtencionTexto(e.target.value)}
                      />
                    </div>

                    <button 
                      className="btn btn-primary" 
                      onClick={async () => {
                        await updateConfig('horario_atencion_texto', horarioAtencionTexto, true)
                        setAlertModal({ type: 'success', message: 'Texto del horario guardado' })
                      }}
                    >
                      💾 Guardar Texto
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ 
                      width: '100%', aspectRatio: '4/5', borderRadius: '16px', backgroundColor: 'var(--bg-card)',
                      border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', overflow: 'hidden', position: 'relative'
                    }}>
                      {horarioFlyerUrl ? (
                        <img src={horarioFlyerUrl} alt="Flyer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>🖼️</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Flyer del Horario</span>
                        </div>
                      )}
                    </div>
                    
                    <input 
                      type="file" 
                      id="horario-flyer-upload" 
                      style={{ display: 'none' }} 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (!file) return
                        setUploadingImage(true)
                        try {
                          const path = `system/horario_flyer_${Date.now()}.png`
                          const { error: uploadError } = await supabase.storage.from('logos').upload(path, file)
                          if (uploadError) throw uploadError
                          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
                          setHorarioFlyerUrl(publicUrl)
                          await updateConfig('horario_flyer_url', publicUrl, true)
                          setAlertModal({ type: 'success', message: 'Flyer actualizado correctamente' })
                        } catch (err) {
                          setAlertModal({ type: 'error', message: 'Error: ' + err.message })
                        } finally {
                          setUploadingImage(false)
                        }
                      }}
                    />
                    <label htmlFor="horario-flyer-upload" className={`btn ${uploadingImage ? 'btn-ghost' : 'btn-primary'}`} style={{ width: '100%' }}>
                      {uploadingImage ? 'Subiendo...' : '📤 Cambiar Flyer'}
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'efectos' && (
            <>
              <div className="card-header">
                <h2 className="card-title">✨ Efectos Visuales (Fondo)</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
                  
                  {/* Control Maestro */}
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Elementos Flotantes</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Activa imágenes que "levitan" desde el fondo hacia arriba.</p>
                      </div>
                      <button 
                        onClick={() => {
                          const newValue = !bgFloatingEnabled
                          setBgFloatingEnabled(newValue)
                          updateConfig('bg_floating_enabled', newValue ? 'true' : 'false', true)
                        }}
                        style={{
                          width: '50px', height: '26px', borderRadius: '13px', 
                          backgroundColor: bgFloatingEnabled ? 'var(--accent-success)' : '#3f3f46',
                          position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.3s'
                        }}
                      >
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                          position: 'absolute', top: '3px', 
                          left: bgFloatingEnabled ? '27px' : '3px',
                          transition: 'all 0.3s'
                        }} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', opacity: bgFloatingEnabled ? 1 : 0.5, pointerEvents: bgFloatingEnabled ? 'auto' : 'none' }}>
                      <div className="form-group">
                        <label className="form-label">Velocidad de Ascenso ({bgFloatingSpeed})</label>
                        <input 
                          type="range" min="1" max="50" 
                          value={bgFloatingSpeed} 
                          onChange={(e) => setBgFloatingSpeed(e.target.value)}
                          onMouseUp={() => updateConfig('bg_floating_speed', bgFloatingSpeed, true)}
                          onTouchEnd={() => updateConfig('bg_floating_speed', bgFloatingSpeed, true)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Densidad / Cantidad ({bgFloatingDensity})</label>
                        <input 
                          type="range" min="5" max="50" 
                          value={bgFloatingDensity} 
                          onChange={(e) => setBgFloatingDensity(e.target.value)}
                          onMouseUp={() => updateConfig('bg_floating_density', bgFloatingDensity, true)}
                          onTouchEnd={() => updateConfig('bg_floating_density', bgFloatingDensity, true)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tamaño Base ({bgFloatingSize}px)</label>
                        <input 
                          type="range" min="30" max="150" 
                          value={bgFloatingSize} 
                          onChange={(e) => setBgFloatingSize(e.target.value)}
                          onMouseUp={() => updateConfig('bg_floating_size', bgFloatingSize, true)}
                          onTouchEnd={() => updateConfig('bg_floating_size', bgFloatingSize, true)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Opacidad / Transparencia ({Math.round(parseFloat(bgFloatingOpacity) * 100)}%)</label>
                        <input 
                          type="range" min="0.05" max="1" step="0.05"
                          value={bgFloatingOpacity} 
                          onChange={(e) => setBgFloatingOpacity(e.target.value)}
                          onMouseUp={() => updateConfig('bg_floating_opacity', bgFloatingOpacity, true)}
                          onTouchEnd={() => updateConfig('bg_floating_opacity', bgFloatingOpacity, true)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Galería de Imágenes */}
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Imágenes del Efecto</h3>
                      <div>
                        <input type="file" id="bg-img-upload" style={{ display: 'none' }} accept="image/*" onChange={handleFloatingImageUpload} disabled={uploadingImage} />
                        <label htmlFor="bg-img-upload" className="btn btn-primary btn-sm">
                          {uploadingImage ? 'Procesando...' : '+ Subir Imagen'}
                        </label>
                      </div>
                    </div>
                    
                    {bgFloatingImages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        No hay imágenes configuradas. Sube algunas (cubos, monedas, logos) para ver el efecto.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '16px' }}>
                        {bgFloatingImages.map((img, idx) => (
                          <div key={idx} style={{ 
                            position: 'relative', height: '100px', borderRadius: '12px', 
                            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px'
                          }}>
                            <img src={img} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            <button 
                              onClick={() => handleRemoveFloatingImage(img)}
                              style={{ 
                                position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', 
                                borderRadius: '50%', backgroundColor: 'var(--accent-danger)', color: 'white',
                                border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      💡 <strong>Tip:</strong> El sistema removerá automáticamente el fondo blanco de las imágenes que subas para que se vean transparentes.
                    </p>
                    <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--accent-warning)', backgroundColor: 'rgba(255, 209, 102, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 209, 102, 0.1)' }}>
                      ⚠️ <strong>Rendimiento:</strong> Una densidad muy alta (&gt;25) puede causar lentitud en dispositivos móviles. Se recomienda mantener un equilibrio para asegurar una navegación fluida.
                    </p>
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'mobile' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Gestión de App Android (APK)</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '600px' }}>
                  
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ fontSize: '32px' }}>📲</div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Instalador APK</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sube la última versión de tu aplicación para que los usuarios la descarguen.</p>
                      </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '15px' }}>Mostrar Botón de Descarga</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Activa o desactiva la visibilidad del botón "Descargar App" en el menú principal</p>
                      </div>
                      <button 
                        onClick={() => {
                          const isCurrentlyActive = config?.mostrar_boton_app !== 'false' && config?.mostrar_boton_app !== false
                          updateConfig('mostrar_boton_app', isCurrentlyActive ? 'false' : 'true', true)
                        }}
                        style={{
                          width: '44px', height: '22px', borderRadius: '11px', 
                          backgroundColor: (config?.mostrar_boton_app !== 'false' && config?.mostrar_boton_app !== false) ? 'var(--accent-success)' : '#3f3f46',
                          position: 'relative', transition: 'all 0.3s ease', cursor: 'pointer', border: 'none'
                        }}
                      >
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                          position: 'absolute', top: '2px', left: (config?.mostrar_boton_app !== 'false' && config?.mostrar_boton_app !== false) ? '24px' : '2px',
                          transition: 'all 0.3s ease'
                        }} />
                      </button>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>URL Actual del APK:</div>
                      <div style={{ 
                        fontSize: '13px', color: 'var(--accent-primary)', wordBreak: 'break-all', 
                        backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        {config?.apk_url || 'No se ha subido ningún APK aún.'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">Subir Nuevo APK</label>
                        <input 
                          type="file" 
                          accept=".apk"
                          onChange={async (e) => {
                            const file = e.target.files[0]
                            if (!file) return
                            if (!file.name.toLowerCase().endsWith('.apk')) {
                              setAlertModal({ type: 'error', message: 'Por favor selecciona un archivo .apk válido' })
                              return
                            }
                            
                            setUploadingImage(true)
                            try {
                              const fileName = `apps/ceriraga-v${Date.now()}.apk`
                              const { error: uploadError } = await supabase.storage
                                .from('logos')
                                .upload(fileName, file)

                              if (uploadError) throw uploadError

                              const { data: { publicUrl } } = supabase.storage
                                .from('logos')
                                .getPublicUrl(fileName)

                              await updateConfig('apk_url', publicUrl, true)
                              refetchConfig()
                              setAlertModal({ type: 'success', message: '¡APK actualizado con éxito! El botón de descarga ya está disponible para todos.' })
                            } catch (err) {
                              setAlertModal({ type: 'error', message: 'Error al subir el APK: ' + err.message })
                            } finally {
                              setUploadingImage(false)
                              e.target.value = null
                            }
                          }}
                          disabled={uploadingImage}
                          className="form-input"
                          style={{ padding: '10px' }}
                        />
                      </div>
                      
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nota: Al subir un nuevo archivo, el botón "Descargar App" se actualizará automáticamente con la nueva versión para todos los clientes.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'footer' && !isNegocio && (
            <>
              <div className="card-header">
                <h2 className="card-title">🌐 Configuración del Pie de Página</h2>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '640px' }}>

                  {/* Descripción del footer */}
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>📝 Texto Descriptivo</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                      Pequeño texto que aparece debajo del logo en el pie de página.
                    </p>
                    <textarea
                      className="form-input"
                      rows={3}
                      defaultValue={config?.footer_descripcion || ''}
                      placeholder="Ej: Recargas, gift cards y servicios digitales al instante."
                      onBlur={e => updateConfig('footer_descripcion', e.target.value, true)}
                      style={{ resize: 'vertical', fontSize: '13px' }}
                    />
                  </div>

                  {/* Redes Sociales */}
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>📣 Redes Sociales</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                      Ingresa la URL completa de cada perfil. Deja en blanco los que no apliquen (el botón no aparecerá en el footer).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {[
                        { key: 'footer_instagram', label: 'Instagram', icon: '📸', placeholder: 'https://instagram.com/tucuenta' },
                        { key: 'footer_tiktok',    label: 'TikTok',    icon: '🎵', placeholder: 'https://tiktok.com/@tucuenta' },
                        { key: 'footer_youtube',   label: 'YouTube',   icon: '▶️', placeholder: 'https://youtube.com/@tucanal' },
                        { key: 'footer_whatsapp',  label: 'WhatsApp',  icon: '💬', placeholder: '+584121234567 (solo número, sin +)' },
                        { key: 'footer_facebook',  label: 'Facebook',  icon: '👥', placeholder: 'https://facebook.com/tupagina' },
                        { key: 'footer_twitter',   label: 'X (Twitter)', icon: '🐦', placeholder: 'https://x.com/tucuenta' },
                      ].map(({ key, label, icon, placeholder }) => (
                        <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{icon}</span> {label}
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            defaultValue={config?.[key] || ''}
                            placeholder={placeholder}
                            onBlur={e => updateConfig(key, e.target.value, true)}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'rgba(0,210,255,0.06)', borderRadius: '8px', border: '1px solid rgba(0,210,255,0.15)' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        💡 Los cambios se guardan automáticamente al salir de cada campo. Si configuras al menos una red social, aparecerá la sección "¡Síguenos en nuestras redes!" en el pie de página.
                      </p>
                    </div>
                  </div>

                  {/* Productos en el Footer */}
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🎮 Productos en el Pie de Página</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
                          Selecciona cuáles servicios aparecen en la columna de Productos del footer.
                          {footerProductosIds.length > 0 && (
                            <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                              ({footerProductosIds.length} seleccionados)
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveFooterProductos}
                        disabled={savingFooterProductos}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {savingFooterProductos ? '⏳ Guardando...' : '💾 Guardar selección'}
                      </button>
                    </div>

                    {juegosLista.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                        Cargando servicios...
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', marginTop: '16px' }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => setFooterProductosIds(juegosLista.filter(j => j.activo).map(j => j.id))}
                          >
                            ✅ Seleccionar todos los activos
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--accent-error)' }}
                            onClick={() => setFooterProductosIds([])}
                          >
                            🗑️ Limpiar selección
                          </button>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: '8px',
                          maxHeight: '420px',
                          overflowY: 'auto',
                          paddingRight: '4px'
                        }}>
                          {juegosLista.map(j => {
                            const selected = footerProductosIds.includes(j.id)
                            return (
                              <div
                                key={j.id}
                                onClick={() => toggleFooterProducto(j.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  padding: '10px 12px', borderRadius: '10px',
                                  border: selected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.07)',
                                  backgroundColor: selected ? 'rgba(0,210,255,0.08)' : 'rgba(255,255,255,0.03)',
                                  cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                                  opacity: j.activo ? 1 : 0.45
                                }}
                              >
                                <div style={{
                                  width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                                  border: selected ? '2px solid var(--accent-primary)' : '2px solid rgba(255,255,255,0.2)',
                                  backgroundColor: selected ? 'var(--accent-primary)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '11px', color: '#000', fontWeight: 900, transition: 'all 0.15s'
                                }}>
                                  {selected && '✓'}
                                </div>
                                {j.icono_url ? (
                                  <img src={j.icono_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg,#7b2ff7,#00d2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🎮</div>
                                )}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: selected ? '#fff' : '#c8d6e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {j.nombre}
                                  </div>
                                  {!j.activo && <div style={{ fontSize: '10px', color: 'var(--accent-error)' }}>Inactivo</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: 'rgba(0,210,255,0.06)', borderRadius: '8px', border: '1px solid rgba(0,210,255,0.15)', fontSize: '12px', color: 'var(--text-muted)' }}>
                          💡 Si no seleccionas ninguno, el footer mostrará automáticamente los primeros 8 servicios del catálogo. Presiona "Guardar selección" para aplicar los cambios.
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm || (() => setAlertModal(null))}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
