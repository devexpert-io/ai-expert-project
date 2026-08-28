import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CatalogFilterOptions,
  CatalogFilterState,
} from "../../lib/server/catalog-filters";

import CatalogFilters from "./CatalogFilters";

const options: CatalogFilterOptions = {
  categories: [
    { slug: "camisetas", name: "Camisetas" },
    { slug: "pantalones", name: "Pantalones" },
  ],
  sizes: ["M", "L"],
  colors: ["Negro", "Azul"],
  minPriceCents: 1990,
  maxPriceCents: 8990,
};

const filters: CatalogFilterState = {
  categorySlug: "camisetas",
  size: "M",
  color: "Negro",
  minPriceCents: 1990,
  maxPriceCents: 5990,
  priceRangeInvalid: false,
};

describe("CatalogFilters", () => {
  it("renders a native GET form with selected accessible controls", () => {
    render(
      <CatalogFilters filters={filters} options={options} resultCount={2} />,
    );

    const form = screen.getByRole("button", { name: "Aplicar filtros" })
      .closest("form");

    expect(form).toHaveAttribute("action", "/");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("Categoría")).toHaveValue("camisetas");
    expect(screen.getByRole("radio", { name: "M" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Negro" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Mínimo" })).toHaveValue(
      19.9,
    );
    expect(screen.getByRole("spinbutton", { name: "Máximo" })).toHaveValue(
      59.9,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 productos");
    expect(screen.getByRole("link", { name: "Limpiar filtros" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("explains an invalid range accessibly", () => {
    render(
      <CatalogFilters
        filters={{ ...filters, priceRangeInvalid: true }}
        options={options}
        resultCount={0}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El precio mínimo no puede superar al máximo.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Corrige el rango de precio",
    );
  });
});
