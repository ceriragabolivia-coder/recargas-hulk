-- Migration: 059_add_zone_id_to_orders.sql
-- Description: Añade soporte para Zone ID en los pedidos, permitiendo registrar juegos que requieren ID + Zone ID (ej. Mobile Legends).

-- 1. Añadir columna zone_id a pedido_items
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- 2. Actualizar comentarios o documentación interna si es necesario
COMMENT ON COLUMN public.pedido_items.zone_id IS 'ID de zona para juegos que requieren doble identificador (ej. Mobile Legends)';
