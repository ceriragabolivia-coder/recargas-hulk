import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'

export default function SalaDeChat({ perfil, params, onNavigate }) {
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState(params?.prefill || '')
  const [replyingTo, setReplyingTo] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [deleteData, setDeleteData] = useState({ isOpen: false, messageId: null })
  const [pendingFile, setPendingFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const messagesEndRef = useRef(null)
  const lastAppliedParamsRef = useRef(null)
  const selectedChatRef = useRef(null)
  const currentUserId = perfil?.id
  const currentClienteId = perfil?.cliente_uuid || perfil?.id // Fallback si no hay cliente_uuid
  const [isMobileChat, setIsMobileChat] = useState(false)

  // Detect mobile viewport
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mantener la referencia actualizada para el socket
  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  // 1. Cargar lista de chats
  const loadChats = async (noLoading = false) => {
    try {
      if (!noLoading) setLoading(true)
      // 1. Obtener todos los mensajes (incluyendo quoted_id y media)
      const { data: messagesData, error: messagesError } = await supabase
        .from('soporte_mensajes')
        .select('id, cliente_id, created_at, leido, remitente_id, mensaje, es_sistema, quoted_id, archivo_url, tipo_archivo')
        .order('created_at', { ascending: false })
      
      if (messagesError) {
        console.error('Error fetching messages for list:', messagesError)
        setLoading(false)
        return
      }

      if (!messagesData || messagesData.length === 0) {
        setChats([])
        setLoading(false)
        return
      }

      // 2. Extraer IDs únicos de clientes que tienen chat
      const uniqueClientIds = [...new Set(messagesData.map(m => m.cliente_id).filter(id => id !== null))]
      
      if (uniqueClientIds.length === 0) {
        setChats([])
        setLoading(false)
        return
      }

      // 3. Obtener la info de esos clientes (solo campos confirmados)
      const { data: clientsData, error: clientsError } = await supabase
        .from('clientes')
        .select(`
          id, nombres, apellidos, whatsapp, auth_user_id, soporte_status, soporte_status_changed_at,
          perfil:perfiles!auth_user_id(rol),
          billetera:billeteras!auth_user_id(saldo, saldo_bs)
        `)
        .in('id', uniqueClientIds)
          
      if (clientsError) {
        console.error('Error fetching clients data:', clientsError)
        setLoading(false)
        return
      }

      if (clientsData) {
        // 4. Mapear y calcular mensajes no leídos por cada cliente + info del último mensaje
        const now = new Date()
        const expiredChatIds = []
        
        const chatsProcessed = clientsData.map(client => {
          // Lógica de expiración: si es 'resuelto' y pasó más de 24h
          let currentStatus = client.soporte_status
          if (currentStatus === 'resuelto' && client.soporte_status_changed_at) {
            const changedAt = new Date(client.soporte_status_changed_at)
            const diffHours = (now - changedAt) / (1000 * 60 * 60)
            if (diffHours >= 1) {
              currentStatus = null
              expiredChatIds.push(client.id)
            }
          }

          // Último mensaje de este cliente
          const lastMsg = messagesData.find(m => m.cliente_id === client.id)
          // Mensajes no leídos que no son del admin actual
          const unreadCount = messagesData.filter(
            m => m.cliente_id === client.id && !m.leido && m.remitente_id !== currentUserId
          ).length
          
          const wallet = client.billetera?.[0] || client.billetera || {}
          const rol = (client.perfil?.[0]?.rol || client.perfil?.rol || 'cliente').toLowerCase()
          
          return {
            ...client,
            soporte_status: currentStatus,
            display_name: `${client.nombres || ''} ${client.apellidos || ''}`.trim() || 'Usuario sin nombre',
            lastMessage: lastMsg,
            unreadCount,
            rol,
            saldo: wallet.saldo || 0,
            saldo_bs: wallet.saldo_bs || 0
          }
        })
        
        // Limpiar en segundo plano los estados expirados en la DB
        if (expiredChatIds.length > 0) {
          supabase.from('clientes')
            .update({ soporte_status: null, soporte_status_changed_at: now.toISOString() })
            .in('id', expiredChatIds)
            .then(({ error }) => { if (error) console.error('Error auto-cleaning statuses:', error) })
        }
        
        // Ordenar: primero los que tienen mensajes no leídos, luego por fecha de último mensaje
        chatsProcessed.sort((a, b) => {
          if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
          return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
        })
        
        setChats(chatsProcessed)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error en loadChats:', error)
      setLoading(false)
    }
  }

  // 2. Cargar mensajes
  const loadMessages = async (clientId) => {
    if (!clientId) return
    const { data, error } = await supabase
      .from('soporte_mensajes')
      .select('id, cliente_id, created_at, leido, remitente_id, mensaje, es_sistema, quoted_id, archivo_url, tipo_archivo')
      .eq('cliente_id', clientId)
      .order('created_at', { ascending: true })
    
    if (error) return

    // Aplicar filtro de 7 días para mensajes con archivos (según requerimiento)
    const filteredData = (data || []).filter(m => {
      if (!m.archivo_url) return true
      const diff = new Date() - new Date(m.created_at)
      return diff < (7 * 24 * 60 * 60 * 1000)
    })

    setMessages(filteredData)
    
    await supabase
      .from('soporte_mensajes')
      .update({ leido: true })
      .eq('cliente_id', clientId)
      .eq('leido', false)
      .neq('remitente_id', currentUserId)
      
    // Recargar lista para actualizar contadores de no leídos
    loadChats(true) // true = no resetear loading
  }

  useEffect(() => {
    loadChats()

    const channel = supabase
      .channel('sala_de_chat_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soporte_mensajes' }, (payload) => {
        loadChats(true) // no resetear loading en realtime
        const activeChat = selectedChatRef.current
        if (activeChat) {
          if (payload.eventType === 'INSERT' && payload.new.cliente_id === activeChat.id) {
            setMessages(prev => [...prev, payload.new])
            if (payload.new.remitente_id !== currentUserId) {
              supabase.from('soporte_mensajes').update({ leido: true }).eq('id', payload.new.id).then(() => {})
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // SIN DEPENDENCIAS DE ESTADO PARA EVITAR LOOPS

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Ticker para forzar re-procesamiento de expiraciones cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(true) // Recargar chats en segundo plano para limpiar expirados
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  
  // 4. Manejar selección inicial (Remonta gracias a 'key' en App.jsx)
  useEffect(() => {
    const initSelection = async () => {
      if (!params?.targetClientId) return

      // APLICAR PRE-LLENADO DE INMEDIATO
      if (params.prefill) {
        setNewMessage(params.prefill)
      }

      const idToFind = String(params.targetClientId)

      // Identificar si ya está en la lista cargada (buscando por id o auth_user_id)
      let target = chats.find(c => 
        String(c.id) === idToFind || String(c.auth_user_id) === idToFind
      )
      
      if (!target) {
        // Buscar en la base de datos por AMBOS campos (id y auth_user_id)
        // Esto resuelve el mismatch entre pedidos (auth ID) y soporte (client ID)
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .or(`id.eq.${idToFind},auth_user_id.eq.${idToFind}`)
          .limit(1)

        if (data && data.length > 0 && !error) {
          const clientData = data[0]
          target = { 
            ...clientData, 
            display_name: `${clientData.nombres || ''} ${clientData.apellidos || ''}`.trim() || 'Usuario sin nombre',
            lastMessage: { mensaje: '(Iniciando chat...)', created_at: new Date().toISOString() },
            unreadCount: 0
          }
          // Asegurar visibilidad en el sidebar
          setChats(prev => {
            if (prev.some(c => String(c.id) === String(target.id))) return prev
            return [target, ...prev]
          })
        }
      }

      if (target) {
        setSelectedChat(target)
        loadMessages(target.id)
        console.info('[CHAT_INIT] Auto-seleccionado con éxito:', target.display_name)
      }
    }

    initSelection()
  }, [params?.targetClientId, chats.length > 0]) // Solo ID y flag de lista cargada

  const handleSelectChat = (chat) => {
    setSelectedChat(chat)
    loadMessages(chat.id)
    if (isMobileView) setIsMobileChat(true)
  }

  const handleBackToList = () => {
    setIsMobileChat(false)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !pendingFile) || !selectedChat) return

    setIsUploading(true)
    let uploadedUrl = null
    let fileType = null

    try {
      if (pendingFile) {
        const fileExt = pendingFile.name.split('.').pop()
        const fileName = `${Date.now()}_admin.${fileExt}`
        const filePath = `chat/${selectedChat.id}/${fileName}`

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

      const messageToSend = {
        cliente_id: selectedChat.id,
        remitente_id: currentClienteId,
        mensaje: newMessage.trim() || (fileType === 'imagen' ? '📷 Foto' : (fileType === 'video' ? '🎥 Video' : '📎 Archivo')),
        leido: false,
        es_sistema: false,
        quoted_id: replyingTo?.id || null,
        archivo_url: uploadedUrl,
        tipo_archivo: fileType
      }

      const { error } = await supabase.from('soporte_mensajes').insert(messageToSend)
      if (error) throw error
      
      // DESBLOQUEAR CHAT AUTOMÁTICAMENTE PARA EL CLIENTE
      // Si el chat estaba marcado como "resuelto", al enviarle admin un mensaje se vuelve a habilitar
      await supabase.from('clientes').update({ soporte_status: null }).eq('id', selectedChat.id)

      setNewMessage('')
      setPendingFile(null)
      setFilePreview(null)
      setReplyingTo(null)
    } catch (err) {
      console.error("Error envoying admin msg:", err)
      alert("Error al enviar el mensaje: " + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdateStatus = async (status) => {
    if (!selectedChat) return
    
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('clientes')
        .update({ soporte_status: status, soporte_status_changed_at: now })
        .eq('id', selectedChat.id)
      
      if (error) throw error

      // Si el estado es 'resuelto', enviar un mensaje de sistema al chat
      if (status === 'resuelto') {
        const closureMsg = "🎫 TICKET CERRADO: El caso ha sido marcado como resuelto por la administración."
        const { error: msgError } = await supabase.from('soporte_mensajes').insert({
          cliente_id: selectedChat.id,
          remitente_id: currentClienteId,
          mensaje: closureMsg,
          es_sistema: true
        })
        
        // Fallback si no hay es_sistema
        if (msgError && (msgError.code === '42703' || msgError.message?.includes('es_sistema'))) {
          await supabase.from('soporte_mensajes').insert({
            cliente_id: selectedChat.id,
            remitente_id: currentClienteId,
            mensaje: closureMsg
          })
        }
      }
      
      // Actualizar localmente la lista de chats y el chat seleccionado
      const updatedChats = chats.map(c => 
        c.id === selectedChat.id ? { ...c, soporte_status: status, soporte_status_changed_at: now } : c
      )
      setChats(updatedChats)
      setSelectedChat(prev => ({ ...prev, soporte_status: status, soporte_status_changed_at: now }))
      
    } catch (error) {
      console.error('Error updating chat status:', error)
      alert('Error al actualizar el estado del chat: ' + (error.message || 'Error desconocido'))
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'resuelto': return { icon: '✅', label: 'Resuelto', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
      case 'pendiente': return { icon: '⚠️', label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
      case 'critico': return { icon: '🚨', label: 'Crítico', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
      default: return null
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
    if (!file || !selectedChat) return
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
      
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      recorder.timer = timer
    } catch (err) {
      console.error('Error al acceder al micrófono:', err)
      alert('No se pudo acceder al micrófono. Por favor permite los permisos.')
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
    if (!audioBlob || !selectedChat) return
    setIsUploading(true)
    try {
      const fileName = `audio_${Date.now()}.webm`
      const filePath = `chat/${selectedChat.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('soporte_archivos')
        .upload(filePath, audioBlob)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('soporte_archivos')
        .getPublicUrl(filePath)

      await supabase.from('soporte_mensajes').insert({
        cliente_id: selectedChat.id,
        remitente_id: currentClienteId,
        mensaje: '🎤 Nota de voz',
        archivo_url: publicUrl,
        tipo_archivo: 'audio',
        leido: false
      })
      setAudioBlob(null)
    } catch (error) {
      console.error('Error subiendo audio:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
  }

  // Contadores por etiqueta
  const labelCounts = {
    todos: chats.length,
    resuelto: chats.filter(c => c.soporte_status === 'resuelto').length,
    pendiente: chats.filter(c => c.soporte_status === 'pendiente').length,
    critico: chats.filter(c => c.soporte_status === 'critico').length,
  }

  const filteredChats = chats.filter(chat => {
    const matchesSearch = (chat.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = activeFilter === 'todos' || chat.soporte_status === activeFilter
    return matchesSearch && matchesFilter
  })

  // Helper para convertir #000XXX en un enlace clicable hacia el pedido
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

  return (
    <div className="sala-chat-container">
      <div className={`chat-list-sidebar ${isMobileView && isMobileChat ? 'chat-hidden' : ''}`}>
        <div className="chat-list-header flex items-center justify-between">
          <span className="text-xl font-bold">Sala de Chat</span>
        </div>
        <div className="chat-search">
          <input 
            type="text" 
            placeholder="Buscar usuario..." 
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Filtro por etiquetas */}
        <div className="chat-filter-pills">
          {[
            { key: 'todos', label: 'Todos', icon: '📋', color: '#9ca3af', activeColor: '#fff', activeBg: 'rgba(255,255,255,0.1)', activeBorder: 'rgba(255,255,255,0.25)' },
            { key: 'resuelto', label: 'Resueltos', icon: '✅', color: '#10b981', activeColor: '#10b981', activeBg: 'rgba(16,185,129,0.15)', activeBorder: 'rgba(16,185,129,0.5)' },
            { key: 'pendiente', label: 'Pendientes', icon: '⚠️', color: '#f59e0b', activeColor: '#f59e0b', activeBg: 'rgba(245,158,11,0.15)', activeBorder: 'rgba(245,158,11,0.5)' },
            { key: 'critico', label: 'Críticos', icon: '🚨', color: '#ef4444', activeColor: '#ef4444', activeBg: 'rgba(239,68,68,0.15)', activeBorder: 'rgba(239,68,68,0.5)' },
          ].map(f => {
            const isActive = activeFilter === f.key
            const count = labelCounts[f.key] || 0
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`chat-filter-pill ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: isActive ? f.activeBg : 'transparent',
                  borderColor: isActive ? f.activeBorder : 'rgba(255,255,255,0.06)',
                  color: isActive ? f.activeColor : 'var(--text-muted)',
                }}
              >
                <span className="chat-filter-pill-icon">{f.icon}</span>
                <span className="chat-filter-pill-label">{f.label}</span>
                {count > 0 && (
                  <span className="chat-filter-pill-count" style={{
                    backgroundColor: isActive ? f.activeColor : 'rgba(255,255,255,0.1)',
                    color: isActive ? (f.key === 'todos' ? '#000' : '#fff') : 'var(--text-muted)',
                  }}>{count}</span>
                )}
              </button>
            )
          })}
          {activeFilter !== 'todos' && (
            <button
              onClick={() => setActiveFilter('todos')}
              className="chat-filter-clear"
              title="Limpiar filtro"
            >
              ✕
            </button>
          )}
        </div>
        <div className="chat-list-items">
          {loading ? (
            <div className="flex justify-center p-8"><div className="spinner"></div></div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center p-8 text-muted">
              {activeFilter !== 'todos' ? (
                <div>
                  <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>🏷️</div>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin chats en esta categoría</div>
                  <button
                    onClick={() => setActiveFilter('todos')}
                    style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Ver todos los chats
                  </button>
                </div>
              ) : 'No hay chats activos'}
            </div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id} 
                className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                <div className="chat-item-avatar">
                  <span>{(chat.display_name?.[0] || 'U').toUpperCase()}</span>
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {chat.display_name}
                      {chat.rol === 'revendedor' && (
                        <span style={{ fontSize: '8px', padding: '1px 4px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '3px', fontWeight: 800 }}>REV</span>
                      )}
                      {chat.soporte_status === 'resuelto' && (
                         <span 
                           title="Resuelto recientemente" 
                           style={{ 
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             width: '16px', height: '16px', borderRadius: '50%',
                             backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                             fontSize: '10px', border: '1px solid rgba(16, 185, 129, 0.3)'
                           }}
                         >
                           ✓
                         </span>
                      )}
                      {chat.soporte_status && chat.soporte_status !== 'resuelto' && (
                         <span title={getStatusBadge(chat.soporte_status)?.label} style={{ fontSize: '10px', opacity: 0.8 }}>
                           {getStatusBadge(chat.soporte_status)?.icon}
                         </span>
                      )}
                    </span>
                    <span className="chat-item-time">{formatTime(chat.lastMessage.created_at)}</span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">
                      {chat.lastMessage.remitente_id === currentUserId ? 'Tú: ' : ''}
                      {chat.lastMessage.mensaje}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="chat-unread-badge">{chat.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`chat-main-window ${isMobileView && !isMobileChat ? 'chat-hidden' : ''}`}>
        {selectedChat ? (
          <>
            <div className="chat-window-header">
              <div className="chat-header-user">
                {isMobileView && (
                  <button className="btn btn-ghost btn-sm" onClick={handleBackToList} style={{ padding: '4px 8px', marginRight: '4px' }}>←</button>
                )}
                <div className="chat-item-avatar sm">
                  <span>{(selectedChat.display_name?.[0] || 'U').toUpperCase()}</span>
                </div>
                <div>
                  <div className="chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedChat.display_name}
                    {selectedChat.rol === 'revendedor' && (
                      <span style={{ 
                        fontSize: '9px', padding: '1px 6px', borderRadius: '4px', fontWeight: 800,
                        backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa',
                        border: '1px solid #8b5cf6', textTransform: 'uppercase'
                      }}>
                        ⭐ Revendedor
                      </span>
                    )}
                    {selectedChat.soporte_status && (
                      <span style={{ 
                        fontSize: '9px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700,
                        backgroundColor: getStatusBadge(selectedChat.soporte_status)?.bg, 
                        color: getStatusBadge(selectedChat.soporte_status)?.color,
                        border: `1px solid ${getStatusBadge(selectedChat.soporte_status)?.color}`,
                        display: 'flex', alignItems: 'center', gap: '3px', textTransform: 'uppercase'
                      }}>
                        {getStatusBadge(selectedChat.soporte_status)?.icon} {getStatusBadge(selectedChat.soporte_status)?.label}
                      </span>
                    )}
                  </div>
                  <div className="chat-header-status text-xs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedChat.whatsapp || 'Sin WhatsApp'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>Saldo: ${parseFloat(selectedChat.saldo || 0).toFixed(2)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>/</span>
                    <span style={{ color: '#a855f7', fontWeight: 600 }}>{parseFloat(selectedChat.saldo_bs || 0).toLocaleString('es-VE')} Bs</span>
                  </div>
                </div>
              </div>
              <div className="chat-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {perfil?.rol === 'admin' && (
                  <div style={{ display: 'flex', gap: '6px', marginRight: '10px' }}>
                    <button 
                      onClick={() => handleUpdateStatus('resuelto')}
                      className="btn btn-sm"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                    >
                      ✅ Caso Resuelto
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus('pendiente')}
                      className="btn btn-sm"
                      style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                    >
                      ⚠️ Caso Pendiente
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus('critico')}
                      className="btn btn-sm"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                    >
                      🚨 Caso Crítico
                    </button>
                    {selectedChat.soporte_status && (
                       <button 
                         onClick={() => handleUpdateStatus(null)}
                         style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', marginLeft: '4px' }}
                         title="Limpiar estado"
                       >
                         ✕
                       </button>
                    )}
                  </div>
                )}
                <a 
                  href={`https://wa.me/${selectedChat.whatsapp?.replace(/\+/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-success btn-sm"
                >
                  WhatsApp
                </a>
              </div>
            </div>

            <div className="chat-messages-area">
              {messages.map((m, idx) => {
                const isMine = m.remitente_id === currentClienteId
                const showDate = idx === 0 || new Date(messages[idx-1].created_at).toDateString() !== new Date(m.created_at).toDateString()
                return (
                  <React.Fragment key={m.id}>
                    {showDate && (
                      <div className="chat-date-separator">
                        <span>{new Date(m.created_at).toLocaleDateString([], { day: '2-digit', month: 'long' })}</span>
                      </div>
                    )}
                    <div className={`message-bubble-wrapper ${isMine ? 'mine' : 'theirs'} ${m.es_sistema ? 'system' : ''}`}>
                      <div className={`message-bubble ${m.es_sistema ? 'system' : ''}`}>
                        {m.quoted_id && (
                          <div className="quoted-message-preview">
                            <div className="quoted-message-sender">
                              {messages.find(msg => msg.id === m.quoted_id)?.remitente_id === currentClienteId ? 'Tú' : selectedChat.display_name}
                            </div>
                            <div className="quoted-message-text truncate">
                              {messages.find(msg => msg.id === m.quoted_id)?.mensaje || 'Mensaje original...'}
                            </div>
                          </div>
                        )}
                        {!isMine && !m.es_sistema && <div className="message-sender">{selectedChat.display_name}</div>}
                        
                        {m.archivo_url && (
                          <div className="message-media">
                            {m.tipo_archivo === 'imagen' && (
                              <img src={m.archivo_url} alt="Adjunto" className="message-image" onClick={() => window.open(m.archivo_url, '_blank')} />
                            )}
                            {m.tipo_archivo === 'video' && (
                              <video src={m.archivo_url} controls className="message-video" />
                            )}
                            {m.tipo_archivo === 'audio' && (
                              <audio src={m.archivo_url} controls className="message-audio" />
                            )}
                          </div>
                        )}

                        <div className="message-text">{renderMessageWithLinks(m.mensaje)}</div>
                        <div className="message-meta">
                          {formatTime(m.created_at)}
                          {isMine && <span className={`message-status ${m.leido ? 'read' : ''}`}>✓✓</span>}
                        </div>
                        <button 
                          className="reply-button-small" 
                          onClick={() => setReplyingTo(m)}
                          title="Responder"
                        >
                          ↩
                        </button>
                        {isMine && (
                          <button 
                            className="delete-button-small" 
                            onClick={() => handleDeleteMessage(m.id)}
                            title="Eliminar mensaje"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-footer-wrapper">
              {filePreview && (
                <div className="media-preview-container">
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {pendingFile?.type.startsWith('image/') ? (
                      <img src={filePreview} alt="Preview" style={{ height: '40px', borderRadius: '4px' }} />
                    ) : (
                      <span className="text-xl">🎥</span>
                    )}
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{pendingFile.name} (Listo para enviar)</span>
                  </div>
                  <button className="btn btn-ghost" onClick={removePendingFile}>Remover</button>
                </div>
              )}

              {replyingTo && (
                <div className="replying-to-bar">
                  <div className="replying-to-content">
                    <div className="replying-to-title">Respondiendo a {replyingTo.remitente_id === currentUserId ? 'tu propio mensaje' : selectedChat.display_name}</div>
                    <div className="replying-to-text truncate">{replyingTo.mensaje}</div>
                  </div>
                  <button className="replying-to-close" onClick={() => setReplyingTo(null)}>✕</button>
                </div>
              )}

              {audioBlob && (
                <div className="media-preview-container">
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="text-xl">🎤</span>
                    <span>Nota de voz lista para enviar</span>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setAudioBlob(null)}>Eliminar</button>
                  <button className="btn btn-primary" onClick={sendAudio}>Enviar Audio</button>
                </div>
              )}

              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <label className="btn btn-icon btn-ghost" style={{ cursor: 'pointer' }}>
                  📎
                  <input type="file" hidden onChange={handleFileSelect} accept="image/*,video/*" />
                </label>
                
                {isRecording ? (
                  <div className="recording-bar" onClick={stopRecording}>
                    <div className="recording-dot"></div>
                    <span>Grabando... {recordingTime}s (Click para detener)</span>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    placeholder="Escribe un mensaje..." 
                    className="form-input"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isUploading || !!audioBlob}
                  />
                )}

                {!isRecording && !audioBlob && (
                  <button type="button" className="btn btn-icon btn-ghost audio-record-btn" onClick={startRecording}>
                    🎙️
                  </button>
                )}

                <button type="submit" className="btn btn-primary btn-icon" disabled={(!newMessage.trim() && !pendingFile) || isUploading || isRecording || !!audioBlob}>
                  {isUploading ? '...' : (pendingFile ? '📤' : '➔')}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-icon text-5xl mb-4">💬</div>
            <div className="text-2xl font-bold mb-2">Tus Mensajes</div>
            <p className="text-muted">Selecciona un chat para comenzar a responder a tus clientes.</p>
          </div>
        )}
      </div>

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
