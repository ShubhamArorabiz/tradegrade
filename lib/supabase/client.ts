"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@/lib/supabase/url";

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
