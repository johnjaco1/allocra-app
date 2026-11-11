import { handle } from "@/lib/api";
import { answer, type ChatTurn } from "@/lib/chat";

export const maxDuration = 120;

export const POST = handle(async (s, req) => {
  const b = await req.json();
  const q = String(b.question || "").trim().slice(0, 2000);
  if (!q) throw new Error("Ask a question.");
  const history: ChatTurn[] = Array.isArray(b.history) ? b.history.slice(-8).map((t: ChatTurn) => ({ role: t.role === "assistant" ? "assistant" : "user", text: String(t.text || "").slice(0, 4000) })) : [];
  return answer(s, q, history, b.fundId || null);
});
