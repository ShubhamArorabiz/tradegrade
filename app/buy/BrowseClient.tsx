"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { List, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, CONDITIONS, DEFAULT_RADIUS_KM, RADII_KM } from "@/lib/constants";
import { distance, money } from "@/lib/format";
import ListingTile, { ListingTileSkeleton } from "@/components/ListingTile";
import LocationBar from "@/components/LocationBar";
import { useLocation } from "@/components/useLocation";
import { useNearby } from "@/components/useNearby";

const ListingMap = dynamic(() => import("@/components/ListingMap"), { ssr: false });

const PRICE_CAPS = [
  { label: "Any price", value: undefined },
  { label: "Under $50", value: 5000 },
  { label: "Under $250", value: 25000 },
  { label: "Under $1,000", value: 100000 },
];

export default function BrowseClient() {
  const params = useSearchParams();
  const router = useRouter();
  const loc = useLocation();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("cat") ?? "");
  const [radiusKm, setRadiusKm] = useState<number>(Number(params.get("r")) || DEFAULT_RADIUS_KM);
  const [freeOnly, setFreeOnly] = useState(params.get("free") === "1");
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [condition, setCondition] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(params.get("filters") === "1");
  const [selected, setSelected] = useState<string | null>(null);
  const sortNew = params.get("sort") === "new";

  const { items, error } = useNearby(
    loc.place
      ? { lat: loc.place.lat, lng: loc.place.lng, radiusKm, q: params.get("q") ?? "", category, freeOnly, maxPriceCents: maxPrice, condition }
      : null,
  );
  const sorted = useMemo(
    () => (items && sortNew ? [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)) : items),
    [items, sortNew],
  );
  const extraFilters = (maxPrice ? 1 : 0) + (condition ? 1 : 0) + (freeOnly ? 1 : 0);
  const onSelect = useCallback((id: string) => setSelected(id), []);
  const picked = sorted?.find((i) => i.id === selected);

  return (
    <main className="with-tabs">
      <div className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="page space-y-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">Buy surplus</h1>
            <div className="flex rounded-xl bg-surface-2 p-1 text-[13px] font-bold">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-3 ${view === v ? "bg-surface text-ink shadow-card" : "text-faint"}`}
                >
                  {v === "list" ? <List size={15} /> : <MapIcon size={15} />}
                  {v === "list" ? "List" : "Map"}
                </button>
              ))}
            </div>
          </div>
          <LocationBar place={loc.place} locating={loc.locating} error={loc.error} onLocate={loc.locate} onPostal={loc.usePostal} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = new URLSearchParams(params);
              if (q.trim()) next.set("q", q.trim());
              else next.delete("q");
              router.replace(`/buy?${next}`);
            }}
          >
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input h-11 pl-9" placeholder="Search surplus" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
            </div>
            <button type="button" onClick={() => setFiltersOpen(true)} className="btn-secondary relative h-11 w-11 px-0" aria-label="Filters">
              <SlidersHorizontal size={18} />
              {extraFilters > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] text-white">{extraFilters}</span>
              )}
            </button>
          </form>
          <div className="scroll-row">
            <button
              onClick={() => setRadiusKm(RADII_KM[(RADII_KM.indexOf(radiusKm as (typeof RADII_KM)[number]) + 1) % RADII_KM.length])}
              className="chip-on"
            >
              Within {radiusKm} km
            </button>
            <button onClick={() => setFreeOnly(!freeOnly)} className={freeOnly ? "chip-on" : "chip"}>
              Free only
            </button>
            <span className="mx-1 w-px shrink-0 bg-line" />
            <button onClick={() => setCategory("")} className={!category ? "chip-on" : "chip"}>
              All
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(category === c ? "" : c)} className={category === c ? "chip-on" : "chip"}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "map" && loc.place ? (
        <div className="relative h-[calc(100dvh-13.5rem)]">
          <ListingMap center={loc.place} radiusKm={radiusKm} items={sorted ?? []} onSelect={onSelect} />
          {picked && (
            <Link href={`/listing/${picked.id}`} className="card absolute inset-x-4 bottom-4 flex gap-3 p-2.5 animate-rise">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picked.photos[0]} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 py-1">
                <p className="text-[19px] font-extrabold tracking-[-0.01em]">{money(picked.price_cents)}</p>
                <p className="truncate text-[13px] font-bold">{picked.title}</p>
                <p className="text-xs text-muted">{distance(picked.distance_km)} away</p>
              </div>
            </Link>
          )}
        </div>
      ) : (
        <div className="page pt-4">
          {error && <p className="card mb-3 p-3 text-sm text-danger">{error}</p>}
          {sorted && (
            <p className="mb-3 text-[13px] text-muted">
              {sorted.length} {sorted.length === 1 ? "listing" : "listings"} · {sortNew ? "newest first" : "nearest first"}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {sorted === null
              ? Array.from({ length: 6 }).map((_, i) => <ListingTileSkeleton key={i} />)
              : sorted.map((i) => <ListingTile key={i.id} item={i} />)}
          </div>
          {sorted?.length === 0 && (
            <div className="card mt-2 p-6 text-center">
              <p className="font-semibold">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted">Try a wider radius or another category.</p>
              {radiusKm < 25 && (
                <button className="btn-secondary mt-4 h-10" onClick={() => setRadiusKm(25)}>
                  Search 25 km
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={() => setFiltersOpen(false)}>
          <div className="page rounded-t-3xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close" className="text-muted">
                <X />
              </button>
            </div>
            <p className="label">Price</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFreeOnly(!freeOnly)} className={freeOnly ? "chip-on" : "chip"}>
                Free only
              </button>
              {PRICE_CAPS.map((p) => (
                <button key={p.label} onClick={() => setMaxPrice(p.value)} className={maxPrice === p.value ? "chip-on" : "chip"}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="label mt-5">Condition</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCondition("")} className={!condition ? "chip-on" : "chip"}>
                Any
              </button>
              {CONDITIONS.map((c) => (
                <button key={c.value} onClick={() => setCondition(c.value)} className={condition === c.value ? "chip-on" : "chip"}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setFreeOnly(false);
                  setMaxPrice(undefined);
                  setCondition("");
                }}
              >
                Clear
              </button>
              <button className="btn-primary flex-1" onClick={() => setFiltersOpen(false)}>
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
