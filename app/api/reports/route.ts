import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const Body = z.object({
  listingId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(req: Request) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.listingId && !parsed.data.orderId)) return fail("Tell us what's wrong");

  const db = createAdminClient();
  if (parsed.data.orderId) {
    const { data: order } = await db.from("orders").select("buyer_id, seller_id").eq("id", parsed.data.orderId).maybeSingle();
    if (!order || ![order.buyer_id, order.seller_id].includes(ctx.user.id)) return fail("Order not found", 404);
  }
  await db.from("reports").insert({
    reporter_id: ctx.user.id,
    listing_id: parsed.data.listingId ?? null,
    order_id: parsed.data.orderId ?? null,
    reason: parsed.data.reason,
  });
  return NextResponse.json({ ok: true });
}
