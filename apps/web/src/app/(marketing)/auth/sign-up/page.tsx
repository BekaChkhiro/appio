import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free Appio account and build your first PWA.",
};

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthCard mode="sign-up" />
    </Suspense>
  );
}
