import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) process.env.VITE_SUPABASE_URL = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].replace(/['"]/g, '').trim();
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testPinCentral() {
  console.log("🚀 Probando PinCentral Proxy...");
  
  try {
    // Necesitamos simular una petición a nuestro propio proxy (o llamar a la función de proxy directamente)
    // Para simplificar en local, llamamos al proxy pasándole un mock req/res.
    const { default: handler } = await import('./api-core/pincentral/proxy.js');
    
    // 1. Probar GET /api/products
    console.log("⏳ Obteniendo catálogo...");
    let req = {
      method: 'GET',
      query: { endpoint: 'products' }
    };
    
    let res = {
      status: (code) => ({
        json: (data) => console.log(`[Status ${code}] Catálogo:`, data.length ? `${data.length} productos obtenidos.` : data)
      })
    };
    
    await handler(req, res);
    
    // 2. Probar GET /api/account
    console.log("\n⏳ Obteniendo saldo de cuenta...");
    req = {
      method: 'GET',
      query: { endpoint: 'account' }
    };
    
    res = {
      status: (code) => ({
        json: (data) => console.log(`[Status ${code}] Cuenta:`, data)
      })
    };
    
    await handler(req, res);
    
    // 3. Probar un POST a /api/pins/stock para algún producto, ej "TUFF10" u otro si existe.
    console.log("\n⏳ Probando POST a stock para RZRG100 (solo si existe, es ejemplo del PDF)...");
    req = {
      method: 'POST',
      query: { endpoint: 'pins/stock' },
      body: {
        product: "RZRG100"
      }
    };
    
    res = {
      status: (code) => ({
        json: (data) => console.log(`[Status ${code}] Stock:`, data)
      })
    };
    
    await handler(req, res);

    console.log("\n✅ Pruebas finalizadas.");
  } catch (err) {
    console.error("❌ Error en la prueba:", err);
  }
}

testPinCentral();
