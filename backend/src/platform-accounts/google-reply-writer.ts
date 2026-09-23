import { Injectable, Logger } from "@nestjs/common";

/**
 * The ONLY component in the codebase that writes to Google. It performs a single
 * PUT to the My Business v4 review-reply endpoint, posting a reply as the
 * connected business owner on the review's own location.
 *
 * Kept deliberately separate from the read-only GoogleReviewsClient so the read
 * path can never post by accident. Nothing here lists, edits or deletes.
 */
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

export interface PostedReply {
  comment: string;
  updateTime?: string;
}

@Injectable()
export class GoogleReplyWriter {
  private readonly logger = new Logger(GoogleReplyWriter.name);

  /**
   * Posts (or updates) the owner reply on a review. `reviewResource` is the full
   * `accounts/{id}/locations/{id}/reviews/{id}` path. Google attributes the
   * reply to the business owner and shows it on that location automatically.
   */
  async updateReply(accessToken: string, reviewResource: string, comment: string): Promise<PostedReply> {
    const url = `${REVIEWS_BASE}/${reviewResource}/reply`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Google reply PUT failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await response.json().catch(() => ({}))) as PostedReply;
    return { comment: json.comment ?? comment, updateTime: json.updateTime };
  }
}
