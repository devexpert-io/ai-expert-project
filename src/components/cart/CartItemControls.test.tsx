import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { CartItemControls } from "./CartItemControls";

const success = {
  ok: true,
  cart: { items: [], itemCount: 0, subtotalCents: 0 },
};

describe("CartItemControls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends PATCH and refreshes the server snapshot after update", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => success,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CartItemControls
        productName="Camiseta básica"
        quantity={2}
        variantId="variant-s-black"
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cantidad" }), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        body: JSON.stringify({ variantId: "variant-s-black", quantity: 5 }),
      }),
    );
  });

  it("sends DELETE and announces a safe API error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: "La línea del carrito no existe." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CartItemControls
        productName="Camiseta básica"
        quantity={2}
        variantId="variant-s-black"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "La línea del carrito no existe.",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ variantId: "variant-s-black" }),
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects an invalid quantity locally", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CartItemControls
        productName="Camiseta básica"
        quantity={2}
        variantId="variant-s-black"
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cantidad" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa la variante y la cantidad",
    );
  });
});
