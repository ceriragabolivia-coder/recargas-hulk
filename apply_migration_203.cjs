const fs = require('fs');
const { Client } = require('ssh2');

const sqlContent = fs.readFileSync('supabase/migrations/203_fix_pedido_apk_reference.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection ready.');
  
  // We execute a shell and write the SQL into psql
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres`, (err, stream) => {
    if (err) throw err;
    
    stream.on('close', (code, signal) => {
      console.log('Stream closed with code ' + code + (signal ? ' and signal ' + signal : ''));
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });

    // Write the SQL commands into the stdin of the docker process
    stream.write(sqlContent);
    stream.write('\n\\q\n');
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
