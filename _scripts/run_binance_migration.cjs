const { Client } = require('ssh2');

const sql = `
ALTER TABLE public.billetera_recargas
  ADD COLUMN IF NOT EXISTS binance_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS binance_verificado BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_billetera_recargas_binance_transfer_id
  ON public.billetera_recargas (binance_transfer_id)
  WHERE binance_transfer_id IS NOT NULL;

SELECT 'OK: binance_transfer_id column added' AS result;
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected. Running migration...');
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres -t -c "${sql.replace(/\n/g,' ').replace(/"/g,"'")}"`, (err, stream) => {
    if (err) {
      // try alternative
      conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres`, (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
        stream2.write(sql + '\n\\q\n');
        stream2.end();
      });
      return;
    }
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
