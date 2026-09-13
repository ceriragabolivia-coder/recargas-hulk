const { Client } = require('ssh2'); 
const sql = `
  SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clientes';
`; 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U postgres -d postgres -c "' + sql + '"', (err, stream) => { 
    if (err) throw err; 
    stream.on('close', () => conn.end()).on('data', d => console.log('OUT: ' + d)).stderr.on('data', d => console.log('ERR: ' + d)); 
    stream.end(); 
  }); 
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
