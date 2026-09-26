const { Client } = require('ssh2'); 
const sql = `
  SELECT id, estado, pago_verificado, created_at, referencia_pago 
  FROM pedidos 
  WHERE id = 1364;
  
  SELECT id, estado, estado_proveedor, proveedor_pedido_id, codigo_entregado, mensaje_proveedor
  FROM pedido_items 
  WHERE pedido_id = 1364;
`; 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "' + sql + '"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString())); 
    stream.end(); 
  }); 
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
