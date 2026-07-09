-- ============================================
-- MIGRATION: Add relacion_manual to pagos_apk
-- ============================================

ALTER TABLE public.pagos_apk 
ADD COLUMN IF NOT EXISTS relacion_manual TEXT;
