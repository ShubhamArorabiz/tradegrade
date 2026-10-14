"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Camera, User } from "lucide-react";

const TABS = [
  { label: "Home", href: "/", icon: Home, match: (p: string) => p === "/" },
  { label: "Buy", href: "/buy", icon: ShoppingBag, match: (p: string) => p.startsWith("/buy") || p.startsWith("/listing") },
  { label: "Sell", href: "/sell", icon: Camera, match: (p: string) => p.startsWith("/sell") },
  {
    label: "Profile",
    href: "/profile",
    icon: User,
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/orders") || p.startsWith("/admin"),
  },
];

const HIDDEN = [/^\/listing\//, /^\/login/, /^\/onboarding/, /^\/sell\/new/, /^\/orders\/[^/]+\/(scan|chat)/, /^\/suspended/];

export default function BottomTabs() {
  const pathname = usePathname();
  if (HIDDEN.some((r) => r.test(pathname))) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[35] border-t border-line bg-white/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              {tab.label === "Sell" ? (
                <span className="grid h-8 w-11 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_14px_-6px_rgb(255_106_0/0.8)]">
                  <Icon size={18} strokeWidth={2.3} />
                </span>
              ) : (
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              )}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
