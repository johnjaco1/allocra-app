import { handle } from "@/lib/api";
import { SAMPLE_BOOK } from "@/lib/sample";
import { ASSET_CLASSES } from "@/lib/types";

export const GET = handle(async (s) => ({ funds: await s.listFunds() }));

export const POST = handle(async (s, req) => {
  const body = await req.json().catch(() => ({}));
  if (body.sample) {
    // Load the fictional sample book (2 firms, 3 funds). Documents come in un-analyzed so the demo shows Allocra working.
    const existing = await s.listFunds();
    let first = existing.find((f) => f.sample) || null;
    for (const sf of SAMPLE_BOOK) {
      if (existing.some((f) => f.sample && f.name === sf.fund.name)) continue;
      const fund = await s.createFund({ ...sf.fund, sample: true });
      first = first || { ...fund, doc_count: 0, last_run: null, latest: {}, latest_as_of: null, to_review: 0 };
      for (const d of sf.docs) await s.addDoc(fund.id, { name: d.name, doc_type: d.doc_type, pages: d.pages, as_of: d.as_of });
    }
    await s.log("fund.create", "Sample funds");
    return { fund: first };
  }
  const name = String(body.name || "").trim().slice(0, 160);
  if (!name) throw new Error("Give the fund a name.");
  const vintage = body.vintage ? parseInt(body.vintage, 10) : null;
  const commitment = parseFloat(body.commitment);
  const fund = await s.createFund({
    name, manager: String(body.manager || "").trim().slice(0, 160) || null,
    asset_class: (ASSET_CLASSES as readonly string[]).includes(body.asset_class) ? body.asset_class : null,
    commitment: Number.isFinite(commitment) && commitment >= 0 ? commitment : null,
    strategy: String(body.strategy || "").trim().slice(0, 160) || null,
    vintage: vintage && vintage > 1950 && vintage < 2100 ? vintage : null,
  });
  await s.log("fund.create", name);
  return { fund };
});
