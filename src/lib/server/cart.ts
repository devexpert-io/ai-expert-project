import "server-only";

import {
  CART_QUANTITY_MAX,
  type CartAddInput,
  type CartAddSuccess,
} from "../cart";
import { prisma } from "./prisma";

export type CartMutationFailure = Readonly<{
  ok: false;
  code: "variant_not_found" | "sold_out" | "quantity_overflow";
}>;

export type AddGuestCartItemResult = CartAddSuccess | CartMutationFailure;

type AddGuestCartItemArgs = CartAddInput &
  Readonly<{
    guestToken: string;
  }>;

/**
 * Adds an item for an anonymous cart in one SQLite transaction.
 *
 * Stock is checked at add time, but is deliberately not reserved or
 * decremented. Checkout owns the later, authoritative stock revalidation.
 */
export async function addGuestCartItem({
  guestToken,
  variantId,
  quantity,
}: AddGuestCartItemArgs): Promise<AddGuestCartItemResult> {
  if (!guestToken) {
    throw new Error("guestToken is required");
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > CART_QUANTITY_MAX
  ) {
    return { ok: false, code: "quantity_overflow" };
  }

  return prisma.$transaction(async (transaction) => {
    const variant = await transaction.variant.findUnique({
      where: { id: variantId },
      select: { id: true, stock: true },
    });

    if (!variant) {
      return { ok: false, code: "variant_not_found" } as const;
    }

    if (variant.stock <= 0) {
      return { ok: false, code: "sold_out" } as const;
    }

    const existingCart = await transaction.cart.findUnique({
      where: { guestToken },
      select: { id: true },
    });

    const existingItem = existingCart
      ? await transaction.cartItem.findUnique({
          where: {
            cartId_variantId: {
              cartId: existingCart.id,
              variantId: variant.id,
            },
          },
          select: { quantity: true },
        })
      : null;

    if (
      existingItem &&
      existingItem.quantity > CART_QUANTITY_MAX - quantity
    ) {
      return { ok: false, code: "quantity_overflow" } as const;
    }

    const cart =
      existingCart ??
      (await transaction.cart.upsert({
        where: { guestToken },
        create: { guestToken },
        update: {},
        select: { id: true },
      }));

    const item = await transaction.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: variant.id,
        },
      },
      create: {
        cartId: cart.id,
        variantId: variant.id,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
      select: {
        variantId: true,
        quantity: true,
      },
    });

    const totals = await transaction.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: { quantity: true },
    });

    return {
      ok: true,
      item,
      itemCount: totals._sum.quantity ?? 0,
    } satisfies CartAddSuccess;
  });
}
