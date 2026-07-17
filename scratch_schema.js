import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const envConfig = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envConfig[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function getProductsSchema() {
    // Attempt to fetch 1 product to see columns
    const { data: products, error } = await supabase.from('productos').select('*').limit(1);
    console.log('Productos:', products, error);
    
    // Check categorias
    const { data: categorias, errorCat } = await supabase.from('categorias').select('*').limit(1);
    console.log('Categorias:', categorias, errorCat);
}

getProductsSchema();
