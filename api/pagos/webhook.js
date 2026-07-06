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
    const secret = req.headers.authorization;
    if (secret !== 'Bearer BdvSecret_Hulk_2026!') {
      console.warn('Intento de acceso no autorizado al webhook APK:', secret);
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    let auto_despachado = false;

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, cliente_id, estado, total_bs')
      .eq('referencia_pago', referencia.toString().trim())
      .single();

    if (pedido && !pedidoError) {
      pedido_id = pedido.id;
      usuario_id = pedido.cliente_id;
      
      // AUTO DESPACHO SI EL PEDIDO ESTÁ PENDIENTE Y EL MONTO COINCIDE
      if (pedido.estado === 'pendiente') {
        const montoRecibido = parseFloat(monto);
        const montoEsperado = parseFloat(pedido.total_bs);
        
        // Tolerancia de 0.01 bs para evitar errores por redondeo
        if (Math.abs(montoRecibido - montoEsperado) <= 0.05) {
            // Aprobar pedido automáticamente a través del RPC
            const { data: processData, error: processError } = await supabase.rpc('procesar_pedido_automatico_rpc', {
                p_pedido_id: pedido.id
            });
            if (!processError && processData?.success) {
                auto_despachado = true;
                console.log(`✅ Pedido ${pedido.id} auto-despachado vía Webhook APK`);
            } else {
                console.error(`❌ Error en auto-despacho del pedido ${pedido.id}:`, processError || processData);
            }
        } else {
            console.warn(`⚠️ Pedido ${pedido.id} no auto-despachado por diferencia de montos. Esperado: ${montoEsperado}, Recibido: ${montoRecibido}`);
        }
      }
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
        status: auto_despachado ? 'usado' : 'disponible',
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
      auto_despachado: auto_despachado,
      data 
    });

  } catch (error) {
    console.error('Error en webhook de pagos APK:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
