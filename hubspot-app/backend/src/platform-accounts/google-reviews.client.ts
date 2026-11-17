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
  metadata?: { mapsUri?: string; newReviewUri?: string };
  storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
}

export interface GoogleReview {
  externalReviewId: string;
  reviewerName: string;
  reviewerPhotoUrl: string | null;
  rating: number;
  reviewText: string;
  reviewedAt: Date;
}

export interface ListReviewsResult {
  /** Every review, answered or not, mapped for ingestion. Answered ones are
   *  stored too (they appear in HubSpot and the website widget), and their
   *  existing owner reply is recorded so they are never replied to again. */
  reviews: GoogleReview[];
  /** Every review id Google currently serves for the location (answered too). */
  allExternalIds: string[];
  /** Reviews that already carry an owner reply on Google, with that reply. */
  answered: GoogleOwnerReply[];
  /** Google's own average and total for the location. They include ratings
   *  left without text, which the reviews list does not. Null if not returned. */
  summary: GoogleRatingSummary | null;
}

export interface GoogleRatingSummary {
  averageRating: number;
  totalReviewCount: number;
}

export interface GoogleOwnerReply {
  externalReviewId: string;
  comment: string;
  repliedAt: Date;
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
    const readMask = "name,title,metadata,storefrontAddress";
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
    let summary: GoogleRatingSummary | null = null;
    const raw = await this.paged<RawReview>(url, accessToken, "reviews", (page) => {
      summary = parseRatingSummary(page) ?? summary;
    });

    // Every review id Google currently serves for this location (answered or
    // not). Sync uses this to detect reviews it removed since we last saw them.
    const allExternalIds = raw
      .map((r) => r.reviewId || r.name)
      .filter((id): id is string => Boolean(id));

    // Reviews that already carry an owner reply on Google. Sync records that
    // reply against the stored review straight after storing it, so it is
    // never drafted or posted a second time.
    const answered = raw
      .filter(hasOwnerReply)
      .map((r) => ({
        externalReviewId: r.reviewId || r.name || "",
        comment: (r.reviewReply?.comment ?? "").trim(),
        repliedAt: r.reviewReply?.updateTime ? new Date(r.reviewReply.updateTime) : new Date(),
      }))
      .filter((a) => a.externalReviewId);

    return {
      reviews: raw.map(mapReview).filter((r): r is GoogleReview => r !== null),
      allExternalIds,
      answered,
      summary,
    };
  }

  /** GETs every page of a list endpoint, following pageToken. Read-only. */
  private async paged<T>(
    baseUrl: string,
    accessToken: string,
    field: string,
    onPage?: (page: Record<string, unknown>) => void,
  ): Promise<T[]> {
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
      onPage?.(json);
      const items = (json[field] as T[] | undefined) ?? [];
      out.push(...items);
      pageToken = json["nextPageToken"] as string | undefined;
    } while (pageToken);

    return out;
  }
}

/** Google puts `averageRating` and `totalReviewCount` on every page of the reviews list. */
export function parseRatingSummary(page: Record<string, unknown>): GoogleRatingSummary | null {
  const averageRating = Number(page["averageRating"]);
  const totalReviewCount = Number(page["totalReviewCount"]);
  if (!Number.isFinite(averageRating) || !Number.isFinite(totalReviewCount) || totalReviewCount <= 0) return null;
  return { averageRating, totalReviewCount };
}

interface RawReview {
  reviewId?: string;
  name?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
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
    reviewerName: raw.reviewer?.isAnonymous ? "Anonymous" : raw.reviewer?.displayName?.trim() || "Anonymous",
    reviewerPhotoUrl: raw.reviewer?.profilePhotoUrl || null,
    rating,
    reviewText: (raw.comment ?? "").trim(),
    reviewedAt: raw.createTime ? new Date(raw.createTime) : new Date(),
  };
}
