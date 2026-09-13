const { Client } = require('ssh2'); 
const sql = `
  SELECT j.id as juego_id, j.nombre as juego, j.api_provider_category_id as j_cat, 
         p.id as prod_id, p.nombre as prod, p.api_provider_category_id as p_cat, p.proveedor_api_id
  FROM productos p 
  JOIN juegos j ON j.id = p.juego_id 
  WHERE j.api_provider = 'fazercards' OR p.api_provider = 'fazercards';
`; 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "' + sql + '"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', d => console.log(d.toString())).stderr.on('data', d => console.error(d.toString())); 
    stream.end(); 
  }); 
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
