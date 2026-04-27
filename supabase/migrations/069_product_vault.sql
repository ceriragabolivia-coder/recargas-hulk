-- Migration: 069_product_vault.sql
-- Description: Sistema de baúl de códigos (Gift Cards) con entrega automática

-- 1. Crear tabla de códigos
CREATE TABLE IF NOT EXISTS public.producto_codigos (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES public.productos(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usado_at TIMESTAMPTZ,
    owner_id UUID REFERENCES auth.users(id) -- Para soporte multi-negocio
);

-- 2. Añadir columnas a tablas existentes
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS entrega_automatica BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS codigo_entregado TEXT;

-- 3. RLS para producto_codigos
ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_codigos" ON public.producto_codigos 
FOR ALL TO authenticated 
USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'administrador'))
    OR (owner_id = auth.uid())
)
WITH CHECK (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'administrador'))
    OR (owner_id = auth.uid())
);

-- 4. Función RPC para asignar código atómicamente
CREATE OR REPLACE FUNCTION public.asignar_codigo_pedido_item_rpc(p_pedido_item_id INT)
RETURNS TEXT AS $$
DECLARE
    v_producto_id INT;
    v_pedido_id INT;
    v_codigo_id INT;
    v_codigo_text TEXT;
BEGIN
    -- 1. Obtener producto y pedido del item
    SELECT producto_id, pedido_id INTO v_producto_id, v_pedido_id 
    FROM public.pedido_items WHERE id = p_pedido_item_id;

    -- 2. Buscar un código disponible para ese producto
    SELECT id, codigo INTO v_codigo_id, v_codigo_text
    FROM public.producto_codigos
    WHERE producto_id = v_producto_id AND usado = FALSE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 3. Si encontramos código, asignarlo
    IF v_codigo_id IS NOT NULL THEN
        -- Marcar código como usado
        UPDATE public.producto_codigos 
        SET usado = TRUE, 
            pedido_id = v_pedido_id, 
            usado_at = NOW() 
        WHERE id = v_codigo_id;

        -- Guardar el código en el item del pedido
        UPDATE public.pedido_items 
        SET codigo_entregado = v_codigo_text 
        WHERE id = p_pedido_item_id;

        RETURN v_codigo_text;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recargar esquema
NOTIFY pgrst, 'reload schema';
