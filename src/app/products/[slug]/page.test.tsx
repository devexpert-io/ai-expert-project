import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductDetailBySlug = vi.hoisted(() => vi.fn());
const parseProductSelection = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../../../lib/server/product-detail", () => ({
  getProductDetailBySlug,
  parseProductSelection,
}));
vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    sizes,
    alt,
    ...props
  }: {
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    src: string;
  }) => {
    void fill;
    void priority;
    void sizes;
    return createElement("img", { ...props, alt });
  },
}));

import ProductPage from "./page";

const product = {
  id: "product-1",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  description: "Camiseta de algodón suave.",
  imageUrl: "https://placehold.co/image.png",
  basePriceCents: 1990,
  categoryName: "Camisetas",
  variants: [
    {
      id: "variant-s-black",
      size: "S",
      color: "Negro",
      stock: 12,
      priceCents: 1990,
    },
  ],
};

describe("ProductPage", () => {
  beforeEach(() => {
    getProductDetailBySlug.mockReset();
    parseProductSelection.mockReset();
    notFound.mockClear();
  });

  it("loads the slug, parses the query, and renders the detail", async () => {
    getProductDetailBySlug.mockResolvedValue(product);
    parseProductSelection.mockReturnValue({
      size: "S",
      color: "Negro",
      variant: product.variants[0],
      hasInvalidValue: false,
      hasInvalidCombination: false,
    });
    const searchParams = { size: "S", color: "Negro" };

    render(
      await ProductPage({
        params: Promise.resolve({ slug: "camiseta-basica" }),
        searchParams: Promise.resolve(searchParams),
      }),
    );

    expect(getProductDetailBySlug).toHaveBeenCalledWith("camiseta-basica");
    expect(parseProductSelection).toHaveBeenCalledWith(
      searchParams,
      product.variants,
    );
    expect(screen.getByRole("heading", { name: "Camiseta básica" }))
      .toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Disponible · 12 unidades",
    );
  });

  it("delegates an unknown or invalid slug to notFound", async () => {
    getProductDetailBySlug.mockResolvedValue(null);

    await expect(
      ProductPage({ params: Promise.resolve({ slug: "no-existe" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    expect(parseProductSelection).not.toHaveBeenCalled();
  });
});
