import { hubspot } from "@hubspot/ui-extensions";

/**
 * Our API. Must also be listed under permittedUrls.fetch in app-hsmeta.json.
 * Change both when the production domain is decided.
 */
export const API_BASE = "https://api.REPLACE-WITH-OUR-DOMAIN";

/**
 * Calls our API through hubspot.fetch, which signs the request with our
 * client secret (X-HubSpot-Signature-v3). We add the portal and user ids
 * ourselves; they are covered by the signature, so they can't be forged.
 */
export async function callApi(path, context, options = {}) {
  const params = new URLSearchParams({
    portalId: String(context.portal.id),
    userId: String(context.user.id),
    userEmail: context.user.email,
  });
  const sep = path.includes("?") ? "&" : "?";
  const response = await hubspot.fetch(`${API_BASE}${path}${sep}${params.toString()}`, {
    method: options.method ?? "GET",
    ...(options.body ? { body: options.body } : {}),
    timeout: 15000,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message ?? `Request failed (${response.status})`);
  }
  return json;
}
