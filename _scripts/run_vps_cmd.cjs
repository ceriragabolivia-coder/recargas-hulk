const { Client } = require('ssh2');

const cmd = `
cat /root/supabase/docker/.env | grep -i SERVICE_ROLE_KEY || echo "Not in /root/supabase/docker"
cat /opt/supabase/docker/.env | grep -i SERVICE_ROLE_KEY || echo "Not in /opt/supabase/docker"
find /root -name ".env" -exec grep -H "SERVICE_ROLE_KEY" {} \\; 2>/dev/null
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo'
});
