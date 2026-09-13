import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

import { fetchPinCentral } from '../pincentral/client.js';

// --- HELPER: Procesar pedido con TiendaGiftVen API ---
async function procesarPedidoConApi(pedidoId, apiKey) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from("pedidos")
    .select(
      "*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api, api_provider, api_provider_category_id)))"
    )
    .eq("id", pedidoId)
    .single();

  if (!pedidoActual?.pedido_items)
    return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const prod = Array.isArray(item.productos)
      ? item.productos[0]
      : item.productos;
    const j = Array.isArray(prod?.juegos) ? prod.juegos[0] : prod?.juegos;
    const isPendingOrFailed =
      !item.estado_proveedor ||
      item.estado_proveedor === "error" ||
      item.estado_proveedor === "fallido" ||
      item.estado_proveedor === "created";
    const effectiveProvider =
      prod?.api_provider || j?.api_provider || "tiendagiftven";
    if (
      prod?.proveedor_api_id &&
      (j?.procesamiento_automatico_api || prod?.api_provider) &&
      effectiveProvider !== "fazercards" &&
      effectiveProvider !== "pincentral" &&
      isPendingOrFailed
    ) {
      anySent = true;
      try {
        console.log(
          `🚀 [AutoProcess] Enviando item ${item.id} a TiendaGiftVen...`
        );
        const payload = {
          producto_id: parseInt(prod.proveedor_api_id, 10),
          merchant_ref: `HULK-ITEM-${item.id}`,
        };

        if (item.player_id) {
          payload.id_juego = String(item.player_id).trim();
          if (item.zone_id) payload.input2 = String(item.zone_id).trim();
        } else {
          payload.cantidad = item.cantidad || 1;
        }

        const res = await fetch(`https://tiendagiftven.tech/api/v1/comprar`, {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          let errData = {};
          try {
            errData = JSON.parse(text);
          } catch (e) {}
          throw new Error(
            errData.error || errData.message || "Error HTTP " + res.status
          );
        }

        const data = await res.json();

        if (data.ok) {
          const respEstado = data.estado ? data.estado.toLowerCase() : "";
          const isCompleted =
            respEstado === "completado" || respEstado === "aprobado";
          if (!isCompleted) allCompleted = false;

          // Extraer el código de la respuesta de TiendaGiftVen
          let codigoTGV = "";
          if (Array.isArray(data.codigos) && data.codigos.length > 0) {
            codigoTGV = data.codigos.join("\n");
          } else if (data.codigos && typeof data.codigos === "string") {
            codigoTGV = data.codigos;
          } else if (data.mensaje) {
            codigoTGV = data.mensaje;
          }

          await supabase.rpc("webhook_update_pedido_item", {
            p_item_id: item.id,
            p_estado_proveedor: data.estado || "procesando",
            p_proveedor_pedido_id: data.pedido_id,
            p_mensaje_proveedor: codigoTGV,
            p_estado: isCompleted ? "completado" : "procesando",
            p_codigo_entregado: codigoTGV || null, // ✅ Ahora visible al cliente
          });
        } else {
          throw new Error(data.error || "Error respuesta proveedor");
        }
      } catch (e) {
        console.error(
          `❌ [AutoProcess] Error en item ${item.id} con TiendaGiftVen:`,
          e.message
        );
        allCompleted = false;
        await supabase.rpc("webhook_update_pedido_item", {
          p_item_id: item.id,
          p_estado_proveedor: "error",
          p_mensaje_proveedor: e.message,
        });
      }
    } else {
      if (item.estado !== "completado") {
        allCompleted = false;
      }
    }
  }

  return { anySent, allCompleted };
}

// --- HELPER: Procesar pedido con FazerCards API ---
async function procesarPedidoConFazerCards(pedidoId, apiKey) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from("pedidos")
    .select(
      "*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api, api_provider, api_provider_category_id)))"
    )
    .eq("id", pedidoId)
    .single();

  if (!pedidoActual?.pedido_items)
    return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const prod = Array.isArray(item.productos)
      ? item.productos[0]
      : item.productos;
    const j = Array.isArray(prod?.juegos) ? prod.juegos[0] : prod?.juegos;
    const isPendingOrFailed =
      !item.estado_proveedor ||
      item.estado_proveedor === "error" ||
      item.estado_proveedor === "fallido" ||
      item.estado_proveedor === "created";
    const effectiveProvider = prod?.api_provider || j?.api_provider;
    const isFazerCards = effectiveProvider === "fazercards";

    if (
      prod?.proveedor_api_id &&
      (j?.procesamiento_automatico_api || prod?.api_provider) &&
      isFazerCards &&
      isPendingOrFailed
    ) {
      anySent = true;
      try {
        console.log(
          `🚀 [AutoProcess] Enviando item ${item.id} a FazerCards...`
        );
        const category_id =
          prod?.api_provider_category_id || j?.api_provider_category_id || "";
        const offer_id = prod.proveedor_api_id || "";

        // Consultar los campos requeridos por FazerCards para esta categoría
        let reqFields;
        let expectedFieldKeys = [];
        let endpointUrl = `https://api.fzr.cards/api/v2/topups/order`;
        let payload = {};

        if (
          category_id === "telegram_stars" ||
          category_id === "telegram_premium"
        ) {
          if (category_id === "telegram_stars") {
            endpointUrl = `https://api.fzr.cards/api/v2/telegram/stars/buy`;
            payload = {
              telegram_username: item.player_id || item.account_user,
              quantity: parseInt(offer_id),
            };
          } else if (category_id === "telegram_premium") {
            endpointUrl = `https://api.fzr.cards/api/v2/telegram/premium/buy`;
            payload = {
              telegram_username: item.player_id || item.account_user,
              months: parseInt(offer_id),
            };
          }
        } else {
          const actualCategoryId = category_id.replace("giftcard:", "");
          const isGiftcard = category_id.startsWith("giftcard:");

            if (isGiftcard) {
              endpointUrl = `https://api.fzr.cards/api/v2/giftcards/order`;
              payload = {
                category_id: actualCategoryId,
                card_id: isNaN(offer_id) ? offer_id : parseInt(offer_id, 10),
                quantity: item.cantidad || 1,
                auto_pay: true,
                pay: true
              };
              if (item.account_email) payload.email = item.account_email;
            } else {
              payload = {
                category_id: actualCategoryId,
                offer_id,
                auto_pay: true,
                pay: true,
                fields: {},
              };

              if (item.player_id) {
                const pId = String(item.player_id).trim();
                payload.fields.user_id = pId;
                payload.fields.userid = pId;
                payload.fields.player_id = pId;
                payload.fields.account = pId;
                payload.fields.uid = pId;
                payload.fields.role_id = pId;
                payload.fields.roleid = pId;
                payload.fields.character_id = pId;

                if (item.zone_id) {
                  const zId = String(item.zone_id).trim();
                  payload.fields.server_id = zId;
                  payload.fields.zone_id = zId;
                  payload.fields.zoneid = zId;
                  payload.fields.server = zId;
                  payload.fields.serverid = zId;
                  payload.fields.region = zId;
                  payload.fields.region_id = zId;
                }
              }
            }
          }

          let maxRetries = 20;
          let res;
          let data;
          let success = false;

          while (maxRetries > 0 && !success) {
            try {
              res = await fetch(endpointUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });

              if (!res.ok) {
                const text = await res.text();
                let errData = {};
                try {
                  errData = JSON.parse(text);
                } catch (e) {}
                
                const errMsg = errData.error || errData.message || "Error HTTP " + res.status;
                
                // Check if FazerCards rejected an extra field we sent
                const notExpectedMatch = errMsg.match(/Field "([^"]+)" is not expected/);
                if (res.status === 400 && notExpectedMatch) {
                  const badField = notExpectedMatch[1];
                  console.log(`[AutoProcess] FazerCards rejected field '${badField}', removing and retrying...`);
                  if (payload.fields && payload.fields[badField] !== undefined) {
                    delete payload.fields[badField];
                  } else if (payload[badField] !== undefined) {
                    delete payload[badField];
                  }
                  maxRetries--;
                  continue; // Retry without the bad field
                }

                throw new Error(errMsg);
              }

            const responseText = await res.text();
            try {
              data = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
              throw new Error("Respuesta inválida de FazerCards: " + responseText);
            }
            success = true;
          } catch (err) {
            // Check if it's a network error (like fetch failed)
            const isNetworkError = err.message.includes('fetch failed') || err.message.includes('network') || err.message.includes('timeout') || err.message.includes('ECONNREFUSED');
            
            if (isNetworkError) {
              console.log(`[AutoProcess] Error de red con FazerCards: ${err.message}. Reintentos restantes: ${maxRetries - 1}`);
              maxRetries--;
              if (maxRetries === 0) {
                throw new Error("Fallo de red tras múltiples reintentos: " + err.message);
              }
              // Esperar 1.5 segundos antes de reintentar
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              // Si es un error estructurado, lanzarlo para salir del loop
              throw err;
            }
          }
        }
        if (data && data.ok && data.order) {
          const respEstado = data.order.status
            ? data.order.status.toLowerCase()
            : "";
          const isCompleted = respEstado === "completed";
          if (!isCompleted) allCompleted = false;

          // Extraer el código/PIN de la respuesta de FazerCards
          let extractedPin = data.order.pin || "";
          if (!extractedPin && data.order.codes) {
            extractedPin = Array.isArray(data.order.codes)
              ? data.order.codes.join("\n")
              : data.order.codes;
          }
          if (
            !extractedPin &&
            data.order.cards &&
            Array.isArray(data.order.cards)
          ) {
            extractedPin = data.order.cards
              .map((c) => {
                if (typeof c === 'string') return c;
                let res = c.code || c.pin || c.serial || "";
                if (c.serial && res !== c.serial)
                  res += ` (Serial: ${c.serial})`;
                return res;
              })
              .join("\n");
          }
          if (!extractedPin && data.order.code) extractedPin = data.order.code;
          if (!extractedPin && data.order.serial)
            extractedPin = data.order.serial;

          await supabase.rpc("webhook_update_pedido_item", {
            p_item_id: item.id,
            p_estado_proveedor: data.order.status || "processing",
            p_proveedor_pedido_id: data.order.id,
            p_mensaje_proveedor: extractedPin,
            p_estado: isCompleted ? "completado" : "procesando",
            p_codigo_entregado: extractedPin || null, // ✅ Ahora visible al cliente
          });
        } else {
          throw new Error(data.error || "Error en respuesta de FazerCards");
        }
      } catch (e) {
        console.error(
          `❌ [AutoProcess] Error en item ${item.id} con FazerCards:`,
          e.message
        );
        allCompleted = false;
        await supabase.rpc("webhook_update_pedido_item", {
          p_item_id: item.id,
          p_estado_proveedor: "error",
          p_mensaje_proveedor: e.message,
        });
      }
    } else if (isFazerCards) {
      if (item.estado !== "completado") {
        allCompleted = false;
      }
    }
  }

  return { anySent, allCompleted };
}

// --- HELPER: Procesar pedido con PinCentral API ---
async function procesarPedidoConPinCentral(pedidoId, apiKey, apiSecret) {
  let anySent = false;
  let allCompleted = true;

  const { data: pedidoActual } = await supabase
    .from("pedidos")
    .select(
      "*, pedido_items(*, productos(*, juegos(procesamiento_automatico_api, api_provider, api_provider_category_id)))"
    )
    .eq("id", pedidoId)
    .single();

  if (!pedidoActual?.pedido_items)
    return { anySent: false, allCompleted: false };

  for (const item of pedidoActual.pedido_items) {
    const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    const j = Array.isArray(prod?.juegos) ? prod.juegos[0] : prod?.juegos;
    const isPendingOrFailed =
      !item.estado_proveedor ||
      item.estado_proveedor === "error" ||
      item.estado_proveedor === "fallido" ||
      item.estado_proveedor === "created";
    const effectiveProvider = prod?.api_provider || j?.api_provider;
    const isPinCentral = effectiveProvider === "pincentral";

    if (
      prod?.proveedor_api_id &&
      (j?.procesamiento_automatico_api || prod?.api_provider) &&
      isPinCentral &&
      isPendingOrFailed
    ) {
      anySent = true;
      try {
        console.log(`🚀 [AutoProcess] Enviando item ${item.id} a PinCentral...`);
        const product_code = prod.proveedor_api_id;
        const isRecharge = !!item.player_id; // Si hay player_id, es recarga
        
        let endpointUrl = '';
        let payload = {};
        
        if (isRecharge) {
          endpointUrl = 'recharges';
          payload = {
            order_id: `HULK-${item.id}`,
            product_code: product_code,
            service_user_id: String(item.player_id).trim()
          };
          // Enviar additional_data si el juego requiere zone_id (servidor)
          if (item.zone_id) {
            payload.additional_data = String(item.zone_id).trim();
          }
          if (item.account_email) {
            payload.client_email = item.account_email;
          }
        } else {
          endpointUrl = 'pins/authorize';
          payload = {
            product: product_code,
            quantity: item.cantidad || 1,
            order_id: `HULK-${item.id}`
          };
          if (item.account_email) {
            payload.client_email = item.account_email;
          }
        }

        const data = await fetchPinCentral(endpointUrl, 'POST', payload, apiKey, apiSecret);

        if (data && (data.status === 'created' || data.status === 'processing' || data.status === 'completed' || data.status === 'authorized')) {
          const respEstado = data.status.toLowerCase();
          
          let extractedCodes = '';
          if (isRecharge && respEstado === 'completed') {
             extractedCodes = data.receipt || 'Recarga Completada';
          }

          let finalStatus = respEstado;
          
          // Si es PIN y fue autorizado exitosamente de inmediato, pedimos la captura de los códigos PIN
          if (!isRecharge && respEstado === 'authorized') {
            console.log(`🚀 [AutoProcess] Capturando PIN para item ${item.id}...`);
            const captureData = await fetchPinCentral('pins/capture', 'POST', { id: data.id }, apiKey, apiSecret);
            if (captureData && captureData.pins && captureData.pins.length > 0) {
              finalStatus = 'captured';
              extractedCodes = captureData.pins.map(p => {
                let code = p.key || p.pin || p.code || '';
                if (p.serial) code += ` (Serial: ${p.serial})`;
                return code;
              }).join('\n');
            }
          }

          const isCompleted = finalStatus === 'completed' || finalStatus === 'captured';
          if (!isCompleted) allCompleted = false;

          await supabase.rpc("webhook_update_pedido_item", {
            p_item_id: item.id,
            p_estado_proveedor: finalStatus,
            p_proveedor_pedido_id: data.id,
            p_mensaje_proveedor: extractedCodes,
            p_estado: isCompleted ? "completado" : "procesando",
            p_codigo_entregado: extractedCodes || null,
          });
        } else {
          throw new Error(data.message || data.error || "Estado inválido de PinCentral");
        }
      } catch (e) {
        console.error(`❌ [AutoProcess] Error en item ${item.id} con PinCentral:`, e.message);
        allCompleted = false;
        await supabase.rpc("webhook_update_pedido_item", {
          p_item_id: item.id,
          p_estado_proveedor: "error",
          p_mensaje_proveedor: e.message,
        });
      }
    } else if (isPinCentral) {
      if (item.estado !== "completado") {
        allCompleted = false;
      }
    }
  }

  return { anySent, allCompleted };
}

// --- HELPER: Aplicar Cashback ---
async function applyCashback(pedido, supabaseClient, adminId) {
  if (pedido.cashback_aplicado) return;

  const { data: configData } = await supabaseClient
    .from("configuracion")
    .select("*")
    .in("clave", ["cashback_activo", "cashback_porcentaje"]);
  const config = {};
  if (configData) {
    configData.forEach((c) => {
      config[c.clave] =
        c.valor_texto !== null ? c.valor_texto : String(c.valor);
    });
  }

  if (config.cashback_activo !== "true" && config.cashback_activo !== "1")
    return;
  const porcentaje = Number(config.cashback_porcentaje) || 0;
  if (porcentaje <= 0) return;

  const { data: pedidoItems } = await supabaseClient
    .from("pedido_items")
    .select("*, productos(juego_id, juegos(cashback_activo))")
    .eq("pedido_id", pedido.id);
  let gameAllowsCashback = true;
  if (pedidoItems && pedidoItems.length > 0) {
    const prod = Array.isArray(pedidoItems[0].productos)
      ? pedidoItems[0].productos[0]
      : pedidoItems[0].productos;
    if (prod?.juegos?.cashback_activo === false) gameAllowsCashback = false;
  }

  if (!gameAllowsCashback) return;

  const ref = (pedido.referencia_pago || "").toLowerCase();
  let isBs =
    ref.includes("billetera bs") ||
    ref.includes("pago móvil") ||
    ref.includes("pago movil") ||
    ref.includes("bolívares") ||
    ref.includes("bs");

  if (!isBs && pedido.metodo_pago_id) {
    const { data: mData } = await supabaseClient
      .from("metodos_pago")
      .select("nombre, habilitado_billetera_bs")
      .eq("id", pedido.metodo_pago_id)
      .maybeSingle();
    if (
      mData &&
      (mData.habilitado_billetera_bs ||
        mData.nombre.toLowerCase().includes("pago") ||
        mData.nombre.toLowerCase().includes("bs") ||
        mData.nombre.toLowerCase().includes("bolívares"))
    ) {
      isBs = true;
    }
  }

  const { data: walletData } = await supabaseClient
    .from("billeteras")
    .select("*")
    .eq("auth_user_id", pedido.cliente_id)
    .maybeSingle();
  const baseUsd = walletData?.saldo || 0;
  const baseBs = walletData?.saldo_bs || 0;

  const updateData = {
    cashback_aplicado: true,
    cashback_porcentaje: porcentaje,
  };

  if (isBs) {
    const returnBs = Number(pedido.total_bs) * (porcentaje / 100);
    if (returnBs > 0) {
      await supabaseClient.rpc("ajustar_saldo_billetera_bs_rpc", {
        p_user_id: pedido.cliente_id,
        p_admin_id: adminId || pedido.cliente_id,
        p_nuevo_saldo: baseBs + returnBs,
        p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`,
      });
      updateData.cashback_monto = returnBs;
      updateData.cashback_moneda = "bs";
    }
  } else {
    const returnUsd = Number(pedido.total_usd) * (porcentaje / 100);
    if (returnUsd > 0) {
      await supabaseClient.rpc("ajustar_saldo_billetera_rpc", {
        p_user_id: pedido.cliente_id,
        p_admin_id: adminId || pedido.cliente_id,
        p_nuevo_saldo: baseUsd + returnUsd,
        p_nota: `💸 Cash Back (${porcentaje}%) por Pedido #${pedido.numero_pedido}`,
      });
      updateData.cashback_monto = returnUsd;
      updateData.cashback_moneda = "usd";
    }
  }

  await supabaseClient.from("pedidos").update(updateData).eq("id", pedido.id);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { pedido_id, force } = req.body;
    if (!pedido_id) {
      return res.status(400).json({ error: "Falta pedido_id" });
    }

    console.log(`📦 Auto-procesando pedido: ${pedido_id}`);

    // Verificar que el pedido existe y está verificado
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (!pedido.pago_verificado) {
      return res
        .status(400)
        .json({ error: "El pedido no tiene el pago verificado" });
    }

    if (pedido.estado === "completado") {
      return res
        .status(200)
        .json({ success: true, message: "El pedido ya está completado" });
    }

    // --- Obtener items del pedido para checar auto-procesamiento ---
    const { data: pedidoConItems } = await supabase
      .from("pedidos")
      .select(
        "*, pedido_items(*, productos(proveedor_api_id, api_provider, api_provider_category_id, juego_id, juegos(procesamiento_automatico_api, api_provider, api_provider_category_id)))"
      )
      .eq("id", pedido.id)
      .single();

    const tieneApiItems = pedidoConItems?.pedido_items?.some((i) => {
      const p = Array.isArray(i.productos) ? i.productos[0] : i.productos;
      const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
      return p?.proveedor_api_id && (j?.procesamiento_automatico_api || p?.api_provider);
    });

    if (tieneApiItems) {
      console.log(
        `⚡ Procesando API para pedido ${pedido.id} (Force: ${force})...`
      );

      // Identificar el proveedor del primer item para obtener la key adecuada.
      // (Asume un proveedor principal por pedido, si hay mezclados, idealmente separar).
      let providerName = "tiendagiftven";
      const firstApiItem = pedidoConItems.pedido_items.find((i) => {
        const p = Array.isArray(i.productos) ? i.productos[0] : i.productos;
        const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
        return p?.proveedor_api_id && (j?.procesamiento_automatico_api || p?.api_provider);
      });
      if (firstApiItem) {
        const p = Array.isArray(firstApiItem.productos)
          ? firstApiItem.productos[0]
          : firstApiItem.productos;
        const j = Array.isArray(p?.juegos) ? p.juegos[0] : p?.juegos;
        providerName = p?.api_provider || j?.api_provider || "tiendagiftven";
      }

      // Obtener API key respectiva
        const configKey = providerName === "fazercards" ? "fazercards_api_key" : (providerName === "pincentral" ? "pincentral_api_key" : "tiendagiftven_api_key");
      const { data: configRows } = await supabase
        .from("configuracion")
        .select("clave, valor, valor_texto")
        .in("clave", ["fazercards_api_key", "tiendagiftven_api_key", "pincentral_api_key", "pincentral_api_secret"]);

      let apiKey = "";
      let apiSecret = "";

      if (providerName === "pincentral") {
        apiKey = configRows?.find(r => r.clave === 'pincentral_api_key')?.valor_texto;
        apiSecret = configRows?.find(r => r.clave === 'pincentral_api_secret')?.valor_texto;
      } else {
        const row = configRows?.find(r => r.clave === configKey);
        apiKey = row?.valor_texto || row?.valor;
      }

      if (apiKey && (providerName !== "pincentral" || apiSecret)) {
        await supabase.rpc("webhook_update_pedido", {
          p_pedido_id: pedido.id,
          p_estado: "procesando",
        });

        let anySent = false;
        let allCompleted = false;

        if (providerName === "fazercards") {
          const resProvider = await procesarPedidoConFazerCards(pedido.id, apiKey);
          anySent = resProvider.anySent;
          allCompleted = resProvider.allCompleted;
        } else if (providerName === "pincentral") {
          const resProvider = await procesarPedidoConPinCentral(pedido.id, apiKey, apiSecret);
          anySent = resProvider.anySent;
          allCompleted = resProvider.allCompleted;
        } else {
          const resProvider = await procesarPedidoConApi(pedido.id, apiKey);
          anySent = resProvider.anySent;
          allCompleted = resProvider.allCompleted;
        }

        if ((anySent && allCompleted) || (force && allCompleted)) {
          // Fallback: Assign to SuperAdmin if automatically processed
          let vendedorClientUuid = null;
          const { data: superAdmin } = await supabase
            .from("clientes")
            .select("id")
            .eq("usuario", "recargashulk@gmail.com")
            .single();

          if (superAdmin) {
            vendedorClientUuid = superAdmin.id;
          }

          // Registrar la venta para cada item
          for (const item of pedidoConItems.pedido_items) {
            const { error: rpcErr } = await supabase.rpc(
              "registrar_venta_rpc",
              {
                p_producto_id: item.producto_id,
                p_cantidad: item.cantidad,
                p_notas: `Pedido #${pedidoConItems.numero_pedido} (API Sync)`,
                p_cliente_id: pedidoConItems.cliente_id,
                p_vendedor_id: vendedorClientUuid,
                p_metodo_pago_id: pedidoConItems.metodo_pago_id,
                p_referencia_pago: pedidoConItems.referencia_pago,
                p_player_id: item.player_id,
                p_account_email: item.account_email,
                p_account_password: item.account_password,
                p_pedido_id: pedido.id,
                p_owner_id: pedidoConItems.owner_id,
              }
            );

            if (rpcErr) {
              console.error(
                `❌ Error registrando venta API Sync para item ${item.id}:`,
                rpcErr
              );
            }
          }

          await supabase.rpc("webhook_update_pedido", {
            p_pedido_id: pedido.id,
            p_estado: "completado",
            p_venta_registrada: true,
            p_fecha_respuesta: new Date().toISOString(),
          });

          // Aplicar cashback si corresponde
          await applyCashback(pedido, supabase, vendedorClientUuid);

          console.log(
            `🎉 Pedido #${pedido.id} completado automáticamente vía API ${providerName}`
          );
          return res
            .status(200)
            .json({ success: true, message: "Pedido completado con API" });
        } else if (anySent) {
          console.log(`⏳ Pedido #${pedido.id} en procesamiento.`);
          return res
            .status(200)
            .json({ success: true, message: "Pedido procesando con API" });
        } else {
          return res
            .status(400)
            .json({ error: "No se enviaron items a la API. Puede que ya tengan un ID de proveedor o el estado del proveedor no sea apto para reintento." });
        }
      } else {
        return res
          .status(500)
          .json({ error: `No hay configuración de API key para el proveedor ${providerName} (${configKey})` });
      }
    } else {
      return res
        .status(200)
        .json({
          success: true,
          message:
            "El pedido no requiere procesamiento por API o no tiene auto-proceso activo",
        });
    }
  } catch (error) {
    console.error("Error en auto_process:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
