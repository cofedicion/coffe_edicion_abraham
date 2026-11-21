import { get, put } from "@vercel/blob";
import { json } from "./preview.js";

const catalog = new Set(["filtro-artesanal", "cafe-4oz", "cafe-8oz", "cafe-16oz"]);
const initialSoldOut = new Set(["filtro-artesanal", "cafe-4oz"]);
const stockPath = (productId) => `availability/${productId}.json`;

export async function readProductionStock(read = get) {
  const products = await Promise.all(Array.from(catalog, async (productId) => {
    const entry = await read(stockPath(productId), { access: "private", useCache: false });
    if (!entry) return initialSoldOut.has(productId) ? productId : null;
    if (entry.statusCode !== 200 || !entry.stream) throw new Error("Inventory record is unavailable.");
    const value = await new Response(entry.stream).json();
    return value.soldOut === true ? productId : null;
  }));
  return products.filter(Boolean);
}

export async function handleProductionStock(request, canManage, read = get, write = put) {
  if (request.method === "PUT") {
    if (!canManage) return json({ error: "Se requiere acceso de administrador." }, 403);
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "Formato no admitido." }, 415);
    }
    const data = await request.json().catch(() => null);
    if (!catalog.has(data?.productId) || typeof data?.soldOut !== "boolean") {
      return json({ error: "Producto o disponibilidad inválidos." }, 400);
    }
    await write(stockPath(data.productId), JSON.stringify({ soldOut: data.soldOut }), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
  }
  return json({ canManage, soldOut: await readProductionStock(read) }, 200);
}
