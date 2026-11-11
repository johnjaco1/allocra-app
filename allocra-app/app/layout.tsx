import type { Metadata } from "next";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { DEMO_MODE } from "@/lib/env";
import { getStore } from "@/lib/store";
import Rail from "@/components/Rail";
import Uploads from "@/components/Uploads";
import Chat from "@/components/Chat";

export const metadata: Metadata = { title: "Allocra", description: "Allocra reads your DDQs and quarterly letters so you don't have to." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await getStore().catch(() => null);
  const funds = store ? await store.listFunds().catch(() => []) : [];
  return (
    <html lang="en">
      <body>
        {store ? (
          <Uploads>
          <div className="shell">
            <Rail
              funds={funds.map((f) => ({ id: f.id, name: f.name, manager: f.manager, red: f.last_run?.red || 0, amber: f.last_run?.amber || 0, ran: !!f.last_run }))}
              email={store.user.email}
              accounts={!DEMO_MODE}
            />
            <div className="main">{children}</div>
          </div>
          <Chat fundNames={Object.fromEntries(funds.map((f) => [f.id, f.name]))} />
          </Uploads>
        ) : children}
      </body>
    </html>
  );
}
