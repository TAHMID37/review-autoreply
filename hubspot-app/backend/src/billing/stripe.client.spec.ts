import { createHmac } from "node:crypto";
import { encodeForm, verifyStripeSignature } from "./stripe.client";

describe("encodeForm", () => {
  it("encodes nested objects and arrays the way Stripe expects", () => {
    expect(
      decodeURIComponent(
        encodeForm({ mode: "subscription", line_items: [{ price: "price_1", quantity: 3 }], metadata: { brandId: "b1" } }),
      ),
    ).toBe("mode=subscription&line_items[0][price]=price_1&line_items[0][quantity]=3&metadata[brandId]=b1");
  });

  it("skips undefined values", () => {
    expect(encodeForm({ a: undefined, b: 1 })).toBe("b=1");
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const sig = createHmac("sha256", secret).update(`${now}.${payload}`).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sig}`, secret, now)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    expect(verifyStripeSignature('{"id":"evt_2"}', `t=${now},v1=${sig}`, secret, now)).toBe(false);
  });

  it("rejects an old timestamp", () => {
    expect(verifyStripeSignature(payload, `t=${now},v1=${sig}`, secret, now + 600)).toBe(false);
  });
});
