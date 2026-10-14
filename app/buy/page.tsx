import { Suspense } from "react";
import BrowseClient from "./BrowseClient";

export const metadata = { title: "Browse surplus" };

export default function BuyPage() {
  return (
    <Suspense>
      <BrowseClient />
    </Suspense>
  );
}
