import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEMO_MODE } from "./env";
import { adminClient, userClient } from "./supabase";
import { latestMetrics, type AssetClass, type AuditEvent, type Doc, type DocAI, type DocMeta, type DocType, type Fund, type FundSummary, type Member, type Run, type RunKind, type RunResult } from "./types";

export interface NewDoc { name: string; doc_type: DocType; pages: string[]; as_of?: string | null; ai?: DocAI | null }
export interface NewFund { name: string; manager?: string | null; asset_class?: AssetClass | null; commitment?: number | null; strategy?: string | null; vintage?: number | null; sample?: boolean }
export interface NewRun {
  fund_id: string; kind: RunKind; result: RunResult; doc_names: string[];
  model: string | null; input_tokens: number | null; output_tokens: number | null;
}

export interface Store {
  user: { id: string; email: string };
  orgName: string;
  role: "owner" | "member";
  log(action: string, target: string, detail?: Record<string, unknown>): Promise<void>;
  listAudit(limit?: number): Promise<AuditEvent[]>;
  listFunds(): Promise<FundSummary[]>;
  createFund(f: NewFund): Promise<Fund>;
  updateFund(id: string, f: Partial<NewFund>): Promise<void>;
  getFund(id: string): Promise<Fund | null>;
  deleteFund(id: string): Promise<void>;
  listDocs(fundId: string): Promise<DocMeta[]>;
  getDocs(fundId: string): Promise<Doc[]>;
  getDoc(id: string): Promise<Doc | null>;
  addDoc(fundId: string, d: NewDoc): Promise<DocMeta>;
  deleteDoc(id: string): Promise<void>;
  updateDoc(id: string, p: { doc_type?: DocType; as_of?: string | null; ai?: DocAI | null }): Promise<void>;
  listRuns(fundId: string): Promise<Run[]>;
  getRun(id: string): Promise<Run | null>;
  addRun(r: NewRun): Promise<Run>;
  deleteRun(id: string): Promise<void>;
  listMembers(): Promise<Member[]>;
  invite(email: string): Promise<void>;
  deleteAllData(): Promise<void>;
}

const meta = (d: Doc): DocMeta => { const { pages, ...m } = d; void pages; return m; };
const sortDocs = <T extends Pick<DocMeta, "as_of" | "created_at">>(ds: T[]) =>
  [...ds].sort((a, b) => (a.as_of || "9999").localeCompare(b.as_of || "9999") || a.created_at.localeCompare(b.created_at));

function summarize(funds: Fund[], docs: Pick<DocMeta, "fund_id" | "ai" | "as_of" | "created_at">[], runs: Run[]): FundSummary[] {
  return funds.map((f) => {
    const fd = docs.filter((d) => d.fund_id === f.id);
    const last = runs.filter((r) => r.fund_id === f.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const fi = last?.result?.findings || [];
    const { latest, asOf } = latestMetrics(fd);
    const to_review = fd.reduce((a, d) => a + (d.ai?.metrics || []).filter((m) => m.status === "uncertain").length, 0);
    return {
      ...f, asset_class: f.asset_class || null, commitment: f.commitment ?? null, doc_count: fd.length, latest, latest_as_of: asOf, to_review,
      last_run: last ? { kind: last.kind, created_at: last.created_at, headline: last.result?.headline || "",
        red: fi.filter((x) => x.severity === "red").length, amber: fi.filter((x) => x.severity === "amber").length } : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Demo store: a local JSON file. One built-in demo user, no login.    */
/* ------------------------------------------------------------------ */
interface DB { funds: Fund[]; docs: Doc[]; runs: Run[]; members: Member[]; audit?: AuditEvent[] }
const DATA_DIR = process.env.VERCEL ? "/tmp/allocra" : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
function load(): DB {
  try { return JSON.parse(readFileSync(DB_FILE, "utf8")); } catch { return { funds: [], docs: [], runs: [], members: [] }; }
}
function save(db: DB) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(db));
}
const now = () => new Date().toISOString();

function demoStore(): Store {
  const user = { id: "local-user", email: process.env.ALLOCRA_LOCAL_EMAIL || "you@yourfirm.com" };
  return {
    user,
    orgName: process.env.ALLOCRA_LOCAL_FIRM || "Your firm",
    role: "owner",
    async log(action, target, detail) { const db = load(); db.audit = [{ id: randomUUID(), at: now(), actor: user.email, action, target, detail: detail || null }, ...(db.audit || [])].slice(0, 2000); save(db); },
    async listAudit(limit = 200) { return (load().audit || []).slice(0, limit); },
    async listFunds() { const db = load(); return summarize(db.funds, db.docs, db.runs); },
    async createFund(f) {
      const db = load();
      const fund: Fund = { id: randomUUID(), manager: f.manager || null, name: f.name, asset_class: f.asset_class || null, commitment: f.commitment ?? null,
        strategy: f.strategy || null, vintage: f.vintage || null, sample: !!f.sample, created_at: now() };
      db.funds.push(fund); save(db); return fund;
    },
    async updateFund(id, f) { const db = load(); const x = db.funds.find((y) => y.id === id); if (x) Object.assign(x, f); save(db); },
    async getFund(id) { return load().funds.find((f) => f.id === id) || null; },
    async deleteFund(id) {
      const db = load();
      db.funds = db.funds.filter((f) => f.id !== id);
      db.docs = db.docs.filter((d) => d.fund_id !== id);
      db.runs = db.runs.filter((r) => r.fund_id !== id);
      save(db);
    },
    async listDocs(fundId) { return sortDocs(load().docs.filter((d) => d.fund_id === fundId)).map(meta); },
    async getDocs(fundId) { return sortDocs(load().docs.filter((d) => d.fund_id === fundId)); },
    async getDoc(id) { return load().docs.find((d) => d.id === id) || null; },
    async addDoc(fundId, d) {
      const db = load();
      const doc: Doc = { id: randomUUID(), fund_id: fundId, name: d.name, doc_type: d.doc_type, pages: d.pages, as_of: d.as_of || null, ai: d.ai || null,
        page_count: d.pages.length, chars: d.pages.reduce((a, p) => a + p.length, 0), created_at: now() };
      db.docs.push(doc); save(db); return meta(doc);
    },
    async deleteDoc(id) { const db = load(); db.docs = db.docs.filter((d) => d.id !== id); save(db); },
    async updateDoc(id, p) { const db = load(); const d = db.docs.find((x) => x.id === id); if (d) Object.assign(d, p); save(db); },
    async listRuns(fundId) { return load().runs.filter((r) => r.fund_id === fundId).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async getRun(id) { return load().runs.find((r) => r.id === id) || null; },
    async addRun(r) { const db = load(); const run: Run = { id: randomUUID(), created_at: now(), ...r }; db.runs.push(run); save(db); return run; },
    async deleteRun(id) { const db = load(); db.runs = db.runs.filter((r) => r.id !== id); save(db); },
    async listMembers() { return [{ email: user.email, role: "owner" }, ...load().members]; },
    async invite(email) { const db = load(); if (!db.members.some((m) => m.email === email)) db.members.push({ email, role: "member", pending: true }); save(db); },
    async deleteAllData() { const db = load(); save({ funds: [], docs: [], runs: [], members: db.members, audit: db.audit }); },
  };
}

/* ------------------------------------------------------------------ */
/* Production store: Supabase with row-level security.                 */
/* ------------------------------------------------------------------ */
async function ensureOrg(userId: string, email: string): Promise<{ orgId: string; orgName: string; role: "owner" | "member" }> {
  const admin = adminClient();
  const { data: m } = await admin.from("members").select("org_id, role, orgs(name)").eq("user_id", userId).maybeSingle();
  if (m) return { orgId: m.org_id, role: m.role === "owner" ? "owner" : "member", orgName: (m as unknown as { orgs: { name: string } | null }).orgs?.name || "My firm" };
  const e = email.toLowerCase();
  const { data: inv } = await admin.from("invites").select("org_id").eq("email", e).limit(1).maybeSingle();
  let orgId = inv?.org_id as string | undefined;
  let role = "member";
  if (orgId) {
    await admin.from("invites").delete().eq("org_id", orgId).eq("email", e);
  } else {
    const domain = e.split("@")[1] || "";
    const { data: org, error } = await admin.from("orgs").insert({ name: domain ? domain.split(".")[0] : "My firm" }).select("id").single();
    if (error) throw error;
    orgId = org.id; role = "owner";
  }
  const { error: me } = await admin.from("members").insert({ org_id: orgId, user_id: userId, email: e, role });
  if (me) throw me;
  const { data: o } = await admin.from("orgs").select("name").eq("id", orgId).single();
  return { orgId: orgId!, orgName: o?.name || "My firm", role: role === "owner" ? "owner" : "member" };
}

async function supabaseStore(): Promise<Store | null> {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const email = user.email || "";
  const { orgId, orgName, role } = await ensureOrg(user.id, email);
  const must = <T,>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };
  const META = "id, fund_id, name, doc_type, as_of, ai, page_count, chars, created_at";

  return {
    user: { id: user.id, email },
    orgName,
    role,
    async log(action, target, detail) { await sb.from("audit").insert({ org_id: orgId, actor: email, action, target, detail: detail || null }); },
    async listAudit(limit = 200) { return must(await sb.from("audit").select("*").order("at", { ascending: false }).limit(limit)) as AuditEvent[]; },
    async listFunds() {
      const funds = must(await sb.from("funds").select("*").order("created_at")) as Fund[];
      const docs = must(await sb.from("documents").select("fund_id, ai, as_of, created_at")) as DocMeta[];
      const runs = must(await sb.from("runs").select("id, fund_id, kind, result, created_at")) as Run[];
      return summarize(funds, docs, runs);
    },
    async createFund(f) {
      return must(await sb.from("funds").insert({ org_id: orgId, manager: f.manager || null, name: f.name, asset_class: f.asset_class || null, commitment: f.commitment ?? null, strategy: f.strategy || null,
        vintage: f.vintage || null, sample: !!f.sample, created_by: user.id }).select("*").single()) as Fund;
    },
    async updateFund(id, f) { must(await sb.from("funds").update(f).eq("id", id)); },
    async getFund(id) { return (await sb.from("funds").select("*").eq("id", id).maybeSingle()).data as Fund | null; },
    async deleteFund(id) { must(await sb.from("funds").delete().eq("id", id)); },
    async listDocs(fundId) { return sortDocs(must(await sb.from("documents").select(META).eq("fund_id", fundId)) as DocMeta[]); },
    async getDocs(fundId) { return sortDocs(must(await sb.from("documents").select("*").eq("fund_id", fundId)) as Doc[]); },
    async getDoc(id) { return (await sb.from("documents").select("*").eq("id", id).maybeSingle()).data as Doc | null; },
    async addDoc(fundId, d) {
      return must(await sb.from("documents").insert({ org_id: orgId, fund_id: fundId, name: d.name, doc_type: d.doc_type, pages: d.pages,
        as_of: d.as_of || null, ai: d.ai || null, page_count: d.pages.length, chars: d.pages.reduce((a, p) => a + p.length, 0),
        created_by: user.id }).select(META).single()) as DocMeta;
    },
    async deleteDoc(id) { must(await sb.from("documents").delete().eq("id", id)); },
    async updateDoc(id, p) { must(await sb.from("documents").update(p).eq("id", id)); },
    async listRuns(fundId) { return must(await sb.from("runs").select("*").eq("fund_id", fundId).order("created_at", { ascending: false })) as Run[]; },
    async getRun(id) { return (await sb.from("runs").select("*").eq("id", id).maybeSingle()).data as Run | null; },
    async addRun(r) { return must(await sb.from("runs").insert({ org_id: orgId, created_by: user.id, ...r }).select("*").single()) as Run; },
    async deleteRun(id) { must(await sb.from("runs").delete().eq("id", id)); },
    async listMembers() {
      const ms = must(await sb.from("members").select("email, role").order("created_at")) as Member[];
      const inv = must(await sb.from("invites").select("email")) as { email: string }[];
      return [...ms, ...inv.map((i) => ({ email: i.email, role: "member", pending: true }))];
    },
    async invite(e) {
      const admin = adminClient();
      const address = e.toLowerCase();
      const { data: existing } = await admin.from("members").select("org_id").eq("email", address).maybeSingle();
      if (existing) throw new Error(existing.org_id === orgId ? "Already on your team." : "That person already belongs to another firm.");
      must(await admin.from("invites").upsert({ org_id: orgId, email: address, invited_by: user.id }));
    },
    async deleteAllData() { must(await sb.from("funds").delete().eq("org_id", orgId)); },
  };
}

export async function getStore(): Promise<Store | null> {
  return DEMO_MODE ? demoStore() : supabaseStore();
}
