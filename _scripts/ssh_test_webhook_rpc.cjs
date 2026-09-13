const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  // Obtenemos el ID del item basado en el ID del pedido 1547 (el screenshot muestra #001547)
  // Wait, the screenshot shows #001547, and TiendaGiftVen shows pedido #371037
  // Let's first find the internal pedido_id and item_id
  
  const sql = `
    DO $$
    DECLARE
      v_pedido_id BIGINT;
      v_item_id BIGINT;
      v_res JSON;
    BEGIN
      -- Busca el pedido por numero
      SELECT id INTO v_pedido_id FROM public.pedidos WHERE numero_pedido = '1547';
      
      -- Busca el item asociado
      SELECT id INTO v_item_id FROM public.pedido_items WHERE pedido_id = v_pedido_id LIMIT 1;
      
      -- Llama a la funcion webhook simulando TGV
      v_res := public.procesar_webhook_tiendagiftven_rpc(
        'HULK-ITEM-' || v_item_id::TEXT, 
        371037, 
        'completado', 
        'Simulando webhook exitoso por debug'
      );
      
      RAISE NOTICE 'Resultado: %', v_res;
    END;
    $$;
  `;

  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres -c "${sql.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:', out);
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
