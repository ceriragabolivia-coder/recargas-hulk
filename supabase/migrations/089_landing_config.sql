-- 089_landing_config.sql
-- Habilitar lectura pública para la Landing Page
ALTER POLICY "public_read_config" ON configuracion FOR SELECT TO anon USING (true);
ALTER POLICY "public_read_categorias" ON categorias FOR SELECT TO anon USING (true);
ALTER POLICY "public_read_juegos" ON juegos FOR SELECT TO anon USING (true);
ALTER POLICY "public_read_productos" ON productos FOR SELECT TO anon USING (true);

-- Si no existen las políticas (por si falla el ALTER), las creamos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_config') THEN
        CREATE POLICY "public_read_config" ON configuracion FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_categorias') THEN
        CREATE POLICY "public_read_categorias" ON categorias FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_juegos') THEN
        CREATE POLICY "public_read_juegos" ON juegos FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_productos') THEN
        CREATE POLICY "public_read_productos" ON productos FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Insertar configuraciones base para la Landing Page
INSERT INTO configuracion (clave, valor, descripcion, valor_texto) VALUES
    ('landing_titulo', 0, 'Título principal de la landing', 'Ceriraga Recargas'),
    ('landing_subtitulo', 0, 'Subtítulo de la landing', 'Los mejores precios en tus juegos favoritos'),
    ('landing_banner_1', 0, 'URL del Banner 1', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=2070'),
    ('landing_banner_2', 0, 'URL del Banner 2', 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2071'),
    ('landing_featured_games', 0, 'Lista de IDs de juegos destacados (CSV)', '1,2,3,4'),
    ('landing_enabled', 1, 'Habilitar landing page (1=si, 0=no)', NULL)
ON CONFLICT (clave) DO UPDATE SET valor_texto = EXCLUDED.valor_texto, valor = EXCLUDED.valor;
