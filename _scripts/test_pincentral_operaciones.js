import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) process.env.VITE_SUPABASE_URL = line.split('=')[1].replace(/['"]/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].replace(/['"]/g, '').trim();
});

// El proxy se importará dinámicamente más abajo para respetar las variables de entorno

// --- FUNCIÓN DE AYUDA PARA SIMULAR PETICIONES AL PROXY ---
async function callProxy(method, endpoint, body = null) {
  const { default: proxyHandler } = await import('./api-core/pincentral/proxy.js');
  return new Promise((resolve) => {
    let req = {
      method,
      query: { endpoint },
      body
    };
    
    let res = {
      status: (code) => ({
        json: (data) => resolve({ status: code, data })
      })
    };
    
    proxyHandler(req, res).catch(err => resolve({ status: 500, error: err.message }));
  });
}

// --- CASOS DE PRUEBA MANUALES ---
async function probarOperaciones() {
  console.log("==========================================");
  console.log("🛠️  INICIANDO PRUEBAS MANUALES PINCENTRAL");
  console.log("==========================================\n");

  // 1. Ver Catálogo de Productos
  console.log("1️⃣  Verificando Productos...");
  const prodRes = await callProxy('GET', 'products');
  console.log(`STATUS: ${prodRes.status}`);
  // Mostramos solo los primeros 2 para no llenar la consola
  console.log(prodRes.data.slice(0, 2), "...\n");

  // 2. Validar una recarga (Ejemplo: Free Fire)
  // Nota: El sandbox a veces devuelve 404 en /recharges/validate
  console.log("2️⃣  Validando datos de recarga...");
  const validRes = await callProxy('POST', 'recharges/validate', {
    product_code: "FFTP100",
    service_user_id: "abcd123" // ID de usuario a validar
  });
  console.log(`STATUS: ${validRes.status}`);
  console.log(validRes.data, "\n");

  // 3. Crear una nueva recarga (Simular compra)
  console.log("3️⃣  Enviando nueva recarga de prueba...");
  const orderIdRecarga = `test_recarga_${Date.now()}`;
  const recargaRes = await callProxy('POST', 'recharges', {
    order_id: orderIdRecarga,
    product_code: "FFTP100",
    service_user_id: "abcd123"
  });
  console.log(`STATUS: ${recargaRes.status}`);
  console.log(recargaRes.data, "\n");

  // 4. Consultar el estado de la recarga
  if (recargaRes.data && recargaRes.data.id) {
    console.log("4️⃣  Consultando estado de la recarga recién creada...");
    const recargaStatusRes = await callProxy('GET', `recharges/${recargaRes.data.id}`);
    console.log(`STATUS: ${recargaStatusRes.status}`);
    console.log(recargaStatusRes.data, "\n");
  }

  /* 
   * DESCOMENTA ESTA SECCIÓN PARA PROBAR COMPRA DE PINES (Ej: Razer Gold)
   * 
  console.log("5️⃣  Probando Autorización de PIN (RZRG100)...");
  const orderIdPin = `test_pin_${Date.now()}`;
  const pinAuthRes = await callProxy('POST', 'pins/authorize', {
    product: "RZRG100",
    quantity: 1,
    order_id: orderIdPin
  });
  console.log(`STATUS: ${pinAuthRes.status}`);
  console.log(pinAuthRes.data, "\n");

  if (pinAuthRes.data && pinAuthRes.data.id) {
    console.log("6️⃣  Capturando PIN autorizado...");
    const pinCapRes = await callProxy('POST', 'pins/capture', {
      id: pinAuthRes.data.id
    });
    console.log(`STATUS: ${pinCapRes.status}`);
    console.log(pinCapRes.data, "\n");
  }
  */

  console.log("==========================================");
  console.log("✅ FIN DE PRUEBAS MANUALES");
  console.log("==========================================");
}

probarOperaciones();
