-- Migración 211: Propagar codigo_entregado desde respuesta de API de proveedores
-- Problema: Los códigos de Gift Cards de TiendaGiftVen y FazerCards se guardaban
-- en mensaje_proveedor pero NO en codigo_entregado, por lo que el cliente no los veía.

-- 1. Actualizar la función webhook_update_pedido_item para aceptar y guardar codigo_entregado
CREATE OR REPLACE FUNCTION public.webhook_update_pedido_item(
  p_item_id integer,
  p_estado_proveedor text,
  p_mensaje_proveedor text DEFAULT NULL::text,
  p_proveedor_pedido_id text DEFAULT NULL::text,
  p_estado text DEFAULT NULL::text,
  p_codigo_entregado text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.pedido_items
    SET 
        estado_proveedor    = COALESCE(p_estado_proveedor, estado_proveedor),
        mensaje_proveedor   = COALESCE(p_mensaje_proveedor, mensaje_proveedor),
        proveedor_pedido_id = COALESCE(p_proveedor_pedido_id, proveedor_pedido_id),
        estado              = COALESCE(p_estado, estado),
        -- Solo sobreescribir codigo_entregado si se pasa un valor no vacío
        codigo_entregado    = CASE 
                                WHEN p_codigo_entregado IS NOT NULL AND TRIM(p_codigo_entregado) != '' 
                                THEN TRIM(p_codigo_entregado) 
                                ELSE codigo_entregado 
                              END
    WHERE id = p_item_id;
    RETURN FOUND;
END;
$function$;

-- 2. Eliminar la firma vieja sin p_codigo_entregado para evitar ambigüedad en PostgREST
DROP FUNCTION IF EXISTS public.webhook_update_pedido_item(
  integer, text, text, text, text
);

NOTIFY pgrst, 'reload schema';
