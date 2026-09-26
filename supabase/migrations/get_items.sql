SELECT pi.id AS item_id, p.id AS pedido_id, p.numero_pedido
FROM pedido_items pi
JOIN pedidos p ON p.id = pi.pedido_id
ORDER BY p.id DESC
LIMIT 5;
