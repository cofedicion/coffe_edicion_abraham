import { deploymentOrigin, json } from "../lib/preview.js";
import { isProductId, readProductionStock } from "../lib/production-stock.js";
import { vercelProductionOrigin } from "../lib/vercel-tokens.js";

const period = 60_000;
const attempts = new Map();

function tooManyAttempts(request) {
  const key = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  if (!key) return false;
  const now = Date.now();
  for (const [address, entry] of attempts) if (entry.expires <= now) attempts.delete(address);
  if (!attempts.has(key) && attempts.size >= 1000) return true;
  const entry = attempts.get(key) ?? { remaining: 15, expires: now + period };
  if (entry.remaining <= 0) return true;
  entry.remaining -= 1;
  attempts.set(key, entry);
  return false;
}

function validItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 4) return false;
  const ids = new Set();
  for (const item of items) {
    if (!isProductId(item?.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

export async function POST(request) {
  const origin = deploymentOrigin(request);
  if (origin !== vercelProductionOrigin || request.headers.get("Origin") !== origin) {
    return json({ error: "Abre el pedido desde la tienda." }, 403);
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Formato de pedido inválido." }, 415);
  }
  if (tooManyAttempts(request)) return json({ error: "Espera un minuto antes de volver a intentarlo." }, 429);
  if (Number(request.headers.get("Content-Length")) > 2048) return json({ error: "El pedido excede el tamaño permitido." }, 413);

  const body = await request.text();
  if (body.length > 2048) return json({ error: "El pedido excede el tamaño permitido." }, 413);
  let data;
  try { data = JSON.parse(body); } catch { return json({ error: "Pedido inválido." }, 400); }
  if (data?.website !== "" || !validItems(data.items)) return json({ error: "Revisa los productos y las cantidades." }, 422);

  try {
    const soldOut = await readProductionStock();
    if (data.items.some((item) => soldOut.includes(item.id))) return json({ error: "Hay productos agotados en tu carrito." }, 409);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "No pudimos verificar la disponibilidad. Intenta de nuevo." }, 503);
  }
}
