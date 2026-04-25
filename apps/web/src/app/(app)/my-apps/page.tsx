import type { Metadata } from "next";
import { MyAppsView } from "@/components/my-apps/my-apps-view";

export const metadata: Metadata = {
  title: "My Apps",
};

export default function MyAppsPage() {
  return <MyAppsView />;
}
