import { cookies } from "next/headers";

import {
  AUTH_BODY_LIMIT,
  AUTH_COOKIE_NAME,
  AUTH_ERROR_ACTIVE_SESSION,
  AUTH_ERROR_BODY,
  AUTH_ERROR_CREDENTIALS,
  AUTH_ERROR_DUPLICATE,
  AUTH_ERROR_INVALID,
  AUTH_ERROR_MERGE_OVERFLOW,
  AUTH_ERROR_UNAVAILABLE,
  parseAuthInput,
  serializeAuthCookie,
  type AuthResponse,
} from "../../../../lib/auth";
import { CART_COOKIE_NAME } from "../../../../lib/cart";
import { completeCheckoutAuth } from "../../../../lib/server/auth";

export const runtime = "nodejs";

class BodyTooLarge extends Error {}

class InvalidBody extends Error {}

function json(body: AuthResponse, status: number): Response {
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
      if (size > AUTH_BODY_LIMIT) {
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

function isJsonContentType(contentType: string | null): boolean {
  return contentType !== null && /^application\/json(?:\s*;|\s*$)/iu.test(contentType.trim());
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

function appendSuccessCookies(
  response: Response,
  token: string,
  guestToken: string | undefined,
): Response {
  response.headers.append("Set-Cookie", serializeAuthCookie(token));
  if (guestToken) {
    response.headers.append("Set-Cookie", `${CART_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  }
  return response;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request) || !isJsonContentType(request.headers.get("content-type"))) {
    return json({ ok: false, message: AUTH_ERROR_INVALID }, 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await readBody(request);
  } catch (error) {
    return json(
      {
        ok: false,
        message: error instanceof BodyTooLarge ? AUTH_ERROR_BODY : AUTH_ERROR_INVALID,
      },
      400,
    );
  }

  const input = parseAuthInput(rawBody);
  if (!input) {
    return json({ ok: false, message: AUTH_ERROR_INVALID }, 400);
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return json({ ok: false, message: AUTH_ERROR_UNAVAILABLE }, 500);
  }

  const currentSessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;

  try {
    const result = await completeCheckoutAuth({
      input,
      currentSessionToken,
      guestToken,
    });

    if (!result.ok) {
      if (result.code === "duplicate_email") {
        return json({ ok: false, message: AUTH_ERROR_DUPLICATE }, 409);
      }
      if (result.code === "invalid_credentials") {
        return json({ ok: false, message: AUTH_ERROR_CREDENTIALS }, 401);
      }
      if (result.code === "active_session") {
        return json({ ok: false, message: AUTH_ERROR_ACTIVE_SESSION }, 409);
      }
      return json({ ok: false, message: AUTH_ERROR_MERGE_OVERFLOW }, 409);
    }

    const response = json({ ok: true }, 200);
    return appendSuccessCookies(response, result.token, guestToken);
  } catch {
    return json({ ok: false, message: AUTH_ERROR_UNAVAILABLE }, 500);
  }
}
