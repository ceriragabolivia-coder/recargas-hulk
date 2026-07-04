import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log('📦 Webhook TiendaGiftVen Recibido:', payload);

    const { merchant_ref, estado, pedido_id, mensaje, codigos } = payload;

    if (!merchant_ref) {
      return res.status(400).json({ error: 'Missing merchant_ref' });
    }

    // Extraer el ID del item de pedido. Asumimos el formato 'HULK-ITEM-123' o similar
    const itemIdMatch = merchant_ref.match(/ITEM-(\d+)$/);
    if (!itemIdMatch) {
      return res.status(400).json({ error: 'Invalid merchant_ref format' });
    }

    const itemId = parseInt(itemIdMatch[1], 10);

    // Preparar los datos a actualizar para el item
    const updateData = {
      estado_proveedor: estado,
      proveedor_pedido_id: pedido_id
    };

    if (estado === 'completado') {
      updateData.estado = 'completado'; // Completa el item internamente
    } else if (estado === 'error' || estado === 'fallido' || estado === 'cancelado') {
      updateData.estado = 'fallido';
    }

    if (codigos && codigos.length > 0) {
      updateData.mensaje_proveedor = codigos.join('\n');
    } else if (mensaje) {
      updateData.mensaje_proveedor = mensaje;
    }

    // 1. Actualizar el item en la base de datos
    const { error: itemUpdateError } = await supabase
      .from('pedido_items')
      .update(updateData)
      .eq('id', itemId);

    if (itemUpdateError) {
      console.error('❌ Error actualizando pedido_item:', itemUpdateError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    console.log(`✅ Item ${itemId} actualizado a estado: ${estado}`);

    // 2. Si el item se completó, verificar si todo el pedido está completo para cerrar y registrar ventas
    if (estado === 'completado') {
      const { data: currentItem, error: fetchItemError } = await supabase
        .from('pedido_items')
        .select('pedido_id')
        .eq('id', itemId)
        .single();

      if (!fetchItemError && currentItem?.pedido_id) {
        const pedidoId = currentItem.pedido_id;

        // Obtener todos los items del mismo pedido
        const { data: allItems } = await supabase
          .from('pedido_items')
          .select('*')
          .eq('pedido_id', pedidoId);

        if (allItems && allItems.length > 0) {
          const allCompleted = allItems.every(i => i.estado === 'completado');

          if (allCompleted) {
            // Obtener datos del pedido
            const { data: order } = await supabase
              .from('pedidos')
              .select('*')
              .eq('id', pedidoId)
              .single();

            if (order && order.estado !== 'completado') {
              console.log(`🏁 Todos los items completados. Cerrando pedido #${order.numero_pedido}...`);

              // Resolver cliente_uuid del operador para el registro de ventas
              let vendedorClientUuid = null;
              if (order.atendido_por_id) {
                const { data: perf } = await supabase
                  .from('perfiles')
                  .select('cliente_uuid')
                  .eq('id', order.atendido_por_id)
                  .single();
                vendedorClientUuid = perf?.cliente_uuid;
              }

              // Registrar ventas por cada item si no se han registrado
              if (!order.venta_registrada) {
                for (const item of allItems) {
                  const { data: rpcRes, error: rpcErr } = await supabase.rpc('registrar_venta_rpc', {
                    p_producto_id: item.producto_id,
                    p_cantidad: item.cantidad,
                    p_notas: `Pedido #${order.numero_pedido} (API)`,
                    p_cliente_id: order.cliente_id,
                    p_vendedor_id: vendedorClientUuid,
                    p_metodo_pago_id: order.metodo_pago_id,
                    p_referencia_pago: order.referencia_pago,
                    p_player_id: item.player_id,
                    p_account_email: item.account_email,
                    p_account_password: item.account_password,
                    p_pedido_id: order.id,
                    p_owner_id: order.owner_id
                  });

                  if (rpcErr) {
                    console.error(`❌ Error registrando venta para item ${item.id}:`, rpcErr);
                  } else {
                    console.log(`✅ Venta registrada en webhook para item ${item.id}`);
                  }
                }
              }

              // Actualizar estado del pedido a completado y venta_registrada a true
              const { error: orderUpdateError } = await supabase
                .from('pedidos')
                .update({
                  estado: 'completado',
                  venta_registrada: true,
                  fecha_respuesta: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', pedidoId);

              if (orderUpdateError) {
                console.error(`❌ Error actualizando pedido #${order.numero_pedido} a completado:`, orderUpdateError);
              } else {
                console.log(`🎉 Pedido #${order.numero_pedido} completado exitosamente desde el webhook.`);
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ ok: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Error general en Webhook TiendaGiftVen:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
