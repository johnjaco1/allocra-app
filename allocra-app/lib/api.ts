import "server-only";
import { NextResponse } from "next/server";
import { getStore, type Store } from "./store";

export type Ctx<P> = { params: Promise<P> };

export function handle<P = Record<string, never>>(fn: (store: Store, req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const store = await getStore();
      if (!store) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
      const out = await fn(store, req, (await ctx?.params) as P);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || "Something went wrong.";
      console.error("[allocra]", e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  };
}
export const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
