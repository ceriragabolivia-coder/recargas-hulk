const { Client } = require('ssh2');

const sql = `
  UPDATE pedido_items SET mensaje_proveedor = 'RBYYFV7B9H28T6UC', codigo_entregado = 'RBYYFV7B9H28T6UC'
  WHERE proveedor_pedido_id = 'ord-740910';
  SELECT id, estado_proveedor, mensaje_proveedor, codigo_entregado FROM pedido_items WHERE proveedor_pedido_id = 'ord-740910';
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
