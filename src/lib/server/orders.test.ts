import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("./prisma", () => ({
  prisma: { order: { findMany } },
}));

import {
  getUserOrders,
  isSupportedOrderStatus,
  ORDER_STATUS_LABELS,
} from "./orders";

describe("server orders service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it("reads only the authenticated owner's public order fields in stable reverse chronology", async () => {
    const createdAt = new Date("2026-10-12T10:00:00.000Z");
    findMany.mockResolvedValueOnce([
      {
        id: "order-a",
        status: "PAID",
        totalCents: 3980,
        createdAt,
      },
    ]);

    await expect(getUserOrders("user-a")).resolves.toEqual([
      {
        id: "order-a",
        status: "PAID",
        totalCents: 3980,
        createdAt,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-a" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        totalCents: true,
        createdAt: true,
      },
    });
    const query = findMany.mock.calls[0]?.[0] as {
      select: Record<string, boolean>;
    };
    expect(Object.keys(query.select)).toEqual([
      "id",
      "status",
      "totalCents",
      "createdAt",
    ]);
    expect(query.select).not.toHaveProperty("userId");
    expect(query.select).not.toHaveProperty("lines");
  });

  it("keeps the public status vocabulary closed", () => {
    expect(ORDER_STATUS_LABELS).toEqual({
      PAID: "Pagado",
      CANCELLED: "Cancelado",
      PENDING_PAYMENT: "Pendiente de pago",
    });
    expect(isSupportedOrderStatus("PAID")).toBe(true);
    expect(isSupportedOrderStatus("CANCELLED")).toBe(true);
    expect(isSupportedOrderStatus("PENDING_PAYMENT")).toBe(true);
    expect(isSupportedOrderStatus("ADMIN_ONLY")).toBe(false);
    expect(isSupportedOrderStatus("constructor")).toBe(false);
    expect(isSupportedOrderStatus("toString")).toBe(false);
    expect(isSupportedOrderStatus("__proto__")).toBe(false);
  });
});
