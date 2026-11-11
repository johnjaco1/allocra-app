import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/env";
import { userClient } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!DEMO_MODE) await (await userClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
