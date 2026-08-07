-- Cambiar el tipo de dato de proveedor_pedido_id a text para soportar FazerCards (que usa "ord-12345")
ALTER TABLE public.pedido_items ALTER COLUMN proveedor_pedido_id TYPE text;

-- Actualizar la función para aceptar text
CREATE OR REPLACE FUNCTION public.webhook_update_pedido_item(
  p_item_id integer,
  p_estado_proveedor text,
  p_mensaje_proveedor text DEFAULT NULL::text,
  p_proveedor_pedido_id text DEFAULT NULL::text,
  p_estado text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.pedido_items
    SET 
        estado_proveedor = COALESCE(p_estado_proveedor, estado_proveedor),
        mensaje_proveedor = COALESCE(p_mensaje_proveedor, mensaje_proveedor),
        proveedor_pedido_id = COALESCE(p_proveedor_pedido_id, proveedor_pedido_id),
        estado = COALESCE(p_estado, estado)
    WHERE id = p_item_id;
    RETURN FOUND;
END;
$function$;
