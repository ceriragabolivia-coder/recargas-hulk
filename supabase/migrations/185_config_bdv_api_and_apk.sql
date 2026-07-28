-- ==========================================
-- Migration: Add BDV API and APK toggles
-- ==========================================

-- Add BDV API integration toggle
INSERT INTO public.configuracion (clave, valor_texto, valor, descripcion)
VALUES ('bdv_api_enabled', 'false', 0, 'Habilitar integración con API de BDV para validación automática')
ON CONFLICT (clave, owner_id) DO NOTHING;

-- Add BDV API Key
INSERT INTO public.configuracion (clave, valor_texto, valor, descripcion)
VALUES ('bdv_api_key', '', 0, 'Clave API para el servicio de verificación BDV')
ON CONFLICT (clave, owner_id) DO NOTHING;

-- Add Pagos APK toggle (if it doesn't exist)
INSERT INTO public.configuracion (clave, valor_texto, valor, descripcion)
VALUES ('pagos_apk_enabled', 'true', 1, 'Habilitar recepción de pagos desde la app Android (APK)')
ON CONFLICT (clave, owner_id) DO NOTHING;
