const { Client } = require('ssh2');
const fs = require('fs');

const sql = fs.readFileSync('c:/hulk/app/supabase/migrations/225_fix_rpc_ocr_recargas.sql', 'utf8');

// Escaping the SQL string correctly for bash or using standard input
const cmd = `docker exec -i supabase-db psql -U postgres -d postgres`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
    
    // Write SQL to stdin of the command
    stream.write(sql);
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
