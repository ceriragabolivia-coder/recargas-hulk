const fetch = require('node-fetch');
async function run() {
  const res = await fetch('https://recargas-hulk.vercel.app/api/pedidos/auto_process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedido_id: 107, force: true })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
}
run();
