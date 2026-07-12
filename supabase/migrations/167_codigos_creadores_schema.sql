-- Migration 167: Sistema de Códigos de Creadores

-- 1. Tabla de códigos
CREATE TABLE IF NOT EXISTS public.codigos_creadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    creador_nombre TEXT NOT NULL,
    porcentaje_descuento NUMERIC NOT NULL DEFAULT 0,
    limite_global INTEGER NOT NULL DEFAULT 0,
    compras_con_descuento_por_usuario INTEGER NOT NULL DEFAULT 1,
    usos_totales INTEGER NOT NULL DEFAULT 0,
    usuarios_registrados INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.codigos_creadores ENABLE ROW LEVEL SECURITY;

-- Politicas para codigos_creadores
DROP POLICY IF EXISTS "Lectura publica de codigos creadores activos" ON public.codigos_creadores;
CREATE POLICY "Lectura publica de codigos creadores activos"
ON public.codigos_creadores FOR SELECT
USING (activo = true);

DROP POLICY IF EXISTS "Full access para superadmin y admin codigos creadores" ON public.codigos_creadores;
CREATE POLICY "Full access para superadmin y admin codigos creadores"
ON public.codigos_creadores FOR ALL
USING (
    public.is_superadmin() OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND (rol IN ('admin', 'administrador', 'empleado', 'trabajador')))
);

-- 2. Modificaciones a la tabla clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS creador_codigo_id UUID REFERENCES public.codigos_creadores(id) ON DELETE SET NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS compras_con_codigo_creador INTEGER NOT NULL DEFAULT 0;

-- 3. Actualizar trigger handle_new_user para capturar el código del metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_creador_codigo TEXT;
    v_creador_id UUID;
BEGIN
    -- 1. Crear perfil con estado pendiente
    INSERT INTO public.perfiles (id, rol, estado)
    VALUES (new.id, 'cliente', 'pendiente')
    ON CONFLICT (id) DO NOTHING;

    -- Extraer codigo de creador si existe
    v_creador_codigo := NULLIF(TRIM(new.raw_user_meta_data->>'creador_codigo'), '');
    IF v_creador_codigo IS NOT NULL THEN
        SELECT id INTO v_creador_id FROM public.codigos_creadores WHERE codigo = UPPER(v_creador_codigo) AND activo = true AND usos_totales < limite_global;
    END IF;

    -- 2. Crear registro en clientes
    BEGIN
        INSERT INTO public.clientes (
            auth_user_id,
            usuario,
            nombres,
            apellidos,
            nickname,
            whatsapp,
            pais,
            estado,
            fecha_registro,
            creador_codigo_id
        ) VALUES (
            new.id,
            new.email,
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nombres'), ''), split_part(new.email, '@', 1)),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'apellidos'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'nickname'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'whatsapp'), ''), ''),
            COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'pais'), ''), 'Venezuela'),
            'pendiente',
            NOW(),
            v_creador_id
        );

        -- Incrementar contador de referidos
        IF v_creador_id IS NOT NULL THEN
            UPDATE public.codigos_creadores SET usuarios_registrados = usuarios_registrados + 1 WHERE id = v_creador_id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        BEGIN
            UPDATE public.clientes 
            SET auth_user_id = new.id, estado = 'pendiente', creador_codigo_id = COALESCE(creador_codigo_id, v_creador_id)
            WHERE LOWER(usuario) = LOWER(new.email) AND auth_user_id IS NULL;
            
            IF v_creador_id IS NOT NULL AND FOUND THEN
                UPDATE public.codigos_creadores SET usuarios_registrados = usuarios_registrados + 1 WHERE id = v_creador_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    -- 3. Notificar a admins
    BEGIN
        INSERT INTO public.notificaciones_admin (titulo, mensaje, tipo, metadata)
        VALUES (
            '🆕 Nuevo Usuario Registrado',
            'El usuario ' || new.email || ' se ha registrado y está pendiente de aprobación.',
            'new_user',
            jsonb_build_object('user_id', new.id, 'email', new.email, 'nombres', new.raw_user_meta_data->>'nombres')
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Exponer codigos_creadores en el schema para postgrest
NOTIFY pgrst, 'reload schema';
