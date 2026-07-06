import React, { useState, useEffect, createContext, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { processAutoDeliveryOrder } from '../utils/autoProcess'
import { processTiendaGiftVenOrder } from '../utils/apiProcessor'
import { calcularPrecioVenta } from '../utils/helpers'

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
    const cartId = `${product.id}-${rechargeData.player_id || rechargeData.account_email || Date.now()}-${rechargeData.zone_id || ''}`
    
    const itemToAdd = {
      ...product,
      cart_id: cartId,
      juego: juego.nombre,
      metodo_recarga: juego.metodo_recarga,
      venta_bs: finalPrice.venta_bs,
      venta_usd: finalPrice.venta_usd,
      ...rechargeData,
      nickname: rechargeData.nickname || null,
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

  const validateCartPrices = async (currentConfig, currentUserProfile) => {
    if (cart.length === 0) return false;
    try {
      const productIds = [...new Set(cart.map(item => item.id))];
      const { data: dbProducts, error } = await supabase
        .from('productos')
        .select('*, juegos(*)')
        .in('id', productIds);
      
      if (error || !dbProducts) return false;

      let changed = false;
      const updatedCart = cart.map(item => {
        const dbProd = dbProducts.find(p => p.id === item.id);
        if (!dbProd) return item; // Producto no encontrado

        // Encontrar el juego específico (puede ser un arreglo o un objeto dependiendo de Supabase)
        let dbJuego = null;
        if (Array.isArray(dbProd.juegos)) {
          dbJuego = dbProd.juegos.find(j => j.nombre === item.juego);
        } else if (dbProd.juegos && dbProd.juegos.nombre === item.juego) {
          dbJuego = dbProd.juegos;
        }

        // Si no encontramos el juego exacto, probamos con dbProd como juego por defecto (para retrocompatibilidad)
        if (!dbJuego) dbJuego = dbProd; 

        const newPrice = calcularPrecioVenta(dbProd, dbJuego, currentConfig, currentUserProfile);

        if (newPrice.venta_usd !== item.venta_usd || newPrice.venta_bs !== item.venta_bs) {
          changed = true;
          return { ...item, venta_usd: newPrice.venta_usd, venta_bs: newPrice.venta_bs };
        }
        return item;
      });

      if (changed) {
        setCart(updatedCart);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error validating cart prices:', err);
      return false;
    }
  };

  const checkout = async (registrarVenta, clienteId, metodoPagoId, referencia, whatsapp, ruletaDesc, existingPedidoId, comprobanteUrl, shouldUpdate) => {
    if (!user || cart.length === 0) return [{ id: 'pedido', error: 'Carrito vacío o sesión no iniciada' }]

    if (perfil && ['baneado', 'suspendido', 'rechazado'].includes(perfil.estado?.toLowerCase())) {
      return [{ id: 'pedido', error: 'Tu cuenta no tiene permisos para realizar pedidos (Baneada/Suspendida).' }]
    }

    try {
      const totalUSD = cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0)
      const totalBs = cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0)
      
      const ruletaFactor = ruletaDesc ? (1 - ruletaDesc.porcentaje / 100) : 1
      const finalUSD = +(totalUSD * ruletaFactor).toFixed(2)
      const finalBs = Math.round(totalBs * ruletaFactor)

      const isAutomatic = (referencia && (referencia.includes('BILLETERA') || referencia.includes('PAGO_TOTAL')))
      
      // DOBLE VERIFICACIÓN CONTRA DUPLICADOS (Blindaje extra cliente a nivel inserción)
      let pagoVerificadoApk = false;
      let apkPagoId = null;

      if (referencia && !isAutomatic && referencia !== 'N/A') {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: existingPedidos } = await supabase
          .from('pedidos')
          .select('id')
          .eq('referencia_pago', referencia.trim())
          .gte('created_at', fortyEightHoursAgo)
          .limit(1);
          
        if (existingPedidos && existingPedidos.length > 0 && (!existingPedidoId || existingPedidos[0].id !== existingPedidoId)) {
          return [{ id: 'pedido', error: `La referencia de pago ${referencia} ya ha sido registrada en otro pedido. No se pueden duplicar referencias.` }]
        }

        // VERIFICACIÓN CON PAGOS APK (AUTO-APROBACIÓN DE PAGO)
        try {
          const { data: apkPago } = await supabase
            .from('pagos_apk')
            .select('id, monto')
            .eq('referencia', referencia.trim())
            .eq('status', 'disponible')
            .single();

          if (apkPago && Math.abs(parseFloat(apkPago.monto) - parseFloat(finalBs)) <= 0.05) {
            pagoVerificadoApk = true;
            apkPagoId = apkPago.id;
          }
        } catch (err) {
          console.error("Error verificando APK en checkout:", err);
        }
      }

      const pedidoData = {
        cliente_id: user.id, 
        metodo_pago_id: metodoPagoId || null,
        referencia_pago: referencia ? referencia.trim() : 'N/A',
        total_usd: finalUSD,
        total_bs: finalBs,
        estado: 'pendiente',
        comprobante_url: comprobanteUrl || null,
        pago_verificado: (isAutomatic || pagoVerificadoApk) ? true : null
      }

      let pedido;
      let error;

      if (existingPedidoId) {
        const { data, error: updateError } = await supabase
          .from('pedidos')
          .update(pedidoData)
          .eq('id', existingPedidoId)
          .select()
          .single()
        pedido = data
        error = updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('pedidos')
          .insert(pedidoData)
          .select()
          .single()
        pedido = data
        error = insertError
      }

      if (error) throw error

      // Usamos 'pedido_items' que es el nombre real en la base de datos
      if (existingPedidoId) {
        await supabase.from('pedido_items').delete().eq('pedido_id', existingPedidoId)
      }

      const items = cart.flatMap(item => {
        const rows = []
        for (let i = 0; i < item.quantity; i++) {
          rows.push({
            pedido_id: pedido.id,
            producto_id: item.id,
            juego_nombre: item.juego,
            producto_nombre: item.nombre,
            cantidad: 1, // Dividimos en registros individuales para checks separados
            precio_usd: item.venta_usd,
            precio_bs: item.venta_bs,
            metodo_recarga: item.metodo_recarga,
            player_id: item.player_id || null,
            nickname: item.nickname || null,
            account_email: item.account_email || null,
            account_password: item.account_password || null,
            account_user: item.account_user || null,
            zone_id: item.zone_id || null,
            producto_icono: item.icono_url || null
          })
        }
        return rows
      })

      const { error: itemsError } = await supabase.from('pedido_items').insert(items)
      if (itemsError) throw itemsError

      clearCart()

      if (pagoVerificadoApk && apkPagoId) {
        try {
          await supabase.from('pagos_apk').update({
            status: 'usado',
            pedido_id: pedido.id,
            usuario_id: user.id
          }).eq('id', apkPagoId);
          console.log(`✅ Pago del pedido ${pedido.id} auto-aprobado por APK.`);
        } catch (err) {
          console.error("Error al actualizar pagos_apk:", err);
        }
      }

      if (isAutomatic || pagoVerificadoApk) {
        // Ejecutamos en background
        processAutoDeliveryOrder(pedido.id).then(async (processed) => {
          if (processed) {
             console.log('Pedido auto-procesado correctamente por baúl');
          } else {
             // Si no se procesó por el baúl, intentamos con la API
             const apiProcessed = await processTiendaGiftVenOrder(pedido.id, null, false).catch(() => false);
             if (apiProcessed) console.log('Pedido auto-procesado correctamente por API');
          }
        }).catch(err => console.error(err));
      }

      return [{ id: 'pedido', data: pedido, error: null }]

    } catch (err) {
      console.error('Error in checkout:', err)
      return [{ id: 'pedido', error: err.message }]
    }
  }

  const [isCartOpen, setIsCartOpen] = useState(false)

  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart])
  const totalUSD = useMemo(() => cart.reduce((acc, item) => acc + (item.venta_usd * item.quantity), 0), [cart])
  const totalBs = useMemo(() => Math.round(cart.reduce((acc, item) => acc + (item.venta_bs * item.quantity), 0)), [cart])

  const value = useMemo(() => ({ 
    cart, addToCart, removeFromCart, updateQuantity, clearCart, checkout, validateCartPrices,
    totalItems, totalUSD, totalBs,
    isCartOpen, setIsCartOpen
  }), [cart, totalItems, totalUSD, totalBs, isCartOpen])

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart debe usarse dentro de un CartProvider')
  return context
}
