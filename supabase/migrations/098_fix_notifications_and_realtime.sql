-- 098_fix_notifications_and_realtime.sql
-- Enable Realtime for notifications and cleanup duplicate logic

-- 1. Enable Realtime for the notifications table
-- This is required for the landing page bell to update instantly
BEGIN;
  -- Attempt to add the table (it will error if already there, so we wrap it or just use a simpler command)
  -- In Supabase, usually we just need to add it. If it fails because it exists, it's fine.
  -- But to be clean:
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'notificaciones_usuarios'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones_usuarios;
    END IF;
  END $$;
COMMIT;

-- 2. Ensure RLS allows the trigger to work (Triggers bypass RLS but good to be sure)
-- No changes needed to RLS for now.

-- 3. Mark old notifications as read if they are very old (Optional cleanup)
-- UPDATE notificaciones_usuarios SET leido = true WHERE created_at < NOW() - INTERVAL '30 days' AND leido = false;
