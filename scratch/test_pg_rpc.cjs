const { Client } = require('ssh2');

const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'webhook_update_pedido_item';"`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
