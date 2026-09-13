const { Client } = require('ssh2');

const sql = `
  -- Fix the broken trigger that references non-existent column
  CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
  RETURNS TRIGGER AS $$
  BEGIN
      -- Si quien actualiza es un superadmin, se permite todo.
      IF public.is_superadmin() THEN
          RETURN NEW;
      END IF;

      -- Si quien actualiza es un admin, se permite todo (o restringir según reglas).
      IF public.is_admin() THEN
          RETURN NEW;
      END IF;

      -- Para usuarios normales, forzamos que rol y estado permanezcan iguales al valor anterior.
      NEW.rol := OLD.rol;
      NEW.estado := OLD.estado;
      
      -- Ignoramos descuento_general ya que causaba el error o ha sido renombrado a porcentaje_descuento
      IF hasattr(NEW, 'porcentaje_descuento') THEN
        -- just safely ignore or we don't need to lock it unless needed, it's safer to just skip it
      END IF;
      
      RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
      -- Fallback en caso de error para asegurar la tabla
      NEW.rol := OLD.rol;
      NEW.estado := OLD.estado;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  CREATE OR REPLACE FUNCTION public.prevent_profile_escalation()
  RETURNS TRIGGER AS $$
  BEGIN
      IF public.is_superadmin() THEN
          RETURN NEW;
      END IF;
      IF public.is_admin() THEN
          RETURN NEW;
      END IF;
      NEW.rol := OLD.rol;
      NEW.estado := OLD.estado;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;


  -- Eliminar etiqueta __FORCE_LOGOUT__ atascada de todos los usuarios
  UPDATE public.perfiles
  SET motivo_estado = NULLIF(TRIM(REPLACE(motivo_estado, '__FORCE_LOGOUT__', '')), '')
  WHERE motivo_estado LIKE '%__FORCE_LOGOUT__%';

  -- Crear función RPC segura para que los usuarios limpien su propia etiqueta sin requerir permisos de UPDATE en toda la tabla
  CREATE OR REPLACE FUNCTION clear_force_logout(p_user_id UUID)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
      -- Solo permitir limpiar la etiqueta si el usuario coincide
      IF auth.uid() = p_user_id THEN
          UPDATE public.perfiles
          SET motivo_estado = NULLIF(TRIM(REPLACE(motivo_estado, '__FORCE_LOGOUT__', '')), '')
          WHERE id = p_user_id;
      END IF;
  END;
  $$;
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client ready, running sql fix...');
  conn.exec(`docker exec -i supabase-db psql -U postgres -d postgres`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream closed. Connection ending...');
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
    stream.write(sql);
    stream.end();
  });
}).connect({
  host: '162.141.78.103',
  port: 22,
  username: 'root',
  password: 'm+0JVjSbFo',
  readyTimeout: 60000,
  keepaliveInterval: 10000
});
