import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartAddForm } from "./CartAddForm";

describe("CartAddForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the selected variant and quantity and announces the accumulated result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        item: { variantId: "variant-s-black", quantity: 3 },
        itemCount: 3,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CartAddForm variantId="variant-s-black" />);
    expect(screen.getByRole("spinbutton", { name: "Cantidad" })).toHaveAttribute(
      "max",
      "2147483647",
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cantidad" }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Añadir al carrito" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Añadido al carrito · 3 unidades de esta variante · 3 en total",
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: "variant-s-black", quantity: 2 }),
      }),
    );
  });

  it("keeps invalid quantities client-side and exposes an accessible error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CartAddForm variantId="variant-s-black" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cantidad" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Añadir al carrito" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa la variante y la cantidad",
    );
  });

  it("shows a safe API error without exposing implementation details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          ok: false,
          message: "Esa variante está agotada.",
        }),
      }),
    );

    render(<CartAddForm variantId="variant-m-black" />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir al carrito" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Esa variante está agotada.",
      ),
    );
    expect(screen.queryByText(/Prisma|database details/iu)).not.toBeInTheDocument();
  });
});
