import { handle, notFound } from "@/lib/api";
import { DOC_TYPES, type DocType } from "@/lib/types";

const MAX_DOC_CHARS = 3_000_000;

export const POST = handle<{ id: string }>(async (s, req, { id }) => {
  if (!(await s.getFund(id))) return notFound();
  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 200);
  const doc_type = (DOC_TYPES as string[]).includes(body.doc_type) ? (body.doc_type as DocType) : "Other";
  const pages = Array.isArray(body.pages) ? body.pages.map((p: unknown) => String(p ?? "")) : [];
  if (!name || !pages.length) throw new Error("That file had no readable text.");
  const chars = pages.reduce((a: number, p: string) => a + p.length, 0);
  if (chars < 50) throw new Error("No text found. If this is a scanned PDF, run it through OCR first.");
  if (chars > MAX_DOC_CHARS) throw new Error("That document is too large. Split it into smaller files.");
  const doc = await s.addDoc(id, { name, doc_type, pages });
  await s.log("document.upload", name, { fund_id: id, pages: pages.length });
  return { doc };
});
