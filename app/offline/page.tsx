export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="page flex min-h-dvh flex-col justify-center text-center">
      <h1 className="font-display text-[40px]">No signal</h1>
      <p className="mt-2 text-muted">You&apos;re offline. Pickup passes you&apos;ve opened before still work. Everything else comes back when you reconnect.</p>
    </main>
  );
}
