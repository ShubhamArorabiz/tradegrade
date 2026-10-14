import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Box, ChevronLeft, Clock, Forklift, Hand, Info, MapPin, Package, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { conditionLabel, gradeLabel, loadingLabel, money, qty, timeAgo, timeLeft } from "@/lib/format";
import { feeFor, PICKUP_WINDOW_HOURS } from "@/lib/constants";
import type { ListingCard, SellerStats } from "@/lib/types";
import Gallery from "./Gallery";
import BuyNow from "./BuyNow";
import DistanceFrom from "./DistanceFrom";
import OwnerActions from "./OwnerActions";
import ReportButton from "@/components/ReportButton";

const LOADING_ICON = { hand: Hand, forklift: Forklift, truck: Truck };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await createAdminClient().from("listing_cards").select("title, price_cents, photos").eq("id", id).maybeSingle();
  if (!data) return { title: "Listing" };
  return {
    title: `${data.title} · ${money(data.price_cents)}`,
    openGraph: { images: data.photos?.slice(0, 1) },
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { id } = await params;
  const { cancelled } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { user } = await getUser();
  const db = createAdminClient();
  const { data: listing } = await db.from("listing_cards").select("*").eq("id", id).maybeSingle<ListingCard>();
  if (!listing) notFound();
  const { data: stats } = await db.from("seller_stats").select("*").eq("id", listing.seller_id).maybeSingle<SellerStats>();

  const isOwner = user?.id === listing.seller_id;
  const expired = new Date(listing.expires_at) < new Date();
  const available = listing.status === "active" && !expired;
  const LoadIcon = LOADING_ICON[listing.loading];
  const specs = Object.entries(listing.specs ?? {}).filter(([, v]) => v);

  return (
    <main className="pb-28">
      <div className="relative">
        <Gallery photos={listing.photos} title={listing.title} />
        <Link
          href="/buy"
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+0.75rem)] grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-card"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="page pt-4">
        {cancelled && available && (
          <p className="card mb-3 border-warn/40 bg-warn-soft p-3 text-sm text-warn">Checkout was cancelled. The item is still available.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {stats?.verified_business && (
            <span className="badge bg-ok-soft text-ok">
              <ShieldCheck size={11} /> Verified
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
            {listing.category} · Listed {timeAgo(listing.created_at)}
          </span>
          {listing.ai_assisted && (
            <span className="badge bg-ai-soft text-ai">
              <Sparkles size={11} /> AI filled
            </span>
          )}
          {listing.status === "reserved" && <span className="badge bg-warn-soft text-warn">Reserved</span>}
          {listing.status === "sold" && <span className="badge bg-ok-soft text-ok">Sold</span>}
          {listing.status === "active" && expired && <span className="badge bg-surface-2 text-faint">Expired</span>}
        </div>
        <h1 className="mt-2 text-[26px] font-extrabold leading-8 tracking-[-0.03em]">{listing.title}</h1>
        <div className="mt-1.5 flex items-baseline gap-2">
          {listing.price_cents === 0 ? (
            <span className="badge bg-brand px-2 py-1 text-[13px] text-white">Free</span>
          ) : (
            <span className="text-[30px] font-extrabold tracking-[-0.03em]">{money(listing.price_cents)}</span>
          )}
          <span className="text-[15px] text-muted">for {qty(listing.quantity, listing.unit)}</span>
        </div>
        {available && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-faint">
            <Clock size={12} /> {timeLeft(listing.expires_at)}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Fact label="Quantity" value={qty(listing.quantity, listing.unit)} icon={<Box size={18} />} />
          <Fact label="Condition" value={conditionLabel(listing.condition)} icon={<ShieldCheck size={18} />} />
          <Fact label="Loading" value={loadingLabel(listing.loading)} icon={<LoadIcon size={18} />} />
          <Fact label="Grade" value={gradeLabel(listing.grade) ?? "n/a"} icon={<Info size={18} />} />
        </div>

        <div className="card mt-3 flex items-center gap-3 p-3.5">
          <span className="bg-grid grid h-12 w-12 shrink-0 place-items-center rounded-xl">
            <MapPin size={20} className="text-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold">
              <DistanceFrom lat={listing.lat} lng={listing.lng} areaLabel={listing.area_label} />
            </p>
            <p className="text-[13px] text-muted">Exact address shared after purchase</p>
          </div>
        </div>

        {listing.description && <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{listing.description}</p>}

        {specs.length > 0 && (
          <div className="card mt-5 divide-y divide-line">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-muted">{k}</span>
                <span className="text-right font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card mt-5 flex items-center gap-3 p-4">
          <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-accent bg-surface font-extrabold text-accent">
            {(listing.seller_company || listing.seller_name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              {listing.seller_company || listing.seller_name || "Seller"}
              {stats?.verified_business && <BadgeCheck size={16} className="text-accent" aria-label="Verified business" />}
            </p>
            <p className="flex items-center gap-1 text-[13px] text-muted">
              {stats && stats.rating_count > 0 ? (
                <>
                  <Star size={13} className="fill-warn text-warn" /> {stats.rating_avg.toFixed(1)} ({stats.rating_count})
                </>
              ) : (
                "New seller"
              )}
              <span className="text-faint">· {stats?.completed_sales ?? 0} completed sales</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[13px] text-faint">
          <Package size={14} /> Exact pickup address shows after purchase. Pick up within {PICKUP_WINDOW_HOURS} h.
        </div>
        {!isOwner && user && (
          <div className="mt-3">
            <ReportButton listingId={listing.id} />
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
        <div className="page">
          {isOwner ? (
            <OwnerActions listingId={listing.id} status={listing.status} expired={expired} />
          ) : available ? (
            <BuyNow
              listing={{
                id: listing.id,
                title: listing.title,
                price_cents: listing.price_cents,
                photo: listing.photos[0],
                area_label: listing.area_label,
                loading: loadingLabel(listing.loading),
                quantity: qty(listing.quantity, listing.unit),
              }}
              signedIn={!!user}
              feeCents={feeFor(listing.price_cents)}
            />
          ) : (
            <button className="btn-secondary w-full" disabled>
              {listing.status === "sold" ? "Sold" : listing.status === "reserved" ? "Reserved by another buyer" : "No longer available"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 px-3 py-3 shadow-none">
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] text-faint">{label}</span>
        <span className="block truncate text-[13px] font-bold">{value}</span>
      </span>
    </div>
  );
}
