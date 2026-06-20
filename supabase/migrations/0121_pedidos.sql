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

-- Función para generar número de pedido automáticamente
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
DROP POLICY IF EXISTS "auth_all" ON pedido_items;
CREATE POLICY "auth_all" ON pedido_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recargar caché
NOTIFY pgrst, 'reload schema';
