import { Suspense } from "react";
import type { Metadata } from "next";
import { AppSettingsView } from "@/components/app-settings/app-settings-view";

export const metadata: Metadata = {
  title: "App Settings",
};

interface SettingsPageProps {
  params: Promise<{ appId: string }>;
}

export default async function AppSettingsPage({ params }: SettingsPageProps) {
  const { appId } = await params;
  return (
    <Suspense>
      <AppSettingsView appId={appId} />
    </Suspense>
  );
}
