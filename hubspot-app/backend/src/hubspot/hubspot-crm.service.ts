import { Injectable, Logger } from "@nestjs/common";
import { Brand, BrandStatus, HubSpotMatch, NewContactPolicy, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { buildNameFilters, buildNoteBody, isAnonymousReviewer, parseReviewerName } from "./contact-matching";
import { HubSpotApiClient, HubSpotApiError, HubSpotNotInstalledError } from "./hubspot-api.client";

/** Our contact properties, created in each business's HubSpot on install. */
export const PROPERTY_GROUP = "google_reviews";
export const SOURCE_PROPERTY = "google_review_source";
export const SOURCE_VALUE = "google_review";
export const DUPLICATE_PROPERTY = "google_review_possible_duplicate";

/** HubSpot-defined association type: note -> contact. */
const NOTE_TO_CONTACT = 202;
/** Per business per run. Keeps one large backlog from starving everyone else;
 *  the rest is picked up on the next run. */
const BATCH_SIZE = 100;

const REVIEW_FOR_CRM = {
  include: { location: true, reply: true },
} satisfies Prisma.ReviewDefaultArgs;
type ReviewForCrm = Prisma.ReviewGetPayload<typeof REVIEW_FOR_CRM>;

export interface CrmSyncSummary {
  synced: number;
  contactsCreated: number;
  flaggedDuplicates: number;
  skipped: number;
  failed: number;
}

/**
 * Saves every Google review under a HubSpot contact, as a note on that contact.
 *
 * Rules (from the plan):
 * - one clear name match -> attach to that contact
 * - no match -> create a contact labelled "Google Review" and attach
 * - more than one possible match -> do not guess: create a new contact and flag
 *   it as a possible duplicate so the business can merge it
 * - never change or delete a contact the business already had - we only add
 *   notes to existing contacts.
 *
 * Notes work on every HubSpot plan (custom objects need Enterprise), which is
 * why a review is stored as a note rather than a custom record.
 */
@Injectable()
export class HubSpotCrmService {
  private readonly logger = new Logger(HubSpotCrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hubspot: HubSpotApiClient,
  ) {}

  /** Creates our property group and contact properties. Safe to re-run. */
  async ensureProperties(brandId: string): Promise<void> {
    await this.createIgnoringConflict(brandId, "/crm/v3/properties/contacts/groups", {
      name: PROPERTY_GROUP,
      label: "Google reviews",
      displayOrder: -1,
    });
    await this.createIgnoringConflict(brandId, "/crm/v3/properties/contacts", {
      name: SOURCE_PROPERTY,
      label: "Created from",
      description: "Set on contacts the review app created for a Google reviewer.",
      groupName: PROPERTY_GROUP,
      type: "enumeration",
      fieldType: "select",
      formField: false,
      options: [{ label: "Google Review", value: SOURCE_VALUE, displayOrder: 0 }],
    });
    await this.createIgnoringConflict(brandId, "/crm/v3/properties/contacts", {
      name: DUPLICATE_PROPERTY,
      label: "Possible duplicate (Google review)",
      description:
        "Ticked when more than one existing contact could be this reviewer. Merge it with the right contact, then untick.",
      groupName: PROPERTY_GROUP,
      type: "enumeration",
      fieldType: "booleancheckbox",
      formField: false,
      options: [
        { label: "Yes", value: "true", displayOrder: 0 },
        { label: "No", value: "false", displayOrder: 1 },
      ],
    });
    await this.prisma.brand.update({ where: { id: brandId }, data: { hubspotPropertiesReadyAt: new Date() } });
  }

  /** Writes every changed review of every installed business to HubSpot. */
  async syncAll(): Promise<CrmSyncSummary> {
    const total = emptySummary();
    const brands = await this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE, crmSyncEnabled: true, hubspotInstallation: { status: "INSTALLED" } },
    });
    for (const brand of brands) {
      try {
        const s = await this.syncBrand(brand);
        for (const key of Object.keys(total) as (keyof CrmSyncSummary)[]) total[key] += s[key];
      } catch (error) {
        this.logger.error(`CRM sync failed for business ${brand.id}: ${errorMessage(error)}`);
      }
    }
    return total;
  }

  async syncBrand(brand: Brand): Promise<CrmSyncSummary> {
    const summary = emptySummary();
    if (!brand.hubspotPropertiesReadyAt) {
      await this.ensureProperties(brand.id);
    }

    const dirty = await this.prisma.review.findMany({
      where: { hubspotDirty: true, location: { brandId: brand.id } },
      ...REVIEW_FOR_CRM,
      orderBy: { reviewedAt: "asc" },
      take: BATCH_SIZE,
    });

    for (const review of dirty) {
      try {
        const outcome = await this.syncReview(brand, review);
        if (outcome === HubSpotMatch.SKIPPED) summary.skipped++;
        else summary.synced++;
        if (outcome === HubSpotMatch.CREATED) summary.contactsCreated++;
        if (outcome === HubSpotMatch.CREATED_AMBIGUOUS) {
          summary.contactsCreated++;
          summary.flaggedDuplicates++;
        }
      } catch (error) {
        if (error instanceof HubSpotNotInstalledError) throw error;
        summary.failed++;
        await this.prisma.review.update({
          where: { id: review.id },
          data: { hubspotSyncError: errorMessage(error).slice(0, 500) },
        });
        this.logger.warn(`Review ${review.id} not saved to HubSpot: ${errorMessage(error)}`);
      }
    }
    if (dirty.length) {
      this.logger.log(
        `HubSpot (${brand.name}): ${summary.synced} saved, ${summary.contactsCreated} contacts created, ` +
          `${summary.flaggedDuplicates} flagged, ${summary.skipped} skipped, ${summary.failed} failed.`,
      );
    }
    return summary;
  }

  /** Ties one review to a contact (finding or creating it) and writes its note. */
  async syncReview(brand: Brand, review: ReviewForCrm): Promise<HubSpotMatch> {
    let contactId = review.hubspotContactId;
    let match = review.hubspotMatch;

    if (!contactId) {
      const resolved = await this.resolveContact(brand, review);
      if (!resolved) {
        await this.prisma.review.update({
          where: { id: review.id },
          data: { hubspotMatch: HubSpotMatch.SKIPPED, hubspotDirty: false, hubspotSyncedAt: new Date(), hubspotSyncError: null },
        });
        return HubSpotMatch.SKIPPED;
      }
      ({ contactId, match } = resolved);
      // Saved straight away so a later failure writing the note can never lead
      // to a second contact being created for the same review on retry.
      await this.prisma.review.update({ where: { id: review.id }, data: { hubspotContactId: contactId, hubspotMatch: match } });
    }

    const noteId = await this.writeNote(brand, review, contactId);
    await this.prisma.review.update({
      where: { id: review.id },
      data: { hubspotNoteId: noteId, hubspotDirty: false, hubspotSyncedAt: new Date(), hubspotSyncError: null },
    });
    return match ?? HubSpotMatch.EXISTING;
  }

  private async resolveContact(
    brand: Brand,
    review: ReviewForCrm,
  ): Promise<{ contactId: string; match: HubSpotMatch } | null> {
    const name = parseReviewerName(review.reviewerName);
    if (!name || isAnonymousReviewer(review.reviewerName)) return null;

    // Same reviewer name already tied to a contact for this business (a repeat
    // reviewer, or a contact we created earlier) - reuse it, so we never pile
    // up duplicates of our own making.
    const earlier = await this.prisma.review.findFirst({
      where: {
        id: { not: review.id },
        reviewerName: review.reviewerName,
        hubspotContactId: { not: null },
        location: { brandId: brand.id },
      },
      orderBy: { hubspotSyncedAt: "asc" },
      select: { hubspotContactId: true, hubspotMatch: true },
    });
    if (earlier?.hubspotContactId) {
      return { contactId: earlier.hubspotContactId, match: earlier.hubspotMatch ?? HubSpotMatch.EXISTING };
    }

    const result = await this.hubspot.request<{ total: number; results: { id: string }[] }>(
      brand.id,
      "POST",
      "/crm/v3/objects/contacts/search",
      { filterGroups: [{ filters: buildNameFilters(name) }], properties: ["firstname", "lastname"], limit: 2 },
    );

    if (result.total === 1 && result.results[0]) {
      return { contactId: result.results[0].id, match: HubSpotMatch.EXISTING };
    }

    if (brand.newContactPolicy === NewContactPolicy.COMMENTERS_ONLY && !review.reviewText.trim()) {
      return null;
    }

    const ambiguous = result.total > 1;
    const created = await this.hubspot.request<{ id: string }>(brand.id, "POST", "/crm/v3/objects/contacts", {
      properties: {
        firstname: name.first,
        ...(name.last ? { lastname: name.last } : {}),
        [SOURCE_PROPERTY]: SOURCE_VALUE,
        ...(ambiguous ? { [DUPLICATE_PROPERTY]: "true" } : {}),
      },
    });
    return { contactId: created.id, match: ambiguous ? HubSpotMatch.CREATED_AMBIGUOUS : HubSpotMatch.CREATED };
  }

  /** Creates the review's note, or updates it in place when it already exists. */
  private async writeNote(brand: Brand, review: ReviewForCrm, contactId: string): Promise<string> {
    const properties = {
      hs_timestamp: review.reviewedAt.toISOString(),
      hs_note_body: buildNoteBody({
        businessName: brand.name,
        locationName: review.location.name,
        mapsUri: review.location.mapsUri,
        reviewerName: review.reviewerName,
        rating: review.rating,
        reviewText: review.reviewText,
        reviewedAt: review.reviewedAt,
        removed: review.removedAt !== null,
        reply: review.reply
          ? {
              text: review.reply.finalReply?.trim() || review.reply.aiDraft,
              status: review.reply.status,
              postedAt: review.reply.postedAt,
              autoPostAt: review.reply.autoPostAt,
            }
          : null,
      }),
    };

    if (review.hubspotNoteId) {
      try {
        await this.hubspot.request(brand.id, "PATCH", `/crm/v3/objects/notes/${review.hubspotNoteId}`, { properties });
        return review.hubspotNoteId;
      } catch (error) {
        // The business deleted the note in HubSpot - write a fresh one.
        if (!(error instanceof HubSpotApiError && error.status === 404)) throw error;
      }
    }

    try {
      const note = await this.hubspot.request<{ id: string }>(brand.id, "POST", "/crm/v3/objects/notes", {
        properties,
        associations: [
          { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_TO_CONTACT }] },
        ],
      });
      return note.id;
    } catch (error) {
      // The contact was deleted (or merged away) in HubSpot. Forget it so the
      // next run matches the reviewer again from scratch.
      if (error instanceof HubSpotApiError && isMissingObject(error)) {
        await this.prisma.review.update({
          where: { id: review.id },
          data: { hubspotContactId: null, hubspotMatch: null, hubspotNoteId: null },
        });
      }
      throw error;
    }
  }

  private async createIgnoringConflict(brandId: string, path: string, body: unknown): Promise<void> {
    try {
      await this.hubspot.request(brandId, "POST", path, body);
    } catch (error) {
      if (error instanceof HubSpotApiError && error.status === 409) return;
      throw error;
    }
  }
}

/** A 404, or a 400 whose message says the associated contact does not exist.
 *  Any other 400 is a real error and must NOT reset the contact (that would
 *  create a duplicate on the next run). */
function isMissingObject(error: HubSpotApiError): boolean {
  return error.status === 404 || (error.status === 400 && /not (be )?found|does not exist/i.test(error.message));
}

function emptySummary(): CrmSyncSummary {
  return { synced: 0, contactsCreated: 0, flaggedDuplicates: 0, skipped: 0, failed: 0 };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
