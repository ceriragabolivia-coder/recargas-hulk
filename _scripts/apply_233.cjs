const fs = require('fs');
const { Client } = require('ssh2');

const sql = fs.readFileSync('supabase/migrations/233_fix_condicion_pines.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
          
    stream.write(sql);
    stream.write('\\q\\n');
    stream.end();
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
