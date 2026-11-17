import { ReportBucket } from "./report-periods";
import { buildReportBody, ReportEmailService } from "./report-email.service";

const bucket = (over: Partial<ReportBucket> = {}): ReportBucket => ({
  start: "2026-10-01",
  label: "Oct 2026",
  total: 10,
  averageRating: 4.5,
  ratingMix: [0, 1, 0, 3, 6],
  replied: 8,
  responseRate: 80,
  ...over,
});

describe("buildReportBody", () => {
  it("summarises the finished period against the one before", () => {
    const body = buildReportBody("Acme", "MONTHLY", bucket(), bucket({ total: 7, averageRating: 4.1 }), "https://app/reports");
    expect(body).toContain("Google reviews for Acme, Oct 2026");
    expect(body).toContain("New reviews: 10 (7 the period before)");
    expect(body).toContain("Average rating: 4.5 stars (4.1 before)");
    expect(body).toContain("5 stars: 6, 4 stars: 3, 3 stars: 0, 2 stars: 1, 1 star: 0");
    expect(body).toContain("Replied: 8 of 10 (response rate 80%)");
  });

  it("says so when there were no reviews", () => {
    expect(buildReportBody("Acme", "WEEKLY", bucket({ total: 0, averageRating: null }), undefined, "https://app/reports")).toContain(
      "No new reviews this period.",
    );
  });
});

describe("ReportEmailService.sendDueReports", () => {
  const now = new Date("2026-11-09T02:00:00Z"); // a Monday
  const brand = (over: any = {}) => ({
    id: "b1",
    name: "Acme",
    alertEmails: ["a@x.com"],
    reportFrequency: "WEEKLY",
    reportLastSentAt: new Date("2026-11-03T00:00:00Z"),
    ...over,
  });

  function setup(brands: any[], emailEnabled = true, sendError?: Error) {
    const update = jest.fn();
    const prisma: any = { brand: { findMany: jest.fn().mockResolvedValue(brands), update } };
    const reports: any = {
      getPeriodReport: jest.fn().mockResolvedValue({ buckets: [bucket(), bucket(), bucket()] }),
    };
    const email: any = { isEnabled: emailEnabled, send: jest.fn(async () => { if (sendError) throw sendError; }) };
    const env: any = { WEB_APP_URL: "https://app/", REVIEW_SYNC_ENABLED: false };
    return { svc: new ReportEmailService(prisma, reports, email, env), update, email };
  }

  it("sends a due report with the CSV attached, then records it", async () => {
    const { svc, update, email } = setup([brand()]);
    expect(await svc.sendDueReports(now)).toBe(1);
    expect(email.send.mock.calls[0][0]).toBe("a@x.com");
    expect(email.send.mock.calls[0][3][0]).toMatchObject({ filename: "review-report.csv" });
    expect(update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { reportLastSentAt: now } });
  });

  it("does not send twice in the same week", async () => {
    const { svc, email } = setup([brand({ reportLastSentAt: new Date("2026-11-09T01:00:00Z") })]);
    expect(await svc.sendDueReports(now)).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("does nothing when email is not configured", async () => {
    const { svc, email } = setup([brand()], false);
    expect(await svc.sendDueReports(now)).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("keeps it due for the next check when sending fails", async () => {
    const { svc, update } = setup([brand()], true, new Error("smtp down"));
    expect(await svc.sendDueReports(now)).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
