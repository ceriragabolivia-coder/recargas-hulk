const { Client } = require('ssh2');

const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT proname, prosrc FROM pg_proc WHERE proname = 'crear_pedido_seguro_rpc';"`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log(out.substring(0, 1500));
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      out += data.toString();
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
