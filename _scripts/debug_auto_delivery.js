import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugOrder() {
  const numero_pedido = 500;
  
  const { data: pedidoList, error: pError } = await supabase.from('pedidos').select('id').eq('numero_pedido', numero_pedido);
  if (pError || !pedidoList.length) {
    console.error("No pedido found"); return;
  }
  const pedidoId = pedidoList[0].id;

  console.log("Debugging order ID:", pedidoId);

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('id', pedidoId)
    .single();

  console.log("Pago Verificado:", pedido.pago_verificado);
  console.log("Estado:", pedido.estado);

  let allProcessed = true;
  let anySaleRegistered = false;

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
  console.log("Admin Profile ID:", adminProfileId);

  for (const item of pedido.pedido_items) {
    console.log("Item producto_id:", item.producto_id);
    console.log("Entrega automatica:", item.productos?.entrega_automatica);
    if (item.productos?.entrega_automatica) {
      const { data: codes, error: codeFetchError } = await supabase
        .from('producto_codigos')
        .select('id')
        .eq('producto_id', item.producto_id)
        .eq('usado', false)
        .order('created_at', { ascending: true })
        .limit(1);
      
      console.log("Available codes found:", codes?.length);

      if (!codeFetchError && codes && codes.length > 0) {
        console.log("Registering sale...");
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
          p_pedido_id: pedido.id,
          p_owner_id: pedido.owner_id
        });

        if (!rpcError) {
          console.log("Assigning code...");
          const { data: codeData, error: assignError } = await supabase.rpc('asignar_codigo_pedido_item_rpc', {
            p_pedido_item_id: item.id
          });
          console.log("Assign Error:", assignError, "Code Data:", codeData);
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

  console.log("All Processed:", allProcessed, "Any sale registered:", anySaleRegistered);
}

debugOrder();
