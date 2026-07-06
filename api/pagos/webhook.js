import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase con Service Role Key para tener permisos de escritura sin RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS Headers if needed, though this is for server-to-server usually
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log('📦 Webhook Pagos APK Recibido:', payload);

    const { 
      referencia, 
      monto, 
      banco_origen, 
      banco_destino, 
      telefono, 
      fecha 
    } = payload;

    if (!referencia || !monto) {
      return res.status(400).json({ error: 'Faltan campos requeridos (referencia o monto)' });
    }

    // 1. Buscar si existe un pedido con esta referencia para relacionarlo automáticamente
    let pedido_id = null;
    let usuario_id = null;

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, cliente_id')
      .eq('referencia_pago', referencia.toString().trim())
      .single();

    if (pedido && !pedidoError) {
      pedido_id = pedido.id;
      usuario_id = pedido.cliente_id;
    }

    // 2. Insertar el pago en la base de datos
    const { data, error } = await supabase
      .from('pagos_apk')
      .insert({
        referencia: referencia.toString().trim(),
        monto: parseFloat(monto),
        banco_origen: banco_origen || null,
        banco_destino: banco_destino || null,
        telefono: telefono || null,
        fecha_pago: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
        pedido_id: pedido_id,
        usuario_id: usuario_id,
        raw_data: payload // Guardamos todo por si hay datos extra
      })
      .select()
      .single();

    if (error) {
      console.error('Error insertando pago APK:', error);
      // Si el error es por duplicado (referencia única), podríamos devolver 200 para que el APK no reintente
      if (error.code === '23505') { // unique violation
        return res.status(200).json({ message: 'Pago ya registrado anteriormente', data: null });
      }
      return res.status(500).json({ error: 'Error guardando el pago en la base de datos' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Pago registrado exitosamente',
      relacionado_con_pedido: pedido_id !== null,
      data 
    });

  } catch (error) {
    console.error('Error en webhook de pagos APK:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
