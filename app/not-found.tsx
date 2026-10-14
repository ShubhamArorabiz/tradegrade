import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page flex min-h-dvh flex-col justify-center text-center">
      <h1 className="font-display text-[48px]">Not here</h1>
      <p className="mt-2 text-muted">That listing may have sold or been taken down.</p>
      <Link href="/buy" className="btn-primary mt-6">
        Browse surplus
      </Link>
    </main>
  );
}
