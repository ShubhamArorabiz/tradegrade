"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { MAX_PHOTOS } from "@/lib/constants";
import type { ListingDraft } from "@/lib/types";
import ReviewForm, { type ReviewValues } from "./ReviewForm";
import Listed from "./Listed";

type Shot = { id: string; blob: Blob; preview: string };
type Step = "camera" | "reading" | "review" | "done";

const AI_TIMEOUT_MS = 20_000;

export default function SnapToList({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("camera");
  const [shots, setShots] = useState<Shot[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | Blob[]) {
    const room = MAX_PHOTOS - shots.length;
    const picked = Array.from(files).slice(0, room);
    const next = await Promise.all(
      picked.map(async (f) => {
        const blob = await compressImage(f);
        return { id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) };
      }),
    );
    setShots((s) => [...s, ...next]);
  }

  async function uploadAll() {
    const supabase = createClient();
    return Promise.all(
      shots.map(async (s) => {
        const path = `${userId}/${s.id}.jpg`;
        const { error } = await supabase.storage.from("listing-photos").upload(path, s.blob, { contentType: "image/jpeg" });
        if (error) throw new Error("Photo upload failed. Check your signal and try again.");
        return supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
      }),
    );
  }

  async function readPhotos() {
    setError(null);
    setStep("reading");
    let urls: string[];
    try {
      urls = await uploadAll();
      setPhotoUrls(urls);
    } catch (e) {
      setError((e as Error).message);
      setStep("camera");
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photos: urls }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.draft.is_building_material) {
        setAiNote("We couldn't spot a building material. Try another angle, or fill it in below.");
        setDraft(null);
      } else {
        setDraft(data.draft);
        setAiNote(null);
      }
    } catch (e) {
      setDraft(null);
      setAiNote(
        (e as Error).name === "AbortError"
          ? "Claude is taking too long, so fill it in yourself. It only takes a minute."
          : `${(e as Error).message || "Claude couldn't read the photos"}. Fill it in below.`,
      );
    } finally {
      clearTimeout(timer);
      setStep("review");
    }
  }

  async function publish(values: ReviewValues) {
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, photos: photoUrls, ai_draft: draft }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Couldn't publish");
    try {
      localStorage.setItem("tg_did_something", "1");
    } catch {}
    setListingId(data.id);
    setStep("done");
  }

  if (step === "done" && listingId) return <Listed listingId={listingId} photo={shots[0]?.preview} />;

  if (step === "review") {
    return (
      <ReviewForm
        draft={draft}
        aiNote={aiNote}
        photos={shots.map((s) => s.preview)}
        onBack={() => setStep("camera")}
        onPublish={publish}
      />
    );
  }

  if (step === "reading") return <Reading photo={shots[0]?.preview} />;

  return (
    <Camera
      shots={shots}
      error={error}
      onCapture={(blob) => addFiles([blob])}
      onFiles={addFiles}
      onRemove={(id) => setShots((s) => s.filter((x) => x.id !== id))}
      onNext={readPhotos}
      onClose={() => router.push("/sell")}
    />
  );
}

function Camera({
  shots,
  error,
  onCapture,
  onFiles,
  onRemove,
  onNext,
  onClose,
}: {
  shots: Shot[];
  error: string | null;
  onCapture: (b: Blob) => void;
  onFiles: (f: FileList) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<"starting" | "on" | "off">("starting");
  const [flash, setFlash] = useState(false);
  const full = shots.length >= MAX_PHOTOS;

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setLive("on");
      })
      .catch(() => setLive("off"));
    if (!navigator.mediaDevices) setLive("off");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth || full) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    onCapture(await compressImage(canvas));
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {live !== "off" ? (
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <ImagePlus size={40} className="mx-auto text-accent" />
              <p className="mt-3 font-semibold">Camera isn&apos;t available</p>
              <p className="mt-1 text-sm text-muted">Allow camera access in your browser settings, or pick photos from your library.</p>
              <button className="btn-primary mt-5" onClick={() => fileInput.current?.click()}>
                Choose photos
              </button>
            </div>
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white/70" />}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink" aria-label="Close">
            <X size={20} />
          </button>
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-ink">
            {shots.length}/{MAX_PHOTOS} photos
          </span>
        </div>

        {live === "on" && shots.length === 0 && (
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border-2 border-ai/60 bg-white p-3 text-[13px] text-muted">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <Sparkles size={14} className="text-ai" /> Tips for a great listing
            </p>
            <p className="mt-1">Get the whole stack in frame, then a close-up of any label or bundle tag. Claude reads them.</p>
          </div>
        )}
        {error && (
          <p className="absolute inset-x-6 bottom-6 rounded-xl bg-danger p-3 text-sm text-white">{error}</p>
        )}
      </div>

      <div className="bg-black px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        {shots.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {shots.map((s, i) => (
              <div key={s.id} className="relative h-16 w-16 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="" className={`h-full w-full rounded-lg object-cover ${i === 0 ? "ring-2 ring-accent" : ""}`} />
                <button
                  onClick={() => onRemove(s.id)}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-black"
                  aria-label="Remove photo"
                >
                  <X size={12} />
                </button>
                {i === 0 && <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-accent text-center text-[9px] font-bold uppercase text-white">Cover</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <button onClick={() => fileInput.current?.click()} className="grid h-12 w-12 place-items-center rounded-xl bg-white text-ink" aria-label="Pick from library" disabled={full}>
            <ImagePlus size={22} />
          </button>
          <button
            onClick={shoot}
            disabled={live !== "on" || full}
            aria-label="Take photo"
            className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-accent disabled:opacity-40"
          >
            <span className="h-[60px] w-[60px] rounded-full bg-white active:scale-90 transition" />
          </button>
          <button
            onClick={onNext}
            disabled={shots.length === 0}
            className="flex h-12 items-center gap-1 rounded-full bg-accent px-5 font-bold text-white disabled:opacity-30"
          >
            Next <Check size={18} />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </main>
  );
}

const READING_STEPS = ["Uploading photos", "Spotting the material", "Reading labels and sizes", "Counting units", "Checking Toronto prices"];

function Reading({ photo }: { photo?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => Math.min(x + 1, READING_STEPS.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="page flex min-h-dvh flex-col py-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-x-0 top-0 h-full" style={{ animation: "scan 1.6s ease-in-out infinite alternate" }}>
          <div className="h-1/3 -translate-y-full bg-gradient-to-b from-transparent to-ai/35" />
          <div className="h-0.5 -translate-y-full bg-ai" />
        </div>
      </div>
      <h1 className="mt-6 flex items-center gap-2 text-[22px] font-extrabold tracking-[-0.02em]">
        <Sparkles className="text-ai" /> Claude is reading your photos
      </h1>
      <p className="mt-1 text-[13px] text-muted">About 5 seconds. You can change anything on the next screen.</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-ai transition-all duration-700" style={{ width: `${((n + 1) / READING_STEPS.length) * 100}%` }} />
      </div>
      <ul className="card mt-4 divide-y divide-line">
        {READING_STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 px-4 py-3 text-[15px] transition ${i <= n ? "font-bold text-ink" : "text-faint"}`}>
            {i < n ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ai-soft text-ai">
                <Check size={13} strokeWidth={3} />
              </span>
            ) : i === n ? (
              <Loader2 size={20} className="animate-spin text-ai" />
            ) : (
              <span className="h-5 w-5 rounded-full border-2 border-dashed border-line-strong" />
            )}
            {s}
          </li>
        ))}
      </ul>
    </main>
  );
}
