import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER: Procesar pedido con TiendaGiftVen API ---
async function procesarPedidoConApi(pedidoId, apiKey) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('id', pedidoId)
    .single();

  if (!pedidoActual?.pedido_items) return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const isPendingOrFailed = !item.estado_proveedor || item.estado_proveedor === 'error' || item.estado_proveedor === 'fallido';
    if (item.productos?.proveedor_api_id && !item.proveedor_pedido_id && isPendingOrFailed) {
      anySent = true;
      try {
        console.log(`🚀 [AutoProcess] Enviando item ${item.id} a TiendaGiftVen...`);
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

        const res = await fetch(`https://tiendagiftven.tech/api/v1/comprar`, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const text = await res.text();
          let errData = {};
          try { errData = JSON.parse(text); } catch(e) {}
          throw new Error(errData.error || errData.message || 'Error HTTP ' + res.status);
        }

        const data = await res.json();

        if (data.ok) {
          const isCompleted = data.estado === 'completado';
          if (!isCompleted) allCompleted = false;
          await supabase.rpc('webhook_update_pedido_item', {
            p_item_id: item.id,
            p_estado_proveedor: data.estado || 'procesando',
            p_proveedor_pedido_id: data.pedido_id,
            p_mensaje_proveedor: data.codigos ? data.codigos.join('\n') : (data.mensaje || ''),
            p_estado: isCompleted ? 'completado' : 'procesando'
          });
        } else {
          throw new Error(data.error || 'Error respuesta proveedor');
        }
      } catch (e) {
        console.error(`❌ [AutoProcess] Error en item ${item.id} con TiendaGiftVen:`, e.message);
        allCompleted = false;
        await supabase.rpc('webhook_update_pedido_item', {
          p_item_id: item.id,
          p_estado_proveedor: 'error',
          p_mensaje_proveedor: e.message
        });
      }
    } else {
      if (item.estado !== 'completado') {
        allCompleted = false;
      }
    }
  }

  return { anySent, allCompleted };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { pedido_id, force } = req.body;
    if (!pedido_id) {
      return res.status(400).json({ error: 'Falta pedido_id' });
    }

    console.log(`📦 Auto-procesando pedido: ${pedido_id}`);

    // Verificar que el pedido existe y está verificado
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, estado, pago_verificado')
      .eq('id', pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (!pedido.pago_verificado) {
      return res.status(400).json({ error: 'El pedido no tiene el pago verificado' });
    }

    if (pedido.estado === 'completado') {
      return res.status(200).json({ success: true, message: 'El pedido ya está completado' });
    }

    // --- Obtener items del pedido para checar auto-procesamiento ---
    const { data: pedidoConItems } = await supabase
      .from('pedidos')
      .select('pedido_items(*, productos(proveedor_api_id, juego_id))')
      .eq('id', pedido.id)
      .single();

    const tieneApiItems = pedidoConItems?.pedido_items?.some(
      i => i.productos?.proveedor_api_id
    );
    
    let juegoAutoProcess = false;
    if (tieneApiItems) {
      const juegoIds = pedidoConItems.pedido_items.map(i => i.productos?.juego_id).filter(Boolean);
      if (juegoIds.length > 0) {
        const { data: juegos } = await supabase
          .from('juegos')
          .select('procesamiento_automatico_api')
          .in('id', juegoIds)
          .eq('procesamiento_automatico_api', true);
          
        if (juegos && juegos.length > 0) {
          juegoAutoProcess = true;
        }
      }
    }

    if (tieneApiItems && (juegoAutoProcess || force)) {
      console.log(`⚡ Procesando API para pedido ${pedido.id} (Auto: ${juegoAutoProcess}, Force: ${force})...`);

      // Obtener API key
      const { data: configRow } = await supabase
        .from('configuracion')
        .select('valor, valor_texto')
        .eq('clave', 'tiendagiftven_api_key')
        .single();

      const apiKey = configRow?.valor_texto || configRow?.valor;

      if (apiKey) {
        await supabase.rpc('webhook_update_pedido', {
          p_pedido_id: pedido.id,
          p_estado: 'procesando'
        });

        const { anySent, allCompleted } = await procesarPedidoConApi(pedido.id, apiKey);

        if (anySent && allCompleted) {
          await supabase.rpc('webhook_update_pedido', {
            p_pedido_id: pedido.id,
            p_estado: 'completado',
            p_venta_registrada: true,
            p_fecha_respuesta: new Date().toISOString()
          });
          console.log(`🎉 Pedido #${pedido.id} completado automáticamente vía API TiendaGiftVen`);
          return res.status(200).json({ success: true, message: 'Pedido completado con API' });
        } else if (anySent) {
          console.log(`⏳ Pedido #${pedido.id} en procesamiento.`);
          return res.status(200).json({ success: true, message: 'Pedido procesando con API' });
        } else {
          return res.status(400).json({ error: 'No se enviaron items a la API' });
        }
      } else {
        return res.status(500).json({ error: 'No hay tiendagiftven_api_key configurada' });
      }
    } else {
      return res.status(200).json({ success: true, message: 'El pedido no requiere procesamiento por API o no tiene auto-proceso activo' });
    }
  } catch (error) {
    console.error('Error en auto_process:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
