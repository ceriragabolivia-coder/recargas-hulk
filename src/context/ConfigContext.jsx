import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ConfigContext = createContext()

export function ConfigProvider({ children }) {
  const { user, perfil, loading: loadingAuth } = useAuth()
  
  // Inicializar con datos del caché si existen para renderizado inmediato
  const [config, setConfig] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_system_config');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  })
  const [loading, setLoading] = useState(!localStorage.getItem('cached_system_config'))

  const fetchConfig = useCallback(async () => {
    if (loadingAuth) return
    
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
        // Guardar en caché
        localStorage.setItem('cached_system_config', JSON.stringify(obj))
      } else if (isNegocio) {
        const { data: globalData } = await supabase.from('configuracion').select('*').is('owner_id', null)
        if (globalData) {
          const obj = {}
          globalData.forEach(r => {
            const val = r.valor_texto !== null && r.valor_texto !== undefined ? r.valor_texto : String(r.valor)
            obj[r.clave] = val
          })
          setConfig(obj)
          localStorage.setItem('cached_system_config', JSON.stringify(obj))
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
    const targetOwnerId = isNegocio ? user.id : null;

    const updatePayload = { updated_at: new Date().toISOString() };
    if (isText) {
      updatePayload.valor_texto = String(valor);
    } else {
      updatePayload.valor = Number(valor) || 0;
      updatePayload.valor_texto = null;
    }

    let error;
    let query = supabase
      .from('configuracion')
      .update(updatePayload)
      .eq('clave', clave);

    if (targetOwnerId) {
      query = query.eq('owner_id', targetOwnerId);
    } else {
      query = query.is('owner_id', null);
    }

    const { error: updateError, data } = await query.select();
    error = updateError;

    if (!error && (!data || data.length === 0)) {
      const insertPayload = { clave: clave, owner_id: targetOwnerId };
      if (isText) {
        insertPayload.valor_texto = String(valor);
        insertPayload.valor = 0;
      } else {
        insertPayload.valor = Number(valor) || 0;
        insertPayload.valor_texto = null;
      }

      const { error: insertError } = await supabase
        .from('configuracion')
        .insert(insertPayload);
      error = insertError;
    }
    
    if (error) {
      console.error("Error al actualizar configuración:", error)
      return { error }
    } else {
      // Forzar actualización local inmediata si fue exitoso
      fetchConfig()
      return { success: true }
    }
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
