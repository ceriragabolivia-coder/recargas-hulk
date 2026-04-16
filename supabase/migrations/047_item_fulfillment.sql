-- Migración 047: Seguimiento individual de paquetes
-- Añade seguimiento por comprobante/fallo a la tabla pedido_items

ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'pendiente';
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS notas_admin TEXT;

-- Notificar al esquema
NOTIFY pgrst, 'reload schema';
