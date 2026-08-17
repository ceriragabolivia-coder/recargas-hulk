const { Client } = require('ssh2'); 
const sql = `
  SELECT id, numero_pedido FROM public.pedidos WHERE numero_pedido = 1220; 
  SELECT * FROM public.pedido_items WHERE pedido_id = (SELECT id FROM public.pedidos WHERE numero_pedido = 1220 LIMIT 1);
`; 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "' + sql + '"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', d => console.log('OUT: ' + d)).stderr.on('data', d => console.log('ERR: ' + d)); 
    stream.end(); 
  }); 
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
