import stock from "./api/stock.js";
import { vercelProductionOrigin } from "./lib/vercel-tokens.js";

if (process.env.VERCEL === "1") {
  const production = process.env.VERCEL_ENV === "production";
  const configured = production
    ? process.env.BLOB_READ_WRITE_TOKEN
    : process.env.FILTER_COFFEE_BRIDGE_KEY && process.env.FILTER_COFFEE_SITES_TOKEN;
  if (!configured) {
    throw new Error("Filter Coffee requires the configured stock service credentials.");
  }

  const origin = production ? vercelProductionOrigin : `https://${process.env.VERCEL_URL}`;
  const response = await stock.fetch(new Request(`${origin}/api/stock`));
  const result = await response.json();
  if (!response.ok || result.canManage !== false || !Array.isArray(result.soldOut)) {
    throw new Error(`The read-only stock check did not pass (HTTP ${response.status}).`);
  }
  console.log("Filter Coffee stock service is reachable and rejects anonymous administrator access.");
}
