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

  const addToCart = (product, juego, finalPrice, rechargeData) => {
    // Generar un ID único para cada entrada (producto + ID de jugador)
    // Esto permite que el usuario compre el mismo paquete para distintos IDs
    const cartId = `${product.id}-${rechargeData.player_id || rechargeData.account_email || Date.now()}`
    
    const itemToAdd = {
      ...product,
      cart_id: cartId,
      juego: juego.nombre,
      metodo_recarga: juego.metodo_recarga,
      venta_bs: finalPrice.venta_bs,
      venta_usd: finalPrice.venta_usd,
      ...rechargeData,
      quantity: 1
    }

    setCart(prev => {
      const existing = prev.find(item => item.cart_id === cartId)
      if (existing) {
        return prev.map(item => item.cart_id === cartId ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, itemToAdd]
    })
  }

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(item => item.cart_id !== cartId))
  }

  const updateQuantity = (cartId, quantity) => {
    if (quantity < 1) return
    setCart(prev => prev.map(item => item.cart_id === cartId ? { ...item, quantity } : item))
  }

  const clearCart = () => setCart([])

  /**
   * checkout (Versión compatible con Checkout.jsx)
   * 
   * @param {function} registrarVenta - Función de useVentas para registrar venta (opcional/fallback)
   * @param {string} clienteId - ID del cliente
   * @param {string} metodoPagoId - ID del método de pago
   * @param {string} referencia - Referencia del pago
   * @param {string} whatsapp - WhatsApp del cliente (opcional)
   * @param {object} ruletaDesc - Objeto del descuento de ruleta (si aplica)
   * @param {string} existingPedidoId - ID de un pedido ya iniciado (opcional)
   * @param {string} comprobanteUrl - URL de la captura subida
   * @param {boolean} shouldUpdate - Flag de actualización
   */
  const checkout = async (registrarVenta, clienteId, metodoPagoId, referencia, whatsapp, ruletaDesc, existingPedidoId, comprobanteUrl, shouldUpdate) => {
    if (!user || cart.length === 0) return [{ id: 'pedido', error: 'Carrito vacío o sesión no iniciada' }]

    try {
      // 1. Calcular totales finales aplicados
      const totalUSD = cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0)
      const totalBs = cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0)
      
      const ruletaFactor = ruletaDesc ? (1 - ruletaDesc.porcentaje / 100) : 1
      const finalUSD = +(totalUSD * ruletaFactor).toFixed(2)
      const finalBs = Math.round(totalBs * ruletaFactor)

      const pedidoData = {
        auth_user_id: user.id,
        cliente_id: perfil?.cliente_uuid || clienteId || null,
        metodo_pago_id: metodoPagoId || null,
        referencia_pago: referencia || 'N/A',
        total_usd: finalUSD,
        total_bs: finalBs,
        whatsapp_cliente: whatsapp || null,
        estado: 'pendiente',
        comprobante_url: comprobanteUrl || null
      }

      let pedido;
      let error;

      if (existingPedidoId) {
        // Actualizar pedido existente
        const { data, error: updateError } = await supabase
          .from('pedidos')
          .update(pedidoData)
          .eq('id', existingPedidoId)
          .select()
          .single()
        pedido = data
        error = updateError
      } else {
        // Insertar nuevo pedido
        const { data, error: insertError } = await supabase
          .from('pedidos')
          .insert(pedidoData)
          .select()
          .single()
        pedido = data
        error = insertError
      }

      if (error) throw error

      // 2. Insertar detalles del pedido (borramos anteriores si es actualización)
      if (existingPedidoId) {
        await supabase.from('pedido_detalles').delete().eq('pedido_id', existingPedidoId)
      }

      const items = cart.map(item => ({
        pedido_id: pedido.id,
        producto_id: item.id,
        cantidad: item.quantity,
        precio_usd: item.venta_usd,
        precio_bs: item.venta_bs,
        // DATOS DE RECARGA (Cruciales)
        player_id: item.player_id || null,
        account_email: item.account_email || null,
        account_password: item.account_password || null,
        account_user: item.account_user || null
      }))

      const { error: itemsError } = await supabase.from('pedido_detalles').insert(items)
      if (itemsError) throw itemsError

      clearCart()
      
      // Retornar en el formato de array que espera Checkout.jsx
      return [{ id: 'pedido', data: pedido, error: null }]

    } catch (err) {
      console.error('Error in checkout:', err)
      return [{ id: 'pedido', error: err.message }]
    }
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
