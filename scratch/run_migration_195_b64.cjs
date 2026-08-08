const { Client } = require('ssh2');
const fs = require('fs');
const sql = fs.readFileSync('./supabase/migrations/195_update_proveedor_id_type.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  const b64 = Buffer.from(sql).toString('base64');
  const cmd = `echo "${b64}" | base64 -d | docker exec -i supabase-db psql -U supabase_admin -d postgres`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      out += data.toString();
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
