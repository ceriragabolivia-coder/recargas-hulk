import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { data: perfiles, error } = await supabase.from('perfiles').select('id, nombres, email, saldo, rol').lt('saldo', 0);
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  return res.status(200).json({ data: perfiles });
}
