import { createHmac } from "node:crypto";
import { normaliseSignedUri, verifyHubSpotSignatureV3 } from "./hubspot-signature";

const secret = "test-client-secret";

function sign(method: string, uri: string, body: string, ts: string) {
  return createHmac("sha256", secret).update(`${method}${uri}${body}${ts}`).digest("base64");
}

describe("verifyHubSpotSignatureV3", () => {
  const now = 1_800_000_000_000;
  const ts = String(now - 1000);
  const uri = "https://api.example.com/hubspot/ext/summary?portalId=123&userId=9";

  it("accepts a correctly signed request", () => {
    const signature = sign("GET", uri, "", ts);
    expect(verifyHubSpotSignatureV3({ clientSecret: secret, method: "get", uri, body: "", timestamp: ts, signature, now })).toEqual({
      ok: true,
    });
  });

  it("includes the body in the signature", () => {
    const signature = sign("POST", uri, '{"a":1}', ts);
    const result = verifyHubSpotSignatureV3({ clientSecret: secret, method: "POST", uri, body: '{"a":2}', timestamp: ts, signature, now });
    expect(result.ok).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const old = String(now - 6 * 60 * 1000);
    const signature = sign("GET", uri, "", old);
    expect(verifyHubSpotSignatureV3({ clientSecret: secret, method: "GET", uri, body: "", timestamp: old, signature, now })).toEqual({
      ok: false,
      reason: "timestamp too old",
    });
  });

  it("rejects missing headers", () => {
    expect(verifyHubSpotSignatureV3({ clientSecret: secret, method: "GET", uri, body: "", timestamp: ts, signature: undefined, now }).ok).toBe(false);
  });
});

describe("normaliseSignedUri", () => {
  it("decodes the characters HubSpot decodes and leaves others", () => {
    expect(normaliseSignedUri("https://x.com/a?email=jo%40x.com&q=a%20b")).toBe("https://x.com/a?email=jo@x.com&q=a%20b");
  });
});
