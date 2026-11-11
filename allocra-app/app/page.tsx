import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { buildIntelligence } from "@/lib/alerts";
import NewFund from "@/components/NewFund";
import Inbox from "@/components/Inbox";
import AnalyzeAll from "@/components/AnalyzeAll";
import PortfolioTable from "@/components/PortfolioTable";
import Dashboard from "@/components/Dashboard";
import type { DocMeta, Run } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await getStore();
  if (!store) redirect("/login");
  const funds = await store.listFunds();
  const hasSample = funds.some((f) => f.sample);
  const docs: Record<string, DocMeta[]> = {}, runs: Record<string, Run[]> = {}, docIndex: Record<string, string> = {};
  await Promise.all(funds.map(async (f) => {
    [docs[f.id], runs[f.id]] = await Promise.all([store.listDocs(f.id), store.listRuns(f.id)]);
    for (const d of docs[f.id]) docIndex[f.id + "|" + d.name] = d.id;
  }));
  const intel = buildIntelligence(funds, docs, runs);

  return (
    <>
      <div className="topline">
        <div>
          <div className="crumb">{store.orgName}</div>
          <h1>Portfolio</h1>
          <div className="sub">Instead of reading every report, see the things that deserve your attention.</div>
        </div>
        <div className="row">
          {!hasSample && <NewFund sampleOnly />}
          <NewFund />
          {funds.length > 0 && <AnalyzeAll funds={funds.map((f) => ({ id: f.id, name: f.name }))} />}
        </div>
      </div>

      <Inbox />

      {funds.length === 0 ? (
        <div className="card empty" style={{ marginTop: 14 }}>
          <h2>Start your book</h2>
          <p className="muted">Drop DDQs, quarterly letters, capital account statements and capital call notices anywhere. Allocra files each one under the right firm and fund, summarizes it, tracks performance and cash flows, and flags what changed.</p>
          <NewFund sampleOnly big />
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          <Dashboard intel={intel} docIndex={docIndex} />
          <PortfolioTable funds={funds} />
        </div>
      )}
    </>
  );
}
