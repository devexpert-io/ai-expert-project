export const CART_BODY_LIMIT = 8 * 1024;
export const CART_QUANTITY_MAX = 2_147_483_647;

export const CART_COOKIE_NAME = "cart_guest_token";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const CART_ERROR_INVALID =
  "Revisa la variante y la cantidad e inténtalo de nuevo.";
export const CART_ERROR_BODY = "La petición supera el máximo permitido.";
export const CART_ERROR_NOT_FOUND = "La variante no existe.";
export const CART_ERROR_ITEM_NOT_FOUND = "La línea del carrito no existe.";
export const CART_ERROR_SOLD_OUT = "Esa variante está agotada.";
export const CART_UNAVAILABLE =
  "El carrito no está disponible temporalmente. Inténtalo de nuevo.";

export type CartAddInput = Readonly<{
  variantId: string;
  quantity: number;
}>;

export type CartAddSuccess = Readonly<{
  ok: true;
  item: Readonly<{
    variantId: string;
    quantity: number;
  }>;
  itemCount: number;
}>;

export type CartErrorResponse = Readonly<{
  ok: false;
  message: string;
}>;

export type CartAddResponse = CartAddSuccess | CartErrorResponse;

export type CartLine = Readonly<{
  variantId: string;
  productSlug: string;
  productName: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}>;

export type CartView = Readonly<{
  items: readonly CartLine[];
  itemCount: number;
  subtotalCents: number;
}>;

export type CartUpdateInput = Readonly<{
  variantId: string;
  quantity: number;
}>;

export type CartRemoveInput = Readonly<{
  variantId: string;
}>;

export type CartMutationSuccess = Readonly<{
  ok: true;
  cart: CartView;
}>;

export type CartMutationResponse = CartMutationSuccess | CartErrorResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses the intentionally small public contract for adding a cart item.
 * Keeping this parser independent from Prisma lets the route reject untrusted
 * input before a transaction is opened.
 */
export function parseCartAddInput(value: unknown): CartAddInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("variantId") ||
    !keys.includes("quantity")
  ) {
    return null;
  }

  if (typeof value.variantId !== "string") {
    return null;
  }

  const variantId = value.variantId.trim();
  if (!variantId) {
    return null;
  }

  if (
    typeof value.quantity !== "number" ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > CART_QUANTITY_MAX
  ) {
    return null;
  }

  return { variantId, quantity: value.quantity };
}

/**
 * Parses the closed PATCH contract used to replace one cart line quantity.
 * It intentionally mirrors the add contract so the server remains the only
 * source of prices, product data and guest identity.
 */
export function parseCartUpdateInput(value: unknown): CartUpdateInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("variantId") ||
    !keys.includes("quantity")
  ) {
    return null;
  }

  if (typeof value.variantId !== "string") {
    return null;
  }

  const variantId = value.variantId.trim();
  if (!variantId) {
    return null;
  }

  if (
    typeof value.quantity !== "number" ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > CART_QUANTITY_MAX
  ) {
    return null;
  }

  return { variantId, quantity: value.quantity };
}

/** Parses the closed DELETE contract used to remove one cart line. */
export function parseCartRemoveInput(value: unknown): CartRemoveInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || !keys.includes("variantId")) {
    return null;
  }

  if (typeof value.variantId !== "string") {
    return null;
  }

  const variantId = value.variantId.trim();
  return variantId ? { variantId } : null;
}
