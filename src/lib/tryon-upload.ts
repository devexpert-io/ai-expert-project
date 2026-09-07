export const TRYON_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const TRYON_MAX_BYTES = 5 * 1024 * 1024;
export const TRYON_ACCEPT = TRYON_ALLOWED_MIME_TYPES.join(",");

export const TRYON_ERROR_TYPE = "Usa una foto JPG, PNG o WebP.";
export const TRYON_ERROR_SIZE = "La foto supera el máximo de 5 MB.";
export const TRYON_ERROR_INVALID = "Esa imagen no es válida.";

export const TRYON_PRIVACY_NOTICE =
  "Tu foto es un dato personal. Se enviará a inference.devexpert.io para la prueba virtual y no se guarda en la tienda.";
export const TRYON_CONSENT_LABEL =
  "Entiendo que mi foto se enviará al proveedor de IA";
export const TRYON_FILE_LABEL = "Elige una foto";
export const TRYON_PREVIEW_ALT = "Vista previa de tu foto para la prueba virtual";
export const TRYON_CLEAR_LABEL = "Quitar foto";
export const TRYON_GENERATE_LABEL = "Generar prueba virtual";
export const TRYON_STATUS_VALID = "La foto es válida.";
export const TRYON_STATUS_READY =
  "La foto está lista para generar la prueba virtual.";

export type TryonFileLike = Pick<File, "type" | "size">;

export type TryonValidation =
  | { ok: true }
  | { ok: false; message: string };

const ALLOWED_TYPES = new Set<string>(TRYON_ALLOWED_MIME_TYPES);

export function validateTryonFile(
  file: TryonFileLike | null | undefined,
): TryonValidation {
  if (!file || file.size <= 0) {
    return { ok: false, message: TRYON_ERROR_INVALID };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: TRYON_ERROR_TYPE };
  }

  if (file.size > TRYON_MAX_BYTES) {
    return { ok: false, message: TRYON_ERROR_SIZE };
  }

  return { ok: true };
}
