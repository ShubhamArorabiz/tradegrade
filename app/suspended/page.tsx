export const metadata = { title: "Account suspended" };

export default function Suspended() {
  return (
    <main className="page flex min-h-dvh flex-col justify-center text-center">
      <h1 className="font-display text-[40px]">Account on hold</h1>
      <p className="mt-2 text-muted">Your account has been suspended. Email support@tradegrade.ca and we&apos;ll sort it out.</p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="btn-secondary w-full">Sign out</button>
      </form>
    </main>
  );
}
