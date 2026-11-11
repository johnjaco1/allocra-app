# Allocra

Allocra reads your DDQs, quarterly letters, capital account statements and notices so you don't have to.

## What it does

- **Drop anywhere.** Drag PDFs, Word, Excel, CSV or text files onto any page. Allocra works out the firm and fund, files the document there (creating the fund if it's new), summarizes it, and pulls out performance and cash flows. On a fund's page, files go straight into that fund.
- **Quarterly portfolio intelligence.** Managers reporting, material changes, potential concerns and memos drafted, plus a ranked list of important developments. Each item is labeled *from reported figures* or *AI interpretation* and links to its source page. Rules:
  - NAV down more than 10% in a quarter, after adding back distributions
  - Net IRR down 0.5 points or more
  - DPI flat for two quarters (funds 3+ years old)
  - Two documents giving conflicting figures
  - A report missing 45+ days after quarter-end
  - A capital call due within 30 days
  - Allocra's own red and amber flags
- **Portfolio dashboard.** Committed, called, distributed, unfunded and your NAV; exposure by asset class and vintage; upcoming capital calls and distributions; every fund grouped by firm.
- **Each fund:**
  - **Overview:** headline numbers, what needs attention, IRR trend.
  - **IC memo:** draft committee memo covering thesis, team, strategy, performance, terms, operations, changes since last period, manager commentary, risks and outstanding questions. Every point is cited.
  - **Performance:** fund figures and your own position by quarter, plus your cash flows.
  - **What changed:** the newest document compared against everything earlier.
  - **Documents:** sorted by period, each with a summary and key points.
- **Ask Allocra.** A chat on every page. Ask about one fund, a firm, or the whole portfolio, including the memos and change reports already run. Answers cite pages.
- **Human verification:**
  - Every figure is checked against its page. Figures whose quote can't be found are marked *uncertain* and left out of totals, charts and alerts until a person approves them.
  - Click any figure to approve or correct it. Corrections keep the original.
  - Every action is in the audit trail on **Team & data**.
- **Security:**
  - Files are read in the browser, and only text is sent.
  - Each firm is a separate workspace, enforced by database rules.
  - Owner and member roles.
  - Audit log.
  - Permanent deletion.
  - Anthropic's commercial API, which doesn't train on your data.

---

## Setup (about 30–40 minutes, one time)

You'll create three free or cheap accounts, then connect them. Keep a notes file open to paste keys into.

### Step 1: Claude API key (5 min)
1. Go to **console.anthropic.com** and sign up.
2. **Settings → Billing**: add a card and buy $20 of credit.
3. **Settings → Limits**: set a monthly spend limit (for example $100).
4. **API Keys → Create Key**. Name it "Allocra" and copy it. It starts with `sk-ant-`, and it's only shown once.

### Step 2: Supabase, for logins and the database (10 min)
1. Go to **supabase.com** → sign up → **New project**. Name it "allocra", set a strong database password, pick the US East region, and wait about 2 minutes.
2. Left sidebar → **SQL Editor** → **New query** → paste the entire contents of `supabase/schema.sql` → **Run**. You should see "Success". (It's safe to run again after future updates.)
3. Left sidebar → **Project Settings → API**. Copy three values:
   - **Project URL** (looks like `https://abcd.supabase.co`)
   - **anon public** key
   - **service_role** key (secret: never share it or put it in front-end code)
4. **Authentication → Sign In / Providers → Email**: leave it on. For faster pilots you can turn off **Confirm email**.

### Step 3: Put the code on GitHub (5 min)
1. Unzip `allocra-app.zip`.
2. On **github.com** → **New repository** → name it `allocra-app` → choose **Private** → Create.
3. On the new repo page, click **uploading an existing file**, drag in everything inside the `allocra-app` folder (not the folder itself), and click **Commit changes**.

### Step 4: Deploy on Vercel (10 min)
1. **vercel.com** → **Add New → Project** → import `allocra-app`.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `ANTHROPIC_API_KEY` | your `sk-ant-…` key |

3. Click **Deploy**. When it finishes, copy your app URL (for example `https://allocra-app.vercel.app`).
4. Vercel → your project → **Settings → Functions**: make sure **Fluid Compute** is on, because long memos take 1–3 minutes.

### Step 5: Connect logins to your URL (3 min)
1. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: your app URL
   - **Redirect URLs**: add `https://YOUR-APP-URL/auth/callback`
2. Open your app URL → **Create an account** with your work email. The first person to sign up from a firm becomes its **owner**.

### Step 6: Check it works (5 min)
1. Click **Load sample funds** → **Run Allocra on all funds**. These are fictional funds that work without AI credits.
2. Drag any PDF you're allowed to use onto the page. It should be filed and summarized within about a minute.
3. Open **Ask Allocra** and ask "Which funds need attention?"

If anything fails, Vercel → your project → **Logs** shows the error. Send it to me.

### Step 7: Link your website's Log in button
In your website's `index.html`, find `https://app.allocra.com/login` and change it to `https://YOUR-APP-URL/login`, then redeploy the site. (Later, point a custom domain like `app.allocra.com` at the Vercel project and change it back.)

### Adding a pilot customer
They go to your app URL → **Create an account** with their work email, and get their own private workspace. To add their teammates, they (as owner) open **Team & data** → enter emails → teammates sign up with those emails.

---

## Running it on your own computer (optional)
```bash
npm install
npm run dev
```
Open http://localhost:3000. Without Supabase keys there are no logins and data is saved in `.data/` on your computer only. Add `ANTHROPIC_API_KEY=sk-ant-…` to a file named `.env.local` to turn on AI. A hosted copy without Supabase refuses to open unless you set `APP_PASSWORD`, so it's never public by accident.

## Costs (estimates)

| Step | Model | Approx. cost |
|---|---|---|
| File a dropped document | Haiku | under $0.01 |
| Summarize a document and pull figures | Sonnet | $0.05–$0.30 |
| IC memo | Opus | $0.40–$1.00 |
| What changed | Sonnet | about $0.25 |
| Chat question | Sonnet | $0.02–$0.30 |

Models can be changed with `ALLOCRA_MEMO_MODEL`, `ALLOCRA_CHANGES_MODEL`, `ALLOCRA_DOC_MODEL`, `ALLOCRA_FILING_MODEL` and `ALLOCRA_CHAT_MODEL`. Supabase and Vercel are free at pilot scale.

## Not built yet
- Email ingestion (forwarding manager emails in)
- Email or Slack alerts
- Benchmarking
- Public market data
- Portfolio-company-level tracking
- Scanned-PDF OCR
- SSO
- SOC 2 Type II

## Where things are

| Path | What it does |
|---|---|
| `lib/ai.ts` | Prompts, Claude calls, citation checking, auto-filing |
| `lib/chat.ts` | Ask Allocra |
| `lib/alerts.ts` | Alert rules and portfolio intelligence |
| `lib/store.ts` | Database (Supabase, or a local file) and audit log |
| `lib/extract.ts` | PDF, Word, Excel, CSV reading in the browser |
| `components/Uploads.tsx` | Drop-anywhere upload |
| `components/Dashboard.tsx` | Portfolio intelligence and dashboard |
| `components/Workspace.tsx` | Fund page and its tabs |
| `supabase/schema.sql` | Tables and security rules |
