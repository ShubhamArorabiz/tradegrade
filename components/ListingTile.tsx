import Link from "next/link";
import { MapPin, ShieldCheck, Tag } from "lucide-react";
import { distance, money, qty } from "@/lib/format";
import type { NearbyListing } from "@/lib/types";

export default function ListingTile({ item }: { item: NearbyListing }) {
  const free = item.price_cents === 0;
  return (
    <Link href={`/listing/${item.id}`} className="card group block overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photos[0]}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {free ? (
          <span className="badge absolute left-2 top-2 bg-brand text-white">
            <Tag size={11} strokeWidth={2.6} />
            Free
          </span>
        ) : (
          item.verified_business && (
            <span className="badge absolute left-2 top-2 bg-ok-soft text-ok">
              <ShieldCheck size={11} strokeWidth={2.6} />
              Verified
            </span>
          )
        )}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[12px] font-bold text-ink shadow-sm">
          <MapPin size={11} strokeWidth={2.6} />
          {distance(item.distance_km)}
        </span>
      </div>
      <div className="p-3">
        <p className="text-[19px] font-extrabold leading-6 tracking-[-0.01em] text-ink">
          {money(item.price_cents)}
          {!free && <span className="ml-1 text-[12px] font-medium text-faint">/ lot</span>}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-[18px]">{item.title}</p>
        <p className="mt-1 truncate text-[12px] text-muted">
          {qty(item.quantity, item.unit)}
          {item.area_label ? ` · ${item.area_label}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function ListingTileSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-surface-2" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
