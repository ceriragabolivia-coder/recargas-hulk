import { createClient } from '@supabase/supabase-js';
import { fetchPinCentral } from './client.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Solo permitimos GET y POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Extraer el endpoint al que queremos ir (ej: 'products', 'account', 'pins/stock')
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Falta el parámetro endpoint' });
  }

  // Verificar si hay query params extras
  const { endpoint: _ignored, ...otherQueryParams } = req.query;

  try {
    // 1. Obtener credenciales de la DB
    const { data: configRows, error: configError } = await supabase
      .from('configuracion')
      .select('clave, valor_texto')
      .in('clave', ['pincentral_api_key', 'pincentral_api_secret']);

    if (configError || !configRows || configRows.length === 0) {
      console.error("Error obteniendo config PinCentral:", configError);
      return res.status(500).json({ error: 'Configuración de PinCentral no encontrada' });
    }

    const apiKey = configRows.find(r => r.clave === 'pincentral_api_key')?.valor_texto;
    const apiSecret = configRows.find(r => r.clave === 'pincentral_api_secret')?.valor_texto;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Credenciales de PinCentral incompletas' });
    }

    // 2. Preparar los datos para la petición a PinCentral
    const method = req.method;
    const queryString = new URLSearchParams(otherQueryParams).toString();
    const finalEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    // 3. Llamar al cliente centralizado
    const body = method === 'POST' ? req.body : null;
    const data = await fetchPinCentral(finalEndpoint, method, body, apiKey, apiSecret);

    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error en proxy PinCentral:', error);
    if (error.status && error.status === 404 && typeof error.message === 'string' && error.message.includes('404')) {
      // Return 404 so we know it's a proxy target not found (like /recharges)
      return res.status(404).json({ error: 'Endpoint no encontrado en PinCentral', details: error.message });
    }
    return res.status(error.status || 500).json({ error: 'Error de red con PinCentral', details: error.message });
  }
}
