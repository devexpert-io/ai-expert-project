import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { CART_QUANTITY_MAX } from "../cart";
import type { AuthInput } from "../auth";
import { prisma } from "./prisma";

export const BCRYPT_COST = 12;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

export type AuthServiceFailureCode =
  | "duplicate_email"
  | "invalid_credentials"
  | "active_session"
  | "quantity_overflow";

export type AuthServiceFailure = Readonly<{
  ok: false;
  code: AuthServiceFailureCode;
}>;

export type AuthServiceSuccess = Readonly<{
  ok: true;
  userId: string;
  token: string;
}>;

export type AuthServiceResult = AuthServiceSuccess | AuthServiceFailure;

export type SessionUser = Readonly<{
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  shippingAddress: string | null;
}>;

type TransactionClient = Prisma.TransactionClient;

const sessionUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  shippingAddress: true,
} satisfies Prisma.UserSelect;

const mergeItemSelect = {
  variantId: true,
  quantity: true,
} satisfies Prisma.CartItemSelect;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function getSessionUser(
  token: string | null | undefined,
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      user: { select: sessionUserSelect },
    },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session.user;
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await prisma.session.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

type MergeResult = Readonly<{ ok: true } | { ok: false; code: "quantity_overflow" }>;

/**
 * Associates a guest cart with a user, or merges it into the user's existing
 * cart. All overflow checks happen before the first write so callers can keep
 * account/contact/session creation atomic.
 */
export async function mergeGuestCartForUser(
  transaction: TransactionClient,
  userId: string,
  guestToken: string | null | undefined,
): Promise<MergeResult> {
  if (!guestToken) {
    return { ok: true };
  }

  const guestCart = await transaction.cart.findUnique({
    where: { guestToken },
    select: {
      id: true,
      userId: true,
      items: { select: mergeItemSelect },
    },
  });

  if (!guestCart || guestCart.userId) {
    return { ok: true };
  }

  const userCart = await transaction.cart.findUnique({
    where: { userId },
    select: {
      id: true,
      items: { select: mergeItemSelect },
    },
  });

  if (!userCart) {
    await transaction.cart.update({
      where: { id: guestCart.id },
      data: { userId, guestToken: null },
    });
    return { ok: true };
  }

  const quantities = new Map(
    userCart.items.map((item) => [item.variantId, item.quantity]),
  );
  for (const item of guestCart.items) {
    const current = quantities.get(item.variantId) ?? 0;
    const total = current + item.quantity;
    if (
      !Number.isSafeInteger(total) ||
      total < 1 ||
      total > CART_QUANTITY_MAX
    ) {
      return { ok: false, code: "quantity_overflow" };
    }
    quantities.set(item.variantId, total);
  }

  const userVariantIds = new Set(userCart.items.map((item) => item.variantId));
  for (const item of guestCart.items) {
    const total = quantities.get(item.variantId) ?? item.quantity;
    if (userVariantIds.has(item.variantId)) {
      await transaction.cartItem.update({
        where: {
          cartId_variantId: {
            cartId: userCart.id,
            variantId: item.variantId,
          },
        },
        data: { quantity: total },
      });
    } else {
      await transaction.cartItem.create({
        data: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity: item.quantity,
        },
      });
    }
  }

  await transaction.cart.delete({ where: { id: guestCart.id } });
  return { ok: true };
}

type CreateSessionResult = Readonly<{
  token: string;
  userId: string;
}>;

async function createSessionInTransaction(
  transaction: TransactionClient,
  userId: string,
  token: string,
): Promise<CreateSessionResult> {
  await transaction.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    },
  });

  return { token, userId };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Completes registration or login and preserves the checkout cart in one
 * transaction. The raw session token is returned only to the route so it can
 * become an HttpOnly cookie; it is never persisted or included in a response.
 */
export async function completeCheckoutAuth(args: Readonly<{
  input: AuthInput;
  guestToken?: string | null;
  currentSessionToken?: string | null;
}>): Promise<AuthServiceResult> {
  const { input, guestToken, currentSessionToken } = args;

  if (currentSessionToken && (await getSessionUser(currentSessionToken))) {
    return { ok: false, code: "active_session" };
  }

  const token = createSessionToken();

  if (input.mode === "register") {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, code: "duplicate_email" };
    }

    const passwordHash = await hashPassword(input.password);
    try {
      return await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: input.email,
            passwordHash,
            name: input.name,
            phone: input.phone,
            shippingAddress: input.shippingAddress,
          },
          select: { id: true },
        });

        const merge = await mergeGuestCartForUser(
          transaction,
          user.id,
          guestToken,
        );
        if (!merge.ok) {
          return merge;
        }

        return {
          ok: true,
          ...(await createSessionInTransaction(transaction, user.id, token)),
        } satisfies AuthServiceSuccess;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { ok: false, code: "duplicate_email" };
      }
      throw error;
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    return { ok: false, code: "invalid_credentials" };
  }

  return prisma.$transaction(async (transaction) => {
    const merge = await mergeGuestCartForUser(transaction, user.id, guestToken);
    if (!merge.ok) {
      return merge;
    }

    await transaction.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        shippingAddress: input.shippingAddress,
      },
    });

    return {
      ok: true,
      ...(await createSessionInTransaction(transaction, user.id, token)),
    } satisfies AuthServiceSuccess;
  });
}

