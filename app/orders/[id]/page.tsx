import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CheckCircle2, Clock, MapPin, MessageCircle, Navigation, QrCode, Undo2, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { pickupCode, pickupQrPayload } from "@/lib/pickup";
import { sweepOrders } from "@/lib/orders";
import { loadingLabel, money, qty } from "@/lib/format";
import { BUYER_CANCEL_MINUTES } from "@/lib/constants";
import type { Listing, Order, Profile } from "@/lib/types";
import BackHeader from "@/components/BackHeader";
import ReportButton from "@/components/ReportButton";
import InstallPrompt from "@/components/InstallPrompt";
import CancelOrder from "./CancelOrder";
import RateOrder from "./RateOrder";

export const metadata = { title: "Order" };

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting for payment", cls: "bg-surface-2 text-muted" },
  paid: { label: "Ready for pickup", cls: "bg-warn-soft text-warn" },
  completed: { label: "Picked up", cls: "bg-ok-soft text-ok" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-faint" },
  refunded: { label: "Refunded", cls: "bg-surface-2 text-faint" },
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireUser(`/orders/${id}`);

  await sweepOrders(id);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();

  const db = createAdminClient();
  const isBuyer = order.buyer_id === user.id;
  const [{ data: listing }, { data: other }, { data: myRating }] = await Promise.all([
    db.from("listings").select("*").eq("id", order.listing_id).single<Listing>(),
    db.from("profiles").select("full_name, company").eq("id", isBuyer ? order.seller_id : order.buyer_id).single<Pick<Profile, "full_name" | "company">>(),
    db.from("ratings").select("stars").eq("order_id", order.id).eq("from_id", user.id).maybeSingle(),
  ]);
  if (!listing) notFound();

  const status = STATUS[order.status];
  const otherName = other?.company || other?.full_name || (isBuyer ? "Seller" : "Buyer");
  const payout = order.amount_cents - order.fee_cents;
  const live = order.status === "paid";
  const buyerCanCancel =
    isBuyer && live && Date.now() - new Date(order.paid_at ?? order.created_at).getTime() < BUYER_CANCEL_MINUTES * 60_000;

  let qr: string | null = null;
  if (isBuyer && live) {
    qr = await QRCode.toDataURL(pickupQrPayload(order.id), { margin: 1, width: 560, color: { dark: "#0b1b33", light: "#ffffff" } });
  }
  const mapsQuery = listing.pickup_address ? encodeURIComponent(listing.pickup_address) : `${listing.lat},${listing.lng}`;

  return (
    <main className="with-tabs">
      <BackHeader title={isBuyer ? "Pickup pass" : "Sale"} href={isBuyer ? "/orders" : "/sell?tab=reserved"} />
      <div className="page space-y-4 pt-4">
        {isNew && live && isBuyer && (
          <p className="flex items-center gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok animate-rise">
            <CheckCircle2 size={18} /> {order.amount_cents ? "Paid." : "Reserved."} It&apos;s yours. Show this pass at pickup.
          </p>
        )}

        <div className="card flex gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.photos[0]} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-bold leading-snug">{listing.title}</p>
            <p className="text-sm text-muted">
              {qty(listing.quantity, listing.unit)} · {money(order.amount_cents)}
            </p>
            <span className={`badge mt-1 ${status.cls}`}>{status.label}</span>
          </div>
        </div>

        {isBuyer && live && qr && (
          <section className="card p-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-bold text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" /> {order.amount_cents ? "Paid" : "Reserved"} · Ready for pickup
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Pickup QR code" className="mx-auto mt-3 w-full max-w-[220px]" />
            <p className="mt-2 font-mono text-[28px] font-extrabold tracking-[0.25em]">{pickupCode(order.id)}</p>
            <p className="mx-auto mt-1 max-w-[16rem] text-[13px] text-muted">
              Show this to the seller. Their scan releases your payment to them.
            </p>
          </section>
        )}

        {live && order.pickup_deadline && (
          <p className="flex items-center gap-2 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] font-bold text-warn">
            <Clock size={16} className="shrink-0" />
            <span>
              Pick up by{" "}
              {new Date(order.pickup_deadline).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" })}
              <span className="font-medium"> · then the buyer is refunded automatically</span>
            </span>
          </p>
        )}

        {isBuyer && (live || order.status === "completed") && (
          <section className="card space-y-2 p-4">
            <p className="flex items-start gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
              <span>
                <span className="block font-bold">{listing.pickup_address || listing.area_label || "Pickup location"}</span>
                {listing.pickup_notes && <span className="block text-sm text-muted">{listing.pickup_notes}</span>}
                <span className="block text-sm text-faint">{loadingLabel(listing.loading)}</span>
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`} target="_blank" rel="noreferrer" className="btn-secondary h-10 text-[14px]">
                <Navigation size={16} /> Directions
              </a>
              <Link href={`/orders/${order.id}/chat`} className="btn-secondary h-10 text-[14px]">
                <MessageCircle size={16} /> Chat
              </Link>
            </div>
          </section>
        )}

        {!isBuyer && live && (
          <section className="card space-y-3 p-4">
            <p className="text-sm text-muted">
              <b className="text-ink">{otherName}</b> is coming to pick this up. When they arrive and are happy with it, scan their pass.
            </p>
            <Link href={`/orders/${order.id}/scan`} className="btn-primary w-full">
              <QrCode size={18} /> Scan pickup
            </Link>
            {order.amount_cents > 0 && (
              <p className="flex items-center gap-2 text-[13px] text-faint">
                <Wallet size={15} /> You get {money(payout)} after the scan ({money(order.fee_cents)} TradeGrade fee).
              </p>
            )}
          </section>
        )}

        {!isBuyer && order.status === "completed" && order.amount_cents > 0 && (
          <p className="card p-4 text-sm">
            Payout {money(payout)}:{" "}
            {order.payout_status === "paid_out"
              ? "sent to your Stripe account."
              : order.payout_status === "waiting_for_seller"
                ? <Link href="/api/stripe/connect" className="font-semibold text-accent">set up payouts to receive it</Link>
                : "we hit a problem and will retry."}
          </p>
        )}

        {!isBuyer && (live || order.status === "completed") && (
          <Link href={`/orders/${order.id}/chat`} className="card flex items-center gap-3 p-4">
            <MessageCircle className="text-accent" />
            <span className="flex-1">
              <span className="block font-bold">Chat with {otherName}</span>
              <span className="text-[13px] text-muted">&quot;10 min away&quot;, &quot;At the gate&quot;…</span>
            </span>
          </Link>
        )}

        {order.status === "completed" && !myRating && <RateOrder orderId={order.id} name={otherName} />}

        {(order.status === "cancelled" || order.status === "refunded") && (
          <p className="card flex items-center gap-2 p-4 text-sm text-muted">
            <Undo2 size={16} /> {order.cancel_reason ?? "Cancelled"}. {order.amount_cents > 0 && "The buyer was refunded in full."}
          </p>
        )}

        {live && (isBuyer ? buyerCanCancel : true) && <CancelOrder orderId={order.id} asSeller={!isBuyer} />}
        {live && isBuyer && <ReportButton orderId={order.id} label="Report a problem at pickup" />}
        {isBuyer && isNew && <InstallPrompt />}
      </div>
    </main>
  );
}
