const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const sqlFile = path.join(__dirname, 'supabase', 'migrations', '228_mas_indices_optimizacion.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('docker exec -i supabase-db psql -U supabase_admin -d postgres', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
    
    // Write SQL to psql stdin
    stream.write(sqlContent);
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
