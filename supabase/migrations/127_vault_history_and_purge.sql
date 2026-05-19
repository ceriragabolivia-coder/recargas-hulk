-- Migration: 127_vault_history_and_purge.sql
-- Description: Implementar purga automática de códigos usados después de 15 días, y actualizar asignar_codigo_pedido_item_rpc para incluir esta purga.

-- 1. Actualizar función de asignación para incluir la purga
CREATE OR REPLACE FUNCTION public.asignar_codigo_pedido_item_rpc(p_pedido_item_id INT)
RETURNS TEXT AS $$
DECLARE
    v_producto_id INT;
    v_pedido_id INT;
    v_cliente_id UUID;
    v_codigo_id INT;
    v_codigo_text TEXT;
BEGIN
    -- 1. Verificar que el usuario que llama es dueño del pedido O es admin
    SELECT pi.producto_id, pi.pedido_id, p.cliente_id 
    INTO v_producto_id, v_pedido_id, v_cliente_id
    FROM public.pedido_items pi
    JOIN public.pedidos p ON pi.pedido_id = p.id
    WHERE pi.id = p_pedido_item_id;

    IF NOT (v_cliente_id = auth.uid() OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permiso para acceder a este código.';
    END IF;

    -- 2. Buscar un código disponible para ese producto
    SELECT id, codigo INTO v_codigo_id, v_codigo_text
    FROM public.producto_codigos
    WHERE producto_id = v_producto_id AND usado = FALSE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 3. Si encontramos código, asignarlo
    IF v_codigo_id IS NOT NULL THEN
        UPDATE public.producto_codigos 
        SET usado = TRUE, 
            pedido_id = v_pedido_id, 
            usado_at = NOW() 
        WHERE id = v_codigo_id;

        UPDATE public.pedido_items 
        SET codigo_entregado = v_codigo_text 
        WHERE id = p_pedido_item_id;

        -- PURGAR CÓDIGOS USADOS CON MÁS DE 15 DÍAS DE ANTIGÜEDAD
        DELETE FROM public.producto_codigos
        WHERE usado = TRUE AND usado_at < NOW() - INTERVAL '15 days';

        RETURN v_codigo_text;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear función y trigger a nivel de sentencia para purgar automáticamente en cualquier inserción/actualización de pedidos
CREATE OR REPLACE FUNCTION public.purge_old_used_codes_fn()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.producto_codigos
    WHERE usado = TRUE AND usado_at < NOW() - INTERVAL '15 days';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_purge_old_used_codes ON public.pedidos;
CREATE TRIGGER trig_purge_old_used_codes
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH STATEMENT
EXECUTE FUNCTION public.purge_old_used_codes_fn();

-- 3. Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
