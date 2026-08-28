import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODELS,
  readAiConfig,
} from "./config";

describe("readAiConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses safe defaults and reports a missing key without exposing one", () => {
    const config = readAiConfig({});

    expect(config).toEqual({
      baseUrl: DEFAULT_AI_BASE_URL,
      models: DEFAULT_AI_MODELS,
      hasApiKey: false,
      status: "missing_api_key",
    });
    expect(JSON.stringify(config)).not.toContain("DEVEXPERT_API_KEY");
  });

  it("trims and applies endpoint/model overrides", () => {
    const secret = "secret-for-test";
    const config = readAiConfig({
      DEVEXPERT_API_KEY: `  ${secret}  `,
      DEVEXPERT_BASE_URL: "  https://ai.example.test/v1///  ",
      DEVEXPERT_CHAT_MODEL: "  custom-chat  ",
      DEVEXPERT_CHAT_PRO_MODEL: " custom-chat-pro ",
      DEVEXPERT_IMAGE_MODEL: " custom-image ",
      DEVEXPERT_EMBEDDING_MODEL: " custom-embedding ",
    });

    expect(config).toEqual({
      baseUrl: "https://ai.example.test/v1",
      models: {
        chat: "custom-chat",
        chatPro: "custom-chat-pro",
        image: "custom-image",
        embedding: "custom-embedding",
      },
      hasApiKey: true,
      status: "ready",
    });
    expect(JSON.stringify(config)).not.toContain(secret);
  });

  it.each(["", "   ", "ftp://ai.example.test/v1", "not-a-url"])(
    "degrades invalid base URL %j without throwing",
    (baseUrl) => {
      const config = readAiConfig({
        DEVEXPERT_API_KEY: "configured",
        DEVEXPERT_BASE_URL: baseUrl,
      });

      expect(config.status).toBe(
        baseUrl.trim() === "" ? "ready" : "invalid_configuration",
      );
      expect(config.baseUrl).toBe(DEFAULT_AI_BASE_URL);
    },
  );

  it("uses defaults for empty optional overrides and rejects malformed model ids", () => {
    expect(
      readAiConfig({
        DEVEXPERT_CHAT_MODEL: " ",
        DEVEXPERT_CHAT_PRO_MODEL: "\t",
      }).models,
    ).toEqual(DEFAULT_AI_MODELS);

    const config = readAiConfig({
      DEVEXPERT_API_KEY: "configured",
      DEVEXPERT_CHAT_MODEL: "chat model",
    });
    expect(config.status).toBe("invalid_configuration");
  });
});
