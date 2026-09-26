import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ping, getBalance, getCatalog } from '../api-core/centralone/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('=== Test Central One API ===');
    
    try {
        console.log('\n1. Probando ping...');
        const pingRes = await ping();
        console.log('Ping OK:', pingRes);

        console.log('\n2. Obteniendo saldo...');
        const balanceRes = await getBalance();
        console.log('Saldo:', balanceRes);

        console.log('\n3. Obteniendo catálogo...');
        const catalogRes = await getCatalog();
        console.log(`Catálogo obtenido con ${catalogRes.items?.length || 0} productos.`);
        
        // Guardar el catálogo en un archivo para revisión
        const scratchDir = path.join(__dirname, '../scratch');
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir);
        }
        
        const outPath = path.join(scratchDir, 'centralone_catalog.json');
        fs.writeFileSync(outPath, JSON.stringify(catalogRes, null, 2));
        console.log(`\nEl catálogo completo se ha guardado en: ${outPath}`);
        
        // Mostrar una muestra del primer producto
        if (catalogRes.items && catalogRes.items.length > 0) {
            console.log('\nMuestra del primer producto:');
            console.log(JSON.stringify(catalogRes.items[0], null, 2));
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.data) {
            console.error('Detalles:', error.data);
        }
    }
}

run();
