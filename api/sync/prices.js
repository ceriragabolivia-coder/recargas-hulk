import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Basic security check: either Vercel cron secret or admin authorization
  const authHeader = req.headers.authorization || '';
  const cronSecretHeader = req.headers['x-cron-secret'] || '';
  const expectedCronSecret = process.env.CRON_SECRET || 'secret';
  
  let isAdmin = false;
  let isCron = false;
  
  if (cronSecretHeader && cronSecretHeader === expectedCronSecret) {
    isCron = true;
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: user, error } = await supabase.auth.getUser(token);
    if (user?.user) {
      const { data: profile } = await supabase.from('clientes').select('rol').eq('id', user.user.id).single();
      if (profile?.rol === 'admin' || profile?.rol === 'administrador') {
        isAdmin = true;
      }
    }
  }

  if (!isAdmin && !isCron) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Iniciando sincronización de precios...');
    let totalUpdated = 0;
    let totalErrors = 0;
    const errorsList = [];

    // 1. Obtener APIs Keys de la configuración
    const { data: configRows } = await supabase.from('configuracion').select('clave, valor_texto').in('clave', ['tiendagiftven_api_key', 'fazercards_api_key']);
    const tgvApiKey = configRows?.find(r => r.clave === 'tiendagiftven_api_key')?.valor_texto;
    const fcApiKey = configRows?.find(r => r.clave === 'fazercards_api_key')?.valor_texto;

    // 2. Obtener productos activos con proveedor_api_id
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, costo_base, proveedor_api_id, juego_id, juegos(api_provider, api_provider_category_id)')
      .not('proveedor_api_id', 'is', null)
      .not('proveedor_api_id', 'eq', '')
      .eq('activo', true);

    if (prodError || !productos) {
      throw new Error(prodError?.message || 'Error fetching products');
    }

    const tgvProducts = productos.filter(p => !p.juegos?.api_provider || p.juegos?.api_provider === 'tiendagiftven');
    const fcProducts = productos.filter(p => p.juegos?.api_provider === 'fazercards');

    // ============================================
    // SINCRONIZACIÓN DE TIENDAGIFTVEN
    // ============================================
    if (tgvApiKey && tgvApiKey !== '0' && tgvProducts.length > 0) {
      console.log('📦 Sincronizando TiendaGiftVen...');
      try {
        const resTgv = await fetch('https://tiendagiftven.tech/api/v1/productos', {
          headers: { 'X-API-Key': tgvApiKey }
        });
        const dataTgv = await resTgv.json();
        if (dataTgv.ok && dataTgv.productos) {
          const providerMap = {};
          dataTgv.productos.forEach(p => providerMap[p.id.toString()] = parseFloat(p.precio));

          for (const prod of tgvProducts) {
            const apiId = String(prod.proveedor_api_id).trim();
            if (providerMap[apiId] !== undefined) {
              const newCosto = providerMap[apiId];
              if (Math.abs(parseFloat(prod.costo_base || 0) - newCosto) > 0.001) {
                const { error } = await supabase.from('productos').update({ costo_base: newCosto }).eq('id', prod.id);
                if (error) {
                  errorsList.push(`Error TGV Prod ${prod.id}: ${error.message}`);
                  totalErrors++;
                } else {
                  totalUpdated++;
                }
              }
            } else {
              errorsList.push(`TGV Prod ${prod.id} no encontrado en el proveedor (ID: ${apiId})`);
            }
          }
        } else {
          errorsList.push('Error al consultar el catálogo de TiendaGiftVen');
        }
      } catch (e) {
        errorsList.push(`Exception TGV: ${e.message}`);
        totalErrors++;
      }
    }

    // ============================================
    // SINCRONIZACIÓN DE FAZERCARDS
    // ============================================
    if (fcApiKey && fcApiKey !== '0' && fcProducts.length > 0) {
      console.log('📦 Sincronizando FazerCards...');
      // Agrupar por category_id
      const fcGroups = {};
      fcProducts.forEach(p => {
        const cat = p.juegos?.api_provider_category_id;
        if (cat) {
          if (!fcGroups[cat]) fcGroups[cat] = [];
          fcGroups[cat].push(p);
        }
      });

      for (const [categoryId, prods] of Object.entries(fcGroups)) {
        try {
          let url = `https://api.fzr.cards/api/v2/topups/offers?category_id=${encodeURIComponent(categoryId)}`;
          let isGiftcard = false;
          let isTelegramStars = false;
          let isTelegramPremium = false;

          if (categoryId === 'telegram_stars') {
            isTelegramStars = true;
            url = `https://api.fzr.cards/api/v2/telegram/stars`;
          } else if (categoryId === 'telegram_premium') {
            isTelegramPremium = true;
            url = `https://api.fzr.cards/api/v2/telegram/premium`;
          } else if (categoryId.startsWith('giftcard:')) {
            isGiftcard = true;
            const actualCategoryId = categoryId.replace('giftcard:', '');
            url = `https://api.fzr.cards/api/v2/giftcards/cards?category_id=${actualCategoryId}`;
          }

          const resFc = await fetch(url, { headers: { 'Authorization': `Bearer ${fcApiKey}` } });
          const dataFc = await resFc.json();

          let providerMap = {};
          if (dataFc.ok) {
            if (isTelegramStars && dataFc.price_per_star) {
              const presetAmounts = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
              presetAmounts.forEach(a => {
                providerMap[a.toString()] = parseFloat(dataFc.price_per_star) * a;
              });
            } else if (isTelegramPremium && dataFc.plans) {
              dataFc.plans.forEach(p => providerMap[p.months.toString()] = parseFloat(p.price_usd));
            } else if (isGiftcard && dataFc.offers) {
              dataFc.offers.forEach(o => providerMap[o.card_id.toString()] = parseFloat(o.price_usd));
            } else if (dataFc.offers) {
              dataFc.offers.forEach(o => providerMap[o.offer_id.toString()] = parseFloat(o.price_usd));
            }
          } else {
             errorsList.push(`Error catálogo FC (${categoryId}): ${dataFc.error || 'Unknown'}`);
             continue;
          }

          for (const prod of prods) {
            const apiId = String(prod.proveedor_api_id).trim();
            if (providerMap[apiId] !== undefined) {
               const newCosto = providerMap[apiId];
               if (Math.abs(parseFloat(prod.costo_base || 0) - newCosto) > 0.001) {
                  const { error } = await supabase.from('productos').update({ costo_base: newCosto }).eq('id', prod.id);
                  if (error) {
                    errorsList.push(`Error FC Prod ${prod.id}: ${error.message}`);
                    totalErrors++;
                  } else {
                    totalUpdated++;
                  }
               }
            } else {
               errorsList.push(`FC Prod ${prod.id} no encontrado en el proveedor (Categoría: ${categoryId}, ID: ${apiId})`);
            }
          }
        } catch (e) {
          errorsList.push(`Exception FC (${categoryId}): ${e.message}`);
          totalErrors++;
        }
      }
    }

    console.log(`✅ Sincronización finalizada. Actualizados: ${totalUpdated}. Errores: ${totalErrors}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Sincronización completada. ${totalUpdated} productos actualizados.`,
      updated: totalUpdated,
      errors: totalErrors,
      details: errorsList
    });

  } catch (error) {
    console.error('❌ Error general de sincronización:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
