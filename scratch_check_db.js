const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  console.log("🔍 Checking Order #000450...");
  
  // 1. Get the order details
  const { data: orders, error: orderError } = await supabase
    .from('pedidos')
    .select('*, pedido_items(*, productos(*))')
    .eq('numero_pedido', 450);

  if (orderError) {
    console.error("❌ Error fetching order:", orderError);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log("❌ Order #000450 not found in database.");
    return;
  }

  const order = orders[0];
  console.log("\n📦 ORDER DETAILS:");
  console.log(`ID: ${order.id}`);
  console.log(`Numero Pedido: ${order.numero_pedido}`);
  console.log(`Estado: ${order.estado}`);
  console.log(`Pago Verificado: ${order.pago_verificado}`);
  console.log(`Venta Registrada: ${order.venta_registrada}`);
  console.log(`Atendido Por ID: ${order.atendido_por_id}`);
  console.log(`Referencia Pago: ${order.referencia_pago}`);
  console.log(`Total Bs: ${order.total_bs}`);
  console.log(`Total USD: ${order.total_usd}`);

  console.log("\n🛍️ ORDER ITEMS:");
  for (const item of order.pedido_items) {
    console.log(`- Item ID: ${item.id}`);
    console.log(`  Producto ID: ${item.producto_id}`);
    console.log(`  Producto Nombre: ${item.productos?.nombre}`);
    console.log(`  Entrega Automatica: ${item.productos?.entrega_automatica}`);
    console.log(`  Codigo Entregado: ${item.codigo_entregado}`);
    
    // Check available codes in the vault for this product
    const { count, error: countError } = await supabase
      .from('producto_codigos')
      .select('*', { count: 'exact', head: true })
      .eq('producto_id', item.producto_id)
      .eq('usado', false);
      
    if (countError) {
      console.error(`  ❌ Error counting vault codes for product ${item.producto_id}:`, countError);
    } else {
      console.log(`  📦 Unused codes in Vault for this product: ${count}`);
    }

    // List some codes in vault to see if they are set up
    const { data: codes } = await supabase
      .from('producto_codigos')
      .select('*')
      .eq('producto_id', item.producto_id);
    console.log(`  📊 Total codes in DB for this product: ${codes?.length || 0}`);
    if (codes && codes.length > 0) {
      console.log(`  📋 Sample codes:`, codes.map(c => ({ id: c.id, usado: c.usado, pedido_id: c.pedido_id })));
    }
  }

  // 2. Check if there is any sales row for this order
  const { data: sales, error: salesError } = await supabase
    .from('ventas')
    .select('*')
    .eq('pedido_id', order.id);

  if (salesError) {
    console.error("\n❌ Error fetching sales:", salesError);
  } else {
    console.log(`\n💵 REGISTERED SALES FOR THIS ORDER: ${sales.length}`);
    for (const sale of sales) {
      console.log(`- Sale ID: ${sale.id}, Vendedor ID: ${sale.vendedor_id}, USD: ${sale.precio_venta_usd}, Bs: ${sale.precio_venta_bs}`);
    }
  }
}

checkDb();
