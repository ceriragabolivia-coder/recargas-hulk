const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres -c "select i.id, i.producto_id, j.procesamiento_automatico_api, j.api_provider, p.proveedor_api_id, i.estado_proveedor from pedido_items i join productos p on i.producto_id = p.id join juegos j on p.juego_id = j.id where i.pedido_id = (select id from pedidos where numero_pedido = \'000751\');"', (err, stream) => { 
    stream.on('data', d => console.log(''+d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
