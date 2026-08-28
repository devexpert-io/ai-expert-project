import "server-only";

import OpenAI from "openai";
import {
  readAiConfig,
  type AiEnvironment,
  type AiModels,
} from "./config";

export type AiDegradationCode =
  | "missing_api_key"
  | "quota_exhausted"
  | "invalid_api_key"
  | "provider_unavailable"
  | "invalid_configuration"
  | "provider_error";

export type AiResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      degraded: true;
      code: AiDegradationCode;
      message: string;
    };

export const AI_DEGRADATION_MESSAGES: Readonly<
  Record<AiDegradationCode, string>
> = {
  missing_api_key:
    "La IA no está configurada. Añade DEVEXPERT_API_KEY para habilitarla.",
  quota_exhausted:
    "El cupo semanal de IA está agotado. Inténtalo de nuevo más tarde.",
  invalid_api_key: "La clave de IA no es válida.",
  provider_unavailable:
    "El proveedor de IA no está disponible temporalmente. Inténtalo de nuevo.",
  invalid_configuration: "La configuración del proveedor de IA no es válida.",
  provider_error: "La operación de IA no está disponible en este momento.",
};

export type AiOperation<T> = (
  client: OpenAI,
  models: AiModels,
) => T | PromiseLike<T>;

export function classifyAiError(error: unknown): AiDegradationCode {
  const status = readStatus(error);
  const codes = readCodes(error);

  if (status === 429) {
    return "quota_exhausted";
  }

  if (status === 401 || status === 403) {
    return "invalid_api_key";
  }

  if (status !== undefined && status >= 500 && status <= 599) {
    return "provider_unavailable";
  }

  if (status === 408) {
    return "provider_unavailable";
  }

  if (
    codes.some((code) =>
      ["insufficient_quota", "rate_limit_exceeded"].includes(code),
    )
  ) {
    return "quota_exhausted";
  }

  if (isNetworkError(error)) {
    return "provider_unavailable";
  }

  if (isInvalidConfigurationError(error)) {
    return "invalid_configuration";
  }

  return "provider_error";
}

function readProperty(value: unknown, key: string): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return undefined;
  }

  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function readStatus(error: unknown): number | undefined {
  const candidates = [
    readProperty(error, "status"),
    readProperty(error, "statusCode"),
    readProperty(readProperty(error, "response"), "status"),
  ];

  for (const candidate of candidates) {
    const status =
      typeof candidate === "number"
        ? candidate
        : typeof candidate === "string" && /^\d{3}$/u.test(candidate)
          ? Number(candidate)
          : undefined;
    if (status !== undefined && Number.isInteger(status)) {
      return status;
    }
  }

  return undefined;
}

function readCodes(error: unknown): string[] {
  const nestedError = readProperty(error, "error");
  const nestedBody = readProperty(error, "body");
  const values = [
    readProperty(error, "code"),
    readProperty(error, "type"),
    readProperty(nestedError, "code"),
    readProperty(nestedError, "type"),
    readProperty(nestedBody, "code"),
    readProperty(readProperty(nestedBody, "error"), "code"),
  ];

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
}

function errorText(error: unknown): string {
  const message = readProperty(error, "message");
  const name = readProperty(error, "name");
  return [
    typeof name === "string" ? name : "",
    typeof message === "string" ? message : "",
  ]
    .join(" ")
    .toLowerCase();
}

function isNetworkError(error: unknown): boolean {
  const codes = readCodes(error);
  const text = errorText(error);
  const networkCodes = new Set([
    "econnreset",
    "econnrefused",
    "enotfound",
    "eai_again",
    "etimedout",
    "err_network",
    "err_socket_closed",
    "econnaborted",
    "enetunreach",
    "ehostunreach",
  ]);

  return (
    codes.some((code) => networkCodes.has(code)) ||
    /(api connection|network|fetch failed|connection|timed out|timeout|socket|abort)/u.test(
      text,
    )
  );
}

function isInvalidConfigurationError(error: unknown): boolean {
  const codes = readCodes(error);
  const text = errorText(error);

  return (
    [
      "err_invalid_url",
      "invalid_url",
      "invalid_base_url",
      "invalid_model",
      "model_not_found",
      "configuration_error",
    ].some((code) => codes.includes(code)) ||
    /(invalid (configuration|config|url|base url|model)|absolute url|unsupported protocol|model (is )?(required|missing|invalid)|malformed (url|model))/u.test(
      text,
    )
  );
}

function degraded(code: AiDegradationCode): AiResult<never> {
  return {
    ok: false,
    degraded: true,
    code,
    message: AI_DEGRADATION_MESSAGES[code],
  };
}

export class AiProvider {
  private client: OpenAI | undefined;

  private clientApiKey: string | undefined;

  private clientBaseUrl: string | undefined;

  constructor(private readonly env: AiEnvironment = process.env) {}

  async run<T>(operation: AiOperation<T>): Promise<AiResult<T>> {
    const config = readAiConfig(this.env);

    if (config.status === "invalid_configuration") {
      this.clearClient();
      return degraded("invalid_configuration");
    }

    if (!config.hasApiKey) {
      this.clearClient();
      return degraded("missing_api_key");
    }

    const apiKey = this.env.DEVEXPERT_API_KEY?.trim() ?? "";
    let client: OpenAI;

    try {
      client = this.getClient(apiKey, config.baseUrl);
    } catch (error) {
      this.clearClient();
      return degraded(classifyAiError(error));
    }

    try {
      const value = await operation(client, config.models);
      return { ok: true, value };
    } catch (error) {
      return degraded(classifyAiError(error));
    }
  }

  private getClient(apiKey: string, baseUrl: string): OpenAI {
    if (
      this.client &&
      this.clientApiKey === apiKey &&
      this.clientBaseUrl === baseUrl
    ) {
      return this.client;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      maxRetries: 0,
    });
    this.clientApiKey = apiKey;
    this.clientBaseUrl = baseUrl;
    return this.client;
  }

  private clearClient(): void {
    this.client = undefined;
    this.clientApiKey = undefined;
    this.clientBaseUrl = undefined;
  }
}

export function createAiProvider(env: AiEnvironment = process.env): AiProvider {
  return new AiProvider(env);
}

export const createProvider = createAiProvider;
export const getAiProvider = createAiProvider;
export const aiProvider = createAiProvider();
export const provider = aiProvider;

export function run<T>(
  operation: AiOperation<T>,
  env: AiEnvironment = process.env,
): Promise<AiResult<T>> {
  return createAiProvider(env).run(operation);
}

export default aiProvider;
