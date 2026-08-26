import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    const { data: configRows } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'tiendagiftven_api_key').single();
    const apiKey = configRows?.valor_texto;

    if (!apiKey || apiKey === '0') {
      return res.status(400).json({ error: 'API Key not found in DB' });
    }

    const webhookUrl = 'https://recargashulk.com/api/tiendagiftven/webhook';
    const resp = await fetch('https://tiendagiftven.tech/api/v1/webhook', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await resp.json();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Intentado registrar webhook', 
      tiendagiftven_response: data 
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
