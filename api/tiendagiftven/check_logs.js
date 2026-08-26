import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('mensajes_sistema')
      .select('*')
      .eq('titulo', 'Webhook Recibido TiendaGiftVen')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ logs: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
