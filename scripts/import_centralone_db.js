import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getCatalog } from '../api-core/centralone/client.js';

// Conexión a Supabase usando las variables de entorno existentes
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan las credenciales de Supabase en el .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importCatalog() {
    console.log('=== Importador de Catálogo de Central One ===');
    try {
        console.log('1. Descargando catálogo de Central One...');
        const catalogRes = await getCatalog();
        const items = catalogRes.items || [];
        
        console.log(`✅ Catálogo descargado. ${items.length} productos encontrados.`);
        
        // Mapeo básico: Aquí decides qué productos importar o cómo enlazarlos
        // Puedes filtrar por "product_family_id" para importar solo los juegos deseados
        
        // Ejemplo: Importar solo Free Fire para probar (descomentar y adaptar según necesidad)
        /*
        const freeFireItems = items.filter(i => i.product_family_id === 'free-fire');
        
        let inserted = 0;
        let errors = 0;

        console.log(`2. Insertando ${freeFireItems.length} productos de Free Fire en la base de datos...`);
        
        for (const item of freeFireItems) {
            const nuevoProducto = {
                nombre: item.name,
                costo_base: parseFloat(item.reseller_price),
                proveedor_api_id: item.product_id, // Usado para referenciar en las compras
                api_provider: 'centralone',
                api_provider_category_id: item.product_family_id,
                activo: true,
                // juego_id: 'ID_DEL_JUEGO_EN_TU_BD', // DEBES MAPEAR ESTO A TU JUEGO EXISTENTE
            };

            // Intentar insertar
            const { error } = await supabase
                .from('productos')
                .insert([nuevoProducto]);

            if (error) {
                console.error(`Error insertando ${item.name}:`, error.message);
                errors++;
            } else {
                inserted++;
            }
        }

        console.log(`✅ Importación finalizada. Insertados: ${inserted}. Errores: ${errors}.`);
        */
       
        console.log('\n> 💡 NOTA: Revisa el script `scripts/import_centralone_db.js` y ajusta el mapeo de "juego_id" antes de ejecutar las inserciones masivas.');

    } catch (error) {
        console.error('❌ Error durante la importación:', error.message);
    }
}

importCatalog();
