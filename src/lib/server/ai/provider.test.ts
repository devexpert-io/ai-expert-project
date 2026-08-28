import { beforeEach, describe, expect, it, vi } from "vitest";

const openAiState = vi.hoisted(() => ({
  constructors: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", () => {
  class FakeOpenAI {
    apiKey: string;
    baseURL: string;
    maxRetries: number;

    constructor(options: { apiKey: string; baseURL: string; maxRetries: number }) {
      openAiState.constructors.push(options);
      this.apiKey = options.apiKey;
      this.baseURL = options.baseURL;
      this.maxRetries = options.maxRetries;
    }
  }

  return { default: FakeOpenAI };
});

import {
  AI_DEGRADATION_MESSAGES,
  AiProvider,
  classifyAiError,
  createAiProvider,
} from "./provider";

describe("AiProvider", () => {
  beforeEach(() => {
    openAiState.constructors.length = 0;
  });

  it("does not construct a client or call the operation without a key", async () => {
    const provider = createAiProvider({});
    const operation = vi.fn().mockResolvedValue("must not run");

    const result = await provider.run(operation);

    expect(result).toEqual({
      ok: false,
      degraded: true,
      code: "missing_api_key",
      message: AI_DEGRADATION_MESSAGES.missing_api_key,
    });
    expect(operation).not.toHaveBeenCalled();
    expect(openAiState.constructors).toHaveLength(0);
  });

  it("constructs lazily with the configured endpoint and disables retries", async () => {
    const provider = createAiProvider({
      DEVEXPERT_API_KEY: "  test-key  ",
      DEVEXPERT_BASE_URL: "https://ai.example.test/v1/",
      DEVEXPERT_CHAT_MODEL: "chat-custom",
    });

    const result = await provider.run(async (client, models) => ({
      baseURL: client.baseURL,
      maxRetries: client.maxRetries,
      apiKey: client.apiKey,
      chatModel: models.chat,
    }));

    expect(result).toEqual({
      ok: true,
      value: {
        baseURL: "https://ai.example.test/v1",
        maxRetries: 0,
        apiKey: "test-key",
        chatModel: "chat-custom",
      },
    });
    expect(openAiState.constructors).toEqual([
      {
        apiKey: "test-key",
        baseURL: "https://ai.example.test/v1",
        maxRetries: 0,
      },
    ]);
  });

  it("maps provider failures to safe, typed degradation", async () => {
    const cases: Array<[unknown, string]> = [
      [{ status: 429, error: { code: "rate_limit_exceeded" } }, "quota_exhausted"],
      [{ error: { code: "insufficient_quota" } }, "quota_exhausted"],
      [{ status: 401, body: "raw secret body" }, "invalid_api_key"],
      [{ status: 403 }, "invalid_api_key"],
      [{ status: 503 }, "provider_unavailable"],
      [Object.assign(new Error("fetch failed"), { code: "ECONNRESET" }), "provider_unavailable"],
      [new Error("invalid model configuration"), "invalid_configuration"],
      [{ status: 400, message: "raw provider body" }, "provider_error"],
    ];

    for (const [error, code] of cases) {
      const provider = new AiProvider({ DEVEXPERT_API_KEY: "hidden-key" });
      const result = await provider.run(() => {
        throw error;
      });

      expect(result).toEqual({
        ok: false,
        degraded: true,
        code,
        message: AI_DEGRADATION_MESSAGES[code as keyof typeof AI_DEGRADATION_MESSAGES],
      });
      expect(JSON.stringify(result)).not.toContain("hidden-key");
      expect(JSON.stringify(result)).not.toContain("raw provider body");
      expect(JSON.stringify(result)).not.toContain("raw secret body");
    }
  });

  it("recognizes HTTP and network signals without exposing raw errors", () => {
    expect(classifyAiError({ response: { status: 429 } })).toBe("quota_exhausted");
    expect(classifyAiError({ statusCode: "502" })).toBe("provider_unavailable");
    expect(classifyAiError({ code: "ETIMEDOUT" })).toBe("provider_unavailable");
    expect(classifyAiError({ code: "ERR_INVALID_URL" })).toBe(
      "invalid_configuration",
    );
  });
});
