import { Inject, Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Env } from "../config/env.schema";
import { APP_ENV } from "../config/env.token";

/**
 * The only place in the codebase that encrypts or decrypts stored Google OAuth
 * tokens. Everything else reads and writes the opaque ciphertext string.
 *
 * AES-256-GCM. The 256-bit key is derived from TOKEN_ENCRYPTION_KEY with
 * SHA-256, so the env value can be any string of sufficient length. Losing that
 * key makes every stored token unreadable (by design).
 *
 * Stored format: "v1.<ivB64>.<tagB64>.<cipherB64>".
 */
@Injectable()
export class TokenVaultService {
  private readonly key: Buffer;

  constructor(@Inject(APP_ENV) env: Env) {
    this.key = createHash("sha256").update(env.TOKEN_ENCRYPTION_KEY).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") {
      throw new Error("Malformed encrypted token payload");
    }
    const [, ivB64, tagB64, ctB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  }
}
