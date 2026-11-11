"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type F = { id: string; name: string; manager: string | null; red: number; amber: number; ran: boolean };

export function Logo() {
  return <span className="brand"><span className="logo-tile">A</span><span className="logo-word">Allocra</span></span>;
}

export default function Rail({ funds, email, accounts }: { funds: F[]; email: string; accounts: boolean }) {
  const path = usePathname();
  const firms = new Map<string, F[]>();
  for (const f of funds) {
    const k = f.manager || "Other";
    firms.set(k, [...(firms.get(k) || []), f]);
  }
  const sorted = [...firms.entries()].sort((a, b) => (a[0] === "Other" ? 1 : b[0] === "Other" ? -1 : a[0].localeCompare(b[0])));
  return (
    <aside className="rail">
      <Link href="/" style={{ textDecoration: "none" }}><Logo /></Link>
      <nav className="rail-nav">
        <Link href="/" className={path === "/" ? "on" : ""}>Portfolio</Link>
        <Link href="/team" className={path === "/team" ? "on" : ""}>Team &amp; data</Link>
      </nav>
      <div>
        <div className="rail-label">Firms · {firms.size}</div>
        {sorted.length === 0 && <div className="tiny muted" style={{ padding: "4px 10px" }}>Drop a document on Portfolio to start.</div>}
        {sorted.map(([firm, fs]) => (
          <div key={firm} className="firm">
            <div className="firm-name"><span>{firm}</span><span className="muted">{fs.length}</span></div>
            <nav className="rail-nav">
              {fs.map((f) => (
                <Link key={f.id} href={`/funds/${f.id}`} className={path === `/funds/${f.id}` ? "on" : ""}>
                  <span className={"dot " + (!f.ran ? "" : f.red ? "red" : f.amber ? "amber" : "green")} />
                  <span className="nm">{f.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>
      <div className="rail-foot">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
        {accounts ? <form action="/auth/signout" method="post"><button className="link-btn">Log out</button></form> : <a href="/login" className="link-btn">Log in</a>}
      </div>
    </aside>
  );
}
