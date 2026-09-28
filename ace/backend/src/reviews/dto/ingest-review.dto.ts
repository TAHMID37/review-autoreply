import { Platform } from "@prisma/client";

/**
 * A review as it arrives from a platform connector, before it is stored.
 * Platform-agnostic on purpose: the Google connector maps its API response
 * into this shape, and a future Facebook/Yelp connector does the same, so
 * the ingestion logic never needs to know which platform it came from.
 */
export interface IngestReviewDto {
  platform: Platform;
  locationId: string;
  externalReviewId: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewedAt: Date;
}
