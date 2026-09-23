import { z } from "zod";

/** dotenv turns `KEY=` into an empty string, not undefined - without this, an
 *  optional field left blank on purpose (e.g. to disable Slack alerts) would
 *  fail a `.url()`/`.number()` check instead of being treated as "not set". */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * Every setting the backend needs, in one place.
 * See docs/CREDENTIALS.md for what each one is and where to get it.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // Where the dashboard is served from (CORS + OAuth redirect back-link)
  WEB_APP_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (postgresql://...)"),

  // Redis / BullMQ (used from build phase 6 onward)
  REDIS_HOST: z.string().min(1).default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Staff login
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  // Encrypts stored Google OAuth tokens (AES-256-GCM key)
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters (used to derive a 256-bit key)"),

  // Google Business Profile OAuth (build phase 5)
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  // AI provider (build phase 7)
  AI_PROVIDER: z.enum(["openai", "anthropic", "gemini", "mock"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Notifications (build phase 11) - leave blank to disable that channel
  SLACK_WEBHOOK_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /** Comma-separated list of addresses that receive approval alerts. */
  ALERT_EMAIL_TO: z.string().optional(),

  // Monitoring (build phase 12)
  SENTRY_DSN: z.string().optional(),

  // Read-only Google review sync
  // When true, the backend polls connected Google accounts on a timer. Off by
  // default so it never runs unless explicitly enabled. Manual sync via the
  // POST /platform-accounts/sync endpoint works regardless of this flag.
  REVIEW_SYNC_ENABLED: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v),
    z.boolean().default(false),
  ),
  REVIEW_SYNC_INTERVAL_MIN: z.coerce.number().int().positive().default(15),

  // Master switch for writing replies back to Google. OFF by default so the
  // system stays draft-only until an explicit go-live. When true, the scheduler
  // auto-posts due drafts and manual approvals are posted to Google.
  AUTO_POST_ENABLED: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v),
    z.boolean().default(false),
  ),
});

export type Env = z.infer<typeof envSchema>;
