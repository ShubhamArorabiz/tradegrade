"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRADES } from "@/lib/constants";

export default function ProfileForm({ userId, initial }: { userId: string; initial: { full_name: string; company: string; trade: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        await createClient()
          .from("profiles")
          .update({ full_name: v.full_name.trim(), company: v.company.trim() || null, trade: v.trade || null })
          .eq("id", userId);
        setState("saved");
        router.refresh();
      }}
    >
      <div>
        <label className="label">Name</label>
        <input className="input" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
      </div>
      <div>
        <label className="label">Company</label>
        <input className="input" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
      </div>
      <div>
        <label className="label">Trade</label>
        <select className="input" value={v.trade} onChange={(e) => setV({ ...v, trade: e.target.value })}>
          <option value="">Choose…</option>
          {TRADES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <button className="btn-secondary w-full" disabled={!dirty || state === "saving" || v.full_name.trim().length < 2}>
        {state === "saving" ? "Saving…" : state === "saved" && !dirty ? "Saved" : "Save"}
      </button>
    </form>
  );
}
