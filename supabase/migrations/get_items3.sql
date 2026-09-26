SELECT id, numero_pedido, estado, created_at, venta_registrada 
FROM pedidos 
WHERE estado != 'completado'
ORDER BY id DESC 
LIMIT 5;
