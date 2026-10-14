"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import BackHeader from "@/components/BackHeader";
import { createClient } from "@/lib/supabase/client";
import { QUICK_REPLIES } from "@/lib/constants";
import type { Message } from "@/lib/types";

export default function Chat({
  orderId,
  me,
  otherName,
  title,
  photo,
  open,
  initial,
}: {
  orderId: string;
  me: string;
  otherName: string;
  title: string;
  photo?: string;
  open: boolean;
  initial: Message[];
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const add = (m: Message) => setMessages((all) => (all.some((x) => x.id === m.id) ? all : [...all, m]));
    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` }, (p) => add(p.new as Message))
      .subscribe();
    // Polling backup for networks that block websockets.
    const poll = setInterval(async () => {
      const { data } = await supabase.from("messages").select("*").eq("order_id", orderId).order("created_at");
      if (data) data.forEach((m) => add(m as Message));
    }, 8000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(body: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessages((all) => (all.some((x) => x.id === data.message.id) ? all : [...all, data.message]));
      setText("");
    }
    setSending(false);
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <BackHeader
        title={otherName}
        href={`/orders/${orderId}`}
        right={
          // eslint-disable-next-line @next/next/no-img-element
          photo ? <img src={photo} alt={title} title={title} className="h-9 w-9 rounded-lg object-cover" /> : null
        }
      />
      <div className="page flex-1 space-y-2 py-4">
        <p className="mx-auto w-fit rounded-full bg-surface-2 px-3 py-1 text-center text-[12px] text-faint">
          About &quot;{title}&quot;. Phone numbers and emails stay hidden until pickup is done.
        </p>
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-surface-2"}`}>
                {m.body}
                <span className={`mt-0.5 block text-right text-[10px] ${mine ? "text-white/70" : "text-faint"}`}>
                  {new Date(m.created_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {open ? (
        <div className="sticky bottom-0 border-t border-line bg-white/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
          <div className="page space-y-2">
            <div className="scroll-row">
              {QUICK_REPLIES.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input className="input flex-1 rounded-full bg-surface-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" maxLength={500} enterKeyHint="send" />
              <button className="btn-primary w-12 rounded-full px-0" disabled={!text.trim() || sending} aria-label="Send">
                <SendHorizontal size={18} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="page pb-8 text-center text-sm text-faint">This order is closed.</p>
      )}
    </main>
  );
}
