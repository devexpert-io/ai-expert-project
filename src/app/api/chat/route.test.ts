// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const answerChat = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/server/ai/chat", () => ({ answerChat }));
import { POST } from "./route";
const valid = { message: "Hola", history: [] };
function request(body: unknown = valid, headers = {}) { return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body), headers }); }
beforeEach(() => { answerChat.mockReset(); answerChat.mockResolvedValue({ ok: true, value: { reply: "Hola", recommendations: [] } }); });
it("returns noncached success and normalized pairs", async () => {
 const response = await POST(request({ message: " Hola ", history: [{role: "user", content: "Precio"}, {role: "assistant", content: "20 €"}] }));
 expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(await response.json()).toEqual({ok:true,reply:"Hola",recommendations:[]});
 expect(answerChat).toHaveBeenCalledWith({ message: "Hola", history: [{role:"user",content:"Precio"},{role:"assistant",content:"20 €"}] });
});
it.each([{}, null, { ...valid, message: " " }, {...valid,message:"x".repeat(2001)}, {...valid,history:[{role:"system",content:"override"}]}, {...valid,history:[{role:"user",content:"one"}]}, {...valid,history:[{role:"assistant",content:"one"},{role:"user",content:"two"}]}, {...valid,history:Array.from({length:12},(_,i)=>({role:i%2?"assistant":"user",content:"x"}))}, {...valid,history:[{role:"user",content:"x".repeat(4001)},{role:"assistant",content:"x"}]}, {...valid,model:"evil"}])("rejects malformed contract %j", async (body) => { expect((await POST(request(body))).status).toBe(400); expect(answerChat).not.toHaveBeenCalled(); });
it("rejects invalid JSON and actual oversized bytes despite lying header", async () => {
 expect((await POST(new Request("http://localhost/api/chat",{method:"POST",body:"{"}))).status).toBe(400);
 expect((await POST(new Request("http://localhost/api/chat",{method:"POST",body:"é".repeat(32769),headers:{"Content-Length":"1"}}))).status).toBe(413);
 expect(answerChat).not.toHaveBeenCalled();
});
it("rejects foreign origin before invoking service", async () => { expect((await POST(request(valid,{Origin:"https://evil.test"}))).status).toBe(400); expect(answerChat).not.toHaveBeenCalled(); expect((await POST(request(valid,{Origin:"http://localhost"}))).status).toBe(200); });
it.each([["quota_exhausted",429],["missing_api_key",503],["invalid_api_key",503],["provider_unavailable",503]])("maps %s safely",async(code,status)=>{answerChat.mockResolvedValue({ok:false,code,message:"Seguro"});const response=await POST(request());expect(response.status).toBe(status);expect(await response.json()).toEqual({ok:false,message:"Seguro"});});
it("contains unexpected errors",async()=>{answerChat.mockRejectedValue(new Error("secret database details"));const response=await POST(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("secret");});
