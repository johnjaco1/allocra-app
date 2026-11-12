import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { callJSON, NO_KEY, render, verifyCitations } from "./ai";
import { CHAT_MODEL, HAS_AI_KEY } from "./env";
import { FORMAT_RULES } from "./rich";
import type { Store } from "./store";
import { METRIC_LABEL, type Citation, type Doc, type MetricName, type Run } from "./types";

export interface ChatRef extends Citation { fund: string; fund_id: string | null; doc_id: string | null }
export interface ChatAnswer { answer: string; refs: ChatRef[] }
export interface ChatTurn { role: "user" | "assistant"; text: string }

const FULL_TEXT_BUDGET = 600_000; // characters of raw document text for the fund in focus (~150K tokens)
const SUMMARY_BUDGET = 250_000;   // characters of summaries/findings across the rest of the book

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["answer", "refs"],
  properties: {
    answer: { type: "string", description: "Direct, specific answer. Short paragraphs; use '- ' lines for lists. Name funds, firms, numbers and periods." },
    refs: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["fund", "doc", "page", "quote"],
        properties: {
          fund: { type: "string", description: "Exact fund name" },
          doc: { type: "string", description: "Exact document name" },
          page: { type: "integer" },
          quote: { type: "string", description: "Short exact quote from that page" },
        },
      },
    },
  },
};

const SYSTEM = `You are Allocra, an AI analyst for an LP investment team. You answer questions about the team's private fund managers (firms), their funds, the documents the team has uploaded, and the analyses Allocra has already run (IC memos, what-changed reports, document summaries and performance figures).
Rules:
- Use ONLY the material provided below. If it doesn't contain the answer, say so plainly and say what document would answer it.
- Back factual claims with refs (fund, exact document name, page, short exact quote). Prefer citing documents over citing Allocra's own analyses.
- Be direct: lead with the answer, then the supporting detail. Compare across funds or firms when asked.
- Every figure in your answer must appear, written the same way, in the quote of one of your refs, so the user can click it to see the source.
- Never recommend investing or not investing.

${FORMAT_RULES}`;

const metricLine = (latest: Partial<Record<MetricName, number>>) =>
  (Object.entries(latest) as [MetricName, number][]).map(([k, v]) => `${METRIC_LABEL[k]} ${v}`).join(", ");

function runBlock(r: Run) {
  const x = r.result;
  return `${r.kind === "memo" ? "IC MEMO" : "WHAT CHANGED"} (${r.created_at.slice(0, 10)}): ${x.headline}\n${x.summary}\n` +
    x.findings.map((f) => `- [${f.severity}] ${f.topic}: ${f.finding} (${f.citations.map((c) => `${c.doc} p.${c.page}`).join("; ")})`).join("\n") +
    (x.questions.length ? `\nOpen questions: ${x.questions.join(" | ")}` : "");
}

function docBlock(d: Doc) {
  if (!d.ai) return `- ${d.name} [${d.doc_type}${d.as_of ? `, ${d.as_of}` : ""}] (not summarized yet)`;
  return `- ${d.name} [${d.doc_type}${d.as_of ? `, ${d.as_of}` : ""}]: ${d.ai.summary}\n` +
    d.ai.key_points.map((k) => `    · ${k.point} (${k.citations.map((c) => `p.${c.page}`).join(", ")})`).join("\n");
}

export async function answer(store: Store, question: string, history: ChatTurn[], fundId?: string | null): Promise<ChatAnswer> {
  if (!HAS_AI_KEY) throw new Error(NO_KEY);
  const funds = await store.listFunds();
  if (!funds.length) return { answer: "There's nothing in Allocra yet. Drop a DDQ or quarterly letter anywhere in the app and ask again.", refs: [] };
  const focus = fundId ? funds.find((f) => f.id === fundId) || null : null;

  const allDocs: { fund: string; fund_id: string; doc: Doc }[] = [];
  const parts: string[] = [];
  let summaryBudget = SUMMARY_BUDGET, fullBudget = FULL_TEXT_BUDGET;
  // the fund in focus first, then the rest of its firm, then everything else
  const order = [...funds].sort((a, b) => (a.id === focus?.id ? -1 : b.id === focus?.id ? 1 : 0) ||
    (focus?.manager ? (a.manager === focus.manager ? -1 : 0) - (b.manager === focus.manager ? -1 : 0) : 0));

  for (const f of order) {
    const [docs, runs] = await Promise.all([store.getDocs(f.id), store.listRuns(f.id)]);
    docs.forEach((d) => allDocs.push({ fund: f.name, fund_id: f.id, doc: d }));
    const lastMemo = runs.find((r) => r.kind === "memo"), lastChange = runs.find((r) => r.kind === "changes");
    let block = `## FUND: ${f.name}\nFirm: ${f.manager || "unknown"} · Strategy: ${f.strategy || "n/a"} · Vintage: ${f.vintage || "n/a"}\n` +
      `Latest figures${f.latest_as_of ? ` (as of ${f.latest_as_of})` : ""}: ${metricLine(f.latest) || "none extracted"}\n` +
      (lastMemo ? runBlock(lastMemo) + "\n" : "") + (lastChange ? runBlock(lastChange) + "\n" : "") +
      `Documents:\n${docs.map(docBlock).join("\n") || "(none)"}`;
    if (f.id === focus?.id) {
      const texts: string[] = [];
      for (const d of [...docs].reverse()) { // newest first
        if (d.chars > fullBudget) continue;
        fullBudget -= d.chars; texts.push(render(d));
      }
      block += `\n\nFULL TEXT OF THIS FUND'S DOCUMENTS:\n${texts.join("\n\n")}`;
      parts.push(block);
    } else if (summaryBudget > 0) {
      const b = block.slice(0, summaryBudget); summaryBudget -= b.length; parts.push(b);
    }
  }

  const convo = history.slice(-8).map((t) => `${t.role === "user" ? "Q" : "A"}: ${t.text}`).join("\n");
  const content: Anthropic.TextBlockParam[] = [
    { type: "text", text: `THE TEAM'S BOOK (${funds.length} funds across ${new Set(funds.map((f) => f.manager || "Other")).size} firms)${focus ? `. The user is looking at ${focus.name}.` : ""}\n\n${parts.join("\n\n")}`, cache_control: { type: "ephemeral" } },
    { type: "text", text: `${convo ? `EARLIER IN THIS CONVERSATION:\n${convo}\n\n` : ""}QUESTION: ${question}` },
  ];
  const { data } = await callJSON<{ answer: string; refs: { fund: string; doc: string; page: number; quote: string }[] }>(CHAT_MODEL, SYSTEM, content, SCHEMA, 4000);

  const refs: ChatRef[] = (data.refs || []).map((r) => {
    const hit = allDocs.find((x) => x.doc.name === r.doc) || allDocs.find((x) => x.doc.name.toLowerCase().includes(String(r.doc).toLowerCase().replace(/\.(pdf|docx?|txt)$/i, "")));
    if (!hit) return { ...r, fund_id: null, doc_id: null, verified: false };
    const v = verifyCitations({ fund: "", headline: "", summary: "", sections: [], questions: [], missing: [], findings: [{ severity: "green", topic: "", finding: "", citations: [r] }] }, [hit.doc]).findings[0].citations[0];
    return { ...v, fund: hit.fund, fund_id: hit.fund_id, doc_id: hit.doc.id };
  });
  return { answer: data.answer, refs };
}
