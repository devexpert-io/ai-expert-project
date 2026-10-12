import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  variant: { findUnique: vi.fn() },
  cart: { findUnique: vi.fn(), upsert: vi.fn() },
  cartItem: { findUnique: vi.fn(), upsert: vi.fn(), aggregate: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
    callback(transaction),
  ),
}));

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({ prisma }));

import { addGuestCartItem } from "./cart";
import { CART_QUANTITY_MAX } from "../cart";

describe("addGuestCartItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.cart.findUnique.mockResolvedValue(null);
    transaction.cartItem.findUnique.mockResolvedValue(null);
    transaction.variant.findUnique.mockResolvedValue({
      id: "variant-s-black",
      stock: 12,
    });
    transaction.cart.upsert.mockResolvedValue({ id: "cart-1" });
    transaction.cartItem.upsert.mockResolvedValue({
      variantId: "variant-s-black",
      quantity: 2,
    });
    transaction.cartItem.aggregate.mockResolvedValue({
      _sum: { quantity: 2 },
    });
  });

  it("creates an anonymous cart item and returns the unit total", async () => {
    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: 2,
      }),
    ).resolves.toEqual({
      ok: true,
      item: { variantId: "variant-s-black", quantity: 2 },
      itemCount: 2,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.variant.findUnique).toHaveBeenCalledWith({
      where: { id: "variant-s-black" },
      select: { id: true, stock: true },
    });
    expect(transaction.cart.upsert).toHaveBeenCalledWith({
      where: { guestToken: "guest-token" },
      create: { guestToken: "guest-token" },
      update: {},
      select: { id: true },
    });
    expect(transaction.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cartId_variantId: { cartId: "cart-1", variantId: "variant-s-black" },
        },
        create: { cartId: "cart-1", variantId: "variant-s-black", quantity: 2 },
        update: { quantity: { increment: 2 } },
      }),
    );
  });

  it("uses one unique item and increments the requested quantity", async () => {
    transaction.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    transaction.cartItem.findUnique.mockResolvedValue({ quantity: 2 });
    transaction.cartItem.upsert.mockResolvedValue({
      variantId: "variant-s-black",
      quantity: 3,
    });
    transaction.cartItem.aggregate.mockResolvedValue({
      _sum: { quantity: 3 },
    });

    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: 1,
      }),
    ).resolves.toEqual({
      ok: true,
      item: { variantId: "variant-s-black", quantity: 3 },
      itemCount: 3,
    });
    expect(transaction.cart.upsert).not.toHaveBeenCalled();
    expect(transaction.cartItem.findUnique).toHaveBeenCalledWith({
      where: {
        cartId_variantId: { cartId: "cart-1", variantId: "variant-s-black" },
      },
      select: { quantity: true },
    });
  });

  it("accepts the SQLite Int32 maximum for a new line", async () => {
    transaction.cartItem.upsert.mockResolvedValue({
      variantId: "variant-s-black",
      quantity: CART_QUANTITY_MAX,
    });
    transaction.cartItem.aggregate.mockResolvedValue({
      _sum: { quantity: CART_QUANTITY_MAX },
    });

    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: CART_QUANTITY_MAX,
      }),
    ).resolves.toEqual({
      ok: true,
      item: { variantId: "variant-s-black", quantity: CART_QUANTITY_MAX },
      itemCount: CART_QUANTITY_MAX,
    });
  });

  it("rejects an accumulated Int32 overflow before mutating the cart", async () => {
    transaction.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    transaction.cartItem.findUnique.mockResolvedValue({
      quantity: CART_QUANTITY_MAX,
    });

    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, code: "quantity_overflow" });
    expect(transaction.cart.upsert).not.toHaveBeenCalled();
    expect(transaction.cartItem.upsert).not.toHaveBeenCalled();
    expect(transaction.cartItem.aggregate).not.toHaveBeenCalled();
  });

  it("rejects an initial quantity over the Int32 maximum without opening a transaction", async () => {
    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: CART_QUANTITY_MAX + 1,
      }),
    ).resolves.toEqual({ ok: false, code: "quantity_overflow" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown variant before creating a cart", async () => {
    transaction.variant.findUnique.mockResolvedValue(null);

    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "missing",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, code: "variant_not_found" });
    expect(transaction.cart.upsert).not.toHaveBeenCalled();
    expect(transaction.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects an exhausted variant without mutating the cart", async () => {
    transaction.variant.findUnique.mockResolvedValue({
      id: "variant-m-black",
      stock: 0,
    });

    await expect(
      addGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-m-black",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, code: "sold_out" });
    expect(transaction.cart.upsert).not.toHaveBeenCalled();
    expect(transaction.cartItem.upsert).not.toHaveBeenCalled();
  });
});
