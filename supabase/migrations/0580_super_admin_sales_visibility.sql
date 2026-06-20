-- Migration: 058_super_admin_sales_visibility.sql
-- Description: Allow super admin (recargashulk@gmail.com) to see all sales records

DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;
CREATE POLICY "Admins see only their own sales" ON public.ventas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles p
            JOIN public.clientes c ON c.auth_user_id = p.id
            WHERE p.id = auth.uid() AND p.rol = 'admin'
            AND (
                c.id = vendedor_id 
                OR vendedor_id IS NULL 
                OR (auth.jwt() ->> 'email') = 'recargashulk@gmail.com'
            )
        )
    );

NOTIFY pgrst, 'reload schema';
