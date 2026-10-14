"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CENTER } from "@/lib/constants";

export type Place = { lat: number; lng: number; label: string; source: "gps" | "postal" | "default" };

const KEY = "tg_place";

function read(): Place | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

function write(place: Place) {
  try {
    localStorage.setItem(KEY, JSON.stringify(place));
  } catch {}
}

export function getGps(timeout = 10000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("No GPS in this browser"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });
}

/** The buyer's search centre: GPS if allowed, else a postal code, else downtown Toronto. */
export function useLocation() {
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const pos = await getGps();
      const next: Place = { ...pos, label: "Your location", source: "gps" };
      write(next);
      setPlace(next);
    } catch {
      setError("Location is off. Enter a postal code instead.");
      setPlace((p) => p ?? { ...DEFAULT_CENTER, label: "Downtown Toronto", source: "default" });
    } finally {
      setLocating(false);
    }
  }, []);

  const usePostal = useCallback(async (postal: string) => {
    setLocating(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?postal=${encodeURIComponent(postal)}`);
      if (!res.ok) throw new Error();
      const { lat, lng, label } = await res.json();
      const next: Place = { lat, lng, label, source: "postal" };
      write(next);
      setPlace(next);
    } catch {
      setError("We couldn't find that postal code.");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    const saved = read();
    if (saved) setPlace(saved);
    else locate();
  }, [locate]);

  return { place, locating, error, locate, usePostal };
}
