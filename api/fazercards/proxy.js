export default async function handler(req, res) {
  // Solo permitimos GET y POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Extraer el endpoint al que queremos ir (ej: 'balance', 'topups', 'account/webhook')
  const { endpoint, ...otherQueryParams } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Falta el parámetro endpoint' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Falta X-API-Key' });
  }

  try {
    const queryString = new URLSearchParams(otherQueryParams).toString();
    const url = `https://api.fzr.cards/api/v2/${endpoint}${queryString ? '?' + queryString : ''}`;
    
    const options = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body);
    }

    const providerRes = await fetch(url, options);
    
    // Leer el body de la respuesta
    const text = await providerRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      console.error('Error parseando JSON de FazerCards:', text);
      return res.status(502).json({ error: 'Respuesta inválida del proveedor', details: text });
    }

    // Retornar exactamente el status code y la data del proveedor
    return res.status(providerRes.status).json(data);

  } catch (error) {
    console.error('❌ Error en proxy FazerCards:', error);
    return res.status(500).json({ error: 'Error de red con FazerCards', details: error.message });
  }
}
