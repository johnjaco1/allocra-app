import { handle } from "@/lib/api";
import { ocrPages } from "@/lib/ai";

export const maxDuration = 120;

// Reads scanned PDF pages. Images are passed straight to Claude and never saved; only the text comes back.
export const POST = handle(async (s, req) => {
  const b = await req.json();
  const images = Array.isArray(b.images) ? b.images : [];
  if (!images.length || images.length > 8) throw new Error("Send 1 to 8 pages at a time.");
  const clean = images.map((x: { page: unknown; data: unknown }) => ({ page: Math.round(Number(x.page)), data: String(x.data || "") }));
  if (clean.some((x: { page: number; data: string }) => !x.page || x.data.length < 100 || x.data.length > 1_400_000)) throw new Error("A page image was empty or too large.");
  const pages = await ocrPages(clean);
  await s.log("document.ocr", String(b.name || "scanned PDF").slice(0, 200), { pages: clean.length });
  return { pages };
});
