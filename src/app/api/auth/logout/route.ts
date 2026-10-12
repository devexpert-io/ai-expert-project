import { cookies } from "next/headers";

import {
  AUTH_COOKIE_NAME,
  AUTH_ERROR_INVALID,
  AUTH_ERROR_UNAVAILABLE,
  serializeExpiredAuthCookie,
  type AuthResponse,
} from "../../../../lib/auth";
import { revokeSession } from "../../../../lib/server/auth";

export const runtime = "nodejs";

function json(body: AuthResponse, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

async function hasBody(request: Request): Promise<boolean> {
  if (!request.body) {
    return false;
  }

  const reader = request.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return size > 0;
      }
      size += value.byteLength;
      if (size > 8 * 1024) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request) || (await hasBody(request))) {
    return json({ ok: false, message: AUTH_ERROR_INVALID }, 400);
  }

  let token: string | undefined;
  try {
    token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    await revokeSession(token);
  } catch {
    return json({ ok: false, message: AUTH_ERROR_UNAVAILABLE }, 500);
  }

  const response = json({ ok: true }, 200);
  response.headers.append("Set-Cookie", serializeExpiredAuthCookie());
  return response;
}
