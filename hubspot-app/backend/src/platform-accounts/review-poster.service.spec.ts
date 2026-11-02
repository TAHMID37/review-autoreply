import { ForbiddenException } from "@nestjs/common";
import { ReplyStatus } from "@prisma/client";
import { Env } from "../config/env.schema";
import { ReviewPosterService } from "./review-poster.service";

const REPLY = {
  id: "reply-1",
  reviewId: "review-1",
  status: ReplyStatus.APPROVED,
  finalReply: "Thanks for the review!",
  aiDraft: "",
  review: { locationId: "loc-1", externalReviewId: "rev-9", location: { brand: { subscription: null } } },
};

function setup(env: Partial<Env>, externalLocationId = "accounts/1/locations/123") {
  const prisma = {
    reply: {
      findFirst: jest.fn().mockResolvedValue(REPLY),
      update: jest.fn((args) => ({ ...REPLY, ...args.data })),
    },
    review: { update: jest.fn() },
    platformLocation: {
      findFirst: jest.fn().mockResolvedValue({ externalLocationId, platformAccount: { id: "acct-1" } }),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const accounts = { getValidAccessToken: jest.fn().mockResolvedValue("token") };
  const writer = { updateReply: jest.fn().mockResolvedValue({ comment: "ok" }) };
  const billing = { isServiceActive: jest.fn().mockReturnValue(true) };
  const fullEnv = { AUTO_POST_ENABLED: true, POST_DRY_RUN: false, POST_ALLOWED_LOCATION_IDS: "", ...env } as Env;
  const poster = new ReviewPosterService(prisma as never, accounts as never, writer as never, billing as never, fullEnv);
  return { poster, prisma, writer };
}

describe("ReviewPosterService.postReply safety", () => {
  it("refuses to post while AUTO_POST_ENABLED is off", async () => {
    const { poster, writer } = setup({ AUTO_POST_ENABLED: false });
    await expect(poster.postReply("brand-1", "reply-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(writer.updateReply).not.toHaveBeenCalled();
  });

  it("refuses a location outside POST_ALLOWED_LOCATION_IDS without touching the reply", async () => {
    const { poster, writer, prisma } = setup({ POST_ALLOWED_LOCATION_IDS: "999" });
    await expect(poster.postReply("brand-1", "reply-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(writer.updateReply).not.toHaveBeenCalled();
    expect(prisma.reply.update).not.toHaveBeenCalled();
  });

  it("in dry run, never calls Google and marks the reply as a dry run", async () => {
    const { poster, writer, prisma } = setup({ POST_DRY_RUN: true });
    const result = await poster.postReply("brand-1", "reply-1");
    expect(writer.updateReply).not.toHaveBeenCalled();
    expect(prisma.reply.update).toHaveBeenCalledWith({
      where: { id: "reply-1" },
      data: { status: ReplyStatus.FAILED, failureReason: "Dry run: not posted to Google." },
    });
    expect(result.status).toBe(ReplyStatus.FAILED);
  });

  it("posts to an allowed location when live", async () => {
    const { poster, writer } = setup({ POST_ALLOWED_LOCATION_IDS: "123" });
    await poster.postReply("brand-1", "reply-1");
    expect(writer.updateReply).toHaveBeenCalledWith("token", "accounts/1/locations/123/reviews/rev-9", "Thanks for the review!");
  });
});
