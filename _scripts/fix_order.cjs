const { Client } = require('ssh2'); 
const sql = `
  UPDATE public.pedido_items 
  SET codigo_entregado = mensaje_proveedor 
  WHERE pedido_id = (SELECT id FROM public.pedidos WHERE numero_pedido = 1220 LIMIT 1)
  AND (mensaje_proveedor IS NOT NULL AND mensaje_proveedor != '');
  SELECT id, codigo_entregado FROM public.pedido_items WHERE pedido_id = (SELECT id FROM public.pedidos WHERE numero_pedido = 1220 LIMIT 1);
`; 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -t -c "' + sql + '"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d)); 
    stream.end(); 
  }); 
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
