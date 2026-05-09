
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
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

async function updateGames() {
    console.log('--- Updating Games ---');
    
    // 1. Set discount tag for all active games that show on landing
    const { error: tagError } = await supabase
        .from('juegos')
        .update({ etiqueta_descuento: '-10% Descuento' })
        .eq('activo', true);
    
    if (tagError) console.error('Error updating tags:', tagError);
    else console.log('Tags updated successfully.');

    // 2. Ensure common games with icons are visible and have good ordering
    // I'll give them an order so they appear after the first 12
    const gamesToArrange = [
        { id: 7, orden: 12 },  // Clash of Clans
        { id: 6, orden: 13 },  // Clash Royale
        { id: 36, orden: 14 }, // Honor of Kings
        { id: 39, orden: 15 }, // Endfield
        { id: 38, orden: 16 }, // Flex City
        { id: 41, orden: 17 }, // One State
        { id: 23, orden: 18 }, // Riot Access
        { id: 27, orden: 19 }, // TikTok
        { id: 33, orden: 20 }, // WildRift
        { id: 16, orden: 21 }  // Xbox Gift Card
    ];

    for (const g of gamesToArrange) {
        await supabase.from('juegos').update({ mostrar_en_landing: true, orden_landing: g.orden }).eq('id', g.id);
    }
    console.log('Game ordering and visibility updated.');

    // 3. Activate useful categories
    const { error: catError } = await supabase
        .from('categorias')
        .update({ activa: true })
        .in('id', [5, 6, 7]); // Suscripciones, Exchangers, Redes
    
    if (catError) console.error('Error updating categories:', catError);
    else console.log('Categories activated successfully.');
}

updateGames();
