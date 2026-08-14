import { Client } from 'ssh2';

function sshExec(command, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    const timer = setTimeout(() => { conn.end(); resolve(output + '\nTIMEOUT'); }, timeout);
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        stream.on('close', () => { clearTimeout(timer); conn.end(); resolve(output); })
          .on('data', d => { output += d.toString(); })
          .stderr.on('data', d => { output += 'STDERR: ' + d.toString(); });
      });
    });
    conn.on('error', reject);
    conn.connect({ host: '162.141.78.103', port: 22, username: 'root', password: 'm+0JVjSbFo', readyTimeout: 30000 });
  });
}

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODU0NjgyMTUsImV4cCI6MjEwMDgyNjc5OX0.Mewuja4QuB0hJpKLxF08NdPL575wcVFueQtMBuXjBn8';

// Script Node 12 compatible usando URL local del VPS
const rescateScript = `'use strict';
var http = require('http');

// API local de Supabase (Kong gateway en el VPS)
var SUPABASE_URL = 'http://localhost:8000';
var SUPABASE_KEY = '${SERVICE_ROLE_KEY}';

function apiRequest(method, path, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var url = SUPABASE_URL + path;
    var parsedUrl = require('url').parse(url);
    var options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.path,
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    };
    if (method !== 'GET') options.headers['Prefer'] = 'return=representation';
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    var req = http.request(options, function(res) {
      var raw = '';
      res.on('data', function(d) { raw += d; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function rpc(fnName, params) {
  return apiRequest('POST', '/rest/v1/rpc/' + fnName, params);
}

function qs(filters) {
  return Object.keys(filters).map(function(k) {
    var v = filters[k];
    if (v && typeof v === 'object' && v.op) return k + '=' + v.op + '.' + v.value;
    return k + '=eq.' + v;
  }).join('&');
}

async function main() {
  var now = new Date();
  var hace90seg = new Date(now.getTime() - 90 * 1000).toISOString();
  var hace30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  var rescatados = 0;

  var pagosRes = await apiRequest('GET',
    '/rest/v1/pagos_apk?select=id,referencia,monto,fecha_pago&status=eq.disponible&fecha_pago=gte.' + hace30min + '&limit=100&order=fecha_pago.desc'
  );
  var pagos = Array.isArray(pagosRes.data) ? pagosRes.data : [];

  if (pagos.length === 0) {
    console.log('[Rescate] Sin pagos disponibles. Saliendo.');
    return;
  }
  console.log('[Rescate] Pagos disponibles: ' + pagos.length);

  // Pedidos pendientes
  var pedidosRes = await apiRequest('GET',
    '/rest/v1/pedidos?select=id,cliente_id,total_bs&estado=eq.pendiente&pago_verificado=eq.false&created_at=gte.' + hace30min + '&created_at=lte.' + hace90seg + '&limit=20&order=created_at.desc'
  );
  var pedidos = Array.isArray(pedidosRes.data) ? pedidosRes.data : [];
  console.log('[Rescate] Pedidos pendientes: ' + pedidos.length);

  for (var i = 0; i < pedidos.length; i++) {
    var pedido = pedidos[i];
    var monto = parseFloat(pedido.total_bs);
    var match = null;
    for (var j = 0; j < pagos.length; j++) {
      if (!pagos[j]._usado && Math.abs(parseFloat(pagos[j].monto) - monto) <= 0.05) {
        match = pagos[j]; break;
      }
    }
    if (!match) continue;
    match._usado = true;
    console.log('[Rescate] Pedido #' + pedido.id + ' <- ref=' + match.referencia + ' Bs.' + match.monto);

    await apiRequest('PATCH', '/rest/v1/pedidos?id=eq.' + pedido.id, { referencia_pago: match.referencia });
    await apiRequest('PATCH', '/rest/v1/pagos_apk?id=eq.' + match.id, { pedido_id: pedido.id, usuario_id: pedido.cliente_id, status: 'usado' });
    await rpc('webhook_update_pedido', { p_pedido_id: pedido.id, p_estado: null, p_pago_verificado: true });

    // Llamar auto_process en recargashulk.com via https
    try {
      var https = require('https');
      var body = JSON.stringify({ pedido_id: pedido.id, force: true });
      await new Promise(function(res) {
        var r = https.request({ hostname: 'recargashulk.com', path: '/api/pedidos/auto_process', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 20000 }, function(resp) { resp.resume(); res(); });
        r.on('error', res); r.on('timeout', function() { r.destroy(); res(); });
        r.write(body); r.end();
      });
    } catch(e) {}

    rescatados++;
  }

  // Recargas de billetera
  var recargasRes = await apiRequest('GET',
    '/rest/v1/billetera_recargas?select=id,auth_user_id,monto&estado=eq.pendiente&created_at=gte.' + hace30min + '&created_at=lte.' + hace90seg + '&limit=20&order=created_at.desc'
  );
  var recargas = Array.isArray(recargasRes.data) ? recargasRes.data : [];
  console.log('[Rescate] Recargas pendientes: ' + recargas.length);

  for (var i = 0; i < recargas.length; i++) {
    var recarga = recargas[i];
    var monto = parseFloat(recarga.monto);
    var match = null;
    for (var j = 0; j < pagos.length; j++) {
      if (!pagos[j]._usado && Math.abs(parseFloat(pagos[j].monto) - monto) <= 0.05) {
        match = pagos[j]; break;
      }
    }
    if (!match) continue;
    match._usado = true;
    console.log('[Rescate] Recarga #' + recarga.id + ' <- ref=' + match.referencia);
    await apiRequest('PATCH', '/rest/v1/billetera_recargas?id=eq.' + recarga.id, { referencia_pago: match.referencia });
    await apiRequest('PATCH', '/rest/v1/pagos_apk?id=eq.' + match.id, { usuario_id: recarga.auth_user_id, status: 'usado' });
    var res2 = await rpc('procesar_recarga_automatica_rpc', { p_recarga_id: recarga.id });
    if (res2.data && res2.data.success) rescatados++;
  }

  console.log('[Rescate] Completado. Rescatados: ' + rescatados);
}

main().catch(function(e) { console.error('[Rescate] Error fatal:', e.message); process.exit(1); });
`;

(async () => {
  try {
    // Subir script actualizado
    const writeCmd = `cat > /opt/hulk-scripts/rescate_pagos.js << 'SCRIPTEOF'\n${rescateScript}\nSCRIPTEOF`;
    await sshExec(writeCmd);
    console.log('✅ Script actualizado en VPS');

    // Probar
    const test = await sshExec('/usr/bin/node /opt/hulk-scripts/rescate_pagos.js 2>&1', 30000);
    console.log('Test resultado:\n', test.trim());

    // Verificar crontab
    const cron = await sshExec('crontab -l');
    console.log('\nCrontab activo:\n', cron);
    
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
