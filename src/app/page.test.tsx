import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCatalogProducts = vi.hoisted(() => vi.fn());

vi.mock("../lib/server/catalog", () => ({
  getCatalogProducts,
}));
vi.mock("next/image", () => ({
  default: ({
    fill,
    sizes,
    alt,
    ...props
  }: {
    alt: string;
    className?: string;
    fill?: boolean;
    sizes?: string;
    src: string;
  }) => {
    void fill;
    void sizes;
    return createElement("img", { ...props, alt });
  },
}));

import Home from "./page";

describe("Home", () => {
  it("renderiza el catálogo con los productos del servicio server-side", async () => {
    getCatalogProducts.mockResolvedValue([
      {
        id: "product-1",
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
        basePriceCents: 1990,
        categoryName: "Camisetas",
      },
    ]);

    render(await Home());

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Catálogo",
    );
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
  });
});
