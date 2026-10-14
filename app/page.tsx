"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bell, Camera, Search, SlidersHorizontal, User } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import ListingTile, { ListingTileSkeleton } from "@/components/ListingTile";
import LocationBar from "@/components/LocationBar";
import { useLocation } from "@/components/useLocation";
import { useNearby } from "@/components/useNearby";
import type { NearbyListing } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const loc = useLocation();
  const { items } = useNearby(loc.place ? { lat: loc.place.lat, lng: loc.place.lng, radiusKm: 25 } : null);

  const rows = useMemo(() => {
    const all = items ?? [];
    return {
      near: all.filter((i) => i.distance_km <= 10).slice(0, 6),
      fresh: [...all].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
      free: all.filter((i) => i.price_cents === 0).slice(0, 8),
    };
  }, [items]);

  return (
    <main className="with-tabs">
      <div className="page pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center justify-between gap-3">
          <LocationBar
            place={loc.place}
            locating={loc.locating}
            error={loc.error}
            onLocate={loc.locate}
            onPostal={loc.usePostal}
          />
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/orders" aria-label="My orders" className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">
              <Bell size={20} />
            </Link>
            <Link
              href="/profile"
              aria-label="Profile"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-accent bg-surface text-accent"
            >
              <User size={19} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/buy${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
            }}
          >
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="input pl-10"
              placeholder="Search drywall, lumber, wire…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              enterKeyHint="search"
            />
          </form>
          <Link href="/buy?filters=1" aria-label="Filters" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface">
            <SlidersHorizontal size={19} />
          </Link>
        </div>

        <Link
          href="/sell/new"
          className="mt-5 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-accent to-[#1e3a8a] p-4 pl-5 text-white shadow-lift active:scale-[0.99]"
        >
          <span className="flex-1">
            <span className="block text-[22px] font-extrabold tracking-[-0.02em]">Got leftovers?</span>
            <span className="mt-0.5 block max-w-[15rem] text-[13px] leading-[18px] text-white/90">
              Snap a photo. Claude writes the listing in seconds.
            </span>
          </span>
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand shadow-[0_6px_16px_-4px_rgb(255_106_0/0.7)]">
            <Camera size={24} />
          </span>
        </Link>

        <div className="scroll-row mt-5">
          <Link href="/buy" className="chip-on">
            All
          </Link>
          {CATEGORIES.slice(0, 10).map((c) => (
            <Link key={c} href={`/buy?cat=${encodeURIComponent(c)}`} className="chip">
              {c}
            </Link>
          ))}
        </div>

        <Row title="Near you" href="/buy" items={items === null ? null : rows.near} grid empty="Nothing within 10 km yet. Be the first to post." />
        {rows.fresh.length > 0 && <Row title="Just listed" href="/buy?sort=new" items={rows.fresh} />}
        {rows.free.length > 0 && <Row title="Free, pick up" href="/buy?free=1" items={rows.free} />}
      </div>
    </main>
  );
}

function Row({
  title,
  href,
  items,
  grid,
  empty,
}: {
  title: string;
  href: string;
  items: NearbyListing[] | null;
  grid?: boolean;
  empty?: string;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{title}</h2>
        <Link href={href} className="text-[13px] font-bold text-accent">
          See all
        </Link>
      </div>
      {items === null ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListingTileSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="card p-5 text-center text-sm text-muted">{empty}</p>
      ) : grid ? (
        <div className="grid grid-cols-2 gap-3">
          {items.map((i) => (
            <ListingTile key={i.id} item={i} />
          ))}
        </div>
      ) : (
        <div className="scroll-row">
          {items.map((i) => (
            <div key={i.id} className="w-44 shrink-0">
              <ListingTile item={i} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
