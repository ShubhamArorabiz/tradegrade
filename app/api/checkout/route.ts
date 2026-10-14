import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { mockPayments, siteUrl, stripe } from "@/lib/stripe";
import { feeFor, PICKUP_WINDOW_HOURS } from "@/lib/constants";
import type { Listing } from "@/lib/types";

const Body = z.object({ listingId: z.string().uuid(), asIs: z.literal(true) });

/** Buy Now: reserve the listing, create the order, and send the buyer to pay. */
export async function POST(req: Request) {
  const ctx = await apiUser();
  if (ctx.error) return ctx.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please accept the as-is terms first");

  const db = createAdminClient();
  const { data: listing } = await db.from("listings").select("*").eq("id", parsed.data.listingId).single<Listing>();
  if (!listing) return fail("Listing not found", 404);
  if (listing.seller_id === ctx.user.id) return fail("You can't buy your own listing");

  const { data: reserved } = await db.rpc("reserve_listing", { listing: listing.id, minutes: 30 });
  if (!reserved) return fail("Someone else just reserved this item", 409);

  const now = new Date();
  const free = listing.price_cents === 0;
  const { data: order, error } = await db
    .from("orders")
    .insert({
      listing_id: listing.id,
      buyer_id: ctx.user.id,
      seller_id: listing.seller_id,
      amount_cents: listing.price_cents,
      fee_cents: free ? 0 : feeFor(listing.price_cents),
      as_is_accepted_at: now.toISOString(),
      ...(free || mockPayments()
        ? {
            status: "paid",
            paid_at: now.toISOString(),
            pickup_deadline: new Date(now.getTime() + PICKUP_WINDOW_HOURS * 3600_000).toISOString(),
            stripe_payment_intent_id: free ? null : `mock_pi_${crypto.randomUUID().slice(0, 8)}`,
          }
        : {}),
    })
    .select("id")
    .single();
  if (error || !order) {
    await db.from("listings").update({ status: "active", reserved_until: null }).eq("id", listing.id);
    return fail("Couldn't start the order. Try again.", 500);
  }

  if (free || mockPayments()) {
    // Held for the buyer until pickup (no expiry on the reservation).
    await db.from("listings").update({ reserved_until: null }).eq("id", listing.id);
    return NextResponse.json({ url: `/orders/${order.id}?new=1` });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    currency: "cad",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: listing.price_cents,
          product_data: { name: listing.title, images: listing.photos.slice(0, 1) },
        },
      },
    ],
    payment_intent_data: { transfer_group: order.id, metadata: { order_id: order.id, listing_id: listing.id } },
    metadata: { order_id: order.id },
    client_reference_id: order.id,
    customer_email: ctx.user.email || undefined,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${siteUrl()}/orders/${order.id}?new=1`,
    cancel_url: `${siteUrl()}/api/checkout/cancel?order=${order.id}`,
  });

  await db.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
  return NextResponse.json({ url: session.url });
}
