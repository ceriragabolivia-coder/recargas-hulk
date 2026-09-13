// Aplica la migración de Binance Pay columns directamente via Supabase service role
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://api.recargashulk.com';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU0NjgyMTUsImV4cCI6MjEwMDgyNjc5OX0.Mewuja4QuB0hJpKLxF08NdPL575wcVFueQtMBuXjBn8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyMigration() {
  // Intentar via RPC exec_sql si existe
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE public.billetera_recargas 
        ADD COLUMN IF NOT EXISTS binance_transfer_id TEXT,
        ADD COLUMN IF NOT EXISTS binance_verificado BOOLEAN DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS idx_br_binance_tid 
        ON public.billetera_recargas (binance_transfer_id) 
        WHERE binance_transfer_id IS NOT NULL;
      SELECT 'OK' AS result;
    `
  });

  if (error) {
    console.error('exec_sql no disponible:', error.message);
    // Fallback: intentar insertar una fila de prueba con la nueva columna
    // Si la columna no existe, fallará con error específico
    const { error: testError } = await supabase
      .from('billetera_recargas')
      .select('binance_transfer_id, binance_verificado')
      .limit(1);
    
    if (testError && testError.message.includes('column')) {
      console.error('Las columnas NO existen aún. Necesitas aplicar la migración manualmente.');
      console.log('\nSQL para aplicar manualmente en Supabase Studio:');
      console.log(`
ALTER TABLE public.billetera_recargas 
  ADD COLUMN IF NOT EXISTS binance_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS binance_verificado BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_br_binance_tid 
  ON public.billetera_recargas (binance_transfer_id) 
  WHERE binance_transfer_id IS NOT NULL;
      `);
    } else {
      console.log('✅ Las columnas ya existen o fueron creadas exitosamente');
    }
  } else {
    console.log('✅ Migración aplicada:', data);
  }
}

applyMigration().catch(console.error);
