import { Suspense } from "react";
import type { Metadata } from "next";
import { PromptScreen } from "@/components/create/prompt-screen";

export const metadata: Metadata = {
  title: "Create App",
};

export default function CreatePage() {
  return (
    <Suspense>
      <PromptScreen />
    </Suspense>
  );
}
