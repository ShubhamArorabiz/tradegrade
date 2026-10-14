import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { refundOrder } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/stripe";
import type { Order } from "@/lib/types";

/** Stripe sends the buyer here when they back out of checkout: release the item. */
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("order") ?? "";
  const { user } = await getUser();
  const { data: order } = await createAdminClient().from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
  if (!order) return NextResponse.redirect(`${siteUrl()}/buy`);
  if (user?.id === order.buyer_id && order.status === "pending") {
    await refundOrder(order, "Buyer left checkout", "cancelled").catch(() => {});
  }
  return NextResponse.redirect(`${siteUrl()}/listing/${order.listing_id}?cancelled=1`);
}
