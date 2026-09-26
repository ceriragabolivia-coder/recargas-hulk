import { getBalance, getCatalog } from './client.js';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const endpoint = req.query.endpoint;

  try {
    if (endpoint === 'saldo') {
      const balance = await getBalance();
      // Mapear al formato que el frontend espera (saldo disponible)
      return res.status(200).json({ ok: true, saldo: balance.available_balance || 0 });
    } else if (endpoint === 'productos') {
      const catalog = await getCatalog();
      // Devolver los items
      return res.status(200).json({ ok: true, productos: catalog.items || [] });
    } else {
      return res.status(400).json({ ok: false, error: "Endpoint no válido" });
    }
  } catch (error) {
    console.error("❌ Error en Central One Proxy:", error);
    return res.status(500).json({ ok: false, error: error.message || "Error interno del servidor" });
  }
}
