const { createClient } = require('@supabase/supabase-js');

// Using prod URL and Anon Key from .env.vercel.prod / apply_migration.cjs
const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sql = `
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

  -- Actualizar la contraseña usando extensions explícitamente para evitar error "gen_salt(unknown) does not exist"
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
`;

async function fixPasswordReset() {
  try {
    console.log("Applying fix...");
    const { data, error } = await supabase.rpc('exec_sql', { p_sql: sql });
    if (error) {
      console.error("❌ Error:");
      console.error(error.message);
    } else {
      console.log("✅ Fix applied successfully!");
      console.log(data);
    }
  } catch (err) {
    console.error(err);
  }
}

fixPasswordReset();
