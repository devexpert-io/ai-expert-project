import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { CART_QUANTITY_MAX } from "../cart";
import type { PaymentInput, PaymentOutcome } from "../payment";
import { prisma } from "./prisma";

const PAYMENT_ORDER_STATUSES = {
  approved: "PAID",
  rejected: "CANCELLED",
} as const;

const MAX_TRANSACTION_ATTEMPTS = 4;
const PRISMA_INT_MAX = 2_147_483_647;

export type PaymentFailureCode =
  | "empty_cart"
  | "stock_changed"
  | "invalid_cart"
  | "unavailable";

export type PaymentServiceFailure = Readonly<{
  ok: false;
  code: PaymentFailureCode;
}>;

export type PaymentServiceSuccess = Readonly<{
  ok: true;
  outcome: PaymentOutcome;
  orderId: string;
  orderStatus: "PAID" | "CANCELLED";
  totalCents: number;
  replayed: boolean;
}>;

export type PaymentServiceResult =
  | PaymentServiceSuccess
  | PaymentServiceFailure;

const orderReplaySelect = {
  id: true,
  status: true,
  totalCents: true,
} satisfies Prisma.OrderSelect;

const cartPaymentSelect = {
  id: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      variantId: true,
      quantity: true,
    },
  },
} satisfies Prisma.CartSelect;

const variantPaymentSelect = {
  id: true,
  stock: true,
  priceCents: true,
  size: true,
  color: true,
  product: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.VariantSelect;

type ReplayOrder = Prisma.OrderGetPayload<{
  select: typeof orderReplaySelect;
}>;

type PaymentCart = Prisma.CartGetPayload<{
  select: typeof cartPaymentSelect;
}>;

type PaymentVariant = Prisma.VariantGetPayload<{
  select: typeof variantPaymentSelect;
}>;

type SnapshotLine = Readonly<{
  variantId: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPriceCents: number;
}>;

class PaymentFailure extends Error {
  readonly code: Exclude<PaymentFailureCode, "unavailable">;

  constructor(code: Exclude<PaymentFailureCode, "unavailable">) {
    super(code);
    this.name = "PaymentFailure";
    this.code = code;
  }
}

function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  return errorCode(error) === "P2002";
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "P1008" || code === "P2034") {
    return true;
  }

  if (code !== "P2028") {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /database (?:is )?locked|database table is locked|busy|write conflict|deadlock|transaction.*closed/iu.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function replayResult(order: ReplayOrder, replayed: boolean): PaymentServiceSuccess {
  const outcome =
    order.status === PAYMENT_ORDER_STATUSES.approved ? "approved" : "rejected";
  if (order.status !== PAYMENT_ORDER_STATUSES.approved && order.status !== PAYMENT_ORDER_STATUSES.rejected) {
    throw new PaymentFailure("invalid_cart");
  }

  return {
    ok: true,
    outcome,
    orderId: order.id,
    orderStatus: order.status,
    totalCents: order.totalCents,
    replayed,
  };
}

function addSafe(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > PRISMA_INT_MAX) {
    throw new PaymentFailure("invalid_cart");
  }
  return result;
}

function buildSnapshot(
  cart: PaymentCart,
  variants: readonly PaymentVariant[],
): { lines: SnapshotLine[]; totalCents: number } {
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const lines: SnapshotLine[] = [];
  let totalCents = 0;

  for (const item of cart.items) {
    const variant = variantsById.get(item.variantId);
    if (
      !variant ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > CART_QUANTITY_MAX ||
      !Number.isSafeInteger(variant.stock) ||
      variant.stock < item.quantity ||
      !Number.isSafeInteger(variant.priceCents) ||
      variant.priceCents <= 0
    ) {
      throw new PaymentFailure(variant && variant.stock < item.quantity ? "stock_changed" : "invalid_cart");
    }

    const lineTotal = item.quantity * variant.priceCents;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new PaymentFailure("invalid_cart");
    }

    totalCents = addSafe(totalCents, lineTotal);
    lines.push({
      variantId: variant.id,
      productName: variant.product.name,
      size: variant.size,
      color: variant.color,
      quantity: item.quantity,
      unitPriceCents: variant.priceCents,
    });
  }

  if (lines.length === 0) {
    throw new PaymentFailure("empty_cart");
  }

  return { lines, totalCents };
}

async function processPaymentAttempt(
  userId: string,
  input: PaymentInput,
  idempotencyKeyHash: string,
): Promise<PaymentServiceSuccess> {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.order.findUnique({
      where: {
        userId_idempotencyKeyHash: {
          userId,
          idempotencyKeyHash,
        },
      },
      select: orderReplaySelect,
    });
    if (existing) {
      return replayResult(existing, true);
    }

    const cartReference = await transaction.cart.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!cartReference) {
      throw new PaymentFailure("empty_cart");
    }

    // A harmless row update serializes two buyers before reading the snapshot.
    await transaction.cart.update({
      where: { id: cartReference.id },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    const cart = await transaction.cart.findUnique({
      where: { id: cartReference.id },
      select: cartPaymentSelect,
    });
    if (!cart || cart.items.length === 0) {
      throw new PaymentFailure("empty_cart");
    }

    const variantIds = cart.items.map((item) => item.variantId);
    const variants = await transaction.variant.findMany({
      where: { id: { in: variantIds } },
      select: variantPaymentSelect,
    });
    const snapshot = buildSnapshot(cart, variants);
    const orderStatus = PAYMENT_ORDER_STATUSES[input.outcome];

    if (input.outcome === "approved") {
      for (const line of snapshot.lines) {
        const updated = await transaction.variant.updateMany({
          where: {
            id: line.variantId,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count !== 1) {
          throw new PaymentFailure("stock_changed");
        }
      }
    }

    const order = await transaction.order.create({
      data: {
        userId,
        status: orderStatus,
        totalCents: snapshot.totalCents,
        idempotencyKeyHash,
        lines: {
          create: snapshot.lines,
        },
      },
      select: orderReplaySelect,
    });

    if (input.outcome === "approved") {
      await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return replayResult(order, false);
  });
}

export async function processPayment(args: Readonly<{
  userId: string;
  input: PaymentInput;
  idempotencyKey: string;
}>): Promise<PaymentServiceResult> {
  const idempotencyKeyHash = hashIdempotencyKey(args.idempotencyKey);

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await processPaymentAttempt(args.userId, args.input, idempotencyKeyHash);
    } catch (error) {
      if (error instanceof PaymentFailure) {
        return { ok: false, code: error.code };
      }

      if (isUniqueConstraintError(error)) {
        const winner = await prisma.order.findUnique({
          where: {
            userId_idempotencyKeyHash: {
              userId: args.userId,
              idempotencyKeyHash,
            },
          },
          select: orderReplaySelect,
        });
        if (winner) {
          return replayResult(winner, true);
        }
      }

      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        return { ok: false, code: "unavailable" };
      }

      await sleep(10 * (attempt + 1));
    }
  }

  return { ok: false, code: "unavailable" };
}

