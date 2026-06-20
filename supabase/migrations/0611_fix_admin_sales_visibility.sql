-- Migration: 061_fix_admin_sales_visibility.sql
-- Description: Allow SuperAdmin to see all sales and ensure RLS doesn't block admins with missing client records

DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;


-- Nota: Si auth.email() no está disponible en RLS directamente sin join con auth.users, 
-- usamos el nickname como respaldo o simplemente permitimos a todos los 'admin' ver nulos.
-- Pero para estar seguros del SuperAdmin:

CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) = 'ceriraga@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins see sales" ON public.ventas;
CREATE POLICY "Admins see sales" ON public.ventas
    FOR ALL USING (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin'
        AND (
            public.is_superadmin() 
            OR vendedor_id IS NULL 
            OR vendedor_id IN (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid())
        )
    );

NOTIFY pgrst, 'reload schema';
