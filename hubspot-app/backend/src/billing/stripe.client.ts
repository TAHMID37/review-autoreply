import { Inject, Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

const API_BASE = "https://api.stripe.com/v1";
/** Stripe's own default tolerance for webhook timestamps. */
const WEBHOOK_TOLERANCE_SEC = 300;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Billing is not set up on this server (STRIPE_SECRET_KEY is blank).");
  }
}

/**
 * A thin Stripe REST client (form-encoded requests, plain fetch), matching how
 * the rest of the backend calls Google and HubSpot without vendor SDKs.
 */
@Injectable()
export class StripeClient {
  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  get configured(): boolean {
    return Boolean(this.env.STRIPE_SECRET_KEY && this.env.STRIPE_PRICE_ID);
  }

  async request<T>(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();
    const encoded = params ? encodeForm(params) : "";
    const url = method === "GET" && encoded ? `${API_BASE}${path}?${encoded}` : `${API_BASE}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
        ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: method !== "GET" && encoded ? encoded : undefined,
    });
    const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`Stripe ${method} ${path} failed (${response.status}): ${json.error?.message ?? "unknown error"}`);
    }
    return json;
  }

  /** Verifies the Stripe-Signature header and returns the parsed event. */
  constructEvent(rawBody: Buffer, signatureHeader: string | undefined): StripeEvent {
    if (!this.env.STRIPE_WEBHOOK_SECRET) throw new StripeNotConfiguredError();
    if (!verifyStripeSignature(rawBody.toString("utf8"), signatureHeader, this.env.STRIPE_WEBHOOK_SECRET)) {
      throw new Error("Stripe webhook signature check failed");
    }
    return JSON.parse(rawBody.toString("utf8")) as StripeEvent;
  }
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export function verifyStripeSignature(
  payload: string,
  header: string | undefined,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || signatures.length === 0 || Math.abs(nowSec - Number(t)) > WEBHOOK_TOLERANCE_SEC) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex"));
  return signatures.some((sig) => {
    const given = Buffer.from(sig ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Stripe's bracket form encoding: { a: { b: [ { c: 1 } ] } } -> a[b][0][c]=1. */
export function encodeForm(params: Record<string, unknown>, prefix = ""): string {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) out.push(encodeForm(item as Record<string, unknown>, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      out.push(encodeForm(value as Record<string, unknown>, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out.filter(Boolean).join("&");
}
