/** HubSpot's id for the "app uninstalled" lifecycle event. */
export const UNINSTALL_EVENT_TYPE_ID = "4-1916193";

export interface UninstallEvent {
  /** Journal position, used to resume reading and to never process one twice. */
  offset: string | null;
  portalId: string;
  occurredAt: Date | null;
}

type Loose = Record<string, unknown>;

/**
 * Pulls the uninstall events out of one journal batch. The batch response is
 * read leniently (entries may carry their events in `journalEvents`, or be the
 * event themselves) because HubSpot's docs show no uninstall example. Anything
 * that is not clearly an uninstall with an account id is skipped.
 */
export function extractUninstalls(batch: unknown): { events: UninstallEvent[]; lastOffset: string | null } {
  const results = Array.isArray((batch as Loose | null)?.results) ? ((batch as Loose).results as Loose[]) : [];
  const events: UninstallEvent[] = [];
  let lastOffset: string | null = null;

  for (const entry of results) {
    const entryOffset = typeof entry.offset === "string" ? entry.offset : null;
    if (entryOffset) lastOffset = entryOffset;
    const inner = Array.isArray(entry.journalEvents) ? (entry.journalEvents as Loose[]) : [entry];
    for (const e of inner) {
      const label = [e.action, e.eventTypeId, e.type].map((v) => String(v ?? "")).join(" ");
      if (!/APP_UNINSTALL|4-1916193|uninstall/i.test(label)) continue;
      const portal = e.portalId ?? e.hubId ?? e.accountId;
      if (portal == null) continue;
      const when = typeof e.occurredAt === "string" ? new Date(e.occurredAt) : null;
      events.push({
        offset: entryOffset ?? (typeof e.offset === "string" ? e.offset : null),
        portalId: String(portal),
        occurredAt: when && !Number.isNaN(when.getTime()) ? when : null,
      });
    }
  }
  return { events, lastOffset };
}
