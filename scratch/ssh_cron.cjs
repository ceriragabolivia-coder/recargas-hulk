const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`cat << 'EOF' > /root/rechazar_apk.sh
#!/bin/bash
for i in {1..6}
do
   docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT public.rechazar_pagos_apk_expirados_rpc();" > /dev/null 2>&1
   sleep 10
done
EOF
chmod +x /root/rechazar_apk.sh
(crontab -l 2>/dev/null | grep -v "rechazar_apk.sh"; echo "* * * * * /root/rechazar_apk.sh") | crontab -
/root/rechazar_apk.sh &
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
