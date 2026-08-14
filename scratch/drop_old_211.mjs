// Eliminar la versión vieja de webhook_update_pedido_item (5 parámetros)
// y dejar solo la nueva (6 parámetros con p_codigo_entregado)
import https from 'https';

const SUPABASE_URL = 'https://api.recargashulk.com';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU0NjgyMTUsImV4cCI6MjEwMDgyNjc5OX0.Mewuja4QuB0hJpKLxF08NdPL575wcVFueQtMBuXjBn8';

// Eliminar la versión vieja (sin p_codigo_entregado)
const sql = `
  DROP FUNCTION IF EXISTS public.webhook_update_pedido_item(
    integer, text, text, text, text
  );
  NOTIFY pgrst, 'reload schema';
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
    console.log(`Response: ${data}`);
    if (res.statusCode === 200) {
      console.log('✅ Versión vieja eliminada. Solo queda la nueva con p_codigo_entregado.');
    }
  });
});
req.on('error', console.error);
req.write(body);
req.end();
