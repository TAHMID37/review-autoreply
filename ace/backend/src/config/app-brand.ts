/**
 * This deployment serves ONE brand. ACE Training and MultiSkills Training each
 * run their own copy of this app, on their own domain and their own database,
 * so a single constant is all it takes to tell them apart.
 *
 * Everything brand-specific reads from here: which Google campuses are imported
 * (`rtoPattern`), which Brand row the seeds create, and which brand the API is
 * allowed to serve.
 *
 * The MultiSkills copy of this file lives at ../../../mst/backend/src/config/app-brand.ts.
 */
export const APP_BRAND = {
  /** Short code, used in logs and env comments. */
  key: "ACE",
  /** Must match the `name` of the Brand row in this deployment's database. */
  name: "ACE Training",
  /** Shown in the dashboard sidebar and browser tab title. */
  displayName: "ACE Training",
  /** RTO code that identifies this brand's campuses in a Google listing title. */
  rtoPattern: /RTO\s*21716/i,
  /** Seeded onto the Brand row; editable afterwards from Settings. */
  tone: "Professional, friendly, and educational. Warm thank-yous for happy students; calm, concise responses to concerns.",
} as const;
