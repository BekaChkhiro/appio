import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Appio to keep building your PWAs.",
};

export default function SignInPage() {
  return (
    <Suspense>
      <AuthCard mode="sign-in" />
    </Suspense>
  );
}
