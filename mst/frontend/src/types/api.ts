/**
 * The shapes this dashboard expects back from the backend API.
 *
 * Deliberately defined here rather than imported from the backend: the
 * frontend should depend on the API's public contract, not on its internal
 * types or its database client. Keep in sync with the DTOs under
 * `backend/src/<module>/dto/`.
 */

export type UserRole = "ADMIN" | "STAFF";

export type ReplyStatus =
  | "GENERATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "POSTED"
  | "FAILED"
  | "REJECTED";

export type RiskLevel = "LOW" | "HIGH";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Brand {
  id: string;
  name: string;
  tone: string;
  language: string;
  forbiddenWords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Reply {
  id: string;
  aiDraft: string;
  finalReply: string | null;
  status: ReplyStatus;
  aiProvider: string;
  aiModel: string;
  approvedByUserId: string | null;
  postedAt: string | null;
}

export interface ReviewAnalysis {
  sentiment: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
}

export interface Review {
  id: string;
  platform: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  reviewedAt: string;
  status: string;
  location: {
    id: string;
    name: string;
    brand: { id: string; name: string };
  };
  reply: Reply | null;
  analysis: ReviewAnalysis | null;
}

export interface ReviewStats {
  averageRating: number;
  reviewsThisMonth: number;
  responseRate: number;
  autoRepliedCount: number;
  needsApprovalCount: number;
  totalReviews: number;
}

export interface WeeklyVolume {
  week: string;
  replied: number;
  pending: number;
}

export type PlatformAccountStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface PlatformAccountCoverage {
  brandId: string;
  brandName: string;
  locationCount: number;
}

export interface PlatformAccount {
  id: string;
  accountEmail: string;
  status: PlatformAccountStatus;
  connectedAt: string;
  /** The brands this one login actually covers, by linked campus count. */
  coverage: PlatformAccountCoverage[];
}

export interface SyncSummary {
  accountsSynced: number;
  reviewsSeen: number;
  created: number;
  updated: number;
  processed: number;
  failed: number;
}

export interface ResponseTemplate {
  id: string;
  brandId: string;
  name: string;
  body: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CommentCondition = "PRESENT" | "ABSENT" | "ANY";

export interface AutoReplyRule {
  id: string;
  brandId: string;
  name: string;
  platform: string;
  enabled: boolean;
  rank: number;
  ratings: number[];
  comment: CommentCondition;
  delayHours: number;
  templateIds: string[];
  createdAt: string;
  updatedAt: string;
}
