import ownerPublicKey from "./owner-public-key.js";
import { productionOwnerChallenge, verifyPreviewToken, verifyProductionOwnerSession, vercelProductionOrigin } from "./vercel-tokens.js";
import { adminCookie, bridgeKey, cookieValue, loginCookie } from "./preview.js";

export async function productionOwnerSession(binding, proof) {
  if (!binding || !proof) return null;
  const session = await verifyProductionOwnerSession(proof, ownerPublicKey);
  return session && session.challenge === await productionOwnerChallenge(binding) ? session : null;
}

export async function isOwner(request, origin) {
  const proof = cookieValue(request, adminCookie);
  if (origin === vercelProductionOrigin) {
    return Boolean(await productionOwnerSession(cookieValue(request, loginCookie), proof));
  }
  const session = await verifyPreviewToken(proof, bridgeKey(), "session");
  return session?.origin === origin;
}
