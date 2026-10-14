"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export default function ReportButton({ listingId, orderId, label = "Report this listing" }: { listingId?: string; orderId?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");
  const [reason, setReason] = useState("");

  if (state === "sent") return <p className="text-[13px] text-ok">Thanks. Our team will take a look.</p>;
  if (state === "idle")
    return (
      <button onClick={() => setState("open")} className="flex items-center gap-1.5 text-[13px] text-faint hover:text-muted">
        <Flag size={13} /> {label}
      </button>
    );

  return (
    <form
      className="card space-y-2 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listingId, orderId, reason }),
        });
        if (res.ok) setState("sent");
      }}
    >
      <textarea className="textarea min-h-20" placeholder="What's wrong?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost h-9 text-sm" onClick={() => setState("idle")}>
          Cancel
        </button>
        <button className="btn-secondary h-9 text-sm" disabled={reason.trim().length < 3}>
          Send report
        </button>
      </div>
    </form>
  );
}
