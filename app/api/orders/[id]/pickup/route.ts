import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { checkPickupInput } from "@/lib/pickup";
import { completeOrder } from "@/lib/orders";
import type { Order } from "@/lib/types";

const MAX_ATTEMPTS = 10;

/** Seller scans or types the buyer's pickup code: completes the order and pays out. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return fail("Scan the QR or type the 6-digit code");

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order || order.seller_id !== ctx.user.id) return fail("Order not found", 404);
  if (order.status === "completed") return fail("This pickup is already done");
  if (order.status !== "paid") return fail("This order isn't waiting for pickup");
  if (order.pickup_attempts >= MAX_ATTEMPTS) return fail("Too many wrong codes. Contact support to finish this pickup.", 429);

  const check = checkPickupInput(order.id, code);
  if (!check.ok) {
    await db.from("orders").update({ pickup_attempts: order.pickup_attempts + 1 }).eq("id", order.id);
    return fail(check.reason === "wrong_order" ? "That pass is for a different order" : "That code doesn't match. Ask the buyer to refresh their pass.");
  }

  const done = await completeOrder(order);
  if (!done) return fail("This order changed. Refresh and try again.", 409);
  const { data: fresh } = await db.from("orders").select("payout_status").eq("id", order.id).single();
  return NextResponse.json({
    ok: true,
    payout_cents: order.amount_cents - order.fee_cents,
    payout_status: fresh?.payout_status,
  });
}
