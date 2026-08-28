import "server-only";

export const CATALOG_SORT_OPTIONS = [
  { value: "name", label: "Nombre (A-Z)" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "newest", label: "Novedades" },
] as const;

export type CatalogSort = (typeof CATALOG_SORT_OPTIONS)[number]["value"];

type SortSearchParams =
  | Readonly<Record<string, string | string[] | undefined>>
  | URLSearchParams;

function getScalarSortParam(params: SortSearchParams): string | null {
  if (params instanceof URLSearchParams) {
    const values = params.getAll("sort");
    return values.length === 1 ? values[0] : null;
  }

  const value = params.sort;
  return typeof value === "string" ? value : null;
}

function isCatalogSort(value: string): value is CatalogSort {
  return CATALOG_SORT_OPTIONS.some((option) => option.value === value);
}

export function parseCatalogSort(params: SortSearchParams): CatalogSort {
  const value = getScalarSortParam(params)?.trim() ?? "";

  return isCatalogSort(value) ? value : "name";
}
