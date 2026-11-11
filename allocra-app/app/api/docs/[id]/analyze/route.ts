import { handle, notFound } from "@/lib/api";
import { analyzeDoc } from "@/lib/ai";

export const maxDuration = 300;

// Summarize one document and extract its performance figures.
export const POST = handle<{ id: string }>(async (s, _req, { id }) => {
  const doc = await s.getDoc(id);
  if (!doc) return notFound();
  const fund = await s.getFund(doc.fund_id);
  if (!fund) return notFound();
  const { ai } = await analyzeDoc(doc, fund);
  const patch = { ai, doc_type: ai.doc_type || doc.doc_type, as_of: ai.as_of || doc.as_of };
  await s.updateDoc(id, patch);
  await s.log("document.summarize", doc.name, { figures: ai.metrics.length, uncertain: ai.metrics.filter((m) => m.status === "uncertain").length });
  const { pages, ...meta } = { ...doc, ...patch };
  void pages;
  return { doc: meta };
});
