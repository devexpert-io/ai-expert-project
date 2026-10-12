import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  variant: { findUnique: vi.fn() },
  cart: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  cartItem: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
const prisma = vi.hoisted(() => ({
  cart: transaction.cart,
  $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
    callback(transaction),
  ),
}));

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({ prisma }));

import {
  addGuestCartItem,
  getGuestCart,
  removeGuestCartItem,
  updateGuestCartItem,
} from "./cart";
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

const snapshotItems = [
  {
    variantId: "variant-s-black",
    quantity: 2,
    variant: {
      id: "variant-s-black",
      size: "S",
      color: "Negro",
      priceCents: 1990,
      product: {
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/camiseta.png",
      },
    },
  },
  {
    variantId: "variant-m-blue",
    quantity: 1,
    variant: {
      id: "variant-m-blue",
      size: "M",
      color: "Azul",
      priceCents: 2490,
      product: {
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/camiseta.png",
      },
    },
  },
] as const;

describe("guest cart snapshots and management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a plain snapshot with exact line totals and subtotal", async () => {
    transaction.cart.findUnique.mockResolvedValue({ items: snapshotItems });

    await expect(getGuestCart("guest-token")).resolves.toEqual({
      items: [
        {
          variantId: "variant-s-black",
          productSlug: "camiseta-basica",
          productName: "Camiseta básica",
          imageUrl: "https://placehold.co/camiseta.png",
          size: "S",
          color: "Negro",
          unitPriceCents: 1990,
          quantity: 2,
          lineTotalCents: 3980,
        },
        {
          variantId: "variant-m-blue",
          productSlug: "camiseta-basica",
          productName: "Camiseta básica",
          imageUrl: "https://placehold.co/camiseta.png",
          size: "M",
          color: "Azul",
          unitPriceCents: 2490,
          quantity: 1,
          lineTotalCents: 2490,
        },
      ],
      itemCount: 3,
      subtotalCents: 6470,
    });
    expect(transaction.cart.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestToken: "guest-token" } }),
    );
  });

  it("returns an empty snapshot without creating a cart", async () => {
    transaction.cart.findUnique.mockResolvedValue(null);

    await expect(getGuestCart("missing-token")).resolves.toEqual({
      items: [],
      itemCount: 0,
      subtotalCents: 0,
    });
    expect(transaction.cart.upsert).not.toHaveBeenCalled();
  });

  it("updates an existing line and returns the recalculated snapshot", async () => {
    transaction.cart.findUnique
      .mockResolvedValueOnce({ id: "cart-1" })
      .mockResolvedValueOnce({
        items: [{ ...snapshotItems[0], quantity: 5 }],
      });
    transaction.cartItem.findUnique.mockResolvedValue({ id: "item-1" });

    await expect(
      updateGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: 5,
      }),
    ).resolves.toEqual({
      ok: true,
      cart: {
        items: [expect.objectContaining({ quantity: 5, lineTotalCents: 9950 })],
        itemCount: 5,
        subtotalCents: 9950,
      },
    });
    expect(transaction.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 5 },
    });
  });

  it("removes one line and keeps the cart row when it becomes empty", async () => {
    transaction.cart.findUnique
      .mockResolvedValueOnce({ id: "cart-1" })
      .mockResolvedValueOnce({ items: [] });
    transaction.cartItem.findUnique.mockResolvedValue({ id: "item-1" });

    await expect(
      removeGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
      }),
    ).resolves.toEqual({
      ok: true,
      cart: { items: [], itemCount: 0, subtotalCents: 0 },
    });
    expect(transaction.cartItem.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
    expect(transaction.cart.delete).not.toHaveBeenCalled();
  });

  it("does not mutate a missing line and rejects invalid service quantities", async () => {
    transaction.cart.findUnique.mockResolvedValue({ id: "cart-1" });
    transaction.cartItem.findUnique.mockResolvedValue(null);

    await expect(
      updateGuestCartItem({
        guestToken: "guest-token",
        variantId: "missing",
        quantity: 2,
      }),
    ).resolves.toEqual({ ok: false, code: "cart_item_not_found" });
    expect(transaction.cartItem.update).not.toHaveBeenCalled();

    await expect(
      updateGuestCartItem({
        guestToken: "guest-token",
        variantId: "variant-s-black",
        quantity: CART_QUANTITY_MAX + 1,
      }),
    ).resolves.toEqual({ ok: false, code: "quantity_overflow" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
