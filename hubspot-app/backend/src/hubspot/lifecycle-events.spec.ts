import { extractUninstalls } from "./lifecycle-events";

describe("extractUninstalls", () => {
  it("reads the file HubSpot really sent for an uninstall", () => {
    const { events } = extractUninstalls({
      results: [
        {
          offset: "01a20777-4c59-7a28-9d8c-d74699862a2a",
          journalEvents: [
            {
              type: "appLifecycleEvent",
              portalId: 50261975,
              occurredAt: "2026-11-23T08:13:02.968Z",
              appId: 59758472,
              eventTypeId: "4-1916193",
              action: "APP_UNINSTALL",
              properties: { hs_app_id: "59758472" },
            },
          ],
          publishedAt: "2026-11-23T08:13:08.569Z",
        },
      ],
    });
    expect(events).toEqual([
      { offset: "01a20777-4c59-7a28-9d8c-d74699862a2a", portalId: "50261975", occurredAt: new Date("2026-11-23T08:13:02.968Z") },
    ]);
  });

  it("reads uninstall events nested in a journal entry", () => {
    const { events, lastOffset } = extractUninstalls({
      results: [
        {
          offset: "o1",
          journalEvents: [
            { type: "app_lifecycle_event", action: "APP_UNINSTALL", portalId: 123, occurredAt: "2026-11-23T08:00:00.000Z" },
            { type: "app_lifecycle_event", action: "APP_INSTALL", portalId: 456 },
          ],
        },
      ],
    });
    expect(lastOffset).toBe("o1");
    expect(events).toEqual([{ offset: "o1", portalId: "123", occurredAt: new Date("2026-11-23T08:00:00.000Z") }]);
  });

  it("reads flat entries and matches by event type id", () => {
    const { events } = extractUninstalls({ results: [{ offset: "o2", eventTypeId: "4-1916193", portalId: "789" }] });
    expect(events).toEqual([{ offset: "o2", portalId: "789", occurredAt: null }]);
  });

  it("ignores installs, events without an account and empty batches", () => {
    expect(extractUninstalls({ results: [{ offset: "o3", action: "APP_INSTALL", portalId: 1 }] }).events).toEqual([]);
    expect(extractUninstalls({ results: [{ offset: "o4", action: "APP_UNINSTALL" }] }).events).toEqual([]);
    expect(extractUninstalls({ results: [] })).toEqual({ events: [], lastOffset: null });
    expect(extractUninstalls(null)).toEqual({ events: [], lastOffset: null });
  });
});
