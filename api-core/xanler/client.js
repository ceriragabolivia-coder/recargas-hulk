/**
 * Cliente para interactuar con la API de Xanler (Host to Host).
 * Documentación: https://docs.xanler.com/
 * Endpoint base: https://xanler.com/api/v1/{action}
 */

const BASE_URL = 'https://xanler.com/api/v1';

/**
 * Petición base interna a la API de Xanler.
 *
 * @param {string} action - 'profile', 'product', 'item', 'orders', 'status'
 * @param {object|null} body - Payload JSON
 * @param {string} apiKey - API_KEY
 * @param {string} apiSecret - API_SECRET
 * @returns {Promise<object>} Respuesta de Xanler parseada
 */
export async function fetchXanler(action, body = null, apiKey = null, apiSecret = null) {
  if (!apiKey || !apiSecret) {
    throw new Error('Credenciales de Xanler (API_KEY y API_SECRET) incompletas o no configuradas.');
  }

  const url = `${BASE_URL}/${action}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'API_KEY': apiKey,
    'API_SECRET': apiSecret,
    'User-Agent': 'HulkStore/1.0'
  };

  const options = {
    method: 'POST',
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (error) {
    throw new Error(`Error de red al conectar con Xanler: ${error.message}`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Respuesta inválida de Xanler (HTTP ${res.status}): ${text.substring(0, 200)}`);
  }

  return data;
}

/**
 * Obtener saldo y perfil de la cuenta en Xanler.
 * POST /api/v1/profile
 */
export async function getProfile(apiKey, apiSecret) {
  return await fetchXanler('profile', {}, apiKey, apiSecret);
}

/**
 * Obtener lista de productos/juegos disponibles.
 * POST /api/v1/product
 */
export async function getProducts(apiKey, apiSecret) {
  return await fetchXanler('product', {}, apiKey, apiSecret);
}

/**
 * Obtener lista de items (paquetes/diamantes/pines) de un producto.
 * POST /api/v1/item
 * Body: { id: productId }
 */
export async function getProductItems(productId, apiKey, apiSecret) {
  return await fetchXanler('item', { id: productId }, apiKey, apiSecret);
}

/**
 * Crear orden de recarga o producto.
 * POST /api/v1/orders
 * Body: { item_id, target, email }
 */
export async function createOrder({ itemId, target, email }, apiKey, apiSecret) {
  const payload = {
    item_id: parseInt(itemId, 10),
    target: String(target || '').trim(),
    email: String(email || '').trim()
  };
  return await fetchXanler('orders', payload, apiKey, apiSecret);
}

/**
 * Consultar estado de una orden.
 * POST /api/v1/status
 * Body: { order_id }
 */
export async function checkOrderStatus(orderId, apiKey, apiSecret) {
  return await fetchXanler('status', { order_id: String(orderId).trim() }, apiKey, apiSecret);
}

/**
 * Verificador de Nicknames (Godifive)
 * POST https://xanler.com/api/games
 */
export async function checkNickname({ code, token, id, server = '' }) {
  const url = 'https://xanler.com/api/games';
  const body = {
    code,
    token,
    id: isNaN(id) ? id : parseInt(id, 10),
    ...(server ? { server } : {})
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Respuesta inválida de Godifive: ${text.substring(0, 200)}`);
  }
}
