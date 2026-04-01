-- Migration: Lógica y almacenamiento para logos de juegos
-- OJO: La tabla 'juegos' ya cuenta con la columna 'icono_url'.
-- Este archivo crea un nuevo "bucket" (carpeta de almacenamiento) en Supabase 
-- llamado "logos" donde se subirán las imágenes, y establece las 
-- políticas de seguridad correspondientes.

-- 1. Crear el bucket "logos" si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar la seguridad de filas en el almacenamiento (si no está habilitado)
-- CREATE POLICY IF NOT EXISTS para buckets es un poco distinto, así que usamos un bloque condicional.
DO $$
BEGIN
    -- Permitir lectura a todo el mundo (anónimo o logueado)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lectura pública de logos') THEN
        CREATE POLICY "Lectura pública de logos" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'logos');
    END IF;

    -- Permitir que CUALQUIER USUARIO AUTENTICADO pueda subir un logo
    -- (Es un panel de admin, todos los que inician sesión son administradores por ahora en el dashboard final)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden subir logos') THEN
        CREATE POLICY "Autenticados pueden subir logos" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'logos');
    END IF;

    -- Permitir que los autenticados puedan actualizar sus subidas (o cualquiera en el bucket de logos)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden modificar logos') THEN
        CREATE POLICY "Autenticados pueden modificar logos" 
        ON storage.objects FOR UPDATE 
        TO authenticated 
        USING (bucket_id = 'logos');
    END IF;

    -- Permitir eliminar
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados pueden borrar logos') THEN
        CREATE POLICY "Autenticados pueden borrar logos" 
        ON storage.objects FOR DELETE 
        TO authenticated 
        USING (bucket_id = 'logos');
    END IF;
END $$;
