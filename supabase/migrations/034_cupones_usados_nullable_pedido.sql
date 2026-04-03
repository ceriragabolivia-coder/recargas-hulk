-- Migración 034: Hacer pedido_id nullable en cupones_usados
-- Esto permite pre-insertar el uso del cupón ANTES de crear el pedido,
-- lo que activa el trigger de validación ANTES de que el pedido exista.
-- Si el pedido falla después, el registro de cupón se elimina (cleanup en JS).
ALTER TABLE public.cupones_usados ALTER COLUMN pedido_id DROP NOT NULL;
