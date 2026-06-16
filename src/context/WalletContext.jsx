import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useConfigContext } from './ConfigContext'

const WalletContext = createContext()

export function WalletProvider({ children }) {
  const { user, perfil } = useAuth()
  const { config } = useConfigContext()
  const [wallet, setWallet] = useState(null)
  const [adminSalesBalance, setAdminSalesBalance] = useState({ saldo_usd: 0, saldo_bs: 0 })
  const [recargas, setRecargas] = useState([])
  const [transacciones, setTransacciones] = useState([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)

  async function fetchWallet() {
    if (!user) return
    if (!initialLoadDone.current) setLoading(true)
    
    // 1. Saldo de Cliente
    const { data: walletData } = await supabase
      .from('billeteras')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    setWallet(walletData || { saldo: 0, saldo_bs: 0 })

    // 2. Saldo de Operaciones (Solo Admin)
    if (perfil?.rol?.toLowerCase() === 'admin') {
      const { data: salesData } = await supabase
        .from('admin_saldos')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (salesData) setAdminSalesBalance(salesData)
    }

    // 3. Recargas y Transacciones
    const [recRes, transRes] = await Promise.all([
      supabase.from('billetera_recargas').select('*, metodos_pago(nombre)').eq('auth_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('billetera_transacciones').select('*').eq('auth_user_id', user.id).order('created_at', { ascending: false })
    ])

    setRecargas(recRes.data || [])
    setTransacciones(transRes.data || [])
    setLoading(false)
    initialLoadDone.current = true
  }

  async function solicitarRecarga(monto, metodoId, referencia, comprobanteUrl = null, moneda = 'usd') {
    // Validación de seguridad para montos fijos en Bs
    if (moneda === 'bs' && config?.montos_billetera_bs) {
      const allowedAmounts = config.montos_billetera_bs.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v) && v > 0)
      if (allowedAmounts.length > 0 && !allowedAmounts.includes(Number(monto))) {
        return { error: new Error('El monto ingresado no es válido. Seleccione uno de los montos permitidos.') }
      }
    }

    const { data, error } = await supabase.from('billetera_recargas').insert({
      auth_user_id: user.id,
      monto: Number(monto),
      metodo_pago_id: metodoId,
      referencia_pago: referencia,
      comprobante_url: comprobanteUrl,
      moneda
    }).select()
    return { data, error }
  }

  useEffect(() => {
    fetchWallet()

    if (!user) return;

    // Suscripción Realtime: Billetera Personal
    const walletChannel = supabase
      .channel(`wallet_shared_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'billeteras', filter: `auth_user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
           setWallet(payload.new);
        }
      })
      .subscribe();

    // Suscripción Realtime: Saldo Admin
    let adminChannel;
    if (perfil?.rol?.toLowerCase() === 'admin') {
      adminChannel = supabase
        .channel(`admin_sales_shared_${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'admin_saldos', filter: `auth_user_id=eq.${user.id}`
        }, (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
             setAdminSalesBalance(payload.new);
          }
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(walletChannel);
      if (adminChannel) supabase.removeChannel(adminChannel);
    }
  }, [user, perfil?.rol])

  const value = {
    wallet,
    adminSalesBalance,
    recargas,
    transacciones,
    loading,
    solicitarRecarga,
    refetch: fetchWallet
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet debe usarse dentro de un WalletProvider')
  return context
}
