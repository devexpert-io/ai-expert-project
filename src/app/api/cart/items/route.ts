import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import {
  CART_BODY_LIMIT,
  CART_COOKIE_MAX_AGE,
  CART_COOKIE_NAME,
  CART_ERROR_BODY,
  CART_ERROR_INVALID,
  CART_ERROR_NOT_FOUND,
  CART_ERROR_SOLD_OUT,
  CART_UNAVAILABLE,
  parseCartAddInput,
  type CartAddResponse,
} from "../../../../lib/cart";
import { addGuestCartItem } from "../../../../lib/server/cart";

export const runtime = "nodejs";

class BodyTooLarge extends Error {}

class InvalidBody extends Error {}

function json(body: CartAddResponse, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new InvalidBody();
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
      if (size > CART_BODY_LIMIT) {
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

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidBody();
  }
}

function serializeGuestCookie(token: string): string {
  const parts = [
    `${CART_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${CART_COOKIE_MAX_AGE}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function withGuestCookie(response: Response, token: string): Response {
  response.headers.append("Set-Cookie", serializeGuestCookie(token));
  return response;
}

function isJsonContentType(contentType: string | null): boolean {
  return (
    contentType === null ||
    /^application\/json(?:\s*;|\s*$)/iu.test(contentType.trim())
  );
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  let input;
  try {
    input = parseCartAddInput(await readBody(request));
  } catch (error) {
    return json(
      {
        ok: false,
        message:
          error instanceof BodyTooLarge ? CART_ERROR_BODY : CART_ERROR_INVALID,
      },
      error instanceof BodyTooLarge ? 413 : 400,
    );
  }

  if (!input) {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  let guestToken: string;
  let shouldSetCookie = false;
  try {
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(CART_COOKIE_NAME)?.value;
    guestToken = existingToken || randomUUID();
    shouldSetCookie = !existingToken;
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }

  try {
    const result = await addGuestCartItem({ ...input, guestToken });

    if (!result.ok) {
      if (result.code === "quantity_overflow") {
        const response = json(
          { ok: false, message: CART_ERROR_INVALID },
          400,
        );
        return shouldSetCookie ? withGuestCookie(response, guestToken) : response;
      }

      const response = json(
        {
          ok: false,
          message:
            result.code === "variant_not_found"
              ? CART_ERROR_NOT_FOUND
              : CART_ERROR_SOLD_OUT,
        },
        result.code === "variant_not_found" ? 404 : 409,
      );
      return shouldSetCookie ? withGuestCookie(response, guestToken) : response;
    }

    const response = json(result, 200);
    return shouldSetCookie ? withGuestCookie(response, guestToken) : response;
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }
}
