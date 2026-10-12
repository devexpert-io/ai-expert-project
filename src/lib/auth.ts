import {
  normalizeCheckoutDraft,
  validateCheckoutDraft,
} from "./checkout";

export const AUTH_BODY_LIMIT = 8 * 1024;
export const AUTH_COOKIE_NAME = "auth_session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export const AUTH_ERROR_INVALID = "Revisa los datos e inténtalo de nuevo.";
export const AUTH_ERROR_BODY = "La petición supera el máximo permitido.";
export const AUTH_ERROR_DUPLICATE = "Ya existe una cuenta con ese email.";
export const AUTH_ERROR_CREDENTIALS =
  "El email o la contraseña no son correctos.";
export const AUTH_ERROR_ACTIVE_SESSION =
  "Cierra la sesión actual antes de cambiar de cuenta.";
export const AUTH_ERROR_MERGE_OVERFLOW =
  "No se puede combinar el carrito porque una cantidad es demasiado grande.";
export const AUTH_ERROR_UNAVAILABLE =
  "No se ha podido iniciar sesión temporalmente. Inténtalo de nuevo.";

export type AuthMode = "register" | "login";

export type AuthInput = Readonly<{
  mode: AuthMode;
  email: string;
  password: string;
  name: string;
  phone: string;
  shippingAddress: string;
}>;

export type AuthInputErrors = Readonly<{
  mode?: string;
  password?: string;
  name?: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).byteLength;
}

export function validatePassword(password: string): string | undefined {
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    return "La contraseña es demasiado larga.";
  }

  return undefined;
}

export function normalizeAuthInput(value: AuthInput): AuthInput {
  const draft = normalizeCheckoutDraft({
    name: value.name,
    email: value.email,
    phone: value.phone,
    shippingAddress: value.shippingAddress,
  });

  return {
    mode: value.mode,
    email: draft.email,
    password: value.password,
    name: draft.name,
    phone: draft.phone,
    shippingAddress: draft.shippingAddress,
  };
}

/**
 * Validates the closed checkout-auth contract before any database work. The
 * password is intentionally returned only in memory and is never part of the
 * checkout draft persisted by the browser.
 */
export function validateAuthInput(value: unknown): AuthInputErrors {
  if (!isRecord(value)) {
    return { mode: AUTH_ERROR_INVALID };
  }

  const keys = Object.keys(value);
  const expected = [
    "mode",
    "email",
    "password",
    "name",
    "phone",
    "shippingAddress",
  ] as const;

  if (
    keys.length !== expected.length ||
    keys.some((key) => !expected.includes(key as (typeof expected)[number]))
  ) {
    return { mode: AUTH_ERROR_INVALID };
  }

  if (
    (value.mode !== "register" && value.mode !== "login") ||
    typeof value.email !== "string" ||
    typeof value.password !== "string" ||
    typeof value.name !== "string" ||
    typeof value.phone !== "string" ||
    typeof value.shippingAddress !== "string"
  ) {
    return { mode: AUTH_ERROR_INVALID };
  }

  const input = normalizeAuthInput({
    mode: value.mode,
    email: value.email,
    password: value.password,
    name: value.name,
    phone: value.phone,
    shippingAddress: value.shippingAddress,
  });
  const draftErrors = validateCheckoutDraft({
    name: input.name,
    email: input.email,
    phone: input.phone,
    shippingAddress: input.shippingAddress,
  });
  const passwordError = validatePassword(input.password);

  return {
    ...draftErrors,
    ...(passwordError ? { password: passwordError } : {}),
  };
}

export function parseAuthInput(value: unknown): AuthInput | null {
  const errors = validateAuthInput(value);
  if (Object.keys(errors).length > 0 || !isRecord(value)) {
    return null;
  }

  return normalizeAuthInput({
    mode: value.mode as AuthMode,
    email: value.email as string,
    password: value.password as string,
    name: value.name as string,
    phone: value.phone as string,
    shippingAddress: value.shippingAddress as string,
  });
}

export type AuthSuccessResponse = Readonly<{ ok: true }>;
export type AuthErrorResponse = Readonly<{ ok: false; message: string }>;
export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

export function serializeAuthCookie(
  token: string,
  secure = process.env.NODE_ENV === "production",
): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function serializeExpiredAuthCookie(
  secure = process.env.NODE_ENV === "production",
): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
