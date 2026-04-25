import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplacePage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-semibold">Marketplace</h2>
        <p className="max-w-md text-muted-foreground">
          Browse community-built apps. Marketplace UI will be built in T5.2.
        </p>
      </div>
    </div>
  );
}
