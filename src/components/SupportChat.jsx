import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'

export default function SupportChat({ perfil, forceOpen, onClose, onNavigate, isPage = false }) {
  const [isOpen, setIsOpen] = useState(isPage)
  const [isHovered, setIsHovered] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [deleteData, setDeleteData] = useState({ isOpen: false, messageId: null })
  const [ticketSubject, setTicketSubject] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  let messagesEndRef = useRef(null)

  useEffect(() => {
    if (forceOpen) setIsOpen(true)
  }, [forceOpen])  // Solo cargar el ID del perfil actual
  const currentUserId = perfil?.id
  const currentClienteId = perfil?.cliente_uuid || perfil?.id
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'

  // Variables específicas para ADMIN (lista de chats)
  const [activeChats, setActiveChats] = useState([]) // Lista de clientes con chat
  const [selectedChatClient, setSelectedChatClient] = useState(null) // Cliente seleccionado por el admin

  // Autoscroll para cuando se abre o seleccionan chats
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }, [mensajes, isOpen, selectedChatClient])

  // Variables para saber en qué sala (cliente_id) estamos
  const activeChatId = isAdmin ? selectedChatClient?.id : currentClienteId

  // Estado para el bloqueo por 25min / respuesta admin
  const [isThrottled, setIsThrottled] = useState(false)
  const [remainingTime, setRemainingTime] = useState(0)
  const [loadingThrottle, setLoadingThrottle] = useState(false)
  const [clientStatus, setClientStatus] = useState(null)
  const [recentPedidos, setRecentPedidos] = useState([])
  const [showOrderSelector, setShowOrderSelector] = useState(false)
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Determinar si el ticket está actualmente resuelto/cerrado para el cliente
  const lastMsg = mensajes[mensajes.length - 1]
  const isLastMsgClosure = lastMsg?.es_sistema && lastMsg?.mensaje?.includes('TICKET CERRADO')
  
  // Consideramos que hay un ticket activo si el estado en BD es pendiente/critico o si hemos reconstruido el tema del historial
  const hasActiveTicket = (clientStatus !== null && clientStatus !== 'resuelto') || ticketSubject !== null
  const isResolved = !isAdmin && clientStatus === 'resuelto' && hasActiveTicket

  const loadMessages = async (chatId) => {
    if (!chatId) {
      setInitialLoading(false)
      return
    }
    const { data } = await supabase
      .from('soporte_mensajes')
      .select(`
        id, mensaje, remitente_id, created_at, es_sistema, quoted_id, archivo_url, tipo_archivo,
        remitente:clientes!remitente_id(nombres)
      `)
      .eq('cliente_id', chatId)
      .order('created_at', { ascending: true })
    
    if (data) {
      // Aplicar filtro de 7 días para mensajes con archivos (según requerimiento)
      const sanitizedMessages = data
        .filter(m => {
          if (!m.archivo_url) return true
          const diff = new Date() - new Date(m.created_at)
          return diff < (7 * 24 * 60 * 60 * 1000)
        })
        .map(m => ({ ...m, es_sistema: !!m.es_sistema }))
      
      setMensajes(sanitizedMessages)
      
      // CARGAR ESTADO DEL CLIENTE
      if (!isAdmin) {
        // Recuperar el tema del ticket del historial si existe uno activo (recorriendo desde el final)
        let activeSubject = null
        for (let i = sanitizedMessages.length - 1; i >= 0; i--) {
          const m = sanitizedMessages[i]
          if (m.es_sistema) {
            if (m.mensaje?.includes('TICKET INICIADO')) {
              activeSubject = m.mensaje?.replace('🎫 TICKET INICIADO: ', '').trim()
              break
            }
            if (m.mensaje?.includes('TICKET CERRADO')) {
              break // Se cerró el último ticket, no hay tema activo
            }
          }
        }
        if (activeSubject) setTicketSubject(activeSubject)

        const { data: userData } = await supabase.from('clientes').select('soporte_status').eq('id', currentClienteId).single()
        if (userData) setClientStatus(userData.soporte_status)
        checkThrottling(sanitizedMessages)
      }
      setInitialLoading(false)
    } else {
      setInitialLoading(false)
    }
  }

  const checkThrottling = (messages) => {
    if (isAdmin || !messages || messages.length === 0) {
      setIsThrottled(false)
      return
    }

    // Buscamos cuántos mensajes seguidos ha enviado el cliente desde la última respuesta de admin
    const reversed = [...messages].reverse()
    let consecutiveClientCount = 0
    let lastClientMsgTime = null

    for (const m of reversed) {
      // Si el mensaje es de sistema pero el remitente es un admin, cuenta como respuesta
      // Si el mensaje NO es de sistema y el remitente es admin, también.
      // Si el mensaje es de sistema y es un inicio de ticket, es un "reset" para el throttling
      if (m.es_sistema && m.mensaje?.includes('TICKET INICIADO')) {
        break
      }

      if (m.remitente_id !== currentUserId) {
        break // El administrador (o sistema) respondió. Detener conteo.
      }

      // Si es del cliente (y no es de sistema)
      if (!m.es_sistema) {
        consecutiveClientCount++
        if (!lastClientMsgTime) lastClientMsgTime = m.created_at
      }
    }

    // Permitir hasta 2 mensajes consecutivos antes de bloquear
    if (consecutiveClientCount < 2) {
      setIsThrottled(false)
      return
    }

    // Si envió 2 o más, chequear tiempo (25 min desde el último)
    if (lastClientMsgTime) {
      const timeDiff = new Date() - new Date(lastClientMsgTime)
      const throttleLimit = 25 * 60 * 1000 
      if (timeDiff < throttleLimit) {
        setIsThrottled(true)
        const minsRemaining = Math.ceil((throttleLimit - timeDiff) / 1000 / 60)
        setRemainingTime(minsRemaining)
      } else {
        setIsThrottled(false)
      }
    }
  }

  const loadRecentPedidos = async () => {
    const authId = perfil?.id
    const clienteUuid = perfil?.cliente_uuid
    
    if (!authId && !clienteUuid) return []
    
    setLoadingPedidos(true)
    try {
      let query = supabase
        .from('pedidos')
        .select('id, numero_pedido, created_at, total_bs, estado')
      
      // Intentar buscar por ambos IDs para máxima compatibilidad
      if (authId && clienteUuid && authId !== clienteUuid) {
        query = query.or(`cliente_id.eq.${authId},cliente_id.eq.${clienteUuid}`)
      } else {
        query = query.eq('cliente_id', authId || clienteUuid)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data || []
    } catch (err) {
      console.error("Error loading orders:", err)
      return []
    } finally {
      setLoadingPedidos(false)
    }
  }

  const loadActiveChatsForAdmin = async () => {
    // 1. Obtener todos los mensajes
    const { data: messagesData, error } = await supabase
      .from('soporte_mensajes')
      .select('cliente_id, created_at, leido, remitente_id')
      .order('created_at', { ascending: false })
      
    console.log('[DEBUG CHAT] messagesData:', messagesData, 'error:', error)
    
    if (messagesData) {
      // 2. Extraer IDs únicos de clientes que tienen chat
      const uniqueClientIds = [...new Set(messagesData.map(m => m.cliente_id))]
      
      if (uniqueClientIds.length > 0) {
        // 3. Obtener la info de esos clientes
        const { data: clientsData, error: clientsError } = await supabase
          .from('clientes')
          .select('id, nombres, whatsapp')
          .in('id', uniqueClientIds)
          
        console.log('[DEBUG CHAT] clientsData:', clientsData, 'clientsError:', clientsError)
        
        if (clientsData) {
          // 4. Mapear y calcular mensajes no leídos por cada cliente
          const chatsConUnread = clientsData.map(client => {
            const unreadCount = messagesData.filter(
              m => m.cliente_id === client.id && !m.leido && m.remitente_id !== currentClienteId
            ).length
            
            return {
              ...client,
              unreadCount
            }
          })
          
          // Ordenar: primero los que tienen mensajes no leídos
          chatsConUnread.sort((a, b) => b.unreadCount - a.unreadCount)
          
          setActiveChats(chatsConUnread)
        }
      } else {
        setActiveChats([])
      }
    } else {
      setActiveChats([])
    }
  }

  useEffect(() => {
    if (!isOpen || !perfil) return

    if (isAdmin && !selectedChatClient) {
      loadActiveChatsForAdmin()
    } else if (activeChatId) {
      loadMessages(activeChatId)
      // Si soy admin y abro un chat específico, marco los mensajes no leídos como leídos
      if (isAdmin) {
        supabase
          .from('soporte_mensajes')
          .update({ leido: true })
          .eq('cliente_id', activeChatId)
          .eq('leido', false)
          .then(() => {}) // fire and forget
      }
    }

    // Suscripción a Realtime de Mensajes
    const messageChannel = supabase
      .channel('soporte_mensajes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'soporte_mensajes'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const rawMessage = payload.new
            // Si el mensaje nuevo pertenece a la sala actual que estamos viendo
            if (rawMessage.cliente_id === activeChatId) {
              // Cargar info del remitente para mostrar el nombre
              const { data: userData } = await supabase
                .from('clientes')
                .select('nombres')
                .eq('id', rawMessage.remitente_id)
                .single()
              
              const fullMsg = { ...rawMessage, remitente: userData, es_sistema: !!rawMessage.es_sistema, quoted_id: rawMessage.quoted_id, archivo_url: rawMessage.archivo_url, tipo_archivo: rawMessage.tipo_archivo }
              
              // Si es un mensaje de sistema de cierre, actualizar estado local inmediatamente
              if (!isAdmin && fullMsg.es_sistema && fullMsg.mensaje?.includes('TICKET CERRADO')) {
                setClientStatus('resuelto')
              }

              setMensajes(prev => {
                const updated = [...prev, fullMsg]
                // Solo verificar throttle al recibir un mensaje si soy cliente
                if (!isAdmin) checkThrottling(updated)
                return updated
              })
            }
            
            // Si somos admin y estamos en la lista principal, recargar lista
            if (isAdmin && !selectedChatClient) {
               loadActiveChatsForAdmin()
            }
          } else if (payload.eventType === 'DELETE') {
            setMensajes(prev => prev.filter(m => m.id !== payload.old.id))
            if (isAdmin && !selectedChatClient) {
               loadActiveChatsForAdmin()
            }
          }
        }
      )
      .subscribe()

    // Suscripción a Realtime del Cliente (para detectar estado Resuelto/Pendiente)
    let clientStatusChannel = null
    if (!isAdmin && currentClienteId) {
      clientStatusChannel = supabase
        .channel(`cliente_status_${currentClienteId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'clientes',
            filter: `id=eq.${currentClienteId}`
          },
          (payload) => {
            if (payload.new && payload.new.soporte_status !== undefined) {
              setClientStatus(payload.new.soporte_status)
            }
          }
        )
        .subscribe()
    }

    return () => {
      supabase.removeChannel(messageChannel)
      if (clientStatusChannel) supabase.removeChannel(clientStatusChannel)
    }
  }, [isOpen, perfil, isAdmin, activeChatId, selectedChatClient, currentClienteId])

  const handleSelectTicket = async (category) => {
    if (!currentClienteId || isAdmin) return
    
    // Si la categoría es Pedido y es cliente, intentar mostrar selector de pedidos
    if (category === 'Pedido no completado') {
      if (showOrderSelector) return // Evitar doble clic si ya está abierto el selector
      
      const orders = await loadRecentPedidos()
      if (orders && orders.length > 0) {
        setRecentPedidos(orders)
        setShowOrderSelector(true)
      } else {
        // Si no hay pedidos recientes, abrir el ticket directamente con el motivo genérico
        await openTicket(category)
      }
      return
    }

    // Proceso normal para otras categorías
    await openTicket(category)
  }

  const handleSelectOrder = async (orderNumber) => {
    const categoryWithOrder = `Pedido no completado (#${orderNumber})`
    setShowOrderSelector(false)
    await openTicket(categoryWithOrder)
  }

  const openTicket = async (category) => {
    setClientStatus('pendiente')
    setTicketSubject(category)
    setShowOrderSelector(false) // Asegurar que el selector se cierre al iniciar ticket

    // 1. Enviar mensaje de sistema con el motivo
    const { data: adminData } = await supabase.from('clientes').select('id').ilike('rol', 'admin').limit(1).single()
    const senderId = adminData?.id || currentClienteId
    
    if (senderId) {
      const ticketMsg = `🎫 TICKET INICIADO: ${category.toUpperCase()}`
      const infoMsg = "Explica tu caso; sé detallado y explica en un sólo mensaje para ser atendida tu solicitud. Una vez que envíes el mensaje sólo podrás escribir nuevamente cuando la administración responda a tu chat, para evitar la saturación del chat."
      
      // Intentar insertar con es_sistema
      let { error } = await supabase.from('soporte_mensajes').insert([
        { cliente_id: currentClienteId, remitente_id: senderId, mensaje: ticketMsg, es_sistema: true },
        { cliente_id: currentClienteId, remitente_id: senderId, mensaje: infoMsg, es_sistema: true }
      ])

      // Fallback si no hay columna es_sistema
      if (error && (error.code === '42703' || error.message?.includes('es_sistema'))) {
        await supabase.from('soporte_mensajes').insert([
          { cliente_id: currentUserId, remitente_id: senderId, mensaje: ticketMsg },
          { cliente_id: currentUserId, remitente_id: senderId, mensaje: infoMsg }
        ])
      }
      
      // 2. Actualizar estado del cliente a 'pendiente' para persistencia en BD
      await supabase.from('clientes').update({ soporte_status: 'pendiente' }).eq('id', currentClienteId)
    }
  }

  const handleNewTicket = async () => {
    if (isAdmin || !currentClienteId) return
    try {
      await supabase.from('clientes').update({ soporte_status: null }).eq('id', currentClienteId)
      setClientStatus(null)
      setTicketSubject(null)
      // Opcional: Podríamos enviar un mensaje de sistema de "Nueva solicitud" aquí
    } catch (err) { console.error(err) }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !pendingFile) || !activeChatId) return
    if (!isAdmin && (isThrottled || clientStatus === 'resuelto')) return

    setLoadingThrottle(true)
    let uploadedUrl = null
    let fileType = null

    try {
      // 1. Si hay un archivo pendiente, subirlo primero
      if (pendingFile) {
        const fileExt = pendingFile.name.split('.').pop()
        const fileName = `${Date.now()}_client.${fileExt}`
        const filePath = `chat/${activeChatId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('soporte_archivos')
          .upload(filePath, pendingFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('soporte_archivos')
          .getPublicUrl(filePath)
        
        uploadedUrl = publicUrl
        fileType = pendingFile.type.startsWith('image/') ? 'imagen' : 
                   pendingFile.type.startsWith('video/') ? 'video' : 'archivo'
      }

      // 2. Preparar el objeto de inserción
      const insertObj = {
        cliente_id: activeChatId,
        remitente_id: currentClienteId,
        mensaje: newMessage.trim() || (fileType === 'imagen' ? '📷 Foto' : (fileType === 'video' ? '🎥 Video' : '📎 Archivo')),
        es_sistema: false,
        quoted_id: replyingTo?.id || null,
        archivo_url: uploadedUrl,
        tipo_archivo: fileType
      }

      const { error } = await supabase.from('soporte_mensajes').insert(insertObj)
      if (error) throw error

      // Si el admin está respondiendo, borrar el estado "resuelto" para que el cliente pueda ver la caja de texto
      if (isAdmin) {
        await supabase.from('clientes').update({ soporte_status: null }).eq('id', activeChatId)
      }

      // 3. Limpiar estados
      setNewMessage('')
      setPendingFile(null)
      setFilePreview(null)
      setReplyingTo(null)
      
      // 4. Auto-respuesta admin si aplica
      if (!isAdmin) {
        const { data: adminData } = await supabase.from('clientes').select('id').ilike('rol', 'admin').limit(1).single()
        if (adminData) {
          await supabase.from('soporte_mensajes').insert({
            cliente_id: activeChatId,
            remitente_id: adminData.id,
            mensaje: "Su mensaje ha sido recibido por la administración, por favor espere.",
            es_sistema: true
          })
        }
      }
    } catch (err) {
      console.error("Error en envío:", err)
      alert("Error al procesar el envío: " + err.message)
    } finally {
      setLoadingThrottle(false)
    }
  }

  const handleDeleteMessage = (id) => {
    setDeleteData({ isOpen: true, messageId: id })
  }

  const confirmDeleteMessage = async () => {
    if (!deleteData.messageId) return
    const id = deleteData.messageId
    setDeleteData({ isOpen: false, messageId: null })

    const { error } = await supabase.from('soporte_mensajes').delete().eq('id', id)
    if (error) {
      console.error("Error al eliminar mensaje:", error)
      alert("Error al eliminar el mensaje.")
    }
  }

  const cancelDeleteMessage = () => {
    setDeleteData({ isOpen: false, messageId: null })
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file || !activeChatId) return
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = () => setFilePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const removePendingFile = () => {
    setPendingFile(null)
    setFilePreview(null)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
      recorder.timer = timer
    } catch (err) {
      alert('Permite el acceso al micrófono.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      clearInterval(mediaRecorder.timer)
      setIsRecording(false)
      setRecordingTime(0)
    }
  }

  const sendAudio = async () => {
    if (!audioBlob || !activeChatId) return
    setIsUploading(true)
    try {
      const fileName = `audio_${Date.now()}.webm`
      const filePath = `chat/${activeChatId}/${fileName}`
      await supabase.storage.from('soporte_archivos').upload(filePath, audioBlob)
      const { data: { publicUrl } } = supabase.storage.from('soporte_archivos').getPublicUrl(filePath)
      await supabase.from('soporte_mensajes').insert({
        cliente_id: activeChatId,
        remitente_id: currentClienteId,
        mensaje: '🎤 Nota de voz',
        archivo_url: publicUrl,
        tipo_archivo: 'audio',
        leido: false
      })
      setAudioBlob(null)
    } catch (error) { console.error(error) } finally { setIsUploading(false) }
  }

  const renderMessageWithLinks = (text) => {
    if (!text) return text
    const parts = text.split(/(#\d+)/g)
    return parts.map((part, i) => {
      if (part.match(/#\d+/)) {
        return (
          <span 
            key={i} 
            style={{ 
              textDecoration: 'underline', 
              cursor: 'pointer',
              fontWeight: 'bold',
              color: 'inherit'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (onNavigate) {
                onNavigate('pedidos', { orderNumber: part })
                setIsOpen(false)
                if (onClose) onClose()
              }
            }}
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  if (!perfil) return null

  return (
    <div className={isPage ? "support-chat-page-wrapper" : "support-chat-container"}>
      
      {/* Ventana de Chat */}
      {(isOpen || isPage) && (
        <div className={`card support-chat-window ${isPage ? 'is-page' : ''}`}>
          
          {/* Header */}
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isAdmin && selectedChatClient && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ padding: '4px 8px' }}
                  onClick={() => setSelectedChatClient(null)}
                >
                  ←
                </button>
              )}
              <div style={{ fontWeight: 'bold' }}>
                {isAdmin ? (
                  selectedChatClient ? `Chat con ${selectedChatClient.nombres}` : 'Chats de Soporte'
                ) : (
                  'Soporte Técnico'
                )}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setIsOpen(false); if(onClose) onClose(); }} style={{ display: isPage ? 'none' : 'flex' }}>×</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Vista Admin Principal (Lista de Chats) */}
            {isAdmin && !selectedChatClient ? (
              activeChats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>No hay chats activos.</div>
              ) : (
                activeChats.map(client => (
                  <div 
                    key={client.id}
                    onClick={() => setSelectedChatClient(client)}
                    style={{
                      padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-panel)',
                      cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: client.unreadCount > 0 ? 'bold' : 'normal', color: client.unreadCount > 0 ? '#fff' : 'var(--text-primary)' }}>
                        {client.nombres}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {client.id.substring(0,8)}...</div>
                    </div>
                    {client.unreadCount > 0 && (
                      <div style={{
                        backgroundColor: 'var(--accent-primary)', color: '#000',
                        fontWeight: 'bold', fontSize: '12px', width: '24px', height: '24px',
                        borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center'
                      }}>
                        {client.unreadCount}
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              /* Vista de Mensajes (Cliente o Admin en un chat específico) */
              <>
                {initialLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
                    <div className="spinner-small"></div>
                  </div>
                ) : (mensajes.length === 0 && !isAdmin && !hasActiveTicket) ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '20px', fontWeight: 'bold', fontSize: '15px' }}>
                      Selecciona el motivo de tu ticket:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleSelectTicket('Pedido no completado')}
                        style={{ height: '45px', borderRadius: '12px' }}
                      >
                        📦 Pedido no completado
                      </button>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleSelectTicket('Problema con un pago')}
                        style={{ height: '45px', borderRadius: '12px' }}
                      >
                        💳 Problema con un pago
                      </button>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleSelectTicket('Otro motivo')}
                        style={{ height: '45px', borderRadius: '12px' }}
                      >
                        ❓ Otro motivo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {mensajes.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', padding: '0 20px' }}>
                        {ticketSubject ? (
                          <div>
                            <div style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '8px' }}>
                              Ticket: {ticketSubject}
                            </div>
                            <div style={{ fontSize: '14px' }}>
                              Explica tu caso; sé detallado y explica en un sólo mensaje para ser atendida tu solicitud. Una vez que envíes el mensaje sólo podrás escribir nuevamente cuando la administración responda a tu chat...
                            </div>
                          </div>
                        ) : (
                          'Empezando un nuevo chat...'
                        )}
                      </div>
                    ) : (
                      mensajes.map(m => {
                        const isMine = m.remitente_id === currentClienteId
                        return (
                          <div 
                            key={m.id} 
                            className={m.es_sistema ? 'message-bubble-wrapper system' : ''}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: m.es_sistema ? 'center' : (isMine ? 'flex-end' : 'flex-start'),
                              width: '100%'
                            }}
                          >
                            {!m.es_sistema && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px', marginRight: '4px' }}>
                                {isMine ? 'Tú' : (m.remitente?.nombres || 'Soporte')}
                              </div>
                            )}
                            <div className={`message-bubble ${m.es_sistema ? 'system' : ''}`} style={{ 
                              backgroundColor: m.es_sistema ? undefined : (isMine ? 'var(--accent-primary)' : 'var(--bg-panel)'),
                              color: m.es_sistema ? undefined : (isMine ? '#000' : 'var(--text-primary)'),
                              padding: m.es_sistema ? undefined : '10px 14px', 
                              borderRadius: m.es_sistema ? undefined : '16px',
                              borderBottomRightRadius: !m.es_sistema && isMine ? '4px' : undefined,
                              borderBottomLeftRadius: !m.es_sistema && !isMine ? '4px' : undefined,
                              maxWidth: m.es_sistema ? undefined : '85%', 
                              wordBreak: 'break-word', 
                              fontSize: m.es_sistema ? undefined : '14px',
                              border: m.es_sistema ? undefined : 'none',
                              position: 'relative'
                            }}>
                              {m.quoted_id && (
                                <div className="quoted-message-preview mini" style={{ marginBottom: '8px', borderLeftColor: isMine ? '#000' : 'var(--accent-primary)' }}>
                                  <div className="quoted-message-sender" style={{ color: isMine ? '#000' : 'var(--accent-primary)', opacity: 0.8 }}>
                                    {mensajes.find(msg => msg.id === m.quoted_id)?.remitente_id === currentClienteId ? 'Tú' : (mensajes.find(msg => msg.id === m.quoted_id)?.remitente?.nombres || 'Soporte')}
                                  </div>
                                  <div className="quoted-message-text truncate" style={{ fontSize: '11px', opacity: 0.7 }}>
                                    {mensajes.find(msg => msg.id === m.quoted_id)?.mensaje || 'Mensaje original...'}
                                  </div>
                                </div>
                              )}
    
                              {m.archivo_url && (
                                <div className="message-media" style={{ marginBottom: '8px' }}>
                                  {m.tipo_archivo === 'imagen' && (
                                    <img src={m.archivo_url} alt="Adjunto" style={{ width: '100%', borderRadius: '8px', display: 'block', cursor: 'pointer' }} onClick={() => window.open(m.archivo_url, '_blank')} />
                                  )}
                                  {m.tipo_archivo === 'video' && (
                                    <video src={m.archivo_url} controls style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
                                  )}
                                  {m.tipo_archivo === 'audio' && (
                                    <audio src={m.archivo_url} controls style={{ width: '200px', height: '35px', display: 'block' }} />
                                  )}
                                </div>
                              )}
    
                              {renderMessageWithLinks(m.mensaje)}
                              <button 
                                className="reply-button-small" 
                                onClick={(e) => { e.stopPropagation(); setReplyingTo(m); }}
                                style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.5, color: '#fff' }}
                              >
                                ↩
                              </button>
                              {isAdmin && isMine && (
                                <button 
                                  className="delete-button-small" 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(m.id); }}
                                  title="Eliminar mensaje"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </>
            )}
          </div>
    
          {/* Footer Input */}
          {(!isAdmin || selectedChatClient) && (
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              {isResolved ? (
                <div style={{ backgroundColor: 'var(--bg-panel)', padding: '20px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent-success)', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
                    ✅ Este ticket ha sido resuelto por la administración.
                  </div>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleNewTicket}
                    style={{ padding: '8px 20px', borderRadius: '12px' }}
                  >
                    🚀 Abrir Nuevo Ticket
                  </button>
                </div>
              ) : (showOrderSelector && !isAdmin) ? (
                <div style={{ backgroundColor: 'var(--bg-panel)', padding: '16px' }}>
                  <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Selecciona el pedido:</span>
                    <button onClick={() => setShowOrderSelector(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  </div>
                  {loadingPedidos ? (
                    <div style={{ textAlign: 'center', padding: '10px' }}><div className="spinner-small"></div></div>
                  ) : recentPedidos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>No tienes pedidos recientes.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                      {recentPedidos.map(p => {
                        const orderNum = String(p.numero_pedido).padStart(6, '0')
                        return (
                          <div 
                            key={p.id}
                            onClick={() => handleSelectOrder(orderNum)}
                            style={{
                              padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-card)',
                              cursor: 'pointer', border: '1px solid var(--border-color)',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>#{orderNum}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 'bold' }}>{p.total_bs ? p.total_bs.toLocaleString() : '0'} BS</div>
                              <div style={{ fontSize: '11px', color: p.estado === 'completado' ? 'var(--accent-success)' : 'var(--text-muted)' }}>{p.estado.toUpperCase()}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (!hasActiveTicket && !isAdmin) ? (
                <div style={{ backgroundColor: 'var(--bg-panel)', padding: '16px', textAlign: 'center' }}>
                  <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                    Selecciona el motivo de tu nuevo ticket:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSelectTicket('Pedido no completado')}>📦 Pedido</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSelectTicket('Problema con un pago')}>💳 Pago</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSelectTicket('Otro motivo')}>❓ Otro</button>
                  </div>
                </div>
              ) : (
                <>
                  {isThrottled && !isAdmin && (
                <div style={{ 
                  backgroundColor: 'rgba(255,171,0,0.1)', color: '#ffab00', 
                  padding: '8px 16px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' 
                }}>
                  ⌛ Debes esperar una respuesta o {remainingTime} min para enviar otro mensaje.
                </div>
              )}
                {replyingTo && (
                  <div className="replying-to-bar mini" style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>Respondiendo a {replyingTo.remitente_id === currentClienteId ? 'ti mismo' : (replyingTo.remitente?.nombres || 'Soporte')}</div>
                      <div className="truncate" style={{ fontSize: '12px', opacity: 0.7 }}>{replyingTo.mensaje}</div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>✕</button>
                  </div>
                )}
                {audioBlob && (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ flex: 1, fontSize: '12px' }}>🎤 Audio listo</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAudioBlob(null)}>X</button>
                    <button className="btn btn-primary btn-sm" onClick={sendAudio}>Enviar</button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} style={{ padding: '12px', backgroundColor: 'var(--bg-panel)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ cursor: 'pointer', opacity: isUploading ? 0.5 : 1 }}>
                    📎
                    <input type="file" hidden onChange={handleFileSelect} accept="image/*,video/*" disabled={isUploading} />
                  </label>

                {filePreview && (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      {pendingFile?.type.startsWith('image/') ? (
                        <img src={filePreview} style={{ height: '40px', borderRadius: '4px' }} alt="Preview" />
                      ) : (
                        <div style={{ height: '40px', width: '40px', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎥</div>
                      )}
                      <button onClick={removePendingFile} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}>×</button>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pendingFile.name}</span>
                  </div>
                )}

                {/* Advertencia de dos mensajes para tickets nuevos */}
                {!isAdmin && ticketSubject && mensajes.length < 4 && (
                  <div style={{ 
                    position: 'absolute', bottom: '100%', left: 0, right: 0, 
                    padding: '8px', backgroundColor: 'var(--bg-panel)', 
                    fontSize: '10px', color: 'var(--accent-primary)', textAlign: 'center',
                    borderTop: '1px solid var(--border-color)', fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    ⚠️ Solo tienes dos mensajes para explicar tu caso.
                  </div>
                )}

                  {isRecording ? (
                    <div style={{ flex: 1, color: '#ff453a', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={stopRecording}>
                      <div className="recording-dot"></div>
                      <span>{recordingTime}s - Click para parar</span>
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ 
                        flex: 1, 
                        fontSize: '14px', 
                        borderRadius: '20px', 
                        padding: '8px 16px', 
                        opacity: (isThrottled && !isAdmin) || isResolved ? 0.6 : 1 
                      }}
                      placeholder={isResolved ? "Ticket resuelto" : ((isThrottled && !isAdmin) ? "Bloqueado" : "Escribe...")}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      disabled={(isThrottled && !isAdmin) || isResolved || loadingThrottle || isUploading || !!audioBlob}
                    />
                  )}

                  {!isRecording && !audioBlob && isAdmin && (
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} onClick={startRecording}>
                       🎙️
                    </button>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    disabled={(!newMessage.trim() && !pendingFile && !isAdmin) || (!isAdmin && mensajes.length === 0 && !ticketSubject) || (isThrottled && !isAdmin) || loadingThrottle || isUploading || !!audioBlob}
                  >
                    {isUploading ? '...' : (pendingFile ? '📤' : '➔')}
                  </button>
                </form>
                </>
              )}
              </div>
          )}

        </div>
      )}

      {/* Burbuja Flotante Interactiva (Sola si NO es modo página) */}
      {!isPage && (
        <button 
          className="btn btn-primary support-chat-toggle"
          style={{ 
            height: '48px', borderRadius: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0, 210, 255, 0.3)', padding: isOpen || isHovered ? '0 18px' : '0',
            width: isOpen || isHovered ? 'auto' : '48px',
            fontSize: '14px', gap: '8px',
            fontWeight: 'bold', border: 'none',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            overflow: 'hidden', whiteSpace: 'nowrap'
          }}
          onClick={() => {
            const newState = !isOpen;
            setIsOpen(newState);
            if (!newState && onClose) onClose();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            opacity: isOpen || isHovered ? 1 : 0,
            width: isOpen || isHovered ? 'auto' : '0px',
            transition: 'all 0.3s ease'
          }}>
            <span>{isOpen ? 'Cerrar Chat' : 'Chat de Soporte'}</span>
          </div>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>{isOpen ? '✕' : '💬'}</span>
        </button>
      )}

      {/* Modal de Confirmación para la eliminación de mensajes */}
      <AlertModal 
        isOpen={deleteData.isOpen}
        type="confirm"
        title="Eliminar Mensaje"
        message="¿Estás seguro de que deseas eliminar este mensaje para todos? Esta acción no se puede deshacer."
        onConfirm={confirmDeleteMessage}
        onCancel={cancelDeleteMessage}
      />
    </div>
  )
}
