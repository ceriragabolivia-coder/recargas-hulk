import { createClient } from '@supabase/supabase-js';
import { getProfile, getProducts, getProductItems, checkOrderStatus, createOrder } from './client.js';

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase no configurado en variables de entorno');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-API-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extraer endpoint y parámetros de req.query o directamente de req.url
  let endpoint = req.query?.endpoint;
  let queryId = req.query?.id;
  if (req.url && req.url.includes('?')) {
    try {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      if (!endpoint) endpoint = urlParams.get('endpoint');
      if (!queryId) queryId = urlParams.get('id');
    } catch (e) {}
  }

  if (!endpoint) {
    return res.status(400).json({ ok: false, error: 'Falta el parámetro endpoint' });
  }

  try {
    // 1. Obtener credenciales (de headers o de base de datos)
    let apiKey = (req.headers['x-api-key'] || req.headers['api-key'] || req.headers['api_key'] || '').trim();
    let apiSecret = (req.headers['x-api-secret'] || req.headers['api-secret'] || req.headers['api_secret'] || '').trim();

    if (!apiKey || !apiSecret) {
      const supabase = getSupabase();
      const { data: configRows } = await supabase
        .from('configuracion')
        .select('clave, valor_texto, valor')
        .in('clave', ['xanler_api_key', 'xanler_api_secret']);

      const keyRow = configRows?.find(r => r.clave === 'xanler_api_key');
      const secretRow = configRows?.find(r => r.clave === 'xanler_api_secret');

      apiKey = apiKey || (keyRow?.valor_texto || keyRow?.valor || '').trim();
      apiSecret = apiSecret || (secretRow?.valor_texto || secretRow?.valor || '').trim();
    }

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        ok: false,
        error: 'Credenciales de Xanler no configuradas (se requiere xanler_api_key y xanler_api_secret)'
      });
    }

    // 2. Procesar el endpoint solicitado
    switch (endpoint) {
      case 'profile':
      case 'saldo': {
        const result = await getProfile(apiKey, apiSecret);
        if (result.status && result.data) {
          return res.status(200).json({
            ok: true,
            saldo: result.data.balance !== undefined ? result.data.balance : 0,
            username: result.data.username || '',
            data: result.data
          });
        }
        return res.status(200).json({
          ok: false,
          error: result.message || 'Error al obtener perfil de Xanler',
          data: result
        });
      }

      case 'product':
      case 'productos': {
        const result = await getProducts(apiKey, apiSecret);
        if (result.status && Array.isArray(result.data)) {
          return res.status(200).json({
            ok: true,
            productos: result.data,
            data: result.data
          });
        }
        return res.status(200).json({
          ok: false,
          error: result.message || 'Error al obtener productos de Xanler',
          data: result
        });
      }

      case 'item':
      case 'items': {
        let body = req.body || {};
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            body = {};
          }
        }
        const productId = body.id || req.query?.id || queryId;
        if (!productId) {
          return res.status(400).json({ ok: false, error: 'Falta el id del producto' });
        }

        const result = await getProductItems(productId, apiKey, apiSecret);
        if (result.status && result.data) {
          return res.status(200).json({
            ok: true,
            product: result.data.product,
            sub_title: result.data.sub_title,
            items: result.data.item || [],
            data: result.data
          });
        }
        return res.status(200).json({
          ok: false,
          error: result.message || 'Error al obtener items de Xanler',
          data: result
        });
      }

      case 'status': {
        const body = req.body || {};
        const orderId = body.order_id || req.query.order_id;
        if (!orderId) {
          return res.status(400).json({ ok: false, error: 'Falta el order_id' });
        }

        const result = await checkOrderStatus(orderId, apiKey, apiSecret);
        return res.status(200).json({
          ok: !!result.status,
          data: result.data || null,
          message: result.message
        });
      }

      case 'orders': {
        if (req.method !== 'POST') {
          return res.status(405).json({ ok: false, error: 'Método no permitido para orders (requiere POST)' });
        }
        const body = req.body || {};
        if (!body.item_id || !body.target) {
          return res.status(400).json({ ok: false, error: 'Faltan parámetros obligatorios (item_id, target)' });
        }

        const result = await createOrder({
          itemId: body.item_id,
          target: body.target,
          email: body.email
        }, apiKey, apiSecret);

        return res.status(200).json({
          ok: !!result.status,
          data: result.data || null,
          message: result.message
        });
      }

      default:
        return res.status(400).json({ ok: false, error: `Endpoint '${endpoint}' no soportado en proxy Xanler` });
    }
  } catch (error) {
    console.error('❌ Error en proxy Xanler:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno del proxy Xanler'
    });
  }
}
