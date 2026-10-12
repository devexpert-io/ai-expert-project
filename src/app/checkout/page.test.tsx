import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const getGuestCart = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../lib/server/cart", () => ({ getGuestCart }));
vi.mock("next/image", () => ({
  default: ({ fill, priority, sizes, ...props }: { fill?: boolean; priority?: boolean; sizes?: string }) => {
    void fill;
    void priority;
    void sizes;
    return createElement("img", props);
  },
}));

import CheckoutPage from "./page";

const cart = {
  items: [
    {
      variantId: "variant-s-black",
      productSlug: "camiseta-basica",
      productName: "Camiseta básica",
      imageUrl: "https://placehold.co/camiseta.png",
      size: "S",
      color: "Negro",
      unitPriceCents: 1990,
      quantity: 2,
      lineTotalCents: 3980,
    },
  ],
  itemCount: 2,
  subtotalCents: 3980,
} as const;

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    cookiesMock.mockResolvedValue(cookieStore);
    getGuestCart.mockResolvedValue(cart);
  });

  it("renders a safe empty state without a guest cookie or form", async () => {
    render(await CheckoutPage());

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No hay nada que revisar");
    expect(screen.getByRole("link", { name: "Ir al carrito" })).toHaveAttribute(
      "href",
      "/cart",
    );
    expect(screen.queryByRole("button", { name: "Guardar datos" })).not.toBeInTheDocument();
    expect(getGuestCart).not.toHaveBeenCalled();
  });

  it("reads the guest snapshot server-side and renders the exact review", async () => {
    cookieStore.get.mockReturnValue({ value: "guest-token" });
    render(await CheckoutPage());

    expect(getGuestCart).toHaveBeenCalledWith("guest-token");
    expect(screen.getByRole("heading", { name: "Resumen del carrito" })).toBeInTheDocument();
    expect(screen.getByText(/Talla S.*Negro.*2 unidades/u)).toBeInTheDocument();
    expect(screen.getByText(/19,90.*por unidad.*39,80/u)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prepara tu envío" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar datos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Dirección de envío")).toHaveAttribute(
      "autocomplete",
      "shipping street-address",
    );
  });
});
