import { BrandStatus } from "@prisma/client";
import type { Env } from "../config/env.schema";
import { RetentionService } from "./retention.service";

const DAY = 24 * 60 * 60 * 1000;

function setup(days = 30) {
  const prisma = {
    brand: { findMany: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: "u1" }]) },
    loginCode: { deleteMany: jest.fn().mockResolvedValue({}) },
    jobRunLog: { deleteMany: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const service = new RetentionService(prisma as never, { RETENTION_DAYS: days, RETENTION_ENABLED: true } as Env);
  return { prisma, service };
}

describe("RetentionService", () => {
  const now = new Date("2026-12-31T00:00:00Z");

  it("only looks at UNINSTALLED businesses uninstalled at least RETENTION_DAYS ago", async () => {
    const { prisma, service } = setup(30);
    prisma.brand.findMany.mockResolvedValue([]);
    await service.purgeExpired(now);
    const where = prisma.brand.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(BrandStatus.UNINSTALLED);
    expect(where.uninstalledAt.not).toBeNull();
    expect(where.uninstalledAt.lte).toEqual(new Date(now.getTime() - 30 * DAY));
  });

  it("deletes the business, its login codes and job logs, and reports how many", async () => {
    const { prisma, service } = setup();
    prisma.brand.findMany.mockResolvedValue([{ id: "b1", hubspotPortalId: "123" }]);
    expect(await service.purgeExpired(now)).toBe(1);
    expect(prisma.brand.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
    expect(prisma.loginCode.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: ["u1"] } } });
    expect(prisma.jobRunLog.deleteMany).toHaveBeenCalledWith({ where: { brandId: "b1" } });
  });

  it("deletes nothing when nobody is due", async () => {
    const { prisma, service } = setup();
    prisma.brand.findMany.mockResolvedValue([]);
    expect(await service.purgeExpired(now)).toBe(0);
    expect(prisma.brand.delete).not.toHaveBeenCalled();
  });
});
