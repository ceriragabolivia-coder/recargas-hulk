import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ConfigContext = createContext()

export function ConfigProvider({ children }) {
  const { user, perfil, loading: loadingAuth } = useAuth()
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    // Si estÃ¡ cargando el auth, no hacemos nada aÃºn
    if (loadingAuth) return
    
    // Si no hay usuario, terminamos de cargar pero sin config (o podrÃ­amos cargar la global si fuera pÃºblica)
    try {
      const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'

      let query = supabase.from('configuracion').select('*')
      
      if (user && isNegocio) {
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
  }, [user, perfil, loadingAuth])

  const updateConfig = async (clave, valor, isText = false) => {
    if (!user) return { error: new Error('No user logged in') }

    const isNegocio = perfil?.rol?.toLowerCase() === 'negocio'

    const safeValor = isText ? 0 : (Number(valor) || 0)
    const safeValorTexto = isText ? String(valor) : null

    let error;
    if (isNegocio) {
      const { error: upsertError } = await supabase
        .from('configuracion')
        .upsert({ 
          clave: clave, 
          valor: safeValor, 
          valor_texto: safeValorTexto, 
          owner_id: user.id 
        }, { onConflict: 'clave,owner_id' })
      error = upsertError;
    } else {
      const { error: updateError, data } = await supabase
        .from('configuracion')
        .update({ valor: safeValor, valor_texto: safeValorTexto, updated_at: new Date().toISOString() })
        .eq('clave', clave)
        .is('owner_id', null)
        .select()

      error = updateError;
      
      if (!error && (!data || data.length === 0)) {
        const { error: insertError } = await supabase
          .from('configuracion')
          .insert({ clave: clave, valor: safeValor, valor_texto: safeValorTexto, owner_id: null })
        error = insertError;
      }
    }
    
    if (error) {
      console.error("Error al actualizar configuraciÃ³n:", error)
    }
    
    return { error }
  }

  useEffect(() => {
    fetchConfig()

    const channel = supabase
      .channel('global-config-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'configuracion' 
      }, (payload) => {
        console.log('ðŸ”” GlobalContext: Sincronizando configuraciÃ³n...', payload.eventType)
        fetchConfig()
      })
      .subscribe()

    return () => {
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
