import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import AlertModal from './AlertModal'
import { getOptimizedImageUrl } from '../utils/helpers'
import { useConfiguracion } from '../hooks/useData'

export default function SupportChat({ perfil, forceOpen, onClose, onNavigate, isPage = false, isEmbedded = false }) {
  const [isOpen, setIsOpen] = useState(isPage || isEmbedded)
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
  const audioNotify = useRef(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isBotTyping, setIsBotTyping] = useState(false)

  useEffect(() => {
    // Sonido distintivo de "mensaje"
    audioNotify.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
    audioNotify.current.volume = 0.5
    
    // Solicitar permiso para notificaciones push si es posible
    if ("Notification" in window && Notification.permission === "default") {
      // Intentamos pedir permiso. Algunos navegadores requieren interacción del usuario.
      Notification.requestPermission();
    }
  }, [])

  useEffect(() => {
    if (forceOpen) setIsOpen(true)
  }, [forceOpen])  // Solo cargar el ID del perfil actual
  const currentUserId = perfil?.id
  const [currentClienteId, setCurrentClienteId] = useState(perfil?.cliente_uuid)
  const isAdmin = perfil?.rol?.toLowerCase() === 'admin'
  const { config } = useConfiguracion() || { config: null }
  const [currentBotNodeId, setCurrentBotNodeId] = useState(null)
  
  let chatbotNodes = []
  try {
    if (config?.chatbot_flujo) chatbotNodes = JSON.parse(config.chatbot_flujo)
  } catch(e) {}
  const isChatbotActiveGlobal = config?.chatbot_activo === 'true'

  // Sincronizar y buscar cliente_uuid si falta
  useEffect(() => {
    if (perfil?.cliente_uuid) {
      setCurrentClienteId(perfil.cliente_uuid)
    } else if (perfil?.id && !isAdmin) {
      // Fallback: Buscar en la tabla clientes
      const findClient = async () => {
        const { data } = await supabase
          .from('clientes')
          .select('id')
          .eq('auth_user_id', perfil.id)
          .single()
        if (data?.id) {
          setCurrentClienteId(data.id)
        }
      }
      findClient()
    }
  }, [perfil, isAdmin])

  // Variables específicas para ADMIN (lista de chats)
  const [activeChats, setActiveChats] = useState([]) // Lista de clientes con chat
  const [selectedChatClient, setSelectedChatClient] = useState(null) // Cliente seleccionado por el admin

  // Autoscroll para cuando se abre o seleccionan chats
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
      }
    }
    
    if (isOpen || isPage) {
      setTimeout(scrollToBottom, 50)
      setTimeout(scrollToBottom, 300) // Segundo intento por si el render tardó
    }
  }, [mensajes.length, isOpen, selectedChatClient])

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

  const loadUnreadCount = async () => {
    if (!currentClienteId || isAdmin) return
    try {
      const { count, error } = await supabase
        .from('soporte_mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', currentClienteId)
        .eq('leido', false)
        .neq('remitente_id', currentClienteId)
      
      if (error) throw error
      if (count !== null) setUnreadCount(count)
    } catch (err) {
      console.error("Error al cargar contador de no leídos:", err)
    }
  }



  const markMessagesAsRead = async (chatId) => {
    if (!chatId || isAdmin) return
    try {
      const { error } = await supabase
        .from('soporte_mensajes')
        .update({ leido: true })
        .eq('cliente_id', chatId)
        .eq('leido', false)
        .neq('remitente_id', currentClienteId)
      
      if (error) throw error
    } catch (err) {
      console.error("Error al marcar como leídos:", err)
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
      
    if (messagesData) {
      // 2. Extraer IDs únicos de clientes que tienen chat
      const uniqueClientIds = [...new Set(messagesData.map(m => m.cliente_id))]
      
      if (uniqueClientIds.length > 0) {
        // 3. Obtener la info de esos clientes
        const { data: clientsData, error: clientsError } = await supabase
          .from('clientes')
          .select('id, nombres, whatsapp')
          .in('id', uniqueClientIds)
          
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
      setUnreadCount(0) // Limpiar contador si estamos viendo el chat
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
              // Si el mensaje no es mío, sonar notificación y mostrar push
              if (currentClienteId && rawMessage.remitente_id !== currentClienteId && audioNotify.current) {
                audioNotify.current.play().catch(e => console.log('Audio play blocked:', e))
                
                // Mostrar notificación push si el chat está cerrado o la pestaña no tiene foco
                if (!isOpen) {
                  setUnreadCount(prev => prev + 1)
                }
              }

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

              // Si el chat está abierto, marcarlo como leído inmediatamente en BD
              if (isOpen && activeChatId) {
                markMessagesAsRead(activeChatId)
              }
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

  useEffect(() => {
    if (!isAdmin && currentClienteId) {
      loadUnreadCount()
    }
  }, [currentClienteId])

  useEffect(() => {
    if (isOpen && activeChatId) {
      setUnreadCount(0)
      markMessagesAsRead(activeChatId)
    }
  }, [isOpen, activeChatId])

  useEffect(() => {
    if (mensajes.length > 0 && isChatbotActiveGlobal && !isAdmin && chatbotNodes.length > 0) {
      const lastMsg = mensajes[mensajes.length - 1];
      if (lastMsg.es_sistema) {
        const node = chatbotNodes.find(n => n.mensaje === lastMsg.mensaje);
        setCurrentBotNodeId(node ? node.id : null);
      } else {
        setCurrentBotNodeId(null);
      }
    } else {
      setCurrentBotNodeId(null);
    }
  }, [mensajes, isChatbotActiveGlobal, isAdmin]);

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
    setShowOrderSelector(false)
    
    let orderContext = null;
    let nextNode = null;

    try {
      const { data } = await supabase
        .from('pedidos')
        .select('estado, notas_admin')
        .eq('numero_pedido', parseInt(orderNumber))
        .eq('cliente_id', currentClienteId)
        .limit(1)
        .maybeSingle();
      if (data) {
        orderContext = data;
        
        // Obtener SIEMPRE la configuración más fresca para evitar problemas si el usuario no recargó la página
        let currentNodes = chatbotNodes;
        try {
          const { data: configData } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'chatbot_flujo').single();
          if (configData && configData.valor_texto) {
            currentNodes = JSON.parse(configData.valor_texto);
          }
        } catch(e) { console.error(e) }

        let activeNodeId = currentBotNodeId;

        // Fallback: si currentBotNodeId se perdió (por recarga o race condition), buscamos el último nodo del sistema que solicita pedido.
        if (!activeNodeId && currentNodes.length > 0 && mensajes.length > 0) {
          // buscar el último mensaje del bot que corresponda a un nodo que solicite pedido
          for (let i = mensajes.length - 1; i >= 0; i--) {
            if (mensajes[i].es_sistema) {
              const possibleNode = currentNodes.find(n => n.mensaje?.trim() === mensajes[i].mensaje?.trim() && n.solicitar_pedido);
              if (possibleNode) {
                activeNodeId = possibleNode.id;
                break;
              }
            }
          }
        }

        if (!activeNodeId) {
          alert("DEBUG: No se pudo identificar el nodo origen.");
        }

        // Determinar siguiente nodo según el estatus
        if (activeNodeId && currentNodes.length > 0) {
          const activeNode = currentNodes.find(n => n.id === activeNodeId);
          if (activeNode) {
            let nextNodeId = null;
            if (data.estado === 'completado') {
              nextNodeId = activeNode.cond_completado;
            } else if (data.estado === 'rechazado') {
              nextNodeId = activeNode.cond_rechazado;
            } else {
              // pendiente, procesando, en proceso
              nextNodeId = activeNode.cond_en_proceso;
            }
            if (!nextNodeId) {
              alert("DEBUG: La condición no está conectada para el estado: " + data.estado);
            }
            if (nextNodeId) {
              nextNode = currentNodes.find(n => n.id === nextNodeId);
              if (!nextNode) {
                alert("DEBUG: El nodo destino no existe.");
              }
            }
          } else {
             alert("DEBUG: Nodo activo no encontrado en currentNodes.");
          }
        }
      } else {
        alert("DEBUG: Data de pedido vacía.");
      }
    } catch(e) { 
      console.error("Error al consultar pedido:", e);
      alert("DEBUG ERROR: " + e.message);
    }

    if (clientStatus === 'pendiente' || clientStatus === 'resuelto' || mensajes.length > 0) {
      // Si ya hay un ticket activo o estamos en el flujo del chatbot
      await supabase.from('soporte_mensajes').insert({
        cliente_id: activeChatId,
        remitente_id: currentClienteId,
        mensaje: `Pedido #${orderNumber}`,
        es_sistema: false
      });
      // Si el ticket estaba resuelto por el bot, lo reactivamos para que el admin pueda verlo
      if (clientStatus === 'resuelto') {
        await supabase.from('clientes').update({ soporte_status: null }).eq('id', activeChatId);
      }
      
      // Ejecutar la rama de condición si existe
      if (nextNode) {
        await executeBotNode(nextNode, currentClienteId, (nextNode.retraso || 0) * 1000, orderContext);
      }
    } else {
      const categoryWithOrder = `Pedido no completado (#${orderNumber})`
      await openTicket(categoryWithOrder)
    }
  }

  const openTicket = async (category) => {
    setClientStatus('pendiente')
    setTicketSubject(category)
    setShowOrderSelector(false) // Asegurar que el selector se cierre al iniciar ticket

    // 1. Enviar mensaje de sistema con el motivo
    const { data: adminProfile } = await supabase.from('perfiles').select('id').eq('rol', 'admin').limit(1).maybeSingle()
    let senderId = currentClienteId
    if (adminProfile) {
      const { data: adminCliente } = await supabase.from('clientes').select('id').eq('auth_user_id', adminProfile.id).maybeSingle()
      if (adminCliente) senderId = adminCliente.id
    }
    
    if (senderId) {
      const ticketMsg = `🎫 TICKET INICIADO: ${category.toUpperCase()}`
      let insertData = [{ cliente_id: currentClienteId, remitente_id: senderId, mensaje: ticketMsg, es_sistema: true }]
      
      if (isChatbotActiveGlobal && chatbotNodes.length > 0) {
        const rootNode = chatbotNodes.find(n => n.id === 'root') || chatbotNodes[0]
        
        let { error } = await supabase.from('soporte_mensajes').insert(insertData)
        if (error && (error.code === '42703' || error.message?.includes('es_sistema'))) {
          insertData.forEach(d => delete d.es_sistema)
          await supabase.from('soporte_mensajes').insert(insertData)
        }

        await executeBotNode(rootNode, senderId, (rootNode.retraso || 0) * 1000);
      } else {
        const infoMsg = "Explica tu caso; sé detallado y explica en un sólo mensaje para ser atendida tu solicitud. Una vez que envíes el mensaje sólo podrás escribir nuevamente cuando la administración responda a tu chat, para evitar la saturación del chat."
        insertData.push({ cliente_id: currentClienteId, remitente_id: senderId, mensaje: infoMsg, es_sistema: true })
        let { error } = await supabase.from('soporte_mensajes').insert(insertData)
        if (error && (error.code === '42703' || error.message?.includes('es_sistema'))) {
          insertData.forEach(d => delete d.es_sistema)
          await supabase.from('soporte_mensajes').insert(insertData)
        }
      }
      
      await supabase.from('clientes').update({ soporte_status: 'pendiente' }).eq('id', currentClienteId)
    }
  }

  const handleNewTicket = async () => {
    if (isAdmin || !currentClienteId) return
    try {
      await supabase.from('clientes').update({ soporte_status: null }).eq('id', currentClienteId)
      setClientStatus(null)
      setTicketSubject(null)
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
        const { data: adminProfile } = await supabase.from('perfiles').select('id').eq('rol', 'admin').limit(1).maybeSingle()
        let adminSenderId = null
        if (adminProfile) {
          const { data: adminCliente } = await supabase.from('clientes').select('id').eq('auth_user_id', adminProfile.id).maybeSingle()
          adminSenderId = adminCliente?.id
        }

        if (adminSenderId) {
          await supabase.from('soporte_mensajes').insert({
            cliente_id: activeChatId,
            remitente_id: adminSenderId,
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

  const executeBotNode = async (node, senderId, delayMs = 0, orderContext = null) => {
    const processNode = async () => {
      let finalMessage = node.mensaje || (node.tipo_archivo === 'imagen' ? '📷 Foto' : (node.tipo_archivo === 'video' ? '🎥 Video' : '📎 Archivo'));
      
      // Reemplazo de variables de contexto
      if (orderContext && finalMessage) {
        finalMessage = finalMessage.replace(/{motivo}/g, orderContext.notas_admin || 'No especificado');
      }

      setCurrentBotNodeId(node.id);

      await supabase.from('soporte_mensajes').insert({
        cliente_id: activeChatId,
        remitente_id: senderId,
        mensaje: finalMessage,
        es_sistema: true,
        archivo_url: node.archivo_url || null,
        tipo_archivo: node.tipo_archivo || null
      });

      if (node.contactar_humano) {
        await supabase.from('soporte_mensajes').insert({
          cliente_id: activeChatId,
          remitente_id: senderId,
          mensaje: "Serás atendido por un agente en breve. Por favor, explica tu caso detalladamente a continuación.",
          es_sistema: true
        });
      }

      if (node.solicitar_pedido) {
        const orders = await loadRecentPedidos();
        if (orders && orders.length > 0) {
          setRecentPedidos(orders);
          setShowOrderSelector(true);
        }
      }

      if (node.cerrar_ticket) {
        await supabase.from('clientes').update({ soporte_status: 'resuelto' }).eq('id', activeChatId);
        await supabase.from('soporte_mensajes').insert({
          cliente_id: activeChatId,
          remitente_id: senderId,
          mensaje: "✅ TICKET CERRADO AUTOMÁTICAMENTE",
          es_sistema: true
        });
        setClientStatus('resuelto');
      }
    };

    if (delayMs > 0) {
      setIsBotTyping(true);
      setTimeout(async () => {
        await processNode();
        setIsBotTyping(false);
      }, delayMs);
    } else {
      await processNode();
    }
  };

  const handleChatbotOption = async (option) => {
    if (!currentClienteId) return;
    
    // 1. Insert user's choice
    await supabase.from('soporte_mensajes').insert({
      cliente_id: activeChatId,
      remitente_id: currentClienteId,
      mensaje: option.texto,
      es_sistema: false
    });

    if (option.siguiente_nodo_id === 'humano') {
      setIsBotTyping(true);
      setTimeout(async () => {
        await supabase.from('soporte_mensajes').insert({
          cliente_id: activeChatId,
          remitente_id: currentClienteId,
          mensaje: "Serás atendido por un agente en breve. Por favor, explica tu caso detalladamente a continuación.",
          es_sistema: true
        });
        setIsBotTyping(false);
      }, 1000);
    } else {
      const nextNode = chatbotNodes.find(n => n.id === option.siguiente_nodo_id);
      if (nextNode) {
        await executeBotNode(nextNode, currentClienteId, (nextNode.retraso || 0) * 1000);
      }
    }
  };

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

  const content = (
    <div className={isPage ? "support-chat-page-wrapper" : (isEmbedded ? "support-chat-embedded-container" : "support-chat-container")}>
      
      {/* Ventana de Chat */}
      {(isOpen || isPage) && (
        <div className={`support-chat-window ${isPage ? 'is-page' : ''}`} style={{
          backgroundColor: '#0d0f1c',
          borderRadius: isPage ? '0' : '24px',
          boxShadow: isPage ? 'none' : '0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(17, 153, 142, 0.15)',
          border: isPage ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9998,
          position: isPage || isEmbedded ? 'relative' : undefined,
          width: isPage || isEmbedded ? '100%' : undefined,
          height: isPage || isEmbedded ? '100%' : undefined,
          maxHeight: isPage || isEmbedded ? 'none' : undefined,
          paddingBottom: isPage ? '64px' : '0'
        }}>
          
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderTopLeftRadius: isPage ? '0' : '24px', borderTopRightRadius: isPage ? '0' : '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)' }}>💬</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                {isAdmin ? (
                  selectedChatClient ? `Chat con ${selectedChatClient.nombres}` : 'Sala de Soporte'
                ) : (
                  'Soporte Hulk'
                )}
              </h3>
              {isAdmin && selectedChatClient && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '12px' }}
                  onClick={() => setSelectedChatClient(null)}
                >
                  ← Volver
                </button>
              )}
            </div>
            <button 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', cursor: 'pointer', transition: 'background 0.2s' }}
              onClick={() => { 
                if (isPage) {
                  if (onNavigate) onNavigate('dashboard');
                  else window.history.back();
                } else {
                  setIsOpen(false); 
                  if(onClose) onClose(); 
                }
              }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.4)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)'}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', backgroundColor: '#0d0f1c', backgroundImage: 'radial-gradient(circle at top, rgba(56, 239, 125, 0.04) 0%, transparent 70%)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
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
                      Inicia una conversación de soporte:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button 
                        onClick={() => handleSelectTicket('Soporte')}
                        style={{ 
                          height: '45px', borderRadius: '25px', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
                          boxShadow: '0 4px 10px rgba(0, 114, 255, 0.3)', transition: 'transform 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        💬 Crear ticket
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
                        const isMine = m.remitente_id === currentClienteId && !m.es_sistema
                        const isTicketInit = m.es_sistema && m.mensaje?.includes('TICKET INICIADO')
                        const isTicketClose = m.es_sistema && m.mensaje?.includes('TICKET CERRADO')
                        const isInfoMsg = m.es_sistema && !isTicketInit && !isTicketClose
                        return (
                          <div 
                            key={m.id} 
                            className={m.es_sistema ? (isInfoMsg ? 'message-bubble-wrapper' : 'message-bubble-wrapper system') : ''}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: m.es_sistema && !isInfoMsg ? 'center' : (isMine ? 'flex-end' : 'flex-start'),
                              width: '100%',
                              margin: m.es_sistema ? '4px 0' : '2px 0'
                            }}
                          >
                            {(!m.es_sistema || isInfoMsg) && (
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', marginLeft: '6px', marginRight: '6px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                {isMine ? 'Tú' : (m.es_sistema ? 'Soporte' : (m.remitente?.nombres || 'Soporte'))}
                              </div>
                            )}

                            {/* TICKET INICIADO - special badge */}
                            {isTicketInit ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'linear-gradient(135deg, rgba(124,91,247,0.25), rgba(56,239,125,0.15))',
                                border: '1px solid rgba(124,91,247,0.4)',
                                borderRadius: '12px', padding: '10px 16px',
                                maxWidth: '90%', width: 'fit-content',
                                boxShadow: '0 4px 20px rgba(124,91,247,0.2)'
                              }}>
                                <span style={{ fontSize: '18px' }}>🎫</span>
                                <div>
                                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Ticket abierto</div>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#c4b5fd' }}>
                                    {m.mensaje?.replace('🎫 TICKET INICIADO: ', '').trim()}
                                  </div>
                                </div>
                              </div>
                            ) : isTicketClose ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'linear-gradient(135deg, rgba(56,239,125,0.15), rgba(17,153,142,0.15))',
                                border: '1px solid rgba(56,239,125,0.3)',
                                borderRadius: '12px', padding: '10px 16px',
                                maxWidth: '90%', width: 'fit-content',
                                boxShadow: '0 4px 20px rgba(56,239,125,0.15)'
                              }}>
                                <span style={{ fontSize: '18px' }}>✅</span>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#6ee7b7' }}>{m.mensaje}</div>
                              </div>
                            ) : (
                            <div className={`message-bubble ${m.es_sistema && !isInfoMsg ? 'system' : ''}`} style={{ 
                              background: isMine 
                                ? 'linear-gradient(135deg, #7c6af7 0%, #4f46e5 100%)' 
                                : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                              color: '#fff',
                              padding: '11px 16px', 
                              borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              maxWidth: '82%', 
                              wordBreak: 'break-word', 
                              fontSize: '14px',
                              lineHeight: '1.5',
                              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                              boxShadow: isMine ? '0 4px 20px rgba(124,106,247,0.35)' : '0 2px 12px rgba(0,0,0,0.2)',
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
                                    <img loading="lazy" decoding="async" src={getOptimizedImageUrl(m.archivo_url, 400)} alt="Adjunto" style={{ width: '100%', borderRadius: '8px', display: 'block', cursor: 'pointer' }} onClick={() => window.open(m.archivo_url, '_blank')} />
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
                            )}
                          </div>
                        )
                      })
                    )}
                    {isBotTyping && (
                      <div className="message-bubble typing-indicator" style={{ 
                        alignSelf: 'flex-start',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                        color: 'rgba(255,255,255,0.7)',
                        padding: '11px 16px', 
                        borderRadius: '18px 18px 18px 4px',
                        margin: '4px 0',
                        fontSize: '13px',
                        fontStyle: 'italic',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        Escribiendo...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </>
            )}
          </div>
    
          {/* Footer Input */}
          {(!isAdmin || selectedChatClient) && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#0f111a', borderBottomLeftRadius: isPage ? '0' : '24px', borderBottomRightRadius: isPage ? '0' : '24px' }}>
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
                    Inicia una conversación de soporte:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleSelectTicket('Soporte')}
                        style={{ 
                          padding: '8px 16px', borderRadius: '20px', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px',
                          background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
                          boxShadow: '0 4px 10px rgba(0, 114, 255, 0.3)', transition: 'transform 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        💬 Crear ticket
                      </button>
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
                {/* Advertencia de dos mensajes para tickets nuevos */}
                {!isAdmin && ticketSubject && mensajes.length < 4 && (
                  <div style={{ 
                    margin: '0', padding: '7px 14px',
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))',
                    borderTop: '1px solid rgba(251,191,36,0.25)',
                    fontSize: '11px', color: '#fbbf24', textAlign: 'center',
                    fontWeight: '600', letterSpacing: '0.3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}>
                    <span>⚠️</span> Solo tienes dos mensajes para explicar tu caso.
                  </div>
                )}

                {filePreview && (
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      {pendingFile?.type.startsWith('image/') ? (
                        <img loading="lazy" decoding="async" src={filePreview} style={{ height: '40px', borderRadius: '6px' }} alt="Preview" />
                      ) : (
                        <div style={{ height: '40px', width: '40px', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>🎥</div>
                      )}
                      <button onClick={removePendingFile} style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer' }}>×</button>
                    </div>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{pendingFile.name}</span>
                  </div>
                )}

                {isChatbotActiveGlobal && currentBotNodeId && !isAdmin ? (
                  (() => {
                    const activeNode = chatbotNodes.find(n => n.id === currentBotNodeId)
                    if (!activeNode) return null;
                    return (
                      <div style={{ padding: '16px', backgroundColor: 'rgba(13,15,28,0.98)', borderTop: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {activeNode.opciones.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleChatbotOption(opt)}
                            style={{ 
                              padding: '10px 16px', borderRadius: '16px', border: '1px solid rgba(0, 210, 255, 0.3)', color: '#00d2ff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px',
                              background: 'rgba(0, 210, 255, 0.05)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 210, 255, 0.1)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 210, 255, 0.05)'; e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            {opt.texto}
                          </button>
                        ))}
                      </div>
                    )
                  })()
                ) : (
                  <form onSubmit={handleSendMessage} style={{ padding: '10px 12px', backgroundColor: 'rgba(13,15,28,0.98)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '10px', alignItems: 'center', backdropFilter: 'blur(12px)' }}>
                    <label style={{ cursor: 'pointer', opacity: isUploading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}>
                      <span style={{ fontSize: '16px' }}>📎</span>
                      <input type="file" hidden onChange={handleFileSelect} accept="image/*,video/*" disabled={isUploading} />
                    </label>

                    {isRecording ? (
                      <div style={{ flex: 1, color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(248,113,113,0.1)', borderRadius: '20px', padding: '10px 16px' }} onClick={stopRecording}>
                        <div className="recording-dot"></div>
                        <span>{recordingTime}s — Toca para parar</span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ 
                          flex: 1, 
                          fontSize: '14px', 
                          borderRadius: '22px', 
                          padding: '10px 18px', 
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          opacity: (isThrottled && !isAdmin) || isResolved ? 0.5 : 1 
                        }}
                        placeholder={isResolved ? "Ticket resuelto" : ((isThrottled && !isAdmin) ? "Esperando respuesta..." : "Escribe tu mensaje...")}
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        disabled={(isThrottled && !isAdmin) || isResolved || loadingThrottle || isUploading || !!audioBlob}
                      />
                    )}

                    {!isRecording && !audioBlob && isAdmin && (
                      <button type="button" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'} onClick={startRecording}>
                        🎙️
                      </button>
                    )}

                    <button 
                      type="submit" 
                      style={{ borderRadius: '50%', width: '42px', height: '42px', flexShrink: 0, padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #7c6af7 0%, #4f46e5 100%)', border: 'none', color: '#fff', fontSize: '17px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,106,247,0.5)', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,106,247,0.7)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,106,247,0.5)'; }}
                      disabled={(!newMessage.trim() && !pendingFile && !isAdmin) || (!isAdmin && mensajes.length === 0 && !ticketSubject) || (isThrottled && !isAdmin) || loadingThrottle || isUploading || !!audioBlob}
                    >
                      {isUploading ? '⌛' : (pendingFile ? '📤' : '➤')}
                    </button>
                  </form>
                )}
                </>
              )}
              </div>
          )}

        </div>
      )}

      {/* Botón flotante para abrir/cerrar */}
      {!isOpen && !isPage && !isEmbedded && (
        <button 
          className="support-chat-toggle"
          style={{ 
            position: 'fixed', bottom: '30px', right: '30px',
            padding: isOpen ? '0' : '12px 24px',
            width: isOpen ? '65px' : 'auto', 
            height: isOpen ? '65px' : 'auto', 
            borderRadius: '35px',
            background: isOpen ? 'var(--bg-panel)' : '#25D366',
            color: isOpen ? 'var(--text-primary)' : 'white', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isOpen ? '30px' : '18px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: isOpen ? '0 10px 30px rgba(0, 0, 0, 0.2)' : '0 10px 30px rgba(37, 211, 102, 0.4)', 
            zIndex: 9999,
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            border: isOpen ? '1px solid var(--border-color)' : 'none',
          }}
          onClick={() => {
            if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
            }
            const newState = !isOpen;
            setIsOpen(newState);
            if (!newState && onClose) onClose();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {isOpen ? '✕' : (
              <>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.181-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793 0-.853.448-1.273.607-1.446.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.177.211-.077.383.101.173.449.743.964 1.203.664.591 1.221.774 1.394.86.173.088.274.072.376-.043.101-.116.433-.506.548-.68.116-.173.231-.144.39-.087.158.058 1.011.477 1.184.564.173.087.289.129.332.202.043.073.043.419-.101.824z"/>
                </svg>
                <span>Soporte</span>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-15px', right: '-15px',
                    backgroundColor: '#ff4757', color: '#fff',
                    fontSize: '12px', minWidth: '22px', height: '22px',
                    borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px', fontWeight: '900', border: '2px solid #25D366',
                    boxShadow: '0 4px 10px rgba(255, 71, 87, 0.5)',
                    zIndex: 10000,
                    animation: 'pulse 2s infinite'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </span>
        </button>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 4px 10px rgba(255, 71, 87, 0.5); }
          50% { transform: scale(1.1); box-shadow: 0 4px 20px rgba(255, 71, 87, 0.8); }
          100% { transform: scale(1); box-shadow: 0 4px 10px rgba(255, 71, 87, 0.5); }
        }
      ` }} />

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

  if (isEmbedded) return content;
  return content;
}
