import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "../../../../lib/auth";
import {
  CART_BODY_LIMIT,
  CART_COOKIE_MAX_AGE,
  CART_COOKIE_NAME,
  CART_ERROR_BODY,
  CART_ERROR_ITEM_NOT_FOUND,
  CART_ERROR_INVALID,
  CART_ERROR_NOT_FOUND,
  CART_ERROR_SOLD_OUT,
  CART_UNAVAILABLE,
  parseCartAddInput,
  parseCartRemoveInput,
  parseCartUpdateInput,
  type CartAddResponse,
  type CartMutationResponse,
} from "../../../../lib/cart";
import {
  addGuestCartItem,
  addUserCartItem,
  removeGuestCartItem,
  removeUserCartItem,
  updateGuestCartItem,
  updateUserCartItem,
} from "../../../../lib/server/cart";
import { getSessionUser } from "../../../../lib/server/auth";

export const runtime = "nodejs";

class BodyTooLarge extends Error {}

class InvalidBody extends Error {}

function json(body: CartAddResponse | CartMutationResponse, status: number): Response {
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

type CartIdentity =
  | Readonly<{ kind: "user"; userId: string }>
  | Readonly<{ kind: "guest"; guestToken: string }>;

async function resolveIdentity(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<CartIdentity | null> {
  const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (authToken) {
    try {
      const user = await getSessionUser(authToken);
      if (user) {
        return { kind: "user", userId: user.id };
      }
    } catch {
      // An invalid/unavailable auth lookup falls through to the guest cookie.
    }
  }

  const guestToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  return guestToken ? { kind: "guest", guestToken } : null;
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

  let identity: CartIdentity;
  let shouldSetCookie = false;
  try {
    const cookieStore = await cookies();
    const resolved = await resolveIdentity(cookieStore);
    if (resolved) {
      identity = resolved;
    } else {
      identity = { kind: "guest", guestToken: randomUUID() };
      shouldSetCookie = true;
    }
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }

  const newGuestToken =
    shouldSetCookie && identity.kind === "guest" ? identity.guestToken : null;

  try {
    const result =
      identity.kind === "user"
        ? await addUserCartItem({ ...input, userId: identity.userId })
        : await addGuestCartItem({ ...input, guestToken: identity.guestToken });

    if (!result.ok) {
      if (result.code === "quantity_overflow") {
        const response = json(
          { ok: false, message: CART_ERROR_INVALID },
          400,
        );
        return newGuestToken ? withGuestCookie(response, newGuestToken) : response;
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
      return newGuestToken ? withGuestCookie(response, newGuestToken) : response;
    }

    const response = json(result, 200);
    return newGuestToken ? withGuestCookie(response, newGuestToken) : response;
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }
}

function mutationErrorResponse(
  result: Extract<Awaited<ReturnType<typeof updateGuestCartItem>>, { ok: false }>,
): Response {
  if (result.code === "cart_item_not_found") {
    return json({ ok: false, message: CART_ERROR_ITEM_NOT_FOUND }, 404);
  }

  if (result.code === "quantity_overflow") {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  if (result.code === "variant_not_found") {
    return json({ ok: false, message: CART_ERROR_NOT_FOUND }, 404);
  }

  return json({ ok: false, message: CART_ERROR_SOLD_OUT }, 409);
}

async function handleMutation(
  request: Request,
  method: "PATCH" | "DELETE",
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return json({ ok: false, message: CART_ERROR_INVALID }, 400);
  }

  let input: ReturnType<typeof parseCartUpdateInput> | ReturnType<typeof parseCartRemoveInput>;
  try {
    input =
      method === "PATCH"
        ? parseCartUpdateInput(await readBody(request))
        : parseCartRemoveInput(await readBody(request));
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

  let identity: CartIdentity | null;
  try {
    identity = await resolveIdentity(await cookies());
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }

  if (!identity) {
    return json({ ok: false, message: CART_ERROR_ITEM_NOT_FOUND }, 404);
  }

  try {
    const result =
      identity.kind === "user"
        ? method === "PATCH"
          ? await updateUserCartItem({
              ...(input as NonNullable<ReturnType<typeof parseCartUpdateInput>>),
              userId: identity.userId,
            })
          : await removeUserCartItem({
              ...(input as NonNullable<ReturnType<typeof parseCartRemoveInput>>),
              userId: identity.userId,
            })
        : method === "PATCH"
          ? await updateGuestCartItem({
              ...(input as NonNullable<ReturnType<typeof parseCartUpdateInput>>),
              guestToken: identity.guestToken,
            })
          : await removeGuestCartItem({
              ...(input as NonNullable<ReturnType<typeof parseCartRemoveInput>>),
              guestToken: identity.guestToken,
            });

    if (!result.ok) {
      return mutationErrorResponse(result);
    }

    return json(result, 200);
  } catch {
    return json({ ok: false, message: CART_UNAVAILABLE }, 500);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  return handleMutation(request, "PATCH");
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMutation(request, "DELETE");
}
