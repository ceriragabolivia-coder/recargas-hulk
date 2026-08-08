const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT routine_name FROM information_schema.routines WHERE routine_type = \'FUNCTION\' AND specific_schema = \'public\';"', (err, stream) => { 
    stream.on('data', d => process.stdout.write(d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
