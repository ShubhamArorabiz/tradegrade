import { NextResponse } from "next/server";

const UA = "TradeGrade/0.1 (https://tradegrade.ca)";

/**
 * Postal code → coordinates, or coordinates → neighbourhood name.
 * Uses OpenStreetMap Nominatim (free, ~1 request/second; swap for a paid
 * geocoder if traffic grows).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const postal = url.searchParams.get("postal");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  try {
    if (postal) {
      const clean = postal.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!/^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(clean)) return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
      const pretty = clean.length === 6 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ca&limit=1&postalcode=${encodeURIComponent(pretty)}`,
        { headers: { "User-Agent": UA }, next: { revalidate: 86400 } },
      );
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ lat: Number(hit.lat), lng: Number(hit.lon), label: pretty });
    }
    if (lat && lng) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${Number(lat)}&lon=${Number(lng)}`,
        { headers: { "User-Agent": UA }, next: { revalidate: 86400 } },
      );
      const data = (await res.json()) as { address?: Record<string, string> };
      const a = data.address ?? {};
      const label = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.town || a.city || null;
      return NextResponse.json({ label });
    }
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
  return NextResponse.json({ error: "Pass postal or lat/lng" }, { status: 400 });
}
