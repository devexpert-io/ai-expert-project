import { validateTryonFile } from "./tryon-upload";

export const TRYON_BODY_LIMIT = 6 * 1024 * 1024;

export const TRYON_STATUS_GENERATING = "Generando la prueba virtual…";
export const TRYON_RESULT_ALT =
  "Resultado de la prueba virtual: la prenda sobre tu foto";
export const TRYON_APPROXIMATION_NOTICE =
  "Esta imagen es una aproximación generada, no un encaje real.";

export const TRYON_ERROR_CONSENT =
  "Debes aceptar el aviso para generar la prueba virtual.";
export const TRYON_ERROR_PRODUCT =
  "Ese producto no está disponible para la prueba virtual.";
export const TRYON_ERROR_REQUEST =
  "Revisa la foto, el consentimiento y el producto e inténtalo de nuevo.";
export const TRYON_ERROR_BODY = "La petición supera el máximo permitido.";
export const TRYON_UNAVAILABLE =
  "La prueba virtual no está disponible temporalmente. Inténtalo de nuevo.";

export const TRYON_ALLOWED_FIELDS = [
  "photo",
  "productSlug",
  "consent",
  "size",
  "color",
] as const;

const ALLOWED_FIELDS = new Set<string>(TRYON_ALLOWED_FIELDS);
const DATA_URL_PATTERN = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type TryonResponse =
  | { ok: true; imageDataUrl: string }
  | { ok: false; message: string };

export type TryonRequestInput = Readonly<{
  photo: File;
  productSlug: string;
  consent: true;
  size: string | null;
  color: string | null;
}>;

export type TryonFormParse =
  | { ok: true; value: TryonRequestInput }
  | { ok: false; message: string };

export function isTryonImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && DATA_URL_PATTERN.test(value);
}

export function buildTryonImageDataUrl(b64Json: string): string | null {
  if (!b64Json || !BASE64_PATTERN.test(b64Json)) {
    return null;
  }

  const mime = b64Json.startsWith("/9j/") ? "image/jpeg" : "image/png";
  const imageDataUrl = `data:${mime};base64,${b64Json}`;
  return isTryonImageDataUrl(imageDataUrl) ? imageDataUrl : null;
}

function optionalField(
  value: FormDataEntryValue | null,
): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseTryonFormData(formData: FormData): TryonFormParse {
  const keys = [...formData.keys()];

  if (keys.some((key) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, message: TRYON_ERROR_REQUEST };
  }

  for (const key of new Set(keys)) {
    if (formData.getAll(key).length > 1) {
      return { ok: false, message: TRYON_ERROR_REQUEST };
    }
  }

  const photo = formData.get("photo");
  const productSlug = optionalField(formData.get("productSlug"));
  const consent = formData.get("consent");
  const size = optionalField(formData.get("size"));
  const color = optionalField(formData.get("color"));

  if (consent !== "true") {
    return { ok: false, message: TRYON_ERROR_CONSENT };
  }

  if (productSlug === undefined || productSlug === null) {
    return { ok: false, message: TRYON_ERROR_PRODUCT };
  }

  if (size === undefined || color === undefined) {
    return { ok: false, message: TRYON_ERROR_REQUEST };
  }

  if (!(photo instanceof File)) {
    return { ok: false, message: TRYON_ERROR_REQUEST };
  }

  const fileResult = validateTryonFile(photo);
  if (!fileResult.ok) {
    return fileResult;
  }

  return {
    ok: true,
    value: {
      photo,
      productSlug,
      consent: true,
      size,
      color,
    },
  };
}
