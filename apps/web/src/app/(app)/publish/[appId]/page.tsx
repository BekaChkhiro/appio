import type { Metadata } from "next";
import { PublishView } from "@/components/publish/publish-view";

export const metadata: Metadata = { title: "Publish App" };

export default async function PublishPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  return <PublishView appId={appId} />;
}
