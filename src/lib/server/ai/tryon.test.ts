// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const { edit, constructor, getDetail } = vi.hoisted(() => ({
  edit: vi.fn(),
  constructor: vi.fn(),
  getDetail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../product-detail", () => ({
  parseProductSlug: (slug: string) =>
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null,
  getProductDetailBySlug: getDetail,
}));
vi.mock("openai", () => ({
  default: class {
    images = { edit };
    constructor(options: unknown) {
      constructor(options);
    }
  },
}));

import { AI_DEGRADATION_MESSAGES } from "./provider";
import { TRYON_ERROR_PRODUCT } from "../../tryon";
import { TRYON_ERROR_TYPE } from "../../tryon-upload";
import { generateTryon } from "./tryon";

const product = {
  id: "product-1",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  description: "Camiseta de algodón suave.",
  imageUrl: "https://placehold.co/camiseta",
  basePriceCents: 1990,
  categoryName: "Camisetas",
  variants: [
    {
      id: "variant-s-black",
      size: "S",
      color: "Negro",
      stock: 12,
      priceCents: 1990,
    },
    {
      id: "variant-m-black",
      size: "M",
      color: "Negro",
      stock: 0,
      priceCents: 1990,
    },
  ],
};

function input(
  overrides: Partial<{
    photo: File;
    productSlug: string;
    consent: true;
    size: string | null;
    color: string | null;
  }> = {},
) {
  return {
    photo: new File([new Uint8Array(32)], "foto.jpg", { type: "image/jpeg" }),
    productSlug: "camiseta-basica",
    consent: true as const,
    size: null,
    color: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("DEVEXPERT_API_KEY", "test-only");
  vi.stubEnv("DEVEXPERT_IMAGE_MODEL", "configured-image");
  edit.mockReset();
  constructor.mockClear();
  getDetail.mockReset();
  getDetail.mockResolvedValue(product);
  edit.mockResolvedValue({ data: [{ b64_json: "iVBORw0KGgo=" }] });
});

it("edits with the configured image model, server prompt and 60s timeout", async () => {
  const result = await generateTryon(
    input({ size: "S", color: "Negro" }),
  );

  expect(result).toEqual({
    ok: true,
    imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
  expect(getDetail).toHaveBeenCalledWith("camiseta-basica");
  const [body, options] = edit.mock.calls[0];
  expect(body.model).toBe("configured-image");
  expect(body.n).toBe(1);
  expect(body.response_format).toBe("b64_json");
  expect(body.image).toBeInstanceOf(File);
  expect(options).toEqual({ timeout: 60_000 });
  expect(body.prompt).toContain("Camiseta básica");
  expect(body.prompt).toContain("Camisetas");
  expect(body.prompt).toContain("Camiseta de algodón suave.");
  expect(body.prompt).toContain("color Negro");
  expect(body.prompt).toContain("talla S");
  expect(body.prompt).toContain("Conserva a la misma persona");
  expect(constructor).toHaveBeenCalledWith(
    expect.objectContaining({ maxRetries: 0 }),
  );
});

it("generates at product level when the pair is not an exact variant", async () => {
  await generateTryon(input({ size: "S", color: "Azul" }));

  const prompt = edit.mock.calls[0][0].prompt as string;
  expect(prompt).toContain("Camiseta básica");
  expect(prompt).not.toContain("talla S");
  expect(prompt).not.toContain("color Azul");
});

it("does not block a sold-out exact variant", async () => {
  await generateTryon(input({ size: "M", color: "Negro" }));

  const prompt = edit.mock.calls[0][0].prompt as string;
  expect(prompt).toContain("color Negro");
  expect(prompt).toContain("talla M");
});

it("rejects unknown or invalid slugs before the provider", async () => {
  getDetail.mockResolvedValue(null);
  expect(await generateTryon(input())).toEqual({
    ok: false,
    kind: "input",
    message: TRYON_ERROR_PRODUCT,
  });
  expect(edit).not.toHaveBeenCalled();
  expect(constructor).not.toHaveBeenCalled();

  expect(await generateTryon(input({ productSlug: "Camiseta-basica" }))).toEqual(
    {
      ok: false,
      kind: "input",
      message: TRYON_ERROR_PRODUCT,
    },
  );
  expect(getDetail).toHaveBeenCalledTimes(1);
});

it("rejects invalid photos before looking up the product", async () => {
  expect(
    await generateTryon(
      input({
        photo: new File([new Uint8Array(16)], "foto.gif", { type: "image/gif" }),
      }),
    ),
  ).toEqual({ ok: false, kind: "input", message: TRYON_ERROR_TYPE });
  expect(getDetail).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
});

it("does not call the provider without a key", async () => {
  vi.stubEnv("DEVEXPERT_API_KEY", "");
  expect(await generateTryon(input())).toMatchObject({
    ok: false,
    kind: "degraded",
    code: "missing_api_key",
    message: AI_DEGRADATION_MESSAGES.missing_api_key,
  });
  expect(getDetail).toHaveBeenCalledOnce();
  expect(edit).not.toHaveBeenCalled();
  expect(constructor).not.toHaveBeenCalled();
});

it("treats a url-only response as a safe provider error without fetching", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  edit.mockResolvedValue({ data: [{ url: "https://evil.example/secret.png" }] });

  const result = await generateTryon(input());
  expect(result).toMatchObject({
    ok: false,
    kind: "degraded",
    code: "provider_error",
    message: AI_DEGRADATION_MESSAGES.provider_error,
  });
  expect(JSON.stringify(result)).not.toContain("evil.example");
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it.each([
  [{ status: 429 }, "quota_exhausted"],
  [{ status: 401 }, "invalid_api_key"],
  [new Error("network failure"), "provider_unavailable"],
  [new Error("timeout"), "provider_unavailable"],
] as const)("contains provider errors without retries %#", async (error, code) => {
  edit.mockRejectedValue(error);
  expect(await generateTryon(input())).toMatchObject({
    ok: false,
    kind: "degraded",
    code,
  });
  expect(edit).toHaveBeenCalledTimes(1);
});
