"use client";

import Link from "next/link";
import { Camera, Check, Share2 } from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";

export default function Listed({ listingId, photo }: { listingId: string; photo?: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/listing/${listingId}` : `/listing/${listingId}`;
  return (
    <main className="page flex min-h-dvh flex-col justify-center bg-gradient-to-b from-accent-soft to-bg py-10 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent text-white shadow-lift">
        <Check size={38} strokeWidth={3} />
      </span>
      <h1 className="mt-6 text-[34px] font-extrabold tracking-[-0.035em]">You&apos;re listed!</h1>
      <p className="mt-1 text-[15px] text-muted">Contractors nearby can see it now. It stays up for 7 days.</p>
      {photo && (
        <Link href={`/listing/${listingId}`} className="card mx-auto mt-6 block w-44 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />
          <span className="block p-2 text-[13px] font-bold">View listing</span>
        </Link>
      )}
      <div className="mt-8 space-y-3">
        <button
          className="btn-primary w-full"
          onClick={() => {
            if (navigator.share) navigator.share({ title: "On TradeGrade", url }).catch(() => {});
            else navigator.clipboard?.writeText(url);
          }}
        >
          <Share2 size={18} /> Share listing link
        </button>
        <Link href="/sell/new" className="btn-secondary w-full" onClick={() => window.location.assign("/sell/new")}>
          <Camera size={18} /> List another item
        </Link>
      </div>
      <div className="text-left">
        <InstallPrompt />
      </div>
    </main>
  );
}
