import "server-only";

import type { Prisma } from "@prisma/client";

import {
  CART_QUANTITY_MAX,
  type CartAddInput,
  type CartAddSuccess,
  type CartMutationSuccess,
  type CartUpdateInput,
  type CartRemoveInput,
  type CartView,
} from "../cart";
import { prisma } from "./prisma";

export type CartMutationFailure = Readonly<{
  ok: false;
  code:
    | "variant_not_found"
    | "sold_out"
    | "quantity_overflow"
    | "cart_item_not_found";
}>;

export type AddCartItemResult = CartAddSuccess | CartMutationFailure;
export type UpdateCartItemResult = CartMutationSuccess | CartMutationFailure;
export type RemoveCartItemResult = CartMutationSuccess | CartMutationFailure;
export type AddGuestCartItemResult = AddCartItemResult;
export type UpdateGuestCartItemResult = UpdateCartItemResult;
export type RemoveGuestCartItemResult = RemoveCartItemResult;
export type AddUserCartItemResult = AddCartItemResult;
export type UpdateUserCartItemResult = UpdateCartItemResult;
export type RemoveUserCartItemResult = RemoveCartItemResult;

export type CartOwner =
  | Readonly<{ guestToken: string }>
  | Readonly<{ userId: string }>;

type CartItemRecord = Readonly<{
  variantId: string;
  quantity: number;
  variant: Readonly<{
    id: string;
    size: string;
    color: string;
    priceCents: number;
    product: Readonly<{
      slug: string;
      name: string;
      imageUrl: string;
    }>;
  }>;
}>;

type CartReader = Pick<Prisma.TransactionClient, "cart">;

const cartItemSelect = {
  variantId: true,
  quantity: true,
  variant: {
    select: {
      id: true,
      size: true,
      color: true,
      priceCents: true,
      product: {
        select: {
          slug: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  },
} satisfies Prisma.CartItemSelect;

function ownerWhere(owner: CartOwner): { guestToken: string } | { userId: string } {
  return "guestToken" in owner
    ? { guestToken: owner.guestToken }
    : { userId: owner.userId };
}

function ownerCreate(owner: CartOwner): { guestToken: string } | { userId: string } {
  return "guestToken" in owner
    ? { guestToken: owner.guestToken }
    : { userId: owner.userId };
}

function addSafeIntegers(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error("cart total overflow");
  }
  return result;
}

function buildCartView(items: readonly CartItemRecord[]): CartView {
  let itemCount = 0;
  let subtotalCents = 0;
  const viewItems = items.map((item) => {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isSafeInteger(item.variant.priceCents) ||
      item.variant.priceCents < 0
    ) {
      throw new Error("invalid cart item");
    }

    const lineTotalCents = item.quantity * item.variant.priceCents;
    if (!Number.isSafeInteger(lineTotalCents)) {
      throw new Error("cart line total overflow");
    }

    itemCount = addSafeIntegers(itemCount, item.quantity);
    subtotalCents = addSafeIntegers(subtotalCents, lineTotalCents);

    return {
      variantId: item.variantId,
      productSlug: item.variant.product.slug,
      productName: item.variant.product.name,
      imageUrl: item.variant.product.imageUrl,
      size: item.variant.size,
      color: item.variant.color,
      unitPriceCents: item.variant.priceCents,
      quantity: item.quantity,
      lineTotalCents,
    };
  });

  return { items: viewItems, itemCount, subtotalCents };
}

async function readCartFrom(
  client: CartReader,
  owner: CartOwner,
): Promise<CartView> {
  const cart = await client.cart.findUnique({
    where: ownerWhere(owner),
    select: {
      items: {
        orderBy: { id: "asc" },
        select: cartItemSelect,
      },
    },
  });

  if (!cart) {
    return { items: [], itemCount: 0, subtotalCents: 0 };
  }

  return buildCartView(cart.items as readonly CartItemRecord[]);
}

export async function getCartForOwner(owner: CartOwner): Promise<CartView> {
  if (
    ("guestToken" in owner && !owner.guestToken) ||
    ("userId" in owner && !owner.userId)
  ) {
    throw new Error("cart owner is required");
  }

  return readCartFrom(prisma, owner);
}

export async function getGuestCart(guestToken: string): Promise<CartView> {
  return getCartForOwner({ guestToken });
}

export async function getUserCart(userId: string): Promise<CartView> {
  return getCartForOwner({ userId });
}

type AddCartItemArgs = CartAddInput & Readonly<{ owner: CartOwner }>;
type UpdateCartItemArgs = CartUpdateInput & Readonly<{ owner: CartOwner }>;
type RemoveCartItemArgs = CartRemoveInput & Readonly<{ owner: CartOwner }>;

export async function addCartItem({
  owner,
  variantId,
  quantity,
}: AddCartItemArgs): Promise<AddCartItemResult> {
  if (
    ("guestToken" in owner && !owner.guestToken) ||
    ("userId" in owner && !owner.userId)
  ) {
    throw new Error("cart owner is required");
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
      where: ownerWhere(owner),
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
        where: ownerWhere(owner),
        create: ownerCreate(owner),
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

export async function updateCartItem({
  owner,
  variantId,
  quantity,
}: UpdateCartItemArgs): Promise<UpdateCartItemResult> {
  if (
    ("guestToken" in owner && !owner.guestToken) ||
    ("userId" in owner && !owner.userId)
  ) {
    throw new Error("cart owner is required");
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > CART_QUANTITY_MAX
  ) {
    return { ok: false, code: "quantity_overflow" };
  }

  return prisma.$transaction(async (transaction) => {
    const cart = await transaction.cart.findUnique({
      where: ownerWhere(owner),
      select: { id: true },
    });
    if (!cart) {
      return { ok: false, code: "cart_item_not_found" } as const;
    }

    const item = await transaction.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      select: { id: true },
    });
    if (!item) {
      return { ok: false, code: "cart_item_not_found" } as const;
    }

    await transaction.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return {
      ok: true,
      cart: await readCartFrom(transaction, owner),
    } satisfies CartMutationSuccess;
  });
}

export async function removeCartItem({
  owner,
  variantId,
}: RemoveCartItemArgs): Promise<RemoveCartItemResult> {
  if (
    ("guestToken" in owner && !owner.guestToken) ||
    ("userId" in owner && !owner.userId)
  ) {
    throw new Error("cart owner is required");
  }

  return prisma.$transaction(async (transaction) => {
    const cart = await transaction.cart.findUnique({
      where: ownerWhere(owner),
      select: { id: true },
    });
    if (!cart) {
      return { ok: false, code: "cart_item_not_found" } as const;
    }

    const item = await transaction.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      select: { id: true },
    });
    if (!item) {
      return { ok: false, code: "cart_item_not_found" } as const;
    }

    await transaction.cartItem.delete({ where: { id: item.id } });

    return {
      ok: true,
      cart: await readCartFrom(transaction, owner),
    } satisfies CartMutationSuccess;
  });
}

export function addGuestCartItem(
  args: CartAddInput & Readonly<{ guestToken: string }>,
): Promise<AddGuestCartItemResult> {
  return addCartItem({ owner: { guestToken: args.guestToken }, ...args });
}

export function updateGuestCartItem(
  args: CartUpdateInput & Readonly<{ guestToken: string }>,
): Promise<UpdateGuestCartItemResult> {
  return updateCartItem({ owner: { guestToken: args.guestToken }, ...args });
}

export function removeGuestCartItem(
  args: CartRemoveInput & Readonly<{ guestToken: string }>,
): Promise<RemoveGuestCartItemResult> {
  return removeCartItem({ owner: { guestToken: args.guestToken }, ...args });
}

export function addUserCartItem(
  args: CartAddInput & Readonly<{ userId: string }>,
): Promise<AddUserCartItemResult> {
  return addCartItem({ owner: { userId: args.userId }, ...args });
}

export function updateUserCartItem(
  args: CartUpdateInput & Readonly<{ userId: string }>,
): Promise<UpdateUserCartItemResult> {
  return updateCartItem({ owner: { userId: args.userId }, ...args });
}

export function removeUserCartItem(
  args: CartRemoveInput & Readonly<{ userId: string }>,
): Promise<RemoveUserCartItemResult> {
  return removeCartItem({ owner: { userId: args.userId }, ...args });
}
