const { Client } = require('ssh2');
const fs = require('fs');

const sql = fs.readFileSync('supabase/migrations/217_fix_auto_approve_overload.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
    // Send the SQL query to psql's stdin
    stream.write(sql);
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo'
});
