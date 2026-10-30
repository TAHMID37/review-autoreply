/**
 * Pure helpers for tying a Google reviewer to a HubSpot contact. Google only
 * ever gives us a display name (never an email or phone), so matching is by
 * name - and kept deliberately strict: when in doubt we create a new, flagged
 * contact rather than attach a review to the wrong person.
 */

export interface ParsedName {
  first: string;
  /** Null for single-word names like "Sarah". */
  last: string | null;
  /** True for "Sarah M." style names, where Google shows only an initial. */
  lastIsInitial: boolean;
}

export interface SearchFilter {
  propertyName: string;
  operator: "EQ" | "CONTAINS_TOKEN" | "NOT_HAS_PROPERTY";
  value?: string;
}

/** Display names Google uses when the reviewer is hidden. Never matched. */
const ANONYMOUS_NAMES = new Set(["", "anonymous", "a google user", "google user"]);

export function isAnonymousReviewer(displayName: string): boolean {
  return ANONYMOUS_NAMES.has(normaliseSpaces(displayName).toLowerCase());
}

export function parseReviewerName(displayName: string): ParsedName | null {
  const clean = normaliseSpaces(displayName);
  if (isAnonymousReviewer(clean)) return null;

  const parts = clean.split(" ");
  const first = parts[0];
  if (parts.length === 1) {
    return { first, last: null, lastIsInitial: false };
  }
  const last = parts.slice(1).join(" ");
  return { first, last, lastIsInitial: /^\p{L}\.?$/u.test(last) };
}

/**
 * HubSpot search filters (ANDed together) for contacts that could be this
 * reviewer. String EQ in HubSpot search is case-insensitive.
 */
export function buildNameFilters(name: ParsedName): SearchFilter[] {
  const filters: SearchFilter[] = [{ propertyName: "firstname", operator: "EQ", value: name.first }];
  if (!name.last) {
    filters.push({ propertyName: "lastname", operator: "NOT_HAS_PROPERTY" });
  } else if (name.lastIsInitial) {
    filters.push({ propertyName: "lastname", operator: "CONTAINS_TOKEN", value: `${name.last.charAt(0)}*` });
  } else {
    filters.push({ propertyName: "lastname", operator: "EQ", value: name.last });
  }
  return filters;
}

export interface NoteContent {
  businessName: string;
  locationName: string;
  mapsUri?: string | null;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewedAt: Date;
  removed: boolean;
  reply?: {
    text: string;
    status: string;
    postedAt?: Date | null;
    autoPostAt?: Date | null;
  } | null;
}

const REPLY_STATUS_LABEL: Record<string, string> = {
  GENERATED: "Scheduled to post",
  PENDING_APPROVAL: "Waiting for approval",
  APPROVED: "Approved, posting shortly",
  POSTED: "Posted on Google",
  FAILED: "Posting failed - retry from the dashboard",
  REJECTED: "Not replying",
};

/** The HTML body of the HubSpot note that represents one Google review. */
export function buildNoteBody(c: NoteContent): string {
  const stars = "★".repeat(c.rating) + "☆".repeat(Math.max(0, 5 - c.rating));
  const lines: string[] = [
    `<p><strong>Google review ${stars} (${c.rating}/5)</strong></p>`,
    `<p>${esc(c.reviewerName)} reviewed <strong>${esc(c.locationName)}</strong> on ${formatDate(c.reviewedAt)}.</p>`,
    c.reviewText.trim() ? `<blockquote>${esc(c.reviewText).replace(/\n/g, "<br>")}</blockquote>` : `<p><em>No written comment.</em></p>`,
  ];

  if (c.reply) {
    const label = REPLY_STATUS_LABEL[c.reply.status] ?? c.reply.status;
    const when =
      c.reply.status === "POSTED" && c.reply.postedAt
        ? ` on ${formatDate(c.reply.postedAt)}`
        : c.reply.status === "GENERATED" && c.reply.autoPostAt
          ? ` for ${formatDate(c.reply.autoPostAt)}`
          : "";
    lines.push(`<p><strong>Reply from ${esc(c.businessName)}</strong> - ${label}${when}</p>`);
    if (c.reply.status !== "REJECTED") {
      lines.push(`<blockquote>${esc(c.reply.text).replace(/\n/g, "<br>")}</blockquote>`);
    }
  } else {
    lines.push(`<p><strong>Reply:</strong> not drafted yet</p>`);
  }

  if (c.removed) {
    lines.push(`<p><em>This review is no longer shown on Google.</em></p>`);
  }
  if (c.mapsUri) {
    lines.push(`<p><a href="${esc(c.mapsUri)}">View on Google</a></p>`);
  }
  return lines.join("\n");
}

function normaliseSpaces(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
