import { NextResponse } from "next/server";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { refundOrder } from "@/lib/orders";
import { BUYER_CANCEL_MINUTES } from "@/lib/constants";
import type { Order } from "@/lib/types";

/** Buyer: full refund within the first hour. Seller: any time before pickup. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order || ![order.buyer_id, order.seller_id].includes(ctx.user.id)) return fail("Order not found", 404);
  if (order.status !== "paid") return fail("This order can't be cancelled now");

  const isSeller = order.seller_id === ctx.user.id;
  if (!isSeller) {
    const since = Date.now() - new Date(order.paid_at ?? order.created_at).getTime();
    if (since > BUYER_CANCEL_MINUTES * 60_000) {
      return fail("The 1-hour cancel window has passed. Ask the seller in chat to cancel, or report a problem.");
    }
  }
  await refundOrder(order, isSeller ? "Seller cancelled" : "Buyer cancelled", "cancelled");
  return NextResponse.json({ ok: true });
}
