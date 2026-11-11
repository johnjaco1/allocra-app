import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import Workspace from "@/components/Workspace";

export const dynamic = "force-dynamic";

export default async function FundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  if (!store) redirect("/login");
  const fund = await store.getFund(id);
  if (!fund) notFound();
  const [docs, runs] = await Promise.all([store.listDocs(id), store.listRuns(id)]);
  return <Workspace fund={fund} initialDocs={docs} initialRuns={runs} />;
}
