export const PAYMENT_BODY_LIMIT = 8 * 1024;
export const PAYMENT_KEY_MAX_LENGTH = 128;

export const PAYMENT_ERROR_INVALID = "Revisa el pago e inténtalo de nuevo.";
export const PAYMENT_ERROR_AUTH = "Inicia sesión para pagar.";
export const PAYMENT_ERROR_EMPTY = "No hay artículos disponibles para pagar.";
export const PAYMENT_ERROR_STOCK =
  "El stock ha cambiado. Revisa el carrito e inténtalo de nuevo.";
export const PAYMENT_ERROR_UNAVAILABLE =
  "El pago no está disponible temporalmente. Inténtalo de nuevo.";
export const PAYMENT_REJECTED_NOTICE =
  "Pago simulado — no se ha realizado ningún cargo.";

export type PaymentOutcome = "approved" | "rejected";

export type PaymentInput = Readonly<{
  outcome: PaymentOutcome;
}>;

export type PaymentSuccessResponse = Readonly<{
  ok: true;
  outcome: PaymentOutcome;
  orderId: string;
  orderStatus: "PAID" | "CANCELLED";
  totalCents: number;
}>;

export type PaymentErrorResponse = Readonly<{
  ok: false;
  message: string;
}>;

export type PaymentResponse = PaymentSuccessResponse | PaymentErrorResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePaymentInput(value: unknown): PaymentInput | null {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "outcome")) {
    return null;
  }

  return value.outcome === "approved" || value.outcome === "rejected"
    ? { outcome: value.outcome }
    : null;
}

/** Idempotency keys are opaque visible ASCII tokens; whitespace is rejected. */
export function parseIdempotencyKey(value: string | null): string | null {
  if (
    value === null ||
    value.length < 1 ||
    value.length > PAYMENT_KEY_MAX_LENGTH ||
    !/^[\x21-\x7e]+$/u.test(value)
  ) {
    return null;
  }

  return value;
}

