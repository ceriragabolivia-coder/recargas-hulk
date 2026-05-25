import { supabase } from '../lib/supabase';

export async function processAutoDeliveryOrder(pedidoId) {
  try {
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*, pedido_items(*, productos(*))')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      console.error('Error fetching pedido for auto-delivery:', pedidoError);
      return false;
    }

    if (!pedido.pago_verificado || pedido.estado !== 'pendiente') {
      return false;
    }

    let allProcessed = true;
    let anySaleRegistered = false;

    // Get super admin profile for seller ID
    const { data: adminProfiles } = await supabase
      .from('clientes')
      .select('id, auth_user_id')
      .eq('usuario', 'ceriraga@gmail.com')
      .limit(1);
    
    let adminProfileId = null;
    let adminUserId = null;
    if (adminProfiles && adminProfiles.length > 0) {
      adminProfileId = adminProfiles[0].id;
      adminUserId = adminProfiles[0].auth_user_id;
    }

    for (const item of pedido.pedido_items) {
      if (item.productos?.entrega_automatica) {
        // Check if there is an available code
        const { data: codes, error: codeFetchError } = await supabase
          .from('producto_codigos')
          .select('id')
          .eq('producto_id', item.producto_id)
          .eq('usado', false)
          .order('created_at', { ascending: true })
          .limit(1);

        if (!codeFetchError && codes && codes.length > 0) {
          // 1. Register Sale
          const { error: rpcError } = await supabase.rpc('registrar_venta_rpc', {
            p_producto_id: item.producto_id,
            p_cantidad: item.cantidad,
            p_notas: `Auto-proceso Pedido #${pedido.numero_pedido}`,
            p_cliente_id: pedido.cliente_id,
            p_metodo_pago_id: pedido.metodo_pago_id,
            p_referencia_pago: pedido.referencia_pago,
            p_player_id: item.player_id,
            p_account_email: item.account_email,
            p_account_password: item.account_password,
            p_vendedor_id: adminProfileId,
            p_pedido_id: null,
            p_owner_id: pedido.owner_id
          });

          if (!rpcError) {
            // 2. Assign code
            const { data: codeData, error: assignError } = await supabase.rpc('asignar_codigo_pedido_item_rpc', {
              p_pedido_item_id: item.id
            });
            if (assignError || !codeData) {
              allProcessed = false;
            } else {
              anySaleRegistered = true;
            }
          } else {
            console.error('Error in auto registrar_venta_rpc:', rpcError);
            allProcessed = false;
          }
        } else {
          allProcessed = false;
        }
      } else {
        allProcessed = false;
      }
    }

    if (allProcessed && anySaleRegistered) {
      await supabase
        .from('pedidos')
        .update({
          estado: 'completado',
          venta_registrada: true,
          atendido_por_id: adminUserId,
          fecha_respuesta: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error in auto-delivery processing:', error);
    return false;
  }
}
