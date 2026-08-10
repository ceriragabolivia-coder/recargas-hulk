const fs = require('fs');
const { Client } = require('ssh2');

const sqlContent = fs.readFileSync('C:\\hulk\\app\\supabase\\migrations\\200_remove_pines_lock.sql', 'utf8');

// Escapar comillas simples para bash
const safeSql = sqlContent.replace(/'/g, "'\\''");

const sshCommand = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c '${safeSql}'`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(sshCommand, (err, stream) => {
    if (err) throw err;
    let stdout = '';
    let stderr = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:\n', stdout);
      if (stderr) console.log('STDERR:\n', stderr);
      console.log('Exit code:', code);
      conn.end();
    }).on('data', (data) => {
      stdout += data.toString();
    }).stderr.on('data', (data) => {
      stderr += data.toString();
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 60000
});
