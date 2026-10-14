import Link from "next/link";
import { Camera, ChevronRight, MessageCircle, QrCode, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { money, qty, timeAgo, timeLeft } from "@/lib/format";
import type { Listing, Order } from "@/lib/types";
import RelistButton from "./RelistButton";

export const metadata = { title: "My sales" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "reserved", label: "Reserved" },
  { key: "sold", label: "Sold" },
] as const;

export default async function SellPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "active" } = await searchParams;
  const { supabase, user, profile } = await requireUser("/sell");

  const [{ data: listings }, { data: orders }] = await Promise.all([
    supabase.from("listings").select("*").eq("seller_id", user.id).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("orders").select("*").eq("seller_id", user.id).in("status", ["paid", "completed"]).order("created_at", { ascending: false }),
  ]);
  const all = (listings ?? []) as Listing[];
  const orderFor = new Map(((orders ?? []) as Order[]).map((o) => [o.listing_id, o]));
  const now = Date.now();
  const shown = all.filter((l) => l.status === tab);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((l) => l.status === t.key).length]));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const soldThisMonth = ((orders ?? []) as Order[]).filter((o) => o.status === "completed" && new Date(o.completed_at ?? o.created_at).getTime() >= monthStart);
  const earned = soldThisMonth.reduce((sum, o) => sum + o.amount_cents - o.fee_cents, 0);
  const waiting = ((orders ?? []) as Order[]).filter((o) => o.status === "completed" && o.payout_status === "waiting_for_seller");

  return (
    <main className="with-tabs">
      <div className="page pt-[calc(env(safe-area-inset-top)+1rem)]">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">My sales</h1>

        <div className="card mt-3 flex items-center gap-3 bg-gradient-to-br from-white to-accent-soft p-4">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-faint">Earned this month</p>
            <p className="text-[30px] font-extrabold tracking-[-0.03em]">{money(earned).replace("Free", "$0")}</p>
            <p className="text-[12px] text-muted">
              {soldThisMonth.length} sold
              {waiting.length > 0 && ` · ${money(waiting.reduce((s, o) => s + o.amount_cents - o.fee_cents, 0))} waiting on payout setup`}
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <Wallet size={20} />
          </span>
        </div>

        <Link href="/sell/new" className="mt-3 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-accent to-[#1e3a8a] p-4 text-white shadow-lift active:scale-[0.99]">
          <span className="flex-1">
            <span className="block text-[17px] font-extrabold">Snap to sell</span>
            <span className="text-[13px] text-white/90">Photo in, listing out in under a minute</span>
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand">
            <Camera size={22} />
          </span>
        </Link>

        {!profile.payouts_enabled && (
          <Link href="/api/stripe/connect" className="card mt-3 flex items-center gap-3 border-warn/40 p-4">
            <Wallet className="shrink-0 text-warn" />
            <span className="flex-1 text-sm">
              <b>Set up payouts</b>
              <span className="block text-muted">
                {waiting.length > 0
                  ? `${money(waiting.reduce((s, o) => s + o.amount_cents - o.fee_cents, 0))} is waiting for you.`
                  : "Takes 3 minutes with Stripe. You'll need it before your first paid sale lands."}
              </span>
            </span>
            <ChevronRight className="text-faint" />
          </Link>
        )}

        <div className="mt-5 grid grid-cols-3 rounded-xl bg-surface-2 p-1 text-[13px] font-bold">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/sell?tab=${t.key}`}
              className={`rounded-lg py-2 text-center ${tab === t.key ? "bg-surface text-ink shadow-card" : "text-faint"}`}
            >
              {t.label} · {counts[t.key]}
            </Link>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {shown.length === 0 && (
            <p className="card p-6 text-center text-sm text-muted">
              {tab === "active" ? "Nothing listed. Snap a photo of your leftovers to start." : tab === "reserved" ? "No pickups waiting." : "No sales yet."}
            </p>
          )}
          {shown.map((l) => {
            const order = orderFor.get(l.id);
            const expired = new Date(l.expires_at).getTime() < now;
            return (
              <div key={l.id} className={`card p-3 ${tab === "reserved" && order?.status === "paid" ? "border-accent" : ""}`}>
                <Link href={order && tab !== "active" ? `/orders/${order.id}` : `/listing/${l.id}`} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.photos[0]} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-bold leading-snug">{l.title}</p>
                    <p className="mt-0.5 text-[17px] font-extrabold">{money(l.price_cents)}</p>
                    <p className="text-[12px] text-faint">
                      {qty(l.quantity, l.unit)} ·{" "}
                      {tab === "active"
                        ? expired
                          ? "Expired"
                          : timeLeft(l.expires_at)
                        : order?.completed_at
                          ? `Picked up ${timeAgo(order.completed_at)}`
                          : order?.pickup_deadline
                            ? `Pickup by ${new Date(order.pickup_deadline).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                            : "Buyer is checking out"}
                    </p>
                  </div>
                </Link>
                {tab === "active" && expired && <RelistButton listingId={l.id} />}
                {tab === "reserved" && order?.status === "paid" && (
                  <div className="mt-3 flex gap-2">
                    <Link href={`/orders/${order.id}/scan`} className="btn-primary h-11 flex-1 shadow-none">
                      <QrCode size={18} /> Scan pickup
                    </Link>
                    <Link href={`/orders/${order.id}/chat`} className="btn-secondary h-11">
                      <MessageCircle size={17} /> Chat
                    </Link>
                  </div>
                )}
                {tab === "sold" && order && (
                  <p className="mt-2 text-[12px] text-muted">
                    You get {money(order.amount_cents - order.fee_cents)} ·{" "}
                    {order.payout_status === "paid_out"
                      ? "Paid out"
                      : order.payout_status === "waiting_for_seller"
                        ? "Waiting for payout setup"
                        : order.payout_status === "failed"
                          ? "Payout failed, we're on it"
                          : "No payout (free item)"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
