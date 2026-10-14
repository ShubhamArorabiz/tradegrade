import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single<Profile>();
  return { supabase, user: data.user, profile };
}

/** For pages that need a signed-in user with a finished profile. */
export async function requireUser(next: string) {
  const ctx = await getUser();
  if (!ctx.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!ctx.profile?.full_name) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  if (ctx.profile.suspended) redirect("/suspended");
  return { ...ctx, user: ctx.user, profile: ctx.profile };
}

export async function requireAdmin() {
  const ctx = await requireUser("/admin");
  if (ctx.profile.role !== "admin") redirect("/");
  return ctx;
}
