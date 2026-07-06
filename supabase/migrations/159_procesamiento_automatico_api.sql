-- Migration: 159_procesamiento_automatico_api.sql
-- Description: Agrega la opción "Procesar automáticamente con API post-verificación de pago"
-- a nivel de juego/servicio, para que pedidos con productos vinculados a la API de TiendaGiftVen
-- se procesen automáticamente al verificarse el pago por el sistema APK.

ALTER TABLE public.juegos
ADD COLUMN IF NOT EXISTS procesamiento_automatico_api BOOLEAN DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
