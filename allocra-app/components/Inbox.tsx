"use client";
import { useUploads } from "./Uploads";

// The drop target on the Portfolio page. Dropping works anywhere in the app; this is the obvious place.
export default function Inbox() {
  const { pick } = useUploads();
  return (
    <div className="inbox" onClick={() => pick()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick()}>
      <div className="drop-ic sm">↓</div>
      <div style={{ flex: 1 }}>
        <b>Drop manager documents anywhere to get AI summaries</b>
        <div className="small muted">DDQs, quarterly letters, capital account statements, call and distribution notices, Excel files. Allocra files each under its firm and fund, summarizes it, and pulls out performance and cash flows.</div>
      </div>
      <span className="btn">Choose files</span>
    </div>
  );
}
