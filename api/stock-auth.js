import { productionOwnerChallenge, signPreviewToken, verifyPreviewToken, vercelProductionOrigin } from "../lib/vercel-tokens.js";
import { adminCookie, bridgeKey, cookieValue, deploymentOrigin, json, loginCookie, previewCookie, storefrontBackend } from "../lib/preview.js";

const loginLifetime = 600;
const adminLifetime = 3600;

function redirect(destination, ...cookies) {
  const headers = new Headers({ Location: destination, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 303, headers });
}

export async function GET(request) {
  const origin = deploymentOrigin(request);
  if (!origin) return json({ error: "Abre la tienda desde su enlace oficial." }, 403);

  if (origin === vercelProductionOrigin) {
    const binding = crypto.randomUUID();
    const approval = new URL("/admin/vercel-produccion", storefrontBackend);
    approval.searchParams.set("challenge", await productionOwnerChallenge(binding));
    return redirect(approval.href, previewCookie(loginCookie, binding, loginLifetime));
  }

  const key = bridgeKey();
  if (!key) return json({ error: "El acceso de administrador no está disponible." }, 503);

  const code = new URL(request.url).searchParams.get("code");
  if (code !== null) {
    const claims = await verifyPreviewToken(code, key, "code");
    const nonce = cookieValue(request, loginCookie);
    if (!nonce || claims?.origin !== origin || claims.nonce !== nonce) {
      const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8", "Set-Cookie": previewCookie(loginCookie, "", 0) });
      return new Response('<p>La solicitud de acceso venció.</p><a href="/admin">Volver a Administración</a>', { status: 400, headers });
    }
    const session = await signPreviewToken(key, "session", origin, crypto.randomUUID(), adminLifetime);
    return redirect(`${origin}/site.html#productos`, previewCookie(adminCookie, session, adminLifetime), previewCookie(loginCookie, "", 0));
  }

  const nonce = crypto.randomUUID();
  const state = await signPreviewToken(key, "login", origin, nonce, loginLifetime);
  const approval = new URL("/admin/vercel", storefrontBackend);
  approval.searchParams.set("state", state);
  return redirect(approval.href, previewCookie(loginCookie, nonce, loginLifetime));
}
