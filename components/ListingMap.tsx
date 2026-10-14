"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { money } from "@/lib/format";
import type { NearbyListing } from "@/lib/types";

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.75, "raster-contrast": -0.1, "raster-brightness-min": 0.08 } },
  ],
};

function circle(lat: number, lng: number, km: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return pts;
}

export default function ListingMap({
  center,
  radiusKm,
  items,
  onSelect,
}: {
  center: { lat: number; lng: number };
  radiusKm: number;
  items: NearbyListing[];
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [center.lng, center.lat], zoom: 11 });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const ring = { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [circle(center.lat, center.lng, radiusKm)] } };
      const src = m.getSource("ring") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(ring);
      else {
        m.addSource("ring", { type: "geojson", data: ring });
        m.addLayer({ id: "ring-fill", type: "fill", source: "ring", paint: { "fill-color": "#1d4ed8", "fill-opacity": 0.07 } });
        m.addLayer({ id: "ring-line", type: "line", source: "ring", paint: { "line-color": "#1d4ed8", "line-width": 1.5, "line-dasharray": [2, 2] } });
      }
      const ring_ = circle(center.lat, center.lng, radiusKm);
      const bounds = ring_.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(ring_[0], ring_[0]));
      m.fitBounds(bounds, { padding: 24, duration: 0 });
    };
    if (m.isStyleLoaded()) draw();
    else m.once("load", draw);
  }, [center.lat, center.lng, radiusKm]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = items.map((item) => {
      const pin = document.createElement("button");
      pin.className =
        "rounded-full border px-2.5 py-1 text-[12px] font-extrabold shadow-[0_4px_12px_rgb(10_28_51/0.15)] " +
        (item.price_cents === 0 ? "border-ok bg-ok text-white" : "border-line bg-white text-ink");
      pin.textContent = money(item.price_cents);
      pin.onclick = () => onSelect(item.id);
      return new maplibregl.Marker({ element: pin }).setLngLat([item.approx_lng, item.approx_lat]).addTo(m);
    });
  }, [items, onSelect]);

  return <div ref={el} className="bg-grid h-full w-full" />;
}
