import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return <PricingView />;
}
