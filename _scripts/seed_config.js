import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) process.env.VITE_SUPABASE_URL = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Inserción de configuración...");
  const { data, error } = await supabase.from('configuracion').insert([
    {
      clave: 'pincentral_api_key',
      valor_texto: 'sWRbhz5dgJRtcsdn',
      descripcion: 'API Key para integración con PinCentral Sandbox'
    },
    {
      clave: 'pincentral_api_secret',
      valor_texto: '_@fXGRLEy8k43e2cy97wvL.zVXeHg:A9',
      descripcion: 'API Secret para integración con PinCentral Sandbox'
    }
  ]);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Configuración actualizada.");
  }
}

run();
