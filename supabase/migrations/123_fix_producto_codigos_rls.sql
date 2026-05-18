-- Migration: 123_fix_producto_codigos_rls.sql
-- Description: Fix RLS policy on producto_codigos so superadmin can manage codes correctly

ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Codigos: solo admin o owner" ON public.producto_codigos;

CREATE POLICY "Codigos: solo admin o owner" ON public.producto_codigos
    FOR ALL USING (
        public.is_admin() 
        OR public.is_superadmin()
        OR owner_id = auth.uid()
    );

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
