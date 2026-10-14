"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/**
 * Asks to add TradeGrade to the Home Screen, but only after the person has
 * done something useful (posted or bought), and only once.
 */
export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone || safeGet("tg_install_dismissed")) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    safeSet("tg_install_dismissed", "1");
    setShow(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      deferred = null;
    }
    dismiss();
  }

  return (
    <div className="card mt-4 flex items-start gap-3 p-4 animate-rise">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <Download size={20} />
      </div>
      <div className="flex-1 text-sm">
        <p className="font-semibold">Add TradeGrade to your Home Screen</p>
        {ios ? (
          <p className="mt-1 text-muted">
            Tap <Share size={14} className="inline -mt-0.5" /> Share, then <b>Add to Home Screen</b>. You&apos;ll open
            it like an app and get pickup alerts.
          </p>
        ) : (
          <>
            <p className="mt-1 text-muted">Open it like an app, straight to the camera.</p>
            <button onClick={install} className="btn-primary mt-3 h-10 px-4 text-sm">
              Install
            </button>
          </>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="text-faint">
        <X size={18} />
      </button>
    </div>
  );
}
