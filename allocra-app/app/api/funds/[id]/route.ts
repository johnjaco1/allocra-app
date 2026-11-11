import { handle, notFound } from "@/lib/api";
import { ASSET_CLASSES } from "@/lib/types";

export const GET = handle<{ id: string }>(async (s, _req, { id }) => {
  const fund = await s.getFund(id);
  if (!fund) return notFound();
  const [docs, runs] = await Promise.all([s.listDocs(id), s.listRuns(id)]);
  return { fund, docs, runs };
});

export const PATCH = handle<{ id: string }>(async (s, req, { id }) => {
  const b = await req.json();
  const p: Record<string, unknown> = {};
  if (typeof b.manager === "string") p.manager = b.manager.trim().slice(0, 160) || null;
  if (typeof b.name === "string" && b.name.trim()) p.name = b.name.trim().slice(0, 160);
  if (typeof b.strategy === "string") p.strategy = b.strategy.trim().slice(0, 160) || null;
  if (b.asset_class !== undefined) p.asset_class = (ASSET_CLASSES as readonly string[]).includes(b.asset_class) ? b.asset_class : null;
  if (b.commitment !== undefined) { const v = parseFloat(b.commitment); p.commitment = Number.isFinite(v) && v >= 0 ? v : null; }
  if (b.vintage !== undefined) { const v = parseInt(b.vintage, 10); p.vintage = v > 1950 && v < 2100 ? v : null; }
  await s.updateFund(id, p);
  await s.log("fund.edit", id, p);
});

export const DELETE = handle<{ id: string }>(async (s, _req, { id }) => {
  const f = await s.getFund(id);
  await s.deleteFund(id);
  if (f) await s.log("fund.delete", f.name);
});
