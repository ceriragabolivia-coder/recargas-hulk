-- 101_admin_notifications.sql
-- Create table for admin-only notifications

CREATE TABLE IF NOT EXISTS notificaciones_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    tipo TEXT, -- 'new_user', 'new_order', 'wallet_recharge', etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notificaciones_admin ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view notifications"
    ON notificaciones_admin FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM perfiles
            WHERE id = auth.uid()
            AND (rol = 'admin' OR rol = 'administrador' OR rol = 'negocio')
        )
    );

CREATE POLICY "Admins can update notifications (mark as read)"
    ON notificaciones_admin FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM perfiles
            WHERE id = auth.uid()
            AND (rol = 'admin' OR rol = 'administrador' OR rol = 'negocio')
        )
    )
    WITH CHECK (true);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications"
    ON notificaciones_admin FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Update handle_new_user to notify admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create Profile
  INSERT INTO public.perfiles (id, rol, estado)
  VALUES (new.id, 'cliente', 'pendiente');

  -- 2. Create Client record using metadata
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

  -- 3. Notify Admins
  INSERT INTO public.notificaciones_admin (
    titulo,
    mensaje,
    tipo,
    metadata
  )
  VALUES (
    'Nuevo Usuario Registrado',
    'El usuario ' || new.email || ' se ha registrado.',
    'new_user',
    jsonb_build_object('user_id', new.id, 'email', new.email)
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
