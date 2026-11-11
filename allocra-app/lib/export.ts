import "server-only";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { Citation, Run } from "./types";

const SEV: Record<string, { label: string; color: string }> = {
  red: { label: "RED FLAG", color: "B42318" },
  amber: { label: "LOOK CLOSER", color: "B54708" },
  green: { label: "IN LINE", color: "067647" },
};

const cite = (cs: Citation[]) =>
  cs.length
    ? [new TextRun({ text: "  [" + cs.map((c) => `${c.doc.replace(/\.(pdf|docx?|txt)$/i, "")} p.${c.page}`).join("; ") + "]", size: 16, color: "667085" })]
    : [];

export async function runToDocx(run: Run, fundName: string): Promise<Buffer> {
  const r = run.result;
  const title = run.kind === "memo" ? "Investment Committee Memo" : "What Changed";
  const date = new Date(run.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const kids: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: "ALLOCRA", bold: true, size: 18, color: "1F4FD1" })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: `${fundName}: ${title}` })] }),
    new Paragraph({ children: [new TextRun({ text: `${date} · Sources: ${run.doc_names.join(", ")}`, size: 18, color: "667085" })] }),
    new Paragraph({ spacing: { before: 240 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: "1F4FD1", space: 8 } },
      children: [new TextRun({ text: r.headline, bold: true, size: 24 })] }),
    new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: r.summary })] }),
  ];
  for (const s of r.sections || []) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.heading)] }));
    kids.push(new Paragraph({ children: [new TextRun(s.body), ...cite(s.citations || [])] }));
  }
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(run.kind === "memo" ? "Key findings" : "Changes")] }));
  for (const f of r.findings || []) {
    const sv = SEV[f.severity] || SEV.amber;
    kids.push(new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: sv.label + "  ", bold: true, color: sv.color, size: 18 }),
      new TextRun({ text: f.topic + ". ", bold: true }),
      new TextRun(f.finding), ...cite(f.citations || []),
    ] }));
  }
  if (r.questions?.length) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(run.kind === "memo" ? "Questions for the manager" : "Questions for the next call")] }));
    r.questions.forEach((q, i) => kids.push(new Paragraph({ children: [new TextRun(`${i + 1}. ${q}`)] })));
  }
  if (r.missing?.length) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Not covered in the documents")] }));
    r.missing.forEach((m) => kids.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(m)] })));
  }
  kids.push(new Paragraph({ spacing: { before: 360 }, alignment: AlignmentType.LEFT, children: [new TextRun({
    text: "Prepared by Allocra from the documents listed above. Every finding cites its source page. This memo informs the committee and is not an investment recommendation.",
    italics: true, size: 16, color: "667085" })] }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 } } }, children: kids }],
  });
  return Packer.toBuffer(doc);
}
