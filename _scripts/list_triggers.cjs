const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
  const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'pedidos'::regclass;"`;
  conn.exec(cmd, (err, stream) => { 
    stream.on('data', d => process.stdout.write(d)).on('close', () => conn.end()); 
  }); 
}).connect({host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo'});
