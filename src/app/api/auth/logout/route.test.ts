import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const cookiesMock = vi.hoisted(() => vi.fn());
const revokeSession = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("../../../../lib/server/auth", () => ({ revokeSession }));

import { POST } from "./route";

function request(options: Readonly<{ body?: string; origin?: string }> = {}): Request {
  const headers = new Headers();
  if (options.origin !== undefined) {
    headers.set("Origin", options.origin);
  }
  return new Request("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers,
    body: options.body,
  });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "opaque-session-token" });
    cookiesMock.mockResolvedValue(cookieStore);
    revokeSession.mockResolvedValue(undefined);
  });

  it("revokes the current session and expires its cookie", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(revokeSession).toHaveBeenCalledWith("opaque-session-token");
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^auth_session=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0$/u,
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("is idempotent for no cookie and rejects bodies/foreign origins", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(POST(request())).resolves.toHaveProperty("status", 200);
    expect(revokeSession).toHaveBeenCalledWith(undefined);

    await expect(POST(request({ body: "{}" }))).resolves.toHaveProperty("status", 400);
    await expect(
      POST(request({ origin: "https://attacker.example" })),
    ).resolves.toHaveProperty("status", 400);
  });
});
