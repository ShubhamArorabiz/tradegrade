"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Crosshair, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import BackHeader from "@/components/BackHeader";
import { getGps } from "@/components/useLocation";
import { CATEGORIES, CONDITIONS, GRADES, LOADING, MAX_PRICE_CENTS, MIN_PRICE_CENTS, UNITS } from "@/lib/constants";
import type { Condition, Grade, ListingDraft, Loading } from "@/lib/types";

export type ReviewValues = {
  title: string;
  description: string;
  category: string;
  condition: Condition;
  grade: Grade | null;
  specs: Record<string, string>;
  quantity: number;
  unit: string;
  price_cents: number;
  loading: Loading;
  lat: number;
  lng: number;
  area_label: string | null;
  pickup_address: string | null;
  pickup_notes: string | null;
};

export default function ReviewForm({
  draft,
  aiNote,
  photos,
  onBack,
  onPublish,
}: {
  draft: ListingDraft | null;
  aiNote: string | null;
  photos: string[];
  onBack: () => void;
  onPublish: (v: ReviewValues) => Promise<void>;
}) {
  const unsure = new Set(draft?.uncertain_fields ?? []);
  const ai = !!draft;

  const [title, setTitle] = useState(draft?.title ?? "");
  const [category, setCategory] = useState<string>(draft?.category ?? "");
  const [quantity, setQuantity] = useState(draft ? String(draft.quantity) : "1");
  const [unit, setUnit] = useState<string>(draft?.unit ?? "lot");
  const [condition, setCondition] = useState<Condition>(draft?.condition ?? "new");
  const [grade, setGrade] = useState<Grade | null>(draft?.grade ?? null);
  const [specs, setSpecs] = useState<{ name: string; value: string }[]>(draft?.specs ?? []);
  const [description, setDescription] = useState(draft?.description ?? "");
  const [free, setFree] = useState(false);
  const [price, setPrice] = useState(draft ? String(Math.round(draft.suggested_price_cad)) : "");
  const [loading, setLoading] = useState<Loading>("hand");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [areaLabel, setAreaLabel] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [locState, setLocState] = useState<"finding" | "ok" | "denied">("finding");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function findMe() {
    setLocState("finding");
    try {
      const p = await getGps();
      setPos(p);
      setLocState("ok");
      const res = await fetch(`/api/geocode?lat=${p.lat}&lng=${p.lng}`);
      const { label } = await res.json().catch(() => ({ label: null }));
      if (label) setAreaLabel((cur) => cur || label);
    } catch {
      setLocState("denied");
    }
  }

  async function fromPostal(postal: string) {
    const res = await fetch(`/api/geocode?postal=${encodeURIComponent(postal)}`);
    if (!res.ok) return setError("We couldn't find that postal code");
    const { lat, lng } = await res.json();
    setPos({ lat, lng });
    setLocState("ok");
    setError(null);
  }

  useEffect(() => {
    findMe();
  }, []);

  const priceCents = free ? 0 : Math.round(Number(price) * 100);
  const priceOk = free || (priceCents >= MIN_PRICE_CENTS && priceCents <= MAX_PRICE_CENTS);
  const ready = title.trim().length >= 3 && category && Number(quantity) > 0 && priceOk && pos;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !pos) return;
    setBusy(true);
    setError(null);
    try {
      await onPublish({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        grade,
        specs: Object.fromEntries(specs.filter((s) => s.name.trim() && s.value.trim()).map((s) => [s.name.trim(), s.value.trim()])),
        quantity: Number(quantity),
        unit,
        price_cents: priceCents,
        loading,
        lat: pos.lat,
        lng: pos.lng,
        area_label: areaLabel.trim() || null,
        pickup_address: address.trim() || null,
        pickup_notes: notes.trim() || null,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const Tag = ({ field }: { field: string }) =>
    !ai ? null : unsure.has(field as never) ? (
      <span className="badge bg-warn-soft text-warn">
        <AlertTriangle size={11} /> Check this
      </span>
    ) : (
      <span className="badge bg-ai-soft text-ai">
        <Sparkles size={11} /> AI filled
      </span>
    );
  const aiCls = (field: string) =>
    !ai ? "" : unsure.has(field as never) ? " border-warn ring-2 ring-warn/10" : " border-ai/50 bg-ai-soft";

  return (
    <main className="pb-32">
      <BackHeader title="Review listing" onBack={onBack} />
      <form onSubmit={submit} className="page space-y-5 pt-4">
        <div className="scroll-row">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt="" className={`h-20 w-20 shrink-0 rounded-xl object-cover ${i === 0 ? "ring-2 ring-accent" : ""}`} />
          ))}
        </div>

        {ai ? (
          <p className="flex items-start gap-2 rounded-xl border border-ai/40 bg-ai-soft p-3 text-[13px] text-ink">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-ai" />
            Claude filled this in from your photos. Fields in yellow need a quick check. Set your price and publish.
          </p>
        ) : (
          aiNote && <p className="rounded-xl bg-warn-soft p-3 text-[13px] text-warn">{aiNote}</p>
        )}

        <div>
          <label className="label">
            Title <Tag field="title" />
          </label>
          <input className={"input" + aiCls("title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. 40 sheets 1/2 in drywall, 4x8" />
        </div>

        <div>
          <label className="label">
            Category <Tag field="category" />
          </label>
          <select className={"input" + aiCls("category")} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>
              Choose…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Quantity <Tag field="quantity" />
            </label>
            <input className={"input" + aiCls("quantity")} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div>
            <label className="label">
              Unit <Tag field="unit" />
            </label>
            <select className={"input" + aiCls("unit")} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">
            Condition <Tag field="condition" />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CONDITIONS.map((c) => (
              <button type="button" key={c.value} onClick={() => setCondition(c.value)} className={`${condition === c.value ? "chip-on" : "chip"} justify-center`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">
            Material grade <Tag field="grade" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GRADES.map((g) => (
              <button type="button" key={g.value} onClick={() => setGrade(g.value)} className={`${grade === g.value ? "chip-on" : "chip"} justify-center`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">
            Specs <Tag field="specs" />
          </label>
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input h-11 w-2/5"
                  value={s.name}
                  placeholder="Size"
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="input h-11 flex-1"
                  value={s.value}
                  placeholder="4 x 8 ft"
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <button type="button" className="btn-ghost h-11 w-10 px-0" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="Remove spec">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {specs.length < 8 && (
              <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-accent" onClick={() => setSpecs([...specs, { name: "", value: "" }])}>
                <Plus size={15} /> Add spec
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label">
            Description <Tag field="description" />
          </label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What it is, how it's been stored, anything a buyer should know" />
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              Price <Tag field="price" />
            </span>
            <label className="flex items-center gap-2 text-sm text-muted">
              Free, just pick it up
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-5 w-5 accent-[#ff6a00]" />
            </label>
          </div>
          {!free && (
            <>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted">$</span>
                <input className="input pl-8 text-lg font-semibold" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
              </div>
              {draft && (
                <div>
                  <p className="text-[12px] text-faint">
                    Similar surplus in Toronto: ${Math.round(draft.price_low_cad)} to ${Math.round(draft.price_high_cad)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {[draft.price_low_cad, draft.suggested_price_cad, draft.price_high_cad].map((p, i) => (
                      <button type="button" key={i} onClick={() => setPrice(String(Math.round(p)))} className={Number(price) === Math.round(p) ? "chip-on" : "chip"}>
                        ${Math.round(p)}
                        {i === 1 && " · suggested"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!priceOk && price && <p className="text-[12px] text-danger">Price must be between $5 and $25,000, or Free.</p>}
            </>
          )}
        </div>

        <div>
          <label className="label">Loading at pickup</label>
          <div className="grid grid-cols-3 gap-2">
            {LOADING.map((l) => (
              <button type="button" key={l.value} onClick={() => setLoading(l.value)} className={`${loading === l.value ? "chip-on" : "chip"} justify-center`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Pickup location</span>
            <button type="button" onClick={findMe} className="flex items-center gap-1 text-[13px] font-semibold text-accent">
              {locState === "finding" ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />} Use GPS
            </button>
          </div>
          {locState === "ok" && <p className="text-[13px] text-ok">Location set. Buyers see the neighbourhood and distance only.</p>}
          {locState === "denied" && <PostalFallback onSubmit={fromPostal} />}
          <div>
            <label className="label">Neighbourhood (shown publicly)</label>
            <input className="input" value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} placeholder="e.g. Liberty Village" maxLength={60} />
          </div>
          <div>
            <label className="label">Exact address (buyer sees it after paying)</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Site address" maxLength={200} />
          </div>
          <div>
            <label className="label">Pickup notes (after paying)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, hours, who to ask for" maxLength={300} />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
          <div className="page">
            <button className="btn-primary w-full text-[16px]" disabled={!ready || busy}>
              {busy ? "Publishing…" : free ? "Publish as free" : `Publish${priceOk && price ? ` · $${Number(price).toLocaleString("en-CA")}` : ""}`}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

function PostalFallback({ onSubmit }: { onSubmit: (p: string) => void }) {
  const [postal, setPostal] = useState("");
  return (
    <div>
      <p className="mb-2 text-[13px] text-warn">Location is off. Enter the site&apos;s postal code instead.</p>
      <div className="flex gap-2">
        <input className="input h-11 flex-1 uppercase" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="M5V 2T6" maxLength={7} />
        <button type="button" className="btn-secondary h-11" onClick={() => postal.trim() && onSubmit(postal.trim())}>
          Set
        </button>
      </div>
    </div>
  );
}
