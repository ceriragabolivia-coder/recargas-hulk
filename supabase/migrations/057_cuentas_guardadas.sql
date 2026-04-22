-- Migración para guardar IDs y datos de cuenta de usuarios
CREATE TABLE IF NOT EXISTS cuentas_guardadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    juego_id UUID NOT NULL REFERENCES juegos(id) ON DELETE CASCADE,
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

-- Políticas de seguridad
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

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cuentas_guardadas_updated_at
    BEFORE UPDATE ON cuentas_guardadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
