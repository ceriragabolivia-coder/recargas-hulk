export const processTiendaGiftVenOrder = async (pedidoId, apiKey, forceTrigger = false) => {
  try {
    console.log(`🚀 Iniciando proceso TiendaGiftVen seguro (via Backend) para pedido #${pedidoId}...`);
    const res = await fetch('/api/pedidos/auto_process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId, force: forceTrigger })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      console.warn(`⚠️ Resultado API:`, data.error || data);
      return false;
    }
    
    if (data.success) {
      console.log(`🎉 Procesado:`, data.message);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error invocando backend para TiendaGiftVen:`, error);
    return false;
  }
};
