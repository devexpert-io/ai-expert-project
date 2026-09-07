import { describe, expect, it } from "vitest";

import {
  TRYON_ACCEPT,
  TRYON_ALLOWED_MIME_TYPES,
  TRYON_ERROR_INVALID,
  TRYON_ERROR_SIZE,
  TRYON_ERROR_TYPE,
  TRYON_MAX_BYTES,
  validateTryonFile,
} from "./tryon-upload";

function fileLike(type: string, size: number) {
  return { type, size };
}

describe("validateTryonFile", () => {
  it("accepts JPEG, PNG and WebP within the size limit", () => {
    expect(TRYON_ALLOWED_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(TRYON_ACCEPT).toBe("image/jpeg,image/png,image/webp");
    expect(TRYON_MAX_BYTES).toBe(5 * 1024 * 1024);

    expect(validateTryonFile(fileLike("image/jpeg", 1))).toEqual({ ok: true });
    expect(validateTryonFile(fileLike("image/png", 2048))).toEqual({ ok: true });
    expect(validateTryonFile(fileLike("image/webp", TRYON_MAX_BYTES))).toEqual({
      ok: true,
    });
  });

  it("rejects HEIC, GIF, SVG, PDF and other MIME types", () => {
    for (const type of [
      "image/heic",
      "image/heif",
      "image/gif",
      "image/svg+xml",
      "application/pdf",
      "application/octet-stream",
      "text/plain",
    ]) {
      expect(validateTryonFile(fileLike(type, 1024))).toEqual({
        ok: false,
        message: TRYON_ERROR_TYPE,
      });
    }
  });

  it("does not trust the file name or extension", () => {
    expect(
      validateTryonFile({
        type: "image/gif",
        size: 512,
      }),
    ).toEqual({ ok: false, message: TRYON_ERROR_TYPE });
    expect(
      validateTryonFile({
        type: "image/jpeg",
        size: 512,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects files over 5 MiB", () => {
    expect(validateTryonFile(fileLike("image/jpeg", TRYON_MAX_BYTES + 1))).toEqual(
      {
        ok: false,
        message: TRYON_ERROR_SIZE,
      },
    );
  });

  it("rejects missing or empty files", () => {
    expect(validateTryonFile(null)).toEqual({
      ok: false,
      message: TRYON_ERROR_INVALID,
    });
    expect(validateTryonFile(undefined)).toEqual({
      ok: false,
      message: TRYON_ERROR_INVALID,
    });
    expect(validateTryonFile(fileLike("image/png", 0))).toEqual({
      ok: false,
      message: TRYON_ERROR_INVALID,
    });
  });
});
