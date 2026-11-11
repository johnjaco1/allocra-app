import { handle } from "@/lib/api";
import { fileDocument } from "@/lib/ai";
import { DOC_TYPES } from "@/lib/types";

export const maxDuration = 60;

// Drop any document: Allocra works out the firm and fund, creates the fund if it's new, and files the document there.
export const POST = handle(async (s, req) => {
  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 200);
  const pages: string[] = Array.isArray(body.pages) ? body.pages.map((p: unknown) => String(p ?? "")) : [];
  const chars = pages.reduce((a, p) => a + p.length, 0);
  if (!name || chars < 50) throw new Error(`${name || "That file"}: no readable text. If it's a scanned PDF, run OCR first.`);
  if (chars > 3_000_000) throw new Error(`${name}: too large. Split it into smaller files.`);

  const funds = await s.listFunds();
  const f = await fileDocument(name, pages, funds);
  let fund = (f.fund_id && funds.find((x) => x.id === f.fund_id)) ||
    funds.find((x) => x.name.toLowerCase() === f.fund_name.toLowerCase()) || null;
  let created = false;
  if (!fund) {
    const nf = await s.createFund({ name: f.fund_name, manager: f.manager || null, asset_class: f.asset_class });
    fund = { ...nf, doc_count: 0, last_run: null, latest: {}, latest_as_of: null, to_review: 0 };
    created = true;
  } else if (!fund.manager && f.manager) {
    await s.updateFund(fund.id, { manager: f.manager });
  }
  const doc = await s.addDoc(fund.id, { name, pages, doc_type: (DOC_TYPES as string[]).includes(f.doc_type) ? f.doc_type : "Other", as_of: f.as_of || null });
  await s.log("document.upload", name, { fund: fund.name, filed_by: "inbox", new_fund: created });
  return { doc, fund: { id: fund.id, name: fund.name, manager: fund.manager || f.manager }, created };
});
