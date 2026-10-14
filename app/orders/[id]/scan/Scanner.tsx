"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { Check, Keyboard, Loader2, X } from "lucide-react";
import { money } from "@/lib/format";

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export default function Scanner({ orderId, done, payoutCents }: { orderId: string; done: boolean; payoutCents: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const [result, setResult] = useState<{ payout: number; status?: string } | null>(done ? { payout: payoutCents } : null);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");

  const submit = useCallback(
    async (value: string) => {
      if (busy.current) return;
      busy.current = true;
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/orders/${orderId}/pickup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        navigator.vibrate?.(80);
        setResult({ payout: data.payout_cents, status: data.payout_status });
      } catch (e) {
        setError((e as Error).message);
        setTimeout(() => (busy.current = false), 1500);
      } finally {
        setChecking(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    if (result) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    async function tick() {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !busy.current) {
        let text: string | null = null;
        if (detector) {
          const codes = await detector.detect(v).catch(() => []);
          text = codes[0]?.rawValue ?? null;
        } else {
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          text = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
        if (text?.startsWith("TG1:")) submit(text);
      }
      raf = requestAnimationFrame(() => setTimeout(tick, 120));
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setCamera("on");
        tick();
      })
      .catch(() => {
        setCamera("off");
        setTyping(true);
      });
    if (!navigator.mediaDevices) {
      setCamera("off");
      setTyping(true);
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [result, submit]);

  if (result) {
    return (
      <main className="page flex min-h-dvh flex-col justify-center py-10 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ok text-white shadow-[0_0_0_14px_var(--color-ok-soft)]"><Check size={40} strokeWidth={3} /></span>
        <h1 className="mt-8 text-[32px] font-extrabold tracking-[-0.03em]">Pickup confirmed</h1>
        {result.payout > 0 ? (
          <p className="mt-2 text-muted">
            <b className="block text-[30px] font-extrabold text-ok">{money(result.payout)}</b>
            <br />
            {result.status === "waiting_for_seller"
              ? "is waiting for you. Set up payouts to receive it."
              : "is on its way to your Stripe account."}
          </p>
        ) : (
          <p className="mt-2 text-muted">Free item handed over. Nice work keeping it out of the bin.</p>
        )}
        <div className="mt-8 space-y-3">
          {result.status === "waiting_for_seller" && (
            <Link href="/api/stripe/connect" className="btn-primary w-full">
              Set up payouts
            </Link>
          )}
          <Link href={`/orders/${orderId}`} className="btn-secondary w-full">
            Rate the buyer
          </Link>
          <Link href="/sell" className="btn-ghost w-full">
            Back to my sales
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-viewfinder">
      <div className="relative flex-1 overflow-hidden">
        {camera !== "off" && <video ref={video} playsInline muted className="h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-64 w-64 rounded-3xl border-[3px] border-accent shadow-[0_0_0_9999px_rgba(10,18,32,0.6)]" />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <Link href={`/orders/${orderId}`} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink" aria-label="Close">
            <X size={20} />
          </Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink">Scan the buyer&apos;s pass</span>
          <span className="w-10" />
        </div>
        {(checking || error) && (
          <div className="absolute inset-x-6 bottom-6 rounded-xl p-3 text-center text-sm text-white" style={{ background: error ? "var(--color-danger)" : "rgba(0,0,0,.7)" }}>
            {checking ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Checking…
              </span>
            ) : (
              error
            )}
          </div>
        )}
      </div>
      <div className="rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        {typing ? (
          <form
            className="mx-auto flex max-w-lg gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) submit(code);
            }}
          >
            <input
              className="input flex-1 text-center font-mono text-2xl tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
            <button className="btn-primary" disabled={code.length !== 6 || checking}>
              Confirm
            </button>
          </form>
        ) : (
          <button className="btn-secondary mx-auto flex w-full max-w-lg" onClick={() => setTyping(true)}>
            <Keyboard size={18} /> Type the 6-digit code instead
          </button>
        )}
      </div>
    </main>
  );
}
