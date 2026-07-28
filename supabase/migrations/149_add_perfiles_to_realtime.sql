-- Habilitar realtime para la tabla perfiles
DO $ $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'perfiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE perfiles;
    END IF;
END $ $;
NOTIFY pgrst, 'reload schema';
