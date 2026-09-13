export default async function handler(req, res) {
  // Solo permitimos GET y POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Extraer el endpoint al que queremos ir (ej: 'saldo', 'productos', 'comprar', 'webhook')
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Falta el parámetro endpoint' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Falta X-API-Key' });
  }

  try {
    const url = `https://tiendagiftven.tech/api/v1/${endpoint}`;
    
    const options = {
      method: req.method,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (req.method === 'POST') {
      options.body = JSON.stringify(req.body);
    }

    const providerRes = await fetch(url, options);
    
    // Leer el body de la respuesta
    const text = await providerRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      console.error('Error parseando JSON del proveedor:', text);
      return res.status(502).json({ error: 'Respuesta inválida del proveedor', details: text });
    }

    // Retornar exactamente el status code y la data del proveedor
    return res.status(providerRes.status).json(data);

  } catch (error) {
    console.error('❌ Error en proxy TiendaGiftVen:', error);
    return res.status(500).json({ error: 'Error de red con el proveedor', details: error.message });
  }
}
