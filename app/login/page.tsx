import { Suspense } from "react";
import Login from "./Login";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
