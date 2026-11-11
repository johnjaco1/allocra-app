import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await userClient();
    await sb.auth.exchangeCodeForSession(code);
  }
  const next = url.searchParams.get("next");
  return NextResponse.redirect(new URL(next && next.startsWith("/") && !next.startsWith("//") ? next : "/", url.origin));
}
