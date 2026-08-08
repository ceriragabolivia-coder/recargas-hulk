const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres -c "select numero_pedido, referencia_pago, pago_verificado, created_at, updated_at from pedidos order by numero_pedido desc limit 5;"', (err, stream) => { 
    stream.on('data', d => console.log(''+d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
