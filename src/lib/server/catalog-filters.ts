import "server-only";

export const MAX_PRICE_CENTS = 2_147_483_647;

export type CatalogCategoryOption = Readonly<{
  slug: string;
  name: string;
}>;

export type CatalogFilterOptions = Readonly<{
  categories: readonly CatalogCategoryOption[];
  sizes: readonly string[];
  colors: readonly string[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
}>;

export type CatalogFilterState = Readonly<{
  categorySlug: string | null;
  size: string | null;
  color: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  priceRangeInvalid: boolean;
}>;

export type CatalogSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

type SearchParamsInput = CatalogSearchParams | URLSearchParams;

function getScalarParam(
  params: SearchParamsInput,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    const values = params.getAll(key);
    return values.length === 1 ? values[0] : null;
  }

  const value = params[key];
  return typeof value === "string" ? value : null;
}

function normalizeOption(value: string): string {
  return value.trim().toLowerCase();
}

function findOption(
  value: string | null,
  options: readonly string[],
): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    options.find((option) => normalizeOption(option) === normalizedValue) ??
    null
  );
}

function findCategory(
  value: string | null,
  options: readonly CatalogCategoryOption[],
): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    options.find((option) => normalizeOption(option.slug) === normalizedValue)
      ?.slug ?? null
  );
}

/** Parse an URL price into integer cents without floating-point arithmetic. */
export function parseCatalogPriceCents(value: string): number | null {
  const normalizedValue = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalizedValue);

  if (!match) {
    return null;
  }

  const eurosText = match[1].replace(/^0+(?=\d)/, "");
  const maximumEurosDigits = String(Math.floor(MAX_PRICE_CENTS / 100)).length;

  if (eurosText.length > maximumEurosDigits) {
    return null;
  }

  const euros = BigInt(eurosText);
  const decimal = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const cents = euros * BigInt(100) + decimal;
  const maxPriceCents = BigInt(MAX_PRICE_CENTS);

  if (cents > maxPriceCents) {
    return null;
  }

  return Number(cents);
}

export function parseCatalogFilters(
  params: SearchParamsInput,
  options: CatalogFilterOptions,
): CatalogFilterState {
  const minPriceValue = getScalarParam(params, "minPrice");
  const maxPriceValue = getScalarParam(params, "maxPrice");
  const minPriceCents =
    minPriceValue === null ? null : parseCatalogPriceCents(minPriceValue);
  const maxPriceCents =
    maxPriceValue === null ? null : parseCatalogPriceCents(maxPriceValue);

  return {
    categorySlug: findCategory(
      getScalarParam(params, "category"),
      options.categories,
    ),
    size: findOption(getScalarParam(params, "size"), options.sizes),
    color: findOption(getScalarParam(params, "color"), options.colors),
    minPriceCents,
    maxPriceCents,
    priceRangeInvalid:
      minPriceCents !== null &&
      maxPriceCents !== null &&
      minPriceCents > maxPriceCents,
  };
}

export function hasActiveCatalogFilters(
  filters: CatalogFilterState,
): boolean {
  return (
    filters.categorySlug !== null ||
    filters.size !== null ||
    filters.color !== null ||
    filters.minPriceCents !== null ||
    filters.maxPriceCents !== null ||
    filters.priceRangeInvalid
  );
}
