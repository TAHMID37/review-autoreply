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
  PORT: z.coerce.number().int().positive().default(4020),

  // Public base URL of this API (OAuth redirects, webhook targets, widget script)
  API_PUBLIC_URL: z.string().url(),

  // Where the dashboard is served from (CORS + OAuth redirect back-link)
  WEB_APP_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (postgresql://...)"),

  // Redis / BullMQ (used from build phase 6 onward)
  REDIS_HOST: z.string().min(1).default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Dashboard session (issued after "Sign in with HubSpot")
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  // Encrypts stored Google + HubSpot OAuth tokens (AES-256-GCM key)
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters (used to derive a 256-bit key)"),

  // Google Business Profile OAuth (build phase 5)
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  // HubSpot public app (developer account -> app -> Auth tab)
  HUBSPOT_CLIENT_ID: z.string().min(1),
  HUBSPOT_CLIENT_SECRET: z.string().min(1),
  /** Must exactly match a redirect URL configured on the HubSpot app. */
  HUBSPOT_OAUTH_REDIRECT_URI: z.string().url(),
  /** Space-separated. Must match the app's required scopes. */
  HUBSPOT_SCOPES: z
    .string()
    .default(
      "oauth crm.objects.contacts.read crm.objects.contacts.write crm.schemas.contacts.read crm.schemas.contacts.write",
    ),
  HUBSPOT_OPTIONAL_SCOPES: z.string().default(""),

  // Billing (Stripe). Leave STRIPE_SECRET_KEY blank in development to treat
  // every business as paid; BILLING_ENFORCED=false does the same on purpose.
  STRIPE_SECRET_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(blankToUndefined, z.string().optional()),
  /** Recurring monthly Price, billed per location (quantity = synced locations). */
  STRIPE_PRICE_ID: z.preprocess(blankToUndefined, z.string().optional()),
  STRIPE_TRIAL_DAYS: z.coerce.number().int().min(0).default(0),
  BILLING_ENFORCED: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v),
    z.boolean().default(false),
  ),
  /** Days after a failed payment before syncing and auto-replies pause. */
  BILLING_GRACE_DAYS: z.coerce.number().int().min(0).default(7),

  // Local development only: lets you sign in as the seeded demo business
  // without HubSpot. Refused when NODE_ENV=production.
  DEV_LOGIN_ENABLED: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v),
    z.boolean().default(false),
  ),

  // AI provider (optional; drafting is template-based)
  AI_PROVIDER: z.enum(["openai", "anthropic", "gemini", "mock"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Notifications. SMTP sends every business's approval emails; each business
  // sets its own recipients and Slack webhook in Settings.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /** Comma-separated fallback alert addresses, used only for a business that
   *  has not set its own alert emails in Settings. Usually left blank. */
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

  // Platform-wide master switch for writing replies back to Google. Each
  // business ALSO has to switch auto-replies on (with consent) in its own
  // Settings. Leave false in development so nothing is ever posted by accident.
  AUTO_POST_ENABLED: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v),
    z.boolean().default(false),
  ),

});

export type Env = z.infer<typeof envSchema>;
