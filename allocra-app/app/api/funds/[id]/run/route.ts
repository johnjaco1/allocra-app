import { handle, notFound } from "@/lib/api";
import { runAnalysis } from "@/lib/ai";

export const maxDuration = 300;

export const POST = handle<{ id: string }>(async (s, req, { id }) => {
  const fund = await s.getFund(id);
  if (!fund) return notFound();
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "changes" ? "changes" : "memo";
  const docs = await s.getDocs(id);
  const out = await runAnalysis(kind, fund, docs, body.newestId);
  const run = await s.addRun({ fund_id: id, kind, ...out });
  await s.log(kind === "memo" ? "analysis.memo" : "analysis.changes", fund.name, { model: out.model });
  return { run };
});
