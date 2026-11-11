import { handle, notFound } from "@/lib/api";
import { runToDocx } from "@/lib/export";

export const GET = handle<{ id: string }>(async (s, _req, { id }) => {
  const run = await s.getRun(id);
  if (!run) return notFound();
  const fund = await s.getFund(run.fund_id);
  const name = fund?.name || run.result.fund || "Fund";
  const buf = await runToDocx(run, name);
  const file = `${name} - ${run.kind === "memo" ? "IC Memo" : "What Changed"}.docx`.replace(/[^\w .-]/g, "");
  return new Response(new Uint8Array(buf), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${file}"`,
  } });
});
