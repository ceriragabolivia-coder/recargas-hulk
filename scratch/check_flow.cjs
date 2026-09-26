import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkFlow() {
  const { data } = await supabase.from('configuracion').select('valor_texto').eq('clave', 'chatbot_flujo').single();
  if (data) {
    const flow = JSON.parse(data.valor_texto);
    const node = flow.find(n => n.solicitar_pedido);
    console.log("Node with solicitar_pedido:", node);
  } else {
    console.log("No config found");
  }
}
checkFlow();
