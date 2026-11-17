import { isReportDue } from "./report-schedule";

describe("isReportDue", () => {
  const monday = new Date("2026-11-09T01:00:00Z");

  it("is due on a new week when the last report went out the week before", () => {
    expect(isReportDue("WEEKLY", new Date("2026-11-03T01:00:00Z"), monday)).toBe(true);
  });

  it("is not due twice in the same week", () => {
    expect(isReportDue("WEEKLY", new Date("2026-11-09T00:30:00Z"), new Date("2026-11-12T10:00:00Z"))).toBe(false);
  });

  it("is not due the moment reports are switched on mid-week", () => {
    expect(isReportDue("WEEKLY", new Date("2026-11-11T10:00:00Z"), new Date("2026-11-11T11:00:00Z"))).toBe(false);
  });

  it("monthly is due on the 1st after the previous month", () => {
    expect(isReportDue("MONTHLY", new Date("2026-10-15T00:00:00Z"), new Date("2026-11-01T02:00:00Z"))).toBe(true);
    expect(isReportDue("MONTHLY", new Date("2026-11-01T01:00:00Z"), new Date("2026-11-20T02:00:00Z"))).toBe(false);
  });
});
