import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let supabaseUrl = 'https://pivysqtxjnhnmdgixjiy.supabase.co';
let supabaseKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function unverifyAndTrigger() {
  // 1. Unverify order 98
  await supabase
    .from('pedidos')
    .update({ pago_verificado: false })
    .eq('id', 98);
    
  console.log("Unverified order 98");
}

unverifyAndTrigger();
