const { Client } = require('ssh2');

const sql = `
-- 1. Ver pedido 1575 como texto
SELECT 
  p.id,
  p.numero_pedido,
  p.cliente_id,
  p.estado,
  length(p.numero_pedido::text) as len_num
FROM pedidos p
WHERE p.numero_pedido::text = '1575' OR p.numero_pedido::text = '001575'
LIMIT 5;

-- 2. Ver clientes relacionados a ese cliente_id
SELECT 
  c.id AS clientes_uuid,
  c.auth_user_id,
  c.nombres,
  c.usuario,
  c.whatsapp
FROM clientes c
WHERE c.id IN (SELECT cliente_id FROM pedidos WHERE numero_pedido::text IN ('1575','001575'))
   OR c.auth_user_id IN (SELECT cliente_id FROM pedidos WHERE numero_pedido::text IN ('1575','001575'))
LIMIT 5;

-- 3. Buscar tambien por ilike
SELECT numero_pedido, cliente_id FROM pedidos WHERE numero_pedido::text LIKE '%1575%' LIMIT 5;

-- 4. Verificar cuantas politicas SELECT hay en pedidos
SELECT policyname, cmd FROM pg_policies WHERE tablename='pedidos' AND cmd='SELECT' ORDER BY policyname;
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected...');
  conn.exec(`docker exec -i supabase-db psql -U supabase_admin -d postgres`, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
    stream.write(sql + '\n\\q\n');
    stream.end();
  });
}).connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo' });
