// Script para aplicar migración 211 directamente via REST API de Supabase
import fs from 'fs';
import https from 'https';

const SUPABASE_URL = 'https://api.recargashulk.com';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU0NjgyMTUsImV4cCI6MjEwMDgyNjc5OX0.Mewuja4QuB0hJpKLxF08NdPL575wcVFueQtMBuXjBn8';

const sql = fs.readFileSync('c:/hulk/app/supabase/migrations/211_fix_codigo_entregado_api.sql', 'utf8');

console.log('📦 Aplicando migración 211_fix_codigo_entregado_api.sql...');
console.log('SQL a ejecutar:\n', sql);

// Usar el endpoint /rest/v1/rpc/exec_sql si existe, o el endpoint de SQL directo
async function applyMigration() {
  // Intentar con el endpoint pg via REST
  const body = JSON.stringify({ query: sql });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  // Intentar con /rest/v1/rpc/exec_sql primero
  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: options.headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Migración aplicada exitosamente!');
        } else {
          console.log('⚠️  La función exec_sql puede no existir. Prueba el método alternativo.');
          // Intentar con pg endpoint
          applyViaPg();
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Método alternativo: via endpoint SQL directo (solo disponible en Supabase managed)
async function applyViaPg() {
  const url = new URL(`${SUPABASE_URL}/pg/query`);
  const body = JSON.stringify({ query: sql });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n[/pg/query] Status: ${res.statusCode}`);
        console.log(`[/pg/query] Response: ${data}`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

applyMigration().catch(console.error);
