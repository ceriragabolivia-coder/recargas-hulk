import crypto from 'crypto';

/**
 * Cliente para interactuar con la API de PinCentral (Sandbox).
 * 
 * @param {string} endpoint - Ejemplo: 'pins/authorize', 'recharges/validate'
 * @param {string} method - 'GET' o 'POST'
 * @param {object|null} body - Objeto JSON para el cuerpo de la petición
 * @param {string} apiKey - Llave API
 * @param {string} apiSecret - Secreto API
 * @returns {Promise<object>} Respuesta del proveedor parseada
 */
export async function fetchPinCentral(endpoint, method, body, apiKey, apiSecret) {
  const pathForSignature = `api/${endpoint}`; 
  // Petición pasa por el VPS proxy (Caddy)
  const url = `https://api.recargashulk.com/proxy/pincentral/api/${endpoint}`;
  
  const xDateStrict = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  
  let bodyString = '';
  if (method === 'POST' && body) {
    bodyString = JSON.stringify(body);
  }

  // Generar HMAC (la firma debe usarse con el path original que espera PinCentral)
  const hmacContent = `${method}${pathForSignature}${xDateStrict}${bodyString}`;
  const hmac = crypto.createHmac('sha256', apiSecret).update(hmacContent).digest('hex');

  const options = {
    method: method,
    headers: {
      'Authorization': `${apiKey}:${hmac}`,
      'X-Date': xDateStrict,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'X-Hulk-Proxy-Secret': 'HulkProxySecret2026'
    }
  };

  if (method === 'POST' && body) {
    options.body = bodyString;
  }

  const providerRes = await fetch(url, options);
  const text = await providerRes.text();
  
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    const errorObj = new Error(`Respuesta inválida de PinCentral (Status: ${providerRes.status}): ${text.substring(0, 200)}`);
    errorObj.status = providerRes.status;
    throw errorObj;
  }

  if (!providerRes.ok) {
    const errorMsg = data.message || data.error || `Error HTTP ${providerRes.status}`;
    const errorObj = new Error(errorMsg);
    errorObj.status = providerRes.status;
    errorObj.data = data;
    throw errorObj;
  }

  return data;
}
