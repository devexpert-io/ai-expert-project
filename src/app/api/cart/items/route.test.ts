import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookiesMock = vi.hoisted(() => vi.fn());
const addGuestCartItem = vi.hoisted(() => vi.fn());
const updateGuestCartItem = vi.hoisted(() => vi.fn());
const removeGuestCartItem = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../../../lib/server/cart", () => ({
  addGuestCartItem,
  updateGuestCartItem,
  removeGuestCartItem,
}));

import { DELETE, PATCH, POST } from "./route";
import { CART_QUANTITY_MAX } from "../../../../lib/cart";

function request(
  body: unknown,
  options: Readonly<{
    method?: "POST" | "PATCH" | "DELETE";
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
    method: options.method ?? "POST",
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
    updateGuestCartItem.mockResolvedValue({
      ok: true,
      cart: { items: [], itemCount: 0, subtotalCents: 0 },
    });
    removeGuestCartItem.mockResolvedValue({
      ok: true,
      cart: { items: [], itemCount: 0, subtotalCents: 0 },
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

  it("updates a line through PATCH using an existing cookie without Set-Cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "existing-guest-token" });
    updateGuestCartItem.mockResolvedValueOnce({
      ok: true,
      cart: {
        items: [
          {
            variantId: "variant-s-black",
            productSlug: "camiseta-basica",
            productName: "Camiseta básica",
            imageUrl: "https://placehold.co/camiseta.png",
            size: "S",
            color: "Negro",
            unitPriceCents: 1990,
            quantity: 5,
            lineTotalCents: 9950,
          },
        ],
        itemCount: 5,
        subtotalCents: 9950,
      },
    });

    const response = await PATCH(
      request(
        { variantId: "variant-s-black", quantity: 5 },
        { method: "PATCH" },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(updateGuestCartItem).toHaveBeenCalledWith({
      guestToken: "existing-guest-token",
      variantId: "variant-s-black",
      quantity: 5,
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      cart: { itemCount: 5, subtotalCents: 9950 },
    });
  });

  it("deletes a line through DELETE and maps a missing line to 404", async () => {
    cookieStore.get.mockReturnValue({ value: "existing-guest-token" });
    removeGuestCartItem.mockResolvedValueOnce({
      ok: false,
      code: "cart_item_not_found",
    });

    const response = await DELETE(
      request({ variantId: "missing" }, { method: "DELETE" }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "La línea del carrito no existe.",
    });
    expect(removeGuestCartItem).toHaveBeenCalledWith({
      guestToken: "existing-guest-token",
      variantId: "missing",
    });
  });

  it.each([
    [{ variantId: "variant-s-black", quantity: 0 }, "PATCH"],
    [{ variantId: "variant-s-black", quantity: 1, extra: true }, "PATCH"],
    [{ variantId: "variant-s-black", extra: true }, "DELETE"],
  ])("rejects invalid %s mutation before service", async (body, method) => {
    const response =
      method === "PATCH"
        ? await PATCH(request(body, { method: "PATCH" }))
        : await DELETE(request(body, { method: "DELETE" }));

    expect(response.status).toBe(400);
    expect(updateGuestCartItem).not.toHaveBeenCalled();
    expect(removeGuestCartItem).not.toHaveBeenCalled();
  });

  it("does not create a cookie or call the service when no guest cookie exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const response = await PATCH(
      request(
        { variantId: "variant-s-black", quantity: 2 },
        { method: "PATCH" },
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(updateGuestCartItem).not.toHaveBeenCalled();
  });

  it("maps update overflow to 400 without exposing service details", async () => {
    cookieStore.get.mockReturnValue({ value: "existing-guest-token" });
    updateGuestCartItem.mockResolvedValueOnce({
      ok: false,
      code: "quantity_overflow",
    });

    const response = await PATCH(
      request(
        { variantId: "variant-s-black", quantity: 2 },
        { method: "PATCH" },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Revisa la variante y la cantidad e inténtalo de nuevo.",
    });
  });
});
