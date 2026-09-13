const { Client } = require('ssh2');

const sql = `
  SELECT usuario_id, referencia_pago, estado, created_at 
  FROM billetera_recargas 
  WHERE referencia_pago = '324012' OR referencia_pago LIKE '324012 %';
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
  password: 'm+0JVjSbFo'
});
