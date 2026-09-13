const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS popup_activo BOOLEAN DEFAULT FALSE;
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS popup_titulo TEXT;
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS popup_mensaje TEXT;
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS popup_imagen TEXT;

NOTIFY pgrst, 'reload schema';
  `;
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres -t -c "${query.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', d => process.stdout.write(d))
          .stderr.on('data', d => process.stderr.write(d));
    stream.end();
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
