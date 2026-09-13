const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2FvbGtpb29vc21kaWlwbmtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkxOTY1NiwiZXhwIjoyMDk3NDk1NjU2fQ.GihNB21XQWuMEstWeXL8HoFPHj71BHcKWKRiu8OZ03A'); // Use Service Role Key for DDL
async function test() {
  const query = `
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_clave_key'
        ) THEN
            ALTER TABLE configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
        END IF;
    END $$;
  `;
  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  console.log('Update result:', data, error);
}
test();
