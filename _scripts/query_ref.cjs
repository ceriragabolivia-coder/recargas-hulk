const { Client } = require('ssh2');

const sql = `
  SELECT id, estado, pago_verificado, created_at, referencia_pago 
  FROM pedidos 
  WHERE referencia_pago = '452503' OR referencia_pago LIKE '452503 %';
  
  SELECT id, estado, created_at, referencia_pago 
  FROM billetera_recargas 
  WHERE referencia_pago = '452503' OR referencia_pago LIKE '452503 %';
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
