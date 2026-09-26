const { Client } = require('ssh2');

const sql = `
CREATE OR REPLACE FUNCTION get_perfil_completo_rpc(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    resultado json;
BEGIN
    SELECT row_to_json(v) INTO resultado
    FROM v_clientes_admin v
    WHERE v.auth_user_id = p_user_id;
    
    RETURN resultado;
END;
$$;
`;

const cmd = 'docker exec -i supabase-db psql -U supabase_admin -d postgres';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
    
    stream.write(sql);
    stream.end();
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 10000
});
