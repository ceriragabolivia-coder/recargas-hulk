import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos de escritura sin RLS
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
    if (item.productos?.proveedor_api_id && !item.proveedor_pedido_id && !item.estado_proveedor) {
      anySent = true;
      try {
        console.log(`🚀 [Webhook] Enviando item ${item.id} a TiendaGiftVen...`);
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
            .select('pedido_items(*, productos(proveedor_api_id, juego_id, juegos(procesamiento_automatico_api)))')
            .eq('id', pedido.id)
            .single();

          const tieneApiItems = pedidoConItems?.pedido_items?.some(
            i => i.productos?.proveedor_api_id
          );
          const juegoAutoProcess = pedidoConItems?.pedido_items?.some(
            i => i.productos?.juegos?.procesamiento_automatico_api === true
          );

          if (tieneApiItems && juegoAutoProcess) {
            // --- AUTO-PROCESAMIENTO VÍA TIENDAGIFTVEN ---
            console.log(`⚡ Juego tiene procesamiento_automatico_api=true. Llamando API...`);

            // Obtener API key de configuración
            const { data: configRow } = await supabase
              .from('configuracion')
              .select('valor, valor_texto')
              .eq('clave', 'tiendagiftven_api_key')
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
              const { anySent, allCompleted } = await procesarPedidoConApi(pedido.id, apiKey);

              if (anySent && allCompleted) {
                // Marcar pedido como completado
                await supabase.rpc('webhook_update_pedido', {
                  p_pedido_id: pedido.id,
                  p_estado: 'completado',
                  p_venta_registrada: true,
                  p_fecha_respuesta: new Date().toISOString()
                });
                auto_despachado = true;
                console.log(`🎉 Pedido #${pedido.id} completado automáticamente vía API TiendaGiftVen`);
              } else if (anySent) {
                console.log(`⏳ Pedido #${pedido.id} en procesamiento. Algunos items no completados aún.`);
                auto_despachado = true;
              } else {
                console.warn(`⚠️ Pedido #${pedido.id}: no se pudo enviar a la API.`);
              }
            } else {
              console.warn(`⚠️ No hay tiendagiftven_api_key en configuración. Pago verificado pero no procesado vía API.`);
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
        status: auto_despachado ? 'usado' : 'disponible',
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
