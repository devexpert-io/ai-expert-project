import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookiesMock = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const processPayment = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../../../lib/server/auth", () => ({ getSessionUser }));
vi.mock("../../../../lib/server/payment", () => ({ processPayment }));

import { POST } from "./route";

function request(
  body: unknown,
  options: Readonly<{
    key?: string;
    origin?: string;
    contentType?: string;
    rawBody?: string;
  }> = {},
): Request {
  const headers = new Headers({
    "Content-Type": options.contentType ?? "application/json",
    "Idempotency-Key": options.key ?? "payment-key-1",
  });
  if (options.origin !== undefined) {
    headers.set("Origin", options.origin);
  }
  return new Request("http://localhost:3000/api/checkout/payment", {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

describe("POST /api/checkout/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "opaque-session" });
    cookiesMock.mockResolvedValue(cookieStore);
    getSessionUser.mockResolvedValue({ id: "user-1" });
    processPayment.mockResolvedValue({
      ok: true,
      outcome: "approved",
      orderId: "order-1",
      orderStatus: "PAID",
      totalCents: 3980,
      replayed: false,
    });
  });

  it("derives the user from the session and returns only the public order result", async () => {
    const response = await POST(request({ outcome: "approved" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(processPayment).toHaveBeenCalledWith({
      userId: "user-1",
      input: { outcome: "approved" },
      idempotencyKey: "payment-key-1",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      outcome: "approved",
      orderId: "order-1",
      orderStatus: "PAID",
      totalCents: 3980,
    });
  });

  it("maps a cancellation without exposing service internals", async () => {
    processPayment.mockResolvedValueOnce({
      ok: true,
      outcome: "rejected",
      orderId: "cancelled-1",
      orderStatus: "CANCELLED",
      totalCents: 3980,
      replayed: false,
    });
    const response = await POST(request({ outcome: "rejected" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      outcome: "rejected",
      orderId: "cancelled-1",
      orderStatus: "CANCELLED",
      totalCents: 3980,
    });
  });

  it("requires a valid session and closed body/header/origin", async () => {
    getSessionUser.mockResolvedValueOnce(null);
    await expect(POST(request({ outcome: "approved" }))).resolves.toHaveProperty("status", 401);
    expect(processPayment).not.toHaveBeenCalled();

    getSessionUser.mockResolvedValue({ id: "user-1" });
    await expect(
      POST(request({ outcome: "approved", totalCents: 3980 })),
    ).resolves.toHaveProperty("status", 400);
    await expect(
      POST(request({ outcome: "approved" }, { key: "has space" })),
    ).resolves.toHaveProperty("status", 400);
    await expect(
      POST(request({ outcome: "approved" }, { origin: "https://attacker.example" })),
    ).resolves.toHaveProperty("status", 400);
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("maps stale stock, empty carts and transient persistence safely", async () => {
    for (const [code, status] of [
      ["stock_changed", 409],
      ["invalid_cart", 409],
      ["empty_cart", 409],
      ["unavailable", 503],
    ] as const) {
      processPayment.mockResolvedValueOnce({ ok: false, code });
      const response = await POST(request({ outcome: "approved" }));
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain("user-1");
    }
  });

  it("rejects oversized and malformed bodies before auth/service work", async () => {
    const oversized = await POST(
      request(null, { rawBody: `{"outcome":"approved","padding":"${"x".repeat(8 * 1024)}"}` }),
    );
    expect(oversized.status).toBe(413);

    const malformed = await POST(
      request(null, { rawBody: "{not-json" }),
    );
    expect(malformed.status).toBe(400);
    expect(processPayment).not.toHaveBeenCalled();
  });
});

