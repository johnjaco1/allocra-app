import { handle, notFound } from "@/lib/api";
import { METRIC_LABEL } from "@/lib/types";

// A person approves an extracted figure, or corrects it. The original value is always kept.
export const PATCH = handle<{ id: string }>(async (s, req, { id }) => {
  const doc = await s.getDoc(id);
  if (!doc?.ai) return notFound();
  const { index, action, value } = await req.json();
  const m = doc.ai.metrics[index];
  if (!m) return notFound();
  const at = new Date().toISOString();
  const before = m.value;
  if (action === "approve") {
    Object.assign(m, { status: m.status === "corrected" ? "corrected" : "approved", reviewed_by: s.user.email, reviewed_at: at });
  } else if (action === "correct") {
    const v = Number(value);
    if (!Number.isFinite(v)) throw new Error("Enter a number.");
    Object.assign(m, { original: m.original ?? m.value, value: v, status: "corrected", reviewed_by: s.user.email, reviewed_at: at });
  } else if (action === "reset") {
    Object.assign(m, { value: m.original ?? m.value, status: m.citation.verified ? "auto" : "uncertain" });
    delete m.original; delete m.reviewed_by; delete m.reviewed_at;
  } else throw new Error("Unknown action.");
  await s.updateDoc(id, { ai: doc.ai });
  await s.log(`figure.${action}`, doc.name, { metric: METRIC_LABEL[m.name], as_of: m.as_of, from: before, to: m.value });
  return { metric: m };
});
