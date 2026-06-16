import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log('📦 Webhook TiendaGiftVen Recibido:', payload);

    const { merchant_ref, estado, pedido_id, mensaje, codigos } = payload;

    if (!merchant_ref) {
      return res.status(400).json({ error: 'Missing merchant_ref' });
    }

    // Extraer el ID del item de pedido. Asumimos el formato 'CERIRAGA-ITEM-123'
    const itemIdMatch = merchant_ref.match(/ITEM-(\d+)$/);
    if (!itemIdMatch) {
      return res.status(400).json({ error: 'Invalid merchant_ref format' });
    }

    const itemId = parseInt(itemIdMatch[1], 10);

    // Preparar los datos a actualizar
    const updateData = {
      estado_proveedor: estado,
      proveedor_pedido_id: pedido_id
    };

    if (estado === 'completado') {
      updateData.estado = 'completado'; // Completa el item internamente en Ceriraga
    }

    if (codigos && codigos.length > 0) {
      updateData.mensaje_proveedor = codigos.join('\n');
    } else if (mensaje) {
      updateData.mensaje_proveedor = mensaje;
    }

    // Actualizar el item en la base de datos
    const { error } = await supabase
      .from('pedido_items')
      .update(updateData)
      .eq('id', itemId);

    if (error) {
      console.error('❌ Error actualizando pedido_item:', error);
      return res.status(500).json({ error: 'Database update failed' });
    }

    console.log(`✅ Item ${itemId} actualizado a estado: ${estado}`);
    return res.status(200).json({ ok: true, message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Error general en Webhook TiendaGiftVen:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
