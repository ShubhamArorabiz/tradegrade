"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function BackHeader({
  title,
  onBack,
  href,
  right,
}: {
  title: string;
  onBack?: () => void;
  href?: string;
  right?: React.ReactNode;
}) {
  const cls = "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface shadow-card";
  return (
    <header className="sticky top-0 z-30 bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="page flex h-14 items-center gap-3">
        {href ? (
          <Link href={href} className={cls} aria-label="Back">
            <ChevronLeft size={20} strokeWidth={2.4} />
          </Link>
        ) : onBack ? (
          <button onClick={onBack} className={cls} aria-label="Back">
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
        ) : <span className="w-10 shrink-0" />}
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold tracking-[-0.01em]">{title}</h1>
        {right ?? <span className="w-10 shrink-0" />}
      </div>
    </header>
  );
}
