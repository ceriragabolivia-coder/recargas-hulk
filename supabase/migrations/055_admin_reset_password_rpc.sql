-- Función para que los administradores puedan restablecer contraseñas de usuarios manualmente
-- Esta función corre con privilegios de SUPERUSER (SECURITY DEFINER) para poder modificar auth.users

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
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de administrador para realizar esta acción');
  END IF;

  -- 3. Actualizar la contraseña en auth.users
  -- Nota: Usamos crypt de pgcrypto que es lo que Supabase usa internamente.
  -- Asegurarse de que la extensión pgcrypto esté disponible (Suele estarlo por defecto en Supabase)
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

-- Otorgar permiso de ejecución a usuarios autenticados (la función misma valida luego si es admin)
GRANT EXECUTE ON FUNCTION admin_reset_password_rpc(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_password_rpc(UUID, TEXT) TO service_role;
