-- ============================================
-- ESQUEMA COMPLETO: Sistema de Recargas Ceriraga
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. CONFIGURACIÓN GLOBAL
CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor NUMERIC NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('tasa_binance', 650, 'Tasa Binance en Bs por USD'),
    ('tasa_dolar', 690, 'Tasa del dólar en Bs por USD'),
    ('descuentos', 0, 'Descuento general (%)'),
    ('real_dolar', 165, 'Tasa real del dólar'),
    ('costo_pinsmile', 17.5, 'Costo de Pin Smile'),
    ('porcentaje_paypal', 0.08, 'Porcentaje de comisión PayPal')
ON CONFLICT (clave) DO NOTHING;

-- 2. CATEGORÍAS
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    icono VARCHAR(50),
    orden INT DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE
);

INSERT INTO categorias (nombre, icono, orden) VALUES
    ('Shooters/Battle Royale', '🔫', 1),
    ('MOBA/RPG', '⚔️', 2),
    ('Gacha/Anime', '🎮', 3),
    ('Gift Cards', '🎁', 4),
    ('Suscripciones', '📱', 5),
    ('Exchangers/Wallets', '💱', 6),
    ('Redes/Streaming', '📺', 7),
    ('Otros', '📦', 8)
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

-- 9. FUNCIÓN: Registrar venta
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

-- Políticas: usuarios autenticados pueden todo
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
