"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelOrder({ orderId, asSeller }: { orderId: string; asSeller: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="btn-danger h-11 w-full text-sm"
        disabled={busy}
        onClick={async () => {
          const msg = asSeller
            ? "Cancel this sale? The buyer gets a full refund and your listing goes back live."
            : "Cancel and get a full refund?";
          if (!confirm(msg)) return;
          setBusy(true);
          const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
          const data = await res.json();
          if (!res.ok) setError(data.error);
          setBusy(false);
          router.refresh();
        }}
      >
        {asSeller ? "Can't hand over? Cancel and refund buyer" : "Cancel order (full refund)"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
