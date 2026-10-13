import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.LAVALINK_STREAM_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Set LAVALINK_STREAM_SECRET or NEXTAUTH_SECRET to sign radio streams.");
  return value;
}

export function createStreamToken(encoded) {
  const payload = Buffer.from(JSON.stringify({ encoded, expires: Date.now() + 86400000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyStreamToken(token) {
  if (typeof token !== "string" || token.length > 16000) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret()).update(parts[0]).digest();
  const actual = Buffer.from(parts[1], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return typeof data.encoded === "string" && data.encoded.length > 0 && Number.isFinite(data.expires) && data.expires > Date.now() ? data.encoded : null;
  } catch {
    return null;
  }
}
