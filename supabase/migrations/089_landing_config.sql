-- 089_landing_config.sql
-- Habilitar lectura pública para la Landing Page
DROP POLICY IF EXISTS "public_read_config" ON public.configuracion;
CREATE POLICY "public_read_config" ON public.configuracion FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_read_categorias" ON public.categorias;
CREATE POLICY "public_read_categorias" ON public.categorias FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_read_juegos" ON public.juegos;
CREATE POLICY "public_read_juegos" ON public.juegos FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_read_productos" ON public.productos;
CREATE POLICY "public_read_productos" ON public.productos FOR SELECT TO anon USING (true);

-- Insertar configuraciones base para la Landing Page
DO $$
BEGIN
    -- landing_titulo
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_titulo' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_titulo', 0, 'Título principal de la landing', 'Ceriraga Recargas', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'Ceriraga Recargas', valor = 0 WHERE clave = 'landing_titulo' AND owner_id IS NULL;
    END IF;

    -- landing_subtitulo
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_subtitulo' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_subtitulo', 0, 'Subtítulo de la landing', 'Los mejores precios en tus juegos favoritos', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'Los mejores precios en tus juegos favoritos', valor = 0 WHERE clave = 'landing_subtitulo' AND owner_id IS NULL;
    END IF;

    -- landing_banner_1
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_banner_1' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_banner_1', 0, 'URL del Banner 1', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070', valor = 0 WHERE clave = 'landing_banner_1' AND owner_id IS NULL;
    END IF;

    -- landing_banner_2
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_banner_2' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_banner_2', 0, 'URL del Banner 2', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071', valor = 0 WHERE clave = 'landing_banner_2' AND owner_id IS NULL;
    END IF;

    -- landing_featured_games
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_featured_games' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_featured_games', 0, 'Lista de IDs de juegos destacados (CSV)', '1,2,3,4', NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = '1,2,3,4', valor = 0 WHERE clave = 'landing_featured_games' AND owner_id IS NULL;
    END IF;

    -- landing_enabled
    IF NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'landing_enabled' AND owner_id IS NULL) THEN
        INSERT INTO public.configuracion (clave, valor, descripcion, valor_texto, owner_id)
        VALUES ('landing_enabled', 1, 'Habilitar landing page (1=si, 0=no)', NULL, NULL);
    ELSE
        UPDATE public.configuracion SET valor_texto = NULL, valor = 1 WHERE clave = 'landing_enabled' AND owner_id IS NULL;
    END IF;
END $$;
