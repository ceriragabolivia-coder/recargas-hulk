const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, nombre, costo_base, precio_venta_fijo FROM public.productos WHERE precio_venta_fijo > 0 AND costo_base > precio_venta_fijo LIMIT 5;"', (err, stream) => {
    let out = '';
    stream.on('close', () => { console.log(out); conn.end(); }).on('data', d => out+=d).stderr.on('data', d => out+=d);
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo', readyTimeout: 30000 });
