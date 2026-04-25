import { Suspense } from "react";
import type { Metadata } from "next";
import { CreateView } from "@/components/create/create-view";

export const metadata: Metadata = {
  title: "Create App",
};

export default function CreatePage() {
  return (
    <Suspense>
      <CreateView />
    </Suspense>
  );
}
