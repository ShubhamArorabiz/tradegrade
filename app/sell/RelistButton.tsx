"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export default function RelistButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary mt-3 h-10 w-full text-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/listings/${listingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "relist" }),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      <RotateCcw size={16} /> Relist for 7 days
    </button>
  );
}
