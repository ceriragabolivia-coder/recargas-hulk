const { Client } = require('ssh2');
const fs = require('fs');

const sql = `
  SELECT column_name, data_type, column_default 
  FROM information_schema.columns 
  WHERE table_name = 'pedidos' AND column_name = 'pago_verificado';
  
  SELECT id, estado, pago_verificado FROM pedidos ORDER BY created_at DESC LIMIT 5;
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
