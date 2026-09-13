import crypto from 'crypto';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BINANCE_BASE = 'https://api.binance.com';

function buildSignedRequest(params) {
  const timestamp = Date.now();
  const queryString = new URLSearchParams({ ...params, timestamp }).toString();
  const signature = crypto
    .createHmac('sha256', BINANCE_SECRET_KEY)
    .update(queryString)
    .digest('hex');
  return `${queryString}&signature=${signature}`;
}

export default async function handler(req, res) {
  if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
    return res.status(500).json({ error: 'Binance API credentials not configured' });
  }

  const keyLen = BINANCE_API_KEY ? BINANCE_API_KEY.length : 0;
  const secLen = BINANCE_SECRET_KEY ? BINANCE_SECRET_KEY.length : 0;


  const startTime = Date.now() - 48 * 60 * 60 * 1000; // últimas 48h

  try {
    // 1. Endpoint principal: Pay transactions
    const qs1 = buildSignedRequest({ limit: 100, startTime });
    const r1 = await fetch(`${BINANCE_BASE}/sapi/v1/pay/transactions?${qs1}`, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY }
    });
    const payData = await r1.json();

    // 2. Endpoint alternativo: asset transfer history (USDT incoming)
    const qs2 = buildSignedRequest({ type: 'FUNDING_MAIN', startTime });
    const r2 = await fetch(`${BINANCE_BASE}/sapi/v3/asset/transfer?${qs2}`, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY }
    });
    const assetTransfer = await r2.json();

    // 3. Endpoint spot: capital deposit history (por si acaso)
    const qs3 = buildSignedRequest({ startTime });
    const r3 = await fetch(`${BINANCE_BASE}/sapi/v1/capital/deposit/hisrec?${qs3}`, {
      headers: { 'X-MBX-APIKEY': BINANCE_API_KEY }
    });
    const depositHist = await r3.json();

    return res.status(200).json({
      pay_transactions: payData,        // Lo que usa verify-pay.js actualmente
      asset_transfer: assetTransfer,    // Historial de transferencias de activos
      deposit_history: depositHist,     // Historial de depósitos
      meta: {
        startTime_iso: new Date(startTime).toISOString(),
        pay_count: Array.isArray(payData?.data) ? payData.data.length : 0,
        pay_code: payData?.code,
        timestamp: new Date().toISOString(),
        keyLen,
        secLen
      }

    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
