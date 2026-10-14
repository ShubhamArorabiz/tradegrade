"use client";

import { useState } from "react";

export default function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="relative">
      <div
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-surface-2"
        style={{ scrollbarWidth: "none" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((src, n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={n === 0 ? title : ""} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {photos.length > 1 && (
        <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[12px] font-bold text-ink shadow-sm">
          {i + 1} / {photos.length}
        </span>
      )}
    </div>
  );
}
