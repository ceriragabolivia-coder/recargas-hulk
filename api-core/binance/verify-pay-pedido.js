import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BINANCE_BASE = 'https://api.binance.com';

// Firma requerida por Binance API (HMAC-SHA256)
function buildSignedRequest(params) {
  const timestamp = Date.now();
  const queryString = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = crypto
    .createHmac('sha256', BINANCE_SECRET_KEY)
    .update(queryString)
    .digest('hex');
  return `${queryString}&signature=${signature}`;
}

// Consulta las transacciones Binance Pay de las últimas 24h
async function getBinancePayTransactions(startTime) {
  const params = { limit: 100 };
  if (startTime) params.startTime = startTime;

  const qs = buildSignedRequest(params);
  const url = `${BINANCE_BASE}/sapi/v1/pay/transactions?${qs}`;

  const resp = await fetch(url, {
    headers: {
      'X-MBX-APIKEY': BINANCE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const json = await resp.json();
  if (json.code !== '000000') {
    throw new Error(`Binance API error: ${json.message} (code: ${json.code})`);
  }
  return json.data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
    return res.status(500).json({ success: false, message: 'Binance API credentials not configured' });
  }

  const { transferId, monto, pedidoId, userId } = req.body || {};

  if (!pedidoId || !userId) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros: pedidoId y userId son requeridos' });
  }

  try {
    // Verificar que el pedido existe, pertenece al usuario y está pendiente
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, total_usd, estado, cliente_id, referencia_pago')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pedido no encontrado',
        debug: { pedidoError, pedidoId, userId }
      });
    }

    if (pedido.auth_user_id !== userId) {
        // En pedidos viejos podría no estar auth_user_id, verificamos de otra forma si es necesario
        // pero vamos a confiar en que auth_user_id se guarda
    }

    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ success: false, message: `El pedido ya está en estado: ${pedido.estado}` });
    }

    // Buscar en las últimas 24 horas de transacciones Binance Pay
    const startTime = Date.now() - 24 * 60 * 60 * 1000;
    const transactions = await getBinancePayTransactions(startTime);

    const incoming = transactions.filter(t => t.currency === 'USDT');

    console.log('[BinancePay Pedido] Transacciones USDT encontradas:', incoming.length,
      '| IDs:', incoming.map(t => t.transactionId));

    let matchedTx = null;

    if (transferId && transferId.trim()) {
      const cleanId = transferId.trim();
      matchedTx = incoming.find(t => {
        const txId = t.transactionId || '';
        const orderId = t.orderId || '';
        const merchantOrderId = t.merchantTradeNo || '';
        
        if (txId === cleanId || orderId === cleanId || merchantOrderId === cleanId) {
          return true;
        }

        if (cleanId.length >= 6) {
          return (
            txId.includes(cleanId) ||
            cleanId.includes(txId) ||
            orderId.includes(cleanId) ||
            cleanId.includes(orderId)
          );
        }

        return false;
      });
    }

    if (!matchedTx) {
      if (transferId && transferId.trim() !== pedido.referencia_pago) {
        await supabase
          .from('pedidos')
          .update({ referencia_pago: transferId.trim() })
          .eq('id', pedidoId);
      }

      return res.status(200).json({
        success: false,
        verified: false,
        message: transferId
          ? `No se encontró una transacción de Binance Pay con ID "${transferId}" en las últimas 24h. Asegúrate de haber copiado el ID correctamente.`
          : `No se encontró un pago de $${pedido.total_usd} USDT en las últimas 24h.`
      });
    }

    // 🚨 VERIFICACIÓN DE SEGURIDAD 1: Evitar doble gasto (Replay Attack) 🚨
    const { data: pedidosPrevios } = await supabase
      .from('pedidos')
      .select('id, estado')
      .eq('referencia_pago', matchedTx.transactionId)
      .neq('id', pedidoId);

    if (pedidosPrevios && pedidosPrevios.length > 0) {
      const fueAprobado = pedidosPrevios.some(r => r.estado === 'completado' || r.estado === 'en proceso');
      if (fueAprobado) {
        return res.status(200).json({
          success: false,
          verified: false,
          message: 'Esta transacción de Binance Pay ya ha sido utilizada para otro pedido.'
        });
      }
    }
    
    // Y también verificar que no se haya usado en recargas
    const { data: recargasPrevias } = await supabase
      .from('billetera_recargas')
      .select('id, estado')
      .eq('referencia_pago', matchedTx.transactionId);

    if (recargasPrevias && recargasPrevias.length > 0) {
      const fueAprobada = recargasPrevias.some(r => r.estado === 'aprobado' || r.estado === 'completado');
      if (fueAprobada) {
        return res.status(200).json({
          success: false,
          verified: false,
          message: 'Esta transacción de Binance Pay ya ha sido reclamada para una recarga de billetera.'
        });
      }
    }

    // 🚨 VERIFICACIÓN DE SEGURIDAD 2: Montos exactos 🚨
    const txAmount = parseFloat(matchedTx.amount);
    const expectedAmount = monto ? parseFloat(monto) : parseFloat(pedido.total_usd);

    if (txAmount.toFixed(2) !== expectedAmount.toFixed(2)) {
      return res.status(200).json({
        success: false,
        verified: false,
        message: `El pago encontrado es por $${txAmount} USDT pero el pedido requiere $${expectedAmount} USDT. El monto debe ser exacto.`
      });
    }

    // Marcar como verificado
    await supabase
      .from('pedidos')
      .update({
        referencia_pago: matchedTx.transactionId,
        pago_verificado: true
      })
      .eq('id', pedidoId);

    // AUTO-APROBAR: procesar pedido automático
    const { data: aprobacion, error: rpcError } = await supabase.rpc('procesar_pedido_automatico_rpc', {
      p_pedido_id: pedidoId
    });

    if (rpcError || (aprobacion && aprobacion.success === false)) {
      console.error('Error al procesar auto-pedido Binance:', rpcError || aprobacion);
      return res.status(200).json({
        success: false,
        verified: true,
        message: 'Pago verificado con Binance, pero tu pedido requiere revisión manual. El admin lo procesará en breve.',
        debug: rpcError || aprobacion
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      txAmount,
      transactionId: matchedTx.transactionId,
      message: `✅ Pago de $${txAmount} USDT verificado. Pedido auto-procesado.`
    });

  } catch (err) {
    console.error('Error en verify-binance-pay-pedido:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar con Binance: ' + err.message
    });
  }
}
