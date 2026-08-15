const { Client } = require('ssh2');

const sqlContent = `
CREATE OR REPLACE FUNCTION public.reclamar_premio_creador_rpc(
    p_cliente_id UUID,
    p_producto_id INT,
    p_producto_nombre TEXT
) RETURNS INT AS $$
DECLARE
    v_pedido_id INT;
BEGIN
    IF auth.uid() != p_cliente_id THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    INSERT INTO public.pedidos (
        cliente_id,
        estado,
        total_usd,
        total_bs
    ) VALUES (
        p_cliente_id,
        'procesando',
        0,
        0
    ) RETURNING id INTO v_pedido_id;

    INSERT INTO public.pedido_items (
        pedido_id,
        producto_id,
        juego_nombre,
        producto_nombre,
        cantidad,
        precio_usd,
        precio_bs
    ) VALUES (
        v_pedido_id,
        p_producto_id,
        'Premio Creador',
        p_producto_nombre,
        1,
        0,
        0
    );

    RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
NOTIFY pgrst, 'reload schema';
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established');
  conn.exec('cat > /tmp/213_mig_part2.sql', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('File uploaded, executing sql...');
      conn.exec('docker exec -i supabase-db psql -U postgres -d postgres < /tmp/213_mig_part2.sql', (err, stream2) => {
        if (err) throw err;
        let out = '';
        stream2.on('close', (code, signal) => {
          console.log('Execution finished:', code);
          console.log(out);
          conn.end();
        }).on('data', (data) => {
          out += data.toString();
        }).stderr.on('data', (data) => {
          out += 'STDERR: ' + data.toString();
        });
      });
    }).on('data', () => {}).stderr.on('data', () => {});
    stream.write(sqlContent);
    stream.end();
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 30000
});
