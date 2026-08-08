const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || "https://xozrsqkpxrzvtdkftwzh.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvenJzcWtweHJ6dnRka2Z0d3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI2MjgzNjksImV4cCI6MjAzODIwNDM2OX0.xyz"; // wait I need the real anon key!
// Let me just read it from .env.vercel
const fs = require('fs');
const env = fs.readFileSync('.env.vercel', 'utf8');
const envUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const envKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(envUrl, envKey);

async function check() {
  const { data, error } = await supabase
    .from('pedido_items')
    .select('id, pedido_id, proveedor_pedido_id, estado_proveedor')
    .order('id', { ascending: false })
    .limit(5);
  
  if (error) console.error(error);
  else console.log(data);
}
check();
