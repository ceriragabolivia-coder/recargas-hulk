import { supabase } from '../lib/supabase';

/**
 * Procesa automáticamente un pedido con la API de TiendaGiftVen
 * @param {string} pedidoId - El ID del pedido
 * @param {string} apiKey - La API Key de TiendaGiftVen
 * @param {boolean} forceTrigger - Si es true, ignora el check de auto-procesamiento del juego
 * @returns {boolean} - True si se envió al menos un item a la API
 */
export const processTiendaGiftVenOrder = async (pedidoId, apiKey, forceTrigger = false) => {
  if (!apiKey) {
    const { data } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'tiendagiftven_api_key').single();
    if (data) apiKey = data.valor_texto;
  }
  
  if (!apiKey) {
    console.warn(`⚠️ No hay API key de TiendaGiftVen configurada.`);
    return false;
  }

  console.log(`🚀 Iniciando proceso TiendaGiftVen para pedido #${pedidoId}...`);
  let anySent = false;
  
  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api)))')
    .eq('id', pedidoId)
    .single();
    
  if (!pedidoActual || !pedidoActual.pedido_items) return false;

  for (const item of pedidoActual.pedido_items) {
    const autoApiHabilitado = item.productos?.juegos?.procesamiento_automatico_api;
    
    // Check if product has API provider configured and is not already processed/processing
    if (item.productos?.proveedor_api_id && !item.proveedor_pedido_id && !item.estado_proveedor) {
      if (!forceTrigger && !autoApiHabilitado) {
        console.log(`El producto ${item.productos?.nombre} no tiene auto-procesar habilitado.`);
        continue;
      }
      
      anySent = true;
      try {
        console.log(`🚀 Enviando a API TiendaGiftVen item ${item.id}...`)
        const payload = {
          producto_id: parseInt(item.productos.proveedor_api_id, 10),
          merchant_ref: `HULK-ITEM-${item.id}`
        };
        
        if (item.player_id) {
          payload.id_juego = item.player_id;
          if (item.zone_id) payload.input2 = item.zone_id;
        } else {
          payload.cantidad = item.cantidad || 1;
        }

        const res = await fetch('/api/tiendagiftven/proxy?endpoint=comprar', {
          method: 'POST',
          headers: { 
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(()=>({}));
          throw new Error(errData.error || 'Error HTTP ' + res.status);
        }
        const data = await res.json();
        
        if (data.ok) {
          const isCompleted = data.estado === 'completado';
          await supabase.from('pedido_items').update({
            estado_proveedor: data.estado || 'procesando',
            proveedor_pedido_id: data.pedido_id,
            mensaje_proveedor: data.codigos ? data.codigos.join('\n') : (data.mensaje || ''),
            estado: isCompleted ? 'completado' : 'procesando'
          }).eq('id', item.id);
        } else {
          throw new Error(data.error || 'Error respuesta proveedor');
        }
      } catch (error) {
        console.error(`❌ Error enviando a API TiendaGiftVen (Item ${item.id}):`, error);
        await supabase.from('pedido_items').update({
          estado_proveedor: 'error',
          mensaje_proveedor: error.message || 'Error de conexión'
        }).eq('id', item.id);
      }
    }
  }

  // Si enviamos algo, revisamos si se completó inmediatamente
  if (anySent) {
    const { data: updatedItems } = await supabase
      .from('pedido_items')
      .select('estado')
      .eq('pedido_id', pedidoId);

    if (updatedItems && updatedItems.length > 0) {
      const allCompleted = updatedItems.every(i => i.estado === 'completado');
      if (allCompleted) {
        console.log(`🎉 Todos los items completados inmediatamente por el proveedor. Completando pedido #${pedidoId}...`);
        
        // Obtenemos los datos del pedido para calcular cashback si es necesario
        const { data: pedData } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
        let updateData = { estado: 'completado' };
        
        if (pedData && !pedData.cashback_aplicado) {
           const { data: confData } = await supabase.from('configuracion').select('*').in('clave', ['cashback_porcentaje', 'cashback_activo']);
           const confMap = {};
           if (confData) confData.forEach(c => confMap[c.clave] = c.valor_texto || c.valor);
           
           const isActive = confMap['cashback_activo'] === 'true' || confMap['cashback_activo'] === true;
           const p = parseFloat(confMap['cashback_porcentaje']);
           if (isActive && !isNaN(p) && p > 0) {
             const amount = (parseFloat(pedData.total_usd) * p) / 100;
             try {
               await supabase.rpc('incrementar_saldo_usd', {
                 user_id: pedData.cliente_id,
                 monto: amount,
                 p_descripcion: `Cashback de ${p}% por pedido #${pedData.numero_pedido || pedidoId}`
               });
               updateData.cashback_aplicado = true;
               updateData.cashback_porcentaje = p;
             } catch (e) {
               console.error("Error aplicando cashback auto:", e);
             }
           }
        }
        await supabase.from('pedidos').update(updateData).eq('id', pedidoId);
      }
    }
  }
  
  return anySent;
};
