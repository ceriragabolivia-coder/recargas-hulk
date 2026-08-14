// Verificar que webhook_update_pedido_item tiene el parámetro p_codigo_entregado
import https from 'https';

const SUPABASE_URL = 'https://api.recargashulk.com';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU0NjgyMTUsImV4cCI6MjEwMDgyNjc5OX0.Mewuja4QuB0hJpKLxF08NdPL575wcVFueQtMBuXjBn8';

const sql = `
  SELECT 
    proname AS nombre_funcion,
    pg_get_function_arguments(oid) AS argumentos
  FROM pg_proc
  WHERE proname = 'webhook_update_pedido_item'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
`;

const body = JSON.stringify({ query: sql });
const url = new URL(`${SUPABASE_URL}/pg/query`);

const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(row => {
          console.log(`\n✅ Función: ${row.nombre_funcion}`);
          console.log(`   Argumentos: ${row.argumentos}`);
          if (row.argumentos.includes('p_codigo_entregado')) {
            console.log('   🎉 ¡El parámetro p_codigo_entregado ESTÁ presente!');
          } else {
            console.log('   ❌ El parámetro p_codigo_entregado NO está. La migración falló.');
          }
        });
      } else {
        console.log('Raw response:', data);
      }
    } catch(e) {
      console.log('Raw response:', data);
    }
  });
});
req.on('error', console.error);
req.write(body);
req.end();
