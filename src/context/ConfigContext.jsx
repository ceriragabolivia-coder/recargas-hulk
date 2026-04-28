import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const ConfigContext = createContext()

export function ConfigProvider({ children }) {
  console.log('⚙️ ConfigContext: Inicializando ConfigProvider...');
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'

      let query = supabase.from('configuracion').select('*')
      if (isNegocio) {
        query = query.eq('owner_id', user.id)
      } else {
        query = query.is('owner_id', null)
      }

      const { data, error } = await query
      if (error) throw error
      
      if (data && data.length > 0) {
        const obj = {}
        data.forEach(r => {
          const val = r.valor_texto !== null && r.valor_texto !== undefined ? r.valor_texto : String(r.valor)
          obj[r.clave] = val
        })
        setConfig(obj)
      } else if (isNegocio) {
        // Fallback to global config if business hasn't set its own yet
        const { data: globalData } = await supabase.from('configuracion').select('*').is('owner_id', null)
        if (globalData) {
          const obj = {}
          globalData.forEach(r => {
            const val = r.valor_texto !== null && r.valor_texto !== undefined ? r.valor_texto : String(r.valor)
            obj[r.clave] = val
          })
          setConfig(obj)
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateConfig = async (clave, valor, isText = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('No user logged in') }

    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
    const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'

    const safeValor = isText ? 0 : (Number(valor) || 0)
    const safeValorTexto = isText ? String(valor) : null

    // Usar la función RPC para evitar problemas con upsert y constraints nulos
    const { error } = await supabase.rpc('set_config', {
      p_clave: clave,
      p_valor: safeValor,
      p_texto: safeValorTexto,
      p_owner: isNegocio ? user.id : null
    })
    
    if (error) {
      console.error("Error al actualizar configuración:", error)
    }
    
    return { error }
  }

  useEffect(() => {
    // Retrasar la carga de config para evitar conflictos con el bloqueo de sesión de Auth
    const timer = setTimeout(() => {
      fetchConfig()
    }, 200)

    const channel = supabase
      .channel('global-config-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'configuracion' 
      }, (payload) => {
        console.log('🔔 GlobalContext: Sincronizando configuración...', payload.eventType)
        fetchConfig()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conexión Realtime de Configuración establecida')
        }
      })

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [fetchConfig])

  const value = useMemo(() => ({ config, loading, updateConfig, refetch: fetchConfig }), [config, loading, fetchConfig])

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

export const useConfigContext = () => {
  const context = useContext(ConfigContext)
  if (!context) {
    throw new Error('useConfigContext debe usarse dentro de un ConfigProvider')
  }
  return context
}
