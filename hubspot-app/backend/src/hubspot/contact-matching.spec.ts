import { buildNameFilters, buildNoteBody, isAnonymousReviewer, parseReviewerName } from "./contact-matching";

describe("parseReviewerName", () => {
  it("splits a full name into first and last", () => {
    expect(parseReviewerName("Sarah  Jane Smith")).toEqual({ first: "Sarah", last: "Jane Smith", lastIsInitial: false });
  });

  it("recognises Google's initial-only surnames", () => {
    expect(parseReviewerName("Sarah M.")).toEqual({ first: "Sarah", last: "M.", lastIsInitial: true });
    expect(parseReviewerName("Tom K")).toEqual({ first: "Tom", last: "K", lastIsInitial: true });
  });

  it("handles a single-word name", () => {
    expect(parseReviewerName("Priya")).toEqual({ first: "Priya", last: null, lastIsInitial: false });
  });

  it("never matches anonymous reviewers", () => {
    expect(parseReviewerName("A Google User")).toBeNull();
    expect(parseReviewerName("  ")).toBeNull();
    expect(isAnonymousReviewer("Anonymous")).toBe(true);
  });
});

describe("buildNameFilters", () => {
  it("matches first and last name exactly", () => {
    expect(buildNameFilters({ first: "Sarah", last: "Smith", lastIsInitial: false })).toEqual([
      { propertyName: "firstname", operator: "EQ", value: "Sarah" },
      { propertyName: "lastname", operator: "EQ", value: "Smith" },
    ]);
  });

  it("uses a wildcard for an initial", () => {
    expect(buildNameFilters({ first: "Sarah", last: "M.", lastIsInitial: true })[1]).toEqual({
      propertyName: "lastname",
      operator: "CONTAINS_TOKEN",
      value: "M*",
    });
  });

  it("requires no last name for a single-word reviewer", () => {
    expect(buildNameFilters({ first: "Priya", last: null, lastIsInitial: false })[1]).toEqual({
      propertyName: "lastname",
      operator: "NOT_HAS_PROPERTY",
    });
  });
});

describe("buildNoteBody", () => {
  const base = {
    businessName: "Acme Dental",
    locationName: "Acme Dental - Richmond",
    mapsUri: "https://maps.google.com/?cid=1",
    reviewerName: "Sarah <b>M.</b>",
    rating: 4,
    reviewText: "Great service",
    reviewedAt: new Date("2026-10-01T00:00:00Z"),
    removed: false,
  };

  it("shows stars, comment, reply status and the Google link", () => {
    const html = buildNoteBody({ ...base, reply: { text: "Thanks!", status: "POSTED", postedAt: new Date("2026-10-02T00:00:00Z") } });
    expect(html).toContain("★★★★☆ (4/5)");
    expect(html).toContain("Great service");
    expect(html).toContain("Posted on Google on 2 Oct 2026");
    expect(html).toContain('href="https://maps.google.com/?cid=1"');
  });

  it("escapes reviewer-supplied text", () => {
    expect(buildNoteBody({ ...base, reply: null })).toContain("Sarah &lt;b&gt;M.&lt;/b&gt;");
  });

  it("labels replies waiting for a person", () => {
    expect(buildNoteBody({ ...base, reply: { text: "Draft", status: "PENDING_APPROVAL" } })).toContain("Waiting for approval");
  });
});
