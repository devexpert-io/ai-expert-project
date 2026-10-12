import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("./prisma", () => ({
  prisma: { order: { findFirst } },
}));

import { getUserOrderDetail } from "./order-detail";

const createdAt = new Date("2026-10-12T10:00:00.000Z");

const validOrder = {
  status: "PAID",
  totalCents: 6470,
  createdAt,
  lines: [
    {
      productName: "Camiseta básica histórica",
      size: "S",
      color: "Negro",
      quantity: 2,
      unitPriceCents: 1990,
    },
    {
      productName: "Pantalón recto histórico",
      size: "M",
      color: "Azul",
      quantity: 1,
      unitPriceCents: 2490,
    },
  ],
} as const;

describe("server order detail service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
  });

  it("reads an owner-scoped order with only historical line snapshots", async () => {
    findFirst.mockResolvedValueOnce(validOrder);

    await expect(getUserOrderDetail("user-a", "order-a")).resolves.toEqual({
      status: "PAID",
      totalCents: 6470,
      createdAt,
      lines: [
        {
          ...validOrder.lines[0],
          lineTotalCents: 3980,
        },
        {
          ...validOrder.lines[1],
          lineTotalCents: 2490,
        },
      ],
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "order-a", userId: "user-a" },
      select: {
        status: true,
        totalCents: true,
        createdAt: true,
        lines: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            productName: true,
            size: true,
            color: true,
            quantity: true,
            unitPriceCents: true,
          },
        },
      },
    });

    const query = findFirst.mock.calls[0]?.[0] as {
      select: Record<string, unknown>;
    };
    expect(query.select).not.toHaveProperty("id");
    expect(query.select).not.toHaveProperty("userId");
    expect(query.select).not.toHaveProperty("idempotencyKeyHash");
    expect(query.select).not.toHaveProperty("variant");
    expect(query.select).not.toHaveProperty("user");
    expect(query.select.lines).toEqual({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        productName: true,
        size: true,
        color: true,
        quantity: true,
        unitPriceCents: true,
      },
    });
  });

  it("returns null when Prisma cannot find the owner-scoped order", async () => {
    findFirst.mockResolvedValueOnce(null);

    await expect(getUserOrderDetail("user-b", "order-a")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-a", userId: "user-b" } }),
    );
  });

  it.each(["CANCELLED", "PENDING_PAYMENT"] as const)(
    "keeps the supported %s status",
    async (status) => {
      findFirst.mockResolvedValueOnce({ ...validOrder, status });

      await expect(getUserOrderDetail("user-a", "order-a")).resolves.toEqual(
        expect.objectContaining({ status }),
      );
    },
  );

  it.each([
    { status: "UNKNOWN", totalCents: 6470, lines: validOrder.lines },
    { status: "", totalCents: 6470, lines: validOrder.lines },
    { status: "PAID", totalCents: 6471, lines: validOrder.lines },
    {
      status: "PAID",
      totalCents: 6470,
      lines: [{ ...validOrder.lines[0], quantity: 0 }, validOrder.lines[1]],
    },
    {
      status: "PAID",
      totalCents: 6470,
      lines: [{ ...validOrder.lines[0], unitPriceCents: -1 }, validOrder.lines[1]],
    },
    { status: "PAID", totalCents: 0, lines: validOrder.lines },
    { status: "PAID", totalCents: 6470, lines: [] },
  ])("rejects invalid persisted data safely", async (order) => {
    findFirst.mockResolvedValueOnce({ ...validOrder, ...order });

    await expect(getUserOrderDetail("user-a", "order-a")).resolves.toBeNull();
  });

  it("rejects line multiplication and subtotal overflow", async () => {
    findFirst.mockResolvedValueOnce({
      ...validOrder,
      totalCents: Number.MAX_SAFE_INTEGER,
      lines: [
        {
          ...validOrder.lines[0],
          quantity: Number.MAX_SAFE_INTEGER,
          unitPriceCents: 2,
        },
      ],
    });

    await expect(getUserOrderDetail("user-a", "order-a")).resolves.toBeNull();
  });
});

