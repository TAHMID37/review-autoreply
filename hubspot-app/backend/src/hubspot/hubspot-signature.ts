import { createHmac, timingSafeEqual } from "node:crypto";

/** HubSpot refuses to sign requests older than this, and so do we. */
export const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

/**
 * Characters HubSpot decodes in the URI before signing (v3 request validation).
 * Everything else stays percent-encoded.
 */
const DECODE: Record<string, string> = {
  "%3A": ":",
  "%2F": "/",
  "%3F": "?",
  "%40": "@",
  "%21": "!",
  "%24": "$",
  "%27": "'",
  "%28": "(",
  "%29": ")",
  "%2A": "*",
  "%2C": ",",
  "%3B": ";",
};

export function normaliseSignedUri(uri: string): string {
  return uri.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, (m) => DECODE[m.toUpperCase()] ?? m);
}

/**
 * Verifies HubSpot's X-HubSpot-Signature-v3 header, sent with every
 * `hubspot.fetch()` from our app cards and with webhooks:
 * base64(HMAC-SHA256(clientSecret, method + uri + body + timestamp)).
 */
export function verifyHubSpotSignatureV3(input: {
  clientSecret: string;
  method: string;
  uri: string;
  body: string;
  timestamp: string | undefined;
  signature: string | undefined;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.signature || !input.timestamp) {
    return { ok: false, reason: "missing signature headers" };
  }
  const ts = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SIGNATURE_AGE_MS) {
    return { ok: false, reason: "timestamp too old" };
  }
  const source = `${input.method.toUpperCase()}${normaliseSignedUri(input.uri)}${input.body}${input.timestamp}`;
  const expected = createHmac("sha256", input.clientSecret).update(source, "utf8").digest("base64");
  const a = Buffer.from(input.signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}
