// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const generateTryon = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/server/ai/tryon", () => ({ generateTryon }));

import { POST } from "./route";
import {
  TRYON_ERROR_BODY,
  TRYON_ERROR_CONSENT,
  TRYON_ERROR_PRODUCT,
  TRYON_ERROR_REQUEST,
  TRYON_UNAVAILABLE,
} from "../../../lib/tryon";
import { TRYON_ERROR_TYPE, TRYON_MAX_BYTES } from "../../../lib/tryon-upload";

function photo(type = "image/jpeg", size = 32) {
  return new File([new Uint8Array(size)], "foto.jpg", { type });
}

function request(
  fields: Record<string, string | File> = {
    photo: photo(),
    productSlug: "camiseta-basica",
    consent: "true",
  },
  headers: HeadersInit = {},
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }

  return new Request("http://localhost/api/tryon", {
    method: "POST",
    body,
    headers,
  });
}

beforeEach(() => {
  generateTryon.mockReset();
  generateTryon.mockResolvedValue({
    ok: true,
    imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
});

it("returns a non-cached success payload", async () => {
  const response = await POST(
    request({
      photo: photo(),
      productSlug: "camiseta-basica",
      consent: "true",
      size: "S",
      color: "Negro",
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    ok: true,
    imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
  expect(generateTryon).toHaveBeenCalledWith({
    photo: expect.any(File),
    productSlug: "camiseta-basica",
    consent: true,
    size: "S",
    color: "Negro",
  });
});

it("rejects missing consent, unknown product fields and invalid MIME before the service", async () => {
  expect(
    (await POST(request({ photo: photo(), productSlug: "camiseta-basica" }))).status,
  ).toBe(400);
  expect(
    await (
      await POST(request({ photo: photo(), productSlug: "camiseta-basica" }))
    ).json(),
  ).toEqual({ ok: false, message: TRYON_ERROR_CONSENT });

  expect(
    (await POST(request({ photo: photo(), consent: "true" }))).status,
  ).toBe(400);
  expect(
    await (await POST(request({ photo: photo(), consent: "true" }))).json(),
  ).toEqual({ ok: false, message: TRYON_ERROR_PRODUCT });

  expect(
    (
      await POST(
        request({
          photo: photo("image/gif"),
          productSlug: "camiseta-basica",
          consent: "true",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    await (
      await POST(
        request({
          photo: photo("image/gif"),
          productSlug: "camiseta-basica",
          consent: "true",
        }),
      )
    ).json(),
  ).toEqual({ ok: false, message: TRYON_ERROR_TYPE });

  expect(
    (
      await POST(
        request({
          photo: photo(),
          productSlug: "camiseta-basica",
          consent: "true",
          model: "evil",
        }),
      )
    ).status,
  ).toBe(400);
  expect(generateTryon).not.toHaveBeenCalled();
});

it("rejects oversized bodies despite a lying Content-Length", async () => {
  const response = await POST(
    new Request("http://localhost/api/tryon", {
      method: "POST",
      body: "x".repeat(6 * 1024 * 1024 + 1),
      headers: { "Content-Length": "1" },
    }),
  );

  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({
    ok: false,
    message: TRYON_ERROR_BODY,
  });
  expect(generateTryon).not.toHaveBeenCalled();
  expect(TRYON_MAX_BYTES).toBeLessThan(6 * 1024 * 1024);
});

it("rejects a foreign origin before invoking the service", async () => {
  expect(
    (await POST(request(undefined, { Origin: "https://evil.test" }))).status,
  ).toBe(400);
  expect(
    await (
      await POST(request(undefined, { Origin: "https://evil.test" }))
    ).json(),
  ).toEqual({ ok: false, message: TRYON_ERROR_REQUEST });
  expect(generateTryon).not.toHaveBeenCalled();
  expect(
    (await POST(request(undefined, { Origin: "http://localhost" }))).status,
  ).toBe(200);
});

it.each([
  ["quota_exhausted", 429],
  ["missing_api_key", 503],
  ["invalid_api_key", 503],
  ["provider_unavailable", 503],
] as const)("maps %s safely", async (code, status) => {
  generateTryon.mockResolvedValue({
    ok: false,
    kind: "degraded",
    code,
    message: "Seguro",
  });
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ ok: false, message: "Seguro" });
});

it("maps catalog input failures to 400", async () => {
  generateTryon.mockResolvedValue({
    ok: false,
    kind: "input",
    message: TRYON_ERROR_PRODUCT,
  });
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    ok: false,
    message: TRYON_ERROR_PRODUCT,
  });
});

it("contains unexpected errors", async () => {
  generateTryon.mockRejectedValue(new Error("secret database details"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body).toEqual({ ok: false, message: TRYON_UNAVAILABLE });
  expect(JSON.stringify(body)).not.toContain("secret");
});
