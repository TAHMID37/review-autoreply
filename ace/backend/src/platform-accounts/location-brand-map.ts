import { APP_BRAND } from "../config/app-brand";

/**
 * The connected Google login (support@ibusinessformula.com.au) is an AGENCY
 * account: it manages many businesses, most of which are unrelated iBF clients
 * (gyms, solar shops, transport, etc.). This deployment is for ONE brand only,
 * so we import only that brand's campuses and never anything else — including
 * the other RTO, which has its own dashboard, its own domain and its own
 * database.
 *
 * Campuses are identified by the RTO code in the Google listing title
 * (see APP_BRAND.rtoPattern).
 */

/**
 * Returns this deployment's brand name if the Google location is one of its
 * campuses, or null if it is not (in which case it must be skipped, not
 * imported).
 */
export function resolveBrandName(locationTitle: string): string | null {
  return APP_BRAND.rtoPattern.test(locationTitle) ? APP_BRAND.name : null;
}
