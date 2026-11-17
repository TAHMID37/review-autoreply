/**
 * The product's own name, shown on the login screen and in the browser tab.
 * Each business's own name comes from the API (the signed-in user's brand).
 *
 * Chosen name. It must not include "HubSpot"
 * or "Google" (Marketplace rule). Keep in step with hubspot-project/src/app/app-hsmeta.json.
 */
export const APP_BRAND = {
  displayName: "ReviewPilot by iBuz",
} as const;
