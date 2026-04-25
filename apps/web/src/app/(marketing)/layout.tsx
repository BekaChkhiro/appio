import { MarketingNavbar } from "@/components/marketing/marketing-navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNavbar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
