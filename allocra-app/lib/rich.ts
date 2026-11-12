// Light formatting for AI-written text. Pure functions, safe on server and client.
//   **bold**              -> bold
//   [[good|text]]         -> green highlight (improvement / strength)
//   [[bad|text]]          -> red highlight (deterioration / risk)
//   "- " at line start    -> bullet
// Numbers are linked to their source automatically when the same number appears in one of the
// citations' quotes, so a link only ever exists where the source really says it.

import type { Citation } from "./types";

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold"; v: Inline[] }
  | { t: "tone"; tone: "good" | "bad"; v: Inline[] }
  | { t: "num"; v: string; cite: Citation };

export type Block = { t: "p"; v: Inline[] } | { t: "ul"; items: Inline[][] };

const NUM = /(?:[$€£]\s?)?[-+]?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|x|bps|pts|points?|million|billion|[MBK])\b|%|x\b)?/g;

// The digits that identify a number, e.g. "$1.25 billion" -> "1.25", "12.0%" -> "12.0"
function core(s: string) {
  const m = s.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}
const isYear = (s: string) => /^(19|20)\d{2}$/.test(s.trim());

export function findCite(numText: string, cites: Citation[]): Citation | null {
  const c = core(numText);
  if (!c || (isYear(numText) && !/[%$x]/.test(numText))) return null;
  if (c.replace(".", "").length < 2 && !/[%$x]/.test(numText)) return null; // skip lone digits like "2 loans"
  const re = new RegExp(`(^|[^\\d.])${c.replace(".", "\\.")}(?![\\d])`);
  const hit = cites.find((q) => q.verified !== false && re.test(q.quote.replace(/,/g, "")));
  return hit || null;
}

function linkNumbers(text: string, cites: Citation[]): Inline[] {
  if (!cites.length) return [{ t: "text", v: text }];
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(NUM)) {
    const v = m[0].trim();
    if (!v) continue;
    const cite = findCite(v, cites);
    if (!cite) continue;
    const start = m.index! + m[0].indexOf(v);
    if (start > last) out.push({ t: "text", v: text.slice(last, start) });
    out.push({ t: "num", v, cite });
    last = start + v.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

export function parseInline(text: string, cites: Citation[] = []): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[\[(good|bad)\|(.+?)\]\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(...linkNumbers(text.slice(last, m.index), cites));
    if (m[1] !== undefined) out.push({ t: "bold", v: linkNumbers(m[1], cites) });
    else out.push({ t: "tone", tone: m[2] as "good" | "bad", v: linkNumbers(m[3], cites) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(...linkNumbers(text.slice(last), cites));
  return out;
}

export function parseBlocks(text: string, cites: Citation[] = []): Block[] {
  const blocks: Block[] = [];
  let list: Inline[][] | null = null;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    const b = line.match(/^[-•*]\s+(.*)$/);
    if (b) { (list ||= []).push(parseInline(b[1], cites)); continue; }
    if (list) { blocks.push({ t: "ul", items: list }); list = null; }
    if (line) blocks.push({ t: "p", v: parseInline(line, cites) });
  }
  if (list) blocks.push({ t: "ul", items: list });
  return blocks;
}

// For Word export, copy-to-clipboard and AI context: remove the markup, keep the words.
export function plain(text: string) {
  return String(text || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(?:good|bad)\|(.+?)\]\]/g, "$1");
}

// Instructions shared by every prompt that writes text the app displays.
export const FORMAT_RULES = `Formatting (the app renders these):
- Wrap the single most important phrase in each answer or finding in **double asterisks**. Use bold sparingly, once or twice per paragraph at most.
- Mark a clear improvement as [[good|text]] and a clear deterioration or risk as [[bad|text]], e.g. "net IRR fell to [[bad|11.2%]]". Use these only for real changes or risks, never for decoration.
- Write every figure exactly as it appears in your cited quote (same number, same units) so the app can link it to the source page.
- For lists, put each item on its own line starting with "- ".`;
