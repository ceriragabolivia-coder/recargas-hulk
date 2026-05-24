import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key (para saltarse RLS si es necesario)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { pedidoId, amount } = req.body;
    
    // Obtener claves de entorno
    const apiKey = process.env.BINANCE_API_KEY;
    const secretKey = process.env.BINANCE_SECRET_KEY;

    if (!apiKey || !secretKey) {
      console.error('Faltan credenciales de Binance');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const orderAmount = Number(amount).toFixed(2);
    
    // Usamos el pedidoId como el merchantTradeNo para poder ubicarlo en el webhook
    const merchantTradeNo = `PEDIDO_${pedidoId}`;

    const requestBody = {
      env: { terminalType: 'WEB' },
      merchantTradeNo: merchantTradeNo,
      orderAmount: orderAmount,
      currency: 'USDT', 
      goods: {
        goodsType: '02',
        goodsCategory: 'Z000',
        referenceGoodsId: pedidoId.toString(),
        goodsName: `Pedido #${pedidoId}`,
        goodsDetail: 'Compra de recargas digitales en ceriraga.com'
      },
      returnUrl: `${req.headers.origin}/?pago=exito&orden=${merchantTradeNo}`,
      cancelUrl: `${req.headers.origin}/Checkout?pago=cancelado`,
      webhookUrl: `${req.headers.origin}/api/binance/webhook`
    };

    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyStr = JSON.stringify(requestBody);
    
    const payload = `${timestamp}\n${nonce}\n${bodyStr}\n`;
    const signature = crypto
      .createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex')
      .toUpperCase();

    const binanceRes = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'BinancePay-Timestamp': timestamp,
        'BinancePay-Nonce': nonce,
        'BinancePay-Certificate-SN': apiKey,
        'BinancePay-Signature': signature
      },
      body: bodyStr
    });

    const binanceData = await binanceRes.json();

    if (binanceData.status === 'SUCCESS' && binanceData.data) {
      // Actualizar el pedido en la base de datos para registrar la referencia de Binance
      await supabase
        .from('pedidos')
        .update({ referencia_pago: merchantTradeNo })
        .eq('id', pedidoId);
        
      // También actualizar las ventas asociadas
      await supabase
        .from('ventas')
        .update({ referencia_pago: merchantTradeNo })
        .eq('pedido_id', pedidoId);
        
      return res.status(200).json({
        checkoutUrl: binanceData.data.checkoutUrl,
        tradeNo: merchantTradeNo
      });
    } else {
      console.error('Error de Binance API:', binanceData);
      return res.status(400).json({ error: 'Error al crear la orden en Binance', details: binanceData });
    }
  } catch (error) {
    console.error('Excepción en create-order:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
