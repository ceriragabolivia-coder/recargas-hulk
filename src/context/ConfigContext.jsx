import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const ConfigContext = createContext()

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('configuracion').select('*')
      if (error) throw error
      if (data) {
        const obj = {}
        data.forEach(r => {
          // Si valor_texto no es null, lo usamos; si no, usamos valor (numérico)
          const val = r.valor_texto !== null && r.valor_texto !== undefined ? r.valor_texto : String(r.valor)
          obj[r.clave] = val
        })
        setConfig(obj)
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateConfig = async (clave, valor, isText = false) => {
    const payload = isText ? { clave, valor_texto: String(valor), valor: 0 } : { clave, valor: Number(valor) }
    const { error } = await supabase
      .from('configuracion')
      .upsert(payload, { onConflict: 'clave' })
    
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
