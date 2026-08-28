import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import CatalogGrid from "./CatalogGrid";

const products = [
  {
    id: "product-1",
    slug: "camiseta-basica",
    name: "Camiseta básica",
    imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
    basePriceCents: 1990,
    categoryName: "Camisetas",
  },
  {
    id: "product-2",
    slug: "abrigo-ligero",
    name: "Abrigo ligero",
    imageUrl: "https://placehold.co/800x1000/png?text=abrigo-ligero",
    basePriceCents: 8990,
    categoryName: "Abrigos",
  },
] as const;

describe("CatalogGrid", () => {
  it("renders semantic cards with accessible images and EUR prices", () => {
    render(<CatalogGrid products={products} />);

    expect(
      screen.getByRole("list", { name: "Productos del catálogo" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Camiseta básica", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText(/19,90\s*€/u)).toBeInTheDocument();
    expect(screen.getByText(/89,90\s*€/u)).toBeInTheDocument();
    expect(screen.getByAltText("Imagen de Camiseta básica")).toHaveAttribute(
      "src",
      products[0].imageUrl,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ver Camiseta básica" }),
    ).toHaveAttribute("href", "/products/camiseta-basica");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders an accessible empty state without an unexplained list", () => {
    render(<CatalogGrid products={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay productos disponibles ahora mismo.",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
