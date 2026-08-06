-- Crear la tabla de seguridad para intentos fallidos si no existe
CREATE TABLE IF NOT EXISTS public.seguridad_intentos_pines (
    auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS en la tabla
ALTER TABLE public.seguridad_intentos_pines ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores (en caso de que existieran)
DROP POLICY IF EXISTS "Acceso a seguridad intentos" ON public.seguridad_intentos_pines;
DROP POLICY IF EXISTS "Nadie puede ver la tabla de intentos excepto rpc" ON public.seguridad_intentos_pines;

-- Crear política de seguridad para la tabla de intentos (bloqueo total)
CREATE POLICY "Nadie puede ver la tabla de intentos excepto rpc" 
ON public.seguridad_intentos_pines FOR ALL 
TO authenticated 
USING (false) 
WITH CHECK (false);

-- Notificar a postgREST para que recargue el schema
NOTIFY pgrst, 'reload schema';
