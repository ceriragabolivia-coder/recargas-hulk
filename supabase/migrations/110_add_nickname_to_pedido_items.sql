-- Migration: 110_add_nickname_to_pedido_items.sql
-- Description: Añade soporte para almacenar el nombre del jugador (nickname) verificado en los pedidos.

-- 1. Añadir columna nickname a pedido_items
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS nickname TEXT;

-- 2. Añadir comentario
COMMENT ON COLUMN public.pedido_items.nickname IS 'Nombre del jugador verificado antes de crear el pedido';
