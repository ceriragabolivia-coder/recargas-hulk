import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos de escritura sin RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
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
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    if (prod?.proveedor_api_id && !item.proveedor_pedido_id && !item.estado_proveedor) {
      anySent = true;
      try {
        console.log(`🚀 [Webhook] Enviando item ${item.id} a TiendaGiftVen...`);
        const payload = {
          producto_id: parseInt(prod.proveedor_api_id, 10),
          merchant_ref: `HULK-ITEM-${item.id}`
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
            p_mensaje_proveedor: Array.isArray(data.codigos) && data.codigos.length > 0 ? data.codigos.join('\n') : (data.codigos && typeof data.codigos === 'string' ? data.codigos : (data.mensaje || '')),
            p_estado: isCompleted ? 'completado' : 'procesando'
          });
        } else {
          throw new Error(data.error || 'Error respuesta proveedor');
        }
      } catch (e) {
        console.error(`❌ [Webhook] Error en item ${item.id} con TiendaGiftVen:`, e.message);
        allCompleted = false;
        await supabase.rpc('webhook_update_pedido_item', {
          p_item_id: item.id,
          p_estado_proveedor: 'error',
          p_mensaje_proveedor: e.message
        });
      }
    } else {
      // Si el item no va por API o ya estaba procesado, verificamos su estado final
      if (item.estado !== 'completado') {
        allCompleted = false;
      }
    }
  }

  return { anySent, allCompleted };
}

// --- HELPER: Procesar pedido con FazerCards API ---
async function procesarPedidoConFazerCards(pedidoId, apiKey) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api, api_provider, api_provider_category_id)))')
    .eq('id', pedidoId)
    .single();

  if (!pedidoActual?.pedido_items) return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    const j = Array.isArray(prod?.juegos) ? prod.juegos[0] : prod?.juegos;
    const isPendingOrFailed = !item.estado_proveedor || item.estado_proveedor === 'error' || item.estado_proveedor === 'fallido';
    const isFazerCards = (j?.api_provider === 'fazercards');
    
    if (prod?.proveedor_api_id && j?.procesamiento_automatico_api && isFazerCards && !item.proveedor_pedido_id && isPendingOrFailed) {
      anySent = true;
      try {
        console.log(`🚀 [Webhook] Enviando item ${item.id} a FazerCards...`);
        // En GestionProductos, el category_id está en juegos y el offer_id en productos
        const category_id = j.api_provider_category_id || '';
        const offer_id = prod.proveedor_api_id || '';

        // Consultar los campos requeridos por FazerCards para esta categoría
        let reqFields;
        let expectedFieldKeys = [];
        let endpointUrl = `https://api.fzr.cards/api/v2/topups/order`;
        let payload = {};

        if (category_id === 'telegram_stars' || category_id === 'telegram_premium') {
            if (category_id === 'telegram_stars') {
                endpointUrl = `https://api.fzr.cards/api/v2/telegram/stars/buy`;
                payload = {
                    telegram_username: item.player_id || item.account_user,
                    quantity: parseInt(offer_id)
                };
            } else if (category_id === 'telegram_premium') {
                endpointUrl = `https://api.fzr.cards/api/v2/telegram/premium/buy`;
                payload = {
                    telegram_username: item.player_id || item.account_user,
                    months: parseInt(offer_id)
                };
            }
        } else {
            reqFields = await fetch(`https://api.fzr.cards/api/v2/topups/offers?category_id=${category_id}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            }).then(r => r.json());

            expectedFieldKeys = reqFields.ok && reqFields.fields ? reqFields.fields.map(f => f.key) : [];

            payload = {
              category_id,
              offer_id,
              fields: {}
            };

            if (item.player_id) {
              const pId = String(item.player_id).trim();
              if (expectedFieldKeys.includes('user_id')) payload.fields.user_id = pId;
              if (expectedFieldKeys.includes('player_id')) payload.fields.player_id = pId;
              if (expectedFieldKeys.includes('account')) payload.fields.account = pId;
              if (expectedFieldKeys.includes('uid')) payload.fields.uid = pId;
              
              if (item.zone_id) {
                const zId = String(item.zone_id).trim();
                if (expectedFieldKeys.includes('server_id')) payload.fields.server_id = zId;
                if (expectedFieldKeys.includes('zone_id')) payload.fields.zone_id = zId;
                if (expectedFieldKeys.includes('server')) payload.fields.server = zId;
              }
            }
        }

        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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
        if (data.ok && data.order) {
          const respEstado = data.order.status ? data.order.status.toLowerCase() : '';
          const isCompleted = respEstado === 'completed';
          if (!isCompleted) allCompleted = false;
          await supabase.rpc('webhook_update_pedido_item', {
            p_item_id: item.id,
            p_estado_proveedor: data.order.status || 'processing',
            p_proveedor_pedido_id: data.order.id,
            p_mensaje_proveedor: data.order.pin || '',
            p_estado: isCompleted ? 'completado' : 'procesando'
          });
        } else {
          throw new Error(data.error || 'Error en respuesta de FazerCards');
        }
      } catch (e) {
        console.error(`❌ [Webhook] Error en item ${item.id} con FazerCards:`, e.message);
        allCompleted = false;
        await supabase.rpc('webhook_update_pedido_item', {
          p_item_id: item.id,
          p_estado_proveedor: 'error',
          p_mensaje_proveedor: e.message
        });
      }
    } else if (isFazerCards) {
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
    const secret = req.headers.authorization;
    if (secret !== 'Bearer BdvSecret_Hulk_2026!') {
      console.warn('Intento de acceso no autorizado al webhook APK:', secret);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body;
    console.log('📦 Webhook Pagos APK Recibido:', payload);

    const { referencia, monto, banco_origen, banco_destino, telefono, fecha } = payload;

    if (!referencia || !monto) {
      return res.status(400).json({ error: 'Faltan campos requeridos (referencia o monto)' });
    }

    // =========================================================
    // 0. VERIFICAR SI EL MÓDULO APK ESTÁ HABILITADO
    // =========================================================
    const { data: apkConfig } = await supabase
      .from('configuracion')
      .select('valor_texto, valor')
      .eq('clave', 'pagos_apk_enabled')
      .is('owner_id', null)
      .single();
    
    const isApkEnabled = apkConfig ? (apkConfig.valor_texto === 'true' || apkConfig.valor === true) : true;

    if (!isApkEnabled) {
      console.log('🚫 Recepción de Pagos APK deshabilitada. Referencia ignorada:', referencia);
      return res.status(200).json({ 
        success: true, 
        message: 'Módulo APK deshabilitado temporalmente', 
        ignorado: true 
      });
    }

    let pedido_id = null;
    let usuario_id = null;
    let auto_despachado = false;

    // =========================================================
    // 1. Buscar PEDIDO con esta referencia
    // =========================================================
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, cliente_id, estado, total_bs, pago_verificado')
      .eq('referencia_pago', referencia.toString().trim())
      .single();

    if (pedido && !pedidoError) {
      pedido_id = pedido.id;
      usuario_id = pedido.cliente_id;

      if (pedido.estado === 'pendiente') {
        const montoRecibido = parseFloat(monto);
        const montoEsperado = parseFloat(pedido.total_bs);

        if (Math.abs(montoRecibido - montoEsperado) <= 0.05 || pedido.pago_verificado) {
          // --- SIEMPRE: Marcar el pago como verificado si no lo estaba ---
          if (!pedido.pago_verificado) {
            await supabase.rpc('webhook_update_pedido', {
              p_pedido_id: pedido.id,
              p_estado: null,
              p_pago_verificado: true
            });
          }

          console.log(`✅ Pago verificado automáticamente para pedido #${pedido.id}`);

          // --- Obtener items del pedido + juego para checar auto-procesamiento ---
          const { data: pedidoConItems } = await supabase
            .from('pedidos')
            .select('pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api, api_provider)))')
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
            // Identificar el proveedor del primer item para obtener la key adecuada
            let providerName = 'tiendagiftven';
            const firstApiItem = pedidoConItems.pedido_items.find(i => {
              const p = Array.isArray(i.productos) ? i.productos[0] : i.productos;
              const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
              return p?.proveedor_api_id && j?.procesamiento_automatico_api;
            });
            if (firstApiItem) {
              const p = Array.isArray(firstApiItem.productos) ? firstApiItem.productos[0] : firstApiItem.productos;
              const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
              providerName = j?.api_provider || 'tiendagiftven';
            }

            console.log(`⚡ Pedido tiene items con proveedor_api_id. Proveedor: ${providerName}. Llamando API automáticamente...`);

            // Obtener API key de configuración
            const configKey = providerName === 'fazercards' ? 'fazercards_api_key' : 'tiendagiftven_api_key';
            const { data: configRow } = await supabase
              .from('configuracion')
              .select('valor, valor_texto')
              .eq('clave', configKey)
              .single();

            const apiKey = configRow?.valor_texto || configRow?.valor;

            if (apiKey) {
              // Marcar como procesando
              await supabase.rpc('webhook_update_pedido', {
                p_pedido_id: pedido.id,
                p_estado: 'procesando'
              });

              console.log(`🔑 Obteniendo items del pedido para procesar con API...`);
              // Ejecutar procesamiento
              let anySent = false;
              let allCompleted = false;

              if (providerName === 'fazercards') {
                const resProvider = await procesarPedidoConFazerCards(pedido.id, apiKey);
                anySent = resProvider.anySent;
                allCompleted = resProvider.allCompleted;
              } else {
                const resProvider = await procesarPedidoConApi(pedido.id, apiKey);
                anySent = resProvider.anySent;
                allCompleted = resProvider.allCompleted;
              }

              if (anySent && allCompleted) {
                // Marcar pedido como completado
                await supabase.rpc('webhook_update_pedido', {
                  p_pedido_id: pedido.id,
                  p_estado: 'completado',
                  p_venta_registrada: true,
                  p_fecha_respuesta: new Date().toISOString()
                });
                auto_despachado = true;
                console.log(`🎉 Pedido #${pedido.id} completado automáticamente vía API ${providerName}`);
              } else if (anySent) {
                console.log(`⏳ Pedido #${pedido.id} en procesamiento. Algunos items no completados aún.`);
                auto_despachado = true;
              } else {
                console.warn(`⚠️ Pedido #${pedido.id}: no se pudo enviar a la API.`);
              }
            } else {
              console.warn(`⚠️ No hay ${configKey} en configuración. Pago verificado pero no procesado vía API.`);
            }
          } else {
            // Sin auto-procesamiento API: solo queda con pago_verificado=true para proceso manual
            console.log(`📋 Pedido #${pedido.id}: pago verificado. Admin procesará manualmente.`);
          }
        } else {
          console.warn(`⚠️ Pedido #${pedido.id} monto no coincide. Esperado: ${montoEsperado}, Recibido: ${montoRecibido}`);
        }
      }
    }

    // =========================================================
    // 2. Si no es pedido, buscar RECARGA DE BILLETERA
    // =========================================================
    if (!pedido_id) {
      const { data: recarga, error: recargaError } = await supabase
        .from('billetera_recargas')
        .select('id, auth_user_id, estado, monto')
        .eq('referencia_pago', referencia.toString().trim())
        .single();

      if (recarga && !recargaError) {
        usuario_id = recarga.auth_user_id;

        if (recarga.estado === 'pendiente') {
          const montoRecibido = parseFloat(monto);
          const montoEsperado = parseFloat(recarga.monto);

          if (Math.abs(montoRecibido - montoEsperado) <= 0.05) {
            const { data: processData, error: processError } = await supabase.rpc('procesar_recarga_automatica_rpc', {
              p_recarga_id: recarga.id
            });
            if (!processError && processData?.success) {
              auto_despachado = true;
              console.log(`⚡ Recarga ${recarga.id} auto-aprobada vía Webhook APK`);
            } else {
              console.error(`❌ Error en auto-aprobación de recarga ${recarga.id}:`, processError || processData);
            }
          } else {
            console.warn(`⚠️ Recarga ${recarga.id} monto no coincide. Esperado: ${montoEsperado}, Recibido: ${montoRecibido}`);
          }
        }
      }
    }

    // =========================================================
    // 3. Registrar el pago en pagos_apk
    // =========================================================
    const { data, error } = await supabase
      .from('pagos_apk')
      .insert({
        referencia: referencia.toString().trim(),
        monto: parseFloat(monto),
        banco_origen: banco_origen || null,
        banco_destino: banco_destino || null,
        telefono: telefono || null,
        fecha_pago: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
        pedido_id: pedido_id,
        usuario_id: usuario_id,
        status: (pedido_id || usuario_id || auto_despachado) ? 'usado' : 'disponible',
        raw_data: payload
      })
      .select()
      .single();

    if (error) {
      console.error('Error insertando pago APK:', error);
      if (error.code === '23505') {
        return res.status(200).json({ message: 'Pago ya registrado anteriormente', data: null });
      }
      return res.status(500).json({ error: 'Error guardando el pago en la base de datos' });
    }

    return res.status(200).json({
      success: true,
      message: 'Pago registrado exitosamente',
      relacionado_con_pedido: pedido_id !== null,
      auto_despachado,
      data
    });

  } catch (error) {
    console.error('Error en webhook de pagos APK:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
