-- Migration: 180_fix_admin_reset_password_rpc.sql
-- Description: Fix "gen_salt(unknown) does not exist" error by explicitly calling extensions.crypt and extensions.gen_salt

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

  -- Actualizar la contraseña referenciando el schema extensions para evitar error gen_salt(unknown)
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
