import { handle, notFound } from "@/lib/api";
import { DOC_TYPES, type DocType } from "@/lib/types";

export const GET = handle<{ id: string }>(async (s, _req, { id }) => {
  const doc = await s.getDoc(id);
  return doc ? { doc } : notFound();
});

export const DELETE = handle<{ id: string }>(async (s, _req, { id }) => {
  const d = await s.getDoc(id);
  await s.deleteDoc(id);
  if (d) await s.log("document.delete", d.name);
});

export const PATCH = handle<{ id: string }>(async (s, req, { id }) => {
  const { doc_type, as_of } = await req.json();
  const p: { doc_type?: DocType; as_of?: string | null } = {};
  if (doc_type !== undefined) {
    if (!(DOC_TYPES as string[]).includes(doc_type)) throw new Error("Unknown document type.");
    p.doc_type = doc_type;
  }
  if (as_of !== undefined) p.as_of = /^\d{4}-\d{2}-\d{2}$/.test(as_of) ? as_of : null;
  await s.updateDoc(id, p);
  await s.log("document.edit", id, p);
});
