"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Clock, MapPin, Phone, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "tradegrade-demo";

function toE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/";
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"welcome" | "enter" | "code">("welcome");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "google" ? "Google sign-in didn\u2019t finish. Please try again." : null,
  );
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode() {
    setError(null);
    const supabase = createClient();
    let res;
    if (mode === "phone") {
      const phone = toE164(contact);
      if (!phone) return setError("Enter a 10-digit Canadian or US number");
      setBusy(true);
      res = await supabase.auth.signInWithOtp({ phone });
    } else {
      if (!/^\S+@\S+\.\S+$/.test(contact)) return setError("Enter a valid email");
      setBusy(true);
      res = await supabase.auth.signInWithOtp({ email: contact.trim(), options: { shouldCreateUser: true } });
    }
    setBusy(false);
    if (res.error) return setError(res.error.message);
    setStep("code");
    setResendIn(30);
  }

  async function verify(token: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      mode === "phone"
        ? await supabase.auth.verifyOtp({ phone: toE164(contact)!, token, type: "sms" })
        : await supabase.auth.verifyOtp({ email: contact.trim(), token, type: "email" });
    if (error) {
      setBusy(false);
      setCode("");
      return setError("That code didn't work. Check it and try again.");
    }
    router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  async function googleSignIn() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn't available right now.");
    }
  }

  async function demoSignIn(email: string, password = DEMO_PASSWORD) {
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return setError(password === DEMO_PASSWORD ? "Demo sign-in isn't set up yet." : "That email and password didn't match.");
    }
    router.replace(next);
    router.refresh();
  }

  if (step === "welcome") {
    return (
      <main className="page flex min-h-dvh flex-col pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Logo />
        <div className="bg-grid relative mt-5 h-64 overflow-hidden rounded-3xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/welcome-2.jpg" alt="" className="absolute -right-6 top-5 h-36 w-44 rotate-[-4deg] rounded-2xl border-4 border-white object-cover shadow-card" />
          <div className="absolute left-8 top-8 w-44 rotate-[-3deg] rounded-2xl bg-white p-2 shadow-[0_12px_30px_-10px_rgb(10_28_51/0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/welcome-1.jpg" alt="" className="h-28 w-full rounded-xl object-cover" />
            <p className="mt-2 px-1 text-[19px] font-extrabold leading-6">$180</p>
            <p className="px-1 text-[12px] text-muted">Drywall, 40 sheets</p>
            <span className="ml-1 mt-1 inline-flex items-center gap-1 rounded-full bg-ai-soft px-2 py-0.5 text-[11px] font-bold text-ai">
              <Sparkles size={11} /> AI filled
            </span>
          </div>
          <span className="absolute bottom-5 right-5 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[12px] font-bold text-white shadow-lg">
            <MapPin size={13} /> 2.4 km away
          </span>
        </div>
        <h1 className="mt-7 text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em]">
          Turn job-site surplus into <span className="text-brand">cash</span>.
        </h1>
        <p className="mt-3 text-[16px] leading-6 text-muted">
          Snap a photo of leftover material. Claude writes the listing. Contractors nearby buy it today.
        </p>
        <div className="flex-1" />
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            [Zap, "List in 60 s"],
            [MapPin, "25 km radius"],
            [ShieldCheck, "Paid at pickup"],
          ].map(([Icon, text]) => {
            const I = Icon as typeof Zap;
            return (
              <span key={text as string} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold">
                <I size={13} className="text-accent" /> {text as string}
              </span>
            );
          })}
        </div>
        {GOOGLE && (
          <button className="btn-secondary mt-4 w-full text-[16px]" disabled={busy} onClick={googleSignIn}>
            <GoogleIcon /> Continue with Google
          </button>
        )}
        {GOOGLE && !DEMO && error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
        {DEMO && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft p-3">
            <p className="text-[13px] font-bold text-accent">Test site: payments and Claude are simulated</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="btn-secondary h-10 text-[13px]" disabled={busy} onClick={() => demoSignIn("demo-buyer@tradegrade.ca")}>
                Try as a buyer
              </button>
              <button className="btn-secondary h-10 text-[13px]" disabled={busy} onClick={() => demoSignIn("demo-seller@tradegrade.ca")}>
                Try as a seller
              </button>
            </div>
            {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
          </div>
        )}
        {DEMO ? (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              demoSignIn(String(f.get("email")), String(f.get("password")));
            }}
          >
            <details>
              <summary className="cursor-pointer text-center text-[13px] font-bold text-accent">Sign in with email and password</summary>
              <input name="email" type="email" required className="input mt-3" placeholder="Email" autoComplete="username" />
              <input name="password" type="password" required className="input mt-2" placeholder="Password" autoComplete="current-password" />
              <button className="btn-primary mt-3 w-full" disabled={busy}>
                Sign in
              </button>
            </details>
          </form>
        ) : (
          <button className="btn-primary mt-4 w-full text-[16px]" onClick={() => setStep("enter")}>
            <Phone size={18} /> Continue with phone
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-faint">
          By continuing you agree to the Terms and the As-Is policy.{" "}
          {!DEMO && (<button
            className="font-semibold text-accent"
            onClick={() => {
              setMode("email");
              setStep("enter");
            }}
          >
            Use email instead
          </button>)}
        </p>
      </main>
    );
  }

  return (
    <main className="page flex min-h-dvh flex-col pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center justify-between">
        <button
          onClick={() => (step === "code" ? setStep("enter") : setStep("welcome"))}
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface shadow-card"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <span className="flex gap-1">
          <span className="h-1 w-6 rounded-full bg-accent" />
          <span className={`h-1 w-3 rounded-full ${step === "code" ? "bg-accent" : "bg-line"}`} />
        </span>
      </div>
      {step === "enter" ? (
        <form
          className="mt-8 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <h1 className="text-[30px] font-extrabold leading-9 tracking-[-0.03em]">
            {mode === "phone" ? "What\u2019s your number?" : "What\u2019s your email?"}
          </h1>
          <p className="mt-2 text-[16px] text-muted">
            We&apos;ll {mode === "phone" ? "text" : "email"} you a 6-digit code. No passwords to remember.
          </p>
          <label className="label mt-7">{mode === "phone" ? "Mobile number" : "Email"}</label>
          <div className="relative">
            {mode === "phone" && (
              <span className="absolute left-0 top-0 flex h-12 items-center border-r border-line px-3.5 text-[15px] font-bold">CA +1</span>
            )}
            <input
              className={`input text-[16px] ${mode === "phone" ? "pl-[5.25rem]" : ""}`}
              type={mode === "phone" ? "tel" : "email"}
              inputMode={mode === "phone" ? "tel" : "email"}
              autoComplete={mode === "phone" ? "tel-national" : "email"}
              placeholder={mode === "phone" ? "416 555 0123" : "you@company.ca"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="flex-1" />
          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Sending\u2026" : "Send code"}
          </button>
          <button type="button" className="mt-3 w-full text-center text-[13px] font-bold text-accent" onClick={() => setMode(mode === "phone" ? "email" : "phone")}>
            {mode === "phone" ? "Use email instead" : "Use phone instead"}
          </button>
        </form>
      ) : (
        <div className="mt-8 flex flex-1 flex-col">
          <h1 className="text-[30px] font-extrabold leading-9 tracking-[-0.03em]">Enter the 6-digit code</h1>
          <p className="mt-2 text-[16px] text-muted">Sent to {contact}</p>
          <div className="relative mt-7">
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`grid h-14 place-items-center rounded-xl border bg-surface text-[22px] font-extrabold ${
                    i === code.length ? "border-accent ring-2 ring-accent/15" : "border-line"
                  }`}
                >
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
            <input
              className="absolute inset-0 h-full w-full opacity-0"
              aria-label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
              autoFocus
              disabled={busy}
            />
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <button className="mt-4 flex items-center gap-1.5 text-[13px] text-muted disabled:opacity-100" disabled={resendIn > 0 || busy} onClick={sendCode}>
            <Clock size={14} />
            {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, "0")}` : <span className="font-bold text-accent">Resend code</span>}
          </button>
          <div className="flex-1" />
          <button className="btn-primary w-full" disabled={busy || code.length < 6} onClick={() => verify(code)}>
            {busy ? "Checking\u2026" : "Verify and continue"}
          </button>
        </div>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
