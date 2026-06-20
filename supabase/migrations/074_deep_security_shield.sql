-- Migration: 074_deep_security_shield.sql
-- Description: Segundo nivel de blindaje: Almacenamiento y Funciones Administrativas.

-- 1. PROTECCIÓN DE LA CUENTA SUPERADMIN (recargashulk@gmail.com)
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

  -- SEGURIDAD CRÍTICA: Nadie puede cambiar la clave del SuperAdmin excepto él mismo
  IF v_target_email = 'recargashulk@gmail.com' AND v_requester_email != 'recargashulk@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para modificar la cuenta principal del sistema.');
  END IF;

  -- Actualizar la contraseña
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. BLINDAJE DE ALMACENAMIENTO (STORAGE)

-- A. Bucket de Avatares: Solo el dueño modifica
DO $$ BEGIN
    -- Limpiar políticas viejas e inseguras
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

    -- Nueva política: Lectura pública (los avatares suelen ser públicos)
    CREATE POLICY "Avatares: Lectura pública" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

    -- Nueva política: Escritura restringida al DUEÑO
    CREATE POLICY "Avatares: Solo dueño inserta" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (auth.uid() = owner OR owner IS NULL));
    CREATE POLICY "Avatares: Solo dueño actualiza" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
    CREATE POLICY "Avatares: Solo dueño borra" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
END $$;

-- B. Bucket de Soporte: PRIVACIDAD TOTAL
UPDATE storage.buckets SET public = false WHERE id = 'soporte_archivos';

DO $$ BEGIN
    -- Limpiar políticas viejas
    DROP POLICY IF EXISTS "Acceso Público a soporte_archivos" ON storage.objects;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos" ON storage.objects;
    DROP POLICY IF EXISTS "Usuarios autenticados pueden borrar sus archivos" ON storage.objects;

    -- Nueva política: Solo DUEÑO o ADMIN pueden ver archivos de soporte
    CREATE POLICY "Soporte: Ver propios o admin" ON storage.objects 
    FOR SELECT TO authenticated 
    USING (
        bucket_id = 'soporte_archivos' 
        AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
    );

    -- Nueva política: Solo autenticados suben a su nombre
    CREATE POLICY "Soporte: Subir propios" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'soporte_archivos' AND (auth.uid() = owner OR owner IS NULL));
END $$;

-- 3. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
