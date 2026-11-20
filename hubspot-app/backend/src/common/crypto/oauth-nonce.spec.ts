import type { Request, Response } from "express";
import { clearNonce, nonceMatches, startNonce } from "./oauth-nonce";

const req = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

describe("oauth nonce", () => {
  it("sets an httpOnly cookie and returns the same nonce for the state", () => {
    const cookie = jest.fn();
    const nonce = startNonce({ cookie } as unknown as Response, true);
    expect(nonce.length).toBeGreaterThanOrEqual(30);
    expect(cookie).toHaveBeenCalledWith("ra_oauth_nonce", nonce, expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }));
  });

  it("matches only when the browser's cookie equals the nonce in the state", () => {
    expect(nonceMatches(req("a=1; ra_oauth_nonce=abc123; b=2"), "abc123")).toBe(true);
    expect(nonceMatches(req("ra_oauth_nonce=abc123"), "other")).toBe(false);
  });

  it("refuses when the cookie or the nonce is missing (the cross-browser attack)", () => {
    expect(nonceMatches(req(undefined), "abc123")).toBe(false);
    expect(nonceMatches(req("ra_oauth_nonce=abc123"), undefined)).toBe(false);
  });

  it("clears the cookie once used", () => {
    const clearCookie = jest.fn();
    clearNonce({ clearCookie } as unknown as Response, false);
    expect(clearCookie).toHaveBeenCalledWith("ra_oauth_nonce", expect.any(Object));
  });
});
