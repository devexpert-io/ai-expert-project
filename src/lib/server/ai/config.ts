import "server-only";

export const DEFAULT_AI_BASE_URL = "https://inference.devexpert.io/v1";

export const DEFAULT_AI_MODELS = {
  chat: "chat",
  chatPro: "chat-pro",
  image: "image-edit",
  embedding: "embedding",
} as const;

export type AiModels = Readonly<{
  chat: string;
  chatPro: string;
  image: string;
  embedding: string;
}>;

export type AiEnvironment = Readonly<Record<string, string | undefined>>;

export type AiConfigStatus =
  | "ready"
  | "missing_api_key"
  | "invalid_configuration";

/** Public provider configuration. It deliberately contains no API key. */
export type AiConfig = Readonly<{
  baseUrl: string;
  models: AiModels;
  hasApiKey: boolean;
  status: AiConfigStatus;
}>;

type ParsedValue = {
  value: string;
  invalid: boolean;
};

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBaseUrl(value: string | undefined): ParsedValue {
  const candidate = optionalValue(value) ?? DEFAULT_AI_BASE_URL;

  try {
    const parsed = new URL(candidate);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";

    if (
      !isHttp ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return { value: DEFAULT_AI_BASE_URL, invalid: true };
    }

    return {
      value: parsed.toString().replace(/\/+$/, ""),
      invalid: false,
    };
  } catch {
    return { value: DEFAULT_AI_BASE_URL, invalid: true };
  }
}

function parseModel(value: string | undefined, fallback: string): ParsedValue {
  const model = optionalValue(value) ?? fallback;

  // Model identifiers are opaque to the adapter, but control characters and
  // whitespace almost invariably indicate a malformed env value.
  if (/[\u0000-\u001f\u007f\s]/u.test(model)) {
    return { value: fallback, invalid: true };
  }

  return { value: model, invalid: false };
}

export function readAiConfig(env: AiEnvironment = process.env): AiConfig {
  const baseUrl = parseBaseUrl(env.DEVEXPERT_BASE_URL);
  const models = {
    chat: parseModel(env.DEVEXPERT_CHAT_MODEL, DEFAULT_AI_MODELS.chat),
    chatPro: parseModel(
      env.DEVEXPERT_CHAT_PRO_MODEL,
      DEFAULT_AI_MODELS.chatPro,
    ),
    image: parseModel(env.DEVEXPERT_IMAGE_MODEL, DEFAULT_AI_MODELS.image),
    embedding: parseModel(
      env.DEVEXPERT_EMBEDDING_MODEL,
      DEFAULT_AI_MODELS.embedding,
    ),
  };
  const hasInvalidValue =
    baseUrl.invalid ||
    models.chat.invalid ||
    models.chatPro.invalid ||
    models.image.invalid ||
    models.embedding.invalid;
  const hasApiKey = Boolean(optionalValue(env.DEVEXPERT_API_KEY));

  const status: AiConfigStatus = hasInvalidValue
    ? "invalid_configuration"
    : hasApiKey
      ? "ready"
      : "missing_api_key";

  return {
    baseUrl: baseUrl.value,
    models: {
      chat: models.chat.value,
      chatPro: models.chatPro.value,
      image: models.image.value,
      embedding: models.embedding.value,
    },
    hasApiKey,
    status,
  };
}
