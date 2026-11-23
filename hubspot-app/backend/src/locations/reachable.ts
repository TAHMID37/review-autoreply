import { PlatformAccountStatus, Prisma } from "@prisma/client";

/**
 * A location only counts while a connected Google login can reach it: no Google,
 * no locations. Spread into any `location` query that is shown, synced or billed.
 */
export const REACHABLE_LOCATION = {
  platformLocations: { some: { platformAccount: { status: { not: PlatformAccountStatus.DISCONNECTED } } } },
} satisfies Prisma.LocationWhereInput;
