const { Client } = require('ssh2');
const fs = require('fs');

const sqlCode = fs.readFileSync('c:\\hulk\\app\\supabase\\migrations\\237_rechazar_apk_expirados.sql', 'utf8');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`cat << 'EOF' > /tmp/237_rechazar_apk_expirados.sql
${sqlCode}
EOF
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/237_rechazar_apk_expirados.sql
docker restart supabase-rest
`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
