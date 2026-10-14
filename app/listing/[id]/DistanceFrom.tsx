"use client";

import { useEffect, useState } from "react";
import { distance, kmBetween } from "@/lib/format";

export default function DistanceFrom({ lat, lng, areaLabel }: { lat: number; lng: number; areaLabel: string | null }) {
  const [km, setKm] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tg_place");
      if (raw) setKm(kmBetween(JSON.parse(raw), { lat, lng }));
    } catch {}
  }, [lat, lng]);
  return (
    <span>
      {areaLabel ?? "Toronto"}
      {km !== null && ` · ${distance(km)} away`}
    </span>
  );
}
