import React, { useState, useEffect, createContext, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const { user, perfil } = useAuth()

  useEffect(() => {
    const savedCart = localStorage.getItem('cart')
    if (savedCart) setCart(JSON.parse(savedCart))
  }, [])

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item))
  }

  const clearCart = () => setCart([])

  const checkout = async (metodoPagoId, referencia, totalUsd, totalBs, whatsappCliente, captureUrl = null) => {
    if (!user || cart.length === 0) return { error: 'No hay productos o usuario' }
    
    const { data: pedido, error: pedidoError } = await supabase.from('pedidos').insert({
      auth_user_id: user.id,
      cliente_id: perfil?.cliente_uuid || null,
      metodo_pago_id: metodoPagoId,
      referencia_pago: referencia,
      total_usd: totalUsd,
      total_bs: totalBs,
      whatsapp_cliente: whatsappCliente,
      estado: 'pendiente',
      comprobante_url: captureUrl
    }).select().single()

    if (pedidoError) return { error: pedidoError }

    const items = cart.map(item => ({
      pedido_id: pedido.id,
      producto_id: item.id,
      cantidad: item.quantity,
      precio_usd: item.venta_usd,
      precio_bs: item.venta_bs
    }))

    const { error: itemsError } = await supabase.from('pedido_detalles').insert(items)
    if (itemsError) return { error: itemsError }

    clearCart()
    return { data: pedido }
  }

  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart])
  const totalUSD = useMemo(() => cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0), [cart])
  const totalBs = useMemo(() => Math.round(cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0)), [cart])

  const value = useMemo(() => ({ 
    cart, addToCart, removeFromCart, updateQuantity, clearCart, checkout, 
    totalItems, totalUSD, totalBs 
  }), [cart, totalItems, totalUSD, totalBs])

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe usarse dentro de un CartProvider')
  }
  return context
}
