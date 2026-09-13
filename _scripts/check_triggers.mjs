import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2FvbGtpb29vc21kaWlwbmtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTkxOTY1NiwiZXhwIjoyMDk3NDk1NjU2fQ.GihNB21XQWuMEstWeXL8HoFPHj71BHcKWKRiu8OZ03A'
);

async function check() {
  const { data, error } = await supabase.rpc('get_triggers_list');
  console.log('Triggers:', data || error);
}

check();
