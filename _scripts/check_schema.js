import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function check() {
  const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const schema = await res.json();
  
  const pedidos = schema.definitions.pedidos.properties;
  console.log('pedidos.id:', pedidos.id.type, pedidos.id.format);
  
  const ventas = schema.definitions.ventas.properties;
  console.log('ventas.pedido_id:', ventas.pedido_id.type, ventas.pedido_id.format);
  
  const admin_saldos_historial = schema.definitions.admin_saldos_historial.properties;
  console.log('admin_saldos_historial.pedido_id:', admin_saldos_historial.pedido_id.type, admin_saldos_historial.pedido_id.format);
}
check();
