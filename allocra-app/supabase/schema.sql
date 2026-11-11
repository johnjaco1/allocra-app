-- Allocra database schema. Paste into Supabase > SQL Editor > New query > Run.
-- Every row belongs to an org (a customer firm). Row-level security means a
-- signed-in user can only ever read or write their own firm's rows.

create extension if not exists pgcrypto;

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My firm',
  created_at timestamptz not null default now()
);

create table if not exists members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create unique index if not exists members_one_org_per_user on members(user_id);

create table if not exists invites (
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);

create table if not exists funds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  manager text,
  name text not null,
  strategy text,
  vintage int,
  sample boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists funds_org on funds(org_id);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  fund_id uuid not null references funds(id) on delete cascade,
  name text not null,
  doc_type text not null,
  as_of text,
  ai jsonb,
  page_count int not null,
  chars int not null,
  pages jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists documents_fund on documents(fund_id);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  fund_id uuid not null references funds(id) on delete cascade,
  kind text not null check (kind in ('memo', 'changes')),
  result jsonb not null,
  doc_names text[] not null default '{}',
  model text,
  input_tokens int,
  output_tokens int,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists runs_fund on runs(fund_id);

-- Upgrades for databases created from an earlier version of this file
alter table funds add column if not exists manager text;
alter table documents add column if not exists as_of text;
alter table documents add column if not exists ai jsonb;
alter table funds add column if not exists asset_class text;
alter table funds add column if not exists commitment numeric;

-- Audit trail: who did what, when (uploads, deletions, analyses, figure approvals and corrections)
create table if not exists audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null,
  detail jsonb
);
create index if not exists audit_org_at on audit(org_id, at desc);

create or replace function is_member(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid());
$$;

alter table orgs enable row level security;
alter table members enable row level security;
alter table invites enable row level security;
alter table funds enable row level security;
alter table documents enable row level security;
alter table runs enable row level security;
alter table audit enable row level security;

drop policy if exists orgs_read on orgs;
create policy orgs_read on orgs for select using (is_member(id));
drop policy if exists members_read on members;
create policy members_read on members for select using (is_member(org_id));
drop policy if exists invites_read on invites;
create policy invites_read on invites for select using (is_member(org_id));

drop policy if exists funds_all on funds;
create policy funds_all on funds for all using (is_member(org_id)) with check (is_member(org_id));
drop policy if exists documents_all on documents;
create policy documents_all on documents for all using (is_member(org_id)) with check (is_member(org_id));
drop policy if exists runs_all on runs;
create policy runs_all on runs for all using (is_member(org_id)) with check (is_member(org_id));

-- Audit rows can be read and added by members, never edited or deleted (except when the whole firm is deleted).
drop policy if exists audit_read on audit;
create policy audit_read on audit for select using (is_member(org_id));
drop policy if exists audit_add on audit;
create policy audit_add on audit for insert with check (is_member(org_id));
