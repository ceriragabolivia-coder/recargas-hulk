const { Client } = require('ssh2');

const conn = new Client();
const queries = [
  "EXPLAIN ANALYZE SELECT count(*) FROM public.pedidos WHERE pago_verificado IS NULL AND estado != 'cancelado' AND estado != 'reembolsado' AND estado != 'completado'",
  "EXPLAIN ANALYZE SELECT count(*) FROM public.pedidos WHERE estado = 'pendiente'",
  "EXPLAIN ANALYZE SELECT count(*) FROM public.billetera_recargas WHERE estado = 'pendiente'",
  "EXPLAIN ANALYZE SELECT count(*) FROM public.v_clientes_admin LIMIT 600"
];

const sql = queries.join('; ');

conn.on('ready', () => {
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres -c "${sql}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:\n', out);
      conn.end();
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      console.log('STDERR:', data.toString());
    });
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
