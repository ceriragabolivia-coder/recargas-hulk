const { Client } = require('ssh2');

const sql = `
  SELECT pi.id, pi.estado_proveedor, pi.mensaje_proveedor, pi.codigo_entregado
  FROM pedido_items pi
  JOIN pedidos p ON p.id = pi.pedido_id
  WHERE p.numero_pedido = '001254';
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { conn.end(); })
          .on('data', (data) => console.log(data.toString()))
          .stderr.on('data', (data) => console.error(data.toString()));
    stream.write(sql);
    stream.end();
  });
}).connect({
  host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'
});
