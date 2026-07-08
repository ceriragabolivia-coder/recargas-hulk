DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_clave_key'
    ) THEN
        ALTER TABLE configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
    END IF;
END $$;
