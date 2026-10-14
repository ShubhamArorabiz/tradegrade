import { requireUser } from "@/lib/auth";
import SnapToList from "./SnapToList";

export const metadata = { title: "Snap to sell" };

export default async function NewListingPage() {
  const { user } = await requireUser("/sell/new");
  return <SnapToList userId={user.id} />;
}
