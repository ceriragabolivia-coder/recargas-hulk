const { Client } = require('ssh2');
const fs = require('fs');

const sql = fs.readFileSync('c:/hulk/app/supabase/migrations/231_pincentral_integration.sql', 'utf8');

const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres`;

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
