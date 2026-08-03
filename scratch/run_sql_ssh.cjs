const { Client } = require('ssh2');
const sql = `
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, integer, text);
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, integer, text);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres -c "${sql.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      out += data.toString();
    });
    stream.write(sql);
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
