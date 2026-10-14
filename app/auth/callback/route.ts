import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google (OAuth) sign-in lands here with a one-time code to swap for a session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=google&next=${encodeURIComponent(next)}`, url.origin));
}
