/**
 * Cleans what a business types into "Allowed websites": strips protocol, path,
 * port and case, so "https://www.Example.com/reviews" is stored as
 * "www.example.com". Returns null for something that is not a hostname.
 */
export function normaliseDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z]+:\/\//, "").split("/")[0].split("?")[0].split(":")[0];
  const wildcard = value.startsWith("*.");
  const host = wildcard ? value.slice(2) : value;
  if (!/^(localhost|([a-z0-9-]+\.)+[a-z]{2,})$/.test(host)) return null;
  return wildcard ? `*.${host}` : host;
}

/**
 * Whether a page on `origin` may load the widget.
 * - "example.com" allows example.com and www.example.com
 * - "*.example.com" allows example.com and any subdomain
 */
export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((entry) => {
    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === entry || host === `www.${entry}` || `www.${host}` === entry;
  });
}
