import { cookies } from "next/headers";

import {
  PAYMENT_BODY_LIMIT,
  PAYMENT_ERROR_AUTH,
  PAYMENT_ERROR_EMPTY,
  PAYMENT_ERROR_INVALID,
  PAYMENT_ERROR_STOCK,
  PAYMENT_ERROR_UNAVAILABLE,
  parseIdempotencyKey,
  parsePaymentInput,
  type PaymentResponse,
} from "../../../../lib/payment";
import { AUTH_COOKIE_NAME } from "../../../../lib/auth";
import { getSessionUser } from "../../../../lib/server/auth";
import { processPayment } from "../../../../lib/server/payment";

export const runtime = "nodejs";

class BodyTooLarge extends Error {}

class InvalidBody extends Error {}

function json(body: PaymentResponse, status: number): Response {
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
      if (size > PAYMENT_BODY_LIMIT) {
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

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request) || !isJsonContentType(request.headers.get("content-type"))) {
    return json({ ok: false, message: PAYMENT_ERROR_INVALID }, 400);
  }

  const idempotencyKey = parseIdempotencyKey(request.headers.get("Idempotency-Key"));
  if (!idempotencyKey) {
    return json({ ok: false, message: PAYMENT_ERROR_INVALID }, 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await readBody(request);
  } catch (error) {
    return json(
      {
        ok: false,
        message: error instanceof BodyTooLarge ? PAYMENT_ERROR_INVALID : PAYMENT_ERROR_INVALID,
      },
      error instanceof BodyTooLarge ? 413 : 400,
    );
  }

  const input = parsePaymentInput(rawBody);
  if (!input) {
    return json({ ok: false, message: PAYMENT_ERROR_INVALID }, 400);
  }

  let token: string | undefined;
  try {
    token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  } catch {
    return json({ ok: false, message: PAYMENT_ERROR_UNAVAILABLE }, 503);
  }

  let user;
  try {
    user = await getSessionUser(token);
  } catch {
    return json({ ok: false, message: PAYMENT_ERROR_UNAVAILABLE }, 503);
  }
  if (!user) {
    return json({ ok: false, message: PAYMENT_ERROR_AUTH }, 401);
  }

  try {
    const result = await processPayment({
      userId: user.id,
      input,
      idempotencyKey,
    });
    if (!result.ok) {
      if (result.code === "empty_cart") {
        return json({ ok: false, message: PAYMENT_ERROR_EMPTY }, 409);
      }
      if (result.code === "stock_changed" || result.code === "invalid_cart") {
        return json({ ok: false, message: PAYMENT_ERROR_STOCK }, 409);
      }
      return json({ ok: false, message: PAYMENT_ERROR_UNAVAILABLE }, 503);
    }

    return json(
      {
        ok: true,
        outcome: result.outcome,
        orderId: result.orderId,
        orderStatus: result.orderStatus,
        totalCents: result.totalCents,
      },
      200,
    );
  } catch {
    return json({ ok: false, message: PAYMENT_ERROR_UNAVAILABLE }, 503);
  }
}

