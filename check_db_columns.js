import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase.from('metodos_pago').select('*');
    if (error) {
      console.error('Error fetching metodos_pago:', error);
    } else {
      console.log('Metodos found:', data.length);
      if (data.length > 0) {
        console.log('Columns in metodos_pago:', Object.keys(data[0]));
        data.forEach(m => {
          console.log(`- ${m.nombre}: Icon=${m.icono_url ? 'YES' : 'NO'}, QR=${m.qr_url ? 'YES' : 'NO'}`);
          if (m.qr_url) console.log(`  QR URL: ${m.qr_url}`);
        });
      }
    }
  } catch (e) {
    console.error('Caught error:', e);
  }
}

check();
