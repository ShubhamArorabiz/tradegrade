"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export default function RateOrder({ orderId, name }: { orderId: string; name: string }) {
  const [stars, setStars] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return <p className="card p-4 text-sm text-ok">Thanks for rating {name}.</p>;
  return (
    <div className="card p-4 text-center">
      <p className="font-semibold">How did it go with {name}?</p>
      <div className="mt-3 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} stars`}
            onClick={async () => {
              setStars(n);
              const res = await fetch(`/api/orders/${orderId}/rate`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ stars: n }),
              });
              if (res.ok) setDone(true);
            }}
          >
            <Star size={32} className={n <= stars ? "fill-warn text-warn" : "text-line"} />
          </button>
        ))}
      </div>
    </div>
  );
}
