import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCatalogProducts = vi.hoisted(() => vi.fn());
const getCatalogFilterOptions = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("../lib/server/catalog", () => ({
  getCatalogFilterOptions,
  getCatalogProducts,
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

import Home from "./page";

describe("Home", () => {
  it("renderiza el catálogo con los productos del servicio server-side", async () => {
    getCatalogFilterOptions.mockResolvedValue({
      categories: [{ slug: "camisetas", name: "Camisetas" }],
      sizes: ["M"],
      colors: ["Negro"],
      minPriceCents: 1990,
      maxPriceCents: 8990,
    });
    getCatalogProducts.mockResolvedValue([
      {
        id: "product-1",
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
        basePriceCents: 1990,
        categoryName: "Camisetas",
        sizes: ["S", "M", "L", "XL"],
        colors: ["Negro", "Blanco", "Azul"],
      },
    ]);

    render(await Home({}));

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Nueva temporada",
    );
    expect(
      screen.getByRole("heading", { name: "Filtrar catálogo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("name");
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver Camiseta básica" }),
    ).toHaveAttribute("href", "/products/camiseta-basica");
    expect(getCatalogProducts).toHaveBeenCalledWith(
      {
        categorySlug: null,
        size: null,
        color: null,
        minPriceCents: null,
        maxPriceCents: null,
        priceRangeInvalid: false,
      },
      "name",
    );
  });

  it("reads the URL filters and keeps the selected controls", async () => {
    getCatalogFilterOptions.mockResolvedValue({
      categories: [{ slug: "camisetas", name: "Camisetas" }],
      sizes: ["M"],
      colors: ["Negro"],
      minPriceCents: 1990,
      maxPriceCents: 8990,
    });
    getCatalogProducts.mockResolvedValue([]);

    render(
      await Home({
        searchParams: Promise.resolve({
          category: "camisetas",
          size: "M",
          color: "Negro",
          minPrice: "19.90",
          maxPrice: "59.90",
          sort: "price-desc",
        }),
      }),
    );

    expect(screen.getByLabelText("Categoría")).toHaveValue("camisetas");
    expect(screen.getByLabelText("Ordenar por")).toHaveValue("price-desc");
    expect(screen.getByRole("radio", { name: "M" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Negro" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Mínimo" })).toHaveValue(19.9);
    expect(screen.getByRole("spinbutton", { name: "Máximo" })).toHaveValue(59.9);
    expect(screen.getByText(/No encontramos productos/)).toBeInTheDocument();
    expect(getCatalogProducts).toHaveBeenCalledWith(
      {
        categorySlug: "camisetas",
        size: "M",
        color: "Negro",
        minPriceCents: 1990,
        maxPriceCents: 5990,
        priceRangeInvalid: false,
      },
      "price-desc",
    );
  });

  it("shows an inverted-range validation state without querying results", async () => {
    getCatalogFilterOptions.mockResolvedValue({
      categories: [],
      sizes: [],
      colors: [],
      minPriceCents: 1990,
      maxPriceCents: 8990,
    });
    getCatalogProducts.mockReset();

    render(
      await Home({
        searchParams: Promise.resolve({
          minPrice: "59.90",
          maxPrice: "19.90",
        }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El precio mínimo no puede superar al máximo.",
    );
    expect(
      screen.getByText("Corrige el rango de precio para ver resultados.", {
        exact: true,
      }),
    ).toBeInTheDocument();
    expect(getCatalogProducts).not.toHaveBeenCalled();
  });
});
