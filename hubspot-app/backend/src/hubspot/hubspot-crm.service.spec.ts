import { HubSpotMatch, NewContactPolicy } from "@prisma/client";
import { HubSpotApiError } from "./hubspot-api.client";
import { DUPLICATE_PROPERTY, HubSpotCrmService, PROPERTIES_VERSION, SOURCE_PROPERTY } from "./hubspot-crm.service";

const brand: any = {
  id: "b1",
  name: "Acme",
  newContactPolicy: NewContactPolicy.ALL_REVIEWERS,
  hubspotPropertiesReadyAt: new Date(),
  hubspotPropertiesVersion: PROPERTIES_VERSION,
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

function setup(opts: { earlier?: any; searchTotal?: number; noteError?: unknown; propertyError?: unknown; latest?: any | null; count?: number } = {}) {
  const calls: { method: string; path: string; body: any }[] = [];
  const updates: any[] = [];
  const prisma: any = {
    review: {
      // "earlier review of the same reviewer" filters by id; the "latest review
      // of the contact" lookup does not.
      findFirst: jest.fn(async (args: any) =>
        args.where.id ? (opts.earlier ?? null) : opts.latest === undefined ? review({ location: { name: "Main St", mapsUri: null } }) : opts.latest,
      ),
      count: jest.fn().mockResolvedValue(opts.count ?? 1),
      update: jest.fn((args) => updates.push(args.data)),
      updateMany: jest.fn(async (args: any) => {
        updates.push({ updateMany: args });
        return { count: 0 };
      }),
    },
    brand: { update: jest.fn((args) => updates.push({ brand: args.data })) },
  };
  const api: any = {
    request: jest.fn(async (_b: string, method: string, path: string, body: any) => {
      calls.push({ method, path, body });
      if (opts.propertyError && path === "/crm/v3/properties/contacts" && body.name === "google_user_rating") throw opts.propertyError;
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
    expect(calls.filter((c) => c.path.startsWith("/crm/v3/objects/notes"))).toEqual([
      expect.objectContaining({ method: "PATCH", path: "/crm/v3/objects/notes/n1" }),
    ]);
  });

  it("writes the latest review into the contact's Google properties", async () => {
    const reviewedAt = new Date("2026-10-05T10:00:00Z");
    const latest = review({
      rating: 2,
      reviewText: " Slow service ",
      reviewedAt,
      location: { name: "Main St", mapsUri: "https://maps.example/x" },
      reply: { finalReply: null, aiDraft: "Sorry to hear that", status: "POSTED" },
    });
    const { svc, calls } = setup({ searchTotal: 1, latest, count: 3 });
    await svc.syncReview(brand, review({ id: latest.id }));
    const patch = calls.find((c) => c.method === "PATCH" && c.path === "/crm/v3/objects/contacts/c1")!;
    expect(patch.body.properties).toEqual({
      google_user_rating: "2",
      google_user_comment: "Slow service",
      google_owner_comment: "Sorry to hear that",
      google_review_date: "2026-10-05",
      google_review_location: "Main St",
      google_reply_status: "Posted on Google",
      google_review_link: "https://maps.example/x",
      google_review_count: "3",
    });
  });

  it("leaves the properties alone when an older, already-saved review changes", async () => {
    const latest = review({ id: "newer", location: { name: "Main St", mapsUri: null } });
    const { svc, calls } = setup({ latest, count: 2 });
    await svc.syncReview(
      brand,
      review({ hubspotContactId: "c1", hubspotMatch: HubSpotMatch.EXISTING, hubspotNoteId: "n1", hubspotSyncedAt: new Date() }),
    );
    expect(calls.some((c) => c.path === "/crm/v3/objects/contacts/c1")).toBe(false);
  });

  it("clears the properties when the contact has no review left", async () => {
    const { svc, calls } = setup({ latest: null, count: 0 });
    await svc.syncReview(
      brand,
      review({ hubspotContactId: "c1", hubspotMatch: HubSpotMatch.EXISTING, hubspotNoteId: "n1", removedAt: new Date() }),
    );
    const patch = calls.find((c) => c.path === "/crm/v3/objects/contacts/c1")!;
    expect(patch.body.properties).toMatchObject({ google_user_rating: "", google_review_count: "0" });
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

describe("HubSpotCrmService.ensureProperties", () => {
  it("creates every Google review property, with number and date types, then back-fills", async () => {
    const { svc, calls, updates } = setup();
    await svc.ensureProperties("b1");
    const created = calls.filter((c) => c.path === "/crm/v3/properties/contacts").map((c) => c.body);
    const byName = Object.fromEntries(created.map((p: any) => [p.name, p]));
    expect(byName.google_user_rating).toMatchObject({ type: "number", groupName: "google_reviews" });
    expect(byName.google_review_date).toMatchObject({ type: "date", fieldType: "date" });
    expect(byName.google_review_count).toMatchObject({ type: "number" });
    expect(Object.keys(byName)).toEqual(
      expect.arrayContaining([
        "google_review_source", "google_review_possible_duplicate", "google_user_rating", "google_user_comment",
        "google_owner_comment", "google_review_date", "google_review_location", "google_reply_status",
        "google_review_link", "google_review_count",
      ]),
    );
    expect(updates.some((u) => u.updateMany?.data?.hubspotDirty === true)).toBe(true);
    expect(updates.some((u) => u.brand?.hubspotPropertiesVersion === PROPERTIES_VERSION)).toBe(true);
  });

  it("records why and keeps going when HubSpot refuses to create properties (limit reached)", async () => {
    const limit = new HubSpotApiError(400, "You have reached the maximum number of custom properties");
    const { svc, updates } = setup({ propertyError: limit });
    await svc.ensureProperties("b1");
    const blocked = updates.find((u) => u.brand?.hubspotPropertiesBlockedReason);
    expect(blocked.brand.hubspotPropertiesBlockedReason).toContain("maximum number");
    expect(blocked.brand.hubspotPropertiesVersion).toBe(PROPERTIES_VERSION);
    expect(updates.some((u) => u.updateMany)).toBe(false); // no back-fill
  });

  it("does not treat a rate limit or outage as a refusal", async () => {
    const { svc } = setup({ propertyError: new HubSpotApiError(503, "down") });
    await expect(svc.ensureProperties("b1")).rejects.toThrow("down");
  });
});

describe("HubSpotCrmService with properties blocked", () => {
  const blockedBrand = { ...brand, hubspotPropertiesBlockedReason: "limit" };

  it("still writes the note but no contact properties, and omits our own on new contacts", async () => {
    const { svc, calls } = setup({ searchTotal: 0 });
    await svc.syncReview(blockedBrand, review());
    const created = calls.find((c) => c.path === "/crm/v3/objects/contacts" && c.method === "POST")!;
    expect(created.body.properties[SOURCE_PROPERTY]).toBeUndefined();
    expect(calls.some((c) => c.path === "/crm/v3/objects/notes")).toBe(true);
    expect(calls.some((c) => c.method === "PATCH" && c.path.startsWith("/crm/v3/objects/contacts/"))).toBe(false);
  });
});
