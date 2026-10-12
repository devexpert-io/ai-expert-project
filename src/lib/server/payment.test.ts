import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), create: vi.fn() },
  cart: { findUnique: vi.fn(), update: vi.fn() },
  variant: { findMany: vi.fn(), updateMany: vi.fn() },
  cartItem: { deleteMany: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
}));

vi.mock("./prisma", () => ({ prisma }));

import { processPayment } from "./payment";

const variant = {
  id: "variant-1",
  stock: 5,
  priceCents: 1990,
  size: "S",
  color: "Negro",
  product: { name: "Camiseta básica" },
} as const;
const cart = {
  id: "cart-1",
  items: [{ variantId: "variant-1", quantity: 2 }],
} as const;
const createdOrder = {
  id: "order-1",
  status: "PAID",
  totalCents: 3980,
} as const;

describe("server payment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.order.findUnique.mockResolvedValue(null);
    transaction.cart.findUnique
      .mockResolvedValueOnce({ id: "cart-1" })
      .mockResolvedValueOnce(cart);
    transaction.cart.update.mockResolvedValue({ id: "cart-1" });
    transaction.variant.findMany.mockResolvedValue([variant]);
    transaction.variant.updateMany.mockResolvedValue({ count: 1 });
    transaction.order.create.mockResolvedValue(createdOrder);
    transaction.cartItem.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("creates a PAID snapshot, decrements conditionally and clears the cart", async () => {
    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "approved" },
        idempotencyKey: "key-1",
      }),
    ).resolves.toEqual({
      ok: true,
      outcome: "approved",
      orderId: "order-1",
      orderStatus: "PAID",
      totalCents: 3980,
      replayed: false,
    });
    expect(transaction.variant.updateMany).toHaveBeenCalledWith({
      where: { id: "variant-1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(transaction.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          status: "PAID",
          totalCents: 3980,
          idempotencyKeyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
          lines: {
            create: [
              {
                variantId: "variant-1",
                productName: "Camiseta básica",
                size: "S",
                color: "Negro",
                quantity: 2,
                unitPriceCents: 1990,
              },
            ],
          },
        }),
      }),
    );
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: "cart-1" } });
  });

  it("creates a CANCELLED snapshot without stock or cart mutation", async () => {
    transaction.order.create.mockResolvedValue({
      id: "order-cancelled",
      status: "CANCELLED",
      totalCents: 3980,
    });

    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "rejected" },
        idempotencyKey: "key-rejected",
      }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: "rejected",
      orderStatus: "CANCELLED",
      totalCents: 3980,
      replayed: false,
    });
    expect(transaction.variant.updateMany).not.toHaveBeenCalled();
    expect(transaction.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("replays the stored result before reading an empty cart or trusting a new outcome", async () => {
    transaction.order.findUnique.mockResolvedValueOnce({
      id: "order-cancelled",
      status: "CANCELLED",
      totalCents: 3980,
    });

    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "approved" },
        idempotencyKey: "same-key",
      }),
    ).resolves.toEqual({
      ok: true,
      outcome: "rejected",
      orderId: "order-cancelled",
      orderStatus: "CANCELLED",
      totalCents: 3980,
      replayed: true,
    });
    expect(transaction.cart.findUnique).not.toHaveBeenCalled();
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it("rejects stale stock and an absent cart before creating an order", async () => {
    transaction.variant.findMany.mockResolvedValueOnce([{ ...variant, stock: 1 }]);
    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "approved" },
        idempotencyKey: "stale",
      }),
    ).resolves.toEqual({ ok: false, code: "stock_changed" });
    expect(transaction.order.create).not.toHaveBeenCalled();

    transaction.order.findUnique.mockReset().mockResolvedValue(null);
    transaction.cart.findUnique.mockReset().mockResolvedValue(null);
    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "rejected" },
        idempotencyKey: "empty",
      }),
    ).resolves.toEqual({ ok: false, code: "empty_cart" });
  });

  it("retries a transient SQLite transaction conflict", async () => {
    const transient = Object.assign(new Error("database is locked"), { code: "P2034" });
    prisma.$transaction
      .mockRejectedValueOnce(transient)
      .mockImplementationOnce(async (callback: (tx: typeof transaction) => unknown) => callback(transaction));
    transaction.order.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "approved" },
        idempotencyKey: "retry",
      }),
    ).resolves.toMatchObject({ ok: true, orderId: "order-1" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("recovers a same-key unique race by reading the winning order", async () => {
    const unique = Object.assign(new Error("unique"), { code: "P2002" });
    prisma.$transaction.mockRejectedValueOnce(unique);
    prisma.order.findUnique.mockResolvedValueOnce({
      id: "winner",
      status: "PAID",
      totalCents: 3980,
    });

    await expect(
      processPayment({
        userId: "user-1",
        input: { outcome: "rejected" },
        idempotencyKey: "race",
      }),
    ).resolves.toMatchObject({
      ok: true,
      orderId: "winner",
      outcome: "approved",
      replayed: true,
    });
  });
});

