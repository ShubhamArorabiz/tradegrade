"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ShieldCheck, Truck, X, Zap } from "lucide-react";
import { money } from "@/lib/format";
import { PICKUP_WINDOW_HOURS } from "@/lib/constants";

type Props = {
  listing: {
    id: string;
    title: string;
    price_cents: number;
    photo: string;
    area_label: string | null;
    loading: string;
    quantity: string;
  };
  signedIn: boolean;
  feeCents: number;
};

export default function BuyNow({ listing, signedIn }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [asIs, setAsIs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const free = listing.price_cents === 0;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, asIs: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      try {
        localStorage.setItem("tg_did_something", "1");
      } catch {}
      if (data.url.startsWith("http")) window.location.href = data.url;
      else router.push(data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <p className="text-[19px] font-extrabold leading-6">{money(listing.price_cents)}</p>
          <p className="text-[12px] text-faint">pickup only</p>
        </div>
        <button
          className="btn-primary h-13 flex-1 text-[16px]"
          onClick={() => (signedIn ? setOpen(true) : router.push(`/login?next=/listing/${listing.id}`))}
        >
          <Zap size={18} /> {free ? "Reserve it" : "Buy Now"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={() => !busy && setOpen(false)}>
          <div
            className="page rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">{free ? "Reserve item" : "Confirm purchase"}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted">
                <X />
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.photo} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="font-bold leading-snug">{listing.title}</p>
                <p className="text-sm text-muted">
                  {listing.quantity} · {listing.loading}
                </p>
                <p className="text-sm text-faint">Pickup near {listing.area_label ?? "Toronto"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
              <div className="flex justify-between">
                <span className="text-muted">Item</span>
                <span>{money(listing.price_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">TradeGrade fee</span>
                <span>$0</span>
              </div>
              <div className="flex justify-between pt-1 text-[16px] font-bold">
                <span>Total charged now</span>
                <span className="text-[19px] font-extrabold">{money(listing.price_cents)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13px] text-muted">
              <p className="flex items-center gap-2">
                <Clock size={15} /> Pick up within {PICKUP_WINDOW_HOURS} h or you&apos;re refunded automatically
              </p>
              <p className="flex items-center gap-2">
                <Truck size={15} /> {listing.loading}
              </p>
            </div>
            <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm">
              <input type="checkbox" checked={asIs} onChange={(e) => setAsIs(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#1d4ed8]" />
              <span className="text-ink">
                I understand surplus is sold <b className="text-ink">as-is</b>. I&apos;ll check it at pickup before showing my QR code.
              </span>
            </label>
            {!free && (
              <p className="mt-3 flex items-start gap-2 text-[12px] text-faint">
                <ShieldCheck size={15} className="shrink-0 text-ok" />
                You&apos;re charged now. The seller is paid only after they scan your pickup pass. No pickup in {PICKUP_WINDOW_HOURS} h means a full refund.
              </p>
            )}
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <button className="btn-primary mt-4 w-full" disabled={!asIs || busy} onClick={confirm}>
              {busy ? "One moment…" : free ? "Reserve it" : "Pay with card, Apple Pay or Google Pay"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
