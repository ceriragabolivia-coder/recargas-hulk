-- ============================================
-- ESQUEMA COMPLETO: Sistema de Recargas Ceriraga
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. CONFIGURACIÃ“N GLOBAL
CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor NUMERIC NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('tasa_binance', 650, 'Tasa Binance en Bs por USD'),
    ('tasa_dolar', 690, 'Tasa del dÃ³lar en Bs por USD'),
    ('descuentos', 0, 'Descuento general (%)'),
    ('real_dolar', 165, 'Tasa real del dÃ³lar'),
    ('costo_pinsmile', 17.5, 'Costo de Pin Smile'),
    ('porcentaje_paypal', 0.08, 'Porcentaje de comisiÃ³n PayPal')
ON CONFLICT (clave) DO NOTHING;

-- 2. CATEGORÃAS
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    icono VARCHAR(50),
    orden INT DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE
);

INSERT INTO categorias (nombre, icono, orden) VALUES
    ('Shooters/Battle Royale', 'ðŸ”«', 1),
    ('MOBA/RPG', 'âš”ï¸', 2),
    ('Gacha/Anime', 'ðŸŽ®', 3),
    ('Gift Cards', 'ðŸŽ', 4),
    ('Suscripciones', 'ðŸ“±', 5),
    ('Exchangers/Wallets', 'ðŸ’±', 6),
    ('Redes/Streaming', 'ðŸ“º', 7),
    ('Otros', 'ðŸ“¦', 8)
ON CONFLICT DO NOTHING;

-- 3. JUEGOS/SERVICIOS
CREATE TABLE IF NOT EXISTS juegos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria_id INT REFERENCES categorias(id),
    tipo_calculo VARCHAR(30) DEFAULT 'estandar',
    descuento_particular NUMERIC DEFAULT 0,
    usa_pinsmile BOOLEAN DEFAULT FALSE,
    usa_real_dolar BOOLEAN DEFAULT FALSE,
    pin_smile_base NUMERIC DEFAULT 0,
    usa_tasa_binance BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    icono_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    juego_id INT REFERENCES juegos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    unidades NUMERIC,
    costo_base NUMERIC NOT NULL,
    margen_ganancia NUMERIC NOT NULL,
    costo_referencia NUMERIC DEFAULT 0,
    precio_venta_fijo NUMERIC,
    activo BOOLEAN DEFAULT TRUE,
    orden INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VENTAS
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    producto_id INT REFERENCES productos(id),
    juego_id INT REFERENCES juegos(id),
    cantidad INT DEFAULT 1,
    tasa_dolar_momento NUMERIC NOT NULL,
    real_dolar_momento NUMERIC,
    tasa_binance_momento NUMERIC,
    costo_base_momento NUMERIC NOT NULL,
    margen_momento NUMERIC NOT NULL,
    precio_venta_usd NUMERIC NOT NULL,
    precio_venta_bs NUMERIC NOT NULL,
    ganancia_usd NUMERIC NOT NULL,
    descuento_aplicado NUMERIC DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CUENTAS FORTNITE
CREATE TABLE IF NOT EXISTS cuentas_fortnite (
    id SERIAL PRIMARY KEY,
    correo_microsoft VARCHAR(255) NOT NULL,
    clave_microsoft VARCHAR(100),
    fecha_creacion DATE,
    whatsapp_cliente VARCHAR(50),
    fecha_vinculacion DATE,
    proceso VARCHAR(50) DEFAULT 'Listo para vincular',
    correo_epic VARCHAR(255),
    clave_epic VARCHAR(100),
    ultima_compra_club DATE,
    meses_activos INT DEFAULT 0,
    ganancia NUMERIC DEFAULT 0,
    tienda VARCHAR(100),
    nombre_perfil_xbox VARCHAR(100),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. HISTORIAL DE TASAS
CREATE TABLE IF NOT EXISTS historial_tasas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    tasa_binance NUMERIC,
    tasa_dolar NUMERIC,
    real_dolar NUMERIC,
    costo_pinsmile NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. VISTAS
CREATE OR REPLACE VIEW ganancias_diarias AS
SELECT 
    v.fecha,
    j.nombre AS juego,
    j.categoria_id,
    SUM(v.ganancia_usd) AS ganancia_total,
    SUM(v.precio_venta_usd) AS ventas_total_usd,
    SUM(v.precio_venta_bs) AS ventas_total_bs,
    COUNT(*) AS total_recargas
FROM ventas v
JOIN juegos j ON v.juego_id = j.id
GROUP BY v.fecha, j.nombre, j.categoria_id
ORDER BY v.fecha DESC;

CREATE OR REPLACE VIEW resumen_diario AS
SELECT 
    fecha,
    SUM(ganancia_usd) AS ganancias_totales,
    SUM(precio_venta_usd) AS ventas_totales_usd,
    SUM(precio_venta_bs) AS ventas_totales_bs,
    COUNT(*) AS recargas_totales
FROM ventas
GROUP BY fecha
ORDER BY fecha DESC;

-- 9. FUNCIÃ“N: Registrar venta
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                              - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. TRIGGER: Historial de tasas
CREATE OR REPLACE FUNCTION guardar_historial_tasas()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
        INSERT INTO historial_tasas (tasa_binance, tasa_dolar, real_dolar, costo_pinsmile)
        SELECT 
            (SELECT valor FROM configuracion WHERE clave = 'tasa_binance'),
            (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar'),
            (SELECT valor FROM configuracion WHERE clave = 'real_dolar'),
            (SELECT valor FROM configuracion WHERE clave = 'costo_pinsmile');
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_historial_tasas ON configuracion;
CREATE TRIGGER trig_historial_tasas
BEFORE UPDATE ON configuracion
FOR EACH ROW EXECUTE FUNCTION guardar_historial_tasas();

-- 11. RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE juegos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_fortnite ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_tasas ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas: usuarios autenticados pueden todo
CREATE POLICY "auth_all" ON configuracion FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON juegos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON cuentas_fortnite FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON historial_tasas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. DATOS INICIALES: Juegos del Excel
INSERT INTO juegos (nombre, categoria_id, tipo_calculo, usa_pinsmile, usa_real_dolar, usa_tasa_binance, pin_smile_base) VALUES
    ('Free Fire', 1, 'estandar', false, false, false, 0),
    ('HAIKYU!! FLY HIGH', 3, 'estandar', false, false, false, 0),
    ('Fragmentos FF', 1, 'ref_cruzada', false, false, false, 0),
    ('Free Fire Xanler', 1, 'ref_cruzada', false, false, false, 0),
    ('Brawl Stars', 1, 'estandar', false, false, false, 0),
    ('Clash Royale', 2, 'estandar', false, false, false, 0),
    ('Clash of Clans', 2, 'estandar', false, false, false, 0),
    ('Blood Strike', 1, 'estandar', true, false, false, 5000),
    ('Blood Razer', 1, 'estandar', true, false, false, 5000),
    ('Bigo Live', 7, 'estandar', true, false, false, 1000),
    ('Exchangers Ecuador', 6, 'paypal', false, false, true, 0),
    ('Exchangers', 6, 'paypal', false, false, true, 0),
    ('PUBG Mobile', 1, 'estandar', false, false, false, 0),
    ('Albion Online', 2, 'estandar', false, false, false, 0),
    ('Nintendo', 4, 'estandar', false, false, false, 0),
    ('Xbox Gift Card', 4, 'estandar', false, false, false, 0),
    ('PlayStation', 4, 'estandar', false, false, false, 0),
    ('Steam', 4, 'estandar', false, false, false, 0),
    ('Spotify', 5, 'estandar', false, false, false, 0),
    ('Wally', 6, 'estandar', false, false, false, 0),
    ('Zinli', 6, 'estandar', false, false, false, 0),
    ('Apple', 4, 'estandar', false, false, false, 0),
    ('Riot Access', 4, 'estandar', false, false, false, 0),
    ('Arena Breakout', 1, 'estandar', false, false, false, 0),
    ('Genshin Impact', 3, 'estandar', false, false, false, 0),
    ('COD Mobile', 1, 'estandar', false, false, false, 0),
    ('TikTok', 7, 'estandar', false, false, false, 0),
    ('Lords Mobile', 2, 'estandar', false, false, false, 0),
    ('Minecraft', 8, 'estandar', false, false, false, 0),
    ('Roblox', 8, 'estandar', false, false, false, 0),
    ('Popolive', 7, 'estandar', true, true, false, 1000),
    ('Likee', 7, 'estandar', true, false, false, 1000),
    ('WildRift', 2, 'descuento_doble', false, false, false, 0),
    ('Fortnite', 1, 'descuento_doble', true, false, false, 1000),
    ('Honkai Star Rail', 3, 'estandar', true, false, false, 1000),
    ('Honor of Kings', 2, 'estandar', true, false, false, 1000)
ON CONFLICT DO NOTHING;

-- 13. PRODUCTOS DE EJEMPLO (Free Fire - para tener datos de inicio)
INSERT INTO productos (juego_id, nombre, unidades, costo_base, margen_ganancia, orden) VALUES
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '110 Diamantes', 110, 0.7, 0.4, 1),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '341 Diamantes', 341, 2.1, 0.35, 2),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '572 Diamantes', 572, 3.5, 0.35, 3),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '1166 Diamantes', 1166, 7.0, 0.3, 4),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '2398 Diamantes', 2398, 14.0, 0.3, 5),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), '6160 Diamantes', 6160, 35.0, 0.25, 6),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), 'Pase Booyah', NULL, 4.0, 0.3, 7),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), 'Tarjeta Semanal', NULL, 0.7, 0.4, 8),
    ((SELECT id FROM juegos WHERE nombre = 'Free Fire' LIMIT 1), 'Tarjeta Mensual', NULL, 3.5, 0.35, 9),
    -- Brawl Stars
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '30 Gemas', 30, 1.0, 0.6, 1),
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '80 Gemas', 80, 2.5, 0.55, 2),
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '170 Gemas', 170, 5.0, 0.5, 3),
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '360 Gemas', 360, 10.0, 0.45, 4),
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '950 Gemas', 950, 25.0, 0.4, 5),
    ((SELECT id FROM juegos WHERE nombre = 'Brawl Stars' LIMIT 1), '2000 Gemas', 2000, 50.0, 0.35, 6),
    -- Fortnite
    ((SELECT id FROM juegos WHERE nombre = 'Fortnite' LIMIT 1), '1000 Pavos', 1000, 4.8, 0.55, 1),
    ((SELECT id FROM juegos WHERE nombre = 'Fortnite' LIMIT 1), '2800 Pavos', 2800, 12.0, 0.5, 2),
    ((SELECT id FROM juegos WHERE nombre = 'Fortnite' LIMIT 1), '5000 Pavos', 5000, 20.0, 0.45, 3),
    ((SELECT id FROM juegos WHERE nombre = 'Fortnite' LIMIT 1), '13500 Pavos', 13500, 50.0, 0.4, 4),
    ((SELECT id FROM juegos WHERE nombre = 'Fortnite' LIMIT 1), 'Club Fortnite', NULL, 6.0, 0.5, 5),
    -- Roblox
    ((SELECT id FROM juegos WHERE nombre = 'Roblox' LIMIT 1), '80 Robux', 80, 1.0, 0.5, 1),
    ((SELECT id FROM juegos WHERE nombre = 'Roblox' LIMIT 1), '160 Robux', 160, 2.0, 0.45, 2),
    ((SELECT id FROM juegos WHERE nombre = 'Roblox' LIMIT 1), '500 Robux', 500, 5.0, 0.4, 3),
    ((SELECT id FROM juegos WHERE nombre = 'Roblox' LIMIT 1), '1000 Robux', 1000, 10.0, 0.35, 4),
    ((SELECT id FROM juegos WHERE nombre = 'Roblox' LIMIT 1), '2000 Robux', 2000, 20.0, 0.3, 5)
ON CONFLICT DO NOTHING;
-- Migration: Create clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    password_correo TEXT,
    whatsapp TEXT,
    nickname TEXT,
    pais TEXT DEFAULT 'Venezuela',
    estado TEXT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ultimo_login TIMESTAMP WITH TIME ZONE,
    ip_registro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Permitir lectura a autenticados" ON public.clientes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserciÃ³n a autenticados" ON public.clientes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualizaciÃ³n a autenticados" ON public.clientes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminaciÃ³n a autenticados" ON public.clientes
    FOR DELETE TO authenticated USING (true);
-- Migration: Auth Roles and Profile Linking
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    rol TEXT DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Link clientes table to Auth
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Perfiles: ver propio" ON public.perfiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Perfiles: admin ve todos" ON public.perfiles FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Trigger to auto-create profile for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol)
  VALUES (new.id, 'cliente');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- IMPORTANT: Manual step for the existing user
-- UPDATE perfiles SET rol = 'admin' WHERE id = 'USUARIO_ACTUAL_ID';
-- ASIGNAR ROL DE ADMINISTRADOR (Ejecutar en Supabase SQL Editor)
UPDATE public.perfiles 
SET rol = 'admin' 
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'ceriraga@gmail.com'
);

-- Verificar el cambio
SELECT p.id, u.email, p.rol 
FROM public.perfiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'ceriraga@gmail.com';
-- Migration: Sistema de AprobaciÃ³n de Usuarios
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));

-- Asegurar que el administrador actual estÃ© aprobado
UPDATE public.perfiles SET estado = 'aprobado' WHERE rol = 'admin';
UPDATE public.perfiles SET estado = 'aprobado' WHERE id IN (SELECT id FROM auth.users WHERE email = 'ceriraga@gmail.com');

-- Actualizar funciÃ³n del trigger para nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, estado)
  VALUES (new.id, 'cliente', 'pendiente');
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Si un administrador crea un usuario manualmente desde el dashboard de Supabase, 
-- este trigger se encargarÃ¡ de ponerlo en 'pendiente' por defecto.
-- Migration: Atomic Registration Trigger
-- This ensures every new Auth user gets a profile AND a client entry automatically.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.perfiles (id, rol, estado)
  VALUES (new.id, 'cliente', 'pendiente');

  -- 2. Create Client record using metadata from the sign-up form
  INSERT INTO public.clientes (
    auth_user_id,
    usuario,
    nombres,
    apellidos,
    nickname,
    whatsapp,
    pais,
    estado,
    fecha_registro
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombres', ''),
    COALESCE(new.raw_user_meta_data->>'apellidos', ''),
    new.raw_user_meta_data->>'nickname',
    new.raw_user_meta_data->>'whatsapp',
    COALESCE(new.raw_user_meta_data->>'pais', 'Venezuela'),
    COALESCE(new.raw_user_meta_data->>'estado', ''),
    NOW()
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-sync existing users that have no client record but are in auth.users
-- This is a one-time fix for the users created during the sync issue.
INSERT INTO public.clientes (auth_user_id, usuario, nombres, apellidos, fecha_registro)
SELECT id, email, split_part(email, '@', 1), 'Sync', NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.auth_user_id = u.id)
ON CONFLICT (usuario) DO NOTHING;
-- Migration: Add user avatars
-- 1. Add avatar_url column to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the Storage bucket for avatars (handles duplicate creation gracefully)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup Storage Policies for the avatars bucket
-- Allow public read access
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'avatars' );

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE
TO authenticated 
USING ( bucket_id = 'avatars' );

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE
TO authenticated 
USING ( bucket_id = 'avatars' );
-- Migration: LÃ³gica y almacenamiento para logos de juegos
-- OJO: La tabla 'juegos' ya cuenta con la columna 'icono_url'.
-- Este archivo crea un nuevo "bucket" (carpeta de almacenamiento) en Supabase 
-- llamado "logos" donde se subirÃ¡n las imÃ¡genes, y establece las 
-- polÃ­ticas de seguridad correspondientes.

-- 1. Crear el bucket "logos" si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar la seguridad de filas en el almacenamiento (si no estÃ¡ habilitado)
-- CREATE POLICY IF NOT EXISTS para buckets es un poco distinto, asÃ­ que usamos un bloque condicional.
DO $$
BEGIN
    -- Permitir lectura a todo el mundo (anÃ³nimo o logueado)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lectura pÃºblica de logos') THEN
        CREATE POLICY "Lectura pÃºblica de logos" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'logos');
    END IF;

    -- Permitir que CUALQUIER USUARIO AUTENTICADO pueda subir un logo
    -- (Es un panel de admin, todos los que inician sesiÃ³n son administradores por ahora en el dashboard final)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden subir logos') THEN
        CREATE POLICY "Autenticados pueden subir logos" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'logos');
    END IF;

    -- Permitir que los autenticados puedan actualizar sus subidas (o cualquiera en el bucket de logos)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden modificar logos') THEN
        CREATE POLICY "Autenticados pueden modificar logos" 
        ON storage.objects FOR UPDATE 
        TO authenticated 
        USING (bucket_id = 'logos');
    END IF;

    -- Permitir eliminar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden borrar logos') THEN
        CREATE POLICY "Autenticados pueden borrar logos" 
        ON storage.objects FOR DELETE 
        TO authenticated 
        USING (bucket_id = 'logos');
    END IF;
END $$;
-- AÃ±adir columna icono_url a la tabla productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS icono_url TEXT;
-- 1. Crear tabla para los mensajes de soporte
CREATE TABLE IF NOT EXISTS soporte_mensajes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE, -- ID del perfil del cliente (sala de chat)
  remitente_id UUID REFERENCES clientes(id) ON DELETE CASCADE, -- Perfil de quien envÃ­a (puede ser admin o el mismo cliente)
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Row Level Security
ALTER TABLE soporte_mensajes ENABLE ROW LEVEL SECURITY;

-- 3. PolÃ­ticas de Seguridad (RLS)

-- Los administradores pueden ver todos los mensajes
CREATE POLICY "Admins pueden ver todos los chats" ON soporte_mensajes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes solo pueden ver los mensajes de su propio chat (donde cliente_id es su perfil)
CREATE POLICY "Clientes pueden ver su propio chat" ON soporte_mensajes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Los administradores pueden enviar mensajes a cualquier chat
CREATE POLICY "Admins pueden enviar mensajes" ON soporte_mensajes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes solo pueden enviar mensajes a su propio chat
CREATE POLICY "Clientes pueden enviar a su propio chat" ON soporte_mensajes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Los admins pueden actualizar mensajes (para marcarlos como leÃ­dos)
CREATE POLICY "Admins pueden actualizar mensajes" ON soporte_mensajes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.rol = 'admin'
    )
  );

-- Los clientes pueden actualizar mensajes en su chat (para marcarlos como leÃ­dos)
CREATE POLICY "Clientes pueden actualizar sus mensajes" ON soporte_mensajes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clientes c 
      WHERE c.auth_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
    )
  );

-- Permitir suscripciones realtime para esta tabla
-- Nota: Supabase bloquea replication para nuevas tablas por defecto
alter publication supabase_realtime add table soporte_mensajes;
-- Migration: Add cliente_id to ventas and update RPC
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

-- Update RPC to support cliente_id
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                              - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Tabla para mÃ©todos de pago
CREATE TABLE IF NOT EXISTS public.metodos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    datos TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas: Todos pueden ver mÃ©todos activos, solo admin puede editar
CREATE POLICY "MÃ©todos de pago visibles para todos" ON public.metodos_pago
    FOR SELECT USING (true);

CREATE POLICY "Admin gestiona mÃ©todos de pago" ON public.metodos_pago
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE auth_user_id = auth.uid() AND rol = 'admin'
        )
    );
-- ============================================
-- TABLA: Pedidos del sistema de recargas
-- ============================================

-- Tabla principal de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    numero_pedido VARCHAR(10) NOT NULL UNIQUE,
    cliente_id UUID REFERENCES auth.users(id),
    metodo_pago_id UUID REFERENCES public.metodos_pago(id),
    referencia_pago TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente',
    total_usd NUMERIC DEFAULT 0,
    total_bs NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas'),
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas')
);

-- Detalle de cada item del pedido
CREATE TABLE IF NOT EXISTS pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id),
    juego_nombre TEXT NOT NULL,
    producto_nombre TEXT NOT NULL,
    cantidad INT DEFAULT 1,
    precio_usd NUMERIC NOT NULL,
    precio_bs NUMERIC NOT NULL,
    metodo_recarga VARCHAR(50),
    player_id TEXT,
    account_email TEXT,
    account_password TEXT
);

-- Secuencia para pedidos con formato #000001
CREATE SEQUENCE IF NOT EXISTS pedido_seq START WITH 1 INCREMENT BY 1;

-- FunciÃ³n para generar nÃºmero de pedido automÃ¡ticamente
CREATE OR REPLACE FUNCTION generar_numero_pedido()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero_pedido := LPAD(nextval('pedido_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_numero_pedido ON pedidos;
CREATE TRIGGER trig_numero_pedido
BEFORE INSERT ON pedidos
FOR EACH ROW EXECUTE FUNCTION generar_numero_pedido();

-- RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON pedido_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recargar cachÃ©
NOTIFY pgrst, 'reload schema';
-- AÃ±adir soporte para mÃ©todos de pago en ventas
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS metodo_pago_id UUID REFERENCES public.metodos_pago(id);
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS referencia_pago TEXT;

-- Actualizar RPC para incluir estos campos
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, metodo_pago_id, referencia_pago
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id, p_metodo_pago_id, p_referencia_pago
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- AÃ±adir mÃ©todo de recarga a juegos
ALTER TABLE public.juegos ADD COLUMN IF NOT EXISTS metodo_recarga VARCHAR(50) DEFAULT 'id_jugador';
-- id_jugador: Requiere ID del jugador
-- cuenta_completa: Requiere Correo y Clave
-- AÃ±adir campos de recarga a ventas
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS account_email TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS account_password TEXT;

-- Actualizar RPC
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, metodo_pago_id, referencia_pago,
        player_id, account_email, account_password
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id, p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 1. AÃ±adir campo de texto a la tabla de configuraciÃ³n
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS valor_texto TEXT;

-- 2. Insertar la nueva clave para el favicon
INSERT INTO configuracion (clave, valor, valor_texto, descripcion) 
VALUES ('favicon_url', 0, '', 'URL del Favicon del sistema')
ON CONFLICT (clave) DO NOTHING;
-- Add a column to mark automated system messages in support chat
ALTER TABLE soporte_mensajes
ADD COLUMN IF NOT EXISTS es_sistema BOOLEAN DEFAULT false;

-- Notify pgrst to reload schema cache
NOTIFY pgrst, 'reload schema';
-- 18. migration: 018_support_chat_replies.sql
-- Add support for message quoting (replies) in support chat.

ALTER TABLE soporte_mensajes 
ADD COLUMN IF NOT EXISTS quoted_id UUID REFERENCES soporte_mensajes(id);

-- Notify pgrst to reload schema cache to reflect the new column
NOTIFY pgrst, 'reload schema';
-- 20. Crear bucket 'soporte_archivos' y sus polÃ­ticas de seguridad

-- 1. Crear el bucket pÃºblico si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('soporte_archivos', 'soporte_archivos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que cualquier persona pueda VER/LEER los archivos pÃºblicos
CREATE POLICY "Acceso PÃºblico a soporte_archivos" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'soporte_archivos' );

-- 3. Permitir que los usuarios autenticados PUEDAN SUBIR archivos
CREATE POLICY "Usuarios autenticados pueden subir archivos" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'soporte_archivos' AND auth.role() = 'authenticated' );

-- 4. Permitir que los usuarios autenticados PUEDAN BORRAR sus propios archivos
CREATE POLICY "Usuarios autenticados pueden borrar sus archivos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'soporte_archivos' AND auth.uid() = owner );
-- Migration 021: Add support status to 'clientes' table for chat categorization
ALTER TABLE IF EXISTS public.clientes 
ADD COLUMN IF NOT EXISTS soporte_status TEXT CHECK (soporte_status IN ('resuelto', 'pendiente', 'critico'));

-- Index for performance when filtering chats by status
CREATE INDEX IF NOT EXISTS idx_clientes_soporte_status ON public.clientes(soporte_status);
-- Migration 022: Add timestamp to track when support status was last changed
ALTER TABLE IF EXISTS public.clientes 
ADD COLUMN IF NOT EXISTS soporte_status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have a timestamp if they have a status
UPDATE public.clientes 
SET soporte_status_changed_at = NOW() 
WHERE soporte_status IS NOT NULL;
-- Migration: 023_wallet_system.sql
-- Description: Digital Wallet system for balances, recharges, and transactions

-- 1. Table for Balances
CREATE TABLE IF NOT EXISTS public.billeteras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_billeteras_auth_user_id ON public.billeteras(auth_user_id);

-- 2. Table for Recharge Requests
CREATE TABLE IF NOT EXISTS public.billetera_recargas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL,
    metodo_pago_id UUID NOT NULL REFERENCES public.metodos_pago(id),
    referencia TEXT NOT NULL,
    comprobante_url TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    notas_admin TEXT,
    atendido_por_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table for Transaction History (Audit)
CREATE TABLE IF NOT EXISTS public.billetera_transacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL, -- Positive for credit, negative for debit
    tipo TEXT NOT NULL CHECK (tipo IN ('recarga', 'pago_pedido', 'ajuste_admin', 'reembolso')),
    descripcion TEXT,
    referencia_id UUID, -- Can be id from billetera_recargas or pedidos
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS (Row Level Security)
ALTER TABLE public.billeteras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billetera_recargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billetera_transacciones ENABLE ROW LEVEL SECURITY;

-- Policies for billeteras
CREATE POLICY "Users can view their own wallet" ON public.billeteras
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all wallets" ON public.billeteras
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Policies for billetera_recargas
CREATE POLICY "Users can view and create their own recharges" ON public.billetera_recargas
    FOR ALL USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view and manage all recharges" ON public.billetera_recargas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Policies for billetera_transacciones
CREATE POLICY "Users can view their own transactions" ON public.billetera_transacciones
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all transactions" ON public.billetera_transacciones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 5. RPC (Stored Procedures) for atomic operations

-- Function to approve a recharge safely
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
BEGIN
    -- 1. Check if recharge is pending
    SELECT auth_user_id, monto INTO v_user_id, v_amount
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado',
        atendido_por_id = p_admin_id,
        notas_admin = p_notas,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- 3. Update or Insert wallet balance
    INSERT INTO public.billeteras (auth_user_id, saldo)
    VALUES (v_user_id, v_amount)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();

    -- 4. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to pay with wallet balance safely
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- 1. Fetch current balance with lock
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- 2. Deduct amount
    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 3. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.billeteras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.billetera_recargas;
-- ============================================
-- MigraciÃ³n 024: Descuentos de Revendedores
-- ============================================

-- Agregar campo descuento_revendedor a tabla juegos
-- Representa el descuento global (%) del revendedor para ese servicio
ALTER TABLE juegos ADD COLUMN IF NOT EXISTS descuento_revendedor NUMERIC DEFAULT 0;

-- Agregar campo descuento_revendedor a tabla productos 
-- Representa el descuento local (%) para ese producto (NULL ignora, usa el del juego)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento_revendedor NUMERIC DEFAULT NULL;

-- Aseguramos que el esquema se recargue
NOTIFY pgrst, 'reload schema';
-- ============================================
-- MigraciÃ³n 025: Soporte para rol "revendedor"
-- ============================================

-- 1. Eliminar el CHECK constraint del campo rol para permitir 'revendedor'
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2. AÃ±adir nuevamente el constraint con 'revendedor' incluido
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_rol_check 
CHECK (rol IN ('admin', 'cliente', 'revendedor'));

-- 3. Agregar columna porcentaje_descuento si no existe
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS porcentaje_descuento NUMERIC DEFAULT 0;

-- 4. Agregar estado extendido (suspendido y baneado) si aÃºn tiene el check restrictivo
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_estado_check;
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_estado_check 
CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'suspendido', 'baneado'));

-- Recargar el schema cache
NOTIFY pgrst, 'reload schema';
-- ============================================
-- MigraciÃ³n 026: Agregar account_user a pedido_items
-- ============================================

ALTER TABLE public.pedido_items 
ADD COLUMN IF NOT EXISTS account_user TEXT;

-- Recargar el schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 027_reembolsar_pedido_rpc.sql
-- Description: RPC function to refund an order back to the client's wallet

CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
BEGIN
    -- 1. Fetch the order and validate
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- 2. Prevent double refund
    IF v_pedido.estado = 'reembolsado' THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 3. Ensure the client has a wallet, create one if not
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_pedido.cliente_id, 0);
    END IF;

    -- 4. Credit the refund amount (in USD) to the client's wallet
    UPDATE public.billeteras
    SET saldo = saldo + v_pedido.total_usd,
        updated_at = now()
    WHERE auth_user_id = v_pedido.cliente_id;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (
        v_pedido.cliente_id,
        v_pedido.total_usd,
        'reembolso',
        COALESCE(p_notas, 'Reembolso de pedido #' || v_pedido.id::TEXT),
        NULL  -- referencia_id is UUID, pedido id is INT so we skip
    );

    -- 6. Update the order status
    UPDATE public.pedidos
    SET estado = 'reembolsado',
        atendido_por_id = p_admin_id,
        fecha_respuesta = now(),
        updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_pedido.total_usd);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache so PostgREST picks up the new function
NOTIFY pgrst, 'reload schema';
-- Migration: 028_billetera_bs.sql
-- Description: Add BolÃ­vares (Bs) wallet support alongside existing USD wallet

-- =========================================================
-- 1. Add saldo_bs column to billeteras
-- =========================================================
ALTER TABLE public.billeteras
ADD COLUMN IF NOT EXISTS saldo_bs NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- =========================================================
-- 2. Add moneda column to billetera_recargas
-- =========================================================
ALTER TABLE public.billetera_recargas
ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'usd'
CHECK (moneda IN ('usd', 'bs'));

-- =========================================================
-- 3. Add moneda column to billetera_transacciones
-- =========================================================
ALTER TABLE public.billetera_transacciones
ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'usd'
CHECK (moneda IN ('usd', 'bs'));

-- =========================================================
-- 3b. Add visibility columns to metodos_pago
-- =========================================================
ALTER TABLE public.metodos_pago
ADD COLUMN IF NOT EXISTS habilitado_billetera BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS habilitado_billetera_bs BOOLEAN DEFAULT false;

-- =========================================================
-- 4. Update aprobar_recarga_rpc to support currency
-- =========================================================
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
BEGIN
    -- 1. Check if recharge is pending
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd')
    INTO v_user_id, v_amount, v_moneda
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Mark as approved
    UPDATE public.billetera_recargas
    SET estado = 'aprobado',
        atendido_por_id = p_admin_id,
        notas_admin = p_notas,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- 3. Update or Insert wallet balance based on currency
    IF v_moneda = 'bs' THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_user_id, 0, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo_bs = public.billeteras.saldo_bs + v_amount, updated_at = now();
    ELSE
        INSERT INTO public.billeteras (auth_user_id, saldo)
        VALUES (v_user_id, v_amount)
        ON CONFLICT (auth_user_id)
        DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();
    END IF;

    -- 4. Log Transaction with currency
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 5. Update reembolsar_pedido_rpc with p_moneda parameter
-- =========================================================
CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd'
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
    v_refund_amount NUMERIC;
BEGIN
    -- 1. Fetch the order
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    IF v_pedido.estado = 'reembolsado' THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 2. Determine refund amount based on currency
    IF p_moneda = 'bs' THEN
        v_refund_amount := ROUND(v_pedido.total_bs);
    ELSE
        v_refund_amount := v_pedido.total_usd;
    END IF;

    -- 3. Ensure wallet exists
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_pedido.cliente_id, 0, 0);
    END IF;

    -- 4. Credit the appropriate wallet
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = saldo_bs + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = saldo + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    END IF;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso de pedido #' || v_pedido.id::TEXT),
        NULL,
        p_moneda
    );

    -- 6. Update order status
    UPDATE public.pedidos
    SET estado = 'reembolsado',
        atendido_por_id = p_admin_id,
        fecha_respuesta = now(),
        updated_at = now()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 6. Create pagar_con_billetera_bs_rpc for Bs payments
-- =========================================================
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 7. Create ajustar_saldo_billetera_bs_rpc for admin adjustments
-- =========================================================
CREATE OR REPLACE FUNCTION public.ajustar_saldo_billetera_bs_rpc(
    p_user_id UUID,
    p_admin_id UUID,
    p_nuevo_saldo NUMERIC,
    p_nota TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_balance NUMERIC;
    v_diff NUMERIC;
BEGIN
    -- Ensure wallet exists
    INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT saldo_bs INTO v_old_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    v_diff := p_nuevo_saldo - COALESCE(v_old_balance, 0);

    UPDATE public.billeteras
    SET saldo_bs = p_nuevo_saldo, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        p_user_id,
        v_diff,
        'ajuste_admin',
        COALESCE(p_nota, 'Ajuste administrativo de saldo Bs'),
        NULL,
        'bs'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 8. Update revertir_recarga_rpc to handle currency
-- =========================================================
CREATE OR REPLACE FUNCTION public.revertir_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_moneda TEXT;
BEGIN
    SELECT auth_user_id, monto, COALESCE(moneda, 'usd')
    INTO v_user_id, v_amount, v_moneda
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'aprobado';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Mark as reverted
    UPDATE public.billetera_recargas
    SET estado = 'rechazado',
        notas_admin = 'Revertido por administrador',
        atendido_por_id = p_admin_id,
        updated_at = now()
    WHERE id = p_recarga_id;

    -- Deduct from appropriate balance
    IF v_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = GREATEST(saldo_bs - v_amount, 0), updated_at = now()
        WHERE auth_user_id = v_user_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = GREATEST(saldo - v_amount, 0), updated_at = now()
        WHERE auth_user_id = v_user_id;
    END IF;

    -- Log reversal
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (v_user_id, -v_amount, 'ajuste_admin', 'ReversiÃ³n de recarga', p_recarga_id, v_moneda);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 029_multi_admin_support.sql
-- Description: Add support for isolated admin sales (vendedor_id in ventas)
-- Note: pedidos.atendido_por_id already exists (references auth.users), we don't touch it.
-- Only ventas.vendedor_id is new, linking to public.clientes for easy name resolution.

-- ============================================================
-- 1. AÃ±adir vendedor_id a VENTAS (referencia a public.clientes)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'vendedor_id'
    ) THEN
        ALTER TABLE public.ventas ADD COLUMN vendedor_id UUID REFERENCES public.clientes(id);
    END IF;
END $$;

-- ============================================================
-- 2. Actualizar funciÃ³n RPC registrar_venta_rpc para aceptar vendedor_id
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa segÃºn tipo de juego
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                              - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. RLS para aislar las VENTAS por vendedor (admin que la registrÃ³)
--    Cada admin solo puede ver sus propias ventas.
--    Se usa auth.uid() contra perfiles para hallar el cliente_uuid del admin.
-- ============================================================
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;
CREATE POLICY "Admins see only their own sales" ON public.ventas
    FOR ALL USING (
        -- Admin solo ve ventas donde vendedor_id = su propio ID en tabla clientes
        -- O ventas antiguas donde vendedor_id es NULL (visibles para todos los admins)
        EXISTS (
            SELECT 1 FROM public.perfiles p
            JOIN public.clientes c ON c.auth_user_id = p.id
            WHERE p.id = auth.uid() AND p.rol = 'admin'
            AND (c.id = vendedor_id OR vendedor_id IS NULL)
        )
    );

-- ============================================================
-- 4. RLS de PEDIDOS â€” sin tocar atendido_por_id (ya es auth.users FK)
-- ============================================================
DROP POLICY IF EXISTS "auth_all" ON public.pedidos;

DROP POLICY IF EXISTS "Admins manage all orders" ON public.pedidos;
CREATE POLICY "Admins manage all orders" ON public.pedidos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Clients view their own orders" ON public.pedidos;
CREATE POLICY "Clients view their own orders" ON public.pedidos
    FOR SELECT USING (cliente_id = auth.uid());

-- Notificar recarga de cachÃ©
NOTIFY pgrst, 'reload schema';
-- Agregar limite de usos globales por usuario y frecuencia de uso
ALTER TABLE IF EXISTS public.cupones
ADD COLUMN IF NOT EXISTS limite_usos_por_usuario integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS frecuencia_uso varchar(20) DEFAULT 'unico';

-- Opcionalmente, agregar una restricciÃ³n CHECK en frecuencia_uso para que solo admita valores conocidos
-- ALTER TABLE public.cupones ADD CONSTRAINT chk_frecuencia_uso CHECK (frecuencia_uso IN ('unico', '24h', 'semanal', 'mensual', 'ilimitado'));
-- ============================================
-- TABLA: Modificaciones para el Sistema Cashback
-- ============================================

-- 1. Insertar configuraciÃ³n por defecto para cashback si no existe
INSERT INTO configuracion (clave, valor, valor_texto)
VALUES ('cashback_activo', 0, 'false')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO configuracion (clave, valor)
VALUES ('cashback_porcentaje', '0.0')
ON CONFLICT (clave) DO NOTHING;

-- 2. AÃ±adir columna cashback_aplicado en la tabla pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS cashback_aplicado BOOLEAN DEFAULT FALSE;

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
-- ============================================
-- TABLA: Modificaciones para el Sistema Cashback Detalles
-- ============================================

-- AÃ±adir columnas para almacenar los detalles exactos del cashback aplicado
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS cashback_monto NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_moneda TEXT,
ADD COLUMN IF NOT EXISTS cashback_porcentaje NUMERIC DEFAULT 0;

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- MigraciÃ³n 033: ValidaciÃ³n robusta de lÃ­mites de cupÃ³n por usuario
-- Usa pg_advisory_xact_lock para evitar condiciones de carrera
-- cuando mÃºltiples sesiones intentan usar el mismo cupÃ³n simultÃ¡neamente.
-- ============================================================

-- FunciÃ³n con advisory lock para serializar accesos concurrentes
CREATE OR REPLACE FUNCTION check_cupon_uso_por_usuario()
RETURNS TRIGGER LANGUAGE plpgsql AS $func$
DECLARE
  v_limite integer;
  v_freq varchar(20);
  v_count integer;
  v_last timestamptz;
  v_hours float;
BEGIN
  -- Advisory lock: serializa intentos concurrentes del mismo (cupon, usuario)
  -- Evita race conditions donde dos transacciones leen count=0 simultÃ¡neamente
  PERFORM pg_advisory_xact_lock(hashtext(NEW.cupon_id::text || '|' || NEW.cliente_id::text));

  SELECT limite_usos_por_usuario, frecuencia_uso
  INTO v_limite, v_freq
  FROM public.cupones WHERE id = NEW.cupon_id;

  -- Sin restricciones = permitir siempre
  IF v_limite IS NULL AND (v_freq IS NULL OR v_freq = 'ilimitado') THEN
    RETURN NEW;
  END IF;

  -- Contar usos anteriores (ahora es seguro por el advisory lock)
  SELECT COUNT(*), MAX(created_at) INTO v_count, v_last
  FROM public.cupones_usados
  WHERE cupon_id = NEW.cupon_id AND cliente_id = NEW.cliente_id;

  -- Verificar lÃ­mite total por usuario
  IF v_limite IS NOT NULL AND v_count >= v_limite THEN
    RAISE EXCEPTION 'Limite de usos por usuario alcanzado: %', v_limite;
  END IF;

  -- Verificar cupÃ³n de uso Ãºnico (sin importar cuÃ¡ndo fue el Ãºltimo uso)
  IF v_freq = 'unico' AND v_count > 0 THEN
    RAISE EXCEPTION 'Cupon de uso unico ya fue utilizado por este usuario';
  END IF;

  -- Verificar frecuencias temporales
  IF v_last IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (NOW() - v_last)) / 3600.0;
    IF v_freq = '24h' AND v_hours < 24 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    ELSIF v_freq = 'semanal' AND v_hours < 168 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    ELSIF v_freq = 'mensual' AND v_hours < 720 THEN
      RAISE EXCEPTION 'Debes esperar antes de usar este cupon de nuevo';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Trigger BEFORE INSERT en cupones_usados
DROP TRIGGER IF EXISTS trg_check_cupon_uso ON public.cupones_usados;
CREATE TRIGGER trg_check_cupon_uso
  BEFORE INSERT ON public.cupones_usados
  FOR EACH ROW
  EXECUTE FUNCTION check_cupon_uso_por_usuario();
-- MigraciÃ³n 034: Hacer pedido_id nullable en cupones_usados
-- Esto permite pre-insertar el uso del cupÃ³n ANTES de crear el pedido,
-- lo que activa el trigger de validaciÃ³n ANTES de que el pedido exista.
-- Si el pedido falla despuÃ©s, el registro de cupÃ³n se elimina (cleanup en JS).
ALTER TABLE public.cupones_usados ALTER COLUMN pedido_id DROP NOT NULL;
-- ============================================================
-- MigraciÃ³n 035: Sistema de Ruleta de Premios
-- ============================================================

-- 1. Premios configurables por el admin
CREATE TABLE IF NOT EXISTS public.ruleta_premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'mensaje', -- 'saldo_usd' | 'saldo_bs' | 'mensaje' | 'sin_premio'
  valor numeric DEFAULT 0,
  probabilidad integer NOT NULL DEFAULT 10, -- peso relativo (1-100)
  color text NOT NULL DEFAULT '#6366f1',
  emoji text DEFAULT 'ðŸŽ',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Historial de giros realizados
CREATE TABLE IF NOT EXISTS public.ruleta_giros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  premio_id uuid REFERENCES public.ruleta_premios(id),
  premio_nombre text NOT NULL,
  tipo text NOT NULL,
  valor numeric DEFAULT 0,
  acreditado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Giros disponibles por usuario (acumulables)
CREATE TABLE IF NOT EXISTS public.ruleta_giros_disponibles (
  cliente_id uuid PRIMARY KEY REFERENCES auth.users(id),
  giros_disponibles integer NOT NULL DEFAULT 0,
  total_ganados integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 4. Config de la ruleta en tabla de configuraciÃ³n existente
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS ruleta_activa text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS ruleta_titulo text DEFAULT 'Â¡Gira y Gana!',
  ADD COLUMN IF NOT EXISTS ruleta_descripcion text DEFAULT 'Cada pedido completado te da un giro. Â¡Prueba tu suerte!';

-- 5. RLS
ALTER TABLE public.ruleta_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruleta_giros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruleta_giros_disponibles ENABLE ROW LEVEL SECURITY;

-- Premios: todos los autenticados pueden leer los activos
CREATE POLICY IF NOT EXISTS "premios_select_activos" ON public.ruleta_premios
  FOR SELECT USING (activo = true);

-- Premios: solo admins pueden modificar
CREATE POLICY IF NOT EXISTS "premios_admin_all" ON public.ruleta_premios
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Giros historial: usuario ve los suyos
CREATE POLICY IF NOT EXISTS "giros_select_own" ON public.ruleta_giros
  FOR SELECT USING (cliente_id = auth.uid());

-- Giros historial: admin ve todos
CREATE POLICY IF NOT EXISTS "giros_select_admin" ON public.ruleta_giros
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Giros disponibles: usuario ve los suyos
CREATE POLICY IF NOT EXISTS "giros_disp_select_own" ON public.ruleta_giros_disponibles
  FOR SELECT USING (cliente_id = auth.uid());

-- Giros disponibles: admin ve y modifica todos
CREATE POLICY IF NOT EXISTS "giros_disp_admin_all" ON public.ruleta_giros_disponibles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- 6. Trigger: auto-asignar 1 giro cuando pedido â†’ completado
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_asignar_giro_por_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo cuando el estado cambia A 'completado' y el cliente existe
  IF NEW.estado = 'completado' AND (OLD.estado IS DISTINCT FROM 'completado') AND NEW.cliente_id IS NOT NULL THEN
    INSERT INTO public.ruleta_giros_disponibles (cliente_id, giros_disponibles, total_ganados)
    VALUES (NEW.cliente_id, 1, 1)
    ON CONFLICT (cliente_id) DO UPDATE
    SET giros_disponibles = ruleta_giros_disponibles.giros_disponibles + 1,
        total_ganados = ruleta_giros_disponibles.total_ganados + 1,
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_asignar_giro ON public.pedidos;
CREATE TRIGGER trg_auto_asignar_giro
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_asignar_giro_por_pedido();

-- ============================================================
-- 7. RPC: girar_ruleta â€” server-side, anti-trampas
-- ============================================================
CREATE OR REPLACE FUNCTION public.girar_ruleta(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_giros integer;
  v_total_prob float;
  v_rand float;
  v_acum float := 0;
  v_premio record;
  v_giro_id uuid;
BEGIN
  -- Lock row para evitar giros simultÃ¡neos (race condition)
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  -- Verificar que haya premios activos
  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios WHERE activo = true;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios configurados. Contacta al administrador.');
  END IF;

  -- SelecciÃ³n aleatoria ponderada
  v_rand := random() * v_total_prob;
  FOR v_premio IN
    SELECT * FROM public.ruleta_premios WHERE activo = true ORDER BY created_at
  LOOP
    v_acum := v_acum + v_premio.probabilidad;
    IF v_rand <= v_acum THEN EXIT; END IF;
  END LOOP;

  -- Descontar 1 giro
  UPDATE public.ruleta_giros_disponibles
  SET giros_disponibles = giros_disponibles - 1, updated_at = now()
  WHERE cliente_id = p_cliente_id;

  -- Registrar el giro
  INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor)
  VALUES (p_cliente_id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor)
  RETURNING id INTO v_giro_id;

  -- Acreditar saldo si aplica
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    UPDATE public.billetera
    SET saldo = saldo + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    UPDATE public.billetera
    SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  END IF;

  RETURN jsonb_build_object(
    'premio_id',          v_premio.id,
    'premio_nombre',      v_premio.nombre,
    'premio_descripcion', COALESCE(v_premio.descripcion, ''),
    'tipo',               v_premio.tipo,
    'valor',              v_premio.valor,
    'color',              v_premio.color,
    'emoji',              COALESCE(v_premio.emoji, 'ðŸŽ'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
-- ============================================================
-- MigraciÃ³n 036: Descuentos de Ruleta almacenados por usuario
-- ============================================================

-- Tabla para guardar descuentos ganados pendientes de uso
CREATE TABLE IF NOT EXISTS public.ruleta_descuentos_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id),
  giro_id uuid REFERENCES public.ruleta_giros(id),
  porcentaje numeric NOT NULL,
  nombre text NOT NULL,
  usado boolean DEFAULT false,
  pedido_id uuid REFERENCES public.pedidos(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ruleta_descuentos_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rdp_own_select" ON public.ruleta_descuentos_pendientes
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "rdp_own_update" ON public.ruleta_descuentos_pendientes
  FOR UPDATE USING (cliente_id = auth.uid());

CREATE POLICY "rdp_admin_all" ON public.ruleta_descuentos_pendientes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- Actualizar girar_ruleta para manejar tipo 'descuento'
-- (saldo_usd y saldo_bs se acreditan al instante,
--  descuento se almacena para que el usuario lo aplique luego)
-- ============================================================
CREATE OR REPLACE FUNCTION public.girar_ruleta(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_giros integer;
  v_total_prob float;
  v_rand float;
  v_acum float := 0;
  v_premio record;
  v_giro_id uuid;
BEGIN
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios WHERE activo = true;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios configurados');
  END IF;

  v_rand := random() * v_total_prob;
  FOR v_premio IN SELECT * FROM public.ruleta_premios WHERE activo = true ORDER BY created_at LOOP
    v_acum := v_acum + v_premio.probabilidad;
    IF v_rand <= v_acum THEN EXIT; END IF;
  END LOOP;

  UPDATE public.ruleta_giros_disponibles
  SET giros_disponibles = giros_disponibles - 1, updated_at = now()
  WHERE cliente_id = p_cliente_id;

  INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor)
  VALUES (p_cliente_id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor)
  RETURNING id INTO v_giro_id;

  -- Aplicar premio segÃºn tipo
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo = saldo + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
    -- Almacenar descuento para que el usuario lo aplique cuando quiera
    INSERT INTO public.ruleta_descuentos_pendientes (cliente_id, giro_id, porcentaje, nombre)
    VALUES (p_cliente_id, v_giro_id, v_premio.valor, v_premio.nombre);
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  END IF;

  RETURN jsonb_build_object(
    'premio_id',          v_premio.id,
    'premio_nombre',      v_premio.nombre,
    'premio_descripcion', COALESCE(v_premio.descripcion, ''),
    'tipo',               v_premio.tipo,
    'valor',              v_premio.valor,
    'color',              v_premio.color,
    'emoji',              COALESCE(v_premio.emoji, 'gift'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'descuento_guardado', (v_premio.tipo = 'descuento' AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
-- ============================================================
-- MigraciÃ³n 037: Limpieza de descuentos automÃ¡ticos en perfiles
-- ============================================================

-- Los descuentos de la ruleta antes se guardaban en la columna 
-- 'porcentaje_descuento' de la tabla 'perfiles'. 
-- Para activar el nuevo sistema manual (cupones), debemos limpiar 
-- esa columna para usuarios que NO son revendedores oficiales.

UPDATE public.perfiles 
SET porcentaje_descuento = 0 
WHERE LOWER(rol) != 'revendedor';

-- Nota: Si un usuario era revendedor y ganÃ³ un descuento, se mantendrÃ¡
-- su descuento de revendedor base. Los descuentos de ruleta ahora
-- irÃ¡n por la tabla ruleta_descuentos_pendientes.
-- ============================================================
-- MigraciÃ³n 038: DiagnÃ³stico de Visibilidad de Descuentos
-- ============================================================

-- 1. Asegurar que las polÃ­ticas de RLS permiten ver los propios descuentos
-- incluso si el administrador estÃ¡ en modo "suplantaciÃ³n" o similar.
DROP POLICY IF EXISTS "rdp_own_select" ON public.ruleta_descuentos_pendientes;
CREATE POLICY "rdp_own_select" ON public.ruleta_descuentos_pendientes
  FOR SELECT USING (cliente_id = auth.uid());

-- 2. Asegurar que los admins pueden ver TODOS los descuentos para soporte tÃ©cnico
DROP POLICY IF EXISTS "rdp_admin_all" ON public.ruleta_descuentos_pendientes;
CREATE POLICY "rdp_admin_all" ON public.ruleta_descuentos_pendientes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 3. FunciÃ³n de diagnÃ³stico: Â¿QuÃ© UUID tiene mi sesiÃ³n actual?
-- Ãštil para comparar con el cliente_id de ruleta_descuentos_pendientes
CREATE OR REPLACE FUNCTION public.check_my_id()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN auth.uid();
END;
$$;
-- ============================================================
-- MigraciÃ³n 039: FunciÃ³n para Regalos Masivos de la Ruleta
-- ============================================================

CREATE OR REPLACE FUNCTION public.regalar_premio_masivo(p_premio_id uuid, p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_premio record;
  v_count integer := 0;
  v_cliente record;
  v_giro_id uuid;
BEGIN
  -- 1. Verificar que el que llama es admin (seguridad extra)
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = p_admin_id AND LOWER(rol) = 'admin') THEN
    RETURN jsonb_build_object('error', 'No tienes permisos de administrador');
  END IF;

  -- 2. Obtener datos del premio
  SELECT * INTO v_premio FROM public.ruleta_premios WHERE id = p_premio_id;
  IF v_premio IS NULL THEN
    RETURN jsonb_build_object('error', 'Premio no encontrado');
  END IF;

  -- 3. Iterar por todos los clientes y revendedores activos
  FOR v_cliente IN 
    SELECT id FROM public.perfiles 
    WHERE LOWER(rol) IN ('cliente', 'revendedor')
  LOOP
    -- Registrar el giro en el historial (marcado como regalo)
    INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor, acreditado)
    VALUES (v_cliente.id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor, true)
    RETURNING id INTO v_giro_id;

    -- Aplicar el premio segÃºn el tipo
    IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
      UPDATE public.billetera SET saldo = saldo + v_premio.valor WHERE cliente_id = v_cliente.id;
    ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
      UPDATE public.billetera SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = v_cliente.id;
    ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
      -- Se guarda como descuento pendiente para que lo usen en el checkout cuando quieran
      INSERT INTO public.ruleta_descuentos_pendientes (cliente_id, giro_id, porcentaje, nombre)
      VALUES (v_cliente.id, v_giro_id, v_premio.valor, v_premio.nombre);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'usuarios_afectados', v_count, 'premio', v_premio.nombre);
END;
$$;
-- ============================================================
-- MigraciÃ³n 040: CorrecciÃ³n de RLS para AdministraciÃ³n
-- ============================================================

-- 1. Permitir que los administradores inserten registros en el historial de otros
CREATE POLICY "giros_admin_all" ON public.ruleta_giros
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 2. Asegurar que los admins puedan ver y modificar giros disponibles de todos
DROP POLICY IF EXISTS "giros_disp_admin_all" ON public.ruleta_giros_disponibles;
CREATE POLICY "giros_disp_admin_all" ON public.ruleta_giros_disponibles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND LOWER(rol) = 'admin'
    )
  );

-- 3. Asegurar que los admins puedan gestionar cualquier billetera (Saldo USD/Bs)
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.billeteras;
CREATE POLICY "Admins can view and manage all wallets" ON public.billeteras
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND LOWER(rol) = 'admin'
        )
    );

-- 4. Recargar cachÃ© de esquema
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- MigraciÃ³n 041: CorrecciÃ³n de lÃ³gica de selecciÃ³n de premios
-- ============================================================

CREATE OR REPLACE FUNCTION public.girar_ruleta(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_giros integer;
  v_total_prob float;
  v_rand float;
  v_acum float := 0;
  v_premio record;
  v_giro_id uuid;
BEGIN
  -- Lock row para evitar giros simultÃ¡neos
  SELECT giros_disponibles INTO v_giros
  FROM public.ruleta_giros_disponibles
  WHERE cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_giros IS NULL OR v_giros <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes giros disponibles');
  END IF;

  -- Verificar que haya premios activos con probabilidad real
  SELECT COALESCE(SUM(probabilidad::float), 0) INTO v_total_prob
  FROM public.ruleta_premios 
  WHERE activo = true AND probabilidad > 0;

  IF v_total_prob = 0 THEN
    RETURN jsonb_build_object('error', 'No hay premios con probabilidad configurados.');
  END IF;

  -- SelecciÃ³n aleatoria ponderada (excluyendo probabilidad 0)
  v_rand := random() * v_total_prob;
  FOR v_premio IN
    SELECT * FROM public.ruleta_premios 
    WHERE activo = true AND probabilidad > 0 
    ORDER BY created_at
  LOOP
    v_acum := v_acum + v_premio.probabilidad;
    -- Usamos < para evitar el borde de 0 si v_rand es exactamente 0
    IF v_rand <= v_acum THEN EXIT; END IF;
  END LOOP;

  -- Descontar 1 giro
  UPDATE public.ruleta_giros_disponibles
  SET giros_disponibles = giros_disponibles - 1, updated_at = now()
  WHERE cliente_id = p_cliente_id;

  -- Registrar el giro
  INSERT INTO public.ruleta_giros (cliente_id, premio_id, premio_nombre, tipo, valor)
  VALUES (p_cliente_id, v_premio.id, v_premio.nombre, v_premio.tipo, v_premio.valor)
  RETURNING id INTO v_giro_id;

  -- Acreditar premio segÃºn tipo
  IF v_premio.tipo = 'saldo_usd' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo = saldo + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'saldo_bs' AND v_premio.valor > 0 THEN
    UPDATE public.billetera SET saldo_bs = saldo_bs + v_premio.valor WHERE cliente_id = p_cliente_id;
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;

  ELSIF v_premio.tipo = 'descuento' AND v_premio.valor > 0 THEN
    INSERT INTO public.ruleta_descuentos_pendientes (cliente_id, giro_id, porcentaje, nombre)
    VALUES (p_cliente_id, v_giro_id, v_premio.valor, v_premio.nombre);
    UPDATE public.ruleta_giros SET acreditado = true WHERE id = v_giro_id;
  END IF;

  RETURN jsonb_build_object(
    'premio_id',          v_premio.id,
    'premio_nombre',      v_premio.nombre,
    'premio_descripcion', COALESCE(v_premio.descripcion, ''),
    'tipo',               v_premio.tipo,
    'valor',              v_premio.valor,
    'color',              v_premio.color,
    'emoji',              COALESCE(v_premio.emoji, 'ðŸŽ'),
    'acreditado',         (v_premio.tipo IN ('saldo_usd', 'saldo_bs') AND v_premio.valor > 0),
    'descuento_guardado', (v_premio.tipo = 'descuento' AND v_premio.valor > 0),
    'giros_restantes',    (SELECT giros_disponibles FROM public.ruleta_giros_disponibles WHERE cliente_id = p_cliente_id)
  );
END;
$$;
-- MigraciÃ³n 042: AÃ±adir cÃ³digo QR a los mÃ©todos de pago
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metodos_pago' AND column_name = 'qr_url') THEN
        ALTER TABLE public.metodos_pago ADD COLUMN qr_url TEXT;
    END IF;
    
    -- Asegurarnos de que icono_url existe (aunque los hooks ya lo usan)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metodos_pago' AND column_name = 'icono_url') THEN
        ALTER TABLE public.metodos_pago ADD COLUMN icono_url TEXT;
    END IF;
END $$;
-- ============================================
-- MigraciÃ³n 043: CronÃ³metro de Pago y ExpiraciÃ³n
-- ============================================

-- 1. AÃ±adir configuraciÃ³n de tiempo lÃ­mite (en minutos)
INSERT INTO public.configuracion (clave, valor, descripcion) 
VALUES ('tiempo_limite_pago', 15, 'Tiempo mÃ¡ximo (minutos) para reportar un pago antes de que el pedido expire')
ON CONFLICT (clave) DO NOTHING;

-- 2. FunciÃ³n para eliminar pedidos expirados que NO tienen referencia de pago
-- Se consideran expirados si: estado = 'pendiente' AND referencia_pago IS NULL AND created_at < (now() - interval 'X minutes')
CREATE OR REPLACE FUNCTION public.cancelar_pedidos_expirados()
RETURNS JSONB AS $$
DECLARE
    v_eliminados INT;
    v_limite_minutos NUMERIC;
BEGIN
    -- Obtener el lÃ­mite configuraciÃ³n
    SELECT valor INTO v_limite_minutos FROM public.configuracion WHERE clave = 'tiempo_limite_pago';
    IF v_limite_minutos IS NULL THEN v_limite_minutos := 15; END IF;

    -- Eliminar los pedidos (los pedido_items se borran por CASCADE)
    -- Los cupones usados vinculados tambiÃ©n se borran si tienen CASCADE, 
    -- o deben ser manejados si se quiere que vuelvan a estar disponibles.
    DELETE FROM public.pedidos 
    WHERE estado = 'pendiente' 
      AND (referencia_pago IS NULL OR referencia_pago = '')
      AND created_at < (NOW() - (v_limite_minutos || ' minutes')::INTERVAL);
    
    GET DIAGNOSTICS v_eliminados = ROW_COUNT;

    -- Notificar al esquema para recargar si es necesario
    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', true,
        'eliminados', v_eliminados,
        'limite_aplicado', v_limite_minutos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para la funciÃ³n (RPC)
GRANT EXECUTE ON FUNCTION public.cancelar_pedidos_expirados() TO authenticated, anon;
-- MigraciÃ³n 044: Comprobante de Pago en Pedidos
-- AÃ±ade columna comprobante_url a la tabla pedidos

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- FunciÃ³n para limpiar comprobantes de pedidos con mÃ¡s de 20 dÃ­as
CREATE OR REPLACE FUNCTION public.limpiar_comprobantes_antiguos()
RETURNS JSONB AS $$
DECLARE
  v_limpiados INT;
BEGIN
  -- Limpiar la URL de comprobante en pedidos con mÃ¡s de 20 dÃ­as
  UPDATE public.pedidos
  SET comprobante_url = NULL
  WHERE comprobante_url IS NOT NULL
    AND created_at < (NOW() - INTERVAL '20 days');
  
  GET DIAGNOSTICS v_limpiados = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'comprobantes_limpiados', v_limpiados
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.limpiar_comprobantes_antiguos() TO authenticated, anon;

-- Notificar al esquema
NOTIFY pgrst, 'reload schema';
-- Agregar columnas de caracterÃ­sticas a la tabla juegos
ALTER TABLE juegos 
ADD COLUMN IF NOT EXISTS caracteristicas_tipo VARCHAR(100) DEFAULT 'Recarga (AutomÃ¡tica)',
ADD COLUMN IF NOT EXISTS caracteristicas_region VARCHAR(100) DEFAULT 'Global',
ADD COLUMN IF NOT EXISTS caracteristicas_entrega VARCHAR(100) DEFAULT 'Inmediata',
ADD COLUMN IF NOT EXISTS caracteristicas_nota TEXT;

-- Insertar nuevas opciones de configuraciÃ³n para banners
INSERT INTO configuracion (clave, valor, valor_texto, descripcion) VALUES
('promo_banner_texto', 0, 'Gira y gana en nuestra ruleta SPINMAX AdemÃ¡s obtÃ©n WP canjeables por crÃ©ditos GRATIS! CLICK AQUÃ', 'Texto del banner principal del catÃ¡logo'),
('promo_banner_link', 0, '/ruleta', 'Link de destino del banner principal'),
('promo_banner_icono_url', 0, '', 'Ãcono del banner principal'),
('tutorial_banner_texto', 0, 'Â¿AÃºn no sabes recargar vÃ­a Pago MÃ³vil? AquÃ­ tienes un video guÃ­a', 'Texto de la campanita en catÃ¡logo'),
('tutorial_banner_link', 0, '#', 'Link destino de la campanita')
ON CONFLICT (clave) DO NOTHING;
-- MigraciÃ³n 047: Seguimiento individual de paquetes
-- AÃ±ade seguimiento por comprobante/fallo a la tabla pedido_items

ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'pendiente';
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS notas_admin TEXT;

-- Notificar al esquema
NOTIFY pgrst, 'reload schema';
-- ============================================
-- MIGRACIÃ“N: Referencia de Recargas Individual
-- ============================================

ALTER TABLE pedido_items 
ADD COLUMN IF NOT EXISTS referencia_admin VARCHAR(100);

-- Recargar el cachÃ© del esquema de Supabase
NOTIFY pgrst, 'reload schema';
-- MigraciÃ³n para aÃ±adir soporte de informaciÃ³n adicional en paquetes

ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS info_adicional_texto TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS info_adicional_imagen_url VARCHAR(500) DEFAULT NULL;
-- Migration: 050_reembolso_parcial.sql
-- Description: Actualizar reembolsar_pedido_rpc para aceptar montos parciales y opciÃ³n de cambiar estado

CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd',
    p_monto NUMERIC DEFAULT NULL,
    p_cambiar_estado BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
    v_refund_amount NUMERIC;
BEGIN
    -- 1. Fetch the order
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- Solo prevenir si es un reembolso automÃ¡tico sin monto definido
    IF v_pedido.estado = 'reembolsado' AND p_monto IS NULL THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 2. Determine refund amount based on currency
    IF p_monto IS NOT NULL THEN
        v_refund_amount := p_monto;
    ELSIF p_moneda = 'bs' THEN
        v_refund_amount := ROUND(v_pedido.total_bs);
    ELSE
        v_refund_amount := v_pedido.total_usd;
    END IF;

    -- 3. Ensure wallet exists
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_pedido.cliente_id, 0, 0);
    END IF;

    -- 4. Credit the appropriate wallet
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = saldo_bs + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = saldo + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    END IF;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso parcial/total del pedido #' || v_pedido.id::TEXT),
        NULL,
        p_moneda
    );

    -- 6. Update order status if requested
    IF p_cambiar_estado THEN
        UPDATE public.pedidos
        SET estado = 'reembolsado',
            atendido_por_id = p_admin_id,
            fecha_respuesta = now(),
            updated_at = now()
        WHERE id = p_pedido_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 051_reembolso_unico.sql
-- Description: Evitar multiples reembolsos de billetera por pedido

-- Add column to track if a refund has been issued
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS reembolso_billetera BOOLEAN DEFAULT false;

-- Update the refund RPC
CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd',
    p_monto NUMERIC DEFAULT NULL,
    p_cambiar_estado BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
    v_refund_amount NUMERIC;
BEGIN
    -- 1. Fetch the order
    SELECT id, cliente_id, total_bs, total_usd, estado, reembolso_billetera
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- Prevenir doble reembolso forzoso
    IF v_pedido.reembolso_billetera = true THEN
        RETURN jsonb_build_object('error', 'Este pedido ya recibiÃ³ una devoluciÃ³n de fondos a la billetera. No se pueden hacer devoluciones mÃºltiples.');
    END IF;

    IF v_pedido.estado = 'reembolsado' AND p_monto IS NULL THEN
        RETURN jsonb_build_object('error', 'Este pedido ya fue reembolsado previamente');
    END IF;

    -- 2. Determine refund amount based on currency
    IF p_monto IS NOT NULL THEN
        v_refund_amount := p_monto;
    ELSIF p_moneda = 'bs' THEN
        v_refund_amount := ROUND(v_pedido.total_bs);
    ELSE
        v_refund_amount := v_pedido.total_usd;
    END IF;

    -- 3. Ensure wallet exists
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_pedido.cliente_id, 0, 0);
    END IF;

    -- 4. Credit the appropriate wallet
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = saldo_bs + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = saldo + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    END IF;

    -- 5. Log the transaction (ahora especificando el p_pedido_id en la referencia)
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso parcial/total del pedido #' || v_pedido.id::TEXT),
        p_pedido_id,
        p_moneda
    );

    -- 6. Update order status and set reembolso_billetera flag
    IF p_cambiar_estado THEN
        UPDATE public.pedidos
        SET estado = 'reembolsado',
            atendido_por_id = p_admin_id,
            fecha_respuesta = now(),
            reembolso_billetera = true,
            updated_at = now()
        WHERE id = p_pedido_id;
    ELSE
        UPDATE public.pedidos
        SET reembolso_billetera = true,
            updated_at = now()
        WHERE id = p_pedido_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 052_pagos_admins.sql
-- Description: Sistema de saldos y liquidaciÃ³n para administradores basado en ventas

-- 1. Tabla de saldos
CREATE TABLE IF NOT EXISTS public.admin_saldos (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    saldo_bs NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_saldos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver todos los saldos" ON public.admin_saldos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 2. Tabla historial
CREATE TABLE IF NOT EXISTS public.admin_saldos_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('credito_venta', 'reverso_venta', 'liquidacion')),
    moneda VARCHAR(10) NOT NULL CHECK (moneda IN ('usd', 'bs')),
    monto NUMERIC(15, 2) NOT NULL,
    notas TEXT,
    liquidado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_saldos_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins pueden ver historial saldos" ON public.admin_saldos_historial
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- 3. Trigger Function on Pedidos
CREATE OR REPLACE FUNCTION public.trig_act_saldos_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_is_bs BOOLEAN := false;
    v_metodo_pago RECORD;
    v_moneda TEXT;
    v_monto NUMERIC;
BEGIN
    -- Determinar moneda basÃ¡ndonos en metodo_pago o referencia
    IF NEW.referencia_pago ILIKE '%billetera bs%' OR NEW.referencia_pago ILIKE '%pago mÃ³vil%' OR NEW.referencia_pago ILIKE '%bolÃ­vares%' OR NEW.referencia_pago ILIKE '%bs%' THEN
        v_is_bs := true;
    ELSIF NEW.metodo_pago_id IS NOT NULL THEN
        SELECT nombre, habilitado_billetera_bs INTO v_metodo_pago FROM public.metodos_pago WHERE id = NEW.metodo_pago_id;
        IF v_metodo_pago.habilitado_billetera_bs = true OR v_metodo_pago.nombre ILIKE '%pago%' OR v_metodo_pago.nombre ILIKE '%bs%' OR v_metodo_pago.nombre ILIKE '%bolÃ­vares%' THEN
            v_is_bs := true;
        END IF;
    END IF;

    IF v_is_bs THEN
        v_moneda := 'bs';
        v_monto := NEW.total_bs;
    ELSE
        v_moneda := 'usd';
        v_monto := NEW.total_usd;
    END IF;

    -- Si no hay monto vÃ¡lido, simplemente salir
    IF v_monto IS NULL OR v_monto = 0 THEN
        RETURN NEW;
    END IF;

    -- CASO 1: Pedido cambia a COMPLETADO
    IF NEW.estado = 'completado' AND (TG_OP = 'INSERT' OR OLD.estado != 'completado') THEN
        IF NEW.atendido_por_id IS NOT NULL THEN
            -- Upsert para crear la billetera si no existe
            INSERT INTO public.admin_saldos (auth_user_id, saldo_usd, saldo_bs)
            VALUES (NEW.atendido_por_id, 
                    CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END, 
                    CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END)
            ON CONFLICT (auth_user_id) 
            DO UPDATE SET 
                saldo_usd = public.admin_saldos.saldo_usd + CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END,
                saldo_bs = public.admin_saldos.saldo_bs + CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END,
                updated_at = now();

            -- Registrar historial
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (NEW.atendido_por_id, NEW.id, 'credito_venta', v_moneda, v_monto, 'CrÃ©dito automÃ¡tico por venta de pedido #' || NEW.numero_pedido);
        END IF;

    -- CASO 2: Pedido deja de ser COMPLETADO (Reembolso, cancelaciÃ³n, o reversiÃ³n manual)
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'completado' AND NEW.estado != 'completado' THEN
        IF OLD.atendido_por_id IS NOT NULL THEN
            -- Restar el saldo generado anteriormente
            UPDATE public.admin_saldos
            SET saldo_usd = saldo_usd - CASE WHEN v_moneda = 'usd' THEN v_monto ELSE 0 END,
                saldo_bs = saldo_bs - CASE WHEN v_moneda = 'bs' THEN v_monto ELSE 0 END,
                updated_at = now()
            WHERE auth_user_id = OLD.atendido_por_id;

            -- Registrar historial (Notar que el monto aquÃ­ es positivo, pero el tipo_movimiento define que es reverso)
            INSERT INTO public.admin_saldos_historial (admin_id, pedido_id, tipo_movimiento, moneda, monto, notas)
            VALUES (OLD.atendido_por_id, OLD.id, 'reverso_venta', v_moneda, v_monto, 'Reverso por cambio de estado en pedido #' || OLD.numero_pedido || ' de completado a ' || NEW.estado);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_act_saldos_admin_pedidos ON public.pedidos;
CREATE TRIGGER trig_act_saldos_admin_pedidos
AFTER INSERT OR UPDATE OF estado ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trig_act_saldos_admin();

-- 4. RPC para Liquidar Saldo
CREATE OR REPLACE FUNCTION public.liquidar_saldo_admin_rpc(
    p_admin_id UUID,
    p_liquidador_id UUID,
    p_moneda VARCHAR(10),
    p_monto NUMERIC,
    p_notas TEXT DEFAULT 'LiquidaciÃ³n a administrador'
) RETURNS JSONB AS $$
DECLARE
    v_saldo_actual NUMERIC;
BEGIN
    IF p_moneda NOT IN ('usd', 'bs') THEN
        RETURN jsonb_build_object('error', 'Moneda invÃ¡lida (debe ser usd o bs)');
    END IF;

    -- Obtener saldo bloqueando la fila
    IF p_moneda = 'usd' THEN
        SELECT saldo_usd INTO v_saldo_actual FROM public.admin_saldos WHERE auth_user_id = p_admin_id FOR UPDATE;
    ELSE
        SELECT saldo_bs INTO v_saldo_actual FROM public.admin_saldos WHERE auth_user_id = p_admin_id FOR UPDATE;
    END IF;

    IF v_saldo_actual IS NULL THEN
        RETURN jsonb_build_object('error', 'El administrador no posee billetera de saldos');
    END IF;

    IF v_saldo_actual < p_monto THEN
        RETURN jsonb_build_object('error', 'Saldo insuficiente para liquidar este monto (Saldo actual: ' || v_saldo_actual || ')');
    END IF;

    -- Descontar saldo
    IF p_moneda = 'usd' THEN
        UPDATE public.admin_saldos SET saldo_usd = saldo_usd - p_monto, updated_at = now() WHERE auth_user_id = p_admin_id;
    ELSE
        UPDATE public.admin_saldos SET saldo_bs = saldo_bs - p_monto, updated_at = now() WHERE auth_user_id = p_admin_id;
    END IF;

    -- Registrar movimiento
    INSERT INTO public.admin_saldos_historial (admin_id, tipo_movimiento, moneda, monto, notas, liquidado_por_id)
    VALUES (p_admin_id, 'liquidacion', p_moneda, p_monto, p_notas, p_liquidador_id);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificar a postgREST
NOTIFY pgrst, 'reload schema';
-- ============================================
-- MIGRACIÃ“N 053: Persistencia de Ã­conos en items
-- ============================================

-- 1. AÃ±adir la columna para guardar el Ã­cono en el momento de la compra
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS producto_icono TEXT;

-- 2. Backfill: Copiar los Ã­conos actuales de la tabla productos a los items existentes
UPDATE public.pedido_items pi
SET producto_icono = p.icono_url
FROM public.productos p
WHERE pi.producto_id = p.id
AND pi.producto_icono IS NULL;

-- 3. Recargar schema
NOTIFY pgrst, 'reload schema';
-- Migration: 054_rename_billetera_recargas_reference.sql
-- Description: Rename 'referencia' to 'referencia_pago' in billetera_recargas for consistency across the schema

ALTER TABLE public.billetera_recargas RENAME COLUMN referencia TO referencia_pago;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
-- FunciÃ³n para que los administradores puedan restablecer contraseÃ±as de usuarios manualmente
-- Esta funciÃ³n corre con privilegios de SUPERUSER (SECURITY DEFINER) para poder modificar auth.users

CREATE OR REPLACE FUNCTION admin_reset_password_rpc(p_user_id UUID, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requester_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Obtener ID del que llama
  v_requester_id := auth.uid();
  
  -- 2. Verificar que el que llama sea administrador
  SELECT (rol = 'admin' OR rol = 'administrador') INTO v_is_admin
  FROM public.perfiles
  WHERE id = v_requester_id;

  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de administrador para realizar esta acciÃ³n');
  END IF;

  -- 3. Actualizar la contraseÃ±a en auth.users
  -- Nota: Usamos crypt de pgcrypto que es lo que Supabase usa internamente.
  -- Asegurarse de que la extensiÃ³n pgcrypto estÃ© disponible (Suele estarlo por defecto en Supabase)
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Otorgar permiso de ejecuciÃ³n a usuarios autenticados (la funciÃ³n misma valida luego si es admin)
GRANT EXECUTE ON FUNCTION admin_reset_password_rpc(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password_rpc(UUID, TEXT) TO service_role;
-- Migration: 056_control_referencias.sql
-- Description: Sistema de blindaje para evitar referencias de pago duplicadas en las Ãºltimas 48 horas.

-- 1. Tabla de control interno para log de referencias
CREATE TABLE IF NOT EXISTS public.referencias_pagos_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referencia TEXT NOT NULL,
    monto_registrado NUMERIC(15, 2),
    usuario_id UUID REFERENCES auth.users(id),
    origen TEXT, -- 'pedido', 'billetera', 'admin'
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Caracas')
);

-- Ãndice para bÃºsquedas rÃ¡pidas de referencias recientes
CREATE INDEX IF NOT EXISTS idx_referencias_control_referencia ON public.referencias_pagos_control(referencia);
CREATE INDEX IF NOT EXISTS idx_referencias_control_created_at ON public.referencias_pagos_control(created_at);

-- 2. FunciÃ³n RPC para validar y registrar una referencia de forma atÃ³mica
CREATE OR REPLACE FUNCTION public.validar_y_registrar_referencia_rpc(
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_origen TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existe BOOLEAN;
BEGIN
    -- Limpiar la referencia (quitar espacios, etc si fuera necesario, pero el frontend ya lo hace)
    p_referencia := TRIM(p_referencia);

    -- Verificar si existe en las Ãºltimas 48 horas
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_existe;

    IF v_existe THEN
        RETURN jsonb_build_object('success', false, 'message', 'Referencia Duplicada');
    END IF;

    -- Si no existe, registrarla para blindar futuros intentos
    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia vÃ¡lida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Poblar la tabla con datos recientes de pedidos y billetera para protecciÃ³n inmediata
INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen, created_at)
SELECT referencia_pago, total_bs, cliente_id, 'pedido', created_at
FROM public.pedidos
WHERE referencia_pago IS NOT NULL 
AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
ON CONFLICT DO NOTHING;

INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen, created_at)
SELECT referencia_pago, monto, auth_user_id, 'billetera', created_at
FROM public.billetera_recargas
WHERE referencia_pago IS NOT NULL 
AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.referencias_pagos_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view reference control" ON public.referencias_pagos_control
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));
-- CorrecciÃ³n de la migraciÃ³n para cuentas_guardadas (juego_id debe ser INT para coincidir con el esquema)
DROP TABLE IF EXISTS cuentas_guardadas;

CREATE TABLE IF NOT EXISTS cuentas_guardadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    juego_id INT NOT NULL REFERENCES juegos(id) ON DELETE CASCADE,
    tipo_dato TEXT NOT NULL, -- 'id', 'cuenta_completa', 'usuario_clave'
    player_id TEXT,
    email TEXT,
    password TEXT,
    username TEXT,
    nombre_perfil TEXT, -- Ejemplo: "Mi Cuenta Principal"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE cuentas_guardadas ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas de seguridad
CREATE POLICY "Usuarios pueden ver sus propias cuentas guardadas"
    ON cuentas_guardadas FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Usuarios pueden insertar sus propias cuentas guardadas"
    ON cuentas_guardadas FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Usuarios pueden actualizar sus propias cuentas guardadas"
    ON cuentas_guardadas FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Usuarios pueden eliminar sus propias cuentas guardadas"
    ON cuentas_guardadas FOR DELETE
    USING (auth.uid() = auth_user_id);

-- Trigger para updated_at (asumiendo que la funciÃ³n ya existe de la migraciÃ³n anterior, pero la recreamos por seguridad)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cuentas_guardadas_updated_at ON cuentas_guardadas;
CREATE TRIGGER update_cuentas_guardadas_updated_at
    BEFORE UPDATE ON cuentas_guardadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- Migration: 058_check_rejected_references.sql
-- Description: Mejora el sistema de control de referencias para detectar especÃ­ficamente referencias rechazadas en las Ãºltimas 48 horas.

CREATE OR REPLACE FUNCTION public.validar_y_registrar_referencia_rpc(
    p_referencia TEXT,
    p_monto NUMERIC,
    p_usuario_id UUID,
    p_origen TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existe_control BOOLEAN;
    v_rechazado_pedido BOOLEAN;
    v_rechazado_billetera BOOLEAN;
BEGIN
    -- Limpiar la referencia
    p_referencia := TRIM(p_referencia);

    -- 1. Verificar si existe en la tabla de control (Duplicada)
    SELECT EXISTS (
        SELECT 1 FROM public.referencias_pagos_control
        WHERE referencia = p_referencia
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_existe_control;

    -- 2. Verificar si existe en pedidos como RECHAZADO (pago_verificado = false)
    SELECT EXISTS (
        SELECT 1 FROM public.pedidos
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND pago_verificado = false
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_rechazado_pedido;

    -- 3. Verificar si existe en billetera_recargas como RECHAZADO
    SELECT EXISTS (
        SELECT 1 FROM public.billetera_recargas
        WHERE (referencia_pago = p_referencia OR referencia_pago LIKE p_referencia || ' %')
        AND estado = 'rechazado'
        AND created_at > (NOW() AT TIME ZONE 'America/Caracas') - INTERVAL '48 hours'
    ) INTO v_rechazado_billetera;

    -- Priorizar el mensaje de rechazo si aplica
    IF v_rechazado_pedido OR v_rechazado_billetera THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Referencia Rechazada', 
            'detail', 'Esta referencia fue rechazada anteriormente por ser invÃ¡lida o inexistente. No puedes volver a usarla.'
        );
    END IF;

    IF v_existe_control THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Referencia Duplicada',
            'detail', 'Esta referencia ya ha sido registrada en las Ãºltimas 48 horas.'
        );
    END IF;

    -- Si no existe ni estÃ¡ rechazada, registrarla en el control
    INSERT INTO public.referencias_pagos_control (referencia, monto_registrado, usuario_id, origen)
    VALUES (p_referencia, p_monto, p_usuario_id, p_origen);

    RETURN jsonb_build_object('success', true, 'message', 'Referencia vÃ¡lida y registrada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration: 058_super_admin_sales_visibility.sql
-- Description: Allow super admin (ceriraga@gmail.com) to see all sales records

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
                OR (auth.jwt() ->> 'email') = 'ceriraga@gmail.com'
            )
        )
    );

NOTIFY pgrst, 'reload schema';
-- Migration: 059_add_zone_id_to_orders.sql
-- Description: AÃ±ade soporte para Zone ID en los pedidos, permitiendo registrar juegos que requieren ID + Zone ID (ej. Mobile Legends).

-- 1. AÃ±adir columna zone_id a pedido_items
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- 2. Actualizar comentarios o documentaciÃ³n interna si es necesario
COMMENT ON COLUMN public.pedido_items.zone_id IS 'ID de zona para juegos que requieren doble identificador (ej. Mobile Legends)';
-- Migration: 059_link_ventas_pedidos.sql
-- Description: Link ventas table with pedidos for detailed transaction history

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ventas' AND column_name = 'pedido_id'
    ) THEN
        ALTER TABLE public.ventas ADD COLUMN pedido_id INT REFERENCES public.pedidos(id);
    END IF;
END $$;

-- Actualizar funciÃ³n RPC registrar_venta_rpc para aceptar p_pedido_id
CREATE OR REPLACE FUNCTION registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL,
    p_pedido_id INT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    SELECT * INTO v_producto FROM productos WHERE id = p_producto_id;
    SELECT * INTO v_juego FROM juegos WHERE id = v_producto.juego_id;
    
    SELECT 
        (SELECT valor FROM configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa segÃºn tipo de juego
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                              - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    INSERT INTO ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password,
        pedido_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password,
        p_pedido_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
-- Migration: 060_add_zone_id_to_saved_accounts.sql
-- Description: AÃ±ade soporte para Zone ID en las cuentas guardadas.

ALTER TABLE public.cuentas_guardadas ADD COLUMN IF NOT EXISTS zone_id TEXT;

-- Actualizar comentarios
COMMENT ON COLUMN public.cuentas_guardadas.zone_id IS 'ID de zona para cuentas guardadas que lo requieren (ej. Mobile Legends)';
-- Migration: 061_fix_admin_sales_visibility.sql
-- Description: Allow SuperAdmin to see all sales and ensure RLS doesn't block admins with missing client records

DROP POLICY IF EXISTS "Admins see only their own sales" ON public.ventas;

CREATE POLICY "Admins see sales" ON public.ventas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid() AND (
                -- SuperAdmin can see everything
                p.email = 'ceriraga@gmail.com' 
                OR 
                -- Other admins see their own or orphan sales
                (p.rol = 'admin' AND (
                    EXISTS (
                        SELECT 1 FROM public.clientes c 
                        WHERE c.auth_user_id = p.id AND c.id = vendedor_id
                    )
                    OR vendedor_id IS NULL
                ))
            )
        )
    );

-- Nota: Si auth.email() no estÃ¡ disponible en RLS directamente sin join con auth.users, 
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
-- Migration: Soporte - Respuestas RÃ¡pidas
CREATE TABLE IF NOT EXISTS public.soporte_respuestas_rapidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.soporte_respuestas_rapidas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins pueden todo en respuestas rÃ¡pidas" 
ON public.soporte_respuestas_rapidas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE perfiles.id = auth.uid() 
    AND perfiles.rol = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE perfiles.id = auth.uid() 
    AND perfiles.rol = 'admin'
  )
);

CREATE POLICY "Clientes pueden ver respuestas rÃ¡pidas" 
ON public.soporte_respuestas_rapidas
FOR SELECT
TO authenticated
USING (true);
-- Migration: Add avatar_url to perfiles table and sync with clientes
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Sync existing data from clientes to perfiles
UPDATE public.perfiles p
SET 
    avatar_url = c.avatar_url,
    nickname = c.nickname
FROM public.clientes c
WHERE c.auth_user_id = p.id;
-- Migration: 063_fix_support_chat_rls.sql
-- Description: Fix soporte_mensajes RLS policies to use correct columns and profile table

-- 1. Eliminar polÃ­ticas antiguas (limpieza)
DROP POLICY IF EXISTS "Admins pueden ver todos los chats" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden ver su propio chat" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Admins pueden enviar mensajes" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden enviar a su propio chat" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Admins pueden actualizar mensajes" ON public.soporte_mensajes;
DROP POLICY IF EXISTS "Clientes pueden actualizar sus mensajes" ON public.soporte_mensajes;

-- 2. Crear nuevas polÃ­ticas robustas

-- SELECT: Admins ven todo, Clientes ven lo suyo
CREATE POLICY "soporte_mensajes_select_policy" ON public.soporte_mensajes
    FOR SELECT USING (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueÃ±o del chat
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- INSERT: Admins envÃ­an a cualquier chat, Clientes envÃ­an a su propio chat
CREATE POLICY "soporte_mensajes_insert_policy" ON public.soporte_mensajes
    FOR INSERT WITH CHECK (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueÃ±o del chat enviando a su propia sala
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- UPDATE: Admins actualizan todo (leÃ­do), Clientes lo suyo
CREATE POLICY "soporte_mensajes_update_policy" ON public.soporte_mensajes
    FOR UPDATE USING (
        -- Es admin
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
        OR
        -- Es el dueÃ±o del chat
        EXISTS (
            SELECT 1 FROM public.clientes c 
            WHERE c.auth_user_id = auth.uid() AND c.id = soporte_mensajes.cliente_id
        )
    );

-- DELETE: Solo admins o dueÃ±o
CREATE POLICY "soporte_mensajes_delete_policy" ON public.soporte_mensajes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
    );

-- 3. Notificar recarga
NOTIFY pgrst, 'reload schema';
-- Migration: 064_fix_registrar_venta_ambiguity.sql
-- Description: Fix ambiguity in registrar_venta_rpc by dropping all overloads and re-creating it correctly.

-- 1. Eliminar todas las posibles versiones de la funciÃ³n para evitar ambigÃ¼edad
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text, uuid);

-- 2. Re-crear la funciÃ³n correctamente con 11 parÃ¡metros (incluyendo p_pedido_id)
-- Se usa INT para p_pedido_id ya que la tabla pedidos usa SERIAL PRIMARY KEY
CREATE OR REPLACE FUNCTION public.registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL,
    p_pedido_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    -- Obtener datos del producto y juego
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Obtener configuraciÃ³n de tasas
    SELECT 
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM public.configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa segÃºn tipo de juego
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                               - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    -- Insertar la venta
    INSERT INTO public.ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password,
        pedido_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password,
        p_pedido_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
-- Migration: 065_fix_pedido_id_type_consistency.sql
-- Description: Fix functions that were using UUID for p_pedido_id when the table uses INT (SERIAL).

-- 1. Fix reembolsar_pedido_rpc
DROP FUNCTION IF EXISTS public.reembolsar_pedido_rpc(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.reembolsar_pedido_rpc(
    p_pedido_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL,
    p_moneda TEXT DEFAULT 'usd',
    p_monto NUMERIC DEFAULT NULL,
    p_cambiar_estado BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_wallet_exists BOOLEAN;
    v_refund_amount NUMERIC;
BEGIN
    -- 1. Fetch the order
    SELECT id, cliente_id, total_bs, total_usd, estado
    INTO v_pedido
    FROM public.pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Pedido no encontrado');
    END IF;

    -- 2. Determine refund amount
    v_refund_amount := COALESCE(p_monto, CASE WHEN p_moneda = 'bs' THEN v_pedido.total_bs ELSE v_pedido.total_usd END);

    -- 3. Ensure wallet exists
    SELECT EXISTS (
        SELECT 1 FROM public.billeteras WHERE auth_user_id = v_pedido.cliente_id
    ) INTO v_wallet_exists;

    IF NOT v_wallet_exists THEN
        INSERT INTO public.billeteras (auth_user_id, saldo, saldo_bs)
        VALUES (v_pedido.cliente_id, 0, 0);
    END IF;

    -- 4. Credit the appropriate wallet
    IF p_moneda = 'bs' THEN
        UPDATE public.billeteras
        SET saldo_bs = saldo_bs + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    ELSE
        UPDATE public.billeteras
        SET saldo = saldo + v_refund_amount, updated_at = now()
        WHERE auth_user_id = v_pedido.cliente_id;
    END IF;

    -- 5. Log the transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (
        v_pedido.cliente_id,
        v_refund_amount,
        'reembolso',
        COALESCE(p_notas, 'Reembolso de pedido #' || v_pedido.id::TEXT),
        NULL, -- referencia_id is UUID, pedido id is INT
        p_moneda
    );

    -- 6. Update order status if requested
    IF p_cambiar_estado THEN
        UPDATE public.pedidos
        SET estado = 'reembolsado',
            atendido_por_id = p_admin_id,
            fecha_respuesta = now(),
            updated_at = now()
        WHERE id = p_pedido_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'monto_reembolsado', v_refund_amount, 'moneda', p_moneda);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix pagar_con_billetera_rpc
DROP FUNCTION IF EXISTS public.pagar_con_billetera_rpc(uuid, numeric, uuid, text);
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- 1. Fetch current balance with lock
    SELECT saldo INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- 2. Deduct amount
    UPDATE public.billeteras
    SET saldo = saldo - p_amount,
        updated_at = now()
    WHERE auth_user_id = p_user_id;

    -- 3. Log Transaction
    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, NULL); -- referencia_id is UUID, pedido id is INT

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix pagar_con_billetera_bs_rpc
DROP FUNCTION IF EXISTS public.pagar_con_billetera_bs_rpc(uuid, numeric, uuid, text);
CREATE OR REPLACE FUNCTION public.pagar_con_billetera_bs_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    SELECT saldo_bs INTO v_current_balance
    FROM public.billeteras
    WHERE auth_user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    UPDATE public.billeteras
    SET saldo_bs = saldo_bs - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id, moneda)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, NULL, 'bs');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 066_negocio_role_support.sql
-- Description: Implement "Negocio" role with data isolation and module configuration.

-- 1. Update roles check constraint
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles 
ADD CONSTRAINT perfiles_rol_check 
CHECK (rol IN ('admin', 'cliente', 'revendedor', 'negocio'));

-- 2. Add config_modulos to perfiles
ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS config_modulos JSONB DEFAULT '["dashboard", "productos", "ventas", "reportes"]'::jsonb;

-- 3. Add owner_id to data tables for isolation
-- This allows each business to have its own independent inventory and sales.
DO $$ 
BEGIN
    -- Categorias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categorias' AND column_name = 'owner_id') THEN
        ALTER TABLE public.categorias ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Juegos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'juegos' AND column_name = 'owner_id') THEN
        ALTER TABLE public.juegos ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Productos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'owner_id') THEN
        ALTER TABLE public.productos ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Ventas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventas' AND column_name = 'owner_id') THEN
        ALTER TABLE public.ventas ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Configuracion (Rates)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracion' AND column_name = 'owner_id') THEN
        ALTER TABLE public.configuracion ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Update RLS Policies for Data Isolation
-- Note: owner_id = NULL means "Global System"

-- Categorias
DROP POLICY IF EXISTS "Categorias isolation" ON public.categorias;
CREATE POLICY "Categorias isolation" ON public.categorias
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Juegos
DROP POLICY IF EXISTS "Juegos isolation" ON public.juegos;
CREATE POLICY "Juegos isolation" ON public.juegos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Productos
DROP POLICY IF EXISTS "Productos isolation" ON public.productos;
CREATE POLICY "Productos isolation" ON public.productos
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- Ventas
-- Modified existing policy
DROP POLICY IF EXISTS "Admins see sales" ON public.ventas;
CREATE POLICY "Admins and Negocios see sales" ON public.ventas
FOR ALL USING (
    (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin'
        AND (
            (SELECT public.is_superadmin()) 
            OR owner_id IS NULL 
            OR owner_id = auth.uid()
        )
    )
    OR
    (
        (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'negocio'
        AND owner_id = auth.uid()
    )
);

-- Configuracion
DROP POLICY IF EXISTS "Config isolation" ON public.configuracion;
CREATE POLICY "Config isolation" ON public.configuracion
FOR ALL USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'cliente', 'revendedor'))
    OR 
    (owner_id = auth.uid())
    OR
    (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'))
);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
-- Migration: 067_configuracion_owner_constraint.sql
-- Description: Allow multiple businesses to have their own configuration keys.

-- 1. Remove old unique constraint on 'clave'
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

-- 2. Add new unique constraint on (clave, owner_id)
-- Note: PostgreSQL handles NULL in unique constraints such that (clave, NULL) and (clave, NULL) are NOT considered duplicates.
-- However, we want only ONE global (NULL) record per clave, and ONE record per business owner per clave.
-- To fix this for NULLs, we can use a partial index or just assume owner_id is handled.
-- For standard UNIQUE(clave, owner_id), multiple NULLs are allowed.
-- To prevent multiple NULLs for the same clave:
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_clave_global_idx ON public.configuracion (clave) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_clave_owner_idx ON public.configuracion (clave, owner_id) WHERE owner_id IS NOT NULL;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
-- Migration: 067_update_registrar_venta_rpc_owner.sql
-- Description: Actualizar la funciÃ³n registrar_venta_rpc para aceptar p_owner_id y aislar datos de negocios

-- 1. Eliminar versiones anteriores (si es que la de 11 parametros existe)
DROP FUNCTION IF EXISTS public.registrar_venta_rpc(integer, integer, text, uuid, uuid, uuid, text, text, text, text, uuid);

-- 2. Re-crear con p_owner_id
CREATE OR REPLACE FUNCTION public.registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL,
    p_pedido_id UUID DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    -- Obtener datos del producto y juego
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Obtener configuraciÃ³n de tasas
    SELECT 
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar') AS tasa_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance') AS tasa_binance,
        (SELECT valor FROM public.configuracion WHERE clave = 'real_dolar') AS real_dolar,
        (SELECT valor FROM public.configuracion WHERE clave = 'descuentos') AS descuentos,
        (SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal') AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa segÃºn tipo de juego
    IF v_juego.usa_tasa_binance THEN v_tasa := v_config.tasa_binance;
    ELSIF v_juego.usa_real_dolar THEN v_tasa := v_config.real_dolar;
    ELSE v_tasa := v_config.tasa_dolar;
    END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia) 
                               - v_config.descuentos - v_juego.descuento_particular;
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base - (v_producto.costo_base * v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * v_producto.margen_ganancia);
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * v_producto.margen_ganancia);
        END CASE;
    END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    -- Insertar la venta
    INSERT INTO public.ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password,
        pedido_id, owner_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password,
        p_pedido_id, p_owner_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
-- Migration: 068_fix_config_upsert.sql
-- Description: Create an RPC function to safely upsert configuration values (handling NULL owner_id properly)

CREATE OR REPLACE FUNCTION public.update_config_rpc(
    p_clave TEXT,
    p_valor NUMERIC DEFAULT NULL,
    p_valor_texto TEXT DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Check if record exists
    IF p_owner_id IS NULL THEN
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id IS NULL;
    ELSE
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id = p_owner_id;
    END IF;

    IF FOUND THEN
        -- Update existing
        IF p_owner_id IS NULL THEN
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id IS NULL
            RETURNING * INTO v_result;
        ELSE
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id = p_owner_id
            RETURNING * INTO v_result;
        END IF;
    ELSE
        -- Insert new
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, p_valor, p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';
-- Migration: 069_product_vault.sql
-- Description: Sistema de baÃºl de cÃ³digos (Gift Cards) con entrega automÃ¡tica

-- 1. Crear tabla de cÃ³digos
CREATE TABLE IF NOT EXISTS public.producto_codigos (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES public.productos(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usado_at TIMESTAMPTZ,
    owner_id UUID REFERENCES auth.users(id) -- Para soporte multi-negocio
);

-- 2. AÃ±adir columnas a tablas existentes
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS entrega_automatica BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pedido_items ADD COLUMN IF NOT EXISTS codigo_entregado TEXT;

-- 3. RLS para producto_codigos
ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_codigos" ON public.producto_codigos 
FOR ALL TO authenticated 
USING (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'administrador'))
    OR (owner_id = auth.uid())
)
WITH CHECK (
    (owner_id IS NULL AND (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin', 'administrador'))
    OR (owner_id = auth.uid())
);

-- 4. FunciÃ³n RPC para asignar cÃ³digo atÃ³micamente
CREATE OR REPLACE FUNCTION public.asignar_codigo_pedido_item_rpc(p_pedido_item_id INT)
RETURNS TEXT AS $$
DECLARE
    v_producto_id INT;
    v_pedido_id INT;
    v_codigo_id INT;
    v_codigo_text TEXT;
BEGIN
    -- 1. Obtener producto y pedido del item
    SELECT producto_id, pedido_id INTO v_producto_id, v_pedido_id 
    FROM public.pedido_items WHERE id = p_pedido_item_id;

    -- 2. Buscar un cÃ³digo disponible para ese producto
    SELECT id, codigo INTO v_codigo_id, v_codigo_text
    FROM public.producto_codigos
    WHERE producto_id = v_producto_id AND usado = FALSE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 3. Si encontramos cÃ³digo, asignarlo
    IF v_codigo_id IS NOT NULL THEN
        -- Marcar cÃ³digo como usado
        UPDATE public.producto_codigos 
        SET usado = TRUE, 
            pedido_id = v_pedido_id, 
            usado_at = NOW() 
        WHERE id = v_codigo_id;

        -- Guardar el cÃ³digo en el item del pedido
        UPDATE public.pedido_items 
        SET codigo_entregado = v_codigo_text 
        WHERE id = p_pedido_item_id;

        RETURN v_codigo_text;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recargar esquema
NOTIFY pgrst, 'reload schema';
-- Migration: fix_order_completion_and_tasa.sql
-- Description: Fixes the order completion block by ensuring tasa_dolar exists and the RPC is robust.

-- 1. Asegurar que tasa_dolar exista en la configuraciÃ³n para evitar fallos en cÃ¡lculos
INSERT INTO public.configuracion (clave, valor, descripcion)
VALUES ('tasa_dolar', 650, 'Tasa de cambio principal (DÃ³lar)')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor WHERE public.configuracion.valor IS NULL OR public.configuracion.valor = 0;

-- 2. Hacer que la funciÃ³n registrar_venta_rpc sea mÃ¡s robusta ante valores nulos
CREATE OR REPLACE FUNCTION public.registrar_venta_rpc(
    p_producto_id INT,
    p_cantidad INT DEFAULT 1,
    p_notas TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_metodo_pago_id UUID DEFAULT NULL,
    p_referencia_pago TEXT DEFAULT NULL,
    p_player_id TEXT DEFAULT NULL,
    p_account_email TEXT DEFAULT NULL,
    p_account_password TEXT DEFAULT NULL,
    p_pedido_id UUID DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_producto RECORD;
    v_juego RECORD;
    v_config RECORD;
    v_tasa NUMERIC;
    v_venta_usd NUMERIC;
    v_venta_bs NUMERIC;
    v_ganancia NUMERIC;
    v_venta RECORD;
BEGIN
    -- Obtener datos del producto y juego
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    
    SELECT * INTO v_juego FROM public.juegos WHERE id = v_producto.juego_id;
    
    -- Obtener configuraciÃ³n de tasas con COALESCE para evitar nulos
    SELECT 
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_dolar'), 1) AS tasa_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'tasa_binance'), 1) AS tasa_binance,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'real_dolar'), 1) AS real_dolar,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'descuentos'), 0) AS descuentos,
        COALESCE((SELECT valor FROM public.configuracion WHERE clave = 'porcentaje_paypal'), 0.08) AS porcentaje_paypal
    INTO v_config;

    -- Determinar tasa segÃºn tipo de juego (si es 0 o null, usar la otra disponible)
    IF v_juego.usa_tasa_binance THEN 
        v_tasa := COALESCE(v_config.tasa_binance, v_config.tasa_dolar, 1);
    ELSIF v_juego.usa_real_dolar THEN 
        v_tasa := COALESCE(v_config.real_dolar, v_config.tasa_dolar, 1);
    ELSE 
        v_tasa := COALESCE(v_config.tasa_dolar, v_config.tasa_binance, 1);
    END IF;

    -- Si la tasa sigue siendo invÃ¡lida, forzar 1
    IF v_tasa <= 0 THEN v_tasa := 1; END IF;

    -- Calcular precio de venta
    IF v_producto.precio_venta_fijo IS NOT NULL AND v_producto.precio_venta_fijo > 0 THEN
        v_venta_usd := v_producto.precio_venta_fijo;
    ELSE
        CASE v_juego.tipo_calculo
            WHEN 'estandar' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
            WHEN 'paypal' THEN
                v_venta_usd := v_producto.costo_base / (1 - v_config.porcentaje_paypal);
            WHEN 'descuento_doble' THEN
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0)) 
                               - v_config.descuentos - COALESCE(v_juego.descuento_particular, 0);
            WHEN 'ref_cruzada' THEN
                v_venta_usd := (v_producto.costo_base / (1 - v_config.porcentaje_paypal));
                v_venta_usd := v_venta_usd + (v_venta_usd * COALESCE(v_producto.margen_ganancia, 0));
            ELSE
                v_venta_usd := v_producto.costo_base + (v_producto.costo_base * COALESCE(v_producto.margen_ganancia, 0));
        END CASE;
    END IF;

    -- Asegurar que v_venta_usd no sea nulo
    IF v_venta_usd IS NULL THEN v_venta_usd := v_producto.costo_base; END IF;

    v_venta_bs := v_venta_usd * v_tasa;
    v_ganancia := v_venta_usd - v_producto.costo_base;

    -- Insertar la venta
    INSERT INTO public.ventas (
        producto_id, juego_id, cantidad,
        tasa_dolar_momento, real_dolar_momento, tasa_binance_momento,
        costo_base_momento, margen_momento,
        precio_venta_usd, precio_venta_bs, ganancia_usd, notas,
        cliente_id, vendedor_id,
        metodo_pago_id, referencia_pago,
        player_id, account_email, account_password,
        pedido_id, owner_id
    ) VALUES (
        p_producto_id, v_producto.juego_id, p_cantidad,
        v_tasa, v_config.real_dolar, v_config.tasa_binance,
        v_producto.costo_base, v_producto.margen_ganancia,
        ROUND(v_venta_usd * p_cantidad, 2),
        ROUND(v_venta_bs * p_cantidad, 2),
        ROUND(v_ganancia * p_cantidad, 2),
        p_notas,
        p_cliente_id,
        p_vendedor_id,
        p_metodo_pago_id, p_referencia_pago,
        p_player_id, p_account_email, p_account_password,
        p_pedido_id, p_owner_id
    ) RETURNING * INTO v_venta;

    RETURN row_to_json(v_venta);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('favicon_url', '/logo.jpg'),
  ('sidebar_logo_url', '/logo.jpg'),
  ('sidebar_title', 'Ceriraga')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
UPDATE public.configuracion 
SET valor_texto = 'https://vsmpxvzmferpqpfaulgb.supabase.co/storage/v1/object/public/logos/apps/latest-release.apk'
WHERE clave = 'apk_url' AND owner_id IS NULL;
-- Migration: 073_security_patch_integral.sql
-- Description: Parche de seguridad integral para corregir RLS y proteger datos sensibles.

-- 1. FUNCIONES DE AYUDA (Helper Functions)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()) = 'ceriraga@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. LIMPIEZA DE POLÃTICAS ANTIGUAS (Reset total)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND (
            policyname LIKE 'auth_all%' OR 
            policyname LIKE 'Permitir %' OR 
            policyname LIKE '%isolation%' OR
            policyname LIKE 'Admins %'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. POLÃTICAS PARA TABLA: CLIENTES (ProtecciÃ³n de identidad)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clientes: ver propio o admin" ON public.clientes;
CREATE POLICY "Clientes: ver propio o admin" ON public.clientes
    FOR SELECT USING (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Clientes: editar propio o admin" ON public.clientes;
CREATE POLICY "Clientes: editar propio o admin" ON public.clientes
    FOR UPDATE USING (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    ) WITH CHECK (
        auth_user_id = auth.uid() 
        OR public.is_admin()
    );

-- 4. POLÃTICAS PARA TABLA: VENTAS (ProtecciÃ³n financiera y claves)
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ventas: acceso restringido" ON public.ventas
    FOR ALL USING (
        public.is_admin() -- Admin ve todo (superadmin controlado en lÃ³gica interna si es necesario)
        OR (rol = 'negocio' AND owner_id = auth.uid()) -- DueÃ±o del negocio ve lo suyo
        OR (cliente_id = auth.uid()) -- El cliente ve su propia compra (pero sin ver campos sensibles?)
    );

-- 5. POLÃTICAS PARA TABLA: CONFIGURACION (ProtecciÃ³n de tasas)
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config: lectura autenticados" ON public.configuracion
    FOR SELECT TO authenticated USING (true); -- Clientes necesitan ver tasas

CREATE POLICY "Config: gestion admin" ON public.configuracion
    FOR ALL USING (
        public.is_admin() 
        OR owner_id = auth.uid()
    );

-- 6. POLÃTICAS PARA TABLA: PRODUCTO_CODIGOS (ProtecciÃ³n de Gift Cards)
ALTER TABLE public.producto_codigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Codigos: solo admin o owner" ON public.producto_codigos
    FOR ALL USING (
        public.is_admin() 
        OR owner_id = auth.uid()
    );

-- 7. REFORZAR FUNCIÃ“N DE ASIGNACIÃ“N DE CÃ“DIGOS (RPC)
CREATE OR REPLACE FUNCTION public.asignar_codigo_pedido_item_rpc(p_pedido_item_id INT)
RETURNS TEXT AS $$
DECLARE
    v_producto_id INT;
    v_pedido_id INT;
    v_cliente_id UUID;
    v_codigo_id INT;
    v_codigo_text TEXT;
BEGIN
    -- 1. Verificar que el usuario que llama es dueÃ±o del pedido O es admin
    SELECT pi.producto_id, pi.pedido_id, p.cliente_id 
    INTO v_producto_id, v_pedido_id, v_cliente_id
    FROM public.pedido_items pi
    JOIN public.pedidos p ON pi.pedido_id = p.id
    WHERE pi.id = p_pedido_item_id;

    IF NOT (v_cliente_id = auth.uid() OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permiso para acceder a este cÃ³digo.';
    END IF;

    -- 2. Buscar un cÃ³digo disponible para ese producto
    SELECT id, codigo INTO v_codigo_id, v_codigo_text
    FROM public.producto_codigos
    WHERE producto_id = v_producto_id AND usado = FALSE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 3. Si encontramos cÃ³digo, asignarlo
    IF v_codigo_id IS NOT NULL THEN
        UPDATE public.producto_codigos 
        SET usado = TRUE, 
            pedido_id = v_pedido_id, 
            usado_at = NOW() 
        WHERE id = v_codigo_id;

        UPDATE public.pedido_items 
        SET codigo_entregado = v_codigo_text 
        WHERE id = p_pedido_item_id;

        RETURN v_codigo_text;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TABLA CUENTAS FORTNITE (Aislamiento total)
ALTER TABLE public.cuentas_fortnite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fortnite: solo admin" ON public.cuentas_fortnite
    FOR ALL USING (public.is_admin());

-- 9. BLINDAJE DE FUNCIONES FINANCIERAS (Wallet RPCs)
CREATE OR REPLACE FUNCTION public.aprobar_recarga_rpc(
    p_recarga_id UUID,
    p_admin_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
BEGIN
    -- SEGURIDAD: Solo un ADMIN real puede aprobar
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acciÃ³n.';
    END IF;

    SELECT auth_user_id, monto INTO v_user_id, v_amount
    FROM public.billetera_recargas
    WHERE id = p_recarga_id AND estado = 'pendiente';

    IF NOT FOUND THEN RETURN FALSE; END IF;

    UPDATE public.billetera_recargas
    SET estado = 'aprobado', atendido_por_id = auth.uid(), -- Usamos auth.uid() real, no el parÃ¡metro
        notas_admin = p_notas, updated_at = now()
    WHERE id = p_recarga_id;

    INSERT INTO public.billeteras (auth_user_id, saldo)
    VALUES (v_user_id, v_amount)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET saldo = public.billeteras.saldo + v_amount, updated_at = now();

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (v_user_id, v_amount, 'recarga', 'Recarga de billetera aprobada', p_recarga_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pagar_con_billetera_rpc(
    p_user_id UUID,
    p_amount NUMERIC,
    p_pedido_id UUID,
    p_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- SEGURIDAD: Solo el dueÃ±o de la billetera puede pagar
    IF NOT (auth.uid() = p_user_id) THEN
        RAISE EXCEPTION 'No puedes pagar con la billetera de otro usuario.';
    END IF;

    SELECT saldo INTO v_current_balance FROM public.billeteras
    WHERE auth_user_id = p_user_id FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    UPDATE public.billeteras SET saldo = saldo - p_amount, updated_at = now()
    WHERE auth_user_id = p_user_id;

    INSERT INTO public.billetera_transacciones (auth_user_id, monto, tipo, descripcion, referencia_id)
    VALUES (p_user_id, -p_amount, 'pago_pedido', p_description, p_pedido_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
-- Migration: 074_deep_security_shield.sql
-- Description: Segundo nivel de blindaje: Almacenamiento y Funciones Administrativas.

-- 1. PROTECCIÃ“N DE LA CUENTA SUPERADMIN (ceriraga@gmail.com)
CREATE OR REPLACE FUNCTION admin_reset_password_rpc(p_user_id UUID, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requester_id UUID;
  v_requester_email TEXT;
  v_target_email TEXT;
  v_is_admin BOOLEAN;
BEGIN
  v_requester_id := auth.uid();
  v_requester_email := (SELECT LOWER(email) FROM auth.users WHERE id = v_requester_id);
  v_target_email := (SELECT LOWER(email) FROM auth.users WHERE id = p_user_id);
  
  -- Verificar que el que llama sea administrador
  SELECT (rol = 'admin') INTO v_is_admin FROM public.perfiles WHERE id = v_requester_id;

  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de administrador');
  END IF;

  -- SEGURIDAD CRÃTICA: Nadie puede cambiar la clave del SuperAdmin excepto Ã©l mismo
  IF v_target_email = 'ceriraga@gmail.com' AND v_requester_email != 'ceriraga@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para modificar la cuenta principal del sistema.');
  END IF;

  -- Actualizar la contraseÃ±a
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. BLINDAJE DE ALMACENAMIENTO (STORAGE)

-- A. Bucket de Avatares: Solo el dueÃ±o modifica
DO $$ BEGIN
    -- Limpiar polÃ­ticas viejas e inseguras
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

    -- Nueva polÃ­tica: Lectura pÃºblica (los avatares suelen ser pÃºblicos)
    CREATE POLICY "Avatares: Lectura pÃºblica" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

    -- Nueva polÃ­tica: Escritura restringida al DUEÃ‘O
    CREATE POLICY "Avatares: Solo dueÃ±o inserta" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (auth.uid() = owner OR owner IS NULL));
    CREATE POLICY "Avatares: Solo dueÃ±o actualiza" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
    CREATE POLICY "Avatares: Solo dueÃ±o borra" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
END $$;

-- B. Bucket de Soporte: PRIVACIDAD TOTAL
UPDATE storage.buckets SET public = false WHERE id = 'soporte_archivos';

DO $$ BEGIN
    -- Limpiar polÃ­ticas viejas
    DROP POLICY IF EXISTS "Acceso PÃºblico a soporte_archivos" ON storage.objects;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos" ON storage.objects;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden borrar sus archivos" ON storage.objects;

    -- Nueva polÃ­tica: Solo DUEÃ‘O o ADMIN pueden ver archivos de soporte
    CREATE POLICY "Soporte: Ver propios o admin" ON storage.objects 
    FOR SELECT TO authenticated 
    USING (
        bucket_id = 'soporte_archivos' 
        AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
    );

    -- Nueva polÃ­tica: Solo autenticados suben a su nombre
    CREATE POLICY "Soporte: Subir propios" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'soporte_archivos' AND (auth.uid() = owner OR owner IS NULL));
END $$;

-- 3. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
-- Migration: 075_fix_configuracion_unique_clave.sql
-- Description: Asegura que la columna 'clave' sea Ãºnica para permitir actualizaciones automÃ¡ticas (UPSERT).

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'configuracion_clave_key'
    ) THEN
        ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
    END IF;
END $$;
-- Migration: 076_fix_configuracion_logic.sql
-- Description: Corrige la lÃ³gica de configuraciÃ³n para permitir multi-tenant y roles insensibles a mayÃºsculas.

-- 1. Corregir restricciones de la tabla configuracion
DO $$ 
BEGIN
    -- Eliminar la restricciÃ³n global restrictiva que impide configuraciones por dueÃ±o
    ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

    -- Asegurar que existe la restricciÃ³n compuesta (clave, owner_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'configuracion_clave_owner_key'
    ) THEN
        ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_owner_key UNIQUE (clave, owner_id);
    END IF;
END $$;

-- 2. Crear un Ã­ndice Ãºnico parcial para la configuraciÃ³n global (donde owner_id es NULL)
-- Esto asegura que solo haya un registro global por cada clave, ya que UNIQUE(clave, owner_id)
-- trata los NULLs como valores distintos.
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_global_unique_idx ON public.configuracion (clave) WHERE owner_id IS NULL;

-- 3. Actualizar funciÃ³n is_admin() para ser mÃ¡s robusta
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles 
    WHERE id = auth.uid() 
    AND LOWER(rol) IN ('admin', 'administrador')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar funciÃ³n is_superadmin() para ser insensible a mayÃºsculas
CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND LOWER(email) = 'ceriraga@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recargar esquema para PostgREST
NOTIFY pgrst, 'reload schema';
-- Migration: 077_fix_configuracion_rpc_types.sql
-- Description: Corrige el error de coincidencia de tipos en COALESCE (numeric vs text) y asegura la integridad de la tabla configuracion.

-- 1. Asegurar tipos de columnas en la tabla configuracion
DO $$ 
BEGIN
    -- Intentar convertir 'valor' a NUMERIC si no lo es
    BEGIN
        ALTER TABLE public.configuracion ALTER COLUMN valor TYPE NUMERIC USING valor::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Intentar convertir 'valor_texto' a TEXT si no lo es
    BEGIN
        ALTER TABLE public.configuracion ALTER COLUMN valor_texto TYPE TEXT USING valor_texto::TEXT;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 2. Reemplazar la funciÃ³n RPC con una versiÃ³n mÃ¡s robusta que usa casts explÃ­citos
CREATE OR REPLACE FUNCTION public.update_config_rpc(
    p_clave TEXT,
    p_valor NUMERIC DEFAULT NULL,
    p_valor_texto TEXT DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Verificar si el registro existe
    IF p_owner_id IS NULL THEN
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id IS NULL;
    ELSE
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id = p_owner_id;
    END IF;

    IF FOUND THEN
        -- Actualizar existente
        IF p_owner_id IS NULL THEN
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, public.configuracion.valor), 
                valor_texto = COALESCE(p_valor_texto, public.configuracion.valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id IS NULL
            RETURNING * INTO v_result;
        ELSE
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, public.configuracion.valor), 
                valor_texto = COALESCE(p_valor_texto, public.configuracion.valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id = p_owner_id
            RETURNING * INTO v_result;
        END IF;
    ELSE
        -- Insertar nuevo
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, COALESCE(p_valor, 0), p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Asegurar permisos
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- 4. Recargar esquema
NOTIFY pgrst, 'reload schema';
-- Migration: Fix Configuracion Constraints and RPC
-- Por favor copia y pega todo este cÃ³digo en el SQL Editor de Supabase y cÃ³rrelo.

-- 1. Eliminar la restricciÃ³n antigua que impedÃ­a a los Negocios tener sus propias claves
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_key;

-- 2. Eliminar cualquier Ã­ndice parcial que cause conflictos con upsert
DROP INDEX IF EXISTS public.configuracion_clave_owner_idx;
DROP INDEX IF EXISTS public.configuracion_clave_global_idx;

-- 3. Crear la restricciÃ³n Ãºnica correcta para la base de datos
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_clave_owner_key;
ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_owner_key UNIQUE (clave, owner_id);

-- 4. Crear la funciÃ³n RPC para que el sistema pueda guardar de forma segura
CREATE OR REPLACE FUNCTION public.update_config_rpc(
    p_clave TEXT,
    p_valor NUMERIC DEFAULT NULL,
    p_valor_texto TEXT DEFAULT NULL,
    p_owner_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Verificar si el registro existe
    IF p_owner_id IS NULL THEN
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id IS NULL;
    ELSE
        SELECT * INTO v_result FROM public.configuracion WHERE clave = p_clave AND owner_id = p_owner_id;
    END IF;

    IF FOUND THEN
        -- Actualizar existente
        IF p_owner_id IS NULL THEN
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id IS NULL
            RETURNING * INTO v_result;
        ELSE
            UPDATE public.configuracion 
            SET valor = COALESCE(p_valor, valor), 
                valor_texto = COALESCE(p_valor_texto, valor_texto),
                updated_at = NOW()
            WHERE clave = p_clave AND owner_id = p_owner_id
            RETURNING * INTO v_result;
        END IF;
    ELSE
        -- Insertar nuevo
        INSERT INTO public.configuracion (clave, valor, valor_texto, owner_id)
        VALUES (p_clave, COALESCE(p_valor, 0), p_valor_texto, p_owner_id)
        RETURNING * INTO v_result;
    END IF;

    RETURN row_to_json(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Otorgar permisos
GRANT EXECUTE ON FUNCTION public.update_config_rpc(TEXT, NUMERIC, TEXT, UUID) TO authenticated;

-- 6. Recargar cachÃ© de esquema
NOTIFY pgrst, 'reload schema';
