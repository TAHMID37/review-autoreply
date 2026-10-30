import { ReplyStatus } from "@prisma/client";
import { SentimentRiskService } from "../safety/sentiment-risk.service";
import { ReviewProcessorService } from "./review-processor.service";

function setup(selection: { draft: string | null; autoPostable?: boolean; delayHours?: number; templateName?: string; ruleName?: string }) {
  const upserts: any[] = [];
  const prisma: any = {
    reviewAnalysis: { upsert: jest.fn() },
    reply: { upsert: jest.fn((args) => upserts.push(args)) },
    review: { update: jest.fn() },
  };
  const reviews: any = { markProcessed: jest.fn(), findUnprocessed: jest.fn() };
  const autoReply: any = { selectDraft: jest.fn().mockResolvedValue(selection) };
  const notifications: any = { notifyNeedsApproval: jest.fn() };
  const svc = new ReviewProcessorService(prisma, reviews, new SentimentRiskService(), autoReply, notifications);
  return { svc, upserts, notifications, reviews };
}

function review(rating: number, reviewText: string, reply: any = null): any {
  return {
    id: "r1",
    externalReviewId: "g1",
    rating,
    reviewText,
    reviewerName: "Sam Lee",
    reply,
    location: { brandId: "b1", name: "Main St", brand: { name: "Acme" } },
  };
}

describe("ReviewProcessorService routing", () => {
  const rule = { draft: "Thanks!", autoPostable: true, delayHours: 24, templateName: "T", ruleName: "R" };

  it("schedules a safe positive review to auto-post after the rule delay", async () => {
    const { svc, upserts } = setup(rule);
    await svc.processOne(review(5, "Lovely team"));
    expect(upserts[0].create.status).toBe(ReplyStatus.GENERATED);
    expect(upserts[0].create.autoPostAt).toBeInstanceOf(Date);
  });

  it("always holds 1-2 stars with a comment, even when a rule matches", async () => {
    const { svc, upserts, notifications } = setup(rule);
    await svc.processOne(review(2, "Waited an hour"));
    expect(upserts[0].create.status).toBe(ReplyStatus.PENDING_APPROVAL);
    expect(upserts[0].create.autoPostAt).toBeNull();
    expect(upserts[0].create.aiDraft).toBe("Thanks!");
    expect(notifications.notifyNeedsApproval).toHaveBeenCalled();
  });

  it("lets 1-2 stars WITHOUT a comment auto-reply via its rule", async () => {
    const { svc, upserts } = setup({ ...rule, delayHours: 4 });
    await svc.processOne(review(1, ""));
    expect(upserts[0].create.status).toBe(ReplyStatus.GENERATED);
  });

  it("holds a 5-star review that raises a sensitive topic", async () => {
    const { svc, upserts } = setup(rule);
    await svc.processOne(review(5, "Great course but the trainer was rude"));
    expect(upserts[0].create.status).toBe(ReplyStatus.PENDING_APPROVAL);
  });

  it("holds when no rule matches", async () => {
    const { svc, upserts } = setup({ draft: null });
    await svc.processOne(review(4, "Good"));
    expect(upserts[0].create.status).toBe(ReplyStatus.PENDING_APPROVAL);
  });

  it("never re-drafts a review whose reply is already posted", async () => {
    const { svc, upserts, reviews } = setup(rule);
    await svc.processOne(review(5, "Edited text", { status: ReplyStatus.POSTED }));
    expect(upserts).toHaveLength(0);
    expect(reviews.markProcessed).toHaveBeenCalledWith("r1");
  });
});
