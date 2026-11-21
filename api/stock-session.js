import { adminCookie, cookieValue, deploymentOrigin, json, loginCookie, previewCookie } from "../lib/preview.js";
import { productionOwnerSession } from "../lib/owner-session.js";
import { vercelProductionOrigin } from "../lib/vercel-tokens.js";

export function GET(request) {
  if (deploymentOrigin(request) !== vercelProductionOrigin) return json({ error: "Acceso no autorizado." }, 403);
  const scriptNonce = crypto.randomUUID();
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Acceso | Filter Coffee</title>
<p id="status" role="status">Verificando el acceso…</p><a id="retry" href="/admin" hidden>Volver a Administración</a>
<script nonce="${scriptNonce}">
  (async () => {
    const proof = new URLSearchParams(location.hash.slice(1)).get("proof");
    history.replaceState(null, "", location.pathname);
    try {
      if (!proof) throw new Error("Missing access proof");
      const response = await fetch("/api/stock-session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proof }),
      });
      if (!response.ok) throw new Error("Access was denied");
      location.replace("/site.html#productos");
    } catch {
      document.getElementById("status").textContent = "La solicitud de acceso venció.";
      document.getElementById("retry").hidden = false;
    }
  })();
</script></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${scriptNonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
    },
  });
}

export async function POST(request) {
  if (deploymentOrigin(request) !== vercelProductionOrigin || request.headers.get("Origin") !== vercelProductionOrigin) {
    return json({ error: "Acceso no autorizado." }, 403);
  }
  const data = await request.json().catch(() => null);
  const binding = cookieValue(request, loginCookie);
  const proof = typeof data?.proof === "string" ? data.proof : null;
  const session = await productionOwnerSession(binding, proof);
  if (!session) return json({ error: "La solicitud de acceso venció." }, 403);

  const lifetime = session.expiresAt - Math.floor(Date.now() / 1000);
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", previewCookie(adminCookie, proof, lifetime));
  headers.append("Set-Cookie", previewCookie(loginCookie, binding, lifetime));
  return new Response(null, { status: 204, headers });
}
