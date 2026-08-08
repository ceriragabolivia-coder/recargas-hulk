const { Client } = require('ssh2');

const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT pi.id, p.numero_pedido, pi.proveedor_pedido_id, pi.estado_proveedor FROM pedido_items pi JOIN pedidos p ON pi.pedido_id = p.id WHERE p.numero_pedido IN ('000753', '000754', '000755');"`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
