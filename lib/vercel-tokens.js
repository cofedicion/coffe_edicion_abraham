const vercelPreviewOrigin = /^https:\/\/coffe-edicion-abraham-[a-z0-9]+-cofedicion\.vercel\.app$/;
const vercelProductionOrigin = "https://coffe-edicion-abraham.vercel.app";
const encoder = new TextEncoder();

function encodeTokenPart(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeTokenPart(part) {
  return Uint8Array.from(atob(part.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
}

function previewSigningKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signPreviewToken(secret, type, origin, nonce, expiresIn) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = encodeTokenPart(encoder.encode(JSON.stringify({ type, origin, nonce, expiresAt })));
  const signature = await crypto.subtle.sign("HMAC", await previewSigningKey(secret), encoder.encode(payload));
  return `${payload}.${encodeTokenPart(signature)}`;
}

async function verifyPreviewToken(token, secret, type) {
  if (!secret || !token || token.length > 1800 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;

  try {
    const [payload, signature] = token.split(".");
    const verified = await crypto.subtle.verify("HMAC", await previewSigningKey(secret), decodeTokenPart(signature), encoder.encode(payload));
    if (!verified) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeTokenPart(payload)));
    if (claims.type !== type || typeof claims.origin !== "string" ||
        (claims.origin !== vercelProductionOrigin && !vercelPreviewOrigin.test(claims.origin)) ||
        typeof claims.nonce !== "string" || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= Date.now() / 1000) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

async function productionOwnerChallenge(binding) {
  return encodeTokenPart(await crypto.subtle.digest("SHA-256", encoder.encode(binding)));
}

async function signProductionOwnerSession(privateKey, challenge) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = encodeTokenPart(encoder.encode(JSON.stringify({ origin: vercelProductionOrigin, challenge, expiresAt })));
  const signingKey = await crypto.subtle.importKey("jwk", privateKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, encoder.encode(payload));
  return `${payload}.${encodeTokenPart(signature)}`;
}

async function verifyProductionOwnerSession(token, publicKey) {
  if (!token || token.length > 1800 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  try {
    const [payload, signature] = token.split(".");
    const key = await crypto.subtle.importKey("jwk", publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, decodeTokenPart(signature), encoder.encode(payload));
    if (!verified) return null;

    const claims = JSON.parse(new TextDecoder().decode(decodeTokenPart(payload)));
    return claims.origin === vercelProductionOrigin && typeof claims.challenge === "string" &&
      Number.isSafeInteger(claims.expiresAt) && claims.expiresAt > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}


export { productionOwnerChallenge, signPreviewToken, verifyPreviewToken, verifyProductionOwnerSession, vercelPreviewOrigin, vercelProductionOrigin };
