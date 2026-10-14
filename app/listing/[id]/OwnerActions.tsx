"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@/lib/types";

export default function OwnerActions({ listingId, status, expired }: { listingId: string; status: ListingStatus; expired: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "relist" | "remove") {
    if (action === "remove" && !confirm("Take this listing down?")) return;
    setBusy(true);
    await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  if (status === "reserved" || status === "sold") {
    return (
      <button className="btn-secondary w-full" onClick={() => router.push("/sell")}>
        {status === "sold" ? "Sold. See your sales" : "A buyer has this. Manage pickup"}
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button className="btn-danger flex-1" disabled={busy} onClick={() => act("remove")}>
        Take down
      </button>
      <button className="btn-primary flex-1" disabled={busy} onClick={() => act("relist")}>
        {expired ? "Relist for 7 days" : "Bump to 7 days"}
      </button>
    </div>
  );
}
