"use client";

import { useState } from "react";
import { ChevronDown, Crosshair, MapPin } from "lucide-react";
import type { Place } from "./useLocation";

export default function LocationBar({
  place,
  locating,
  error,
  onLocate,
  onPostal,
}: {
  place: Place | null;
  locating: boolean;
  error: string | null;
  onLocate: () => void;
  onPostal: (postal: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [postal, setPostal] = useState("");

  if (editing || (error && place?.source === "default")) {
    return (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (postal.trim()) onPostal(postal.trim());
          setEditing(false);
        }}
      >
        <input
          className="input h-10 flex-1 uppercase"
          placeholder="Postal code, e.g. M5V 2T6"
          value={postal}
          onChange={(e) => setPostal(e.target.value)}
          autoFocus={editing}
          maxLength={7}
        />
        <button className="btn-secondary h-10 px-3 text-sm" type="submit">
          Set
        </button>
        <button type="button" className="btn-secondary h-10 w-10 px-0" onClick={onLocate} aria-label="Use my location">
          <Crosshair size={16} />
        </button>
      </form>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="min-w-0 text-left">
      <span className="block text-[13px] text-faint">Pickup near</span>
      <span className="flex items-center gap-1.5 text-[17px] font-bold tracking-[-0.01em] text-ink">
        <MapPin size={17} strokeWidth={2.4} className="shrink-0 text-accent" />
        <span className="truncate">{locating ? "Finding you…" : (place?.label ?? "Set your location")}</span>
        <ChevronDown size={17} className="shrink-0 text-muted" />
      </span>
    </button>
  );
}
