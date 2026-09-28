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

  async findById(id: string): Promise<Reply> {
    const reply = await this.prisma.reply.findUnique({ where: { id } });
    if (!reply) {
      throw new NotFoundException(`Reply ${id} not found`);
    }
    return reply;
  }

  /** Staff edited the AI's draft. The original `aiDraft` is never overwritten,
   *  so it stays available for comparing what the AI wrote against what a
   *  person actually sent. */
  async edit(id: string, finalReply: string): Promise<Reply> {
    const reply = await this.assertEditable(id);
    return this.prisma.reply.update({
      where: { id: reply.id },
      data: { finalReply },
    });
  }

  /** Staff approved the reply. Posting to the platform happens separately, so
   *  a posting failure can be retried without losing the approval. */
  async approve(id: string, approvedByUserId: string, finalReply?: string): Promise<Reply> {
    const reply = await this.assertEditable(id);
    return this.prisma.reply.update({
      where: { id: reply.id },
      data: {
        status: ReplyStatus.APPROVED,
        approvedByUserId,
        finalReply: finalReply ?? reply.finalReply ?? reply.aiDraft,
      },
    });
  }

  async reject(id: string, rejectedByUserId: string): Promise<Reply> {
    const reply = await this.assertEditable(id);
    return this.prisma.reply.update({
      where: { id: reply.id },
      data: { status: ReplyStatus.REJECTED, approvedByUserId: rejectedByUserId },
    });
  }

  /** The text that should actually be published — a staff edit if there was
   *  one, otherwise the AI's draft. */
  resolveText(reply: Reply): string {
    return reply.finalReply?.trim() || reply.aiDraft;
  }

  private async assertEditable(id: string): Promise<Reply> {
    const reply = await this.findById(id);
    if (!EDITABLE_STATUSES.includes(reply.status)) {
      throw new BadRequestException(
        `Reply ${id} is ${reply.status} and can no longer be changed.`,
      );
    }
    return reply;
  }
}
