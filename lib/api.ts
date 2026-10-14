import "server-only";
import { NextResponse } from "next/server";
import { getUser } from "./auth";

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** For API routes: the signed-in, non-suspended user with a profile, or an error response. */
export async function apiUser() {
  const ctx = await getUser();
  if (!ctx.user || !ctx.profile) return { error: fail("Please sign in first", 401) } as const;
  if (ctx.profile.suspended) return { error: fail("This account is suspended", 403) } as const;
  return { ...ctx, user: ctx.user, profile: ctx.profile, error: null } as const;
}
