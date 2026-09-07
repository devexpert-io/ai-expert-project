export const CHAT_MESSAGE_LIMIT = 2000;
export const CHAT_CONTENT_LIMIT = 4000;
export const CHAT_HISTORY_LIMIT = 10;
export const CHAT_BODY_LIMIT = 64 * 1024;
export const CHAT_UNAVAILABLE = "El chat no está disponible temporalmente. Inténtalo de nuevo.";
export const CHAT_INVALID = "Revisa el mensaje y vuelve a intentarlo.";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatInput = { message: string; history: ChatMessage[] };
export type ChatRecommendation = Readonly<{
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  categoryName: string;
  priceCents: number;
  variant: Readonly<{
    id: string;
    size: string;
    color: string;
    priceCents: number;
    stock: number;
  }> | null;
}>;
export type ChatResponse =
  | { ok: true; reply: string; recommendations: readonly ChatRecommendation[] }
  | { ok: false; message: string };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function content(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}
export function parseChatInput(value: unknown): ChatInput | null {
  if (!object(value) || Object.keys(value).some((key) => !["message", "history"].includes(key)) ||
    !content(value.message, CHAT_MESSAGE_LIMIT) || !Array.isArray(value.history) ||
    value.history.length > CHAT_HISTORY_LIMIT || value.history.length % 2 !== 0) return null;
  const history: ChatMessage[] = [];
  for (const [index, item] of value.history.entries()) {
    if (!object(item) || Object.keys(item).some((key) => !["role", "content"].includes(key)) ||
      item.role !== (index % 2 === 0 ? "user" : "assistant") || !content(item.content, CHAT_CONTENT_LIMIT)) return null;
    history.push({ role: index % 2 === 0 ? "user" : "assistant", content: item.content.trim() });
  }
  return { message: value.message.trim(), history };
}
