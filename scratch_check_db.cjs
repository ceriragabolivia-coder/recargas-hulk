const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSql(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { p_sql: sql });
  if (error) {
    console.error(`❌ Error executing: ${sql}`);
    console.error(error.message);
    return null;
  }
  return data;
}

async function checkDb() {
  console.log("🔍 Checking Order #000450 using exec_sql with p_sql...");
  
  // 1. Get the order details
  const orders = await runSql("SELECT * FROM public.pedidos WHERE numero_pedido = '000450'");
  if (!orders || orders.length === 0) {
    console.log("❌ Order #000450 not found in database.");
    return;
  }

  const order = orders[0];
  console.log("\n📦 ORDER DETAILS:");
  console.log(JSON.stringify(order, null, 2));

  // 2. Get order items
  const items = await runSql(`SELECT pi.*, p.nombre as producto_nombre, p.entrega_automatica FROM public.pedido_items pi JOIN public.productos p ON p.id = pi.producto_id WHERE pi.pedido_id = '${order.id}'`);
  console.log("\n🛍️ ORDER ITEMS:");
  console.log(JSON.stringify(items, null, 2));

  if (items && items.length > 0) {
    for (const item of items) {
      console.log(`\nChecking codes for product ${item.producto_id} (${item.producto_nombre}):`);
      // Get all codes in the vault for this product
      const codes = await runSql(`SELECT id, codigo, usado, pedido_id, usado_at FROM public.producto_codigos WHERE producto_id = ${item.producto_id}`);
      console.log(`📊 Total codes in DB for this product: ${codes?.length || 0}`);
      if (codes && codes.length > 0) {
        console.log(JSON.stringify(codes, null, 2));
      }
    }
  }

  // 3. Get registered sales for this order
  const sales = await runSql(`SELECT * FROM public.ventas WHERE pedido_id = '${order.id}'`);
  console.log(`\n💵 REGISTERED SALES FOR THIS ORDER:`);
  console.log(JSON.stringify(sales, null, 2));
}

checkDb();
