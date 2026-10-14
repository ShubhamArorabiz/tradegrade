import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/url";

/** Keeps the Supabase session cookie fresh on every page request. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SUPABASE_URL) return response;

  const supabase = createServerClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|sw.js|manifest.webmanifest|api/stripe/webhook|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
