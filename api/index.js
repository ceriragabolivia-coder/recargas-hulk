export default async function handler(req, res) {
  try {
    let url = req.url.split('?')[0]; 
    if (url.endsWith('/') && url.length > 1) {
      url = url.slice(0, -1);
    }
    
    // Binance
    if (url === '/api/binance/create-order') return (await import('../api-core/binance/create-order.js')).default(req, res);
    if (url === '/api/binance/webhook') return (await import('../api-core/binance/webhook.js')).default(req, res);
    if (url === '/api/binance/verify-pay') return (await import('../api-core/binance/verify-pay.js')).default(req, res);
    if (url === '/api/binance/verify-pay-pedido') return (await import('../api-core/binance/verify-pay-pedido.js')).default(req, res);
    if (url === '/api/binance/debug-pay') return (await import('../api-core/binance/debug-pay.js')).default(req, res);
    if (url === '/api/binance/debug-env') return (await import('../api-core/binance/debug-env.js')).default(req, res);

    
    // Debug
    if (url === '/api/debug/negatives') return (await import('../api-core/debug/negatives.js')).default(req, res);
    
    // Fazercards
    if (url === '/api/fazercards/proxy') return (await import('../api-core/fazercards/proxy.js')).default(req, res);
    if (url === '/api/fazercards/webhook') return (await import('../api-core/fazercards/webhook.js')).default(req, res);
    
    // Pagos
    if (url === '/api/pagos/marcar_usado') return (await import('../api-core/pagos/marcar_usado.js')).default(req, res);
    if (url === '/api/pagos/webhook') return (await import('../api-core/pagos/webhook.js')).default(req, res);
    
    // Pedidos
    if (url === '/api/pedidos/auto_process') return (await import('../api-core/pedidos/auto_process.js')).default(req, res);
    
    // PinCentral
    if (url === '/api/pincentral/proxy') return (await import('../api-core/pincentral/proxy.js')).default(req, res);
    if (url === '/api/pincentral/webhook') return (await import('../api-core/pincentral/webhook.js')).default(req, res);
    
    // Sync
    if (url === '/api/sync/prices' || url === '/api/sync/prices_manual') return (await import('../api-core/sync/prices.js')).default(req, res);
    
    // TiendaGiftVen
    if (url === '/api/tiendagiftven/check_logs') return (await import('../api-core/tiendagiftven/check_logs.js')).default(req, res);
    if (url === '/api/tiendagiftven/proxy') return (await import('../api-core/tiendagiftven/proxy.js')).default(req, res);
    if (url === '/api/tiendagiftven/setup_webhook') return (await import('../api-core/tiendagiftven/setup_webhook.js')).default(req, res);
    if (url === '/api/tiendagiftven/sync_order') return (await import('../api-core/tiendagiftven/sync_order.js')).default(req, res);
    if (url === '/api/tiendagiftven/webhook') return (await import('../api-core/tiendagiftven/webhook.js')).default(req, res);
    
    // Root
    if (url === '/api/env_check') return (await import('../api-core/env_check.js')).default(req, res);
    
    return res.status(404).json({ error: "API route not found", path: url });
  } catch (error) {
    console.error("Error in Master API Router:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
