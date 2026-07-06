import { createClient } from '@supabase/supabase-js';

// Inicializar cliente dentro del handler para evitar crashes en el inicio de Vercel
let supabase = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Faltan variables de entorno de Supabase en Vercel', 
        missingUrl: !supabaseUrl, 
        missingKey: !supabaseKey,
        envKeys: Object.keys(process.env),
        projectName: process.env.VERCEL_PROJECT_NAME,
        vercelUrl: process.env.VERCEL_URL
      });
    }
    
    if (!supabase) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    // 1. Validar la autorización (Token Secreto)
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.BDV_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('⚠️ BDV_WEBHOOK_SECRET no está configurado en el servidor.');
      return res.status(500).json({ error: 'Server configuration error, missing BDV_WEBHOOK_SECRET' });
    }

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      console.warn('⛔ Intento de acceso no autorizado al webhook de BDV.');
      return res.status(401).json({ error: 'Unauthorized', receivedHeader: authHeader });
    }

    // 2. Extraer datos de la petición
    const { referencia, monto_bs, texto_original } = req.body;

    if (!referencia || monto_bs === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: referencia, monto_bs' });
    }

    console.log(`🏦 Recibida notificación BDV: Ref ${referencia} - Monto ${monto_bs} Bs`);

    // 3. Procesar mediante la RPC de Supabase
    // Esta RPC intentará insertar y buscar un pedido que coincida para aprobarlo
    const { data: rpcResult, error: rpcError } = await supabase.rpc('procesar_notificacion_bdv_rpc', {
      p_referencia: referencia.toString().trim(),
      p_monto_bs: parseFloat(monto_bs),
      p_texto_original: texto_original || null
    });

    if (rpcError) {
      console.error('❌ Error en procesar_notificacion_bdv_rpc:', rpcError);
      return res.status(500).json({ error: 'Database processing failed', details: rpcError.message });
    }

    console.log('✅ Notificación BDV procesada:', rpcResult);

    return res.status(200).json({ 
      ok: true, 
      message: 'Notificación procesada exitosamente',
      result: rpcResult
    });

  } catch (error) {
    console.error('❌ Error general en Webhook BDV:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
