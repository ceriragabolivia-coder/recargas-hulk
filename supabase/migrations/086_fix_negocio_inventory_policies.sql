
-- Migration 086: Restaurar Permisos de Inventario para Rol Negocio
-- Este parche devuelve la capacidad de crear y gestionar productos a los dueños de negocios.

-- 1. Ayudante para verificar rol negocio
CREATE OR REPLACE FUNCTION public.is_negocio() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'negocio';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. POLÍTICAS PARA CATEGORÍAS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categorias: acceso total" ON public.categorias;
CREATE POLICY "Categorias: acceso total" ON public.categorias
FOR ALL USING (
    public.is_admin() -- Admin ve y hace todo
    OR (owner_id = auth.uid()) -- Negocio ve y hace lo suyo
    OR (owner_id IS NULL AND auth.uid() IS NOT NULL) -- Todos ven lo global
) WITH CHECK (
    public.is_admin() 
    OR (public.is_negocio() AND owner_id = auth.uid())
);

-- 3. POLÍTICAS PARA JUEGOS
ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Juegos: acceso total" ON public.juegos;
CREATE POLICY "Juegos: acceso total" ON public.juegos
FOR ALL USING (
    public.is_admin()
    OR (owner_id = auth.uid())
    OR (owner_id IS NULL AND auth.uid() IS NOT NULL)
) WITH CHECK (
    public.is_admin()
    OR (public.is_negocio() AND owner_id = auth.uid())
);

-- 4. POLÍTICAS PARA PRODUCTOS
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Productos: acceso total" ON public.productos;
CREATE POLICY "Productos: acceso total" ON public.productos
FOR ALL USING (
    public.is_admin()
    OR (owner_id = auth.uid())
    OR (owner_id IS NULL AND auth.uid() IS NOT NULL)
) WITH CHECK (
    public.is_admin()
    OR (public.is_negocio() AND owner_id = auth.uid())
);

-- 5. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
