"use client";
// Reads documents in the browser. Only extracted text is sent to the server; the original file never leaves the user's computer.
import type { DocType } from "./types";

const SECTION = 3500; // characters per "page" for DOCX and TXT, which have no real pages

function chunk(text: string): string[] {
  const paras = text.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > SECTION) { out.push(cur); cur = ""; }
    if (p.length > SECTION) { for (let i = 0; i < p.length; i += SECTION) out.push(p.slice(i, i + SECTION)); continue; }
    cur = cur ? cur + "\n\n" + p : p;
  }
  if (cur) out.push(cur);
  return out;
}

const MIN_TEXT = 40;     // a page with less text than this is treated as scanned
const OCR_BATCH = 6;     // page images per request (keeps each request well under hosting limits)
const MAX_SCANNED = 400; // safety cap per document

type Progress = (msg: string) => void;

// Renders one page to a JPEG (as base64) so Claude can read it. The image is used once and never stored.
async function pageImage(page: { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void> } }) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 1400 / base.width);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.72);
  canvas.width = canvas.height = 0;
  return url.slice(url.indexOf(",") + 1);
}

async function readPdf(file: File, progress?: Progress): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const scanned: number[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let s = "";
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof it.str !== "string") continue;
      s += it.str + (it.hasEOL ? "\n" : it.str.endsWith(" ") ? "" : " ");
    }
    const text = s.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
    pages.push(text);
    if (text.replace(/\s/g, "").length < MIN_TEXT) scanned.push(i);
    if (i % 25 === 0) progress?.(`Reading page ${i} of ${pdf.numPages}`);
  }
  if (!scanned.length) return pages;
  if (scanned.length > MAX_SCANNED) throw new Error(`${file.name} has ${scanned.length} scanned pages. Split it into files of ${MAX_SCANNED} pages or fewer.`);

  // Scanned pages: send page images to Claude in small batches and keep only the text it returns.
  let done = 0;
  for (let b = 0; b < scanned.length; b += OCR_BATCH) {
    const nums = scanned.slice(b, b + OCR_BATCH);
    progress?.(`Reading scanned pages ${done + 1}–${done + nums.length} of ${scanned.length}`);
    const images: { page: number; data: string }[] = [];
    for (const n of nums) images.push({ page: n, data: await pageImage(await pdf.getPage(n) as never) });
    const r = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, images }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Couldn't read the scanned pages.");
    for (const p of j.pages as { page: number; text: string }[]) if (nums.includes(p.page)) pages[p.page - 1] = p.text.trim();
    done += nums.length;
  }
  return pages;
}

async function readDocx(file: File): Promise<string[]> {
  // @ts-expect-error browser build has no types
  const mammoth = (await import("mammoth/mammoth.browser")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return chunk(value);
}

// Each worksheet becomes one or more "pages" of tab-separated rows, so figures can be cited by sheet.
async function readXlsx(file: File): Promise<string[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const pages: string[] = [];
  wb.eachSheet((ws) => {
    const rows: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          if (o.richText) return o.richText.map((t) => t.text).join("");
          if (o.result !== undefined) return String(o.result);
          if (o.text !== undefined) return String(o.text);
          if (v instanceof Date) return v.toISOString().slice(0, 10);
        }
        return String(v);
      });
      if (vals.some((x) => x.trim())) rows.push(vals.join("\t"));
    });
    const text = `Sheet: ${ws.name}\n` + rows.join("\n");
    for (let i = 0; i < text.length; i += SECTION) pages.push(text.slice(i, i + SECTION));
  });
  return pages;
}

export async function extractPages(file: File, progress?: Progress): Promise<string[]> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xlsx")) return readXlsx(file);
  if (n.endsWith(".csv")) { const t = await file.text(); const out: string[] = []; for (let i = 0; i < t.length; i += SECTION) out.push(t.slice(i, i + SECTION)); return out; }
  if (n.endsWith(".pdf")) return readPdf(file, progress);
  if (n.endsWith(".docx")) return readDocx(file);
  if (n.endsWith(".txt") || n.endsWith(".md")) return chunk(await file.text());
  throw new Error(`${file.name}: use PDF, Word, Excel, CSV or TXT.`);
}

export function guessType(name: string): DocType {
  const n = name.toLowerCase();
  if (/\bddq\b|due diligence|questionnaire/.test(n)) return "DDQ";
  if (/capital call|distribution notice|notice/.test(n)) return "Capital call / distribution notice";
  if (/capital account|statement/.test(n)) return "Capital account statement";
  if (/letter|quarterly|\bq[1-4]\b|update|report/.test(n)) return "Quarterly letter";
  if (/\bppm\b|\blpa\b|memorandum|agreement|offering/.test(n)) return "PPM / LPA";
  if (/deck|presentation|pitch/.test(n)) return "Pitch deck";
  return "Other";
}
