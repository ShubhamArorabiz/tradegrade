import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/api";
import { LISTING_DAYS } from "@/lib/constants";

/** Seller actions on their own listing: relist (another 7 days) or take down. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  const update =
    action === "relist"
      ? { status: "active", expires_at: new Date(Date.now() + LISTING_DAYS * 86400_000).toISOString() }
      : action === "remove"
        ? { status: "removed" }
        : null;
  if (!update) return fail("Unknown action");

  const { data, error } = await ctx.supabase.from("listings").update(update).eq("id", id).eq("seller_id", ctx.user.id).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Listing not found", 404);
  return NextResponse.json({ ok: true });
}
