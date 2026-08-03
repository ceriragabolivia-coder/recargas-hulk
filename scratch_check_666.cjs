const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = "SELECT p.id as pedido_id, p.numero_pedido, p.estado, pi.id as item_id, pi.estado as item_estado, pi.estado_proveedor, pi.proveedor_pedido_id FROM pedidos p JOIN pedido_items pi ON p.id = pi.pedido_id WHERE p.numero_pedido = 666";
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres -c "${query}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); }).on('data', data => out += data.toString());
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo', readyTimeout: 30000 });
