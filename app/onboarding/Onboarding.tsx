"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRADES } from "@/lib/constants";

export default function Onboarding({ next, userId, suggestedName = "" }: { next: string; userId: string; suggestedName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="page min-h-dvh pb-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <h1 className="font-display text-[44px]">Welcome aboard</h1>
      <p className="mt-1 text-muted">Tell buyers and sellers who they&apos;re dealing with.</p>
      <form
        className="mt-6 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim().length < 2) return setError("Add your name");
          setBusy(true);
          const { error } = await createClient()
            .from("profiles")
            .update({ full_name: name.trim(), company: company.trim() || null, trade: trade || null })
            .eq("id", userId);
          if (error) {
            setBusy(false);
            return setError(error.message);
          }
          router.replace(next);
          router.refresh();
        }}
      >
        <div>
          <label className="label">Your name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
        </div>
        <div>
          <label className="label">Company (optional)</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" placeholder="Shown on your listings" />
        </div>
        <div>
          <label className="label">Your trade</label>
          <div className="flex flex-wrap gap-2">
            {TRADES.map((t) => (
              <button type="button" key={t} onClick={() => setTrade(t)} className={trade === t ? "chip-on" : "chip"}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Start"}
        </button>
      </form>
    </main>
  );
}
