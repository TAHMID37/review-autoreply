import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Reply, ReplyStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";

/** Statuses a reply can still be edited or approved from. Once POSTED it is
 *  public on Google and this system no longer owns the text. */
const EDITABLE_STATUSES: ReplyStatus[] = [
  ReplyStatus.GENERATED,
  ReplyStatus.PENDING_APPROVAL,
  ReplyStatus.APPROVED,
  ReplyStatus.FAILED,
];

@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** A reply of the given business, or 404 - another business's id looks
   *  exactly like one that does not exist. */
  async findById(brandId: string, id: string): Promise<Reply> {
    const reply = await this.prisma.reply.findFirst({ where: { id, review: { location: { brandId } } } });
    if (!reply) {
      throw new NotFoundException(`Reply ${id} not found`);
    }
    return reply;
  }

  /** Staff edited the draft. The original `aiDraft` is never overwritten. */
  async edit(brandId: string, id: string, finalReply: string): Promise<Reply> {
    const reply = await this.assertEditable(brandId, id);
    return this.updateAndMarkDirty(reply, { finalReply });
  }

  /** Staff approved the reply. Posting happens separately, so a posting
   *  failure can be retried without losing the approval. */
  async approve(brandId: string, id: string, approvedByUserId: string, finalReply?: string): Promise<Reply> {
    const reply = await this.assertEditable(brandId, id);
    return this.updateAndMarkDirty(reply, {
      status: ReplyStatus.APPROVED,
      approvedByUserId,
      finalReply: finalReply ?? reply.finalReply ?? reply.aiDraft,
    });
  }

  async reject(brandId: string, id: string, rejectedByUserId: string): Promise<Reply> {
    const reply = await this.assertEditable(brandId, id);
    return this.updateAndMarkDirty(reply, { status: ReplyStatus.REJECTED, approvedByUserId: rejectedByUserId });
  }

  /** The text that should actually be published. */
  resolveText(reply: Reply): string {
    return reply.finalReply?.trim() || reply.aiDraft;
  }

  /** Every reply change is reflected on the review's HubSpot note. */
  private async updateAndMarkDirty(reply: Reply, data: Partial<Reply>): Promise<Reply> {
    const [updated] = await this.prisma.$transaction([
      this.prisma.reply.update({ where: { id: reply.id }, data }),
      this.prisma.review.update({ where: { id: reply.reviewId }, data: { hubspotDirty: true } }),
    ]);
    return updated;
  }

  private async assertEditable(brandId: string, id: string): Promise<Reply> {
    const reply = await this.findById(brandId, id);
    if (!EDITABLE_STATUSES.includes(reply.status)) {
      throw new BadRequestException(`Reply ${id} is ${reply.status} and can no longer be changed.`);
    }
    return reply;
  }
}
