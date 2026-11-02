/**
 * Testing safety net for posting: an optional list of Google location ids that
 * replies may be posted to. Empty means no restriction (production).
 */

/** "123, locations/456" -> ["123", "456"]. */
export function parseAllowedLocationIds(raw: string): string[] {
  return raw
    .split(",")
    .map((id) => id.trim().replace(/^.*locations\//, ""))
    .filter(Boolean);
}

/**
 * Whether a stored location resource ("accounts/{a}/locations/{l}" or
 * "locations/{l}") may be posted to. Matches on the location id only.
 */
export function isLocationAllowed(externalLocationId: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const match = /locations\/([^/]+)$/.exec(externalLocationId);
  return match !== null && allowed.includes(match[1]);
}
