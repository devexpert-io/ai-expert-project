import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const getGuestCart = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../../lib/server/cart", () => ({ getGuestCart }));
vi.mock("next/image", () => ({
  default: ({ fill, priority, sizes, ...props }: { fill?: boolean; priority?: boolean; sizes?: string }) => {
    void fill;
    void priority;
    void sizes;
    return createElement("img", props);
  },
}));

import CartPage from "./page";

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
    {
      variantId: "variant-m-blue",
      productSlug: "camiseta-basica",
      productName: "Camiseta básica",
      imageUrl: "https://placehold.co/camiseta.png",
      size: "M",
      color: "Azul",
      unitPriceCents: 2490,
      quantity: 1,
      lineTotalCents: 2490,
    },
  ],
  itemCount: 3,
  subtotalCents: 6470,
} as const;

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue(undefined);
    cookiesMock.mockResolvedValue(cookieStore);
    getGuestCart.mockResolvedValue(cart);
  });

  it("shows an accessible empty state without a guest cookie or database read", async () => {
    render(await CartPage());

    expect(screen.getByRole("heading", { name: "Tu carrito" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Tu carrito está vacío");
    expect(screen.getByRole("link", { name: "Explorar catálogo" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(getGuestCart).not.toHaveBeenCalled();
  });

  it("renders each line, variant link, exact prices and summary from the server snapshot", async () => {
    cookieStore.get.mockReturnValue({ value: "guest-token" });
    render(await CartPage());

    expect(getGuestCart).toHaveBeenCalledWith("guest-token");
    expect(screen.getByRole("heading", { name: "Variantes guardadas" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Ver Camiseta básica" })).toHaveLength(2);
    expect(screen.getByText(/Talla S.*Negro.*19,90.*por unidad/u)).toBeInTheDocument();
    expect(screen.getByText(/39,80/u)).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Resumen del carrito" })).toHaveTextContent(
      /64,70/u,
    );
    expect(screen.getAllByRole("link", { name: "Ver Camiseta básica" })[0]).toHaveAttribute(
      "href",
      "/products/camiseta-basica?size=S&color=Negro",
    );
  });
});
