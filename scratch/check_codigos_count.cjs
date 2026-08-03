const { Client } = require('ssh2');

const sshCommand = `docker exec -i supabase-db psql -U supabase_admin -d postgres -c "SELECT COUNT(*) FROM public.producto_codigos;"`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(sshCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
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
