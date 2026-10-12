import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  user: { create: vi.fn(), update: vi.fn() },
  session: { create: vi.fn() },
  cart: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  cartItem: { update: vi.fn(), create: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { findUnique: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
    callback(transaction),
  ),
}));

vi.mock("./prisma", () => ({ prisma }));

import {
  comparePassword,
  completeCheckoutAuth,
  getSessionUser,
  hashPassword,
  hashSessionToken,
  mergeGuestCartForUser,
  revokeSession,
} from "./auth";

const input = {
  mode: "register",
  email: "ana@example.com",
  password: "correct horse",
  name: "Ana García",
  phone: "+34 600 123 456",
  shippingAddress: "Calle Mayor 1, Madrid",
} as const;

describe("server authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    transaction.user.create.mockResolvedValue({ id: "user-1" });
    transaction.user.update.mockResolvedValue({ id: "user-1" });
    transaction.cart.findUnique.mockResolvedValue(null);
    transaction.session.create.mockResolvedValue({ id: "session-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses bcrypt and never treats the password as the stored value", async () => {
    const hash = await hashPassword(input.password);
    expect(hash).toMatch(/^\$2[aby]\$12\$/u);
    expect(hash).not.toContain(input.password);
    await expect(comparePassword(input.password, hash)).resolves.toBe(true);
    await expect(comparePassword("wrong password", hash)).resolves.toBe(false);
  });

  it("registers, associates a guest cart and creates an opaque session in one transaction", async () => {
    const result = await completeCheckoutAuth({
      input,
      guestToken: "guest-token",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("user-1");
      expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    }
    expect(transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: input.email }),
      }),
    );
    expect(transaction.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          tokenHash: expect.not.stringContaining(input.password),
        }),
      }),
    );
  });

  it("rejects invalid login credentials before opening a transaction", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: await hashPassword("different password"),
    });

    await expect(
      completeCheckoutAuth({
        input: { ...input, mode: "login" },
        guestToken: "guest-token",
      }),
    ).resolves.toEqual({ ok: false, code: "invalid_credentials" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("detects merge overflow before changing either cart", async () => {
    transaction.cart.findUnique
      .mockResolvedValueOnce({
        id: "guest-cart",
        userId: null,
        items: [{ variantId: "variant-1", quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: "user-cart",
        items: [{ variantId: "variant-1", quantity: 2_147_483_647 }],
      });

    await expect(
      mergeGuestCartForUser(transaction as never, "user-1", "guest-token"),
    ).resolves.toEqual({ ok: false, code: "quantity_overflow" });
    expect(transaction.cartItem.update).not.toHaveBeenCalled();
    expect(transaction.cartItem.create).not.toHaveBeenCalled();
    expect(transaction.cart.delete).not.toHaveBeenCalled();
  });

  it("looks up sessions by the SHA-256 token hash and returns only the user projection", async () => {
    const rawToken = "opaque-session-token";
    const user = {
      id: "user-1",
      email: "ana@example.com",
      name: "Ana García",
      phone: "+34 600 123 456",
      shippingAddress: "Calle Mayor 1, Madrid",
    };
    prisma.session.findUnique.mockResolvedValueOnce({
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      user,
    });

    await expect(getSessionUser(rawToken)).resolves.toEqual(user);
    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken(rawToken) },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            shippingAddress: true,
          },
        },
      },
    });
    expect(JSON.stringify(prisma.session.findUnique.mock.calls[0])).not.toContain(
      rawToken,
    );
  });

  it.each([
    ["exactly at expiry", 0, false],
    ["after expiry", -1, false],
    ["before expiry", 1, true],
  ])("treats a session %s as valid only while expiresAt is in the future", async (_label, offset, valid) => {
    vi.useFakeTimers();
    const now = new Date("2026-10-12T12:00:00.000Z");
    vi.setSystemTime(now);
    prisma.session.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(now.getTime() + offset),
      user: {
        id: "user-1",
        email: "ana@example.com",
        name: null,
        phone: null,
        shippingAddress: null,
      },
    });

    await expect(getSessionUser("expiry-token")).resolves.toEqual(
      valid
        ? {
            id: "user-1",
            email: "ana@example.com",
            name: null,
            phone: null,
            shippingAddress: null,
          }
        : null,
    );
  });

  it("revokes by hash and never needs the raw token in persistence", async () => {
    const rawToken = "session-to-revoke";

    await revokeSession(rawToken);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken(rawToken) },
    });
    expect(JSON.stringify(prisma.session.deleteMany.mock.calls[0])).not.toContain(
      rawToken,
    );

    prisma.session.findUnique.mockResolvedValueOnce(null);
    await expect(getSessionUser(rawToken)).resolves.toBeNull();
  });
});
