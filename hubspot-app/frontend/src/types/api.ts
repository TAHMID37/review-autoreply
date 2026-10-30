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
  brandId: string;
  email: string;
  name: string;
  role: UserRole;
}

/** GET /auth/me: the user plus the business they are signed in to. */
export interface CurrentUser extends AuthUser {
  brand: { id: string; name: string; hubspotPortalId: string | null; hubspotDomain: string | null };
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export type NewContactPolicy = "ALL_REVIEWERS" | "COMMENTERS_ONLY";

/** The signed-in business (one HubSpot account). */
export interface Brand {
  id: string;
  name: string;
  status: "ACTIVE" | "UNINSTALLED";
  hubspotPortalId: string | null;
  hubspotDomain: string | null;
  tone: string;
  language: string;
  forbiddenWords: string[];
  autoReplyEnabled: boolean;
  autoReplyConsentAt: string | null;
  autoReplyStartAt: string | null;
  alertEmails: string[];
  slackConfigured: boolean;
  crmSyncEnabled: boolean;
  newContactPolicy: NewContactPolicy;
  hubspotPropertiesReadyAt: string | null;
  createdAt: string;
}

export interface SetupStatus {
  steps: {
    hubspotConnected: boolean;
    googleConnected: boolean;
    locationsSelected: boolean;
    planChosen: boolean;
    autoReplyEnabled: boolean;
  };
  locationsFound: number;
  locationsSelected: number;
  billingEnforced: boolean;
  complete: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  googleLocationId: string | null;
  mapsUri: string | null;
  syncEnabled: boolean;
  _count?: { reviews: number };
}

export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "UNPAID" | "CANCELED" | "INCOMPLETE";

export interface BillingStatus {
  enforced: boolean;
  configured: boolean;
  status: SubscriptionStatus;
  quantity: number;
  syncedLocations: number;
  trialDays: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pastDueSince: string | null;
  graceDays: number;
  serviceActive: boolean;
}

export type WidgetLayout = "CAROUSEL" | "GRID" | "LIST" | "BADGE";

export interface WidgetTheme {
  accent?: string;
  background?: string;
  text?: string;
  radius?: number;
}

export interface Widget {
  id: string;
  publicId: string;
  name: string;
  layout: WidgetLayout;
  locationIds: string[];
  minRating: number;
  maxReviews: number;
  requireComment: boolean;
  theme: WidgetTheme | null;
  allowedDomains: string[];
  enabled: boolean;
  snippet: string;
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
  hubspotContactId: string | null;
  hubspotMatch: "EXISTING" | "CREATED" | "CREATED_AMBIGUOUS" | "SKIPPED" | null;
  hubspotSyncError: string | null;
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
  responseScope: { posted: number; total: number; sinceCutoff: boolean };
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

export interface PlatformAccount {
  id: string;
  accountEmail: string;
  status: PlatformAccountStatus;
  connectedAt: string;
  locationCount: number;
}

export interface SyncSummary {
  accountsSynced: number;
  reviewsSeen: number;
  created: number;
  updated: number;
  processed: number;
  failed: number;
  posted: number;
  savedToHubSpot: number;
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
