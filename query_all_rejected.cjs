const { Client } = require('ssh2');

const sql = `
  SELECT id, referencia_pago, pago_verificado, created_at 
  FROM pedidos 
  WHERE pago_verificado = false AND created_at > NOW() - INTERVAL '48 hours'
  ORDER BY created_at DESC LIMIT 10;
  
  SELECT id, referencia_pago, estado, created_at 
  FROM billetera_recargas 
  WHERE estado = 'rechazado' AND created_at > NOW() - INTERVAL '48 hours'
  ORDER BY created_at DESC LIMIT 10;
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
