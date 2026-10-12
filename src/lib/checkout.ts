export const CHECKOUT_DRAFT_STORAGE_KEY = "checkout_draft_v1";

export const CHECKOUT_DRAFT_LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  shippingAddress: 500,
} as const;

export type CheckoutDraft = Readonly<{
  name: string;
  email: string;
  phone: string;
  shippingAddress: string;
}>;

export type CheckoutDraftField = keyof CheckoutDraft;
export type CheckoutDraftErrors = Partial<
  Record<CheckoutDraftField, string>
>;

const CHECKOUT_DRAFT_FIELDS: readonly CheckoutDraftField[] = [
  "name",
  "email",
  "phone",
  "shippingAddress",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.trim();
}

/** Normalizes only presentation whitespace; the browser never supplies prices or identity. */
export function normalizeCheckoutDraft(value: CheckoutDraft): CheckoutDraft {
  return {
    name: normalizeText(value.name).replace(/\s+/gu, " "),
    email: normalizeText(value.email).toLowerCase(),
    phone: normalizeText(value.phone).replace(/\s+/gu, " "),
    shippingAddress: normalizeText(value.shippingAddress).replace(
      /\r\n?/gu,
      "\n",
    ),
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value);
}

function isPhone(value: string): boolean {
  const digits = value.replace(/\D/gu, "");
  return digits.length >= 6 && /^[0-9+().\-\s]+$/u.test(value);
}

/** Returns safe Spanish field messages without echoing personal data. */
export function validateCheckoutDraft(
  value: CheckoutDraft,
): CheckoutDraftErrors {
  const draft = normalizeCheckoutDraft(value);
  const errors: CheckoutDraftErrors = {};

  if (!draft.name) {
    errors.name = "Escribe tu nombre.";
  } else if (draft.name.length > CHECKOUT_DRAFT_LIMITS.name) {
    errors.name = `El nombre no puede superar ${CHECKOUT_DRAFT_LIMITS.name} caracteres.`;
  }

  if (!draft.email) {
    errors.email = "Escribe tu email.";
  } else if (
    draft.email.length > CHECKOUT_DRAFT_LIMITS.email ||
    !isEmail(draft.email)
  ) {
    errors.email = "Introduce un email válido.";
  }

  if (!draft.phone) {
    errors.phone = "Escribe tu teléfono.";
  } else if (
    draft.phone.length > CHECKOUT_DRAFT_LIMITS.phone ||
    !isPhone(draft.phone)
  ) {
    errors.phone = "Introduce un teléfono válido.";
  }

  if (!draft.shippingAddress) {
    errors.shippingAddress = "Escribe una dirección de envío.";
  } else if (draft.shippingAddress.length > CHECKOUT_DRAFT_LIMITS.shippingAddress) {
    errors.shippingAddress = `La dirección no puede superar ${CHECKOUT_DRAFT_LIMITS.shippingAddress} caracteres.`;
  }

  return errors;
}

export function isValidCheckoutDraft(value: CheckoutDraft): boolean {
  return Object.keys(validateCheckoutDraft(value)).length === 0;
}

/**
 * Parses the versioned draft contract. It accepts a decoded object or the
 * sessionStorage JSON string and rejects missing, malformed and extra fields.
 */
export function parseCheckoutDraft(value: unknown): CheckoutDraft | null {
  let candidate: unknown = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(candidate)) {
    return null;
  }

  const keys = Object.keys(candidate);
  if (
    keys.length !== CHECKOUT_DRAFT_FIELDS.length ||
    keys.some((key) => !CHECKOUT_DRAFT_FIELDS.includes(key as CheckoutDraftField))
  ) {
    return null;
  }

  if (CHECKOUT_DRAFT_FIELDS.some((field) => typeof candidate[field] !== "string")) {
    return null;
  }

  const draft = normalizeCheckoutDraft(candidate as CheckoutDraft);
  return isValidCheckoutDraft(draft) ? draft : null;
}

export function serializeCheckoutDraft(value: CheckoutDraft): string | null {
  const draft = normalizeCheckoutDraft(value);
  return isValidCheckoutDraft(draft) ? JSON.stringify(draft) : null;
}
