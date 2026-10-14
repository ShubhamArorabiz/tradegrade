import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import Onboarding from "./Onboarding";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : "/";
  const { user, profile } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  if (profile?.full_name) redirect(safeNext);
  return <Onboarding next={safeNext} userId={user.id} />;
}
