const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres -c "select id, estado_proveedor, mensaje_proveedor from pedido_items where id = 747;"', (err, stream) => { 
    stream.on('data', d => console.log(''+d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
