import { CHAT_BODY_LIMIT, CHAT_INVALID, CHAT_UNAVAILABLE, parseChatInput, type ChatResponse } from "../../../lib/chat";
import { answerChat } from "../../../lib/server/ai/chat";

export const runtime = "nodejs";
function json(body: ChatResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
class BodyTooLarge extends Error {}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CHAT_BODY_LIMIT) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) return json({ ok: false, message: CHAT_INVALID }, 400);
  let input;
  try { input = parseChatInput(await readBody(request)); }
  catch (error) { return json({ ok: false, message: CHAT_INVALID }, error instanceof BodyTooLarge ? 413 : 400); }
  if (!input) return json({ ok: false, message: CHAT_INVALID }, 400);
  try {
    const result = await answerChat(input);
    if (!result.ok) return json({ ok: false, message: result.message }, result.code === "quota_exhausted" ? 429 : 503);
    return json({ ok: true, reply: result.value }, 200);
  } catch { return json({ ok: false, message: CHAT_UNAVAILABLE }, 503); }
}
