const crypto = require('crypto');

async function testKey(apiKey, secretKey) {
  const BINANCE_BASE = 'https://api.binance.com';
  const timestamp = Date.now();
  const queryString = new URLSearchParams({ timestamp }).toString();
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');
  const qs = `${queryString}&signature=${signature}`;
  const url = `${BINANCE_BASE}/sapi/v1/capital/config/getall?${qs}`;
  
  try {
    const resp = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
    const data = await resp.json();
    return { status: resp.status, data };
  } catch(e) {
    return { status: 500, error: e.message };
  }
}

async function run() {
  const apiKeys = [
    '2HWA23iOMYJZWr70x44MTZVM0cUWxK7ghOGnM3U2o3dvOXmbJKwWEWjZyrqJaKKv',
    '2HWA23i0MYJZWr70x44MTZVM0cUWxK7ghOGnM3U2o3dvOXmbJKwWEWjZyrqJaKKv'
  ];
  
  const secretKeys = [
    'PItqaCCqSoiv1jFoPGqDiCJIfv0R3g9isrcE0TGgCDrG9mjXZ58w0AUmS2Tq1888',
    'PltqaCCqSoiv1jFoPGqDiCJlfv0R3g9isrcE0TGgCDrG9mjXZ58w0AUmS2Tq1888',
    'PItqaCCqSoiv1jFoPGqDiCJlfv0R3g9isrcE0TGgCDrG9mjXZ58w0AUmS2Tq1888',
    'PltqaCCqSoiv1jFoPGqDiCJIfv0R3g9isrcE0TGgCDrG9mjXZ58w0AUmS2Tq1888'
  ];
  
  for (const ak of apiKeys) {
    for (const sk of secretKeys) {
      console.log(`Testing AK: ${ak.substring(0, 8)}... SK: ${sk.substring(0, 8)}...`);
      const res = await testKey(ak, sk);
      if (res.status === 200) {
        console.log('SUCCESS!');
        console.log('Valid API Key:', ak);
        console.log('Valid Secret:', sk);
        return;
      }
    }
  }
  console.log('All combinations failed.');
}

run();
