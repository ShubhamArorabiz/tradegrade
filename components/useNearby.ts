"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NearbyListing } from "@/lib/types";

export type NearbyQuery = {
  lat: number;
  lng: number;
  radiusKm: number;
  q?: string;
  category?: string;
  freeOnly?: boolean;
  maxPriceCents?: number;
  condition?: string;
};

export function useNearby(query: NearbyQuery | null) {
  const [items, setItems] = useState<NearbyListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setError(null);
    createClient()
      .rpc("nearby_listings", {
        lat: query.lat,
        lng: query.lng,
        radius_km: query.radiusKm,
        q: query.q?.trim() || null,
        cat: query.category || null,
        free_only: query.freeOnly ?? false,
        max_price_cents: query.maxPriceCents ?? null,
        cond: query.condition || null,
        max_rows: 100,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError("Couldn't load listings. Pull to refresh or try again.");
        setItems((data as NearbyListing[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, error };
}
