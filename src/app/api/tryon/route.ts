import {
  TRYON_BODY_LIMIT,
  TRYON_ERROR_BODY,
  TRYON_ERROR_REQUEST,
  TRYON_UNAVAILABLE,
  parseTryonFormData,
  type TryonResponse,
} from "../../../lib/tryon";
import { generateTryon } from "../../../lib/server/ai/tryon";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: TryonResponse, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

class BodyTooLarge extends Error {}

async function readBody(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      size += value.byteLength;
      if (size > TRYON_BODY_LIMIT) {
        await reader.cancel();
        throw new BodyTooLarge();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return json({ ok: false, message: TRYON_ERROR_REQUEST }, 400);
  }

  let input;
  try {
    const bytes = await readBody(request);
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const formData = await new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "",
      },
      body: copy,
    }).formData();
    input = parseTryonFormData(formData);
  } catch (error) {
    return json(
      {
        ok: false,
        message: error instanceof BodyTooLarge ? TRYON_ERROR_BODY : TRYON_ERROR_REQUEST,
      },
      error instanceof BodyTooLarge ? 413 : 400,
    );
  }

  if (!input.ok) {
    return json({ ok: false, message: input.message }, 400);
  }

  try {
    const result = await generateTryon(input.value);
    if (!result.ok) {
      if (result.kind === "input") {
        return json({ ok: false, message: result.message }, 400);
      }

      return json(
        { ok: false, message: result.message },
        result.code === "quota_exhausted" ? 429 : 503,
      );
    }

    return json({ ok: true, imageDataUrl: result.imageDataUrl }, 200);
  } catch {
    return json({ ok: false, message: TRYON_UNAVAILABLE }, 503);
  }
}
