import { signPreviewToken, vercelProductionOrigin } from "../lib/vercel-tokens.js";
import { adminCookie, bridgeKey, cookieValue, deploymentOrigin, json, storefrontBackend } from "../lib/preview.js";
import { handleProductionStock } from "../lib/production-stock.js";
import { isOwner } from "../lib/owner-session.js";

export default {
  async fetch(request) {
    const origin = deploymentOrigin(request);
    if (!origin) return json({ error: "Abre la tienda desde su enlace oficial." }, 403);
    if (request.method !== "GET" && request.method !== "PUT") return json({ error: "Método no permitido." }, 405);
    if (request.method === "PUT" && request.headers.get("Origin") !== origin) return json({ error: "Origen no autorizado." }, 403);

    const admin = cookieValue(request, adminCookie);
    if (origin === vercelProductionOrigin) {
      try {
        return await handleProductionStock(request, await isOwner(request, origin));
      } catch {
        return json({ error: "No pudimos consultar o guardar el inventario." }, 503);
      }
    }

    const key = bridgeKey();
    const serviceToken = process.env.FILTER_COFFEE_SITES_TOKEN;
    if (!key || !serviceToken) return json({ error: "El inventario no está disponible." }, 503);

    try {
      const proof = await signPreviewToken(key, "request", origin, crypto.randomUUID(), 60);
      const headers = new Headers({
        "OAI-Sites-Authorization": `Bearer ${serviceToken}`,
        "X-Filter-Coffee-Preview": proof,
      });
      if (admin) headers.set("X-Filter-Coffee-Admin", admin);
      if (request.method === "PUT") headers.set("Content-Type", request.headers.get("Content-Type") ?? "");
      const response = await fetch(`${storefrontBackend}/api/vercel-stock`, {
        method: request.method,
        headers,
        body: request.method === "PUT" ? await request.text() : undefined,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      return json(await response.json(), response.status);
    } catch {
      return json({ error: "No pudimos consultar el inventario." }, 503);
    }
  },
};
