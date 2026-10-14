import { CONDITIONS, GRADES, LOADING } from "./constants";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const cadWhole = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function money(cents: number) {
  if (cents === 0) return "Free";
  return cents % 100 === 0 ? cadWhole.format(cents / 100) : cad.format(cents / 100);
}

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export function gradeLabel(value: string | null) {
  return GRADES.find((g) => g.value === value)?.label ?? null;
}

export function loadingLabel(value: string) {
  return LOADING.find((l) => l.value === value)?.label ?? value;
}

export function qty(quantity: number, unit: string) {
  const n = Number(quantity);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`;
}

export function distance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function timeLeft(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  if (s <= 0) return "expired";
  if (s < 3600) return `${Math.ceil(s / 60)}m left`;
  if (s < 86400) return `${Math.floor(s / 3600)}h left`;
  return `${Math.floor(s / 86400)}d left`;
}

/** Haversine distance in km. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
