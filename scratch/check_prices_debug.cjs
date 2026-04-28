
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsmpxvzmferpqpfaulgb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbXB4dnptZmVycHFwZmF1bGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODA4MDgsImV4cCI6MjA4MzU1NjgwOH0.hvyym0kambGKK-6mJK-47Ld4nkTY6Q1MF8mMIez7myQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfigAndProducts() {
  const { data: config } = await supabase.from('configuracion').select('*');
  const { data: productos } = await supabase.from('productos').select('*, juegos(*)').ilike('nombre', '%110 Diamantes%');

  console.log('--- Configuración ---');
  config.forEach(c => console.log(`${c.clave}: ${c.valor} / ${c.valor_texto}`));

  console.log('\n--- Producto: 110 Diamantes ---');
  productos.forEach(p => {
    console.log(`Nombre: ${p.nombre}`);
    console.log(`Costo Base: ${p.costo_base}`);
    console.log(`Margen: ${p.margen_ganancia}`);
    console.log(`Precio Venta Fijo: ${p.precio_venta_fijo}`);
  });
}

checkConfigAndProducts();
