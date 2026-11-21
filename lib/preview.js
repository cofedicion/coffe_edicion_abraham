import { vercelPreviewOrigin, vercelProductionOrigin } from "./vercel-tokens.js";

export const storefrontBackend = "https://filter-coffee.leisurelykite3.chatgpt.site";
export const bridgeKey = () => process.env.FILTER_COFFEE_BRIDGE_KEY;
export const loginCookie = "__Host-filtercoffee-login";
export const adminCookie = "__Host-filtercoffee-admin";

export function deploymentOrigin(request) {
  const { origin, host } = new URL(request.url);
  if (process.env.VERCEL_ENV === "production") return origin === vercelProductionOrigin ? origin : null;
  return process.env.VERCEL_ENV === "preview" && host === process.env.VERCEL_URL && vercelPreviewOrigin.test(origin)
    ? origin : null;
}

export function cookieValue(request, name) {
  const prefix = `${name}=`;
  return request.headers.get("Cookie")?.split(/;\s*/).find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
}

export function previewCookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export function json(body, status) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
