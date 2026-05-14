
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOrderDate() {
  const { data, error } = await supabase.from('pedidos').select('numero_pedido, created_at').order('created_at', { ascending: false }).limit(5);
  if (error) console.error(error);
  else {
    console.log('Orders found:', data.length);
    if (data.length > 0) {
      data.forEach(order => {
        console.log(`Order #${order.numero_pedido}: ${order.created_at}`);
        const d = new Date(order.created_at);
        console.log(`  Caracas: ${d.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`);
      });
    }
  }
}

checkOrderDate();
