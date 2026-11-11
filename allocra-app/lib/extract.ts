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

async function readPdf(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let s = "";
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof it.str !== "string") continue;
      s += it.str + (it.hasEOL ? "\n" : it.str.endsWith(" ") ? "" : " ");
    }
    pages.push(s.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim());
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

export async function extractPages(file: File): Promise<string[]> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".xlsx")) return readXlsx(file);
  if (n.endsWith(".csv")) { const t = await file.text(); const out: string[] = []; for (let i = 0; i < t.length; i += SECTION) out.push(t.slice(i, i + SECTION)); return out; }
  if (n.endsWith(".pdf")) return readPdf(file);
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
