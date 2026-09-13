export const processTiendaGiftVenOrder = async (pedidoId, apiKey, forceTrigger = false) => {
  try {
    console.log(`🚀 Iniciando proceso TiendaGiftVen seguro (via Backend) para pedido #${pedidoId}...`);
    const res = await fetch('/api/pedidos/auto_process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId, force: forceTrigger }),
      keepalive: true
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      console.warn(`⚠️ Resultado API:`, data.error || data);
      return { success: false, error: data.error || "Error en la respuesta de la API" };
    }
    
    if (data.success) {
      console.log(`🎉 Procesado:`, data.message);
      return { success: true };
    }
    
    return { success: false, error: "Respuesta no exitosa de la API" };
  } catch (error) {
    console.error(`❌ Error invocando backend para API:`, error);
    return { success: false, error: error.message };
  }
};
