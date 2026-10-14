import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { processPendingPayouts, refundOrder } from "@/lib/orders";
import { PICKUP_WINDOW_HOURS } from "@/lib/constants";
import type { Order } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const db = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "paid") break;
      const orderId = session.metadata?.order_id;
      if (!orderId) break;
      const now = new Date();
      const { data: paid } = await db
        .from("orders")
        .update({
          status: "paid",
          paid_at: now.toISOString(),
          pickup_deadline: new Date(now.getTime() + PICKUP_WINDOW_HOURS * 3600_000).toISOString(),
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        })
        .eq("id", orderId)
        .eq("status", "pending")
        .select("*")
        .maybeSingle<Order>();
      if (paid) {
        // Make sure the listing is still held for this buyer (the 30 min hold may have lapsed).
        const { data: held } = await db
          .from("listings")
          .update({ status: "reserved", reserved_until: null })
          .eq("id", paid.listing_id)
          .in("status", ["reserved", "active"])
          .select("id");
        if (!held?.length) await refundOrder(paid, "Item was no longer available");
      } else {
        // Payment arrived for an order we already cancelled: give the money back.
        const { data: late } = await db.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
        if (late && late.status === "cancelled" && session.payment_intent) {
          await stripe().refunds.create(
            { payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id },
            { idempotencyKey: `late-refund-${orderId}` },
          );
        }
      }
      break;
    }
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.order_id;
      if (!orderId) break;
      const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
      if (order?.status === "pending") await refundOrder(order, "Checkout expired", "cancelled");
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      const enabled = !!(account.payouts_enabled && account.details_submitted);
      const { data: profile } = await db
        .from("profiles")
        .update({ payouts_enabled: enabled })
        .eq("stripe_account_id", account.id)
        .select("id")
        .maybeSingle();
      if (profile && enabled) await processPendingPayouts(profile.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
