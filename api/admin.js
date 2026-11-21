import { readFile } from "node:fs/promises";
import path from "node:path";
import { deploymentOrigin, json } from "../lib/preview.js";
import { isOwner } from "../lib/owner-session.js";

export async function GET(request) {
  const origin = deploymentOrigin(request);
  if (!origin) return json({ error: "Abre la tienda desde su enlace oficial." }, 403);

  if (!(await isOwner(request, origin))) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/api/stock-auth", "Cache-Control": "no-store" },
    });
  }

  const page = await readFile(path.join(process.cwd(), "admin", "index.html"), "utf8");
  return new Response(page, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
