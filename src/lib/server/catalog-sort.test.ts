import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CATALOG_SORT_OPTIONS,
  parseCatalogSort,
} from "./catalog-sort";

describe("parseCatalogSort", () => {
  it("uses name as the default and exposes the documented options", () => {
    expect(parseCatalogSort({})).toBe("name");
    expect(CATALOG_SORT_OPTIONS.map((option) => option.value)).toEqual([
      "name",
      "price-asc",
      "price-desc",
      "newest",
    ]);
  });

  it("accepts each known scalar sort value", () => {
    expect(parseCatalogSort({ sort: "name" })).toBe("name");
    expect(parseCatalogSort({ sort: "price-asc" })).toBe("price-asc");
    expect(parseCatalogSort({ sort: "price-desc" })).toBe("price-desc");
    expect(parseCatalogSort({ sort: "newest" })).toBe("newest");
  });

  it("falls back to name for empty, duplicate, or unknown values", () => {
    expect(parseCatalogSort({ sort: "" })).toBe("name");
    expect(parseCatalogSort({ sort: "unknown" })).toBe("name");
    expect(parseCatalogSort({ sort: ["price-asc", "newest"] })).toBe("name");
    expect(
      parseCatalogSort(new URLSearchParams("sort=price-asc&sort=newest")),
    ).toBe("name");
  });

  it("does not throw for non-string input", () => {
    expect(parseCatalogSort({ sort: undefined })).toBe("name");
  });
});
