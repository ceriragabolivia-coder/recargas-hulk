const { Client } = require('ssh2');
const conn = new Client();

const sql = `
DROP POLICY IF EXISTS "pedidos_user_select" ON public.pedidos;
CREATE POLICY "pedidos_user_select" ON public.pedidos
    FOR SELECT TO authenticated USING (
        cliente_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.clientes
            WHERE clientes.auth_user_id = auth.uid()
              AND clientes.id = pedidos.cliente_id
        )
    );
SELECT 'OK: RLS policy updated' as result;
`;

conn.on('ready', () => {
  console.log('SSH connected. Running migration...');
  // Escape single quotes for shell
  const escaped = sql.replace(/'/g, "'\\''");
  const cmd = `docker exec -i supabase-db psql -U supabase_admin -d postgres -t -c '${escaped}'`;
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('close', (code) => {
      console.log('Done, exit code:', code);
      conn.end();
    })
    .on('data', d => process.stdout.write(d))
    .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo'
});
