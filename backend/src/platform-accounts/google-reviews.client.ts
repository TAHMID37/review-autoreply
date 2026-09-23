import { Injectable, Logger } from "@nestjs/common";

/**
 * Read-only client for the Google Business Profile APIs. It only ever performs
 * GET requests: listing accounts, listing locations, and reading reviews. There
 * is deliberately no method that writes, replies to, or deletes anything, so
 * this client cannot post to Google.
 */

const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

export interface GoogleAccount {
  /** e.g. "accounts/1234567890". */
  name: string;
  accountName?: string;
}

export interface GoogleLocation {
  /** e.g. "locations/987654321". */
  name: string;
  title?: string;
}

export interface GoogleReview {
  externalReviewId: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewedAt: Date;
}

export interface ListReviewsResult {
  /** Unanswered reviews, mapped for ingestion. */
  reviews: GoogleReview[];
  /** Every review id Google currently serves for the location (answered too). */
  allExternalIds: string[];
}

const STAR_WORD_TO_NUMBER: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

@Injectable()
export class GoogleReviewsClient {
  private readonly logger = new Logger(GoogleReviewsClient.name);

  /** All accounts the connected login can manage. */
  async listAccounts(accessToken: string): Promise<GoogleAccount[]> {
    return this.paged<GoogleAccount>(ACCOUNTS_URL, accessToken, "accounts");
  }

  /** All locations under an account. `accountName` is "accounts/{id}". */
  async listLocations(accessToken: string, accountName: string): Promise<GoogleLocation[]> {
    const readMask = "name,title";
    const url = `${INFO_BASE}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}`;
    return this.paged<GoogleLocation>(url, accessToken, "locations");
  }

  /**
   * All reviews for a location, mapped to our ingestion shape. `accountName` is
   * "accounts/{id}", `locationName` is "locations/{id}" (only the numeric id is
   * used, since the v4 reviews endpoint nests it under the account).
   */
  async listReviews(accessToken: string, accountName: string, locationName: string): Promise<ListReviewsResult> {
    const locationId = locationName.replace(/^locations\//, "");
    const url = `${REVIEWS_BASE}/${accountName}/locations/${locationId}/reviews`;
    const raw = await this.paged<RawReview>(url, accessToken, "reviews");

    // Every review id Google currently serves for this location (answered or
    // not). Sync uses this to detect reviews it removed since we last saw them.
    const allExternalIds = raw
      .map((r) => r.reviewId || r.name)
      .filter((id): id is string => Boolean(id));

    // Only surface reviews we have NOT already answered. A review that already
    // carries an owner `reviewReply` on Google was handled elsewhere (Birdeye),
    // so we must never ingest or re-draft it - that would risk replying twice.
    const unanswered = raw.filter((r) => !hasOwnerReply(r));
    const skipped = raw.length - unanswered.length;
    if (skipped > 0) {
      this.logger.log(`${locationName}: skipped ${skipped} review(s) already replied to on Google.`);
    }

    return {
      reviews: unanswered.map(mapReview).filter((r): r is GoogleReview => r !== null),
      allExternalIds,
    };
  }

  /** GETs every page of a list endpoint, following pageToken. Read-only. */
  private async paged<T>(baseUrl: string, accessToken: string, field: string): Promise<T[]> {
    const out: T[] = [];
    let pageToken: string | undefined;
    do {
      const sep = baseUrl.includes("?") ? "&" : "?";
      const url = pageToken ? `${baseUrl}${sep}pageToken=${encodeURIComponent(pageToken)}` : baseUrl;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Google GET ${baseUrl} failed (${response.status}): ${detail.slice(0, 300)}`);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const items = (json[field] as T[] | undefined) ?? [];
      out.push(...items);
      pageToken = json["nextPageToken"] as string | undefined;
    } while (pageToken);

    return out;
  }
}

interface RawReview {
  reviewId?: string;
  name?: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  /** Present only when the business has already replied to this review. */
  reviewReply?: { comment?: string; updateTime?: string };
}

/** True when the business owner has already posted a reply to this review. */
export function hasOwnerReply(raw: RawReview): boolean {
  const reply = raw.reviewReply;
  return !!reply && ((reply.comment ?? "").trim().length > 0 || !!reply.updateTime);
}

/** Maps a Google v4 review to our shape, or null if it has no usable id/rating. */
export function mapReview(raw: RawReview): GoogleReview | null {
  const rating = raw.starRating ? STAR_WORD_TO_NUMBER[raw.starRating] : undefined;
  const externalReviewId = raw.reviewId || raw.name;
  if (!externalReviewId || !rating) {
    return null;
  }
  return {
    externalReviewId,
    reviewerName: raw.reviewer?.displayName?.trim() || "Anonymous",
    rating,
    reviewText: (raw.comment ?? "").trim(),
    reviewedAt: raw.createTime ? new Date(raw.createTime) : new Date(),
  };
}
