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

  const { transferId, monto, recargaId, userId } = req.body || {};

  if (!recargaId || !userId) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros: recargaId y userId son requeridos' });
  }

  try {
    // Verificar que la recarga existe, pertenece al usuario y está pendiente
    const { data: recarga, error: recargaError } = await supabase
      .from('billetera_recargas')
      .select('id, monto, moneda, estado, auth_user_id, referencia_pago')
      .eq('id', recargaId)
      .eq('auth_user_id', userId)
      .single();

    if (recargaError || !recarga) {
      return res.status(404).json({ 
        success: false, 
        message: 'Solicitud de recarga no encontrada',
        debug: { recargaError, recargaId, userId }
      });
    }


    if (recarga.estado !== 'pendiente') {
      return res.status(400).json({ success: false, message: `La recarga ya está en estado: ${recarga.estado}` });
    }

    // Buscar en las últimas 24 horas de transacciones Binance Pay
    const startTime = Date.now() - 24 * 60 * 60 * 1000;
    const transactions = await getBinancePayTransactions(startTime);

    // Filtrar: solo transacciones en USDT (cualquier orderType — Binance Pay, Cuenta de Fondos, C2C, etc.)
    // Aceptamos todos porque el 'Cuenta de Fondos' puede tener orderType diferente a 'C2C'
    const incoming = transactions.filter(t =>
      t.currency === 'USDT'
      // No filtramos por orderType para cubrir todos los métodos de pago de Binance Pay
    );

    // Log de diagnóstico para ver qué llega (visible en Vercel logs)
    console.log('[BinancePay] Transacciones USDT encontradas:', incoming.length,
      '| OrderTypes:', [...new Set(incoming.map(t => t.orderType))],
      '| IDs:', incoming.map(t => t.transactionId));

    let matchedTx = null;

    if (transferId && transferId.trim()) {
      // MÉTODO PRINCIPAL: buscar por Transfer ID (exacto o parcial)
      const cleanId = transferId.trim();
      matchedTx = incoming.find(t => {
        const txId = t.transactionId || '';
        const orderId = t.orderId || '';
        const merchantOrderId = t.merchantTradeNo || '';
        
        // Match exacto siempre es seguro
        if (txId === cleanId || orderId === cleanId || merchantOrderId === cleanId) {
          return true;
        }

        // Match parcial SOLO es seguro si el usuario proporcionó al menos 6 caracteres
        // Esto evita que un usuario ingrese "1" y coincida con cualquier transacción
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
      // Guardar el transferId aunque no se verifique (para referencia del admin)
      if (transferId && transferId.trim() !== recarga.referencia_pago) {
        await supabase
          .from('billetera_recargas')
          .update({ referencia_pago: transferId.trim() })
          .eq('id', recargaId);
      }

      return res.status(200).json({
        success: false,
        verified: false,
        message: transferId
          ? `No se encontró una transacción de Binance Pay con ID "${transferId}" en las últimas 24h. Asegúrate de haber copiado el ID correctamente.`
          : `No se encontró un pago de $${recarga.monto} USDT en las últimas 24h.`
      });
    }

    // 🚨 VERIFICACIÓN DE SEGURIDAD 1: Evitar doble gasto (Replay Attack) 🚨
    const { data: recargasPrevias, error: checkError } = await supabase
      .from('billetera_recargas')
      .select('id, estado')
      .eq('referencia_pago', matchedTx.transactionId)
      .neq('id', recargaId); // Excluir la recarga actual

    if (recargasPrevias && recargasPrevias.length > 0) {
      const fueAprobada = recargasPrevias.some(r => r.estado === 'aprobado' || r.estado === 'completado');
      if (fueAprobada) {
        return res.status(200).json({
          success: false,
          verified: false,
          message: 'Esta transacción de Binance Pay ya ha sido reclamada y utilizada para otra recarga.'
        });
      }
    }

    // 🚨 VERIFICACIÓN DE SEGURIDAD 2: Montos exactos 🚨
    const txAmount = parseFloat(matchedTx.amount);
    const expectedAmount = parseFloat(recarga.monto);

    // En Binance Pay no hay comisiones, los montos deben coincidir exactamente
    if (txAmount.toFixed(2) !== expectedAmount.toFixed(2)) {
      return res.status(200).json({
        success: false,
        verified: false,
        message: `El pago encontrado es por $${txAmount} USDT pero la solicitud es por $${expectedAmount} USDT. El monto debe ser exacto para auto-aprobarse.`
      });
    }

    // Marcar como verificado con Binance en la BD
    await supabase
      .from('billetera_recargas')
      .update({
        referencia_pago: matchedTx.transactionId // también en referencia para el admin
      })
      .eq('id', recargaId);


    // AUTO-APROBAR: usar la RPC automática que no verifica is_admin()
    const { data: aprobacion, error: rpcError } = await supabase.rpc('aprobar_recarga_automatica_bdv_rpc', {
      p_recarga_id: recargaId,
      p_notas: 'Recarga automática de saldo vía Binance Pay'
    });

    if (rpcError || (aprobacion && aprobacion.success === false)) {
      console.error('Error al auto-aprobar recarga Binance:', rpcError || aprobacion);
      return res.status(200).json({
        success: false,
        verified: true,
        message: 'Pago verificado con Binance pero hubo un error al acreditar el saldo. El admin revisará tu solicitud.',
        debug: rpcError || aprobacion
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      txAmount,
      transactionId: matchedTx.transactionId,
      message: `✅ Pago de $${txAmount} USDT verificado y saldo acreditado automáticamente.`
    });

  } catch (err) {
    console.error('Error en verify-binance-pay:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar con Binance: ' + err.message
    });
  }
}
