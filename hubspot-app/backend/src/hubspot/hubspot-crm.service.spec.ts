import { HubSpotMatch, NewContactPolicy } from "@prisma/client";
import { HubSpotApiError } from "./hubspot-api.client";
import { DUPLICATE_PROPERTY, HubSpotCrmService, SOURCE_PROPERTY } from "./hubspot-crm.service";

const brand: any = {
  id: "b1",
  name: "Acme",
  newContactPolicy: NewContactPolicy.ALL_REVIEWERS,
  hubspotPropertiesReadyAt: new Date(),
};

function review(overrides: any = {}): any {
  return {
    id: "r1",
    reviewerName: "Sarah Smith",
    rating: 5,
    reviewText: "Great",
    reviewedAt: new Date("2026-10-01T00:00:00Z"),
    removedAt: null,
    hubspotContactId: null,
    hubspotMatch: null,
    hubspotNoteId: null,
    location: { name: "Main St", mapsUri: null },
    reply: null,
    ...overrides,
  };
}

function setup(opts: { earlier?: any; searchTotal?: number; noteError?: unknown } = {}) {
  const calls: { method: string; path: string; body: any }[] = [];
  const updates: any[] = [];
  const prisma: any = {
    review: {
      findFirst: jest.fn().mockResolvedValue(opts.earlier ?? null),
      update: jest.fn((args) => updates.push(args.data)),
    },
  };
  const api: any = {
    request: jest.fn(async (_b: string, method: string, path: string, body: any) => {
      calls.push({ method, path, body });
      if (path.endsWith("/search")) {
        const total = opts.searchTotal ?? 0;
        return { total, results: Array.from({ length: Math.min(total, 2) }, (_, i) => ({ id: `c${i + 1}` })) };
      }
      if (path === "/crm/v3/objects/contacts") return { id: "new-contact" };
      if (path === "/crm/v3/objects/notes") {
        if (opts.noteError) throw opts.noteError;
        return { id: "note-1" };
      }
      return {};
    }),
  };
  return { svc: new HubSpotCrmService(prisma, api), calls, updates };
}

describe("HubSpotCrmService.syncReview", () => {
  it("attaches to the one contact that matches", async () => {
    const { svc, calls } = setup({ searchTotal: 1 });
    expect(await svc.syncReview(brand, review())).toBe(HubSpotMatch.EXISTING);
    expect(calls.find((c) => c.path === "/crm/v3/objects/contacts")).toBeUndefined();
    const note = calls.find((c) => c.path === "/crm/v3/objects/notes")!;
    expect(note.body.associations[0].to.id).toBe("c1");
    expect(note.body.associations[0].types[0].associationTypeId).toBe(202);
  });

  it("creates a labelled contact when nobody matches", async () => {
    const { svc, calls } = setup({ searchTotal: 0 });
    expect(await svc.syncReview(brand, review())).toBe(HubSpotMatch.CREATED);
    const created = calls.find((c) => c.path === "/crm/v3/objects/contacts")!;
    expect(created.body.properties).toEqual({ firstname: "Sarah", lastname: "Smith", [SOURCE_PROPERTY]: "google_review" });
  });

  it("does not guess between several matches: creates a new contact flagged as a possible duplicate", async () => {
    const { svc, calls } = setup({ searchTotal: 3 });
    expect(await svc.syncReview(brand, review())).toBe(HubSpotMatch.CREATED_AMBIGUOUS);
    const created = calls.find((c) => c.path === "/crm/v3/objects/contacts")!;
    expect(created.body.properties[DUPLICATE_PROPERTY]).toBe("true");
  });

  it("reuses the contact already tied to the same reviewer, without searching", async () => {
    const { svc, calls } = setup({ earlier: { hubspotContactId: "c9", hubspotMatch: HubSpotMatch.CREATED } });
    await svc.syncReview(brand, review());
    expect(calls.some((c) => c.path.endsWith("/search"))).toBe(false);
    expect(calls.find((c) => c.path === "/crm/v3/objects/notes")!.body.associations[0].to.id).toBe("c9");
  });

  it("never creates contacts for anonymous reviewers", async () => {
    const { svc, calls, updates } = setup();
    expect(await svc.syncReview(brand, review({ reviewerName: "A Google User" }))).toBe(HubSpotMatch.SKIPPED);
    expect(calls).toHaveLength(0);
    expect(updates[0]).toMatchObject({ hubspotMatch: HubSpotMatch.SKIPPED, hubspotDirty: false });
  });

  it("respects 'commenters only' for star-only reviews", async () => {
    const { svc, calls } = setup({ searchTotal: 0 });
    const only = { ...brand, newContactPolicy: NewContactPolicy.COMMENTERS_ONLY };
    expect(await svc.syncReview(only, review({ reviewText: "" }))).toBe(HubSpotMatch.SKIPPED);
    expect(calls.find((c) => c.path === "/crm/v3/objects/contacts")).toBeUndefined();
  });

  it("updates the existing note in place instead of adding another", async () => {
    const { svc, calls } = setup();
    await svc.syncReview(brand, review({ hubspotContactId: "c1", hubspotMatch: HubSpotMatch.EXISTING, hubspotNoteId: "n1" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "PATCH", path: "/crm/v3/objects/notes/n1" });
  });

  it("saves the contact before writing the note, so a note failure can't create a second contact", async () => {
    const { svc, updates } = setup({ searchTotal: 0, noteError: new HubSpotApiError(500, "boom") });
    await expect(svc.syncReview(brand, review())).rejects.toThrow("boom");
    expect(updates[0]).toEqual({ hubspotContactId: "new-contact", hubspotMatch: HubSpotMatch.CREATED });
  });

  it("forgets a contact that was deleted in HubSpot, so it is matched again next run", async () => {
    const { svc, updates } = setup({ noteError: new HubSpotApiError(404, "not found") });
    await expect(svc.syncReview(brand, review({ hubspotContactId: "gone", hubspotMatch: HubSpotMatch.EXISTING }))).rejects.toThrow();
    expect(updates.at(-1)).toEqual({ hubspotContactId: null, hubspotMatch: null, hubspotNoteId: null });
  });
});
