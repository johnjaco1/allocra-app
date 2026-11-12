import type { AssetClass, CashFlow, DocAI, DocType, Metric, MetricName, RunResult } from "./types";

// A fictional fund for demos. Every name and number here is made up.
export const SAMPLE_FUND = {
  name: "Halden Ridge Credit Fund III",
  strategy: "Senior secured direct lending",
  vintage: 2024,
};

export const SAMPLE_DOCS: { name: string; doc_type: DocType; pages: string[] }[] = [
  {
    name: "Halden Ridge Fund III - DDQ.pdf",
    doc_type: "DDQ",
    pages: [
      "Section 1: Firm overview. Halden Ridge Capital was founded in 2016 and is headquartered in Chicago. The firm has 31 employees, including 9 investment professionals. Firm AUM is $2.1 billion across three commingled funds and two separately managed accounts. The firm is 100% employee owned.",
      "Section 2: Investment strategy. The Fund will focus on sponsor-backed first-lien senior secured loans to U.S. middle-market companies with $15 million to $75 million of EBITDA. Non-sponsored loans are expected to represent no more than 15% of commitments. Maximum single-borrower exposure is 5% of commitments. The Fund targets a net IRR of 10% to 12%. The Fund may use fund-level leverage of up to 1.0x debt to equity.",
      "Section 3: Team. Co-portfolio managers Elena Brandt and Marcus Ortiz lead all investment decisions and chair the investment committee. The investment committee has four voting members and requires a unanimous vote. Two members of the investment team departed in 2024, including the head of portfolio monitoring. The firm expects to hire a replacement in 2025.",
      "Section 4: Track record. Fund I (2017 vintage, $410 million) has a net IRR of 9.8% and a net TVPI of 1.42x. Fund II (2020 vintage, $780 million) has a net IRR of 11.4% and a net TVPI of 1.21x. Since inception the firm has realized a cumulative annualized loss rate of 0.3%.",
      "Section 5: Terms. Target fund size is $1.0 billion with a hard cap of $1.25 billion. Management fee is 1.5% on invested capital. Carried interest is 15% over a 7% preferred return with a full catch-up. The GP commitment is 1% of total commitments. A key-person event is triggered if either Elena Brandt or Marcus Ortiz ceases to devote substantially all of their business time to the Fund.",
      "Section 6: Operations and compliance. The Fund's administrator is Northgate Fund Services. The auditor is a top-ten accounting firm. Valuations are prepared internally each quarter and reviewed by an independent valuation agent semi-annually. The firm has not been subject to any regulatory action. The chief compliance officer also serves as chief financial officer.",
    ],
  },
  {
    name: "Halden Ridge Q2 2026 Letter.pdf",
    doc_type: "Quarterly letter",
    pages: [
      "Dear Limited Partners, Fund III ended the second quarter 64% invested across 38 borrowers. Net IRR since inception is 12.0%. Net TVPI is 1.07x and DPI is 0.04x. Fund NAV is $566 million. The portfolio's weighted average loan-to-value is 41%.",
      "Portfolio. Sponsor-backed loans represent 82% of the portfolio; non-sponsored loans represent 18%. There are no loans on non-accrual. The largest single borrower represents 3.9% of commitments.",
      "Team. Co-portfolio managers Elena Brandt and Marcus Ortiz continue to lead all investment decisions. We hired a new head of portfolio monitoring in April.",
    ],
  },
  {
    name: "Halden Ridge Q3 2026 Letter.pdf",
    doc_type: "Quarterly letter",
    pages: [
      "Dear Limited Partners, Fund III ended the third quarter 79% invested across 47 borrowers. Net IRR since inception is 11.2%, reflecting markdowns on two healthcare services borrowers. Net TVPI is 1.09x and DPI is 0.06x. Fund NAV is $701 million. The portfolio's weighted average loan-to-value is 46%.",
      "Portfolio. Sponsor-backed loans represent 69% of the portfolio; non-sponsored loans represent 31%. Two loans were placed on non-accrual during the quarter, totaling 3.4% of NAV. The largest single borrower represents 5.6% of commitments.",
      "Team. Marcus Ortiz has transitioned to a senior advisory role effective September 1. Elena Brandt will lead the portfolio. The investment committee will continue with three voting members.",
      "Terms and operations. There are no changes to fees, the preferred return or key-person provisions. Fund-level leverage was 0.8x at quarter end.",
    ],
  },
];

const DDQ = "Halden Ridge Fund III - DDQ.pdf";
const Q2 = "Halden Ridge Q2 2026 Letter.pdf";
const Q3 = "Halden Ridge Q3 2026 Letter.pdf";

export const SAMPLE_MEMO: RunResult = {
  fund: "Halden Ridge Credit Fund III",
  headline: "Experienced middle-market lender with good loss history, but the team has thinned and the strategy is drifting outside its stated limits.",
  summary: "Halden Ridge is a $2.1 billion, employee-owned direct lender targeting a 10% to 12% net IRR from sponsor-backed first-lien loans. Prior funds show low realized losses, and Fund II is ahead of Fund I. The main concerns are team stability (two departures in 2024 and a co-PM stepping back in 2026), non-sponsored lending well above the 15% limit, and a combined CFO and CCO role.",
  sections: [
    { heading: "Firm and team", body: "Founded in 2016 in Chicago, 31 employees with 9 investment professionals, and 100% employee owned. Two co-portfolio managers chair a four-person investment committee that requires unanimity. Two investment team members left in 2024, including the head of portfolio monitoring; a replacement was hired in April 2026.",
      citations: [{ doc: DDQ, page: 1, quote: "The firm has 31 employees, including 9 investment professionals." }, { doc: DDQ, page: 3, quote: "Two members of the investment team departed in 2024, including the head of portfolio monitoring." }, { doc: Q2, page: 3, quote: "We hired a new head of portfolio monitoring in April." }] },
    { heading: "Strategy and portfolio construction", body: "Sponsor-backed first-lien loans to companies with $15 million to $75 million of EBITDA. Stated limits: non-sponsored loans no more than 15% of commitments, single borrower no more than 5%, and fund leverage up to 1.0x.",
      citations: [{ doc: DDQ, page: 2, quote: "Non-sponsored loans are expected to represent no more than 15% of commitments." }, { doc: DDQ, page: 2, quote: "Maximum single-borrower exposure is 5% of commitments." }] },
    { heading: "Track record", body: "Fund I: 9.8% net IRR and 1.42x net TVPI. Fund II: 11.4% net IRR and 1.21x net TVPI, still early. Cumulative annualized loss rate of 0.3% since inception.",
      citations: [{ doc: DDQ, page: 4, quote: "Fund I (2017 vintage, $410 million) has a net IRR of 9.8% and a net TVPI of 1.42x." }, { doc: DDQ, page: 4, quote: "cumulative annualized loss rate of 0.3%" }] },
    { heading: "Terms and alignment", body: "1.5% management fee on invested capital, 15% carry over a 7% preferred return with full catch-up, and a 1% GP commitment. The key-person clause names both co-PMs.",
      citations: [{ doc: DDQ, page: 5, quote: "Management fee is 1.5% on invested capital." }, { doc: DDQ, page: 5, quote: "The GP commitment is 1% of total commitments." }] },
    { heading: "Operations and risk management", body: "Third-party administrator and a top-ten auditor. Valuations are internal, with independent review only twice a year. The CCO is also the CFO.",
      citations: [{ doc: DDQ, page: 6, quote: "reviewed by an independent valuation agent semi-annually" }, { doc: DDQ, page: 6, quote: "The chief compliance officer also serves as chief financial officer." }] },
  ],
  findings: [
    { severity: "red", topic: "Key person", finding: "Co-PM Marcus Ortiz moved to an advisory role on September 1. The DDQ triggers a key-person event if either co-PM stops devoting substantially all of their time, yet the Q3 letter says key-person provisions are unchanged and does not mention a trigger.",
      citations: [{ doc: Q3, page: 3, quote: "Marcus Ortiz has transitioned to a senior advisory role effective September 1." }, { doc: DDQ, page: 5, quote: "A key-person event is triggered if either Elena Brandt or Marcus Ortiz ceases to devote substantially all of their business time to the Fund." }] },
    { severity: "red", topic: "Strategy drift", finding: "Non-sponsored loans are 31% of the portfolio, more than double the 15% limit stated in the DDQ.",
      citations: [{ doc: Q3, page: 2, quote: "non-sponsored loans represent 31%" }, { doc: DDQ, page: 2, quote: "Non-sponsored loans are expected to represent no more than 15% of commitments." }] },
    { severity: "amber", topic: "Concentration", finding: "The largest borrower is 5.6% of commitments, above the 5% maximum.",
      citations: [{ doc: Q3, page: 2, quote: "The largest single borrower represents 5.6% of commitments." }, { doc: DDQ, page: 2, quote: "Maximum single-borrower exposure is 5% of commitments." }] },
    { severity: "amber", topic: "Operations", finding: "The CFO also acts as CCO, which weakens independent oversight at a 31-person firm.",
      citations: [{ doc: DDQ, page: 6, quote: "The chief compliance officer also serves as chief financial officer." }] },
    { severity: "amber", topic: "Credit quality", finding: "Two loans went on non-accrual in Q3 (3.4% of NAV) after none in Q2, and net IRR fell from 12.0% to 11.2%.",
      citations: [{ doc: Q3, page: 2, quote: "Two loans were placed on non-accrual during the quarter, totaling 3.4% of NAV." }, { doc: Q2, page: 2, quote: "There are no loans on non-accrual." }] },
    { severity: "green", topic: "Track record", finding: "Low realized losses across prior funds, and Fund I returned 1.42x net.",
      citations: [{ doc: DDQ, page: 4, quote: "cumulative annualized loss rate of 0.3%" }] },
    { severity: "green", topic: "Alignment", finding: "The firm is fully employee owned, and the fee is charged on invested rather than committed capital.",
      citations: [{ doc: DDQ, page: 1, quote: "The firm is 100% employee owned." }, { doc: DDQ, page: 5, quote: "Management fee is 1.5% on invested capital." }] },
  ],
  questions: [
    "Has Marcus Ortiz's move to an advisory role triggered the key-person provision, and if not, why not?",
    "Why are non-sponsored loans at 31% when the DDQ states a 15% limit, and is that limit binding?",
    "What happened with the two healthcare services borrowers, and what recovery do you expect?",
    "Who replaces Ortiz on the investment committee, and how does a three-member committee decide?",
    "Will you separate the CFO and CCO roles, and on what timeline?",
  ],
  missing: ["Loss rates by fund and by vintage", "Fund II realized versus unrealized split", "Current DDQ reflecting the 2026 team changes"],
};

export const SAMPLE_CHANGES: RunResult = {
  fund: "Halden Ridge Credit Fund III",
  headline: "Q3: a co-PM stepped back, non-sponsored lending is at [[bad|31%]] against a 15% limit, and two loans went on non-accrual.",
  summary: "Q3 brought a team change, rising credit stress and drift from stated limits. Deployment grew from 64% to 79% invested and from 38 to 47 borrowers.",
  sections: [],
  findings: [
    { severity: "red", topic: "Team", finding: "**Marcus Ortiz moved to a senior advisory role** on September 1; in Q2 both co-PMs led all decisions. The investment committee drops to three members.",
      citations: [{ doc: Q3, page: 3, quote: "Marcus Ortiz has transitioned to a senior advisory role effective September 1." }, { doc: Q2, page: 3, quote: "Co-portfolio managers Elena Brandt and Marcus Ortiz continue to lead all investment decisions." }] },
    { severity: "red", topic: "Strategy drift", finding: "Non-sponsored loans rose from 18% to [[bad|31%]], more than **double the 15% limit** in the DDQ.",
      citations: [{ doc: Q3, page: 2, quote: "non-sponsored loans represent 31%" }, { doc: Q2, page: 2, quote: "non-sponsored loans represent 18%" }, { doc: DDQ, page: 2, quote: "Non-sponsored loans are expected to represent no more than 15% of commitments." }] },
    { severity: "amber", topic: "Credit", finding: "Two loans went on non-accrual ([[bad|3.4%]] of NAV), up from none in Q2. Net IRR fell from 12.0% to [[bad|11.2%]].",
      citations: [{ doc: Q3, page: 2, quote: "Two loans were placed on non-accrual during the quarter, totaling 3.4% of NAV." }, { doc: Q3, page: 1, quote: "Net IRR since inception is 11.2%" }, { doc: Q2, page: 1, quote: "Net IRR since inception is 12.0%." }] },
    { severity: "amber", topic: "Concentration", finding: "The largest borrower grew from 3.9% to 5.6% of commitments, above the 5% limit.",
      citations: [{ doc: Q3, page: 2, quote: "The largest single borrower represents 5.6% of commitments." }, { doc: Q2, page: 2, quote: "The largest single borrower represents 3.9% of commitments." }] },
    { severity: "amber", topic: "Risk", finding: "Weighted average loan-to-value rose from 41% to 46%.",
      citations: [{ doc: Q3, page: 1, quote: "The portfolio's weighted average loan-to-value is 46%." }, { doc: Q2, page: 1, quote: "The portfolio's weighted average loan-to-value is 41%." }] },
    { severity: "green", topic: "Terms", finding: "No change to fees, the preferred return or key-person provisions. Fund leverage is [[good|0.8x]], within the 1.0x limit.",
      citations: [{ doc: Q3, page: 4, quote: "There are no changes to fees, the preferred return or key-person provisions." }, { doc: Q3, page: 4, quote: "Fund-level leverage was 0.8x at quarter end." }] },
  ],
  questions: [
    "Does Ortiz's transition trigger the key-person clause?",
    "What is the plan to bring non-sponsored lending back under 15%?",
    "What are the expected recoveries on the two non-accrual loans?",
    "Will you cap the largest position back under 5%?",
  ],
  missing: [],
};

/* ------------------------------------------------------------------ */
/* Full sample book: two fictional firms, three funds.                 */
/* ------------------------------------------------------------------ */

const c = (doc: string, page: number, quote: string) => ({ doc, page, quote });
const m = (name: MetricName, value: number, as_of: string, doc: string, page: number, quote: string): Metric => ({ name, value, as_of, citation: c(doc, page, quote) });

interface SampleDoc { name: string; doc_type: DocType; pages: string[]; as_of: string; ai: DocAI }
export interface SampleFund { fund: { manager: string; name: string; strategy: string; vintage: number; asset_class: AssetClass; commitment: number }; docs: SampleDoc[]; memo?: RunResult; changes?: RunResult }


const cf = (kind: CashFlow["kind"], amount: number, date: string, doc: string, page: number, quote: string): CashFlow => ({ kind, amount, date, citation: c(doc, page, quote) });

// Builds a capital account statement (the LP's own position) with its extracted figures.
function statement(fundName: string, file: string, asOf: string, period: string, v: { commitment: number; paid: number; unfunded: number; dist: number; nav: number }): SampleDoc {
  const L = [`Commitment: $${v.commitment.toFixed(1)} million.`, `Contributions to date: $${v.paid.toFixed(1)} million.`, `Unfunded commitment: $${v.unfunded.toFixed(1)} million.`,
    `Distributions to date: $${v.dist.toFixed(1)} million.`, `Ending capital balance: $${v.nav.toFixed(1)} million.`];
  return {
    name: file, doc_type: "Capital account statement", as_of: asOf,
    pages: [`${fundName}. Capital account statement for the period ended ${period}. Prepared for: Your firm. ${L.join(" ")}`],
    ai: {
      doc_type: "Capital account statement", as_of: asOf,
      summary: `Your capital account as of ${period}: $${v.paid.toFixed(1)} million paid in of a $${v.commitment.toFixed(1)} million commitment, $${v.dist.toFixed(1)} million distributed, and a $${v.nav.toFixed(1)} million ending balance.`,
      key_points: [
        { point: `Paid in $${v.paid.toFixed(1)}M; $${v.unfunded.toFixed(1)}M unfunded.`, citations: [c(file, 1, L[1]), c(file, 1, L[2])] },
        { point: `Ending capital balance $${v.nav.toFixed(1)}M.`, citations: [c(file, 1, L[4])] },
      ],
      metrics: [
        m("commitment", v.commitment, asOf, file, 1, L[0]), m("paid_in", v.paid, asOf, file, 1, L[1]), m("unfunded", v.unfunded, asOf, file, 1, L[2]),
        m("lp_distributions", v.dist, asOf, file, 1, L[3]), m("lp_nav", v.nav, asOf, file, 1, L[4]),
      ],
      cash_flows: [],
    },
  };
}

function notice(fundName: string, file: string, kind: CashFlow["kind"], amount: number, date: string, dateText: string, issued: string): SampleDoc {
  const line = kind === "call" ? `Your share of this capital call is $${amount.toFixed(1)} million, due ${dateText}.` : `Your share of this distribution is $${amount.toFixed(1)} million, payable ${dateText}.`;
  return {
    name: file, doc_type: "Capital call / distribution notice", as_of: issued,
    pages: [`${fundName}. ${kind === "call" ? "Capital call notice" : "Distribution notice"}. ${line} ${kind === "call" ? "Proceeds will fund new investments and Fund expenses." : "The distribution represents loan repayments."}`],
    ai: {
      doc_type: "Capital call / distribution notice", as_of: issued,
      summary: kind === "call" ? `Capital call: $${amount.toFixed(1)} million due ${dateText} to fund new investments and expenses.` : `Distribution: $${amount.toFixed(1)} million payable ${dateText} from loan repayments.`,
      key_points: [{ point: line, citations: [c(file, 1, line)] }],
      metrics: [],
      cash_flows: [cf(kind, amount, date, file, 1, line)],
    },
  };
}

const Q1 = "Halden Ridge Q1 2026 Letter.pdf";
const Q1_PAGES = [
  "Dear Limited Partners, Fund III ended the first quarter 48% invested across 29 borrowers. Net IRR since inception is 12.6%. Net TVPI is 1.04x and DPI is 0.02x. Fund NAV is $412 million.",
  "Portfolio. Sponsor-backed loans represent 88% of the portfolio; non-sponsored loans represent 12%. There are no loans on non-accrual. The largest single borrower represents 3.6% of commitments.",
];

const H3: SampleFund = {
  fund: { manager: "Halden Ridge Capital", ...SAMPLE_FUND, asset_class: "Private credit", commitment: 25 },
  memo: SAMPLE_MEMO,
  changes: SAMPLE_CHANGES,
  docs: [
    { ...SAMPLE_DOCS[0], as_of: "2025-12-31", ai: {
      doc_type: "DDQ", as_of: "2025-12-31",
      summary: "Fund III DDQ: a $1.0 billion target, sponsor-backed first-lien direct lending fund from a $2.1 billion employee-owned Chicago manager. It states clear limits on non-sponsored loans (15%) and single-borrower exposure (5%).",
      key_points: [
        { point: "Target fund size is $1.0 billion with a $1.25 billion hard cap, aiming for a 10% to 12% net IRR.", citations: [c(DDQ, 5, "Target fund size is $1.0 billion with a hard cap of $1.25 billion."), c(DDQ, 2, "The Fund targets a net IRR of 10% to 12%.")] },
        { point: "Stated limits: non-sponsored loans no more than 15%, single borrower no more than 5%, leverage up to 1.0x.", citations: [c(DDQ, 2, "Non-sponsored loans are expected to represent no more than 15% of commitments.")] },
        { point: "Two investment team departures in 2024, including the head of portfolio monitoring.", citations: [c(DDQ, 3, "Two members of the investment team departed in 2024, including the head of portfolio monitoring.")] },
        { point: "Fees: 1.5% on invested capital, 15% carry over a 7% preferred return, 1% GP commitment.", citations: [c(DDQ, 5, "Management fee is 1.5% on invested capital.")] },
        { point: "The CFO doubles as CCO; valuations are internal with semi-annual independent review.", citations: [c(DDQ, 6, "The chief compliance officer also serves as chief financial officer.")] },
      ],
      metrics: [m("fund_size", 1000, "2025-12-31", DDQ, 5, "Target fund size is $1.0 billion")],
    } },
    { name: Q1, doc_type: "Quarterly letter", pages: Q1_PAGES, as_of: "2026-03-31", ai: {
      doc_type: "Quarterly letter", as_of: "2026-03-31",
      summary: "Q1 2026: 48% invested across 29 borrowers with a 12.6% net IRR. Non-sponsored lending is at 12%, within the 15% limit, and there are no non-accruals.",
      key_points: [
        { point: "48% invested across 29 borrowers; net IRR 12.6%, TVPI 1.04x.", citations: [c(Q1, 1, "Fund III ended the first quarter 48% invested across 29 borrowers.")] },
        { point: "Non-sponsored loans at 12% of the portfolio.", citations: [c(Q1, 2, "non-sponsored loans represent 12%")] },
        { point: "No loans on non-accrual; largest borrower 3.6%.", citations: [c(Q1, 2, "There are no loans on non-accrual.")] },
      ],
      metrics: [
        m("net_irr", 12.6, "2026-03-31", Q1, 1, "Net IRR since inception is 12.6%."), m("tvpi", 1.04, "2026-03-31", Q1, 1, "Net TVPI is 1.04x"),
        m("dpi", 0.02, "2026-03-31", Q1, 1, "DPI is 0.02x"), m("nav", 412, "2026-03-31", Q1, 1, "Fund NAV is $412 million."),
        m("invested_pct", 48, "2026-03-31", Q1, 1, "48% invested"),
      ],
    } },
    { ...SAMPLE_DOCS[1], as_of: "2026-06-30", ai: {
      doc_type: "Quarterly letter", as_of: "2026-06-30",
      summary: "Q2 2026: 64% invested across 38 borrowers with a 12.0% net IRR. Non-sponsored lending rose to 18%, above the 15% limit. A new head of portfolio monitoring was hired.",
      key_points: [
        { point: "64% invested across 38 borrowers; net IRR 12.0%, TVPI 1.07x.", citations: [c(Q2, 1, "Fund III ended the second quarter 64% invested across 38 borrowers.")] },
        { point: "Non-sponsored loans at 18%, already above the 15% DDQ limit.", citations: [c(Q2, 2, "non-sponsored loans represent 18%")] },
        { point: "Hired a new head of portfolio monitoring in April.", citations: [c(Q2, 3, "We hired a new head of portfolio monitoring in April.")] },
      ],
      metrics: [
        m("net_irr", 12.0, "2026-06-30", Q2, 1, "Net IRR since inception is 12.0%."), m("tvpi", 1.07, "2026-06-30", Q2, 1, "Net TVPI is 1.07x"),
        m("dpi", 0.04, "2026-06-30", Q2, 1, "DPI is 0.04x"), m("nav", 566, "2026-06-30", Q2, 1, "Fund NAV is $566 million."),
        m("invested_pct", 64, "2026-06-30", Q2, 1, "64% invested"),
      ],
    } },
    { ...SAMPLE_DOCS[2], as_of: "2026-09-30", ai: {
      doc_type: "Quarterly letter", as_of: "2026-09-30",
      summary: "Q3 2026: 79% invested across 47 borrowers. Net IRR fell to 11.2% on two healthcare markdowns, and two loans went on non-accrual. Co-PM Marcus Ortiz stepped back, and non-sponsored lending reached 31%.",
      key_points: [
        { point: "Net IRR fell to 11.2% on markdowns of two healthcare services borrowers.", citations: [c(Q3, 1, "reflecting markdowns on two healthcare services borrowers")] },
        { point: "Two loans on non-accrual, 3.4% of NAV.", citations: [c(Q3, 2, "Two loans were placed on non-accrual during the quarter, totaling 3.4% of NAV.")] },
        { point: "Marcus Ortiz moved to a senior advisory role; the IC drops to three members.", citations: [c(Q3, 3, "Marcus Ortiz has transitioned to a senior advisory role effective September 1.")] },
        { point: "Non-sponsored loans at 31%; largest borrower 5.6%.", citations: [c(Q3, 2, "non-sponsored loans represent 31%")] },
      ],
      metrics: [
        m("net_irr", 11.2, "2026-09-30", Q3, 1, "Net IRR since inception is 11.2%"), m("tvpi", 1.09, "2026-09-30", Q3, 1, "Net TVPI is 1.09x"),
        m("dpi", 0.06, "2026-09-30", Q3, 1, "DPI is 0.06x"), m("nav", 701, "2026-09-30", Q3, 1, "Fund NAV is $701 million."),
        m("invested_pct", 79, "2026-09-30", Q3, 1, "79% invested"),
      ],
    } },
    statement("Halden Ridge Credit Fund III", "Halden Ridge Fund III - Capital Account Q3 2026.pdf", "2026-09-30", "September 30, 2026", { commitment: 25, paid: 19.8, unfunded: 5.2, dist: 1.2, nav: 20.3 }),
    notice("Halden Ridge Credit Fund III", "Halden Ridge Fund III - Capital Call Notice Nov 2026.pdf", "call", 1.5, "2026-12-01", "December 1, 2026", "2026-11-06"),
  ],
};

const F2Q2 = "Halden Ridge Fund II Q2 2026 Letter.pdf";
const F2Q3 = "Halden Ridge Fund II Q3 2026 Letter.pdf";
const H2: SampleFund = {
  fund: { manager: "Halden Ridge Capital", name: "Halden Ridge Credit Fund II", strategy: "Senior secured direct lending", vintage: 2020, asset_class: "Private credit", commitment: 20 },
  docs: [
    { name: F2Q2, doc_type: "Quarterly letter", as_of: "2026-06-30", pages: [
      "Dear Limited Partners, Fund II is fully invested and in its harvest period. Net IRR since inception is 11.4%. Net TVPI is 1.21x and DPI is 0.62x. Fund NAV is $468 million.",
      "Realizations. We received repayments on six loans during the quarter and distributed $41 million to limited partners. There are no loans on non-accrual.",
    ], ai: {
      doc_type: "Quarterly letter", as_of: "2026-06-30",
      summary: "Q2 2026: a fully invested fund in harvest with an 11.4% net IRR and 0.62x DPI. It distributed $41 million and has no non-accruals.",
      key_points: [
        { point: "Net IRR 11.4%, TVPI 1.21x, DPI 0.62x.", citations: [c(F2Q2, 1, "Net TVPI is 1.21x and DPI is 0.62x.")] },
        { point: "Six repayments; $41 million distributed.", citations: [c(F2Q2, 2, "distributed $41 million to limited partners")] },
      ],
      metrics: [
        m("net_irr", 11.4, "2026-06-30", F2Q2, 1, "Net IRR since inception is 11.4%."), m("tvpi", 1.21, "2026-06-30", F2Q2, 1, "Net TVPI is 1.21x"),
        m("dpi", 0.62, "2026-06-30", F2Q2, 1, "DPI is 0.62x"), m("nav", 468, "2026-06-30", F2Q2, 1, "Fund NAV is $468 million."),
        m("distributions", 41, "2026-06-30", F2Q2, 2, "distributed $41 million to limited partners"),
      ],
    } },
    { name: F2Q3, doc_type: "Quarterly letter", as_of: "2026-09-30", pages: [
      "Dear Limited Partners, Fund II continues to harvest. Net IRR since inception is 11.6%. Net TVPI is 1.24x and DPI is 0.71x. Fund NAV is $415 million.",
      "Realizations. We received repayments on five loans during the quarter and distributed $70 million to limited partners. There are no loans on non-accrual.",
      "Fund term. The General Partner intends to request a one-year extension of the Fund term to December 2028, subject to Advisory Committee approval, to allow an orderly exit of the remaining loans.",
    ], ai: {
      doc_type: "Quarterly letter", as_of: "2026-09-30",
      summary: "Q3 2026: net IRR rose to 11.6% and DPI to 0.71x after $70 million of distributions. The GP plans to ask for a one-year term extension.",
      key_points: [
        { point: "Net IRR 11.6%, TVPI 1.24x, DPI 0.71x.", citations: [c(F2Q3, 1, "Net TVPI is 1.24x and DPI is 0.71x.")] },
        { point: "$70 million distributed from five repayments.", citations: [c(F2Q3, 2, "distributed $70 million to limited partners")] },
        { point: "GP will request a one-year term extension to December 2028.", citations: [c(F2Q3, 3, "The General Partner intends to request a one-year extension of the Fund term to December 2028")] },
      ],
      metrics: [
        m("net_irr", 11.6, "2026-09-30", F2Q3, 1, "Net IRR since inception is 11.6%."), m("tvpi", 1.24, "2026-09-30", F2Q3, 1, "Net TVPI is 1.24x"),
        m("dpi", 0.71, "2026-09-30", F2Q3, 1, "DPI is 0.71x"), m("nav", 415, "2026-09-30", F2Q3, 1, "Fund NAV is $415 million."),
        m("distributions", 70, "2026-09-30", F2Q3, 2, "distributed $70 million to limited partners"),
      ],
    } },
    statement("Halden Ridge Credit Fund II", "Halden Ridge Fund II - Capital Account Q3 2026.pdf", "2026-09-30", "September 30, 2026", { commitment: 20, paid: 19.6, unfunded: 0.4, dist: 13.9, nav: 10.4 }),
    notice("Halden Ridge Credit Fund II", "Halden Ridge Fund II - Distribution Notice Nov 2026.pdf", "distribution", 1.1, "2026-11-20", "November 20, 2026", "2026-11-04"),
  ],
  changes: {
    fund: "Halden Ridge Credit Fund II",
    headline: "Q3: steady harvest with $70 million distributed, but the GP plans to ask for a one-year term extension.",
    summary: "Performance improved slightly and distributions picked up. The term extension request is the main item to decide on.",
    sections: [],
    findings: [
      { severity: "amber", topic: "Fund term", finding: "The GP will ask the Advisory Committee for a one-year extension to December 2028. Q2 made no mention of an extension.", citations: [c(F2Q3, 3, "The General Partner intends to request a one-year extension of the Fund term to December 2028")] },
      { severity: "green", topic: "Distributions", finding: "Distributions rose from $41 million to [[good|$70 million]], and DPI went from 0.62x to [[good|0.71x]].", citations: [c(F2Q3, 2, "distributed $70 million to limited partners"), c(F2Q2, 2, "distributed $41 million to limited partners")] },
      { severity: "green", topic: "Performance", finding: "Net IRR edged up from 11.4% to 11.6% and TVPI from 1.21x to 1.24x.", citations: [c(F2Q3, 1, "Net IRR since inception is 11.6%."), c(F2Q2, 1, "Net IRR since inception is 11.4%.")] },
      { severity: "green", topic: "Credit", finding: "Still no loans on non-accrual.", citations: [c(F2Q3, 2, "There are no loans on non-accrual.")] },
    ],
    questions: ["Why is an extension needed, and which loans remain?", "Will management fees be reduced during the extension?", "How will you vote the remaining positions if the extension is declined?"],
    missing: [],
  },
};

const NDDQ = "Northfold Growth IV - DDQ.pdf";
const NQ2 = "Northfold Growth IV Q2 2026 Letter.pdf";
const NQ3 = "Northfold Growth IV Q3 2026 Letter.pdf";
const N4: SampleFund = {
  fund: { manager: "Northfold Capital", name: "Northfold Growth Partners IV", strategy: "Growth equity, software", vintage: 2023, asset_class: "Growth equity", commitment: 15 },
  docs: [
    { name: NDDQ, doc_type: "DDQ", as_of: "2025-09-30", pages: [
      "Firm. Northfold Capital is based in Boston with 42 employees and $3.4 billion of AUM. Founding partners Priya Shah and Daniel Okafor have worked together since 2011.",
      "Strategy. The Fund makes minority and control growth investments in B2B software companies with $20 million to $100 million of revenue. No single portfolio company will exceed 20% of Fund commitments at cost.",
      "Valuation. Portfolio companies are valued quarterly using recent financing rounds and public comparables. Valuations are reviewed by the Valuation Committee and audited annually.",
      "Terms. Fund size is $900 million. Management fee is 2.0% on commitments during the investment period. Carried interest is 20% over an 8% preferred return.",
    ], ai: {
      doc_type: "DDQ", as_of: "2025-09-30",
      summary: "Fund IV DDQ: a $900 million growth equity fund in B2B software from a $3.4 billion Boston manager. It caps any single company at 20% of commitments at cost and charges 2 and 20 with an 8% hurdle.",
      key_points: [
        { point: "$3.4 billion AUM, 42 employees; founders together since 2011.", citations: [c(NDDQ, 1, "Northfold Capital is based in Boston with 42 employees and $3.4 billion of AUM.")] },
        { point: "Single-company limit of 20% of commitments at cost.", citations: [c(NDDQ, 2, "No single portfolio company will exceed 20% of Fund commitments at cost.")] },
        { point: "Valuations use recent rounds and comps, reviewed quarterly.", citations: [c(NDDQ, 3, "Portfolio companies are valued quarterly using recent financing rounds and public comparables.")] },
        { point: "2.0% fee on commitments, 20% carry over 8%.", citations: [c(NDDQ, 4, "Management fee is 2.0% on commitments during the investment period.")] },
      ],
      metrics: [m("fund_size", 900, "2025-09-30", NDDQ, 4, "Fund size is $900 million.")],
    } },
    { name: NQ2, doc_type: "Quarterly letter", as_of: "2026-06-30", pages: [
      "Dear Partners, Fund IV is 58% called across 11 portfolio companies. Net IRR is 18.3%. Net TVPI is 1.19x. Fund NAV is $620 million. DPI is 0.00x.",
      "Portfolio. Our largest holding, Lumora, represents 16% of NAV. Revenue across the portfolio grew 31% year over year.",
      "Team. Chief financial officer Grace Lin oversees fund accounting and valuation.",
    ], ai: {
      doc_type: "Quarterly letter", as_of: "2026-06-30",
      summary: "Q2 2026: 58% called across 11 companies with an 18.3% net IRR and 1.19x TVPI. Nothing has been distributed yet. The largest holding, Lumora, is 16% of NAV.",
      key_points: [
        { point: "Net IRR 18.3%, TVPI 1.19x, DPI 0.00x.", citations: [c(NQ2, 1, "Net IRR is 18.3%.")] },
        { point: "Lumora is 16% of NAV.", citations: [c(NQ2, 2, "Our largest holding, Lumora, represents 16% of NAV.")] },
        { point: "Portfolio revenue grew 31% year over year.", citations: [c(NQ2, 2, "Revenue across the portfolio grew 31% year over year.")] },
      ],
      metrics: [
        m("net_irr", 18.3, "2026-06-30", NQ2, 1, "Net IRR is 18.3%."), m("tvpi", 1.19, "2026-06-30", NQ2, 1, "Net TVPI is 1.19x."),
        m("dpi", 0, "2026-06-30", NQ2, 1, "DPI is 0.00x."), m("nav", 620, "2026-06-30", NQ2, 1, "Fund NAV is $620 million."),
        m("called_pct", 58, "2026-06-30", NQ2, 1, "Fund IV is 58% called"),
      ],
    } },
    { name: NQ3, doc_type: "Quarterly letter", as_of: "2026-09-30", pages: [
      "Dear Partners, Fund IV is 66% called across 12 portfolio companies. Net IRR is 24.9%. Net TVPI is 1.38x. Fund NAV is $815 million. DPI is 0.00x.",
      "Portfolio. Lumora completed a Series D led by an existing investor in the Fund's syndicate, and we increased its valuation by 2.1x. Lumora now represents 27% of NAV. Revenue across the portfolio grew 24% year over year.",
      "Team. Grace Lin, chief financial officer, left the firm in August. Controller Ben Ruiz is serving as interim CFO while we search for a replacement.",
    ], ai: {
      doc_type: "Quarterly letter", as_of: "2026-09-30",
      summary: "Q3 2026: net IRR jumped to 24.9% and TVPI to 1.38x, mostly from a 2.1x markup of Lumora on an insider-led round. Lumora is now 27% of NAV, and the CFO left in August.",
      key_points: [
        { point: "Net IRR 24.9%, TVPI 1.38x, still no distributions.", citations: [c(NQ3, 1, "Net IRR is 24.9%.")] },
        { point: "Lumora marked up 2.1x on a round led by an existing investor; now 27% of NAV.", citations: [c(NQ3, 2, "we increased its valuation by 2.1x"), c(NQ3, 2, "Lumora now represents 27% of NAV.")] },
        { point: "CFO Grace Lin left; the controller is interim CFO.", citations: [c(NQ3, 3, "Grace Lin, chief financial officer, left the firm in August.")] },
        { point: "Portfolio revenue growth slowed from 31% to 24%.", citations: [c(NQ3, 2, "Revenue across the portfolio grew 24% year over year.")] },
      ],
      metrics: [
        m("net_irr", 24.9, "2026-09-30", NQ3, 1, "Net IRR is 24.9%."), m("tvpi", 1.38, "2026-09-30", NQ3, 1, "Net TVPI is 1.38x."),
        m("dpi", 0, "2026-09-30", NQ3, 1, "DPI is 0.00x."), m("nav", 815, "2026-09-30", NQ3, 1, "Fund NAV is $815 million."),
        m("called_pct", 66, "2026-09-30", NQ3, 1, "Fund IV is 66% called"),
      ],
    } },
    statement("Northfold Growth Partners IV", "Northfold Growth IV - Capital Account Q3 2026.pdf", "2026-09-30", "September 30, 2026", { commitment: 15, paid: 9.9, unfunded: 5.1, dist: 0, nav: 13.7 }),
    notice("Northfold Growth Partners IV", "Northfold Growth IV - Capital Call Notice Nov 2026.pdf", "call", 0.9, "2026-12-05", "December 5, 2026", "2026-11-09"),
  ],
  memo: {
    fund: "Northfold Growth Partners IV",
    headline: "Strong reported returns, but they rest on one insider-priced markup, and the CFO who oversaw valuation just left.",
    summary: "Northfold is a $3.4 billion Boston growth equity manager investing in B2B software. Fund IV reports a 24.9% net IRR and 1.38x TVPI with no distributions. Much of the recent gain comes from a 2.1x Lumora markup on a round led by an existing investor, leaving Lumora at 27% of NAV.",
    sections: [
      { heading: "Firm and team", body: "42 employees and $3.4 billion of AUM. The founding partners have worked together since 2011. The CFO left in August 2026, and the controller is acting as interim CFO.", citations: [c(NDDQ, 1, "Northfold Capital is based in Boston with 42 employees and $3.4 billion of AUM."), c(NQ3, 3, "Grace Lin, chief financial officer, left the firm in August.")] },
      { heading: "Strategy and portfolio construction", body: "Minority and control growth investments in B2B software companies with $20 million to $100 million of revenue. No single company may exceed 20% of commitments at cost.", citations: [c(NDDQ, 2, "No single portfolio company will exceed 20% of Fund commitments at cost.")] },
      { heading: "Track record", body: "Fund IV: 24.9% net IRR and 1.38x TVPI at 66% called, with DPI of 0.00x. The documents give no prior-fund track record.", citations: [c(NQ3, 1, "Net IRR is 24.9%."), c(NQ3, 1, "DPI is 0.00x.")] },
      { heading: "Terms and alignment", body: "$900 million fund; 2.0% fee on commitments during the investment period; 20% carry over an 8% preferred return.", citations: [c(NDDQ, 4, "Management fee is 2.0% on commitments during the investment period.")] },
      { heading: "Operations and risk management", body: "Valuations use recent rounds and public comps and are reviewed by a Valuation Committee and audited annually. The CFO who oversaw fund accounting and valuation has left.", citations: [c(NDDQ, 3, "Valuations are reviewed by the Valuation Committee and audited annually."), c(NQ2, 3, "Chief financial officer Grace Lin oversees fund accounting and valuation.")] },
    ],
    findings: [
      { severity: "red", topic: "Valuation", finding: "Lumora was marked up 2.1x on a Series D led by an existing investor in the fund's syndicate, an insider-priced round that drove most of the IRR jump from 18.3% to 24.9%.", citations: [c(NQ3, 2, "Lumora completed a Series D led by an existing investor in the Fund's syndicate, and we increased its valuation by 2.1x."), c(NQ2, 1, "Net IRR is 18.3%.")] },
      { severity: "red", topic: "Key person / operations", finding: "The CFO who oversaw valuation left in August, just as the largest markup in the fund was taken.", citations: [c(NQ3, 3, "Grace Lin, chief financial officer, left the firm in August.")] },
      { severity: "amber", topic: "Concentration", finding: "Lumora is now 27% of NAV. The 20% limit applies at cost, so it may not be breached, but exposure to one company is high.", citations: [c(NQ3, 2, "Lumora now represents 27% of NAV."), c(NDDQ, 2, "No single portfolio company will exceed 20% of Fund commitments at cost.")] },
      { severity: "amber", topic: "Liquidity", finding: "No distributions yet (DPI 0.00x), so returns are unrealized.", citations: [c(NQ3, 1, "DPI is 0.00x.")] },
      { severity: "amber", topic: "Growth", finding: "Portfolio revenue growth slowed from 31% to 24% year over year.", citations: [c(NQ3, 2, "Revenue across the portfolio grew 24% year over year."), c(NQ2, 2, "Revenue across the portfolio grew 31% year over year.")] },
      { severity: "green", topic: "Team stability", finding: "The founding partners have worked together since 2011.", citations: [c(NDDQ, 1, "Founding partners Priya Shah and Daniel Okafor have worked together since 2011.")] },
    ],
    questions: [
      "Who set the Lumora Series D price, and did any new outside investor participate?",
      "What is Lumora's cost basis as a share of commitments?",
      "Why did the CFO leave, and who signs off on valuations until a replacement is hired?",
      "What is the plan and timeline for first distributions?",
      "What would TVPI be with Lumora held at its prior mark?",
    ],
    missing: ["Prior fund track record", "Company-level valuation detail", "Lumora cost basis"],
  },
  changes: {
    fund: "Northfold Growth Partners IV",
    headline: "Q3: net IRR jumped from 18.3% to 24.9% on an **insider-led Lumora markup**, Lumora is now [[bad|27%]] of NAV, and the CFO left.",
    summary: "The headline gains are concentrated in one company and priced by an existing investor. That happened in the same quarter the CFO who oversaw valuation left.",
    sections: [],
    findings: [
      { severity: "red", topic: "Valuation", finding: "Lumora marked up **2.1x on a round led by an existing investor**; IRR rose from 18.3% to 24.9% and TVPI from 1.19x to 1.38x.", citations: [c(NQ3, 2, "we increased its valuation by 2.1x"), c(NQ3, 1, "Net IRR is 24.9%."), c(NQ2, 1, "Net IRR is 18.3%.")] },
      { severity: "red", topic: "Team", finding: "CFO Grace Lin left in August; in Q2 she oversaw fund accounting and valuation.", citations: [c(NQ3, 3, "Grace Lin, chief financial officer, left the firm in August."), c(NQ2, 3, "Chief financial officer Grace Lin oversees fund accounting and valuation.")] },
      { severity: "amber", topic: "Concentration", finding: "Lumora grew from 16% to 27% of NAV.", citations: [c(NQ3, 2, "Lumora now represents 27% of NAV."), c(NQ2, 2, "Our largest holding, Lumora, represents 16% of NAV.")] },
      { severity: "amber", topic: "Growth", finding: "Portfolio revenue growth slowed from 31% to 24%.", citations: [c(NQ3, 2, "Revenue across the portfolio grew 24% year over year."), c(NQ2, 2, "Revenue across the portfolio grew 31% year over year.")] },
      { severity: "green", topic: "Deployment", finding: "Called capital rose from 58% to 66% with one new company (12 total).", citations: [c(NQ3, 1, "Fund IV is 66% called across 12 portfolio companies."), c(NQ2, 1, "Fund IV is 58% called across 11 portfolio companies.")] },
    ],
    questions: ["Who priced the Lumora round?", "Who is approving valuations without a CFO?", "What is Lumora's share of commitments at cost?"],
    missing: [],
  },
};

export const SAMPLE_BOOK: SampleFund[] = [H3, H2, N4];

export function sampleFor(fundName: string) {
  return SAMPLE_BOOK.find((s) => s.fund.name === fundName) || null;
}
export function sampleDocAI(docName: string): DocAI | null {
  for (const s of SAMPLE_BOOK) for (const d of s.docs) if (d.name === docName) return d.ai;
  return null;
}
