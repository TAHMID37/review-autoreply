import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Env } from "../../config/env.schema";
import { APP_ENV } from "../../config/env.token";

/** OAuth state older than this is refused, so a leaked consent link goes stale. */
const MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Signs and verifies the `state` value carried through an OAuth redirect.
 *
 * OAuth callbacks are public by necessity (the browser arrives without a
 * session), so anything we need to know on return - which business is
 * connecting Google, for example - travels in this HMAC-signed blob and is
 * verified before anything is stored.
 */
@Injectable()
export class SignedStateService {
  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  sign(purpose: string, data: Record<string, string>): string {
    const payload = Buffer.from(JSON.stringify({ p: purpose, d: data, t: Date.now() })).toString("base64url");
    return `${payload}.${this.hmac(payload)}`;
  }

  verify(purpose: string, state: string): Record<string, string> {
    const [payload, sig] = (state || "").split(".");
    if (!payload || !sig) {
      throw new BadRequestException("Malformed state");
    }
    const a = Buffer.from(sig);
    const b = Buffer.from(this.hmac(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("State signature check failed");
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      p: string;
      d: Record<string, string>;
      t: number;
    };
    if (parsed.p !== purpose) {
      throw new BadRequestException("State was issued for a different flow");
    }
    if (Date.now() - parsed.t > MAX_AGE_MS) {
      throw new BadRequestException("This link has expired. Please start again.");
    }
    return parsed.d;
  }

  private hmac(input: string): string {
    return createHmac("sha256", this.env.TOKEN_ENCRYPTION_KEY).update(input).digest("base64url");
  }
}
