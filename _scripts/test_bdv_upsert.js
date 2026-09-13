import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  const updates = [
    {
      clave: 'bdv_api_enabled',
      valor_texto: 'false',
      valor: 0,
      descripcion: 'Habilitar integración con API de BDV para validación automática'
    },
    {
      clave: 'bdv_api_key',
      valor_texto: 'test',
      valor: 0,
      descripcion: 'Clave API para el servicio de verificación BDV'
    },
    {
      clave: 'bdv_password',
      valor_texto: 'test',
      valor: 0,
      descripcion: 'Contraseña de la cuenta BDV para la API'
    }
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from('configuracion')
      .upsert(update, { onConflict: 'clave, owner_id' });
    
    if (error) {
      console.error('Error for', update.clave, error);
    } else {
      console.log('Success for', update.clave);
    }
  }
}
test();
