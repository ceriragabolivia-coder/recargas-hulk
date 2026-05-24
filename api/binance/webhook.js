import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// En Vercel API routes, parseamos el body como texto para verificar la firma correctamente
export const config = {
  api: {
    bodyParser: false,
  },
};

// Utilidad para leer el raw body en Vercel
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ returnCode: 'FAIL', returnMessage: 'Method Not Allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    
    // Obtener headers de Binance
    const timestamp = req.headers['binancepay-timestamp'];
    const nonce = req.headers['binancepay-nonce'];
    const signature = req.headers['binancepay-signature'];
    
    const secretKey = process.env.BINANCE_SECRET_KEY;

    if (!timestamp || !nonce || !signature || !secretKey) {
      console.error('Faltan headers o secret key');
      return res.status(400).json({ returnCode: 'FAIL', returnMessage: 'Missing parameters' });
    }

    // Verificar la firma de Binance
    const payloadToSign = `${timestamp}\n${nonce}\n${rawBody}\n`;
    
    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(payloadToSign)
      .digest('hex')
      .toUpperCase();

    if (expectedSignature !== signature) {
      console.error('Firma inválida', { expected: expectedSignature, received: signature });
      return res.status(400).json({ returnCode: 'FAIL', returnMessage: 'Invalid Signature' });
    }

    // Firma válida, procesar el evento
    const payload = JSON.parse(rawBody);

    if (payload.bizType === 'PAY') {
      const bizStatus = payload.bizStatus;
      // Extraer merchantTradeNo (nuestro ID de pedido)
      const dataObj = JSON.parse(payload.data);
      const merchantTradeNo = dataObj.merchantTradeNo;

      if (bizStatus === 'PAY_SUCCESS') {
        // Actualizar la base de datos: marcar la venta como pagada/aprobada
        const { error } = await supabase
          .from('ventas')
          .update({ 
            estado: 'aprobado', 
            // Podrías guardar la transactionId de Binance también si añadieras esa columna
            // transaction_id: dataObj.transactionId 
          })
          .eq('referencia', merchantTradeNo) // Buscamos la orden por la referencia
          .eq('metodo_pago', 'binance_pay');
          
        if (error) {
          console.error('Error actualizando Supabase:', error);
          return res.status(500).json({ returnCode: 'FAIL', returnMessage: 'DB Update Error' });
        }
        
        console.log(`Pago aprobado exitosamente para la orden: ${merchantTradeNo}`);
      } else if (bizStatus === 'PAY_CLOSED') {
        // El pago fue cerrado o expiró
        await supabase
          .from('ventas')
          .update({ estado: 'rechazado' })
          .eq('referencia', merchantTradeNo)
          .eq('metodo_pago', 'binance_pay');
      }
    }

    // Responder a Binance que recibimos el webhook correctamente
    return res.status(200).json({ returnCode: 'SUCCESS', returnMessage: null });
    
  } catch (error) {
    console.error('Excepción en webhook:', error);
    return res.status(500).json({ returnCode: 'FAIL', returnMessage: 'Internal Server Error' });
  }
}
