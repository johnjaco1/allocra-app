import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Without Supabase there are no user accounts. That's fine on your own computer, but a hosted copy must
// never be open to the internet, so on Vercel it requires APP_PASSWORD (browser sign-in box, any username).
function noAccountsGate(req: NextRequest) {
  if (!process.env.VERCEL) return NextResponse.next();
  const pw = process.env.APP_PASSWORD;
  if (!pw) return new NextResponse("Allocra isn't set up yet: add Supabase keys (or APP_PASSWORD) in Vercel.", { status: 503 });
  const h = req.headers.get("authorization") || "";
  const [, b64] = h.split(" ");
  const given = b64 ? atob(b64).split(":").slice(1).join(":") : "";
  if (given === pw) return NextResponse.next();
  return new NextResponse("Sign in required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Allocra"' } });
}

export async function middleware(req: NextRequest) {
  if (!URL_ || !KEY) return noAccountsGate(req);
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  const open = p.startsWith("/login") || p.startsWith("/auth") || p.startsWith("/api");
  if (!user && !open) return NextResponse.redirect(new URL("/login", req.url));
  if (user && p.startsWith("/login")) return NextResponse.redirect(new URL("/", req.url));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
