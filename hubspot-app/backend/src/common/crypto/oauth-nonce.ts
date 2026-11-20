import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

/**
 * Ties an OAuth round trip to the browser that started it.
 *
 * The signed `state` proves WE issued the link, but not WHO it was issued to,
 * so an attacker could start a flow, then trick a victim into finishing it
 * (signing the victim in to the attacker's business, or attaching the
 * victim's Google account to it). A random nonce held in an httpOnly cookie
 * and echoed inside the state closes that: only the browser that started the
 * flow has the cookie.
 */
const COOKIE = "ra_oauth_nonce";
const MAX_AGE_MS = 30 * 60 * 1000;

export function startNonce(res: Response, secure: boolean): string {
  const nonce = randomBytes(24).toString("base64url");
  res.cookie(COOKIE, nonce, { httpOnly: true, sameSite: "lax", secure, maxAge: MAX_AGE_MS, path: "/" });
  return nonce;
}

/** True only if the browser's cookie matches the nonce carried in the state. */
export function nonceMatches(req: Request, nonceFromState: string | undefined): boolean {
  const cookie = readCookie(req.headers.cookie, COOKIE);
  if (!cookie || !nonceFromState) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(nonceFromState);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearNonce(res: Response, secure: boolean): void {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure, path: "/" });
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
