import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookiesMock = vi.hoisted(() => vi.fn());
const addGuestCartItem = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../../../lib/server/cart", () => ({ addGuestCartItem }));

import { POST } from "./route";
import { CART_QUANTITY_MAX } from "../../../../lib/cart";

function request(
  body: unknown,
  options: Readonly<{
    origin?: string;
    contentType?: string;
    rawBody?: string;
  }> = {},
) {
  const headers = new Headers();
  if (options.origin !== undefined) {
    headers.set("Origin", options.origin);
  }
  if (options.contentType !== undefined) {
    headers.set("Content-Type", options.contentType);
  } else {
    headers.set("Content-Type", "application/json");
  }

  return new Request("http://localhost:3000/api/cart/items", {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

describe("POST /api/cart/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    cookiesMock.mockResolvedValue(cookieStore);
    addGuestCartItem.mockResolvedValue({
      ok: true,
      item: { variantId: "variant-s-black", quantity: 2 },
      itemCount: 2,
    });
  });

  it("adds a valid item, emits an anonymous cookie, and disables caching", async () => {
    const response = await POST(request({ variantId: "variant-s-black", quantity: 2 }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^cart_guest_token=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/u,
    );
    expect(addGuestCartItem).toHaveBeenCalledWith({
      variantId: "variant-s-black",
      quantity: 2,
      guestToken: expect.any(String),
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item: { variantId: "variant-s-black", quantity: 2 },
      itemCount: 2,
    });
  });

  it("reuses an existing guest cookie without emitting a replacement", async () => {
    cookieStore.get.mockReturnValue({ value: "existing-guest-token" });
    addGuestCartItem.mockResolvedValue({
      ok: true,
      item: { variantId: "variant-s-black", quantity: 3 },
      itemCount: 3,
    });

    const response = await POST(request({ variantId: "variant-s-black", quantity: 1 }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(addGuestCartItem).toHaveBeenCalledWith({
      variantId: "variant-s-black",
      quantity: 1,
      guestToken: "existing-guest-token",
    });
    await expect(response.json()).resolves.toMatchObject({
      item: { quantity: 3 },
      itemCount: 3,
    });
  });

  it.each([
    [{ variantId: "variant-s-black", quantity: 0 }, 400],
    [{ variantId: "variant-s-black", quantity: 1.5 }, 400],
    [{ variantId: "variant-s-black", quantity: CART_QUANTITY_MAX + 1 }, 400],
    [{ variantId: "variant-s-black", quantity: 1, priceCents: 1990 }, 400],
  ])("rejects invalid body %# without calling the service", async (body, status) => {
    const response = await POST(request(body));

    expect(response.status).toBe(status);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(addGuestCartItem).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Revisa la variante y la cantidad e inténtalo de nuevo.",
    });
  });

  it("rejects an explicitly foreign origin before parsing or mutating", async () => {
    const response = await POST(
      request({ variantId: "variant-s-black", quantity: 1 }, {
        origin: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(400);
    expect(addGuestCartItem).not.toHaveBeenCalled();
  });

  it("maps missing and exhausted variants to safe statuses", async () => {
    addGuestCartItem.mockResolvedValueOnce({
      ok: false,
      code: "variant_not_found",
    });
    await expect(
      POST(request({ variantId: "missing", quantity: 1 })).then((response) =>
        response.status,
      ),
    ).resolves.toBe(404);

    addGuestCartItem.mockResolvedValueOnce({ ok: false, code: "sold_out" });
    const soldOutResponse = await POST(
      request({ variantId: "variant-m-black", quantity: 1 }),
    );
    expect(soldOutResponse.status).toBe(409);
    await expect(soldOutResponse.json()).resolves.toEqual({
      ok: false,
      message: "Esa variante está agotada.",
    });
  });

  it("maps an accumulated quantity overflow to 400 without a mutation response", async () => {
    cookieStore.get.mockReturnValue({ value: "existing-guest-token" });
    addGuestCartItem.mockResolvedValueOnce({
      ok: false,
      code: "quantity_overflow",
    });

    const response = await POST(
      request({ variantId: "variant-s-black", quantity: 1 }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Revisa la variante y la cantidad e inténtalo de nuevo.",
    });
  });

  it("returns 413 for a body over the effective limit", async () => {
    const response = await POST(
      request(null, {
        rawBody: `{\"variantId\":\"${"x".repeat(8 * 1024)}\",\"quantity\":1}`,
      }),
    );

    expect(response.status).toBe(413);
    expect(addGuestCartItem).not.toHaveBeenCalled();
  });

  it("maps service failures without exposing implementation errors", async () => {
    addGuestCartItem.mockRejectedValueOnce(new Error("database details"));

    const response = await POST(request({ variantId: "variant-s-black", quantity: 1 }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "El carrito no está disponible temporalmente. Inténtalo de nuevo.",
    });
  });
});
