import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER: Procesar pedido con TiendaGiftVen API ---
async function procesarPedidoConApi(pedidoId, apiKey) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api)))')
    .eq('id', pedidoId)
    .single();

  if (!pedidoActual?.pedido_items) return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    const j = Array.isArray(prod?.juegos) ? prod.juegos[0] : prod?.juegos;
    const isPendingOrFailed = !item.estado_proveedor || item.estado_proveedor === 'error' || item.estado_proveedor === 'fallido';
    if (prod?.proveedor_api_id && j?.procesamiento_automatico_api && !item.proveedor_pedido_id && isPendingOrFailed) {
      anySent = true;
      try {
        console.log(`🚀 [AutoProcess] Enviando item ${item.id} a TiendaGiftVen...`);
        const payload = {
          producto_id: parseInt(prod.proveedor_api_id, 10),
          merchant_ref: `HULK-ITEM-${item.id}-${Date.now()}`
        };

        if (item.player_id) {
          payload.id_juego = String(item.player_id).trim();
          if (item.zone_id) payload.input2 = String(item.zone_id).trim();
        } else {
          payload.cantidad = item.cantidad || 1;
        }

        const res = await fetch(`https://tiendagiftven.tech/api/v1/comprar`, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
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

// --- HELPER: Aplicar Cashback ---
async function applyCashback(pedido, supabaseClient, adminId) {
  if (pedido.cashback_aplicado) return;

  const { data: configData } = await supabaseClient.from('configuracion').select('*').in('clave', ['cashback_activo', 'cashback_porcentaje']);
  const config = {};
  if (configData) {
      configData.forEach(c => { config[c.clave] = c.valor_texto !== null ? c.valor_texto : String(c.valor); });
  }

  if (config.cashback_activo !== 'true' && config.cashback_activo !== '1') return;
  const porcentaje = Number(config.cashback_porcentaje) || 0;
  if (porcentaje <= 0) return;

  const { data: pedidoItems } = await supabaseClient.from('pedido_items').select('*, productos(juego_id, juegos(cashback_activo))').eq('pedido_id', pedido.id);
  let gameAllowsCashback = true;
  if (pedidoItems && pedidoItems.length > 0) {
      const prod = Array.isArray(pedidoItems[0].productos) ? pedidoItems[0].productos[0] : pedidoItems[0].productos;
      if (prod?.juegos?.cashback_activo === false) gameAllowsCashback = false;
  }

  if (!gameAllowsCashback) return;

  const ref = (pedido.referencia_pago || '').toLowerCase();
  let isBs = ref.includes('billetera bs') || ref.includes('pago móvil') || ref.includes('pago movil') || ref.includes('bolívares') || ref.includes('bs');
  
  if (!isBs && pedido.metodo_pago_id) {
     const { data: mData } = await supabaseClient.from('metodos_pago').select('nombre, habilitado_billetera_bs').eq('id', pedido.metodo_pago_id).maybeSingle();
     if (mData && (
         mData.habilitado_billetera_bs || 
         mData.nombre.toLowerCase().includes('pago') || 
         mData.nombre.toLowerCase().includes('bs') || 
         mData.nombre.toLowerCase().includes('bolívares')
     )) {
         isBs = true;
     }
  }

  const { data: walletData } = await supabaseClient.from('billeteras').select('*').eq('auth_user_id', pedido.cliente_id).maybeSingle();
  const baseUsd = walletData?.saldo || 0;
  const baseBs = walletData?.saldo_bs || 0;

  const updateData = {
      cashback_aplicado: true,
      cashback_porcentaje: porcentaje
  };

  if (isBs) {
     const returnBs = Number(pedido.total_bs) * (porcentaje / 100);
     if (returnBs > 0) {
       await supabaseClient.rpc('ajustar_saldo_billetera_bs_rpc', {
         p_user_id: pedido.cliente_id,
         p_admin_id: adminId || pedido.cliente_id,
         p_nuevo_saldo: baseBs + returnBs,
         p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`
       });
       updateData.cashback_monto = returnBs;
       updateData.cashback_moneda = 'bs';
     }
  } else {
     const returnUsd = Number(pedido.total_usd) * (porcentaje / 100);
     if (returnUsd > 0) {
       await supabaseClient.rpc('ajustar_saldo_billetera_rpc', {
         p_user_id: pedido.cliente_id,
         p_admin_id: adminId || pedido.cliente_id,
         p_nuevo_saldo: baseUsd + returnUsd,
         p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`
       });
       updateData.cashback_monto = returnUsd;
       updateData.cashback_moneda = 'usd';
     }
  }

  await supabaseClient.from('pedidos').update(updateData).eq('id', pedido.id);
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
      .select('*')
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
      .select('*, pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api)))')
      .eq('id', pedido.id)
      .single();

    const tieneApiItems = pedidoConItems?.pedido_items?.some(
      i => {
        const p = Array.isArray(i.productos) ? i.productos[0] : i.productos;
        const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
        return p?.proveedor_api_id && j?.procesamiento_automatico_api;
      }
    );
    
    if (tieneApiItems) {
      console.log(`⚡ Procesando API para pedido ${pedido.id} (Force: ${force})...`);

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
          // Fallback: Assign to SuperAdmin if automatically processed
          let vendedorClientUuid = null;
          const { data: superAdmin } = await supabase
            .from('clientes')
            .select('id')
            .eq('usuario', 'recargashulk@gmail.com')
            .single();
            
          if (superAdmin) {
            vendedorClientUuid = superAdmin.id;
          }

          // Registrar la venta para cada item
          for (const item of pedidoConItems.pedido_items) {
             const { error: rpcErr } = await supabase.rpc('registrar_venta_rpc', {
                p_producto_id: item.producto_id,
                p_cantidad: item.cantidad,
                p_notas: `Pedido #${pedidoConItems.numero_pedido} (API Sync)`,
                p_cliente_id: pedidoConItems.cliente_id,
                p_vendedor_id: vendedorClientUuid,
                p_metodo_pago_id: pedidoConItems.metodo_pago_id,
                p_referencia_pago: pedidoConItems.referencia_pago,
                p_player_id: item.player_id,
                p_account_email: item.account_email,
                p_account_password: item.account_password,
                p_pedido_id: pedido.id,
                p_owner_id: pedidoConItems.owner_id
             });
             
             if (rpcErr) {
               console.error(`❌ Error registrando venta API Sync para item ${item.id}:`, rpcErr);
             }
          }

          await supabase.rpc('webhook_update_pedido', {
            p_pedido_id: pedido.id,
            p_estado: 'completado',
            p_venta_registrada: true,
            p_fecha_respuesta: new Date().toISOString()
          });
          
          // Aplicar cashback si corresponde
          await applyCashback(pedido, supabase, vendedorClientUuid);

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
