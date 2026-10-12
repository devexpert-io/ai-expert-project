import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookiesMock = vi.hoisted(() => vi.fn());
const completeCheckoutAuth = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../../../lib/server/auth", () => ({ completeCheckoutAuth }));

import { POST } from "./route";

const valid = {
  mode: "register",
  email: "ana@example.com",
  password: "correct horse",
  name: "Ana García",
  phone: "+34 600 123 456",
  shippingAddress: "Calle Mayor 1, Madrid",
} as const;

function request(body: unknown, origin?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin !== undefined) {
    headers.set("Origin", origin);
  }
  return new Request("http://localhost:3000/api/auth/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    cookiesMock.mockResolvedValue(cookieStore);
    completeCheckoutAuth.mockResolvedValue({
      ok: true,
      userId: "user-1",
      token: "opaque-session-token",
    });
  });

  it("returns no secrets and emits auth plus guest-expiry cookies", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "cart_guest_token" ? { value: "guest-token" } : undefined,
    );

    const response = await POST(request(valid));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toContain(
      "auth_session=opaque-session-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000",
    );
    expect(response.headers.get("Set-Cookie")).toContain(
      "cart_guest_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    );
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("user-1");
    expect(completeCheckoutAuth).toHaveBeenCalledWith({
      input: valid,
      currentSessionToken: undefined,
      guestToken: "guest-token",
    });
  });

  it("rejects extra fields, invalid password/body and foreign origins before service work", async () => {
    await expect(POST(request({ ...valid, extra: true }))).resolves.toHaveProperty(
      "status",
      400,
    );
    await expect(
      POST(request({ ...valid, password: "short" })),
    ).resolves.toHaveProperty("status", 400);
    await expect(
      POST(request(valid, "https://attacker.example")),
    ).resolves.toHaveProperty("status", 400);
    expect(completeCheckoutAuth).not.toHaveBeenCalled();
  });

  it("maps duplicate, invalid credentials, active session and merge overflow safely", async () => {
    for (const result of [
      [{ ok: false, code: "duplicate_email" }, 409],
      [{ ok: false, code: "invalid_credentials" }, 401],
      [{ ok: false, code: "active_session" }, 409],
      [{ ok: false, code: "quantity_overflow" }, 409],
    ] as const) {
      completeCheckoutAuth.mockResolvedValueOnce(result[0]);
      const response = await POST(request(valid));
      expect(response.status).toBe(result[1]);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    }
  });

  it("rejects a body above 8 KiB with no service call", async () => {
    const response = await POST(request({ ...valid, name: "x".repeat(8 * 1024) }));
    expect(response.status).toBe(400);
    expect(completeCheckoutAuth).not.toHaveBeenCalled();
  });
});
