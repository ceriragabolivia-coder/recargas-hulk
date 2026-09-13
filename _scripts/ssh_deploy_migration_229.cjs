const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const sqlFile = path.join(__dirname, 'supabase', 'migrations', '229_optimize_layout_counts.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:\n', out);
      conn.end();
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      console.log('STDERR:', data.toString());
    });
    
    stream.write(sqlContent);
    stream.end();
  });
}).on('error', (err) => {
  console.error("SSH Error:", err);
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
