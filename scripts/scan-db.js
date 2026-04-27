import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function scanTables() {
  const { data, error } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public')

  // Si pg_tables no es accesible, probaremos con una consulta directa de nombres comunes
  const tables = ['categorias', 'productos', 'items', 'juegos', 'servicios', 'precios', 'inventory']
  console.log('--- Verificando existencia de tablas comunes ---')
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    if (!error) {
       console.log(`✅ Tabla [${t}] existe y tiene ${count} filas.`)
    } else {
       console.log(`❌ Tabla [${t}] error: ${error.message}`)
    }
  }
}

scanTables()
