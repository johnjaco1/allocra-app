import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CHANGES_MODEL, DOC_MODEL, FILING_MODEL, HAS_AI_KEY, MEMO_MODEL } from "./env";
import { SAMPLE_BOOK, sampleDocAI, sampleFor } from "./sample";
import { ASSET_CLASSES, DOC_TYPES, METRICS, type AssetClass, type Citation, type Doc, type DocAI, type DocType, type Fund, type RunKind, type RunResult } from "./types";

export const NO_KEY = "AI is off: add your ANTHROPIC_API_KEY (see README) and restart Allocra.";

// ~300K tokens of documents per run. Older non-DDQ documents are dropped first if over.
const MAX_CHARS = 1_200_000;

const CITATIONS = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["doc", "page", "quote"],
    properties: {
      doc: { type: "string", description: "Exact document name as given" },
      page: { type: "integer", description: "Page number as given" },
      quote: { type: "string", description: "Short exact quote copied character for character from that page (under 30 words)" },
    },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fund", "headline", "summary", "sections", "findings", "questions", "missing"],
  properties: {
    fund: { type: "string" },
    headline: { type: "string", description: "One sentence: the single most important takeaway" },
    summary: { type: "string", description: "2-4 sentences" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body", "citations"],
        properties: { heading: { type: "string" }, body: { type: "string" }, citations: CITATIONS },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "topic", "finding", "citations"],
        properties: {
          severity: { type: "string", enum: ["red", "amber", "green"] },
          topic: { type: "string" },
          finding: { type: "string" },
          citations: CITATIONS,
        },
      },
    },
    questions: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" }, description: "Important information the documents do not provide" },
  },
};

const SYSTEM = `You are Allocra, a senior due diligence analyst working for a limited partner (LP) that invests in private funds.
You read the manager documents provided and produce work the LP's investment committee can rely on.

Rules:
- Use ONLY the documents provided. Never use outside knowledge about the manager.
- Every factual statement must be backed by citations. Each citation gives the exact document name, the page number, and a short quote copied character for character from that page.
- Flag inconsistencies between documents, and anything that breaches a limit or promise the manager stated.
- Severity: red = material concern or breach of something the manager stated; amber = worth a closer look, unclear or deteriorating; green = confirmed strength or in line.
- If something an investment committee would expect is missing, list it in "missing". Do not guess.
- Never recommend investing or not investing. The committee decides; you inform.
- Write plainly and specifically: use numbers, names and dates from the documents. No filler.`;

const MEMO_TASK = `Write a draft investment committee memo for this fund.
- summary: the executive summary, 3-5 sentences.
- sections: these headings in this order, skipping any the documents say nothing about: "Investment thesis", "Firm and team", "Strategy and portfolio construction", "Performance overview", "Terms and alignment", "Operations and risk management", "Changes since the previous period", "Manager commentary". Each body is 2-4 sentences with citations. Performance overview must quote the reported figures and their period.
- findings: 5 to 10 risks, concerns and strengths: red first, then amber, then green.
- questions: 5 to 8 outstanding questions for the manager or the committee, most important first.
- You inform the committee. Do not recommend investing or not investing.`;

const CHANGES_TASK = `Compare the NEWEST document against all EARLIER documents and report what changed.
- sections: return an empty array.
- findings: 3 to 8 changes, most important first. Each finding states the new fact AND what the earlier documents said, with numbers.
- Look for: team and key-person changes, strategy drift versus stated limits, performance, credit quality, concentration, leverage, terms and operations. Also include a green item for important things confirmed unchanged.
- Cite pages in BOTH the newest document and the earlier document(s).
- questions: 3 to 6 questions for the next manager call.`;

export function render(doc: Doc, label?: string) {
  return `<document name="${doc.name}" type="${doc.doc_type}"${label ? ` role="${label}"` : ""}>\n` +
    doc.pages.map((p, i) => `<page number="${i + 1}">\n${p}\n</page>`).join("\n") + `\n</document>`;
}

function fit(docs: Doc[], keep: Doc[]): { used: Doc[]; dropped: string[] } {
  const total = (ds: Doc[]) => ds.reduce((a, d) => a + d.chars, 0);
  let used = [...docs];
  const dropped: string[] = [];
  while (total(used) > MAX_CHARS) {
    const victim = used.find((d) => !keep.includes(d) && d.doc_type !== "DDQ") || used.find((d) => !keep.includes(d));
    if (!victim) break;
    used = used.filter((d) => d !== victim);
    dropped.push(victim.name);
  }
  if (total(used) > MAX_CHARS) throw new Error("These documents are too long for one run. Remove a document and try again.");
  return { used, dropped };
}

/* ----------------------------- citation checks ----------------------------- */
const norm = (s: string) => s.toLowerCase().replace(/[‘’“”"'`]/g, "").replace(/[^a-z0-9%$.,]+/g, " ").replace(/\s+/g, " ").trim();

function findDoc(docs: Doc[], name: string) {
  const n = name.toLowerCase().trim();
  const bare = (s: string) => s.toLowerCase().replace(/\.(pdf|docx?|txt)$/i, "").trim();
  return docs.find((d) => d.name.toLowerCase() === n) || docs.find((d) => bare(d.name) === bare(name)) ||
    docs.find((d) => bare(d.name).includes(bare(name)) || bare(name).includes(bare(d.name)));
}

function quoteOn(page: string, quote: string) {
  const p = norm(page), q = norm(quote);
  if (!q) return false;
  if (p.includes(q)) return true;
  // allow light paraphrase at the ends: any 8 consecutive words match
  const w = q.split(" ");
  if (w.length < 8) return false;
  for (let i = 0; i + 8 <= w.length; i++) if (p.includes(w.slice(i, i + 8).join(" "))) return true;
  return false;
}

export function verifyCitations(result: RunResult, docs: Doc[]): RunResult {
  const fix = (c: Citation): Citation => {
    const d = findDoc(docs, c.doc);
    if (!d) return { ...c, verified: false };
    const page = Math.round(Number(c.page));
    if (d.pages[page - 1] && quoteOn(d.pages[page - 1], c.quote)) return { ...c, doc: d.name, page, verified: true };
    const idx = d.pages.findIndex((p) => quoteOn(p, c.quote));
    if (idx >= 0) return { ...c, doc: d.name, page: idx + 1, verified: true }; // right quote, wrong page number
    return { ...c, doc: d.name, verified: false };
  };
  return {
    ...result,
    sections: (result.sections || []).map((s) => ({ ...s, citations: (s.citations || []).map(fix) })),
    findings: (result.findings || []).map((f) => ({ ...f, citations: (f.citations || []).map(fix) })),
    questions: result.questions || [],
    missing: result.missing || [],
  };
}

/* --------------------------------- run --------------------------------- */
export interface RunOutput { result: RunResult; model: string | null; input_tokens: number | null; output_tokens: number | null; doc_names: string[] }

export function pickNewest(docs: Doc[]) {
  const letters = docs.filter((d) => d.doc_type === "Quarterly letter");
  return letters.length ? letters[letters.length - 1] : docs[docs.length - 1];
}

export async function runAnalysis(kind: RunKind, fund: Fund, docs: Doc[], newestId?: string): Promise<RunOutput> {
  if (!docs.length) throw new Error("Upload at least one document first.");
  if (kind === "changes" && docs.length < 2) throw new Error("What changed needs at least two documents: the newest letter and something earlier to compare it with.");

  if (!HAS_AI_KEY) {
    const sample = fund.sample ? sampleFor(fund.name) : null;
    const canned = sample && (kind === "memo" ? sample.memo : sample.changes);
    if (canned) {
      await new Promise((r) => setTimeout(r, 2200)); // feel like a real run in demos
      return { result: verifyCitations(canned, docs), model: "sample", input_tokens: null, output_tokens: null, doc_names: docs.map((d) => d.name) };
    }
    throw new Error(NO_KEY);
  }

  let content: Anthropic.TextBlockParam[];
  let usedDocs: Doc[];
  let dropped: string[] = [];
  if (kind === "memo") {
    const f = fit(docs, docs.filter((d) => d.doc_type === "DDQ"));
    usedDocs = f.used; dropped = f.dropped;
    content = [
      { type: "text", text: `Fund: ${fund.name}${fund.strategy ? ` (${fund.strategy})` : ""}\n\nDOCUMENTS:\n\n` + usedDocs.map((d) => render(d)).join("\n\n"), cache_control: { type: "ephemeral" } },
      { type: "text", text: MEMO_TASK },
    ];
  } else {
    const newest = docs.find((d) => d.id === newestId) || pickNewest(docs);
    const f = fit(docs, [newest]);
    usedDocs = f.used; dropped = f.dropped;
    const earlier = usedDocs.filter((d) => d !== newest);
    content = [
      { type: "text", text: `Fund: ${fund.name}\n\nEARLIER DOCUMENTS:\n\n` + earlier.map((d) => render(d, "earlier")).join("\n\n"), cache_control: { type: "ephemeral" } },
      { type: "text", text: `NEWEST DOCUMENT:\n\n${render(newest, "newest")}\n\n${CHANGES_TASK}` },
    ];
  }

  const model = kind === "memo" ? MEMO_MODEL : CHANGES_MODEL;
  const { data, usage } = await callJSON<RunResult>(model, SYSTEM, content, SCHEMA, 16000);
  if (dropped.length) data.missing = [...(data.missing || []), `Not read (too long for one run): ${dropped.join(", ")}`];
  return { result: verifyCitations(data, usedDocs), model, ...usage, doc_names: usedDocs.map((d) => d.name) };
}

export async function callJSON<T>(model: string, system: string, content: Anthropic.TextBlockParam[], schema: object, max_tokens: number) {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model, max_tokens, system,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: schema as Record<string, unknown> } },
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to analyze these documents.");
  if (msg.stop_reason === "max_tokens") throw new Error("The analysis ran too long. Try again with fewer documents.");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let data: T;
  try { data = JSON.parse(text); } catch { throw new Error("The analysis came back incomplete. Try again."); }
  const u = msg.usage;
  return { data, usage: { input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output_tokens: u.output_tokens } };
}

/* ----------------------- per-document summary + metrics ----------------------- */
const CITATION = CITATIONS.items;
const DOC_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["doc_type", "as_of", "summary", "key_points", "metrics", "cash_flows"],
  properties: {
    doc_type: { type: "string", enum: DOC_TYPES },
    as_of: { type: "string", description: "Period end the document reports on, as YYYY-MM-DD (e.g. 2026-09-30 for a Q3 2026 letter). Empty string if unclear." },
    summary: { type: "string", description: "2-3 sentences: what this document is and what matters most in it" },
    key_points: { type: "array", items: { type: "object", additionalProperties: false, required: ["point", "citations"], properties: { point: { type: "string" }, citations: CITATIONS } } },
    cash_flows: {
      type: "array",
      description: "Capital calls and distributions to THIS LP stated in the document (notices and statements)",
      items: {
        type: "object", additionalProperties: false, required: ["kind", "amount", "date", "citation"],
        properties: {
          kind: { type: "string", enum: ["call", "distribution"] },
          amount: { type: "number", description: "$ millions, this LP's share" },
          date: { type: "string", description: "Due or payment date YYYY-MM-DD" },
          citation: CITATION,
        },
      },
    },
    metrics: {
      type: "array",
      description: "Figures for THIS fund only (not prior funds or the firm), plus this LP's own position if the document is addressed to the LP",
      items: {
        type: "object", additionalProperties: false, required: ["name", "value", "as_of", "citation"],
        properties: {
          name: { type: "string", enum: METRICS },
          value: { type: "number", description: "Percent as a number (12.0 for 12.0%), multiples as a number (1.21 for 1.21x), money in $ millions" },
          as_of: { type: "string", description: "YYYY-MM-DD the figure is as of" },
          citation: CITATION,
        },
      },
    },
  },
};

const DOC_TASK = `Summarize this one document for an LP's investment team and extract its figures.
- key_points: 3 to 6 of the most important facts, each with citations. Prefer numbers, limits, team, terms, portfolio company developments, and anything an LP would act on.
- metrics, fund level: net_irr, gross_irr, tvpi (net), dpi, rvpi, nav ($M), called_pct, invested_pct, fund_size ($M), distributions ($M paid by the fund in the period).
- metrics, this LP's own account (capital account statements, notices): commitment, paid_in (contributions to date), unfunded, lp_distributions (to date), lp_nav (ending capital balance). All in $M.
- cash_flows: every capital call or distribution to this LP with its amount and due/payment date.
- Only figures the document states. Never compute, estimate or reconcile numbers.`;

export async function analyzeDoc(doc: Doc, fund: Fund): Promise<{ ai: DocAI; usage: { input_tokens: number | null; output_tokens: number | null } }> {
  if (!HAS_AI_KEY) {
    const s = fund.sample ? sampleDocAI(doc.name) : null;
    if (s) { await new Promise((r) => setTimeout(r, 700)); return { ai: verifyDocAI(s, doc), usage: { input_tokens: null, output_tokens: null } }; }
    throw new Error(NO_KEY);
  }
  const text = doc.chars > MAX_CHARS ? { ...doc, pages: doc.pages.slice(0, Math.floor(doc.pages.length * MAX_CHARS / doc.chars)) } : doc;
  const { data, usage } = await callJSON<DocAI>(DOC_MODEL, SYSTEM, [
    { type: "text", text: `Fund: ${fund.name}${fund.manager ? ` (manager: ${fund.manager})` : ""}\n\n${render(text)}` },
    { type: "text", text: DOC_TASK },
  ], DOC_SCHEMA, 6000);
  return { ai: verifyDocAI(data, doc), usage };
}

function verifyDocAI(ai: DocAI, doc: Doc): DocAI {
  const flows = ai.cash_flows || [];
  const r = verifyCitations({ fund: "", headline: "", summary: "", sections: [], questions: [], missing: [],
    findings: [...ai.key_points.map((k) => ({ severity: "green" as const, topic: "", finding: k.point, citations: k.citations })),
      ...ai.metrics.map((m) => ({ severity: "green" as const, topic: m.name, finding: "", citations: [m.citation] })),
      ...flows.map((f) => ({ severity: "green" as const, topic: f.kind, finding: "", citations: [f.citation] }))] }, [doc]);
  const n = ai.key_points.length, nm = ai.metrics.length;
  const date = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : "");
  return {
    ...ai,
    doc_type: (DOC_TYPES as string[]).includes(ai.doc_type) ? ai.doc_type : "Other",
    as_of: date(ai.as_of),
    key_points: ai.key_points.map((k, i) => ({ ...k, citations: r.findings[i].citations })),
    // A figure whose quote can't be found on the page is kept but marked uncertain, and is left out of
    // totals, charts and alerts until a person approves or corrects it.
    metrics: ai.metrics.filter((m) => (METRICS as readonly string[]).includes(m.name) && Number.isFinite(m.value)).map((m) => {
      const c = r.findings[n + ai.metrics.indexOf(m)].citations[0];
      return { ...m, as_of: date(m.as_of) || date(ai.as_of), citation: c, status: c.verified ? "auto" as const : "uncertain" as const };
    }),
    cash_flows: flows.map((f, i) => ({ ...f, date: date(f.date), citation: r.findings[n + nm + i].citations[0] }))
      .filter((f) => f.citation.verified && f.date && Number.isFinite(f.amount)),
  };
}

/* ------------------------ inbox: file a document by firm and fund ------------------------ */
export interface Filing { manager: string; fund_name: string; fund_id: string | null; doc_type: DocType; as_of: string; asset_class: AssetClass | null }

const FILE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["manager", "fund_name", "match_fund_id", "doc_type", "as_of", "asset_class"],
  properties: {
    manager: { type: "string", description: "The GP / management firm, e.g. 'Halden Ridge Capital'" },
    fund_name: { type: "string", description: "The specific fund, e.g. 'Halden Ridge Credit Fund III'" },
    match_fund_id: { type: "string", description: "id of the existing fund this document belongs to, or empty string if none matches" },
    doc_type: { type: "string", enum: DOC_TYPES },
    as_of: { type: "string", description: "Period end as YYYY-MM-DD, or empty string" },
    asset_class: { type: "string", enum: ASSET_CLASSES },
  },
};

export async function fileDocument(name: string, pages: string[], funds: Fund[]): Promise<Filing> {
  if (!HAS_AI_KEY) return fileByRules(name, pages, funds);
  const head = pages.join("\n\n").slice(0, 12000);
  const list = funds.map((f) => `- id ${f.id}: ${f.name}${f.manager ? ` (manager: ${f.manager})` : ""}`).join("\n") || "(none yet)";
  const { data } = await callJSON<{ manager: string; fund_name: string; match_fund_id: string; doc_type: DocType; as_of: string; asset_class: AssetClass }>(FILING_MODEL,
    "You file private fund documents for an LP. Identify the management firm, the specific fund, the document type and its period. Match to an existing fund only if it is clearly the same fund (same name and number).",
    [{ type: "text", text: `EXISTING FUNDS:\n${list}\n\nFILE NAME: ${name}\n\nFIRST PAGES:\n${head}` }], FILE_SCHEMA, 800);
  const match = funds.find((f) => f.id === data.match_fund_id) || null;
  return { manager: data.manager.trim(), fund_name: data.fund_name.trim() || name.replace(/\.[a-z]+$/i, ""), fund_id: match?.id || null,
    doc_type: (DOC_TYPES as string[]).includes(data.doc_type) ? data.doc_type : "Other", as_of: /^\d{4}-\d{2}-\d{2}$/.test(data.as_of) ? data.as_of : "",
    asset_class: (ASSET_CLASSES as readonly string[]).includes(data.asset_class) ? data.asset_class : null };
}

// Fallback without an API key: match on fund names and numbers in the file name and first page.
function fileByRules(name: string, pages: string[], funds: Fund[]): Filing {
  for (const s of SAMPLE_BOOK) {
    const d = s.docs.find((x) => x.name === name);
    if (d) return { manager: s.fund.manager, fund_name: s.fund.name, fund_id: funds.find((f) => f.name === s.fund.name)?.id || null, doc_type: d.doc_type, as_of: d.as_of, asset_class: s.fund.asset_class };
  }
  const hay = (name + " " + (pages[0] || "")).toLowerCase();
  const generic = new Set(["fund", "funds", "partners", "capital", "credit", "growth", "the", "lp", "l.p.", "equity", "ventures", "venture"]);
  let best: Fund | null = null, score = 0;
  for (const f of funds) {
    const words = f.name.toLowerCase().split(/\s+/);
    const num = words.find((w) => /^(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/.test(w));
    const hits = words.filter((w) => !generic.has(w) && w !== num && hay.includes(w)).length;
    if (!hits) continue; // the firm or fund name must appear, not just a number
    const numOk = !num || new RegExp(`\\b${num}\\b`).test(hay);
    if (!numOk) continue;
    const sc = hits + (num ? 1 : 0);
    if (sc > score) { score = sc; best = f; }
  }
  const t = name.toLowerCase();
  const doc_type: DocType = /ddq|questionnaire/.test(t) ? "DDQ" : /capital call|distribution notice|notice/.test(t) ? "Capital call / distribution notice" : /capital account|statement/.test(t) ? "Capital account statement" : /letter|quarter|\bq[1-4]\b|report/.test(t) ? "Quarterly letter" : /ppm|lpa|agreement|memorandum/.test(t) ? "PPM / LPA" : /deck|presentation/.test(t) ? "Pitch deck" : "Other";
  if (best && score >= 1) return { manager: best.manager || "", fund_name: best.name, fund_id: best.id, doc_type, as_of: "", asset_class: best.asset_class };
  return { manager: "Unsorted", fund_name: name.replace(/\.[a-z]+$/i, ""), fund_id: null, doc_type, as_of: "", asset_class: null };
}
