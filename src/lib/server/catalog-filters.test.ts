import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasActiveCatalogFilters,
  parseCatalogFilters,
  parseCatalogPriceCents,
} from "./catalog-filters";

const options = {
  categories: [
    { slug: "camisetas", name: "Camisetas" },
    { slug: "pantalones", name: "Pantalones" },
  ],
  sizes: ["S", "M", "L", "XL"],
  colors: ["Azul", "Blanco", "Negro"],
  minPriceCents: 1990,
  maxPriceCents: 8990,
} as const;

describe("parseCatalogPriceCents", () => {
  it("converts decimal euros to cents without floating-point rounding", () => {
    expect(parseCatalogPriceCents("19.90")).toBe(1990);
    expect(parseCatalogPriceCents("19.9")).toBe(1990);
    expect(parseCatalogPriceCents("0")).toBe(0);
  });

  it("rejects unsafe, negative, malformed, and over-precise values", () => {
    expect(parseCatalogPriceCents("-1.00")).toBeNull();
    expect(parseCatalogPriceCents("19,90")).toBeNull();
    expect(parseCatalogPriceCents("19.999")).toBeNull();
    expect(parseCatalogPriceCents("1e2")).toBeNull();
    expect(parseCatalogPriceCents("21474836.48")).toBeNull();
  });
});

describe("parseCatalogFilters", () => {
  it("normalizes a valid combination against current options", () => {
    expect(
      parseCatalogFilters(
        {
          category: " CAMISETAS ",
          size: "m",
          color: " negro ",
          minPrice: "19.90",
          maxPrice: "59.9",
        },
        options,
      ),
    ).toEqual({
      categorySlug: "camisetas",
      size: "M",
      color: "Negro",
      minPriceCents: 1990,
      maxPriceCents: 5990,
      priceRangeInvalid: false,
    });
  });

  it("ignores unknown values and duplicate params without throwing", () => {
    const filters = parseCatalogFilters(
      {
        category: ["camisetas", "pantalones"],
        size: "XXL",
        color: "",
        minPrice: "not-a-price",
        maxPrice: "8990.000",
      },
      options,
    );

    expect(filters).toEqual({
      categorySlug: null,
      size: null,
      color: null,
      minPriceCents: null,
      maxPriceCents: null,
      priceRangeInvalid: false,
    });
    expect(hasActiveCatalogFilters(filters)).toBe(false);
  });

  it("marks an inverted valid range without constructing a query", () => {
    const filters = parseCatalogFilters(
      { minPrice: "59.90", maxPrice: "19.90" },
      options,
    );

    expect(filters.minPriceCents).toBe(5990);
    expect(filters.maxPriceCents).toBe(1990);
    expect(filters.priceRangeInvalid).toBe(true);
    expect(hasActiveCatalogFilters(filters)).toBe(true);
  });

  it("rejects duplicate URLSearchParams values", () => {
    const params = new URLSearchParams("size=M&size=L&color=Negro");

    expect(parseCatalogFilters(params, options)).toMatchObject({
      size: null,
      color: "Negro",
    });
  });
});
