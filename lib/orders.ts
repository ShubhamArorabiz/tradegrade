import "server-only";
import { createAdminClient } from "./supabase/server";
import { mockPayments, stripe } from "./stripe";
import { LISTING_DAYS } from "./constants";
import type { Order, Profile } from "./types";

const db = () => createAdminClient();

function listingLiveAgain() {
  return new Date(Date.now() + LISTING_DAYS * 86400_000).toISOString();
}

/** Pay the seller for a completed order, or park it until they finish Stripe setup. */
export async function payoutOrder(order: Order) {
  const payout = order.amount_cents - order.fee_cents;
  if (order.amount_cents === 0 || payout <= 0) {
    await db().from("orders").update({ payout_status: "none" }).eq("id", order.id);
    return;
  }
  const { data: seller } = await db()
    .from("profiles")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", order.seller_id)
    .single<Pick<Profile, "stripe_account_id" | "payouts_enabled">>();

  if (!seller?.stripe_account_id || !seller.payouts_enabled) {
    await db().from("orders").update({ payout_status: "waiting_for_seller" }).eq("id", order.id);
    return;
  }

  if (mockPayments()) {
    await db()
      .from("orders")
      .update({ payout_status: "paid_out", stripe_transfer_id: `mock_tr_${order.id.slice(0, 8)}` })
      .eq("id", order.id);
    return;
  }

  try {
    const pi = await stripe().paymentIntents.retrieve(order.stripe_payment_intent_id!);
    const transfer = await stripe().transfers.create(
      {
        amount: payout,
        currency: "cad",
        destination: seller.stripe_account_id,
        transfer_group: order.id,
        source_transaction: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id,
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `payout-${order.id}` },
    );
    await db()
      .from("orders")
      .update({ payout_status: "paid_out", stripe_transfer_id: transfer.id })
      .eq("id", order.id);
  } catch (err) {
    console.error("payout failed", order.id, err);
    await db().from("orders").update({ payout_status: "failed" }).eq("id", order.id);
  }
}

/** Run payouts that were waiting for this seller to finish Stripe onboarding. */
export async function processPendingPayouts(sellerId: string) {
  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("seller_id", sellerId)
    .eq("status", "completed")
    .in("payout_status", ["waiting_for_seller", "failed"]);
  for (const order of (data ?? []) as Order[]) await payoutOrder(order);
}

/** Refund the buyer in full and put the listing back to Live. */
export async function refundOrder(order: Order, reason: string, status: "refunded" | "cancelled" = "refunded") {
  if (order.status !== "paid" && order.status !== "pending") throw new Error("Order can't be refunded now");

  if (order.status === "paid" && order.amount_cents > 0 && order.stripe_payment_intent_id && !mockPayments()) {
    await stripe().refunds.create(
      { payment_intent: order.stripe_payment_intent_id, metadata: { order_id: order.id } },
      { idempotencyKey: `refund-${order.id}` },
    );
  }
  if (order.status === "pending" && order.stripe_checkout_session_id && !mockPayments()) {
    try {
      await stripe().checkout.sessions.expire(order.stripe_checkout_session_id);
    } catch {
      // Already expired or completed; the webhook sorts out the latter.
    }
  }

  const finalStatus = order.status === "pending" ? "cancelled" : status;
  const { data: updated } = await db()
    .from("orders")
    .update({ status: finalStatus, cancel_reason: reason })
    .eq("id", order.id)
    .in("status", ["paid", "pending"])
    .select("id");
  if (!updated?.length) return;

  await db()
    .from("listings")
    .update({ status: "active", reserved_until: null, expires_at: listingLiveAgain() })
    .eq("id", order.listing_id)
    .eq("status", "reserved");
}

/** Mark the handoff done, close the listing and pay the seller. */
export async function completeOrder(order: Order) {
  const { data: updated } = await db()
    .from("orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "paid")
    .select("*");
  if (!updated?.length) return null;
  await db().from("listings").update({ status: "sold", reserved_until: null }).eq("id", order.listing_id);
  const done = updated[0] as Order;
  await payoutOrder(done);
  return done;
}

/**
 * Refund paid orders whose 72 h pickup window has passed and drop checkouts
 * that were abandoned. Runs from the daily cron and lazily when an order page loads.
 */
export async function sweepOrders(onlyOrderId?: string) {
  const now = new Date().toISOString();
  let overdue = db().from("orders").select("*").eq("status", "paid").lt("pickup_deadline", now);
  if (onlyOrderId) overdue = overdue.eq("id", onlyOrderId);
  const { data: late } = await overdue;
  for (const order of (late ?? []) as Order[]) {
    await refundOrder(order, "No pickup within 72 hours").catch((e) => console.error("sweep refund", order.id, e));
  }

  const stale = new Date(Date.now() - 35 * 60_000).toISOString();
  let abandoned = db().from("orders").select("*").eq("status", "pending").lt("created_at", stale);
  if (onlyOrderId) abandoned = abandoned.eq("id", onlyOrderId);
  const { data: pending } = await abandoned;
  for (const order of (pending ?? []) as Order[]) {
    await refundOrder(order, "Checkout not finished", "cancelled").catch((e) => console.error("sweep cancel", order.id, e));
  }
  return { refunded: late?.length ?? 0, cancelled: pending?.length ?? 0 };
}

/** Hide phone numbers and emails typed in chat until the order is complete. */
export function maskContactDetails(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email hidden]")
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, "[phone hidden]");
}
