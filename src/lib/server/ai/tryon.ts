import "server-only";

import type { ProductDetail } from "../product-detail";
import { getProductDetailBySlug, parseProductSlug } from "../product-detail";
import {
  TRYON_ERROR_CONSENT,
  TRYON_ERROR_PRODUCT,
  buildTryonImageDataUrl,
  type TryonRequestInput,
} from "../../tryon";
import { validateTryonFile } from "../../tryon-upload";
import {
  aiProvider,
  type AiDegradationCode,
} from "./provider";

export type TryonServiceResult =
  | { ok: true; imageDataUrl: string }
  | { ok: false; kind: "input"; message: string }
  | {
      ok: false;
      kind: "degraded";
      code: AiDegradationCode;
      message: string;
    };

export function buildTryonPrompt(
  product: ProductDetail,
  size: string | null,
  color: string | null,
): string {
  const variant =
    size && color
      ? (product.variants.find(
          (candidate) => candidate.size === size && candidate.color === color,
        ) ?? null)
      : null;

  const garment = variant
    ? `${product.name} de la categoría ${product.categoryName}, color ${variant.color}, talla ${variant.size}. ${product.description}`
    : `${product.name} de la categoría ${product.categoryName}. ${product.description}`;

  return [
    "Edita esta foto para vestir a la persona con la siguiente prenda de la tienda.",
    "Conserva a la misma persona, el fondo y la pose. No añadas texto, logotipos ni otras personas.",
    `Prenda: ${garment}`,
    "El resultado debe parecer una foto editada de la misma escena.",
  ].join(" ");
}

export async function generateTryon(
  input: TryonRequestInput,
): Promise<TryonServiceResult> {
  if (input.consent !== true) {
    return { ok: false, kind: "input", message: TRYON_ERROR_CONSENT };
  }

  const fileResult = validateTryonFile(input.photo);
  if (!fileResult.ok) {
    return { ok: false, kind: "input", message: fileResult.message };
  }

  const slug = parseProductSlug(input.productSlug);
  if (!slug) {
    return { ok: false, kind: "input", message: TRYON_ERROR_PRODUCT };
  }

  const product = await getProductDetailBySlug(slug);
  if (!product) {
    return { ok: false, kind: "input", message: TRYON_ERROR_PRODUCT };
  }

  const prompt = buildTryonPrompt(product, input.size, input.color);
  const result = await aiProvider.run(async (client, models) => {
    const response = await client.images.edit(
      {
        model: models.image,
        image: input.photo,
        prompt,
        n: 1,
        response_format: "b64_json",
      },
      { timeout: 60_000 },
    );

    const image = response.data?.[0];
    if (!image || typeof image.b64_json !== "string") {
      throw new Error("Invalid image response");
    }

    const imageDataUrl = buildTryonImageDataUrl(image.b64_json);
    if (!imageDataUrl) {
      throw new Error("Invalid image response");
    }

    return imageDataUrl;
  });

  if (!result.ok) {
    return {
      ok: false,
      kind: "degraded",
      code: result.code,
      message: result.message,
    };
  }

  return { ok: true, imageDataUrl: result.value };
}
