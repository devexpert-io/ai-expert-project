import { describe, expect, it } from "vitest";

import {
  TRYON_ERROR_TYPE,
  TRYON_ERROR_SIZE,
  TRYON_MAX_BYTES,
} from "./tryon-upload";
import {
  TRYON_BODY_LIMIT,
  TRYON_ERROR_CONSENT,
  TRYON_ERROR_PRODUCT,
  TRYON_ERROR_REQUEST,
  buildTryonImageDataUrl,
  isTryonImageDataUrl,
  parseTryonFormData,
} from "./tryon";

function photo(type = "image/jpeg", size = 32, name = "foto.jpg") {
  return new File([new Uint8Array(size)], name, { type });
}

function form(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("tryon contract", () => {
  it("caps the multipart body at 6 MiB and accepts png or jpeg data URLs", () => {
    expect(TRYON_BODY_LIMIT).toBe(6 * 1024 * 1024);
    expect(TRYON_BODY_LIMIT).toBeGreaterThan(TRYON_MAX_BYTES);

    const png = buildTryonImageDataUrl("iVBORw0KGgo=");
    const jpeg = buildTryonImageDataUrl("/9j/4AAQ=");
    expect(png).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(jpeg).toBe("data:image/jpeg;base64,/9j/4AAQ=");
    expect(isTryonImageDataUrl(png)).toBe(true);
    expect(isTryonImageDataUrl(jpeg)).toBe(true);
  });

  it("rejects http URLs, missing prefixes and malformed base64", () => {
    expect(isTryonImageDataUrl("https://evil.example/x.png")).toBe(false);
    expect(isTryonImageDataUrl("data:image/webp;base64,aaaa")).toBe(false);
    expect(isTryonImageDataUrl("data:image/png;base64,")).toBe(false);
    expect(buildTryonImageDataUrl("")).toBeNull();
    expect(buildTryonImageDataUrl("not base64!")).toBeNull();
  });

  it("parses consent, slug and optional size/color from multipart", () => {
    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          productSlug: "  camiseta-basica  ",
          consent: "true",
          size: "S",
          color: "Negro",
        }),
      ),
    ).toMatchObject({
      ok: true,
      value: {
        productSlug: "camiseta-basica",
        consent: true,
        size: "S",
        color: "Negro",
      },
    });

    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          productSlug: "camiseta-basica",
          consent: "true",
        }),
      ),
    ).toMatchObject({
      ok: true,
      value: { size: null, color: null },
    });
  });

  it("rejects missing consent, unknown fields and invalid photos with constants", () => {
    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          productSlug: "camiseta-basica",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_CONSENT });

    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          productSlug: "camiseta-basica",
          consent: "false",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_CONSENT });

    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          consent: "true",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_PRODUCT });

    expect(
      parseTryonFormData(
        form({
          photo: photo(),
          productSlug: "camiseta-basica",
          consent: "true",
          model: "evil",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_REQUEST });

    expect(
      parseTryonFormData(
        form({
          photo: photo("image/gif"),
          productSlug: "camiseta-basica",
          consent: "true",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_TYPE });

    expect(
      parseTryonFormData(
        form({
          photo: photo("image/jpeg", TRYON_MAX_BYTES + 1),
          productSlug: "camiseta-basica",
          consent: "true",
        }),
      ),
    ).toEqual({ ok: false, message: TRYON_ERROR_SIZE });
  });
});
