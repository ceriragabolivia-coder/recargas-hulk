import { supabase } from '../lib/supabase';

export async function processAutoDeliveryOrder(pedidoId) {
  try {
    const { data, error } = await supabase.rpc('procesar_pedido_automatico_rpc', {
      p_pedido_id: pedidoId
    });
    
    if (error) {
      console.error('Error in auto-delivery processing rpc:', error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error('Error in auto-delivery processing:', error);
    return false;
  }
}
